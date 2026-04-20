import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { generateClaimCode } from "@/lib/claimCode";

// Verify caller is authenticated staff
async function requireStaff(req: NextRequest): Promise<{ userId: string; userName: string } | Response> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: { user }, error } = await supabaseServer.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: staff } = await supabaseServer
    .from("staff_users").select("user_id, name").eq("user_id", user.id).maybeSingle();
  if (!staff) return NextResponse.json({ error: "Staff access required" }, { status: 403 });
  return { userId: user.id, userName: staff.name || "" };
}

interface SeedResult {
  leadId: string;
  businessName: string;
  status: "success" | "skipped" | "failed";
  businessId?: string;
  claimCode?: string;
  error?: string;
}

/**
 * POST /api/admin/sales/prospect/bulk-seed
 * Bulk-seeds multiple sales leads as active trial businesses with 0% payouts.
 *
 * Body: { leadIds: string[] }
 * Returns: { total, succeeded, skipped, failed, results: SeedResult[] }
 */
export async function POST(req: NextRequest) {
  const staffResult = await requireStaff(req);
  if (staffResult instanceof Response) return staffResult;
  const { userId: staffId, userName: staffName } = staffResult;

  try {
    const body = await req.json();
    const { leadIds } = body;

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json({ error: "leadIds array is required" }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Google Maps API key not configured" }, { status: 500 });
    }

    // Read trial duration from platform_settings
    const { data: settings } = await supabaseServer
      .from("platform_settings")
      .select("value")
      .eq("id", 1)
      .maybeSingle();
    const trialDays = settings?.value?.trial_duration_days ?? 90;

    const results: SeedResult[] = [];
    let succeeded = 0;
    let skipped = 0;
    let failed = 0;

    // Process sequentially to avoid Google API rate limits
    for (const leadId of leadIds) {
      try {
        // Fetch the lead
        const { data: lead, error: leadErr } = await supabaseServer
          .from("sales_leads")
          .select("*")
          .eq("id", leadId)
          .maybeSingle();

        if (leadErr || !lead) {
          results.push({ leadId, businessName: "", status: "failed", error: "Lead not found" });
          failed++;
          continue;
        }

        // Skip if already seeded
        if (lead.seeded_at) {
          results.push({ leadId, businessName: lead.business_name, status: "skipped", error: "Already seeded" });
          skipped++;
          continue;
        }

        // Fetch Google Places details (photos + hours)
        const placeId = lead.google_place_id;
        let photos: { url: string; focalX: number; focalY: number }[] = [];
        let googleHours: Record<string, { enabled: boolean; open: string; close: string }> | null = null;

        if (placeId) {
          const detailsFieldMask = ["photos", "currentOpeningHours", "regularOpeningHours"].join(",");
          const detailsRes = await fetch(
            `https://places.googleapis.com/v1/places/${placeId}`,
            { headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": detailsFieldMask } }
          );

          if (detailsRes.ok) {
            const detailsData = await detailsRes.json();
            const openingHours = detailsData.regularOpeningHours;
            if (openingHours?.periods) {
              googleHours = parseGoogleHours(openingHours.periods);
            }
            const photoRefs = (detailsData.photos || []).slice(0, 5) as GooglePhotoRef[];
            if (photoRefs.length > 0) {
              photos = await fetchAndStorePhotos(placeId, photoRefs, apiKey);
            }
          }
        }

        // Build hours columns
        const hourColumns: Record<string, string | null> = {
          mon_open: null, mon_close: null, tue_open: null, tue_close: null,
          wed_open: null, wed_close: null, thu_open: null, thu_close: null,
          fri_open: null, fri_close: null, sat_open: null, sat_close: null,
          sun_open: null, sun_close: null,
        };
        if (googleHours) {
          for (const [abbr, info] of Object.entries(googleHours)) {
            if (info.enabled && info.open && info.close) {
              hourColumns[`${abbr}_open`] = info.open;
              hourColumns[`${abbr}_close`] = info.close;
            }
          }
        }

        // Map price level
        const priceLevelMap: Record<number, string> = { 0: "$", 1: "$", 2: "$$", 3: "$$$", 4: "$$$$" };
        const priceLevel = priceLevelMap[lead.google_price_level ?? 2] || "$$";
        const addressParts = parseAddress(lead.address || "");

        // Generate claim code (unique)
        let claimCode: string | null = null;
        for (let attempt = 0; attempt < 5; attempt++) {
          const candidate = generateClaimCode();
          const { data: existing } = await supabaseServer
            .from("business")
            .select("id")
            .eq("claim_code", candidate)
            .maybeSingle();
          if (!existing) { claimCode = candidate; break; }
        }
        if (!claimCode) {
          results.push({ leadId, businessName: lead.business_name, status: "failed", error: "Claim code generation failed" });
          failed++;
          continue;
        }

        // Trial expiration
        const expiresDate = new Date();
        expiresDate.setDate(expiresDate.getDate() + trialDays);

        // Generate business ID
        const slug = (lead.business_name || "business")
          .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
        const businessId = `seed-${slug}-${Date.now().toString(36)}`;

        // Config
        const config: Record<string, unknown> = {
          businessType: mapBusinessTypeToCategory(lead.business_type || "Restaurant"),
          priceLevel,
          payoutPreset: "trial",
          images: photos.map(p => p.url),
        };

        // Insert business
        const { error: bizErr } = await supabaseServer
          .from("business")
          .insert({
            id: businessId,
            business_name: lead.business_name,
            public_business_name: lead.business_name,
            is_active: true,
            billing_plan: "trial",
            seeded_at: new Date().toISOString(),
            trial_expires_at: expiresDate.toISOString(),
            claim_code: claimCode,
            street_address: addressParts.street || lead.address || "",
            address_line1: addressParts.street || lead.address || "",
            city: lead.city || addressParts.city || "",
            state: lead.state || addressParts.state || "",
            zip: lead.zip || addressParts.zip || "",
            postal_code: lead.zip || addressParts.zip || "",
            contact_phone: lead.phone || "",
            phone_number: lead.phone || "",
            website: lead.website || "",
            website_url: lead.website || "",
            category_main: mapBusinessTypeToCategory(lead.business_type || "Restaurant"),
            config,
            payout_preset: "trial",
            ...hourColumns,
          });

        if (bizErr) {
          results.push({ leadId, businessName: lead.business_name, status: "failed", error: bizErr.message });
          failed++;
          continue;
        }

        // Insert media rows
        if (photos.length > 0) {
          const mediaRows = photos.map((photo, idx) => ({
            business_id: businessId,
            bucket: "prospect-media",
            path: photo.url.split("/prospect-media/")[1] || photo.url,
            sort_order: idx,
            media_type: "photo",
            is_active: true,
            meta: { focal_x: photo.focalX, focal_y: photo.focalY, source: "google_places" },
          }));
          await supabaseServer.from("business_media").insert(mediaRows);
        }

        // Insert 0% payout tiers
        const tierRows = [0, 0, 0, 0, 0, 0, 0].map((bps, idx) => ({
          business_id: businessId,
          tier_index: idx + 1,
          percent_bps: bps,
          min_visits: idx === 0 ? 1 : idx * 10 + 1,
          max_visits: idx === 6 ? null : (idx + 1) * 10,
          label: ["Starter", "Regular", "Favorite", "VIP", "Elite", "Legend", "Ultimate"][idx],
        }));
        await supabaseServer.from("business_payout_tiers").insert(tierRows);

        // Update sales lead
        await supabaseServer.from("sales_leads")
          .update({ preview_business_id: businessId, seeded_at: new Date().toISOString() })
          .eq("id", leadId);

        results.push({
          leadId,
          businessName: lead.business_name,
          status: "success",
          businessId,
          claimCode,
        });
        succeeded++;
      } catch (err) {
        results.push({
          leadId,
          businessName: "",
          status: "failed",
          error: err instanceof Error ? err.message : "Unknown error",
        });
        failed++;
      }
    }

    // Audit log the bulk seed action
    await supabaseServer.from("audit_log").insert({
      action: "bulk_seed_businesses",
      tab: "Sales",
      target_type: "business",
      details: `Bulk seeded ${succeeded} businesses (${skipped} skipped, ${failed} failed) from ${leadIds.length} leads`,
      staff_id: staffId,
      staff_name: staffName,
    }).then(() => {}, () => {}); // fire-and-forget

    return NextResponse.json({
      total: leadIds.length,
      succeeded,
      skipped,
      failed,
      results,
    });
  } catch (err) {
    console.error("[bulk-seed] Unexpected error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/sales/prospect/bulk-seed
 * Unseeds businesses: deactivates them and clears trial state on the lead.
 *
 * Body: { leadIds: string[] }
 */
export async function DELETE(req: NextRequest) {
  const staffResult = await requireStaff(req);
  if (staffResult instanceof Response) return staffResult;
  const { userId: staffId, userName: staffName } = staffResult;

  try {
    const body = await req.json();
    const { leadIds } = body;

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json({ error: "leadIds array is required" }, { status: 400 });
    }

    let succeeded = 0;
    let failed = 0;
    let skipped = 0;

    for (const leadId of leadIds) {
      try {
        const { data: lead, error: leadErr } = await supabaseServer
          .from("sales_leads")
          .select("id, business_name, preview_business_id, seeded_at")
          .eq("id", leadId)
          .maybeSingle();

        if (leadErr || !lead) {
          failed++;
          continue;
        }

        if (!lead.seeded_at) {
          skipped++;
          continue;
        }

        // Deactivate the business
        if (lead.preview_business_id) {
          await supabaseServer
            .from("business")
            .update({
              is_active: false,
              billing_plan: null,
              seeded_at: null,
              claim_code: null,
              trial_expires_at: null,
            })
            .eq("id", lead.preview_business_id);
        }

        // Clear seeded state on the lead
        await supabaseServer
          .from("sales_leads")
          .update({ seeded_at: null, preview_business_id: null })
          .eq("id", leadId);

        succeeded++;
      } catch {
        failed++;
      }
    }

    // Audit log
    await supabaseServer.from("audit_log").insert({
      action: "bulk_unseed_businesses",
      tab: "Sales",
      target_type: "business",
      details: `Removed ${succeeded} seeded businesses (${skipped} skipped, ${failed} failed) from ${leadIds.length} leads`,
      staff_id: staffId,
      staff_name: staffName,
    }).then(() => {}, () => {});

    return NextResponse.json({ total: leadIds.length, succeeded, skipped, failed });
  } catch (err) {
    console.error("[bulk-unseed] Unexpected error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// ─── Helpers (duplicated from preview/route.ts for independence) ───

interface GoogleOpeningPeriod {
  open?: { day: number; hour: number; minute: number };
  close?: { day: number; hour: number; minute: number };
}

function parseGoogleHours(
  periods: GoogleOpeningPeriod[]
): Record<string, { enabled: boolean; open: string; close: string }> {
  const dayIndexMap: Record<number, string> = {
    0: "sun", 1: "mon", 2: "tue", 3: "wed", 4: "thu", 5: "fri", 6: "sat",
  };
  const result: Record<string, { enabled: boolean; open: string; close: string }> = {
    mon: { enabled: false, open: "", close: "" }, tue: { enabled: false, open: "", close: "" },
    wed: { enabled: false, open: "", close: "" }, thu: { enabled: false, open: "", close: "" },
    fri: { enabled: false, open: "", close: "" }, sat: { enabled: false, open: "", close: "" },
    sun: { enabled: false, open: "", close: "" },
  };
  for (const period of periods) {
    if (!period.open) continue;
    const dayAbbr = dayIndexMap[period.open.day];
    if (!dayAbbr) continue;
    const openTime = `${String(period.open.hour).padStart(2, "0")}:${String(period.open.minute).padStart(2, "0")}`;
    const closeTime = period.close
      ? `${String(period.close.hour).padStart(2, "0")}:${String(period.close.minute).padStart(2, "0")}`
      : "23:59";
    result[dayAbbr] = { enabled: true, open: openTime, close: closeTime };
  }
  return result;
}

interface GooglePhotoRef {
  name: string;
  widthPx?: number;
  heightPx?: number;
}

async function fetchAndStorePhotos(
  placeId: string,
  photoRefs: GooglePhotoRef[],
  apiKey: string,
): Promise<{ url: string; focalX: number; focalY: number }[]> {
  const stored: { url: string; focalX: number; focalY: number }[] = [];
  for (let i = 0; i < photoRefs.length; i++) {
    const ref = photoRefs[i];
    try {
      if (ref.widthPx && ref.widthPx < 400) continue;
      const photoUrl = `https://places.googleapis.com/v1/${ref.name}/media?maxWidthPx=1600&key=${apiKey}`;
      const photoRes = await fetch(photoUrl, { redirect: "follow" });
      if (!photoRes.ok) continue;
      const photoBuffer = await photoRes.arrayBuffer();
      if (photoBuffer.byteLength < 5000) continue;
      const contentType = photoRes.headers.get("content-type") || "image/jpeg";
      if (!contentType.startsWith("image/")) continue;
      const ext = contentType.includes("png") ? "png" : "jpg";
      const storagePath = `prospects/${placeId}/${i}.${ext}`;
      const { error: uploadErr } = await supabaseServer.storage
        .from("prospect-media")
        .upload(storagePath, photoBuffer, { contentType, upsert: true });
      if (uploadErr) continue;
      const { data: urlData } = supabaseServer.storage
        .from("prospect-media")
        .getPublicUrl(storagePath);
      if (urlData?.publicUrl) {
        stored.push({ url: urlData.publicUrl, focalX: 50, focalY: 50 });
      }
    } catch {
      // skip failed photos
    }
  }
  return stored;
}

function parseAddress(fullAddress: string): { street: string; city: string; state: string; zip: string } {
  const parts = fullAddress.split(",").map(s => s.trim());
  if (parts.length >= 3) {
    const street = parts[0];
    const city = parts[1];
    const stateZipMatch = parts[2].match(/^([A-Z]{2})\s+(\d{5})/);
    if (stateZipMatch) return { street, city, state: stateZipMatch[1], zip: stateZipMatch[2] };
    return { street, city, state: parts[2], zip: parts[3] || "" };
  }
  return { street: fullAddress, city: "", state: "", zip: "" };
}

function mapBusinessTypeToCategory(googleType: string): string {
  const t = googleType.toLowerCase();
  if (t.includes("restaurant") || t.includes("food") || t.includes("diner")) return "restaurant_bar";
  if (t.includes("bar") || t.includes("pub") || t.includes("brewery") || t.includes("lounge") || t.includes("nightclub") || t.includes("winery")) return "restaurant_bar";
  if (t.includes("coffee") || t.includes("cafe") || t.includes("bakery") || t.includes("ice cream") || t.includes("juice") || t.includes("deli")) return "restaurant_bar";
  if (t.includes("salon") || t.includes("beauty") || t.includes("spa") || t.includes("barber") || t.includes("nail") || t.includes("yoga")) return "salon_beauty";
  if (t.includes("gym") || t.includes("fitness")) return "activity";
  return "activity";
}
