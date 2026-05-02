import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { notify } from "@/lib/notify";
import { NOTIFICATION_TYPES } from "@/lib/notificationTypes";

/**
 * GET /api/cron/group-game-tick
 *
 * Vercel cron (every 5 minutes) that drives the group game life cycle when
 * humans aren't actively pushing it forward:
 *
 *   1. Selection phase, timer expired, ≥ 2 unique businesses suggested
 *      → auto-advance to voting (mirrors GM "start_voting" action), notify
 *        all players.
 *
 *   2. Selection phase, timer expired, < 2 unique businesses suggested,
 *      reminders_sent < 3
 *      → push GROUP_SELECTION_REMINDER to players who haven't suggested
 *        anything yet, bump round_end_time +30 min, increment counter.
 *
 *   3. Selection phase, timer expired, reminders_sent ≥ 3, current
 *      round_end_time still in the past, GM hasn't been told yet
 *      → push GROUP_GAME_STUCK to GM (one-shot signal that nothing's
 *        moving). Game keeps waiting up to 24h before auto-cancel.
 *
 *   4. Any active phase, round_end_time more than 24 hours in the past
 *      → auto-cancel: status='cancelled', auto_cancelled=true,
 *        cancelled_at=now. Notify GM with reinstate context. Selections /
 *        votes are preserved so reinstate restores progress.
 *
 * Voting rounds are NOT auto-advanced on timer expiry — the existing
 * vote-submission endpoint already advances when all players vote.
 * Voting rounds DO get auto-cancelled at the 24h mark.
 *
 * Protected by CRON_SECRET header.
 */

const REMINDER_BUMP_MINUTES = 30;
const REMINDER_CAP = 3;
const AUTO_CANCEL_HOURS = 24;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const authHeader = req.headers.get("authorization") ?? "";
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const nowIso = now.toISOString();

  const summary = {
    advanced: 0,
    reminded: 0,
    stuckNotified: 0,
    autoCancelled: 0,
    errors: [] as string[],
  };

  try {
    // ── 1. Find every active game with an expired round_end_time ──
    const { data: overdueGames, error: queryErr } = await supabaseServer
      .from("group_games")
      .select("id, name, status, current_round, round_end_time, time_between_rounds_minutes, advance_per_round, selection_reminders_sent, created_by")
      .in("status", ["selection", "voting"])
      .lte("round_end_time", nowIso);

    if (queryErr) {
      return NextResponse.json({ error: queryErr.message }, { status: 500 });
    }

    for (const game of overdueGames ?? []) {
      try {
        const gameId = game.id as string;
        const gameName = (game.name as string) || "your group game";
        const status = game.status as string;
        const roundEnd = new Date(game.round_end_time as string);
        const hoursOverdue = (now.getTime() - roundEnd.getTime()) / (60 * 60 * 1000);
        const remindersSent = (game.selection_reminders_sent as number) ?? 0;
        const createdBy = game.created_by as string;

        // ── 4. Auto-cancel for any phase stuck >= 24 hours ──
        if (hoursOverdue >= AUTO_CANCEL_HOURS) {
          await supabaseServer
            .from("group_games")
            .update({
              status: "cancelled",
              auto_cancelled: true,
              cancelled_at: nowIso,
              updated_at: nowIso,
            })
            .eq("id", gameId);

          // Notify the GM with a reinstate-aware message
          notify({
            userId: createdBy,
            type: NOTIFICATION_TYPES.GROUP_GAME_AUTO_CANCELLED,
            title: "Group game auto-cancelled",
            body: `"${gameName}" was cancelled after 24 hours of inactivity. You can reinstate it from the group games hub.`,
            metadata: { gameId, gameName, href: "/group" },
          });
          summary.autoCancelled++;
          continue;
        }

        // ── Selection phase logic ──
        if (status === "selection") {
          const { data: selections } = await supabaseServer
            .from("group_game_selections")
            .select("business_id")
            .eq("game_id", gameId);

          const uniqueBiz = new Set((selections ?? []).map(s => s.business_id as string));

          // 1. ≥ 2 unique businesses → auto-advance to voting
          if (uniqueBiz.size >= 2) {
            const roundMinutes = (game.time_between_rounds_minutes as number) || 120;
            const newRoundEnd = new Date(now.getTime() + roundMinutes * 60 * 1000).toISOString();

            await supabaseServer
              .from("group_games")
              .update({
                status: "voting",
                current_round: 2,
                round_end_time: newRoundEnd,
                selection_reminders_sent: 0,
                updated_at: nowIso,
              })
              .eq("id", gameId);

            // Notify every active player that voting started
            const playerIds = await getActivePlayerIds(gameId);
            for (const pid of playerIds) {
              notify({
                userId: pid,
                type: NOTIFICATION_TYPES.GROUP_ROUND_ENDED,
                title: "Voting Started!",
                body: `Time's up — "${gameName}" advanced to voting. Cast your votes!`,
                metadata: { gameId, gameName, round: 2, href: "/group" },
              });
            }
            summary.advanced++;
            continue;
          }

          // 2. < 2 selections, reminders_sent < cap → reminder + bump
          if (remindersSent < REMINDER_CAP) {
            const newRoundEnd = new Date(now.getTime() + REMINDER_BUMP_MINUTES * 60 * 1000).toISOString();
            await supabaseServer
              .from("group_games")
              .update({
                round_end_time: newRoundEnd,
                selection_reminders_sent: remindersSent + 1,
                updated_at: nowIso,
              })
              .eq("id", gameId);

            // Push to players who haven't suggested anything yet. The GM
            // counts as a player too — if they haven't suggested, they get
            // pinged like everyone else.
            const allPlayers = await getActivePlayerIds(gameId);
            const suggesterIds = new Set(
              (
                await supabaseServer
                  .from("group_game_selections")
                  .select("user_id")
                  .eq("game_id", gameId)
              ).data?.map(s => s.user_id as string) ?? []
            );
            const nonSuggesters = allPlayers.filter(uid => !suggesterIds.has(uid));
            for (const pid of nonSuggesters) {
              notify({
                userId: pid,
                type: NOTIFICATION_TYPES.GROUP_SELECTION_REMINDER,
                title: "Your group is waiting on you",
                body: `"${gameName}" needs more suggestions to start voting. Tap to add some.`,
                metadata: { gameId, gameName, href: "/group" },
              });
            }
            summary.reminded += nonSuggesters.length;
            continue;
          }

          // 3. Reminders capped, still < 2, but not yet at the 24h cancel
          //    line → notify GM once that the game is stalled. We use the
          //    update timestamp as a one-shot guard: if reminders_sent ==
          //    REMINDER_CAP and we're past round_end_time, we've already
          //    bumped the counter to cap on the previous tick — fire the
          //    GM stuck push now and bump counter once more so this branch
          //    only runs a single time per game.
          if (remindersSent === REMINDER_CAP) {
            await supabaseServer
              .from("group_games")
              .update({
                selection_reminders_sent: REMINDER_CAP + 1,
                updated_at: nowIso,
              })
              .eq("id", gameId);
            notify({
              userId: createdBy,
              type: NOTIFICATION_TYPES.GROUP_GAME_STUCK,
              title: "Your group game is stalled",
              body: `"${gameName}" doesn't have enough suggestions to start voting. It will auto-cancel in 24 hours unless someone adds more.`,
              metadata: { gameId, gameName, href: "/group" },
            });
            summary.stuckNotified++;
            continue;
          }

          // 4. Reminders capped + GM notified → idle until 24h auto-cancel
          //    is hit on a future tick. No-op here.
        }

        // Voting phase: leave it alone. The vote-submission flow advances
        // automatically when all active players have voted; a stuck voting
        // round just rides out the 24h window above.
      } catch (perGameErr) {
        const gameId = (game.id as string) ?? "unknown";
        const msg = perGameErr instanceof Error ? perGameErr.message : "unknown";
        summary.errors.push(`game ${gameId}: ${msg}`);
      }
    }

    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("[cron/group-game-tick] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

async function getActivePlayerIds(gameId: string): Promise<string[]> {
  const { data: players } = await supabaseServer
    .from("group_game_players")
    .select("user_id")
    .eq("game_id", gameId)
    .is("removed_at", null);

  return (players ?? []).map(p => p.user_id as string);
}
