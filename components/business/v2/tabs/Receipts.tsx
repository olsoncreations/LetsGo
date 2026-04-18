// components/business/v2/tabs/Receipts.tsx
// Wired to Supabase - reads from receipts and business_payout_tiers tables
"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import type { BusinessTabProps } from "@/components/business/v2/BusinessProfileV2";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { useIsMobile } from "@/lib/useIsMobile";
import {
  AlertCircle,
  Award,
  CheckCircle,
  Clock,
  DollarSign,
  Download,
  Edit2,
  Eye,
  RefreshCw,
  TrendingUp,
  X,
  XCircle,
} from "lucide-react";
import {
  fetchPlatformTierConfig,
  getVisitRangeShort,
  thresholdsToTierConfig,
  DEFAULT_VISIT_THRESHOLDS,
  DEFAULT_PRESET_BPS,
  type PlatformTierConfig,
  type TierConfigRow,
} from "@/lib/platformSettings";

// ============================================================================
// Types
// ============================================================================
type ReceiptStatus = "approved" | "business_approved" | "pending" | "disputed" | "rejected" | "Pending" | "Approved" | "Rejected" | "Disputed";

type ReceiptRow = {
  id: string;
  visibleId: string; // shortened display ID
  userId: string;
  userIdShort: string; // shortened for display
  visitDate: string;
  createdAt: Date;
  receiptTotalCents: number;
  payoutCents: number;
  payoutTierIndex: number | null;
  payoutPercentBps: number | null;
  payoutTierLabel: string | null;
  status: ReceiptStatus;
  photoUrl: string | null;
  businessApprovedAt: Date | null;
};

type TierRow = {
  level: number;
  label: string;
  minVisits: number;
  maxVisits: number | null;
  bps: number;
};

// ============================================================================
// Helpers
// ============================================================================
function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function money0(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

function bpsToPercent(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

function timeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  return date.toLocaleDateString();
}

function shortenId(id: string, len = 8): string {
  if (!id) return "—";
  if (id.length <= len) return id;
  return id.slice(0, len) + "…";
}

function normalizeStatus(s: string | null): ReceiptStatus {
  if (!s) return "pending";
  const lower = s.toLowerCase();
  if (lower === "approved") return "approved";
  if (lower === "business_approved") return "business_approved";
  if (lower === "rejected") return "rejected";
  if (lower === "disputed") return "disputed";
  return "pending";
}

// ============================================================================
// Status Badge Component
// ============================================================================
function StatusBadge({ status, colors }: { status: ReceiptStatus; colors: Record<string, string> }) {
  const normalized = normalizeStatus(status);
  const config: Record<string, { bg: string; fg: string; label?: string }> = {
    approved: { bg: `${colors.success}20`, fg: colors.success },
    business_approved: { bg: `${colors.accent}20`, fg: colors.accent, label: "Awaiting LetsGo" },
    pending: { bg: `${colors.warning}20`, fg: colors.warning },
    rejected: { bg: `${colors.danger}20`, fg: colors.danger },
    disputed: { bg: `${colors.purple}20`, fg: colors.purple },
  };
  const entry = config[normalized] || config.pending;

  return (
    <span
      style={{
        padding: "0.25rem 0.75rem",
        background: entry.bg,
        color: entry.fg,
        borderRadius: "6px",
        fontSize: "0.75rem",
        fontWeight: 600,
        textTransform: "capitalize",
      }}
    >
      {entry.label || normalized}
    </span>
  );
}

// ============================================================================
// Main Component
// ============================================================================
export default function Receipts({ businessId, isPremium }: BusinessTabProps) {
  const isMobile = useIsMobile();
  const colors = useMemo(
    () => ({
      primary: "#14b8a6",
      secondary: "#f97316",
      accent: "#06b6d4",
      success: "#10b981",
      warning: "#f59e0b",
      danger: "#ef4444",
      purple: "#a855f7",
    }),
    []
  );

  // ============================================================================
  // State
  // ============================================================================
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [tiers, setTiers] = useState<TierRow[]>([]);
  const [editableTierBps, setEditableTierBps] = useState<number[]>([]); // For editing
  const [isEditingTiers, setIsEditingTiers] = useState(false);
  const [tierSaving, setTierSaving] = useState(false);
  const [selectedReceipts, setSelectedReceipts] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [viewingReceipt, setViewingReceipt] = useState<ReceiptRow | null>(null);
  const [tierStructureLastChanged, setTierStructureLastChanged] = useState<Date | null>(null);
  const [tiersLoadedFromConfig, setTiersLoadedFromConfig] = useState(false); // True if we fell back to config
  const [payoutChangesThisYear, setPayoutChangesThisYear] = useState<number>(0);
  const [payoutChangeLimit, setPayoutChangeLimit] = useState<number>(1);
  const [platformConfig, setPlatformConfig] = useState<PlatformTierConfig>({
    visitThresholds: DEFAULT_VISIT_THRESHOLDS,
    presetBps: { ...DEFAULT_PRESET_BPS },
    defaultCashbackBps: [500, 750, 1000, 1250, 1500, 1750, 2000],
  });

  // Auto-approve settings
  const [autoApprovalEnabled, setAutoApprovalEnabled] = useState(false);
  const [autoApprovalMax, setAutoApprovalMax] = useState(50);
  const [autoApprovalSaving, setAutoApprovalSaving] = useState(false);
  const [isEditingAutoApproval, setIsEditingAutoApproval] = useState(false);
  const [editAutoApprovalEnabled, setEditAutoApprovalEnabled] = useState(false);
  const [editAutoApprovalMax, setEditAutoApprovalMax] = useState(50);

  // Duplicate-flagged receipt IDs (from fraud_alerts)
  const [duplicateReceiptIds, setDuplicateReceiptIds] = useState<Set<string>>(new Set());

  // Monthly statement
  const [statementMonth, setStatementMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [statementLoading, setStatementLoading] = useState(false);

  // Calculate remaining tier changes using the business table counter (same source as Admin page).
  // This ensures admin overrides don't count against the business's annual change limit.
  const tierChangesRemaining = useMemo(() => {
    return Math.max(0, payoutChangeLimit - payoutChangesThisYear);
  }, [payoutChangesThisYear, payoutChangeLimit]);

  // Default tier structure — from platform_settings (source of truth)
  const defaultTierConfig: TierConfigRow[] = useMemo(
    () => thresholdsToTierConfig(platformConfig.visitThresholds),
    [platformConfig.visitThresholds],
  );

  // Stats computed from data
  const stats = useMemo(() => {
    const pending = receipts.filter((r) => normalizeStatus(r.status) === "pending");
    const businessApproved = receipts.filter((r) => normalizeStatus(r.status) === "business_approved");
    const approved = receipts.filter((r) => normalizeStatus(r.status) === "approved");
    const allApproved = [...businessApproved, ...approved]; // anything the business has approved
    const thisMonth = receipts.filter((r) => {
      const d = new Date(r.createdAt);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    return {
      pendingCount: pending.length,
      pendingDollars: pending.reduce((sum, r) => sum + r.receiptTotalCents, 0),
      approvedCount: allApproved.length,
      approvedDollars: allApproved.reduce((sum, r) => sum + r.receiptTotalCents, 0),
      totalPayouts: allApproved.reduce((sum, r) => sum + (r.payoutCents || 0), 0),
      thisMonthCount: thisMonth.length,
      thisMonthDollars: thisMonth.reduce((sum, r) => sum + r.receiptTotalCents, 0),
      awaitingFinalCount: businessApproved.length,
    };
  }, [receipts]);

  // Split receipts by status
  const pendingReceipts = useMemo(
    () => receipts.filter((r) => normalizeStatus(r.status) === "pending"),
    [receipts]
  );

  // ============================================================================
  // Load Data
  // ============================================================================
  const loadData = useCallback(async () => {
    if (!businessId) return;

    setLoading(true);
    setLoadError(null);

    try {
      // Load receipts via server API (bypasses RLS)
      const { data: session } = await supabaseBrowser.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error("Authentication required");

      const res = await fetch(`/api/businesses/${businessId}/receipts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: "Failed to load receipts" }));
        throw new Error(errBody.error || `HTTP ${res.status}`);
      }
      const { receipts: receiptData } = await res.json();

      const mappedReceipts: ReceiptRow[] = (receiptData || []).map((r: any) => ({
        id: r.id,
        visibleId: `RCP-${shortenId(r.id, 6).toUpperCase()}`,
        userId: r.user_id || "",
        userIdShort: shortenId(r.user_id || "", 8),
        visitDate: r.visit_date || "",
        createdAt: new Date(r.created_at),
        receiptTotalCents: r.receipt_total_cents || 0,
        payoutCents: r.payout_cents || 0,
        payoutTierIndex: r.payout_tier_index,
        payoutPercentBps: r.payout_percent_bps,
        payoutTierLabel: r.payout_tier_label,
        status: r.status || "pending",
        photoUrl: r.photo_url,
        businessApprovedAt: r.business_approved_at ? new Date(r.business_approved_at) : null,
      }));

      setReceipts(mappedReceipts);

      // Load duplicate fraud alerts for this business's receipts
      const receiptIds = mappedReceipts.map((r) => r.id);
      if (receiptIds.length > 0) {
        const { data: fraudAlerts } = await supabaseBrowser
          .from("fraud_alerts")
          .select("receipt_id")
          .eq("business_id", businessId)
          .eq("alert_type", "duplicate_receipt")
          .in("receipt_id", receiptIds);
        if (fraudAlerts && fraudAlerts.length > 0) {
          setDuplicateReceiptIds(new Set(fraudAlerts.map((a: { receipt_id: string }) => a.receipt_id)));
        } else {
          setDuplicateReceiptIds(new Set());
        }
      }

      // Load payout tiers from table first, fall back to config.payoutBps
      // Also fetch the business's change counter and platform visit thresholds
      const [{ data: tierData, error: tierError }, { data: bizChangeData }, ptConfig] = await Promise.all([
        supabaseBrowser
          .from("business_payout_tiers")
          .select("*")
          .eq("business_id", businessId)
          .order("tier_index", { ascending: true }),
        supabaseBrowser
          .from("business")
          .select("payout_changes_this_year, payout_change_limit, auto_approval_enabled, auto_approval_max")
          .eq("id", businessId)
          .maybeSingle(),
        fetchPlatformTierConfig(supabaseBrowser),
      ]);

      // Set change counter from business table (aligned with Admin page)
      setPayoutChangesThisYear((bizChangeData?.payout_changes_this_year as number) ?? 0);
      setPayoutChangeLimit((bizChangeData?.payout_change_limit as number) ?? 1);

      // Set auto-approval settings
      const aaEnabled = (bizChangeData?.auto_approval_enabled as boolean) ?? false;
      const aaMax = (bizChangeData?.auto_approval_max as number) ?? 50;
      setAutoApprovalEnabled(aaEnabled);
      setAutoApprovalMax(aaMax);
      setEditAutoApprovalEnabled(aaEnabled);
      setEditAutoApprovalMax(aaMax);
      setPlatformConfig(ptConfig);

      let loadedTiers: TierRow[] = [];
      let loadedBps: number[] = [];
      let fromConfig = false;

      if (!tierError && tierData && tierData.length > 0) {
        // Use tiers from table
        loadedTiers = tierData.map((t: any, idx: number) => ({
          level: t.tier_index ?? idx + 1,
          label: t.label || `Level ${t.tier_index ?? idx + 1}`,
          minVisits: t.min_visits ?? defaultTierConfig[idx]?.minVisits ?? 0,
          maxVisits: t.max_visits ?? defaultTierConfig[idx]?.maxVisits,
          bps: t.bps ?? t.percent_bps ?? 0,
        }));
        loadedBps = loadedTiers.map(t => t.bps);

        // Find the most recent updated_at to determine last structure change
        const updatedDates = tierData
          .map((t: any) => t.updated_at)
          .filter((d: any) => d != null)
          .map((d: any) => new Date(d));
        
        if (updatedDates.length > 0) {
          const mostRecent = new Date(Math.max(...updatedDates.map((d: Date) => d.getTime())));
          setTierStructureLastChanged(mostRecent);
        }
      } else {
        // Fall back to config.payoutBps, then payout_preset
        const { data: bizData, error: bizError } = await supabaseBrowser
          .from("business")
          .select("config, payout_preset")
          .eq("id", businessId)
          .maybeSingle();

        if (!bizError && bizData?.config) {
          const cfg = bizData.config as Record<string, unknown>;
          if (cfg.payoutBps && Array.isArray(cfg.payoutBps)) {
            fromConfig = true;
            loadedBps = (cfg.payoutBps as number[]).slice(0, 7);
            // Pad to 7 if needed
            while (loadedBps.length < 7) {
              loadedBps.push(0);
            }
            loadedTiers = defaultTierConfig.map((t, idx) => ({
              ...t,
              bps: loadedBps[idx] ?? 0,
            }));
          }
        }

        // If still no tiers, use business's payout_preset → Standard (from platform_settings)
        if (loadedTiers.length === 0) {
          const bizPreset = String(bizData?.payout_preset || "standard");
          loadedBps = ptConfig.presetBps[bizPreset] || ptConfig.presetBps.standard;
          loadedTiers = defaultTierConfig.map((t, idx) => ({
            ...t,
            bps: loadedBps[idx],
          }));
        }
      }

      setTiers(loadedTiers);
      setEditableTierBps(loadedBps);
      setTiersLoadedFromConfig(fromConfig);
    } catch (e: any) {
      console.error("[Receipts] Load error:", e);
      setLoadError(e.message || "Failed to load receipts");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ============================================================================
  // Actions: Approve / Reject
  // ============================================================================
  async function handleApprove(receiptIds: string[]) {
    if (receiptIds.length === 0) return;
    setActionLoading(true);

    try {
      // Business approval sets to "business_approved" (pending LetsGo final approval)
      const { data: session } = await supabaseBrowser.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error("Authentication required");

      const res = await fetch(`/api/businesses/${businessId}/receipts`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ids: receiptIds, status: "business_approved" }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: "Failed to approve" }));
        throw new Error(errBody.error || `HTTP ${res.status}`);
      }

      // Refresh data
      await loadData();
      setSelectedReceipts([]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(`Failed to approve: ${msg}`);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject(receiptIds: string[]) {
    if (receiptIds.length === 0) return;
    setActionLoading(true);

    try {
      const { data: session } = await supabaseBrowser.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error("Authentication required");

      const res = await fetch(`/api/businesses/${businessId}/receipts`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ids: receiptIds, status: "rejected" }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: "Failed to reject" }));
        // Handle 30-day dispute window expiry
        if (res.status === 403 && errBody.error === "Dispute window closed") {
          alert(errBody.message || "The 30-day dispute window has passed for one or more receipts.");
          return;
        }
        throw new Error(errBody.error || `HTTP ${res.status}`);
      }

      await loadData();
      setSelectedReceipts([]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(`Failed to reject: ${msg}`);
    } finally {
      setActionLoading(false);
    }
  }

  // ============================================================================
  // Save Tier Structure
  // ============================================================================
  async function handleSaveTiers() {
    if (tierChangesRemaining <= 0) {
      alert("You have already changed your payout structure this year. Changes are limited to once per calendar year.");
      return;
    }

    const confirmChange = window.confirm(
      "Are you sure you want to save these changes?\n\n" +
      "⚠️ You can only change your payout structure ONCE per calendar year.\n\n" +
      "This action cannot be undone until next year."
    );

    if (!confirmChange) return;

    setTierSaving(true);

    try {
      const now = new Date().toISOString();

      // Prepare tier rows
      const tierRows = defaultTierConfig.map((t, idx) => ({
        business_id: businessId,
        tier_index: idx + 1,
        level: t.level,
        label: t.label,
        min_visits: t.minVisits,
        max_visits: t.maxVisits,
        bps: editableTierBps[idx] ?? 0,
        percent_bps: editableTierBps[idx] ?? 0, // Keep both columns in sync
        is_active: true,
        updated_at: now,
      }));

      // Delete existing tiers for this business
      const { error: deleteError } = await supabaseBrowser
        .from("business_payout_tiers")
        .delete()
        .eq("business_id", businessId);

      if (deleteError) throw deleteError;

      // Insert new tiers
      const { error: insertError } = await supabaseBrowser
        .from("business_payout_tiers")
        .insert(tierRows);

      if (insertError) throw insertError;

      // Sync payout_tiers column + config.payoutBps so Discovery/Swipe/5v3v1 pages stay in sync.
      // Also increment payout_changes_this_year so this counts against the business's annual limit.
      const bpsArray = editableTierBps.slice(0, 7);
      const { data: bizRow } = await supabaseBrowser
        .from("business")
        .select("config, payout_changes_this_year")
        .eq("id", businessId)
        .maybeSingle();
      const existingConfig = ((bizRow?.config as Record<string, unknown>) ?? {});
      const currentChanges = (bizRow?.payout_changes_this_year as number) ?? 0;
      await supabaseBrowser
        .from("business")
        .update({
          payout_tiers: bpsArray,
          config: { ...existingConfig, payoutBps: bpsArray },
          payout_changes_this_year: currentChanges + 1,
        })
        .eq("id", businessId);

      // Reload data
      await loadData();
      setIsEditingTiers(false);
      alert("Payout structure saved successfully!");
    } catch (e: any) {
      console.error("[Receipts] Save tiers error:", e);
      alert(`Failed to save: ${e.message}`);
    } finally {
      setTierSaving(false);
    }
  }

  function handleCancelEditTiers() {
    // Reset to current saved values
    setEditableTierBps(tiers.map(t => t.bps));
    setIsEditingTiers(false);
  }

  // ============================================================================
  // Auto-Approve Settings
  // ============================================================================
  async function handleSaveAutoApproval() {
    setAutoApprovalSaving(true);
    try {
      const { error } = await supabaseBrowser
        .from("business")
        .update({
          auto_approval_enabled: editAutoApprovalEnabled,
          auto_approval_max: editAutoApprovalEnabled ? editAutoApprovalMax : autoApprovalMax,
        })
        .eq("id", businessId);

      if (error) throw error;

      setAutoApprovalEnabled(editAutoApprovalEnabled);
      if (editAutoApprovalEnabled) setAutoApprovalMax(editAutoApprovalMax);
      setIsEditingAutoApproval(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(`Failed to save auto-approval settings: ${msg}`);
    } finally {
      setAutoApprovalSaving(false);
    }
  }

  function handleCancelAutoApproval() {
    setEditAutoApprovalEnabled(autoApprovalEnabled);
    setEditAutoApprovalMax(autoApprovalMax);
    setIsEditingAutoApproval(false);
  }

  // ============================================================================
  // 30-Day Dispute Window Check
  // ============================================================================
  function isDisputeWindowClosed(receipt: ReceiptRow): boolean {
    if (!receipt.businessApprovedAt) return false;
    const now = new Date();
    const daysSince = (now.getTime() - receipt.businessApprovedAt.getTime()) / (1000 * 60 * 60 * 24);
    return daysSince > 30;
  }

  function disputeDaysRemaining(receipt: ReceiptRow): number | null {
    if (!receipt.businessApprovedAt) return null;
    const now = new Date();
    const daysSince = (now.getTime() - receipt.businessApprovedAt.getTime()) / (1000 * 60 * 60 * 24);
    return Math.max(0, Math.ceil(30 - daysSince));
  }

  // ============================================================================
  // Monthly Statement Download (XLSX)
  // ============================================================================
  async function handleDownloadStatement() {
    setStatementLoading(true);
    try {
      // Dynamically import xlsx
      const XLSX = await import("xlsx");

      const [year, month] = statementMonth.split("-").map(Number);
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59); // last day of month

      // Filter receipts for the selected month
      const monthReceipts = receipts.filter((r) => {
        const d = new Date(r.createdAt);
        return d >= startDate && d <= endDate;
      });

      const monthName = startDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

      // Build summary data
      const totalReceipts = monthReceipts.length;
      const totalSubtotal = monthReceipts.reduce((s, r) => s + r.receiptTotalCents, 0);
      const totalPayout = monthReceipts.reduce((s, r) => s + r.payoutCents, 0);
      const totalLetsGoFee = isPremium ? 0 : monthReceipts.reduce((s, r) => s + Math.min(Math.floor(r.receiptTotalCents * 0.10), 500), 0);
      const totalCCFee = monthReceipts.reduce((s, r) => s + Math.floor(r.receiptTotalCents * 0.035), 0);
      const approved = monthReceipts.filter((r) => ["approved", "business_approved"].includes(normalizeStatus(r.status)));
      const pending = monthReceipts.filter((r) => normalizeStatus(r.status) === "pending");
      const rejected = monthReceipts.filter((r) => normalizeStatus(r.status) === "rejected");

      // Summary sheet
      const summaryData = [
        ["Monthly Receipt Statement"],
        ["Business ID", businessId],
        ["Statement Period", monthName],
        ["Generated", new Date().toLocaleString()],
        [],
        ["Summary"],
        ["Total Receipts", totalReceipts],
        ["Approved", approved.length],
        ["Pending", pending.length],
        ["Rejected", rejected.length],
        [],
        ["Financial Summary"],
        ["Total Receipt Value", `$${(totalSubtotal / 100).toFixed(2)}`],
        ["Total Progressive Payouts", `$${(totalPayout / 100).toFixed(2)}`],
        ["Total LetsGo Fees (10%, $5 cap)", `$${(totalLetsGoFee / 100).toFixed(2)}`],
        ["Total CC Processing (3.5%)", `$${(totalCCFee / 100).toFixed(2)}`],
        ["Total Fees", `$${((totalPayout + totalLetsGoFee + totalCCFee) / 100).toFixed(2)}`],
      ];

      // Detail sheet
      const detailHeaders = [
        "Receipt ID", "Customer ID", "Visit Date", "Submitted",
        "Subtotal", "Progressive Payout", "LetsGo Fee", "CC Fee (3.5%)", "Total Fees",
        "Tier", "Payout Rate", "Status",
      ];
      const detailRows = monthReceipts.map((r) => {
        const letsGoFee = isPremium ? 0 : Math.min(Math.floor(r.receiptTotalCents * 0.10), 500);
        const ccFee = Math.floor(r.receiptTotalCents * 0.035);
        return [
          r.visibleId,
          r.userId,
          r.visitDate,
          r.createdAt.toLocaleDateString(),
          `$${(r.receiptTotalCents / 100).toFixed(2)}`,
          `$${(r.payoutCents / 100).toFixed(2)}`,
          `$${(letsGoFee / 100).toFixed(2)}`,
          `$${(ccFee / 100).toFixed(2)}`,
          `$${((r.payoutCents + letsGoFee + ccFee) / 100).toFixed(2)}`,
          r.payoutTierLabel || "—",
          r.payoutPercentBps ? `${(r.payoutPercentBps / 100).toFixed(2)}%` : "—",
          normalizeStatus(r.status),
        ];
      });

      // Create workbook with 2 sheets
      const wb = XLSX.utils.book_new();

      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      summarySheet["!cols"] = [{ wch: 30 }, { wch: 40 }];
      XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

      const detailSheet = XLSX.utils.aoa_to_sheet([detailHeaders, ...detailRows]);
      detailSheet["!cols"] = detailHeaders.map(() => ({ wch: 18 }));
      XLSX.utils.book_append_sheet(wb, detailSheet, "Receipts");

      // Download
      XLSX.writeFile(wb, `receipt-statement-${statementMonth}.xlsx`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(`Failed to generate statement: ${msg}`);
    } finally {
      setStatementLoading(false);
    }
  }

  function handleTierBpsChange(index: number, value: string) {
    // Parse as percentage, convert to bps
    const numVal = parseFloat(value);
    if (isNaN(numVal)) return;
    const bps = Math.round(numVal * 100); // 5.00% = 500 bps
    setEditableTierBps(prev => {
      const updated = [...prev];
      updated[index] = bps;
      return updated;
    });
  }

  function toggleSelectReceipt(id: string) {
    setSelectedReceipts((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleSelectAll(receiptList: ReceiptRow[]) {
    const allIds = receiptList.map((r) => r.id);
    const allSelected = allIds.every((id) => selectedReceipts.includes(id));
    if (allSelected) {
      setSelectedReceipts((prev) => prev.filter((id) => !allIds.includes(id)));
    } else {
      setSelectedReceipts((prev) => [...new Set([...prev, ...allIds])]);
    }
  }

  // ============================================================================
  // Download Handlers
  // ============================================================================
  function downloadCSV() {
    const headers = ["Receipt ID", "User ID", "Visit Date", "Total ($)", "Payout ($)", "Tier", "Status", "Created"];
    const rows = receipts.map((r) => [
      r.visibleId,
      r.userId,
      r.visitDate,
      (r.receiptTotalCents / 100).toFixed(2),
      (r.payoutCents / 100).toFixed(2),
      r.payoutTierLabel || "—",
      normalizeStatus(r.status),
      r.createdAt.toISOString(),
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipts-${businessId}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ============================================================================
  // Fallback Tiers (if none configured)
  // ============================================================================
  const displayTiers = useMemo(() => {
    if (tiers.length > 0) return tiers;
    // Default fallback — use visit thresholds from platform_settings + conservative BPS preset
    const fallbackBps = platformConfig.presetBps.conservative || DEFAULT_PRESET_BPS.conservative;
    return defaultTierConfig.map((t, idx) => ({
      level: t.level,
      label: t.label,
      minVisits: t.minVisits,
      maxVisits: t.maxVisits,
      bps: fallbackBps[idx] ?? 0,
    }));
  }, [tiers, defaultTierConfig, platformConfig.presetBps]);

  const tierColors = ["#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16", "#22c55e", "#10b981"];

  // ============================================================================
  // Styles
  // ============================================================================
  const cardStyle: React.CSSProperties = {
    background: "rgba(255, 255, 255, 0.03)",
    backdropFilter: "blur(20px)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "16px",
    padding: "2rem",
  };

  const statCardStyle: React.CSSProperties = {
    ...cardStyle,
    padding: "1.5rem",
    position: "relative",
    overflow: "hidden",
  };

  // ============================================================================
  // Render
  // ============================================================================
  if (loading) {
    return (
      <div style={{ ...cardStyle, textAlign: "center", color: "rgba(255,255,255,0.6)" }}>
        Loading receipts…
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ ...cardStyle, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
        <strong>Error:</strong> {loadError}
        <button
          onClick={loadData}
          style={{
            marginLeft: "1rem",
            padding: "0.5rem 1rem",
            background: colors.primary,
            border: "none",
            borderRadius: "6px",
            color: "white",
            cursor: "pointer",
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      {/* Stats Cards */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.5rem" }}>
        {[
          {
            icon: <Clock size={24} />,
            label: "Pending Review",
            value: stats.pendingCount.toString(),
            color: colors.warning,
          },
          {
            icon: <CheckCircle size={24} />,
            label: "Approved Today",
            value: receipts.filter((r) => {
              const d = new Date(r.createdAt);
              const now = new Date();
              return (normalizeStatus(r.status) === "approved" || normalizeStatus(r.status) === "business_approved")
                && d.toDateString() === now.toDateString();
            }).length.toString(),
            color: colors.success,
          },
          {
            icon: <TrendingUp size={24} />,
            label: "Total This Month",
            value: stats.thisMonthCount.toString(),
            color: colors.accent,
          },
          {
            icon: <RefreshCw size={24} />,
            label: "Avg Response Time",
            value: (() => {
              // Calculate avg time between receipt creation and approval
              const approvedWithTimes = receipts.filter(
                (r) => normalizeStatus(r.status) === "approved" || normalizeStatus(r.status) === "business_approved"
              );
              if (approvedWithTimes.length === 0) return "—";
              // Estimate: use time between visit_date and created_at as proxy
              const totalHours = approvedWithTimes.reduce((sum, r) => {
                const created = new Date(r.createdAt).getTime();
                const visit = r.visitDate ? new Date(r.visitDate).getTime() : created;
                return sum + Math.abs(created - visit) / 3600000;
              }, 0);
              const avg = totalHours / approvedWithTimes.length;
              if (avg < 1) return `${Math.round(avg * 60)} mins`;
              return `${avg.toFixed(1)} hrs`;
            })(),
            color: colors.purple,
          },
        ].map((stat, idx) => (
          <div key={idx} style={statCardStyle}>
            <div
              style={{
                position: "absolute",
                top: "-50%",
                right: "-20%",
                width: "150px",
                height: "150px",
                background: `radial-gradient(circle, ${stat.color}30 0%, transparent 70%)`,
                borderRadius: "50%",
              }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem", color: stat.color }}>
              {stat.icon}
              <span style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.6)" }}>{stat.label}</span>
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 700, fontFamily: '"Space Mono", monospace' }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Auto-Approve Settings */}
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div style={{ fontSize: "1.25rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <CheckCircle size={20} style={{ color: colors.accent }} />
            Auto-Approve Settings
          </div>
          {!isEditingAutoApproval ? (
            <button
              onClick={() => setIsEditingAutoApproval(true)}
              style={{
                padding: "0.5rem 1rem",
                background: `${colors.accent}20`,
                border: `1px solid ${colors.accent}`,
                borderRadius: "6px",
                color: colors.accent,
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <Edit2 size={14} /> Edit
            </button>
          ) : (
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                onClick={handleCancelAutoApproval}
                disabled={autoApprovalSaving}
                style={{
                  padding: "0.5rem 1rem",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: "6px",
                  color: "rgba(255,255,255,0.7)",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAutoApproval}
                disabled={autoApprovalSaving}
                style={{
                  padding: "0.5rem 1rem",
                  background: colors.success,
                  border: "none",
                  borderRadius: "6px",
                  color: "white",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: autoApprovalSaving ? "wait" : "pointer",
                }}
              >
                {autoApprovalSaving ? "Saving..." : "Save"}
              </button>
            </div>
          )}
        </div>

        <div
          style={{
            fontSize: "0.8rem",
            padding: "0.75rem 1rem",
            background: "rgba(6,182,212,0.08)",
            border: "1px solid rgba(6,182,212,0.2)",
            borderRadius: "8px",
            marginBottom: "1.25rem",
            color: "rgba(255,255,255,0.7)",
            display: "flex",
            alignItems: "flex-start",
            gap: "0.5rem",
          }}
        >
          <AlertCircle size={16} style={{ color: colors.accent, flexShrink: 0, marginTop: "0.1rem" }} />
          <span>
            When enabled, receipts under your threshold are automatically approved on your behalf.
            You can still dispute auto-approved receipts within <strong>30 days</strong> of approval.
          </span>
        </div>

        {isEditingAutoApproval ? (
          <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
              <div
                onClick={() => setEditAutoApprovalEnabled(!editAutoApprovalEnabled)}
                style={{
                  width: "48px",
                  height: "26px",
                  borderRadius: "13px",
                  background: editAutoApprovalEnabled ? colors.success : "rgba(255,255,255,0.15)",
                  position: "relative",
                  cursor: "pointer",
                  transition: "background 0.2s",
                }}
              >
                <div
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    background: "white",
                    position: "absolute",
                    top: "3px",
                    left: editAutoApprovalEnabled ? "25px" : "3px",
                    transition: "left 0.2s",
                  }}
                />
              </div>
              <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>
                {editAutoApprovalEnabled ? "Enabled" : "Disabled"}
              </span>
            </label>
            {editAutoApprovalEnabled && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.6)" }}>Auto-approve receipts under</span>
                <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                  <span style={{ fontSize: "1rem", fontWeight: 700 }}>$</span>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={editAutoApprovalMax}
                    onChange={(e) => setEditAutoApprovalMax(Math.max(1, Number(e.target.value) || 0))}
                    style={{
                      width: "90px",
                      padding: "0.5rem",
                      background: "rgba(255,255,255,0.1)",
                      border: "1px solid rgba(255,255,255,0.2)",
                      borderRadius: "6px",
                      color: "white",
                      fontSize: "1rem",
                      fontWeight: 700,
                      fontFamily: '"Space Mono", monospace',
                      textAlign: "center",
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  background: autoApprovalEnabled ? colors.success : colors.danger,
                }}
              />
              <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>
                {autoApprovalEnabled ? "Enabled" : "Disabled"}
              </span>
            </div>
            {autoApprovalEnabled && (
              <span style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.6)" }}>
                Receipts under <strong style={{ color: colors.success, fontFamily: '"Space Mono", monospace' }}>${autoApprovalMax}</strong> are auto-approved
              </span>
            )}
          </div>
        )}
      </div>

      {/* Pending Receipt Approvals - Card Layout */}
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "1.25rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <AlertCircle size={20} style={{ color: colors.warning }} />
            Pending Receipt Approvals
          </div>
          {selectedReceipts.length > 0 && (
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                onClick={() => handleApprove(selectedReceipts.filter((id) => pendingReceipts.some((r) => r.id === id)))}
                disabled={actionLoading}
                style={{
                  padding: "0.5rem 1rem",
                  background: colors.success,
                  border: "none",
                  borderRadius: "6px",
                  color: "white",
                  fontWeight: 600,
                  fontSize: "0.8rem",
                  cursor: actionLoading ? "wait" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <CheckCircle size={14} />
                Approve Selected ({selectedReceipts.filter((id) => pendingReceipts.some((r) => r.id === id)).length})
              </button>
              <button
                onClick={() => handleReject(selectedReceipts.filter((id) => pendingReceipts.some((r) => r.id === id)))}
                disabled={actionLoading}
                style={{
                  padding: "0.5rem 1rem",
                  background: colors.danger,
                  border: "none",
                  borderRadius: "6px",
                  color: "white",
                  fontWeight: 600,
                  fontSize: "0.8rem",
                  cursor: actionLoading ? "wait" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <XCircle size={14} />
                Deny Selected
              </button>
            </div>
          )}
        </div>

        {pendingReceipts.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2rem", color: "rgba(255,255,255,0.5)" }}>
            No pending receipts to review. New submissions will appear here.
          </div>
        ) : (
          <div style={{ display: "grid", gap: "1rem" }}>
            {pendingReceipts.map((r) => {
              const yourFee = r.payoutCents + (isPremium ? 0 : Math.min(Math.floor(r.receiptTotalCents * 0.10), 500));
              const tierLevel = r.payoutTierIndex != null ? r.payoutTierIndex + 1 : null;

              return (
                <div
                  key={r.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "1.25rem",
                    padding: "1.25rem",
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "12px",
                  }}
                >
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={selectedReceipts.includes(r.id)}
                    onChange={() => toggleSelectReceipt(r.id)}
                    style={{ width: "18px", height: "18px", cursor: "pointer", flexShrink: 0 }}
                  />

                  {/* Receipt Image Thumbnail */}
                  <div style={{ flexShrink: 0 }}>
                    {r.photoUrl ? (
                      <div style={{ position: "relative" }}>
                        <img
                          src={r.photoUrl}
                          alt="Receipt"
                          style={{
                            width: "120px",
                            height: "160px",
                            objectFit: "cover",
                            borderRadius: "8px",
                            border: "1px solid rgba(255,255,255,0.1)",
                          }}
                        />
                        <div style={{ display: "flex", justifyContent: "center", gap: "1rem", marginTop: "0.5rem" }}>
                          <button
                            onClick={() => setViewingReceipt(r)}
                            style={{
                              background: "none",
                              border: "none",
                              color: colors.accent,
                              fontSize: "0.7rem",
                              fontWeight: 600,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: "0.25rem",
                            }}
                          >
                            <Eye size={12} /> View
                          </button>
                          <a
                            href={r.photoUrl}
                            download
                            style={{
                              background: "none",
                              border: "none",
                              color: colors.accent,
                              fontSize: "0.7rem",
                              fontWeight: 600,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: "0.25rem",
                              textDecoration: "none",
                            }}
                          >
                            <Download size={12} /> Download
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          width: "120px",
                          height: "160px",
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: "8px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "rgba(255,255,255,0.3)",
                          fontSize: "0.75rem",
                        }}
                      >
                        No Image
                      </div>
                    )}
                  </div>

                  {/* Receipt Details */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
                      <span style={{ fontWeight: 700, fontSize: "1rem", fontFamily: '"Space Mono", monospace' }}>
                        {r.visibleId}
                      </span>
                      {duplicateReceiptIds.has(r.id) && (
                        <span
                          style={{
                            padding: "0.15rem 0.5rem",
                            background: `${colors.warning}20`,
                            color: colors.warning,
                            borderRadius: "4px",
                            fontSize: "0.65rem",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.25rem",
                          }}
                        >
                          <AlertCircle size={10} /> Possible Duplicate
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.8)", marginBottom: "0.25rem" }}>
                      Customer: <strong>{r.userIdShort}</strong>
                      {tierLevel != null && (
                        <span style={{ color: "rgba(255,255,255,0.5)" }}> (Level {tierLevel})</span>
                      )}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)", marginBottom: "0.75rem" }}>
                      Submitted: {timeAgo(r.createdAt)}
                    </div>
                    <div style={{ display: "flex", gap: "2rem" }}>
                      <div>
                        <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)" }}>Subtotal</div>
                        <div style={{ fontFamily: '"Space Mono", monospace', fontWeight: 700, fontSize: "1.1rem" }}>
                          {money(r.receiptTotalCents)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)" }}>Your Fee</div>
                        <div style={{ fontFamily: '"Space Mono", monospace', fontWeight: 700, fontSize: "1.1rem", color: colors.primary }}>
                          {money(yourFee)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Approve / Deny Buttons */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", flexShrink: 0 }}>
                    <button
                      onClick={() => handleApprove([r.id])}
                      disabled={actionLoading}
                      style={{
                        padding: "0.6rem 1.5rem",
                        background: `${colors.success}15`,
                        border: `1px solid ${colors.success}`,
                        borderRadius: "8px",
                        color: colors.success,
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        cursor: actionLoading ? "wait" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.4rem",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <CheckCircle size={16} /> Approve
                    </button>
                    <button
                      onClick={() => handleReject([r.id])}
                      disabled={actionLoading}
                      style={{
                        padding: "0.6rem 1.5rem",
                        background: `${colors.danger}15`,
                        border: `1px solid ${colors.danger}`,
                        borderRadius: "8px",
                        color: colors.danger,
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        cursor: actionLoading ? "wait" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.4rem",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <X size={16} /> Deny
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Payout Tier Structure */}
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div style={{ fontSize: "1.25rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Award size={20} style={{ color: colors.purple }} />
            Progressive Payout Structure
          </div>
          {!isEditingTiers ? (
            <button
              onClick={() => setIsEditingTiers(true)}
              disabled={tierChangesRemaining <= 0}
              style={{
                padding: "0.5rem 1rem",
                background: tierChangesRemaining > 0 ? `${colors.purple}20` : "rgba(255,255,255,0.05)",
                border: `1px solid ${tierChangesRemaining > 0 ? colors.purple : "rgba(255,255,255,0.1)"}`,
                borderRadius: "6px",
                color: tierChangesRemaining > 0 ? colors.purple : "rgba(255,255,255,0.4)",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: tierChangesRemaining > 0 ? "pointer" : "not-allowed",
              }}
              title={tierChangesRemaining <= 0 ? "You have already used your annual change" : "Edit payout percentages"}
            >
              Edit Structure
            </button>
          ) : (
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                onClick={handleCancelEditTiers}
                disabled={tierSaving}
                style={{
                  padding: "0.5rem 1rem",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: "6px",
                  color: "rgba(255,255,255,0.7)",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTiers}
                disabled={tierSaving}
                style={{
                  padding: "0.5rem 1rem",
                  background: colors.success,
                  border: "none",
                  borderRadius: "6px",
                  color: "white",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: tierSaving ? "wait" : "pointer",
                }}
              >
                {tierSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          )}
        </div>

        <div
          style={{
            fontSize: "0.8rem",
            padding: "0.75rem 1rem",
            background: tierChangesRemaining > 0 ? "rgba(255,255,255,0.03)" : "rgba(239,68,68,0.1)",
            border: tierChangesRemaining > 0 ? "none" : "1px solid rgba(239,68,68,0.3)",
            borderRadius: "8px",
            marginBottom: "1rem",
            color: "rgba(255,255,255,0.7)",
            display: "flex",
            alignItems: "flex-start",
            gap: "0.5rem",
          }}
        >
          <AlertCircle size={16} style={{ color: tierChangesRemaining > 0 ? colors.warning : colors.danger, flexShrink: 0, marginTop: "0.1rem" }} />
          <span>
            <strong>Structure Change Limit:</strong> You can only change your progressive payout structure{" "}
            <span style={{ color: colors.warning, fontWeight: 700 }}>once per calendar year</span>.{" "}
            <span style={{ color: tierChangesRemaining > 0 ? colors.success : colors.danger, fontWeight: 700 }}>
              Changes remaining in {new Date().getFullYear()}: {tierChangesRemaining}
            </span>
            {tierStructureLastChanged && (
              <span style={{ color: "rgba(255,255,255,0.5)", marginLeft: "0.5rem" }}>
                (Last changed: {tierStructureLastChanged.toLocaleDateString()})
              </span>
            )}
          </span>
        </div>

        {tiersLoadedFromConfig && (
          <div
            style={{
              fontSize: "0.8rem",
              padding: "0.75rem 1rem",
              background: "rgba(6,182,212,0.1)",
              border: "1px solid rgba(6,182,212,0.3)",
              borderRadius: "8px",
              marginBottom: "1rem",
              color: colors.accent,
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>
              These percentages were imported from your onboarding. Click <strong>Edit Structure</strong> to save them to the database.
            </span>
          </div>
        )}

        {isEditingTiers && (
          <div
            style={{
              fontSize: "0.8rem",
              padding: "0.75rem 1rem",
              background: "rgba(168,85,247,0.1)",
              border: "1px solid rgba(168,85,247,0.3)",
              borderRadius: "8px",
              marginBottom: "1rem",
              color: colors.purple,
            }}
          >
            <strong>Editing Mode:</strong> Enter percentages below (e.g., "5" for 5.00%). Click Save when done.
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: "0.75rem" }}>
          {defaultTierConfig.map((tier, idx) => (
            <div
              key={idx}
              style={{
                padding: "1rem",
                background: isEditingTiers ? "rgba(168,85,247,0.05)" : "rgba(255,255,255,0.02)",
                borderRadius: "8px",
                border: isEditingTiers ? `1px solid rgba(168,85,247,0.3)` : "1px solid rgba(255,255,255,0.05)",
                textAlign: "center",
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: "0.5rem", color: tierColors[idx] || colors.primary, fontSize: "0.875rem" }}>
                {tier.label}
              </div>
              <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.5)", marginBottom: "0.5rem" }}>
                {tier.maxVisits ? `${tier.minVisits}–${tier.maxVisits} visits` : `${tier.minVisits}+ visits`}
              </div>
              {isEditingTiers ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.25rem" }}>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={((editableTierBps[idx] ?? 0) / 100).toFixed(2)}
                    onChange={(e) => handleTierBpsChange(idx, e.target.value)}
                    style={{
                      width: "70px",
                      padding: "0.5rem",
                      background: "rgba(255,255,255,0.1)",
                      border: "1px solid rgba(255,255,255,0.2)",
                      borderRadius: "6px",
                      color: "white",
                      fontSize: "1rem",
                      fontWeight: 700,
                      textAlign: "center",
                      fontFamily: '"Space Mono", monospace',
                    }}
                  />
                  <span style={{ color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>%</span>
                </div>
              ) : (
                <div style={{ fontFamily: '"Space Mono", monospace', fontSize: "1.1rem", fontWeight: 700, color: idx === defaultTierConfig.length - 1 ? colors.success : "white" }}>
                  {bpsToPercent(editableTierBps[idx] ?? tiers[idx]?.bps ?? 0)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Progressive Payout History */}
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "1.25rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <DollarSign size={20} style={{ color: colors.success }} />
            Progressive Payout History
          </div>
        </div>

        {(() => {
          // Group approved/business_approved receipts by month for payout history
          const approvedReceipts = receipts.filter(
            (r) => normalizeStatus(r.status) === "approved" || normalizeStatus(r.status) === "business_approved"
          );

          if (approvedReceipts.length === 0) {
            return (
              <div style={{ textAlign: "center", padding: "2rem", color: "rgba(255,255,255,0.5)" }}>
                No approved receipts yet. Payout history will appear here once receipts are approved.
              </div>
            );
          }

          // Group by month
          const monthMap = new Map<string, { total: number; count: number }>();
          for (const r of approvedReceipts) {
            const d = new Date(r.visitDate || r.createdAt);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            const existing = monthMap.get(key) || { total: 0, count: 0 };
            existing.total += r.payoutCents || 0;
            existing.count += 1;
            monthMap.set(key, existing);
          }

          const monthRows = [...monthMap.entries()]
            .map(([key, v]) => ({
              key,
              label: new Date(key + "-15").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
              total: v.total,
              count: v.count,
            }))
            .sort((a, b) => b.key.localeCompare(a.key));

          return (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                    {["Date", "Amount", "Receipts", "Payment Method", "Status"].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "1rem",
                          textAlign: h === "Amount" || h === "Receipts" ? "right" : "left",
                          fontSize: "0.875rem",
                          color: "rgba(255,255,255,0.6)",
                          fontWeight: 600,
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {monthRows.map((row) => (
                    <tr key={row.key} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <td style={{ padding: "1rem", fontSize: "0.875rem", fontWeight: 600 }}>{row.label}</td>
                      <td style={{ padding: "1rem", textAlign: "right", fontFamily: '"Space Mono", monospace', color: colors.success, fontWeight: 700 }}>
                        {money(row.total)}
                      </td>
                      <td style={{ padding: "1rem", textAlign: "right", fontFamily: '"Space Mono", monospace' }}>{row.count}</td>
                      <td style={{ padding: "1rem", fontSize: "0.875rem" }}>ACH</td>
                      <td style={{ padding: "1rem" }}>
                        <span style={{ padding: "0.25rem 0.75rem", background: `${colors.success}20`, color: colors.success, borderRadius: "6px", fontSize: "0.75rem", fontWeight: 600 }}>
                          Paid
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}
      </div>

      {/* Monthly Receipt Statement */}
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div style={{ fontSize: "1.25rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Download size={20} style={{ color: colors.secondary }} />
            Monthly Receipt Statement
          </div>
        </div>

        <div
          style={{
            fontSize: "0.8rem",
            padding: "0.75rem 1rem",
            background: "rgba(249,115,22,0.08)",
            border: "1px solid rgba(249,115,22,0.2)",
            borderRadius: "8px",
            marginBottom: "1.25rem",
            color: "rgba(255,255,255,0.7)",
            display: "flex",
            alignItems: "flex-start",
            gap: "0.5rem",
          }}
        >
          <AlertCircle size={16} style={{ color: colors.secondary, flexShrink: 0, marginTop: "0.1rem" }} />
          <span>
            Download a complete Excel statement for any month — includes a summary sheet and full receipt detail with fee breakdowns.
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.6)" }}>Select month:</span>
            <input
              type="month"
              value={statementMonth}
              onChange={(e) => setStatementMonth(e.target.value)}
              max={`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`}
              style={{
                padding: "0.5rem 0.75rem",
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: "6px",
                color: "white",
                fontSize: "0.9rem",
                fontFamily: '"Space Mono", monospace',
                colorScheme: "dark",
              }}
            />
          </div>
          <button
            onClick={handleDownloadStatement}
            disabled={statementLoading}
            style={{
              padding: "0.6rem 1.25rem",
              background: `${colors.secondary}20`,
              border: `1px solid ${colors.secondary}`,
              borderRadius: "8px",
              color: colors.secondary,
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: statementLoading ? "wait" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              whiteSpace: "nowrap",
            }}
          >
            <Download size={16} />
            {statementLoading ? "Generating..." : "Download Statement (.xlsx)"}
          </button>
          {(() => {
            const [y, m] = statementMonth.split("-").map(Number);
            const start = new Date(y, m - 1, 1);
            const end = new Date(y, m, 0, 23, 59, 59);
            const count = receipts.filter((r) => r.createdAt >= start && r.createdAt <= end).length;
            return (
              <span style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)" }}>
                {count} receipt{count !== 1 ? "s" : ""} in{" "}
                {start.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </span>
            );
          })()}
        </div>
      </div>

      {/* Recent Receipt History with Fee Breakdown */}
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "1.25rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <CheckCircle size={20} style={{ color: colors.success }} />
            Recent Receipt History
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={downloadCSV}
              style={{
                padding: "0.5rem 1rem",
                background: `${colors.success}20`,
                border: `1px solid ${colors.success}`,
                borderRadius: "6px",
                color: colors.success,
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <Download size={14} /> CSV
            </button>
          </div>
        </div>

        {receipts.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2rem", color: "rgba(255,255,255,0.5)" }}>
            No receipts yet.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                  {["Receipt ID", "Customer", "Date", "Subtotal", "Progressive Fee", "LetsGo Fee", "CC Fee (3.5%)", "Total Fees", "Status", "Dispute", "Receipt"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "0.75rem",
                        textAlign: ["Subtotal", "Progressive Fee", "LetsGo Fee", "CC Fee (3.5%)", "Total Fees"].includes(h) ? "right" : "left",
                        fontSize: "0.8rem",
                        color: "rgba(255,255,255,0.6)",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {receipts.slice(0, 50).map((r) => {
                  const subtotal = r.receiptTotalCents;
                  const progressiveFee = r.payoutCents || 0;
                  const letsgoFee = isPremium ? 0 : Math.min(Math.floor(subtotal * 0.10), 500); // Premium: no fee; Basic: 10% capped at $5
                  const ccFee = Math.floor(subtotal * 0.035); // 3.5% CC processing
                  const totalFees = progressiveFee + letsgoFee + ccFee;

                  return (
                    <tr key={r.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <td style={{ padding: "0.75rem", fontFamily: '"Space Mono", monospace', fontSize: "0.8rem" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
                          {r.visibleId}
                          {duplicateReceiptIds.has(r.id) && (
                            <span title="Possible duplicate receipt" style={{ color: colors.warning, display: "inline-flex" }}>
                              <AlertCircle size={12} />
                            </span>
                          )}
                        </span>
                      </td>
                      <td style={{ padding: "0.75rem", fontSize: "0.875rem" }}>{r.userIdShort}</td>
                      <td style={{ padding: "0.75rem", fontSize: "0.875rem", color: "rgba(255,255,255,0.6)" }}>{timeAgo(r.createdAt)}</td>
                      <td style={{ padding: "0.75rem", textAlign: "right", fontFamily: '"Space Mono", monospace', fontWeight: 700 }}>
                        {money(subtotal)}
                      </td>
                      <td style={{ padding: "0.75rem", textAlign: "right", fontFamily: '"Space Mono", monospace', color: colors.success }}>
                        {money(progressiveFee)}
                      </td>
                      <td style={{ padding: "0.75rem", textAlign: "right", fontFamily: '"Space Mono", monospace', color: colors.accent }}>
                        {money(letsgoFee)}
                      </td>
                      <td style={{ padding: "0.75rem", textAlign: "right", fontFamily: '"Space Mono", monospace', color: colors.secondary }}>
                        {money(ccFee)}
                      </td>
                      <td style={{ padding: "0.75rem", textAlign: "right", fontFamily: '"Space Mono", monospace', fontWeight: 700 }}>
                        {money(totalFees)}
                      </td>
                      <td style={{ padding: "0.75rem" }}>
                        <StatusBadge status={r.status} colors={colors} />
                      </td>
                      <td style={{ padding: "0.75rem" }}>
                        {(() => {
                          const status = normalizeStatus(r.status);
                          // Only show dispute for business_approved or approved receipts
                          if (status !== "business_approved" && status !== "approved") {
                            return <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.7rem" }}>—</span>;
                          }
                          const closed = isDisputeWindowClosed(r);
                          const daysLeft = disputeDaysRemaining(r);
                          if (closed) {
                            return (
                              <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.35)" }}>
                                Window closed
                              </span>
                            );
                          }
                          return (
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                              {daysLeft !== null && (
                                <span style={{ fontSize: "0.65rem", color: daysLeft <= 7 ? colors.warning : "rgba(255,255,255,0.5)" }}>
                                  {daysLeft}d remaining
                                </span>
                              )}
                              <button
                                onClick={() => {
                                  if (window.confirm(`Dispute receipt ${r.visibleId}? This will reject the receipt and reverse the payout.`)) {
                                    handleReject([r.id]);
                                  }
                                }}
                                disabled={actionLoading}
                                style={{
                                  padding: "0.25rem 0.5rem",
                                  background: `${colors.danger}15`,
                                  border: `1px solid ${colors.danger}60`,
                                  borderRadius: "4px",
                                  color: colors.danger,
                                  fontSize: "0.7rem",
                                  fontWeight: 600,
                                  cursor: actionLoading ? "wait" : "pointer",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                Dispute
                              </button>
                            </div>
                          );
                        })()}
                      </td>
                      <td style={{ padding: "0.75rem" }}>
                        {r.photoUrl ? (
                          <button
                            onClick={() => setViewingReceipt(r)}
                            style={{
                              padding: "0.3rem 0.6rem",
                              background: `${colors.accent}20`,
                              border: `1px solid ${colors.accent}`,
                              borderRadius: "6px",
                              color: colors.accent,
                              fontSize: "0.7rem",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            View
                          </button>
                        ) : (
                          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.7rem" }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Receipt Photo Modal */}
      {viewingReceipt && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(10px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "2rem",
          }}
          onClick={() => setViewingReceipt(null)}
        >
          <div
            style={{
              background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "16px",
              padding: "1.5rem",
              maxWidth: "500px",
              width: "100%",
              maxHeight: "90vh",
              overflow: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{viewingReceipt.visibleId}</div>
              <button
                onClick={() => setViewingReceipt(null)}
                style={{
                  background: "rgba(255,255,255,0.1)",
                  border: "none",
                  borderRadius: "8px",
                  width: "36px",
                  height: "36px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "white",
                }}
              >
                <X size={18} />
              </button>
            </div>

            {viewingReceipt.photoUrl && (
              <img
                src={viewingReceipt.photoUrl}
                alt="Receipt"
                style={{
                  width: "100%",
                  borderRadius: "8px",
                  marginBottom: "1rem",
                }}
              />
            )}

            {duplicateReceiptIds.has(viewingReceipt.id) && (
              <div
                style={{
                  padding: "0.75rem 1rem",
                  background: `${colors.warning}15`,
                  border: `1px solid ${colors.warning}40`,
                  borderRadius: "8px",
                  marginBottom: "1rem",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.5rem",
                }}
              >
                <AlertCircle size={16} style={{ color: colors.warning, flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: "0.8rem", fontWeight: 700, color: colors.warning, marginBottom: "0.2rem" }}>
                    Possible Duplicate
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.4 }}>
                    A similar receipt from this customer was submitted recently. Please review carefully before approving.
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: "grid", gap: "0.5rem", fontSize: "0.875rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "rgba(255,255,255,0.6)" }}>User:</span>
                <span>{viewingReceipt.userIdShort}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "rgba(255,255,255,0.6)" }}>Total:</span>
                <span style={{ fontWeight: 700 }}>{money(viewingReceipt.receiptTotalCents)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "rgba(255,255,255,0.6)" }}>Submitted:</span>
                <span>{timeAgo(viewingReceipt.createdAt)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "rgba(255,255,255,0.6)" }}>Status:</span>
                <StatusBadge status={viewingReceipt.status} colors={colors} />
              </div>
            </div>

            {normalizeStatus(viewingReceipt.status) === "pending" && (
              <div style={{ display: "flex", gap: "1rem", marginTop: "1.5rem" }}>
                <button
                  onClick={() => {
                    handleApprove([viewingReceipt.id]);
                    setViewingReceipt(null);
                  }}
                  style={{
                    flex: 1,
                    padding: "0.75rem",
                    background: colors.success,
                    border: "none",
                    borderRadius: "8px",
                    color: "white",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Approve
                </button>
                <button
                  onClick={() => {
                    handleReject([viewingReceipt.id]);
                    setViewingReceipt(null);
                  }}
                  style={{
                    flex: 1,
                    padding: "0.75rem",
                    background: colors.danger,
                    border: "none",
                    borderRadius: "8px",
                    color: "white",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}