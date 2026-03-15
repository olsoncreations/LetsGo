"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { COLORS } from "./constants";
import { useStaffContext } from "./StaffContext";
import { getNavPermission } from "./permissions";
import * as XLSX from "xlsx";

const NAV_ITEMS = [
  { key: "overview", icon: "🏠", label: "Overview", href: "/admin/overview" },
  { key: "executive", icon: "📊", label: "Executive", href: "/admin/executive" },
  { key: "analytics", icon: "📈", label: "Staff Analytics", href: "/admin/analytics" },
  { key: "health", icon: "❤️", label: "Business Health", href: "/admin/health" },
  { key: "receipts", icon: "🧾", label: "Receipts", href: "/admin/receipts" },
  { key: "billing", icon: "💳", label: "Billing", href: "/admin/billing" },
  { key: "onboarding", icon: "📥", label: "Onboarding", href: "/admin/onboarding" },
  { key: "businesses", icon: "🏢", label: "Businesses", href: "/admin/businesses" },
  { key: "events", icon: "📅", label: "Events", href: "/admin/events" },
  { key: "ugc", icon: "📸", label: "UGC Moderation", href: "/admin/ugc" },
  { key: "users", icon: "👥", label: "Users", href: "/admin/users" },
  { key: "payouts", icon: "💸", label: "Payouts", href: "/admin/payouts" },
  { key: "referrals", icon: "🤝", label: "Referrals", href: "/admin/referrals" },
  { key: "sales", icon: "💼", label: "Sales", href: "/admin/sales" },
  { key: "advertising", icon: "📣", label: "Ads & Add-ons", href: "/admin/advertising" },
  { key: "support", icon: "🎫", label: "Support", href: "/admin/support" },
  { key: "fraud", icon: "🛡️", label: "Fraud Center", href: "/admin/fraud" },
  { key: "messaging", icon: "💬", label: "Messaging", href: "/admin/messaging" },
  { key: "automation", icon: "⚡", label: "Automation", href: "/admin/automation" },
  { key: "promotions", icon: "🎁", label: "Discounts & Promos", href: "/admin/promotions" },
  { key: "audit", icon: "📋", label: "Audit Log", href: "/admin/audit" },
  { key: "settings", icon: "⚙️", label: "Settings", href: "/admin/settings" },
  { key: "training", icon: "🎓", label: "Training", href: "/admin/training" },
];

interface AdminNavProps {
  badges?: Record<string, number>;
}

interface SearchResult {
  type: "user" | "business" | "receipt" | "ticket";
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

export default function AdminNav({ badges = {} }: AdminNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { can } = useStaffContext();
  const [currentStaff, setCurrentStaff] = useState<{ name: string; role: string } | null>(null);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  useEffect(() => {
    async function fetchStaff() {
      try {
        const { data: session } = await supabaseBrowser.auth.getSession();
        if (session?.session?.user) {
          const userId = session.session.user.id;
          const userEmail = session.session.user.email || "";
          
          // Try to get name from staff_users table first
          const { data: staffData } = await supabaseBrowser
            .from("staff_users")
            .select("*")
            .eq("user_id", userId)
            .maybeSingle();

          // Try to get name from profiles table
          const { data: profileData } = await supabaseBrowser
            .from("profiles")
            .select("full_name, first_name, last_name")
            .eq("id", userId)
            .maybeSingle();
          
          // Helper: check if a value is actually a name (not an email)
          const isRealName = (val: string | null | undefined): val is string => {
            return !!val && !val.includes("@") && val.trim().length > 0;
          };
          
          // Build name from profiles first_name + last_name if available
          const profileFullName = profileData?.full_name;
          const profileCombined = [profileData?.first_name, profileData?.last_name].filter(Boolean).join(" ");
          
          // Determine display name - skip anything that looks like an email
          const displayName = 
            (isRealName(staffData?.full_name) ? staffData.full_name : null) ||
            (isRealName(staffData?.name) ? staffData.name : null) ||
            (isRealName(profileFullName) ? profileFullName : null) ||
            (isRealName(profileCombined) ? profileCombined : null) ||
            (isRealName(session.session.user.user_metadata?.full_name) ? session.session.user.user_metadata.full_name : null) ||
            userEmail;
          
          const role = staffData?.role || "Admin";
          
          setCurrentStaff({ 
            name: displayName, 
            role: role,
          });
        }
      } catch (err) {
        console.error("Error fetching staff:", err);
      }
    }
    fetchStaff();
  }, []);

  // Search functionality
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const debounce = setTimeout(async () => {
      setSearchLoading(true);
      const results: SearchResult[] = [];
      const query = searchQuery.toLowerCase();

      try {
        // Search businesses
        const { data: businesses } = await supabaseBrowser
          .from("business")
          .select("id, business_name, public_business_name, city, state")
          .or(`business_name.ilike.%${query}%,public_business_name.ilike.%${query}%`)
          .limit(5);

        businesses?.forEach((b) => {
          results.push({
            type: "business",
            id: b.id,
            title: b.public_business_name || b.business_name || "Unknown",
            subtitle: `${b.city || ""}, ${b.state || ""}`,
            href: `/admin/businesses?id=${b.id}`,
          });
        });

        // Search profiles/users
        const { data: users } = await supabaseBrowser
          .from("profiles")
          .select("id, full_name, email")
          .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
          .limit(5);

        users?.forEach((u) => {
          results.push({
            type: "user",
            id: u.id,
            title: u.full_name || u.email || "Unknown",
            subtitle: u.email || "",
            href: `/admin/users?id=${u.id}`,
          });
        });

        // Search support tickets
        const { data: tickets } = await supabaseBrowser
          .from("support_tickets")
          .select("id, subject")
          .ilike("subject", `%${query}%`)
          .limit(3);

        tickets?.forEach((t) => {
          results.push({
            type: "ticket",
            id: t.id,
            title: t.subject,
            subtitle: "Support Ticket",
            href: `/admin/support?ticket=${t.id}`,
          });
        });

        setSearchResults(results);
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "user": return "👤";
      case "business": return "🏢";
      case "receipt": return "🧾";
      case "ticket": return "🎫";
      default: return "📄";
    }
  };

  return (
    <>
      <nav
        style={{
          width: 220,
          background: COLORS.cardBg,
          borderRight: "1px solid " + COLORS.cardBorder,
          padding: "20px 12px",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
          flexShrink: 0,
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, padding: "0 8px" }}>
          <img 
            src="/lg-logo.png"
            alt="LetsGo"
            style={{ width: 44, height: 44, borderRadius: 12, objectFit: "cover" }}
            onError={(e) => {
              // Try Supabase Storage as fallback
              const target = e.currentTarget;
              if (!target.dataset.triedSupabase) {
                target.dataset.triedSupabase = "true";
                target.src = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/public/lg-logo.png`;
              } else {
                // Both failed - show gradient fallback
                target.style.display = "none";
                const fallback = target.nextElementSibling as HTMLElement;
                if (fallback) fallback.style.display = "flex";
              }
            }}
          />
          <div style={{ width: 44, height: 44, background: COLORS.gradient1, borderRadius: 12, display: "none", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 18 }}>LG</div>
          <span style={{ fontWeight: 700, fontSize: 18, background: COLORS.gradient1, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>LetsGo</span>
        </div>

        {/* Current Staff */}
        {currentStaff && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px", marginBottom: 12, background: COLORS.darkBg, borderRadius: 10, border: "1px solid " + COLORS.cardBorder }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: COLORS.gradient1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700 }}>
              {currentStaff.name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2)}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textPrimary }}>{currentStaff.name}</div>
              <div style={{ fontSize: 11, color: COLORS.textSecondary }}>{currentStaff.role}</div>
            </div>
          </div>
        )}

        {/* Global Search Button */}
        <button
          onClick={() => setShowGlobalSearch(true)}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", marginBottom: 8, borderRadius: 8, border: "1px solid " + COLORS.cardBorder, cursor: "pointer", background: COLORS.darkBg, color: COLORS.textSecondary, fontSize: 12, width: "100%" }}
        >
          <span>🔍</span>
          <span style={{ flex: 1, textAlign: "left" }}>Search...</span>
          <span style={{ fontSize: 10, opacity: 0.6 }}>⌘K</span>
        </button>

        {/* Custom Reports Button */}
        <button
          onClick={() => setShowReportModal(true)}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", marginBottom: 16, borderRadius: 8, border: "1px solid " + COLORS.cardBorder, cursor: "pointer", background: COLORS.darkBg, color: COLORS.textSecondary, fontSize: 12, width: "100%" }}
        >
          <span>📊</span>
          <span style={{ flex: 1, textAlign: "left" }}>Custom Reports</span>
        </button>

        {/* Nav Items — filtered by role permissions */}
        {NAV_ITEMS.filter((nav) => {
          const required = getNavPermission(nav.key);
          return required === null || can(required);
        }).map((nav) => {
          const isActive = pathname === nav.href || pathname?.startsWith(nav.href + "/");
          const badge = badges[nav.key] || 0;

          return (
            <Link
              key={nav.key}
              href={nav.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                marginBottom: 4,
                borderRadius: 8,
                textDecoration: "none",
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                background: isActive ? COLORS.gradient1 : "transparent",
                color: isActive ? "#fff" : COLORS.textSecondary,
                transition: "all 0.2s",
              }}
            >
              <span style={{ fontSize: 16 }}>{nav.icon}</span>
              <span style={{ flex: 1 }}>{nav.label}</span>
              {badge > 0 && (
                <span style={{ background: isActive ? "rgba(255,255,255,0.3)" : COLORS.neonPink, color: "#fff", padding: "2px 6px", borderRadius: 100, fontSize: 10, fontWeight: 700 }}>
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Global Search Modal */}
      {showGlobalSearch && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 100, zIndex: 1001 }}
          onClick={() => { setShowGlobalSearch(false); setSearchQuery(""); setSearchResults([]); }}
        >
          <div
            style={{ background: COLORS.cardBg, borderRadius: 16, padding: 24, width: 600, maxWidth: "95%", border: "1px solid " + COLORS.cardBorder }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <span style={{ fontSize: 24 }}>🔍</span>
              <input
                type="text"
                placeholder="Search users, businesses, tickets..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                autoFocus
                style={{ flex: 1, padding: "14px 16px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, fontSize: 16 }}
              />
              <button onClick={() => { setShowGlobalSearch(false); setSearchQuery(""); }} style={{ padding: "10px 16px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textSecondary, cursor: "pointer", fontSize: 12 }}>ESC</button>
            </div>
            
            {searchLoading ? (
              <div style={{ color: COLORS.textSecondary, textAlign: "center", padding: 40 }}>Searching...</div>
            ) : searchResults.length > 0 ? (
              <div style={{ maxHeight: 400, overflowY: "auto" }}>
                {searchResults.map((result, i) => (
                  <Link
                    key={`${result.type}-${result.id}`}
                    href={result.href}
                    onClick={() => { setShowGlobalSearch(false); setSearchQuery(""); }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 16px",
                      background: i % 2 === 0 ? COLORS.darkBg : "transparent",
                      borderRadius: 8,
                      textDecoration: "none",
                      color: COLORS.textPrimary,
                    }}
                  >
                    <span style={{ fontSize: 20 }}>{getTypeIcon(result.type)}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>{result.title}</div>
                      <div style={{ fontSize: 12, color: COLORS.textSecondary }}>{result.subtitle}</div>
                    </div>
                    <span style={{ fontSize: 10, padding: "4px 8px", background: COLORS.cardBg, borderRadius: 4, color: COLORS.textSecondary, textTransform: "capitalize" }}>{result.type}</span>
                  </Link>
                ))}
              </div>
            ) : searchQuery.length >= 2 ? (
              <div style={{ color: COLORS.textSecondary, textAlign: "center", padding: 40 }}>No results found for "{searchQuery}"</div>
            ) : (
              <div style={{ color: COLORS.textSecondary, textAlign: "center", padding: 40 }}>Start typing to search across the platform</div>
            )}
          </div>
        </div>
      )}

      {/* Custom Reports Modal */}
      {showReportModal && (
        <CustomReportsModal onClose={() => setShowReportModal(false)} />
      )}
    </>
  );
}

// Custom Reports Modal Component - With Supabase Persistence
interface ScheduledReport {
  id?: string;
  name: string;
  report_type: string;
  frequency: string;
  send_time: string;
  format: string;
  recipients: string;
  include_summary: boolean;
  next_run?: string;
  created_at?: string;
}

function CustomReportsModal({ onClose }: { onClose: () => void }) {
  const [reportConfig, setReportConfig] = useState({
    type: "receipts",
    dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    dateTo: new Date().toISOString().split("T")[0],
    format: "xlsx",
    frequency: "",
    sendTime: "06:00",
    recipients: "",
    includeSummary: false,
  });
  const [generating, setGenerating] = useState(false);
  const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);

  // Report type labels for display
  const reportTypeLabels: Record<string, string> = {
    master: "⭐ Master Report",
    receipts: "Receipts Report",
    payouts: "Payouts Report",
    revenue: "Revenue Report",
    users: "Users Report",
    businesses: "Businesses Report",
    advertising: "Advertising Report",
    staff_activity: "Staff Activity Report",
    audit: "Audit Log Report",
    support: "Support Tickets Report",
    fraud: "Fraud Alerts Report",
    referrals: "Referrals Report",
    influencers: "🌟 Influencer Report",
    surge_pricing: "⚡ Surge Pricing Report",
    promotions: "Promotions Report",
  };

  const frequencyLabels: Record<string, string> = {
    daily: "Daily",
    weekly: "Weekly",
    biweekly: "Bi-weekly",
    monthly: "Monthly",
    quarterly: "Quarterly",
  };

  // Fetch scheduled reports from Supabase on mount
  useEffect(() => {
    fetchScheduledReports();
  }, []);

  const fetchScheduledReports = async () => {
    setLoadingReports(true);
    try {
      const { data, error } = await supabaseBrowser
        .from("scheduled_reports")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) {
        console.error("Error fetching scheduled reports:", error);
        // Table might not exist yet - that's OK
        setScheduledReports([]);
      } else {
        setScheduledReports(data || []);
      }
    } catch (err) {
      console.error("Error fetching scheduled reports:", err);
      setScheduledReports([]);
    } finally {
      setLoadingReports(false);
    }
  };

  // Calculate next run date based on frequency
  const calculateNextRun = (frequency: string): string => {
    const now = new Date();
    switch (frequency) {
      case "daily":
        now.setDate(now.getDate() + 1);
        break;
      case "weekly":
        now.setDate(now.getDate() + (8 - now.getDay()) % 7 || 7); // Next Monday
        break;
      case "biweekly":
        now.setDate(now.getDate() + 14);
        break;
      case "monthly":
        now.setMonth(now.getMonth() + 1, 1);
        break;
      case "quarterly":
        now.setMonth(now.getMonth() + 3, 1);
        break;
      default:
        return "";
    }
    return now.toISOString().split("T")[0];
  };

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const generateReport = async () => {
    setGenerating(true);
    try {
      const fromDate = reportConfig.dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const toDate = reportConfig.dateTo || new Date().toISOString().split("T")[0];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const q = async (table: string, columns: string, dateFilter = true): Promise<any[]> => {
        try {
          let query = supabaseBrowser.from(table).select(columns);
          if (dateFilter) query = query.gte("created_at", fromDate).lte("created_at", toDate + "T23:59:59");
          const { data, error } = await query.order("created_at", { ascending: false }).limit(10000);
          if (error) { console.error(`${table}:`, error); return []; }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return (data || []) as any[];
        } catch { return []; }
      };
      const $$ = (c: number | null) => c != null ? `$${(c / 100).toFixed(2)}` : "$0.00";
      const n = (v: unknown) => Number(v) || 0;
      const fmt = (d: string | null) => d ? new Date(d).toLocaleString() : "";

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const buildSheet = (rows: any[], headers: string[]): unknown[][] => {
        if (rows.length === 0) return [headers];
        return [headers, ...rows];
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const downloadXlsx = (sheets: { name: string; data: unknown[][] }[], filename: string) => {
        const wb = XLSX.utils.book_new();
        for (const sheet of sheets) {
          const ws = XLSX.utils.aoa_to_sheet(sheet.data);
          const colWidths = sheet.data[0]?.map((_: unknown, ci: number) => {
            let max = 10;
            for (const row of sheet.data) {
              const val = row[ci];
              const len = String(val ?? "").length;
              if (len > max) max = Math.min(len, 50);
            }
            return { wch: max + 2 };
          }) || [];
          ws["!cols"] = colWidths;
          XLSX.utils.book_append_sheet(wb, ws, sheet.name.substring(0, 31));
        }
        const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
        const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      };

      if (reportConfig.type === "master") {
        // ============================================================
        // MASTER REPORT — Multi-sheet XLSX with maximum data
        // ============================================================
        const allReceipts = await q("receipts", "*");
        const allPayouts = await q("payouts", "*");
        const allBiz = await q("business", "*", false);
        const allUsers = await q("profiles", "*", false);
        const allTickets = await q("support_tickets", "*");
        const allFraud = await q("fraud_alerts", "*");
        const allReferrals = await q("referrals", "*");
        const allPromos = await q("promotions", "*", false);
        const allRedemptions = await q("promotion_redemptions", "*");
        const allStaff = await q("staff_users", "*", false);
        const allBans = await q("user_bans", "*");
        const allSalesReps = await q("sales_reps", "*", false);
        const allSalesSignups = await q("sales_signups", "*");
        const allAutomation = await q("automation_rules", "*", false);
        const allAutoRuns = await q("automation_runs", "*");
        const allSurgeEvents = await q("surge_pricing_events", "*", false);
        const allAdCampaigns = await q("business_ad_campaigns", "*");

        // Lookup maps for human-readable names
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bm: Record<string, any> = {}; for (const b of allBiz) bm[b.id] = b;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const um: Record<string, any> = {}; for (const u of allUsers) um[u.id] = u;
        const bn = (id: string) => bm[id]?.business_name || bm[id]?.public_business_name || id || "";
        const un = (id: string) => um[id]?.full_name || um[id]?.email || id || "";

        // --- Summary calculations ---
        const totRevC = allReceipts.reduce((s: number, r: { receipt_total_cents?: number }) => s + n(r.receipt_total_cents), 0);
        const totPayC = allReceipts.reduce((s: number, r: { payout_cents?: number }) => s + n(r.payout_cents), 0);
        const appr = allReceipts.filter((r: { status?: string }) => r.status === "approved");
        const pend = allReceipts.filter((r: { status?: string }) => r.status === "pending");
        const rej = allReceipts.filter((r: { status?: string }) => r.status === "rejected");
        const compP = allPayouts.filter((p: { status?: string }) => p.status === "completed");
        const pendP = allPayouts.filter((p: { status?: string }) => p.status === "pending");
        const failP = allPayouts.filter((p: { status?: string }) => p.status === "failed");
        const compPC = compP.reduce((s: number, p: { amount_cents?: number }) => s + n(p.amount_cents), 0);
        const pendPC = pendP.reduce((s: number, p: { amount_cents?: number }) => s + n(p.amount_cents), 0);
        const actBiz = allBiz.filter((b: { is_active?: boolean }) => b.is_active);
        const actUsr = allUsers.filter((u: { status?: string }) => u.status === "active" || !u.status);
        const openTix = allTickets.filter((t: { status?: string }) => t.status === "open" || t.status === "in_progress");
        const urgTix = allTickets.filter((t: { priority?: string }) => t.priority === "urgent" || t.priority === "high");
        const critFr = allFraud.filter((f: { severity?: string }) => f.severity === "critical" || f.severity === "high");
        const openFr = allFraud.filter((f: { status?: string }) => f.status === "new" || f.status === "investigating");
        const convRef = allReferrals.filter((r: { status?: string }) => r.status === "converted");
        const refRew = allReferrals.reduce((s: number, r: { reward_cents?: number }) => s + n(r.reward_cents), 0);
        const actPro = allPromos.filter((p: { is_active?: boolean }) => p.is_active);
        const totDisc = allRedemptions.reduce((s: number, r: { discount_applied_cents?: number }) => s + n(r.discount_applied_cents), 0);
        const actBans = allBans.filter((b: { lifted_at?: string }) => !b.lifted_at);
        const actReps = allSalesReps.filter((r: { is_active?: boolean }) => r.is_active);
        const totComm = allSalesSignups.reduce((s: number, x: { commission_cents?: number }) => s + n(x.commission_cents), 0);
        const actAuto = allAutomation.filter((a: { is_active?: boolean }) => a.is_active);

        // SHEET 1: EXECUTIVE SUMMARY
        const sum: unknown[][] = [
          ["LETSGO MASTER REPORT"], ["Report Period", `${fromDate} to ${toDate}`], ["Generated", new Date().toLocaleString()], [],
          ["CATEGORY", "METRIC", "VALUE", "DETAIL"], [],
          ["RECEIPTS", "Total Receipts", allReceipts.length, `Approved: ${appr.length} | Pending: ${pend.length} | Rejected: ${rej.length}`],
          ["", "Total Receipt Volume", $$(totRevC), `Average: ${$$(allReceipts.length > 0 ? Math.round(totRevC / allReceipts.length) : 0)} per receipt`],
          ["", "Total Payouts to Businesses", $$(totPayC), ""],
          ["", "Platform Revenue (Retained)", $$(totRevC - totPayC), `Margin: ${totRevC > 0 ? ((1 - totPayC / totRevC) * 100).toFixed(1) : "0"}%`],
          ["", "Payout-to-Receipt Ratio", totRevC > 0 ? `${((totPayC / totRevC) * 100).toFixed(1)}%` : "N/A", ""],
          ["", "Approval Rate", allReceipts.length > 0 ? `${((appr.length / allReceipts.length) * 100).toFixed(1)}%` : "N/A", ""], [],
          ["PAYOUTS", "Total Payout Records", allPayouts.length, `Completed: ${compP.length} | Pending: ${pendP.length} | Failed: ${failP.length}`],
          ["", "Completed Volume", $$(compPC), ""], ["", "Pending Volume", $$(pendPC), ""], [],
          ["BUSINESSES", "Total Businesses", allBiz.length, `Active: ${actBiz.length} | Inactive: ${allBiz.length - actBiz.length}`],
          ["", "Basic Plan", allBiz.filter((b: { billing_plan?: string }) => b.billing_plan === "basic").length, ""],
          ["", "Premium Plan", allBiz.filter((b: { billing_plan?: string }) => b.billing_plan === "premium").length, ""],
          ["", "Enterprise Plan", allBiz.filter((b: { billing_plan?: string }) => b.billing_plan === "enterprise").length, ""],
          ["", "Auto-Approval Enabled", allBiz.filter((b: { auto_approval_enabled?: boolean }) => b.auto_approval_enabled).length, ""], [],
          ["USERS", "Total Users", allUsers.length, `Active: ${actUsr.length}`],
          ["", "Banned Users (Active)", actBans.length, `Permanent: ${actBans.filter((b: { is_permanent?: boolean }) => b.is_permanent).length}`], [],
          ["SUPPORT", "Total Tickets", allTickets.length, `Open/In-Progress: ${openTix.length}`],
          ["", "Urgent/High Priority", urgTix.length, ""], [],
          ["FRAUD", "Total Alerts", allFraud.length, `Open/Investigating: ${openFr.length}`],
          ["", "Critical/High Severity", critFr.length, ""], [],
          ["REFERRALS", "Total Referrals", allReferrals.length, `Converted: ${convRef.length} (${allReferrals.length > 0 ? ((convRef.length / allReferrals.length) * 100).toFixed(1) : 0}%)`],
          ["", "Rewards Issued", $$(refRew), ""], [],
          ["PROMOTIONS", "Active Promos", actPro.length, `Total: ${allPromos.length}`],
          ["", "Total Redemptions", allRedemptions.length, ""], ["", "Total Discount Given", $$(totDisc), ""], [],
          ["SALES", "Active Reps", actReps.length, `Total: ${allSalesReps.length}`],
          ["", "Signups via Sales", allSalesSignups.length, ""], ["", "Total Commissions", $$(totComm), ""], [],
          ["AUTOMATION", "Active Rules", actAuto.length, `Total: ${allAutomation.length}`],
          ["", "Total Runs", allAutoRuns.length, `Success: ${allAutoRuns.filter((r: { status?: string }) => r.status === "success").length} | Failed: ${allAutoRuns.filter((r: { status?: string }) => r.status === "failed").length}`], [],
          ["STAFF", "Staff Members", allStaff.length, `Admins: ${allStaff.filter((s: { role?: string }) => s.role === "Admin" || s.role === "admin").length}`], [],
          ["SURGE PRICING", "Total Surge Events", allSurgeEvents.length, `Active: ${allSurgeEvents.filter((e: { is_active?: boolean }) => e.is_active).length}`],
          ["", "Total Ad Campaigns", allAdCampaigns.length, `Active: ${allAdCampaigns.filter((c: { status?: string }) => c.status === "active").length}`],
          ["", "Total Ad Revenue", $$(allAdCampaigns.reduce((s: number, c: { total_price_cents?: number }) => s + n(c.total_price_cents), 0)), ""],
          ["", "Total Surge Fees", $$(allAdCampaigns.reduce((s: number, c: { surge_fee_cents?: number }) => s + n(c.surge_fee_cents), 0)), ""],
        ];

        // SHEET 2: RECEIPTS (max detail)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const recH = ["Receipt ID", "Business ID", "Business Name", "User ID", "User Name", "Receipt Total", "Payout Amount", "Platform Revenue", "Payout Rate %", "Platform Margin %", "Status", "Image URL", "Receipt #", "Notes", "Created At", "Updated At"];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const recR = allReceipts.map((r: any) => { const t = n(r.receipt_total_cents), p = n(r.payout_cents); return [r.id, r.business_id, bn(r.business_id), r.user_id, un(r.user_id), $$(t), $$(p), $$(t - p), t > 0 ? `${((p / t) * 100).toFixed(1)}%` : "0%", t > 0 ? `${(((t - p) / t) * 100).toFixed(1)}%` : "0%", r.status, r.receipt_image_url || "", r.receipt_number || "", r.notes || "", fmt(r.created_at), fmt(r.updated_at)]; });

        // SHEET 3: PAYOUTS
        const payH = ["Payout ID", "Business ID", "Business Name", "Amount", "Status", "Payout Method", "Reference #", "Receipt IDs", "Notes", "Processed By", "Created At", "Processed At"];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const payR = allPayouts.map((p: any) => [p.id, p.business_id, bn(p.business_id), $$(n(p.amount_cents)), p.status, p.payout_method || "", p.reference_number || "", (p.receipt_ids || []).join("; "), p.notes || "", p.processed_by || "", fmt(p.created_at), fmt(p.processed_at)]);

        // SHEET 4: BUSINESSES (every column)
        const bizH = ["Business ID", "Business Name", "Public Name", "Description", "Business Type", "Cuisine Type", "Price Level", "Age Restriction", "Address", "City", "State", "ZIP", "Phone", "Email", "Website", "Is Active", "Billing Plan", "Payment Method", "Bank Name", "Account Type", "Routing Last 4", "Account Last 4", "Card Brand", "Card Last 4", "Billing Email", "Billing Address", "Payout Preset", "Auto-Approval", "Auto-Approval Max ($)", "Rep Name", "Rep Title", "Rep Email", "Rep Phone", "Verifier Name", "Verifier Email", "Verifier Phone", "Login Email", "Login Phone", "Total Receipts", "Total Payouts", "Active Customers", "Avg Receipt", "Ad Spend", "Tags", "Internal Notes", "Created At"];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bizR = allBiz.map((b: any) => [b.id, b.business_name || "", b.public_business_name || "", b.description || "", b.business_type || "", b.cuisine_type || "", b.price_level || "", b.age_restriction || "", b.address || "", b.city || "", b.state || "", b.zip || "", b.phone || "", b.email || b.contact_email || "", b.website || "", b.is_active ? "Yes" : "No", b.billing_plan || "", b.payment_method || "", b.bank_name || "", b.account_type || "", b.routing_last4 || "", b.account_last4 || "", b.card_brand || "", b.card_last4 || "", b.billing_email || "", b.billing_address || "", b.payout_preset || "", b.auto_approval_enabled ? "Yes" : "No", String(b.auto_approval_max ?? ""), b.rep_name || "", b.rep_title || "", b.rep_email || "", b.rep_phone || "", b.verifier_name || "", b.verifier_email || "", b.verifier_phone || "", b.login_email || "", b.login_phone || "", n(b.total_receipts), $$(n(b.total_payout_cents)), n(b.active_customers), $$(n(b.avg_receipt_amount)), $$(n(b.ad_spend_total)), (b.tags || []).join("; "), b.internal_notes || "", fmt(b.created_at)]);

        // SHEET 5: USERS (every column)
        const usrH = ["User ID", "Full Name", "First Name", "Last Name", "Email", "Username", "Phone", "Location", "Bio", "Avatar URL", "Status", "User Type", "Created At", "Updated At"];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const usrR = allUsers.map((u: any) => [u.id, u.full_name || "", u.first_name || "", u.last_name || "", u.email || "", u.username || "", u.phone || "", u.location || "", u.bio || "", u.avatar_url || "", u.status || "active", u.user_type || "user", fmt(u.created_at), fmt(u.updated_at)]);

        // SHEET 6: SUPPORT TICKETS
        const tixH = ["Ticket ID", "User ID", "User Name", "Business ID", "Business Name", "Subject", "Body", "Status", "Priority", "Category", "Assigned To", "Resolved By", "Resolution Time", "Created At", "Updated At", "Resolved At"];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tixR = allTickets.map((t: any) => { const c = t.created_at ? new Date(t.created_at) : null; const rv = t.resolved_at ? new Date(t.resolved_at) : null; const rt = c && rv ? `${Math.round((rv.getTime() - c.getTime()) / 3600000)}h` : ""; return [t.id, t.user_id, un(t.user_id), t.business_id, bn(t.business_id), t.subject, t.body || "", t.status, t.priority, t.category || "", t.assigned_to || "", t.resolved_by || "", rt, fmt(t.created_at), fmt(t.updated_at), fmt(t.resolved_at)]; });

        // SHEET 7: FRAUD ALERTS
        const frH = ["Alert ID", "User ID", "User Name", "Business ID", "Business Name", "Receipt ID", "Alert Type", "Severity", "Status", "Details (JSON)", "Assigned To", "Resolved By", "Resolution Notes", "Created At", "Resolved At"];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const frR = allFraud.map((f: any) => [f.id, f.user_id, un(f.user_id), f.business_id, bn(f.business_id), f.receipt_id || "", f.alert_type, f.severity, f.status, JSON.stringify(f.details || {}), f.assigned_to || "", f.resolved_by || "", f.resolution_notes || "", fmt(f.created_at), fmt(f.resolved_at)]);

        // SHEET 8: REFERRALS
        const refH = ["Referral ID", "Referrer User ID", "Referrer Name", "Referrer Biz ID", "Referrer Business", "Referred Biz ID", "Referred Business", "Referred User ID", "Referred User", "Source", "Referral Code", "Status", "Reward Amount", "Reward Paid", "Converted At", "Created At"];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const refR = allReferrals.map((r: any) => [r.id, r.referrer_id, un(r.referrer_id), r.referrer_business_id, bn(r.referrer_business_id), r.referred_business_id, bn(r.referred_business_id), r.referred_user_id, un(r.referred_user_id), r.source, r.referral_code || "", r.status, $$(n(r.reward_cents)), r.reward_paid ? "Yes" : "No", fmt(r.converted_at), fmt(r.created_at)]);

        // SHEET 9: PROMOTIONS
        const proH = ["Promo ID", "Code", "Description", "Discount Type", "Discount Value", "Min Purchase", "Max Uses", "Times Used", "Usage Rate", "Status", "Applies To", "Start Date", "End Date", "Created By", "Created At"];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const proR = allPromos.map((p: any) => [p.id, p.code, p.description || "", p.discount_type, p.discount_type === "percent" ? `${p.discount_amount}%` : $$(n(p.discount_amount)), $$(n(p.min_purchase_cents)), p.max_uses ?? "Unlimited", n(p.uses_count), p.max_uses ? `${((n(p.uses_count) / n(p.max_uses)) * 100).toFixed(0)}%` : "N/A", p.is_active ? "Active" : "Inactive", p.applies_to || "all", fmt(p.start_date), fmt(p.end_date), p.created_by || "", fmt(p.created_at)]);

        // SHEET 10: PROMO REDEMPTIONS
        const redH = ["Redemption ID", "Promotion ID", "Promo Code", "User ID", "User Name", "Business ID", "Business Name", "Discount Applied", "Created At"];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const proMap: Record<string, any> = {}; for (const p of allPromos) proMap[p.id] = p;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const redR = allRedemptions.map((r: any) => [r.id, r.promotion_id || "", proMap[r.promotion_id]?.code || "", r.user_id, un(r.user_id), r.business_id, bn(r.business_id), $$(n(r.discount_applied_cents)), fmt(r.created_at)]);

        // SHEET 11: USER BANS
        const banH = ["Ban ID", "User ID", "User Name", "Reason", "Banned By ID", "Banned By Name", "Type", "Expires At", "Current Status", "Lifted At", "Lifted By", "Created At"];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const banR = allBans.map((b: any) => [b.id, b.user_id, un(b.user_id), b.reason, b.banned_by, un(b.banned_by), b.is_permanent ? "Permanent" : "Temporary", fmt(b.expires_at), b.lifted_at ? "Lifted" : "Active", fmt(b.lifted_at), b.lifted_by ? un(b.lifted_by) : "", fmt(b.created_at)]);

        // SHEET 12: SALES REPS
        const srH = ["Rep ID", "Name", "Email", "Phone", "Zone", "Status", "Commission Rate", "Manager ID", "Total Signups", "Total Commission Earned", "Paid Signups", "Hire Date", "Created At"];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const srR = allSalesReps.map((r: any) => { const su = allSalesSignups.filter((s: { rep_id?: string }) => s.rep_id === r.id); const cm = su.reduce((s: number, x: { commission_cents?: number }) => s + n(x.commission_cents), 0); return [r.id, r.name, r.email, r.phone || "", r.zone || "", r.is_active ? "Active" : "Inactive", `${(n(r.commission_rate_bps) / 100).toFixed(1)}%`, r.manager_id || "", su.length, $$(cm), su.filter((s: { commission_paid?: boolean }) => s.commission_paid).length, fmt(r.hire_date), fmt(r.created_at)]; });

        // SHEET 13: SALES SIGNUPS
        const ssH = ["Signup ID", "Rep ID", "Rep Name", "Business ID", "Business Name", "Plan", "Commission", "Commission Status", "Paid At", "Created At"];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const repMap: Record<string, any> = {}; for (const r of allSalesReps) repMap[r.id] = r;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ssR = allSalesSignups.map((s: any) => [s.id, s.rep_id, repMap[s.rep_id]?.name || "", s.business_id, bn(s.business_id), s.plan || "", $$(n(s.commission_cents)), s.commission_paid ? "Paid" : "Unpaid", fmt(s.paid_at), fmt(s.created_at)]);

        // SHEET 14: AUTOMATION
        const autoH = ["Rule ID", "Name", "Description", "Trigger Type", "Trigger Config", "Conditions", "Actions", "Status", "Lifetime Run Count", "Runs in Period", "Successes", "Failures", "Success Rate", "Last Run At", "Created By", "Created At"];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const autoR = allAutomation.map((a: any) => { const runs = allAutoRuns.filter((r: { rule_id?: string }) => r.rule_id === a.id); const ok = runs.filter((r: { status?: string }) => r.status === "success").length; const fail = runs.filter((r: { status?: string }) => r.status === "failed").length; return [a.id, a.name, a.description || "", a.trigger_type, JSON.stringify(a.trigger_config || {}), JSON.stringify(a.conditions || []), JSON.stringify(a.actions || []), a.is_active ? "Active" : "Inactive", n(a.run_count), runs.length, ok, fail, runs.length > 0 ? `${((ok / runs.length) * 100).toFixed(0)}%` : "N/A", fmt(a.last_run_at), a.created_by || "", fmt(a.created_at)]; });

        // SHEET 15: STAFF
        const stfH = ["User ID", "Name", "Full Name", "Email", "Role", "Created At"];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const stfR = allStaff.map((s: any) => [s.user_id, s.name || "", s.full_name || "", s.email || un(s.user_id), s.role, fmt(s.created_at)]);

        // SHEET 16: SURGE PRICING EVENTS
        const surgeH = ["Event ID", "Event Name", "Description", "Multiplier", "Start Date", "End Date", "Affected Categories", "Active", "Created By", "Created At"];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const surgeR = allSurgeEvents.map((e: any) => [e.id, e.name || "", e.description || "", e.multiplier || "", fmt(e.start_date), fmt(e.end_date), (e.affected_categories || []).join("; "), e.is_active ? "Yes" : "No", e.created_by || "", fmt(e.created_at)]);

        // SHEET 17: AD CAMPAIGNS
        const adH = ["Campaign ID", "Business ID", "Business Name", "Campaign Type", "Duration Days", "Base Price", "Surge Fee", "Total Price", "Surge Event ID", "Status", "Start Date", "End Date", "Created At"];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const adR = allAdCampaigns.map((c: any) => [c.id, c.business_id, bn(c.business_id), c.campaign_type || "", c.duration_days || "", $$(n(c.base_price_cents)), $$(n(c.surge_fee_cents)), $$(n(c.total_price_cents)), c.surge_event_id || "", c.status || "", fmt(c.start_date), fmt(c.end_date), fmt(c.created_at)]);

        const sheets = [
          { name: "Executive Summary", data: sum },
          { name: "Receipts", data: buildSheet(recR, recH) },
          { name: "Payouts", data: buildSheet(payR, payH) },
          { name: "Businesses", data: buildSheet(bizR, bizH) },
          { name: "Users", data: buildSheet(usrR, usrH) },
          { name: "Support Tickets", data: buildSheet(tixR, tixH) },
          { name: "Fraud Alerts", data: buildSheet(frR, frH) },
          { name: "Referrals", data: buildSheet(refR, refH) },
          { name: "Promotions", data: buildSheet(proR, proH) },
          { name: "Promo Redemptions", data: buildSheet(redR, redH) },
          { name: "User Bans", data: buildSheet(banR, banH) },
          { name: "Sales Reps", data: buildSheet(srR, srH) },
          { name: "Sales Signups", data: buildSheet(ssR, ssH) },
          { name: "Automation Rules", data: buildSheet(autoR, autoH) },
          { name: "Staff", data: buildSheet(stfR, stfH) },
          { name: "Surge Pricing Events", data: buildSheet(surgeR, surgeH) },
          { name: "Ad Campaigns", data: buildSheet(adR, adH) },
        ];

        downloadXlsx(sheets, `LetsGo_MASTER_REPORT_${fromDate}_to_${toDate}.xlsx`);
        const totalRows = sheets.reduce((s, sh) => s + Math.max(sh.data.length - 1, 0), 0);
        alert(`Master Report generated!\n\n${sheets.length} worksheets • ${totalRows} total data rows\n\n${sheets.map(s => `• ${s.name} (${Math.max(s.data.length - 1, 0)} rows)`).join("\n")}`);
        setGenerating(false);
        return;
      }

      // ============================================================
      // INDIVIDUAL REPORTS — Maximized columns + calculated fields
      // ============================================================
      let headers: string[] = [];
      let rows: string[][] = [];

      switch (reportConfig.type) {
        case "receipts": {
          const d = await q("receipts", "*");
          headers = ["Receipt ID", "Business ID", "User ID", "Receipt Total", "Payout Amount", "Platform Revenue", "Payout Rate %", "Platform Margin %", "Status", "Image URL", "Receipt #", "Notes", "Created At", "Updated At"];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          rows = d.map((r: any) => { const t = n(r.receipt_total_cents), p = n(r.payout_cents); return [r.id, r.business_id, r.user_id, $$(t), $$(p), $$(t - p), t > 0 ? `${((p / t) * 100).toFixed(1)}%` : "0%", t > 0 ? `${(((t - p) / t) * 100).toFixed(1)}%` : "0%", r.status, r.receipt_image_url || "", r.receipt_number || "", r.notes || "", fmt(r.created_at), fmt(r.updated_at)]; });
          break;
        }
        case "revenue": {
          const d = (await q("receipts", "*")).filter((r: { status?: string }) => r.status === "approved");
          headers = ["Receipt ID", "Business ID", "User ID", "Receipt Total", "Payout Amount", "Platform Revenue", "Payout Rate %", "Platform Margin %", "Created At"];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          rows = d.map((r: any) => { const t = n(r.receipt_total_cents), p = n(r.payout_cents); return [r.id, r.business_id, r.user_id, $$(t), $$(p), $$(t - p), t > 0 ? `${((p / t) * 100).toFixed(1)}%` : "0%", t > 0 ? `${(((t - p) / t) * 100).toFixed(1)}%` : "0%", fmt(r.created_at)]; });
          break;
        }
        case "payouts": {
          const d = await q("payouts", "*");
          headers = ["Payout ID", "Business ID", "Amount", "Status", "Payout Method", "Reference #", "Receipt IDs", "Notes", "Processed By", "Created At", "Processed At"];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          rows = d.map((p: any) => [p.id, p.business_id, $$(n(p.amount_cents)), p.status, p.payout_method || "", p.reference_number || "", (p.receipt_ids || []).join("; "), p.notes || "", p.processed_by || "", fmt(p.created_at), fmt(p.processed_at)]);
          break;
        }
        case "businesses": {
          const d = await q("business", "*", false);
          headers = ["Business ID", "Business Name", "Public Name", "Description", "Type", "Cuisine", "Price Level", "Age Restriction", "Address", "City", "State", "ZIP", "Phone", "Email", "Website", "Active", "Billing Plan", "Payment Method", "Bank", "Account Type", "Routing Last4", "Account Last4", "Card Brand", "Card Last4", "Billing Email", "Payout Preset", "Auto-Approval", "Auto-Approval Max", "Rep Name", "Rep Email", "Rep Phone", "Verifier Name", "Verifier Email", "Total Receipts", "Total Payouts", "Active Customers", "Avg Receipt", "Ad Spend", "Tags", "Internal Notes", "Created At"];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          rows = d.map((b: any) => [b.id, b.business_name || "", b.public_business_name || "", b.description || "", b.business_type || "", b.cuisine_type || "", b.price_level || "", b.age_restriction || "", b.address || "", b.city || "", b.state || "", b.zip || "", b.phone || "", b.email || b.contact_email || "", b.website || "", b.is_active ? "Yes" : "No", b.billing_plan || "", b.payment_method || "", b.bank_name || "", b.account_type || "", b.routing_last4 || "", b.account_last4 || "", b.card_brand || "", b.card_last4 || "", b.billing_email || "", b.payout_preset || "", b.auto_approval_enabled ? "Yes" : "No", String(b.auto_approval_max ?? ""), b.rep_name || "", b.rep_email || "", b.rep_phone || "", b.verifier_name || "", b.verifier_email || "", String(n(b.total_receipts)), $$(n(b.total_payout_cents)), String(n(b.active_customers)), $$(n(b.avg_receipt_amount)), $$(n(b.ad_spend_total)), (b.tags || []).join("; "), b.internal_notes || "", fmt(b.created_at)]);
          break;
        }
        case "users": {
          const d = await q("profiles", "*", false);
          headers = ["User ID", "Full Name", "First Name", "Last Name", "Email", "Username", "Phone", "Location", "Bio", "Avatar URL", "Status", "User Type", "Created At", "Updated At"];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          rows = d.map((u: any) => [u.id, u.full_name || "", u.first_name || "", u.last_name || "", u.email || "", u.username || "", u.phone || "", u.location || "", u.bio || "", u.avatar_url || "", u.status || "active", u.user_type || "user", fmt(u.created_at), fmt(u.updated_at)]);
          break;
        }
        case "advertising": {
          const [bizData, adCampData] = await Promise.all([
            q("business", "*", false),
            q("business_ad_campaigns", "*"),
          ]);
          // Sheet 1: Business Ad Spend
          const advBizH = ["Business ID", "Business Name", "Public Name", "City", "State", "Type", "Billing Plan", "Ad Spend Total", "Active", "Total Receipts", "Active Customers", "Avg Receipt", "Config (JSON)", "Created At"];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const advBizR = bizData.map((b: any) => [b.id, b.business_name || "", b.public_business_name || "", b.city || "", b.state || "", b.business_type || "", b.billing_plan || "", $$(n(b.ad_spend_total)), b.is_active ? "Yes" : "No", String(n(b.total_receipts)), String(n(b.active_customers)), $$(n(b.avg_receipt_amount)), JSON.stringify(b.config || {}), fmt(b.created_at)]);
          // Sheet 2: Ad Campaigns
          const advCampH = ["Campaign ID", "Business ID", "Campaign Type", "Duration Days", "Base Price", "Surge Fee", "Total Price", "Surge Event ID", "Status", "Start Date", "End Date", "Created At"];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const advCampR = adCampData.map((c: any) => [c.id, c.business_id, c.campaign_type || "", c.duration_days || "", $$(n(c.base_price_cents)), $$(n(c.surge_fee_cents)), $$(n(c.total_price_cents)), c.surge_event_id || "", c.status || "", fmt(c.start_date), fmt(c.end_date), fmt(c.created_at)]);
          const advFilename = `advertising_report_${fromDate}_to_${toDate}.xlsx`;
          downloadXlsx([
            { name: "Business Ad Spend", data: buildSheet(advBizR, advBizH) },
            { name: "Ad Campaigns", data: buildSheet(advCampR, advCampH) },
          ], advFilename);
          alert(`Advertising Report generated! ${advBizR.length} businesses • ${advCampR.length} ad campaigns`);
          return;
        }
        case "staff_activity": {
          const d = await q("staff_users", "*", false);
          headers = ["User ID", "Name", "Full Name", "Email", "Role", "Created At"];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          rows = d.map((s: any) => [s.user_id, s.name || "", s.full_name || "", s.email || "", s.role, fmt(s.created_at)]);
          break;
        }
        case "audit": {
          let d = await q("audit_log", "*"); if (d.length === 0) d = await q("admin_audit_log", "*");
          headers = ["Log ID", "Action", "Actor ID", "Target Type", "Target ID", "Details (JSON)", "IP Address", "User Agent", "Created At"];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          rows = d.map((a: any) => [a.id, a.action || "", a.actor_id || "", a.target_type || "", a.target_id || "", JSON.stringify(a.details || {}), a.ip_address || "", a.user_agent || "", fmt(a.created_at)]);
          break;
        }
        case "support": {
          const d = await q("support_tickets", "*");
          headers = ["Ticket ID", "User ID", "Business ID", "Subject", "Body", "Status", "Priority", "Category", "Assigned To", "Resolved By", "Resolution Time", "Created At", "Updated At", "Resolved At"];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          rows = d.map((t: any) => { const c = t.created_at ? new Date(t.created_at) : null; const rv = t.resolved_at ? new Date(t.resolved_at) : null; const rt = c && rv ? `${Math.round((rv.getTime() - c.getTime()) / 3600000)}h` : ""; return [t.id, t.user_id || "", t.business_id || "", t.subject, t.body || "", t.status, t.priority, t.category || "", t.assigned_to || "", t.resolved_by || "", rt, fmt(t.created_at), fmt(t.updated_at), fmt(t.resolved_at)]; });
          break;
        }
        case "fraud": {
          const d = await q("fraud_alerts", "*");
          headers = ["Alert ID", "User ID", "Business ID", "Receipt ID", "Alert Type", "Severity", "Status", "Details (JSON)", "Assigned To", "Resolved By", "Resolution Notes", "Created At", "Resolved At"];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          rows = d.map((f: any) => [f.id, f.user_id || "", f.business_id || "", f.receipt_id || "", f.alert_type, f.severity, f.status, JSON.stringify(f.details || {}), f.assigned_to || "", f.resolved_by || "", f.resolution_notes || "", fmt(f.created_at), fmt(f.resolved_at)]);
          break;
        }
        case "referrals": {
          const d = await q("referrals", "*");
          headers = ["Referral ID", "Referrer User ID", "Referrer Business ID", "Referred Business ID", "Referred User ID", "Source", "Referral Code", "Status", "Reward Amount", "Reward Paid", "Converted At", "Created At"];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          rows = d.map((r: any) => [r.id, r.referrer_id || "", r.referrer_business_id || "", r.referred_business_id || "", r.referred_user_id || "", r.source, r.referral_code || "", r.status, $$(n(r.reward_cents)), r.reward_paid ? "Yes" : "No", fmt(r.converted_at), fmt(r.created_at)]);
          break;
        }
        case "influencers": {
          // Fetch influencers, their payouts, bonuses, and contracts
          const [infData, payoutsData, bonusesData] = await Promise.all([
            q("influencers", "*", false),
            q("influencer_payouts", "*", false),
            q("influencer_bonuses", "*", false),
          ]);
          // Sheet 1: Influencer Profiles
          const infHeaders = ["ID", "Name", "Code", "Email", "Phone", "City", "State", "Instagram", "TikTok", "YouTube", "Twitter", "Payment Method", "Rate / 1K", "Total Signups", "Total Clicks", "Total Paid", "Tier", "FTC Agreed", "FTC Agreed At", "Status", "Notes", "Created At"];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const infRows = infData.map((i: any) => [i.id, i.name, i.code, i.email || "", i.phone || "", i.address_city || "", i.address_state || "", i.instagram_handle || "", i.tiktok_handle || "", i.youtube_handle || "", i.twitter_handle || "", i.payment_method || "", $$(n(i.rate_per_thousand_cents)), String(i.total_signups), String(i.total_clicks || 0), $$(n(i.total_paid_cents)), i.tier || "bronze", i.ftc_agreed ? "Yes" : "No", fmt(i.ftc_agreed_at), i.status, i.notes || "", fmt(i.created_at)]);
          // Sheet 2: Payout History
          const payoutHeaders = ["Payout ID", "Influencer ID", "Signups Count", "Amount", "Rate / 1K at Time", "Period Start", "Period End", "Paid", "Paid At", "Notes", "Created At"];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const payoutRows = payoutsData.map((p: any) => [p.id, p.influencer_id, String(p.signups_count), $$(n(p.amount_cents)), $$(n(p.rate_per_thousand_cents)), fmt(p.period_start), fmt(p.period_end), p.paid ? "Yes" : "No", fmt(p.paid_at), p.notes || "", fmt(p.created_at)]);
          // Sheet 3: Bonuses
          const bonusHeaders = ["Bonus ID", "Influencer ID", "Label", "Amount", "Type", "Milestone Signups", "Paid", "Paid At", "Notes", "Created At"];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const bonusRows = bonusesData.map((b: any) => [b.id, b.influencer_id, b.label, $$(n(b.amount_cents)), b.bonus_type, String(b.milestone_signups || ""), b.paid ? "Yes" : "No", fmt(b.paid_at), b.notes || "", fmt(b.created_at)]);
          // Multi-sheet XLSX
          const filename = `influencer_report_${fromDate}_to_${toDate}.xlsx`;
          downloadXlsx([
            { name: "Influencers", data: buildSheet(infRows, infHeaders) },
            { name: "Payout History", data: buildSheet(payoutRows, payoutHeaders) },
            { name: "Bonuses", data: buildSheet(bonusRows, bonusHeaders) },
          ], filename);
          alert(`Influencer Report generated! ${infRows.length} influencers • ${payoutRows.length} payouts • ${bonusRows.length} bonuses`);
          return; // Early return — download already triggered above
        }
        case "surge_pricing": {
          const [surgeEvents, adCampaigns] = await Promise.all([
            q("surge_pricing_events", "*", false),
            q("business_ad_campaigns", "*"),
          ]);
          // Sheet 1: Surge Events
          const srgH = ["Event ID", "Name", "Description", "Multiplier", "Start Date", "End Date", "Affected Categories", "Active", "Created By", "Created At"];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const srgR = surgeEvents.map((e: any) => [e.id, e.name || "", e.description || "", e.multiplier || "", fmt(e.start_date), fmt(e.end_date), (e.affected_categories || []).join("; "), e.is_active ? "Yes" : "No", e.created_by || "", fmt(e.created_at)]);
          // Sheet 2: Ad Campaigns with Surge Fees
          const adcH = ["Campaign ID", "Business ID", "Campaign Type", "Duration Days", "Base Price", "Surge Fee", "Total Price", "Surge Event ID", "Status", "Start Date", "End Date", "Created At"];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const adcR = adCampaigns.map((c: any) => [c.id, c.business_id, c.campaign_type || "", c.duration_days || "", $$(n(c.base_price_cents)), $$(n(c.surge_fee_cents)), $$(n(c.total_price_cents)), c.surge_event_id || "", c.status || "", fmt(c.start_date), fmt(c.end_date), fmt(c.created_at)]);
          const surgeFilename = `surge_pricing_report_${fromDate}_to_${toDate}.xlsx`;
          downloadXlsx([
            { name: "Surge Events", data: buildSheet(srgR, srgH) },
            { name: "Ad Campaigns", data: buildSheet(adcR, adcH) },
          ], surgeFilename);
          alert(`Surge Pricing Report generated! ${srgR.length} surge events • ${adcR.length} ad campaigns`);
          return;
        }
        case "promotions": {
          const d = await q("promotions", "*", false);
          headers = ["Promo ID", "Code", "Description", "Discount Type", "Discount Amount", "Min Purchase", "Max Uses", "Times Used", "Usage Rate", "Status", "Applies To", "Start Date", "End Date", "Created By", "Created At"];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          rows = d.map((p: any) => [p.id, p.code, p.description || "", p.discount_type, p.discount_type === "percent" ? `${p.discount_amount}%` : $$(n(p.discount_amount)), $$(n(p.min_purchase_cents)), String(p.max_uses ?? "Unlimited"), String(n(p.uses_count)), p.max_uses ? `${((n(p.uses_count) / n(p.max_uses)) * 100).toFixed(0)}%` : "N/A", p.is_active ? "Active" : "Inactive", p.applies_to || "all", fmt(p.start_date), fmt(p.end_date), p.created_by || "", fmt(p.created_at)]);
          break;
        }
        default: {
          const d = await q("receipts", "*");
          headers = ["Receipt ID", "Business ID", "User ID", "Receipt Total", "Payout Amount", "Status", "Created At"];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          rows = d.map((r: any) => [r.id, r.business_id, r.user_id, $$(n(r.receipt_total_cents)), $$(n(r.payout_cents)), r.status, fmt(r.created_at)]);
        }
      }

      // Download as XLSX
      const filename = `${reportConfig.type}_report_${fromDate}_to_${toDate}.xlsx`;
      downloadXlsx([{ name: reportTypeLabels[reportConfig.type] || reportConfig.type, data: buildSheet(rows, headers) }], filename);
      alert(rows.length > 0 ? `Report generated! ${rows.length} rows • ${headers.length} columns.` : `Report downloaded with ${headers.length} column headers (0 data rows).`);
    } catch (err) {
      console.error("Report generation error:", err);
      alert("Error generating report: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setGenerating(false);
    }
  };

  const saveSchedule = async () => {
    if (!reportConfig.recipients) {
      alert("Please enter at least one email recipient");
      return;
    }
    if (!reportConfig.frequency) {
      alert("Please select a frequency for the scheduled report");
      return;
    }

    const newReport: ScheduledReport = {
      name: reportTypeLabels[reportConfig.type] || reportConfig.type,
      report_type: reportConfig.type,
      frequency: reportConfig.frequency,
      send_time: reportConfig.sendTime,
      format: reportConfig.format,
      recipients: reportConfig.recipients,
      include_summary: reportConfig.includeSummary,
      next_run: calculateNextRun(reportConfig.frequency),
    };

    try {
      const { data, error } = await supabaseBrowser
        .from("scheduled_reports")
        .insert(newReport)
        .select()
        .single();

      if (error) {
        console.error("Error saving scheduled report:", error);
        alert("Error saving schedule: " + error.message);
        return;
      }

      // Add to local state immediately
      setScheduledReports(prev => [data, ...prev]);
      
      // Reset schedule fields
      setReportConfig(prev => ({ ...prev, frequency: "", recipients: "", includeSummary: false }));
      alert("Report scheduled successfully!");
    } catch (err) {
      console.error("Error saving schedule:", err);
      alert("Error saving schedule. Please try again.");
    }
  };

  const deleteScheduledReport = async (report: ScheduledReport) => {
    if (!confirm(`Delete scheduled report "${report.name}"?`)) return;

    try {
      if (report.id) {
        const { error } = await supabaseBrowser
          .from("scheduled_reports")
          .delete()
          .eq("id", report.id);

        if (error) {
          console.error("Error deleting scheduled report:", error);
          alert("Error deleting report: " + error.message);
          return;
        }
      }

      // Remove from local state
      setScheduledReports(prev => prev.filter(r => r.id !== report.id));
    } catch (err) {
      console.error("Error deleting schedule:", err);
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1001 }}
      onClick={onClose}
    >
      <div
        style={{ background: COLORS.cardBg, borderRadius: 20, padding: 32, width: 700, maxWidth: "90%", maxHeight: "90vh", overflowY: "auto", border: "1px solid " + COLORS.cardBorder }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, display: "flex", alignItems: "center", gap: 12, margin: 0 }}>
            📊 Generate Custom Report
          </h2>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", fontSize: 24, color: COLORS.textSecondary, cursor: "pointer" }}
          >
            ×
          </button>
        </div>

        {/* Report Type */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase", fontWeight: 600 }}>
            Report Type
          </label>
          <select
            value={reportConfig.type}
            onChange={(e) => setReportConfig({ ...reportConfig, type: e.target.value })}
            style={{ width: "100%", padding: 14, background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, fontSize: 14 }}
          >
            <option value="master">⭐ Master Report (Everything)</option>
            <option value="receipts">Receipts Report</option>
            <option value="payouts">Payouts Report</option>
            <option value="revenue">Revenue Report</option>
            <option value="users">Users Report</option>
            <option value="businesses">Businesses Report</option>
            <option value="advertising">Advertising Report</option>
            <option value="staff_activity">Staff Activity Report</option>
            <option value="audit">Audit Log Report</option>
            <option value="support">Support Tickets Report</option>
            <option value="fraud">Fraud Alerts Report</option>
            <option value="referrals">Referrals Report</option>
            <option value="influencers">🌟 Influencer Report</option>
            <option value="promotions">Promotions Report</option>
          </select>
        </div>

        {/* Date Range */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase", fontWeight: 600 }}>
              From Date
            </label>
            <input
              type="date"
              value={reportConfig.dateFrom}
              onChange={(e) => setReportConfig({ ...reportConfig, dateFrom: e.target.value })}
              style={{ width: "100%", padding: 14, background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, fontSize: 14, colorScheme: "dark" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase", fontWeight: 600 }}>
              To Date
            </label>
            <input
              type="date"
              value={reportConfig.dateTo}
              onChange={(e) => setReportConfig({ ...reportConfig, dateTo: e.target.value })}
              style={{ width: "100%", padding: 14, background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, fontSize: 14, colorScheme: "dark" }}
            />
          </div>
        </div>

        {/* Scheduled Reports Section */}
        <div style={{ padding: 20, background: COLORS.darkBg, borderRadius: 12, marginBottom: 24, border: "1px solid " + COLORS.cardBorder }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <span style={{ fontSize: 24 }}>📅</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Schedule This Report</div>
              <div style={{ fontSize: 12, color: COLORS.textSecondary }}>Auto-generate and email reports on a recurring schedule</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase", fontWeight: 600 }}>
                Frequency
              </label>
              <select
                value={reportConfig.frequency}
                onChange={(e) => setReportConfig({ ...reportConfig, frequency: e.target.value })}
                style={{ width: "100%", padding: 12, background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, fontSize: 13 }}
              >
                <option value="">One-time (no schedule)</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly (Mondays)</option>
                <option value="biweekly">Bi-weekly</option>
                <option value="monthly">Monthly (1st of month)</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase", fontWeight: 600 }}>
                Send Time
              </label>
              <select
                value={reportConfig.sendTime}
                onChange={(e) => setReportConfig({ ...reportConfig, sendTime: e.target.value })}
                style={{ width: "100%", padding: 12, background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, fontSize: 13 }}
              >
                <option value="06:00">6:00 AM</option>
                <option value="08:00">8:00 AM</option>
                <option value="09:00">9:00 AM</option>
                <option value="12:00">12:00 PM</option>
                <option value="17:00">5:00 PM</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase", fontWeight: 600 }}>
              Email Recipients
            </label>
            <input
              type="text"
              placeholder="email@example.com, another@example.com"
              value={reportConfig.recipients}
              onChange={(e) => setReportConfig({ ...reportConfig, recipients: e.target.value })}
              style={{ width: "100%", padding: 12, background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, fontSize: 13 }}
            />
            <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 4 }}>Separate multiple emails with commas</div>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={reportConfig.includeSummary}
              onChange={(e) => setReportConfig({ ...reportConfig, includeSummary: e.target.checked })}
              style={{ width: 18, height: 18 }}
            />
            <span style={{ fontSize: 13, color: COLORS.textPrimary }}>Include summary in email body (not just attachment)</span>
          </label>
        </div>

        {/* Existing Scheduled Reports */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12, color: COLORS.textSecondary, textTransform: "uppercase" }}>
            Existing Scheduled Reports
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {loadingReports ? (
              <div style={{ padding: 16, textAlign: "center", color: COLORS.textSecondary, fontSize: 12 }}>Loading scheduled reports...</div>
            ) : scheduledReports.length === 0 ? (
              <div style={{ padding: 16, textAlign: "center", color: COLORS.textSecondary, fontSize: 12, background: COLORS.darkBg, borderRadius: 8 }}>No scheduled reports yet. Create one above!</div>
            ) : (
              scheduledReports.map((report) => (
                <div
                  key={report.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: 12,
                    background: COLORS.darkBg,
                    borderRadius: 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 18 }}>
                      📊
                    </span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{report.name}</div>
                      <div style={{ fontSize: 11, color: COLORS.textSecondary }}>
                        {frequencyLabels[report.frequency] || report.frequency} • {report.recipients}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {report.next_run && (
                      <span style={{ fontSize: 11, color: COLORS.textSecondary }}>Next: {formatDate(report.next_run)}</span>
                    )}
                    <button
                      onClick={() => {
                        // Load this report's config into the form for editing
                        setReportConfig({
                          type: report.report_type,
                          dateFrom: reportConfig.dateFrom,
                          dateTo: reportConfig.dateTo,
                          format: report.format,
                          frequency: report.frequency,
                          sendTime: report.send_time,
                          recipients: report.recipients,
                          includeSummary: report.include_summary,
                        });
                        // Delete the old one so save creates a new version
                        deleteScheduledReport(report);
                      }}
                      style={{
                        padding: "4px 8px",
                        background: "transparent",
                        border: "1px solid " + COLORS.cardBorder,
                        borderRadius: 4,
                        color: COLORS.textSecondary,
                        cursor: "pointer",
                        fontSize: 10,
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteScheduledReport(report)}
                      style={{
                        padding: "4px 8px",
                        background: "rgba(255,49,49,0.1)",
                        border: "1px solid " + COLORS.neonRed,
                        borderRadius: 4,
                        color: COLORS.neonRed,
                        cursor: "pointer",
                        fontSize: 10,
                      }}
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              padding: "12px 24px",
              background: COLORS.darkBg,
              border: "1px solid " + COLORS.cardBorder,
              borderRadius: 10,
              color: COLORS.textPrimary,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Cancel
          </button>
          <button
            onClick={generateReport}
            disabled={generating}
            style={{
              padding: "12px 24px",
              background: COLORS.gradient1,
              border: "none",
              borderRadius: 10,
              color: "#fff",
              cursor: generating ? "not-allowed" : "pointer",
              fontWeight: 700,
              opacity: generating ? 0.7 : 1,
            }}
          >
            {generating ? "Generating..." : "📥 Generate Now"}
          </button>
          <button
            onClick={saveSchedule}
            style={{
              padding: "12px 24px",
              background: COLORS.gradient2,
              border: "none",
              borderRadius: 10,
              color: "#000",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            📅 Save Schedule
          </button>
        </div>
      </div>
    </div>
  );
}