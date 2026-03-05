import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * GET /api/admin/game-stats
 *
 * Returns platform-wide game engagement stats:
 * - Total completed 5v3v1 and Group Vote games
 * - Unique winning businesses + top 5 by win count
 * - Average group size across all completed group games
 * - Games completed by month
 */
export async function GET(req: NextRequest): Promise<Response> {
  // Require staff authentication
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: { user }, error: authErr } = await supabaseServer.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: staff } = await supabaseServer.from("staff_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!staff) return NextResponse.json({ error: "Staff access required" }, { status: 403 });

  try {
    // 5v3v1 completed games
    const { data: fiveGames } = await supabaseServer
      .from("game_sessions")
      .select("id, winner_business_id, completed_at")
      .eq("status", "complete");

    // Group Vote completed games
    const { data: groupGames } = await supabaseServer
      .from("group_games")
      .select("id, winner_business_ids, completed_at")
      .eq("status", "complete");

    const fiveArr = fiveGames || [];
    const groupArr = groupGames || [];

    // Avg group size across ALL completed group games
    let avgGroupSize = 0;
    if (groupArr.length > 0) {
      const gameIds = groupArr.map((g) => g.id);
      const { data: players } = await supabaseServer
        .from("group_game_players")
        .select("game_id")
        .in("game_id", gameIds)
        .is("removed_at", null);

      if (players && players.length > 0) {
        const perGame = new Map<string, number>();
        for (const p of players) {
          perGame.set(p.game_id as string, (perGame.get(p.game_id as string) || 0) + 1);
        }
        const sizes = Array.from(perGame.values());
        avgGroupSize = Math.round((sizes.reduce((a, b) => a + b, 0) / sizes.length) * 10) / 10;
      }
    }

    // Win counts per business
    const winCounts = new Map<string, number>();
    for (const g of fiveArr) {
      if (g.winner_business_id) {
        winCounts.set(g.winner_business_id as string, (winCounts.get(g.winner_business_id as string) || 0) + 1);
      }
    }
    for (const g of groupArr) {
      const winners = g.winner_business_ids as string[] | null;
      if (winners) {
        for (const bid of winners) winCounts.set(bid, (winCounts.get(bid) || 0) + 1);
      }
    }

    // Top 5 winning businesses with names
    const sorted = Array.from(winCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
    let topBusinesses: { id: string; name: string; wins: number }[] = [];
    if (sorted.length > 0) {
      const ids = sorted.map(([id]) => id);
      const { data: bizNames } = await supabaseServer
        .from("business")
        .select("id, public_business_name, business_name")
        .in("id", ids);

      const nameMap = new Map<string, string>();
      for (const b of bizNames || []) {
        nameMap.set(b.id as string, ((b.public_business_name || b.business_name || "Unknown") as string));
      }
      topBusinesses = sorted.map(([id, wins]) => ({ id, name: nameMap.get(id) || "Unknown", wins }));
    }

    // Games by month
    const monthMap = new Map<string, { fiveThreeOne: number; groupVote: number }>();
    for (const g of fiveArr) {
      if (!g.completed_at) continue;
      const m = new Date(g.completed_at as string).toLocaleDateString("en-US", { month: "short" });
      const ex = monthMap.get(m) || { fiveThreeOne: 0, groupVote: 0 };
      ex.fiveThreeOne++;
      monthMap.set(m, ex);
    }
    for (const g of groupArr) {
      if (!g.completed_at) continue;
      const m = new Date(g.completed_at as string).toLocaleDateString("en-US", { month: "short" });
      const ex = monthMap.get(m) || { fiveThreeOne: 0, groupVote: 0 };
      ex.groupVote++;
      monthMap.set(m, ex);
    }

    return NextResponse.json({
      total5v3v1Games: fiveArr.length,
      totalGroupGames: groupArr.length,
      totalGamesCompleted: fiveArr.length + groupArr.length,
      uniqueWinningBusinesses: winCounts.size,
      avgGroupSize,
      topBusinesses,
      gamesByMonth: Array.from(monthMap.entries()).slice(-6).map(([label, d]) => ({ label, ...d })),
    });
  } catch (err) {
    console.error("[game-stats] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
