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

// ─── Game code generation (alphanumeric, avoids confusing chars) ───

function generateGameCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0, 1
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `LG-${code}`;
}

/**
 * POST /api/games
 * Create a new game session.
 * Body: { gameType?: string, category?: string, filters?: object, friendId?: string }
 */
export async function POST(req: NextRequest) {
  const user = await authenticate(req);
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = await req.json();
  const gameType = String(body.gameType || "5v3v1");
  const category = body.category ? String(body.category) : null;
  const filters = body.filters ?? {};
  const friendId = body.friendId ? String(body.friendId).trim() : null;

  if (!["5v3v1", "group", "datenight"].includes(gameType)) {
    return NextResponse.json({ error: "Invalid game type" }, { status: 400 });
  }

  // If friendId provided, verify they're an accepted friend
  let player2Id: string | null = null;
  if (friendId) {
    const { data: friendship } = await supabaseServer
      .from("user_friends")
      .select("id")
      .or(
        `and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id})`
      )
      .eq("status", "accepted")
      .maybeSingle();

    if (friendship) {
      player2Id = friendId;
    }
    // If not friends, still create game — they can join via link
  }

  // Generate unique game code (retry on collision)
  let gameCode = generateGameCode();
  let attempts = 0;
  while (attempts < 5) {
    const { data: existing } = await supabaseServer
      .from("game_sessions")
      .select("id")
      .eq("game_code", gameCode)
      .maybeSingle();

    if (!existing) break;
    gameCode = generateGameCode();
    attempts++;
  }

  const { data: session, error: insertErr } = await supabaseServer
    .from("game_sessions")
    .insert({
      game_code: gameCode,
      game_type: gameType,
      player1_id: user.id,
      player2_id: player2Id,
      status: player2Id ? "pick5" : "pending",
      category,
      filters,
    })
    .select("*")
    .single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  // Notify invited friend
  if (player2Id) {
    const { data: creatorProfile } = await supabaseServer
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", user.id)
      .maybeSingle();

    const creatorName = creatorProfile?.first_name
      ? `${creatorProfile.first_name} ${((creatorProfile.last_name as string) || "")[0] || ""}`.trim()
      : "A friend";

    notify({
      userId: player2Id,
      type: NOTIFICATION_TYPES.GAME_INVITE,
      title: "5v3v1 Game Invite!",
      body: `${creatorName} invited you to a 5v3v1 game. Time to pick!`,
      metadata: { gameId: session.id, gameCode, invitedBy: user.id, href: "/5v3v1" },
    });
  }

  return NextResponse.json({ gameSession: session, gameCode }, { status: 201 });
}

/**
 * GET /api/games
 * List games for the current user.
 * Query params: ?status=complete (optional filter)
 */
export async function GET(req: NextRequest) {
  const user = await authenticate(req);
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status");

  let query = supabaseServer
    .from("game_sessions")
    .select("*")
    .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .limit(50);

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  const { data: games, error: gamesErr } = await query;

  if (gamesErr) {
    return NextResponse.json({ error: gamesErr.message }, { status: 500 });
  }

  const rows = games ?? [];
  if (rows.length === 0) {
    return NextResponse.json({ games: [] });
  }

  // Collect player IDs + winner business IDs for bulk lookups
  const playerIds = new Set<string>();
  const businessIds = new Set<string>();
  for (const g of rows) {
    if (g.player1_id) playerIds.add(g.player1_id as string);
    if (g.player2_id) playerIds.add(g.player2_id as string);
    if (g.winner_business_id) businessIds.add(g.winner_business_id as string);
  }

  // Bulk-fetch profiles for player names
  const { data: profiles } = await supabaseServer
    .from("profiles")
    .select("id, full_name, first_name, last_name, avatar_url, email")
    .in("id", Array.from(playerIds));

  const profileMap = new Map<string, Record<string, unknown>>();
  for (const p of profiles ?? []) {
    profileMap.set(p.id as string, p);
  }

  // Enrich profiles with auth metadata for users with poor name data
  const playerIdArray = Array.from(playerIds);
  const needsEnrichment = playerIdArray.filter(id => {
    const p = profileMap.get(id);
    if (!p) return true;
    const first = (p.first_name as string) || "";
    const last = (p.last_name as string) || "";
    const full = (p.full_name as string) || "";
    if (first && last) return false;
    if (full && !full.includes("@")) return false;
    return true;
  });

  if (needsEnrichment.length > 0) {
    await Promise.all(needsEnrichment.map(async (id) => {
      try {
        const { data: { user: authUser } } = await supabaseServer.auth.admin.getUserById(id);
        if (!authUser) return;
        const p: Record<string, unknown> = { ...(profileMap.get(id) || {}) };
        const meta = authUser.user_metadata || {};
        if (meta.full_name && typeof meta.full_name === "string" && !meta.full_name.includes("@")) {
          p.full_name = meta.full_name;
        }
        if (meta.first_name) p.first_name = meta.first_name;
        if (meta.last_name) p.last_name = meta.last_name;
        if (meta.name && typeof meta.name === "string" && !meta.name.includes("@")) {
          if (!p.full_name || (p.full_name as string).includes("@")) p.full_name = meta.name;
        }
        if (!p.email) p.email = authUser.email || "";
        profileMap.set(id, p);
      } catch { /* ignore */ }
    }));
  }

  // Bulk-fetch business names for winners
  let businessMap = new Map<string, string>();
  if (businessIds.size > 0) {
    const { data: businesses } = await supabaseServer
      .from("business")
      .select("id, public_business_name, business_name, name")
      .in("id", Array.from(businessIds));

    for (const b of businesses ?? []) {
      const bizName = (b.public_business_name || b.business_name || b.name || "Unknown") as string;
      businessMap.set(b.id as string, bizName);
    }
  }

  function getPlayerName(id: string | null): string | null {
    if (!id) return null;
    const p = profileMap.get(id);
    if (!p) return null;
    const first = (p.first_name as string) || "";
    const last = (p.last_name as string) || "";
    const full = (p.full_name as string) || "";
    if (first && last) return `${first} ${last[0].toUpperCase()}.`;
    if (full && !full.includes("@")) {
      const parts = full.trim().split(/\s+/);
      if (parts.length >= 2) return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
      return parts[0];
    }
    if (first) return first;
    const email = (p.email as string) || (full.includes("@") ? full : "");
    if (email) {
      const local = email.split("@")[0].replace(/\d+$/g, "").replace(/[._-]/g, " ").trim();
      if (!local) return "Unknown";
      const words = local.split(/\s+/);
      return words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    }
    return "Unknown";
  }

  const enrichedGames = rows.map(g => ({
    ...g,
    player1Name: getPlayerName(g.player1_id as string),
    player2Name: getPlayerName(g.player2_id as string | null),
    winnerBusinessName: g.winner_business_id
      ? businessMap.get(g.winner_business_id as string) ?? null
      : null,
  }));

  return NextResponse.json({ games: enrichedGames });
}
