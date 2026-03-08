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

// Fields users are allowed to update
const ALLOWED_FIELDS = new Set([
  "first_name",
  "last_name",
  "username",
  "bio",
  "zip_code",
  "phone",
  "location",
  "avatar_url",
  "payout_method",
  "payout_identifier",
]);

// JSONB preference keys
const PREFERENCE_KEYS = new Set([
  "push_notifications",
  "email_notifications",
  "sms_notifications",
  "marketing_emails",
]);

/**
 * GET /api/users/profile
 * Returns the full profile for the authenticated user.
 */
export async function GET(req: NextRequest) {
  const user = await authenticate(req);
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { data: profile, error } = await supabaseServer
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  return NextResponse.json({ profile });
}

/**
 * PATCH /api/users/profile
 * Update allowed profile fields for the authenticated user.
 *
 * Body: { first_name?, last_name?, username?, bio?, zip_code?, phone?,
 *         location?, avatar_url?, payout_method?, payout_identifier?,
 *         preferences?: { push_notifications?, email_notifications?, ... } }
 */
export async function PATCH(req: NextRequest) {
  const user = await authenticate(req);
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = await req.json();

  // Build update object from allowed fields only
  const updates: Record<string, unknown> = {};

  for (const key of Object.keys(body)) {
    if (ALLOWED_FIELDS.has(key) && body[key] !== undefined) {
      updates[key] = typeof body[key] === "string" ? body[key].trim() : body[key];
    }
  }

  // Auto-construct full_name from first + last (matching admin pattern)
  if (updates.first_name !== undefined || updates.last_name !== undefined) {
    // Fetch current values if not both provided
    let firstName = updates.first_name as string | undefined;
    let lastName = updates.last_name as string | undefined;

    if (firstName === undefined || lastName === undefined) {
      const { data: current } = await supabaseServer
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", user.id)
        .maybeSingle();

      if (firstName === undefined) firstName = current?.first_name || "";
      if (lastName === undefined) lastName = current?.last_name || "";
    }

    updates.full_name = `${firstName} ${lastName}`.trim();
  }

  // Handle preferences (JSONB merge)
  if (body.preferences && typeof body.preferences === "object") {
    const { data: current } = await supabaseServer
      .from("profiles")
      .select("preferences")
      .eq("id", user.id)
      .maybeSingle();

    const existingPrefs = (current?.preferences as Record<string, unknown>) || {};
    const newPrefs = { ...existingPrefs };

    for (const key of Object.keys(body.preferences)) {
      if (PREFERENCE_KEYS.has(key)) {
        newPrefs[key] = body.preferences[key];
      }
    }

    updates.preferences = newPrefs;
  }

  // Validate username uniqueness if changed
  if (updates.username) {
    const username = updates.username as string;

    if (username.length < 3) {
      return NextResponse.json({ error: "Username must be at least 3 characters" }, { status: 400 });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return NextResponse.json({ error: "Username can only contain letters, numbers, and underscores" }, { status: 400 });
    }

    const { data: existing } = await supabaseServer
      .from("profiles")
      .select("id")
      .eq("username", username)
      .neq("id", user.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "Username is already taken" }, { status: 409 });
    }
  }

  // Validate zip code if provided
  if (updates.zip_code) {
    const zip = updates.zip_code as string;
    if (!/^\d{5}$/.test(zip)) {
      return NextResponse.json({ error: "ZIP code must be 5 digits" }, { status: 400 });
    }
  }

  // Validate payout method
  if (updates.payout_method) {
    const method = updates.payout_method as string;
    if (!["venmo", "paypal"].includes(method)) {
      return NextResponse.json({ error: "Invalid payout method" }, { status: 400 });
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data: updated, error } = await supabaseServer
    .from("profiles")
    .update(updates)
    .eq("id", user.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: updated });
}
