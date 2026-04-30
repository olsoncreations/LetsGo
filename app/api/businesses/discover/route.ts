import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { ZIP_COORDS, haversineDistance } from "@/lib/zipUtils";

/**
 * GET /api/businesses/discover
 * Paginated business discovery endpoint for the swipe feed.
 *
 * Order of operations: filter → identify Spotlights → pin Spotlights → sort the
 * rest (random by default, or as requested) → paginate. This guarantees random
 * ordering is stable across page boundaries within a session (via the `seed`
 * param) and Spotlights never duplicate to later pages.
 *
 * Scale assumption: pulls all matching businesses into memory before paginating.
 * Fine for Omaha-scale (hundreds). At ~10k+ matching results per query, switch
 * to Postgres-side seeded ordering (e.g. ORDER BY md5(id || seed)).
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
 *   sort     - "Nearest" | "Newest" | "Highest Payout" | "" (empty = random)
 *   seed     - session seed for stable random ordering across pages
 *   topType  - comma-separated: eat | drink | play | pamper. Filters to businesses
 *              whose tags array contains at least one Business Type tag with the
 *              matching top_type (OR semantics across selected types).
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
    const sort = sp.get("sort") || "";
    const seed = sp.get("seed") || "";
    const topTypes = sp.get("topType")?.split(",").map(s => s.trim()).filter(Boolean) || [];

    // Resolve user coordinates once: prefer explicit lat/lng, fall back to zip lookup
    let centerLat = userLat || 0;
    let centerLng = userLng || 0;
    if ((!centerLat || !centerLng) && userZip) {
      const coords = ZIP_COORDS[userZip];
      if (coords) { centerLat = coords[0]; centerLng = coords[1]; }
    }

    // Build the business query (no SQL pagination — we sort + paginate in memory below).
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
      `)
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
    if (distance > 0 && centerLat && centerLng) {
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

    // Tag filters (Cuisine, Dietary, Extras, etc.)
    // Business must contain ALL selected tags
    if (tags.length > 0) {
      query = query.contains("tags", tags);
    }

    // Top Type filter (Eat / Drink / Play / Pamper). Resolves the selected types
    // to the set of Business Type tag NAMES with matching top_type, then filters
    // businesses whose `tags` array contains at least one of those names.
    if (topTypes.length > 0) {
      const validTypes = topTypes.filter(t => ["eat", "drink", "play", "pamper"].includes(t));
      if (validTypes.length > 0) {
        const { data: typeTagRows } = await supabaseServer
          .from("tags")
          .select("name")
          .in("top_type", validTypes)
          .eq("is_active", true);
        const typeTagNames = (typeTagRows ?? []).map(r => r.name as string);
        if (typeTagNames.length === 0) {
          // Selected a top type that has no tags configured → empty result set
          return NextResponse.json({ businesses: [], media: [], tiers: [], sponsoredIds: [], total: 0, page, hasMore: false });
        }
        // OR semantics across the matching tag names: business needs to have at least one
        const orClause = typeTagNames.map(n => `tags.cs.{"${n.replace(/"/g, '\\"')}"}`).join(",");
        query = query.or(orClause);
      }
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
        return NextResponse.json({ businesses: [], media: [], tiers: [], sponsoredIds: [], total: 0, page, hasMore: false });
      }
    }

    // Fetch ALL matching businesses — sort + paginate in memory below.
    const { data: bizRows, error: bizErr } = await query;

    if (bizErr) {
      console.error("[discover] Business query error:", bizErr);
      return NextResponse.json({ error: bizErr.message }, { status: 500 });
    }

    const rawRows = bizRows ?? [];

    if (rawRows.length === 0) {
      return NextResponse.json({ businesses: rawRows, media: [], tiers: [], sponsoredIds: [], total: 0, page, hasMore: false });
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
    const dedupedRows: Record<string, unknown>[] = [];
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
      dedupedRows.push(row);
    }

    // --- Identify currently-active Spotlight (sponsored) campaigns ---
    // Order by price tier desc (higher-paying tiers pin above lower), then by
    // start_date desc (most recent buyer first) as the within-tier tiebreaker.
    const today = new Date().toISOString().split("T")[0];
    const { data: campaigns } = await supabaseServer
      .from("business_ad_campaigns")
      .select("business_id, price_cents, start_date")
      .in("status", ["active", "purchased", "scheduled"])
      .lte("start_date", today)
      .gte("end_date", today)
      .order("price_cents", { ascending: false })
      .order("start_date", { ascending: false });

    // Preserve campaign order; only include Spotlights that survived filter + chain-dedup
    const dedupedIds = new Set(dedupedRows.map(r => r.id as string));
    const sponsoredOrderedIds: string[] = [];
    const sponsoredSet = new Set<string>();
    for (const c of campaigns ?? []) {
      const bid = c.business_id as string | null;
      if (!bid || sponsoredSet.has(bid) || !dedupedIds.has(bid)) continue;
      sponsoredSet.add(bid);
      sponsoredOrderedIds.push(bid);
    }

    // Split into sponsored (in tier+date order) and the rest (pre-sort)
    const rowById = new Map<string, Record<string, unknown>>();
    for (const r of dedupedRows) rowById.set(r.id as string, r);
    const sponsoredRows = sponsoredOrderedIds
      .map(id => rowById.get(id))
      .filter((r): r is Record<string, unknown> => !!r);
    const restRows = dedupedRows.filter(r => !sponsoredSet.has(r.id as string));

    // --- Sort the non-Spotlight rest ---
    let sortedRest: Record<string, unknown>[];
    if (sort === "Highest Payout") {
      // Need max payout tier per business — fetch tiers for the full filtered set.
      const restIds = restRows.map(r => r.id as string);
      const maxBpsByBiz = new Map<string, number>();
      if (restIds.length > 0) {
        const { data: allTiers } = await supabaseServer
          .from("business_payout_tiers")
          .select("business_id, percent_bps")
          .in("business_id", restIds);
        for (const t of allTiers ?? []) {
          const bid = t.business_id as string;
          const bps = Number(t.percent_bps) || 0;
          const cur = maxBpsByBiz.get(bid) ?? 0;
          if (bps > cur) maxBpsByBiz.set(bid, bps);
        }
      }
      sortedRest = [...restRows].sort((a, b) => {
        const am = maxBpsByBiz.get(a.id as string) ?? 0;
        const bm = maxBpsByBiz.get(b.id as string) ?? 0;
        return bm - am;
      });
    } else if (sort === "Newest") {
      sortedRest = [...restRows].sort((a, b) => {
        const ad = String(a.seeded_at || a.created_at || "");
        const bd = String(b.seeded_at || b.created_at || "");
        return bd.localeCompare(ad);
      });
    } else if (sort === "Nearest" && centerLat && centerLng) {
      sortedRest = [...restRows].sort((a, b) => {
        const ad = computeDistance(a, centerLat, centerLng);
        const bd = computeDistance(b, centerLat, centerLng);
        return ad - bd;
      });
    } else {
      // Default: random with session seed (stable across pages, fresh per session)
      sortedRest = seededShuffle(restRows, seed);
    }

    // Combine: Spotlights pinned first, then sorted rest
    const fullList = [...sponsoredRows, ...sortedRest];
    const total = fullList.length;

    // Paginate post-sort
    const from = (page - 1) * limit;
    const pageRows = fullList.slice(from, from + limit);

    if (pageRows.length === 0) {
      return NextResponse.json({
        businesses: [],
        media: [],
        tiers: [],
        sponsoredIds: sponsoredOrderedIds,
        total,
        page,
        hasMore: false,
      });
    }

    // Fetch media + tiers only for this page's businesses
    const pageBizIds = pageRows.map(r => r.id as string);
    const [{ data: mediaRows }, { data: tierRows }] = await Promise.all([
      supabaseServer
        .from("business_media")
        .select("business_id, bucket, path, sort_order, caption, meta")
        .in("business_id", pageBizIds)
        .eq("is_active", true)
        .eq("media_type", "photo")
        .order("sort_order", { ascending: true })
        .limit(500),
      supabaseServer
        .from("business_payout_tiers")
        .select("business_id, percent_bps, tier_index")
        .in("business_id", pageBizIds)
        .order("tier_index", { ascending: true })
        .limit(500),
    ]);

    return NextResponse.json({
      businesses: pageRows,
      media: mediaRows ?? [],
      tiers: tierRows ?? [],
      sponsoredIds: sponsoredOrderedIds,
      total,
      page,
      hasMore: from + pageRows.length < total,
    });
  } catch (err) {
    console.error("[discover] Unexpected error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function computeDistance(row: Record<string, unknown>, centerLat: number, centerLng: number): number {
  const lat = row.latitude as number | null;
  const lng = row.longitude as number | null;
  if (lat == null || lng == null) return Number.POSITIVE_INFINITY;
  return haversineDistance(centerLat, centerLng, lat, lng);
}

/**
 * Deterministic Fisher-Yates shuffle keyed on a string seed. Same seed + same
 * input array length always yields the same ordering, so pagination is stable
 * within a session. Empty seed falls back to a random per-call seed so legacy
 * callers without seed support still get a shuffled feed (better than the
 * deterministic created_at order this used to return).
 */
function seededShuffle<T>(arr: T[], seed: string): T[] {
  if (arr.length <= 1) return [...arr];
  const effectiveSeed = seed || Math.random().toString(36).slice(2);

  // FNV-1a hash → 32-bit numeric seed
  let h = 2166136261;
  for (let i = 0; i < effectiveSeed.length; i++) {
    h ^= effectiveSeed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }

  // mulberry32 PRNG
  let s = h >>> 0;
  const random = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
