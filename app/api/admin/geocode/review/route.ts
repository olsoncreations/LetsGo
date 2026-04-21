import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

async function requireStaff(req: NextRequest): Promise<{ userId: string; userName: string } | Response> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: { user }, error } = await supabaseServer.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: staff } = await supabaseServer
    .from("staff_users").select("user_id, name").eq("user_id", user.id).maybeSingle();
  if (!staff) return NextResponse.json({ error: "Staff access required" }, { status: 403 });
  return { userId: user.id, userName: staff.name || "" };
}

/**
 * GET /api/admin/geocode/review
 * Fetch businesses needing geocode review, ordered by distance (worst first).
 * Query params: ?status=mismatch&limit=50&offset=0
 */
export async function GET(req: NextRequest) {
  const staffResult = await requireStaff(req);
  if (staffResult instanceof Response) return staffResult;

  const sp = req.nextUrl.searchParams;
  const status = sp.get("status") || "mismatch";
  const limit = Math.min(100, parseInt(sp.get("limit") || "50", 10));
  const offset = parseInt(sp.get("offset") || "0", 10);

  let query = supabaseServer
    .from("business")
    .select(
      "id, business_name, street_address, city, state, zip, " +
      "latitude, longitude, nominatim_lat, nominatim_lng, " +
      "geocode_status, geocode_distance_miles, geocode_checked_at, " +
      "geocode_reviewed_by, geocode_reviewed_at",
      { count: "exact" }
    )
    .eq("is_active", true);

  // Filter by status (support comma-separated multi-status)
  const statuses = status.split(",").map(s => s.trim()).filter(Boolean);
  if (statuses.length === 1) {
    query = query.eq("geocode_status", statuses[0]);
  } else if (statuses.length > 1) {
    query = query.in("geocode_status", statuses);
  }

  query = query
    .order("geocode_distance_miles", { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    businesses: data || [],
    total: count || 0,
    limit,
    offset,
  });
}

/**
 * PATCH /api/admin/geocode/review
 * Resolve a geocode mismatch.
 * Body: { businessId, action: "approve_google"|"approve_nominatim"|"approve_manual"|"skip", manualLat?, manualLng? }
 */
export async function PATCH(req: NextRequest) {
  const staffResult = await requireStaff(req);
  if (staffResult instanceof Response) return staffResult;
  const { userId: staffId, userName: staffName } = staffResult;

  try {
    const body = await req.json();
    const { businessId, action, manualLat, manualLng } = body;

    if (!businessId || !action) {
      return NextResponse.json({ error: "businessId and action are required" }, { status: 400 });
    }

    const validActions = ["approve_google", "approve_nominatim", "approve_manual", "skip"];
    if (!validActions.includes(action)) {
      return NextResponse.json({ error: `Invalid action. Must be one of: ${validActions.join(", ")}` }, { status: 400 });
    }

    // Fetch current business data
    const { data: biz, error: fetchErr } = await supabaseServer
      .from("business")
      .select("id, business_name, latitude, longitude, nominatim_lat, nominatim_lng")
      .eq("id", businessId)
      .maybeSingle();

    if (fetchErr || !biz) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const update: Record<string, unknown> = {
      geocode_status: action === "skip" ? "skipped" : action,
      geocode_reviewed_by: staffId,
      geocode_reviewed_at: new Date().toISOString(),
    };

    const oldLat = biz.latitude;
    const oldLng = biz.longitude;
    let newLat = oldLat;
    let newLng = oldLng;

    if (action === "approve_nominatim") {
      update.latitude = biz.nominatim_lat;
      update.longitude = biz.nominatim_lng;
      newLat = biz.nominatim_lat;
      newLng = biz.nominatim_lng;
    } else if (action === "approve_manual") {
      if (manualLat == null || manualLng == null) {
        return NextResponse.json({ error: "manualLat and manualLng required for manual approval" }, { status: 400 });
      }
      update.latitude = manualLat;
      update.longitude = manualLng;
      newLat = manualLat;
      newLng = manualLng;
    }

    const { error: updateErr } = await supabaseServer
      .from("business")
      .update(update)
      .eq("id", businessId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Audit log
    await supabaseServer.from("audit_log").insert({
      action: `geocode_${action}`,
      tab: "Businesses",
      target_type: "business",
      target_id: businessId,
      entity_name: biz.business_name,
      field_name: "coordinates",
      old_value: `${oldLat}, ${oldLng}`,
      new_value: `${newLat}, ${newLng}`,
      details: `Geocode review: ${action}`,
      staff_id: staffId,
      staff_name: staffName,
    }).then(() => {}, () => {});

    return NextResponse.json({ success: true, action, businessId });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/geocode/review
 * Bulk approve all mismatches as Google coordinates.
 * Body: { action: "bulk_approve_google" }
 */
export async function PUT(req: NextRequest) {
  const staffResult = await requireStaff(req);
  if (staffResult instanceof Response) return staffResult;
  const { userId: staffId, userName: staffName } = staffResult;

  try {
    const body = await req.json();
    if (body.action !== "bulk_approve_google") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // Count how many we'll update
    const { count } = await supabaseServer
      .from("business")
      .select("id", { count: "exact", head: true })
      .eq("geocode_status", "mismatch")
      .eq("is_active", true);

    // Bulk update all mismatches to approved_google (keep existing coordinates)
    const { error: updateErr } = await supabaseServer
      .from("business")
      .update({
        geocode_status: "approved_google",
        geocode_reviewed_by: staffId,
        geocode_reviewed_at: new Date().toISOString(),
      })
      .eq("geocode_status", "mismatch")
      .eq("is_active", true);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Audit log
    await supabaseServer.from("audit_log").insert({
      action: "geocode_bulk_approve_google",
      tab: "Businesses",
      target_type: "business",
      details: `Bulk approved ${count || 0} mismatched businesses with Google coordinates`,
      staff_id: staffId,
      staff_name: staffName,
    }).then(() => {}, () => {});

    return NextResponse.json({ success: true, updated: count || 0 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
