import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

// Verify caller is business owner/manager or admin staff
async function requireBusinessAccess(req: NextRequest, businessId: string): Promise<Response | null> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: { user }, error } = await supabaseServer.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: bizAccess } = await supabaseServer
    .from("business_users").select("role").eq("business_id", businessId)
    .eq("user_id", user.id).in("role", ["owner", "manager"]).maybeSingle();
  if (bizAccess) return null;
  const { data: staff } = await supabaseServer
    .from("staff_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (staff) return null;
  return NextResponse.json({ error: "Business access required" }, { status: 403 });
}

type MediaEntry = {
  id?: string;
  name?: string;
  url?: string;
  status?: string;
  uploaded_at?: string;
};

/**
 * POST /api/businesses/[businessId]/media-sync
 * Syncs media uploads/deletes to the business table's photos/videos arrays
 * so the Admin dashboard can see them. Uses supabaseServer to bypass RLS.
 *
 * Body: { action: "add" | "remove", field: "photos" | "videos", entries: MediaEntry[] }
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ businessId: string }> }
): Promise<Response> {
  const { businessId } = await context.params;

  if (!businessId) {
    return NextResponse.json({ error: "businessId required" }, { status: 400 });
  }

  const denied = await requireBusinessAccess(req, businessId);
  if (denied) return denied;

  let body: {
    action: "add" | "remove";
    field: "photos" | "videos";
    entries: MediaEntry[];
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { action, field, entries } = body;

  if (!["photos", "videos"].includes(field)) {
    return NextResponse.json({ error: "field must be 'photos' or 'videos'" }, { status: 400 });
  }

  if (!["add", "remove"].includes(action)) {
    return NextResponse.json({ error: "action must be 'add' or 'remove'" }, { status: 400 });
  }

  try {
    // Load current array from business table
    const { data: biz, error: loadErr } = await supabaseServer
      .from("business")
      .select(field)
      .eq("id", businessId)
      .maybeSingle();

    if (loadErr) {
      console.error("[media-sync] Load error:", loadErr.message);
      return NextResponse.json({ error: loadErr.message }, { status: 500 });
    }

    const rawField = biz ? (biz as Record<string, unknown>)[field] : null;
    const existing: MediaEntry[] = (Array.isArray(rawField) ? rawField : []) as MediaEntry[];

    let updated: MediaEntry[];

    if (action === "add") {
      updated = [...existing, ...entries];
    } else {
      // Remove entries by id
      const removeIds = new Set(entries.map((e) => e.id).filter(Boolean));
      updated = existing.filter((item) => !removeIds.has(item.id));
    }

    const { error: updateErr } = await supabaseServer
      .from("business")
      .update({ [field]: updated })
      .eq("id", businessId);

    if (updateErr) {
      console.error("[media-sync] Update error:", updateErr.message);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, count: updated.length });
  } catch (err) {
    console.error("[media-sync] Unexpected error:", err);
    return NextResponse.json(
      { error: "Unexpected error", details: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
