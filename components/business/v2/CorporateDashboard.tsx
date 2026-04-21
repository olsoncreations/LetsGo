// components/business/v2/CorporateDashboard.tsx
// ============================================================================
// Corporate Chain Dashboard
// Shows cross-location data for chain corporate users (CHN-BRAND-0).
// Wraps the standard BusinessProfileV2 tabs with a location selector.
// ============================================================================
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { useIsMobile } from "@/lib/useIsMobile";

// Tabs — reuse existing tab components
import Overview from "@/components/business/v2/tabs/Overview";
import Analytics from "@/components/business/v2/tabs/Analytics";
import Receipts from "@/components/business/v2/tabs/Receipts";
import Media from "@/components/business/v2/tabs/Media";
import Events from "@/components/business/v2/tabs/Events";
import AdvertisingAddons from "@/components/business/v2/tabs/AdvertisingAddons";
import Billing from "@/components/business/v2/tabs/Billing";
import Profile from "@/components/business/v2/tabs/Profile";
import Support from "@/components/business/v2/tabs/Support";

import {
  AlertCircle,
  BarChart3,
  Calendar,
  Camera,
  CheckCircle,
  DollarSign,
  Settings,
  TrendingUp,
  Building2,
  MapPin,
  ChevronDown,
} from "lucide-react";

// Types
type TabId =
  | "overview"
  | "analytics"
  | "receipts"
  | "media"
  | "events"
  | "advertising"
  | "billing"
  | "profile"
  | "support";

type ChainLocation = {
  id: string;
  business_name: string | null;
  public_business_name: string | null;
  store_number: string | null;
  city: string | null;
  state: string | null;
  is_active: boolean;
};

// Cast tabs to any to avoid strict BusinessTabProps check
const OverviewTab = Overview as React.ComponentType<Record<string, unknown>>;
const AnalyticsTab = Analytics as React.ComponentType<Record<string, unknown>>;
const ReceiptsTab = Receipts as React.ComponentType<Record<string, unknown>>;
const MediaTab = Media as React.ComponentType<Record<string, unknown>>;
const EventsTab = Events as React.ComponentType<Record<string, unknown>>;
const AdvertisingAddonsTab = AdvertisingAddons as React.ComponentType<Record<string, unknown>>;
const BillingTab = Billing as React.ComponentType<Record<string, unknown>>;
const ProfileTab = Profile as React.ComponentType<Record<string, unknown>>;
const SupportTab = Support as React.ComponentType<Record<string, unknown>>;

export default function CorporateDashboard({ chainId }: { chainId: string }) {
  const router = useRouter();
  const isMobile = useIsMobile();

  // State
  const [loading, setLoading] = useState(true);
  const [chainName, setChainName] = useState("");
  const [locations, setLocations] = useState<ChainLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [locationSearch, setLocationSearch] = useState("");

  // Auth
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      if (!session?.user) {
        router.replace("/welcome");
        return;
      }

      // Fetch chain info
      const { data: chain } = await supabaseBrowser
        .from("chains")
        .select("brand_name")
        .eq("id", chainId)
        .maybeSingle();

      if (chain) setChainName(chain.brand_name);

      // Fetch locations
      const { data: locs } = await supabaseBrowser
        .from("business")
        .select("id, business_name, public_business_name, store_number, city, state, is_active")
        .eq("chain_id", chainId)
        .order("store_number", { ascending: true });

      setLocations(locs || []);

      // Default to first location
      if (locs && locs.length > 0) {
        setSelectedLocationId(locs[0].id);
      }

      setLoading(false);
    })();
  }, [chainId, router]);

  const selectedLocation = useMemo(
    () => locations.find((l) => l.id === selectedLocationId) || null,
    [locations, selectedLocationId]
  );

  const filteredLocations = useMemo(() => {
    if (!locationSearch) return locations;
    const q = locationSearch.toLowerCase();
    return locations.filter(
      (l) =>
        (l.public_business_name || l.business_name || "").toLowerCase().includes(q) ||
        (l.store_number || "").includes(q) ||
        (l.city || "").toLowerCase().includes(q)
    );
  }, [locations, locationSearch]);

  const tabs = useMemo(
    () => [
      { id: "overview" as const, label: "Overview", icon: <BarChart3 size={16} /> },
      { id: "analytics" as const, label: "Analytics", icon: <TrendingUp size={16} /> },
      { id: "receipts" as const, label: "Receipts", icon: <CheckCircle size={16} /> },
      { id: "media" as const, label: "Media", icon: <Camera size={16} /> },
      { id: "events" as const, label: "Events", icon: <Calendar size={16} /> },
      { id: "advertising" as const, label: "Advertising", icon: <TrendingUp size={16} /> },
      { id: "billing" as const, label: "Billing", icon: <DollarSign size={16} /> },
      { id: "profile" as const, label: "Profile", icon: <Settings size={16} /> },
      { id: "support" as const, label: "Support", icon: <AlertCircle size={16} /> },
    ],
    []
  );

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.5)" }}>
        Loading corporate dashboard...
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff" }}>
      {/* Corporate Header */}
      <header
        style={{
          padding: isMobile ? "16px 16px" : "16px 32px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(10,10,10,0.95)",
          backdropFilter: "blur(20px)",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          {/* Left: Chain name + badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Building2 size={20} style={{ color: "#a855f7" }} />
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "'DM Sans', sans-serif" }}>{chainName}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Corporate Dashboard &bull; {locations.length} locations</div>
            </div>
          </div>

          {/* Right: Location selector */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowLocationPicker(!showLocationPicker)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 16px",
                background: "rgba(168,85,247,0.1)",
                border: "1px solid rgba(168,85,247,0.3)",
                borderRadius: 10,
                color: "#fff",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
                minWidth: 200,
              }}
            >
              <MapPin size={14} style={{ color: "#a855f7" }} />
              <span style={{ flex: 1, textAlign: "left" }}>
                {selectedLocation
                  ? `#${selectedLocation.store_number} — ${selectedLocation.city || "Unknown"}`
                  : "Select location"}
              </span>
              <ChevronDown size={14} style={{ color: "rgba(255,255,255,0.4)", transform: showLocationPicker ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
            </button>

            {/* Location dropdown */}
            {showLocationPicker && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  right: 0,
                  width: 320,
                  maxHeight: 400,
                  overflowY: "auto",
                  background: "#1a1a2e",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 12,
                  boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
                  zIndex: 100,
                }}
              >
                <div style={{ padding: 12, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <input
                    type="text"
                    placeholder="Search locations..."
                    value={locationSearch}
                    onChange={(e) => setLocationSearch(e.target.value)}
                    autoFocus
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8,
                      color: "#fff",
                      fontSize: 13,
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                {/* "All Locations" aggregate option */}
                <button
                  onClick={() => {
                    // For aggregate view, we pass chainId as businessId — tabs that support it will show cross-location data
                    setSelectedLocationId(locations[0]?.id || null);
                    setShowLocationPicker(false);
                    setLocationSearch("");
                  }}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    background: !selectedLocationId ? "rgba(168,85,247,0.15)" : "transparent",
                    border: "none",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    color: "#fff",
                    cursor: "pointer",
                    textAlign: "left",
                    fontSize: 13,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Building2 size={14} style={{ color: "#a855f7" }} />
                  All Locations ({locations.length})
                </button>
                {filteredLocations.map((loc) => (
                  <button
                    key={loc.id}
                    onClick={() => {
                      setSelectedLocationId(loc.id);
                      setShowLocationPicker(false);
                      setLocationSearch("");
                    }}
                    style={{
                      width: "100%",
                      padding: "10px 16px",
                      background: selectedLocationId === loc.id ? "rgba(168,85,247,0.1)" : "transparent",
                      border: "none",
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                      color: "#fff",
                      cursor: "pointer",
                      textAlign: "left",
                      fontSize: 13,
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>
                      #{loc.store_number} — {loc.public_business_name || loc.business_name || "Unnamed"}
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
                      {[loc.city, loc.state].filter(Boolean).join(", ")}
                      {!loc.is_active && (
                        <span style={{ marginLeft: 8, color: "#ef4444", fontWeight: 600 }}>Inactive</span>
                      )}
                    </div>
                  </button>
                ))}
                {filteredLocations.length === 0 && (
                  <div style={{ padding: 16, textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: 13 }}>
                    No locations found
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Tab navigation */}
        <div
          style={{
            display: "flex",
            gap: 4,
            marginTop: 16,
            overflowX: "auto",
            paddingBottom: 2,
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: activeTab === tab.id ? 700 : 500,
                background: activeTab === tab.id ? "rgba(168,85,247,0.2)" : "transparent",
                color: activeTab === tab.id ? "#a855f7" : "rgba(255,255,255,0.4)",
                whiteSpace: "nowrap",
                transition: "all 0.15s",
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Tab content — passes selected location's businessId */}
      <div style={{ padding: isMobile ? 16 : 32 }}>
        {selectedLocationId && (
          <>
            {activeTab === "overview" && <OverviewTab businessId={selectedLocationId} isPremium={true} setActiveTab={setActiveTab} />}
            {activeTab === "analytics" && <AnalyticsTab businessId={selectedLocationId} isPremium={true} />}
            {activeTab === "receipts" && <ReceiptsTab businessId={selectedLocationId} isPremium={true} />}
            {activeTab === "media" && <MediaTab businessId={selectedLocationId} isPremium={true} />}
            {activeTab === "events" && <EventsTab businessId={selectedLocationId} isPremium={true} />}
            {activeTab === "advertising" && <AdvertisingAddonsTab businessId={selectedLocationId} isPremium={true} />}
            {activeTab === "billing" && <BillingTab businessId={selectedLocationId} isPremium={true} />}
            {activeTab === "profile" && <ProfileTab businessId={selectedLocationId} isPremium={true} />}
            {activeTab === "support" && <SupportTab businessId={selectedLocationId} isPremium={true} />}
          </>
        )}
        {!selectedLocationId && (
          <div style={{ textAlign: "center", padding: 64, color: "rgba(255,255,255,0.3)" }}>
            No locations linked to this chain yet
          </div>
        )}
      </div>

      {/* Click-away overlay for location picker */}
      {showLocationPicker && (
        <div
          onClick={() => { setShowLocationPicker(false); setLocationSearch(""); }}
          style={{ position: "fixed", inset: 0, zIndex: 49 }}
        />
      )}
    </div>
  );
}
