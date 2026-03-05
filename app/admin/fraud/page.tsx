"use client";

import React, { useEffect, useState, useCallback } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import {
  COLORS,
  Badge,
  Card,
  StatCard,
  DataTable,
  ExportButtons,
  formatMoney,
  formatDateTime,
} from "@/components/admin/components";
import { logAudit, AUDIT_TABS } from "@/lib/auditLog";

// ==================== TYPES ====================
interface FraudAlert {
  id: string;
  alert_type: string;
  severity: "critical" | "high" | "medium" | "low";
  user_id: string;
  user_name: string;
  description: string;
  amount_cents: number;
  status: "open" | "investigating" | "cleared" | "confirmed";
  created_at: string;
  business_id: string | null;
  business_name: string;
  receipt_id: string | null;
  assigned_to: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
}

interface UserRiskScore {
  user_id: string;
  user_name: string;
  risk_score: number;
  risk_level: "critical" | "high" | "medium" | "low";
  factors: string[];
}

// ==================== FRAUD PAGE ====================
export default function FraudPage() {
  const [fraudAlerts, setFraudAlerts] = useState<FraudAlert[]>([]);
  const [userRiskScores, setUserRiskScores] = useState<UserRiskScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [fraudTab, setFraudTab] = useState("alerts");
  const [fraudFilters, setFraudFilters] = useState({ search: "", severity: "all", status: "all" });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch fraud alerts
      const { data: alertRows, error } = await supabaseBrowser
        .from("fraud_alerts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // 2. Collect unique user_ids and business_ids
      const userIds = [...new Set((alertRows || []).map(a => a.user_id).filter(Boolean))];
      const businessIds = [...new Set((alertRows || []).map(a => a.business_id).filter(Boolean))];

      // 3. Fetch profiles for user names
      let profileMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabaseBrowser
          .from("profiles")
          .select("id, full_name, first_name, last_name")
          .in("id", userIds);

        profileMap = new Map((profiles || []).map(p => [
          p.id,
          p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unknown User",
        ]));
      }

      // 4. Fetch business names
      let businessMap = new Map<string, string>();
      if (businessIds.length > 0) {
        const { data: businesses } = await supabaseBrowser
          .from("business")
          .select("id, business_name, public_business_name")
          .in("id", businessIds);

        businessMap = new Map((businesses || []).map(b => [
          b.id,
          b.public_business_name || b.business_name || "Unknown Business",
        ]));
      }

      // 5. Map alerts with resolved names — extract description/amount from details jsonb
      const mappedAlerts: FraudAlert[] = (alertRows || []).map(a => {
        const details = a.details || {};
        return {
          id: a.id,
          alert_type: a.alert_type || "unknown",
          severity: a.severity || "medium",
          user_id: a.user_id,
          user_name: a.user_id ? profileMap.get(a.user_id) || "Unknown User" : "Unknown User",
          description: details.description || details.reason || "",
          amount_cents: details.amount_cents || details.amount || details.receipt_total_cents || 0,
          status: a.status || "open",
          created_at: a.created_at,
          business_id: a.business_id,
          business_name: a.business_id ? businessMap.get(a.business_id) || "" : "",
          receipt_id: a.receipt_id,
          assigned_to: a.assigned_to,
          resolved_by: a.resolved_by,
          resolved_at: a.resolved_at,
          resolution_notes: a.resolution_notes,
        };
      });

      setFraudAlerts(mappedAlerts);

      // 6. Calculate risk scores from alerts
      const riskMap: Record<string, { score: number; factors: string[] }> = {};
      mappedAlerts.forEach(alert => {
        if (!riskMap[alert.user_id]) riskMap[alert.user_id] = { score: 0, factors: [] };
        riskMap[alert.user_id].score += alert.severity === "critical" ? 30 : alert.severity === "high" ? 20 : 10;
        if (!riskMap[alert.user_id].factors.includes(alert.alert_type)) riskMap[alert.user_id].factors.push(alert.alert_type);
      });

      const riskScores: UserRiskScore[] = Object.entries(riskMap).map(([userId, data]) => {
        const alert = mappedAlerts.find(a => a.user_id === userId);
        const score = Math.min(data.score, 100);
        return { user_id: userId, user_name: alert?.user_name || "Unknown", risk_score: score, risk_level: score >= 70 ? "critical" : score >= 50 ? "high" : score >= 30 ? "medium" : "low", factors: data.factors };
      });
      setUserRiskScores(riskScores.sort((a, b) => b.risk_score - a.risk_score));
    } catch (err) { console.error("Error fetching fraud data:", err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredAlerts = fraudAlerts.filter(f => {
    if (fraudFilters.search && !f.user_name.toLowerCase().includes(fraudFilters.search.toLowerCase()) && !f.description.toLowerCase().includes(fraudFilters.search.toLowerCase())) return false;
    if (fraudFilters.severity !== "all" && f.severity !== fraudFilters.severity) return false;
    if (fraudFilters.status !== "all" && f.status !== fraudFilters.status) return false;
    return true;
  });

  const fraudByType = [
    { type: "Duplicate", count: fraudAlerts.filter(f => f.alert_type === "duplicate_receipt").length },
    { type: "Velocity", count: fraudAlerts.filter(f => f.alert_type === "velocity").length },
    { type: "Amount", count: fraudAlerts.filter(f => f.alert_type === "suspicious_amount").length },
    { type: "Geo", count: fraudAlerts.filter(f => f.alert_type === "geo_mismatch").length },
    { type: "Image", count: fraudAlerts.filter(f => f.alert_type === "image_manipulation").length },
  ];

  const updateAlertStatus = async (alertId: string, newStatus: string) => {
    try {
      // Get current staff user for resolved_by tracking
      const { data: { user } } = await supabaseBrowser.auth.getUser();

      const updateData: Record<string, unknown> = { status: newStatus };
      if (newStatus === "cleared" || newStatus === "confirmed") {
        updateData.resolved_at = new Date().toISOString();
        if (user) updateData.resolved_by = user.id;
      }
      if (newStatus === "investigating" && user) {
        updateData.assigned_to = user.id;
      }

      const { error } = await supabaseBrowser.from("fraud_alerts").update(updateData).eq("id", alertId);
      if (error) throw error;

      const alert = fraudAlerts.find(a => a.id === alertId);
      logAudit({
        action: "update_fraud_alert_status",
        tab: AUDIT_TABS.FRAUD,
        subTab: "Active Alerts",
        targetType: "fraud_alert",
        targetId: alertId,
        entityName: alert?.description || alert?.alert_type || "Fraud alert",
        fieldName: "status",
        oldValue: alert?.status || "",
        newValue: newStatus,
        details: `Changed fraud alert status to "${newStatus}" for user ${alert?.user_name || "unknown"}${alert?.business_name ? ` at ${alert.business_name}` : ""}`,
      });

      setFraudAlerts(prev => prev.map(a => a.id === alertId ? { ...a, status: newStatus as FraudAlert["status"] } : a));
    } catch (err) { console.error("Error updating alert:", err); alert("Failed to update alert status."); }
  };

  if (loading) return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.textSecondary }}>Loading fraud data...</div>;

  return (
    <div style={{ flex: 1, padding: 32, overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, background: COLORS.gradient1, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>🛡️ Fraud Detection Center</h1>
        <ExportButtons data={fraudAlerts.map(f => ({ ID: f.id, Type: f.alert_type, Severity: f.severity, User: f.user_name, Amount: formatMoney(f.amount_cents), Status: f.status, Detected: formatDateTime(f.created_at) })) as unknown as Record<string, unknown>[]} filename="fraud_alerts" />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {[{ key: "alerts", label: "🚨 Active Alerts", count: fraudAlerts.filter(f => f.status !== "cleared" && f.status !== "confirmed").length }, { key: "risk", label: "📊 Risk Scores" }, { key: "patterns", label: "🔍 Patterns" }].map(tab => (
          <button key={tab.key} onClick={() => setFraudTab(tab.key)} style={{ padding: "10px 20px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: fraudTab === tab.key ? COLORS.gradient1 : COLORS.cardBg, color: fraudTab === tab.key ? "#fff" : COLORS.textSecondary, display: "flex", alignItems: "center", gap: 8 }}>
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && <span style={{ background: "rgba(255,255,255,0.3)", padding: "2px 8px", borderRadius: 100, fontSize: 10 }}>{tab.count}</span>}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <StatCard icon="🚨" value={fraudAlerts.filter(f => f.severity === "critical").length.toString()} label="Critical Alerts" gradient="linear-gradient(135deg, #ff3131, #990000)" />
        <StatCard icon="⚠️" value={fraudAlerts.filter(f => f.severity === "high").length.toString()} label="High Severity" gradient={COLORS.gradient4} />
        <StatCard icon="🔍" value={fraudAlerts.filter(f => f.status === "investigating").length.toString()} label="Investigating" gradient={COLORS.gradient3} />
        <StatCard icon="✅" value={fraudAlerts.filter(f => f.status === "cleared").length.toString()} label="Cleared" gradient={COLORS.gradient2} />
      </div>

      {fraudTab === "alerts" && (
        <>
          <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
            <input type="text" placeholder="Search alerts..." value={fraudFilters.search} onChange={e => setFraudFilters({ ...fraudFilters, search: e.target.value })} style={{ flex: 1, padding: "12px 14px", border: "1px solid " + COLORS.cardBorder, borderRadius: 10, fontSize: 13, background: COLORS.cardBg, color: COLORS.textPrimary }} />
            <select value={fraudFilters.severity} onChange={e => setFraudFilters({ ...fraudFilters, severity: e.target.value })} style={{ padding: "12px 16px", border: "1px solid " + COLORS.cardBorder, borderRadius: 10, fontSize: 13, background: COLORS.cardBg, color: COLORS.textPrimary }}>
              <option value="all">All Severity</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
            </select>
            <select value={fraudFilters.status} onChange={e => setFraudFilters({ ...fraudFilters, status: e.target.value })} style={{ padding: "12px 16px", border: "1px solid " + COLORS.cardBorder, borderRadius: 10, fontSize: 13, background: COLORS.cardBg, color: COLORS.textPrimary }}>
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="investigating">Investigating</option>
              <option value="cleared">Cleared</option>
              <option value="confirmed">Confirmed Fraud</option>
            </select>
          </div>

          <Card>
            {filteredAlerts.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary }}>No fraud alerts found</div> : (
              <DataTable
                columns={[
                  { key: "severity", label: "Severity", render: (v) => { const colors: Record<string, string> = { critical: COLORS.neonRed, high: COLORS.neonOrange, medium: COLORS.neonYellow }; return <span style={{ padding: "6px 12px", borderRadius: 8, background: colors[String(v)] || COLORS.cardBg, color: String(v) === "medium" ? "#000" : "#fff", fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>{String(v)}</span>; }},
                  { key: "alert_type", label: "Type", render: (v) => <span style={{ textTransform: "capitalize" }}>{String(v)?.replace(/_/g, " ")}</span> },
                  { key: "user_name", label: "User", render: (v) => <span style={{ fontWeight: 600 }}>{String(v)}</span> },
                  { key: "description", label: "Description", render: (v) => <span style={{ fontSize: 12, color: COLORS.textSecondary }}>{String(v)}</span> },
                  { key: "amount_cents", label: "Amount", align: "right", render: (v) => <span style={{ fontWeight: 600, color: COLORS.neonRed }}>{formatMoney(v as number)}</span> },
                  { key: "status", label: "Status", render: (v) => <Badge status={String(v) === "investigating" ? "pending" : String(v) === "cleared" ? "approved" : String(v) === "confirmed" ? "rejected" : "submitted"} /> },
                  { key: "created_at", label: "Detected", render: (v) => formatDateTime(String(v)) },
                  { key: "id", label: "", align: "right", render: (v, row) => { const a = row as unknown as FraudAlert; return a.status === "open" ? (<div style={{ display: "flex", gap: 8 }}><button onClick={() => updateAlertStatus(String(v), "investigating")} style={{ padding: "6px 12px", background: "rgba(255,107,53,0.2)", border: "1px solid " + COLORS.neonOrange, borderRadius: 6, color: COLORS.neonOrange, cursor: "pointer", fontSize: 10, fontWeight: 600 }}>🔍 Investigate</button><button onClick={() => updateAlertStatus(String(v), "cleared")} style={{ padding: "6px 12px", background: "rgba(57,255,20,0.2)", border: "1px solid " + COLORS.neonGreen, borderRadius: 6, color: COLORS.neonGreen, cursor: "pointer", fontSize: 10, fontWeight: 600 }}>✓ Clear</button></div>) : null; }},
                ]}
                data={filteredAlerts as unknown as Record<string, unknown>[]}
              />
            )}
          </Card>
        </>
      )}

      {fraudTab === "risk" && (
        <Card title="USER RISK SCORES">
          {userRiskScores.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary }}>No risk data available</div> : (
            <DataTable
              columns={[
                { key: "user_name", label: "User", render: (v) => <span style={{ fontWeight: 600 }}>{String(v)}</span> },
                { key: "risk_score", label: "Score", render: (v) => { const score = Number(v); return (<div style={{ display: "flex", alignItems: "center", gap: 12, width: 150 }}><div style={{ flex: 1, height: 8, background: COLORS.darkBg, borderRadius: 4, overflow: "hidden" }}><div style={{ width: score + "%", height: "100%", background: score >= 70 ? COLORS.neonRed : score >= 40 ? COLORS.neonOrange : COLORS.neonGreen, borderRadius: 4 }} /></div><span style={{ fontWeight: 700, fontSize: 14, color: score >= 70 ? COLORS.neonRed : score >= 40 ? COLORS.neonOrange : COLORS.neonGreen }}>{score}</span></div>); }},
                { key: "risk_level", label: "Level", render: (v) => { const colors: Record<string, string> = { critical: COLORS.neonRed, high: COLORS.neonOrange, medium: COLORS.neonYellow, low: COLORS.neonGreen }; return <span style={{ padding: "4px 12px", borderRadius: 6, background: colors[String(v)] || COLORS.cardBg, color: String(v) === "medium" || String(v) === "low" ? "#000" : "#fff", fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>{String(v)}</span>; }},
                { key: "factors", label: "Risk Factors", render: (v) => { const factors = v as string[]; return (<div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{factors.map((f, i) => <span key={i} style={{ padding: "2px 8px", background: COLORS.darkBg, borderRadius: 4, fontSize: 10, color: COLORS.textSecondary }}>{f.replace(/_/g, " ")}</span>)}</div>); }},
                { key: "user_id", label: "", align: "right", render: () => (<button style={{ padding: "6px 12px", background: COLORS.gradient1, border: "none", borderRadius: 6, color: "#fff", cursor: "pointer", fontSize: 10, fontWeight: 600 }}>View User</button>) },
              ]}
              data={userRiskScores as unknown as Record<string, unknown>[]}
            />
          )}
        </Card>
      )}

      {fraudTab === "patterns" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <Card title="FRAUD BY TYPE">
            <div style={{ height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fraudByType}>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.cardBorder} />
                  <XAxis dataKey="type" tick={{ fill: COLORS.textSecondary, fontSize: 11 }} />
                  <YAxis tick={{ fill: COLORS.textSecondary, fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8 }} />
                  <Bar dataKey="count" fill={COLORS.neonRed} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card title="DETECTION TIPS">
            <div style={{ display: "grid", gap: 12 }}>
              {[{ icon: "🔄", title: "Duplicate Receipts", desc: "Same image or similar amounts within short timeframe" }, { icon: "⚡", title: "Velocity Patterns", desc: "Unusually high submission rate from single user" }, { icon: "💰", title: "Suspicious Amounts", desc: "Receipts significantly above venue averages" }, { icon: "📍", title: "Geo Mismatches", desc: "Receipt location doesn't match user profile" }, { icon: "🖼️", title: "Image Manipulation", desc: "Signs of digital editing or reused photos" }].map((tip, i) => (
                <div key={i} style={{ padding: 14, background: COLORS.darkBg, borderRadius: 10, display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 24 }}>{tip.icon}</span>
                  <div><div style={{ fontWeight: 600, marginBottom: 4 }}>{tip.title}</div><div style={{ fontSize: 12, color: COLORS.textSecondary }}>{tip.desc}</div></div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
