import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

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

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/group-games/[id]/votes
 * Submit votes for the current round.
 * Body: { businessIds: string[] }
 * Replaces any existing votes for this round (allows re-voting).
 */
export async function POST(req: NextRequest, ctx: RouteContext) {
  const user = await authenticate(req);
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = await req.json();
  const businessIds: string[] = Array.isArray(body.businessIds)
    ? body.businessIds.filter((bid: unknown) => typeof bid === "string" && bid.length > 0)
    : [];

  if (businessIds.length === 0) {
    return NextResponse.json({ error: "At least one businessId is required" }, { status: 400 });
  }

  // Verify player membership
  const { data: membership } = await supabaseServer
    .from("group_game_players")
    .select("role")
    .eq("game_id", id)
    .eq("user_id", user.id)
    .is("removed_at", null)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: "Not a member of this game" }, { status: 403 });
  }

  // Verify game is in voting phase
  const { data: game } = await supabaseServer
    .from("group_games")
    .select("status, current_round, advance_per_round")
    .eq("id", id)
    .single();

  if (!game || game.status !== "voting") {
    return NextResponse.json({ error: "Game is not in voting phase" }, { status: 400 });
  }

  const currentRound = game.current_round as number;
  const advancePerRound = game.advance_per_round as number[];

  // Validate vote count doesn't exceed the advance count for this round
  const advanceIdx = currentRound - 1;
  const maxVotes = advanceIdx < advancePerRound.length
    ? advancePerRound[advanceIdx]
    : advancePerRound[advancePerRound.length - 1] ?? 1;

  if (businessIds.length > maxVotes) {
    return NextResponse.json(
      { error: `You can select at most ${maxVotes} businesses this round` },
      { status: 400 }
    );
  }

  // Delete existing votes for this round (allows re-voting)
  await supabaseServer
    .from("group_game_votes")
    .delete()
    .eq("game_id", id)
    .eq("round", currentRound)
    .eq("voter_id", user.id);

  // Insert new votes
  const voteRows = businessIds.map((bid) => ({
    game_id: id,
    round: currentRound,
    business_id: bid,
    voter_id: user.id,
  }));

  const { error: insertErr } = await supabaseServer
    .from("group_game_votes")
    .insert(voteRows);

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, votedFor: businessIds });
}
