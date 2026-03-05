import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { computeBillingBreakdowns } from "@/lib/billingCalc";

/**
 * POST /api/admin/billing/generate-invoices
 *
 * Generates monthly invoices for all active businesses.
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

    // Compute billing period label (e.g., "February 2026")
    const startDate = new Date(periodStart + "T00:00:00");
    const billingPeriod = startDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

    // Check for existing invoices in this period
    const { data: existing } = await supabaseServer
      .from("invoices")
      .select("id")
      .eq("period_start", periodStart)
      .eq("period_end", periodEnd)
      .limit(1);

    if (existing && existing.length > 0) {
      // Count how many exist
      const { count } = await supabaseServer
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .eq("period_start", periodStart)
        .eq("period_end", periodEnd);

      return NextResponse.json({
        error: "already_generated",
        message: `Invoices for ${billingPeriod} already exist (${count} invoices). Void existing invoices first to regenerate.`,
        existingCount: count,
      }, { status: 409 });
    }

    // Compute billing breakdowns using shared helper (fixedMultiplier = 1 for monthly)
    const { breakdowns } = await computeBillingBreakdowns(
      supabaseServer,
      periodStart,
      periodEnd,
      1 // Monthly = 1x fixed costs
    );

    // Due date = 30 days after period end
    const endDate = new Date(periodEnd + "T00:00:00");
    const dueDate = new Date(endDate);
    dueDate.setDate(dueDate.getDate() + 30);
    const dueDateStr = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, "0")}-${String(dueDate.getDate()).padStart(2, "0")}`;

    let generated = 0;
    let skipped = 0;
    let totalCents = 0;
    const invoiceSummaries: { id: string; businessName: string; totalCents: number }[] = [];

    for (const biz of breakdowns) {
      // Skip businesses with nothing owed
      if (biz.totalCents <= 0) {
        skipped++;
        continue;
      }

      // Insert invoice
      const subtotalCents = biz.totalCents - biz.ccFeesCents;
      const { data: invoice, error: invoiceErr } = await supabaseServer
        .from("invoices")
        .insert({
          business_id: biz.businessId,
          period_start: periodStart,
          period_end: periodEnd,
          billing_period: billingPeriod,
          invoice_date: new Date().toISOString().split("T")[0],
          due_date: dueDateStr,
          subtotal_cents: subtotalCents,
          cc_fee_cents: biz.ccFeesCents,
          total_cents: biz.totalCents,
          receipt_count: biz.receiptCount,
          status: "pending",
          locked_at: new Date().toISOString(),
          business_name: biz.businessName,
          business_email: biz.businessEmail,
          payment_method: biz.paymentMethod,
          is_premium: biz.isPremium,
        })
        .select("id")
        .single();

      if (invoiceErr) {
        console.error(`[generate-invoices] Error for ${biz.businessId}:`, invoiceErr);
        skipped++;
        continue;
      }

      const invoiceId = invoice.id;

      // Build line items
      const lineItems: {
        invoice_id: string;
        line_type: string;
        description: string;
        amount_cents: number;
        quantity: number;
        reference_id?: string;
        reference_type?: string;
      }[] = [];

      // Premium subscription
      if (biz.planCostCents > 0) {
        lineItems.push({
          invoice_id: invoiceId,
          line_type: "premium_subscription",
          description: "Premium Plan – Monthly Subscription",
          amount_cents: biz.planCostCents,
          quantity: 1,
        });
      }

      // Progressive payouts
      if (biz.progressivePayoutsCents > 0) {
        lineItems.push({
          invoice_id: invoiceId,
          line_type: "progressive_payout_fee",
          description: `Progressive Payouts (${biz.receiptCount} receipts)`,
          amount_cents: biz.progressivePayoutsCents,
          quantity: biz.receiptCount,
        });
      }

      // LetsGo platform fee (Basic only)
      if (biz.letsGoFeesCents > 0) {
        lineItems.push({
          invoice_id: invoiceId,
          line_type: "platform_fee_basic",
          description: `LetsGo Platform Fee (${biz.receiptCount} receipts)`,
          amount_cents: biz.letsGoFeesCents,
          quantity: biz.receiptCount,
        });
      }

      // Add-ons
      for (const addon of biz.addOnLines) {
        lineItems.push({
          invoice_id: invoiceId,
          line_type: "addon",
          description: addon.name,
          amount_cents: addon.cents,
          quantity: 1,
          reference_id: addon.id,
          reference_type: "addon",
        });
      }

      // TPMS
      if (biz.tpmsCents > 0) {
        lineItems.push({
          invoice_id: invoiceId,
          line_type: "tpms",
          description: "Third-Party Management Service",
          amount_cents: biz.tpmsCents,
          quantity: 1,
        });
      }

      // Ad campaigns
      for (const campaign of biz.campaignLines) {
        lineItems.push({
          invoice_id: invoiceId,
          line_type: "ad_campaign",
          description: campaign.name,
          amount_cents: campaign.cents,
          quantity: 1,
          reference_id: campaign.id,
          reference_type: "campaign",
        });
      }

      // Credit card processing fee
      if (biz.ccFeesCents > 0) {
        lineItems.push({
          invoice_id: invoiceId,
          line_type: "credit_card_fee",
          description: "Credit Card Processing Fee (3.5%)",
          amount_cents: biz.ccFeesCents,
          quantity: 1,
        });
      }

      // Insert all line items
      if (lineItems.length > 0) {
        const { error: linesErr } = await supabaseServer
          .from("invoice_line_items")
          .insert(lineItems);

        if (linesErr) {
          console.error(`[generate-invoices] Line items error for ${biz.businessId}:`, linesErr);
        }
      }

      generated++;
      totalCents += biz.totalCents;
      invoiceSummaries.push({
        id: invoiceId,
        businessName: biz.businessName,
        totalCents: biz.totalCents,
      });
    }

    return NextResponse.json({
      ok: true,
      billingPeriod,
      generated,
      skipped,
      totalCents,
      invoices: invoiceSummaries,
    });
  } catch (err) {
    console.error("[generate-invoices] Unexpected error:", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
