"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { BarChart3, CheckCircle, CreditCard, DollarSign, Download, AlertCircle, RefreshCw } from "lucide-react";
import type { BusinessTabProps } from "@/components/business/v2/BusinessProfileV2";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { BillingBanner } from "@/components/LaunchBanner";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, CardNumberElement, CardExpiryElement, CardCvcElement, useStripe, useElements } from "@stripe/react-stripe-js";

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

type PlanName = "basic" | "premium";

type PlanChange = {
  requestedPlan: PlanName;
  effectiveDateLabel: string; // e.g., "Feb 1, 2026"
  note: string;
};

type BillingSummaryRow = {
  month: string;
  premiumFeeCents: number;
  addOnsCents: number;
  progressivePayoutsCents: number;
  basicFeesCents: number;
  ccFeesCents: number;
  advertisingCents: number;
  tpmsCents: number;
  adjustmentsCents: number;
  totalCents: number;
  invoiceId: string;
  invoiceStatus: string;
  lockedAt?: string | null;
};

type InvoiceHeader = {
  id: string;
  business_id: string;
  period_start?: string | null;
  period_end?: string | null;
  created_at?: string | null;
  status?: string | null;
  subtotal_cents?: number | null;
  total_cents?: number | null;
  locked_at?: string | null;
};

type InvoiceLine = {
  id: string;
  line_type: string;
  description?: string | null;
  amount_cents: number;
  quantity?: number | null;
};

// ==================== PENDING ADJUSTMENTS COMPONENT ====================
function PendingAdjustments({ businessId, colors }: { businessId: string; colors: Record<string, string> }) {
  const [adjustments, setAdjustments] = useState<{ id: string; amount_cents: number; type: string; description: string; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const { data: { session } } = await supabaseBrowser.auth.getSession();
        if (!session?.access_token) { if (mounted) setLoading(false); return; }

        const res = await fetch(`/api/businesses/adjustments?business_id=${encodeURIComponent(businessId)}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok && mounted) {
          const json = await res.json();
          setAdjustments(json.adjustments || []);
        }
      } catch { /* API may not be available */ }
      finally { if (mounted) setLoading(false); }
    }
    load();
    return () => { mounted = false; };
  }, [businessId]);

  if (loading || adjustments.length === 0) return null;

  const totalCredits = adjustments.filter(a => a.type === "credit").reduce((s, a) => s + Math.abs(a.amount_cents), 0);
  const totalCharges = adjustments.filter(a => a.type === "charge").reduce((s, a) => s + Math.abs(a.amount_cents), 0);

  return (
    <div
      style={{
        background: "rgba(255, 255, 255, 0.03)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: "16px",
        padding: "1.5rem 2rem",
        marginBottom: "1.5rem",
      }}
    >
      <div style={{ fontSize: "1rem", fontWeight: 800, marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <DollarSign size={18} style={{ color: colors.primary }} />
        Pending Account Adjustments
      </div>
      <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)", marginBottom: "1rem" }}>
        These adjustments will be applied to your next invoice.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {adjustments.map(adj => (
          <div
            key={adj.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "0.75rem 1rem",
              background: adj.type === "credit" ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
              border: `1px solid ${adj.type === "credit" ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
              borderRadius: "10px",
            }}
          >
            <div>
              <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#fff" }}>{adj.description}</div>
              <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", marginTop: "2px" }}>
                {new Date(adj.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </div>
            </div>
            <div style={{
              fontSize: "1rem",
              fontWeight: 800,
              color: adj.type === "credit" ? colors.success : "#ef4444",
            }}>
              {adj.type === "credit" ? "-" : "+"}${(Math.abs(adj.amount_cents) / 100).toFixed(2)}
            </div>
          </div>
        ))}
      </div>
      {(totalCredits > 0 || totalCharges > 0) && (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "1.5rem", marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          {totalCredits > 0 && (
            <div style={{ fontSize: "0.8rem", color: colors.success, fontWeight: 700 }}>
              Credits: -${(totalCredits / 100).toFixed(2)}
            </div>
          )}
          {totalCharges > 0 && (
            <div style={{ fontSize: "0.8rem", color: "#ef4444", fontWeight: 700 }}>
              Charges: +${(totalCharges / 100).toFixed(2)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Billing({ businessId, isPremium }: BusinessTabProps) {
  const colors = useMemo(
    () => ({
      primary: "#14b8a6",
      secondary: "#f97316",
      accent: "#06b6d4",
      success: "#10b981",
      warning: "#f59e0b",
      danger: "#ef4444",
    }),
    []
  );

  function moneyCents(n: number) {
    const v = (n ?? 0) / 100;
    return v.toLocaleString("en-US", { style: "currency", currency: "USD" }).replace(".00", "");
  }

  function normalizeErr(e: unknown): string {
    if (!e) return "Unknown error.";
    if (typeof e === "string") return e;
    if (e instanceof Error) return e.message || "Unknown error.";
    try {
      const anyE = e as any;
      const parts = [
        anyE?.message ? `message=${anyE.message}` : null,
        anyE?.details ? `details=${anyE.details}` : null,
        anyE?.hint ? `hint=${anyE.hint}` : null,
        anyE?.code ? `code=${anyE.code}` : null,
      ].filter(Boolean);
      return parts.length ? parts.join(" | ") : JSON.stringify(e);
    } catch {
      return "Unknown error (non-serializable).";
    }
  }


  // Pricing from platform_settings (plan + add-ons + fees)
  const [premiumPriceCents, setPremiumPriceCents] = useState(10000);
  const [addonPricing, setAddonPricing] = useState({
    addon_video_5_monthly_cents: 5000,
    addon_live_15_monthly_cents: 5000,
    addon_live_30_monthly_cents: 10000,
    tpms_monthly_cents: 20000,
  });
  const [platformFeeBps, setPlatformFeeBps] = useState(1000);       // 10% default
  const [platformFeeCapCents, setPlatformFeeCapCents] = useState(500); // $5 default
  const [ccFeeBps, setCcFeeBps] = useState(350);                    // 3.5% default
  useEffect(() => {
    let mounted = true;
    async function fetchPricing() {
      try {
        const { data: ps } = await supabaseBrowser
          .from("platform_settings")
          .select("package_pricing, platform_fee_bps, platform_fee_cap_cents, cc_processing_fee_bps")
          .eq("id", 1)
          .maybeSingle();
        if (mounted && ps) {
          if (ps.platform_fee_bps) setPlatformFeeBps(ps.platform_fee_bps);
          if (ps.platform_fee_cap_cents) setPlatformFeeCapCents(ps.platform_fee_cap_cents);
          if (ps.cc_processing_fee_bps) setCcFeeBps(ps.cc_processing_fee_bps);
          if (ps.package_pricing) {
            const pp = ps.package_pricing;
            if (pp.premium_monthly_cents) setPremiumPriceCents(pp.premium_monthly_cents);
            setAddonPricing({
              addon_video_5_monthly_cents: pp.addon_video_5_monthly_cents ?? 5000,
              addon_live_15_monthly_cents: pp.addon_live_15_monthly_cents ?? 5000,
              addon_live_30_monthly_cents: pp.addon_live_30_monthly_cents ?? 10000,
              tpms_monthly_cents: pp.tpms_monthly_cents ?? 20000,
            });
          }
        }
      } catch (err) {
        console.error("Error fetching pricing:", err);
      }
    }
    fetchPricing();
    return () => { mounted = false; };
  }, []);

  // Real-time add-on + campaign + receipt costs for expected bill
  const [activeAddOnsCents, setActiveAddOnsCents] = useState(0);
  const [activeCampaignsCents, setActiveCampaignsCents] = useState(0);
  const [tpmsActiveCents, setTpmsActiveCents] = useState(0);
  const [progressivePayoutsCents, setProgressivePayoutsCents] = useState(0);
  const [platformFeesCents, setPlatformFeesCents] = useState(0);

  // Pending account adjustments (credits/charges not yet on an invoice)
  const [pendingAdjustments, setPendingAdjustments] = useState<{ id: string; amount_cents: number; type: string; description: string; created_at: string }[]>([]);
  const [pendingAdjTotalCents, setPendingAdjTotalCents] = useState(0);
  useEffect(() => {
    let mounted = true;
    async function loadAdjustments() {
      try {
        const { data: { session } } = await supabaseBrowser.auth.getSession();
        if (!session?.access_token) return;
        const res = await fetch(`/api/businesses/adjustments?business_id=${encodeURIComponent(businessId)}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok && mounted) {
          const json = await res.json();
          const adjs = json.adjustments || [];
          setPendingAdjustments(adjs);
          // Sum: credits are negative (reduce bill), charges are positive (increase bill)
          setPendingAdjTotalCents(adjs.reduce((s: number, a: { amount_cents: number }) => s + a.amount_cents, 0));
        }
      } catch { /* table may not exist */ }
    }
    loadAdjustments();
    return () => { mounted = false; };
  }, [businessId]);

  useEffect(() => {
    let mounted = true;
    async function loadRealTimeCosts() {
      if (!businessId) return;
      try {
        // 1) Load business config for selected add-ons + TPMS
        const { data: biz } = await supabaseBrowser
          .from("business")
          .select("config")
          .eq("id", businessId)
          .maybeSingle();

        const cfg = (biz?.config ?? {}) as Record<string, unknown>;
        const selectedAddOns = Array.isArray(cfg.selectedAddOns) ? (cfg.selectedAddOns as string[]) : [];
        const tpmsEnabled = cfg.tpmsEnabled === true;

        // Map add-on IDs to their costs
        const addonCostMap: Record<string, number> = {
          videos_5_day: addonPricing.addon_video_5_monthly_cents,
          live_15: addonPricing.addon_live_15_monthly_cents,
          live_30: addonPricing.addon_live_30_monthly_cents,
        };

        let addonTotal = 0;
        for (const id of selectedAddOns) {
          addonTotal += addonCostMap[id] ?? 0;
        }

        // 2) Load active ad campaigns for current month
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

        const { data: campaigns } = await supabaseBrowser
          .from("business_ad_campaigns")
          .select("price_cents, surge_fee_cents, status")
          .eq("business_id", businessId)
          .gte("end_date", monthStart)
          .lte("start_date", monthEnd);

        let campaignTotal = 0;
        for (const c of campaigns ?? []) {
          if (c.status !== "canceled") {
            campaignTotal += (c.price_cents ?? 0) + (c.surge_fee_cents ?? 0);
          }
        }

        // 3) Load current month's receipt-based costs via server API (bypasses RLS)
        const monthStartDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

        let payoutTotal = 0;
        let feeTotal = 0;
        try {
          const { data: receiptsSession } = await supabaseBrowser.auth.getSession();
          const receiptsToken = receiptsSession?.session?.access_token;
          const receiptsRes = await fetch(`/api/businesses/${businessId}/receipts`, {
            headers: receiptsToken ? { Authorization: `Bearer ${receiptsToken}` } : {},
          });
          if (receiptsRes.ok) {
            const { receipts: allReceipts } = await receiptsRes.json();
            for (const r of allReceipts ?? []) {
              // Only include current month receipts that are approved, business_approved, or pending
              const status = (r.status || "").toLowerCase();
              if ((status === "approved" || status === "business_approved" || status === "pending") && r.visit_date >= monthStartDate) {
                payoutTotal += r.payout_cents ?? 0;
                const receiptCents = r.receipt_total_cents ?? 0;
                feeTotal += Math.min(Math.floor(receiptCents * platformFeeBps / 10_000), platformFeeCapCents);
              }
            }
          }
        } catch (receiptErr) {
          console.error("Error loading receipt costs:", receiptErr);
        }

        if (mounted) {
          setActiveAddOnsCents(addonTotal);
          setActiveCampaignsCents(campaignTotal);
          setTpmsActiveCents(tpmsEnabled ? addonPricing.tpms_monthly_cents : 0);
          setProgressivePayoutsCents(payoutTotal);
          setPlatformFeesCents(feeTotal);
        }
      } catch (err) {
        console.error("Error loading real-time costs:", err);
      }
    }
    loadRealTimeCosts();
    return () => { mounted = false; };
  }, [businessId, addonPricing, platformFeeBps, platformFeeCapCents]);

  // ---------- CURRENT PLAN STATE ----------
  // “Truth” for gating is already handled by the shell using v_business_plan_status.
  // Here we keep this tab visually aligned: plan cards reflect isPremium.
  const [currentPlan, setCurrentPlan] = useState<PlanName>(isPremium ? "premium" : "basic");
  useEffect(() => setCurrentPlan(isPremium ? "premium" : "basic"), [isPremium]);

  const [pendingPlanChange, setPendingPlanChange] = useState<PlanChange | null>(null);

  // Plan change modal (UI)
  const [showPlanChangeModal, setShowPlanChangeModal] = useState(false);
  const [selectedPlanChange, setSelectedPlanChange] = useState<PlanName | null>(null);

  // Payment info (loaded from business.config)
  const [paymentType, setPaymentType] = useState<"bank" | "card">("bank");
  const [bankInfo, setBankInfo] = useState({
    bankName: "",
    accountType: "checking",
    routingLast4: "",
    accountLast4: "",
  });
  const [cardInfo, setCardInfo] = useState({
    brand: "",
    last4: "",
    expMonth: 0,
    expYear: 0,
  });
  const [paymentLoaded, setPaymentLoaded] = useState(false);

  // ---------- UPDATE PAYMENT METHOD ----------
  const [updatePmOpen, setUpdatePmOpen] = useState(false);
  const [updatePmMode, setUpdatePmMode] = useState<"manual" | "link">("manual");
  const [updatePmPayType, setUpdatePmPayType] = useState<"card" | "bank">("card");
  const [updatePmClientSecret, setUpdatePmClientSecret] = useState<string | null>(null);
  const [updatePmLoading, setUpdatePmLoading] = useState(false);
  const [updatePmError, setUpdatePmError] = useState<string | null>(null);

  const handleStartCardUpdate = useCallback(async () => {
    if (!businessId) return;
    setUpdatePmLoading(true);
    setUpdatePmError(null);
    try {
      const { data: session } = await supabaseBrowser.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error("Authentication required");
      const res = await fetch("/api/stripe/update-payment-method", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ businessId, paymentMethodType: "card" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start payment update");
      setUpdatePmClientSecret(data.clientSecret);
      setUpdatePmPayType("card");
      setUpdatePmMode("manual");
      setUpdatePmOpen(true);
    } catch (err) {
      setUpdatePmError(err instanceof Error ? err.message : "Failed to start payment update");
    } finally {
      setUpdatePmLoading(false);
    }
  }, [businessId]);

  const [settingPreferred, setSettingPreferred] = useState(false);

  const handleSetPreferred = useCallback(async (type: "card" | "bank") => {
    if (!businessId || settingPreferred) return;
    setSettingPreferred(true);
    try {
      const { data: session } = await supabaseBrowser.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error("Authentication required");
      const res = await fetch("/api/stripe/update-payment-method", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ businessId, setPreferred: type }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to update" }));
        throw new Error(data.error || "Failed to set preferred method");
      }
      setPaymentType(type);
    } catch (err) {
      setUpdatePmError(err instanceof Error ? err.message : "Failed to set preferred method");
    } finally {
      setSettingPreferred(false);
    }
  }, [businessId, settingPreferred]);

  const handleStartBankUpdate = useCallback(async () => {
    if (!businessId) return;
    setUpdatePmLoading(true);
    setUpdatePmError(null);
    try {
      const { data: session } = await supabaseBrowser.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error("Authentication required");
      const res = await fetch("/api/stripe/update-payment-method", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ businessId, paymentMethodType: "us_bank_account" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start bank setup");
      setUpdatePmClientSecret(data.clientSecret);
      setUpdatePmPayType("bank");
      setUpdatePmMode("link");
      setUpdatePmOpen(true);
    } catch (err) {
      setUpdatePmError(err instanceof Error ? err.message : "Failed to start bank setup");
    } finally {
      setUpdatePmLoading(false);
    }
  }, [businessId]);

  // ---------- REAL BILLING DATA ----------
  const [billingSummary, setBillingSummary] = useState<BillingSummaryRow[]>([]);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);

  // Surge fee breakdown from ad campaigns
  const [surgeInfo, setSurgeInfo] = useState<{ total: number; count: number }>({ total: 0, count: 0 });

  // Load payment info from business.config
  async function loadPaymentInfo() {
    if (!businessId) return;

    try {
      const { data, error } = await supabaseBrowser
        .from("business")
        .select("config")
        .eq("id", businessId)
        .maybeSingle();

      if (error) throw error;

      const cfg = (data?.config ?? {}) as Record<string, any>;

      // Set preferred payment type
      setPaymentType(cfg.paymentMethod === "card" ? "card" : "bank");

      // Always load both — they may both have data
      setCardInfo({
        brand: cfg.cardBrand || cfg.cardName || "",
        last4: cfg.cardLast4 || "",
        expMonth: cfg.cardExpMonth || 0,
        expYear: cfg.cardExpYear || 0,
      });
      setBankInfo({
        bankName: cfg.bankName || "",
        accountType: cfg.accountType || "checking",
        routingLast4: cfg.routingLast4 || "",
        accountLast4: cfg.accountLast4 || "",
      });

      setPaymentLoaded(true);
    } catch (e) {
      console.error("[Billing] Failed to load payment info:", e);
      setPaymentLoaded(true); // Still mark as loaded so UI doesn't hang
    }
  }

  useEffect(() => {
    loadPaymentInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  function planDisplay(p: PlanName) {
    return p === "premium" ? "Premium" : "Basic";
  }

  function nextMonthEffectiveLabel() {
    const d = new Date();
    const y = d.getFullYear();
    const m = d.getMonth();
    const next = new Date(y, m + 1, 1);
    return next.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function openPlanChangeModal(plan: PlanName) {
    setSelectedPlanChange(plan);
    setShowPlanChangeModal(true);
  }

  function confirmPlanChange() {
    if (!selectedPlanChange) return;

    if (selectedPlanChange === currentPlan) {
      setShowPlanChangeModal(false);
      return;
    }

    // This is UI-only until you wire business_plan_changes RPC/table writes.
    const effectiveDateLabel = nextMonthEffectiveLabel();

    const note =
      selectedPlanChange === "basic"
        ? "Premium service will remain active through the end of the current billing period. Basic begins on the 1st of next month. No partial refunds."
        : "Premium begins on the 1st of next month. No partial refunds. (Upgrades may be prorated later if enabled.)";

    setPendingPlanChange({
      requestedPlan: selectedPlanChange,
      effectiveDateLabel,
      note,
    });

    setShowPlanChangeModal(false);
  }

  const downgradeNote =
    "Changing from Premium to Basic takes effect at the end of the current billing period. No partial refunds. Premium-only features will stop on the 1st of next month.";

  async function loadInvoicesAndSummaries() {
    if (!businessId) return;

    setBillingLoading(true);
    setBillingError(null);

    try {
      // Prefer view
      let invoiceHeaders: InvoiceHeader[] = [];

      const viewAttempt = await supabaseBrowser
        .from("v_invoices_read")
        .select("*")
        .eq("business_id", businessId)
        .order("period_end", { ascending: false })
        .limit(12);

      if (!viewAttempt.error) {
        invoiceHeaders = (viewAttempt.data ?? []) as InvoiceHeader[];
      } else {
        // fallback to base table
        const baseAttempt = await supabaseBrowser
          .from("invoices")
          .select("id,business_id,period_start,period_end,created_at,status,subtotal_cents,total_cents,locked_at")
          .eq("business_id", businessId)
          .order("period_end", { ascending: false })
          .limit(12);

        if (baseAttempt.error) throw baseAttempt.error;
        invoiceHeaders = (baseAttempt.data ?? []) as InvoiceHeader[];
      }

      const rows: BillingSummaryRow[] = [];

      for (const inv of invoiceHeaders) {
        const invoiceId = inv.id;

        // Pull invoice bundle via RPC
const { data: rpcData, error: rpcErr } = await supabaseBrowser.rpc("get_invoice_with_lines", {
  p_invoice_id: invoiceId,
});


        if (rpcErr) throw rpcErr;

        const invoiceObj = (rpcData as any)?.invoice ?? inv;
        const linesArr = ((rpcData as any)?.lines ?? []) as InvoiceLine[];

        // Aggregate by line_type
        let premiumFee = 0;
        let addOns = 0;
        let tpms = 0;
        let progressive = 0;
        let basicFees = 0;
        let ccFees = 0;
        let ads = 0;
        let adjustments = 0;

        for (const line of linesArr) {
          const amt = Number(line.amount_cents ?? 0) * Number(line.quantity ?? 1);
          switch (line.line_type) {
            case "premium_subscription":
            case "premium_proration":
              premiumFee += amt;
              break;
            case "addon":
              addOns += amt;
              break;
            case "tpms":
              tpms += amt;
              break;
            case "ad_campaign":
              ads += amt;
              break;
            case "platform_fee_basic":
              basicFees += amt;
              break;
            case "progressive_payout_fee":
              progressive += amt;
              break;
            case "credit_card_fee":
              ccFees += amt;
              break;
            case "adjustment":
            default:
              adjustments += amt;
              break;
          }
        }

        const totalCents = Number(invoiceObj?.total_cents ?? invoiceObj?.subtotal_cents ?? premiumFee + addOns + tpms + progressive + basicFees + ccFees + ads + adjustments);

        const periodEnd = String(invoiceObj?.period_end ?? invoiceObj?.periodEnd ?? invoiceObj?.created_at ?? "");
        const monthLabel =
          periodEnd && !Number.isNaN(new Date(periodEnd).getTime())
            ? new Date(periodEnd).toLocaleDateString("en-US", { month: "long", year: "numeric" })
            : "Unknown";

        rows.push({
          month: monthLabel,
          premiumFeeCents: premiumFee,
          addOnsCents: addOns,
          tpmsCents: tpms,
          progressivePayoutsCents: progressive,
          basicFeesCents: basicFees,
          ccFeesCents: ccFees,
          advertisingCents: ads,
          adjustmentsCents: adjustments,
          totalCents,
          invoiceId,
          invoiceStatus: String(invoiceObj?.status ?? inv.status ?? ""),
          lockedAt: (invoiceObj as any)?.locked_at ?? inv.locked_at ?? null,
        });
      }

      setBillingSummary(rows);
    } catch (e) {
      setBillingError(normalizeErr(e));
    } finally {
      setBillingLoading(false);
    }
  }

  useEffect(() => {
    loadInvoicesAndSummaries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  // Load surge fee data from ad campaigns
  useEffect(() => {
    let mounted = true;
    async function loadSurge() {
      if (!businessId) return;
      const { data } = await supabaseBrowser
        .from("business_ad_campaigns")
        .select("surge_fee_cents")
        .eq("business_id", businessId)
        .gt("surge_fee_cents", 0);
      if (mounted && data) {
        setSurgeInfo({
          total: data.reduce((s: number, c: { surge_fee_cents: number }) => s + (c.surge_fee_cents || 0), 0),
          count: data.length,
        });
      }
    }
    loadSurge();
    return () => { mounted = false; };
  }, [businessId]);

  const planCardBase: React.CSSProperties = {
    borderRadius: "16px",
    padding: "2rem",
    position: "relative",
  };

  // Compute current month expected bill (real-time from all cost sources)
  const currentMonthLabel = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const currentMonthBill = billingSummary.find((b) => b.month === currentMonthLabel);

  // Always compute real-time expected total from active selections + receipts
  const planCostCents = isPremium ? premiumPriceCents : 0;
  // LetsGo fee: Basic plan pays 10% per receipt (capped at $5); Premium does not
  const letsGoFeesCents = isPremium ? 0 : platformFeesCents;
  // Credit card processing fee: applies when payment method is card (no linked bank)
  // 3.5% of billable total (covers Stripe 2.9% + $0.30/txn + margin)
  const subtotalBeforeCcFee = planCostCents + activeAddOnsCents + activeCampaignsCents + tpmsActiveCents + progressivePayoutsCents + letsGoFeesCents;
  const ccFeeEstimateCents = paymentType === "card" ? Math.round(subtotalBeforeCcFee * ccFeeBps / 10_000) : 0;
  // Combined Advertising & Add-ons (includes TPMS)
  const advertisingAddOnsCents = activeAddOnsCents + activeCampaignsCents + tpmsActiveCents;
  const realTimeTotal = subtotalBeforeCcFee + ccFeeEstimateCents + pendingAdjTotalCents;

  // Use the higher of: invoice total (if exists) or real-time estimate
  const expectedTotal = currentMonthBill
    ? Math.max(currentMonthBill.totalCents + pendingAdjTotalCents, realTimeTotal)
    : realTimeTotal;

  // Build breakdown from real-time data (more accurate than invoice alone)
  // Combine invoice-applied adjustments + pending adjustments
  const totalAdjCents = (currentMonthBill?.adjustmentsCents ?? 0) + pendingAdjTotalCents;

  const breakdown = currentMonthBill
    ? [
        { label: "Plan Fee", cents: Math.max(currentMonthBill.premiumFeeCents + currentMonthBill.basicFeesCents, planCostCents), color: colors.primary },
        { label: "Progressive Payouts", cents: Math.max(currentMonthBill.progressivePayoutsCents, progressivePayoutsCents), color: colors.accent },
        { label: "Advertising & Add-ons", cents: Math.max(currentMonthBill.addOnsCents + currentMonthBill.advertisingCents + currentMonthBill.tpmsCents, advertisingAddOnsCents), color: colors.secondary },
        { label: "LetsGo Fees", cents: !isPremium ? Math.max(currentMonthBill.basicFeesCents, letsGoFeesCents) : 0, color: "#fb7185" },
        { label: "Credit Card Fees", cents: paymentType === "card" ? Math.max(currentMonthBill.ccFeesCents, ccFeeEstimateCents) : 0, color: colors.warning },
        { label: "Adjustments", cents: totalAdjCents, color: totalAdjCents < 0 ? colors.success : "rgba(255,255,255,0.6)" },
      ]
    : [
        { label: isPremium ? "Premium Subscription" : "Basic (Pay-per-receipt)", cents: planCostCents, color: colors.primary },
        { label: "Progressive Payouts", cents: progressivePayoutsCents, color: colors.accent },
        { label: "Advertising & Add-ons", cents: advertisingAddOnsCents, color: colors.secondary },
        { label: "LetsGo Fees (10%)", cents: letsGoFeesCents, color: "#fb7185" },
        { label: `Credit Card Fees (${(ccFeeBps / 100).toFixed(1)}%)`, cents: ccFeeEstimateCents, color: colors.warning },
        ...(pendingAdjTotalCents !== 0 ? [{ label: "Adjustments", cents: pendingAdjTotalCents, color: pendingAdjTotalCents < 0 ? colors.success : "rgba(255,255,255,0.6)" }] : []),
      ];

  return (
    <div>
      {/* Billing timeline banner */}
      <BillingBanner />

      {/* Expected Monthly Bill */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(20,184,166,0.12) 0%, rgba(6,182,212,0.08) 100%)",
          border: `1px solid ${colors.primary}40`,
          borderRadius: "16px",
          padding: "2rem",
          marginBottom: "1.5rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
          <div>
            <div style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.6)", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
              Expected Monthly Bill
            </div>
            <div style={{ fontSize: "3rem", fontWeight: 900, color: "#fff", lineHeight: 1 }}>
              {billingLoading ? "..." : moneyCents(expectedTotal)}
            </div>
            <div style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.55)", marginTop: "0.5rem" }}>
              {currentMonthLabel}{currentMonthBill ? "" : " (estimate)"}
            </div>
          </div>
          <div
            style={{
              padding: "0.5rem 1rem",
              background: currentMonthBill?.invoiceStatus === "paid" ? `${colors.success}20` : `${colors.warning}20`,
              border: `1px solid ${currentMonthBill?.invoiceStatus === "paid" ? colors.success : colors.warning}50`,
              borderRadius: "8px",
              fontSize: "0.75rem",
              fontWeight: 700,
              color: currentMonthBill?.invoiceStatus === "paid" ? colors.success : colors.warning,
              textTransform: "uppercase",
            }}
          >
            {currentMonthBill?.invoiceStatus || "Pending"}
          </div>
        </div>

        {breakdown.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.75rem" }}>
            {breakdown.map((item) => (
              <div
                key={item.label}
                style={{
                  padding: "0.75rem 1rem",
                  background: "rgba(255,255,255,0.04)",
                  borderRadius: "10px",
                  borderLeft: `3px solid ${item.color}`,
                }}
              >
                <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.55)", marginBottom: "0.25rem", textTransform: "uppercase", fontWeight: 600 }}>
                  {item.label}
                </div>
                <div style={{ fontSize: "1.1rem", fontWeight: 900, color: item.color, fontFamily: '"Space Mono", monospace' }}>
                  {moneyCents(item.cents)}
                </div>
              </div>
            ))}
          </div>
        )}

        {!currentMonthBill && !billingLoading && (
          <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)", marginTop: "0.75rem" }}>
            No invoice generated for this month yet. Estimate based on current plan.
          </div>
        )}
      </div>

      {/* Pending Account Adjustments (credits/charges) */}
      <PendingAdjustments businessId={businessId} colors={colors} />

      {/* Choose Your Plan */}
      <div
        style={{
          background: "rgba(255, 255, 255, 0.03)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "16px",
          padding: "2rem",
          marginBottom: "1.5rem",
        }}
      >
        <div style={{ fontSize: "1.5rem", fontWeight: 900, marginBottom: "0.5rem", textAlign: "center" }}>
          Choose Your Package
        </div>
        <div style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.6)", marginBottom: "2rem", textAlign: "center" }}>
          Choose Basic or Premium. Advertising is an optional package you can add on Premium.
        </div>

        {/* Pending change banner (UI-only) */}
        {pendingPlanChange && (
          <div
            style={{
              marginBottom: "1.5rem",
              padding: "1rem 1.25rem",
              background: "rgba(6, 182, 212, 0.10)",
              border: "1px solid rgba(6, 182, 212, 0.30)",
              borderRadius: "12px",
              color: "rgba(255,255,255,0.92)",
            }}
          >
            <div style={{ fontWeight: 900, marginBottom: "0.35rem" }}>
              Scheduled plan change: {planDisplay(currentPlan)} → {planDisplay(pendingPlanChange.requestedPlan)}
            </div>
            <div style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.75)", lineHeight: 1.5 }}>
              Effective: <b>{pendingPlanChange.effectiveDateLabel}</b>. {pendingPlanChange.note}
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", marginBottom: "1.5rem" }}>
          {/* Basic Plan */}
          <div
            style={{
              ...planCardBase,
              background: currentPlan === "basic" ? `rgba(249, 115, 22, 0.10)` : "rgba(255, 255, 255, 0.02)",
              border: currentPlan === "basic" ? `2px solid ${colors.secondary}` : "2px solid rgba(255, 255, 255, 0.10)",
            }}
          >
            {currentPlan === "basic" && (
              <div
                style={{
                  position: "absolute",
                  top: "1rem",
                  right: "1rem",
                  background: colors.secondary,
                  color: "white",
                  padding: "0.375rem 0.75rem",
                  borderRadius: "6px",
                  fontSize: "0.75rem",
                  fontWeight: 900,
                }}
              >
                CURRENT PLAN
              </div>
            )}

            <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 900, marginBottom: "0.5rem" }}>Basic</div>
              <div style={{ fontSize: "2.4rem", fontWeight: 900, color: colors.secondary, marginBottom: "0.25rem" }}>
                No Upfront
              </div>
              <div style={{ fontSize: "2.4rem", fontWeight: 900, color: colors.secondary }}>Costs</div>
              <div style={{ fontSize: "0.875rem", color: "rgba(255, 255, 255, 0.6)" }}>Pay later</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.5rem" }}>
              {[
                "Get discovered by local users",
                "Pay only for real customers",
                "Verified customers via receipt redemption system",
                "No monthly subscription",
                "No paying for clicks or views",
                "Basic analytics",
                "Zero risk",
              ].map((feature) => (
                <div key={feature} style={{ display: "flex", gap: "0.5rem", fontSize: "0.875rem" }}>
                  <CheckCircle size={16} style={{ color: colors.success, flexShrink: 0, marginTop: "0.125rem" }} />
                  <span>{feature}</span>
                </div>
              ))}

              <div style={{ marginTop: "0.5rem", paddingTop: "1rem", borderTop: "1px solid rgba(255, 255, 255, 0.1)" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 900, color: colors.secondary, marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Feature Access
                </div>
                {["Access to Discovery", "Access to 5v3v1", "Access to Group Vote"].map((feature) => (
                  <div key={feature} style={{ display: "flex", gap: "0.5rem", fontSize: "0.875rem", marginBottom: "0.5rem" }}>
                    <CheckCircle size={16} style={{ color: colors.secondary, flexShrink: 0, marginTop: "0.125rem" }} />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => openPlanChangeModal("basic")}
              disabled={currentPlan === "basic"}
              style={{
                width: "100%",
                padding: "0.875rem",
                background: currentPlan === "basic" ? "rgba(255, 255, 255, 0.1)" : colors.secondary,
                border: "none",
                borderRadius: "8px",
                color: "white",
                fontSize: "0.875rem",
                fontWeight: 900,
                cursor: currentPlan === "basic" ? "not-allowed" : "pointer",
                opacity: currentPlan === "basic" ? 0.55 : 1,
              }}
            >
              {currentPlan === "basic" ? "Current Plan" : "Switch to Basic"}
            </button>
          </div>

          {/* Premium Plan */}
          <div
            style={{
              ...planCardBase,
              background: currentPlan === "premium" ? `rgba(20, 184, 166, 0.10)` : "rgba(255, 255, 255, 0.02)",
              border: currentPlan === "premium" ? `2px solid ${colors.primary}` : "2px solid rgba(255, 255, 255, 0.10)",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "-12px",
                left: "50%",
                transform: "translateX(-50%)",
                background: "#fbbf24",
                color: "#0f172a",
                padding: "0.375rem 0.75rem",
                borderRadius: "6px",
                fontSize: "0.75rem",
                fontWeight: 900,
                letterSpacing: "0.05em",
              }}
            >
              MOST POPULAR
            </div>

            {currentPlan === "premium" && (
              <div
                style={{
                  position: "absolute",
                  top: "1rem",
                  right: "1rem",
                  background: colors.primary,
                  color: "white",
                  padding: "0.375rem 0.75rem",
                  borderRadius: "6px",
                  fontSize: "0.75rem",
                  fontWeight: 900,
                }}
              >
                CURRENT PLAN
              </div>
            )}

            <div style={{ textAlign: "center", marginBottom: "1.5rem", marginTop: "0.5rem" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 900, marginBottom: "0.5rem" }}>Premium Subscription</div>
              <div style={{ fontSize: "2.5rem", fontWeight: 900, color: colors.primary }}>{moneyCents(premiumPriceCents)}</div>
              <div style={{ fontSize: "0.875rem", color: "rgba(255, 255, 255, 0.6)" }}>per month</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.5rem" }}>
              {[
                "Get discovered by local users",
                "Verified customers via receipt redemption system",
                "No paying for clicks or views",
                "No LetsGo fee from Basic section",
                "Upload 1 video daily",
                "Up to 5 live videos at once",
                "Priority placement",
                "Detailed analytics dashboard",
              ].map((feature) => (
                <div key={feature} style={{ display: "flex", gap: "0.5rem", fontSize: "0.875rem" }}>
                  <CheckCircle size={16} style={{ color: colors.success, flexShrink: 0, marginTop: "0.125rem" }} />
                  <span>{feature}</span>
                </div>
              ))}

              <div style={{ marginTop: "0.5rem", paddingTop: "1rem", borderTop: "1px solid rgba(255, 255, 255, 0.1)" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 900, color: colors.primary, marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Feature Access
                </div>
                {["Access to Everything in Basic", "Access to Events", "Access to User Experiences", "Access to Date Night Generator"].map((feature, idx) => (
                  <div key={feature} style={{ display: "flex", gap: "0.5rem", fontSize: "0.875rem", marginBottom: "0.5rem" }}>
                    <CheckCircle size={16} style={{ color: colors.primary, flexShrink: 0, marginTop: "0.125rem" }} />
                    <span style={{ fontWeight: idx === 0 ? 800 : 500 }}>{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => openPlanChangeModal("premium")}
              disabled={currentPlan === "premium"}
              style={{
                width: "100%",
                padding: "0.875rem",
                background: currentPlan === "premium" ? "rgba(255, 255, 255, 0.1)" : colors.primary,
                border: "none",
                borderRadius: "8px",
                color: "white",
                fontSize: "0.875rem",
                fontWeight: 900,
                cursor: currentPlan === "premium" ? "not-allowed" : "pointer",
                opacity: currentPlan === "premium" ? 0.55 : 1,
              }}
            >
              {currentPlan === "premium" ? "Current Plan" : "Upgrade to Premium"}
            </button>
          </div>
        </div>

        <div
          style={{
            padding: "0.85rem 1rem",
            borderRadius: "12px",
            background: "rgba(249, 115, 22, 0.10)",
            border: "1px solid rgba(249, 115, 22, 0.28)",
            color: "rgba(255,255,255,0.85)",
            fontSize: "0.9rem",
            lineHeight: 1.55,
          }}
        >
          <AlertCircle size={16} style={{ color: colors.warning, verticalAlign: "-3px", marginRight: "0.4rem" }} />
          {downgradeNote}
        </div>
      </div>

      {/* Billing & Payment */}
      <div
        style={{
          background: "rgba(255, 255, 255, 0.03)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "16px",
          padding: "2rem",
          marginBottom: "1.5rem",
        }}
      >
        <div style={{ fontSize: "1.5rem", fontWeight: 900, marginBottom: "0.5rem" }}>Billing & Payment</div>
        <div style={{ fontSize: "0.875rem", color: "rgba(255, 255, 255, 0.6)", marginBottom: "2rem" }}>
          Secure payment setup to process your transactions smoothly.
        </div>

        <div
          style={{
            background: "rgba(16, 185, 129, 0.1)",
            border: "1px solid rgba(16, 185, 129, 0.2)",
            borderRadius: "12px",
            padding: "1rem",
            marginBottom: "1.5rem",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <CheckCircle size={20} style={{ color: colors.success, flexShrink: 0 }} />
          <div style={{ fontSize: "0.875rem" }}>
            Your payment information is encrypted and secure. We never store full card details.
          </div>
        </div>

        <div
          style={{
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "12px",
            padding: "1.5rem",
            marginBottom: "1.25rem",
          }}
        >
          <div style={{ fontSize: "1.125rem", fontWeight: 900, display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
            <DollarSign size={20} style={{ color: colors.primary }} />
            Payment Methods
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            {/* Bank Card */}
            <div
              style={{
                padding: "1.25rem",
                borderRadius: "12px",
                border: paymentType === "bank" ? `2px solid ${colors.primary}` : "1px solid rgba(255,255,255,0.1)",
                background: paymentType === "bank" ? "rgba(20,184,166,0.08)" : "rgba(255,255,255,0.02)",
                position: "relative",
              }}
            >
              {paymentType === "bank" && (
                <span style={{
                  position: "absolute", top: "0.75rem", right: "0.75rem",
                  padding: "0.2rem 0.5rem", background: `${colors.success}20`, color: colors.success,
                  borderRadius: "4px", fontSize: "0.65rem", fontWeight: 900, textTransform: "uppercase",
                }}>
                  Preferred
                </span>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
                <DollarSign size={18} style={{ color: paymentType === "bank" ? colors.primary : "rgba(255,255,255,0.4)" }} />
                <span style={{ fontWeight: 900, fontSize: "0.95rem" }}>Bank Account (ACH)</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <Info label="Bank Name" value={bankInfo.bankName || "Not set"} />
                <Info label="Account Type" value={bankInfo.accountType === "checking" ? "Checking" : "Savings"} />
                <Info label="Account" value={bankInfo.accountLast4 ? `••••${bankInfo.accountLast4}` : "—"} mono />
              </div>
              {paymentType !== "bank" && bankInfo.bankName && (
                <button
                  onClick={() => handleSetPreferred("bank")}
                  disabled={settingPreferred}
                  style={{
                    marginTop: "0.75rem",
                    width: "100%",
                    padding: "0.5rem",
                    background: "rgba(20,184,166,0.1)",
                    border: `1px solid ${colors.primary}60`,
                    borderRadius: "8px",
                    color: colors.primary,
                    fontSize: "0.75rem",
                    fontWeight: 900,
                    cursor: settingPreferred ? "wait" : "pointer",
                    opacity: settingPreferred ? 0.6 : 1,
                  }}
                >
                  {settingPreferred ? "Saving..." : "Set as Preferred"}
                </button>
              )}
            </div>

            {/* Card */}
            <div
              style={{
                padding: "1.25rem",
                borderRadius: "12px",
                border: paymentType === "card" ? `2px solid ${colors.primary}` : "1px solid rgba(255,255,255,0.1)",
                background: paymentType === "card" ? "rgba(20,184,166,0.08)" : "rgba(255,255,255,0.02)",
                position: "relative",
              }}
            >
              {paymentType === "card" && (
                <span style={{
                  position: "absolute", top: "0.75rem", right: "0.75rem",
                  padding: "0.2rem 0.5rem", background: `${colors.success}20`, color: colors.success,
                  borderRadius: "4px", fontSize: "0.65rem", fontWeight: 900, textTransform: "uppercase",
                }}>
                  Preferred
                </span>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
                <CreditCard size={18} style={{ color: paymentType === "card" ? colors.primary : "rgba(255,255,255,0.4)" }} />
                <span style={{ fontWeight: 900, fontSize: "0.95rem" }}>Credit / Debit Card</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <Info label="Card" value={cardInfo.brand && cardInfo.last4 ? `${cardInfo.brand} ****${cardInfo.last4}` : "Not set"} mono />
                <Info label="Expiration" value={cardInfo.expMonth && cardInfo.expYear ? `${String(cardInfo.expMonth).padStart(2, "0")}/${String(cardInfo.expYear).slice(-2)}` : "—"} mono />
              </div>
              {paymentType !== "card" && cardInfo.last4 && (
                <button
                  onClick={() => handleSetPreferred("card")}
                  disabled={settingPreferred}
                  style={{
                    marginTop: "0.75rem",
                    width: "100%",
                    padding: "0.5rem",
                    background: "rgba(20,184,166,0.1)",
                    border: `1px solid ${colors.primary}60`,
                    borderRadius: "8px",
                    color: colors.primary,
                    fontSize: "0.75rem",
                    fontWeight: 900,
                    cursor: settingPreferred ? "wait" : "pointer",
                    opacity: settingPreferred ? 0.6 : 1,
                  }}
                >
                  {settingPreferred ? "Saving..." : "Set as Preferred"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Update Payment Method */}
        {!updatePmOpen ? (
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button
              style={{
                padding: "0.75rem 1.25rem",
                background: `${colors.primary}20`,
                border: `1px solid ${colors.primary}`,
                borderRadius: "10px",
                color: colors.primary,
                fontSize: "0.875rem",
                fontWeight: 900,
                cursor: updatePmLoading ? "wait" : "pointer",
                opacity: updatePmLoading ? 0.6 : 1,
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
              onClick={handleStartCardUpdate}
              disabled={updatePmLoading}
            >
              <CreditCard size={14} />
              {updatePmLoading ? "Loading..." : "Update Card"}
            </button>
            <button
              style={{
                padding: "0.75rem 1.25rem",
                background: `${colors.accent}20`,
                border: `1px solid ${colors.accent}`,
                borderRadius: "10px",
                color: colors.accent,
                fontSize: "0.875rem",
                fontWeight: 900,
                cursor: updatePmLoading ? "wait" : "pointer",
                opacity: updatePmLoading ? 0.6 : 1,
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
              onClick={handleStartBankUpdate}
              disabled={updatePmLoading}
            >
              <DollarSign size={14} />
              {updatePmLoading ? "Loading..." : "Update Bank Account"}
            </button>
            <button
              style={{
                padding: "0.75rem 1.25rem",
                background: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                borderRadius: "10px",
                color: "white",
                fontSize: "0.875rem",
                fontWeight: 900,
                cursor: updatePmLoading ? "wait" : "pointer",
                opacity: updatePmLoading ? 0.6 : 1,
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
              onClick={() => { setUpdatePmPayType("card"); setUpdatePmMode("link"); handleStartCardUpdate(); }}
              disabled={updatePmLoading}
            >
              <RefreshCw size={14} />
              Use Stripe Link
            </button>
          </div>
        ) : (
          <div
            style={{
              background: "rgba(255, 255, 255, 0.05)",
              border: `1px solid ${colors.primary}40`,
              borderRadius: "12px",
              padding: "1.5rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div style={{ fontSize: "0.875rem", fontWeight: 900, color: colors.primary }}>
                {updatePmPayType === "bank"
                  ? "Update Bank Account"
                  : updatePmMode === "manual"
                    ? "Enter New Card Details"
                    : "Update via Stripe Link"}
              </div>
              <button
                onClick={() => { setUpdatePmOpen(false); setUpdatePmClientSecret(null); setUpdatePmError(null); }}
                style={{
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: "6px",
                  color: "rgba(255,255,255,0.4)",
                  padding: "0.25rem 0.75rem",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>

            {updatePmClientSecret && stripePromise ? (
              <Elements
                stripe={stripePromise}
                key={updatePmMode}
                options={{
                  clientSecret: updatePmClientSecret,
                  appearance: {
                    theme: "night",
                    variables: {
                      colorPrimary: colors.primary,
                      colorBackground: "#1a1a2e",
                      colorText: "#ffffff",
                      colorTextSecondary: "rgba(255,255,255,0.5)",
                      borderRadius: "8px",
                    },
                  },
                }}
              >
                <UpdatePaymentForm
                  businessId={businessId}
                  mode={updatePmMode}
                  payType={updatePmPayType}
                  clientSecret={updatePmClientSecret}
                  onSuccess={() => {
                    setUpdatePmOpen(false);
                    setUpdatePmClientSecret(null);
                    loadPaymentInfo();
                  }}
                  onError={(msg) => setUpdatePmError(msg)}
                />
              </Elements>
            ) : (
              <div style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.85rem" }}>Loading payment form...</div>
            )}
          </div>
        )}
        {updatePmError && (
          <div style={{ marginTop: "0.75rem", background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", padding: "0.75rem", borderRadius: "10px", color: "#fca5a5", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <AlertCircle size={14} /> {updatePmError}
          </div>
        )}
      </div>

      {/* Monthly Billing Summary (REAL) */}
      <div
        style={{
          background: "rgba(255, 255, 255, 0.03)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "16px",
          padding: "2rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "1.25rem", fontWeight: 900, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <BarChart3 size={20} style={{ color: colors.primary }} />
            Monthly Billing Summary
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              style={{
                padding: "0.5rem 1rem",
                background: `${colors.success}20`,
                border: `1px solid ${colors.success}`,
                borderRadius: "8px",
                color: colors.success,
                fontSize: "0.75rem",
                fontWeight: 900,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
              onClick={() => alert("(Placeholder) CSV export")}
            >
              <Download size={14} /> CSV
            </button>
            <button
              style={{
                padding: "0.5rem 1rem",
                background: `${colors.accent}20`,
                border: `1px solid ${colors.accent}`,
                borderRadius: "8px",
                color: colors.accent,
                fontSize: "0.75rem",
                fontWeight: 900,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
              onClick={() => alert("(Placeholder) XLSX export")}
            >
              <Download size={14} /> XLSX
            </button>
          </div>
        </div>

        {surgeInfo.total > 0 && (
          <div
            style={{
              marginBottom: "1rem",
              padding: "0.85rem 1rem",
              background: "rgba(255, 107, 53, 0.08)",
              border: "1px solid rgba(255, 107, 53, 0.25)",
              borderRadius: "10px",
              color: "rgba(255,255,255,0.88)",
              fontSize: "0.85rem",
              lineHeight: 1.55,
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span style={{ fontSize: "1rem" }}>🔥</span>
            Your advertising costs include <b>{moneyCents(surgeInfo.total)}</b> in Hot Day surge pricing
            across {surgeInfo.count} campaign{surgeInfo.count !== 1 ? "s" : ""}.
            Surge fees are charged when campaigns overlap high-demand dates.
          </div>
        )}

        {billingLoading && (
          <div style={{ padding: "1rem", color: "rgba(255,255,255,0.7)", fontWeight: 900 }}>
            Loading invoices…
          </div>
        )}
        {billingError && (
          <div
            style={{
              padding: "1rem",
              marginBottom: "1rem",
              background: "rgba(239,68,68,0.10)",
              border: "1px solid rgba(239,68,68,0.30)",
              borderRadius: "12px",
              color: "rgba(255,255,255,0.9)",
              fontWeight: 900,
            }}
          >
            Billing load failed: {billingError}
          </div>
        )}

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.1)" }}>
                {["Month", "Premium", "Add-ons", "TPMS", "Progressive", "Basic Fees", "CC Fees", "Advertising", "Adjustments", "Total", "Invoice"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "1rem",
                      textAlign: h === "Month" || h === "Invoice" ? "left" : "right",
                      fontSize: "0.875rem",
                      color: "rgba(255, 255, 255, 0.6)",
                      fontWeight: 900,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {billingSummary.map((bill) => (
                <tr key={bill.invoiceId} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                  <td style={{ padding: "1rem", fontSize: "0.875rem", fontWeight: 900, textAlign: "left" }}>
                    {bill.month}
                    <div style={{ marginTop: "0.25rem", fontSize: "0.7rem", color: "rgba(255,255,255,0.45)" }}>
                      {bill.invoiceStatus}{bill.lockedAt ? " • locked" : ""}
                    </div>
                  </td>

                  <td style={cellRight()}>{moneyCents(bill.premiumFeeCents)}</td>
                  <td style={cellRight()}>{moneyCents(bill.addOnsCents)}</td>
                  <td style={cellRight()}>{moneyCents(bill.tpmsCents)}</td>
                  <td style={{ ...cellRight(), color: colors.primary }}>{moneyCents(bill.progressivePayoutsCents)}</td>
                  <td style={{ ...cellRight(), color: colors.secondary }}>{moneyCents(bill.basicFeesCents)}</td>
                  <td style={{ ...cellRight(), color: colors.warning }}>{moneyCents(bill.ccFeesCents)}</td>
                  <td style={cellRight()}>
                    {bill.advertisingCents > 0 && surgeInfo.total > 0 ? (
                      <span title="Includes Hot Day surge fees">🔥 {moneyCents(bill.advertisingCents)}</span>
                    ) : (
                      moneyCents(bill.advertisingCents)
                    )}
                  </td>
                  <td style={cellRight()}>{moneyCents(bill.adjustmentsCents)}</td>
                  <td style={{ ...cellRight(), fontWeight: 900, color: colors.success }}>{moneyCents(bill.totalCents)}</td>

                  <td style={{ padding: "1rem", textAlign: "left" }}>
                    <button
                      type="button"
                      onClick={() => alert(`Invoice ID: ${bill.invoiceId}`)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: colors.accent,
                        cursor: "pointer",
                        fontWeight: 900,
                      }}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}

              {billingSummary.length === 0 && !billingLoading ? (
                <tr>
                  <td colSpan={11} style={{ padding: "2rem", textAlign: "center", color: "rgba(255,255,255,0.55)" }}>
                    No invoices found for this business yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: "1rem", fontSize: "0.85rem", color: "rgba(255,255,255,0.7)", lineHeight: 1.55 }}>
          <b>Billing timing:</b> Charges post once at the end of each month (Nebraska time). Items may show as <b>Purchased</b> immediately and become <b>Paid in Full</b> after the month-end billing run succeeds.
        </div>

        <div style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "rgba(255,255,255,0.55)" }}>
          Data source: invoices + invoice_line_items via RPC get_invoice_with_lines().
        </div>
      </div>

      {/* Plan Change Modal (UI-only for now) */}
      {showPlanChangeModal && selectedPlanChange && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.8)",
            backdropFilter: "blur(10px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "2rem",
          }}
          onClick={() => setShowPlanChangeModal(false)}
        >
          <div
            style={{
              background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "16px",
              padding: "2rem",
              maxWidth: "520px",
              width: "100%",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: "1.5rem", fontWeight: 900, marginBottom: "0.75rem" }}>
              {selectedPlanChange === "premium" ? "Upgrade to Premium?" : "Switch to Basic?"}
            </div>

            <div style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.75)", lineHeight: 1.6, marginBottom: "1.5rem" }}>
              Effective date: <b>{nextMonthEffectiveLabel()}</b>
            </div>

            <div style={{ display: "flex", gap: "1rem" }}>
              <button
                onClick={() => setShowPlanChangeModal(false)}
                style={{
                  flex: 1,
                  padding: "0.875rem",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  borderRadius: "8px",
                  color: "white",
                  fontSize: "0.875rem",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>

              <button
                onClick={confirmPlanChange}
                style={{
                  flex: 1,
                  padding: "0.875rem",
                  background:
                    selectedPlanChange === "premium"
                      ? `linear-gradient(135deg, ${colors.primary} 0%, ${colors.accent} 100%)`
                      : `linear-gradient(135deg, ${colors.secondary} 0%, ${colors.warning} 100%)`,
                  border: "none",
                  borderRadius: "8px",
                  color: "white",
                  fontSize: "0.875rem",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Confirm Change
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function cellRight(): React.CSSProperties {
    return {
      padding: "1rem",
      textAlign: "right",
      fontSize: "0.875rem",
      fontFamily: '"Space Mono", monospace',
      fontWeight: 900,
      whiteSpace: "nowrap",
    };
  }

  function Info({ label, value, mono, icon }: { label: string; value: string; mono?: boolean; icon?: React.ReactNode }) {
    return (
      <div>
        <div style={{ fontSize: "0.75rem", color: "rgba(255, 255, 255, 0.5)", marginBottom: "0.25rem" }}>{label}</div>
        <div style={{ fontWeight: 900, display: "flex", alignItems: "center", gap: "0.5rem", fontFamily: mono ? '"Space Mono", monospace' : "inherit" }}>
          {icon ? icon : null}
          {value}
        </div>
      </div>
    );
  }
}

// Separate component for Stripe Elements (must be inside <Elements> provider)
function UpdatePaymentForm({
  businessId,
  mode,
  payType = "card",
  clientSecret,
  onSuccess,
  onError,
}: {
  businessId: string;
  mode: "manual" | "link";
  payType?: "card" | "bank";
  clientSecret: string;
  onSuccess: () => void;
  onError: (msg: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [confirming, setConfirming] = useState(false);
  const [success, setSuccess] = useState(false);
  const [localError, setLocalError] = useState("");

  // Wrap onError to also show error locally inside the form
  const showError = (msg: string) => {
    setLocalError(msg);
    onError(msg);
  };

  // Save payment method to DB after Stripe confirms
  const savePaymentMethod = async (pmId: string) => {
    const { data: session } = await supabaseBrowser.auth.getSession();
    const token = session?.session?.access_token;
    if (!token) { showError("Authentication required"); return; }

    const res = await fetch("/api/stripe/update-payment-method", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ businessId, paymentMethodId: pmId }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Failed to save" }));
      showError(data.error || "Failed to save payment method");
      return;
    }

    setSuccess(true);
    setTimeout(() => onSuccess(), 1500);
  };

  const handleConfirmManual = async () => {
    if (!stripe || !elements) {
      console.error("[UpdatePaymentForm] stripe or elements not loaded", { stripe: !!stripe, elements: !!elements });
      showError("Payment form is still loading. Please wait a moment and try again.");
      return;
    }
    setConfirming(true);
    showError("");

    try {
      const cardNumberElement = elements.getElement(CardNumberElement);
      if (!cardNumberElement) {
        console.error("[UpdatePaymentForm] CardNumberElement not found");
        showError("Card form not loaded. Please try closing and reopening the form.");
        setConfirming(false);
        return;
      }

      console.log("[UpdatePaymentForm] Confirming card setup...");
      const { error: confirmError, setupIntent } = await stripe.confirmCardSetup(
        clientSecret,
        { payment_method: { card: cardNumberElement } }
      );

      if (confirmError) {
        console.error("[UpdatePaymentForm] confirmCardSetup error:", confirmError);
        showError(confirmError.message || "Payment setup failed. Please try again.");
        return;
      }

      console.log("[UpdatePaymentForm] SetupIntent confirmed:", setupIntent?.id, setupIntent?.status);
      if (setupIntent) {
        const pmId = typeof setupIntent.payment_method === "string"
          ? setupIntent.payment_method
          : (setupIntent.payment_method as { id?: string })?.id || "";
        if (!pmId) { showError("Could not retrieve payment method from Stripe."); return; }
        await savePaymentMethod(pmId);
      } else {
        showError("No setup intent returned from Stripe. Please try again.");
      }
    } catch (err) {
      console.error("[UpdatePaymentForm] Unexpected error:", err);
      showError(err instanceof Error ? err.message : "An unexpected error occurred. Please try again.");
    } finally {
      setConfirming(false);
    }
  };

  const handleConfirmLink = async () => {
    if (!stripe || !elements) {
      showError("Payment form is still loading. Please wait a moment and try again.");
      return;
    }
    setConfirming(true);
    showError("");

    try {
      console.log("[UpdatePaymentForm] Confirming setup via Link...");
      const { error: confirmError, setupIntent } = await stripe.confirmSetup({
        elements,
        redirect: "if_required",
        confirmParams: { return_url: window.location.href },
      });

      if (confirmError) {
        console.error("[UpdatePaymentForm] confirmSetup error:", confirmError);
        showError(confirmError.message || "Payment setup failed. Please try again.");
        return;
      }

      console.log("[UpdatePaymentForm] SetupIntent confirmed:", setupIntent?.id, setupIntent?.status);
      if (setupIntent && (setupIntent.status === "succeeded" || setupIntent.status === "requires_action")) {
        const pmId = typeof setupIntent.payment_method === "string"
          ? setupIntent.payment_method
          : (setupIntent.payment_method as { id?: string })?.id || "";
        if (!pmId) { showError("Could not retrieve payment method from Stripe."); return; }
        await savePaymentMethod(pmId);
      } else {
        showError(`Unexpected setup status: ${setupIntent?.status || "unknown"}. Please try again.`);
      }
    } catch (err) {
      console.error("[UpdatePaymentForm] Unexpected error:", err);
      showError(err instanceof Error ? err.message : "An unexpected error occurred. Please try again.");
    } finally {
      setConfirming(false);
    }
  };

  const handleConfirmBank = async () => {
    if (!stripe || !elements) {
      showError("Payment form is still loading. Please wait a moment and try again.");
      return;
    }
    setConfirming(true);
    showError("");

    try {
      console.log("[UpdatePaymentForm] Confirming US bank account setup...");
      const { error: confirmError, setupIntent } = await stripe.confirmSetup({
        elements,
        redirect: "if_required",
        confirmParams: { return_url: window.location.href },
      });

      if (confirmError) {
        console.error("[UpdatePaymentForm] bank confirmSetup error:", confirmError);
        showError(confirmError.message || "Bank account setup failed. Please try again.");
        return;
      }

      console.log("[UpdatePaymentForm] Bank SetupIntent:", setupIntent?.id, setupIntent?.status);
      if (setupIntent && (setupIntent.status === "succeeded" || setupIntent.status === "requires_action")) {
        const pmId = typeof setupIntent.payment_method === "string"
          ? setupIntent.payment_method
          : (setupIntent.payment_method as { id?: string })?.id || "";
        if (!pmId) { showError("Could not retrieve payment method from Stripe."); return; }
        await savePaymentMethod(pmId);
      } else {
        showError(`Unexpected setup status: ${setupIntent?.status || "unknown"}. Please try again.`);
      }
    } catch (err) {
      console.error("[UpdatePaymentForm] Bank setup error:", err);
      showError(err instanceof Error ? err.message : "An unexpected error occurred. Please try again.");
    } finally {
      setConfirming(false);
    }
  };

  if (success) {
    return (
      <div style={{ background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.3)", padding: "0.75rem", borderRadius: "10px", color: "#6ee7b7", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <CheckCircle size={14} /> Payment method updated successfully!
      </div>
    );
  }

  return (
    <div>
      {localError && (
        <div style={{ marginBottom: "1rem", background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", padding: "0.75rem", borderRadius: "10px", color: "#fca5a5", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <AlertCircle size={14} /> {localError}
        </div>
      )}
      <div style={{ marginBottom: "1rem" }}>
        {payType === "bank" ? (
          <PaymentElement options={{ layout: "tabs" }} />
        ) : mode === "manual" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", marginBottom: "0.375rem", fontWeight: 600 }}>
                Card Number
              </label>
              <div style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "8px", padding: "0.75rem 0.875rem" }}>
                <CardNumberElement options={{ style: { base: { fontSize: "16px", color: "#ffffff", "::placeholder": { color: "rgba(255,255,255,0.35)" }, iconColor: "#14b8a6" }, invalid: { color: "#ef4444", iconColor: "#ef4444" } }, showIcon: true }} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", marginBottom: "0.375rem", fontWeight: 600 }}>
                  Expiration
                </label>
                <div style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "8px", padding: "0.75rem 0.875rem" }}>
                  <CardExpiryElement options={{ style: { base: { fontSize: "16px", color: "#ffffff", "::placeholder": { color: "rgba(255,255,255,0.35)" } }, invalid: { color: "#ef4444" } } }} />
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", marginBottom: "0.375rem", fontWeight: 600 }}>
                  CVC
                </label>
                <div style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "8px", padding: "0.75rem 0.875rem" }}>
                  <CardCvcElement options={{ style: { base: { fontSize: "16px", color: "#ffffff", "::placeholder": { color: "rgba(255,255,255,0.35)" } }, invalid: { color: "#ef4444" } } }} />
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", marginBottom: "0.375rem", fontWeight: 600 }}>
                  ZIP Code
                </label>
                <input
                  type="text"
                  placeholder="12345"
                  maxLength={10}
                  style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "8px", padding: "0.75rem 0.875rem", fontSize: "16px", color: "#ffffff", outline: "none", boxSizing: "border-box" }}
                />
              </div>
            </div>
          </div>
        ) : (
          <PaymentElement options={{ layout: "tabs" }} />
        )}
      </div>
      <button
        type="button"
        onClick={() => {
          setLocalError("");
          if (payType === "bank") handleConfirmBank();
          else if (mode === "manual") handleConfirmManual();
          else handleConfirmLink();
        }}
        disabled={!stripe || confirming}
        style={{
          width: "100%",
          padding: "0.75rem",
          background: confirming ? "rgba(20, 184, 166, 0.3)" : "rgba(20, 184, 166, 0.2)",
          border: "1px solid #14b8a6",
          borderRadius: "10px",
          color: "#14b8a6",
          fontSize: "0.875rem",
          fontWeight: 900,
          cursor: confirming ? "wait" : "pointer",
          opacity: confirming ? 0.6 : 1,
        }}
      >
        {confirming ? "Saving..." : payType === "bank" ? "Save Bank Account" : "Save New Payment Method"}
      </button>
      {!stripe && (
        <div style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "rgba(255,255,255,0.4)" }}>
          Stripe is loading...
        </div>
      )}
    </div>
  );
}

