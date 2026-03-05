import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { notify } from "@/lib/notify";
import { NOTIFICATION_TYPES } from "@/lib/notificationTypes";

/**
 * POST /api/events/notify-followers
 * Notify all users who follow a business that a new event was published.
 * Called by the business dashboard after creating an event.
 *
 * Body: { eventId: string, businessId: string }
 * Requires authentication (must be a business_users member for this business).
 */
export async function POST(req: NextRequest) {
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

  const body = await req.json().catch(() => ({}));
  const eventId = String(body.eventId || "").trim();
  const businessId = String(body.businessId || "").trim();

  if (!eventId || !businessId) {
    return NextResponse.json({ error: "eventId and businessId are required" }, { status: 400 });
  }

  // Verify caller has access to this business
  const { data: membership } = await supabaseServer
    .from("business_users")
    .select("role")
    .eq("business_id", businessId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: "Not authorized for this business" }, { status: 403 });
  }

  // Fetch event details
  const { data: event } = await supabaseServer
    .from("business_events")
    .select("id, title, start_at, business_id")
    .eq("id", eventId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Fetch business name
  const { data: biz } = await supabaseServer
    .from("business")
    .select("public_business_name, business_name")
    .eq("id", businessId)
    .maybeSingle();

  const businessName = ((biz?.public_business_name || biz?.business_name) as string) || "A business you follow";

  // Format event date for display
  let eventDate: string | null = null;
  if (event.start_at) {
    try {
      eventDate = new Date(event.start_at as string).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      // Silent — date formatting is non-critical
    }
  }

  // Find all users who follow this business
  const { data: followers } = await supabaseServer
    .from("user_followed_businesses")
    .select("user_id")
    .eq("business_id", businessId);

  const followerIds = (followers ?? []).map((f) => f.user_id as string);

  if (followerIds.length === 0) {
    return NextResponse.json({ ok: true, notified: 0 });
  }

  // Notify each follower (fire-and-forget, notify() handles errors internally)
  for (const followerId of followerIds) {
    notify({
      userId: followerId,
      type: NOTIFICATION_TYPES.NEW_EVENT,
      title: "New Event!",
      body: `${businessName} just posted "${(event.title as string) || "an event"}". Check it out!`,
      metadata: {
        eventId,
        businessId,
        businessName,
        eventTitle: event.title,
        eventDate,
        href: "/events",
      },
    });
  }

  return NextResponse.json({ ok: true, notified: followerIds.length });
}
