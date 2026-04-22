import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  type BusinessRow,
  getBusinessGradient,
  getBusinessEmoji,
  formatBusinessType,
  resolveHoursFromColumns,
  isBusinessOpenNow,
  getCentralTime,
  buildMediaUrl,
} from "@/lib/businessNormalize";
import { getDistanceBetweenZips, haversineDistance, ZIP_COORDS } from "@/lib/zipUtils";

// ── Types ──────────────────────────────────────────────────

type GenerateRequest = {
  vibes: string[];
  budget: string;
  cuisines: string[];
  location: string;
  timeSlot: "afternoon" | "evening" | "latenight";
  exclude: string[];
  userLat?: number;
  userLng?: number;
};

type ScoredBusiness = {
  row: BusinessRow;
  score: number;
  reasons: string[];
  images: string[];
};

type PickResult = {
  id: string;
  name: string;
  type: string;
  vibe: string;
  price: string;
  address: string;
  neighborhood: string;
  phone: string;
  website: string;
  hours: string;
  emoji: string;
  gradient: string;
  images: string[];
  highlights: string[];
  score: number;
  reasoning: string;
  tags: string[];
};

// ── Constants ──────────────────────────────────────────────

const RESTAURANT_TYPES = new Set([
  "restaurant_bar", "restaurant", "bar", "cafe", "coffee", "grill",
  "diner", "bakery", "brewery", "winery", "steakhouse", "pizzeria",
  "bistro", "pub", "tavern",
]);


const MAX_RECENT_RESULTS = 30;
const LOCATION_RADIUS_MILES = 20;

// ── Helpers ────────────────────────────────────────────────

function isRestaurantType(businessType: string, categoryMain: string, tags: string[]): boolean {
  const bt = businessType.toLowerCase();
  const cm = categoryMain.toLowerCase();
  if (RESTAURANT_TYPES.has(bt) || RESTAURANT_TYPES.has(cm)) return true;
  // If there's an explicit business type that isn't a restaurant, trust it —
  // don't let secondary food/bar tags override the primary classification
  if (bt) return false;
  // Only fall back to tag matching when business type is unknown/empty
  const restaurantTags = new Set(["restaurant", "dining", "cafe", "bar", "grill", "diner", "bakery", "brewery", "pub"]);
  return tags.some(t => restaurantTags.has(t.toLowerCase()));
}


function matchesLocation(row: BusinessRow, location: string, userLat?: number, userLng?: number): boolean {
  // Best case: use actual GPS coordinates from browser
  if (userLat && userLng && row.latitude != null && row.longitude != null) {
    return haversineDistance(userLat, userLng, row.latitude, row.longitude) <= LOCATION_RADIUS_MILES;
  }

  if (!location) return true;
  const loc = location.trim().toLowerCase();

  // Check zip code match or proximity
  if (/^\d{5}$/.test(loc)) {
    // Exact zip match
    if (row.zip === loc) return true;

    // Try GPS coordinates with zip centroid
    const fromCoords = ZIP_COORDS[loc];
    if (fromCoords && row.latitude != null && row.longitude != null) {
      return haversineDistance(fromCoords[0], fromCoords[1], row.latitude, row.longitude) <= LOCATION_RADIUS_MILES;
    }

    // Fall back to zip-to-zip lookup
    if (row.zip) {
      const dist = getDistanceBetweenZips(loc, row.zip);
      if (dist !== null) return dist <= LOCATION_RADIUS_MILES;
    }

    // Unknown distance — fall through to city/state check
  }

  // City/state match
  const cityState = `${row.city || ""} ${row.state || ""}`.toLowerCase();
  return cityState.includes(loc) || loc.includes((row.city || "").toLowerCase());
}

function getRowTags(row: BusinessRow): string[] {
  // Prefer standalone tags column, fallback to config.tags
  if (Array.isArray(row.tags) && row.tags.length > 0) {
    return row.tags.map(t => String(t).toLowerCase());
  }
  const cfg = row.config;
  if (!cfg) return [];
  return Array.isArray(cfg.tags) ? (cfg.tags as string[]).map(t => String(t).toLowerCase()) : [];
}

function getRowVibe(row: BusinessRow): string {
  // Prefer config.vibe (no standalone column for vibe), fallback to description
  const cfg = row.config;
  const vibe = String(cfg?.vibe ?? "").toLowerCase();
  return vibe || String(row.description ?? "").toLowerCase().slice(0, 100);
}

function getRowBusinessType(row: BusinessRow): string {
  // 1. config.businessType (user-provided during onboarding, most accurate)
  const cfg = row.config;
  const cfgType = String(cfg?.businessType ?? "").toLowerCase();
  if (cfgType) return cfgType;
  // 2. business_type column (now actively maintained via admin/business profile)
  //    Skip the bulk-default "restaurant_bar" — may be unreliable for businesses
  //    that were never explicitly categorized
  const bt = (row.business_type ?? "").toLowerCase();
  if (bt && bt !== "restaurant_bar") return bt;
  // 3. Fall back to category_main
  return bt || (row.category_main ?? "").toLowerCase();
}

function getRowPriceLevel(row: BusinessRow): string {
  const cfg = row.config;
  return String(cfg?.priceLevel ?? "$$");
}

function buildHighlights(row: BusinessRow): string[] {
  const highlights: string[] = [];
  const vibe = getRowVibe(row);
  if (vibe) highlights.push(vibe.charAt(0).toUpperCase() + vibe.slice(1));
  const tags = getRowTags(row);
  const interestingTags = tags.filter(t =>
    !["restaurant", "bar", "food", "dining", "activity"].includes(t)
  ).slice(0, 3);
  highlights.push(...interestingTags.map(t => t.charAt(0).toUpperCase() + t.slice(1)));
  return highlights.slice(0, 4);
}

function formatPhoneNumber(raw: string): string {
  // Strip everything except digits
  const digits = raw.replace(/\D/g, "");
  // Handle US numbers: 10 digits or 11 with leading 1
  if (digits.length === 11 && digits.startsWith("1")) {
    const area = digits.slice(1, 4);
    const prefix = digits.slice(4, 7);
    const line = digits.slice(7, 11);
    return `(${area}) ${prefix}-${line}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }
  // If we can't format it, return cleaned digits or empty
  return digits.length >= 7 ? digits : "";
}

function buildPickResult(row: BusinessRow, score: number, reasons: string[], images: string[]): PickResult {
  const cfg = row.config ?? {};
  const name = row.public_business_name || row.business_name || "Unknown";
  const rawType = getRowBusinessType(row) || "restaurant";
  const type = formatBusinessType(rawType);
  const vibe = getRowVibe(row);
  const price = getRowPriceLevel(row);
  const street = row.street_address || "";
  const cityStateZip = [row.city, row.state, row.zip].filter(Boolean).join(", ");
  const address = [street, cityStateZip].filter(Boolean).join(", ");
  const rawPhone = row.contact_phone || String(cfg.phone ?? "");
  const phone = formatPhoneNumber(rawPhone);
  const website = row.website || String(cfg.website ?? "");
  // Build hours from individual day columns (single source of truth)
  const hours = resolveHoursFromColumns(row as Record<string, unknown>);
  // Use business day in Central time (before 4 AM = still yesterday)
  const dayFullNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const ct = getCentralTime();
  const bizDayIdx = ct.hour < 4 ? (ct.dayOfWeek + 6) % 7 : ct.dayOfWeek;
  const todayHours = hours[dayFullNames[bizDayIdx]] || "Hours vary";
  const tags = getRowTags(row);
  const emoji = getBusinessEmoji(rawType);
  const gradient = getBusinessGradient(row.id);
  const highlights = buildHighlights(row);

  return {
    id: row.id,
    name,
    type,
    vibe,
    price,
    address,
    neighborhood: row.city || "",
    phone,
    website,
    hours: todayHours,
    emoji,
    gradient,
    images,
    highlights,
    score,
    reasoning: reasons.join(". ") + ".",
    tags,
  };
}

// ── Main Handler ───────────────────────────────────────────

export async function POST(req: NextRequest): Promise<Response> {
  try {
    // Auth
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    let userId: string | null = null;

    if (token) {
      const { data: { user }, error: authError } = await supabaseServer.auth.getUser(token);
      if (!authError && user) userId = user.id;
    }

    const body = await req.json() as GenerateRequest;
    const { vibes = [], budget = "$$", cuisines = [], location: bodyLocation = "", timeSlot = "evening", exclude = [], userLat, userLng } = body;

    // Fall back to user's profile zip code when no location provided
    let location = bodyLocation;
    if (!location && userId) {
      const { data: profile } = await supabaseServer
        .from("profiles")
        .select("zip_code")
        .eq("id", userId)
        .maybeSingle();
      if (profile?.zip_code) location = profile.zip_code;
    }

    // 1. Query all active businesses
    const { data: businessRows, error: bizError } = await supabaseServer
      .from("business")
      .select(
        "id, business_name, public_business_name, contact_phone, website, " +
        "street_address, city, state, zip, latitude, longitude, category_main, business_type, " +
        "config, blurb, payout_tiers, payout_preset, is_active, tags, description, " +
        "mon_open, mon_close, tue_open, tue_close, wed_open, wed_close, " +
        "thu_open, thu_close, fri_open, fri_close, sat_open, sat_close, sun_open, sun_close"
      )
      .eq("is_active", true);

    if (bizError) {
      console.error("[datenight/generate] Business query error:", bizError);
      return NextResponse.json({ error: "Failed to query businesses" }, { status: 500 });
    }

    if (!businessRows || businessRows.length === 0) {
      return NextResponse.json({
        error: "No active businesses found",
        restaurant: null,
        activity: null,
      }, { status: 200 });
    }

    // 2. Get recent results for this user (last 30) to avoid repeats
    let recentRestaurantIds = new Set<string>();
    let recentActivityIds = new Set<string>();
    if (userId) {
      const { data: recentSessions } = await supabaseServer
        .from("date_night_sessions")
        .select("restaurant_id, activity_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(MAX_RECENT_RESULTS);

      for (const s of recentSessions ?? []) {
        if (s.restaurant_id) recentRestaurantIds.add(s.restaurant_id);
        if (s.activity_id) recentActivityIds.add(s.activity_id);
      }
    }

    // 3. Combine exclude list with recent results
    const excludeSet = new Set(exclude);

    // 4. Filter businesses by location and currently open
    const allBusinesses = (businessRows as unknown as BusinessRow[]).filter(row => {
      if (!matchesLocation(row, location, userLat, userLng)) return false;
      if (!isBusinessOpenNow(row as Record<string, unknown>)) return false;
      return true;
    });

    // 5. Separate restaurants vs activities
    const restaurants: BusinessRow[] = [];
    const activities: BusinessRow[] = [];

    for (const row of allBusinesses) {
      const bt = getRowBusinessType(row);
      const cm = row.category_main || "";
      const tags = getRowTags(row);

      if (isRestaurantType(bt, cm, tags)) {
        if (!excludeSet.has(row.id)) restaurants.push(row);
      } else {
        if (!excludeSet.has(row.id)) activities.push(row);
      }
    }

    // 6. Query user signals (only if authenticated)
    let visitedBizIds = new Set<string>();
    let gamePickBizIds = new Set<string>();
    let groupVoteBizIds = new Set<string>();
    let followedBizIds = new Set<string>();
    let rerolledBizIds = new Set<string>();

    if (userId) {
      const [receiptsResult, gamesResult, groupVotesResult, followsResult, rerollsResult] =
        await Promise.all([
          // Receipts — visited businesses
          supabaseServer
            .from("receipts")
            .select("business_id")
            .eq("user_id", userId)
            .eq("status", "approved")
            .gte("visit_date", new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]),

          // 5v3v1 game picks
          supabaseServer
            .from("game_sessions")
            .select("pick5_ids, pick3_ids, pick1_id, winner_business_id")
            .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
            .eq("status", "complete"),

          // Group vote picks
          supabaseServer
            .from("group_game_votes")
            .select("business_id")
            .eq("voter_id", userId),

          // Followed businesses (only true followers, not just saved)
          supabaseServer
            .from("user_followed_businesses")
            .select("business_id")
            .eq("user_id", userId)
            .eq("is_following", true),

          // Re-rolled businesses from past date nights
          supabaseServer
            .from("date_night_sessions")
            .select("excluded_ids")
            .eq("user_id", userId)
            .eq("status", "re-rolled"),
        ]);

      // Process receipts
      for (const r of receiptsResult.data ?? []) {
        if (r.business_id) visitedBizIds.add(r.business_id);
      }

      // Process game picks — flatten all arrays
      for (const g of gamesResult.data ?? []) {
        const ids: string[] = [
          ...(Array.isArray(g.pick5_ids) ? g.pick5_ids : []),
          ...(Array.isArray(g.pick3_ids) ? g.pick3_ids : []),
          ...(g.pick1_id ? [g.pick1_id] : []),
          ...(g.winner_business_id ? [g.winner_business_id] : []),
        ];
        for (const id of ids) gamePickBizIds.add(String(id));
      }

      // Process group votes
      for (const v of groupVotesResult.data ?? []) {
        if (v.business_id) groupVoteBizIds.add(String(v.business_id));
      }

      // Process follows
      for (const f of followsResult.data ?? []) {
        if (f.business_id) followedBizIds.add(String(f.business_id));
      }

      // Process re-rolls
      for (const s of rerollsResult.data ?? []) {
        const ids = s.excluded_ids as string[] | null;
        if (ids) for (const id of ids) rerolledBizIds.add(id);
      }
    }

    // 7. Fetch media for all candidate businesses
    const allCandidateIds = [...restaurants, ...activities].map(r => r.id);
    let mediaMap = new Map<string, string[]>();
    if (allCandidateIds.length > 0) {
      const { data: mediaRows } = await supabaseServer
        .from("business_media")
        .select("business_id, bucket, path, sort_order")
        .in("business_id", allCandidateIds)
        .eq("is_active", true)
        .eq("media_type", "photo")
        .order("sort_order", { ascending: true });

      for (const m of mediaRows ?? []) {
        const bizId = m.business_id as string;
        const url = buildMediaUrl(m.bucket as string, m.path as string);
        const existing = mediaMap.get(bizId) || [];
        existing.push(url);
        mediaMap.set(bizId, existing);
      }
    }

    // 8. Score restaurants
    const vibesLower = vibes.map(v => v.toLowerCase());
    const cuisinesLower = cuisines.map(c => c.toLowerCase());
    const budgetStr = budget;

    function scoreBase(row: BusinessRow): { score: number; reasons: string[] } {
      let score = 0;
      const reasons: string[] = [];
      const tags = getRowTags(row);
      const vibe = getRowVibe(row);
      const price = getRowPriceLevel(row);

      // Vibe match (+3 each)
      for (const v of vibesLower) {
        if (vibe.includes(v) || tags.some(t => t.includes(v))) {
          score += 3;
          reasons.push(`Matches your ${v} vibe`);
        }
      }

      // Cuisine match (+3)
      for (const c of cuisinesLower) {
        if (tags.some(t => t.includes(c)) || (row.category_main || "").toLowerCase().includes(c)) {
          score += 3;
          reasons.push(`Matches ${c} cuisine`);
          break; // Only count once
        }
      }

      // Budget match (+2)
      if (price === budgetStr) {
        score += 2;
        reasons.push(`Fits your ${budgetStr} budget`);
      } else if (
        // Within 1 level is still okay (+1)
        Math.abs(price.length - budgetStr.length) === 1
      ) {
        score += 1;
        reasons.push("Close to your budget range");
      }

      // User visited (+5)
      if (visitedBizIds.has(row.id)) {
        score += 5;
        reasons.push("You've been here before and loved it");
      }

      // 5v3v1 picks (+3)
      if (gamePickBizIds.has(row.id)) {
        score += 3;
        reasons.push("You picked this in a 5v3v1 game");
      }

      // Group vote (+3)
      if (groupVoteBizIds.has(row.id)) {
        score += 3;
        reasons.push("You voted for this in Group Vote");
      }

      // Following (+2)
      if (followedBizIds.has(row.id)) {
        score += 2;
        reasons.push("A business you follow");
      }

      // Re-rolled penalty (-3)
      if (rerolledBizIds.has(row.id)) {
        score -= 3;
        reasons.push("Previously re-rolled");
      }

      // Random tiebreaker for variety
      score += Math.random();

      return { score, reasons };
    }

    const scoredRestaurants: ScoredBusiness[] = restaurants
      .filter(r => !recentRestaurantIds.has(r.id)) // Skip last 30
      .map(row => {
        const { score, reasons } = scoreBase(row);
        return { row, score, reasons, images: mediaMap.get(row.id) || [] };
      })
      .sort((a, b) => b.score - a.score);

    // If all restaurants were filtered by the 30-cycle rule, fall back to all
    const finalRestaurants = scoredRestaurants.length > 0
      ? scoredRestaurants
      : restaurants.map(row => {
          const { score, reasons } = scoreBase(row);
          return { row, score, reasons, images: mediaMap.get(row.id) || [] };
        }).sort((a, b) => b.score - a.score);

    if (finalRestaurants.length === 0) {
      return NextResponse.json({
        error: "No restaurants found matching your preferences",
        hint: "Try a different location or broader filters",
        restaurant: null,
        activity: null,
      }, { status: 200 });
    }

    const topRestaurant = finalRestaurants[0];

    // 9. Score activities with restaurant compatibility bonuses
    const restaurantTags = getRowTags(topRestaurant.row);
    const restaurantVibe = getRowVibe(topRestaurant.row);
    const restaurantCity = (topRestaurant.row.city || "").toLowerCase();
    const restaurantZip = topRestaurant.row.zip || "";
    const restaurantCategory = (topRestaurant.row.category_main || "").toLowerCase();

    const scoredActivities: ScoredBusiness[] = activities
      .filter(a => !recentActivityIds.has(a.id)) // Skip last 30
      .map(row => {
        const { score: baseScore, reasons } = scoreBase(row);
        let score = baseScore;
        const tags = getRowTags(row);
        const vibe = getRowVibe(row);

        // Vibe-compatible with restaurant (+3)
        if (restaurantVibe && (vibe.includes(restaurantVibe) ||
            tags.some(t => restaurantTags.some(rt => t.includes(rt) || rt.includes(t))))) {
          score += 3;
          reasons.push("Vibe-compatible with your restaurant");
        }

        // Same city/zip (+2)
        const actCity = (row.city || "").toLowerCase();
        if ((actCity && actCity === restaurantCity) || (row.zip && row.zip === restaurantZip)) {
          score += 2;
          reasons.push("Same area as your restaurant");
        }

        // Different category for variety (+1)
        if ((row.category_main || "").toLowerCase() !== restaurantCategory) {
          score += 1;
          reasons.push("Different category for variety");
        }

        return { row, score, reasons, images: mediaMap.get(row.id) || [] };
      })
      .sort((a, b) => b.score - a.score);

    // Fallback if 30-cycle rule filtered everything
    const finalActivities = scoredActivities.length > 0
      ? scoredActivities
      : activities.map(row => {
          const { score, reasons } = scoreBase(row);
          return { row, score, reasons, images: mediaMap.get(row.id) || [] };
        }).sort((a, b) => b.score - a.score);

    const topActivity = finalActivities.length > 0 ? finalActivities[0] : null;

    // 10. Build response
    const restaurantResult = buildPickResult(
      topRestaurant.row, Math.floor(topRestaurant.score), topRestaurant.reasons, topRestaurant.images
    );
    const activityResult = topActivity
      ? buildPickResult(topActivity.row, Math.floor(topActivity.score), topActivity.reasons, topActivity.images)
      : null;

    // 11. Save session to database
    let sessionId: string | null = null;
    if (userId) {
      const { data: session, error: sessionError } = await supabaseServer
        .from("date_night_sessions")
        .insert({
          user_id: userId,
          session_vibes: vibes,
          session_budget: budget,
          session_cuisines: cuisines,
          session_location: location,
          session_time_slot: timeSlot,
          restaurant_id: restaurantResult.id,
          activity_id: activityResult?.id || null,
          restaurant_score: restaurantResult.score,
          activity_score: activityResult?.score || 0,
          status: "generated",
          reasoning: {
            restaurant: restaurantResult.reasoning,
            activity: activityResult?.reasoning || "",
          },
          excluded_ids: exclude,
        })
        .select("id")
        .single();

      if (sessionError) {
        console.error("[datenight/generate] Session insert error:", sessionError);
      } else {
        sessionId = session?.id || null;
      }
    }

    return NextResponse.json({
      restaurant: restaurantResult,
      activity: activityResult,
      sessionId,
    });
  } catch (err) {
    console.error("[datenight/generate] Unexpected error:", err);
    return NextResponse.json(
      { error: "Unexpected error", details: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
