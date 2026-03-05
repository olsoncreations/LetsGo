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
};

function getDisplayName(p: ProfileRow): string {
  if (p.full_name) return p.full_name;
  const parts = [p.first_name, p.last_name].filter(Boolean);
  if (parts.length) return parts.join(" ");
  return p.username || "User";
}

// ═══════════════════════════════════════════════════
// GET /api/admin/ugc/comments
//
// Three modes:
//   ?mode=posts                → All UGC posts with comment counts (admin overview)
//   ?experienceId=<uuid>       → Comments for one post (with optional &search= and &page=)
//   (no mode, no experienceId) → Legacy flat list (backwards compat)
//
// Uses supabaseServer (service role) — admin only.
// ═══════════════════════════════════════════════════

export async function GET(req: NextRequest): Promise<Response> {
  // Require staff authentication
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: { user: authUser }, error: authErr } = await supabaseServer.auth.getUser(token);
  if (authErr || !authUser) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: staffCheck } = await supabaseServer.from("staff_users").select("user_id").eq("user_id", authUser.id).maybeSingle();
  if (!staffCheck) return NextResponse.json({ error: "Staff access required" }, { status: 403 });

  try {
    const sp = req.nextUrl.searchParams;
    const mode = sp.get("mode");
    const experienceId = sp.get("experienceId");

    // ── Mode: posts — list all UGC posts with comment counts ──
    if (mode === "posts") {
      const searchBiz = (sp.get("search") || "").trim().toLowerCase();

      // Get all UGC posts that are active
      const { data: posts, error: postsError } = await supabaseServer
        .from("user_experience_media")
        .select("id, user_id, business_id, storage_path, media_type, caption, status, created_at")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (postsError) {
        console.error("[admin/ugc/comments] posts error:", postsError);
        return NextResponse.json({ error: postsError.message }, { status: 500 });
      }

      const postRows = (posts ?? []) as {
        id: string;
        user_id: string;
        business_id: string;
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
      const bizIds = [...new Set(postRows.map((p) => p.business_id))];
      const userIds = [...new Set(postRows.map((p) => p.user_id))];

      // Parallel: comment counts, business names, submitter profiles
      const [commentCountsRes, bizRes, profilesRes] = await Promise.all([
        supabaseServer
          .from("experience_comments")
          .select("experience_id")
          .in("experience_id", postIds),
        supabaseServer
          .from("business")
          .select("id, business_name, public_business_name")
          .in("id", bizIds),
        supabaseServer
          .from("profiles")
          .select("id, full_name, first_name, last_name, username")
          .in("id", userIds),
      ]);

      // Comment counts per experience
      const commentCountMap = new Map<string, number>();
      let totalComments = 0;
      for (const row of (commentCountsRes.data ?? []) as { experience_id: string }[]) {
        commentCountMap.set(row.experience_id, (commentCountMap.get(row.experience_id) || 0) + 1);
        totalComments++;
      }

      // Business name map
      const bizNameMap = new Map<string, string>();
      for (const b of (bizRes.data ?? []) as { id: string; business_name: string | null; public_business_name: string | null }[]) {
        bizNameMap.set(b.id, b.public_business_name || b.business_name || "Unknown");
      }

      // Profile map
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
          const bizName = bizNameMap.get(p.business_id) || "Unknown Business";

          return {
            id: p.id,
            mediaType: p.media_type,
            mediaUrl: signedData?.signedUrl ?? "",
            caption: p.caption,
            status: p.status,
            createdAt: p.created_at,
            commentCount: commentCountMap.get(p.id) || 0,
            businessId: p.business_id,
            businessName: bizName,
            submitter: {
              id: p.user_id,
              name: profile ? getDisplayName(profile) : "User",
              username: profile?.username ?? null,
            },
          };
        })
      );

      // Only posts with comments, optionally filtered by business name
      let withComments = enrichedPosts.filter((p) => p.commentCount > 0);
      if (searchBiz) {
        withComments = withComments.filter((p) =>
          p.businessName.toLowerCase().includes(searchBiz) ||
          p.submitter.name.toLowerCase().includes(searchBiz)
        );
      }

      return NextResponse.json({
        posts: withComments,
        allPostCount: enrichedPosts.length,
        totalComments,
      });
    }

    // ── Mode: comments for a specific experience ──
    if (experienceId) {
      const page = Math.max(1, parseInt(sp.get("page") || "1", 10));
      const limit = Math.min(50, Math.max(1, parseInt(sp.get("limit") || "30", 10)));
      const search = (sp.get("search") || "").trim();

      // Fetch all comments for this experience
      let query = supabaseServer
        .from("experience_comments")
        .select("id, experience_id, user_id, body, created_at")
        .eq("experience_id", experienceId)
        .order("created_at", { ascending: false });

      // DB-level body filter when search doesn't target usernames
      if (search && !search.includes("@")) {
        query = query.ilike("body", `%${search}%`);
      }

      const { data: rawRows, error } = await query;

      if (error) {
        console.error("[admin/ugc/comments] GET error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const rows = (rawRows ?? []) as CommentRow[];

      if (rows.length === 0) {
        return NextResponse.json({
          comments: [],
          pagination: { page, limit, totalRows: 0, totalPages: 0 },
        });
      }

      // Enrich with profiles and like counts
      const commentIds = rows.map((r) => r.id);
      const userIds = [...new Set(rows.map((r) => r.user_id))];

      const [profilesRes, likeCountsRes] = await Promise.all([
        supabaseServer
          .from("profiles")
          .select("id, full_name, first_name, last_name, username")
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
          },
        };
      });

      // Filter by search across body + user name/username
      const searchLower = search.toLowerCase();
      const filtered = search
        ? allComments.filter(
            (c) =>
              c.body.toLowerCase().includes(searchLower) ||
              c.user.name.toLowerCase().includes(searchLower) ||
              (c.user.username ?? "").toLowerCase().includes(searchLower)
          )
        : allComments;

      // Paginate
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

    // ── Legacy: flat list (no mode, no experienceId) ──
    const page = Math.max(1, parseInt(sp.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(sp.get("limit") || "30", 10)));
    const search = (sp.get("search") || "").trim().toLowerCase();
    const offset = (page - 1) * limit;

    const { count: totalCount } = await supabaseServer
      .from("experience_comments")
      .select("id", { count: "exact", head: true });

    const { data: rawRows, error, count: filteredCount } = await supabaseServer
      .from("experience_comments")
      .select("id, experience_id, user_id, body, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("[admin/ugc/comments] GET error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (rawRows ?? []) as CommentRow[];

    const userIds = [...new Set(rows.map((r) => r.user_id))];
    const experienceIds = [...new Set(rows.map((r) => r.experience_id))];

    const [profilesRes, experiencesRes, likeCountsRes] = await Promise.all([
      userIds.length > 0
        ? supabaseServer
            .from("profiles")
            .select("id, full_name, first_name, last_name, username")
            .in("id", userIds)
        : { data: [] },
      experienceIds.length > 0
        ? supabaseServer
            .from("user_experience_media")
            .select("id, business_id")
            .in("id", experienceIds)
        : { data: [] },
      rows.length > 0
        ? supabaseServer
            .from("experience_comment_likes")
            .select("comment_id")
            .in("comment_id", rows.map((r) => r.id))
        : { data: [] },
    ]);

    const profileMap = new Map<string, ProfileRow>();
    for (const p of (profilesRes.data ?? []) as ProfileRow[]) {
      profileMap.set(p.id, p);
    }

    const expBizMap = new Map<string, string>();
    for (const e of (experiencesRes.data ?? []) as { id: string; business_id: string }[]) {
      expBizMap.set(e.id, e.business_id);
    }

    const bizIds = [...new Set([...expBizMap.values()])];
    const bizNameMap = new Map<string, string>();
    if (bizIds.length > 0) {
      const { data: bizData } = await supabaseServer
        .from("business")
        .select("id, business_name, public_business_name")
        .in("id", bizIds);
      for (const b of (bizData ?? []) as { id: string; business_name: string | null; public_business_name: string | null }[]) {
        bizNameMap.set(b.id, b.public_business_name || b.business_name || "Unknown");
      }
    }

    const likeCountMap = new Map<string, number>();
    for (const row of (likeCountsRes.data ?? []) as { comment_id: string }[]) {
      likeCountMap.set(row.comment_id, (likeCountMap.get(row.comment_id) || 0) + 1);
    }

    const comments = rows.map((r) => {
      const profile = profileMap.get(r.user_id);
      const bizId = expBizMap.get(r.experience_id) || "";
      const bizName = bizNameMap.get(bizId) || "Unknown Business";

      return {
        id: r.id,
        experienceId: r.experience_id,
        body: r.body,
        createdAt: r.created_at,
        likeCount: likeCountMap.get(r.id) || 0,
        businessId: bizId,
        businessName: bizName,
        user: {
          id: r.user_id,
          name: profile ? getDisplayName(profile) : "User",
          username: profile?.username ?? null,
        },
      };
    });

    const filtered = search
      ? comments.filter(
          (c) =>
            c.body.toLowerCase().includes(search) ||
            c.user.name.toLowerCase().includes(search) ||
            c.businessName.toLowerCase().includes(search)
        )
      : comments;

    return NextResponse.json({
      comments: filtered,
      stats: { total: totalCount ?? 0 },
      pagination: {
        page,
        limit,
        totalRows: filteredCount ?? 0,
        totalPages: Math.ceil((filteredCount ?? 0) / limit),
      },
    });
  } catch (err) {
    console.error("[admin/ugc/comments] GET unexpected error:", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════
// DELETE /api/admin/ugc/comments
// Admin deletes a comment (hard delete).
// Body: { commentId: string }
// ═══════════════════════════════════════════════════

export async function DELETE(req: NextRequest): Promise<Response> {
  // Require staff authentication
  const delToken = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!delToken) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: { user: delAuthUser }, error: delAuthErr } = await supabaseServer.auth.getUser(delToken);
  if (delAuthErr || !delAuthUser) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: delStaffCheck } = await supabaseServer.from("staff_users").select("user_id").eq("user_id", delAuthUser.id).maybeSingle();
  if (!delStaffCheck) return NextResponse.json({ error: "Staff access required" }, { status: 403 });

  try {
    const body = await req.json();
    const { commentId } = body as { commentId: string };

    if (!commentId) {
      return NextResponse.json(
        { error: "commentId is required" },
        { status: 400 }
      );
    }

    const { data: existing } = await supabaseServer
      .from("experience_comments")
      .select("id")
      .eq("id", commentId)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json(
        { error: "Comment not found" },
        { status: 404 }
      );
    }

    const { error } = await supabaseServer
      .from("experience_comments")
      .delete()
      .eq("id", commentId);

    if (error) {
      console.error("[admin/ugc/comments] DELETE error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ commentId, action: "deleted" });
  } catch (err) {
    console.error("[admin/ugc/comments] DELETE unexpected error:", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
