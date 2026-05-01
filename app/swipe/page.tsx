"use client";

import { useState, useRef, useCallback, useEffect, useMemo, Suspense } from "react";
import Script from "next/script";
import { useSearchParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import NotificationBell from "@/components/NotificationBell";
import OnboardingTooltip from "@/components/OnboardingTooltip";
import { useOnboardingTour, type TourStep } from "@/lib/useOnboardingTour";
import { SwipeVerticalAnim, SwipeLeftAnim, FilterAnim, HeartAnim, ScrollIndicatorAnim } from "@/components/TourIllustrations";
import { ZIP_COORDS, haversineDistance, getDistanceBetweenZips, getBusinessDistance } from "@/lib/zipUtils";
import { fetchPlatformTierConfig, getVisitRangeLabel, DEFAULT_VISIT_THRESHOLDS, type VisitThreshold } from "@/lib/platformSettings";
import { LaunchBanner } from "@/components/LaunchBanner";
import { fetchTagsByCategory, type TagCategory } from "@/lib/availableTags";
import { loadFilterPreferences } from "@/lib/filterPreferences";
import { autolink } from "@/lib/autolink";
import {
  type BusinessRow, type MediaRow, type DiscoveryImage, type DiscoveryBusiness,
  buildMediaUrl, getBusinessGradient, getBusinessEmoji, formatBusinessType,
  normalizeHoursForDisplay, computeOpenStatus, normalizePayoutFromBps,
  normalizeToDiscoveryBusiness,
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
  topTypes: string[]; // "eat" | "drink" | "play" | "pamper" — multi-select, empty = show all
  categories: string[];
  price: string;
  sort: string;
  openNow: boolean;
  hasRewards: boolean;
  distance: number;
  tags: string[];
};

// Top-level type filter — the new "Eat / Drink / Play / Pamper" primary axis.
// Each Business Type tag has a top_type field that maps it to one of these.
const TOP_TYPE_OPTIONS: { value: "eat" | "drink" | "play" | "pamper"; label: string }[] = [
  { value: "eat", label: "Eat" },
  { value: "drink", label: "Drink" },
  { value: "play", label: "Play" },
  { value: "pamper", label: "Pamper" },
];

// ─── Filter options (fallbacks if DB fetch fails) ───

const DEFAULT_FILTER_CATEGORIES = ["All", "Restaurant", "Bar", "Coffee", "Entertainment", "Activity", "Nightclub", "Brewery", "Winery", "Food Truck", "Bakery", "Deli", "Ice Cream", "Juice Bar", "Lounge", "Pub", "Sports Bar", "Karaoke", "Arcade", "Bowling", "Mini Golf", "Escape Room", "Theater", "Comedy Club", "Art Gallery", "Museum", "Spa", "Gym", "Yoga Studio", "Dance Studio"];
const PRICE_FILTERS = ["Any", "$", "$$", "$$$", "$$$$"];
// Empty sort = Random (server picks a stable seeded shuffle for the session).
// Random is the discovery default — no pill is highlighted until the user picks one.
const SORT_OPTIONS = ["Nearest", "Newest", "Highest Payout"];
const DEFAULT_CUISINE_FILTERS = ["American", "Italian", "Mexican", "Chinese", "Japanese", "Thai", "Indian", "Korean", "Vietnamese", "Mediterranean", "Greek", "French", "Spanish", "Caribbean", "Ethiopian", "Peruvian", "Brazilian", "Middle Eastern", "Moroccan", "Southern", "Cajun", "BBQ", "Seafood", "Steakhouse", "Sushi", "Ramen", "Pizza", "Burgers", "Tacos", "Poke", "Farm-to-Table", "Fusion"];
const DEFAULT_VIBE_FILTERS = ["Romantic", "Chill", "Lively", "Upscale", "Casual", "Trendy", "Cozy", "Retro", "Modern", "Rustic", "Industrial", "Bohemian", "Rooftop", "Waterfront", "Hidden Gem", "Instagrammable", "Speakeasy", "Dive Bar", "Sports Vibe", "Artsy"];
const DEFAULT_AMENITY_FILTERS = ["Free WiFi", "Parking", "Wheelchair Accessible", "Reservations", "Takeout", "Delivery", "Dine-in", "Patio Seating", "Private Rooms", "Full Bar", "Beer Garden", "Fireplace", "Pool Table", "Dart Board", "TV Screens", "Projector", "Stage", "Dance Floor", "Valet", "EV Charging"];
const DEFAULT_DIETARY_FILTERS = ["Vegetarian", "Vegan", "Gluten-Free", "Halal", "Kosher", "Keto-Friendly", "Dairy-Free", "Nut-Free", "Organic", "Locally Sourced"];
const DEFAULT_POPULAR_TAGS = [
  "Date Night", "Happy Hour", "Family", "Live Music", "Outdoor", "Late Night", "Brunch",
  "Pet Friendly", "Kid Friendly", "Group Friendly", "Solo Dining", "First Date", "Anniversary",
  "Birthday", "Business Lunch", "Girls Night", "Guys Night", "Game Day", "Watch Party",
  "Trivia Night", "Open Mic", "DJ Night", "Craft Cocktails", "Wine List", "Beer Flight",
  "Tasting Menu", "All You Can Eat", "Bottomless Mimosas", "Weekend Special", "After Hours",
];

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
//     normalizeToDiscoveryBusiness imported from @/lib/businessNormalize) ───

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

function GlassPill({ children, style, onClick, active, title }: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  onClick?: () => void;
  active?: boolean;
  title?: string;
}) {
  return (
    <button onClick={onClick} title={title} style={{
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

const PRICE_TOOLTIPS: Record<string, string> = {
  "$": "Under $15/person",
  "$$": "$15–$30/person",
  "$$$": "$30–$60/person",
  "$$$$": "$60+/person",
};

// ─── Filter Bar ───

function FilterBar({ filtersOpen, setFiltersOpen, filters, setFilters, locationZip, onLocationZipChange, onLocationCoordsChange, showMyPlacesOnly, setShowMyPlacesOnly, myPlacesCount, onApply }: {
  filtersOpen: boolean;
  setFiltersOpen: (v: boolean) => void;
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  locationZip: string;
  onLocationZipChange: (zip: string) => void;
  onLocationCoordsChange: (coords: [number, number] | null) => void;
  showMyPlacesOnly: boolean;
  setShowMyPlacesOnly: (v: boolean) => void;
  myPlacesCount: number;
  onApply: () => void;
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

  // DB-driven tag categories
  const [tagCats, setTagCats] = useState<TagCategory[]>([]);
  useEffect(() => { fetchTagsByCategory("business").then(setTagCats).catch(() => {}); }, []);

  // Subtypes shown in the Category grid are contextual on selected top types.
  // No top types selected → show every Business Type tag. With selections → only
  // show tags whose top_type matches one of the selected types.
  const FILTER_CATEGORIES = useMemo(() => {
    const bt = tagCats.find(c => c.name === "Business Type");
    if (!bt || bt.tags.length === 0) return DEFAULT_FILTER_CATEGORIES;
    const filtered = filters.topTypes.length === 0
      ? bt.tags
      : bt.tags.filter(t => t.top_type && filters.topTypes.includes(t.top_type));
    return ["All", ...filtered.map(t => t.name)];
  }, [tagCats, filters.topTypes]);

  // Smart visibility: show Cuisine/Dietary only when the user is filtering for food.
  // The signal is either (a) "Eat" is in the selected top types, or (b) a food
  // subtype was picked in the Category grid. With no filters at all, default to
  // visible (matches old behavior).
  const selectedCatIsFood = useMemo(() => {
    if (filters.topTypes.length === 0 && filters.categories.length === 0) return true;
    if (filters.topTypes.includes("eat")) return true;
    const bt = tagCats.find(c => c.name === "Business Type");
    if (filters.categories.length > 0) {
      return filters.categories.some(cat => {
        const tag = bt?.tags.find(t => t.name === cat);
        return tag?.is_food ?? true;
      });
    }
    return false;
  }, [filters.topTypes, filters.categories, tagCats]);

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
      // Update coords from lookup; if the zip isn't in the static map, geocode
      // it via Google Maps so the discover API gets real coords. Without this,
      // typing an unknown zip leaves coords=null and the API silently skips
      // the distance filter (returns businesses everywhere).
      const coords = ZIP_COORDS[zip];
      if (coords) {
        onLocationCoordsChange([coords[0], coords[1]]);
      } else {
        onLocationCoordsChange(null);
        const g = (window as unknown as { google?: { maps?: { Geocoder?: new () => {
          geocode: (
            req: Record<string, unknown>,
            cb: (results: Array<{ geometry: { location: { lat: () => number; lng: () => number } } }> | null, status: string) => void
          ) => void;
        } } } }).google;
        if (g?.maps?.Geocoder) {
          const geocoder = new g.maps.Geocoder();
          geocoder.geocode({ address: zip + ", USA" }, (results, status) => {
            if (status === "OK" && results && results[0]) {
              const loc = results[0].geometry.location;
              const lat = loc.lat();
              const lng = loc.lng();
              ZIP_COORDS[zip] = [lat, lng];
              onLocationCoordsChange([lat, lng]);
            }
          });
        }
      }
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

        {/* Browse From — always visible, at the top */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 1.5, fontFamily: "'DM Sans', sans-serif", marginRight: 8 }}>Browse From</div>
          <GlassPill active={!showMyPlacesOnly} onClick={() => setShowMyPlacesOnly(false)}>🌐 All Businesses</GlassPill>
          {myPlacesCount > 0 && (
            <GlassPill active={showMyPlacesOnly} onClick={() => setShowMyPlacesOnly(true)}>❤️ My Places ({myPlacesCount})</GlassPill>
          )}
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
          <button onClick={() => setFilters(p => ({ ...p, hasRewards: !p.hasRewards }))} style={{
            display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 50,
            border: `1px solid ${filters.hasRewards ? COLORS.neonYellow : COLORS.cardBorder}`,
            background: filters.hasRewards ? `${COLORS.neonYellow}15` : COLORS.glass,
            color: filters.hasRewards ? COLORS.neonYellow : COLORS.textSecondary,
            fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
            backdropFilter: "blur(12px)", transition: "all 0.3s",
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%", display: "inline-block",
              background: filters.hasRewards ? COLORS.neonYellow : COLORS.textSecondary,
              boxShadow: filters.hasRewards ? `0 0 8px ${COLORS.neonYellow}` : "none",
            }} />
            Has Rewards
          </button>
        </div>

        {/* Type — primary filter (Eat/Drink/Play/Pamper). Multi-select.
            Empty = show all. The Category grid below filters contextually based
            on what's selected here. */}
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10, fontFamily: "'DM Sans', sans-serif" }}>
            Type
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {TOP_TYPE_OPTIONS.map(({ value, label }) => {
              const active = filters.topTypes.includes(value);
              return (
                <GlassPill
                  key={value}
                  active={active}
                  onClick={() => setFilters(prev => ({
                    ...prev,
                    topTypes: active
                      ? prev.topTypes.filter(t => t !== value)
                      : [...prev.topTypes, value],
                    // Clear category subtype picks when toggling Type so stale
                    // selections from a different Type don't linger filtered out.
                    categories: [],
                  }))}
                >
                  {label}
                </GlassPill>
              );
            })}
          </div>
        </div>

        {/* Price — always visible */}
        <FilterSection label="Price" items={PRICE_FILTERS} filters={filters} setFilters={setFilters} type="price" />

        {/* Distance — always visible */}
        <div style={{ marginTop: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 1.5, fontFamily: "'DM Sans', sans-serif" }}>Distance</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.neonBlue, fontFamily: "'DM Sans', sans-serif" }}>{filters.distance} mi</span>
          </div>
          <input type="range" min={1} max={50} value={filters.distance} onChange={e => setFilters(p => ({ ...p, distance: +e.target.value }))}
            style={{ width: "100%", accentColor: COLORS.neonBlue, height: 4 }} />
        </div>

        {/* Category — collapsible, multi-select */}
        <FilterSection label="Category" items={FILTER_CATEGORIES} filters={filters} setFilters={setFilters} type="category" collapsible />

        {/* Sort By — collapsible. Empty sort = Random (the default). Tapping a pill
            toggles it on/off; tapping the active pill returns to Random. */}
        <CollapsibleSection label="Sort By" count={filters.sort ? 1 : 0}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {SORT_OPTIONS.map(s => (
              <GlassPill
                key={s}
                active={filters.sort === s}
                onClick={() => setFilters(prev => ({ ...prev, sort: prev.sort === s ? "" : s }))}
              >{s}</GlassPill>
            ))}
          </div>
        </CollapsibleSection>

        {/* Dynamic tag filter sections — collapsible. Price Range is excluded
            because the dedicated Price selector above already covers it. */}
        {tagCats
          .filter(c => c.name !== "Business Type" && c.scope.includes("business"))
          .filter(c => c.name.toLowerCase() !== "price range")
          .filter(c => !c.requires_food || selectedCatIsFood)
          .map(c => (
            <TagFilterSection key={c.id} label={`${c.icon} ${c.name}`} items={c.tags.map(t => t.name)} filters={filters} setFilters={setFilters} collapsible />
          ))}
        {/* Fallback if DB hasn't loaded yet */}
        {tagCats.length === 0 && (
          <>
            <TagFilterSection label="Cuisine" items={DEFAULT_CUISINE_FILTERS} filters={filters} setFilters={setFilters} collapsible />
            <TagFilterSection label="Vibe & Atmosphere" items={DEFAULT_VIBE_FILTERS} filters={filters} setFilters={setFilters} collapsible />
          </>
        )}

        {/* Apply & Clear buttons */}
        <div style={{ display: "flex", gap: 12, marginTop: 24, paddingBottom: 8, position: "sticky", bottom: 0, background: "rgba(10,10,20,0.95)", backdropFilter: "blur(12px)", paddingTop: 12 }}>
          <button onClick={() => { setFilters({ search: "", topTypes: [], categories: [], price: "Any", sort: "", openNow: false, hasRewards: false, distance: 15, tags: [] }); setShowMyPlacesOnly(false); }} style={{
            flex: 1, padding: "12px 0", borderRadius: 8, fontSize: 13, fontWeight: 700,
            border: `1px solid ${COLORS.cardBorder}`, background: "transparent",
            color: COLORS.textSecondary, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
            transition: "all 0.3s",
          }}>Clear All</button>
          <button onClick={() => { onApply(); setFiltersOpen(false); }} style={{
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
function CollapsibleSection({ label, children, defaultOpen = false, count }: {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  count?: number;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginTop: 16 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
          fontSize: 11, fontWeight: 700, color: COLORS.textSecondary, textTransform: "uppercase",
          letterSpacing: 1.5, fontFamily: "'DM Sans', sans-serif", background: "none", border: "none",
          cursor: "pointer", padding: "8px 0", marginBottom: open ? 10 : 0,
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {label}
          {(count ?? 0) > 0 && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 50,
              background: `${COLORS.neonPink}25`, color: COLORS.neonPink, minWidth: 18, textAlign: "center",
            }}>{count}</span>
          )}
        </span>
        <span style={{ fontSize: 14, color: COLORS.textSecondary, transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
      </button>
      {open && children}
    </div>
  );
}

function FilterSection({ label, items, filters, setFilters, type, collapsible = false }: {
  label: string;
  items: string[];
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  type: "category" | "price";
  collapsible?: boolean;
}) {
  const activeCount = type === "category"
    ? (filters.categories.length > 0 && !(filters.categories.length === 1 && filters.categories[0] === "All") ? filters.categories.length : 0)
    : (filters[type] !== "Any" && filters[type] !== "All" ? 1 : 0);

  const content = (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {items.map(item => {
        const isActive = type === "category"
          ? filters.categories.includes(item) || (item === "All" && filters.categories.length === 0)
          : filters[type] === item;
        return (
          <GlassPill key={item} active={isActive} onClick={() => {
            if (type === "category") {
              if (item === "All") {
                setFilters(p => ({ ...p, categories: [] }));
              } else {
                setFilters(p => {
                  const cats = p.categories.filter(c => c !== "All");
                  return { ...p, categories: cats.includes(item) ? cats.filter(c => c !== item) : [...cats, item] };
                });
              }
            } else {
              setFilters(p => ({ ...p, [type]: item }));
            }
          }} title={type === "price" ? PRICE_TOOLTIPS[item] : undefined}>{item}</GlassPill>
        );
      })}
    </div>
  );

  if (collapsible) {
    return <CollapsibleSection label={label} count={activeCount}>{content}</CollapsibleSection>;
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10, fontFamily: "'DM Sans', sans-serif" }}>{label}</div>
      {content}
    </div>
  );
}

function TagFilterSection({ label, items, filters, setFilters, collapsible = true }: {
  label: string;
  items: string[];
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  collapsible?: boolean;
}) {
  const activeCount = items.filter(t => filters.tags.includes(t)).length;

  const content = (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {items.map(t => (
        <GlassPill key={t} active={filters.tags.includes(t)} onClick={() => setFilters(p => ({
          ...p, tags: p.tags.includes(t) ? p.tags.filter(x => x !== t) : [...p.tags, t],
        }))} style={{ fontSize: 12, padding: "6px 14px" }}>{t}</GlassPill>
      ))}
    </div>
  );

  if (collapsible) {
    return <CollapsibleSection label={label} count={activeCount}>{content}</CollapsibleSection>;
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10, fontFamily: "'DM Sans', sans-serif" }}>{label}</div>
      {content}
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

function LikeButton({ liked, onToggle }: { liked: boolean; onToggle: () => void; }) {
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
  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); }, []);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const siteUrl = "https://www.useletsgo.com";
    const shareText = `Check out ${name} on LetsGo! Discover places and earn cash back.`;
    if (navigator.share) {
      try { await navigator.share({ title: `${name} on LetsGo`, text: shareText, url: siteUrl }); } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(`${shareText} ${siteUrl}`);
      showToast("Link copied to clipboard!");
    }
  };

  return (
    <>
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
      {toast && (
        <div style={{ position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)", zIndex: 99999, background: "rgba(0,0,0,0.9)", color: "#fff", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "12px 16px", boxShadow: "0 4px 24px rgba(0,0,0,0.5)", fontSize: 14, whiteSpace: "nowrap" }}>
          {toast}
        </div>
      )}
    </>
  );
}

// ─── Business Detail Page (slide 2) ───

function BusinessDetailPage({ biz, payoutLevels }: { biz: DiscoveryBusiness; payoutLevels?: { level: number; name: string; visits: string }[] }) {
  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const dayIdx = new Date().getDay();
  const today = dayNames[dayIdx === 0 ? 6 : dayIdx - 1];

  const [showClaimQR, setShowClaimQR] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const claimUrl = biz.claimCode ? `https://www.useletsgo.com/claim/${biz.claimCode}` : null;

  useEffect(() => {
    if (!showClaimQR || !claimUrl) return;
    if (qrDataUrl) return; // already generated
    import("qrcode").then((QRCode) => {
      QRCode.toDataURL(claimUrl, {
        width: 200,
        margin: 2,
        color: { dark: "#ffffffff", light: "#00000000" },
      }).then((url: string) => setQrDataUrl(url));
    });
  }, [showClaimQR, claimUrl, qrDataUrl]);

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
          <p style={{ fontSize: 15, color: COLORS.textSecondary, marginTop: 10, lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif", fontStyle: "italic" }}>&ldquo;{autolink(biz.slogan)}&rdquo;</p>
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

        {biz.isTrial && claimUrl && (
          <div style={{ marginBottom: 20 }}>
            <button
              onClick={() => setShowClaimQR(!showClaimQR)}
              style={{
                width: "100%", padding: "14px 20px", borderRadius: 14,
                background: showClaimQR ? `${COLORS.neonGreen}15` : `${COLORS.neonGreen}08`,
                border: `1px solid ${COLORS.neonGreen}30`,
                color: COLORS.neonGreen, cursor: "pointer",
                fontSize: 14, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                transition: "all 0.2s",
              }}
            >
              <span style={{ fontSize: 18 }}>🏢</span>
              Claim Business as the Owner / Manager
              <span style={{ fontSize: 12, opacity: 0.7, marginLeft: 4 }}>{showClaimQR ? "▲" : "▼"}</span>
            </button>

            {showClaimQR && (
              <div style={{
                marginTop: 12, padding: 24, borderRadius: 14,
                background: COLORS.cardBg, border: `1px solid ${COLORS.cardBorder}`,
                textAlign: "center",
              }}>
                <div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 16, lineHeight: 1.5, fontFamily: "'DM Sans', sans-serif" }}>
                  Scan this QR code with your phone to start the onboarding process and claim this business.
                </div>
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="Claim QR Code" style={{ width: 180, height: 180, margin: "0 auto 16px", display: "block", borderRadius: 8 }} />
                ) : (
                  <div style={{ width: 180, height: 180, margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.textSecondary, fontSize: 13 }}>Generating...</div>
                )}
                <a
                  href={claimUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-block", padding: "8px 20px", borderRadius: 50,
                    background: `${COLORS.neonGreen}12`, border: `1px solid ${COLORS.neonGreen}30`,
                    color: COLORS.neonGreen, fontSize: 12, fontWeight: 600,
                    fontFamily: "'DM Sans', sans-serif", textDecoration: "none",
                  }}
                >
                  Or open claim link →
                </a>
              </div>
            )}
          </div>
        )}

        <div style={{ background: COLORS.cardBg, borderRadius: 16, padding: 20, marginBottom: 20, border: `1px solid ${COLORS.cardBorder}` }}>
          {[
            { icon: "\uD83D\uDCCD", label: "Address", value: biz.address, action: "Get Directions", href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(biz.address)}` },
            { icon: "\uD83D\uDCDE", label: "Phone", value: biz.phone, action: "Call", href: `tel:${biz.phone.replace(/[^+\d]/g, "")}` },
            { icon: "\uD83C\uDF10", label: "Website", value: (() => { try { return new URL(biz.website.startsWith("http") ? biz.website : `https://${biz.website}`).hostname.replace(/^www\./, ""); } catch { return biz.website; } })(), action: "Visit", href: biz.website.startsWith("http") ? biz.website : `https://${biz.website}` },
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

        {biz.isTrial && (
          <div style={{
            margin: "20px 0 12px", padding: 16, borderRadius: 16,
            background: "rgba(255,180,0,0.06)",
            border: "1px solid rgba(255,180,0,0.2)",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#ffb400", marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>
              This business hasn&apos;t joined LetsGo yet
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.5, fontFamily: "'DM Sans', sans-serif" }}>
              Payouts activate when this business claims their profile. Tell them to join next time you visit!
            </div>
          </div>
        )}
        <PayoutLadder rates={biz.payout} levels={payoutLevels || DEFAULT_PAYOUT_LEVELS} />

        <div style={{ textAlign: "center", marginTop: 28, padding: 16, fontSize: 12, color: COLORS.textSecondary, fontFamily: "'DM Sans', sans-serif" }}>
          <span style={{ opacity: 0.5 }}>{"← swipe for photos →"}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Photo Page (slides 3+) ───

function PhotoPage({ image, label, saved, onToggleSave }: {
  image: DiscoveryImage;
  label: string;
  saved: boolean;
  onToggleSave: () => void;
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
            <LikeButton liked={saved} onToggle={onToggleSave} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Photo Page (hero - slide 1) ───

function MainPhotoPage({ biz, saved, onToggleSave, userZip, userCoords, geoReady, followed, onToggleFollow, onOpenChainLocations }: { biz: DiscoveryBusiness; saved: boolean; onToggleSave: () => void; userZip: string; userCoords: [number, number] | null; geoReady: number; followed: boolean; onToggleFollow: () => void; onOpenChainLocations?: (chainId: string, brandName: string) => void }) {
  const distance = useMemo(() => {
    return getBusinessDistance(userCoords, userZip, biz.latitude, biz.longitude, biz.businessZip);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userZip, userCoords, biz.latitude, biz.longitude, biz.businessZip, geoReady]);
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
      {/* Launch banner — only on main photo page */}
      <div style={{ position: "absolute", top: 56, left: 0, right: 0, zIndex: 10, pointerEvents: "none" }}>
        <div style={{ pointerEvents: "auto" }}>
          <LaunchBanner variant="user" />
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "55%", background: "linear-gradient(transparent, rgba(0,0,0,0.85))", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0 24px 36px" }}>
        {biz.isSponsored && (
          <div style={{ marginBottom: 10 }}>
            <span style={{
              padding: "4px 10px", borderRadius: 50, fontSize: 9, fontWeight: 700,
              background: `${COLORS.neonYellow}20`, color: COLORS.neonYellow, border: `1px solid ${COLORS.neonYellow}40`,
              fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: 1.5, backdropFilter: "blur(8px)",
            }}>Sponsored</span>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <h2 style={{ fontSize: "clamp(24px, 7vw, 36px)", fontWeight: 900, color: "#fff", margin: 0, lineHeight: 1.05, fontFamily: "'Dela Gothic One', sans-serif", textShadow: "0 2px 20px rgba(0,0,0,0.6)", letterSpacing: -0.5 }}>{biz.name}</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            <ShareButton name={biz.name} />
            <LikeButton liked={saved} onToggle={onToggleSave} />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
          <FollowButton followed={followed} onToggle={onToggleFollow} />
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
          <span style={{
            padding: "4px 12px", borderRadius: 50, fontSize: 10, fontWeight: 700,
            background: `${COLORS.neonPink}25`, color: COLORS.neonPink, border: `1px solid ${COLORS.neonPink}40`,
            fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: 1, backdropFilter: "blur(8px)",
          }}>{biz.type}</span>
          {biz.chainLocationCount > 1 && biz.chainId && (
            <button
              onClick={(e) => { e.stopPropagation(); onOpenChainLocations?.(biz.chainId!, biz.chainBrandName || biz.name); }}
              style={{
                display: "flex", alignItems: "center", gap: 4, padding: "4px 12px", borderRadius: 50,
                fontSize: 10, fontWeight: 700,
                background: "rgba(191,95,255,0.12)", color: COLORS.neonPurple, border: `1px solid ${COLORS.neonPurple}40`,
                fontFamily: "'DM Sans', sans-serif", backdropFilter: "blur(8px)", cursor: "pointer",
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill={COLORS.neonPurple} stroke="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
              {biz.chainLocationCount - 1} more location{biz.chainLocationCount > 2 ? "s" : ""} →
            </button>
          )}
          {biz.isTrial && (
            <span style={{
              padding: "4px 10px", borderRadius: 50, fontSize: 9, fontWeight: 700,
              background: "rgba(255,180,0,0.15)", color: "#ffb400", border: "1px solid rgba(255,180,0,0.3)",
              fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: 1.5, backdropFilter: "blur(8px)",
            }}>Unclaimed</span>
          )}
        </div>
        {biz.isTrial ? (
          <div style={{
            display: "flex", alignItems: "center", gap: 10, marginTop: 16,
            padding: "8px 14px", borderRadius: 50,
            background: "rgba(255,180,0,0.08)", border: "1px solid rgba(255,180,0,0.18)",
            backdropFilter: "blur(8px)", width: "fit-content",
          }}>
            <span style={{ fontSize: 14 }}>🔓</span>
            <span style={{
              fontSize: 12, fontWeight: 700, color: "#ffb400",
              fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.02em",
            }}>
              Rewards not yet active
            </span>
          </div>
        ) : biz.payout.length > 0 ? (() => {
          const minP = Math.min(...biz.payout);
          const maxP = Math.max(...biz.payout);
          const rangeStr = minP === maxP ? `${minP}%` : `${minP}% – ${maxP}%`;
          return (
            <div style={{
              display: "flex", alignItems: "center", gap: 10, marginTop: 16,
              padding: "8px 14px", borderRadius: 50,
              background: "rgba(57,255,20,0.08)", border: "1px solid rgba(57,255,20,0.18)",
              backdropFilter: "blur(8px)", width: "fit-content",
            }}>
              <span style={{ fontSize: 14 }}>💰</span>
              <span style={{
                fontSize: 12, fontWeight: 700, color: COLORS.neonGreen,
                fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.02em",
              }}>
                Earn {rangeStr} back
              </span>
            </div>
          );
        })() : null}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 16, animation: "pulseGlow 2s ease-in-out infinite" }}>
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

function BusinessCard({ biz, userZip, userCoords, geoReady, payoutLevels, saved, onToggleSave, followed, onToggleFollow, onOpenChainLocations }: { biz: DiscoveryBusiness; userZip: string; userCoords: [number, number] | null; geoReady: number; payoutLevels?: { level: number; name: string; visits: string }[]; saved: boolean; onToggleSave: () => void; followed: boolean; onToggleFollow: () => void; onOpenChainLocations?: (chainId: string, brandName: string) => void }) {
  const [currentPage, setCurrentPage] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
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
          <MainPhotoPage biz={biz} saved={saved} onToggleSave={onToggleSave} userZip={userZip} userCoords={userCoords} geoReady={geoReady} followed={followed} onToggleFollow={onToggleFollow} onOpenChainLocations={onOpenChainLocations} />
        </div>
        {/* Slide 2: Detail page */}
        <div style={{ width: `${100 / totalPages}%`, height: "100%", flexShrink: 0, overflow: "hidden" }}>
          <BusinessDetailPage biz={biz} payoutLevels={payoutLevels} />
        </div>
        {/* Slides 3+: Additional photos */}
        {extraPhotos.map((img, i) => (
          <div key={i} style={{ width: `${100 / totalPages}%`, height: "100%", flexShrink: 0, overflow: "hidden" }}>
            <PhotoPage image={img} label={biz.name} saved={saved} onToggleSave={onToggleSave} />
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

export default function DiscoveryPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-b from-black via-slate-950 to-slate-900" />}>
      <DiscoveryPage />
    </Suspense>
  );
}

function DiscoveryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const spotlightId = searchParams.get("spotlight");
  const [businesses, setBusinesses] = useState<DiscoveryBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [error, setError] = useState("");
  const [discoverPage, setDiscoverPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalBizCount, setTotalBizCount] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    search: "", topTypes: [], categories: [], price: "Any", sort: "", openNow: false, hasRewards: false, distance: 15, tags: [],
  });
  // Stable session seed for random ordering of the discovery feed. Generated once
  // per app load — refreshes only when the user revisits, so they don't see the
  // same businesses on top every time they open the app.
  const [sessionSeed] = useState<string>(() => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  });
  const [currentBiz, setCurrentBiz] = useState(0);
  const [locationZip, setLocationZip] = useState("68102");
  const [locationCoords, setLocationCoords] = useState<[number, number] | null>([41.2565, -95.9345]); // default Omaha
  const verticalRef = useRef<HTMLDivElement>(null);
  const [geoReady, setGeoReady] = useState(0); // increments when geocoding completes, triggers distance recalc
  const [payoutLevels, setPayoutLevels] = useState(DEFAULT_PAYOUT_LEVELS);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [showMyPlacesOnly, setShowMyPlacesOnly] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); }, []);
  const GMAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  // Chain locations panel
  const [chainLocationsOpen, setChainLocationsOpen] = useState(false);
  const [chainLocations, setChainLocations] = useState<{ id: string; name: string; storeNumber: string; address: string; zip: string }[]>([]);
  const [chainLocationsLoading, setChainLocationsLoading] = useState(false);
  const [chainLocationsBrand, setChainLocationsBrand] = useState("");
  const [chainDetailBiz, setChainDetailBiz] = useState<DiscoveryBusiness | null>(null);
  const [chainDetailLoading, setChainDetailLoading] = useState(false);
  const [chainSort, setChainSort] = useState<"nearest" | "farthest" | "store">("nearest");

  const openChainLocations = useCallback(async (chainId: string, brandName: string) => {
    setChainLocationsBrand(brandName);
    setChainLocationsOpen(true);
    setChainLocationsLoading(true);
    setChainDetailBiz(null);
    try {
      const res = await fetch(`/api/chains/${chainId}/locations`);
      if (res.ok) {
        const data = await res.json();
        setChainLocations(data.locations || []);
      }
    } catch { /* silent */ }
    setChainLocationsLoading(false);
  }, []);

  const openChainLocationDetail = useCallback(async (businessId: string) => {
    setChainDetailLoading(true);
    try {
      const params = new URLSearchParams({ search: "", page: "1", limit: "1" });
      // Fetch the specific business + its media/tiers
      const [bizRes, mediaRes, tierRes] = await Promise.all([
        supabaseBrowser.from("business").select("*").eq("id", businessId).maybeSingle(),
        supabaseBrowser.from("business_media").select("business_id, bucket, path, sort_order, caption, meta").eq("business_id", businessId).eq("is_active", true).eq("media_type", "photo").order("sort_order", { ascending: true }).limit(20),
        supabaseBrowser.from("business_payout_tiers").select("business_id, percent_bps, tier_index").eq("business_id", businessId).order("tier_index", { ascending: true }),
      ]);
      if (bizRes.data) {
        const row = bizRes.data as BusinessRow;
        const mediaRows = (mediaRes.data || []) as MediaRow[];
        const tableBps = (tierRes.data || []).map((t: Record<string, unknown>) => t.percent_bps as number);
        const normalized = normalizeToDiscoveryBusiness(row, mediaRows, tableBps);
        setChainDetailBiz(normalized);
      }
    } catch { /* silent */ }
    setChainDetailLoading(false);
  }, []);

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

  // Redirect unauthenticated users to Welcome page
  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabaseBrowser.auth.getSession();
        if (!session) { router.replace("/welcome"); return; }
        setAuthChecked(true);
      } catch { router.replace("/welcome"); }
    })();
  }, [router]);

  const getUserId = useCallback((): string | null => {
    try {
      const raw = localStorage.getItem("letsgo-auth");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.user?.id || parsed?.id || null;
    } catch { return null; }
  }, []);

  const getAuthToken = useCallback(async (): Promise<string | null> => {
    const { data: { session } } = await supabaseBrowser.auth.getSession();
    return session?.access_token ?? null;
  }, []);

  // Load user's location: try browser GPS first, fall back to profile zip centroid
  useEffect(() => {
    // 1. Load profile zip as initial fallback
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

    // 2. Request browser geolocation (overrides zip centroid if granted)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocationCoords([pos.coords.latitude, pos.coords.longitude]);
        },
        () => { /* denied or unavailable — keep zip centroid */ },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
      );
    }
  }, []);

  // Fetch platform settings (visit thresholds) on mount
  useEffect(() => {
    fetchPlatformTierConfig(supabaseBrowser).then((cfg) => {
      setPayoutLevels(buildPayoutLevels(cfg.visitThresholds));
    });
  }, []);

  // Fetch saved + followed businesses on mount
  useEffect(() => {
    const userId = getUserId();
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getAuthToken();
        if (!token) return;
        const res = await fetch(`/api/businesses/follow?userId=${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          if (Array.isArray(data.savedBusinessIds)) {
            setSavedIds(new Set(data.savedBusinessIds as string[]));
          }
          if (Array.isArray(data.followedBusinessIds)) {
            setFollowedIds(new Set(data.followedBusinessIds as string[]));
          }
        }
      } catch { /* silent — non-critical */ }
    })();
    return () => { cancelled = true; };
  }, [getUserId, getAuthToken]);

  const handleToggleSave = useCallback(async (businessId: string) => {
    const userId = getUserId();
    if (!userId) {
      showToast("Please log in to save businesses.");
      return;
    }
    const wasSaved = savedIds.has(businessId);
    // Optimistic update: unsave removes both saved + followed
    setSavedIds(prev => {
      const next = new Set(prev);
      if (wasSaved) next.delete(businessId); else next.add(businessId);
      return next;
    });
    if (wasSaved) {
      setFollowedIds(prev => {
        const next = new Set(prev);
        next.delete(businessId);
        return next;
      });
    }
    try {
      const token = await getAuthToken();
      if (!token) { showToast("Please log in to save businesses."); return; }
      const res = await fetch("/api/businesses/save", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ businessId }),
      });
      if (!res.ok) {
        // Revert
        setSavedIds(prev => {
          const next = new Set(prev);
          if (wasSaved) next.add(businessId); else next.delete(businessId);
          return next;
        });
        if (wasSaved) {
          // Can't reliably know if was following, so re-fetch
          // For now just revert saved; follow state will correct on next load
        }
      }
    } catch {
      setSavedIds(prev => {
        const next = new Set(prev);
        if (wasSaved) next.add(businessId); else next.delete(businessId);
        return next;
      });
    }
  }, [savedIds, getUserId, getAuthToken, showToast]);

  const handleToggleFollow = useCallback(async (businessId: string) => {
    const userId = getUserId();
    if (!userId) {
      showToast("Please log in to follow businesses.");
      return;
    }
    const wasFollowed = followedIds.has(businessId);
    // Optimistic update: follow auto-saves, unfollow keeps saved
    setFollowedIds(prev => {
      const next = new Set(prev);
      if (wasFollowed) next.delete(businessId); else next.add(businessId);
      return next;
    });
    if (!wasFollowed) {
      // Follow auto-saves
      setSavedIds(prev => {
        const next = new Set(prev);
        next.add(businessId);
        return next;
      });
    }
    try {
      const token = await getAuthToken();
      if (!token) { showToast("Please log in to follow businesses."); return; }
      const res = await fetch("/api/businesses/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ businessId }),
      });
      if (!res.ok) {
        setFollowedIds(prev => {
          const next = new Set(prev);
          if (wasFollowed) next.add(businessId); else next.delete(businessId);
          return next;
        });
        if (!wasFollowed) {
          setSavedIds(prev => {
            const next = new Set(prev);
            next.delete(businessId);
            return next;
          });
        }
      }
    } catch {
      setFollowedIds(prev => {
        const next = new Set(prev);
        if (wasFollowed) next.add(businessId); else next.delete(businessId);
        return next;
      });
    }
  }, [followedIds, getUserId, getAuthToken, showToast]);

  // Fetch a page of businesses from the paginated API
  const fetchDiscoverPage = useCallback(async (
    pageNum: number,
    currentFilters: FilterState,
    append: boolean,
    followedOnly: boolean,
  ) => {
    if (append) setLoadingMore(true);
    else { setLoading(true); setError(""); }

    try {
      const params = new URLSearchParams({ page: String(pageNum), limit: "50" });
      if (currentFilters.search.trim()) params.set("search", currentFilters.search.trim());
      if (currentFilters.topTypes.length > 0) params.set("topType", currentFilters.topTypes.join(","));
      if (currentFilters.categories.length > 0) params.set("category", currentFilters.categories.join(","));
      if (currentFilters.price !== "Any") params.set("price", currentFilters.price);
      if (currentFilters.openNow) params.set("openNow", "true");
      if (currentFilters.hasRewards) params.set("hasRewards", "true");
      if (currentFilters.tags.length > 0) params.set("tags", currentFilters.tags.join(","));
      // Sort: empty = Random (server seeded shuffle). Anything else is a user override.
      if (currentFilters.sort) params.set("sort", currentFilters.sort);
      // Session seed makes the random ordering stable across pagination + re-fetches
      // within a single session, but fresh on the next app open.
      params.set("seed", sessionSeed);
      // Pass user coordinates for the server-side Nearest sort + distance filter.
      if (locationCoords) {
        params.set("userLat", String(locationCoords[0]));
        params.set("userLng", String(locationCoords[1]));
      }
      if (locationZip) params.set("userZip", locationZip);
      if (currentFilters.distance > 0) {
        params.set("distance", String(currentFilters.distance));
      }
      if (followedOnly) {
        const uid = getUserId();
        if (uid) {
          params.set("followed", "true");
          params.set("userId", uid);
        }
      }

      const res = await fetch(`/api/businesses/discover?${params}`);
      if (!res.ok) throw new Error("Failed to load businesses");
      const data = await res.json();

      const rows = (data.businesses ?? []) as BusinessRow[];
      const mediaRows = (data.media ?? []) as MediaRow[];
      const tierRows = (data.tiers ?? []) as { business_id: string; percent_bps: number }[];
      const sponsoredIds = new Set<string>(data.sponsoredIds ?? []);

      // Group media by business_id
      const mediaMap = new Map<string, MediaRow[]>();
      for (const m of mediaRows) {
        const existing = mediaMap.get(m.business_id) ?? [];
        existing.push(m);
        mediaMap.set(m.business_id, existing);
      }

      // Group payout tiers by business_id
      const tierMap = new Map<string, number[]>();
      for (const t of tierRows) {
        if (!tierMap.has(t.business_id)) tierMap.set(t.business_id, []);
        tierMap.get(t.business_id)!.push(Number(t.percent_bps) || 0);
      }

      // Normalize
      const normalized = rows.map(row =>
        normalizeToDiscoveryBusiness(row, mediaMap.get(row.id) ?? [], tierMap.get(row.id))
      );

      // Mark sponsored
      for (const biz of normalized) {
        if (sponsoredIds.has(biz.id)) biz.isSponsored = true;
      }

      if (append) {
        // Deduplicate when appending
        setBusinesses(prev => {
          const existingIds = new Set(prev.map(b => b.id));
          const newBiz = normalized.filter(b => !existingIds.has(b.id));
          return [...prev, ...newBiz];
        });
      } else {
        // Server returns rows already ordered (Spotlights pinned, then sorted/shuffled).
        // Trust that order — don't re-sort or re-shuffle here.
        setBusinesses(normalized);
      }

      setHasMore(data.hasMore ?? false);
      setTotalBizCount(data.total ?? 0);
      setDiscoverPage(pageNum);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load businesses.";
      if (!append) { setError(msg); setBusinesses([]); }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [locationCoords, locationZip, getUserId, sessionSeed]);

  // Load saved filter preferences, then do initial fetch
  useEffect(() => {
    (async () => {
      const token = await getAuthToken();
      const saved = await loadFilterPreferences(token);
      if (saved) {
        const merged = { ...filters, ...saved, search: "" };
        setFilters(merged);
        fetchDiscoverPage(1, merged, false, showMyPlacesOnly);
      } else {
        fetchDiscoverPage(1, filters, false, showMyPlacesOnly);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply filters: only re-fetch when user clicks "Apply Filters" (not on every click)
  const handleApplyFilters = useCallback(() => {
    setCurrentBiz(0);
    if (verticalRef.current) verticalRef.current.scrollTop = 0;
    fetchDiscoverPage(1, filters, false, showMyPlacesOnly);
  }, [filters, showMyPlacesOnly, fetchDiscoverPage]);

  // Re-fetch when browser geolocation resolves (coords changed from zip centroid to real GPS)
  const prevCoordsRef = useRef(locationCoords);
  useEffect(() => {
    if (prevCoordsRef.current === locationCoords) return;
    prevCoordsRef.current = locationCoords;
    // Only re-fetch if we already have businesses loaded (not initial load)
    if (businesses.length > 0) {
      fetchDiscoverPage(1, filters, false, showMyPlacesOnly);
    }
  }, [locationCoords, businesses.length, filters, showMyPlacesOnly, fetchDiscoverPage]);

  // Debounced search: auto-fetch when user types in search (no Apply needed)
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const prevSearchRef = useRef(filters.search);
  useEffect(() => {
    if (filters.search === prevSearchRef.current) return;
    prevSearchRef.current = filters.search;
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setCurrentBiz(0);
      if (verticalRef.current) verticalRef.current.scrollTop = 0;
      fetchDiscoverPage(1, filters, false, showMyPlacesOnly);
    }, 500);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [filters.search, filters, showMyPlacesOnly, fetchDiscoverPage]);

  // Client-side filtering (only for things not handled server-side: openNow, sort, spotlight)
  const filteredBusinesses = useMemo(() => {
    // Spotlight mode: show only the spotlighted business
    if (spotlightId) {
      const match = businesses.filter(b => b.id === spotlightId);
      if (match.length > 0) return match;
    }

    let result = businesses;

    // Distance filter — uses GPS coordinates when available, falls back to zip lookup
    if (locationZip || locationCoords) {
      result = result.filter(b => {
        const dist = getBusinessDistance(locationCoords, locationZip, b.latitude, b.longitude, b.businessZip);
        if (dist !== null && dist > filters.distance) return false;
        return true;
      });
    }

    // Category subtype filter — server filters by broad category_main,
    // client narrows to the specific subtype (e.g. "Coffee" within "restaurant_bar")
    if (filters.categories.length > 0 && !filters.categories.includes("All")) {
      result = result.filter(b => {
        const hay = `${b.type} ${b.tags.join(" ")} ${b.vibe}`.toLowerCase();
        return filters.categories.some(cat => hay.includes(cat.toLowerCase()));
      });
    }

    // Open now is real-time client-side (depends on current time + hours)
    if (filters.openNow) {
      result = result.filter(b => b.isOpen);
    }

    // Has Rewards — hide seeded/trial businesses with no real payouts
    if (filters.hasRewards) {
      result = result.filter(b => !b.isTrial);
    }

    // Tags are partially server-side but also refine client-side for subtype matching
    if (filters.tags.length > 0) {
      result = result.filter(b => {
        const hay = `${b.name} ${b.type} ${b.vibe} ${b.tags.join(" ")}`.toLowerCase();
        return filters.tags.some(t => hay.includes(t.toLowerCase()));
      });
    }

    // Sort happens server-side — Spotlights pinned first, then Random (with session
    // seed) / Nearest / Newest / Highest Payout. Client trusts server order.

    return result;
  }, [businesses, filters, spotlightId, locationZip, locationCoords]);

  // Infinite scroll: load more when user swipes near the end
  const handleVerticalScroll = useCallback(() => {
    if (!verticalRef.current) return;
    const { scrollTop, clientHeight } = verticalRef.current;
    const newBiz = Math.round(scrollTop / clientHeight);
    setCurrentBiz(newBiz);

    // Prefetch next page when within 10 businesses of the end
    if (hasMore && !loadingMore && newBiz >= businesses.length - 10) {
      fetchDiscoverPage(discoverPage + 1, filters, true, showMyPlacesOnly);
    }
  }, [hasMore, loadingMore, businesses.length, discoverPage, filters, showMyPlacesOnly, fetchDiscoverPage]);

  if (!authChecked) return <div style={{ minHeight: "100vh", background: COLORS.darkBg }} />;

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
      <FilterBar filtersOpen={filtersOpen} setFiltersOpen={setFiltersOpen} filters={filters} setFilters={setFilters} locationZip={locationZip} onLocationZipChange={setLocationZip} onLocationCoordsChange={setLocationCoords} showMyPlacesOnly={showMyPlacesOnly} setShowMyPlacesOnly={setShowMyPlacesOnly} myPlacesCount={savedIds.size} onApply={handleApplyFilters} />

      {/* LaunchBanner is rendered inside MainPhotoPage (page 1 only) */}

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
              <BusinessCard biz={biz} userZip={locationZip} userCoords={locationCoords} geoReady={geoReady} payoutLevels={payoutLevels} saved={savedIds.has(biz.id)} onToggleSave={() => handleToggleSave(biz.id)} followed={followedIds.has(biz.id)} onToggleFollow={() => handleToggleFollow(biz.id)} onOpenChainLocations={openChainLocations} />
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

      {/* Chain Locations Panel */}
      {chainLocationsOpen && (
        <>
          <div onClick={() => setChainLocationsOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 99990 }} />
          <div style={{
            position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 99991,
            maxHeight: "70vh", overflowY: "auto",
            background: "linear-gradient(180deg, #12121f 0%, #0a0a14 100%)",
            borderTop: `2px solid ${COLORS.neonPurple}40`,
            borderRadius: "20px 20px 0 0",
            padding: "20px 20px 32px",
            animation: "chainPanelSlideUp 0.3s ease-out",
          }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)", margin: "0 auto 16px" }} />

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {chainDetailBiz && (
                  <button
                    onClick={() => { setChainDetailBiz(null); }}
                    style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 8, padding: "6px 10px", cursor: "pointer", color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}
                  >
                    ← All
                  </button>
                )}
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "'DM Sans', sans-serif", color: "#fff" }}>
                    {chainDetailBiz ? chainDetailBiz.name : chainLocationsBrand}
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
                    {chainDetailBiz ? chainDetailBiz.address : `${chainLocations.length} locations`}
                  </div>
                </div>
              </div>
              <button onClick={() => { setChainLocationsOpen(false); setChainDetailBiz(null); }} style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "rgba(255,255,255,0.4)", fontSize: 16 }}>
                ✕
              </button>
            </div>

            {/* Detail view for selected location */}
            {chainDetailBiz ? (
              <div style={{ marginLeft: -20, marginRight: -20, marginBottom: -32 }}>
                <BusinessDetailPage biz={chainDetailBiz} payoutLevels={payoutLevels} />
              </div>
            ) : chainDetailLoading ? (
              <div style={{ textAlign: "center", padding: 32, color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Loading location details...</div>
            ) : chainLocationsLoading ? (
              <div style={{ textAlign: "center", padding: 32, color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Loading locations...</div>
            ) : (
              <>
                {/* Sort pills */}
                <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                  {([["nearest", "Nearest"], ["farthest", "Farthest"], ["store", "Store #"]] as const).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setChainSort(key)}
                      style={{
                        padding: "6px 14px", borderRadius: 50, border: "none", cursor: "pointer",
                        fontSize: 11, fontWeight: chainSort === key ? 700 : 500,
                        background: chainSort === key ? `${COLORS.neonPurple}25` : "rgba(255,255,255,0.04)",
                        color: chainSort === key ? COLORS.neonPurple : "rgba(255,255,255,0.35)",
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[...chainLocations].sort((a, b) => {
                  if (chainSort === "store") return parseInt(a.storeNumber || "0") - parseInt(b.storeNumber || "0");
                  const distA = locationCoords && a.zip ? (ZIP_COORDS[a.zip] ? haversineDistance(locationCoords[0], locationCoords[1], ZIP_COORDS[a.zip][0], ZIP_COORDS[a.zip][1]) : 9999) : 9999;
                  const distB = locationCoords && b.zip ? (ZIP_COORDS[b.zip] ? haversineDistance(locationCoords[0], locationCoords[1], ZIP_COORDS[b.zip][0], ZIP_COORDS[b.zip][1]) : 9999) : 9999;
                  return chainSort === "farthest" ? distB - distA : distA - distB;
                }).map((loc) => {
                  const dist = locationCoords && loc.zip ? (() => {
                    const bizCoords = ZIP_COORDS[loc.zip];
                    if (bizCoords) return haversineDistance(locationCoords[0], locationCoords[1], bizCoords[0], bizCoords[1]);
                    if (locationZip && loc.zip) return getDistanceBetweenZips(locationZip, loc.zip);
                    return null;
                  })() : null;
                  return (
                    <button key={loc.id} onClick={() => openChainLocationDetail(loc.id)} style={{ padding: "14px 16px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left", width: "100%", transition: "background 0.15s", color: "inherit" }} onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.06)"} onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0, background: `${COLORS.neonPurple}15`, border: `1px solid ${COLORS.neonPurple}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: COLORS.neonPurple, fontFamily: "'DM Sans', sans-serif" }}>
                        #{loc.storeNumber}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{loc.address}</div>
                      </div>
                      {dist !== null && (
                        <div style={{ flexShrink: 0, padding: "4px 10px", borderRadius: 50, background: "rgba(0,212,255,0.08)", fontSize: 11, fontWeight: 700, color: COLORS.neonBlue, fontFamily: "'DM Sans', sans-serif" }}>
                          {dist < 0.1 ? "<0.1" : dist.toFixed(1)} mi
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              </>
            )}
          </div>
        </>
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)", zIndex: 99999, background: "rgba(0,0,0,0.9)", color: "#fff", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "12px 16px", boxShadow: "0 4px 24px rgba(0,0,0,0.5)", fontSize: 14, whiteSpace: "nowrap" }}>
          {toast}
        </div>
      )}

      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { display: none; }
        @keyframes pulseGlow { 0%,100% { opacity: 0.4; } 50% { opacity: 0.8; } }
        @keyframes chainPanelSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
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
