"use client";

import React, { useEffect, useState, useCallback } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { logAudit, AUDIT_TABS } from "@/lib/auditLog";
import {
  COLORS,
  Badge,
  Card,
  SectionTitle,
  StatCard,
  DataTable,
  FilterPanel,
  ExportButtons,
  formatMoney,
  formatDate,
  formatDateTime,
} from "@/components/admin/components";

// ==================== EXPECTED BILL TYPES ====================
interface BizBreakdown {
  businessId: string;
  businessName: string;
  isActive: boolean;
  isPremium: boolean;
  paymentMethod: string;
  planCostCents: number;
  progressivePayoutsCents: number;
  advertisingAddOnsCents: number;
  letsGoFeesCents: number;
  ccFeesCents: number;
  totalCents: number;
}

interface PlatformTotal {
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

// ==================== TYPES ====================
interface BillingLineItems {
  receipt_payouts: { count: number; amount: number };
  platform_fees: { amount: number };
  letsgo_fee?: number;
  cc_processing_fee?: number;
  premium_subscription?: number;
  advertising?: { name: string; amount: number }[];
  addons?: { name: string; amount: number }[];
}

interface BillingRecord {
  id: string;
  business_id?: string;
  business_name: string;
  business_email?: string;
  billing_address?: string;
  billing_period: string;
  period_start?: string;
  period_end?: string;
  invoice_date: string;
  due_date: string;
  status: string;
  paid_at?: string;
  line_items: BillingLineItems;
  payment_method?: string;
  total_due: number;
}

interface StatementRecord {
  id: string;
  business_id?: string;
  business_name: string;
  business_email?: string;
  statement_period: string;
  generated_at: string;
  sent_at: string | null;
  status: string;
  viewed_at?: string;
  total_receipts: number;
  total_payouts: number;
  total_fees: number;
}

// ==================== BILLING PAGE ====================
async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabaseBrowser.auth.getSession();
  return { Authorization: `Bearer ${session?.access_token || ""}` };
}

// ==================== ADJUSTMENT TYPES ====================
interface AdjustmentRecord {
  id: string;
  business_id: string;
  business_name?: string;
  amount_cents: number;
  type: "credit" | "charge";
  description: string;
  status: "pending" | "applied" | "voided";
  applied_to_invoice_id?: string | null;
  applied_at?: string | null;
  voided_at?: string | null;
  voided_by?: string | null;
  voided_reason?: string | null;
  created_by: string;
  created_by_name?: string;
  created_at: string;
}

interface BizOption {
  id: string;
  business_name: string;
}

export default function BillingPage() {
  // Page tab
  const [activeTab, setActiveTab] = useState<"billing" | "adjustments" | "balances">("billing");

  // Data states
  const [billingData, setBillingData] = useState<BillingRecord[]>([]);
  const [statementsData, setStatementsData] = useState<StatementRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Surge revenue from ad campaigns
  const [surgeRevenue, setSurgeRevenue] = useState(0);

  // Adjustment states
  const [adjustments, setAdjustments] = useState<AdjustmentRecord[]>([]);
  const [adjustmentsLoading, setAdjustmentsLoading] = useState(false);
  const [adjFilter, setAdjFilter] = useState<{ search: string; status: string }>({ search: "", status: "all" });
  const [adjFormOpen, setAdjFormOpen] = useState(false);
  const [adjFormType, setAdjFormType] = useState<"credit" | "charge">("credit");
  const [adjFormAmount, setAdjFormAmount] = useState("");
  const [adjFormDescription, setAdjFormDescription] = useState("");
  const [adjFormBusinessId, setAdjFormBusinessId] = useState("");
  const [adjFormBizSearch, setAdjFormBizSearch] = useState("");
  const [adjFormSubmitting, setAdjFormSubmitting] = useState(false);
  const [bizOptions, setBizOptions] = useState<BizOption[]>([]);

  // Balances tab states
  interface BalanceInvoice {
    id: string;
    billingPeriod: string;
    totalCents: number;
    status: string;
    paidAt: string | null;
    paidVia: string | null;
    dueDate: string;
    invoiceDate: string;
    lineItems: { line_type: string; description: string | null; amount_cents: number; quantity: number | null }[];
  }
  interface BalanceRecord {
    businessId: string;
    businessName: string;
    businessEmail: string;
    paymentMethod: string;
    isPremium: boolean;
    totalBilledCents: number;
    totalPaidCents: number;
    pendingAdjCents: number;
    remainingCents: number;
    invoices: BalanceInvoice[];
    pendingAdjustments: { id: string; amount_cents: number; type: string; description: string; created_at: string }[];
  }
  interface BalanceTotals {
    totalBilledCents: number;
    totalPaidCents: number;
    totalPendingAdjCents: number;
    totalRemainingCents: number;
    businessCount: number;
    paidInFullCount: number;
    outstandingCount: number;
  }
  const [balances, setBalances] = useState<BalanceRecord[]>([]);
  const [balanceTotals, setBalanceTotals] = useState<BalanceTotals | null>(null);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [balanceSearch, setBalanceSearch] = useState("");
  const [balanceFilter, setBalanceFilter] = useState<"all" | "outstanding" | "paid" | "credit">("all");
  const [balanceMonth, setBalanceMonth] = useState("all");
  const [balanceMonthOptions, setBalanceMonthOptions] = useState<{ value: string; label: string }[]>([]);
  const [expandedBalanceBiz, setExpandedBalanceBiz] = useState<string | null>(null);

  const fetchBalances = useCallback(async (month?: string) => {
    setBalancesLoading(true);
    try {
      const headers = await getAuthHeaders();
      const m = month ?? balanceMonth;
      const res = await fetch(`/api/admin/billing/balances${m !== "all" ? `?month=${m}` : ""}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setBalances(data.balances || []);
        setBalanceTotals(data.totals || null);
        if (data.monthOptions) setBalanceMonthOptions(data.monthOptions);
      }
    } catch (err) {
      console.error("Error loading balances:", err);
    } finally {
      setBalancesLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balanceMonth]);

  // UI states - billing filters
  const [billingFilters, setBillingFilters] = useState({ 
    search: "", 
    status: "all", 
    period: "all", 
    dateFrom: "", 
    dateTo: "", 
    minAmount: "", 
    maxAmount: "" 
  });
  const [billingFiltersExpanded, setBillingFiltersExpanded] = useState(false);

  // UI states - statement filters
  const [stmtFilters, setStmtFilters] = useState({ 
    search: "", 
    status: "all", 
    period: "all", 
    dateFrom: "", 
    dateTo: "" 
  });
  const [stmtFiltersExpanded, setStmtFiltersExpanded] = useState(false);

  // Expected bill — period filter
  const [expectedPeriod, setExpectedPeriod] = useState<"day" | "week" | "month" | "year" | "mtd" | "ytd">("month");
  const [expectedRefDate, setExpectedRefDate] = useState(new Date());
  const [platformTotal, setPlatformTotal] = useState<PlatformTotal | null>(null);
  const [bizBreakdowns, setBizBreakdowns] = useState<BizBreakdown[]>([]);
  const [expectedLoading, setExpectedLoading] = useState(true);
  const [periodLabel, setPeriodLabel] = useState("");
  const [bizSearch, setBizSearch] = useState("");
  const [bizPlanFilter, setBizPlanFilter] = useState<"all" | "premium" | "basic">("all");
  const [expandedBizId, setExpandedBizId] = useState<string | null>(null);

  // Selected bill for modal
  const [selectedBill, setSelectedBill] = useState<BillingRecord | null>(null);

  // Action states
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [paymentAttempts, setPaymentAttempts] = useState<{ id: string; invoice_id: string; business_id: string; amount_cents: number; payment_method: string; processor: string; status: string; error_message: string | null; attempted_at: string; completed_at: string | null }[]>([]);

  // Navigate period forward/back
  function navigatePeriod(direction: -1 | 1) {
    setExpectedRefDate(prev => {
      const d = new Date(prev);
      switch (expectedPeriod) {
        case "day": d.setDate(d.getDate() + direction); break;
        case "week": d.setDate(d.getDate() + 7 * direction); break;
        case "month": d.setMonth(d.getMonth() + direction); break;
        case "year": d.setFullYear(d.getFullYear() + direction); break;
      }
      return d;
    });
  }

  // Fetch expected bill data when period or date changes
  useEffect(() => {
    let mounted = true;
    async function loadExpected() {
      setExpectedLoading(true);
      try {
        const dateStr = expectedRefDate.toISOString().split("T")[0];
        const res = await fetch(`/api/admin/billing/expected?period=${expectedPeriod}&date=${dateStr}`);
        if (res.ok) {
          const data = await res.json();
          if (mounted) {
            setPlatformTotal(data.platformTotal);
            setBizBreakdowns(data.businesses);
            setPeriodLabel(data.periodLabel || "");
            setRangeStart(data.rangeStart || "");
            setRangeEnd(data.rangeEnd || "");
          }
        }
      } catch (err) {
        console.error("Error loading expected bills:", err);
      } finally {
        if (mounted) setExpectedLoading(false);
      }
    }
    loadExpected();
    return () => { mounted = false; };
  }, [expectedPeriod, expectedRefDate]);

  const filteredBizBreakdowns = bizBreakdowns.filter(b => {
    if (bizSearch && !b.businessName.toLowerCase().includes(bizSearch.toLowerCase())) return false;
    if (bizPlanFilter === "premium" && !b.isPremium) return false;
    if (bizPlanFilter === "basic" && b.isPremium) return false;
    return true;
  });

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch invoices (business_name/email are snapshotted on the invoice row)
      const { data: invoices, error: invError } = await supabaseBrowser
        .from("invoices")
        .select("*")
        .order("invoice_date", { ascending: false });

      if (invError) throw invError;

      // Transform to BillingRecord format
      const billingRecords: BillingRecord[] = (invoices || []).map((inv: Record<string, unknown>) => ({
        id: String(inv.id),
        business_id: String(inv.business_id || ""),
        business_name: String(inv.business_name || "Unknown"),
        business_email: String(inv.business_email || ""),
        billing_period: String(inv.billing_period || ""),
        invoice_date: String(inv.invoice_date || inv.created_at || ""),
        due_date: String(inv.due_date || ""),
        status: String(inv.status || "pending"),
        paid_at: inv.paid_at ? String(inv.paid_at) : undefined,
        line_items: {
          receipt_payouts: { count: Number(inv.receipt_count || 0), amount: 0 },
          platform_fees: { amount: 0 },
        },
        total_due: Number(inv.total_cents || 0),
        payment_method: String(inv.payment_method || "bank"),
      }));

      setBillingData(billingRecords);

      // Fetch statements (business_name/email are snapshotted on the statement row)
      const { data: statements, error: stmtError } = await supabaseBrowser
        .from("statements")
        .select("*")
        .order("generated_at", { ascending: false });

      if (!stmtError && statements) {
        const stmtRecords: StatementRecord[] = (statements || []).map((stmt: Record<string, unknown>) => ({
          id: String(stmt.id),
          business_id: String(stmt.business_id || ""),
          business_name: String(stmt.business_name || "Unknown"),
          business_email: String(stmt.business_email || ""),
          statement_period: String(stmt.statement_period || ""),
          generated_at: String(stmt.generated_at || stmt.created_at || ""),
          sent_at: stmt.sent_at ? String(stmt.sent_at) : null,
          status: String(stmt.status || "pending"),
          total_receipts: Number(stmt.total_receipts || 0),
          total_payouts: Number(stmt.total_payouts || 0),
          total_fees: Number(stmt.total_fees || 0),
        }));
        setStatementsData(stmtRecords);
      }

      // Fetch surge revenue from ad campaigns
      const { data: surgeData } = await supabaseBrowser
        .from("business_ad_campaigns")
        .select("surge_fee_cents")
        .eq("paid", true)
        .gt("surge_fee_cents", 0);
      if (surgeData) {
        setSurgeRevenue(surgeData.reduce((s: number, c: { surge_fee_cents: number }) => s + (c.surge_fee_cents || 0), 0));
      }

      // Fetch payment attempts
      const { data: attempts } = await supabaseBrowser
        .from("payment_attempts")
        .select("id, invoice_id, business_id, amount_cents, payment_method, processor, status, error_message, attempted_at, completed_at")
        .order("attempted_at", { ascending: false })
        .limit(100);
      if (attempts) {
        setPaymentAttempts(attempts as typeof paymentAttempts);
      }

    } catch (err: unknown) {
      // Tables may not exist yet — that's OK, show empty state
      const msg = err && typeof err === "object" && "message" in err ? (err as { message: string }).message : "";
      if (!msg.includes("does not exist") && !msg.includes("relation")) {
        console.error("Error fetching billing data:", err);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch adjustments
  const fetchAdjustments = useCallback(async () => {
    setAdjustmentsLoading(true);
    try {
      const adjAuth = await getAuthHeaders();
      const res = await fetch("/api/admin/billing/adjustments", { headers: adjAuth });
      if (res.ok) {
        const data = await res.json();
        setAdjustments(data.adjustments || []);
      }
    } catch (err) {
      console.error("Error fetching adjustments:", err);
    } finally {
      setAdjustmentsLoading(false);
    }
  }, []);

  // Fetch business options for dropdown
  const fetchBizOptions = useCallback(async () => {
    const { data } = await supabaseBrowser
      .from("business")
      .select("id, business_name")
      .order("business_name");
    if (data) setBizOptions(data as BizOption[]);
  }, []);

  // Load adjustments + business options when switching to adjustments tab
  useEffect(() => {
    if (activeTab === "adjustments") {
      fetchAdjustments();
      if (bizOptions.length === 0) fetchBizOptions();
    }
    if (activeTab === "balances") {
      fetchBalances();
    }
  }, [activeTab, fetchAdjustments, fetchBizOptions, bizOptions.length, fetchBalances]);

  // Filter adjustments
  const filteredAdjustments = adjustments.filter(a => {
    if (adjFilter.search && !(a.business_name || "").toLowerCase().includes(adjFilter.search.toLowerCase()) && !a.description.toLowerCase().includes(adjFilter.search.toLowerCase())) return false;
    if (adjFilter.status !== "all" && a.status !== adjFilter.status) return false;
    return true;
  });

  // Filtered biz options for autocomplete
  const filteredBizOptions = adjFormBizSearch
    ? bizOptions.filter(b => b.business_name.toLowerCase().includes(adjFormBizSearch.toLowerCase())).slice(0, 8)
    : [];

  // Adjustment totals
  const adjPendingCredits = adjustments.filter(a => a.status === "pending" && a.type === "credit").reduce((s, a) => s + Math.abs(a.amount_cents), 0);
  const adjPendingCharges = adjustments.filter(a => a.status === "pending" && a.type === "charge").reduce((s, a) => s + Math.abs(a.amount_cents), 0);
  const adjAppliedTotal = adjustments.filter(a => a.status === "applied").reduce((s, a) => s + a.amount_cents, 0);

  // Filter billing data
  const filteredBillingData = billingData.filter(b => {
    if (billingFilters.search && !b.business_name.toLowerCase().includes(billingFilters.search.toLowerCase())) return false;
    if (billingFilters.status !== "all" && b.status !== billingFilters.status) return false;
    if (billingFilters.period !== "all" && b.billing_period !== billingFilters.period) return false;
    if (billingFilters.dateFrom && new Date(b.invoice_date) < new Date(billingFilters.dateFrom)) return false;
    if (billingFilters.dateTo && new Date(b.invoice_date) > new Date(billingFilters.dateTo + "T23:59:59")) return false;
    if (billingFilters.minAmount && b.total_due < parseFloat(billingFilters.minAmount) * 100) return false;
    if (billingFilters.maxAmount && b.total_due > parseFloat(billingFilters.maxAmount) * 100) return false;
    return true;
  });

  // Filter statements
  const filteredStatements = statementsData.filter(s => {
    if (stmtFilters.search && !s.business_name.toLowerCase().includes(stmtFilters.search.toLowerCase())) return false;
    if (stmtFilters.status !== "all" && s.status !== stmtFilters.status) return false;
    if (stmtFilters.period !== "all" && s.statement_period !== stmtFilters.period) return false;
    if (stmtFilters.dateFrom && new Date(s.generated_at) < new Date(stmtFilters.dateFrom)) return false;
    if (stmtFilters.dateTo && new Date(s.generated_at) > new Date(stmtFilters.dateTo + "T23:59:59")) return false;
    return true;
  });

  // Get unique periods for dropdowns
  const billingPeriods = [...new Set(billingData.map(b => b.billing_period).filter(Boolean))];
  const stmtPeriods = [...new Set(statementsData.map(s => s.statement_period).filter(Boolean))];

  if (loading) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.textSecondary }}>
        Loading billing data...
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 32 }}>
      <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 16 }}>💳 Billing & Statements</h1>

      {/* Tab Toggle */}
      <div style={{ display: "flex", gap: 0, marginBottom: 32, borderBottom: `2px solid ${COLORS.cardBorder}` }}>
        {(["billing", "balances", "adjustments"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "12px 28px",
              fontSize: 15,
              fontWeight: 700,
              textTransform: "capitalize",
              color: activeTab === tab ? COLORS.neonBlue : COLORS.textSecondary,
              background: "transparent",
              border: "none",
              borderBottom: activeTab === tab ? `3px solid ${COLORS.neonBlue}` : "3px solid transparent",
              cursor: "pointer",
              marginBottom: -2,
              transition: "all 0.2s",
            }}
          >
            {tab === "adjustments" ? "⚖️ Adjustments" : tab === "balances" ? "💰 Balances" : "💳 Billing"}
          </button>
        ))}
      </div>

      {/* Action Message Toast (visible on all tabs) */}
      {actionMessage && (
        <div style={{
          padding: "14px 20px",
          borderRadius: 10,
          marginBottom: 16,
          background: actionMessage.type === "success" ? "rgba(57,255,20,0.1)" : "rgba(255,49,49,0.1)",
          border: `1px solid ${actionMessage.type === "success" ? "rgba(57,255,20,0.3)" : "rgba(255,49,49,0.3)"}`,
          color: actionMessage.type === "success" ? COLORS.neonGreen : COLORS.neonRed,
          fontWeight: 600,
          fontSize: 14,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <span>{actionMessage.text}</span>
          <button onClick={() => setActionMessage(null)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>
      )}

      {activeTab === "billing" && <>
      {/* Stats */}
      {(() => {
        const outstanding = billingData.filter(b => b.status === "pending" || b.status === "sent").reduce((s, b) => s + b.total_due, 0);
        const overdue = billingData.filter(b => (b.status === "pending" || b.status === "sent") && b.due_date && new Date(b.due_date) < new Date()).reduce((s, b) => s + b.total_due, 0);
        const now = new Date();
        const thisMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
        const collected = billingData.filter(b => b.status === "paid" && b.paid_at && b.paid_at >= thisMonthStart).reduce((s, b) => s + b.total_due, 0);
        // CC processing fee revenue: 3.5% we charge businesses paying by card
        const ccFeeRevenue = platformTotal?.ccFeesCents ?? 0;
        // Stripe's actual cost on card payments: ~2.9% + $0.30 per transaction
        const cardInvoices = billingData.filter(b => b.payment_method === "card" && b.status === "paid");
        const stripeCostEstimate = cardInvoices.reduce((s, b) => s + Math.round(b.total_due * 0.029) + 30, 0);
        // ACH cost: $0.80 per payment (max $5)
        const achInvoices = billingData.filter(b => b.payment_method === "bank" && b.status === "paid");
        const achCostEstimate = achInvoices.length * 80; // $0.80 per ACH
        const netProcessingRevenue = ccFeeRevenue - stripeCostEstimate - achCostEstimate;
        return (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 20, marginBottom: 16 }}>
              <StatCard icon="💵" value={formatMoney(outstanding)} label="Outstanding" gradient={COLORS.gradient1} />
              <StatCard icon="⚠️" value={formatMoney(overdue)} label="Overdue (Past Due)" gradient={COLORS.gradient4} />
              <StatCard icon="✅" value={formatMoney(collected)} label="Collected This Month" gradient={COLORS.gradient2} />
              <StatCard icon="📋" value={billingData.filter(b => b.status === "pending" || b.status === "sent").length.toString()} label="Pending Invoices" gradient={COLORS.gradient3} />
              <StatCard icon="📧" value={statementsData.filter(s => s.status === "pending").length.toString()} label="Statements to Send" gradient={COLORS.gradient3} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 32 }}>
              <StatCard icon="💳" value={formatMoney(ccFeeRevenue)} label={`CC Fees Charged (${periodLabel || "period"})`} gradient="linear-gradient(135deg, #ffff00, #ff6b35)" />
              <StatCard icon="🔻" value={formatMoney(stripeCostEstimate)} label={`Stripe Cost (${cardInvoices.length} card pmts)`} gradient="linear-gradient(135deg, #ff6b35, #ff3131)" />
              <StatCard icon="🏦" value={formatMoney(achCostEstimate)} label={`ACH Cost (${achInvoices.length} bank pmts)`} gradient="linear-gradient(135deg, #ff6b35, #ff3131)" />
              <StatCard icon="📈" value={formatMoney(netProcessingRevenue)} label="Net Processing Revenue" gradient={netProcessingRevenue >= 0 ? COLORS.gradient2 : "linear-gradient(135deg, #ff3131, #990000)"} />
            </div>
          </>
        );
      })()}

      {/* ==================== PERIOD SELECTOR ==================== */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        {/* Period buttons */}
        {(["day", "week", "month", "year"] as const).map(p => (
          <button
            key={p}
            onClick={() => { setExpectedPeriod(p); setExpectedRefDate(new Date()); }}
            style={{
              padding: "8px 20px",
              borderRadius: 10,
              border: expectedPeriod === p ? `1px solid ${COLORS.neonBlue}` : `1px solid ${COLORS.cardBorder}`,
              background: expectedPeriod === p ? "rgba(0,212,255,0.15)" : COLORS.cardBg,
              color: expectedPeriod === p ? COLORS.neonBlue : COLORS.textSecondary,
              fontWeight: 700,
              cursor: "pointer",
              fontSize: 14,
              textTransform: "capitalize",
            }}
          >
            {p}
          </button>
        ))}

        {/* Divider */}
        <div style={{ width: 1, height: 28, background: COLORS.cardBorder }} />

        {/* MTD / YTD (actuals) */}
        {(["mtd", "ytd"] as const).map(p => (
          <button
            key={p}
            onClick={() => { setExpectedPeriod(p); setExpectedRefDate(new Date()); }}
            style={{
              padding: "8px 20px",
              borderRadius: 10,
              border: expectedPeriod === p ? `1px solid ${COLORS.neonGreen}` : `1px solid ${COLORS.cardBorder}`,
              background: expectedPeriod === p ? "rgba(57,255,20,0.12)" : COLORS.cardBg,
              color: expectedPeriod === p ? COLORS.neonGreen : COLORS.textSecondary,
              fontWeight: 700,
              cursor: "pointer",
              fontSize: 14,
              textTransform: "uppercase",
            }}
          >
            {p}
          </button>
        ))}

        <div style={{ flex: 1 }} />

        {/* Navigation arrows + label (hidden for MTD/YTD since they're always "as of today") */}
        {expectedPeriod !== "mtd" && expectedPeriod !== "ytd" && (
          <button
            onClick={() => navigatePeriod(-1)}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              border: `1px solid ${COLORS.cardBorder}`,
              background: COLORS.cardBg,
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
              fontSize: 16,
            }}
          >
            ‹
          </button>
        )}
        <div style={{ minWidth: 200, textAlign: "center", fontWeight: 700, fontSize: 15, color: "#fff" }}>
          {periodLabel || "..."}
        </div>
        {expectedPeriod !== "mtd" && expectedPeriod !== "ytd" && (
          <button
            onClick={() => navigatePeriod(1)}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              border: `1px solid ${COLORS.cardBorder}`,
              background: COLORS.cardBg,
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
              fontSize: 16,
            }}
          >
            ›
          </button>
        )}
      </div>

      {/* ==================== PLATFORM-WIDE EXPECTED BILL ==================== */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(0,212,255,0.12) 0%, rgba(191,95,255,0.08) 100%)",
          border: `1px solid rgba(0,212,255,0.3)`,
          borderRadius: 16,
          padding: "2rem",
          marginBottom: 32,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
          <div>
            <div style={{ fontSize: "0.85rem", color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
              Platform Expected Revenue &bull; {periodLabel}
            </div>
            <div style={{ fontSize: "3rem", fontWeight: 900, color: "#fff", lineHeight: 1 }}>
              {expectedLoading ? "..." : formatMoney(platformTotal?.totalCents ?? 0)}
            </div>
            <div style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.55)", marginTop: "0.5rem" }}>
              {platformTotal?.businessCount ?? 0} businesses ({platformTotal?.premiumCount ?? 0} premium, {(platformTotal?.businessCount ?? 0) - (platformTotal?.premiumCount ?? 0)} basic)
              {expectedPeriod === "mtd" || expectedPeriod === "ytd"
                ? <span> &bull; Actuals to date</span>
                : expectedPeriod !== "month" && <span> &bull; Fixed costs prorated to {expectedPeriod}</span>
              }
            </div>
          </div>
        </div>

        {platformTotal && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.75rem" }}>
            {[
              { label: "Plan Fees", cents: platformTotal.planCostCents, color: COLORS.neonBlue },
              { label: "Progressive Payouts", cents: platformTotal.progressivePayoutsCents, color: COLORS.neonGreen },
              { label: "Advertising & Add-ons", cents: platformTotal.advertisingAddOnsCents, color: COLORS.neonOrange },
              { label: "LetsGo Fees", cents: platformTotal.letsGoFeesCents, color: COLORS.neonPink },
              { label: "Credit Card Fees", cents: platformTotal.ccFeesCents, color: COLORS.neonYellow },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  padding: "0.75rem 1rem",
                  background: "rgba(255,255,255,0.04)",
                  borderRadius: 10,
                  borderLeft: `3px solid ${item.color}`,
                }}
              >
                <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.55)", marginBottom: "0.25rem", textTransform: "uppercase", fontWeight: 600 }}>
                  {item.label}
                </div>
                <div style={{ fontSize: "1.1rem", fontWeight: 900, color: item.color, fontFamily: '"Space Mono", monospace' }}>
                  {formatMoney(item.cents)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ==================== PER-BUSINESS EXPECTED BILLS ==================== */}
      <SectionTitle icon="🏢">Expected Bills by Business &bull; {periodLabel}</SectionTitle>
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Search business..."
          value={bizSearch}
          onChange={e => setBizSearch(e.target.value)}
          style={{
            flex: 1,
            padding: "10px 14px",
            background: COLORS.cardBg,
            border: `1px solid ${COLORS.cardBorder}`,
            borderRadius: 10,
            color: "#fff",
            fontSize: 14,
            outline: "none",
          }}
        />
        {(["all", "premium", "basic"] as const).map(f => (
          <button
            key={f}
            onClick={() => setBizPlanFilter(f)}
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              border: bizPlanFilter === f ? `1px solid ${COLORS.neonBlue}` : `1px solid ${COLORS.cardBorder}`,
              background: bizPlanFilter === f ? "rgba(0,212,255,0.15)" : COLORS.cardBg,
              color: bizPlanFilter === f ? COLORS.neonBlue : COLORS.textSecondary,
              fontWeight: 700,
              cursor: "pointer",
              fontSize: 13,
              textTransform: "capitalize",
            }}
          >
            {f === "all" ? "All Plans" : f}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, marginBottom: 32 }}>
        {expectedLoading ? (
          <div style={{ padding: 24, color: COLORS.textSecondary, fontWeight: 700 }}>Loading expected bills...</div>
        ) : filteredBizBreakdowns.length === 0 ? (
          <div style={{ padding: 24, color: COLORS.textSecondary, textAlign: "center" }}>No businesses match your filters.</div>
        ) : (
          filteredBizBreakdowns.map(biz => {
            const isExpanded = expandedBizId === biz.businessId;
            const breakdownItems = [
              { label: "Plan Fee", cents: biz.planCostCents, color: COLORS.neonBlue },
              { label: "Progressive Payouts", cents: biz.progressivePayoutsCents, color: COLORS.neonGreen },
              { label: "Advertising & Add-ons", cents: biz.advertisingAddOnsCents, color: COLORS.neonOrange },
              { label: "LetsGo Fees", cents: biz.letsGoFeesCents, color: COLORS.neonPink },
              { label: "Credit Card Fees", cents: biz.ccFeesCents, color: COLORS.neonYellow },
            ];

            return (
              <div
                key={biz.businessId}
                style={{
                  background: COLORS.cardBg,
                  border: `1px solid ${COLORS.cardBorder}`,
                  borderRadius: 12,
                  overflow: "hidden",
                }}
              >
                {/* Clickable header row */}
                <div
                  onClick={() => setExpandedBizId(isExpanded ? null : biz.businessId)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "14px 20px",
                    cursor: "pointer",
                    gap: 16,
                  }}
                >
                  <span style={{ fontSize: 14, transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s", color: COLORS.textSecondary }}>
                    ▶
                  </span>
                  <div style={{ flex: 1, fontWeight: 700, fontSize: 15 }}>
                    {biz.businessName}
                  </div>
                  <span
                    style={{
                      padding: "3px 10px",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      background: biz.isPremium ? "rgba(0,212,255,0.15)" : "rgba(255,107,53,0.15)",
                      color: biz.isPremium ? COLORS.neonBlue : COLORS.neonOrange,
                      border: `1px solid ${biz.isPremium ? "rgba(0,212,255,0.3)" : "rgba(255,107,53,0.3)"}`,
                    }}
                  >
                    {biz.isPremium ? "PREMIUM" : "BASIC"}
                  </span>
                  <span
                    style={{
                      padding: "3px 10px",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      background: biz.paymentMethod === "card" ? "rgba(245,158,11,0.15)" : "rgba(57,255,20,0.15)",
                      color: biz.paymentMethod === "card" ? COLORS.neonYellow : COLORS.neonGreen,
                    }}
                  >
                    {biz.paymentMethod === "card" ? "💳 Card" : "🏦 Bank"}
                  </span>
                  {!biz.isActive && (
                    <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: "rgba(255,49,49,0.15)", color: COLORS.neonRed }}>
                      INACTIVE
                    </span>
                  )}
                  <div style={{ fontWeight: 900, fontSize: 18, fontFamily: '"Space Mono", monospace', color: biz.totalCents > 0 ? "#fff" : COLORS.textSecondary, minWidth: 100, textAlign: "right" }}>
                    {formatMoney(biz.totalCents)}
                  </div>
                </div>

                {/* Expanded breakdown */}
                {isExpanded && (
                  <div style={{ padding: "0 20px 16px 20px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
                      {breakdownItems.map(item => (
                        <div
                          key={item.label}
                          style={{
                            padding: "0.65rem 0.85rem",
                            background: "rgba(255,255,255,0.03)",
                            borderRadius: 8,
                            borderLeft: `3px solid ${item.color}`,
                          }}
                        >
                          <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.5)", marginBottom: 2, textTransform: "uppercase", fontWeight: 600 }}>
                            {item.label}
                          </div>
                          <div style={{ fontSize: "1rem", fontWeight: 900, color: item.color, fontFamily: '"Space Mono", monospace' }}>
                            {formatMoney(item.cents)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ==================== ACTION TOOLBAR ==================== */}
      <div style={{ display: "flex", gap: 12, marginBottom: 32, flexWrap: "wrap" }}>
        <button
          onClick={async () => {
            if (!rangeStart || !rangeEnd) { setActionMessage({ type: "error", text: "No billing period selected" }); return; }
            if (!confirm(`Generate invoices for ${periodLabel}? This will create invoices for all active businesses.`)) return;
            setActionLoading("generate");
            try {
              const auth = await getAuthHeaders();
              const res = await fetch("/api/admin/billing/generate-invoices", {
                method: "POST",
                headers: { "Content-Type": "application/json", ...auth },
                body: JSON.stringify({ periodStart: rangeStart, periodEnd: rangeEnd }),
              });
              const data = await res.json();
              if (res.status === 409) {
                setActionMessage({ type: "error", text: data.message || "Invoices already exist for this period" });
              } else if (!res.ok) {
                setActionMessage({ type: "error", text: data.error || "Failed to generate invoices" });
              } else {
                let msg = `Generated ${data.generated} invoices totaling ${formatMoney(data.totalCents)} (${data.skipped} skipped)`;
                // Also generate influencer payouts for the same period
                try {
                  const infAuth = await getAuthHeaders();
                  const infRes = await fetch("/api/admin/billing/generate-influencer-payouts", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", ...infAuth },
                    body: JSON.stringify({ periodStart: rangeStart, periodEnd: rangeEnd }),
                  });
                  const infData = await infRes.json();
                  if (infRes.ok && infData.ok) {
                    if (infData.generated > 0) {
                      msg += ` + ${infData.generated} influencer payout${infData.generated === 1 ? "" : "s"} totaling ${formatMoney(infData.totalCents)}`;
                    }
                  } else if (infRes.status === 409) {
                    // Influencer payouts already exist — not an error
                  } else {
                    msg += ` | ⚠️ Influencer payouts failed: ${infData.error || "Unknown error"}`;
                  }
                } catch {
                  msg += " | ⚠️ Influencer payouts: network error";
                }
                setActionMessage({ type: "success", text: msg });
                logAudit({ action: "generate_invoices", tab: AUDIT_TABS.BILLING, targetType: "invoices", details: msg });
                fetchData();
              }
            } catch { setActionMessage({ type: "error", text: "Network error generating invoices" }); }
            finally { setActionLoading(null); }
          }}
          disabled={actionLoading !== null}
          style={{
            padding: "12px 24px",
            borderRadius: 10,
            border: `1px solid rgba(0,212,255,0.4)`,
            background: "rgba(0,212,255,0.12)",
            color: COLORS.neonBlue,
            fontWeight: 700,
            cursor: actionLoading ? "not-allowed" : "pointer",
            fontSize: 13,
            opacity: actionLoading ? 0.5 : 1,
          }}
        >
          {actionLoading === "generate" ? "Generating..." : `📋 Generate Invoices for ${periodLabel || "..."}`}
        </button>
        <button
          onClick={async () => {
            const pendingCount = billingData.filter(b => b.status === "pending" || b.status === "sent").length;
            if (pendingCount === 0) { setActionMessage({ type: "error", text: "No pending invoices to charge" }); return; }
            if (!confirm(`Auto-charge ${pendingCount} pending invoice(s)? This will attempt to charge each business's payment method on file.`)) return;
            setActionLoading("charge");
            try {
              const chAuth = await getAuthHeaders();
              const res = await fetch("/api/admin/billing/charge", {
                method: "POST",
                headers: { "Content-Type": "application/json", ...chAuth },
                body: JSON.stringify({ chargeAll: true }),
              });
              const data = await res.json();
              if (!res.ok) {
                setActionMessage({ type: "error", text: data.error || "Failed to charge invoices" });
              } else {
                const chargeMsg = `Charged ${data.charged} invoice(s)${data.failed > 0 ? `, ${data.failed} failed` : ""}`;
                setActionMessage({ type: "success", text: chargeMsg });
                logAudit({ action: "auto_charge_invoices", tab: AUDIT_TABS.BILLING, targetType: "invoices", details: chargeMsg });
                fetchData();
              }
            } catch { setActionMessage({ type: "error", text: "Network error charging invoices" }); }
            finally { setActionLoading(null); }
          }}
          disabled={actionLoading !== null}
          style={{
            padding: "12px 24px",
            borderRadius: 10,
            border: `1px solid rgba(57,255,20,0.4)`,
            background: "rgba(57,255,20,0.12)",
            color: COLORS.neonGreen,
            fontWeight: 700,
            cursor: actionLoading ? "not-allowed" : "pointer",
            fontSize: 13,
            opacity: actionLoading ? 0.5 : 1,
          }}
        >
          {actionLoading === "charge" ? "Charging..." : "⚡ Auto-Charge All Pending"}
        </button>
        <button
          onClick={async () => {
            if (!rangeStart || !rangeEnd) { setActionMessage({ type: "error", text: "No billing period selected" }); return; }
            if (!confirm(`Generate statements for ${periodLabel}?`)) return;
            setActionLoading("statements");
            try {
              const stAuth = await getAuthHeaders();
              const res = await fetch("/api/admin/billing/statements", {
                method: "POST",
                headers: { "Content-Type": "application/json", ...stAuth },
                body: JSON.stringify({ periodStart: rangeStart, periodEnd: rangeEnd }),
              });
              const data = await res.json();
              if (res.status === 409) {
                setActionMessage({ type: "error", text: data.message || "Statements already exist for this period" });
              } else if (!res.ok) {
                setActionMessage({ type: "error", text: data.error || "Failed to generate statements" });
              } else {
                const stmtMsg = `Generated ${data.generated} statements (${data.skipped} skipped)`;
                setActionMessage({ type: "success", text: stmtMsg });
                logAudit({ action: "generate_statements", tab: AUDIT_TABS.BILLING, targetType: "statements", details: stmtMsg });
                fetchData();
              }
            } catch { setActionMessage({ type: "error", text: "Network error generating statements" }); }
            finally { setActionLoading(null); }
          }}
          disabled={actionLoading !== null}
          style={{
            padding: "12px 24px",
            borderRadius: 10,
            border: `1px solid rgba(255,107,53,0.4)`,
            background: "rgba(255,107,53,0.12)",
            color: COLORS.neonOrange,
            fontWeight: 700,
            cursor: actionLoading ? "not-allowed" : "pointer",
            fontSize: 13,
            opacity: actionLoading ? 0.5 : 1,
          }}
        >
          {actionLoading === "statements" ? "Generating..." : "📄 Generate Statements"}
        </button>
      </div>

      {/* Invoice Management */}
      <SectionTitle icon="📋">Invoice Management</SectionTitle>
      <FilterPanel
        expanded={billingFiltersExpanded}
        onToggle={() => setBillingFiltersExpanded(!billingFiltersExpanded)}
        filters={[
          { key: "search", label: "Business Name", type: "text", value: billingFilters.search, placeholder: "Search business..." },
          { key: "status", label: "Status", type: "select", value: billingFilters.status, options: [{ value: "all", label: "All Status" }, { value: "pending", label: "Pending" }, { value: "sent", label: "Sent" }, { value: "paid", label: "Paid" }, { value: "overdue", label: "Overdue" }, { value: "void", label: "Void" }] },
          { key: "period", label: "Billing Period", type: "select", value: billingFilters.period, options: [{ value: "all", label: "All Periods" }, ...billingPeriods.map(p => ({ value: p, label: p }))] },
          { key: "dateFrom", label: "Invoice Date From", type: "date", value: billingFilters.dateFrom },
          { key: "dateTo", label: "Invoice Date To", type: "date", value: billingFilters.dateTo },
          { key: "minAmount", label: "Min Amount ($)", type: "number", value: billingFilters.minAmount, placeholder: "0" },
          { key: "maxAmount", label: "Max Amount ($)", type: "number", value: billingFilters.maxAmount, placeholder: "99999" },
        ]}
        onFilterChange={(key, value) => setBillingFilters(p => ({ ...p, [key]: value }))}
      />
      <Card style={{ marginBottom: 32 }} actions={<ExportButtons data={filteredBillingData.map(b => ({ id: b.id, business: b.business_name, period: b.billing_period, invoice_date: b.invoice_date, due_date: b.due_date, receipts: b.line_items.receipt_payouts.count, total_due: formatMoney(b.total_due), status: b.status }))} filename="invoices" />}>
        <DataTable
          columns={[
            { key: "business_name", label: "Business", render: (v) => <span style={{ fontWeight: 600 }}>{String(v)}</span> },
            { key: "billing_period", label: "Period" },
            { key: "invoice_date", label: "Invoice Date", render: (v) => formatDate(String(v)) },
            { key: "due_date", label: "Due Date", render: (v) => formatDate(String(v)) },
            { key: "line_items", label: "Receipts", align: "center", render: (v) => {
              const items = v as BillingLineItems;
              return items?.receipt_payouts?.count || 0;
            }},
            { key: "total_due", label: "Total Due", align: "right", render: (v, row) => {
              const r = row as unknown as BillingRecord;
              return <span style={{ fontWeight: 700, fontSize: 15, color: r.status === "paid" ? COLORS.neonGreen : COLORS.neonPink }}>{formatMoney(v as number)}</span>;
            }},
            { key: "status", label: "Status", render: (v) => <Badge status={String(v)} /> },
            { key: "id", label: "", align: "center", render: (_v, row) => {
              const r = row as unknown as BillingRecord;
              return (
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setSelectedBill(r)} style={{ padding: "8px 16px", background: COLORS.gradient1, color: "#fff", border: "none", borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>View Invoice</button>
                  {(r.status === "pending" || r.status === "sent") && (
                    <button onClick={async (e) => {
                      e.stopPropagation();
                      if (!confirm(`Charge ${r.business_name} for ${formatMoney(r.total_due)}?`)) return;
                      try {
                        const chAuth2 = await getAuthHeaders();
                        const res = await fetch("/api/admin/billing/charge", {
                          method: "POST",
                          headers: { "Content-Type": "application/json", ...chAuth2 },
                          body: JSON.stringify({ invoiceIds: [r.id] }),
                        });
                        const data = await res.json();
                        if (res.ok && data.charged > 0) {
                          setActionMessage({ type: "success", text: `Charged ${r.business_name} - ${formatMoney(r.total_due)}` });
                          logAudit({ action: "charge_invoice", tab: AUDIT_TABS.BILLING, targetType: "invoice", targetId: r.id, entityName: r.business_name, details: `Charged ${formatMoney(r.total_due)}` });
                          fetchData();
                        } else {
                          setActionMessage({ type: "error", text: data.error || "Charge failed" });
                        }
                      } catch { setActionMessage({ type: "error", text: "Network error" }); }
                    }} style={{ padding: "8px 12px", background: "rgba(57,255,20,0.12)", border: `1px solid rgba(57,255,20,0.3)`, borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer", color: COLORS.neonGreen }}>⚡ Charge</button>
                  )}
                  <button onClick={() => { 
                    const w = window.open("", "_blank"); 
                    if (w) {
                      w.document.write("<html><head><title>Invoice " + r.id + "</title><style>body{font-family:Arial,sans-serif;padding:40px;max-width:800px;margin:0 auto}h1{border-bottom:2px solid #333;padding-bottom:10px}.header{display:flex;justify-content:space-between;margin-bottom:30px}.row{display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #eee}.label{color:#666}.value{font-weight:bold}.total{background:#f5f5f5;padding:16px;font-size:20px;margin-top:20px;border-radius:8px;text-align:right}@media print{button{display:none}}</style></head><body><h1>📋 Invoice</h1><div class='header'><div><strong>" + r.business_name + "</strong><br/>Billing Period: " + r.billing_period + "</div><div>Invoice #: " + r.id + "<br/>Invoice Date: " + new Date(r.invoice_date).toLocaleDateString() + "<br/>Due Date: " + new Date(r.due_date).toLocaleDateString() + "</div></div><div class='row'><span class='label'>Receipt Payouts:</span><span class='value'>" + r.line_items.receipt_payouts.count + " receipts</span></div><div class='row'><span class='label'>Payout Amount:</span><span class='value'>$" + (r.line_items.receipt_payouts.amount/100).toFixed(2) + "</span></div><div class='row'><span class='label'>Platform Fees:</span><span class='value'>$" + ((r.line_items.platform_fees?.amount || 0)/100).toFixed(2) + "</span></div><div class='total'><strong>Total Due: $" + (r.total_due/100).toFixed(2) + "</strong></div><button onclick='window.print()' style='padding:12px 24px;background:#333;color:#fff;border:none;border-radius:8px;cursor:pointer;margin-top:20px'>🖨️ Print Invoice</button></body></html>"); 
                      w.document.close(); 
                    }
                  }} style={{ padding: "8px 12px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, fontSize: 11, color: COLORS.textSecondary, cursor: "pointer" }}>🖨️</button>
                </div>
              );
            }},
          ]}
          data={filteredBillingData as unknown as Record<string, unknown>[]}
        />
      </Card>

      {/* Statement Management */}
      <SectionTitle icon="📄">Statement Management</SectionTitle>
      <FilterPanel
        expanded={stmtFiltersExpanded}
        onToggle={() => setStmtFiltersExpanded(!stmtFiltersExpanded)}
        filters={[
          { key: "search", label: "Business Name", type: "text", value: stmtFilters.search, placeholder: "Search business..." },
          { key: "status", label: "Status", type: "select", value: stmtFilters.status, options: [{ value: "all", label: "All Status" }, { value: "pending", label: "Pending" }, { value: "sent", label: "Sent" }, { value: "viewed", label: "Viewed" }] },
          { key: "period", label: "Statement Period", type: "select", value: stmtFilters.period, options: [{ value: "all", label: "All Periods" }, ...stmtPeriods.map(p => ({ value: p, label: p }))] },
          { key: "dateFrom", label: "Generated From", type: "date", value: stmtFilters.dateFrom },
          { key: "dateTo", label: "Generated To", type: "date", value: stmtFilters.dateTo },
        ]}
        onFilterChange={(key, value) => setStmtFilters(p => ({ ...p, [key]: value }))}
      />
      <Card actions={<ExportButtons data={filteredStatements.map(s => ({ id: s.id, business: s.business_name, period: s.statement_period, generated: s.generated_at, receipts: s.total_receipts, payouts: formatMoney(s.total_payouts), fees: formatMoney(s.total_fees), status: s.status }))} filename="statements" />}>
        <DataTable
          columns={[
            { key: "business_name", label: "Business", render: (v) => <span style={{ fontWeight: 600 }}>{String(v)}</span> },
            { key: "statement_period", label: "Period" },
            { key: "generated_at", label: "Generated", render: (v) => formatDate(String(v)) },
            { key: "total_receipts", label: "Receipts", align: "center" },
            { key: "total_payouts", label: "Total Payouts", align: "right", render: (v) => formatMoney(v as number) },
            { key: "total_fees", label: "Total Fees", align: "right", render: (v) => formatMoney(v as number) },
            { key: "sent_at", label: "Sent", render: (v) => v ? formatDateTime(String(v)) : "—" },
            { key: "status", label: "Status", render: (v) => <Badge status={String(v)} /> },
            { key: "id", label: "", align: "center", render: (_v, row) => {
              const s = row as unknown as StatementRecord;
              return (
                <div style={{ display: "flex", gap: 6 }}>
                  {s.status === "pending" ? (
                    <button onClick={async () => {
                      try {
                        const sAuth = await getAuthHeaders();
                        const res = await fetch("/api/admin/billing/statements", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json", ...sAuth },
                          body: JSON.stringify({ statementId: s.id, action: "mark_sent" }),
                        });
                        if (res.ok) {
                          setActionMessage({ type: "success", text: `Statement sent to ${s.business_name}` });
                          logAudit({ action: "send_statement", tab: AUDIT_TABS.BILLING, targetType: "statement", targetId: s.id, entityName: s.business_name, details: `Sent statement for ${s.statement_period}` });
                          fetchData();
                        } else {
                          const data = await res.json();
                          setActionMessage({ type: "error", text: data.error || "Failed to send statement" });
                        }
                      } catch { setActionMessage({ type: "error", text: "Network error" }); }
                    }} style={{ padding: "8px 16px", background: "linear-gradient(135deg, #00d4ff, #0099ff)", color: "#fff", border: "none", borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>📧 Send</button>
                  ) : (
                    <button onClick={() => { 
                      const w = window.open("", "_blank"); 
                      if (w) {
                        w.document.write("<html><head><title>Statement " + s.id + "</title><style>body{font-family:Arial,sans-serif;padding:40px;max-width:800px;margin:0 auto}h1{border-bottom:2px solid #333;padding-bottom:10px}.header{display:flex;justify-content:space-between;margin-bottom:30px}.row{display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #eee}.label{color:#666}.value{font-weight:bold}.total{background:#f5f5f5;padding:16px;font-size:18px;margin-top:20px;border-radius:8px}@media print{button{display:none}}</style></head><body><h1>📄 Business Statement</h1><div class='header'><div><strong>" + s.business_name + "</strong><br/>Statement Period: " + s.statement_period + "</div><div>Statement ID: " + s.id + "<br/>Generated: " + new Date(s.generated_at).toLocaleDateString() + "</div></div><div class='row'><span class='label'>Total Receipts:</span><span class='value'>" + s.total_receipts + "</span></div><div class='row'><span class='label'>Total Payouts:</span><span class='value'>$" + (s.total_payouts/100).toFixed(2) + "</span></div><div class='row'><span class='label'>Platform Fees:</span><span class='value'>$" + (s.total_fees/100).toFixed(2) + "</span></div><div class='total'><strong>Net Amount: $" + ((s.total_payouts - s.total_fees)/100).toFixed(2) + "</strong></div><button onclick='window.print()' style='padding:12px 24px;background:#333;color:#fff;border:none;border-radius:8px;cursor:pointer;margin-top:20px'>🖨️ Print Statement</button></body></html>"); 
                        w.document.close(); 
                      }
                    }} style={{ padding: "8px 12px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, fontSize: 11, color: COLORS.textSecondary, cursor: "pointer" }}>View</button>
                  )}
                  <button onClick={() => { 
                    const w = window.open("", "_blank"); 
                    if (w) {
                      w.document.write("<html><head><title>Statement " + s.id + "</title><style>body{font-family:Arial,sans-serif;padding:40px;max-width:800px;margin:0 auto}h1{border-bottom:2px solid #333;padding-bottom:10px}.header{display:flex;justify-content:space-between;margin-bottom:30px}.row{display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #eee}.label{color:#666}.value{font-weight:bold}.total{background:#f5f5f5;padding:16px;font-size:18px;margin-top:20px;border-radius:8px}@media print{button{display:none}}</style></head><body><h1>📄 Business Statement</h1><div class='header'><div><strong>" + s.business_name + "</strong><br/>Statement Period: " + s.statement_period + "</div><div>Statement ID: " + s.id + "<br/>Generated: " + new Date(s.generated_at).toLocaleDateString() + "</div></div><div class='row'><span class='label'>Total Receipts:</span><span class='value'>" + s.total_receipts + "</span></div><div class='row'><span class='label'>Total Payouts:</span><span class='value'>$" + (s.total_payouts/100).toFixed(2) + "</span></div><div class='row'><span class='label'>Platform Fees:</span><span class='value'>$" + (s.total_fees/100).toFixed(2) + "</span></div><div class='total'><strong>Net Amount: $" + ((s.total_payouts - s.total_fees)/100).toFixed(2) + "</strong></div><button onclick='window.print()' style='padding:12px 24px;background:#333;color:#fff;border:none;border-radius:8px;cursor:pointer;margin-top:20px'>🖨️ Print Statement</button></body></html>"); 
                      w.document.close(); 
                    }
                  }} style={{ padding: "8px 12px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, fontSize: 11, color: COLORS.textSecondary, cursor: "pointer" }}>🖨️</button>
                </div>
              );
            }},
          ]}
          data={filteredStatements as unknown as Record<string, unknown>[]}
        />
      </Card>

      {/* ==================== PAYMENT ATTEMPTS LOG ==================== */}
      {paymentAttempts.length > 0 && (
        <>
          <SectionTitle icon="🔄">Payment Attempts Log</SectionTitle>
          <Card style={{ marginBottom: 32 }}>
            <DataTable
              columns={[
                { key: "attempted_at", label: "Date", render: (v) => formatDateTime(String(v)) },
                { key: "business_id", label: "Business", render: (v) => {
                  // Try to find business name from invoice data
                  const inv = billingData.find(b => b.business_id === String(v));
                  return <span style={{ fontWeight: 600 }}>{inv?.business_name || String(v).slice(0, 12) + "..."}</span>;
                }},
                { key: "amount_cents", label: "Amount", align: "right", render: (v) => <span style={{ fontWeight: 700 }}>{formatMoney(v as number)}</span> },
                { key: "payment_method", label: "Method", render: (v) => <span style={{ textTransform: "capitalize" }}>{String(v) === "card" ? "💳 Card" : "🏦 Bank"}</span> },
                { key: "processor", label: "Processor", render: (v) => <span style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: String(v) === "stub" ? "rgba(255,255,0,0.12)" : "rgba(57,255,20,0.12)", color: String(v) === "stub" ? COLORS.neonYellow : COLORS.neonGreen, border: `1px solid ${String(v) === "stub" ? "rgba(255,255,0,0.3)" : "rgba(57,255,20,0.3)"}` }}>{String(v).toUpperCase()}</span> },
                { key: "status", label: "Result", render: (v) => <Badge status={String(v) === "succeeded" ? "paid" : String(v) === "failed" ? "rejected" : String(v)} /> },
                { key: "error_message", label: "Error", render: (v) => v ? <span style={{ color: COLORS.neonRed, fontSize: 12 }}>{String(v)}</span> : "—" },
              ]}
              data={paymentAttempts as unknown as Record<string, unknown>[]}
            />
          </Card>
        </>
      )}

      </>}

      {/* ==================== ADJUSTMENTS TAB ==================== */}
      {activeTab === "adjustments" && (
        <>
          {/* Adjustment Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, marginBottom: 32 }}>
            <StatCard icon="🟢" value={formatMoney(adjPendingCredits)} label="Pending Credits" gradient={COLORS.gradient2} />
            <StatCard icon="🔴" value={formatMoney(adjPendingCharges)} label="Pending Charges" gradient={COLORS.gradient1} />
            <StatCard icon="📋" value={formatMoney(Math.abs(adjAppliedTotal))} label="Applied to Invoices" gradient={COLORS.gradient3} />
          </div>

          {/* Create Adjustment Button */}
          {!adjFormOpen && (
            <button
              onClick={() => setAdjFormOpen(true)}
              style={{
                padding: "14px 28px",
                background: COLORS.gradient1,
                border: "none",
                borderRadius: 12,
                color: "#fff",
                fontWeight: 700,
                fontSize: 15,
                cursor: "pointer",
                marginBottom: 24,
              }}
            >
              + Apply Credit or Charge
            </button>
          )}

          {/* Create Adjustment Form */}
          {adjFormOpen && (
            <Card style={{ marginBottom: 24 }}>
              <div style={{ padding: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700 }}>Apply Adjustment</h3>
                  <button onClick={() => { setAdjFormOpen(false); setAdjFormBusinessId(""); setAdjFormBizSearch(""); setAdjFormAmount(""); setAdjFormDescription(""); }} style={{ background: "none", border: "none", color: COLORS.textSecondary, cursor: "pointer", fontSize: 20 }}>✕</button>
                </div>

                {/* Type Toggle */}
                <div style={{ display: "flex", gap: 0, marginBottom: 20, borderRadius: 10, overflow: "hidden", border: `1px solid ${COLORS.cardBorder}` }}>
                  {(["credit", "charge"] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setAdjFormType(t)}
                      style={{
                        flex: 1,
                        padding: "12px 20px",
                        fontWeight: 700,
                        fontSize: 14,
                        textTransform: "capitalize",
                        border: "none",
                        cursor: "pointer",
                        background: adjFormType === t
                          ? t === "credit" ? "rgba(57,255,20,0.15)" : "rgba(255,49,49,0.15)"
                          : COLORS.darkBg,
                        color: adjFormType === t
                          ? t === "credit" ? COLORS.neonGreen : COLORS.neonRed
                          : COLORS.textSecondary,
                      }}
                    >
                      {t === "credit" ? "➖ Credit (reduces balance)" : "➕ Charge (adds to balance)"}
                    </button>
                  ))}
                </div>

                {/* Business Search */}
                <div style={{ marginBottom: 16, position: "relative" }}>
                  <label style={{ display: "block", fontSize: 12, color: COLORS.textSecondary, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Business</label>
                  {adjFormBusinessId ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: COLORS.darkBg, borderRadius: 10, border: `1px solid ${COLORS.cardBorder}` }}>
                      <span style={{ fontWeight: 600, flex: 1 }}>{bizOptions.find(b => b.id === adjFormBusinessId)?.business_name || adjFormBusinessId}</span>
                      <button onClick={() => { setAdjFormBusinessId(""); setAdjFormBizSearch(""); }} style={{ background: "none", border: "none", color: COLORS.textSecondary, cursor: "pointer", fontSize: 16 }}>✕</button>
                    </div>
                  ) : (
                    <>
                      <input
                        type="text"
                        placeholder="Search for a business..."
                        value={adjFormBizSearch}
                        onChange={e => setAdjFormBizSearch(e.target.value)}
                        style={{ width: "100%", padding: "10px 14px", background: COLORS.darkBg, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 10, color: "#fff", fontSize: 14, outline: "none" }}
                      />
                      {filteredBizOptions.length > 0 && (
                        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: COLORS.cardBg, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 10, marginTop: 4, zIndex: 10, maxHeight: 240, overflowY: "auto" }}>
                          {filteredBizOptions.map(b => (
                            <button
                              key={b.id}
                              onClick={() => { setAdjFormBusinessId(b.id); setAdjFormBizSearch(b.business_name); }}
                              style={{ display: "block", width: "100%", padding: "10px 14px", background: "transparent", border: "none", borderBottom: `1px solid ${COLORS.cardBorder}`, color: "#fff", textAlign: "left", cursor: "pointer", fontSize: 14 }}
                              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                            >
                              {b.business_name}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Amount */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 12, color: COLORS.textSecondary, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Amount ($)</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="0.00"
                    value={adjFormAmount}
                    onChange={e => setAdjFormAmount(e.target.value)}
                    style={{ width: "100%", padding: "10px 14px", background: COLORS.darkBg, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 10, color: "#fff", fontSize: 18, fontWeight: 700, outline: "none" }}
                  />
                </div>

                {/* Description */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: 12, color: COLORS.textSecondary, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Reason / Description</label>
                  <textarea
                    placeholder="e.g., Courtesy credit for service issue, One-time promotional credit..."
                    value={adjFormDescription}
                    onChange={e => setAdjFormDescription(e.target.value)}
                    rows={3}
                    style={{ width: "100%", padding: "10px 14px", background: COLORS.darkBg, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 10, color: "#fff", fontSize: 14, outline: "none", resize: "vertical" }}
                  />
                </div>

                {/* Submit */}
                <div style={{ display: "flex", gap: 12 }}>
                  <button
                    disabled={adjFormSubmitting || !adjFormBusinessId || !adjFormAmount || parseFloat(adjFormAmount) <= 0 || !adjFormDescription.trim()}
                    onClick={async () => {
                      setAdjFormSubmitting(true);
                      try {
                        const adjAuth = await getAuthHeaders();
                        const amountCents = Math.round(parseFloat(adjFormAmount) * 100);
                        const res = await fetch("/api/admin/billing/adjustments", {
                          method: "POST",
                          headers: { "Content-Type": "application/json", ...adjAuth },
                          body: JSON.stringify({
                            business_id: adjFormBusinessId,
                            amount_cents: amountCents,
                            type: adjFormType,
                            description: adjFormDescription.trim(),
                          }),
                        });
                        const data = await res.json();
                        if (res.ok && data.ok) {
                          setActionMessage({ type: "success", text: `${adjFormType === "credit" ? "Credit" : "Charge"} of ${formatMoney(amountCents)} applied to ${data.business_name}` });
                          logAudit({ action: `apply_${adjFormType}`, tab: AUDIT_TABS.BILLING, targetType: "billing_adjustment", targetId: data.adjustment.id, entityName: data.business_name, details: `${adjFormType === "credit" ? "Credit" : "Charge"}: ${formatMoney(amountCents)} — ${adjFormDescription.trim()}` });
                          setAdjFormOpen(false);
                          setAdjFormBusinessId("");
                          setAdjFormBizSearch("");
                          setAdjFormAmount("");
                          setAdjFormDescription("");
                          fetchAdjustments();
                        } else {
                          setActionMessage({ type: "error", text: data.error || "Failed to apply adjustment" });
                        }
                      } catch {
                        setActionMessage({ type: "error", text: "Network error" });
                      } finally {
                        setAdjFormSubmitting(false);
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: "14px 24px",
                      background: adjFormType === "credit" ? COLORS.gradient2 : "linear-gradient(135deg, #ff3131, #ff6b35)",
                      border: "none",
                      borderRadius: 10,
                      color: adjFormType === "credit" ? "#000" : "#fff",
                      fontWeight: 700,
                      cursor: adjFormSubmitting || !adjFormBusinessId || !adjFormAmount || !adjFormDescription.trim() ? "not-allowed" : "pointer",
                      fontSize: 15,
                      opacity: adjFormSubmitting || !adjFormBusinessId || !adjFormAmount || !adjFormDescription.trim() ? 0.5 : 1,
                    }}
                  >
                    {adjFormSubmitting ? "Applying..." : `Apply ${adjFormType === "credit" ? "Credit" : "Charge"}`}
                  </button>
                  <button
                    onClick={() => { setAdjFormOpen(false); setAdjFormBusinessId(""); setAdjFormBizSearch(""); setAdjFormAmount(""); setAdjFormDescription(""); }}
                    style={{ padding: "14px 24px", background: COLORS.darkBg, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 10, color: COLORS.textSecondary, fontWeight: 600, cursor: "pointer", fontSize: 14 }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </Card>
          )}

          {/* Adjustments Filters */}
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <input
              type="text"
              placeholder="Search business or description..."
              value={adjFilter.search}
              onChange={e => setAdjFilter(p => ({ ...p, search: e.target.value }))}
              style={{ flex: 1, padding: "10px 14px", background: COLORS.cardBg, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 10, color: "#fff", fontSize: 14, outline: "none" }}
            />
            {(["all", "pending", "applied", "voided"] as const).map(s => (
              <button
                key={s}
                onClick={() => setAdjFilter(p => ({ ...p, status: s }))}
                style={{
                  padding: "8px 20px",
                  borderRadius: 10,
                  border: adjFilter.status === s ? `1px solid ${COLORS.neonBlue}` : `1px solid ${COLORS.cardBorder}`,
                  background: adjFilter.status === s ? "rgba(0,212,255,0.15)" : COLORS.cardBg,
                  color: adjFilter.status === s ? COLORS.neonBlue : COLORS.textSecondary,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontSize: 13,
                  textTransform: "capitalize",
                }}
              >
                {s === "all" ? "All" : s}
              </button>
            ))}
          </div>

          {/* Adjustments Table */}
          <Card style={{ marginBottom: 32 }} actions={
            <ExportButtons
              data={filteredAdjustments.map(a => ({
                id: a.id,
                business: a.business_name,
                type: a.type,
                amount: formatMoney(Math.abs(a.amount_cents)),
                description: a.description,
                status: a.status,
                created_by: a.created_by_name,
                created_at: a.created_at,
              }))}
              filename="billing-adjustments"
            />
          }>
            {adjustmentsLoading ? (
              <div style={{ padding: 24, textAlign: "center", color: COLORS.textSecondary }}>Loading adjustments...</div>
            ) : filteredAdjustments.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: COLORS.textSecondary }}>No adjustments found.</div>
            ) : (
              <DataTable
                columns={[
                  { key: "business_name", label: "Business", render: (v) => <span style={{ fontWeight: 600 }}>{String(v)}</span> },
                  { key: "type", label: "Type", render: (v) => (
                    <span style={{
                      padding: "4px 10px",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      background: v === "credit" ? "rgba(57,255,20,0.12)" : "rgba(255,49,49,0.12)",
                      color: v === "credit" ? COLORS.neonGreen : COLORS.neonRed,
                    }}>
                      {String(v)}
                    </span>
                  )},
                  { key: "amount_cents", label: "Amount", align: "right" as const, render: (v, row) => {
                    const r = row as unknown as AdjustmentRecord;
                    return (
                      <span style={{ fontWeight: 700, fontSize: 15, color: r.type === "credit" ? COLORS.neonGreen : COLORS.neonRed }}>
                        {r.type === "credit" ? "-" : "+"}{formatMoney(Math.abs(v as number))}
                      </span>
                    );
                  }},
                  { key: "description", label: "Description", render: (v) => <span style={{ fontSize: 13, color: COLORS.textSecondary }}>{String(v)}</span> },
                  { key: "status", label: "Status", render: (v) => <Badge status={String(v)} /> },
                  { key: "created_by_name", label: "Applied By", render: (v) => <span style={{ fontSize: 12 }}>{String(v)}</span> },
                  { key: "created_at", label: "Date", render: (v) => <span style={{ fontSize: 12 }}>{formatDateTime(String(v))}</span> },
                  { key: "id", label: "", align: "center" as const, render: (_v, row) => {
                    const r = row as unknown as AdjustmentRecord;
                    if (r.status !== "pending") return null;
                    return (
                      <button
                        onClick={async () => {
                          const reason = prompt("Reason for voiding this adjustment:");
                          if (reason === null) return;
                          try {
                            const vAuth = await getAuthHeaders();
                            const res = await fetch("/api/admin/billing/adjustments", {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json", ...vAuth },
                              body: JSON.stringify({ adjustmentId: r.id, reason }),
                            });
                            if (res.ok) {
                              setActionMessage({ type: "success", text: "Adjustment voided" });
                              logAudit({ action: "void_adjustment", tab: AUDIT_TABS.BILLING, targetType: "billing_adjustment", targetId: r.id, entityName: r.business_name || "", details: `Voided ${r.type}: ${formatMoney(Math.abs(r.amount_cents))} — ${reason}` });
                              fetchAdjustments();
                            } else {
                              const data = await res.json();
                              setActionMessage({ type: "error", text: data.error || "Failed to void" });
                            }
                          } catch {
                            setActionMessage({ type: "error", text: "Network error" });
                          }
                        }}
                        style={{
                          padding: "6px 14px",
                          background: "rgba(255,49,49,0.1)",
                          border: `1px solid rgba(255,49,49,0.3)`,
                          borderRadius: 8,
                          color: COLORS.neonRed,
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Void
                      </button>
                    );
                  }},
                ]}
                data={filteredAdjustments as unknown as Record<string, unknown>[]}
              />
            )}
          </Card>
        </>
      )}

      {/* ==================== BALANCES TAB ==================== */}
      {activeTab === "balances" && (
        <>
          {/* Balance Stats */}
          {balanceTotals && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 32 }}>
              <StatCard icon="📊" value={formatMoney(balanceTotals.totalBilledCents)} label="Total Billed" gradient={COLORS.gradient1} />
              <StatCard icon="✅" value={formatMoney(balanceTotals.totalPaidCents)} label="Total Paid" gradient={COLORS.gradient2} />
              <StatCard icon="⚖️" value={formatMoney(Math.abs(balanceTotals.totalPendingAdjCents))} label={`Pending Adjustments ${balanceTotals.totalPendingAdjCents < 0 ? "(Credits)" : ""}`} gradient={COLORS.gradient3} />
              <StatCard icon="💰" value={formatMoney(balanceTotals.totalRemainingCents)} label={`Remaining (${balanceTotals.outstandingCount} outstanding)`} gradient={COLORS.gradient4} />
            </div>
          )}

          {/* Charge All Outstanding Button */}
          {balanceTotals && balanceTotals.outstandingCount > 0 && (
            <div style={{ marginBottom: 24 }}>
              <button
                onClick={async () => {
                  const outstandingInvoiceIds = balances
                    .flatMap(b => b.invoices)
                    .filter(inv => (inv.status === "pending" || inv.status === "sent" || inv.status === "overdue") && inv.totalCents > 0)
                    .map(inv => inv.id);

                  if (outstandingInvoiceIds.length === 0) {
                    setActionMessage({ type: "error", text: "No chargeable invoices found" });
                    return;
                  }

                  if (!confirm(`Charge ${outstandingInvoiceIds.length} outstanding invoice(s) totaling ${formatMoney(balanceTotals.totalRemainingCents)}?\n\nThis will attempt to charge each business's saved payment method.`)) return;

                  setActionLoading("charge-all");
                  try {
                    const auth = await getAuthHeaders();
                    const res = await fetch("/api/admin/billing/charge", {
                      method: "POST",
                      headers: { "Content-Type": "application/json", ...auth },
                      body: JSON.stringify({ chargeAll: true }),
                    });
                    const data = await res.json();
                    if (res.ok) {
                      const msg = `Charged: ${data.charged} | Failed: ${data.failed}`;
                      setActionMessage({ type: data.failed === 0 ? "success" : "error", text: msg });
                      logAudit({ action: "charge_all_outstanding", tab: AUDIT_TABS.BILLING, targetType: "billing", targetId: "batch", entityName: "All businesses", details: msg });
                      fetchBalances();
                    } else {
                      setActionMessage({ type: "error", text: data.error || "Charge failed" });
                    }
                  } catch {
                    setActionMessage({ type: "error", text: "Network error" });
                  } finally {
                    setActionLoading(null);
                  }
                }}
                disabled={actionLoading === "charge-all"}
                style={{
                  padding: "12px 28px",
                  background: `linear-gradient(135deg, ${COLORS.neonBlue}, ${COLORS.neonGreen})`,
                  border: "none",
                  borderRadius: 10,
                  color: "#000",
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: actionLoading === "charge-all" ? "wait" : "pointer",
                  opacity: actionLoading === "charge-all" ? 0.6 : 1,
                }}
              >
                {actionLoading === "charge-all" ? "Processing..." : `⚡ Charge All Outstanding (${balanceTotals.outstandingCount})`}
              </button>
            </div>
          )}

          {/* Month Selector + Search + Filter */}
          <div style={{ display: "flex", gap: 16, marginBottom: 24, alignItems: "center" }}>
            <select
              value={balanceMonth}
              onChange={(e) => { setBalanceMonth(e.target.value); fetchBalances(e.target.value); }}
              style={{
                padding: "12px 16px",
                background: COLORS.cardBg,
                border: `1px solid ${COLORS.cardBorder}`,
                borderRadius: 10,
                color: COLORS.textPrimary,
                fontSize: 14,
                fontWeight: 600,
                minWidth: 180,
                cursor: "pointer",
              }}
            >
              <option value="all">All Time</option>
              {balanceMonthOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Search business..."
              value={balanceSearch}
              onChange={(e) => setBalanceSearch(e.target.value)}
              style={{
                flex: 1,
                padding: "12px 16px",
                background: COLORS.cardBg,
                border: `1px solid ${COLORS.cardBorder}`,
                borderRadius: 10,
                color: COLORS.textPrimary,
                fontSize: 14,
              }}
            />
            {(["all", "outstanding", "paid", "credit"] as const).map(f => (
              <button
                key={f}
                onClick={() => setBalanceFilter(f)}
                style={{
                  padding: "10px 20px",
                  borderRadius: 10,
                  border: `1px solid ${balanceFilter === f ? COLORS.neonBlue : COLORS.cardBorder}`,
                  background: balanceFilter === f ? `${COLORS.neonBlue}20` : "transparent",
                  color: balanceFilter === f ? COLORS.neonBlue : COLORS.textSecondary,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  textTransform: "capitalize",
                }}
              >
                {f === "outstanding" ? "Outstanding" : f === "paid" ? "Paid in Full" : f === "credit" ? "Credit Balance" : "All"}
              </button>
            ))}
          </div>

          <ExportButtons
            filename="business-balances"
            data={balances.map(b => ({
              Business: b.businessName,
              "Total Billed": (b.totalBilledCents / 100).toFixed(2),
              "Amount Paid": (b.totalPaidCents / 100).toFixed(2),
              "Adjustments": (b.pendingAdjCents / 100).toFixed(2),
              "Remaining": (b.remainingCents / 100).toFixed(2),
              "Plan": b.isPremium ? "Premium" : "Basic",
              "Payment Method": b.paymentMethod || "—",
            }))}
          />

          <Card>
            {balancesLoading ? (
              <div style={{ textAlign: "center", padding: 40, color: COLORS.textSecondary }}>Loading balances...</div>
            ) : (
              <div>
                {/* Table Header */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 80px",
                  padding: "12px 20px",
                  borderBottom: `1px solid ${COLORS.cardBorder}`,
                  fontSize: 11,
                  fontWeight: 700,
                  color: COLORS.textSecondary,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}>
                  <div>Business</div>
                  <div style={{ textAlign: "right" }}>Total Billed</div>
                  <div style={{ textAlign: "right" }}>Amount Paid</div>
                  <div style={{ textAlign: "right" }}>Adjustments</div>
                  <div style={{ textAlign: "right" }}>Remaining</div>
                  <div></div>
                </div>

                {/* Rows */}
                {(() => {
                  const filtered = balances.filter(b => {
                    if (balanceSearch && !b.businessName.toLowerCase().includes(balanceSearch.toLowerCase())) return false;
                    if (balanceFilter === "outstanding" && b.remainingCents <= 0) return false;
                    if (balanceFilter === "paid" && b.remainingCents > 0) return false;
                    if (balanceFilter === "credit" && b.remainingCents >= 0) return false;
                    return true;
                  });

                  if (filtered.length === 0) {
                    return <div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary }}>No businesses match this filter</div>;
                  }

                  return filtered.map(biz => (
                    <div key={biz.businessId}>
                      {/* Main Row */}
                      <div
                        onClick={() => setExpandedBalanceBiz(expandedBalanceBiz === biz.businessId ? null : biz.businessId)}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 80px",
                          padding: "14px 20px",
                          borderBottom: `1px solid ${COLORS.cardBorder}`,
                          cursor: "pointer",
                          transition: "background 0.15s",
                          background: expandedBalanceBiz === biz.businessId ? "rgba(0,212,255,0.05)" : "transparent",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = expandedBalanceBiz === biz.businessId ? "rgba(0,212,255,0.05)" : "transparent"; }}
                      >
                        <div>
                          <span style={{ fontWeight: 700, fontSize: 14 }}>{biz.businessName}</span>
                          <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 2 }}>
                            <Badge status={biz.isPremium ? "premium" : "basic"} />
                            {biz.paymentMethod && <span style={{ marginLeft: 8 }}>{biz.paymentMethod === "card" ? "💳" : "🏦"} {biz.paymentMethod}</span>}
                          </div>
                        </div>
                        <div style={{ textAlign: "right", fontWeight: 600, fontSize: 14, alignSelf: "center" }}>
                          {formatMoney(biz.totalBilledCents)}
                        </div>
                        <div style={{ textAlign: "right", fontWeight: 600, fontSize: 14, alignSelf: "center", color: biz.totalPaidCents > 0 ? COLORS.neonGreen : COLORS.textSecondary }}>
                          {formatMoney(biz.totalPaidCents)}
                        </div>
                        <div style={{ textAlign: "right", fontWeight: 600, fontSize: 14, alignSelf: "center", color: biz.pendingAdjCents < 0 ? COLORS.neonGreen : biz.pendingAdjCents > 0 ? COLORS.neonRed : COLORS.textSecondary }}>
                          {biz.pendingAdjCents === 0 ? "$0" : (biz.pendingAdjCents < 0 ? "-" : "+") + formatMoney(Math.abs(biz.pendingAdjCents))}
                        </div>
                        <div style={{
                          textAlign: "right",
                          fontWeight: 800,
                          fontSize: 14,
                          alignSelf: "center",
                          color: biz.remainingCents > 0 ? COLORS.neonRed : biz.remainingCents < 0 ? COLORS.neonGreen : COLORS.neonGreen,
                        }}>
                          {biz.remainingCents === 0 ? (
                            <span style={{ color: COLORS.neonGreen }}>$0 ✓</span>
                          ) : biz.remainingCents < 0 ? (
                            <span>-{formatMoney(Math.abs(biz.remainingCents))}</span>
                          ) : (
                            formatMoney(biz.remainingCents)
                          )}
                        </div>
                        <div style={{ textAlign: "center", alignSelf: "center", color: COLORS.textSecondary, fontSize: 16 }}>
                          {expandedBalanceBiz === biz.businessId ? "▲" : "▼"}
                        </div>
                      </div>

                      {/* Expanded Detail */}
                      {expandedBalanceBiz === biz.businessId && (
                        <div style={{
                          padding: "16px 20px 16px 40px",
                          background: "rgba(0,212,255,0.03)",
                          borderBottom: `1px solid ${COLORS.cardBorder}`,
                        }}>
                          {/* Invoices */}
                          {biz.invoices.length > 0 && (
                            <div style={{ marginBottom: biz.pendingAdjustments.length > 0 ? 16 : 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.neonBlue, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                Invoices ({biz.invoices.length})
                              </div>
                              {biz.invoices.map(inv => (
                                <div key={inv.id} style={{ marginBottom: 8 }}>
                                  <div style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    padding: "10px 14px",
                                    background: "rgba(255,255,255,0.03)",
                                    borderRadius: 8,
                                    border: `1px solid ${COLORS.cardBorder}`,
                                  }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                      <span style={{ fontWeight: 600, fontSize: 13 }}>{inv.billingPeriod}</span>
                                      <Badge status={inv.status} />
                                      {inv.paidAt && (
                                        <span style={{ fontSize: 11, color: COLORS.textSecondary }}>
                                          Paid {formatDate(inv.paidAt)} {inv.paidVia ? `via ${inv.paidVia}` : ""}
                                        </span>
                                      )}
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                      <span style={{ fontWeight: 700, fontSize: 14 }}>{formatMoney(inv.totalCents)}</span>
                                      {(inv.status === "pending" || inv.status === "sent" || inv.status === "overdue") && inv.totalCents > 0 && (
                                        <button
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            if (!confirm(`Charge ${formatMoney(inv.totalCents)} for ${biz.businessName} (${inv.billingPeriod})?`)) return;
                                            setActionLoading(inv.id);
                                            try {
                                              const auth = await getAuthHeaders();
                                              const res = await fetch("/api/admin/billing/charge", {
                                                method: "POST",
                                                headers: { "Content-Type": "application/json", ...auth },
                                                body: JSON.stringify({ invoiceIds: [inv.id] }),
                                              });
                                              const data = await res.json();
                                              if (res.ok && data.charged > 0) {
                                                setActionMessage({ type: "success", text: `Payment succeeded for ${biz.businessName} — ${formatMoney(inv.totalCents)}` });
                                                logAudit({ action: "retry_payment", tab: AUDIT_TABS.BILLING, targetType: "invoice", targetId: inv.id, entityName: biz.businessName, details: `Charged ${formatMoney(inv.totalCents)} for ${inv.billingPeriod}` });
                                                fetchBalances();
                                              } else {
                                                const errMsg = data.results?.[0]?.error || data.error || "Payment failed";
                                                setActionMessage({ type: "error", text: `Payment failed for ${biz.businessName}: ${errMsg}` });
                                              }
                                            } catch {
                                              setActionMessage({ type: "error", text: "Network error" });
                                            } finally {
                                              setActionLoading(null);
                                            }
                                          }}
                                          disabled={actionLoading === inv.id}
                                          style={{
                                            padding: "5px 12px",
                                            background: "rgba(0,212,255,0.1)",
                                            border: `1px solid rgba(0,212,255,0.3)`,
                                            borderRadius: 6,
                                            color: COLORS.neonBlue,
                                            fontSize: 11,
                                            fontWeight: 700,
                                            cursor: actionLoading === inv.id ? "wait" : "pointer",
                                            opacity: actionLoading === inv.id ? 0.5 : 1,
                                            whiteSpace: "nowrap",
                                          }}
                                        >
                                          {actionLoading === inv.id ? "Charging..." : "⚡ Charge"}
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  {/* Line items */}
                                  {inv.lineItems.length > 0 && (
                                    <div style={{ marginLeft: 20, marginTop: 4 }}>
                                      {inv.lineItems.map((li, idx) => (
                                        <div key={idx} style={{
                                          display: "flex",
                                          justifyContent: "space-between",
                                          padding: "4px 12px",
                                          fontSize: 12,
                                          color: COLORS.textSecondary,
                                          borderLeft: `2px solid ${COLORS.cardBorder}`,
                                        }}>
                                          <span>{li.description || li.line_type}</span>
                                          <span style={{ fontWeight: 600 }}>{formatMoney(li.amount_cents)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Pending Adjustments */}
                          {biz.pendingAdjustments.length > 0 && (
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.neonYellow, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                Pending Adjustments ({biz.pendingAdjustments.length})
                              </div>
                              {biz.pendingAdjustments.map(adj => (
                                <div key={adj.id} style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  padding: "8px 14px",
                                  background: adj.type === "credit" ? "rgba(57,255,20,0.05)" : "rgba(255,49,49,0.05)",
                                  borderRadius: 8,
                                  border: `1px solid ${adj.type === "credit" ? "rgba(57,255,20,0.15)" : "rgba(255,49,49,0.15)"}`,
                                  marginBottom: 4,
                                }}>
                                  <div>
                                    <span style={{ fontSize: 13, fontWeight: 600 }}>{adj.description}</span>
                                    <span style={{ fontSize: 11, color: COLORS.textSecondary, marginLeft: 8 }}>{formatDate(adj.created_at)}</span>
                                  </div>
                                  <span style={{
                                    fontWeight: 700,
                                    fontSize: 14,
                                    color: adj.type === "credit" ? COLORS.neonGreen : COLORS.neonRed,
                                  }}>
                                    {adj.type === "credit" ? "-" : "+"}{formatMoney(Math.abs(adj.amount_cents))}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {biz.invoices.length === 0 && biz.pendingAdjustments.length === 0 && (
                            <div style={{ color: COLORS.textSecondary, fontSize: 13 }}>No invoices or adjustments</div>
                          )}
                        </div>
                      )}
                    </div>
                  ));
                })()}
              </div>
            )}
          </Card>
        </>
      )}

      {/* Invoice Detail Modal */}
      {selectedBill && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1001,
          }}
          onClick={() => setSelectedBill(null)}
        >
          <div
            style={{
              background: COLORS.cardBg,
              borderRadius: 16,
              width: 600,
              maxHeight: "80vh",
              overflow: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: 24, borderBottom: "1px solid " + COLORS.cardBorder }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Invoice {selectedBill.id}</h2>
                  <div style={{ fontSize: 14, color: COLORS.textSecondary }}>{selectedBill.business_name}</div>
                </div>
                <Badge status={selectedBill.status} />
              </div>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
                <div>
                  <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 4 }}>Billing Period</div>
                  <div style={{ fontWeight: 600 }}>{selectedBill.billing_period}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 4 }}>Invoice Date</div>
                  <div style={{ fontWeight: 600 }}>{formatDate(selectedBill.invoice_date)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 4 }}>Due Date</div>
                  <div style={{ fontWeight: 600 }}>{formatDate(selectedBill.due_date)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 4 }}>Payment Method</div>
                  <div style={{ fontWeight: 600, textTransform: "capitalize" }}>{selectedBill.payment_method || "—"}</div>
                </div>
              </div>

              <div style={{ background: COLORS.darkBg, borderRadius: 12, padding: 16, marginBottom: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.textSecondary, marginBottom: 12 }}>LINE ITEMS</div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid " + COLORS.cardBorder }}>
                  <span>Receipt Payouts ({selectedBill.line_items.receipt_payouts.count} receipts)</span>
                  <span style={{ fontWeight: 600 }}>{formatMoney(selectedBill.line_items.receipt_payouts.amount)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid " + COLORS.cardBorder }}>
                  <span>Platform Fees</span>
                  <span style={{ fontWeight: 600 }}>{formatMoney(selectedBill.line_items.platform_fees?.amount || selectedBill.line_items.letsgo_fee || 0)}</span>
                </div>
                {selectedBill.line_items.advertising && selectedBill.line_items.advertising.length > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid " + COLORS.cardBorder }}>
                    <span>Advertising ({selectedBill.line_items.advertising.length} campaign{selectedBill.line_items.advertising.length !== 1 ? "s" : ""})</span>
                    <span style={{ fontWeight: 600 }}>{formatMoney(selectedBill.line_items.advertising.reduce((s, a) => s + a.amount, 0))}</span>
                  </div>
                )}
                {selectedBill.line_items.premium_subscription && (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid " + COLORS.cardBorder }}>
                    <span>Premium Subscription</span>
                    <span style={{ fontWeight: 600 }}>{formatMoney(selectedBill.line_items.premium_subscription)}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", marginTop: 8 }}>
                  <span style={{ fontSize: 16, fontWeight: 700 }}>Total Due</span>
                  <span style={{ fontSize: 20, fontWeight: 700, color: selectedBill.status === "paid" ? COLORS.neonGreen : COLORS.neonPink }}>{formatMoney(selectedBill.total_due)}</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                {(selectedBill.status === "pending" || selectedBill.status === "sent") && (
                  <>
                    <button
                      onClick={async () => {
                        try {
                          const mpAuth = await getAuthHeaders();
                          const res = await fetch("/api/admin/billing/invoices", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json", ...mpAuth },
                            body: JSON.stringify({ invoiceId: selectedBill.id, action: "mark_paid" }),
                          });
                          if (res.ok) {
                            setActionMessage({ type: "success", text: `Invoice for ${selectedBill.business_name} marked as paid` });
                            logAudit({ action: "mark_invoice_paid", tab: AUDIT_TABS.BILLING, targetType: "invoice", targetId: selectedBill.id, entityName: selectedBill.business_name, details: `Marked as paid: ${formatMoney(selectedBill.total_due)}` });
                            setSelectedBill(null);
                            fetchData();
                          } else {
                            const data = await res.json();
                            setActionMessage({ type: "error", text: data.error || "Failed to mark as paid" });
                          }
                        } catch { setActionMessage({ type: "error", text: "Network error" }); }
                      }}
                      style={{
                        flex: 1,
                        padding: "14px 24px",
                        background: COLORS.gradient2,
                        border: "none",
                        borderRadius: 10,
                        color: "#000",
                        fontWeight: 700,
                        cursor: "pointer",
                        fontSize: 14,
                      }}
                    >
                      ✓ Mark as Paid
                    </button>
                    <button
                      onClick={async () => {
                        const reason = prompt("Reason for voiding this invoice:");
                        if (reason === null) return;
                        try {
                          const vAuth = await getAuthHeaders();
                          const res = await fetch("/api/admin/billing/invoices", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json", ...vAuth },
                            body: JSON.stringify({ invoiceId: selectedBill.id, action: "void", reason }),
                          });
                          if (res.ok) {
                            setActionMessage({ type: "success", text: `Invoice voided` });
                            logAudit({ action: "void_invoice", tab: AUDIT_TABS.BILLING, targetType: "invoice", targetId: selectedBill.id, entityName: selectedBill.business_name, details: `Voided: ${reason || "No reason given"}` });
                            setSelectedBill(null);
                            fetchData();
                          } else {
                            const data = await res.json();
                            setActionMessage({ type: "error", text: data.error || "Failed to void invoice" });
                          }
                        } catch { setActionMessage({ type: "error", text: "Network error" }); }
                      }}
                      style={{
                        padding: "14px 24px",
                        background: "rgba(255,49,49,0.1)",
                        border: `1px solid rgba(255,49,49,0.3)`,
                        borderRadius: 10,
                        color: COLORS.neonRed,
                        fontWeight: 700,
                        cursor: "pointer",
                        fontSize: 14,
                      }}
                    >
                      Void
                    </button>
                  </>
                )}
                <button
                  onClick={() => setSelectedBill(null)}
                  style={{
                    flex: 1,
                    padding: "14px 24px",
                    background: COLORS.darkBg,
                    border: "1px solid " + COLORS.cardBorder,
                    borderRadius: 10,
                    color: COLORS.textSecondary,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}