import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { notify } from "@/lib/notify";
import { NOTIFICATION_TYPES } from "@/lib/notificationTypes";

/**
 * POST /api/businesses/share
 *
 * Send an in-app notification to one or more LetsGo friends with a deep link
 * to a business's public preview page. Reuses the existing notification stack
 * (`user_notifications` row + Web Push + email per user preferences).
 *
 * Body: { businessId: string; friendIds: string[] }
 *
 * Recipients are validated against `user_friends` — a user can only push a
 * share notification to someone they're actually friends with (status =
 * "accepted"). Anything not in that list is silently dropped, which prevents
 * abuse without leaking who the sender's friends are.
 *
 * Returns: { sent: number, skipped: number, businessName: string }
 */
export async function POST(req: NextRequest) {
  // Auth
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: { user }, error: authErr } = await supabaseServer.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  // Parse + validate body
  let body: { businessId?: unknown; friendIds?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const businessId = typeof body.businessId === "string" ? body.businessId.trim() : "";
  const friendIds = Array.isArray(body.friendIds)
    ? body.friendIds.filter((x): x is string => typeof x === "string" && x.length > 0)
    : [];

  if (!businessId) {
    return NextResponse.json({ error: "businessId is required" }, { status: 400 });
  }
  if (friendIds.length === 0) {
    return NextResponse.json({ error: "friendIds must contain at least one user id" }, { status: 400 });
  }
  // Cap to keep a single share from blasting out hundreds of pushes by accident
  if (friendIds.length > 50) {
    return NextResponse.json({ error: "Cannot share with more than 50 friends at once" }, { status: 400 });
  }

  // Validate the business exists and is active. Public preview page renders
  // for inactive ones too, but we don't want to spam friends with dead links.
  const { data: business, error: bizErr } = await supabaseServer
    .from("business")
    .select("id, business_name, public_business_name, is_active")
    .eq("id", businessId)
    .maybeSingle();
  if (bizErr) {
    return NextResponse.json({ error: bizErr.message }, { status: 500 });
  }
  if (!business || business.is_active === false) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }
  const businessName = (business.public_business_name as string | null) || (business.business_name as string | null) || "a place";

  // Pull the sender's display name for the notification body.
  const { data: senderProfile } = await supabaseServer
    .from("profiles")
    .select("first_name, last_name, full_name")
    .eq("id", user.id)
    .maybeSingle();
  const senderName = (() => {
    const first = (senderProfile?.first_name as string | null) || "";
    const last = (senderProfile?.last_name as string | null) || "";
    const full = (senderProfile?.full_name as string | null) || "";
    if (first && last) return `${first} ${last[0].toUpperCase()}.`;
    if (first) return first;
    if (full && !full.includes("@")) return full.split(/\s+/)[0];
    return "A friend";
  })();

  // Validate each recipient is an accepted friend. user_friends rows store the
  // pair in either direction, so match on both.
  const { data: friendRows } = await supabaseServer
    .from("user_friends")
    .select("user_id, friend_id, status")
    .eq("status", "accepted")
    .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

  const acceptedFriendIds = new Set<string>();
  for (const r of friendRows ?? []) {
    const otherId = (r.user_id as string) === user.id ? (r.friend_id as string) : (r.user_id as string);
    acceptedFriendIds.add(otherId);
  }

  const validRecipients = friendIds.filter((id) => acceptedFriendIds.has(id) && id !== user.id);
  const skipped = friendIds.length - validRecipients.length;

  // Fan out notifications. notify() is fire-and-forget safe — we await all so
  // we can return an accurate count, but errors inside notify() never throw.
  const href = `/preview/${encodeURIComponent(businessId)}`;
  await Promise.all(
    validRecipients.map((recipientId) =>
      notify({
        userId: recipientId,
        type: NOTIFICATION_TYPES.BUSINESS_SHARED,
        title: `${senderName} shared ${businessName}`,
        body: `Tap to check it out on LetsGo.`,
        metadata: {
          href,
          businessId,
          businessName,
          fromUserId: user.id,
          fromName: senderName,
        },
      })
    )
  );

  return NextResponse.json({ sent: validRecipients.length, skipped, businessName });
}
