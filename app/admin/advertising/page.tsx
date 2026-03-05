"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { logAudit, AUDIT_TABS } from "@/lib/auditLog";
import {
  COLORS,
  Card,
  StatCard,
  Badge,
  DataTable,
  ConfirmModal,
  formatMoney,
  formatDate,
  formatDateTime,
} from "@/components/admin/components";

// ==================== TYPES ====================
interface AdCampaign {
  id: string;
  created_at: string;
  business_id: string;
  business_name?: string;
  business_email?: string;
  business_phone?: string;
  business_address?: string;
  created_by_user_id: string | null;
  campaign_type: string;
  start_date: string;
  end_date: string;
  price_cents: number;
  base_price_cents: number;
  surge_fee_cents: number;
  surge_event_id: string | null;
  surge_multiplier_bps: number | null;
  status: string;
  cancel_reason: string | null;
  staff_override: boolean;
  zip_code: string | null;
  impressions: number;
  clicks: number;
  paid: boolean;
  paid_at: string | null;
  push_message: string | null;
  window_start: string | null;
  window_end: string | null;
  priority_days: string[] | null;
  push_days: string[] | null;
  postpone_reason: string | null;
  meta: Record<string, unknown> | null;
  promo_text: string | null;
}

interface PushCampaign {
  id: string;
  created_at: string;
  business_id: string | null;
  business_name?: string;
  name: string;
  message: string;
  type: string;
  status: string;
  target_audience: string;
  radius: string | null;
  scheduled_at: string | null;
  sent_at: string | null;
  recipients: number;
  delivered: number;
  opened: number;
  clicked: number;
  conversions: number;
  created_by: string;
}

interface AddonSubscription {
  id: string;
  created_at: string;
  business_id: string;
  business_name?: string;
  addon_type: string;
  status: string;
  price_cents: number;
  started_at: string | null;
  cancelled_at: string | null;
  next_billing: string | null;
  auto_renew: boolean;
  tpms_receipts_handled: number;
  tpms_content_updates: number;
  tpms_disputes_covered: number;
}

interface BusinessRef {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  plan: string | null;
}

interface ToastItem {
  id: number;
  message: string;
  type: "success" | "warning" | "info" | "error";
}

interface OverlapPair {
  id: string;
  campaign1: AdCampaign;
  campaign2: AdCampaign;
  severity: "high" | "medium" | "review";
  overlapDays: number;
}

interface OverlapActionState {
  type: "resolve" | "reschedule" | "cancel";
  id: string;
  campaign1: AdCampaign;
  campaign2: AdCampaign;
}

interface ConfirmModalState {
  title: string;
  message: string;
  type: "info" | "warning" | "danger";
  confirmText: string;
  onConfirm: () => void;
}

interface SurgeEvent {
  id: string;
  created_at: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  categories: string[];
  multiplier_bps: number;
  impact: string;
  suggested_products: string[];
  is_active: boolean;
  created_by: string | null;
}

// ==================== CONSTANTS ====================
const AD_OPTIONS = [
  { id: "ad_1day", name: "1-Day Spotlight", price: 9900, description: "Featured at top of Discovery feed for 1 day in your category (within 20 miles of your business zip code)", duration: "1 day", durationDays: 1, radius: "20 miles", type: "spotlight" as const },
  { id: "ad_7day", name: "7-Day Spotlight", price: 59900, description: "Featured at top of Discovery feed for 7 days in your category (within 50 miles of your zip code)", duration: "7 days", durationDays: 7, radius: "50 miles", type: "spotlight" as const },
  { id: "ad_14day", name: "14-Day Spotlight", price: 99900, description: "Featured at top of Discovery feed for 14 days in your category (within 50 miles of your zip code)", duration: "14 days", durationDays: 14, radius: "50 miles", type: "spotlight" as const },
  { id: "ad_100mile", name: "100 Mile Wide Push", price: 259900, description: "Promoted to all users within 100 miles with push notifications for 7 days straight and top priority placement on Discovery page", duration: "7 days", durationDays: 7, radius: "100 miles", type: "push" as const, featured: true },
  { id: "ad_tourwide", name: "Tour Wide Push", price: 459900, description: "Promoted to all users within 100 miles with push notifications for 14 days total (split in 60-day range) and top priority placement for 7 days", duration: "14 days (60-day range)", durationDays: 60, radius: "100 miles", type: "push" as const },
];

const PREMIUM_ADDONS = [
  { id: "video_addon", name: "Add 5 videos/day", price: 5000, description: "Upload up to 5 videos per day to your business profile", category: "video" },
  { id: "live_15", name: "Increase live video capacity to 15", price: 5000, description: "Allow up to 15 concurrent viewers on your live streams", category: "live", exclusive: true },
  { id: "live_30", name: "Increase live video capacity to 30", price: 10000, description: "Allow up to 30 concurrent viewers on your live streams", category: "live", exclusive: true },
];

const TPMS_SERVICE = {
  id: "tpms",
  name: "Total Profile Management Services (TPMS)",
  price: 20000,
  description: "We'll handle receipt reviews and approvals for you, keep your profile updated with fresh uploads, and manage your payout ladder settings for optimal performance.",
  features: ["Receipt reviews & approvals", "Profile content management", "Payout optimization"],
};

const inputStyle: React.CSSProperties = {
  padding: "10px 14px",
  background: COLORS.darkBg,
  border: "1px solid " + COLORS.cardBorder,
  borderRadius: 8,
  color: COLORS.textPrimary,
  fontSize: 13,
};

const btnPrimary: React.CSSProperties = {
  padding: "12px 24px",
  background: COLORS.gradient1,
  border: "none",
  borderRadius: 10,
  color: "#fff",
  cursor: "pointer",
  fontWeight: 700,
};

const btnSecondary: React.CSSProperties = {
  padding: "12px 24px",
  background: COLORS.darkBg,
  border: "1px solid " + COLORS.cardBorder,
  borderRadius: 10,
  color: COLORS.textPrimary,
  cursor: "pointer",
  fontWeight: 600,
};

// ==================== MAIN COMPONENT ====================
export default function AdvertisingPage() {
  // Data
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [pushCampaigns, setPushCampaigns] = useState<PushCampaign[]>([]);
  const [addonSubs, setAddonSubs] = useState<AddonSubscription[]>([]);
  const [businesses, setBusinesses] = useState<BusinessRef[]>([]);
  const [loading, setLoading] = useState(true);

  // UI
  const [activeTab, setActiveTab] = useState("campaigns");
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(null);

  // Campaign tab
  const [adFilters, setAdFilters] = useState({ search: "", status: "all", type: "all" });
  const [selectedCampaign, setSelectedCampaign] = useState<AdCampaign | null>(null);
  const [showCreateAdModal, setShowCreateAdModal] = useState(false);
  const [showPostponeModal, setShowPostponeModal] = useState(false);
  const [postponeCampaign, setPostponeCampaign] = useState<AdCampaign | null>(null);
  const [previewCampaign, setPreviewCampaign] = useState<AdCampaign | null>(null);
  const emptyNewCampaign = { business_id: "", ad_type: "", start_date: "", end_date: "", zip_code: "", push_message: "", window_start: "", window_end: "", priority_days: ["","","","","","",""] as string[], push_days: ["","","","","","","","","","","","","",""] as string[], businessSearch: "", businessPlanFilter: "all", businessCityFilter: "" };
  const [newCampaign, setNewCampaign] = useState(emptyNewCampaign);

  // Calendar
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);

  // Overlap
  const [overlapFilters, setOverlapFilters] = useState({ zip: "", state: "" });
  const [overlapAction, setOverlapAction] = useState<OverlapActionState | null>(null);
  const [approvedOverlaps, setApprovedOverlaps] = useState<string[]>([]);

  // Push tab
  const [showCreatePushModal, setShowCreatePushModal] = useState(false);
  const [newPush, setNewPush] = useState({ name: "", message: "", type: "promotional", business_id: "", target_audience: "nearby_users", radius: "10mi", scheduled_at: "" });

  // Addon tab
  const [showAssignAddonModal, setShowAssignAddonModal] = useState(false);
  const [addonToAssign, setAddonToAssign] = useState<typeof PREMIUM_ADDONS[0] | null>(null);
  const [addonBusinessSearch, setAddonBusinessSearch] = useState("");

  // Postpone form
  const [postponeForm, setPostponeForm] = useState({ start_date: "", end_date: "", window_start: "", window_end: "", reason: "" });

  // History tab
  const [historySearch, setHistorySearch] = useState("");
  const [historySelectedBusiness, setHistorySelectedBusiness] = useState<string | null>(null);
  const [historyFilters, setHistoryFilters] = useState({ type: "all", status: "all", dateFrom: "", dateTo: "" });

  // Forecast tab
  const [forecastCategory, setForecastCategory] = useState("all");
  const [forecastImpact, setForecastImpact] = useState("all");
  const [forecastTimeframe, setForecastTimeframe] = useState("90");

  // Surge pricing
  const [surgeEvents, setSurgeEvents] = useState<SurgeEvent[]>([]);
  const [showSurgeModal, setShowSurgeModal] = useState(false);
  const [editingSurge, setEditingSurge] = useState<SurgeEvent | null>(null);
  const emptySurgeForm = { name: "", description: "", start_date: "", end_date: "", categories: [] as string[], multiplier_bps: 10000, impact: "medium" as string, suggested_products: [] as string[], is_active: true };
  const [surgeForm, setSurgeForm] = useState(emptySurgeForm);

  // ==================== TOAST ====================
  let toastId = 0;
  const addToast = useCallback((message: string, type: ToastItem["type"] = "info") => {
    const id = Date.now() + (toastId++);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // ==================== DATA FETCHING ====================
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch businesses
      const { data: bizData } = await supabaseBrowser
        .from("business")
        .select("id, business_name, public_business_name, config")
        .order("business_name");

      const bizList: BusinessRef[] = (bizData || []).map(b => {
        const cfg = b.config as Record<string, unknown> | null;
        return {
          id: b.id,
          name: (b.public_business_name || b.business_name || "Unknown") as string,
          city: (cfg?.city as string) || null,
          state: (cfg?.state as string) || null,
          email: (cfg?.customerEmail as string) || (cfg?.email as string) || null,
          phone: (cfg?.businessPhone as string) || (cfg?.phone as string) || null,
          address: (cfg?.streetAddress as string) || null,
          plan: (cfg?.plan as string) || null,
        };
      });
      setBusinesses(bizList);

      const bizMap = new Map<string, BusinessRef>();
      bizList.forEach(b => bizMap.set(b.id, b));

      // Fetch ad campaigns
      const { data: campData } = await supabaseBrowser
        .from("business_ad_campaigns")
        .select("*")
        .order("created_at", { ascending: false });

      setCampaigns((campData || []).map(c => {
        const biz = bizMap.get(c.business_id);
        return { ...c, business_name: biz?.name || c.business_id, business_email: biz?.email || "", business_phone: biz?.phone || "", business_address: biz?.address ? `${biz.address}, ${biz.city}, ${biz.state}` : "" };
      }));

      // Fetch push campaigns
      const { data: pushData } = await supabaseBrowser
        .from("push_campaigns")
        .select("*")
        .order("created_at", { ascending: false });

      setPushCampaigns((pushData || []).map(p => ({
        ...p,
        business_name: p.business_id ? (bizMap.get(p.business_id)?.name || "Unknown") : "LetsGo (System)",
      })));

      // Fetch addon subscriptions
      const { data: addonData } = await supabaseBrowser
        .from("business_addon_subscriptions")
        .select("*")
        .order("created_at", { ascending: false });

      setAddonSubs((addonData || []).map(a => ({
        ...a,
        business_name: bizMap.get(a.business_id)?.name || a.business_id,
      })));

      // Fetch surge pricing events
      const { data: surgeData } = await supabaseBrowser
        .from("surge_pricing_events")
        .select("*")
        .order("start_date");
      setSurgeEvents(surgeData || []);
    } catch (err) {
      console.error("Error fetching advertising data:", err);
      addToast("Failed to load data", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ==================== HELPERS ====================
  const getAdOption = (id: string) => AD_OPTIONS.find(a => a.id === id);

  // Surge pricing: find overlapping surge events and return highest multiplier
  const calcSurgeForCampaign = (startDate: string, endDate: string, basePriceCents: number, businessCategory: string | null) => {
    const overlapping = surgeEvents.filter(e =>
      e.is_active &&
      e.multiplier_bps > 10000 &&
      e.start_date <= endDate &&
      e.end_date >= startDate &&
      (e.categories.length === 0 || !businessCategory || e.categories.includes(businessCategory))
    );
    if (overlapping.length === 0) return { surgeFee: 0, surgeEventId: null as string | null, multiplierBps: 10000, surgeEventName: "" };
    const maxEvent = overlapping.reduce((max, e) => e.multiplier_bps > max.multiplier_bps ? e : max);
    const surgeFee = Math.floor(basePriceCents * (maxEvent.multiplier_bps - 10000) / 10000);
    return { surgeFee, surgeEventId: maxEvent.id, multiplierBps: maxEvent.multiplier_bps, surgeEventName: maxEvent.name };
  };

  // Surge CRUD
  const saveSurgeEvent = async () => {
    if (!surgeForm.name || !surgeForm.start_date || !surgeForm.end_date) { addToast("Name and dates required", "warning"); return; }
    if (editingSurge) {
      const { error } = await supabaseBrowser.from("surge_pricing_events").update({
        name: surgeForm.name, description: surgeForm.description || null, start_date: surgeForm.start_date, end_date: surgeForm.end_date,
        categories: surgeForm.categories, multiplier_bps: surgeForm.multiplier_bps, impact: surgeForm.impact,
        suggested_products: surgeForm.suggested_products, is_active: surgeForm.is_active, updated_at: new Date().toISOString(),
      }).eq("id", editingSurge.id);
      if (error) { addToast("Update failed: " + error.message, "error"); return; }
      logAudit({ action: "update_surge", tab: AUDIT_TABS.ADVERTISING, subTab: "Surge Pricing", targetType: "surge_pricing", targetId: editingSurge.id, entityName: surgeForm.name, fieldName: "surge_event", oldValue: JSON.stringify({ name: editingSurge.name, multiplier_bps: editingSurge.multiplier_bps, start_date: editingSurge.start_date, end_date: editingSurge.end_date, categories: editingSurge.categories, impact: editingSurge.impact, is_active: editingSurge.is_active }), newValue: JSON.stringify({ name: surgeForm.name, multiplier_bps: surgeForm.multiplier_bps, start_date: surgeForm.start_date, end_date: surgeForm.end_date, categories: surgeForm.categories, impact: surgeForm.impact, is_active: surgeForm.is_active }), details: `Updated surge event: ${surgeForm.multiplier_bps / 100}% multiplier, ${surgeForm.start_date} to ${surgeForm.end_date}, active=${surgeForm.is_active}` });
      addToast("Surge event updated!", "success");
    } else {
      const { error } = await supabaseBrowser.from("surge_pricing_events").insert({
        name: surgeForm.name, description: surgeForm.description || null, start_date: surgeForm.start_date, end_date: surgeForm.end_date,
        categories: surgeForm.categories, multiplier_bps: surgeForm.multiplier_bps, impact: surgeForm.impact,
        suggested_products: surgeForm.suggested_products, is_active: surgeForm.is_active,
      });
      if (error) { addToast("Create failed: " + error.message, "error"); return; }
      logAudit({ action: "create_surge", tab: AUDIT_TABS.ADVERTISING, subTab: "Surge Pricing", targetType: "surge_pricing", entityName: surgeForm.name, details: `Created surge event: ${surgeForm.multiplier_bps / 100}% multiplier, ${surgeForm.start_date} to ${surgeForm.end_date}` });
      addToast("Surge event created!", "success");
    }
    setShowSurgeModal(false);
    setEditingSurge(null);
    setSurgeForm(emptySurgeForm);
    fetchData();
  };

  const deleteSurgeEvent = async (id: string) => {
    const surge = surgeEvents.find(s => s.id === id);
    const { error } = await supabaseBrowser.from("surge_pricing_events").delete().eq("id", id);
    if (error) { addToast("Delete failed: " + error.message, "error"); return; }
    logAudit({ action: "delete_surge", tab: AUDIT_TABS.ADVERTISING, subTab: "Surge Pricing", targetType: "surge_pricing", targetId: id, entityName: surge?.name || id, details: "Deleted surge pricing event" });
    addToast("Surge event deleted!", "success");
    fetchData();
  };

  const toggleSurgeActive = async (id: string, active: boolean) => {
    const surge = surgeEvents.find(s => s.id === id);
    const { error } = await supabaseBrowser.from("surge_pricing_events").update({ is_active: active, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) { addToast("Toggle failed: " + error.message, "error"); return; }
    logAudit({ action: active ? "activate_surge" : "deactivate_surge", tab: AUDIT_TABS.ADVERTISING, subTab: "Surge Pricing", targetType: "surge_pricing", targetId: id, entityName: surge?.name || id, fieldName: "is_active", oldValue: String(!active), newValue: String(active), details: `Surge event ${active ? "activated" : "deactivated"}` });
    addToast(active ? "Surge event activated" : "Surge event deactivated", "info");
    fetchData();
  };

  // Compute overlaps
  const computeOverlaps = (): OverlapPair[] => {
    const active = campaigns.filter(c => c.status === "active" || c.status === "scheduled" || c.status === "purchased" || c.status === "pending_payment");
    const pairs: OverlapPair[] = [];
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const c1 = active[i], c2 = active[j];
        const s1 = new Date(c1.start_date), e1 = new Date(c1.end_date);
        const s2 = new Date(c2.start_date), e2 = new Date(c2.end_date);
        if (s1 <= e2 && s2 <= e1) {
          const overlapStart = new Date(Math.max(s1.getTime(), s2.getTime()));
          const overlapEnd = new Date(Math.min(e1.getTime(), e2.getTime()));
          const overlapDays = Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / 86400000) + 1;
          const sameZip = c1.zip_code && c2.zip_code && c1.zip_code === c2.zip_code;
          const sameBusiness = c1.business_id === c2.business_id;
          const severity = sameZip ? "high" : sameBusiness ? "review" : "medium";
          const pairId = `${c1.id}-${c2.id}`;
          if (!approvedOverlaps.includes(pairId)) {
            pairs.push({ id: pairId, campaign1: c1, campaign2: c2, severity, overlapDays });
          }
        }
      }
    }
    return pairs.sort((a, b) => (a.severity === "high" ? -1 : b.severity === "high" ? 1 : 0));
  };

  // Campaigns on a specific date
  const campaignsOnDate = (dateStr: string) => {
    return campaigns.filter(c => (c.status === "active" || c.status === "scheduled" || c.status === "purchased" || c.status === "pending_payment") && c.start_date <= dateStr && c.end_date >= dateStr);
  };

  // Filter campaigns
  const filteredCampaigns = campaigns.filter(c => {
    if (adFilters.search && !c.business_name?.toLowerCase().includes(adFilters.search.toLowerCase())) return false;
    if (adFilters.status !== "all" && c.status !== adFilters.status) return false;
    if (adFilters.type !== "all") {
      const opt = getAdOption(c.campaign_type);
      if (opt?.type !== adFilters.type) return false;
    }
    return true;
  });

  // Filter overlaps
  const overlaps = computeOverlaps().filter(o => {
    if (overlapFilters.zip && !(o.campaign1.zip_code?.includes(overlapFilters.zip) || o.campaign2.zip_code?.includes(overlapFilters.zip))) return false;
    return true;
  });

  // Stats
  const activeCampaigns = campaigns.filter(c => c.status === "active").length;
  const scheduledCampaigns = campaigns.filter(c => c.status === "scheduled").length;
  const postponedCampaigns = campaigns.filter(c => c.status === "postponed").length;
  const pendingPayment = campaigns.filter(c => c.status === "pending_payment").length;
  const totalImpressions = campaigns.reduce((a, c) => a + c.impressions, 0);
  const totalAdRevenue = campaigns.filter(c => c.paid).reduce((a, c) => a + c.price_cents, 0);
  const totalSurgeRevenue = campaigns.filter(c => c.paid).reduce((a, c) => a + (c.surge_fee_cents || 0), 0);

  // ==================== SUPABASE ACTIONS ====================
  const createCampaign = async () => {
    if (!newCampaign.business_id || !newCampaign.ad_type) { addToast("Select a business and ad type", "warning"); return; }
    const opt = getAdOption(newCampaign.ad_type);
    if (!opt) return;
    const isSpotlight = opt.type === "spotlight";
    const isPush100 = newCampaign.ad_type === "ad_100mile";
    const isTour = newCampaign.ad_type === "ad_tourwide";
    if ((isSpotlight || isPush100) && (!newCampaign.start_date || !newCampaign.end_date)) { addToast("Start and end dates required", "warning"); return; }
    if (isTour && (!newCampaign.window_start || !newCampaign.window_end)) { addToast("60-day window dates required", "warning"); return; }
    if (isTour && newCampaign.priority_days.filter(Boolean).length < 7) { addToast("Select all 7 priority placement days", "warning"); return; }
    if (isTour && newCampaign.push_days.filter(Boolean).length < 14) { addToast("Select all 14 push notification days", "warning"); return; }

    // Compute surge pricing
    const campaignStart = isTour ? newCampaign.window_start : newCampaign.start_date;
    const campaignEnd = isTour ? newCampaign.window_end : newCampaign.end_date;
    const biz = businesses.find(b => b.id === newCampaign.business_id);
    const bizCfg = biz ? (biz as unknown as Record<string, unknown>).config : null;
    const bizCategory = (bizCfg && typeof bizCfg === "object" ? (bizCfg as Record<string, unknown>).businessType as string : null) || null;
    const { surgeFee, surgeEventId, multiplierBps } = calcSurgeForCampaign(campaignStart, campaignEnd, opt.price, bizCategory);

    const { error } = await supabaseBrowser.from("business_ad_campaigns").insert({
      business_id: newCampaign.business_id,
      campaign_type: newCampaign.ad_type,
      start_date: campaignStart,
      end_date: campaignEnd,
      base_price_cents: opt.price,
      surge_fee_cents: surgeFee,
      surge_event_id: surgeEventId,
      surge_multiplier_bps: multiplierBps,
      price_cents: opt.price + surgeFee,
      status: "scheduled",
      zip_code: newCampaign.zip_code || null,
      push_message: newCampaign.push_message || null,
      window_start: isTour ? newCampaign.window_start : null,
      window_end: isTour ? newCampaign.window_end : null,
      priority_days: isTour ? newCampaign.priority_days.filter(Boolean) : null,
      push_days: isTour ? newCampaign.push_days.filter(Boolean) : null,
    });
    if (error) { addToast("Failed to create campaign: " + error.message, "error"); return; }
    const bizName = businesses.find(b => b.id === newCampaign.business_id)?.name || newCampaign.business_id;
    logAudit({ action: "create_campaign", tab: AUDIT_TABS.ADVERTISING, subTab: "Campaigns", targetType: "campaign", targetId: newCampaign.business_id, entityName: bizName, details: `Created ${opt.name} campaign for ${bizName}, price ${formatMoney(opt.price + surgeFee)}${surgeFee > 0 ? ` (includes ${formatMoney(surgeFee)} surge)` : ""}` });
    addToast("Campaign created!", "success");
    setShowCreateAdModal(false);
    setNewCampaign({ ...emptyNewCampaign });
    fetchData();
  };

  const updateCampaignStatus = async (id: string, status: string, extra?: Record<string, unknown>) => {
    const camp = campaigns.find(c => c.id === id);
    const { error } = await supabaseBrowser.from("business_ad_campaigns").update({ status, ...extra }).eq("id", id);
    if (error) { addToast("Update failed: " + error.message, "error"); return; }
    logAudit({ action: "update_campaign_status", tab: AUDIT_TABS.ADVERTISING, subTab: "Campaigns", targetType: "campaign", targetId: id, entityName: camp?.business_name || id, fieldName: "status", oldValue: camp?.status || "", newValue: status, details: `Campaign status changed to "${status}" for ${camp?.business_name || id}` });
    addToast("Campaign updated!", "success");
    fetchData();
  };

  const markCampaignPaid = async (id: string) => {
    const camp = campaigns.find(c => c.id === id);
    const { error } = await supabaseBrowser.from("business_ad_campaigns").update({ paid: true, paid_at: new Date().toISOString() }).eq("id", id);
    if (error) { addToast("Failed: " + error.message, "error"); return; }
    logAudit({ action: "mark_campaign_paid", tab: AUDIT_TABS.ADVERTISING, subTab: "Campaigns", targetType: "campaign", targetId: id, entityName: camp?.business_name || id, fieldName: "paid", oldValue: "false", newValue: "true", details: `Marked campaign as paid for ${camp?.business_name || id}, amount ${camp ? formatMoney(camp.price_cents) : "unknown"}` });
    addToast("Campaign marked as paid!", "success");
    fetchData();
  };

  const postponeCampaignAction = async () => {
    if (!postponeCampaign) return;
    const isReschedule = postponeCampaign.status === "postponed";
    const isTour = postponeCampaign.campaign_type === "ad_tourwide";
    const updates: Record<string, unknown> = {
      status: isReschedule ? "scheduled" : "postponed",
      postpone_reason: postponeForm.reason || null,
    };
    if (isTour && postponeForm.window_start) {
      updates.window_start = postponeForm.window_start;
      updates.window_end = postponeForm.window_end;
      updates.start_date = postponeForm.window_start;
      updates.end_date = postponeForm.window_end;
    } else if (postponeForm.start_date) {
      updates.start_date = postponeForm.start_date;
      updates.end_date = postponeForm.end_date;
    }
    const { error } = await supabaseBrowser.from("business_ad_campaigns").update(updates).eq("id", postponeCampaign.id);
    if (error) { addToast("Failed: " + error.message, "error"); return; }
    logAudit({ action: isReschedule ? "reschedule_campaign" : "postpone_campaign", tab: AUDIT_TABS.ADVERTISING, subTab: "Campaigns", targetType: "campaign", targetId: postponeCampaign.id, entityName: postponeCampaign.business_name || postponeCampaign.id, fieldName: "status", oldValue: JSON.stringify({ status: postponeCampaign.status, start_date: postponeCampaign.start_date, end_date: postponeCampaign.end_date, window_start: postponeCampaign.window_start, window_end: postponeCampaign.window_end }), newValue: JSON.stringify({ status: isReschedule ? "scheduled" : "postponed", start_date: postponeForm.start_date || postponeCampaign.start_date, end_date: postponeForm.end_date || postponeCampaign.end_date, window_start: postponeForm.window_start || postponeCampaign.window_start, window_end: postponeForm.window_end || postponeCampaign.window_end }), details: `${isReschedule ? "Rescheduled" : "Postponed"} campaign for ${postponeCampaign.business_name || postponeCampaign.id}${postponeForm.reason ? `, reason: ${postponeForm.reason}` : ""}` });
    addToast(isReschedule ? "Campaign rescheduled!" : "Campaign postponed!", "success");
    setShowPostponeModal(false);
    setPostponeCampaign(null);
    setPostponeForm({ start_date: "", end_date: "", window_start: "", window_end: "", reason: "" });
    fetchData();
  };

  const deleteCampaign = async (id: string) => {
    const camp = campaigns.find(c => c.id === id);
    const { error } = await supabaseBrowser.from("business_ad_campaigns").delete().eq("id", id);
    if (error) { addToast("Delete failed: " + error.message, "error"); return; }
    logAudit({ action: "delete_campaign", tab: AUDIT_TABS.ADVERTISING, subTab: "Campaigns", targetType: "campaign", targetId: id, entityName: camp?.business_name || id, details: `Deleted ${camp?.campaign_type || "unknown"} campaign for ${camp?.business_name || id}` });
    addToast("Campaign deleted!", "success");
    setSelectedCampaign(null);
    fetchData();
  };

  const createPushCampaign = async () => {
    if (!newPush.name || !newPush.message) { addToast("Name and message required", "warning"); return; }
    const { error } = await supabaseBrowser.from("push_campaigns").insert({
      name: newPush.name,
      message: newPush.message,
      type: newPush.type,
      business_id: newPush.business_id || null,
      target_audience: newPush.target_audience,
      radius: newPush.radius || null,
      scheduled_at: newPush.scheduled_at || null,
      status: newPush.scheduled_at ? "scheduled" : "draft",
      created_by: "Staff",
    });
    if (error) { addToast("Failed: " + error.message, "error"); return; }
    const pushBizName = newPush.business_id ? (businesses.find(b => b.id === newPush.business_id)?.name || newPush.business_id) : "LetsGo (System)";
    logAudit({ action: "create_push_campaign", tab: AUDIT_TABS.ADVERTISING, subTab: "Push Notifications", targetType: "push_notification", entityName: newPush.name, details: `Created ${newPush.type} push campaign "${newPush.name}" for ${pushBizName}, audience: ${newPush.target_audience}` });
    addToast("Push campaign created!", "success");
    setShowCreatePushModal(false);
    setNewPush({ name: "", message: "", type: "promotional", business_id: "", target_audience: "nearby_users", radius: "10mi", scheduled_at: "" });
    fetchData();
  };

  const sendPushNow = async (id: string) => {
    const push = pushCampaigns.find(p => p.id === id);
    const { error } = await supabaseBrowser.from("push_campaigns").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", id);
    if (error) { addToast("Failed: " + error.message, "error"); return; }
    logAudit({ action: "send_push_campaign", tab: AUDIT_TABS.ADVERTISING, subTab: "Push Notifications", targetType: "push_notification", targetId: id, entityName: push?.name || id, fieldName: "status", oldValue: push?.status || "", newValue: "sent", details: `Sent push campaign "${push?.name || id}" immediately` });
    addToast("Push campaign sent!", "success");
    fetchData();
  };

  const assignAddon = async (businessId: string) => {
    if (!addonToAssign) return;
    const { error } = await supabaseBrowser.from("business_addon_subscriptions").insert({
      business_id: businessId,
      addon_type: addonToAssign.id,
      price_cents: addonToAssign.price,
      status: "active",
      started_at: new Date().toISOString(),
      next_billing: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
    });
    if (error) { addToast("Failed: " + error.message, "error"); return; }
    const addonBizName = businesses.find(b => b.id === businessId)?.name || businessId;
    logAudit({ action: "assign_addon", tab: AUDIT_TABS.ADVERTISING, subTab: "Add-ons", targetType: "addon", targetId: businessId, entityName: addonBizName, details: `Assigned ${addonToAssign.name} (${formatMoney(addonToAssign.price)}/mo) to ${addonBizName}` });
    addToast(`${addonToAssign.name} assigned!`, "success");
    setShowAssignAddonModal(false);
    setAddonToAssign(null);
    fetchData();
  };

  const assignTpms = async (businessId: string) => {
    const { error } = await supabaseBrowser.from("business_addon_subscriptions").insert({
      business_id: businessId,
      addon_type: "tpms",
      price_cents: TPMS_SERVICE.price,
      status: "active",
      started_at: new Date().toISOString(),
      next_billing: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
    });
    if (error) { addToast("Failed: " + error.message, "error"); return; }
    const tpmsBizName = businesses.find(b => b.id === businessId)?.name || businessId;
    logAudit({ action: "assign_tpms", tab: AUDIT_TABS.ADVERTISING, subTab: "Optional Services", targetType: "addon", targetId: businessId, entityName: tpmsBizName, details: `Assigned TPMS service (${formatMoney(TPMS_SERVICE.price)}/mo) to ${tpmsBizName}` });
    addToast("TPMS service assigned!", "success");
    fetchData();
  };

  const cancelAddon = async (id: string) => {
    const addon = addonSubs.find(a => a.id === id);
    const { error } = await supabaseBrowser.from("business_addon_subscriptions").update({ status: "cancelled", cancelled_at: new Date().toISOString(), auto_renew: false }).eq("id", id);
    if (error) { addToast("Failed: " + error.message, "error"); return; }
    logAudit({ action: "cancel_addon", tab: AUDIT_TABS.ADVERTISING, subTab: "Add-ons", targetType: "addon", targetId: id, entityName: addon?.business_name || id, fieldName: "status", oldValue: addon?.status || "active", newValue: "cancelled", details: `Cancelled ${addon?.addon_type || "unknown"} subscription for ${addon?.business_name || id}` });
    addToast("Subscription cancelled", "warning");
    fetchData();
  };

  const activateAddon = async (id: string) => {
    const addon = addonSubs.find(a => a.id === id);
    const { error } = await supabaseBrowser.from("business_addon_subscriptions").update({ status: "active", started_at: new Date().toISOString(), next_billing: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0] }).eq("id", id);
    if (error) { addToast("Failed: " + error.message, "error"); return; }
    logAudit({ action: "activate_addon", tab: AUDIT_TABS.ADVERTISING, subTab: "Add-ons", targetType: "addon", targetId: id, entityName: addon?.business_name || id, fieldName: "status", oldValue: addon?.status || "pending", newValue: "active", details: `Activated ${addon?.addon_type || "unknown"} subscription for ${addon?.business_name || id}` });
    addToast("Add-on activated!", "success");
    fetchData();
  };

  // ==================== LOADING ====================
  if (loading) {
    return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.textSecondary }}>Loading advertising data...</div>;
  }

  // ==================== TABS CONFIG ====================
  const tabs = [
    { key: "campaigns", label: "📢 Ad Campaigns", count: activeCampaigns + scheduledCampaigns },
    { key: "push", label: "📱 Push Notifications", count: pushCampaigns.filter(c => c.status === "scheduled" || c.status === "active").length },
    { key: "addons", label: "⭐ Premium Add-ons", count: addonSubs.filter(a => a.status === "active" && a.addon_type !== "tpms").length },
    { key: "services", label: "🎯 Optional Services", count: addonSubs.filter(a => a.addon_type === "tpms" && a.status === "active").length },
    { key: "history", label: "📋 Marketing History", count: campaigns.length + pushCampaigns.length + addonSubs.length },
    { key: "forecast", label: "📈 Marketing Forecast", count: surgeEvents.filter(e => e.is_active).length },
  ];

  return (
    <div style={{ flex: 1, padding: 32, overflowY: "auto" }}>
      {/* ==================== HEADER ==================== */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, background: COLORS.gradient1, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>📣 Advertising & Add-ons</h1>
        <button onClick={() => setShowCreateAdModal(true)} style={{ ...btnPrimary }}>+ Create Campaign</button>
      </div>

      {/* ==================== SUB-TABS ==================== */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{ padding: "12px 24px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600, background: activeTab === tab.key ? COLORS.gradient1 : COLORS.cardBg, color: activeTab === tab.key ? "#fff" : COLORS.textSecondary, display: "flex", alignItems: "center", gap: 8 }}>
            {tab.label}
            <span style={{ padding: "2px 8px", borderRadius: 6, background: activeTab === tab.key ? "rgba(255,255,255,0.2)" : COLORS.darkBg, fontSize: 11 }}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* ==================== AD CAMPAIGNS TAB ==================== */}
      {activeTab === "campaigns" && (
        <>
          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 16, marginBottom: 24 }}>
            <StatCard icon="🎯" value={activeCampaigns} label="Active" gradient={COLORS.gradient2} />
            <StatCard icon="📅" value={scheduledCampaigns} label="Scheduled" gradient={COLORS.gradient3} />
            <StatCard icon="⏸️" value={postponedCampaigns} label="Postponed" gradient={COLORS.gradient4} />
            <StatCard icon="⏳" value={pendingPayment} label="Pending Pay" gradient="linear-gradient(135deg, #ffff00, #ff6b35)" />
            <StatCard icon="👁️" value={totalImpressions.toLocaleString()} label="Impressions" gradient={COLORS.gradient1} />
            <StatCard icon="💰" value={formatMoney(totalAdRevenue)} label="Revenue" gradient="linear-gradient(135deg, #39ff14, #00d4ff)" />
            <StatCard icon="🔥" value={formatMoney(totalSurgeRevenue)} label="Surge Rev" gradient="linear-gradient(135deg, #ff6b35, #ff2d92)" />
          </div>

          {/* Available Ad Types */}
          <Card title="📋 AVAILABLE ADVERTISING OPTIONS" style={{ marginBottom: 24 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 20 }}>
              {AD_OPTIONS.filter(a => a.type === "spotlight").map(opt => (
                <div key={opt.id} style={{ padding: 20, background: COLORS.darkBg, borderRadius: 12, border: "2px solid " + COLORS.cardBorder }}>
                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{opt.name}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: COLORS.neonGreen, marginBottom: 8 }}>{formatMoney(opt.price)}</div>
                  <div style={{ fontSize: 11, color: COLORS.neonBlue, marginBottom: 8 }}>📍 {opt.radius}</div>
                  <div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 12, lineHeight: 1.5 }}>{opt.description}</div>
                  <button onClick={() => { setNewCampaign({ ...newCampaign, ad_type: opt.id }); setShowCreateAdModal(true); }} style={{ width: "100%", padding: 12, background: "transparent", border: "2px solid " + COLORS.neonBlue, borderRadius: 8, color: COLORS.neonBlue, cursor: "pointer", fontWeight: 600 }}>Select</button>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {AD_OPTIONS.filter(a => a.type === "push").map(opt => (
                <div key={opt.id} style={{ padding: 20, background: COLORS.darkBg, borderRadius: 12, border: opt.featured ? "2px solid " + COLORS.neonGreen : "2px solid " + COLORS.cardBorder, position: "relative" }}>
                  {opt.featured && <span style={{ position: "absolute", top: 12, right: 12, padding: "4px 10px", background: COLORS.neonGreen, borderRadius: 6, fontSize: 10, fontWeight: 700, color: "#000" }}>FEATURED</span>}
                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{opt.name}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: COLORS.neonOrange, marginBottom: 8 }}>{formatMoney(opt.price)}</div>
                  <div style={{ fontSize: 11, color: COLORS.neonBlue, marginBottom: 8 }}>📍 {opt.radius}</div>
                  <div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 12, lineHeight: 1.5 }}>{opt.description}</div>
                  <button onClick={() => { setNewCampaign({ ...newCampaign, ad_type: opt.id }); setShowCreateAdModal(true); }} style={{ width: "100%", padding: 12, background: opt.featured ? COLORS.neonGreen : "transparent", border: opt.featured ? "none" : "2px solid " + COLORS.neonOrange, borderRadius: 8, color: opt.featured ? "#000" : COLORS.neonOrange, cursor: "pointer", fontWeight: 600 }}>Select</button>
                </div>
              ))}
            </div>
          </Card>

          {/* Overlap Detection */}
          <Card title="⚠️ CAMPAIGN OVERLAP DETECTION" style={{ marginBottom: 24, borderColor: COLORS.neonOrange }}>
            <div style={{ padding: 12, background: "rgba(255,107,53,0.1)", borderRadius: 10, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 18 }}>🔍</span>
                <span style={{ fontWeight: 600, color: COLORS.neonOrange }}>Overlapping Campaigns Checker</span>
              </div>
              <div style={{ fontSize: 12, color: COLORS.textSecondary }}>Identifies campaigns running on the same dates within overlapping areas. Conflicts may cause ad saturation or billing issues.</div>
            </div>
            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              <input type="text" placeholder="Filter by zip code..." value={overlapFilters.zip} onChange={e => setOverlapFilters({ ...overlapFilters, zip: e.target.value })} style={{ ...inputStyle, width: 150 }} />
              <select value={overlapFilters.state} onChange={e => setOverlapFilters({ ...overlapFilters, state: e.target.value })} style={inputStyle}>
                <option value="">All States</option>
                <option value="NE">Nebraska</option>
                <option value="IA">Iowa</option>
                <option value="KS">Kansas</option>
              </select>
            </div>
            {overlaps.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: COLORS.neonGreen }}>✓ No overlapping campaigns detected!</div>
            ) : (
              <div style={{ background: COLORS.darkBg, borderRadius: 10, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "70px 1fr 160px 100px 90px 80px 80px", gap: 8, padding: "10px 14px", background: COLORS.cardBg, fontSize: 10, color: COLORS.textSecondary, fontWeight: 600, textTransform: "uppercase" }}>
                  <div>Severity</div><div>Conflicting Campaigns</div><div>Dates</div><div>Zip Codes</div><div>Overlap</div><div>Type</div><div>Action</div>
                </div>
                {overlaps.map(o => (
                  <div key={o.id} style={{ display: "grid", gridTemplateColumns: "70px 1fr 160px 100px 90px 80px 80px", gap: 8, padding: "12px 14px", borderTop: "1px solid " + COLORS.cardBorder, alignItems: "center" }}>
                    <div>
                      <span style={{ padding: "4px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600, background: o.severity === "high" ? "rgba(255,49,49,0.2)" : o.severity === "medium" ? "rgba(255,255,0,0.2)" : "rgba(138,43,226,0.2)", color: o.severity === "high" ? COLORS.neonRed : o.severity === "medium" ? COLORS.neonYellow : COLORS.neonPurple }}>{o.severity.toUpperCase()}</span>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{o.campaign1.business_name} ({getAdOption(o.campaign1.campaign_type)?.name})</div>
                      <div style={{ fontSize: 11, color: COLORS.textSecondary }}>vs {o.campaign2.business_name} ({getAdOption(o.campaign2.campaign_type)?.name})</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: COLORS.neonBlue }}>{formatDate(o.campaign1.start_date)} - {formatDate(o.campaign1.end_date)}</div>
                      <div style={{ fontSize: 10, color: COLORS.neonPink }}>{formatDate(o.campaign2.start_date)} - {formatDate(o.campaign2.end_date)}</div>
                    </div>
                    <div style={{ fontSize: 11 }}>{o.campaign1.zip_code || "—"} / {o.campaign2.zip_code || "—"}</div>
                    <div style={{ fontSize: 11 }}>{o.overlapDays} days</div>
                    <div style={{ fontSize: 11 }}>{getAdOption(o.campaign1.campaign_type)?.radius}</div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => setOverlapAction({ type: "resolve", id: o.id, campaign1: o.campaign1, campaign2: o.campaign2 })} style={{ padding: "4px 8px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 4, color: COLORS.textSecondary, cursor: "pointer", fontSize: 10 }}>Resolve</button>
                      <button onClick={() => { setApprovedOverlaps(prev => [...prev, o.id]); addToast("Overlap approved!", "success"); }} style={{ padding: "4px 8px", background: "rgba(57,255,20,0.2)", border: "1px solid " + COLORS.neonGreen, borderRadius: 4, color: COLORS.neonGreen, cursor: "pointer", fontSize: 10 }}>✓</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Campaign Calendar */}
          <Card title="📅 CAMPAIGN CALENDAR" style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div />
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1))} style={{ padding: "8px 12px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 6, color: COLORS.textPrimary, cursor: "pointer" }}>←</button>
                <span style={{ minWidth: 140, textAlign: "center", fontWeight: 600 }}>{calendarMonth.toLocaleString("default", { month: "long", year: "numeric" })}</span>
                <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1))} style={{ padding: "8px 12px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 6, color: COLORS.textPrimary, cursor: "pointer" }}>→</button>
                <button onClick={() => setCalendarMonth(new Date())} style={{ padding: "8px 12px", background: COLORS.gradient1, border: "none", borderRadius: 6, color: "#fff", cursor: "pointer", fontSize: 12 }}>Today</button>
              </div>
            </div>
            <div style={{ background: COLORS.darkBg, borderRadius: 12, padding: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 8 }}>
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
                  <div key={day} style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: COLORS.textSecondary, padding: 8 }}>{day}</div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
                {(() => {
                  const year = calendarMonth.getFullYear();
                  const month = calendarMonth.getMonth();
                  const firstDay = new Date(year, month, 1).getDay();
                  const daysInMonth = new Date(year, month + 1, 0).getDate();
                  const days: React.ReactNode[] = [];
                  for (let i = 0; i < firstDay; i++) days.push(<div key={`e-${i}`} style={{ padding: 8, minHeight: 80 }} />);
                  for (let day = 1; day <= daysInMonth; day++) {
                    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                    const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();
                    const dayCamps = campaignsOnDate(dateStr);
                    const hasAds = dayCamps.length > 0;
                    const zips = dayCamps.map(c => c.zip_code).filter(Boolean);
                    const hasConflict = new Set(zips).size < zips.length && zips.length > 1;
                    const isSelected = selectedCalendarDate === dateStr;
                    days.push(
                      <div key={day} onClick={() => setSelectedCalendarDate(isSelected ? null : dateStr)} style={{ padding: 8, minHeight: 80, background: isSelected ? "rgba(0,212,255,0.2)" : hasConflict ? "rgba(255,49,49,0.15)" : hasAds ? "rgba(57,255,20,0.08)" : COLORS.cardBg, borderRadius: 8, cursor: "pointer", border: isToday ? "2px solid " + COLORS.neonBlue : hasConflict ? "2px solid " + COLORS.neonRed : "1px solid " + COLORS.cardBorder, transition: "all 0.2s" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <span style={{ fontSize: 14, fontWeight: isToday ? 700 : 500, color: isToday ? COLORS.neonBlue : COLORS.textPrimary }}>{day}</span>
                          {hasConflict && <span style={{ fontSize: 12 }}>⚠️</span>}
                          {hasAds && !hasConflict && <span style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.neonGreen, display: "inline-block" }} />}
                        </div>
                        {hasConflict && <div style={{ fontSize: 9, color: COLORS.neonRed, marginTop: 4 }}>Conflict</div>}
                        {hasAds && !hasConflict && <div style={{ fontSize: 9, color: COLORS.textSecondary, marginTop: 4 }}>{dayCamps.length} ad{dayCamps.length > 1 ? "s" : ""}</div>}
                      </div>
                    );
                  }
                  return days;
                })()}
              </div>
              <div style={{ display: "flex", gap: 20, marginTop: 16, justifyContent: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}><div style={{ width: 16, height: 16, borderRadius: 4, background: "rgba(255,49,49,0.15)", border: "2px solid " + COLORS.neonRed }} /><span style={{ color: COLORS.textSecondary }}>Conflict</span></div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}><div style={{ width: 16, height: 16, borderRadius: 4, background: "rgba(57,255,20,0.08)", border: "1px solid " + COLORS.cardBorder }} /><span style={{ color: COLORS.textSecondary }}>Active Campaigns</span></div>
              </div>
            </div>
            {/* Selected Date Detail */}
            {selectedCalendarDate && (() => {
              const dayCamps = campaignsOnDate(selectedCalendarDate);
              return (
                <div style={{ marginTop: 16, padding: 20, background: COLORS.cardBg, borderRadius: 12, border: "1px solid " + COLORS.neonBlue }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>📋 {new Date(selectedCalendarDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</div>
                    <button onClick={() => setSelectedCalendarDate(null)} style={{ background: "none", border: "none", fontSize: 18, color: COLORS.textSecondary, cursor: "pointer" }}>×</button>
                  </div>
                  {dayCamps.length === 0 ? (
                    <div style={{ color: COLORS.textSecondary, textAlign: "center", padding: 20 }}>No campaigns on this date</div>
                  ) : (
                    <div style={{ display: "grid", gap: 10 }}>
                      {dayCamps.map(c => (
                        <div key={c.id} style={{ padding: 12, background: COLORS.darkBg, borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <div style={{ fontWeight: 600 }}>{c.business_name} - {getAdOption(c.campaign_type)?.name}</div>
                            <div style={{ fontSize: 11, color: COLORS.textSecondary }}>{c.zip_code ? `${c.zip_code} • ` : ""}{getAdOption(c.campaign_type)?.radius}</div>
                          </div>
                          <Badge status={c.status} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </Card>

          {/* Campaign Management Table */}
          <Card title="🎯 CAMPAIGN MANAGEMENT">
            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              <input type="text" placeholder="Search campaigns..." value={adFilters.search} onChange={e => setAdFilters({ ...adFilters, search: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
              <select value={adFilters.status} onChange={e => setAdFilters({ ...adFilters, status: e.target.value })} style={inputStyle}>
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="scheduled">Scheduled</option>
                <option value="postponed">Postponed</option>
                <option value="pending_payment">Pending Payment</option>
                <option value="completed">Completed</option>
              </select>
              <select value={adFilters.type} onChange={e => setAdFilters({ ...adFilters, type: e.target.value })} style={inputStyle}>
                <option value="all">All Types</option>
                <option value="spotlight">Spotlight</option>
                <option value="push">Push</option>
              </select>
            </div>
            <DataTable
              columns={[
                { key: "meta", label: "Preview", render: (_v, row) => {
                  const meta = (row.meta && typeof row.meta === "object") ? row.meta as Record<string, unknown> : {};
                  const urls: string[] = Array.isArray(meta.image_urls)
                    ? (meta.image_urls as string[]).filter(u => typeof u === "string" && u)
                    : meta.image_url ? [String(meta.image_url)] : [];
                  const firstUrl = urls[0] || null;
                  const isVid = firstUrl ? /\.(mp4|mov|webm|avi)$/i.test(firstUrl) : false;
                  return firstUrl && !isVid ? (
                    <div style={{ position: "relative", width: 48, height: 48 }}>
                      <img src={firstUrl} alt="Ad" style={{ width: 48, height: 48, borderRadius: 6, objectFit: "cover", border: "1px solid rgba(255,255,255,0.1)" }} />
                      {urls.length > 1 && <div style={{ position: "absolute", bottom: -2, right: -2, background: COLORS.neonBlue, borderRadius: 8, padding: "0 4px", fontSize: 9, fontWeight: 700, color: "#fff" }}>{urls.length}</div>}
                    </div>
                  ) : (
                    <div style={{ width: 48, height: 48, borderRadius: 6, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "rgba(255,255,255,0.2)" }}>{firstUrl && isVid ? "🎬" : "📢"}</div>
                  );
                }},
                { key: "business_name", label: "Business", render: (v, row) => (
                  <div>
                    <div style={{ fontWeight: 600 }}>{String(v)}</div>
                    {!!row.promo_text && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontStyle: "italic", marginTop: 2, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>&ldquo;{String(row.promo_text)}&rdquo;</div>}
                  </div>
                )},
                { key: "campaign_type", label: "Type", render: (v) => <span style={{ fontWeight: 600 }}>{getAdOption(String(v))?.name || String(v)}</span> },
                { key: "status", label: "Status", render: (v) => <Badge status={String(v)} /> },
                { key: "start_date", label: "Dates", render: (v, row) => <span style={{ fontSize: 12 }}>{formatDate(String(v))} - {formatDate(String(row.end_date))}</span> },
                { key: "price_cents", label: "Price", align: "right", render: (v) => <span style={{ fontWeight: 700 }}>{formatMoney(Number(v))}</span> },
                { key: "paid", label: "Paid", render: (v, row) => v ? <span style={{ color: COLORS.neonGreen }}>✓ {formatDate(String(row.paid_at))}</span> : <span style={{ color: COLORS.neonRed }}>✗ Unpaid</span> },
                { key: "impressions", label: "Impr.", align: "right", render: (v) => Number(v).toLocaleString() },
                { key: "clicks", label: "Clicks", align: "right", render: (v) => Number(v).toLocaleString() },
                { key: "id", label: "", align: "right", render: (_v, row) => (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <button onClick={() => setPreviewCampaign(row as unknown as AdCampaign)} style={{ padding: "6px 10px", background: "rgba(0,212,255,0.15)", border: "1px solid " + COLORS.neonBlue, borderRadius: 6, color: COLORS.neonBlue, cursor: "pointer", fontSize: 10 }}>Preview</button>
                    {String(row.status) === "pending_payment" && <button onClick={() => markCampaignPaid(String(row.id))} style={{ padding: "6px 10px", background: "rgba(57,255,20,0.2)", border: "1px solid " + COLORS.neonGreen, borderRadius: 6, color: COLORS.neonGreen, cursor: "pointer", fontSize: 10 }}>Mark Paid</button>}
                    {String(row.status) === "active" && <button onClick={() => updateCampaignStatus(String(row.id), "paused")} style={{ padding: "6px 10px", background: "rgba(255,255,0,0.2)", border: "1px solid " + COLORS.neonYellow, borderRadius: 6, color: COLORS.neonYellow, cursor: "pointer", fontSize: 10 }}>Pause</button>}
                    {(String(row.status) === "scheduled" || String(row.status) === "active") && <button onClick={() => { setPostponeCampaign(row as unknown as AdCampaign); setShowPostponeModal(true); }} style={{ padding: "6px 10px", background: "rgba(138,43,226,0.2)", border: "1px solid " + COLORS.neonPurple, borderRadius: 6, color: COLORS.neonPurple, cursor: "pointer", fontSize: 10 }}>Postpone</button>}
                    {String(row.status) === "postponed" && <button onClick={() => { setPostponeCampaign(row as unknown as AdCampaign); setShowPostponeModal(true); }} style={{ padding: "6px 10px", background: "rgba(0,212,255,0.2)", border: "1px solid " + COLORS.neonBlue, borderRadius: 6, color: COLORS.neonBlue, cursor: "pointer", fontSize: 10 }}>Reschedule</button>}
                    <button onClick={() => setSelectedCampaign(row as unknown as AdCampaign)} style={{ padding: "6px 10px", background: COLORS.gradient1, border: "none", borderRadius: 6, color: "#fff", cursor: "pointer", fontSize: 10 }}>Edit</button>
                  </div>
                )},
              ]}
              data={filteredCampaigns as unknown as Record<string, unknown>[]}
            />
          </Card>
        </>
      )}

      {/* ==================== PUSH NOTIFICATIONS TAB ==================== */}
      {activeTab === "push" && (
        <>
          {/* Push Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 16, marginBottom: 24 }}>
            <StatCard icon="📱" value={pushCampaigns.filter(c => c.status === "active" || c.status === "scheduled").length} label="Active/Scheduled" gradient={COLORS.gradient2} />
            <StatCard icon="📤" value={pushCampaigns.reduce((a, c) => a + c.delivered, 0).toLocaleString()} label="Delivered" gradient={COLORS.gradient1} />
            <StatCard icon="👁️" value={pushCampaigns.reduce((a, c) => a + c.opened, 0).toLocaleString()} label="Opened" gradient={COLORS.gradient3} />
            <StatCard icon="👆" value={pushCampaigns.reduce((a, c) => a + c.clicked, 0).toLocaleString()} label="Clicked" gradient={COLORS.gradient4} />
            <StatCard icon="🎯" value={(() => { const d = pushCampaigns.reduce((a, c) => a + c.delivered, 0); const o = pushCampaigns.reduce((a, c) => a + c.opened, 0); return d > 0 ? ((o / d) * 100).toFixed(1) + "%" : "0%"; })()} label="Open Rate" gradient="linear-gradient(135deg, #39ff14, #00d4ff)" />
            <StatCard icon="💰" value={pushCampaigns.reduce((a, c) => a + c.conversions, 0)} label="Conversions" gradient="linear-gradient(135deg, #ff2d92, #bf5fff)" />
          </div>

          {/* Quick Actions */}
          <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
            <button onClick={() => setShowCreatePushModal(true)} style={{ ...btnPrimary, fontSize: 14 }}>📱 Create Push Campaign</button>
          </div>

          {/* Push Notification Types */}
          <Card title="📋 PUSH NOTIFICATION TYPES" style={{ marginBottom: 24 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
              {[
                { type: "promotional", icon: "🎉", name: "Promotional", desc: "Special offers, happy hours, events from businesses", color: COLORS.neonPink },
                { type: "system", icon: "⚙️", name: "System", desc: "App updates, maintenance, important notices", color: COLORS.neonBlue },
                { type: "re_engagement", icon: "💌", name: "Re-engagement", desc: "Bring back inactive users with incentives", color: COLORS.neonGreen },
                { type: "transactional", icon: "✅", name: "Transactional", desc: "Receipt approvals, payout confirmations", color: COLORS.neonOrange },
              ].map(t => (
                <div key={t.type} style={{ padding: 20, background: COLORS.darkBg, borderRadius: 12, border: "2px solid " + COLORS.cardBorder }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <span style={{ fontSize: 28 }}>{t.icon}</span>
                    <span style={{ fontWeight: 700, color: t.color }}>{t.name}</span>
                  </div>
                  <div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 12 }}>{t.desc}</div>
                  <button onClick={() => { setNewPush({ ...newPush, type: t.type }); setShowCreatePushModal(true); }} style={{ width: "100%", padding: 10, background: "transparent", border: "1px solid " + t.color, borderRadius: 8, color: t.color, cursor: "pointer", fontWeight: 600, fontSize: 12 }}>Create {t.name}</button>
                </div>
              ))}
            </div>
          </Card>

          {/* Active & Scheduled Push Campaigns */}
          <Card title="📅 ACTIVE & SCHEDULED CAMPAIGNS" style={{ marginBottom: 24 }}>
            {pushCampaigns.filter(c => c.status === "active" || c.status === "scheduled" || c.status === "draft").length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary }}>No active or scheduled push campaigns</div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {pushCampaigns.filter(c => c.status === "active" || c.status === "scheduled" || c.status === "draft").map(campaign => (
                  <div key={campaign.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: 16, background: COLORS.darkBg, borderRadius: 12, borderLeft: "4px solid " + (campaign.status === "active" ? COLORS.neonGreen : campaign.status === "scheduled" ? COLORS.neonBlue : COLORS.cardBorder) }}>
                    <div style={{ fontSize: 28 }}>{campaign.type === "promotional" ? "🎉" : campaign.type === "system" ? "⚙️" : campaign.type === "re_engagement" ? "💌" : "✅"}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: 15 }}>{campaign.name}</span>
                        <Badge status={campaign.status} />
                        {campaign.business_name && campaign.business_id && <span style={{ padding: "2px 8px", background: "rgba(255,45,146,0.2)", borderRadius: 4, fontSize: 10, color: COLORS.neonPink }}>🏢 {campaign.business_name}</span>}
                      </div>
                      <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 4 }}>&quot;{campaign.message}&quot;</div>
                      <div style={{ display: "flex", gap: 16, fontSize: 11, color: COLORS.textSecondary }}>
                        <span>📍 {campaign.target_audience.replace(/_/g, " ")} {campaign.radius ? `(${campaign.radius})` : ""}</span>
                        <span>👥 {campaign.recipients.toLocaleString()} recipients</span>
                        {campaign.scheduled_at && <span>📅 {formatDateTime(campaign.scheduled_at)}</span>}
                      </div>
                    </div>
                    {(campaign.status === "sent" || campaign.status === "active") ? (
                      <div style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", gap: 16, marginBottom: 4 }}>
                          <div><span style={{ fontSize: 10, color: COLORS.textSecondary }}>Delivered</span><div style={{ fontWeight: 600, color: COLORS.neonGreen }}>{campaign.delivered.toLocaleString()}</div></div>
                          <div><span style={{ fontSize: 10, color: COLORS.textSecondary }}>Opened</span><div style={{ fontWeight: 600, color: COLORS.neonBlue }}>{campaign.opened.toLocaleString()}</div></div>
                          <div><span style={{ fontSize: 10, color: COLORS.textSecondary }}>Clicked</span><div style={{ fontWeight: 600, color: COLORS.neonPink }}>{campaign.clicked.toLocaleString()}</div></div>
                        </div>
                        <div style={{ fontSize: 10, color: COLORS.textSecondary }}>{campaign.delivered > 0 ? ((campaign.opened / campaign.delivered) * 100).toFixed(1) : 0}% open rate</div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 8 }}>
                        {campaign.status === "scheduled" && <button onClick={() => sendPushNow(campaign.id)} style={{ padding: "8px 16px", background: COLORS.gradient1, border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Send Now</button>}
                        {campaign.status === "draft" && <button onClick={() => { supabaseBrowser.from("push_campaigns").update({ status: "scheduled", scheduled_at: new Date().toISOString() }).eq("id", campaign.id).then(() => { logAudit({ action: "schedule_push_campaign", tab: AUDIT_TABS.ADVERTISING, subTab: "Push Notifications", targetType: "push_notification", targetId: campaign.id, entityName: campaign.name, fieldName: "status", oldValue: "draft", newValue: "scheduled", details: `Scheduled push campaign "${campaign.name}"` }); addToast("Campaign scheduled!", "success"); fetchData(); }); }} style={{ padding: "8px 16px", background: COLORS.gradient2, border: "none", borderRadius: 8, color: "#000", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Schedule</button>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Sent Campaign History */}
          <Card title="📊 CAMPAIGN HISTORY">
            <DataTable
              columns={[
                { key: "name", label: "Campaign", render: (v, row) => <div><div style={{ fontWeight: 600 }}>{String(v)}</div><div style={{ fontSize: 10, color: COLORS.textSecondary }}>{String(row.business_name) || "System"}</div></div> },
                { key: "type", label: "Type", render: (v) => <span style={{ textTransform: "capitalize" }}>{String(v).replace(/_/g, " ")}</span> },
                { key: "sent_at", label: "Sent", render: (v) => v ? formatDateTime(String(v)) : "—" },
                { key: "recipients", label: "Recipients", align: "right", render: (v) => Number(v).toLocaleString() },
                { key: "delivered", label: "Delivered", align: "right", render: (v, row) => <span style={{ color: COLORS.neonGreen }}>{Number(v).toLocaleString()} ({Number(row.recipients) > 0 ? ((Number(v) / Number(row.recipients)) * 100).toFixed(0) : 0}%)</span> },
                { key: "opened", label: "Opened", align: "right", render: (v, row) => <span style={{ color: COLORS.neonBlue }}>{Number(v).toLocaleString()} ({Number(row.delivered) > 0 ? ((Number(v) / Number(row.delivered)) * 100).toFixed(0) : 0}%)</span> },
                { key: "conversions", label: "Conv.", align: "right", render: (v) => <span style={{ fontWeight: 600, color: COLORS.neonGreen }}>{Number(v)}</span> },
                { key: "status", label: "Status", render: (v) => <Badge status={String(v)} /> },
              ]}
              data={pushCampaigns.filter(c => c.status === "sent" || c.status === "completed") as unknown as Record<string, unknown>[]}
            />
          </Card>
        </>
      )}

      {/* ==================== PREMIUM ADD-ONS TAB ==================== */}
      {activeTab === "addons" && (
        <>
          <Card title="⭐ PREMIUM ADD-ONS" style={{ marginBottom: 24 }}>
            <div style={{ marginBottom: 16, color: COLORS.textSecondary, fontSize: 13 }}>Enhance Premium subscriptions with additional features. Click &quot;Assign to Business&quot; to manually add an add-on to a business.</div>
            <div style={{ display: "grid", gap: 12 }}>
              {PREMIUM_ADDONS.map(addon => (
                <div key={addon.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 20, background: COLORS.darkBg, borderRadius: 12, border: "1px solid " + COLORS.cardBorder }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                    <div style={{ width: 50, height: 50, borderRadius: 10, background: addon.category === "video" ? "rgba(255,45,146,0.2)" : "rgba(0,212,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>
                      {addon.category === "video" ? "🎬" : "📺"}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>{addon.name}</div>
                      <div style={{ fontSize: 12, color: COLORS.textSecondary }}>{addon.description}</div>
                      {addon.exclusive && <div style={{ fontSize: 10, color: COLORS.neonOrange, marginTop: 4 }}>⚠️ Exclusive: Only one live video capacity option per business</div>}
                      <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 4 }}>
                        <span style={{ color: COLORS.neonGreen }}>{addonSubs.filter(a => a.addon_type === addon.id && a.status === "active").length}</span> active subscriptions
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: COLORS.neonGreen, marginBottom: 8 }}>+{formatMoney(addon.price)}/mo</div>
                    <button onClick={() => { setAddonToAssign(addon); setAddonBusinessSearch(""); setShowAssignAddonModal(true); }} style={{ padding: "10px 20px", background: COLORS.gradient1, border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 12 }}>+ Assign to Business</button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="📋 BUSINESS ADD-ON SUBSCRIPTIONS">
            <DataTable
              columns={[
                { key: "id", label: "ID", render: (v) => <span style={{ fontFamily: "monospace", color: COLORS.neonPurple, fontSize: 10 }}>{String(v).slice(0, 8)}</span> },
                { key: "business_name", label: "Business", render: (v) => <span style={{ fontWeight: 600 }}>{String(v)}</span> },
                { key: "addon_type", label: "Add-on", render: (v) => { const a = PREMIUM_ADDONS.find(x => x.id === String(v)); return <span style={{ fontWeight: 600 }}>{a?.name || String(v)}</span>; } },
                { key: "status", label: "Status", render: (v) => <span style={{ padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 600, background: String(v) === "active" ? "rgba(57,255,20,0.2)" : String(v) === "pending" ? "rgba(255,255,0,0.2)" : "rgba(255,49,49,0.2)", color: String(v) === "active" ? COLORS.neonGreen : String(v) === "pending" ? COLORS.neonYellow : COLORS.neonRed }}>{String(v)}</span> },
                { key: "price_cents", label: "Price", align: "right", render: (v) => <span style={{ fontWeight: 700 }}>{formatMoney(Number(v))}/mo</span> },
                { key: "started_at", label: "Started", render: (v) => v ? formatDate(String(v)) : "—" },
                { key: "next_billing", label: "Next Billing", render: (v) => v ? formatDate(String(v)) : "—" },
                { key: "auto_renew", label: "Auto-Renew", render: (v) => v ? <span style={{ color: COLORS.neonGreen }}>✓ Yes</span> : <span style={{ color: COLORS.textSecondary }}>✗ No</span> },
                { key: "id", label: "", align: "right", render: (_v, row) => (
                  <div style={{ display: "flex", gap: 6 }}>
                    {String(row.status) === "active" && <button onClick={() => setConfirmModal({ title: "Cancel Add-on?", message: "This will cancel the add-on subscription. The business will lose access at the end of their billing cycle.", type: "danger", confirmText: "Cancel Add-on", onConfirm: () => cancelAddon(String(row.id)) })} style={{ padding: "6px 10px", background: "rgba(255,49,49,0.2)", border: "1px solid " + COLORS.neonRed, borderRadius: 6, color: COLORS.neonRed, cursor: "pointer", fontSize: 10 }}>Cancel</button>}
                    {String(row.status) === "pending" && <button onClick={() => activateAddon(String(row.id))} style={{ padding: "6px 10px", background: "rgba(57,255,20,0.2)", border: "1px solid " + COLORS.neonGreen, borderRadius: 6, color: COLORS.neonGreen, cursor: "pointer", fontSize: 10 }}>Activate</button>}
                  </div>
                )},
              ]}
              data={addonSubs.filter(a => a.addon_type !== "tpms") as unknown as Record<string, unknown>[]}
            />
          </Card>
        </>
      )}

      {/* ==================== OPTIONAL SERVICES (TPMS) TAB ==================== */}
      {activeTab === "services" && (
        <>
          <Card title="🎯 TOTAL PROFILE MANAGEMENT SERVICES (TPMS)" style={{ marginBottom: 24, borderColor: COLORS.neonOrange }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
              <div>
                <div style={{ padding: 20, background: "rgba(255,107,53,0.1)", borderRadius: 12, marginBottom: 20, border: "1px solid " + COLORS.neonOrange }}>
                  <div style={{ fontSize: 32, fontWeight: 700, color: COLORS.neonOrange, marginBottom: 8 }}>{formatMoney(TPMS_SERVICE.price)}/month</div>
                  <div style={{ fontSize: 14, color: COLORS.textSecondary, lineHeight: 1.6 }}>{TPMS_SERVICE.description}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>What&apos;s Included:</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {TPMS_SERVICE.features.map((feature, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: 12, background: COLORS.darkBg, borderRadius: 8 }}>
                      <span style={{ color: COLORS.neonGreen }}>✓</span>
                      <span style={{ fontSize: 13 }}>{feature}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 20 }}>
                  <button onClick={() => { setAddonToAssign({ id: "tpms", name: "TPMS", price: TPMS_SERVICE.price, description: TPMS_SERVICE.description, category: "tpms" }); setAddonBusinessSearch(""); setShowAssignAddonModal(true); }} style={{ ...btnPrimary, background: COLORS.neonOrange }}>+ Assign TPMS to Business</button>
                </div>
              </div>
              <div style={{ background: COLORS.darkBg, borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>TPMS Stats (All Active)</div>
                <div style={{ display: "grid", gap: 12 }}>
                  {(() => {
                    const tpmsSubs = addonSubs.filter(a => a.addon_type === "tpms" && a.status === "active");
                    const totalReceipts = tpmsSubs.reduce((a, s) => a + s.tpms_receipts_handled, 0);
                    const totalUpdates = tpmsSubs.reduce((a, s) => a + s.tpms_content_updates, 0);
                    const totalDisputes = tpmsSubs.reduce((a, s) => a + s.tpms_disputes_covered, 0);
                    return (
                      <>
                        <div style={{ padding: 12, background: COLORS.cardBg, borderRadius: 8 }}>
                          <div style={{ fontSize: 10, color: COLORS.textSecondary }}>RECEIPTS HANDLED</div>
                          <div style={{ fontSize: 24, fontWeight: 700, color: COLORS.neonGreen }}>{totalReceipts}</div>
                        </div>
                        <div style={{ padding: 12, background: COLORS.cardBg, borderRadius: 8 }}>
                          <div style={{ fontSize: 10, color: COLORS.textSecondary }}>CONTENT UPDATES</div>
                          <div style={{ fontSize: 24, fontWeight: 700, color: COLORS.neonBlue }}>{totalUpdates}</div>
                        </div>
                        <div style={{ padding: 12, background: COLORS.cardBg, borderRadius: 8 }}>
                          <div style={{ fontSize: 10, color: COLORS.textSecondary }}>DISPUTES COVERED</div>
                          <div style={{ fontSize: 24, fontWeight: 700, color: COLORS.neonOrange }}>{totalDisputes}</div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          </Card>

          <Card title="📋 TPMS SUBSCRIBERS">
            <DataTable
              columns={[
                { key: "id", label: "ID", render: (v) => <span style={{ fontFamily: "monospace", color: COLORS.neonOrange, fontSize: 10 }}>{String(v).slice(0, 8)}</span> },
                { key: "business_name", label: "Business", render: (v) => <span style={{ fontWeight: 600 }}>{String(v)}</span> },
                { key: "status", label: "Status", render: (v) => <span style={{ padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 600, background: String(v) === "active" ? "rgba(57,255,20,0.2)" : "rgba(255,49,49,0.2)", color: String(v) === "active" ? COLORS.neonGreen : COLORS.neonRed }}>{String(v)}</span> },
                { key: "price_cents", label: "Price", align: "right", render: (v) => <span style={{ fontWeight: 700 }}>{formatMoney(Number(v))}/mo</span> },
                { key: "started_at", label: "Started", render: (v) => v ? formatDate(String(v)) : "—" },
                { key: "next_billing", label: "Next Billing", render: (v) => v ? formatDate(String(v)) : "—" },
                { key: "tpms_receipts_handled", label: "Receipts", align: "center", render: (v) => <span style={{ fontWeight: 600 }}>{Number(v)}</span> },
                { key: "id", label: "", align: "right", render: (_v, row) => (
                  <div style={{ display: "flex", gap: 6 }}>
                    {String(row.status) === "active" && <button onClick={() => setConfirmModal({ title: "Cancel TPMS Service?", message: "This will cancel the Total Profile Management Service. The business will lose all TPMS benefits including receipt handling.", type: "danger", confirmText: "Cancel Service", onConfirm: () => cancelAddon(String(row.id)) })} style={{ padding: "6px 10px", background: "rgba(255,49,49,0.2)", border: "1px solid " + COLORS.neonRed, borderRadius: 6, color: COLORS.neonRed, cursor: "pointer", fontSize: 10 }}>Cancel</button>}
                  </div>
                )},
              ]}
              data={addonSubs.filter(a => a.addon_type === "tpms") as unknown as Record<string, unknown>[]}
            />
          </Card>
        </>
      )}

      {/* ==================== MARKETING HISTORY TAB ==================== */}
      {activeTab === "history" && (() => {
        // Build unified marketing events for the selected business
        const matchesSearch = (name: string) => name.toLowerCase().includes(historySearch.toLowerCase());
        const filteredBusinesses = historySearch.length > 1 ? businesses.filter(b => matchesSearch(b.name)) : [];
        const selectedBiz = businesses.find(b => b.id === historySelectedBusiness);

        // Combine all marketing records into a single timeline
        type HistoryEvent = { id: string; date: string; category: "ad" | "push" | "addon"; type: string; status: string; details: string; price_cents: number; businessId: string; businessName: string };
        const allEvents: HistoryEvent[] = [];

        campaigns.forEach(c => {
          allEvents.push({ id: c.id, date: c.created_at, category: "ad", type: getAdOption(c.campaign_type)?.name || c.campaign_type, status: c.status, details: `${formatDate(c.start_date)} - ${formatDate(c.end_date)}${c.zip_code ? ` • Zip: ${c.zip_code}` : ""}`, price_cents: c.price_cents, businessId: c.business_id, businessName: c.business_name || "Unknown" });
        });
        pushCampaigns.forEach(p => {
          allEvents.push({ id: p.id, date: p.created_at, category: "push", type: p.type, status: p.status, details: `${p.name}${p.scheduled_at ? ` • Scheduled: ${formatDateTime(p.scheduled_at)}` : ""}${p.recipients ? ` • ${p.recipients} recipients` : ""}`, price_cents: 0, businessId: p.business_id || "", businessName: p.business_name || "System" });
        });
        addonSubs.forEach(a => {
          const addonLabel = a.addon_type === "tpms" ? "TPMS" : PREMIUM_ADDONS.find(p => p.id === a.addon_type)?.name || a.addon_type;
          allEvents.push({ id: a.id, date: a.created_at, category: "addon", type: addonLabel, status: a.status, details: `Started: ${a.started_at ? formatDate(a.started_at) : "N/A"}${a.next_billing ? ` • Next billing: ${formatDate(a.next_billing)}` : ""}${a.cancelled_at ? ` • Cancelled: ${formatDate(a.cancelled_at)}` : ""}`, price_cents: a.price_cents, businessId: a.business_id, businessName: a.business_name || "Unknown" });
        });

        // Apply filters
        let filtered = allEvents;
        if (historySelectedBusiness) filtered = filtered.filter(e => e.businessId === historySelectedBusiness);
        if (historyFilters.type !== "all") filtered = filtered.filter(e => e.category === historyFilters.type);
        if (historyFilters.status !== "all") filtered = filtered.filter(e => e.status === historyFilters.status);
        if (historyFilters.dateFrom) filtered = filtered.filter(e => e.date >= historyFilters.dateFrom);
        if (historyFilters.dateTo) filtered = filtered.filter(e => e.date <= historyFilters.dateTo + "T23:59:59");
        filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        // Stats for selected business
        const bizCampaigns = filtered.filter(e => e.category === "ad");
        const bizPush = filtered.filter(e => e.category === "push");
        const bizAddons = filtered.filter(e => e.category === "addon");
        const totalSpent = filtered.reduce((sum, e) => sum + e.price_cents, 0);

        // All unique statuses for the filter dropdown
        const allStatuses = Array.from(new Set(allEvents.map(e => e.status))).sort();

        return (
          <>
            {/* Business Search */}
            <Card title="Search Business">
              <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                <div style={{ flex: 1, position: "relative" }}>
                  <input type="text" placeholder="Search by business name, city, or email..." value={historySearch} onChange={e => { setHistorySearch(e.target.value); if (!e.target.value) setHistorySelectedBusiness(null); }} style={{ ...inputStyle, width: "100%", padding: "14px 16px", fontSize: 14 }} />
                  {filteredBusinesses.length > 0 && !historySelectedBusiness && (
                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20, background: COLORS.cardBg, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, maxHeight: 200, overflowY: "auto", marginTop: 4 }}>
                      {filteredBusinesses.slice(0, 8).map(b => (
                        <div key={b.id} onClick={() => { setHistorySelectedBusiness(b.id); setHistorySearch(b.name); }} style={{ padding: "12px 16px", borderBottom: "1px solid " + COLORS.cardBorder, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <div style={{ fontWeight: 600 }}>{b.name}</div>
                            <div style={{ fontSize: 11, color: COLORS.textSecondary }}>{[b.city, b.state].filter(Boolean).join(", ")}{b.email ? ` • ${b.email}` : ""}</div>
                          </div>
                          {b.plan && <Badge status={b.plan} />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {historySelectedBusiness && (
                  <button onClick={() => { setHistorySelectedBusiness(null); setHistorySearch(""); setHistoryFilters({ type: "all", status: "all", dateFrom: "", dateTo: "" }); }} style={{ ...btnSecondary, whiteSpace: "nowrap" }}>Clear</button>
                )}
              </div>
            </Card>

            {/* Selected Business Info */}
            {selectedBiz && (
              <div style={{ padding: 20, background: `linear-gradient(135deg, rgba(0,212,255,0.1), rgba(57,255,20,0.05))`, borderRadius: 14, border: "1px solid " + COLORS.neonBlue, marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{selectedBiz.name}</div>
                  <div style={{ fontSize: 13, color: COLORS.textSecondary }}>{[selectedBiz.city, selectedBiz.state].filter(Boolean).join(", ")}{selectedBiz.phone ? ` • ${selectedBiz.phone}` : ""}{selectedBiz.email ? ` • ${selectedBiz.email}` : ""}</div>
                </div>
                {selectedBiz.plan && <Badge status={selectedBiz.plan} />}
              </div>
            )}

            {/* Stats Row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
              <StatCard icon="📢" value={bizCampaigns.length} label="Ad Campaigns" gradient={COLORS.gradient1} />
              <StatCard icon="📱" value={bizPush.length} label="Push Campaigns" gradient={COLORS.gradient2} />
              <StatCard icon="⭐" value={bizAddons.length} label="Add-ons / Services" gradient={COLORS.gradient3} />
              <StatCard icon="💰" value={formatMoney(totalSpent)} label="Total Spent" gradient={COLORS.gradient4} />
            </div>

            {/* Filters */}
            <Card title="Filters">
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: COLORS.textSecondary, marginBottom: 4, textTransform: "uppercase" }}>Category</label>
                  <select value={historyFilters.type} onChange={e => setHistoryFilters({ ...historyFilters, type: e.target.value })} style={{ ...inputStyle, minWidth: 140 }}>
                    <option value="all">All Types</option>
                    <option value="ad">Ad Campaigns</option>
                    <option value="push">Push Notifications</option>
                    <option value="addon">Add-ons & Services</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: COLORS.textSecondary, marginBottom: 4, textTransform: "uppercase" }}>Status</label>
                  <select value={historyFilters.status} onChange={e => setHistoryFilters({ ...historyFilters, status: e.target.value })} style={{ ...inputStyle, minWidth: 140 }}>
                    <option value="all">All Statuses</option>
                    {allStatuses.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ")}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: COLORS.textSecondary, marginBottom: 4, textTransform: "uppercase" }}>From Date</label>
                  <input type="date" value={historyFilters.dateFrom} onChange={e => setHistoryFilters({ ...historyFilters, dateFrom: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: COLORS.textSecondary, marginBottom: 4, textTransform: "uppercase" }}>To Date</label>
                  <input type="date" value={historyFilters.dateTo} onChange={e => setHistoryFilters({ ...historyFilters, dateTo: e.target.value })} style={inputStyle} />
                </div>
                {(historyFilters.type !== "all" || historyFilters.status !== "all" || historyFilters.dateFrom || historyFilters.dateTo) && (
                  <button onClick={() => setHistoryFilters({ type: "all", status: "all", dateFrom: "", dateTo: "" })} style={{ padding: "10px 16px", background: "rgba(255,49,49,0.15)", border: "1px solid " + COLORS.neonRed, borderRadius: 8, color: COLORS.neonRed, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Reset Filters</button>
                )}
              </div>
            </Card>

            {/* Results */}
            <Card title={`Marketing History (${filtered.length} records)`}>
              {filtered.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, color: COLORS.textSecondary }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
                  <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{historySelectedBusiness ? "No marketing records found" : "Select a business to view history"}</div>
                  <div style={{ fontSize: 13 }}>{historySelectedBusiness ? "Try adjusting your filters" : "Or view all records without selecting a business"}</div>
                </div>
              ) : (
                <DataTable
                  columns={[
                    { key: "date", label: "Date", render: (v) => <span style={{ fontSize: 12 }}>{formatDateTime(String(v))}</span> },
                    { key: "businessName", label: "Business", render: (v) => <span style={{ fontWeight: 600 }}>{String(v)}</span> },
                    { key: "category", label: "Category", render: (v) => {
                      const cats: Record<string, { label: string; color: string }> = { ad: { label: "Ad Campaign", color: COLORS.neonPink }, push: { label: "Push", color: COLORS.neonBlue }, addon: { label: "Add-on", color: COLORS.neonPurple } };
                      const cat = cats[String(v)] || { label: String(v), color: COLORS.textSecondary };
                      return <span style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: cat.color + "22", color: cat.color, border: "1px solid " + cat.color + "44" }}>{cat.label}</span>;
                    }},
                    { key: "type", label: "Type", render: (v) => <span style={{ fontWeight: 600, fontSize: 12 }}>{String(v).charAt(0).toUpperCase() + String(v).slice(1).replace(/_/g, " ")}</span> },
                    { key: "status", label: "Status", render: (v) => <Badge status={String(v)} /> },
                    { key: "price_cents", label: "Cost", align: "right", render: (v) => <span style={{ fontWeight: 600, color: Number(v) > 0 ? COLORS.neonGreen : COLORS.textSecondary }}>{Number(v) > 0 ? formatMoney(Number(v)) : "—"}</span> },
                    { key: "details", label: "Details", render: (v) => <span style={{ fontSize: 11, color: COLORS.textSecondary }}>{String(v)}</span> },
                  ]}
                  data={filtered as unknown as Record<string, unknown>[]}
                />
              )}
            </Card>
          </>
        );
      })()}

      {/* ==================== MARKETING FORECAST TAB (Surge Pricing CRUD) ==================== */}
      {activeTab === "forecast" && (() => {
        const today = new Date().toISOString().slice(0, 10);
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() + parseInt(forecastTimeframe));
        const cutoffStr = cutoff.toISOString().slice(0, 10);

        // Filter surge events
        let filtered = surgeEvents.filter(e => {
          return e.end_date >= today && e.start_date <= cutoffStr;
        });
        if (forecastCategory !== "all") filtered = filtered.filter(e => e.categories.length === 0 || e.categories.includes(forecastCategory));
        if (forecastImpact !== "all") filtered = filtered.filter(e => e.impact === forecastImpact);

        const getBookingsForPeriod = (start: string, end: string) => {
          return campaigns.filter(c => c.start_date <= end && c.end_date >= start && (c.status === "active" || c.status === "scheduled")).length;
        };

        const upcomingCritical = filtered.filter(e => e.impact === "critical" && e.is_active);
        const withSurge = filtered.filter(e => e.multiplier_bps > 10000 && e.is_active);

        const impactColors: Record<string, string> = { critical: COLORS.neonRed, high: COLORS.neonOrange, medium: COLORS.neonYellow, low: COLORS.neonBlue };
        const impactBgs: Record<string, string> = { critical: "rgba(255,49,49,0.15)", high: "rgba(255,107,53,0.15)", medium: "rgba(255,255,0,0.1)", low: "rgba(0,212,255,0.1)" };
        const categoryLabels: Record<string, string> = { restaurant_bar: "Dining", activity: "Activities", salon_beauty: "Beauty" };
        const categoryColors: Record<string, string> = { restaurant_bar: COLORS.neonPink, activity: COLORS.neonBlue, salon_beauty: COLORS.neonPurple };

        const daysUntil = (date: string) => {
          const diff = Math.ceil((new Date(date).getTime() - new Date().getTime()) / 86400000);
          if (diff < 0) return "Now";
          if (diff === 0) return "Today";
          if (diff === 1) return "Tomorrow";
          return `${diff} days`;
        };

        const formatMultiplier = (bps: number) => {
          if (bps <= 10000) return "No surge";
          return `${(bps / 10000).toFixed(2)}x (+${((bps - 10000) / 100).toFixed(0)}%)`;
        };

        const openSurgeCreate = () => {
          setEditingSurge(null);
          setSurgeForm(emptySurgeForm);
          setShowSurgeModal(true);
        };

        const openSurgeEdit = (ev: SurgeEvent) => {
          setEditingSurge(ev);
          setSurgeForm({
            name: ev.name, description: ev.description || "", start_date: ev.start_date, end_date: ev.end_date,
            categories: ev.categories || [], multiplier_bps: ev.multiplier_bps, impact: ev.impact,
            suggested_products: ev.suggested_products || [], is_active: ev.is_active,
          });
          setShowSurgeModal(true);
        };

        return (
          <>
            {/* Summary Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
              <StatCard icon="🔥" value={upcomingCritical.length} label="Critical Events" gradient="linear-gradient(135deg, #ff2d92, #ff3131)" />
              <StatCard icon="💰" value={withSurge.length} label="With Surge Rate" gradient="linear-gradient(135deg, #ff6b35, #ffff00)" />
              <StatCard icon="📅" value={filtered.length} label={`Events (${forecastTimeframe}d)`} gradient={COLORS.gradient2} />
              <StatCard icon="📢" value={campaigns.filter(c => c.status === "active" || c.status === "scheduled").length} label="Active Campaigns" gradient={COLORS.gradient3} />
            </div>

            {/* Filters + Create Button */}
            <Card title="Surge Events & Forecast" actions={<button onClick={openSurgeCreate} style={{ ...btnPrimary, fontSize: 13, padding: "10px 20px" }}>+ Create Surge Event</button>}>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: COLORS.textSecondary, marginBottom: 4, textTransform: "uppercase" }}>Business Category</label>
                  <select value={forecastCategory} onChange={e => setForecastCategory(e.target.value)} style={{ ...inputStyle, minWidth: 150 }}>
                    <option value="all">All Categories</option>
                    <option value="restaurant_bar">Restaurants & Bars</option>
                    <option value="activity">Activities</option>
                    <option value="salon_beauty">Salons & Beauty</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: COLORS.textSecondary, marginBottom: 4, textTransform: "uppercase" }}>Impact Level</label>
                  <select value={forecastImpact} onChange={e => setForecastImpact(e.target.value)} style={{ ...inputStyle, minWidth: 130 }}>
                    <option value="all">All Levels</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: COLORS.textSecondary, marginBottom: 4, textTransform: "uppercase" }}>Timeframe</label>
                  <select value={forecastTimeframe} onChange={e => setForecastTimeframe(e.target.value)} style={{ ...inputStyle, minWidth: 130 }}>
                    <option value="30">Next 30 Days</option>
                    <option value="60">Next 60 Days</option>
                    <option value="90">Next 90 Days</option>
                    <option value="180">Next 6 Months</option>
                    <option value="365">Full Year</option>
                  </select>
                </div>
              </div>
            </Card>

            {/* Upcoming Critical Alert */}
            {upcomingCritical.length > 0 && (
              <div style={{ padding: 20, background: "rgba(255,49,49,0.08)", borderRadius: 14, border: "1px solid " + COLORS.neonRed, marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 22 }}>🚨</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: COLORS.neonRed }}>Critical Marketing Windows Coming Up</span>
                </div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {upcomingCritical.slice(0, 4).map(e => (
                    <div key={e.id} style={{ padding: "10px 16px", background: "rgba(255,49,49,0.12)", borderRadius: 10, border: "1px solid rgba(255,49,49,0.3)" }}>
                      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{e.name}</div>
                      <div style={{ fontSize: 11, color: COLORS.neonRed }}>{daysUntil(e.start_date)} — {formatDate(e.start_date)}</div>
                      {e.multiplier_bps > 10000 && <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.neonOrange, marginTop: 2 }}>{formatMultiplier(e.multiplier_bps)}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Event List */}
            <Card title={`Surge Events (${filtered.length})`}>
              {filtered.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>📈</div>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>No events match your filters</div>
                  <div style={{ fontSize: 13 }}>Try expanding the timeframe or removing category filters</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {filtered.map(event => {
                    const bookings = getBookingsForPeriod(event.start_date, event.end_date);
                    const isMultiDay = event.start_date !== event.end_date;
                    const isPast = event.start_date < today && event.end_date >= today;
                    const hasSurge = event.multiplier_bps > 10000;
                    return (
                      <div key={event.id} style={{ padding: 20, background: COLORS.darkBg, borderRadius: 14, border: `1px solid ${impactColors[event.impact] || COLORS.cardBorder}33`, borderLeft: `4px solid ${impactColors[event.impact] || COLORS.cardBorder}`, opacity: event.is_active ? 1 : 0.5 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 18, fontWeight: 800 }}>{event.name}</span>
                              <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: impactBgs[event.impact] || "rgba(0,212,255,0.1)", color: impactColors[event.impact] || COLORS.neonBlue, border: `1px solid ${impactColors[event.impact] || COLORS.neonBlue}44`, textTransform: "uppercase" }}>{event.impact}</span>
                              {isPast && <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600, background: "rgba(57,255,20,0.15)", color: COLORS.neonGreen }}>Active Now</span>}
                              {!event.is_active && <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600, background: "rgba(255,255,255,0.1)", color: COLORS.textSecondary }}>Disabled</span>}
                              {/* Surge rate badge */}
                              {hasSurge ? (
                                <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 800, background: "rgba(255,107,53,0.2)", color: COLORS.neonOrange, border: "1px solid rgba(255,107,53,0.4)" }}>🔥 {formatMultiplier(event.multiplier_bps)}</span>
                              ) : (
                                <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 10, fontWeight: 600, background: "rgba(255,255,255,0.05)", color: COLORS.textSecondary }}>No surge set</span>
                              )}
                            </div>
                            {event.description && <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 8, maxWidth: 600 }}>{event.description}</div>}
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              {event.categories.length === 0 ? (
                                <span style={{ padding: "3px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600, background: COLORS.neonGreen + "22", color: COLORS.neonGreen }}>All Categories</span>
                              ) : event.categories.map(cat => (
                                <span key={cat} style={{ padding: "3px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600, background: (categoryColors[cat] || COLORS.textSecondary) + "22", color: categoryColors[cat] || COLORS.textSecondary }}>{categoryLabels[cat] || cat}</span>
                              ))}
                            </div>
                            {/* Surge price preview for each campaign type */}
                            {hasSurge && (
                              <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                                {AD_OPTIONS.map(opt => {
                                  const fee = Math.floor(opt.price * (event.multiplier_bps - 10000) / 10000);
                                  return (
                                    <span key={opt.id} style={{ padding: "3px 8px", borderRadius: 4, fontSize: 9, color: COLORS.textSecondary, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                                      {opt.name}: {formatMoney(opt.price)} → <span style={{ color: COLORS.neonOrange, fontWeight: 700 }}>{formatMoney(opt.price + fee)}</span>
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          <div style={{ textAlign: "right", minWidth: 150 }}>
                            <div style={{ fontSize: 22, fontWeight: 800, color: impactColors[event.impact] || COLORS.neonBlue, marginBottom: 2 }}>{daysUntil(event.start_date)}</div>
                            <div style={{ fontSize: 12, color: COLORS.textSecondary }}>{formatDate(event.start_date)}{isMultiDay ? ` - ${formatDate(event.end_date)}` : ""}</div>
                            <div style={{ marginTop: 8, padding: "4px 10px", borderRadius: 6, background: bookings > 0 ? "rgba(57,255,20,0.15)" : "rgba(255,255,0,0.1)", display: "inline-block" }}>
                              <span style={{ fontSize: 11, fontWeight: 600, color: bookings > 0 ? COLORS.neonGreen : COLORS.neonYellow }}>{bookings > 0 ? `${bookings} campaign${bookings > 1 ? "s" : ""} booked` : "No campaigns yet"}</span>
                            </div>
                            {/* Action buttons */}
                            <div style={{ marginTop: 10, display: "flex", gap: 6, justifyContent: "flex-end" }}>
                              <button onClick={() => openSurgeEdit(event)} style={{ padding: "5px 10px", background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 6, color: COLORS.neonBlue, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Edit</button>
                              <button onClick={() => toggleSurgeActive(event.id, !event.is_active)} style={{ padding: "5px 10px", background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 6, color: event.is_active ? COLORS.neonYellow : COLORS.neonGreen, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>{event.is_active ? "Disable" : "Enable"}</button>
                              <button onClick={() => setConfirmModal({ title: "Delete Surge Event?", message: `Permanently delete "${event.name}"? This cannot be undone.`, type: "danger", confirmText: "Delete", onConfirm: () => deleteSurgeEvent(event.id) })} style={{ padding: "5px 10px", background: COLORS.cardBg, border: "1px solid " + COLORS.neonRed, borderRadius: 6, color: COLORS.neonRed, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Delete</button>
                            </div>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", paddingTop: 12, borderTop: "1px solid " + COLORS.cardBorder }}>
                          <span style={{ fontSize: 11, color: COLORS.textSecondary, marginRight: 4 }}>Suggested:</span>
                          {(event.suggested_products || []).map(pid => {
                            const prod = getAdOption(pid);
                            return prod ? (
                              <span key={pid} style={{ padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 600, background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, color: COLORS.neonGreen }}>{prod.name} — {formatMoney(prod.price)}</span>
                            ) : null;
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </>
        );
      })()}

      {/* ==================== SURGE EVENT CREATE/EDIT MODAL ==================== */}
      {showSurgeModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1003 }} onClick={() => { setShowSurgeModal(false); setEditingSurge(null); setSurgeForm(emptySurgeForm); }}>
          <div style={{ background: COLORS.cardBg, borderRadius: 20, padding: 32, width: 700, maxWidth: "95%", maxHeight: "90vh", overflowY: "auto", border: "1px solid " + COLORS.neonOrange }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700 }}>{editingSurge ? "Edit Surge Event" : "Create Surge Event"}</h2>
                <div style={{ fontSize: 13, color: COLORS.textSecondary }}>Set the rate increase for this marketing event</div>
              </div>
              <button onClick={() => { setShowSurgeModal(false); setEditingSurge(null); setSurgeForm(emptySurgeForm); }} style={{ padding: "8px 12px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textSecondary, cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>

            {/* Name */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 11, color: COLORS.neonOrange, marginBottom: 6, textTransform: "uppercase", fontWeight: 600 }}>Event Name *</label>
              <input type="text" value={surgeForm.name} onChange={e => setSurgeForm({ ...surgeForm, name: e.target.value })} placeholder="e.g. Valentine's Day" style={{ ...inputStyle, width: "100%" }} />
            </div>

            {/* Description */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, textTransform: "uppercase", fontWeight: 600 }}>Description</label>
              <textarea value={surgeForm.description} onChange={e => setSurgeForm({ ...surgeForm, description: e.target.value })} placeholder="Marketing notes..." style={{ ...inputStyle, width: "100%", minHeight: 60, resize: "vertical" }} />
            </div>

            {/* Date Range */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, color: COLORS.neonOrange, marginBottom: 6, textTransform: "uppercase", fontWeight: 600 }}>Start Date *</label>
                <input type="date" value={surgeForm.start_date} onChange={e => setSurgeForm({ ...surgeForm, start_date: e.target.value, end_date: surgeForm.end_date || e.target.value })} style={{ ...inputStyle, width: "100%" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, color: COLORS.neonOrange, marginBottom: 6, textTransform: "uppercase", fontWeight: 600 }}>End Date *</label>
                <input type="date" value={surgeForm.end_date} onChange={e => setSurgeForm({ ...surgeForm, end_date: e.target.value })} min={surgeForm.start_date} style={{ ...inputStyle, width: "100%" }} />
              </div>
            </div>

            {/* Surge Rate — THE KEY FIELD */}
            <div style={{ marginBottom: 16, padding: 20, background: "rgba(255,107,53,0.08)", borderRadius: 14, border: "1px solid rgba(255,107,53,0.3)" }}>
              <label style={{ display: "block", fontSize: 12, color: COLORS.neonOrange, marginBottom: 4, textTransform: "uppercase", fontWeight: 700 }}>🔥 Surge Rate *</label>
              <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 12 }}>Set the price multiplier for campaigns overlapping this event. Each event is set independently by management.</div>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <input type="range" min={10000} max={30000} step={500} value={surgeForm.multiplier_bps} onChange={e => setSurgeForm({ ...surgeForm, multiplier_bps: parseInt(e.target.value) })} style={{ width: "100%", accentColor: COLORS.neonOrange }} />
                </div>
                <div style={{ textAlign: "center", minWidth: 120 }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: surgeForm.multiplier_bps > 10000 ? COLORS.neonOrange : COLORS.textSecondary }}>{(surgeForm.multiplier_bps / 10000).toFixed(2)}x</div>
                  <div style={{ fontSize: 12, color: COLORS.textSecondary }}>{surgeForm.multiplier_bps <= 10000 ? "No surge" : `+${((surgeForm.multiplier_bps - 10000) / 100).toFixed(0)}% surcharge`}</div>
                </div>
              </div>
              {surgeForm.multiplier_bps > 10000 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, paddingTop: 12, borderTop: "1px solid rgba(255,107,53,0.2)" }}>
                  {AD_OPTIONS.filter(o => o.type === "spotlight").map(opt => {
                    const fee = Math.floor(opt.price * (surgeForm.multiplier_bps - 10000) / 10000);
                    return (
                      <div key={opt.id} style={{ padding: 8, background: "rgba(0,0,0,0.2)", borderRadius: 8, textAlign: "center" }}>
                        <div style={{ fontSize: 9, color: COLORS.textSecondary, marginBottom: 2 }}>{opt.name}</div>
                        <div style={{ fontSize: 11, color: COLORS.textSecondary }}>{formatMoney(opt.price)}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.neonOrange }}>{formatMoney(opt.price + fee)}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Impact Level (visual only) */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, textTransform: "uppercase", fontWeight: 600 }}>Impact Level (visual only)</label>
                <select value={surgeForm.impact} onChange={e => setSurgeForm({ ...surgeForm, impact: e.target.value })} style={{ ...inputStyle, width: "100%" }}>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, textTransform: "uppercase", fontWeight: 600 }}>Status</label>
                <button onClick={() => setSurgeForm({ ...surgeForm, is_active: !surgeForm.is_active })} style={{ ...inputStyle, width: "100%", cursor: "pointer", fontWeight: 600, color: surgeForm.is_active ? COLORS.neonGreen : COLORS.neonRed, border: `1px solid ${surgeForm.is_active ? COLORS.neonGreen : COLORS.neonRed}` }}>
                  {surgeForm.is_active ? "Active" : "Disabled"}
                </button>
              </div>
            </div>

            {/* Categories */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, textTransform: "uppercase", fontWeight: 600 }}>Target Categories (none = all)</label>
              <div style={{ display: "flex", gap: 8 }}>
                {[{ key: "restaurant_bar", label: "Restaurants & Bars" }, { key: "activity", label: "Activities" }, { key: "salon_beauty", label: "Salons & Beauty" }].map(cat => {
                  const selected = surgeForm.categories.includes(cat.key);
                  return (
                    <button key={cat.key} onClick={() => {
                      const cats = selected ? surgeForm.categories.filter(c => c !== cat.key) : [...surgeForm.categories, cat.key];
                      setSurgeForm({ ...surgeForm, categories: cats });
                    }} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${selected ? COLORS.neonGreen : COLORS.cardBorder}`, background: selected ? "rgba(57,255,20,0.15)" : COLORS.darkBg, color: selected ? COLORS.neonGreen : COLORS.textSecondary, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Suggested Products */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, textTransform: "uppercase", fontWeight: 600 }}>Suggested Ad Products</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {AD_OPTIONS.map(opt => {
                  const selected = surgeForm.suggested_products.includes(opt.id);
                  return (
                    <button key={opt.id} onClick={() => {
                      const prods = selected ? surgeForm.suggested_products.filter(p => p !== opt.id) : [...surgeForm.suggested_products, opt.id];
                      setSurgeForm({ ...surgeForm, suggested_products: prods });
                    }} style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${selected ? COLORS.neonBlue : COLORS.cardBorder}`, background: selected ? "rgba(0,212,255,0.15)" : COLORS.darkBg, color: selected ? COLORS.neonBlue : COLORS.textSecondary, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                      {opt.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "space-between", marginTop: 24 }}>
              <button onClick={() => { setShowSurgeModal(false); setEditingSurge(null); setSurgeForm(emptySurgeForm); }} style={btnSecondary}>Cancel</button>
              <button onClick={saveSurgeEvent} style={{ padding: "14px 28px", background: COLORS.neonOrange, border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontWeight: 700 }}>{editingSurge ? "Save Changes" : "Create Event"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== CREATE CAMPAIGN MODAL ==================== */}
      {showCreateAdModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1001 }} onClick={() => { setShowCreateAdModal(false); setNewCampaign({ ...emptyNewCampaign }); }}>
          <div style={{ background: COLORS.cardBg, borderRadius: 20, padding: 32, width: 700, maxWidth: "95%", maxHeight: "90vh", overflowY: "auto", border: "1px solid " + COLORS.cardBorder }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Schedule {getAdOption(newCampaign.ad_type)?.name || "Campaign"}</h2>
                {newCampaign.ad_type && (() => {
                  const opt = getAdOption(newCampaign.ad_type);
                  if (!opt) return null;
                  const cStart = newCampaign.ad_type === "ad_tourwide" ? newCampaign.window_start : newCampaign.start_date;
                  const cEnd = newCampaign.ad_type === "ad_tourwide" ? newCampaign.window_end : newCampaign.end_date;
                  const biz = businesses.find(b => b.id === newCampaign.business_id);
                  const bizCfg = biz ? (biz as unknown as Record<string, unknown>).config : null;
                  const bizCat = (bizCfg && typeof bizCfg === "object" ? (bizCfg as Record<string, unknown>).businessType as string : null) || null;
                  const surge = cStart && cEnd ? calcSurgeForCampaign(cStart, cEnd, opt.price, bizCat) : { surgeFee: 0 };
                  return (
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <span style={{ fontSize: 24, fontWeight: 700, color: surge.surgeFee > 0 ? COLORS.neonOrange : COLORS.neonGreen }}>{formatMoney(opt.price + surge.surgeFee)}</span>
                      {surge.surgeFee > 0 && <span style={{ fontSize: 13, color: COLORS.textSecondary, textDecoration: "line-through" }}>{formatMoney(opt.price)}</span>}
                    </div>
                  );
                })()}
              </div>
              <button onClick={() => { setShowCreateAdModal(false); setNewCampaign({ ...emptyNewCampaign }); }} style={{ padding: "8px 12px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textSecondary, cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>

            {/* Ad Type Selection */}
            {!newCampaign.ad_type && (
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 11, color: COLORS.neonOrange, marginBottom: 8, textTransform: "uppercase", fontWeight: 600 }}>Select Ad Type *</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {AD_OPTIONS.map(opt => (
                    <button key={opt.id} onClick={() => setNewCampaign({ ...newCampaign, ad_type: opt.id })} style={{ padding: 16, background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, cursor: "pointer", textAlign: "left" }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>{opt.name}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.neonGreen }}>{formatMoney(opt.price)}</div>
                      <div style={{ fontSize: 11, color: COLORS.textSecondary }}>📍 {opt.radius} • {opt.duration}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Business Search */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 11, color: COLORS.neonOrange, marginBottom: 8, textTransform: "uppercase", fontWeight: 600 }}>Select Business *</label>
              <input type="text" placeholder="Search by name..." value={newCampaign.businessSearch} onChange={e => setNewCampaign({ ...newCampaign, businessSearch: e.target.value })} style={{ ...inputStyle, width: "100%", marginBottom: 8 }} />
              {newCampaign.businessSearch.length > 1 && (
                <div style={{ background: COLORS.darkBg, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, maxHeight: 150, overflowY: "auto" }}>
                  {businesses.filter(b => b.name.toLowerCase().includes(newCampaign.businessSearch.toLowerCase())).slice(0, 5).map(b => (
                    <div key={b.id} onClick={() => setNewCampaign({ ...newCampaign, business_id: b.id, businessSearch: b.name })} style={{ padding: "10px 14px", borderBottom: "1px solid " + COLORS.cardBorder, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", background: newCampaign.business_id === b.id ? "rgba(57,255,20,0.2)" : "transparent" }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{b.name}</div>
                        <div style={{ fontSize: 10, color: COLORS.textSecondary }}>{b.city}, {b.state}</div>
                      </div>
                      {b.plan && <Badge status={b.plan} />}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Zip Code */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 11, color: COLORS.neonOrange, marginBottom: 8, textTransform: "uppercase", fontWeight: 600 }}>Target Zip Code *</label>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
                <input type="text" placeholder="Enter zip code..." value={newCampaign.zip_code} onChange={e => setNewCampaign({ ...newCampaign, zip_code: e.target.value.replace(/\D/g, "").slice(0, 5) })} maxLength={5} style={{ ...inputStyle, flex: 1 }} />
                {newCampaign.ad_type && (
                  <div style={{ padding: "12px 16px", background: COLORS.darkBg, borderRadius: 10, border: "1px solid " + COLORS.neonBlue }}>
                    <div style={{ fontSize: 10, color: COLORS.textSecondary }}>Radius</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.neonBlue }}>📍 {getAdOption(newCampaign.ad_type)?.radius || "N/A"}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Spotlight Date Fields */}
            {getAdOption(newCampaign.ad_type)?.type === "spotlight" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, color: COLORS.neonOrange, marginBottom: 8, textTransform: "uppercase", fontWeight: 600 }}>Start Date *</label>
                  <input type="date" value={newCampaign.start_date} onChange={e => {
                    const start = e.target.value;
                    const days = (getAdOption(newCampaign.ad_type)?.durationDays || 1) - 1;
                    const endDate = new Date(start + "T00:00:00");
                    endDate.setDate(endDate.getDate() + days);
                    setNewCampaign({ ...newCampaign, start_date: start, end_date: endDate.toISOString().slice(0, 10) });
                  }} style={{ ...inputStyle, width: "100%" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, color: COLORS.neonOrange, marginBottom: 8, textTransform: "uppercase", fontWeight: 600 }}>End Date *</label>
                  <input type="date" value={newCampaign.end_date} readOnly style={{ ...inputStyle, width: "100%", opacity: 0.7 }} />
                </div>
              </div>
            )}

            {/* 100 Mile Push Fields */}
            {newCampaign.ad_type === "ad_100mile" && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: COLORS.neonOrange, marginBottom: 8, textTransform: "uppercase", fontWeight: 600 }}>Start Date *</label>
                    <input type="date" value={newCampaign.start_date} onChange={e => {
                      const start = e.target.value;
                      const endDate = new Date(start + "T00:00:00");
                      endDate.setDate(endDate.getDate() + 6);
                      setNewCampaign({ ...newCampaign, start_date: start, end_date: endDate.toISOString().slice(0, 10) });
                    }} style={{ ...inputStyle, width: "100%" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: COLORS.neonOrange, marginBottom: 8, textTransform: "uppercase", fontWeight: 600 }}>End Date *</label>
                    <input type="date" value={newCampaign.end_date} readOnly style={{ ...inputStyle, width: "100%", opacity: 0.7 }} />
                  </div>
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: 11, color: COLORS.neonOrange, marginBottom: 8, textTransform: "uppercase", fontWeight: 600 }}>Push Message *</label>
                  <textarea value={newCampaign.push_message} onChange={e => setNewCampaign({ ...newCampaign, push_message: e.target.value })} placeholder="Max 150 characters..." maxLength={150} style={{ ...inputStyle, width: "100%", minHeight: 80, resize: "vertical" }} />
                  <div style={{ fontSize: 10, color: COLORS.textSecondary, marginTop: 4 }}>{newCampaign.push_message.length}/150</div>
                </div>
              </>
            )}

            {/* Tour Wide Push Fields */}
            {newCampaign.ad_type === "ad_tourwide" && (
              <>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: 11, color: COLORS.neonOrange, marginBottom: 4, textTransform: "uppercase", fontWeight: 600 }}>60-Day Window Start *</label>
                  <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 8 }}>Select the start of your 60-day campaign window. You&apos;ll pick specific days within this window below.</div>
                  <input type="date" value={newCampaign.window_start} onChange={e => {
                    const start = e.target.value;
                    const endDate = new Date(start + "T00:00:00");
                    endDate.setDate(endDate.getDate() + 59);
                    setNewCampaign({ ...newCampaign, window_start: start, window_end: endDate.toISOString().slice(0, 10) });
                  }} style={{ ...inputStyle, width: "100%" }} />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: 11, color: COLORS.neonOrange, marginBottom: 8, textTransform: "uppercase", fontWeight: 600 }}>60-Day Window End *</label>
                  <input type="date" value={newCampaign.window_end} readOnly style={{ ...inputStyle, width: "100%", opacity: 0.7 }} />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: 11, color: COLORS.neonOrange, marginBottom: 8, textTransform: "uppercase", fontWeight: 600 }}>Push Notification Message *</label>
                  <textarea value={newCampaign.push_message} onChange={e => setNewCampaign({ ...newCampaign, push_message: e.target.value })} placeholder="Enter your push notification message (max 150 characters)..." maxLength={150} style={{ ...inputStyle, width: "100%", minHeight: 80, resize: "vertical" }} />
                  <div style={{ fontSize: 10, color: COLORS.textSecondary, marginTop: 4 }}>{newCampaign.push_message.length}/150 characters</div>
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: 11, color: COLORS.neonOrange, marginBottom: 4, textTransform: "uppercase", fontWeight: 600 }}>Priority Placement Days (7 Days) *</label>
                  <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 12 }}>Select 7 days for top Discovery placement (can be split within 60-day window)</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {[0,1,2,3,4,5,6].map(idx => (
                      <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, color: COLORS.textSecondary, width: 20 }}>#{idx + 1}</span>
                        <input type="date" value={newCampaign.priority_days[idx]} min={newCampaign.window_start || undefined} max={newCampaign.window_end || undefined} onChange={e => {
                          const days = [...newCampaign.priority_days];
                          days[idx] = e.target.value;
                          setNewCampaign({ ...newCampaign, priority_days: days });
                        }} style={{ flex: 1, padding: 10, background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 6, color: COLORS.textPrimary, fontSize: 12 }} />
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: 11, color: COLORS.neonOrange, marginBottom: 4, textTransform: "uppercase", fontWeight: 600 }}>Push Notification Days (14 Days) *</label>
                  <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 12 }}>Select 14 days for push notifications (can be split within 60-day window)</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, maxHeight: 200, overflowY: "auto", padding: 4 }}>
                    {[0,1,2,3,4,5,6,7,8,9,10,11,12,13].map(idx => (
                      <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, color: COLORS.textSecondary, width: 20 }}>#{idx + 1}</span>
                        <input type="date" value={newCampaign.push_days[idx]} min={newCampaign.window_start || undefined} max={newCampaign.window_end || undefined} onChange={e => {
                          const days = [...newCampaign.push_days];
                          days[idx] = e.target.value;
                          setNewCampaign({ ...newCampaign, push_days: days });
                        }} style={{ flex: 1, padding: 10, background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 6, color: COLORS.textPrimary, fontSize: 12 }} />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Surge Pricing Alert */}
            {(() => {
              if (!newCampaign.ad_type) return null;
              const opt = getAdOption(newCampaign.ad_type);
              if (!opt) return null;
              const cStart = newCampaign.ad_type === "ad_tourwide" ? newCampaign.window_start : newCampaign.start_date;
              const cEnd = newCampaign.ad_type === "ad_tourwide" ? newCampaign.window_end : newCampaign.end_date;
              if (!cStart || !cEnd) return null;
              const biz = businesses.find(b => b.id === newCampaign.business_id);
              const bizCfg = biz ? (biz as unknown as Record<string, unknown>).config : null;
              const bizCat = (bizCfg && typeof bizCfg === "object" ? (bizCfg as Record<string, unknown>).businessType as string : null) || null;
              const { surgeFee, multiplierBps, surgeEventName } = calcSurgeForCampaign(cStart, cEnd, opt.price, bizCat);
              if (surgeFee === 0) return null;
              return (
                <div style={{ padding: 16, background: "rgba(255,107,53,0.12)", borderRadius: 12, border: "1px solid rgba(255,107,53,0.4)", marginBottom: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 16 }}>🔥</span>
                    <span style={{ fontWeight: 700, color: COLORS.neonOrange }}>Hot Day Surge Pricing</span>
                  </div>
                  <div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 10 }}>
                    Overlaps with: <strong style={{ color: COLORS.neonOrange }}>{surgeEventName}</strong> ({(multiplierBps / 10000).toFixed(2)}x / +{((multiplierBps - 10000) / 100).toFixed(0)}%)
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    <div><div style={{ fontSize: 10, color: COLORS.textSecondary }}>BASE</div><div style={{ fontWeight: 700, color: COLORS.neonGreen }}>{formatMoney(opt.price)}</div></div>
                    <div><div style={{ fontSize: 10, color: COLORS.textSecondary }}>SURGE FEE</div><div style={{ fontWeight: 700, color: COLORS.neonOrange }}>+{formatMoney(surgeFee)}</div></div>
                    <div><div style={{ fontSize: 10, color: COLORS.textSecondary }}>TOTAL</div><div style={{ fontWeight: 800, color: COLORS.neonPink }}>{formatMoney(opt.price + surgeFee)}</div></div>
                  </div>
                </div>
              );
            })()}

            <div style={{ display: "flex", gap: 12, justifyContent: "space-between", marginTop: 24 }}>
              <button onClick={() => { setShowCreateAdModal(false); setNewCampaign({ ...emptyNewCampaign }); }} style={btnSecondary}>Cancel</button>
              <button onClick={createCampaign} style={{ padding: "14px 28px", background: COLORS.neonGreen, border: "none", borderRadius: 10, color: "#000", cursor: "pointer", fontWeight: 700 }}>Create Campaign</button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== EDIT CAMPAIGN MODAL ==================== */}
      {selectedCampaign && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1001 }} onClick={() => setSelectedCampaign(null)}>
          <div style={{ background: COLORS.cardBg, borderRadius: 20, padding: 32, width: 750, maxWidth: "95%", maxHeight: "90vh", overflowY: "auto", border: "1px solid " + COLORS.cardBorder }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Edit Campaign</h2>
                <div style={{ fontSize: 14, color: COLORS.textSecondary }}>{selectedCampaign.business_name} • {getAdOption(selectedCampaign.campaign_type)?.name}</div>
                <div style={{ fontSize: 12, color: COLORS.neonBlue, marginTop: 4 }}>📍 {getAdOption(selectedCampaign.campaign_type)?.radius}</div>
              </div>
              <button onClick={() => setSelectedCampaign(null)} style={{ padding: "8px 12px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textSecondary, cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>

            {/* Status & Payment */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase", fontWeight: 600 }}>Status</label>
                <select defaultValue={selectedCampaign.status} onChange={e => updateCampaignStatus(selectedCampaign.id, e.target.value)} style={{ ...inputStyle, width: "100%" }}>
                  <option value="scheduled">Scheduled</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="postponed">Postponed</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase", fontWeight: 600 }}>Payment</label>
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 10, background: COLORS.darkBg, borderRadius: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: COLORS.neonGreen }}>{formatMoney(selectedCampaign.price_cents)}</span>
                  {selectedCampaign.surge_fee_cents > 0 && (
                    <span style={{ fontSize: 11, color: COLORS.neonOrange }}>Base: {formatMoney(selectedCampaign.base_price_cents)} + 🔥 Surge: {formatMoney(selectedCampaign.surge_fee_cents)}</span>
                  )}
                  {selectedCampaign.paid ? (
                    <span style={{ padding: "4px 10px", background: "rgba(57,255,20,0.2)", borderRadius: 6, color: COLORS.neonGreen, fontSize: 11, fontWeight: 600 }}>✓ Paid</span>
                  ) : (
                    <button onClick={() => { markCampaignPaid(selectedCampaign.id); setSelectedCampaign({ ...selectedCampaign, paid: true, paid_at: new Date().toISOString() }); }} style={{ padding: "4px 10px", background: "rgba(255,255,0,0.2)", border: "1px solid " + COLORS.neonYellow, borderRadius: 6, color: COLORS.neonYellow, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Mark Paid</button>
                  )}
                </div>
              </div>
            </div>

            {/* Dates */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
              <div style={{ padding: 16, background: COLORS.darkBg, borderRadius: 10 }}>
                <div style={{ fontSize: 10, color: COLORS.textSecondary }}>START DATE</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{formatDate(selectedCampaign.start_date)}</div>
              </div>
              <div style={{ padding: 16, background: COLORS.darkBg, borderRadius: 10 }}>
                <div style={{ fontSize: 10, color: COLORS.textSecondary }}>END DATE</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{formatDate(selectedCampaign.end_date)}</div>
              </div>
            </div>

            {/* Performance */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase", fontWeight: 600 }}>Performance</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                <div style={{ padding: 16, background: COLORS.darkBg, borderRadius: 10 }}>
                  <div style={{ fontSize: 10, color: COLORS.textSecondary }}>IMPRESSIONS</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: COLORS.neonBlue }}>{selectedCampaign.impressions.toLocaleString()}</div>
                </div>
                <div style={{ padding: 16, background: COLORS.darkBg, borderRadius: 10 }}>
                  <div style={{ fontSize: 10, color: COLORS.textSecondary }}>CLICKS</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: COLORS.neonGreen }}>{selectedCampaign.clicks.toLocaleString()}</div>
                </div>
                <div style={{ padding: 16, background: COLORS.darkBg, borderRadius: 10 }}>
                  <div style={{ fontSize: 10, color: COLORS.textSecondary }}>CTR</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: COLORS.neonOrange }}>{selectedCampaign.impressions > 0 ? ((selectedCampaign.clicks / selectedCampaign.impressions) * 100).toFixed(2) : 0}%</div>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "space-between", marginTop: 24 }}>
              <button onClick={() => setConfirmModal({ title: "Delete Campaign?", message: "This will permanently delete this campaign. This cannot be undone.", type: "danger", confirmText: "Delete", onConfirm: () => deleteCampaign(selectedCampaign.id) })} style={{ padding: "14px 28px", background: "rgba(255,49,49,0.2)", border: "1px solid " + COLORS.neonRed, borderRadius: 10, color: COLORS.neonRed, cursor: "pointer", fontWeight: 600 }}>Delete Campaign</button>
              <button onClick={() => setSelectedCampaign(null)} style={btnSecondary}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== POSTPONE/RESCHEDULE MODAL ==================== */}
      {showPostponeModal && postponeCampaign && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1002 }} onClick={() => { setShowPostponeModal(false); setPostponeCampaign(null); }}>
          <div style={{ background: COLORS.cardBg, borderRadius: 20, padding: 32, width: 650, maxWidth: "95%", maxHeight: "90vh", overflowY: "auto", border: "1px solid " + COLORS.neonPurple }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: COLORS.neonPurple }}>{postponeCampaign.status === "postponed" ? "📅 Reschedule Campaign" : "⏸️ Postpone Campaign"}</h2>
                <div style={{ fontSize: 14, color: COLORS.textSecondary }}>{postponeCampaign.business_name} • {getAdOption(postponeCampaign.campaign_type)?.name}</div>
              </div>
              <button onClick={() => { setShowPostponeModal(false); setPostponeCampaign(null); }} style={{ padding: "8px 12px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textSecondary, cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>

            <div style={{ padding: 16, background: "rgba(138,43,226,0.1)", borderRadius: 10, marginBottom: 20, border: "1px solid " + COLORS.neonPurple }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Current Schedule</div>
              <div style={{ display: "flex", gap: 16 }}>
                <div><div style={{ fontSize: 10, color: COLORS.textSecondary }}>Start</div><div style={{ fontWeight: 600 }}>{formatDate(postponeCampaign.start_date)}</div></div>
                <div><div style={{ fontSize: 10, color: COLORS.textSecondary }}>End</div><div style={{ fontWeight: 600 }}>{formatDate(postponeCampaign.end_date)}</div></div>
              </div>
            </div>

            {postponeCampaign.campaign_type === "ad_tourwide" ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, color: COLORS.neonOrange, marginBottom: 8, textTransform: "uppercase", fontWeight: 600 }}>New Window Start *</label>
                  <input type="date" value={postponeForm.window_start} onChange={e => {
                    const start = e.target.value;
                    const endDate = new Date(start + "T00:00:00");
                    endDate.setDate(endDate.getDate() + 59);
                    setPostponeForm({ ...postponeForm, window_start: start, window_end: endDate.toISOString().slice(0, 10) });
                  }} style={{ ...inputStyle, width: "100%" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, color: COLORS.neonOrange, marginBottom: 8, textTransform: "uppercase", fontWeight: 600 }}>New Window End *</label>
                  <input type="date" value={postponeForm.window_end} readOnly style={{ ...inputStyle, width: "100%", opacity: 0.7 }} />
                </div>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, color: COLORS.neonOrange, marginBottom: 8, textTransform: "uppercase", fontWeight: 600 }}>New Start Date *</label>
                  <input type="date" value={postponeForm.start_date} onChange={e => {
                    const start = e.target.value;
                    const days = (getAdOption(postponeCampaign.campaign_type)?.durationDays || 1) - 1;
                    const endDate = new Date(start + "T00:00:00");
                    endDate.setDate(endDate.getDate() + days);
                    setPostponeForm({ ...postponeForm, start_date: start, end_date: endDate.toISOString().slice(0, 10) });
                  }} style={{ ...inputStyle, width: "100%" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, color: COLORS.neonOrange, marginBottom: 8, textTransform: "uppercase", fontWeight: 600 }}>New End Date *</label>
                  <input type="date" value={postponeForm.end_date} readOnly style={{ ...inputStyle, width: "100%", opacity: 0.7 }} />
                </div>
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase", fontWeight: 600 }}>Reason (Optional)</label>
              <textarea value={postponeForm.reason} onChange={e => setPostponeForm({ ...postponeForm, reason: e.target.value })} placeholder="Enter reason..." style={{ ...inputStyle, width: "100%", minHeight: 60, resize: "vertical" }} />
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button onClick={() => { setShowPostponeModal(false); setPostponeCampaign(null); }} style={btnSecondary}>Cancel</button>
              <button onClick={postponeCampaignAction} style={{ padding: "14px 28px", background: COLORS.neonPurple, border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontWeight: 700 }}>{postponeCampaign.status === "postponed" ? "Reschedule" : "Postpone"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== OVERLAP RESOLVE MODAL ==================== */}
      {overlapAction && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1002 }} onClick={() => setOverlapAction(null)}>
          <div style={{ background: COLORS.cardBg, borderRadius: 20, padding: 32, width: 800, maxWidth: "95%", maxHeight: "90vh", overflowY: "auto", border: "1px solid " + COLORS.neonOrange }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: COLORS.neonOrange }}>⚠️ Resolve Overlap</h2>
                <div style={{ fontSize: 13, color: COLORS.textSecondary }}>Choose which campaign to reschedule or approve both</div>
              </div>
              <button onClick={() => setOverlapAction(null)} style={{ padding: "8px 12px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textSecondary, cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
              {[overlapAction.campaign1, overlapAction.campaign2].map((camp, idx) => (
                <div key={idx} style={{ padding: 20, background: COLORS.darkBg, borderRadius: 12, border: "2px solid " + COLORS.cardBorder }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{camp.business_name}</div>
                      <div style={{ fontSize: 12, color: COLORS.neonBlue }}>{getAdOption(camp.campaign_type)?.name}</div>
                      <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 4 }}>{formatDate(camp.start_date)} - {formatDate(camp.end_date)}</div>
                    </div>
                    <Badge status={camp.status} />
                  </div>
                  <div style={{ padding: 16, background: COLORS.cardBg, borderRadius: 10, marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 4, textTransform: "uppercase" }}>Contact Info</div>
                    {camp.business_phone && <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}><span>📞</span><span style={{ fontSize: 16, fontWeight: 700, color: COLORS.neonGreen }}>{camp.business_phone}</span></div>}
                    {camp.business_email && <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}><span>✉️</span><span style={{ fontSize: 13, color: COLORS.neonBlue }}>{camp.business_email}</span></div>}
                    {camp.zip_code && <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span>📍</span><span style={{ fontSize: 12, color: COLORS.textSecondary }}>Zip: {camp.zip_code}</span></div>}
                  </div>
                  <button onClick={() => { setPostponeCampaign(camp); setShowPostponeModal(true); setOverlapAction(null); }} style={{ width: "100%", padding: 14, background: COLORS.neonOrange, border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontWeight: 700 }}>Reschedule This One</button>
                </div>
              ))}
            </div>

            <div style={{ padding: 16, background: "rgba(57,255,20,0.1)", borderRadius: 10, border: "1px solid " + COLORS.neonGreen }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600, color: COLORS.neonGreen, marginBottom: 4 }}>Or Approve the Overlap</div>
                  <div style={{ fontSize: 12, color: COLORS.textSecondary }}>Allow both campaigns to run simultaneously</div>
                </div>
                <button onClick={() => { setApprovedOverlaps(prev => [...prev, overlapAction.id]); addToast("Overlap approved!", "success"); setOverlapAction(null); }} style={{ padding: "12px 24px", background: COLORS.neonGreen, border: "none", borderRadius: 10, color: "#000", cursor: "pointer", fontWeight: 700 }}>Approve Both</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== CREATE PUSH MODAL ==================== */}
      {showCreatePushModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1001 }} onClick={() => setShowCreatePushModal(false)}>
          <div style={{ background: COLORS.cardBg, borderRadius: 20, padding: 32, width: 600, maxWidth: "95%", maxHeight: "90vh", overflowY: "auto", border: "1px solid " + COLORS.cardBorder }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700 }}>📱 Create Push Campaign</h2>
              <button onClick={() => setShowCreatePushModal(false)} style={{ padding: "8px 12px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textSecondary, cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, fontWeight: 600, textTransform: "uppercase" }}>Campaign Name *</label>
              <input type="text" value={newPush.name} onChange={e => setNewPush({ ...newPush, name: e.target.value })} placeholder="e.g. Weekend Special" style={{ ...inputStyle, width: "100%" }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, fontWeight: 600, textTransform: "uppercase" }}>Message *</label>
              <textarea value={newPush.message} onChange={e => setNewPush({ ...newPush, message: e.target.value })} placeholder="Push notification message..." maxLength={150} style={{ ...inputStyle, width: "100%", minHeight: 80, resize: "vertical" }} />
              <div style={{ fontSize: 10, color: COLORS.textSecondary, marginTop: 4 }}>{newPush.message.length}/150</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, fontWeight: 600, textTransform: "uppercase" }}>Type</label>
                <select value={newPush.type} onChange={e => setNewPush({ ...newPush, type: e.target.value })} style={{ ...inputStyle, width: "100%" }}>
                  <option value="promotional">Promotional</option>
                  <option value="system">System</option>
                  <option value="re_engagement">Re-engagement</option>
                  <option value="transactional">Transactional</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, fontWeight: 600, textTransform: "uppercase" }}>Target Audience</label>
                <select value={newPush.target_audience} onChange={e => setNewPush({ ...newPush, target_audience: e.target.value })} style={{ ...inputStyle, width: "100%" }}>
                  <option value="nearby_users">Nearby Users</option>
                  <option value="all_visitors">All Visitors</option>
                  <option value="all_users">All Users</option>
                  <option value="inactive_users">Inactive Users</option>
                </select>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, fontWeight: 600, textTransform: "uppercase" }}>Radius</label>
                <select value={newPush.radius} onChange={e => setNewPush({ ...newPush, radius: e.target.value })} style={{ ...inputStyle, width: "100%" }}>
                  <option value="5mi">5 miles</option>
                  <option value="10mi">10 miles</option>
                  <option value="25mi">25 miles</option>
                  <option value="50mi">50 miles</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, fontWeight: 600, textTransform: "uppercase" }}>Schedule (optional)</label>
                <input type="datetime-local" value={newPush.scheduled_at} onChange={e => setNewPush({ ...newPush, scheduled_at: e.target.value })} style={{ ...inputStyle, width: "100%" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 24 }}>
              <button onClick={() => setShowCreatePushModal(false)} style={btnSecondary}>Cancel</button>
              <button onClick={createPushCampaign} style={{ ...btnPrimary }}>{newPush.scheduled_at ? "Schedule Campaign" : "Save as Draft"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== ASSIGN ADDON MODAL ==================== */}
      {showAssignAddonModal && addonToAssign && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1001 }} onClick={() => { setShowAssignAddonModal(false); setAddonToAssign(null); }}>
          <div style={{ background: COLORS.cardBg, borderRadius: 20, padding: 32, width: 500, maxWidth: "95%", border: "1px solid " + COLORS.cardBorder }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Assign: {addonToAssign.name}</h2>
                <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.neonGreen }}>{formatMoney(addonToAssign.price)}/mo</div>
              </div>
              <button onClick={() => { setShowAssignAddonModal(false); setAddonToAssign(null); }} style={{ padding: "8px 12px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 8, color: COLORS.textSecondary, cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, fontWeight: 600, textTransform: "uppercase" }}>Search Business</label>
              <input type="text" placeholder="Type to search..." value={addonBusinessSearch} onChange={e => setAddonBusinessSearch(e.target.value)} style={{ ...inputStyle, width: "100%" }} />
            </div>
            {addonBusinessSearch.length > 1 && (
              <div style={{ background: COLORS.darkBg, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, maxHeight: 200, overflowY: "auto" }}>
                {businesses.filter(b => b.name.toLowerCase().includes(addonBusinessSearch.toLowerCase())).slice(0, 8).map(b => (
                  <div key={b.id} onClick={() => { addonToAssign.id === "tpms" ? assignTpms(b.id) : assignAddon(b.id); }} style={{ padding: "12px 14px", borderBottom: "1px solid " + COLORS.cardBorder, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{b.name}</div>
                      <div style={{ fontSize: 10, color: COLORS.textSecondary }}>{b.city}, {b.state}</div>
                    </div>
                    <span style={{ padding: "6px 12px", background: COLORS.gradient1, border: "none", borderRadius: 6, color: "#fff", fontSize: 11, fontWeight: 600 }}>Assign</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== CAMPAIGN PREVIEW MODAL ==================== */}
      {previewCampaign && (() => {
        const meta = (previewCampaign.meta && typeof previewCampaign.meta === "object") ? previewCampaign.meta : {};
        const imgUrls: string[] = Array.isArray(meta.image_urls)
          ? (meta.image_urls as string[]).filter(u => typeof u === "string" && u && !/\.(mp4|mov|webm|avi)$/i.test(u))
          : (meta.image_url && typeof meta.image_url === "string" && !/\.(mp4|mov|webm|avi)$/i.test(meta.image_url)) ? [meta.image_url] : [];
        const imgUrl = imgUrls[0] || null;
        const pushMsg = previewCampaign.push_message || (meta.push_message ? String(meta.push_message) : null);
        const adOpt = getAdOption(previewCampaign.campaign_type);
        const daysTotal = Math.max(1, Math.ceil((new Date(previewCampaign.end_date).getTime() - new Date(previewCampaign.start_date).getTime()) / 86400000) + 1);
        const now = new Date();
        const start = new Date(previewCampaign.start_date);
        const end = new Date(previewCampaign.end_date);
        const daysElapsed = previewCampaign.status === "active" ? Math.max(0, Math.ceil((now.getTime() - start.getTime()) / 86400000)) : 0;
        const daysRemaining = previewCampaign.status === "active" ? Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000)) : daysTotal;
        const progressPct = daysTotal > 0 ? Math.min(100, Math.round((daysElapsed / daysTotal) * 100)) : 0;

        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1001 }} onClick={() => setPreviewCampaign(null)}>
            <div style={{ background: COLORS.cardBg, borderRadius: 20, padding: 0, width: 800, maxWidth: "95%", maxHeight: "90vh", overflowY: "auto", border: "1px solid " + COLORS.cardBorder }} onClick={e => e.stopPropagation()}>

              {/* Hero image / gradient header */}
              <div style={{ position: "relative", height: imgUrl ? 280 : 120, borderRadius: "20px 20px 0 0", overflow: "hidden", background: imgUrl ? "transparent" : "linear-gradient(135deg, #ff2d92, #ff6b35, #bf5fff)" }}>
                {imgUrl && <img src={imgUrl} alt="Campaign" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(transparent 40%, rgba(0,0,0,0.85) 100%)" }} />
                <button onClick={() => setPreviewCampaign(null)} style={{ position: "absolute", top: 16, right: 16, width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                <div style={{ position: "absolute", bottom: 16, left: 24, right: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <Badge status={previewCampaign.status} />
                    {previewCampaign.paid ? (
                      <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: "rgba(57,255,20,0.2)", color: COLORS.neonGreen, border: "1px solid rgba(57,255,20,0.3)" }}>PAID</span>
                    ) : (
                      <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: "rgba(255,49,49,0.2)", color: COLORS.neonRed, border: "1px solid rgba(255,49,49,0.3)" }}>UNPAID</span>
                    )}
                  </div>
                  <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, textShadow: "0 2px 8px rgba(0,0,0,0.5)" }}>{previewCampaign.business_name}</h2>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>{adOpt?.name || previewCampaign.campaign_type} &bull; {adOpt?.radius || "—"}</div>
                </div>
              </div>

              <div style={{ padding: "24px 28px 28px" }}>

                {/* Campaign Image Gallery */}
                {imgUrls.length > 1 && (
                  <div style={{ display: "flex", gap: 8, marginBottom: 20, overflowX: "auto", paddingBottom: 4 }}>
                    {imgUrls.map((url, i) => (
                      <img key={i} src={url} alt={`Campaign ${i + 1}`} style={{ width: 80, height: 60, borderRadius: 8, objectFit: "cover", border: i === 0 ? "2px solid " + COLORS.neonPink : "1px solid rgba(255,255,255,0.1)", flexShrink: 0 }} />
                    ))}
                  </div>
                )}

                {/* Promo Text */}
                {previewCampaign.promo_text && (
                  <div style={{ padding: 16, background: "rgba(255,45,146,0.08)", borderRadius: 12, border: "1px solid rgba(255,45,146,0.2)", marginBottom: 20 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: COLORS.neonPink, marginBottom: 6 }}>Promotional Text</div>
                    <div style={{ fontSize: 15, fontStyle: "italic", color: "rgba(255,255,255,0.9)", lineHeight: 1.5 }}>&ldquo;{previewCampaign.promo_text}&rdquo;</div>
                  </div>
                )}

                {/* Push Notification Message */}
                {pushMsg && (
                  <div style={{ padding: 16, background: "rgba(0,212,255,0.08)", borderRadius: 12, border: "1px solid rgba(0,212,255,0.2)", marginBottom: 20 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: COLORS.neonBlue, marginBottom: 6 }}>Push Notification Message</div>
                    <div style={{ fontSize: 14, color: "rgba(255,255,255,0.85)", lineHeight: 1.4 }}>📱 {pushMsg}</div>
                  </div>
                )}

                {/* Campaign Details Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
                  <div style={{ padding: 14, background: COLORS.darkBg, borderRadius: 10 }}>
                    <div style={{ fontSize: 10, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>Campaign Type</div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{adOpt?.name || previewCampaign.campaign_type}</div>
                    <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 2 }}>{adOpt?.description?.slice(0, 60) || ""}...</div>
                  </div>
                  <div style={{ padding: 14, background: COLORS.darkBg, borderRadius: 10 }}>
                    <div style={{ fontSize: 10, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>Total Price</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.neonGreen }}>{formatMoney(previewCampaign.price_cents)}</div>
                    {previewCampaign.surge_fee_cents > 0 && (
                      <div style={{ fontSize: 10, color: COLORS.neonOrange, marginTop: 2 }}>Base {formatMoney(previewCampaign.base_price_cents)} + 🔥 Surge {formatMoney(previewCampaign.surge_fee_cents)}</div>
                    )}
                  </div>
                  <div style={{ padding: 14, background: COLORS.darkBg, borderRadius: 10 }}>
                    <div style={{ fontSize: 10, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>Coverage</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.neonBlue }}>{adOpt?.radius || "N/A"}</div>
                    {previewCampaign.zip_code && <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 2 }}>From ZIP: {previewCampaign.zip_code}</div>}
                  </div>
                </div>

                {/* Schedule & Progress */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                  <div style={{ padding: 14, background: COLORS.darkBg, borderRadius: 10 }}>
                    <div style={{ fontSize: 10, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>Schedule</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 10, color: COLORS.textSecondary }}>START</div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{formatDate(previewCampaign.start_date)}</div>
                      </div>
                      <div style={{ color: COLORS.textSecondary }}>→</div>
                      <div>
                        <div style={{ fontSize: 10, color: COLORS.textSecondary }}>END</div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{formatDate(previewCampaign.end_date)}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 8 }}>{daysTotal} day{daysTotal !== 1 ? "s" : ""} total</div>
                  </div>
                  <div style={{ padding: 14, background: COLORS.darkBg, borderRadius: 10 }}>
                    <div style={{ fontSize: 10, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>Progress</div>
                    <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,0.1)", overflow: "hidden", marginBottom: 8 }}>
                      <div style={{ height: "100%", width: progressPct + "%", borderRadius: 4, background: previewCampaign.status === "active" ? COLORS.neonGreen : previewCampaign.status === "completed" ? COLORS.neonBlue : COLORS.cardBorder, transition: "width 0.3s ease" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                      <span style={{ color: COLORS.textSecondary }}>{daysElapsed} day{daysElapsed !== 1 ? "s" : ""} elapsed</span>
                      <span style={{ color: COLORS.neonBlue }}>{daysRemaining} day{daysRemaining !== 1 ? "s" : ""} left</span>
                    </div>
                  </div>
                </div>

                {/* Performance Stats */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 10, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 600, marginBottom: 10 }}>Performance</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    <div style={{ padding: 16, background: COLORS.darkBg, borderRadius: 10, textAlign: "center" }}>
                      <div style={{ fontSize: 28, fontWeight: 800, color: COLORS.neonBlue }}>{previewCampaign.impressions.toLocaleString()}</div>
                      <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 4 }}>Impressions</div>
                    </div>
                    <div style={{ padding: 16, background: COLORS.darkBg, borderRadius: 10, textAlign: "center" }}>
                      <div style={{ fontSize: 28, fontWeight: 800, color: COLORS.neonGreen }}>{previewCampaign.clicks.toLocaleString()}</div>
                      <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 4 }}>Clicks</div>
                    </div>
                    <div style={{ padding: 16, background: COLORS.darkBg, borderRadius: 10, textAlign: "center" }}>
                      <div style={{ fontSize: 28, fontWeight: 800, color: COLORS.neonOrange }}>{previewCampaign.impressions > 0 ? ((previewCampaign.clicks / previewCampaign.impressions) * 100).toFixed(2) : "0.00"}%</div>
                      <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 4 }}>CTR</div>
                    </div>
                  </div>
                </div>

                {/* Business Contact Info */}
                <div style={{ padding: 14, background: COLORS.darkBg, borderRadius: 10, marginBottom: 20 }}>
                  <div style={{ fontSize: 10, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 600, marginBottom: 10 }}>Business Info</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {previewCampaign.business_address && (
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>📍 {previewCampaign.business_address}</div>
                    )}
                    {previewCampaign.business_phone && (
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>📞 {previewCampaign.business_phone}</div>
                    )}
                    {previewCampaign.business_email && (
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>✉️ {previewCampaign.business_email}</div>
                    )}
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>ID: {previewCampaign.business_id.slice(0, 12)}...</div>
                  </div>
                </div>

                {/* Priority Days & Window */}
                {(previewCampaign.priority_days?.length || previewCampaign.window_start || previewCampaign.postpone_reason) && (
                  <div style={{ padding: 14, background: COLORS.darkBg, borderRadius: 10, marginBottom: 20 }}>
                    <div style={{ fontSize: 10, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 600, marginBottom: 10 }}>Additional Details</div>
                    {previewCampaign.priority_days && previewCampaign.priority_days.length > 0 && (
                      <div style={{ marginBottom: 8 }}>
                        <span style={{ fontSize: 11, color: COLORS.textSecondary }}>Priority Days: </span>
                        {previewCampaign.priority_days.map(d => (
                          <span key={d} style={{ padding: "2px 8px", background: "rgba(255,45,146,0.15)", borderRadius: 12, fontSize: 10, color: COLORS.neonPink, marginRight: 4 }}>{d}</span>
                        ))}
                      </div>
                    )}
                    {previewCampaign.window_start && previewCampaign.window_end && (
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginBottom: 4 }}>Push Window: {previewCampaign.window_start} – {previewCampaign.window_end}</div>
                    )}
                    {previewCampaign.postpone_reason && (
                      <div style={{ fontSize: 12, color: COLORS.neonOrange }}>Postpone Reason: {previewCampaign.postpone_reason}</div>
                    )}
                  </div>
                )}

                {/* Metadata */}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: COLORS.textSecondary, marginBottom: 20, paddingTop: 12, borderTop: "1px solid " + COLORS.cardBorder }}>
                  <span>Created {formatDateTime(previewCampaign.created_at)}</span>
                  {previewCampaign.paid_at && <span>Paid {formatDateTime(previewCampaign.paid_at)}</span>}
                  <span>Campaign #{previewCampaign.id.slice(0, 8)}</span>
                </div>

                {/* Action Buttons */}
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  {previewCampaign.status === "scheduled" && (
                    <button onClick={() => { updateCampaignStatus(previewCampaign.id, "active"); setPreviewCampaign({ ...previewCampaign, status: "active" }); }} style={{ padding: "12px 24px", background: "rgba(57,255,20,0.2)", border: "1px solid " + COLORS.neonGreen, borderRadius: 10, color: COLORS.neonGreen, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>Activate Now</button>
                  )}
                  {previewCampaign.status === "active" && (
                    <button onClick={() => { updateCampaignStatus(previewCampaign.id, "paused"); setPreviewCampaign({ ...previewCampaign, status: "paused" }); }} style={{ padding: "12px 24px", background: "rgba(255,255,0,0.2)", border: "1px solid " + COLORS.neonYellow, borderRadius: 10, color: COLORS.neonYellow, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>Pause</button>
                  )}
                  {!previewCampaign.paid && (
                    <button onClick={() => { markCampaignPaid(previewCampaign.id); setPreviewCampaign({ ...previewCampaign, paid: true, paid_at: new Date().toISOString() }); }} style={{ padding: "12px 24px", background: "rgba(255,255,0,0.15)", border: "1px solid " + COLORS.neonYellow, borderRadius: 10, color: COLORS.neonYellow, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Mark Paid</button>
                  )}
                  <button onClick={() => { setSelectedCampaign(previewCampaign); setPreviewCampaign(null); }} style={{ padding: "12px 24px", background: COLORS.gradient1, border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>Edit Campaign</button>
                  <button onClick={() => setPreviewCampaign(null)} style={btnSecondary}>Close</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ==================== CONFIRM MODAL ==================== */}
      {confirmModal && (
        <ConfirmModal
          title={confirmModal.title}
          message={confirmModal.message}
          type={confirmModal.type}
          confirmText={confirmModal.confirmText}
          onConfirm={() => { confirmModal.onConfirm(); setConfirmModal(null); }}
          onClose={() => setConfirmModal(null)}
        />
      )}

      {/* ==================== TOASTS ==================== */}
      <div style={{ position: "fixed", bottom: 24, right: 24, display: "flex", flexDirection: "column", gap: 8, zIndex: 2000 }}>
        {toasts.map(t => (
          <div key={t.id} style={{ padding: "12px 20px", borderRadius: 10, color: "#fff", fontWeight: 600, fontSize: 13, minWidth: 250, boxShadow: "0 4px 20px rgba(0,0,0,0.5)", animation: "slideIn 0.3s ease", background: t.type === "success" ? COLORS.neonGreen : t.type === "warning" ? COLORS.neonOrange : t.type === "error" ? COLORS.neonRed : COLORS.neonBlue, ...(t.type === "success" ? { color: "#000" } : {}) }}>
            {t.type === "success" ? "✓" : t.type === "warning" ? "⚠" : t.type === "error" ? "✗" : "ℹ"} {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}