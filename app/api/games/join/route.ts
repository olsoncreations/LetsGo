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
 * POST /api/games/join
 * Join an existing game by code.
 * Body: { gameCode: string }
 */
export async function POST(req: NextRequest) {
  const user = await authenticate(req);
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = await req.json();
  const gameCode = String(body.gameCode || "").trim().toUpperCase();

  if (!gameCode) {
    return NextResponse.json({ error: "gameCode is required" }, { status: 400 });
  }

  // Find the game
  const { data: game, error: fetchErr } = await supabaseServer
    .from("game_sessions")
    .select("*")
    .eq("game_code", gameCode)
    .maybeSingle();

  if (fetchErr || !game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  // Check if game has expired
  if (game.expires_at && new Date(game.expires_at as string) < new Date()) {
    return NextResponse.json({ error: "Game has expired" }, { status: 410 });
  }

  // Can't join your own game
  if (game.player1_id === user.id) {
    return NextResponse.json({ error: "You created this game — share the code with a friend", gameSession: game }, { status: 400 });
  }

  // Already joined as P2
  if (game.player2_id === user.id) {
    return NextResponse.json({ gameSession: game, message: "Already joined" });
  }

  // P2 slot already taken by someone else
  if (game.player2_id && game.player2_id !== user.id) {
    return NextResponse.json({ error: "Game already has two players" }, { status: 409 });
  }

  // Game must be pending (waiting for P2) or pick5 (P2 pre-assigned but game started)
  if (!["pending", "pick5"].includes(game.status as string)) {
    return NextResponse.json({ error: "Game is no longer joinable" }, { status: 400 });
  }

  // Join the game: set P2 and advance status to pick5 if pending
  const updates: Record<string, unknown> = { player2_id: user.id };
  if (game.status === "pending") {
    updates.status = "pick5";
  }

  const { data: updated, error: updateErr } = await supabaseServer
    .from("game_sessions")
    .update(updates)
    .eq("id", game.id)
    .select("*")
    .single();

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Notify P1 that someone joined their game
  if (game.player1_id) {
    const { data: joinerProfile } = await supabaseServer
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", user.id)
      .maybeSingle();

    const joinerName = joinerProfile?.first_name
      ? `${joinerProfile.first_name} ${((joinerProfile.last_name as string) || "")[0] || ""}`.trim()
      : "Someone";

    notify({
      userId: game.player1_id as string,
      type: NOTIFICATION_TYPES.GAME_INVITE,
      title: "Player Joined Your Game!",
      body: `${joinerName} joined your 5v3v1 game. Time to pick your 5!`,
      metadata: { gameId: game.id, joinedBy: user.id, href: "/5v3v1" },
    });
  }

  return NextResponse.json({ gameSession: updated, message: "Joined game" });
}
