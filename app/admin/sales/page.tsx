"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import {
  COLORS,
  Card,
  Badge,
  DataTable,
  formatMoney,
  formatDate,
} from "@/components/admin/components";
import { logAudit, AUDIT_TABS } from "@/lib/auditLog";
import SalesProspecting from "@/components/admin/SalesProspecting";

/* ==================== TYPES ==================== */

interface Division {
  id: string;
  name: string;
}

interface Zone {
  id: string;
  name: string;
  division_id: string;
  states: string[];
  goal: number;
}

interface SalesRep {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  division_id: string | null;
  zone_id: string | null;
  city: string | null;
  supervisor_id: string | null;
  hire_date: string | null;
  status: string;
  avatar: string | null;
  individual_quota: number | null;
}

interface SalesSignup {
  id: string;
  rep_id: string;
  business_name: string | null;
  plan: string;
  commission_cents: number;
  ad_spend_cents: number;
  pool_contribution_cents: number;
  division_id: string | null;
  zone_id: string | null;
  city: string | null;
  state: string | null;
  signed_at: string;
  payout_period: string | null;
  commission_paid: boolean;
}

interface InboundSignup {
  id: string;
  business_name: string | null;
  plan: string;
  ad_spend_cents: number;
  pool_contribution_cents: number;
  signed_at: string;
}

interface PayoutHistory {
  id: string;
  type: string;
  rep_id: string;
  rep_name: string;
  period: string;
  amount_cents: number;
  basic_count: number;
  premium_count: number;
  ad_commission_cents: number;
  pool_share: string | null;
  notes: string | null;
  status: string;
  paid_at: string | null;
}

interface BonusPool {
  id: string;
  quarter: string;
  quarter_start: string;
  quarter_end: string;
  total_pool_cents: number;
  inbound_basic_cents: number;
  inbound_premium_cents: number;
  inbound_ads_cents: number;
  rep_basic_cents: number;
  rep_premium_cents: number;
  rep_ads_cents: number;
  repeat_customers_cents: number;
  eligible_rep_ids: string[];
  projected_per_rep_cents: number;
  status: string;
  paid_at: string | null;
}

interface RepeatCustomer {
  id: string;
  business_name: string;
  original_rep_id: string;
  original_signup_date: string;
  repeat_months: number;
  pool_contribution_cents: number;
}

interface SalesConfig {
  id: string;
  category: string;
  key: string;
  value_cents: number | null;
  value_int: number | null;
}

interface QuotaOverride {
  id: string;
  target_type: string;
  target_id: string;
  quota: number;
  period: string;
}

/* ==================== HELPERS ==================== */

const ROLE_LABELS: Record<string, string> = {
  vp_smb_sales: "VP SMB Sales",
  zone_sales_director: "Zone Sales Director",
  city_sales_manager: "City Sales Manager",
  team_lead: "Team Lead",
  sales_rep: "Sales Rep",
};

const ROLE_HIERARCHY = ["vp_smb_sales", "zone_sales_director", "city_sales_manager", "team_lead", "sales_rep"];

function Avatar({ name, initials }: { name: string; initials?: string | null }) {
  const init = initials || name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const colors = [COLORS.neonGreen, COLORS.neonBlue, COLORS.neonPurple, COLORS.neonOrange, COLORS.neonYellow];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div style={{ width: 40, height: 40, borderRadius: "50%", background: `linear-gradient(135deg, ${color}, ${COLORS.neonPurple})`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, flexShrink: 0, color: "#000" }}>
      {init}
    </div>
  );
}

function ProgressBar({ value, max, color, height = 8 }: { value: number; max: number; color?: string; height?: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ height, background: COLORS.darkBg, borderRadius: 100, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${pct}%`, background: color || COLORS.gradient2, borderRadius: 100, transition: "width 0.5s" }} />
    </div>
  );
}

function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const csvContent = [headers.join(","), ...rows.map((row) => row.map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`).join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function downloadXLSX(filename: string, headers: string[], rows: string[][]) {
  // Using SheetJS (xlsx) library loaded from CDN
  const XLSX = (window as any).XLSX;
  if (!XLSX) {
    // Load SheetJS dynamically if not present
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    script.onload = () => {
      const ws = (window as any).XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wb = (window as any).XLSX.utils.book_new();
      (window as any).XLSX.utils.book_append_sheet(wb, ws, "Sales Data");
      (window as any).XLSX.writeFile(wb, filename);
    };
    document.head.appendChild(script);
    return;
  }
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sales Data");
  XLSX.writeFile(wb, filename);
}

function SearchableSelect({ value, onChange, options, placeholder, searchPlaceholder }: {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string; sub?: string }[];
  placeholder: string;
  searchPlaceholder?: string;
}) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()) || (o.sub && o.sub.toLowerCase().includes(search.toLowerCase())));
  const selected = options.find(o => o.value === value);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div onClick={() => setIsOpen(!isOpen)} style={{ padding: "8px 12px", background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: selected ? COLORS.textPrimary : COLORS.textSecondary, fontSize: 12, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>{selected ? selected.label : placeholder}</span>
        <span style={{ fontSize: 10 }}>▼</span>
      </div>
      {isOpen && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, marginTop: 4, zIndex: 100, maxHeight: 250, overflowY: "auto" }}>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={searchPlaceholder || "Search..."} style={{ width: "100%", padding: 10, background: COLORS.darkBg, border: "none", borderBottom: "1px solid " + COLORS.cardBorder, color: COLORS.textPrimary, fontSize: 12 }} autoFocus />
          <div onClick={() => { onChange("all"); setIsOpen(false); setSearch(""); }} style={{ padding: 10, cursor: "pointer", borderBottom: "1px solid " + COLORS.cardBorder, background: value === "all" ? COLORS.gradient1 : "transparent" }}>{placeholder}</div>
          {filtered.map(o => (
            <div key={o.value} onClick={() => { onChange(o.value); setIsOpen(false); setSearch(""); }} style={{ padding: 10, cursor: "pointer", background: value === o.value ? COLORS.gradient1 : "transparent" }}>
              <div style={{ fontWeight: 600 }}>{o.label}</div>
              {o.sub && <div style={{ fontSize: 10, color: COLORS.textSecondary }}>{o.sub}</div>}
            </div>
          ))}
          {filtered.length === 0 && <div style={{ padding: 10, color: COLORS.textSecondary }}>No results</div>}
        </div>
      )}
    </div>
  );
}

/* ==================== MAIN PAGE ==================== */

export default function SalesPage() {
  // Data state
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [salesReps, setSalesReps] = useState<SalesRep[]>([]);
  const [signups, setSignups] = useState<SalesSignup[]>([]);
  const [inboundSignups, setInboundSignups] = useState<InboundSignup[]>([]);
  const [payoutHistory, setPayoutHistory] = useState<PayoutHistory[]>([]);
  const [bonusPool, setBonusPool] = useState<BonusPool | null>(null);
  const [previousPools, setPreviousPools] = useState<BonusPool[]>([]);
  const [repeatCustomers, setRepeatCustomers] = useState<RepeatCustomer[]>([]);
  const [config, setConfig] = useState<SalesConfig[]>([]);
  const [quotaOverrides, setQuotaOverrides] = useState<QuotaOverride[]>([]);
  const [loading, setLoading] = useState(true);

  // Ad campaign revenue (from business_ad_campaigns)
  const [adCampaignRevenue, setAdCampaignRevenue] = useState({ total: 0, surge: 0, base: 0, count: 0 });

  // UI state
  const [salesTab, setSalesTab] = useState("overview");
  const [salesPeriod, setSalesPeriod] = useState("month");
  const [poolMatrixPeriod, setPoolMatrixPeriod] = useState("month");
  const [geoBreakdownView, setGeoBreakdownView] = useState("division");
  const [geoSummaryView, setGeoSummaryView] = useState("division");
  const [geoSearchQuery, setGeoSearchQuery] = useState("");
  const [selectedRep, setSelectedRep] = useState<SalesRep | null>(null);
  const [signupTypeFilter, setSignupTypeFilter] = useState("all");
  const [signupSearchQuery, setSignupSearchQuery] = useState("");
  const [signupFilters, setSignupFilters] = useState({ dateFrom: "", dateTo: "", zone: "all", rep: "all", plan: "all" });
  const [historyFilter, setHistoryFilter] = useState("all");
  const [historyRepFilter, setHistoryRepFilter] = useState("all");
  const [payoutPeriodFilter, setPayoutPeriodFilter] = useState("all");
  const [payoutStatusFilter, setPayoutStatusFilter] = useState("all");
  const [payoutDateFilter, setPayoutDateFilter] = useState({ from: "", to: "" });
  const [paidCommissions, setPaidCommissions] = useState<Record<string, { period1: boolean; period2: boolean }>>({});
  const [paidBonusQuarters, setPaidBonusQuarters] = useState<string[]>([]);
  const [showBonusDetailsModal, setShowBonusDetailsModal] = useState(false);
  const [selectedBonusQuarter, setSelectedBonusQuarter] = useState<BonusPool | null>(null);

  // Filters
  const [salesFilters, setSalesFilters] = useState({ dateFrom: "", dateTo: "", zone: "all", state: "all", rep: "all" });

  // Modals
  const [showAddSaleModal, setShowAddSaleModal] = useState(false);
  const [showEditRatesModal, setShowEditRatesModal] = useState(false);
  const [showAddRepModal, setShowAddRepModal] = useState(false);
  const [showEditQuotaModal, setShowEditQuotaModal] = useState(false);
  const [showEditSignupModal, setShowEditSignupModal] = useState(false);
  const [editingSignup, setEditingSignup] = useState<{ id: string; type: "outbound" | "inbound"; commission_cents?: number; pool_contribution_cents?: number } | null>(null);

  // Form state
  const [newSale, setNewSale] = useState({ rep_id: "", business_name: "", plan: "basic", ad_spend: 0, notes: "", city: "", state: "" });
  const [repSearchQuery, setRepSearchQuery] = useState("");
  const [newRep, setNewRep] = useState({
    name: "", email: "", phone: "", role: "sales_rep",
    division_id: "", zone_id: "", city: "", supervisor_id: "",
    hire_date: new Date().toISOString().slice(0, 10), individual_quota: 60
  });
  const [editRates, setEditRates] = useState<Record<string, number>>({});
  const [quotaEditTarget, setQuotaEditTarget] = useState<{ type: string; id: string; name: string } | null>(null);
  const [quotaEditValues, setQuotaEditValues] = useState({ monthly: 0, quarterly: 0, yearly: 0 });

  const getConfig = useCallback((key: string, type: "cents" | "int" = "cents"): number => {
    const c = config.find((cfg) => cfg.key === key);
    if (!c) {
      const defaults: Record<string, number> = { basic_signup: 2500, premium_signup: 10000, advertising_per_100: 1000, individual_monthly: 60, bonus_eligibility: 30, team_monthly: 300 };
      return defaults[key] || 0;
    }
    return type === "cents" ? (c.value_cents || 0) : (c.value_int || 0);
  }, [config]);

  const commissionRates = useMemo(() => ({
    individual: { basic_signup: getConfig("basic_signup"), premium_signup: getConfig("premium_signup"), advertising_per_100: getConfig("advertising_per_100") },
    quotas: { individual_monthly: getConfig("individual_monthly", "int") || 60, bonus_eligibility: getConfig("bonus_eligibility", "int") || 30, team_monthly: getConfig("team_monthly", "int") || 300 },
  }), [getConfig]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [divRes, zoneRes, configRes, repsRes, signupsRes, inboundRes, historyRes, repeatRes, quotaRes] = await Promise.all([
        supabaseBrowser.from("sales_divisions").select("*").order("name"),
        supabaseBrowser.from("sales_zones").select("*").order("name"),
        supabaseBrowser.from("sales_config").select("*"),
        supabaseBrowser.from("sales_reps").select("*").order("name"),
        supabaseBrowser.from("sales_signups").select("*").order("signed_at", { ascending: false }),
        supabaseBrowser.from("inbound_signups").select("*").order("signed_at", { ascending: false }),
        supabaseBrowser.from("sales_payout_history").select("*").order("paid_at", { ascending: false, nullsFirst: true }),
        supabaseBrowser.from("sales_repeat_customers").select("*").eq("active", true),
        supabaseBrowser.from("sales_quota_overrides").select("*"),
      ]);

      if (divRes.data) setDivisions(divRes.data);
      if (zoneRes.data) setZones(zoneRes.data);
      if (configRes.data) setConfig(configRes.data);
      if (repsRes.data) setSalesReps(repsRes.data);
      if (signupsRes.data) setSignups(signupsRes.data);
      if (inboundRes.data) setInboundSignups(inboundRes.data);
      if (historyRes.data) setPayoutHistory(historyRes.data);
      if (repeatRes.data) setRepeatCustomers(repeatRes.data);
      if (quotaRes.data) setQuotaOverrides(quotaRes.data);

      // Get bonus pools
      const currentQuarter = `Q${Math.ceil((new Date().getMonth() + 1) / 3)} ${new Date().getFullYear()}`;
      const { data: poolData } = await supabaseBrowser.from("sales_bonus_pool").select("*").eq("quarter", currentQuarter).maybeSingle();
      if (poolData) setBonusPool(poolData);

      const { data: prevPoolsData } = await supabaseBrowser.from("sales_bonus_pool").select("*").neq("quarter", currentQuarter).order("quarter_start", { ascending: false }).limit(4);
      if (prevPoolsData) {
        setPreviousPools(prevPoolsData);
      }

      // Fetch ad campaign revenue for surge metrics
      const { data: adCampData } = await supabaseBrowser
        .from("business_ad_campaigns")
        .select("price_cents,base_price_cents,surge_fee_cents,paid")
        .eq("paid", true);
      if (adCampData) {
        const total = adCampData.reduce((s, c) => s + (c.price_cents || 0), 0);
        const surge = adCampData.reduce((s, c) => s + (c.surge_fee_cents || 0), 0);
        setAdCampaignRevenue({ total, surge, base: total - surge, count: adCampData.length });
      }

      // Build paid quarters list including current quarter if paid
      const paidQuarters: string[] = [];
      if (poolData && poolData.status === "paid") {
        paidQuarters.push(poolData.quarter);
      }
      if (prevPoolsData) {
        paidQuarters.push(...prevPoolsData.filter(p => p.status === "paid").map(p => p.quarter));
      }
      setPaidBonusQuarters(paidQuarters);
    } catch (err) {
      console.error("Error fetching sales data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Get only sales reps (not managers)
  const actualSalesReps = useMemo(() => salesReps.filter(r => r.role === "sales_rep"), [salesReps]);

  // Filter signups
  const filteredSignups = useMemo(() => {
    let filtered = [...signups];
    const now = new Date();
    if (salesPeriod === "day") {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      filtered = filtered.filter((s) => new Date(s.signed_at) >= today);
    } else if (salesPeriod === "week") {
      const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
      filtered = filtered.filter((s) => new Date(s.signed_at) >= weekAgo);
    } else if (salesPeriod === "month") {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      filtered = filtered.filter((s) => new Date(s.signed_at) >= monthStart);
    } else if (salesPeriod === "year") {
      const yearStart = new Date(now.getFullYear(), 0, 1);
      filtered = filtered.filter((s) => new Date(s.signed_at) >= yearStart);
    }
    if (salesFilters.dateFrom) filtered = filtered.filter((s) => new Date(s.signed_at) >= new Date(salesFilters.dateFrom));
    if (salesFilters.dateTo) filtered = filtered.filter((s) => new Date(s.signed_at) <= new Date(salesFilters.dateTo + "T23:59:59"));
    if (salesFilters.zone !== "all") filtered = filtered.filter((s) => s.zone_id === salesFilters.zone);
    if (salesFilters.state !== "all") filtered = filtered.filter((s) => s.state === salesFilters.state);
    if (salesFilters.rep !== "all") filtered = filtered.filter((s) => s.rep_id === salesFilters.rep);
    return filtered;
  }, [signups, salesPeriod, salesFilters]);

  const getRepPerformance = useCallback((repId: string) => {
    const repSignups = filteredSignups.filter((s) => s.rep_id === repId);
    const basic = repSignups.filter((s) => s.plan === "basic").length;
    const premium = repSignups.filter((s) => s.plan === "premium").length;
    const adSpend = repSignups.reduce((sum, s) => sum + (s.ad_spend_cents || 0), 0);
    const commission = repSignups.reduce((sum, s) => sum + (s.commission_cents || 0), 0);
    return { basic, premium, total: basic + premium, adSpend, commission };
  }, [filteredSignups]);

  const totalSignups = filteredSignups.length;
  const totalCommissions = filteredSignups.reduce((sum, s) => sum + (s.commission_cents || 0), 0);
  const totalAdSpend = filteredSignups.reduce((sum, s) => sum + (s.ad_spend_cents || 0), 0);
  const eligibleReps = actualSalesReps.filter((rep) => getRepPerformance(rep.id).total >= commissionRates.quotas.bonus_eligibility);
  const notYetEligibleReps = actualSalesReps.filter((rep) => getRepPerformance(rep.id).total < commissionRates.quotas.bonus_eligibility);

  // Filtered signups for Signups tab (uses signupFilters and signupSearchQuery)
  const filteredSignupsForTab = useMemo(() => {
    let filtered = [...signups];

    // Search by business name
    if (signupSearchQuery) {
      filtered = filtered.filter(s => (s.business_name || "").toLowerCase().includes(signupSearchQuery.toLowerCase()));
    }

    // Date filters
    if (signupFilters.dateFrom) {
      filtered = filtered.filter(s => new Date(s.signed_at) >= new Date(signupFilters.dateFrom));
    }
    if (signupFilters.dateTo) {
      const toDate = new Date(signupFilters.dateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(s => new Date(s.signed_at) <= toDate);
    }

    // Zone filter
    if (signupFilters.zone !== "all") {
      filtered = filtered.filter(s => s.zone_id === signupFilters.zone);
    }

    // Rep filter
    if (signupFilters.rep !== "all") {
      filtered = filtered.filter(s => s.rep_id === signupFilters.rep);
    }

    // Plan filter
    if (signupFilters.plan !== "all") {
      filtered = filtered.filter(s => s.plan === signupFilters.plan);
    }

    return filtered;
  }, [signups, signupSearchQuery, signupFilters]);

  // Filtered inbound signups for Signups tab
  const filteredInboundForTab = useMemo(() => {
    let filtered = [...inboundSignups];

    // Search by business name
    if (signupSearchQuery) {
      filtered = filtered.filter(s => (s.business_name || "").toLowerCase().includes(signupSearchQuery.toLowerCase()));
    }

    // Date filters
    if (signupFilters.dateFrom) {
      filtered = filtered.filter(s => new Date(s.signed_at) >= new Date(signupFilters.dateFrom));
    }
    if (signupFilters.dateTo) {
      const toDate = new Date(signupFilters.dateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(s => new Date(s.signed_at) <= toDate);
    }

    // Plan filter
    if (signupFilters.plan !== "all") {
      filtered = filtered.filter(s => s.plan === signupFilters.plan);
    }

    return filtered;
  }, [inboundSignups, signupSearchQuery, signupFilters]);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const period1End = new Date(currentYear, currentMonth - 1, 15, 23, 59, 59);
  const monthSignups = signups.filter(s => {
    const d = new Date(s.signed_at);
    return d.getFullYear() === currentYear && d.getMonth() + 1 === currentMonth;
  });
  const period1Signups = monthSignups.filter(s => new Date(s.signed_at) <= period1End);
  const period2Signups = monthSignups.filter(s => new Date(s.signed_at) > period1End);
  const ytdPaid = payoutHistory.filter((p) => p.status === "paid").reduce((a, p) => a + p.amount_cents, 0);

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const currentMonthName = monthNames[currentMonth - 1];
  const periodLabel = salesPeriod === "day" ? "Today" : salesPeriod === "week" ? "This Week" : salesPeriod === "year" ? "This Year" : "This Month";
  const hasActiveFilters = salesFilters.dateFrom || salesFilters.dateTo || salesFilters.zone !== "all" || salesFilters.state !== "all" || salesFilters.rep !== "all";

  const tabs = [
    { key: "overview", label: "📊 Overview" },
    { key: "reps", label: "👥 Sales Reps" },
    { key: "signups", label: "📝 Signups" },
    { key: "bonuspool", label: "🏆 Bonus Pool" },
    { key: "quotas", label: "🎯 Quotas" },
    { key: "history", label: "📜 History" },
    { key: "payouts", label: "💵 Payouts" },
    { key: "prospecting", label: "🔍 Prospecting" },
  ];

  // Get supervisors (anyone above sales_rep)
  const getSupervisorOptions = useCallback((role: string) => {
    const roleIdx = ROLE_HIERARCHY.indexOf(role);
    if (roleIdx <= 0) return [];
    return salesReps.filter(r => ROLE_HIERARCHY.indexOf(r.role) < roleIdx && r.status === "active");
  }, [salesReps]);

  const getZoneName = useCallback((zoneId: string | null) => {
    if (!zoneId) return "—";
    const zone = zones.find(z => z.id === zoneId);
    return zone?.name || "—";
  }, [zones]);

  const getDivisionName = useCallback((divId: string | null) => {
    if (!divId) return "—";
    const div = divisions.find(d => d.id === divId);
    return div?.name || "—";
  }, [divisions]);

  const getSupervisorName = useCallback((supId: string | null) => {
    if (!supId) return "—";
    const sup = salesReps.find(r => r.id === supId);
    return sup?.name || "—";
  }, [salesReps]);

  // Handlers
  async function handleAddRep() {
    if (!newRep.name.trim() || !newRep.email.trim()) { alert("Please enter name and email."); return; }
    if (!newRep.zone_id) { alert("Zone is required."); return; }
    if (!newRep.supervisor_id && newRep.role !== "vp_smb_sales") { alert("Supervisor is required."); return; }

    const zone = zones.find(z => z.id === newRep.zone_id);
    const avatar = newRep.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

    const { error } = await supabaseBrowser.from("sales_reps").insert({
      name: newRep.name,
      email: newRep.email,
      phone: newRep.phone || null,
      role: newRep.role,
      division_id: zone?.division_id || null,
      zone_id: newRep.zone_id,
      city: newRep.city || null,
      supervisor_id: newRep.supervisor_id || null,
      hire_date: newRep.hire_date,
      status: "active",
      avatar,
      individual_quota: newRep.individual_quota,
    });

    if (error) { alert("Error: " + error.message); return; }
    logAudit({
      action: "create_sales_rep",
      tab: AUDIT_TABS.SALES,
      subTab: "Sales Reps",
      targetType: "sales_rep",
      targetId: newRep.email,
      entityName: newRep.name,
      details: `Created sales rep "${newRep.name}" (${ROLE_LABELS[newRep.role] || newRep.role}) in zone ${zones.find(z => z.id === newRep.zone_id)?.name || newRep.zone_id}`,
    });
    alert(`Sales rep "${newRep.name}" added!`);
    setShowAddRepModal(false);
    setNewRep({ name: "", email: "", phone: "", role: "sales_rep", division_id: "", zone_id: "", city: "", supervisor_id: "", hire_date: new Date().toISOString().slice(0, 10), individual_quota: 60 });
    await fetchData();
  }

  async function handleAddSale() {
    if (!newSale.business_name.trim()) { alert("Please enter a business name."); return; }
    if (newSale.rep_id !== "inbound" && !newSale.rep_id) { alert("Please select a sales rep or choose Inbound."); return; }

    const isInbound = newSale.rep_id === "inbound";
    const rep = salesReps.find(r => r.id === newSale.rep_id);
    const planCommission = newSale.plan === "premium" ? commissionRates.individual.premium_signup : commissionRates.individual.basic_signup;
    const adCommission = Math.floor(newSale.ad_spend / 100) * commissionRates.individual.advertising_per_100;
    const totalCommission = isInbound ? 0 : planCommission + adCommission;
    const poolContribution = isInbound ? (newSale.plan === "premium" ? 200 : 100) + Math.floor(newSale.ad_spend / 100) * 100 : (newSale.plan === "premium" ? 1000 : 500) + Math.floor(newSale.ad_spend / 100) * 500;

    if (isInbound) {
      const { error } = await supabaseBrowser.from("inbound_signups").insert({
        business_name: newSale.business_name,
        plan: newSale.plan,
        ad_spend_cents: newSale.ad_spend * 100,
        pool_contribution_cents: poolContribution,
        city: newSale.city || null,
        state: newSale.state || null,
        signed_at: new Date().toISOString(),
      });
      if (error) { alert("Error: " + error.message); return; }
      logAudit({
        action: "create_inbound_signup",
        tab: AUDIT_TABS.SALES,
        subTab: "Signups",
        targetType: "sales_rep",
        entityName: newSale.business_name,
        details: `Inbound signup for "${newSale.business_name}" (${newSale.plan} plan, ad spend $${(newSale.ad_spend).toFixed(2)})`,
      });
    } else {
      const period = now.getDate() <= 15 ? `${currentYear}-${String(currentMonth).padStart(2, "0")}-P1` : `${currentYear}-${String(currentMonth).padStart(2, "0")}-P2`;
      const { error } = await supabaseBrowser.from("sales_signups").insert({
        rep_id: newSale.rep_id,
        business_name: newSale.business_name,
        plan: newSale.plan,
        commission_cents: totalCommission,
        ad_spend_cents: newSale.ad_spend * 100,
        pool_contribution_cents: poolContribution,
        division_id: rep?.division_id || null,
        zone_id: rep?.zone_id || null,
        city: newSale.city || null,
        state: newSale.state || null,
        signed_at: new Date().toISOString(),
        payout_period: period,
        commission_paid: false,
      });
      if (error) { alert("Error: " + error.message); return; }
      logAudit({
        action: "create_outbound_signup",
        tab: AUDIT_TABS.SALES,
        subTab: "Signups",
        targetType: "sales_rep",
        targetId: newSale.rep_id,
        entityName: newSale.business_name,
        details: `Outbound signup for "${newSale.business_name}" by rep "${rep?.name || newSale.rep_id}" (${newSale.plan} plan, commission ${formatMoney(totalCommission)}, ad spend $${(newSale.ad_spend).toFixed(2)})`,
      });
    }

    alert(`${isInbound ? "Inbound" : "Outbound"} sale added!`);
    setShowAddSaleModal(false);
    setNewSale({ rep_id: "", business_name: "", plan: "basic", ad_spend: 0, notes: "", city: "", state: "" });
    setRepSearchQuery("");
    await fetchData();
  }

  async function handleSaveRates() {
    for (const [key, value] of Object.entries(editRates)) {
      const existing = config.find((c) => c.key === key);
      if (existing) {
        if (existing.value_cents !== null) await supabaseBrowser.from("sales_config").update({ value_cents: value }).eq("id", existing.id);
        else await supabaseBrowser.from("sales_config").update({ value_int: value }).eq("id", existing.id);
      }
    }
    const changedKeys = Object.entries(editRates).map(([key, value]) => `${key}=${value}`).join(", ");
    const oldValues = Object.keys(editRates).map((key) => {
      const existing = config.find((c) => c.key === key);
      const val = existing?.value_cents !== null ? existing?.value_cents : existing?.value_int;
      return `${key}=${val ?? "unknown"}`;
    }).join(", ");
    logAudit({
      action: "update_commission_rates",
      tab: AUDIT_TABS.SALES,
      subTab: "Commission Rates",
      targetType: "sales_config",
      fieldName: "commission_rates",
      oldValue: oldValues,
      newValue: changedKeys,
      details: `Updated commission rates: ${changedKeys}`,
    });
    setShowEditRatesModal(false); setEditRates({}); await fetchData();
    alert("Commission rates saved!");
  }

  async function handleSaveQuota() {
    if (!quotaEditTarget) { alert("Please select a target."); return; }

    const overrides = [];
    const currentQuarter = Math.ceil(currentMonth / 3);

    // Add monthly quota if set
    if (quotaEditValues.monthly > 0) {
      overrides.push({
        target_type: quotaEditTarget.type,
        target_id: quotaEditTarget.id,
        quota: quotaEditValues.monthly,
        period: `${currentYear}-${String(currentMonth).padStart(2, "0")}`,
      });
    }

    // Add quarterly quota if set
    if (quotaEditValues.quarterly > 0) {
      overrides.push({
        target_type: quotaEditTarget.type,
        target_id: quotaEditTarget.id,
        quota: quotaEditValues.quarterly,
        period: `Q${currentQuarter}-${currentYear}`,
      });
    }

    // Add yearly quota if set
    if (quotaEditValues.yearly > 0) {
      overrides.push({
        target_type: quotaEditTarget.type,
        target_id: quotaEditTarget.id,
        quota: quotaEditValues.yearly,
        period: `${currentYear}`,
      });
    }

    if (overrides.length === 0) {
      alert("Please enter at least one quota value.");
      return;
    }

    const { error } = await supabaseBrowser.from("sales_quota_overrides").insert(overrides);

    if (error) { alert("Error: " + error.message); return; }
    logAudit({
      action: "update_quota",
      tab: AUDIT_TABS.SALES,
      subTab: "Quotas",
      targetType: "sales_rep",
      targetId: quotaEditTarget.id,
      entityName: quotaEditTarget.name,
      details: `Set ${overrides.length} quota override(s) for ${quotaEditTarget.type} "${quotaEditTarget.name}" (monthly: ${quotaEditValues.monthly}, quarterly: ${quotaEditValues.quarterly}, yearly: ${quotaEditValues.yearly})`,
    });
    alert(`${overrides.length} quota override(s) saved for ${quotaEditTarget.name}!`);
    setShowEditQuotaModal(false);
    setQuotaEditTarget(null);
    setQuotaEditValues({ monthly: 0, quarterly: 0, yearly: 0 });
    await fetchData();
  }

  async function handleSaveSignupEdit() {
    if (!editingSignup) return;

    // Validation limits
    const MAX_COMMISSION = 1000000; // $10,000 max
    const MIN_AMOUNT = 0; // Must be positive

    if (editingSignup.type === "outbound") {
      const commission = editingSignup.commission_cents || 0;
      if (commission < MIN_AMOUNT) {
        alert("Commission must be a positive amount.");
        return;
      }
      if (commission > MAX_COMMISSION) {
        alert(`Commission cannot exceed $${(MAX_COMMISSION / 100).toFixed(2)}.`);
        return;
      }
    } else {
      const poolContribution = editingSignup.pool_contribution_cents || 0;
      if (poolContribution < MIN_AMOUNT) {
        alert("Pool contribution must be a positive amount.");
        return;
      }
      if (poolContribution > MAX_COMMISSION) {
        alert(`Pool contribution cannot exceed $${(MAX_COMMISSION / 100).toFixed(2)}.`);
        return;
      }
    }

    // Confirmation dialog
    const fieldName = editingSignup.type === "outbound" ? "commission" : "pool contribution";
    const amount = editingSignup.type === "outbound"
      ? formatMoney(editingSignup.commission_cents || 0)
      : formatMoney(editingSignup.pool_contribution_cents || 0);

    const confirmed = window.confirm(`Confirm edit:\n\nUpdate ${fieldName} to ${amount}?\n\nThis will update the signup record.`);
    if (!confirmed) return;

    const table = editingSignup.type === "outbound" ? "sales_signups" : "inbound_signups";
    const updateData: { commission_cents?: number; pool_contribution_cents?: number } = {};

    if (editingSignup.type === "outbound" && editingSignup.commission_cents !== undefined) {
      updateData.commission_cents = editingSignup.commission_cents;
    } else if (editingSignup.type === "inbound" && editingSignup.pool_contribution_cents !== undefined) {
      updateData.pool_contribution_cents = editingSignup.pool_contribution_cents;
    }

    const { error } = await supabaseBrowser.from(table).update(updateData).eq("id", editingSignup.id);

    if (error) {
      alert("Error: " + error.message);
      return;
    }

    // Log the edit to audit trail
    const { error: auditError } = await supabaseBrowser.from("sales_audit_log").insert({
      table_name: table,
      record_id: editingSignup.id,
      action: "update",
      field_changed: editingSignup.type === "outbound" ? "commission_cents" : "pool_contribution_cents",
      new_value: editingSignup.type === "outbound" ? editingSignup.commission_cents : editingSignup.pool_contribution_cents,
      changed_at: new Date().toISOString(),
    });

    // Don't fail if audit log fails, just log it
    if (auditError) console.warn("Audit log failed:", auditError);

    logAudit({
      action: "update_signup",
      tab: AUDIT_TABS.SALES,
      subTab: "Signups",
      targetType: "sales_rep",
      targetId: editingSignup.id,
      fieldName: fieldName,
      newValue: amount,
      details: `Updated ${editingSignup.type} signup ${editingSignup.id}: ${fieldName} set to ${amount}`,
    });

    alert("Signup updated successfully!");
    setShowEditSignupModal(false);
    setEditingSignup(null);
    await fetchData();
  }

  async function handleDeleteSignup(id: string, type: "outbound" | "inbound", businessName: string) {
    const confirmed = window.confirm(`Are you sure you want to delete this signup for "${businessName}"?\n\nThis action cannot be undone.`);

    if (!confirmed) return;

    const table = type === "outbound" ? "sales_signups" : "inbound_signups";
    const { error } = await supabaseBrowser.from(table).delete().eq("id", id);

    if (error) {
      alert("Error: " + error.message);
      return;
    }

    logAudit({
      action: "delete_signup",
      tab: AUDIT_TABS.SALES,
      subTab: "Signups",
      targetType: "sales_rep",
      targetId: id,
      entityName: businessName,
      details: `Deleted ${type} signup for "${businessName}" (id: ${id})`,
    });

    alert("Signup deleted successfully!");
    await fetchData();
  }

  function handleShowBonusDetails(quarter: BonusPool) {
    setSelectedBonusQuarter(quarter);
    setShowBonusDetailsModal(true);
  }

  async function handleMarkBonusPaid(quarter: string) {
    const confirmed = window.confirm(`Mark ${quarter} bonus as paid?\n\nThis will update the status to "paid" in the database.`);
    if (!confirmed) return;

    try {
      // Get the current bonus pool data
      const currentPool = quarter === bonusPool?.quarter ? bonusPool : previousPools.find(p => p.quarter === quarter);

      if (!currentPool) {
        alert(`Error: Cannot find bonus pool data for ${quarter}`);
        return;
      }

      // Use UPSERT to handle both create and update (upsert on conflict with quarter)
      console.log("Upserting bonus pool record for", quarter);
      const { error: upsertError } = await supabaseBrowser
        .from("sales_bonus_pool")
        .upsert({
          quarter: currentPool.quarter,
          quarter_start: currentPool.quarter_start,
          quarter_end: currentPool.quarter_end,
          total_pool_cents: currentPool.total_pool_cents,
          inbound_basic_cents: currentPool.inbound_basic_cents || 0,
          inbound_premium_cents: currentPool.inbound_premium_cents || 0,
          inbound_ads_cents: currentPool.inbound_ads_cents || 0,
          rep_basic_cents: currentPool.rep_basic_cents || 0,
          rep_premium_cents: currentPool.rep_premium_cents || 0,
          rep_ads_cents: currentPool.rep_ads_cents || 0,
          repeat_customers_cents: currentPool.repeat_customers_cents || 0,
          eligible_rep_ids: currentPool.eligible_rep_ids || [],
          projected_per_rep_cents: currentPool.projected_per_rep_cents,
          status: "paid",
          paid_at: new Date().toISOString()
        }, {
          onConflict: "quarter"
        });

      if (upsertError) {
        console.error("Upsert error:", upsertError);
        alert("Error saving bonus pool: " + upsertError.message);
        return;
      }

      console.log("Successfully marked", quarter, "as paid");
      logAudit({
        action: "mark_bonus_paid",
        tab: AUDIT_TABS.SALES,
        subTab: "Bonus Pool",
        targetType: "sales_config",
        targetId: quarter,
        entityName: quarter,
        fieldName: "status",
        oldValue: "unpaid",
        newValue: "paid",
        details: `Marked ${quarter} bonus pool as paid (total: ${formatMoney(currentPool.total_pool_cents)}, ${currentPool.eligible_rep_ids?.length || 0} eligible reps)`,
      });
      alert(`${quarter} bonus marked as paid!`);
      await fetchData();
    } catch (err) {
      console.error("Unexpected error:", err);
      alert("Unexpected error: " + String(err));
    }
  }

  async function handleUndoBonusPayout(quarter: string) {
    const confirmed = window.confirm(`Are you sure you want to undo the payout for ${quarter}?\n\nThis will mark the quarter as active again.`);
    if (!confirmed) return;

    // Update the bonus pool status back to active
    const { error } = await supabaseBrowser.from("sales_bonus_pool").update({ status: "active", paid_at: null }).eq("quarter", quarter);

    if (error) {
      alert("Error: " + error.message);
      return;
    }

    logAudit({
      action: "undo_bonus_payout",
      tab: AUDIT_TABS.SALES,
      subTab: "Bonus Pool",
      targetType: "sales_config",
      targetId: quarter,
      entityName: quarter,
      fieldName: "status",
      oldValue: "paid",
      newValue: "active",
      details: `Undid bonus payout for ${quarter} — status reverted to active`,
    });

    // Remove from paid quarters list
    setPaidBonusQuarters(paidBonusQuarters.filter(q => q !== quarter));
    alert(`${quarter} bonus payout has been undone!`);
    await fetchData();
  }

  function exportGeographicSummaryToCSV() {
    let data: Array<Record<string, string | number>> = [];

    if (geoSummaryView === "division") {
      data = divisions.map(d => {
        const divSignups = filteredSignups.filter(s => s.division_id === d.id);
        return {
          "Division": d.name,
          "Active Reps": salesReps.filter(r => r.division_id === d.id && r.status === "active").length,
          "Total Signups": divSignups.length,
          "Basic Signups": divSignups.filter(s => s.plan === "basic").length,
          "Premium Signups": divSignups.filter(s => s.plan === "premium").length,
          "Total Revenue": ((divSignups.reduce((sum, s) => sum + (s.commission_cents || 0) + (s.ad_spend_cents || 0), 0)) / 100).toFixed(2),
          "Commission": ((divSignups.reduce((sum, s) => sum + (s.commission_cents || 0), 0)) / 100).toFixed(2),
          "Ad Spend": ((divSignups.reduce((sum, s) => sum + (s.ad_spend_cents || 0), 0)) / 100).toFixed(2),
        };
      });
    } else if (geoSummaryView === "zone") {
      data = zones.map(z => {
        const zoneSignups = filteredSignups.filter(s => s.zone_id === z.id);
        const divName = divisions.find(d => d.id === z.division_id)?.name || "—";
        return {
          "Zone": z.name,
          "Division": divName,
          "Active Reps": salesReps.filter(r => r.zone_id === z.id && r.status === "active").length,
          "Total Signups": zoneSignups.length,
          "Basic Signups": zoneSignups.filter(s => s.plan === "basic").length,
          "Premium Signups": zoneSignups.filter(s => s.plan === "premium").length,
          "Total Revenue": ((zoneSignups.reduce((sum, s) => sum + (s.commission_cents || 0) + (s.ad_spend_cents || 0), 0)) / 100).toFixed(2),
          "Commission": ((zoneSignups.reduce((sum, s) => sum + (s.commission_cents || 0), 0)) / 100).toFixed(2),
          "Ad Spend": ((zoneSignups.reduce((sum, s) => sum + (s.ad_spend_cents || 0), 0)) / 100).toFixed(2),
        };
      });
    } else if (geoSummaryView === "state") {
      const stateData: Record<string, { signupCount: number; basicCount: number; premiumCount: number; totalRevenue: number; totalCommission: number; totalAdSpend: number }> = {};
      filteredSignups.forEach(s => {
        if (s.state) {
          if (!stateData[s.state]) stateData[s.state] = { signupCount: 0, basicCount: 0, premiumCount: 0, totalRevenue: 0, totalCommission: 0, totalAdSpend: 0 };
          stateData[s.state].signupCount++;
          if (s.plan === "basic") stateData[s.state].basicCount++;
          if (s.plan === "premium") stateData[s.state].premiumCount++;
          stateData[s.state].totalRevenue += (s.commission_cents || 0) + (s.ad_spend_cents || 0);
          stateData[s.state].totalCommission += (s.commission_cents || 0);
          stateData[s.state].totalAdSpend += (s.ad_spend_cents || 0);
        }
      });
      data = Object.entries(stateData).map(([state, stats]) => ({
        "State": state,
        "Total Signups": stats.signupCount,
        "Basic Signups": stats.basicCount,
        "Premium Signups": stats.premiumCount,
        "Total Revenue": (stats.totalRevenue / 100).toFixed(2),
        "Commission": (stats.totalCommission / 100).toFixed(2),
        "Ad Spend": (stats.totalAdSpend / 100).toFixed(2),
      }));
    } else if (geoSummaryView === "city") {
      const cityData: Record<string, { state: string; signupCount: number; basicCount: number; premiumCount: number; totalRevenue: number; totalCommission: number; totalAdSpend: number }> = {};
      filteredSignups.forEach(s => {
        if (s.city) {
          const key = `${s.city}, ${s.state || "?"}`;
          if (!cityData[key]) cityData[key] = { state: s.state || "?", signupCount: 0, basicCount: 0, premiumCount: 0, totalRevenue: 0, totalCommission: 0, totalAdSpend: 0 };
          cityData[key].signupCount++;
          if (s.plan === "basic") cityData[key].basicCount++;
          if (s.plan === "premium") cityData[key].premiumCount++;
          cityData[key].totalRevenue += (s.commission_cents || 0) + (s.ad_spend_cents || 0);
          cityData[key].totalCommission += (s.commission_cents || 0);
          cityData[key].totalAdSpend += (s.ad_spend_cents || 0);
        }
      });
      data = Object.entries(cityData).map(([city, stats]) => ({
        "City": city,
        "Total Signups": stats.signupCount,
        "Basic Signups": stats.basicCount,
        "Premium Signups": stats.premiumCount,
        "Total Revenue": (stats.totalRevenue / 100).toFixed(2),
        "Commission": (stats.totalCommission / 100).toFixed(2),
        "Ad Spend": (stats.totalAdSpend / 100).toFixed(2),
      }));
    }

    if (data.length === 0) {
      alert("No data to export");
      return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(","),
      ...data.map(row => headers.map(header => {
        const value = (row as Record<string, string | number>)[header];
        if (typeof value === "string" && (value.includes(",") || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `geographic_summary_${geoSummaryView}_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function exportPayoutsToCSV() {
    const data: Array<Record<string, string | number>> = [];

    actualSalesReps.forEach(rep => {
      const repP1 = period1Signups.filter(s => s.rep_id === rep.id);
      const repP2 = period2Signups.filter(s => s.rep_id === rep.id);

      if (repP1.length > 0 || repP2.length > 0) {
        const p1Total = repP1.reduce((sum, s) => sum + (s.commission_cents || 0), 0);
        const p2Total = repP2.reduce((sum, s) => sum + (s.commission_cents || 0), 0);
        const p1Paid = paidCommissions[rep.id]?.period1 ? "Yes" : "No";
        const p2Paid = paidCommissions[rep.id]?.period2 ? "Yes" : "No";

        data.push({
          "Rep Name": rep.name,
          "Email": rep.email,
          "Zone": getZoneName(rep.zone_id),
          "Period 1 Signups": repP1.length,
          "Period 1 Commission": (p1Total / 100).toFixed(2),
          "Period 1 Paid": p1Paid,
          "Period 2 Signups": repP2.length,
          "Period 2 Commission": (p2Total / 100).toFixed(2),
          "Period 2 Paid": p2Paid,
          "Total Commission": ((p1Total + p2Total) / 100).toFixed(2),
        });
      }
    });

    if (data.length === 0) {
      alert("No payout data to export");
      return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(","),
      ...data.map(row => headers.map(header => {
        const value = (row as Record<string, string | number>)[header];
        if (typeof value === "string" && (value.includes(",") || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `payouts_${currentMonthName}_${currentYear}_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function exportRepPerformanceToCSV() {
    const data = actualSalesReps.map(rep => {
      const perf = getRepPerformance(rep.id);
      return {
        "Rep Name": rep.name,
        "Email": rep.email,
        "Role": ROLE_LABELS[rep.role] || rep.role,
        "Zone": getZoneName(rep.zone_id),
        "Division": getDivisionName(rep.division_id),
        "City": rep.city || "—",
        "Total Signups": perf.total,
        "Basic Signups": perf.basic,
        "Premium Signups": perf.premium,
        "Total Commission": (perf.commission / 100).toFixed(2),
        "Ad Spend Sold": (perf.adSpend / 100).toFixed(2),
        "Status": rep.status,
        "Hire Date": rep.hire_date || "—",
      };
    });

    if (data.length === 0) {
      alert("No rep performance data to export");
      return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(","),
      ...data.map(row => headers.map(header => {
        const value = (row as Record<string, string | number>)[header];
        if (typeof value === "string" && (value.includes(",") || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `rep_performance_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function exportSignupsToCSV() {
    const outboundData = filteredSignupsForTab.map(s => ({
      "Type": "Outbound",
      "Business Name": s.business_name || "",
      "Sales Rep": salesReps.find(r => r.id === s.rep_id)?.name || "",
      "Zone": getZoneName(s.zone_id),
      "Plan": s.plan,
      "Commission": ((s.commission_cents || 0) / 100).toFixed(2),
      "Ad Spend": ((s.ad_spend_cents || 0) / 100).toFixed(2),
      "Pool Contribution": ((s.pool_contribution_cents || 0) / 100).toFixed(2),
      "Date": formatDate(s.signed_at),
      "City": s.city || "",
      "State": s.state || "",
    }));

    const inboundData = filteredInboundForTab.map(s => ({
      "Type": "Inbound",
      "Business Name": s.business_name || "",
      "Sales Rep": "",
      "Zone": "",
      "Plan": s.plan,
      "Commission": "0.00",
      "Ad Spend": ((s.ad_spend_cents || 0) / 100).toFixed(2),
      "Pool Contribution": ((s.pool_contribution_cents || 0) / 100).toFixed(2),
      "Date": formatDate(s.signed_at),
      "City": "",
      "State": "",
    }));

    const allData = [...outboundData, ...inboundData];

    if (allData.length === 0) {
      alert("No signups to export");
      return;
    }

    // Create CSV content
    const headers = Object.keys(allData[0]);
    const csvContent = [
      headers.join(","),
      ...allData.map(row => headers.map(header => {
        const value = row[header as keyof typeof row];
        // Escape values that contain commas or quotes
        if (typeof value === "string" && (value.includes(",") || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(","))
    ].join("\n");

    // Download the file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `signups_export_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const filteredRepsForSearch = actualSalesReps.filter(r => r.name.toLowerCase().includes(repSearchQuery.toLowerCase()) || r.email.toLowerCase().includes(repSearchQuery.toLowerCase()));

  // Export data for CSV/XLSX
  const exportHeaders = ["Business", "Rep", "Plan", "Commission", "Ad Spend", "Zone", "State", "Date"];
  const exportRows = filteredSignups.map((s) => [
    s.business_name || "",
    salesReps.find((r) => r.id === s.rep_id)?.name || "",
    s.plan,
    ((s.commission_cents || 0) / 100).toFixed(2),
    ((s.ad_spend_cents || 0) / 100).toFixed(2),
    getZoneName(s.zone_id),
    s.state || "",
    s.signed_at
  ]);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 32, background: COLORS.darkBg, minHeight: "calc(100vh - 60px)" }}>
      {/* ADD SALE MODAL */}
      {showAddSaleModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1001 }} onClick={() => setShowAddSaleModal(false)}>
          <div style={{ background: COLORS.cardBg, borderRadius: 20, padding: 32, width: 520, maxWidth: "90%", maxHeight: "90vh", overflowY: "auto", border: "1px solid " + COLORS.cardBorder }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>+ Add Sale</h2>
            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase", fontWeight: 600 }}>Sale Type</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <button onClick={() => setNewSale({ ...newSale, rep_id: "" })} style={{ padding: 14, background: newSale.rep_id !== "inbound" ? COLORS.gradient1 : COLORS.darkBg, border: newSale.rep_id !== "inbound" ? "none" : "1px solid " + COLORS.cardBorder, borderRadius: 10, color: newSale.rep_id !== "inbound" ? "#fff" : COLORS.textSecondary, cursor: "pointer", fontWeight: 600 }}>📤 Outbound (Rep Sale)</button>
                  <button onClick={() => setNewSale({ ...newSale, rep_id: "inbound" })} style={{ padding: 14, background: newSale.rep_id === "inbound" ? COLORS.gradient2 : COLORS.darkBg, border: newSale.rep_id === "inbound" ? "none" : "1px solid " + COLORS.cardBorder, borderRadius: 10, color: newSale.rep_id === "inbound" ? "#000" : COLORS.textSecondary, cursor: "pointer", fontWeight: 600 }}>📥 Inbound (Pool Only)</button>
                </div>
              </div>
              {newSale.rep_id !== "inbound" && (
                <div>
                  <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase", fontWeight: 600 }}>Sales Rep</label>
                  <input type="text" placeholder="Search reps..." value={repSearchQuery} onChange={(e) => setRepSearchQuery(e.target.value)} style={{ width: "100%", padding: 12, marginBottom: 8, background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, fontSize: 13 }} />
                  <select value={newSale.rep_id} onChange={(e) => setNewSale({ ...newSale, rep_id: e.target.value })} style={{ width: "100%", padding: 14, background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, fontSize: 14 }}>
                    <option value="">Select rep...</option>
                    {filteredRepsForSearch.map((r) => <option key={r.id} value={r.id}>{r.name} ({getZoneName(r.zone_id)})</option>)}
                  </select>
                </div>
              )}
              {newSale.rep_id === "inbound" && (
                <div style={{ padding: 12, background: "rgba(57,255,20,0.1)", borderRadius: 10, border: "1px solid " + COLORS.neonGreen }}>
                  <div style={{ fontSize: 12, color: COLORS.neonGreen, fontWeight: 600 }}>📥 Inbound Sale</div>
                  <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 4 }}>No individual commission. Contributes to team bonus pool only.</div>
                </div>
              )}
              <div>
                <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase", fontWeight: 600 }}>Business Name</label>
                <input type="text" value={newSale.business_name} onChange={(e) => setNewSale({ ...newSale, business_name: e.target.value })} placeholder="Enter business name" style={{ width: "100%", padding: 14, background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, fontSize: 14 }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase", fontWeight: 600 }}>Plan Type</label>
                  <select value={newSale.plan} onChange={(e) => setNewSale({ ...newSale, plan: e.target.value })} style={{ width: "100%", padding: 14, background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, fontSize: 14 }}>
                    <option value="basic">Basic</option>
                    <option value="premium">Premium</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase", fontWeight: 600 }}>Ad Spend Sold</label>
                  <input type="number" value={newSale.ad_spend} onChange={(e) => setNewSale({ ...newSale, ad_spend: parseInt(e.target.value) || 0 })} placeholder="0" style={{ width: "100%", padding: 14, background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, fontSize: 14 }} />
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase", fontWeight: 600 }}>Notes (optional)</label>
                <textarea value={newSale.notes} onChange={(e) => setNewSale({ ...newSale, notes: e.target.value })} placeholder="Any additional notes..." rows={2} style={{ width: "100%", padding: 14, background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, fontSize: 14, resize: "vertical" }} />
              </div>
              <div style={{ padding: 16, background: COLORS.darkBg, borderRadius: 12 }}>
                {newSale.rep_id === "inbound" ? (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: COLORS.neonPurple }}>🏆 Pool Contribution Preview</div>
                    <div style={{ display: "grid", gap: 4, fontSize: 13 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}><span>Plan ({newSale.plan}) - Commission</span><span style={{ color: COLORS.neonPurple }}>+${newSale.plan === "premium" ? 2 : 1}</span></div>
                      {newSale.ad_spend > 0 && <div style={{ display: "flex", justifyContent: "space-between" }}><span>Ad Spend (${newSale.ad_spend})</span><span style={{ color: COLORS.neonPurple }}>+${Math.floor(newSale.ad_spend / 100)}</span></div>}
                      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, borderTop: "1px solid " + COLORS.cardBorder, paddingTop: 8, marginTop: 4 }}><span>Total to Bonus Pool</span><span style={{ color: COLORS.neonPurple }}>+${(newSale.plan === "premium" ? 2 : 1) + Math.floor(newSale.ad_spend / 100)}</span></div>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: COLORS.neonGreen }}>💰 Commission & Pool Preview</div>
                    <div style={{ display: "grid", gap: 4, fontSize: 13 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}><span>Plan ({newSale.plan}) - Commission</span><span style={{ color: COLORS.neonGreen }}>+${newSale.plan === "premium" ? 100 : 25}</span></div>
                      {newSale.ad_spend > 0 && <div style={{ display: "flex", justifyContent: "space-between" }}><span>Ad Spend (${newSale.ad_spend}) - Commission</span><span style={{ color: COLORS.neonGreen }}>+${Math.floor(newSale.ad_spend / 100) * 10}</span></div>}
                      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, borderTop: "1px solid " + COLORS.cardBorder, paddingTop: 8, marginTop: 4 }}><span>Total Commission</span><span style={{ color: COLORS.neonGreen }}>${(newSale.plan === "premium" ? 100 : 25) + Math.floor(newSale.ad_spend / 100) * 10}</span></div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTop: "1px dashed " + COLORS.cardBorder }}><span style={{ color: COLORS.textSecondary }}>Pool Contribution</span><span style={{ color: COLORS.neonPurple }}>+${(newSale.plan === "premium" ? 10 : 5) + Math.floor(newSale.ad_spend / 100) * 5}</span></div>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 24 }}>
              <button onClick={() => { setShowAddSaleModal(false); setRepSearchQuery(""); }} style={{ padding: "12px 24px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, cursor: "pointer", fontWeight: 600 }}>Cancel</button>
              <button onClick={handleAddSale} style={{ padding: "12px 24px", background: newSale.rep_id === "inbound" ? COLORS.gradient2 : COLORS.gradient1, border: "none", borderRadius: 10, color: newSale.rep_id === "inbound" ? "#000" : "#fff", cursor: "pointer", fontWeight: 700 }}>{newSale.rep_id === "inbound" ? "Add Inbound Sale" : "Add Sale"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD REP MODAL - EXPANDED */}
      {showAddRepModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setShowAddRepModal(false)}>
          <div style={{ background: COLORS.cardBg, borderRadius: 20, padding: 32, maxWidth: 600, width: "90%", maxHeight: "90vh", overflowY: "auto", border: "1px solid " + COLORS.cardBorder }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>+ Add Sales Team Member</h2>
            <div style={{ display: "grid", gap: 16 }}>
              {/* Basic Info */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, textTransform: "uppercase", fontWeight: 600 }}>Name *</label>
                  <input value={newRep.name} onChange={(e) => setNewRep({ ...newRep, name: e.target.value })} placeholder="Full name" style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, textTransform: "uppercase", fontWeight: 600 }}>Email *</label>
                  <input value={newRep.email} onChange={(e) => setNewRep({ ...newRep, email: e.target.value })} placeholder="email@company.com" style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary }} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, textTransform: "uppercase", fontWeight: 600 }}>Phone</label>
                  <input value={newRep.phone} onChange={(e) => setNewRep({ ...newRep, phone: e.target.value })} placeholder="555-555-5555" style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, textTransform: "uppercase", fontWeight: 600 }}>Hire Date</label>
                  <input type="date" value={newRep.hire_date} onChange={(e) => setNewRep({ ...newRep, hire_date: e.target.value })} style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary }} />
                </div>
              </div>

              {/* Role */}
              <div>
                <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, textTransform: "uppercase", fontWeight: 600 }}>Role *</label>
                <select value={newRep.role} onChange={(e) => setNewRep({ ...newRep, role: e.target.value, supervisor_id: "" })} style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary }}>
                  {ROLE_HIERARCHY.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>

              {/* Zone (Required) */}
              <div>
                <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, textTransform: "uppercase", fontWeight: 600 }}>Zone * (8 US Regions)</label>
                <select value={newRep.zone_id} onChange={(e) => { const z = zones.find(zn => zn.id === e.target.value); setNewRep({ ...newRep, zone_id: e.target.value, division_id: z?.division_id || "" }); }} style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary }}>
                  <option value="">Select zone...</option>
                  {divisions.map(d => (
                    <optgroup key={d.id} label={`${d.name} Division`}>
                      {zones.filter(z => z.division_id === d.id).map(z => <option key={z.id} value={z.id}>{z.name} ({z.states.join(", ")})</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* City */}
              <div>
                <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, textTransform: "uppercase", fontWeight: 600 }}>City</label>
                <input value={newRep.city} onChange={(e) => setNewRep({ ...newRep, city: e.target.value })} placeholder="City name" style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary }} />
              </div>

              {/* Supervisor (Required except for VP) */}
              {newRep.role !== "vp_smb_sales" && (
                <div>
                  <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, textTransform: "uppercase", fontWeight: 600 }}>Supervisor * (Reports To)</label>
                  <select value={newRep.supervisor_id} onChange={(e) => setNewRep({ ...newRep, supervisor_id: e.target.value })} style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary }}>
                    <option value="">Select supervisor...</option>
                    {getSupervisorOptions(newRep.role).map(s => <option key={s.id} value={s.id}>{s.name} ({ROLE_LABELS[s.role]})</option>)}
                  </select>
                </div>
              )}

              {/* Individual Quota */}
              <div>
                <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, textTransform: "uppercase", fontWeight: 600 }}>Individual Monthly Quota</label>
                <input type="number" value={newRep.individual_quota} onChange={(e) => setNewRep({ ...newRep, individual_quota: parseInt(e.target.value) || 60 })} style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary }} />
                <div style={{ fontSize: 10, color: COLORS.textSecondary, marginTop: 4 }}>Default is {commissionRates.quotas.individual_monthly}</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 24 }}>
              <button onClick={() => setShowAddRepModal(false)} style={{ padding: "12px 24px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleAddRep} style={{ padding: "12px 24px", background: COLORS.gradient1, border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontWeight: 700 }}>Add Team Member</button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT RATES MODAL */}
      {showEditRatesModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setShowEditRatesModal(false)}>
          <div style={{ background: COLORS.cardBg, borderRadius: 20, padding: 32, maxWidth: 500, width: "90%", border: "1px solid " + COLORS.cardBorder }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Edit Commission Rates</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ padding: 16, background: COLORS.darkBg, borderRadius: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.neonGreen, marginBottom: 12 }}>Individual Commissions</div>
                {[{ key: "basic_signup", label: "Basic Signup" }, { key: "premium_signup", label: "Premium Signup" }, { key: "advertising_per_100", label: "Ad Spend (per $100)" }].map((item) => (
                  <div key={item.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span>{item.label}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}><span>$</span><input type="number" value={(editRates[item.key] ?? getConfig(item.key)) / 100} onChange={(e) => setEditRates({ ...editRates, [item.key]: Math.round(parseFloat(e.target.value) * 100) || 0 })} style={{ width: 80, padding: 8, borderRadius: 6, border: "1px solid " + COLORS.cardBorder, background: COLORS.cardBg, color: COLORS.neonGreen, textAlign: "right" }} /></div>
                  </div>
                ))}
              </div>
              <div style={{ padding: 16, background: COLORS.darkBg, borderRadius: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.neonPurple, marginBottom: 12 }}>Default Quotas</div>
                {[{ key: "individual_monthly", label: "Individual Monthly" }, { key: "bonus_eligibility", label: "Bonus Eligibility" }, { key: "team_monthly", label: "Team Monthly" }].map((item) => (
                  <div key={item.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span>{item.label}</span>
                    <input type="number" value={editRates[item.key] ?? getConfig(item.key, "int")} onChange={(e) => setEditRates({ ...editRates, [item.key]: parseInt(e.target.value) || 0 })} style={{ width: 80, padding: 8, borderRadius: 6, border: "1px solid " + COLORS.cardBorder, background: COLORS.cardBg, color: COLORS.textPrimary, textAlign: "right" }} />
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => { setShowEditRatesModal(false); setEditRates({}); }} style={{ padding: "12px 24px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleSaveRates} style={{ padding: "12px 24px", background: COLORS.gradient1, border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontWeight: 700 }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT QUOTA MODAL - Individual/Team/Zone */}
      {showEditQuotaModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setShowEditQuotaModal(false)}>
          <div style={{ background: COLORS.cardBg, borderRadius: 20, padding: 32, maxWidth: 500, width: "90%", border: "1px solid " + COLORS.cardBorder }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Set Quota Override</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Target Type */}
              <div>
                <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, textTransform: "uppercase", fontWeight: 600 }}>Target Type</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                  {["individual", "team", "zone", "division"].map(t => (
                    <button key={t} onClick={() => setQuotaEditTarget(null)} style={{ padding: 10, background: quotaEditTarget?.type === t ? COLORS.gradient1 : COLORS.darkBg, border: quotaEditTarget?.type === t ? "none" : "1px solid " + COLORS.cardBorder, borderRadius: 8, color: quotaEditTarget?.type === t ? "#fff" : COLORS.textSecondary, cursor: "pointer", fontSize: 11, textTransform: "capitalize" }}>{t}</button>
                  ))}
                </div>
              </div>

              {/* Target Selection */}
              <div>
                <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, textTransform: "uppercase", fontWeight: 600 }}>Select Target</label>
                <select value={quotaEditTarget?.id || ""} onChange={(e) => {
                  const val = e.target.value;
                  if (!val) { setQuotaEditTarget(null); return; }
                  // Determine what was selected
                  const rep = salesReps.find(r => r.id === val);
                  const zone = zones.find(z => z.id === val);
                  const div = divisions.find(d => d.id === val);
                  if (rep) setQuotaEditTarget({ type: rep.role === "team_lead" ? "team" : "individual", id: rep.id, name: rep.name });
                  else if (zone) setQuotaEditTarget({ type: "zone", id: zone.id, name: zone.name });
                  else if (div) setQuotaEditTarget({ type: "division", id: div.id, name: div.name });
                }} style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary }}>
                  <option value="">Select...</option>
                  <optgroup label="Sales Reps">
                    {actualSalesReps.map(r => <option key={r.id} value={r.id}>{r.name} (Individual)</option>)}
                  </optgroup>
                  <optgroup label="Team Leads">
                    {salesReps.filter(r => r.role === "team_lead").map(r => <option key={r.id} value={r.id}>{r.name} (Team)</option>)}
                  </optgroup>
                  <optgroup label="Zones">
                    {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                  </optgroup>
                  <optgroup label="Divisions">
                    {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </optgroup>
                </select>
              </div>

              {/* Quota Values - All Periods */}
              <div style={{ padding: 16, background: COLORS.darkBg, borderRadius: 12 }}>
                <div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 12, fontWeight: 600 }}>SET QUOTAS (enter values for desired periods)</div>

                {/* Monthly */}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, textTransform: "uppercase", fontWeight: 600 }}>
                    📅 Monthly Quota ({currentMonthName} {currentYear})
                  </label>
                  <input
                    type="number"
                    value={quotaEditValues.monthly || ""}
                    onChange={(e) => setQuotaEditValues({ ...quotaEditValues, monthly: parseInt(e.target.value) || 0 })}
                    placeholder="Leave 0 to skip"
                    style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.cardBg, color: COLORS.textPrimary }}
                  />
                </div>

                {/* Quarterly */}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, textTransform: "uppercase", fontWeight: 600 }}>
                    📊 Quarterly Quota (Q{Math.ceil(currentMonth / 3)} {currentYear})
                  </label>
                  <input
                    type="number"
                    value={quotaEditValues.quarterly || ""}
                    onChange={(e) => setQuotaEditValues({ ...quotaEditValues, quarterly: parseInt(e.target.value) || 0 })}
                    placeholder="Leave 0 to skip"
                    style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.cardBg, color: COLORS.textPrimary }}
                  />
                </div>

                {/* Yearly */}
                <div>
                  <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, textTransform: "uppercase", fontWeight: 600 }}>
                    📈 Yearly Quota ({currentYear})
                  </label>
                  <input
                    type="number"
                    value={quotaEditValues.yearly || ""}
                    onChange={(e) => setQuotaEditValues({ ...quotaEditValues, yearly: parseInt(e.target.value) || 0 })}
                    placeholder="Leave 0 to skip"
                    style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.cardBg, color: COLORS.textPrimary }}
                  />
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => setShowEditQuotaModal(false)} style={{ padding: "12px 24px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleSaveQuota} style={{ padding: "12px 24px", background: COLORS.gradient1, border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontWeight: 700 }}>Save Override</button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT SIGNUP MODAL */}
      {showEditSignupModal && editingSignup && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setShowEditSignupModal(false)}>
          <div style={{ background: COLORS.cardBg, borderRadius: 20, padding: 32, maxWidth: 500, width: "90%", border: "1px solid " + COLORS.cardBorder }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Edit Signup</h2>

            <div style={{ marginBottom: 20, padding: 12, background: COLORS.darkBg, borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 4 }}>Type</div>
              <div style={{ fontSize: 14, fontWeight: 600, textTransform: "capitalize" }}>{editingSignup.type} Signup</div>
            </div>

            {editingSignup.type === "outbound" ? (
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, textTransform: "uppercase", fontWeight: 600 }}>
                  Commission Amount ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={(editingSignup.commission_cents || 0) / 100}
                  onChange={(e) => setEditingSignup({ ...editingSignup, commission_cents: Math.round(parseFloat(e.target.value || "0") * 100) })}
                  style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 16 }}
                />
                <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 6 }}>
                  This is the commission paid to the sales rep
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, textTransform: "uppercase", fontWeight: 600 }}>
                  Pool Contribution Amount ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={(editingSignup.pool_contribution_cents || 0) / 100}
                  onChange={(e) => setEditingSignup({ ...editingSignup, pool_contribution_cents: Math.round(parseFloat(e.target.value || "0") * 100) })}
                  style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 16 }}
                />
                <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 6 }}>
                  This goes into the quarterly bonus pool
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  setShowEditSignupModal(false);
                  setEditingSignup(null);
                }}
                style={{ padding: "12px 24px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSignupEdit}
                style={{ padding: "12px 24px", background: COLORS.gradient1, border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontWeight: 700 }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SELECTED REP MODAL */}
      {selectedRep && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1001 }} onClick={() => setSelectedRep(null)}>
          <div style={{ background: COLORS.cardBg, borderRadius: 20, padding: 32, width: 700, maxWidth: "90%", maxHeight: "90vh", overflowY: "auto", border: "1px solid " + COLORS.cardBorder }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <Avatar name={selectedRep.name} initials={selectedRep.avatar} />
                <div><h2 style={{ fontSize: 24, fontWeight: 700 }}>{selectedRep.name}</h2><div style={{ color: COLORS.textSecondary, fontSize: 13 }}>{selectedRep.email} • {ROLE_LABELS[selectedRep.role]}</div></div>
              </div>
              <button onClick={() => setSelectedRep(null)} style={{ background: "none", border: "none", color: COLORS.textSecondary, fontSize: 24, cursor: "pointer" }}>×</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 16 }}>
              <div style={{ padding: 12, background: COLORS.darkBg, borderRadius: 10 }}><div style={{ fontSize: 11, color: COLORS.textSecondary }}>Zone</div><div style={{ fontWeight: 600 }}>{getZoneName(selectedRep.zone_id)}</div></div>
              <div style={{ padding: 12, background: COLORS.darkBg, borderRadius: 10 }}><div style={{ fontSize: 11, color: COLORS.textSecondary }}>Division</div><div style={{ fontWeight: 600 }}>{getDivisionName(selectedRep.division_id)}</div></div>
              <div style={{ padding: 12, background: COLORS.darkBg, borderRadius: 10 }}><div style={{ fontSize: 11, color: COLORS.textSecondary }}>Supervisor</div><div style={{ fontWeight: 600 }}>{getSupervisorName(selectedRep.supervisor_id)}</div></div>
              <div style={{ padding: 12, background: COLORS.darkBg, borderRadius: 10 }}><div style={{ fontSize: 11, color: COLORS.textSecondary }}>City</div><div style={{ fontWeight: 600 }}>{selectedRep.city || "—"}</div></div>
            </div>
            {(() => {
              const perf = getRepPerformance(selectedRep.id);
              const repSignups = signups.filter((s) => s.rep_id === selectedRep.id).slice(0, 5);
              return (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
                    <div style={{ padding: 16, background: COLORS.darkBg, borderRadius: 12, textAlign: "center" }}><div style={{ fontSize: 11, color: COLORS.textSecondary }}>Signups</div><div style={{ fontSize: 28, fontWeight: 800, color: COLORS.neonBlue }}>{perf.total}</div></div>
                    <div style={{ padding: 16, background: COLORS.darkBg, borderRadius: 12, textAlign: "center" }}><div style={{ fontSize: 11, color: COLORS.textSecondary }}>Commission</div><div style={{ fontSize: 28, fontWeight: 800, color: COLORS.neonGreen }}>{formatMoney(perf.commission)}</div></div>
                    <div style={{ padding: 16, background: COLORS.darkBg, borderRadius: 12, textAlign: "center" }}><div style={{ fontSize: 11, color: COLORS.textSecondary }}>Ad Sales</div><div style={{ fontSize: 28, fontWeight: 800, color: COLORS.neonOrange }}>{formatMoney(perf.adSpend)}</div></div>
                    <div style={{ padding: 16, background: COLORS.darkBg, borderRadius: 12, textAlign: "center" }}><div style={{ fontSize: 11, color: COLORS.textSecondary }}>Bonus</div><div style={{ fontSize: 18, fontWeight: 800, color: perf.total >= commissionRates.quotas.bonus_eligibility ? COLORS.neonGreen : COLORS.neonOrange }}>{perf.total >= commissionRates.quotas.bonus_eligibility ? "Eligible" : `Need ${commissionRates.quotas.bonus_eligibility - perf.total}`}</div></div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Recent Signups</div>
                  {repSignups.length === 0 ? <div style={{ color: COLORS.textSecondary, padding: 20, textAlign: "center" }}>No signups yet</div> : repSignups.map((s) => (
                    <div key={s.id} style={{ display: "flex", justifyContent: "space-between", padding: 12, background: COLORS.darkBg, borderRadius: 8, marginBottom: 8 }}>
                      <div><div style={{ fontWeight: 600 }}>{s.business_name}</div><div style={{ fontSize: 11, color: COLORS.textSecondary }}>{formatDate(s.signed_at)}</div></div>
                      <div style={{ textAlign: "right" }}><Badge status={s.plan} /><div style={{ fontSize: 12, color: COLORS.neonGreen, marginTop: 4 }}>+{formatMoney(s.commission_cents)}</div></div>
                    </div>
                  ))}
                </>
              );
            })()}
            <button onClick={() => setSelectedRep(null)} style={{ marginTop: 16, padding: "12px 24px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, cursor: "pointer" }}>Close</button>
          </div>
        </div>
      )}

      {/* BONUS DETAILS MODAL */}
      {showBonusDetailsModal && selectedBonusQuarter && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1001 }} onClick={() => setShowBonusDetailsModal(false)}>
          <div style={{ background: COLORS.cardBg, borderRadius: 20, padding: 32, width: 800, maxWidth: "90%", maxHeight: "90vh", overflowY: "auto", border: "1px solid " + COLORS.cardBorder }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h2 style={{ fontSize: 24, fontWeight: 700 }}>🏆 {selectedBonusQuarter.quarter} Bonus Details</h2>
              <button onClick={() => setShowBonusDetailsModal(false)} style={{ background: "none", border: "none", color: COLORS.textSecondary, fontSize: 24, cursor: "pointer" }}>×</button>
            </div>

            {/* Pool Summary */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
              <div style={{ padding: 16, background: COLORS.darkBg, borderRadius: 12, textAlign: "center" }}>
                <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 6 }}>Total Pool</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: COLORS.neonPurple }}>{formatMoney(selectedBonusQuarter.total_pool_cents)}</div>
              </div>
              <div style={{ padding: 16, background: COLORS.darkBg, borderRadius: 12, textAlign: "center" }}>
                <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 6 }}>Eligible Reps</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: COLORS.neonBlue }}>{selectedBonusQuarter.eligible_rep_ids?.length || 0}</div>
              </div>
              <div style={{ padding: 16, background: COLORS.darkBg, borderRadius: 12, textAlign: "center" }}>
                <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 6 }}>Per Rep Payout</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: COLORS.neonGreen }}>{formatMoney(selectedBonusQuarter.projected_per_rep_cents)}</div>
              </div>
            </div>

            {/* Pool Breakdown */}
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Pool Composition</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
                <div style={{ padding: 12, background: COLORS.darkBg, borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 4 }}>Inbound Basic Signups</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.neonBlue }}>{formatMoney(selectedBonusQuarter.inbound_basic_cents)}</div>
                </div>
                <div style={{ padding: 12, background: COLORS.darkBg, borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 4 }}>Inbound Premium Signups</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.neonPurple }}>{formatMoney(selectedBonusQuarter.inbound_premium_cents)}</div>
                </div>
                <div style={{ padding: 12, background: COLORS.darkBg, borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 4 }}>Inbound Advertising</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.neonOrange }}>{formatMoney(selectedBonusQuarter.inbound_ads_cents)}</div>
                </div>
                <div style={{ padding: 12, background: COLORS.darkBg, borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 4 }}>Rep Basic Signups</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.neonBlue }}>{formatMoney(selectedBonusQuarter.rep_basic_cents)}</div>
                </div>
                <div style={{ padding: 12, background: COLORS.darkBg, borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 4 }}>Rep Premium Signups</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.neonPurple }}>{formatMoney(selectedBonusQuarter.rep_premium_cents)}</div>
                </div>
                <div style={{ padding: 12, background: COLORS.darkBg, borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 4 }}>Rep Advertising</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.neonOrange }}>{formatMoney(selectedBonusQuarter.rep_ads_cents)}</div>
                </div>
                <div style={{ padding: 12, background: COLORS.darkBg, borderRadius: 8, gridColumn: "1 / -1" }}>
                  <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 4 }}>Repeat Customers (Monthly Renewals)</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.neonGreen }}>{formatMoney(selectedBonusQuarter.repeat_customers_cents)}</div>
                </div>
              </div>
            </div>

            {/* Status */}
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Status</h3>
              <div style={{ padding: 12, background: COLORS.darkBg, borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>Payment Status</div>
                  <div style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 4 }}>
                    {selectedBonusQuarter.paid_at ? `Paid on ${formatDate(selectedBonusQuarter.paid_at)}` : "Pending payment"}
                  </div>
                </div>
                <Badge status={selectedBonusQuarter.status} />
              </div>
            </div>

            <button onClick={() => setShowBonusDetailsModal(false)} style={{ width: "100%", padding: "12px 24px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, cursor: "pointer" }}>Close</button>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, background: COLORS.gradient1, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>💼 Sales Commission & Bonus Pool</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowAddSaleModal(true)} style={{ padding: "10px 20px", background: COLORS.gradient2, border: "none", borderRadius: 8, color: "#000", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>+ Add Sale</button>
          <button onClick={() => downloadCSV(`sales_${new Date().toISOString().slice(0, 10)}.csv`, exportHeaders, exportRows)} style={{ padding: "10px 16px", background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, cursor: "pointer", fontSize: 12 }}>CSV</button>
          <button onClick={() => downloadXLSX(`sales_${new Date().toISOString().slice(0, 10)}.xlsx`, exportHeaders, exportRows)} style={{ padding: "10px 16px", background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, cursor: "pointer", fontSize: 12 }}>XLSX</button>
        </div>
      </div>

      {/* FILTERS BAR */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 4, background: COLORS.cardBg, padding: 4, borderRadius: 8 }}>
          {["day", "week", "month", "year"].map((p) => (
            <button key={p} onClick={() => setSalesPeriod(p)} style={{ padding: "8px 14px", borderRadius: 6, border: "none", cursor: "pointer", background: salesPeriod === p ? COLORS.gradient1 : "transparent", color: salesPeriod === p ? "#fff" : COLORS.textSecondary, fontSize: 12, fontWeight: salesPeriod === p ? 600 : 400, textTransform: "capitalize" }}>{p}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="date" value={salesFilters.dateFrom} onChange={(e) => setSalesFilters({ ...salesFilters, dateFrom: e.target.value })} style={{ padding: "8px 12px", background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, fontSize: 12 }} />
          <span style={{ color: COLORS.textSecondary }}>to</span>
          <input type="date" value={salesFilters.dateTo} onChange={(e) => setSalesFilters({ ...salesFilters, dateTo: e.target.value })} style={{ padding: "8px 12px", background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, fontSize: 12 }} />
        </div>
        {/* Zone dropdown - correct 8 zones */}
        <select value={salesFilters.zone} onChange={(e) => setSalesFilters({ ...salesFilters, zone: e.target.value })} style={{ padding: "8px 12px", background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, fontSize: 12 }}>
          <option value="all">All Zones</option>
          {divisions.map(d => (
            <optgroup key={d.id} label={d.name}>
              {zones.filter(z => z.division_id === d.id).map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
            </optgroup>
          ))}
        </select>
        <select value={salesFilters.state} onChange={(e) => setSalesFilters({ ...salesFilters, state: e.target.value })} style={{ padding: "8px 12px", background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, fontSize: 12 }}>
          <option value="all">All States</option>
          {zones.flatMap(z => z.states).filter((v, i, a) => a.indexOf(v) === i).sort().map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {/* Searchable rep filter */}
        <div style={{ minWidth: 160 }}>
          <SearchableSelect
            value={salesFilters.rep}
            onChange={(val) => setSalesFilters({ ...salesFilters, rep: val })}
            options={actualSalesReps.map(r => ({ value: r.id, label: r.name, sub: getZoneName(r.zone_id) }))}
            placeholder="All Reps"
            searchPlaceholder="Search reps..."
          />
        </div>
        {hasActiveFilters && (
          <button onClick={() => setSalesFilters({ dateFrom: "", dateTo: "", zone: "all", state: "all", rep: "all" })} style={{ padding: "8px 12px", background: "rgba(255,49,49,0.2)", border: "1px solid " + COLORS.neonRed, borderRadius: 8, color: COLORS.neonRed, cursor: "pointer", fontSize: 11 }}>✕ Clear</button>
        )}
      </div>

      {/* SUB-TABS */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, background: COLORS.cardBg, padding: 8, borderRadius: 12, width: "fit-content" }}>
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setSalesTab(tab.key)} style={{ padding: "10px 20px", borderRadius: 8, border: "none", cursor: "pointer", background: salesTab === tab.key ? COLORS.gradient1 : "transparent", color: salesTab === tab.key ? "#fff" : COLORS.textSecondary, fontWeight: salesTab === tab.key ? 700 : 500, fontSize: 13 }}>{tab.label}</button>
        ))}
      </div>

      {loading ? <div style={{ textAlign: "center", padding: 60, color: COLORS.textSecondary }}>Loading...</div> : (
        <>
          {/* OVERVIEW TAB */}
          {salesTab === "overview" && (
            <>
              {/* GLOBAL FILTERS BAR */}
              <Card style={{ marginBottom: 24, padding: 16 }}>
                <div style={{ display: "flex", gap: 16, alignItems: "end", flexWrap: "wrap" }}>
                  {/* Quick Period Filters */}
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, textTransform: "uppercase", fontWeight: 600 }}>Quick Filters</label>
                    <div style={{ display: "flex", gap: 4, background: COLORS.darkBg, padding: 4, borderRadius: 6 }}>
                      {[
                        { key: "day", label: "Today" },
                        { key: "week", label: "This Week" },
                        { key: "month", label: "This Month" },
                        { key: "year", label: "YTD" },
                        { key: "all", label: "All Time" },
                      ].map(p => (
                        <button
                          key={p.key}
                          onClick={() => {
                            setSalesPeriod(p.key);
                            setSalesFilters({ ...salesFilters, dateFrom: "", dateTo: "" });
                          }}
                          style={{ padding: "6px 12px", borderRadius: 4, border: "none", cursor: "pointer", background: salesPeriod === p.key && !salesFilters.dateFrom && !salesFilters.dateTo ? COLORS.gradient1 : "transparent", color: salesPeriod === p.key && !salesFilters.dateFrom && !salesFilters.dateTo ? "#fff" : COLORS.textSecondary, fontSize: 11, fontWeight: 600 }}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Date Range */}
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, textTransform: "uppercase", fontWeight: 600 }}>From Date</label>
                    <input
                      type="date"
                      value={salesFilters.dateFrom}
                      onChange={(e) => setSalesFilters({ ...salesFilters, dateFrom: e.target.value })}
                      style={{ padding: "6px 12px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 6, color: COLORS.textPrimary, fontSize: 12 }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, textTransform: "uppercase", fontWeight: 600 }}>To Date</label>
                    <input
                      type="date"
                      value={salesFilters.dateTo}
                      onChange={(e) => setSalesFilters({ ...salesFilters, dateTo: e.target.value })}
                      style={{ padding: "6px 12px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 6, color: COLORS.textPrimary, fontSize: 12 }}
                    />
                  </div>

                  {/* Zone Filter */}
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, textTransform: "uppercase", fontWeight: 600 }}>Zone</label>
                    <select
                      value={salesFilters.zone}
                      onChange={(e) => setSalesFilters({ ...salesFilters, zone: e.target.value })}
                      style={{ padding: "6px 12px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 6, color: COLORS.textPrimary, fontSize: 12 }}
                    >
                      <option value="all">All Zones</option>
                      {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                    </select>
                  </div>

                  {/* State Filter */}
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, textTransform: "uppercase", fontWeight: 600 }}>State</label>
                    <select
                      value={salesFilters.state}
                      onChange={(e) => setSalesFilters({ ...salesFilters, state: e.target.value })}
                      style={{ padding: "6px 12px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 6, color: COLORS.textPrimary, fontSize: 12 }}
                    >
                      <option value="all">All States</option>
                      {Array.from(new Set(signups.map(s => s.state).filter((v): v is string => Boolean(v)))).sort().map(state => (
                        <option key={state} value={state}>{state}</option>
                      ))}
                    </select>
                  </div>

                  {/* Rep Filter */}
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, textTransform: "uppercase", fontWeight: 600 }}>Rep</label>
                    <select
                      value={salesFilters.rep}
                      onChange={(e) => setSalesFilters({ ...salesFilters, rep: e.target.value })}
                      style={{ padding: "6px 12px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 6, color: COLORS.textPrimary, fontSize: 12 }}
                    >
                      <option value="all">All Reps</option>
                      {actualSalesReps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>

                  {/* Saved Presets */}
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, textTransform: "uppercase", fontWeight: 600 }}>Saved Presets</label>
                    <select
                      onChange={(e) => {
                        const preset = e.target.value;
                        if (preset === "last30") {
                          const date30DaysAgo = new Date();
                          date30DaysAgo.setDate(date30DaysAgo.getDate() - 30);
                          setSalesFilters({ ...salesFilters, dateFrom: date30DaysAgo.toISOString().slice(0, 10), dateTo: new Date().toISOString().slice(0, 10) });
                          setSalesPeriod("all");
                        } else if (preset === "q1") {
                          setSalesFilters({ ...salesFilters, dateFrom: `${currentYear}-01-01`, dateTo: `${currentYear}-03-31` });
                          setSalesPeriod("all");
                        } else if (preset === "q2") {
                          setSalesFilters({ ...salesFilters, dateFrom: `${currentYear}-04-01`, dateTo: `${currentYear}-06-30` });
                          setSalesPeriod("all");
                        } else if (preset === "q3") {
                          setSalesFilters({ ...salesFilters, dateFrom: `${currentYear}-07-01`, dateTo: `${currentYear}-09-30` });
                          setSalesPeriod("all");
                        } else if (preset === "q4") {
                          setSalesFilters({ ...salesFilters, dateFrom: `${currentYear}-10-01`, dateTo: `${currentYear}-12-31` });
                          setSalesPeriod("all");
                        }
                        e.target.value = "";
                      }}
                      style={{ padding: "6px 12px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 6, color: COLORS.textPrimary, fontSize: 12 }}
                    >
                      <option value="">Select Preset...</option>
                      <option value="last30">Last 30 Days</option>
                      <option value="q1">Q1 {currentYear}</option>
                      <option value="q2">Q2 {currentYear}</option>
                      <option value="q3">Q3 {currentYear}</option>
                      <option value="q4">Q4 {currentYear}</option>
                    </select>
                  </div>

                  {/* Clear Filters */}
                  {hasActiveFilters && (
                    <button
                      onClick={() => {
                        setSalesPeriod("month");
                        setSalesFilters({ dateFrom: "", dateTo: "", zone: "all", state: "all", rep: "all" });
                      }}
                      style={{ padding: "6px 16px", background: COLORS.neonRed, border: "none", borderRadius: 6, color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, alignSelf: "end" }}
                    >
                      Clear All
                    </button>
                  )}
                </div>

                {/* Active Filters Indicator */}
                {hasActiveFilters && (
                  <div style={{ marginTop: 12, padding: "8px 12px", background: "rgba(0,212,255,0.1)", border: "1px solid " + COLORS.neonBlue, borderRadius: 6, fontSize: 12 }}>
                    <strong style={{ color: COLORS.neonBlue }}>Active Filters:</strong>{" "}
                    {salesFilters.dateFrom && <span>From {formatDate(salesFilters.dateFrom)} • </span>}
                    {salesFilters.dateTo && <span>To {formatDate(salesFilters.dateTo)} • </span>}
                    {salesFilters.zone !== "all" && <span>Zone: {zones.find(z => z.id === salesFilters.zone)?.name} • </span>}
                    {salesFilters.state !== "all" && <span>State: {salesFilters.state} • </span>}
                    {salesFilters.rep !== "all" && <span>Rep: {salesReps.find(r => r.id === salesFilters.rep)?.name}</span>}
                  </div>
                )}
              </Card>

              {/* TOP STATS ROW */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 16, marginBottom: 24 }}>
                {[
                  { label: "Total Commissions", value: formatMoney(totalCommissions), sub: periodLabel, color: COLORS.neonGreen },
                  { label: "Bonus Pool", value: formatMoney(bonusPool?.total_pool_cents || 0), sub: bonusPool?.quarter || "Q1 2026", color: COLORS.neonPurple },
                  { label: "Team Signups", value: totalSignups, sub: `vs ${commissionRates.quotas.team_monthly} quota`, color: COLORS.neonBlue },
                  { label: "Eligible for Bonus", value: `${eligibleReps.length}/${actualSalesReps.length}`, sub: `Hit ${commissionRates.quotas.bonus_eligibility}+ signups`, color: COLORS.neonYellow },
                  { label: "Ad Spend Sold", value: formatMoney(totalAdSpend), sub: periodLabel, color: COLORS.neonOrange },
                  { label: "Surge Revenue", value: formatMoney(adCampaignRevenue.surge), sub: `${adCampaignRevenue.count} paid campaigns`, color: COLORS.neonRed || "#ff3131" },
                ].map((stat, i) => (
                  <Card key={i}><div style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 600 }}>{stat.label}</div><div style={{ fontSize: 28, fontWeight: 800, color: stat.color, marginTop: 8 }}>{stat.value}</div><div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 4 }}>{stat.sub}</div></Card>
                ))}
              </div>

              {/* TEAM QUOTA PROGRESS - Matching Original Color Scheme */}
              <Card title={`🎯 Team Quota Progress (${periodLabel})`} style={{ marginBottom: 24 }} actions={<button onClick={() => setSalesTab("quotas")} style={{ padding: "6px 12px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 6, color: COLORS.textSecondary, cursor: "pointer", fontSize: 11 }}>Manage Quotas →</button>}>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><span>Team Progress: <strong>{totalSignups}</strong> / {commissionRates.quotas.team_monthly} businesses</span><span style={{ fontWeight: 700, color: COLORS.neonGreen }}>{((totalSignups / commissionRates.quotas.team_monthly) * 100).toFixed(1)}%</span></div>
                  <ProgressBar value={totalSignups} max={commissionRates.quotas.team_monthly} height={12} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(actualSalesReps.length || 1, 6)}, 1fr)`, gap: 12 }}>
                  {(() => {
                    // Match original mockup colors: Pink, Blue, Green, Yellow, Orange, Purple
                    const repColors = ["#FF6B9D", "#00D4FF", "#39FF14", "#FFFF00", "#FF6B35", "#BF5FFF"];
                    return (salesFilters.rep === "all" ? actualSalesReps : actualSalesReps.filter((r) => r.id === salesFilters.rep)).slice(0, 6).map((rep, idx) => {
                      const perf = getRepPerformance(rep.id);
                      const isEligible = perf.total >= commissionRates.quotas.bonus_eligibility;
                      const repColor = repColors[idx % repColors.length];
                      return (
                        <div key={rep.id} style={{ padding: 16, background: COLORS.darkBg, borderRadius: 12, border: "1px solid " + COLORS.cardBorder }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                            <div style={{ width: 40, height: 40, borderRadius: "50%", background: repColor, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, color: "#000" }}>{rep.avatar || rep.name.split(" ").map(w => w[0]).join("").slice(0,2)}</div>
                            <div><div style={{ fontWeight: 600, fontSize: 13 }}>{rep.name.split(" ")[0]}</div><div style={{ fontSize: 10, color: isEligible ? COLORS.neonGreen : COLORS.textSecondary }}>{isEligible ? "✓ Eligible" : `Need ${commissionRates.quotas.bonus_eligibility - perf.total}`}</div></div>
                          </div>
                          <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 4, color: repColor }}>{perf.total}</div>
                          <div style={{ height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 100, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${Math.min(100, (perf.total / (rep.individual_quota || commissionRates.quotas.individual_monthly)) * 100)}%`, background: repColor, borderRadius: 100, transition: "width 0.5s" }} />
                          </div>
                          <div style={{ fontSize: 10, color: COLORS.textSecondary, marginTop: 4 }}>{perf.total}/{rep.individual_quota || commissionRates.quotas.individual_monthly} quota</div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </Card>

              {/* RECENT SIGNUPS + COMMISSION RATES & QUOTAS */}
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24, marginBottom: 24 }}>
                <Card title="📈 Recent Signups">
                  {filteredSignups.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary }}>No signups in this period</div> : (
                    <DataTable columns={[
                      { key: "business_name", label: "Business", render: (v: unknown) => String(v) || "—" },
                      { key: "rep_id", label: "Rep", render: (v: unknown) => salesReps.find((r) => r.id === String(v))?.name || "—" },
                      { key: "plan", label: "Plan", render: (v: unknown) => <Badge status={String(v)} /> },
                      { key: "commission_cents", label: "Commission", render: (v: unknown) => <span style={{ color: COLORS.neonGreen, fontWeight: 700 }}>+{formatMoney(Number(v))}</span> },
                      { key: "signed_at", label: "Date", render: (v: unknown) => formatDate(String(v)) },
                    ]} data={filteredSignups.slice(0, 10)} />
                  )}
                </Card>

                {/* Commission Rates & Quotas */}
                <Card title="💰 Commission Rates & Quotas" actions={<button onClick={() => setShowEditRatesModal(true)} style={{ padding: "6px 12px", background: COLORS.gradient1, border: "none", borderRadius: 6, color: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Edit Rates</button>}>
                  <div style={{ padding: 12, background: COLORS.darkBg, borderRadius: 10, marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.neonGreen, marginBottom: 10, textTransform: "uppercase" }}>Individual Commissions</div>
                    {[{ label: "Basic Signup", value: formatMoney(commissionRates.individual.basic_signup) }, { label: "Premium Signup", value: formatMoney(commissionRates.individual.premium_signup) }, { label: "Ad Spend (per $100)", value: formatMoney(commissionRates.individual.advertising_per_100) }].map((item) => (
                      <div key={item.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}><span style={{ color: COLORS.textSecondary }}>{item.label}</span><span style={{ fontWeight: 700, color: COLORS.neonGreen }}>{item.value}</span></div>
                    ))}
                  </div>
                  <div style={{ padding: 12, background: COLORS.darkBg, borderRadius: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.neonPurple, marginBottom: 10, textTransform: "uppercase" }}>Quotas</div>
                    {[{ label: "Individual Monthly", value: commissionRates.quotas.individual_monthly }, { label: "Bonus Eligibility", value: `${commissionRates.quotas.bonus_eligibility}+` }, { label: "Team Monthly", value: commissionRates.quotas.team_monthly }].map((item) => (
                      <div key={item.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}><span style={{ color: COLORS.textSecondary }}>{item.label}</span><span style={{ fontWeight: 700, color: COLORS.neonPurple }}>{item.value}</span></div>
                    ))}
                  </div>
                </Card>
              </div>

              {/* BONUS POOL BREAKDOWN MATRIX - WITH CONTEXT */}
              <Card title="🏆 Bonus Pool Breakdown Matrix" style={{ marginBottom: 24 }} actions={
                <div style={{ display: "flex", gap: 4, background: COLORS.darkBg, padding: 4, borderRadius: 6 }}>
                  {["day", "week", "month", "year"].map(p => (
                    <button key={p} onClick={() => setPoolMatrixPeriod(p)} style={{ padding: "6px 12px", borderRadius: 4, border: "none", cursor: "pointer", background: poolMatrixPeriod === p ? COLORS.gradient1 : "transparent", color: poolMatrixPeriod === p ? "#fff" : COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "capitalize" }}>{p}</button>
                  ))}
                </div>
              }>
                {/* Context Info */}
                <div style={{ display: "flex", gap: 24, marginBottom: 16, padding: "12px 16px", background: COLORS.darkBg, borderRadius: 8 }}>
                  <div style={{ fontSize: 12 }}><span style={{ color: COLORS.textSecondary }}>Quarter:</span> <strong style={{ color: COLORS.neonPurple }}>{bonusPool?.quarter || "Q1 2026"}</strong></div>
                  <div style={{ fontSize: 12 }}><span style={{ color: COLORS.textSecondary }}>Year:</span> <strong>{currentYear}</strong></div>
                  <div style={{ fontSize: 12 }}><span style={{ color: COLORS.textSecondary }}>Week:</span> <strong>{Math.ceil((now.getDate() + new Date(now.getFullYear(), now.getMonth(), 1).getDay()) / 7)}</strong></div>
                  <div style={{ fontSize: 12 }}><span style={{ color: COLORS.textSecondary }}>Period:</span> <strong>{now.getDate() <= 15 ? "1st Half" : "2nd Half"}</strong></div>
                  <div style={{ fontSize: 12 }}><span style={{ color: COLORS.textSecondary }}>Status:</span> <strong style={{ color: bonusPool?.status === "active" ? COLORS.neonGreen : COLORS.neonOrange }}>{bonusPool?.status || "Active"}</strong></div>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid " + COLORS.cardBorder }}>
                        <th style={{ textAlign: "left", padding: "12px 8px", color: COLORS.textSecondary, fontWeight: 600 }}>Category</th>
                        <th style={{ textAlign: "right", padding: "12px 8px", color: COLORS.neonBlue, fontWeight: 600 }}>Inbound</th>
                        <th style={{ textAlign: "right", padding: "12px 8px", color: COLORS.neonGreen, fontWeight: 600 }}>Outbound</th>
                        <th style={{ textAlign: "right", padding: "12px 8px", color: COLORS.neonPurple, fontWeight: 600 }}>Total</th>
                        <th style={{ textAlign: "right", padding: "12px 8px", color: COLORS.textSecondary, fontWeight: 600 }}>% of Pool</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        // Filter signups based on poolMatrixPeriod
                        const getFilteredSignups = () => {
                          const now = new Date();
                          let startDate = new Date();

                          if (poolMatrixPeriod === "day") {
                            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
                          } else if (poolMatrixPeriod === "week") {
                            const dayOfWeek = now.getDay();
                            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek, 0, 0, 0);
                          } else if (poolMatrixPeriod === "month") {
                            startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
                          } else if (poolMatrixPeriod === "year") {
                            startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
                          }

                          const filteredOutbound = signups.filter(s => new Date(s.signed_at) >= startDate);
                          const filteredInbound = inboundSignups.filter(s => new Date(s.signed_at) >= startDate);

                          return { outbound: filteredOutbound, inbound: filteredInbound };
                        };

                        const { outbound, inbound } = getFilteredSignups();

                        // Calculate contributions
                        const inboundBasic = inbound.filter(s => s.plan === "basic").reduce((sum, s) => sum + (s.pool_contribution_cents || 0), 0);
                        const outboundBasic = outbound.filter(s => s.plan === "basic").reduce((sum, s) => sum + (s.pool_contribution_cents || 0), 0);
                        const inboundPremium = inbound.filter(s => s.plan === "premium").reduce((sum, s) => sum + (s.pool_contribution_cents || 0), 0);
                        const outboundPremium = outbound.filter(s => s.plan === "premium").reduce((sum, s) => sum + (s.pool_contribution_cents || 0), 0);
                        const inboundAds = inbound.reduce((sum, s) => sum + (s.ad_spend_cents || 0) * 0.1, 0);
                        const outboundAds = outbound.reduce((sum, s) => sum + (s.ad_spend_cents || 0) * 0.1, 0);
                        const repeatCustomers = outbound.filter(s => s.plan === "repeat_customer").reduce((sum, s) => sum + (s.pool_contribution_cents || 0), 0);

                        const rows = [
                          { cat: "Basic Signups", inbound: inboundBasic, outbound: outboundBasic, color: "#4ECDC4" },
                          { cat: "Premium Signups", inbound: inboundPremium, outbound: outboundPremium, color: "#FF6B9D" },
                          { cat: "Ad Spend", inbound: inboundAds, outbound: outboundAds, color: COLORS.neonOrange },
                          { cat: "Repeat Customers", inbound: 0, outbound: repeatCustomers, color: COLORS.neonYellow },
                        ];

                        const calculatedPoolTotal = rows.reduce((sum, row) => sum + row.inbound + row.outbound, 0);

                        return rows.map((row, i) => {
                          const total = row.inbound + row.outbound;
                          const pct = calculatedPoolTotal > 0 ? ((total / calculatedPoolTotal) * 100).toFixed(1) : "0.0";
                          return (
                            <tr key={i} style={{ borderBottom: "1px solid " + COLORS.cardBorder }}>
                              <td style={{ padding: "12px 8px", display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 12, height: 12, borderRadius: 3, background: row.color }} />{row.cat}</td>
                              <td style={{ textAlign: "right", padding: "12px 8px", color: COLORS.neonBlue }}>{formatMoney(row.inbound)}</td>
                              <td style={{ textAlign: "right", padding: "12px 8px", color: COLORS.neonGreen }}>{formatMoney(row.outbound)}</td>
                              <td style={{ textAlign: "right", padding: "12px 8px", fontWeight: 700, color: COLORS.neonPurple }}>{formatMoney(total)}</td>
                              <td style={{ textAlign: "right", padding: "12px 8px" }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                                  <div style={{ width: 60, height: 6, background: COLORS.darkBg, borderRadius: 3, overflow: "hidden" }}><div style={{ height: "100%", width: `${pct}%`, background: row.color, borderRadius: 3 }} /></div>
                                  <span style={{ minWidth: 40 }}>{pct}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                      {(() => {
                        // Calculate totals for the TOTAL POOL row
                        const getFilteredSignups = () => {
                          const now = new Date();
                          let startDate = new Date();

                          if (poolMatrixPeriod === "day") {
                            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
                          } else if (poolMatrixPeriod === "week") {
                            const dayOfWeek = now.getDay();
                            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek, 0, 0, 0);
                          } else if (poolMatrixPeriod === "month") {
                            startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
                          } else if (poolMatrixPeriod === "year") {
                            startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
                          }

                          const filteredOutbound = signups.filter(s => new Date(s.signed_at) >= startDate);
                          const filteredInbound = inboundSignups.filter(s => new Date(s.signed_at) >= startDate);

                          return { outbound: filteredOutbound, inbound: filteredInbound };
                        };

                        const { outbound, inbound } = getFilteredSignups();

                        const totalInbound = inbound.reduce((sum, s) => sum + (s.pool_contribution_cents || 0), 0) + inbound.reduce((sum, s) => sum + (s.ad_spend_cents || 0) * 0.1, 0);
                        const totalOutbound = outbound.reduce((sum, s) => sum + (s.pool_contribution_cents || 0), 0) + outbound.reduce((sum, s) => sum + (s.ad_spend_cents || 0) * 0.1, 0);
                        const totalPool = totalInbound + totalOutbound;

                        return (
                          <tr style={{ background: "rgba(138,43,226,0.1)" }}>
                            <td style={{ padding: "12px 8px", fontWeight: 700 }}>TOTAL POOL</td>
                            <td style={{ textAlign: "right", padding: "12px 8px", fontWeight: 700, color: COLORS.neonBlue }}>{formatMoney(totalInbound)}</td>
                            <td style={{ textAlign: "right", padding: "12px 8px", fontWeight: 700, color: COLORS.neonGreen }}>{formatMoney(totalOutbound)}</td>
                            <td style={{ textAlign: "right", padding: "12px 8px", fontWeight: 800, fontSize: 14, color: COLORS.neonPurple }}>{formatMoney(totalPool)}</td>
                            <td style={{ textAlign: "right", padding: "12px 8px", fontWeight: 700 }}>100%</td>
                          </tr>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* GEOGRAPHIC TOTALS SUMMARY - Comprehensive View */}
              <Card title="🌎 Geographic Totals Summary" style={{ marginBottom: 24 }} actions={
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 4, background: COLORS.darkBg, padding: 4, borderRadius: 6 }}>
                    {["division", "zone", "state", "city"].map(v => (
                      <button key={v} onClick={() => setGeoSummaryView(v)} style={{ padding: "6px 12px", borderRadius: 4, border: "none", cursor: "pointer", background: geoSummaryView === v ? COLORS.gradient1 : "transparent", color: geoSummaryView === v ? "#fff" : COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "capitalize" }}>{v}</button>
                    ))}
                  </div>
                  <button
                    onClick={exportGeographicSummaryToCSV}
                    style={{ padding: "6px 12px", background: COLORS.gradient2, border: "none", borderRadius: 6, color: "#000", cursor: "pointer", fontSize: 11, fontWeight: 600 }}
                  >
                    📊 Export
                  </button>
                </div>
              }>
                {/* Search Field */}
                <div style={{ marginBottom: 16 }}>
                  <input
                    type="text"
                    value={geoSearchQuery}
                    onChange={(e) => setGeoSearchQuery(e.target.value)}
                    placeholder={`Search ${geoSummaryView}s...`}
                    style={{ width: "100%", padding: "10px 14px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, fontSize: 13 }}
                  />
                </div>

                {(() => {
                  // Calculate totals based on selected view
                  if (geoSummaryView === "division") {
                    const divisionData = divisions.map(d => {
                      const divSignups = filteredSignups.filter(s => s.division_id === d.id);
                      const signupCount = divSignups.length;
                      const basicCount = divSignups.filter(s => s.plan === "basic").length;
                      const premiumCount = divSignups.filter(s => s.plan === "premium").length;
                      const totalRevenue = divSignups.reduce((sum, s) => sum + (s.commission_cents || 0) + (s.ad_spend_cents || 0), 0);
                      const totalCommission = divSignups.reduce((sum, s) => sum + (s.commission_cents || 0), 0);
                      const totalAdSpend = divSignups.reduce((sum, s) => sum + (s.ad_spend_cents || 0), 0);
                      const repCount = salesReps.filter(r => r.division_id === d.id && r.status === "active").length;
                      return { name: d.name, signupCount, basicCount, premiumCount, totalRevenue, totalCommission, totalAdSpend, repCount };
                    }).sort((a, b) => b.totalRevenue - a.totalRevenue)
                    .filter(d => d.name.toLowerCase().includes(geoSearchQuery.toLowerCase()));

                    return (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                        {divisionData.length === 0 ? (
                          <div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary }}>No divisions found matching "{geoSearchQuery}"</div>
                        ) : divisionData.map((div, i) => (
                          <div key={i} style={{ padding: 16, background: COLORS.darkBg, borderRadius: 12, border: "1px solid " + COLORS.cardBorder }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                              <div>
                                <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.textPrimary }}>{div.name}</div>
                                <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 2 }}>{div.repCount} Active Reps</div>
                              </div>
                              <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.neonPurple }}>{formatMoney(div.totalRevenue)}</div>
                            </div>
                            <div style={{ display: "grid", gap: 8 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "6px 0", borderBottom: "1px solid " + COLORS.cardBorder }}>
                                <span style={{ color: COLORS.textSecondary }}>Total Signups</span>
                                <span style={{ fontWeight: 600 }}>{div.signupCount}</span>
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "6px 0", borderBottom: "1px solid " + COLORS.cardBorder }}>
                                <span style={{ color: COLORS.textSecondary }}>Basic / Premium</span>
                                <span style={{ fontWeight: 600 }}>{div.basicCount} / {div.premiumCount}</span>
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "6px 0", borderBottom: "1px solid " + COLORS.cardBorder }}>
                                <span style={{ color: COLORS.textSecondary }}>Commission</span>
                                <span style={{ fontWeight: 600, color: COLORS.neonGreen }}>{formatMoney(div.totalCommission)}</span>
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "6px 0" }}>
                                <span style={{ color: COLORS.textSecondary }}>Ad Spend</span>
                                <span style={{ fontWeight: 600, color: COLORS.neonBlue }}>{formatMoney(div.totalAdSpend)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  } else if (geoSummaryView === "zone") {
                    const zoneData = zones.map(z => {
                      const zoneSignups = filteredSignups.filter(s => s.zone_id === z.id);
                      const signupCount = zoneSignups.length;
                      const basicCount = zoneSignups.filter(s => s.plan === "basic").length;
                      const premiumCount = zoneSignups.filter(s => s.plan === "premium").length;
                      const totalRevenue = zoneSignups.reduce((sum, s) => sum + (s.commission_cents || 0) + (s.ad_spend_cents || 0), 0);
                      const totalCommission = zoneSignups.reduce((sum, s) => sum + (s.commission_cents || 0), 0);
                      const totalAdSpend = zoneSignups.reduce((sum, s) => sum + (s.ad_spend_cents || 0), 0);
                      const repCount = salesReps.filter(r => r.zone_id === z.id && r.status === "active").length;
                      const divName = divisions.find(d => d.id === z.division_id)?.name || "—";
                      return { name: z.name, divName, signupCount, basicCount, premiumCount, totalRevenue, totalCommission, totalAdSpend, repCount };
                    }).sort((a, b) => b.totalRevenue - a.totalRevenue)
                    .filter(z => z.name.toLowerCase().includes(geoSearchQuery.toLowerCase()));

                    return (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                        {zoneData.length === 0 ? (
                          <div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary }}>No zones found matching "{geoSearchQuery}"</div>
                        ) : zoneData.map((zone, i) => (
                          <div key={i} style={{ padding: 16, background: COLORS.darkBg, borderRadius: 12, border: "1px solid " + COLORS.cardBorder }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                              <div>
                                <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.textPrimary }}>{zone.name}</div>
                                <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 2 }}>{zone.divName} • {zone.repCount} Reps</div>
                              </div>
                              <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.neonPurple }}>{formatMoney(zone.totalRevenue)}</div>
                            </div>
                            <div style={{ display: "grid", gap: 8 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "6px 0", borderBottom: "1px solid " + COLORS.cardBorder }}>
                                <span style={{ color: COLORS.textSecondary }}>Total Signups</span>
                                <span style={{ fontWeight: 600 }}>{zone.signupCount}</span>
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "6px 0", borderBottom: "1px solid " + COLORS.cardBorder }}>
                                <span style={{ color: COLORS.textSecondary }}>Basic / Premium</span>
                                <span style={{ fontWeight: 600 }}>{zone.basicCount} / {zone.premiumCount}</span>
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "6px 0", borderBottom: "1px solid " + COLORS.cardBorder }}>
                                <span style={{ color: COLORS.textSecondary }}>Commission</span>
                                <span style={{ fontWeight: 600, color: COLORS.neonGreen }}>{formatMoney(zone.totalCommission)}</span>
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "6px 0" }}>
                                <span style={{ color: COLORS.textSecondary }}>Ad Spend</span>
                                <span style={{ fontWeight: 600, color: COLORS.neonBlue }}>{formatMoney(zone.totalAdSpend)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  } else if (geoSummaryView === "state") {
                    const stateData: Record<string, { signupCount: number; basicCount: number; premiumCount: number; totalRevenue: number; totalCommission: number; totalAdSpend: number }> = {};
                    filteredSignups.forEach(s => {
                      if (s.state) {
                        if (!stateData[s.state]) {
                          stateData[s.state] = { signupCount: 0, basicCount: 0, premiumCount: 0, totalRevenue: 0, totalCommission: 0, totalAdSpend: 0 };
                        }
                        stateData[s.state].signupCount++;
                        if (s.plan === "basic") stateData[s.state].basicCount++;
                        if (s.plan === "premium") stateData[s.state].premiumCount++;
                        stateData[s.state].totalRevenue += (s.commission_cents || 0) + (s.ad_spend_cents || 0);
                        stateData[s.state].totalCommission += (s.commission_cents || 0);
                        stateData[s.state].totalAdSpend += (s.ad_spend_cents || 0);
                      }
                    });

                    const stateSummary = Object.entries(stateData).map(([state, data]) => ({ state, ...data })).sort((a, b) => b.totalRevenue - a.totalRevenue)
                    .filter(s => s.state.toLowerCase().includes(geoSearchQuery.toLowerCase()));

                    return (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                        {stateSummary.length === 0 ? (
                          <div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary }}>No states found matching "{geoSearchQuery}"</div>
                        ) : stateSummary.map((st, i) => (
                          <div key={i} style={{ padding: 16, background: COLORS.darkBg, borderRadius: 12, border: "1px solid " + COLORS.cardBorder }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                              <div>
                                <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.textPrimary }}>{st.state}</div>
                                <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 2 }}>State</div>
                              </div>
                              <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.neonPurple }}>{formatMoney(st.totalRevenue)}</div>
                            </div>
                            <div style={{ display: "grid", gap: 8 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "6px 0", borderBottom: "1px solid " + COLORS.cardBorder }}>
                                <span style={{ color: COLORS.textSecondary }}>Total Signups</span>
                                <span style={{ fontWeight: 600 }}>{st.signupCount}</span>
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "6px 0", borderBottom: "1px solid " + COLORS.cardBorder }}>
                                <span style={{ color: COLORS.textSecondary }}>Basic / Premium</span>
                                <span style={{ fontWeight: 600 }}>{st.basicCount} / {st.premiumCount}</span>
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "6px 0", borderBottom: "1px solid " + COLORS.cardBorder }}>
                                <span style={{ color: COLORS.textSecondary }}>Commission</span>
                                <span style={{ fontWeight: 600, color: COLORS.neonGreen }}>{formatMoney(st.totalCommission)}</span>
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "6px 0" }}>
                                <span style={{ color: COLORS.textSecondary }}>Ad Spend</span>
                                <span style={{ fontWeight: 600, color: COLORS.neonBlue }}>{formatMoney(st.totalAdSpend)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  } else if (geoSummaryView === "city") {
                    const cityData: Record<string, { state: string; signupCount: number; basicCount: number; premiumCount: number; totalRevenue: number; totalCommission: number; totalAdSpend: number }> = {};
                    filteredSignups.forEach(s => {
                      if (s.city) {
                        const key = `${s.city}, ${s.state || "?"}`;
                        if (!cityData[key]) {
                          cityData[key] = { state: s.state || "?", signupCount: 0, basicCount: 0, premiumCount: 0, totalRevenue: 0, totalCommission: 0, totalAdSpend: 0 };
                        }
                        cityData[key].signupCount++;
                        if (s.plan === "basic") cityData[key].basicCount++;
                        if (s.plan === "premium") cityData[key].premiumCount++;
                        cityData[key].totalRevenue += (s.commission_cents || 0) + (s.ad_spend_cents || 0);
                        cityData[key].totalCommission += (s.commission_cents || 0);
                        cityData[key].totalAdSpend += (s.ad_spend_cents || 0);
                      }
                    });

                    const citySummary = Object.entries(cityData).map(([city, data]) => ({ city, ...data })).sort((a, b) => b.totalRevenue - a.totalRevenue)
                    .filter(c => c.city.toLowerCase().includes(geoSearchQuery.toLowerCase()));

                    return (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                        {citySummary.length === 0 ? (
                          <div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary }}>No cities found matching "{geoSearchQuery}"</div>
                        ) : citySummary.map((ct, i) => (
                          <div key={i} style={{ padding: 16, background: COLORS.darkBg, borderRadius: 12, border: "1px solid " + COLORS.cardBorder }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                              <div>
                                <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.textPrimary }}>{ct.city}</div>
                                <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 2 }}>City</div>
                              </div>
                              <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.neonPurple }}>{formatMoney(ct.totalRevenue)}</div>
                            </div>
                            <div style={{ display: "grid", gap: 8 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "6px 0", borderBottom: "1px solid " + COLORS.cardBorder }}>
                                <span style={{ color: COLORS.textSecondary }}>Total Signups</span>
                                <span style={{ fontWeight: 600 }}>{ct.signupCount}</span>
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "6px 0", borderBottom: "1px solid " + COLORS.cardBorder }}>
                                <span style={{ color: COLORS.textSecondary }}>Basic / Premium</span>
                                <span style={{ fontWeight: 600 }}>{ct.basicCount} / {ct.premiumCount}</span>
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "6px 0", borderBottom: "1px solid " + COLORS.cardBorder }}>
                                <span style={{ color: COLORS.textSecondary }}>Commission</span>
                                <span style={{ fontWeight: 600, color: COLORS.neonGreen }}>{formatMoney(ct.totalCommission)}</span>
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "6px 0" }}>
                                <span style={{ color: COLORS.textSecondary }}>Ad Spend</span>
                                <span style={{ fontWeight: 600, color: COLORS.neonBlue }}>{formatMoney(ct.totalAdSpend)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  }
                })()}
              </Card>

              {/* TOP LOCATIONS BY REVENUE - 4 Small Cards */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                  <span>💵</span> Top Locations by Revenue (Package + Ad Sales)
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
                  {(() => {
                    // Calculate totals by division
                    const divTotals = divisions.map(d => {
                      const divSignups = filteredSignups.filter(s => s.division_id === d.id);
                      const revenue = divSignups.reduce((sum, s) => sum + (s.commission_cents || 0) + (s.ad_spend_cents || 0), 0);
                      return { name: d.name, revenue };
                    }).sort((a, b) => b.revenue - a.revenue)[0] || { name: "—", revenue: 0 };
                    
                    // Calculate totals by zone
                    const zoneTotals = zones.map(z => {
                      const zoneSignups = filteredSignups.filter(s => s.zone_id === z.id);
                      const revenue = zoneSignups.reduce((sum, s) => sum + (s.commission_cents || 0) + (s.ad_spend_cents || 0), 0);
                      return { name: z.name, revenue };
                    }).sort((a, b) => b.revenue - a.revenue)[0] || { name: "—", revenue: 0 };
                    
                    // Calculate totals by state
                    const stateTotals: Record<string, number> = {};
                    filteredSignups.forEach(s => {
                      if (s.state) {
                        stateTotals[s.state] = (stateTotals[s.state] || 0) + (s.commission_cents || 0) + (s.ad_spend_cents || 0);
                      }
                    });
                    const topState = Object.entries(stateTotals).sort((a, b) => b[1] - a[1])[0] || ["—", 0];
                    
                    // Calculate totals by city
                    const cityTotals: Record<string, number> = {};
                    filteredSignups.forEach(s => {
                      if (s.city) {
                        cityTotals[s.city] = (cityTotals[s.city] || 0) + (s.commission_cents || 0) + (s.ad_spend_cents || 0);
                      }
                    });
                    const topCity = Object.entries(cityTotals).sort((a, b) => b[1] - a[1])[0] || ["—", 0];
                    
                    return [
                      { label: "Top Division", name: divTotals.name, value: divTotals.revenue, color: COLORS.neonBlue },
                      { label: "Top Zone", name: zoneTotals.name, value: zoneTotals.revenue, color: COLORS.neonGreen },
                      { label: "Top State", name: topState[0], value: topState[1] as number, color: COLORS.neonOrange },
                      { label: "Top City", name: topCity[0], value: topCity[1] as number, color: COLORS.neonPurple },
                    ].map((item, i) => (
                      <div key={i} style={{ padding: 16, background: COLORS.cardBg, borderRadius: 12, border: "1px solid " + COLORS.cardBorder }}>
                        <div style={{ fontSize: 10, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 600 }}>{item.label}</div>
                        <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4, color: item.color }}>{item.name}</div>
                        <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8, color: COLORS.textPrimary }}>{formatMoney(item.value)}</div>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* TOP LOCATIONS BY SALES SPEND - 4 Small Cards */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                  <span>💰</span> Top Locations by Sales Spend (Commission + Bonus)
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
                  {(() => {
                    // For commission, use the commission_cents from signups
                    // For bonus, we'll estimate based on pool share
                    
                    // Calculate commission totals by division
                    const divCommission = divisions.map(d => {
                      const divSignups = filteredSignups.filter(s => s.division_id === d.id);
                      const commission = divSignups.reduce((sum, s) => sum + (s.commission_cents || 0), 0);
                      return { name: d.name, spend: commission };
                    }).sort((a, b) => b.spend - a.spend)[0] || { name: "—", spend: 0 };
                    
                    // Calculate by zone
                    const zoneCommission = zones.map(z => {
                      const zoneSignups = filteredSignups.filter(s => s.zone_id === z.id);
                      const commission = zoneSignups.reduce((sum, s) => sum + (s.commission_cents || 0), 0);
                      return { name: z.name, spend: commission };
                    }).sort((a, b) => b.spend - a.spend)[0] || { name: "—", spend: 0 };
                    
                    // Calculate by state
                    const stateCommission: Record<string, number> = {};
                    filteredSignups.forEach(s => {
                      if (s.state) {
                        stateCommission[s.state] = (stateCommission[s.state] || 0) + (s.commission_cents || 0);
                      }
                    });
                    const topStateComm = Object.entries(stateCommission).sort((a, b) => b[1] - a[1])[0] || ["—", 0];
                    
                    // Calculate by city
                    const cityCommission: Record<string, number> = {};
                    filteredSignups.forEach(s => {
                      if (s.city) {
                        cityCommission[s.city] = (cityCommission[s.city] || 0) + (s.commission_cents || 0);
                      }
                    });
                    const topCityComm = Object.entries(cityCommission).sort((a, b) => b[1] - a[1])[0] || ["—", 0];
                    
                    return [
                      { label: "Top Division", name: divCommission.name, value: divCommission.spend, color: "#FF6B9D" },
                      { label: "Top Zone", name: zoneCommission.name, value: zoneCommission.spend, color: "#4ECDC4" },
                      { label: "Top State", name: topStateComm[0], value: topStateComm[1] as number, color: COLORS.neonYellow },
                      { label: "Top City", name: topCityComm[0], value: topCityComm[1] as number, color: "#95E1D3" },
                    ].map((item, i) => (
                      <div key={i} style={{ padding: 16, background: COLORS.cardBg, borderRadius: 12, border: "1px solid " + COLORS.cardBorder }}>
                        <div style={{ fontSize: 10, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 600 }}>{item.label}</div>
                        <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4, color: item.color }}>{item.name}</div>
                        <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8, color: COLORS.textPrimary }}>{formatMoney(item.value)}</div>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* SALES GEOGRAPHY TABLE - All breakdowns as columns */}
              <Card title="🗺️ Sales Geography Breakdown" style={{ marginBottom: 24 }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid " + COLORS.cardBorder }}>
                        <th style={{ textAlign: "left", padding: "12px 8px", color: COLORS.neonBlue, fontWeight: 600 }}>Division</th>
                        <th style={{ textAlign: "left", padding: "12px 8px", color: COLORS.neonGreen, fontWeight: 600 }}>Zone</th>
                        <th style={{ textAlign: "left", padding: "12px 8px", color: COLORS.neonOrange, fontWeight: 600 }}>State</th>
                        <th style={{ textAlign: "left", padding: "12px 8px", color: COLORS.neonPurple, fontWeight: 600 }}>City</th>
                        <th style={{ textAlign: "right", padding: "12px 8px", color: COLORS.textSecondary, fontWeight: 600 }}>Basic</th>
                        <th style={{ textAlign: "right", padding: "12px 8px", color: COLORS.textSecondary, fontWeight: 600 }}>Premium</th>
                        <th style={{ textAlign: "right", padding: "12px 8px", color: COLORS.neonGreen, fontWeight: 600 }}>Package $</th>
                        <th style={{ textAlign: "right", padding: "12px 8px", color: COLORS.neonOrange, fontWeight: 600 }}>Ad Spend $</th>
                        <th style={{ textAlign: "right", padding: "12px 8px", color: COLORS.neonPurple, fontWeight: 600 }}>Total $</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        // Group signups by city for the most granular view
                        const rows: Array<{ division: string; zone: string; state: string; city: string; basic: number; premium: number; packageAmt: number; adSpend: number; total: number }> = [];
                        
                        filteredSignups.forEach(s => {
                          const division = divisions.find(d => d.id === s.division_id);
                          const zone = zones.find(z => z.id === s.zone_id);
                          const key = `${s.division_id}-${s.zone_id}-${s.state}-${s.city}`;
                          const existingIdx = rows.findIndex(r => `${divisions.find(d => d.name === r.division)?.id}-${zones.find(z => z.name === r.zone)?.id}-${r.state}-${r.city}` === key);
                          
                          const packageAmt = s.plan === "basic" ? 2500 : 10000; // Commission for package
                          
                          if (existingIdx >= 0) {
                            if (s.plan === "basic") rows[existingIdx].basic++;
                            else rows[existingIdx].premium++;
                            rows[existingIdx].packageAmt += packageAmt;
                            rows[existingIdx].adSpend += s.ad_spend_cents || 0;
                            rows[existingIdx].total += packageAmt + (s.ad_spend_cents || 0);
                          } else {
                            rows.push({
                              division: division?.name || "—",
                              zone: zone?.name || "—",
                              state: s.state || "—",
                              city: s.city || "—",
                              basic: s.plan === "basic" ? 1 : 0,
                              premium: s.plan === "premium" ? 1 : 0,
                              packageAmt: packageAmt,
                              adSpend: s.ad_spend_cents || 0,
                              total: packageAmt + (s.ad_spend_cents || 0),
                            });
                          }
                        });
                        
                        return rows.sort((a, b) => b.total - a.total).slice(0, 15).map((row, i) => (
                          <tr key={i} style={{ borderBottom: "1px solid " + COLORS.cardBorder, background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
                            <td style={{ padding: "10px 8px", fontWeight: 600, color: COLORS.neonBlue }}>{row.division}</td>
                            <td style={{ padding: "10px 8px", color: COLORS.neonGreen }}>{row.zone}</td>
                            <td style={{ padding: "10px 8px", color: COLORS.neonOrange }}>{row.state}</td>
                            <td style={{ padding: "10px 8px", color: COLORS.neonPurple }}>{row.city}</td>
                            <td style={{ textAlign: "right", padding: "10px 8px" }}>{row.basic}</td>
                            <td style={{ textAlign: "right", padding: "10px 8px" }}>{row.premium}</td>
                            <td style={{ textAlign: "right", padding: "10px 8px", color: COLORS.neonGreen, fontWeight: 600 }}>{formatMoney(row.packageAmt)}</td>
                            <td style={{ textAlign: "right", padding: "10px 8px", color: COLORS.neonOrange, fontWeight: 600 }}>{formatMoney(row.adSpend)}</td>
                            <td style={{ textAlign: "right", padding: "10px 8px", color: COLORS.neonPurple, fontWeight: 700 }}>{formatMoney(row.total)}</td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: "rgba(138,43,226,0.1)", borderTop: "2px solid " + COLORS.cardBorder }}>
                        <td colSpan={4} style={{ padding: "12px 8px", fontWeight: 700 }}>TOTALS</td>
                        <td style={{ textAlign: "right", padding: "12px 8px", fontWeight: 700 }}>{filteredSignups.filter(s => s.plan === "basic").length}</td>
                        <td style={{ textAlign: "right", padding: "12px 8px", fontWeight: 700 }}>{filteredSignups.filter(s => s.plan === "premium").length}</td>
                        <td style={{ textAlign: "right", padding: "12px 8px", fontWeight: 700, color: COLORS.neonGreen }}>{formatMoney(filteredSignups.reduce((sum, s) => sum + (s.plan === "basic" ? 2500 : 10000), 0))}</td>
                        <td style={{ textAlign: "right", padding: "12px 8px", fontWeight: 700, color: COLORS.neonOrange }}>{formatMoney(totalAdSpend)}</td>
                        <td style={{ textAlign: "right", padding: "12px 8px", fontWeight: 800, fontSize: 13, color: COLORS.neonPurple }}>{formatMoney(filteredSignups.reduce((sum, s) => sum + (s.plan === "basic" ? 2500 : 10000) + (s.ad_spend_cents || 0), 0))}</td>
                      </tr>
                    </tfoot>
                  </table>
                  {filteredSignups.length === 0 && (
                    <div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary }}>No data available for this period</div>
                  )}
                </div>
              </Card>

              {/* MONTHLY PERFORMANCE TREND - Bar Chart */}
              <Card title="📈 Monthly Performance Trend">
                <div style={{ padding: 16, height: 280 }}>
                  {(() => {
                    const months = [];
                    for (let i = 5; i >= 0; i--) {
                      const d = new Date();
                      d.setMonth(d.getMonth() - i);
                      months.push({ month: monthNames[d.getMonth()], monthNum: d.getMonth() + 1, year: d.getFullYear() });
                    }
                    const monthlyData = months.map(m => {
                      const monthSignups = signups.filter(s => {
                        const d = new Date(s.signed_at);
                        return d.getMonth() + 1 === m.monthNum && d.getFullYear() === m.year;
                      });
                      return { month: m.month, basic: monthSignups.filter(s => s.plan === "basic").length, premium: monthSignups.filter(s => s.plan === "premium").length };
                    });
                    const maxVal = Math.max(...monthlyData.flatMap(d => [d.basic + d.premium]), 10);
                    const barWidth = 40;
                    return (
                      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-around", height: 220, paddingBottom: 30 }}>
                        {monthlyData.map((d, i) => (
                          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                            <div style={{ display: "flex", flexDirection: "column-reverse", height: 180 }}>
                              <div style={{ width: barWidth, background: COLORS.neonBlue, borderRadius: "4px 4px 0 0", height: `${(d.basic / maxVal) * 160}px`, minHeight: d.basic > 0 ? 4 : 0 }} />
                              <div style={{ width: barWidth, background: COLORS.neonPurple, borderRadius: "4px 4px 0 0", height: `${(d.premium / maxVal) * 160}px`, minHeight: d.premium > 0 ? 4 : 0 }} />
                            </div>
                            <div style={{ fontSize: 11, color: COLORS.textSecondary }}>{d.month}</div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  <div style={{ display: "flex", gap: 24, justifyContent: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 12, height: 12, background: COLORS.neonBlue, borderRadius: 2 }} /><span style={{ fontSize: 11, color: COLORS.textSecondary }}>Basic</span></div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 12, height: 12, background: COLORS.neonPurple, borderRadius: 2 }} /><span style={{ fontSize: 11, color: COLORS.textSecondary }}>Premium</span></div>
                  </div>
                </div>
              </Card>
            </>
          )}



          {/* REPS TAB - with expanded fields */}
          {salesTab === "reps" && (
            <Card title="👥 Sales Team" actions={
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={exportRepPerformanceToCSV} style={{ padding: "10px 20px", background: COLORS.gradient2, border: "none", borderRadius: 8, color: "#000", cursor: "pointer", fontWeight: 600 }}>📊 Export</button>
                <button onClick={() => setShowAddRepModal(true)} style={{ padding: "10px 20px", background: COLORS.gradient1, border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", fontWeight: 600 }}>+ Add Sales Rep</button>
              </div>
            }>
              {salesReps.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary }}>No sales team members</div> : (
                <DataTable columns={[
                  { key: "name", label: "Name", render: (v: unknown, row: Record<string, unknown>) => { const r = row as unknown as SalesRep; return <div style={{ display: "flex", alignItems: "center", gap: 12 }}><Avatar name={String(v)} initials={r.avatar} /><div><div style={{ fontWeight: 600 }}>{String(v)}</div><div style={{ fontSize: 11, color: COLORS.textSecondary }}>{r.email}</div></div></div>; } },
                  { key: "role", label: "Role", render: (v: unknown) => <span style={{ fontSize: 11 }}>{ROLE_LABELS[String(v)] || String(v)}</span> },
                  { key: "zone_id", label: "Zone", render: (v: unknown) => getZoneName(String(v)) },
                  { key: "city", label: "City", render: (v: unknown) => (v as string) || "—" },
                  { key: "supervisor_id", label: "Supervisor", render: (v: unknown) => getSupervisorName(v as string | null) },
                  { key: "id", label: "Signups", render: (v: unknown) => { const rep = salesReps.find(r => r.id === String(v)); return rep?.role === "sales_rep" ? getRepPerformance(String(v)).total : "—"; } },
                  { key: "id", label: "Commission", render: (v: unknown) => { const rep = salesReps.find(r => r.id === String(v)); return rep?.role === "sales_rep" ? <span style={{ color: COLORS.neonGreen, fontWeight: 700 }}>{formatMoney(getRepPerformance(String(v)).commission)}</span> : "—"; } },
                  { key: "status", label: "Status", render: (v: unknown) => <Badge status={String(v)} /> },
                  { key: "id", label: "", render: (v: unknown) => { const rep = salesReps.find(r => r.id === String(v)); return rep ? <button onClick={() => setSelectedRep(rep)} style={{ padding: "6px 14px", background: COLORS.gradient1, border: "none", borderRadius: 6, color: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>View</button> : null; } },
                ]} data={salesReps} />
              )}
            </Card>
          )}

          {/* SIGNUPS TAB */}
          {salesTab === "signups" && (
            <>
              {/* Type Filter + Export Button */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  {["all", "outbound", "inbound"].map((f) => <button key={f} onClick={() => setSignupTypeFilter(f)} style={{ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", background: signupTypeFilter === f ? COLORS.gradient1 : COLORS.cardBg, color: signupTypeFilter === f ? "#fff" : COLORS.textSecondary, fontSize: 12, fontWeight: 600 }}>{f === "all" ? "All Signups" : f === "outbound" ? "Outbound (Sales Rep)" : "Inbound (No Rep)"}</button>)}
                </div>
                <button
                  onClick={exportSignupsToCSV}
                  style={{ padding: "10px 20px", background: COLORS.gradient2, border: "none", borderRadius: 8, color: "#000", cursor: "pointer", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}
                >
                  📊 Export to CSV
                </button>
              </div>

              {/* Search & Filters */}
              <Card style={{ marginBottom: 16, padding: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 12, alignItems: "end" }}>
                  {/* Search */}
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, textTransform: "uppercase", fontWeight: 600 }}>Search Business</label>
                    <input
                      type="text"
                      value={signupSearchQuery}
                      onChange={(e) => setSignupSearchQuery(e.target.value)}
                      placeholder="Search by business name..."
                      style={{ width: "100%", padding: "10px 14px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, fontSize: 13 }}
                    />
                  </div>

                  {/* Date From */}
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, textTransform: "uppercase", fontWeight: 600 }}>From</label>
                    <input
                      type="date"
                      value={signupFilters.dateFrom}
                      onChange={(e) => setSignupFilters({ ...signupFilters, dateFrom: e.target.value })}
                      style={{ width: "100%", padding: "10px 14px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, fontSize: 13 }}
                    />
                  </div>

                  {/* Date To */}
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, textTransform: "uppercase", fontWeight: 600 }}>To</label>
                    <input
                      type="date"
                      value={signupFilters.dateTo}
                      onChange={(e) => setSignupFilters({ ...signupFilters, dateTo: e.target.value })}
                      style={{ width: "100%", padding: "10px 14px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, fontSize: 13 }}
                    />
                  </div>

                  {/* Zone Filter */}
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, textTransform: "uppercase", fontWeight: 600 }}>Zone</label>
                    <select
                      value={signupFilters.zone}
                      onChange={(e) => setSignupFilters({ ...signupFilters, zone: e.target.value })}
                      style={{ width: "100%", padding: "10px 14px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, fontSize: 13 }}
                    >
                      <option value="all">All Zones</option>
                      {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                    </select>
                  </div>

                  {/* Rep Filter */}
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, textTransform: "uppercase", fontWeight: 600 }}>Rep</label>
                    <select
                      value={signupFilters.rep}
                      onChange={(e) => setSignupFilters({ ...signupFilters, rep: e.target.value })}
                      style={{ width: "100%", padding: "10px 14px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, fontSize: 13 }}
                    >
                      <option value="all">All Reps</option>
                      {salesReps.filter(r => r.status === "active").map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* Second Row - Plan Filter + Clear */}
                <div style={{ display: "flex", gap: 12, marginTop: 12, alignItems: "end" }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, textTransform: "uppercase", fontWeight: 600 }}>Plan</label>
                    <select
                      value={signupFilters.plan}
                      onChange={(e) => setSignupFilters({ ...signupFilters, plan: e.target.value })}
                      style={{ width: "100%", padding: "10px 14px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, fontSize: 13 }}
                    >
                      <option value="all">All Plans</option>
                      <option value="basic">Basic</option>
                      <option value="premium">Premium</option>
                    </select>
                  </div>

                  {/* Clear Filters Button */}
                  {(signupSearchQuery || signupFilters.dateFrom || signupFilters.dateTo || signupFilters.zone !== "all" || signupFilters.rep !== "all" || signupFilters.plan !== "all") && (
                    <button
                      onClick={() => {
                        setSignupSearchQuery("");
                        setSignupFilters({ dateFrom: "", dateTo: "", zone: "all", rep: "all", plan: "all" });
                      }}
                      style={{ padding: "10px 20px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textSecondary, cursor: "pointer", fontSize: 13, fontWeight: 600 }}
                    >
                      Clear All Filters
                    </button>
                  )}
                </div>
              </Card>
              {(signupTypeFilter === "all" || signupTypeFilter === "outbound") && (
                <Card title="📤 Outbound Signups" style={{ marginBottom: 24 }}>
                  {filteredSignupsForTab.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary }}>No outbound signups</div> : (
                    <DataTable columns={[
                      { key: "business_name", label: "Business", render: (v: unknown) => String(v) || "—" },
                      { key: "rep_id", label: "Sales Rep", render: (v: unknown) => salesReps.find((r) => r.id === String(v))?.name || "?" },
                      { key: "zone_id", label: "Zone", render: (v: unknown) => getZoneName(String(v)) },
                      { key: "plan", label: "Plan", render: (v: unknown) => <Badge status={String(v)} /> },
                      { key: "commission_cents", label: "Commission", render: (v: unknown) => <span style={{ color: COLORS.neonGreen, fontWeight: 700 }}>+{formatMoney(Number(v))}</span> },
                      { key: "signed_at", label: "Date", render: (v: unknown) => formatDate(String(v)) },
                      { key: "id", label: "Actions", render: (_v: unknown, row: Record<string, unknown>) => (
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            onClick={() => {
                              setEditingSignup({ id: String(row.id), type: "outbound", commission_cents: Number(row.commission_cents) || 0 });
                              setShowEditSignupModal(true);
                            }}
                            style={{ padding: "6px 12px", background: COLORS.gradient1, border: "none", borderRadius: 6, color: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 600 }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteSignup(String(row.id), "outbound", String(row.business_name) || "Unknown")}
                            style={{ padding: "6px 12px", background: COLORS.neonRed, border: "none", borderRadius: 6, color: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 600 }}
                          >
                            Delete
                          </button>
                        </div>
                      )},
                    ]} data={filteredSignupsForTab} />
                  )}
                </Card>
              )}
              {(signupTypeFilter === "all" || signupTypeFilter === "inbound") && (
                <Card title="📥 Inbound Signups">
                  {filteredInboundForTab.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary }}>No inbound signups</div> : (
                    <DataTable columns={[
                      { key: "business_name", label: "Business" },
                      { key: "plan", label: "Plan", render: (v: unknown) => <Badge status={String(v)} /> },
                      { key: "pool_contribution_cents", label: "Pool Contribution", render: (v: unknown) => <span style={{ color: COLORS.neonPurple, fontWeight: 700 }}>+{formatMoney(Number(v))}</span> },
                      { key: "signed_at", label: "Date", render: (v: unknown) => formatDate(String(v)) },
                      { key: "id", label: "Actions", render: (_v: unknown, row: Record<string, unknown>) => (
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            onClick={() => {
                              setEditingSignup({ id: String(row.id), type: "inbound", pool_contribution_cents: Number(row.pool_contribution_cents) || 0 });
                              setShowEditSignupModal(true);
                            }}
                            style={{ padding: "6px 12px", background: COLORS.gradient1, border: "none", borderRadius: 6, color: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 600 }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteSignup(String(row.id), "inbound", String(row.business_name) || "Unknown")}
                            style={{ padding: "6px 12px", background: COLORS.neonRed, border: "none", borderRadius: 6, color: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 600 }}
                          >
                            Delete
                          </button>
                        </div>
                      )},
                    ]} data={filteredInboundForTab} />
                  )}
                </Card>
              )}
            </>
          )}

          {/* BONUS POOL TAB - with Eligible section, Original Signup date, Previous Quarters */}
          {salesTab === "bonuspool" && (
            <>
              <Card title={`🏆 ${bonusPool?.quarter || "Q1 2026"} Bonus Pool`} style={{ marginBottom: 24 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 24 }}>
                  <div>
                    <div style={{ fontSize: 48, fontWeight: 800, color: COLORS.neonPurple }}>{formatMoney(bonusPool?.total_pool_cents || 0)}</div>
                    <div style={{ color: COLORS.textSecondary, marginBottom: 16 }}>Current Pool Balance</div>
                    <div style={{ padding: 16, background: "rgba(57,255,20,0.1)", borderRadius: 12, border: "1px solid " + COLORS.neonGreen }}>
                      <div style={{ fontSize: 12, color: COLORS.textSecondary }}>Projected Per-Rep Payout</div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: COLORS.neonGreen }}>{formatMoney(bonusPool?.projected_per_rep_cents || 0)}</div>
                      <div style={{ fontSize: 11, color: COLORS.textSecondary }}>Split between {eligibleReps.length} eligible reps</div>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Pool Breakdown</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div style={{ padding: 16, background: COLORS.darkBg, borderRadius: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.neonBlue, marginBottom: 12 }}>📥 Inbound</div>
                        <div style={{ fontSize: 13 }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span>Basic</span><span>{formatMoney(bonusPool?.inbound_basic_cents || 0)}</span></div><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span>Premium</span><span>{formatMoney(bonusPool?.inbound_premium_cents || 0)}</span></div><div style={{ display: "flex", justifyContent: "space-between" }}><span>Ad Spend</span><span>{formatMoney(bonusPool?.inbound_ads_cents || 0)}</span></div></div>
                      </div>
                      <div style={{ padding: 16, background: COLORS.darkBg, borderRadius: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.neonGreen, marginBottom: 12 }}>📤 Rep</div>
                        <div style={{ fontSize: 13 }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span>Basic</span><span>{formatMoney(bonusPool?.rep_basic_cents || 0)}</span></div><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span>Premium</span><span>{formatMoney(bonusPool?.rep_premium_cents || 0)}</span></div><div style={{ display: "flex", justifyContent: "space-between" }}><span>Ad Spend</span><span>{formatMoney(bonusPool?.rep_ads_cents || 0)}</span></div></div>
                      </div>
                      <div style={{ padding: 16, background: COLORS.darkBg, borderRadius: 12, gridColumn: "1 / -1" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.neonOrange, marginBottom: 8 }}>🔄 Repeat Customer Bonus</div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span>$0.50/repeat/month</span><span style={{ fontWeight: 700 }}>{formatMoney(bonusPool?.repeat_customers_cents || 0)}</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* ELIGIBLE FOR BONUS SECTION */}
              <Card title="✓ Eligible for Bonus" style={{ marginBottom: 24 }}>
                {eligibleReps.length === 0 ? <div style={{ padding: 20, textAlign: "center", color: COLORS.textSecondary }}>No reps have reached the bonus eligibility threshold ({commissionRates.quotas.bonus_eligibility}+ signups) yet</div> : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                    {eligibleReps.map((rep) => {
                      const perf = getRepPerformance(rep.id);
                      return (
                        <div key={rep.id} style={{ padding: 20, background: "rgba(57,255,20,0.05)", borderRadius: 12, border: "1px solid " + COLORS.neonGreen }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}><Avatar name={rep.name} initials={rep.avatar} /><div><div style={{ fontWeight: 700 }}>{rep.name}</div><div style={{ fontSize: 12, color: COLORS.neonGreen }}>✓ {perf.total} signups</div></div></div>
                          <div style={{ fontSize: 24, fontWeight: 800, color: COLORS.neonGreen }}>+{formatMoney(bonusPool?.projected_per_rep_cents || 0)}</div>
                          <div style={{ fontSize: 11, color: COLORS.textSecondary }}>Projected Q1 bonus</div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {/* Not Yet Eligible */}
                {notYetEligibleReps.length > 0 && (
                  <div style={{ marginTop: 16, padding: 16, background: "rgba(255,200,0,0.1)", borderRadius: 12, border: "1px solid " + COLORS.neonYellow }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.neonYellow, marginBottom: 8 }}>⚠ Not Yet Eligible</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
                      {notYetEligibleReps.map((rep) => {
                        const perf = getRepPerformance(rep.id);
                        const need = commissionRates.quotas.bonus_eligibility - perf.total;
                        return <span key={rep.id} style={{ fontSize: 13 }}><strong>{rep.name}:</strong> {perf.total}/{commissionRates.quotas.bonus_eligibility} (need {need} more)</span>;
                      })}
                    </div>
                  </div>
                )}
              </Card>

              {/* POOL PROJECTIONS CALCULATOR */}
              <Card title="📈 Pool Projections Calculator" style={{ marginBottom: 24 }}>
                <div style={{ padding: 16, background: COLORS.darkBg, borderRadius: 12 }}>
                  <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 16 }}>
                    See how additional signups affect the bonus pool and per-rep payout.
                  </div>
                  {(() => {
                    const currentPool = bonusPool?.total_pool_cents || 0;
                    const avgBasicContrib = 500; // $5 per basic signup
                    const avgPremiumContrib = 2000; // $20 per premium signup
                    const projections = [10, 25, 50, 100].map(additionalSignups => {
                      const estimatedContrib = additionalSignups * ((avgBasicContrib + avgPremiumContrib) / 2);
                      const newPool = currentPool + estimatedContrib;
                      const newPerRep = eligibleReps.length > 0 ? newPool / eligibleReps.length : 0;
                      return { signups: additionalSignups, newPool, newPerRep };
                    });

                    return (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                        {projections.map((proj, i) => (
                          <div key={i} style={{ padding: 16, background: COLORS.cardBg, borderRadius: 12, border: "1px solid " + COLORS.cardBorder, textAlign: "center" }}>
                            <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 8 }}>+{proj.signups} More Signups</div>
                            <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.neonPurple, marginBottom: 4 }}>{formatMoney(proj.newPool)}</div>
                            <div style={{ fontSize: 11, color: COLORS.textSecondary }}>Pool Total</div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.neonGreen, marginTop: 8 }}>{formatMoney(proj.newPerRep)}</div>
                            <div style={{ fontSize: 10, color: COLORS.textSecondary }}>Per Rep</div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </Card>

              {/* INDIVIDUAL REP CONTRIBUTIONS */}
              <Card title="💰 Individual Rep Contributions to Pool" style={{ marginBottom: 24 }}>
                {(() => {
                  const repContributions = actualSalesReps.map(rep => {
                    const repSignups = filteredSignups.filter(s => s.rep_id === rep.id);
                    const contribution = repSignups.reduce((sum, s) => sum + (s.pool_contribution_cents || 0), 0);
                    return { rep, contribution, signups: repSignups.length };
                  }).filter(rc => rc.contribution > 0).sort((a, b) => b.contribution - a.contribution);

                  if (repContributions.length === 0) {
                    return <div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary }}>No contributions yet this period</div>;
                  }

                  const totalContributions = repContributions.reduce((sum, rc) => sum + rc.contribution, 0);

                  return (
                    <div style={{ display: "grid", gap: 12 }}>
                      {repContributions.slice(0, 10).map((rc, i) => {
                        const percentage = totalContributions > 0 ? ((rc.contribution / totalContributions) * 100).toFixed(1) : "0";
                        return (
                          <div key={rc.rep.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: 16, background: COLORS.darkBg, borderRadius: 12 }}>
                            <div style={{ fontSize: 20, fontWeight: 800, color: i === 0 ? COLORS.neonGreen : i === 1 ? COLORS.neonBlue : i === 2 ? COLORS.neonOrange : COLORS.textSecondary }}>#{i + 1}</div>
                            <Avatar name={rc.rep.name} initials={rc.rep.avatar} />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 700 }}>{rc.rep.name}</div>
                              <div style={{ fontSize: 11, color: COLORS.textSecondary }}>{rc.signups} signups</div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.neonPurple }}>{formatMoney(rc.contribution)}</div>
                              <div style={{ fontSize: 11, color: COLORS.textSecondary }}>{percentage}% of pool</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </Card>

              {/* REPEAT CUSTOMER POOL CONTRIBUTIONS - with Original Signup date */}
              <Card title="🔄 Repeat Customer Pool Contributions" style={{ marginBottom: 24 }}>
                {repeatCustomers.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary }}>No repeat customers yet</div> : (
                  <DataTable columns={[
                    { key: "business_name", label: "Business" },
                    { key: "original_rep_id", label: "Signed By", render: (v: unknown) => salesReps.find((r) => r.id === String(v))?.name || "?" },
                    { key: "original_signup_date", label: "Original Signup", render: (v: unknown) => formatDate(String(v)) },
                    { key: "repeat_months", label: "Active Months", render: (v: unknown) => `${v} months` },
                    { key: "pool_contribution_cents", label: "Pool Contribution", render: (v: unknown) => <span style={{ color: COLORS.neonOrange, fontWeight: 700 }}>+{formatMoney(Number(v))}/mo</span> },
                  ]} data={repeatCustomers} />
                )}
              </Card>

              {/* PREVIOUS QUARTERS */}
              <Card title="📊 Previous Quarters">
                {previousPools.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary }}>No previous quarters</div> : (
                  <DataTable columns={[
                    { key: "quarter", label: "Quarter" },
                    { key: "total_pool_cents", label: "Total Pool", render: (v: unknown) => <span style={{ fontWeight: 700 }}>{formatMoney(Number(v))}</span> },
                    { key: "eligible_rep_ids", label: "Eligible Reps", render: (v: unknown) => ((v as string[]) || []).length || 0 },
                    { key: "projected_per_rep_cents", label: "Per-Rep Payout", render: (v: unknown) => <span style={{ color: COLORS.neonGreen, fontWeight: 700 }}>{formatMoney(Number(v))}</span> },
                    { key: "status", label: "Status", render: (v: unknown) => <Badge status={String(v)} /> },
                  ]} data={previousPools} />
                )}
              </Card>

              {/* HISTORICAL QUARTER COMPARISON */}
              {previousPools.length > 0 && (
                <Card title="📊 Quarter-over-Quarter Comparison" style={{ marginBottom: 24 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
                    {[bonusPool, ...previousPools.slice(0, 3)].filter(Boolean).map((pool, i) => {
                      const prevPool = i < 3 ? [bonusPool, ...previousPools][i + 1] : null;
                      const poolChange = prevPool ? ((pool!.total_pool_cents - prevPool.total_pool_cents) / prevPool.total_pool_cents) * 100 : 0;
                      const eligibleChange = prevPool && prevPool.eligible_rep_ids ? ((pool!.eligible_rep_ids?.length || 0) - prevPool.eligible_rep_ids.length) : 0;

                      return (
                        <div key={pool!.quarter} style={{ padding: 16, background: i === 0 ? "rgba(138,43,226,0.1)" : COLORS.darkBg, borderRadius: 12, border: i === 0 ? "2px solid " + COLORS.neonPurple : "1px solid " + COLORS.cardBorder }}>
                          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{pool!.quarter}</div>
                          {i === 0 && <div style={{ fontSize: 10, color: COLORS.neonPurple, fontWeight: 600, marginBottom: 8 }}>CURRENT</div>}
                          <div style={{ fontSize: 24, fontWeight: 800, color: i === 0 ? COLORS.neonPurple : COLORS.textPrimary, marginBottom: 8 }}>{formatMoney(pool!.total_pool_cents)}</div>
                          {prevPool && (
                            <div style={{ fontSize: 11, color: poolChange >= 0 ? COLORS.neonGreen : COLORS.neonRed, fontWeight: 600 }}>
                              {poolChange >= 0 ? "↑" : "↓"} {Math.abs(poolChange).toFixed(1)}% vs prev
                            </div>
                          )}
                          <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 8 }}>
                            {pool!.eligible_rep_ids?.length || 0} eligible reps
                            {prevPool && eligibleChange !== 0 && (
                              <span style={{ color: eligibleChange > 0 ? COLORS.neonGreen : COLORS.neonRed }}> ({eligibleChange > 0 ? "+" : ""}{eligibleChange})</span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: COLORS.textSecondary }}>
                            {formatMoney(pool!.projected_per_rep_cents || 0)} per rep
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}
            </>
          )}

          {/* QUOTAS TAB - with individual/team/zone controls */}
          {salesTab === "quotas" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
                <Card title="🎯 Quota Settings" actions={<div style={{ display: "flex", gap: 8 }}><button onClick={() => setShowEditRatesModal(true)} style={{ padding: "6px 12px", background: COLORS.gradient1, border: "none", borderRadius: 6, color: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Edit Defaults</button><button onClick={() => setShowEditQuotaModal(true)} style={{ padding: "6px 12px", background: COLORS.gradient2, border: "none", borderRadius: 6, color: "#000", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>+ Override</button></div>}>
                  {[{ label: "Default Individual Monthly", value: commissionRates.quotas.individual_monthly, color: COLORS.neonBlue }, { label: "Bonus Eligibility Threshold", value: `${commissionRates.quotas.bonus_eligibility}+`, color: COLORS.neonGreen }, { label: "Default Team Monthly", value: commissionRates.quotas.team_monthly, color: COLORS.neonPurple }].map((item) => (
                    <div key={item.label} style={{ padding: 16, background: COLORS.darkBg, borderRadius: 12, marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontSize: 14, fontWeight: 600 }}>{item.label}</span><span style={{ fontSize: 28, fontWeight: 800, color: item.color }}>{item.value}</span></div>
                    </div>
                  ))}
                </Card>
                <Card title="📊 Current Progress">
                  {actualSalesReps.slice(0, 5).map((rep) => {
                    const perf = getRepPerformance(rep.id);
                    const quota = rep.individual_quota || commissionRates.quotas.individual_monthly;
                    const pct = (perf.total / quota) * 100;
                    const isEligible = perf.total >= commissionRates.quotas.bonus_eligibility;
                    return (
                      <div key={rep.id} style={{ padding: 12, background: COLORS.darkBg, borderRadius: 10, marginBottom: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Avatar name={rep.name} initials={rep.avatar} /><span style={{ fontWeight: 600, fontSize: 13 }}>{rep.name}</span></div>
                          <div><span style={{ fontSize: 16, fontWeight: 800, color: pct >= 100 ? COLORS.neonGreen : pct >= 50 ? COLORS.neonYellow : COLORS.neonOrange }}>{perf.total}</span><span style={{ color: COLORS.textSecondary, fontSize: 11 }}> / {quota}</span></div>
                        </div>
                        <ProgressBar value={perf.total} max={quota} color={pct >= 100 ? COLORS.neonGreen : pct >= 50 ? COLORS.neonYellow : COLORS.neonOrange} height={6} />
                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 10 }}><span style={{ color: isEligible ? COLORS.neonGreen : COLORS.textSecondary }}>{isEligible ? "✓ Bonus eligible" : `Need ${commissionRates.quotas.bonus_eligibility - perf.total} for bonus`}</span><span style={{ color: COLORS.textSecondary }}>{pct.toFixed(0)}%</span></div>
                      </div>
                    );
                  })}
                </Card>
              </div>

              {/* Zone Quotas */}
              <Card title="📍 Zone Quotas" style={{ marginBottom: 24 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                  {zones.map((zone) => {
                    const zoneSignups = filteredSignups.filter(s => s.zone_id === zone.id).length;
                    const pct = (zoneSignups / zone.goal) * 100;
                    return (
                      <div key={zone.id} style={{ padding: 16, background: COLORS.darkBg, borderRadius: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><span style={{ fontWeight: 600 }}>{zone.name}</span><span style={{ fontSize: 20, fontWeight: 800, color: pct >= 100 ? COLORS.neonGreen : pct >= 50 ? COLORS.neonYellow : COLORS.neonOrange }}>{zoneSignups}</span></div>
                        <ProgressBar value={zoneSignups} max={zone.goal} color={pct >= 100 ? COLORS.neonGreen : pct >= 50 ? COLORS.neonYellow : COLORS.neonOrange} height={6} />
                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 10, color: COLORS.textSecondary }}><span>{pct.toFixed(0)}% of target</span><span>Goal: {zone.goal}</span></div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* Quota Overrides */}
              {quotaOverrides.length > 0 && (
                <Card title="📝 Active Quota Overrides">
                  <DataTable columns={[
                    { key: "target_type", label: "Type", render: (v: unknown) => <span style={{ textTransform: "capitalize" }}>{String(v)}</span> },
                    { key: "target_id", label: "Target", render: (v: unknown, row: Record<string, unknown>) => { const o = row as unknown as QuotaOverride; if (o.target_type === "individual" || o.target_type === "team") return salesReps.find(r => r.id === String(v))?.name || String(v); if (o.target_type === "zone") return zones.find(z => z.id === String(v))?.name || String(v); if (o.target_type === "division") return divisions.find(d => d.id === String(v))?.name || String(v); return String(v); } },
                    { key: "quota", label: "Quota", render: (v: unknown) => <span style={{ fontWeight: 700 }}>{String(v)}</span> },
                    { key: "period", label: "Period" },
                  ]} data={quotaOverrides} />
                </Card>
              )}
            </>
          )}

          {/* HISTORY TAB */}
          {salesTab === "history" && (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
                {[{ key: "all", label: "All History" }, { key: "commissions", label: "💵 Commissions" }, { key: "bonuses", label: "🏆 Bonuses" }, { key: "adjustments", label: "📝 Adjustments" }, { key: "rep", label: "👤 By Sales Rep" }].map((f) => (
                  <button key={f.key} onClick={() => { setHistoryFilter(f.key); if (f.key !== "rep") setHistoryRepFilter("all"); }} style={{ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", background: historyFilter === f.key ? COLORS.gradient1 : COLORS.cardBg, color: historyFilter === f.key ? "#fff" : COLORS.textSecondary, fontSize: 12, fontWeight: 600 }}>{f.label}</button>
                ))}
                {historyFilter === "rep" && (
                  <div style={{ minWidth: 200 }}>
                    <SearchableSelect
                      value={historyRepFilter}
                      onChange={setHistoryRepFilter}
                      options={actualSalesReps.map((r) => ({ value: r.id, label: r.name, sub: r.email }))}
                      placeholder="All Reps"
                      searchPlaceholder="Search reps..."
                    />
                  </div>
                )}
              </div>
              <Card title="📜 Payout History">
                {payoutHistory.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary }}>No payout history yet</div> : (
                  <DataTable columns={[
                    { key: "type", label: "Type", render: (v: unknown) => <Badge status={v === "commission" ? "active" : v === "bonus" ? "premium" : "pending"} /> },
                    { key: "rep_name", label: "Sales Rep" },
                    { key: "period", label: "Period" },
                    { key: "amount_cents", label: "Amount", render: (v: unknown) => <span style={{ color: Number(v) >= 0 ? COLORS.neonGreen : COLORS.neonRed, fontWeight: 700 }}>{Number(v) >= 0 ? "+" : ""}{formatMoney(Number(v))}</span> },
                    { key: "id", label: "Details", render: (_: unknown, row: Record<string, unknown>) => { const h = row as unknown as PayoutHistory; if (h.type === "commission") return <span style={{ fontSize: 11, color: COLORS.textSecondary }}>{h.basic_count || 0}B + {h.premium_count || 0}P + {formatMoney(h.ad_commission_cents || 0)} ads</span>; if (h.type === "bonus") return <span style={{ fontSize: 11, color: COLORS.textSecondary }}>Pool share: {h.pool_share || "?"}</span>; return <span style={{ fontSize: 11, color: COLORS.textSecondary }}>{h.notes || ""}</span>; } },
                    { key: "paid_at", label: "Paid", render: (v: unknown) => v ? formatDate(String(v)) : "—" },
                    { key: "status", label: "Status", render: (v: unknown) => <Badge status={String(v)} /> },
                  ]} data={payoutHistory.filter((h) => {
                    // Type filter
                    const typeMatch = historyFilter === "all" || historyFilter === "rep" ||
                      (historyFilter === "commissions" && h.type === "commission") ||
                      (historyFilter === "bonuses" && h.type === "bonus") ||
                      (historyFilter === "adjustments" && h.type === "adjustment");

                    // Rep filter (only when "By Sales Rep" is selected)
                    const repMatch = historyFilter !== "rep" || historyRepFilter === "all" || h.rep_id === historyRepFilter;

                    return typeMatch && repMatch;
                  })} />
                )}
              </Card>
              <Card title="📊 Summary by Rep" style={{ marginTop: 24 }}>
                <DataTable columns={[
                  { key: "name", label: "Sales Rep" },
                  { key: "totalCommissions", label: "Total Commissions", render: (v: unknown) => <span style={{ color: COLORS.neonGreen, fontWeight: 700 }}>{formatMoney(Number(v))}</span> },
                  { key: "totalBonuses", label: "Total Bonuses", render: (v: unknown) => <span style={{ color: COLORS.neonPurple, fontWeight: 700 }}>{formatMoney(Number(v))}</span> },
                  { key: "adjustments", label: "Adjustments", render: (v: unknown) => <span style={{ color: Number(v) >= 0 ? COLORS.neonGreen : COLORS.neonRed }}>{Number(v) >= 0 ? "+" : ""}{formatMoney(Number(v))}</span> },
                  { key: "totalPaid", label: "Total Paid", render: (v: unknown) => <span style={{ fontWeight: 800 }}>{formatMoney(Number(v))}</span> },
                ]} data={actualSalesReps.map((rep) => { const paid = payoutHistory.filter((p) => p.rep_id === rep.id && p.status === "paid"); return { name: rep.name, totalCommissions: paid.filter((p) => p.type === "commission").reduce((a, p) => a + p.amount_cents, 0), totalBonuses: paid.filter((p) => p.type === "bonus").reduce((a, p) => a + p.amount_cents, 0), adjustments: paid.filter((p) => p.type === "adjustment").reduce((a, p) => a + p.amount_cents, 0), totalPaid: paid.reduce((a, p) => a + p.amount_cents, 0) }; })} />
              </Card>
            </>
          )}

          {/* PAYOUTS TAB */}
          {salesTab === "payouts" && (
            <>
              {/* Summary Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
                <Card><div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase" }}>Period 1 ({currentMonthName} 1-15)</div><div style={{ fontSize: 28, fontWeight: 800, color: COLORS.neonGreen }}>{formatMoney(period1Signups.reduce((a, s) => a + s.commission_cents, 0))}</div><div style={{ fontSize: 12, color: COLORS.textSecondary }}>Due: {currentMonthName} 20, {currentYear}</div></Card>
                <Card><div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase" }}>Period 2 ({currentMonthName} 16-{currentMonth === 2 ? 28 : 31})</div><div style={{ fontSize: 28, fontWeight: 800, color: COLORS.neonBlue }}>{formatMoney(period2Signups.reduce((a, s) => a + s.commission_cents, 0))}</div><div style={{ fontSize: 12, color: COLORS.textSecondary }}>Due: {monthNames[currentMonth % 12]} 5, {currentMonth === 12 ? currentYear + 1 : currentYear}</div></Card>
                <Card><div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase" }}>Next Bonus Payout</div><div style={{ fontSize: 28, fontWeight: 800, color: COLORS.neonPurple }}>{formatMoney(bonusPool?.total_pool_cents || 0)}</div><div style={{ fontSize: 12, color: COLORS.textSecondary }}>Q1 end: April 1</div></Card>
                <Card><div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase" }}>YTD Total Paid</div><div style={{ fontSize: 28, fontWeight: 800, color: COLORS.neonOrange }}>{formatMoney(ytdPaid)}</div><div style={{ fontSize: 12, color: COLORS.textSecondary }}>Commissions + Bonuses</div></Card>
              </div>

              {/* Filters */}
              <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                {/* Period Filter */}
                <div style={{ display: "flex", gap: 8 }}>
                  {[{ key: "all", label: "All Periods" }, { key: "period1", label: `📅 Period 1 (${currentMonthName} 1-15)` }, { key: "period2", label: `📅 Period 2 (${currentMonthName} 16-${currentMonth === 2 ? 28 : 31})` }].map((f) => (
                    <button key={f.key} onClick={() => setPayoutPeriodFilter(f.key)} style={{ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", background: payoutPeriodFilter === f.key ? COLORS.gradient1 : COLORS.cardBg, color: payoutPeriodFilter === f.key ? "#fff" : COLORS.textSecondary, fontSize: 12, fontWeight: 600 }}>{f.label}</button>
                  ))}
                </div>

                {/* Status Filter */}
                <div style={{ display: "flex", gap: 8 }}>
                  {[{ key: "all", label: "All Status" }, { key: "pending", label: "⏳ Pending" }, { key: "paid", label: "✅ Paid" }].map((f) => (
                    <button key={f.key} onClick={() => setPayoutStatusFilter(f.key)} style={{ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", background: payoutStatusFilter === f.key ? COLORS.gradient2 : COLORS.cardBg, color: payoutStatusFilter === f.key ? "#000" : COLORS.textSecondary, fontSize: 12, fontWeight: 600 }}>{f.label}</button>
                  ))}
                </div>

                {/* Date Range Filter */}
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <label style={{ fontSize: 12, color: COLORS.textSecondary }}>From:</label>
                  <input
                    type="date"
                    value={payoutDateFilter.from}
                    onChange={(e) => setPayoutDateFilter({ ...payoutDateFilter, from: e.target.value })}
                    style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid " + COLORS.cardBorder, background: COLORS.cardBg, color: COLORS.textPrimary, fontSize: 12 }}
                  />
                  <label style={{ fontSize: 12, color: COLORS.textSecondary }}>To:</label>
                  <input
                    type="date"
                    value={payoutDateFilter.to}
                    onChange={(e) => setPayoutDateFilter({ ...payoutDateFilter, to: e.target.value })}
                    style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid " + COLORS.cardBorder, background: COLORS.cardBg, color: COLORS.textPrimary, fontSize: 12 }}
                  />
                  {(payoutDateFilter.from || payoutDateFilter.to) && (
                    <button
                      onClick={() => setPayoutDateFilter({ from: "", to: "" })}
                      style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textSecondary, fontSize: 11, cursor: "pointer" }}
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Export Button */}
                <button
                  onClick={exportPayoutsToCSV}
                  style={{ padding: "8px 16px", background: COLORS.gradient2, border: "none", borderRadius: 8, color: "#000", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                >
                  📊 Export Payouts
                </button>
              </div>

              {/* Per-Rep Payout Cards */}
              {actualSalesReps.map((rep) => {
                // Filter signups by date range
                let filteredP1 = period1Signups.filter((s) => s.rep_id === rep.id);
                let filteredP2 = period2Signups.filter((s) => s.rep_id === rep.id);

                // Apply date range filter
                if (payoutDateFilter.from) {
                  const fromDate = new Date(payoutDateFilter.from);
                  filteredP1 = filteredP1.filter(s => new Date(s.signed_at) >= fromDate);
                  filteredP2 = filteredP2.filter(s => new Date(s.signed_at) >= fromDate);
                }
                if (payoutDateFilter.to) {
                  const toDate = new Date(payoutDateFilter.to);
                  toDate.setHours(23, 59, 59, 999);
                  filteredP1 = filteredP1.filter(s => new Date(s.signed_at) <= toDate);
                  filteredP2 = filteredP2.filter(s => new Date(s.signed_at) <= toDate);
                }

                const repP1 = filteredP1;
                const repP2 = filteredP2;

                const calcStats = (sales: SalesSignup[]) => ({
                  basic: sales.filter((s) => s.plan === "basic").length,
                  premium: sales.filter((s) => s.plan === "premium").length,
                  adSpend: sales.reduce((a, s) => a + (s.ad_spend_cents || 0), 0),
                  total: sales.reduce((a, s) => a + (s.commission_cents || 0), 0),
                  poolContrib: sales.reduce((a, s) => a + (s.pool_contribution_cents || 0), 0),
                });

                const p1Stats = calcStats(repP1);
                const p2Stats = calcStats(repP2);
                const isPeriod1Paid = paidCommissions[rep.id]?.period1;
                const isPeriod2Paid = paidCommissions[rep.id]?.period2;

                // Apply period filter
                if (payoutPeriodFilter === "period1" && repP1.length === 0) return null;
                if (payoutPeriodFilter === "period2" && repP2.length === 0) return null;
                if (repP1.length === 0 && repP2.length === 0) return null;

                // Apply status filter
                if (payoutStatusFilter === "paid") {
                  if (payoutPeriodFilter === "period1" && !isPeriod1Paid) return null;
                  if (payoutPeriodFilter === "period2" && !isPeriod2Paid) return null;
                  if (payoutPeriodFilter === "all" && !isPeriod1Paid && !isPeriod2Paid) return null;
                }
                if (payoutStatusFilter === "pending") {
                  if (payoutPeriodFilter === "period1" && isPeriod1Paid) return null;
                  if (payoutPeriodFilter === "period2" && isPeriod2Paid) return null;
                  if (payoutPeriodFilter === "all" && isPeriod1Paid && isPeriod2Paid) return null;
                }

                return (
                  <Card key={rep.id} style={{ marginBottom: 20 }} title={<div style={{ display: "flex", alignItems: "center", gap: 12 }}><Avatar name={rep.name} initials={rep.avatar} /><div><div style={{ fontWeight: 700 }}>{rep.name}</div><div style={{ fontSize: 11, color: COLORS.textSecondary }}>{rep.email}</div></div></div>} actions={<div style={{ display: "flex", gap: 8 }}><span style={{ fontSize: 20, fontWeight: 800, color: COLORS.neonGreen }}>{formatMoney(p1Stats.total + p2Stats.total)}</span><span style={{ fontSize: 12, color: COLORS.textSecondary, alignSelf: "center" }}>total</span></div>}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                      {/* Period 1 */}
                      {(payoutPeriodFilter === "all" || payoutPeriodFilter === "period1") && (
                        <div style={{ padding: 20, background: isPeriod1Paid ? "rgba(57,255,20,0.05)" : COLORS.darkBg, borderRadius: 12, border: isPeriod1Paid ? "1px solid " + COLORS.neonGreen : "1px solid " + COLORS.cardBorder }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                            <div><div style={{ fontSize: 14, fontWeight: 700 }}>Period 1: {currentMonthName} 1-15</div><div style={{ fontSize: 11, color: COLORS.textSecondary }}>Due: {currentMonthName} 20, {currentYear}</div></div>
                            <Badge status={isPeriod1Paid ? "paid" : "pending"} />
                          </div>
                          <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "8px 0", borderBottom: "1px solid " + COLORS.cardBorder }}><span>Basic Signups ({p1Stats.basic})</span><span>{p1Stats.basic} × $25 = <strong style={{ color: COLORS.neonGreen }}>${p1Stats.basic * 25}</strong></span></div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "8px 0", borderBottom: "1px solid " + COLORS.cardBorder }}><span>Premium Signups ({p1Stats.premium})</span><span>{p1Stats.premium} × $100 = <strong style={{ color: COLORS.neonGreen }}>${p1Stats.premium * 100}</strong></span></div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "8px 0", borderBottom: "1px solid " + COLORS.cardBorder }}><span>Ad Spend Sold ({formatMoney(p1Stats.adSpend)})</span><span>{formatMoney(p1Stats.adSpend)} ÷ 100 × $10 = <strong style={{ color: COLORS.neonGreen }}>${Math.floor(p1Stats.adSpend / 10000) * 10}</strong></span></div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: 12, fontWeight: 700, background: COLORS.cardBg, borderRadius: 8 }}><span>Period 1 Total</span><span style={{ color: COLORS.neonGreen, fontSize: 18 }}>{formatMoney(p1Stats.total)}</span></div>
                          </div>
                          <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, fontWeight: 600 }}>ITEMIZED SALES ({repP1.length})</div>
                            <div style={{ maxHeight: 150, overflowY: "auto" }}>
                              {repP1.map((sale) => (
                                <div key={sale.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid " + COLORS.cardBorder, fontSize: 12 }}>
                                  <div><div style={{ fontWeight: 600 }}>{sale.business_name}</div><div style={{ color: COLORS.textSecondary, fontSize: 10 }}>{formatDate(sale.signed_at)} • {sale.city || "?"}, {sale.state || "?"}</div></div>
                                  <div style={{ textAlign: "right" }}><Badge status={sale.plan} /><div style={{ color: COLORS.neonGreen, fontSize: 11, marginTop: 2 }}>+{formatMoney(sale.commission_cents)}</div></div>
                                </div>
                              ))}
                              {repP1.length === 0 && <div style={{ color: COLORS.textSecondary, fontSize: 12, padding: 8 }}>No sales this period</div>}
                            </div>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ fontSize: 11, color: COLORS.neonPurple }}>Pool contrib: +{formatMoney(p1Stats.poolContrib)}</div>
                            {isPeriod1Paid ? (
                              <button onClick={() => setPaidCommissions({ ...paidCommissions, [rep.id]: { ...paidCommissions[rep.id], period1: false } })} style={{ padding: "8px 16px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textSecondary, cursor: "pointer", fontSize: 11 }}>Undo</button>
                            ) : (
                              <button onClick={() => setPaidCommissions({ ...paidCommissions, [rep.id]: { ...paidCommissions[rep.id], period1: true } })} style={{ padding: "8px 16px", background: COLORS.gradient2, border: "none", borderRadius: 8, color: "#000", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Mark Paid {formatMoney(p1Stats.total)}</button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Period 2 */}
                      {(payoutPeriodFilter === "all" || payoutPeriodFilter === "period2") && (
                        <div style={{ padding: 20, background: isPeriod2Paid ? "rgba(57,255,20,0.05)" : COLORS.darkBg, borderRadius: 12, border: isPeriod2Paid ? "1px solid " + COLORS.neonGreen : "1px solid " + COLORS.cardBorder }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                            <div><div style={{ fontSize: 14, fontWeight: 700 }}>Period 2: {currentMonthName} 16-{currentMonth === 2 ? 28 : 31}</div><div style={{ fontSize: 11, color: COLORS.textSecondary }}>Due: {monthNames[currentMonth % 12]} 5, {currentMonth === 12 ? currentYear + 1 : currentYear}</div></div>
                            <Badge status={isPeriod2Paid ? "paid" : "pending"} />
                          </div>
                          <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "8px 0", borderBottom: "1px solid " + COLORS.cardBorder }}><span>Basic Signups ({p2Stats.basic})</span><span>{p2Stats.basic} × $25 = <strong style={{ color: COLORS.neonGreen }}>${p2Stats.basic * 25}</strong></span></div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "8px 0", borderBottom: "1px solid " + COLORS.cardBorder }}><span>Premium Signups ({p2Stats.premium})</span><span>{p2Stats.premium} × $100 = <strong style={{ color: COLORS.neonGreen }}>${p2Stats.premium * 100}</strong></span></div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "8px 0", borderBottom: "1px solid " + COLORS.cardBorder }}><span>Ad Spend Sold ({formatMoney(p2Stats.adSpend)})</span><span>{formatMoney(p2Stats.adSpend)} ÷ 100 × $10 = <strong style={{ color: COLORS.neonGreen }}>${Math.floor(p2Stats.adSpend / 10000) * 10}</strong></span></div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: 12, fontWeight: 700, background: COLORS.cardBg, borderRadius: 8 }}><span>Period 2 Total</span><span style={{ color: COLORS.neonGreen, fontSize: 18 }}>{formatMoney(p2Stats.total)}</span></div>
                          </div>
                          <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, fontWeight: 600 }}>ITEMIZED SALES ({repP2.length})</div>
                            <div style={{ maxHeight: 150, overflowY: "auto" }}>
                              {repP2.map((sale) => (
                                <div key={sale.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid " + COLORS.cardBorder, fontSize: 12 }}>
                                  <div><div style={{ fontWeight: 600 }}>{sale.business_name}</div><div style={{ color: COLORS.textSecondary, fontSize: 10 }}>{formatDate(sale.signed_at)} • {sale.city || "?"}, {sale.state || "?"}</div></div>
                                  <div style={{ textAlign: "right" }}><Badge status={sale.plan} /><div style={{ color: COLORS.neonGreen, fontSize: 11, marginTop: 2 }}>+{formatMoney(sale.commission_cents)}</div></div>
                                </div>
                              ))}
                              {repP2.length === 0 && <div style={{ color: COLORS.textSecondary, fontSize: 12, padding: 8 }}>No sales this period</div>}
                            </div>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ fontSize: 11, color: COLORS.neonPurple }}>Pool contrib: +{formatMoney(p2Stats.poolContrib)}</div>
                            {isPeriod2Paid ? (
                              <button onClick={() => setPaidCommissions({ ...paidCommissions, [rep.id]: { ...paidCommissions[rep.id], period2: false } })} style={{ padding: "8px 16px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textSecondary, cursor: "pointer", fontSize: 11 }}>Undo</button>
                            ) : (
                              <button onClick={() => setPaidCommissions({ ...paidCommissions, [rep.id]: { ...paidCommissions[rep.id], period2: true } })} style={{ padding: "8px 16px", background: COLORS.gradient2, border: "none", borderRadius: 8, color: "#000", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Mark Paid {formatMoney(p2Stats.total)}</button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}

              {actualSalesReps.filter(rep => period1Signups.some(s => s.rep_id === rep.id) || period2Signups.some(s => s.rep_id === rep.id)).length === 0 && (
                <div style={{ padding: 60, textAlign: "center", color: COLORS.textSecondary }}>No signups in this period</div>
              )}

              {/* Quarterly Bonus Section */}
              <Card title="🏆 Quarterly Bonus Payout" style={{ marginTop: 24 }} actions={
                <div style={{ display: "flex", gap: 8 }}>
                  {paidBonusQuarters.includes(bonusPool?.quarter || "Q1 2026") ? (
                    <button onClick={() => handleUndoBonusPayout(bonusPool?.quarter || "Q1 2026")} style={{ padding: "8px 16px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textSecondary, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Undo Payment</button>
                  ) : (
                    <button onClick={() => handleMarkBonusPaid(bonusPool?.quarter || "Q1 2026")} style={{ padding: "8px 16px", background: COLORS.gradient1, border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Pay {bonusPool?.quarter || "Q1"} Bonus</button>
                  )}
                </div>
              }>
                <DataTable columns={[
                  { key: "quarter", label: "Quarter" },
                  { key: "totalPool", label: "Pool Size", render: (v: unknown) => formatMoney(Number(v)) },
                  { key: "eligibleReps", label: "Eligible Reps" },
                  { key: "perRepPayout", label: "Per Rep", render: (v: unknown) => <span style={{ color: COLORS.neonPurple, fontWeight: 700 }}>{formatMoney(Number(v))}</span> },
                  { key: "quarter", label: "Status", render: (v: unknown) => <Badge status={paidBonusQuarters.includes(String(v)) ? "paid" : "active"} /> },
                  { key: "quarter", label: "", render: (v: unknown) => {
                    const quarter = String(v);
                    const poolData = quarter === bonusPool?.quarter ? bonusPool : previousPools.find(p => p.quarter === quarter);
                    return poolData ? (
                      <button onClick={() => handleShowBonusDetails(poolData)} style={{ padding: "6px 12px", background: COLORS.gradient2, border: "none", borderRadius: 6, color: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Details</button>
                    ) : null;
                  }},
                ]} data={[{ quarter: bonusPool?.quarter || "Q1 2026", totalPool: bonusPool?.total_pool_cents || 0, eligibleReps: eligibleReps.length, perRepPayout: bonusPool?.projected_per_rep_cents || 0 }, ...previousPools.map(p => ({ quarter: p.quarter, totalPool: p.total_pool_cents, eligibleReps: p.eligible_rep_ids?.length || 0, perRepPayout: p.projected_per_rep_cents }))]} />
              </Card>
            </>
          )}

          {salesTab === "prospecting" && (
            <SalesProspecting
              salesReps={salesReps.filter(r => r.status === "active").map(r => ({
                id: r.id,
                name: r.name,
                zone_id: r.zone_id,
                status: r.status,
              }))}
            />
          )}
        </>
      )}
    </div>
  );
}