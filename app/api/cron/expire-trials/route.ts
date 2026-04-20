import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * GET /api/cron/expire-trials
 * Daily cron job to deactivate expired trial businesses.
 * Sets is_active = false for seeded businesses whose trial_expires_at has passed.
 *
 * Protected by CRON_SECRET header.
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

  try {
    const now = new Date().toISOString();

    // Find expired trial businesses
    const { data: expired, error: findErr } = await supabaseServer
      .from("business")
      .select("id, business_name")
      .eq("billing_plan", "trial")
      .eq("is_active", true)
      .lt("trial_expires_at", now);

    if (findErr) {
      return NextResponse.json({ error: findErr.message }, { status: 500 });
    }

    if (!expired || expired.length === 0) {
      return NextResponse.json({ expired: 0, message: "No expired trials found" });
    }

    const expiredIds = expired.map((b) => b.id);

    // Deactivate them
    const { error: updateErr } = await supabaseServer
      .from("business")
      .update({ is_active: false })
      .in("id", expiredIds);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Audit log each expiration
    const auditRows = expired.map((b) => ({
      action: "trial_expired",
      tab: "Businesses",
      target_type: "business",
      target_id: b.id,
      entity_name: b.business_name,
      details: "Trial period expired — business deactivated from discovery feed",
      staff_id: "system",
      staff_name: "Cron",
    }));

    await supabaseServer.from("audit_log").insert(auditRows).then(() => {}, () => {});

    return NextResponse.json({
      expired: expired.length,
      businesses: expired.map((b) => ({ id: b.id, name: b.business_name })),
    });
  } catch (err) {
    console.error("[expire-trials] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
