import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * GET /api/events/save
 * Returns the list of event IDs the authenticated user has saved.
 */
export async function GET(req: NextRequest): Promise<Response> {
  try {
    // Authenticate the caller
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const { data: { user: authUser }, error: authErr } = await supabaseServer.auth.getUser(token);
    if (authErr || !authUser) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const userId = authUser.id;

    const { data, error } = await supabaseServer
      .from("user_saved_events")
      .select("event_id")
      .eq("user_id", userId);

    if (error) {
      console.error("[events/save] GET error:", error);
      return NextResponse.json({ error: "Failed to fetch saved events" }, { status: 500 });
    }

    const savedEventIds = (data ?? []).map((r) => String(r.event_id));
    return NextResponse.json({ savedEventIds });
  } catch (err) {
    console.error("[events/save] GET unexpected error:", err);
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/events/save
 * Toggle save/unsave an event for the authenticated user.
 * Body: { eventId: string }
 * If already saved → delete (unsave). Otherwise → insert (save).
 */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    // Authenticate the caller
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const { data: { user: authUser }, error: authErr } = await supabaseServer.auth.getUser(token);
    if (authErr || !authUser) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await req.json();
    const { eventId } = body as { eventId: string };
    // Use authenticated user ID — ignore any userId from body
    const userId = authUser.id;

    if (!eventId) {
      return NextResponse.json(
        { error: "eventId is required" },
        { status: 400 }
      );
    }

    // Check if already saved
    const { data: existing } = await supabaseServer
      .from("user_saved_events")
      .select("id")
      .eq("event_id", eventId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      // Already saved → unsave (delete)
      const { error } = await supabaseServer
        .from("user_saved_events")
        .delete()
        .eq("id", existing.id);

      if (error) {
        console.error("[events/save] DELETE error:", error);
        return NextResponse.json({ error: "Failed to unsave event" }, { status: 500 });
      }

      return NextResponse.json({ action: "unsaved" });
    }

    // Not saved → save (insert)
    const { error } = await supabaseServer
      .from("user_saved_events")
      .insert({ event_id: eventId, user_id: userId });

    if (error) {
      // Handle unique constraint violation gracefully
      if (error.code === "23505") {
        return NextResponse.json({ action: "already_saved" });
      }
      console.error("[events/save] INSERT error:", error);
      return NextResponse.json({ error: "Failed to save event" }, { status: 500 });
    }

    return NextResponse.json({ action: "saved" });
  } catch (err) {
    console.error("[events/save] POST unexpected error:", err);
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 }
    );
  }
}
