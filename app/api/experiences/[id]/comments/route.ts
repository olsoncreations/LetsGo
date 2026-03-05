import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

// ─── Types ───

type CommentRow = {
  id: string;
  experience_id: string;
  user_id: string;
  body: string;
  created_at: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

function getDisplayName(p: ProfileRow): string {
  if (p.full_name) return p.full_name;
  const parts = [p.first_name, p.last_name].filter(Boolean);
  if (parts.length) return parts.join(" ");
  return p.username || "User";
}

/**
 * Extract user ID from Authorization Bearer token.
 */
async function extractUserId(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const { data } = await supabaseServer.auth.getUser(token);
  return data.user?.id ?? null;
}

/**
 * GET /api/experiences/[id]/comments?cursor=<ISO>&limit=30
 * Fetch comments for an experience post. Public endpoint.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id: experienceId } = await params;
    const searchParams = req.nextUrl.searchParams;
    const cursor = searchParams.get("cursor");
    const limit = Math.min(
      Math.max(Number(searchParams.get("limit")) || 30, 1),
      100
    );

    const currentUserId = await extractUserId(req);

    if (!experienceId) {
      return NextResponse.json(
        { error: "Experience ID is required" },
        { status: 400 }
      );
    }

    let query = supabaseServer
      .from("experience_comments")
      .select("id, experience_id, user_id, body, created_at")
      .eq("experience_id", experienceId)
      .order("created_at", { ascending: false })
      .limit(limit + 1);

    if (cursor) {
      query = query.lt("created_at", cursor);
    }

    const { data: rawComments, error } = await query;
    if (error) {
      console.error("[experiences/comments] GET error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (rawComments ?? []) as CommentRow[];
    const hasMore = rows.length > limit;
    const sliced = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore
      ? sliced[sliced.length - 1].created_at
      : null;

    if (sliced.length === 0) {
      return NextResponse.json({ comments: [], nextCursor: null });
    }

    // Collect comment IDs for like lookups
    const commentIds = sliced.map((c) => c.id);

    // Enrich with profile data + comment likes in parallel
    const [profilesRes, commentLikesRes, userCommentLikesRes] = await Promise.all([
      supabaseServer
        .from("profiles")
        .select("id, full_name, first_name, last_name, username, avatar_url")
        .in("id", [...new Set(sliced.map((c) => c.user_id))]),

      // Like counts per comment
      supabaseServer
        .from("experience_comment_likes")
        .select("comment_id")
        .in("comment_id", commentIds),

      // Current user's liked comments
      currentUserId
        ? supabaseServer
            .from("experience_comment_likes")
            .select("comment_id")
            .eq("user_id", currentUserId)
            .in("comment_id", commentIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const profileMap = new Map<string, ProfileRow>();
    for (const p of (profilesRes.data ?? []) as ProfileRow[]) {
      profileMap.set(p.id, p);
    }

    // Aggregate comment like counts
    const commentLikeCountMap = new Map<string, number>();
    for (const row of (commentLikesRes.data ?? []) as { comment_id: string }[]) {
      commentLikeCountMap.set(
        row.comment_id,
        (commentLikeCountMap.get(row.comment_id) || 0) + 1
      );
    }

    // User's liked comment IDs
    const userLikedCommentSet = new Set<string>();
    if (currentUserId) {
      for (const row of (userCommentLikesRes.data ?? []) as { comment_id: string }[]) {
        userLikedCommentSet.add(row.comment_id);
      }
    }

    const comments = sliced.map((c) => {
      const profile = profileMap.get(c.user_id);
      return {
        id: c.id,
        body: c.body,
        createdAt: c.created_at,
        likeCount: commentLikeCountMap.get(c.id) || 0,
        hasLiked: userLikedCommentSet.has(c.id),
        user: {
          id: c.user_id,
          name: profile ? getDisplayName(profile) : "User",
          username: profile?.username ?? null,
          avatarUrl: profile?.avatar_url ?? null,
        },
      };
    });

    return NextResponse.json({ comments, nextCursor });
  } catch (err) {
    console.error("[experiences/comments] GET unexpected error:", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/experiences/[id]/comments
 * Add a comment to an experience post. Requires authentication.
 * Body: { body: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id: experienceId } = await params;
    const userId = await extractUserId(req);

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    if (!experienceId) {
      return NextResponse.json(
        { error: "Experience ID is required" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const commentBody = String(body?.body ?? "").trim();

    if (!commentBody) {
      return NextResponse.json(
        { error: "Comment body is required" },
        { status: 400 }
      );
    }

    if (commentBody.length > 1000) {
      return NextResponse.json(
        { error: "Comment must be 1000 characters or fewer" },
        { status: 400 }
      );
    }

    const { data: inserted, error } = await supabaseServer
      .from("experience_comments")
      .insert({
        experience_id: experienceId,
        user_id: userId,
        body: commentBody,
      })
      .select("id, body, created_at")
      .single();

    if (error) {
      console.error("[experiences/comments] POST error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch the user's profile for the response
    const { data: profile } = await supabaseServer
      .from("profiles")
      .select("id, full_name, first_name, last_name, username, avatar_url")
      .eq("id", userId)
      .maybeSingle();

    const p = profile as ProfileRow | null;

    return NextResponse.json(
      {
        comment: {
          id: inserted.id,
          body: inserted.body,
          createdAt: inserted.created_at,
          likeCount: 0,
          hasLiked: false,
          user: {
            id: userId,
            name: p ? getDisplayName(p) : "You",
            username: p?.username ?? null,
            avatarUrl: p?.avatar_url ?? null,
          },
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[experiences/comments] POST unexpected error:", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
