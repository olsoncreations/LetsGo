import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * POST /api/events/view
 * Track an event view. Deduplicated per user per event (unique index).
 * Body: { eventId: string }
 * Uses authenticated user ID from Bearer token. Anonymous views still allowed
 * (no token = null user_id).
 */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const body = await req.json();
    const { eventId } = body as { eventId: string };

    if (!eventId) {
      return NextResponse.json({ error: "eventId is required" }, { status: 400 });
    }

    // Authenticate if token provided — use real user ID, ignore any userId from body
    let userId: string | null = null;
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (token) {
      const { data: { user: authUser } } = await supabaseServer.auth.getUser(token);
      if (authUser) userId = authUser.id;
    }

    // Insert with ON CONFLICT DO NOTHING (unique index on event_id, user_id)
    const { error } = await supabaseServer
      .from("event_views")
      .upsert(
        {
          event_id: eventId,
          user_id: userId,
          viewed_at: new Date().toISOString(),
        },
        { onConflict: "event_id,user_id", ignoreDuplicates: true }
      );

    if (error) {
      // Ignore unique constraint violations — they're expected for dedup
      if (error.code === "23505") {
        return NextResponse.json({ action: "already_viewed" });
      }
      console.error("[events/view] INSERT error:", error);
      return NextResponse.json({ error: "Failed to track view" }, { status: 500 });
    }

    return NextResponse.json({ action: "viewed" });
  } catch (err) {
    console.error("[events/view] unexpected error:", err);
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 }
    );
  }
}
