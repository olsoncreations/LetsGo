"use client";

import React, { useEffect, useState, useCallback } from "react";
import { logAudit, AUDIT_TABS } from "@/lib/auditLog";
import {
  COLORS,
  Card,
  StatCard,
  SectionTitle,
  DataTable,
  Badge,
  PreviewModal,
  formatMoney,
  formatDateTime,
} from "@/components/admin/components";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

// ==================== TYPES ====================
interface Receipt {
  id: string;
  user_id: string;
  business_id: string;
  business_name?: string;
  receipt_total_cents: number | null;
  payout_cents: number | null;
  payout_tier_index: number | null;
  payout_tier_label: string | null;
  photo_url: string | null;
  status: string;
  visit_date: string | null;
  created_at: string;
  rejected_at?: string;
  rejected_by?: string;
  reject_reason?: string;
}

interface Business {
  id: string;
  name: string | null;
  public_business_name: string | null;
}

interface PendingFilters {
  search: string;
  business: string;
  datePreset: string;
  dateFrom: string;
  dateTo: string;
}

interface HistoryFilters {
  search: string;
  status: string;
  business: string;
  datePreset: string;
  dateFrom: string;
  dateTo: string;
}

// ==================== RECEIPTS PAGE ====================
export default function ReceiptsPage() {
  // Data
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Selections
  const [selectedReceipts, setSelectedReceipts] = useState<string[]>([]);
  
  // Filters
  const [pendingFilters, setPendingFilters] = useState<PendingFilters>({
    search: "",
    business: "all",
    datePreset: "all",
    dateFrom: "",
    dateTo: "",
  });
  
  const [historyFilters, setHistoryFilters] = useState<HistoryFilters>({
    search: "",
    status: "all",
    business: "all",
    datePreset: "all",
    dateFrom: "",
    dateTo: "",
  });
  
  // UI State
  const [showRejectedSection, setShowRejectedSection] = useState(false);
  const [showBatchRejectModal, setShowBatchRejectModal] = useState(false);
  const [batchRejectReason, setBatchRejectReason] = useState("");
  const [rejectingReceipt, setRejectingReceipt] = useState<Receipt | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [preview, setPreview] = useState<{ url: string; title?: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Derived data (case-insensitive status matching)
  // Admin pending queue = receipts that business has approved, awaiting LetsGo final approval
  const pendingReceipts = receipts.filter(r => r.status?.toLowerCase() === "business_approved");
  // Also show raw "pending" receipts (user submitted, not yet reviewed by business) in a separate count
  const userPendingReceipts = receipts.filter(r => r.status?.toLowerCase() === "pending");
  const rejectedReceipts = receipts.filter(r => r.status?.toLowerCase() === "rejected");
  const allReceipts = receipts;

  // Fetch data via server API (bypasses RLS)
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      const res = await fetch("/api/admin/receipts", {
        headers: { Authorization: `Bearer ${session?.access_token || ""}` },
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: "Failed to load receipts" }));
        throw new Error(errBody.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setReceipts(data.receipts || []);
      setBusinesses(data.businesses || []);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter pending receipts
  const filteredPending = pendingReceipts.filter(r => {
    if (pendingFilters.search) {
      const search = pendingFilters.search.toLowerCase();
      if (!r.user_id?.toLowerCase().includes(search) && 
          !r.business_name?.toLowerCase().includes(search)) {
        return false;
      }
    }
    if (pendingFilters.business !== "all" && r.business_name !== pendingFilters.business) {
      return false;
    }
    if (pendingFilters.datePreset === "today") {
      const today = new Date().toDateString();
      if (new Date(r.created_at).toDateString() !== today) return false;
    }
    if (pendingFilters.datePreset === "week") {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      if (new Date(r.created_at) < weekAgo) return false;
    }
    if (pendingFilters.datePreset === "custom") {
      const d = new Date(r.created_at);
      if (pendingFilters.dateFrom && d < new Date(pendingFilters.dateFrom)) return false;
      if (pendingFilters.dateTo && d > new Date(pendingFilters.dateTo + "T23:59:59")) return false;
    }
    return true;
  });

  // Filter history
  const filteredHistory = allReceipts.filter(r => {
    if (historyFilters.search) {
      const search = historyFilters.search.toLowerCase();
      if (!r.user_id?.toLowerCase().includes(search) && 
          !r.business_name?.toLowerCase().includes(search)) {
        return false;
      }
    }
    if (historyFilters.status !== "all" && r.status.toLowerCase() !== historyFilters.status) {
      return false;
    }
    if (historyFilters.business !== "all" && r.business_name !== historyFilters.business) {
      return false;
    }
    if (historyFilters.datePreset === "today") {
      const today = new Date().toDateString();
      if (new Date(r.created_at).toDateString() !== today) return false;
    }
    if (historyFilters.datePreset === "week") {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      if (new Date(r.created_at) < weekAgo) return false;
    }
    if (historyFilters.datePreset === "month") {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      if (new Date(r.created_at) < monthAgo) return false;
    }
    if (historyFilters.datePreset === "custom") {
      const d = new Date(r.created_at);
      if (historyFilters.dateFrom && d < new Date(historyFilters.dateFrom)) return false;
      if (historyFilters.dateTo && d > new Date(historyFilters.dateTo + "T23:59:59")) return false;
    }
    return true;
  });

  // Helper: update receipt statuses via server API (bypasses RLS)
  const updateReceiptStatus = async (ids: string[], status: string): Promise<boolean> => {
    try {
      const { data: { session: sess } } = await supabaseBrowser.auth.getSession();
      const res = await fetch("/api/admin/receipts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sess?.access_token || ""}` },
        body: JSON.stringify({ ids, status }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: "Failed to update" }));
        throw new Error(errBody.error || `HTTP ${res.status}`);
      }
      return true;
    } catch (err) {
      console.error("Error updating receipts:", err);
      return false;
    }
  };

  // Actions
  const approveReceipt = async (id: string) => {
    setActionLoading(true);
    try {
      const ok = await updateReceiptStatus([id], "approved");
      if (!ok) throw new Error("Failed to approve");

      const receipt = receipts.find(r => r.id === id);
      logAudit({ action: "approve_receipt", tab: AUDIT_TABS.RECEIPTS, subTab: "Final Approval", targetType: "receipt", targetId: id, entityName: receipt?.business_name || "", fieldName: "status", oldValue: "business_approved", newValue: "approved", details: `Amount: ${formatMoney(receipt?.receipt_total_cents)}, Payout: ${formatMoney(receipt?.payout_cents)}` });

      setReceipts(prev => prev.map(r => r.id === id ? { ...r, status: "approved" } : r));
      setSelectedReceipts(prev => prev.filter(rid => rid !== id));
    } catch (err) {
      console.error("Error approving:", err);
      alert("Error approving receipt");
    } finally {
      setActionLoading(false);
    }
  };

  const rejectReceipt = async (id: string, reason: string) => {
    setActionLoading(true);
    try {
      const ok = await updateReceiptStatus([id], "rejected");
      if (!ok) throw new Error("Failed to reject");

      const receipt = receipts.find(r => r.id === id);
      logAudit({ action: "reject_receipt", tab: AUDIT_TABS.RECEIPTS, subTab: "Final Approval", targetType: "receipt", targetId: id, entityName: receipt?.business_name || "", fieldName: "status", oldValue: "business_approved", newValue: "rejected", details: `Amount: ${formatMoney(receipt?.receipt_total_cents)}, Reason: ${reason}` });

      setReceipts(prev => prev.map(r => r.id === id ? {
        ...r,
        status: "rejected",
        rejected_at: new Date().toISOString(),
        reject_reason: reason,
      } : r));
      setSelectedReceipts(prev => prev.filter(rid => rid !== id));
      setRejectingReceipt(null);
      setRejectReason("");
    } catch (err) {
      console.error("Error rejecting:", err);
      alert("Error rejecting receipt");
    } finally {
      setActionLoading(false);
    }
  };

  const batchApprove = async () => {
    setActionLoading(true);
    try {
      const ok = await updateReceiptStatus(selectedReceipts, "approved");
      if (!ok) throw new Error("Failed to approve");

      logAudit({ action: "batch_approve_receipts", tab: AUDIT_TABS.RECEIPTS, subTab: "Final Approval", targetType: "receipt", fieldName: "status", oldValue: "business_approved", newValue: "approved", details: `Approved ${selectedReceipts.length} receipts` });

      setReceipts(prev => prev.map(r =>
        selectedReceipts.includes(r.id) ? { ...r, status: "approved" } : r
      ));
      setSelectedReceipts([]);
    } catch (err) {
      console.error("Error batch approving:", err);
      alert("Error approving receipts");
    } finally {
      setActionLoading(false);
    }
  };

  const batchReject = async () => {
    if (!batchRejectReason) {
      alert("Please select a rejection reason");
      return;
    }
    setActionLoading(true);
    try {
      const ok = await updateReceiptStatus(selectedReceipts, "rejected");
      if (!ok) throw new Error("Failed to reject");

      logAudit({ action: "batch_reject_receipts", tab: AUDIT_TABS.RECEIPTS, subTab: "Final Approval", targetType: "receipt", fieldName: "status", oldValue: "business_approved", newValue: "rejected", details: `Rejected ${selectedReceipts.length} receipts, Reason: ${batchRejectReason}` });

      setReceipts(prev => prev.map(r =>
        selectedReceipts.includes(r.id) ? {
          ...r,
          status: "rejected",
          rejected_at: new Date().toISOString(),
          reject_reason: batchRejectReason,
        } : r
      ));
      setSelectedReceipts([]);
      setShowBatchRejectModal(false);
      setBatchRejectReason("");
    } catch (err) {
      console.error("Error batch rejecting:", err);
      alert("Error rejecting receipts");
    } finally {
      setActionLoading(false);
    }
  };

  const restoreReceipt = async (id: string) => {
    setActionLoading(true);
    try {
      const ok = await updateReceiptStatus([id], "pending");
      if (!ok) throw new Error("Failed to restore");

      const receipt = receipts.find(r => r.id === id);
      logAudit({ action: "restore_receipt", tab: AUDIT_TABS.RECEIPTS, subTab: "Rejected Receipts", targetType: "receipt", targetId: id, entityName: receipt?.business_name || "", fieldName: "status", oldValue: "rejected", newValue: "pending", details: `Restored to pending, Amount: ${formatMoney(receipt?.receipt_total_cents)}` });

      setReceipts(prev => prev.map(r => r.id === id ? { ...r, status: "pending" } : r));
    } catch (err) {
      console.error("Error restoring:", err);
      alert("Error restoring receipt");
    } finally {
      setActionLoading(false);
    }
  };

  // Get unique business names for filter
  const uniqueBusinesses = [...new Set(receipts.map(r => r.business_name).filter(Boolean))];

  if (loading) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.textSecondary }}>
        Loading receipts...
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 32 }}>
      {/* Preview Modal */}
      <PreviewModal preview={preview} onClose={() => setPreview(null)} />

      {/* Reject Single Modal */}
      {rejectingReceipt && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1001,
          }}
          onClick={() => setRejectingReceipt(null)}
        >
          <div
            style={{
              background: COLORS.cardBg,
              borderRadius: 20,
              padding: 32,
              width: 500,
              maxWidth: "90%",
              border: "1px solid " + COLORS.cardBorder,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>✗ Reject Receipt</h2>
            <p style={{ color: COLORS.textSecondary, marginBottom: 24 }}>
              Rejecting receipt from <strong>{rejectingReceipt.business_name}</strong>
            </p>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase", fontWeight: 600 }}>
                Rejection Reason
              </label>
              <select
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                style={{
                  width: "100%",
                  padding: 14,
                  background: COLORS.darkBg,
                  border: "1px solid " + COLORS.cardBorder,
                  borderRadius: 10,
                  color: COLORS.textPrimary,
                  fontSize: 14,
                }}
              >
                <option value="">Select a reason...</option>
                <option value="blurry_image">Blurry/Unreadable Image</option>
                <option value="wrong_date">Receipt Date Doesn&apos;t Match</option>
                <option value="duplicate">Duplicate Submission</option>
                <option value="wrong_business">Wrong Business</option>
                <option value="suspected_fraud">Suspected Fraud</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                onClick={() => { setRejectingReceipt(null); setRejectReason(""); }}
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
                onClick={() => rejectReceipt(rejectingReceipt.id, rejectReason)}
                disabled={!rejectReason || actionLoading}
                style={{
                  padding: "12px 24px",
                  background: "linear-gradient(135deg, #ff3131, #990000)",
                  border: "none",
                  borderRadius: 10,
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: 700,
                  opacity: !rejectReason ? 0.5 : 1,
                }}
              >
                ✗ Reject Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Reject Modal */}
      {showBatchRejectModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1001,
          }}
          onClick={() => setShowBatchRejectModal(false)}
        >
          <div
            style={{
              background: COLORS.cardBg,
              borderRadius: 20,
              padding: 32,
              width: 500,
              maxWidth: "90%",
              border: "1px solid " + COLORS.cardBorder,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>✗ Batch Reject Receipts</h2>
            <p style={{ color: COLORS.textSecondary, marginBottom: 24 }}>
              You are about to reject <strong style={{ color: COLORS.neonRed }}>{selectedReceipts.length} receipts</strong>.
            </p>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase", fontWeight: 600 }}>
                Rejection Reason (applies to all)
              </label>
              <select
                value={batchRejectReason}
                onChange={(e) => setBatchRejectReason(e.target.value)}
                style={{
                  width: "100%",
                  padding: 14,
                  background: COLORS.darkBg,
                  border: "1px solid " + COLORS.cardBorder,
                  borderRadius: 10,
                  color: COLORS.textPrimary,
                  fontSize: 14,
                }}
              >
                <option value="">Select a reason...</option>
                <option value="blurry_image">Blurry/Unreadable Image</option>
                <option value="wrong_date">Receipt Date Doesn&apos;t Match</option>
                <option value="duplicate">Duplicate Submission</option>
                <option value="wrong_business">Wrong Business</option>
                <option value="suspected_fraud">Suspected Fraud</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                onClick={() => { setShowBatchRejectModal(false); setBatchRejectReason(""); }}
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
                onClick={batchReject}
                disabled={actionLoading}
                style={{
                  padding: "12px 24px",
                  background: "linear-gradient(135deg, #ff3131, #990000)",
                  border: "none",
                  borderRadius: 10,
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                ✗ Reject {selectedReceipts.length} Receipts
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <h1 style={{ fontSize: 32, fontWeight: 700 }}>🧾 Receipt Approval</h1>
        
        {/* Batch Actions */}
        {selectedReceipts.length > 0 && (
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{ fontWeight: 600, color: COLORS.neonPink }}>{selectedReceipts.length} selected</span>
            <button
              onClick={batchApprove}
              disabled={actionLoading}
              style={{
                padding: "10px 20px",
                background: COLORS.gradient2,
                color: "#000",
                border: "none",
                borderRadius: 8,
                fontWeight: 700,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              ✓ Approve All
            </button>
            <button
              onClick={() => setShowBatchRejectModal(true)}
              style={{
                padding: "10px 20px",
                background: "rgba(255,49,49,0.2)",
                color: COLORS.neonRed,
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              ✗ Reject All
            </button>
            <button
              onClick={() => setSelectedReceipts([])}
              style={{
                padding: "10px 20px",
                background: COLORS.darkBg,
                color: COLORS.textSecondary,
                border: "1px solid " + COLORS.cardBorder,
                borderRadius: 8,
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 20, marginBottom: 32 }}>
        <StatCard icon="⏳" value={pendingReceipts.length} label="Awaiting Final Approval" gradient={COLORS.gradient4} />
        <StatCard icon="📥" value={userPendingReceipts.length} label="User Submitted" gradient="linear-gradient(135deg, #bf5fff, #ff2d92)" />
        <StatCard icon="✅" value={receipts.filter(r => r.status?.toLowerCase() === "approved").length} label="Approved" gradient={COLORS.gradient2} />
        <StatCard icon="❌" value={rejectedReceipts.length} label="Rejected" gradient="linear-gradient(135deg, #ff3131, #990000)" />
        <StatCard icon="🧾" value={receipts.length} label="Total Receipts" gradient={COLORS.gradient1} />
      </div>

      {/* Pending Final Approval */}
      <SectionTitle icon="⏳">Business Approved — Awaiting LetsGo Final Approval ({filteredPending.length})</SectionTitle>

      {/* Pending Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="text"
          placeholder="Search pending..."
          value={pendingFilters.search}
          onChange={(e) => setPendingFilters((p) => ({ ...p, search: e.target.value }))}
          style={{
            padding: "10px 14px",
            border: "1px solid " + COLORS.cardBorder,
            borderRadius: 10,
            fontSize: 13,
            background: COLORS.darkBg,
            color: COLORS.textPrimary,
            minWidth: 180,
          }}
        />
        <select
          value={pendingFilters.business}
          onChange={(e) => setPendingFilters((p) => ({ ...p, business: e.target.value }))}
          style={{
            padding: "10px 14px",
            border: "1px solid " + COLORS.cardBorder,
            borderRadius: 10,
            fontSize: 13,
            background: COLORS.darkBg,
            color: COLORS.textPrimary,
          }}
        >
          <option value="all">All Businesses</option>
          {uniqueBusinesses.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <div style={{ display: "flex", gap: 6 }}>
          {[
            { key: "all", label: "All" },
            { key: "today", label: "Today" },
            { key: "week", label: "This Week" },
            { key: "custom", label: "Custom" },
          ].map((preset) => (
            <button
              key={preset.key}
              onClick={() => setPendingFilters((p) => ({ ...p, datePreset: preset.key }))}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 600,
                background: pendingFilters.datePreset === preset.key ? COLORS.gradient1 : COLORS.darkBg,
                color: pendingFilters.datePreset === preset.key ? "#fff" : COLORS.textSecondary,
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
        {pendingFilters.datePreset === "custom" && (
          <>
            <input
              type="date"
              value={pendingFilters.dateFrom}
              onChange={(e) => setPendingFilters((p) => ({ ...p, dateFrom: e.target.value }))}
              style={{
                padding: "8px 12px",
                border: "1px solid " + COLORS.cardBorder,
                borderRadius: 8,
                fontSize: 12,
                background: COLORS.darkBg,
                color: COLORS.textPrimary,
              }}
            />
            <span style={{ color: COLORS.textSecondary }}>to</span>
            <input
              type="date"
              value={pendingFilters.dateTo}
              onChange={(e) => setPendingFilters((p) => ({ ...p, dateTo: e.target.value }))}
              style={{
                padding: "8px 12px",
                border: "1px solid " + COLORS.cardBorder,
                borderRadius: 8,
                fontSize: 12,
                background: COLORS.darkBg,
                color: COLORS.textPrimary,
              }}
            />
          </>
        )}
      </div>

      {/* Pending Receipts Card */}
      <Card style={{ marginBottom: 32 }}>
        {/* Select All */}
        {filteredPending.length > 0 && (
          <div
            style={{
              padding: "12px 20px",
              borderBottom: "1px solid " + COLORS.cardBorder,
              background: COLORS.darkBg,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <input
              type="checkbox"
              checked={selectedReceipts.length === filteredPending.length && filteredPending.length > 0}
              onChange={(e) =>
                setSelectedReceipts(e.target.checked ? filteredPending.map((r) => r.id) : [])
              }
              style={{ width: 18, height: 18, accentColor: COLORS.neonPink }}
            />
            <span style={{ fontSize: 13, color: COLORS.textSecondary }}>Select all visible pending receipts</span>
          </div>
        )}

        {filteredPending.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary }}>
            🎉 No receipts pending approval
            {(pendingFilters.search || pendingFilters.business !== "all" || pendingFilters.datePreset !== "all") && " matching filters"}!
          </div>
        ) : (
          filteredPending.map((r, i, arr) => (
            <div
              key={r.id}
              style={{
                display: "flex",
                padding: 20,
                borderBottom: i < arr.length - 1 ? "1px solid " + COLORS.cardBorder : "none",
                gap: 20,
                alignItems: "center",
                background: selectedReceipts.includes(r.id) ? "rgba(255,45,146,0.05)" : "transparent",
              }}
            >
              {/* Checkbox */}
              <input
                type="checkbox"
                checked={selectedReceipts.includes(r.id)}
                onChange={(e) =>
                  setSelectedReceipts((prev) =>
                    e.target.checked ? [...prev, r.id] : prev.filter((id) => id !== r.id)
                  )
                }
                style={{ width: 20, height: 20, accentColor: COLORS.neonPink, flexShrink: 0 }}
              />

              {/* Image */}
              <div
                style={{
                  width: 80,
                  height: 100,
                  borderRadius: 10,
                  overflow: "hidden",
                  cursor: "pointer",
                  border: "2px solid " + COLORS.cardBorder,
                  flexShrink: 0,
                  background: COLORS.darkBg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onClick={() => r.photo_url && setPreview({ url: r.photo_url })}
              >
                {r.photo_url ? (
                  <img
                    src={r.photo_url}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <span style={{ fontSize: 24 }}>🧾</span>
                )}
              </div>

              {/* Info */}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 15 }}>
                  User {r.user_id?.slice(0, 8)}... → {r.business_name}
                </div>
                <div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 6 }}>
                  Submitted: {formatDateTime(r.created_at)}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Badge status={r.status} />
                </div>
              </div>

              {/* Amounts */}
              <div style={{ textAlign: "right", marginRight: 16 }}>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{formatMoney(r.receipt_total_cents)}</div>
                <div style={{ fontSize: 14, color: COLORS.neonGreen, fontWeight: 600 }}>
                  Payout: {formatMoney(r.payout_cents)}
                </div>
                {r.payout_tier_label && (
                  <div style={{ fontSize: 11, color: COLORS.textSecondary }}>{r.payout_tier_label}</div>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button
                  onClick={() => approveReceipt(r.id)}
                  disabled={actionLoading}
                  style={{
                    padding: "10px 20px",
                    background: COLORS.gradient2,
                    color: "#000",
                    border: "none",
                    borderRadius: 8,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  ✓ Approve
                </button>
                <button
                  onClick={() => setRejectingReceipt(r)}
                  style={{
                    padding: "10px 20px",
                    background: "rgba(255,49,49,0.2)",
                    color: COLORS.neonRed,
                    border: "none",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  ✗ Reject
                </button>
                {r.photo_url && (
                  <button
                    onClick={() => setPreview({ url: r.photo_url!, title: `Receipt from ${r.business_name}` })}
                    style={{
                      padding: "10px 20px",
                      background: COLORS.darkBg,
                      color: COLORS.textSecondary,
                      border: "1px solid " + COLORS.cardBorder,
                      borderRadius: 8,
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    👁 View
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </Card>

      {/* Rejected Receipts Section */}
      <div style={{ marginBottom: 32 }}>
        <div
          onClick={() => setShowRejectedSection(!showRejectedSection)}
          style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", marginBottom: 16 }}
        >
          <SectionTitle icon="❌">Recently Rejected ({rejectedReceipts.length})</SectionTitle>
          <span style={{ color: COLORS.textSecondary, fontSize: 20 }}>{showRejectedSection ? "▼" : "▶"}</span>
        </div>

        {showRejectedSection && (
          <Card>
            <div
              style={{
                padding: 16,
                background: "rgba(255,49,49,0.05)",
                borderBottom: "1px solid " + COLORS.cardBorder,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 20 }}>⚠️</span>
                <div>
                  <div style={{ fontWeight: 600, color: COLORS.neonOrange }}>Rejected Receipts</div>
                  <div style={{ fontSize: 12, color: COLORS.textSecondary }}>
                    These receipts were rejected. You can restore them to pending status for re-review.
                  </div>
                </div>
              </div>
            </div>
            {rejectedReceipts.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary }}>
                No rejected receipts
              </div>
            ) : (
              rejectedReceipts.map((r, i) => (
                <div
                  key={r.id}
                  style={{
                    display: "flex",
                    padding: 20,
                    borderBottom: i < rejectedReceipts.length - 1 ? "1px solid " + COLORS.cardBorder : "none",
                    gap: 20,
                    alignItems: "center",
                  }}
                >
                  {/* Image */}
                  <div
                    style={{
                      width: 80,
                      height: 100,
                      borderRadius: 10,
                      overflow: "hidden",
                      cursor: "pointer",
                      border: "2px solid " + COLORS.neonRed,
                      flexShrink: 0,
                      opacity: 0.7,
                      background: COLORS.darkBg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    onClick={() => r.photo_url && setPreview({ url: r.photo_url })}
                  >
                    {r.photo_url ? (
                      <img
                        src={r.photo_url}
                        alt=""
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <span style={{ fontSize: 24 }}>🧾</span>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 15 }}>
                      User {r.user_id?.slice(0, 8)}... → {r.business_name}
                    </div>
                    <div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 4 }}>
                      Submitted: {formatDateTime(r.created_at)}
                    </div>
                    {r.rejected_at && (
                      <div style={{ fontSize: 12, color: COLORS.neonRed, marginBottom: 4 }}>
                        Rejected: {formatDateTime(r.rejected_at)}
                      </div>
                    )}
                    {r.reject_reason && (
                      <div
                        style={{
                          fontSize: 12,
                          padding: "6px 10px",
                          background: "rgba(255,49,49,0.1)",
                          borderRadius: 6,
                          color: COLORS.neonRed,
                          display: "inline-block",
                        }}
                      >
                        <strong>Reason:</strong> {r.reject_reason}
                      </div>
                    )}
                  </div>

                  {/* Amounts */}
                  <div style={{ textAlign: "right", marginRight: 16 }}>
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        textDecoration: "line-through",
                        color: COLORS.textSecondary,
                      }}
                    >
                      {formatMoney(r.receipt_total_cents)}
                    </div>
                    <div style={{ fontSize: 12, color: COLORS.textSecondary }}>
                      Would be: {formatMoney(r.payout_cents)}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <button
                      onClick={() => restoreReceipt(r.id)}
                      disabled={actionLoading}
                      style={{
                        padding: "10px 20px",
                        background: "rgba(57,255,20,0.2)",
                        border: "1px solid " + COLORS.neonGreen,
                        color: COLORS.neonGreen,
                        borderRadius: 8,
                        fontWeight: 600,
                        cursor: "pointer",
                        fontSize: 12,
                      }}
                    >
                      ↩️ Restore
                    </button>
                    {r.photo_url && (
                      <button
                        onClick={() => setPreview({ url: r.photo_url!, title: `Receipt ${r.id}` })}
                        style={{
                          padding: "10px 20px",
                          background: COLORS.darkBg,
                          border: "1px solid " + COLORS.cardBorder,
                          color: COLORS.textSecondary,
                          borderRadius: 8,
                          cursor: "pointer",
                          fontSize: 12,
                        }}
                      >
                        Details
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </Card>
        )}
      </div>

      {/* Receipt History */}
      <SectionTitle icon="📜">Receipt History</SectionTitle>

      {/* History Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Search user or business..."
          value={historyFilters.search}
          onChange={(e) => setHistoryFilters((p) => ({ ...p, search: e.target.value }))}
          style={{
            padding: "10px 14px",
            border: "1px solid " + COLORS.cardBorder,
            borderRadius: 10,
            fontSize: 13,
            background: COLORS.darkBg,
            color: COLORS.textPrimary,
            minWidth: 200,
          }}
        />
        <select
          value={historyFilters.status}
          onChange={(e) => setHistoryFilters((p) => ({ ...p, status: e.target.value }))}
          style={{
            padding: "10px 14px",
            border: "1px solid " + COLORS.cardBorder,
            borderRadius: 10,
            fontSize: 13,
            background: COLORS.darkBg,
            color: COLORS.textPrimary,
          }}
        >
          <option value="all">All Status</option>
          <option value="approved">Approved</option>
          <option value="pending">Pending</option>
          <option value="rejected">Rejected</option>
        </select>
        <select
          value={historyFilters.business}
          onChange={(e) => setHistoryFilters((p) => ({ ...p, business: e.target.value }))}
          style={{
            padding: "10px 14px",
            border: "1px solid " + COLORS.cardBorder,
            borderRadius: 10,
            fontSize: 13,
            background: COLORS.darkBg,
            color: COLORS.textPrimary,
          }}
        >
          <option value="all">All Businesses</option>
          {uniqueBusinesses.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
      </div>

      {/* Date Range Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: COLORS.textSecondary, fontWeight: 600 }}>📅 DATE RANGE:</span>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { key: "all", label: "All Time" },
            { key: "today", label: "Today" },
            { key: "week", label: "This Week" },
            { key: "month", label: "This Month" },
            { key: "custom", label: "Custom" },
          ].map((preset) => (
            <button
              key={preset.key}
              onClick={() => setHistoryFilters((p) => ({ ...p, datePreset: preset.key }))}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 600,
                background: historyFilters.datePreset === preset.key ? COLORS.gradient1 : COLORS.darkBg,
                color: historyFilters.datePreset === preset.key ? "#fff" : COLORS.textSecondary,
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
        {historyFilters.datePreset === "custom" && (
          <>
            <input
              type="date"
              value={historyFilters.dateFrom}
              onChange={(e) => setHistoryFilters((p) => ({ ...p, dateFrom: e.target.value }))}
              style={{
                padding: "8px 12px",
                border: "1px solid " + COLORS.cardBorder,
                borderRadius: 8,
                fontSize: 12,
                background: COLORS.darkBg,
                color: COLORS.textPrimary,
              }}
            />
            <span style={{ color: COLORS.textSecondary }}>to</span>
            <input
              type="date"
              value={historyFilters.dateTo}
              onChange={(e) => setHistoryFilters((p) => ({ ...p, dateTo: e.target.value }))}
              style={{
                padding: "8px 12px",
                border: "1px solid " + COLORS.cardBorder,
                borderRadius: 8,
                fontSize: 12,
                background: COLORS.darkBg,
                color: COLORS.textPrimary,
              }}
            />
          </>
        )}
      </div>

      {/* History Table */}
      <Card>
        <DataTable
          columns={[
            {
              key: "user_id",
              label: "User",
              render: (v: unknown) => (
                <span style={{ fontWeight: 600 }}>{String(v).slice(0, 8)}...</span>
              ),
            },
            { key: "business_name", label: "Business" },
            {
              key: "receipt_total_cents",
              label: "Amount",
              align: "right" as const,
              render: (v: unknown) => <span style={{ fontWeight: 600 }}>{formatMoney(v as number)}</span>,
            },
            {
              key: "payout_cents",
              label: "Payout",
              align: "right" as const,
              render: (v: unknown) => (
                <span style={{ color: COLORS.neonGreen, fontWeight: 600 }}>{formatMoney(v as number)}</span>
              ),
            },
            {
              key: "payout_tier_label",
              label: "Tier",
              align: "center" as const,
              render: (v: unknown) =>
                v ? (
                  <span style={{ padding: "4px 8px", background: COLORS.darkBg, borderRadius: 4, fontSize: 11 }}>
                    {String(v)}
                  </span>
                ) : (
                  "—"
                ),
            },
            {
              key: "created_at",
              label: "Submitted",
              render: (v: unknown) => <span style={{ fontSize: 12 }}>{formatDateTime(v as string)}</span>,
            },
            {
              key: "status",
              label: "Status",
              render: (v: unknown) => <Badge status={String(v)} />,
            },
            {
              key: "photo_url",
              label: "",
              align: "center" as const,
              render: (v: unknown) =>
                v ? (
                  <button
                    onClick={() => setPreview({ url: v as string })}
                    style={{
                      padding: "6px 12px",
                      background: COLORS.darkBg,
                      border: "1px solid " + COLORS.cardBorder,
                      borderRadius: 6,
                      color: COLORS.textSecondary,
                      cursor: "pointer",
                      fontSize: 11,
                    }}
                  >
                    👁 View
                  </button>
                ) : null,
            },
          ]}
          data={filteredHistory}
        />
      </Card>
    </div>
  );
}