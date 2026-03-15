import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { ZIP_COORDS, haversineDistance, CAMPAIGN_RADIUS } from "@/lib/zipUtils";

/**
 * GET /api/spotlight?zip=XXXXX
 * Returns active ad campaigns for the home page spotlight rotation,
 * filtered by distance from the user's home zip when provided.
 * Priority order: by price_cents descending.
 * Response: { ads: SpotlightAd[], ad: SpotlightAd | null }
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const userZip = searchParams.get("zip") || null;
    const userCoords = userZip ? ZIP_COORDS[userZip] || null : null;

    const today = new Date().toISOString().split("T")[0];

    // Fetch active/purchased campaigns whose dates include today
    const { data: campaigns, error: campErr } = await supabaseServer
      .from("business_ad_campaigns")
      .select("id, business_id, campaign_type, start_date, end_date, price_cents, status, meta, impressions, clicks")
      .in("status", ["active", "purchased", "scheduled"])
      .lte("start_date", today)
      .gte("end_date", today)
      .order("price_cents", { ascending: false })
      .limit(20);

    if (campErr) {
      console.error("[spotlight] campaign query error:", campErr.message);
      return NextResponse.json({ ad: null, ads: [] });
    }

    if (!campaigns || campaigns.length === 0) {
      return NextResponse.json({ ad: null, ads: [] });
    }

    // Get unique business IDs
    const bizIds = Array.from(new Set(campaigns.map(c => c.business_id))) as string[];

    // Batch-fetch all businesses
    const { data: businesses, error: bizErr } = await supabaseServer
      .from("business")
      .select(
        "id, business_name, public_business_name, business_type, category_main, business_phone, contact_phone, street_address, city, state, zip, blurb, description, website, config"
      )
      .in("id", bizIds);

    if (bizErr || !businesses) {
      console.error("[spotlight] business query error:", bizErr?.message);
      return NextResponse.json({ ad: null, ads: [] });
    }

    type BizRow = typeof businesses[number];
    const bizMap = new Map<string, BizRow>(businesses.map(b => [b.id as string, b]));

    // Batch-fetch all business media
    const { data: allMedia } = await supabaseServer
      .from("business_media")
      .select("business_id, bucket, path")
      .in("business_id", bizIds)
      .eq("is_active", true)
      .eq("media_type", "photo")
      .order("sort_order", { ascending: true });

    // Group media by business_id
    const mediaMap = new Map<string, Array<{ bucket: string; path: string }>>();
    if (allMedia) {
      for (const row of allMedia) {
        const arr = mediaMap.get(row.business_id) || [];
        arr.push(row);
        mediaMap.set(row.business_id, arr);
      }
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

    // Build ad objects for each campaign, filtering by distance
    const ads = [];
    for (const campaign of campaigns) {
      const biz = bizMap.get(campaign.business_id);
      if (!biz) continue;

      // Distance filtering: only apply when user zip is known
      if (userCoords) {
        const maxRadius = CAMPAIGN_RADIUS[campaign.campaign_type as string] ?? null;
        if (maxRadius !== null) {
          const bizZip = biz.zip as string | null;
          const bizCoords = bizZip ? ZIP_COORDS[bizZip] || null : null;
          if (bizCoords) {
            const distance = haversineDistance(userCoords[0], userCoords[1], bizCoords[0], bizCoords[1]);
            if (distance > maxRadius) continue; // outside campaign radius
          }
          // If bizCoords unknown, include campaign (permissive)
        }
        // Tour-wide (maxRadius null) always passes
      }

      const meta = (campaign.meta ?? {}) as Record<string, unknown>;
      const images: string[] = [];

      // Only show the campaign's selected images — no gallery padding
      if (Array.isArray(meta.image_urls) && meta.image_urls.length > 0) {
        for (const u of meta.image_urls as string[]) {
          if (typeof u === "string" && u) images.push(u);
        }
      } else if (meta.image_url && typeof meta.image_url === "string") {
        // Legacy single-image campaigns
        images.push(meta.image_url);
      } else {
        // No campaign image selected — use just the first gallery photo as a single hero
        const mediaRows = mediaMap.get(biz.id) || [];
        for (const row of mediaRows.slice(0, 1)) {
          const bucket = String(row.bucket || "business-media");
          const path = String(row.path || "");
          if (!path) continue;
          images.push(`${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`);
        }
      }

      // Increment impressions (fire-and-forget)
      supabaseServer
        .from("business_ad_campaigns")
        .update({ impressions: (campaign.impressions ?? 0) + 1 })
        .eq("id", campaign.id)
        .then(({ error: impErr }) => {
          if (impErr) console.error("[spotlight] impression increment error:", impErr.message);
        });

      const config = (biz.config ?? {}) as Record<string, unknown>;
      // Use config.businessType (user-provided) → category_main fallback
      const resolvedType = String(config.businessType ?? "").toLowerCase() || ((biz.category_main as string) ?? "").toLowerCase();
      const typeName = formatTypeName(resolvedType);

      ads.push({
        campaignId: campaign.id,
        campaignType: campaign.campaign_type,
        businessId: biz.id,
        businessName: biz.public_business_name || biz.business_name || "Unknown",
        businessType: typeName,
        category: biz.category_main || "",
        phone: biz.business_phone || biz.contact_phone || "",
        address: biz.street_address || "",
        city: biz.city || "",
        state: biz.state || "",
        zip: biz.zip || "",
        description: biz.blurb || biz.description || "",
        website: biz.website || (config.website as string) || "",
        images,
      });
    }

    return NextResponse.json({
      ad: ads[0] || null,
      ads,
    });
  } catch (err) {
    console.error("[spotlight] error:", err);
    return NextResponse.json({ ad: null, ads: [] });
  }
}

function formatTypeName(raw: string): string {
  const map: Record<string, string> = {
    restaurant_bar: "Restaurant & Bar",
    activity: "Activity",
    salon_beauty: "Salon & Beauty",
    retail: "Retail",
    event_venue: "Event Venue",
    other: "Other",
  };
  return map[raw] || raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
