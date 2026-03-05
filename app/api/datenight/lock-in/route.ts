import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * POST /api/datenight/lock-in
 * Locks in a date night session. Requires authentication.
 * Body: { sessionId: string }
 */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabaseServer.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const body = await req.json();
    const sessionId = String(body.sessionId || "").trim();

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    // Verify session exists and belongs to the user
    const { data: session, error: fetchError } = await supabaseServer
      .from("date_night_sessions")
      .select("id, user_id, status")
      .eq("id", sessionId)
      .single();

    if (fetchError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.user_id !== user.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    if (session.status === "locked_in") {
      return NextResponse.json({ error: "Session already locked in" }, { status: 400 });
    }

    // Update status to locked_in
    const { error: updateError } = await supabaseServer
      .from("date_night_sessions")
      .update({ status: "locked_in", updated_at: new Date().toISOString() })
      .eq("id", sessionId);

    if (updateError) {
      console.error("[datenight/lock-in] Update error:", updateError);
      return NextResponse.json({ error: "Failed to lock in" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, status: "locked_in" });
  } catch (err) {
    console.error("[datenight/lock-in] Unexpected error:", err);
    return NextResponse.json(
      { error: "Unexpected error", details: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
