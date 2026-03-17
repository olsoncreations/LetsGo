"use client";

import React, { useEffect, useState, useCallback } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import {
  COLORS,
  Badge,
  Card,
  SectionTitle,
  StatCard,
  DataTable,
  formatDate,
  formatDateTime,
  formatMoney,
} from "@/components/admin/components";
import { logAudit, AUDIT_TABS } from "@/lib/auditLog";

/* ==================== TYPES ==================== */

interface PayoutBreakdown {
  influencer_earnings_cents?: number;
  receipt_earnings_cents?: number;
  influencer_details?: { period: string; signups: number; amountCents: number }[];
}

interface UserPayout {
  id: string;
  user_id: string;
  amount_cents: number;
  fee_cents: number;
  net_amount_cents: number | null;
  method: string;
  account: string;
  status: string;
  requested_at: string;
  processed_at: string | null;
  processed_by: string | null;
  deny_reason: string | null;
  notes: string | null;
  stripe_transfer_id: string | null;
  breakdown: PayoutBreakdown | null;
  // Joined from profiles
  user_name: string | null;
  user_email: string | null;
}

interface BusinessRecord {
  id: string;
  public_business_name: string | null;
  business_name: string | null;
  city: string | null;
  state: string | null;
  contact_email: string | null;
  billing_plan: string | null;
  status: string | null;
  payout_preset: string | null;
  payout_tiers: number[] | null;
  custom_payout_tiers: number[] | null;
  payout_changes_this_year: number | null;
  payout_change_limit: number | null;
  payout_staff_override: boolean | null;
}

interface TierChange {
  id: string;
  previous_preset: string | null;
  new_preset: string | null;
  previous_tiers: number[] | null;
  new_tiers: number[] | null;
  changed_by: string;
  change_reason: string | null;
  created_at: string;
}

type StatusFilter = "all" | "pending" | "processing" | "completed" | "failed";
type MethodFilter = "all" | "venmo" | "paypal" | "bank";

/* ==================== HELPERS ==================== */

function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`).join(",")),
  ].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ==================== MAIN PAGE ==================== */

export default function PayoutsPage() {
  const [payouts, setPayouts] = useState<UserPayout[]>([]);
  const [businesses, setBusinesses] = useState<BusinessRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: "",
    status: "all" as StatusFilter,
    method: "all" as MethodFilter,
    dateFrom: "",
    dateTo: "",
  });

  // Deny modal
  const [selectedPayout, setSelectedPayout] = useState<UserPayout | null>(null);
  const [denyReason, setDenyReason] = useState("");

  // Send payment (PayPal/Venmo)
  const [sendingPayoutId, setSendingPayoutId] = useState<string | null>(null);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Progressive payout summaries
  const [userPayoutSummaries, setUserPayoutSummaries] = useState<{ user_id: string; user_name: string; earned: number; paid: number; remaining: number }[]>([]);
  const [bizPayoutSummaries, setBizPayoutSummaries] = useState<{ business_id: string; business_name: string; earned: number; paid: number; remaining: number }[]>([]);

  // Business tier management
  const [tierSearch, setTierSearch] = useState("");
  const [tierPlanFilter, setTierPlanFilter] = useState("all");
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessRecord | null>(null);
  const [customTiers, setCustomTiers] = useState<number[]>([5, 8, 10, 12, 15, 18, 20]);
  const [tierChangeHistory, setTierChangeHistory] = useState<TierChange[]>([]);
  const [editPreset, setEditPreset] = useState("standard");
  const [editChangeLimit, setEditChangeLimit] = useState(1);
  const [editStaffOverride, setEditStaffOverride] = useState(false);
  const [staffName, setStaffName] = useState("Staff");

  /* ==================== DATA FETCHING ==================== */

  const fetchPayouts = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch user payouts with profile join for name/email
      const { data, error } = await supabaseBrowser
        .from("user_payouts")
        .select("*, breakdown, profiles!user_payouts_user_id_fkey(full_name, email)")
        .order("requested_at", { ascending: false })
        .limit(500);

      if (!error && data) {
        setPayouts(
          data.map((row: Record<string, unknown>) => {
            const profile = row.profiles as Record<string, unknown> | null;
            const { profiles: _p, ...rest } = row;
            return {
              ...rest,
              user_name: profile ? (profile.full_name as string) : null,
              user_email: profile ? (profile.email as string) : null,
            } as UserPayout;
          })
        );
      } else {
        // Fallback without join
        const { data: basic } = await supabaseBrowser
          .from("user_payouts")
          .select("*")
          .order("requested_at", { ascending: false })
          .limit(500);
        setPayouts(
          (basic || []).map((p: Record<string, unknown>) => ({
            ...p,
            user_name: null,
            user_email: null,
          })) as UserPayout[]
        );
      }
    } catch (err) {
      console.error("Error fetching payouts:", err);
      setPayouts([]);
    }

    // Fetch progressive payout summaries via admin API (uses supabaseServer to bypass RLS)
    try {
      const { data: { session: rSess } } = await supabaseBrowser.auth.getSession();
      const [receiptsRes, cashoutsRes, profilesRes] = await Promise.all([
        fetch("/api/admin/receipts", { headers: { Authorization: `Bearer ${rSess?.access_token || ""}` } }).then(r => r.json()),
        supabaseBrowser.from("user_payouts").select("user_id, amount_cents, status"),
        supabaseBrowser.from("profiles").select("id, full_name, first_name, last_name, username"),
      ]);

      const allReceipts = (receiptsRes?.receipts ?? []) as Record<string, unknown>[];
      const approvedReceipts = allReceipts.filter(r => r.status === "approved");

      // Earned by user / business from approved receipts
      const earnedByUser = new Map<string, number>();
      const earnedByBiz = new Map<string, number>();
      for (const r of approvedReceipts) {
        const uid = r.user_id as string;
        const bid = r.business_id as string;
        const cents = (r.payout_cents as number) || 0;
        earnedByUser.set(uid, (earnedByUser.get(uid) || 0) + cents);
        earnedByBiz.set(bid, (earnedByBiz.get(bid) || 0) + cents);
      }

      // Paid out via completed cashouts
      const paidByUser = new Map<string, number>();
      const completedCashouts = ((cashoutsRes.data ?? []) as Record<string, unknown>[]).filter(c => c.status === "completed");
      for (const c of completedCashouts) {
        const uid = c.user_id as string;
        const cents = (c.amount_cents as number) || 0;
        paidByUser.set(uid, (paidByUser.get(uid) || 0) + cents);
      }

      // Name maps
      const nameMap = new Map<string, string>();
      for (const p of ((profilesRes.data ?? []) as Record<string, unknown>[])) {
        const name = (p.full_name as string) || [p.first_name, p.last_name].filter(Boolean).join(" ") || (p.username as string) || "User";
        nameMap.set(p.id as string, name);
      }
      const bizNameMap = new Map<string, string>();
      for (const b of (receiptsRes?.businesses ?? []) as Record<string, unknown>[]) {
        bizNameMap.set(b.id as string, (b.public_business_name as string) || (b.name as string) || "Business");
      }

      // Build user summaries
      setUserPayoutSummaries(
        [...earnedByUser.entries()]
          .map(([uid, earned]) => {
            const paid = paidByUser.get(uid) || 0;
            return { user_id: uid, user_name: nameMap.get(uid) || "Unknown", earned, paid, remaining: earned - paid };
          })
          .sort((a, b) => b.remaining - a.remaining)
      );

      // Build business summaries
      setBizPayoutSummaries(
        [...earnedByBiz.entries()]
          .map(([bid, earned]) => ({
            business_id: bid, business_name: bizNameMap.get(bid) || "Unknown", earned, paid: 0, remaining: earned,
          }))
          .sort((a, b) => b.earned - a.earned)
      );
    } catch (err) {
      console.error("Error fetching payout summaries:", err);
    }

    // Fetch businesses for tier management
    try {
      const { data: bizData } = await supabaseBrowser
        .from("business")
        .select("id, public_business_name, business_name, city, state, contact_email, billing_plan, status, payout_preset, payout_tiers, custom_payout_tiers, payout_changes_this_year, payout_change_limit, payout_staff_override")
        .order("public_business_name", { ascending: true });
      if (bizData) setBusinesses(bizData as BusinessRecord[]);
    } catch (err) {
      console.error("Error fetching businesses:", err);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPayouts();
  }, [fetchPayouts]);

  /* ==================== FILTERING ==================== */

  const filteredPayouts = payouts.filter((p) => {
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (
        !(p.user_name || "").toLowerCase().includes(q) &&
        !(p.user_email || "").toLowerCase().includes(q) &&
        !(p.account || "").toLowerCase().includes(q) &&
        !p.id.toLowerCase().includes(q)
      )
        return false;
    }
    if (filters.status !== "all" && p.status !== filters.status) return false;
    if (filters.method !== "all" && p.method !== filters.method) return false;
    if (filters.dateFrom && p.requested_at < filters.dateFrom) return false;
    if (filters.dateTo && p.requested_at > filters.dateTo + "T23:59:59") return false;
    return true;
  });

  const filteredBusinesses = businesses.filter((b) => {
    if (tierSearch.length < 2) return false;
    const q = tierSearch.toLowerCase();
    const name = b.public_business_name || b.business_name || "";
    const matchesSearch =
      name.toLowerCase().includes(q) ||
      (b.city || "").toLowerCase().includes(q) ||
      (b.contact_email || "").toLowerCase().includes(q);
    const matchesPlan = tierPlanFilter === "all" || b.billing_plan === tierPlanFilter;
    return matchesSearch && matchesPlan;
  });

  /* ==================== STATS ==================== */

  const pendingCount = payouts.filter((p) => p.status === "pending").length;
  const processingCount = payouts.filter((p) => p.status === "processing").length;
  const completedCount = payouts.filter((p) => p.status === "completed").length;
  const failedCount = payouts.filter((p) => p.status === "failed").length;
  const totalPending = payouts.filter((p) => p.status === "pending").reduce((s, p) => s + p.amount_cents, 0);
  const totalCompleted = payouts.filter((p) => p.status === "completed").reduce((s, p) => s + p.amount_cents, 0);

  // Payment processing revenue stats
  const completedPayouts = payouts.filter((p) => p.status === "completed");
  const venmoCompleted = completedPayouts.filter((p) => p.method === "venmo");
  const bankCompleted = completedPayouts.filter((p) => p.method === "bank");
  const totalVenmoFeesCollected = venmoCompleted.reduce((s, p) => s + (p.fee_cents || 0), 0);
  const totalBankTransferCost = bankCompleted.length * 25; // $0.25 per transfer
  const netCashoutRevenue = totalVenmoFeesCollected - totalBankTransferCost;

  /* ==================== PAYOUT ACTIONS ==================== */

  async function handleApprove(payout: UserPayout) {
    const { error } = await supabaseBrowser
      .from("user_payouts")
      .update({ status: "processing", processed_by: staffName, processed_at: new Date().toISOString() })
      .eq("id", payout.id);
    if (error) { alert("Error approving: " + error.message); return; }
    logAudit({ action: "approve_payout", tab: AUDIT_TABS.PAYOUTS, subTab: "Payout Queue", targetType: "user_payout", targetId: payout.id, entityName: payout.user_name || payout.account, fieldName: "status", oldValue: "pending", newValue: "processing", details: `Amount: ${formatMoney(payout.amount_cents)}, Method: ${payout.method}` });
    alert(`✅ Payout approved! Processing ${formatMoney(payout.amount_cents)} to ${payout.user_name || payout.account}`);
    await fetchPayouts();
  }

  async function handleDeny() {
    if (!selectedPayout || !denyReason) return;
    const { error } = await supabaseBrowser
      .from("user_payouts")
      .update({ status: "failed", deny_reason: denyReason, processed_by: staffName, processed_at: new Date().toISOString() })
      .eq("id", selectedPayout.id);
    if (error) { alert("Error denying: " + error.message); return; }
    // Return balance to user
    try {
      await supabaseBrowser.rpc("increment_balance", { p_user_id: selectedPayout.user_id, p_amount: selectedPayout.amount_cents });
    } catch {
      // If RPC doesn't exist, fetch current balance and add back the denied amount
      const { data: currentProfile } = await supabaseBrowser
        .from("profiles")
        .select("available_balance, pending_payout")
        .eq("id", selectedPayout.user_id)
        .maybeSingle();
      const currentBalance = (currentProfile?.available_balance as number) || 0;
      const currentPending = (currentProfile?.pending_payout as number) || 0;
      await supabaseBrowser
        .from("profiles")
        .update({
          available_balance: currentBalance + selectedPayout.amount_cents,
          pending_payout: Math.max(0, currentPending - selectedPayout.amount_cents),
        })
        .eq("id", selectedPayout.user_id);
    }
    logAudit({ action: "deny_payout", tab: AUDIT_TABS.PAYOUTS, subTab: "Payout Queue", targetType: "user_payout", targetId: selectedPayout.id, entityName: selectedPayout.user_name || selectedPayout.account, fieldName: "status", oldValue: "pending", newValue: "failed", details: `Amount: ${formatMoney(selectedPayout.amount_cents)}, Reason: ${denyReason}` });
    alert(`❌ Payout denied. Reason: ${denyReason}\nBalance returned to user.`);
    setSelectedPayout(null);
    setDenyReason("");
    await fetchPayouts();
  }

  async function handleRetry(payout: UserPayout) {
    const { error } = await supabaseBrowser
      .from("user_payouts")
      .update({ status: "processing", deny_reason: null, processed_by: staffName, processed_at: new Date().toISOString() })
      .eq("id", payout.id);
    if (error) { alert("Error retrying: " + error.message); return; }
    logAudit({ action: "retry_payout", tab: AUDIT_TABS.PAYOUTS, subTab: "Payout Queue", targetType: "user_payout", targetId: payout.id, entityName: payout.user_name || payout.account, fieldName: "status", oldValue: "failed", newValue: "processing", details: `Amount: ${formatMoney(payout.amount_cents)}` });
    alert(`🔄 Retrying payout to ${payout.user_name || payout.account}...`);
    await fetchPayouts();
  }

  async function handleMarkCompleted(payout: UserPayout) {
    const { error } = await supabaseBrowser
      .from("user_payouts")
      .update({ status: "completed", processed_at: new Date().toISOString() })
      .eq("id", payout.id);
    if (error) { alert("Error: " + error.message); return; }
    // Decrement pending_payout now that the payout is complete
    try {
      const { data: profile } = await supabaseBrowser
        .from("profiles")
        .select("pending_payout")
        .eq("id", payout.user_id)
        .maybeSingle();
      if (profile) {
        const currentPending = (profile.pending_payout as number) || 0;
        await supabaseBrowser
          .from("profiles")
          .update({ pending_payout: Math.max(0, currentPending - payout.amount_cents) })
          .eq("id", payout.user_id);
      }
    } catch { /* logged but non-blocking */ }
    logAudit({ action: "complete_payout", tab: AUDIT_TABS.PAYOUTS, subTab: "Payout Queue", targetType: "user_payout", targetId: payout.id, entityName: payout.user_name || payout.account, fieldName: "status", oldValue: "processing", newValue: "completed", details: `Amount: ${formatMoney(payout.amount_cents)}` });
    alert("✅ Payout marked as completed.");
    await fetchPayouts();
  }

  async function handleSendPayment(payout: UserPayout) {
    if (sendingPayoutId) return;
    const methodLabel = payout.method === "venmo" ? "Venmo" : payout.method === "bank" ? "Bank" : "PayPal";
    if (!confirm(`Send ${formatMoney(payout.amount_cents)} to ${payout.user_name || payout.account} via ${methodLabel}?`)) return;

    setSendingPayoutId(payout.id);
    try {
      const { data: session } = await supabaseBrowser.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) { alert("Authentication required"); return; }

      const res = await fetch("/api/admin/payouts/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ payoutId: payout.id }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(`❌ Payment failed: ${data.error || "Unknown error"}`);
        return;
      }

      alert(`✅ Payment sent successfully!\nTransaction: ${data.transaction_id || "N/A"}\nProvider: ${data.provider}`);
      await fetchPayouts();
    } catch (err) {
      alert(`❌ Error: ${err instanceof Error ? err.message : "Failed to send payment"}`);
    } finally {
      setSendingPayoutId(null);
    }
  }

  /* ==================== BULK ACTIONS ==================== */

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll(status: string) {
    const matching = filteredPayouts.filter(p => p.status === status);
    const allSelected = matching.every(p => selectedIds.has(p.id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      matching.forEach(p => { if (allSelected) next.delete(p.id); else next.add(p.id); });
      return next;
    });
  }

  async function handleBulkApprove() {
    const pending = filteredPayouts.filter(p => p.status === "pending" && selectedIds.has(p.id));
    if (pending.length === 0) return;
    if (!confirm(`Approve ${pending.length} payout${pending.length > 1 ? "s" : ""} totaling ${formatMoney(pending.reduce((s, p) => s + p.amount_cents, 0))}?`)) return;

    setBulkProcessing(true);
    let succeeded = 0;
    for (const payout of pending) {
      const { error } = await supabaseBrowser
        .from("user_payouts")
        .update({ status: "processing", processed_by: staffName, processed_at: new Date().toISOString() })
        .eq("id", payout.id);
      if (!error) {
        logAudit({ action: "approve_payout", tab: AUDIT_TABS.PAYOUTS, subTab: "Payout Queue", targetType: "user_payout", targetId: payout.id, entityName: payout.user_name || payout.account, fieldName: "status", oldValue: "pending", newValue: "processing", details: `Bulk approve — ${formatMoney(payout.amount_cents)}` });
        succeeded++;
      }
    }
    alert(`✅ Approved ${succeeded} of ${pending.length} payouts`);
    setSelectedIds(new Set());
    setBulkProcessing(false);
    await fetchPayouts();
  }

  async function handleBulkSend() {
    const processing = filteredPayouts.filter(p => p.status === "processing" && selectedIds.has(p.id) && (p.method === "venmo" || p.method === "paypal" || p.method === "bank"));
    if (processing.length === 0) return;
    if (!confirm(`Send ${processing.length} payment${processing.length > 1 ? "s" : ""} totaling ${formatMoney(processing.reduce((s, p) => s + p.amount_cents, 0))} via PayPal?`)) return;

    setBulkProcessing(true);
    const { data: session } = await supabaseBrowser.auth.getSession();
    const token = session?.session?.access_token;
    if (!token) { alert("Authentication required"); setBulkProcessing(false); return; }

    let succeeded = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const payout of processing) {
      try {
        const res = await fetch("/api/admin/payouts/send", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ payoutId: payout.id }),
        });
        const data = await res.json();
        if (res.ok) { succeeded++; } else { failed++; errors.push(`${payout.user_name || payout.account}: ${data.error}`); }
      } catch (err) {
        failed++;
        errors.push(`${payout.user_name || payout.account}: ${err instanceof Error ? err.message : "Failed"}`);
      }
    }

    let msg = `✅ Sent: ${succeeded}`;
    if (failed > 0) msg += `\n❌ Failed: ${failed}\n\n${errors.join("\n")}`;
    alert(msg);
    setSelectedIds(new Set());
    setBulkProcessing(false);
    await fetchPayouts();
  }

  const selectedPendingCount = filteredPayouts.filter(p => p.status === "pending" && selectedIds.has(p.id)).length;
  const selectedProcessingCount = filteredPayouts.filter(p => p.status === "processing" && selectedIds.has(p.id) && (p.method === "venmo" || p.method === "paypal" || p.method === "bank")).length;

  /* ==================== TIER MANAGEMENT ==================== */

  async function handleSelectBusiness(business: BusinessRecord) {
    setSelectedBusiness(business);
    const tiers = business.custom_payout_tiers || business.payout_tiers || [5, 8, 10, 12, 15, 18, 20];
    setCustomTiers(tiers.map((t: number) => (t > 100 ? Math.round(t / 100) : t)));
    setEditPreset(business.payout_preset || "standard");
    setEditChangeLimit(business.payout_change_limit || 1);
    setEditStaffOverride(business.payout_staff_override || false);

    // Fetch change history
    const { data } = await supabaseBrowser
      .from("payout_tier_changes")
      .select("*")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setTierChangeHistory((data || []) as TierChange[]);
  }

  async function handleSaveTiers() {
    if (!selectedBusiness) return;
    // Record change in history
    await supabaseBrowser.from("payout_tier_changes").insert({
      business_id: selectedBusiness.id,
      previous_preset: selectedBusiness.payout_preset,
      new_preset: editPreset,
      previous_tiers: selectedBusiness.custom_payout_tiers || selectedBusiness.payout_tiers,
      new_tiers: customTiers,
      changed_by: staffName,
    });
    // Update business
    const { error } = await supabaseBrowser
      .from("business")
      .update({
        payout_preset: editPreset,
        custom_payout_tiers: editPreset === "custom" ? customTiers : null,
        payout_change_limit: editChangeLimit,
        payout_staff_override: editStaffOverride,
        payout_changes_this_year: (selectedBusiness.payout_changes_this_year || 0) + 1,
      })
      .eq("id", selectedBusiness.id);
    if (error) { alert("Error saving: " + error.message); return; }
    const previousTiers = selectedBusiness.custom_payout_tiers || selectedBusiness.payout_tiers;
    logAudit({ action: "update_payout_tiers", tab: AUDIT_TABS.PAYOUTS, targetType: "business", targetId: selectedBusiness.id, entityName: selectedBusiness.public_business_name || selectedBusiness.business_name || "", subTab: "Tier Management", fieldName: "payout_tiers", oldValue: `Preset: ${selectedBusiness.payout_preset || "unknown"}, Tiers: ${previousTiers ? previousTiers.join("-") : "none"}%`, newValue: `Preset: ${editPreset}, Tiers: ${customTiers.join("-")}%`, details: `Preset: ${editPreset}, Tiers: ${customTiers.join("-")}%` });
    alert(`✅ Tier settings saved for ${selectedBusiness.public_business_name || selectedBusiness.business_name}!`);
    setSelectedBusiness(null);
    setTierSearch("");
    await fetchPayouts();
  }

  /* ==================== CSV DOWNLOADS ==================== */

  function handleDownloadPayouts() {
    downloadCSV(
      `user_payouts_${new Date().toISOString().slice(0, 10)}.csv`,
      ["ID", "User", "Email", "Amount ($)", "Method", "Account", "Status", "Requested", "Processed", "Processed By", "Deny Reason"],
      filteredPayouts.map((p) => [
        p.id, p.user_name || "", p.user_email || "", (p.amount_cents / 100).toFixed(2),
        p.method, p.account, p.status, p.requested_at, p.processed_at || "", p.processed_by || "", p.deny_reason || "",
      ])
    );
  }

  function handleDownloadTierHistory() {
    if (!selectedBusiness) return;
    downloadCSV(
      `tier_changes_${(selectedBusiness.public_business_name || selectedBusiness.id).replace(/\s/g, "_")}.csv`,
      ["Date", "Previous Preset", "New Preset", "Previous Tiers", "New Tiers", "Changed By"],
      tierChangeHistory.map((c) => [
        c.created_at, c.previous_preset || "", c.new_preset || "",
        JSON.stringify(c.previous_tiers), JSON.stringify(c.new_tiers), c.changed_by,
      ])
    );
  }

  /* ==================== RENDER ==================== */

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 32, background: COLORS.darkBg, minHeight: "calc(100vh - 60px)" }}>
      {/* Deny Modal */}
      {selectedPayout && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => setSelectedPayout(null)}
        >
          <div
            style={{ background: COLORS.cardBg, borderRadius: 20, padding: 32, maxWidth: 500, width: "90%", border: "1px solid " + COLORS.cardBorder }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16, color: COLORS.neonRed }}>❌ Deny Payout</h2>
            <p style={{ color: COLORS.textSecondary, marginBottom: 8 }}>
              Deny payout of <strong style={{ color: COLORS.neonGreen }}>{formatMoney(selectedPayout.amount_cents)}</strong> to{" "}
              <strong>{selectedPayout.user_name || selectedPayout.account}</strong>?
            </p>
            <p style={{ fontSize: 12, color: COLORS.neonYellow, marginBottom: 16 }}>
              ⚠️ The amount will be returned to the user&apos;s available balance.
            </p>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, textTransform: "uppercase" }}>Reason</label>
              <textarea
                value={denyReason}
                onChange={(e) => setDenyReason(e.target.value)}
                placeholder="Enter reason for denial..."
                style={{ width: "100%", padding: 12, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, fontSize: 13, background: COLORS.darkBg, color: COLORS.textPrimary, minHeight: 100, resize: "vertical" }}
              />
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button onClick={() => setSelectedPayout(null)} style={{ padding: "12px 24px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, cursor: "pointer", fontWeight: 600 }}>
                Cancel
              </button>
              <button
                onClick={handleDeny}
                disabled={!denyReason}
                style={{ padding: "12px 24px", background: denyReason ? "linear-gradient(135deg, #ff3131, #990000)" : COLORS.darkBg, border: "none", borderRadius: 10, color: denyReason ? "#fff" : COLORS.textSecondary, cursor: denyReason ? "pointer" : "not-allowed", fontWeight: 700 }}
              >
                Deny Payout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, background: COLORS.gradient1, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          💸 Payouts
        </h1>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <label style={{ fontSize: 11, color: COLORS.textSecondary }}>Staff:</label>
          <input
            type="text"
            value={staffName}
            onChange={(e) => setStaffName(e.target.value)}
            style={{ padding: "8px 12px", border: "1px solid " + COLORS.cardBorder, borderRadius: 8, fontSize: 12, background: COLORS.cardBg, color: COLORS.textPrimary, width: 120 }}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: COLORS.textSecondary }}>Loading payouts...</div>
      ) : (
        <>
          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 16, marginBottom: 24 }}>
            <StatCard icon="⏳" value={pendingCount.toString()} label="Pending" gradient={COLORS.gradient4} />
            <StatCard icon="🔄" value={processingCount.toString()} label="Processing" gradient={COLORS.gradient2} />
            <StatCard icon="✅" value={completedCount.toString()} label="Completed" gradient={COLORS.gradient2} />
            <StatCard icon="❌" value={failedCount.toString()} label="Failed" gradient="linear-gradient(135deg, #ff3131, #990000)" />
            <StatCard icon="💰" value={formatMoney(totalPending)} label="Pending $" gradient={COLORS.gradient4} />
            <StatCard icon="📊" value={formatMoney(totalCompleted)} label="Total Paid" gradient={COLORS.gradient2} />
          </div>

          {/* Cashout Fee Revenue */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, marginBottom: 24 }}>
            <StatCard icon="💜" value={formatMoney(totalVenmoFeesCollected)} label="Venmo Fees Collected" gradient="linear-gradient(135deg, #bf5fff, #ff2d92)" />
            <StatCard icon="🏦" value={formatMoney(totalBankTransferCost)} label="Bank Transfer Costs" gradient="linear-gradient(135deg, #ff6b35, #ff3131)" />
            <StatCard icon="📈" value={formatMoney(netCashoutRevenue)} label="Net Cashout Revenue" gradient={netCashoutRevenue >= 0 ? COLORS.gradient2 : "linear-gradient(135deg, #ff3131, #990000)"} />
            <StatCard icon="📱" value={`${venmoCompleted.length} Venmo`} label={`${formatMoney(venmoCompleted.reduce((s, p) => s + p.amount_cents, 0))} sent`} gradient="linear-gradient(135deg, #bf5fff, #6b5fff)" />
            <StatCard icon="🏧" value={`${bankCompleted.length} Bank`} label={`${formatMoney(bankCompleted.reduce((s, p) => s + p.amount_cents, 0))} sent`} gradient="linear-gradient(135deg, #00d4ff, #0088cc)" />
          </div>

          {/* Filters */}
          <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="Search users, emails, accounts..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              style={{ flex: 1, minWidth: 200, padding: "12px 14px", border: "1px solid " + COLORS.cardBorder, borderRadius: 10, fontSize: 13, background: COLORS.cardBg, color: COLORS.textPrimary }}
            />
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value as StatusFilter })}
              style={{ padding: "12px 16px", border: "1px solid " + COLORS.cardBorder, borderRadius: 10, fontSize: 13, background: COLORS.cardBg, color: COLORS.textPrimary }}
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
            <select
              value={filters.method}
              onChange={(e) => setFilters({ ...filters, method: e.target.value as MethodFilter })}
              style={{ padding: "12px 16px", border: "1px solid " + COLORS.cardBorder, borderRadius: 10, fontSize: 13, background: COLORS.cardBg, color: COLORS.textPrimary }}
            >
              <option value="all">All Methods</option>
              <option value="venmo">Venmo</option>
              <option value="paypal">PayPal</option>
              <option value="bank">Bank (Stripe)</option>
            </select>
            <input type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              style={{ padding: "12px 14px", border: "1px solid " + COLORS.cardBorder, borderRadius: 10, fontSize: 13, background: COLORS.cardBg, color: COLORS.textPrimary }} />
            <input type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              style={{ padding: "12px 14px", border: "1px solid " + COLORS.cardBorder, borderRadius: 10, fontSize: 13, background: COLORS.cardBg, color: COLORS.textPrimary }} />
          </div>

          {/* Count + Download row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: COLORS.textSecondary }}>
              Showing {filteredPayouts.length} of {payouts.length} payouts
              {selectedIds.size > 0 && (
                <span style={{ marginLeft: 12, color: COLORS.neonBlue }}>
                  ({selectedIds.size} selected)
                </span>
              )}
            </div>
            <button
              onClick={handleDownloadPayouts}
              disabled={filteredPayouts.length === 0}
              style={{
                padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                cursor: filteredPayouts.length > 0 ? "pointer" : "not-allowed",
                background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder,
                color: filteredPayouts.length > 0 ? COLORS.textPrimary : COLORS.textSecondary,
              }}
            >
              📥 Download CSV
            </button>
          </div>

          {/* Bulk Action Bar */}
          <div style={{ display: "flex", gap: 10, marginBottom: 12, padding: "10px 16px", background: "rgba(0,212,255,0.06)", border: "1px solid " + COLORS.cardBorder, borderRadius: 12, flexWrap: "wrap", alignItems: "center" }}>
            {/* Quick-select buttons */}
            {filteredPayouts.some(p => p.status === "pending") && (
              <button
                onClick={() => toggleSelectAll("pending")}
                style={{
                  padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                  cursor: "pointer", background: "transparent", border: "1px solid " + COLORS.neonYellow + "66",
                  color: COLORS.neonYellow,
                }}
              >
                {filteredPayouts.filter(p => p.status === "pending").every(p => selectedIds.has(p.id)) && filteredPayouts.some(p => p.status === "pending")
                  ? "Deselect All Pending"
                  : "Select All Pending"}
              </button>
            )}
            {filteredPayouts.some(p => p.status === "processing") && (
              <button
                onClick={() => toggleSelectAll("processing")}
                style={{
                  padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                  cursor: "pointer", background: "transparent", border: "1px solid " + COLORS.neonBlue + "66",
                  color: COLORS.neonBlue,
                }}
              >
                {filteredPayouts.filter(p => p.status === "processing").every(p => selectedIds.has(p.id)) && filteredPayouts.some(p => p.status === "processing")
                  ? "Deselect All Processing"
                  : "Select All Processing"}
              </button>
            )}

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* Bulk action buttons — only show when items are selected */}
            {selectedPendingCount > 0 && (
              <button
                onClick={handleBulkApprove}
                disabled={bulkProcessing}
                style={{
                  padding: "8px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                  cursor: bulkProcessing ? "wait" : "pointer",
                  background: "rgba(57,255,20,0.2)", border: "1px solid " + COLORS.neonGreen,
                  color: COLORS.neonGreen, opacity: bulkProcessing ? 0.6 : 1,
                }}
              >
                {bulkProcessing ? "Processing..." : `✓ Bulk Approve (${selectedPendingCount})`}
              </button>
            )}
            {selectedProcessingCount > 0 && (
              <button
                onClick={handleBulkSend}
                disabled={bulkProcessing}
                style={{
                  padding: "8px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                  cursor: bulkProcessing ? "wait" : "pointer",
                  background: "rgba(0,212,255,0.2)", border: "1px solid " + COLORS.neonBlue,
                  color: COLORS.neonBlue, opacity: bulkProcessing ? 0.6 : 1,
                }}
              >
                {bulkProcessing ? "Sending..." : `💸 Bulk Send Payment (${selectedProcessingCount})`}
              </button>
            )}
            {selectedIds.size > 0 && (
              <button
                onClick={() => setSelectedIds(new Set())}
                style={{
                  padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                  cursor: "pointer", background: "transparent", border: "1px solid " + COLORS.cardBorder,
                  color: COLORS.textSecondary,
                }}
              >
                Clear
              </button>
            )}
          </div>

          {/* Payout Table */}
          <Card style={{ marginBottom: 32 }}>
            {filteredPayouts.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>💸</div>
                No payouts found{filters.status !== "all" || filters.search ? " matching your filters" : " yet"}
              </div>
            ) : (
              <DataTable
                columns={[
                  {
                    key: "id",
                    label: "",
                    render: (v) => {
                      const id = String(v);
                      return (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(id)}
                          onChange={() => toggleSelect(id)}
                          onClick={(e) => e.stopPropagation()}
                          style={{ width: 16, height: 16, cursor: "pointer", accentColor: COLORS.neonBlue }}
                        />
                      );
                    },
                  },
                  {
                    key: "user_name",
                    label: "User",
                    render: (v, row) => (
                      <div>
                        <div style={{ fontWeight: 600 }}>{String(v || "Unknown")}</div>
                        <div style={{ fontSize: 11, color: COLORS.textSecondary }}>{String(row.user_email || row.account || "")}</div>
                      </div>
                    ),
                  },
                  {
                    key: "amount_cents",
                    label: "Amount",
                    align: "right",
                    render: (v, row) => {
                      const bd = row.breakdown as PayoutBreakdown | null;
                      const hasBreakdown = bd && ((bd.influencer_earnings_cents || 0) > 0 || (bd.receipt_earnings_cents || 0) > 0);
                      const feeCents = (row.fee_cents as number) || 0;
                      const netCents = (row.net_amount_cents as number) || (Number(v) - feeCents);
                      return (
                        <div>
                          <span style={{ fontWeight: 700, color: COLORS.neonGreen }}>{formatMoney(Number(v))}</span>
                          {feeCents > 0 && (
                            <div style={{ fontSize: 10, color: COLORS.neonYellow, marginTop: 2 }}>
                              Fee: {formatMoney(feeCents)} · Net: {formatMoney(netCents)}
                            </div>
                          )}
                          {hasBreakdown && (
                            <div style={{ fontSize: 10, color: COLORS.textSecondary, marginTop: 2 }}>
                              {(bd.receipt_earnings_cents || 0) > 0 && <span>Receipts: {formatMoney(bd.receipt_earnings_cents || 0)}</span>}
                              {(bd.receipt_earnings_cents || 0) > 0 && (bd.influencer_earnings_cents || 0) > 0 && <span> · </span>}
                              {(bd.influencer_earnings_cents || 0) > 0 && <span style={{ color: COLORS.neonOrange }}>Influencer: {formatMoney(bd.influencer_earnings_cents || 0)}</span>}
                            </div>
                          )}
                        </div>
                      );
                    },
                  },
                  {
                    key: "method",
                    label: "Method",
                    render: (v) => <span>{v === "venmo" ? "📱 Venmo" : v === "bank" ? "🏦 Bank" : "💳 PayPal"}</span>,
                  },
                  {
                    key: "account",
                    label: "Account",
                    render: (v) => <span style={{ fontFamily: "monospace", fontSize: 11 }}>{String(v)}</span>,
                  },
                  {
                    key: "status",
                    label: "Status",
                    render: (v) => <Badge status={String(v)} />,
                  },
                  {
                    key: "requested_at",
                    label: "Requested",
                    render: (v) => <span style={{ fontSize: 12 }}>{formatDateTime(String(v))}</span>,
                  },
                  {
                    key: "processed_at",
                    label: "Processed",
                    render: (v) => v ? <span style={{ fontSize: 12 }}>{formatDateTime(String(v))}</span> : <span style={{ color: COLORS.textSecondary, fontSize: 12 }}>—</span>,
                  },
                  {
                    key: "id",
                    label: "",
                    align: "right",
                    render: (v) => {
                      const payout = payouts.find((po) => po.id === v);
                      if (!payout) return null;

                      if (payout.status === "pending") {
                        return (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => handleApprove(payout)}
                              style={{ padding: "5px 10px", background: "rgba(57,255,20,0.2)", border: "1px solid " + COLORS.neonGreen, borderRadius: 6, color: COLORS.neonGreen, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                              ✓ Approve
                            </button>
                            <button onClick={() => setSelectedPayout(payout)}
                              style={{ padding: "5px 10px", background: "rgba(255,49,49,0.2)", border: "1px solid " + COLORS.neonRed, borderRadius: 6, color: COLORS.neonRed, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                              ✗ Deny
                            </button>
                          </div>
                        );
                      }
                      if (payout.status === "processing") {
                        const isSending = sendingPayoutId === payout.id;
                        const isPayPalOrVenmo = payout.method === "venmo" || payout.method === "paypal" || payout.method === "bank";
                        return (
                          <div style={{ display: "flex", gap: 6 }}>
                            {isPayPalOrVenmo && (
                              <button onClick={() => handleSendPayment(payout)} disabled={isSending}
                                style={{ padding: "5px 10px", background: "rgba(0,212,255,0.2)", border: "1px solid " + COLORS.neonBlue, borderRadius: 6, color: COLORS.neonBlue, cursor: isSending ? "wait" : "pointer", fontSize: 11, fontWeight: 600, opacity: isSending ? 0.6 : 1 }}>
                                {isSending ? "Sending..." : "💸 Send Payment"}
                              </button>
                            )}
                            <button onClick={() => handleMarkCompleted(payout)}
                              style={{ padding: "5px 10px", background: "rgba(57,255,20,0.2)", border: "1px solid " + COLORS.neonGreen, borderRadius: 6, color: COLORS.neonGreen, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                              ✅ Mark Complete
                            </button>
                          </div>
                        );
                      }
                      if (payout.status === "failed") {
                        return (
                          <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                            <button onClick={() => handleRetry(payout)}
                              style={{ padding: "5px 10px", background: "rgba(255,107,53,0.2)", border: "1px solid " + COLORS.neonOrange, borderRadius: 6, color: COLORS.neonOrange, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                              🔄 Retry
                            </button>
                            {payout.deny_reason && (
                              <div style={{ fontSize: 10, color: COLORS.neonRed, maxWidth: 150, textAlign: "right" }}>{payout.deny_reason}</div>
                            )}
                          </div>
                        );
                      }
                      return null;
                    },
                  },
                ]}
                data={filteredPayouts as unknown as Record<string, unknown>[]}
              />
            )}
          </Card>

          {/* ==================== Individual Progressive Payouts ==================== */}
          <SectionTitle icon="👤">Individual Progressive Payouts</SectionTitle>
          <Card style={{ marginBottom: 32 }}>
            {userPayoutSummaries.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>👤</div>
                No user payouts yet. Data appears here when receipts are approved.
              </div>
            ) : (
              <DataTable
                columns={[
                  {
                    key: "user_name",
                    label: "User",
                    render: (v) => <span style={{ fontWeight: 600 }}>{String(v)}</span>,
                  },
                  {
                    key: "earned",
                    label: "Earned",
                    align: "right",
                    render: (v) => <span style={{ fontFamily: "monospace", color: COLORS.neonGreen }}>{formatMoney(Number(v))}</span>,
                  },
                  {
                    key: "paid",
                    label: "Paid Out",
                    align: "right",
                    render: (v) => <span style={{ fontFamily: "monospace", color: COLORS.neonBlue }}>{formatMoney(Number(v))}</span>,
                  },
                  {
                    key: "remaining",
                    label: "Still Owed",
                    align: "right",
                    render: (v) => {
                      const val = Number(v);
                      return <span style={{ fontFamily: "monospace", fontWeight: 700, color: val > 0 ? COLORS.neonYellow : COLORS.textSecondary }}>{formatMoney(val)}</span>;
                    },
                  },
                ]}
                data={userPayoutSummaries as unknown as Record<string, unknown>[]}
              />
            )}
          </Card>

          {/* ==================== Business Progressive Payouts ==================== */}
          <SectionTitle icon="🏪">Business Progressive Payouts</SectionTitle>
          <Card style={{ marginBottom: 32 }}>
            {bizPayoutSummaries.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🏪</div>
                No business payouts yet. Data appears here when receipts are approved.
              </div>
            ) : (
              <DataTable
                columns={[
                  {
                    key: "business_name",
                    label: "Business",
                    render: (v) => <span style={{ fontWeight: 600 }}>{String(v)}</span>,
                  },
                  {
                    key: "earned",
                    label: "Total Owed to Users",
                    align: "right",
                    render: (v) => <span style={{ fontFamily: "monospace", color: COLORS.neonGreen }}>{formatMoney(Number(v))}</span>,
                  },
                  {
                    key: "paid",
                    label: "Paid Out",
                    align: "right",
                    render: (v) => <span style={{ fontFamily: "monospace", color: COLORS.neonBlue }}>{formatMoney(Number(v))}</span>,
                  },
                  {
                    key: "remaining",
                    label: "Still Owed",
                    align: "right",
                    render: (v) => {
                      const val = Number(v);
                      return <span style={{ fontFamily: "monospace", fontWeight: 700, color: val > 0 ? COLORS.neonYellow : COLORS.textSecondary }}>{formatMoney(val)}</span>;
                    },
                  },
                ]}
                data={bizPayoutSummaries as unknown as Record<string, unknown>[]}
              />
            )}
          </Card>

          {/* ==================== Business Payout Tier Management ==================== */}
          <SectionTitle icon="📊">Business Payout Tier Management</SectionTitle>
          <Card title="🔧 OVERRIDE PROGRESSIVE CASHBACK RATES BY BUSINESS" style={{ marginBottom: 24, borderColor: COLORS.neonPurple }}>
            <div style={{ padding: 16, background: "rgba(138,43,226,0.1)", borderRadius: 12, marginBottom: 20, border: "1px solid " + COLORS.neonPurple }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <span style={{ fontSize: 24 }}>💡</span>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4, color: COLORS.neonPurple }}>Business-Specific Payout Tier Overrides</div>
                  <div style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.5 }}>
                    Each business has a <strong>limit of 1 payout tier change per year</strong>. Staff can override this limit and customize the
                    progressive cashback percentages for individual businesses. Search for a business below, then edit their tier settings.
                  </div>
                </div>
              </div>
            </div>

            {/* Business Search */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Search Business</div>
              <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                <input
                  type="text"
                  placeholder="Search by business name, city, or email..."
                  value={tierSearch}
                  onChange={(e) => setTierSearch(e.target.value)}
                  style={{ flex: 1, padding: "12px 14px", border: "1px solid " + COLORS.cardBorder, borderRadius: 10, fontSize: 13, background: COLORS.darkBg, color: COLORS.textPrimary }}
                />
                <select
                  value={tierPlanFilter}
                  onChange={(e) => setTierPlanFilter(e.target.value)}
                  style={{ padding: "12px 14px", border: "1px solid " + COLORS.cardBorder, borderRadius: 10, fontSize: 13, background: COLORS.darkBg, color: COLORS.textPrimary }}
                >
                  <option value="all">All Plans</option>
                  <option value="basic">Basic</option>
                  <option value="premium">Premium</option>
                </select>
              </div>

              {/* Business Results */}
              {tierSearch.length >= 2 && (
                <div style={{ background: COLORS.darkBg, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, maxHeight: 200, overflowY: "auto" }}>
                  {filteredBusinesses.length === 0 ? (
                    <div style={{ padding: 20, textAlign: "center", color: COLORS.textSecondary }}>No businesses found</div>
                  ) : (
                    filteredBusinesses.map((b) => (
                      <div
                        key={b.id}
                        onClick={() => handleSelectBusiness(b)}
                        style={{
                          padding: "12px 16px", borderBottom: "1px solid " + COLORS.cardBorder, cursor: "pointer",
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          background: selectedBusiness?.id === b.id ? "rgba(138,43,226,0.2)" : "transparent",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600 }}>{b.public_business_name || b.business_name}</div>
                          <div style={{ fontSize: 11, color: COLORS.textSecondary }}>
                            {b.city}{b.city && b.state ? ", " : ""}{b.state} • {b.contact_email || "—"}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <Badge status={b.billing_plan || "basic"} />
                          <Badge status={b.status || "active"} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Selected Business Tier Editor */}
            {selectedBusiness && (
              <div style={{ border: "2px solid " + COLORS.neonPurple, borderRadius: 12, padding: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>{selectedBusiness.public_business_name || selectedBusiness.business_name}</div>
                    <div style={{ fontSize: 12, color: COLORS.textSecondary }}>
                      {selectedBusiness.city}{selectedBusiness.city && selectedBusiness.state ? ", " : ""}{selectedBusiness.state} • {selectedBusiness.contact_email || "—"}
                    </div>
                  </div>
                  <button onClick={() => setSelectedBusiness(null)}
                    style={{ padding: "6px 12px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 6, color: COLORS.textSecondary, cursor: "pointer", fontSize: 11 }}>
                    ✕ Close
                  </button>
                </div>

                {/* Change Limit & Override */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
                  <div style={{ padding: 16, background: COLORS.darkBg, borderRadius: 10 }}>
                    <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 6 }}>CHANGES THIS YEAR</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 28, fontWeight: 700, color: (selectedBusiness.payout_changes_this_year || 0) >= editChangeLimit ? COLORS.neonRed : COLORS.neonGreen }}>
                        {selectedBusiness.payout_changes_this_year || 0}
                      </span>
                      <span style={{ fontSize: 14, color: COLORS.textSecondary }}>/ {editChangeLimit}</span>
                    </div>
                  </div>
                  <div style={{ padding: 16, background: COLORS.darkBg, borderRadius: 10 }}>
                    <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 6 }}>CHANGE LIMIT (per year)</div>
                    <input type="number" value={editChangeLimit} onChange={(e) => setEditChangeLimit(parseInt(e.target.value) || 1)} min={0} max={12}
                      style={{ width: 60, padding: 8, background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 6, color: COLORS.textPrimary, fontSize: 18, fontWeight: 700 }} />
                  </div>
                  <div style={{ padding: 16, background: COLORS.darkBg, borderRadius: 10 }}>
                    <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 6 }}>STAFF OVERRIDE</div>
                    <select value={editStaffOverride ? "yes" : "no"} onChange={(e) => setEditStaffOverride(e.target.value === "yes")}
                      style={{ padding: 8, background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 6, color: COLORS.textPrimary, fontSize: 14 }}>
                      <option value="no">No Override</option>
                      <option value="yes">Override Enabled (Unlimited)</option>
                    </select>
                  </div>
                </div>

                {/* Current Preset */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Current Preset</div>
                  <select
                    value={editPreset}
                    onChange={(e) => {
                      const v = e.target.value;
                      setEditPreset(v);
                      if (v === "conservative") setCustomTiers([3, 5, 7, 9, 11, 13, 15]);
                      else if (v === "standard") setCustomTiers([5, 8, 10, 12, 15, 18, 20]);
                      else if (v === "aggressive") setCustomTiers([8, 11, 14, 17, 20, 23, 25]);
                    }}
                    style={{ padding: "10px 14px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, fontSize: 14, width: 280 }}
                  >
                    <option value="conservative">Conservative (3-5-7-9-11-13-15%)</option>
                    <option value="standard">Standard (5-8-10-12-15-18-20%)</option>
                    <option value="aggressive">Aggressive (8-11-14-17-20-23-25%)</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>

                {/* Custom Tier Editor */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>Custom Cashback Rates (%)</div>
                    <button onClick={() => { setCustomTiers([5, 8, 10, 12, 15, 18, 20]); setEditPreset("standard"); }}
                      style={{ padding: "6px 12px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 6, color: COLORS.textSecondary, cursor: "pointer", fontSize: 11 }}>
                      Reset to Standard
                    </button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 10 }}>
                    {customTiers.map((pct, i) => (
                      <div key={i} style={{ padding: 12, background: COLORS.darkBg, borderRadius: 8, textAlign: "center" }}>
                        <div style={{ fontSize: 10, color: COLORS.textSecondary, marginBottom: 4 }}>L{i + 1}</div>
                        <input
                          type="number"
                          value={pct}
                          onChange={(e) => {
                            const newTiers = [...customTiers];
                            newTiers[i] = parseInt(e.target.value) || 0;
                            setCustomTiers(newTiers);
                            setEditPreset("custom");
                          }}
                          min={0} max={50}
                          style={{ width: "100%", padding: 6, background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 4, color: COLORS.neonPurple, fontSize: 16, fontWeight: 700, textAlign: "center" }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Change History */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>Change History</div>
                    {tierChangeHistory.length > 0 && (
                      <button onClick={handleDownloadTierHistory}
                        style={{ padding: "5px 12px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 6, color: COLORS.textSecondary, cursor: "pointer", fontSize: 10, fontWeight: 600 }}>
                        📥 Download
                      </button>
                    )}
                  </div>
                  <div style={{ background: COLORS.darkBg, borderRadius: 10, overflow: "hidden" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 1fr 100px", gap: 8, padding: "8px 12px", background: COLORS.cardBg, fontSize: 10, color: COLORS.textSecondary, fontWeight: 600, textTransform: "uppercase" }}>
                      <div>Date</div>
                      <div>Previous</div>
                      <div>New</div>
                      <div>By</div>
                    </div>
                    {tierChangeHistory.length === 0 ? (
                      <div style={{ padding: 20, textAlign: "center", color: COLORS.textSecondary, fontSize: 12 }}>No changes recorded yet</div>
                    ) : (
                      tierChangeHistory.map((change) => (
                        <div key={change.id} style={{ display: "grid", gridTemplateColumns: "120px 1fr 1fr 100px", gap: 8, padding: "10px 12px", borderTop: "1px solid " + COLORS.cardBorder, fontSize: 12 }}>
                          <div style={{ color: COLORS.textSecondary }}>{formatDate(change.created_at)}</div>
                          <div style={{ color: COLORS.textSecondary }}>{change.previous_preset || "—"}</div>
                          <div style={{ fontWeight: 600 }}>{change.new_preset || "—"}</div>
                          <div style={{ color: COLORS.neonBlue }}>{change.changed_by}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Save / Cancel */}
                <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                  <button onClick={() => setSelectedBusiness(null)}
                    style={{ padding: "12px 24px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, cursor: "pointer", fontWeight: 600 }}>
                    Cancel
                  </button>
                  <button onClick={handleSaveTiers}
                    style={{ padding: "12px 24px", background: COLORS.gradient1, border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontWeight: 700 }}>
                    💾 Save Changes
                  </button>
                </div>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}