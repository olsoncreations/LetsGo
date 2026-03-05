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

// Online status thresholds (minutes)
const ONLINE_THRESHOLD = 5;
const AWAY_THRESHOLD = 30;

function deriveStatus(lastSeenAt: string | null): "online" | "away" | "offline" {
  if (!lastSeenAt) return "offline";
  const diff = (Date.now() - new Date(lastSeenAt).getTime()) / 60_000;
  if (diff < ONLINE_THRESHOLD) return "online";
  if (diff < AWAY_THRESHOLD) return "away";
  return "offline";
}

/**
 * GET /api/friends
 * Returns accepted friends + pending incoming requests for the current user.
 */
export async function GET(req: NextRequest) {
  const user = await authenticate(req);
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  // Fetch all friend records where user is either party
  const { data: friendRows, error: friendsErr } = await supabaseServer
    .from("user_friends")
    .select("id, user_id, friend_id, status, created_at")
    .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

  if (friendsErr) {
    return NextResponse.json({ error: friendsErr.message }, { status: 500 });
  }

  const rows = friendRows ?? [];

  // Split into accepted friends, pending incoming, and sent outgoing
  const acceptedRows = rows.filter(r => r.status === "accepted");
  const pendingIncoming = rows.filter(r => r.status === "pending" && r.friend_id === user.id);
  const pendingOutgoing = rows.filter(r => r.status === "pending" && r.user_id === user.id);

  // Collect all "other" user IDs we need profiles for
  const otherIds = new Set<string>();
  for (const r of rows) {
    otherIds.add(r.user_id === user.id ? r.friend_id : r.user_id);
  }

  if (otherIds.size === 0) {
    return NextResponse.json({ friends: [], pendingRequests: [], sentRequests: [] });
  }

  const idArray = Array.from(otherIds);

  // Bulk-fetch profiles + activity
  const [profilesRes, activityRes] = await Promise.all([
    supabaseServer
      .from("profiles")
      .select("id, full_name, first_name, last_name, username, avatar_url, email")
      .in("id", idArray),
    supabaseServer
      .from("user_activity")
      .select("user_id, last_seen_at")
      .in("user_id", idArray),
  ]);

  const profileMap = new Map<string, Record<string, unknown>>();
  for (const p of profilesRes.data ?? []) {
    profileMap.set(p.id as string, p);
  }

  const activityMap = new Map<string, string | null>();
  for (const a of activityRes.data ?? []) {
    activityMap.set(a.user_id as string, a.last_seen_at as string | null);
  }

  // Enrich profiles with auth metadata for users with poor name data
  const needsEnrichment = idArray.filter(id => {
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
      } catch { /* ignore auth lookup failures */ }
    }));
  }

  // Format as "First L." (first name + last initial)
  function formatDisplayName(p: Record<string, unknown>): string {
    const first = (p.first_name as string) || "";
    const last = (p.last_name as string) || "";
    const full = (p.full_name as string) || "";

    // If we have first + last, use "First L."
    if (first && last) return `${first} ${last[0].toUpperCase()}.`;
    // If we have full_name (skip if it looks like an email), split it to get "First L."
    if (full && !full.includes("@")) {
      const parts = full.trim().split(/\s+/);
      if (parts.length >= 2) return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
      return parts[0]; // single name
    }
    // If only first name
    if (first) return first;
    // Fallback: derive from email (take part before @, strip trailing digits)
    const email = (p.email as string) || (full.includes("@") ? full : "");
    if (email) {
      const local = email.split("@")[0].replace(/\d+$/g, "").replace(/[._-]/g, " ").trim();
      if (!local) return "Unknown";
      const words = local.split(/\s+/);
      return words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    }
    return "Unknown";
  }

  // Build friend response
  function buildFriend(otherId: string, friendshipId: string) {
    const p = profileMap.get(otherId) ?? {};
    return {
      friendshipId,
      id: otherId,
      name: formatDisplayName(p),
      username: (p.username as string) || null,
      avatarUrl: (p.avatar_url as string) || null,
      status: deriveStatus(activityMap.get(otherId) ?? null),
    };
  }

  const friends = acceptedRows.map(r => {
    const otherId = r.user_id === user.id ? r.friend_id : r.user_id;
    return buildFriend(otherId, r.id);
  });

  const pendingRequests = pendingIncoming.map(r => ({
    ...buildFriend(r.user_id, r.id),
    requestedAt: r.created_at,
  }));

  const sentRequests = pendingOutgoing.map(r => ({
    ...buildFriend(r.friend_id, r.id),
    sentAt: r.created_at,
  }));

  return NextResponse.json({ friends, pendingRequests, sentRequests });
}

/**
 * POST /api/friends
 * Send a friend request. Body: { friendId: string }
 */
export async function POST(req: NextRequest) {
  const user = await authenticate(req);
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = await req.json();
  const friendId = String(body.friendId || "").trim();

  if (!friendId) {
    return NextResponse.json({ error: "friendId is required" }, { status: 400 });
  }

  if (friendId === user.id) {
    return NextResponse.json({ error: "Cannot send a friend request to yourself" }, { status: 400 });
  }

  // Verify the target user exists
  const { data: targetProfile } = await supabaseServer
    .from("profiles")
    .select("id")
    .eq("id", friendId)
    .maybeSingle();

  if (!targetProfile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Check if a relationship already exists in either direction
  const { data: existing } = await supabaseServer
    .from("user_friends")
    .select("id, status, user_id, friend_id")
    .or(
      `and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id})`
    );

  if (existing && existing.length > 0) {
    const record = existing[0];
    if (record.status === "accepted") {
      return NextResponse.json({ error: "Already friends" }, { status: 409 });
    }
    if (record.status === "pending") {
      // If the other person already sent us a request, auto-accept
      if (record.user_id === friendId && record.friend_id === user.id) {
        const { error: updateErr } = await supabaseServer
          .from("user_friends")
          .update({ status: "accepted" })
          .eq("id", record.id);

        if (updateErr) {
          return NextResponse.json({ error: updateErr.message }, { status: 500 });
        }
        return NextResponse.json({ message: "Friend request accepted (they already requested you)", status: "accepted" });
      }
      return NextResponse.json({ error: "Friend request already pending" }, { status: 409 });
    }
    if (record.status === "blocked") {
      return NextResponse.json({ error: "Unable to send friend request" }, { status: 403 });
    }
  }

  // Create friend request
  const { data: newFriend, error: insertErr } = await supabaseServer
    .from("user_friends")
    .insert({ user_id: user.id, friend_id: friendId, status: "pending" })
    .select("id, status, created_at")
    .single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  // Notify the recipient about the friend request
  const { data: senderProfile } = await supabaseServer
    .from("profiles")
    .select("first_name, last_name, full_name")
    .eq("id", user.id)
    .maybeSingle();

  const senderName = senderProfile?.first_name
    ? `${senderProfile.first_name} ${((senderProfile.last_name as string) || "")[0] || ""}.`.trim()
    : "Someone";

  notify({
    userId: friendId,
    type: NOTIFICATION_TYPES.FRIEND_REQUEST,
    title: "New Friend Request",
    body: `${senderName} wants to be your friend.`,
    metadata: { fromUserId: user.id, fromName: senderName, href: "/profile" },
  });

  return NextResponse.json({ friendRequest: newFriend }, { status: 201 });
}
