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
 * POST /api/notifications/subscribe
 * Register a Web Push subscription for the authenticated user.
 * Body: { endpoint: string; p256dh: string; auth: string; userAgent?: string }
 */
export async function POST(req: NextRequest) {
  const user = await authenticate(req);
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { endpoint, p256dh, auth, userAgent } = body;

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json(
      { error: "endpoint, p256dh, and auth are required" },
      { status: 400 }
    );
  }

  const { error } = await supabaseServer
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        endpoint: String(endpoint),
        p256dh: String(p256dh),
        auth_key: String(auth),
        user_agent: userAgent ? String(userAgent) : null,
      },
      { onConflict: "user_id,endpoint" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
