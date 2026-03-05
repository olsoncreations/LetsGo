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
 * Verify the caller is an owner/manager of the business.
 */
async function verifyBusinessAccess(
  userId: string,
  businessId: string
): Promise<boolean> {
  const { data } = await supabaseServer
    .from("business_users")
    .select("role")
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .in("role", ["owner", "manager"])
    .maybeSingle();
  return !!data;
}

// ═══════════════════════════════════════════════════
// GET /api/businesses/[businessId]/ugc/comments
//
// Two modes:
//   ?mode=posts          → Returns UGC posts with comment counts + thumbnails
//   ?experienceId=<uuid> → Returns comments for a specific post
//
// Both require business owner/manager auth.
// ═══════════════════════════════════════════════════

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
): Promise<Response> {
  try {
    const { businessId } = await params;
    const userId = await extractUserId(req);

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const hasAccess = await verifyBusinessAccess(userId, businessId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Not authorized for this business" },
        { status: 403 }
      );
    }

    const sp = req.nextUrl.searchParams;
    const mode = sp.get("mode");
    const experienceId = sp.get("experienceId");

    // ── Mode: posts — return UGC posts with comment counts ──
    if (mode === "posts") {
      // Get approved UGC posts for this business
      const { data: posts, error: postsError } = await supabaseServer
        .from("user_experience_media")
        .select("id, user_id, storage_path, media_type, caption, status, created_at")
        .eq("business_id", businessId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (postsError) {
        console.error("[biz/ugc/comments] posts lookup error:", postsError);
        return NextResponse.json({ error: postsError.message }, { status: 500 });
      }

      const postRows = (posts ?? []) as {
        id: string;
        user_id: string;
        storage_path: string;
        media_type: string;
        caption: string | null;
        status: string;
        created_at: string;
      }[];

      if (postRows.length === 0) {
        return NextResponse.json({ posts: [], totalComments: 0 });
      }

      const postIds = postRows.map((p) => p.id);

      // Get comment counts per post and submitter profiles in parallel
      const [commentCountsRes, profilesRes] = await Promise.all([
        supabaseServer
          .from("experience_comments")
          .select("experience_id")
          .in("experience_id", postIds),
        supabaseServer
          .from("profiles")
          .select("id, full_name, first_name, last_name, username, avatar_url")
          .in("id", [...new Set(postRows.map((p) => p.user_id))]),
      ]);

      // Aggregate comment counts per experience
      const commentCountMap = new Map<string, number>();
      let totalComments = 0;
      for (const row of (commentCountsRes.data ?? []) as { experience_id: string }[]) {
        commentCountMap.set(row.experience_id, (commentCountMap.get(row.experience_id) || 0) + 1);
        totalComments++;
      }

      const profileMap = new Map<string, ProfileRow>();
      for (const p of (profilesRes.data ?? []) as ProfileRow[]) {
        profileMap.set(p.id, p);
      }

      // Generate signed URLs + assemble
      const enrichedPosts = await Promise.all(
        postRows.map(async (p) => {
          const { data: signedData } = await supabaseServer.storage
            .from("user-experiences")
            .createSignedUrl(p.storage_path, 60 * 30);

          const profile = profileMap.get(p.user_id);
          return {
            id: p.id,
            mediaType: p.media_type,
            mediaUrl: signedData?.signedUrl ?? "",
            caption: p.caption,
            status: p.status,
            createdAt: p.created_at,
            commentCount: commentCountMap.get(p.id) || 0,
            submitter: {
              id: p.user_id,
              name: profile ? getDisplayName(profile) : "User",
              username: profile?.username ?? null,
              avatarUrl: profile?.avatar_url ?? null,
            },
          };
        })
      );

      // Only return posts that have comments (businesses only care about moderation)
      // But also include total so they know the scope
      return NextResponse.json({
        posts: enrichedPosts.filter((p) => p.commentCount > 0),
        allPostCount: enrichedPosts.length,
        totalComments,
      });
    }

    // ── Mode: comments for a specific experience ──
    if (experienceId) {
      // Verify the experience belongs to this business
      const { data: exp } = await supabaseServer
        .from("user_experience_media")
        .select("id")
        .eq("id", experienceId)
        .eq("business_id", businessId)
        .maybeSingle();

      if (!exp) {
        return NextResponse.json(
          { error: "Post not found for this business" },
          { status: 404 }
        );
      }

      const page = Math.max(1, parseInt(sp.get("page") || "1", 10));
      const limit = Math.min(50, Math.max(1, parseInt(sp.get("limit") || "30", 10)));
      const search = (sp.get("search") || "").trim();

      // If searching, we need to fetch all comments for this post, enrich with
      // profiles, then filter by search term (body or username) and paginate.
      // Supabase doesn't support OR across joined tables, so we do a two-step
      // approach: fetch comments, enrich, filter, then paginate in memory.

      // Step A: Get all comment rows for this experience
      let query = supabaseServer
        .from("experience_comments")
        .select("id, experience_id, user_id, body, created_at")
        .eq("experience_id", experienceId)
        .order("created_at", { ascending: false });

      // If no search, apply DB-level text filter for efficiency
      if (search && !search.includes("@")) {
        query = query.ilike("body", `%${search}%`);
      }

      const { data: rawRows, error } = await query;

      if (error) {
        console.error("[biz/ugc/comments] GET error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const rows = (rawRows ?? []) as CommentRow[];

      if (rows.length === 0) {
        return NextResponse.json({
          comments: [],
          pagination: { page, limit, totalRows: 0, totalPages: 0 },
        });
      }

      // Step B: Enrich with profiles and like counts
      const commentIds = rows.map((r) => r.id);
      const userIds = [...new Set(rows.map((r) => r.user_id))];

      const [profilesRes, likeCountsRes] = await Promise.all([
        supabaseServer
          .from("profiles")
          .select("id, full_name, first_name, last_name, username, avatar_url")
          .in("id", userIds),
        supabaseServer
          .from("experience_comment_likes")
          .select("comment_id")
          .in("comment_id", commentIds),
      ]);

      const profileMap = new Map<string, ProfileRow>();
      for (const p of (profilesRes.data ?? []) as ProfileRow[]) {
        profileMap.set(p.id, p);
      }

      const likeCountMap = new Map<string, number>();
      for (const row of (likeCountsRes.data ?? []) as { comment_id: string }[]) {
        likeCountMap.set(row.comment_id, (likeCountMap.get(row.comment_id) || 0) + 1);
      }

      const allComments = rows.map((r) => {
        const profile = profileMap.get(r.user_id);
        return {
          id: r.id,
          experienceId: r.experience_id,
          body: r.body,
          createdAt: r.created_at,
          likeCount: likeCountMap.get(r.id) || 0,
          user: {
            id: r.user_id,
            name: profile ? getDisplayName(profile) : "User",
            username: profile?.username ?? null,
            avatarUrl: profile?.avatar_url ?? null,
          },
        };
      });

      // Step C: If searching by username (contains @), filter on user fields too
      const searchLower = search.toLowerCase();
      const filtered = search
        ? allComments.filter(
            (c) =>
              c.body.toLowerCase().includes(searchLower) ||
              c.user.name.toLowerCase().includes(searchLower) ||
              (c.user.username ?? "").toLowerCase().includes(searchLower)
          )
        : allComments;

      // Step D: Paginate the filtered results
      const totalRows = filtered.length;
      const offset = (page - 1) * limit;
      const comments = filtered.slice(offset, offset + limit);

      return NextResponse.json({
        comments,
        pagination: {
          page,
          limit,
          totalRows,
          totalPages: Math.ceil(totalRows / limit),
        },
      });
    }

    // No valid mode specified
    return NextResponse.json(
      { error: "Specify ?mode=posts or ?experienceId=<uuid>" },
      { status: 400 }
    );
  } catch (err) {
    console.error("[biz/ugc/comments] GET unexpected error:", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════
// DELETE /api/businesses/[businessId]/ugc/comments
// Business owner/manager deletes a comment on their UGC.
// Body: { commentId: string }
// ═══════════════════════════════════════════════════

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
): Promise<Response> {
  try {
    const { businessId } = await params;
    const userId = await extractUserId(req);

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const hasAccess = await verifyBusinessAccess(userId, businessId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Not authorized for this business" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { commentId } = body as { commentId: string };

    if (!commentId) {
      return NextResponse.json(
        { error: "commentId is required" },
        { status: 400 }
      );
    }

    // Verify the comment exists and belongs to a UGC post for this business
    const { data: comment } = await supabaseServer
      .from("experience_comments")
      .select("id, experience_id")
      .eq("id", commentId)
      .maybeSingle();

    if (!comment) {
      return NextResponse.json(
        { error: "Comment not found" },
        { status: 404 }
      );
    }

    // Verify the experience belongs to this business
    const { data: experience } = await supabaseServer
      .from("user_experience_media")
      .select("id")
      .eq("id", comment.experience_id)
      .eq("business_id", businessId)
      .maybeSingle();

    if (!experience) {
      return NextResponse.json(
        { error: "Comment does not belong to this business's content" },
        { status: 403 }
      );
    }

    // Hard delete — FK cascade removes associated likes
    const { error: deleteError } = await supabaseServer
      .from("experience_comments")
      .delete()
      .eq("id", commentId);

    if (deleteError) {
      console.error("[biz/ugc/comments] DELETE error:", deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ commentId, action: "deleted" });
  } catch (err) {
    console.error("[biz/ugc/comments] DELETE unexpected error:", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
