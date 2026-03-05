"use client";

import React, { useEffect, useState, useCallback } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import {
  COLORS,
  Card,
  StatCard,
  SectionTitle,
  Badge,
  DataTable,
  formatMoney,
  formatDateTime,
  formatDate,
} from "@/components/admin/components";
import { logAudit, AUDIT_TABS } from "@/lib/auditLog";

// ==================== TYPES ====================
interface Promotion {
  id: string;
  code: string;
  description: string | null;
  discount_type: string;
  discount_amount: number;
  min_purchase_cents: number;
  max_uses: number | null;
  uses_count: number;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  applies_to: string;
  promo_type: string | null;
  created_at: string;
  created_by: string | null;
}

interface Redemption {
  id: string;
  promotion_id: string;
  user_id: string | null;
  business_id: string | null;
  discount_applied_cents: number;
  created_at: string;
  user_name: string;
  business_name: string;
  promo_code: string;
}

interface Adjustment {
  id: string;
  user_id: string;
  type: string;
  date: string;
  business_name: string | null;
  amount_cents: number;
  payout_cents: number;
  method: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  user_name: string;
}

// Map UI adjustment types → DB-allowed types (user_transactions.type CHECK constraint)
const adjustmentTypeMap: Record<string, string> = {
  discount: "adjustment",
  bonus: "bonus",
  chargeback: "refund",
  refund: "refund",
  fee_waiver: "adjustment",
  correction: "adjustment",
};

const adjustmentTypes = [
  { id: "discount", label: "Discount", icon: "🏷️", color: COLORS.neonGreen },
  { id: "bonus", label: "Bonus Credit", icon: "🎁", color: COLORS.neonBlue },
  { id: "chargeback", label: "Chargeback", icon: "⚠️", color: COLORS.neonRed || "#ff3131" },
  { id: "refund", label: "Refund", icon: "💸", color: COLORS.neonOrange },
  { id: "fee_waiver", label: "Fee Waiver", icon: "🎫", color: COLORS.neonPurple },
  { id: "correction", label: "Correction", icon: "✏️", color: COLORS.neonYellow },
];

const inputStyle = { width: "100%", padding: 12, background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, fontSize: 14 };
const labelStyle = { display: "block" as const, fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, textTransform: "uppercase" as const, fontWeight: 600 };

// ==================== PROMOTIONS PAGE ====================
export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentStaffId, setCurrentStaffId] = useState("");

  // UI states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [selectedPromo, setSelectedPromo] = useState<Promotion | null>(null);
  const [editingPromo, setEditingPromo] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // Edit form
  const [editForm, setEditForm] = useState({
    code: "", description: "", discount_type: "percent", discount_amount: 0,
    min_purchase_cents: 0, max_uses: 0, start_date: "", end_date: "", applies_to: "all",
    promo_type: "first_visit_bonus",
  });

  // Create promotion form
  const [newPromo, setNewPromo] = useState({
    name: "", code: "", promoType: "first_visit_bonus" as string, description: "", discount_type: "fixed" as string,
    discount_amount: 0, min_purchase_cents: 0, max_uses: 0, start_date: "", end_date: "",
    applies_to: "all",
  });

  // Target businesses & users for "businesses" / "specific" applies_to
  const [targetBusinesses, setTargetBusinesses] = useState<{ id: string; name: string }[]>([]);
  const [targetUsers, setTargetUsers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [bizSearch, setBizSearch] = useState("");
  const [bizSearchResults, setBizSearchResults] = useState<{ id: string; name: string }[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [userSearchResults, setUserSearchResults] = useState<{ id: string; name: string; email: string }[]>([]);

  // Search businesses by name
  const searchBusinesses = useCallback(async (query: string) => {
    if (query.length < 2) { setBizSearchResults([]); return; }
    const { data } = await supabaseBrowser
      .from("business")
      .select("id, business_name, public_business_name")
      .or(`business_name.ilike.%${query}%,public_business_name.ilike.%${query}%`)
      .limit(10);
    if (data) {
      setBizSearchResults(data.map(b => ({
        id: b.id,
        name: (b.public_business_name || b.business_name || b.id) as string,
      })));
    }
  }, []);

  // Search users by name or email
  const searchUsers = useCallback(async (query: string) => {
    if (query.length < 2) { setUserSearchResults([]); return; }
    const { data } = await supabaseBrowser
      .from("profiles")
      .select("id, first_name, last_name, email")
      .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`)
      .limit(10);
    if (data) {
      setUserSearchResults(data.map(u => ({
        id: u.id,
        name: [u.first_name, u.last_name].filter(Boolean).join(" ") || "Unknown",
        email: (u.email || "") as string,
      })));
    }
  }, []);

  const promoTypes = [
    { id: "payout_multiplier", label: "Payout Multiplier", desc: "Multiply user payouts (1.5x, 2x, etc.)", icon: "📈" },
    { id: "first_visit_bonus", label: "First Visit Bonus", desc: "Flat $ on user's first visit during promo", icon: "🎯" },
    { id: "signup_bonus", label: "Signup Bonus", desc: "Bonus for new user/business signups", icon: "🆕" },
    { id: "flat_bonus", label: "Flat Bonus", desc: "Add flat $ amount to each visit", icon: "💵" },
  ];

  // Adjustment form
  const [newAdjustment, setNewAdjustment] = useState({
    type: "discount", targetType: "user" as string, targetId: "", targetName: "",
    amount: "", reason: "", notes: "", businessName: "",
  });
  const [adjTargetSearch, setAdjTargetSearch] = useState("");
  const [adjTargetResults, setAdjTargetResults] = useState<Array<{ id: string; name: string; email: string; sublabel?: string }>>([]);
  const [adjTargetSearching, setAdjTargetSearching] = useState(false);
  const [adjSaving, setAdjSaving] = useState(false);

  // Adjustment filters
  const [adjFilters, setAdjFilters] = useState({ search: "", type: "all", status: "all" });

  // ==================== FETCH DATA ====================
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Get current staff user
      const { data: { user } } = await supabaseBrowser.auth.getUser();
      if (user) setCurrentStaffId(user.id);

      // Fetch promotions
      const { data: promosData, error: promosError } = await supabaseBrowser
        .from("promotions")
        .select("*")
        .order("created_at", { ascending: false });
      if (promosError) throw promosError;
      setPromotions(promosData || []);

      // Fetch redemptions
      const { data: redemptionsData, error: redemptionsError } = await supabaseBrowser
        .from("promotion_redemptions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (redemptionsError) throw redemptionsError;

      // Resolve user names for redemptions
      const rUserIds = [...new Set((redemptionsData || []).map(r => r.user_id).filter(Boolean))];
      let userNameMap = new Map<string, string>();
      if (rUserIds.length > 0) {
        const { data: profiles } = await supabaseBrowser
          .from("profiles").select("id, full_name, first_name, last_name").in("id", rUserIds);
        userNameMap = new Map((profiles || []).map(p => [
          p.id, p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unknown",
        ]));
      }

      // Resolve business names for redemptions
      const rBizIds = [...new Set((redemptionsData || []).map(r => r.business_id).filter(Boolean))];
      let bizNameMap = new Map<string, string>();
      if (rBizIds.length > 0) {
        const { data: businesses } = await supabaseBrowser
          .from("business").select("id, business_name, public_business_name").in("id", rBizIds);
        bizNameMap = new Map((businesses || []).map(b => [
          b.id, b.public_business_name || b.business_name || "Unknown",
        ]));
      }

      const mappedRedemptions: Redemption[] = (redemptionsData || []).map(r => ({
        ...r,
        user_name: r.user_id ? userNameMap.get(r.user_id) || "Unknown" : "—",
        business_name: r.business_id ? bizNameMap.get(r.business_id) || "Unknown" : "—",
        promo_code: (promosData || []).find(p => p.id === r.promotion_id)?.code || "Unknown",
      }));
      setRedemptions(mappedRedemptions);

      // Fetch adjustments from user_transactions
      const { data: adjData, error: adjError } = await supabaseBrowser
        .from("user_transactions")
        .select("*")
        .in("type", ["refund", "adjustment", "bonus"])
        .order("date", { ascending: false })
        .limit(200);
      if (adjError) throw adjError;

      // Resolve user names for adjustments
      const adjUserIds = [...new Set((adjData || []).map(a => a.user_id).filter(Boolean))];
      let adjUserMap = new Map<string, string>();
      if (adjUserIds.length > 0) {
        const { data: profiles } = await supabaseBrowser
          .from("profiles").select("id, full_name, first_name, last_name").in("id", adjUserIds);
        adjUserMap = new Map((profiles || []).map(p => [
          p.id, p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unknown",
        ]));
      }

      setAdjustments((adjData || []).map(a => ({
        ...a,
        user_name: adjUserMap.get(a.user_id) || "Unknown",
      })));
    } catch (err) {
      console.error("Error fetching promotions data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Debounced search for adjustment target (user or business)
  useEffect(() => {
    if (adjTargetSearch.length < 2) { setAdjTargetResults([]); return; }
    const timer = setTimeout(async () => {
      setAdjTargetSearching(true);
      try {
        if (newAdjustment.targetType === "business") {
          const { data } = await supabaseBrowser
            .from("business")
            .select("id, business_name, public_business_name")
            .or(`business_name.ilike.%${adjTargetSearch}%,public_business_name.ilike.%${adjTargetSearch}%`)
            .limit(8);
          setAdjTargetResults((data || []).map(b => ({
            id: b.id,
            name: b.public_business_name || b.business_name || "Unknown",
            email: "",
            sublabel: b.business_name || "",
          })));
        } else {
          const { data } = await supabaseBrowser
            .from("profiles")
            .select("id, full_name, first_name, last_name, email")
            .or(`full_name.ilike.%${adjTargetSearch}%,first_name.ilike.%${adjTargetSearch}%,last_name.ilike.%${adjTargetSearch}%,email.ilike.%${adjTargetSearch}%`)
            .limit(8);
          setAdjTargetResults((data || []).map(p => ({
            id: p.id,
            name: p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unknown",
            email: p.email || "",
          })));
        }
      } catch (err) { console.error("Error searching:", err); }
      finally { setAdjTargetSearching(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [adjTargetSearch, newAdjustment.targetType]);

  // ==================== DERIVED STATS ====================
  const now = new Date();
  const activePromotions = promotions.filter(p => p.is_active && (!p.end_date || new Date(p.end_date) > now) && (!p.start_date || new Date(p.start_date) <= now));
  const scheduledPromotions = promotions.filter(p => p.is_active && p.start_date && new Date(p.start_date) > now);
  const completedPromotions = promotions.filter(p => !p.is_active || (p.end_date && new Date(p.end_date) <= now));
  const totalRedemptions = redemptions.length;
  const totalDiscountGiven = redemptions.reduce((sum, r) => sum + Math.abs(r.discount_applied_cents || 0), 0);

  // Adjustment stats from user_transactions
  const bonusTotal = adjustments.filter(a => a.type === "bonus").reduce((sum, a) => sum + Math.abs(a.payout_cents || 0), 0);
  const refundTotal = adjustments.filter(a => a.type === "refund").reduce((sum, a) => sum + Math.abs(a.payout_cents || 0), 0);
  const adjustmentCredits = adjustments.filter(a => a.type === "adjustment").reduce((sum, a) => sum + Math.abs(a.payout_cents || 0), 0);

  // Filtered adjustments
  const filteredAdjustments = adjustments.filter(a => {
    if (adjFilters.search) {
      const q = adjFilters.search.toLowerCase();
      if (!a.user_name?.toLowerCase().includes(q) && !a.business_name?.toLowerCase().includes(q) && !a.notes?.toLowerCase().includes(q)) return false;
    }
    if (adjFilters.type !== "all" && a.type !== adjFilters.type) return false;
    if (adjFilters.status !== "all" && a.status !== adjFilters.status) return false;
    return true;
  });

  // ==================== ACTIONS ====================
  const createPromotion = async () => {
    if (!newPromo.code) { alert("Promo code is required."); return; }
    try {
      // Map promoType to discount_type if not manually set
      const discountType = newPromo.promoType === "payout_multiplier" ? "percent" : newPromo.discount_type;
      const desc = [newPromo.name, newPromo.description].filter(Boolean).join(" — ") || null;

      const { data: inserted, error } = await supabaseBrowser.from("promotions").insert({
        code: newPromo.code.toUpperCase(),
        description: desc,
        discount_type: discountType,
        discount_amount: newPromo.discount_amount,
        min_purchase_cents: newPromo.min_purchase_cents || 0,
        max_uses: newPromo.max_uses || null,
        start_date: newPromo.start_date || null,
        end_date: newPromo.end_date || null,
        is_active: true,
        uses_count: 0,
        applies_to: newPromo.applies_to,
        promo_type: newPromo.promoType,
        created_by: currentStaffId || null,
      }).select("id").single();
      if (error) throw error;

      // Save target businesses or users if applicable
      if (inserted?.id) {
        if (newPromo.applies_to === "businesses" && targetBusinesses.length > 0) {
          await supabaseBrowser.from("promotion_target_businesses").insert(
            targetBusinesses.map(b => ({ promotion_id: inserted.id, business_id: b.id }))
          );
        }
        if (newPromo.applies_to === "specific" && targetUsers.length > 0) {
          await supabaseBrowser.from("promotion_target_users").insert(
            targetUsers.map(u => ({ promotion_id: inserted.id, user_id: u.id }))
          );
        }
      }

      logAudit({
        action: "create_promotion",
        tab: AUDIT_TABS.PROMOTIONS,
        subTab: "Promo Codes",
        targetType: "promotion",
        targetId: newPromo.code.toUpperCase(),
        entityName: newPromo.code.toUpperCase(),
        fieldName: "promotion",
        oldValue: "",
        newValue: `${newPromo.discount_type === "percent" ? newPromo.discount_amount + "%" : newPromo.discount_amount + "¢"} off, applies to ${newPromo.applies_to}`,
        details: `Created promotion "${newPromo.name || newPromo.code.toUpperCase()}" — ${newPromo.discount_type === "percent" ? newPromo.discount_amount + "%" : newPromo.discount_amount + "¢"} off, applies to ${newPromo.applies_to}`,
      });
      setShowCreateModal(false);
      setNewPromo({ name: "", code: "", promoType: "first_visit_bonus", description: "", discount_type: "fixed", discount_amount: 0, min_purchase_cents: 0, max_uses: 0, start_date: "", end_date: "", applies_to: "all" });
      setTargetBusinesses([]);
      setTargetUsers([]);
      setBizSearch("");
      setUserSearch("");
      fetchData();
    } catch (err) {
      console.error("Error creating promotion:", err);
      alert("Error creating promotion. Check console for details.");
    }
  };

  const savePromoEdit = async () => {
    if (!selectedPromo) return;
    setSavingEdit(true);
    try {
      const { error } = await supabaseBrowser.from("promotions").update({
        code: editForm.code.toUpperCase(),
        description: editForm.description || null,
        discount_type: editForm.discount_type,
        discount_amount: editForm.discount_amount,
        min_purchase_cents: editForm.min_purchase_cents || 0,
        max_uses: editForm.max_uses || null,
        start_date: editForm.start_date || null,
        end_date: editForm.end_date || null,
        applies_to: editForm.applies_to,
        promo_type: editForm.promo_type,
      }).eq("id", selectedPromo.id);
      if (error) throw error;

      // Sync target businesses
      if (editForm.applies_to === "businesses") {
        await supabaseBrowser.from("promotion_target_businesses").delete().eq("promotion_id", selectedPromo.id);
        if (targetBusinesses.length > 0) {
          await supabaseBrowser.from("promotion_target_businesses").insert(
            targetBusinesses.map(b => ({ promotion_id: selectedPromo.id, business_id: b.id }))
          );
        }
      }
      // Sync target users
      if (editForm.applies_to === "specific") {
        await supabaseBrowser.from("promotion_target_users").delete().eq("promotion_id", selectedPromo.id);
        if (targetUsers.length > 0) {
          await supabaseBrowser.from("promotion_target_users").insert(
            targetUsers.map(u => ({ promotion_id: selectedPromo.id, user_id: u.id }))
          );
        }
      }

      logAudit({
        action: "update_promotion",
        tab: AUDIT_TABS.PROMOTIONS,
        subTab: "Promo Codes",
        targetType: "promotion",
        targetId: selectedPromo.id,
        entityName: editForm.code.toUpperCase(),
        fieldName: "promotion",
        oldValue: selectedPromo.code,
        newValue: editForm.code.toUpperCase(),
        details: `Updated promotion "${editForm.code.toUpperCase()}" — ${editForm.discount_type === "percent" ? editForm.discount_amount + "%" : editForm.discount_amount + "¢"} off, applies to ${editForm.applies_to}`,
      });
      setSelectedPromo(null);
      setEditingPromo(false);
      fetchData();
    } catch (err) {
      console.error("Error updating promotion:", err);
      alert("Error updating promotion. Check console for details.");
    } finally {
      setSavingEdit(false);
    }
  };

  const deletePromotion = async (id: string) => {
    if (!confirm("Are you sure you want to delete this promotion? This cannot be undone.")) return;
    const promoToDelete = promotions.find(p => p.id === id);
    try {
      const { error } = await supabaseBrowser.from("promotions").delete().eq("id", id);
      if (error) throw error;
      logAudit({
        action: "delete_promotion",
        tab: AUDIT_TABS.PROMOTIONS,
        subTab: "Promo Codes",
        targetType: "promotion",
        targetId: id,
        entityName: promoToDelete?.code || id,
        fieldName: "promotion",
        oldValue: promoToDelete?.code || id,
        newValue: "",
        details: `Deleted promotion "${promoToDelete?.code || id}"${promoToDelete?.description ? " — " + promoToDelete.description : ""}`,
      });
      setSelectedPromo(null);
      setEditingPromo(false);
      fetchData();
    } catch (err) {
      console.error("Error deleting promotion:", err);
      alert("Error deleting promotion. It may have redemptions linked to it.");
    }
  };

  const togglePromoStatus = async (id: string, currentStatus: boolean) => {
    const promoToToggle = promotions.find(p => p.id === id);
    try {
      const { error } = await supabaseBrowser.from("promotions").update({ is_active: !currentStatus }).eq("id", id);
      if (error) throw error;
      logAudit({
        action: "toggle_promotion",
        tab: AUDIT_TABS.PROMOTIONS,
        subTab: "Promo Codes",
        targetType: "promotion",
        targetId: id,
        entityName: promoToToggle?.code || id,
        fieldName: "is_active",
        oldValue: String(currentStatus),
        newValue: String(!currentStatus),
        details: `${currentStatus ? "Deactivated" : "Activated"} promotion "${promoToToggle?.code || id}"`,
      });
      setPromotions(prev => prev.map(p => p.id === id ? { ...p, is_active: !currentStatus } : p));
    } catch (err) {
      console.error("Error toggling promotion:", err);
    }
  };

  const createAdjustment = async () => {
    if (!newAdjustment.targetId || !newAdjustment.amount) {
      alert("Please select a target and enter an amount.");
      return;
    }
    setAdjSaving(true);
    try {
      const dbType = adjustmentTypeMap[newAdjustment.type] || "adjustment";
      const amountCents = Math.round(parseFloat(newAdjustment.amount) * 100);
      const noteParts: string[] = [];
      if (newAdjustment.type !== dbType) noteParts.push(`Type: ${newAdjustment.type}`);
      if (newAdjustment.reason) noteParts.push(newAdjustment.reason);
      if (newAdjustment.notes) noteParts.push(newAdjustment.notes);

      // For business targets, find the owner's user_id
      let userId = newAdjustment.targetId;
      let businessName = newAdjustment.businessName || null;
      if (newAdjustment.targetType === "business") {
        businessName = newAdjustment.targetName;
        const { data: owner } = await supabaseBrowser
          .from("business_users")
          .select("user_id")
          .eq("business_id", newAdjustment.targetId)
          .eq("role", "owner")
          .limit(1)
          .maybeSingle();
        if (!owner) {
          alert("Could not find owner for this business. Please select a user instead.");
          setAdjSaving(false);
          return;
        }
        userId = owner.user_id;
      }

      const { error } = await supabaseBrowser.from("user_transactions").insert({
        user_id: userId,
        type: dbType,
        date: new Date().toISOString(),
        business_name: businessName,
        amount_cents: amountCents,
        payout_cents: amountCents,
        method: "admin_adjustment",
        status: "completed",
        notes: noteParts.join(" | ") || null,
      });
      if (error) throw error;
      logAudit({
        action: "create_adjustment",
        tab: AUDIT_TABS.PROMOTIONS,
        subTab: "Adjustments",
        targetType: "promotion",
        targetId: userId,
        entityName: newAdjustment.targetName,
        fieldName: "adjustment",
        oldValue: "",
        newValue: `$${newAdjustment.amount} (${newAdjustment.type})`,
        details: `Created ${newAdjustment.type} adjustment of $${newAdjustment.amount} for ${newAdjustment.targetType} "${newAdjustment.targetName}"${newAdjustment.reason ? " — " + newAdjustment.reason : ""}`,
      });
      setShowAdjustmentModal(false);
      setNewAdjustment({ type: "discount", targetType: "user", targetId: "", targetName: "", amount: "", reason: "", notes: "", businessName: "" });
      setAdjTargetSearch("");
      setAdjTargetResults([]);
      fetchData();
    } catch (err) {
      console.error("Error creating adjustment:", err);
      alert("Error creating adjustment. Check console for details.");
    } finally {
      setAdjSaving(false);
    }
  };

  const openEdit = async (promo: Promotion) => {
    setSelectedPromo(promo);
    setEditingPromo(true);
    setEditForm({
      code: promo.code,
      description: promo.description || "",
      discount_type: promo.discount_type,
      discount_amount: promo.discount_amount,
      min_purchase_cents: promo.min_purchase_cents || 0,
      max_uses: promo.max_uses || 0,
      start_date: promo.start_date ? promo.start_date.slice(0, 10) : "",
      end_date: promo.end_date ? promo.end_date.slice(0, 10) : "",
      applies_to: promo.applies_to,
      promo_type: promo.promo_type || "first_visit_bonus",
    });

    // Load existing target businesses
    if (promo.applies_to === "businesses") {
      const { data: bizTargets } = await supabaseBrowser
        .from("promotion_target_businesses")
        .select("business_id, business:business_id(business_name, public_business_name)")
        .eq("promotion_id", promo.id);
      if (bizTargets) {
        setTargetBusinesses(bizTargets.map((t: Record<string, unknown>) => {
          const biz = t.business as Record<string, unknown> | null;
          return {
            id: t.business_id as string,
            name: ((biz?.public_business_name || biz?.business_name || t.business_id) as string),
          };
        }));
      }
    } else {
      setTargetBusinesses([]);
    }

    // Load existing target users
    if (promo.applies_to === "specific") {
      const { data: userTargets } = await supabaseBrowser
        .from("promotion_target_users")
        .select("user_id, profile:user_id(first_name, last_name, email)")
        .eq("promotion_id", promo.id);
      if (userTargets) {
        setTargetUsers(userTargets.map((t: Record<string, unknown>) => {
          const prof = t.profile as Record<string, unknown> | null;
          return {
            id: t.user_id as string,
            name: [prof?.first_name, prof?.last_name].filter(Boolean).join(" ") as string || "Unknown",
            email: (prof?.email || "") as string,
          };
        }));
      }
    } else {
      setTargetUsers([]);
    }

    setBizSearch("");
    setUserSearch("");
    setBizSearchResults([]);
    setUserSearchResults([]);
  };

  const openDetail = (promo: Promotion) => {
    setSelectedPromo(promo);
    setEditingPromo(false);
  };

  const getPromoStatus = (p: Promotion): string => {
    if (!p.is_active) return "inactive";
    if (p.end_date && new Date(p.end_date) <= now) return "completed";
    if (p.start_date && new Date(p.start_date) > now) return "scheduled";
    return "active";
  };

  // ==================== LOADING ====================
  if (loading) {
    return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.textSecondary }}>Loading promotions...</div>;
  }

  // ==================== RENDER ====================
  return (
    <div style={{ flex: 1, padding: 32, overflowY: "auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, background: COLORS.gradient1, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>🎁 Discounts & Promotions</h1>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={() => setShowAdjustmentModal(true)} style={{ padding: "12px 24px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, cursor: "pointer", fontWeight: 600 }}>+ New Adjustment</button>
          <button onClick={() => setShowCreateModal(true)} style={{ padding: "12px 24px", background: COLORS.gradient1, border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontWeight: 700 }}>+ Create Promotion</button>
        </div>
      </div>

      {/* ==================== SEASONAL PROMOTIONS ==================== */}
      <SectionTitle icon="🎉">Seasonal Promotions</SectionTitle>

      {/* Promo Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <StatCard icon="🎟️" value={activePromotions.length.toString()} label="Active Promos" gradient={COLORS.gradient2} />
        <StatCard icon="📅" value={scheduledPromotions.length.toString()} label="Scheduled" gradient={COLORS.gradient3} />
        <StatCard icon="🎯" value={totalRedemptions.toString()} label="Total Redemptions" gradient={COLORS.gradient1} />
        <StatCard icon="💰" value={formatMoney(totalDiscountGiven)} label="Total Discounted" gradient={COLORS.gradient4} />
      </div>

      <Card style={{ marginBottom: 24 }}>
        {/* How Promotions Work */}
        <div style={{ padding: 16, background: "rgba(57,255,20,0.1)", borderRadius: 12, marginBottom: 20, border: "1px solid " + COLORS.neonGreen }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <span style={{ fontSize: 24 }}>💡</span>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4, color: COLORS.neonGreen }}>How Promotions Work</div>
              <div style={{ fontSize: 12, color: COLORS.textSecondary }}>Create time-limited promotions to boost user engagement. Percentage or fixed-amount discounts with optional usage limits and date ranges.</div>
            </div>
          </div>
        </div>

        {/* Active & Upcoming Promotions */}
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Active & Upcoming Promotions</div>
        <div style={{ display: "grid", gap: 12, marginBottom: 20 }}>
          {[...activePromotions, ...scheduledPromotions].length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary }}>No active promotions. Create one to get started!</div>
          ) : (
            [...activePromotions, ...scheduledPromotions].map(promo => {
              const status = getPromoStatus(promo);
              return (
                <div key={promo.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: 16, background: COLORS.darkBg, borderRadius: 12, borderLeft: "4px solid " + (status === "active" ? COLORS.neonGreen : COLORS.neonBlue) }}>
                  <div style={{ fontSize: 32 }}>🎟️</div>
                  <div style={{ flex: 1, cursor: "pointer" }} onClick={() => openDetail(promo)}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 16 }}>{promo.code}</span>
                      <Badge status={status} />
                    </div>
                    <div style={{ display: "flex", gap: 16, fontSize: 12, color: COLORS.textSecondary, flexWrap: "wrap" }}>
                      {promo.start_date && promo.end_date && <span>📅 {formatDate(promo.start_date)} → {formatDate(promo.end_date)}</span>}
                      <span>👥 {promo.applies_to.replace("_", " ")}</span>
                      {promo.min_purchase_cents > 0 && <span>🛒 Min: {formatMoney(promo.min_purchase_cents)}</span>}
                      <span style={{ color: COLORS.neonGreen, fontWeight: 600 }}>
                        {promo.discount_type === "percent" ? `${promo.discount_amount}% off` : formatMoney(promo.discount_amount)}
                      </span>
                    </div>
                    {promo.description && <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 4 }}>{promo.description}</div>}
                  </div>
                  <div style={{ textAlign: "right", marginRight: 16 }}>
                    <div style={{ fontSize: 11, color: COLORS.textSecondary }}>Used {promo.uses_count}x</div>
                    <div style={{ fontWeight: 700, color: COLORS.neonPink }}>{promo.max_uses ? `${promo.uses_count}/${promo.max_uses}` : `${promo.uses_count}/∞`}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => openEdit(promo)} style={{ padding: "8px 12px", background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 6, color: COLORS.textSecondary, cursor: "pointer", fontSize: 11 }}>Edit</button>
                    {status === "active" && (
                      <button onClick={() => togglePromoStatus(promo.id, promo.is_active)} style={{ padding: "8px 12px", background: "rgba(255,49,49,0.2)", border: "1px solid " + (COLORS.neonRed || "#ff3131"), borderRadius: 6, color: COLORS.neonRed || "#ff3131", cursor: "pointer", fontSize: 11 }}>End</button>
                    )}
                    {status !== "active" && (
                      <button onClick={() => togglePromoStatus(promo.id, promo.is_active)} style={{ padding: "8px 12px", background: "rgba(57,255,20,0.2)", border: "1px solid " + COLORS.neonGreen, borderRadius: 6, color: COLORS.neonGreen, cursor: "pointer", fontSize: 11 }}>Activate</button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Completed / Inactive Promotions */}
        {completedPromotions.length > 0 && (
          <>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Completed / Inactive Promotions</div>
            <DataTable
              columns={[
                { key: "code", label: "Promotion", render: (v: unknown) => <span style={{ fontWeight: 600, fontFamily: "monospace" }}>{String(v)}</span> },
                { key: "discount_type", label: "Type", render: (v: unknown, row: Record<string, unknown>) => (
                  <span style={{ fontWeight: 600 }}>{v === "percent" ? `${row.discount_amount}%` : formatMoney(Number(row.discount_amount))}</span>
                )},
                { key: "start_date", label: "Period", render: (v: unknown, row: Record<string, unknown>) => <span style={{ fontSize: 12 }}>{v ? formatDate(String(v)) : "—"} → {row.end_date ? formatDate(String(row.end_date)) : "—"}</span> },
                { key: "uses_count", label: "Uses", render: (v: unknown, row: Record<string, unknown>) => <span>{String(v)}{row.max_uses ? ` / ${row.max_uses}` : ""}</span> },
                { key: "is_active", label: "Status", render: (_v: unknown, row: Record<string, unknown>) => <Badge status={getPromoStatus(row as unknown as Promotion)} /> },
                { key: "id", label: "Actions", render: (_v: unknown, row: Record<string, unknown>) => (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => openEdit(row as unknown as Promotion)} style={{ padding: "4px 10px", background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 4, color: COLORS.textSecondary, cursor: "pointer", fontSize: 10 }}>Edit</button>
                    <button onClick={() => togglePromoStatus(String(row.id), Boolean(row.is_active))} style={{ padding: "4px 10px", background: "rgba(57,255,20,0.15)", border: "1px solid " + COLORS.neonGreen, borderRadius: 4, color: COLORS.neonGreen, cursor: "pointer", fontSize: 10 }}>Reactivate</button>
                    <button onClick={() => deletePromotion(String(row.id))} style={{ padding: "4px 10px", background: "rgba(255,49,49,0.15)", border: "1px solid " + (COLORS.neonRed || "#ff3131"), borderRadius: 4, color: COLORS.neonRed || "#ff3131", cursor: "pointer", fontSize: 10 }}>Delete</button>
                  </div>
                )},
              ]}
              data={completedPromotions as unknown as Record<string, unknown>[]}
            />
          </>
        )}

        {/* Redemptions History */}
        {redemptions.length > 0 && (
          <>
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 24, marginBottom: 12 }}>Recent Redemptions</div>
            <DataTable
              columns={[
                { key: "promo_code", label: "Promotion", render: (v: unknown) => <span style={{ fontWeight: 600, color: COLORS.neonPink, fontFamily: "monospace" }}>{String(v)}</span> },
                { key: "user_name", label: "User", render: (v: unknown) => <span>{String(v)}</span> },
                { key: "business_name", label: "Business", render: (v: unknown) => <span>{String(v)}</span> },
                { key: "discount_applied_cents", label: "Discount", render: (v: unknown) => <span style={{ fontWeight: 700, color: COLORS.neonGreen }}>{formatMoney(Number(v))}</span> },
                { key: "created_at", label: "Date", render: (v: unknown) => formatDateTime(String(v)) },
              ]}
              data={redemptions as unknown as Record<string, unknown>[]}
            />
          </>
        )}
      </Card>

      {/* ==================== DISCOUNTS & CHARGEBACKS ==================== */}
      <SectionTitle icon="💰">Adjustments & Chargebacks</SectionTitle>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <StatCard icon="🎁" value={formatMoney(bonusTotal)} label="Bonuses Given" gradient={COLORS.gradient2} />
        <StatCard icon="💸" value={formatMoney(refundTotal)} label="Refunds / Chargebacks" gradient="linear-gradient(135deg, #ff3131, #990000)" />
        <StatCard icon="🏷️" value={formatMoney(adjustmentCredits)} label="Adjustments" gradient={COLORS.gradient4} />
        <StatCard icon="📊" value={adjustments.length.toString()} label="Total Entries" gradient={COLORS.gradient3} />
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <input type="text" placeholder="Search by user, business, or notes..." value={adjFilters.search} onChange={e => setAdjFilters({ ...adjFilters, search: e.target.value })} style={{ flex: 1, padding: "12px 14px", border: "1px solid " + COLORS.cardBorder, borderRadius: 10, fontSize: 13, background: COLORS.cardBg, color: COLORS.textPrimary }} />
        <select value={adjFilters.type} onChange={e => setAdjFilters({ ...adjFilters, type: e.target.value })} style={{ padding: "12px 16px", border: "1px solid " + COLORS.cardBorder, borderRadius: 10, fontSize: 13, background: COLORS.cardBg, color: COLORS.textPrimary }}>
          <option value="all">All Types</option>
          <option value="bonus">Bonus</option>
          <option value="refund">Refund</option>
          <option value="adjustment">Adjustment</option>
        </select>
        <select value={adjFilters.status} onChange={e => setAdjFilters({ ...adjFilters, status: e.target.value })} style={{ padding: "12px 16px", border: "1px solid " + COLORS.cardBorder, borderRadius: 10, fontSize: 13, background: COLORS.cardBg, color: COLORS.textPrimary }}>
          <option value="all">All Status</option>
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {/* Adjustments Table */}
      <Card>
        {filteredAdjustments.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary }}>No adjustments found.</div>
        ) : (
          <DataTable
            columns={[
              { key: "type", label: "Type", render: (v: unknown) => {
                const t = adjustmentTypes.find(at => adjustmentTypeMap[at.id] === v) || { icon: "📋", label: String(v), color: COLORS.textSecondary };
                return <span style={{ color: t.color, fontWeight: 600 }}>{t.icon} {String(v)}</span>;
              }},
              { key: "user_name", label: "User" },
              { key: "business_name", label: "Business", render: (v: unknown) => v ? String(v) : "—" },
              { key: "payout_cents", label: "Amount", render: (v: unknown) => <span style={{ fontWeight: 700, color: COLORS.neonGreen }}>{formatMoney(Number(v))}</span> },
              { key: "status", label: "Status", render: (v: unknown) => <Badge status={String(v)} /> },
              { key: "notes", label: "Notes", render: (v: unknown) => <span style={{ fontSize: 11, color: COLORS.textSecondary }}>{v ? String(v).slice(0, 50) + (String(v).length > 50 ? "..." : "") : "—"}</span> },
              { key: "date", label: "Date", render: (v: unknown) => formatDateTime(String(v)) },
            ]}
            data={filteredAdjustments as unknown as Record<string, unknown>[]}
          />
        )}
      </Card>

      {/* ==================== CREATE PROMOTION MODAL ==================== */}
      {showCreateModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1001 }} onClick={() => setShowCreateModal(false)}>
          <div style={{ background: COLORS.cardBg, borderRadius: 20, padding: 32, width: 550, maxWidth: "90%", maxHeight: "90vh", overflowY: "auto", border: "1px solid " + COLORS.cardBorder }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>🎉 Create New Promotion</h2>

            <div style={{ display: "grid", gap: 16, marginBottom: 24 }}>
              {/* Promotion Name */}
              <div>
                <label style={labelStyle}>Promotion Name</label>
                <input type="text" value={newPromo.name} onChange={e => setNewPromo({ ...newPromo, name: e.target.value })} placeholder="e.g. Valentine's Day Double Payout" style={inputStyle} />
              </div>

              {/* Promotion Type */}
              <div>
                <label style={labelStyle}>Promotion Type</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {promoTypes.map(t => (
                    <button key={t.id} onClick={() => {
                      const defaults: Record<string, { discount_type: string; applies_to: string }> = {
                        payout_multiplier: { discount_type: "percent", applies_to: "all" },
                        first_visit_bonus: { discount_type: "fixed", applies_to: "new_users" },
                        signup_bonus: { discount_type: "fixed", applies_to: "new_users" },
                        flat_bonus: { discount_type: "fixed", applies_to: "all" },
                      };
                      setNewPromo({ ...newPromo, promoType: t.id, ...defaults[t.id] });
                    }} style={{ padding: 12, borderRadius: 10, border: newPromo.promoType === t.id ? "2px solid " + COLORS.neonPink : "1px solid " + COLORS.cardBorder, background: newPromo.promoType === t.id ? "rgba(255,45,146,0.1)" : COLORS.darkBg, cursor: "pointer", textAlign: "left" }}>
                      <div style={{ fontSize: 16, marginBottom: 2 }}>{t.icon} <span style={{ fontWeight: 600, fontSize: 12, color: newPromo.promoType === t.id ? COLORS.neonPink : COLORS.textPrimary }}>{t.label}</span></div>
                      <div style={{ fontSize: 10, color: COLORS.textSecondary }}>{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Promo Code */}
              <div>
                <label style={labelStyle}>Promo Code</label>
                <input type="text" value={newPromo.code} onChange={e => setNewPromo({ ...newPromo, code: e.target.value.toUpperCase() })} placeholder="SAVE20" style={{ ...inputStyle, fontFamily: "monospace", letterSpacing: 2 }} />
              </div>

              {/* Bonus Amount */}
              <div>
                <label style={labelStyle}>Bonus Amount ({newPromo.discount_type === "percent" ? "%" : "¢"})</label>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 4 }}>
                    {[
                      { val: "fixed", label: "$" },
                      { val: "percent", label: "%" },
                    ].map(c => (
                      <button key={c.val} onClick={() => setNewPromo({ ...newPromo, discount_type: c.val })} style={{ width: 36, height: 36, borderRadius: 8, border: newPromo.discount_type === c.val ? "2px solid " + COLORS.neonPink : "1px solid " + COLORS.cardBorder, background: newPromo.discount_type === c.val ? "rgba(255,45,146,0.15)" : COLORS.darkBg, color: newPromo.discount_type === c.val ? COLORS.neonPink : COLORS.textSecondary, cursor: "pointer", fontWeight: 700, fontSize: 14 }}>{c.label}</button>
                    ))}
                  </div>
                  <input type="number" value={newPromo.discount_amount} onChange={e => setNewPromo({ ...newPromo, discount_amount: parseInt(e.target.value) || 0 })} placeholder="0" style={{ ...inputStyle, flex: 1, fontSize: 18, fontWeight: 700 }} />
                </div>
              </div>

              {/* Start / End Date */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Start Date</label>
                  <input type="date" value={newPromo.start_date} onChange={e => setNewPromo({ ...newPromo, start_date: e.target.value })} style={{ ...inputStyle, colorScheme: "dark" }} />
                </div>
                <div>
                  <label style={labelStyle}>End Date</label>
                  <input type="date" value={newPromo.end_date} onChange={e => setNewPromo({ ...newPromo, end_date: e.target.value })} style={{ ...inputStyle, colorScheme: "dark" }} />
                </div>
              </div>

              {/* Target Audience */}
              <div>
                <label style={labelStyle}>Target Audience</label>
                <select value={newPromo.applies_to} onChange={e => { setNewPromo({ ...newPromo, applies_to: e.target.value }); setTargetBusinesses([]); setTargetUsers([]); }} style={inputStyle}>
                  <option value="all">All Users</option>
                  <option value="new_users">New Users Only</option>
                  <option value="businesses">Specific Businesses</option>
                  <option value="specific">Specific Users</option>
                </select>
              </div>

              {/* Target Businesses search (when applies_to === "businesses") */}
              {newPromo.applies_to === "businesses" && (
                <div>
                  <label style={labelStyle}>Target Businesses</label>
                  <input
                    type="text"
                    value={bizSearch}
                    onChange={e => { setBizSearch(e.target.value); searchBusinesses(e.target.value); }}
                    placeholder="Search business by name..."
                    style={inputStyle}
                  />
                  {bizSearchResults.length > 0 && (
                    <div style={{ marginTop: 4, background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, maxHeight: 150, overflowY: "auto" }}>
                      {bizSearchResults.filter(b => !targetBusinesses.some(tb => tb.id === b.id)).map(b => (
                        <button key={b.id} onClick={() => { setTargetBusinesses(prev => [...prev, b]); setBizSearch(""); setBizSearchResults([]); }} style={{ display: "block", width: "100%", padding: "8px 12px", background: "none", border: "none", borderBottom: "1px solid " + COLORS.cardBorder, color: COLORS.textPrimary, cursor: "pointer", textAlign: "left", fontSize: 12 }}>
                          {b.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {targetBusinesses.length > 0 && (
                    <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {targetBusinesses.map(b => (
                        <span key={b.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 50, background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.3)", color: COLORS.neonBlue, fontSize: 11, fontWeight: 600 }}>
                          {b.name}
                          <button onClick={() => setTargetBusinesses(prev => prev.filter(tb => tb.id !== b.id))} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Target Users search (when applies_to === "specific") */}
              {newPromo.applies_to === "specific" && (
                <div>
                  <label style={labelStyle}>Target Users</label>
                  <input
                    type="text"
                    value={userSearch}
                    onChange={e => { setUserSearch(e.target.value); searchUsers(e.target.value); }}
                    placeholder="Search user by name or email..."
                    style={inputStyle}
                  />
                  {userSearchResults.length > 0 && (
                    <div style={{ marginTop: 4, background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, maxHeight: 150, overflowY: "auto" }}>
                      {userSearchResults.filter(u => !targetUsers.some(tu => tu.id === u.id)).map(u => (
                        <button key={u.id} onClick={() => { setTargetUsers(prev => [...prev, u]); setUserSearch(""); setUserSearchResults([]); }} style={{ display: "block", width: "100%", padding: "8px 12px", background: "none", border: "none", borderBottom: "1px solid " + COLORS.cardBorder, color: COLORS.textPrimary, cursor: "pointer", textAlign: "left", fontSize: 12 }}>
                          {u.name} <span style={{ color: COLORS.textSecondary }}>({u.email})</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {targetUsers.length > 0 && (
                    <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {targetUsers.map(u => (
                        <span key={u.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 50, background: "rgba(255,45,146,0.1)", border: "1px solid rgba(255,45,146,0.3)", color: COLORS.neonPink, fontSize: 11, fontWeight: 600 }}>
                          {u.name}
                          <button onClick={() => setTargetUsers(prev => prev.filter(tu => tu.id !== u.id))} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Max Uses */}
              <div>
                <label style={labelStyle}>Max Redemptions (0 = unlimited) — e.g. &quot;first 1,000 users&quot;</label>
                <input type="number" value={newPromo.max_uses} onChange={e => setNewPromo({ ...newPromo, max_uses: parseInt(e.target.value) || 0 })} placeholder="0" style={inputStyle} />
              </div>

              {/* Description */}
              <div>
                <label style={labelStyle}>Additional Notes (Optional)</label>
                <input type="text" value={newPromo.description} onChange={e => setNewPromo({ ...newPromo, description: e.target.value })} placeholder="Internal notes about this promotion" style={inputStyle} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button onClick={() => setShowCreateModal(false)} style={{ padding: "12px 24px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, cursor: "pointer", fontWeight: 600 }}>Cancel</button>
              <button onClick={createPromotion} disabled={!newPromo.code} style={{ padding: "12px 24px", background: COLORS.gradient1, border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontWeight: 700, opacity: !newPromo.code ? 0.5 : 1 }}>Create Promotion</button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== NEW ADJUSTMENT MODAL ==================== */}
      {showAdjustmentModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1001 }} onClick={() => setShowAdjustmentModal(false)}>
          <div style={{ background: COLORS.cardBg, borderRadius: 20, padding: 32, width: 550, maxWidth: "90%", maxHeight: "90vh", overflowY: "auto", border: "1px solid " + COLORS.cardBorder }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>💰 New Adjustment</h2>

            {/* Type Selection */}
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Adjustment Type</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {adjustmentTypes.map(t => (
                  <button key={t.id} onClick={() => setNewAdjustment({ ...newAdjustment, type: t.id })} style={{ padding: 14, borderRadius: 10, border: newAdjustment.type === t.id ? "2px solid " + t.color : "1px solid " + COLORS.cardBorder, background: newAdjustment.type === t.id ? "rgba(255,255,255,0.05)" : COLORS.darkBg, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 20 }}>{t.icon}</span>
                    <span style={{ fontSize: 11, color: newAdjustment.type === t.id ? t.color : COLORS.textSecondary, fontWeight: 600 }}>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Apply To */}
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Apply To</label>
              <div style={{ display: "flex", gap: 12 }}>
                {[{ id: "user", label: "👤 User" }, { id: "business", label: "🏢 Business" }].map(tt => (
                  <button key={tt.id} onClick={() => { setNewAdjustment({ ...newAdjustment, targetType: tt.id, targetId: "", targetName: "" }); setAdjTargetSearch(""); setAdjTargetResults([]); }} style={{ flex: 1, padding: 14, borderRadius: 10, border: newAdjustment.targetType === tt.id ? "2px solid " + COLORS.neonPink : "1px solid " + COLORS.cardBorder, background: newAdjustment.targetType === tt.id ? "rgba(255,45,146,0.1)" : COLORS.darkBg, color: newAdjustment.targetType === tt.id ? COLORS.neonPink : COLORS.textSecondary, cursor: "pointer", fontWeight: 600 }}>{tt.label}</button>
                ))}
              </div>
            </div>

            {/* Target Search */}
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>{newAdjustment.targetType === "business" ? "Business" : "User"} Name or ID</label>
              {newAdjustment.targetId ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 12, background: COLORS.darkBg, borderRadius: 10, border: "1px solid " + COLORS.neonGreen }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{newAdjustment.targetName}</div>
                  </div>
                  <button onClick={() => { setNewAdjustment({ ...newAdjustment, targetId: "", targetName: "" }); setAdjTargetSearch(""); }} style={{ padding: "4px 12px", background: "rgba(255,45,146,0.2)", border: "1px solid " + COLORS.neonPink, borderRadius: 6, color: COLORS.neonPink, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Change</button>
                </div>
              ) : (
                <div style={{ position: "relative" }}>
                  <input type="text" value={adjTargetSearch} onChange={e => setAdjTargetSearch(e.target.value)} placeholder={newAdjustment.targetType === "business" ? "Search business..." : "Search user..."} style={inputStyle} />
                  {adjTargetSearching && <div style={{ padding: 8, textAlign: "center", color: COLORS.textSecondary, fontSize: 12 }}>Searching...</div>}
                  {!adjTargetSearching && adjTargetResults.length > 0 && (
                    <div style={{ background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, marginTop: 4, maxHeight: 200, overflowY: "auto" }}>
                      {adjTargetResults.map(r => (
                        <div key={r.id} onClick={() => { setNewAdjustment({ ...newAdjustment, targetId: r.id, targetName: r.name }); setAdjTargetSearch(""); setAdjTargetResults([]); }} style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid " + COLORS.cardBorder, fontSize: 13 }}>
                          <div style={{ fontWeight: 600 }}>{r.name}</div>
                          <div style={{ fontSize: 11, color: COLORS.textSecondary }}>{r.sublabel || r.email}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {!adjTargetSearching && adjTargetSearch.length >= 2 && adjTargetResults.length === 0 && (
                    <div style={{ padding: 8, textAlign: "center", color: COLORS.textSecondary, fontSize: 12 }}>No results found</div>
                  )}
                </div>
              )}
            </div>

            {/* Amount */}
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Amount ($)</label>
              <input type="number" step="0.01" value={newAdjustment.amount} onChange={e => setNewAdjustment({ ...newAdjustment, amount: e.target.value })} placeholder="0.00" style={{ ...inputStyle, fontSize: 18, fontWeight: 700 }} />
            </div>

            {/* Reason */}
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Reason</label>
              <input type="text" value={newAdjustment.reason} onChange={e => setNewAdjustment({ ...newAdjustment, reason: e.target.value })} placeholder="Reason for adjustment..." style={inputStyle} />
            </div>

            {/* Notes */}
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Internal Notes (optional)</label>
              <textarea value={newAdjustment.notes} onChange={e => setNewAdjustment({ ...newAdjustment, notes: e.target.value })} placeholder="Additional notes..." style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} />
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button onClick={() => setShowAdjustmentModal(false)} style={{ padding: "12px 24px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, cursor: "pointer", fontWeight: 600 }}>Cancel</button>
              <button onClick={createAdjustment} disabled={adjSaving || !newAdjustment.targetId || !newAdjustment.amount} style={{ padding: "12px 24px", background: COLORS.gradient1, border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontWeight: 700, opacity: (!newAdjustment.targetId || !newAdjustment.amount || adjSaving) ? 0.5 : 1 }}>
                {adjSaving ? "Creating..." : "Create Adjustment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== PROMO DETAIL / EDIT MODAL ==================== */}
      {selectedPromo && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1001 }} onClick={() => { setSelectedPromo(null); setEditingPromo(false); }}>
          <div style={{ background: COLORS.cardBg, borderRadius: 20, padding: 32, width: 550, maxWidth: "90%", maxHeight: "90vh", overflowY: "auto", border: "1px solid " + COLORS.cardBorder }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
              <div>
                {editingPromo ? (
                  <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.neonBlue }}>✏️ Edit Promotion</div>
                ) : (
                  <>
                    <div style={{ fontFamily: "monospace", fontSize: 28, fontWeight: 800, color: COLORS.neonPink }}>{selectedPromo.code}</div>
                    <div style={{ color: COLORS.textSecondary }}>{selectedPromo.description}</div>
                  </>
                )}
              </div>
              <button onClick={() => { setSelectedPromo(null); setEditingPromo(false); }} style={{ background: "none", border: "none", color: COLORS.textSecondary, fontSize: 24, cursor: "pointer" }}>×</button>
            </div>

            {editingPromo ? (
              /* Edit Form */
              <div style={{ display: "grid", gap: 16, marginBottom: 24 }}>
                <div>
                  <label style={labelStyle}>Promo Code</label>
                  <input type="text" value={editForm.code} onChange={e => setEditForm({ ...editForm, code: e.target.value.toUpperCase() })} style={{ ...inputStyle, fontFamily: "monospace" }} />
                </div>
                <div>
                  <label style={labelStyle}>Promotion Type</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {promoTypes.map(t => (
                      <button key={t.id} onClick={() => setEditForm({ ...editForm, promo_type: t.id })} style={{ padding: 10, borderRadius: 10, border: editForm.promo_type === t.id ? "2px solid " + COLORS.neonPink : "1px solid " + COLORS.cardBorder, background: editForm.promo_type === t.id ? "rgba(255,45,146,0.1)" : COLORS.darkBg, cursor: "pointer", textAlign: "left" }}>
                        <div style={{ fontSize: 14 }}>{t.icon} <span style={{ fontWeight: 600, fontSize: 11, color: editForm.promo_type === t.id ? COLORS.neonPink : COLORS.textPrimary }}>{t.label}</span></div>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Description</label>
                  <input type="text" value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} style={inputStyle} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Discount Type</label>
                    <select value={editForm.discount_type} onChange={e => setEditForm({ ...editForm, discount_type: e.target.value })} style={inputStyle}>
                      <option value="percent">Percentage</option>
                      <option value="fixed">Fixed Amount (cents)</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>{editForm.discount_type === "percent" ? "Discount (%)" : "Discount (cents)"}</label>
                    <input type="number" value={editForm.discount_amount} onChange={e => setEditForm({ ...editForm, discount_amount: parseInt(e.target.value) || 0 })} style={inputStyle} />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Minimum Purchase (cents)</label>
                  <input type="number" value={editForm.min_purchase_cents} onChange={e => setEditForm({ ...editForm, min_purchase_cents: parseInt(e.target.value) || 0 })} style={inputStyle} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Start Date</label>
                    <input type="date" value={editForm.start_date} onChange={e => setEditForm({ ...editForm, start_date: e.target.value })} style={{ ...inputStyle, colorScheme: "dark" }} />
                  </div>
                  <div>
                    <label style={labelStyle}>End Date</label>
                    <input type="date" value={editForm.end_date} onChange={e => setEditForm({ ...editForm, end_date: e.target.value })} style={{ ...inputStyle, colorScheme: "dark" }} />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Max Uses (0 = unlimited)</label>
                    <input type="number" value={editForm.max_uses} onChange={e => setEditForm({ ...editForm, max_uses: parseInt(e.target.value) || 0 })} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Applies To</label>
                    <select value={editForm.applies_to} onChange={e => { setEditForm({ ...editForm, applies_to: e.target.value }); if (e.target.value !== "businesses") setTargetBusinesses([]); if (e.target.value !== "specific") setTargetUsers([]); }} style={inputStyle}>
                      <option value="all">All Users</option>
                      <option value="new_users">New Users Only</option>
                      <option value="businesses">Specific Businesses</option>
                      <option value="specific">Specific Users</option>
                    </select>
                  </div>
                </div>

                {/* Target Businesses (edit modal) */}
                {editForm.applies_to === "businesses" && (
                  <div>
                    <label style={labelStyle}>Target Businesses</label>
                    <input
                      type="text"
                      value={bizSearch}
                      onChange={e => { setBizSearch(e.target.value); searchBusinesses(e.target.value); }}
                      placeholder="Search business by name..."
                      style={inputStyle}
                    />
                    {bizSearchResults.length > 0 && (
                      <div style={{ marginTop: 4, background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, maxHeight: 150, overflowY: "auto" }}>
                        {bizSearchResults.filter(b => !targetBusinesses.some(tb => tb.id === b.id)).map(b => (
                          <button key={b.id} onClick={() => { setTargetBusinesses(prev => [...prev, b]); setBizSearch(""); setBizSearchResults([]); }} style={{ display: "block", width: "100%", padding: "8px 12px", background: "none", border: "none", borderBottom: "1px solid " + COLORS.cardBorder, color: COLORS.textPrimary, cursor: "pointer", textAlign: "left", fontSize: 12 }}>
                            {b.name}
                          </button>
                        ))}
                      </div>
                    )}
                    {targetBusinesses.length > 0 && (
                      <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {targetBusinesses.map(b => (
                          <span key={b.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 50, background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.3)", color: COLORS.neonBlue, fontSize: 11, fontWeight: 600 }}>
                            {b.name}
                            <button onClick={() => setTargetBusinesses(prev => prev.filter(tb => tb.id !== b.id))} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Target Users (edit modal) */}
                {editForm.applies_to === "specific" && (
                  <div>
                    <label style={labelStyle}>Target Users</label>
                    <input
                      type="text"
                      value={userSearch}
                      onChange={e => { setUserSearch(e.target.value); searchUsers(e.target.value); }}
                      placeholder="Search user by name or email..."
                      style={inputStyle}
                    />
                    {userSearchResults.length > 0 && (
                      <div style={{ marginTop: 4, background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, maxHeight: 150, overflowY: "auto" }}>
                        {userSearchResults.filter(u => !targetUsers.some(tu => tu.id === u.id)).map(u => (
                          <button key={u.id} onClick={() => { setTargetUsers(prev => [...prev, u]); setUserSearch(""); setUserSearchResults([]); }} style={{ display: "block", width: "100%", padding: "8px 12px", background: "none", border: "none", borderBottom: "1px solid " + COLORS.cardBorder, color: COLORS.textPrimary, cursor: "pointer", textAlign: "left", fontSize: 12 }}>
                            {u.name} <span style={{ color: COLORS.textSecondary }}>({u.email})</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {targetUsers.length > 0 && (
                      <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {targetUsers.map(u => (
                          <span key={u.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 50, background: "rgba(255,45,146,0.1)", border: "1px solid rgba(255,45,146,0.3)", color: COLORS.neonPink, fontSize: 11, fontWeight: 600 }}>
                            {u.name}
                            <button onClick={() => setTargetUsers(prev => prev.filter(tu => tu.id !== u.id))} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Detail View */
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
                <div style={{ padding: 16, background: COLORS.darkBg, borderRadius: 12 }}>
                  <div style={{ fontSize: 11, color: COLORS.textSecondary }}>Discount</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.neonGreen }}>{selectedPromo.discount_type === "percent" ? `${selectedPromo.discount_amount}%` : formatMoney(selectedPromo.discount_amount)}</div>
                </div>
                <div style={{ padding: 16, background: COLORS.darkBg, borderRadius: 12 }}>
                  <div style={{ fontSize: 11, color: COLORS.textSecondary }}>Uses</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{selectedPromo.uses_count} / {selectedPromo.max_uses || "∞"}</div>
                </div>
                <div style={{ padding: 16, background: COLORS.darkBg, borderRadius: 12 }}>
                  <div style={{ fontSize: 11, color: COLORS.textSecondary }}>Start Date</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{selectedPromo.start_date ? formatDate(selectedPromo.start_date) : "Immediate"}</div>
                </div>
                <div style={{ padding: 16, background: COLORS.darkBg, borderRadius: 12 }}>
                  <div style={{ fontSize: 11, color: COLORS.textSecondary }}>End Date</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{selectedPromo.end_date ? formatDate(selectedPromo.end_date) : "Never"}</div>
                </div>
                <div style={{ padding: 16, background: COLORS.darkBg, borderRadius: 12 }}>
                  <div style={{ fontSize: 11, color: COLORS.textSecondary }}>Min Purchase</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{selectedPromo.min_purchase_cents > 0 ? formatMoney(selectedPromo.min_purchase_cents) : "None"}</div>
                </div>
                <div style={{ padding: 16, background: COLORS.darkBg, borderRadius: 12 }}>
                  <div style={{ fontSize: 11, color: COLORS.textSecondary }}>Applies To</div>
                  <div style={{ fontSize: 14, fontWeight: 600, textTransform: "capitalize" }}>{selectedPromo.applies_to.replace("_", " ")}</div>
                </div>
                <div style={{ padding: 16, background: COLORS.darkBg, borderRadius: 12, gridColumn: "1 / -1" }}>
                  <div style={{ fontSize: 11, color: COLORS.textSecondary }}>Created</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{formatDateTime(selectedPromo.created_at)}</div>
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 12, justifyContent: "space-between" }}>
              <button onClick={() => deletePromotion(selectedPromo.id)} style={{ padding: "12px 24px", background: "rgba(255,49,49,0.15)", border: "1px solid " + (COLORS.neonRed || "#ff3131"), borderRadius: 10, color: COLORS.neonRed || "#ff3131", cursor: "pointer", fontWeight: 600, fontSize: 12 }}>Delete Promotion</button>
              <div style={{ display: "flex", gap: 12 }}>
                {editingPromo ? (
                  <>
                    <button onClick={() => setEditingPromo(false)} style={{ padding: "12px 24px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, cursor: "pointer", fontWeight: 600 }}>Cancel</button>
                    <button onClick={savePromoEdit} disabled={savingEdit || !editForm.code} style={{ padding: "12px 24px", background: COLORS.gradient1, border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontWeight: 700, opacity: (savingEdit || !editForm.code) ? 0.5 : 1 }}>
                      {savingEdit ? "Saving..." : "Save Changes"}
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => { setSelectedPromo(null); setEditingPromo(false); }} style={{ padding: "12px 24px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, cursor: "pointer", fontWeight: 600 }}>Close</button>
                    <button onClick={() => openEdit(selectedPromo)} style={{ padding: "12px 24px", background: COLORS.gradient1, border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontWeight: 700 }}>Edit</button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
