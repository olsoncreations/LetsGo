"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  COLORS,
  Badge,
  Card,
  StatCard,
  SectionTitle,
  DetailRow,
  ConfirmModal,
  PreviewModal,
  formatDate,
  formatDateTime,
} from "@/components/admin/components";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { logAudit, AUDIT_TABS } from "@/lib/auditLog";

// ==================== TYPES ====================
interface EventRow {
  id: string;
  business_id: string;
  business_name: string;
  title: string;
  description: string | null;
  category: string | null;
  start_at: string | null;
  end_at: string | null;
  price_cents: number | null;
  capacity: number | null;
  booking_url: string | null;
  is_published: boolean;
  is_cancelled: boolean;
  image_url: string | null;
  image_bucket: string | null;
  image_path: string | null;
  created_at: string | null;
  updated_at: string | null;
  view_count: number;
  rsvp_yes: number;
  rsvp_maybe: number;
  rsvp_no: number;
}

interface BizOption {
  id: string;
  name: string;
}

type StatusFilter = "all" | "upcoming" | "past" | "cancelled" | "unpublished";

const CATEGORIES = [
  "Music",
  "Food & Drink",
  "Sports",
  "Comedy",
  "Arts & Culture",
  "Nightlife",
  "Community",
  "Other",
];

// ==================== HELPERS ====================
function getEventStatus(e: EventRow): string {
  if (e.is_cancelled) return "cancelled";
  if (!e.is_published) return "unpublished";
  const now = new Date();
  if (e.start_at && new Date(e.start_at) > now) return "upcoming";
  return "past";
}

function getStatusBadge(status: string): string {
  switch (status) {
    case "upcoming": return "active";
    case "past": return "completed";
    case "cancelled": return "cancelled";
    case "unpublished": return "paused";
    default: return "pending";
  }
}

function formatPrice(cents: number | null): string {
  if (!cents || cents === 0) return "Free";
  return "$" + (cents / 100).toFixed(2);
}

function fmtNum(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

// ==================== MAIN PAGE ====================
export default function AdminEventsPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [businesses, setBusinesses] = useState<BizOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [businessFilter, setBusinessFilter] = useState("all");
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [preview, setPreview] = useState<{ url: string; type: string } | null>(null);

  // ==================== FETCH ====================
  const fetchEvents = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      const res = await fetch("/api/admin/events", {
        headers: { Authorization: `Bearer ${session?.access_token || ""}` },
      });
      if (!res.ok) throw new Error("Failed to fetch events");
      const data = await res.json();
      setEvents(data.events || []);
      setBusinesses(data.businesses || []);
    } catch (err) {
      console.error("[admin-events] fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  // ==================== FILTERS ====================
  const filtered = useMemo(() => {
    let list = events;

    if (statusFilter !== "all") {
      list = list.filter((e) => getEventStatus(e) === statusFilter);
    }
    if (categoryFilter !== "all") {
      list = list.filter((e) => (e.category || "").toLowerCase() === categoryFilter.toLowerCase());
    }
    if (businessFilter !== "all") {
      list = list.filter((e) => e.business_id === businessFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (e) =>
          (e.title || "").toLowerCase().includes(q) ||
          (e.business_name || "").toLowerCase().includes(q) ||
          (e.description || "").toLowerCase().includes(q)
      );
    }

    return list;
  }, [events, statusFilter, categoryFilter, businessFilter, searchQuery]);

  const selected = useMemo(() => events.find((e) => e.id === selectedId) || null, [events, selectedId]);

  // ==================== STATS ====================
  const stats = useMemo(() => {
    const now = new Date();
    const totalViews = events.reduce((s, e) => s + e.view_count, 0);
    const totalYes = events.reduce((s, e) => s + e.rsvp_yes, 0);
    const totalMaybe = events.reduce((s, e) => s + e.rsvp_maybe, 0);
    const totalNo = events.reduce((s, e) => s + e.rsvp_no, 0);
    return {
      total: events.length,
      upcoming: events.filter((e) => !e.is_cancelled && e.is_published && e.start_at && new Date(e.start_at) > now).length,
      cancelled: events.filter((e) => e.is_cancelled).length,
      unpublished: events.filter((e) => !e.is_published && !e.is_cancelled).length,
      totalViews,
      totalYes,
      totalMaybe,
      totalNo,
      totalResponses: totalYes + totalMaybe + totalNo,
    };
  }, [events]);

  // ==================== ACTIONS ====================
  const handleAction = async (id: string, action: "cancel" | "publish" | "unpublish") => {
    setActionLoading(true);
    try {
      const { data: { session: sess } } = await supabaseBrowser.auth.getSession();
      const res = await fetch("/api/admin/events", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sess?.access_token || ""}` },
        body: JSON.stringify({ id, action }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        console.error("[admin-events] action failed:", res.status, errText);
        return;
      }

      const evt = events.find((e) => e.id === id);
      logAudit({
        action: `${action}_event`,
        tab: AUDIT_TABS.EVENTS,
        targetType: "event",
        targetId: id,
        entityName: evt?.title || "",
        fieldName: action === "cancel" ? "is_cancelled" : "is_published",
        oldValue: action === "cancel" ? "false" : action === "publish" ? "false" : "true",
        newValue: action === "cancel" ? "true" : action === "publish" ? "true" : "false",
      });

      await fetchEvents();
    } catch (err) {
      console.error("[admin-events] action error:", err);
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
    }
  };

  // ==================== RENDER ====================
  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: COLORS.textSecondary }}>
        Loading events...
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* ==================== LEFT PANEL ==================== */}
      <div
        style={{
          width: 360,
          flexShrink: 0,
          borderRight: "1px solid " + COLORS.cardBorder,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ padding: "20px 16px 12px" }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 16px", display: "flex", alignItems: "center", gap: 10 }}>
            <span>📅</span> Events
            <span style={{ fontSize: 13, fontWeight: 400, color: COLORS.textSecondary }}>({filtered.length})</span>
          </h1>

          {/* Search */}
          <input
            type="text"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 14px",
              background: COLORS.darkBg,
              border: "1px solid " + COLORS.cardBorder,
              borderRadius: 8,
              color: COLORS.textPrimary,
              fontSize: 13,
              marginBottom: 12,
            }}
          />

          {/* Status Filter Tabs */}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 12 }}>
            {(["all", "upcoming", "past", "cancelled", "unpublished"] as StatusFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                style={{
                  padding: "5px 10px",
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "capitalize",
                  background: statusFilter === s ? COLORS.gradient1 : COLORS.darkBg,
                  color: statusFilter === s ? "#fff" : COLORS.textSecondary,
                }}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Category + Business Filters */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{
                padding: "8px 10px",
                background: COLORS.darkBg,
                border: "1px solid " + COLORS.cardBorder,
                borderRadius: 6,
                color: COLORS.textPrimary,
                fontSize: 11,
              }}
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select
              value={businessFilter}
              onChange={(e) => setBusinessFilter(e.target.value)}
              style={{
                padding: "8px 10px",
                background: COLORS.darkBg,
                border: "1px solid " + COLORS.cardBorder,
                borderRadius: 6,
                color: COLORS.textPrimary,
                fontSize: 11,
              }}
            >
              <option value="all">All Businesses</option>
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Event List */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 8px" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary }}>
              No events found
            </div>
          ) : (
            filtered.map((evt) => {
              const status = getEventStatus(evt);
              const isSelected = selectedId === evt.id;
              const totalRsvp = evt.rsvp_yes + evt.rsvp_maybe + evt.rsvp_no;
              return (
                <div
                  key={evt.id}
                  onClick={() => setSelectedId(evt.id)}
                  style={{
                    padding: "14px 12px",
                    marginBottom: 4,
                    borderRadius: 10,
                    cursor: "pointer",
                    background: isSelected ? "rgba(255,45,146,0.15)" : "transparent",
                    border: isSelected ? "1px solid " + COLORS.neonPink : "1px solid transparent",
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {evt.title}
                      </div>
                      <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 2 }}>
                        {evt.business_name}
                      </div>
                    </div>
                    <Badge status={getStatusBadge(status)} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                    <div style={{ fontSize: 11, color: COLORS.neonBlue }}>
                      {evt.start_at ? formatDateTime(evt.start_at) : "No date"}
                    </div>
                    {evt.category && (
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 600,
                          background: "rgba(191,95,255,0.2)",
                          color: COLORS.neonPurple,
                        }}
                      >
                        {evt.category}
                      </span>
                    )}
                  </div>
                  {/* Engagement mini-stats */}
                  <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 10, color: COLORS.textSecondary }}>
                    <span title="Views">👁 {fmtNum(evt.view_count)}</span>
                    <span title="Going" style={{ color: COLORS.neonGreen }}>✓ {fmtNum(evt.rsvp_yes)}</span>
                    <span title="Maybe" style={{ color: COLORS.neonYellow }}>? {fmtNum(evt.rsvp_maybe)}</span>
                    <span title="Not going" style={{ color: COLORS.neonRed }}>✗ {fmtNum(evt.rsvp_no)}</span>
                    {totalRsvp > 0 && evt.view_count > 0 && (
                      <span title="Response rate" style={{ marginLeft: "auto", color: COLORS.neonBlue }}>
                        {((totalRsvp / evt.view_count) * 100).toFixed(0)}% responded
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ==================== RIGHT PANEL ==================== */}
      <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
        {!selected ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: COLORS.textSecondary }}>
            <span style={{ fontSize: 48, marginBottom: 16 }}>📅</span>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Select an event</div>
            <div style={{ fontSize: 13 }}>Click an event from the list to view details</div>
          </div>
        ) : (
          <>
            {/* Header + Actions */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
              <div>
                <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{selected.title}</h2>
                <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <Badge status={getStatusBadge(getEventStatus(selected))} />
                  {selected.category && (
                    <span
                      style={{
                        padding: "4px 12px",
                        borderRadius: 100,
                        fontSize: 11,
                        fontWeight: 600,
                        background: "rgba(191,95,255,0.2)",
                        color: COLORS.neonPurple,
                        border: "1px solid rgba(191,95,255,0.3)",
                      }}
                    >
                      {selected.category}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {!selected.is_cancelled && (
                  <button
                    onClick={() =>
                      handleAction(selected.id, selected.is_published ? "unpublish" : "publish")
                    }
                    disabled={actionLoading}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 8,
                      border: "none",
                      cursor: actionLoading ? "not-allowed" : "pointer",
                      fontSize: 12,
                      fontWeight: 700,
                      background: selected.is_published ? COLORS.neonOrange : COLORS.neonGreen,
                      color: "#000",
                      opacity: actionLoading ? 0.5 : 1,
                    }}
                  >
                    {selected.is_published ? "Unpublish" : "Publish"}
                  </button>
                )}
                {!selected.is_cancelled && (
                  <button
                    onClick={() => setConfirmAction({ id: selected.id, action: "cancel" })}
                    disabled={actionLoading}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 8,
                      border: "none",
                      cursor: actionLoading ? "not-allowed" : "pointer",
                      fontSize: 12,
                      fontWeight: 700,
                      background: COLORS.neonRed,
                      color: "#fff",
                      opacity: actionLoading ? 0.5 : 1,
                    }}
                  >
                    Cancel Event
                  </button>
                )}
              </div>
            </div>

            {/* ==================== ENGAGEMENT ANALYTICS ==================== */}
            <SectionTitle icon="📊">Event Engagement</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 24 }}>
              <StatCard value={fmtNum(selected.view_count)} label="Views" gradient={COLORS.gradient3} icon="👁" />
              <StatCard value={fmtNum(selected.rsvp_yes)} label="Going" gradient={COLORS.gradient2} icon="✓" />
              <StatCard value={fmtNum(selected.rsvp_maybe)} label="Maybe" gradient={COLORS.gradient4} icon="?" />
              <StatCard value={fmtNum(selected.rsvp_no)} label="Not Going" gradient="linear-gradient(135deg, #ff3131, #990000)" icon="✗" />
              <StatCard
                value={
                  selected.view_count > 0
                    ? (((selected.rsvp_yes + selected.rsvp_maybe + selected.rsvp_no) / selected.view_count) * 100).toFixed(1) + "%"
                    : "0%"
                }
                label="Response Rate"
                gradient={COLORS.gradient1}
                icon="📈"
              />
            </div>

            {/* RSVP Visual Breakdown Bar */}
            {(() => {
              const total = selected.rsvp_yes + selected.rsvp_maybe + selected.rsvp_no;
              if (total === 0) return null;
              const yPct = (selected.rsvp_yes / total) * 100;
              const mPct = (selected.rsvp_maybe / total) * 100;
              const nPct = (selected.rsvp_no / total) * 100;
              return (
                <Card style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.textSecondary, textTransform: "uppercase", marginBottom: 12 }}>
                    Response Breakdown ({total.toLocaleString()} total responses)
                  </div>
                  {/* Stacked bar */}
                  <div style={{ display: "flex", height: 32, borderRadius: 8, overflow: "hidden", marginBottom: 16 }}>
                    {yPct > 0 && (
                      <div
                        style={{ width: yPct + "%", background: COLORS.neonGreen, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#000", minWidth: yPct > 5 ? "auto" : 0 }}
                        title={`Going: ${selected.rsvp_yes}`}
                      >
                        {yPct >= 8 && `${yPct.toFixed(0)}%`}
                      </div>
                    )}
                    {mPct > 0 && (
                      <div
                        style={{ width: mPct + "%", background: COLORS.neonYellow, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#000", minWidth: mPct > 5 ? "auto" : 0 }}
                        title={`Maybe: ${selected.rsvp_maybe}`}
                      >
                        {mPct >= 8 && `${mPct.toFixed(0)}%`}
                      </div>
                    )}
                    {nPct > 0 && (
                      <div
                        style={{ width: nPct + "%", background: COLORS.neonRed, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", minWidth: nPct > 5 ? "auto" : 0 }}
                        title={`Not going: ${selected.rsvp_no}`}
                      >
                        {nPct >= 8 && `${nPct.toFixed(0)}%`}
                      </div>
                    )}
                  </div>
                  {/* Legend */}
                  <div style={{ display: "flex", gap: 24 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 12, height: 12, borderRadius: 3, background: COLORS.neonGreen }} />
                      <span style={{ fontSize: 12, color: COLORS.textPrimary }}>Going — {selected.rsvp_yes.toLocaleString()} ({yPct.toFixed(1)}%)</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 12, height: 12, borderRadius: 3, background: COLORS.neonYellow }} />
                      <span style={{ fontSize: 12, color: COLORS.textPrimary }}>Maybe — {selected.rsvp_maybe.toLocaleString()} ({mPct.toFixed(1)}%)</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 12, height: 12, borderRadius: 3, background: COLORS.neonRed }} />
                      <span style={{ fontSize: 12, color: COLORS.textPrimary }}>Not Going — {selected.rsvp_no.toLocaleString()} ({nPct.toFixed(1)}%)</span>
                    </div>
                  </div>
                  {/* Conversion insight */}
                  {selected.view_count > 0 && (
                    <div style={{ marginTop: 16, padding: "12px 16px", background: COLORS.darkBg, borderRadius: 8, border: "1px solid " + COLORS.cardBorder }}>
                      <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 4 }}>CONVERSION INSIGHT</div>
                      <div style={{ fontSize: 13, color: COLORS.textPrimary }}>
                        Out of <strong>{selected.view_count.toLocaleString()}</strong> people who saw this event,{" "}
                        <strong style={{ color: COLORS.neonGreen }}>{selected.rsvp_yes.toLocaleString()}</strong> said they&apos;re going
                        {selected.rsvp_maybe > 0 && (
                          <> and <strong style={{ color: COLORS.neonYellow }}>{selected.rsvp_maybe.toLocaleString()}</strong> are interested</>
                        )}.
                        That&apos;s a <strong style={{ color: COLORS.neonBlue }}>
                          {(((selected.rsvp_yes + selected.rsvp_maybe) / selected.view_count) * 100).toFixed(1)}%
                        </strong> interest rate.
                      </div>
                    </div>
                  )}
                </Card>
              );
            })()}

            {/* ==================== GLOBAL STATS ROW ==================== */}
            <SectionTitle icon="📅">All Events Overview</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
              <StatCard value={stats.total} label="Total Events" gradient={COLORS.gradient1} icon="📅" />
              <StatCard value={stats.upcoming} label="Upcoming" gradient={COLORS.gradient2} icon="🟢" />
              <StatCard value={fmtNum(stats.totalViews)} label="Total Views" gradient={COLORS.gradient3} icon="👁" />
              <StatCard value={fmtNum(stats.totalYes)} label="Total Going" gradient="linear-gradient(135deg, #39ff14, #00d4ff)" icon="✓" />
            </div>

            {/* Event Details */}
            <SectionTitle icon="📋">Event Details</SectionTitle>
            <Card style={{ marginBottom: 24 }}>
              <DetailRow label="Title" value={selected.title} />
              <DetailRow label="Category" value={selected.category} />
              <DetailRow label="Start" value={selected.start_at ? formatDateTime(selected.start_at) : null} />
              <DetailRow label="End" value={selected.end_at ? formatDateTime(selected.end_at) : null} />
              <DetailRow label="Price" value={formatPrice(selected.price_cents)} />
              <DetailRow label="Capacity" value={selected.capacity} />
              <DetailRow label="Published" value={selected.is_published ? "Yes" : "No"} />
              <DetailRow label="Cancelled" value={selected.is_cancelled ? "Yes" : "No"} />
              <DetailRow label="Created" value={formatDate(selected.created_at)} />
              {selected.booking_url && (
                <DetailRow
                  label="Booking URL"
                  value={
                    <a
                      href={selected.booking_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: COLORS.neonBlue, textDecoration: "none" }}
                    >
                      {selected.booking_url}
                    </a>
                  }
                />
              )}
            </Card>

            {/* Description */}
            {selected.description && (
              <>
                <SectionTitle icon="📝">Description</SectionTitle>
                <Card style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 13, lineHeight: 1.7, color: COLORS.textSecondary, whiteSpace: "pre-wrap" }}>
                    {selected.description}
                  </div>
                </Card>
              </>
            )}

            {/* Event Image */}
            {selected.image_url && (
              <>
                <SectionTitle icon="🖼️">Event Image</SectionTitle>
                <Card style={{ marginBottom: 24 }}>
                  <div
                    onClick={() => setPreview({ url: selected.image_url!, type: "image" })}
                    style={{ cursor: "pointer", borderRadius: 12, overflow: "hidden", maxWidth: 400 }}
                  >
                    <img
                      src={selected.image_url}
                      alt={selected.title}
                      style={{ width: "100%", borderRadius: 12, display: "block" }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                  <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 8 }}>
                    Click to preview full size
                  </div>
                </Card>
              </>
            )}

            {/* Business Info */}
            <SectionTitle icon="🏢">Business Info</SectionTitle>
            <Card style={{ marginBottom: 24 }}>
              <DetailRow label="Business Name" value={selected.business_name} />
              <DetailRow label="Business ID" value={selected.business_id} />
              <div style={{ marginTop: 12 }}>
                <a
                  href={`/admin/businesses?selected=${selected.business_id}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 16px",
                    background: COLORS.darkBg,
                    border: "1px solid " + COLORS.cardBorder,
                    borderRadius: 8,
                    color: COLORS.neonBlue,
                    textDecoration: "none",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  🏢 View Business Profile
                </a>
              </div>
            </Card>
          </>
        )}
      </div>

      {/* ==================== MODALS ==================== */}
      {confirmAction && (
        <ConfirmModal
          title="Cancel Event"
          message={`Are you sure you want to cancel "${events.find((e) => e.id === confirmAction.id)?.title}"? This cannot be undone.`}
          type="danger"
          confirmText="Cancel Event"
          onClose={() => setConfirmAction(null)}
          onConfirm={() => handleAction(confirmAction.id, "cancel")}
        />
      )}

      {preview && <PreviewModal preview={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
