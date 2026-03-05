"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import {
  COLORS,
  Badge,
  Card,
  SectionTitle,
  StatCard,
  DataTable,
  ExportButtons,
  formatMoney,
  formatDate,
} from "@/components/admin/components";
import { logAudit, AUDIT_TABS } from "@/lib/auditLog";

// ==================== TYPES ====================
interface HealthFactors {
  receipts: number;
  engagement: number;
  payments: number;
  support: number;
}

interface BusinessHealth {
  id: string;
  name: string;
  healthScore: number;
  churnRisk: "low" | "medium" | "high";
  trend: "up" | "down" | "stable";
  receipts30d: number;
  receiptsPrev30d: number;
  receiptsTrend: number;
  avgTicketValue: number;
  supportTickets: number;
  lastReceiptDate: string | null;
  paymentStatus: "current" | "overdue" | "paused" | "unknown";
  factors: HealthFactors;
  email: string;
  phone: string;
  billingPlan: string;
  createdAt: string;
  // Context for actionable explanations
  daysSinceReceipt: number;
  latestPayoutStatus: string | null;
  // Contact tracking
  lastContactedAt: string | null;
  lastContactedBy: string | null;
}

// ==================== HELPERS ====================
function getScoreColor(score: number) {
  if (score >= 70) return COLORS.neonGreen;
  if (score >= 40) return COLORS.neonYellow;
  return COLORS.neonRed || "#ff3131";
}

function daysAgo(dateStr: string | null): number {
  if (!dateStr) return 999;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function formatDaysAgo(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const d = daysAgo(dateStr);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d} days ago`;
  if (d < 30) return `${Math.floor(d / 7)} weeks ago`;
  return formatDate(dateStr);
}

// Generate actionable explanation for each health factor
function getFactorExplanation(key: string, score: number, biz: BusinessHealth): { reason: string; action: string } {
  switch (key) {
    case "receipts":
      if (score >= 80) return { reason: `${biz.receipts30d} receipts in 30 days with positive growth`, action: "Healthy volume. Consider upselling to premium." };
      if (score >= 60) return { reason: `${biz.receipts30d} receipts — moderate activity`, action: "Encourage increased usage. Check if they have questions." };
      if (score >= 20) return { reason: `Only ${biz.receipts30d} receipts in 30 days${biz.receiptsTrend < -20 ? `, down ${Math.abs(biz.receiptsTrend)}% from prior month` : ""}`, action: "Low volume. Reach out to check if they're having issues submitting." };
      return { reason: "Zero receipts submitted in the last 30 days", action: "Critical: Business may have stopped using the platform. Call immediately." };
    case "engagement":
      if (score >= 80) return { reason: `Last receipt submitted ${formatDaysAgo(biz.lastReceiptDate)}`, action: "Actively engaged. No action needed." };
      if (score >= 50) return { reason: `Last activity was ${formatDaysAgo(biz.lastReceiptDate)}`, action: "Starting to go quiet. Schedule a check-in call." };
      if (score >= 25) return { reason: `No activity for ${biz.daysSinceReceipt} days`, action: "Going dark. Send re-engagement email and follow up with a call." };
      return { reason: biz.lastReceiptDate ? `Inactive for ${biz.daysSinceReceipt}+ days` : "Has never submitted a receipt", action: "Critical: May have churned. Immediate outreach required." };
    case "payments":
      if (score >= 80) return { reason: "Latest payout completed successfully", action: "Billing is healthy. No action needed." };
      if (score === 50) return { reason: "No payout history found yet", action: "Verify billing and bank details are set up correctly." };
      if (score === 20) return { reason: "Most recent payout failed", action: "Check payment method. Contact business to update banking info." };
      return { reason: "Account is paused or inactive", action: "Urgent: Confirm whether this is intentional or a billing issue." };
    case "support":
      if (score >= 80) return { reason: `${biz.supportTickets === 0 ? "No" : "Only " + biz.supportTickets} open support ticket${biz.supportTickets === 1 ? "" : "s"}`, action: "Support load is light. No action needed." };
      if (score >= 50) return { reason: `${biz.supportTickets} open support tickets`, action: "Review and prioritize open tickets. Ensure timely responses." };
      return { reason: `${biz.supportTickets} open tickets — high support load`, action: "Escalate tickets. Business may be frustrated — consider proactive outreach." };
    default:
      return { reason: "", action: "" };
  }
}

const PAGE_SIZE = 25;

// ==================== PAGE ====================
export default function HealthPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [businesses, setBusinesses] = useState<BusinessHealth[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"score" | "receipts" | "risk" | "name">("score");
  const [filterRisk, setFilterRisk] = useState<"all" | "low" | "medium" | "high">("all");
  const [filterPlan, setFilterPlan] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [contactingId, setContactingId] = useState<string | null>(null);
  const [undoId, setUndoId] = useState<string | null>(null);
  const [undoTimer, setUndoTimer] = useState<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // ---- Fetch businesses ----
      const { data: businessData, error } = await supabaseBrowser
        .from("business")
        .select("id, business_name, public_business_name, contact_email, contact_phone, created_at, is_active, billing_plan, status")
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!businessData || businessData.length === 0) {
        setBusinesses([]);
        setLoading(false);
        return;
      }

      const bizIds = businessData.map(b => b.id);

      // ---- Receipts: last 30 days & prev 30 days ----
      const now = new Date();
      const d30 = new Date(now.getTime() - 30 * 86400000).toISOString();
      const d60 = new Date(now.getTime() - 60 * 86400000).toISOString();

      const { data: receipts30 } = await supabaseBrowser
        .from("receipts")
        .select("business_id, amount_cents, created_at")
        .in("business_id", bizIds)
        .gte("created_at", d30);

      const { data: receiptsPrev } = await supabaseBrowser
        .from("receipts")
        .select("business_id, amount_cents")
        .in("business_id", bizIds)
        .gte("created_at", d60)
        .lt("created_at", d30);

      const r30: Record<string, { count: number; totalCents: number; lastDate: string }> = {};
      (receipts30 || []).forEach(r => {
        if (!r30[r.business_id]) r30[r.business_id] = { count: 0, totalCents: 0, lastDate: r.created_at };
        r30[r.business_id].count++;
        r30[r.business_id].totalCents += r.amount_cents || 0;
        if (r.created_at > r30[r.business_id].lastDate) r30[r.business_id].lastDate = r.created_at;
      });

      const rPrev: Record<string, number> = {};
      (receiptsPrev || []).forEach(r => {
        rPrev[r.business_id] = (rPrev[r.business_id] || 0) + 1;
      });

      // ---- Support tickets (open) ----
      const { data: tickets } = await supabaseBrowser
        .from("support_tickets")
        .select("business_id")
        .in("business_id", bizIds)
        .in("status", ["open", "in_progress", "waiting"]);

      const tixByBiz: Record<string, number> = {};
      (tickets || []).forEach(t => {
        if (t.business_id) tixByBiz[t.business_id] = (tixByBiz[t.business_id] || 0) + 1;
      });

      // ---- Payouts ----
      const { data: payouts } = await supabaseBrowser
        .from("payouts")
        .select("business_id, status")
        .in("business_id", bizIds)
        .order("created_at", { ascending: false })
        .limit(1000);

      const payoutStatus: Record<string, string> = {};
      (payouts || []).forEach(p => {
        if (!payoutStatus[p.business_id]) payoutStatus[p.business_id] = p.status;
      });

      // ---- Contact tracking (from audit_logs) ----
      const contactMap: Record<string, { at: string; by: string }> = {};
      try {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
        const { data: contacts } = await supabaseBrowser
          .from("audit_logs")
          .select("target_id, timestamp, staff_name")
          .eq("action", "health_check_contact")
          .gte("timestamp", sevenDaysAgo)
          .order("timestamp", { ascending: false });
        (contacts || []).forEach(c => {
          if (c.target_id && !contactMap[c.target_id]) {
            contactMap[c.target_id] = { at: c.timestamp, by: c.staff_name || "Staff" };
          }
        });
      } catch {
        // audit_logs table may not exist yet
      }

      // ---- Build health data ----
      const healthData: BusinessHealth[] = businessData.map(b => {
        const rc = r30[b.id] || { count: 0, totalCents: 0, lastDate: null as string | null };
        const prevCount = rPrev[b.id] || 0;
        const openTickets = tixByBiz[b.id] || 0;
        const lastPayout = payoutStatus[b.id] || null;
        const contact = contactMap[b.id] || null;

        let receiptsTrend = 0;
        if (prevCount > 0) receiptsTrend = Math.round(((rc.count - prevCount) / prevCount) * 100);
        else if (rc.count > 0) receiptsTrend = 100;

        const avgTicket = rc.count > 0 ? Math.round(rc.totalCents / rc.count) : 0;
        const daysSinceReceipt = daysAgo(rc.lastDate);

        let payStatus: "current" | "overdue" | "paused" | "unknown" = "unknown";
        if (lastPayout === "completed" || lastPayout === "processing") payStatus = "current";
        else if (lastPayout === "failed") payStatus = "overdue";
        else if (b.status === "paused" || b.is_active === false) payStatus = "paused";
        else if (rc.count > 0) payStatus = "current";

        // ---- HEALTH SCORE ----
        let receiptsScore = 0;
        if (rc.count >= 100) receiptsScore = 100;
        else if (rc.count >= 50) receiptsScore = 80;
        else if (rc.count >= 20) receiptsScore = 60;
        else if (rc.count >= 5) receiptsScore = 40;
        else if (rc.count >= 1) receiptsScore = 20;
        if (receiptsTrend > 20) receiptsScore = Math.min(100, receiptsScore + 10);
        else if (receiptsTrend < -30) receiptsScore = Math.max(0, receiptsScore - 15);

        let engagementScore = 0;
        if (daysSinceReceipt <= 1) engagementScore = 100;
        else if (daysSinceReceipt <= 3) engagementScore = 85;
        else if (daysSinceReceipt <= 7) engagementScore = 70;
        else if (daysSinceReceipt <= 14) engagementScore = 50;
        else if (daysSinceReceipt <= 30) engagementScore = 25;

        let paymentsScore = 0;
        if (payStatus === "current") paymentsScore = 100;
        else if (payStatus === "unknown") paymentsScore = 50;
        else if (payStatus === "overdue") paymentsScore = 20;
        else if (payStatus === "paused") paymentsScore = 10;

        let supportScore = 100;
        if (openTickets >= 5) supportScore = 10;
        else if (openTickets >= 3) supportScore = 30;
        else if (openTickets >= 2) supportScore = 50;
        else if (openTickets >= 1) supportScore = 70;

        const factors: HealthFactors = { receipts: receiptsScore, engagement: engagementScore, payments: paymentsScore, support: supportScore };
        const healthScore = Math.round(receiptsScore * 0.30 + engagementScore * 0.25 + paymentsScore * 0.25 + supportScore * 0.20);
        const churnRisk: "low" | "medium" | "high" = healthScore >= 70 ? "low" : healthScore >= 40 ? "medium" : "high";
        const trend: "up" | "down" | "stable" = receiptsTrend > 10 ? "up" : receiptsTrend < -10 ? "down" : "stable";

        return {
          id: b.id, name: b.public_business_name || b.business_name || "Unknown",
          healthScore, churnRisk, trend, receipts30d: rc.count, receiptsPrev30d: prevCount, receiptsTrend,
          avgTicketValue: avgTicket, supportTickets: openTickets, lastReceiptDate: rc.lastDate,
          paymentStatus: payStatus, factors, email: b.contact_email || "", phone: b.contact_phone || "",
          billingPlan: b.billing_plan || "basic", createdAt: b.created_at,
          daysSinceReceipt, latestPayoutStatus: lastPayout,
          lastContactedAt: contact?.at || null, lastContactedBy: contact?.by || null,
        };
      });

      setBusinesses(healthData);
    } catch (err) {
      console.error("Error fetching health data:", err);
      setBusinesses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ---- Mark as Contacted (with 5-second undo window) ----
  const markContacted = async (biz: BusinessHealth) => {
    // If already showing undo for this business, cancel
    if (undoId === biz.id) return;

    // Clear any existing undo timer
    if (undoTimer) { clearTimeout(undoTimer); setUndoTimer(null); }

    const now = new Date().toISOString();

    // Get staff name early
    let staffName = "Staff";
    try {
      const { data: { user } } = await supabaseBrowser.auth.getUser();
      if (user) {
        const { data: staffUser } = await supabaseBrowser.from("staff_users").select("name").eq("user_id", user.id).single();
        if (staffUser?.name) staffName = staffUser.name;
      }
    } catch { /* use default */ }

    // Optimistically update local state
    setBusinesses(prev => prev.map(b =>
      b.id === biz.id ? { ...b, lastContactedAt: now, lastContactedBy: staffName } : b
    ));
    setUndoId(biz.id);

    // Set timer — if not undone in 5 seconds, persist to DB
    const timer = setTimeout(async () => {
      setUndoId(null);
      setContactingId(biz.id);
      try {
        logAudit({
          action: "health_check_contact",
          tab: AUDIT_TABS.HEALTH,
          subTab: "Health Checks",
          targetType: "business",
          targetId: biz.id,
          entityName: biz.name,
          fieldName: "contacted",
          newValue: "true",
          details: `Marked "${biz.name}" as contacted for health check follow-up. Health score: ${biz.healthScore}, Risk: ${biz.churnRisk}`,
        });
      } catch (err) {
        console.error("Error logging contact:", err);
      } finally {
        setContactingId(null);
      }
    }, 5000);
    setUndoTimer(timer);
  };

  const undoContact = (bizId: string) => {
    if (undoTimer) { clearTimeout(undoTimer); setUndoTimer(null); }
    setUndoId(null);
    // Revert local state
    setBusinesses(prev => prev.map(b =>
      b.id === bizId ? { ...b, lastContactedAt: null, lastContactedBy: null } : b
    ));
  };

  // Stats
  const healthyCount = businesses.filter(b => b.churnRisk === "low").length;
  const attentionCount = businesses.filter(b => b.churnRisk === "medium").length;
  const atRiskCount = businesses.filter(b => b.churnRisk === "high").length;
  const avgHealthScore = businesses.length > 0 ? Math.round(businesses.reduce((a, b) => a + b.healthScore, 0) / businesses.length) : 0;

  // Unique plans for filter
  const plans = [...new Set(businesses.map(b => b.billingPlan))].sort();

  // Filter, search, sort
  const filtered = businesses.filter(b => {
    if (filterRisk !== "all" && b.churnRisk !== filterRisk) return false;
    if (filterPlan !== "all" && b.billingPlan !== filterPlan) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!b.name.toLowerCase().includes(q) && !b.email.toLowerCase().includes(q) && !b.id.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "score") return a.healthScore - b.healthScore;
    if (sortBy === "receipts") return a.receipts30d - b.receipts30d;
    if (sortBy === "name") return a.name.localeCompare(b.name);
    if (sortBy === "risk") {
      const riskOrder = { high: 0, medium: 1, low: 2 };
      return riskOrder[a.churnRisk] - riskOrder[b.churnRisk];
    }
    return 0;
  });

  // Pagination
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginated = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [filterRisk, filterPlan, searchQuery, sortBy]);

  const atRiskBusinesses = businesses.filter(b => b.churnRisk === "high").slice(0, 10);

  const navigateToBusiness = (id: string) => {
    router.push(`/admin/businesses?selected=${id}`);
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 32, background: COLORS.darkBg, minHeight: "calc(100vh - 60px)" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <h1 style={{ fontSize: 32, fontWeight: 700 }}>❤️ Business Health Dashboard</h1>
        <ExportButtons
          data={businesses.map(b => ({
            Business: b.name, Score: b.healthScore, Risk: b.churnRisk,
            "Receipts (30d)": b.receipts30d, "Trend %": b.receiptsTrend,
            "Avg Ticket": (b.avgTicketValue / 100).toFixed(2), "Open Tickets": b.supportTickets,
            "Last Activity": b.lastReceiptDate || "Never", Payment: b.paymentStatus, Plan: b.billingPlan,
            "Receipt Score": b.factors.receipts, "Engagement Score": b.factors.engagement,
            "Payment Score": b.factors.payments, "Support Score": b.factors.support,
            "Last Contacted": b.lastContactedAt || "Never", "Contacted By": b.lastContactedBy || "",
          })) as unknown as Record<string, unknown>[]}
          filename="business_health"
        />
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: COLORS.textSecondary }}>Loading health data...</div>
      ) : businesses.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: COLORS.textSecondary }}>No businesses found</div>
      ) : (
        <>
          {/* Health Summary Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 32 }}>
            <StatCard icon="💚" value={healthyCount.toString()} label="Healthy Businesses" gradient={COLORS.gradient2} />
            <StatCard icon="💛" value={attentionCount.toString()} label="Needs Attention" gradient="linear-gradient(135deg, #ffff00, #ff8800)" />
            <StatCard icon="❤️" value={atRiskCount.toString()} label="At Risk" gradient="linear-gradient(135deg, #ff3131, #990000)" />
            <StatCard icon="📊" value={avgHealthScore.toString()} label="Avg Health Score" gradient={COLORS.gradient1} />
          </div>

          {/* At Risk Alert */}
          {atRiskBusinesses.length > 0 && (
            <Card style={{ marginBottom: 24, borderColor: COLORS.neonRed || "#ff3131" }}>
              <div style={{ padding: 16, background: "rgba(255,49,49,0.1)", borderRadius: 10, marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 28 }}>🚨</span>
                  <div>
                    <div style={{ fontWeight: 700, color: COLORS.neonRed || "#ff3131", fontSize: 16 }}>At-Risk Businesses Requiring Immediate Attention</div>
                    <div style={{ fontSize: 13, color: COLORS.textSecondary }}>These businesses show signs of potential churn. Contact them to address issues and retain their business.</div>
                  </div>
                </div>
              </div>
              <div style={{ display: "grid", gap: 12 }}>
                {atRiskBusinesses.map(biz => {
                  const isContacted = !!biz.lastContactedAt;
                  return (
                    <div key={biz.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: 16, background: COLORS.darkBg, borderRadius: 12, borderLeft: "4px solid " + (isContacted ? COLORS.neonGreen : (COLORS.neonRed || "#ff3131")) }}>
                      <div style={{ width: 60, height: 60, borderRadius: 12, background: `conic-gradient(${getScoreColor(biz.healthScore)} ${biz.healthScore * 3.6}deg, ${COLORS.cardBorder} 0deg)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <div style={{ width: 48, height: 48, borderRadius: 10, background: COLORS.darkBg, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 18, color: getScoreColor(biz.healthScore) }}>{biz.healthScore}</div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <div style={{ fontWeight: 700, fontSize: 16 }}>{biz.name}</div>
                          {isContacted && (
                            <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600, background: "rgba(57,255,20,0.2)", color: COLORS.neonGreen }}>✓ Contacted {formatDaysAgo(biz.lastContactedAt)}{biz.lastContactedBy ? ` by ${biz.lastContactedBy}` : ""}</span>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 16, fontSize: 12, color: COLORS.textSecondary, flexWrap: "wrap" }}>
                          <span>📉 Receipts: <strong style={{ color: COLORS.neonRed || "#ff3131" }}>{biz.receiptsTrend >= 0 ? "+" : ""}{biz.receiptsTrend}%</strong></span>
                          <span>📅 Last Activity: <strong>{formatDaysAgo(biz.lastReceiptDate)}</strong></span>
                          <span>💳 Payment: <strong style={{ color: biz.paymentStatus === "current" ? COLORS.neonGreen : (COLORS.neonRed || "#ff3131") }}>{biz.paymentStatus}</strong></span>
                          <span>🎫 Open Tickets: <strong>{biz.supportTickets}</strong></span>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                        <button
                          onClick={() => isContacted && undoId === biz.id ? undoContact(biz.id) : markContacted(biz)}
                          disabled={contactingId === biz.id}
                          style={{ padding: "10px 14px", background: undoId === biz.id ? "rgba(255,136,0,0.2)" : isContacted ? "rgba(57,255,20,0.15)" : "rgba(255,255,0,0.15)", border: "1px solid " + (undoId === biz.id ? COLORS.neonOrange : isContacted ? COLORS.neonGreen : COLORS.neonYellow), borderRadius: 8, color: undoId === biz.id ? COLORS.neonOrange : isContacted ? COLORS.neonGreen : COLORS.neonYellow, cursor: "pointer", fontWeight: 600, fontSize: 11, opacity: contactingId === biz.id ? 0.5 : 1 }}
                        >
                          {contactingId === biz.id ? "Saving..." : undoId === biz.id ? "↩ Undo" : isContacted ? "✅ Contacted" : "📋 Mark Contacted"}
                        </button>
                        {biz.email && (
                          <button onClick={() => window.open(`mailto:${biz.email}`, "_blank")} style={{ padding: "10px 14px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, cursor: "pointer", fontSize: 11 }}>✉️ Email</button>
                        )}
                        <button onClick={() => navigateToBusiness(biz.id)} style={{ padding: "10px 14px", background: COLORS.gradient1, border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 11 }}>Business Profile</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* ===== All Business Health Scores ===== */}
          <SectionTitle icon="📋">All Business Health Scores</SectionTitle>

          {/* Search + Filters */}
          <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="Search by name, email, or ID..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ flex: 1, minWidth: 220, padding: "10px 14px", border: "1px solid " + COLORS.cardBorder, borderRadius: 8, fontSize: 13, background: COLORS.cardBg, color: COLORS.textPrimary }}
            />
            <select value={filterRisk} onChange={e => setFilterRisk(e.target.value as typeof filterRisk)} style={{ padding: "10px 14px", border: "1px solid " + COLORS.cardBorder, borderRadius: 8, fontSize: 12, background: COLORS.cardBg, color: COLORS.textPrimary }}>
              <option value="all">All Risk Levels</option>
              <option value="high">🔴 High Risk</option>
              <option value="medium">🟡 Needs Attention</option>
              <option value="low">🟢 Healthy</option>
            </select>
            {plans.length > 1 && (
              <select value={filterPlan} onChange={e => setFilterPlan(e.target.value)} style={{ padding: "10px 14px", border: "1px solid " + COLORS.cardBorder, borderRadius: 8, fontSize: 12, background: COLORS.cardBg, color: COLORS.textPrimary, textTransform: "capitalize" }}>
                <option value="all">All Plans</option>
                {plans.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            )}
            <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)} style={{ padding: "10px 14px", border: "1px solid " + COLORS.cardBorder, borderRadius: 8, fontSize: 12, background: COLORS.cardBg, color: COLORS.textPrimary }}>
              <option value="score">Sort: Worst Score First</option>
              <option value="risk">Sort: Highest Risk First</option>
              <option value="receipts">Sort: Least Active First</option>
              <option value="name">Sort: Name A-Z</option>
            </select>
          </div>

          {/* Results count */}
          <div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 12 }}>
            Showing {paginated.length} of {sorted.length} businesses{sorted.length !== businesses.length ? ` (${businesses.length} total)` : ""}
          </div>

          <Card style={{ marginBottom: 16 }}>
            {paginated.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary }}>No businesses match your filters</div>
            ) : (
              <DataTable
                columns={[
                  {
                    key: "healthScore", label: "Score",
                    render: (v: unknown, row: Record<string, unknown>) => {
                      const score = Number(v);
                      const trendIcon = row.trend === "up" ? "📈" : row.trend === "down" ? "📉" : "➡️";
                      return (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 44, height: 44, borderRadius: 10, background: `conic-gradient(${getScoreColor(score)} ${score * 3.6}deg, ${COLORS.cardBorder} 0deg)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <div style={{ width: 36, height: 36, borderRadius: 8, background: COLORS.cardBg, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, color: getScoreColor(score) }}>{score}</div>
                          </div>
                          <span style={{ fontSize: 16 }}>{trendIcon}</span>
                        </div>
                      );
                    },
                  },
                  { key: "name", label: "Business", render: (v: unknown, row: Record<string, unknown>) => (
                    <div>
                      <div style={{ fontWeight: 600 }}>{String(v)}</div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 2 }}>
                        <span style={{ fontSize: 10, color: COLORS.textSecondary, textTransform: "capitalize" }}>{String(row.billingPlan)} plan</span>
                        {!!row.lastContactedAt && <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 3, background: "rgba(57,255,20,0.15)", color: COLORS.neonGreen }}>✓ Contacted</span>}
                      </div>
                    </div>
                  )},
                  {
                    key: "churnRisk", label: "Risk",
                    render: (v: unknown) => (
                      <span style={{ padding: "6px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: v === "low" ? "rgba(57,255,20,0.2)" : v === "medium" ? "rgba(255,255,0,0.2)" : "rgba(255,49,49,0.2)", color: v === "low" ? COLORS.neonGreen : v === "medium" ? COLORS.neonYellow : (COLORS.neonRed || "#ff3131") }}>{String(v).toUpperCase()}</span>
                    ),
                  },
                  {
                    key: "receipts30d", label: "Receipts (30d)", align: "center" as const,
                    render: (v: unknown, row: Record<string, unknown>) => (
                      <div>
                        <div style={{ fontWeight: 600 }}>{String(v)}</div>
                        <div style={{ fontSize: 10, color: Number(row.receiptsTrend) >= 0 ? COLORS.neonGreen : (COLORS.neonRed || "#ff3131") }}>{Number(row.receiptsTrend) >= 0 ? "+" : ""}{String(row.receiptsTrend)}% vs prev</div>
                      </div>
                    ),
                  },
                  {
                    key: "avgTicketValue", label: "Avg Ticket", align: "right" as const,
                    render: (v: unknown) => Number(v) > 0 ? formatMoney(Number(v)) : "—",
                  },
                  {
                    key: "supportTickets", label: "Tickets", align: "center" as const,
                    render: (v: unknown) => <span style={{ color: Number(v) > 0 ? COLORS.neonOrange : COLORS.neonGreen, fontWeight: 600 }}>{String(v)}</span>,
                  },
                  {
                    key: "lastReceiptDate", label: "Last Activity",
                    render: (v: unknown) => {
                      const d = daysAgo(v as string | null);
                      return <span style={{ color: d > 14 ? (COLORS.neonRed || "#ff3131") : d > 7 ? COLORS.neonYellow : COLORS.textSecondary, fontSize: 12 }}>{formatDaysAgo(v as string | null)}</span>;
                    },
                  },
                  {
                    key: "paymentStatus", label: "Payment",
                    render: (v: unknown) => <Badge status={v === "current" ? "active" : v === "paused" ? "paused" : v === "overdue" ? "suspended" : "inactive"} />,
                  },
                  {
                    key: "factors", label: "Health Factors",
                    render: (v: unknown, row: Record<string, unknown>) => {
                      const f = v as HealthFactors;
                      const isExpanded = expandedId === row.id;
                      const biz = businesses.find(b => b.id === row.id);
                      return (
                        <div>
                          <div style={{ display: "flex", gap: 4, cursor: "pointer" }} onClick={() => setExpandedId(isExpanded ? null : String(row.id))}>
                            {([
                              { key: "receipts" as const, icon: "🧾" },
                              { key: "engagement" as const, icon: "📱" },
                              { key: "payments" as const, icon: "💳" },
                              { key: "support" as const, icon: "🎫" },
                            ]).map(fk => (
                              <div key={fk.key} title={`Click to expand details`} style={{ width: 24, height: 24, borderRadius: 4, background: f[fk.key] >= 70 ? "rgba(57,255,20,0.3)" : f[fk.key] >= 40 ? "rgba(255,255,0,0.3)" : "rgba(255,49,49,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>{fk.icon}</div>
                            ))}
                            <span style={{ fontSize: 10, color: COLORS.neonBlue, marginLeft: 4, alignSelf: "center" }}>{isExpanded ? "▲" : "▼"}</span>
                          </div>
                          {isExpanded && biz && (
                            <div style={{ marginTop: 8, padding: 12, background: COLORS.darkBg, borderRadius: 8, fontSize: 11, minWidth: 280 }}>
                              {([
                                { key: "receipts" as const, icon: "🧾", label: "Receipt Activity", weight: "30%" },
                                { key: "engagement" as const, icon: "📱", label: "Engagement", weight: "25%" },
                                { key: "payments" as const, icon: "💳", label: "Payment Status", weight: "25%" },
                                { key: "support" as const, icon: "🎫", label: "Support Health", weight: "20%" },
                              ]).map(fk => {
                                const explanation = getFactorExplanation(fk.key, f[fk.key], biz);
                                const clr = f[fk.key] >= 70 ? COLORS.neonGreen : f[fk.key] >= 40 ? COLORS.neonYellow : (COLORS.neonRed || "#ff3131");
                                return (
                                  <div key={fk.key} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid " + COLORS.cardBorder }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                                      <span>{fk.icon}</span>
                                      <span style={{ fontWeight: 600, color: COLORS.textPrimary }}>{fk.label}</span>
                                      <span style={{ marginLeft: "auto", fontWeight: 700, color: clr }}>{f[fk.key]}%</span>
                                      <span style={{ color: COLORS.textSecondary, fontSize: 10 }}>({fk.weight})</span>
                                    </div>
                                    <div style={{ height: 4, background: COLORS.cardBorder, borderRadius: 2, overflow: "hidden", marginBottom: 6 }}>
                                      <div style={{ width: `${f[fk.key]}%`, height: "100%", background: clr, borderRadius: 2 }} />
                                    </div>
                                    <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 2 }}>📌 {explanation.reason}</div>
                                    <div style={{ fontSize: 11, color: clr }}>→ {explanation.action}</div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    },
                  },
                  {
                    key: "id", label: "", align: "right" as const,
                    render: (_v: unknown, row: Record<string, unknown>) => {
                      const biz = businesses.find(b => b.id === row.id);
                      return (
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          {biz && (
                            <button
                              onClick={() => biz.lastContactedAt && undoId === biz.id ? undoContact(biz.id) : markContacted(biz)}
                              disabled={contactingId === biz.id}
                              title={undoId === biz.id ? "Click to undo" : biz.lastContactedAt ? `Last contacted ${formatDaysAgo(biz.lastContactedAt)}${biz.lastContactedBy ? ` by ${biz.lastContactedBy}` : ""}` : "Mark this business as contacted"}
                              style={{ padding: "8px 10px", background: undoId === biz.id ? "rgba(255,136,0,0.2)" : biz.lastContactedAt ? "rgba(57,255,20,0.15)" : COLORS.cardBg, border: "1px solid " + (undoId === biz.id ? COLORS.neonOrange : biz.lastContactedAt ? COLORS.neonGreen : COLORS.cardBorder), borderRadius: 8, color: undoId === biz.id ? COLORS.neonOrange : biz.lastContactedAt ? COLORS.neonGreen : COLORS.textSecondary, cursor: "pointer", fontSize: 11, fontWeight: 600, opacity: contactingId === biz.id ? 0.5 : 1 }}
                            >
                              {contactingId === biz.id ? "..." : undoId === biz.id ? "↩" : biz.lastContactedAt ? "✅" : "📋"}
                            </button>
                          )}
                          <button onClick={() => navigateToBusiness(String(row.id))} style={{ padding: "8px 14px", background: COLORS.gradient1, border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>Business Profile</button>
                        </div>
                      );
                    },
                  },
                ]}
                data={paginated as unknown as Record<string, unknown>[]}
              />
            )}
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginBottom: 24 }}>
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: currentPage === 1 ? COLORS.cardBorder : COLORS.cardBg, color: currentPage === 1 ? COLORS.textSecondary : COLORS.textPrimary, cursor: currentPage === 1 ? "default" : "pointer", fontSize: 12, fontWeight: 600 }}>← Prev</button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let page: number;
                if (totalPages <= 7) { page = i + 1; }
                else if (currentPage <= 4) { page = i + 1; }
                else if (currentPage >= totalPages - 3) { page = totalPages - 6 + i; }
                else { page = currentPage - 3 + i; }
                return (
                  <button key={page} onClick={() => setCurrentPage(page)} style={{ padding: "8px 12px", borderRadius: 8, border: "none", background: currentPage === page ? COLORS.gradient1 : COLORS.cardBg, color: currentPage === page ? "#fff" : COLORS.textSecondary, cursor: "pointer", fontSize: 12, fontWeight: 600, minWidth: 36 }}>{page}</button>
                );
              })}
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: currentPage === totalPages ? COLORS.cardBorder : COLORS.cardBg, color: currentPage === totalPages ? COLORS.textSecondary : COLORS.textPrimary, cursor: currentPage === totalPages ? "default" : "pointer", fontSize: 12, fontWeight: 600 }}>Next →</button>
              <span style={{ fontSize: 11, color: COLORS.textSecondary, marginLeft: 8 }}>Page {currentPage} of {totalPages}</span>
            </div>
          )}

          {/* Health Score Breakdown */}
          <SectionTitle icon="📊">Health Score Calculation</SectionTitle>
          <Card>
            <div style={{ padding: 16, background: COLORS.darkBg, borderRadius: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>How Health Scores Are Calculated</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
                {([
                  { icon: "🧾", factor: "Receipt Activity", weight: "30%", desc: "Volume and trend of receipts in last 30 days vs prior 30 days. More receipts + positive growth = higher score." },
                  { icon: "📱", factor: "Engagement", weight: "25%", desc: "Recency of last receipt submission. Active today = 100%, no activity in 30+ days = 0%." },
                  { icon: "💳", factor: "Payment Status", weight: "25%", desc: "Based on latest payout status. Completed = 100%, failed = 20%, paused = 10%." },
                  { icon: "🎫", factor: "Support Health", weight: "20%", desc: "Open support tickets count. 0 tickets = 100%, 5+ tickets = 10%." },
                ]).map((f, i) => (
                  <div key={i} style={{ padding: 16, background: COLORS.cardBg, borderRadius: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 20 }}>{f.icon}</span>
                      <span style={{ fontWeight: 600 }}>{f.factor}</span>
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: COLORS.neonPink, marginBottom: 8 }}>{f.weight}</div>
                    <div style={{ fontSize: 11, color: COLORS.textSecondary, lineHeight: 1.5 }}>{f.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 20, padding: 16, background: COLORS.darkBg, borderRadius: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Score Ranges & Actions</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                <div style={{ padding: 16, background: "rgba(57,255,20,0.1)", borderRadius: 10, borderLeft: "4px solid " + COLORS.neonGreen }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 20 }}>💚</span>
                    <span style={{ fontWeight: 600, color: COLORS.neonGreen }}>Healthy (70-100)</span>
                  </div>
                  <div style={{ fontSize: 12, color: COLORS.textSecondary }}>Business is thriving. Continue regular engagement and look for upsell opportunities.</div>
                </div>
                <div style={{ padding: 16, background: "rgba(255,255,0,0.1)", borderRadius: 10, borderLeft: "4px solid " + COLORS.neonYellow }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 20 }}>💛</span>
                    <span style={{ fontWeight: 600, color: COLORS.neonYellow }}>Needs Attention (40-69)</span>
                  </div>
                  <div style={{ fontSize: 12, color: COLORS.textSecondary }}>Early warning signs. Schedule check-in call and review open support tickets.</div>
                </div>
                <div style={{ padding: 16, background: "rgba(255,49,49,0.1)", borderRadius: 10, borderLeft: "4px solid " + (COLORS.neonRed || "#ff3131") }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 20 }}>❤️</span>
                    <span style={{ fontWeight: 600, color: COLORS.neonRed || "#ff3131" }}>At Risk (0-39)</span>
                  </div>
                  <div style={{ fontSize: 12, color: COLORS.textSecondary }}>High churn risk. Immediate outreach required. Consider retention offers or account review.</div>
                </div>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}