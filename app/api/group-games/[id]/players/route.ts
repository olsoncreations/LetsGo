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

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/group-games/[id]/players
 * GM adds a player. Body: { userId: string }
 */
export async function POST(req: NextRequest, ctx: RouteContext) {
  const user = await authenticate(req);
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = await req.json();
  const targetUserId = String(body.userId || "").trim();

  if (!targetUserId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  // Verify GM
  const { data: membership } = await supabaseServer
    .from("group_game_players")
    .select("role")
    .eq("game_id", id)
    .eq("user_id", user.id)
    .is("removed_at", null)
    .maybeSingle();

  if (!membership || membership.role !== "game_master") {
    return NextResponse.json({ error: "Only the Game Master can add players" }, { status: 403 });
  }

  // Check if already a member
  const { data: existing } = await supabaseServer
    .from("group_game_players")
    .select("id, removed_at")
    .eq("game_id", id)
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (existing && !existing.removed_at) {
    return NextResponse.json({ error: "User is already in this game" }, { status: 409 });
  }

  if (existing && existing.removed_at) {
    // Re-add by clearing removed_at
    await supabaseServer
      .from("group_game_players")
      .update({ removed_at: null })
      .eq("id", existing.id);

    return NextResponse.json({ success: true, rejoined: true });
  }

  // Add new player
  const { error: insertErr } = await supabaseServer
    .from("group_game_players")
    .insert({
      game_id: id,
      user_id: targetUserId,
      role: "player",
    });

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  // Notify the added player
  const { data: gmProfile } = await supabaseServer
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", user.id)
    .maybeSingle();

  const { data: gameRow } = await supabaseServer
    .from("group_games")
    .select("name")
    .eq("id", id)
    .maybeSingle();

  const gmName = gmProfile?.first_name
    ? `${gmProfile.first_name} ${((gmProfile.last_name as string) || "")[0] || ""}`.trim()
    : "A friend";

  const gameName = (gameRow?.name as string) || "a group game";

  notify({
    userId: targetUserId,
    type: NOTIFICATION_TYPES.GAME_INVITE,
    title: "You've Been Added to a Game!",
    body: `${gmName} added you to "${gameName}". Jump in and start picking!`,
    metadata: { gameId: id, gameName, addedBy: user.id, href: "/group" },
  });

  return NextResponse.json({ success: true }, { status: 201 });
}

/**
 * DELETE /api/group-games/[id]/players
 * GM soft-removes a player. Body: { userId: string }
 */
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const user = await authenticate(req);
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = await req.json();
  const targetUserId = String(body.userId || "").trim();

  if (!targetUserId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  // Check the caller's role
  const { data: callerMembership } = await supabaseServer
    .from("group_game_players")
    .select("role")
    .eq("game_id", id)
    .eq("user_id", user.id)
    .is("removed_at", null)
    .maybeSingle();

  if (!callerMembership) {
    return NextResponse.json({ error: "You are not in this game" }, { status: 403 });
  }

  const isGM = callerMembership.role === "game_master";
  const isSelfRemoval = targetUserId === user.id;

  // GM cannot leave their own game
  if (isSelfRemoval && isGM) {
    return NextResponse.json({ error: "Game Master cannot remove themselves" }, { status: 400 });
  }

  // Non-GM can only remove themselves
  if (!isSelfRemoval && !isGM) {
    return NextResponse.json({ error: "Only the Game Master can remove other players" }, { status: 403 });
  }

  // Soft-remove the player
  const { error: updateErr } = await supabaseServer
    .from("group_game_players")
    .update({ removed_at: new Date().toISOString() })
    .eq("game_id", id)
    .eq("user_id", targetUserId)
    .is("removed_at", null);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
