import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

async function authenticate(req: NextRequest): Promise<{ id: string } | null> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user }, error } = await supabaseServer.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

/**
 * POST /api/businesses/save
 * Toggle save/unsave a business for the authenticated user.
 * Body: { businessId: string }
 *
 * Save: inserts a row with is_following = false.
 * Unsave: deletes the row entirely (removes both saved + following).
 */
export async function POST(req: NextRequest): Promise<Response> {
  const authUser = await authenticate(req);
  if (!authUser) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { businessId } = body as { businessId: string };
    const userId = authUser.id;

    if (!businessId) {
      return NextResponse.json({ error: "businessId is required" }, { status: 400 });
    }

    // Check if already saved
    const { data: existing } = await supabaseServer
      .from("user_followed_businesses")
      .select("id")
      .eq("business_id", businessId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      // Already saved → unsave (delete row = removes both saved + following)
      const { error } = await supabaseServer
        .from("user_followed_businesses")
        .delete()
        .eq("id", existing.id);

      if (error) {
        console.error("[businesses/save] DELETE error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ action: "unsaved" });
    }

    // Not saved → save (insert with is_following = false)
    const { error } = await supabaseServer
      .from("user_followed_businesses")
      .insert({ business_id: businessId, user_id: userId, is_following: false });

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ action: "already_saved" });
      }
      console.error("[businesses/save] INSERT error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ action: "saved" });
  } catch (err) {
    console.error("[businesses/save] POST unexpected error:", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 },
    );
  }
}
