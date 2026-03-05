import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * POST /api/admin/billing/statements
 *
 * Generate statements for all businesses in a billing period.
 * Body: { periodStart: "2026-02-01", periodEnd: "2026-02-28" }
 */
export async function POST(req: NextRequest): Promise<Response> {
  // Require staff authentication
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: { user }, error: authErr } = await supabaseServer.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: staff } = await supabaseServer.from("staff_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!staff) return NextResponse.json({ error: "Staff access required" }, { status: 403 });

  try {
    const body = await req.json();
    const periodStart: string = body.periodStart;
    const periodEnd: string = body.periodEnd;

    if (!periodStart || !periodEnd) {
      return NextResponse.json({ error: "periodStart and periodEnd required" }, { status: 400 });
    }

    const startDate = new Date(periodStart + "T00:00:00");
    const statementPeriod = startDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

    // Check for existing statements
    const { data: existing } = await supabaseServer
      .from("statements")
      .select("id")
      .eq("period_start", periodStart)
      .eq("period_end", periodEnd)
      .limit(1);

    if (existing && existing.length > 0) {
      const { count } = await supabaseServer
        .from("statements")
        .select("id", { count: "exact", head: true })
        .eq("period_start", periodStart)
        .eq("period_end", periodEnd);

      return NextResponse.json({
        error: "already_generated",
        message: `Statements for ${statementPeriod} already exist (${count} statements).`,
        existingCount: count,
      }, { status: 409 });
    }

    // Get all businesses
    const { data: businesses } = await supabaseServer
      .from("business")
      .select("id, business_name, public_business_name, config");

    // Get approved receipts in this period grouped by business
    const { data: receipts } = await supabaseServer
      .from("receipts")
      .select("business_id, payout_cents, receipt_total_cents")
      .gte("visit_date", periodStart)
      .lte("visit_date", periodEnd)
      .in("status", ["approved", "business_approved"]);

    // Group receipts by business
    const bizReceiptMap = new Map<string, { count: number; payoutCents: number; totalCents: number }>();
    for (const r of receipts ?? []) {
      const bizId = String(r.business_id);
      const existing = bizReceiptMap.get(bizId) || { count: 0, payoutCents: 0, totalCents: 0 };
      existing.count++;
      existing.payoutCents += r.payout_cents ?? 0;
      existing.totalCents += r.receipt_total_cents ?? 0;
      bizReceiptMap.set(bizId, existing);
    }

    // Get linked invoices for this period
    const { data: invoices } = await supabaseServer
      .from("invoices")
      .select("id, business_id, total_cents")
      .eq("period_start", periodStart)
      .eq("period_end", periodEnd);

    const invoiceMap = new Map<string, { id: string; totalCents: number }>();
    for (const inv of invoices ?? []) {
      invoiceMap.set(String(inv.business_id), {
        id: inv.id,
        totalCents: inv.total_cents ?? 0,
      });
    }

    let generated = 0;
    let skipped = 0;

    for (const biz of businesses ?? []) {
      const bizId = String(biz.id);
      const receiptData = bizReceiptMap.get(bizId);
      const invoiceData = invoiceMap.get(bizId);

      // Skip businesses with no activity and no invoice
      if (!receiptData && !invoiceData) {
        skipped++;
        continue;
      }

      const totalReceipts = receiptData?.count ?? 0;
      const totalPayouts = receiptData?.payoutCents ?? 0;
      // LetsGo fees: 10% capped at $5 per receipt (simplified)
      let totalFees = 0;
      if (receiptData) {
        // Recalculate from individual receipts for accuracy
        for (const r of receipts ?? []) {
          if (String(r.business_id) === bizId) {
            totalFees += Math.min(Math.floor((r.receipt_total_cents ?? 0) * 0.10), 500);
          }
        }
      }

      const totalDue = invoiceData?.totalCents ?? (totalPayouts + totalFees);
      const businessName = String((biz as Record<string, unknown>).public_business_name || biz.business_name || "Unknown");

      const { error: insertErr } = await supabaseServer
        .from("statements")
        .insert({
          business_id: bizId,
          statement_period: statementPeriod,
          period_start: periodStart,
          period_end: periodEnd,
          total_receipts: totalReceipts,
          total_payouts: totalPayouts,
          total_fees: totalFees,
          total_due: totalDue,
          invoice_id: invoiceData?.id || null,
          status: "pending",
          business_name: businessName,
          business_email: String(((biz as Record<string, unknown>).config as Record<string, unknown>)?.email || ((biz as Record<string, unknown>).config as Record<string, unknown>)?.contactEmail || ""),
        });

      if (insertErr) {
        console.error(`[billing-statements] Error for ${bizId}:`, insertErr);
        skipped++;
        continue;
      }

      generated++;
    }

    return NextResponse.json({
      ok: true,
      statementPeriod,
      generated,
      skipped,
    });
  } catch (err) {
    console.error("[billing-statements] POST error:", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/billing/statements
 *
 * Update statement status.
 * Body: { statementId: string, action: "mark_sent" | "mark_viewed" }
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
    const { statementId, action } = body as {
      statementId: string;
      action: string;
    };

    if (!statementId || !action) {
      return NextResponse.json({ error: "statementId and action required" }, { status: 400 });
    }

    const validActions = ["mark_sent", "mark_viewed"];
    if (!validActions.includes(action)) {
      return NextResponse.json({
        error: `Invalid action. Must be one of: ${validActions.join(", ")}`,
      }, { status: 400 });
    }

    let updatePayload: Record<string, unknown> = {};

    switch (action) {
      case "mark_sent":
        updatePayload = { status: "sent", sent_at: new Date().toISOString() };
        break;
      case "mark_viewed":
        updatePayload = { status: "viewed", viewed_at: new Date().toISOString() };
        break;
    }

    const { data: updated, error: updateErr } = await supabaseServer
      .from("statements")
      .update(updatePayload)
      .eq("id", statementId)
      .select("id, status, sent_at, viewed_at")
      .single();

    if (updateErr) {
      console.error("[billing-statements] PATCH error:", updateErr);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, statement: updated });
  } catch (err) {
    console.error("[billing-statements] PATCH error:", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
