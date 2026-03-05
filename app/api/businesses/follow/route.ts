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
 * Returns the list of business IDs the authenticated user follows.
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
      .select("business_id")
      .eq("user_id", userId);

    if (error) {
      console.error("[businesses/follow] GET error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const followedBusinessIds = (data ?? []).map((r) => String(r.business_id));
    return NextResponse.json({ followedBusinessIds });
  } catch (err) {
    console.error("[businesses/follow] GET unexpected error:", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/businesses/follow
 * Toggle follow/unfollow a business for a user.
 * Body: { businessId: string, userId: string }
 * If already followed → delete (unfollow). Otherwise → insert (follow).
 */
export async function POST(req: NextRequest): Promise<Response> {
  const authUser = await authenticate(req);
  if (!authUser) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { businessId } = body as { businessId: string };
    // Use authenticated user ID
    const userId = authUser.id;

    if (!businessId) {
      return NextResponse.json(
        { error: "businessId is required" },
        { status: 400 }
      );
    }

    // Check if already followed
    const { data: existing } = await supabaseServer
      .from("user_followed_businesses")
      .select("id")
      .eq("business_id", businessId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      // Already followed → unfollow (delete)
      const { error } = await supabaseServer
        .from("user_followed_businesses")
        .delete()
        .eq("id", existing.id);

      if (error) {
        console.error("[businesses/follow] DELETE error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ action: "unfollowed" });
    }

    // Not followed → follow (insert)
    const { error } = await supabaseServer
      .from("user_followed_businesses")
      .insert({ business_id: businessId, user_id: userId });

    if (error) {
      // Handle unique constraint violation gracefully
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
      { status: 500 }
    );
  }
}
