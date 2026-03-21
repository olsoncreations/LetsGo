"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import {
  COLORS,
  Card,
  SectionTitle,
  StatCard,
  DataTable,
  ExportButtons,
  formatMoney,
} from "@/components/admin/components";

// ==================== LOCAL COMPONENTS ====================
interface TooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 12, padding: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
        <div style={{ fontWeight: 600, marginBottom: 8, color: COLORS.textPrimary }}>{label}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: p.color }} />
            <span style={{ color: COLORS.textSecondary, fontSize: 12 }}>{p.name}:</span>
            <span style={{ fontWeight: 600, fontSize: 12, color: COLORS.textPrimary }}>{typeof p.value === "number" ? p.value.toLocaleString() : p.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

function EmptyState({ message }: { message: string }) {
  return <div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary, fontSize: 13 }}>{message}</div>;
}

// ==================== TYPES ====================
interface StaffMember {
  name: string;
  role: string;
  status: "active" | "away" | "offline";
  currentTask: string;
  tasksToday: number;
  avatar: string;
  userId: string;
}

interface WorkloadData {
  name: string;
  receipts: number;
  tickets: number;
  payouts: number;
  total: number;
}

interface SLAMetric {
  metric: string;
  current: number;
  target: number;
  unit: string;
  status: "good" | "warning" | "danger";
}

interface CheckedOutTicket {
  id: string;
  subject: string;
  assignee: string;
  checkedOut: string;
  priority: "urgent" | "high" | "medium" | "low";
}

interface SalesRep {
  rank: number;
  name: string;
  businesses_added: number;
  revenue_generated: number;
}

// Helper: time ago
function timeAgo(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ==================== ANALYTICS PAGE ====================
export default function AnalyticsPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      if (!session?.user) { router.replace("/admin/login"); return; }
      const { data: staff } = await supabaseBrowser.from("staff_users").select("user_id").eq("user_id", session.user.id).maybeSingle();
      if (!staff) { router.replace("/admin/login"); return; }
      setAuthChecked(true);
    })();
  }, [router]);

  const [salesReps, setSalesReps] = useState<SalesRep[]>([]);
  const [staffOnline, setStaffOnline] = useState<StaffMember[]>([]);
  const [workloadData, setWorkloadData] = useState<WorkloadData[]>([]);
  const [checkedOutTickets, setCheckedOutTickets] = useState<CheckedOutTicket[]>([]);
  const [slaMetrics, setSlaMetrics] = useState<SLAMetric[]>([]);
  const [loading, setLoading] = useState(true);

  // Stats
  const [ticketsResolved, setTicketsResolved] = useState(0);
  const [avgWaitingHours, setAvgWaitingHours] = useState(0);
  const [totalPendingReceipts, setTotalPendingReceipts] = useState(0);
  const [totalOpenTickets, setTotalOpenTickets] = useState(0);

  // Chart data
  const [receiptWaitData, setReceiptWaitData] = useState<{ label: string; hours: number }[]>([]);
  const [ticketsResolvedData, setTicketsResolvedData] = useState<{ label: string; count: number }[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // ====== STAFF USERS ======
      const { data: staffUsers } = await supabaseBrowser
        .from("staff_users")
        .select("user_id, name, role");

      const staffMap: Record<string, { name: string; role: string }> = {};
      const staffList: StaffMember[] = [];
      if (staffUsers && staffUsers.length > 0) {
        staffUsers.forEach(su => {
          const nm = su.name || su.role || "Staff";
          staffMap[su.user_id] = { name: nm, role: su.role || "Admin" };
          staffList.push({
            userId: su.user_id,
            name: nm,
            role: su.role || "Admin",
            status: "active",
            currentTask: "",
            tasksToday: 0,
            avatar: nm.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase(),
          });
        });
      }

      // ====== SUPPORT TICKETS (last 7 days) ======
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: tickets } = await supabaseBrowser
        .from("support_tickets")
        .select("id, subject, status, priority, created_at, resolved_at, assigned_to")
        .gte("created_at", weekAgo);

      let resolvedCount = 0;
      let avgTicketResolutionHrs = 0;
      let avgFirstResponseHrs = 0;

      if (tickets && tickets.length > 0) {
        const resolved = tickets.filter(t => t.status === "resolved" || t.status === "closed");
        resolvedCount = resolved.length;

        // Tickets resolved by day of week
        const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        const byDay: Record<string, number> = {};
        resolved.forEach(t => {
          const dayIndex = new Date(t.resolved_at || t.created_at).getDay();
          const day = days[dayIndex === 0 ? 6 : dayIndex - 1];
          byDay[day] = (byDay[day] || 0) + 1;
        });
        setTicketsResolvedData(days.map(label => ({ label, count: byDay[label] || 0 })));

        // Avg ticket resolution time
        const withResolution = resolved.filter(t => t.resolved_at);
        if (withResolution.length > 0) {
          const totalHrs = withResolution.reduce((sum, t) => sum + (new Date(t.resolved_at!).getTime() - new Date(t.created_at).getTime()) / 3600000, 0);
          avgTicketResolutionHrs = Math.round((totalHrs / withResolution.length) * 10) / 10;
        }

        // Open tickets count
        setTotalOpenTickets(tickets.filter(t => t.status === "open" || t.status === "in_progress" || t.status === "waiting").length);

        // Checked out tickets
        const checkedOut = tickets
          .filter(t => t.status === "in_progress" && t.assigned_to)
          .slice(0, 10)
          .map(t => ({
            id: t.id.slice(0, 8),
            subject: t.subject || "Support ticket",
            assignee: staffMap[t.assigned_to]?.name || t.assigned_to?.slice(0, 8) || "Unknown",
            checkedOut: timeAgo(new Date(t.created_at)),
            priority: (t.priority || "medium") as "urgent" | "high" | "medium" | "low",
          }));
        setCheckedOutTickets(checkedOut);

        // Per-staff ticket counts
        tickets.filter(t => t.assigned_to).forEach(t => {
          const staff = staffList.find(s => s.userId === t.assigned_to);
          if (staff) staff.tasksToday++;
        });
      }
      setTicketsResolved(resolvedCount);

      // ====== RECEIPTS ======
      const { data: pendingReceipts } = await supabaseBrowser
        .from("receipts")
        .select("id, status, created_at")
        .eq("status", "pending");

      const { data: recentReceipts } = await supabaseBrowser
        .from("receipts")
        .select("id, status, created_at, approved_at, approved_by")
        .gte("created_at", weekAgo);

      let avgReceiptWaitHrs = 0;

      if (pendingReceipts && pendingReceipts.length > 0) {
        setTotalPendingReceipts(pendingReceipts.length);
        const now = Date.now();
        const totalWait = pendingReceipts.reduce((sum, r) => sum + (now - new Date(r.created_at).getTime()) / 3600000, 0);
        avgReceiptWaitHrs = Math.round((totalWait / pendingReceipts.length) * 10) / 10;

        // Group pending receipts by day created for trend chart
        const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        const waitByDay: Record<string, { totalHrs: number; count: number }> = {};
        pendingReceipts.forEach(r => {
          const dayIndex = new Date(r.created_at).getDay();
          const day = days[dayIndex === 0 ? 6 : dayIndex - 1];
          if (!waitByDay[day]) waitByDay[day] = { totalHrs: 0, count: 0 };
          waitByDay[day].totalHrs += (now - new Date(r.created_at).getTime()) / 3600000;
          waitByDay[day].count++;
        });
        setReceiptWaitData(days.map(label => ({
          label,
          hours: waitByDay[label]?.count ? Math.round((waitByDay[label].totalHrs / waitByDay[label].count) * 10) / 10 : 0,
        })));
      } else {
        setTotalPendingReceipts(0);
        setReceiptWaitData([]);
      }
      setAvgWaitingHours(avgReceiptWaitHrs);

      // Per-staff receipt counts (approved in last 7 days)
      if (recentReceipts) {
        recentReceipts.filter(r => r.status === "approved" && r.approved_by).forEach(r => {
          const staff = staffList.find(s => s.userId === r.approved_by);
          if (staff) staff.tasksToday++;
        });
      }

      // ====== PAYOUTS ======
      const { data: recentPayouts } = await supabaseBrowser
        .from("payouts")
        .select("id, status, created_at, processed_at, processed_by")
        .gte("created_at", weekAgo);

      let avgPayoutDays = 0;
      if (recentPayouts && recentPayouts.length > 0) {
        const completedPayouts = recentPayouts.filter(p => p.processed_at && (p.status === "completed" || p.status === "processing"));
        if (completedPayouts.length > 0) {
          const totalDays = completedPayouts.reduce((sum, p) => sum + (new Date(p.processed_at!).getTime() - new Date(p.created_at).getTime()) / 86400000, 0);
          avgPayoutDays = Math.round((totalDays / completedPayouts.length) * 10) / 10;
        }
        recentPayouts.filter(p => p.processed_by).forEach(p => {
          const staff = staffList.find(s => s.userId === p.processed_by);
          if (staff) staff.tasksToday++;
        });
      }

      // ====== TICKET FIRST RESPONSE (from support_messages) ======
      try {
        const { data: messages } = await supabaseBrowser
          .from("support_messages")
          .select("ticket_id, created_at, is_internal")
          .eq("is_internal", false)
          .order("created_at", { ascending: true })
          .limit(500);

        if (messages && messages.length > 0 && tickets && tickets.length > 0) {
          const firstResponse: Record<string, string> = {};
          messages.forEach(m => {
            if (!firstResponse[m.ticket_id]) firstResponse[m.ticket_id] = m.created_at;
          });
          const ticketsWithResponse = tickets.filter(t => firstResponse[t.id]);
          if (ticketsWithResponse.length > 0) {
            const totalHrs = ticketsWithResponse.reduce((sum, t) => sum + (new Date(firstResponse[t.id]).getTime() - new Date(t.created_at).getTime()) / 3600000, 0);
            avgFirstResponseHrs = Math.round((totalHrs / ticketsWithResponse.length) * 10) / 10;
          }
        }
      } catch {
        // support_messages may not have data yet
      }

      // ====== BUILD SLA METRICS ======
      setSlaMetrics([
        {
          metric: "Receipt Approval Time",
          current: avgReceiptWaitHrs,
          target: 4,
          unit: "hrs",
          status: avgReceiptWaitHrs <= 4 ? "good" : avgReceiptWaitHrs <= 6 ? "warning" : "danger",
        },
        {
          metric: "Ticket First Response",
          current: avgFirstResponseHrs,
          target: 2,
          unit: "hrs",
          status: avgFirstResponseHrs <= 2 ? "good" : avgFirstResponseHrs <= 4 ? "warning" : "danger",
        },
        {
          metric: "Ticket Resolution",
          current: avgTicketResolutionHrs,
          target: 24,
          unit: "hrs",
          status: avgTicketResolutionHrs <= 24 ? "good" : avgTicketResolutionHrs <= 36 ? "warning" : "danger",
        },
        {
          metric: "Payout Processing",
          current: avgPayoutDays,
          target: 3,
          unit: "days",
          status: avgPayoutDays <= 3 ? "good" : avgPayoutDays <= 5 ? "warning" : "danger",
        },
      ]);

      // ====== FINALIZE STAFF LIST ======
      staffList.forEach(staff => {
        if (staff.tasksToday === 0) {
          staff.status = "offline";
          staff.currentTask = "No recent activity";
        } else {
          staff.currentTask = "Processing tasks";
        }
      });
      setStaffOnline(staffList);

      // Build workload per staff
      const wl: WorkloadData[] = staffList.map(s => {
        let rCnt = 0, tCnt = 0, pCnt = 0;
        if (recentReceipts) rCnt = recentReceipts.filter(r => r.approved_by === s.userId && r.status === "approved").length;
        if (tickets) tCnt = tickets.filter(t => t.assigned_to === s.userId).length;
        if (recentPayouts) pCnt = recentPayouts.filter(p => p.processed_by === s.userId).length;
        return { name: s.name, receipts: rCnt, tickets: tCnt, payouts: pCnt, total: rCnt + tCnt + pCnt };
      }).filter(w => w.total > 0).sort((a, b) => b.total - a.total);
      setWorkloadData(wl);

      // ====== SALES REPS ======
      try {
        const { data: reps } = await supabaseBrowser.from("sales_reps").select("*").eq("is_active", true).order("name");
        const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data: signups } = await supabaseBrowser.from("sales_signups").select("rep_id, commission_cents").gte("created_at", monthAgo);

        if (reps && reps.length > 0) {
          const salesData: SalesRep[] = reps.map(rep => {
            const repSignups = signups?.filter(s => s.rep_id === rep.id) || [];
            const revenue = repSignups.reduce((sum, s) => sum + (s.commission_cents || 0), 0);
            return { rank: 0, name: rep.name, businesses_added: repSignups.length, revenue_generated: revenue };
          }).sort((a, b) => b.businesses_added - a.businesses_added).slice(0, 10);
          salesData.forEach((rep, i) => rep.rank = i + 1);
          setSalesReps(salesData);
        }
      } catch {
        // sales tables may not exist yet
      }

    } catch (err) {
      console.error("Error fetching analytics:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.textSecondary }}>Loading analytics...</div>;
  }

  if (!authChecked) return null;

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 32 }}>
      <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 32 }}>📈 Staff Analytics</h1>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 32 }}>
        <StatCard icon="🎯" value={ticketsResolved.toString()} label="Tickets Resolved (Week)" gradient={COLORS.gradient1} />
        <StatCard icon="⏱️" value={avgWaitingHours > 0 ? `${avgWaitingHours} hrs` : "0 hrs"} label="Avg Receipt Wait Time" gradient={COLORS.gradient2} />
        <StatCard icon="📋" value={totalPendingReceipts.toString()} label="Pending Receipts" gradient={COLORS.gradient3} />
        <StatCard icon="🎫" value={totalOpenTickets.toString()} label="Open Tickets" gradient={COLORS.gradient4} />
      </div>

      {/* Performance Charts */}
      <SectionTitle icon="📊">Performance Metrics</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
        <Card title="Avg Time Receipts Waiting on Approval" actions={<ExportButtons data={receiptWaitData as unknown as Record<string, unknown>[]} filename="receipts_waiting_time" />}>
          <div style={{ height: 220 }}>
            {receiptWaitData.length === 0 || receiptWaitData.every(d => d.hours === 0) ? (
              <EmptyState message="No pending receipts" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={receiptWaitData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.cardBorder} />
                  <XAxis dataKey="label" tick={{ fill: COLORS.textSecondary, fontSize: 11 }} />
                  <YAxis tick={{ fill: COLORS.textSecondary, fontSize: 11 }} unit=" hrs" />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="hours" stroke={COLORS.neonOrange} strokeWidth={3} dot={{ r: 5, fill: COLORS.neonOrange }} name="Hours Waiting" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
        <Card title="Tickets Resolved by Day" actions={<ExportButtons data={ticketsResolvedData as unknown as Record<string, unknown>[]} filename="tickets_resolved" />}>
          <div style={{ height: 220 }}>
            {ticketsResolvedData.length === 0 || ticketsResolvedData.every(d => d.count === 0) ? (
              <EmptyState message="No resolved tickets this week" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ticketsResolvedData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.cardBorder} />
                  <XAxis dataKey="label" tick={{ fill: COLORS.textSecondary, fontSize: 11 }} />
                  <YAxis tick={{ fill: COLORS.textSecondary, fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" fill={COLORS.neonBlue} radius={[4, 4, 0, 0]} name="Tickets" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* SLA Monitoring Dashboard */}
      <SectionTitle icon="⏱️">SLA Monitoring Dashboard</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {slaMetrics.map((sla, i) => {
          const percentage = sla.target > 0 ? Math.min((sla.current / sla.target) * 100, 100) : 0;
          const hasData = sla.current > 0;
          return (
            <Card key={i}>
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 8 }}>{sla.metric}</div>
                <div style={{ position: "relative", width: 100, height: 100, margin: "0 auto" }}>
                  <svg viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)" }}>
                    <circle cx="50" cy="50" r="42" fill="none" stroke={COLORS.cardBorder} strokeWidth="8" />
                    {hasData && <circle cx="50" cy="50" r="42" fill="none" stroke={sla.status === "good" ? COLORS.neonGreen : sla.status === "warning" ? COLORS.neonYellow : (COLORS.neonRed || "#ff3131")} strokeWidth="8" strokeDasharray={`${percentage * 2.64} 264`} strokeLinecap="round" />}
                  </svg>
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: !hasData ? COLORS.textSecondary : sla.status === "good" ? COLORS.neonGreen : sla.status === "warning" ? COLORS.neonYellow : (COLORS.neonRed || "#ff3131") }}>{hasData ? sla.current : "—"}</div>
                    <div style={{ fontSize: 10, color: COLORS.textSecondary }}>{sla.unit}</div>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: COLORS.darkBg, borderRadius: 8 }}>
                <span style={{ fontSize: 11, color: COLORS.textSecondary }}>Target: {sla.target} {sla.unit}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: !hasData ? COLORS.textSecondary : sla.status === "good" ? COLORS.neonGreen : sla.status === "warning" ? COLORS.neonYellow : (COLORS.neonRed || "#ff3131") }}>
                  {!hasData ? "No data" : sla.status === "good" ? "✓ On Track" : sla.status === "warning" ? "⚠️ Close" : "❌ Behind"}
                </span>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Staff Activity Dashboard */}
      <SectionTitle icon="👥">Staff Activity Dashboard</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
        <Card title="🟢 Currently Online">
          {staffOnline.length === 0 ? (
            <EmptyState message="No staff users found" />
          ) : (
            <>
              <div style={{ display: "grid", gap: 12 }}>
                {staffOnline.map((staff, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, background: COLORS.darkBg, borderRadius: 10 }}>
                    <div style={{ position: "relative" }}>
                      <div style={{ width: 44, height: 44, borderRadius: "50%", background: COLORS.gradient1, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13 }}>{staff.avatar}</div>
                      <div style={{ position: "absolute", bottom: 0, right: 0, width: 14, height: 14, borderRadius: "50%", background: staff.status === "active" ? COLORS.neonGreen : staff.status === "away" ? COLORS.neonYellow : COLORS.textSecondary, border: "2px solid " + COLORS.darkBg }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontWeight: 600 }}>{staff.name}</div>
                        <span style={{ fontSize: 10, color: COLORS.textSecondary, padding: "2px 8px", background: COLORS.cardBg, borderRadius: 4 }}>{staff.role}</span>
                      </div>
                      <div style={{ fontSize: 12, color: staff.status === "active" ? COLORS.neonBlue : COLORS.textSecondary, marginTop: 2 }}>{staff.currentTask}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: staff.tasksToday > 0 ? COLORS.neonGreen : COLORS.textSecondary }}>{staff.tasksToday}</div>
                      <div style={{ fontSize: 10, color: COLORS.textSecondary }}>this week</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12, padding: 12, background: "rgba(57,255,20,0.1)", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: COLORS.textSecondary }}>Staff: <strong style={{ color: COLORS.neonGreen }}>{staffOnline.length}</strong></span>
                <span style={{ fontSize: 12, color: COLORS.textSecondary }}>Total Tasks (Week): <strong style={{ color: COLORS.neonBlue }}>{staffOnline.reduce((s, st) => s + st.tasksToday, 0)}</strong></span>
              </div>
            </>
          )}
        </Card>

        <Card title="📊 Workload Distribution">
          {workloadData.length === 0 ? (
            <EmptyState message="No workload data this week" />
          ) : (
            <>
              <div style={{ display: "grid", gap: 10, marginBottom: 16 }}>
                {workloadData.map((staff, i) => {
                  const maxTotal = Math.max(...workloadData.map(w => w.total), 1);
                  return (
                    <div key={i}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{staff.name}</span>
                        <span style={{ fontSize: 12, color: COLORS.textSecondary }}>{staff.total} tasks</span>
                      </div>
                      <div style={{ display: "flex", height: 20, borderRadius: 4, overflow: "hidden", background: COLORS.darkBg }}>
                        {staff.receipts > 0 && <div style={{ width: `${(staff.receipts / maxTotal) * 100}%`, background: COLORS.neonGreen, display: "flex", alignItems: "center", justifyContent: "center" }}>{staff.receipts > 3 && <span style={{ fontSize: 9, color: "#000", fontWeight: 600 }}>{staff.receipts}</span>}</div>}
                        {staff.tickets > 0 && <div style={{ width: `${(staff.tickets / maxTotal) * 100}%`, background: COLORS.neonBlue, display: "flex", alignItems: "center", justifyContent: "center" }}>{staff.tickets > 3 && <span style={{ fontSize: 9, color: "#000", fontWeight: 600 }}>{staff.tickets}</span>}</div>}
                        {staff.payouts > 0 && <div style={{ width: `${(staff.payouts / maxTotal) * 100}%`, background: COLORS.neonPurple, display: "flex", alignItems: "center", justifyContent: "center" }}>{staff.payouts > 3 && <span style={{ fontSize: 9, color: "#fff", fontWeight: 600 }}>{staff.payouts}</span>}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
                {[{ label: "Receipts", color: COLORS.neonGreen }, { label: "Tickets", color: COLORS.neonBlue }, { label: "Payouts", color: COLORS.neonPurple }].map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 2, background: item.color }} />
                    <span style={{ color: COLORS.textSecondary }}>{item.label}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Checked Out Tickets */}
      <Card title="🎫 Currently Checked Out Tickets" style={{ marginBottom: 24 }}>
        <div style={{ display: "grid", gap: 8 }}>
          {checkedOutTickets.length === 0 ? (
            <EmptyState message="No tickets currently checked out" />
          ) : checkedOutTickets.map((ticket, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, padding: 14, background: COLORS.darkBg, borderRadius: 10, borderLeft: "4px solid " + (ticket.priority === "urgent" ? (COLORS.neonRed || "#ff3131") : ticket.priority === "high" ? COLORS.neonOrange : COLORS.neonYellow) }}>
              <div style={{ fontFamily: "monospace", fontSize: 12, color: COLORS.neonBlue }}>{ticket.id}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{ticket.subject}</div>
                <div style={{ fontSize: 11, color: COLORS.textSecondary }}>Assigned to <strong style={{ color: COLORS.neonPink }}>{ticket.assignee}</strong></div>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 600, background: ticket.priority === "urgent" ? (COLORS.neonRed || "#ff3131") : ticket.priority === "high" ? COLORS.neonOrange : COLORS.neonYellow, color: ticket.priority === "urgent" || ticket.priority === "high" ? "#fff" : "#000" }}>{ticket.priority}</span>
                <div style={{ fontSize: 10, color: COLORS.textSecondary, marginTop: 4 }}>{ticket.checkedOut}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Sales Rep Leaderboard */}
      <SectionTitle icon="🏆">Sales Rep Leaderboard (Top 10)</SectionTitle>
      <Card actions={<ExportButtons data={salesReps as unknown as Record<string, unknown>[]} filename="sales_leaderboard" />}>
        {salesReps.length === 0 ? (
          <EmptyState message="No sales rep data available" />
        ) : (
          <DataTable
            columns={[
              { key: "rank", label: "#", render: (v: unknown) => (
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: Number(v) === 1 ? COLORS.neonYellow : Number(v) === 2 ? "#c0c0c0" : Number(v) === 3 ? COLORS.neonOrange : COLORS.cardBorder, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, color: Number(v) <= 3 ? "#000" : "#fff" }}>{String(v)}</div>
              )},
              { key: "name", label: "Sales Rep", render: (v: unknown) => (
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: COLORS.gradient1, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 11 }}>{String(v).split(" ").map(n => n[0]).join("")}</div>
                  <span style={{ fontWeight: 600 }}>{String(v)}</span>
                </div>
              )},
              { key: "businesses_added", label: "Businesses Added", align: "center" as const, render: (v: unknown) => <span style={{ fontWeight: 700, color: COLORS.neonGreen, fontSize: 16 }}>{String(v)}</span> },
              { key: "revenue_generated", label: "Revenue Generated", align: "right" as const, render: (v: unknown) => <span style={{ fontWeight: 600 }}>{formatMoney(v as number)}</span> },
            ]}
            data={salesReps as unknown as Record<string, unknown>[]}
          />
        )}
      </Card>
    </div>
  );
}