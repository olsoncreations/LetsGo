"use client";

import React, { useEffect, useState, useCallback } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import {
  COLORS,
  Badge,
  Card,
  StatCard,
  DataTable,
  ExportButtons,
  formatDate,
} from "@/components/admin/components";
import { logAudit, AUDIT_TABS } from "@/lib/auditLog";

// ==================== TYPES ====================
interface Ticket {
  id: string;
  subject: string;
  body: string;
  user_id: string | null;
  business_id: string | null;
  category: string;
  priority: "urgent" | "high" | "medium" | "low";
  status: "open" | "in_progress" | "escalated" | "resolved";
  assigned_to: string | null; // UUID of staff member
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
  attachment_url: string | null;
  // Resolved via client-side join
  user_name: string;
  user_email: string;
  business_name: string;
  assigned_to_name: string;
}

interface StaffMember {
  user_id: string;
  name: string;
  role: string;
}

// ==================== SUPPORT PAGE ====================
export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [supportTab, setSupportTab] = useState("tickets");
  const [ticketFilters, setTicketFilters] = useState({ search: "", status: "all", category: "all", priority: "all" });
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [showResolveForm, setShowResolveForm] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch tickets
      const { data: ticketRows, error } = await supabaseBrowser
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // 2. Fetch staff members for assignment dropdown + resolving assigned_to names
      const { data: staffRows } = await supabaseBrowser
        .from("staff_users")
        .select("user_id, name, role");

      const staff: StaffMember[] = (staffRows || []).map(s => ({
        user_id: s.user_id,
        name: s.name || "Staff",
        role: s.role || "agent",
      }));
      setStaffMembers(staff);

      // Build lookup maps
      const staffMap = new Map(staff.map(s => [s.user_id, s]));

      // 3. Collect unique user_ids and business_ids from tickets
      const userIds = [...new Set((ticketRows || []).map(t => t.user_id).filter(Boolean))];
      const businessIds = [...new Set((ticketRows || []).map(t => t.business_id).filter(Boolean))];

      // 4. Fetch profiles for user names
      let profileMap = new Map<string, { full_name: string; email: string }>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabaseBrowser
          .from("profiles")
          .select("id, full_name, first_name, last_name, email")
          .in("id", userIds);

        profileMap = new Map((profiles || []).map(p => [
          p.id,
          {
            full_name: p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unknown User",
            email: p.email || "",
          },
        ]));
      }

      // 5. Fetch business names
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

      // 6. Map tickets with resolved names
      const mappedTickets: Ticket[] = (ticketRows || []).map(t => {
        const profile = t.user_id ? profileMap.get(t.user_id) : null;
        const staffMember = t.assigned_to ? staffMap.get(t.assigned_to) : null;

        return {
          id: t.id,
          subject: t.subject || "",
          body: t.body || "",
          user_id: t.user_id,
          business_id: t.business_id,
          category: t.category || "general",
          priority: t.priority || "medium",
          status: t.status || "open",
          assigned_to: t.assigned_to,
          resolved_by: t.resolved_by,
          resolved_at: t.resolved_at,
          resolution_notes: t.resolution_notes,
          created_at: t.created_at,
          updated_at: t.updated_at || t.created_at,
          user_name: profile?.full_name || "Unknown User",
          user_email: profile?.email || "",
          business_name: t.business_id ? businessMap.get(t.business_id) || "Unknown Business" : "",
          assigned_to_name: staffMember?.name || "",
          attachment_url: t.attachment_url || null,
        };
      });

      setTickets(mappedTickets);
    } catch (err) {
      console.error("Error fetching tickets:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredTickets = tickets.filter(t => {
    if (ticketFilters.search && !t.subject.toLowerCase().includes(ticketFilters.search.toLowerCase()) && !t.id.toLowerCase().includes(ticketFilters.search.toLowerCase())) return false;
    if (ticketFilters.status !== "all" && t.status !== ticketFilters.status) return false;
    if (ticketFilters.category !== "all" && t.category !== ticketFilters.category) return false;
    if (ticketFilters.priority !== "all" && t.priority !== ticketFilters.priority) return false;
    return true;
  });

  const assignTicket = async (ticketId: string, staffUserId: string) => {
    setAssigning(true);
    try {
      const { error } = await supabaseBrowser
        .from("support_tickets")
        .update({ assigned_to: staffUserId, status: "in_progress", updated_at: new Date().toISOString() })
        .eq("id", ticketId);

      if (error) throw error;

      const staffMember = staffMembers.find(s => s.user_id === staffUserId);

      logAudit({
        action: "assign_ticket",
        tab: AUDIT_TABS.SUPPORT,
        subTab: "Tickets",
        targetType: "support_ticket",
        targetId: ticketId,
        entityName: selectedTicket?.subject || "",
        fieldName: "assigned_to",
        oldValue: selectedTicket?.assigned_to || "unassigned",
        newValue: staffMember?.name || staffUserId,
        details: `Assigned ticket to ${staffMember?.name || staffUserId} and set status to in_progress`,
      });

      setTickets(prev => prev.map(t =>
        t.id === ticketId
          ? { ...t, assigned_to: staffUserId, assigned_to_name: staffMember?.name || "", status: "in_progress" as const }
          : t
      ));

      setShowAssignModal(false);
      setSelectedTicket(null);
    } catch (err) {
      console.error("Error assigning ticket:", err);
      alert("Failed to assign ticket. Please try again.");
    } finally {
      setAssigning(false);
    }
  };

  const resolveTicket = async (ticketId: string, notes: string) => {
    setResolving(true);
    try {
      const { error } = await supabaseBrowser
        .from("support_tickets")
        .update({
          status: "resolved",
          resolution_notes: notes || null,
          resolved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", ticketId);

      if (error) throw error;

      logAudit({
        action: "resolve_ticket",
        tab: AUDIT_TABS.SUPPORT,
        subTab: "Tickets",
        targetType: "support_ticket",
        targetId: ticketId,
        entityName: selectedTicket?.subject || "",
        fieldName: "status",
        oldValue: selectedTicket?.status || "open",
        newValue: "resolved",
        details: notes ? `Resolution: ${notes}` : "Resolved without notes",
      });

      setTickets(prev => prev.map(t =>
        t.id === ticketId
          ? { ...t, status: "resolved" as const, resolution_notes: notes || null, resolved_at: new Date().toISOString() }
          : t
      ));

      setShowResolveForm(false);
      setResolutionNotes("");
      setShowViewModal(false);
      setSelectedTicket(null);
    } catch (err) {
      console.error("Error resolving ticket:", err);
      alert("Failed to resolve ticket. Please try again.");
    } finally {
      setResolving(false);
    }
  };

  const escalateTicket = async (ticketId: string) => {
    try {
      const { error } = await supabaseBrowser
        .from("support_tickets")
        .update({ status: "escalated", updated_at: new Date().toISOString() })
        .eq("id", ticketId);

      if (error) throw error;

      logAudit({
        action: "escalate_ticket",
        tab: AUDIT_TABS.SUPPORT,
        subTab: "Tickets",
        targetType: "support_ticket",
        targetId: ticketId,
        entityName: selectedTicket?.subject || "",
        fieldName: "status",
        oldValue: selectedTicket?.status || "open",
        newValue: "escalated",
      });

      setTickets(prev => prev.map(t =>
        t.id === ticketId ? { ...t, status: "escalated" as const } : t
      ));

      setShowViewModal(false);
      setSelectedTicket(null);
    } catch (err) {
      console.error("Error escalating ticket:", err);
      alert("Failed to escalate ticket.");
    }
  };

  const reopenTicket = async (ticketId: string) => {
    try {
      const { error } = await supabaseBrowser
        .from("support_tickets")
        .update({ status: "open", resolution_notes: null, resolved_at: null, updated_at: new Date().toISOString() })
        .eq("id", ticketId);

      if (error) throw error;

      logAudit({
        action: "reopen_ticket",
        tab: AUDIT_TABS.SUPPORT,
        subTab: "Tickets",
        targetType: "support_ticket",
        targetId: ticketId,
        entityName: selectedTicket?.subject || "",
        fieldName: "status",
        oldValue: "resolved",
        newValue: "open",
      });

      setTickets(prev => prev.map(t =>
        t.id === ticketId ? { ...t, status: "open" as const, resolution_notes: null, resolved_at: null } : t
      ));

      setShowViewModal(false);
      setSelectedTicket(null);
    } catch (err) {
      console.error("Error reopening ticket:", err);
      alert("Failed to reopen ticket.");
    }
  };

  if (loading) return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.textSecondary }}>Loading support data...</div>;

  return (
    <div style={{ flex: 1, padding: 32, overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, background: COLORS.gradient1, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>🎫 Support & Communication Center</h1>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {[
          { key: "tickets", label: "🎫 Tickets", count: tickets.filter(t => t.status === "open" || t.status === "escalated").length },
          { key: "reports", label: "🚨 User Reports", count: 0 },
          { key: "announcements", label: "📢 Announcements", count: 0 },
          { key: "knowledge", label: "📚 Knowledge Base", count: 0 },
        ].map(tab => (
          <button key={tab.key} onClick={() => setSupportTab(tab.key)} style={{ padding: "12px 20px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: supportTab === tab.key ? COLORS.gradient1 : COLORS.cardBg, color: supportTab === tab.key ? "#fff" : COLORS.textSecondary, display: "flex", alignItems: "center", gap: 8 }}>
            {tab.label}
            <span style={{ padding: "2px 8px", borderRadius: 6, background: supportTab === tab.key ? "rgba(255,255,255,0.2)" : COLORS.darkBg, fontSize: 11 }}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* TICKETS TAB */}
      {supportTab === "tickets" && (
        <>
          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
            <StatCard icon="📬" value={tickets.filter(t => t.status === "open").length.toString()} label="Open" gradient={COLORS.gradient1} />
            <StatCard icon="🔄" value={tickets.filter(t => t.status === "in_progress").length.toString()} label="In Progress" gradient={COLORS.gradient2} />
            <StatCard icon="🚨" value={tickets.filter(t => t.status === "escalated").length.toString()} label="Escalated" gradient="linear-gradient(135deg, #ff3131, #ff6b35)" />
            <StatCard icon="✅" value={tickets.filter(t => t.status === "resolved").length.toString()} label="Resolved" gradient={COLORS.gradient2} />
          </div>

          {/* Filters */}
          <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
            <input type="text" placeholder="Search tickets..." value={ticketFilters.search} onChange={e => setTicketFilters({ ...ticketFilters, search: e.target.value })} style={{ flex: 1, padding: "12px 14px", border: "1px solid " + COLORS.cardBorder, borderRadius: 10, fontSize: 13, background: COLORS.cardBg, color: COLORS.textPrimary }} />
            <select value={ticketFilters.status} onChange={e => setTicketFilters({ ...ticketFilters, status: e.target.value })} style={{ padding: "12px 16px", border: "1px solid " + COLORS.cardBorder, borderRadius: 10, fontSize: 13, background: COLORS.cardBg, color: COLORS.textPrimary }}>
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="escalated">Escalated</option>
              <option value="resolved">Resolved</option>
            </select>
            <select value={ticketFilters.category} onChange={e => setTicketFilters({ ...ticketFilters, category: e.target.value })} style={{ padding: "12px 16px", border: "1px solid " + COLORS.cardBorder, borderRadius: 10, fontSize: 13, background: COLORS.cardBg, color: COLORS.textPrimary }}>
              <option value="all">All Categories</option>
              <option value="payout">Payout</option>
              <option value="receipt">Receipt</option>
              <option value="account">Account</option>
              <option value="billing">Billing</option>
            </select>
            <select value={ticketFilters.priority} onChange={e => setTicketFilters({ ...ticketFilters, priority: e.target.value })} style={{ padding: "12px 16px", border: "1px solid " + COLORS.cardBorder, borderRadius: 10, fontSize: 13, background: COLORS.cardBg, color: COLORS.textPrimary }}>
              <option value="all">All Priority</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <ExportButtons data={filteredTickets.map(t => ({ ID: t.id, Subject: t.subject, User: t.user_name || t.business_name, Category: t.category, Priority: t.priority, Status: t.status, Assigned: t.assigned_to_name || "Unassigned", Created: formatDate(t.created_at) })) as unknown as Record<string, unknown>[]} filename="tickets" />
          </div>

          {/* Tickets List */}
          <Card>
            {filteredTickets.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary }}>No tickets found</div>
            ) : (
              <DataTable
                columns={[
                  { key: "id", label: "ID", render: (v) => <span style={{ fontFamily: "monospace", color: COLORS.neonBlue }}>{String(v).slice(0, 8)}</span> },
                  { key: "subject", label: "Subject", render: (v, row) => {
                    const t = row as unknown as Ticket;
                    return (
                      <div>
                        <div style={{ fontWeight: 600 }}>{String(v)}</div>
                        <div style={{ fontSize: 11, color: COLORS.textSecondary }}>{t.user_name || t.business_name}</div>
                      </div>
                    );
                  }},
                  { key: "category", label: "Category", render: (v) => <span style={{ textTransform: "capitalize" }}>{String(v)}</span> },
                  { key: "priority", label: "Priority", render: (v) => (
                    <span style={{ padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 600, background: String(v) === "urgent" ? COLORS.neonRed : String(v) === "high" ? COLORS.neonOrange : String(v) === "medium" ? COLORS.neonYellow : COLORS.cardBorder, color: String(v) === "urgent" || String(v) === "high" ? "#fff" : String(v) === "medium" ? "#000" : COLORS.textSecondary }}>{String(v)}</span>
                  )},
                  { key: "status", label: "Status", render: (v) => <Badge status={String(v) === "in_progress" ? "pending" : String(v) === "escalated" ? "suspended" : String(v)} /> },
                  { key: "assigned_to_name", label: "Assigned", render: (v) => {
                    return v ? (
                      <span style={{ padding: "4px 10px", background: "rgba(57,255,20,0.2)", borderRadius: 6, fontSize: 11, color: COLORS.neonGreen }}>{String(v)}</span>
                    ) : (
                      <span style={{ color: COLORS.textSecondary, fontSize: 11 }}>Unassigned</span>
                    );
                  }},
                  { key: "created_at", label: "Created", render: (v) => formatDate(String(v)) },
                  { key: "id", label: "", align: "right", render: (v, row) => {
                    const t = row as unknown as Ticket;
                    return (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => { setSelectedTicket(t); setShowAssignModal(true); }} style={{ padding: "6px 12px", background: COLORS.gradient1, border: "none", borderRadius: 6, color: "#fff", cursor: "pointer", fontSize: 10, fontWeight: 600 }}>Assign</button>
                        <button onClick={() => { setSelectedTicket(t); setShowViewModal(true); }} style={{ padding: "6px 12px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 6, color: COLORS.textSecondary, cursor: "pointer", fontSize: 10, fontWeight: 600 }}>View</button>
                      </div>
                    );
                  }},
                ]}
                data={filteredTickets as unknown as Record<string, unknown>[]}
              />
            )}
          </Card>
        </>
      )}

      {/* Other tabs - placeholder */}
      {supportTab === "reports" && <Card><div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary }}>User Reports - Coming soon</div></Card>}
      {supportTab === "announcements" && <Card><div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary }}>Announcements - Coming soon</div></Card>}
      {supportTab === "knowledge" && <Card><div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary }}>Knowledge Base - Coming soon</div></Card>}

      {/* View Ticket Modal */}
      {showViewModal && selectedTicket && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1001 }} onClick={() => setShowViewModal(false)}>
          <div style={{ background: COLORS.cardBg, borderRadius: 20, padding: 32, width: 640, maxWidth: "95%", maxHeight: "85vh", overflowY: "auto", border: "1px solid " + COLORS.cardBorder }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{selectedTicket.subject}</h2>
                <div style={{ fontSize: 12, color: COLORS.textSecondary, fontFamily: "monospace" }}>ID: {selectedTicket.id}</div>
              </div>
              <button onClick={() => setShowViewModal(false)} style={{ background: "none", border: "none", fontSize: 24, color: COLORS.textSecondary, cursor: "pointer" }}>×</button>
            </div>

            {/* Status Row */}
            <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
              <Badge status={selectedTicket.status === "in_progress" ? "pending" : selectedTicket.status === "escalated" ? "suspended" : selectedTicket.status} />
              <span style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: selectedTicket.priority === "urgent" ? COLORS.neonRed : selectedTicket.priority === "high" ? COLORS.neonOrange : COLORS.cardBorder, color: selectedTicket.priority === "urgent" || selectedTicket.priority === "high" ? "#fff" : COLORS.textSecondary }}>{selectedTicket.priority}</span>
              <span style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: "rgba(0,212,255,0.15)", color: COLORS.neonBlue, textTransform: "capitalize" }}>{selectedTicket.category}</span>
            </div>

            {/* Details Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
              <div style={{ padding: 16, background: COLORS.darkBg, borderRadius: 12 }}>
                <div style={{ fontSize: 10, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>Submitted By</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{selectedTicket.user_name}</div>
                {selectedTicket.user_email && <div style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 2 }}>{selectedTicket.user_email}</div>}
              </div>
              <div style={{ padding: 16, background: COLORS.darkBg, borderRadius: 12 }}>
                <div style={{ fontSize: 10, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>Business</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{selectedTicket.business_name || "N/A"}</div>
                {selectedTicket.business_id && <div style={{ fontSize: 11, color: COLORS.textSecondary, fontFamily: "monospace", marginTop: 2 }}>{selectedTicket.business_id.slice(0, 12)}...</div>}
              </div>
              <div style={{ padding: 16, background: COLORS.darkBg, borderRadius: 12 }}>
                <div style={{ fontSize: 10, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>Created</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{formatDate(selectedTicket.created_at)}</div>
              </div>
              <div style={{ padding: 16, background: COLORS.darkBg, borderRadius: 12 }}>
                <div style={{ fontSize: 10, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>Assigned To</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{selectedTicket.assigned_to_name || "Unassigned"}</div>
              </div>
            </div>

            {/* Message Body */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 10, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>Message</div>
              <div style={{ padding: 20, background: COLORS.darkBg, borderRadius: 12, fontSize: 14, lineHeight: 1.7, color: COLORS.textPrimary, whiteSpace: "pre-wrap" }}>
                {selectedTicket.body}
              </div>
            </div>

            {/* Attachment */}
            {selectedTicket.attachment_url && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 10, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>Attachment</div>
                <a href={selectedTicket.attachment_url} target="_blank" rel="noopener noreferrer">
                  <img src={selectedTicket.attachment_url} alt="Ticket attachment" style={{ maxWidth: "100%", maxHeight: 300, borderRadius: 12, cursor: "pointer", border: "1px solid " + COLORS.cardBorder }} />
                </a>
              </div>
            )}

            {/* Resolution Notes (if resolved) */}
            {selectedTicket.resolution_notes && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 10, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>Resolution Notes</div>
                <div style={{ padding: 20, background: "rgba(57,255,20,0.08)", border: "1px solid rgba(57,255,20,0.2)", borderRadius: 12, fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                  {selectedTicket.resolution_notes}
                </div>
              </div>
            )}

            {/* Resolve Form (shown when clicking Resolve) */}
            {showResolveForm && selectedTicket.status !== "resolved" && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 10, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>Resolution Notes</div>
                <textarea
                  value={resolutionNotes}
                  onChange={e => setResolutionNotes(e.target.value)}
                  placeholder="Describe how this ticket was resolved..."
                  rows={4}
                  style={{
                    width: "100%",
                    padding: 14,
                    background: COLORS.darkBg,
                    border: "1px solid " + COLORS.cardBorder,
                    borderRadius: 10,
                    color: COLORS.textPrimary,
                    fontSize: 14,
                    resize: "vertical",
                    marginBottom: 12,
                  }}
                />
                <div style={{ display: "flex", gap: 12 }}>
                  <button
                    onClick={() => { setShowResolveForm(false); setResolutionNotes(""); }}
                    style={{ flex: 1, padding: "10px 16px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, cursor: "pointer", fontWeight: 600 }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => resolveTicket(selectedTicket.id, resolutionNotes)}
                    disabled={resolving}
                    style={{ flex: 1, padding: "10px 16px", background: "linear-gradient(135deg, #39ff14, #00d4ff)", border: "none", borderRadius: 8, color: "#000", cursor: resolving ? "not-allowed" : "pointer", fontWeight: 700 }}
                  >
                    {resolving ? "Resolving..." : "Confirm Resolve"}
                  </button>
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button onClick={() => setShowViewModal(false)} style={{ padding: "12px 20px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, cursor: "pointer", fontWeight: 600 }}>Close Modal</button>
              <button onClick={() => { setShowViewModal(false); setShowAssignModal(true); }} style={{ padding: "12px 20px", background: COLORS.gradient1, border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontWeight: 700 }}>
                {selectedTicket.assigned_to ? "Reassign" : "Assign"}
              </button>
              {selectedTicket.status !== "resolved" && !showResolveForm && (
                <>
                  <button
                    onClick={() => setShowResolveForm(true)}
                    style={{ padding: "12px 20px", background: "linear-gradient(135deg, #39ff14, #00d4ff)", border: "none", borderRadius: 10, color: "#000", cursor: "pointer", fontWeight: 700 }}
                  >
                    Resolve Ticket
                  </button>
                  {selectedTicket.status !== "escalated" && (
                    <button
                      onClick={() => escalateTicket(selectedTicket.id)}
                      style={{ padding: "12px 20px", background: "rgba(255,49,49,0.2)", border: "1px solid " + COLORS.neonRed, borderRadius: 10, color: COLORS.neonRed, cursor: "pointer", fontWeight: 700 }}
                    >
                      Escalate
                    </button>
                  )}
                </>
              )}
              {selectedTicket.status === "resolved" && (
                <button
                  onClick={() => reopenTicket(selectedTicket.id)}
                  style={{ padding: "12px 20px", background: "rgba(255,107,53,0.2)", border: "1px solid " + COLORS.neonOrange, borderRadius: 10, color: COLORS.neonOrange, cursor: "pointer", fontWeight: 700 }}
                >
                  Reopen Ticket
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssignModal && selectedTicket && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1001 }} onClick={() => setShowAssignModal(false)}>
          <div style={{ background: COLORS.cardBg, borderRadius: 20, padding: 32, width: 500, maxWidth: "95%", border: "1px solid " + COLORS.cardBorder }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Assign Ticket</h2>
                <div style={{ fontSize: 13, color: COLORS.textSecondary }}>{selectedTicket.id.slice(0, 8)}: {selectedTicket.subject}</div>
              </div>
              <button onClick={() => setShowAssignModal(false)} style={{ background: "none", border: "none", fontSize: 24, color: COLORS.textSecondary, cursor: "pointer" }}>×</button>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase", fontWeight: 600 }}>Assign to Staff Member</label>
              <select id="assignSelect" defaultValue={selectedTicket.assigned_to || ""} style={{ width: "100%", padding: 14, background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, fontSize: 14 }}>
                <option value="">-- Select Staff Member --</option>
                {staffMembers.map(s => (
                  <option key={s.user_id} value={s.user_id}>{s.name} ({s.role})</option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setShowAssignModal(false)} style={{ flex: 1, padding: "12px 20px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, cursor: "pointer", fontWeight: 600 }}>Cancel</button>
              <button
                disabled={assigning}
                onClick={() => {
                  const select = document.getElementById("assignSelect") as HTMLSelectElement;
                  if (select.value) assignTicket(selectedTicket.id, select.value);
                  else alert("Please select a staff member");
                }}
                style={{ flex: 1, padding: "12px 20px", background: assigning ? COLORS.cardBorder : COLORS.gradient1, border: "none", borderRadius: 10, color: "#fff", cursor: assigning ? "not-allowed" : "pointer", fontWeight: 700 }}
              >
                {assigning ? "Assigning..." : "Assign Ticket"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
