import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { ZIP_COORDS } from "@/lib/zipUtils";

/**
 * GET /api/businesses/discover
 * Paginated business discovery endpoint for the swipe feed.
 *
 * Query params:
 *   page     - page number (default 1)
 *   limit    - businesses per page (default 50, max 100)
 *   search   - text search (name, address, tags)
 *   category - filter by business subtype/category
 *   price    - filter by price level ($, $$, $$$, $$$$)
 *   openNow  - "true" to filter by currently open
 *   tags     - comma-separated tag filter
 *   followed - "true" to show only followed businesses (requires userId)
 *   userId   - current user ID (for followed filter)
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(sp.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(sp.get("limit") || "50", 10)));
    const search = sp.get("search")?.trim() || "";
    const category = sp.get("category") || "";
    const price = sp.get("price") || "";
    const openNow = sp.get("openNow") === "true";
    const tags = sp.get("tags")?.split(",").filter(Boolean) || [];
    const followed = sp.get("followed") === "true";
    const userId = sp.get("userId") || "";
    const distance = parseFloat(sp.get("distance") || "0");
    const userLat = parseFloat(sp.get("userLat") || "0");
    const userLng = parseFloat(sp.get("userLng") || "0");
    const hasRewards = sp.get("hasRewards") === "true";
    const userZip = sp.get("userZip") || "";

    // Build the business query
    let query = supabaseServer
      .from("business")
      .select(`
        id, business_name, public_business_name,
        contact_phone, website, street_address, city, state, zip,
        phone_number, website_url, address_line1,
        category_main, config, blurb, tags,
        payout_tiers, payout_preset,
        billing_plan, claim_code, seeded_at,
        chain_id, store_number,
        latitude, longitude,
        mon_open, mon_close, tue_open, tue_close, wed_open, wed_close,
        thu_open, thu_close, fri_open, fri_close, sat_open, sat_close,
        sun_open, sun_close,
        created_at
      `, { count: "exact" })
      .eq("is_active", true);

    // Has Rewards — exclude trial businesses (billing_plan = "trial")
    // Claimed seed businesses (billing_plan changed to basic/premium) are NOT excluded
    if (hasRewards) {
      query = query.neq("billing_plan", "trial");
    }

    // Text search — match business name, address, or category
    if (search) {
      query = query.or(
        `business_name.ilike.%${search}%,public_business_name.ilike.%${search}%,street_address.ilike.%${search}%,city.ilike.%${search}%`
      );
    }

    // Category filter — filter by the business subtype stored in the tags column
    if (category && category !== "All") {
      const categories = category.split(",").map(c => c.trim()).filter(Boolean);
      if (categories.length === 1) {
        query = query.contains("tags", [categories[0]]);
      } else if (categories.length > 1) {
        // OR across multiple selected categories: business must match at least one
        query = query.or(categories.map(c => `tags.cs.{${c}}`).join(","));
      }
    }

    // Distance filter — bounding box on lat/lng, with same-zip safety net
    if (distance > 0) {
      // Resolve user coordinates: prefer explicit lat/lng, fall back to zip lookup
      let centerLat = userLat;
      let centerLng = userLng;
      if ((!centerLat || !centerLng) && userZip) {
        const coords = ZIP_COORDS[userZip];
        if (coords) { centerLat = coords[0]; centerLng = coords[1]; }
      }
      if (centerLat && centerLng) {
        // At ~41° latitude (Omaha): 1° lat ≈ 69 mi, 1° lng ≈ 52 mi
        // Use generous multiplier (1.2x) so the box is slightly larger than the circle
        const latDelta = (distance * 1.2) / 69;
        const lngDelta = (distance * 1.2) / 52;
        const latMin = centerLat - latDelta;
        const latMax = centerLat + latDelta;
        const lngMin = centerLng - lngDelta;
        const lngMax = centerLng + lngDelta;
        // Include businesses within the bounding box OR sharing the user's zip code
        // (same-zip safety net catches businesses with inaccurate GPS)
        const boxFilter = `and(latitude.gte.${latMin},latitude.lte.${latMax},longitude.gte.${lngMin},longitude.lte.${lngMax})`;
        if (userZip) {
          query = query.or(`${boxFilter},zip.eq.${userZip}`);
        } else {
          query = query
            .gte("latitude", latMin).lte("latitude", latMax)
            .gte("longitude", lngMin).lte("longitude", lngMax);
        }
      }
    }

    // Tag filters (Cuisine, Vibe, Amenities, Dietary, Popular, etc.)
    // Business must contain ALL selected tags
    if (tags.length > 0) {
      query = query.contains("tags", tags);
    }

    // Price filter
    if (price && price !== "Any") {
      query = query.filter("config->>priceLevel", "eq", price);
    }

    // Followed-only filter
    if (followed && userId) {
      const { data: followedBiz } = await supabaseServer
        .from("user_followed_businesses")
        .select("business_id")
        .eq("user_id", userId);
      const followedIds = (followedBiz ?? []).map(f => f.business_id);
      if (followedIds.length > 0) {
        query = query.in("id", followedIds);
      } else {
        return NextResponse.json({ businesses: [], media: [], tiers: [], total: 0, page, hasMore: false });
      }
    }

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.order("created_at", { ascending: false }).range(from, to);

    const { data: bizRows, error: bizErr, count } = await query;

    if (bizErr) {
      console.error("[discover] Business query error:", bizErr);
      return NextResponse.json({ error: bizErr.message }, { status: 500 });
    }

    const rawRows = bizRows ?? [];
    const total = count ?? 0;

    if (rawRows.length === 0) {
      return NextResponse.json({ businesses: rawRows, media: [], tiers: [], total, page, hasMore: false });
    }

    // --- Chain deduplication: one card per chain, keep first occurrence ---
    // For each chain_id group, we keep one representative business and annotate it
    // with chain metadata so the frontend can show "X more locations near you"
    const seenChains = new Set<string>();
    const chainLocationCounts: Record<string, number> = {};
    const chainBrandNames: Record<string, string> = {};

    // First pass: count locations per chain in this result set
    for (const r of rawRows) {
      const row = r as Record<string, unknown>;
      const cid = row.chain_id as string | null;
      if (cid) {
        chainLocationCounts[cid] = (chainLocationCounts[cid] || 0) + 1;
      }
    }

    // If any chains found, fetch full location counts from DB
    const chainIds = Object.keys(chainLocationCounts);
    if (chainIds.length > 0) {
      const { data: chainData } = await supabaseServer
        .from("chains")
        .select("id, brand_name, location_count")
        .in("id", chainIds);
      for (const c of chainData || []) {
        chainLocationCounts[c.id] = c.location_count;
        chainBrandNames[c.id] = c.brand_name;
      }
    }

    // Second pass: deduplicate — keep first business per chain, skip rest
    const rows: Record<string, unknown>[] = [];
    for (const r of rawRows) {
      const row = r as Record<string, unknown>;
      const cid = row.chain_id as string | null;
      if (cid) {
        if (seenChains.has(cid)) continue; // skip duplicate chain locations
        seenChains.add(cid);
        // Annotate with chain info for frontend
        (row as Record<string, unknown>).chain_brand_name = chainBrandNames[cid] || null;
        (row as Record<string, unknown>).chain_location_count = chainLocationCounts[cid] || 1;
      }
      rows.push(row);
    }

    // Fetch media + tiers for this page's businesses
    const bizIds = rows.map((r: Record<string, unknown>) => r.id as string);
    const [{ data: mediaRows }, { data: tierRows }] = await Promise.all([
      supabaseServer
        .from("business_media")
        .select("business_id, bucket, path, sort_order, caption, meta")
        .in("business_id", bizIds)
        .eq("is_active", true)
        .eq("media_type", "photo")
        .order("sort_order", { ascending: true })
        .limit(500),
      supabaseServer
        .from("business_payout_tiers")
        .select("business_id, percent_bps, tier_index")
        .in("business_id", bizIds)
        .order("tier_index", { ascending: true })
        .limit(500),
    ]);

    // Fetch sponsored campaigns
    const today = new Date().toISOString().split("T")[0];
    const { data: campaigns } = await supabaseServer
      .from("business_ad_campaigns")
      .select("business_id, price_cents")
      .in("status", ["active", "purchased", "scheduled"])
      .lte("start_date", today)
      .gte("end_date", today)
      .order("price_cents", { ascending: false });

    const sponsoredIds = [...new Set((campaigns ?? []).map(c => c.business_id).filter(Boolean))];

    return NextResponse.json({
      businesses: rows,
      media: mediaRows ?? [],
      tiers: tierRows ?? [],
      sponsoredIds,
      total,
      page,
      hasMore: from + rows.length < total,
    });
  } catch (err) {
    console.error("[discover] Unexpected error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
