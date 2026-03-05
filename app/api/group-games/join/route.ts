import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { notify } from "@/lib/notify";
import { NOTIFICATION_TYPES } from "@/lib/notificationTypes";

async function authenticate(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const {
    data: { user },
    error,
  } = await supabaseServer.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

/**
 * POST /api/group-games/join
 * Join a game by code. Body: { gameCode: string }
 */
export async function POST(req: NextRequest) {
  const user = await authenticate(req);
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = await req.json();
  const gameCode = String(body.gameCode || "").trim().toUpperCase();

  if (!gameCode) {
    return NextResponse.json({ error: "Game code is required" }, { status: 400 });
  }

  // Find the game
  const { data: game, error: gameErr } = await supabaseServer
    .from("group_games")
    .select("*")
    .eq("game_code", gameCode)
    .maybeSingle();

  if (gameErr || !game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  if (game.status === "complete" || game.status === "cancelled") {
    return NextResponse.json({ error: "This game has ended" }, { status: 400 });
  }

  if (!game.allow_invites) {
    return NextResponse.json({ error: "This game is not accepting new players" }, { status: 403 });
  }

  // Check if already a member
  const { data: existing } = await supabaseServer
    .from("group_game_players")
    .select("id, removed_at")
    .eq("game_id", game.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing && !existing.removed_at) {
    // Already an active member — just return the game
    return NextResponse.json({ game, alreadyJoined: true });
  }

  if (existing && existing.removed_at) {
    // Was removed — re-add by clearing removed_at
    await supabaseServer
      .from("group_game_players")
      .update({ removed_at: null })
      .eq("id", existing.id);

    return NextResponse.json({ game, rejoined: true });
  }

  // Add as new player
  const { error: insertErr } = await supabaseServer
    .from("group_game_players")
    .insert({
      game_id: game.id,
      user_id: user.id,
      role: "player",
    });

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  // Notify the Game Master that someone joined
  if (game.created_by && game.created_by !== user.id) {
    const { data: joinerProfile } = await supabaseServer
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", user.id)
      .maybeSingle();

    const joinerName = joinerProfile?.first_name
      ? `${joinerProfile.first_name} ${((joinerProfile.last_name as string) || "")[0] || ""}`.trim()
      : "Someone";

    notify({
      userId: game.created_by as string,
      type: NOTIFICATION_TYPES.GAME_INVITE,
      title: "New Player Joined!",
      body: `${joinerName} joined your group game "${(game.name as string) || ""}".`,
      metadata: { gameId: game.id, joinedBy: user.id, href: "/group" },
    });
  }

  return NextResponse.json({ game }, { status: 201 });
}
