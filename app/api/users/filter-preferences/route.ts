import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

async function authenticate(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user }, error } = await supabaseServer.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

/**
 * GET /api/users/filter-preferences
 * Returns the current user's saved filter preferences.
 */
export async function GET(req: NextRequest) {
  const user = await authenticate(req);
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const { data, error } = await supabaseServer
    .from("profiles")
    .select("filter_preferences")
    .eq("id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ preferences: data?.filter_preferences ?? null });
}

/**
 * PUT /api/users/filter-preferences
 * Saves the user's filter preferences.
 * Body: { preferences: { categories, price, distance, openNow, tags } }
 */
export async function PUT(req: NextRequest) {
  const user = await authenticate(req);
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  try {
    const body = await req.json();
    const prefs = body.preferences;

    if (!prefs || typeof prefs !== "object") {
      return NextResponse.json({ error: "preferences object required" }, { status: 400 });
    }

    // Sanitize — only allow known fields
    const sanitized: Record<string, unknown> = {};
    if (Array.isArray(prefs.categories)) sanitized.categories = prefs.categories.filter((c: unknown) => typeof c === "string");
    if (typeof prefs.price === "string") sanitized.price = prefs.price;
    if (typeof prefs.distance === "number") sanitized.distance = Math.min(50, Math.max(1, prefs.distance));
    if (typeof prefs.openNow === "boolean") sanitized.openNow = prefs.openNow;
    if (Array.isArray(prefs.tags)) sanitized.tags = prefs.tags.filter((t: unknown) => typeof t === "string");

    const { error } = await supabaseServer
      .from("profiles")
      .update({ filter_preferences: sanitized })
      .eq("id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, preferences: sanitized });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}
