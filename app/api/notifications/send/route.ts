import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { notify } from "@/lib/notify";
import type { NotificationType } from "@/lib/notificationTypes";

/**
 * POST /api/notifications/send
 * Internal endpoint for sending notifications from client-side admin pages.
 * Requires staff authentication.
 *
 * Body: { userId, type, title, body, metadata? }
 */
export async function POST(req: NextRequest) {
  // Verify the caller is staff
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const {
    data: { user },
    error: authErr,
  } = await supabaseServer.auth.getUser(token);
  if (authErr || !user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  // Check staff status
  const { data: staff } = await supabaseServer
    .from("staff_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!staff) {
    return NextResponse.json({ error: "Staff access required" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { userId, type, title, body: notifBody, metadata } = body;

  if (!userId || !type || !title || !notifBody) {
    return NextResponse.json({ error: "userId, type, title, and body are required" }, { status: 400 });
  }

  // Fire-and-forget the notification
  notify({
    userId: String(userId),
    type: type as NotificationType,
    title: String(title),
    body: String(notifBody),
    metadata: metadata || {},
  });

  return NextResponse.json({ ok: true });
}
