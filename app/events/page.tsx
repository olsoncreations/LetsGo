"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getDistanceBetweenZips, ZIP_COORDS, haversineDistance } from "@/lib/zipUtils";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import NotificationBell from "@/components/NotificationBell";
import OnboardingTooltip from "@/components/OnboardingTooltip";
import { useOnboardingTour, type TourStep } from "@/lib/useOnboardingTour";
import { EventCalendarAnim, FilterAnim, EventCardAnim } from "@/components/TourIllustrations";
import { fetchPlatformTierConfig, getVisitRangeLabel, DEFAULT_VISIT_THRESHOLDS, type VisitThreshold } from "@/lib/platformSettings";
import { fetchTagsByCategory, type TagCategory } from "@/lib/availableTags";

// ═══════════════════════════════════════════════════════════════
// LETSGO — EVENTS PAGE v2
// Neon: #D050FF  ·  RGB: 208,80,255  ·  Icon: ◈
// ═══════════════════════════════════════════════════════════════

const NEON = "#D050FF";
const NEON_RGB = "208,80,255";
const BG = "#060610";
const CARD_BG = "#0C0C14";
const CARD_BORDER = "rgba(255,255,255,0.06)";
const TEXT_PRIMARY = "#fff";
const TEXT_DIM = "rgba(255,255,255,0.4)";
const TEXT_MUTED = "rgba(255,255,255,0.2)";
const PINK = "#FF2D78";
const PINK_RGB = "255,45,120";
const GREEN = "#00FF87";
const GREEN_RGB = "0,255,135";
const YELLOW = "#FFD600";
const BLUE = "#00E5FF";

const FONT_DISPLAY = "'Clash Display', 'DM Sans', sans-serif";
const FONT_BODY = "'DM Sans', sans-serif";

// ── Types ────────────────────────────────────────────────────
type BusinessHours = { day: string; time: string };

type EventBusiness = {
  name: string;
  type: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  website: string;
  hours: BusinessHours[];
};

type Event = {
  id: string;
  businessId: string;
  title: string;
  description: string;
  date: string;        // "YYYY-MM-DD"
  startAt: string;     // ISO string
  time: string;        // "7:00 PM"
  endTime: string;     // "10:00 PM"
  business: EventBusiness;
  category: string;
  price: string;
  priceLevel: string;
  tags: string[];
  imageUrl: string | null;
  attendees: { yes: number; maybe: number; no: number };
  capacity: number | null;
  bookingUrl: string | null;
  payoutRange: string;
  payoutTiers: number[];
  viewCount: number;
  // Computed client-side
  dist?: string;       // e.g. "1.2 mi"
  distMiles?: number;
};

type Filters = {
  category: string;
  date: string;
  dateFrom: string;
  dateTo: string;
  price: string;
  distance: string;
  timeOfDay: string;
  capacity: string;
  vibes: string[];
  sort: string;
  search: string;
};

// ── Filter Options (fallbacks if DB fetch fails) ──────────
const DEFAULT_EVENT_CATEGORIES = [
  { id: "all", label: "All Events", icon: "◈" },
  { id: "Music", label: "Music", icon: "🎵" },
  { id: "Games", label: "Games", icon: "🎯" },
  { id: "Food & Drink", label: "Food & Drink", icon: "🍽️" },
  { id: "Workshop", label: "Workshop", icon: "🛠️" },
  { id: "Special Event", label: "Special Event", icon: "✨" },
  { id: "Sports", label: "Sports", icon: "⚽" },
  { id: "Arts & Crafts", label: "Arts & Crafts", icon: "🎨" },
  { id: "Other", label: "Other", icon: "📌" },
];

const DATE_FILTERS = [
  { id: "all", label: "Any Date" },
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "this-week", label: "This Week" },
  { id: "this-weekend", label: "This Weekend" },
  { id: "next-week", label: "Next Week" },
  { id: "this-month", label: "This Month" },
  { id: "custom", label: "Custom Range" },
];

const PRICE_FILTERS = [
  { id: "all", label: "Any Price" },
  { id: "free", label: "Free" },
  { id: "$", label: "$" },
  { id: "$$", label: "$$" },
  { id: "$$$", label: "$$$" },
  { id: "$$$$", label: "$$$$" },
];

const DISTANCE_FILTERS = [
  { id: "all", label: "Any Distance" },
  { id: "0.5", label: "< 0.5 mi" },
  { id: "1", label: "< 1 mi" },
  { id: "2", label: "< 2 mi" },
  { id: "5", label: "< 5 mi" },
  { id: "10", label: "< 10 mi" },
  { id: "25", label: "< 25 mi" },
];

const DEFAULT_VIBE_FILTERS = [
  "Date Night", "Girls Night", "Guys Night", "Family Friendly", "21+", "Outdoor",
  "Intimate", "High Energy", "Chill", "Upscale", "Casual", "Trendy",
  "Rooftop", "Late Night", "Day Event", "Beginner Friendly",
  "VIP Available", "Food Included", "Drink Specials", "Live Entertainment",
  "Interactive", "Competition", "Networking", "Educational",
];

const SORT_OPTIONS = [
  { id: "date-asc", label: "Soonest First" },
  { id: "date-desc", label: "Latest First" },
  { id: "popular", label: "Most Popular" },
  { id: "nearest", label: "Nearest" },
  { id: "price-asc", label: "Price: Low → High" },
  { id: "price-desc", label: "Price: High → Low" },
];

const TIME_OF_DAY_FILTERS = [
  { id: "all", label: "Any Time" },
  { id: "morning", label: "Morning (6a–12p)" },
  { id: "afternoon", label: "Afternoon (12p–5p)" },
  { id: "evening", label: "Evening (5p–9p)" },
  { id: "night", label: "Night (9p+)" },
];

const CAPACITY_FILTERS = [
  { id: "all", label: "Any Size" },
  { id: "intimate", label: "Intimate (< 25)" },
  { id: "small", label: "Small (25–75)" },
  { id: "medium", label: "Medium (75–200)" },
  { id: "large", label: "Large (200+)" },
];

// Category → gradient fallback (when no image)
const CATEGORY_GRADIENTS: Record<string, string> = {
  "Music": "linear-gradient(135deg, #1a003a 0%, #4a0e8f 40%, #7b2ff2 70%, #d050ff 100%)",
  "Games": "linear-gradient(135deg, #1a1a0a 0%, #3d3a1a 40%, #6b6421 70%, #c9b83a 100%)",
  "Food & Drink": "linear-gradient(135deg, #0a280a 0%, #1a5c1a 40%, #3ad93a 70%, #87ff87 100%)",
  "Workshop": "linear-gradient(135deg, #0a1a0a 0%, #1a3d1a 40%, #21a84a 70%, #50ff87 100%)",
  "Special Event": "linear-gradient(135deg, #1a0a2e 0%, #3d1a6e 40%, #6b21a8 70%, #a855f7 100%)",
  "Sports": "linear-gradient(135deg, #0a1628 0%, #1a3a5c 40%, #4a90d9 70%, #87c5ff 100%)",
  "Arts & Crafts": "linear-gradient(135deg, #0a0a28 0%, #1a1a5c 40%, #3a3ad9 70%, #7b7bff 100%)",
  "Other": "linear-gradient(135deg, #1a0a1a 0%, #3a1a3a 40%, #6b3a6b 70%, #a05fa0 100%)",
};

const CATEGORY_ICONS: Record<string, string> = {
  "Music": "🎵", "Games": "🎯", "Food & Drink": "🍽️", "Workshop": "🛠️",
  "Special Event": "✨", "Sports": "⚽", "Arts & Crafts": "🎨", "Other": "📌",
};

// ── Global Keyframes ────────────────────────────────────────
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&display=swap');

    @keyframes borderTravelPurple {
      0% { background-position: 0% 50%; }
      100% { background-position: 300% 50%; }
    }
    @keyframes neonFlickerPurple {
      0%, 100% { text-shadow: 0 0 8px ${NEON}90, 0 0 20px ${NEON}50; }
      5% { text-shadow: 0 0 4px ${NEON}40, 0 0 10px ${NEON}20; }
      6% { text-shadow: 0 0 8px ${NEON}90, 0 0 20px ${NEON}50; }
      45% { text-shadow: 0 0 8px ${NEON}90, 0 0 20px ${NEON}50; }
      46% { text-shadow: 0 0 2px ${NEON}30, 0 0 6px ${NEON}15; }
      48% { text-shadow: 0 0 8px ${NEON}90, 0 0 20px ${NEON}50; }
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(24px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes toastIn {
      from { opacity: 0; transform: translateX(-50%) translateY(8px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    @keyframes pulseGlow {
      0%, 100% { box-shadow: 0 0 8px rgba(${NEON_RGB}, 0.3), 0 0 20px rgba(${NEON_RGB}, 0.1); }
      50% { box-shadow: 0 0 16px rgba(${NEON_RGB}, 0.5), 0 0 40px rgba(${NEON_RGB}, 0.2); }
    }
    @keyframes marqueeScroll {
      from { transform: translateX(0); }
      to { transform: translateX(-50%); }
    }
    @keyframes floatUp {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-6px); }
    }
    @keyframes votePopIn {
      0% { transform: scale(0.85); opacity: 0; }
      60% { transform: scale(1.05); }
      100% { transform: scale(1); opacity: 1; }
    }
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: ${BG}; }

    ::-webkit-scrollbar { width: 4px; height: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(${NEON_RGB}, 0.2); border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: rgba(${NEON_RGB}, 0.4); }
  `}</style>
);

// ── Shared Components ───────────────────────────────────────
const MarqueeBanner = ({ text }: { text: string }) => {
  const content = `${text}     ◈     ${text}     ◈     ${text}     ◈     `;
  return (
    <div style={{ overflow: "hidden", whiteSpace: "nowrap", padding: "10px 0", borderTop: `1px solid ${CARD_BORDER}`, borderBottom: `1px solid ${CARD_BORDER}`, margin: "0 -28px 28px" }}>
      <div style={{ display: "inline-block", animation: "marqueeScroll 30s linear infinite" }}>
        <span style={{ fontSize: 11, color: TEXT_MUTED, letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 600, fontFamily: FONT_BODY }}>{content}</span>
        <span style={{ fontSize: 11, color: TEXT_MUTED, letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 600, fontFamily: FONT_BODY }}>{content}</span>
      </div>
    </div>
  );
};

const DotGrid = ({ opacity = 0.04 }: { opacity?: number }) => (
  <div style={{ position: "absolute", inset: 0, opacity, backgroundImage: `radial-gradient(circle, ${NEON} 1px, transparent 1px)`, backgroundSize: "24px 24px", backgroundPosition: "12px 12px", pointerEvents: "none" }} />
);

const SectionLabel = ({ text }: { text: string }) => (
  <div style={{
    display: "inline-block", fontFamily: FONT_BODY, fontSize: 10, fontWeight: 700,
    letterSpacing: "0.2em", color: NEON, marginBottom: 12, padding: "4px 0",
    borderBottom: `1px solid ${NEON}40`, animation: "neonFlickerPurple 12s ease-in-out infinite",
  }}>{"◈"} {text}</div>
);

const NeonBtn = ({ children, onClick, variant = "outline", disabled = false, style: sx = {} }: {
  children: React.ReactNode; onClick?: () => void; variant?: "outline" | "filled"; disabled?: boolean; style?: React.CSSProperties;
}) => {
  const [h, setH] = useState(false);
  const f = variant === "filled";
  return (
    <button onClick={disabled ? undefined : onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} disabled={disabled}
      style={{
        fontFamily: FONT_BODY, fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase",
        padding: "10px 22px", borderRadius: 3, cursor: disabled ? "not-allowed" : "pointer", transition: "all 0.3s ease",
        border: f ? "none" : `1px solid rgba(${NEON_RGB}, ${h && !disabled ? 0.8 : 0.3})`,
        background: f ? (h && !disabled ? NEON : `rgba(${NEON_RGB}, 0.85)`) : (h && !disabled ? `rgba(${NEON_RGB}, 0.1)` : "transparent"),
        color: f ? BG : (h && !disabled ? NEON : TEXT_DIM), opacity: disabled ? 0.4 : 1, ...sx,
      }}>{children}</button>
  );
};

const BackBtn = ({ onClick, label = "Back" }: { onClick: () => void; label?: string }) => (
  <button onClick={onClick} style={{
    fontFamily: FONT_BODY, fontSize: 11, color: TEXT_DIM, background: "none", border: "none",
    cursor: "pointer", display: "flex", alignItems: "center", gap: 6, marginBottom: 24,
    letterSpacing: "0.08em", textTransform: "uppercase",
  }}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M19 12H5M12 5l-7 7 7 7" stroke={TEXT_DIM} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    {label}
  </button>
);

// ── Filter Pill ─────────────────────────────────────────────
const PRICE_TOOLTIPS: Record<string, string> = { "$": "Under $15/person", "$$": "$15–$30/person", "$$$": "$30–$60/person", "$$$$": "$60+/person" };

const FilterPill = ({ label, active, onClick, icon, title }: { label: string; active: boolean; onClick: () => void; icon?: string; title?: string }) => {
  const [h, setH] = useState(false);
  return (
    <button onClick={onClick} title={title} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        fontFamily: FONT_BODY, fontSize: 11, fontWeight: active ? 600 : 400,
        padding: icon ? "7px 14px 7px 10px" : "7px 14px", borderRadius: 20, cursor: "pointer",
        whiteSpace: "nowrap", transition: "all 0.25s ease",
        border: `1px solid ${active ? `rgba(${NEON_RGB}, 0.5)` : (h ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.08)")}`,
        background: active ? `rgba(${NEON_RGB}, 0.15)` : (h ? "rgba(255,255,255,0.04)" : "transparent"),
        color: active ? NEON : (h ? "rgba(255,255,255,0.6)" : TEXT_DIM),
        boxShadow: active ? `0 0 12px rgba(${NEON_RGB}, 0.1)` : "none",
        letterSpacing: "0.02em",
      }}>
      {icon && <span style={{ marginRight: 6, fontSize: 12 }}>{icon}</span>}
      {label}
    </button>
  );
};

// ── Collapsible Filter Section ──────────────────────────────
const FilterSection = ({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 4 }}>
      <button onClick={() => setOpen(!open)} style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 0", background: "none", border: "none", cursor: "pointer",
      }}>
        <span style={{ fontFamily: FONT_BODY, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: TEXT_DIM }}>{title}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ transition: "transform 0.3s ease", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>
          <path d="M6 9l6 6 6-6" stroke={TEXT_DIM} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div style={{ paddingBottom: 12, animation: "fadeIn 0.3s ease both" }}>
          {children}
        </div>
      )}
    </div>
  );
};

// ── Date Helpers ─────────────────────────────────────────────
const getDateParts = (dateStr: string) => {
  const d = new Date(dateStr + "T12:00:00");
  const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  return { month: monthNames[d.getMonth()], day: d.getDate(), weekday: dayNames[d.getDay()] };
};

const getTodayDayName = () => {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return days[new Date().getDay()];
};

const getTodayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const getDateStr = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// ── Share Helper ─────────────────────────────────────────────
const handleShare = async (title: string, text: string, onNotify?: (msg: string) => void) => {
  const url = window.location.href;
  // Try native share first (mobile), fall through to clipboard on any failure
  try {
    if (navigator.share) {
      await navigator.share({ title, text, url });
      return;
    }
  } catch {
    // User cancelled or API not fully supported — fall through to clipboard
  }
  try {
    await navigator.clipboard.writeText(url);
    onNotify?.("Link copied to clipboard!");
  } catch {
    // Clipboard blocked — fallback copy attempt
    navigator.clipboard.writeText(url).catch(() => {});
    onNotify?.("Couldn't copy link automatically.");
  }
};

// ── Share Button ────────────────────────────────────────────
const ShareBtn = ({ onClick, size = 16 }: { onClick: (e: React.MouseEvent) => void; size?: number }) => {
  const [h, setH] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{
      width: size + 18, height: size + 18, borderRadius: 20, border: "none", cursor: "pointer",
      transition: "all 0.25s ease", display: "flex", alignItems: "center", justifyContent: "center",
      background: h ? `rgba(${NEON_RGB}, 0.15)` : "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)",
    }}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" stroke={h ? NEON : "rgba(255,255,255,0.6)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
};

// ── Follow Business Button ────────────────────────────────
const FollowBusinessBtn = ({ followed, onClick }: { followed: boolean; onClick: (e: React.MouseEvent) => void }) => {
  const [h, setH] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{
      padding: "5px 12px", borderRadius: 20, cursor: "pointer",
      border: `1px solid ${followed ? `rgba(${GREEN_RGB}, 0.5)` : (h ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.08)")}`,
      background: followed ? `rgba(${GREEN_RGB}, 0.12)` : (h ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.5)"),
      backdropFilter: "blur(8px)", transition: "all 0.25s ease",
      display: "flex", alignItems: "center", gap: 4,
    }}>
      <span style={{
        fontFamily: FONT_BODY, fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
        textTransform: "uppercase" as const,
        color: followed ? GREEN : (h ? "rgba(255,255,255,0.6)" : TEXT_DIM),
      }}>
        {followed ? "Following" : "Follow"}
      </span>
    </button>
  );
};

// ── Attendance Vote Button (wired to DB) ──────────────────
const AttendanceVote = ({
  event,
  compact = false,
  userVote,
  onVote,
}: {
  event: Event;
  compact?: boolean;
  userVote: string | null;
  onVote: (eventId: string, response: string) => void;
}) => {
  const options = [
    { id: "yes", label: "Yes", icon: "✓", color: GREEN, colorRGB: GREEN_RGB, count: event.attendees.yes },
    { id: "maybe", label: "Maybe", icon: "?", color: YELLOW, colorRGB: "255,214,0", count: event.attendees.maybe },
    { id: "no", label: "No", icon: "✕", color: PINK, colorRGB: PINK_RGB, count: event.attendees.no },
  ];

  return (
    <div style={{ display: "flex", alignItems: "center", gap: compact ? 8 : 10 }}>
      <span style={{
        fontFamily: FONT_BODY, fontSize: compact ? 9 : 10, fontWeight: 700, letterSpacing: "0.08em",
        textTransform: "uppercase", color: TEXT_MUTED, whiteSpace: "nowrap", flexShrink: 0,
      }}>Attending?</span>
      <div style={{ display: "flex", gap: 6, flex: 1 }}>
        {options.map((opt) => {
          const active = userVote === opt.id;
          return (
            <button key={opt.id} onClick={(e) => { e.stopPropagation(); onVote(event.id, opt.id); }}
              style={{
                flex: 1, padding: compact ? "5px 0" : "6px 0", borderRadius: 3, cursor: "pointer",
                transition: "all 0.25s ease",
                border: `1px solid ${active ? `rgba(${opt.colorRGB}, 0.5)` : "rgba(255,255,255,0.06)"}`,
                background: active ? `rgba(${opt.colorRGB}, 0.12)` : "rgba(255,255,255,0.02)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
              }}
            >
              <span style={{ fontSize: compact ? 9 : 10, fontWeight: 700, color: active ? opt.color : TEXT_DIM, transition: "color 0.25s ease" }}>{opt.icon}</span>
              <span style={{ fontFamily: FONT_BODY, fontSize: compact ? 8 : 9, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: active ? opt.color : TEXT_DIM, transition: "color 0.25s ease" }}>{opt.label}</span>
              <span style={{ fontFamily: FONT_BODY, fontSize: compact ? 7 : 8, color: active ? `rgba(${opt.colorRGB}, 0.6)` : TEXT_MUTED, transition: "color 0.25s ease" }}>{opt.count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// PROGRESSIVE PAYOUT LADDER
// ═══════════════════════════════════════════════════════════════
function buildPayoutLevels(thresholds: VisitThreshold[]) {
  return thresholds.map((t) => ({ level: t.level, name: t.label, visits: getVisitRangeLabel(t) }));
}
const DEFAULT_PAYOUT_LEVELS = buildPayoutLevels(DEFAULT_VISIT_THRESHOLDS);

const PayoutLadder = ({ rates, levels = DEFAULT_PAYOUT_LEVELS }: { rates: number[]; levels?: { level: number; name: string; visits: string }[] }) => {
  const levelColors = [TEXT_DIM, BLUE, GREEN, YELLOW, "#FF6B35", PINK, NEON];
  return (
    <div style={{ borderRadius: 6, marginBottom: 24, overflow: "hidden", padding: 1, background: `linear-gradient(90deg, transparent, ${GREEN}, transparent, ${GREEN}, transparent)`, backgroundSize: "300% 100%", animation: "borderTravelPurple 12s linear infinite" }}>
      <div style={{ background: CARD_BG, borderRadius: 5, padding: "20px 22px", position: "relative", overflow: "hidden" }}>
        <DotGrid opacity={0.025} />
        <div style={{ position: "relative", zIndex: 2 }}>
          <SectionLabel text="PROGRESSIVE PAYOUT LADDER" />
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 16 }}>
            {levels.map((pl, i) => {
              const pct = rates[i] ?? 0;
              const color = levelColors[i];
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                  borderRadius: 4, background: `${color}08`, border: `1px solid ${color}20`,
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                    background: `${color}18`, color, fontSize: 14, fontWeight: 800, fontFamily: FONT_BODY,
                  }}>{pl.level}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY, fontFamily: FONT_BODY }}>
                      Level {pl.level} <span style={{ color, fontWeight: 600 }}>({pl.name})</span>
                    </div>
                    <div style={{ fontSize: 11, color: TEXT_DIM, fontFamily: FONT_BODY }}>{pl.visits}</div>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color, fontFamily: FONT_BODY, textShadow: `0 0 20px ${color}40` }}>{pct}%</div>
                </div>
              );
            })}
          </div>
          <div style={{
            marginTop: 14, padding: "10px 14px", borderRadius: 4,
            background: `rgba(${GREEN_RGB}, 0.06)`, border: `1px solid rgba(${GREEN_RGB}, 0.12)`,
            fontSize: 10, lineHeight: 1.6, color: TEXT_DIM, fontFamily: FONT_BODY,
          }}>
            Only verified receipts count towards visit totals &amp; progressive payouts. Payout is agreed upon and unique to each business as well as each user. Payout is based on the receipt subtotal before tax &amp; tip.
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Loading Skeleton Card ───────────────────────────────────
const SkeletonCard = ({ index }: { index: number }) => (
  <div style={{
    borderRadius: 6, overflow: "hidden", animation: `slideUp 0.5s ease ${0.1 + index * 0.06}s both`,
  }}>
    <div style={{ position: "relative", background: CARD_BG, borderRadius: 5, overflow: "hidden", border: `1px solid ${CARD_BORDER}` }}>
      <div style={{
        height: 320,
        background: `linear-gradient(90deg, ${CARD_BG} 25%, rgba(255,255,255,0.03) 50%, ${CARD_BG} 75%)`,
        backgroundSize: "200% 100%",
        animation: "shimmer 1.5s ease-in-out infinite",
      }} />
      <div style={{ padding: "18px 18px 16px" }}>
        <div style={{ height: 20, width: "70%", background: "rgba(255,255,255,0.04)", borderRadius: 4, marginBottom: 10 }} />
        <div style={{ height: 14, width: "90%", background: "rgba(255,255,255,0.03)", borderRadius: 4, marginBottom: 6 }} />
        <div style={{ height: 14, width: "60%", background: "rgba(255,255,255,0.03)", borderRadius: 4, marginBottom: 14 }} />
        <div style={{ display: "flex", gap: 6 }}>
          {[1, 2, 3].map(i => <div key={i} style={{ height: 24, width: 60, background: "rgba(255,255,255,0.03)", borderRadius: 12 }} />)}
        </div>
      </div>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════
// EVENT DETAIL VIEW
// ═══════════════════════════════════════════════════════════════
const EventDetail = ({
  event,
  onBack,
  userVote,
  onVote,
  isSaved,
  onToggleSave,
  payoutLevels,
  isFollowed,
  onToggleFollow,
  onNotify,
}: {
  event: Event;
  onBack: () => void;
  userVote: string | null;
  onVote: (eventId: string, response: string) => void;
  isSaved: boolean;
  onToggleSave: (eventId: string) => void;
  payoutLevels?: { level: number; name: string; visits: string }[];
  isFollowed: boolean;
  onToggleFollow: (businessId: string) => void;
  onNotify: (msg: string) => void;
}) => {
  const dateParts = getDateParts(event.date);
  const todayDay = getTodayDayName();

  const todayHours = event.business.hours.find(h => h.day === todayDay);
  const isOpen = todayHours && todayHours.time !== "Closed";

  const fullAddress = [event.business.address, event.business.city, event.business.state, event.business.zip].filter(Boolean).join(", ");

  const InfoRow = ({ icon, label, value, action, actionLabel }: { icon: React.ReactNode; label: string; value: string; action?: () => void; actionLabel?: string }) => (
    <div style={{
      display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16,
      padding: "16px 0", borderBottom: `1px solid ${CARD_BORDER}`,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flex: 1 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: `rgba(${NEON_RGB}, 0.06)`, border: `1px solid rgba(${NEON_RGB}, 0.12)`,
        }}>
          {icon}
        </div>
        <div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: NEON, marginBottom: 4 }}>{label}</div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: TEXT_PRIMARY, lineHeight: 1.4 }}>{value}</div>
        </div>
      </div>
      {action && (
        <NeonBtn onClick={action} style={{ padding: "8px 16px", fontSize: 10, flexShrink: 0, marginTop: 4 }}>
          {actionLabel}
        </NeonBtn>
      )}
    </div>
  );

  return (
    <div style={{ animation: "fadeIn 0.4s ease both" }}>
      <BackBtn onClick={onBack} label="Back to Events" />

      {/* Hero */}
      <div style={{
        height: 300, borderRadius: 6, overflow: "hidden", position: "relative",
        background: event.imageUrl ? CARD_BG : (CATEGORY_GRADIENTS[event.category] || CATEGORY_GRADIENTS["Other"]),
        marginBottom: 24,
      }}>
        {event.imageUrl ? (
          <img src={event.imageUrl} alt={event.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 72, filter: "drop-shadow(0 4px 20px rgba(0,0,0,0.4))", animation: "floatUp 4s ease infinite" }}>
              {CATEGORY_ICONS[event.category] || "◈"}
            </span>
          </div>
        )}
        <div style={{ position: "absolute", top: 14, right: 14, display: "flex", gap: 8 }}>
          <ShareBtn size={18} onClick={(e) => { e.stopPropagation(); handleShare(event.title, `${event.business.name} – ${event.title}`, onNotify); }} />
          <button onClick={() => onToggleSave(event.id)} style={{
            width: 38, height: 38,
            borderRadius: 20, border: "none", cursor: "pointer", transition: "all 0.25s ease",
            background: isSaved ? `rgba(${NEON_RGB}, 0.25)` : "rgba(0,0,0,0.5)",
            backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill={isSaved ? NEON : "none"}>
              <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" stroke={isSaved ? NEON : "rgba(255,255,255,0.6)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 60, background: `linear-gradient(transparent, ${BG})` }} />
      </div>

      {/* Event title & date/time/price */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 700, color: TEXT_PRIMARY, lineHeight: 1.15, marginBottom: 12 }}>
          {event.business.name} <span style={{ color: TEXT_MUTED, fontWeight: 400 }}>–</span> {event.title}
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{
            background: `rgba(${NEON_RGB}, 0.08)`, border: `1px solid rgba(${NEON_RGB}, 0.2)`,
            borderRadius: 6, padding: "8px 14px", textAlign: "center", minWidth: 54,
          }}>
            <div style={{ fontFamily: FONT_BODY, fontSize: 9, fontWeight: 700, color: NEON, letterSpacing: "0.1em" }}>{dateParts.month}</div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 700, color: TEXT_PRIMARY, lineHeight: 1 }}>{dateParts.day}</div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 8, color: TEXT_DIM, letterSpacing: "0.08em", marginTop: 2 }}>{dateParts.weekday}</div>
          </div>
          <div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: TEXT_PRIMARY, fontWeight: 600 }}>{event.time} – {event.endTime}</div>
            {event.dist && (
              <div style={{ fontFamily: FONT_BODY, fontSize: 11, color: TEXT_DIM, marginTop: 3 }}>{event.dist} away</div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {event.tags.map((tag) => (
            <span key={tag} style={{
              fontFamily: FONT_BODY, fontSize: 9, fontWeight: 600, letterSpacing: "0.04em",
              padding: "4px 10px", borderRadius: 12, color: TEXT_DIM,
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
            }}>{tag}</span>
          ))}
          <span style={{
            fontFamily: FONT_BODY, fontSize: 9, fontWeight: 700, letterSpacing: "0.04em",
            padding: "4px 10px", borderRadius: 12,
            color: event.price === "Free" ? GREEN : NEON,
            background: event.price === "Free" ? `rgba(${GREEN_RGB}, 0.1)` : `rgba(${NEON_RGB}, 0.1)`,
            border: `1px solid ${event.price === "Free" ? `rgba(${GREEN_RGB}, 0.2)` : `rgba(${NEON_RGB}, 0.2)`}`,
          }}>{event.price || "Free"}</span>
        </div>
      </div>

      {/* Description */}
      <div style={{ padding: "18px 20px", borderRadius: 4, marginBottom: 24, background: "rgba(255,255,255,0.02)", border: `1px solid ${CARD_BORDER}` }}>
        <div style={{ fontFamily: FONT_BODY, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: TEXT_DIM, marginBottom: 10 }}>About This Event</div>
        <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.65 }}>{event.description}</p>
      </div>

      {/* Attendance Vote + Booking Link */}
      <div style={{ padding: "18px 20px", borderRadius: 4, marginBottom: 24, background: "rgba(255,255,255,0.02)", border: `1px solid ${CARD_BORDER}` }}>
        <AttendanceVote event={event} userVote={userVote} onVote={onVote} />
        {event.bookingUrl && (
          <a href={event.bookingUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 14, padding: "10px 0",
            borderRadius: 3, textDecoration: "none", transition: "all 0.25s ease",
            border: `1px solid rgba(${NEON_RGB}, 0.3)`, background: `rgba(${NEON_RGB}, 0.06)`,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" stroke={NEON} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ fontFamily: FONT_BODY, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: NEON }}>
              External Booking
            </span>
          </a>
        )}
      </div>

      {/* Payout Reward */}
      {event.payoutRange && (
        <div style={{
          padding: "14px 20px", borderRadius: 4, marginBottom: 24, display: "flex", alignItems: "center", gap: 12,
          background: `rgba(${GREEN_RGB}, 0.06)`, border: `1px solid rgba(${GREEN_RGB}, 0.15)`,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 6, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: `rgba(${GREEN_RGB}, 0.12)`, border: `1px solid rgba(${GREEN_RGB}, 0.2)`,
            fontSize: 14,
          }}>💰</div>
          <div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 12, fontWeight: 700, color: GREEN }}>
              Earn up to {event.payoutRange} back
            </div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 10, color: TEXT_DIM, marginTop: 2 }}>
              Visit {event.business.name} through LetsGo and earn cash back
            </div>
          </div>
        </div>
      )}

      {/* Business Details */}
      <div style={{ position: "relative", borderRadius: 6, marginBottom: 24, overflow: "hidden", padding: 1, background: `linear-gradient(90deg, transparent, ${NEON}, transparent, ${NEON}, transparent)`, backgroundSize: "300% 100%", animation: "borderTravelPurple 12s linear infinite" }}>
        <div style={{ background: CARD_BG, borderRadius: 5, padding: "20px 22px", position: "relative", overflow: "hidden" }}>
          <DotGrid opacity={0.025} />
          <div style={{ position: "relative", zIndex: 2 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <SectionLabel text="VENUE DETAILS" />
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 20,
                  background: isOpen ? `rgba(${GREEN_RGB}, 0.1)` : "rgba(255,255,255,0.04)",
                  border: `1px solid ${isOpen ? `rgba(${GREEN_RGB}, 0.25)` : "rgba(255,255,255,0.08)"}`,
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: isOpen ? GREEN : PINK }} />
                  <span style={{ fontFamily: FONT_BODY, fontSize: 10, fontWeight: 600, color: isOpen ? GREEN : PINK }}>
                    {isOpen ? "Open" : "Closed"}
                  </span>
                  {isOpen && todayHours && (
                    <span style={{ fontFamily: FONT_BODY, fontSize: 10, color: TEXT_DIM }}>
                      · Closes {todayHours.time.split("–")[1]?.trim()}
                    </span>
                  )}
                </div>
                <div style={{ padding: "5px 10px", borderRadius: 20, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <span style={{ fontFamily: FONT_BODY, fontSize: 11, fontWeight: 700, color: TEXT_DIM }}>{event.priceLevel}</span>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
              <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 700, color: TEXT_PRIMARY, margin: 0 }}>{event.business.name}</h2>
              <FollowBusinessBtn followed={isFollowed} onClick={(e) => { e.stopPropagation(); onToggleFollow(event.businessId); }} />
            </div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: TEXT_DIM, marginBottom: 20 }}>
              {event.business.type}{event.dist ? ` · ${event.dist}` : ""}
            </div>

            <InfoRow
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke={PINK} strokeWidth="1.5" /><circle cx="12" cy="9" r="2.5" stroke={PINK} strokeWidth="1.5" /></svg>}
              label="Address" value={fullAddress || "—"} actionLabel="Get Directions"
            />
            {event.business.phone && (
              <InfoRow
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.86 19.86 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.86 19.86 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke={PINK} strokeWidth="1.5" /></svg>}
                label="Phone" value={event.business.phone} actionLabel="Call"
              />
            )}
            {event.business.website && (
              <InfoRow
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke={BLUE} strokeWidth="1.5" /><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10A15.3 15.3 0 0112 2z" stroke={BLUE} strokeWidth="1.5" /></svg>}
                label="Website" value={event.business.website} actionLabel="Visit"
              />
            )}

            {/* Business Hours */}
            {event.business.hours.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <div style={{ fontFamily: FONT_BODY, fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: TEXT_DIM, marginBottom: 14 }}>Business Hours</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {event.business.hours.map((h) => {
                    const isToday = h.day === todayDay;
                    return (
                      <div key={h.day} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "11px 14px", borderRadius: isToday ? 4 : 0,
                        background: isToday ? `rgba(${NEON_RGB}, 0.06)` : "transparent",
                        border: isToday ? `1px solid rgba(${NEON_RGB}, 0.15)` : "1px solid transparent",
                        marginBottom: 2,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: isToday ? 600 : 400, color: isToday ? NEON : TEXT_PRIMARY }}>{h.day}</span>
                          {isToday && (
                            <span style={{ fontFamily: FONT_BODY, fontSize: 9, fontWeight: 600, color: NEON, padding: "2px 6px", borderRadius: 3, background: `rgba(${NEON_RGB}, 0.1)` }}>(Today)</span>
                          )}
                        </div>
                        <span style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: isToday ? 700 : 400, color: h.time === "Closed" ? PINK : (isToday ? TEXT_PRIMARY : TEXT_DIM) }}>{h.time}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Progressive Payout Ladder */}
      {event.payoutTiers.length > 0 && (
        <PayoutLadder rates={event.payoutTiers} levels={payoutLevels} />
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// EVENT CARD
// ═══════════════════════════════════════════════════════════════
const EventCard = ({
  event,
  index,
  onOpenDetail,
  userVote,
  onVote,
  isSaved,
  onToggleSave,
  isFollowed,
  onToggleFollow,
  onNotify,
  dataTour,
}: {
  event: Event;
  index: number;
  onOpenDetail: (e: Event) => void;
  userVote: string | null;
  onVote: (eventId: string, response: string) => void;
  isSaved: boolean;
  onToggleSave: (eventId: string) => void;
  isFollowed: boolean;
  onToggleFollow: (businessId: string) => void;
  onNotify: (msg: string) => void;
  dataTour?: string;
}) => {
  const [hovered, setHovered] = useState(false);
  const dateParts = getDateParts(event.date);
  const fallbackGradient = CATEGORY_GRADIENTS[event.category] || CATEGORY_GRADIENTS["Other"];

  return (
    <div
      data-tour={dataTour}
      onClick={() => onOpenDetail(event)}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative", borderRadius: 6, cursor: "pointer",
        animation: `slideUp 0.5s ease ${0.1 + index * 0.06}s both`,
        transition: "transform 0.35s cubic-bezier(0.23,1,0.32,1)",
        transform: hovered ? "translateY(-3px)" : "none",
      }}
    >
      <div style={{
        position: "absolute", inset: -1, borderRadius: 7,
        background: `linear-gradient(90deg, transparent, ${NEON}, transparent, ${NEON}, transparent)`,
        backgroundSize: "300% 100%", animation: "borderTravelPurple 12s linear infinite",
        opacity: hovered ? 0.6 : 0.15, transition: "opacity 0.4s ease",
      }} />

      <div style={{ position: "relative", background: CARD_BG, borderRadius: 5, overflow: "hidden" }}>
        <DotGrid opacity={hovered ? 0.05 : 0.02} />

        {/* Category badge */}
        <div style={{
          position: "absolute", top: 14, left: 14, zIndex: 10,
          padding: "4px 10px", borderRadius: 3, fontFamily: FONT_BODY, fontSize: 9,
          fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
          background: `rgba(${NEON_RGB}, 0.2)`, color: NEON,
          border: `1px solid rgba(${NEON_RGB}, 0.3)`, backdropFilter: "blur(8px)",
        }}>{event.category}</div>

        <div style={{ position: "absolute", top: 14, right: 14, zIndex: 10, display: "flex", gap: 6 }}>
          <FollowBusinessBtn followed={isFollowed} onClick={(e) => { e.stopPropagation(); onToggleFollow(event.businessId); }} />
          <ShareBtn size={14} onClick={(e) => { e.stopPropagation(); handleShare(event.title, `${event.business.name} – ${event.title}`, onNotify); }} />
          <button onClick={(e) => { e.stopPropagation(); onToggleSave(event.id); }} style={{
            width: 34, height: 34,
            borderRadius: 20, border: "none", cursor: "pointer", transition: "all 0.25s ease",
            background: isSaved ? `rgba(${NEON_RGB}, 0.25)` : "rgba(0,0,0,0.5)",
            backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill={isSaved ? NEON : "none"}>
              <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" stroke={isSaved ? NEON : "rgba(255,255,255,0.6)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Hero area — real image or category gradient fallback */}
        <div style={{
          height: 320, position: "relative",
          background: event.imageUrl ? CARD_BG : fallbackGradient,
          display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
        }}>
          {event.imageUrl ? (
            <img src={event.imageUrl} alt={event.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span style={{
              fontSize: 80, filter: "drop-shadow(0 4px 20px rgba(0,0,0,0.4))",
              animation: hovered ? "floatUp 3s ease infinite" : "none",
            }}>{CATEGORY_ICONS[event.category] || "◈"}</span>
          )}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 80, background: `linear-gradient(transparent, ${CARD_BG})` }} />
          <div style={{ position: "absolute", bottom: 14, left: 16, display: "flex", alignItems: "center", gap: 10, zIndex: 5 }}>
            <div style={{
              background: "rgba(0,0,0,0.6)", backdropFilter: "blur(12px)",
              border: `1px solid rgba(${NEON_RGB}, 0.25)`, borderRadius: 6, padding: "8px 12px",
              textAlign: "center", minWidth: 52,
            }}>
              <div style={{ fontFamily: FONT_BODY, fontSize: 9, fontWeight: 700, color: NEON, letterSpacing: "0.1em" }}>{dateParts.month}</div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 700, color: TEXT_PRIMARY, lineHeight: 1 }}>{dateParts.day}</div>
              <div style={{ fontFamily: FONT_BODY, fontSize: 8, color: TEXT_DIM, letterSpacing: "0.08em", marginTop: 2 }}>{dateParts.weekday}</div>
            </div>
            <div>
              <div style={{ fontFamily: FONT_BODY, fontSize: 11, color: "rgba(255,255,255,0.8)", fontWeight: 600 }}>{event.time} – {event.endTime}</div>
              {event.dist && (
                <div style={{ fontFamily: FONT_BODY, fontSize: 10, color: TEXT_DIM, marginTop: 2 }}>{event.dist} away</div>
              )}
            </div>
          </div>
        </div>

        <div style={{ padding: "18px 18px 16px", position: "relative", zIndex: 2 }}>
          <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 700, color: TEXT_PRIMARY, lineHeight: 1.2, marginBottom: 8 }}>
            {event.business.name} <span style={{ color: TEXT_MUTED, fontWeight: 400, margin: "0 2px" }}>–</span> {event.title}
          </h3>
          <p style={{
            fontFamily: FONT_BODY, fontSize: 12, color: TEXT_DIM, lineHeight: 1.55,
            marginBottom: 14, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}>{event.description}</p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            {event.tags.slice(0, 4).map((tag) => (
              <span key={tag} style={{
                fontFamily: FONT_BODY, fontSize: 9, fontWeight: 600, letterSpacing: "0.04em",
                padding: "4px 10px", borderRadius: 12, color: TEXT_DIM,
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
              }}>{tag}</span>
            ))}
            <span style={{
              fontFamily: FONT_BODY, fontSize: 9, fontWeight: 700, letterSpacing: "0.04em",
              padding: "4px 10px", borderRadius: 12,
              color: event.price === "Free" ? GREEN : NEON,
              background: event.price === "Free" ? `rgba(${GREEN_RGB}, 0.1)` : `rgba(${NEON_RGB}, 0.1)`,
              border: `1px solid ${event.price === "Free" ? `rgba(${GREEN_RGB}, 0.2)` : `rgba(${NEON_RGB}, 0.2)`}`,
            }}>{event.price || "Free"}</span>
          </div>

          <div style={{ marginBottom: 14 }}>
            <AttendanceVote event={event} compact={true} userVote={userVote} onVote={onVote} />
          </div>

          {event.bookingUrl && (
            <a href={event.bookingUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 14, padding: "8px 0",
              borderRadius: 3, textDecoration: "none", transition: "all 0.25s ease",
              border: `1px solid rgba(${NEON_RGB}, 0.2)`, background: `rgba(${NEON_RGB}, 0.04)`,
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" stroke={NEON} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span style={{ fontFamily: FONT_BODY, fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: NEON }}>
                External Booking
              </span>
            </a>
          )}

          <div style={{ height: 1, background: CARD_BORDER, margin: "0 -18px 14px" }} />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12 }}>💰</span>
              <span style={{ fontFamily: FONT_BODY, fontSize: 9, fontWeight: 700, color: GREEN, letterSpacing: "0.04em" }}>
                {event.payoutRange ? `Earn up to ${event.payoutRange}` : "Earn cash back"}
              </span>
            </div>
            <div onClick={(e) => { e.stopPropagation(); onOpenDetail(event); }} style={{
              display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 3,
              cursor: "pointer",
              border: `1px solid rgba(${NEON_RGB}, ${hovered ? 0.5 : 0.2})`,
              background: hovered ? `rgba(${NEON_RGB}, 0.08)` : "transparent", transition: "all 0.3s ease",
            }}>
              <span style={{
                fontFamily: FONT_BODY, fontSize: 10, fontWeight: 600, letterSpacing: "0.12em",
                color: hovered ? NEON : TEXT_DIM, textTransform: "uppercase", transition: "color 0.3s ease",
              }}>Details</span>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ transition: "transform 0.3s ease", transform: hovered ? "translateX(3px)" : "none" }}>
                <path d="M3 8h10M9 4l4 4-4 4" stroke={hovered ? NEON : TEXT_MUTED} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// FILTERS PANEL
// ═══════════════════════════════════════════════════════════════
const FiltersPanel = ({
  filters, setFilters, filtersOpen, setFiltersOpen, userZip, setUserZip,
  showSavedOnly, setShowSavedOnly, savedCount,
  showFollowedOnly, setShowFollowedOnly, followedCount,
  EVENT_CATEGORIES, VIBE_FILTERS,
}: {
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  filtersOpen: boolean;
  setFiltersOpen: (v: boolean) => void;
  userZip: string;
  setUserZip: (z: string) => void;
  showSavedOnly: boolean;
  setShowSavedOnly: (v: boolean) => void;
  savedCount: number;
  showFollowedOnly: boolean;
  setShowFollowedOnly: (v: boolean) => void;
  followedCount: number;
  EVENT_CATEGORIES: { id: string; label: string; icon: string }[];
  VIBE_FILTERS: string[];
}) => {
  const activeCount = [
    filters.category !== "all",
    filters.date !== "all" || (filters.dateFrom !== "" || filters.dateTo !== ""),
    filters.price !== "all",
    filters.distance !== "all", filters.timeOfDay !== "all", filters.capacity !== "all",
    filters.vibes.length > 0, filters.search.length > 0,
  ].filter(Boolean).length;

  const clearAll = () => setFilters({
    category: "all", date: "all", dateFrom: "", dateTo: "", price: "all", distance: "all",
    timeOfDay: "all", capacity: "all", vibes: [], sort: "date-asc", search: "",
  });

  const toggleVibe = (v: string) => {
    setFilters(prev => ({
      ...prev,
      vibes: prev.vibes.includes(v) ? prev.vibes.filter(x => x !== v) : [...prev.vibes, v],
    }));
  };

  return (
    <div style={{ marginBottom: 24, animation: "fadeIn 0.4s ease both" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10, marginBottom: 14,
        padding: "10px 16px", borderRadius: 4,
        background: "rgba(255,255,255,0.02)", border: `1px solid ${filters.search ? `rgba(${NEON_RGB}, 0.3)` : CARD_BORDER}`,
        transition: "border-color 0.3s ease",
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="7" stroke={TEXT_DIM} strokeWidth="1.5" />
          <path d="M16 16l5 5" stroke={TEXT_DIM} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          value={filters.search}
          onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
          placeholder="Search events, venues, keywords..."
          style={{ flex: 1, fontFamily: FONT_BODY, fontSize: 13, color: TEXT_PRIMARY, background: "none", border: "none", outline: "none" }}
        />
        {filters.search && (
          <button onClick={() => setFilters(prev => ({ ...prev, search: "" }))} style={{
            background: "none", border: "none", cursor: "pointer", color: TEXT_DIM, fontSize: 16, padding: 0, lineHeight: 1,
          }}>×</button>
        )}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingBottom: 14, marginBottom: 6 }}>
        {savedCount > 0 && (
          <FilterPill
            label={`Saved (${savedCount})`}
            icon="🔖"
            active={showSavedOnly}
            onClick={() => setShowSavedOnly(!showSavedOnly)}
          />
        )}
        {followedCount > 0 && (
          <FilterPill
            label={`Following (${followedCount})`}
            icon="👤"
            active={showFollowedOnly}
            onClick={() => setShowFollowedOnly(!showFollowedOnly)}
          />
        )}
        {EVENT_CATEGORIES.map((cat) => (
          <FilterPill key={cat.id} label={cat.label} icon={cat.icon} active={filters.category === cat.id}
            onClick={() => setFilters(prev => ({ ...prev, category: cat.id }))} />
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <button data-tour="event-filters" onClick={() => setFiltersOpen(!filtersOpen)} style={{
          display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 4,
          background: filtersOpen ? `rgba(${NEON_RGB}, 0.08)` : "transparent",
          border: `1px solid ${filtersOpen ? `rgba(${NEON_RGB}, 0.3)` : "rgba(255,255,255,0.08)"}`,
          cursor: "pointer", transition: "all 0.25s ease",
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M4 6h16M7 12h10M10 18h4" stroke={filtersOpen ? NEON : TEXT_DIM} strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span style={{ fontFamily: FONT_BODY, fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", color: filtersOpen ? NEON : TEXT_DIM }}>
            Filters
          </span>
          {activeCount > 0 && (
            <span style={{
              fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 10, minWidth: 18, textAlign: "center",
              background: `rgba(${NEON_RGB}, 0.2)`, color: NEON,
            }}>{activeCount}</span>
          )}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {activeCount > 0 && (
            <button onClick={clearAll} style={{
              fontFamily: FONT_BODY, fontSize: 10, color: PINK, background: "none", border: "none",
              cursor: "pointer", letterSpacing: "0.06em", fontWeight: 600,
            }}>Clear All</button>
          )}
          <select
            value={filters.sort}
            onChange={(e) => setFilters(prev => ({ ...prev, sort: e.target.value }))}
            style={{
              fontFamily: FONT_BODY, fontSize: 11, color: TEXT_DIM, background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, padding: "7px 12px",
              outline: "none", cursor: "pointer", appearance: "none" as const,
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='rgba(255,255,255,0.3)' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center", paddingRight: 28,
            }}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id} style={{ background: CARD_BG, color: TEXT_PRIMARY }}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {filtersOpen && (
        <div style={{
          marginTop: 12, padding: "4px 18px", borderRadius: 4,
          background: "rgba(255,255,255,0.015)", border: `1px solid ${CARD_BORDER}`,
          animation: "fadeIn 0.3s ease both",
        }}>
          <FilterSection title="Date" defaultOpen={true}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {DATE_FILTERS.map((f) => (
                <FilterPill key={f.id} label={f.label} active={filters.date === f.id}
                  onClick={() => setFilters(prev => ({ ...prev, date: f.id, ...(f.id !== "custom" ? { dateFrom: "", dateTo: "" } : {}) }))} />
              ))}
            </div>
            {filters.date === "custom" && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, animation: "fadeIn 0.3s ease both" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontFamily: FONT_BODY, fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: TEXT_MUTED, display: "block", marginBottom: 4 }}>From</label>
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                    style={{
                      width: "100%", fontFamily: FONT_BODY, fontSize: 12, color: TEXT_PRIMARY,
                      background: "rgba(255,255,255,0.04)", border: `1px solid rgba(${NEON_RGB}, 0.2)`,
                      borderRadius: 4, padding: "8px 10px", outline: "none",
                      colorScheme: "dark",
                    }}
                  />
                </div>
                <span style={{ fontFamily: FONT_BODY, fontSize: 11, color: TEXT_MUTED, marginTop: 16 }}>–</span>
                <div style={{ flex: 1 }}>
                  <label style={{ fontFamily: FONT_BODY, fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: TEXT_MUTED, display: "block", marginBottom: 4 }}>To</label>
                  <input
                    type="date"
                    value={filters.dateTo}
                    min={filters.dateFrom || undefined}
                    onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                    style={{
                      width: "100%", fontFamily: FONT_BODY, fontSize: 12, color: TEXT_PRIMARY,
                      background: "rgba(255,255,255,0.04)", border: `1px solid rgba(${NEON_RGB}, 0.2)`,
                      borderRadius: 4, padding: "8px 10px", outline: "none",
                      colorScheme: "dark",
                    }}
                  />
                </div>
                {(filters.dateFrom || filters.dateTo) && (
                  <button
                    onClick={() => setFilters(prev => ({ ...prev, dateFrom: "", dateTo: "" }))}
                    style={{
                      marginTop: 16, background: "none", border: "none", cursor: "pointer",
                      color: PINK, fontSize: 14, padding: "4px", lineHeight: 1,
                    }}
                    title="Clear dates"
                  >×</button>
                )}
              </div>
            )}
          </FilterSection>
          <div style={{ height: 1, background: CARD_BORDER }} />
          <FilterSection title="Time of Day">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {TIME_OF_DAY_FILTERS.map((f) => (
                <FilterPill key={f.id} label={f.label} active={filters.timeOfDay === f.id}
                  onClick={() => setFilters(prev => ({ ...prev, timeOfDay: f.id }))} />
              ))}
            </div>
          </FilterSection>
          <div style={{ height: 1, background: CARD_BORDER }} />
          <FilterSection title="Price">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {PRICE_FILTERS.map((f) => (
                <FilterPill key={f.id} label={f.label} active={filters.price === f.id}
                  onClick={() => setFilters(prev => ({ ...prev, price: f.id }))} title={PRICE_TOOLTIPS[f.id]} />
              ))}
            </div>
          </FilterSection>
          <div style={{ height: 1, background: CARD_BORDER }} />
          <FilterSection title="Distance">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
              {DISTANCE_FILTERS.map((f) => (
                <FilterPill key={f.id} label={f.label} active={filters.distance === f.id}
                  onClick={() => setFilters(prev => ({ ...prev, distance: f.id }))} />
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontFamily: FONT_BODY, fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: TEXT_MUTED }}>Your Zip:</span>
              <input
                value={userZip}
                onChange={(e) => setUserZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
                placeholder="e.g. 68102"
                maxLength={5}
                style={{
                  width: 80, fontFamily: FONT_BODY, fontSize: 12, color: TEXT_PRIMARY,
                  background: "rgba(255,255,255,0.04)", border: `1px solid rgba(${NEON_RGB}, 0.2)`,
                  borderRadius: 4, padding: "6px 10px", outline: "none", textAlign: "center",
                }}
              />
              {userZip.length === 5 && !ZIP_COORDS[userZip] && (
                <span style={{ fontFamily: FONT_BODY, fontSize: 9, color: YELLOW }}>Zip not in database</span>
              )}
            </div>
          </FilterSection>
          <div style={{ height: 1, background: CARD_BORDER }} />
          <FilterSection title="Event Size">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {CAPACITY_FILTERS.map((f) => (
                <FilterPill key={f.id} label={f.label} active={filters.capacity === f.id}
                  onClick={() => setFilters(prev => ({ ...prev, capacity: f.id }))} />
              ))}
            </div>
          </FilterSection>
          <div style={{ height: 1, background: CARD_BORDER }} />
          <FilterSection title="Vibe & Style">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {VIBE_FILTERS.map((v) => (
                <FilterPill key={v} label={v} active={filters.vibes.includes(v)}
                  onClick={() => toggleVibe(v)} />
              ))}
            </div>
          </FilterSection>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// MAIN EVENTS PAGE
// ═══════════════════════════════════════════════════════════════
export default function EventsPage() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [filters, setFilters] = useState<Filters>({
    category: "all", date: "all", dateFrom: "", dateTo: "", price: "all", distance: "all",
    timeOfDay: "all", capacity: "all", vibes: [], sort: "date-asc", search: "",
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [timeStr, setTimeStr] = useState("");

  // DB-driven tag categories for events
  const [tagCats, setTagCats] = useState<TagCategory[]>([]);
  useEffect(() => { fetchTagsByCategory("event").then(setTagCats).catch(() => {}); }, []);
  const EVENT_CATEGORIES = useMemo(() => {
    const et = tagCats.find(c => c.name === "Event Type");
    if (!et || et.tags.length === 0) return DEFAULT_EVENT_CATEGORIES;
    return [{ id: "all", label: "All Events", icon: "◈" }, ...et.tags.map(t => ({ id: t.name, label: t.name, icon: t.icon || "📌" }))];
  }, [tagCats]);
  const VIBE_FILTERS = useMemo(() => {
    const vibe = tagCats.find(c => c.name === "Vibe");
    const eventVibe = tagCats.find(c => c.name === "Event Vibe");
    const combined = [...(vibe?.tags ?? []), ...(eventVibe?.tags ?? [])];
    return combined.length > 0 ? combined.map(t => t.name) : DEFAULT_VIBE_FILTERS;
  }, [tagCats]);
  const [view, setView] = useState<"list" | "detail">("list");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [calendarMonth, setCalendarMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [userZip, setUserZip] = useState("");

  // Track user votes per event: { eventId: "yes" | "maybe" | "no" }
  const [userVotes, setUserVotes] = useState<Record<string, string>>({});

  // Track which events have been view-tracked already
  const viewedRef = useRef<Set<string>>(new Set());

  // Saved/bookmarked events
  const [savedEventIds, setSavedEventIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); }, []);
  const [showSavedOnly, setShowSavedOnly] = useState(false);

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

  // Dynamic payout levels from platform_settings
  const [payoutLevels, setPayoutLevels] = useState(DEFAULT_PAYOUT_LEVELS);
  useEffect(() => {
    fetchPlatformTierConfig(supabaseBrowser).then((cfg) => {
      setPayoutLevels(buildPayoutLevels(cfg.visitThresholds));
    });
  }, []);

  // Followed businesses
  const [followedBusinessIds, setFollowedBusinessIds] = useState<Set<string>>(new Set());
  const [showFollowedOnly, setShowFollowedOnly] = useState(false);

  // Onboarding tour
  const eventsTourSteps: TourStep[] = useMemo(() => [
    { target: '[data-tour="event-list"]', title: "What's happening near you", description: "Browse upcoming events — trivia nights, live music, tastings, and more. All in one place.", position: "bottom" },
    { target: '[data-tour="event-filters"]', title: "Filter to your taste", description: "Narrow down by category, date, price, and distance. Find exactly what you're looking for.", position: "bottom" },
    { target: '[data-tour="event-card"]', title: "Tap for details", description: "Tap any event to see time, location, price, and how to RSVP. You can also save events for later.", position: "bottom" },
  ], []);
  const eventsTourIllustrations: React.ReactNode[] = useMemo(() => [
    <EventCalendarAnim key="ec" />, <FilterAnim key="f" />, <EventCardAnim key="ecard" />,
  ], []);
  const tour = useOnboardingTour("events", eventsTourSteps, 1000);

  // Get user ID from localStorage auth
  const getUserId = useCallback((): string | null => {
    try {
      const raw = localStorage.getItem("letsgo-auth");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.user?.id || parsed?.id || null;
    } catch { return null; }
  }, []);

  // Get auth headers for API calls
  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabaseBrowser.auth.getSession();
    if (!session?.access_token) return { "Content-Type": "application/json" };
    return { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` };
  }, []);

  // ── Fetch events + saved events from API ───────────────
  useEffect(() => {
    let cancelled = false;
    const fetchEvents = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/events");
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `HTTP ${res.status}`);
        }
        const data = await res.json();
        if (!cancelled) {
          setEvents(data.events || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const fetchSaved = async () => {
      const userId = getUserId();
      if (!userId) return;
      try {
        const headers = await getAuthHeaders();
        const res = await fetch("/api/events/save", { headers });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data.savedEventIds)) {
          setSavedEventIds(new Set(data.savedEventIds));
        }
      } catch { /* silent — non-critical */ }
    };

    const fetchFollowed = async () => {
      const userId = getUserId();
      if (!userId) return;
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/businesses/follow?userId=${userId}`, { headers });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data.followedBusinessIds)) {
          setFollowedBusinessIds(new Set(data.followedBusinessIds as string[]));
        }
      } catch { /* silent — non-critical */ }
    };

    fetchEvents();
    fetchSaved();
    fetchFollowed();
    return () => { cancelled = true; };
  }, [getUserId, getAuthHeaders]);

  // ── Clock ──────────────────────────────────────────────
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }));
    };
    update();
    const i = setInterval(update, 30000);
    return () => clearInterval(i);
  }, []);

  // ── Compute distances when userZip changes ─────────────
  const eventsWithDist = events.map(e => {
    if (!userZip || userZip.length !== 5) return e;
    const bizZip = e.business.zip;
    if (!bizZip) return e;
    const d = getDistanceBetweenZips(userZip, bizZip);
    if (d === null) return e;
    return { ...e, dist: `${d.toFixed(1)} mi`, distMiles: d };
  });

  // ── Vote handler (optimistic + API call) ───────────────
  const handleVote = useCallback(async (eventId: string, response: string) => {
    const userId = getUserId();
    if (!userId) {
      setToast("Please log in to vote."); setTimeout(() => setToast(null), 3000);
      return;
    }

    const prevVote = userVotes[eventId] || null;
    const isToggleOff = prevVote === response;

    // Optimistic update
    setUserVotes(prev => {
      const next = { ...prev };
      if (isToggleOff) {
        delete next[eventId];
      } else {
        next[eventId] = response;
      }
      return next;
    });

    // Optimistic count update
    setEvents(prev => prev.map(e => {
      if (e.id !== eventId) return e;
      const att = { ...e.attendees };
      // Remove previous vote count
      if (prevVote === "yes") att.yes = Math.max(0, att.yes - 1);
      if (prevVote === "maybe") att.maybe = Math.max(0, att.maybe - 1);
      if (prevVote === "no") att.no = Math.max(0, att.no - 1);
      // Add new vote count (unless toggling off)
      if (!isToggleOff) {
        if (response === "yes") att.yes++;
        if (response === "maybe") att.maybe++;
        if (response === "no") att.no++;
      }
      return { ...e, attendees: att };
    }));

    // API call
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/events/rsvp", {
        method: "POST",
        headers,
        body: JSON.stringify({ eventId, response }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("[events] RSVP error:", text);
        // Revert optimistic on error
        setUserVotes(prev => {
          const next = { ...prev };
          if (prevVote) next[eventId] = prevVote;
          else delete next[eventId];
          return next;
        });
      }
    } catch (err) {
      console.error("[events] RSVP fetch error:", err);
      setUserVotes(prev => {
        const next = { ...prev };
        if (prevVote) next[eventId] = prevVote;
        else delete next[eventId];
        return next;
      });
    }
  }, [userVotes, getUserId, getAuthHeaders]);

  // ── Toggle save/bookmark (optimistic + API) ─────────
  const handleToggleSave = useCallback(async (eventId: string) => {
    const userId = getUserId();
    if (!userId) {
      setToast("Please log in to save events."); setTimeout(() => setToast(null), 3000);
      return;
    }

    const wasSaved = savedEventIds.has(eventId);

    // Optimistic update
    setSavedEventIds(prev => {
      const next = new Set(prev);
      if (wasSaved) next.delete(eventId);
      else next.add(eventId);
      return next;
    });

    // Show toast
    if (!wasSaved) {
      showToast("Saved! We'll remind you as the event approaches.");
    }

    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/events/save", {
        method: "POST",
        headers,
        body: JSON.stringify({ eventId }),
      });
      if (!res.ok) {
        console.error("[events] save error:", await res.text());
        // Revert on error
        setSavedEventIds(prev => {
          const next = new Set(prev);
          if (wasSaved) next.add(eventId);
          else next.delete(eventId);
          return next;
        });
      }
    } catch (err) {
      console.error("[events] save fetch error:", err);
      setSavedEventIds(prev => {
        const next = new Set(prev);
        if (wasSaved) next.add(eventId);
        else next.delete(eventId);
        return next;
      });
    }
  }, [savedEventIds, getUserId, getAuthHeaders]);

  // ── Toggle follow business ───────────────────────────
  const handleToggleFollow = useCallback(async (businessId: string) => {
    const userId = getUserId();
    if (!userId) {
      setToast("Please log in to follow businesses."); setTimeout(() => setToast(null), 3000);
      return;
    }
    const wasFollowed = followedBusinessIds.has(businessId);
    setFollowedBusinessIds(prev => {
      const next = new Set(prev);
      if (wasFollowed) next.delete(businessId); else next.add(businessId);
      return next;
    });
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/businesses/follow", {
        method: "POST",
        headers,
        body: JSON.stringify({ businessId, userId }),
      });
      if (!res.ok) {
        setFollowedBusinessIds(prev => {
          const next = new Set(prev);
          if (wasFollowed) next.add(businessId); else next.delete(businessId);
          return next;
        });
      }
    } catch {
      setFollowedBusinessIds(prev => {
        const next = new Set(prev);
        if (wasFollowed) next.add(businessId); else next.delete(businessId);
        return next;
      });
    }
  }, [followedBusinessIds, getUserId, getAuthHeaders]);

  // ── View tracking ─────────────────────────────────────
  const trackView = useCallback((eventId: string) => {
    if (viewedRef.current.has(eventId)) return;
    viewedRef.current.add(eventId);
    getAuthHeaders().then(headers => {
      fetch("/api/events/view", {
        method: "POST",
        headers,
        body: JSON.stringify({ eventId }),
      }).catch(err => console.error("[events] view track error:", err));
    });
  }, [getAuthHeaders]);

  // ── Open detail ────────────────────────────────────────
  const openDetail = useCallback((event: Event) => {
    setSelectedEvent(event);
    setView("detail");
    trackView(event.id);
  }, [trackView]);

  const closeDetail = () => {
    setView("list");
    setSelectedEvent(null);
  };

  // ── Date filter helpers ─────────────────────────────────
  const matchDateFilter = (eventDate: string, dateFilter: string, dateFrom: string, dateTo: string): boolean => {
    if (dateFilter === "all") return true;
    if (dateFilter === "custom") {
      if (dateFrom && eventDate < dateFrom) return false;
      if (dateTo && eventDate > dateTo) return false;
      return true;
    }
    const today = getTodayStr();
    const tomorrow = getDateStr(1);
    if (dateFilter === "today") return eventDate === today;
    if (dateFilter === "tomorrow") return eventDate === tomorrow;
    if (dateFilter === "this-week") {
      const endOfWeek = getDateStr(7 - new Date().getDay());
      return eventDate >= today && eventDate <= endOfWeek;
    }
    if (dateFilter === "this-weekend") {
      const d = new Date();
      const dayOfWeek = d.getDay();
      const satOffset = dayOfWeek === 0 ? -1 : (6 - dayOfWeek);
      const sat = getDateStr(satOffset);
      const sun = getDateStr(satOffset + 1);
      return eventDate === sat || eventDate === sun;
    }
    if (dateFilter === "next-week") {
      const d = new Date();
      const daysUntilMon = (8 - d.getDay()) % 7 || 7;
      const nextMon = getDateStr(daysUntilMon);
      const nextSun = getDateStr(daysUntilMon + 6);
      return eventDate >= nextMon && eventDate <= nextSun;
    }
    if (dateFilter === "this-month") {
      const d = new Date();
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      const monthEnd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      return eventDate >= today && eventDate <= monthEnd;
    }
    return true;
  };

  // ── Time of day filter ──────────────────────────────────
  const matchTimeOfDay = (startAt: string, timeFilter: string): boolean => {
    if (timeFilter === "all") return true;
    const d = new Date(startAt);
    if (isNaN(d.getTime())) return true;
    const hour = d.getHours();
    if (timeFilter === "morning") return hour >= 6 && hour < 12;
    if (timeFilter === "afternoon") return hour >= 12 && hour < 17;
    if (timeFilter === "evening") return hour >= 17 && hour < 21;
    if (timeFilter === "night") return hour >= 21 || hour < 6;
    return true;
  };

  // ── Capacity filter ─────────────────────────────────────
  const matchCapacity = (capacity: number | null, capFilter: string): boolean => {
    if (capFilter === "all" || capacity === null) return true;
    if (capFilter === "intimate") return capacity < 25;
    if (capFilter === "small") return capacity >= 25 && capacity < 75;
    if (capFilter === "medium") return capacity >= 75 && capacity <= 200;
    if (capFilter === "large") return capacity > 200;
    return true;
  };

  // ── Filtering ──────────────────────────────────────────
  const filteredEvents = eventsWithDist.filter((e) => {
    // Saved filter
    if (showSavedOnly && !savedEventIds.has(e.id)) return false;
    // Following filter — only events from followed businesses
    if (showFollowedOnly && !followedBusinessIds.has(e.businessId)) return false;
    if (filters.category !== "all" && e.category !== filters.category) return false;
    if (filters.price !== "all") {
      if (filters.price === "free" && e.price !== "Free" && e.price !== "") return false;
      if (filters.price !== "free" && e.priceLevel !== filters.price) return false;
    }
    if (!matchDateFilter(e.date, filters.date, filters.dateFrom, filters.dateTo)) return false;
    if (!matchTimeOfDay(e.startAt, filters.timeOfDay)) return false;
    if (!matchCapacity(e.capacity, filters.capacity)) return false;

    // Distance filter
    if (filters.distance !== "all" && e.distMiles !== undefined) {
      const maxDist = parseFloat(filters.distance);
      if (e.distMiles > maxDist) return false;
    }

    // Vibe filter — check if event tags contain any selected vibe
    if (filters.vibes.length > 0) {
      const lowerTags = e.tags.map(t => t.toLowerCase());
      const hasMatch = filters.vibes.some(v => lowerTags.includes(v.toLowerCase()));
      if (!hasMatch) return false;
    }

    if (filters.search) {
      const q = filters.search.toLowerCase();
      const match = e.title.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.business.name.toLowerCase().includes(q) ||
        e.tags.some(t => t.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  // ── Sort ────────────────────────────────────────────────
  const sortedEvents = [...filteredEvents].sort((a, b) => {
    switch (filters.sort) {
      case "date-asc": return new Date(a.date).getTime() - new Date(b.date).getTime();
      case "date-desc": return new Date(b.date).getTime() - new Date(a.date).getTime();
      case "popular": return (b.attendees.yes + b.attendees.maybe) - (a.attendees.yes + a.attendees.maybe);
      case "nearest": {
        const da = a.distMiles ?? 99999;
        const db = b.distMiles ?? 99999;
        return da - db;
      }
      case "price-asc": return (a.price === "Free" || !a.price ? 0 : parseInt(a.price.replace(/[^0-9]/g, "")) || 0) - (b.price === "Free" || !b.price ? 0 : parseInt(b.price.replace(/[^0-9]/g, "")) || 0);
      case "price-desc": return (b.price === "Free" || !b.price ? 0 : parseInt(b.price.replace(/[^0-9]/g, "")) || 0) - (a.price === "Free" || !a.price ? 0 : parseInt(a.price.replace(/[^0-9]/g, "")) || 0);
      default: return 0;
    }
  });

  if (!authChecked) return <div style={{ minHeight: "100vh", background: BG }} />;

  return (
    <>
      <GlobalStyles />
      <div style={{ minHeight: "100vh", background: BG, color: TEXT_PRIMARY, display: "flex", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: 680, padding: "0 28px" }}>
          {/* Top Bar */}
          <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 0 20px", animation: "fadeIn 0.4s ease both" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div onClick={() => view === "detail" ? closeDetail() : (window.location.href = "/")} style={{
                width: 34, height: 34, borderRadius: 4, border: "1px solid rgba(255,255,255,0.12)",
                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                transition: "border-color 0.3s ease",
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M19 12H5M12 5l-7 7 7 7" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div style={{
                width: 38, height: 38, borderRadius: 6, border: `2px solid ${NEON}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: FONT_DISPLAY, fontSize: 14, color: NEON,
                background: `rgba(${NEON_RGB}, 0.05)`, textShadow: `0 0 10px ${NEON}`,
              }}>LG</div>
            </div>
            <span style={{ fontSize: 11, color: TEXT_MUTED, letterSpacing: "0.1em", fontFamily: FONT_BODY }}>{timeStr}</span>
          </header>

          {/* Marquee */}
          <MarqueeBanner text="DISCOVER EVENTS · CONCERTS TRIVIA & MORE · GO PLAY EAT" />

          <div style={{ paddingBottom: 60 }}>
            {view === "detail" && selectedEvent ? (
              <EventDetail
                event={selectedEvent}
                onBack={closeDetail}
                userVote={userVotes[selectedEvent.id] || null}
                onVote={handleVote}
                isSaved={savedEventIds.has(selectedEvent.id)}
                onToggleSave={handleToggleSave}
                payoutLevels={payoutLevels}
                isFollowed={followedBusinessIds.has(selectedEvent.businessId)}
                onToggleFollow={handleToggleFollow}
                onNotify={showToast}
              />
            ) : (
              <>
                <div style={{ marginBottom: 24, animation: "fadeIn 0.5s ease 0.15s both" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                    <div>
                      <SectionLabel text="EVENTS" />
                      <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 32, fontWeight: 700, color: TEXT_PRIMARY, lineHeight: 1.1, marginBottom: 8 }}>What&apos;s Happening</h1>
                    </div>
                    <NotificationBell />
                  </div>
                  <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: TEXT_DIM, lineHeight: 1.5 }}>Concerts, trivia, tastings & more near you.</p>
                </div>

                <FiltersPanel
                  filters={filters}
                  setFilters={setFilters}
                  filtersOpen={filtersOpen}
                  setFiltersOpen={setFiltersOpen}
                  userZip={userZip}
                  setUserZip={setUserZip}
                  showSavedOnly={showSavedOnly}
                  setShowSavedOnly={setShowSavedOnly}
                  savedCount={savedEventIds.size}
                  showFollowedOnly={showFollowedOnly}
                  setShowFollowedOnly={setShowFollowedOnly}
                  followedCount={followedBusinessIds.size}
                  EVENT_CATEGORIES={EVENT_CATEGORIES}
                  VIBE_FILTERS={VIBE_FILTERS}
                />

                {/* Events content area */}
                <div data-tour="event-card">
                {/* Loading State */}
                {loading && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    {[0, 1, 2].map(i => <SkeletonCard key={i} index={i} />)}
                  </div>
                )}

                {/* Error State */}
                {error && !loading && (
                  <div style={{ textAlign: "center", padding: "60px 24px", animation: "fadeIn 0.5s ease both" }}>
                    <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.6 }}>⚠</div>
                    <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: TEXT_PRIMARY, marginBottom: 8 }}>Something went wrong</div>
                    <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: PINK, marginBottom: 24 }}>{error}</div>
                    <NeonBtn onClick={() => window.location.reload()}>Retry</NeonBtn>
                  </div>
                )}

                {/* Events List */}
                {!loading && !error && (
                  <div data-tour="event-list">
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      marginBottom: 20, animation: "fadeIn 0.4s ease 0.3s both",
                    }}>
                      <span style={{ fontFamily: FONT_BODY, fontSize: 11, color: TEXT_MUTED, letterSpacing: "0.06em" }}>
                        {sortedEvents.length} event{sortedEvents.length !== 1 ? "s" : ""} found
                      </span>
                      <div style={{ display: "flex", gap: 4, borderRadius: 6, border: `1px solid ${CARD_BORDER}`, overflow: "hidden" }}>
                        {(["list", "calendar"] as const).map(m => (
                          <button key={m} onClick={() => setViewMode(m)} style={{
                            padding: "6px 12px", border: "none", cursor: "pointer",
                            background: viewMode === m ? `rgba(${NEON_RGB},0.12)` : "transparent",
                            color: viewMode === m ? NEON : TEXT_MUTED,
                            fontSize: 10, fontWeight: 700, fontFamily: FONT_BODY,
                            textTransform: "uppercase", letterSpacing: "0.06em",
                            transition: "all 0.2s",
                          }}>
                            {m === "list" ? "☰ List" : "📅 Calendar"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {viewMode === "calendar" && (() => {
                      const year = calendarMonth.getFullYear();
                      const month = calendarMonth.getMonth();
                      const firstDay = new Date(year, month, 1).getDay();
                      const daysInMonth = new Date(year, month + 1, 0).getDate();
                      const todayStr = getTodayStr();
                      const eventsByDate: Record<string, Event[]> = {};
                      sortedEvents.forEach(e => {
                        if (!eventsByDate[e.date]) eventsByDate[e.date] = [];
                        eventsByDate[e.date].push(e);
                      });
                      const cells = [];
                      for (let i = 0; i < firstDay; i++) cells.push(<div key={`blank-${i}`} />);
                      for (let d = 1; d <= daysInMonth; d++) {
                        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                        const dayEvents = eventsByDate[dateStr] || [];
                        const isToday = dateStr === todayStr;
                        cells.push(
                          <div key={d} style={{
                            minHeight: 64, padding: "4px 2px", borderRadius: 4,
                            background: isToday ? `rgba(${NEON_RGB},0.06)` : "transparent",
                            border: isToday ? `1px solid rgba(${NEON_RGB},0.2)` : `1px solid ${CARD_BORDER}`,
                            cursor: dayEvents.length > 0 ? "pointer" : "default",
                            transition: "background 0.2s",
                          }} onClick={() => { if (dayEvents.length > 0) openDetail(dayEvents[0]); }}>
                            <div style={{ fontSize: 10, fontWeight: isToday ? 700 : 500, color: isToday ? NEON : TEXT_DIM, textAlign: "center", marginBottom: 2 }}>{d}</div>
                            {dayEvents.slice(0, 2).map(ev => (
                              <div key={ev.id} onClick={(e) => { e.stopPropagation(); openDetail(ev); }} style={{
                                fontSize: 8, fontWeight: 600, color: TEXT_PRIMARY, padding: "2px 4px",
                                background: `rgba(${NEON_RGB},0.15)`, borderRadius: 2, marginBottom: 1,
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                cursor: "pointer", fontFamily: FONT_BODY,
                              }}>{ev.title}</div>
                            ))}
                            {dayEvents.length > 2 && (
                              <div style={{ fontSize: 8, color: NEON, textAlign: "center", fontWeight: 600 }}>+{dayEvents.length - 2}</div>
                            )}
                          </div>
                        );
                      }
                      return (
                        <div style={{ marginBottom: 24, animation: "fadeIn 0.3s ease both" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                            <button onClick={() => setCalendarMonth(new Date(year, month - 1, 1))} style={{ background: "none", border: `1px solid ${CARD_BORDER}`, borderRadius: 4, padding: "6px 12px", color: TEXT_DIM, fontSize: 14, cursor: "pointer" }}>←</button>
                            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 700, color: TEXT_PRIMARY }}>{calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
                            <button onClick={() => setCalendarMonth(new Date(year, month + 1, 1))} style={{ background: "none", border: `1px solid ${CARD_BORDER}`, borderRadius: 4, padding: "6px 12px", color: TEXT_DIM, fontSize: 14, cursor: "pointer" }}>→</button>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
                            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
                              <div key={d} style={{ fontSize: 9, fontWeight: 700, color: TEXT_MUTED, textAlign: "center", padding: "4px 0", letterSpacing: "0.05em", fontFamily: FONT_BODY }}>{d}</div>
                            ))}
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
                            {cells}
                          </div>
                        </div>
                      );
                    })()}

                    <div style={{ display: viewMode === "list" ? "flex" : "none", flexDirection: "column", gap: 20 }}>
                      {sortedEvents.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "80px 24px", animation: "fadeIn 0.5s ease both" }}>
                          <div style={{ fontSize: 48, marginBottom: 16 }}>◈</div>
                          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, color: TEXT_PRIMARY, marginBottom: 8 }}>
                            {events.length === 0 ? "No Events Yet" : "No Events Found"}
                          </div>
                          <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: TEXT_DIM, marginBottom: 24 }}>
                            {events.length === 0
                              ? "Check back soon — events will appear here once businesses publish them."
                              : "Try adjusting your filters or search terms."}
                          </div>
                          {events.length > 0 && (
                            <NeonBtn onClick={() => setFilters({
                              category: "all", date: "all", dateFrom: "", dateTo: "", price: "all", distance: "all",
                              timeOfDay: "all", capacity: "all", vibes: [], sort: "date-asc", search: "",
                            })}>Clear All Filters</NeonBtn>
                          )}
                        </div>
                      ) : (
                        sortedEvents.map((event, idx) => (
                          <EventCard
                            key={event.id}
                            event={event}
                            index={idx}
                            onOpenDetail={openDetail}
                            userVote={userVotes[event.id] || null}
                            onVote={handleVote}
                            isSaved={savedEventIds.has(event.id)}
                            onToggleSave={handleToggleSave}
                            isFollowed={followedBusinessIds.has(event.businessId)}
                            onToggleFollow={handleToggleFollow}
                            onNotify={showToast}
                            dataTour={undefined}
                          />
                        ))
                      )}
                    </div>
                  </div>
                )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      {/* Toast notification */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          padding: "12px 16px", borderRadius: 12,
          background: "rgba(0,0,0,0.9)", border: "1px solid rgba(255,255,255,0.1)",
          backdropFilter: "blur(16px)", color: "#fff",
          fontSize: 13, fontWeight: 500, fontFamily: FONT_BODY,
          zIndex: 9999, animation: "toastIn 0.3s ease both",
          boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
          maxWidth: "90vw", textAlign: "center",
        }}>
          {toast}
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
          illustration={tour.stepIndex >= 0 ? eventsTourIllustrations[tour.stepIndex] : undefined}
        />
      )}
    </>
  );
}
