import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * GET /api/admin/events
 * Returns all business events with business names, view counts, and RSVP breakdowns.
 * Uses supabaseServer to bypass RLS.
 */
export async function GET(req: NextRequest): Promise<Response> {
  // Require staff authentication
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: { user }, error: authErr } = await supabaseServer.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: staff } = await supabaseServer.from("staff_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!staff) return NextResponse.json({ error: "Staff access required" }, { status: 403 });

  try {
    const [eventsRes, bizRes, viewsRes, rsvpsRes] = await Promise.all([
      supabaseServer
        .from("business_events")
        .select("*")
        .order("start_at", { ascending: false }),
      supabaseServer
        .from("business")
        .select("id, business_name, public_business_name"),
      // Get view counts per event
      supabaseServer
        .from("event_views")
        .select("event_id"),
      // Get all RSVPs with response type
      supabaseServer
        .from("event_rsvps")
        .select("event_id, response"),
    ]);

    if (eventsRes.error) {
      console.error("[admin-events] GET events error:", eventsRes.error);
      return NextResponse.json({ error: eventsRes.error.message }, { status: 500 });
    }

    // Build business name lookup
    const bizMap = new Map<string, string>();
    for (const b of bizRes.data ?? []) {
      bizMap.set(b.id, b.public_business_name || b.business_name || "Unnamed");
    }

    // Build view count lookup: event_id -> count
    const viewCounts = new Map<string, number>();
    for (const v of viewsRes.data ?? []) {
      const eid = String(v.event_id);
      viewCounts.set(eid, (viewCounts.get(eid) || 0) + 1);
    }

    // Build RSVP breakdown lookup: event_id -> { yes, maybe, no }
    const rsvpCounts = new Map<string, { yes: number; maybe: number; no: number }>();
    for (const r of rsvpsRes.data ?? []) {
      const eid = String(r.event_id);
      if (!rsvpCounts.has(eid)) rsvpCounts.set(eid, { yes: 0, maybe: 0, no: 0 });
      const counts = rsvpCounts.get(eid)!;
      if (r.response === "yes") counts.yes++;
      else if (r.response === "maybe") counts.maybe++;
      else if (r.response === "no") counts.no++;
    }

    // Enrich events with business_name, image URL, views, and RSVPs
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
    const events = (eventsRes.data ?? []).map((e) => {
      const r = e as Record<string, unknown>;
      const eid = String(r.id);
      let imageUrl: string | null = null;
      if (r.image_bucket && r.image_path) {
        imageUrl = `${supabaseUrl}/storage/v1/object/public/${r.image_bucket}/${r.image_path}`;
      }
      const rsvps = rsvpCounts.get(eid) || { yes: 0, maybe: 0, no: 0 };
      return {
        ...r,
        business_name: bizMap.get(String(r.business_id)) || "Unknown",
        image_url: imageUrl,
        view_count: viewCounts.get(eid) || 0,
        rsvp_yes: rsvps.yes,
        rsvp_maybe: rsvps.maybe,
        rsvp_no: rsvps.no,
      };
    });

    const businesses = (bizRes.data ?? []).map((b) => ({
      id: b.id,
      name: b.public_business_name || b.business_name || "Unnamed",
    }));

    return NextResponse.json({ events, businesses });
  } catch (err) {
    console.error("[admin-events] GET unexpected error:", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/events
 * Admin actions: cancel, publish, unpublish.
 * Body: { id: string, action: "cancel" | "publish" | "unpublish" }
 */
export async function PATCH(req: NextRequest): Promise<Response> {
  // Require staff authentication
  const patchToken = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!patchToken) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: { user: patchUser }, error: patchAuthErr } = await supabaseServer.auth.getUser(patchToken);
  if (patchAuthErr || !patchUser) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: patchStaff } = await supabaseServer.from("staff_users").select("user_id").eq("user_id", patchUser.id).maybeSingle();
  if (!patchStaff) return NextResponse.json({ error: "Staff access required" }, { status: 403 });

  try {
    const body = await req.json();
    const { id, action } = body as { id: string; action: "cancel" | "publish" | "unpublish" };

    if (!id || !action) {
      return NextResponse.json({ error: "id and action required" }, { status: 400 });
    }

    let updates: Record<string, unknown>;
    if (action === "cancel") {
      updates = { is_cancelled: true };
    } else if (action === "publish") {
      updates = { is_published: true };
    } else if (action === "unpublish") {
      updates = { is_published: false };
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const { error } = await supabaseServer
      .from("business_events")
      .update(updates)
      .eq("id", id);

    if (error) {
      console.error("[admin-events] PATCH error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, action });
  } catch (err) {
    console.error("[admin-events] PATCH unexpected error:", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
