"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import {
  fetchPlatformTierConfig,
  getVisitRangeShort,
  thresholdsToTierConfig,
  DEFAULT_VISIT_THRESHOLDS,
  DEFAULT_PRESET_BPS,
  type PlatformTierConfig,
} from "@/lib/platformSettings";
import {
  COLORS,
  Badge,
  Card,
  SectionTitle,
  EditField,
  PhoneField,
  AddressField,
  HoursGrid,
  Checklist,
  Tags,
  MediaGrid,
  MediaGridManaged,
  PreviewModal,
  ConfirmModal,
  CollapsibleSection,
  PremiumAddons,
  formatDate,
  formatMoney,
} from "@/components/admin/components";
import { logAudit, AUDIT_TABS } from "@/lib/auditLog";
import { fetchTagsByCategory, type TagCategory } from "@/lib/availableTags";

interface Business {
  id: string;
  business_name: string | null;
  public_business_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  city: string | null;
  state: string | null;
  billing_plan: string | null;
  is_active: boolean;
  created_at: string;
  business_type: string | null;
  street_address: string | null;
  zip: string | null;
  website: string | null;
  description: string | null;
  cuisine_type: string | null;
  price_level: string | null;
  age_restriction: string | null;
  customer_email: string | null;
  rep_name: string | null;
  rep_title: string | null;
  rep_email: string | null;
  rep_phone: string | null;
  login_email: string | null;
  login_phone: string | null;
  payment_method: string | null;
  bank_name: string | null;
  account_type: string | null;
  routing_last4: string | null;
  account_last4: string | null;
  card_brand: string | null;
  card_last4: string | null;
  payout_preset: string | null;
  payout_tiers: number[] | null;
  custom_payout_tiers: number[] | null;
  has_custom_tiers: boolean | null;
  payout_changes_this_year: number | null;
  payout_change_limit: number | null;
  payout_staff_override: boolean | null;
  verifier_name: string | null;
  verifier_email: string | null;
  verifier_phone: string | null;
  auto_approval_enabled: boolean | null;
  auto_approval_max: number | null;
  billing_address: string | null;
  billing_email: string | null;
  internal_notes: string | null;
  hours: Record<string, { enabled?: boolean; open?: string; close?: string }> | null;
  // Standalone hour columns (DB source of truth)
  mon_open: string | null;
  mon_close: string | null;
  tue_open: string | null;
  tue_close: string | null;
  wed_open: string | null;
  wed_close: string | null;
  thu_open: string | null;
  thu_close: string | null;
  fri_open: string | null;
  fri_close: string | null;
  sat_open: string | null;
  sat_close: string | null;
  sun_open: string | null;
  sun_close: string | null;
  tags: string[] | null;
  marketing_permissions: { userUploads?: boolean; featureInDiscovery?: boolean; abTesting?: boolean } | null;
  addons: { videoAddon?: boolean; liveAddon15?: boolean; liveAddon30?: boolean } | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: Record<string, any> | null;
  logo_url: string | null;
  cover_image_url: string | null;
  photos: { id?: string; name?: string; url?: string; status?: "active" | "paused" | "removed"; uploaded_at?: string }[] | null;
  videos: { id?: string; name?: string; url?: string; status?: "active" | "paused" | "removed"; uploaded_at?: string }[] | null;
  total_receipts: number | null;
  total_payout_cents: number | null;
  active_customers: number | null;
  avg_receipt_amount: number | null;
  ad_spend_total: number | null;
  status: string | null;
}

type StatusFilter = "all" | "active" | "paused" | "suspended" | "submitted";

export default function BusinessesPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0f0f1a]" />}>
      <BusinessesPage />
    </Suspense>
  );
}

function BusinessesPage() {
  const searchParams = useSearchParams();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("selected"));
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedBusiness, setEditedBusiness] = useState<Partial<Business>>({});
  const [preview, setPreview] = useState<{ url: string; type: string } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    type: "info" | "warning" | "danger";
    confirmText: string;
    onConfirm: () => void;
  } | null>(null);
  const [advancedFilters, setAdvancedFilters] = useState({
    zipCode: "",
    phone: "",
    dateFrom: "",
    dateTo: "",
  });
  const [pkgPricing, setPkgPricing] = useState<{
    addon_video_5_monthly_cents: number;
    addon_live_15_monthly_cents: number;
    addon_live_30_monthly_cents: number;
    tpms_monthly_cents: number;
  } | null>(null);
  const [realPayoutTiers, setRealPayoutTiers] = useState<number[]>([]);
  const [platformTierConfig, setPlatformTierConfig] = useState<PlatformTierConfig>({
    visitThresholds: DEFAULT_VISIT_THRESHOLDS,
    presetBps: { ...DEFAULT_PRESET_BPS },
    defaultCashbackBps: [500, 750, 1000, 1250, 1500, 1750, 2000],
  });
  const [tierChangeHistory, setTierChangeHistory] = useState<{
    id: string;
    previous_preset: string | null;
    new_preset: string | null;
    previous_tiers: number[] | null;
    new_tiers: number[] | null;
    changed_by: string;
    created_at: string;
  }[]>([]);
  const [adCampaigns, setAdCampaigns] = useState<{
    id: string;
    campaign_type: string;
    start_date: string;
    end_date: string;
    status: string;
    price_cents: number;
    paid: boolean;
    meta: Record<string, unknown> | null;
    promo_text: string | null;
  }[]>([]);
  const [liveMetrics, setLiveMetrics] = useState<{
    totalReceipts: number;
    totalPayoutCents: number;
    activeCustomers: number;
    avgReceiptCents: number;
  } | null>(null);

  const selected = businesses.find((b) => b.id === selectedId) || null;

  // DB-driven tag categories for dropdowns
  const [tagCats, setTagCats] = useState<TagCategory[]>([]);
  useEffect(() => { fetchTagsByCategory("business").then(setTagCats).catch(() => {}); }, []);

  const businessTypeOptions = React.useMemo(() => {
    const bt = tagCats.find(c => c.name === "Business Type");
    if (!bt || bt.tags.length === 0) {
      return [
        { value: "", label: "Select..." },
        { value: "restaurant_bar", label: "Restaurant/Bar" },
        { value: "salon_beauty", label: "Salon/Beauty" },
        { value: "retail", label: "Retail" },
        { value: "activity", label: "Activity" },
        { value: "event_venue", label: "Event Venue" },
        { value: "other", label: "Other" },
      ];
    }
    return [
      { value: "", label: "Select..." },
      ...bt.tags.map(t => ({ value: t.name.toLowerCase().replace(/[/ ]/g, "_"), label: `${t.icon || ""} ${t.name}`.trim() })),
    ];
  }, [tagCats]);

  const cuisineTypeOptions = React.useMemo(() => {
    const cu = tagCats.find(c => c.name === "Cuisine");
    if (!cu || cu.tags.length === 0) {
      return [
        { value: "", label: "Select..." },
        { value: "american", label: "American" },
        { value: "italian", label: "Italian" },
        { value: "mexican", label: "Mexican" },
        { value: "asian", label: "Asian" },
        { value: "seafood", label: "Seafood" },
        { value: "bakery", label: "Bakery" },
        { value: "coffee", label: "Coffee" },
        { value: "bar", label: "Bar" },
        { value: "other", label: "Other" },
      ];
    }
    return [
      { value: "", label: "Select..." },
      ...cu.tags.map(t => ({ value: t.name.toLowerCase(), label: t.name })),
    ];
  }, [tagCats]);

  // When entering edit mode or selecting a new business, reset edited state
  useEffect(() => {
    if (selected && isEditing) {
      setEditedBusiness({});
    }
  }, [selectedId, isEditing]);

  // Fetch ad campaigns and live metrics when a business is selected
  useEffect(() => {
    if (!selectedId) return;
    // Ad campaigns
    supabaseBrowser
      .from("business_ad_campaigns")
      .select("id, campaign_type, start_date, end_date, status, price_cents, paid, meta, promo_text")
      .eq("business_id", selectedId)
      .order("created_at", { ascending: false })
      .then(({ data }) => setAdCampaigns(data || []));

    // Real payout tiers from business_payout_tiers table (source of truth)
    supabaseBrowser
      .from("business_payout_tiers")
      .select("tier_index, percent_bps")
      .eq("business_id", selectedId)
      .order("tier_index", { ascending: true })
      .then(({ data }) => {
        if (data && data.length > 0) {
          setRealPayoutTiers(data.map((t) => t.percent_bps));
        } else {
          setRealPayoutTiers([]);
        }
      });

    // Payout tier change history
    supabaseBrowser
      .from("payout_tier_changes")
      .select("id, previous_preset, new_preset, previous_tiers, new_tiers, changed_by, created_at")
      .eq("business_id", selectedId)
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => setTierChangeHistory(data || []));

    // Live metrics from receipts
    supabaseBrowser
      .from("receipts")
      .select("id, payout_cents, receipt_total_cents, user_id, status")
      .eq("business_id", selectedId)
      .then(({ data }) => {
        if (!data) return;
        const approved = data.filter((r) => r.status === "approved");
        const recentUsers = new Set(
          data.filter((r) => r.status === "approved").map((r) => r.user_id)
        );
        const totalPayout = approved.reduce((s, r) => s + (r.payout_cents || 0), 0);
        const totalReceipt = approved.reduce((s, r) => s + (r.receipt_total_cents || 0), 0);
        setLiveMetrics({
          totalReceipts: data.length,
          totalPayoutCents: totalPayout,
          activeCustomers: recentUsers.size,
          avgReceiptCents: approved.length > 0 ? Math.round(totalReceipt / approved.length) : 0,
        });
      });

    // Load media from business_media table via server API (bypasses RLS)
    supabaseBrowser.auth.getSession().then(({ data: { session } }) => {
      const authToken = session?.access_token || "";
      fetch(`/api/admin/businesses/media?businessId=${selectedId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      .then((res) => res.json())
      .then((mediaData: { photos?: { id: string; name: string; url: string; status: "active" | "paused" | "removed"; uploaded_at: string }[]; videos?: { id: string; name: string; url: string; status: "active" | "paused" | "removed"; uploaded_at: string }[] }) => {
        if (mediaData.photos || mediaData.videos) {
          setBusinesses((prev) =>
            prev.map((b) =>
              b.id === selectedId
                ? {
                    ...b,
                    photos: mediaData.photos && mediaData.photos.length > 0 ? mediaData.photos : b.photos,
                    videos: mediaData.videos && mediaData.videos.length > 0 ? mediaData.videos : b.videos,
                  }
                : b
            )
          );
        }
      })
      .catch((err) => console.error("[admin-businesses] Media load warning:", err));
    });
  }, [selectedId]);

  // Helper to get the current value (edited or original)
  const getValue = (field: keyof Business) => {
    if (editedBusiness[field] !== undefined) return editedBusiness[field];
    return selected?.[field];
  };

  // Helper to update a field
  const updateField = (field: keyof Business, value: unknown) => {
    setEditedBusiness(prev => ({ ...prev, [field]: value }));
  };

  // Rep fields: config JSONB is the source of truth (business profile writes there).
  // Fall back to top-level column for businesses that haven't published yet.
  function getRepValue(configKey: string, columnKey: keyof Business): string {
    // Check edited state first
    const editedConfig = editedBusiness.config as Record<string, unknown> | undefined;
    if (editedConfig?.[configKey] !== undefined) return String(editedConfig[configKey] ?? "");
    if (editedBusiness[columnKey] !== undefined) return String(editedBusiness[columnKey] ?? "");
    // Then check current data: config first, column fallback
    const cfg = (selected?.config ?? {}) as Record<string, unknown>;
    const fromConfig = cfg[configKey];
    if (fromConfig) return String(fromConfig);
    return String(selected?.[columnKey] ?? "");
  }

  // Update rep field in both config JSONB and top-level column
  function updateRepField(configKey: string, columnKey: keyof Business, value: string) {
    setEditedBusiness(prev => {
      const currentConfig = (prev.config ?? (selected?.config as Record<string, unknown>) ?? {}) as Record<string, unknown>;
      return {
        ...prev,
        [columnKey]: value,
        config: { ...currentConfig, [configKey]: value },
      };
    });
  }

  // Build hours from all sources: standalone columns (primary) → config.hours (fallback)
  const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

  // Strip seconds from DB time values: "16:59:00" → "16:59"
  function trimTime(t: string | null): string {
    if (!t) return "";
    // Match HH:MM:SS and strip :SS
    return t.replace(/^(\d{2}:\d{2}):\d{2}$/, "$1");
  }

  function getResolvedHours(): Record<string, { enabled?: boolean; open?: string; close?: string }> {
    const result: Record<string, { enabled?: boolean; open?: string; close?: string }> = {};

    for (const day of DAY_KEYS) {
      const openCol = getValue(`${day}_open` as keyof Business) as string | null;
      const closeCol = getValue(`${day}_close` as keyof Business) as string | null;

      if (openCol || closeCol) {
        result[day] = {
          enabled: !!openCol,
          open: trimTime(openCol),
          close: trimTime(closeCol),
        };
      }
      // else: day has no hours data, leave it out (HoursGrid handles missing days)
    }
    return result;
  }

  // Write hours to standalone day columns (single source of truth)
  function handleHoursChange(newHours: Record<string, { enabled?: boolean; open?: string; close?: string }>) {
    for (const day of DAY_KEYS) {
      const h = newHours[day];
      if (h && h.enabled) {
        // Default to 09:00/17:00 if enabled but times are empty
        updateField(`${day}_open` as keyof Business, h.open || "09:00");
        updateField(`${day}_close` as keyof Business, h.close || "17:00");
      } else {
        updateField(`${day}_open` as keyof Business, null);
        updateField(`${day}_close` as keyof Business, null);
      }
    }
  }

  // Derive status from is_active and status field
  function getStatus(b: Business): string {
    if (b.status) return b.status;
    return b.is_active ? "active" : "paused";
  }

  // Filter businesses
  const filtered = businesses.filter((b) => {
    const status = getStatus(b);
    if (statusFilter !== "all" && status !== statusFilter) return false;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const searchable = [b.business_name, b.public_business_name, b.contact_email, b.city, b.state]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!searchable.includes(query)) return false;
    }

    if (advancedFilters.zipCode && b.zip !== advancedFilters.zipCode) return false;
    if (advancedFilters.phone && !b.contact_phone?.includes(advancedFilters.phone)) return false;
    if (advancedFilters.dateFrom && b.created_at < advancedFilters.dateFrom) return false;
    if (advancedFilters.dateTo && b.created_at.slice(0, 10) > advancedFilters.dateTo) return false;

    return true;
  });

  async function fetchBusinesses() {
    setLoading(true);
    try {
      const { data, error } = await supabaseBrowser
        .from("business")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setBusinesses(data || []);

      if (!selectedId && data && data.length > 0) {
        setSelectedId(data[0].id);
      }
    } catch (err) {
      console.error("Error fetching businesses:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchBusinesses();
    // Fetch dynamic pricing + visit thresholds from platform_settings
    supabaseBrowser
      .from("platform_settings")
      .select("package_pricing")
      .eq("id", 1)
      .single()
      .then(({ data }) => {
        if (data?.package_pricing) {
          setPkgPricing(data.package_pricing as typeof pkgPricing);
        }
      });
    fetchPlatformTierConfig(supabaseBrowser).then(setPlatformTierConfig);
  }, []);

  async function handleStatusChange(newStatus: string) {
    if (!selected) return;

    try {
      const updates: Partial<Business> = {
        status: newStatus,
        is_active: newStatus === "active",
      };

      const { error } = await supabaseBrowser.from("business").update(updates).eq("id", selected.id);

      if (error) {
        alert("Error: " + error.message);
        return;
      }

      logAudit({
        action: "update_business_status",
        tab: AUDIT_TABS.BUSINESSES,
        subTab: "Business Status",
        targetType: "business",
        targetId: selected.id,
        entityName: selected.public_business_name || selected.business_name || "Unnamed",
        fieldName: "status",
        oldValue: status,
        newValue: newStatus,
        details: `Status changed from "${status}" to "${newStatus}"`,
      });

      await fetchBusinesses();
    } catch (err) {
      console.error("Status change error:", err);
    }
  }

  async function handleSaveChanges() {
    if (!selected) return;
    
    // Check if any changes were made
    if (Object.keys(editedBusiness).length === 0) {
      alert("No changes to save.");
      setIsEditing(false);
      return;
    }
    
    try {
      // Dual-write so admin and business profile columns stay in sync
      const updates = { ...editedBusiness } as Record<string, unknown>;
      if (updates.contact_phone !== undefined) updates.business_phone = updates.contact_phone;
      if (updates.business_phone !== undefined) updates.contact_phone = updates.business_phone;
      if (updates.description !== undefined) updates.blurb = updates.description;
      if (updates.blurb !== undefined) updates.description = updates.blurb;
      if (updates.cuisine_type !== undefined) updates.category_main = updates.cuisine_type;
      if (updates.category_main !== undefined) updates.cuisine_type = updates.category_main;
      // Sync business_type column ↔ config.businessType so all pages stay aligned
      if (updates.business_type !== undefined) {
        const existCfg = (updates.config as Record<string, unknown> ?? (selected.config ?? {})) as Record<string, unknown>;
        updates.config = { ...existCfg, businessType: updates.business_type };
      }
      if (updates.login_email !== undefined) {
        const existCfg = (selected.config ?? {}) as Record<string, unknown>;
        updates.config = { ...existCfg, ...(updates.config as Record<string, unknown> ?? {}), loginEmail: updates.login_email };
      }
      if (updates.login_phone !== undefined) {
        const existCfg = (updates.config as Record<string, unknown> ?? (selected.config ?? {})) as Record<string, unknown>;
        updates.config = { ...existCfg, loginPhone: updates.login_phone };
      }
      if (updates.tags !== undefined) {
        const existCfg = (updates.config as Record<string, unknown> ?? (selected.config ?? {})) as Record<string, unknown>;
        updates.config = { ...existCfg, tags: updates.tags };
      }

      // Update the business in Supabase with the synced fields
      const { error } = await supabaseBrowser
        .from("business")
        .update(updates)
        .eq("id", selected.id);

      if (error) {
        console.error("Error saving business:", error);
        alert("Error saving changes: " + error.message);
        return;
      }

      // If payout tiers were edited, sync to business_payout_tiers table (source of truth for all other pages)
      // IMPORTANT: Admin overrides should NOT count against the business's annual change limit.
      // We preserve the original updated_at timestamps so the Receipts tab doesn't see a "change" this year.
      if (updates.custom_payout_tiers || updates.has_custom_tiers !== undefined) {
        const newTiers = (updates.custom_payout_tiers as number[] | null)
          || (selected.custom_payout_tiers as number[] | null);
        if (newTiers && newTiers.length === 7 && updates.has_custom_tiers !== false) {
          const TIER_CONFIG = thresholdsToTierConfig(platformTierConfig.visitThresholds);

          // Read existing updated_at timestamps BEFORE deleting so admin changes don't
          // look like a business-initiated change to the Receipts tab
          const { data: existingTierRows } = await supabaseBrowser
            .from("business_payout_tiers")
            .select("tier_index, updated_at")
            .eq("business_id", selected.id)
            .order("tier_index", { ascending: true });

          const existingTimestamps = new Map<number, string>();
          for (const row of (existingTierRows ?? []) as { tier_index: number; updated_at: string }[]) {
            existingTimestamps.set(row.tier_index, row.updated_at);
          }
          // Fallback: if no existing rows, use a date far in the past so it doesn't trigger "changed this year"
          const fallbackTimestamp = "2000-01-01T00:00:00.000Z";

          const tierRows = TIER_CONFIG.map((t, idx) => ({
            business_id: selected.id,
            tier_index: idx,
            level: t.level,
            label: t.label,
            min_visits: t.minVisits,
            max_visits: t.maxVisits,
            bps: newTiers[idx] ?? 0,
            percent_bps: newTiers[idx] ?? 0,
            is_active: true,
            updated_at: existingTimestamps.get(idx) || fallbackTimestamp,
          }));

          // Delete existing + insert new (same pattern as business profile Receipts tab)
          const { error: delErr } = await supabaseBrowser
            .from("business_payout_tiers")
            .delete()
            .eq("business_id", selected.id);
          if (delErr) console.error("Error deleting old tiers:", delErr);

          const { error: insErr } = await supabaseBrowser
            .from("business_payout_tiers")
            .insert(tierRows);
          if (insErr) console.error("Error inserting new tiers:", insErr);

          // Also sync to business.payout_tiers column AND config.payoutBps for consistency
          // (Discovery/Swipe, 5v3v1 pages read payout_tiers; legacy code may read config.payoutBps)
          const existingConfig = (selected.config ?? {}) as Record<string, unknown>;
          await supabaseBrowser
            .from("business")
            .update({
              payout_tiers: newTiers,
              config: { ...existingConfig, payoutBps: newTiers },
            })
            .eq("id", selected.id);

          // Refresh the realPayoutTiers state
          setRealPayoutTiers(newTiers);
        }
      }

      const changedFields = Object.keys(editedBusiness).join(", ");
      const oldVals = Object.keys(editedBusiness).map(k => `${k}: ${JSON.stringify((selected as unknown as Record<string, unknown>)[k] ?? "")}`).join(", ");
      const newVals = Object.keys(editedBusiness).map(k => `${k}: ${JSON.stringify((editedBusiness as unknown as Record<string, unknown>)[k] ?? "")}`).join(", ");
      logAudit({
        action: "save_business",
        tab: AUDIT_TABS.BUSINESSES,
        subTab: "Business Details",
        targetType: "business",
        targetId: selected.id,
        entityName: selected.public_business_name || selected.business_name || "Unnamed",
        fieldName: changedFields,
        oldValue: oldVals,
        newValue: newVals,
        details: `Updated fields: ${changedFields}`,
      });

      // Refresh data
      await fetchBusinesses();
      setEditedBusiness({});
      setIsEditing(false);
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
      duration: yearsDiff > 0 ? `${yearsDiff} year${yearsDiff > 1 ? "s" : ""}` : `${monthsDiff} month${monthsDiff !== 1 ? "s" : ""}`,
      daysToAnniversary,
    };
  }

  const status = selected ? getStatus(selected) : "active";

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

      {/* Left Sidebar - Business List */}
      <div
        style={{
          width: 360,
          borderRight: "1px solid " + COLORS.cardBorder,
          display: "flex",
          flexDirection: "column",
          background: COLORS.cardBg,
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
            🏢 Businesses
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
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
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
              <option value="paused">Paused</option>
              <option value="suspended">Suspended</option>
              <option value="submitted">Submitted</option>
            </select>
          </div>

          {/* Advanced Filters Toggle */}
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            style={{
              width: "100%",
              padding: 10,
              background: COLORS.darkBg,
              border: "1px solid " + COLORS.cardBorder,
              borderRadius: 8,
              color: COLORS.textSecondary,
              fontSize: 12,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            🔍 Advanced Filters {showAdvancedFilters ? "▲" : "▼"}
          </button>

          {/* Advanced Filters Panel */}
          {showAdvancedFilters && (
            <div style={{ marginTop: 12, padding: 12, background: COLORS.darkBg, borderRadius: 10, display: "grid", gap: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: COLORS.textSecondary, marginBottom: 4, textTransform: "uppercase" }}>
                    ZIP Code
                  </label>
                  <input
                    type="text"
                    placeholder="ZIP..."
                    value={advancedFilters.zipCode}
                    onChange={(e) => setAdvancedFilters({ ...advancedFilters, zipCode: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      border: "1px solid " + COLORS.cardBorder,
                      borderRadius: 6,
                      fontSize: 11,
                      background: COLORS.cardBg,
                      color: COLORS.textPrimary,
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: COLORS.textSecondary, marginBottom: 4, textTransform: "uppercase" }}>
                    Phone
                  </label>
                  <input
                    type="text"
                    placeholder="Phone..."
                    value={advancedFilters.phone}
                    onChange={(e) => setAdvancedFilters({ ...advancedFilters, phone: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      border: "1px solid " + COLORS.cardBorder,
                      borderRadius: 6,
                      fontSize: 11,
                      background: COLORS.cardBg,
                      color: COLORS.textPrimary,
                    }}
                  />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: COLORS.textSecondary, marginBottom: 4, textTransform: "uppercase" }}>
                    Date From
                  </label>
                  <input
                    type="date"
                    value={advancedFilters.dateFrom}
                    onChange={(e) => setAdvancedFilters({ ...advancedFilters, dateFrom: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 6px",
                      border: "1px solid " + COLORS.cardBorder,
                      borderRadius: 6,
                      fontSize: 10,
                      background: COLORS.cardBg,
                      color: COLORS.textPrimary,
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: COLORS.textSecondary, marginBottom: 4, textTransform: "uppercase" }}>
                    Date To
                  </label>
                  <input
                    type="date"
                    value={advancedFilters.dateTo}
                    onChange={(e) => setAdvancedFilters({ ...advancedFilters, dateTo: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 6px",
                      border: "1px solid " + COLORS.cardBorder,
                      borderRadius: 6,
                      fontSize: 10,
                      background: COLORS.cardBg,
                      color: COLORS.textPrimary,
                    }}
                  />
                </div>
              </div>
              <button
                onClick={() => setAdvancedFilters({ zipCode: "", phone: "", dateFrom: "", dateTo: "" })}
                style={{
                  padding: 8,
                  background: "transparent",
                  border: "1px solid " + COLORS.cardBorder,
                  borderRadius: 6,
                  color: COLORS.textSecondary,
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                Clear All Filters
              </button>
            </div>
          )}
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading ? (
            <div style={{ padding: 20, color: COLORS.textSecondary, textAlign: "center" }}>Loading...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary }}>No results found</div>
          ) : (
            filtered.map((biz) => {
              const isSelected = biz.id === selectedId;
              const bizStatus = getStatus(biz);
              const isPremium = biz.billing_plan?.toLowerCase() === "premium";
              const hasAddons = (biz.config?.selectedAddOns && biz.config.selectedAddOns.length > 0) || biz.config?.tpmsEnabled;

              return (
                <button
                  key={biz.id}
                  onClick={() => {
                    setSelectedId(biz.id);
                    setIsEditing(false);
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
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, color: COLORS.textPrimary, flex: 1, marginRight: 8 }}>
                      {biz.public_business_name || biz.business_name || "Unnamed"}
                    </span>
                    <Badge status={bizStatus} />
                  </div>
                  <div style={{ fontSize: 12, color: COLORS.textSecondary }}>{biz.contact_email}</div>
                  {biz.city && (
                    <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 4 }}>
                      {biz.city}, {biz.state}
                      {isPremium && (
                        <span
                          style={{
                            marginLeft: 8,
                            padding: "2px 6px",
                            background: "rgba(255,45,146,0.2)",
                            borderRadius: 4,
                            color: COLORS.neonPink,
                          }}
                        >
                          premium
                        </span>
                      )}
                      {hasAddons && (
                        <span
                          style={{
                            marginLeft: 6,
                            fontSize: 10,
                            color: COLORS.neonYellow,
                          }}
                          title="Has active add-ons"
                        >
                          ⭐
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right Side - Detail View */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: COLORS.darkBg }}>
        {!selected ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: COLORS.textSecondary }}>
            Select a business to view details
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
              <div>
                <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>
                  {selected.public_business_name || selected.business_name || "Unnamed Business"}
                </h1>
                <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <Badge status={status} />
                  <Badge status={selected.billing_plan || "basic"} />
                  {(() => {
                    const info = getMembershipInfo(selected.created_at);
                    return (
                      <>
                        <span style={{ fontSize: 13, color: COLORS.textSecondary }}>🗓️ Member since {formatDate(selected.created_at)}</span>
                        <span
                          style={{ fontSize: 12, padding: "4px 10px", background: "rgba(138,43,226,0.2)", borderRadius: 6, color: COLORS.neonPurple }}
                        >
                          {info.duration}
                        </span>
                        {info.daysToAnniversary <= 30 && (
                          <span
                            style={{ fontSize: 12, padding: "4px 10px", background: "rgba(255,45,146,0.2)", borderRadius: 6, color: COLORS.neonPink }}
                          >
                            🎂 Anniversary in {info.daysToAnniversary} days!
                          </span>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => {
                    if (isEditing) {
                      handleSaveChanges();
                    } else {
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
                  {isEditing ? "💾 Save Changes" : "✏️ Edit"}
                </button>
                {status === "active" && (
                  <button
                    onClick={() =>
                      setConfirmModal({
                        title: "Pause Business?",
                        message: `This will pause ${selected.public_business_name || selected.business_name}. They won't appear in the app until unpaused.`,
                        type: "warning",
                        confirmText: "Pause",
                        onConfirm: () => handleStatusChange("paused"),
                      })
                    }
                    style={{
                      padding: "10px 18px",
                      borderRadius: 10,
                      background: "rgba(255,255,0,0.2)",
                      border: "none",
                      color: COLORS.neonYellow,
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    ⏸️ Pause
                  </button>
                )}
                {status === "paused" && (
                  <button
                    onClick={() => handleStatusChange("active")}
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
                    ▶️ Unpause
                  </button>
                )}
                {status !== "suspended" && (
                  <button
                    onClick={() =>
                      setConfirmModal({
                        title: "Suspend Business?",
                        message: `This will suspend ${selected.public_business_name || selected.business_name}. This is a serious action that removes the business from the platform.`,
                        type: "danger",
                        confirmText: "Suspend",
                        onConfirm: () => handleStatusChange("suspended"),
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
              </div>
            </header>

            {/* Content */}
            <div style={{ flex: 1, overflowY: "auto", padding: 32 }}>
              <div style={{ maxWidth: 1100 }}>
                {/* Edit Mode Warning */}
                {isEditing && (
                  <div
                    style={{
                      background: "rgba(255,255,0,0.1)",
                      border: "1px solid " + COLORS.neonYellow,
                      borderRadius: 12,
                      padding: 16,
                      marginBottom: 24,
                      color: COLORS.neonYellow,
                      fontWeight: 600,
                    }}
                  >
                    ⚠️ You are in edit mode. Changes will be saved when you click &quot;Save Changes&quot;.
                  </div>
                )}

                {/* Business Information */}
                <SectionTitle icon="🏢">Business Information</SectionTitle>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
                  <Card title="Basic Details">
                    <EditField label="Legal Name" value={getValue("business_name") as string} editable={isEditing} onChange={(v) => updateField("business_name", v)} />
                    <EditField label="Public Name" value={getValue("public_business_name") as string} editable={isEditing} onChange={(v) => updateField("public_business_name", v)} />
                    <EditField
                      label="Business Type"
                      value={getValue("business_type") as string}
                      editable={isEditing}
                      onChange={(v) => updateField("business_type", v)}
                      options={businessTypeOptions}
                    />
                    <EditField
                      label="Cuisine Type"
                      value={getValue("cuisine_type") as string}
                      editable={isEditing}
                      onChange={(v) => updateField("cuisine_type", v)}
                      options={cuisineTypeOptions}
                    />
                    <EditField 
                      label="Price Level" 
                      value={getValue("price_level") as string} 
                      editable={isEditing} 
                      onChange={(v) => updateField("price_level", v)}
                      options={[
                        { value: "", label: "Select..." },
                        { value: "$", label: "$ (Under $15/person)" },
                        { value: "$$", label: "$$ ($15–$30/person)" },
                        { value: "$$$", label: "$$$ ($30–$60/person)" },
                        { value: "$$$$", label: "$$$$ ($60+/person)" },
                      ]}
                    />
                    <EditField 
                      label="Age Restriction" 
                      value={getValue("age_restriction") as string} 
                      editable={isEditing} 
                      onChange={(v) => updateField("age_restriction", v)}
                      options={[
                        { value: "", label: "Select..." },
                        { value: "all", label: "All Ages" },
                        { value: "18+", label: "18+" },
                        { value: "21+", label: "21+" },
                      ]}
                    />
                    <EditField label="Description / Vibe" value={getValue("description") as string} textarea editable={isEditing} onChange={(v) => updateField("description", v)} />
                  </Card>
                  <Card title="Contact & Location">
                    <AddressField 
                      label="Street Address" 
                      value={getValue("street_address") as string} 
                      editable={isEditing} 
                      onChange={(v) => updateField("street_address", v)}
                      onAddressSelect={(addr) => {
                        updateField("street_address", addr.street);
                        updateField("city", addr.city);
                        updateField("state", addr.state);
                        updateField("zip", addr.zip);
                      }}
                    />
                    <EditField label="City" value={getValue("city") as string} editable={isEditing} onChange={(v) => updateField("city", v)} />
                    <EditField label="State" value={getValue("state") as string} editable={isEditing} onChange={(v) => updateField("state", v)} />
                    <EditField label="ZIP Code" value={getValue("zip") as string} editable={isEditing} onChange={(v) => updateField("zip", v)} />
                    <PhoneField label="Phone" value={getValue("contact_phone") as string} editable={isEditing} onChange={(v) => updateField("contact_phone", v)} />
                    <EditField label="Email" value={getValue("contact_email") as string} editable={isEditing} onChange={(v) => updateField("contact_email", v)} />
                    <EditField label="Website" value={getValue("website") as string} editable={isEditing} onChange={(v) => updateField("website", v)} />
                    <EditField label="Customer Email" value={getValue("customer_email") as string} editable={isEditing} onChange={(v) => updateField("customer_email", v)} />
                  </Card>
                </div>

                {/* Operating Hours */}
                <SectionTitle icon="🕐">Operating Hours</SectionTitle>
                <Card style={{ marginBottom: 24 }}>
                  <HoursGrid
                    hours={getResolvedHours()}
                    editable={isEditing}
                    onChange={handleHoursChange}
                  />
                </Card>

                {/* Tags */}
                <SectionTitle icon="🏷️">Tags</SectionTitle>
                <Card style={{ marginBottom: 24 }}>
                  <Tags 
                    tags={getValue("tags") as string[] || []} 
                    editable={isEditing}
                    businessId={selected.id}
                    onChange={(newTags) => updateField("tags", newTags)}
                  />
                </Card>

                {/* Business Representative */}
                {/* Rep data lives in config JSONB (written by business profile Publish).
                    Top-level columns (rep_name etc.) may be stale from onboarding.
                    Read from config first, fall back to column. Save to both. */}
                <SectionTitle icon="👤">Business Representative</SectionTitle>
                <Card style={{ marginBottom: 24 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16 }}>
                    <EditField label="Name" value={getRepValue("repName", "rep_name")} editable={isEditing} onChange={(v) => updateRepField("repName", "rep_name", v)} />
                    <EditField label="Title" value={getRepValue("repTitle", "rep_title")} editable={isEditing} onChange={(v) => updateRepField("repTitle", "rep_title", v)} />
                    <EditField label="Email" value={getRepValue("repEmail", "rep_email")} editable={isEditing} onChange={(v) => updateRepField("repEmail", "rep_email", v)} />
                    <PhoneField label="Phone" value={getRepValue("repPhone", "rep_phone")} editable={isEditing} onChange={(v) => updateRepField("repPhone", "rep_phone", v)} />
                  </div>
                </Card>

                {/* Login Credentials */}
                <SectionTitle icon="🔐">Login Credentials</SectionTitle>
                <Card style={{ marginBottom: 24 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <EditField label="Login Email" value={getValue("login_email") as string} editable={isEditing} onChange={(v) => updateField("login_email", v)} />
                    <PhoneField label="Login Phone" value={getValue("login_phone") as string} editable={isEditing} onChange={(v) => updateField("login_phone", v)} />
                  </div>
                </Card>

                {/* Plan & Payout */}
                <SectionTitle icon="💰">Plan & Payout</SectionTitle>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
                  <Card title="Subscription Details">
                    <EditField
                      label="Plan"
                      value={getValue("billing_plan") as string}
                      editable={isEditing}
                      onChange={(v) => updateField("billing_plan", v)}
                      options={[
                        { value: "basic", label: "Basic" },
                        { value: "premium", label: "Premium" },
                        { value: "trial", label: "Trial (No Discounts)" },
                      ]}
                    />
                    <EditField 
                      label="Payment Method" 
                      value={getValue("payment_method") as string} 
                      editable={isEditing} 
                      onChange={(v) => updateField("payment_method", v)}
                      options={[
                        { value: "", label: "Select..." },
                        { value: "bank", label: "Bank Account (ACH)" },
                        { value: "card", label: "Credit/Debit Card" },
                        { value: "check", label: "Check" },
                      ]}
                    />
                    {/* Bank fields - only show if payment method is bank */}
                    {(getValue("payment_method") === "bank" || (!getValue("payment_method") && selected.bank_name)) && (
                      <>
                        <EditField label="Bank Name" value={getValue("bank_name") as string} editable={isEditing} onChange={(v) => updateField("bank_name", v)} />
                        <EditField 
                          label="Account Type" 
                          value={getValue("account_type") as string} 
                          editable={isEditing} 
                          onChange={(v) => updateField("account_type", v)}
                          options={[
                            { value: "", label: "Select..." },
                            { value: "checking", label: "Checking" },
                            { value: "savings", label: "Savings" },
                          ]}
                        />
                        {selected.routing_last4 && <EditField label="Routing (last 4)" value={"****" + selected.routing_last4} editable={false} />}
                        {selected.account_last4 && <EditField label="Account (last 4)" value={"****" + selected.account_last4} editable={false} />}
                      </>
                    )}
                    {/* Card fields - only show if payment method is card */}
                    {(getValue("payment_method") === "card" || (!getValue("payment_method") && selected.card_brand)) && selected.card_brand && (
                      <EditField label="Card on File" value={selected.card_brand + " ****" + selected.card_last4} editable={false} />
                    )}
                  </Card>
                  <Card title="Billing Information">
                    {isEditing && (
                      <div style={{ marginBottom: 16 }}>
                        <label 
                          style={{ 
                            display: "flex", 
                            alignItems: "center", 
                            gap: 10, 
                            cursor: "pointer",
                            padding: "10px 14px",
                            background: COLORS.darkBg,
                            border: "1px solid " + COLORS.cardBorder,
                            borderRadius: 8,
                          }}
                        >
                          <input
                            type="checkbox"
                            onChange={(e) => {
                              if (e.target.checked) {
                                const street = getValue("street_address") || "";
                                const city = getValue("city") || "";
                                const state = getValue("state") || "";
                                const zip = getValue("zip") || "";
                                const fullAddress = [street, city, `${state} ${zip}`.trim()].filter(Boolean).join(", ");
                                if (fullAddress) {
                                  updateField("billing_address", fullAddress);
                                } else {
                                  alert("Please fill in the business address first.");
                                  e.target.checked = false;
                                }
                              }
                            }}
                            style={{ width: 18, height: 18, accentColor: COLORS.neonGreen, cursor: "pointer" }}
                          />
                          <span style={{ fontSize: 13, color: COLORS.textSecondary }}>
                            Same as business address above
                          </span>
                        </label>
                      </div>
                    )}
                    <AddressField 
                      label="Billing Address" 
                      value={getValue("billing_address") as string} 
                      editable={isEditing} 
                      onChange={(v) => updateField("billing_address", v)}
                    />
                    <EditField label="Billing Email" value={getValue("billing_email") as string} editable={isEditing} onChange={(v) => updateField("billing_email", v)} />
                  </Card>
                </div>

                {/* Progressive Payout — unified section with tiers, change info, and admin override */}
                <SectionTitle icon="📊">Progressive Payout Structure</SectionTitle>
                <Card style={{ marginBottom: 24 }}>
                  {(() => {
                    const preset = (getValue("payout_preset") as string | null) || "standard";
                    const presetLabel = preset.charAt(0).toUpperCase() + preset.slice(1);
                    const PRESET_MAP = platformTierConfig.presetBps;
                    const STANDARD_BPS = PRESET_MAP.standard;
                    const agreedTiers = realPayoutTiers.length > 0
                      ? realPayoutTiers
                      : (getValue("payout_tiers") as number[] | null) || PRESET_MAP[preset] || STANDARD_BPS;
                    const TIER_LABELS = platformTierConfig.visitThresholds.map((t) => `Level ${t.level}`);
                    const TIER_NAMES = platformTierConfig.visitThresholds.map((t) => t.label);
                    const VISIT_RANGES = platformTierConfig.visitThresholds.map((t) => getVisitRangeShort(t));
                    const TIER_COLORS = ["#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16", "#22c55e", "#10b981"];
                    const presetColor = preset === "aggressive" ? COLORS.neonOrange
                      : preset === "conservative" ? COLORS.neonBlue
                      : preset === "custom" ? COLORS.neonYellow
                      : COLORS.neonGreen;
                    const hasCustom = getValue("has_custom_tiers") as boolean;
                    const changesThisYear = (getValue("payout_changes_this_year") as number) || 0;
                    const changeLimit = (getValue("payout_change_limit") as number) ?? 1;
                    const changesRemaining = Math.max(0, changeLimit - changesThisYear);
                    const staffOverride = getValue("payout_staff_override") as boolean;

                    return (
                      <>
                        {/* Header row: plan badge + change info */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{
                              padding: "4px 12px",
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 700,
                              background: `${presetColor}22`,
                              color: presetColor,
                              border: `1px solid ${presetColor}55`,
                              textTransform: "uppercase",
                              letterSpacing: 0.5,
                            }}>
                              {presetLabel} Plan
                            </span>
                            {hasCustom && (
                              <span style={{
                                padding: "4px 10px",
                                borderRadius: 6,
                                fontSize: 10,
                                fontWeight: 700,
                                background: "rgba(191,95,255,0.15)",
                                color: COLORS.neonPurple,
                                textTransform: "uppercase",
                              }}>
                                Admin Override Active
                              </span>
                            )}
                            {staffOverride && (
                              <span style={{
                                padding: "4px 10px",
                                borderRadius: 6,
                                fontSize: 10,
                                fontWeight: 700,
                                background: "rgba(57,255,20,0.15)",
                                color: COLORS.neonGreen,
                                textTransform: "uppercase",
                              }}>
                                Staff Override
                              </span>
                            )}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <span style={{
                              fontSize: 11,
                              color: changesRemaining > 0 ? COLORS.neonGreen : COLORS.neonRed,
                              fontWeight: 700,
                            }}>
                              Changes remaining in {new Date().getFullYear()}: {changesRemaining}
                            </span>
                            <span style={{
                              fontSize: 11,
                              color: COLORS.textSecondary,
                            }}>
                              ({changesThisYear} / {changeLimit} used)
                            </span>
                          </div>
                        </div>

                        {/* Change limit warning banner */}
                        <div style={{
                          padding: "10px 14px",
                          background: changesRemaining > 0 ? "rgba(255,255,255,0.02)" : "rgba(255,49,49,0.08)",
                          border: changesRemaining > 0 ? "1px solid " + COLORS.cardBorder : "1px solid rgba(255,49,49,0.3)",
                          borderRadius: 8,
                          marginBottom: 16,
                          fontSize: 11,
                          color: COLORS.textSecondary,
                          lineHeight: 1.6,
                        }}>
                          <strong style={{ color: COLORS.textPrimary }}>Structure Change Limit:</strong>{" "}
                          Business can change their payout structure{" "}
                          <span style={{ color: COLORS.neonYellow, fontWeight: 700 }}>{changeLimit}x per calendar year</span>.{" "}
                          {changesRemaining <= 0
                            ? <span style={{ color: COLORS.neonRed, fontWeight: 600 }}>No changes remaining — next eligible Jan 1, {new Date().getFullYear() + 1}.</span>
                            : <span style={{ color: COLORS.neonGreen, fontWeight: 600 }}>{changesRemaining} change{changesRemaining > 1 ? "s" : ""} remaining.</span>
                          }
                          {staffOverride && (
                            <span style={{ color: COLORS.neonGreen, fontWeight: 600, marginLeft: 6 }}>Staff override bypasses this limit.</span>
                          )}
                        </div>

                        {/* Tier cards — matching Business Profile colors */}
                        {(() => {
                          // ALWAYS display from realPayoutTiers (business_payout_tiers table = source of truth).
                          // When editing, read from in-flight edits (custom_payout_tiers via getValue), seeded from table data.
                          const inFlightEdits = (getValue("custom_payout_tiers") as number[] | null);
                          const editTiers = (isEditing && inFlightEdits && inFlightEdits.length === 7)
                            ? inFlightEdits
                            : [...agreedTiers];

                          return (
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 10 }}>
                              {agreedTiers.map((bps, i) => {
                                const pct = (bps / 100).toFixed(2);
                                const editBps = editTiers[i] ?? bps;
                                const editPct = (editBps / 100).toFixed(2);
                                const isLast = i === agreedTiers.length - 1;

                                return (
                                  <div key={i} style={{
                                    padding: "14px 8px",
                                    background: isEditing ? "rgba(168,85,247,0.05)" : "rgba(255,255,255,0.02)",
                                    borderRadius: 8,
                                    border: isEditing ? "1px solid rgba(168,85,247,0.3)" : "1px solid rgba(255,255,255,0.05)",
                                    textAlign: "center",
                                  }}>
                                    <div style={{ fontWeight: 700, marginBottom: 6, color: TIER_COLORS[i], fontSize: 13 }}>
                                      {TIER_LABELS[i]}
                                    </div>
                                    <div style={{ fontSize: 9, color: COLORS.textSecondary, marginBottom: 4 }}>
                                      ({TIER_NAMES[i]})
                                    </div>
                                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>
                                      {VISIT_RANGES[i]} visits
                                    </div>
                                    {isEditing ? (
                                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 2 }}>
                                        <input
                                          type="number"
                                          min={0}
                                          max={50}
                                          step={0.01}
                                          value={parseFloat(editPct)}
                                          onChange={(e) => {
                                            const newBps = Math.round(parseFloat(e.target.value || "0") * 100);
                                            const newTiers = [...editTiers];
                                            newTiers[i] = newBps;
                                            updateField("custom_payout_tiers", newTiers);
                                            updateField("has_custom_tiers", true);
                                          }}
                                          style={{
                                            width: "100%",
                                            maxWidth: 72,
                                            padding: "6px 4px",
                                            background: "rgba(255,255,255,0.1)",
                                            border: "1px solid rgba(255,255,255,0.2)",
                                            borderRadius: 6,
                                            color: COLORS.textPrimary,
                                            fontSize: 13,
                                            fontWeight: 700,
                                            textAlign: "center",
                                            fontFamily: "'Space Mono', monospace",
                                          }}
                                        />
                                        <span style={{ color: "rgba(255,255,255,0.5)", fontWeight: 600, fontSize: 12 }}>%</span>
                                      </div>
                                    ) : (
                                      <div style={{
                                        fontFamily: "'Space Mono', monospace",
                                        fontSize: 15,
                                        fontWeight: 700,
                                        color: isLast ? COLORS.neonGreen : COLORS.textPrimary,
                                      }}>
                                        {pct}%
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}

                        {/* Admin controls — only in edit mode */}
                        {isEditing && (
                          <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                            <button
                              onClick={() => {
                                updateField("custom_payout_tiers", null);
                                updateField("has_custom_tiers", false);
                              }}
                              style={{
                                padding: "6px 14px",
                                background: "transparent",
                                border: "1px solid " + COLORS.cardBorder,
                                borderRadius: 6,
                                color: COLORS.textSecondary,
                                fontSize: 11,
                                cursor: "pointer",
                              }}
                            >
                              Reset Override
                            </button>
                            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
                              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: COLORS.textSecondary }}>
                                Change Limit:
                                <input
                                  type="number"
                                  min={0}
                                  max={12}
                                  value={changeLimit}
                                  onChange={(e) => updateField("payout_change_limit", parseInt(e.target.value) || 0)}
                                  style={{
                                    width: 44,
                                    padding: "4px 6px",
                                    background: COLORS.cardBg,
                                    border: "1px solid " + COLORS.cardBorder,
                                    borderRadius: 6,
                                    color: COLORS.textPrimary,
                                    fontSize: 13,
                                    fontWeight: 700,
                                    textAlign: "center",
                                  }}
                                />
                                <span>/year</span>
                              </label>
                              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: COLORS.textSecondary }}>
                                Staff Override:
                                <select
                                  value={staffOverride ? "true" : "false"}
                                  onChange={(e) => updateField("payout_staff_override", e.target.value === "true")}
                                  style={{
                                    padding: "4px 8px",
                                    background: COLORS.cardBg,
                                    border: "1px solid " + COLORS.cardBorder,
                                    borderRadius: 6,
                                    color: COLORS.textPrimary,
                                    fontSize: 11,
                                  }}
                                >
                                  <option value="false">Off</option>
                                  <option value="true">On</option>
                                </select>
                              </label>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </Card>

                {/* Payout Change History */}
                <Card style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.textPrimary, marginBottom: 12 }}>Change History</div>
                  {tierChangeHistory.length > 0 ? (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid " + COLORS.cardBorder }}>
                          {["DATE", "PREVIOUS RATES", "NEW RATES", "CHANGED BY"].map((h) => (
                            <th key={h} style={{ textAlign: "left", padding: "8px 6px", color: COLORS.textSecondary, fontWeight: 600, fontSize: 10, letterSpacing: 0.5 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tierChangeHistory.map((ch) => {
                          const fmtTiers = (tiers: number[] | null) => tiers ? tiers.map((t) => t > 100 ? Math.round(t / 100) : t).join("-") + "%" : "—";
                          const fmtPreset = (preset: string | null) => preset ? preset.charAt(0).toUpperCase() + preset.slice(1) : "";
                          return (
                            <tr key={ch.id} style={{ borderBottom: "1px solid " + COLORS.cardBorder }}>
                              <td style={{ padding: "10px 6px", color: COLORS.textSecondary }}>
                                {new Date(ch.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                              </td>
                              <td style={{ padding: "10px 6px", color: COLORS.textSecondary }}>
                                {fmtPreset(ch.previous_preset)} ({fmtTiers(ch.previous_tiers)})
                              </td>
                              <td style={{ padding: "10px 6px" }}>
                                <span style={{
                                  color: ch.new_preset === "custom" ? COLORS.neonYellow : COLORS.neonGreen,
                                  fontWeight: 600,
                                }}>
                                  {fmtPreset(ch.new_preset)} ({fmtTiers(ch.new_tiers)})
                                </span>
                              </td>
                              <td style={{ padding: "10px 6px", color: COLORS.textSecondary }}>{ch.changed_by}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ fontSize: 12, color: COLORS.textSecondary, padding: "12px 0" }}>No payout changes recorded for this business.</div>
                  )}
                </Card>

                {/* Premium Add-ons & Services */}
                <SectionTitle icon="💎">Premium Add-ons & Services</SectionTitle>
                <Card style={{ marginBottom: 24 }}>
                  {(() => {
                    const plan = (getValue("billing_plan") as string || "basic").toLowerCase();
                    const isPremiumPlan = plan === "premium";
                    const cfg = getValue("config") as { selectedAddOns?: ("videos_5_day" | "live_15" | "live_30")[]; tpmsEnabled?: boolean } | null;
                    const hasStaleAddons = !isPremiumPlan && ((cfg?.selectedAddOns && cfg.selectedAddOns.length > 0) || cfg?.tpmsEnabled);

                    return (
                      <>
                        {/* Mismatch warning: add-ons exist on a non-Premium plan */}
                        {hasStaleAddons && (
                          <div
                            style={{
                              background: "rgba(255,49,49,0.1)",
                              border: "1px solid " + COLORS.neonRed,
                              borderRadius: 10,
                              padding: 14,
                              marginBottom: 16,
                              fontSize: 12,
                              color: COLORS.neonRed,
                              fontWeight: 600,
                            }}
                          >
                            ⚠️ Data Mismatch: This business is on the <strong>{plan}</strong> plan but has Premium add-ons configured.
                            {isEditing
                              ? " You can clear the add-ons below or upgrade the plan above."
                              : " Switch to Edit mode to resolve."}
                          </div>
                        )}

                        {isPremiumPlan || hasStaleAddons ? (
                          <PremiumAddons
                            businessId={selected.id}
                            config={cfg || undefined}
                            editable={isEditing}
                            onChange={(newConfig) => {
                              const currentConfig = (getValue("config") as Record<string, unknown>) || {};
                              updateField("config", { ...currentConfig, ...newConfig });
                            }}
                            pkgPricing={pkgPricing || undefined}
                          />
                        ) : (
                          <div style={{ textAlign: "center", padding: 24 }}>
                            <div style={{ fontSize: 28, marginBottom: 8 }}>⭐</div>
                            <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 4 }}>
                              No add-ons available
                            </div>
                            <div style={{ fontSize: 11, color: COLORS.textSecondary }}>
                              Upgrade to <strong style={{ color: COLORS.neonPink }}>Premium</strong> to access add-ons and services.
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </Card>

                {/* Active Advertising */}
                {(adCampaigns.length > 0 || (selected.ad_spend_total != null && selected.ad_spend_total > 0)) && (
                  <>
                    <SectionTitle icon="📢">Active Advertising</SectionTitle>
                    <Card style={{ marginBottom: 24 }}>
                      {adCampaigns.length === 0 ? (
                        <div style={{ textAlign: "center", padding: 20, color: COLORS.textSecondary, fontSize: 13 }}>
                          No ad campaigns found for this business.
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
                          {adCampaigns.slice(0, 5).map((camp) => {
                            const meta = (camp.meta && typeof camp.meta === "object") ? camp.meta : {};
                            const imgUrls: string[] = Array.isArray(meta.image_urls)
                              ? (meta.image_urls as string[]).filter(u => typeof u === "string" && u)
                              : meta.image_url ? [String(meta.image_url)] : [];
                            const firstImg = imgUrls[0] || null;
                            const isVideo = firstImg ? /\.(mp4|mov|webm|avi)$/i.test(firstImg) : false;
                            const campaignName = ({ ad_1day: "1-Day Spotlight", ad_7day: "7-Day Spotlight", ad_14day: "14-Day Spotlight", ad_100mile: "100 Mile Wide Push", ad_tourwide: "Tour Wide Push" } as Record<string, string>)[camp.campaign_type] || camp.campaign_type?.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase());
                            return (
                            <div
                              key={camp.id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 12,
                                padding: "12px 16px",
                                background: COLORS.darkBg,
                                borderRadius: 10,
                                border: "1px solid " + COLORS.cardBorder,
                              }}
                            >
                              {firstImg && !isVideo ? (
                                <div style={{ position: "relative", flexShrink: 0 }}>
                                  <img src={firstImg} alt="Ad" style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover", border: "1px solid rgba(255,255,255,0.1)" }} />
                                  {imgUrls.length > 1 && <div style={{ position: "absolute", bottom: -2, right: -2, background: COLORS.neonBlue, borderRadius: 8, padding: "0 4px", fontSize: 9, fontWeight: 700, color: "#fff" }}>{imgUrls.length}</div>}
                                </div>
                              ) : firstImg && isVideo ? (
                                <div style={{ width: 48, height: 48, borderRadius: 8, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 20, border: "1px solid rgba(255,255,255,0.1)" }}>🎬</div>
                              ) : null}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>
                                  {campaignName}
                                </div>
                                <div style={{ fontSize: 11, color: COLORS.textSecondary }}>
                                  {formatDate(camp.start_date)} — {formatDate(camp.end_date)}
                                </div>
                                {camp.promo_text && (
                                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontStyle: "italic", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>&ldquo;{camp.promo_text}&rdquo;</div>
                                )}
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                                <span style={{ fontFamily: "monospace", fontWeight: 700, color: COLORS.neonGreen }}>
                                  {formatMoney(camp.price_cents || 0)}
                                </span>
                                <Badge status={camp.status || "pending"} />
                              </div>
                            </div>
                            );
                          })}
                          {adCampaigns.length > 5 && (
                            <div style={{ fontSize: 11, color: COLORS.textSecondary, textAlign: "center" }}>
                              + {adCampaigns.length - 5} more campaigns
                            </div>
                          )}
                        </div>
                      )}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "12px 16px",
                          background: "rgba(57,255,20,0.08)",
                          borderRadius: 10,
                          border: "1px solid " + COLORS.neonGreen,
                        }}
                      >
                        <span style={{ fontSize: 12, color: COLORS.textSecondary }}>Total Ad Spend</span>
                        <span style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 700, color: COLORS.neonGreen }}>
                          {formatMoney(adCampaigns.reduce((s, c) => s + (c.price_cents || 0), 0))}
                        </span>
                      </div>
                    </Card>
                  </>
                )}

                {/* Receipt Verification */}
                <SectionTitle icon="📋">Receipt Verification</SectionTitle>
                <Card style={{ marginBottom: 24 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                    <EditField label="Verifier Name" value={getValue("verifier_name") as string} editable={isEditing} onChange={(v) => updateField("verifier_name", v)} />
                    <EditField label="Verifier Email" value={getValue("verifier_email") as string} editable={isEditing} onChange={(v) => updateField("verifier_email", v)} />
                    <PhoneField label="Verifier Phone" value={getValue("verifier_phone") as string} editable={isEditing} onChange={(v) => updateField("verifier_phone", v)} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
                    <EditField 
                      label="Auto-Approval" 
                      value={getValue("auto_approval_enabled") ? "enabled" : "disabled"} 
                      editable={isEditing}
                      options={[{ value: "enabled", label: "Enabled" }, { value: "disabled", label: "Disabled" }]}
                      onChange={(v) => updateField("auto_approval_enabled", v === "enabled")}
                    />
                    <EditField label="Auto-Approve Max ($)" value={getValue("auto_approval_max") as number} editable={isEditing} onChange={(v) => updateField("auto_approval_max", parseInt(v) || 0)} />
                  </div>
                </Card>

                {/* Marketing Permissions */}
                <SectionTitle icon="📣">Marketing Permissions</SectionTitle>
                <Card style={{ marginBottom: 24 }}>
                  <Checklist
                    editable={isEditing}
                    items={[
                      { label: "Allow User Uploads", checked: !!(getValue("marketing_permissions") as Record<string, boolean> | null)?.userUploads },
                      { label: "Feature in Discovery", checked: !!(getValue("marketing_permissions") as Record<string, boolean> | null)?.featureInDiscovery },
                      { label: "A/B Testing", checked: !!(getValue("marketing_permissions") as Record<string, boolean> | null)?.abTesting },
                    ]}
                    onChange={(items) => {
                      updateField("marketing_permissions", {
                        userUploads: items[0].checked,
                        featureInDiscovery: items[1].checked,
                        abTesting: items[2].checked,
                      });
                    }}
                  />
                </Card>

                {/* Verification Documents */}
                {(() => {
                  const cfg = (selected.config ?? {}) as Record<string, unknown>;
                  const verDoc = cfg.verificationDocFile as { name?: string; url?: string } | null | undefined;
                  const logoDoc = cfg.businessLogoFile as { name?: string; url?: string } | null | undefined;
                  const hasFiles = (verDoc && verDoc.url) || (logoDoc && logoDoc.url);
                  return hasFiles ? (
                    <>
                      <SectionTitle icon="📄">Verification Documents</SectionTitle>
                      <Card style={{ marginBottom: 24 }}>
                        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                          {verDoc?.url && (
                            <div>
                              <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, fontWeight: 600 }}>
                                {(cfg.verificationDocType as string)?.replace(/_/g, " ").toUpperCase() || "VERIFICATION DOC"}
                              </div>
                              <div
                                onClick={() => setPreview({ url: verDoc.url!, type: verDoc.name?.endsWith(".pdf") ? "pdf" : "image" })}
                                style={{ cursor: "pointer", borderRadius: 10, overflow: "hidden", border: "2px solid " + COLORS.cardBorder, width: 140, height: 140 }}
                              >
                                {verDoc.name?.toLowerCase().endsWith(".pdf") ? (
                                  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: COLORS.darkBg, color: COLORS.textSecondary, fontSize: 32 }}>
                                    📄
                                  </div>
                                ) : (
                                  <img src={verDoc.url} alt={verDoc.name || "Document"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                )}
                              </div>
                              <div style={{ fontSize: 10, color: COLORS.textSecondary, marginTop: 4 }}>{verDoc.name}</div>
                            </div>
                          )}
                          {logoDoc?.url && (
                            <div>
                              <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, fontWeight: 600 }}>BUSINESS LOGO</div>
                              <div
                                onClick={() => setPreview({ url: logoDoc.url!, type: "image" })}
                                style={{ cursor: "pointer", borderRadius: 10, overflow: "hidden", border: "2px solid " + COLORS.cardBorder, width: 140, height: 140 }}
                              >
                                <img src={logoDoc.url} alt={logoDoc.name || "Logo"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              </div>
                              <div style={{ fontSize: 10, color: COLORS.textSecondary, marginTop: 4 }}>{logoDoc.name}</div>
                            </div>
                          )}
                        </div>
                      </Card>
                    </>
                  ) : null;
                })()}

                {/* Photos - Collapsible */}
                <CollapsibleSection title="Photos" icon="📷" defaultOpen={true}>
                  <Card>
                    {/* Media Status Summary */}
                    <div style={{ display: "flex", gap: 16, marginBottom: 20, padding: 12, background: COLORS.darkBg, borderRadius: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: COLORS.neonGreen }}></span>
                        <span style={{ fontSize: 12, color: COLORS.textSecondary }}>
                          Active: {selected.photos?.filter(p => !p?.status || p?.status === "active").length || 0}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: COLORS.neonOrange }}></span>
                        <span style={{ fontSize: 12, color: COLORS.textSecondary }}>
                          Under Investigation: {selected.photos?.filter(p => p?.status === "paused").length || 0}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: COLORS.neonRed }}></span>
                        <span style={{ fontSize: 12, color: COLORS.textSecondary }}>
                          Banned: {selected.photos?.filter(p => p?.status === "removed").length || 0}
                        </span>
                      </div>
                    </div>

                    {/* Upload Button */}
                    {isEditing && (
                      <div style={{ marginBottom: 20 }}>
                        <label
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "10px 16px",
                            background: COLORS.gradient1,
                            border: "none",
                            borderRadius: 8,
                            color: "#fff",
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          <span>📤</span>
                          <span>Upload Photo</span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            style={{ display: "none" }}
                            onChange={async (e) => {
                              const files = e.target.files;
                              if (!files || files.length === 0 || !selected) return;
                              const existingCount = selected.photos?.length || 0;
                              for (let i = 0; i < files.length; i++) {
                                const file = files[i];
                                const ext = file.name.split(".").pop() || "jpg";
                                const storagePath = `${selected.id}/photos/${Date.now()}-${i}.${ext}`;
                                const { error: upErr } = await supabaseBrowser.storage
                                  .from("business-media")
                                  .upload(storagePath, file, { cacheControl: "3600", upsert: false, contentType: file.type });
                                if (upErr) { console.error("[admin] Photo upload error:", upErr); continue; }
                                const { data: inserted, error: insErr } = await supabaseBrowser
                                  .from("business_media")
                                  .insert({
                                    business_id: selected.id,
                                    bucket: "business-media",
                                    path: storagePath,
                                    media_type: "photo",
                                    sort_order: existingCount + i + 1,
                                    caption: file.name,
                                    is_active: true,
                                    meta: {},
                                  })
                                  .select("id, path, caption, created_at")
                                  .single();
                                if (insErr) { console.error("[admin] Photo insert error:", insErr); continue; }
                                const { data: urlData } = supabaseBrowser.storage.from("business-media").getPublicUrl(storagePath);
                                const newPhoto = {
                                  id: inserted.id,
                                  name: inserted.caption || file.name,
                                  url: urlData?.publicUrl || "",
                                  status: "active" as const,
                                  uploaded_at: inserted.created_at || new Date().toISOString(),
                                };
                                setBusinesses(prev => prev.map(b => b.id === selected.id ? { ...b, photos: [...(b.photos || []), newPhoto] } : b));
                              }
                              e.target.value = "";
                            }}
                          />
                        </label>
                      </div>
                    )}

                    {selected.logo_url && (
                      <div style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 8, fontWeight: 600 }}>LOGO</div>
                        <div style={{ position: "relative", display: "inline-block" }}>
                          <img
                            src={selected.logo_url}
                            alt="Logo"
                            style={{ width: 100, height: 100, objectFit: "cover", borderRadius: 12, cursor: "pointer" }}
                            onClick={() => setPreview({ url: selected.logo_url!, type: "image" })}
                          />
                          {isEditing && (
                            <button
                              onClick={() => updateField("logo_url", null)}
                              style={{ position: "absolute", top: -8, right: -8, width: 24, height: 24, borderRadius: "50%", background: COLORS.neonRed, border: "none", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700 }}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    {selected.cover_image_url && (
                      <div style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 8, fontWeight: 600 }}>COVER IMAGE</div>
                        <div style={{ position: "relative", display: "inline-block" }}>
                          <img
                            src={selected.cover_image_url}
                            alt="Cover"
                            style={{ width: "100%", maxWidth: 400, height: 150, objectFit: "cover", borderRadius: 12, cursor: "pointer" }}
                            onClick={() => setPreview({ url: selected.cover_image_url!, type: "image" })}
                          />
                          {isEditing && (
                            <button
                              onClick={() => updateField("cover_image_url", null)}
                              style={{ position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: 6, background: COLORS.neonRed, border: "none", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 700 }}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 8, fontWeight: 600 }}>
                      GALLERY ({selected.photos?.length || 0} images)
                    </div>
                    <MediaGridManaged
                      items={(getValue("photos") || selected.photos) as typeof selected.photos}
                      type="photo"
                      editable={isEditing}
                      onPreview={setPreview}
                      onStatusChange={(index, status) => {
                        const newPhotos = [...(selected.photos || [])];
                        if (newPhotos[index]) {
                          newPhotos[index] = { ...newPhotos[index], status };
                          // Persist to business_media table
                          const mediaId = newPhotos[index].id;
                          if (mediaId) {
                            supabaseBrowser.auth.getSession().then(({ data: { session: sess } }) => {
                              fetch("/api/admin/businesses/media", {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json", Authorization: `Bearer ${sess?.access_token || ""}` },
                                body: JSON.stringify({ id: mediaId, status }),
                              })
                                .then(async (res) => {
                                  if (!res.ok) {
                                    const errText = await res.text().catch(() => "");
                                    console.error("[admin] Photo status update failed:", res.status, errText);
                                  }
                                })
                                .catch((err) => console.error("[admin] Photo status update error:", err));
                            });
                          }
                        }
                        updateField("photos", newPhotos);
                      }}
                      onDelete={(indices) => {
                        const photos = selected.photos || [];
                        const ids = indices.map(i => photos[i]?.id).filter(Boolean) as string[];
                        if (ids.length === 0) return;
                        supabaseBrowser.auth.getSession().then(({ data: { session: sess } }) => {
                          fetch("/api/admin/businesses/media", {
                            method: "DELETE",
                            headers: { "Content-Type": "application/json", Authorization: `Bearer ${sess?.access_token || ""}` },
                            body: JSON.stringify({ ids }),
                          })
                            .then(async (res) => {
                              if (!res.ok) {
                                const errText = await res.text().catch(() => "");
                                console.error("[admin] Photo delete failed:", res.status, errText);
                                return;
                              }
                              // Remove from local state
                              const remaining = photos.filter((_, idx) => !indices.includes(idx));
                              setBusinesses(prev => prev.map(b => b.id === selected.id ? { ...b, photos: remaining } : b));
                            })
                            .catch((err) => console.error("[admin] Photo delete error:", err));
                        });
                      }}
                    />
                  </Card>
                </CollapsibleSection>

                {/* Videos - Collapsible */}
                <CollapsibleSection title="Videos" icon="🎬" defaultOpen={true}>
                  <Card>
                    {/* Media Status Summary */}
                    <div style={{ display: "flex", gap: 16, marginBottom: 20, padding: 12, background: COLORS.darkBg, borderRadius: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: COLORS.neonGreen }}></span>
                        <span style={{ fontSize: 12, color: COLORS.textSecondary }}>
                          Active: {selected.videos?.filter(v => !v?.status || v?.status === "active").length || 0}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: COLORS.neonOrange }}></span>
                        <span style={{ fontSize: 12, color: COLORS.textSecondary }}>
                          Under Investigation: {selected.videos?.filter(v => v?.status === "paused").length || 0}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: COLORS.neonRed }}></span>
                        <span style={{ fontSize: 12, color: COLORS.textSecondary }}>
                          Banned: {selected.videos?.filter(v => v?.status === "removed").length || 0}
                        </span>
                      </div>
                    </div>

                    {/* Upload Button */}
                    {isEditing && (
                      <div style={{ marginBottom: 20 }}>
                        <label
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "10px 16px",
                            background: COLORS.gradient1,
                            border: "none",
                            borderRadius: 8,
                            color: "#fff",
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          <span>📤</span>
                          <span>Upload Video</span>
                          <input
                            type="file"
                            accept="video/*"
                            multiple
                            style={{ display: "none" }}
                            onChange={async (e) => {
                              const files = e.target.files;
                              if (!files || files.length === 0 || !selected) return;
                              const existingCount = selected.videos?.length || 0;
                              for (let i = 0; i < files.length; i++) {
                                const file = files[i];
                                const ext = file.name.split(".").pop() || "mp4";
                                const storagePath = `${selected.id}/videos/${Date.now()}-${i}.${ext}`;
                                const { error: upErr } = await supabaseBrowser.storage
                                  .from("business-media")
                                  .upload(storagePath, file, { cacheControl: "3600", upsert: false, contentType: file.type });
                                if (upErr) { console.error("[admin] Video upload error:", upErr); continue; }
                                const { data: inserted, error: insErr } = await supabaseBrowser
                                  .from("business_media")
                                  .insert({
                                    business_id: selected.id,
                                    bucket: "business-media",
                                    path: storagePath,
                                    media_type: "video",
                                    sort_order: existingCount + i + 1,
                                    caption: file.name,
                                    is_active: true,
                                    meta: {},
                                  })
                                  .select("id, path, caption, created_at")
                                  .single();
                                if (insErr) { console.error("[admin] Video insert error:", insErr); continue; }
                                const { data: urlData } = supabaseBrowser.storage.from("business-media").getPublicUrl(storagePath);
                                const newVideo = {
                                  id: inserted.id,
                                  name: inserted.caption || file.name,
                                  url: urlData?.publicUrl || "",
                                  status: "active" as const,
                                  uploaded_at: inserted.created_at || new Date().toISOString(),
                                };
                                setBusinesses(prev => prev.map(b => b.id === selected.id ? { ...b, videos: [...(b.videos || []), newVideo] } : b));
                              }
                              e.target.value = "";
                            }}
                          />
                        </label>
                      </div>
                    )}

                    <div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 8, fontWeight: 600 }}>
                      ALL VIDEOS ({selected.videos?.length || 0} videos)
                    </div>
                    <MediaGridManaged
                      items={(getValue("videos") || selected.videos) as typeof selected.videos}
                      type="video"
                      editable={isEditing}
                      onPreview={setPreview}
                      onStatusChange={(index, status) => {
                        const newVideos = [...(selected.videos || [])];
                        if (newVideos[index]) {
                          newVideos[index] = { ...newVideos[index], status };
                          // Persist to business_media table
                          const mediaId = newVideos[index].id;
                          if (mediaId) {
                            supabaseBrowser.auth.getSession().then(({ data: { session: sess } }) => {
                              fetch("/api/admin/businesses/media", {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json", Authorization: `Bearer ${sess?.access_token || ""}` },
                                body: JSON.stringify({ id: mediaId, status }),
                              })
                                .then(async (res) => {
                                  if (!res.ok) {
                                    const errText = await res.text().catch(() => "");
                                    console.error("[admin] Video status update failed:", res.status, errText);
                                  }
                                })
                                .catch((err) => console.error("[admin] Video status update error:", err));
                            });
                          }
                        }
                        updateField("videos", newVideos);
                      }}
                      onDelete={(indices) => {
                        const videos = selected.videos || [];
                        const ids = indices.map(i => videos[i]?.id).filter(Boolean) as string[];
                        if (ids.length === 0) return;
                        supabaseBrowser.auth.getSession().then(({ data: { session: sess } }) => {
                          fetch("/api/admin/businesses/media", {
                            method: "DELETE",
                            headers: { "Content-Type": "application/json", Authorization: `Bearer ${sess?.access_token || ""}` },
                            body: JSON.stringify({ ids }),
                          })
                            .then(async (res) => {
                              if (!res.ok) {
                                const errText = await res.text().catch(() => "");
                                console.error("[admin] Video delete failed:", res.status, errText);
                                return;
                              }
                              const remaining = videos.filter((_, idx) => !indices.includes(idx));
                              setBusinesses(prev => prev.map(b => b.id === selected.id ? { ...b, videos: remaining } : b));
                            })
                            .catch((err) => console.error("[admin] Video delete error:", err));
                        });
                      }}
                    />
                  </Card>
                </CollapsibleSection>

                {/* Performance Metrics */}
                <SectionTitle icon="📊">Performance Metrics</SectionTitle>
                <Card style={{ marginBottom: 24 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
                    {[
                      { val: (liveMetrics?.totalReceipts ?? selected.total_receipts ?? 0).toLocaleString(), label: "Total Receipts", c: COLORS.neonBlue },
                      { val: formatMoney(liveMetrics?.totalPayoutCents ?? selected.total_payout_cents ?? 0), label: "Total Payouts", c: COLORS.neonGreen },
                      { val: (liveMetrics?.activeCustomers ?? selected.active_customers ?? 0).toLocaleString(), label: "Active Customers", c: COLORS.neonPurple },
                      { val: formatMoney(liveMetrics?.avgReceiptCents ?? selected.avg_receipt_amount ?? 0), label: "Avg Receipt", c: COLORS.neonPink },
                    ].map((s, i) => (
                      <div key={i} style={{ textAlign: "center", padding: 24, background: COLORS.darkBg, borderRadius: 14 }}>
                        <div style={{ fontSize: 28, fontWeight: 700, color: s.c }}>{s.val}</div>
                        <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 4 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Internal Notes */}
                <SectionTitle icon="📝">Internal Notes (Staff Only)</SectionTitle>
                <Card>
                  <EditField label="Notes" value={getValue("internal_notes") as string} textarea editable={isEditing} onChange={(v) => updateField("internal_notes", v)} />
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}