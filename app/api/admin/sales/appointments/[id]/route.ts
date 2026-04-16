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
 * PATCH /api/admin/sales/appointments/[id]
 * Update an appointment. If scheduled_at changes, reset reminder timestamps.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const staffResult = await requireStaff(req);
  if (staffResult instanceof Response) return staffResult;

  const { id } = await params;

  try {
    const body = await req.json();
    const allowedFields = ["scheduled_at", "duration_min", "assigned_rep_id", "location", "notes", "status"];
    const updates: Record<string, unknown> = {};

    for (const key of allowedFields) {
      if (key in body) updates[key] = body[key];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    if (updates.scheduled_at) {
      const d = new Date(updates.scheduled_at as string);
      if (isNaN(d.getTime())) {
        return NextResponse.json({ error: "Invalid scheduled_at date" }, { status: 400 });
      }
      updates.scheduled_at = d.toISOString();
      updates.reminder_24h_sent_at = null;
      updates.reminder_1h_sent_at = null;
    }

    if (updates.duration_min !== undefined) {
      const validDurations = [15, 30, 45, 60, 90, 120];
      if (!validDurations.includes(updates.duration_min as number)) {
        return NextResponse.json({ error: `duration_min must be one of: ${validDurations.join(", ")}` }, { status: 400 });
      }
    }

    if (updates.status !== undefined) {
      const validStatuses = ["scheduled", "completed", "cancelled", "no_show"];
      if (!validStatuses.includes(updates.status as string)) {
        return NextResponse.json({ error: `status must be one of: ${validStatuses.join(", ")}` }, { status: 400 });
      }
    }

    const { data, error } = await supabaseServer
      .from("sales_appointments")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("[appointments] Update error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/admin/sales/appointments/[id]
 * Soft cancel — sets status to 'cancelled' instead of deleting.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const staffResult = await requireStaff(req);
  if (staffResult instanceof Response) return staffResult;

  const { id } = await params;

  const { data, error } = await supabaseServer
    .from("sales_appointments")
    .update({ status: "cancelled" })
    .eq("id", id)
    .select("id, status")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}
