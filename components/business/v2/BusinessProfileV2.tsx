// components/business/v2/BusinessProfileV2.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { useIsMobile, useIsTablet } from "@/lib/useIsMobile";

// Tabs
import Overview from "@/components/business/v2/tabs/Overview";
import Analytics from "@/components/business/v2/tabs/Analytics";
import Receipts from "@/components/business/v2/tabs/Receipts";
import Media from "@/components/business/v2/tabs/Media";
import Events from "@/components/business/v2/tabs/Events";
import AdvertisingAddons from "@/components/business/v2/tabs/AdvertisingAddons";
import Billing from "@/components/business/v2/tabs/Billing";
import Profile from "@/components/business/v2/tabs/Profile";
import Support from "@/components/business/v2/tabs/Support";
import Location from "@/components/business/v2/tabs/Location";
import NotificationBell from "@/components/NotificationBell";
import OnboardingTooltip from "@/components/OnboardingTooltip";
import { useOnboardingTour, type TourStep } from "@/lib/useOnboardingTour";
import { DashboardOverviewAnim, AnalyticsAnim, ReceiptAnim, PayoutTiersAnim, MediaAnim, EventCalendarAnim, SpotlightAnim, CashOutAnim, ProfileAnim, SupportAnim } from "@/components/TourIllustrations";

// Icons
import {
  AlertCircle,
  BarChart3,
  Calendar,
  Camera,
  CheckCircle,
  DollarSign,
  Settings,
  TrendingUp,
  LogOut,
  MapPin,
  UploadCloud,
  FileText,
  X,
} from "lucide-react";

type TabId =
  | "overview"
  | "analytics"
  | "receipts"
  | "media"
  | "events"
  | "advertising"
  | "billing"
  | "location"
  | "profile"
  | "support";

/**
 * LONG-TERM CONTRACT (LOCK THIS IN):
 * Every business tab accepts these props.
 */
export type BusinessTabProps = {
  businessId: string;
  isPremium: boolean;
  setActiveTab?: (tabId: TabId) => void;
  refreshKey?: number;
};

type BusinessProfileV2Props = {
  businessId: string;
};

const OverviewTab = Overview as unknown as React.ComponentType<any>;
const AnalyticsTab = Analytics as unknown as React.ComponentType<BusinessTabProps>;
const ReceiptsTab = Receipts as unknown as React.ComponentType<BusinessTabProps>;
const MediaTab = Media as unknown as React.ComponentType<BusinessTabProps>;
const EventsTab = Events as unknown as React.ComponentType<BusinessTabProps>;
const AdvertisingAddonsTab = AdvertisingAddons as unknown as React.ComponentType<BusinessTabProps>;
const BillingTab = Billing as unknown as React.ComponentType<BusinessTabProps>;
const ProfileTab = Profile as unknown as React.ComponentType<BusinessTabProps>;
const LocationTab = Location as unknown as React.ComponentType<BusinessTabProps>;
const SupportTab = Support as unknown as React.ComponentType<BusinessTabProps>;

type ProfileSnapshot = {
  businessId: string;
  fields: {
    name: string;
    type: string;
    streetAddress: string;
    city: string;
    state: string;
    zip: string;
    phone: string;
    email: string;
    website: string;
    description: string;
    cuisineType: string;
    priceLevel: string;
    ageRestriction: string;

    repName: string;
    repTitle: string;
    repEmail: string;
    repPhone: string;

    loginEmail: string;
    loginPhone: string;
  };
  hours: Record<string, { open: string; close: string }>;
  tags: string[];
};

// Note: __LG_BP_PROFILE_GET_SNAPSHOT is declared in Profile.tsx

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

export default function BusinessProfileV2({ businessId }: BusinessProfileV2Props) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const [authChecked, setAuthChecked] = useState(false);

  // ── Auth guard ──
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      if (!session?.user || !session.access_token) {
        router.replace("/welcome");
        return;
      }
      setAuthChecked(true);
    })();
  }, [router]);

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

  const [activeTab, setActiveTab] = useState<TabId>("overview");

  const [effectivePlanNow, setEffectivePlanNow] = useState<string | null>(null);
  const isPremium = effectivePlanNow === "premium";
  const [businessName, setBusinessName] = useState<string | null>(null);

  // Terms modal
  const [showLegalDisclaimerModal, setShowLegalDisclaimerModal] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(false);

  // Publish state
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  // refreshKey forces tabs to re-run effects if they use it
  const [refreshKey, setRefreshKey] = useState(0);

  // Onboarding tour
  const dashboardTourSteps: TourStep[] = useMemo(() => [
    { target: '[data-tour="tab-overview"]', title: "Welcome to Your Dashboard", description: "This is your business command center. The Overview tab shows key metrics — receipts, payouts, customer visits, and more at a glance.", position: "bottom" },
    { target: '[data-tour="tab-analytics"]', title: "Track Your Performance", description: "View detailed charts and trends for receipts, payouts, and customer activity over time.", position: "bottom" },
    { target: '[data-tour="tab-receipts"]', title: "Manage Customer Receipts", description: "Review, approve, or reject customer receipt submissions. This is where you verify visits and manage your approval queue.", position: "bottom" },
    { target: '[data-tour="tab-receipts"]', title: "Set Your Payout Tiers", description: "This is also where you control your payout structure — set the cashback percentages customers earn at each visit tier, from 5% up to 20%.", position: "bottom" },
    { target: '[data-tour="tab-media"]', title: "Upload Photos & Media", description: "Manage your business photos and approve user-generated content that customers share.", position: "bottom" },
    { target: '[data-tour="tab-events"]', title: "Create & Manage Events", description: "Post upcoming events like trivia nights, live music, and tastings to attract new customers.", position: "bottom" },
    { target: '[data-tour="tab-advertising"]', title: "Promote Your Business", description: "Boost your visibility with spotlight placements, push notifications, and premium ad add-ons.", position: "bottom" },
    { target: '[data-tour="tab-billing"]', title: "Plans & Billing", description: "View your current plan, manage payment methods, and review your monthly invoices.", position: "bottom" },
    { target: '[data-tour="tab-profile"]', title: "Edit Your Profile", description: "Update your business name, hours, address, tags, and description. Keep your listing fresh.", position: "bottom" },
    { target: '[data-tour="tab-support"]', title: "Get Help Anytime", description: "Reach out to our support team anytime. We're here to help you succeed on LetsGo!", position: "bottom" },
  ], []);
  const dashboardTourIllustrations: React.ReactNode[] = useMemo(() => [
    <DashboardOverviewAnim key="do" />,
    <AnalyticsAnim key="a" />,
    <ReceiptAnim key="r" />,
    <PayoutTiersAnim key="pt" />,
    <MediaAnim key="m" />,
    <EventCalendarAnim key="ec" />,
    <SpotlightAnim key="sp" />,
    <CashOutAnim key="co" />,
    <ProfileAnim key="p" />,
    <SupportAnim key="s" />,
  ], []);
  const dashboardTour = useOnboardingTour("business-dashboard", dashboardTourSteps, 1000);

  async function fetchPlanStatus(bid: string) {
    const { data, error } = await supabaseBrowser
      .from("v_business_plan_status")
      .select("effective_plan_now")
      .eq("business_id", bid)
      .maybeSingle();

    if (error) {
      console.error("fetchPlanStatus error:", error);
      setEffectivePlanNow(null);
      return;
    }

    setEffectivePlanNow(data?.effective_plan_now ?? null);
  }

  useEffect(() => {
    if (!businessId) return;
    fetchPlanStatus(businessId);

    // Fetch business name for header (server-side to bypass RLS)
    fetch(`/api/auth/check-business?businessId=${businessId}`)
      .then((res) => res.json())
      .then(({ businessName: name }) => {
        setBusinessName(name || null);
      })
      .catch(() => {});
  }, [businessId]);

  const premiumOnlyTabs = useMemo(() => new Set<TabId>(["events", "advertising"]), []);

  const tabs = useMemo(
    () => [
      { id: "overview" as const, label: "Overview", icon: <BarChart3 size={16} /> },
      { id: "analytics" as const, label: "Analytics", icon: <TrendingUp size={16} /> },
      { id: "receipts" as const, label: "Receipt Redemption", icon: <CheckCircle size={16} /> },
      { id: "media" as const, label: "Media Gallery", icon: <Camera size={16} /> },
      { id: "events" as const, label: "Events", icon: <Calendar size={16} /> },
      { id: "advertising" as const, label: "Advertising & Add-ons", icon: <TrendingUp size={16} /> },
      { id: "billing" as const, label: "Plans & Billing", icon: <DollarSign size={16} /> },
      { id: "location" as const, label: "Location", icon: <MapPin size={16} /> },
      { id: "profile" as const, label: "Profile Settings", icon: <Settings size={16} /> },
      { id: "support" as const, label: "Support & Help", icon: <AlertCircle size={16} /> },
    ],
    []
  );

  useEffect(() => {
    if (!businessId) return;
    if (!effectivePlanNow) return;
    if (!isPremium && premiumOnlyTabs.has(activeTab)) setActiveTab("overview");
  }, [businessId, effectivePlanNow, isPremium, premiumOnlyTabs, activeTab]);

  const tabProps = useMemo<BusinessTabProps>(
    () => ({
      businessId,
      isPremium,
      setActiveTab: (tabId: TabId) => setActiveTab(tabId),
      refreshKey,
    }),
    [businessId, isPremium, refreshKey]
  );

  function handleSignOut() {
    // Fire and forget — don't block redirect on the signOut API call
    supabaseBrowser.auth.signOut().catch(() => {});
    // Clear session from localStorage directly as a fallback
    if (typeof window !== "undefined") {
      localStorage.removeItem("letsgo-auth");
    }
    window.location.href = "/welcome";
  }

  function openPublishModal() {
    setPublishError(null);
    setLegalAccepted(false);
    setShowLegalDisclaimerModal(true);
  }

  function closePublishModal() {
    if (publishing) return;
    setShowLegalDisclaimerModal(false);
    setLegalAccepted(false);
    setPublishError(null);
  }

  async function handleConfirmPublish() {
  if (!legalAccepted) return;

  const getter = window.__LG_BP_PROFILE_GET_SNAPSHOT;
  const snap = getter ? getter(businessId) : null;

  if (!snap) {
    alert(
      "Publish failed: Profile snapshot not available.\n\nGo to Profile Settings tab first, then try Publish again."
    );
    return;
  }

  try {
    setPublishing(true);
    setPublishError(null);

    // ✅ Build payload EXACTLY like your DB function expects:
    // p_payload->'business', p_payload->'config', p_payload->'hours', p_payload->'tags'
    const payload = {
      business: {
        business_name: snap.fields.name ?? null,
        public_business_name: snap.fields.name ?? null,

        business_type: snap.fields.type ?? null,
        street_address: snap.fields.streetAddress ?? null,
        city: snap.fields.city ?? null,
        state: snap.fields.state ?? null,
        zip: snap.fields.zip ?? null,

        business_phone: snap.fields.phone ?? null,
        contact_email: snap.fields.email ?? null,
        website: snap.fields.website ?? null,

        blurb: snap.fields.description ?? null,
        category_main: snap.fields.cuisineType ?? null,
        price_level: snap.fields.priceLevel ?? null,
        age_restriction: snap.fields.ageRestriction ?? null,
      },

      config: {
        repName: snap.fields.repName ?? null,
        repTitle: snap.fields.repTitle ?? null,
        repEmail: snap.fields.repEmail ?? null,
        repPhone: snap.fields.repPhone ?? null,
        loginEmail: snap.fields.loginEmail ?? null,
        loginPhone: snap.fields.loginPhone ?? null,
      },

      hours: snap.hours ?? {},
      tags: Array.isArray(snap.tags) ? snap.tags : [],
    };

    // Call server-side API to bypass RLS
    const { data: { session } } = await supabaseBrowser.auth.getSession();
    if (!session?.access_token) {
      throw new Error("Your session has expired. Please sign out and sign back in, then try again.");
    }
    const res = await fetch(`/api/businesses/${businessId}/publish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Publish failed");

    // Force UI to re-pull DB data
    setRefreshKey((k) => k + 1);

    closePublishModal();

    alert("Published successfully (saved to database).");

    // Keep them on Profile so they see the result immediately
    setActiveTab("profile");
  } catch (e) {
    setPublishError(normalizeErr(e));
  } finally {
    setPublishing(false);
  }
}


  if (!authChecked) return null;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0a0f1a 100%)",
        fontFamily: '"Poppins", sans-serif',
        color: "#ffffff",
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap"
        rel="stylesheet"
      />

      {/* Header */}
      <div
        style={{
          background: "rgba(255, 255, 255, 0.03)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          padding: isMobile ? "0.75rem 1rem" : isTablet ? "1rem 1.5rem" : "1.25rem 3rem",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: isMobile ? "0.5rem" : "1.5rem", flexWrap: isMobile ? "wrap" : undefined }}>
          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? "0.5rem" : "1rem" }}>
            <div
              style={{
                width: isMobile ? "36px" : "46px",
                height: isMobile ? "36px" : "46px",
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 10px 30px rgba(20,184,166,0.18)",
                overflow: "hidden",
              }}
            >
              <img
                src="/lg-logo.png"
                alt="LetsGo"
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            </div>
            <div>
              <div
                style={{
                  fontSize: isMobile ? "1.05rem" : "1.35rem",
                  fontWeight: 800,
                  background: "linear-gradient(135deg, #ffffff 0%, #14b8a6 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                {businessName || "LetsGo Business"}
              </div>
              <div style={{ fontSize: "0.85rem", color: "rgba(255, 255, 255, 0.5)", display: isMobile ? "none" : undefined }}>Business ID: {businessId}</div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? "0.4rem" : "0.75rem" }}>
            <NotificationBell />
            <div
              style={{
                padding: isMobile ? "0.4rem 0.5rem" : "0.5rem 0.75rem",
                borderRadius: "10px",
                background: isPremium ? "rgba(16,185,129,0.15)" : "rgba(249,115,22,0.15)",
                border: isPremium ? "1px solid rgba(16,185,129,0.35)" : "1px solid rgba(249,115,22,0.35)",
                fontWeight: 900,
                fontSize: isMobile ? "0.7rem" : "0.85rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                whiteSpace: "nowrap",
              }}
              title="Read from v_business_plan_status.effective_plan_now"
            >
              {!isMobile && "Plan:"}
              <span style={{ fontFamily: '"Space Mono", monospace' }}>{effectivePlanNow ?? "loading…"}</span>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              style={{
                padding: isMobile ? "0.5rem" : "0.65rem 1rem",
                borderRadius: "10px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.14)",
                color: "rgba(255,255,255,0.95)",
                fontWeight: 900,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                opacity: 1,
              }}
              title="Sign Out"
            >
              <LogOut size={16} />
              {!isMobile && "Sign Out"}
            </button>

            <button
              type="button"
              onClick={openPublishModal}
              style={{
                padding: isMobile ? "0.5rem" : "0.65rem 1.15rem",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%)",
                border: "1px solid rgba(20, 184, 166, 0.45)",
                color: "white",
                fontWeight: 950,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.55rem",
                boxShadow: "0 14px 34px rgba(20, 184, 166, 0.22)",
                whiteSpace: "nowrap",
                opacity: publishing ? 0.75 : 1,
              }}
              title={publishing ? "Publishing…" : "Publish Changes"}
            >
              <UploadCloud size={16} />
              {!isMobile && (publishing ? "Publishing…" : "Publish Changes")}
            </button>
          </div>
        </div>

      </div>

      {/* Main */}
      <div style={{ padding: isMobile ? "1rem" : isTablet ? "1.5rem" : "2rem 3rem", maxWidth: "1600px", margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            gap: isMobile ? "0.25rem" : isTablet ? "0.35rem" : "0.5rem",
            marginBottom: isMobile ? "1rem" : "2rem",
            background: "rgba(255, 255, 255, 0.02)",
            padding: isMobile ? "0.35rem" : "0.5rem",
            borderRadius: "12px",
            border: "1px solid rgba(255, 255, 255, 0.05)",
            overflowX: isMobile ? "auto" : undefined,
            WebkitOverflowScrolling: isMobile ? "touch" : undefined,
            flexWrap: isMobile ? "nowrap" : undefined,
          } as React.CSSProperties}
        >
          {tabs.map((tab) => {
            const isLocked = premiumOnlyTabs.has(tab.id) && !isPremium;
            return (
              <button
                key={tab.id}
                data-tour={`tab-${tab.id}`}
                onClick={() => {
                  if (isLocked) return;
                  setActiveTab(tab.id);
                }}
                style={{
                  flex: isMobile ? "0 0 auto" : 1,
                  padding: isMobile ? "0.6rem 0.6rem" : isTablet ? "0.75rem 0.75rem" : "0.875rem 1.5rem",
                  background: activeTab === tab.id ? "linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%)" : "transparent",
                  border: "none",
                  color: "white",
                  borderRadius: "8px",
                  fontSize: isMobile ? "0.7rem" : isTablet ? "0.75rem" : "0.875rem",
                  fontWeight: 800,
                  cursor: isLocked ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: isMobile ? "0.25rem" : "0.5rem",
                  opacity: isLocked ? 0.45 : 1,
                  filter: isLocked ? "grayscale(1)" : "none",
                  pointerEvents: isLocked ? "none" : "auto",
                }}
                title={isLocked ? "Upgrade to Premium to unlock this feature." : tab.label}
              >
                {tab.icon}
                {!isTablet && tab.label}
              </button>
            );
          })}
        </div>

        {isTablet && (
          <div style={{
            fontSize: isMobile ? "1.25rem" : "1.5rem",
            fontWeight: 800,
            marginBottom: "1rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            color: "#ffffff",
          }}>
            {tabs.find((t) => t.id === activeTab)?.icon}
            {tabs.find((t) => t.id === activeTab)?.label}
          </div>
        )}

        {activeTab === "overview" && <OverviewTab businessId={businessId} isPremium={isPremium} setActiveTab={setActiveTab} />}
        {activeTab === "analytics" && <AnalyticsTab {...tabProps} />}
        {activeTab === "receipts" && <ReceiptsTab {...tabProps} />}
        {activeTab === "media" && <MediaTab {...tabProps} />}
        {activeTab === "events" && <EventsTab {...tabProps} />}
        {activeTab === "advertising" && <AdvertisingAddonsTab {...tabProps} />}
        {activeTab === "billing" && <BillingTab {...tabProps} />}
        {activeTab === "location" && <LocationTab {...tabProps} />}
        {activeTab === "profile" && <ProfileTab {...tabProps} />}
        {activeTab === "support" && <SupportTab {...tabProps} />}
      </div>

      {/* Terms & Conditions Modal */}
      {showLegalDisclaimerModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.82)",
            backdropFilter: "blur(12px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: isMobile ? "0.75rem" : "2rem",
          }}
          onClick={closePublishModal}
        >
          <div
            style={{
              background: "linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.98) 100%)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: isMobile ? "14px" : "18px",
              padding: isMobile ? "1.25rem" : "2.25rem",
              maxWidth: "760px",
              width: "100%",
              maxHeight: "86vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 30px 90px rgba(0,0,0,0.55)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
              <div>
                <div style={{ fontSize: isMobile ? "1.2rem" : "1.6rem", fontWeight: 900, marginBottom: "0.35rem", display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <FileText size={22} style={{ color: colors.primary }} />
                  Terms &amp; Conditions
                </div>
                <div style={{ fontSize: "0.8rem", color: colors.warning, fontWeight: 800, marginBottom: "0.6rem" }}>
                  Last Updated: January 2, 2026
                </div>
              </div>

              <button
                type="button"
                onClick={closePublishModal}
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "rgba(255,255,255,0.85)",
                  cursor: "pointer",
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                aria-label="Close"
                title="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "1.5rem",
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid rgba(255, 255, 255, 0.10)",
                borderRadius: "14px",
                marginBottom: "1.25rem",
                fontSize: "0.9rem",
                lineHeight: "1.65",
                color: "rgba(255, 255, 255, 0.82)",
              }}
            >
              <h3 style={{ color: colors.primary, marginBottom: "1rem", fontSize: "1rem" }}>
                1. Binding Agreement
              </h3>
              <p style={{ marginBottom: "1rem" }}>
                By clicking &quot;Confirm &amp; Publish,&quot; you (&quot;Business,&quot; &quot;you,&quot; or &quot;your&quot;) enter into a legally binding agreement with LetsGo (&quot;Company,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). You acknowledge that you have read, understood, and agree to be bound by these terms and conditions, along with our Business Billing Policy, <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: colors.primary, textDecoration: "underline" }}>Privacy Policy</a>, and all other applicable policies incorporated herein by reference.
              </p>

              <h3 style={{ color: colors.primary, marginBottom: "1rem", fontSize: "1rem" }}>
                2. Payment Terms &amp; Authorization
              </h3>
              <p style={{ marginBottom: "0.5rem" }}>
                You authorize LetsGo to charge your designated payment method for:
              </p>
              <ul style={{ marginBottom: "1rem", paddingLeft: "1.5rem" }}>
                <li>Subscription fees (if applicable) charged monthly in advance</li>
                <li>Progressive payout fees based on verified customer transactions</li>
                <li>Platform fees (Basic tier: 10% of receipt subtotal or $5, whichever is less)</li>
                <li>Credit card processing fees (3.5% when using credit/debit card payments)</li>
                <li>Advertising campaign fees as selected and confirmed</li>
                <li>Optional service fees (e.g., TPMS) as elected</li>
                <li>Any applicable taxes, duties, or governmental charges</li>
              </ul>
              <p style={{ marginBottom: "1rem" }}>
                All fees are charged immediately upon receipt verification or service provision unless otherwise specified. Premium subscription upgrades are billed immediately and prorated for the current billing period. You agree to maintain valid payment information at all times.
              </p>

              <h3 style={{ color: colors.primary, marginBottom: "1rem", fontSize: "1rem" }}>
                3. Subscription &amp; Plan Changes
              </h3>
              <p style={{ marginBottom: "1rem" }}>
                Subscription fees are non-refundable. Plan upgrades take effect immediately with prorated billing. Plan downgrades take effect at the end of the current billing period. You may cancel your subscription at any time, effective at the end of the current billing period. Upon cancellation or downgrade, you forfeit access to premium features but remain liable for all outstanding fees.
              </p>

              <h3 style={{ color: colors.primary, marginBottom: "1rem", fontSize: "1rem" }}>
                4. Receipt Verification &amp; Disputes
              </h3>
              <p style={{ marginBottom: "1rem" }}>
                You agree to review and approve/reject customer receipt submissions within 48 hours. Failure to respond within this timeframe may result in automatic approval. You acknowledge that fraudulent receipt submissions or intentional misrepresentation constitutes grounds for immediate account suspension and forfeiture of all pending payouts. You are solely responsible for verifying the authenticity of transactions. LetsGo is not liable for fraudulent submissions, chargebacks, or disputes arising from your failure to properly verify receipts.
              </p>

              <h3 style={{ color: colors.primary, marginBottom: "1rem", fontSize: "1rem" }}>
                5. Business Information Accuracy
              </h3>
              <p style={{ marginBottom: "1rem" }}>
                You represent and warrant that all business information provided is accurate, current, and complete. You agree to promptly update your profile with any changes to business hours, contact information, services offered, or other material details. Failure to maintain accurate information may result in customer complaints, poor reviews, or account suspension.
              </p>

              <h3 style={{ color: colors.primary, marginBottom: "1rem", fontSize: "1rem" }}>
                6. Content &amp; Media Ownership
              </h3>
              <p style={{ marginBottom: "1rem" }}>
                You retain all rights to content you upload (photos, videos, descriptions). However, you grant LetsGo a worldwide, non-exclusive, royalty-free license to use, display, reproduce, and distribute your content on the LetsGo platform and in marketing materials. You represent that you have all necessary rights to the content and that it does not infringe third-party intellectual property rights. You agree not to upload content that is illegal, offensive, defamatory, or violates our Content Policy.
              </p>

              <h3 style={{ color: colors.primary, marginBottom: "1rem", fontSize: "1rem" }}>
                7. Limitation of Liability
              </h3>
              <p style={{ marginBottom: "1rem" }}>
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, LETSGO SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES RESULTING FROM: (a) YOUR USE OR INABILITY TO USE THE SERVICE; (b) ANY UNAUTHORIZED ACCESS TO OR USE OF YOUR DATA; (c) ANY INTERRUPTION OR CESSATION OF THE SERVICE; (d) ANY BUGS, VIRUSES, OR THE LIKE; (e) ANY ERRORS OR OMISSIONS IN ANY CONTENT; OR (f) ANY LOSS OR DAMAGE ARISING FROM FRAUDULENT TRANSACTIONS OR RECEIPT DISPUTES.
              </p>

              <h3 style={{ color: colors.primary, marginBottom: "1rem", fontSize: "1rem" }}>
                8. Indemnification
              </h3>
              <p style={{ marginBottom: "1rem" }}>
                You agree to indemnify, defend, and hold harmless LetsGo, its officers, directors, employees, agents, and affiliates from and against any and all claims, damages, obligations, losses, liabilities, costs, and expenses (including attorney&apos;s fees) arising from: (a) your use of the service; (b) your violation of these terms; (c) your violation of any third-party rights; (d) any content you provide; (e) any fraudulent transactions or receipt disputes; or (f) your business operations or customer interactions.
              </p>

              <h3 style={{ color: colors.primary, marginBottom: "1rem", fontSize: "1rem" }}>
                9. Term &amp; Termination
              </h3>
              <p style={{ marginBottom: "1rem" }}>
                This agreement remains in effect until terminated by either party. LetsGo may suspend or terminate your account immediately, without prior notice or liability, for any reason, including breach of these terms. Upon termination, your right to use the service ceases immediately, but all provisions that by their nature should survive termination shall survive, including payment obligations, indemnification, limitation of liability, and dispute resolution.
              </p>

              <h3 style={{ color: colors.primary, marginBottom: "1rem", fontSize: "1rem" }}>
                10. Dispute Resolution &amp; Governing Law
              </h3>
              <p style={{ marginBottom: "1rem" }}>
                This agreement shall be governed by and construed in accordance with the laws of Nebraska, without regard to conflict of law principles. Any dispute arising from this agreement shall be resolved through binding arbitration in accordance with the Commercial Arbitration Rules of the American Arbitration Association. You waive your right to a jury trial and to participate in class action lawsuits.
              </p>

              <h3 style={{ color: colors.primary, marginBottom: "1rem", fontSize: "1rem" }}>
                11. Modification of Terms
              </h3>
              <p style={{ marginBottom: "1rem" }}>
                LetsGo reserves the right to modify these terms at any time. We will notify you of material changes via email or through the platform. Continued use of the service after such modifications constitutes acceptance of the updated terms. If you do not agree to the modifications, you must discontinue use of the service.
              </p>

              <h3 style={{ color: colors.primary, marginBottom: "1rem", fontSize: "1rem" }}>
                12. Data Protection &amp; Privacy
              </h3>
              <p style={{ marginBottom: "1rem" }}>
                You acknowledge and agree that LetsGo collects, processes, and stores business and customer data in accordance with our <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: colors.primary, textDecoration: "underline" }}>Privacy Policy</a> and applicable data protection laws, including but not limited to GDPR, CCPA, and other regional privacy regulations. You are responsible for obtaining any necessary consents from your customers before their data is shared with LetsGo through receipt submissions. You agree to comply with all applicable privacy and data protection laws in your jurisdiction.
              </p>

              <h3 style={{ color: colors.primary, marginBottom: "1rem", fontSize: "1rem" }}>
                13. Events &amp; Promotions
              </h3>
              <p style={{ marginBottom: "1rem" }}>
                Events created through the LetsGo platform are solely your responsibility. You are liable for all aspects of event execution, including but not limited to: venue safety, capacity compliance, age restrictions, alcohol service laws, accessibility requirements, and any permits or licenses required. LetsGo is not responsible for event cancellations, attendee disputes, injuries, or any claims arising from events you create or host. RSVP counts are estimates only and do not constitute binding reservations unless you implement additional confirmation systems.
              </p>

              <h3 style={{ color: colors.primary, marginBottom: "1rem", fontSize: "1rem" }}>
                14. Advertising &amp; Promotional Campaigns
              </h3>
              <p style={{ marginBottom: "1rem" }}>
                Advertising campaign performance (clicks, conversions, impressions) is provided as estimates only. LetsGo does not guarantee any specific results, return on investment, or customer acquisition numbers. Campaign fees are non-refundable once the campaign start date has passed or within 24 hours of the scheduled start date. You are solely responsible for ensuring your advertising content complies with all applicable advertising laws, FTC guidelines, and does not contain false or misleading claims. LetsGo reserves the right to reject or remove any advertising content at its sole discretion.
              </p>

              <h3 style={{ color: colors.primary, marginBottom: "1rem", fontSize: "1rem" }}>
                15. Fee Schedule Acknowledgment
              </h3>
              <p style={{ marginBottom: "0.5rem" }}>
                You acknowledge and agree to the following fee structure:
              </p>
              <ul style={{ marginBottom: "1rem", paddingLeft: "1.5rem" }}>
                <li><strong>Basic Plan:</strong> LetsGo Fee (10% of subtotal or $5, whichever is less) + Progressive Payout Fee (3-10% based on customer level) + Credit Card Fee (3.5% if applicable)</li>
                <li><strong>Premium Plan:</strong> $100/month subscription + Progressive Payout Fee (3-10% based on customer level) + Credit Card Fee (3.5% if applicable)</li>
                <li><strong>Add-ons:</strong> As selected and priced at time of purchase</li>
                <li><strong>Advertising:</strong> As selected and priced at time of purchase</li>
                <li><strong>TPMS Service:</strong> $200/month if elected</li>
              </ul>
              <p style={{ marginBottom: "1rem" }}>
                Fees are subject to change with 30 days notice. Continued use of the service after fee changes constitutes acceptance of the new fee structure.
              </p>

              <h3 style={{ color: colors.primary, marginBottom: "1rem", fontSize: "1rem" }}>
                16. Entire Agreement
              </h3>
              <p style={{ marginBottom: "0" }}>
                This agreement, together with our <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: colors.primary, textDecoration: "underline" }}>Privacy Policy</a>, Business Billing Policy, and other referenced policies, constitutes the entire agreement between you and LetsGo regarding use of the service and supersedes all prior agreements, understandings, and representations. No waiver of any term shall be deemed a further or continuing waiver of such term or any other term.
              </p>
            </div>

            {publishError ? (
              <div
                style={{
                  marginBottom: "1rem",
                  padding: "0.75rem 1rem",
                  background: "rgba(239, 68, 68, 0.12)",
                  border: "1px solid rgba(239, 68, 68, 0.35)",
                  borderRadius: "12px",
                  color: "rgba(255,255,255,0.9)",
                  fontWeight: 800,
                  fontSize: "0.85rem",
                }}
              >
                Publish failed: {publishError}
              </div>
            ) : null}

            <div
              style={{
                background: "rgba(239, 68, 68, 0.10)",
                border: "1px solid rgba(239, 68, 68, 0.28)",
                borderRadius: "14px",
                padding: "1rem 1.15rem",
                marginBottom: "1.15rem",
              }}
            >
              <label style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", cursor: "pointer", fontSize: "0.9rem", lineHeight: "1.5", fontWeight: 650, color: "rgba(255,255,255,0.92)" }}>
                <input
                  type="checkbox"
                  checked={legalAccepted}
                  onChange={(e) => setLegalAccepted(e.target.checked)}
                  style={{ width: "18px", height: "18px", marginTop: "0.15rem", cursor: "pointer", flexShrink: 0 }}
                />
                <span>I acknowledge that I have read, understood, and agree to be legally bound by these Terms &amp; Conditions.</span>
              </label>
            </div>

            <div style={{ display: "flex", gap: "1rem" }}>
              <button
                type="button"
                onClick={closePublishModal}
                style={{
                  flex: 1,
                  padding: "0.9rem",
                  background: "rgba(255, 255, 255, 0.06)",
                  border: "1px solid rgba(255, 255, 255, 0.18)",
                  borderRadius: "14px",
                  color: "white",
                  fontSize: "0.9rem",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={!legalAccepted || publishing}
                onClick={handleConfirmPublish}
                style={{
                  flex: 1,
                  padding: "0.9rem",
                  borderRadius: "14px",
                  fontSize: "0.9rem",
                  fontWeight: 950,
                  cursor: legalAccepted && !publishing ? "pointer" : "not-allowed",
                  color: legalAccepted && !publishing ? "white" : "rgba(255,255,255,0.45)",
                  background: legalAccepted && !publishing ? `linear-gradient(135deg, ${colors.primary} 0%, ${colors.accent} 100%)` : "rgba(255,255,255,0.08)",
                  border: legalAccepted && !publishing ? "1px solid rgba(20,184,166,0.35)" : "1px solid rgba(255,255,255,0.12)",
                  boxShadow: legalAccepted && !publishing ? "0 18px 48px rgba(20,184,166,0.28)" : "none",
                }}
                title={!legalAccepted ? "You must accept the Terms & Conditions to publish." : "Confirm & Publish"}
              >
                {publishing ? "Publishing…" : "Confirm & Publish"}
              </button>
            </div>

            <div style={{ marginTop: "0.9rem", fontSize: "0.75rem", color: "rgba(255,255,255,0.35)" }}>
              Publish calls public.publish_business_profile (Security Definer).
            </div>
          </div>
        </div>
      )}

      {/* Onboarding tour */}
      {dashboardTour.isTouring && dashboardTour.currentStep && (
        <OnboardingTooltip
          step={dashboardTour.currentStep}
          stepIndex={dashboardTour.stepIndex}
          totalSteps={dashboardTour.totalSteps}
          onNext={dashboardTour.next}
          onBack={dashboardTour.back}
          onSkip={dashboardTour.skip}
          illustration={dashboardTour.stepIndex >= 0 ? dashboardTourIllustrations[dashboardTour.stepIndex] : undefined}
        />
      )}

      {/* Legal footer */}
      <div style={{ textAlign: "center", padding: "24px 0 16px", marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 16, alignItems: "center" }}>
          <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", textDecoration: "none", letterSpacing: "0.03em", transition: "color 0.2s" }} onMouseEnter={(e) => e.currentTarget.style.color = "rgba(255,255,255,0.5)"} onMouseLeave={(e) => e.currentTarget.style.color = "rgba(255,255,255,0.25)"}>Terms of Service</a>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.12)" }}>{"\u00b7"}</span>
          <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", textDecoration: "none", letterSpacing: "0.03em", transition: "color 0.2s" }} onMouseEnter={(e) => e.currentTarget.style.color = "rgba(255,255,255,0.5)"} onMouseLeave={(e) => e.currentTarget.style.color = "rgba(255,255,255,0.25)"}>Privacy Policy</a>
        </div>
      </div>
    </div>
  );
}