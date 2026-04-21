"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { fetchPlatformTierConfig, getVisitRangeLabel, DEFAULT_VISIT_THRESHOLDS, type VisitThreshold } from "@/lib/platformSettings";
import { fetchTagsByCategory, type TagCategory } from "@/lib/availableTags";
import { loadFilterPreferences } from "@/lib/filterPreferences";
import { getBusinessDistance, ZIP_COORDS } from "@/lib/zipUtils";
import NotificationBell from "@/components/NotificationBell";
import OnboardingTooltip from "@/components/OnboardingTooltip";
import { useOnboardingTour, type TourStep } from "@/lib/useOnboardingTour";
import { GroupCreateAnim, JoinCodeAnim, GameListAnim } from "@/components/TourIllustrations";

// ═══════════════════════════════════════════════════════════════
// LETSGO — GROUP VOTE v2
// Neon: #00FF87  ·  RGB: 0,255,135  ·  Icon: ⬡
// ═══════════════════════════════════════════════════════════════

// ── Type Definitions ────────────────────────────────────────
type ViewState = "hub" | "setup" | "selection" | "voting" | "winner";
type GameStatus = "active" | "completed";

interface Player {
  id: string;
  name: string;
  avatar: string;
  isGameMaster?: boolean;
}

interface Selection {
  id: string;
  name: string;
  type: string;
  votes: number;
  img: string;
  images: string[];
  voted: boolean;
}

interface Winner {
  businessId: string;
  name: string;
  type: string;
  img: string;
  images: string[];
  gradient: string;
  address: string;
  phone: string;
  website: string;
  priceLevel: string;
  blurb: string;
  tags: string[];
  hours: Record<string, string>;
  payout: number[];
}

interface PlayerActivity {
  id: string;
  name: string;
  avatar: string;
  isGameMaster: boolean;
  hasContributed: boolean;
  count: number;
}

interface Game {
  id: string;
  gameCode: string;
  name: string;
  status: GameStatus;
  currentRound: number;
  totalRounds: number;
  players: Player[];
  advancePerRound: number[];
  votesHidden: boolean;
  allowInvites: boolean;
  roundEndTime?: number;
  selections: Selection[];
  createdAt: string;
  winner?: Winner;
  winners?: Winner[];
  location?: string;
  createdBy?: string;
  playerActivity: PlayerActivity[];
  totalUniqueSelections: number;
}

interface Business {
  id: string;
  name: string;
  type: string;
  category: string;
  vibe: string;
  dist: string;
  img: string;
  images: string[];
  rating: number;
  priceLevel: string;
  tags: string[];
  zip: string;
  latitude: number | null;
  longitude: number | null;
  gradient: string;
}

interface Friend {
  id: string;
  name: string;
  avatarUrl: string | null;
  status?: string;
}

interface FilterState {
  category: string[];
  price: string[];
  sort: string;
  openNow: boolean;
  distance: number;
  tags: string[];
  browseFrom: string;
}

interface GameHubProps {
  games: Game[];
  loading: boolean;
  onNewGame: () => void;
  onOpenGame: (game: Game) => void;
  onGoHome: () => void;
  onJoinByCode: (code: string) => void;
  onLeaveGame: (gameId: string) => Promise<void>;
  onDeleteGame: (gameId: string) => Promise<void>;
}

interface GameCardProps {
  game: Game;
  index: number;
  onClick: () => void;
  onLeave?: () => void;
}

interface GameSetupProps {
  friends: Friend[];
  onBack: () => void;
  onCreateGame: (config: {
    name: string; location: string; totalRounds: number; advancePerRound: number[];
    timeBetweenRounds: string; votesHidden: boolean; allowInvites: boolean;
    startDate?: string; endDate?: string; invitedFriendIds: string[];
  }) => Promise<string | null>;
}

interface ManagePlayersPanelProps {
  players: Player[];
  isGameMaster: boolean;
  friends: Friend[];
  gameId: string;
  token: string;
  onPlayersChanged: () => void;
}

interface SelectionPhaseProps {
  game: Game | null;
  businesses: Business[];
  friends: Friend[];
  token: string;
  onBack: () => void;
  onAdvance: () => void;
  onAddSelection: (bizId: string) => void;
  onRemoveSelection: (bizId: string) => void;
  onRefresh: () => void;
}

interface BizDiscoveryCardProps {
  biz: Business;
  idx: number;
  isSel: Business | undefined;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onToggleSelect: (e: React.MouseEvent) => void;
}

interface VotingPhaseProps {
  game: Game;
  friends: Friend[];
  token: string;
  onBack: () => void;
  onAdvance: () => void;
  onSubmitVotes: (bizIds: string[]) => void;
  onRefresh: () => void;
  roundNum: number;
  totalRounds: number;
  advanceCount: number;
}

interface VoteCardProps {
  item: Selection;
  idx: number;
  isVoted: boolean;
  maxReached: boolean;
  hidden: boolean;
  gradient: string;
  onToggle: () => void;
}

interface WinnerRevealProps {
  game: Game | null;
  onBack: () => void;
  visitThresholds?: VisitThreshold[];
}

interface NeonBtnProps {
  children: React.ReactNode;
  onClick?: () => void;
  color?: string;
  colorRGB?: string;
  variant?: "outline" | "filled";
  disabled?: boolean;
  style?: React.CSSProperties;
}

interface AvatarStackProps {
  players: Player[];
  size?: number;
}

interface RoundProgressProps {
  current: number;
  total: number;
  isCompleted?: boolean;
}

interface MarqueeBannerProps {
  text: string;
}

interface DotGridProps {
  opacity?: number;
  color?: string;
}

interface BackBtnProps {
  onClick: () => void;
  label?: string;
}

interface SectionLabelProps {
  text: string;
  color?: string;
}

// ── Constants ───────────────────────────────────────────────
const NEON = "#00FF87";
const NEON_RGB = "0,255,135";
const BG = "#060610";
const CARD_BG = "#0C0C14";
const CARD_BORDER = "rgba(255,255,255,0.06)";
const TEXT_PRIMARY = "#fff";
const TEXT_DIM = "rgba(255,255,255,0.4)";
const TEXT_MUTED = "rgba(255,255,255,0.2)";
const PINK = "#FF2D78";
const PINK_RGB = "255,45,120";
const YELLOW = "#FFD600";
const BLUE = "#00E5FF";
const PURPLE = "#D050FF";
const ORANGE = "#FF6B2D";

const FONT_DISPLAY = "'Clash Display', 'DM Sans', sans-serif";
const FONT_BODY = "'DM Sans', sans-serif";

// ── Gradient palette for businesses ──────────────────────────
const BIZ_GRADIENTS = [
  "linear-gradient(135deg, #1a0a2e 0%, #3d1a6e 50%, #6b21a8 100%)",
  "linear-gradient(135deg, #0f2027 0%, #2c5364 50%, #00b4d8 100%)",
  "linear-gradient(135deg, #1b0000 0%, #6b1010 50%, #c94b4b 100%)",
  "linear-gradient(135deg, #0a1628 0%, #1a3a5c 50%, #4a90d9 100%)",
  "linear-gradient(135deg, #1a1a0a 0%, #3d3a1a 50%, #6b6421 100%)",
  "linear-gradient(135deg, #1a0a1a 0%, #4a1a4a 50%, #d4639a 100%)",
  "linear-gradient(135deg, #0a0a28 0%, #1a1a5c 50%, #3a3ad9 100%)",
  "linear-gradient(135deg, #280a0a 0%, #5c1a1a 50%, #d93a3a 100%)",
  "linear-gradient(135deg, #0a1a0a 0%, #1a3d1a 50%, #21a84a 100%)",
  "linear-gradient(135deg, #0a1a28 0%, #1a3a5c 50%, #4a90d9 100%)",
  "linear-gradient(135deg, #0a280a 0%, #1a5c1a 50%, #3ad93a 100%)",
  "linear-gradient(135deg, #28280a 0%, #5c5c1a 50%, #d9c03a 100%)",
];

function getBizGradient(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  return BIZ_GRADIENTS[Math.abs(hash) % BIZ_GRADIENTS.length];
}

function getInitial(name: string): string {
  return name ? name.charAt(0).toUpperCase() : "?";
}

// ── Image Carousel (scroll-snap, matching 5v3v1 pattern) ──
const CardImageCarousel = ({ images, gradient, height = 140, children }: {
  images: string[]; gradient: string; height?: number;
  children?: React.ReactNode;
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [imgIdx, setImgIdx] = useState(0);
  const hasImages = images.length > 0;
  const total = hasImages ? images.length : 1;

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setImgIdx(idx);
  };

  return (
    <div style={{ position: "relative", width: "100%", height, overflow: "hidden" }}>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="gv-carousel"
        style={{
          display: "flex", width: "100%", height: "100%",
          overflowX: hasImages && images.length > 1 ? "auto" : "hidden",
          scrollSnapType: "x mandatory",
          scrollbarWidth: "none",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {hasImages ? images.map((url, i) => (
          <div key={i} style={{ flex: "0 0 100%", width: "100%", height: "100%", scrollSnapAlign: "start" }}>
            <img src={url} alt="Business photo" style={{ width: "100%", height: "100%", objectFit: "cover" }} draggable={false} />
          </div>
        )) : (
          <div style={{ flex: "0 0 100%", width: "100%", height: "100%", background: gradient }} />
        )}
      </div>

      {/* Dot indicators */}
      {total > 1 && (
        <div style={{
          position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)",
          display: "flex", gap: 4, zIndex: 5, padding: "3px 8px", borderRadius: 12,
          background: "rgba(0,0,0,0.45)", backdropFilter: "blur(8px)",
        }}>
          {images.map((_, i) => (
            <span key={i} style={{
              width: imgIdx === i ? 14 : 5, height: 5, borderRadius: 3,
              background: imgIdx === i ? NEON : "rgba(255,255,255,0.35)",
              transition: "all 0.25s ease",
              boxShadow: imgIdx === i ? `0 0 6px rgba(${NEON_RGB}, 0.5)` : "none",
            }} />
          ))}
        </div>
      )}

      {/* Overlaid children (badges, etc.) */}
      {children}
    </div>
  );
};

// ── API helper ──────────────────────────────────────────────
async function apiFetch(path: string, token: string, options: RequestInit = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...options.headers },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// Fallbacks if DB fetch fails
const DEFAULT_FILTER_CATEGORIES = ["All", "Restaurant", "Bar", "Coffee", "Entertainment", "Activity", "Nightclub", "Brewery", "Winery", "Food Truck", "Bakery", "Lounge", "Pub", "Sports Bar", "Karaoke", "Arcade", "Bowling", "Mini Golf", "Escape Room", "Theater", "Comedy Club", "Art Gallery", "Museum", "Spa", "Gym"];
const DEFAULT_CUISINE_FILTERS = ["American", "Italian", "Mexican", "Chinese", "Japanese", "Thai", "Indian", "Korean", "Vietnamese", "Mediterranean", "Greek", "French", "BBQ", "Seafood", "Sushi", "Ramen", "Pizza", "Burgers", "Tacos", "Farm-to-Table", "Fusion"];
const DEFAULT_VIBE_FILTERS = ["Romantic", "Chill", "Lively", "Upscale", "Casual", "Trendy", "Cozy", "Retro", "Modern", "Rooftop", "Waterfront", "Hidden Gem", "Instagrammable", "Speakeasy", "Dive Bar", "Sports Vibe", "Artsy"];
const PRICE_FILTERS = ["Any", "$", "$$", "$$$", "$$$$"];
const PRICE_TOOLTIPS: Record<string, string> = { "$": "Under $15/person", "$$": "$15–$30/person", "$$$": "$30–$60/person", "$$$$": "$60+/person" };
const SORT_OPTIONS = ["Nearest", "Most Popular", "Highest Payout", "Highest Rated", "Trending"];

// (Mock data removed — real data fetched from API)

// ── Global Keyframes ────────────────────────────────────────
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&display=swap');

    @keyframes borderTravelGreen {
      0% { background-position: 0% 50%; }
      100% { background-position: 300% 50%; }
    }
    @keyframes neonFlickerGreen {
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
    @keyframes pulseGlow {
      0%, 100% { box-shadow: 0 0 8px rgba(${NEON_RGB}, 0.3), 0 0 20px rgba(${NEON_RGB}, 0.1); }
      50% { box-shadow: 0 0 16px rgba(${NEON_RGB}, 0.5), 0 0 40px rgba(${NEON_RGB}, 0.2); }
    }
    @keyframes confettiDrop {
      0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
      100% { transform: translateY(80px) rotate(720deg); opacity: 0; }
    }
    @keyframes crownBounce {
      0%, 100% { transform: translateY(0) scale(1); }
      50% { transform: translateY(-8px) scale(1.1); }
    }
    @keyframes marqueeScroll {
      from { transform: translateX(0); }
      to { transform: translateX(-50%); }
    }
    @keyframes votePopIn {
      0% { transform: scale(0.8); opacity: 0; }
      60% { transform: scale(1.08); }
      100% { transform: scale(1); opacity: 1; }
    }
    @keyframes cardShimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    @keyframes floatUp {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-6px); }
    }
    @keyframes ctaPulse {
      0%, 100% { box-shadow: 0 0 6px rgba(255,214,0,0.15), 0 0 20px rgba(255,214,0,0.05); }
      50% { box-shadow: 0 0 18px rgba(255,214,0,0.4), 0 0 40px rgba(255,214,0,0.15); }
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: ${BG}; }

    ::-webkit-scrollbar { width: 4px; height: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(${NEON_RGB}, 0.2); border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: rgba(${NEON_RGB}, 0.4); }

    .gv-carousel::-webkit-scrollbar { display: none; }

    input[type="number"]::-webkit-inner-spin-button,
    input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
    input[type="number"] { -moz-appearance: textfield; }
  `}</style>
);

// ── Shared Components ───────────────────────────────────────
const MarqueeBanner = ({ text }: MarqueeBannerProps) => {
  const content = `${text}     ⬡     ${text}     ⬡     ${text}     ⬡     `;
  return (
    <div style={{ overflow: "hidden", whiteSpace: "nowrap", padding: "10px 0", borderTop: `1px solid ${CARD_BORDER}`, borderBottom: `1px solid ${CARD_BORDER}`, margin: "0 -28px 28px" }}>
      <div style={{ display: "inline-block", animation: "marqueeScroll 30s linear infinite" }}>
        <span style={{ fontSize: 11, color: TEXT_MUTED, letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 600, fontFamily: FONT_BODY }}>{content}</span>
        <span style={{ fontSize: 11, color: TEXT_MUTED, letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 600, fontFamily: FONT_BODY }}>{content}</span>
      </div>
    </div>
  );
};

const NeonBtn = ({ children, onClick, color = NEON, colorRGB = NEON_RGB, variant = "outline", disabled = false, style: sx = {} }: NeonBtnProps) => {
  const [h, setH] = useState(false);
  const f = variant === "filled";
  return (
    <button onClick={disabled ? undefined : onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} disabled={disabled}
      style={{
        fontFamily: FONT_BODY, fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase",
        padding: "10px 22px", borderRadius: 3, cursor: disabled ? "not-allowed" : "pointer", transition: "all 0.3s ease",
        border: f ? "none" : `1px solid rgba(${colorRGB}, ${h && !disabled ? 0.8 : 0.3})`,
        background: f ? (h && !disabled ? color : `rgba(${colorRGB}, 0.85)`) : (h && !disabled ? `rgba(${colorRGB}, 0.1)` : "transparent"),
        color: f ? BG : (h && !disabled ? color : TEXT_DIM), opacity: disabled ? 0.4 : 1, ...sx,
      }}>{children}</button>
  );
};

const AvatarStack = ({ players, size = 32 }: AvatarStackProps) => (
  <div style={{ display: "flex", alignItems: "center" }}>
    {players.slice(0, 5).map((p, i) => (
      <div key={p.id} title={p.name} style={{
        width: size, height: size, borderRadius: "50%", background: CARD_BG,
        border: `2px solid ${p.isGameMaster ? NEON : "rgba(255,255,255,0.1)"}`,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.5,
        marginLeft: i > 0 ? -8 : 0, zIndex: players.length - i, position: "relative",
        boxShadow: p.isGameMaster ? `0 0 8px rgba(${NEON_RGB}, 0.4)` : "none",
        overflow: "hidden",
      }}>
        {p.avatar && (p.avatar.startsWith("http") || p.avatar.startsWith("/")) ? (
          <img src={p.avatar} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span style={{ fontFamily: FONT_BODY, fontWeight: 700, color: TEXT_DIM, fontSize: size * 0.4 }}>
            {p.avatar || getInitial(p.name)}
          </span>
        )}
      </div>
    ))}
    {players.length > 5 && (
      <div style={{ width: size, height: size, borderRadius: "50%", background: "rgba(255,255,255,0.06)",
        border: "2px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 10, color: TEXT_DIM, fontWeight: 600, marginLeft: -8, fontFamily: FONT_BODY }}>+{players.length - 5}</div>
    )}
  </div>
);

const RoundProgress = ({ current, total, isCompleted }: RoundProgressProps) => (
  <div style={{ display: "flex", alignItems: "center", gap: 4, width: "100%" }}>
    {Array.from({ length: total + 1 }).map((_, i) => (
      <div key={i} style={{ flex: 1, position: "relative" }}>
        <div style={{
          height: 3, borderRadius: 2,
          background: i < current || isCompleted ? NEON : i === current && !isCompleted ? `linear-gradient(90deg, ${NEON}, rgba(${NEON_RGB}, 0.2))` : "rgba(255,255,255,0.08)",
          boxShadow: (i < current || isCompleted) ? `0 0 6px rgba(${NEON_RGB}, 0.4)` : "none", transition: "all 0.4s ease",
        }} />
        {i === current && !isCompleted && (
          <div style={{ position: "absolute", top: -3, right: 0, width: 9, height: 9, borderRadius: "50%", background: NEON, boxShadow: `0 0 8px ${NEON}`, animation: "pulseGlow 2s ease infinite" }} />
        )}
      </div>
    ))}
  </div>
);

const DotGrid = ({ opacity = 0.04, color = NEON }: DotGridProps) => (
  <div style={{ position: "absolute", inset: 0, opacity, backgroundImage: `radial-gradient(circle, ${color} 1px, transparent 1px)`, backgroundSize: "24px 24px", backgroundPosition: "12px 12px", pointerEvents: "none" }} />
);

const BackBtn = ({ onClick, label = "Back" }: BackBtnProps) => (
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

const SectionLabel = ({ text, color = NEON }: SectionLabelProps) => (
  <div style={{
    display: "inline-block", fontFamily: FONT_BODY, fontSize: 10, fontWeight: 700,
    letterSpacing: "0.2em", color, marginBottom: 12, padding: "4px 0",
    borderBottom: `1px solid ${color}40`, animation: "neonFlickerGreen 12s ease-in-out infinite",
  }}>⬡ {text}</div>
);

// ═══════════════════════════════════════════════════════════════
// GAME HUB
// ═══════════════════════════════════════════════════════════════
const GameHub = ({ games, loading, onNewGame, onOpenGame, onGoHome, onJoinByCode, onLeaveGame, onDeleteGame }: GameHubProps) => {
  const [tab, setTab] = useState("active");
  const [joinCode, setJoinCode] = useState("");
  const [joinFocused, setJoinFocused] = useState(false);
  const [joining, setJoining] = useState(false);
  const [leaveConfirmId, setLeaveConfirmId] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const activeGames = games.filter((g) => g.status === "active");
  const pastGames = games.filter((g) => g.status === "completed");

  const handleJoin = async () => {
    if (joinCode.length < 4 || joining) return;
    setJoining(true);
    try { await onJoinByCode(joinCode); setJoinCode(""); }
    finally { setJoining(false); }
  };

  const leaveConfirmGame = leaveConfirmId ? games.find((g) => g.id === leaveConfirmId) : null;
  const leaveConfirmIsGM = leaveConfirmGame?.players.some((p) => p.name === "You" && p.isGameMaster) ?? false;

  const handleLeaveGame = async () => {
    if (!leaveConfirmId || leaving) return;
    setLeaving(true);
    try {
      if (leaveConfirmIsGM) { await onDeleteGame(leaveConfirmId); }
      else { await onLeaveGame(leaveConfirmId); }
    }
    finally { setLeaving(false); setLeaveConfirmId(null); }
  };

  return (
    <div style={{ animation: "fadeIn 0.5s ease both" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <SectionLabel text="GROUP VOTE" />
            <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 32, fontWeight: 700, color: TEXT_PRIMARY, lineHeight: 1.1, marginBottom: 8 }}>Your Games</h1>
          </div>
          <NotificationBell />
        </div>
        <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: TEXT_DIM, lineHeight: 1.5 }}>Everyone votes, one place wins.</p>
      </div>

      {/* Join Game with Code */}
      <div data-tour="group-join" style={{
        padding: "16px 20px", borderRadius: 4, marginBottom: 16,
        background: "rgba(255,255,255,0.02)", border: `1px solid ${joinFocused ? `rgba(${NEON_RGB}, 0.3)` : CARD_BORDER}`,
        transition: "border-color 0.3s ease",
      }}>
        <div style={{ fontFamily: FONT_BODY, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: TEXT_DIM, marginBottom: 10 }}>
          Join a Game
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            value={joinCode}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="Enter game code (e.g. GV-7X2K)"
            maxLength={8}
            onFocus={() => setJoinFocused(true)}
            onBlur={() => setJoinFocused(false)}
            style={{
              flex: 1, fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 700, color: TEXT_PRIMARY,
              background: "rgba(255,255,255,0.04)", border: `1px solid rgba(${NEON_RGB}, 0.15)`,
              borderRadius: 4, padding: "10px 14px", outline: "none", letterSpacing: "0.15em",
              textTransform: "uppercase", textAlign: "center",
            }}
          />
          <NeonBtn variant="filled" disabled={joinCode.length < 4 || joining} onClick={handleJoin} style={{ padding: "10px 18px" }}>
            {joining ? "Joining..." : "Join"}
          </NeonBtn>
        </div>
      </div>

      {/* New Game CTA */}
      <div data-tour="group-create" onClick={onNewGame} style={{
        position: "relative", borderRadius: 4, cursor: "pointer", marginBottom: 28,
        overflow: "hidden", padding: 1,
        background: `linear-gradient(90deg, transparent, ${NEON}, transparent, ${NEON}, transparent)`,
        backgroundSize: "300% 100%", animation: "borderTravelGreen 10s linear infinite",
      }}>
        <div style={{
          background: CARD_BG, borderRadius: 3, padding: "20px 24px",
          display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", overflow: "hidden",
        }}>
          <DotGrid opacity={0.05} />
          <div style={{ position: "relative", zIndex: 2, display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 6, border: `1px solid rgba(${NEON_RGB}, 0.3)`,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
              background: `rgba(${NEON_RGB}, 0.05)`, color: NEON,
            }}>+</div>
            <div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 700, color: TEXT_PRIMARY }}>Start a New Game</div>
              <div style={{ fontFamily: FONT_BODY, fontSize: 11, color: TEXT_DIM, marginTop: 2 }}>Set up rounds, invite friends, let the voting begin</div>
            </div>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ position: "relative", zIndex: 2 }}>
            <path d="M5 12h14M13 6l6 6-6 6" stroke={NEON} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* Tab Switcher */}
      <div style={{ display: "flex", gap: 0, marginBottom: 24, borderBottom: `1px solid ${CARD_BORDER}` }}>
        {[ { id: "active", label: "In Progress", count: activeGames.length }, { id: "past", label: "Past Games", count: pastGames.length } ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            fontFamily: FONT_BODY, fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase",
            padding: "12px 20px", background: "none", border: "none", cursor: "pointer",
            color: tab === t.id ? NEON : TEXT_DIM, borderBottom: tab === t.id ? `2px solid ${NEON}` : "2px solid transparent", transition: "all 0.3s ease",
          }}>
            {t.label}
            <span style={{ marginLeft: 8, fontSize: 10, padding: "2px 7px", borderRadius: 10,
              background: tab === t.id ? `rgba(${NEON_RGB}, 0.15)` : "rgba(255,255,255,0.06)",
              color: tab === t.id ? NEON : TEXT_DIM }}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Game Cards */}
      <div data-tour="group-games" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {(tab === "active" ? activeGames : pastGames).map((game, idx) => (
          <GameCard key={game.id} game={game} index={idx} onClick={() => onOpenGame(game)} onLeave={game.status === "active" ? () => setLeaveConfirmId(game.id) : undefined} />
        ))}
        {(tab === "active" ? activeGames : pastGames).length === 0 && (
          tab === "active" ? (
            <div onClick={onNewGame} style={{
              textAlign: "center", padding: "48px 20px", cursor: "pointer",
              borderRadius: 6, border: `1px solid ${YELLOW}30`,
              background: `${YELLOW}06`,
              animation: "ctaPulse 2.5s ease-in-out infinite",
            }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>⬡</div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 700, color: YELLOW, marginBottom: 6 }}>
                No active games
              </div>
              <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: TEXT_DIM }}>
                Tap here to start one!
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "60px 20px", color: TEXT_DIM, fontFamily: FONT_BODY, fontSize: 13 }}>
              No past games yet.
            </div>
          )
        )}
      </div>

      {/* Leave Game Confirmation Modal */}
      {leaveConfirmId && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", animation: "fadeIn 0.25s ease both",
        }} onClick={() => { if (!leaving) setLeaveConfirmId(null); }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            width: "90%", maxWidth: 380, borderRadius: 6, overflow: "hidden", padding: 1,
            background: `linear-gradient(135deg, rgba(${PINK_RGB}, 0.4), rgba(${PINK_RGB}, 0.1))`,
          }}>
            <div style={{ background: CARD_BG, borderRadius: 5, padding: "28px 24px", textAlign: "center" }}>
              {/* Warning icon */}
              <div style={{
                width: 56, height: 56, borderRadius: 16, margin: "0 auto 18px",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: `rgba(${PINK_RGB}, 0.1)`, border: `1px solid rgba(${PINK_RGB}, 0.25)`,
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke={PINK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 700, color: TEXT_PRIMARY, marginBottom: 10 }}>
                {leaveConfirmIsGM ? "Delete This Game?" : "Leave This Game?"}
              </h3>
              <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: TEXT_DIM, lineHeight: 1.55, marginBottom: 6 }}>
                {leaveConfirmIsGM
                  ? <>Are you sure you want to delete <span style={{ color: NEON, fontWeight: 600 }}>{leaveConfirmGame?.name || "this game"}</span>? This will cancel the game for all players.</>
                  : <>Are you sure you want to remove yourself from <span style={{ color: NEON, fontWeight: 600 }}>{leaveConfirmGame?.name || "this game"}</span>?</>
                }
              </p>
              <p style={{ fontFamily: FONT_BODY, fontSize: 11, color: TEXT_MUTED, lineHeight: 1.5, marginBottom: 24 }}>
                {leaveConfirmIsGM
                  ? "This action cannot be undone. All players will be notified that the game has been cancelled."
                  : "You won\u2019t receive notifications or be able to vote. The Game Master can re-invite you if you change your mind."
                }
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setLeaveConfirmId(null)} disabled={leaving} style={{
                  flex: 1, padding: "12px 0", borderRadius: 4, cursor: "pointer",
                  fontFamily: FONT_BODY, fontSize: 12, fontWeight: 600, letterSpacing: "0.06em",
                  background: "rgba(255,255,255,0.04)", border: `1px solid ${CARD_BORDER}`, color: TEXT_DIM,
                  transition: "all 0.25s ease",
                }}>
                  Cancel
                </button>
                <button onClick={handleLeaveGame} disabled={leaving} style={{
                  flex: 1, padding: "12px 0", borderRadius: 4, cursor: "pointer",
                  fontFamily: FONT_BODY, fontSize: 12, fontWeight: 700, letterSpacing: "0.06em",
                  background: `rgba(${PINK_RGB}, 0.15)`, border: `1px solid rgba(${PINK_RGB}, 0.4)`, color: PINK,
                  transition: "all 0.25s ease", opacity: leaving ? 0.6 : 1,
                }}>
                  {leaving ? (leaveConfirmIsGM ? "Deleting..." : "Leaving...") : (leaveConfirmIsGM ? "Yes, Delete Game" : "Yes, Leave Game")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const GameCard = ({ game, index, onClick, onLeave }: GameCardProps) => {
  const [hovered, setHovered] = useState(false);
  const isC = game.status === "completed";
  const isGM = game.players.some((p) => p.name === "You" && p.isGameMaster);
  return (
    <div onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{
      position: "relative", borderRadius: 4, cursor: "pointer",
      animation: `slideUp 0.5s ease ${0.1 + index * 0.08}s both`,
      transition: "transform 0.35s cubic-bezier(0.23,1,0.32,1)", transform: hovered ? "translateY(-2px)" : "none",
    }}>
      <div style={{
        position: "absolute", inset: -2, borderRadius: 6,
          background: `linear-gradient(90deg, transparent, ${isC ? TEXT_DIM : NEON}, transparent, ${isC ? TEXT_DIM : NEON}, transparent)`,
          backgroundSize: "300% 100%", animation: "borderTravelGreen 12s linear infinite",
          opacity: hovered ? 0.7 : 0.2, transition: "opacity 0.4s ease",
        }} />
        <div style={{ position: "relative", background: CARD_BG, borderRadius: 3, padding: "18px 22px", overflow: "hidden" }}>
          <DotGrid opacity={hovered ? 0.06 : 0.025} />
          <div style={{ position: "relative", zIndex: 2 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 17, fontWeight: 700, color: TEXT_PRIMARY, lineHeight: 1.2 }}>{game.name}</h3>
                  {isC && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "3px 8px", borderRadius: 3, background: "rgba(255,255,255,0.06)", color: TEXT_DIM, fontFamily: FONT_BODY }}>Complete</span>}
                </div>
                <div style={{ fontFamily: FONT_BODY, fontSize: 11, color: TEXT_DIM }}>
                  {isC ? (<span>Winner: <span style={{ color: NEON, fontWeight: 600 }}>{game.winner?.name}</span></span>)
                    : (<span>Round {game.currentRound} of {game.totalRounds} · {game.currentRound === 1 ? "Selection Phase" : "Voting Phase"}</span>)}
                </div>
              </div>
              <AvatarStack players={game.players} size={28} />
            </div>
            <div style={{ marginBottom: 14 }}><RoundProgress current={game.currentRound} total={game.totalRounds} isCompleted={isC} /></div>
            {/* Player count + advancing — own row, centered */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ fontFamily: FONT_BODY, fontSize: 10, color: TEXT_MUTED }}>{game.players.length} players</span>
              {!isC && <span style={{ fontFamily: FONT_BODY, fontSize: 10, color: TEXT_MUTED }}>Advancing: {game.advancePerRound?.join(" \u2192 ")}</span>}
            </div>

            {/* Bottom row: Remove/Delete left, Play/View right */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              {/* Left: Remove / Delete button (active games only) */}
              {!isC && onLeave ? (
                <div onClick={(e) => { e.stopPropagation(); onLeave(); }} style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 2,
                  border: `1px solid rgba(${isC ? "255,255,255" : NEON_RGB}, 0.15)`,
                  background: "transparent", transition: "all 0.3s ease", cursor: "pointer",
                }}>
                  <span style={{ fontFamily: FONT_BODY, fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", color: TEXT_MUTED, textTransform: "uppercase", transition: "color 0.3s ease" }}>
                    {isGM ? "Delete Game" : "Leave Game"}
                  </span>
                </div>
              ) : <div />}

              {/* Right: Play / View button */}
              <div style={{
                display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 2,
                border: `1px solid rgba(${isC ? "255,255,255" : NEON_RGB}, ${hovered ? 0.5 : 0.15})`,
                background: hovered ? `rgba(${isC ? "255,255,255" : NEON_RGB}, 0.06)` : "transparent", transition: "all 0.3s ease",
              }}>
                <span style={{ fontFamily: FONT_BODY, fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", color: hovered ? (isC ? TEXT_DIM : NEON) : TEXT_MUTED, textTransform: "uppercase", transition: "color 0.3s ease" }}>
                  {isC ? "View" : "Play"}
                </span>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ transition: "transform 0.3s ease", transform: hovered ? "translateX(3px)" : "none" }}>
                  <path d="M3 8h10M9 4l4 4-4 4" stroke={hovered ? (isC ? TEXT_DIM : NEON) : TEXT_MUTED} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// GAME SETUP — Round 0
// ═══════════════════════════════════════════════════════════════
const GameSetup = ({ friends, onBack, onCreateGame }: GameSetupProps) => {
  const [step, setStep] = useState(0);
  const [gameName, setGameName] = useState("");
  const [location, setLocation] = useState("");
  const [rounds, setRounds] = useState(3);
  const [advancePerRound, setAdvancePerRound] = useState<number[]>([7, 3, 1]);
  const [timeBetween, setTimeBetween] = useState("2h");
  const [customTime, setCustomTime] = useState<{ value: string; unit: string }>({ value: "", unit: "h" });
  const [votesHidden, setVotesHidden] = useState(false);
  const [allowInvites, setAllowInvites] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [invitedFriends, setInvitedFriends] = useState<Friend[]>([]);
  const [createdGameCode, setCreatedGameCode] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [friendSearch, setFriendSearch] = useState("");

  // When rounds change, auto-generate descending advance numbers
  useEffect(() => {
    const presets: Record<number, number[]> = {
      2: [5, 1],
      3: [7, 3, 1],
      4: [10, 5, 3, 1],
      5: [12, 7, 4, 2, 1],
    };
    setAdvancePerRound(presets[rounds] || [7, 3, 1]);
  }, [rounds]);

  const updateAdvance = (roundIdx: number, val: number) => {
    const newAdv = [...advancePerRound];
    newAdv[roundIdx] = Math.max(1, val || 1);
    setAdvancePerRound(newAdv);
  };

  const toggleFriend = (friend: Friend) => {
    setInvitedFriends((prev) => prev.find((f) => f.id === friend.id) ? prev.filter((f) => f.id !== friend.id) : [...prev, friend]);
  };

  const handleLaunch = async () => {
    if (creating) return;
    setCreating(true);
    const timeValue = timeBetween === "custom" ? `${customTime.value}${customTime.unit}` : timeBetween;
    const code = await onCreateGame({
      name: gameName, location, totalRounds: rounds, advancePerRound,
      timeBetweenRounds: timeValue, votesHidden, allowInvites,
      startDate: startDate || undefined, endDate: endDate || undefined,
      invitedFriendIds: invitedFriends.map((f) => f.id),
    });
    setCreating(false);
    if (code) setCreatedGameCode(code);
  };

  const filteredFriends = friends.filter((f) =>
    f.name.toLowerCase().includes(friendSearch.toLowerCase())
  );

  const inputStyle: React.CSSProperties = {
    fontFamily: FONT_BODY, fontSize: 13, color: TEXT_PRIMARY,
    background: "rgba(255,255,255,0.04)", border: `1px solid rgba(${NEON_RGB}, 0.15)`,
    borderRadius: 4, padding: "10px 14px", outline: "none", width: "100%", transition: "border-color 0.3s ease",
  };
  const labelStyle: React.CSSProperties = {
    fontFamily: FONT_BODY, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
    textTransform: "uppercase", color: TEXT_DIM, marginBottom: 8, display: "block",
  };

  const isCustom = timeBetween === "custom";

  const stepLabels = ["Basics", "Rounds", "Rules", "Invite"];
  const stepTitles = ["Name & Location", "Rounds & Funnel", "Schedule & Rules", "Invite Your Crew"];
  const stepDescs = [
    "Give your game a name and tell us where you\u2019re going out.",
    "How many rounds of voting? Customize the elimination funnel.",
    "Set the timing and game rules.",
    "Who\u2019s playing tonight?",
  ];

  const backAction = step === 0 ? onBack : () => setStep(step - 1);

  return (
    <div style={{ animation: "fadeIn 0.5s ease both" }}>
      <SectionLabel text="ROUND 0 — SETUP" />
      <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 700, color: TEXT_PRIMARY, marginBottom: 6 }}>
        {stepTitles[step]}
      </h1>
      <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: TEXT_DIM, marginBottom: 28 }}>
        {stepDescs[step]}
      </p>

      {/* Step indicators */}
      <div style={{ display: "flex", gap: 6, marginBottom: 28 }}>
        {stepLabels.map((s, i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div style={{
              width: "100%", height: 3, borderRadius: 2, transition: "all 0.4s ease",
              background: i <= step ? NEON : "rgba(255,255,255,0.08)",
              boxShadow: i <= step ? `0 0 6px rgba(${NEON_RGB}, 0.3)` : "none",
            }} />
            <div style={{
              fontFamily: FONT_BODY, fontSize: 8, fontWeight: 700, letterSpacing: "0.1em",
              textTransform: "uppercase", transition: "color 0.3s ease",
              color: i <= step ? NEON : TEXT_MUTED,
            }}>{s}</div>
          </div>
        ))}
      </div>

      {/* ── STEP 0: NAME & LOCATION ── */}
      {step === 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 22, animation: "fadeIn 0.4s ease both" }}>
          {/* Game Name */}
          <div>
            <label style={labelStyle}>Game Name</label>
            <input value={gameName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGameName(e.target.value)} placeholder="Friday Night Out" style={inputStyle}
              onFocus={(e: React.FocusEvent<HTMLInputElement>) => { (e.target as HTMLElement).style.borderColor = `rgba(${NEON_RGB}, 0.5)`; }}
              onBlur={(e: React.FocusEvent<HTMLInputElement>) => { (e.target as HTMLElement).style.borderColor = `rgba(${NEON_RGB}, 0.15)`; }} />
          </div>

          {/* Location */}
          <div>
            <label style={labelStyle}>Location <span style={{ color: PINK, fontSize: 12 }}>*</span></label>
            <p style={{ fontFamily: FONT_BODY, fontSize: 11, color: TEXT_MUTED, marginBottom: 8, marginTop: -4 }}>
              Zip code or City, State — businesses near this area will appear in selections.
            </p>
            <input value={location} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLocation(e.target.value)} placeholder="e.g. 55401 or Minneapolis, MN" style={inputStyle}
              onFocus={(e: React.FocusEvent<HTMLInputElement>) => { (e.target as HTMLElement).style.borderColor = `rgba(${NEON_RGB}, 0.5)`; }}
              onBlur={(e: React.FocusEvent<HTMLInputElement>) => { (e.target as HTMLElement).style.borderColor = `rgba(${NEON_RGB}, 0.15)`; }} />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
            <NeonBtn variant="filled" onClick={backAction}>← Back</NeonBtn>
            <NeonBtn variant="filled" onClick={() => setStep(1)} disabled={!location.trim()}>Next</NeonBtn>
          </div>
        </div>
      )}

      {/* ── STEP 1: ROUNDS & FUNNEL ── */}
      {step === 1 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 22, animation: "fadeIn 0.4s ease both" }}>
          {/* Number of Rounds */}
          <div>
            <label style={labelStyle}>Number of Rounds</label>
            <div style={{ display: "flex", gap: 8 }}>
              {[2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setRounds(n)} style={{
                  flex: 1, padding: "10px 0", borderRadius: 4, fontFamily: FONT_BODY, fontSize: 14, fontWeight: 700, cursor: "pointer",
                  transition: "all 0.25s ease",
                  background: rounds === n ? `rgba(${NEON_RGB}, 0.15)` : "rgba(255,255,255,0.04)",
                  border: `1px solid ${rounds === n ? `rgba(${NEON_RGB}, 0.5)` : "rgba(255,255,255,0.08)"}`,
                  color: rounds === n ? NEON : TEXT_DIM,
                  boxShadow: rounds === n ? `0 0 10px rgba(${NEON_RGB}, 0.15)` : "none",
                }}>{n}</button>
              ))}
            </div>
          </div>

          {/* ── Descending Advance Funnel ── */}
          <div>
            <label style={labelStyle}>Selections Advancing Per Round</label>
            <p style={{ fontFamily: FONT_BODY, fontSize: 11, color: TEXT_MUTED, marginBottom: 14, marginTop: -4 }}>
              Each round narrows the field. Customize how many advance at each stage.
            </p>
            <div style={{
              position: "relative", padding: "20px", borderRadius: 6,
              background: "rgba(255,255,255,0.02)", border: `1px solid ${CARD_BORDER}`,
            }}>
              {/* Funnel visual */}
              <div style={{ display: "flex", flexDirection: "column", gap: 0, alignItems: "center" }}>
                {/* Round 1 — Discovery */}
                <div style={{
                  width: "100%", padding: "12px 16px", borderRadius: 4, marginBottom: 10,
                  background: `rgba(${NEON_RGB}, 0.04)`, border: `1px solid rgba(${NEON_RGB}, 0.15)`,
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <div>
                    <div style={{ fontFamily: FONT_BODY, fontSize: 11, fontWeight: 700, color: NEON }}>
                      Round 1 — Discovery
                    </div>
                    <div style={{ fontFamily: FONT_BODY, fontSize: 9, color: TEXT_MUTED, marginTop: 1 }}>
                      Everyone suggests places · No voting yet
                    </div>
                  </div>
                  <span style={{ fontSize: 16 }}>🔍</span>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ marginBottom: 6, opacity: 0.3 }}>
                  <path d="M12 4v16M6 14l6 6 6-6" stroke={NEON} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>

                {advancePerRound.map((count, idx) => {
                  const isLast = idx === advancePerRound.length - 1;
                  const roundLabel = isLast ? "Final" : `Round ${idx + 2}`;
                  const neonColors = [NEON, BLUE, YELLOW, PINK, PURPLE];
                  const thisColor = neonColors[idx % neonColors.length];
                  const widthPercent = 30 + ((advancePerRound.length - 1 - idx) / (advancePerRound.length - 1)) * 70;

                  return (
                    <div key={idx} style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <div style={{
                        width: `${widthPercent}%`, minWidth: 220, padding: "10px 16px", borderRadius: 4,
                        background: `rgba(${idx === 0 ? NEON_RGB : idx === 1 ? "0,229,255" : idx === 2 ? "255,214,0" : PINK_RGB}, 0.06)`,
                        border: `1px solid ${thisColor}30`,
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        transition: "all 0.3s ease",
                      }}>
                        <div>
                          <div style={{ fontFamily: FONT_BODY, fontSize: 11, fontWeight: 700, color: thisColor }}>
                            {roundLabel}
                          </div>
                          <div style={{ fontFamily: FONT_BODY, fontSize: 9, color: TEXT_MUTED, marginTop: 1 }}>
                            {isLast ? (count === 1 ? "The Winner" : `Top ${count} Winners`) : `Top ${count} advance`}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {isLast && (
                            <span style={{ fontSize: 16, marginRight: 4 }}>🏆</span>
                          )}
                          <button onClick={() => updateAdvance(idx, count - 1)} style={{
                            width: 26, height: 26, borderRadius: 4, background: "rgba(255,255,255,0.06)", border: `1px solid rgba(255,255,255,0.1)`,
                            color: TEXT_DIM, fontFamily: FONT_BODY, fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                          }}>−</button>
                          <div style={{
                            fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 700, color: thisColor,
                            minWidth: 30, textAlign: "center",
                            textShadow: `0 0 12px ${thisColor}50`,
                          }}>{count}</div>
                          <button onClick={() => updateAdvance(idx, count + 1)} style={{
                            width: 26, height: 26, borderRadius: 4, background: "rgba(255,255,255,0.06)", border: `1px solid rgba(255,255,255,0.1)`,
                            color: TEXT_DIM, fontFamily: FONT_BODY, fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                          }}>+</button>
                        </div>
                      </div>
                      {!isLast && (
                        <svg width="14" height="18" viewBox="0 0 24 30" fill="none" style={{ margin: "4px 0", opacity: 0.25 }}>
                          <path d="M12 4v22M6 20l6 6 6-6" stroke={neonColors[(idx + 1) % neonColors.length]} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Tie-breaker notice */}
              <div style={{
                marginTop: 16, padding: "10px 14px", borderRadius: 4,
                background: `rgba(${NEON_RGB}, 0.04)`, border: `1px solid rgba(${NEON_RGB}, 0.12)`,
                display: "flex", alignItems: "flex-start", gap: 10,
              }}>
                <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>⚖️</span>
                <div>
                  <div style={{ fontFamily: FONT_BODY, fontSize: 11, fontWeight: 600, color: TEXT_PRIMARY, marginBottom: 2 }}>
                    Tie-Breaker Rule
                  </div>
                  <div style={{ fontFamily: FONT_BODY, fontSize: 10, color: TEXT_DIM, lineHeight: 1.5 }}>
                    If two or more businesses are tied at the cut-off, the Game Master&apos;s vote decides who advances.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
            <NeonBtn variant="filled" onClick={() => setStep(0)}>← Back</NeonBtn>
            <NeonBtn variant="filled" onClick={() => setStep(2)}>Next</NeonBtn>
          </div>
        </div>
      )}

      {/* ── STEP 2: SCHEDULE & RULES ── */}
      {step === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 22, animation: "fadeIn 0.4s ease both" }}>
          {/* Dates */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={labelStyle}>Start Date</label>
              <input type="date" value={startDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStartDate(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>End Date</label>
              <input type="date" value={endDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEndDate(e.target.value)} style={inputStyle} />
            </div>
          </div>

          {/* Time between rounds with custom */}
          <div>
            <label style={labelStyle}>Time Between Rounds</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                { val: "30m", label: "30 min" }, { val: "1h", label: "1 hr" }, { val: "2h", label: "2 hr" },
                { val: "6h", label: "6 hr" }, { val: "12h", label: "12 hr" }, { val: "24h", label: "24 hr" },
                { val: "custom", label: "Custom" },
              ].map((t) => (
                <button key={t.val} onClick={() => setTimeBetween(t.val)} style={{
                  flex: t.val === "custom" ? "none" : 1, padding: "9px 14px", borderRadius: 4, fontFamily: FONT_BODY,
                  fontSize: 10, fontWeight: 600, cursor: "pointer", transition: "all 0.25s ease", letterSpacing: "0.05em",
                  background: timeBetween === t.val ? `rgba(${NEON_RGB}, 0.15)` : "rgba(255,255,255,0.04)",
                  border: `1px solid ${timeBetween === t.val ? `rgba(${NEON_RGB}, 0.5)` : "rgba(255,255,255,0.08)"}`,
                  color: timeBetween === t.val ? NEON : TEXT_DIM,
                }}>{t.label}</button>
              ))}
            </div>
            {isCustom && (
              <div style={{ display: "flex", gap: 10, marginTop: 10, animation: "fadeIn 0.3s ease both" }}>
                <input type="number" value={customTime.value} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomTime({ ...customTime, value: e.target.value })}
                  placeholder="Enter amount" min="1"
                  style={{ ...inputStyle, flex: 1, fontSize: 14, fontWeight: 600, textAlign: "center" }}
                  onFocus={(e: React.FocusEvent<HTMLInputElement>) => { (e.target as HTMLElement).style.borderColor = `rgba(${NEON_RGB}, 0.5)`; }}
                  onBlur={(e: React.FocusEvent<HTMLInputElement>) => { (e.target as HTMLElement).style.borderColor = `rgba(${NEON_RGB}, 0.15)`; }} />
                <div style={{ display: "flex", gap: 6 }}>
                  {[{ val: "m", label: "Min" }, { val: "h", label: "Hours" }, { val: "d", label: "Days" }].map((u) => (
                    <button key={u.val} onClick={() => setCustomTime({ ...customTime, unit: u.val })} style={{
                      padding: "10px 14px", borderRadius: 4, fontFamily: FONT_BODY, fontSize: 11, fontWeight: 600,
                      cursor: "pointer", transition: "all 0.25s ease",
                      background: customTime.unit === u.val ? `rgba(${NEON_RGB}, 0.15)` : "rgba(255,255,255,0.04)",
                      border: `1px solid ${customTime.unit === u.val ? `rgba(${NEON_RGB}, 0.5)` : "rgba(255,255,255,0.08)"}`,
                      color: customTime.unit === u.val ? NEON : TEXT_DIM,
                    }}>{u.label}</button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Toggle switches */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              { label: "Hide votes from other players", desc: "Players can\u2019t see who voted for what until the round ends", value: votesHidden, toggle: () => setVotesHidden(!votesHidden) },
              { label: "Allow players to invite others", desc: "Anyone in the game can add new people", value: allowInvites, toggle: () => setAllowInvites(!allowInvites) },
            ].map((opt, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 18px", borderRadius: 4, background: "rgba(255,255,255,0.02)", border: `1px solid ${CARD_BORDER}`,
              }}>
                <div>
                  <div style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY, marginBottom: 2 }}>{opt.label}</div>
                  <div style={{ fontFamily: FONT_BODY, fontSize: 10, color: TEXT_DIM }}>{opt.desc}</div>
                </div>
                <div onClick={opt.toggle} style={{
                  width: 44, height: 24, borderRadius: 12, cursor: "pointer", flexShrink: 0,
                  background: opt.value ? `rgba(${NEON_RGB}, 0.3)` : "rgba(255,255,255,0.08)",
                  border: `1px solid ${opt.value ? `rgba(${NEON_RGB}, 0.5)` : "rgba(255,255,255,0.1)"}`,
                  position: "relative", transition: "all 0.3s ease",
                }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: "50%", position: "absolute", top: 2,
                    left: opt.value ? 22 : 2, transition: "all 0.3s ease",
                    background: opt.value ? NEON : "rgba(255,255,255,0.3)",
                    boxShadow: opt.value ? `0 0 8px rgba(${NEON_RGB}, 0.5)` : "none",
                  }} />
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
            <NeonBtn variant="filled" onClick={() => setStep(1)}>← Back</NeonBtn>
            <NeonBtn variant="filled" onClick={() => setStep(3)}>Next</NeonBtn>
          </div>
        </div>
      )}

      {/* ── STEP 3: INVITE FRIENDS ── */}
      {step === 3 && (
        <div style={{ animation: "fadeIn 0.4s ease both" }}>
          <div style={{ position: "relative", marginBottom: 20 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}>
              <circle cx="11" cy="11" r="7" stroke={TEXT_DIM} strokeWidth="1.5" />
              <path d="M16.5 16.5L21 21" stroke={TEXT_DIM} strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input placeholder="Search friends..." value={friendSearch} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFriendSearch(e.target.value)} style={{ ...inputStyle, paddingLeft: 40 }}
              onFocus={(e: React.FocusEvent<HTMLInputElement>) => { (e.target as HTMLElement).style.borderColor = `rgba(${NEON_RGB}, 0.5)`; }}
              onBlur={(e: React.FocusEvent<HTMLInputElement>) => { (e.target as HTMLElement).style.borderColor = `rgba(${NEON_RGB}, 0.15)`; }} />
          </div>
          {invitedFriends.length > 0 && (
            <div style={{ fontFamily: FONT_BODY, fontSize: 11, color: NEON, fontWeight: 600, marginBottom: 14, letterSpacing: "0.05em" }}>
              {invitedFriends.length} selected
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 28 }}>
            {filteredFriends.length > 0 ? filteredFriends.map((friend, idx) => {
              const isSel = invitedFriends.find((f) => f.id === friend.id);
              return (
                <div key={friend.id} onClick={() => toggleFriend(friend)} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 4, cursor: "pointer",
                  background: isSel ? `rgba(${NEON_RGB}, 0.06)` : "rgba(255,255,255,0.02)",
                  border: `1px solid ${isSel ? `rgba(${NEON_RGB}, 0.4)` : CARD_BORDER}`,
                  transition: "all 0.25s ease", animation: `slideUp 0.4s ease ${0.05 * idx}s both`,
                }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, fontWeight: 700, color: TEXT_DIM, background: "rgba(255,255,255,0.04)", border: `2px solid ${isSel ? NEON : "rgba(255,255,255,0.08)"}`, transition: "border-color 0.3s ease", overflow: "hidden" }}>
                    {friend.avatarUrl ? <img src={friend.avatarUrl} alt={friend.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : getInitial(friend.name)}
                  </div>
                  <div style={{ flex: 1, fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY }}>{friend.name}</div>
                  <div style={{
                    width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                    background: isSel ? NEON : "transparent", border: `2px solid ${isSel ? NEON : "rgba(255,255,255,0.12)"}`, transition: "all 0.25s ease",
                  }}>
                    {isSel && <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 8l4 4 6-7" stroke={BG} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </div>
                </div>
              );
            }) : (
              <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "20px", color: TEXT_DIM, fontFamily: FONT_BODY, fontSize: 13 }}>
                {friends.length === 0 ? "No friends yet. Share the game code instead!" : "No friends match your search."}
              </div>
            )}
          </div>
          <div style={{ padding: "16px 20px", borderRadius: 4, background: "rgba(255,255,255,0.02)", border: `1px solid ${CARD_BORDER}`, marginBottom: 28, textAlign: "center" }}>
            <div style={{ fontFamily: FONT_BODY, fontSize: 10, color: TEXT_DIM, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8, fontWeight: 600 }}>Or share invite code</div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 700, color: NEON, letterSpacing: "0.2em", textShadow: `0 0 20px rgba(${NEON_RGB}, 0.4)` }}>
              {createdGameCode || "Launch to get code"}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <NeonBtn variant="filled" onClick={() => setStep(2)}>← Back</NeonBtn>
            <NeonBtn variant="filled" onClick={handleLaunch} disabled={creating}>
              {creating ? "Creating..." : "Launch Game ⬡"}
            </NeonBtn>
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// MANAGE PLAYERS PANEL (Game Master only — used in live rounds)
// ═══════════════════════════════════════════════════════════════
const ManagePlayersPanel = ({ players, isGameMaster, friends, gameId, token, onPlayersChanged }: ManagePlayersPanelProps) => {
  const [open, setOpen] = useState(false);
  const [showAddSearch, setShowAddSearch] = useState(false);
  const [addQuery, setAddQuery] = useState("");
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  if (!isGameMaster) return null;

  const currentPlayers = players || [];
  const nonMemberFriends = friends.filter((f) => !currentPlayers.find((p) => p.id === f.id));
  const filteredAdd = nonMemberFriends.filter((f) => f.name.toLowerCase().includes(addQuery.toLowerCase()));

  const removePlayer = async (playerId: string) => {
    setActionLoading(true);
    try {
      await apiFetch(`/api/group-games/${gameId}/players`, token, {
        method: "DELETE", body: JSON.stringify({ userId: playerId }),
      });
      onPlayersChanged();
    } catch { /* toast handled by parent */ }
    setConfirmRemove(null);
    setActionLoading(false);
  };

  const addPlayer = async (friend: Friend) => {
    setActionLoading(true);
    try {
      await apiFetch(`/api/group-games/${gameId}/players`, token, {
        method: "POST", body: JSON.stringify({ userId: friend.id }),
      });
      onPlayersChanged();
    } catch { /* toast handled by parent */ }
    setAddQuery("");
    setActionLoading(false);
  };

  return (
    <div style={{ marginBottom: 20 }}>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 4,
          background: open ? `rgba(${NEON_RGB}, 0.08)` : "rgba(255,255,255,0.03)",
          border: `1px solid ${open ? `rgba(${NEON_RGB}, 0.3)` : CARD_BORDER}`,
          cursor: "pointer", transition: "all 0.25s ease", fontFamily: FONT_BODY,
        }}
        onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => { if (!open) (e.currentTarget as HTMLElement).style.borderColor = `rgba(${NEON_RGB}, 0.2)`; }}
        onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => { if (!open) (e.currentTarget as HTMLElement).style.borderColor = CARD_BORDER; }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <circle cx="9" cy="7" r="3.5" stroke={open ? NEON : TEXT_DIM} strokeWidth="1.5" />
          <path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6" stroke={open ? NEON : TEXT_DIM} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M19 8v6M16 11h6" stroke={open ? NEON : TEXT_DIM} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: open ? NEON : TEXT_DIM }}>
          Manage Players
        </span>
        <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 8, background: `rgba(${NEON_RGB}, 0.12)`, color: NEON, fontWeight: 700, marginLeft: 2 }}>
          {currentPlayers.length}
        </span>
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" style={{ marginLeft: "auto", transition: "transform 0.25s ease", transform: open ? "rotate(180deg)" : "rotate(0)" }}>
          <path d="M4 6l4 4 4-4" stroke={open ? NEON : TEXT_DIM} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Expanded panel */}
      {open && (
        <div style={{
          marginTop: 8, padding: "16px", borderRadius: 6, animation: "fadeIn 0.3s ease both",
          background: "rgba(255,255,255,0.02)", border: `1px solid ${CARD_BORDER}`,
        }}>
          {/* Game Master badge */}
          <div style={{
            display: "flex", alignItems: "center", gap: 6, marginBottom: 14,
            fontFamily: FONT_BODY, fontSize: 9, fontWeight: 700, letterSpacing: "0.12em",
            textTransform: "uppercase", color: YELLOW,
          }}>
            <span>👑</span> Game Master Controls
          </div>

          {/* Current players list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
            {currentPlayers.map((player, idx) => (
              <div key={player.id} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 4,
                background: player.isGameMaster ? `rgba(${NEON_RGB}, 0.04)` : "rgba(255,255,255,0.02)",
                border: `1px solid ${player.isGameMaster ? `rgba(${NEON_RGB}, 0.15)` : "rgba(255,255,255,0.04)"}`,
                animation: `fadeIn 0.25s ease ${0.03 * idx}s both`,
              }}>
                <div style={{
                  width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 15, background: "rgba(255,255,255,0.04)",
                  border: `2px solid ${player.isGameMaster ? NEON : "rgba(255,255,255,0.08)"}`,
                }}>
                  {player.avatar}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: FONT_BODY, fontSize: 12, fontWeight: 600, color: TEXT_PRIMARY, display: "flex", alignItems: "center", gap: 6 }}>
                    {player.name}
                    {player.isGameMaster && (
                      <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "2px 6px", borderRadius: 3, background: `rgba(${NEON_RGB}, 0.12)`, color: NEON }}>
                        GM
                      </span>
                    )}
                  </div>
                </div>

                {/* Remove button (not for game master themselves) */}
                {!player.isGameMaster && (
                  <>
                    {confirmRemove === player.id ? (
                      <div style={{ display: "flex", gap: 4, animation: "fadeIn 0.2s ease both" }}>
                        <button onClick={() => removePlayer(player.id)} style={{
                          padding: "4px 10px", borderRadius: 3, fontFamily: FONT_BODY, fontSize: 9, fontWeight: 700,
                          letterSpacing: "0.05em", textTransform: "uppercase", cursor: "pointer",
                          background: `rgba(${PINK_RGB}, 0.15)`, border: `1px solid rgba(${PINK_RGB}, 0.4)`, color: PINK,
                        }}>Remove</button>
                        <button onClick={() => setConfirmRemove(null)} style={{
                          padding: "4px 8px", borderRadius: 3, fontFamily: FONT_BODY, fontSize: 9, fontWeight: 700,
                          cursor: "pointer", background: "rgba(255,255,255,0.04)", border: `1px solid rgba(255,255,255,0.1)`, color: TEXT_DIM,
                        }}>Cancel</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmRemove(player.id)}
                        style={{
                          width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                          background: "transparent", border: `1px solid rgba(255,255,255,0.08)`, cursor: "pointer", transition: "all 0.25s ease",
                        }}
                        onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => { (e.currentTarget as HTMLElement).style.background = `rgba(${PINK_RGB}, 0.1)`; (e.currentTarget as HTMLElement).style.borderColor = `rgba(${PINK_RGB}, 0.3)`; }}
                        onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"; }}
                        title={`Remove ${player.name}`}
                      >
                        <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                          <path d="M4 4l8 8M12 4l-8 8" stroke={PINK} strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </button>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Add player section */}
          <div style={{ borderTop: `1px solid ${CARD_BORDER}`, paddingTop: 14 }}>
            <button
              onClick={() => setShowAddSearch(!showAddSearch)}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 3,
                background: showAddSearch ? `rgba(${NEON_RGB}, 0.08)` : "rgba(255,255,255,0.03)",
                border: `1px solid ${showAddSearch ? `rgba(${NEON_RGB}, 0.25)` : "rgba(255,255,255,0.08)"}`,
                cursor: "pointer", fontFamily: FONT_BODY, fontSize: 10, fontWeight: 600,
                letterSpacing: "0.08em", textTransform: "uppercase",
                color: showAddSearch ? NEON : TEXT_DIM, transition: "all 0.25s ease",
              }}
            >
              <span style={{ fontSize: 14, lineHeight: 1 }}>+</span> Add Player
            </button>

            {showAddSearch && (
              <div style={{ marginTop: 10, animation: "fadeIn 0.25s ease both" }}>
                <div style={{ position: "relative", marginBottom: 10 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}>
                    <circle cx="11" cy="11" r="7" stroke={TEXT_DIM} strokeWidth="1.5" />
                    <path d="M16.5 16.5L21 21" stroke={TEXT_DIM} strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <input
                    value={addQuery}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddQuery(e.target.value)}
                    placeholder="Search friends to add..."
                    style={{
                      fontFamily: FONT_BODY, fontSize: 12, color: TEXT_PRIMARY, width: "100%",
                      background: "rgba(255,255,255,0.04)", border: `1px solid rgba(${NEON_RGB}, 0.15)`,
                      borderRadius: 4, padding: "8px 12px 8px 32px", outline: "none",
                    }}
                    onFocus={(e: React.FocusEvent<HTMLInputElement>) => { (e.target as HTMLElement).style.borderColor = `rgba(${NEON_RGB}, 0.4)`; }}
                    onBlur={(e: React.FocusEvent<HTMLInputElement>) => { (e.target as HTMLElement).style.borderColor = `rgba(${NEON_RGB}, 0.15)`; }}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 160, overflowY: "auto" }}>
                  {filteredAdd.length > 0 ? filteredAdd.map((friend) => (
                    <div
                      key={friend.id}
                      onClick={() => addPlayer(friend)}
                      style={{
                        display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 4,
                        cursor: "pointer", transition: "all 0.2s ease",
                        background: "rgba(255,255,255,0.02)", border: `1px solid rgba(255,255,255,0.04)`,
                      }}
                      onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => { (e.currentTarget as HTMLElement).style.background = `rgba(${NEON_RGB}, 0.06)`; (e.currentTarget as HTMLElement).style.borderColor = `rgba(${NEON_RGB}, 0.2)`; }}
                      onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.04)"; }}
                    >
                      <div style={{ width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: TEXT_DIM, background: "rgba(255,255,255,0.04)", overflow: "hidden" }}>
                        {friend.avatarUrl ? <img src={friend.avatarUrl} alt={friend.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : getInitial(friend.name)}
                      </div>
                      <span style={{ fontFamily: FONT_BODY, fontSize: 12, fontWeight: 600, color: TEXT_PRIMARY, flex: 1 }}>{friend.name}</span>
                      <span style={{ fontFamily: FONT_BODY, fontSize: 9, fontWeight: 700, color: NEON, letterSpacing: "0.08em", textTransform: "uppercase" }}>+ Add</span>
                    </div>
                  )) : (
                    <div style={{ fontFamily: FONT_BODY, fontSize: 11, color: TEXT_MUTED, padding: "8px 10px", textAlign: "center" }}>
                      {addQuery ? "No friends found" : "All friends are already in the game"}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// PLAYER ACTIVITY TRACKER
// ═══════════════════════════════════════════════════════════════
const PlayerActivityTracker = ({ activity, phase }: { activity: PlayerActivity[]; phase: "selection" | "voting" }) => {
  const contributed = activity.filter((p) => p.hasContributed).length;
  const total = activity.length;
  const label = phase === "selection" ? "suggested" : "voted";

  return (
    <div style={{
      padding: "12px 16px", borderRadius: 6, marginBottom: 16,
      background: "rgba(255,255,255,0.02)", border: `1px solid ${CARD_BORDER}`,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontFamily: FONT_BODY, fontSize: 11, fontWeight: 700, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: "0.1em" }}>
          Player Activity
        </span>
        <span style={{
          fontFamily: FONT_BODY, fontSize: 11, fontWeight: 700,
          color: contributed === total ? NEON : YELLOW,
          padding: "3px 10px", borderRadius: 3,
          background: contributed === total ? `rgba(${NEON_RGB}, 0.1)` : "rgba(255,214,0,0.1)",
          border: `1px solid ${contributed === total ? `rgba(${NEON_RGB}, 0.2)` : "rgba(255,214,0,0.2)"}`,
        }}>
          {contributed}/{total} {label}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.06)", marginBottom: 12, overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: 2, transition: "width 0.5s ease",
          width: total > 0 ? `${(contributed / total) * 100}%` : "0%",
          background: contributed === total ? NEON : YELLOW,
          boxShadow: contributed === total ? `0 0 8px rgba(${NEON_RGB}, 0.4)` : "0 0 8px rgba(255,214,0,0.3)",
        }} />
      </div>

      {/* Player rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {activity.map((p) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Avatar */}
            <div style={{
              width: 26, height: 26, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
              border: `1.5px solid ${p.hasContributed ? `rgba(${NEON_RGB}, 0.5)` : "rgba(255,255,255,0.08)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: p.hasContributed ? `rgba(${NEON_RGB}, 0.08)` : "rgba(255,255,255,0.03)",
            }}>
              {p.avatar ? (
                <img src={p.avatar} alt={`${p.name} avatar`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ fontFamily: FONT_DISPLAY, fontSize: 10, fontWeight: 700, color: p.hasContributed ? NEON : TEXT_DIM }}>
                  {getInitial(p.name)}
                </span>
              )}
            </div>

            {/* Name + role */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontFamily: FONT_BODY, fontSize: 12, fontWeight: 500, color: TEXT_PRIMARY }}>
                {p.name}
              </span>
              {p.isGameMaster && (
                <span style={{ fontFamily: FONT_BODY, fontSize: 9, fontWeight: 700, color: NEON, marginLeft: 6, letterSpacing: "0.06em" }}>GM</span>
              )}
            </div>

            {/* Status */}
            {p.hasContributed ? (
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                {phase === "selection" && (
                  <span style={{ fontFamily: FONT_BODY, fontSize: 10, fontWeight: 600, color: NEON }}>{p.count}</span>
                )}
                <div style={{
                  width: 18, height: 18, borderRadius: "50%",
                  background: `rgba(${NEON_RGB}, 0.15)`, border: `1px solid rgba(${NEON_RGB}, 0.3)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8l4 4 6-7" stroke={NEON} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            ) : (
              <span style={{
                fontFamily: FONT_BODY, fontSize: 10, fontWeight: 500, fontStyle: "italic",
                color: TEXT_MUTED, letterSpacing: "0.02em",
              }}>
                waiting...
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// ROUND 1 — SELECTION (Redesigned Discovery Experience)
// ═══════════════════════════════════════════════════════════════
const SelectionPhase = ({ game, businesses, friends, token, onBack, onAdvance, onAddSelection, onRemoveSelection, onRefresh }: SelectionPhaseProps) => {
  const [selections, setSelections] = useState<Business[]>([]);
  const [selectionTab, setSelectionTab] = useState<"explore" | "my-picks">("explore");
  const [activeCategory, setActiveCategory] = useState("all");
  const [userZip, setUserZip] = useState("68102");
  const [userCoords, setUserCoords] = useState<[number, number] | null>(null);
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      if (!session?.user) return;
      const { data: profile } = await supabaseBrowser.from("profiles").select("zip_code").eq("id", session.user.id).maybeSingle();
      if (profile?.zip_code) {
        setUserZip(profile.zip_code);
        const coords = ZIP_COORDS[profile.zip_code];
        if (coords) setUserCoords(coords);
      }
    })();
    // Browser geolocation (overrides zip centroid if granted)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserCoords([pos.coords.latitude, pos.coords.longitude]),
        () => {},
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
      );
    }
  }, []);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [confirmLockIn, setConfirmLockIn] = useState(false);
  const [suggestionsSubmitted, setSuggestionsSubmitted] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    category: [], price: [], sort: "Nearest", openNow: false, distance: 15, tags: [], browseFrom: "All Businesses",
  });

  // DB-driven tag categories
  const [tagCats, setTagCats] = useState<TagCategory[]>([]);
  useEffect(() => { fetchTagsByCategory("business").then(setTagCats).catch(() => {}); }, []);

  // Load saved filter preferences
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      if (!session?.access_token) return;
      const saved = await loadFilterPreferences(session.access_token);
      if (saved) {
        setFilters(prev => ({
          ...prev,
          category: saved.categories.length > 0 ? saved.categories : prev.category,
          price: saved.price && saved.price !== "Any" ? [saved.price] : prev.price,
          distance: saved.distance || prev.distance,
          openNow: saved.openNow ?? prev.openNow,
          tags: saved.tags.length > 0 ? saved.tags : prev.tags,
        }));
      }
    })();
  }, []);
  const FILTER_CATEGORIES = useMemo(() => {
    const bt = tagCats.find(c => c.name === "Business Type");
    return bt && bt.tags.length > 0 ? ["All", ...bt.tags.map(t => t.name)] : DEFAULT_FILTER_CATEGORIES;
  }, [tagCats]);
  // Smart visibility: hide Cuisine/Dietary when non-food category selected
  const selectedCatIsFood = useMemo(() => {
    if (filters.category.length === 0) return true;
    const bt = tagCats.find(c => c.name === "Business Type");
    return filters.category.some(cat => {
      const tag = bt?.tags.find(t => t.name === cat);
      return tag?.is_food ?? true;
    });
  }, [filters.category, tagCats]);

  // Sync selections from server (private pool — only current user's picks)
  useEffect(() => {
    if (!game?.selections || businesses.length === 0) return;
    const serverBizIds = new Set(game.selections.map((s) => s.id));
    const serverSelections = businesses.filter((b) => serverBizIds.has(b.id));
    setSelections(serverSelections);
  }, [game?.selections, businesses]);

  const toggleSelection = (biz: Business, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const isAlreadySelected = selections.find((s) => s.id === biz.id);
    if (isAlreadySelected) {
      setSelections((prev) => prev.filter((s) => s.id !== biz.id));
      onRemoveSelection(biz.id);
    } else {
      setSelections((prev) => [...prev, biz]);
      onAddSelection(biz.id);
    }
  };

  const filtered = businesses.filter((b) => {
    const matchCat = activeCategory === "all" || b.category === activeCategory;
    const matchSearch = b.name.toLowerCase().includes(searchQuery.toLowerCase()) || b.type.toLowerCase().includes(searchQuery.toLowerCase()) || b.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    // Distance filter — uses GPS coordinates when available, falls back to zip
    const dist = getBusinessDistance(userCoords, userZip, b.latitude, b.longitude, b.zip);
    if (dist !== null && dist > filters.distance) return false;
    return matchCat && matchSearch;
  });

  return (
    <div style={{ animation: "fadeIn 0.5s ease both" }}>
      <BackBtn onClick={onBack} />
      <SectionLabel text="ROUND 1 — DISCOVERY" />
      <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 700, color: TEXT_PRIMARY, marginBottom: 4 }}>
        {game?.name || "Game"}
      </h1>
      <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: TEXT_DIM, marginBottom: 8 }}>
        Browse and add places to your private list. When voting starts, everyone&apos;s picks combine.
      </p>

      {/* Players + timer + code */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <AvatarStack players={game?.players || []} size={28} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: NEON, padding: "6px 12px", borderRadius: 3, background: `rgba(${NEON_RGB}, 0.06)`, border: `1px solid rgba(${NEON_RGB}, 0.15)` }}>
            {game?.gameCode || "—"}
          </div>
          {game?.roundEndTime && (
            <CountdownBadge endTime={game.roundEndTime} />
          )}
        </div>
      </div>

      {/* Game Master: Manage Players */}
      <ManagePlayersPanel
        players={game?.players || []}
        isGameMaster={!!game?.players?.find((p) => p.name === "You" && p.isGameMaster)}
        friends={friends}
        gameId={game?.id || ""}
        token={token}
        onPlayersChanged={onRefresh}
      />

      {/* Player Activity Tracker */}
      {game?.playerActivity && game.playerActivity.length > 0 && (
        <PlayerActivityTracker activity={game.playerActivity} phase="selection" />
      )}

      {/* Exploration / My Suggestions Toggle */}
      <div style={{ display: "flex", gap: 0, marginBottom: 16, borderBottom: `1px solid ${CARD_BORDER}` }}>
        {([
          { id: "explore" as const, label: "Exploration" },
          { id: "my-picks" as const, label: "My Suggestions", count: selections.length },
        ]).map((t) => (
          <button key={t.id} onClick={() => setSelectionTab(t.id)} style={{
            fontFamily: FONT_BODY, fontSize: 11, fontWeight: 600, letterSpacing: "0.08em",
            textTransform: "uppercase", padding: "12px 20px", background: "none",
            border: "none", cursor: "pointer",
            color: selectionTab === t.id ? NEON : TEXT_DIM,
            borderBottom: selectionTab === t.id ? `2px solid ${NEON}` : "2px solid transparent",
            transition: "all 0.3s ease",
          }}>
            {t.label}
            {t.count !== undefined && (
              <span style={{
                marginLeft: 8, fontSize: 10, padding: "2px 7px", borderRadius: 10,
                background: selectionTab === t.id ? `rgba(${NEON_RGB}, 0.15)` : "rgba(255,255,255,0.06)",
                color: selectionTab === t.id ? NEON : TEXT_DIM,
              }}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── EXPLORE TAB ── */}
      {selectionTab === "explore" && (<>
      {/* Search */}
      <div style={{ position: "relative", marginBottom: 14 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}>
          <circle cx="11" cy="11" r="7" stroke={TEXT_DIM} strokeWidth="1.5" />
          <path d="M16.5 16.5L21 21" stroke={TEXT_DIM} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input value={searchQuery} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)} placeholder="Search places, vibes, or tags..."
          style={{ fontFamily: FONT_BODY, fontSize: 13, color: TEXT_PRIMARY, background: "rgba(255,255,255,0.04)", border: `1px solid rgba(${NEON_RGB}, 0.15)`, borderRadius: 4, padding: "10px 14px 10px 40px", outline: "none", width: "100%" }}
          onFocus={(e: React.FocusEvent<HTMLInputElement>) => { (e.target as HTMLElement).style.borderColor = `rgba(${NEON_RGB}, 0.5)`; }}
          onBlur={(e: React.FocusEvent<HTMLInputElement>) => { (e.target as HTMLElement).style.borderColor = `rgba(${NEON_RGB}, 0.15)`; }} />
      </div>

      {/* ── Collapsible Filter Panel — matching 5v3v1 ── */}
      {(() => {
        const glassPill = (label: string, active: boolean, onClick: () => void, sx: React.CSSProperties = {}, title?: string) => (
          <button key={label} onClick={onClick} title={title} style={{
            padding: "8px 18px", borderRadius: 50, border: `1px solid ${active ? NEON : CARD_BORDER}`,
            background: active ? `rgba(${NEON_RGB}, 0.13)` : "rgba(18,18,31,0.85)",
            backdropFilter: "blur(16px)", color: active ? NEON : TEXT_DIM,
            fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.25s ease",
            whiteSpace: "nowrap", fontFamily: FONT_BODY, ...sx,
          }}>{label}</button>
        );
        const [openSections, setOpenSections] = useState<Record<string, boolean>>({ Distance: true });
        const toggleSection = (name: string) => setOpenSections(p => ({ ...p, [name]: !p[name] }));
        const sectionLabel = (text: string, collapsible = true) => (
          <div
            onClick={collapsible ? () => toggleSection(text) : undefined}
            style={{ fontSize: 11, fontWeight: 700, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: openSections[text] ? 10 : 0, fontFamily: FONT_BODY, cursor: collapsible ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "space-between", userSelect: "none" }}
          >
            <span>{text}</span>
            {collapsible && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ transition: "transform 0.2s ease", transform: openSections[text] ? "rotate(180deg)" : "rotate(0deg)" }}>
                <path d="M6 9l6 6 6-6" stroke={TEXT_DIM} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        );
        const activeFilterCount = filters.category.length + filters.price.length + (filters.sort !== "Nearest" ? 1 : 0) + (filters.openNow ? 1 : 0) + filters.tags.length + (filters.browseFrom !== "All Businesses" ? 1 : 0);
        return (
          <>
            {/* Toggle button */}
            <button onClick={() => setFiltersOpen(!filtersOpen)} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "9px 18px", borderRadius: 50,
              border: `1px solid ${filtersOpen ? `rgba(${NEON_RGB}, 0.4)` : CARD_BORDER}`,
              background: filtersOpen ? `rgba(${NEON_RGB}, 0.08)` : "rgba(18,18,31,0.85)",
              backdropFilter: "blur(16px)", cursor: "pointer", transition: "all 0.25s ease",
              fontFamily: FONT_BODY, marginBottom: filtersOpen ? 0 : 20,
            }}>
              <span style={{ fontSize: 12 }}>⚙</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: filtersOpen ? NEON : TEXT_DIM, letterSpacing: "0.05em" }}>Filters</span>
              {activeFilterCount > 0 && (
                <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 10, background: `rgba(${NEON_RGB}, 0.2)`, color: NEON, fontWeight: 700 }}>{activeFilterCount}</span>
              )}
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" style={{ marginLeft: 4, transition: "transform 0.25s ease", transform: filtersOpen ? "rotate(180deg)" : "rotate(0)" }}>
                <path d="M4 6l4 4 4-4" stroke={filtersOpen ? NEON : TEXT_DIM} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {filtersOpen && (
              <div style={{
                padding: "20px", borderRadius: 6, marginTop: 10, marginBottom: 20,
                background: "rgba(255,255,255,0.02)", border: `1px solid ${CARD_BORDER}`,
                animation: "fadeIn 0.3s ease both",
              }}>
                {/* Browse From (moved to top) */}
                <div style={{ marginBottom: 16 }}>
                  {sectionLabel("Browse From")}
                  {openSections["Browse From"] && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {[
                        { label: "🌐 All Businesses", val: "All Businesses" },
                        { label: "❤️ My Saved", val: "My Saved" },
                        { label: "✨ New to Me", val: "New to Me" },
                      ].map(opt => glassPill(opt.label, filters.browseFrom === opt.val, () => setFilters(p => ({ ...p, browseFrom: opt.val })), { fontSize: 12, padding: "8px 16px" }))}
                    </div>
                  )}
                </div>

                {/* Category (multi-select) */}
                <div style={{ marginBottom: 16 }}>
                  {sectionLabel("Category")}
                  {openSections["Category"] && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {glassPill("All", filters.category.length === 0, () => setFilters(p => ({ ...p, category: [] })), { fontSize: 11, padding: "6px 14px" })}
                      {FILTER_CATEGORIES.filter(c => c !== "All").map(c => glassPill(c, filters.category.includes(c), () => setFilters(p => ({
                        ...p, category: p.category.includes(c) ? p.category.filter(x => x !== c) : [...p.category, c],
                      })), { fontSize: 11, padding: "6px 14px" }))}
                    </div>
                  )}
                </div>

                {/* Price (multi-select) */}
                <div style={{ marginBottom: 16 }}>
                  {sectionLabel("Price")}
                  {openSections["Price"] && (
                    <div style={{ display: "flex", gap: 8 }}>
                      {glassPill("Any", filters.price.length === 0, () => setFilters(p => ({ ...p, price: [] })), {}, PRICE_TOOLTIPS["Any"])}
                      {PRICE_FILTERS.filter(p => p !== "Any").map(p => glassPill(p, filters.price.includes(p), () => setFilters(prev => ({
                        ...prev, price: prev.price.includes(p) ? prev.price.filter(x => x !== p) : [...prev.price, p],
                      })), {}, PRICE_TOOLTIPS[p]))}
                    </div>
                  )}
                </div>

                {/* Sort By */}
                <div style={{ marginBottom: 16 }}>
                  {sectionLabel("Sort By")}
                  {openSections["Sort By"] && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {SORT_OPTIONS.map(s => glassPill(s, filters.sort === s, () => setFilters(prev => ({ ...prev, sort: s }))))}
                    </div>
                  )}
                </div>

                {/* Distance (always expanded) */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: "0.12em", fontFamily: FONT_BODY }}>Distance</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: BLUE, fontFamily: FONT_BODY }}>{filters.distance} mi</span>
                  </div>
                  <input type="range" min={1} max={50} value={filters.distance} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilters(p => ({ ...p, distance: +e.target.value }))}
                    style={{ width: "100%", accentColor: BLUE, height: 4 }} />
                </div>

                {/* Open Now */}
                <div style={{ marginBottom: 16 }}>
                  <button onClick={() => setFilters(p => ({ ...p, openNow: !p.openNow }))} style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 50,
                    border: `1px solid ${filters.openNow ? NEON : CARD_BORDER}`,
                    background: filters.openNow ? `rgba(${NEON_RGB}, 0.1)` : "rgba(18,18,31,0.85)",
                    backdropFilter: "blur(12px)",
                    color: filters.openNow ? NEON : TEXT_DIM,
                    fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT_BODY, transition: "all 0.3s",
                  }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: filters.openNow ? NEON : TEXT_DIM,
                      boxShadow: filters.openNow ? `0 0 8px ${NEON}` : "none",
                    }} />
                    Open Now Only
                  </button>
                </div>

                {/* Dynamic tag filter sections from DB (excludes Business Type) */}
                {tagCats
                  .filter(c => c.name !== "Business Type" && c.scope.includes("business"))
                  .filter(c => !c.requires_food || selectedCatIsFood)
                  .map(c => {
                    const catTags = c.tags.map(t => t.name);
                    const sectionKey = `${c.icon} ${c.name}`;
                    return (
                      <div key={c.id} style={{ marginBottom: 16 }}>
                        {sectionLabel(sectionKey)}
                        {openSections[sectionKey] && (
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {glassPill("All", !filters.tags.some(t => catTags.includes(t)), () => setFilters(p => ({ ...p, tags: p.tags.filter(t => !catTags.includes(t)) })), { fontSize: 11, padding: "6px 14px" })}
                            {catTags.map(t => glassPill(t, filters.tags.includes(t), () => setFilters(p => ({
                              ...p, tags: p.tags.includes(t) ? p.tags.filter(x => x !== t) : [...p.tags, t],
                            })), { fontSize: 11, padding: "6px 14px" }))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                {/* Fallback if DB hasn't loaded */}
                {tagCats.length === 0 && (
                  <>
                    <div style={{ marginBottom: 16 }}>
                      {sectionLabel("Cuisine")}
                      {openSections["Cuisine"] && (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {DEFAULT_CUISINE_FILTERS.map(t => glassPill(t, filters.tags.includes(t), () => setFilters(p => ({
                            ...p, tags: p.tags.includes(t) ? p.tags.filter(x => x !== t) : [...p.tags, t],
                          })), { fontSize: 11, padding: "6px 14px" }))}
                        </div>
                      )}
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      {sectionLabel("Vibe & Atmosphere")}
                      {openSections["Vibe & Atmosphere"] && (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {DEFAULT_VIBE_FILTERS.map(t => glassPill(t, filters.tags.includes(t), () => setFilters(p => ({
                            ...p, tags: p.tags.includes(t) ? p.tags.filter(x => x !== t) : [...p.tags, t],
                          })), { fontSize: 11, padding: "6px 14px" }))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        );
      })()}

      {/* Selection counter */}
      {selections.length > 0 && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 16px", borderRadius: 4, marginBottom: 16,
          background: `rgba(${NEON_RGB}, 0.06)`, border: `1px solid rgba(${NEON_RGB}, 0.2)`,
          animation: "votePopIn 0.3s ease both",
        }}>
          <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: NEON, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 24, height: 24, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", background: `rgba(${NEON_RGB}, 0.2)`, fontSize: 12, fontWeight: 700 }}>
              {selections.length}
            </span>
            in your suggestions
          </div>
        </div>
      )}

      {/* ── Discovery Grid: Visual Cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 28 }}>
        {filtered.map((biz, idx) => {
          const isSel = selections.find((s) => s.id === biz.id);
          return (
            <BizDiscoveryCard
              key={biz.id}
              biz={biz}
              idx={idx}
              isSel={isSel}
              isExpanded={false}
              onToggleExpand={() => {}}
              onToggleSelect={(e: React.MouseEvent) => toggleSelection(biz, e)}
            />
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: TEXT_DIM, fontFamily: FONT_BODY, fontSize: 13 }}>
          No places match your search. Try a different vibe!
        </div>
      )}
      </>)}

      {/* ── MY SUGGESTIONS TAB ── */}
      {selectionTab === "my-picks" && (
        <div style={{ animation: "fadeIn 0.3s ease both" }}>
          {selections.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: TEXT_DIM, marginBottom: 8 }}>
                You haven&apos;t suggested any places yet.
              </div>
              <button onClick={() => setSelectionTab("explore")} style={{
                fontFamily: FONT_BODY, fontSize: 12, fontWeight: 600, color: NEON,
                background: "none", border: `1px solid rgba(${NEON_RGB}, 0.25)`,
                borderRadius: 4, padding: "8px 20px", cursor: "pointer",
                transition: "all 0.25s ease",
              }}
                onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => { (e.currentTarget as HTMLElement).style.background = `rgba(${NEON_RGB}, 0.06)`; }}
                onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => { (e.currentTarget as HTMLElement).style.background = "none"; }}
              >
                Browse Businesses →
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
              {selections.map((biz, idx) => (
                <div key={biz.id} style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "12px 16px", borderRadius: 6,
                  background: CARD_BG, border: `1px solid rgba(${NEON_RGB}, 0.15)`,
                  animation: `slideUp 0.3s ease ${0.04 * idx}s both`,
                }}>
                  {/* Mini gradient swatch */}
                  <div style={{
                    width: 44, height: 44, borderRadius: 4, flexShrink: 0,
                    background: biz.gradient, position: "relative", overflow: "hidden",
                  }}>
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(transparent 40%, rgba(12,12,20,0.8) 100%)" }} />
                    <span style={{
                      position: "absolute", bottom: 2, left: 0, right: 0, textAlign: "center",
                      fontFamily: FONT_DISPLAY, fontSize: 12, fontWeight: 700, color: TEXT_PRIMARY,
                    }}>
                      {getInitial(biz.name)}
                    </span>
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: FONT_DISPLAY, fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {biz.name}
                    </div>
                    <div style={{ fontFamily: FONT_BODY, fontSize: 10, color: TEXT_DIM }}>
                      {biz.type}{biz.priceLevel ? ` · ${biz.priceLevel}` : ""}
                    </div>
                  </div>

                  {/* Remove button */}
                  <button onClick={(e: React.MouseEvent) => toggleSelection(biz, e)} style={{
                    fontFamily: FONT_BODY, fontSize: 9, fontWeight: 700, letterSpacing: "0.08em",
                    textTransform: "uppercase", padding: "6px 14px", borderRadius: 3, cursor: "pointer",
                    transition: "all 0.25s ease",
                    background: `rgba(${PINK_RGB}, 0.08)`, border: `1px solid rgba(${PINK_RGB}, 0.25)`, color: PINK,
                  }}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Submit — sticky bottom bar: GM locks in suggestions, non-GM sends suggestions */}
      <div style={{
        position: "sticky", bottom: 0, zIndex: 20,
        paddingTop: 16, paddingBottom: 16,
        background: `linear-gradient(to bottom, transparent 0%, ${BG} 20%)`,
      }}>
      {game?.players?.find((p) => p.name === "You")?.isGameMaster ? (
        <>
          {!confirmLockIn ? (
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <NeonBtn variant="filled" onClick={() => setConfirmLockIn(true)} disabled={(game?.totalUniqueSelections ?? 0) < 2}>
                Lock In Suggestions →
              </NeonBtn>
            </div>
          ) : (
            <div style={{
              padding: "16px 20px", borderRadius: 6, animation: "fadeIn 0.3s ease both",
              background: "rgba(255,107,45,0.04)", border: "1px solid rgba(255,107,45,0.2)",
            }}>
              {/* Warning header */}
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 14, fontWeight: 700, color: ORANGE, marginBottom: 8 }}>
                Start Voting?
              </div>
              <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: TEXT_DIM, marginBottom: 12, lineHeight: 1.5 }}>
                This will end the discovery round and begin <strong style={{ color: TEXT_PRIMARY }}>Round 2 — Voting</strong>. Make sure everyone has had a chance to add their suggestions first.
              </p>

              {/* Mini activity summary */}
              {(() => {
                const activity = game?.playerActivity || [];
                const contributed = activity.filter((p) => p.hasContributed).length;
                const total = activity.length;
                const allDone = contributed === total;
                return (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                    borderRadius: 4, marginBottom: 14,
                    background: allDone ? `rgba(${NEON_RGB}, 0.06)` : "rgba(255,214,0,0.06)",
                    border: `1px solid ${allDone ? `rgba(${NEON_RGB}, 0.15)` : "rgba(255,214,0,0.15)"}`,
                  }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: allDone ? NEON : YELLOW,
                      boxShadow: `0 0 6px ${allDone ? `rgba(${NEON_RGB}, 0.5)` : "rgba(255,214,0,0.5)"}`,
                    }} />
                    <span style={{ fontFamily: FONT_BODY, fontSize: 12, fontWeight: 600, color: allDone ? NEON : YELLOW }}>
                      {contributed}/{total} players have suggested · {game?.totalUniqueSelections ?? 0} unique places
                    </span>
                    {!allDone && (
                      <span style={{ fontFamily: FONT_BODY, fontSize: 11, color: TEXT_DIM, marginLeft: "auto" }}>
                        {total - contributed} still waiting
                      </span>
                    )}
                  </div>
                );
              })()}

              {/* Actions */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <NeonBtn variant="outline" onClick={() => setConfirmLockIn(false)}>
                  Go Back
                </NeonBtn>
                <NeonBtn variant="filled" onClick={onAdvance} color={ORANGE} colorRGB="255,107,45">
                  Start Voting Now
                </NeonBtn>
              </div>
            </div>
          )}
        </>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          {suggestionsSubmitted ? (
            <>
              <div style={{
                textAlign: "center", padding: "12px 20px", borderRadius: 4, width: "100%",
                background: `rgba(${NEON_RGB}, 0.04)`, border: `1px solid rgba(${NEON_RGB}, 0.2)`,
                fontFamily: FONT_BODY, fontSize: 12, color: NEON, fontWeight: 600,
              }}>
                ✓ Suggestions sent! Waiting for the Game Master to start voting.
              </div>
              <NeonBtn variant="outline" onClick={() => setSuggestionsSubmitted(false)}>
                Edit Suggestions
              </NeonBtn>
            </>
          ) : (
            <>
              <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: TEXT_DIM, textAlign: "center" }}>
                When you&apos;re done adding places, send your suggestions.
              </p>
              <NeonBtn variant="filled" onClick={() => setSuggestionsSubmitted(true)} disabled={selections.length === 0}>
                Send {selections.length} Suggestion{selections.length !== 1 ? "s" : ""} →
              </NeonBtn>
            </>
          )}
        </div>
      )}
      </div>
    </div>
  );
};

const BizDiscoveryCard = ({ biz, idx, isSel, isExpanded, onToggleExpand, onToggleSelect }: BizDiscoveryCardProps) => {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={(e: React.MouseEvent) => onToggleSelect(e)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 6, overflow: "hidden", cursor: "pointer",
        transition: "all 0.35s cubic-bezier(0.23,1,0.32,1)",
        transform: hovered ? "translateY(-4px)" : "none",
        boxShadow: hovered ? `0 12px 32px rgba(0,0,0,0.4)` : "none",
        animation: `slideUp 0.4s ease ${0.06 * idx}s both`,
        border: isSel ? `2px solid rgba(${NEON_RGB}, 0.5)` : "2px solid transparent",
      }}
    >
      {/* Image carousel */}
      <CardImageCarousel images={biz.images} gradient={biz.gradient} height={140}>
        {/* Selected badge */}
        {isSel && (
          <div style={{
            position: "absolute", top: 10, right: 10, width: 28, height: 28, borderRadius: "50%",
            background: NEON, display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 0 12px rgba(${NEON_RGB}, 0.5)`, animation: "votePopIn 0.3s ease both", zIndex: 3,
          }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M3 8l4 4 6-7" stroke={BG} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
      </CardImageCarousel>

      {/* Info bar — name, type, price, status */}
      <div style={{ background: CARD_BG, padding: "10px 14px 12px" }}>
        <div style={{
          fontFamily: FONT_DISPLAY, fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {biz.name}
        </div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 10, color: TEXT_DIM, marginTop: 3 }}>
          {biz.type}{biz.priceLevel ? ` · ${biz.priceLevel}` : ""}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// ROUND 2+ — VOTING
// ═══════════════════════════════════════════════════════════════
const VotingPhase = ({ game, friends, token, onBack, onAdvance, onSubmitVotes, onRefresh, roundNum, totalRounds, advanceCount }: VotingPhaseProps) => {
  const [votes, setVotes] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [votesSubmitted, setVotesSubmitted] = useState(false);
  const isFinal = roundNum === totalRounds;
  const items = game?.selections || [];
  const maxVotes = advanceCount || 3;
  const voteCount = Object.values(votes).filter(Boolean).length;

  // Pre-populate votes from server (myVotesThisRound)
  useEffect(() => {
    // Only set initial votes if we haven't voted locally yet
    if (Object.keys(votes).length === 0 && game?.selections) {
      const initial: Record<string, boolean> = {};
      for (const s of game.selections) {
        if (s.voted) initial[s.id] = true;
      }
      if (Object.keys(initial).length > 0) {
        setVotes(initial);
        setVotesSubmitted(true);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.selections]);

  const toggleVote = (id: string) => {
    setVotes((prev) => {
      if (prev[id]) return { ...prev, [id]: false };
      if (voteCount >= maxVotes) return prev;
      return { ...prev, [id]: true };
    });
  };

  const handleSubmit = async () => {
    const votedIds = Object.entries(votes).filter(([, v]) => v).map(([id]) => id);
    if (votedIds.length === 0 || submitting) return;
    setSubmitting(true);
    onSubmitVotes(votedIds);
    setSubmitting(false);
    setVotesSubmitted(true);
  };

  const sortedItems = [...items].sort((a, b) => b.votes - a.votes);
  const hidden = game?.votesHidden;

  return (
    <div style={{ animation: "fadeIn 0.5s ease both" }}>
      <BackBtn onClick={onBack} />
      <SectionLabel text={isFinal ? "FINAL ROUND — LAST CALL" : `ROUND ${roundNum} — VOTE`} color={isFinal ? PINK : NEON} />
      <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 700, color: TEXT_PRIMARY, marginBottom: 4 }}>
        {isFinal ? "Final Vote" : `Round ${roundNum} Voting`}
      </h1>
      <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: TEXT_DIM, marginBottom: 8 }}>
        {isFinal ? (maxVotes === 1 ? "This is it. Pick the one." : `Final round! Pick your top ${maxVotes}.`) : `Vote for your top ${maxVotes}. The rest get eliminated.`}
      </p>

      <div style={{ marginBottom: 20 }}><RoundProgress current={roundNum} total={totalRounds} /></div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <AvatarStack players={game?.players || []} size={26} />
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: NEON, padding: "5px 10px", borderRadius: 3, background: `rgba(${NEON_RGB}, 0.06)`, border: `1px solid rgba(${NEON_RGB}, 0.15)` }}>
            {game?.gameCode || "—"}
          </div>
          {game?.roundEndTime && (
            <CountdownBadge endTime={game.roundEndTime} />
          )}
        </div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 12, fontWeight: 700, color: voteCount === maxVotes ? NEON : TEXT_DIM, transition: "color 0.3s ease" }}>
          {voteCount}/{maxVotes} votes used
        </div>
      </div>

      {/* Game Master: Manage Players */}
      <ManagePlayersPanel
        players={game?.players || []}
        isGameMaster={!!game?.players?.find((p) => p.name === "You" && p.isGameMaster)}
        friends={friends}
        gameId={game?.id || ""}
        token={token}
        onPlayersChanged={onRefresh}
      />

      {/* Player Activity Tracker */}
      {game?.playerActivity && game.playerActivity.length > 0 && (
        <PlayerActivityTracker activity={game.playerActivity} phase="voting" />
      )}

      {/* Voting cards — visual style matching discovery */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 28 }}>
        {sortedItems.map((item, idx) => {
          const isVoted = votes[item.id];
          const maxReached = voteCount >= maxVotes && !isVoted;
          const gradient = getBizGradient(item.id);
          return (
            <VoteCard
              key={item.id}
              item={item}
              idx={idx}
              isVoted={isVoted}
              maxReached={maxReached}
              hidden={hidden}
              gradient={gradient}
              onToggle={() => !maxReached && toggleVote(item.id)}
            />
          );
        })}
      </div>

      {/* Sticky bottom bar for submit/edit votes + GM controls */}
      <div style={{
        position: "sticky", bottom: 0, zIndex: 20,
        paddingTop: 16, paddingBottom: 16,
        background: `linear-gradient(to bottom, transparent 0%, ${BG} 20%)`,
      }}>
      {votesSubmitted ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <div style={{
            textAlign: "center", padding: "12px 20px", borderRadius: 4, width: "100%",
            background: `rgba(${NEON_RGB}, 0.04)`, border: `1px solid rgba(${NEON_RGB}, 0.2)`,
            fontFamily: FONT_BODY, fontSize: 12, color: NEON, fontWeight: 600,
          }}>
            ✓ Votes submitted! Waiting for the round to end.
          </div>
          <NeonBtn variant="outline" onClick={() => setVotesSubmitted(false)}>
            Edit Votes
          </NeonBtn>
        </div>
      ) : (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <NeonBtn variant="filled" onClick={handleSubmit} disabled={voteCount === 0 || submitting}
            color={isFinal ? PINK : NEON} colorRGB={isFinal ? PINK_RGB : NEON_RGB}>
          {submitting ? "Submitting..." : isFinal ? `Submit Final ${voteCount} Vote${voteCount !== 1 ? "s" : ""}` : `Submit ${voteCount} Vote${voteCount !== 1 ? "s" : ""} →`}
          </NeonBtn>
        </div>
      )}

      {/* GM: End round early */}
      {game?.players?.find((p) => p.name === "You")?.isGameMaster && (
        <div style={{ marginTop: 14, display: "flex", justifyContent: "center" }}>
          <button onClick={onAdvance} style={{
            fontFamily: FONT_BODY, fontSize: 11, fontWeight: 600, letterSpacing: "0.06em",
            color: ORANGE, background: "none", border: `1px solid rgba(255,107,45,0.25)`,
            borderRadius: 4, padding: "8px 20px", cursor: "pointer", transition: "all 0.25s ease",
          }}
            onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,107,45,0.08)";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,107,45,0.5)";
            }}
            onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
              (e.currentTarget as HTMLElement).style.background = "none";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,107,45,0.25)";
            }}
          >
            End Round Early
          </button>
        </div>
      )}
      </div>
    </div>
  );
};

const VoteCard = ({ item, idx, isVoted, maxReached, hidden, gradient, onToggle }: VoteCardProps) => {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onToggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 6, overflow: "hidden", cursor: maxReached ? "not-allowed" : "pointer",
        transition: "all 0.35s cubic-bezier(0.23,1,0.32,1)",
        transform: hovered && !maxReached ? "translateY(-4px)" : "none",
        opacity: maxReached ? 0.45 : 1,
        border: isVoted ? `2px solid ${NEON}` : "2px solid transparent",
        boxShadow: isVoted ? `0 0 20px rgba(${NEON_RGB}, 0.2)` : hovered ? "0 12px 32px rgba(0,0,0,0.4)" : "none",
        animation: `slideUp 0.4s ease ${0.06 * idx}s both`,
      }}
    >
      {/* Image carousel */}
      <CardImageCarousel images={item.images} gradient={gradient} height={120}>
        {/* Vote check */}
        {isVoted && (
          <div style={{
            position: "absolute", top: 10, right: 10, width: 28, height: 28, borderRadius: "50%",
            background: NEON, display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 0 12px rgba(${NEON_RGB}, 0.5)`, animation: "votePopIn 0.3s ease both", zIndex: 3,
          }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M3 8l4 4 6-7" stroke={BG} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
      </CardImageCarousel>

      {/* Info bar — name + vote status */}
      <div style={{ background: CARD_BG, padding: "10px 14px" }}>
        <div style={{
          fontFamily: FONT_DISPLAY, fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {item.name}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 3 }}>
          {!hidden ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{
                height: 4, borderRadius: 2, background: `rgba(${NEON_RGB}, 0.2)`,
                width: 40, position: "relative", overflow: "hidden",
              }}>
                <div style={{
                  position: "absolute", inset: 0, borderRadius: 2,
                  width: `${Math.min(100, (item.votes / 5) * 100)}%`,
                  background: NEON, boxShadow: `0 0 6px rgba(${NEON_RGB}, 0.4)`,
                  transition: "width 0.5s ease",
                }} />
              </div>
              <span style={{ fontFamily: FONT_BODY, fontSize: 10, color: TEXT_DIM, fontWeight: 600 }}>
                {item.votes}
              </span>
            </div>
          ) : (
            <span style={{ fontFamily: FONT_BODY, fontSize: 9, color: TEXT_MUTED, fontStyle: "italic" }}>Votes hidden</span>
          )}
          <span style={{
            fontFamily: FONT_BODY, fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
            color: isVoted ? NEON : TEXT_MUTED, transition: "color 0.3s ease",
          }}>
            {isVoted ? "✓ Voted" : "Vote"}
          </span>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// WINNER REVEAL
// ═══════════════════════════════════════════════════════════════
const WinnerReveal = ({ game, onBack, visitThresholds: vt = DEFAULT_VISIT_THRESHOLDS }: WinnerRevealProps) => {
  const players = game?.players || [];
  const winners = Array.isArray(game?.winners) && game.winners.length > 0
    ? game.winners
    : game?.winner ? [game.winner] : [];
  const isMulti = winners.length > 1;

  return (
    <div style={{ animation: "fadeIn 0.5s ease both", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ alignSelf: "flex-start" }}><BackBtn onClick={onBack} label="Games" /></div>

      {/* Confetti */}
      <div style={{ position: "relative", height: 40, marginBottom: 10, width: "100%" }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} style={{
            position: "absolute", left: `${10 + (i * 7.2)}%`, top: 0, width: 6, height: 6, borderRadius: "50%",
            background: [NEON, PINK, YELLOW, BLUE, PURPLE, ORANGE][i % 6],
            animation: `confettiDrop 2s ease ${i * 0.15}s infinite`, opacity: 0.8,
          }} />
        ))}
      </div>

      <div style={{ fontSize: 48, marginBottom: 16, animation: "crownBounce 2s ease infinite" }}>👑</div>
      <SectionLabel text="THE GROUP HAS SPOKEN" />
      {isMulti && (
        <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: TEXT_DIM, marginTop: 4, marginBottom: 8 }}>
          Your {winners.length} winning picks
        </p>
      )}

      {/* Winner card(s) with business details */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%", marginTop: 8, marginBottom: 28 }}>
        {winners.map((w, wIdx) => (
          <div key={wIdx} style={{
            position: "relative", borderRadius: 6, padding: 2,
            background: `linear-gradient(90deg, transparent, ${NEON}, transparent, ${NEON}, transparent)`,
            backgroundSize: "300% 100%", animation: `borderTravelGreen ${6 + wIdx}s linear infinite`,
          }}>
            <div style={{ background: CARD_BG, borderRadius: 5, overflow: "hidden" }}>
              {/* Hero image carousel */}
              <CardImageCarousel images={w.images} gradient={w.gradient || getBizGradient(w.businessId || w.name)} height={200}>
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(transparent 30%, rgba(12,12,20,0.95) 100%)", zIndex: 1, pointerEvents: "none" }} />

                {/* Crown badge */}
                <div style={{
                  position: "absolute", top: 14, right: 14, width: 36, height: 36, borderRadius: "50%",
                  background: `rgba(${NEON_RGB}, 0.15)`, border: `2px solid ${NEON}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: `0 0 16px rgba(${NEON_RGB}, 0.4)`, zIndex: 3, pointerEvents: "none",
                }}>
                  <span style={{ fontSize: 18 }}>👑</span>
                </div>

                {isMulti && (
                  <div style={{
                    position: "absolute", top: 14, left: 14, padding: "4px 12px", borderRadius: 3,
                    background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)",
                    fontFamily: FONT_BODY, fontSize: 10, fontWeight: 700, color: YELLOW,
                    letterSpacing: "0.1em", textTransform: "uppercase", zIndex: 3, pointerEvents: "none",
                  }}>
                    Pick #{wIdx + 1}
                  </div>
                )}

                {/* Name overlay */}
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "16px 20px", zIndex: 2, pointerEvents: "none" }}>
                  <h2 style={{
                    fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 700, color: TEXT_PRIMARY, marginBottom: 4,
                    textShadow: `0 0 30px rgba(${NEON_RGB}, 0.3)`,
                  }}>
                    {w.name}
                  </h2>
                  {w.type && (
                    <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: TEXT_DIM }}>{w.type}</div>
                  )}
                </div>
              </CardImageCarousel>

              {/* Business details section */}
              <div style={{ padding: "16px 20px" }}>
                {/* Blurb / description */}
                {w.blurb && (
                  <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: TEXT_DIM, lineHeight: 1.6, fontStyle: "italic", marginBottom: 16 }}>
                    &ldquo;{w.blurb}&rdquo;
                  </p>
                )}

                {/* Status badges: type + price */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                  {w.type && (
                    <span style={{
                      fontFamily: FONT_BODY, fontSize: 11, fontWeight: 600, padding: "6px 14px", borderRadius: 50,
                      background: `rgba(${NEON_RGB}, 0.08)`, border: `1px solid rgba(${NEON_RGB}, 0.2)`, color: NEON,
                    }}>{w.type}</span>
                  )}
                  {w.priceLevel && (
                    <span style={{
                      fontFamily: FONT_BODY, fontSize: 12, fontWeight: 800, padding: "6px 14px", borderRadius: 50,
                      background: "rgba(255,214,0,0.08)", border: "1px solid rgba(255,214,0,0.2)", color: YELLOW,
                    }}>{w.priceLevel}</span>
                  )}
                </div>

                {/* Tags */}
                {w.tags.length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
                    {w.tags.map((tag) => (
                      <span key={tag} style={{
                        fontFamily: FONT_BODY, fontSize: 10, fontWeight: 600, padding: "4px 10px", borderRadius: 50,
                        background: `rgba(0,229,255,0.08)`, border: `1px solid rgba(0,229,255,0.15)`, color: BLUE,
                      }}>{tag}</span>
                    ))}
                  </div>
                )}

                {/* Divider */}
                <div style={{ height: 1, background: CARD_BORDER, marginBottom: 16 }} />

                {/* Contact info: Address, Phone, Website */}
                <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: 16 }}>
                  {([
                    { icon: "📍", label: "Address", value: w.address, action: "Directions", href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(w.address)}` },
                    { icon: "📞", label: "Phone", value: w.phone, action: "Call", href: `tel:${w.phone.replace(/[^+\d]/g, "")}` },
                    { icon: "🌐", label: "Website", value: w.website, action: "Visit", href: w.website.startsWith("http") ? w.website : `https://${w.website}` },
                  ] as { icon: string; label: string; value: string; action: string; href: string }[]).filter((item) => item.value).map((item, i, arr) => (
                    <div key={i} style={{
                      display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 0",
                      borderBottom: i < arr.length - 1 ? `1px solid ${CARD_BORDER}` : "none",
                    }}>
                      <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{item.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: FONT_BODY, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: TEXT_MUTED, marginBottom: 3 }}>
                          {item.label}
                        </div>
                        <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: TEXT_PRIMARY, fontWeight: 500, lineHeight: 1.4 }}>
                          {item.value}
                        </div>
                      </div>
                      <a href={item.href} target={item.label === "Phone" ? undefined : "_blank"} rel="noopener noreferrer" style={{
                        fontFamily: FONT_BODY, fontSize: 10, fontWeight: 700, padding: "6px 14px", borderRadius: 50,
                        border: `1px solid rgba(${PINK_RGB}, 0.3)`, background: `rgba(${PINK_RGB}, 0.08)`,
                        color: PINK, cursor: "pointer", whiteSpace: "nowrap", textDecoration: "none",
                      }}>
                        {item.action}
                      </a>
                    </div>
                  ))}
                </div>

                {/* Business Hours */}
                {Object.keys(w.hours).length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontFamily: FONT_BODY, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: TEXT_MUTED, marginBottom: 10 }}>
                      Hours
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {Object.entries(w.hours).map(([day, time]) => {
                        const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
                        const isToday = day === today;
                        return (
                          <div key={day} style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            padding: "8px 10px", borderRadius: 4,
                            background: isToday ? `rgba(${PINK_RGB}, 0.06)` : "transparent",
                            border: isToday ? `1px solid rgba(${PINK_RGB}, 0.15)` : "1px solid transparent",
                          }}>
                            <span style={{
                              fontFamily: FONT_BODY, fontSize: 12, fontWeight: isToday ? 700 : 500,
                              color: isToday ? PINK : TEXT_DIM,
                            }}>
                              {day} {isToday && <span style={{ fontSize: 9, opacity: 0.7 }}>(Today)</span>}
                            </span>
                            <span style={{
                              fontFamily: FONT_BODY, fontSize: 12, fontWeight: isToday ? 700 : 500,
                              color: isToday ? TEXT_PRIMARY : TEXT_DIM,
                            }}>
                              {time}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Progressive Payout Ladder */}
                {w.payout && w.payout.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontFamily: FONT_BODY, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: TEXT_MUTED, marginBottom: 10 }}>
                      Progressive Payout
                    </div>
                    {(() => {
                      const TIER_LABELS = vt.map((t) => t.label);
                      const TIER_COLORS = [TEXT_DIM, BLUE, NEON, YELLOW, ORANGE, PURPLE, PINK];
                      const TIER_VISITS = vt.map((t) => t.max == null ? `${t.min}+` : `${t.min}–${t.max}`);
                      return w.payout.slice(0, 7).map((pct, i) => (
                        <div key={i} style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "10px 12px", borderRadius: 8, marginBottom: 6,
                          background: `${TIER_COLORS[i]}08`,
                          border: `1px solid ${TIER_COLORS[i]}20`,
                        }}>
                          <div style={{
                            width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            background: `${TIER_COLORS[i]}15`, fontSize: 11, fontWeight: 800,
                            color: TIER_COLORS[i], fontFamily: FONT_BODY,
                          }}>{i + 1}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: TEXT_PRIMARY, fontFamily: FONT_BODY }}>
                              Level {i + 1} <span style={{ color: TIER_COLORS[i] }}>({TIER_LABELS[i]})</span>
                            </div>
                            <div style={{ fontSize: 9, color: TEXT_DIM, fontFamily: FONT_BODY }}>{TIER_VISITS[i]} visits</div>
                          </div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: TIER_COLORS[i], fontFamily: FONT_BODY }}>{pct}%</div>
                        </div>
                      ));
                    })()}
                    <div style={{
                      marginTop: 8, padding: "8px 12px", borderRadius: 8,
                      background: `${BLUE}08`, border: `1px solid ${BLUE}15`,
                      fontSize: 9, color: TEXT_DIM, fontFamily: FONT_BODY, lineHeight: 1.5,
                    }}>
                      Only verified receipts count towards visit totals &amp; progressive payouts.
                    </div>
                  </div>
                )}

                {/* Divider */}
                <div style={{ height: 1, background: CARD_BORDER, marginBottom: 14 }} />

                {/* Game info footer */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{
                      fontFamily: FONT_DISPLAY, fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
                      color: NEON, padding: "4px 8px", borderRadius: 3,
                      background: `rgba(${NEON_RGB}, 0.06)`, border: `1px solid rgba(${NEON_RGB}, 0.12)`,
                    }}>
                      {game?.gameCode || "—"}
                    </div>
                    <AvatarStack players={players} size={24} />
                  </div>
                  <span style={{ fontFamily: FONT_BODY, fontSize: 10, color: TEXT_MUTED }}>
                    {game?.totalRounds || 0} rounds
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Back link */}
      <button onClick={onBack} style={{
        fontFamily: FONT_BODY, fontSize: 12, fontWeight: 600, color: TEXT_DIM,
        background: "none", border: `1px solid ${CARD_BORDER}`, borderRadius: 4,
        padding: "10px 28px", cursor: "pointer", transition: "all 0.25s ease",
      }}
        onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => { (e.currentTarget as HTMLElement).style.borderColor = `rgba(${NEON_RGB}, 0.3)`; (e.currentTarget as HTMLElement).style.color = NEON; }}
        onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => { (e.currentTarget as HTMLElement).style.borderColor = CARD_BORDER; (e.currentTarget as HTMLElement).style.color = TEXT_DIM; }}
      >
        Back to Games
      </button>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// COUNTDOWN BADGE (live timer from roundEndTime)
// ═══════════════════════════════════════════════════════════════
const CountdownBadge = ({ endTime }: { endTime: number }) => {
  const [label, setLabel] = useState("");
  useEffect(() => {
    const tick = () => {
      const diff = endTime - Date.now();
      if (diff <= 0) { setLabel("Time's up!"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setLabel(h > 0 ? `${h}h ${m}m left` : `${m}m left`);
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [endTime]);
  return (
    <div style={{ fontFamily: FONT_BODY, fontSize: 11, color: YELLOW, fontWeight: 600, letterSpacing: "0.05em", padding: "6px 12px", borderRadius: 3, background: "rgba(255,214,0,0.08)", border: "1px solid rgba(255,214,0,0.2)" }}>
      ⏱ {label}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════════════════
const Toast = ({ message, type, onDone }: { message: string; type: "success" | "error" | "info"; onDone: () => void }) => {
  useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t); }, [onDone]);
  const colors = { success: NEON, error: PINK, info: BLUE };
  const c = colors[type] || NEON;
  return (
    <div style={{
      position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 9999,
      padding: "12px 24px", borderRadius: 6, background: CARD_BG, border: `1px solid ${c}50`,
      boxShadow: `0 4px 24px rgba(0,0,0,0.5), 0 0 12px ${c}30`,
      fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, color: c,
      animation: "fadeIn 0.3s ease both", maxWidth: 400,
    }}>{message}</div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TRANSFORM: API → UI types
// ═══════════════════════════════════════════════════════════════
interface APIPlayer { userId: string; name: string; avatar: string | null; role: string; joinedAt?: string; removedAt?: string | null; }
interface APIGame {
  id: string; game_code: string; name: string; location: string; created_by: string;
  status: string; current_round: number; total_rounds: number; advance_per_round: number[];
  time_between_rounds_minutes: number; votes_hidden: boolean; allow_invites: boolean;
  round_end_time: string | null; winner_business_ids: string[]; created_at: string;
  completed_at: string | null;
  players?: APIPlayer[]; playerCount?: number; winnerBusinessNames?: string[];
  selections?: { id: string; businessId: string; businessName: string; businessImage: string | null; businessImages: string[]; selectedBy: string; selectedByName: string }[];
  voteTally?: { businessId: string; businessName: string; votes: number }[];
  myVotesThisRound?: string[]; myRole?: string; activePlayerCount?: number;
  selectorsInfo?: { userId: string; count: number }[];
  votersThisRound?: string[];
  totalUniqueSelections?: number;
  winnersEnriched?: {
    businessId: string; businessName: string; businessImage: string | null;
    businessImages: string[];
    address: string; phone: string; website: string; priceLevel: string;
    blurb: string; tags: string[]; hours: Record<string, string>; businessType: string;
    payout: number[];
  }[];
}

function transformGame(g: APIGame, userId?: string): Game {
  const players: Player[] = (g.players || []).filter((p: APIPlayer) => !p.removedAt).map((p: APIPlayer) => ({
    id: p.userId,
    name: p.userId === userId ? "You" : p.name,
    avatar: p.avatar || "",
    isGameMaster: p.role === "game_master",
  }));

  const isComplete = g.status === "complete" || g.status === "cancelled";
  const myVotes = new Set(g.myVotesThisRound || []);

  // Build selections from detail API (merge vote tallies)
  const tallyMap = new Map<string, number>();
  for (const t of g.voteTally || []) tallyMap.set(t.businessId, t.votes);

  const selections: Selection[] = (g.selections || []).map((s) => ({
    id: s.businessId,
    name: s.businessName,
    type: "",
    votes: tallyMap.get(s.businessId) ?? 0,
    img: s.businessImage || "",
    images: s.businessImages || [],
    voted: myVotes.has(s.businessId),
  }));

  // Build winners from enriched data (detail API) or names (list API)
  const emptyWinner = { address: "", phone: "", website: "", priceLevel: "", blurb: "", tags: [] as string[], hours: {} as Record<string, string>, payout: [5, 7.5, 10, 12.5, 15, 17.5, 20] };
  let winners: Winner[];
  if (g.winnersEnriched && g.winnersEnriched.length > 0) {
    winners = g.winnersEnriched.map((w) => ({
      businessId: w.businessId,
      name: w.businessName,
      type: w.businessType || "",
      img: w.businessImage || "",
      images: w.businessImages || [],
      gradient: getBizGradient(w.businessId),
      address: w.address || "",
      phone: w.phone || "",
      website: w.website || "",
      priceLevel: w.priceLevel || "",
      blurb: w.blurb || "",
      tags: w.tags || [],
      hours: w.hours || {},
      payout: w.payout || [5, 7.5, 10, 12.5, 15, 17.5, 20],
    }));
  } else {
    const winnerNames = g.winnerBusinessNames || [];
    winners = winnerNames.map((name) => ({ businessId: "", name, type: "", img: "", images: [], gradient: getBizGradient(name), ...emptyWinner }));
  }

  // Build player activity (selection phase: who selected how many; voting phase: who voted)
  const selectorMap = new Map<string, number>();
  for (const s of g.selectorsInfo || []) selectorMap.set(s.userId, s.count);
  const voterSet = new Set(g.votersThisRound || []);

  const isVotingPhase = g.status === "voting";
  const playerActivity: PlayerActivity[] = players.map((p) => ({
    id: p.id,
    name: p.name,
    avatar: p.avatar,
    isGameMaster: !!p.isGameMaster,
    hasContributed: isVotingPhase ? voterSet.has(p.id) : selectorMap.has(p.id),
    count: isVotingPhase ? (voterSet.has(p.id) ? 1 : 0) : (selectorMap.get(p.id) ?? 0),
  }));

  return {
    id: g.id,
    gameCode: g.game_code,
    name: g.name,
    status: isComplete ? "completed" : "active",
    currentRound: g.current_round,
    totalRounds: g.total_rounds,
    players,
    advancePerRound: g.advance_per_round,
    votesHidden: g.votes_hidden,
    allowInvites: g.allow_invites,
    roundEndTime: g.round_end_time ? new Date(g.round_end_time).getTime() : undefined,
    selections,
    createdAt: g.created_at,
    winner: winners[0] || undefined,
    winners: winners.length > 0 ? winners : undefined,
    location: g.location,
    createdBy: g.created_by,
    playerActivity,
    totalUniqueSelections: g.totalUniqueSelections ?? 0,
  };
}

// ═══════════════════════════════════════════════════════════════
// MAIN APP SHELL
// ═══════════════════════════════════════════════════════════════
export default function GroupVote() {
  const router = useRouter();

  // ── Platform settings (visit thresholds) ──
  const [visitThresholds, setVisitThresholds] = useState<VisitThreshold[]>(DEFAULT_VISIT_THRESHOLDS);
  useEffect(() => {
    fetchPlatformTierConfig(supabaseBrowser).then((cfg) => setVisitThresholds(cfg.visitThresholds));
  }, []);

  // ── Auth ──
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [token, setToken] = useState("");
  const [authLoading, setAuthLoading] = useState(true);

  // ── Location ──
  const [parentZip, setParentZip] = useState("68102");
  const [parentCoords, setParentCoords] = useState<[number, number] | null>(null);

  // ── Data ──
  const [games, setGames] = useState<Game[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [gamesLoading, setGamesLoading] = useState(false);

  // ── Active game ──
  const [view, setView] = useState<ViewState>("hub");
  const viewRef = useRef<ViewState>("hub");
  // Keep ref in sync so fetchGameDetail can read current view without being a dependency
  const updateView = useCallback((v: ViewState) => { viewRef.current = v; setView(v); }, []);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Toast ──
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
  }, []);

  // ── Onboarding Tour ──
  const groupTourSteps: TourStep[] = useMemo(() => [
    { target: '[data-tour="group-create"]', title: "Start a group vote", description: "Can't decide where to go? Create a game and invite your friends. Everyone votes together.", position: "bottom" },
    { target: '[data-tour="group-join"]', title: "Join with a code", description: "Got a game code from a friend? Paste it here to jump into their group vote instantly.", position: "bottom" },
    { target: '[data-tour="group-games"]', title: "Your active games", description: "All your games — active and completed — live here. Tap any game to rejoin or see results.", position: "top" },
  ], []);
  const groupTourIllustrations: React.ReactNode[] = useMemo(() => [
    <GroupCreateAnim key="gc" />, <JoinCodeAnim key="jc" />, <GameListAnim key="gl" />,
  ], []);
  const tour = useOnboardingTour("group", groupTourSteps, 1000);

  // ── Clock ──
  const [timeStr, setTimeStr] = useState("");
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }) + " · " + now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }));
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);

  // ── Auth check ──
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      if (!session?.user || !session.access_token) {
        router.replace("/welcome");
        return;
      }
      setUser({ id: session.user.id });
      setToken(session.access_token);
      setAuthLoading(false);
      // Load user's zip from profile
      const { data: profile } = await supabaseBrowser.from("profiles").select("zip_code").eq("id", session.user.id).maybeSingle();
      if (profile?.zip_code) {
        setParentZip(profile.zip_code);
        const coords = ZIP_COORDS[profile.zip_code];
        if (coords) setParentCoords(coords);
      }
    })();
    // Browser geolocation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setParentCoords([pos.coords.latitude, pos.coords.longitude]),
        () => {},
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
      );
    }
  }, [router]);

  // ── Fetch games ──
  const fetchGames = useCallback(async () => {
    if (!token) return;
    setGamesLoading(true);
    try {
      const data = await apiFetch("/api/group-games", token);
      setGames((data.games || []).map((g: APIGame) => transformGame(g, user?.id)));
    } catch (err) {
      showToast((err as Error).message, "error");
    }
    setGamesLoading(false);
  }, [token, user?.id, showToast]);

  // ── Fetch friends ──
  const fetchFriends = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch("/api/friends", token);
      setFriends((data.friends || []).map((f: { id: string; name: string; avatarUrl: string | null; status?: string }) => ({
        id: f.id, name: f.name, avatarUrl: f.avatarUrl, status: f.status,
      })));
    } catch { /* silent */ }
  }, [token]);

  // ── Fetch ALL nearby businesses via discover API ──
  const fetchBusinesses = useCallback(async () => {
    if (!parentCoords && !parentZip) return;
    try {
      const allBiz: Business[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const params = new URLSearchParams({ page: String(page), limit: "100" });
        if (parentCoords) {
          params.set("userLat", String(parentCoords[0]));
          params.set("userLng", String(parentCoords[1]));
        }
        if (parentZip) params.set("userZip", parentZip);
        params.set("distance", "50");

        const res = await fetch(`/api/businesses/discover?${params}`);
        if (!res.ok) break;
        const data = await res.json();

        const rows = (data.businesses ?? []) as Record<string, unknown>[];
        const mediaRows = (data.media ?? []) as { business_id: string; bucket: string; path: string }[];

        // Build media map for this page
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
        const mediaMap = new Map<string, string[]>();
        for (const m of mediaRows) {
          if (!mediaMap.has(m.business_id)) mediaMap.set(m.business_id, []);
          const url = `${supabaseUrl}/storage/v1/object/public/${m.bucket}/${m.path}`;
          mediaMap.get(m.business_id)!.push(url);
        }

        for (const b of rows) {
          const cfg = (b.config as Record<string, unknown>) ?? {};
          const subtype = (cfg.subtype as string) || "";
          const type = subtype || (cfg.businessType as string) || (b.category_main as string) || "";
          const dbTags = Array.isArray(b.tags) ? (b.tags as string[]) : [];
          const tags = dbTags.length > 0 ? dbTags : (cfg.tags as string[]) || [];
          const cfgImages = Array.isArray(cfg.images) ? (cfg.images as string[]).filter(Boolean) : [];
          const mediaImages = mediaMap.get(b.id as string) || [];
          const allImages = [...cfgImages];
          for (const url of mediaImages) {
            if (!allImages.includes(url)) allImages.push(url);
          }
          allBiz.push({
            id: b.id as string,
            name: ((b.public_business_name || b.business_name) as string) || "Unknown",
            type,
            category: type.toLowerCase().includes("bar") || type.toLowerCase().includes("brew") || type.toLowerCase().includes("lounge") ? "bars"
              : type.toLowerCase().includes("club") ? "clubs"
              : type.toLowerCase().includes("outdoor") || type.toLowerCase().includes("adventure") ? "outdoors"
              : "restaurants",
            vibe: (cfg.vibe as string) || "",
            dist: "",
            img: allImages[0] || "",
            images: allImages,
            rating: 0,
            priceLevel: (cfg.priceLevel as string) || "$$",
            tags,
            zip: (b.zip as string) || "",
            latitude: (b.latitude as number) ?? null,
            longitude: (b.longitude as number) ?? null,
            gradient: getBizGradient(b.id as string),
          });
        }

        hasMore = data.hasMore ?? false;
        page++;
      }

      setBusinesses(allBiz);
    } catch { /* silent */ }
  }, [parentCoords, parentZip]);

  // ── Initial fetch ──
  useEffect(() => {
    if (!token) return;
    fetchGames();
    fetchFriends();
    fetchBusinesses();
  }, [token, fetchGames, fetchFriends, fetchBusinesses]);

  // ── Fetch active game detail ──
  const fetchGameDetail = useCallback(async (gameId: string) => {
    if (!token) return;
    try {
      const data = await apiFetch(`/api/group-games/${gameId}`, token);
      if (data.game) {
        const transformed = transformGame(data.game as APIGame, user?.id);
        setSelectedGame(transformed);
        // Auto-transition views based on game status (use ref to avoid dependency cycle)
        const currentView = viewRef.current;
        if (transformed.status === "completed" && currentView !== "winner") updateView("winner");
        else if (transformed.currentRound === 1 && transformed.status === "active" && currentView === "voting") updateView("selection");
        else if (transformed.currentRound >= 2 && transformed.status === "active" && currentView === "selection") updateView("voting");
      }
    } catch { /* silent — will retry on next poll */ }
  }, [token, user?.id, updateView]);

  // ── Polling ──
  useEffect(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (activeGameId && (view === "selection" || view === "voting")) {
      fetchGameDetail(activeGameId);
      pollRef.current = setInterval(() => fetchGameDetail(activeGameId), 5000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeGameId, view, fetchGameDetail]);

  // ── API handlers ──
  const handleJoinByCode = async (code: string) => {
    try {
      const data = await apiFetch("/api/group-games/join", token, { method: "POST", body: JSON.stringify({ gameCode: code }) });
      showToast(data.alreadyJoined ? "Already in this game!" : "Joined game!", "success");
      fetchGames();
    } catch (err) { showToast((err as Error).message, "error"); }
  };

  const handleLeaveGame = async (gameId: string) => {
    if (!user) return;
    try {
      await apiFetch(`/api/group-games/${gameId}/players`, token, {
        method: "DELETE", body: JSON.stringify({ userId: user.id }),
      });
      showToast("You have left the game.", "success");
      fetchGames();
    } catch (err) { showToast((err as Error).message, "error"); }
  };

  const handleDeleteGame = async (gameId: string) => {
    try {
      await apiFetch(`/api/group-games/${gameId}`, token, { method: "DELETE" });
      showToast("Game has been cancelled.", "success");
      fetchGames();
    } catch (err) { showToast((err as Error).message, "error"); }
  };

  const handleCreateGame = async (config: {
    name: string; location: string; totalRounds: number; advancePerRound: number[];
    timeBetweenRounds: string; votesHidden: boolean; allowInvites: boolean;
    startDate?: string; endDate?: string; invitedFriendIds: string[];
  }): Promise<string | null> => {
    try {
      const data = await apiFetch("/api/group-games", token, {
        method: "POST",
        body: JSON.stringify(config),
      });
      showToast("Game created!", "success");
      fetchGames();
      // Open the new game in selection phase
      const newGame = transformGame(data.game as APIGame, user?.id);
      setSelectedGame(newGame);
      setActiveGameId(newGame.id);
      updateView("selection");
      return data.gameCode as string;
    } catch (err) {
      showToast((err as Error).message, "error");
      return null;
    }
  };

  const handleAddSelection = async (bizId: string) => {
    if (!activeGameId) return;
    try {
      await apiFetch(`/api/group-games/${activeGameId}/selections`, token, {
        method: "POST", body: JSON.stringify({ businessId: bizId }),
      });
    } catch (err) { showToast((err as Error).message, "error"); }
  };

  const handleRemoveSelection = async (bizId: string) => {
    if (!activeGameId) return;
    try {
      await apiFetch(`/api/group-games/${activeGameId}/selections`, token, {
        method: "DELETE", body: JSON.stringify({ businessId: bizId }),
      });
    } catch (err) { showToast((err as Error).message, "error"); }
  };

  const handleAdvanceFromSelection = async () => {
    if (!activeGameId) return;
    try {
      await apiFetch(`/api/group-games/${activeGameId}`, token, {
        method: "PATCH", body: JSON.stringify({ action: "start_voting" }),
      });
      showToast("Voting started!", "success");
      fetchGameDetail(activeGameId);
      updateView("voting");
    } catch (err) { showToast((err as Error).message, "error"); }
  };

  const handleSubmitVotes = async (bizIds: string[]) => {
    if (!activeGameId) return;
    try {
      await apiFetch(`/api/group-games/${activeGameId}/votes`, token, {
        method: "POST", body: JSON.stringify({ businessIds: bizIds }),
      });
      showToast("Votes submitted!", "success");
      fetchGameDetail(activeGameId);
    } catch (err) { showToast((err as Error).message, "error"); }
  };

  const handleAdvanceRound = async () => {
    if (!activeGameId) return;
    try {
      const data = await apiFetch(`/api/group-games/${activeGameId}`, token, {
        method: "PATCH", body: JSON.stringify({ action: "advance_round" }),
      });
      if (data.winners) {
        showToast("We have a winner!", "success");
        fetchGameDetail(activeGameId);
        updateView("winner");
      } else {
        showToast("Round advanced!", "success");
        fetchGameDetail(activeGameId);
      }
    } catch (err) { showToast((err as Error).message, "error"); }
  };

  const handleRefresh = () => {
    if (activeGameId) fetchGameDetail(activeGameId);
  };

  const goHome = () => {
    updateView("hub");
    setSelectedGame(null);
    setActiveGameId(null);
    fetchGames();
  };

  const openGame = (game: Game) => {
    setSelectedGame(game);
    setActiveGameId(game.id);
    if (game.status === "completed") {
      updateView("winner");
      // Fetch full detail (winnersEnriched) — list API only has names
      fetchGameDetail(game.id);
    }
    else if (game.currentRound === 1) updateView("selection");
    else updateView("voting");
  };

  // ── Auth guard ──
  if (authLoading) {
    return (
      <>
        <GlobalStyles />
        <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: TEXT_DIM, animation: "fadeIn 0.5s ease both" }}>Loading...</div>
        </div>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <GlobalStyles />
        <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 48 }}>⬡</div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 700, color: TEXT_PRIMARY }}>Group Vote</div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: TEXT_DIM }}>Sign in to start or join a game</div>
          <NeonBtn variant="filled" onClick={() => window.location.href = "/"}>Go to Login</NeonBtn>
        </div>
      </>
    );
  }

  return (
    <>
      <GlobalStyles />
      {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}
      <div style={{ minHeight: "100vh", background: BG, color: TEXT_PRIMARY, display: "flex", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: 680, padding: "0 28px" }}>
          {/* Top Bar */}
          <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 0 20px", animation: "fadeIn 0.4s ease both" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div onClick={() => view === "hub" ? window.location.href = "/" : goHome()} style={{
                width: 34, height: 34, borderRadius: 4, border: "1px solid rgba(255,255,255,0.12)",
                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                transition: "border-color 0.3s ease",
              }}
                onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => { (e.currentTarget as HTMLElement).style.borderColor = `rgba(${NEON_RGB}, 0.4)`; }}
                onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.12)"; }}
              >
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

          <MarqueeBanner text="EVERYONE VOTES · ONE PLACE WINS · GO PLAY EAT" />

          {/* Step Tracker */}
          {(() => {
            const steps: { id: ViewState; icon: string; label: string }[] = [
              { id: "hub", icon: "⬡", label: "GAMES" },
              { id: "setup", icon: "⚙", label: "SETUP" },
              { id: "selection", icon: "🔍", label: "SELECT" },
              { id: "voting", icon: "✋", label: "VOTE" },
              { id: "winner", icon: "🏆", label: "WINNER" },
            ];
            const viewOrder: ViewState[] = ["hub", "setup", "selection", "voting", "winner"];
            const currentIdx = viewOrder.indexOf(view);

            return (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 0,
                padding: "16px 0 20px", position: "relative",
              }}>
                {steps.map((s, i) => {
                  const isActive = i === currentIdx;
                  const isDone = i < currentIdx;
                  const stepColor = isActive ? NEON : isDone ? NEON : "rgba(255,255,255,0.15)";
                  return (
                    <div key={s.id} style={{ display: "flex", alignItems: "center" }}>
                      <div style={{ position: "relative" }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: "50%",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          background: isActive ? `rgba(${NEON_RGB}, 0.15)` : isDone ? `rgba(${NEON_RGB}, 0.08)` : "rgba(255,255,255,0.03)",
                          border: `2px solid ${stepColor}`,
                          boxShadow: isActive ? `0 0 16px rgba(${NEON_RGB}, 0.35)` : isDone ? `0 0 8px rgba(${NEON_RGB}, 0.15)` : "none",
                          transition: "all 0.4s ease",
                        }}>
                          <span style={{
                            fontSize: 13, fontWeight: 800, color: stepColor,
                            fontFamily: FONT_BODY,
                          }}>{isDone ? "✓" : s.icon}</span>
                        </div>
                        <div style={{
                          position: "absolute", top: 42, left: "50%", transform: "translateX(-50%)",
                          fontSize: 8, fontWeight: 700, letterSpacing: "0.1em",
                          color: isActive ? NEON : isDone ? `rgba(${NEON_RGB}, 0.6)` : TEXT_MUTED,
                          fontFamily: FONT_BODY, textAlign: "center", whiteSpace: "nowrap",
                        }}>{s.label}</div>
                      </div>
                      {i < steps.length - 1 && (
                        <div style={{
                          width: 32, height: 2, borderRadius: 1,
                          background: isDone ? NEON : "rgba(255,255,255,0.08)",
                          margin: "0 4px",
                          boxShadow: isDone ? `0 0 6px rgba(${NEON_RGB}, 0.3)` : "none",
                          transition: "all 0.4s ease",
                        }} />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          <div style={{ paddingBottom: 20 }}>
            {view === "hub" && <GameHub games={games} loading={gamesLoading} onNewGame={() => updateView("setup")} onOpenGame={openGame} onGoHome={goHome} onJoinByCode={handleJoinByCode} onLeaveGame={handleLeaveGame} onDeleteGame={handleDeleteGame} />}
            {view === "setup" && <GameSetup friends={friends} onBack={goHome} onCreateGame={handleCreateGame} />}
            {view === "selection" && <SelectionPhase game={selectedGame} businesses={businesses} friends={friends} token={token} onBack={goHome} onAdvance={handleAdvanceFromSelection} onAddSelection={handleAddSelection} onRemoveSelection={handleRemoveSelection} onRefresh={handleRefresh} />}
            {view === "voting" && selectedGame && <VotingPhase game={selectedGame} friends={friends} token={token} onBack={goHome}
              onAdvance={handleAdvanceRound} onSubmitVotes={handleSubmitVotes} onRefresh={handleRefresh}
              roundNum={selectedGame.currentRound} totalRounds={selectedGame.totalRounds} advanceCount={selectedGame.advancePerRound?.[selectedGame.currentRound - 1] || 3} />}
            {view === "winner" && <WinnerReveal game={selectedGame} onBack={goHome} visitThresholds={visitThresholds} />}
          </div>

        </div>
      </div>

      {/* Onboarding tour */}
      {tour.isTouring && tour.currentStep && (
        <OnboardingTooltip
          step={tour.currentStep}
          stepIndex={tour.stepIndex}
          totalSteps={tour.totalSteps}
          onNext={tour.next}
          onBack={tour.back}
          onSkip={tour.skip}
          illustration={tour.stepIndex >= 0 ? groupTourIllustrations[tour.stepIndex] : undefined}
        />
      )}
    </>
  );
}
