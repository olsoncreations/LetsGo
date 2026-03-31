import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { notify } from "@/lib/notify";
import { NOTIFICATION_TYPES } from "@/lib/notificationTypes";

// ─── Helper: authenticate request ───

async function authenticate(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user }, error } = await supabaseServer.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

/**
 * PATCH /api/games/[id]
 * Submit picks and advance game state.
 * Body: { action: 'pick5' | 'pick3' | 'pick1', picks: string[] | string }
 *
 * State transitions (validated server-side):
 *   pick5: P1 submits 5 business IDs → status pick5 → pick3
 *   pick3: P2 submits 3 business IDs (subset of pick5) → status pick3 → pick1
 *   pick1: P1 submits 1 business ID (from pick3) → status pick1 → complete
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await authenticate(req);
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id: gameId } = await params;
  const body = await req.json();
  const action = String(body.action || "");
  const picks = body.picks;

  if (!["pick5", "pick3", "pick1"].includes(action)) {
    return NextResponse.json({ error: "action must be 'pick5', 'pick3', or 'pick1'" }, { status: 400 });
  }

  // Fetch the game
  const { data: game, error: fetchErr } = await supabaseServer
    .from("game_sessions")
    .select("*")
    .eq("id", gameId)
    .maybeSingle();

  if (fetchErr || !game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  // Check expiry
  if (game.expires_at && new Date(game.expires_at as string) < new Date()) {
    await supabaseServer
      .from("game_sessions")
      .update({ status: "expired" })
      .eq("id", gameId);
    return NextResponse.json({ error: "Game has expired" }, { status: 410 });
  }

  // ── PICK 5: Player 1 submits 5 business IDs ──
  if (action === "pick5") {
    if (game.player1_id !== user.id) {
      return NextResponse.json({ error: "Only Player 1 can submit Pick 5" }, { status: 403 });
    }
    if (game.status !== "pick5") {
      return NextResponse.json({ error: `Cannot pick5 in '${game.status}' state` }, { status: 400 });
    }
    if (!Array.isArray(picks) || picks.length !== 5) {
      return NextResponse.json({ error: "Must provide exactly 5 business IDs" }, { status: 400 });
    }

    const pickIds = picks.map(String);
    if (new Set(pickIds).size !== 5) {
      return NextResponse.json({ error: "Duplicate business IDs not allowed" }, { status: 400 });
    }

    // Verify all business IDs exist
    const { data: businesses } = await supabaseServer
      .from("business")
      .select("id")
      .in("id", pickIds)
      .eq("is_active", true);

    if (!businesses || businesses.length !== 5) {
      return NextResponse.json({ error: "One or more business IDs are invalid" }, { status: 400 });
    }

    const { data: updated, error: updateErr } = await supabaseServer
      .from("game_sessions")
      .update({ pick5_ids: pickIds, status: "pick3" })
      .eq("id", gameId)
      .select("*")
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Notify P2: your turn to narrow to 3
    if (game.player2_id) {
      notify({
        userId: game.player2_id as string,
        type: NOTIFICATION_TYPES.GAME_ADVANCED,
        title: "Your Turn!",
        body: "5 places picked — now narrow it down to 3!",
        metadata: { gameId, gameCode: game.game_code, href: "/5v3v1" },
      });
    }

    return NextResponse.json({ gameSession: updated });
  }

  // ── PICK 3: Player 2 narrows to 3 from the 5 ──
  if (action === "pick3") {
    if (game.player2_id !== user.id) {
      return NextResponse.json({ error: "Only Player 2 can submit Pick 3" }, { status: 403 });
    }
    if (game.status !== "pick3") {
      return NextResponse.json({ error: `Cannot pick3 in '${game.status}' state` }, { status: 400 });
    }
    if (!Array.isArray(picks) || picks.length !== 3) {
      return NextResponse.json({ error: "Must provide exactly 3 business IDs" }, { status: 400 });
    }

    const pickIds = picks.map(String);
    if (new Set(pickIds).size !== 3) {
      return NextResponse.json({ error: "Duplicate business IDs not allowed" }, { status: 400 });
    }
    const pick5Set = new Set((game.pick5_ids as string[]) ?? []);

    // All 3 must be from the original 5
    for (const id of pickIds) {
      if (!pick5Set.has(id)) {
        return NextResponse.json({ error: `Business ${id} is not in the original 5 picks` }, { status: 400 });
      }
    }

    const { data: updated, error: updateErr } = await supabaseServer
      .from("game_sessions")
      .update({ pick3_ids: pickIds, status: "pick1" })
      .eq("id", gameId)
      .select("*")
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Notify P1: your turn to make the final pick
    if (game.player1_id) {
      notify({
        userId: game.player1_id as string,
        type: NOTIFICATION_TYPES.GAME_ADVANCED,
        title: "Final Pick!",
        body: "3 places left — make the final call!",
        metadata: { gameId, gameCode: game.game_code, href: "/5v3v1" },
      });
    }

    return NextResponse.json({ gameSession: updated });
  }

  // ── PICK 1: Player 1 makes the final choice ──
  if (action === "pick1") {
    if (game.player1_id !== user.id) {
      return NextResponse.json({ error: "Only Player 1 can submit Pick 1" }, { status: 403 });
    }
    if (game.status !== "pick1") {
      return NextResponse.json({ error: `Cannot pick1 in '${game.status}' state` }, { status: 400 });
    }

    const finalPick = String(typeof picks === "string" ? picks : Array.isArray(picks) ? picks[0] : "");
    if (!finalPick) {
      return NextResponse.json({ error: "Must provide a business ID" }, { status: 400 });
    }

    const pick3Set = new Set((game.pick3_ids as string[]) ?? []);
    if (!pick3Set.has(finalPick)) {
      return NextResponse.json({ error: "Final pick must be one of the 3 choices" }, { status: 400 });
    }

    const { data: updated, error: updateErr } = await supabaseServer
      .from("game_sessions")
      .update({
        pick1_id: finalPick,
        winner_business_id: finalPick,
        status: "complete",
        completed_at: new Date().toISOString(),
      })
      .eq("id", gameId)
      .select("*")
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Notify P2: game complete with winner
    if (game.player2_id) {
      const { data: biz } = await supabaseServer
        .from("business")
        .select("public_business_name, business_name")
        .eq("id", finalPick)
        .maybeSingle();

      const bizName = (biz?.public_business_name || biz?.business_name || "the winner") as string;

      notify({
        userId: game.player2_id as string,
        type: NOTIFICATION_TYPES.GAME_COMPLETE,
        title: "Game Over!",
        body: `The verdict is in — you're going to ${bizName}!`,
        metadata: { gameId, gameCode: game.game_code, winnerBusinessId: finalPick, businessName: bizName, href: "/5v3v1" },
      });
    }

    return NextResponse.json({ gameSession: updated });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

/**
 * GET /api/games/[id]
 * Fetch a single game session.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await authenticate(req);
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id: gameId } = await params;

  const { data: game, error: fetchErr } = await supabaseServer
    .from("game_sessions")
    .select("*")
    .eq("id", gameId)
    .maybeSingle();

  if (fetchErr || !game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  // Verify the user is a player in this game
  if (game.player1_id !== user.id && game.player2_id !== user.id) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  return NextResponse.json({ gameSession: game });
}

/**
 * DELETE /api/games/[id]
 * Cancel/delete a game session. Only a participant can cancel.
 * Sets status to "cancelled" rather than hard-deleting.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await authenticate(req);
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id: gameId } = await params;

  const { data: game, error: fetchErr } = await supabaseServer
    .from("game_sessions")
    .select("id, player1_id, player2_id, status")
    .eq("id", gameId)
    .maybeSingle();

  if (fetchErr || !game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  // Only participants can cancel
  if (game.player1_id !== user.id && game.player2_id !== user.id) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  // Already finished — nothing to cancel
  if (game.status === "complete" || game.status === "expired") {
    return NextResponse.json({ error: "Game is already finished" }, { status: 400 });
  }

  // Use "expired" status since the DB CHECK constraint doesn't include "cancelled"
  const { error: updateErr } = await supabaseServer
    .from("game_sessions")
    .update({ status: "expired" })
    .eq("id", gameId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
