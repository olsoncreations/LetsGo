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
 * GET /api/notifications/preferences
 * Returns the user's notification preferences.
 * If no rows exist, returns empty array (frontend uses defaults: all enabled).
 */
export async function GET(req: NextRequest) {
  const user = await authenticate(req);
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { data, error } = await supabaseServer
    .from("user_notification_preferences")
    .select("notification_type, in_app, email, push")
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ preferences: data ?? [] });
}

/**
 * PUT /api/notifications/preferences
 * Upsert user notification preferences.
 * Body: { preferences: Array<{ notification_type: string; in_app: boolean; email: boolean; push: boolean }> }
 */
export async function PUT(req: NextRequest) {
  const user = await authenticate(req);
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const preferences = body.preferences;

  if (!Array.isArray(preferences)) {
    return NextResponse.json({ error: "preferences array required" }, { status: 400 });
  }

  // Upsert each preference row
  const rows = preferences.map(
    (p: { notification_type: string; in_app: boolean; email: boolean; push: boolean }) => ({
      user_id: user.id,
      notification_type: p.notification_type,
      in_app: p.in_app,
      email: p.email,
      push: p.push,
      updated_at: new Date().toISOString(),
    })
  );

  const { error } = await supabaseServer
    .from("user_notification_preferences")
    .upsert(rows, { onConflict: "user_id,notification_type" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
