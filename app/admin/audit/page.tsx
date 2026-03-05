"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import {
  COLORS,
  Card,
  StatCard,
  SectionTitle,
  ExportButtons,
  formatDateTime,
} from "@/components/admin/components";
import { AUDIT_TABS } from "@/lib/auditLog";

// ==================== TYPES ====================
interface AuditRow {
  id: string;
  timestamp: string;
  staff_name: string;
  staff_role: string;
  tab: string;
  sub_tab: string;
  action: string;
  field_name: string;
  old_value: string;
  new_value: string;
  entity_name: string;
  is_download: boolean;
  details: string;
}

type SortKey = keyof AuditRow;
type SortDir = "asc" | "desc";

const PAGE_SIZE = 100;

// Infer tab from target_type for legacy rows that have no tab
function inferTab(targetType: string): string {
  const map: Record<string, string> = {
    receipt: "Receipts",
    user: "Users",
    business: "Businesses",
    payout: "Payouts",
    settings: "Settings",
    onboarding: "Onboarding",
    advertising: "Advertising",
    campaign: "Advertising",
    push_notification: "Advertising",
    surge: "Advertising",
    automation: "Automation",
    fraud: "Fraud",
    messaging: "Messaging",
    template: "Messaging",
    promotion: "Promotions",
    support: "Support",
    ticket: "Support",
    sales: "Sales",
    sales_rep: "Sales",
    referral: "Referrals",
    influencer: "Referrals",
    influencer_payout: "Referrals",
    influencer_bonus: "Referrals",
    contract: "Referrals",
    health: "Health",
    staff_user: "Settings",
  };
  return map[targetType] || "";
}

// ==================== AUDIT PAGE ====================
export default function AuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [filterTab, setFilterTab] = useState("all");
  const [filterStaff, setFilterStaff] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [downloadsOnly, setDownloadsOnly] = useState(false);

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>("timestamp");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Pagination
  const [page, setPage] = useState(0);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabaseBrowser
        .from("audit_logs")
        .select("id, timestamp, created_at, staff_name, staff_role, tab, sub_tab, action, target_type, field_name, old_value, new_value, entity_name, is_download, details")
        .order("timestamp", { ascending: false })
        .limit(2000);

      if (error) throw error;

      const mapped: AuditRow[] = (data || []).map(log => ({
        id: log.id,
        timestamp: log.timestamp || log.created_at || "",
        staff_name: log.staff_name || "System",
        staff_role: log.staff_role || "--",
        tab: log.tab || inferTab(log.target_type || "") || "--",
        sub_tab: log.sub_tab || "--",
        action: (log.action || "").replace(/_/g, " "),
        field_name: log.field_name || "--",
        old_value: log.old_value || "--",
        new_value: log.new_value || "--",
        entity_name: log.entity_name || "--",
        is_download: log.is_download || false,
        details: log.details || "--",
      }));

      setRows(mapped);
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "message" in err ? (err as { message: string }).message : "";
      if (!msg.includes("does not exist") && !msg.includes("relation")) {
        console.error("Error fetching audit log:", err);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ==================== DERIVED DATA ====================
  const uniqueTabs = useMemo(() => [...new Set(rows.map(r => r.tab).filter(t => t && t !== "--"))].sort(), [rows]);
  const uniqueStaff = useMemo(() => [...new Set(rows.map(r => r.staff_name).filter(Boolean))].sort(), [rows]);

  // Filtering
  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (search) {
        const q = search.toLowerCase();
        const searchable = `${r.staff_name} ${r.tab} ${r.sub_tab} ${r.action} ${r.field_name} ${r.old_value} ${r.new_value} ${r.entity_name} ${r.details}`.toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      if (filterTab !== "all" && r.tab !== filterTab) return false;
      if (filterStaff !== "all" && r.staff_name !== filterStaff) return false;
      if (dateFrom && new Date(r.timestamp) < new Date(dateFrom)) return false;
      if (dateTo && new Date(r.timestamp) > new Date(dateTo + "T23:59:59")) return false;
      if (downloadsOnly && !r.is_download) return false;
      return true;
    });
  }, [rows, search, filterTab, filterStaff, dateFrom, dateTo, downloadsOnly]);

  // Sorting
  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (sortKey === "timestamp") {
        const diff = new Date(aVal as string).getTime() - new Date(bVal as string).getTime();
        return sortDir === "asc" ? diff : -diff;
      }
      if (sortKey === "is_download") {
        const diff = (aVal ? 1 : 0) - (bVal ? 1 : 0);
        return sortDir === "asc" ? diff : -diff;
      }
      const diff = String(aVal).localeCompare(String(bVal));
      return sortDir === "asc" ? diff : -diff;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  // Paginated
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset page on filter change
  useEffect(() => { setPage(0); }, [search, filterTab, filterStaff, dateFrom, dateTo, downloadsOnly]);

  // ==================== STATS ====================
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayCount = rows.filter(r => new Date(r.timestamp) >= today).length;
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekCount = rows.filter(r => new Date(r.timestamp) >= weekAgo).length;
  const uniqueStaffCount = new Set(rows.map(r => r.staff_name).filter(n => n !== "System")).size;

  // ==================== SORT HANDLER ====================
  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "timestamp" ? "desc" : "asc");
    }
  }

  // ==================== EXPORT DATA ====================
  const exportData = filtered.map(r => ({
    "Date/Time": formatDateTime(r.timestamp),
    Staff: r.staff_name,
    Role: r.staff_role,
    Tab: r.tab,
    "Sub-Tab": r.sub_tab,
    Action: r.action,
    Field: r.field_name,
    "Original Value": r.old_value,
    "New Value": r.new_value,
    Entity: r.entity_name,
    Download: r.is_download ? "Yes" : "No",
    "Other Info": r.details,
  }));

  // Column definitions for the flat table
  const columns: { key: SortKey; label: string; width: number; sticky?: boolean }[] = [
    { key: "timestamp", label: "Date/Time", width: 150, sticky: true },
    { key: "staff_name", label: "Staff", width: 140 },
    { key: "staff_role", label: "Role", width: 100 },
    { key: "tab", label: "Tab", width: 110 },
    { key: "sub_tab", label: "Sub-Tab", width: 130 },
    { key: "action", label: "Action", width: 160 },
    { key: "field_name", label: "Field", width: 130 },
    { key: "old_value", label: "Original Value", width: 160 },
    { key: "new_value", label: "New Value", width: 160 },
    { key: "entity_name", label: "Entity", width: 160 },
    { key: "is_download", label: "Download", width: 90 },
    { key: "details", label: "Other Info", width: 220 },
  ];

  // ==================== STYLES ====================
  const inputStyle: React.CSSProperties = {
    padding: "10px 14px",
    border: "1px solid " + COLORS.cardBorder,
    borderRadius: 8,
    fontSize: 13,
    background: COLORS.cardBg,
    color: COLORS.textPrimary,
  };
  const selectStyle: React.CSSProperties = { ...inputStyle, cursor: "pointer" };
  const dateStyle: React.CSSProperties = { ...inputStyle, colorScheme: "dark" as const };

  const thStyle = (col: typeof columns[number]): React.CSSProperties => ({
    position: col.sticky ? "sticky" : undefined,
    left: col.sticky ? 0 : undefined,
    zIndex: col.sticky ? 2 : 1,
    width: col.width,
    minWidth: col.width,
    padding: "10px 12px",
    textAlign: "left",
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    color: sortKey === col.key ? COLORS.neonBlue : COLORS.textSecondary,
    cursor: "pointer",
    userSelect: "none",
    whiteSpace: "nowrap",
    borderBottom: "2px solid " + COLORS.cardBorder,
    background: COLORS.cardBg,
  });

  const tdStyle = (col: typeof columns[number]): React.CSSProperties => ({
    position: col.sticky ? "sticky" : undefined,
    left: col.sticky ? 0 : undefined,
    zIndex: col.sticky ? 1 : 0,
    width: col.width,
    minWidth: col.width,
    padding: "8px 12px",
    fontSize: 12,
    color: COLORS.textPrimary,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    borderBottom: "1px solid " + COLORS.cardBorder,
    background: col.sticky ? COLORS.cardBg : "transparent",
  });

  const hasActiveFilters = search || filterTab !== "all" || filterStaff !== "all" || dateFrom || dateTo || downloadsOnly;

  // ==================== RENDER ====================
  if (loading) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.textSecondary }}>
        Loading audit log...
      </div>
    );
  }

  return (
    <div style={{ flex: 1, padding: 32, overflowY: "auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, background: COLORS.gradient1, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Audit Log
        </h1>
        <ExportButtons
          data={exportData as unknown as Record<string, unknown>[]}
          filename="audit_log"
        />
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <StatCard icon="📊" value={rows.length.toString()} label="Total Entries" gradient={COLORS.gradient3} />
        <StatCard icon="📅" value={todayCount.toString()} label="Today" gradient={COLORS.gradient1} />
        <StatCard icon="📆" value={weekCount.toString()} label="This Week" gradient={COLORS.gradient2} />
        <StatCard icon="👥" value={uniqueStaffCount.toString()} label="Staff Active" gradient={COLORS.gradient4} />
      </div>

      <SectionTitle icon="🔍">Activity Log</SectionTitle>

      {/* Filter Bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="text"
          placeholder="Search all columns..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...inputStyle, flex: 1, minWidth: 200 }}
        />
        <select value={filterTab} onChange={e => setFilterTab(e.target.value)} style={selectStyle}>
          <option value="all">All Tabs</option>
          {uniqueTabs.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterStaff} onChange={e => setFilterStaff(e.target.value)} style={selectStyle}>
          <option value="all">All Staff</option>
          {uniqueStaff.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={dateStyle} title="From date" />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={dateStyle} title="To date" />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: COLORS.textSecondary, cursor: "pointer", padding: "10px 14px", border: "1px solid " + COLORS.cardBorder, borderRadius: 8, background: downloadsOnly ? "rgba(0,212,255,0.12)" : COLORS.cardBg }}>
          <input
            type="checkbox"
            checked={downloadsOnly}
            onChange={e => setDownloadsOnly(e.target.checked)}
            style={{ accentColor: COLORS.neonBlue }}
          />
          Downloads Only
        </label>
        {hasActiveFilters && (
          <button
            onClick={() => { setSearch(""); setFilterTab("all"); setFilterStaff("all"); setDateFrom(""); setDateTo(""); setDownloadsOnly(false); }}
            style={{ padding: "10px 14px", border: "1px solid " + COLORS.cardBorder, borderRadius: 8, fontSize: 12, background: "rgba(255,45,146,0.12)", color: COLORS.neonPink, cursor: "pointer", fontWeight: 600 }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Results count + pagination top */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, fontSize: 13, color: COLORS.textSecondary }}>
        <span>Showing {paginated.length} of {filtered.length} entries {filtered.length !== rows.length && `(${rows.length} total)`}</span>
        {totalPages > 1 && (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
              style={{ padding: "6px 12px", border: "1px solid " + COLORS.cardBorder, borderRadius: 6, fontSize: 12, background: COLORS.cardBg, color: page === 0 ? COLORS.cardBorder : COLORS.textPrimary, cursor: page === 0 ? "default" : "pointer" }}
            >
              Prev
            </button>
            <span style={{ fontSize: 12 }}>Page {page + 1} of {totalPages}</span>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
              style={{ padding: "6px 12px", border: "1px solid " + COLORS.cardBorder, borderRadius: 6, fontSize: 12, background: COLORS.cardBg, color: page >= totalPages - 1 ? COLORS.cardBorder : COLORS.textPrimary, cursor: page >= totalPages - 1 ? "default" : "pointer" }}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Flat Table */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: COLORS.textSecondary }}>
            {rows.length === 0 ? (
              <div>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No audit entries yet</div>
                <div style={{ fontSize: 13 }}>Actions performed across the admin dashboard will be logged here automatically.</div>
              </div>
            ) : (
              "No entries match your filters."
            )}
          </div>
        ) : (
          <div style={{ overflowX: "auto", width: "100%" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", minWidth: columns.reduce((s, c) => s + c.width, 0) }}>
              <thead>
                <tr>
                  {columns.map(col => (
                    <th key={col.key} style={thStyle(col)} onClick={() => handleSort(col.key)}>
                      {col.label}
                      {sortKey === col.key && (
                        <span style={{ marginLeft: 4, fontSize: 10 }}>{sortDir === "asc" ? "▲" : "▼"}</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map(row => (
                  <tr key={row.id} style={{ transition: "background 0.1s" }} onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <td style={tdStyle(columns[0])} title={new Date(row.timestamp).toLocaleString()}>{formatDateTime(row.timestamp)}</td>
                    <td style={{ ...tdStyle(columns[1]), fontWeight: 600 }} title={row.staff_name}>{row.staff_name}</td>
                    <td style={tdStyle(columns[2])} title={row.staff_role}>
                      <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: row.staff_role === "admin" ? "rgba(255,45,146,0.15)" : row.staff_role === "manager" ? "rgba(0,212,255,0.15)" : "rgba(255,255,255,0.06)", color: row.staff_role === "admin" ? COLORS.neonPink : row.staff_role === "manager" ? COLORS.neonBlue : COLORS.textSecondary }}>
                        {row.staff_role}
                      </span>
                    </td>
                    <td style={tdStyle(columns[3])} title={row.tab}>
                      <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: "rgba(191,95,255,0.12)", color: COLORS.neonPurple }}>
                        {row.tab}
                      </span>
                    </td>
                    <td style={tdStyle(columns[4])} title={row.sub_tab}>{row.sub_tab}</td>
                    <td style={{ ...tdStyle(columns[5]), fontWeight: 600, color: COLORS.neonGreen }} title={row.action}>{row.action}</td>
                    <td style={tdStyle(columns[6])} title={row.field_name}>{row.field_name}</td>
                    <td style={{ ...tdStyle(columns[7]), color: row.old_value !== "--" ? COLORS.neonOrange : COLORS.textSecondary }} title={row.old_value}>{row.old_value}</td>
                    <td style={{ ...tdStyle(columns[8]), color: row.new_value !== "--" ? COLORS.neonBlue : COLORS.textSecondary }} title={row.new_value}>{row.new_value}</td>
                    <td style={tdStyle(columns[9])} title={row.entity_name}>{row.entity_name}</td>
                    <td style={{ ...tdStyle(columns[10]), textAlign: "center" }}>
                      {row.is_download ? <span style={{ color: COLORS.neonGreen, fontWeight: 700 }}>Yes</span> : <span style={{ color: COLORS.textSecondary }}>--</span>}
                    </td>
                    <td style={tdStyle(columns[11])} title={row.details}>{row.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Bottom pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 16, alignItems: "center" }}>
          <button
            disabled={page === 0}
            onClick={() => setPage(0)}
            style={{ padding: "6px 12px", border: "1px solid " + COLORS.cardBorder, borderRadius: 6, fontSize: 12, background: COLORS.cardBg, color: page === 0 ? COLORS.cardBorder : COLORS.textPrimary, cursor: page === 0 ? "default" : "pointer" }}
          >
            First
          </button>
          <button
            disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
            style={{ padding: "6px 12px", border: "1px solid " + COLORS.cardBorder, borderRadius: 6, fontSize: 12, background: COLORS.cardBg, color: page === 0 ? COLORS.cardBorder : COLORS.textPrimary, cursor: page === 0 ? "default" : "pointer" }}
          >
            Prev
          </button>
          <span style={{ fontSize: 12, color: COLORS.textSecondary, padding: "0 8px" }}>Page {page + 1} of {totalPages}</span>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage(p => p + 1)}
            style={{ padding: "6px 12px", border: "1px solid " + COLORS.cardBorder, borderRadius: 6, fontSize: 12, background: COLORS.cardBg, color: page >= totalPages - 1 ? COLORS.cardBorder : COLORS.textPrimary, cursor: page >= totalPages - 1 ? "default" : "pointer" }}
          >
            Next
          </button>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage(totalPages - 1)}
            style={{ padding: "6px 12px", border: "1px solid " + COLORS.cardBorder, borderRadius: 6, fontSize: 12, background: COLORS.cardBg, color: page >= totalPages - 1 ? COLORS.cardBorder : COLORS.textPrimary, cursor: page >= totalPages - 1 ? "default" : "pointer" }}
          >
            Last
          </button>
        </div>
      )}
    </div>
  );
}
