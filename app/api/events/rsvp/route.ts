import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * POST /api/events/rsvp
 * Upsert or toggle an attendance vote for an event.
 * Body: { eventId: string, response: "yes" | "maybe" | "no" }
 *
 * If the user already has the same response → delete (toggle off).
 * Otherwise → upsert with the new response.
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
    const { eventId, response } = body as {
      eventId: string;
      response: "yes" | "maybe" | "no";
    };
    // Use authenticated user ID — ignore any userId from body
    const userId = authUser.id;

    if (!eventId || !response) {
      return NextResponse.json({ error: "eventId and response are required" }, { status: 400 });
    }

    if (!["yes", "maybe", "no"].includes(response)) {
      return NextResponse.json({ error: "response must be yes, maybe, or no" }, { status: 400 });
    }

    // Check if user already has a vote for this event
    const { data: existing } = await supabaseServer
      .from("event_rsvps")
      .select("id, response")
      .eq("event_id", eventId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing && existing.response === response) {
      // Same vote → toggle off (delete)
      const { error } = await supabaseServer
        .from("event_rsvps")
        .delete()
        .eq("id", existing.id);

      if (error) {
        console.error("[events/rsvp] DELETE error:", error);
        return NextResponse.json({ error: "Failed to remove RSVP" }, { status: 500 });
      }

      return NextResponse.json({ action: "removed", response: null });
    }

    // Upsert the vote
    const { error } = await supabaseServer
      .from("event_rsvps")
      .upsert(
        {
          event_id: eventId,
          user_id: userId,
          response,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "event_id,user_id" }
      );

    if (error) {
      console.error("[events/rsvp] UPSERT error:", error);
      return NextResponse.json({ error: "Failed to save RSVP" }, { status: 500 });
    }

    return NextResponse.json({ action: "saved", response });
  } catch (err) {
    console.error("[events/rsvp] unexpected error:", err);
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 }
    );
  }
}
