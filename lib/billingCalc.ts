import type { SupabaseClient } from "@supabase/supabase-js";

// ── Types ──────────────────────────────────────────

export interface BizBillingBreakdown {
  businessId: string;
  businessName: string;
  businessEmail: string;
  isActive: boolean;
  isPremium: boolean;
  paymentMethod: string;
  planCostCents: number;
  progressivePayoutsCents: number;
  advertisingAddOnsCents: number;
  letsGoFeesCents: number;
  ccFeesCents: number;
  totalCents: number;
  // Detail for line-item generation
  receiptCount: number;
  addOnLines: { id: string; name: string; cents: number }[];
  campaignLines: { id: string; name: string; cents: number }[];
  tpmsCents: number;
}

export interface PlatformBillingTotal {
  planCostCents: number;
  progressivePayoutsCents: number;
  advertisingAddOnsCents: number;
  letsGoFeesCents: number;
  ccFeesCents: number;
  totalCents: number;
  businessCount: number;
  premiumCount: number;
  activeCount: number;
}

const ADDON_LABELS: Record<string, string> = {
  videos_5_day: "5 Videos/Day",
  live_15: "15-Min Live Session",
  live_30: "30-Min Live Session",
};

// ── Core Billing Calculation ───────────────────────

/**
 * Computes per-business billing breakdowns for a given date range.
 * Used by both the "expected billing" API and invoice generation.
 *
 * @param supabase - Server-side Supabase client (service role)
 * @param rangeStart - Start date (YYYY-MM-DD inclusive)
 * @param rangeEnd - End date (YYYY-MM-DD inclusive)
 * @param fixedMultiplier - Proration factor relative to 1 month (1 = full month, 0.5 = half, 12 = year)
 */
export async function computeBillingBreakdowns(
  supabase: SupabaseClient,
  rangeStart: string,
  rangeEnd: string,
  fixedMultiplier: number
): Promise<{ breakdowns: BizBillingBreakdown[]; platformTotal: PlatformBillingTotal }> {
  // 1) Platform pricing + fee settings
  const { data: ps } = await supabase
    .from("platform_settings")
    .select("package_pricing, platform_fee_bps, platform_fee_cap_cents, cc_processing_fee_bps")
    .eq("id", 1)
    .maybeSingle();

  const platformFeeBps = (ps?.platform_fee_bps as number) ?? 1000;       // default 10%
  const platformFeeCapCents = (ps?.platform_fee_cap_cents as number) ?? 500; // default $5.00
  const ccFeeBps = (ps?.cc_processing_fee_bps as number) ?? 350;          // default 3.5%

  const pp = (ps?.package_pricing ?? {}) as Record<string, number>;
  const premiumMonthly = pp.premium_monthly_cents ?? 10000;
  const addonCostMap: Record<string, number> = {
    videos_5_day: pp.addon_video_5_monthly_cents ?? 5000,
    live_15: pp.addon_live_15_monthly_cents ?? 5000,
    live_30: pp.addon_live_30_monthly_cents ?? 10000,
  };
  const tpmsMonthly = pp.tpms_monthly_cents ?? 20000;

  // 2) All businesses (email/billing_plan columns may not exist — use config for email)
  const { data: businesses, error: bizErr } = await supabase
    .from("business")
    .select("id, business_name, public_business_name, config, is_active");

  if (bizErr) {
    console.error("[billingCalc] Error fetching businesses:", bizErr);
  }

  // 3) Premium status via view (fallback to billing_plan column)
  let premiumSet = new Set<string>();
  const { data: planStatuses, error: planErr } = await supabase
    .from("v_business_plan_status")
    .select("business_id, effective_plan_now");

  if (!planErr && planStatuses) {
    premiumSet = new Set(
      planStatuses
        .filter((p: Record<string, unknown>) => p.effective_plan_now === "premium")
        .map((p: Record<string, unknown>) => String(p.business_id))
    );
  } else {
    for (const biz of businesses ?? []) {
      const bp = (biz as Record<string, unknown>).billing_plan;
      if (typeof bp === "string" && bp.toLowerCase() === "premium") {
        premiumSet.add(String(biz.id));
      }
    }
  }

  // 4) Receipts filtered to date range
  const { data: receipts, error: rcptErr } = await supabase
    .from("receipts")
    .select("business_id, payout_cents, receipt_total_cents, status, visit_date")
    .gte("visit_date", rangeStart)
    .lte("visit_date", rangeEnd)
    .in("status", ["approved", "business_approved", "pending"]);

  if (rcptErr) {
    console.error("[billingCalc] Error fetching receipts:", rcptErr);
  }

  // 5) Ad campaigns overlapping the date range
  const { data: campaigns } = await supabase
    .from("business_ad_campaigns")
    .select("id, business_id, price_cents, surge_fee_cents, status")
    .gte("end_date", rangeStart)
    .lte("start_date", rangeEnd);

  // 6) Per-business breakdown
  const breakdowns: BizBillingBreakdown[] = [];

  for (const biz of businesses ?? []) {
    const cfg = ((biz as Record<string, unknown>).config ?? {}) as Record<string, unknown>;
    const isPremium = premiumSet.has(String(biz.id));
    const paymentMethod = String(cfg.paymentMethod ?? "bank");

    // Fixed costs prorated to period
    const planCostCents = isPremium ? Math.round(premiumMonthly * fixedMultiplier) : 0;

    const selectedAddOns = Array.isArray(cfg.selectedAddOns) ? (cfg.selectedAddOns as string[]) : [];
    const addOnLines: { id: string; name: string; cents: number }[] = [];
    for (const id of selectedAddOns) {
      const cents = Math.round((addonCostMap[id] ?? 0) * fixedMultiplier);
      if (cents > 0) {
        addOnLines.push({ id, name: ADDON_LABELS[id] || id, cents });
      }
    }

    const tpmsCents = cfg.tpmsEnabled === true ? Math.round(tpmsMonthly * fixedMultiplier) : 0;

    // Campaign costs overlapping this period
    const campaignLines: { id: string; name: string; cents: number }[] = [];
    for (const c of campaigns ?? []) {
      if (String(c.business_id) === String(biz.id) && c.status !== "canceled") {
        const cents = (c.price_cents ?? 0) + (c.surge_fee_cents ?? 0);
        if (cents > 0) {
          campaignLines.push({ id: String(c.id), name: "Ad Campaign", cents });
        }
      }
    }

    const addonTotal = addOnLines.reduce((s, a) => s + a.cents, 0);
    const campaignTotal = campaignLines.reduce((s, c) => s + c.cents, 0);
    const advertisingAddOnsCents = addonTotal + campaignTotal + tpmsCents;

    // Variable costs from receipts
    let progressivePayoutsCents = 0;
    let letsGoFeesCents = 0;
    let receiptCount = 0;
    for (const r of receipts ?? []) {
      if (String(r.business_id) === String(biz.id)) {
        receiptCount++;
        progressivePayoutsCents += r.payout_cents ?? 0;
        if (!isPremium) {
          letsGoFeesCents += Math.min(
            Math.floor((r.receipt_total_cents ?? 0) * platformFeeBps / 10_000),
            platformFeeCapCents
          );
        }
      }
    }

    const subtotal = planCostCents + advertisingAddOnsCents + progressivePayoutsCents + letsGoFeesCents;
    // CC processing fee (covers Stripe's 2.9% + $0.30 per-txn + margin)
    const ccFeesCents = paymentMethod === "card" ? Math.round(subtotal * ccFeeBps / 10_000) : 0;
    const totalCents = subtotal + ccFeesCents;

    breakdowns.push({
      businessId: String(biz.id),
      businessName: String((biz as Record<string, unknown>).public_business_name || biz.business_name || "Unknown"),
      businessEmail: String((cfg as Record<string, unknown>).email || (cfg as Record<string, unknown>).contactEmail || ""),
      isActive: Boolean((biz as Record<string, unknown>).is_active),
      isPremium,
      paymentMethod,
      planCostCents,
      progressivePayoutsCents,
      advertisingAddOnsCents,
      letsGoFeesCents,
      ccFeesCents,
      totalCents,
      receiptCount,
      addOnLines,
      campaignLines,
      tpmsCents,
    });
  }

  breakdowns.sort((a, b) => b.totalCents - a.totalCents);

  const platformTotal: PlatformBillingTotal = {
    planCostCents: breakdowns.reduce((s, b) => s + b.planCostCents, 0),
    progressivePayoutsCents: breakdowns.reduce((s, b) => s + b.progressivePayoutsCents, 0),
    advertisingAddOnsCents: breakdowns.reduce((s, b) => s + b.advertisingAddOnsCents, 0),
    letsGoFeesCents: breakdowns.reduce((s, b) => s + b.letsGoFeesCents, 0),
    ccFeesCents: breakdowns.reduce((s, b) => s + b.ccFeesCents, 0),
    totalCents: breakdowns.reduce((s, b) => s + b.totalCents, 0),
    businessCount: breakdowns.length,
    premiumCount: breakdowns.filter(b => b.isPremium).length,
    activeCount: breakdowns.filter(b => b.isActive).length,
  };

  return { breakdowns, platformTotal };
}
