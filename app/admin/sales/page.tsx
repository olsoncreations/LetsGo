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
  county_id: string | null;
  state: string | null;
  city: string | null;
  supervisor_id: string | null;
  hire_date: string | null;
  status: string;
  avatar: string | null;
  individual_quota: number | null;
  legal_name: string | null;
  tax_id: string | null;
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  w9_status: string | null;
}

interface SalesCounty {
  id: string;
  fips: string;
  name: string;
  state: string;
  zone_id: string | null;
  quota: number;
  created_at: string;
}

interface SalesRep1099 {
  id: string;
  rep_id: string;
  tax_year: number;
  total_earnings_cents: number;
  generated_at: string;
  generated_by: string | null;
  sent_at: string | null;
  sent_method: string | null;
  filed_with_irs: boolean;
  notes: string | null;
  created_at: string;
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

interface RoleApplication {
  id: string;
  user_id: string;
  application_type: string;
  status: string;
  full_name: string;
  email: string;
  phone: string | null;
  city: string | null;
  state: string | null;
  payload: Record<string, string | boolean | number | null>;
  review_message: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

/* ==================== HELPERS ==================== */

const ROLE_LABELS: Record<string, string> = {
  vp_smb_sales: "VP SMB Sales",
  zone_sales_director: "Zone Sales Director",
  city_sales_manager: "City Sales Manager",
  team_lead: "Team Lead",
  sales_rep: "Sales Rep",
  in_training: "In Training",
};

const formatPhone = (raw: string): string => {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

const ROLE_HIERARCHY = ["vp_smb_sales", "zone_sales_director", "city_sales_manager", "team_lead", "sales_rep", "in_training"];

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
  const [counties, setCounties] = useState<SalesCounty[]>([]);
  const [planPrices, setPlanPrices] = useState<{ basic_monthly_cents: number; premium_monthly_cents: number }>({ basic_monthly_cents: 0, premium_monthly_cents: 0 });
  const [loading, setLoading] = useState(true);

  // Ad campaign revenue (from business_ad_campaigns)
  const [adCampaignRevenue, setAdCampaignRevenue] = useState({ total: 0, surge: 0, base: 0, count: 0 });

  // UI state
  const [salesTab, setSalesTab] = useState("overview");
  const [salesPeriod, setSalesPeriod] = useState("month");
  const [poolMatrixPeriod, setPoolMatrixPeriod] = useState("month");
  const [geoBreakdownView, setGeoBreakdownView] = useState("division");
  const [quotaRollupView, setQuotaRollupView] = useState<"division" | "state" | "county">("division");
  const [quotaRollupDrill, setQuotaRollupDrill] = useState<{ type: "state" | "county" | "rep"; parentId: string; parentName: string } | null>(null);
  const [geoSummaryView, setGeoSummaryView] = useState("division");
  const [geoSearchQuery, setGeoSearchQuery] = useState("");
  // Breakdown filters
  const [stateFilterDiv, setStateFilterDiv] = useState("all");
  const [stateFilterSearch, setStateFilterSearch] = useState("");
  const [countyFilterDiv, setCountyFilterDiv] = useState("all");
  const [countyFilterState, setCountyFilterState] = useState("all");
  const [countyFilterSearch, setCountyFilterSearch] = useState("");
  const [cityFilterDiv, setCityFilterDiv] = useState("all");
  const [cityFilterState, setCityFilterState] = useState("all");
  const [cityFilterSearch, setCityFilterSearch] = useState("");
  const [supFilterDiv, setSupFilterDiv] = useState("all");
  const [supFilterSearch, setSupFilterSearch] = useState("");
  const [supCollapsed, setSupCollapsed] = useState<Set<string>>(new Set());
  const [selectedRep, setSelectedRep] = useState<SalesRep | null>(null);
  const [signupTypeFilter, setSignupTypeFilter] = useState("all");
  const [signupSearchQuery, setSignupSearchQuery] = useState("");
  const [signupFilters, setSignupFilters] = useState({ dateFrom: "", dateTo: "", zone: "all", rep: "all", plan: "all" });
  const [historyFilter, setHistoryFilter] = useState("all");
  const [historyRepFilter, setHistoryRepFilter] = useState("all");
  const [historyDivisionFilter, setHistoryDivisionFilter] = useState("all");
  const [payoutPeriodFilter, setPayoutPeriodFilter] = useState("all");
  const [payoutStatusFilter, setPayoutStatusFilter] = useState("all");
  const [payoutDateFilter, setPayoutDateFilter] = useState({ from: "", to: "" });
  const [paidCommissions, setPaidCommissions] = useState<Record<string, { month: boolean }>>({});
  const [paidBonusQuarters, setPaidBonusQuarters] = useState<string[]>([]);
  const [showBonusDetailsModal, setShowBonusDetailsModal] = useState(false);
  const [selectedBonusQuarter, setSelectedBonusQuarter] = useState<BonusPool | null>(null);

  // Applications tab state
  const [applications, setApplications] = useState<RoleApplication[]>([]);
  const [appStatusFilter, setAppStatusFilter] = useState("all");
  const [expandedAppId, setExpandedAppId] = useState<string | null>(null);
  const [appLoading, setAppLoading] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedApp, setSelectedApp] = useState<RoleApplication | null>(null);
  const [approveData, setApproveData] = useState({ role: "sales_rep", zone_id: "", division_id: "", supervisor_id: "", state: "", county_id: "" });
  const [rejectReason, setRejectReason] = useState("");
  const [appActionLoading, setAppActionLoading] = useState(false);
  const [showEditAppModal, setShowEditAppModal] = useState(false);
  const [editAppData, setEditAppData] = useState<{ full_name: string; email: string; phone: string; city: string; state: string }>({ full_name: "", email: "", phone: "", city: "", state: "" });
  const [showDeleteAppModal, setShowDeleteAppModal] = useState(false);

  // 1099-NEC tab state
  const [nec1099s, setNec1099s] = useState<SalesRep1099[]>([]);
  const [nec1099Year, setNec1099Year] = useState(new Date().getFullYear());
  const [showTaxInfoModal, setShowTaxInfoModal] = useState(false);
  const [taxInfoRep, setTaxInfoRep] = useState<SalesRep | null>(null);
  const [taxInfoForm, setTaxInfoForm] = useState({ legal_name: "", tax_id: "", address_street: "", address_city: "", address_state: "", address_zip: "", w9_status: "not_requested" });
  const [taxInfoSaving, setTaxInfoSaving] = useState(false);
  const [showSentModal, setShowSentModal] = useState(false);
  const [sentMethod, setSentMethod] = useState<string>("email");
  const [sentRep, setSentRep] = useState<SalesRep | null>(null);
  const [necGenerating, setNecGenerating] = useState(false);

  // Filters
  const [salesFilters, setSalesFilters] = useState({ dateFrom: "", dateTo: "", zone: "all", state: "all", rep: "all" });

  // State name + division color lookups
  const stateNames: Record<string, string> = {
    NE: "Nebraska", IA: "Iowa", KS: "Kansas", MO: "Missouri", CO: "Colorado", WY: "Wyoming", UT: "Utah", TX: "Texas", AZ: "Arizona", NM: "New Mexico",
    FL: "Florida", GA: "Georgia", AL: "Alabama", NY: "New York", PA: "Pennsylvania", NJ: "New Jersey", CA: "California", WA: "Washington", OR: "Oregon",
    ND: "North Dakota", SD: "South Dakota", CT: "Connecticut", MA: "Massachusetts", OH: "Ohio", MN: "Minnesota", WI: "Wisconsin", IL: "Illinois",
    IN: "Indiana", MI: "Michigan", MT: "Montana", ID: "Idaho", OK: "Oklahoma", SC: "South Carolina", NC: "North Carolina", TN: "Tennessee",
    MS: "Mississippi", LA: "Louisiana", AR: "Arkansas", VA: "Virginia", MD: "Maryland", DE: "Delaware", RI: "Rhode Island", HI: "Hawaii", AK: "Alaska",
    ME: "Maine", NH: "New Hampshire", VT: "Vermont", NV: "Nevada", WV: "West Virginia", KY: "Kentucky", DC: "Washington D.C.",
  };
  const divisionColors: Record<string, string> = {
    Northeast: "#cc0000", Southeast: "#8b2fc9", Mideast: COLORS.neonBlue, Midwest: COLORS.neonOrange, West: COLORS.neonGreen,
  };

  // Modals
  const [showAddSaleModal, setShowAddSaleModal] = useState(false);
  const [showEditRatesModal, setShowEditRatesModal] = useState(false);
  const [showAddRepModal, setShowAddRepModal] = useState(false);
  const [showEditQuotaModal, setShowEditQuotaModal] = useState(false);
  const [showEditSignupModal, setShowEditSignupModal] = useState(false);
  const [editingSignup, setEditingSignup] = useState<{ id: string; type: "outbound" | "inbound"; commission_cents?: number; pool_contribution_cents?: number } | null>(null);
  const [editingRepId, setEditingRepId] = useState<string | null>(null);
  const [editRepData, setEditRepData] = useState<Partial<SalesRep> & { individual_quota_str: string }>({ individual_quota_str: "2" });

  // Form state
  const [newSale, setNewSale] = useState({ rep_id: "", business_name: "", plan: "basic", ad_spend: 0, notes: "", city: "", state: "" });
  const [businessSuggestions, setBusinessSuggestions] = useState<{ id: string; business_name: string; public_business_name: string | null }[]>([]);
  const [showBusinessSuggestions, setShowBusinessSuggestions] = useState(false);
  const [repSearchQuery, setRepSearchQuery] = useState("");
  const [newRep, setNewRep] = useState({
    name: "", email: "", phone: "", role: "sales_rep",
    division_id: "", zone_id: "", city: "", supervisor_id: "",
    hire_date: new Date().toISOString().slice(0, 10),
    state: "", county_id: ""
  });
  const [editRates, setEditRates] = useState<Record<string, number>>({});
  const [quotaEditTarget, setQuotaEditTarget] = useState<{ type: string; id: string; name: string } | null>(null);
  const [quotaEditValues, setQuotaEditValues] = useState({ monthly: 0, quarterly: 0, yearly: 0 });

  const getConfig = useCallback((key: string, type: "cents" | "int" = "cents"): number => {
    const c = config.find((cfg) => cfg.key === key);
    if (!c) {
      const defaults: Record<string, number> = { basic_signup: 2500, premium_signup: 10000, advertising_per_100: 1000, individual_monthly: 60, bonus_eligibility: 30, team_monthly: 300, rep_quota_daily: 200, rep_bonus_daily: 100, lead_quota_daily: 200, lead_bonus_daily: 100, training_quota_daily: 100, training_bonus_daily: 50, individual_daily: 200, team_daily: 1000, bonus_eligibility_daily: 100, pool_outbound_basic: 500, pool_outbound_premium: 1000, pool_inbound_basic: 100, pool_inbound_premium: 200, pool_ad_spend_per_100: 500, pool_repeat_monthly: 50 };
      return defaults[key] || 0;
    }
    return type === "cents" ? (c.value_cents || 0) : (c.value_int || 0);
  }, [config]);

  const commissionRates = useMemo(() => ({
    individual: { basic_signup: getConfig("basic_signup"), premium_signup: getConfig("premium_signup"), advertising_per_100: getConfig("advertising_per_100") },
    quotas: { individual_monthly: getConfig("individual_monthly", "int") || 60, bonus_eligibility: getConfig("bonus_eligibility", "int") || 30, team_monthly: getConfig("team_monthly", "int") || 300 },
    daily: {
      // Per-role daily quotas
      sales_rep: (getConfig("rep_quota_daily") || getConfig("individual_daily") || 200) / 100,
      team_lead: (getConfig("lead_quota_daily") || getConfig("individual_daily") || 200) / 100,
      in_training: (getConfig("training_quota_daily") || 100) / 100,
      // Per-role bonus eligibility daily thresholds
      rep_bonus: (getConfig("rep_bonus_daily") || getConfig("bonus_eligibility_daily") || 100) / 100,
      lead_bonus: (getConfig("lead_bonus_daily") || getConfig("bonus_eligibility_daily") || 100) / 100,
      training_bonus: (getConfig("training_bonus_daily") || 50) / 100,
      // Legacy keys (for backward compat)
      individual: (getConfig("rep_quota_daily") || getConfig("individual_daily") || 200) / 100,
      team: (getConfig("team_daily") || 1000) / 100,
      bonus_eligibility: (getConfig("bonus_eligibility_daily") || 100) / 100,
    },
  }), [getConfig]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [divRes, zoneRes, configRes, repsRes, signupsRes, inboundRes, historyRes, repeatRes, quotaRes, platformRes] = await Promise.all([
        supabaseBrowser.from("sales_divisions").select("*").order("name"),
        supabaseBrowser.from("sales_zones").select("*").order("name"),
        supabaseBrowser.from("sales_config").select("*"),
        supabaseBrowser.from("sales_reps").select("*").order("name"),
        supabaseBrowser.from("sales_signups").select("*").order("signed_at", { ascending: false }),
        supabaseBrowser.from("inbound_signups").select("*").order("signed_at", { ascending: false }),
        supabaseBrowser.from("sales_payout_history").select("*").order("paid_at", { ascending: false, nullsFirst: true }),
        supabaseBrowser.from("sales_repeat_customers").select("*").eq("active", true),
        supabaseBrowser.from("sales_quota_overrides").select("*"),
        supabaseBrowser.from("platform_settings").select("package_pricing").eq("id", 1).maybeSingle(),
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
      if (platformRes.data?.package_pricing) setPlanPrices(platformRes.data.package_pricing);

      // Fetch all counties in batches (Supabase default limit is 1000)
      try {
        const allCounties: SalesCounty[] = [];
        let from = 0;
        const batchSize = 1000;
        let done = false;
        while (!done) {
          const { data: batch, error: batchErr } = await supabaseBrowser
            .from("sales_counties")
            .select("id,fips,name,state,zone_id,quota,created_at")
            .order("state")
            .order("name")
            .range(from, from + batchSize - 1);
          if (batchErr) { console.error("Counties batch error:", batchErr); break; }
          if (batch && batch.length > 0) {
            allCounties.push(...batch);
            from += batchSize;
            if (batch.length < batchSize) done = true;
          } else {
            done = true;
          }
        }
        if (allCounties.length > 0) setCounties(allCounties);
      } catch (e) {
        console.error("Error fetching counties:", e);
      }

      // Get bonus pools
      const currentBonusPeriod = `${monthNames[new Date().getMonth()]} ${new Date().getFullYear()}`;
      const { data: poolData } = await supabaseBrowser.from("sales_bonus_pool").select("*").eq("quarter", currentBonusPeriod).maybeSingle();
      if (poolData) setBonusPool(poolData);

      const { data: prevPoolsData } = await supabaseBrowser.from("sales_bonus_pool").select("*").neq("quarter", currentBonusPeriod).order("quarter_start", { ascending: false }).limit(12);
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

  // Quota rollup: rep → county → state → division (live computation)
  const FIELD_ROLES = ["sales_rep", "team_lead", "in_training"];
  // Effective daily quota: override if set, otherwise role-specific global
  const getRepDailyQuota = useCallback((rep: SalesRep): number => {
    if (!FIELD_ROLES.includes(rep.role)) return 0;
    // Only team_lead and in_training can have individual overrides; sales_rep always uses global
    if ((rep.role === "team_lead" || rep.role === "in_training") && rep.individual_quota != null) return rep.individual_quota;
    if (rep.role === "team_lead") return commissionRates.daily.team_lead;
    if (rep.role === "in_training") return commissionRates.daily.in_training;
    return commissionRates.daily.sales_rep;
  }, [commissionRates.daily]);
  // Bonus eligibility daily threshold by role
  const getRepBonusDaily = useCallback((role: string): number => {
    if (role === "team_lead") return commissionRates.daily.lead_bonus;
    if (role === "in_training") return commissionRates.daily.training_bonus;
    return commissionRates.daily.rep_bonus;
  }, [commissionRates.daily]);

  const quotaRollup = useMemo(() => {
    const activeReps = salesReps.filter(r => r.status === "active" && FIELD_ROLES.includes(r.role));
    // County rollup: each rep contributes their effective daily quota
    const byCounty: Record<string, { county: SalesCounty; repCount: number; totalQuota: number; reps: SalesRep[] }> = {};
    activeReps.forEach(rep => {
      if (rep.county_id) {
        if (!byCounty[rep.county_id]) {
          const county = counties.find(c => c.id === rep.county_id);
          if (county) byCounty[rep.county_id] = { county, repCount: 0, totalQuota: 0, reps: [] };
        }
        if (byCounty[rep.county_id]) {
          byCounty[rep.county_id].repCount++;
          byCounty[rep.county_id].totalQuota += getRepDailyQuota(rep);
          byCounty[rep.county_id].reps.push(rep);
        }
      }
    });
    // State rollup: sum of county quotas per state
    const byState: Record<string, { state: string; countyCount: number; repCount: number; totalQuota: number }> = {};
    Object.values(byCounty).forEach(({ county, repCount, totalQuota }) => {
      if (!byState[county.state]) byState[county.state] = { state: county.state, countyCount: 0, repCount: 0, totalQuota: 0 };
      byState[county.state].countyCount++;
      byState[county.state].repCount += repCount;
      byState[county.state].totalQuota += totalQuota;
    });
    // Division rollup: sum of state quotas per division
    const byDivision: Record<string, { division: Division; stateCount: number; countyCount: number; repCount: number; totalQuota: number }> = {};
    zones.forEach(zone => {
      const div = divisions.find(d => d.id === zone.division_id);
      if (!div) return;
      if (!byDivision[div.id]) byDivision[div.id] = { division: div, stateCount: 0, countyCount: 0, repCount: 0, totalQuota: 0 };
      zone.states.forEach(st => {
        if (byState[st]) {
          byDivision[div.id].stateCount++;
          byDivision[div.id].countyCount += byState[st].countyCount;
          byDivision[div.id].repCount += byState[st].repCount;
          byDivision[div.id].totalQuota += byState[st].totalQuota;
        }
      });
    });
    return { byCounty, byState, byDivision };
  }, [salesReps, counties, zones, divisions, getRepDailyQuota]);

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

  // Revenue = package price + ad spend per signup
  const getSignupRevenue = useCallback((s: SalesSignup | InboundSignup) => {
    const packagePrice = s.plan === "premium" ? planPrices.premium_monthly_cents : planPrices.basic_monthly_cents;
    return packagePrice + (s.ad_spend_cents || 0);
  }, [planPrices]);
  const getRepBonusThreshold = useCallback((rep: SalesRep): number => Math.round(getRepBonusDaily(rep.role) * 30), [getRepBonusDaily]);
  const eligibleReps = actualSalesReps.filter((rep) => getRepPerformance(rep.id).total >= getRepBonusThreshold(rep));
  const notYetEligibleReps = actualSalesReps.filter((rep) => getRepPerformance(rep.id).total < getRepBonusThreshold(rep));

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

  // Auto-calculated bonus pool from current month signups + inbound
  const computedBonusPool = useMemo(() => {
    const monthInbound = inboundSignups.filter(s => {
      const d = new Date(s.signed_at);
      return d.getFullYear() === currentYear && d.getMonth() + 1 === currentMonth;
    });
    const outboundPool = monthSignups.reduce((sum, s) => {
      const planPool = s.plan === "premium" ? getConfig("pool_outbound_premium") : getConfig("pool_outbound_basic");
      const adPool = Math.floor((s.ad_spend_cents || 0) / 100) * getConfig("pool_ad_spend_per_100");
      return sum + planPool + adPool;
    }, 0);
    const inboundPool = monthInbound.reduce((sum, s) => {
      const planPool = s.plan === "premium" ? getConfig("pool_inbound_premium") : getConfig("pool_inbound_basic");
      const adPool = Math.floor((s.ad_spend_cents || 0) / 100) * getConfig("pool_ad_spend_per_100");
      return sum + planPool + adPool;
    }, 0);
    return outboundPool + inboundPool;
  }, [monthSignups, inboundSignups, currentYear, currentMonth, getConfig]);

  // Auto-calculated bonus pool breakdown (replaces DB-based bonusPool for display)
  const computedPoolData = useMemo(() => {
    const monthInbound = inboundSignups.filter(s => {
      const d = new Date(s.signed_at);
      return d.getFullYear() === currentYear && d.getMonth() + 1 === currentMonth;
    });
    const inbound_basic_cents = monthInbound.filter(s => s.plan === "basic").reduce((sum, s) => {
      return sum + (s.plan === "basic" ? getConfig("pool_inbound_basic") : 0);
    }, 0);
    const inbound_premium_cents = monthInbound.filter(s => s.plan === "premium").reduce((sum, s) => {
      return sum + (s.plan === "premium" ? getConfig("pool_inbound_premium") : 0);
    }, 0);
    const inbound_ads_cents = monthInbound.reduce((sum, s) => sum + Math.floor((s.ad_spend_cents || 0) / 100) * getConfig("pool_ad_spend_per_100"), 0);
    const rep_basic_cents = monthSignups.filter(s => s.plan === "basic").reduce((sum, s) => {
      return sum + (s.plan === "basic" ? getConfig("pool_outbound_basic") : 0);
    }, 0);
    const rep_premium_cents = monthSignups.filter(s => s.plan === "premium").reduce((sum, s) => {
      return sum + (s.plan === "premium" ? getConfig("pool_outbound_premium") : 0);
    }, 0);
    const rep_ads_cents = monthSignups.reduce((sum, s) => sum + Math.floor((s.ad_spend_cents || 0) / 100) * getConfig("pool_ad_spend_per_100"), 0);
    const total = inbound_basic_cents + inbound_premium_cents + inbound_ads_cents + rep_basic_cents + rep_premium_cents + rep_ads_cents;
    const perRep = eligibleReps.length > 0 ? Math.floor(total / eligibleReps.length) : 0;
    return {
      total_pool_cents: total,
      inbound_basic_cents, inbound_premium_cents, inbound_ads_cents,
      rep_basic_cents, rep_premium_cents, rep_ads_cents,
      repeat_customers_cents: 0,
      projected_per_rep_cents: perRep,
      eligible_rep_ids: eligibleReps.map(r => r.id),
      id: "current",
      quarter: `${currentMonthName} ${currentYear}`,
      quarter_start: `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`,
      quarter_end: `${currentYear}-${String(currentMonth).padStart(2, "0")}-${new Date(currentYear, currentMonth, 0).getDate()}`,
      status: "active",
      paid_at: null,
    };
  }, [monthSignups, inboundSignups, currentYear, currentMonth, currentMonthName, getConfig, eligibleReps]);

  const hasActiveFilters = salesFilters.dateFrom || salesFilters.dateTo || salesFilters.zone !== "all" || salesFilters.state !== "all" || salesFilters.rep !== "all";

  // Fetch sales rep applications
  const fetchApplications = useCallback(async () => {
    setAppLoading(true);
    try {
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      const url = appStatusFilter === "all"
        ? "/api/admin/applications?type=sales_rep"
        : `/api/admin/applications?type=sales_rep&status=${appStatusFilter}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setApplications(json.applications || []);
      }
    } catch (err) {
      console.error("Error fetching applications:", err);
    } finally {
      setAppLoading(false);
    }
  }, [appStatusFilter]);

  useEffect(() => {
    if (salesTab === "applications") fetchApplications();
  }, [salesTab, fetchApplications]);

  // Fetch 1099 records when tab opens or year changes
  const fetch1099s = useCallback(async () => {
    const { data } = await supabaseBrowser.from("sales_rep_1099s").select("*").eq("tax_year", nec1099Year);
    if (data) setNec1099s(data);
  }, [nec1099Year]);

  useEffect(() => {
    if (salesTab === "1099nec") fetch1099s();
  }, [salesTab, fetch1099s]);

  // Calculate annual earnings for a rep in a given calendar year (uses paid_at for IRS reporting)
  const getRepAnnualEarnings = useCallback((repId: string, year: number): number => {
    return payoutHistory
      .filter(p => p.rep_id === repId && p.status === "paid" && p.paid_at &&
        new Date(p.paid_at).getFullYear() === year)
      .reduce((sum, p) => sum + p.amount_cents, 0);
  }, [payoutHistory]);

  // 1099-NEC: save tax info
  const handleSaveTaxInfo = useCallback(async () => {
    if (!taxInfoRep) return;
    setTaxInfoSaving(true);
    try {
      const { error } = await supabaseBrowser.from("sales_reps").update({
        legal_name: taxInfoForm.legal_name || null,
        tax_id: taxInfoForm.tax_id || null,
        address_street: taxInfoForm.address_street || null,
        address_city: taxInfoForm.address_city || null,
        address_state: taxInfoForm.address_state || null,
        address_zip: taxInfoForm.address_zip || null,
        w9_status: taxInfoForm.w9_status,
      }).eq("id", taxInfoRep.id);
      if (!error) {
        logAudit({ action: "update_tax_info", tab: AUDIT_TABS.SALES, targetType: "sales_rep", targetId: taxInfoRep.id, entityName: taxInfoRep.name, details: `Tax info updated for ${taxInfoRep.name}` });
        setShowTaxInfoModal(false);
        fetchData();
      }
    } catch (err) {
      console.error("Error saving tax info:", err);
    } finally {
      setTaxInfoSaving(false);
    }
  }, [taxInfoRep, taxInfoForm, fetchData]);

  // 1099-NEC: generate XLSX for a single rep
  const handleGenerate1099 = useCallback(async (rep: SalesRep) => {
    const earnings = getRepAnnualEarnings(rep.id, nec1099Year);
    if (!rep.legal_name || !rep.tax_id || !rep.address_street || !rep.address_city || !rep.address_state || !rep.address_zip) {
      alert("Tax info is incomplete. Please edit tax info before generating.");
      return;
    }
    if (rep.w9_status !== "received") {
      alert("W-9 must be marked as received before generating a 1099-NEC.");
      return;
    }
    setNecGenerating(true);
    try {
      const maskedTaxId = rep.tax_id ? `***-**-${rep.tax_id.slice(-4)}` : "";
      const headers = ["Field", "Value"];
      const rows = [
        ["PAYER", ""],
        ["Payer Name", "OlsonCreations, LLC DBA LETS GO OUT"],
        ["", ""],
        ["RECIPIENT", ""],
        ["Recipient Name", rep.legal_name],
        ["Tax ID (SSN/EIN)", maskedTaxId],
        ["Street Address", rep.address_street],
        ["City", rep.address_city],
        ["State", rep.address_state],
        ["ZIP Code", rep.address_zip],
        ["", ""],
        ["1099-NEC DETAILS", ""],
        ["Tax Year", String(nec1099Year)],
        ["Box 1 - Nonemployee Compensation", `$${(earnings / 100).toFixed(2)}`],
      ];
      await downloadXLSX(`1099-NEC_${nec1099Year}_${rep.name.replace(/\s+/g, "_")}.xlsx`, headers, rows);

      // Upsert 1099 record
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      const existing = nec1099s.find(n => n.rep_id === rep.id);
      if (existing) {
        await supabaseBrowser.from("sales_rep_1099s").update({
          total_earnings_cents: earnings,
          generated_at: new Date().toISOString(),
          generated_by: session?.user?.email || null,
        }).eq("id", existing.id);
      } else {
        await supabaseBrowser.from("sales_rep_1099s").insert({
          rep_id: rep.id,
          tax_year: nec1099Year,
          total_earnings_cents: earnings,
          generated_by: session?.user?.email || null,
        });
      }
      logAudit({ action: "generate_1099", tab: AUDIT_TABS.SALES, targetType: "sales_rep", targetId: rep.id, entityName: rep.name, details: `1099-NEC generated for ${nec1099Year}: ${formatMoney(earnings)}` });
      fetch1099s();
    } catch (err) {
      console.error("Error generating 1099:", err);
    } finally {
      setNecGenerating(false);
    }
  }, [nec1099Year, nec1099s, getRepAnnualEarnings, fetch1099s]);

  // 1099-NEC: bulk generate XLSX (multi-sheet)
  const handleBulkGenerate1099 = useCallback(async () => {
    const eligible = salesReps.filter(r => r.status === "active" && getRepAnnualEarnings(r.id, nec1099Year) >= 60000 && r.legal_name && r.tax_id && r.address_street && r.w9_status === "received");
    if (eligible.length === 0) {
      alert("No eligible reps with complete tax info and W-9 received.");
      return;
    }
    setNecGenerating(true);
    try {
      // Load SheetJS
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let XLSX = (window as any).XLSX;
      if (!XLSX) {
        await new Promise<void>((resolve) => {
          const script = document.createElement("script");
          script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
          script.onload = () => resolve();
          document.head.appendChild(script);
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        XLSX = (window as any).XLSX;
      }
      if (!XLSX) return;
      const wb = XLSX.utils.book_new();
      const { data: { session } } = await supabaseBrowser.auth.getSession();

      for (const rep of eligible) {
        const earnings = getRepAnnualEarnings(rep.id, nec1099Year);
        const maskedTaxId = rep.tax_id ? `***-**-${rep.tax_id.slice(-4)}` : "";
        const sheetData = [
          ["Field", "Value"],
          ["PAYER", ""],
          ["Payer Name", "OlsonCreations, LLC DBA LETS GO OUT"],
          ["", ""],
          ["RECIPIENT", ""],
          ["Recipient Name", rep.legal_name],
          ["Tax ID (SSN/EIN)", maskedTaxId],
          ["Street Address", rep.address_street],
          ["City", rep.address_city],
          ["State", rep.address_state],
          ["ZIP Code", rep.address_zip],
          ["", ""],
          ["1099-NEC DETAILS", ""],
          ["Tax Year", String(nec1099Year)],
          ["Box 1 - Nonemployee Compensation", `$${(earnings / 100).toFixed(2)}`],
        ];
        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        const sheetName = rep.name.slice(0, 31).replace(/[\\/*?[\]:]/g, "");
        XLSX.utils.book_append_sheet(wb, ws, sheetName);

        // Upsert record
        const existing = nec1099s.find(n => n.rep_id === rep.id);
        if (existing) {
          await supabaseBrowser.from("sales_rep_1099s").update({
            total_earnings_cents: earnings,
            generated_at: new Date().toISOString(),
            generated_by: session?.user?.email || null,
          }).eq("id", existing.id);
        } else {
          await supabaseBrowser.from("sales_rep_1099s").insert({
            rep_id: rep.id,
            tax_year: nec1099Year,
            total_earnings_cents: earnings,
            generated_by: session?.user?.email || null,
          });
        }
      }
      XLSX.writeFile(wb, `1099-NEC_Bulk_${nec1099Year}.xlsx`);
      logAudit({ action: "bulk_generate_1099", tab: AUDIT_TABS.SALES, targetType: "sales_rep", targetId: "bulk", entityName: `${eligible.length} reps`, details: `Bulk 1099-NEC generated for ${nec1099Year}` });
      fetch1099s();
    } catch (err) {
      console.error("Error bulk generating 1099s:", err);
    } finally {
      setNecGenerating(false);
    }
  }, [salesReps, nec1099Year, nec1099s, getRepAnnualEarnings, fetch1099s]);

  // 1099-NEC: mark as sent
  const handleMarkSent = useCallback(async () => {
    if (!sentRep) return;
    const record = nec1099s.find(n => n.rep_id === sentRep.id);
    if (!record) return;
    try {
      await supabaseBrowser.from("sales_rep_1099s").update({
        sent_at: new Date().toISOString(),
        sent_method: sentMethod,
      }).eq("id", record.id);
      logAudit({ action: "mark_1099_sent", tab: AUDIT_TABS.SALES, targetType: "sales_rep", targetId: sentRep.id, entityName: sentRep.name, details: `1099-NEC marked as sent via ${sentMethod}` });
      setShowSentModal(false);
      setSentRep(null);
      fetch1099s();
    } catch (err) {
      console.error("Error marking 1099 sent:", err);
    }
  }, [sentRep, sentMethod, nec1099s, fetch1099s]);

  const handleAppAction = useCallback(async (action: "approve" | "reject") => {
    if (!selectedApp) return;
    setAppActionLoading(true);
    try {
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      const body: Record<string, unknown> = { id: selectedApp.id, action };
      if (action === "approve") {
        body.assignmentData = {
          role: approveData.role,
          zone_id: approveData.zone_id || null,
          division_id: approveData.division_id || null,
          county_id: approveData.county_id || null,
          state: approveData.state || null,
          supervisor_id: approveData.supervisor_id || null,
          individual_quota: null,
        };
      } else {
        body.message = rejectReason;
      }
      const res = await fetch("/api/admin/applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        logAudit({
          action: action === "approve" ? "approve_application" : "reject_application",
          tab: AUDIT_TABS.APPLICATIONS,
          targetType: "role_application",
          targetId: selectedApp.id,
          entityName: selectedApp.full_name,
          fieldName: "status",
          oldValue: "submitted",
          newValue: action === "approve" ? "approved" : "rejected",
          details: `Sales rep application ${action}d`,
        });
        setShowApproveModal(false);
        setShowRejectModal(false);
        setSelectedApp(null);
        setExpandedAppId(null);
        setApproveData({ role: "sales_rep", zone_id: "", division_id: "", supervisor_id: "", state: "", county_id: "" });
        setRejectReason("");
        fetchApplications();
        if (action === "approve") fetchData();
      }
    } catch (err) {
      console.error("Error processing application:", err);
    } finally {
      setAppActionLoading(false);
    }
  }, [selectedApp, approveData, rejectReason, fetchApplications, fetchData]);

  const handleEditApp = useCallback(async () => {
    if (!selectedApp) return;
    setAppActionLoading(true);
    try {
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      const res = await fetch("/api/admin/applications", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ id: selectedApp.id, ...editAppData }),
      });
      if (res.ok) {
        logAudit({ action: "edit_application", tab: AUDIT_TABS.APPLICATIONS, targetType: "role_application", targetId: selectedApp.id, entityName: selectedApp.full_name, details: "Application edited by staff" });
        setShowEditAppModal(false);
        setSelectedApp(null);
        fetchApplications();
      }
    } catch (err) {
      console.error("Error editing application:", err);
    } finally {
      setAppActionLoading(false);
    }
  }, [selectedApp, editAppData, fetchApplications]);

  const handleDeleteApp = useCallback(async () => {
    if (!selectedApp) return;
    setAppActionLoading(true);
    try {
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      const res = await fetch(`/api/admin/applications?id=${selectedApp.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.ok) {
        logAudit({ action: "delete_application", tab: AUDIT_TABS.APPLICATIONS, targetType: "role_application", targetId: selectedApp.id, entityName: selectedApp.full_name, details: "Application deleted by staff" });
        setShowDeleteAppModal(false);
        setSelectedApp(null);
        setExpandedAppId(null);
        fetchApplications();
      }
    } catch (err) {
      console.error("Error deleting application:", err);
    } finally {
      setAppActionLoading(false);
    }
  }, [selectedApp, fetchApplications]);

  const tabs = [
    { key: "overview", label: "📊 Overview" },
    { key: "reps", label: "👥 Sales Reps" },
    { key: "signups", label: "📝 Signups" },
    { key: "bonuspool", label: "🏆 Bonus Pool" },
    { key: "quotas", label: "🎯 Quotas" },
    { key: "history", label: "📜 History" },
    { key: "payouts", label: "💵 Payouts" },
    { key: "prospecting", label: "🔍 Prospecting" },
    { key: "applications", label: "📋 Applications" },
    { key: "1099nec", label: "📄 1099-NEC" },
  ];

  // Get supervisors (anyone above sales_rep)
  const getSupervisorOptions = useCallback((role: string) => {
    const roleIdx = ROLE_HIERARCHY.indexOf(role);
    if (roleIdx <= 0) return [];
    return salesReps.filter(r => ROLE_HIERARCHY.indexOf(r.role) < roleIdx && r.status === "active");
  }, [salesReps]);

  const getDivisionName = useCallback((zoneId: string | null) => {
    if (!zoneId) return "—";
    const zone = zones.find(z => z.id === zoneId);
    return zone?.name || "—";
  }, [zones]);

  const getSupervisorName = useCallback((supId: string | null) => {
    if (!supId) return "—";
    const sup = salesReps.find(r => r.id === supId);
    return sup?.name || "—";
  }, [salesReps]);

  // Handlers
  async function handleAddRep() {
    if (!newRep.name.trim() || !newRep.email.trim()) { alert("Please enter name and email."); return; }
    if (!newRep.zone_id) { alert("Division is required."); return; }
    if (!newRep.county_id) { alert("County is required."); return; }
    if (!newRep.state) { alert("State is required."); return; }
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
      county_id: newRep.county_id,
      state: newRep.state,
      city: newRep.city || null,
      supervisor_id: newRep.supervisor_id || null,
      hire_date: newRep.hire_date,
      status: "active",
      avatar,
      individual_quota: null,
    });

    if (error) { alert("Error: " + error.message); return; }
    logAudit({
      action: "create_sales_rep",
      tab: AUDIT_TABS.SALES,
      subTab: "Sales Reps",
      targetType: "sales_rep",
      targetId: newRep.email,
      entityName: newRep.name,
      details: `Created sales rep "${newRep.name}" (${ROLE_LABELS[newRep.role] || newRep.role}) in division ${zones.find(z => z.id === newRep.zone_id)?.name || newRep.zone_id}`,
    });
    alert(`Sales rep "${newRep.name}" added!`);
    setShowAddRepModal(false);
    setNewRep({ name: "", email: "", phone: "", role: "sales_rep", division_id: "", zone_id: "", city: "", supervisor_id: "", hire_date: new Date().toISOString().slice(0, 10), state: "", county_id: "" });
    await fetchData();
  }

  async function handleSaveRepEdit(repId: string) {
    const updates: Record<string, unknown> = {};
    if (editRepData.state !== undefined) updates.state = editRepData.state || null;
    if (editRepData.county_id !== undefined) updates.county_id = editRepData.county_id || null;
    if (editRepData.individual_quota_str !== undefined) {
      const trimmed = editRepData.individual_quota_str.trim();
      updates.individual_quota = trimmed === "" ? null : (parseFloat(trimmed) || null);
    }
    if (editRepData.city !== undefined) updates.city = editRepData.city || null;
    if (editRepData.phone !== undefined) updates.phone = editRepData.phone || null;
    if (editRepData.role !== undefined) updates.role = editRepData.role;
    if (editRepData.supervisor_id !== undefined) updates.supervisor_id = editRepData.supervisor_id || null;
    if (editRepData.zone_id !== undefined) {
      updates.zone_id = editRepData.zone_id || null;
      const zone = zones.find(z => z.id === editRepData.zone_id);
      updates.division_id = zone?.division_id || null;
    }
    if (editRepData.status !== undefined) updates.status = editRepData.status;

    const { error } = await supabaseBrowser.from("sales_reps").update(updates).eq("id", repId);
    if (error) { alert("Error saving: " + error.message); return; }
    logAudit({
      action: "update_sales_rep",
      tab: AUDIT_TABS.SALES,
      subTab: "Sales Reps",
      targetType: "sales_rep",
      targetId: repId,
      entityName: salesReps.find(r => r.id === repId)?.name || "",
      details: `Updated rep fields: ${Object.keys(updates).join(", ")}`,
    });
    setEditingRepId(null);
    await fetchData();
  }

  const searchBusinesses = useCallback(async (query: string) => {
    if (query.length < 2) { setBusinessSuggestions([]); return; }
    const { data } = await supabaseBrowser.from("business").select("id, business_name, public_business_name").or(`business_name.ilike.%${query}%,public_business_name.ilike.%${query}%`).limit(10);
    setBusinessSuggestions(data || []);
  }, []);

  async function updateBonusPool(isInbound: boolean, plan: string, adSpendCents: number) {
    const now = new Date();
    const quarter = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
    const quarterStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const quarterEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

    // Get pool contribution amounts from Settings
    const planPool = isInbound
      ? (plan === "premium" ? getConfig("pool_inbound_premium") : getConfig("pool_inbound_basic"))
      : (plan === "premium" ? getConfig("pool_outbound_premium") : getConfig("pool_outbound_basic"));
    const adPool = Math.floor(adSpendCents / 100) * getConfig("pool_ad_spend_per_100");

    // Determine which breakdown fields to increment
    const planField = isInbound
      ? (plan === "premium" ? "inbound_premium_cents" : "inbound_basic_cents")
      : (plan === "premium" ? "rep_premium_cents" : "rep_basic_cents");
    const adsField = isInbound ? "inbound_ads_cents" : "rep_ads_cents";

    // Fetch or create the current month pool
    const { data: existing } = await supabaseBrowser.from("sales_bonus_pool").select("*").eq("quarter", quarter).maybeSingle();
    if (existing) {
      const updates: Record<string, number> = {
        [planField]: (existing[planField as keyof BonusPool] as number || 0) + planPool,
        total_pool_cents: (existing.total_pool_cents || 0) + planPool + adPool,
      };
      if (adPool > 0) updates[adsField] = (existing[adsField as keyof BonusPool] as number || 0) + adPool;
      // Recalculate projected per-rep
      const eligibleCount = existing.eligible_rep_ids?.length || 0;
      if (eligibleCount > 0) updates.projected_per_rep_cents = Math.floor(updates.total_pool_cents / eligibleCount);
      await supabaseBrowser.from("sales_bonus_pool").update(updates).eq("id", existing.id);
    } else {
      const newPool: Record<string, unknown> = {
        quarter, quarter_start: quarterStart, quarter_end: quarterEnd,
        total_pool_cents: planPool + adPool,
        inbound_basic_cents: 0, inbound_premium_cents: 0, inbound_ads_cents: 0,
        rep_basic_cents: 0, rep_premium_cents: 0, rep_ads_cents: 0,
        repeat_customers_cents: 0, eligible_rep_ids: [], projected_per_rep_cents: 0,
        status: "active",
      };
      newPool[planField] = planPool;
      if (adPool > 0) newPool[adsField] = adPool;
      await supabaseBrowser.from("sales_bonus_pool").insert(newPool);
    }
  }

  async function handleAddSale() {
    if (!newSale.business_name.trim()) { alert("Please enter a business name."); return; }
    if (newSale.rep_id !== "inbound" && !newSale.rep_id) { alert("Please select a sales rep or choose Inbound."); return; }

    const isInbound = newSale.rep_id === "inbound";
    const rep = salesReps.find(r => r.id === newSale.rep_id);
    const planCommission = newSale.plan === "premium" ? commissionRates.individual.premium_signup : commissionRates.individual.basic_signup;
    const adCommission = Math.floor(newSale.ad_spend / 100) * commissionRates.individual.advertising_per_100;
    const totalCommission = isInbound ? 0 : planCommission + adCommission;
    const poolContribution = isInbound
      ? (newSale.plan === "premium" ? getConfig("pool_inbound_premium") : getConfig("pool_inbound_basic")) + Math.floor(newSale.ad_spend / 100) * getConfig("pool_ad_spend_per_100")
      : (newSale.plan === "premium" ? getConfig("pool_outbound_premium") : getConfig("pool_outbound_basic")) + Math.floor(newSale.ad_spend / 100) * getConfig("pool_ad_spend_per_100");

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

    // Update the bonus pool with this sale's contribution
    await updateBonusPool(isInbound, newSale.plan, newSale.ad_spend * 100);

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
    // Audit log insert is best-effort; don't fail the main operation

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
      const currentPool = quarter === computedPoolData.quarter ? computedPoolData : previousPools.find(p => p.quarter === quarter);

      if (!currentPool) {
        alert(`Error: Cannot find bonus pool data for ${quarter}`);
        return;
      }

      // Use UPSERT to handle both create and update (upsert on conflict with quarter)
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
      const repMonth = monthSignups.filter(s => s.rep_id === rep.id);

      if (repMonth.length > 0) {
        const monthTotal = repMonth.reduce((sum, s) => sum + (s.commission_cents || 0), 0);
        const monthPaid = paidCommissions[rep.id]?.month ? "Yes" : "No";

        data.push({
          "Rep Name": rep.name,
          "Email": rep.email,
          "Division": getDivisionName(rep.zone_id),
          "Month": `${currentMonthName} ${currentYear}`,
          "Signups": repMonth.length,
          "Commission": (monthTotal / 100).toFixed(2),
          "Paid": monthPaid,
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
        "Division": getDivisionName(rep.zone_id),
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
      "Division": getDivisionName(s.zone_id),
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
      "Division": "",
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

  const filteredRepsForSearch = salesReps.filter(r => r.status === "active" && FIELD_ROLES.includes(r.role) && (r.name.toLowerCase().includes(repSearchQuery.toLowerCase()) || r.email.toLowerCase().includes(repSearchQuery.toLowerCase())));

  // Export data for CSV/XLSX
  const exportHeaders = ["Business", "Rep", "Plan", "Commission", "Ad Spend", "Division", "State", "Date"];
  const exportRows = filteredSignups.map((s) => [
    s.business_name || "",
    salesReps.find((r) => r.id === s.rep_id)?.name || "",
    s.plan,
    ((s.commission_cents || 0) / 100).toFixed(2),
    ((s.ad_spend_cents || 0) / 100).toFixed(2),
    getDivisionName(s.zone_id),
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
                    {filteredRepsForSearch.map((r) => <option key={r.id} value={r.id}>{r.name} ({getDivisionName(r.zone_id)})</option>)}
                  </select>
                </div>
              )}
              {newSale.rep_id === "inbound" && (
                <div style={{ padding: 12, background: "rgba(57,255,20,0.1)", borderRadius: 10, border: "1px solid " + COLORS.neonGreen }}>
                  <div style={{ fontSize: 12, color: COLORS.neonGreen, fontWeight: 600 }}>📥 Inbound Sale</div>
                  <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 4 }}>No individual commission. Contributes to team bonus pool only.</div>
                </div>
              )}
              <div style={{ position: "relative" }}>
                <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase", fontWeight: 600 }}>Business Name</label>
                <input type="text" value={newSale.business_name} onChange={(e) => { setNewSale({ ...newSale, business_name: e.target.value }); searchBusinesses(e.target.value); setShowBusinessSuggestions(true); }} onFocus={() => { if (businessSuggestions.length > 0) setShowBusinessSuggestions(true); }} placeholder="Search businesses..." style={{ width: "100%", padding: 14, background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, fontSize: 14 }} />
                {showBusinessSuggestions && businessSuggestions.length > 0 && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, marginTop: 4, maxHeight: 200, overflowY: "auto", zIndex: 10 }}>
                    {businessSuggestions.map(b => (
                      <div key={b.id} onClick={() => { setNewSale({ ...newSale, business_name: b.public_business_name || b.business_name }); setShowBusinessSuggestions(false); }} style={{ padding: "10px 14px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid rgba(255,255,255,0.05)" }} onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.darkBg)} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                        <div style={{ fontWeight: 600 }}>{b.public_business_name || b.business_name}</div>
                        {b.public_business_name && b.business_name !== b.public_business_name && <div style={{ fontSize: 11, color: COLORS.textSecondary }}>{b.business_name}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase", fontWeight: 600 }}>Plan Type</label>
                  <select value={newSale.plan} onChange={(e) => setNewSale({ ...newSale, plan: e.target.value, ad_spend: e.target.value === "basic" ? 0 : newSale.ad_spend })} style={{ width: "100%", padding: 14, background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, fontSize: 14 }}>
                    <option value="basic">Basic</option>
                    <option value="premium">Premium</option>
                  </select>
                </div>
                <div style={{ opacity: newSale.plan === "basic" ? 0.4 : 1 }}>
                  <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase", fontWeight: 600 }}>Ad Spend Sold</label>
                  <input type="number" value={newSale.plan === "basic" ? 0 : newSale.ad_spend} onChange={(e) => setNewSale({ ...newSale, ad_spend: parseInt(e.target.value) || 0 })} disabled={newSale.plan === "basic"} placeholder="0" style={{ width: "100%", padding: 14, background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: newSale.plan === "basic" ? COLORS.textSecondary : COLORS.textPrimary, fontSize: 14, cursor: newSale.plan === "basic" ? "not-allowed" : "text" }} />
                  {newSale.plan === "basic" && <div style={{ fontSize: 10, color: COLORS.textSecondary, marginTop: 4 }}>Ads not available on Basic plan</div>}
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase", fontWeight: 600 }}>Notes (optional)</label>
                <textarea value={newSale.notes} onChange={(e) => setNewSale({ ...newSale, notes: e.target.value })} placeholder="Any additional notes..." rows={2} style={{ width: "100%", padding: 14, background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, fontSize: 14, resize: "vertical" }} />
              </div>
              <div style={{ padding: 16, background: COLORS.darkBg, borderRadius: 12 }}>
                {newSale.rep_id === "inbound" ? (
                  (() => {
                    const planPool = newSale.plan === "premium" ? getConfig("pool_inbound_premium") : getConfig("pool_inbound_basic");
                    const adPool = newSale.ad_spend > 0 ? Math.floor(newSale.ad_spend / 100) * getConfig("pool_ad_spend_per_100") : 0;
                    return (
                      <>
                        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: COLORS.neonPurple }}>🏆 Pool Contribution Preview</div>
                        <div style={{ display: "grid", gap: 4, fontSize: 13 }}>
                          <div style={{ display: "flex", justifyContent: "space-between" }}><span>Plan ({newSale.plan}) - Pool</span><span style={{ color: COLORS.neonPurple }}>+{formatMoney(planPool)}</span></div>
                          {adPool > 0 && <div style={{ display: "flex", justifyContent: "space-between" }}><span>Ad Spend (${newSale.ad_spend}) - Pool</span><span style={{ color: COLORS.neonPurple }}>+{formatMoney(adPool)}</span></div>}
                          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, borderTop: "1px solid " + COLORS.cardBorder, paddingTop: 8, marginTop: 4 }}><span>Total to Bonus Pool</span><span style={{ color: COLORS.neonPurple }}>+{formatMoney(planPool + adPool)}</span></div>
                        </div>
                      </>
                    );
                  })()
                ) : (
                  (() => {
                    const planComm = newSale.plan === "premium" ? commissionRates.individual.premium_signup : commissionRates.individual.basic_signup;
                    const adComm = newSale.ad_spend > 0 ? Math.floor(newSale.ad_spend / 100) * commissionRates.individual.advertising_per_100 : 0;
                    const totalComm = planComm + adComm;
                    return (
                      <>
                        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: COLORS.neonGreen }}>💰 Commission & Pool Preview</div>
                        <div style={{ display: "grid", gap: 4, fontSize: 13 }}>
                          <div style={{ display: "flex", justifyContent: "space-between" }}><span>Plan ({newSale.plan}) - Commission</span><span style={{ color: COLORS.neonGreen }}>+{formatMoney(planComm)}</span></div>
                          {adComm > 0 && <div style={{ display: "flex", justifyContent: "space-between" }}><span>Ad Spend (${newSale.ad_spend}) - Commission</span><span style={{ color: COLORS.neonGreen }}>+{formatMoney(adComm)}</span></div>}
                          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, borderTop: "1px solid " + COLORS.cardBorder, paddingTop: 8, marginTop: 4 }}><span>Total Commission</span><span style={{ color: COLORS.neonGreen }}>{formatMoney(totalComm)}</span></div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTop: "1px dashed " + COLORS.cardBorder }}><span style={{ color: COLORS.textSecondary }}>Pool Contribution</span><span style={{ color: COLORS.neonPurple }}>+{formatMoney((newSale.plan === "premium" ? getConfig("pool_outbound_premium") : getConfig("pool_outbound_basic")) + (newSale.ad_spend > 0 ? Math.floor(newSale.ad_spend / 100) * getConfig("pool_ad_spend_per_100") : 0))}</span></div>
                        </div>
                      </>
                    );
                  })()
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
                  <input
                    type="tel"
                    value={newRep.phone}
                    onChange={(e) => {
                      // Strip non-digits, format as (XXX) XXX-XXXX
                      const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                      let formatted = digits;
                      if (digits.length > 6) formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
                      else if (digits.length > 3) formatted = `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
                      else if (digits.length > 0) formatted = `(${digits}`;
                      setNewRep({ ...newRep, phone: formatted });
                    }}
                    placeholder="(555) 555-5555"
                    maxLength={14}
                    style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary }}
                  />
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

              {/* Division (Required) */}
              <div>
                <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, textTransform: "uppercase", fontWeight: 600 }}>Division * (5 US Regions)</label>
                <select value={newRep.zone_id} onChange={(e) => { const z = zones.find(zn => zn.id === e.target.value); setNewRep({ ...newRep, zone_id: e.target.value, division_id: z?.division_id || "" }); }} style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary }}>
                  <option value="">Select division...</option>
                  {zones.map(z => <option key={z.id} value={z.id}>{z.name} ({z.states.join(", ")})</option>)}
                </select>
              </div>

              {/* State & County (Required) */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, textTransform: "uppercase", fontWeight: 600 }}>State *</label>
                  <select value={newRep.state} onChange={(e) => setNewRep({ ...newRep, state: e.target.value, county_id: "" })} style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary }}>
                    <option value="">Select state...</option>
                    {(() => {
                      const zone = zones.find(z => z.id === newRep.zone_id);
                      const statesInZone = zone ? zone.states : [...new Set(counties.map(c => c.state))].sort();
                      return statesInZone.map(s => <option key={s} value={s}>{s}</option>);
                    })()}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, textTransform: "uppercase", fontWeight: 600 }}>County *</label>
                  <select value={newRep.county_id} onChange={(e) => setNewRep({ ...newRep, county_id: e.target.value })} style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary }} disabled={!newRep.state}>
                    <option value="">Select county...</option>
                    {counties.filter(c => c.state === newRep.state).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
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

      {/* EDIT QUOTA MODAL - Individual/Team/Division */}
      {showEditQuotaModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setShowEditQuotaModal(false)}>
          <div style={{ background: COLORS.cardBg, borderRadius: 20, padding: 32, maxWidth: 500, width: "90%", border: "1px solid " + COLORS.cardBorder }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Set Quota Override</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Target Type */}
              <div>
                <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, textTransform: "uppercase", fontWeight: 600 }}>Target Type</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                  {["individual", "team", "division"].map(t => (
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
                  const rep = salesReps.find(r => r.id === val);
                  const zone = zones.find(z => z.id === val);
                  if (rep) setQuotaEditTarget({ type: rep.role === "team_lead" ? "team" : "individual", id: rep.id, name: rep.name });
                  else if (zone) setQuotaEditTarget({ type: "division", id: zone.id, name: zone.name });
                }} style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary }}>
                  <option value="">Select...</option>
                  <optgroup label="Sales Reps">
                    {actualSalesReps.map(r => <option key={r.id} value={r.id}>{r.name} (Individual)</option>)}
                  </optgroup>
                  <optgroup label="Team Leads">
                    {salesReps.filter(r => r.role === "team_lead").map(r => <option key={r.id} value={r.id}>{r.name} (Team)</option>)}
                  </optgroup>
                  <optgroup label="Divisions">
                    {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
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
                  This goes into the monthly bonus pool
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
              <div style={{ padding: 12, background: COLORS.darkBg, borderRadius: 10 }}><div style={{ fontSize: 11, color: COLORS.textSecondary }}>Division</div><div style={{ fontWeight: 600 }}>{getDivisionName(selectedRep.zone_id)}</div></div>
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
                    <div style={{ padding: 16, background: COLORS.darkBg, borderRadius: 12, textAlign: "center" }}><div style={{ fontSize: 11, color: COLORS.textSecondary }}>Bonus</div><div style={{ fontSize: 18, fontWeight: 800, color: perf.total >= getRepBonusThreshold(selectedRep) ? COLORS.neonGreen : COLORS.neonOrange }}>{perf.total >= getRepBonusThreshold(selectedRep) ? "Eligible" : `Need ${getRepBonusThreshold(selectedRep) - perf.total}`}</div></div>
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
        {/* Division dropdown */}
        <select value={salesFilters.zone} onChange={(e) => setSalesFilters({ ...salesFilters, zone: e.target.value })} style={{ padding: "8px 12px", background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, fontSize: 12 }}>
          <option value="all">All Divisions</option>
          {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
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
            options={actualSalesReps.map(r => ({ value: r.id, label: r.name, sub: getDivisionName(r.zone_id) }))}
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

                  {/* Division Filter */}
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, textTransform: "uppercase", fontWeight: 600 }}>Division</label>
                    <select
                      value={salesFilters.zone}
                      onChange={(e) => setSalesFilters({ ...salesFilters, zone: e.target.value })}
                      style={{ padding: "6px 12px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 6, color: COLORS.textPrimary, fontSize: 12 }}
                    >
                      <option value="all">All Divisions</option>
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
                    {salesFilters.zone !== "all" && <span>Division: {zones.find(z => z.id === salesFilters.zone)?.name} • </span>}
                    {salesFilters.state !== "all" && <span>State: {salesFilters.state} • </span>}
                    {salesFilters.rep !== "all" && <span>Rep: {salesReps.find(r => r.id === salesFilters.rep)?.name}</span>}
                  </div>
                )}
              </Card>

              {/* TOP STATS ROW */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 16, marginBottom: 24 }}>
                {[
                  { label: "Total Commissions", value: formatMoney(totalCommissions), sub: periodLabel, color: COLORS.neonGreen },
                  { label: "Bonus Pool", value: formatMoney(computedBonusPool), sub: `${currentMonthName} ${currentYear}`, color: COLORS.neonPurple },
                  { label: "Team Signups", value: totalSignups, sub: `vs ${Math.round(commissionRates.daily.team * 30)} quota`, color: COLORS.neonBlue },
                  { label: "Eligible for Bonus", value: `${eligibleReps.length}/${actualSalesReps.length}`, sub: `Role-based thresholds`, color: COLORS.neonYellow },
                  { label: "Ad Spend Sold", value: formatMoney(totalAdSpend), sub: periodLabel, color: COLORS.neonOrange },
                  { label: "Surge Revenue", value: formatMoney(adCampaignRevenue.surge), sub: `${adCampaignRevenue.count} paid campaigns`, color: COLORS.neonRed || "#ff3131" },
                ].map((stat, i) => (
                  <Card key={i}><div style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 600 }}>{stat.label}</div><div style={{ fontSize: 28, fontWeight: 800, color: stat.color, marginTop: 8 }}>{stat.value}</div><div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 4 }}>{stat.sub}</div></Card>
                ))}
              </div>

              {/* COMPANY-WIDE ATTAINMENT CARDS */}
              {(() => {
                // All active field reps — single source of truth
                const allFieldReps = salesReps.filter(r => r.status === "active" && FIELD_ROLES.includes(r.role));
                const daysInMonth = (year: number, monthIdx: number) => new Date(year, monthIdx + 1, 0).getDate();
                const currentMonthDays = daysInMonth(currentYear, currentMonth - 1);

                // Get actual days worked by a rep in a given month
                // Current month: hire date (or month start) → today
                // Past months: hire date (or month start) → month end
                // Future months: 0
                const today = new Date();
                const todayDate = today.getDate();
                const yesterday = new Date(today);
                yesterday.setDate(todayDate - 1);
                const throughDate = yesterday.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                const repActiveDays = (rep: SalesRep, year: number, monthIdx: number) => {
                  const totalDays = daysInMonth(year, monthIdx);
                  const monthStart = new Date(year, monthIdx, 1);
                  const monthEnd = new Date(year, monthIdx + 1, 0, 23, 59, 59);
                  const mNum = monthIdx + 1;
                  const isCurrent = year === currentYear && mNum === currentMonth;
                  const isFuture = year > currentYear || (year === currentYear && mNum > currentMonth);
                  if (isFuture) return 0;

                  // Determine start day (1st or hire date, whichever is later)
                  let startDay = 1;
                  if (rep.hire_date) {
                    const hireDate = new Date(rep.hire_date + "T00:00:00");
                    if (hireDate > monthEnd) return 0; // hired after this month
                    if (hireDate > monthStart) startDay = hireDate.getDate();
                  }

                  // Determine end day (yesterday for current month since today isn't complete, last day for past months)
                  const endDay = isCurrent ? todayDate - 1 : totalDays;

                  return Math.max(0, endDay - startDay + 1);
                };

                // Build division data from reps' zone_id → division mapping
                const divData = divisions.map(div => {
                  const divZones = zones.filter(z => z.division_id === div.id);
                  const divZoneIds = divZones.map(z => z.id);
                  const divReps = allFieldReps.filter(r => r.zone_id && divZoneIds.includes(r.zone_id));
                  // Monthly quota for division = sum of each rep's daily quota × their active days (no rounding — keep decimal precision)
                  const getDivMonthQuota = (monthIdx: number) =>
                    divReps.reduce((sum, rep) => sum + getRepDailyQuota(rep) * repActiveDays(rep, currentYear, monthIdx), 0);
                  return { division: div, repCount: divReps.length, reps: divReps, getDivMonthQuota };
                });

                // Company quotas = sum of per-division quotas (hire-date-aware, prorated)
                const getMonthQuota = (monthIdx: number) => {
                  return divData.reduce((sum, d) => sum + d.getDivMonthQuota(monthIdx), 0);
                };
                const companyMonthQuota = getMonthQuota(currentMonth - 1);
                const monthAttainment = companyMonthQuota > 0 ? (monthSignups.length / companyMonthQuota) * 100 : 0;

                const ytdStart = new Date(currentYear, 0, 1);
                const ytdSignups = signups.filter(s => new Date(s.signed_at) >= ytdStart);
                const ytdQuota = Array.from({ length: currentMonth }, (_, i) => getMonthQuota(i)).reduce((a, b) => a + b, 0);
                const ytdAttainment = ytdQuota > 0 ? (ytdSignups.length / ytdQuota) * 100 : 0;

                // Helper: get signups belonging to a division
                const getDivSignups = (divZoneIds: string[], source: SalesSignup[]) => {
                  return source.filter(s => {
                    const rep = salesReps.find(r => r.id === s.rep_id);
                    return rep?.zone_id ? divZoneIds.includes(rep.zone_id) : false;
                  });
                };

                return (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: 20, marginBottom: 24 }}>
                    {/* Monthly Attainment — All Months */}
                    <Card>
                      <div style={{ padding: "12px 0" }}>
                        <div style={{ fontSize: 12, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 600, letterSpacing: 1, marginBottom: 14, textAlign: "center" }}>Monthly Attainment</div>
                        <div style={{ display: "grid", gap: 6 }}>
                          {monthNames.map((mName, mIdx) => {
                            const mNum = mIdx + 1;
                            const mStart = new Date(currentYear, mIdx, 1);
                            const mEnd = new Date(currentYear, mIdx + 1, 0, 23, 59, 59);
                            const mSignups = signups.filter(s => { const d = new Date(s.signed_at); return d >= mStart && d <= mEnd; }).length;
                            const mQuota = getMonthQuota(mIdx);
                            const mPct = mQuota > 0 ? (mSignups / mQuota) * 100 : 0;
                            const isCurrent = mNum === currentMonth;
                            const isFuture = mNum > currentMonth;
                            if (!isCurrent && !isFuture && mPct === 0) return null;
                            const barColor = isFuture ? "rgba(255,255,255,0.05)" : mPct >= 100 ? COLORS.neonGreen : mPct >= 50 ? COLORS.neonYellow : COLORS.neonRed;
                            return (
                              <div key={mIdx} style={{ display: "flex", alignItems: "center", gap: 8, opacity: isFuture ? 0.3 : 1 }}>
                                <span style={{ fontSize: 11, fontWeight: isCurrent ? 800 : 500, color: isCurrent ? COLORS.neonBlue : COLORS.textSecondary, width: 28, textAlign: "right" }}>{mName}</span>
                                <div style={{ flex: 1, height: 10, background: "rgba(255,255,255,0.06)", borderRadius: 100, overflow: "hidden", border: isCurrent ? "1px solid " + COLORS.neonBlue : "none" }}>
                                  <div style={{ height: "100%", width: isFuture ? "0%" : `${Math.min(100, mPct)}%`, background: barColor, borderRadius: 100, transition: "width 0.5s" }} />
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 700, width: 50, textAlign: "right", color: isFuture ? COLORS.textSecondary : barColor }}>{isFuture ? "—" : `${mPct.toFixed(1)}%`}</span>
                                <span style={{ fontSize: 9, color: COLORS.textSecondary, width: 52, textAlign: "right" }}>{isFuture ? "" : `${mSignups}/${mQuota % 1 === 0 ? mQuota : mQuota.toFixed(2)}`}</span>
                              </div>
                            );
                          })}
                        </div>
                        <div style={{ fontSize: 9, color: COLORS.textSecondary, textAlign: "center", marginTop: 10, opacity: 0.6 }}>Through {throughDate}</div>
                      </div>
                    </Card>

                    {/* Division Attainment by Month — Table */}
                    <Card>
                      <div style={{ padding: "12px 0" }}>
                        <div style={{ fontSize: 12, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 600, letterSpacing: 1, marginBottom: 14, textAlign: "center" }}>Division Attainment by Month</div>
                        {divData.length === 0 ? (
                          <div style={{ textAlign: "center", color: COLORS.textSecondary, fontSize: 13, padding: 20 }}>No divisions configured</div>
                        ) : (
                          <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                              <thead>
                                <tr style={{ borderBottom: "1px solid " + COLORS.cardBorder }}>
                                  <th style={{ padding: "8px 6px", textAlign: "left", color: COLORS.textSecondary, fontWeight: 600, fontSize: 10, textTransform: "uppercase" }}></th>
                                  {divData.map(d => (
                                    <th key={d.division.id} style={{ padding: "8px 4px", textAlign: "center", color: COLORS.textSecondary, fontWeight: 600, fontSize: 10, textTransform: "uppercase" }}>{d.division.name}</th>
                                  ))}
                                  <th style={{ padding: "8px 6px", textAlign: "center", color: COLORS.textSecondary, fontWeight: 600, fontSize: 10, textTransform: "uppercase" }}>Avg</th>
                                </tr>
                              </thead>
                              <tbody>
                                {monthNames.map((mName, mIdx) => {
                                  const mNum = mIdx + 1;
                                  const mStart = new Date(currentYear, mIdx, 1);
                                  const mEnd = new Date(currentYear, mIdx + 1, 0, 23, 59, 59);
                                  const mDays = daysInMonth(currentYear, mIdx);
                                  const isCurrent = mNum === currentMonth;
                                  const isFuture = mNum > currentMonth;
                                  const mAllSignups = signups.filter(s => { const d = new Date(s.signed_at); return d >= mStart && d <= mEnd; });
                                  const divPcts = divData.map(d => {
                                    const divMonthQuota = d.getDivMonthQuota(mIdx);
                                    const divZoneIds = zones.filter(z => z.division_id === d.division.id).map(z => z.id);
                                    const divSigs = getDivSignups(divZoneIds, mAllSignups).length;
                                    return divMonthQuota > 0 ? (divSigs / divMonthQuota) * 100 : 0;
                                  });
                                  const avgPct = divPcts.length > 0 ? divPcts.reduce((a, b) => a + b, 0) / divPcts.length : 0;
                                  const allZero = !isCurrent && !isFuture && divPcts.every(p => p === 0);
                                  if (allZero) return null;
                                  const getColor = (pct: number) => pct >= 100 ? COLORS.neonGreen : pct >= 50 ? COLORS.neonYellow : COLORS.neonRed;
                                  return (
                                    <tr key={mIdx} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", opacity: isFuture ? 0.25 : 1, background: isCurrent ? "rgba(0,212,255,0.06)" : "transparent" }}>
                                      <td style={{ padding: "7px 6px", fontWeight: isCurrent ? 800 : 500, color: isCurrent ? COLORS.neonBlue : COLORS.textSecondary, fontSize: 11 }}>{mName}</td>
                                      {divPcts.map((pct, dIdx) => (
                                        <td key={divData[dIdx].division.id} style={{ padding: "7px 4px", textAlign: "center" }}>
                                          <span style={{ fontWeight: 700, fontSize: 12, color: isFuture ? COLORS.textSecondary : getColor(pct) }}>{isFuture ? "—" : `${pct.toFixed(0)}%`}</span>
                                        </td>
                                      ))}
                                      <td style={{ padding: "7px 6px", textAlign: "center" }}>
                                        <span style={{ fontWeight: 800, fontSize: 12, color: isFuture ? COLORS.textSecondary : getColor(avgPct) }}>{isFuture ? "—" : `${avgPct.toFixed(0)}%`}</span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                        <div style={{ fontSize: 9, color: COLORS.textSecondary, textAlign: "center", marginTop: 10, opacity: 0.6 }}>Through {throughDate}</div>
                      </div>
                    </Card>

                    {/* YTD Attainment by Division */}
                    <Card>
                      <div style={{ padding: "12px 0" }}>
                        <div style={{ fontSize: 12, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 600, letterSpacing: 1, marginBottom: 14, textAlign: "center" }}>YTD Attainment by Division</div>
                        {divData.length === 0 ? (
                          <div style={{ textAlign: "center", color: COLORS.textSecondary, fontSize: 13, padding: 20 }}>No divisions configured</div>
                        ) : (
                          <div style={{ display: "grid", gap: 12 }}>
                            {divData.map(d => {
                              const divYtdQuota = Array.from({ length: currentMonth }, (_, i) => d.getDivMonthQuota(i)).reduce((a, b) => a + b, 0);
                              const divZoneIds = zones.filter(z => z.division_id === d.division.id).map(z => z.id);
                              const divYtdSignups = getDivSignups(divZoneIds, signups.filter(s => new Date(s.signed_at) >= ytdStart)).length;
                              const divPct = divYtdQuota > 0 ? (divYtdSignups / divYtdQuota) * 100 : 0;
                              return (
                                <div key={d.division.id}>
                                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                    <span style={{ fontSize: 13, fontWeight: 600 }}>{d.division.name}</span>
                                    <span style={{ fontSize: 13, fontWeight: 800, color: divPct >= 100 ? COLORS.neonGreen : divPct >= 50 ? COLORS.neonYellow : COLORS.neonRed }}>{divPct.toFixed(0)}%</span>
                                  </div>
                                  <div style={{ height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 100, overflow: "hidden" }}>
                                    <div style={{ height: "100%", width: `${Math.min(100, divPct)}%`, background: divPct >= 100 ? COLORS.neonGreen : divPct >= 50 ? COLORS.neonYellow : COLORS.neonRed, borderRadius: 100, transition: "width 0.5s" }} />
                                  </div>
                                  <div style={{ fontSize: 10, color: COLORS.textSecondary, marginTop: 2 }}>{divYtdSignups} / {divYtdQuota % 1 === 0 ? divYtdQuota : divYtdQuota.toFixed(2)} signups · {d.repCount} reps</div>
                                </div>
                              );
                            })}
                            {/* Total YTD row */}
                            <div style={{ borderTop: "1px solid " + COLORS.cardBorder, paddingTop: 12, marginTop: 4 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                <span style={{ fontSize: 13, fontWeight: 800 }}>Total YTD</span>
                                <span style={{ fontSize: 16, fontWeight: 900, color: ytdAttainment >= 100 ? COLORS.neonGreen : ytdAttainment >= 50 ? COLORS.neonYellow : COLORS.neonRed }}>{ytdAttainment.toFixed(1)}%</span>
                              </div>
                              <div style={{ height: 8, background: "rgba(255,255,255,0.1)", borderRadius: 100, overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${Math.min(100, ytdAttainment)}%`, background: ytdAttainment >= 100 ? COLORS.neonGreen : ytdAttainment >= 50 ? COLORS.neonYellow : COLORS.neonRed, borderRadius: 100, transition: "width 0.5s" }} />
                              </div>
                              <div style={{ fontSize: 10, color: COLORS.textSecondary, marginTop: 2 }}>{ytdSignups.length} / {ytdQuota % 1 === 0 ? ytdQuota : ytdQuota.toFixed(2)} signups · Jan – {currentMonthName} {currentYear}</div>
                            </div>
                          </div>
                        )}
                        <div style={{ fontSize: 9, color: COLORS.textSecondary, textAlign: "center", marginTop: 10, opacity: 0.6 }}>Through {throughDate}</div>
                      </div>
                    </Card>
                  </div>
                );
              })()}

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
                <Card title="💰 Commission Rates & Quotas">
                  <div style={{ padding: 12, background: COLORS.darkBg, borderRadius: 10, marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.neonGreen, marginBottom: 10, textTransform: "uppercase" }}>Individual Commissions</div>
                    {[{ label: "Basic Signup", value: formatMoney(commissionRates.individual.basic_signup) }, { label: "Premium Signup", value: formatMoney(commissionRates.individual.premium_signup) }, { label: "Ad Spend (per $100)", value: formatMoney(commissionRates.individual.advertising_per_100) }].map((item) => (
                      <div key={item.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}><span style={{ color: COLORS.textSecondary }}>{item.label}</span><span style={{ fontWeight: 700, color: COLORS.neonGreen }}>{item.value}</span></div>
                    ))}
                  </div>
                  <div style={{ padding: 12, background: COLORS.darkBg, borderRadius: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.neonPurple, marginBottom: 10, textTransform: "uppercase" }}>Quotas (Daily → Monthly)</div>
                    {[
                      { label: "Sales Rep", daily: commissionRates.daily.sales_rep },
                      { label: "Team Lead", daily: commissionRates.daily.team_lead },
                      { label: "In Training", daily: commissionRates.daily.in_training },
                      { label: "Rep Bonus Min", daily: commissionRates.daily.rep_bonus },
                      { label: "Lead Bonus Min", daily: commissionRates.daily.lead_bonus },
                      { label: "Training Bonus Min", daily: commissionRates.daily.training_bonus },
                      { label: "Team", daily: commissionRates.daily.team },
                    ].map((item) => (
                      <div key={item.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                        <span style={{ color: COLORS.textSecondary }}>{item.label}</span>
                        <span>
                          <span style={{ fontWeight: 700, color: COLORS.neonPurple }}>{item.daily % 1 === 0 ? item.daily : item.daily.toFixed(2)}/day</span>
                          <span style={{ color: COLORS.textSecondary, marginLeft: 8, fontSize: 11 }}>({Math.round(item.daily * 30)}/mo)</span>
                        </span>
                      </div>
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
                  <div style={{ fontSize: 12 }}><span style={{ color: COLORS.textSecondary }}>Period:</span> <strong style={{ color: COLORS.neonPurple }}>{computedPoolData.quarter}</strong></div>
                  <div style={{ fontSize: 12 }}><span style={{ color: COLORS.textSecondary }}>Year:</span> <strong>{currentYear}</strong></div>
                  <div style={{ fontSize: 12 }}><span style={{ color: COLORS.textSecondary }}>Week:</span> <strong>{Math.ceil((now.getDate() + new Date(now.getFullYear(), now.getMonth(), 1).getDay()) / 7)}</strong></div>
                  <div style={{ fontSize: 12 }}><span style={{ color: COLORS.textSecondary }}>Period:</span> <strong>{now.getDate() <= 15 ? "1st Half" : "2nd Half"}</strong></div>
                  <div style={{ fontSize: 12 }}><span style={{ color: COLORS.textSecondary }}>Status:</span> <strong style={{ color: COLORS.neonGreen }}>Active</strong></div>
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

                        // Calculate contributions from live config values
                        const inboundBasic = inbound.filter(s => s.plan === "basic").length * getConfig("pool_inbound_basic");
                        const outboundBasic = outbound.filter(s => s.plan === "basic").length * getConfig("pool_outbound_basic");
                        const inboundPremium = inbound.filter(s => s.plan === "premium").length * getConfig("pool_inbound_premium");
                        const outboundPremium = outbound.filter(s => s.plan === "premium").length * getConfig("pool_outbound_premium");
                        const inboundAds = inbound.reduce((sum, s) => sum + Math.floor((s.ad_spend_cents || 0) / 100) * getConfig("pool_ad_spend_per_100"), 0);
                        const outboundAds = outbound.reduce((sum, s) => sum + Math.floor((s.ad_spend_cents || 0) / 100) * getConfig("pool_ad_spend_per_100"), 0);
                        const repeatCustomers = 0; // repeat customers metric not yet tracked

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

                        const totalInbound = inbound.reduce((sum, s) => {
                          const planPool = s.plan === "premium" ? getConfig("pool_inbound_premium") : getConfig("pool_inbound_basic");
                          const adPool = Math.floor((s.ad_spend_cents || 0) / 100) * getConfig("pool_ad_spend_per_100");
                          return sum + planPool + adPool;
                        }, 0);
                        const totalOutbound = outbound.reduce((sum, s) => {
                          const planPool = s.plan === "premium" ? getConfig("pool_outbound_premium") : getConfig("pool_outbound_basic");
                          const adPool = Math.floor((s.ad_spend_cents || 0) / 100) * getConfig("pool_ad_spend_per_100");
                          return sum + planPool + adPool;
                        }, 0);
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
                    {["division", "state", "city"].map(v => (
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

              {/* TOP LOCATIONS BY REVENUE - 3 Small Cards */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                  <span>💵</span> Top Locations by Revenue (Package + Ad Sales)
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                  {(() => {
                    // Revenue = plan price + ad spend per signup
                    const divTotals = divisions.map(d => {
                      const divSignups = filteredSignups.filter(s => s.division_id === d.id);
                      const revenue = divSignups.reduce((sum, s) => sum + getSignupRevenue(s), 0);
                      return { name: d.name, revenue };
                    }).sort((a, b) => b.revenue - a.revenue)[0] || { name: "—", revenue: 0 };

                    const stateTotals: Record<string, number> = {};
                    filteredSignups.forEach(s => {
                      if (s.state) {
                        stateTotals[s.state] = (stateTotals[s.state] || 0) + getSignupRevenue(s);
                      }
                    });
                    const topState = Object.entries(stateTotals).sort((a, b) => b[1] - a[1])[0] || ["—", 0];

                    const cityTotals: Record<string, number> = {};
                    filteredSignups.forEach(s => {
                      if (s.city) {
                        cityTotals[s.city] = (cityTotals[s.city] || 0) + getSignupRevenue(s);
                      }
                    });
                    const topCity = Object.entries(cityTotals).sort((a, b) => b[1] - a[1])[0] || ["—", 0];

                    return [
                      { label: "Top Division", name: divTotals.name, value: divTotals.revenue, color: COLORS.neonBlue },
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

              {/* TOP LOCATIONS BY SALES SPEND - 3 Small Cards */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                  <span>💰</span> Top Locations by Sales Spend (Commission + Bonus)
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                  {(() => {
                    // For commission, use the commission_cents from signups
                    // For bonus, we'll estimate based on pool share
                    
                    // Calculate commission totals by division
                    const divCommission = divisions.map(d => {
                      const divSignups = filteredSignups.filter(s => s.division_id === d.id);
                      const commission = divSignups.reduce((sum, s) => sum + (s.commission_cents || 0), 0);
                      return { name: d.name, spend: commission };
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
                        const rows: Array<{ division: string; state: string; city: string; basic: number; premium: number; packageAmt: number; adSpend: number; total: number }> = [];

                        filteredSignups.forEach(s => {
                          const zone = zones.find(z => z.id === s.zone_id);
                          const key = `${s.zone_id}-${s.state}-${s.city}`;
                          const existingIdx = rows.findIndex(r => `${zones.find(z => z.name === r.division)?.id}-${r.state}-${r.city}` === key);
                          
                          const packageAmt = s.plan === "basic" ? commissionRates.individual.basic_signup : commissionRates.individual.premium_signup;
                          
                          if (existingIdx >= 0) {
                            if (s.plan === "basic") rows[existingIdx].basic++;
                            else rows[existingIdx].premium++;
                            rows[existingIdx].packageAmt += packageAmt;
                            rows[existingIdx].adSpend += s.ad_spend_cents || 0;
                            rows[existingIdx].total += packageAmt + (s.ad_spend_cents || 0);
                          } else {
                            rows.push({
                              division: zone?.name || "—",
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
                        <td colSpan={3} style={{ padding: "12px 8px", fontWeight: 700 }}>TOTALS</td>
                        <td style={{ textAlign: "right", padding: "12px 8px", fontWeight: 700 }}>{filteredSignups.filter(s => s.plan === "basic").length}</td>
                        <td style={{ textAlign: "right", padding: "12px 8px", fontWeight: 700 }}>{filteredSignups.filter(s => s.plan === "premium").length}</td>
                        <td style={{ textAlign: "right", padding: "12px 8px", fontWeight: 700, color: COLORS.neonGreen }}>{formatMoney(filteredSignups.reduce((sum, s) => sum + (s.plan === "basic" ? commissionRates.individual.basic_signup : commissionRates.individual.premium_signup), 0))}</td>
                        <td style={{ textAlign: "right", padding: "12px 8px", fontWeight: 700, color: COLORS.neonOrange }}>{formatMoney(totalAdSpend)}</td>
                        <td style={{ textAlign: "right", padding: "12px 8px", fontWeight: 800, fontSize: 13, color: COLORS.neonPurple }}>{formatMoney(filteredSignups.reduce((sum, s) => sum + (s.plan === "basic" ? commissionRates.individual.basic_signup : commissionRates.individual.premium_signup) + (s.ad_spend_cents || 0), 0))}</td>
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
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid " + COLORS.cardBorder }}>
                        {["Name", "Role", "Division", "State", "County", "City", "Hire Date", "Supervisor", "Daily Quota", "Signups", "Bonus", "Status", ""].map(h => (
                          <th key={h} style={{ textAlign: "left", padding: "12px 8px", color: COLORS.textSecondary, fontWeight: 600, fontSize: 11, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {salesReps.map(rep => {
                        const isEditing = editingRepId === rep.id;
                        const countyName = rep.county_id ? counties.find(c => c.id === rep.county_id)?.name || "—" : "—";
                        return (
                          <tr key={rep.id} style={{ borderBottom: "1px solid " + COLORS.cardBorder }}>
                            <td style={{ padding: "10px 8px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <Avatar name={rep.name} initials={rep.avatar} />
                                <div><div style={{ fontWeight: 600 }}>{rep.name}</div><div style={{ fontSize: 11, color: COLORS.textSecondary }}>{rep.email}</div></div>
                              </div>
                            </td>
                            <td style={{ padding: "10px 8px" }}>
                              {isEditing ? (
                                <select value={editRepData.role || rep.role} onChange={(e) => setEditRepData({ ...editRepData, role: e.target.value })} style={{ padding: "4px 6px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 4, color: COLORS.textPrimary, fontSize: 11 }}>
                                  {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                </select>
                              ) : <span style={{ fontSize: 11 }}>{ROLE_LABELS[rep.role] || rep.role}</span>}
                            </td>
                            <td style={{ padding: "10px 8px", fontSize: 12 }}>
                              {isEditing ? (
                                <select value={editRepData.zone_id ?? rep.zone_id ?? ""} onChange={(e) => { const z = zones.find(zn => zn.id === e.target.value); setEditRepData({ ...editRepData, zone_id: e.target.value, division_id: z?.division_id || null, state: "", county_id: "" }); }} style={{ padding: "4px 6px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 4, color: COLORS.textPrimary, fontSize: 11, maxWidth: 120 }}>
                                  <option value="">—</option>
                                  {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                                </select>
                              ) : getDivisionName(rep.zone_id)}
                            </td>
                            <td style={{ padding: "10px 8px", fontSize: 12 }}>
                              {isEditing ? (
                                <select value={editRepData.state ?? rep.state ?? ""} onChange={(e) => setEditRepData({ ...editRepData, state: e.target.value, county_id: "" })} style={{ padding: "4px 6px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 4, color: COLORS.textPrimary, fontSize: 11, maxWidth: 80 }}>
                                  <option value="">—</option>
                                  {(() => { const zId = editRepData.zone_id ?? rep.zone_id; const zone = zones.find(z => z.id === zId); return (zone ? zone.states : [...new Set(counties.map(c => c.state))].sort()).map(s => <option key={s} value={s}>{s}</option>); })()}
                                </select>
                              ) : (rep.state || "—")}
                            </td>
                            <td style={{ padding: "10px 8px", fontSize: 12 }}>
                              {isEditing ? (
                                <select value={editRepData.county_id ?? rep.county_id ?? ""} onChange={(e) => setEditRepData({ ...editRepData, county_id: e.target.value })} style={{ padding: "4px 6px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 4, color: COLORS.textPrimary, fontSize: 11, maxWidth: 130 }} disabled={!(editRepData.state ?? rep.state)}>
                                  <option value="">—</option>
                                  {counties.filter(c => c.state === (editRepData.state ?? rep.state)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                              ) : countyName}
                            </td>
                            <td style={{ padding: "10px 8px", fontSize: 12 }}>
                              {isEditing ? (
                                <input value={editRepData.city ?? rep.city ?? ""} onChange={(e) => setEditRepData({ ...editRepData, city: e.target.value })} style={{ padding: "4px 6px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 4, color: COLORS.textPrimary, fontSize: 11, width: 80 }} />
                              ) : (rep.city || "—")}
                            </td>
                            <td style={{ padding: "10px 8px", fontSize: 12, whiteSpace: "nowrap" }}>
                              {rep.hire_date ? new Date(rep.hire_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                            </td>
                            <td style={{ padding: "10px 8px", fontSize: 12 }}>
                              {isEditing ? (
                                <select value={editRepData.supervisor_id ?? rep.supervisor_id ?? ""} onChange={(e) => setEditRepData({ ...editRepData, supervisor_id: e.target.value })} style={{ padding: "4px 6px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 4, color: COLORS.textPrimary, fontSize: 11, maxWidth: 120 }}>
                                  <option value="">—</option>
                                  {salesReps.filter(r => r.status === "active" && r.id !== rep.id).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </select>
                              ) : getSupervisorName(rep.supervisor_id)}
                            </td>
                            <td style={{ padding: "10px 8px", fontSize: 12 }}>
                              {FIELD_ROLES.includes(rep.role) ? (() => {
                                const q = getRepDailyQuota(rep);
                                const hasOverride = rep.individual_quota != null;
                                if (isEditing && (rep.role === "team_lead" || rep.role === "in_training")) {
                                  return (
                                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        value={editRepData.individual_quota_str}
                                        onChange={(e) => { const val = e.target.value; if (val === "" || /^\d*\.?\d{0,2}$/.test(val)) setEditRepData({ ...editRepData, individual_quota_str: val }); }}
                                        placeholder={String(rep.role === "team_lead" ? commissionRates.daily.team_lead : commissionRates.daily.in_training)}
                                        style={{ padding: "4px 6px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 4, color: COLORS.textPrimary, fontSize: 11, width: 50 }}
                                      />
                                      <span style={{ fontSize: 9, color: COLORS.textSecondary }}>blank = global</span>
                                    </div>
                                  );
                                }
                                return (
                                  <span style={{ fontWeight: 700, color: COLORS.neonPurple }}>
                                    {q % 1 === 0 ? q.toFixed(0) : q.toFixed(2)}
                                    {hasOverride && rep.role !== "sales_rep" && <span style={{ fontSize: 9, color: COLORS.neonOrange, marginLeft: 4 }}>override</span>}
                                  </span>
                                );
                              })() : "—"}
                            </td>
                            <td style={{ padding: "10px 8px", fontSize: 12 }}>
                              {FIELD_ROLES.includes(rep.role) ? getRepPerformance(rep.id).total : "—"}
                            </td>
                            <td style={{ padding: "10px 8px", fontSize: 12 }}>
                              {(() => {
                                if (!FIELD_ROLES.includes(rep.role)) return "—";
                                const perf = getRepPerformance(rep.id);
                                const bonusDaily = getRepBonusDaily(rep.role);
                                const threshold = Math.round(bonusDaily * 30);
                                const isEligible = perf.total >= threshold;
                                return isEligible
                                  ? <span style={{ color: COLORS.neonGreen, fontWeight: 700 }}>✓ Eligible</span>
                                  : <span style={{ color: COLORS.textSecondary }}>Need {threshold - perf.total} more</span>;
                              })()}
                            </td>
                            <td style={{ padding: "10px 8px" }}>
                              {isEditing ? (
                                <select value={editRepData.status ?? rep.status} onChange={(e) => setEditRepData({ ...editRepData, status: e.target.value })} style={{ padding: "4px 6px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 4, color: COLORS.textPrimary, fontSize: 11 }}>
                                  {["active", "inactive", "terminated"].map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                              ) : <Badge status={rep.status} />}
                            </td>
                            <td style={{ padding: "10px 8px", whiteSpace: "nowrap" }}>
                              {isEditing ? (
                                <div style={{ display: "flex", gap: 4 }}>
                                  <button onClick={() => handleSaveRepEdit(rep.id)} style={{ padding: "5px 10px", background: COLORS.neonGreen, border: "none", borderRadius: 4, color: "#000", cursor: "pointer", fontSize: 10, fontWeight: 700 }}>Save</button>
                                  <button onClick={() => setEditingRepId(null)} style={{ padding: "5px 10px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 4, color: COLORS.textSecondary, cursor: "pointer", fontSize: 10 }}>Cancel</button>
                                </div>
                              ) : (
                                <div style={{ display: "flex", gap: 4 }}>
                                  <button onClick={() => { setEditingRepId(rep.id); setEditRepData({ role: rep.role, zone_id: rep.zone_id, state: rep.state, county_id: rep.county_id, city: rep.city, supervisor_id: rep.supervisor_id, individual_quota_str: rep.individual_quota != null ? String(rep.individual_quota) : "", status: rep.status } as Partial<SalesRep> & { individual_quota_str: string }); }} style={{ padding: "5px 10px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 4, color: COLORS.neonBlue, cursor: "pointer", fontSize: 10, fontWeight: 600 }}>Edit</button>
                                  <button onClick={() => setSelectedRep(rep)} style={{ padding: "5px 10px", background: COLORS.gradient1, border: "none", borderRadius: 4, color: "#fff", cursor: "pointer", fontSize: 10, fontWeight: 600 }}>View</button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
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

                  {/* Division Filter */}
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, textTransform: "uppercase", fontWeight: 600 }}>Division</label>
                    <select
                      value={signupFilters.zone}
                      onChange={(e) => setSignupFilters({ ...signupFilters, zone: e.target.value })}
                      style={{ width: "100%", padding: "10px 14px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, fontSize: 13 }}
                    >
                      <option value="all">All Divisions</option>
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
                      { key: "zone_id", label: "Division", render: (v: unknown) => getDivisionName(String(v)) },
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

          {/* BONUS POOL TAB - with Eligible section, Original Signup date, Previous Months */}
          {salesTab === "bonuspool" && (
            <>
              <Card title={`🏆 ${computedPoolData.quarter} Bonus Pool`} style={{ marginBottom: 24 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 24 }}>
                  <div>
                    <div style={{ fontSize: 48, fontWeight: 800, color: COLORS.neonPurple }}>{formatMoney(computedPoolData.total_pool_cents)}</div>
                    <div style={{ color: COLORS.textSecondary, marginBottom: 16 }}>Current Pool Balance</div>
                    <div style={{ padding: 16, background: "rgba(57,255,20,0.1)", borderRadius: 12, border: "1px solid " + COLORS.neonGreen }}>
                      <div style={{ fontSize: 12, color: COLORS.textSecondary }}>Projected Per-Rep Payout</div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: COLORS.neonGreen }}>{formatMoney(computedPoolData.projected_per_rep_cents)}</div>
                      <div style={{ fontSize: 11, color: COLORS.textSecondary }}>Split between {eligibleReps.length} eligible reps</div>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Pool Breakdown</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div style={{ padding: 16, background: COLORS.darkBg, borderRadius: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.neonBlue, marginBottom: 12 }}>📥 Inbound</div>
                        <div style={{ fontSize: 13 }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span>Basic</span><span>{formatMoney(computedPoolData.inbound_basic_cents)}</span></div><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span>Premium</span><span>{formatMoney(computedPoolData.inbound_premium_cents)}</span></div><div style={{ display: "flex", justifyContent: "space-between" }}><span>Ad Spend</span><span>{formatMoney(computedPoolData.inbound_ads_cents)}</span></div></div>
                      </div>
                      <div style={{ padding: 16, background: COLORS.darkBg, borderRadius: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.neonGreen, marginBottom: 12 }}>📤 Rep</div>
                        <div style={{ fontSize: 13 }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span>Basic</span><span>{formatMoney(computedPoolData.rep_basic_cents)}</span></div><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span>Premium</span><span>{formatMoney(computedPoolData.rep_premium_cents)}</span></div><div style={{ display: "flex", justifyContent: "space-between" }}><span>Ad Spend</span><span>{formatMoney(computedPoolData.rep_ads_cents)}</span></div></div>
                      </div>
                      <div style={{ padding: 16, background: COLORS.darkBg, borderRadius: 12, gridColumn: "1 / -1" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.neonOrange, marginBottom: 8 }}>🔄 Repeat Customer Bonus</div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span>{formatMoney(getConfig("pool_repeat_monthly"))}/repeat/month</span><span style={{ fontWeight: 700 }}>{formatMoney(computedPoolData.repeat_customers_cents)}</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* ELIGIBLE FOR BONUS SECTION */}
              <Card title="✓ Eligible for Bonus" style={{ marginBottom: 24 }}>
                {eligibleReps.length === 0 ? <div style={{ padding: 20, textAlign: "center", color: COLORS.textSecondary }}>No reps have reached the bonus eligibility threshold yet</div> : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                    {eligibleReps.map((rep) => {
                      const perf = getRepPerformance(rep.id);
                      return (
                        <div key={rep.id} style={{ padding: 20, background: "rgba(57,255,20,0.05)", borderRadius: 12, border: "1px solid " + COLORS.neonGreen }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}><Avatar name={rep.name} initials={rep.avatar} /><div><div style={{ fontWeight: 700 }}>{rep.name}</div><div style={{ fontSize: 12, color: COLORS.neonGreen }}>✓ {perf.total} signups</div></div></div>
                          <div style={{ fontSize: 24, fontWeight: 800, color: COLORS.neonGreen }}>+{formatMoney(computedPoolData.projected_per_rep_cents)}</div>
                          <div style={{ fontSize: 11, color: COLORS.textSecondary }}>Projected monthly bonus</div>
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
                        const threshold = getRepBonusThreshold(rep);
                        const need = threshold - perf.total;
                        return <span key={rep.id} style={{ fontSize: 13 }}><strong>{rep.name}:</strong> {perf.total}/{threshold} (need {need} more)</span>;
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
                    const currentPool = computedPoolData.total_pool_cents;
                    const avgBasicContrib = getConfig("pool_outbound_basic");
                    const avgPremiumContrib = getConfig("pool_outbound_premium");
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

              {/* PREVIOUS MONTHS */}
              <Card title="📊 Previous Months">
                {previousPools.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary }}>No previous months</div> : (
                  <DataTable columns={[
                    { key: "quarter", label: "Month" },
                    { key: "total_pool_cents", label: "Total Pool", render: (v: unknown) => <span style={{ fontWeight: 700 }}>{formatMoney(Number(v))}</span> },
                    { key: "eligible_rep_ids", label: "Eligible Reps", render: (v: unknown) => ((v as string[]) || []).length || 0 },
                    { key: "projected_per_rep_cents", label: "Per-Rep Payout", render: (v: unknown) => <span style={{ color: COLORS.neonGreen, fontWeight: 700 }}>{formatMoney(Number(v))}</span> },
                    { key: "status", label: "Status", render: (v: unknown) => <Badge status={String(v)} /> },
                  ]} data={previousPools} />
                )}
              </Card>

              {/* HISTORICAL MONTH COMPARISON */}
              {previousPools.length > 0 && (
                <Card title="📊 Month-over-Month Comparison" style={{ marginBottom: 24 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
                    {[computedPoolData as BonusPool, ...previousPools.slice(0, 3)].filter(Boolean).map((pool, i) => {
                      const prevPool = i < 3 ? [computedPoolData as BonusPool, ...previousPools][i + 1] : null;
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

          {/* QUOTAS TAB - Business Geography + State/City Breakdowns */}
          {salesTab === "quotas" && (
            <>
              {/* Business Geography — Division cards + Summary wired from rep daily quotas */}
              {(() => {
                // Days elapsed this year (for YTD attainment)
                const yearStart = new Date(new Date().getFullYear(), 0, 1);
                const daysElapsedYTD = Math.max(1, Math.floor((Date.now() - yearStart.getTime()) / (1000 * 60 * 60 * 24)));
                // YTD signups (all signups this year, not period-filtered)
                const ytdSignups = signups.filter(s => new Date(s.signed_at) >= yearStart);

                const divData = zones.map(z => {
                  const divSignups = filteredSignups.filter(s => s.zone_id === z.id);
                  const signupCount = divSignups.length;
                  const ytdDivSignups = ytdSignups.filter(s => s.zone_id === z.id).length;
                  const totalSales = divSignups.reduce((sum, s) => sum + (s.commission_cents || 0) + (s.ad_spend_cents || 0), 0);
                  // Division daily quota from rep rollup (sum of per-rep Settings quotas)
                  const rollup = quotaRollup.byDivision[z.division_id];
                  const dailyQuota = rollup?.totalQuota || 0;
                  const ytdTarget = dailyQuota * daysElapsedYTD;
                  const ytdAttainment = ytdTarget > 0 ? (ytdDivSignups / ytdTarget) * 100 : 0;
                  return { id: z.id, divisionId: z.division_id, name: z.name, states: z.states, dailyQuota, signupCount, ytdSignups: ytdDivSignups, ytdAttainment, totalSales, repCount: rollup?.repCount || 0, color: divisionColors[z.name] || COLORS.neonBlue };
                });
                const grandTotalDailyQuota = divData.reduce((sum, d) => sum + d.dailyQuota, 0);
                const grandTotalSignups = divData.reduce((sum, d) => sum + d.signupCount, 0);
                const grandTotalSales = divData.reduce((sum, d) => sum + d.totalSales, 0);

                // State-level breakdown with quota from rollup
                const stateRows = Object.values(quotaRollup.byState).map(st => {
                  const zone = zones.find(z => z.states.includes(st.state));
                  const divName = zone ? (divisions.find(d => d.id === zone.division_id)?.name || "—") : "—";
                  const divColor = divisionColors[divName] || COLORS.neonBlue;
                  const stSignups = filteredSignups.filter(s => s.state === st.state);
                  return { state: st.state, division: divName, divColor, dailyQuota: st.totalQuota, repCount: st.repCount, countyCount: st.countyCount, signups: stSignups.length, sales: stSignups.reduce((sum, s) => sum + (s.commission_cents || 0) + (s.ad_spend_cents || 0), 0) };
                }).sort((a, b) => b.dailyQuota - a.dailyQuota);
                // Also include states with signups but no reps assigned
                const statesWithReps = new Set(stateRows.map(r => r.state));
                const signupOnlyStates: typeof stateRows = [];
                filteredSignups.forEach(s => {
                  if (s.state && !statesWithReps.has(s.state)) {
                    const existing = signupOnlyStates.find(r => r.state === s.state);
                    if (existing) { existing.signups++; existing.sales += (s.commission_cents || 0) + (s.ad_spend_cents || 0); }
                    else {
                      const zone = zones.find(z => z.states.includes(s.state!));
                      const divName = zone ? (divisions.find(d => d.id === zone.division_id)?.name || "—") : "—";
                      signupOnlyStates.push({ state: s.state, division: divName, divColor: divisionColors[divName] || COLORS.neonBlue, dailyQuota: 0, repCount: 0, countyCount: 0, signups: 1, sales: (s.commission_cents || 0) + (s.ad_spend_cents || 0) });
                    }
                  }
                });
                const allStateRows = [...stateRows, ...signupOnlyStates];

                // County-level breakdown from rollup
                const countyRows = Object.values(quotaRollup.byCounty).map(c => {
                  const zone = zones.find(z => z.states.includes(c.county.state));
                  const divName = zone ? (divisions.find(d => d.id === zone.division_id)?.name || "—") : "—";
                  const divColor = divisionColors[divName] || COLORS.neonBlue;
                  return { name: c.county.name, state: c.county.state, division: divName, divColor, dailyQuota: c.totalQuota, repCount: c.repCount };
                }).sort((a, b) => b.dailyQuota - a.dailyQuota);

                // City-level breakdown (from rep assignments + signups)
                const cityMap: Record<string, { city: string; state: string; division: string; divColor: string; signups: number; sales: number; dailyQuota: number; repCount: number }> = {};
                // Seed from rep assignments so cities appear even with 0 signups
                salesReps.filter(r => r.city && r.status === "active").forEach(r => {
                  const st = r.state || "";
                  const key = `${r.city}|${st}`;
                  if (!cityMap[key]) {
                    const zone = zones.find(z => z.states.includes(st));
                    const divName = zone ? (divisions.find(d => d.id === zone.division_id)?.name || "—") : "—";
                    cityMap[key] = { city: r.city!, state: st, division: divName, divColor: divisionColors[divName] || COLORS.neonBlue, signups: 0, sales: 0, dailyQuota: 0, repCount: 0 };
                  }
                  cityMap[key].dailyQuota += getRepDailyQuota(r);
                  cityMap[key].repCount++;
                });
                // Add signup data
                filteredSignups.forEach(s => {
                  const key = `${s.city || "Unknown"}|${s.state || ""}`;
                  if (!cityMap[key]) {
                    const zone = zones.find(z => z.id === s.zone_id);
                    const divName = zone?.name || "Unknown";
                    cityMap[key] = { city: s.city || "Unknown", state: s.state || "", division: divName, divColor: divisionColors[divName] || COLORS.neonBlue, signups: 0, sales: 0, dailyQuota: 0, repCount: 0 };
                  }
                  cityMap[key].signups++;
                  cityMap[key].sales += (s.commission_cents || 0) + (s.ad_spend_cents || 0);
                });
                const cityRows = Object.values(cityMap).sort((a, b) => b.dailyQuota - a.dailyQuota || b.signups - a.signups);

                return (
                  <>
                    {/* Division Cards + Summary Table */}
                    <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr", gap: 20, marginBottom: 24 }}>
                      {/* Left: 3x2 Division Cards */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gridTemplateRows: "repeat(2, 1fr)", gap: 14 }}>
                        {divData.map((div, i) => {
                          const fullNames = div.states.map(s => stateNames[s] || s);
                          const half = Math.ceil(fullNames.length / 2);
                          const col1 = fullNames.slice(0, half);
                          const col2 = fullNames.slice(half);
                          return (
                            <div key={div.id} style={{ background: "linear-gradient(135deg, " + COLORS.darkBg + " 0%, rgba(45,45,68,0.6) 100%)", borderRadius: 14, border: "1px solid " + COLORS.cardBorder, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                              <div style={{ height: 3, background: div.color }} />
                              <div style={{ padding: "16px 18px 14px", flex: 1, display: "flex", flexDirection: "column" }}>
                                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
                                  <div style={{ fontSize: 20, fontWeight: 800, color: div.color, letterSpacing: "-0.02em" }}>{div.name}</div>
                                  <div style={{ fontSize: 11, color: div.color, opacity: 0.5, fontWeight: 600 }}>#{i + 1}</div>
                                </div>
                                <div style={{ display: "flex", flex: 1, gap: 0 }}>
                                  <div style={{ display: "flex", gap: 16, flex: 1, padding: "4px 0" }}>
                                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.7 }}>{col1.map((name, j) => <div key={j}>{name}</div>)}</div>
                                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.7 }}>{col2.map((name, j) => <div key={j}>{name}</div>)}</div>
                                  </div>
                                  <div style={{ width: 1, background: "rgba(255,255,255,0.08)", margin: "0 14px", alignSelf: "stretch" }} />
                                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minWidth: 90, gap: 6 }}>
                                    <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "8px 12px", textAlign: "center", width: "100%" }}>
                                      <div style={{ fontSize: 26, fontWeight: 900, color: COLORS.neonPurple, letterSpacing: "-0.03em" }}>{div.dailyQuota.toFixed(1)}</div>
                                      <div style={{ fontSize: 9, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 600 }}>daily quota</div>
                                    </div>
                                    <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "8px 12px", textAlign: "center", width: "100%" }}>
                                      <div style={{ fontSize: 26, fontWeight: 900, color: COLORS.neonBlue, letterSpacing: "-0.03em" }}>{div.repCount}</div>
                                      <div style={{ fontSize: 9, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 600 }}>reps</div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {/* 6th slot: Total Quota card */}
                        {divData.length < 6 && (() => {
                          return (
                            <div style={{ background: "linear-gradient(135deg, " + COLORS.darkBg + " 0%, rgba(45,45,68,0.6) 100%)", borderRadius: 14, border: "1px solid " + COLORS.cardBorder, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                              <div style={{ height: 3, background: "linear-gradient(90deg, " + COLORS.neonPink + ", " + COLORS.neonBlue + ", " + COLORS.neonGreen + ")" }} />
                              <div style={{ padding: "10px 18px 16px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 12 }}>
                                <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", textAlign: "center", letterSpacing: "-0.02em" }}>Company Totals</div>
                                <div style={{ display: "flex", gap: 14, width: "100%" }}>
                                <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "14px 18px", textAlign: "center", flex: 1 }}>
                                  <div style={{ fontSize: 36, fontWeight: 900, color: COLORS.neonPurple, letterSpacing: "-0.03em" }}>{grandTotalDailyQuota.toFixed(1)}</div>
                                  <div style={{ fontSize: 9, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 600, marginTop: 4 }}>daily quota</div>
                                  <div style={{ fontSize: 10, color: COLORS.textSecondary, marginTop: 2 }}>{(grandTotalDailyQuota * 30).toFixed(0)}/mo</div>
                                </div>
                                <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "14px 18px", textAlign: "center", flex: 1 }}>
                                  <div style={{ fontSize: 36, fontWeight: 900, color: COLORS.neonBlue, letterSpacing: "-0.03em" }}>{divData.reduce((s, d) => s + d.repCount, 0)}</div>
                                  <div style={{ fontSize: 9, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 600, marginTop: 4 }}>total reps</div>
                                  <div style={{ fontSize: 10, color: COLORS.textSecondary, marginTop: 2 }}>{divData.length} divisions</div>
                                </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Right: Summary Table */}
                      <div style={{ background: "linear-gradient(135deg, " + COLORS.darkBg + " 0%, rgba(45,45,68,0.6) 100%)", borderRadius: 14, border: "1px solid " + COLORS.cardBorder, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                        <div style={{ height: 3, background: "linear-gradient(90deg, " + COLORS.neonPurple + ", " + COLORS.neonBlue + ")" }} />
                        <div style={{ padding: "18px 16px", flex: 1, display: "flex", flexDirection: "column" }}>
                          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, letterSpacing: "-0.01em" }}>Division Summary</div>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, flex: 1 }}>
                            <thead>
                              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                                <th style={{ textAlign: "left", padding: "8px 4px", color: COLORS.textSecondary, fontSize: 10, fontWeight: 600, textTransform: "uppercase" }}>Division</th>
                                <th style={{ textAlign: "right", padding: "8px 4px", color: COLORS.textSecondary, fontSize: 10, fontWeight: 600, textTransform: "uppercase" }}>Signups</th>
                                <th style={{ textAlign: "right", padding: "8px 4px", color: COLORS.textSecondary, fontSize: 10, fontWeight: 600, textTransform: "uppercase" }}>Daily</th>
                                <th style={{ textAlign: "right", padding: "8px 4px", color: COLORS.textSecondary, fontSize: 10, fontWeight: 600, textTransform: "uppercase" }}>Wkly</th>
                                <th style={{ textAlign: "right", padding: "8px 4px", color: COLORS.textSecondary, fontSize: 10, fontWeight: 600, textTransform: "uppercase" }}>Mthly</th>
                                <th style={{ textAlign: "right", padding: "8px 4px", color: COLORS.textSecondary, fontSize: 10, fontWeight: 600, textTransform: "uppercase" }}>Qtrly</th>
                                <th style={{ textAlign: "right", padding: "8px 4px", color: COLORS.textSecondary, fontSize: 10, fontWeight: 600, textTransform: "uppercase" }}>Yearly</th>
                                <th style={{ textAlign: "right", padding: "8px 4px", color: COLORS.textSecondary, fontSize: 10, fontWeight: 600, textTransform: "uppercase" }}>YTD %</th>
                              </tr>
                            </thead>
                            <tbody>
                              {divData.map((div) => (
                                <tr key={div.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                  <td style={{ padding: "10px 4px", fontWeight: 700, color: div.color, fontSize: 11 }}>{div.name}</td>
                                  <td style={{ textAlign: "right", padding: "10px 4px", fontWeight: 700, color: "#fff" }}>{div.signupCount}</td>
                                  <td style={{ textAlign: "right", padding: "10px 4px", color: COLORS.neonPurple, fontWeight: 700 }}>{div.dailyQuota.toFixed(1)}</td>
                                  <td style={{ textAlign: "right", padding: "10px 4px", color: "rgba(255,255,255,0.6)" }}>{(div.dailyQuota * 7).toFixed(0)}</td>
                                  <td style={{ textAlign: "right", padding: "10px 4px", color: "rgba(255,255,255,0.6)" }}>{(div.dailyQuota * 30).toFixed(0)}</td>
                                  <td style={{ textAlign: "right", padding: "10px 4px", color: "rgba(255,255,255,0.6)" }}>{(div.dailyQuota * 90).toFixed(0)}</td>
                                  <td style={{ textAlign: "right", padding: "10px 4px", color: "rgba(255,255,255,0.6)" }}>{(div.dailyQuota * 365).toFixed(0)}</td>
                                  <td style={{ textAlign: "right", padding: "10px 4px", fontWeight: 800, fontSize: 12, color: div.ytdAttainment >= 100 ? COLORS.neonGreen : div.ytdAttainment >= 50 ? COLORS.neonYellow : div.dailyQuota > 0 ? "#ff6b6b" : "rgba(255,255,255,0.3)" }}>{div.dailyQuota > 0 ? div.ytdAttainment.toFixed(1) + "%" : "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              {(() => {
                                const totalYtdTarget = grandTotalDailyQuota * daysElapsedYTD;
                                const totalYtdSignups = divData.reduce((s, d) => s + d.ytdSignups, 0);
                                const totalYtdPct = totalYtdTarget > 0 ? (totalYtdSignups / totalYtdTarget) * 100 : 0;
                                return (
                              <tr style={{ borderTop: "2px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)" }}>
                                <td style={{ padding: "12px 4px", fontWeight: 800, fontSize: 12, color: "#fff" }}>Total</td>
                                <td style={{ textAlign: "right", padding: "12px 4px", fontWeight: 800, fontSize: 12, color: "#fff" }}>{grandTotalSignups}</td>
                                <td style={{ textAlign: "right", padding: "12px 4px", fontWeight: 800, fontSize: 12, color: COLORS.neonPurple }}>{grandTotalDailyQuota.toFixed(1)}</td>
                                <td style={{ textAlign: "right", padding: "12px 4px", fontWeight: 800, fontSize: 12, color: "#fff" }}>{(grandTotalDailyQuota * 7).toFixed(0)}</td>
                                <td style={{ textAlign: "right", padding: "12px 4px", fontWeight: 800, fontSize: 12, color: "#fff" }}>{(grandTotalDailyQuota * 30).toFixed(0)}</td>
                                <td style={{ textAlign: "right", padding: "12px 4px", fontWeight: 800, fontSize: 12, color: "#fff" }}>{(grandTotalDailyQuota * 90).toFixed(0)}</td>
                                <td style={{ textAlign: "right", padding: "12px 4px", fontWeight: 800, fontSize: 12, color: "#fff" }}>{(grandTotalDailyQuota * 365).toFixed(0)}</td>
                                <td style={{ textAlign: "right", padding: "12px 4px", fontWeight: 900, fontSize: 12, color: totalYtdPct >= 100 ? COLORS.neonGreen : totalYtdPct >= 50 ? COLORS.neonYellow : grandTotalDailyQuota > 0 ? "#ff6b6b" : "rgba(255,255,255,0.3)" }}>{grandTotalDailyQuota > 0 ? totalYtdPct.toFixed(1) + "%" : "—"}</td>
                              </tr>
                                );
                              })()}
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    </div>

                    {/* State-Level Breakdown */}
                    {(() => {
                      const filteredStateRows = allStateRows.filter(r => {
                        if (stateFilterDiv !== "all" && r.division !== stateFilterDiv) return false;
                        if (stateFilterSearch && !(stateNames[r.state] || r.state).toLowerCase().includes(stateFilterSearch.toLowerCase())) return false;
                        return true;
                      });
                      return (
                    <div style={{ background: "linear-gradient(135deg, " + COLORS.darkBg + " 0%, rgba(45,45,68,0.6) 100%)", borderRadius: 14, border: "1px solid " + COLORS.cardBorder, overflow: "hidden", marginBottom: 24 }}>
                      <div style={{ height: 3, background: "linear-gradient(90deg, " + COLORS.neonPurple + ", " + COLORS.neonPink + ")" }} />
                      <div style={{ padding: "18px 20px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em" }}>State Breakdown</div>
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <input placeholder="Search states..." value={stateFilterSearch} onChange={e => setStateFilterSearch(e.target.value)} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: "#fff", fontSize: 12, width: 140 }} />
                            <select value={stateFilterDiv} onChange={e => setStateFilterDiv(e.target.value)} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: "#fff", fontSize: 12 }}>
                              <option value="all">All Divisions</option>
                              {divData.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                            </select>
                          </div>
                        </div>
                        {filteredStateRows.length === 0 ? (
                          <div style={{ padding: 20, textAlign: "center", color: COLORS.textSecondary }}>No quota data yet — assign reps to counties</div>
                        ) : (
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                            <thead>
                              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                                <th style={{ textAlign: "left", padding: "10px 8px", color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>State</th>
                                <th style={{ textAlign: "left", padding: "10px 8px", color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>Division</th>
                                <th style={{ textAlign: "right", padding: "10px 8px", color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>Signups</th>
                                <th style={{ textAlign: "right", padding: "10px 8px", color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>Daily</th>
                                <th style={{ textAlign: "right", padding: "10px 8px", color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>Wkly</th>
                                <th style={{ textAlign: "right", padding: "10px 8px", color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>Mthly</th>
                                <th style={{ textAlign: "right", padding: "10px 8px", color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>Qtrly</th>
                                <th style={{ textAlign: "right", padding: "10px 8px", color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>Yearly</th>
                                <th style={{ textAlign: "right", padding: "10px 8px", color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>Reps</th>
                                <th style={{ textAlign: "right", padding: "10px 8px", color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>Counties</th>
                                <th style={{ textAlign: "right", padding: "10px 8px", color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>YTD %</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredStateRows.map((row, i) => {
                                const stYtdSignups = ytdSignups.filter(s => s.state === row.state).length;
                                const stYtdTarget = row.dailyQuota * daysElapsedYTD;
                                const stYtdPct = stYtdTarget > 0 ? (stYtdSignups / stYtdTarget) * 100 : 0;
                                return (
                                <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                  <td style={{ padding: "10px 8px", fontWeight: 600 }}>{stateNames[row.state] || row.state}</td>
                                  <td style={{ padding: "10px 8px", color: row.divColor, fontWeight: 600, fontSize: 12 }}>{row.division}</td>
                                  <td style={{ textAlign: "right", padding: "10px 8px", fontWeight: 700, color: "#fff" }}>{row.signups}</td>
                                  <td style={{ textAlign: "right", padding: "10px 8px", fontWeight: 700, color: COLORS.neonPurple }}>{row.dailyQuota % 1 === 0 ? row.dailyQuota.toFixed(0) : row.dailyQuota.toFixed(2)}</td>
                                  <td style={{ textAlign: "right", padding: "10px 8px", color: "rgba(255,255,255,0.6)" }}>{(row.dailyQuota * 7).toFixed(0)}</td>
                                  <td style={{ textAlign: "right", padding: "10px 8px", color: "rgba(255,255,255,0.6)" }}>{(row.dailyQuota * 30).toFixed(0)}</td>
                                  <td style={{ textAlign: "right", padding: "10px 8px", color: "rgba(255,255,255,0.6)" }}>{(row.dailyQuota * 90).toFixed(0)}</td>
                                  <td style={{ textAlign: "right", padding: "10px 8px", color: "rgba(255,255,255,0.6)" }}>{(row.dailyQuota * 365).toFixed(0)}</td>
                                  <td style={{ textAlign: "right", padding: "10px 8px", color: "rgba(255,255,255,0.6)" }}>{row.repCount}</td>
                                  <td style={{ textAlign: "right", padding: "10px 8px", color: "rgba(255,255,255,0.6)" }}>{row.countyCount}</td>
                                  <td style={{ textAlign: "right", padding: "10px 8px", fontWeight: 800, fontSize: 12, color: stYtdPct >= 100 ? COLORS.neonGreen : stYtdPct >= 50 ? COLORS.neonYellow : row.dailyQuota > 0 ? "#ff6b6b" : "rgba(255,255,255,0.3)" }}>{row.dailyQuota > 0 ? stYtdPct.toFixed(1) + "%" : "—"}</td>
                                </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              {(() => {
                                const tq = filteredStateRows.reduce((s, r) => s + r.dailyQuota, 0);
                                const tSu = filteredStateRows.reduce((s, r) => s + r.signups, 0);
                                const tYtdSu = filteredStateRows.reduce((s, r) => s + ytdSignups.filter(sg => sg.state === r.state).length, 0);
                                const tYtdTarget = tq * daysElapsedYTD;
                                const tYtdPct = tYtdTarget > 0 ? (tYtdSu / tYtdTarget) * 100 : 0;
                                return (
                              <tr style={{ borderTop: "2px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)" }}>
                                <td style={{ padding: "14px 8px", fontWeight: 800, fontSize: 13, color: "#fff" }}>Total</td>
                                <td style={{ padding: "14px 8px", fontWeight: 800, fontSize: 13, color: COLORS.textSecondary }}>{filteredStateRows.length} states</td>
                                <td style={{ textAlign: "right", padding: "14px 8px", fontWeight: 800, fontSize: 13, color: "#fff" }}>{tSu}</td>
                                <td style={{ textAlign: "right", padding: "14px 8px", fontWeight: 800, fontSize: 13, color: COLORS.neonPurple }}>{tq % 1 === 0 ? tq.toFixed(0) : tq.toFixed(2)}</td>
                                <td style={{ textAlign: "right", padding: "14px 8px", fontWeight: 800, fontSize: 13, color: "#fff" }}>{(tq * 7).toFixed(0)}</td>
                                <td style={{ textAlign: "right", padding: "14px 8px", fontWeight: 800, fontSize: 13, color: "#fff" }}>{(tq * 30).toFixed(0)}</td>
                                <td style={{ textAlign: "right", padding: "14px 8px", fontWeight: 800, fontSize: 13, color: "#fff" }}>{(tq * 90).toFixed(0)}</td>
                                <td style={{ textAlign: "right", padding: "14px 8px", fontWeight: 800, fontSize: 13, color: "#fff" }}>{(tq * 365).toFixed(0)}</td>
                                <td style={{ textAlign: "right", padding: "14px 8px", fontWeight: 800, fontSize: 13, color: "#fff" }}>{filteredStateRows.reduce((s, r) => s + r.repCount, 0)}</td>
                                <td style={{ textAlign: "right", padding: "14px 8px", fontWeight: 800, fontSize: 13, color: "#fff" }}>{filteredStateRows.reduce((s, r) => s + r.countyCount, 0)}</td>
                                <td style={{ textAlign: "right", padding: "14px 8px", fontWeight: 900, fontSize: 12, color: tYtdPct >= 100 ? COLORS.neonGreen : tYtdPct >= 50 ? COLORS.neonYellow : tq > 0 ? "#ff6b6b" : "rgba(255,255,255,0.3)" }}>{tq > 0 ? tYtdPct.toFixed(1) + "%" : "—"}</td>
                              </tr>
                                );
                              })()}
                            </tfoot>
                          </table>
                        )}
                      </div>
                    </div>
                      );
                    })()}

                    {/* County-Level Breakdown */}
                    {(() => {
                      const countyStates = [...new Set(countyRows.map(r => r.state))].sort();
                      const filteredCountyRows = countyRows.filter(r => {
                        if (countyFilterDiv !== "all" && r.division !== countyFilterDiv) return false;
                        if (countyFilterState !== "all" && r.state !== countyFilterState) return false;
                        if (countyFilterSearch && !r.name.toLowerCase().includes(countyFilterSearch.toLowerCase())) return false;
                        return true;
                      });
                      return (
                    <div style={{ background: "linear-gradient(135deg, " + COLORS.darkBg + " 0%, rgba(45,45,68,0.6) 100%)", borderRadius: 14, border: "1px solid " + COLORS.cardBorder, overflow: "hidden", marginBottom: 24 }}>
                      <div style={{ height: 3, background: "linear-gradient(90deg, " + COLORS.neonOrange + ", " + COLORS.neonYellow + ")" }} />
                      <div style={{ padding: "18px 20px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em" }}>County Breakdown</div>
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <input placeholder="Search counties..." value={countyFilterSearch} onChange={e => setCountyFilterSearch(e.target.value)} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: "#fff", fontSize: 12, width: 140 }} />
                            <select value={countyFilterDiv} onChange={e => { setCountyFilterDiv(e.target.value); setCountyFilterState("all"); }} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: "#fff", fontSize: 12 }}>
                              <option value="all">All Divisions</option>
                              {divData.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                            </select>
                            <select value={countyFilterState} onChange={e => setCountyFilterState(e.target.value)} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: "#fff", fontSize: 12 }}>
                              <option value="all">All States</option>
                              {countyStates.filter(st => countyFilterDiv === "all" || countyRows.some(r => r.state === st && r.division === countyFilterDiv)).map(st => <option key={st} value={st}>{stateNames[st] || st}</option>)}
                            </select>
                          </div>
                        </div>
                        {filteredCountyRows.length === 0 ? (
                          <div style={{ padding: 20, textAlign: "center", color: COLORS.textSecondary }}>No reps assigned to counties yet</div>
                        ) : (
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                            <thead>
                              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                                <th style={{ textAlign: "left", padding: "10px 8px", color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>County</th>
                                <th style={{ textAlign: "left", padding: "10px 8px", color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>State</th>
                                <th style={{ textAlign: "left", padding: "10px 8px", color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>Division</th>
                                <th style={{ textAlign: "right", padding: "10px 8px", color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>Daily</th>
                                <th style={{ textAlign: "right", padding: "10px 8px", color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>Wkly</th>
                                <th style={{ textAlign: "right", padding: "10px 8px", color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>Mthly</th>
                                <th style={{ textAlign: "right", padding: "10px 8px", color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>Qtrly</th>
                                <th style={{ textAlign: "right", padding: "10px 8px", color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>Yearly</th>
                                <th style={{ textAlign: "right", padding: "10px 8px", color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>Reps</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredCountyRows.map((row, i) => (
                                <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                  <td style={{ padding: "10px 8px", fontWeight: 600 }}>{row.name}</td>
                                  <td style={{ padding: "10px 8px", color: "rgba(255,255,255,0.6)" }}>{stateNames[row.state] || row.state}</td>
                                  <td style={{ padding: "10px 8px", color: row.divColor, fontWeight: 600, fontSize: 12 }}>{row.division}</td>
                                  <td style={{ textAlign: "right", padding: "10px 8px", fontWeight: 700, color: COLORS.neonPurple }}>{row.dailyQuota % 1 === 0 ? row.dailyQuota.toFixed(0) : row.dailyQuota.toFixed(2)}</td>
                                  <td style={{ textAlign: "right", padding: "10px 8px", color: "rgba(255,255,255,0.6)" }}>{(row.dailyQuota * 7).toFixed(0)}</td>
                                  <td style={{ textAlign: "right", padding: "10px 8px", color: "rgba(255,255,255,0.6)" }}>{(row.dailyQuota * 30).toFixed(0)}</td>
                                  <td style={{ textAlign: "right", padding: "10px 8px", color: "rgba(255,255,255,0.6)" }}>{(row.dailyQuota * 90).toFixed(0)}</td>
                                  <td style={{ textAlign: "right", padding: "10px 8px", color: "rgba(255,255,255,0.6)" }}>{(row.dailyQuota * 365).toFixed(0)}</td>
                                  <td style={{ textAlign: "right", padding: "10px 8px", color: "rgba(255,255,255,0.6)" }}>{row.repCount}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              {(() => {
                                const tq = filteredCountyRows.reduce((s, r) => s + r.dailyQuota, 0);
                                return (
                              <tr style={{ borderTop: "2px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)" }}>
                                <td style={{ padding: "14px 8px", fontWeight: 800, fontSize: 13, color: "#fff" }}>Total</td>
                                <td style={{ padding: "14px 8px", fontWeight: 800, fontSize: 13, color: COLORS.textSecondary }}>{[...new Set(filteredCountyRows.map(r => r.state))].length} states</td>
                                <td style={{ padding: "14px 8px", fontWeight: 800, fontSize: 13, color: COLORS.textSecondary }}>{filteredCountyRows.length} counties</td>
                                <td style={{ textAlign: "right", padding: "14px 8px", fontWeight: 800, fontSize: 13, color: COLORS.neonPurple }}>{tq % 1 === 0 ? tq.toFixed(0) : tq.toFixed(2)}</td>
                                <td style={{ textAlign: "right", padding: "14px 8px", fontWeight: 800, fontSize: 13, color: "#fff" }}>{(tq * 7).toFixed(0)}</td>
                                <td style={{ textAlign: "right", padding: "14px 8px", fontWeight: 800, fontSize: 13, color: "#fff" }}>{(tq * 30).toFixed(0)}</td>
                                <td style={{ textAlign: "right", padding: "14px 8px", fontWeight: 800, fontSize: 13, color: "#fff" }}>{(tq * 90).toFixed(0)}</td>
                                <td style={{ textAlign: "right", padding: "14px 8px", fontWeight: 800, fontSize: 13, color: "#fff" }}>{(tq * 365).toFixed(0)}</td>
                                <td style={{ textAlign: "right", padding: "14px 8px", fontWeight: 800, fontSize: 13, color: "#fff" }}>{filteredCountyRows.reduce((s, r) => s + r.repCount, 0)}</td>
                              </tr>
                                );
                              })()}
                            </tfoot>
                          </table>
                        )}
                      </div>
                    </div>
                      );
                    })()}

                    {/* City-Level Breakdown */}
                    {(() => {
                      const cityStates = [...new Set(cityRows.map(r => r.state))].sort();
                      const filteredCityRows = cityRows.filter(r => {
                        if (cityFilterDiv !== "all" && r.division !== cityFilterDiv) return false;
                        if (cityFilterState !== "all" && r.state !== cityFilterState) return false;
                        if (cityFilterSearch && !r.city.toLowerCase().includes(cityFilterSearch.toLowerCase())) return false;
                        return true;
                      });
                      return (
                    <div style={{ background: "linear-gradient(135deg, " + COLORS.darkBg + " 0%, rgba(45,45,68,0.6) 100%)", borderRadius: 14, border: "1px solid " + COLORS.cardBorder, overflow: "hidden", marginBottom: 24 }}>
                      <div style={{ height: 3, background: "linear-gradient(90deg, " + COLORS.neonBlue + ", " + COLORS.neonGreen + ")" }} />
                      <div style={{ padding: "18px 20px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em" }}>City Breakdown</div>
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <input placeholder="Search cities..." value={cityFilterSearch} onChange={e => setCityFilterSearch(e.target.value)} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: "#fff", fontSize: 12, width: 140 }} />
                            <select value={cityFilterDiv} onChange={e => { setCityFilterDiv(e.target.value); setCityFilterState("all"); }} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: "#fff", fontSize: 12 }}>
                              <option value="all">All Divisions</option>
                              {divData.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                            </select>
                            <select value={cityFilterState} onChange={e => setCityFilterState(e.target.value)} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: "#fff", fontSize: 12 }}>
                              <option value="all">All States</option>
                              {cityStates.filter(st => cityFilterDiv === "all" || cityRows.some(r => r.state === st && r.division === cityFilterDiv)).map(st => <option key={st} value={st}>{stateNames[st] || st}</option>)}
                            </select>
                          </div>
                        </div>
                        {filteredCityRows.length === 0 ? (
                          <div style={{ padding: 20, textAlign: "center", color: COLORS.textSecondary }}>No city data yet</div>
                        ) : (
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                            <thead>
                              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                                <th style={{ textAlign: "left", padding: "10px 8px", color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>City</th>
                                <th style={{ textAlign: "left", padding: "10px 8px", color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>State</th>
                                <th style={{ textAlign: "left", padding: "10px 8px", color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>Division</th>
                                <th style={{ textAlign: "right", padding: "10px 8px", color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>Daily</th>
                                <th style={{ textAlign: "right", padding: "10px 8px", color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>Wkly</th>
                                <th style={{ textAlign: "right", padding: "10px 8px", color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>Mthly</th>
                                <th style={{ textAlign: "right", padding: "10px 8px", color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>Qtrly</th>
                                <th style={{ textAlign: "right", padding: "10px 8px", color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>Yearly</th>
                                <th style={{ textAlign: "right", padding: "10px 8px", color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>Reps</th>
                                <th style={{ textAlign: "right", padding: "10px 8px", color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>Signups</th>
                                <th style={{ textAlign: "right", padding: "10px 8px", color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>Sales</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredCityRows.map((row, i) => (
                                <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                  <td style={{ padding: "10px 8px", fontWeight: 600 }}>{row.city}</td>
                                  <td style={{ padding: "10px 8px", color: "rgba(255,255,255,0.6)" }}>{stateNames[row.state] || row.state}</td>
                                  <td style={{ padding: "10px 8px", color: row.divColor, fontWeight: 600, fontSize: 12 }}>{row.division}</td>
                                  <td style={{ textAlign: "right", padding: "10px 8px", fontWeight: 700, color: COLORS.neonPurple }}>{row.dailyQuota % 1 === 0 ? row.dailyQuota.toFixed(0) : row.dailyQuota.toFixed(2)}</td>
                                  <td style={{ textAlign: "right", padding: "10px 8px", color: "rgba(255,255,255,0.6)" }}>{(row.dailyQuota * 7).toFixed(0)}</td>
                                  <td style={{ textAlign: "right", padding: "10px 8px", color: "rgba(255,255,255,0.6)" }}>{(row.dailyQuota * 30).toFixed(0)}</td>
                                  <td style={{ textAlign: "right", padding: "10px 8px", color: "rgba(255,255,255,0.6)" }}>{(row.dailyQuota * 90).toFixed(0)}</td>
                                  <td style={{ textAlign: "right", padding: "10px 8px", color: "rgba(255,255,255,0.6)" }}>{(row.dailyQuota * 365).toFixed(0)}</td>
                                  <td style={{ textAlign: "right", padding: "10px 8px", color: "rgba(255,255,255,0.6)" }}>{row.repCount}</td>
                                  <td style={{ textAlign: "right", padding: "10px 8px", fontWeight: 700, color: "#fff" }}>{row.signups}</td>
                                  <td style={{ textAlign: "right", padding: "10px 8px", fontWeight: 700, color: COLORS.neonGreen }}>{formatMoney(row.sales)}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              {(() => {
                                const tq = filteredCityRows.reduce((s, r) => s + r.dailyQuota, 0);
                                return (
                              <tr style={{ borderTop: "2px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)" }}>
                                <td style={{ padding: "14px 8px", fontWeight: 800, fontSize: 13, color: "#fff" }}>Total</td>
                                <td style={{ padding: "14px 8px", fontWeight: 800, fontSize: 13, color: COLORS.textSecondary }}>{filteredCityRows.length} cities</td>
                                <td style={{ padding: "14px 8px" }} />
                                <td style={{ textAlign: "right", padding: "14px 8px", fontWeight: 800, fontSize: 13, color: COLORS.neonPurple }}>{tq % 1 === 0 ? tq.toFixed(0) : tq.toFixed(2)}</td>
                                <td style={{ textAlign: "right", padding: "14px 8px", fontWeight: 800, fontSize: 13, color: "#fff" }}>{(tq * 7).toFixed(0)}</td>
                                <td style={{ textAlign: "right", padding: "14px 8px", fontWeight: 800, fontSize: 13, color: "#fff" }}>{(tq * 30).toFixed(0)}</td>
                                <td style={{ textAlign: "right", padding: "14px 8px", fontWeight: 800, fontSize: 13, color: "#fff" }}>{(tq * 90).toFixed(0)}</td>
                                <td style={{ textAlign: "right", padding: "14px 8px", fontWeight: 800, fontSize: 13, color: "#fff" }}>{(tq * 365).toFixed(0)}</td>
                                <td style={{ textAlign: "right", padding: "14px 8px", fontWeight: 800, fontSize: 13, color: "#fff" }}>{filteredCityRows.reduce((s, r) => s + r.repCount, 0)}</td>
                                <td style={{ textAlign: "right", padding: "14px 8px", fontWeight: 800, fontSize: 13, color: "#fff" }}>{filteredCityRows.reduce((s, r) => s + r.signups, 0)}</td>
                                <td style={{ textAlign: "right", padding: "14px 8px", fontWeight: 800, fontSize: 13, color: COLORS.neonGreen }}>{formatMoney(filteredCityRows.reduce((s, r) => s + r.sales, 0))}</td>
                              </tr>
                                );
                              })()}
                            </tfoot>
                          </table>
                        )}
                      </div>
                    </div>
                      );
                    })()}

                    {/* Supervisor Breakdown */}
                    {(() => {
                      // Build supervisor hierarchy: top-level = reps with no supervisor or whose supervisor doesn't exist
                      const activeReps = salesReps.filter(r => r.status === "active");
                      const repById = new Map(activeReps.map(r => [r.id, r]));
                      // Get direct reports for a given supervisor
                      const getDirectReports = (supId: string) => activeReps.filter(r => r.supervisor_id === supId);
                      // Compute total daily quota for a supervisor (their own + all reports recursively)
                      const getTeamQuota = (repId: string): number => {
                        const rep = repById.get(repId);
                        const own = rep ? getRepDailyQuota(rep) : 0;
                        return own + getDirectReports(repId).reduce((s, r) => s + getTeamQuota(r.id), 0);
                      };
                      const getTeamCount = (repId: string): number => {
                        const reports = getDirectReports(repId);
                        return reports.length + reports.reduce((s, r) => s + getTeamCount(r.id), 0);
                      };
                      const getTeamSignups = (repId: string): number => {
                        const own = filteredSignups.filter(s => s.rep_id === repId).length;
                        return own + getDirectReports(repId).reduce((s, r) => s + getTeamSignups(r.id), 0);
                      };
                      // Top-level supervisors: those with no supervisor_id, or whose supervisor is not in activeReps
                      const topLevel = activeReps.filter(r => !r.supervisor_id || !repById.has(r.supervisor_id));
                      // Sort by role hierarchy then name
                      const roleOrder = Object.fromEntries(ROLE_HIERARCHY.map((r, i) => [r, i]));
                      const sortReps = (a: SalesRep, b: SalesRep) => (roleOrder[a.role] ?? 99) - (roleOrder[b.role] ?? 99) || a.name.localeCompare(b.name);
                      topLevel.sort(sortReps);

                      // Filter by division
                      const filteredTopLevel = supFilterDiv === "all" ? topLevel : topLevel.filter(r => {
                        const zone = zones.find(z => z.id === r.zone_id);
                        const divName = zone ? (divisions.find(d => d.id === zone.division_id)?.name || "") : "";
                        return divName === supFilterDiv;
                      });

                      // Search filter: build set of matching rep IDs + all their ancestors
                      const searchTerm = supFilterSearch.toLowerCase().trim();
                      const matchedIds = new Set<string>();
                      if (searchTerm) {
                        // Find all reps matching the search
                        const directMatches = activeReps.filter(r => r.name.toLowerCase().includes(searchTerm));
                        // For each match, walk up the supervisor chain to include ancestors
                        const addWithAncestors = (rep: SalesRep) => {
                          matchedIds.add(rep.id);
                          if (rep.supervisor_id && repById.has(rep.supervisor_id) && !matchedIds.has(rep.supervisor_id)) {
                            addWithAncestors(repById.get(rep.supervisor_id)!);
                          }
                        };
                        // Also include all descendants of matches so their teams stay visible
                        const addDescendants = (id: string) => {
                          matchedIds.add(id);
                          getDirectReports(id).forEach(r => addDescendants(r.id));
                        };
                        directMatches.forEach(r => {
                          addWithAncestors(r);
                          addDescendants(r.id);
                        });
                      }

                      // Recursive row renderer
                      const renderSupRow = (rep: SalesRep, depth: number): React.ReactNode => {
                        if (searchTerm && !matchedIds.has(rep.id)) return null;
                        const reports = getDirectReports(rep.id).sort(sortReps);
                        const teamQuota = getTeamQuota(rep.id);
                        const teamCount = getTeamCount(rep.id);
                        const teamSignups = getTeamSignups(rep.id);
                        const zone = zones.find(z => z.id === rep.zone_id);
                        const divName = zone ? (divisions.find(d => d.id === zone.division_id)?.name || "—") : "—";
                        const divColor = divisionColors[divName] || COLORS.neonBlue;
                        const hasReports = reports.length > 0;
                        const isCollapsed = supCollapsed.has(rep.id);
                        const isDirectMatch = searchTerm && rep.name.toLowerCase().includes(searchTerm);
                        return (
                          <React.Fragment key={rep.id}>
                            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: isDirectMatch ? "rgba(191,95,255,0.08)" : depth === 0 ? "rgba(255,255,255,0.02)" : "transparent" }}>
                              <td style={{ padding: "10px 8px", paddingLeft: 8 + depth * 24, fontWeight: depth === 0 ? 700 : 600 }}>
                                {hasReports && <span onClick={() => setSupCollapsed(prev => { const next = new Set(prev); if (next.has(rep.id)) next.delete(rep.id); else next.add(rep.id); return next; })} style={{ color: COLORS.neonPurple, marginRight: 6, fontSize: 13, cursor: "pointer", display: "inline-block", transition: "transform 0.15s", transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)" }}>▼</span>}
                                {rep.name}
                              </td>
                              <td style={{ padding: "10px 8px", fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{ROLE_LABELS[rep.role] || rep.role}</td>
                              <td style={{ padding: "10px 8px", color: divColor, fontWeight: 600, fontSize: 12 }}>{divName}</td>
                              <td style={{ textAlign: "right", padding: "10px 8px", color: "rgba(255,255,255,0.6)" }}>{teamCount}</td>
                              <td style={{ textAlign: "right", padding: "10px 8px", fontWeight: 700, color: COLORS.neonPurple }}>{teamQuota % 1 === 0 ? teamQuota.toFixed(0) : teamQuota.toFixed(2)}</td>
                              <td style={{ textAlign: "right", padding: "10px 8px", color: "rgba(255,255,255,0.6)" }}>{(teamQuota * 7).toFixed(0)}</td>
                              <td style={{ textAlign: "right", padding: "10px 8px", color: "rgba(255,255,255,0.6)" }}>{(teamQuota * 30).toFixed(0)}</td>
                              <td style={{ textAlign: "right", padding: "10px 8px", color: "rgba(255,255,255,0.6)" }}>{(teamQuota * 90).toFixed(0)}</td>
                              <td style={{ textAlign: "right", padding: "10px 8px", color: "rgba(255,255,255,0.6)" }}>{(teamQuota * 365).toFixed(0)}</td>
                              <td style={{ textAlign: "right", padding: "10px 8px", fontWeight: 700, color: "#fff" }}>{teamSignups}</td>
                              {(() => {
                                const ytdTarget = teamQuota * daysElapsedYTD;
                                const teamYtdSignups = (() => {
                                  const getYtdTeam = (id: string): number => {
                                    const own = ytdSignups.filter(s => s.rep_id === id).length;
                                    return own + getDirectReports(id).reduce((s2, r2) => s2 + getYtdTeam(r2.id), 0);
                                  };
                                  return getYtdTeam(rep.id);
                                })();
                                const pct = ytdTarget > 0 ? (teamYtdSignups / ytdTarget) * 100 : 0;
                                return (
                                  <td style={{ textAlign: "right", padding: "10px 8px", fontWeight: 800, fontSize: 12, color: pct >= 100 ? COLORS.neonGreen : pct >= 50 ? COLORS.neonYellow : teamQuota > 0 ? "#ff6b6b" : "rgba(255,255,255,0.3)" }}>{teamQuota > 0 ? pct.toFixed(1) + "%" : "—"}</td>
                                );
                              })()}
                            </tr>
                            {!isCollapsed && reports.map(r => renderSupRow(r, depth + 1))}
                          </React.Fragment>
                        );
                      };

                      return (
                    <div style={{ background: "linear-gradient(135deg, " + COLORS.darkBg + " 0%, rgba(45,45,68,0.6) 100%)", borderRadius: 14, border: "1px solid " + COLORS.cardBorder, overflow: "hidden", marginBottom: 24 }}>
                      <div style={{ height: 3, background: "linear-gradient(90deg, " + COLORS.neonPink + ", " + COLORS.neonPurple + ")" }} />
                      <div style={{ padding: "18px 20px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em" }}>Supervisor Breakdown</div>
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <input placeholder="Search name..." value={supFilterSearch} onChange={e => setSupFilterSearch(e.target.value)} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: "#fff", fontSize: 12, width: 160 }} />
                            <select value={supFilterDiv} onChange={e => setSupFilterDiv(e.target.value)} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: "#fff", fontSize: 12 }}>
                              <option value="all">All Divisions</option>
                              {divData.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                            </select>
                          </div>
                        </div>
                        {filteredTopLevel.length === 0 ? (
                          <div style={{ padding: 20, textAlign: "center", color: COLORS.textSecondary }}>No supervisors found</div>
                        ) : (
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                            <thead>
                              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                                <th style={{ textAlign: "left", padding: "10px 8px", color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>Name</th>
                                <th style={{ textAlign: "left", padding: "10px 8px", color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>Role</th>
                                <th style={{ textAlign: "left", padding: "10px 8px", color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>Division</th>
                                <th style={{ textAlign: "right", padding: "10px 8px", color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>Team</th>
                                <th style={{ textAlign: "right", padding: "10px 8px", color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>Daily</th>
                                <th style={{ textAlign: "right", padding: "10px 8px", color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>Wkly</th>
                                <th style={{ textAlign: "right", padding: "10px 8px", color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>Mthly</th>
                                <th style={{ textAlign: "right", padding: "10px 8px", color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>Qtrly</th>
                                <th style={{ textAlign: "right", padding: "10px 8px", color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>Yearly</th>
                                <th style={{ textAlign: "right", padding: "10px 8px", color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>Signups</th>
                                <th style={{ textAlign: "right", padding: "10px 8px", color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>YTD %</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredTopLevel.map(rep => renderSupRow(rep, 0))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                      );
                    })()}

                    {/* Quota Overrides */}
                    {quotaOverrides.length > 0 && (
                      <div style={{ background: "linear-gradient(135deg, " + COLORS.darkBg + " 0%, rgba(45,45,68,0.6) 100%)", borderRadius: 14, border: "1px solid " + COLORS.cardBorder, overflow: "hidden" }}>
                        <div style={{ height: 3, background: "linear-gradient(90deg, " + COLORS.neonYellow + ", " + COLORS.neonOrange + ")" }} />
                        <div style={{ padding: "18px 20px" }}>
                          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, letterSpacing: "-0.01em" }}>Active Quota Overrides</div>
                          <DataTable columns={[
                            { key: "target_type", label: "Type", render: (v: unknown) => <span style={{ textTransform: "capitalize" }}>{String(v)}</span> },
                            { key: "target_id", label: "Target", render: (v: unknown, row: Record<string, unknown>) => { const o = row as unknown as QuotaOverride; if (o.target_type === "individual" || o.target_type === "team") return salesReps.find(r => r.id === String(v))?.name || String(v); if (o.target_type === "zone") return zones.find(z => z.id === String(v))?.name || String(v); if (o.target_type === "division") return divisions.find(d => d.id === String(v))?.name || String(v); return String(v); } },
                            { key: "quota", label: "Quota", render: (v: unknown) => <span style={{ fontWeight: 700 }}>{String(v)}</span> },
                            { key: "period", label: "Period" },
                          ]} data={quotaOverrides} />
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
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
                <div style={{ marginLeft: "auto" }}>
                  <select
                    value={historyDivisionFilter}
                    onChange={(e) => setHistoryDivisionFilter(e.target.value)}
                    style={{ padding: "8px 16px", borderRadius: 8, background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, color: COLORS.textPrimary, fontSize: 12 }}
                  >
                    <option value="all">All Divisions</option>
                    {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                  </select>
                </div>
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

                    // Division filter
                    const divMatch = historyDivisionFilter === "all" || salesReps.find(r => r.id === h.rep_id)?.zone_id === historyDivisionFilter;

                    return typeMatch && repMatch && divMatch;
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
                ]} data={actualSalesReps.filter(rep => historyDivisionFilter === "all" || rep.zone_id === historyDivisionFilter).map((rep) => { const paid = payoutHistory.filter((p) => p.rep_id === rep.id && p.status === "paid"); return { name: rep.name, totalCommissions: paid.filter((p) => p.type === "commission").reduce((a, p) => a + p.amount_cents, 0), totalBonuses: paid.filter((p) => p.type === "bonus").reduce((a, p) => a + p.amount_cents, 0), adjustments: paid.filter((p) => p.type === "adjustment").reduce((a, p) => a + p.amount_cents, 0), totalPaid: paid.reduce((a, p) => a + p.amount_cents, 0) }; })} />
              </Card>
            </>
          )}

          {/* PAYOUTS TAB */}
          {salesTab === "payouts" && (
            <>
              {/* Summary Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
                <Card><div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase" }}>{currentMonthName} {currentYear} Commissions</div><div style={{ fontSize: 28, fontWeight: 800, color: COLORS.neonGreen }}>{formatMoney(monthSignups.reduce((a, s) => a + s.commission_cents, 0))}</div><div style={{ fontSize: 12, color: COLORS.textSecondary }}>Due: {monthNames[currentMonth % 12]} 5, {currentMonth === 12 ? currentYear + 1 : currentYear}</div></Card>
                <Card><div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase" }}>Next Bonus Payout</div><div style={{ fontSize: 28, fontWeight: 800, color: COLORS.neonPurple }}>{formatMoney(computedPoolData.total_pool_cents)}</div><div style={{ fontSize: 12, color: COLORS.textSecondary }}>Month end: {computedPoolData.quarter}</div></Card>
                <Card><div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase" }}>YTD Total Paid</div><div style={{ fontSize: 28, fontWeight: 800, color: COLORS.neonOrange }}>{formatMoney(ytdPaid)}</div><div style={{ fontSize: 12, color: COLORS.textSecondary }}>Commissions + Bonuses</div></Card>
              </div>

              {/* Filters */}
              <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
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
                let repSales = monthSignups.filter((s) => s.rep_id === rep.id);

                // Apply date range filter
                if (payoutDateFilter.from) {
                  const fromDate = new Date(payoutDateFilter.from);
                  repSales = repSales.filter(s => new Date(s.signed_at) >= fromDate);
                }
                if (payoutDateFilter.to) {
                  const toDate = new Date(payoutDateFilter.to);
                  toDate.setHours(23, 59, 59, 999);
                  repSales = repSales.filter(s => new Date(s.signed_at) <= toDate);
                }

                if (repSales.length === 0) return null;

                const stats = {
                  basic: repSales.filter((s) => s.plan === "basic").length,
                  premium: repSales.filter((s) => s.plan === "premium").length,
                  adSpend: repSales.reduce((a, s) => a + (s.ad_spend_cents || 0), 0),
                  total: repSales.reduce((a, s) => a + (s.commission_cents || 0), 0),
                  poolContrib: repSales.reduce((a, s) => a + (s.pool_contribution_cents || 0), 0),
                };
                const isMonthPaid = paidCommissions[rep.id]?.month;

                // Apply status filter
                if (payoutStatusFilter === "paid" && !isMonthPaid) return null;
                if (payoutStatusFilter === "pending" && isMonthPaid) return null;

                return (
                  <Card key={rep.id} style={{ marginBottom: 20 }} title={<div style={{ display: "flex", alignItems: "center", gap: 12 }}><Avatar name={rep.name} initials={rep.avatar} /><div><div style={{ fontWeight: 700 }}>{rep.name}</div><div style={{ fontSize: 11, color: COLORS.textSecondary }}>{rep.email}</div></div></div>} actions={<div style={{ display: "flex", gap: 8 }}><span style={{ fontSize: 20, fontWeight: 800, color: COLORS.neonGreen }}>{formatMoney(stats.total)}</span><span style={{ fontSize: 12, color: COLORS.textSecondary, alignSelf: "center" }}>total</span></div>}>
                    <div style={{ padding: 20, background: isMonthPaid ? "rgba(57,255,20,0.05)" : COLORS.darkBg, borderRadius: 12, border: isMonthPaid ? "1px solid " + COLORS.neonGreen : "1px solid " + COLORS.cardBorder }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <div><div style={{ fontSize: 14, fontWeight: 700 }}>{currentMonthName} {currentYear}</div><div style={{ fontSize: 11, color: COLORS.textSecondary }}>Due: {monthNames[currentMonth % 12]} 5, {currentMonth === 12 ? currentYear + 1 : currentYear}</div></div>
                        <Badge status={isMonthPaid ? "paid" : "pending"} />
                      </div>
                      <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "8px 0", borderBottom: "1px solid " + COLORS.cardBorder }}><span>Basic Signups ({stats.basic})</span><span>{stats.basic} × {formatMoney(commissionRates.individual.basic_signup)} = <strong style={{ color: COLORS.neonGreen }}>{formatMoney(stats.basic * commissionRates.individual.basic_signup)}</strong></span></div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "8px 0", borderBottom: "1px solid " + COLORS.cardBorder }}><span>Premium Signups ({stats.premium})</span><span>{stats.premium} × {formatMoney(commissionRates.individual.premium_signup)} = <strong style={{ color: COLORS.neonGreen }}>{formatMoney(stats.premium * commissionRates.individual.premium_signup)}</strong></span></div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "8px 0", borderBottom: "1px solid " + COLORS.cardBorder }}><span>Ad Spend Sold ({formatMoney(stats.adSpend)})</span><span>{formatMoney(stats.adSpend)} ÷ 100 × {formatMoney(commissionRates.individual.advertising_per_100)} = <strong style={{ color: COLORS.neonGreen }}>{formatMoney(Math.floor(stats.adSpend / 10000) * commissionRates.individual.advertising_per_100)}</strong></span></div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: 12, fontWeight: 700, background: COLORS.cardBg, borderRadius: 8 }}><span>Monthly Total</span><span style={{ color: COLORS.neonGreen, fontSize: 18 }}>{formatMoney(stats.total)}</span></div>
                      </div>
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, fontWeight: 600 }}>ITEMIZED SALES ({repSales.length})</div>
                        <div style={{ maxHeight: 200, overflowY: "auto" }}>
                          {repSales.map((sale) => (
                            <div key={sale.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid " + COLORS.cardBorder, fontSize: 12 }}>
                              <div><div style={{ fontWeight: 600 }}>{sale.business_name}</div><div style={{ color: COLORS.textSecondary, fontSize: 10 }}>{formatDate(sale.signed_at)} • {sale.city || "?"}, {sale.state || "?"}</div></div>
                              <div style={{ textAlign: "right" }}><Badge status={sale.plan} /><div style={{ color: COLORS.neonGreen, fontSize: 11, marginTop: 2 }}>+{formatMoney(sale.commission_cents)}</div></div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontSize: 11, color: COLORS.neonPurple }}>Pool contrib: +{formatMoney(stats.poolContrib)}</div>
                        {isMonthPaid ? (
                          <button onClick={() => setPaidCommissions({ ...paidCommissions, [rep.id]: { month: false } })} style={{ padding: "8px 16px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textSecondary, cursor: "pointer", fontSize: 11 }}>Undo</button>
                        ) : (
                          <button onClick={() => setPaidCommissions({ ...paidCommissions, [rep.id]: { month: true } })} style={{ padding: "8px 16px", background: COLORS.gradient2, border: "none", borderRadius: 8, color: "#000", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Mark Paid {formatMoney(stats.total)}</button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}

              {actualSalesReps.filter(rep => monthSignups.some(s => s.rep_id === rep.id)).length === 0 && (
                <div style={{ padding: 60, textAlign: "center", color: COLORS.textSecondary }}>No signups this month</div>
              )}

              {/* Monthly Bonus Section */}
              <Card title="🏆 Monthly Bonus Payout" style={{ marginTop: 24 }} actions={
                <div style={{ display: "flex", gap: 8 }}>
                  {paidBonusQuarters.includes(computedPoolData.quarter) ? (
                    <button onClick={() => handleUndoBonusPayout(computedPoolData.quarter)} style={{ padding: "8px 16px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textSecondary, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Undo Payment</button>
                  ) : (
                    <button onClick={() => handleMarkBonusPaid(computedPoolData.quarter)} style={{ padding: "8px 16px", background: COLORS.gradient1, border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Pay {computedPoolData.quarter} Bonus</button>
                  )}
                </div>
              }>
                <DataTable columns={[
                  { key: "quarter", label: "Month" },
                  { key: "totalPool", label: "Pool Size", render: (v: unknown) => formatMoney(Number(v)) },
                  { key: "eligibleReps", label: "Eligible Reps" },
                  { key: "perRepPayout", label: "Per Rep", render: (v: unknown) => <span style={{ color: COLORS.neonPurple, fontWeight: 700 }}>{formatMoney(Number(v))}</span> },
                  { key: "quarter", label: "Status", render: (v: unknown) => <Badge status={paidBonusQuarters.includes(String(v)) ? "paid" : "active"} /> },
                  { key: "quarter", label: "", render: (v: unknown) => {
                    const period = String(v);
                    const poolData = period === computedPoolData.quarter ? computedPoolData : previousPools.find(p => p.quarter === period);
                    return poolData ? (
                      <button onClick={() => handleShowBonusDetails(poolData)} style={{ padding: "6px 12px", background: COLORS.gradient2, border: "none", borderRadius: 6, color: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Details</button>
                    ) : null;
                  }},
                ]} data={[{ quarter: computedPoolData.quarter, totalPool: computedPoolData.total_pool_cents, eligibleReps: eligibleReps.length, perRepPayout: computedPoolData.projected_per_rep_cents }, ...previousPools.map(p => ({ quarter: p.quarter, totalPool: p.total_pool_cents, eligibleReps: p.eligible_rep_ids?.length || 0, perRepPayout: p.projected_per_rep_cents }))]} />
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

          {/* ==================== APPLICATIONS TAB ==================== */}
          {salesTab === "applications" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Status filter buttons */}
              <Card title="Sales Rep Applications">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                  {[
                    { key: "all", label: "All" },
                    { key: "submitted", label: "Submitted" },
                    { key: "approved", label: "Approved" },
                    { key: "rejected", label: "Rejected" },
                  ].map((f) => (
                    <button
                      key={f.key}
                      onClick={() => setAppStatusFilter(f.key)}
                      style={{
                        padding: "6px 16px",
                        borderRadius: 8,
                        border: "1px solid " + (appStatusFilter === f.key ? COLORS.neonBlue : COLORS.cardBorder),
                        background: appStatusFilter === f.key ? COLORS.neonBlue + "22" : "transparent",
                        color: appStatusFilter === f.key ? COLORS.neonBlue : COLORS.textSecondary,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {appLoading ? (
                  <div style={{ textAlign: "center", padding: 40, color: COLORS.textSecondary }}>Loading applications...</div>
                ) : applications.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 40, color: COLORS.textSecondary }}>No applications found</div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid " + COLORS.cardBorder }}>
                          {["Name", "Email", "City / State", "Experience", "Status", "Applied"].map((h) => (
                            <th key={h} style={{ padding: "10px 12px", textAlign: "left", color: COLORS.textSecondary, fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {applications.map((app) => (
                          <React.Fragment key={app.id}>
                            <tr
                              onClick={() => setExpandedAppId(expandedAppId === app.id ? null : app.id)}
                              style={{ borderBottom: "1px solid " + COLORS.cardBorder, cursor: "pointer", background: expandedAppId === app.id ? COLORS.darkBg : "transparent" }}
                            >
                              <td style={{ padding: "10px 12px", color: COLORS.textPrimary, fontWeight: 600 }}>{app.full_name}</td>
                              <td style={{ padding: "10px 12px", color: COLORS.textSecondary }}>{app.email}</td>
                              <td style={{ padding: "10px 12px", color: COLORS.textSecondary }}>{[app.city, app.state].filter(Boolean).join(", ") || "—"}</td>
                              <td style={{ padding: "10px 12px", color: COLORS.textSecondary, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{app.payload?.experience || "—"}</td>
                              <td style={{ padding: "10px 12px" }}><Badge status={app.status} /></td>
                              <td style={{ padding: "10px 12px", color: COLORS.textSecondary }}>{formatDate(app.created_at)}</td>
                            </tr>

                            {/* Expanded detail panel */}
                            {expandedAppId === app.id && (
                              <tr>
                                <td colSpan={6} style={{ padding: 0 }}>
                                  <div style={{ padding: "20px 24px", background: COLORS.darkBg, borderBottom: "2px solid " + COLORS.cardBorder }}>
                                    {/* ── Contact Info ── */}
                                    <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.neonBlue, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Contact Information</div>
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 20 }}>
                                      <div>
                                        <div style={{ fontSize: 10, color: COLORS.textSecondary, textTransform: "uppercase", marginBottom: 3 }}>Full Name</div>
                                        <div style={{ fontSize: 13, color: COLORS.textPrimary, fontWeight: 600 }}>{app.full_name}</div>
                                      </div>
                                      <div>
                                        <div style={{ fontSize: 10, color: COLORS.textSecondary, textTransform: "uppercase", marginBottom: 3 }}>Email</div>
                                        <div style={{ fontSize: 13, color: COLORS.textPrimary }}>{app.email}</div>
                                      </div>
                                      <div>
                                        <div style={{ fontSize: 10, color: COLORS.textSecondary, textTransform: "uppercase", marginBottom: 3 }}>Phone</div>
                                        <div style={{ fontSize: 13, color: COLORS.textPrimary }}>{app.phone ? formatPhone(app.phone) : "—"}</div>
                                      </div>
                                      <div>
                                        <div style={{ fontSize: 10, color: COLORS.textSecondary, textTransform: "uppercase", marginBottom: 3 }}>City / State</div>
                                        <div style={{ fontSize: 13, color: COLORS.textPrimary }}>{[app.city, app.state].filter(Boolean).join(", ") || "—"}</div>
                                      </div>
                                      <div>
                                        <div style={{ fontSize: 10, color: COLORS.textSecondary, textTransform: "uppercase", marginBottom: 3 }}>LinkedIn</div>
                                        <div style={{ fontSize: 13 }}>
                                          {app.payload?.linkedin ? (
                                            <a href={String(app.payload.linkedin)} target="_blank" rel="noopener noreferrer" style={{ color: COLORS.neonBlue, textDecoration: "none" }}>{String(app.payload.linkedin)}</a>
                                          ) : "—"}
                                        </div>
                                      </div>
                                    </div>

                                    {/* ── Sales Background ── */}
                                    <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.neonPink, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Sales Background</div>
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 14, marginBottom: 20 }}>
                                      <div style={{ gridColumn: "1 / -1" }}>
                                        <div style={{ fontSize: 10, color: COLORS.textSecondary, textTransform: "uppercase", marginBottom: 3 }}>Sales Experience</div>
                                        <div style={{ fontSize: 13, color: COLORS.textPrimary, whiteSpace: "pre-wrap" }}>{app.payload?.experience || "—"}</div>
                                      </div>
                                      <div>
                                        <div style={{ fontSize: 10, color: COLORS.textSecondary, textTransform: "uppercase", marginBottom: 3 }}>Industries Sold To</div>
                                        <div style={{ fontSize: 13, color: COLORS.textPrimary }}>{app.payload?.industries || "—"}</div>
                                      </div>
                                      <div>
                                        <div style={{ fontSize: 10, color: COLORS.textSecondary, textTransform: "uppercase", marginBottom: 3 }}>Desired Territory</div>
                                        <div style={{ fontSize: 13, color: COLORS.textPrimary }}>{app.payload?.territory || "—"}</div>
                                      </div>
                                      <div style={{ gridColumn: "1 / -1" }}>
                                        <div style={{ fontSize: 10, color: COLORS.textSecondary, textTransform: "uppercase", marginBottom: 3 }}>Sales Strategy</div>
                                        <div style={{ fontSize: 13, color: COLORS.textPrimary, whiteSpace: "pre-wrap" }}>{app.payload?.salesStrategy || "—"}</div>
                                      </div>
                                      <div style={{ gridColumn: "1 / -1" }}>
                                        <div style={{ fontSize: 10, color: COLORS.textSecondary, textTransform: "uppercase", marginBottom: 3 }}>Personality</div>
                                        <div style={{ fontSize: 13, color: COLORS.textPrimary, whiteSpace: "pre-wrap" }}>{app.payload?.personality || "—"}</div>
                                      </div>
                                      <div>
                                        <div style={{ fontSize: 10, color: COLORS.textSecondary, textTransform: "uppercase", marginBottom: 3 }}>Travel Distance</div>
                                        <div style={{ fontSize: 13, color: COLORS.textPrimary }}>{app.payload?.travelDistance || "—"}</div>
                                      </div>
                                      <div>
                                        <div style={{ fontSize: 10, color: COLORS.textSecondary, textTransform: "uppercase", marginBottom: 3 }}>How They Heard About Us</div>
                                        <div style={{ fontSize: 13, color: COLORS.textPrimary }}>{app.payload?.referredBy || "—"}</div>
                                      </div>
                                      <div style={{ gridColumn: "1 / -1" }}>
                                        <div style={{ fontSize: 10, color: COLORS.textSecondary, textTransform: "uppercase", marginBottom: 3 }}>Why They Want to Sell for LetsGo</div>
                                        <div style={{ fontSize: 13, color: COLORS.textPrimary, whiteSpace: "pre-wrap" }}>{app.payload?.coverNote || "—"}</div>
                                      </div>
                                    </div>

                                    {/* ── Disclosures & Agreements ── */}
                                    <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.neonYellow, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Disclosures & Agreements</div>
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginBottom: 20 }}>
                                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <span style={{ color: app.payload?.felonyDisclosure === "no" ? COLORS.neonGreen : COLORS.neonRed, fontSize: 14 }}>{app.payload?.felonyDisclosure === "no" ? "✓" : "✗"}</span>
                                        <span style={{ fontSize: 12, color: COLORS.textSecondary }}>Felony conviction: <strong style={{ color: COLORS.textPrimary }}>{app.payload?.felonyDisclosure === "no" ? "No" : app.payload?.felonyDisclosure === "yes" ? "Yes" : "—"}</strong></span>
                                      </div>
                                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <span style={{ color: app.payload?.hasReliableTransportation ? COLORS.neonGreen : COLORS.neonRed, fontSize: 14 }}>{app.payload?.hasReliableTransportation ? "✓" : "✗"}</span>
                                        <span style={{ fontSize: 12, color: COLORS.textSecondary }}>Reliable transportation</span>
                                      </div>
                                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <span style={{ color: app.payload?.agreedAge18 ? COLORS.neonGreen : COLORS.neonRed, fontSize: 14 }}>{app.payload?.agreedAge18 ? "✓" : "✗"}</span>
                                        <span style={{ fontSize: 12, color: COLORS.textSecondary }}>Confirmed 18+</span>
                                      </div>
                                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <span style={{ color: app.payload?.agreedWorkAuthorization ? COLORS.neonGreen : COLORS.neonRed, fontSize: 14 }}>{app.payload?.agreedWorkAuthorization ? "✓" : "✗"}</span>
                                        <span style={{ fontSize: 12, color: COLORS.textSecondary }}>Work authorization</span>
                                      </div>
                                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <span style={{ color: app.payload?.agreed1099 ? COLORS.neonGreen : COLORS.neonRed, fontSize: 14 }}>{app.payload?.agreed1099 ? "✓" : "✗"}</span>
                                        <span style={{ fontSize: 12, color: COLORS.textSecondary }}>1099 independent contractor</span>
                                      </div>
                                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <span style={{ color: app.payload?.agreedBackgroundCheck ? COLORS.neonGreen : COLORS.neonRed, fontSize: 14 }}>{app.payload?.agreedBackgroundCheck ? "✓" : "✗"}</span>
                                        <span style={{ fontSize: 12, color: COLORS.textSecondary }}>Background check consent</span>
                                      </div>
                                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <span style={{ color: app.payload?.agreedInterview ? COLORS.neonGreen : COLORS.neonRed, fontSize: 14 }}>{app.payload?.agreedInterview ? "✓" : "✗"}</span>
                                        <span style={{ fontSize: 12, color: COLORS.textSecondary }}>Interview agreement</span>
                                      </div>
                                    </div>

                                    {/* ── Documents ── */}
                                    <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.neonPurple, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Documents</div>
                                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
                                      {app.payload?.driversLicensePath ? (
                                        <button
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            const { data } = await supabaseBrowser.storage.from("documents").createSignedUrl(String(app.payload.driversLicensePath), 300);
                                            if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                                            else alert("Failed to load document. Make sure the 'documents' storage bucket exists.");
                                          }}
                                          style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid " + COLORS.neonPurple, background: "rgba(191,95,255,0.08)", color: COLORS.neonPurple, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                                        >
                                          📄 View Driver&apos;s License
                                        </button>
                                      ) : (
                                        <span style={{ fontSize: 12, color: COLORS.neonRed }}>⚠ No driver&apos;s license uploaded</span>
                                      )}
                                      {app.payload?.resumePath ? (
                                        <button
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            const { data } = await supabaseBrowser.storage.from("documents").createSignedUrl(String(app.payload.resumePath), 300);
                                            if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                                            else alert("Failed to load document. Make sure the 'documents' storage bucket exists.");
                                          }}
                                          style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid " + COLORS.neonBlue, background: "rgba(0,212,255,0.08)", color: COLORS.neonBlue, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                                        >
                                          📎 View Resume
                                        </button>
                                      ) : (
                                        <span style={{ fontSize: 12, color: COLORS.textSecondary }}>No resume uploaded</span>
                                      )}
                                    </div>

                                    {/* ── Review Status ── */}
                                    {(app.review_message || app.reviewed_by) && (
                                      <>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.neonOrange, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Review</div>
                                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 14, marginBottom: 20 }}>
                                          {app.review_message && (
                                            <div style={{ gridColumn: "1 / -1" }}>
                                              <div style={{ fontSize: 10, color: COLORS.textSecondary, textTransform: "uppercase", marginBottom: 3 }}>Review Message</div>
                                              <div style={{ fontSize: 13, color: COLORS.neonYellow }}>{app.review_message}</div>
                                            </div>
                                          )}
                                          {app.reviewed_by && (
                                            <div>
                                              <div style={{ fontSize: 10, color: COLORS.textSecondary, textTransform: "uppercase", marginBottom: 3 }}>Reviewed By</div>
                                              <div style={{ fontSize: 13, color: COLORS.textPrimary }}>{app.reviewed_by} on {formatDate(app.reviewed_at)}</div>
                                            </div>
                                          )}
                                        </div>
                                      </>
                                    )}

                                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                      {app.status === "submitted" && (<>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); setSelectedApp(app); setShowApproveModal(true); }}
                                          style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: COLORS.neonGreen, color: "#000", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                                        >
                                          Approve
                                        </button>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); setSelectedApp(app); setShowRejectModal(true); }}
                                          style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: COLORS.neonRed, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                                        >
                                          Reject
                                        </button>
                                      </>)}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedApp(app);
                                          setEditAppData({ full_name: app.full_name, email: app.email, phone: app.phone ? formatPhone(app.phone) : "", city: app.city || "", state: app.state || "" });
                                          setShowEditAppModal(true);
                                        }}
                                        style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid " + COLORS.neonBlue, background: "rgba(0,212,255,0.08)", color: COLORS.neonBlue, fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                                      >
                                        Edit
                                      </button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setSelectedApp(app); setShowDeleteAppModal(true); }}
                                        style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid " + COLORS.cardBorder, background: "transparent", color: COLORS.textSecondary, fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>

              {/* ── Approve Modal ── */}
              {showApproveModal && selectedApp && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }} onClick={() => setShowApproveModal(false)}>
                  <div style={{ background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 16, padding: 28, maxWidth: 480, width: "90%", maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
                    <h3 style={{ color: COLORS.textPrimary, margin: "0 0 8px", fontSize: 18 }}>Approve Application</h3>
                    <p style={{ color: COLORS.textSecondary, fontSize: 13, margin: "0 0 20px" }}>Approving <strong style={{ color: COLORS.neonGreen }}>{selectedApp.full_name}</strong> as a sales rep.</p>

                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      <div>
                        <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Role</label>
                        <select
                          value={approveData.role}
                          onChange={(e) => setApproveData({ ...approveData, role: e.target.value })}
                          style={{ width: "100%", padding: "8px 12px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, fontSize: 13 }}
                        >
                          {Object.entries(ROLE_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Division</label>
                        <select
                          value={approveData.zone_id}
                          onChange={(e) => {
                            const z = zones.find(z => z.id === e.target.value);
                            setApproveData({ ...approveData, zone_id: e.target.value, division_id: z?.division_id || "", state: "", county_id: "" });
                          }}
                          style={{ width: "100%", padding: "8px 12px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, fontSize: 13 }}
                        >
                          <option value="">— Select Division —</option>
                          {zones.map((z) => (
                            <option key={z.id} value={z.id}>{z.name} ({z.states.join(", ")})</option>
                          ))}
                        </select>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div>
                          <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>State *</label>
                          <select
                            value={approveData.state}
                            onChange={(e) => setApproveData({ ...approveData, state: e.target.value, county_id: "" })}
                            style={{ width: "100%", padding: "8px 12px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, fontSize: 13 }}
                          >
                            <option value="">— Select State —</option>
                            {(() => {
                              const zone = zones.find(z => z.id === approveData.zone_id);
                              const statesInZone = zone ? zone.states : [...new Set(counties.map(c => c.state))].sort();
                              return statesInZone.map(s => <option key={s} value={s}>{s}</option>);
                            })()}
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>County *</label>
                          <select
                            value={approveData.county_id}
                            onChange={(e) => setApproveData({ ...approveData, county_id: e.target.value })}
                            style={{ width: "100%", padding: "8px 12px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, fontSize: 13 }}
                            disabled={!approveData.state}
                          >
                            <option value="">— Select County —</option>
                            {counties.filter(c => c.state === approveData.state).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Supervisor</label>
                        <select
                          value={approveData.supervisor_id}
                          onChange={(e) => setApproveData({ ...approveData, supervisor_id: e.target.value })}
                          style={{ width: "100%", padding: "8px 12px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, fontSize: 13 }}
                        >
                          <option value="">— No Supervisor —</option>
                          {salesReps.filter(r => r.status === "active" && r.role !== "sales_rep").map((r) => (
                            <option key={r.id} value={r.id}>{r.name} ({ROLE_LABELS[r.role] || r.role})</option>
                          ))}
                        </select>
                      </div>

                    </div>

                    <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
                      <button onClick={() => setShowApproveModal(false)} style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid " + COLORS.cardBorder, background: "transparent", color: COLORS.textSecondary, fontSize: 12, cursor: "pointer" }}>Cancel</button>
                      <button
                        onClick={() => handleAppAction("approve")}
                        disabled={appActionLoading}
                        style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: COLORS.neonGreen, color: "#000", fontWeight: 700, fontSize: 12, cursor: "pointer", opacity: appActionLoading ? 0.5 : 1 }}
                      >
                        {appActionLoading ? "Approving..." : "Confirm Approve"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Reject Modal ── */}
              {showRejectModal && selectedApp && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }} onClick={() => setShowRejectModal(false)}>
                  <div style={{ background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 16, padding: 28, maxWidth: 480, width: "90%", maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
                    <h3 style={{ color: COLORS.textPrimary, margin: "0 0 8px", fontSize: 18 }}>Reject Application</h3>
                    <p style={{ color: COLORS.textSecondary, fontSize: 13, margin: "0 0 20px" }}>Rejecting application from <strong style={{ color: COLORS.neonRed }}>{selectedApp.full_name}</strong>.</p>

                    <div>
                      <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Reason (sent to applicant)</label>
                      <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        rows={4}
                        placeholder="Your application was not approved at this time..."
                        style={{ width: "100%", padding: "8px 12px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, fontSize: 13, resize: "vertical" }}
                      />
                    </div>

                    <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
                      <button onClick={() => setShowRejectModal(false)} style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid " + COLORS.cardBorder, background: "transparent", color: COLORS.textSecondary, fontSize: 12, cursor: "pointer" }}>Cancel</button>
                      <button
                        onClick={() => handleAppAction("reject")}
                        disabled={appActionLoading}
                        style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: COLORS.neonRed, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", opacity: appActionLoading ? 0.5 : 1 }}
                      >
                        {appActionLoading ? "Rejecting..." : "Confirm Reject"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Edit Application Modal ── */}
              {showEditAppModal && selectedApp && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }} onClick={() => setShowEditAppModal(false)}>
                  <div style={{ background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 16, padding: 28, maxWidth: 480, width: "90%", maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
                    <h3 style={{ color: COLORS.textPrimary, margin: "0 0 8px", fontSize: 18 }}>Edit Application</h3>
                    <p style={{ color: COLORS.textSecondary, fontSize: 13, margin: "0 0 20px" }}>Editing <strong style={{ color: COLORS.neonBlue }}>{selectedApp.full_name}</strong></p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      {(["full_name", "email", "phone", "city", "state"] as const).map((field) => (
                        <div key={field}>
                          <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>{field.replace("_", " ")}</label>
                          <input
                            value={editAppData[field]}
                            onChange={(e) => setEditAppData({ ...editAppData, [field]: field === "phone" ? formatPhone(e.target.value) : e.target.value })}
                            maxLength={field === "phone" ? 14 : undefined}
                            style={{ width: "100%", padding: "8px 12px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, fontSize: 13, boxSizing: "border-box" }}
                          />
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
                      <button onClick={() => setShowEditAppModal(false)} style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid " + COLORS.cardBorder, background: "transparent", color: COLORS.textSecondary, fontSize: 12, cursor: "pointer" }}>Cancel</button>
                      <button
                        onClick={handleEditApp}
                        disabled={appActionLoading}
                        style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: COLORS.neonBlue, color: "#000", fontWeight: 700, fontSize: 12, cursor: "pointer", opacity: appActionLoading ? 0.5 : 1 }}
                      >
                        {appActionLoading ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Delete Application Modal ── */}
              {showDeleteAppModal && selectedApp && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }} onClick={() => setShowDeleteAppModal(false)}>
                  <div style={{ background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 16, padding: 28, maxWidth: 420, width: "90%" }} onClick={(e) => e.stopPropagation()}>
                    <h3 style={{ color: COLORS.textPrimary, margin: "0 0 8px", fontSize: 18 }}>Delete Application</h3>
                    <p style={{ color: COLORS.textSecondary, fontSize: 13, margin: "0 0 20px" }}>
                      Are you sure you want to permanently delete the application from <strong style={{ color: COLORS.neonRed }}>{selectedApp.full_name}</strong>? This will also delete any uploaded documents. This cannot be undone.
                    </p>
                    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                      <button onClick={() => setShowDeleteAppModal(false)} style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid " + COLORS.cardBorder, background: "transparent", color: COLORS.textSecondary, fontSize: 12, cursor: "pointer" }}>Cancel</button>
                      <button
                        onClick={handleDeleteApp}
                        disabled={appActionLoading}
                        style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: COLORS.neonRed, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", opacity: appActionLoading ? 0.5 : 1 }}
                      >
                        {appActionLoading ? "Deleting..." : "Delete Permanently"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {salesTab === "1099nec" && (() => {
            const activeReps = salesReps.filter(r => r.status === "active");
            const repsWithEarnings = activeReps.map(r => ({
              ...r,
              annualEarnings: getRepAnnualEarnings(r.id, nec1099Year),
              record1099: nec1099s.find(n => n.rep_id === r.id) || null,
            })).filter(r => r.annualEarnings > 0 || r.record1099);

            const aboveThreshold = repsWithEarnings.filter(r => r.annualEarnings >= 60000);
            const taxInfoComplete = repsWithEarnings.filter(r => r.legal_name && r.tax_id && r.address_street && r.address_city && r.address_state && r.address_zip);
            const generated1099s = repsWithEarnings.filter(r => r.record1099);
            const sent1099s = repsWithEarnings.filter(r => r.record1099?.sent_at);

            return (
              <>
                {/* Year Selector */}
                <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center" }}>
                  <label style={{ fontSize: 13, color: COLORS.textSecondary, fontWeight: 600 }}>Tax Year:</label>
                  <select
                    value={nec1099Year}
                    onChange={(e) => setNec1099Year(parseInt(e.target.value))}
                    style={{ padding: "8px 16px", background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, fontSize: 13 }}
                  >
                    {Array.from({ length: 5 }, (_, i) => currentYear - i).map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleBulkGenerate1099}
                    disabled={necGenerating}
                    style={{ marginLeft: "auto", padding: "8px 20px", background: COLORS.gradient1, border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700, opacity: necGenerating ? 0.5 : 1 }}
                  >
                    {necGenerating ? "Generating..." : `📄 Bulk Generate 1099s (${aboveThreshold.filter(r => r.legal_name && r.tax_id && r.address_street && r.w9_status === "received").length})`}
                  </button>
                </div>

                {/* Summary Cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
                  <Card>
                    <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase" }}>Reps with Earnings</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: COLORS.neonBlue }}>{repsWithEarnings.length}</div>
                    <div style={{ fontSize: 12, color: COLORS.textSecondary }}>In {nec1099Year}</div>
                  </Card>
                  <Card>
                    <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase" }}>Above $600 Threshold</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: COLORS.neonRed }}>{aboveThreshold.length}</div>
                    <div style={{ fontSize: 12, color: COLORS.textSecondary }}>1099-NEC required</div>
                  </Card>
                  <Card>
                    <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase" }}>Tax Info Complete</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: COLORS.neonGreen }}>{taxInfoComplete.length}</div>
                    <div style={{ fontSize: 12, color: COLORS.textSecondary }}>of {repsWithEarnings.length} reps</div>
                  </Card>
                  <Card>
                    <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase" }}>1099s Generated / Sent</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: COLORS.neonPurple }}>{generated1099s.length} / {sent1099s.length}</div>
                    <div style={{ fontSize: 12, color: COLORS.textSecondary }}>of {aboveThreshold.length} required</div>
                  </Card>
                </div>

                {/* Reps Table */}
                <Card title={`📄 1099-NEC — ${nec1099Year}`}>
                  {repsWithEarnings.length === 0 ? (
                    <div style={{ padding: 60, textAlign: "center", color: COLORS.textSecondary }}>No reps with earnings in {nec1099Year}</div>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                          <tr style={{ borderBottom: "2px solid " + COLORS.cardBorder }}>
                            {["Rep Name", "Role", "Annual Earnings", "Threshold", "Tax Info", "W-9", "1099 Status", "Actions"].map(h => (
                              <th key={h} style={{ padding: "12px 10px", textAlign: "left", color: COLORS.textSecondary, fontSize: 11, textTransform: "uppercase", fontWeight: 600 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {repsWithEarnings
                            .sort((a, b) => b.annualEarnings - a.annualEarnings)
                            .map(rep => {
                              const hasTaxInfo = !!(rep.legal_name && rep.tax_id && rep.address_street && rep.address_city && rep.address_state && rep.address_zip);
                              const partialTaxInfo = !!(rep.legal_name || rep.tax_id || rep.address_street);
                              const isAbove = rep.annualEarnings >= 60000;
                              return (
                                <tr key={rep.id} style={{ borderBottom: "1px solid " + COLORS.cardBorder }}>
                                  <td style={{ padding: "12px 10px" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                      <Avatar name={rep.name} initials={rep.avatar} />
                                      <div>
                                        <div style={{ fontWeight: 600 }}>{rep.name}</div>
                                        <div style={{ fontSize: 11, color: COLORS.textSecondary }}>{rep.email}</div>
                                      </div>
                                    </div>
                                  </td>
                                  <td style={{ padding: "12px 10px", color: COLORS.textSecondary }}>{ROLE_LABELS[rep.role] || rep.role}</td>
                                  <td style={{ padding: "12px 10px" }}>
                                    <span style={{ fontWeight: 700, color: isAbove ? COLORS.neonGreen : COLORS.textPrimary }}>{formatMoney(rep.annualEarnings)}</span>
                                  </td>
                                  <td style={{ padding: "12px 10px" }}>
                                    <span style={{ padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: isAbove ? "rgba(255,49,49,0.15)" : "rgba(57,255,20,0.15)", color: isAbove ? COLORS.neonRed : COLORS.neonGreen }}>
                                      {isAbove ? "Required" : "Below"}
                                    </span>
                                  </td>
                                  <td style={{ padding: "12px 10px" }}>
                                    <span style={{ padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: hasTaxInfo ? "rgba(57,255,20,0.15)" : partialTaxInfo ? "rgba(255,255,0,0.15)" : "rgba(255,49,49,0.15)", color: hasTaxInfo ? COLORS.neonGreen : partialTaxInfo ? COLORS.neonYellow : COLORS.neonRed }}>
                                      {hasTaxInfo ? "Complete" : partialTaxInfo ? "Partial" : "Missing"}
                                    </span>
                                  </td>
                                  <td style={{ padding: "12px 10px" }}>
                                    <span style={{ padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: rep.w9_status === "received" ? "rgba(57,255,20,0.15)" : rep.w9_status === "requested" ? "rgba(255,255,0,0.15)" : "rgba(160,160,176,0.15)", color: rep.w9_status === "received" ? COLORS.neonGreen : rep.w9_status === "requested" ? COLORS.neonYellow : COLORS.textSecondary }}>
                                      {rep.w9_status === "received" ? "Received" : rep.w9_status === "requested" ? "Requested" : "Not Requested"}
                                    </span>
                                  </td>
                                  <td style={{ padding: "12px 10px" }}>
                                    {rep.record1099?.sent_at ? (
                                      <span style={{ padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: "rgba(57,255,20,0.15)", color: COLORS.neonGreen }}>Sent ({rep.record1099.sent_method})</span>
                                    ) : rep.record1099 ? (
                                      <span style={{ padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: "rgba(0,212,255,0.15)", color: COLORS.neonBlue }}>Generated</span>
                                    ) : (
                                      <span style={{ padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: "rgba(160,160,176,0.15)", color: COLORS.textSecondary }}>Not Generated</span>
                                    )}
                                  </td>
                                  <td style={{ padding: "12px 10px" }}>
                                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                      <button
                                        onClick={() => {
                                          setTaxInfoRep(rep);
                                          setTaxInfoForm({
                                            legal_name: rep.legal_name || "",
                                            tax_id: rep.tax_id || "",
                                            address_street: rep.address_street || "",
                                            address_city: rep.address_city || "",
                                            address_state: rep.address_state || "",
                                            address_zip: rep.address_zip || "",
                                            w9_status: rep.w9_status || "not_requested",
                                          });
                                          setShowTaxInfoModal(true);
                                        }}
                                        style={{ padding: "5px 10px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 6, color: COLORS.neonBlue, cursor: "pointer", fontSize: 11 }}
                                      >
                                        Edit Tax Info
                                      </button>
                                      {isAbove && (
                                        <button
                                          onClick={() => handleGenerate1099(rep)}
                                          disabled={necGenerating}
                                          style={{ padding: "5px 10px", background: COLORS.gradient1, border: "none", borderRadius: 6, color: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 600, opacity: necGenerating ? 0.5 : 1 }}
                                        >
                                          Generate
                                        </button>
                                      )}
                                      {rep.record1099 && !rep.record1099.sent_at && (
                                        <button
                                          onClick={() => { setSentRep(rep); setSentMethod("email"); setShowSentModal(true); }}
                                          style={{ padding: "5px 10px", background: COLORS.neonGreen, border: "none", borderRadius: 6, color: "#000", cursor: "pointer", fontSize: 11, fontWeight: 600 }}
                                        >
                                          Mark Sent
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>

                {/* Tax Info Edit Modal */}
                {showTaxInfoModal && taxInfoRep && (
                  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }} onClick={() => setShowTaxInfoModal(false)}>
                    <div style={{ background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 16, padding: 28, maxWidth: 520, width: "90%", maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
                      <h3 style={{ color: COLORS.textPrimary, margin: "0 0 4px", fontSize: 18 }}>Edit Tax Info</h3>
                      <p style={{ color: COLORS.textSecondary, fontSize: 13, margin: "0 0 20px" }}>{taxInfoRep.name}</p>

                      <div style={{ display: "grid", gap: 14 }}>
                        <div>
                          <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Legal Name (as on W-9)</label>
                          <input type="text" value={taxInfoForm.legal_name} onChange={(e) => setTaxInfoForm({ ...taxInfoForm, legal_name: e.target.value })} style={{ width: "100%", padding: "8px 12px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, fontSize: 13 }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Tax ID (SSN or EIN)</label>
                          <input type="text" value={taxInfoForm.tax_id} onChange={(e) => setTaxInfoForm({ ...taxInfoForm, tax_id: e.target.value })} placeholder="XXX-XX-XXXX" maxLength={11} style={{ width: "100%", padding: "8px 12px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, fontSize: 13 }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Street Address</label>
                          <input type="text" value={taxInfoForm.address_street} onChange={(e) => setTaxInfoForm({ ...taxInfoForm, address_street: e.target.value })} style={{ width: "100%", padding: "8px 12px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, fontSize: 13 }} />
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 100px", gap: 10 }}>
                          <div>
                            <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>City</label>
                            <input type="text" value={taxInfoForm.address_city} onChange={(e) => setTaxInfoForm({ ...taxInfoForm, address_city: e.target.value })} style={{ width: "100%", padding: "8px 12px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, fontSize: 13 }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>State</label>
                            <input type="text" value={taxInfoForm.address_state} onChange={(e) => setTaxInfoForm({ ...taxInfoForm, address_state: e.target.value.toUpperCase().slice(0, 2) })} maxLength={2} style={{ width: "100%", padding: "8px 12px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, fontSize: 13 }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>ZIP</label>
                            <input type="text" value={taxInfoForm.address_zip} onChange={(e) => setTaxInfoForm({ ...taxInfoForm, address_zip: e.target.value.replace(/\D/g, "").slice(0, 5) })} maxLength={5} style={{ width: "100%", padding: "8px 12px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, fontSize: 13 }} />
                          </div>
                        </div>
                        <div>
                          <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>W-9 Status</label>
                          <select value={taxInfoForm.w9_status} onChange={(e) => setTaxInfoForm({ ...taxInfoForm, w9_status: e.target.value })} style={{ width: "100%", padding: "8px 12px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, fontSize: 13 }}>
                            <option value="not_requested">Not Requested</option>
                            <option value="requested">Requested</option>
                            <option value="received">Received</option>
                          </select>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
                        <button onClick={() => setShowTaxInfoModal(false)} style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid " + COLORS.cardBorder, background: "transparent", color: COLORS.textSecondary, fontSize: 12, cursor: "pointer" }}>Cancel</button>
                        <button onClick={handleSaveTaxInfo} disabled={taxInfoSaving} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: COLORS.neonGreen, color: "#000", fontWeight: 700, fontSize: 12, cursor: "pointer", opacity: taxInfoSaving ? 0.5 : 1 }}>
                          {taxInfoSaving ? "Saving..." : "Save Tax Info"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Mark as Sent Modal */}
                {showSentModal && sentRep && (
                  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }} onClick={() => setShowSentModal(false)}>
                    <div style={{ background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 16, padding: 28, maxWidth: 420, width: "90%" }} onClick={(e) => e.stopPropagation()}>
                      <h3 style={{ color: COLORS.textPrimary, margin: "0 0 8px", fontSize: 18 }}>Mark 1099-NEC as Sent</h3>
                      <p style={{ color: COLORS.textSecondary, fontSize: 13, margin: "0 0 20px" }}>
                        How was the 1099-NEC for <strong style={{ color: COLORS.neonGreen }}>{sentRep.name}</strong> delivered?
                      </p>
                      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
                        {(["email", "mail", "portal"] as const).map(m => (
                          <button key={m} onClick={() => setSentMethod(m)} style={{ flex: 1, padding: "10px 16px", borderRadius: 8, border: sentMethod === m ? "2px solid " + COLORS.neonGreen : "1px solid " + COLORS.cardBorder, background: sentMethod === m ? "rgba(57,255,20,0.1)" : COLORS.darkBg, color: sentMethod === m ? COLORS.neonGreen : COLORS.textSecondary, cursor: "pointer", fontSize: 13, fontWeight: 600, textTransform: "capitalize" }}>
                            {m === "email" ? "📧 Email" : m === "mail" ? "📬 Mail" : "🌐 Portal"}
                          </button>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                        <button onClick={() => setShowSentModal(false)} style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid " + COLORS.cardBorder, background: "transparent", color: COLORS.textSecondary, fontSize: 12, cursor: "pointer" }}>Cancel</button>
                        <button onClick={handleMarkSent} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: COLORS.neonGreen, color: "#000", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Confirm Sent</button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </>
      )}
    </div>
  );
}