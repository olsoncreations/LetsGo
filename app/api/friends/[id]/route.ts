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

/**
 * PATCH /api/friends/[id]
 * Update friend request status. Body: { status: 'accepted' | 'blocked' }
 * - Only the recipient (friend_id) can accept
 * - Either party can block
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await authenticate(req);
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id: friendshipId } = await params;
  const body = await req.json();
  const newStatus = String(body.status || "").trim();

  if (!["accepted", "blocked"].includes(newStatus)) {
    return NextResponse.json({ error: "status must be 'accepted' or 'blocked'" }, { status: 400 });
  }

  // Fetch the friendship record
  const { data: record, error: fetchErr } = await supabaseServer
    .from("user_friends")
    .select("id, user_id, friend_id, status")
    .eq("id", friendshipId)
    .maybeSingle();

  if (fetchErr || !record) {
    return NextResponse.json({ error: "Friend record not found" }, { status: 404 });
  }

  // Authorization: user must be part of this friendship
  if (record.user_id !== user.id && record.friend_id !== user.id) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  // Only the recipient can accept
  if (newStatus === "accepted" && record.friend_id !== user.id) {
    return NextResponse.json({ error: "Only the recipient can accept a friend request" }, { status: 403 });
  }

  // Can only accept pending requests
  if (newStatus === "accepted" && record.status !== "pending") {
    return NextResponse.json({ error: "Can only accept pending requests" }, { status: 400 });
  }

  const { error: updateErr } = await supabaseServer
    .from("user_friends")
    .update({ status: newStatus })
    .eq("id", friendshipId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Notify the original requester that their request was accepted
  if (newStatus === "accepted") {
    const { data: accepterProfile } = await supabaseServer
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", user.id)
      .maybeSingle();

    const accepterName = accepterProfile?.first_name
      ? `${accepterProfile.first_name} ${((accepterProfile.last_name as string) || "")[0] || ""}.`.trim()
      : "Your friend";

    notify({
      userId: record.user_id,
      type: NOTIFICATION_TYPES.FRIEND_ACCEPTED,
      title: "Friend Request Accepted!",
      body: `${accepterName} accepted your friend request.`,
      metadata: { friendUserId: user.id, friendName: accepterName, href: "/profile" },
    });
  }

  return NextResponse.json({ message: `Friend request ${newStatus}` });
}

/**
 * DELETE /api/friends/[id]
 * Remove a friend or cancel a pending request.
 * Either party can unfriend or cancel.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await authenticate(req);
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id: friendshipId } = await params;

  // Fetch the record to verify ownership
  const { data: record, error: fetchErr } = await supabaseServer
    .from("user_friends")
    .select("id, user_id, friend_id")
    .eq("id", friendshipId)
    .maybeSingle();

  if (fetchErr || !record) {
    return NextResponse.json({ error: "Friend record not found" }, { status: 404 });
  }

  if (record.user_id !== user.id && record.friend_id !== user.id) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { error: deleteErr } = await supabaseServer
    .from("user_friends")
    .delete()
    .eq("id", friendshipId);

  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 500 });
  }

  return NextResponse.json({ message: "Friend removed" });
}
