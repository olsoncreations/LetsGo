import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

async function requireStaff(req: NextRequest): Promise<{ userId: string } | Response> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: { user }, error } = await supabaseServer.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: staff } = await supabaseServer
    .from("staff_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!staff) return NextResponse.json({ error: "Staff access required" }, { status: 403 });
  return { userId: user.id };
}

/**
 * GET /api/admin/sales/appointments
 * List appointments with optional filters.
 * Query params: rep_id, status, from, to, lead_id
 */
export async function GET(req: NextRequest) {
  const staffResult = await requireStaff(req);
  if (staffResult instanceof Response) return staffResult;

  const { searchParams } = new URL(req.url);
  const repId = searchParams.get("rep_id");
  const status = searchParams.get("status");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const leadId = searchParams.get("lead_id");

  let query = supabaseServer
    .from("sales_appointments")
    .select("*, sales_leads(id, business_name, address, phone, email, city, state)")
    .order("scheduled_at", { ascending: true });

  if (repId) query = query.eq("assigned_rep_id", repId);
  if (status) query = query.eq("status", status);
  if (from) query = query.gte("scheduled_at", from);
  if (to) query = query.lte("scheduled_at", to);
  if (leadId) query = query.eq("lead_id", leadId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/**
 * POST /api/admin/sales/appointments
 * Create a new appointment.
 * Body: { lead_id, scheduled_at, duration_min?, assigned_rep_id?, location?, notes? }
 */
export async function POST(req: NextRequest) {
  const staffResult = await requireStaff(req);
  if (staffResult instanceof Response) return staffResult;

  try {
    const body = await req.json();
    const { lead_id, scheduled_at, duration_min, assigned_rep_id, location, notes } = body;

    if (!lead_id || !scheduled_at) {
      return NextResponse.json({ error: "lead_id and scheduled_at are required" }, { status: 400 });
    }

    const scheduledDate = new Date(scheduled_at);
    if (isNaN(scheduledDate.getTime())) {
      return NextResponse.json({ error: "Invalid scheduled_at date" }, { status: 400 });
    }
    if (scheduledDate < new Date()) {
      return NextResponse.json({ error: "Cannot schedule appointments in the past" }, { status: 400 });
    }

    const validDurations = [15, 30, 45, 60, 90, 120];
    const dur = duration_min ?? 30;
    if (!validDurations.includes(dur)) {
      return NextResponse.json({ error: `duration_min must be one of: ${validDurations.join(", ")}` }, { status: 400 });
    }

    const { data: lead } = await supabaseServer
      .from("sales_leads")
      .select("id, business_name, address")
      .eq("id", lead_id)
      .maybeSingle();

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const { data: appointment, error } = await supabaseServer
      .from("sales_appointments")
      .insert({
        lead_id,
        scheduled_at: scheduledDate.toISOString(),
        duration_min: dur,
        assigned_rep_id: assigned_rep_id || null,
        location: location || lead.address || "",
        notes: notes || null,
        created_by: staffResult.userId,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(appointment, { status: 201 });
  } catch (err) {
    console.error("[appointments] Create error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}
