import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

// Extract authenticated user
async function authenticate(req: NextRequest): Promise<{ id: string } | null> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user }, error } = await supabaseServer.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

/**
 * GET /api/businesses/follow
 * Returns the list of saved and followed business IDs for the authenticated user.
 * Every row = saved. Rows with is_following = true = also following.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const authUser = await authenticate(req);
  if (!authUser) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const userId = authUser.id;

    const { data, error } = await supabaseServer
      .from("user_followed_businesses")
      .select("business_id, is_following")
      .eq("user_id", userId);

    if (error) {
      console.error("[businesses/follow] GET error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = data ?? [];
    const savedBusinessIds = rows.map((r) => String(r.business_id));
    const followedBusinessIds = rows
      .filter((r) => r.is_following)
      .map((r) => String(r.business_id));

    return NextResponse.json({ savedBusinessIds, followedBusinessIds });
  } catch (err) {
    console.error("[businesses/follow] GET unexpected error:", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 },
    );
  }
}

/**
 * POST /api/businesses/follow
 * Toggle follow/unfollow a business for the authenticated user.
 * Body: { businessId: string }
 *
 * Follow: upsert row with is_following = true (auto-saves).
 * Unfollow: set is_following = false (keeps row = still saved).
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
      return NextResponse.json(
        { error: "businessId is required" },
        { status: 400 },
      );
    }

    // Check current state
    const { data: existing } = await supabaseServer
      .from("user_followed_businesses")
      .select("id, is_following")
      .eq("business_id", businessId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing?.is_following) {
      // Currently following → unfollow (keep row = still saved)
      const { error } = await supabaseServer
        .from("user_followed_businesses")
        .update({ is_following: false })
        .eq("id", existing.id);

      if (error) {
        console.error("[businesses/follow] UPDATE error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ action: "unfollowed" });
    }

    if (existing) {
      // Row exists but not following → follow
      const { error } = await supabaseServer
        .from("user_followed_businesses")
        .update({ is_following: true })
        .eq("id", existing.id);

      if (error) {
        console.error("[businesses/follow] UPDATE error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ action: "followed" });
    }

    // No row → insert with is_following = true (follow auto-saves)
    const { error } = await supabaseServer
      .from("user_followed_businesses")
      .insert({ business_id: businessId, user_id: userId, is_following: true });

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ action: "already_followed" });
      }
      console.error("[businesses/follow] INSERT error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ action: "followed" });
  } catch (err) {
    console.error("[businesses/follow] POST unexpected error:", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 },
    );
  }
}
