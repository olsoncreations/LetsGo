"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import Script from "next/script";
import { useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import NotificationBell from "@/components/NotificationBell";
import OnboardingTooltip from "@/components/OnboardingTooltip";
import { useOnboardingTour, type TourStep } from "@/lib/useOnboardingTour";
import { SwipeVerticalAnim, SwipeLeftAnim, FilterAnim, HeartAnim, ScrollIndicatorAnim } from "@/components/TourIllustrations";
import { ZIP_COORDS, haversineDistance, getDistanceBetweenZips } from "@/lib/zipUtils";
import { fetchPlatformTierConfig, getVisitRangeLabel, DEFAULT_VISIT_THRESHOLDS, type VisitThreshold } from "@/lib/platformSettings";
import {
  type BusinessRow, type MediaRow, type DiscoveryImage, type DiscoveryBusiness,
  buildMediaUrl, getBusinessGradient, getBusinessEmoji, formatBusinessType,
  normalizeHoursForDisplay, computeOpenStatus, normalizePayoutFromBps,
  normalizeToDiscoveryBusiness, shuffleArray,
} from "@/lib/businessNormalize";

// ═══════════════════════════════════════════════════
// LETSGO DISCOVERY PAGE
// TikTok-style vertical swipe + horizontal detail pages
// ═══════════════════════════════════════════════════

const COLORS = {
  neonPink: "#ff2d92",
  neonBlue: "#00d4ff",
  neonGreen: "#39ff14",
  neonYellow: "#ffff00",
  neonOrange: "#ff6b35",
  neonPurple: "#bf5fff",
  darkBg: "#0a0a14",
  cardBg: "#12121f",
  cardBorder: "#1e1e33",
  glass: "rgba(18,18,31,0.85)",
  textPrimary: "#ffffff",
  textSecondary: "#8888aa",
} as const;

// ─── Types (BusinessRow, MediaRow, DiscoveryImage, DiscoveryBusiness imported from @/lib/businessNormalize) ───

type FilterState = {
  search: string;
  category: string;
  price: string;
  sort: string;
  openNow: boolean;
  distance: number;
  tags: string[];
};

// ─── Filter options ───

const FILTER_CATEGORIES = ["All", "Restaurant", "Bar", "Coffee", "Entertainment", "Activity", "Nightclub", "Brewery", "Winery", "Food Truck", "Bakery", "Deli", "Ice Cream", "Juice Bar", "Lounge", "Pub", "Sports Bar", "Karaoke", "Arcade", "Bowling", "Mini Golf", "Escape Room", "Theater", "Comedy Club", "Art Gallery", "Museum", "Spa", "Gym", "Yoga Studio", "Dance Studio"];
const PRICE_FILTERS = ["Any", "$", "$$", "$$$", "$$$$"];
const SORT_OPTIONS = ["Nearest", "Most Popular", "Highest Payout", "Newest", "Highest Rated", "Most Reviewed", "Trending", "Recently Updated"];
const CUISINE_FILTERS = ["American", "Italian", "Mexican", "Chinese", "Japanese", "Thai", "Indian", "Korean", "Vietnamese", "Mediterranean", "Greek", "French", "Spanish", "Caribbean", "Ethiopian", "Peruvian", "Brazilian", "Middle Eastern", "Moroccan", "Southern", "Cajun", "BBQ", "Seafood", "Steakhouse", "Sushi", "Ramen", "Pizza", "Burgers", "Tacos", "Poke", "Farm-to-Table", "Fusion"];
const VIBE_FILTERS = ["Romantic", "Chill", "Lively", "Upscale", "Casual", "Trendy", "Cozy", "Retro", "Modern", "Rustic", "Industrial", "Bohemian", "Rooftop", "Waterfront", "Hidden Gem", "Instagrammable", "Speakeasy", "Dive Bar", "Sports Vibe", "Artsy"];
const AMENITY_FILTERS = ["Free WiFi", "Parking", "Wheelchair Accessible", "Reservations", "Takeout", "Delivery", "Dine-in", "Patio Seating", "Private Rooms", "Full Bar", "Beer Garden", "Fireplace", "Pool Table", "Dart Board", "TV Screens", "Projector", "Stage", "Dance Floor", "Valet", "EV Charging"];
const DIETARY_FILTERS = ["Vegetarian", "Vegan", "Gluten-Free", "Halal", "Kosher", "Keto-Friendly", "Dairy-Free", "Nut-Free", "Organic", "Locally Sourced"];

function buildPayoutLevels(thresholds: VisitThreshold[]) {
  return thresholds.map((t) => ({
    level: t.level,
    name: t.label,
    visits: getVisitRangeLabel(t),
  }));
}
const DEFAULT_PAYOUT_LEVELS = buildPayoutLevels(DEFAULT_VISIT_THRESHOLDS);

// ─── Helpers (buildMediaUrl, getBusinessGradient, getBusinessEmoji, formatBusinessType,
//     normalizeHoursForDisplay, computeOpenStatus, normalizePayoutFromBps,
//     normalizeToDiscoveryBusiness, shuffleArray imported from @/lib/businessNormalize) ───

// ─── Zip-to-distance calculation ───

// ZIP_COORDS, haversineDistance, getDistanceBetweenZips imported from @/lib/zipUtils

// ─── PlaceholderPhoto (gradient fallback when no images) ───

function PlaceholderPhoto({ gradient, emoji, label, sublabel, style }: {
  gradient: string;
  emoji: string;
  label?: string;
  sublabel?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{
      width: "100%", height: "100%", background: gradient,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      position: "relative", overflow: "hidden", ...style,
    }}>
      <div style={{ position: "absolute", top: "-20%", right: "-15%", width: "60%", height: "60%", borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
      <div style={{ position: "absolute", bottom: "-25%", left: "-10%", width: "50%", height: "50%", borderRadius: "50%", background: "rgba(255,255,255,0.03)" }} />
      <div style={{ position: "absolute", top: "30%", left: "10%", width: "30%", height: "30%", borderRadius: "50%", background: "rgba(255,255,255,0.02)" }} />
      <div style={{ position: "absolute", top: "10%", right: "20%", width: "15%", height: "15%", borderRadius: "50%", background: "rgba(255,255,255,0.025)" }} />
      <span style={{ fontSize: 80, marginBottom: 12, filter: "drop-shadow(0 4px 20px rgba(0,0,0,0.3))", zIndex: 1 }}>{emoji}</span>
      {label && <span style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.9)", fontFamily: "'DM Sans', sans-serif", textShadow: "0 2px 8px rgba(0,0,0,0.4)", zIndex: 1 }}>{label}</span>}
      {sublabel && <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: "'DM Sans', sans-serif", marginTop: 4, zIndex: 1 }}>{sublabel}</span>}
    </div>
  );
}

// ─── Floating Orbs Background ───

function FloatingOrbs() {
  const orbs = [
    { size: 320, x: "10%", y: "15%", color: COLORS.neonPink, delay: 0, dur: 18 },
    { size: 260, x: "75%", y: "60%", color: COLORS.neonBlue, delay: 4, dur: 22 },
    { size: 200, x: "50%", y: "30%", color: COLORS.neonPurple, delay: 8, dur: 20 },
    { size: 180, x: "85%", y: "10%", color: COLORS.neonGreen, delay: 2, dur: 25 },
    { size: 240, x: "20%", y: "75%", color: COLORS.neonOrange, delay: 6, dur: 19 },
  ];
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 0, overflow: "hidden", pointerEvents: "none" }}>
      {orbs.map((o, i) => (
        <div key={i} style={{
          position: "absolute", left: o.x, top: o.y, width: o.size, height: o.size,
          borderRadius: "50%", background: `radial-gradient(circle, ${o.color}18 0%, transparent 70%)`,
          filter: "blur(60px)", animation: `orbFloat${i} ${o.dur}s ease-in-out infinite`,
          animationDelay: `${o.delay}s`,
        }} />
      ))}
      <style>{`
        @keyframes orbFloat0 { 0%,100% { transform: translate(0,0) scale(1); } 33% { transform: translate(30px,-40px) scale(1.1); } 66% { transform: translate(-20px,30px) scale(0.9); } }
        @keyframes orbFloat1 { 0%,100% { transform: translate(0,0) scale(1); } 33% { transform: translate(-40px,20px) scale(0.95); } 66% { transform: translate(25px,-35px) scale(1.05); } }
        @keyframes orbFloat2 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(35px,25px) scale(1.08); } }
        @keyframes orbFloat3 { 0%,100% { transform: translate(0,0) scale(1); } 33% { transform: translate(-25px,-20px) scale(1.05); } 66% { transform: translate(15px,40px) scale(0.95); } }
        @keyframes orbFloat4 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-30px,-25px) scale(1.1); } }
      `}</style>
    </div>
  );
}

// ─── Glassmorphism Pill ───

function GlassPill({ children, style, onClick, active }: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button onClick={onClick} style={{
      padding: "8px 18px", borderRadius: 50, border: `1px solid ${active ? COLORS.neonPink : COLORS.cardBorder}`,
      background: active ? `${COLORS.neonPink}22` : COLORS.glass, backdropFilter: "blur(16px)",
      color: active ? COLORS.neonPink : COLORS.textSecondary, fontSize: 13, fontWeight: 600,
      cursor: "pointer", transition: "all 0.25s ease", whiteSpace: "nowrap",
      fontFamily: "'DM Sans', sans-serif", ...style,
    }}>
      {children}
    </button>
  );
}

// ─── Filter Bar ───

function FilterBar({ filtersOpen, setFiltersOpen, filters, setFilters, locationZip, onLocationZipChange, onLocationCoordsChange, showFollowedOnly, setShowFollowedOnly, followedCount }: {
  filtersOpen: boolean;
  setFiltersOpen: (v: boolean) => void;
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  locationZip: string;
  onLocationZipChange: (zip: string) => void;
  onLocationCoordsChange: (coords: [number, number] | null) => void;
  showFollowedOnly: boolean;
  setShowFollowedOnly: (v: boolean) => void;
  followedCount: number;
}) {
  const [searchFocused, setSearchFocused] = useState(false);
  const [editingZip, setEditingZip] = useState(false);
  const [zipInput, setZipInput] = useState("");
  const [editingLocation, setEditingLocation] = useState(false);
  const [locationInput, setLocationInput] = useState("");
  const [locationName, setLocationName] = useState("Omaha");
  const [locationState, setLocationState] = useState("NE");
  const zipRef = useRef<HTMLInputElement>(null);
  const locationInputRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const autocompleteRef = useRef<any>(null);
  const NEON = "#FF2D78";
  const NEON_RGB = "255,45,120";

  const ZIP_LOOKUP: Record<string, [string, string]> = {
    "68102": ["Omaha", "NE"], "68131": ["Omaha", "NE"], "68124": ["Omaha", "NE"], "68114": ["Omaha", "NE"], "68106": ["Omaha", "NE"],
    "68154": ["West Omaha", "NE"], "68022": ["Elkhorn", "NE"], "68046": ["Papillion", "NE"], "68116": ["Bennington", "NE"],
    "68005": ["Bellevue", "NE"], "68123": ["Bellevue", "NE"], "68128": ["La Vista", "NE"], "68007": ["Bennington", "NE"],
    "68127": ["Ralston", "NE"], "68104": ["North Omaha", "NE"], "68132": ["Midtown", "NE"], "68105": ["South Omaha", "NE"],
    "68137": ["Millard", "NE"], "68144": ["West Omaha", "NE"], "68164": ["Maple", "NE"],
    "10001": ["New York", "NY"], "90001": ["Los Angeles", "CA"], "90210": ["Beverly Hills", "CA"],
    "60601": ["Chicago", "IL"], "77001": ["Houston", "TX"], "85001": ["Phoenix", "AZ"],
    "94102": ["San Francisco", "CA"], "30301": ["Atlanta", "GA"], "80201": ["Denver", "CO"],
    "89101": ["Las Vegas", "NV"], "33101": ["Miami", "FL"], "70112": ["New Orleans", "LA"],
  };

  // Initialize Google Places Autocomplete when editing location
  useEffect(() => {
    if (!editingLocation || !locationInputRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (window as any).google;
    if (!g?.maps?.places?.Autocomplete) return;

    const ac = new g.maps.places.Autocomplete(locationInputRef.current, {
      types: ["(cities)"],
      fields: ["address_components", "geometry", "name"],
      componentRestrictions: { country: "us" },
    });

    ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      if (!place?.address_components) return;

      let city = "";
      let st = "";
      let zip = "";
      for (const comp of place.address_components) {
        if (comp.types.includes("locality")) city = comp.long_name;
        if (comp.types.includes("administrative_area_level_1")) st = comp.short_name;
        if (comp.types.includes("postal_code")) zip = comp.long_name;
      }

      if (city) setLocationName(city);
      if (st) setLocationState(st);
      if (zip) onLocationZipChange(zip);

      // Pass coordinates for distance calculation
      if (place.geometry?.location) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        onLocationCoordsChange([lat, lng]);
        // Also add to ZIP_COORDS if we got a zip
        if (zip) {
          ZIP_COORDS[zip] = [lat, lng];
        }
      }

      setEditingLocation(false);
      setLocationInput("");
    });

    autocompleteRef.current = ac;
  }, [editingLocation, onLocationZipChange, onLocationCoordsChange]);

  const handleZipSubmit = () => {
    const zip = zipInput.trim();
    if (zip.length === 5 && /^\d{5}$/.test(zip)) {
      const match = ZIP_LOOKUP[zip];
      setLocationName(match ? match[0] : `ZIP ${zip}`);
      setLocationState(match ? match[1] : "");
      onLocationZipChange(zip);
      // Update coords from lookup
      const coords = ZIP_COORDS[zip];
      onLocationCoordsChange(coords ? [coords[0], coords[1]] : null);
    }
    setEditingZip(false);
    setZipInput("");
  };

  return (
    <div style={{
      position: "absolute", top: 0, left: 0, right: 0, zIndex: 100,
      background: filtersOpen ? "rgba(10,10,20,0.97)" : "transparent",
      backdropFilter: filtersOpen ? "blur(30px)" : "none",
      transition: "all 0.4s cubic-bezier(0.4,0,0.2,1)",
      borderBottom: filtersOpen ? `1px solid ${COLORS.cardBorder}` : "none",
    }}>
      {/* NeonCard-style Header */}
      <div style={{ padding: 0 }}>
        <style>{`
          @keyframes borderTravel-disc {
            0% { background-position: 0% 50%; }
            100% { background-position: 300% 50%; }
          }
          @keyframes neonFlicker-disc {
            0%, 100% { text-shadow: 0 0 8px ${NEON}90, 0 0 20px ${NEON}50; }
            5% { text-shadow: 0 0 4px ${NEON}40, 0 0 10px ${NEON}20; }
            6% { text-shadow: 0 0 8px ${NEON}90, 0 0 20px ${NEON}50; }
            45% { text-shadow: 0 0 8px ${NEON}90, 0 0 20px ${NEON}50; }
            46% { text-shadow: 0 0 2px ${NEON}30, 0 0 6px ${NEON}15; }
            48% { text-shadow: 0 0 8px ${NEON}90, 0 0 20px ${NEON}50; }
          }
        `}</style>
        <div style={{ position: "relative" }}>
          <div style={{
            position: "absolute", inset: -2, borderRadius: 0,
            background: `linear-gradient(90deg, transparent 5%, ${NEON}90, ${NEON}, ${NEON}90, transparent 95%)`,
            backgroundSize: "300% 100%",
            animation: "borderTravel-disc 8s linear infinite",
            opacity: 0.7,
          }} />
          <div style={{
            position: "relative",
            background: "linear-gradient(180deg, #08080f 0%, #0C0C16 40%, #10101f 100%)",
            overflow: "hidden", padding: "10px 12px 12px", margin: "2px 2px 2px",
          }}>
            <div style={{
              position: "absolute", inset: 0, opacity: 0.04,
              backgroundImage: `radial-gradient(circle, ${NEON} 1px, transparent 1px)`,
              backgroundSize: "24px 24px", backgroundPosition: "12px 12px", pointerEvents: "none",
            }} />
            <div style={{
              position: "absolute", bottom: -60, left: "50%", transform: "translateX(-50%)",
              width: "110%", height: 160,
              background: `radial-gradient(ellipse, rgba(${NEON_RGB},0.12) 0%, transparent 65%)`,
              filter: "blur(30px)", pointerEvents: "none",
            }} />
            <div style={{
              position: "absolute", top: -30, right: -30, width: 160, height: 160,
              background: "radial-gradient(circle, rgba(0,212,255,0.06) 0%, transparent 70%)",
              filter: "blur(40px)", pointerEvents: "none",
            }} />
            <div style={{
              position: "absolute", top: "50%", left: 0, right: 0, height: 1,
              background: `linear-gradient(90deg, transparent, rgba(${NEON_RGB},0.06), transparent)`,
              pointerEvents: "none",
            }} />
            <div style={{ position: "relative", zIndex: 2 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  <button onClick={() => window.history.back()} style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    width: 32, height: 32, borderRadius: 4, flexShrink: 0,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.03)",
                    cursor: "pointer", transition: "all 0.3s", backdropFilter: "blur(8px)",
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 18l-6-6 6-6"/>
                    </svg>
                  </button>
                  <div style={{
                    width: 32, height: 32, borderRadius: 5, flexShrink: 0,
                    border: `1.5px solid ${NEON}`, display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "'Clash Display', 'DM Sans', sans-serif",
                    fontSize: 12, fontWeight: 600, color: NEON,
                    background: `rgba(${NEON_RGB}, 0.06)`,
                    textShadow: `0 0 10px ${NEON}`,
                    boxShadow: `0 0 14px rgba(${NEON_RGB}, 0.15), inset 0 0 8px rgba(${NEON_RGB}, 0.05)`,
                    animation: "logoGlow 5s ease-in-out infinite",
                  }}>LG</div>
                </div>
                <div style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                  minWidth: 0, overflow: "hidden",
                }}>
                  <div style={{
                    fontFamily: "'Clash Display', 'DM Sans', sans-serif",
                    fontSize: "clamp(9px, 2.8vw, 15px)", fontWeight: 600, letterSpacing: "0.2em", color: NEON,
                    animation: "neonFlicker-disc 12s ease-in-out infinite",
                    textShadow: `0 0 20px rgba(${NEON_RGB}, 0.5), 0 0 40px rgba(${NEON_RGB}, 0.2)`,
                    whiteSpace: "nowrap", textAlign: "center",
                  }}>
                    {"✦"} D I S C O V E R Y
                  </div>
                </div>
                <NotificationBell />
                <button data-tour="filter-btn" onClick={() => setFiltersOpen(!filtersOpen)} style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 32, height: 32, borderRadius: 5, flexShrink: 0,
                  border: `1px solid rgba(${NEON_RGB}, ${filtersOpen ? 0.6 : 0.12})`,
                  background: filtersOpen
                    ? `linear-gradient(135deg, rgba(${NEON_RGB}, 0.12), rgba(${NEON_RGB}, 0.06))`
                    : "rgba(255,255,255,0.03)",
                  cursor: "pointer", transition: "all 0.3s ease",
                  backdropFilter: "blur(8px)",
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke={filtersOpen ? NEON : "rgba(255,255,255,0.4)"} strokeWidth="2" strokeLinecap="round">
                    <circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Expandable filter area */}
      <div style={{
        maxHeight: filtersOpen ? "70vh" : 0, overflowY: filtersOpen ? "auto" : "hidden", overflowX: "hidden",
        transition: "max-height 0.5s cubic-bezier(0.4,0,0.2,1)",
        padding: filtersOpen ? "0 20px 20px" : "0 20px",
        scrollbarWidth: "thin", scrollbarColor: `${COLORS.neonPink}40 transparent`,
      }}>
        {/* Search bar row */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16, marginTop: 4 }}>
          {editingZip ? (
            <div style={{
              display: "flex", alignItems: "center", gap: 0, flexShrink: 0,
              borderRadius: 2, border: `1px solid ${COLORS.neonBlue}60`,
              background: `${COLORS.neonBlue}08`, overflow: "hidden",
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill={COLORS.neonBlue} stroke="none" style={{ marginLeft: 10, flexShrink: 0 }}>
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
              <input
                ref={zipRef}
                autoFocus
                type="text"
                inputMode="numeric"
                maxLength={5}
                placeholder="Zip code"
                value={zipInput}
                onChange={e => setZipInput(e.target.value.replace(/\D/g, ""))}
                onKeyDown={e => { if (e.key === "Enter") handleZipSubmit(); if (e.key === "Escape") { setEditingZip(false); setZipInput(""); } }}
                onBlur={handleZipSubmit}
                style={{
                  width: 72, padding: "9px 10px", border: "none", outline: "none",
                  background: "transparent", color: COLORS.neonBlue,
                  fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
                  letterSpacing: "0.05em",
                }}
              />
            </div>
          ) : (
            <button onClick={() => { setEditingZip(true); setZipInput(""); }} style={{
              display: "flex", alignItems: "center", gap: 5, padding: "9px 14px",
              borderRadius: 2, border: `1px solid ${COLORS.cardBorder}`,
              background: "rgba(255,255,255,0.03)", color: COLORS.neonBlue,
              fontSize: 12, fontWeight: 600, cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif", flexShrink: 0, transition: "all 0.3s",
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill={COLORS.neonBlue} stroke="none">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
              {locationZip}
            </button>
          )}
          {editingLocation ? (
            <div style={{
              display: "flex", alignItems: "center", gap: 0, flex: 1, minWidth: 120,
              borderRadius: 2, border: `1px solid ${COLORS.neonBlue}60`,
              background: `${COLORS.neonBlue}08`, overflow: "visible", position: "relative",
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill={COLORS.neonBlue} stroke="none" style={{ marginLeft: 10, flexShrink: 0 }}>
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
              <input
                ref={locationInputRef}
                autoFocus
                type="text"
                placeholder="City, State"
                value={locationInput}
                onChange={e => setLocationInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Escape") { setEditingLocation(false); setLocationInput(""); } }}
                onBlur={() => { setTimeout(() => { setEditingLocation(false); setLocationInput(""); }, 300); }}
                style={{
                  width: "100%", padding: "9px 10px", border: "none", outline: "none",
                  background: "transparent", color: COLORS.neonBlue,
                  fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
                }}
              />
            </div>
          ) : (
            <button onClick={() => { setEditingLocation(true); setLocationInput(""); }} style={{
              display: "flex", alignItems: "center", gap: 4, padding: "9px 12px",
              borderRadius: 2, border: `1px solid ${COLORS.cardBorder}`,
              background: "rgba(255,255,255,0.03)", flexShrink: 0, whiteSpace: "nowrap",
              cursor: "pointer", transition: "all 0.3s",
            }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#fff", fontFamily: "'DM Sans', sans-serif" }}>
                {locationName}{locationState ? "," : ""}
              </span>
              {locationState && (
                <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Sans', sans-serif" }}>
                  {locationState}
                </span>
              )}
            </button>
          )}
          <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke={searchFocused ? COLORS.neonPink : "rgba(255,255,255,0.3)"}
              strokeWidth="2.5" strokeLinecap="round"
              style={{ position: "absolute", left: 12, zIndex: 1, transition: "stroke 0.3s" }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder="Search restaurants, bars, coffee..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              style={{
                width: "100%", padding: "9px 14px 9px 38px", borderRadius: 2,
                border: `1px solid ${searchFocused ? COLORS.neonPink + "80" : COLORS.cardBorder}`,
                background: searchFocused ? `${COLORS.neonPink}08` : "rgba(255,255,255,0.03)",
                color: "#fff", fontSize: 12, fontFamily: "'DM Sans', sans-serif",
                outline: "none", transition: "all 0.3s",
                boxShadow: searchFocused ? `0 0 15px ${COLORS.neonPink}15` : "none",
              }}
            />
          </div>
        </div>

        <FilterSection label="Category" items={FILTER_CATEGORIES} filters={filters} setFilters={setFilters} type="category" />
        <FilterSection label="Price" items={PRICE_FILTERS} filters={filters} setFilters={setFilters} type="price" />

        <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10, fontFamily: "'DM Sans', sans-serif" }}>Sort By</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {SORT_OPTIONS.map(s => (
                <GlassPill key={s} active={filters.sort === s} onClick={() => setFilters(prev => ({ ...prev, sort: s }))}>{s}</GlassPill>
              ))}
            </div>
          </div>
          <div>
            <button onClick={() => setFilters(p => ({ ...p, openNow: !p.openNow }))} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 50,
              border: `1px solid ${filters.openNow ? COLORS.neonGreen : COLORS.cardBorder}`,
              background: filters.openNow ? `${COLORS.neonGreen}15` : COLORS.glass,
              color: filters.openNow ? COLORS.neonGreen : COLORS.textSecondary,
              fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
              backdropFilter: "blur(12px)", transition: "all 0.3s",
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: "50%", display: "inline-block",
                background: filters.openNow ? COLORS.neonGreen : COLORS.textSecondary,
                boxShadow: filters.openNow ? `0 0 8px ${COLORS.neonGreen}` : "none",
              }} />
              Open Now
            </button>
            {followedCount > 0 && (
              <button onClick={() => setShowFollowedOnly(!showFollowedOnly)} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 50,
                border: `1px solid ${showFollowedOnly ? COLORS.neonBlue : COLORS.cardBorder}`,
                background: showFollowedOnly ? `${COLORS.neonBlue}15` : COLORS.glass,
                color: showFollowedOnly ? COLORS.neonBlue : COLORS.textSecondary,
                fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                backdropFilter: "blur(12px)", transition: "all 0.3s",
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: "50%", display: "inline-block",
                  background: showFollowedOnly ? COLORS.neonBlue : COLORS.textSecondary,
                  boxShadow: showFollowedOnly ? `0 0 8px ${COLORS.neonBlue}` : "none",
                }} />
                Following ({followedCount})
              </button>
            )}
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 1.5, fontFamily: "'DM Sans', sans-serif" }}>Distance</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.neonBlue, fontFamily: "'DM Sans', sans-serif" }}>{filters.distance} mi</span>
          </div>
          <input type="range" min={1} max={50} value={filters.distance} onChange={e => setFilters(p => ({ ...p, distance: +e.target.value }))}
            style={{ width: "100%", accentColor: COLORS.neonBlue, height: 4 }} />
        </div>

        <TagFilterSection label="Cuisine" items={CUISINE_FILTERS} filters={filters} setFilters={setFilters} />
        <TagFilterSection label="Vibe & Atmosphere" items={VIBE_FILTERS} filters={filters} setFilters={setFilters} />
        <TagFilterSection label="Amenities" items={AMENITY_FILTERS} filters={filters} setFilters={setFilters} />
        <TagFilterSection label="Dietary" items={DIETARY_FILTERS} filters={filters} setFilters={setFilters} />
        <TagFilterSection label="Popular Tags" items={[
          "Date Night", "Happy Hour", "Family", "Live Music", "Outdoor", "Late Night", "Brunch",
          "Pet Friendly", "Kid Friendly", "Group Friendly", "Solo Dining", "First Date", "Anniversary",
          "Birthday", "Business Lunch", "Girls Night", "Guys Night", "Game Day", "Watch Party",
          "Trivia Night", "Open Mic", "DJ Night", "Craft Cocktails", "Wine List", "Beer Flight",
          "Tasting Menu", "All You Can Eat", "Bottomless Mimosas", "Weekend Special", "After Hours",
        ]} filters={filters} setFilters={setFilters} />

        {/* Apply & Clear buttons */}
        <div style={{ display: "flex", gap: 12, marginTop: 24, paddingBottom: 8, position: "sticky", bottom: 0, background: "rgba(10,10,20,0.95)", backdropFilter: "blur(12px)", paddingTop: 12 }}>
          <button onClick={() => { setFilters({ search: "", category: "All", price: "Any", sort: "Nearest", openNow: false, distance: 15, tags: [] }); setShowFollowedOnly(false); }} style={{
            flex: 1, padding: "12px 0", borderRadius: 8, fontSize: 13, fontWeight: 700,
            border: `1px solid ${COLORS.cardBorder}`, background: "transparent",
            color: COLORS.textSecondary, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
            transition: "all 0.3s",
          }}>Clear All</button>
          <button onClick={() => setFiltersOpen(false)} style={{
            flex: 2, padding: "12px 0", borderRadius: 8, fontSize: 13, fontWeight: 700,
            border: "none", background: NEON,
            color: "#fff", cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
            boxShadow: `0 4px 20px rgba(${NEON_RGB}, 0.3)`, transition: "all 0.3s",
          }}>Apply Filters</button>
        </div>
      </div>
    </div>
  );
}

// Filter section helpers to reduce repetition
function FilterSection({ label, items, filters, setFilters, type }: {
  label: string;
  items: string[];
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  type: "category" | "price";
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10, fontFamily: "'DM Sans', sans-serif" }}>{label}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {items.map(item => (
          <GlassPill key={item} active={filters[type] === item} onClick={() => setFilters(p => ({ ...p, [type]: item }))}>{item}</GlassPill>
        ))}
      </div>
    </div>
  );
}

function TagFilterSection({ label, items, filters, setFilters }: {
  label: string;
  items: string[];
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
}) {
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10, fontFamily: "'DM Sans', sans-serif" }}>{label}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {items.map(t => (
          <GlassPill key={t} active={filters.tags.includes(t)} onClick={() => setFilters(p => ({
            ...p, tags: p.tags.includes(t) ? p.tags.filter(x => x !== t) : [...p.tags, t],
          }))} style={{ fontSize: 12, padding: "6px 14px" }}>{t}</GlassPill>
        ))}
      </div>
    </div>
  );
}

// ─── Payout Ladder ───

function PayoutLadder({ rates, levels = DEFAULT_PAYOUT_LEVELS }: { rates: number[]; levels?: { level: number; name: string; visits: string }[] }) {
  const levelColors = [COLORS.textSecondary, COLORS.neonBlue, COLORS.neonGreen, COLORS.neonYellow, COLORS.neonOrange, COLORS.neonPink, COLORS.neonPurple];
  return (
    <div style={{ background: COLORS.cardBg, borderRadius: 16, padding: "20px 16px", border: `1px solid ${COLORS.cardBorder}` }}>
      <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 2.5, color: COLORS.textSecondary, marginBottom: 16, textAlign: "center", fontFamily: "'DM Sans', sans-serif" }}>
        Progressive Payout Ladder
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {levels.map((pl, i) => {
          const pct = rates[i] ?? 0;
          const color = levelColors[i];
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
              borderRadius: 10, background: `${color}08`, border: `1px solid ${color}20`,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                background: `${color}18`, color, fontSize: 14, fontWeight: 800, fontFamily: "'DM Sans', sans-serif",
              }}>{pl.level}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", fontFamily: "'DM Sans', sans-serif" }}>
                  Level {pl.level} <span style={{ color, fontWeight: 600 }}>({pl.name})</span>
                </div>
                <div style={{ fontSize: 11, color: COLORS.textSecondary, fontFamily: "'DM Sans', sans-serif" }}>{pl.visits}</div>
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color, fontFamily: "'DM Sans', sans-serif", textShadow: `0 0 20px ${color}40` }}>{pct}%</div>
            </div>
          );
        })}
      </div>
      <div style={{
        marginTop: 14, padding: "10px 14px", borderRadius: 8,
        background: `${COLORS.neonBlue}08`, border: `1px solid ${COLORS.neonBlue}15`,
        fontSize: 10, lineHeight: 1.6, color: COLORS.textSecondary, fontFamily: "'DM Sans', sans-serif",
      }}>
        Only verified receipts count towards visit totals & progressive payouts. Payout is agreed upon and unique to each business as well as each user. Payout is based on the receipt subtotal before tax & tip.
      </div>
    </div>
  );
}

// ─── Like Button ───

function LikeButton({ liked, onToggle }: { liked: boolean; onToggle: () => void }) {
  const [pop, setPop] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle();
    if (!liked) { setPop(true); setTimeout(() => setPop(false), 400); }
  };

  return (
    <button data-tour="heart-btn" onClick={handleClick} style={{
      background: "none", border: "none", cursor: "pointer", padding: 4,
      transform: pop ? "scale(1.3)" : "scale(1)",
      transition: "transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
      flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <svg width="30" height="30" viewBox="0 0 24 24"
        fill={liked ? COLORS.neonPink : "none"}
        stroke={liked ? COLORS.neonPink : "rgba(255,255,255,0.5)"}
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        style={{
          filter: liked ? `drop-shadow(0 0 8px ${COLORS.neonPink})` : "none",
          transition: "all 0.3s ease",
        }}
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
    </button>
  );
}

// ─── Follow Button ───

function FollowButton({ followed, onToggle }: { followed: boolean; onToggle: () => void }) {
  const [pop, setPop] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle();
    if (!followed) { setPop(true); setTimeout(() => setPop(false), 400); }
  };

  return (
    <button onClick={handleClick} style={{
      padding: "6px 14px", borderRadius: 50, cursor: "pointer",
      border: `1px solid ${followed ? COLORS.neonGreen : "rgba(255,255,255,0.25)"}`,
      background: followed ? `${COLORS.neonGreen}20` : "rgba(255,255,255,0.08)",
      color: followed ? COLORS.neonGreen : "rgba(255,255,255,0.6)",
      fontSize: 11, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
      letterSpacing: "0.05em", textTransform: "uppercase" as const,
      transform: pop ? "scale(1.08)" : "scale(1)",
      transition: "all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
      backdropFilter: "blur(8px)",
      boxShadow: followed ? `0 0 12px ${COLORS.neonGreen}30` : "none",
      flexShrink: 0,
    }}>
      {followed ? "Following" : "Follow"}
    </button>
  );
}

// ─── Share Button ───

function ShareButton({ name }: { name: string }) {
  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: name, text: `Check out ${name} on Let's Go!`, url }); } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(url);
      alert("Link copied to clipboard!");
    }
  };

  return (
    <button onClick={handleClick} style={{
      background: "none", border: "none", cursor: "pointer", padding: 4,
      flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
        stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        style={{ transition: "all 0.3s ease" }}
      >
        <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
      </svg>
    </button>
  );
}

// ─── Business Detail Page (slide 2) ───

function BusinessDetailPage({ biz, payoutLevels }: { biz: DiscoveryBusiness; payoutLevels?: { level: number; name: string; visits: string }[] }) {
  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const dayIdx = new Date().getDay();
  const today = dayNames[dayIdx === 0 ? 6 : dayIdx - 1];

  return (
    <div style={{
      width: "100%", height: "100%", flexShrink: 0,
      overflowY: "auto", overflowX: "hidden",
      background: `linear-gradient(180deg, ${COLORS.darkBg} 0%, #0e0e1c 100%)`,
      WebkitOverflowScrolling: "touch",
    }}>
      <div style={{ padding: "90px 20px 40px", maxWidth: 480, margin: "0 auto" }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 32, fontWeight: 900, color: "#fff", margin: 0, lineHeight: 1.1, fontFamily: "'Dela Gothic One', sans-serif", letterSpacing: -0.5 }}>{biz.name}</h1>
          <p style={{ fontSize: 15, color: COLORS.textSecondary, marginTop: 10, lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif", fontStyle: "italic" }}>&ldquo;{biz.slogan}&rdquo;</p>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 50,
            background: biz.isOpen ? `${COLORS.neonGreen}12` : `${COLORS.neonPink}12`,
            border: `1px solid ${biz.isOpen ? COLORS.neonGreen : COLORS.neonPink}30`,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: biz.isOpen ? COLORS.neonGreen : COLORS.neonPink, boxShadow: `0 0 8px ${biz.isOpen ? COLORS.neonGreen : COLORS.neonPink}` }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: biz.isOpen ? COLORS.neonGreen : COLORS.neonPink, fontFamily: "'DM Sans', sans-serif" }}>
              {biz.isOpen ? `Open \u00B7 Closes ${biz.closesAt || ""}` : "Closed"}
            </span>
          </div>
          <div style={{ padding: "8px 14px", borderRadius: 50, background: `${COLORS.neonYellow}10`, border: `1px solid ${COLORS.neonYellow}25`, fontSize: 13, fontWeight: 800, color: COLORS.neonYellow, fontFamily: "'DM Sans', sans-serif" }}>{biz.price}</div>
        </div>

        {biz.tags.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 28 }}>
            {biz.tags.map(t => (
              <span key={t} style={{ padding: "5px 12px", borderRadius: 50, fontSize: 11, fontWeight: 600, background: `${COLORS.neonBlue}10`, border: `1px solid ${COLORS.neonBlue}20`, color: COLORS.neonBlue, fontFamily: "'DM Sans', sans-serif" }}>{t}</span>
            ))}
          </div>
        )}

        <div style={{ background: COLORS.cardBg, borderRadius: 16, padding: 20, marginBottom: 20, border: `1px solid ${COLORS.cardBorder}` }}>
          {[
            { icon: "\uD83D\uDCCD", label: "Address", value: biz.address, action: "Get Directions", href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(biz.address)}` },
            { icon: "\uD83D\uDCDE", label: "Phone", value: biz.phone, action: "Call", href: `tel:${biz.phone.replace(/[^+\d]/g, "")}` },
            { icon: "\uD83C\uDF10", label: "Website", value: biz.website, action: "Visit", href: biz.website.startsWith("http") ? biz.website : `https://${biz.website}` },
          ].filter(item => item.value).map((item, i, arr) => (
            <div key={i} style={{
              display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 0",
              borderBottom: i < arr.length - 1 ? `1px solid ${COLORS.cardBorder}` : "none",
            }}>
              <span style={{ fontSize: 20, lineHeight: 1 }}>{item.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: COLORS.textSecondary, marginBottom: 4, fontFamily: "'DM Sans', sans-serif" }}>{item.label}</div>
                <div style={{ fontSize: 14, color: "#fff", fontFamily: "'DM Sans', sans-serif", fontWeight: 500, lineHeight: 1.4 }}>{item.value}</div>
              </div>
              <a href={item.href} target={item.label === "Phone" ? undefined : "_blank"} rel="noopener noreferrer" style={{
                padding: "6px 14px", borderRadius: 50, fontSize: 11, fontWeight: 700,
                border: `1px solid ${COLORS.neonPink}40`, background: `${COLORS.neonPink}10`,
                color: COLORS.neonPink, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "'DM Sans', sans-serif",
                textDecoration: "none", display: "inline-block",
              }}>{item.action}</a>
            </div>
          ))}
        </div>

        <div style={{ background: COLORS.cardBg, borderRadius: 16, padding: 20, marginBottom: 20, border: `1px solid ${COLORS.cardBorder}` }}>
          <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 2.5, color: COLORS.textSecondary, marginBottom: 16, fontFamily: "'DM Sans', sans-serif" }}>Business Hours</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {dayNames.map(day => {
              const isToday = day === today;
              return (
                <div key={day} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 12px", borderRadius: 8,
                  background: isToday ? `${COLORS.neonPink}10` : "transparent",
                  border: isToday ? `1px solid ${COLORS.neonPink}20` : "1px solid transparent",
                }}>
                  <span style={{ fontSize: 13, fontWeight: isToday ? 700 : 500, color: isToday ? COLORS.neonPink : COLORS.textSecondary, fontFamily: "'DM Sans', sans-serif" }}>
                    {day} {isToday && <span style={{ fontSize: 9, opacity: 0.7 }}>(Today)</span>}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: isToday ? 700 : 500, color: isToday ? "#fff" : COLORS.textSecondary, fontFamily: "'DM Sans', sans-serif" }}>{biz.hours[day] || "Closed"}</span>
                </div>
              );
            })}
          </div>
        </div>

        <PayoutLadder rates={biz.payout} levels={payoutLevels || DEFAULT_PAYOUT_LEVELS} />

        <div style={{ textAlign: "center", marginTop: 28, padding: 16, fontSize: 12, color: COLORS.textSecondary, fontFamily: "'DM Sans', sans-serif" }}>
          <span style={{ opacity: 0.5 }}>{"← swipe for photos →"}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Photo Page (slides 3+) ───

function PhotoPage({ image, label, liked, onToggle }: {
  image: DiscoveryImage;
  label: string;
  liked: boolean;
  onToggle: () => void;
}) {
  return (
    <div style={{ width: "100%", height: "100%", flexShrink: 0, position: "relative", background: COLORS.darkBg }}>
      <img src={image.url} alt={label} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `${image.focalX}% ${image.focalY}%` }} draggable={false} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "35%", background: "linear-gradient(transparent, rgba(0,0,0,0.7))", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: 36, left: 24, right: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#fff", fontFamily: "'DM Sans', sans-serif", textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}>{label}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            <ShareButton name={label} />
            <LikeButton liked={liked} onToggle={onToggle} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Photo Page (hero - slide 1) ───

function MainPhotoPage({ biz, liked, onToggle, userZip, userCoords, geoReady, followed, onToggleFollow }: { biz: DiscoveryBusiness; liked: boolean; onToggle: () => void; userZip: string; userCoords: [number, number] | null; geoReady: number; followed: boolean; onToggleFollow: () => void }) {
  const distance = useMemo(() => {
    // Try coordinate-based distance first (more accurate with Google Places)
    if (userCoords && biz.businessZip) {
      const bizCoords = ZIP_COORDS[biz.businessZip];
      if (bizCoords) return haversineDistance(userCoords[0], userCoords[1], bizCoords[0], bizCoords[1]);
    }
    // Fall back to zip-to-zip lookup
    if (userZip && biz.businessZip) return getDistanceBetweenZips(userZip, biz.businessZip);
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userZip, userCoords, biz.businessZip, geoReady]);
  const heroImage = biz.images[0] ?? null;

  return (
    <div style={{ width: "100%", height: "100%", flexShrink: 0, position: "relative", background: COLORS.darkBg, overflow: "hidden" }}>
      {heroImage ? (
        <img src={heroImage.url} alt={biz.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `${heroImage.focalX}% ${heroImage.focalY}%`, opacity: 0.85 }} draggable={false} />
      ) : (
        <PlaceholderPhoto gradient={getBusinessGradient(biz.id)} emoji={getBusinessEmoji(biz.type)} label={biz.name} sublabel={biz.type} style={{ opacity: 0.85 }} />
      )}
      {/* Top vignette so header area isn't fighting the image */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "20%", background: "linear-gradient(rgba(0,0,0,0.5), transparent)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "55%", background: "linear-gradient(transparent, rgba(0,0,0,0.85))", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0 24px 36px" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
          {biz.isSponsored && (
            <span style={{
              padding: "4px 10px", borderRadius: 50, fontSize: 9, fontWeight: 700,
              background: `${COLORS.neonYellow}20`, color: COLORS.neonYellow, border: `1px solid ${COLORS.neonYellow}40`,
              fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: 1.5, backdropFilter: "blur(8px)",
            }}>Sponsored</span>
          )}
          <span style={{
            padding: "4px 12px", borderRadius: 50, fontSize: 10, fontWeight: 700,
            background: `${COLORS.neonPink}25`, color: COLORS.neonPink, border: `1px solid ${COLORS.neonPink}40`,
            fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: 1, backdropFilter: "blur(8px)",
          }}>{biz.type}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <h2 style={{ fontSize: "clamp(24px, 7vw, 36px)", fontWeight: 900, color: "#fff", margin: 0, lineHeight: 1.05, fontFamily: "'Dela Gothic One', sans-serif", textShadow: "0 2px 20px rgba(0,0,0,0.6)", letterSpacing: -0.5 }}>{biz.name}</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            <FollowButton followed={followed} onToggle={onToggleFollow} />
            <ShareButton name={biz.name} />
            <LikeButton liked={liked} onToggle={onToggle} />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
          <span style={{
            display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 50,
            background: biz.isOpen ? "rgba(57,255,20,0.12)" : "rgba(255,45,146,0.12)",
            backdropFilter: "blur(8px)", fontSize: 12, fontWeight: 700,
            color: biz.isOpen ? COLORS.neonGreen : COLORS.neonPink, fontFamily: "'DM Sans', sans-serif",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: biz.isOpen ? COLORS.neonGreen : COLORS.neonPink }} />
            {biz.isOpen ? "Open" : "Closed"}
          </span>
          <span style={{ fontSize: 14, fontWeight: 800, color: COLORS.neonYellow, fontFamily: "'DM Sans', sans-serif" }}>{biz.price}</span>
          {distance !== null && (
            <span style={{
              display: "flex", alignItems: "center", gap: 4, padding: "5px 12px", borderRadius: 50,
              background: "rgba(0,212,255,0.12)", backdropFilter: "blur(8px)",
              fontSize: 12, fontWeight: 700, color: COLORS.neonBlue, fontFamily: "'DM Sans', sans-serif",
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill={COLORS.neonBlue} stroke="none">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
              {distance < 0.1 ? "<0.1" : distance.toFixed(1)} mi
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 20, animation: "pulseGlow 2s ease-in-out infinite" }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Sans', sans-serif" }}>Swipe for details</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
        </div>
      </div>
    </div>
  );
}

// ─── Page Dots ───

function PageDots({ total, current }: { total: number; current: number }) {
  return (
    <div data-tour="page-dots" style={{
      position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)",
      display: "flex", gap: 5, zIndex: 50, padding: "4px 10px", borderRadius: 20,
      background: "rgba(0,0,0,0.4)", backdropFilter: "blur(8px)",
    }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          width: i === current ? 18 : 6, height: 6, borderRadius: 3,
          background: i === current ? COLORS.neonPink : "rgba(255,255,255,0.3)",
          transition: "all 0.3s ease",
          boxShadow: i === current ? `0 0 8px ${COLORS.neonPink}` : "none",
        }} />
      ))}
    </div>
  );
}

// ─── Business Card (horizontal swipeable via touch) ───

function BusinessCard({ biz, userZip, userCoords, geoReady, payoutLevels, followed, onToggleFollow }: { biz: DiscoveryBusiness; userZip: string; userCoords: [number, number] | null; geoReady: number; payoutLevels?: { level: number; name: string; visits: string }[]; followed: boolean; onToggleFollow: () => void }) {
  const [currentPage, setCurrentPage] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [liked, setLiked] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const dragging = useRef(false);
  const locked = useRef<"h" | "v" | null>(null);

  const extraPhotos = biz.images.slice(1);
  const totalPages = 2 + extraPhotos.length;

  const getWidth = () => containerRef.current?.clientWidth || window.innerWidth;

  const handleStart = (clientX: number, clientY: number) => {
    startX.current = clientX;
    startY.current = clientY;
    dragging.current = true;
    locked.current = null;
    setIsDragging(true);
    setDragOffset(0);
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!dragging.current) return;
    const dx = clientX - startX.current;
    const dy = clientY - startY.current;

    if (locked.current === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      locked.current = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
    }

    if (locked.current === "h") {
      const maxRight = -(totalPages - 1) * getWidth();
      const proposedPos = -(currentPage * getWidth()) + dx;
      const clamped = Math.max(maxRight - 40, Math.min(40, proposedPos));
      setDragOffset(clamped + currentPage * getWidth());
    }
  };

  const handleEnd = () => {
    if (!dragging.current) return;
    dragging.current = false;
    setIsDragging(false);

    if (locked.current === "h") {
      const w = getWidth();
      const threshold = w * 0.2;
      if (dragOffset < -threshold && currentPage < totalPages - 1) {
        setCurrentPage(p => p + 1);
      } else if (dragOffset > threshold && currentPage > 0) {
        setCurrentPage(p => p - 1);
      }
    }
    locked.current = null;
    setDragOffset(0);
  };

  const toggleLike = () => setLiked(l => !l);

  const translateX = -(currentPage * 100 / totalPages) + (isDragging ? (dragOffset / getWidth()) * (100 / totalPages) : 0);

  return (
    <div
      ref={containerRef}
      data-tour="swipe-card"
      style={{ position: "absolute", inset: 0, overflow: "hidden", touchAction: "pan-y" }}
      onTouchStart={(e) => handleStart(e.touches[0].clientX, e.touches[0].clientY)}
      onTouchMove={(e) => handleMove(e.touches[0].clientX, e.touches[0].clientY)}
      onTouchEnd={handleEnd}
      onMouseDown={(e) => { e.preventDefault(); handleStart(e.clientX, e.clientY); }}
      onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
      onMouseUp={handleEnd}
      onMouseLeave={() => { if (dragging.current) handleEnd(); }}
    >
      <div style={{
        display: "flex", width: `${totalPages * 100}%`, height: "100%",
        transform: `translateX(${translateX}%)`,
        transition: isDragging ? "none" : "transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        willChange: "transform",
      }}>
        {/* Slide 1: Hero photo */}
        <div style={{ width: `${100 / totalPages}%`, height: "100%", flexShrink: 0, overflow: "hidden" }}>
          <MainPhotoPage biz={biz} liked={liked} onToggle={toggleLike} userZip={userZip} userCoords={userCoords} geoReady={geoReady} followed={followed} onToggleFollow={onToggleFollow} />
        </div>
        {/* Slide 2: Detail page */}
        <div style={{ width: `${100 / totalPages}%`, height: "100%", flexShrink: 0, overflow: "hidden" }}>
          <BusinessDetailPage biz={biz} payoutLevels={payoutLevels} />
        </div>
        {/* Slides 3+: Additional photos */}
        {extraPhotos.map((img, i) => (
          <div key={i} style={{ width: `${100 / totalPages}%`, height: "100%", flexShrink: 0, overflow: "hidden" }}>
            <PhotoPage image={img} label={biz.name} liked={liked} onToggle={toggleLike} />
          </div>
        ))}
      </div>
      <PageDots total={totalPages} current={currentPage} />
    </div>
  );
}

// ═══════════════════════════════════════════════════
// MAIN DISCOVERY PAGE
// ═══════════════════════════════════════════════════

export default function DiscoveryPage() {
  const searchParams = useSearchParams();
  const spotlightId = searchParams.get("spotlight");
  const [businesses, setBusinesses] = useState<DiscoveryBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    search: "", category: "All", price: "Any", sort: "Nearest", openNow: false, distance: 15, tags: [],
  });
  const [currentBiz, setCurrentBiz] = useState(0);
  const [locationZip, setLocationZip] = useState("68102");
  const [locationCoords, setLocationCoords] = useState<[number, number] | null>([41.2565, -95.9345]); // default Omaha
  const verticalRef = useRef<HTMLDivElement>(null);
  const [geoReady, setGeoReady] = useState(0); // increments when geocoding completes, triggers distance recalc
  const [payoutLevels, setPayoutLevels] = useState(DEFAULT_PAYOUT_LEVELS);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [showFollowedOnly, setShowFollowedOnly] = useState(false);
  const GMAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  // Onboarding tour
  const swipeTourSteps: TourStep[] = useMemo(() => [
    { target: '[data-tour="swipe-card"]', title: "Swipe to browse", description: "Swipe up and down to explore restaurants and activities near you.", position: "bottom" },
    { target: '[data-tour="page-dots"]', title: "Swipe for details", description: "Swipe left on any card to see details, hours, photos, and payout tiers.", position: "top" },
    { target: '[data-tour="filter-btn"]', title: "Filter results", description: "Search and filter by cuisine, price, distance, vibe, and more.", position: "bottom" },
    { target: '[data-tour="heart-btn"]', title: "Save for later", description: "Tap the heart to save a place to your favorites so you can find it easily later.", position: "left" },
    { target: '[data-tour="scroll-indicator"]', title: "Your feed position", description: "These dots show where you are in the feed. After you visit a place, head to your Profile page to upload your receipt and earn cashback!", position: "left" },
  ], []);
  const swipeTourIllustrations: React.ReactNode[] = useMemo(() => [
    <SwipeVerticalAnim key="sv" />,
    <SwipeLeftAnim key="sl" />,
    <FilterAnim key="f" />,
    <HeartAnim key="h" />,
    <ScrollIndicatorAnim key="si" />,
  ], []);
  const tour = useOnboardingTour("swipe", swipeTourSteps, 1200);

  const getUserId = useCallback((): string | null => {
    try {
      const raw = localStorage.getItem("letsgo-auth");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.user?.id || parsed?.id || null;
    } catch { return null; }
  }, []);

  // Load user's saved home zip as default location
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabaseBrowser.auth.getUser();
        if (!user) return;
        const { data } = await supabaseBrowser
          .from("profiles")
          .select("zip_code")
          .eq("id", user.id)
          .maybeSingle();
        if (data?.zip_code && /^\d{5}$/.test(data.zip_code)) {
          setLocationZip(data.zip_code);
          const coords = ZIP_COORDS[data.zip_code];
          if (coords) setLocationCoords(coords);
        }
      } catch { /* not logged in or profile not found — keep default */ }
    })();
  }, []);

  // Fetch platform settings (visit thresholds) on mount
  useEffect(() => {
    fetchPlatformTierConfig(supabaseBrowser).then((cfg) => {
      setPayoutLevels(buildPayoutLevels(cfg.visitThresholds));
    });
  }, []);

  // Fetch followed businesses on mount
  useEffect(() => {
    const userId = getUserId();
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/businesses/follow?userId=${userId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data.followedBusinessIds)) {
          setFollowedIds(new Set(data.followedBusinessIds as string[]));
        }
      } catch { /* silent — non-critical */ }
    })();
    return () => { cancelled = true; };
  }, [getUserId]);

  const handleToggleFollow = useCallback(async (businessId: string) => {
    const userId = getUserId();
    if (!userId) {
      alert("Please log in to follow businesses.");
      return;
    }
    const wasFollowed = followedIds.has(businessId);
    setFollowedIds(prev => {
      const next = new Set(prev);
      if (wasFollowed) next.delete(businessId); else next.add(businessId);
      return next;
    });
    try {
      const res = await fetch("/api/businesses/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, userId }),
      });
      if (!res.ok) {
        setFollowedIds(prev => {
          const next = new Set(prev);
          if (wasFollowed) next.add(businessId); else next.delete(businessId);
          return next;
        });
      }
    } catch {
      setFollowedIds(prev => {
        const next = new Set(prev);
        if (wasFollowed) next.add(businessId); else next.delete(businessId);
        return next;
      });
    }
  }, [followedIds, getUserId]);

  // Fetch businesses + media on mount
  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setError("");

      try {
        // Query 1: Active businesses
        const { data: bizRows, error: bizErr } = await supabaseBrowser
          .from("business")
          .select(`
            id, business_name, public_business_name,
            contact_phone, website, street_address, city, state, zip,
            name, phone_number, website_url, address_line1,
            category_main, config, blurb,
            payout_tiers, payout_preset
          `)
          .eq("is_active", true)
          .order("created_at", { ascending: false });

        if (bizErr) throw bizErr;
        if (!alive) return;

        const rows = (bizRows ?? []) as BusinessRow[];
        if (rows.length === 0) {
          setBusinesses([]);
          return;
        }

        // Query 2 & 3: Bulk-fetch media + payout tiers for all business IDs
        const bizIds = rows.map(r => r.id);
        const [{ data: mediaRows }, { data: tierRows }] = await Promise.all([
          supabaseBrowser
            .from("business_media")
            .select("business_id, bucket, path, sort_order, caption, meta")
            .in("business_id", bizIds)
            .eq("is_active", true)
            .eq("media_type", "photo")
            .order("sort_order", { ascending: true }),
          supabaseBrowser
            .from("business_payout_tiers")
            .select("business_id, percent_bps, tier_index")
            .in("business_id", bizIds)
            .order("tier_index", { ascending: true }),
        ]);

        if (!alive) return;

        // Group media by business_id
        const mediaMap = new Map<string, MediaRow[]>();
        for (const m of (mediaRows ?? []) as MediaRow[]) {
          const existing = mediaMap.get(m.business_id) ?? [];
          existing.push(m);
          mediaMap.set(m.business_id, existing);
        }

        // Group payout tiers by business_id
        const tierMap = new Map<string, number[]>();
        for (const t of (tierRows ?? []) as { business_id: string; percent_bps: number }[]) {
          if (!tierMap.has(t.business_id)) tierMap.set(t.business_id, []);
          tierMap.get(t.business_id)!.push(Number(t.percent_bps) || 0);
        }

        // Normalize all businesses
        const normalized = rows.map(row =>
          normalizeToDiscoveryBusiness(row, mediaMap.get(row.id) ?? [], tierMap.get(row.id))
        );

        if (!alive) return;

        // Query 3: Active ad campaigns (sponsored businesses go first)
        const today = new Date().toISOString().split("T")[0];
        const { data: campaigns } = await supabaseBrowser
          .from("business_ad_campaigns")
          .select("business_id, price_cents")
          .in("status", ["active", "purchased", "scheduled"])
          .lte("start_date", today)
          .gte("end_date", today)
          .order("price_cents", { ascending: false });

        if (!alive) return;

        // Build a set of sponsored business IDs (ordered by price_cents DESC)
        const sponsoredIds = new Set<string>();
        for (const c of (campaigns ?? [])) {
          if (c.business_id) sponsoredIds.add(c.business_id);
        }

        // Mark sponsored businesses
        for (const biz of normalized) {
          if (sponsoredIds.has(biz.id)) biz.isSponsored = true;
        }

        // Split into sponsored (preserve priority order) and non-sponsored (shuffle)
        const sponsoredOrder = [...sponsoredIds];
        const sponsored = sponsoredOrder
          .map(id => normalized.find(b => b.id === id))
          .filter((b): b is DiscoveryBusiness => b !== undefined);
        const rest = normalized.filter(b => !sponsoredIds.has(b.id));
        shuffleArray(rest);

        // Sponsored first, then random
        setBusinesses([...sponsored, ...rest]);
      } catch (e: unknown) {
        if (!alive) return;
        const msg = e instanceof Error ? e.message : "Failed to load businesses.";
        setError(msg);
        setBusinesses([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, []);

  // Geocode unknown business zip codes so distance works for all businesses
  useEffect(() => {
    if (businesses.length === 0) return;
    const google = (window as unknown as Record<string, unknown>).google as { maps?: { Geocoder?: new () => { geocode: (req: Record<string, unknown>, cb: (results: Array<{ geometry: { location: { lat: () => number; lng: () => number } } }> | null, status: string) => void) => void } } } | undefined;
    if (!google?.maps?.Geocoder) return;

    const unknownZips = [...new Set(businesses.map(b => b.businessZip).filter(z => z && z.length === 5 && !ZIP_COORDS[z]))];
    if (unknownZips.length === 0) return;

    const geocoder = new google.maps.Geocoder();
    let idx = 0;

    // Geocode one at a time with a small delay to avoid rate limits
    function geocodeNext() {
      if (idx >= unknownZips.length) {
        // All done — trigger distance recalc
        setGeoReady(g => g + 1);
        return;
      }
      const zip = unknownZips[idx++];
      geocoder.geocode({ address: zip + ", USA" }, (results, status) => {
        if (status === "OK" && results && results[0]) {
          const loc = results[0].geometry.location;
          ZIP_COORDS[zip] = [loc.lat(), loc.lng()];
        }
        // Small delay between requests
        setTimeout(geocodeNext, 100);
      });
    }
    geocodeNext();
  }, [businesses]);

  // Client-side filtering
  const filteredBusinesses = useMemo(() => {
    // Spotlight mode: show only the spotlighted business
    if (spotlightId) {
      const match = businesses.filter(b => b.id === spotlightId);
      if (match.length > 0) return match;
    }

    let result = businesses;

    if (showFollowedOnly) {
      result = result.filter(b => followedIds.has(b.id));
    }

    if (filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      result = result.filter(b =>
        b.name.toLowerCase().includes(q) ||
        b.type.toLowerCase().includes(q) ||
        b.tags.some(t => t.toLowerCase().includes(q)) ||
        b.address.toLowerCase().includes(q)
      );
    }

    if (filters.category !== "All") {
      const cat = filters.category.toLowerCase();
      result = result.filter(b =>
        b.type.toLowerCase().includes(cat) ||
        b.categoryMain.toLowerCase().includes(cat) ||
        b.vibe.toLowerCase().includes(cat)
      );
    }

    if (filters.price !== "Any") {
      result = result.filter(b => b.price === filters.price);
    }

    if (filters.openNow) {
      result = result.filter(b => b.isOpen);
    }

    if (filters.tags.length > 0) {
      result = result.filter(b => {
        const hay = `${b.name} ${b.type} ${b.vibe} ${b.tags.join(" ")}`.toLowerCase();
        return filters.tags.some(t => hay.includes(t.toLowerCase()));
      });
    }

    // Sort
    if (filters.sort === "Highest Payout") {
      result = [...result].sort((a, b) => (b.payout[6] ?? 0) - (a.payout[6] ?? 0));
    }
    // Distance sort is UI-only for now (no geo data in DB)

    return result;
  }, [businesses, filters, showFollowedOnly, followedIds]);

  const handleVerticalScroll = useCallback(() => {
    if (!verticalRef.current) return;
    const { scrollTop, clientHeight } = verticalRef.current;
    setCurrentBiz(Math.round(scrollTop / clientHeight));
  }, []);

  return (
    <div style={{
      width: "100%", height: "100dvh", background: COLORS.darkBg, position: "relative", overflow: "hidden",
      fontFamily: "'DM Sans', sans-serif",
    }}>
      {/* dvh = dynamic viewport height — accounts for mobile browser chrome (address bar, nav bar) */}
      <style>{`@supports not (height: 100dvh) { .discovery-page { height: 100vh !important; } .discovery-card { height: 100vh !important; } }`}</style>
      <link href="https://fonts.googleapis.com/css2?family=Dela+Gothic+One&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400&display=swap" rel="stylesheet" />
      <link href="https://api.fontshare.com/v2/css?f[]=clash-display@700,600,500&display=swap" rel="stylesheet" />
      {GMAPS_KEY && (
        <Script
          src={`https://maps.googleapis.com/maps/api/js?key=${GMAPS_KEY}&libraries=places&v=weekly`}
          strategy="afterInteractive"
        />
      )}
      <FloatingOrbs />
      <FilterBar filtersOpen={filtersOpen} setFiltersOpen={setFiltersOpen} filters={filters} setFilters={setFilters} locationZip={locationZip} onLocationZipChange={setLocationZip} onLocationCoordsChange={setLocationCoords} showFollowedOnly={showFollowedOnly} setShowFollowedOnly={setShowFollowedOnly} followedCount={followedIds.size} />

      {/* Loading state */}
      {loading && (
        <div style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          background: COLORS.darkBg, zIndex: 200,
        }}>
          <div style={{ color: COLORS.neonPink, fontSize: 14, fontFamily: "'DM Sans', sans-serif" }}>Loading discoveries...</div>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 12, padding: 40, zIndex: 50,
        }}>
          <span style={{ fontSize: 48 }}>&#x26A0;&#xFE0F;</span>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Something went wrong</div>
          <div style={{ fontSize: 13, color: COLORS.textSecondary, textAlign: "center", maxWidth: 300 }}>{error}</div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filteredBusinesses.length === 0 && (
        <div style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 12, padding: 40, zIndex: 50,
        }}>
          <span style={{ fontSize: 48 }}>{"\uD83D\uDD0D"}</span>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>No places found</div>
          <div style={{ fontSize: 13, color: COLORS.textSecondary, textAlign: "center", maxWidth: 300 }}>
            Try adjusting your filters or expanding your search area.
          </div>
        </div>
      )}

      {/* Vertical swipe feed */}
      {!loading && !error && filteredBusinesses.length > 0 && (
        <div ref={verticalRef} onScroll={handleVerticalScroll} style={{
          width: "100%", height: "100%", overflowY: "auto", overflowX: "hidden",
          scrollSnapType: "y mandatory", WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none", position: "relative", zIndex: 1,
        }}>
          {filteredBusinesses.map((biz) => (
            <div key={biz.id} style={{ width: "100%", height: "100dvh", scrollSnapAlign: "start", position: "relative" }}>
              <BusinessCard biz={biz} userZip={locationZip} userCoords={locationCoords} geoReady={geoReady} payoutLevels={payoutLevels} followed={followedIds.has(biz.id)} onToggleFollow={() => handleToggleFollow(biz.id)} />
            </div>
          ))}
        </div>
      )}

      {/* Vertical scroll indicator (right side) */}
      {!loading && filteredBusinesses.length > 1 && (
        <div data-tour="scroll-indicator" style={{
          position: "fixed", right: 10, top: "50%", transform: "translateY(-50%)",
          display: "flex", flexDirection: "column", gap: 6, zIndex: 50,
        }}>
          {filteredBusinesses.map((_, i) => (
            <div key={i} style={{
              width: 4, height: i === currentBiz ? 20 : 8, borderRadius: 2,
              background: i === currentBiz ? COLORS.neonPink : "rgba(255,255,255,0.2)",
              transition: "all 0.3s ease",
              boxShadow: i === currentBiz ? `0 0 6px ${COLORS.neonPink}` : "none",
            }} />
          ))}
        </div>
      )}

      {/* Onboarding tour */}
      {tour.isTouring && tour.currentStep && (
        <OnboardingTooltip
          step={tour.currentStep}
          stepIndex={tour.stepIndex}
          totalSteps={tour.totalSteps}
          onNext={tour.next}
          onBack={tour.back}
          onSkip={tour.skip}
          illustration={tour.stepIndex >= 0 ? swipeTourIllustrations[tour.stepIndex] : undefined}
        />
      )}

      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { display: none; }
        @keyframes pulseGlow { 0%,100% { opacity: 0.4; } 50% { opacity: 0.8; } }
        @keyframes logoGlow {
          0%, 100% { filter: drop-shadow(0 0 8px #FF2D78) drop-shadow(0 0 20px #FF2D7850); }
          50% { filter: drop-shadow(0 0 12px #FF2D78) drop-shadow(0 0 35px #FF2D7870); }
        }
        /* Dark theme for Google Places autocomplete dropdown */
        .pac-container {
          background: #12121f !important;
          border: 1px solid #1e1e33 !important;
          border-radius: 8px !important;
          margin-top: 4px !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.6) !important;
          z-index: 10000 !important;
        }
        .pac-item {
          border-top: 1px solid #1e1e33 !important;
          padding: 8px 12px !important;
          color: #fff !important;
          font-family: 'DM Sans', sans-serif !important;
          cursor: pointer !important;
        }
        .pac-item:hover { background: rgba(0,212,255,0.08) !important; }
        .pac-item-query { color: #00d4ff !important; font-weight: 600 !important; }
        .pac-matched { color: #ff2d92 !important; font-weight: 700 !important; }
        .pac-icon { display: none !important; }
        .pac-item span { color: #8888aa !important; }
        .pac-item-query span { color: #00d4ff !important; }
      `}</style>
    </div>
  );
}
