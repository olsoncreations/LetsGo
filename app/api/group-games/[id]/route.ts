import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { DEFAULT_PRESET_BPS } from "@/lib/platformSettings";
import { notify } from "@/lib/notify";
import { resolveHoursFromColumns } from "@/lib/businessNormalize";
import { NOTIFICATION_TYPES } from "@/lib/notificationTypes";

// ─── Helper: authenticate request ───

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

// Helper: get all active player user IDs for a game (excluding a specific user)
async function getActivePlayerIds(gameId: string, excludeUserId?: string): Promise<string[]> {
  const { data: players } = await supabaseServer
    .from("group_game_players")
    .select("user_id")
    .eq("game_id", gameId)
    .is("removed_at", null);

  return (players ?? [])
    .map((p) => p.user_id as string)
    .filter((uid) => uid !== excludeUserId);
}

/**
 * GET /api/group-games/[id]
 * Full game detail: game + players + selections + vote tallies + myVotes
 */
export async function GET(req: NextRequest, ctx: RouteContext) {
  const user = await authenticate(req);
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id } = await ctx.params;

  // Verify user is a player
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

  const isGM = membership.role === "game_master";

  // Fetch game
  const { data: game, error: gameErr } = await supabaseServer
    .from("group_games")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (gameErr || !game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  // Fetch players with profiles
  const { data: players } = await supabaseServer
    .from("group_game_players")
    .select("id, user_id, role, joined_at, removed_at")
    .eq("game_id", id);

  const userIds = (players ?? []).map((p) => p.user_id as string);
  const { data: profiles } = await supabaseServer
    .from("profiles")
    .select("id, full_name, first_name, last_name, avatar_url")
    .in("id", userIds);

  const profileMap = new Map<string, { name: string; avatar: string | null }>();
  for (const p of profiles ?? []) {
    const first = (p.first_name as string) || "";
    const last = (p.last_name as string) || "";
    const full = (p.full_name as string) || "";
    let displayName = "Unknown";
    if (first && last) displayName = `${first} ${last[0].toUpperCase()}.`;
    else if (full && !full.includes("@")) {
      const parts = full.trim().split(/\s+/);
      displayName =
        parts.length >= 2
          ? `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`
          : parts[0];
    } else if (first) displayName = first;

    profileMap.set(p.id as string, {
      name: displayName,
      avatar: (p.avatar_url as string) || null,
    });
  }

  const enrichedPlayers = (players ?? []).map((p) => ({
    id: p.id,
    userId: p.user_id,
    role: p.role,
    joinedAt: p.joined_at,
    removedAt: p.removed_at,
    name: profileMap.get(p.user_id as string)?.name ?? "Unknown",
    avatar: profileMap.get(p.user_id as string)?.avatar ?? null,
  }));

  // Fetch selections with business info
  const { data: selections } = await supabaseServer
    .from("group_game_selections")
    .select("id, business_id, selected_by, created_at")
    .eq("game_id", id);

  const bizIds = new Set<string>();
  for (const s of selections ?? []) bizIds.add(s.business_id as string);

  let businessMap = new Map<string, { name: string; images: string[] }>();
  if (bizIds.size > 0) {
    const { data: businesses } = await supabaseServer
      .from("business")
      .select("id, public_business_name, business_name, config")
      .in("id", Array.from(bizIds));

    for (const b of businesses ?? []) {
      const config = (b.config as Record<string, unknown>) ?? {};
      const images = Array.isArray(config.images) ? (config.images as string[]).filter(Boolean) : [];
      businessMap.set(b.id as string, {
        name: ((b.public_business_name || b.business_name || "Unknown") as string),
        images,
      });
    }

    // Also try business_media for additional images
    const { data: media } = await supabaseServer
      .from("business_media")
      .select("business_id, bucket, path")
      .in("business_id", Array.from(bizIds))
      .order("sort_order", { ascending: true });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    for (const m of media ?? []) {
      const existing = businessMap.get(m.business_id as string);
      if (existing) {
        const url = `${supabaseUrl}/storage/v1/object/public/${m.bucket}/${m.path}`;
        if (!existing.images.includes(url)) {
          existing.images.push(url);
        }
      }
    }
  }

  // Per-player selection activity (before dedup, so we count all players)
  const selectorCounts = new Map<string, number>();
  for (const s of selections ?? []) {
    const uid = s.selected_by as string;
    selectorCounts.set(uid, (selectorCounts.get(uid) ?? 0) + 1);
  }
  const selectorsInfo = Array.from(selectorCounts.entries()).map(([userId, count]) => ({ userId, count }));

  // Total unique businesses across ALL players (for GM Lock In check)
  const allBizIds = new Set<string>();
  for (const s of selections ?? []) allBizIds.add(s.business_id as string);
  const totalUniqueSelections = allBizIds.size;

  // Selection phase: return only current user's picks (private pools)
  // Voting/complete phase: merge all players' picks, deduplicate by business
  const enrichFunc = (list: typeof selections) =>
    (list ?? []).map((s) => ({
      id: s.id,
      businessId: s.business_id,
      selectedBy: s.selected_by,
      createdAt: s.created_at,
      businessName: businessMap.get(s.business_id as string)?.name ?? "Unknown",
      businessImage: businessMap.get(s.business_id as string)?.images?.[0] ?? null,
      businessImages: businessMap.get(s.business_id as string)?.images ?? [],
      selectedByName: profileMap.get(s.selected_by as string)?.name ?? "Unknown",
    }));

  let enrichedSelections;
  if (game.status === "selection") {
    // Private pool: only this user's selections
    const mySelections = (selections ?? []).filter((s) => s.selected_by === user.id);
    enrichedSelections = enrichFunc(mySelections);
  } else {
    // Merged pool: deduplicate by business_id
    const seenBizIds = new Set<string>();
    const uniqueSelections: typeof selections = [];
    for (const s of selections ?? []) {
      const bid = s.business_id as string;
      if (!seenBizIds.has(bid)) {
        seenBizIds.add(bid);
        uniqueSelections.push(s);
      }
    }
    enrichedSelections = enrichFunc(uniqueSelections);
  }

  // Fetch votes for current round
  const currentRound = game.current_round as number;
  const { data: votes } = await supabaseServer
    .from("group_game_votes")
    .select("id, business_id, voter_id, round")
    .eq("game_id", id)
    .eq("round", currentRound);

  // Tally votes per business + track who has voted
  const voteTally = new Map<string, number>();
  const myVotes: string[] = [];
  const voterIds = new Set<string>();
  for (const v of votes ?? []) {
    const bid = v.business_id as string;
    voteTally.set(bid, (voteTally.get(bid) ?? 0) + 1);
    voterIds.add(v.voter_id as string);
    if (v.voter_id === user.id) myVotes.push(bid);
  }

  // Respect votes_hidden: only show tallies if game is complete, round finished, or user is GM
  const showTallies =
    isGM ||
    game.status === "complete" ||
    game.status === "cancelled";

  const tallyArray = showTallies
    ? Array.from(voteTally.entries()).map(([businessId, count]) => ({
        businessId,
        businessName: businessMap.get(businessId)?.name ?? "Unknown",
        votes: count,
      }))
    : [];

  // Enrich winner business details (full info for winner page)
  const winnerBizIds = (game.winner_business_ids as string[]) ?? [];
  let winnersEnriched: {
    businessId: string; businessName: string; businessImage: string | null;
    businessImages: string[];
    address: string; phone: string; website: string; priceLevel: string;
    blurb: string; tags: string[]; hours: Record<string, string>;
    businessType: string; payout: number[];
  }[] = [];

  if (winnerBizIds.length > 0) {
    const [{ data: winnerRows }, { data: tierRows }] = await Promise.all([
      supabaseServer
        .from("business")
        .select("id, public_business_name, business_name, config, street_address, address_line1, city, state, zip, contact_phone, phone_number, website, website_url, blurb, category_main, payout_preset, mon_open, mon_close, tue_open, tue_close, wed_open, wed_close, thu_open, thu_close, fri_open, fri_close, sat_open, sat_close, sun_open, sun_close")
        .in("id", winnerBizIds),
      supabaseServer
        .from("business_payout_tiers")
        .select("business_id, percent_bps, tier_index")
        .in("business_id", winnerBizIds)
        .order("tier_index", { ascending: true }),
    ]);

    // Group payout tiers by business_id
    const tierMap = new Map<string, number[]>();
    for (const t of (tierRows ?? []) as { business_id: string; percent_bps: number }[]) {
      if (!tierMap.has(t.business_id)) tierMap.set(t.business_id, []);
      tierMap.get(t.business_id)!.push(Number(t.percent_bps) || 0);
    }
    const PRESET_BPS = DEFAULT_PRESET_BPS;

    winnersEnriched = winnerBizIds.map((bid) => {
      const row = (winnerRows ?? []).find((r) => r.id === bid);
      if (!row) {
        return {
          businessId: bid, businessName: businessMap.get(bid)?.name ?? "Unknown",
          businessImage: businessMap.get(bid)?.images?.[0] ?? null,
          businessImages: businessMap.get(bid)?.images ?? [],
          address: "", phone: "", website: "", priceLevel: "", blurb: "",
          tags: [], hours: {}, businessType: "", payout: [5, 7.5, 10, 12.5, 15, 17.5, 20],
        };
      }
      const cfg = (row.config as Record<string, unknown>) ?? {};
      const street = (row.street_address || row.address_line1 || "") as string;
      const city = (row.city || "") as string;
      const st = (row.state || "") as string;
      const zip = (row.zip || "") as string;
      const addressParts = [street, city, [st, zip].filter(Boolean).join(" ")].filter(Boolean);

      // Parse hours from individual day columns (single source of truth)
      const hoursMap = resolveHoursFromColumns(row as Record<string, unknown>);

      // Compute payout percentages from business_payout_tiers table (source of truth)
      let bpsValues = tierMap.get(bid) || [];
      if (bpsValues.length === 0) {
        const bizPreset = String(row.payout_preset || "standard");
        bpsValues = PRESET_BPS[bizPreset] || PRESET_BPS.standard;
      }
      const payoutPercents = bpsValues.slice(0, 7).map((bps) => Math.round(bps) / 100);

      return {
        businessId: bid,
        businessName: ((row.public_business_name || row.business_name || "Unknown") as string),
        businessImage: businessMap.get(bid)?.images?.[0] ?? null,
        businessImages: businessMap.get(bid)?.images ?? [],
        address: addressParts.join(", "),
        phone: ((row.contact_phone || row.phone_number || "") as string),
        website: ((row.website || row.website_url || "") as string),
        priceLevel: (cfg.priceLevel as string) || "",
        blurb: ((row.blurb as string) || (cfg.blurb as string) || (cfg.description as string) || ""),
        tags: Array.isArray(cfg.tags) ? (cfg.tags as string[]) : [],
        hours: hoursMap,
        businessType: ((cfg.businessType as string) || (row.category_main as string) || ""),
        payout: payoutPercents,
      };
    });
  }

  return NextResponse.json({
    game: {
      ...game,
      players: enrichedPlayers,
      selections: enrichedSelections,
      voteTally: tallyArray,
      myVotesThisRound: myVotes,
      myRole: membership.role,
      activePlayerCount: enrichedPlayers.filter((p) => !p.removedAt).length,
      selectorsInfo,
      votersThisRound: Array.from(voterIds),
      totalUniqueSelections,
      winnersEnriched,
    },
  });
}

/**
 * PATCH /api/group-games/[id]
 * Actions: advance_round, update_settings, start_voting
 * GM only.
 */
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const user = await authenticate(req);
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id } = await ctx.params;

  // Verify GM
  const { data: membership } = await supabaseServer
    .from("group_game_players")
    .select("role")
    .eq("game_id", id)
    .eq("user_id", user.id)
    .is("removed_at", null)
    .maybeSingle();

  if (!membership || membership.role !== "game_master") {
    return NextResponse.json({ error: "Only the Game Master can perform this action" }, { status: 403 });
  }

  const body = await req.json();
  const action = String(body.action || "");

  // ─── Start voting (transition from selection → voting round 2) ───
  if (action === "start_voting") {
    const { data: game } = await supabaseServer
      .from("group_games")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!game || game.status !== "selection") {
      return NextResponse.json({ error: "Game is not in selection phase" }, { status: 400 });
    }

    // Count unique businesses selected
    const { data: selections } = await supabaseServer
      .from("group_game_selections")
      .select("business_id")
      .eq("game_id", id);

    const uniqueBiz = new Set((selections ?? []).map((s) => s.business_id as string));
    if (uniqueBiz.size < 2) {
      return NextResponse.json({ error: "Need at least 2 businesses selected to start voting" }, { status: 400 });
    }

    // Calculate round end time
    const roundMinutes = game.time_between_rounds_minutes as number;
    const roundEndTime = new Date(Date.now() + roundMinutes * 60 * 1000).toISOString();

    const { data: updated, error: updateErr } = await supabaseServer
      .from("group_games")
      .update({
        status: "voting",
        current_round: 2,
        round_end_time: roundEndTime,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Notify all players that voting has started
    const votingPlayerIds = await getActivePlayerIds(id, user.id);
    const gameName = (game.name as string) || "your group game";
    for (const pid of votingPlayerIds) {
      notify({
        userId: pid,
        type: NOTIFICATION_TYPES.GROUP_ROUND_ENDED,
        title: "Voting Started!",
        body: `Selections are locked in for "${gameName}". Cast your votes!`,
        metadata: { gameId: id, gameName, round: 2, href: "/group" },
      });
    }

    return NextResponse.json({ game: updated });
  }

  // ─── Advance round (tally votes, eliminate, next round or finish) ───
  if (action === "advance_round") {
    const { data: game } = await supabaseServer
      .from("group_games")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!game || game.status !== "voting") {
      return NextResponse.json({ error: "Game is not in voting phase" }, { status: 400 });
    }

    const currentRound = game.current_round as number;
    const totalRounds = game.total_rounds as number;
    const advancePerRound = game.advance_per_round as number[];

    // Get current round's advance count (how many survive this round)
    // advancePerRound[0] = after round 1 (selection), [1] = after round 2, etc.
    const advanceIdx = currentRound - 1; // round 2 → index 1
    const advanceCount = advanceIdx < advancePerRound.length
      ? advancePerRound[advanceIdx]
      : 1;

    // Tally votes for current round
    const { data: votes } = await supabaseServer
      .from("group_game_votes")
      .select("business_id")
      .eq("game_id", id)
      .eq("round", currentRound);

    const tally = new Map<string, number>();
    for (const v of votes ?? []) {
      const bid = v.business_id as string;
      tally.set(bid, (tally.get(bid) ?? 0) + 1);
    }

    // Sort by votes (descending), take top N
    const sorted = Array.from(tally.entries()).sort((a, b) => b[1] - a[1]);
    const survivors = sorted.slice(0, advanceCount).map(([bid]) => bid);

    // Check if this was the final round
    const isFinal = currentRound >= totalRounds;

    if (isFinal || survivors.length <= 1) {
      // Game complete — set winners
      const winners = survivors.length > 0 ? survivors : (sorted[0] ? [sorted[0][0]] : []);

      const { data: updated, error: updateErr } = await supabaseServer
        .from("group_games")
        .update({
          status: "complete",
          winner_business_ids: winners,
          round_end_time: null,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("*")
        .maybeSingle();

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }

      // Notify all players that the game is complete
      const completePlayerIds = await getActivePlayerIds(id);
      const completeGameName = (game.name as string) || "your group game";

      // Look up winner business name
      let winnerName = "the winner";
      if (winners.length > 0) {
        const { data: winBiz } = await supabaseServer
          .from("business")
          .select("public_business_name, business_name")
          .eq("id", winners[0])
          .maybeSingle();
        if (winBiz) winnerName = ((winBiz.public_business_name || winBiz.business_name) as string) || "the winner";
      }

      for (const pid of completePlayerIds) {
        notify({
          userId: pid,
          type: NOTIFICATION_TYPES.GAME_COMPLETE,
          title: "We Have a Winner!",
          body: `"${completeGameName}" is done — you're going to ${winnerName}!`,
          metadata: { gameId: id, gameName: completeGameName, winnerBusinessIds: winners, businessName: winnerName, href: "/group" },
        });
      }

      return NextResponse.json({ game: updated, winners });
    }

    // Not final — advance to next round
    // Remove selections for eliminated businesses
    const eliminatedBiz = sorted
      .slice(advanceCount)
      .map(([bid]) => bid);

    if (eliminatedBiz.length > 0) {
      await supabaseServer
        .from("group_game_selections")
        .delete()
        .eq("game_id", id)
        .in("business_id", eliminatedBiz);
    }

    const roundMinutes = game.time_between_rounds_minutes as number;
    const roundEndTime = new Date(Date.now() + roundMinutes * 60 * 1000).toISOString();

    const { data: updated, error: updateErr } = await supabaseServer
      .from("group_games")
      .update({
        current_round: currentRound + 1,
        round_end_time: roundEndTime,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Notify all players that the round advanced
    const roundPlayerIds = await getActivePlayerIds(id, user.id);
    const roundGameName = (game.name as string) || "your group game";
    const nextRound = currentRound + 1;
    for (const pid of roundPlayerIds) {
      notify({
        userId: pid,
        type: NOTIFICATION_TYPES.GROUP_ROUND_ENDED,
        title: `Round ${currentRound} Complete!`,
        body: `${survivors.length} places left in "${roundGameName}". Vote in round ${nextRound}!`,
        metadata: { gameId: id, gameName: roundGameName, round: nextRound, survivors: survivors.length, href: "/group" },
      });
    }

    return NextResponse.json({ game: updated, survivors, eliminated: eliminatedBiz });
  }

  // ─── Update settings ───
  if (action === "update_settings") {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof body.name === "string") updates.name = body.name.trim();
    if (typeof body.votesHidden === "boolean") updates.votes_hidden = body.votesHidden;
    if (typeof body.allowInvites === "boolean") updates.allow_invites = body.allowInvites;

    const { data: updated, error: updateErr } = await supabaseServer
      .from("group_games")
      .update(updates)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ game: updated });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

/**
 * DELETE /api/group-games/[id]
 * Cancel game (GM only). Sets status to 'cancelled'.
 */
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const user = await authenticate(req);
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id } = await ctx.params;

  // Verify GM
  const { data: membership } = await supabaseServer
    .from("group_game_players")
    .select("role")
    .eq("game_id", id)
    .eq("user_id", user.id)
    .is("removed_at", null)
    .maybeSingle();

  if (!membership || membership.role !== "game_master") {
    return NextResponse.json({ error: "Only the Game Master can cancel the game" }, { status: 403 });
  }

  const { error: updateErr } = await supabaseServer
    .from("group_games")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
