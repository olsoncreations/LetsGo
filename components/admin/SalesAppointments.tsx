"use client";

import React, { useEffect, useState, useCallback } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { COLORS } from "@/components/admin/constants";
import { Card } from "@/components/admin/components";

interface SalesRep {
  id: string;
  name: string;
}

interface Appointment {
  id: string;
  lead_id: string;
  assigned_rep_id: string | null;
  scheduled_at: string;
  duration_min: number;
  location: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  sales_leads: {
    id: string;
    business_name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    city: string | null;
    state: string | null;
    preview_business_id: string | null;
  } | null;
}

interface SalesAppointmentsProps {
  salesReps: SalesRep[];
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: COLORS.neonBlue,
  completed: COLORS.neonGreen,
  cancelled: COLORS.textSecondary,
  no_show: COLORS.neonOrange,
};

const DURATION_LABELS: Record<number, string> = {
  15: "15 min",
  30: "30 min",
  45: "45 min",
  60: "1 hr",
  90: "1.5 hr",
  120: "2 hr",
};

const btnStyle: React.CSSProperties = {
  padding: "6px 14px",
  borderRadius: 8,
  fontSize: 13,
  cursor: "pointer",
  border: "1px solid " + COLORS.cardBorder,
  background: "transparent",
  color: COLORS.textPrimary,
};

const selectStyle: React.CSSProperties = {
  background: COLORS.cardBg,
  color: COLORS.textPrimary,
  border: "1px solid " + COLORS.cardBorder,
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 13,
  cursor: "pointer",
  outline: "none",
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatDateFull(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export default function SalesAppointments({ salesReps }: SalesAppointmentsProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [filterRep, setFilterRep] = useState("all");
  const [filterStatus, setFilterStatus] = useState("upcoming");
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ date: "", time: "", duration_min: 30, rep_id: "", location: "", notes: "" });
  const [editSaving, setEditSaving] = useState(false);

  async function getToken(): Promise<string> {
    const { data: { session } } = await supabaseBrowser.auth.getSession();
    return session?.access_token || "";
  }

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const params = new URLSearchParams();
      if (filterRep !== "all") params.set("rep_id", filterRep);
      if (filterStatus !== "all" && filterStatus !== "upcoming" && filterStatus !== "past") {
        params.set("status", filterStatus);
      }
      const res = await fetch(`/api/admin/sales/appointments?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAppointments(data || []);
      }
    } catch (err) {
      console.error("Error fetching appointments:", err);
    } finally {
      setLoading(false);
    }
  }, [filterRep, filterStatus]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const now = new Date();
  const filtered = appointments.filter((a) => {
    if (filterStatus === "upcoming") return a.status === "scheduled" && new Date(a.scheduled_at) >= now;
    if (filterStatus === "past") return a.status !== "scheduled" || new Date(a.scheduled_at) < now;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (filterStatus === "past") return new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime();
    return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
  });

  // Calendar helpers
  const calYear = calendarMonth.getFullYear();
  const calMon = calendarMonth.getMonth();
  const daysInMonth = new Date(calYear, calMon + 1, 0).getDate();
  const firstDayOfWeek = new Date(calYear, calMon, 1).getDay();

  const appointmentsByDate = new Map<string, Appointment[]>();
  for (const a of appointments.filter((a) => a.status === "scheduled")) {
    const key = new Date(a.scheduled_at).toISOString().slice(0, 10);
    if (!appointmentsByDate.has(key)) appointmentsByDate.set(key, []);
    appointmentsByDate.get(key)!.push(a);
  }

  const dayAppointments = selectedDay ? (appointmentsByDate.get(selectedDay) || []) : [];

  async function handleQuickStatus(id: string, status: string) {
    try {
      const token = await getToken();
      await fetch(`/api/admin/sales/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      fetchAppointments();
    } catch (err) {
      console.error("Error updating appointment:", err);
    }
  }

  function openEdit(a: Appointment) {
    const dt = new Date(a.scheduled_at);
    setEditForm({
      date: dt.toISOString().slice(0, 10),
      time: dt.toTimeString().slice(0, 5),
      duration_min: a.duration_min,
      rep_id: a.assigned_rep_id || "",
      location: a.location || "",
      notes: a.notes || "",
    });
    setEditingId(a.id);
  }

  async function handleSaveEdit() {
    if (!editingId || !editForm.date || !editForm.time) return;
    setEditSaving(true);
    try {
      const token = await getToken();
      const scheduledAt = new Date(`${editForm.date}T${editForm.time}:00`).toISOString();
      const res = await fetch(`/api/admin/sales/appointments/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          scheduled_at: scheduledAt,
          duration_min: editForm.duration_min,
          assigned_rep_id: editForm.rep_id || null,
          location: editForm.location || null,
          notes: editForm.notes || null,
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        alert("Error: " + err);
        return;
      }
      setEditingId(null);
      fetchAppointments();
    } catch (err) {
      console.error("Error saving edit:", err);
    } finally {
      setEditSaving(false);
    }
  }

  function renderAppointmentRow(a: Appointment) {
    const biz = a.sales_leads;
    const rep = salesReps.find((r) => r.id === a.assigned_rep_id);
    const isPast = new Date(a.scheduled_at) < now;
    const statusColor = STATUS_COLORS[a.status] || COLORS.textSecondary;
    const isEditing = editingId === a.id;

    if (isEditing) {
      return (
        <div key={a.id} style={{ padding: 16, borderBottom: "1px solid " + COLORS.cardBorder, background: `${COLORS.neonBlue}06` }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 12 }}>
            Editing: {biz?.business_name || "Unknown"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>Date</label>
              <input type="date" value={editForm.date} onChange={(e) => setEditForm((p) => ({ ...p, date: e.target.value }))} style={selectStyle} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>Time</label>
              <input type="time" value={editForm.time} onChange={(e) => setEditForm((p) => ({ ...p, time: e.target.value }))} style={selectStyle} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>Duration</label>
              <select value={editForm.duration_min} onChange={(e) => setEditForm((p) => ({ ...p, duration_min: Number(e.target.value) }))} style={selectStyle}>
                <option value={15}>15 min</option>
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
                <option value={120}>2 hours</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>Rep</label>
              <select value={editForm.rep_id} onChange={(e) => setEditForm((p) => ({ ...p, rep_id: e.target.value }))} style={selectStyle}>
                <option value="">Unassigned</option>
                {salesReps.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>Location</label>
              <input type="text" value={editForm.location} onChange={(e) => setEditForm((p) => ({ ...p, location: e.target.value }))} style={{ ...selectStyle, width: "100%" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>Notes</label>
              <input type="text" value={editForm.notes} onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))} style={{ ...selectStyle, width: "100%" }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleSaveEdit} disabled={editSaving || !editForm.date || !editForm.time} style={{ ...btnStyle, background: COLORS.neonBlue, color: "#000", borderColor: COLORS.neonBlue, fontWeight: 600, opacity: (editSaving || !editForm.date || !editForm.time) ? 0.5 : 1 }}>
              {editSaving ? "Saving..." : "Save"}
            </button>
            <button onClick={() => setEditingId(null)} style={btnStyle}>Cancel</button>
          </div>
        </div>
      );
    }

    return (
      <div
        key={a.id}
        style={{
          display: "grid",
          gridTemplateColumns: "1.5fr 1.2fr 0.8fr 0.8fr 0.7fr 0.6fr 1.2fr",
          gap: 12,
          padding: "14px 16px",
          borderBottom: "1px solid " + COLORS.cardBorder,
          alignItems: "center",
          opacity: isPast && a.status === "scheduled" ? 0.5 : 1,
        }}
      >
        <div>
          <div style={{ fontWeight: 600, color: COLORS.textPrimary, fontSize: 14 }}>
            {biz?.business_name || "Unknown"}
          </div>
          <div style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 2 }}>
            {a.location || biz?.address || "—"}
          </div>
        </div>
        <div>
          <div style={{ color: COLORS.neonBlue, fontWeight: 600, fontSize: 14 }}>
            {formatDate(a.scheduled_at)}
          </div>
          <div style={{ fontSize: 12, color: COLORS.textSecondary }}>
            {formatTime(a.scheduled_at)} · {DURATION_LABELS[a.duration_min] || a.duration_min + " min"}
          </div>
        </div>
        <div style={{ fontSize: 13, color: COLORS.textSecondary }}>
          {rep?.name || "Unassigned"}
        </div>
        <div>
          {biz?.phone ? (
            <a href={`tel:${biz.phone}`} style={{ color: COLORS.neonGreen, fontSize: 13, textDecoration: "none" }}>
              {biz.phone}
            </a>
          ) : (
            <span style={{ fontSize: 12, color: COLORS.textSecondary }}>—</span>
          )}
          {biz?.preview_business_id && (
            <div style={{ marginTop: 4 }}>
              <a
                href={`/preview/${biz.preview_business_id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-block",
                  padding: "2px 8px",
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 600,
                  background: `${COLORS.neonPurple}20`,
                  color: COLORS.neonPurple,
                  textDecoration: "none",
                  border: `1px solid ${COLORS.neonPurple}40`,
                }}
              >
                Preview
              </a>
            </div>
          )}
        </div>
        <div>
          <span style={{
            display: "inline-block",
            padding: "3px 10px",
            borderRadius: 12,
            fontSize: 11,
            fontWeight: 600,
            textTransform: "capitalize",
            background: statusColor + "18",
            color: statusColor,
          }}>
            {a.status.replace(/_/g, " ")}
          </span>
        </div>
        <div style={{ fontSize: 12, color: COLORS.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {a.notes || "—"}
        </div>
        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
          {a.status === "scheduled" && (
            <>
              <button onClick={() => openEdit(a)} title="Edit" style={{ ...btnStyle, color: COLORS.neonBlue, borderColor: COLORS.neonBlue + "50", padding: "4px 10px", fontSize: 12 }}>
                Edit
              </button>
              <button onClick={() => handleQuickStatus(a.id, "completed")} title="Mark complete" style={{ ...btnStyle, color: COLORS.neonGreen, borderColor: COLORS.neonGreen + "50", padding: "4px 10px", fontSize: 12 }}>
                Done
              </button>
              <button onClick={() => handleQuickStatus(a.id, "no_show")} title="No show" style={{ ...btnStyle, color: COLORS.neonOrange, borderColor: COLORS.neonOrange + "50", padding: "4px 10px", fontSize: 12 }}>
                No Show
              </button>
              <button onClick={() => handleQuickStatus(a.id, "cancelled")} title="Cancel" style={{ ...btnStyle, color: COLORS.neonRed, borderColor: COLORS.neonRed + "50", padding: "4px 10px", fontSize: 12 }}>
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Filters bar */}
      <Card>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          {/* View toggle */}
          <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: "1px solid " + COLORS.cardBorder }}>
            <button
              onClick={() => setViewMode("list")}
              style={{
                padding: "8px 16px", fontSize: 13, cursor: "pointer", border: "none",
                background: viewMode === "list" ? COLORS.neonBlue : "transparent",
                color: viewMode === "list" ? "#000" : COLORS.textSecondary,
                fontWeight: viewMode === "list" ? 600 : 400,
              }}
            >
              List
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              style={{
                padding: "8px 16px", fontSize: 13, cursor: "pointer", border: "none",
                background: viewMode === "calendar" ? COLORS.neonBlue : "transparent",
                color: viewMode === "calendar" ? "#000" : COLORS.textSecondary,
                fontWeight: viewMode === "calendar" ? 600 : 400,
              }}
            >
              Calendar
            </button>
          </div>

          <select value={filterRep} onChange={(e) => setFilterRep(e.target.value)} style={selectStyle}>
            <option value="all">All Reps</option>
            {salesReps.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>

          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={selectStyle}>
            <option value="upcoming">Upcoming</option>
            <option value="past">Past</option>
            <option value="all">All</option>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No Show</option>
          </select>

          <div style={{ marginLeft: "auto", fontSize: 13, color: COLORS.textSecondary }}>
            {sorted.length} appointment{sorted.length !== 1 ? "s" : ""}
          </div>
        </div>
      </Card>

      {/* List View */}
      {viewMode === "list" && (
        <Card>
          {/* Header */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1.5fr 1.2fr 0.8fr 0.8fr 0.7fr 0.6fr 1.2fr",
            gap: 12,
            padding: "10px 16px",
            borderBottom: "2px solid " + COLORS.cardBorder,
            fontSize: 11,
            fontWeight: 600,
            color: COLORS.textSecondary,
            textTransform: "uppercase",
          }}>
            <div>Business</div>
            <div>Date / Time</div>
            <div>Rep</div>
            <div>Phone / Preview</div>
            <div>Status</div>
            <div>Notes</div>
            <div style={{ textAlign: "right" }}>Actions</div>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary }}>Loading appointments...</div>
          ) : sorted.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary }}>
              No appointments found. Schedule one from a lead&#39;s detail drawer.
            </div>
          ) : (
            sorted.map(renderAppointmentRow)
          )}
        </Card>
      )}

      {/* Calendar View */}
      {viewMode === "calendar" && (
        <Card>
          {/* Month navigation */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <button
              onClick={() => setCalendarMonth(new Date(calYear, calMon - 1, 1))}
              style={btnStyle}
            >
              &larr;
            </button>
            <div style={{ fontSize: 18, fontWeight: 600, color: COLORS.textPrimary }}>
              {calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </div>
            <button
              onClick={() => setCalendarMonth(new Date(calYear, calMon + 1, 1))}
              style={btnStyle}
            >
              &rarr;
            </button>
          </div>

          {/* Weekday headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: COLORS.textSecondary, padding: 4 }}>{d}</div>
            ))}
          </div>

          {/* Day grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} style={{ minHeight: 70 }} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateKey = `${calYear}-${String(calMon + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const dayAppts = appointmentsByDate.get(dateKey) || [];
              const isToday = dateKey === now.toISOString().slice(0, 10);
              const isSelected = dateKey === selectedDay;

              return (
                <div
                  key={day}
                  onClick={() => setSelectedDay(isSelected ? null : dateKey)}
                  style={{
                    minHeight: 70,
                    padding: 6,
                    borderRadius: 8,
                    cursor: dayAppts.length > 0 ? "pointer" : "default",
                    border: isSelected ? `2px solid ${COLORS.neonBlue}` : isToday ? `1px solid ${COLORS.neonBlue}40` : `1px solid ${COLORS.cardBorder}`,
                    background: isSelected ? `${COLORS.neonBlue}10` : "transparent",
                  }}
                >
                  <div style={{
                    fontSize: 13,
                    fontWeight: isToday ? 700 : 400,
                    color: isToday ? COLORS.neonBlue : COLORS.textPrimary,
                    marginBottom: 4,
                  }}>
                    {day}
                  </div>
                  {dayAppts.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {dayAppts.slice(0, 3).map((a) => (
                        <div key={a.id} style={{
                          fontSize: 10,
                          padding: "2px 4px",
                          borderRadius: 4,
                          background: `${COLORS.neonBlue}20`,
                          color: COLORS.neonBlue,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}>
                          {formatTime(a.scheduled_at)} {a.sales_leads?.business_name?.slice(0, 12) || ""}
                        </div>
                      ))}
                      {dayAppts.length > 3 && (
                        <div style={{ fontSize: 10, color: COLORS.textSecondary }}>+{dayAppts.length - 3} more</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Selected day detail */}
          {selectedDay && (
            <div style={{ marginTop: 20, padding: 16, borderRadius: 12, border: "1px solid " + COLORS.neonBlue + "30", background: `${COLORS.neonBlue}05` }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 12 }}>
                {formatDateFull(selectedDay + "T00:00:00")}
              </div>
              {dayAppointments.length === 0 ? (
                <div style={{ fontSize: 13, color: COLORS.textSecondary }}>No appointments on this day.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {dayAppointments.map((a) => {
                    const rep = salesReps.find((r) => r.id === a.assigned_rep_id);
                    return (
                      <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8 }}>
                        <div>
                          <div style={{ fontWeight: 600, color: COLORS.textPrimary, fontSize: 14 }}>
                            {formatTime(a.scheduled_at)} — {a.sales_leads?.business_name || "Unknown"}
                          </div>
                          <div style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 2 }}>
                            {DURATION_LABELS[a.duration_min]} · {rep?.name || "Unassigned"}{a.location ? ` · ${a.location}` : ""}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => handleQuickStatus(a.id, "completed")} style={{ ...btnStyle, color: COLORS.neonGreen, borderColor: COLORS.neonGreen + "50", padding: "4px 10px", fontSize: 12 }}>Done</button>
                          <button onClick={() => handleQuickStatus(a.id, "no_show")} style={{ ...btnStyle, color: COLORS.neonOrange, borderColor: COLORS.neonOrange + "50", padding: "4px 10px", fontSize: 12 }}>No Show</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
