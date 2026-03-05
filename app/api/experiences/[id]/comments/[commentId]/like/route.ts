import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

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
 * POST /api/experiences/[id]/comments/[commentId]/like
 * Toggle like/unlike on a comment. Requires authentication.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
): Promise<Response> {
  try {
    const { commentId } = await params;
    const userId = await extractUserId(req);

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    if (!commentId) {
      return NextResponse.json(
        { error: "Comment ID is required" },
        { status: 400 }
      );
    }

    // Check if already liked
    const { data: existing } = await supabaseServer
      .from("experience_comment_likes")
      .select("id")
      .eq("comment_id", commentId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      // Already liked → unlike (delete)
      const { error } = await supabaseServer
        .from("experience_comment_likes")
        .delete()
        .eq("id", existing.id);

      if (error) {
        console.error("[comments/like] DELETE error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else {
      // Not liked → like (insert)
      const { error } = await supabaseServer
        .from("experience_comment_likes")
        .insert({ comment_id: commentId, user_id: userId });

      if (error) {
        if (error.code === "23505") {
          // Already liked (race condition) — treat as success
        } else {
          console.error("[comments/like] INSERT error:", error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
      }
    }

    // Get updated count
    const { count } = await supabaseServer
      .from("experience_comment_likes")
      .select("id", { count: "exact", head: true })
      .eq("comment_id", commentId);

    return NextResponse.json({
      liked: !existing,
      likeCount: count ?? 0,
    });
  } catch (err) {
    console.error("[comments/like] unexpected error:", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
