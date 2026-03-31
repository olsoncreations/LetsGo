// components/business/v2/tabs/AdvertisingAddons.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { BusinessTabProps } from "@/components/business/v2/BusinessProfileV2";
import { useIsMobile } from "@/lib/useIsMobile";
import {
  BarChart3,
  Calendar,
  Download,
  TrendingUp,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type SpendView = "monthly" | "yearly";

type ActiveAdCampaign = {
  id: string;
  campaign: string;
  startDate: string;
  endDate: string;
  cost: number;
  status: "Scheduled" | "Active" | "Completed" | "Canceled" | "Purchased" | "Paid in Full";
  rawStatus?: string;
  rawType?: string;
  imageUrls?: string[];
  promoText?: string;
};

type AdvertisingHistoryRow = {
  campaign: string;
  startDate: string;
  endDate: string;
  cost: number;
  clicks: number;
  conversions: number;
};

type SelectedAdCampaign = {
  name: string;
  price: string; // "$599"
  description: string;
  color: string;
  featured?: boolean;
};

type MediaItem = {
  type: "photo" | "video";
  url: string;
  caption: string;
};

type AddOnOption = {
  id: "videos_5_day" | "live_15" | "live_30";
  label: string;
  priceMonthly: number;
  priceLabel: string; // "+$50/month"
};

function currency(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function currency0(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function parsePriceToNumber(price: string) {
  const cleaned = price.replace(/[^0-9.]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function addDays(isoYYYYMMDD: string, days: number) {
  if (!isoYYYYMMDD) return "";
  const d = new Date(`${isoYYYYMMDD}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateLabel(isoYYYYMMDD: string) {
  if (!isoYYYYMMDD) return "";
  const d = new Date(`${isoYYYYMMDD}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoYYYYMMDD;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function normalizeErr(e: unknown): string {
  if (!e) return "Unknown error.";
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message || "Unknown error.";
  try {
    const anyE = e as any;
    const parts = [
      anyE?.message ? `message=${anyE.message}` : null,
      anyE?.details ? `details=${anyE.details}` : null,
      anyE?.hint ? `hint=${anyE.hint}` : null,
      anyE?.code ? `code=${anyE.code}` : null,
    ].filter(Boolean);
    return parts.length ? parts.join(" | ") : JSON.stringify(e);
  } catch {
    return "Unknown error (non-serializable).";
  }
}

// Map DB campaign_type -> UI campaign name
function campaignTypeToName(t: string | null | undefined): string {
  switch ((t ?? "").toLowerCase()) {
    case "ad_1day":
      return "1-Day Spotlight";
    case "ad_7day":
      return "7-Day Spotlight";
    case "ad_14day":
      return "14-Day Spotlight";
    case "ad_100mile":
      return "100 Mile Wide Push";
    case "ad_tourwide":
      return "Tour Wide Push";
    default:
      return t ? t : "Unknown Campaign";
  }
}

function statusToUiStatus(s: string | null | undefined): ActiveAdCampaign["status"] {
  const v = (s ?? "").toLowerCase();
  // Support either of your status schemes
  if (v.includes("active")) return "Active";
  if (v.includes("complete")) return "Completed";
  if (v.includes("cancel")) return "Canceled";
  if (v.includes("paid")) return "Paid in Full";
  if (v.includes("purchased")) return "Purchased";
  if (v.includes("scheduled")) return "Scheduled";
  return "Scheduled";
}

export default function AdvertisingAddons({ businessId, isPremium }: BusinessTabProps) {
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

  // Pricing from platform_settings (fetched, falls back to defaults)
  const [adPricing, setAdPricing] = useState({
    spotlight_1day_cents: 9900,
    spotlight_7day_cents: 59900,
    spotlight_14day_cents: 99900,
    push_100mile_cents: 259900,
    push_tourwide_cents: 459900,
  });
  const [pkgPricing, setPkgPricing] = useState({
    addon_video_5_monthly_cents: 5000,
    addon_live_15_monthly_cents: 5000,
    addon_live_30_monthly_cents: 10000,
    tpms_monthly_cents: 20000,
  });

  useEffect(() => {
    let mounted = true;
    async function fetchPricing() {
      try {
        const { data: ps } = await supabaseBrowser
          .from("platform_settings")
          .select("package_pricing, ad_pricing")
          .eq("id", 1)
          .maybeSingle();
        if (!mounted) return;
        if (ps?.ad_pricing) setAdPricing(ps.ad_pricing);
        if (ps?.package_pricing) setPkgPricing({
          addon_video_5_monthly_cents: ps.package_pricing.addon_video_5_monthly_cents ?? 5000,
          addon_live_15_monthly_cents: ps.package_pricing.addon_live_15_monthly_cents ?? 5000,
          addon_live_30_monthly_cents: ps.package_pricing.addon_live_30_monthly_cents ?? 10000,
          tpms_monthly_cents: ps.package_pricing.tpms_monthly_cents ?? 20000,
        });
      } catch (err) {
        console.error("Error fetching pricing:", err);
      }
    }
    fetchPricing();
    return () => { mounted = false; };
  }, []);

  // Surge pricing
  type SurgeEventBiz = { id: string; start_date: string; end_date: string; categories: string[]; multiplier_bps: number; name: string; is_active: boolean };
  const [surgeEvents, setSurgeEvents] = useState<SurgeEventBiz[]>([]);
  const [businessCategory, setBusinessCategory] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadSurge() {
      const { data } = await supabaseBrowser.from("surge_pricing_events").select("id,name,start_date,end_date,categories,multiplier_bps,is_active").eq("is_active", true);
      if (mounted) setSurgeEvents(data || []);
    }
    async function loadBizCategory() {
      if (!businessId) return;
      const { data } = await supabaseBrowser.from("business").select("config").eq("id", businessId).maybeSingle();
      if (!mounted) return;
      const cfg = data?.config as Record<string, unknown> | null;
      setBusinessCategory((cfg?.businessType as string) || null);
    }
    loadSurge();
    loadBizCategory();
    return () => { mounted = false; };
  }, [businessId]);

  function calcSurgeBiz(startDate: string, endDate: string, basePriceCents: number) {
    const overlapping = surgeEvents.filter(e =>
      e.is_active && e.multiplier_bps > 10000 &&
      e.start_date <= endDate && e.end_date >= startDate &&
      (e.categories.length === 0 || !businessCategory || e.categories.includes(businessCategory))
    );
    if (overlapping.length === 0) return { surgeFee: 0, surgeEventId: null as string | null, multiplierBps: 10000, surgeEventName: "" };
    const maxEvent = overlapping.reduce((max, e) => e.multiplier_bps > max.multiplier_bps ? e : max);
    const surgeFee = Math.floor(basePriceCents * (maxEvent.multiplier_bps - 10000) / 10000);
    return { surgeFee, surgeEventId: maxEvent.id, multiplierBps: maxEvent.multiplier_bps, surgeEventName: maxEvent.name };
  }

  // =========================
  // STATEFUL SELECTIONS (UI-only, but behaves like production)
  // =========================
  const addOnOptions: AddOnOption[] = useMemo(
    () => [
      { id: "videos_5_day", label: "Add 5 videos/day", priceMonthly: pkgPricing.addon_video_5_monthly_cents / 100, priceLabel: `+${currency0(pkgPricing.addon_video_5_monthly_cents / 100)}/month` },
      { id: "live_15", label: "Increase live video capacity to 15", priceMonthly: pkgPricing.addon_live_15_monthly_cents / 100, priceLabel: `+${currency0(pkgPricing.addon_live_15_monthly_cents / 100)}/month` },
      { id: "live_30", label: "Increase live video capacity to 30", priceMonthly: pkgPricing.addon_live_30_monthly_cents / 100, priceLabel: `+${currency0(pkgPricing.addon_live_30_monthly_cents / 100)}/month` },
    ],
    [pkgPricing]
  );

  // Default selections (load from business.config)
  const [selectedAddOnIds, setSelectedAddOnIds] = useState<AddOnOption["id"][]>([]);
  const [tpmsEnabled, setTpmsEnabled] = useState(false);
  const [addOnsLoaded, setAddOnsLoaded] = useState(false);

  // Load add-on selections from config
  async function loadAddOnSelections() {
    if (!businessId) return;

    try {
      const { data, error } = await supabaseBrowser
        .from("business")
        .select("config")
        .eq("id", businessId)
        .maybeSingle();

      if (error) throw error;

      const cfg = (data?.config ?? {}) as Record<string, any>;

      // Load selected add-ons from config
      if (Array.isArray(cfg.selectedAddOns)) {
        setSelectedAddOnIds(cfg.selectedAddOns as AddOnOption["id"][]);
      }

      // Load TPMS setting
      if (typeof cfg.tpmsEnabled === "boolean") {
        setTpmsEnabled(cfg.tpmsEnabled);
      }

      setAddOnsLoaded(true);
    } catch (e) {
      console.error("[AdvertisingAddons] Failed to load add-on config:", e);
      setAddOnsLoaded(true);
    }
  }

  useEffect(() => {
    loadAddOnSelections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  // ✅ DB-wired campaigns (read-first)
  const [activeAdCampaigns, setActiveAdCampaigns] = useState<ActiveAdCampaign[]>([]);

  const [campaignLoadError, setCampaignLoadError] = useState<string | null>(null);
  const [campaignLoading, setCampaignLoading] = useState(false);

  async function loadCampaignsFromDb() {
    if (!businessId) return;

    setCampaignLoading(true);
    setCampaignLoadError(null);

    try {
      const { data, error } = await supabaseBrowser
        .from("business_ad_campaigns")
        .select("id,campaign_type,start_date,end_date,price_cents,base_price_cents,surge_fee_cents,status,staff_override,meta,promo_text")
        .eq("business_id", businessId)
        .order("start_date", { ascending: false })
        .limit(25);

      if (error) throw error;

      const rows = (data ?? []) as Array<any>;
      const mapped: ActiveAdCampaign[] = rows.map((r) => {
        const startIso = r.start_date ? String(r.start_date) : "";
        const endIso = r.end_date ? String(r.end_date) : startIso;

        const metaObj = (r.meta && typeof r.meta === "object") ? r.meta as Record<string, unknown> : {};
        // Support both image_urls (array) and legacy image_url (single string)
        let imgUrls: string[] = [];
        if (Array.isArray(metaObj.image_urls)) {
          imgUrls = (metaObj.image_urls as string[]).filter(u => typeof u === "string" && u);
        } else if (metaObj.image_url && typeof metaObj.image_url === "string") {
          imgUrls = [metaObj.image_url];
        }
        const pText = r.promo_text ? String(r.promo_text) : (metaObj.promo_text ? String(metaObj.promo_text) : undefined);

        return {
          id: String(r.id),
          campaign: campaignTypeToName(r.campaign_type),
          startDate: startIso ? formatDateLabel(startIso) : "",
          endDate: endIso ? formatDateLabel(endIso) : "",
          cost: Number.isFinite(Number(r.price_cents)) ? Number(r.price_cents) / 100 : 0,
          status: statusToUiStatus(r.status),
          rawStatus: r.status ? String(r.status) : "",
          rawType: r.campaign_type ? String(r.campaign_type) : "",
          imageUrls: imgUrls.length > 0 ? imgUrls : undefined,
          promoText: pText,
        };
      });

      // If no campaigns exist, keep empty (don’t keep placeholder)
      setActiveAdCampaigns(mapped);
    } catch (e) {
      setCampaignLoadError(normalizeErr(e));
      // If DB read fails due to RLS while unauthenticated, keep the current placeholder UI.
    } finally {
      setCampaignLoading(false);
    }
  }

  useEffect(() => {
    loadCampaignsFromDb();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  // Spend chart view
  const [spendView, setSpendView] = useState<SpendView>("monthly");

  // Schedule modal state
  const [showAdDateModal, setShowAdDateModal] = useState(false);
  const [selectedAdCampaign, setSelectedAdCampaign] = useState<SelectedAdCampaign | null>(null);
  const [selectedAdImages, setSelectedAdImages] = useState<number[]>([]);

  const [startDateISO, setStartDateISO] = useState("");
  const [endDateISO, setEndDateISO] = useState("");

  const [pushNotificationMessage, setPushNotificationMessage] = useState("");
  const [promoText, setPromoText] = useState("");
  const [tourPriorityDays, setTourPriorityDays] = useState<string[]>(["", "", "", "", "", "", ""]);
  const [tourPushDays, setTourPushDays] = useState<string[]>(["", "", "", "", "", "", "", "", "", "", "", "", "", ""]);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);

  const [modalError, setModalError] = useState<string | null>(null);

  // Advertising history derived from actual campaigns (completed/paid)
  const advertisingHistory: AdvertisingHistoryRow[] = useMemo(() => {
    return activeAdCampaigns
      .filter((c) => c.status === "Completed" || c.status === "Paid in Full")
      .map((c) => ({
        campaign: c.campaign,
        startDate: c.startDate,
        endDate: c.endDate,
        cost: c.cost,
        clicks: 0, // Would need analytics table for real data
        conversions: 0, // Would need analytics table for real data
      }));
  }, [activeAdCampaigns]);

  // ✅ Load media gallery from business_media table
  const [mediaGallery, setMediaGallery] = useState<MediaItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);

  async function loadMediaGallery() {
    if (!businessId) return;
    setMediaLoading(true);
    try {
      const { data, error } = await supabaseBrowser
        .from("business_media")
        .select("id, bucket, path, media_type, caption")
        .eq("business_id", businessId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (error) throw error;

      const items: MediaItem[] = [];
      for (const row of data ?? []) {
        const bucket = String(row.bucket || "business-media");
        const path = String(row.path || "");
        if (!path) continue;

        // Get public URL
        const { data: urlData } = supabaseBrowser.storage.from(bucket).getPublicUrl(path);
        const url = urlData?.publicUrl || "";

        const mediaType = String(row.media_type || "").toLowerCase().includes("video") ? "video" : "photo";
        items.push({
          type: mediaType as "photo" | "video",
          url,
          caption: String(row.caption || "(untitled)"),
        });
      }
      setMediaGallery(items);
    } catch (e) {
      console.error("[AdvertisingAddons] Media load error:", e);
    } finally {
      setMediaLoading(false);
    }
  }

  useEffect(() => {
    loadMediaGallery();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  // =========================
  // Derived totals
  // =========================
  const selectedAddOns = useMemo(
    () => addOnOptions.filter((a) => selectedAddOnIds.includes(a.id)),
    [addOnOptions, selectedAddOnIds]
  );

  const addOnsSubtotal = useMemo(
    () => selectedAddOns.reduce((sum, a) => sum + a.priceMonthly, 0) + (tpmsEnabled ? pkgPricing.tpms_monthly_cents / 100 : 0),
    [selectedAddOns, tpmsEnabled, pkgPricing]
  );

  const advertisingSubtotal = useMemo(
    () => activeAdCampaigns.reduce((sum, c) => sum + c.cost, 0),
    [activeAdCampaigns]
  );

  const totalThisMonth = useMemo(
    () => addOnsSubtotal + advertisingSubtotal,
    [addOnsSubtotal, advertisingSubtotal]
  );

  // Spend chart data - shows actual campaign data or helpful empty state
  const monthlySpendData = useMemo(() => {
    // Group campaigns by month
    const monthMap = new Map<string, { advertising: number; addOns: number }>();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    // Initialize all months with 0
    months.forEach((m) => monthMap.set(m, { advertising: 0, addOns: 0 }));

    // Add campaign costs to their months
    for (const c of activeAdCampaigns) {
      // Parse start date to get month
      const dateMatch = c.startDate.match(/([A-Za-z]+)/);
      if (dateMatch) {
        const monthAbbrev = dateMatch[1].slice(0, 3);
        const existing = monthMap.get(monthAbbrev);
        if (existing) {
          existing.advertising += c.cost;
        }
      }
    }

    return months.map((m) => ({
      month: m,
      advertising: monthMap.get(m)?.advertising || 0,
      addOns: addOnsSubtotal, // Current add-ons applied to each month
    }));
  }, [activeAdCampaigns, addOnsSubtotal]);

  const yearlySpendData = useMemo(() => {
    // For yearly, show current year with actual data
    const currentYear = new Date().getFullYear();
    const totalAdSpend = activeAdCampaigns.reduce((sum, c) => sum + c.cost, 0);

    return [
      { year: String(currentYear - 2), advertising: 0, addOns: 0 },
      { year: String(currentYear - 1), advertising: 0, addOns: 0 },
      { year: String(currentYear), advertising: totalAdSpend, addOns: addOnsSubtotal * 12 },
    ];
  }, [activeAdCampaigns, addOnsSubtotal]);

  const totals = useMemo(() => {
    const spend = advertisingHistory.reduce((sum, c) => sum + c.cost, 0);
    const clicks = advertisingHistory.reduce((sum, c) => sum + c.clicks, 0);
    const conversions = advertisingHistory.reduce((sum, c) => sum + c.conversions, 0);
    return { spend, clicks, conversions };
  }, [advertisingHistory]);

  function onDownload(kind: "CSV" | "XLSX") {
    alert(`Download ${kind} — coming soon.`);
  }

  const spotlightCampaigns = useMemo(
    () =>
      [
        {
          name: "1-Day Spotlight",
          price: currency0(adPricing.spotlight_1day_cents / 100),
          description:
            "Featured at top of Discovery feed for 1 day in your category (within 20 miles of your business zip code)",
          color: colors.accent,
        },
        {
          name: "7-Day Spotlight",
          price: currency0(adPricing.spotlight_7day_cents / 100),
          description:
            "Featured at top of Discovery feed for 7 days in your category (within 50 miles of your zip code)",
          color: colors.primary,
        },
        {
          name: "14-Day Spotlight",
          price: currency0(adPricing.spotlight_14day_cents / 100),
          description:
            "Featured at top of Discovery feed for 14 days in your category (within 50 miles of your zip code)",
          color: colors.secondary,
        },
      ] as SelectedAdCampaign[],
    [colors.accent, colors.primary, colors.secondary, adPricing]
  );

  const pushCampaigns = useMemo(
    () =>
      [
        {
          name: "100 Mile Wide Push",
          price: currency0(adPricing.push_100mile_cents / 100),
          description:
            "Promoted to all users within 100 miles of your business zip code with push notifications for 7 days straight and top priority placement on Discovery page",
          color: colors.success,
          featured: true,
        },
        {
          name: "Tour Wide Push",
          price: currency0(adPricing.push_tourwide_cents / 100),
          description:
            "Promoted to all users within 100 miles of your business zip code with push notifications for 14 days total (split in 60-day range) and top priority placement on Discovery page for 7 days (priority days may be split up)",
          color: colors.warning,
          featured: false,
        },
      ] as SelectedAdCampaign[],
    [colors.success, colors.warning, adPricing]
  );

  function openScheduleModal(c: SelectedAdCampaign) {
    setSelectedAdCampaign(c);
    setShowAdDateModal(true);
    setSelectedAdImages([]);
    setStartDateISO("");
    setEndDateISO("");
    setPushNotificationMessage("");
    setTourPriorityDays(["", "", "", "", "", "", ""]);
    setTourPushDays(["", "", "", "", "", "", "", "", "", "", "", "", "", ""]);
    setModalError(null);
  }

  function closeScheduleModal() {
    setShowAdDateModal(false);
    setSelectedAdCampaign(null);
    setSelectedAdImages([]);
    setStartDateISO("");
    setEndDateISO("");
    setPushNotificationMessage("");
    setPromoText("");
    setTourPriorityDays(["", "", "", "", "", "", ""]);
    setTourPushDays(["", "", "", "", "", "", "", "", "", "", "", "", "", ""]);
    setModalError(null);
    setEditingCampaignId(null);
  }

  function openEditCampaign(campaign: ActiveAdCampaign) {
    // Map rawType back to the SelectedAdCampaign option
    const allOptions = [...spotlightCampaigns, ...pushCampaigns];
    const typeNameMap: Record<string, string> = {
      ad_1day: "1-Day Spotlight", ad_7day: "7-Day Spotlight", ad_14day: "14-Day Spotlight",
      ad_100mile: "100 Mile Wide Push", ad_tourwide: "Tour Wide Push",
    };
    const matchName = typeNameMap[campaign.rawType || ""] || "";
    const option = allOptions.find(o => o.name === matchName);
    if (!option) { alert("Cannot edit this campaign type."); return; }

    // Find the photo indices to pre-select
    const photos = mediaGallery.filter(m => m.type === "photo");
    const photoIdxs: number[] = [];
    if (campaign.imageUrls && campaign.imageUrls.length > 0) {
      for (const url of campaign.imageUrls) {
        const idx = photos.findIndex(p => p.url === url);
        if (idx >= 0) photoIdxs.push(idx);
      }
    }

    // Parse dates from display format back to ISO
    const parseDisplayDate = (d: string): string => {
      try { const dt = new Date(d); return dt.toISOString().slice(0, 10); } catch { return ""; }
    };

    setSelectedAdCampaign(option);
    setShowAdDateModal(true);
    setSelectedAdImages(photoIdxs);
    setStartDateISO(parseDisplayDate(campaign.startDate));
    setEndDateISO(parseDisplayDate(campaign.endDate));
    setPromoText(campaign.promoText || "");
    setPushNotificationMessage("");
    setTourPriorityDays(["", "", "", "", "", "", ""]);
    setTourPushDays(["", "", "", "", "", "", "", "", "", "", "", "", "", ""]);
    setModalError(null);
    setEditingCampaignId(campaign.id);

    // Load media if not loaded yet
    if (mediaGallery.length === 0) loadMediaGallery();
  }

  // Save add-on selections to config
  async function saveAddOnSelections(newAddOnIds: AddOnOption["id"][], newTpmsEnabled: boolean) {
    if (!businessId) return;

    try {
      // First get existing config
      const { data: existing, error: fetchErr } = await supabaseBrowser
        .from("business")
        .select("config")
        .eq("id", businessId)
        .maybeSingle();

      if (fetchErr) throw fetchErr;

      const cfg = (existing?.config ?? {}) as Record<string, any>;

      // Merge new add-on selections
      const updatedConfig = {
        ...cfg,
        selectedAddOns: newAddOnIds,
        tpmsEnabled: newTpmsEnabled,
      };

      const { error: updateErr } = await supabaseBrowser
        .from("business")
        .update({ config: updatedConfig })
        .eq("id", businessId);

      if (updateErr) throw updateErr;
    } catch (e) {
      console.error("[AdvertisingAddons] Failed to save add-on selections:", e);
    }
  }

  // ✅ MUTUAL EXCLUSIVITY:
  function toggleAddOn(id: AddOnOption["id"]) {
    setSelectedAddOnIds((prev) => {
      const isChecked = prev.includes(id);
      let newIds: AddOnOption["id"][];
      
      if (isChecked) {
        newIds = prev.filter((x) => x !== id);
      } else {
        const next = [...prev];
        if (id === "live_15") {
          newIds = [...next.filter((x) => x !== "live_30"), "live_15"];
        } else if (id === "live_30") {
          newIds = [...next.filter((x) => x !== "live_15"), "live_30"];
        } else {
          newIds = [...next, id];
        }
      }
      
      // Save to DB (async, non-blocking)
      saveAddOnSelections(newIds, tpmsEnabled);
      return newIds;
    });
  }

  // Handle TPMS toggle with persistence
  function handleTpmsToggle(checked: boolean) {
    setTpmsEnabled(checked);
    saveAddOnSelections(selectedAddOnIds, checked);
  }

  async function removeActiveCampaign(id: string) {
    // Find the campaign to check timing
    const campaign = activeAdCampaigns.find(c => c.id === id);
    if (!campaign) return;

    const now = new Date();
    const startDate = new Date(campaign.startDate);
    const msUntilStart = startDate.getTime() - now.getTime();
    const hoursUntilStart = msUntilStart / (1000 * 60 * 60);
    const isLive = campaign.status === "Active" || now >= startDate;
    const isWithin24h = hoursUntilStart >= 0 && hoursUntilStart < 24;

    let message: string;
    if (isLive) {
      message = "This campaign is already live and cannot be refunded.\n\n" +
        "Cancellation Policy: Campaigns that have already started are non-refundable. " +
        "The campaign will be stopped immediately but no refund will be issued.\n\n" +
        "Are you sure you want to cancel?";
    } else if (isWithin24h) {
      message = `This campaign starts in less than 24 hours.\n\n` +
        "Cancellation Policy: Cancellations within 24 hours of the start date are non-refundable. " +
        "No refund will be issued.\n\n" +
        "Are you sure you want to cancel?";
    } else {
      message = "You are canceling this campaign more than 24 hours before its start date.\n\n" +
        "Cancellation Policy: You are eligible for a full refund. " +
        "The refund will be processed to your original payment method.\n\n" +
        "Are you sure you want to cancel?";
    }

    if (!confirm(message)) return;

    try {
      const { error } = await supabaseBrowser
        .from("business_ad_campaigns")
        .update({ status: "canceled" })
        .eq("id", id)
        .eq("business_id", businessId);

      if (error) throw error;

      await loadCampaignsFromDb();
      if (isLive || isWithin24h) {
        alert("Campaign canceled. No refund will be issued per our cancellation policy.");
      } else {
        alert("Campaign canceled. A full refund will be processed.");
      }
    } catch (e) {
      alert("Failed to cancel campaign: " + normalizeErr(e));
    }
  }

  function buildDefaultEndDateISO(campaignName: string, startISO: string) {
    if (!startISO) return "";
    if (campaignName === "1-Day Spotlight") return startISO;
    if (campaignName === "7-Day Spotlight") return addDays(startISO, 6);
    if (campaignName === "14-Day Spotlight") return addDays(startISO, 13);
    if (campaignName === "100 Mile Wide Push") return addDays(startISO, 6);
    return "";
  }

  function validateModal(): boolean {
    if (!selectedAdCampaign) return false;

    if (selectedAdImages.length === 0) {
      setModalError("Please select at least one campaign image (up to 5).");
      return false;
    }
    if (!startDateISO) {
      setModalError("Please select a start date.");
      return false;
    }

    const isPush = selectedAdCampaign.name === "100 Mile Wide Push" || selectedAdCampaign.name === "Tour Wide Push";
    if (isPush && !pushNotificationMessage.trim()) {
      setModalError("Please enter a push notification message.");
      return false;
    }

    if (selectedAdCampaign.name === "Tour Wide Push") {
      if (!endDateISO) {
        setModalError("Please select a campaign end date (60-day window).");
        return false;
      }
      const missingPriority = tourPriorityDays.some((d) => !d);
      if (missingPriority) {
        setModalError("Please choose all 7 priority placement days.");
        return false;
      }
      const missingPushDays = tourPushDays.some((d) => !d);
      if (missingPushDays) {
        setModalError("Please choose all 14 push notification days.");
        return false;
      }
    } else {
      const needsEnd = selectedAdCampaign.name !== "1-Day Spotlight";
      if (needsEnd && !endDateISO) {
        setModalError("Please select an end date.");
        return false;
      }
    }

    setModalError(null);
    return true;
  }

  async function confirmPurchase() {
    if (!selectedAdCampaign) return;
    if (!validateModal()) return;

    // Map campaign name to campaign_type
    const campaignTypeMap: Record<string, string> = {
      "1-Day Spotlight": "ad_1day",
      "7-Day Spotlight": "ad_7day",
      "14-Day Spotlight": "ad_14day",
      "100 Mile Wide Push": "ad_100mile",
      "Tour Wide Push": "ad_tourwide",
    };

    const campaignType = campaignTypeMap[selectedAdCampaign.name] || "ad_unknown";
    const priceCents = parsePriceToNumber(selectedAdCampaign.price) * 100;

    // Build meta for push campaigns
    const meta: Record<string, any> = {};
    if (pushNotificationMessage) {
      meta.push_message = pushNotificationMessage;
    }
    if (selectedAdCampaign.name === "Tour Wide Push") {
      if (tourPriorityDays.some(d => d)) {
        meta.priority_days = tourPriorityDays.filter(d => d);
      }
      if (tourPushDays.some(d => d)) {
        meta.push_notification_days = tourPushDays.filter(d => d);
      }
    }
    if (selectedAdImages.length > 0) {
      const photos = mediaGallery.filter(m => m.type === "photo");
      const urls = selectedAdImages.map(i => photos[i]?.url).filter(Boolean);
      if (urls.length > 0) {
        meta.image_urls = urls;
        meta.image_url = urls[0]; // backward compat
      }
    }
    if (promoText.trim()) {
      meta.promo_text = promoText.trim();
    }

    // Compute surge pricing
    const campEnd = endDateISO || startDateISO;
    const { surgeFee, surgeEventId, multiplierBps } = calcSurgeBiz(startDateISO, campEnd, priceCents);
    const totalCents = priceCents + surgeFee;

    try {
      const payload = {
        business_id: businessId,
        campaign_type: campaignType,
        start_date: startDateISO,
        end_date: campEnd,
        base_price_cents: priceCents,
        surge_fee_cents: surgeFee,
        surge_event_id: surgeEventId,
        surge_multiplier_bps: multiplierBps,
        price_cents: totalCents,
        meta: Object.keys(meta).length > 0 ? meta : null,
        promo_text: promoText.trim() || null,
      };

      if (editingCampaignId) {
        // Update existing campaign
        const { error } = await supabaseBrowser
          .from("business_ad_campaigns")
          .update(payload)
          .eq("id", editingCampaignId)
          .eq("business_id", businessId);
        if (error) throw error;
      } else {
        // Insert new campaign
        const { error } = await supabaseBrowser
          .from("business_ad_campaigns")
          .insert({ ...payload, status: "purchased" });
        if (error) throw error;
      }

      // Reload campaigns
      await loadCampaignsFromDb();
      closeScheduleModal();
      alert(editingCampaignId
        ? `Campaign "${selectedAdCampaign.name}" updated successfully!`
        : `Campaign "${selectedAdCampaign.name}" purchased successfully!`
      );
    } catch (e) {
      setModalError(normalizeErr(e));
    }
  }

  return (
    <div>
      {/* DB load status (non-intrusive) */}
      {campaignLoading ? (
        <div style={{ marginBottom: "1rem", color: "rgba(255,255,255,0.6)", fontWeight: 800 }}>
          Loading campaigns…
        </div>
      ) : null}
      {campaignLoadError ? (
        <div
          style={{
            marginBottom: "1rem",
            padding: "0.75rem 1rem",
            background: "rgba(239, 68, 68, 0.10)",
            border: "1px solid rgba(239, 68, 68, 0.25)",
            borderRadius: "12px",
            color: "rgba(255,255,255,0.85)",
            fontWeight: 800,
            fontSize: "0.85rem",
          }}
        >
          Campaign load note: {campaignLoadError}
        </div>
      ) : null}

      {/* --- EVERYTHING BELOW IS YOUR CLAUDE UI, UNCHANGED --- */}
      {/* Current Add-ons & Monthly Costs */}
      <div
        style={{
          background: "rgba(255, 255, 255, 0.03)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "16px",
          padding: "2rem",
          marginBottom: "2rem",
        }}
      >
        <div style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "1.5rem", color: colors.primary }}>
          Current Add-ons & Advertising Monthly Costs
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 2fr", gap: isMobile ? "1.5rem" : "3rem" }}>
          {/* Active Add-ons */}
          <div>
            <div style={{ fontSize: "0.875rem", color: "rgba(255, 255, 255, 0.6)", marginBottom: "0.75rem" }}>
              Active Premium Add-ons
            </div>

            {selectedAddOns.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {selectedAddOns.map((addon) => (
                  <div
                    key={addon.id}
                    style={{
                      padding: "0.75rem",
                      background: "rgba(255, 255, 255, 0.02)",
                      borderRadius: "8px",
                      border: "1px solid rgba(255, 255, 255, 0.05)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ fontSize: "0.875rem", fontWeight: 700 }}>{addon.label}</div>
                    <div style={{ fontFamily: '"Space Mono", monospace', fontWeight: 800, color: colors.primary }}>
                      +{currency(addon.priceMonthly)}/mo
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  padding: "1rem",
                  background: "rgba(255, 255, 255, 0.02)",
                  borderRadius: "8px",
                  fontSize: "0.875rem",
                  color: "rgba(255, 255, 255, 0.5)",
                }}
              >
                No active add-ons
              </div>
            )}
          </div>

          {/* Itemized Monthly Costs */}
          <div
            style={{
              background: "rgba(255, 255, 255, 0.02)",
              borderRadius: "12px",
              padding: "1.5rem",
              border: "1px solid rgba(255, 255, 255, 0.05)",
            }}
          >
            <div style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "1rem", color: colors.secondary }}>
              This Month&apos;s Advertising & Add-ons
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1rem" }}>
              {selectedAddOns.map((addon) => (
                <div key={addon.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
                  <span style={{ color: "rgba(255, 255, 255, 0.7)" }}>{addon.label}</span>
                  <span style={{ fontFamily: '"Space Mono", monospace', fontWeight: 700 }}>{currency(addon.priceMonthly)}</span>
                </div>
              ))}

              {tpmsEnabled && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
                  <span style={{ color: "rgba(255, 255, 255, 0.7)" }}>TPMS Service</span>
                  <span style={{ fontFamily: '"Space Mono", monospace', fontWeight: 700 }}>{currency(pkgPricing.tpms_monthly_cents / 100)}</span>
                </div>
              )}

              {activeAdCampaigns.map((campaign) => (
                <div key={campaign.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
                  <span style={{ color: "rgba(255, 255, 255, 0.7)" }}>{campaign.campaign}</span>
                  <span style={{ fontFamily: '"Space Mono", monospace', fontWeight: 700 }}>{currency(campaign.cost)}</span>
                </div>
              ))}

              {selectedAddOns.length === 0 && !tpmsEnabled && activeAdCampaigns.length === 0 && (
                <div style={{ color: "rgba(255, 255, 255, 0.5)", fontSize: "0.875rem" }}>No charges this month</div>
              )}
            </div>

            <div style={{ height: 1, background: "rgba(255, 255, 255, 0.1)", marginBottom: "1rem" }} />

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
                <span style={{ color: "rgba(255, 255, 255, 0.6)" }}>Add-ons Subtotal:</span>
                <span style={{ fontFamily: '"Space Mono", monospace', color: colors.primary, fontWeight: 800 }}>
                  {currency(addOnsSubtotal)}
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
                <span style={{ color: "rgba(255, 255, 255, 0.6)" }}>Advertising Subtotal:</span>
                <span style={{ fontFamily: '"Space Mono", monospace', color: colors.accent, fontWeight: 800 }}>
                  {currency(advertisingSubtotal)}
                </span>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "1rem",
                background: `linear-gradient(135deg, ${colors.secondary}20 0%, ${colors.primary}20 100%)`,
                borderRadius: "8px",
                border: `1px solid ${colors.secondary}40`,
              }}
            >
              <span style={{ fontWeight: 700, fontSize: "1rem" }}>Total This Month:</span>
              <span style={{ fontFamily: '"Space Mono", monospace', fontSize: "1.5rem", fontWeight: 900, color: colors.secondary }}>
                {currency(totalThisMonth)}
              </span>
            </div>

            <div style={{ marginTop: "0.75rem", fontSize: "0.75rem", color: "rgba(255,255,255,0.35)" }}>
              Business ID (for wiring): <span style={{ fontFamily: '"Space Mono", monospace' }}>{businessId}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Advertising & Add-on Spend Chart */}
      <div
        style={{
          background: "rgba(255, 255, 255, 0.03)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "16px",
          padding: "2rem",
          marginBottom: "2rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "1.25rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <TrendingUp size={20} style={{ color: colors.secondary }} />
            Advertising & Add-on Spend
          </div>

          <div style={{ display: "flex", gap: "0.5rem", background: "rgba(255, 255, 255, 0.05)", padding: "0.25rem", borderRadius: "8px" }}>
            {[{ id: "monthly" as const, label: "Monthly" }, { id: "yearly" as const, label: "Yearly" }].map((view) => (
              <button
                key={view.id}
                onClick={() => setSpendView(view.id)}
                style={{
                  padding: "0.5rem 1rem",
                  background: spendView === view.id ? colors.secondary : "transparent",
                  border: "none",
                  borderRadius: "6px",
                  color: "white",
                  fontSize: "0.875rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                }}
              >
                {view.label}
              </button>
            ))}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={spendView === "monthly" ? monthlySpendData : yearlySpendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis dataKey={spendView === "monthly" ? "month" : "year"} stroke="rgba(255,255,255,0.5)" />
            <YAxis stroke="rgba(255,255,255,0.5)" />
            <Tooltip
              contentStyle={{
                background: "rgba(15, 23, 42, 0.95)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px",
                color: "white",
              }}
            />
            <Legend />
            <Bar dataKey="advertising" fill={colors.secondary} name="Advertising ($)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="addOns" fill={colors.primary} name="Add-ons ($)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Upcoming & Active Campaigns */}
      <div
        style={{
          background: "rgba(255, 255, 255, 0.03)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "16px",
          padding: "2rem",
          marginBottom: "2rem",
        }}
      >
        <div style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Calendar size={20} style={{ color: colors.warning }} />
          Upcoming & Active Campaigns
        </div>

        {activeAdCampaigns.length > 0 ? (
          <div style={{ display: "grid", gap: "1rem" }}>
            {activeAdCampaigns.map((campaign) => {
              // Determine if campaign is live or upcoming
              const now = new Date();
              const startDate = new Date(campaign.startDate);
              const endDate = new Date(campaign.endDate);
              // Handle display dates like "Feb 22, 2026" — Date() parses them
              const isLive = campaign.status === "Active" || (now >= startDate && now <= new Date(endDate.getTime() + 86400000));
              const isUpcoming = !isLive && startDate > now;

              // Countdown for upcoming campaigns
              let countdown = "";
              if (isUpcoming) {
                const diffMs = startDate.getTime() - now.getTime();
                const diffDays = Math.floor(diffMs / 86400000);
                const diffHours = Math.floor((diffMs % 86400000) / 3600000);
                if (diffDays > 0) {
                  countdown = `${diffDays}d ${diffHours}h until live`;
                } else {
                  countdown = `${diffHours}h until live`;
                }
              }

              return (
              <div
                key={campaign.id}
                style={{
                  background: isLive ? "rgba(57, 255, 20, 0.04)" : "rgba(255, 255, 255, 0.02)",
                  border: isLive ? "1px solid rgba(57, 255, 20, 0.2)" : "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: "12px",
                  padding: "1.25rem",
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                  {/* Campaign image thumbnails */}
                  {campaign.imageUrls && campaign.imageUrls.length > 0 ? (
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      {campaign.imageUrls.slice(0, 3).map((url, imgIdx) => {
                        const isVid = /\.(mp4|mov|webm|avi)$/i.test(url);
                        return isVid ? (
                          <div key={imgIdx} style={{
                            width: campaign.imageUrls!.length === 1 ? 80 : 48, height: 80, borderRadius: 8,
                            background: "linear-gradient(135deg, rgba(255,45,146,0.2), rgba(0,212,255,0.2))",
                            border: "1px solid rgba(255,255,255,0.1)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 18, color: "rgba(255,255,255,0.3)",
                          }}>🎬</div>
                        ) : (
                          <img key={imgIdx} src={url} alt={`Campaign ${imgIdx + 1}`} style={{
                            width: campaign.imageUrls!.length === 1 ? 80 : 48, height: 80, borderRadius: 8,
                            objectFit: "cover", border: "1px solid rgba(255,255,255,0.1)",
                          }} />
                        );
                      })}
                      {campaign.imageUrls.length > 3 && (
                        <div style={{
                          width: 48, height: 80, borderRadius: 8,
                          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.4)",
                        }}>+{campaign.imageUrls.length - 3}</div>
                      )}
                    </div>
                  ) : (
                    <div style={{
                      width: 80, height: 80, borderRadius: 8, flexShrink: 0,
                      background: "linear-gradient(135deg, rgba(255,45,146,0.2), rgba(0,212,255,0.2))",
                      border: "1px solid rgba(255,255,255,0.1)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 24, color: "rgba(255,255,255,0.3)",
                    }}>📢</div>
                  )}

                  {/* Campaign info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
                      <div>
                        <div style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "0.25rem" }}>
                          {campaign.campaign}
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "rgba(255, 255, 255, 0.55)" }}>
                          {campaign.startDate} — {campaign.endDate}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                        {isLive && (
                          <div style={{
                            padding: "3px 10px", borderRadius: 20, fontSize: "0.65rem", fontWeight: 700,
                            background: "rgba(57,255,20,0.15)", color: colors.success,
                            border: "1px solid rgba(57,255,20,0.3)",
                            display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap",
                          }}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: colors.success, display: "inline-block" }} />
                            LIVE NOW
                          </div>
                        )}
                        {isUpcoming && countdown && (
                          <div style={{
                            padding: "3px 10px", borderRadius: 20, fontSize: "0.65rem", fontWeight: 700,
                            background: "rgba(0,212,255,0.1)", color: colors.secondary,
                            border: "1px solid rgba(0,212,255,0.2)", whiteSpace: "nowrap",
                          }}>
                            {countdown}
                          </div>
                        )}
                        <div style={{ fontSize: "1.1rem", fontWeight: 800, fontFamily: '"Space Mono", monospace', color: colors.secondary }}>
                          {currency0(campaign.cost)}
                        </div>
                      </div>
                    </div>

                    {/* Promo text */}
                    {campaign.promoText && (
                      <div style={{
                        marginTop: "0.5rem", padding: "0.5rem 0.75rem", borderRadius: 6,
                        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
                        fontSize: "0.8rem", color: "rgba(255,255,255,0.75)", fontStyle: "italic", lineHeight: 1.4,
                      }}>
                        &ldquo;{campaign.promoText}&rdquo;
                      </div>
                    )}

                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.5rem" }}>
                      <span style={{
                        display: "inline-block", padding: "3px 10px", borderRadius: 50, fontSize: "0.7rem", fontWeight: 700,
                        background: campaign.status === "Active" ? "rgba(57,255,20,0.15)" : campaign.status === "Purchased" ? "rgba(0,212,255,0.15)" : "rgba(255,255,255,0.08)",
                        color: campaign.status === "Active" ? colors.success : campaign.status === "Purchased" ? colors.secondary : "rgba(255,255,255,0.6)",
                        border: `1px solid ${campaign.status === "Active" ? "rgba(57,255,20,0.3)" : campaign.status === "Purchased" ? "rgba(0,212,255,0.3)" : "rgba(255,255,255,0.12)"}`,
                      }}>
                        {campaign.status}
                      </span>
                      {isUpcoming && (
                        <button
                          type="button"
                          onClick={() => openEditCampaign(campaign)}
                          style={{
                            padding: "3px 10px", borderRadius: 50, fontSize: "0.7rem", fontWeight: 700,
                            background: "rgba(0,212,255,0.12)", border: "1px solid rgba(0,212,255,0.3)",
                            color: colors.secondary, cursor: "pointer",
                          }}
                        >
                          Edit
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeActiveCampaign(campaign.id)}
                        style={{
                          padding: "3px 10px", borderRadius: 50, fontSize: "0.7rem", fontWeight: 700,
                          background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.3)",
                          color: colors.danger, cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: "1rem", color: "rgba(255,255,255,0.55)" }}>No active campaigns.</div>
        )}
      </div>

      {/* Past Campaign Performance */}
      <div
        style={{
          background: "rgba(255, 255, 255, 0.03)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "16px",
          padding: "2rem",
          marginBottom: "2rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "1.25rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <BarChart3 size={20} style={{ color: colors.secondary }} />
            Past Campaign Performance
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="button" onClick={() => onDownload("CSV")} style={dlBtn(`${colors.success}20`, colors.success)}>
              <Download size={14} /> CSV
            </button>

            <button type="button" onClick={() => onDownload("XLSX")} style={dlBtn(`${colors.accent}20`, colors.accent)}>
              <Download size={14} /> XLSX
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
          {[
            { label: "Total Spend (All Time)", value: `$${totals.spend.toLocaleString()}`, color: colors.secondary },
            { label: "Total Clicks", value: totals.clicks.toLocaleString(), color: colors.primary },
            { label: "Total Conversions", value: totals.conversions.toLocaleString(), color: colors.success },
          ].map((t) => (
            <div key={t.label} style={{ padding: "1rem", background: "rgba(255, 255, 255, 0.02)", borderRadius: "8px", textAlign: "center" }}>
              <div style={{ fontSize: "0.75rem", color: "rgba(255, 255, 255, 0.5)", marginBottom: "0.5rem" }}>{t.label}</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, fontFamily: '"Space Mono", monospace', color: t.color }}>{t.value}</div>
            </div>
          ))}
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.1)" }}>
                {["Campaign", "Start Date", "End Date", "Cost", "Clicks", "Conversions", "ROI"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "1rem",
                      textAlign: h === "Cost" || h === "Clicks" || h === "Conversions" || h === "ROI" ? "right" : "left",
                      fontSize: "0.875rem",
                      color: "rgba(255, 255, 255, 0.6)",
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
              {advertisingHistory.map((campaign, idx) => {
                const roi = (((campaign.conversions * 52.03 - campaign.cost) / campaign.cost) * 100).toFixed(1);
                const roiNum = Number(roi);

                return (
                  <tr key={idx} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                    <td style={{ padding: "1rem", fontSize: "0.875rem", fontWeight: 700 }}>{campaign.campaign}</td>
                    <td style={{ padding: "1rem", fontSize: "0.875rem", color: "rgba(255, 255, 255, 0.7)" }}>{campaign.startDate}</td>
                    <td style={{ padding: "1rem", fontSize: "0.875rem", color: "rgba(255, 255, 255, 0.7)" }}>{campaign.endDate}</td>
                    <td style={{ padding: "1rem", textAlign: "right", fontSize: "0.875rem", fontFamily: '"Space Mono", monospace' }}>
                      ${campaign.cost.toLocaleString()}
                    </td>
                    <td style={{ padding: "1rem", textAlign: "right", fontSize: "0.875rem", fontFamily: '"Space Mono", monospace' }}>
                      {campaign.clicks.toLocaleString()}
                    </td>
                    <td style={{ padding: "1rem", textAlign: "right", fontSize: "0.875rem", fontFamily: '"Space Mono", monospace', color: colors.success }}>
                      {campaign.conversions}
                    </td>
                    <td
                      style={{
                        padding: "1rem",
                        textAlign: "right",
                        fontSize: "0.875rem",
                        fontFamily: '"Space Mono", monospace',
                        color: roiNum > 0 ? colors.success : colors.danger,
                        fontWeight: 800,
                      }}
                    >
                      {roi}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Premium Add-ons */}
      <div
        style={{
          background: "rgba(255, 255, 255, 0.03)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "16px",
          padding: "2rem",
          marginBottom: "2rem",
        }}
      >
        <div style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem", color: colors.purple }}>
          Premium Add-ons
        </div>
        <div style={{ fontSize: "0.875rem", color: "rgba(255, 255, 255, 0.6)", marginBottom: "1.5rem" }}>
          Enhance your Premium subscription with additional features
        </div>

        <div style={{ display: "grid", gap: "1rem" }}>
          {addOnOptions.map((addon) => {
            const checked = selectedAddOnIds.includes(addon.id);
            const priceColor = addon.priceMonthly === 100 ? colors.warning : colors.primary;

            return (
              <div
                key={addon.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "1rem",
                  background: "rgba(255, 255, 255, 0.02)",
                  borderRadius: "8px",
                  border: `1px solid ${colors.primary}33`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleAddOn(addon.id)}
                    style={{ width: 18, height: 18, cursor: "pointer" }}
                  />
                  <span style={{ fontWeight: 700 }}>{addon.label}</span>
                </div>

                <span style={{ fontFamily: '"Space Mono", monospace', color: priceColor, fontWeight: 800 }}>
                  {addon.priceLabel}
                </span>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: "0.75rem", fontSize: "0.75rem", color: "rgba(255,255,255,0.55)" }}>
          Note: Only one live video capacity add-on can be selected at a time (15 <em>or</em> 30).
        </div>
      </div>

      {/* Optional Services */}
      <div
        style={{
          background: "rgba(255, 255, 255, 0.03)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "16px",
          padding: "2rem",
          marginBottom: "2rem",
        }}
      >
        <div style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "1rem", color: colors.accent }}>
          Optional Services
        </div>

        <div
          style={{
            background: tpmsEnabled ? "rgba(20, 184, 166, 0.10)" : "rgba(251, 191, 36, 0.10)",
            border: tpmsEnabled ? `1px solid ${colors.primary}55` : "1px solid rgba(251, 191, 36, 0.30)",
            borderRadius: "12px",
            padding: "1.5rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
            <input
              type="checkbox"
              checked={tpmsEnabled}
              onChange={(e) => handleTpmsToggle(e.target.checked)}
              style={{ width: 18, height: 18, cursor: "pointer", marginTop: "0.2rem" }}
            />

            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.5rem" }}>
                <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>
                  Total Profile Management Services (TPMS)
                </div>
                {tpmsEnabled && (
                  <span
                    style={{
                      padding: "0.25rem 0.75rem",
                      background: colors.primary,
                      color: "white",
                      borderRadius: "6px",
                      fontSize: "0.75rem",
                      fontWeight: 800,
                      textTransform: "uppercase",
                    }}
                  >
                    Active
                  </span>
                )}
              </div>

              <div style={{ fontSize: "1.25rem", fontWeight: 800, fontFamily: '"Space Mono", monospace', color: colors.warning, marginBottom: "0.75rem" }}>
                {currency0(pkgPricing.tpms_monthly_cents / 100)}/month
              </div>

              <div style={{ fontSize: "0.875rem", lineHeight: 1.6, color: "rgba(255, 255, 255, 0.8)" }}>
                We&apos;ll handle receipt reviews and approvals for you, keep your profile updated with fresh uploads, and manage your payout ladder settings for optimal performance.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Advertising Campaigns (cards) */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(6, 182, 212, 0.15) 100%)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(16, 185, 129, 0.2)",
          borderRadius: "16px",
          padding: "2rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
          <TrendingUp size={24} style={{ color: colors.success }} />
          <div
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              background: "linear-gradient(135deg, #10b981 0%, #34d399 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Boost Your Visibility with Advertising
          </div>
        </div>

        <div style={{ fontSize: "0.9rem", color: "rgba(255, 255, 255, 0.7)", marginBottom: "2rem" }}>
          Want even more customers? Add targeted advertising campaigns
        </div>

        {/* Spotlight */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem", marginBottom: "2rem" }}>
          {spotlightCampaigns.map((campaign, idx) => (
            <div key={idx} style={{ background: "rgba(255, 255, 255, 0.05)", backdropFilter: "blur(10px)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "12px", padding: "1.5rem", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: "-50%", right: "-30%", width: 200, height: 200, background: `radial-gradient(circle, ${campaign.color}30 0%, transparent 70%)`, borderRadius: "50%" }} />
              <div style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem" }}>{campaign.name}</div>
              <div style={{ fontSize: "2rem", fontWeight: 800, fontFamily: '"Space Mono", monospace', color: campaign.color, marginBottom: "1rem" }}>
                {campaign.price}
              </div>
              <div style={{ fontSize: "0.875rem", color: "rgba(255, 255, 255, 0.7)", lineHeight: 1.5, marginBottom: "1.5rem", minHeight: 60 }}>
                {campaign.description}
              </div>

              <button
                type="button"
                onClick={() => openScheduleModal(campaign)}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  background: `${campaign.color}20`,
                  border: `1px solid ${campaign.color}`,
                  borderRadius: "8px",
                  color: campaign.color,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Select
              </button>
            </div>
          ))}
        </div>

        {/* Push */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem", marginBottom: "2rem" }}>
          {pushCampaigns.map((campaign, idx) => (
            <div key={idx} style={{ background: "rgba(255, 255, 255, 0.05)", backdropFilter: "blur(10px)", border: `2px solid ${campaign.featured ? campaign.color : "rgba(255, 255, 255, 0.1)"}`, borderRadius: "12px", padding: "1.5rem", position: "relative", overflow: "hidden" }}>
              {campaign.featured && (
                <div style={{ position: "absolute", top: 12, right: 12, background: campaign.color, color: "white", padding: "0.25rem 0.6rem", borderRadius: 999, fontSize: "0.7rem", fontWeight: 800, letterSpacing: "0.05em" }}>
                  FEATURED
                </div>
              )}

              <div style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem" }}>{campaign.name}</div>
              <div style={{ fontSize: "2rem", fontWeight: 800, fontFamily: '"Space Mono", monospace', color: campaign.color, marginBottom: "1rem" }}>
                {campaign.price}
              </div>
              <div style={{ fontSize: "0.875rem", color: "rgba(255, 255, 255, 0.7)", lineHeight: 1.5, marginBottom: "1.5rem" }}>
                {campaign.description}
              </div>

              <button
                type="button"
                onClick={() => openScheduleModal(campaign)}
                style={{
                  width: "100%",
                  padding: "0.875rem",
                  background: campaign.featured ? campaign.color : `${campaign.color}20`,
                  border: `1px solid ${campaign.color}`,
                  borderRadius: "8px",
                  color: campaign.featured ? "white" : campaign.color,
                  fontWeight: 800,
                  fontSize: "0.9rem",
                  cursor: "pointer",
                }}
              >
                Select
              </button>
            </div>
          ))}
        </div>

        {/* Custom request */}
        <div style={{ background: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "12px", padding: "1.5rem", display: "flex", alignItems: "center", gap: "1rem" }}>
          <input type="checkbox" style={{ width: 18, height: 18, cursor: "pointer" }} onChange={() => alert("A LetsGo rep will contact you about custom advertising plans.")} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, marginBottom: "0.25rem" }}>I&apos;d like a LetsGo rep to contact me about custom advertising plans</div>
            <div style={{ fontSize: "0.875rem", color: "rgba(255, 255, 255, 0.6)" }}>Get personalized advertising solutions tailored to your business goals</div>
          </div>
        </div>
      </div>

      {/* Ad Campaign Date Selection Modal (unchanged) */}
      {showAdDateModal && selectedAdCampaign && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.8)",
            backdropFilter: "blur(10px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: isMobile ? "0.5rem" : "2rem",
            overflowY: "auto",
          }}
          onClick={() => closeScheduleModal()}
        >
          <div
            style={{
              background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: isMobile ? "12px" : "16px",
              padding: isMobile ? "1rem" : "1.5rem",
              maxWidth: "500px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              overflowX: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", marginBottom: "0.75rem" }}>
              <div>
                <div style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.25rem" }}>
                  {editingCampaignId ? "Edit" : "Schedule"} {selectedAdCampaign.name}
                </div>
                <div style={{ fontSize: "1.5rem", fontWeight: 800, fontFamily: '"Space Mono", monospace', color: selectedAdCampaign.color }}>
                  {selectedAdCampaign.price}
                </div>
              </div>

              <button type="button" onClick={() => closeScheduleModal()} style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.75)", cursor: "pointer", padding: 4 }} aria-label="Close" title="Close">
                <X size={20} />
              </button>
            </div>

            {modalError && (
              <div style={{ marginBottom: "0.75rem", padding: "0.5rem 0.75rem", background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.35)", borderRadius: "8px", color: "rgba(255,255,255,0.9)", fontWeight: 700, fontSize: "0.8rem" }}>
                {modalError}
              </div>
            )}

            {/* (your original modal fields remain unchanged below) */}
            {/* ... you already have these fields in your file; leaving as-is ... */}

            <div style={{ display: "grid", gap: "1rem", marginBottom: "1rem" }}>
              {/* image grid */}
              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 700, marginBottom: "0.375rem", color: "rgba(255, 255, 255, 0.7)" }}>
                  Select Campaign Photos (up to 5) <span style={{ color: colors.danger }}>*</span>
                </label>
                <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", marginBottom: "0.375rem" }}>
                  {selectedAdImages.length}/5 selected — tap to select or deselect
                </div>

                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: "0.5rem", padding: "0.75rem", background: "rgba(255, 255, 255, 0.02)", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.1)", maxHeight: 160, overflowY: "auto" }}>
                  {mediaGallery.filter((m) => m.type === "photo").length === 0 ? (
                    <div style={{ gridColumn: "1 / -1", padding: "0.75rem", textAlign: "center", color: "rgba(255,255,255,0.5)", fontSize: "0.8rem" }}>
                      No photos uploaded yet. Go to Media tab to upload photos.
                    </div>
                  ) : (
                    mediaGallery
                      .filter((m) => m.type === "photo")
                      .map((photo, idx) => {
                        const isSelected = selectedAdImages.includes(idx);
                        const selectionOrder = isSelected ? selectedAdImages.indexOf(idx) + 1 : 0;
                        return (
                          <div
                            key={idx}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedAdImages(prev => prev.filter(i => i !== idx));
                              } else if (selectedAdImages.length < 5) {
                                setSelectedAdImages(prev => [...prev, idx]);
                              }
                            }}
                            style={{
                              position: "relative",
                              aspectRatio: "1",
                              borderRadius: "6px",
                              overflow: "hidden",
                              cursor: selectedAdImages.length >= 5 && !isSelected ? "not-allowed" : "pointer",
                              opacity: selectedAdImages.length >= 5 && !isSelected ? 0.4 : 1,
                              border: isSelected ? `2px solid ${selectedAdCampaign.color}` : "2px solid transparent",
                            }}
                          >
                            {photo.url ? (
                              <img src={photo.url} alt={photo.caption} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                              <div style={{ width: "100%", height: "100%", background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)", fontSize: "0.6rem" }}>No URL</div>
                            )}
                            {isSelected && (
                              <div style={{
                                position: "absolute", top: 2, right: 2,
                                background: selectedAdCampaign.color, borderRadius: "50%",
                                width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 10, fontWeight: 800, color: "white",
                              }}>
                                {selectionOrder}
                              </div>
                            )}
                          </div>
                        );
                      })
                  )}
                </div>
              </div>

              {/* dates */}
              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 700, marginBottom: "0.375rem", color: "rgba(255, 255, 255, 0.7)" }}>
                  {selectedAdCampaign.name === "1-Day Spotlight" 
                    ? "Campaign Date" 
                    : selectedAdCampaign.name === "Tour Wide Push"
                    ? "60-Day Window Start"
                    : "Campaign Start Date"} <span style={{ color: colors.danger }}>*</span>
                </label>
                {selectedAdCampaign.name === "Tour Wide Push" && (
                  <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", marginBottom: "0.5rem" }}>
                    Select the start of your 60-day campaign window. You'll pick specific days within this window below.
                  </div>
                )}
                <input
                  type="date"
                  min={new Date().toISOString().split("T")[0]}
                  value={startDateISO}
                  onChange={(e) => {
                    const v = e.target.value;
                    setStartDateISO(v);
                    const autoEnd = buildDefaultEndDateISO(selectedAdCampaign.name, v);
                    if (selectedAdCampaign.name !== "Tour Wide Push") {
                      setEndDateISO(autoEnd);
                    } else {
                      // For Tour Wide Push, auto-set end to 60 days from start
                      setEndDateISO(addDays(v, 59));
                    }
                  }}
                  style={{
                    width: "100%",
                    padding: "0.625rem",
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "6px",
                    color: "white",
                    fontSize: "0.8rem",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              {selectedAdCampaign.name !== "1-Day Spotlight" && (
                <div>
                  <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 700, marginBottom: "0.375rem", color: "rgba(255, 255, 255, 0.7)" }}>
                    {selectedAdCampaign.name === "Tour Wide Push" ? "60-Day Window End" : "Campaign End Date"} <span style={{ color: colors.danger }}>*</span>
                  </label>
                  <input
                    type="date"
                    min={startDateISO || new Date().toISOString().split("T")[0]}
                    max={selectedAdCampaign.name === "Tour Wide Push" && startDateISO ? addDays(startDateISO, 59) : undefined}
                    value={endDateISO}
                    onChange={(e) => setEndDateISO(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.625rem",
                      background: "rgba(255, 255, 255, 0.05)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: "6px",
                      color: "white",
                      fontSize: "0.8rem",
                      fontFamily: "inherit",
                    }}
                  />
                </div>
              )}

              {/* Promotional Text (all campaign types) */}
              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 700, marginBottom: "0.375rem", color: "rgba(255, 255, 255, 0.7)" }}>
                  Promotional Text <span style={{ fontSize: "0.75rem", fontWeight: 400, color: "rgba(255,255,255,0.4)" }}>(optional)</span>
                </label>
                <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.45)", marginBottom: "0.375rem" }}>
                  A short message shown on your sponsored Discovery placement (max 120 characters).
                </div>
                <textarea
                  value={promoText}
                  onChange={(e) => setPromoText(e.target.value.slice(0, 120))}
                  placeholder='e.g. "50% off all appetizers this weekend!" or "Now open late night Fri & Sat"'
                  style={{
                    width: "100%",
                    padding: "0.625rem",
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "6px",
                    color: "white",
                    fontSize: "0.8rem",
                    fontFamily: "inherit",
                    minHeight: 50,
                    resize: "vertical",
                  }}
                />
                <div style={{ textAlign: "right", fontSize: "0.65rem", color: "rgba(255,255,255,0.3)", marginTop: 4 }}>
                  {promoText.length}/120
                </div>
              </div>

              {(selectedAdCampaign.name === "100 Mile Wide Push" || selectedAdCampaign.name === "Tour Wide Push") && (
                <div>
                  <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 700, marginBottom: "0.375rem", color: "rgba(255, 255, 255, 0.7)" }}>
                    Push Notification Message <span style={{ color: colors.danger }}>*</span>
                  </label>
                  <textarea
                    value={pushNotificationMessage}
                    onChange={(e) => setPushNotificationMessage(e.target.value.slice(0, 150))}
                    placeholder="Enter your push notification message (max 150 characters)..."
                    style={{
                      width: "100%",
                      padding: "0.625rem",
                      background: "rgba(255, 255, 255, 0.05)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: "6px",
                      color: "white",
                      fontSize: "0.8rem",
                      fontFamily: "inherit",
                      minHeight: 60,
                      resize: "vertical",
                    }}
                  />
                </div>
              )}

              {/* Tour Wide Push: Priority Placement Days (7 days, can be split) */}
              {selectedAdCampaign.name === "Tour Wide Push" && (
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, marginBottom: "0.25rem", color: "rgba(255, 255, 255, 0.7)" }}>
                    Priority Placement Days (7 days) <span style={{ color: colors.danger }}>*</span>
                  </label>
                  <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.5)", marginBottom: "0.375rem" }}>
                    Select 7 days for top Discovery placement (can be split within 60-day window)
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "0.375rem" }}>
                    {tourPriorityDays.map((day, idx) => (
                      <div key={`priority-${idx}`} style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                        <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", minWidth: "28px" }}>#{idx + 1}</span>
                        <input
                          type="date"
                          value={day}
                          min={startDateISO || new Date().toISOString().split("T")[0]}
                          max={endDateISO || undefined}
                          onChange={(e) => {
                            const newDays = [...tourPriorityDays];
                            newDays[idx] = e.target.value;
                            setTourPriorityDays(newDays);
                          }}
                          style={{
                            flex: 1,
                            padding: "0.375rem 0.5rem",
                            background: "rgba(255, 255, 255, 0.05)",
                            border: day ? `1px solid ${colors.warning}` : "1px solid rgba(255, 255, 255, 0.1)",
                            borderRadius: "4px",
                            color: "white",
                            fontSize: "0.7rem",
                            fontFamily: "inherit",
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tour Wide Push: Push Notification Days (14 days, can be split) */}
              {selectedAdCampaign.name === "Tour Wide Push" && (
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, marginBottom: "0.25rem", color: "rgba(255, 255, 255, 0.7)" }}>
                    Push Notification Days (14 days) <span style={{ color: colors.danger }}>*</span>
                  </label>
                  <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.5)", marginBottom: "0.375rem" }}>
                    Select 14 days for push notifications (can be split within 60-day window)
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "0.375rem", maxHeight: "160px", overflowY: "auto", padding: "0.375rem", background: "rgba(255,255,255,0.02)", borderRadius: "6px" }}>
                    {tourPushDays.map((day, idx) => (
                      <div key={`push-${idx}`} style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                        <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", minWidth: "28px" }}>#{idx + 1}</span>
                        <input
                          type="date"
                          value={day}
                          min={startDateISO || new Date().toISOString().split("T")[0]}
                          max={endDateISO || undefined}
                          onChange={(e) => {
                            const newDays = [...tourPushDays];
                            newDays[idx] = e.target.value;
                            setTourPushDays(newDays);
                          }}
                          style={{
                            flex: 1,
                            padding: "0.375rem 0.5rem",
                            background: "rgba(255, 255, 255, 0.05)",
                            border: day ? `1px solid ${colors.success}` : "1px solid rgba(255, 255, 255, 0.1)",
                            borderRadius: "4px",
                            color: "white",
                            fontSize: "0.7rem",
                            fontFamily: "inherit",
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Surge Pricing Alert */}
            {startDateISO && (() => {
              const baseCents = parsePriceToNumber(selectedAdCampaign.price) * 100;
              const eDate = endDateISO || startDateISO;
              const { surgeFee, multiplierBps, surgeEventName } = calcSurgeBiz(startDateISO, eDate, baseCents);
              if (surgeFee === 0) return null;
              return (
                <div style={{ marginBottom: "0.75rem", padding: "0.75rem 1rem", background: "rgba(255,107,53,0.1)", borderRadius: 10, border: "1px solid rgba(255,107,53,0.3)" }}>
                  <div style={{ fontWeight: 700, fontSize: "0.8rem", color: "#ff6b35", marginBottom: 6 }}>🔥 Hot Day Surge: {surgeEventName} ({(multiplierBps / 10000).toFixed(2)}x)</div>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 8, fontSize: "0.75rem" }}>
                    <div><div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.65rem" }}>BASE</div><div style={{ fontWeight: 700, color: "#10b981" }}>{currency(baseCents / 100)}</div></div>
                    <div><div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.65rem" }}>SURGE FEE</div><div style={{ fontWeight: 700, color: "#ff6b35" }}>+{currency(surgeFee / 100)}</div></div>
                    <div><div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.65rem" }}>TOTAL</div><div style={{ fontWeight: 800, color: "#f97316" }}>{currency((baseCents + surgeFee) / 100)}</div></div>
                  </div>
                </div>
              );
            })()}

            <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
              <button type="button" onClick={() => closeScheduleModal()} style={modalBtnGhost()}>
                Cancel
              </button>

              <button type="button" onClick={() => confirmPurchase()} style={modalBtnPrimary(selectedAdCampaign.color)}>
                {editingCampaignId ? "Save Changes" : "Confirm Purchase"}
              </button>
            </div>

            <div style={{ marginTop: "0.75rem", fontSize: "0.7rem", color: "rgba(255,255,255,0.35)" }}>
              {editingCampaignId ? "This will update the existing campaign." : "This will create a business_ad_campaigns record."}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function dlBtn(bg: string, color: string): React.CSSProperties {
    return {
      padding: "0.5rem 1rem",
      background: bg,
      border: `1px solid ${color}`,
      borderRadius: "6px",
      color,
      fontSize: "0.75rem",
      fontWeight: 700,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
    };
  }

  function modalBtnGhost(): React.CSSProperties {
    return {
      flex: 1,
      padding: "0.625rem",
      background: "rgba(255, 255, 255, 0.05)",
      border: "1px solid rgba(255, 255, 255, 0.2)",
      borderRadius: "6px",
      color: "white",
      fontSize: "0.8rem",
      fontWeight: 700,
      cursor: "pointer",
    };
  }

  function modalBtnPrimary(color: string): React.CSSProperties {
    return {
      flex: 1,
      padding: "0.625rem",
      background: `linear-gradient(135deg, ${color} 0%, ${color}CC 100%)`,
      border: "none",
      borderRadius: "6px",
      color: "white",
      fontSize: "0.8rem",
      fontWeight: 800,
      cursor: "pointer",
      boxShadow: `0 4px 15px ${color}50`,
    };
  }
}