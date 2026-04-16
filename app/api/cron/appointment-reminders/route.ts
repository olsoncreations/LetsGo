import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { notify } from "@/lib/notify";
import { NOTIFICATION_TYPES } from "@/lib/notificationTypes";

/**
 * GET /api/cron/appointment-reminders
 * Runs every 15 minutes via Vercel Cron.
 * Sends push reminders to assigned reps 24h and 1h before appointments.
 *
 * Reps are matched to auth.users via email (sales_reps.email → auth.users.email).
 * If a rep has no matching auth account, the reminder is skipped.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const authHeader = req.headers.get("authorization") ?? "";
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  let sent24h = 0;
  let sent1h = 0;
  let skipped = 0;

  try {
    // ── 24-hour reminders ──
    // Window: 23h to 25h from now (accounts for 15-min cron cadence)
    const from24 = new Date(now.getTime() + 23 * 60 * 60 * 1000).toISOString();
    const to24 = new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString();

    const { data: due24 } = await supabaseServer
      .from("sales_appointments")
      .select("id, scheduled_at, location, notes, assigned_rep_id, sales_leads(business_name)")
      .eq("status", "scheduled")
      .is("reminder_24h_sent_at", null)
      .gte("scheduled_at", from24)
      .lte("scheduled_at", to24);

    for (const appt of due24 ?? []) {
      const userId = await resolveRepUserId(appt.assigned_rep_id);
      if (!userId) { skipped++; continue; }

      const bizName = ((appt.sales_leads as unknown) as { business_name: string } | null)?.business_name ?? "Unknown";
      const time = new Date(appt.scheduled_at).toLocaleString("en-US", {
        weekday: "short", month: "short", day: "numeric",
        hour: "numeric", minute: "2-digit",
      });

      await notify({
        userId,
        type: NOTIFICATION_TYPES.NEW_MESSAGE,
        title: "Appointment Tomorrow",
        body: `Meeting with ${bizName} at ${time}${appt.location ? ` — ${appt.location}` : ""}`,
        metadata: { appointmentId: appt.id, href: "/admin/sales" },
      });

      await supabaseServer
        .from("sales_appointments")
        .update({ reminder_24h_sent_at: now.toISOString() })
        .eq("id", appt.id);

      sent24h++;
    }

    // ── 1-hour reminders ──
    // Window: 45min to 75min from now
    const from1 = new Date(now.getTime() + 45 * 60 * 1000).toISOString();
    const to1 = new Date(now.getTime() + 75 * 60 * 1000).toISOString();

    const { data: due1 } = await supabaseServer
      .from("sales_appointments")
      .select("id, scheduled_at, location, notes, assigned_rep_id, sales_leads(business_name)")
      .eq("status", "scheduled")
      .is("reminder_1h_sent_at", null)
      .gte("scheduled_at", from1)
      .lte("scheduled_at", to1);

    for (const appt of due1 ?? []) {
      const userId = await resolveRepUserId(appt.assigned_rep_id);
      if (!userId) { skipped++; continue; }

      const bizName = ((appt.sales_leads as unknown) as { business_name: string } | null)?.business_name ?? "Unknown";

      await notify({
        userId,
        type: NOTIFICATION_TYPES.NEW_MESSAGE,
        title: "Appointment in 1 Hour",
        body: `Meeting with ${bizName}${appt.location ? ` at ${appt.location}` : ""} starts soon.`,
        metadata: { appointmentId: appt.id, href: "/admin/sales" },
      });

      await supabaseServer
        .from("sales_appointments")
        .update({ reminder_1h_sent_at: now.toISOString() })
        .eq("id", appt.id);

      sent1h++;
    }

    return NextResponse.json({ success: true, sent24h, sent1h, skipped });
  } catch (err) {
    console.error("[appointment-reminders] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * Resolve a sales_reps.id → auth.users.id by matching email.
 * Returns null if the rep has no matching auth account.
 */
async function resolveRepUserId(repId: string | null): Promise<string | null> {
  if (!repId) return null;

  const { data: rep } = await supabaseServer
    .from("sales_reps")
    .select("email")
    .eq("id", repId)
    .maybeSingle();

  if (!rep?.email) return null;

  const { data: { users }, error } = await supabaseServer.auth.admin.listUsers();
  if (error || !users) return null;

  const match = users.find(
    (u) => u.email?.toLowerCase() === rep.email.toLowerCase(),
  );
  return match?.id ?? null;
}
