import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { generateClaimCode } from "@/lib/claimCode";
import {
  TAG_EXTRACTION_FIELD_MASK,
  extractTagsFromPlace,
  mergeTags,
  type GooglePlaceForTags,
} from "@/lib/googlePlacesMapper";
import { mapBusinessTypeToCategory } from "@/lib/businessClassify";

// Verify caller is authenticated staff
async function requireStaff(req: NextRequest): Promise<{ userId: string } | Response> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: { user }, error } = await supabaseServer.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: staff } = await supabaseServer
    .from("staff_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!staff) return NextResponse.json({ error: "Staff access required" }, { status: 403 });
  return { userId: user.id };
}

/**
 * POST /api/admin/sales/prospect/preview
 * Creates a preview business from a sales lead.
 * - Fetches Google Places photos and stores them in Supabase Storage
 * - Creates a business record (is_active = false)
 * - Links the sales lead to the new business via preview_business_id
 *
 * Body: { leadId: string, recreate?: boolean, mode?: "preview" | "seed" }
 * - mode "preview": creates inactive business for sales preview (default)
 * - mode "seed": creates active trial business with 0% payouts + claim code
 * Returns: { businessId: string, previewUrl: string }
 */
export async function POST(req: NextRequest) {
  const staffResult = await requireStaff(req);
  if (staffResult instanceof Response) return staffResult;

  try {
    const body = await req.json();
    const { leadId, recreate, mode } = body;
    const isSeedMode = mode === "seed";

    if (!leadId) {
      return NextResponse.json({ error: "leadId is required" }, { status: 400 });
    }

    // 1. Fetch the sales lead
    const { data: lead, error: leadErr } = await supabaseServer
      .from("sales_leads")
      .select("*")
      .eq("id", leadId)
      .maybeSingle();

    if (leadErr || !lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Check if preview already exists
    if (lead.preview_business_id && !recreate) {
      return NextResponse.json({
        businessId: lead.preview_business_id,
        previewUrl: `/preview/${lead.preview_business_id}`,
        alreadyExists: true,
      });
    }

    // If recreating, clean up the old preview
    if (lead.preview_business_id && recreate) {
      const oldId = lead.preview_business_id;

      // Delete old media rows
      await supabaseServer.from("business_media").delete().eq("business_id", oldId);
      // Delete old payout tiers
      await supabaseServer.from("business_payout_tiers").delete().eq("business_id", oldId);
      // Delete old business record
      await supabaseServer.from("business").delete().eq("id", oldId);

      // Clean up old photos from storage
      if (lead.google_place_id) {
        const { data: oldFiles } = await supabaseServer.storage
          .from("prospect-media")
          .list(`prospects/${lead.google_place_id}`);
        if (oldFiles && oldFiles.length > 0) {
          const paths = oldFiles.map(f => `prospects/${lead.google_place_id}/${f.name}`);
          await supabaseServer.storage.from("prospect-media").remove(paths);
        }
      }

      // Clear the link
      await supabaseServer.from("sales_leads")
        .update({ preview_business_id: null })
        .eq("id", leadId);
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Google Maps API key not configured" }, { status: 500 });
    }

    // 2. Fetch Google Places details (including photos and hours)
    const placeId = lead.google_place_id;
    let photos: { url: string; focalX: number; focalY: number }[] = [];
    let googleHours: Record<string, { enabled: boolean; open: string; close: string }> | null = null;

    let extractedTags: string[] = [];
    let editorialSummary: string | null = null;

    if (placeId) {
      // Fetch Place Details — baseline (photos/hours) + tag-extraction fields so
      // the seed/preview business gets cuisine/dietary/Extras tags from the start.
      const detailsFieldMask = [
        "photos",
        "currentOpeningHours",
        "regularOpeningHours",
        ...TAG_EXTRACTION_FIELD_MASK,
        "types",
      ].join(",");

      const detailsRes = await fetch(
        `https://places.googleapis.com/v1/places/${placeId}`,
        {
          headers: {
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": detailsFieldMask,
          },
        }
      );

      if (detailsRes.ok) {
        const detailsData = await detailsRes.json();

        // Parse hours from regularOpeningHours
        const openingHours = detailsData.regularOpeningHours;
        if (openingHours?.periods) {
          googleHours = parseGoogleHours(openingHours.periods);
        }

        // Fetch and store photos (up to 5)
        const photoRefs = (detailsData.photos || []).slice(0, 5);
        if (photoRefs.length > 0) {
          photos = await fetchAndStorePhotos(placeId, photoRefs, apiKey);
        }

        // Tag extraction from the new fields
        const placeForTags: GooglePlaceForTags = {
          primaryType: detailsData.primaryType ?? null,
          types: Array.isArray(detailsData.types) ? detailsData.types : null,
          servesVegetarianFood: detailsData.servesVegetarianFood ?? null,
          outdoorSeating: detailsData.outdoorSeating ?? null,
          allowsDogs: detailsData.allowsDogs ?? null,
          editorialSummary: detailsData.editorialSummary ?? null,
          businessName: lead.business_name ?? null,
        };
        extractedTags = extractTagsFromPlace(placeForTags).allTags;
        const summaryText = detailsData.editorialSummary?.text;
        if (typeof summaryText === "string" && summaryText.trim()) {
          editorialSummary = summaryText.trim();
        }
      }
    }

    // 3. Map Google price level to our format
    const priceLevelMap: Record<number, string> = { 0: "$", 1: "$", 2: "$$", 3: "$$$", 4: "$$$$" };
    const priceLevel = priceLevelMap[lead.google_price_level ?? 2] || "$$";

    // Parse address into street/city/state/zip
    const addressParts = parseAddress(lead.address || "");

    // 4. Build hours columns (individual day columns are the source of truth)
    const hourColumns: Record<string, string | null> = {
      mon_open: null, mon_close: null,
      tue_open: null, tue_close: null,
      wed_open: null, wed_close: null,
      thu_open: null, thu_close: null,
      fri_open: null, fri_close: null,
      sat_open: null, sat_close: null,
      sun_open: null, sun_close: null,
    };

    if (googleHours) {
      const dayMap: Record<string, string> = {
        mon: "mon", tue: "tue", wed: "wed", thu: "thu",
        fri: "fri", sat: "sat", sun: "sun",
      };
      for (const [abbr, info] of Object.entries(googleHours)) {
        if (dayMap[abbr] && info.enabled && info.open && info.close) {
          hourColumns[`${abbr}_open`] = info.open;
          hourColumns[`${abbr}_close`] = info.close;
        }
      }
    }

    // 5. Build config JSONB. Subtype is the broad category (e.g. "Restaurant");
    // mergeTags layers in cuisine/dietary/Extras from the Google extraction so
    // the discovery filters work on the new business right away. Pass the
    // business name so the classifier's name fallback can rescue places where
    // Google's primaryType is generic ("store" / "point_of_interest").
    const leadName = lead.business_name || "";
    const subtypeCategory = mapBusinessTypeToCategory(lead.business_type || "Restaurant", leadName);
    const seededTags = mergeTags([subtypeCategory], extractedTags);
    const config: Record<string, unknown> = {
      businessType: subtypeCategory,
      priceLevel,
      payoutPreset: isSeedMode ? "trial" : "standard",
      images: photos.map(p => p.url),
      tags: seededTags,
    };

    // 5b. For seed mode, read trial duration from platform_settings and generate claim code
    let trialExpiresAt: string | null = null;
    let claimCode: string | null = null;

    if (isSeedMode) {
      const { data: settings } = await supabaseServer
        .from("platform_settings")
        .select("value")
        .eq("id", 1)
        .maybeSingle();

      const trialDays = settings?.value?.trial_duration_days ?? 90;
      const expiresDate = new Date();
      expiresDate.setDate(expiresDate.getDate() + trialDays);
      trialExpiresAt = expiresDate.toISOString();

      // Generate a unique claim code (retry on collision)
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = generateClaimCode();
        const { data: existing } = await supabaseServer
          .from("business")
          .select("id")
          .eq("claim_code", candidate)
          .maybeSingle();
        if (!existing) {
          claimCode = candidate;
          break;
        }
      }
      if (!claimCode) {
        return NextResponse.json({ error: "Failed to generate unique claim code" }, { status: 500 });
      }
    }

    // 6. Generate a business ID (slug from name)
    const idPrefix = isSeedMode ? "seed" : "preview";
    const slug = (lead.business_name || "business")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50);
    const businessId = `${idPrefix}-${slug}-${Date.now().toString(36)}`;

    // 7. Create business record
    const { error: bizErr } = await supabaseServer
      .from("business")
      .insert({
        id: businessId,
        business_name: lead.business_name,
        public_business_name: lead.business_name,
        is_active: isSeedMode ? true : false,
        billing_plan: isSeedMode ? "trial" : null,
        seeded_at: isSeedMode ? new Date().toISOString() : null,
        trial_expires_at: trialExpiresAt,
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
        category_main: subtypeCategory,
        config,
        tags: seededTags,
        ...(editorialSummary ? { blurb: editorialSummary } : {}),
        payout_preset: isSeedMode ? "trial" : "standard",
        ...hourColumns,
      });

    if (bizErr) {
      console.error("[preview] Business insert error:", bizErr);
      return NextResponse.json({ error: `Failed to create business: ${bizErr.message}` }, { status: 500 });
    }

    // 8. Insert business_media rows for the stored photos
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

      const { error: mediaErr } = await supabaseServer
        .from("business_media")
        .insert(mediaRows);

      if (mediaErr) {
        console.error("[preview] Media insert error:", mediaErr);
        // Non-fatal — business still created, just without media rows
      }
    }

    // 9. Create payout tiers (0% for seed mode, standard for preview)
    const tierBps = isSeedMode
      ? [0, 0, 0, 0, 0, 0, 0]
      : [500, 750, 1000, 1250, 1500, 1750, 2000];
    const tierRows = tierBps.map((bps, idx) => ({
      business_id: businessId,
      tier_index: idx + 1,
      percent_bps: bps,
      min_visits: idx === 0 ? 1 : idx * 10 + 1,
      max_visits: idx === 6 ? null : (idx + 1) * 10,
      label: ["Starter", "Regular", "Favorite", "VIP", "Elite", "Legend", "Ultimate"][idx],
    }));

    const { error: tierErr } = await supabaseServer
      .from("business_payout_tiers")
      .insert(tierRows);

    if (tierErr) {
      console.error("[preview] Tier insert error:", tierErr);
      // Non-fatal
    }

    // 10. Update sales_leads with the preview/seed business ID
    const leadUpdate: Record<string, unknown> = { preview_business_id: businessId };
    if (isSeedMode) {
      leadUpdate.seeded_at = new Date().toISOString();
    }

    const { error: updateErr } = await supabaseServer
      .from("sales_leads")
      .update(leadUpdate)
      .eq("id", leadId);

    if (updateErr) {
      console.error("[preview] Lead update error:", updateErr);
      // Non-fatal — the business was created, just the link failed
    }

    return NextResponse.json({
      businessId,
      previewUrl: `/preview/${businessId}`,
      photosStored: photos.length,
      ...(isSeedMode && { claimCode, trialExpiresAt, mode: "seed" }),
    });
  } catch (err) {
    console.error("[preview] Unexpected error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// ─── Helpers ───

interface GoogleOpeningPeriod {
  open?: { day: number; hour: number; minute: number };
  close?: { day: number; hour: number; minute: number };
}

function parseGoogleHours(
  periods: GoogleOpeningPeriod[]
): Record<string, { enabled: boolean; open: string; close: string }> {
  // Google uses day 0=Sunday, 1=Monday, ..., 6=Saturday
  const dayIndexMap: Record<number, string> = {
    0: "sun", 1: "mon", 2: "tue", 3: "wed",
    4: "thu", 5: "fri", 6: "sat",
  };

  const result: Record<string, { enabled: boolean; open: string; close: string }> = {
    mon: { enabled: false, open: "", close: "" },
    tue: { enabled: false, open: "", close: "" },
    wed: { enabled: false, open: "", close: "" },
    thu: { enabled: false, open: "", close: "" },
    fri: { enabled: false, open: "", close: "" },
    sat: { enabled: false, open: "", close: "" },
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
      // Skip low-quality photos (under 400px wide)
      if (ref.widthPx && ref.widthPx < 400) {
        console.log(`[preview] Skipping photo ${i}: too small (${ref.widthPx}px wide)`);
        continue;
      }

      // Fetch photo from Google Places API (New) — max 1600px width
      const photoUrl = `https://places.googleapis.com/v1/${ref.name}/media?maxWidthPx=1600&key=${apiKey}`;
      const photoRes = await fetch(photoUrl, { redirect: "follow" });

      if (!photoRes.ok) {
        console.error(`[preview] Photo fetch failed for ${ref.name}: ${photoRes.status}`);
        continue;
      }

      const photoBuffer = await photoRes.arrayBuffer();

      // Skip empty or tiny responses (failed downloads show as black)
      if (photoBuffer.byteLength < 5000) {
        console.log(`[preview] Skipping photo ${i}: too small (${photoBuffer.byteLength} bytes)`);
        continue;
      }

      const contentType = photoRes.headers.get("content-type") || "image/jpeg";

      // Skip non-image responses (HTML error pages, etc.)
      if (!contentType.startsWith("image/")) {
        console.log(`[preview] Skipping photo ${i}: not an image (${contentType})`);
        continue;
      }

      const ext = contentType.includes("png") ? "png" : "jpg";

      // Store in Supabase Storage
      const storagePath = `prospects/${placeId}/${i}.${ext}`;
      const { error: uploadErr } = await supabaseServer.storage
        .from("prospect-media")
        .upload(storagePath, photoBuffer, {
          contentType,
          upsert: true,
        });

      if (uploadErr) {
        console.error(`[preview] Photo upload error:`, uploadErr);
        continue;
      }

      // Get public URL
      const { data: urlData } = supabaseServer.storage
        .from("prospect-media")
        .getPublicUrl(storagePath);

      if (urlData?.publicUrl) {
        stored.push({
          url: urlData.publicUrl,
          focalX: 50,
          focalY: 50,
        });
      }
    } catch (err) {
      console.error(`[preview] Photo ${i} error:`, err);
    }
  }

  return stored;
}

function parseAddress(fullAddress: string): {
  street: string;
  city: string;
  state: string;
  zip: string;
} {
  // Try to parse "123 Main St, Omaha, NE 68102, USA" format
  const parts = fullAddress.split(",").map(s => s.trim());
  if (parts.length >= 3) {
    const street = parts[0];
    const city = parts[1];
    // "NE 68102" or "NE 68102 USA"
    const stateZipMatch = parts[2].match(/^([A-Z]{2})\s+(\d{5})/);
    if (stateZipMatch) {
      return { street, city, state: stateZipMatch[1], zip: stateZipMatch[2] };
    }
    return { street, city, state: parts[2], zip: parts[3] || "" };
  }
  return { street: fullAddress, city: "", state: "", zip: "" };
}

