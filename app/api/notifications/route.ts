import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

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

/**
 * GET /api/notifications?limit=50&offset=0
 * Returns the user's notifications and unread count.
 */
export async function GET(req: NextRequest) {
  const user = await authenticate(req);
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 100);
  const offset = Number(url.searchParams.get("offset")) || 0;

  const [notifResult, countResult] = await Promise.all([
    supabaseServer
      .from("user_notifications")
      .select("id, user_id, type, title, body, metadata, read, read_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1),
    supabaseServer
      .from("user_notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("read", false),
  ]);

  if (notifResult.error) {
    return NextResponse.json({ error: notifResult.error.message }, { status: 500 });
  }

  return NextResponse.json({
    notifications: notifResult.data ?? [],
    unreadCount: countResult.count ?? 0,
  });
}

/**
 * PATCH /api/notifications
 * Mark notifications as read.
 * Body: { ids: string[] }
 */
export async function PATCH(req: NextRequest) {
  const user = await authenticate(req);
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const ids = body.ids;

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids array required" }, { status: 400 });
  }

  const { error } = await supabaseServer
    .from("user_notifications")
    .update({ read: true, read_at: new Date().toISOString() })
    .in("id", ids)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, markedCount: ids.length });
}

/**
 * DELETE /api/notifications
 * Delete notifications by IDs, or all notifications if ids is ["*"].
 * Body: { ids: string[] }
 */
export async function DELETE(req: NextRequest) {
  const user = await authenticate(req);
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const ids = body.ids;

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids array required" }, { status: 400 });
  }

  // Clear all notifications for this user
  if (ids.length === 1 && ids[0] === "*") {
    const { error } = await supabaseServer
      .from("user_notifications")
      .delete()
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, deletedAll: true });
  }

  // Delete specific notifications
  const { error } = await supabaseServer
    .from("user_notifications")
    .delete()
    .in("id", ids)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deletedCount: ids.length });
}
