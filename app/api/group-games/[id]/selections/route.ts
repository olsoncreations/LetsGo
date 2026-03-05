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
 * POST /api/group-games/[id]/selections
 * Add a business selection. Body: { businessId: string }
 */
export async function POST(req: NextRequest, ctx: RouteContext) {
  const user = await authenticate(req);
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = await req.json();
  const businessId = String(body.businessId || "").trim();

  if (!businessId) {
    return NextResponse.json({ error: "businessId is required" }, { status: 400 });
  }

  // Verify player membership + game is in selection phase
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

  const { data: game } = await supabaseServer
    .from("group_games")
    .select("status")
    .eq("id", id)
    .single();

  if (!game || game.status !== "selection") {
    return NextResponse.json({ error: "Game is not in selection phase" }, { status: 400 });
  }

  // Insert selection (unique constraint handles duplicates)
  const { data: selection, error: insertErr } = await supabaseServer
    .from("group_game_selections")
    .insert({
      game_id: id,
      business_id: businessId,
      selected_by: user.id,
    })
    .select("*")
    .single();

  if (insertErr) {
    if (insertErr.code === "23505") {
      return NextResponse.json({ error: "Already selected this business" }, { status: 409 });
    }
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ selection }, { status: 201 });
}

/**
 * DELETE /api/group-games/[id]/selections
 * Remove a business selection. Body: { businessId: string }
 */
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const user = await authenticate(req);
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = await req.json();
  const businessId = String(body.businessId || "").trim();

  if (!businessId) {
    return NextResponse.json({ error: "businessId is required" }, { status: 400 });
  }

  const { error: deleteErr } = await supabaseServer
    .from("group_game_selections")
    .delete()
    .eq("game_id", id)
    .eq("business_id", businessId)
    .eq("selected_by", user.id);

  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
