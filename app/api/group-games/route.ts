import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { notify } from "@/lib/notify";
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

// ─── Game code generation (GV-XXXX) ───

function generateGameCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0, 1
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `GV-${code}`;
}

// ─── Helper: parse time string to minutes ───

function parseTimeToMinutes(time: string): number {
  const val = parseInt(time, 10);
  if (time.includes("h")) return val * 60;
  if (time.includes("d")) return val * 1440;
  return val; // assume minutes
}

/**
 * POST /api/group-games
 * Create a new group voting game.
 * Body: { name, location, totalRounds, advancePerRound, timeBetweenRounds,
 *         votesHidden, allowInvites, startDate?, endDate?, invitedFriendIds? }
 */
export async function POST(req: NextRequest) {
  const user = await authenticate(req);
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = await req.json();
  const name = String(body.name || "").trim();
  const location = String(body.location || "").trim();
  const totalRounds = Math.min(5, Math.max(2, Number(body.totalRounds) || 3));
  const advancePerRound: number[] = Array.isArray(body.advancePerRound)
    ? body.advancePerRound.map((n: unknown) => Number(n) || 1)
    : [7, 3, 1];
  const timeBetweenRounds =
    typeof body.timeBetweenRounds === "string"
      ? parseTimeToMinutes(body.timeBetweenRounds)
      : Number(body.timeBetweenRounds) || 120;
  const votesHidden = Boolean(body.votesHidden);
  const allowInvites = body.allowInvites !== false; // default true
  const startDate = body.startDate ? String(body.startDate) : null;
  const endDate = body.endDate ? String(body.endDate) : null;
  const invitedFriendIds: string[] = Array.isArray(body.invitedFriendIds)
    ? body.invitedFriendIds.filter((id: unknown) => typeof id === "string" && id.length > 0)
    : [];

  if (!name) {
    return NextResponse.json({ error: "Game name is required" }, { status: 400 });
  }

  // Generate unique game code (retry on collision)
  let gameCode = generateGameCode();
  let attempts = 0;
  while (attempts < 5) {
    const { data: existing } = await supabaseServer
      .from("group_games")
      .select("id")
      .eq("game_code", gameCode)
      .maybeSingle();

    if (!existing) break;
    gameCode = generateGameCode();
    attempts++;
  }

  // Set the initial selection-phase deadline so the CountdownBadge has
  // something to render from the start AND the cron tick can auto-advance
  // (or remind, or auto-cancel) when the timer expires.
  const initialRoundEndTime = new Date(Date.now() + timeBetweenRounds * 60 * 1000).toISOString();

  // Insert the game
  const { data: game, error: insertErr } = await supabaseServer
    .from("group_games")
    .insert({
      game_code: gameCode,
      name,
      location,
      created_by: user.id,
      status: "selection",
      current_round: 1,
      total_rounds: totalRounds,
      advance_per_round: advancePerRound,
      time_between_rounds_minutes: timeBetweenRounds,
      round_end_time: initialRoundEndTime,
      votes_hidden: votesHidden,
      allow_invites: allowInvites,
      start_date: startDate,
      end_date: endDate,
    })
    .select("*")
    .single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  // Add creator as game_master
  const { error: gmErr } = await supabaseServer.from("group_game_players").insert({
    game_id: game.id,
    user_id: user.id,
    role: "game_master",
  });
  if (gmErr) {
    console.error("[group-games] Failed to add game master:", gmErr.message);
  }

  // Add invited friends as players
  if (invitedFriendIds.length > 0) {
    // Verify they are accepted friends
    const { data: friendships } = await supabaseServer
      .from("user_friends")
      .select("user_id, friend_id")
      .or(
        invitedFriendIds
          .map(
            (fid) =>
              `and(user_id.eq.${user.id},friend_id.eq.${fid}),and(user_id.eq.${fid},friend_id.eq.${user.id})`
          )
          .join(",")
      )
      .eq("status", "accepted");

    const validFriendIds = new Set<string>();
    for (const f of friendships ?? []) {
      const otherId = f.user_id === user.id ? f.friend_id : f.user_id;
      validFriendIds.add(otherId as string);
    }

    if (validFriendIds.size > 0) {
      const playerRows = Array.from(validFriendIds).map((fid) => ({
        game_id: game.id,
        user_id: fid,
        role: "player" as const,
      }));
      const { error: playersErr } = await supabaseServer.from("group_game_players").insert(playerRows);
      if (playersErr) {
        console.error("[group-games] Failed to add invited players:", playersErr.message);
      }

      // Notify each invited friend
      const { data: creatorProfile } = await supabaseServer
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", user.id)
        .maybeSingle();

      const creatorName = creatorProfile?.first_name
        ? `${creatorProfile.first_name} ${((creatorProfile.last_name as string) || "")[0] || ""}`.trim()
        : "A friend";

      for (const fid of validFriendIds) {
        notify({
          userId: fid,
          type: NOTIFICATION_TYPES.GAME_INVITE,
          title: "Group Vote Invite!",
          body: `${creatorName} invited you to "${name}". Add your picks!`,
          metadata: { gameId: game.id, gameCode, gameName: name, invitedBy: user.id, href: "/group" },
        });
      }
    }
  }

  return NextResponse.json({ game, gameCode }, { status: 201 });
}

/**
 * GET /api/group-games
 * List group games for the current user.
 * Query params: ?status=active|complete (optional)
 */
export async function GET(req: NextRequest) {
  const user = await authenticate(req);
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status");

  // Find all game IDs the user is a player in
  const { data: memberships, error: memberErr } = await supabaseServer
    .from("group_game_players")
    .select("game_id")
    .eq("user_id", user.id)
    .is("removed_at", null);

  if (memberErr) {
    return NextResponse.json({ error: memberErr.message }, { status: 500 });
  }

  const gameIds = (memberships ?? []).map((m) => m.game_id as string);
  if (gameIds.length === 0) {
    return NextResponse.json({ games: [] });
  }

  // Fetch games
  let query = supabaseServer
    .from("group_games")
    .select("*")
    .in("id", gameIds)
    .order("created_at", { ascending: false })
    .limit(50);

  if (statusFilter === "active") {
    query = query.in("status", ["selection", "voting"]);
  } else if (statusFilter === "complete") {
    query = query.in("status", ["complete", "cancelled"]);
  }

  const { data: games, error: gamesErr } = await query;

  if (gamesErr) {
    return NextResponse.json({ error: gamesErr.message }, { status: 500 });
  }

  const rows = games ?? [];
  if (rows.length === 0) {
    return NextResponse.json({ games: [] });
  }

  // Fetch all players for these games (for player counts + names)
  const { data: allPlayers } = await supabaseServer
    .from("group_game_players")
    .select("game_id, user_id, role, removed_at")
    .in("game_id", gameIds);

  // Collect unique user IDs for profile lookup
  const userIds = new Set<string>();
  for (const p of allPlayers ?? []) {
    userIds.add(p.user_id as string);
  }

  // Fetch profiles
  const { data: profiles } = await supabaseServer
    .from("profiles")
    .select("id, full_name, first_name, last_name, avatar_url")
    .in("id", Array.from(userIds));

  const profileMap = new Map<string, { name: string; avatar: string | null }>();
  for (const p of profiles ?? []) {
    const first = (p.first_name as string) || "";
    const last = (p.last_name as string) || "";
    const full = (p.full_name as string) || "";
    let displayName = "Unknown";
    if (first && last) displayName = `${first} ${last[0].toUpperCase()}.`;
    else if (full && !full.includes("@")) {
      const parts = full.trim().split(/\s+/);
      displayName = parts.length >= 2
        ? `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`
        : parts[0];
    } else if (first) displayName = first;

    profileMap.set(p.id as string, {
      name: displayName,
      avatar: (p.avatar_url as string) || null,
    });
  }

  // Fetch winner business names
  const winnerBizIds = new Set<string>();
  for (const g of rows) {
    const winners = g.winner_business_ids as string[] | null;
    if (winners) {
      for (const bid of winners) winnerBizIds.add(bid);
    }
  }

  const businessNameMap = new Map<string, string>();
  if (winnerBizIds.size > 0) {
    const { data: businesses } = await supabaseServer
      .from("business")
      .select("id, public_business_name, business_name")
      .in("id", Array.from(winnerBizIds));

    for (const b of businesses ?? []) {
      businessNameMap.set(
        b.id as string,
        ((b.public_business_name || b.business_name || "Unknown") as string)
      );
    }
  }

  // Build enriched response
  const enrichedGames = rows.map((g) => {
    const gamePlayers = (allPlayers ?? []).filter(
      (p) => p.game_id === g.id && !p.removed_at
    );
    const playerList = gamePlayers.map((p) => ({
      userId: p.user_id,
      role: p.role,
      name: profileMap.get(p.user_id as string)?.name ?? "Unknown",
      avatar: profileMap.get(p.user_id as string)?.avatar ?? null,
    }));

    const winnerNames = ((g.winner_business_ids as string[]) ?? []).map(
      (bid) => businessNameMap.get(bid) ?? "Unknown"
    );

    return {
      ...g,
      players: playerList,
      playerCount: gamePlayers.length,
      winnerBusinessNames: winnerNames,
    };
  });

  return NextResponse.json({ games: enrichedGames });
}
