import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * GET /api/businesses/[businessId]/game-wins
 *
 * Returns game win stats for a specific business:
 * - 5v3v1 wins count + dates
 * - Group Vote wins count + dates
 * - Average group size across won group games
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
): Promise<Response> {
  try {
    const { businessId } = await params;

    // 5v3v1 wins
    const { data: fiveWins } = await supabaseServer
      .from("game_sessions")
      .select("id, completed_at")
      .eq("winner_business_id", businessId)
      .eq("status", "complete");

    // Group Vote wins (array contains)
    const { data: groupWins } = await supabaseServer
      .from("group_games")
      .select("id, completed_at")
      .contains("winner_business_ids", [businessId])
      .eq("status", "complete");

    const fiveArr = fiveWins || [];
    const groupArr = groupWins || [];

    // Avg group size for won group games
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

    return NextResponse.json({
      fiveThreeOne: fiveArr.length,
      groupVote: groupArr.length,
      total: fiveArr.length + groupArr.length,
      avgGroupSize,
      fiveThreeOneDates: fiveArr.map((g) => g.completed_at),
      groupVoteDates: groupArr.map((g) => g.completed_at),
    });
  } catch (err) {
    console.error("[game-wins] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
