import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { notify } from "@/lib/notify";
import { NOTIFICATION_TYPES } from "@/lib/notificationTypes";

const REINSTATE_WINDOW_DAYS = 14;

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function authenticate(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user }, error } = await supabaseServer.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

/**
 * POST /api/group-games/[id]/reinstate
 *
 * Restore an auto-cancelled group game so the GM can pick up where the
 * round left off. Manual GM cancels are NOT eligible — this is only for
 * games the cron auto-cancelled.
 *
 *   - Gated to GMs and within the 14-day reinstate window.
 *   - Resets round_end_time to now + time_between_rounds_minutes so the
 *     countdown starts fresh.
 *   - Clears auto_cancelled / cancelled_at and resets reminder counter.
 *   - Restores status based on current_round: round 1 → "selection",
 *     anything later → "voting" (existing votes/selections preserved).
 *   - Notifies all active players the game is back.
 */
export async function POST(req: NextRequest, ctx: RouteContext) {
  const user = await authenticate(req);
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id } = await ctx.params;

  // GM check (game master is recorded on group_game_players.role)
  const { data: membership } = await supabaseServer
    .from("group_game_players")
    .select("role")
    .eq("game_id", id)
    .eq("user_id", user.id)
    .is("removed_at", null)
    .maybeSingle();

  if (!membership || membership.role !== "game_master") {
    return NextResponse.json({ error: "Only the Game Master can reinstate the game" }, { status: 403 });
  }

  const { data: game, error: gameErr } = await supabaseServer
    .from("group_games")
    .select("id, name, status, current_round, time_between_rounds_minutes, auto_cancelled, cancelled_at")
    .eq("id", id)
    .maybeSingle();

  if (gameErr) {
    return NextResponse.json({ error: gameErr.message }, { status: 500 });
  }
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }
  if (game.status !== "cancelled") {
    return NextResponse.json({ error: "Game is not cancelled" }, { status: 400 });
  }
  if (!game.auto_cancelled) {
    return NextResponse.json(
      { error: "Only auto-cancelled games can be reinstated. Manually cancelled games would have to be recreated." },
      { status: 400 }
    );
  }

  // 14-day window from cancelled_at
  if (game.cancelled_at) {
    const cancelledAt = new Date(game.cancelled_at as string);
    const ageDays = (Date.now() - cancelledAt.getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays > REINSTATE_WINDOW_DAYS) {
      return NextResponse.json(
        { error: `Reinstate window expired (>${REINSTATE_WINDOW_DAYS} days since auto-cancel).` },
        { status: 400 }
      );
    }
  }

  const currentRound = (game.current_round as number) || 1;
  const restoredStatus = currentRound >= 2 ? "voting" : "selection";
  const roundMinutes = (game.time_between_rounds_minutes as number) || 120;
  const newRoundEnd = new Date(Date.now() + roundMinutes * 60 * 1000).toISOString();

  const { data: updated, error: updateErr } = await supabaseServer
    .from("group_games")
    .update({
      status: restoredStatus,
      round_end_time: newRoundEnd,
      selection_reminders_sent: 0,
      auto_cancelled: false,
      cancelled_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Notify all active players that the game is back. Reuses the existing
  // GROUP_ROUND_ENDED type since the message is structurally similar
  // ("game state changed, come check") — saves adding another type.
  const { data: players } = await supabaseServer
    .from("group_game_players")
    .select("user_id")
    .eq("game_id", id)
    .is("removed_at", null);

  const gameName = (game.name as string) || "your group game";
  for (const p of players ?? []) {
    if (p.user_id === user.id) continue; // skip the GM who just reinstated
    notify({
      userId: p.user_id as string,
      type: NOTIFICATION_TYPES.GROUP_ROUND_ENDED,
      title: "Group game reinstated",
      body: `"${gameName}" is back. The ${restoredStatus === "voting" ? "voting round" : "selection phase"} resumes — go finish it.`,
      metadata: { gameId: id, gameName, href: "/group" },
    });
  }

  return NextResponse.json({ game: updated });
}
