"use client";

import React, { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import {
  COLORS,
  Badge,
  Card,
  SectionTitle,
  EditField,
  DataTable,
  Checklist,
  MediaGrid,
  MediaGridManaged,
  PreviewModal,
  ConfirmModal,
  CollapsibleSection,
  formatDate,
  formatDateTime,
  formatMoney,
} from "@/components/admin/components";
import { logAudit, AUDIT_TABS } from "@/lib/auditLog";

interface UserRecord {
  id: string;
  email: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  phone: string | null;
  location: string | null;
  zip_code: string | null;
  bio: string | null;
  avatar_url: string | null;
  status: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_verified: boolean | null;
  phone_verified: boolean | null;
  suspension_reason: string | null;
  suspended_at: string | null;
  // Activity stats (from profiles, updated via recalculate_user_stats)
  nights_out: number | null;
  places_visited: number | null;
  total_receipts: number | null;
  saved_places: number | null;
  lifetime_payout: number | null;
  this_month_payout: number | null;
  pending_payout: number | null;
  available_balance: number | null;
  // Preferences (JSONB)
  preferences: {
    push_notifications?: boolean;
    email_notifications?: boolean;
    sms_notifications?: boolean;
    marketing_emails?: boolean;
  } | null;
  // Photos/videos (JSONB arrays)
  photos: { id?: string; name?: string; url?: string; status?: "active" | "paused" | "removed"; uploaded_at?: string }[] | null;
  videos: { id?: string; name?: string; url?: string; status?: "active" | "paused" | "removed"; uploaded_at?: string }[] | null;
  // Business levels (JSONB array)
  business_levels: {
    business_name: string;
    level: number;
    visits: number;
    next_level_visits: number;
  }[] | null;
  // History (joined from user_transactions)
  history: {
    type: string;
    date: string;
    business_name?: string;
    amount_cents?: number;
    payout_cents?: number;
    method?: string;
    status: string;
    receipt_image_url?: string;
  }[] | null;
  // User metadata for legacy support
  user_metadata?: {
    full_name?: string;
    user_type?: string;
  };
  // Payment method
  payout_method: string | null;
  payout_identifier: string | null;
  payout_verified: boolean | null;
  min_cashout_cents: number | null;
  // Tax / 1099
  tax_id_on_file: boolean | null;
  w9_status: string | null;
  tax_1099_years: string[] | null;
  // Staff notes (joined from staff_notes table)
  staff_notes: StaffNote[] | null;
}

interface StaffNote {
  id: string;
  author_name: string;
  note: string;
  pinned: boolean;
  created_at: string;
}

interface UserReferral {
  id: string;
  referrer_name: string | null;
  referred_name: string | null;
  referred_business_id: string | null;
  referred_user_id: string | null;
  source: string;
  referral_code: string | null;
  status: string;
  reward_cents: number;
  reward_paid: boolean;
  created_at: string;
}

type StatusFilter = "all" | "active" | "suspended" | "banned";

export default function UsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState({ zipCode: "", phone: "", dateFrom: "", dateTo: "" });
  const hasAdvancedFilters = advancedFilters.zipCode || advancedFilters.phone || advancedFilters.dateFrom || advancedFilters.dateTo;
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [newNote, setNewNote] = useState("");
  const [noteAuthor, setNoteAuthor] = useState("Staff");
  const [preview, setPreview] = useState<{ url: string; type?: string } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    type: "info" | "warning" | "danger";
    confirmText: string;
    onConfirm: () => void;
  } | null>(null);

  // Ban management
  const [showBanModal, setShowBanModal] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [banIsPermanent, setBanIsPermanent] = useState(true);
  const [banExpiresAt, setBanExpiresAt] = useState("");
  const [activeBan, setActiveBan] = useState<{ id: string; reason: string; banned_by: string; is_permanent: boolean; expires_at: string | null; created_at: string } | null>(null);

  // Year-to-date earnings for selected user (for W-9 / 1099 checks)
  const [ytdEarningsCents, setYtdEarningsCents] = useState<number>(0);

  // Referral data for selected user
  const [userReferrals, setUserReferrals] = useState<{
    referredBy: string | null;
    referredByCode: string | null;
    referralsMade: UserReferral[];
    totalBonusEarned: number;
    unpaidBonus: number;
  }>({ referredBy: null, referredByCode: null, referralsMade: [], totalBonusEarned: 0, unpaidBonus: 0 });

  const selected = users.find((u) => u.id === selectedId) || null;

  // Filter users
  const filtered = users.filter((u) => {
    const status = u.status || "active";
    if (statusFilter !== "all" && status !== statusFilter) return false;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const searchable = [u.full_name, u.first_name, u.last_name, u.email, u.username, u.location]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!searchable.includes(query)) return false;
    }

    // Advanced filters
    if (advancedFilters.zipCode) {
      if (!(u.zip_code || "").includes(advancedFilters.zipCode)) return false;
    }
    if (advancedFilters.phone) {
      if (!(u.phone || "").replace(/\D/g, "").includes(advancedFilters.phone.replace(/\D/g, ""))) return false;
    }
    if (advancedFilters.dateFrom) {
      if (u.created_at < advancedFilters.dateFrom) return false;
    }
    if (advancedFilters.dateTo) {
      if (u.created_at > advancedFilters.dateTo + "T23:59:59") return false;
    }

    return true;
  });

  async function fetchUsers() {
    setLoading(true);
    try {
      let data: UserRecord[] = [];
      
      // Fetch profiles with related staff_notes and user_transactions
      const { data: profilesData, error: profilesError } = await supabaseBrowser
        .from("profiles")
        .select("*, staff_notes(*), user_transactions(*)")
        .order("created_at", { ascending: false })
        .limit(500);

      if (!profilesError && profilesData && profilesData.length > 0) {
        // Map the joined data into our UserRecord shape
        data = profilesData.map((p: Record<string, unknown>) => {
          const notes = (p.staff_notes as StaffNote[]) || [];
          const transactions = (p.user_transactions as Record<string, unknown>[]) || [];

          // Sort notes: pinned first, then by date desc
          notes.sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          });

          // Map transactions to history format, sorted by date desc
          const history = transactions
            .sort((a, b) => new Date(String(b.date)).getTime() - new Date(String(a.date)).getTime())
            .slice(0, 50) // Limit to 50 most recent
            .map((t) => ({
              type: String(t.type || "receipt"),
              date: String(t.date || t.created_at),
              business_name: t.business_name ? String(t.business_name) : undefined,
              amount_cents: Number(t.amount_cents) || 0,
              payout_cents: Number(t.payout_cents) || 0,
              method: t.method ? String(t.method) : undefined,
              status: String(t.status || "pending"),
              receipt_image_url: t.receipt_image_url ? String(t.receipt_image_url) : undefined,
            }));

          // Remove joined arrays from profile, spread the rest
          const { staff_notes: _sn, user_transactions: _ut, ...profile } = p;
          return {
            ...profile,
            staff_notes: notes,
            history: history.length > 0 ? history : null,
          } as UserRecord;
        });
      } else {
        // Fallback: try profiles without joins (in case tables don't exist yet)
        const { data: basicProfiles, error: basicError } = await supabaseBrowser
          .from("profiles")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500);

        if (!basicError && basicProfiles) {
          data = basicProfiles.map((p: Record<string, unknown>) => ({
            ...p,
            staff_notes: null,
            history: null,
          })) as UserRecord[];
        } else {
          // Last resort: try RPC
          const { data: authUsers, error: authError } = await supabaseBrowser
            .rpc("get_all_users")
            .limit(500);
          if (!authError && authUsers) {
            data = authUsers;
          }
        }
      }

      setUsers(data || []);

      if (!selectedId && data && data.length > 0) {
        setSelectedId(data[0].id);
      }
    } catch (err) {
      console.error("Error fetching users:", err);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  // Fetch referral data for selected user
  async function fetchUserReferrals(userId: string) {
    try {
      // 1. Check if this user was referred BY someone
      const { data: incomingRef } = await supabaseBrowser
        .from("referrals")
        .select("referrer_name, referral_code, referrer_id")
        .eq("referred_user_id", userId)
        .limit(1);
      const referredBy = incomingRef?.[0]?.referrer_name || (incomingRef?.[0]?.referrer_id ? String(incomingRef[0].referrer_id).slice(0, 8) + "..." : null);
      const referredByCode = incomingRef?.[0]?.referral_code || null;

      // 2. Referrals this user MADE (as referrer)
      const { data: outgoing } = await supabaseBrowser
        .from("referrals")
        .select("*")
        .eq("referrer_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      // Enrich with business names
      const bizIds = (outgoing || []).filter((r) => r.referred_business_id).map((r) => r.referred_business_id);
      let bizMap = new Map<string, string>();
      if (bizIds.length > 0) {
        const { data: bizData } = await supabaseBrowser
          .from("business")
          .select("id, public_business_name, business_name")
          .in("id", bizIds);
        (bizData || []).forEach((b: Record<string, unknown>) => {
          bizMap.set(b.id as string, (b.public_business_name || b.business_name || "Unknown") as string);
        });
      }

      const referralsMade: UserReferral[] = (outgoing || []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        referrer_name: null,
        referred_name: r.referred_business_id ? (bizMap.get(r.referred_business_id as string) || null) : null,
        referred_business_id: r.referred_business_id as string | null,
        referred_user_id: r.referred_user_id as string | null,
        source: (r.source || "direct") as string,
        referral_code: r.referral_code as string | null,
        status: (r.status || "pending") as string,
        reward_cents: Number(r.reward_cents) || 0,
        reward_paid: Boolean(r.reward_paid),
        created_at: r.created_at as string,
      }));

      const totalBonusEarned = referralsMade.filter((r) => r.reward_paid).reduce((s, r) => s + r.reward_cents, 0);
      const unpaidBonus = referralsMade.filter((r) => r.status === "converted" && !r.reward_paid).reduce((s, r) => s + r.reward_cents, 0);

      setUserReferrals({ referredBy, referredByCode, referralsMade, totalBonusEarned, unpaidBonus });
    } catch (err) {
      console.error("Error fetching user referrals:", err);
      setUserReferrals({ referredBy: null, referredByCode: null, referralsMade: [], totalBonusEarned: 0, unpaidBonus: 0 });
    }
  }

  async function fetchYtdEarnings(userId: string) {
    try {
      const yearStart = `${new Date().getFullYear()}-01-01`;
      const { data } = await supabaseBrowser
        .from("receipts")
        .select("payout_cents")
        .eq("user_id", userId)
        .eq("status", "approved")
        .gte("visit_date", yearStart);
      const total = (data || []).reduce((sum, r) => sum + ((r.payout_cents as number) || 0), 0);
      setYtdEarningsCents(total);
    } catch (err) {
      console.error("Error fetching YTD earnings:", err);
      setYtdEarningsCents(0);
    }
  }

  useEffect(() => {
    if (selectedId) {
      fetchUserReferrals(selectedId);
      fetchUserBan(selectedId);
      fetchYtdEarnings(selectedId);
    } else {
      setActiveBan(null);
      setYtdEarningsCents(0);
    }
  }, [selectedId]);

  async function fetchUserBan(userId: string) {
    try {
      const { data } = await supabaseBrowser
        .from("user_bans")
        .select("id, reason, banned_by, is_permanent, expires_at, created_at")
        .eq("user_id", userId)
        .is("lifted_at", null)
        .order("created_at", { ascending: false })
        .limit(1);
      setActiveBan(data && data.length > 0 ? data[0] : null);
    } catch (err) {
      console.error("Error fetching user ban:", err);
      setActiveBan(null);
    }
  }

  async function handleBan() {
    if (!selected || !banReason.trim()) return;
    try {
      const { data: { user: staffUser } } = await supabaseBrowser.auth.getUser();
      const staffId = staffUser?.id || "unknown";

      const { error: banErr } = await supabaseBrowser.from("user_bans").insert({
        user_id: selected.id,
        reason: banReason.trim(),
        banned_by: staffId,
        is_permanent: banIsPermanent,
        expires_at: banIsPermanent ? null : (banExpiresAt || null),
      });
      if (banErr) { alert("Error: " + banErr.message); return; }

      const { error: profileErr } = await supabaseBrowser.from("profiles").update({ status: "banned" }).eq("id", selected.id);
      if (profileErr) { alert("Error updating status: " + profileErr.message); return; }

      logAudit({ action: "ban_user", tab: AUDIT_TABS.USERS, subTab: "User Ban", targetType: "user", targetId: selected.id, entityName: selected.full_name || selected.email || "", fieldName: "status", oldValue: selected.status || "active", newValue: "banned", details: `${banIsPermanent ? "Permanent" : "Temporary"} ban: ${banReason.trim()}` });

      setShowBanModal(false);
      setBanReason("");
      setBanIsPermanent(true);
      setBanExpiresAt("");
      await fetchUsers();
      fetchUserBan(selected.id);
    } catch (err) {
      console.error("Ban error:", err);
    }
  }

  async function handleLiftBan() {
    if (!selected || !activeBan) return;
    try {
      const { data: { user: staffUser } } = await supabaseBrowser.auth.getUser();
      const staffId = staffUser?.id || "unknown";

      const { error: liftErr } = await supabaseBrowser.from("user_bans").update({
        lifted_at: new Date().toISOString(),
        lifted_by: staffId,
      }).eq("id", activeBan.id);
      if (liftErr) { alert("Error: " + liftErr.message); return; }

      const { error: profileErr } = await supabaseBrowser.from("profiles").update({ status: "active", suspension_reason: null, suspended_at: null }).eq("id", selected.id);
      if (profileErr) { alert("Error updating status: " + profileErr.message); return; }

      logAudit({ action: "lift_ban", tab: AUDIT_TABS.USERS, subTab: "User Ban", targetType: "user", targetId: selected.id, entityName: selected.full_name || selected.email || "", fieldName: "status", oldValue: "banned", newValue: "active", details: `Ban lifted (was: ${activeBan.reason})` });

      setActiveBan(null);
      await fetchUsers();
    } catch (err) {
      console.error("Lift ban error:", err);
    }
  }

  async function handleStatusChange(newStatus: string, reason?: string) {
    if (!selected) return;

    try {
      const updates: Partial<UserRecord> = {
        status: newStatus,
      };
      if (newStatus === "suspended" && reason) {
        updates.suspension_reason = reason;
        updates.suspended_at = new Date().toISOString();
      } else if (newStatus === "active") {
        updates.suspension_reason = null;
        updates.suspended_at = null;
      }

      const { error } = await supabaseBrowser.from("profiles").update(updates).eq("id", selected.id);

      if (error) {
        alert("Error: " + error.message);
        return;
      }

      await fetchUsers();
      logAudit({ action: "change_user_status", tab: AUDIT_TABS.USERS, subTab: "User Status", targetType: "user", targetId: selected.id, entityName: selected.full_name || selected.email || "", fieldName: "status", oldValue: selected.status || "active", newValue: newStatus, details: reason || "" });
      setConfirmModal(null);
    } catch (err) {
      console.error("Status change error:", err);
    }
  }

  async function handleCashout() {
    if (!selected) return;
    const balanceCents = selected.available_balance || 0;
    if (balanceCents <= 0) {
      alert("User has no available balance to cash out.");
      return;
    }
    try {
      const res = await fetch("/api/admin/cashout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selected.id, amountCents: balanceCents }),
      });
      const result = await res.json();
      if (!res.ok) {
        alert("Error processing cashout: " + (result.error || "Unknown error"));
        return;
      }

      logAudit({ action: "initiate_cashout", tab: AUDIT_TABS.USERS, subTab: "Activity & Balance", targetType: "user", targetId: selected.id, entityName: selected.full_name || selected.email || "", fieldName: "available_balance", oldValue: formatMoney(balanceCents), newValue: "$0.00", details: `Admin-initiated cashout, payout ID: ${result.payoutId}` });
      alert(`Cashout of ${formatMoney(balanceCents)} initiated for ${selected.full_name || selected.email}.\n\nPayout ID: ${result.payoutId}\nStatus: pending`);
      setConfirmModal(null);
      await fetchUsers();
    } catch (err) {
      console.error("Cashout error:", err);
      alert("Error processing cashout.");
    }
  }

  // Pay all unpaid referral bonuses for selected user
  async function handlePayUserReferralBonus() {
    if (!selected) return;
    const unpaid = userReferrals.referralsMade.filter((r) => r.status === "converted" && !r.reward_paid);
    if (unpaid.length === 0) { alert("No unpaid bonuses."); return; }
    for (const r of unpaid) {
      await supabaseBrowser.from("referrals").update({ reward_paid: true, paid_at: new Date().toISOString() }).eq("id", r.id);
    }
    const total = unpaid.reduce((s, r) => s + r.reward_cents, 0);
    logAudit({ action: "pay_referral_bonus", tab: AUDIT_TABS.USERS, subTab: "Referral Activity", targetType: "user", targetId: selected.id, entityName: selected.full_name || selected.email || "", fieldName: "referral_bonus", details: `Paid ${formatMoney(total)} across ${unpaid.length} referral(s)` });
    alert(`✅ Paid ${formatMoney(total)} across ${unpaid.length} referral(s) for ${selected.full_name || selected.email}`);
    await fetchUserReferrals(selected.id);
  }

  // Staff Notes CRUD
  async function handleAddNote() {
    if (!selected || !newNote.trim()) return;
    try {
      const { error } = await supabaseBrowser
        .from("staff_notes")
        .insert({
          user_id: selected.id,
          author_name: noteAuthor || "Staff",
          note: newNote.trim(),
          pinned: false,
        });
      if (error) {
        alert("Error adding note: " + error.message);
        return;
      }
      setNewNote("");
      await fetchUsers();
    } catch (err) {
      console.error("Add note error:", err);
    }
  }

  async function handleDeleteNote(noteId: string) {
    try {
      const { error } = await supabaseBrowser
        .from("staff_notes")
        .delete()
        .eq("id", noteId);
      if (error) {
        alert("Error deleting note: " + error.message);
        return;
      }
      await fetchUsers();
    } catch (err) {
      console.error("Delete note error:", err);
    }
  }

  async function handleTogglePinNote(noteId: string, currentPinned: boolean) {
    try {
      const { error } = await supabaseBrowser
        .from("staff_notes")
        .update({ pinned: !currentPinned })
        .eq("id", noteId);
      if (error) {
        alert("Error updating note: " + error.message);
        return;
      }
      await fetchUsers();
    } catch (err) {
      console.error("Pin note error:", err);
    }
  }

  async function handleSaveChanges() {
    if (!selected) return;
    
    try {
      const updates: Record<string, unknown> = {};
      if (editForm.first_name !== undefined) updates.first_name = editForm.first_name;
      if (editForm.last_name !== undefined) updates.last_name = editForm.last_name;
      // Auto-construct full_name from first + last if either changed
      if (editForm.first_name !== undefined || editForm.last_name !== undefined) {
        const fn = (editForm.first_name ?? selected.first_name ?? "").trim();
        const ln = (editForm.last_name ?? selected.last_name ?? "").trim();
        updates.full_name = [fn, ln].filter(Boolean).join(" ") || null;
      }
      if (editForm.username !== undefined) updates.username = editForm.username;
      if (editForm.email !== undefined) updates.email = editForm.email;
      if (editForm.phone !== undefined) updates.phone = editForm.phone;
      if (editForm.location !== undefined) updates.location = editForm.location;
      if (editForm.zip_code !== undefined) updates.zip_code = editForm.zip_code;
      if (editForm.bio !== undefined) updates.bio = editForm.bio;
      if (editForm.payout_method !== undefined) {
        updates.payout_method = editForm.payout_method || null;
        // Reset verification if method changed
        if (editForm.payout_method !== (selected.payout_method || "")) {
          updates.payout_verified = false;
        }
      }
      if (editForm.payout_identifier !== undefined) {
        updates.payout_identifier = editForm.payout_identifier || null;
        updates.payout_verified = false;
      }

      if (Object.keys(updates).length === 0) {
        setIsEditing(false);
        return;
      }

      const { error } = await supabaseBrowser
        .from("profiles")
        .update(updates)
        .eq("id", selected.id);

      if (error) {
        console.error("Error saving user:", error);
        alert("Error saving changes: " + error.message);
        return;
      }

      await fetchUsers();
      logAudit({ action: "update_user_profile", tab: AUDIT_TABS.USERS, subTab: "Profile Information", targetType: "user", targetId: selected.id, entityName: selected.full_name || selected.email || "", fieldName: Object.keys(updates).join(", "), oldValue: Object.keys(updates).map(k => k + ": " + JSON.stringify((selected as unknown as Record<string, unknown>)[k])).join(", "), newValue: Object.keys(updates).map(k => k + ": " + JSON.stringify(updates[k])).join(", ") });
      setIsEditing(false);
      setEditForm({});
      alert("Changes saved successfully!");
    } catch (err) {
      console.error("Save error:", err);
      alert("Error saving changes. Please try again.");
    }
  }

  // Calculate membership duration
  function getMembershipInfo(createdAt: string) {
    const memberDate = new Date(createdAt);
    const now = new Date();
    const monthsDiff = (now.getFullYear() - memberDate.getFullYear()) * 12 + (now.getMonth() - memberDate.getMonth());
    const yearsDiff = Math.floor(monthsDiff / 12);
    const nextAnniversary = new Date(memberDate);
    nextAnniversary.setFullYear(now.getFullYear());
    if (nextAnniversary < now) nextAnniversary.setFullYear(now.getFullYear() + 1);
    const daysToAnniversary = Math.ceil((nextAnniversary.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return {
      duration: yearsDiff > 0 ? `${yearsDiff}y` : `${monthsDiff}mo`,
      daysToAnniversary,
    };
  }

  // Get initials for avatar fallback
  function getInitials(name: string | null): string {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  }

  const status = selected?.status || "active";

  // CSV download helper
  function downloadCSV(filename: string, headers: string[], rows: string[][]) {
    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ display: "flex", height: "calc(100vh - 60px)" }}>
      {/* Modals */}
      <PreviewModal preview={preview} onClose={() => setPreview(null)} />
      {confirmModal && (
        <ConfirmModal
          title={confirmModal.title}
          message={confirmModal.message}
          type={confirmModal.type}
          confirmText={confirmModal.confirmText}
          onClose={() => setConfirmModal(null)}
          onConfirm={confirmModal.onConfirm}
        />
      )}

      {/* Ban Modal */}
      {showBanModal && selected && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setShowBanModal(false)}>
          <div style={{ background: COLORS.cardBg, borderRadius: 16, padding: 32, width: 480, maxWidth: "90vw", border: "1px solid " + COLORS.neonRed }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, color: COLORS.neonRed }}>⛔ Ban User</h2>
            <p style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 20 }}>
              Banning <strong style={{ color: "#fff" }}>{selected.full_name || selected.email}</strong> will block all platform access.
            </p>

            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: COLORS.textSecondary }}>Reason *</label>
            <textarea
              value={banReason}
              onChange={e => setBanReason(e.target.value)}
              placeholder="Why is this user being banned?"
              rows={3}
              style={{ width: "100%", padding: "10px 14px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: "#fff", fontSize: 13, resize: "vertical", marginBottom: 16 }}
            />

            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 8, color: COLORS.textSecondary }}>Ban Type</label>
            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              <button
                onClick={() => setBanIsPermanent(true)}
                style={{ flex: 1, padding: "10px 16px", borderRadius: 8, border: banIsPermanent ? "2px solid " + COLORS.neonRed : "1px solid " + COLORS.cardBorder, background: banIsPermanent ? "rgba(255,49,49,0.15)" : COLORS.darkBg, color: banIsPermanent ? COLORS.neonRed : COLORS.textSecondary, fontWeight: 600, fontSize: 13, cursor: "pointer" }}
              >
                Permanent
              </button>
              <button
                onClick={() => setBanIsPermanent(false)}
                style={{ flex: 1, padding: "10px 16px", borderRadius: 8, border: !banIsPermanent ? "2px solid " + COLORS.neonOrange : "1px solid " + COLORS.cardBorder, background: !banIsPermanent ? "rgba(255,107,53,0.15)" : COLORS.darkBg, color: !banIsPermanent ? COLORS.neonOrange : COLORS.textSecondary, fontWeight: 600, fontSize: 13, cursor: "pointer" }}
              >
                Temporary
              </button>
            </div>

            {!banIsPermanent && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: COLORS.textSecondary }}>Expires On</label>
                <input
                  type="date"
                  value={banExpiresAt}
                  onChange={e => setBanExpiresAt(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  style={{ width: "100%", padding: "10px 14px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: "#fff", fontSize: 13 }}
                />
              </div>
            )}

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 8 }}>
              <button
                onClick={() => { setShowBanModal(false); setBanReason(""); setBanIsPermanent(true); setBanExpiresAt(""); }}
                style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid " + COLORS.cardBorder, background: "transparent", color: COLORS.textSecondary, fontWeight: 600, fontSize: 13, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={handleBan}
                disabled={!banReason.trim()}
                style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: COLORS.neonRed, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: banReason.trim() ? 1 : 0.4 }}
              >
                Confirm Ban
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Left Sidebar - User List */}
      <aside
        style={{
          width: 360,
          borderRight: "1px solid " + COLORS.cardBorder,
          display: "flex",
          flexDirection: "column",
          background: COLORS.cardBg,
          flexShrink: 0,
        }}
      >
        {/* Header */}
        <div style={{ padding: 20, borderBottom: "1px solid " + COLORS.cardBorder }}>
          <h2
            style={{
              fontSize: 22,
              fontWeight: 700,
              marginBottom: 16,
              background: COLORS.gradient1,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            👥 Users
          </h2>

          {/* Search */}
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid " + COLORS.cardBorder,
              background: COLORS.darkBg,
              color: COLORS.textPrimary,
              fontSize: 13,
              marginBottom: 12,
            }}
          />

          {/* Status Filter */}
          <div style={{ display: "flex", gap: 8 }}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              style={{
                flex: 1,
                padding: "10px 12px",
                border: "1px solid " + COLORS.cardBorder,
                borderRadius: 8,
                fontSize: 12,
                background: COLORS.darkBg,
                color: COLORS.textPrimary,
              }}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="banned">Banned</option>
            </select>
          </div>

          {/* Advanced Filters Toggle */}
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            style={{
              width: "100%",
              padding: 10,
              marginTop: 10,
              background: COLORS.darkBg,
              border: "1px solid " + COLORS.cardBorder,
              borderRadius: 8,
              color: hasAdvancedFilters ? COLORS.neonYellow : COLORS.textSecondary,
              fontSize: 12,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            🔍 Advanced Filters {hasAdvancedFilters ? "⚠" : ""} {showAdvancedFilters ? "▲" : "▼"}
          </button>

          {/* Advanced Filters Panel */}
          {showAdvancedFilters && (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: COLORS.textSecondary, marginBottom: 4, textTransform: "uppercase" }}>ZIP Code</label>
                  <input
                    type="text"
                    placeholder="ZIP..."
                    value={advancedFilters.zipCode}
                    onChange={(e) => setAdvancedFilters({ ...advancedFilters, zipCode: e.target.value.replace(/\D/g, "").slice(0, 5) })}
                    maxLength={5}
                    style={{ width: "100%", padding: "8px 10px", border: "1px solid " + COLORS.cardBorder, borderRadius: 6, fontSize: 11, background: COLORS.cardBg, color: COLORS.textPrimary }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: COLORS.textSecondary, marginBottom: 4, textTransform: "uppercase" }}>Phone</label>
                  <input
                    type="text"
                    placeholder="Phone..."
                    value={advancedFilters.phone}
                    onChange={(e) => setAdvancedFilters({ ...advancedFilters, phone: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", border: "1px solid " + COLORS.cardBorder, borderRadius: 6, fontSize: 11, background: COLORS.cardBg, color: COLORS.textPrimary }}
                  />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: COLORS.textSecondary, marginBottom: 4, textTransform: "uppercase" }}>Date From</label>
                  <input
                    type="date"
                    value={advancedFilters.dateFrom}
                    onChange={(e) => setAdvancedFilters({ ...advancedFilters, dateFrom: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", border: "1px solid " + COLORS.cardBorder, borderRadius: 6, fontSize: 11, background: COLORS.cardBg, color: COLORS.textPrimary, colorScheme: "dark" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: COLORS.textSecondary, marginBottom: 4, textTransform: "uppercase" }}>Date To</label>
                  <input
                    type="date"
                    value={advancedFilters.dateTo}
                    onChange={(e) => setAdvancedFilters({ ...advancedFilters, dateTo: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", border: "1px solid " + COLORS.cardBorder, borderRadius: 6, fontSize: 11, background: COLORS.cardBg, color: COLORS.textPrimary, colorScheme: "dark" }}
                  />
                </div>
              </div>
              <button
                onClick={() => setAdvancedFilters({ zipCode: "", phone: "", dateFrom: "", dateTo: "" })}
                style={{ padding: 8, background: "transparent", border: "1px solid " + COLORS.cardBorder, borderRadius: 6, color: COLORS.textSecondary, fontSize: 11, cursor: "pointer" }}
              >
                Clear All Filters
              </button>
            </div>
          )}
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {/* W-9 Attention Summary */}
          {(() => {
            const needsW9 = users.filter((u) => (u.this_month_payout || 0) >= 60000 && u.w9_status !== "received").length;
            const approachingW9 = users.filter((u) => { const ytd = u.this_month_payout || 0; return ytd >= 40000 && ytd < 60000 && u.w9_status !== "received"; }).length;
            const noPayment = users.filter((u) => !u.payout_method && (u.this_month_payout || 0) > 0).length;
            return (
              <div style={{ padding: "10px 14px", margin: "0 12px 8px", borderRadius: 8, background: needsW9 > 0 ? "rgba(255,49,49,0.08)" : approachingW9 > 0 ? "rgba(255,255,0,0.06)" : "rgba(57,255,20,0.05)", border: needsW9 > 0 ? "1px solid rgba(255,49,49,0.2)" : approachingW9 > 0 ? "1px solid rgba(255,255,0,0.15)" : "1px solid rgba(57,255,20,0.1)", fontSize: 11 }}>
                {needsW9 > 0 && <div style={{ color: COLORS.neonRed, fontWeight: 700 }}>🔒 {needsW9} user{needsW9 !== 1 ? "s" : ""} need W-9 (cashouts locked)</div>}
                {approachingW9 > 0 && <div style={{ color: COLORS.neonYellow, fontWeight: 600, marginTop: needsW9 > 0 ? 2 : 0 }}>⚡ {approachingW9} user{approachingW9 !== 1 ? "s" : ""} approaching $600</div>}
                {noPayment > 0 && <div style={{ color: COLORS.textSecondary, fontWeight: 600, marginTop: (needsW9 > 0 || approachingW9 > 0) ? 2 : 0 }}>💳 {noPayment} user{noPayment !== 1 ? "s" : ""} missing payment method</div>}
                {needsW9 === 0 && approachingW9 === 0 && noPayment === 0 && <div style={{ color: COLORS.neonGreen, fontWeight: 600 }}>✓ All users compliant — no W-9 or payment issues</div>}
              </div>
            );
          })()}
          {loading ? (
            <div style={{ padding: 20, color: COLORS.textSecondary, textAlign: "center" }}>Loading...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary }}>No users found</div>
          ) : (
            filtered.map((user) => {
              const isSelected = user.id === selectedId;
              const userStatus = user.status || "active";
              const displayName = user.full_name || [user.first_name, user.last_name].filter(Boolean).join(" ") || user.user_metadata?.full_name || user.email || "Unknown";

              return (
                <button
                  key={user.id}
                  onClick={() => {
                    setSelectedId(user.id);
                    setIsEditing(false);
                    setNewNote("");
                  }}
                  style={{
                    width: "100%",
                    padding: "16px 20px",
                    border: "none",
                    background: isSelected ? COLORS.darkBg : "transparent",
                    borderLeft: isSelected ? "4px solid " + COLORS.neonPink : "4px solid transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    borderBottom: "1px solid " + COLORS.cardBorder,
                    transition: "all 0.2s",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  {/* Avatar */}
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt=""
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        objectFit: "cover",
                        border: "2px solid " + COLORS.neonPink,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        background: COLORS.gradient1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 14,
                        fontWeight: 700,
                        color: "#fff",
                      }}
                    >
                      {getInitials(displayName)}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span
                        style={{
                          fontWeight: 600,
                          color: COLORS.textPrimary,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {displayName}
                      </span>
                      <Badge status={userStatus} />
                    </div>
                    <div style={{ fontSize: 12, color: COLORS.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {user.email}
                    </div>
                    {user.location && (
                      <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 2 }}>📍 {user.location}</div>
                    )}
                    {(() => {
                      const ytd = user.this_month_payout || 0;
                      const hasW9 = user.w9_status === "received";
                      if (ytd >= 60000 && !hasW9) return (
                        <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.neonRed, marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
                          🔒 W-9 Required — Cashouts Locked
                        </div>
                      );
                      if (ytd >= 40000 && !hasW9) return (
                        <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.neonYellow, marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
                          ⚡ W-9 Needed — {formatMoney(ytd)} YTD
                        </div>
                      );
                      if (!user.payout_method && ytd > 0) return (
                        <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.textSecondary, marginTop: 3 }}>
                          💳 No payment method
                        </div>
                      );
                      return null;
                    })()}
                    {/* Staff notes indicator */}
                    {user.staff_notes && user.staff_notes.length > 0 && (
                      <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.neonBlue, marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
                        📝 {user.staff_notes.length} note{user.staff_notes.length !== 1 ? "s" : ""}
                        {user.staff_notes.some((n) => n.pinned) && <span style={{ color: COLORS.neonYellow }}>• 📌 pinned</span>}
                      </div>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Right Side - Detail View */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: COLORS.darkBg, overflow: "hidden" }}>
        {!selected ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 72, marginBottom: 20 }}>👈</div>
              <div style={{ color: COLORS.textSecondary, fontSize: 16 }}>Select a user from the list to view details</div>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <header
              style={{
                padding: "24px 32px",
                background: COLORS.cardBg,
                borderBottom: "1px solid " + COLORS.cardBorder,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                {/* Avatar */}
                {selected.avatar_url ? (
                  <img
                    src={selected.avatar_url}
                    alt=""
                    style={{
                      width: 70,
                      height: 70,
                      borderRadius: "50%",
                      border: "3px solid " + COLORS.neonPink,
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 70,
                      height: 70,
                      borderRadius: "50%",
                      background: COLORS.gradient1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 26,
                      fontWeight: 700,
                    }}
                  >
                    {getInitials(selected.full_name || [selected.first_name, selected.last_name].filter(Boolean).join(" ") || selected.email)}
                  </div>
                )}
                <div>
                  <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>
                    {selected.full_name || [selected.first_name, selected.last_name].filter(Boolean).join(" ") || selected.user_metadata?.full_name || selected.email || "Unknown User"}
                  </h1>
                  <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                    <Badge status={status} />
                    {selected.username && <span style={{ color: COLORS.textSecondary }}>@{selected.username}</span>}
                    {selected.location && (
                      <>
                        <span style={{ color: COLORS.textSecondary }}>•</span>
                        <span style={{ color: COLORS.textSecondary }}>📍 {selected.location}</span>
                      </>
                    )}
                    {(() => {
                      const info = getMembershipInfo(selected.created_at);
                      return (
                        <>
                          <span style={{ color: COLORS.textSecondary }}>•</span>
                          <span style={{ color: COLORS.textSecondary }}>🗓️ Since {formatDate(selected.created_at)}</span>
                          <span
                            style={{
                              fontSize: 12,
                              padding: "4px 10px",
                              background: "rgba(138,43,226,0.2)",
                              borderRadius: 6,
                              color: COLORS.neonPurple,
                            }}
                          >
                            {info.duration}
                          </span>
                          {info.daysToAnniversary <= 30 && info.daysToAnniversary >= 0 && (
                            <span
                              style={{
                                fontSize: 12,
                                padding: "4px 10px",
                                background: "rgba(255,45,146,0.2)",
                                borderRadius: 6,
                                color: COLORS.neonPink,
                              }}
                            >
                              🎂 {info.daysToAnniversary}d to anniversary
                            </span>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => {
                    if (isEditing) {
                      handleSaveChanges();
                    } else {
                      setEditForm({});
                      setIsEditing(true);
                    }
                  }}
                  style={{
                    padding: "10px 18px",
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    background: isEditing ? COLORS.gradient2 : COLORS.gradient1,
                    border: "none",
                    color: isEditing ? "#000" : "#fff",
                  }}
                >
                  {isEditing ? "💾 Save" : "✏️ Edit"}
                </button>
                {status === "suspended" && (
                  <button
                    onClick={() =>
                      setConfirmModal({
                        title: "Reactivate User?",
                        message: `This will reactivate ${selected.full_name || selected.email}'s account. They will regain full access to the platform.`,
                        type: "info",
                        confirmText: "Reactivate",
                        onConfirm: () => handleStatusChange("active"),
                      })
                    }
                    style={{
                      padding: "10px 18px",
                      borderRadius: 10,
                      background: "rgba(57,255,20,0.2)",
                      border: "none",
                      color: COLORS.neonGreen,
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    ✅ Reactivate
                  </button>
                )}
                {status === "active" && (
                  <button
                    onClick={() =>
                      setConfirmModal({
                        title: "Suspend User?",
                        message: `This will suspend ${selected.full_name || selected.email}'s account. They will lose access to all features.`,
                        type: "danger",
                        confirmText: "Suspend",
                        onConfirm: () => handleStatusChange("suspended", "Suspended by admin"),
                      })
                    }
                    style={{
                      padding: "10px 18px",
                      borderRadius: 10,
                      background: "rgba(255,49,49,0.2)",
                      border: "none",
                      color: COLORS.neonRed,
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    🚫 Suspend
                  </button>
                )}
                {status === "active" && (
                  <button
                    onClick={() => setShowBanModal(true)}
                    style={{
                      padding: "10px 18px",
                      borderRadius: 10,
                      background: "rgba(255,49,49,0.35)",
                      border: "1px solid " + COLORS.neonRed,
                      color: COLORS.neonRed,
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    ⛔ Ban
                  </button>
                )}
                {status === "banned" && (
                  <button
                    onClick={() =>
                      setConfirmModal({
                        title: "Lift Ban?",
                        message: `This will lift the ban on ${selected.full_name || selected.email}'s account and restore full access.`,
                        type: "info",
                        confirmText: "Lift Ban",
                        onConfirm: () => handleLiftBan(),
                      })
                    }
                    style={{
                      padding: "10px 18px",
                      borderRadius: 10,
                      background: "rgba(57,255,20,0.2)",
                      border: "none",
                      color: COLORS.neonGreen,
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    ✅ Lift Ban
                  </button>
                )}
              </div>
            </header>

            {/* Content */}
            <div style={{ flex: 1, overflowY: "auto", padding: 32 }}>
              <div style={{ maxWidth: 1100 }}>
                {/* Suspension Warning */}
                {selected.suspension_reason && (
                  <div
                    style={{
                      background: "rgba(255,49,49,0.1)",
                      border: "1px solid " + COLORS.neonRed,
                      borderRadius: 12,
                      padding: 20,
                      marginBottom: 24,
                    }}
                  >
                    <div style={{ fontWeight: 700, color: COLORS.neonRed, fontSize: 16 }}>⚠️ Account Suspended</div>
                    <div style={{ color: COLORS.textSecondary, marginTop: 8 }}>{selected.suspension_reason}</div>
                    {selected.suspended_at && (
                      <div style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 8 }}>
                        Suspended on: {formatDateTime(selected.suspended_at)}
                      </div>
                    )}
                  </div>
                )}

                {/* Ban Warning */}
                {activeBan && (
                  <div
                    style={{
                      background: "rgba(255,49,49,0.15)",
                      border: "2px solid " + COLORS.neonRed,
                      borderRadius: 12,
                      padding: 20,
                      marginBottom: 24,
                    }}
                  >
                    <div style={{ fontWeight: 700, color: COLORS.neonRed, fontSize: 16 }}>⛔ Account Banned</div>
                    <div style={{ color: COLORS.textSecondary, marginTop: 8 }}>{activeBan.reason}</div>
                    <div style={{ display: "flex", gap: 20, marginTop: 10, fontSize: 12, color: COLORS.textSecondary }}>
                      <span>Type: <strong style={{ color: activeBan.is_permanent ? COLORS.neonRed : COLORS.neonOrange }}>{activeBan.is_permanent ? "Permanent" : "Temporary"}</strong></span>
                      <span>Banned on: {formatDateTime(activeBan.created_at)}</span>
                      {!activeBan.is_permanent && activeBan.expires_at && (
                        <span>Expires: {formatDateTime(activeBan.expires_at)}</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Profile Information */}
                <SectionTitle icon="👤">Profile Information</SectionTitle>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
                  <Card title="Personal Details">
                    <EditField label="First Name" value={editForm.first_name ?? selected.first_name} editable={isEditing} onChange={(v) => setEditForm({ ...editForm, first_name: v })} />
                    <EditField label="Last Name" value={editForm.last_name ?? selected.last_name} editable={isEditing} onChange={(v) => setEditForm({ ...editForm, last_name: v })} />
                    <EditField label="Username" value={editForm.username ?? selected.username} editable={isEditing} onChange={(v) => setEditForm({ ...editForm, username: v })} />
                    <EditField label="Email" value={editForm.email ?? selected.email} type="email" editable={isEditing} onChange={(v) => setEditForm({ ...editForm, email: v })} />
                    <EditField label="Phone" value={editForm.phone ?? selected.phone} type="tel" editable={isEditing} onChange={(v) => {
                      const digits = v.replace(/\D/g, "").slice(0, 10);
                      let formatted = digits;
                      if (digits.length > 6) formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
                      else if (digits.length > 3) formatted = `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
                      else if (digits.length > 0) formatted = `(${digits}`;
                      setEditForm({ ...editForm, phone: formatted });
                    }} />
                    <EditField label="Location" value={editForm.location ?? selected.location} editable={isEditing} onChange={(v) => setEditForm({ ...editForm, location: v })} />
                    <EditField label="ZIP Code" value={editForm.zip_code ?? selected.zip_code} editable={isEditing} onChange={(v) => setEditForm({ ...editForm, zip_code: v.replace(/\D/g, "").slice(0, 5) })} />
                    <EditField label="Bio" value={editForm.bio ?? selected.bio} textarea editable={isEditing} onChange={(v) => setEditForm({ ...editForm, bio: v })} />
                  </Card>
                  <Card title="Account Status">
                    <EditField label="Status" value={selected.status || "active"} editable={false} />
                    <EditField label="Email Verified" value={selected.email_verified ? "✓ Yes" : "✗ No"} editable={false} />
                    <EditField label="Phone Verified" value={selected.phone_verified ? "✓ Yes" : "✗ No"} editable={false} />
                    <div style={{ marginTop: 16, padding: 16, background: COLORS.darkBg, borderRadius: 10 }}>
                      <div style={{ fontSize: 11, color: COLORS.textSecondary }}>Member Since</div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{formatDate(selected.created_at)}</div>
                    </div>
                    {selected.last_sign_in_at && (
                      <div style={{ marginTop: 12, padding: 16, background: COLORS.darkBg, borderRadius: 10 }}>
                        <div style={{ fontSize: 11, color: COLORS.textSecondary }}>Last Sign In</div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{formatDateTime(selected.last_sign_in_at)}</div>
                      </div>
                    )}
                  </Card>
                </div>

                {/* Activity & Balance */}
                <SectionTitle icon="📊">Activity & Balance</SectionTitle>
                {/* Tax compliance alert banners */}
                {(() => {
                  const ytd = selected.this_month_payout || 0;
                  const hasW9 = selected.w9_status === "received";
                  if (ytd >= 60000 && !hasW9) return (
                    <div style={{ padding: 14, marginBottom: 12, borderRadius: 10, background: "rgba(255,49,49,0.1)", border: "1px solid rgba(255,49,49,0.3)", display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 20 }}>🔒</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: COLORS.neonRed }}>Cashouts Locked — W-9 Required</div>
                        <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 2 }}>
                          This user has earned {formatMoney(ytd)} YTD (over $600 threshold). A W-9 must be received before any further cashouts can be processed.
                          {!selected.tax_id_on_file && " Tax ID is also not on file."}
                        </div>
                      </div>
                    </div>
                  );
                  if (ytd >= 40000 && ytd < 60000 && !hasW9) return (
                    <div style={{ padding: 14, marginBottom: 12, borderRadius: 10, background: "rgba(255,255,0,0.06)", border: "1px solid rgba(255,255,0,0.2)", display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 20 }}>⚡</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: COLORS.neonYellow }}>W-9 Recommended — Approaching $600 Threshold</div>
                        <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 2 }}>
                          This user has earned {formatMoney(ytd)} YTD. Consider requesting a W-9 now to avoid cashout delays when they cross $600.
                        </div>
                      </div>
                    </div>
                  );
                  return null;
                })()}
                <Card style={{ marginBottom: 24 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
                    {[
                      { val: selected.nights_out || 0, label: "Nights Out", c: COLORS.neonPink },
                      { val: selected.places_visited || 0, label: "Places Visited", c: COLORS.neonBlue },
                      { val: selected.total_receipts || 0, label: "Total Receipts", c: COLORS.neonGreen },
                      { val: selected.saved_places || 0, label: "Saved Places", c: COLORS.neonYellow },
                    ].map((s, i) => (
                      <div key={i} style={{ textAlign: "center", padding: 20, background: COLORS.darkBg, borderRadius: 12 }}>
                        <div style={{ fontSize: 28, fontWeight: 700, color: s.c }}>{s.val}</div>
                        <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 4 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
                    {[
                      { val: formatMoney(selected.lifetime_payout || 0), label: "Lifetime Earnings", g: COLORS.gradient2 },
                      { val: formatMoney(selected.this_month_payout || 0), label: "This Month", g: COLORS.gradient1 },
                      { val: formatMoney(selected.pending_payout || 0), label: "Pending", g: COLORS.gradient4 },
                      { val: formatMoney(selected.available_balance || 0), label: "Available Balance", g: COLORS.gradient3 },
                    ].map((s, i) => (
                      <div key={i} style={{ textAlign: "center", padding: 20, background: s.g, borderRadius: 12 }}>
                        <div style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>{s.val}</div>
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.8)", marginTop: 4 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                  {/* Cashout Button */}
                  <div style={{ padding: 16, background: COLORS.darkBg, borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>Progressive Payout Balance</div>
                      <div style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 4 }}>
                        {(selected.available_balance || 0) > 0
                          ? `${selected.full_name || selected.email} has ${formatMoney(selected.available_balance || 0)} available to cash out`
                          : `${selected.full_name || selected.email} has no balance to cash out`}
                      </div>
                    </div>
                    {(() => {
                      const bal = selected.available_balance || 0;
                      const minCashout = selected.min_cashout_cents || 2000;
                      const hasPayment = !!selected.payout_method && !!selected.payout_identifier;
                      const ytdEarnings = ytdEarningsCents;
                      const w9Threshold = 60000; // $600 in cents
                      const w9Warning = 40000; // $400 — start nagging
                      const needsW9 = ytdEarnings >= w9Threshold && selected.w9_status !== "received";
                      const approachingW9 = ytdEarnings >= w9Warning && ytdEarnings < w9Threshold && selected.w9_status !== "received";
                      const canCashout = bal > 0 && bal >= minCashout && hasPayment && !needsW9;
                      const reason = needsW9
                        ? "🔒 W-9 required — over $600 YTD"
                        : !hasPayment
                        ? "No payment method on file"
                        : bal === 0
                        ? "No balance"
                        : bal < minCashout
                        ? `Below ${formatMoney(minCashout)} minimum`
                        : "";

                      return (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                          <button
                            onClick={() =>
                              setConfirmModal({
                                title: "Process Cashout?",
                                message: `This will initiate a cashout of ${formatMoney(bal)} to ${selected.full_name || selected.email}'s ${selected.payout_method === "venmo" ? "Venmo" : "PayPal"} (${selected.payout_identifier}).`,
                                type: "info",
                                confirmText: "Process Cashout",
                                onConfirm: () => handleCashout(),
                              })
                            }
                            disabled={!canCashout}
                            style={{
                              padding: "12px 24px",
                              borderRadius: 10,
                              fontSize: 14,
                              fontWeight: 700,
                              cursor: canCashout ? "pointer" : "not-allowed",
                              background: canCashout ? COLORS.gradient2 : COLORS.darkBg,
                              border: canCashout ? "none" : "1px solid " + COLORS.cardBorder,
                              color: canCashout ? "#000" : COLORS.textSecondary,
                              whiteSpace: "nowrap",
                              opacity: canCashout ? 1 : 0.6,
                            }}
                          >
                            {needsW9 ? "🔒" : "💰"} Cash Out {formatMoney(bal)}
                          </button>
                          {!canCashout && reason && (
                            <div style={{ fontSize: 10, color: COLORS.neonRed }}>{reason}</div>
                          )}
                          {approachingW9 && (
                            <div style={{ fontSize: 10, color: COLORS.neonYellow }}>
                              ⚡ At {formatMoney(ytdEarnings)} YTD — W-9 needed at $600
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </Card>

                {/* Business Loyalty Levels */}
                <SectionTitle icon="⭐">Business Loyalty Levels</SectionTitle>
                <Card style={{ marginBottom: 24 }}>
                  {!selected.business_levels || selected.business_levels.length === 0 ? (
                    <div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary }}>
                      <div style={{ fontSize: 28, marginBottom: 8 }}>⭐</div>
                      No loyalty levels yet — visits to businesses will appear here
                    </div>
                  ) : (
                    selected.business_levels.map((bl, i) => (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: 18,
                            background: COLORS.darkBg,
                            borderRadius: 12,
                            marginBottom: i < selected.business_levels!.length - 1 ? 10 : 0,
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 15 }}>{bl.business_name}</div>
                            <div style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 4 }}>
                              {bl.visits} visits • Next level at {bl.next_level_visits} visits
                            </div>
                          </div>
                          <div
                            style={{
                              padding: "10px 20px",
                              background: COLORS.gradient1,
                              borderRadius: 100,
                              fontWeight: 700,
                              fontSize: 14,
                            }}
                          >
                            Level {bl.level}
                          </div>
                        </div>
                      ))
                  )}
                    </Card>

                {/* Recent History */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <SectionTitle icon="📜">Recent History</SectionTitle>
                  {selected.history && selected.history.length > 0 && (
                    <button
                      onClick={() => {
                        const userName = selected.full_name || selected.email || "user";
                        downloadCSV(
                          `${userName.replace(/\s+/g, "_")}_history.csv`,
                          ["Type", "Date", "Business", "Amount", "Cashback", "Method", "Status"],
                          selected.history!.map((h) => [
                            h.type,
                            h.date,
                            h.business_name || "",
                            h.amount_cents ? (h.amount_cents / 100).toFixed(2) : "0.00",
                            h.payout_cents ? (h.payout_cents / 100).toFixed(2) : "0.00",
                            h.method || "",
                            h.status,
                          ])
                        );
                      }}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 8,
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                        background: COLORS.darkBg,
                        border: "1px solid " + COLORS.cardBorder,
                        color: COLORS.textSecondary,
                        marginBottom: 12,
                      }}
                    >
                      📥 Download CSV
                    </button>
                  )}
                </div>
                <Card style={{ marginBottom: 24 }}>
                  {!selected.history || selected.history.length === 0 ? (
                    <div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary }}>No history available</div>
                  ) : (
                    <DataTable
                      columns={[
                        { key: "type", label: "Type", render: (v) => <Badge status={String(v)} /> },
                        { key: "date", label: "Date", render: (v) => formatDate(String(v)) },
                        { key: "business_name", label: "Business", render: (v) => String(v || "—") },
                        {
                          key: "amount_cents",
                          label: "Amount",
                          align: "right",
                          render: (v, row) =>
                            row.type === "payout" ? (
                              <span style={{ color: COLORS.neonRed }}>-{formatMoney(Number(v) || 0)}</span>
                            ) : (
                              <span>{formatMoney(Number(v) || 0)}</span>
                            ),
                        },
                        {
                          key: "payout_cents",
                          label: "Cashback",
                          align: "right",
                          render: (v, row) =>
                            row.type === "receipt" && v ? (
                              <span style={{ color: COLORS.neonGreen }}>+{formatMoney(Number(v) || 0)}</span>
                            ) : (
                              "—"
                            ),
                        },
                        { key: "method", label: "Method", render: (v) => String(v || "—") },
                        { key: "status", label: "Status", render: (v) => <Badge status={String(v || "pending")} /> },
                        {
                          key: "receipt_image_url",
                          label: "",
                          align: "center",
                          render: (v) =>
                            v ? (
                              <button
                                onClick={() => setPreview({ url: String(v) })}
                                style={{
                                  padding: "6px 12px",
                                  background: COLORS.darkBg,
                                  border: "1px solid " + COLORS.cardBorder,
                                  borderRadius: 6,
                                  color: COLORS.textSecondary,
                                  cursor: "pointer",
                                  fontSize: 10,
                                }}
                              >
                                👁 View
                              </button>
                            ) : null,
                        },
                      ]}
                      data={selected.history as unknown as Record<string, unknown>[]}
                    />
                  )}
                </Card>

                {/* Photos - Collapsible */}
                <CollapsibleSection title="Photos" icon="📷" defaultOpen={false}>
                  <Card>
                    {selected.avatar_url && (
                      <div style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 8, fontWeight: 600 }}>PROFILE PHOTO</div>
                        <img
                          src={selected.avatar_url}
                          alt="Avatar"
                          style={{
                            width: 100,
                            height: 100,
                            objectFit: "cover",
                            borderRadius: "50%",
                            cursor: "pointer",
                            border: "3px solid " + COLORS.neonPink,
                          }}
                          onClick={() => setPreview({ url: selected.avatar_url! })}
                        />
                      </div>
                    )}
                    {/* Media Status Summary */}
                    <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                      <div style={{ fontSize: 12 }}>
                        <span style={{ color: COLORS.neonGreen, fontWeight: 700 }}>
                          Active: {selected.photos?.filter(p => !p?.status || p?.status === "active").length || 0}
                        </span>
                      </div>
                      <div style={{ fontSize: 12 }}>
                        <span style={{ color: COLORS.neonYellow, fontWeight: 700 }}>
                          Under Investigation: {selected.photos?.filter(p => p?.status === "paused").length || 0}
                        </span>
                      </div>
                      <div style={{ fontSize: 12 }}>
                        <span style={{ color: COLORS.neonRed, fontWeight: 700 }}>
                          Banned: {selected.photos?.filter(p => p?.status === "removed").length || 0}
                        </span>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 8, fontWeight: 600 }}>
                      UPLOADED PHOTOS ({selected.photos?.length || 0} images)
                    </div>
                    <MediaGridManaged
                      items={selected.photos}
                      type="photo"
                      onPreview={setPreview}
                      onStatusChange={async (index, status) => {
                        const newPhotos = [...(selected.photos || [])];
                        if (newPhotos[index]) {
                          const oldStatus = newPhotos[index].status || "active";
                          newPhotos[index] = { ...newPhotos[index], status };
                          const { error } = await supabaseBrowser.from("profiles").update({ photos: newPhotos }).eq("id", selected.id);
                          if (!error) {
                            logAudit({ action: "update_user_media_status", tab: AUDIT_TABS.USERS, subTab: "Photos", targetType: "user", targetId: selected.id, entityName: selected.full_name || selected.email || "", fieldName: "photo_status", oldValue: oldStatus, newValue: status, details: `Photo #${index + 1}: ${oldStatus} → ${status}` });
                            await fetchUsers();
                          }
                        }
                      }}
                    />
                  </Card>
                </CollapsibleSection>

                {/* Videos - Collapsible */}
                <CollapsibleSection title="Videos" icon="🎬" defaultOpen={false}>
                  <Card>
                    {/* Media Status Summary */}
                    <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                      <div style={{ fontSize: 12 }}>
                        <span style={{ color: COLORS.neonGreen, fontWeight: 700 }}>
                          Active: {selected.videos?.filter(v => !v?.status || v?.status === "active").length || 0}
                        </span>
                      </div>
                      <div style={{ fontSize: 12 }}>
                        <span style={{ color: COLORS.neonYellow, fontWeight: 700 }}>
                          Under Investigation: {selected.videos?.filter(v => v?.status === "paused").length || 0}
                        </span>
                      </div>
                      <div style={{ fontSize: 12 }}>
                        <span style={{ color: COLORS.neonRed, fontWeight: 700 }}>
                          Banned: {selected.videos?.filter(v => v?.status === "removed").length || 0}
                        </span>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 8, fontWeight: 600 }}>
                      ALL VIDEOS ({selected.videos?.length || 0} videos)
                    </div>
                    <MediaGridManaged
                      items={selected.videos}
                      type="video"
                      onPreview={setPreview}
                      onStatusChange={async (index, status) => {
                        const newVideos = [...(selected.videos || [])];
                        if (newVideos[index]) {
                          const oldStatus = newVideos[index].status || "active";
                          newVideos[index] = { ...newVideos[index], status };
                          const { error } = await supabaseBrowser.from("profiles").update({ videos: newVideos }).eq("id", selected.id);
                          if (!error) {
                            logAudit({ action: "update_user_media_status", tab: AUDIT_TABS.USERS, subTab: "Videos", targetType: "user", targetId: selected.id, entityName: selected.full_name || selected.email || "", fieldName: "video_status", oldValue: oldStatus, newValue: status, details: `Video #${index + 1}: ${oldStatus} → ${status}` });
                            await fetchUsers();
                          }
                        }
                      }}
                    />
                  </Card>
                </CollapsibleSection>

                {/* Notification Preferences */}
                <SectionTitle icon="🔔">Notification Preferences</SectionTitle>
                <Card>
                  <Checklist
                    editable={isEditing}
                    items={[
                      { label: "Push Notifications", checked: !!selected.preferences?.push_notifications },
                      { label: "Email Notifications", checked: !!selected.preferences?.email_notifications },
                      { label: "SMS Notifications", checked: !!selected.preferences?.sms_notifications },
                      { label: "Marketing Emails", checked: !!selected.preferences?.marketing_emails },
                    ]}
                  />
                </Card>

                {/* Payment Method */}
                <SectionTitle icon="💳">Payment Method</SectionTitle>
                <Card style={{ marginBottom: 24 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                    <div>
                      <EditField
                        label="Payout Method"
                        value={editForm.payout_method ?? selected.payout_method ?? ""}
                        editable={isEditing}
                        options={[
                          { value: "", label: "— Not Set —" },
                          { value: "paypal", label: "PayPal" },
                          { value: "venmo", label: "Venmo" },
                        ]}
                        onChange={(v) => setEditForm({ ...editForm, payout_method: v })}
                      />
                      <EditField
                        label={
                          (editForm.payout_method ?? selected.payout_method) === "venmo"
                            ? "Venmo Username"
                            : "PayPal Email"
                        }
                        value={editForm.payout_identifier ?? selected.payout_identifier}
                        editable={isEditing}
                        onChange={(v) => setEditForm({ ...editForm, payout_identifier: v })}
                      />
                    </div>
                    <div>
                      <div style={{ marginBottom: 16 }}>
                        <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, fontWeight: 600, textTransform: "uppercase" }}>
                          Verification Status
                        </label>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0" }}>
                          {selected.payout_verified ? (
                            <span style={{ padding: "6px 14px", borderRadius: 8, background: "rgba(57,255,20,0.15)", color: COLORS.neonGreen, fontWeight: 700, fontSize: 13 }}>
                              ✓ Verified
                            </span>
                          ) : selected.payout_method ? (
                            <span style={{ padding: "6px 14px", borderRadius: 8, background: "rgba(255,255,0,0.15)", color: COLORS.neonYellow, fontWeight: 700, fontSize: 13 }}>
                              ⚠ Unverified
                            </span>
                          ) : (
                            <span style={{ padding: "6px 14px", borderRadius: 8, background: "rgba(255,255,255,0.05)", color: COLORS.textSecondary, fontWeight: 600, fontSize: 13 }}>
                              No method set
                            </span>
                          )}
                          {selected.payout_method && !selected.payout_verified && (
                            <button
                              onClick={async () => {
                                const { error } = await supabaseBrowser.from("profiles").update({ payout_verified: true }).eq("id", selected.id);
                                if (error) { alert("Error: " + error.message); return; }
                                logAudit({ action: "verify_payout_method", tab: AUDIT_TABS.USERS, subTab: "Payment Method", targetType: "user", targetId: selected.id, entityName: selected.full_name || selected.email || "", fieldName: "payout_verified", oldValue: "false", newValue: "true" });
                                await fetchUsers();
                              }}
                              style={{
                                padding: "6px 14px",
                                borderRadius: 8,
                                background: "rgba(57,255,20,0.15)",
                                border: "none",
                                color: COLORS.neonGreen,
                                cursor: "pointer",
                                fontSize: 11,
                                fontWeight: 600,
                              }}
                            >
                              ✓ Mark as Verified
                            </button>
                          )}
                          {selected.payout_method && selected.payout_verified && (
                            <button
                              onClick={async () => {
                                const { error } = await supabaseBrowser.from("profiles").update({ payout_verified: false }).eq("id", selected.id);
                                if (error) { alert("Error: " + error.message); return; }
                                logAudit({ action: "unverify_payout_method", tab: AUDIT_TABS.USERS, subTab: "Payment Method", targetType: "user", targetId: selected.id, entityName: selected.full_name || selected.email || "", fieldName: "payout_verified", oldValue: "true", newValue: "false" });
                                await fetchUsers();
                              }}
                              style={{
                                padding: "6px 14px",
                                borderRadius: 8,
                                background: "rgba(255,49,49,0.1)",
                                border: "none",
                                color: COLORS.neonRed,
                                cursor: "pointer",
                                fontSize: 11,
                                fontWeight: 600,
                              }}
                            >
                              ↩ Undo Verification
                            </button>
                          )}
                        </div>
                      </div>
                      <div style={{ marginBottom: 16 }}>
                        <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, fontWeight: 600, textTransform: "uppercase" }}>
                          Minimum Cashout
                        </label>
                        <div style={{ padding: "12px 0", fontSize: 14, fontWeight: 600 }}>
                          {formatMoney(selected.min_cashout_cents || 2000)}
                        </div>
                        <div style={{ fontSize: 11, color: COLORS.textSecondary }}>
                          Default: $20.00. User must accumulate this amount before cashing out.
                        </div>
                      </div>
                    </div>
                  </div>
                  {!selected.payout_method && (
                    <div style={{ padding: 14, background: "rgba(255,255,0,0.06)", borderRadius: 10, border: "1px solid rgba(255,255,0,0.15)", marginTop: 8 }}>
                      <div style={{ fontSize: 12, color: COLORS.neonYellow }}>
                        ⚠️ No payment method on file. User will need to add a PayPal email or Venmo username before they can cash out.
                      </div>
                    </div>
                  )}
                </Card>

                {/* 1099 Tax Information */}
                <SectionTitle icon="🏛️">1099 Tax Information</SectionTitle>
                <Card style={{ marginBottom: 24 }}>
                  {(() => {
                    const lifetimeEarnings = selected.lifetime_payout || 0;
                    const currentYear = new Date().getFullYear();
                    const thisYearEarnings = ytdEarningsCents;
                    const threshold = 60000; // $600 in cents
                    const approaching = thisYearEarnings >= 40000 && thisYearEarnings < threshold;
                    const over = thisYearEarnings >= threshold;
                    const issuedYears = selected.tax_1099_years || [];

                    return (
                      <>
                        {/* Threshold Status */}
                        <div style={{
                          padding: 20,
                          borderRadius: 12,
                          marginBottom: 20,
                          background: over ? "rgba(255,49,49,0.08)" : approaching ? "rgba(255,255,0,0.06)" : "rgba(57,255,20,0.05)",
                          border: over ? "1px solid rgba(255,49,49,0.3)" : approaching ? "1px solid rgba(255,255,0,0.2)" : "1px solid rgba(57,255,20,0.15)",
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                            <div style={{ fontWeight: 700, fontSize: 15, color: over ? COLORS.neonRed : approaching ? COLORS.neonYellow : COLORS.neonGreen }}>
                              {over ? "⚠️ Over $600 Threshold" : approaching ? "⚡ Approaching $600 Threshold" : "✓ Under $600 Threshold"}
                            </div>
                            <div style={{
                              padding: "6px 16px",
                              borderRadius: 20,
                              fontWeight: 700,
                              fontSize: 14,
                              background: over ? COLORS.gradient1 : approaching ? "rgba(255,255,0,0.2)" : "rgba(57,255,20,0.15)",
                              color: over ? "#fff" : approaching ? COLORS.neonYellow : COLORS.neonGreen,
                            }}>
                              {formatMoney(thisYearEarnings)} / $600.00
                            </div>
                          </div>
                          {/* Progress bar */}
                          <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
                            <div style={{
                              height: "100%",
                              borderRadius: 4,
                              width: `${Math.min((thisYearEarnings / threshold) * 100, 100)}%`,
                              background: over ? COLORS.gradient1 : approaching ? "linear-gradient(90deg, #ffd93d, #ff6b6b)" : COLORS.gradient2,
                              transition: "width 0.5s ease",
                            }} />
                          </div>
                          <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 8 }}>
                            {currentYear} earnings toward IRS 1099 reporting threshold
                          </div>
                        </div>

                        {/* Tax Details Grid */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 20 }}>
                          <div style={{ padding: 16, background: COLORS.darkBg, borderRadius: 10, textAlign: "center" }}>
                            <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, textTransform: "uppercase", fontWeight: 600 }}>Lifetime Earnings</div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.neonBlue }}>{formatMoney(lifetimeEarnings)}</div>
                          </div>
                          <div style={{ padding: 16, background: COLORS.darkBg, borderRadius: 10, textAlign: "center" }}>
                            <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, textTransform: "uppercase", fontWeight: 600 }}>Tax ID (SSN/EIN)</div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: selected.tax_id_on_file ? COLORS.neonGreen : COLORS.neonRed }}>
                              {selected.tax_id_on_file ? "✓ On File" : "✗ Not on File"}
                            </div>
                          </div>
                          <div style={{ padding: 16, background: COLORS.darkBg, borderRadius: 10, textAlign: "center" }}>
                            <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, textTransform: "uppercase", fontWeight: 600 }}>W-9 Status</div>
                            <div style={{
                              fontSize: 16,
                              fontWeight: 700,
                              color: selected.w9_status === "received" ? COLORS.neonGreen : selected.w9_status === "requested" ? COLORS.neonYellow : COLORS.textSecondary,
                            }}>
                              {selected.w9_status === "received" ? "✓ Received" : selected.w9_status === "requested" ? "⏳ Requested" : "— Not Requested"}
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
                          {!selected.tax_id_on_file && over && (
                            <div style={{ padding: 12, background: "rgba(255,49,49,0.1)", borderRadius: 10, border: "1px solid rgba(255,49,49,0.3)", fontSize: 12, color: COLORS.neonRed, flex: 1 }}>
                              ⚠️ User has exceeded $600 threshold but has no Tax ID on file. A W-9 must be collected before issuing a 1099.
                            </div>
                          )}
                          {/* W-9 Button — cycles: null → requested → received, with undo back to null */}
                          <button
                            onClick={async () => {
                              let newStatus: string | null;
                              if (!selected.w9_status) newStatus = "requested";
                              else if (selected.w9_status === "requested") newStatus = "received";
                              else newStatus = null; // undo from received back to not requested
                              const { error } = await supabaseBrowser.from("profiles").update({ w9_status: newStatus }).eq("id", selected.id);
                              if (error) { alert("Error: " + error.message); return; }
                              logAudit({ action: "update_w9_status", tab: AUDIT_TABS.USERS, subTab: "1099 Tax Information", targetType: "user", targetId: selected.id, entityName: selected.full_name || selected.email || "", fieldName: "w9_status", oldValue: selected.w9_status || "not_requested", newValue: newStatus || "not_requested" });
                              await fetchUsers();
                            }}
                            style={{
                              padding: "10px 18px",
                              borderRadius: 8,
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: "pointer",
                              background: selected.w9_status === "received" ? "rgba(255,49,49,0.1)" : selected.w9_status === "requested" ? "rgba(57,255,20,0.15)" : "rgba(0,212,255,0.15)",
                              border: "none",
                              color: selected.w9_status === "received" ? COLORS.neonRed : selected.w9_status === "requested" ? COLORS.neonGreen : COLORS.neonBlue,
                            }}
                          >
                            {selected.w9_status === "received" ? "↩ Undo W-9 Received" : selected.w9_status === "requested" ? "✓ Mark W-9 Received" : "📧 Request W-9"}
                          </button>
                          {/* Tax ID Button — toggleable */}
                          <button
                            onClick={async () => {
                              const newVal = !selected.tax_id_on_file;
                              const { error } = await supabaseBrowser.from("profiles").update({ tax_id_on_file: newVal }).eq("id", selected.id);
                              if (error) { alert("Error: " + error.message); return; }
                              logAudit({ action: "update_tax_id", tab: AUDIT_TABS.USERS, subTab: "1099 Tax Information", targetType: "user", targetId: selected.id, entityName: selected.full_name || selected.email || "", fieldName: "tax_id_on_file", oldValue: String(selected.tax_id_on_file || false), newValue: String(newVal) });
                              await fetchUsers();
                            }}
                            style={{
                              padding: "10px 18px",
                              borderRadius: 8,
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: "pointer",
                              background: selected.tax_id_on_file ? "rgba(255,49,49,0.1)" : "rgba(57,255,20,0.15)",
                              border: "none",
                              color: selected.tax_id_on_file ? COLORS.neonRed : COLORS.neonGreen,
                            }}
                          >
                            {selected.tax_id_on_file ? "↩ Undo Tax ID on File" : "✓ Mark Tax ID on File"}
                          </button>
                          {over && selected.tax_id_on_file && selected.w9_status === "received" && !issuedYears.includes(String(currentYear)) && (
                            <button
                              onClick={async () => {
                                const updated = [...issuedYears, String(currentYear)];
                                const { error } = await supabaseBrowser.from("profiles").update({ tax_1099_years: updated }).eq("id", selected.id);
                                if (error) { alert("Error: " + error.message); return; }
                                logAudit({ action: "mark_1099_issued", tab: AUDIT_TABS.USERS, subTab: "1099 Tax Information", targetType: "user", targetId: selected.id, entityName: selected.full_name || selected.email || "", fieldName: "tax_1099_years", oldValue: (selected.tax_1099_years || []).join(", ") || "none", newValue: String(currentYear) });
                                await fetchUsers();
                              }}
                              style={{
                                padding: "10px 18px",
                                borderRadius: 8,
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: "pointer",
                                background: COLORS.gradient1,
                                border: "none",
                                color: "#fff",
                              }}
                            >
                              📄 Mark 1099 Issued for {currentYear}
                            </button>
                          )}
                        </div>

                        {/* Year-over-Year Earnings History */}
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                            <div style={{ fontSize: 11, color: COLORS.textSecondary, fontWeight: 600, textTransform: "uppercase" }}>Year-over-Year Earnings</div>
                            <button
                              onClick={() => {
                                const userName = selected.full_name || selected.email || "user";
                                // Build YoY data — for now we have current year + issued years
                                const years = [...new Set([...issuedYears, String(currentYear)])].sort();
                                downloadCSV(
                                  `${userName.replace(/\s+/g, "_")}_tax_summary.csv`,
                                  ["Year", "Earnings", "Over $600 Threshold", "W-9 Status", "Tax ID on File", "1099 Issued"],
                                  years.map((yr) => [
                                    yr,
                                    yr === String(currentYear) ? (thisYearEarnings / 100).toFixed(2) : "—",
                                    yr === String(currentYear) ? (over ? "Yes" : "No") : (issuedYears.includes(yr) ? "Yes (issued)" : "Unknown"),
                                    selected.w9_status || "not requested",
                                    selected.tax_id_on_file ? "Yes" : "No",
                                    issuedYears.includes(yr) ? "Yes" : "No",
                                  ])
                                );
                              }}
                              style={{
                                padding: "5px 12px",
                                borderRadius: 6,
                                fontSize: 10,
                                fontWeight: 600,
                                cursor: "pointer",
                                background: COLORS.darkBg,
                                border: "1px solid " + COLORS.cardBorder,
                                color: COLORS.textSecondary,
                              }}
                            >
                              📥 Download Tax Summary
                            </button>
                          </div>
                          {/* YoY Table */}
                          <div style={{ borderRadius: 10, border: "1px solid " + COLORS.cardBorder, overflow: "hidden" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 100px 100px", padding: "10px 14px", background: COLORS.darkBg, fontSize: 10, fontWeight: 700, color: COLORS.textSecondary, textTransform: "uppercase" }}>
                              <div>Year</div>
                              <div>Earnings</div>
                              <div style={{ textAlign: "center" }}>Threshold</div>
                              <div style={{ textAlign: "center" }}>1099</div>
                            </div>
                            {(() => {
                              const years = [...new Set([...issuedYears, String(currentYear)])].sort().reverse();
                              if (years.length === 0) return (
                                <div style={{ padding: 20, textAlign: "center", color: COLORS.textSecondary, fontSize: 12 }}>No earnings data yet</div>
                              );
                              return years.map((yr) => {
                                const isCurrent = yr === String(currentYear);
                                const yrEarnings = isCurrent ? thisYearEarnings : 0;
                                const yrOver = isCurrent ? over : issuedYears.includes(yr);
                                const issued = issuedYears.includes(yr);
                                return (
                                  <div key={yr} style={{ display: "grid", gridTemplateColumns: "80px 1fr 100px 100px", padding: "12px 14px", borderTop: "1px solid " + COLORS.cardBorder, fontSize: 13, alignItems: "center" }}>
                                    <div style={{ fontWeight: 700 }}>{yr} {isCurrent && <span style={{ fontSize: 9, color: COLORS.neonBlue }}>(current)</span>}</div>
                                    <div style={{ fontWeight: 600, color: yrOver ? COLORS.neonRed : COLORS.textPrimary }}>
                                      {isCurrent ? formatMoney(yrEarnings) : "—"}
                                    </div>
                                    <div style={{ textAlign: "center" }}>
                                      {yrOver ? (
                                        <span style={{ padding: "3px 10px", borderRadius: 6, background: "rgba(255,49,49,0.15)", color: COLORS.neonRed, fontSize: 11, fontWeight: 600 }}>Over</span>
                                      ) : (
                                        <span style={{ padding: "3px 10px", borderRadius: 6, background: "rgba(57,255,20,0.1)", color: COLORS.neonGreen, fontSize: 11, fontWeight: 600 }}>Under</span>
                                      )}
                                    </div>
                                    <div style={{ textAlign: "center" }}>
                                      {issued ? (
                                        <span style={{ padding: "3px 10px", borderRadius: 6, background: "rgba(57,255,20,0.1)", color: COLORS.neonGreen, fontSize: 11, fontWeight: 600 }}>✓ Issued</span>
                                      ) : yrOver ? (
                                        <span style={{ padding: "3px 10px", borderRadius: 6, background: "rgba(255,255,0,0.1)", color: COLORS.neonYellow, fontSize: 11, fontWeight: 600 }}>Pending</span>
                                      ) : (
                                        <span style={{ fontSize: 11, color: COLORS.textSecondary }}>N/A</span>
                                      )}
                                    </div>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </Card>

                {/* Referral Activity */}
                <SectionTitle icon="🤝">Referral Activity</SectionTitle>
                <Card style={{ marginBottom: 24 }}>
                  {/* Who referred this user */}
                  {userReferrals.referredBy && (
                    <div style={{
                      padding: 14,
                      borderRadius: 10,
                      marginBottom: 16,
                      background: "rgba(138,43,226,0.08)",
                      border: "1px solid rgba(138,43,226,0.25)",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}>
                      <span style={{ fontSize: 18 }}>📨</span>
                      <div>
                        <div style={{ fontSize: 13 }}>
                          Referred by <strong style={{ color: COLORS.neonPurple }}>{userReferrals.referredBy}</strong>
                          {userReferrals.referredByCode && (
                            <span style={{ marginLeft: 8, fontFamily: "monospace", fontSize: 11, color: COLORS.neonPink, background: "rgba(255,0,128,0.1)", padding: "2px 8px", borderRadius: 4 }}>
                              code: {userReferrals.referredByCode}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Referral stats row */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
                    <div style={{ padding: 14, background: COLORS.darkBg, borderRadius: 10, textAlign: "center" }}>
                      <div style={{ fontSize: 22, fontWeight: 800 }}>{userReferrals.referralsMade.length}</div>
                      <div style={{ fontSize: 10, color: COLORS.textSecondary, textTransform: "uppercase" }}>Referrals Made</div>
                    </div>
                    <div style={{ padding: 14, background: COLORS.darkBg, borderRadius: 10, textAlign: "center" }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.neonGreen }}>
                        {userReferrals.referralsMade.filter((r) => r.status === "converted").length}
                      </div>
                      <div style={{ fontSize: 10, color: COLORS.textSecondary, textTransform: "uppercase" }}>Converted</div>
                    </div>
                    <div style={{ padding: 14, background: COLORS.darkBg, borderRadius: 10, textAlign: "center" }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.neonGreen }}>{formatMoney(userReferrals.totalBonusEarned)}</div>
                      <div style={{ fontSize: 10, color: COLORS.textSecondary, textTransform: "uppercase" }}>Bonus Earned</div>
                    </div>
                    <div style={{ padding: 14, background: COLORS.darkBg, borderRadius: 10, textAlign: "center" }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: userReferrals.unpaidBonus > 0 ? COLORS.neonYellow : COLORS.textSecondary }}>
                        {formatMoney(userReferrals.unpaidBonus)}
                      </div>
                      <div style={{ fontSize: 10, color: COLORS.textSecondary, textTransform: "uppercase" }}>Unpaid Bonus</div>
                    </div>
                  </div>

                  {/* Pay bonus button */}
                  {userReferrals.unpaidBonus > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <button
                        onClick={handlePayUserReferralBonus}
                        style={{
                          padding: "10px 20px",
                          background: COLORS.neonRed,
                          border: "none",
                          borderRadius: 10,
                          color: "#fff",
                          cursor: "pointer",
                          fontWeight: 700,
                          fontSize: 13,
                        }}
                      >
                        💰 Pay {formatMoney(userReferrals.unpaidBonus)} Bonus ({userReferrals.referralsMade.filter((r) => r.status === "converted" && !r.reward_paid).length} referrals)
                      </button>
                    </div>
                  )}

                  {/* Referrals list */}
                  {userReferrals.referralsMade.length === 0 ? (
                    <div style={{ padding: 20, textAlign: "center", color: COLORS.textSecondary, fontSize: 13 }}>
                      This user hasn&apos;t made any referrals yet.
                    </div>
                  ) : (
                    <div style={{ maxHeight: 300, overflowY: "auto" }}>
                      {userReferrals.referralsMade.map((ref) => (
                        <div
                          key={ref.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "10px 14px",
                            borderBottom: "1px solid " + COLORS.cardBorder,
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>
                              {ref.referred_name || (ref.referred_business_id ? "Business" : "User") + " " + (ref.referred_business_id || ref.referred_user_id || "").slice(0, 8)}
                            </div>
                            <div style={{ fontSize: 11, color: COLORS.textSecondary }}>
                              {ref.source} {ref.referral_code ? `• code: ${ref.referral_code}` : ""} • {formatDate(ref.created_at)}
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontWeight: 700, fontSize: 13, color: COLORS.neonGreen }}>{formatMoney(ref.reward_cents)}</span>
                            <Badge status={ref.status} />
                            {ref.reward_paid ? (
                              <span style={{ fontSize: 10, color: COLORS.neonGreen, fontWeight: 600 }}>✓ Paid</span>
                            ) : ref.status === "converted" ? (
                              <span style={{ fontSize: 10, color: COLORS.neonYellow, fontWeight: 600 }}>Unpaid</span>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                {/* Staff Notes */}
                <SectionTitle icon="📝">Staff Notes</SectionTitle>
                <Card style={{ marginBottom: 24 }}>
                  {/* Add Note Form */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                      <input
                        type="text"
                        placeholder="Your name..."
                        value={noteAuthor}
                        onChange={(e) => setNoteAuthor(e.target.value)}
                        style={{
                          width: 140,
                          padding: "10px 12px",
                          borderRadius: 8,
                          border: "1px solid " + COLORS.cardBorder,
                          background: COLORS.darkBg,
                          color: COLORS.textPrimary,
                          fontSize: 12,
                        }}
                      />
                      <div style={{ flex: 1, position: "relative" }}>
                        <textarea
                          placeholder="Add a note about this user... (e.g. 'Called about W-9, will mail Friday')"
                          value={newNote}
                          onChange={(e) => setNewNote(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleAddNote();
                            }
                          }}
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            borderRadius: 8,
                            border: "1px solid " + COLORS.cardBorder,
                            background: COLORS.darkBg,
                            color: COLORS.textPrimary,
                            fontSize: 12,
                            minHeight: 42,
                            maxHeight: 120,
                            resize: "vertical",
                          }}
                        />
                      </div>
                      <button
                        onClick={handleAddNote}
                        disabled={!newNote.trim()}
                        style={{
                          padding: "10px 18px",
                          borderRadius: 8,
                          background: newNote.trim() ? COLORS.gradient2 : COLORS.darkBg,
                          border: newNote.trim() ? "none" : "1px solid " + COLORS.cardBorder,
                          color: newNote.trim() ? "#000" : COLORS.textSecondary,
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: newNote.trim() ? "pointer" : "not-allowed",
                          whiteSpace: "nowrap",
                          alignSelf: "flex-start",
                        }}
                      >
                        + Add Note
                      </button>
                    </div>
                  </div>

                  {/* Notes List */}
                  {!selected.staff_notes || selected.staff_notes.length === 0 ? (
                    <div style={{ padding: 30, textAlign: "center", color: COLORS.textSecondary }}>
                      <div style={{ fontSize: 24, marginBottom: 6 }}>📝</div>
                      No staff notes yet — add the first note above
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {selected.staff_notes.map((note) => (
                        <div
                          key={note.id}
                          style={{
                            padding: 14,
                            borderRadius: 10,
                            background: note.pinned ? "rgba(255,255,0,0.04)" : COLORS.darkBg,
                            border: note.pinned ? "1px solid rgba(255,255,0,0.2)" : "1px solid " + COLORS.cardBorder,
                            position: "relative",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              {note.pinned && <span style={{ fontSize: 11 }}>📌</span>}
                              <span style={{ fontWeight: 700, fontSize: 12, color: COLORS.neonBlue }}>{note.author_name}</span>
                              <span style={{ fontSize: 11, color: COLORS.textSecondary }}>
                                {new Date(note.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                {" "}
                                {new Date(note.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                              </span>
                            </div>
                            <div style={{ display: "flex", gap: 4 }}>
                              <button
                                onClick={() => handleTogglePinNote(note.id, note.pinned)}
                                title={note.pinned ? "Unpin" : "Pin"}
                                style={{
                                  padding: "3px 8px",
                                  borderRadius: 6,
                                  background: "transparent",
                                  border: "1px solid " + COLORS.cardBorder,
                                  color: note.pinned ? COLORS.neonYellow : COLORS.textSecondary,
                                  cursor: "pointer",
                                  fontSize: 11,
                                }}
                              >
                                📌
                              </button>
                              <button
                                onClick={() =>
                                  setConfirmModal({
                                    title: "Delete Note?",
                                    message: `Delete this note from ${note.author_name}? This cannot be undone.`,
                                    type: "danger",
                                    confirmText: "Delete",
                                    onConfirm: () => { handleDeleteNote(note.id); setConfirmModal(null); },
                                  })
                                }
                                title="Delete"
                                style={{
                                  padding: "3px 8px",
                                  borderRadius: 6,
                                  background: "transparent",
                                  border: "1px solid " + COLORS.cardBorder,
                                  color: COLORS.textSecondary,
                                  cursor: "pointer",
                                  fontSize: 11,
                                }}
                              >
                                🗑
                              </button>
                            </div>
                          </div>
                          <div style={{ fontSize: 13, color: COLORS.textPrimary, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                            {note.note}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Notes count */}
                  {selected.staff_notes && selected.staff_notes.length > 0 && (
                    <div style={{ marginTop: 10, fontSize: 11, color: COLORS.textSecondary, textAlign: "right" }}>
                      {selected.staff_notes.length} note{selected.staff_notes.length !== 1 ? "s" : ""} • {selected.staff_notes.filter((n) => n.pinned).length} pinned
                    </div>
                  )}
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}