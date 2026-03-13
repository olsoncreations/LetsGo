"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { COLORS, Card } from "@/components/admin/components";
import { logAudit, AUDIT_TABS } from "@/lib/auditLog";

// ==================== TYPES ====================
interface PlatformSettings {
  id: number;
  visit_thresholds: { level: number; min: number; max: number | null; label: string }[];
  default_cashback_bps: number[];
  preset_conservative_bps: number[];
  preset_standard_bps: number[];
  preset_aggressive_bps: number[];
  trial_duration_days: number;
  trial_cashback_bps: number;
  platform_fee_bps: number;
  platform_fee_cap_cents: number;
  cc_processing_fee_bps: number;
  max_receipt_age_days: number;
  min_receipt_cents: number;
  max_receipt_cents: number;
  rolling_window_days: number;
  min_payout_cents: number;
  payout_processing_days: number;
  payout_methods: string[];
  // Roles & Maintenance (persisted)
  roles_config: RoleConfig[];
  maintenance_enabled: boolean;
  maintenance_message: string;
  // Pricing (persisted)
  package_pricing: PackagePricing;
  ad_pricing: AdPricing;
  // Change tracking
  change_history: { date: string; changed_by: string; changes: string }[];
  scheduled_maintenance: { date: string; time: string; duration_hours: number; notify_advance: boolean } | null;
  maintenance_history: { date: string; action: string; by: string }[];
  // Influencer tiers
  default_influencer_tiers: { tier_index: number; min_signups: number; max_signups: number | null; rate_cents: number; label: string }[];
  // Metadata
  updated_at: string | null;
  updated_by: string | null;
}

interface StaffUser {
  user_id: string;
  name: string;
  role: string;
  created_at: string;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  active: boolean;
}

interface RoleConfig {
  id: string;
  name: string;
  permissions: string[];
}

interface PackagePricing {
  basic_monthly_cents: number;
  premium_monthly_cents: number;
  addon_video_5_monthly_cents: number;
  addon_live_15_monthly_cents: number;
  addon_live_30_monthly_cents: number;
  tpms_monthly_cents: number;
}

interface AdPricing {
  spotlight_1day_cents: number;
  spotlight_7day_cents: number;
  spotlight_14day_cents: number;
  push_100mile_cents: number;
  push_tourwide_cents: number;
}

// ==================== DEFAULTS ====================
const DEFAULT_SETTINGS: PlatformSettings = {
  id: 1,
  visit_thresholds: [
    { level: 1, min: 1, max: 10, label: "Starter" },
    { level: 2, min: 11, max: 20, label: "Regular" },
    { level: 3, min: 21, max: 30, label: "Favorite" },
    { level: 4, min: 31, max: 40, label: "VIP" },
    { level: 5, min: 41, max: 50, label: "Elite" },
    { level: 6, min: 51, max: 60, label: "Legend" },
    { level: 7, min: 61, max: null, label: "Ultimate" },
  ],
  default_cashback_bps: [500, 750, 1000, 1250, 1500, 1750, 2000],
  preset_conservative_bps: [300, 400, 500, 600, 700, 800, 1000],
  preset_standard_bps: [500, 750, 1000, 1250, 1500, 1750, 2000],
  preset_aggressive_bps: [800, 1000, 1200, 1400, 1600, 1800, 2000],
  trial_duration_days: 90,
  trial_cashback_bps: 0,
  platform_fee_bps: 1000,
  platform_fee_cap_cents: 500,
  cc_processing_fee_bps: 300,
  max_receipt_age_days: 7,
  min_receipt_cents: 500,
  max_receipt_cents: 50000,
  rolling_window_days: 365,
  min_payout_cents: 2000,
  payout_processing_days: 3,
  payout_methods: ["venmo", "paypal", "bank_transfer"],
  roles_config: [
    { id: "admin", name: "Administrator", permissions: ["all"] },
    { id: "senior_staff", name: "Senior Staff", permissions: ["view_receipts", "approve_receipts", "view_users", "view_businesses", "approve_payouts", "manage_support", "view_analytics"] },
    { id: "staff", name: "Staff", permissions: ["view_receipts", "manage_support"] },
    { id: "viewer", name: "Viewer", permissions: ["view_only"] },
  ],
  package_pricing: {
    basic_monthly_cents: 0,
    premium_monthly_cents: 10000,
    addon_video_5_monthly_cents: 5000,
    addon_live_15_monthly_cents: 5000,
    addon_live_30_monthly_cents: 10000,
    tpms_monthly_cents: 20000,
  },
  ad_pricing: {
    spotlight_1day_cents: 9900,
    spotlight_7day_cents: 59900,
    spotlight_14day_cents: 99900,
    push_100mile_cents: 259900,
    push_tourwide_cents: 459900,
  },
  default_influencer_tiers: [
    { tier_index: 1, min_signups: 1, max_signups: 50, rate_cents: 3000, label: "Starter" },
    { tier_index: 2, min_signups: 51, max_signups: 200, rate_cents: 2500, label: "Growth" },
    { tier_index: 3, min_signups: 201, max_signups: 500, rate_cents: 2000, label: "Scale" },
    { tier_index: 4, min_signups: 501, max_signups: null, rate_cents: 1500, label: "Volume" },
  ],
  maintenance_enabled: false,
  maintenance_message: "We're currently performing scheduled maintenance. We'll be back shortly. Thank you for your patience!",
  change_history: [],
  scheduled_maintenance: null,
  maintenance_history: [],
  updated_at: null,
  updated_by: null,
};

const DEFAULT_EMAIL_TEMPLATES: EmailTemplate[] = [
  { id: "welcome", name: "Welcome Email", subject: "Welcome to LetsGo!", body: "Hi {{user_name}},\n\nWelcome to LetsGo! We're excited to have you.\n\nBest regards,\nThe LetsGo Team", active: true },
  { id: "receipt_approved", name: "Receipt Approved", subject: "Your receipt has been approved!", body: "Hi {{user_name}},\n\nGreat news! Your receipt from {{business_name}} for {{amount}} has been approved.\n\nBest regards,\nThe LetsGo Team", active: true },
  { id: "receipt_rejected", name: "Receipt Rejected", subject: "Update on your receipt submission", body: "Hi {{user_name}},\n\nUnfortunately, your receipt submission could not be verified. Please resubmit with a clearer photo.\n\nBest regards,\nThe LetsGo Team", active: true },
  { id: "payout_sent", name: "Payout Sent", subject: "Your payout is on its way!", body: "Hi {{user_name}},\n\nYour payout of {{amount}} has been sent via {{method}}.\n\nBest regards,\nThe LetsGo Team", active: true },
  { id: "business_approved", name: "Business Approved", subject: "Congratulations! Your business is live!", body: "Hi {{business_name}},\n\nYour business is now live on LetsGo!\n\nBest regards,\nThe LetsGo Team", active: true },
];

const ALL_PERMISSIONS = [
  { id: "all", label: "Full Access (All Permissions)", color: COLORS.neonGreen },
  { id: "view_receipts", label: "View Receipts" },
  { id: "approve_receipts", label: "Approve/Reject Receipts" },
  { id: "view_users", label: "View Users" },
  { id: "edit_users", label: "Edit Users" },
  { id: "view_businesses", label: "View Businesses" },
  { id: "edit_businesses", label: "Edit Businesses" },
  { id: "approve_payouts", label: "Approve Payouts" },
  { id: "manage_support", label: "Manage Support Tickets" },
  { id: "view_analytics", label: "View Analytics" },
  { id: "manage_advertising", label: "Manage Advertising" },
  { id: "manage_settings", label: "Manage Settings" },
];

// ==================== SETTINGS PAGE ====================
export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settingsSection, setSettingsSection] = useState("tiers");
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT_SETTINGS);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [currentStaffId, setCurrentStaffId] = useState("");

  // Staff management
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [newStaffEmail, setNewStaffEmail] = useState("");
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffRole, setNewStaffRole] = useState("staff");
  const [addingStaff, setAddingStaff] = useState(false);

  // Email templates (local state — needs email_templates table to wire)
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>(DEFAULT_EMAIL_TEMPLATES);
  const [showEmailTemplateModal, setShowEmailTemplateModal] = useState(false);
  const [editingEmailTemplate, setEditingEmailTemplate] = useState<EmailTemplate | null>(null);

  // Role permissions (persisted via settings.roles_config)
  const [showAddRoleModal, setShowAddRoleModal] = useState(false);

  // Track original settings for change detection
  const originalSettingsRef = useRef<PlatformSettings>(DEFAULT_SETTINGS);

  // Schedule maintenance local state
  const [schedDate, setSchedDate] = useState("");
  const [schedTime, setSchedTime] = useState("02:00");
  const [schedDuration, setSchedDuration] = useState("2");
  const [schedNotify, setSchedNotify] = useState(true);
  const [newRole, setNewRole] = useState<{ name: string; permissions: string[] }>({ name: "", permissions: [] });

  // Tag management state
  interface TagCategory { id: string; name: string; icon: string; scope: string[]; requires_food: boolean }
  interface TagItem { id: string; name: string; slug: string; color: string | null; icon: string | null; sort_order: number; is_food: boolean; category_id: string; category_name: string; category_icon: string }
  const [tagCategories, setTagCategories] = useState<TagCategory[]>([]);
  const [tagItems, setTagItems] = useState<TagItem[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [tagSearch, setTagSearch] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [newTagCategory, setNewTagCategory] = useState("");
  const [newTagColor, setNewTagColor] = useState("#39ff14");
  const [newTagIcon, setNewTagIcon] = useState("");
  const [newTagSortOrder, setNewTagSortOrder] = useState(0);
  const [newTagIsFood, setNewTagIsFood] = useState(false);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editTagName, setEditTagName] = useState("");
  const [editTagColor, setEditTagColor] = useState("");
  const [editTagCategory, setEditTagCategory] = useState("");
  const [editTagIcon, setEditTagIcon] = useState("");
  const [editTagSortOrder, setEditTagSortOrder] = useState(0);
  const [editTagIsFood, setEditTagIsFood] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("");
  const [newCatScope, setNewCatScope] = useState<string[]>(["business"]);
  const [newCatRequiresFood, setNewCatRequiresFood] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState("");
  const [editCatIcon, setEditCatIcon] = useState("");
  const [editCatScope, setEditCatScope] = useState<string[]>(["business"]);
  const [editCatRequiresFood, setEditCatRequiresFood] = useState(false);

  // Quotas tab state
  interface QuotaZone { id: string; name: string; goal: number; states: string[] }
  interface QuotaSalesConfig { id: string; category: string; key: string; value_cents: number | null; value_int: number | null }
  interface QuotaOverrideRow { id: string; target_type: string; target_id: string; quota: number; period: string }
  const [quotaZones, setQuotaZones] = useState<QuotaZone[]>([]);
  const [quotaSalesConfig, setQuotaSalesConfig] = useState<QuotaSalesConfig[]>([]);
  const [quotaOverrides, setQuotaOverrides] = useState<QuotaOverrideRow[]>([]);
  const [quotaEditing, setQuotaEditing] = useState(false);
  const [quotaSaving, setQuotaSaving] = useState(false);
  const [quotaZoneEdits, setQuotaZoneEdits] = useState<Record<string, number>>({});
  const [quotaConfigEdits, setQuotaConfigEdits] = useState<Record<string, number>>({});
  const [quotaRateEdits, setQuotaRateEdits] = useState<Record<string, number>>({});
  const [quotaRepNames, setQuotaRepNames] = useState<Record<string, string>>({});
  const [quotaZoneNames, setQuotaZoneNames] = useState<Record<string, string>>({});

  const fetchQuotaData = useCallback(async () => {
    const [zonesRes, configRes, overridesRes, repsRes] = await Promise.all([
      supabaseBrowser.from("sales_zones").select("id, name, goal, states").order("name"),
      supabaseBrowser.from("sales_config").select("*"),
      supabaseBrowser.from("sales_quota_overrides").select("*").order("period", { ascending: false }),
      supabaseBrowser.from("sales_reps").select("id, name"),
    ]);
    if (zonesRes.data) setQuotaZones(zonesRes.data);
    if (configRes.data) setQuotaSalesConfig(configRes.data);
    if (overridesRes.data) setQuotaOverrides(overridesRes.data);
    // Build name lookups for overrides table
    const rn: Record<string, string> = {};
    if (repsRes.data) repsRes.data.forEach((r: { id: string; name: string }) => { rn[r.id] = r.name; });
    setQuotaRepNames(rn);
    const zn: Record<string, string> = {};
    if (zonesRes.data) zonesRes.data.forEach((z: QuotaZone) => { zn[z.id] = z.name; });
    setQuotaZoneNames(zn);
  }, []);

  const getQuotaConfig = useCallback((key: string, type: "cents" | "int" = "cents"): number => {
    const c = quotaSalesConfig.find(cfg => cfg.key === key);
    const defaults: Record<string, number> = { basic_signup: 2500, premium_signup: 10000, advertising_per_100: 1000, individual_monthly: 60, bonus_eligibility: 30, team_monthly: 300, individual_daily: 200, team_daily: 1000, bonus_eligibility_daily: 100, rep_quota_daily: 200, rep_bonus_daily: 100, lead_quota_daily: 200, lead_bonus_daily: 100, training_quota_daily: 100, training_bonus_daily: 50 };
    if (!c) return defaults[key] || 0;
    return type === "cents" ? (c.value_cents || 0) : (c.value_int || 0);
  }, [quotaSalesConfig]);

  const handleSaveQuotas = useCallback(async () => {
    setQuotaSaving(true);
    try {
      // Save zone goals
      for (const [zoneId, goal] of Object.entries(quotaZoneEdits)) {
        await supabaseBrowser.from("sales_zones").update({ goal }).eq("id", zoneId);
      }
      // Save config (daily quotas stored as hundredths in value_cents, others as value_int)
      const dailyKeys = ["individual_daily", "team_daily", "bonus_eligibility_daily", "rep_quota_daily", "rep_bonus_daily", "lead_quota_daily", "lead_bonus_daily", "training_quota_daily", "training_bonus_daily"];
      for (const [key, value] of Object.entries(quotaConfigEdits)) {
        const existing = quotaSalesConfig.find(c => c.key === key);
        const isDaily = dailyKeys.includes(key);
        const updateData = isDaily ? { value_cents: value, value_int: null } : { value_int: value, value_cents: null };
        if (existing) {
          await supabaseBrowser.from("sales_config").update(updateData).eq("id", existing.id);
        } else {
          await supabaseBrowser.from("sales_config").insert({ category: "quota", key, ...updateData });
        }
      }
      // Save config cents (rates)
      for (const [key, value] of Object.entries(quotaRateEdits)) {
        const existing = quotaSalesConfig.find(c => c.key === key);
        if (existing) {
          await supabaseBrowser.from("sales_config").update({ value_cents: value }).eq("id", existing.id);
        } else {
          await supabaseBrowser.from("sales_config").insert({ category: "commission", key, value_cents: value, value_int: null });
        }
      }
      await logAudit({ tab: AUDIT_TABS.SETTINGS, targetType: "quota", action: "Updated quota settings", details: JSON.stringify({ zones: quotaZoneEdits, quotas: quotaConfigEdits, rates: quotaRateEdits }), staffId: currentStaffId });
      setQuotaEditing(false);
      setQuotaZoneEdits({});
      setQuotaConfigEdits({});
      setQuotaRateEdits({});
      await fetchQuotaData();
    } catch (e) {
      alert("Error saving quotas: " + (e instanceof Error ? e.message : "Unknown error"));
    } finally {
      setQuotaSaving(false);
    }
  }, [quotaZoneEdits, quotaConfigEdits, quotaRateEdits, quotaSalesConfig, currentStaffId, fetchQuotaData]);

  const handleDeleteOverride = useCallback(async (id: string) => {
    if (!confirm("Delete this quota override?")) return;
    await supabaseBrowser.from("sales_quota_overrides").delete().eq("id", id);
    await logAudit({ tab: AUDIT_TABS.SETTINGS, targetType: "quota_override", action: "Deleted quota override", details: id, staffId: currentStaffId });
    await fetchQuotaData();
  }, [currentStaffId, fetchQuotaData]);

  // ==================== DATA FETCHING ====================
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabaseBrowser.auth.getUser();
      if (user) setCurrentStaffId(user.id);

      const { data: settingsData } = await supabaseBrowser
        .from("platform_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();

      if (settingsData) {
        const merged = { ...DEFAULT_SETTINGS, ...settingsData };
        setSettings(merged);
        originalSettingsRef.current = merged;
        // Seed schedule inputs from existing data
        if (merged.scheduled_maintenance) {
          setSchedDate(merged.scheduled_maintenance.date || "");
          setSchedTime(merged.scheduled_maintenance.time || "02:00");
          setSchedDuration(String(merged.scheduled_maintenance.duration_hours || 2));
          setSchedNotify(merged.scheduled_maintenance.notify_advance ?? true);
        }
      }

      // Fetch staff via server API to bypass RLS on staff_users
      const { data: { session: stSess } } = await supabaseBrowser.auth.getSession();
      const staffRes = await fetch("/api/admin/staff", {
        headers: { Authorization: `Bearer ${stSess?.access_token || ""}` },
      });
      if (staffRes.ok) {
        const { staff } = await staffRes.json();
        if (staff) setStaffUsers(staff);
      }
    } catch (err) {
      console.error("Error loading settings:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); fetchQuotaData(); }, [fetchData, fetchQuotaData]);

  // ==================== TAG MANAGEMENT ====================
  const fetchTags = useCallback(async () => {
    setTagsLoading(true);
    try {
      const { data: cats } = await supabaseBrowser.from("tag_categories").select("id, name, icon, scope, requires_food").order("name");
      setTagCategories((cats ?? []).map((c: Record<string, unknown>) => ({
        id: c.id as string,
        name: c.name as string,
        icon: (c.icon as string) ?? "🏷️",
        scope: (c.scope as string[]) ?? ["business"],
        requires_food: (c.requires_food as boolean) ?? false,
      })));
      if (cats && cats.length > 0 && !newTagCategory) setNewTagCategory((cats[0] as { id: string }).id);

      const { data: tags } = await supabaseBrowser
        .from("tags")
        .select("id, name, slug, color, icon, sort_order, is_food, category_id, tag_categories ( name, icon )")
        .order("sort_order")
        .order("name");
      const mapped = (tags ?? []).map((t: Record<string, unknown>) => {
        const cat = t.tag_categories as { name: string; icon: string } | null;
        return {
          id: t.id as string,
          name: t.name as string,
          slug: t.slug as string,
          color: t.color as string | null,
          icon: t.icon as string | null,
          sort_order: (t.sort_order as number) ?? 0,
          is_food: (t.is_food as boolean) ?? false,
          category_id: t.category_id as string,
          category_name: cat?.name ?? "Uncategorized",
          category_icon: cat?.icon ?? "",
        };
      });
      setTagItems(mapped);
    } catch (err) {
      console.error("Error loading tags:", err);
    } finally {
      setTagsLoading(false);
    }
  }, [newTagCategory]);

  useEffect(() => { if (settingsSection === "tags") fetchTags(); }, [settingsSection, fetchTags]);

  const addTag = async () => {
    const trimmed = newTagName.trim().toLowerCase();
    if (!trimmed || !newTagCategory) return;
    const slug = trimmed.replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const { error } = await supabaseBrowser.from("tags").insert({
      name: trimmed, slug, color: newTagColor, category_id: newTagCategory,
      icon: newTagIcon || null, sort_order: newTagSortOrder, is_food: newTagIsFood,
    });
    if (error) { alert(error.message); return; }
    logAudit({ action: "add_tag", tab: AUDIT_TABS.SETTINGS, subTab: "Tag Management", targetType: "tag", entityName: trimmed, details: `Added tag "${trimmed}"` });
    setNewTagName(""); setNewTagIcon(""); setNewTagSortOrder(0); setNewTagIsFood(false);
    fetchTags();
  };

  const updateTag = async (id: string) => {
    const trimmed = editTagName.trim().toLowerCase();
    if (!trimmed) return;
    const slug = trimmed.replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const { error } = await supabaseBrowser.from("tags").update({
      name: trimmed, slug, color: editTagColor, category_id: editTagCategory,
      icon: editTagIcon || null, sort_order: editTagSortOrder, is_food: editTagIsFood,
    }).eq("id", id);
    if (error) { alert(error.message); return; }
    logAudit({ action: "update_tag", tab: AUDIT_TABS.SETTINGS, subTab: "Tag Management", targetType: "tag", targetId: id, entityName: trimmed, details: `Updated tag "${trimmed}"` });
    setEditingTagId(null);
    fetchTags();
  };

  const deleteTag = async (id: string, name: string) => {
    if (!confirm(`Delete tag "${name}"? This will remove it from the available tags list.`)) return;
    const { error } = await supabaseBrowser.from("tags").delete().eq("id", id);
    if (error) { alert(error.message); return; }
    logAudit({ action: "delete_tag", tab: AUDIT_TABS.SETTINGS, subTab: "Tag Management", targetType: "tag", targetId: id, entityName: name, details: `Deleted tag "${name}"` });
    fetchTags();
  };

  const addCategory = async () => {
    const trimmed = newCatName.trim();
    if (!trimmed) return;
    const { error } = await supabaseBrowser.from("tag_categories").insert({ name: trimmed, icon: newCatIcon || "🏷️", scope: newCatScope, requires_food: newCatRequiresFood });
    if (error) { alert(error.message); return; }
    logAudit({ action: "add_tag_category", tab: AUDIT_TABS.SETTINGS, subTab: "Tag Management", targetType: "tag_category", entityName: trimmed, details: `Added category "${trimmed}"` });
    setNewCatName(""); setNewCatIcon(""); setNewCatScope(["business"]); setNewCatRequiresFood(false);
    fetchTags();
  };

  const updateCategory = async (id: string) => {
    const trimmed = editCatName.trim();
    if (!trimmed) return;
    const { error } = await supabaseBrowser.from("tag_categories").update({ name: trimmed, icon: editCatIcon, scope: editCatScope, requires_food: editCatRequiresFood }).eq("id", id);
    if (error) { alert(error.message); return; }
    logAudit({ action: "update_tag_category", tab: AUDIT_TABS.SETTINGS, subTab: "Tag Management", targetType: "tag_category", targetId: id, entityName: trimmed, details: `Updated category "${trimmed}"` });
    setEditingCatId(null);
    fetchTags();
  };

  const deleteCategory = async (id: string, name: string) => {
    const tagsInCat = tagItems.filter(t => t.category_id === id);
    if (tagsInCat.length > 0) {
      alert(`Cannot delete "${name}" — it has ${tagsInCat.length} tag(s). Move or delete them first.`);
      return;
    }
    if (!confirm(`Delete category "${name}"?`)) return;
    const { error } = await supabaseBrowser.from("tag_categories").delete().eq("id", id);
    if (error) { alert(error.message); return; }
    logAudit({ action: "delete_tag_category", tab: AUDIT_TABS.SETTINGS, subTab: "Tag Management", targetType: "tag_category", targetId: id, entityName: name, details: `Deleted category "${name}"` });
    fetchTags();
  };

  // ==================== CHANGE DETECTION ====================
  const detectFeeChanges = (): string[] => {
    const orig = originalSettingsRef.current;
    const changes: string[] = [];
    const feeFields: { key: keyof PlatformSettings; label: string; format: (v: number) => string }[] = [
      { key: "platform_fee_bps", label: "Platform Fee", format: v => bpsToPercent(v) + "%" },
      { key: "platform_fee_cap_cents", label: "Fee Cap", format: v => formatCents(v) },
      { key: "cc_processing_fee_bps", label: "CC Processing Fee", format: v => bpsToPercent(v) + "%" },
      { key: "min_payout_cents", label: "Min Payout", format: v => formatCents(v) },
      { key: "payout_processing_days", label: "Payout Hold", format: v => v + " days" },
      { key: "max_receipt_age_days", label: "Max Receipt Age", format: v => v + " days" },
    ];
    for (const f of feeFields) {
      const oldVal = orig[f.key] as number;
      const newVal = settings[f.key] as number;
      if (oldVal !== newVal) {
        changes.push(`${f.label}: ${f.format(oldVal)} → ${f.format(newVal)}`);
      }
    }
    // Detect package pricing changes
    const pkgFields: { key: keyof PackagePricing; label: string }[] = [
      { key: "basic_monthly_cents", label: "Basic Plan" },
      { key: "premium_monthly_cents", label: "Premium Plan" },
      { key: "addon_video_5_monthly_cents", label: "Add-on: 5 Videos/Day" },
      { key: "addon_live_15_monthly_cents", label: "Add-on: Live 15" },
      { key: "addon_live_30_monthly_cents", label: "Add-on: Live 30" },
      { key: "tpms_monthly_cents", label: "TPMS Service" },
    ];
    for (const f of pkgFields) {
      const oldVal = orig.package_pricing[f.key];
      const newVal = settings.package_pricing[f.key];
      if (oldVal !== newVal) {
        changes.push(`${f.label}: ${formatCents(oldVal)} → ${formatCents(newVal)}/mo`);
      }
    }
    // Detect ad pricing changes
    const adFields: { key: keyof AdPricing; label: string }[] = [
      { key: "spotlight_1day_cents", label: "1-Day Spotlight" },
      { key: "spotlight_7day_cents", label: "7-Day Spotlight" },
      { key: "spotlight_14day_cents", label: "14-Day Spotlight" },
      { key: "push_100mile_cents", label: "100 Mile Push" },
      { key: "push_tourwide_cents", label: "Tour Wide Push" },
    ];
    for (const f of adFields) {
      const oldVal = orig.ad_pricing[f.key];
      const newVal = settings.ad_pricing[f.key];
      if (oldVal !== newVal) {
        changes.push(`${f.label}: ${formatCents(oldVal)} → ${formatCents(newVal)}`);
      }
    }
    return changes;
  };

  // ==================== SAVE SETTINGS ====================
  const saveSettings = async () => {
    setSaving(true);
    try {
      // Detect fee changes and append to history
      const feeChanges = detectFeeChanges();
      let updatedHistory = [...(settings.change_history || [])];
      if (feeChanges.length > 0) {
        updatedHistory = [
          { date: new Date().toISOString(), changed_by: currentStaffId || "unknown", changes: feeChanges.join("; ") },
          ...updatedHistory,
        ].slice(0, 50); // Keep last 50 entries
      }

      const payload = {
        visit_thresholds: settings.visit_thresholds,
        default_cashback_bps: settings.default_cashback_bps,
        preset_conservative_bps: settings.preset_conservative_bps,
        preset_standard_bps: settings.preset_standard_bps,
        preset_aggressive_bps: settings.preset_aggressive_bps,
        trial_duration_days: settings.trial_duration_days,
        trial_cashback_bps: settings.trial_cashback_bps,
        platform_fee_bps: settings.platform_fee_bps,
        platform_fee_cap_cents: settings.platform_fee_cap_cents,
        cc_processing_fee_bps: settings.cc_processing_fee_bps,
        max_receipt_age_days: settings.max_receipt_age_days,
        min_receipt_cents: settings.min_receipt_cents,
        max_receipt_cents: settings.max_receipt_cents,
        rolling_window_days: settings.rolling_window_days,
        min_payout_cents: settings.min_payout_cents,
        payout_processing_days: settings.payout_processing_days,
        payout_methods: settings.payout_methods,
        package_pricing: settings.package_pricing,
        ad_pricing: settings.ad_pricing,
        roles_config: settings.roles_config,
        default_influencer_tiers: settings.default_influencer_tiers,
        maintenance_enabled: settings.maintenance_enabled,
        maintenance_message: settings.maintenance_message,
        change_history: updatedHistory,
        scheduled_maintenance: settings.scheduled_maintenance,
        maintenance_history: settings.maintenance_history,
        updated_at: new Date().toISOString(),
        updated_by: currentStaffId || null,
      };

      const { error } = await supabaseBrowser
        .from("platform_settings")
        .upsert({ id: 1, ...payload });
      if (error) throw error;

      logAudit({ action: "save_settings", tab: AUDIT_TABS.SETTINGS, subTab: "Platform Settings", targetType: "platform_settings", targetId: "1", entityName: "Platform Settings", details: feeChanges.length > 0 ? `Changes: ${feeChanges.join("; ")}` : "Settings saved (no fee changes)" });

      // Update local state with saved history and update original ref
      const saved = { ...settings, change_history: updatedHistory, updated_at: payload.updated_at, updated_by: payload.updated_by };
      setSettings(saved);
      originalSettingsRef.current = saved;
      setEditing(false);
    } catch (err) {
      console.error("Error saving settings:", err);
      alert("Error saving settings. Check console for details.");
    } finally {
      setSaving(false);
    }
  };

  // ==================== STAFF ACTIONS ====================
  const addStaffUser = async () => {
    if (!newStaffEmail) return;
    setAddingStaff(true);
    try {
      // Server-side handles: email lookup (auth.users), duplicate check, insert
      const { data: { session: addSess } } = await supabaseBrowser.auth.getSession();
      const res = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${addSess?.access_token || ""}` },
        body: JSON.stringify({
          email: newStaffEmail,
          name: newStaffName,
          role: newStaffRole,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Failed to add staff member.");
        setAddingStaff(false);
        return;
      }

      setShowAddStaff(false);
      setNewStaffEmail("");
      setNewStaffName("");
      setNewStaffRole("admin");
      fetchData();
      logAudit({ action: "add_staff", tab: AUDIT_TABS.SETTINGS, subTab: "Staff Management", targetType: "staff_user", entityName: newStaffName || newStaffEmail, fieldName: "staff_user", newValue: `${newStaffEmail} (${newStaffRole})`, details: `Email: ${newStaffEmail}, Role: ${newStaffRole}` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Error adding staff:", msg, err);
      alert(`Error adding staff member: ${msg}`);
    } finally {
      setAddingStaff(false);
    }
  };

  const removeStaff = async (userId: string) => {
    if (userId === currentStaffId) {
      alert("You cannot remove yourself.");
      return;
    }
    if (!confirm("Remove this staff member? They will lose admin access.")) return;
    try {
      const { data: { session: delSess } } = await supabaseBrowser.auth.getSession();
      const res = await fetch("/api/admin/staff", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${delSess?.access_token || ""}` },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to remove staff member");
      }
      fetchData();
      const removedMember = staffUsers.find(s => s.user_id === userId);
      logAudit({ action: "remove_staff", tab: AUDIT_TABS.SETTINGS, subTab: "Staff Management", targetType: "staff_user", targetId: userId, fieldName: "staff_user", oldValue: removedMember?.name || userId, newValue: "removed", details: `Staff member "${removedMember?.name || userId}" (role: ${removedMember?.role || "unknown"}) removed` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Error removing staff:", msg, err);
      alert(`Error removing staff member: ${msg}`);
    }
  };

  // ==================== HELPERS ====================
  const bpsToPercent = (bps: number) => (bps / 100).toFixed(1);
  const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const applyPreset = (preset: number[]) => {
    setSettings({ ...settings, default_cashback_bps: [...preset] });
  };

  const updateThreshold = (idx: number, field: "min" | "max", val: number | null) => {
    const newThresholds = [...settings.visit_thresholds];
    newThresholds[idx] = { ...newThresholds[idx], [field]: val };
    setSettings({ ...settings, visit_thresholds: newThresholds });
  };

  const updateCashback = (idx: number, val: number) => {
    const newBps = [...settings.default_cashback_bps];
    newBps[idx] = val;
    setSettings({ ...settings, default_cashback_bps: newBps });
  };

  // ==================== RENDER ====================
  if (loading) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.textSecondary }}>
        Loading settings...
      </div>
    );
  }

  return (
    <div style={{ flex: 1, padding: 32, overflowY: "auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, background: COLORS.gradient1, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Settings
        </h1>
        <button
          onClick={() => editing ? saveSettings() : setEditing(true)}
          disabled={saving}
          style={{
            padding: "10px 20px",
            background: editing ? COLORS.neonGreen : COLORS.gradient1,
            border: "none", borderRadius: 10,
            color: editing ? "#000" : "#fff",
            cursor: "pointer", fontWeight: 700, fontSize: 14,
            opacity: saving ? 0.5 : 1,
          }}
        >
          {saving ? "Saving..." : editing ? "Save Changes" : "Edit Settings"}
        </button>
      </div>

      {/* Horizontal Tab Navigation */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {[
          { key: "tiers", label: "Payout Tiers" },
          { key: "fees", label: "Platform Fees" },
          { key: "pricing", label: "Pricing" },
          { key: "emails", label: "Email Templates" },
          { key: "roles", label: "Staff Roles" },
          { key: "security", label: "Security" },
          { key: "tags", label: "Tag Management" },
          { key: "quotas", label: "Quotas" },
          { key: "influencer_tiers", label: "Influencer Tiers" },
          { key: "maintenance", label: "Maintenance" },
        ].map(section => (
          <button
            key={section.key}
            onClick={() => setSettingsSection(section.key)}
            style={{
              padding: "10px 20px", borderRadius: 10, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 600,
              background: settingsSection === section.key ? COLORS.gradient1 : COLORS.cardBg,
              color: settingsSection === section.key ? "#fff" : COLORS.textSecondary,
            }}
          >
            {section.label}
          </button>
        ))}
      </div>

      {/* ==================== PAYOUT TIERS ==================== */}
      {settingsSection === "tiers" && (
        <div style={{ display: "grid", gap: 24 }}>
          {/* Visit Level Thresholds */}
          <Card title="VISIT LEVEL THRESHOLDS">
            <div style={{ marginBottom: 16, color: COLORS.textSecondary, fontSize: 13 }}>
              Define the number of visits required to reach each level. This structure is used by the app to calculate user progression.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 12 }}>
              {settings.visit_thresholds.map((t, i) => (
                <div key={i} style={{ padding: 16, background: COLORS.darkBg, borderRadius: 12, textAlign: "center" }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: "50%",
                    background: COLORS.gradient1,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 700, fontSize: 14, margin: "0 auto 12px",
                  }}>
                    L{t.level}
                  </div>
                  <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 8 }}>Visits Required</div>
                  {editing ? (
                    <div style={{ display: "flex", gap: 4, justifyContent: "center", alignItems: "center" }}>
                      <input
                        type="number"
                        value={t.min}
                        onChange={e => updateThreshold(i, "min", parseInt(e.target.value) || 0)}
                        style={{ width: 40, padding: 6, background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 4, color: COLORS.textPrimary, fontSize: 12, textAlign: "center" }}
                      />
                      <span style={{ color: COLORS.textSecondary, fontSize: 10 }}>-</span>
                      <input
                        type="number"
                        value={t.max ?? ""}
                        onChange={e => updateThreshold(i, "max", e.target.value ? parseInt(e.target.value) : null)}
                        placeholder="&#8734;"
                        style={{ width: 40, padding: 6, background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 4, color: COLORS.textPrimary, fontSize: 12, textAlign: "center" }}
                      />
                    </div>
                  ) : (
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{t.min} – {t.max ?? "∞"}</div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* Standard Cashback Rates */}
          <Card title="STANDARD CASHBACK RATES">
            <div style={{ marginBottom: 16, color: COLORS.textSecondary, fontSize: 13 }}>
              Configure the default cashback percentages businesses pay to users at each level. Individual businesses can have custom overrides.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 12 }}>
              {settings.default_cashback_bps.map((bps, i) => (
                <div key={i} style={{
                  padding: 16, background: COLORS.darkBg, borderRadius: 12, textAlign: "center",
                  border: "2px solid " + COLORS.neonGreen + "33",
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: "50%",
                    background: "rgba(57,255,20,0.2)", border: "2px solid " + COLORS.neonGreen,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 700, fontSize: 14, margin: "0 auto 12px", color: COLORS.neonGreen,
                  }}>
                    L{i + 1}
                  </div>
                  <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 8 }}>Cashback %</div>
                  {editing ? (
                    <input
                      type="number"
                      value={bps}
                      onChange={e => updateCashback(i, parseInt(e.target.value) || 0)}
                      style={{ width: 60, padding: 8, background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 6, color: COLORS.neonGreen, fontSize: 18, fontWeight: 700, textAlign: "center" }}
                    />
                  ) : (
                    <div style={{ fontWeight: 700, fontSize: 24, color: COLORS.neonGreen }}>{bpsToPercent(bps)}%</div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* Quick Tier Presets */}
          <Card title="QUICK TIER PRESETS (Management Only)">
            <div style={{ marginBottom: 16, color: COLORS.textSecondary, fontSize: 13 }}>
              Pre-configured payout structures for different business needs. Applying a preset will overwrite current Standard Cashback Rates.{" "}
              <strong style={{ color: COLORS.neonOrange }}>Only managers can edit these presets.</strong>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              {[
                { key: "conservative" as const, name: "Conservative", desc: "Lower payouts, better margins", bps: settings.preset_conservative_bps, color: COLORS.neonBlue },
                { key: "standard" as const, name: "Standard", desc: "Balanced for most businesses", bps: settings.preset_standard_bps, color: COLORS.neonGreen },
                { key: "aggressive" as const, name: "Aggressive", desc: "Higher payouts, more users", bps: settings.preset_aggressive_bps, color: COLORS.neonPink },
              ].map(preset => (
                <div key={preset.key} style={{ padding: 20, background: COLORS.darkBg, borderRadius: 12, border: "2px solid " + preset.color + "44" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: preset.color }}>{preset.name}</div>
                  </div>
                  <div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 12 }}>{preset.desc}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 12 }}>
                    {preset.bps.map((b, i) => (
                      <div key={i} style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 9, color: COLORS.textSecondary }}>L{i + 1}</div>
                        {editing ? (
                          <input
                            type="number"
                            value={b}
                            onChange={e => {
                              const settingsKey = `preset_${preset.key}_bps` as "preset_conservative_bps" | "preset_standard_bps" | "preset_aggressive_bps";
                              const updated = [...settings[settingsKey]];
                              updated[i] = parseInt(e.target.value) || 0;
                              setSettings({ ...settings, [settingsKey]: updated });
                            }}
                            style={{ width: "100%", padding: 4, background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 4, color: preset.color, fontSize: 12, fontWeight: 600, textAlign: "center" }}
                          />
                        ) : (
                          <div style={{ fontSize: 13, fontWeight: 600, color: preset.color }}>{bpsToPercent(b)}%</div>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => { if (editing) applyPreset(preset.bps); }}
                    style={{
                      width: "100%", padding: 10,
                      background: editing ? preset.color + "22" : COLORS.cardBg,
                      border: "1px solid " + preset.color,
                      borderRadius: 8, color: preset.color, cursor: editing ? "pointer" : "default",
                      fontWeight: 600, fontSize: 12, opacity: editing ? 1 : 0.5,
                    }}
                  >
                    Apply to Standard Rates
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ==================== PLATFORM FEES ==================== */}
      {settingsSection === "fees" && (
        <div style={{ display: "grid", gap: 24 }}>
          {/* LetsGo Fee Main Card */}
          <Card title="LETSGO FEE (Business Transaction Fee)">
            <div style={{ padding: 16, background: "rgba(0,212,255,0.1)", borderRadius: 12, marginBottom: 20, border: "1px solid " + COLORS.neonBlue }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <span style={{ fontSize: 24 }}>💡</span>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4, color: COLORS.neonBlue }}>How the LetsGo Fee Works</div>
                  <div style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.5 }}>
                    The LetsGo Fee is charged to businesses on each approved receipt. It&apos;s calculated as a <strong>percentage of the receipt subtotal</strong> with
                    a <strong>maximum cap</strong>. For example: 10% fee with $5 max means a $30 receipt = $3 fee, but a $75 receipt = $5 fee (capped).
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
              <div style={{ padding: 24, background: COLORS.darkBg, borderRadius: 12, border: "2px solid " + COLORS.neonBlue + "44" }}>
                <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase" }}>LetsGo Fee Percentage</div>
                {editing ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="number"
                      value={settings.platform_fee_bps}
                      onChange={e => setSettings({ ...settings, platform_fee_bps: parseInt(e.target.value) || 0 })}
                      style={{ width: 100, padding: 12, background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.neonBlue, fontSize: 28, fontWeight: 700, textAlign: "center" }}
                    />
                    <span style={{ fontSize: 14, color: COLORS.textSecondary }}>BPS</span>
                  </div>
                ) : (
                  <div style={{ fontSize: 40, fontWeight: 700, color: COLORS.neonBlue }}>{bpsToPercent(settings.platform_fee_bps)}%</div>
                )}
                <div style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 8 }}>Of each receipt subtotal</div>
              </div>
              <div style={{ padding: 24, background: COLORS.darkBg, borderRadius: 12, border: "2px solid " + COLORS.neonGreen + "44" }}>
                <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase" }}>Maximum Fee Cap</div>
                {editing ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 24, color: COLORS.neonGreen, fontWeight: 700 }}>$</span>
                    <input
                      type="number"
                      value={settings.platform_fee_cap_cents}
                      onChange={e => setSettings({ ...settings, platform_fee_cap_cents: parseInt(e.target.value) || 0 })}
                      style={{ width: 100, padding: 12, background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.neonGreen, fontSize: 28, fontWeight: 700, textAlign: "center" }}
                    />
                    <span style={{ fontSize: 14, color: COLORS.textSecondary }}>cents</span>
                  </div>
                ) : (
                  <div style={{ fontSize: 40, fontWeight: 700, color: COLORS.neonGreen }}>{formatCents(settings.platform_fee_cap_cents)}</div>
                )}
                <div style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 8 }}>Max per transaction</div>
              </div>
            </div>

            {/* Example Calculations */}
            <div style={{ background: COLORS.darkBg, borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 12, fontWeight: 600 }}>EXAMPLE CALCULATIONS</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                {[
                  { receipt: 2000 },
                  { receipt: 5000 },
                  { receipt: 10000 },
                  { receipt: 20000 },
                ].map((ex, idx) => {
                  const fee = Math.min(Math.floor(ex.receipt * settings.platform_fee_bps / 10000), settings.platform_fee_cap_cents);
                  const capped = fee === settings.platform_fee_cap_cents;
                  return (
                    <div key={idx} style={{ padding: 12, background: COLORS.cardBg, borderRadius: 8, textAlign: "center" }}>
                      <div style={{ fontSize: 11, color: COLORS.textSecondary }}>Receipt: {formatCents(ex.receipt)}</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: capped ? COLORS.neonGreen : COLORS.neonBlue }}>{formatCents(fee)} fee</div>
                      <div style={{ fontSize: 10, color: COLORS.textSecondary }}>{capped ? "(capped)" : `(${bpsToPercent(settings.platform_fee_bps)}%)`}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* Other Platform Settings */}
          <Card title="OTHER PLATFORM SETTINGS">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              <div style={{ padding: 20, background: COLORS.darkBg, borderRadius: 12 }}>
                <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase" }}>CC Processing Fee</div>
                {editing ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <input
                      type="number"
                      value={settings.cc_processing_fee_bps}
                      onChange={e => setSettings({ ...settings, cc_processing_fee_bps: parseInt(e.target.value) || 0 })}
                      style={{ width: 80, padding: 12, background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, fontSize: 18, fontWeight: 700 }}
                    />
                    <span style={{ fontSize: 14, color: COLORS.textSecondary }}>BPS</span>
                  </div>
                ) : (
                  <div style={{ fontSize: 28, fontWeight: 700 }}>{bpsToPercent(settings.cc_processing_fee_bps)}%</div>
                )}
                <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 4 }}>Charged to businesses</div>
              </div>
              <div style={{ padding: 20, background: COLORS.darkBg, borderRadius: 12 }}>
                <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase" }}>Min Payout Amount</div>
                {editing ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 18, fontWeight: 700 }}>$</span>
                    <input
                      type="number"
                      value={settings.min_payout_cents}
                      onChange={e => setSettings({ ...settings, min_payout_cents: parseInt(e.target.value) || 0 })}
                      style={{ width: 80, padding: 12, background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, fontSize: 18, fontWeight: 700 }}
                    />
                    <span style={{ fontSize: 14, color: COLORS.textSecondary }}>cents</span>
                  </div>
                ) : (
                  <div style={{ fontSize: 28, fontWeight: 700 }}>{formatCents(settings.min_payout_cents)}</div>
                )}
                <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 4 }}>To request withdrawal</div>
              </div>
              <div style={{ padding: 20, background: COLORS.darkBg, borderRadius: 12 }}>
                <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase" }}>Payout Hold Period</div>
                {editing ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <input
                      type="number"
                      value={settings.payout_processing_days}
                      onChange={e => setSettings({ ...settings, payout_processing_days: parseInt(e.target.value) || 0 })}
                      style={{ width: 80, padding: 12, background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, fontSize: 18, fontWeight: 700 }}
                    />
                    <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.textSecondary }}>days</span>
                  </div>
                ) : (
                  <div style={{ fontSize: 28, fontWeight: 700 }}>{settings.payout_processing_days} <span style={{ fontSize: 14, color: COLORS.textSecondary }}>days</span></div>
                )}
                <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 4 }}>Before funds available</div>
              </div>
              <div style={{ padding: 20, background: COLORS.darkBg, borderRadius: 12 }}>
                <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase" }}>Max Receipt Age</div>
                {editing ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <input
                      type="number"
                      value={settings.max_receipt_age_days}
                      onChange={e => setSettings({ ...settings, max_receipt_age_days: parseInt(e.target.value) || 0 })}
                      style={{ width: 80, padding: 12, background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, fontSize: 18, fontWeight: 700 }}
                    />
                    <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.textSecondary }}>days</span>
                  </div>
                ) : (
                  <div style={{ fontSize: 28, fontWeight: 700 }}>{settings.max_receipt_age_days} <span style={{ fontSize: 14, color: COLORS.textSecondary }}>days</span></div>
                )}
                <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 4 }}>Receipt submission window</div>
              </div>
            </div>

            {/* Recent Fee Changes */}
            <div style={{ marginTop: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Recent Fee Changes</div>
              <div style={{ background: COLORS.darkBg, borderRadius: 10, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "140px 1fr 140px", gap: 8, padding: "10px 14px", background: COLORS.cardBg, fontSize: 10, color: COLORS.textSecondary, fontWeight: 600, textTransform: "uppercase" }}>
                  <div>Date</div>
                  <div>Changes</div>
                  <div>Changed By</div>
                </div>
                {settings.change_history && settings.change_history.length > 0 ? (
                  settings.change_history.slice(0, 10).map((entry, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "140px 1fr 140px", gap: 8, padding: "12px 14px", borderTop: "1px solid " + COLORS.cardBorder, fontSize: 12 }}>
                      <div>{new Date(entry.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
                      <div style={{ color: COLORS.neonYellow }}>{entry.changes}</div>
                      <div style={{ color: COLORS.neonBlue }}>
                        {entry.changed_by ? `Staff #${entry.changed_by.slice(-6).toUpperCase()}` : "System"}
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: "16px 14px", fontSize: 12, color: COLORS.textSecondary, textAlign: "center" }}>
                    No fee changes recorded yet. Changes are automatically tracked when you modify fee settings.
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ==================== PRICING ==================== */}
      {settingsSection === "pricing" && (
        <div style={{ display: "grid", gap: 24 }}>
          {/* Package Plans */}
          <Card title="PACKAGE PLANS">
            <div style={{ padding: 16, background: "rgba(0,212,255,0.1)", borderRadius: 12, marginBottom: 20, border: "1px solid " + COLORS.neonBlue }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <span style={{ fontSize: 24 }}>💡</span>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4, color: COLORS.neonBlue }}>Centralized Pricing</div>
                  <div style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.5 }}>
                    These prices are the source of truth for partner onboarding and the business dashboard. Changing them here will affect
                    all new signups and billing displays. Existing subscriptions are not retroactively changed.
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
              {/* Basic Plan */}
              <div style={{ padding: 24, background: COLORS.darkBg, borderRadius: 12, border: "2px solid " + COLORS.cardBorder }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>Basic Plan</div>
                  <span style={{ padding: "4px 10px", background: "rgba(160,160,176,0.2)", borderRadius: 6, fontSize: 10, color: COLORS.textSecondary, fontWeight: 600 }}>PAY-AS-YOU-GO</span>
                </div>
                <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase" }}>Monthly Fee</div>
                {editing ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 24, fontWeight: 700 }}>$</span>
                    <input
                      type="number"
                      value={settings.package_pricing.basic_monthly_cents}
                      onChange={e => setSettings({ ...settings, package_pricing: { ...settings.package_pricing, basic_monthly_cents: parseInt(e.target.value) || 0 } })}
                      style={{ width: 100, padding: 12, background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, fontSize: 28, fontWeight: 700, textAlign: "center" }}
                    />
                    <span style={{ fontSize: 14, color: COLORS.textSecondary }}>cents/mo</span>
                  </div>
                ) : (
                  <div style={{ fontSize: 40, fontWeight: 700 }}>{formatCents(settings.package_pricing.basic_monthly_cents)}<span style={{ fontSize: 16, color: COLORS.textSecondary }}>/mo</span></div>
                )}
                <div style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 8 }}>
                  + {bpsToPercent(settings.platform_fee_bps)}% per receipt (max {formatCents(settings.platform_fee_cap_cents)})
                </div>
              </div>

              {/* Premium Plan */}
              <div style={{ padding: 24, background: COLORS.darkBg, borderRadius: 12, border: "2px solid " + COLORS.neonPink + "44" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.neonPink }}>Premium Plan</div>
                  <span style={{ padding: "4px 10px", background: "rgba(255,45,146,0.2)", borderRadius: 6, fontSize: 10, color: COLORS.neonPink, fontWeight: 600 }}>SUBSCRIPTION</span>
                </div>
                <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase" }}>Monthly Fee</div>
                {editing ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 24, fontWeight: 700, color: COLORS.neonPink }}>$</span>
                    <input
                      type="number"
                      value={settings.package_pricing.premium_monthly_cents}
                      onChange={e => setSettings({ ...settings, package_pricing: { ...settings.package_pricing, premium_monthly_cents: parseInt(e.target.value) || 0 } })}
                      style={{ width: 100, padding: 12, background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.neonPink, fontSize: 28, fontWeight: 700, textAlign: "center" }}
                    />
                    <span style={{ fontSize: 14, color: COLORS.textSecondary }}>cents/mo</span>
                  </div>
                ) : (
                  <div style={{ fontSize: 40, fontWeight: 700, color: COLORS.neonPink }}>{formatCents(settings.package_pricing.premium_monthly_cents)}<span style={{ fontSize: 16, color: COLORS.textSecondary }}>/mo</span></div>
                )}
                <div style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 8 }}>No per-receipt fees</div>
              </div>
            </div>
          </Card>

          {/* Premium Add-ons */}
          <Card title="PREMIUM ADD-ONS &amp; SERVICES">
            <div style={{ marginBottom: 16, color: COLORS.textSecondary, fontSize: 13 }}>
              Monthly add-on pricing for Premium subscribers. These are added on top of the Premium base fee.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
              {([
                { key: "addon_video_5_monthly_cents" as const, label: "Add 5 Videos/Day", desc: "Upload up to 5 videos daily", color: COLORS.neonBlue },
                { key: "addon_live_15_monthly_cents" as const, label: "Live Capacity: 15", desc: "Increase live video capacity to 15", color: COLORS.neonPurple },
                { key: "addon_live_30_monthly_cents" as const, label: "Live Capacity: 30", desc: "Increase live video capacity to 30", color: COLORS.neonPurple },
                { key: "tpms_monthly_cents" as const, label: "TPMS (Profile Mgmt)", desc: "Total Profile Management Services", color: COLORS.neonOrange },
              ]).map(addon => (
                <div key={addon.key} style={{ padding: 20, background: COLORS.darkBg, borderRadius: 12, border: "1px solid " + addon.color + "33" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: addon.color }}>{addon.label}</div>
                      <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 4 }}>{addon.desc}</div>
                    </div>
                  </div>
                  {editing ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14, color: COLORS.textSecondary }}>+$</span>
                      <input
                        type="number"
                        value={settings.package_pricing[addon.key]}
                        onChange={e => setSettings({ ...settings, package_pricing: { ...settings.package_pricing, [addon.key]: parseInt(e.target.value) || 0 } })}
                        style={{ width: 80, padding: 10, background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: addon.color, fontSize: 20, fontWeight: 700, textAlign: "center" }}
                      />
                      <span style={{ fontSize: 12, color: COLORS.textSecondary }}>cents/mo</span>
                    </div>
                  ) : (
                    <div style={{ fontSize: 24, fontWeight: 700, color: addon.color }}>+{formatCents(settings.package_pricing[addon.key])}<span style={{ fontSize: 12, color: COLORS.textSecondary }}>/mo</span></div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* Advertising Campaigns */}
          <Card title="ADVERTISING CAMPAIGN PRICING">
            <div style={{ marginBottom: 16, color: COLORS.textSecondary, fontSize: 13 }}>
              One-time campaign pricing for business advertising. These appear in partner onboarding and the business dashboard.
            </div>

            {/* Spotlight Campaigns */}
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: COLORS.neonYellow }}>SPOTLIGHT CAMPAIGNS</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
              {([
                { key: "spotlight_1day_cents" as const, label: "1-Day Spotlight", desc: "24hr boost, 20-mile radius", color: COLORS.neonYellow },
                { key: "spotlight_7day_cents" as const, label: "7-Day Spotlight", desc: "Week-long boost, 50-mile radius", color: COLORS.neonYellow },
                { key: "spotlight_14day_cents" as const, label: "14-Day Spotlight", desc: "Two-week boost, 50-mile radius", color: COLORS.neonYellow },
              ]).map(campaign => (
                <div key={campaign.key} style={{ padding: 20, background: COLORS.darkBg, borderRadius: 12, border: "1px solid " + campaign.color + "33" }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, color: campaign.color }}>{campaign.label}</div>
                  <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 12 }}>{campaign.desc}</div>
                  {editing ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: campaign.color }}>$</span>
                      <input
                        type="number"
                        value={settings.ad_pricing[campaign.key]}
                        onChange={e => setSettings({ ...settings, ad_pricing: { ...settings.ad_pricing, [campaign.key]: parseInt(e.target.value) || 0 } })}
                        style={{ width: 80, padding: 10, background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: campaign.color, fontSize: 20, fontWeight: 700, textAlign: "center" }}
                      />
                      <span style={{ fontSize: 12, color: COLORS.textSecondary }}>cents</span>
                    </div>
                  ) : (
                    <div style={{ fontSize: 28, fontWeight: 700, color: campaign.color }}>{formatCents(settings.ad_pricing[campaign.key])}</div>
                  )}
                </div>
              ))}
            </div>

            {/* Push Campaigns */}
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: COLORS.neonOrange }}>PUSH CAMPAIGNS</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {([
                { key: "push_100mile_cents" as const, label: "100 Mile Wide Push", desc: "7-day campaign + push notifications, 100-mile radius", color: COLORS.neonOrange },
                { key: "push_tourwide_cents" as const, label: "Tour Wide Push", desc: "14-day campaign + 60-day window, nationwide", color: COLORS.neonOrange, featured: true },
              ]).map(campaign => (
                <div key={campaign.key} style={{ padding: 20, background: COLORS.darkBg, borderRadius: 12, border: campaign.featured ? "2px solid " + campaign.color : "1px solid " + campaign.color + "33", position: "relative" }}>
                  {campaign.featured && (
                    <span style={{ position: "absolute", top: -10, right: 16, padding: "4px 10px", background: COLORS.neonOrange, borderRadius: 6, fontSize: 10, fontWeight: 700, color: "#000" }}>FEATURED</span>
                  )}
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, color: campaign.color }}>{campaign.label}</div>
                  <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 12 }}>{campaign.desc}</div>
                  {editing ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: campaign.color }}>$</span>
                      <input
                        type="number"
                        value={settings.ad_pricing[campaign.key]}
                        onChange={e => setSettings({ ...settings, ad_pricing: { ...settings.ad_pricing, [campaign.key]: parseInt(e.target.value) || 0 } })}
                        style={{ width: 100, padding: 10, background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: campaign.color, fontSize: 20, fontWeight: 700, textAlign: "center" }}
                      />
                      <span style={{ fontSize: 12, color: COLORS.textSecondary }}>cents</span>
                    </div>
                  ) : (
                    <div style={{ fontSize: 28, fontWeight: 700, color: campaign.color }}>{formatCents(settings.ad_pricing[campaign.key])}</div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* Pricing Summary */}
          <Card title="CURRENT PRICING SUMMARY">
            <div style={{ background: COLORS.darkBg, borderRadius: 10, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 8, padding: "10px 14px", background: COLORS.cardBg, fontSize: 10, color: COLORS.textSecondary, fontWeight: 600, textTransform: "uppercase" }}>
                <div>Item</div>
                <div style={{ textAlign: "right" }}>Price</div>
              </div>
              {[
                { label: "Basic Plan (monthly)", value: formatCents(settings.package_pricing.basic_monthly_cents) + "/mo", color: COLORS.textPrimary },
                { label: "Premium Plan (monthly)", value: formatCents(settings.package_pricing.premium_monthly_cents) + "/mo", color: COLORS.neonPink },
                { label: "Add-on: 5 Videos/Day", value: "+" + formatCents(settings.package_pricing.addon_video_5_monthly_cents) + "/mo", color: COLORS.neonBlue },
                { label: "Add-on: Live Capacity 15", value: "+" + formatCents(settings.package_pricing.addon_live_15_monthly_cents) + "/mo", color: COLORS.neonPurple },
                { label: "Add-on: Live Capacity 30", value: "+" + formatCents(settings.package_pricing.addon_live_30_monthly_cents) + "/mo", color: COLORS.neonPurple },
                { label: "TPMS Service", value: "+" + formatCents(settings.package_pricing.tpms_monthly_cents) + "/mo", color: COLORS.neonOrange },
                { label: "1-Day Spotlight", value: formatCents(settings.ad_pricing.spotlight_1day_cents), color: COLORS.neonYellow },
                { label: "7-Day Spotlight", value: formatCents(settings.ad_pricing.spotlight_7day_cents), color: COLORS.neonYellow },
                { label: "14-Day Spotlight", value: formatCents(settings.ad_pricing.spotlight_14day_cents), color: COLORS.neonYellow },
                { label: "100 Mile Wide Push", value: formatCents(settings.ad_pricing.push_100mile_cents), color: COLORS.neonOrange },
                { label: "Tour Wide Push", value: formatCents(settings.ad_pricing.push_tourwide_cents), color: COLORS.neonOrange },
              ].map((row, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 8, padding: "10px 14px", borderTop: "1px solid " + COLORS.cardBorder, fontSize: 13 }}>
                  <div>{row.label}</div>
                  <div style={{ textAlign: "right", fontWeight: 600, color: row.color }}>{row.value}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ==================== EMAIL TEMPLATES ==================== */}
      {settingsSection === "emails" && (
        <Card title="EMAIL TEMPLATES">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: COLORS.textSecondary }}>Manage automated email templates sent to users and businesses</div>
            <button
              onClick={() => { setEditingEmailTemplate({ id: "", name: "", subject: "", body: "Hi {{user_name}},\n\nThank you for using LetsGo!\n\nBest regards,\nThe LetsGo Team", active: true }); setShowEmailTemplateModal(true); }}
              style={{ padding: "10px 20px", background: COLORS.gradient1, border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 13 }}
            >
              + Add Template
            </button>
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            {emailTemplates.map(template => (
              <div key={template.id} style={{ padding: 16, background: COLORS.darkBg, borderRadius: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 15 }}>{template.name}</span>
                      <span style={{
                        padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600,
                        background: template.active ? "rgba(57,255,20,0.2)" : "rgba(160,160,176,0.2)",
                        color: template.active ? COLORS.neonGreen : COLORS.textSecondary,
                      }}>
                        {template.active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 8 }}>
                      Subject: <span style={{ color: COLORS.textPrimary }}>{template.subject}</span>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 10, color: COLORS.textSecondary }}>Variables:</span>
                      {["{{user_name}}", "{{business_name}}", "{{amount}}"].map(v => (
                        <span key={v} style={{ padding: "2px 6px", background: COLORS.cardBg, borderRadius: 4, fontSize: 10, fontFamily: "monospace", color: COLORS.neonBlue }}>{v}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => { setEditingEmailTemplate(template); setShowEmailTemplateModal(true); }}
                      style={{ padding: "8px 16px", background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete the "${template.name}" template?`)) {
                          setEmailTemplates(emailTemplates.filter(t => t.id !== template.id));
                        }
                      }}
                      style={{ padding: "8px 12px", background: "rgba(255,49,49,0.1)", border: "1px solid " + COLORS.neonRed, borderRadius: 8, color: COLORS.neonRed, cursor: "pointer", fontSize: 12 }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Email Template Edit Modal */}
      {showEmailTemplateModal && editingEmailTemplate && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1001 }}
          onClick={() => { setShowEmailTemplateModal(false); setEditingEmailTemplate(null); }}
        >
          <div
            style={{ background: COLORS.cardBg, borderRadius: 20, padding: 32, width: 700, maxWidth: "95%", maxHeight: "90vh", overflowY: "auto", border: "1px solid " + COLORS.cardBorder }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700 }}>{editingEmailTemplate.id ? "Edit Email Template" : "Create Email Template"}</h2>
              <button onClick={() => { setShowEmailTemplateModal(false); setEditingEmailTemplate(null); }} style={{ background: "none", border: "none", fontSize: 24, color: COLORS.textSecondary, cursor: "pointer" }}>×</button>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase", fontWeight: 600 }}>Template Name *</label>
              <input
                type="text"
                value={editingEmailTemplate.name}
                onChange={e => setEditingEmailTemplate({ ...editingEmailTemplate, name: e.target.value })}
                placeholder="e.g., Welcome Email, Payout Confirmation"
                style={{ width: "100%", padding: 14, background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, fontSize: 14 }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase", fontWeight: 600 }}>Email Subject *</label>
              <input
                type="text"
                value={editingEmailTemplate.subject}
                onChange={e => setEditingEmailTemplate({ ...editingEmailTemplate, subject: e.target.value })}
                placeholder='e.g., Welcome to LetsGo, {{user_name}}!'
                style={{ width: "100%", padding: 14, background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, fontSize: 14 }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 600 }}>Email Body *</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <span style={{ fontSize: 10, color: COLORS.textSecondary }}>Insert:</span>
                  {["{{user_name}}", "{{business_name}}", "{{amount}}", "{{date}}"].map(v => (
                    <button key={v} style={{ padding: "4px 8px", background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 4, fontSize: 10, fontFamily: "monospace", color: COLORS.neonBlue, cursor: "pointer" }}>{v}</button>
                  ))}
                </div>
              </div>
              <textarea
                value={editingEmailTemplate.body}
                onChange={e => setEditingEmailTemplate({ ...editingEmailTemplate, body: e.target.value })}
                placeholder="Enter email body with variables..."
                style={{ width: "100%", padding: 14, background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, fontSize: 14, minHeight: 200, fontFamily: "monospace", lineHeight: 1.6, resize: "vertical" }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={editingEmailTemplate.active}
                  onChange={e => setEditingEmailTemplate({ ...editingEmailTemplate, active: e.target.checked })}
                  style={{ width: 18, height: 18 }}
                />
                <span style={{ fontSize: 14 }}>Template Active</span>
              </label>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                onClick={() => { setShowEmailTemplateModal(false); setEditingEmailTemplate(null); }}
                style={{ padding: "12px 24px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, cursor: "pointer", fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (editingEmailTemplate.id) {
                    setEmailTemplates(emailTemplates.map(t => t.id === editingEmailTemplate.id ? editingEmailTemplate : t));
                  } else {
                    const newId = `template_${Date.now()}`;
                    setEmailTemplates([...emailTemplates, { ...editingEmailTemplate, id: newId }]);
                  }
                  setShowEmailTemplateModal(false);
                  setEditingEmailTemplate(null);
                }}
                style={{ padding: "12px 24px", background: COLORS.gradient1, border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontWeight: 700 }}
              >
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== STAFF ROLES ==================== */}
      {settingsSection === "roles" && (
        <div style={{ display: "grid", gap: 24 }}>
          {/* Role Permissions */}
          <Card title="STAFF ROLE PERMISSIONS">
            <div style={{ display: "grid", gap: 16 }}>
              {settings.roles_config.map(role => (
                <div key={role.id} style={{ padding: 20, background: COLORS.darkBg, borderRadius: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{role.name}</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => { setNewRole({ name: role.name, permissions: [...role.permissions] }); setShowAddRoleModal(true); }}
                        style={{ padding: "6px 14px", background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 6, color: COLORS.textSecondary, cursor: "pointer", fontSize: 11, fontWeight: 600 }}
                      >
                        Edit
                      </button>
                      {role.name !== "Administrator" && (
                        <button
                          onClick={() => {
                            if (confirm(`Delete the role "${role.name}"? Users with this role will need to be reassigned.`)) {
                              setSettings({ ...settings, roles_config: settings.roles_config.filter(r => r.id !== role.id) });
                            }
                          }}
                          style={{ padding: "6px 14px", background: "rgba(255,49,49,0.1)", border: "1px solid " + COLORS.neonRed, borderRadius: 6, color: COLORS.neonRed, cursor: "pointer", fontSize: 11, fontWeight: 600 }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {role.permissions.map(perm => (
                      <span
                        key={perm}
                        style={{
                          padding: "4px 12px",
                          background: perm === "all" ? "rgba(57,255,20,0.2)" : COLORS.cardBg,
                          border: "1px solid " + (perm === "all" ? COLORS.neonGreen : COLORS.cardBorder),
                          borderRadius: 6, fontSize: 11,
                          color: perm === "all" ? COLORS.neonGreen : COLORS.textSecondary,
                        }}
                      >
                        {perm}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => { setNewRole({ name: "", permissions: [] }); setShowAddRoleModal(true); }}
              style={{ marginTop: 16, padding: "12px 20px", background: `linear-gradient(135deg, ${COLORS.neonPurple}, ${COLORS.neonPink})`, border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontWeight: 700 }}
            >
              + Add New Role
            </button>
          </Card>

          {/* Staff Members */}
          <Card title="STAFF MEMBERS">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: COLORS.textSecondary }}>
                Manage who has access to the admin dashboard. Staff members can view and manage all platform data.
              </div>
              <button
                onClick={() => setShowAddStaff(true)}
                style={{ padding: "10px 20px", background: COLORS.gradient1, border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 13 }}
              >
                + Add Staff
              </button>
            </div>
            {staffUsers.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary }}>No staff members found.</div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {staffUsers.map(staff => (
                  <div key={staff.user_id} style={{
                    display: "flex", alignItems: "center", gap: 16, padding: 16,
                    background: COLORS.darkBg, borderRadius: 12,
                    border: staff.user_id === currentStaffId ? "1px solid " + COLORS.neonGreen : "1px solid " + COLORS.cardBorder,
                  }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: "50%",
                      background: COLORS.gradient1,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 700, fontSize: 16,
                    }}>
                      {(staff.name || "?")[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        {staff.name}
                        {staff.user_id === currentStaffId && <span style={{ marginLeft: 8, fontSize: 10, color: COLORS.neonGreen }}>(you)</span>}
                      </div>
                      <div style={{ fontSize: 11, color: COLORS.textSecondary, fontFamily: "monospace" }}>
                        #{staff.user_id.slice(-6).toUpperCase()}
                      </div>
                    </div>
                    <div style={{
                      padding: "6px 14px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                      background: staff.role === "admin" ? "rgba(0,212,255,0.15)" : "rgba(191,95,255,0.15)",
                      color: staff.role === "admin" ? COLORS.neonBlue : COLORS.neonPurple,
                      textTransform: "capitalize",
                    }}>
                      {staff.role}
                    </div>
                    {staff.user_id !== currentStaffId && (
                      <button
                        onClick={() => removeStaff(staff.user_id)}
                        style={{ padding: "6px 12px", background: "rgba(255,49,49,0.15)", border: "1px solid " + COLORS.neonRed, borderRadius: 6, color: COLORS.neonRed, cursor: "pointer", fontSize: 11, fontWeight: 600 }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Add/Edit Role Modal */}
      {showAddRoleModal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1001 }}
          onClick={() => setShowAddRoleModal(false)}
        >
          <div
            style={{ background: COLORS.cardBg, borderRadius: 20, padding: 32, width: 600, maxWidth: "95%", maxHeight: "90vh", overflowY: "auto", border: "1px solid " + COLORS.cardBorder }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700 }}>{newRole.name ? "Edit Role" : "Create New Role"}</h2>
              <button onClick={() => setShowAddRoleModal(false)} style={{ background: "none", border: "none", fontSize: 24, color: COLORS.textSecondary, cursor: "pointer" }}>×</button>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase", fontWeight: 600 }}>Role Name *</label>
              <input
                type="text"
                value={newRole.name}
                onChange={e => setNewRole({ ...newRole, name: e.target.value })}
                placeholder="e.g., Support Manager, Content Reviewer"
                style={{ width: "100%", padding: 14, background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, fontSize: 14 }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 12, textTransform: "uppercase", fontWeight: 600 }}>Permissions</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {ALL_PERMISSIONS.map(perm => (
                  <label
                    key={perm.id}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, padding: 12,
                      background: newRole.permissions.includes(perm.id) ? "rgba(57,255,20,0.1)" : COLORS.darkBg,
                      borderRadius: 8, cursor: "pointer",
                      border: newRole.permissions.includes(perm.id) ? "1px solid " + COLORS.neonGreen : "1px solid " + COLORS.cardBorder,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={newRole.permissions.includes(perm.id)}
                      onChange={e => {
                        if (e.target.checked) {
                          setNewRole({ ...newRole, permissions: [...newRole.permissions, perm.id] });
                        } else {
                          setNewRole({ ...newRole, permissions: newRole.permissions.filter(p => p !== perm.id) });
                        }
                      }}
                      style={{ width: 18, height: 18 }}
                    />
                    <span style={{ fontSize: 13, color: newRole.permissions.includes(perm.id) ? COLORS.neonGreen : COLORS.textPrimary }}>
                      {perm.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button onClick={() => setShowAddRoleModal(false)} style={{ padding: "12px 24px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, cursor: "pointer", fontWeight: 600 }}>Cancel</button>
              <button
                onClick={() => {
                  if (!newRole.name) return;
                  const existingIdx = settings.roles_config.findIndex(r => r.name === newRole.name);
                  if (existingIdx >= 0) {
                    const updated = [...settings.roles_config];
                    updated[existingIdx] = { ...updated[existingIdx], permissions: newRole.permissions };
                    setSettings({ ...settings, roles_config: updated });
                  } else {
                    setSettings({ ...settings, roles_config: [...settings.roles_config, { id: `role_${Date.now()}`, name: newRole.name, permissions: newRole.permissions }] });
                  }
                  setShowAddRoleModal(false);
                  setNewRole({ name: "", permissions: [] });
                }}
                style={{ padding: "12px 24px", background: COLORS.gradient1, border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontWeight: 700 }}
              >
                Save Role
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Staff Modal */}
      {showAddStaff && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1001 }}
          onClick={() => setShowAddStaff(false)}
        >
          <div
            style={{ background: COLORS.cardBg, borderRadius: 20, padding: 32, width: 450, maxWidth: "90%", border: "1px solid " + COLORS.cardBorder }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Add Staff Member</h2>
            <div style={{ display: "grid", gap: 16, marginBottom: 24 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, textTransform: "uppercase", fontWeight: 600 }}>User Email</label>
                <input
                  type="email"
                  value={newStaffEmail}
                  onChange={e => setNewStaffEmail(e.target.value)}
                  placeholder="user@example.com"
                  style={{ width: "100%", padding: "12px 14px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, fontSize: 14 }}
                />
                <div style={{ fontSize: 10, color: COLORS.textSecondary, marginTop: 4 }}>Must be an existing LetsGo user</div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, textTransform: "uppercase", fontWeight: 600 }}>Display Name</label>
                <input
                  type="text"
                  value={newStaffName}
                  onChange={e => setNewStaffName(e.target.value)}
                  placeholder="John Smith"
                  style={{ width: "100%", padding: "12px 14px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, fontSize: 14 }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, textTransform: "uppercase", fontWeight: 600 }}>Role</label>
                <select
                  value={newStaffRole}
                  onChange={e => setNewStaffRole(e.target.value)}
                  style={{ width: "100%", padding: "12px 14px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, fontSize: 14 }}
                >
                  {settings.roles_config.map(role => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button onClick={() => setShowAddStaff(false)} style={{ padding: "12px 24px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, cursor: "pointer", fontWeight: 600 }}>Cancel</button>
              <button
                onClick={addStaffUser}
                disabled={addingStaff || !newStaffEmail}
                style={{ padding: "12px 24px", background: COLORS.gradient1, border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontWeight: 700, opacity: (!newStaffEmail || addingStaff) ? 0.5 : 1 }}
              >
                {addingStaff ? "Adding..." : "Add Staff"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== SECURITY ==================== */}
      {settingsSection === "security" && (
        <div style={{ display: "grid", gap: 24 }}>
          {/* Under Construction Banner */}
          <div style={{
            padding: 20, borderRadius: 14,
            background: "repeating-linear-gradient(45deg, rgba(255,255,0,0.06), rgba(255,255,0,0.06) 20px, transparent 20px, transparent 40px)",
            border: "2px dashed " + COLORS.neonYellow,
            textAlign: "center",
          }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🚧</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.neonYellow, marginBottom: 6 }}>UNDER CONSTRUCTION</div>
            <div style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.5 }}>
              Security settings are not yet implemented. These controls are visual placeholders and do not affect the platform.
              Security is currently managed at the Supabase Auth level.
            </div>
          </div>

          {/* Two-Factor Authentication */}
          <Card title="TWO-FACTOR AUTHENTICATION (2FA)">
            <div style={{ padding: 16, background: "rgba(57,255,20,0.1)", borderRadius: 12, marginBottom: 20, border: "1px solid " + COLORS.neonGreen }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <span style={{ fontSize: 24 }}>🛡️</span>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4, color: COLORS.neonGreen }}>What is 2FA?</div>
                  <div style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.5 }}>
                    Two-Factor Authentication adds an extra layer of security. When enabled, staff must enter a code from their
                    authenticator app (like Google Authenticator or Authy) in addition to their password when logging in.
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>Require 2FA for All Staff</div>
                  <div style={{ fontSize: 12, color: COLORS.textSecondary }}>Force all staff members to enable 2FA before accessing the portal</div>
                </div>
                <div style={{
                  width: 56, height: 28, borderRadius: 28, background: COLORS.neonGreen,
                  position: "relative", cursor: "pointer",
                }}>
                  <div style={{ position: "absolute", top: 2, left: 30, width: 24, height: 24, background: "#fff", borderRadius: "50%", transition: "0.3s" }} />
                </div>
              </div>
            </div>

            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Staff 2FA Status</div>
            <div style={{ display: "grid", gap: 10 }}>
              {staffUsers.map((staff, i) => {
                const has2fa = i === 0; // First staff member has 2FA enabled (placeholder)
                return (
                  <div key={staff.user_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 14, background: COLORS.darkBg, borderRadius: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: "50%", background: COLORS.gradient1,
                        display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12,
                      }}>
                        {staff.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{staff.name}</div>
                        <div style={{ fontSize: 11, color: COLORS.textSecondary }}>{staff.role} • #{staff.user_id.slice(-6).toUpperCase()}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{
                        padding: "6px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                        background: has2fa ? "rgba(57,255,20,0.2)" : "rgba(255,49,49,0.2)",
                        color: has2fa ? COLORS.neonGreen : COLORS.neonRed,
                      }}>
                        {has2fa ? "2FA Enabled" : "2FA Not Set"}
                      </span>
                      {!has2fa && (
                        <button
                          onClick={() => alert("2FA reminder sent!")}
                          style={{ padding: "6px 12px", background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 6, color: COLORS.textPrimary, cursor: "pointer", fontSize: 11 }}
                        >
                          Send Reminder
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {staffUsers.length === 0 && (
                <div style={{ padding: 20, textAlign: "center", color: COLORS.textSecondary, fontSize: 13 }}>No staff members found. Add staff in the Staff Roles tab.</div>
              )}
            </div>
          </Card>

          {/* Session & Login Security */}
          <Card title="SESSION &amp; LOGIN SECURITY">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              <div style={{ padding: 20, background: COLORS.darkBg, borderRadius: 12 }}>
                <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase" }}>Session Timeout</div>
                <select defaultValue="60" style={{ padding: 12, background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, fontSize: 14, width: 140 }}>
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="120">2 hours</option>
                  <option value="240">4 hours</option>
                  <option value="480">8 hours</option>
                </select>
                <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 8 }}>Auto-logout after inactivity</div>
              </div>
              <div style={{ padding: 20, background: COLORS.darkBg, borderRadius: 12 }}>
                <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase" }}>Max Failed Login Attempts</div>
                <select defaultValue="5" style={{ padding: 12, background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, fontSize: 14, width: 140 }}>
                  <option value="3">3 attempts</option>
                  <option value="5">5 attempts</option>
                  <option value="10">10 attempts</option>
                </select>
                <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 8 }}>Before account is locked</div>
              </div>
              <div style={{ padding: 20, background: COLORS.darkBg, borderRadius: 12 }}>
                <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase" }}>Password Expiry</div>
                <select defaultValue="90" style={{ padding: 12, background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, fontSize: 14, width: 140 }}>
                  <option value="30">30 days</option>
                  <option value="60">60 days</option>
                  <option value="90">90 days</option>
                  <option value="180">180 days</option>
                  <option value="never">Never</option>
                </select>
                <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 8 }}>Force password reset after</div>
              </div>
              <div style={{ padding: 20, background: COLORS.darkBg, borderRadius: 12 }}>
                <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase" }}>IP Allowlist</div>
                <span style={{ padding: "6px 12px", background: "rgba(255,255,0,0.2)", borderRadius: 6, color: COLORS.neonYellow, fontSize: 12, fontWeight: 600 }}>Disabled</span>
                <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 8 }}>Restrict access by IP address</div>
              </div>
            </div>
          </Card>

          {/* Active Sessions */}
          <Card title="ACTIVE SESSIONS">
            <div style={{ display: "grid", gap: 10 }}>
              {[
                { device: "Chrome on Windows", location: "Current Session", ip: "—", lastActive: "Now", current: true },
              ].map((session, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", padding: 14,
                  background: COLORS.darkBg, borderRadius: 10,
                  border: session.current ? "2px solid " + COLORS.neonGreen : "none",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 24 }}>🖥️</span>
                    <div>
                      <div style={{ fontWeight: 600 }}>{session.device} {session.current && <span style={{ fontSize: 10, color: COLORS.neonGreen }}>(This device)</span>}</div>
                      <div style={{ fontSize: 11, color: COLORS.textSecondary }}>{session.location} • {session.ip}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: COLORS.neonGreen }}>{session.lastActive}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => alert("All other sessions signed out")}
              style={{ marginTop: 16, padding: "12px 20px", background: "rgba(255,49,49,0.2)", border: "1px solid " + COLORS.neonRed, borderRadius: 10, color: COLORS.neonRed, cursor: "pointer", fontWeight: 600, width: "100%" }}
            >
              Sign Out All Other Sessions
            </button>
          </Card>

          {/* Audit & Compliance */}
          <Card title="AUDIT &amp; COMPLIANCE">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              <div style={{ padding: 20, background: COLORS.darkBg, borderRadius: 12, textAlign: "center" }}>
                <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase" }}>Login Events (30d)</div>
                <div style={{ fontSize: 32, fontWeight: 700, color: COLORS.neonBlue }}>—</div>
                <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 4 }}>Successful logins</div>
              </div>
              <div style={{ padding: 20, background: COLORS.darkBg, borderRadius: 12, textAlign: "center" }}>
                <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase" }}>Failed Attempts (30d)</div>
                <div style={{ fontSize: 32, fontWeight: 700, color: COLORS.neonRed }}>—</div>
                <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 4 }}>Blocked by security</div>
              </div>
              <div style={{ padding: 20, background: COLORS.darkBg, borderRadius: 12, textAlign: "center" }}>
                <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase" }}>Security Alerts</div>
                <div style={{ fontSize: 32, fontWeight: 700, color: COLORS.neonGreen }}>0</div>
                <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 4 }}>Active alerts</div>
              </div>
            </div>
            <button
              onClick={() => alert("Navigate to Audit Log tab")}
              style={{ marginTop: 16, padding: "12px 20px", background: COLORS.gradient1, border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontWeight: 600, width: "100%" }}
            >
              View Full Audit Log →
            </button>
          </Card>
        </div>
      )}

      {/* ==================== TAG MANAGEMENT ==================== */}
      {settingsSection === "tags" && (
        <div style={{ display: "grid", gap: 24 }}>
          {tagsLoading ? (
            <div style={{ color: COLORS.textSecondary, padding: 40, textAlign: "center" }}>Loading tags...</div>
          ) : (
            <>
              {/* Stats row */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                {[
                  { label: "Total Tags", value: tagItems.length, color: COLORS.neonGreen },
                  { label: "Categories", value: tagCategories.length, color: COLORS.neonBlue },
                  { label: "Uncategorized", value: tagItems.filter(t => !t.category_id).length, color: COLORS.neonOrange },
                ].map(s => (
                  <div key={s.label} style={{ padding: 20, background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 12, textAlign: "center" }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 4 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* ── Categories Card ── */}
              <Card title="TAG CATEGORIES">
                <div style={{ marginBottom: 16, color: COLORS.textSecondary, fontSize: 13 }}>
                  Organize tags into categories. Categories appear as groups in tag pickers across the app.
                </div>

                {/* Add category form */}
                <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                  <input
                    value={newCatIcon}
                    onChange={e => setNewCatIcon(e.target.value)}
                    placeholder="Icon"
                    style={{ width: 60, padding: "10px 12px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: "#fff", fontSize: 16, textAlign: "center" }}
                  />
                  <input
                    value={newCatName}
                    onChange={e => setNewCatName(e.target.value)}
                    placeholder="New category name..."
                    onKeyDown={e => { if (e.key === "Enter") addCategory(); }}
                    style={{ flex: 1, minWidth: 160, padding: "10px 14px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: "#fff", fontSize: 13 }}
                  />
                  <button
                    onClick={addCategory}
                    disabled={!newCatName.trim()}
                    style={{ padding: "10px 20px", background: COLORS.neonGreen, border: "none", borderRadius: 8, color: "#000", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: newCatName.trim() ? 1 : 0.4 }}
                  >
                    Add
                  </button>
                </div>
                <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: COLORS.textSecondary }}>Scope:</span>
                  {["business", "event", "game"].map(s => (
                    <label key={s} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#fff", cursor: "pointer" }}>
                      <input type="checkbox" checked={newCatScope.includes(s)} onChange={() => setNewCatScope(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])} />
                      {s}
                    </label>
                  ))}
                  <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: COLORS.neonOrange, cursor: "pointer", marginLeft: 8 }}>
                    <input type="checkbox" checked={newCatRequiresFood} onChange={() => setNewCatRequiresFood(!newCatRequiresFood)} />
                    Food-only
                  </label>
                </div>

                {/* Category list */}
                <div style={{ display: "grid", gap: 8 }}>
                  {tagCategories.map(cat => {
                    const count = tagItems.filter(t => t.category_id === cat.id).length;
                    const isEditing = editingCatId === cat.id;
                    return (
                      <div key={cat.id} style={{ padding: "12px 16px", background: COLORS.darkBg, borderRadius: 10 }}>
                        {isEditing ? (
                          <div style={{ display: "grid", gap: 8 }}>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <input value={editCatIcon} onChange={e => setEditCatIcon(e.target.value)} style={{ width: 50, padding: "6px 8px", background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 6, color: "#fff", fontSize: 16, textAlign: "center" }} />
                              <input value={editCatName} onChange={e => setEditCatName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") updateCategory(cat.id); }} style={{ flex: 1, padding: "6px 10px", background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 6, color: "#fff", fontSize: 13 }} />
                              <button onClick={() => updateCategory(cat.id)} style={{ padding: "6px 14px", background: COLORS.neonGreen, border: "none", borderRadius: 6, color: "#000", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Save</button>
                              <button onClick={() => setEditingCatId(null)} style={{ padding: "6px 14px", background: "transparent", border: "1px solid " + COLORS.cardBorder, borderRadius: 6, color: COLORS.textSecondary, fontSize: 12, cursor: "pointer" }}>Cancel</button>
                            </div>
                            <div style={{ display: "flex", gap: 12, alignItems: "center", paddingLeft: 58 }}>
                              <span style={{ fontSize: 11, color: COLORS.textSecondary }}>Scope:</span>
                              {["business", "event", "game"].map(s => (
                                <label key={s} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#fff", cursor: "pointer" }}>
                                  <input type="checkbox" checked={editCatScope.includes(s)} onChange={() => setEditCatScope(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])} />
                                  {s}
                                </label>
                              ))}
                              <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: COLORS.neonOrange, cursor: "pointer", marginLeft: 8 }}>
                                <input type="checkbox" checked={editCatRequiresFood} onChange={() => setEditCatRequiresFood(!editCatRequiresFood)} />
                                Food-only
                              </label>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <span style={{ fontSize: 20 }}>{cat.icon}</span>
                            <span style={{ fontWeight: 600, fontSize: 14 }}>{cat.name}</span>
                            <div style={{ display: "flex", gap: 4, flex: 1 }}>
                              {cat.scope.map(s => (
                                <span key={s} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: s === "business" ? "rgba(0,212,255,0.15)" : s === "event" ? "rgba(191,95,255,0.15)" : "rgba(255,255,0,0.15)", color: s === "business" ? COLORS.neonBlue : s === "event" ? COLORS.neonPurple : COLORS.neonYellow }}>{s}</span>
                              ))}
                              {cat.requires_food && (
                                <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: "rgba(255,107,53,0.15)", color: COLORS.neonOrange }}>food-only</span>
                              )}
                            </div>
                            <span style={{ fontSize: 12, color: COLORS.textSecondary, background: "rgba(255,255,255,0.05)", padding: "4px 10px", borderRadius: 20 }}>{count} tag{count !== 1 ? "s" : ""}</span>
                            <button onClick={() => { setEditingCatId(cat.id); setEditCatName(cat.name); setEditCatIcon(cat.icon); setEditCatScope(cat.scope); setEditCatRequiresFood(cat.requires_food); }} style={{ padding: "6px 12px", background: "transparent", border: "1px solid " + COLORS.cardBorder, borderRadius: 6, color: COLORS.neonBlue, fontSize: 12, cursor: "pointer" }}>Edit</button>
                            <button onClick={() => deleteCategory(cat.id, cat.name)} style={{ padding: "6px 12px", background: "transparent", border: "1px solid rgba(255,49,49,0.3)", borderRadius: 6, color: COLORS.neonRed, fontSize: 12, cursor: "pointer" }}>Delete</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {tagCategories.length === 0 && (
                    <div style={{ color: COLORS.textSecondary, fontSize: 13, padding: 20, textAlign: "center" }}>No categories yet. Add one above to get started.</div>
                  )}
                </div>
              </Card>

              {/* ── Tags Card ── */}
              <Card title="TAGS">
                <div style={{ marginBottom: 16, color: COLORS.textSecondary, fontSize: 13 }}>
                  Manage all available tags. These appear in business profile editors, discovery filters, and content tagging across the platform.
                </div>

                {/* Add tag form */}
                <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                  <input
                    value={newTagName}
                    onChange={e => setNewTagName(e.target.value)}
                    placeholder="New tag name..."
                    onKeyDown={e => { if (e.key === "Enter") addTag(); }}
                    style={{ flex: 2, minWidth: 160, padding: "10px 14px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: "#fff", fontSize: 13 }}
                  />
                  <input
                    value={newTagIcon}
                    onChange={e => setNewTagIcon(e.target.value)}
                    placeholder="Icon"
                    style={{ width: 50, padding: "10px 8px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: "#fff", fontSize: 16, textAlign: "center" }}
                  />
                  <select
                    value={newTagCategory}
                    onChange={e => setNewTagCategory(e.target.value)}
                    style={{ flex: 1, minWidth: 130, padding: "10px 12px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: "#fff", fontSize: 13 }}
                  >
                    {tagCategories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                  </select>
                  <input
                    type="color"
                    value={newTagColor}
                    onChange={e => setNewTagColor(e.target.value)}
                    title="Tag color"
                    style={{ width: 44, height: 44, padding: 2, background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, cursor: "pointer" }}
                  />
                  <button
                    onClick={addTag}
                    disabled={!newTagName.trim() || !newTagCategory}
                    style={{ padding: "10px 20px", background: COLORS.neonGreen, border: "none", borderRadius: 8, color: "#000", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: (newTagName.trim() && newTagCategory) ? 1 : 0.4 }}
                  >
                    Add Tag
                  </button>
                </div>
                <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: COLORS.textSecondary }}>
                    Order:
                    <input type="number" value={newTagSortOrder} onChange={e => setNewTagSortOrder(Number(e.target.value))} style={{ width: 60, padding: "4px 8px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 6, color: "#fff", fontSize: 12 }} />
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: COLORS.neonOrange, cursor: "pointer" }}>
                    <input type="checkbox" checked={newTagIsFood} onChange={() => setNewTagIsFood(!newTagIsFood)} />
                    Food type
                  </label>
                </div>

                {/* Search filter */}
                <input
                  value={tagSearch}
                  onChange={e => setTagSearch(e.target.value)}
                  placeholder="Search tags..."
                  style={{ width: "100%", padding: "10px 14px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: "#fff", fontSize: 13, marginBottom: 20 }}
                />

                {/* Tags grouped by category */}
                {tagCategories.map(cat => {
                  const catTags = tagItems
                    .filter(t => t.category_id === cat.id)
                    .filter(t => !tagSearch || t.name.includes(tagSearch.toLowerCase()));
                  if (catTags.length === 0 && tagSearch) return null;
                  return (
                    <div key={cat.id} style={{ marginBottom: 24 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <span style={{ fontSize: 16 }}>{cat.icon}</span>
                        <span style={{ fontWeight: 700, fontSize: 14, color: COLORS.neonBlue }}>{cat.name}</span>
                        <span style={{ fontSize: 11, color: COLORS.textSecondary }}>({catTags.length})</span>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {catTags.map(tag => {
                          const color = tag.color || COLORS.neonGreen;
                          const isEditing = editingTagId === tag.id;
                          if (isEditing) {
                            return (
                              <div key={tag.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", background: COLORS.darkBg, borderRadius: 8, border: "1px solid " + COLORS.neonBlue, flexWrap: "wrap" }}>
                                <input value={editTagIcon} onChange={e => setEditTagIcon(e.target.value)} placeholder="Icon" style={{ width: 36, padding: "4px 4px", background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 4, color: "#fff", fontSize: 14, textAlign: "center" }} />
                                <input value={editTagName} onChange={e => setEditTagName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") updateTag(tag.id); }} style={{ width: 120, padding: "4px 8px", background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 4, color: "#fff", fontSize: 12 }} />
                                <select value={editTagCategory} onChange={e => setEditTagCategory(e.target.value)} style={{ padding: "4px 6px", background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 4, color: "#fff", fontSize: 11 }}>
                                  {tagCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                <input type="color" value={editTagColor} onChange={e => setEditTagColor(e.target.value)} style={{ width: 28, height: 28, padding: 1, border: "none", borderRadius: 4, cursor: "pointer" }} />
                                <input type="number" value={editTagSortOrder} onChange={e => setEditTagSortOrder(Number(e.target.value))} title="Sort order" style={{ width: 48, padding: "4px 6px", background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 4, color: "#fff", fontSize: 11 }} />
                                <label style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: COLORS.neonOrange, cursor: "pointer" }}>
                                  <input type="checkbox" checked={editTagIsFood} onChange={() => setEditTagIsFood(!editTagIsFood)} />
                                  Food
                                </label>
                                <button onClick={() => updateTag(tag.id)} style={{ padding: "4px 10px", background: COLORS.neonGreen, border: "none", borderRadius: 4, color: "#000", fontWeight: 700, fontSize: 11, cursor: "pointer" }}>Save</button>
                                <button onClick={() => setEditingTagId(null)} style={{ padding: "4px 8px", background: "transparent", border: "1px solid " + COLORS.cardBorder, borderRadius: 4, color: COLORS.textSecondary, fontSize: 11, cursor: "pointer" }}>X</button>
                              </div>
                            );
                          }
                          return (
                            <div
                              key={tag.id}
                              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", background: color + "18", border: "1px solid " + color + "40", borderRadius: 20, fontSize: 13, color, cursor: "pointer" }}
                              onClick={() => { setEditingTagId(tag.id); setEditTagName(tag.name); setEditTagColor(tag.color || COLORS.neonGreen); setEditTagCategory(tag.category_id); setEditTagIcon(tag.icon || ""); setEditTagSortOrder(tag.sort_order); setEditTagIsFood(tag.is_food); }}
                              title="Click to edit"
                            >
                              {tag.icon && <span style={{ fontSize: 14 }}>{tag.icon}</span>}
                              {!tag.icon && <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />}
                              {tag.name}
                              {tag.is_food && <span style={{ fontSize: 9, opacity: 0.6 }} title="Food type">🍴</span>}
                              <button
                                onClick={e => { e.stopPropagation(); deleteTag(tag.id, tag.name); }}
                                style={{ background: "transparent", border: "none", color: "rgba(255,49,49,0.6)", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0, marginLeft: 2 }}
                                title="Delete tag"
                              >
                                ×
                              </button>
                            </div>
                          );
                        })}
                        {catTags.length === 0 && !tagSearch && (
                          <span style={{ fontSize: 12, color: COLORS.textSecondary, fontStyle: "italic" }}>No tags in this category</span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Uncategorized tags */}
                {(() => {
                  const uncategorized = tagItems
                    .filter(t => !t.category_id || !tagCategories.find(c => c.id === t.category_id))
                    .filter(t => !tagSearch || t.name.includes(tagSearch.toLowerCase()));
                  if (uncategorized.length === 0) return null;
                  return (
                    <div style={{ marginBottom: 24 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <span style={{ fontSize: 16 }}>📦</span>
                        <span style={{ fontWeight: 700, fontSize: 14, color: COLORS.neonOrange }}>Uncategorized</span>
                        <span style={{ fontSize: 11, color: COLORS.textSecondary }}>({uncategorized.length})</span>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {uncategorized.map(tag => {
                          const color = tag.color || COLORS.neonOrange;
                          return (
                            <div
                              key={tag.id}
                              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", background: color + "18", border: "1px solid " + color + "40", borderRadius: 20, fontSize: 13, color, cursor: "pointer" }}
                              onClick={() => { setEditingTagId(tag.id); setEditTagName(tag.name); setEditTagColor(tag.color || COLORS.neonOrange); setEditTagCategory(tag.category_id); }}
                              title="Click to edit"
                            >
                              <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                              {tag.name}
                              <button
                                onClick={e => { e.stopPropagation(); deleteTag(tag.id, tag.name); }}
                                style={{ background: "transparent", border: "none", color: "rgba(255,49,49,0.6)", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0, marginLeft: 2 }}
                                title="Delete tag"
                              >
                                ×
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </Card>
            </>
          )}
        </div>
      )}

      {/* ==================== INFLUENCER TIERS ==================== */}
      {settingsSection === "influencer_tiers" && (
        <div style={{ display: "grid", gap: 24 }}>
          <Card title="DEFAULT INFLUENCER RATE TIERS">
            <div style={{ marginBottom: 16, color: COLORS.textSecondary, fontSize: 13 }}>
              Define the default rate tiers assigned to new influencers. Each signup earns the rate of the tier it falls into (tax-bracket style). Rates are in dollars per signup.
            </div>

            {/* Info box */}
            <div style={{ padding: 16, background: "rgba(0,212,255,0.08)", borderRadius: 12, marginBottom: 20, border: "1px solid rgba(0,212,255,0.2)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <span style={{ fontSize: 20 }}>💡</span>
                <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.6 }}>
                  <strong style={{ color: COLORS.neonBlue }}>Tax-bracket style:</strong> An influencer with 65 signups and tiers [1-50 → $30, 51-200 → $25] earns $30 for each of their first 50 signups and $25 for signups 51-65. These defaults apply to newly created influencers — existing influencers keep their own tiers.
                </div>
              </div>
            </div>

            {/* Tier rows */}
            <div style={{ display: "grid", gap: 12, marginBottom: 20 }}>
              {/* Header */}
              <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 1fr 1fr 1fr 40px", gap: 12, padding: "0 4px" }}>
                <div style={{ fontSize: 10, color: COLORS.textSecondary, fontWeight: 600, textTransform: "uppercase" }}>#</div>
                <div style={{ fontSize: 10, color: COLORS.textSecondary, fontWeight: 600, textTransform: "uppercase" }}>From (signups)</div>
                <div style={{ fontSize: 10, color: COLORS.textSecondary, fontWeight: 600, textTransform: "uppercase" }}>To (signups)</div>
                <div style={{ fontSize: 10, color: COLORS.textSecondary, fontWeight: 600, textTransform: "uppercase" }}>Rate / Signup</div>
                <div style={{ fontSize: 10, color: COLORS.textSecondary, fontWeight: 600, textTransform: "uppercase" }}>Label</div>
                <div />
              </div>

              {(settings.default_influencer_tiers || []).map((tier, idx) => (
                <div key={idx} style={{ display: "grid", gridTemplateColumns: "40px 1fr 1fr 1fr 1fr 40px", gap: 12, alignItems: "center", padding: 12, background: COLORS.darkBg, borderRadius: 10 }}>
                  <div style={{ fontWeight: 700, color: COLORS.neonBlue, fontSize: 14 }}>{idx + 1}</div>
                  <input
                    type="number"
                    min={1}
                    value={tier.min_signups}
                    disabled={!editing}
                    onChange={e => {
                      const updated = [...settings.default_influencer_tiers];
                      updated[idx] = { ...updated[idx], min_signups: Math.max(1, parseInt(e.target.value) || 1) };
                      setSettings({ ...settings, default_influencer_tiers: updated });
                    }}
                    style={{ padding: 10, background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, fontSize: 14, width: "100%" }}
                  />
                  {tier.max_signups === null ? (
                    <div style={{ padding: 10, background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.neonGreen, fontSize: 13, fontWeight: 600 }}>
                      Unlimited
                    </div>
                  ) : (
                    <input
                      type="number"
                      min={tier.min_signups}
                      value={tier.max_signups}
                      disabled={!editing}
                      onChange={e => {
                        const updated = [...settings.default_influencer_tiers];
                        updated[idx] = { ...updated[idx], max_signups: parseInt(e.target.value) || tier.min_signups };
                        setSettings({ ...settings, default_influencer_tiers: updated });
                      }}
                      style={{ padding: 10, background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, fontSize: 14, width: "100%" }}
                    />
                  )}
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: COLORS.neonYellow, fontWeight: 700, fontSize: 14 }}>$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      defaultValue={(tier.rate_cents / 100).toFixed(2)}
                      key={`settings-tier-rate-${idx}-${tier.rate_cents}`}
                      disabled={!editing}
                      onBlur={e => {
                        const val = parseFloat(e.target.value || "0");
                        if (isNaN(val) || val < 0) { e.target.value = (tier.rate_cents / 100).toFixed(2); return; }
                        const updated = [...settings.default_influencer_tiers];
                        updated[idx] = { ...updated[idx], rate_cents: Math.round(val * 100) };
                        setSettings({ ...settings, default_influencer_tiers: updated });
                        e.target.value = val.toFixed(2);
                      }}
                      style={{ padding: 10, paddingLeft: 24, background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.neonYellow, fontSize: 14, fontWeight: 600, width: "100%" }}
                    />
                  </div>
                  <input
                    type="text"
                    value={tier.label}
                    disabled={!editing}
                    onChange={e => {
                      const updated = [...settings.default_influencer_tiers];
                      updated[idx] = { ...updated[idx], label: e.target.value };
                      setSettings({ ...settings, default_influencer_tiers: updated });
                    }}
                    style={{ padding: 10, background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, fontSize: 14, width: "100%" }}
                  />
                  {editing && settings.default_influencer_tiers.length > 1 && (
                    <button
                      onClick={() => {
                        const updated = settings.default_influencer_tiers.filter((_, i) => i !== idx);
                        // If we removed a non-last tier, make the new last tier unlimited
                        if (idx === settings.default_influencer_tiers.length - 1 && updated.length > 0) {
                          updated[updated.length - 1] = { ...updated[updated.length - 1], max_signups: null };
                        }
                        // Re-index
                        const reindexed = updated.map((t, i) => ({ ...t, tier_index: i + 1 }));
                        setSettings({ ...settings, default_influencer_tiers: reindexed });
                      }}
                      style={{ padding: 6, background: "rgba(255,49,49,0.15)", border: "1px solid rgba(255,49,49,0.3)", borderRadius: 8, color: COLORS.neonRed, cursor: "pointer", fontSize: 16 }}
                      title="Remove tier"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Add Tier button */}
            {editing && (
              <button
                onClick={() => {
                  const tiers = settings.default_influencer_tiers || [];
                  const lastTier = tiers[tiers.length - 1];
                  const newMin = lastTier ? (lastTier.max_signups ?? lastTier.min_signups) + 1 : 1;
                  // Set current last tier's max_signups if it was unlimited
                  const updatedTiers = tiers.map((t, i) => {
                    if (i === tiers.length - 1 && t.max_signups === null) {
                      return { ...t, max_signups: newMin - 1 };
                    }
                    return t;
                  });
                  const newTier = {
                    tier_index: tiers.length + 1,
                    min_signups: newMin,
                    max_signups: null as number | null,
                    rate_cents: lastTier ? Math.max(lastTier.rate_cents - 500, 100) : 3000,
                    label: `Tier ${tiers.length + 1}`,
                  };
                  setSettings({ ...settings, default_influencer_tiers: [...updatedTiers, newTier] });
                }}
                style={{ padding: "10px 20px", background: "rgba(0,212,255,0.12)", border: "1px dashed " + COLORS.neonBlue, borderRadius: 10, color: COLORS.neonBlue, cursor: "pointer", fontWeight: 600, fontSize: 13 }}
              >
                + Add Tier
              </button>
            )}

            {/* Preview earnings example */}
            {(settings.default_influencer_tiers || []).length > 0 && (
              <div style={{ marginTop: 24, padding: 16, background: "rgba(57,255,20,0.06)", borderRadius: 12, border: "1px solid rgba(57,255,20,0.15)" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.neonGreen, marginBottom: 12 }}>Earnings Preview (100 signups)</div>
                <div style={{ display: "grid", gap: 6 }}>
                  {(() => {
                    const tiers = settings.default_influencer_tiers || [];
                    let totalCents = 0;
                    let remaining = 100;
                    let pos = 1;
                    const rows: { label: string; signups: number; rate: number; amount: number }[] = [];
                    for (const tier of tiers) {
                      if (remaining <= 0) break;
                      const tierMax = tier.max_signups ?? Infinity;
                      const start = Math.max(tier.min_signups, pos);
                      const end = Math.min(tierMax, 100);
                      if (start > end) continue;
                      const count = Math.min(end - start + 1, remaining);
                      const amount = count * tier.rate_cents;
                      rows.push({ label: tier.label, signups: count, rate: tier.rate_cents, amount });
                      totalCents += amount;
                      remaining -= count;
                      pos = end + 1;
                    }
                    return (
                      <>
                        {rows.map((r, i) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: COLORS.textSecondary }}>
                            <span>{r.label}: {r.signups} signups × ${(r.rate / 100).toFixed(2)}</span>
                            <span style={{ color: COLORS.neonYellow, fontWeight: 600 }}>${(r.amount / 100).toFixed(2)}</span>
                          </div>
                        ))}
                        <div style={{ borderTop: "1px solid " + COLORS.cardBorder, paddingTop: 8, marginTop: 4, display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700 }}>
                          <span>Total (100 signups)</span>
                          <span style={{ color: COLORS.neonGreen }}>${(totalCents / 100).toFixed(2)}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ==================== QUOTAS ==================== */}
      {settingsSection === "quotas" && (
        <div style={{ display: "grid", gap: 24 }}>
          {/* Edit/Save bar */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            {quotaEditing ? (
              <>
                <button onClick={() => { setQuotaEditing(false); setQuotaZoneEdits({}); setQuotaConfigEdits({}); setQuotaRateEdits({}); }} style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: "transparent", color: COLORS.textSecondary, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Cancel</button>
                <button onClick={handleSaveQuotas} disabled={quotaSaving} style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: COLORS.neonGreen, color: "#000", cursor: "pointer", fontSize: 13, fontWeight: 700, opacity: quotaSaving ? 0.6 : 1 }}>{quotaSaving ? "Saving..." : "Save All Changes"}</button>
              </>
            ) : (
              <button onClick={() => setQuotaEditing(true)} style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: COLORS.gradient1, color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Edit Quotas</button>
            )}
          </div>

          {/* Card 1: Division Signup Quotas */}
          <Card title="DIVISION SIGNUP QUOTAS">
            <div style={{ padding: 16, background: "rgba(0,212,255,0.08)", borderRadius: 12, marginBottom: 20, border: "1px solid rgba(0,212,255,0.2)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <span style={{ fontSize: 20 }}>🗺️</span>
                <div style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.5 }}>
                  Set <strong>daily</strong> signup quotas per division. Weekly, monthly, quarterly, and yearly are automatically calculated. These goals appear on the Executive dashboard and Sales page.
                </div>
              </div>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid " + COLORS.cardBorder }}>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Division</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>States</th>
                  <th style={{ textAlign: "right", padding: "10px 12px", color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Daily</th>
                  <th style={{ textAlign: "right", padding: "10px 12px", color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Weekly</th>
                  <th style={{ textAlign: "right", padding: "10px 12px", color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Monthly</th>
                  <th style={{ textAlign: "right", padding: "10px 12px", color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Quarterly</th>
                  <th style={{ textAlign: "right", padding: "10px 12px", color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Yearly</th>
                </tr>
              </thead>
              <tbody>
                {quotaZones.map(z => {
                  const daily = quotaZoneEdits[z.id] !== undefined ? quotaZoneEdits[z.id] : z.goal;
                  return (
                    <tr key={z.id} style={{ borderBottom: "1px solid " + COLORS.cardBorder }}>
                      <td style={{ padding: "12px 12px", fontWeight: 700, fontSize: 14 }}>{z.name}</td>
                      <td style={{ padding: "12px 12px", color: COLORS.textSecondary, fontSize: 11 }}>{(z.states || []).join(", ")}</td>
                      <td style={{ textAlign: "right", padding: "12px 12px" }}>
                        {quotaEditing ? (
                          <input type="number" value={daily} onChange={e => setQuotaZoneEdits(prev => ({ ...prev, [z.id]: parseInt(e.target.value) || 0 }))} style={{ width: 70, padding: "6px 10px", borderRadius: 8, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: "#fff", textAlign: "right", fontSize: 14, fontWeight: 700 }} />
                        ) : (
                          <span style={{ fontSize: 16, fontWeight: 800, color: COLORS.neonBlue }}>{daily}</span>
                        )}
                      </td>
                      <td style={{ textAlign: "right", padding: "12px 12px", color: "rgba(255,255,255,0.6)" }}>{(daily * 7).toLocaleString()}</td>
                      <td style={{ textAlign: "right", padding: "12px 12px", color: "rgba(255,255,255,0.6)" }}>{(daily * 30).toLocaleString()}</td>
                      <td style={{ textAlign: "right", padding: "12px 12px", color: "rgba(255,255,255,0.6)" }}>{(daily * 90).toLocaleString()}</td>
                      <td style={{ textAlign: "right", padding: "12px 12px", color: "rgba(255,255,255,0.6)" }}>{(daily * 365).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                {(() => {
                  const totalDaily = quotaZones.reduce((s, z) => s + (quotaZoneEdits[z.id] !== undefined ? quotaZoneEdits[z.id] : z.goal), 0);
                  return (
                    <tr style={{ borderTop: "2px solid " + COLORS.cardBorder, background: "rgba(255,255,255,0.03)" }}>
                      <td style={{ padding: "12px 12px", fontWeight: 800 }}>Total</td>
                      <td style={{ padding: "12px 12px", color: COLORS.textSecondary, fontSize: 11 }}>{quotaZones.reduce((s, z) => s + (z.states || []).length, 0)} states</td>
                      <td style={{ textAlign: "right", padding: "12px 12px", fontWeight: 800, fontSize: 16, color: COLORS.neonBlue }}>{totalDaily}</td>
                      <td style={{ textAlign: "right", padding: "12px 12px", fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>{(totalDaily * 7).toLocaleString()}</td>
                      <td style={{ textAlign: "right", padding: "12px 12px", fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>{(totalDaily * 30).toLocaleString()}</td>
                      <td style={{ textAlign: "right", padding: "12px 12px", fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>{(totalDaily * 90).toLocaleString()}</td>
                      <td style={{ textAlign: "right", padding: "12px 12px", fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>{(totalDaily * 365).toLocaleString()}</td>
                    </tr>
                  );
                })()}
              </tfoot>
            </table>
          </Card>

          {/* Card 2: Sales Rep Quotas */}
          <Card title="SALES REP QUOTAS (DEFAULTS)">
            <div style={{ padding: 16, background: "rgba(57,255,20,0.08)", borderRadius: 12, marginBottom: 20, border: "1px solid rgba(57,255,20,0.2)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <span style={{ fontSize: 20 }}>🎯</span>
                <div style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.5 }}>
                  Set <strong>daily</strong> targets. Weekly, monthly, quarterly, and yearly are automatically calculated. Individual overrides can be set per rep in the Overrides section below.
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              {[
                { quotaKey: "rep_quota_daily", bonusKey: "rep_bonus_daily", label: "Sales Rep", desc: "Ground-floor reps", icon: "👤", color: COLORS.neonGreen, fallbackQuota: "individual_daily", fallbackBonus: "bonus_eligibility_daily", defaultQuota: 200, defaultBonus: 100 },
                { quotaKey: "lead_quota_daily", bonusKey: "lead_bonus_daily", label: "Team Lead", desc: "Leads on the ground + training", icon: "👥", color: COLORS.neonBlue, fallbackQuota: "individual_daily", fallbackBonus: "bonus_eligibility_daily", defaultQuota: 200, defaultBonus: 100 },
                { quotaKey: "training_quota_daily", bonusKey: "training_bonus_daily", label: "In Training", desc: "New reps in training", icon: "🎓", color: COLORS.neonPurple, fallbackQuota: null, fallbackBonus: null, defaultQuota: 100, defaultBonus: 50 },
              ].map(item => {
                const rawQuota = quotaConfigEdits[item.quotaKey] !== undefined ? quotaConfigEdits[item.quotaKey] : (getQuotaConfig(item.quotaKey, "cents") || (item.fallbackQuota ? getQuotaConfig(item.fallbackQuota, "cents") : 0) || item.defaultQuota);
                const rawBonus = quotaConfigEdits[item.bonusKey] !== undefined ? quotaConfigEdits[item.bonusKey] : (getQuotaConfig(item.bonusKey, "cents") || (item.fallbackBonus ? getQuotaConfig(item.fallbackBonus, "cents") : 0) || item.defaultBonus);
                const quotaVal = rawQuota / 100;
                const bonusVal = rawBonus / 100;
                return (
                  <div key={item.quotaKey} style={{ padding: 20, background: COLORS.darkBg, borderRadius: 12, border: "1px solid " + COLORS.cardBorder }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                      <span style={{ fontSize: 18 }}>{item.icon}</span>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{item.label}</div>
                        <div style={{ fontSize: 11, color: COLORS.textSecondary }}>{item.desc}</div>
                      </div>
                    </div>

                    {/* Daily Quota */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 10, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>Daily Signup Quota</div>
                      {quotaEditing ? (
                        <input type="number" step="0.1" value={quotaVal} onChange={e => setQuotaConfigEdits(prev => ({ ...prev, [item.quotaKey]: Math.round(parseFloat(e.target.value || "0") * 100) }))} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid " + COLORS.cardBorder, background: COLORS.cardBg, color: "#fff", fontSize: 22, fontWeight: 800, textAlign: "center" }} />
                      ) : (
                        <div style={{ fontSize: 28, fontWeight: 900, color: item.color, textAlign: "center" }}>{quotaVal % 1 === 0 ? quotaVal : parseFloat(quotaVal.toFixed(2))}</div>
                      )}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                        {[{ label: "Weekly", mult: 7 }, { label: "Monthly", mult: 30 }, { label: "Quarterly", mult: 90 }, { label: "Yearly", mult: 365 }].map(p => (
                          <div key={p.label} style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 9, color: COLORS.textSecondary, marginBottom: 1 }}>{p.label}</div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>{Math.round(quotaVal * p.mult).toLocaleString()}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Bonus Eligibility */}
                    <div style={{ padding: "12px 0 0", borderTop: "1px solid " + COLORS.cardBorder }}>
                      <div style={{ fontSize: 10, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>Bonus Eligibility (daily min)</div>
                      {quotaEditing ? (
                        <input type="number" step="0.1" value={bonusVal} onChange={e => setQuotaConfigEdits(prev => ({ ...prev, [item.bonusKey]: Math.round(parseFloat(e.target.value || "0") * 100) }))} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid " + COLORS.cardBorder, background: COLORS.cardBg, color: "#fff", fontSize: 22, fontWeight: 800, textAlign: "center" }} />
                      ) : (
                        <div style={{ fontSize: 28, fontWeight: 900, color: COLORS.neonYellow, textAlign: "center" }}>{bonusVal % 1 === 0 ? bonusVal : parseFloat(bonusVal.toFixed(2))}</div>
                      )}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                        {[{ label: "Weekly", mult: 7 }, { label: "Monthly", mult: 30 }, { label: "Quarterly", mult: 90 }, { label: "Yearly", mult: 365 }].map(p => (
                          <div key={p.label} style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 9, color: COLORS.textSecondary, marginBottom: 1 }}>{p.label}</div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>{Math.round(bonusVal * p.mult).toLocaleString()}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Card 3: Commission Rates */}
          <Card title="COMMISSION RATES">
            <div style={{ padding: 16, background: "rgba(255,45,146,0.08)", borderRadius: 12, marginBottom: 20, border: "1px solid rgba(255,45,146,0.2)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <span style={{ fontSize: 20 }}>💰</span>
                <div style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.5 }}>
                  Commission paid to sales reps per signup type. Advertising commission is calculated per $100 of ad spend sold.
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              {[
                { key: "basic_signup", label: "Basic Signup", desc: "Per basic plan signup", icon: "📋" },
                { key: "premium_signup", label: "Premium Signup", desc: "Per premium plan signup", icon: "⭐" },
                { key: "advertising_per_100", label: "Advertising / $100", desc: "Per $100 ad spend sold", icon: "📺" },
              ].map(item => {
                const val = quotaRateEdits[item.key] !== undefined ? quotaRateEdits[item.key] : getQuotaConfig(item.key, "cents");
                return (
                  <div key={item.key} style={{ padding: 20, background: COLORS.darkBg, borderRadius: 12, border: "1px solid " + COLORS.cardBorder }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <span style={{ fontSize: 18 }}>{item.icon}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{item.label}</div>
                        <div style={{ fontSize: 11, color: COLORS.textSecondary }}>{item.desc}</div>
                      </div>
                    </div>
                    {quotaEditing ? (
                      <div style={{ position: "relative" }}>
                        <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 20, fontWeight: 800, color: COLORS.textSecondary }}>$</span>
                        <input type="number" step="0.01" value={(val / 100).toFixed(2)} onChange={e => setQuotaRateEdits(prev => ({ ...prev, [item.key]: Math.round(parseFloat(e.target.value || "0") * 100) }))} style={{ width: "100%", padding: "10px 14px 10px 32px", borderRadius: 8, border: "1px solid " + COLORS.cardBorder, background: COLORS.cardBg, color: "#fff", fontSize: 24, fontWeight: 800, textAlign: "center" }} />
                      </div>
                    ) : (
                      <div style={{ fontSize: 32, fontWeight: 900, color: COLORS.neonPink, textAlign: "center" }}>${(val / 100).toFixed(2)}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Card 4: Active Quota Overrides */}
          <Card title="ACTIVE QUOTA OVERRIDES">
            <div style={{ padding: 16, background: "rgba(191,95,255,0.08)", borderRadius: 12, marginBottom: 20, border: "1px solid rgba(191,95,255,0.2)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <span style={{ fontSize: 20 }}>📝</span>
                <div style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.5 }}>
                  Per-rep, per-team, or per-division overrides. These take priority over the defaults above. Manage overrides from the Sales page Quotas tab.
                </div>
              </div>
            </div>
            {quotaOverrides.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", color: COLORS.textSecondary, fontSize: 14 }}>No active overrides. Use the Sales page to add per-rep or per-division overrides.</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid " + COLORS.cardBorder }}>
                    <th style={{ textAlign: "left", padding: "10px 12px", color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Type</th>
                    <th style={{ textAlign: "left", padding: "10px 12px", color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Target</th>
                    <th style={{ textAlign: "right", padding: "10px 12px", color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Quota</th>
                    <th style={{ textAlign: "left", padding: "10px 12px", color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Period</th>
                    <th style={{ textAlign: "right", padding: "10px 12px", color: COLORS.textSecondary, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {quotaOverrides.map(o => (
                    <tr key={o.id} style={{ borderBottom: "1px solid " + COLORS.cardBorder }}>
                      <td style={{ padding: "10px 12px", textTransform: "capitalize" }}>
                        <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: o.target_type === "individual" ? "rgba(0,212,255,0.15)" : o.target_type === "team" ? "rgba(57,255,20,0.15)" : "rgba(255,45,146,0.15)", color: o.target_type === "individual" ? COLORS.neonBlue : o.target_type === "team" ? COLORS.neonGreen : COLORS.neonPink }}>{o.target_type}</span>
                      </td>
                      <td style={{ padding: "10px 12px", fontWeight: 600 }}>
                        {o.target_type === "division" ? (quotaZoneNames[o.target_id] || o.target_id) : (quotaRepNames[o.target_id] || o.target_id)}
                      </td>
                      <td style={{ textAlign: "right", padding: "10px 12px", fontWeight: 800, color: COLORS.neonPurple, fontSize: 15 }}>{o.quota}</td>
                      <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 12, color: COLORS.textSecondary }}>{o.period}</td>
                      <td style={{ textAlign: "right", padding: "10px 12px" }}>
                        <button onClick={() => handleDeleteOverride(o.id)} style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid rgba(255,49,49,0.3)", background: "rgba(255,49,49,0.1)", color: "#ff4444", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}

      {/* ==================== MAINTENANCE ==================== */}
      {settingsSection === "maintenance" && (
        <div style={{ display: "grid", gap: 24 }}>
          <Card title="MAINTENANCE MODE" actions={
            <span style={{
              padding: "6px 14px", borderRadius: 8, fontSize: 11, fontWeight: 700,
              background: settings.maintenance_enabled ? "rgba(255,107,53,0.2)" : "rgba(57,255,20,0.2)",
              color: settings.maintenance_enabled ? COLORS.neonOrange : COLORS.neonGreen,
            }}>
              {settings.maintenance_enabled ? "ENABLED" : "DISABLED"}
            </span>
          }>
            <div style={{ padding: 16, background: "rgba(255,107,53,0.1)", borderRadius: 12, marginBottom: 20, border: "1px solid " + COLORS.neonOrange }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <span style={{ fontSize: 24 }}>⚠️</span>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4, color: COLORS.neonOrange }}>What is Maintenance Mode?</div>
                  <div style={{ fontSize: 12, color: COLORS.textSecondary }}>
                    When enabled, users will see a maintenance message instead of the app. Use this during planned downtime, major updates, or emergency situations.
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gap: 20 }}>
              {/* Enable Maintenance Mode */}
              <div style={{ padding: 20, background: COLORS.darkBg, borderRadius: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 16 }}>Enable Maintenance Mode</div>
                    <div style={{ fontSize: 12, color: COLORS.textSecondary }}>App will be inaccessible to users</div>
                  </div>
                  <div
                    style={{
                      width: 56, height: 28, borderRadius: 28,
                      background: settings.maintenance_enabled ? COLORS.neonOrange : COLORS.cardBorder,
                      position: "relative", cursor: "pointer",
                    }}
                    onClick={() => {
                      const msg = settings.maintenance_enabled
                        ? "Disable maintenance mode? The app will be accessible to users again."
                        : "Enable maintenance mode? Users will not be able to access the app.";
                      if (confirm(msg)) {
                        const newEnabled = !settings.maintenance_enabled;
                        const historyEntry = {
                          date: new Date().toISOString(),
                          action: newEnabled ? "Maintenance mode ENABLED" : "Maintenance mode DISABLED",
                          by: currentStaffId || "unknown",
                        };
                        setSettings({
                          ...settings,
                          maintenance_enabled: newEnabled,
                          maintenance_history: [historyEntry, ...(settings.maintenance_history || [])].slice(0, 50),
                        });
                        setEditing(true);
                      }
                    }}
                  >
                    <div style={{ position: "absolute", top: 2, left: settings.maintenance_enabled ? 30 : 2, width: 24, height: 24, background: "#fff", borderRadius: "50%", transition: "0.3s" }} />
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase", fontWeight: 600 }}>Maintenance Message</label>
                  <textarea
                    value={settings.maintenance_message}
                    onChange={e => setSettings({ ...settings, maintenance_message: e.target.value })}
                    style={{ width: "100%", padding: 14, background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, fontSize: 14, minHeight: 80, resize: "vertical" }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase", fontWeight: 600 }}>Estimated Duration</label>
                    <select defaultValue="1" style={{ width: "100%", padding: 12, background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, fontSize: 14 }}>
                      <option value="0.5">30 minutes</option>
                      <option value="1">1 hour</option>
                      <option value="2">2 hours</option>
                      <option value="4">4 hours</option>
                      <option value="8">8 hours</option>
                      <option value="24">24 hours</option>
                      <option value="unknown">Unknown</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase", fontWeight: 600 }}>Show Countdown</label>
                    <select defaultValue="yes" style={{ width: "100%", padding: 12, background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, fontSize: 14 }}>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Schedule Maintenance */}
              <div style={{ padding: 20, background: COLORS.darkBg, borderRadius: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>Schedule Maintenance Window</div>
                  {settings.scheduled_maintenance && (
                    <span style={{ padding: "4px 10px", background: "rgba(0,212,255,0.15)", borderRadius: 6, fontSize: 10, color: COLORS.neonBlue, fontWeight: 600 }}>
                      Scheduled: {settings.scheduled_maintenance.date} at {settings.scheduled_maintenance.time}
                    </span>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase", fontWeight: 600 }}>Start Date</label>
                    <input
                      type="date"
                      value={schedDate}
                      onChange={e => setSchedDate(e.target.value)}
                      style={{ width: "100%", padding: 12, background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, fontSize: 14 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase", fontWeight: 600 }}>Start Time</label>
                    <input
                      type="time"
                      value={schedTime}
                      onChange={e => setSchedTime(e.target.value)}
                      style={{ width: "100%", padding: 12, background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, fontSize: 14 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase", fontWeight: 600 }}>Duration</label>
                    <select
                      value={schedDuration}
                      onChange={e => setSchedDuration(e.target.value)}
                      style={{ width: "100%", padding: 12, background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textPrimary, fontSize: 14 }}
                    >
                      <option value="0.5">30 min</option>
                      <option value="1">1 hour</option>
                      <option value="2">2 hours</option>
                      <option value="4">4 hours</option>
                    </select>
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={schedNotify}
                      onChange={e => setSchedNotify(e.target.checked)}
                      style={{ width: 18, height: 18 }}
                    />
                    <span style={{ fontSize: 13 }}>Send advance notice to users (24 hours before)</span>
                  </label>
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <button
                    onClick={() => {
                      if (!schedDate) { alert("Please select a start date."); return; }
                      const scheduled = { date: schedDate, time: schedTime, duration_hours: parseFloat(schedDuration), notify_advance: schedNotify };
                      setSettings({ ...settings, scheduled_maintenance: scheduled });
                      setEditing(true);
                      alert(`Maintenance scheduled for ${schedDate} at ${schedTime}. Click "Save Changes" to persist.`);
                    }}
                    style={{ padding: "12px 24px", background: COLORS.gradient1, border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontWeight: 700 }}
                  >
                    Schedule Maintenance
                  </button>
                  {settings.scheduled_maintenance && (
                    <button
                      onClick={() => {
                        if (confirm("Clear the scheduled maintenance window?")) {
                          setSettings({ ...settings, scheduled_maintenance: null });
                          setSchedDate("");
                          setSchedTime("02:00");
                          setSchedDuration("2");
                          setSchedNotify(true);
                          setEditing(true);
                        }
                      }}
                      style={{ padding: "12px 24px", background: "rgba(255,49,49,0.15)", border: "1px solid " + COLORS.neonRed, borderRadius: 10, color: COLORS.neonRed, cursor: "pointer", fontWeight: 600 }}
                    >
                      Clear Schedule
                    </button>
                  )}
                </div>
              </div>

              {/* Maintenance History */}
              <div style={{ padding: 20, background: COLORS.darkBg, borderRadius: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>Recent Maintenance History</div>
                <div style={{ display: "grid", gap: 8 }}>
                  {settings.maintenance_history && settings.maintenance_history.length > 0 ? (
                    settings.maintenance_history.slice(0, 10).map((entry, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 12, background: COLORS.cardBg, borderRadius: 8 }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{entry.action}</div>
                          <div style={{ fontSize: 11, color: COLORS.textSecondary }}>
                            {new Date(entry.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            {" • "}
                            {new Date(entry.date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                          </div>
                        </div>
                        <div style={{ fontSize: 11, color: COLORS.neonBlue }}>
                          {entry.by ? `Staff #${entry.by.slice(-6).toUpperCase()}` : "System"}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: 16, textAlign: "center", color: COLORS.textSecondary, fontSize: 12 }}>
                      No maintenance events recorded yet. Events are logged when maintenance mode is toggled.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* System Information */}
          <Card title="SYSTEM INFORMATION">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 20 }}>
              {[
                { label: "Platform", value: "Next.js 16", color: COLORS.neonBlue },
                { label: "Database", value: "Supabase", color: COLORS.neonGreen },
                { label: "Auth", value: "Supabase Auth", color: COLORS.neonPurple },
              ].map(item => (
                <div key={item.label} style={{ padding: 20, background: COLORS.darkBg, borderRadius: 12, textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: item.color }}>{item.value}</div>
                </div>
              ))}
            </div>

            <div style={{ padding: 20, background: COLORS.darkBg, borderRadius: 12, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Settings Last Updated</div>
              {settings.updated_at ? (
                <div>
                  <div style={{ fontSize: 14 }}>{new Date(settings.updated_at).toLocaleString()}</div>
                  {settings.updated_by && <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 4, fontFamily: "monospace" }}>By: #{settings.updated_by.slice(-6).toUpperCase()}</div>}
                </div>
              ) : (
                <div style={{ color: COLORS.textSecondary, fontSize: 13 }}>Using default settings (never saved to database)</div>
              )}
            </div>

            <button
              onClick={() => { setSettings(DEFAULT_SETTINGS); alert("Settings reset to defaults. Click 'Save Changes' to persist."); setEditing(true); }}
              style={{ padding: "12px 20px", background: "rgba(255,107,53,0.15)", border: "1px solid " + COLORS.neonOrange, borderRadius: 10, color: COLORS.neonOrange, cursor: "pointer", fontWeight: 600, fontSize: 13 }}
            >
              Reset to Defaults
            </button>
          </Card>
        </div>
      )}
    </div>
  );
}
