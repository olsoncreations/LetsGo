import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  formatBusinessType,
  resolveHoursFromColumns,
  computeOpenStatus,
} from "@/lib/businessNormalize";

// ─── Types ───

type MediaRow = {
  id: string;
  created_at: string;
  business_id: string;
  user_id: string;
  storage_path: string;
  media_type: "image" | "video";
  caption: string | null;
  tags: string[] | null;
};

type BizRow = {
  id: string;
  business_name: string | null;
  public_business_name: string | null;
  category_main: string | null;
  config: Record<string, unknown> | null;
  is_active: boolean | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type LikeCount = { experience_id: string; count: number };
type CommentCount = { experience_id: string; count: number };

// ─── Helpers ───

function getDisplayName(p: ProfileRow): string {
  if (p.full_name) return p.full_name;
  const parts = [p.first_name, p.last_name].filter(Boolean);
  if (parts.length) return parts.join(" ");
  return p.username || "User";
}

function getPriceLevel(config: Record<string, unknown> | null): string {
  const p = String(config?.priceLevel ?? "");
  return ["$", "$$", "$$$", "$$$$"].includes(p) ? p : "$$";
}

/**
 * Extract a user ID from the Authorization header (Bearer token).
 * Returns null if no valid token.
 */
async function extractUserId(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const { data } = await supabaseServer.auth.getUser(token);
  return data.user?.id ?? null;
}

// ═══════════════════════════════════════════════════
// GET /api/experiences — public feed
// ═══════════════════════════════════════════════════

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const params = req.nextUrl.searchParams;
    const cursor = params.get("cursor"); // ISO timestamp
    const limit = Math.min(Math.max(Number(params.get("limit")) || 20, 1), 50);
    const tab = params.get("tab") || "foryou";
    const bizId = params.get("bizId"); // optional: filter by business

    const currentUserId = await extractUserId(req);

    // ── 1) Fetch approved media rows ──
    let mediaQuery = supabaseServer
      .from("user_experience_media")
      .select(
        "id, created_at, business_id, user_id, storage_path, media_type, caption, tags"
      )
      .eq("status", "approved")
      .eq("is_active", true)
      .limit(limit + 1); // extra row to detect "has more"

    // Filter by specific business if requested
    if (bizId) {
      mediaQuery = mediaQuery.eq("business_id", bizId);
    }

    if (tab === "following") {
      // Following: only posts from businesses the user follows
      if (!currentUserId) {
        return NextResponse.json({ posts: [], nextCursor: null, hint: "login_required" });
      }
      const { data: followRows } = await supabaseServer
        .from("user_followed_businesses")
        .select("business_id")
        .eq("user_id", currentUserId);
      const followedBizIds = (followRows ?? []).map((r) => String(r.business_id));
      if (followedBizIds.length === 0) {
        return NextResponse.json({ posts: [], nextCursor: null, hint: "no_follows" });
      }
      mediaQuery = mediaQuery.in("business_id", followedBizIds);
      if (cursor) {
        mediaQuery = mediaQuery.lt("created_at", cursor);
      }
      mediaQuery = mediaQuery.order("created_at", { ascending: false });
    } else if (tab === "trending") {
      // Trending: recent 7 days only, will sort by like count below
      const sevenDaysAgo = new Date(
        Date.now() - 7 * 24 * 60 * 60 * 1000
      ).toISOString();
      mediaQuery = mediaQuery.gte("created_at", sevenDaysAgo);
      if (cursor) {
        mediaQuery = mediaQuery.lt("created_at", cursor);
      }
      mediaQuery = mediaQuery.order("created_at", { ascending: false });
    } else {
      // For You: newest first, cursor-paginated
      if (cursor) {
        mediaQuery = mediaQuery.lt("created_at", cursor);
      }
      mediaQuery = mediaQuery.order("created_at", { ascending: false });
    }

    const { data: rawMedia, error: mediaErr } = await mediaQuery;
    if (mediaErr) {
      console.error("[experiences] GET media error:", mediaErr);
      return NextResponse.json(
        { error: mediaErr.message },
        { status: 500 }
      );
    }

    const mediaRows = (rawMedia ?? []) as MediaRow[];

    // Determine pagination
    const hasMore = mediaRows.length > limit;
    const sliced = hasMore ? mediaRows.slice(0, limit) : mediaRows;
    const nextCursor = hasMore
      ? sliced[sliced.length - 1].created_at
      : null;

    if (sliced.length === 0) {
      return NextResponse.json({ posts: [], nextCursor: null });
    }

    // Collect unique IDs for parallel lookups
    const postIds = sliced.map((m) => m.id);
    const bizIds = [...new Set(sliced.map((m) => m.business_id))];
    const userIds = [...new Set(sliced.map((m) => m.user_id))];

    // ── 2) Parallel fetches ──
    const [bizRes, profilesRes, likeCountsRes, commentCountsRes, userLikesRes, bizLifetimeLikesRes] =
      await Promise.all([
        // Businesses
        supabaseServer
          .from("business")
          .select(
            "id, business_name, public_business_name, category_main, config, is_active, " +
            "mon_open, mon_close, tue_open, tue_close, wed_open, wed_close, thu_open, thu_close, fri_open, fri_close, sat_open, sat_close, sun_open, sun_close"
          )
          .in("id", bizIds),

        // Profiles
        supabaseServer
          .from("profiles")
          .select("id, full_name, first_name, last_name, username, avatar_url")
          .in("id", userIds),

        // Like counts per post (aggregate via RPC or manual)
        supabaseServer
          .from("experience_likes")
          .select("experience_id")
          .in("experience_id", postIds),

        // Comment counts per post
        supabaseServer
          .from("experience_comments")
          .select("experience_id")
          .in("experience_id", postIds),

        // Current user's likes (if authenticated)
        currentUserId
          ? supabaseServer
              .from("experience_likes")
              .select("experience_id")
              .eq("user_id", currentUserId)
              .in("experience_id", postIds)
          : Promise.resolve({ data: [], error: null }),

        // All approved experience IDs for these businesses (for lifetime like counting)
        supabaseServer
          .from("user_experience_media")
          .select("id, business_id")
          .in("business_id", bizIds)
          .eq("status", "approved"),
      ]);

    // Build lookup maps
    const bizMap = new Map<string, BizRow>();
    for (const b of (bizRes.data ?? []) as unknown as BizRow[]) {
      bizMap.set(String(b.id), b);
    }

    const profileMap = new Map<string, ProfileRow>();
    for (const p of (profilesRes.data ?? []) as ProfileRow[]) {
      profileMap.set(String(p.id), p);
    }

    // Aggregate like counts
    const likeCountMap = new Map<string, number>();
    for (const row of (likeCountsRes.data ?? []) as { experience_id: string }[]) {
      likeCountMap.set(
        row.experience_id,
        (likeCountMap.get(row.experience_id) || 0) + 1
      );
    }

    // Aggregate comment counts
    const commentCountMap = new Map<string, number>();
    for (const row of (commentCountsRes.data ?? []) as {
      experience_id: string;
    }[]) {
      commentCountMap.set(
        row.experience_id,
        (commentCountMap.get(row.experience_id) || 0) + 1
      );
    }

    // User's liked post IDs
    const userLikedSet = new Set<string>();
    if (currentUserId) {
      for (const row of (userLikesRes.data ?? []) as {
        experience_id: string;
      }[]) {
        userLikedSet.add(row.experience_id);
      }
    }

    // Lifetime likes per business — step 1: map experience→business
    const allBizMedia = (bizLifetimeLikesRes.data ?? []) as { id: string; business_id: string }[];
    const expToBiz = new Map<string, string>();
    for (const row of allBizMedia) {
      expToBiz.set(row.id, row.business_id);
    }

    // Step 2: fetch all likes for those experiences and aggregate by business
    const allBizExpIds = allBizMedia.map((r) => r.id);
    const bizLifetimeLikesMap = new Map<string, number>();
    if (allBizExpIds.length > 0) {
      const { data: allBizLikes } = await supabaseServer
        .from("experience_likes")
        .select("experience_id")
        .in("experience_id", allBizExpIds);
      for (const like of (allBizLikes ?? []) as { experience_id: string }[]) {
        const bid = expToBiz.get(like.experience_id);
        if (bid) {
          bizLifetimeLikesMap.set(bid, (bizLifetimeLikesMap.get(bid) || 0) + 1);
        }
      }
    }

    // ── 3) Generate signed URLs + build posts ──
    const posts = await Promise.all(
      sliced.map(async (m) => {
        const biz = bizMap.get(m.business_id);
        const profile = profileMap.get(m.user_id);

        // Signed URL (24 hours — long enough for feed browsing sessions)
        const { data: signedData } = await supabaseServer.storage
          .from("user-experiences")
          .createSignedUrl(m.storage_path, 60 * 60 * 24);

        const hours = biz
          ? resolveHoursFromColumns(biz as Record<string, unknown>)
          : ({} as Record<string, string>);
        const { isOpen, closesAt } = computeOpenStatus(hours);

        return {
          id: m.id,
          createdAt: m.created_at,
          mediaType: m.media_type,
          mediaUrl: signedData?.signedUrl ?? "",
          caption: m.caption,
          tags: m.tags ?? [],
          user: {
            id: m.user_id,
            name: profile ? getDisplayName(profile) : "User",
            username: profile?.username ?? null,
            avatarUrl: profile?.avatar_url ?? null,
          },
          business: {
            id: m.business_id,
            name: biz
              ? biz.public_business_name || biz.business_name || "Business"
              : "Business",
            type: biz
              ? formatBusinessType(
                  String(
                    biz.config?.businessType ?? biz.category_main ?? "restaurant"
                  )
                )
              : "Restaurant",
            priceLevel: biz ? getPriceLevel(biz.config) : "$$",
            isOpen,
            closesAt,
            lifetimeLikes: bizLifetimeLikesMap.get(m.business_id) || 0,
          },
          likeCount: likeCountMap.get(m.id) || 0,
          commentCount: commentCountMap.get(m.id) || 0,
          hasLiked: userLikedSet.has(m.id),
        };
      })
    );

    // For trending tab, sort by like count descending
    if (tab === "trending") {
      posts.sort((a, b) => b.likeCount - a.likeCount);
    }

    return NextResponse.json({ posts, nextCursor });
  } catch (err) {
    console.error("[experiences] GET unexpected error:", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════
// POST /api/experiences — create a new experience
// ═══════════════════════════════════════════════════

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const currentUserId = await extractUserId(req);
    if (!currentUserId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { businessId, storagePath, mediaType, caption, tags } = body as {
      businessId: string;
      storagePath: string;
      mediaType: string;
      caption?: string;
      tags?: string[];
    };

    // Validate required fields
    if (!businessId || !storagePath || !mediaType) {
      return NextResponse.json(
        { error: "businessId, storagePath, and mediaType are required" },
        { status: 400 }
      );
    }

    if (mediaType !== "image" && mediaType !== "video") {
      return NextResponse.json(
        { error: "mediaType must be 'image' or 'video'" },
        { status: 400 }
      );
    }

    // Validate business exists and is active
    const { data: biz } = await supabaseServer
      .from("business")
      .select("id")
      .eq("id", businessId)
      .eq("is_active", true)
      .maybeSingle();

    if (!biz) {
      return NextResponse.json(
        { error: "Business not found or inactive" },
        { status: 404 }
      );
    }

    // Sanitize caption
    const cleanCaption = caption ? caption.trim().slice(0, 500) : null;

    // Sanitize tags: lowercase, strip #, deduplicate, max 10
    const cleanTags: string[] = [];
    if (Array.isArray(tags)) {
      const seen = new Set<string>();
      for (const t of tags.slice(0, 10)) {
        const cleaned = String(t)
          .trim()
          .replace(/^#/, "")
          .toLowerCase()
          .slice(0, 30);
        if (cleaned && !seen.has(cleaned)) {
          seen.add(cleaned);
          cleanTags.push(cleaned);
        }
      }
    }

    const { data: inserted, error: insertErr } = await supabaseServer
      .from("user_experience_media")
      .insert({
        business_id: businessId,
        user_id: currentUserId,
        storage_path: storagePath,
        media_type: mediaType,
        status: "pending",
        is_active: true,
        caption: cleanCaption,
        tags: cleanTags,
      })
      .select("id, created_at, status")
      .single();

    if (insertErr) {
      console.error("[experiences] POST insert error:", insertErr);
      return NextResponse.json(
        { error: insertErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ experience: inserted }, { status: 201 });
  } catch (err) {
    console.error("[experiences] POST unexpected error:", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
