"use client";

import { useState, useRef, useEffect, useMemo, Suspense, type CSSProperties, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import {
  type BusinessRow, type MediaRow, type DiscoveryBusiness,
  normalizeToDiscoveryBusiness, getBusinessGradient, getBusinessEmoji,
} from "@/lib/businessNormalize";
import { getDistanceBetweenZips } from "@/lib/zipUtils";
import NotificationBell from "@/components/NotificationBell";
import { fetchPlatformTierConfig, getVisitRangeLabel, DEFAULT_VISIT_THRESHOLDS, type VisitThreshold } from "@/lib/platformSettings";
import { fetchTagsByCategory, type TagCategory } from "@/lib/availableTags";
import OnboardingTooltip from "@/components/OnboardingTooltip";
import { useOnboardingTour, type TourStep } from "@/lib/useOnboardingTour";
import { CategoryGridAnim, FilterAnim, FriendSelectAnim, PickFiveAnim, MiniGamesAnim, FunnelGameAnim, PickWinnerAnim, CelebrationAnim, GameHistoryAnim } from "@/components/TourIllustrations";

// ═══════════════════════════════════════════════════
// LETSGO 5v3v1 GAME
// Fun decision-making game between two friends
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

const NEON = "#FFD600";
const NEON_RGB = "255,214,0";

// ─── Types ───

type GameFriend = {
  friendshipId: string;
  id: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  status: "online" | "away" | "offline";
};

type GameSession = {
  id: string;
  game_code: string;
  game_type: string;
  player1_id: string;
  player2_id: string | null;
  status: string;
  category: string | null;
  filters: Record<string, unknown>;
  pick5_ids: string[];
  pick3_ids: string[];
  pick1_id: string | null;
  winner_business_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  expires_at: string | null;
};

type FilterState = {
  categories: string[];
  price: string;
  openNow: boolean;
  distance: number;
  tags: string[];
  browseFrom?: string;
};

type CategoryOption = {
  id: string;
  label: string;
  emoji: string;
};

// ─── Fallback arrays (used if DB fetch fails) ───
const DEFAULT_CATEGORIES: CategoryOption[] = [
  { id: "restaurant", label: "Restaurant", emoji: "🍽️" },
  { id: "bar", label: "Bar / Lounge", emoji: "🍸" },
  { id: "coffee", label: "Coffee Shop", emoji: "☕" },
  { id: "activity", label: "Activity", emoji: "🎳" },
  { id: "nightclub", label: "Nightclub", emoji: "🪩" },
  { id: "entertainment", label: "Entertainment", emoji: "🎬" },
  { id: "outdoors", label: "Outdoors", emoji: "🌲" },
  { id: "shopping", label: "Shopping", emoji: "🛍️" },
  { id: "wellness", label: "Wellness & Spa", emoji: "🧖" },
  { id: "brewery", label: "Brewery / Winery", emoji: "🍺" },
  { id: "dessert", label: "Desserts", emoji: "🍰" },
  { id: "anything", label: "Surprise Me!", emoji: "🎲" },
];

const DEFAULT_FILTER_CATEGORIES = ["All", "Restaurant", "Bar", "Coffee", "Entertainment", "Activity", "Nightclub", "Brewery", "Winery", "Food Truck", "Bakery", "Lounge", "Pub", "Sports Bar", "Karaoke", "Arcade", "Bowling", "Mini Golf", "Escape Room", "Theater", "Comedy Club", "Art Gallery", "Museum", "Spa", "Gym"];
const PRICE_FILTERS = ["Any", "$", "$$", "$$$", "$$$$"];
const DEFAULT_CUISINE_FILTERS = ["American", "Italian", "Mexican", "Chinese", "Japanese", "Thai", "Indian", "Korean", "Vietnamese", "Mediterranean", "Greek", "French", "BBQ", "Seafood", "Sushi", "Ramen", "Pizza", "Burgers", "Tacos", "Farm-to-Table", "Fusion"];
const DEFAULT_VIBE_FILTERS = ["Romantic", "Chill", "Lively", "Upscale", "Casual", "Trendy", "Cozy", "Retro", "Modern", "Rooftop", "Waterfront", "Hidden Gem", "Instagrammable", "Speakeasy", "Dive Bar", "Sports Vibe", "Artsy"];



// ═══════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════

function FloatingOrbs() {
  const orbs = [
    { size: 320, x: "10%", y: "15%", color: NEON, delay: 0, dur: 18 },
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

const PRICE_TOOLTIPS: Record<string, string> = { "$": "Under $15/person", "$$": "$15–$30/person", "$$$": "$30–$60/person", "$$$$": "$60+/person" };

function GlassPill({ children, style: extraStyle, onClick, active, title }: { children: ReactNode; style?: CSSProperties; onClick?: () => void; active?: boolean; title?: string }) {
  return (
    <button onClick={onClick} title={title} style={{
      padding: "8px 18px", borderRadius: 50, border: `1px solid ${active ? NEON : COLORS.cardBorder}`,
      background: active ? `${NEON}22` : COLORS.glass, backdropFilter: "blur(16px)",
      color: active ? NEON : COLORS.textSecondary, fontSize: 13, fontWeight: 600,
      cursor: "pointer", transition: "all 0.25s ease", whiteSpace: "nowrap",
      fontFamily: "'DM Sans', sans-serif", ...extraStyle,
    }}>
      {children}
    </button>
  );
}

// ─── NeonCard Header ───
function NeonHeader({ title, subtitle, onBack, rightAction }: { title: string; subtitle?: string; onBack: () => void; rightAction?: ReactNode }) {
  return (
    <div style={{ position: "relative", zIndex: 100 }}>
      <style>{`
        @keyframes borderTravel-531 {
          0% { background-position: 0% 50%; }
          100% { background-position: 300% 50%; }
        }
        @keyframes neonFlicker-531 {
          0%, 100% { text-shadow: 0 0 8px ${NEON}90, 0 0 20px ${NEON}50; }
          5% { text-shadow: 0 0 4px ${NEON}40, 0 0 10px ${NEON}20; }
          6% { text-shadow: 0 0 8px ${NEON}90, 0 0 20px ${NEON}50; }
          45% { text-shadow: 0 0 8px ${NEON}90, 0 0 20px ${NEON}50; }
          46% { text-shadow: 0 0 2px ${NEON}30, 0 0 6px ${NEON}15; }
          48% { text-shadow: 0 0 8px ${NEON}90, 0 0 20px ${NEON}50; }
        }
        @keyframes logoGlow-531 {
          0%, 100% { filter: drop-shadow(0 0 8px #FFD600) drop-shadow(0 0 20px #FFD60050); }
          50% { filter: drop-shadow(0 0 12px #FFD600) drop-shadow(0 0 35px #FFD60070); }
        }
        @keyframes starBlink {
          0%, 100% { opacity: 1; transform: scale(1) rotate(0deg); filter: drop-shadow(0 0 4px #39ff14) drop-shadow(0 0 8px #39ff1480); }
          25% { opacity: 0.4; transform: scale(0.7) rotate(15deg); filter: drop-shadow(0 0 2px #39ff1440); }
          50% { opacity: 1; transform: scale(1.2) rotate(0deg); filter: drop-shadow(0 0 8px #39ff14) drop-shadow(0 0 16px #39ff1480); }
          75% { opacity: 0.6; transform: scale(0.85) rotate(-10deg); filter: drop-shadow(0 0 3px #39ff1460); }
        }
        @keyframes incomingGamePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(57,255,20,0.4), inset 0 0 0 0 rgba(57,255,20,0); }
          50% { box-shadow: 0 0 20px 4px rgba(57,255,20,0.15), inset 0 0 30px rgba(57,255,20,0.03); }
        }
      `}</style>
      <div style={{ position: "relative" }}>
        <div style={{
          position: "absolute", inset: -2, borderRadius: 0,
          background: `linear-gradient(90deg, transparent 5%, ${NEON}90, ${NEON}, ${NEON}90, transparent 95%)`,
          backgroundSize: "300% 100%",
          animation: "borderTravel-531 8s linear infinite",
          opacity: 0.7,
        }} />
        <div style={{
          position: "relative",
          background: "linear-gradient(180deg, #08080f 0%, #0C0C16 40%, #10101f 100%)",
          overflow: "hidden",
          padding: "12px 24px 14px",
          margin: "2px 2px 2px",
        }}>
          <div style={{
            position: "absolute", inset: 0, opacity: 0.04,
            backgroundImage: `radial-gradient(circle, ${NEON} 1px, transparent 1px)`,
            backgroundSize: "24px 24px", backgroundPosition: "12px 12px",
            pointerEvents: "none",
          }} />
          <div style={{
            position: "absolute", bottom: -60, left: "50%", transform: "translateX(-50%)",
            width: "110%", height: 160,
            background: `radial-gradient(ellipse, rgba(${NEON_RGB},0.12) 0%, transparent 65%)`,
            filter: "blur(30px)", pointerEvents: "none",
          }} />
          <div style={{
            position: "absolute", top: -30, right: -30,
            width: 160, height: 160,
            background: "radial-gradient(circle, rgba(0,212,255,0.06) 0%, transparent 70%)",
            filter: "blur(40px)", pointerEvents: "none",
          }} />
          <div style={{
            position: "absolute", top: "50%", left: 0, right: 0, height: 1,
            background: `linear-gradient(90deg, transparent, rgba(${NEON_RGB},0.06), transparent)`,
            pointerEvents: "none",
          }} />

          <div style={{ position: "relative", zIndex: 2 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button onClick={onBack} style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 36, height: 36, borderRadius: 4,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.03)",
                  cursor: "pointer", transition: "all 0.3s",
                  backdropFilter: "blur(8px)",
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 18l-6-6 6-6"/>
                  </svg>
                </button>
                <div style={{ animation: "logoGlow-531 5s ease-in-out infinite" }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 6,
                    border: `2px solid ${NEON}`, display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "'Clash Display', 'DM Sans', sans-serif",
                    fontSize: 16, fontWeight: 600, color: NEON,
                    background: `rgba(${NEON_RGB}, 0.06)`,
                    textShadow: `0 0 12px ${NEON}`,
                    boxShadow: `0 0 20px rgba(${NEON_RGB}, 0.15), inset 0 0 12px rgba(${NEON_RGB}, 0.05)`,
                  }}>LG</div>
                </div>
              </div>

              <div style={{
                position: "absolute", left: "50%", transform: "translateX(-50%)",
                fontFamily: "'Clash Display', 'DM Sans', sans-serif",
                fontSize: 16, fontWeight: 600, letterSpacing: "0.3em", color: NEON,
                animation: "neonFlicker-531 12s ease-in-out infinite",
                textShadow: `0 0 20px rgba(${NEON_RGB}, 0.5), 0 0 40px rgba(${NEON_RGB}, 0.2)`,
                whiteSpace: "nowrap",
              }}>
                {title}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <NotificationBell />
                {rightAction || <div style={{ width: 42 }} />}
              </div>
            </div>
            {subtitle && (
              <div style={{
                textAlign: "center", marginTop: 6, fontSize: 11, color: COLORS.textSecondary,
                fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.05em",
              }}>{subtitle}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step indicator (5 → 3 → 1) ───
function StepIndicator({ currentStep, isPlayer2 }: { currentStep: number; isPlayer2: boolean }) {
  const steps = isPlayer2
    ? [{ n: "3", label: "PICK 3", tourId: "" }, { n: "✓", label: "DONE", tourId: "" }]
    : [{ n: "⚙", label: "SETUP", tourId: "" }, { n: "5", label: "PICK 5", tourId: "531-step-pick5" }, { n: "⏳", label: "WAIT", tourId: "531-step-wait" }, { n: "1", label: "PICK 1", tourId: "531-step-pick1" }, { n: "🎉", label: "RESULT", tourId: "531-step-result" }];

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center", gap: 0,
      padding: "16px 20px 8px",
    }}>
      {steps.map((s, i) => {
        const isActive = i === currentStep;
        const isDone = i < currentStep;
        const color = isActive ? NEON : isDone ? COLORS.neonGreen : COLORS.cardBorder;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center" }}>
            <div data-tour={s.tourId || undefined} style={{
              width: 36, height: 36, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: isActive ? `rgba(${NEON_RGB}, 0.15)` : isDone ? `${COLORS.neonGreen}15` : `${COLORS.cardBorder}20`,
              border: `2px solid ${color}`,
              boxShadow: isActive ? `0 0 16px rgba(${NEON_RGB}, 0.3)` : isDone ? `0 0 10px ${COLORS.neonGreen}30` : "none",
              transition: "all 0.4s ease",
            }}>
              <span style={{
                fontSize: 13, fontWeight: 800, color,
                fontFamily: "'DM Sans', sans-serif",
              }}>{isDone ? "✓" : s.n}</span>
            </div>
            <div style={{
              position: "absolute", marginTop: 52, marginLeft: -2,
              fontSize: 8, fontWeight: 700, letterSpacing: "0.1em",
              color: isActive ? NEON : isDone ? COLORS.neonGreen : COLORS.textSecondary,
              fontFamily: "'DM Sans', sans-serif", textAlign: "center", width: 40,
            }}>{s.label}</div>
            {i < steps.length - 1 && (
              <div style={{
                width: 32, height: 2, borderRadius: 1,
                background: isDone ? COLORS.neonGreen : `${COLORS.cardBorder}60`,
                margin: "0 4px",
                boxShadow: isDone ? `0 0 6px ${COLORS.neonGreen}40` : "none",
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Business mini card (for selection grids) ───
function CardImageCarousel({ images, gradient, emoji, height }: { images: { url: string; focalX: number; focalY: number }[]; gradient: string; emoji: string; height: number }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [imgIdx, setImgIdx] = useState(0);
  const hasImages = images.length > 0;

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setImgIdx(idx);
  };

  if (!hasImages) {
    return (
      <div style={{
        width: "100%", height, background: gradient,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: "-20%", right: "-15%", width: "60%", height: "60%", borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
        <div style={{ position: "absolute", bottom: "-25%", left: "-10%", width: "50%", height: "50%", borderRadius: "50%", background: "rgba(255,255,255,0.03)" }} />
        <span style={{ fontSize: 44, filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.3))", zIndex: 1 }}>{emoji}</span>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: "100%", height, overflow: "hidden", background: gradient }}>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          display: "flex", width: "100%", height: "100%",
          overflowX: "auto", scrollSnapType: "x mandatory",
          scrollbarWidth: "none",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {images.map((img, i) => (
          <div key={i} style={{
            flex: "0 0 100%", width: "100%", height: "100%", scrollSnapAlign: "start",
          }}>
            <img
              src={img.url} alt=""
              style={{
                width: "100%", height: "100%", objectFit: "contain",
              }}
            />
          </div>
        ))}
      </div>
      {/* Dot indicators */}
      {images.length > 1 && (
        <div style={{
          position: "absolute", bottom: 6, left: 0, right: 0,
          display: "flex", justifyContent: "center", gap: 4, zIndex: 5,
        }}>
          {images.map((_, i) => (
            <span key={i} style={{
              width: imgIdx === i ? 12 : 5, height: 5, borderRadius: 3,
              background: imgIdx === i ? "#fff" : "rgba(255,255,255,0.45)",
              transition: "all 0.25s ease",
              boxShadow: imgIdx === i ? "0 0 4px rgba(255,255,255,0.6)" : "none",
            }} />
          ))}
        </div>
      )}
      <style>{`div::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
}

function BusinessMiniCard({ biz, selected, onSelect, disabled, number, distanceMi }: { biz: DiscoveryBusiness; selected: boolean; onSelect: (id: string) => void; disabled: boolean; number: number | null; distanceMi: number | null }) {
  return (
    <button
      onClick={() => !disabled && onSelect(biz.id)}
      disabled={disabled}
      style={{
        position: "relative", width: "100%", borderRadius: 16, overflow: "hidden",
        border: selected ? `2px solid ${NEON}` : `1px solid ${COLORS.cardBorder}`,
        background: COLORS.cardBg, cursor: disabled ? "default" : "pointer",
        transition: "all 0.3s ease", textAlign: "left", padding: 0,
        boxShadow: selected ? `0 0 20px rgba(${NEON_RGB}, 0.2), inset 0 0 30px rgba(${NEON_RGB}, 0.05)` : "none",
        opacity: disabled && !selected ? 0.4 : 1,
        transform: selected ? "scale(1.02)" : "scale(1)",
      }}
    >
      <div style={{ position: "relative", overflow: "hidden" }}>
        <CardImageCarousel
          images={biz.images}
          gradient={getBusinessGradient(biz.id)}
          emoji={getBusinessEmoji(biz.type)}
          height={140}
        />

        {selected && number && (
          <div style={{
            position: "absolute", top: 8, right: 8, zIndex: 10,
            width: 28, height: 28, borderRadius: "50%",
            background: NEON, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 800, color: "#fff",
            fontFamily: "'DM Sans', sans-serif",
            boxShadow: `0 0 12px ${NEON}`,
          }}>{number}</div>
        )}

        <div style={{
          position: "absolute", top: 8, left: 8, display: "flex", alignItems: "center", gap: 4,
          padding: "3px 8px", borderRadius: 50, zIndex: 10,
          background: biz.isOpen ? "rgba(57,255,20,0.15)" : "rgba(255,45,146,0.15)",
          border: `1px solid ${biz.isOpen ? COLORS.neonGreen : COLORS.neonPink}40`,
          backdropFilter: "blur(8px)",
        }}>
          <span style={{
            width: 5, height: 5, borderRadius: "50%",
            background: biz.isOpen ? COLORS.neonGreen : COLORS.neonPink,
            boxShadow: `0 0 4px ${biz.isOpen ? COLORS.neonGreen : COLORS.neonPink}`,
          }} />
          <span style={{ fontSize: 9, fontWeight: 700, color: biz.isOpen ? COLORS.neonGreen : COLORS.neonPink, fontFamily: "'DM Sans', sans-serif" }}>
            {biz.isOpen ? "Open" : "Closed"}
          </span>
        </div>

        {selected && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 10,
            background: `rgba(${NEON_RGB}, 0.1)`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: "50%",
              background: `rgba(${NEON_RGB}, 0.3)`, backdropFilter: "blur(4px)",
              display: "flex", alignItems: "center", justifyContent: "center",
              border: `2px solid ${NEON}`,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={NEON} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: "12px 14px" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", fontFamily: "'DM Sans', sans-serif", marginBottom: 3, lineHeight: 1.2 }}>{biz.name}</div>
        <div style={{ fontSize: 11, color: COLORS.textSecondary, fontFamily: "'DM Sans', sans-serif", marginBottom: 8 }}>{biz.type}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.neonYellow, fontFamily: "'DM Sans', sans-serif" }}>{biz.price}</span>
          <span style={{ fontSize: 11, color: COLORS.textSecondary }}>·</span>
          <span style={{ fontSize: 11, color: COLORS.neonGreen, fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>{biz.payout[0]}&ndash;{biz.payout[6]}%</span>
        </div>
        {distanceMi !== null && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill={COLORS.neonBlue} stroke="none">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
            <span style={{ fontSize: 10, fontWeight: 600, color: COLORS.neonBlue, fontFamily: "'DM Sans', sans-serif" }}>
              {distanceMi < 0.1 ? "<0.1" : distanceMi.toFixed(1)} mi
            </span>
          </div>
        )}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 8 }}>
          {biz.tags.slice(0, 3).map((t: string) => (
            <span key={t} style={{
              padding: "2px 8px", borderRadius: 50, fontSize: 9, fontWeight: 600,
              background: `${COLORS.neonBlue}10`, border: `1px solid ${COLORS.neonBlue}20`,
              color: COLORS.neonBlue, fontFamily: "'DM Sans', sans-serif",
            }}>{t}</span>
          ))}
        </div>
      </div>
    </button>
  );
}

// ─── Neon action button ───
function NeonButton({ children, onClick, disabled, color = NEON, size = "normal", style: extraStyle }: { children: ReactNode; onClick?: () => void; disabled?: boolean; color?: string; size?: "small" | "normal" | "large"; style?: CSSProperties }) {
  const padY = size === "large" ? "16px" : size === "small" ? "10px" : "12px";
  const padX = size === "large" ? "40px" : size === "small" ? "20px" : "28px";
  const fs = size === "large" ? 16 : size === "small" ? 12 : 14;
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: `${padY} ${padX}`, borderRadius: 50,
      border: `2px solid ${disabled ? COLORS.cardBorder : color}`,
      background: disabled ? `${COLORS.cardBorder}20` : `${color}18`,
      color: disabled ? COLORS.textSecondary : color,
      fontSize: fs, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer",
      fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.05em",
      transition: "all 0.3s ease",
      boxShadow: disabled ? "none" : `0 0 20px ${color}25, 0 0 40px ${color}10`,
      textShadow: disabled ? "none" : `0 0 10px ${color}50`,
      ...extraStyle,
    }}>
      {children}
    </button>
  );
}


// ═══════════════════════════════════════════════════
// STEP 0: SETUP — Category, Filters, Friend
// ═══════════════════════════════════════════════════
function SetupStep({ filters, setFilters, selectedFriend, setSelectedFriend, onNext, activeGames, onRejoin, onCancel, locationZip, setLocationZip }: {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  selectedFriend: GameFriend | null;
  setSelectedFriend: (f: GameFriend) => void;
  onNext: () => void;
  activeGames: { id: string; game_code: string; opponentName: string | null; status: string; created_at: string; role: "p1" | "p2" }[];
  onRejoin: (gameCode: string) => void;
  locationZip: string;
  setLocationZip: (zip: string) => void;
  onCancel: (gameId: string) => void;
}) {
  const setupRouter = useRouter();
  const [activeSection, setActiveSection] = useState("category");
  const [friendSearch, setFriendSearch] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // DB-driven tag categories
  const [tagCats, setTagCats] = useState<TagCategory[]>([]);
  useEffect(() => { fetchTagsByCategory("business").then(setTagCats).catch(() => {}); }, []);
  const CATEGORIES = useMemo(() => {
    const bt = tagCats.find(c => c.name === "Business Type");
    if (!bt || bt.tags.length === 0) return DEFAULT_CATEGORIES;
    const mapped: CategoryOption[] = bt.tags.map(t => ({ id: t.slug, label: t.name, emoji: t.icon || "🏢" }));
    mapped.push({ id: "anything", label: "Surprise Me!", emoji: "🎲" });
    return mapped;
  }, [tagCats]);
  const FILTER_CATEGORIES = useMemo(() => {
    const bt = tagCats.find(c => c.name === "Business Type");
    return bt && bt.tags.length > 0 ? ["All", ...bt.tags.map(t => t.name)] : DEFAULT_FILTER_CATEGORIES;
  }, [tagCats]);
  // Smart visibility: hide food-related categories when non-food category selected in step 1
  const showFoodCategories = useMemo(() => {
    if (selectedCategories.length === 0 || selectedCategories.includes("anything")) return true;
    const bt = tagCats.find(c => c.name === "Business Type");
    if (!bt) {
      // DB not loaded yet — use hardcoded food-type list as fallback
      const FOOD_IDS = new Set(["restaurant", "bar", "coffee", "bakery", "deli", "ice-cream", "juice-bar",
        "lounge", "pub", "sports-bar", "food-truck", "brewery", "winery"]);
      return selectedCategories.some(id => FOOD_IDS.has(id));
    }
    // Check if any selected step-1 category is food-related
    return selectedCategories.some(catId => {
      const tag = bt.tags.find(t => t.slug === catId || t.name.toLowerCase().replace(/[/ ]/g, "_") === catId);
      return tag?.is_food ?? false;
    });
  }, [selectedCategories, tagCats]);
  const [editingZip, setEditingZip] = useState(false);
  const [zipInput, setZipInput] = useState("");
  const [locationName, setLocationName] = useState("");
  const [locationState, setLocationState] = useState("");
  const zipRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [friends, setFriends] = useState<GameFriend[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [gameHistory, setGameHistory] = useState<{ id: string; opponentName: string; businessName: string; businessId: string; completedAt: string }[]>([]);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [historyBizDetails, setHistoryBizDetails] = useState<Record<string, DiscoveryBusiness>>({});

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabaseBrowser.auth.getSession();
        if (!session?.access_token) { setFriendsLoading(false); return; }
        const token = session.access_token;
        const userId = session.user?.id;

        // Fetch friends
        const res = await fetch("/api/friends", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setFriends(data.friends ?? []);
        }

        // Fetch completed game history
        const gRes = await fetch("/api/games?status=complete", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (gRes.ok) {
          const { games } = await gRes.json();
          setGameHistory(
            (games ?? []).map((g: Record<string, unknown>) => ({
              id: g.id as string,
              opponentName: (g.player1_id === userId ? g.player2Name : g.player1Name) as string ?? "Unknown",
              businessName: (g.winnerBusinessName as string) ?? "Unknown",
              businessId: (g.winner_business_id as string) ?? "",
              completedAt: g.completed_at as string,
            }))
          );
        }
      } catch { /* ignore */ }
      setFriendsLoading(false);
    })();
  }, []);

  // Derive city/state when locationZip changes (e.g. from profile fetch)
  const ZIP_LOOKUP: Record<string, [string, string]> = {
    "68102": ["Omaha", "NE"], "68131": ["Omaha", "NE"], "68124": ["Omaha", "NE"], "68114": ["Omaha", "NE"], "68106": ["Omaha", "NE"],
    "68154": ["West Omaha", "NE"], "68022": ["Elkhorn", "NE"], "68046": ["Papillion", "NE"], "68116": ["Bennington", "NE"],
    "68005": ["Bellevue", "NE"], "68123": ["Bellevue", "NE"], "68128": ["La Vista", "NE"], "68007": ["Bennington", "NE"],
    "68127": ["Ralston", "NE"], "68104": ["North Omaha", "NE"], "68132": ["Midtown", "NE"], "68105": ["South Omaha", "NE"],
    "68137": ["Millard", "NE"], "68144": ["West Omaha", "NE"], "68164": ["Maple", "NE"],
    "10001": ["New York", "NY"], "10002": ["New York", "NY"], "90001": ["Los Angeles", "CA"], "90210": ["Beverly Hills", "CA"],
    "60601": ["Chicago", "IL"], "77001": ["Houston", "TX"], "85001": ["Phoenix", "AZ"], "19101": ["Philadelphia", "PA"],
    "78201": ["San Antonio", "TX"], "92101": ["San Diego", "CA"], "75201": ["Dallas", "TX"], "95101": ["San Jose", "CA"],
    "32099": ["Jacksonville", "FL"], "46201": ["Indianapolis", "IN"], "94102": ["San Francisco", "CA"], "43085": ["Columbus", "OH"],
    "28201": ["Charlotte", "NC"], "76101": ["Fort Worth", "TX"], "48201": ["Detroit", "MI"], "79901": ["El Paso", "TX"],
    "38101": ["Memphis", "TN"], "37201": ["Nashville", "TN"], "21201": ["Baltimore", "MD"], "53201": ["Milwaukee", "WI"],
    "87101": ["Albuquerque", "NM"], "85701": ["Tucson", "AZ"], "89101": ["Las Vegas", "NV"], "64101": ["Kansas City", "MO"],
    "30301": ["Atlanta", "GA"], "80201": ["Denver", "CO"], "97201": ["Portland", "OR"], "73101": ["Oklahoma City", "OK"],
    "55401": ["Minneapolis", "MN"], "33101": ["Miami", "FL"], "70112": ["New Orleans", "LA"], "96801": ["Honolulu", "HI"],
    "63101": ["St. Louis", "MO"], "15201": ["Pittsburgh", "PA"], "45201": ["Cincinnati", "OH"], "44101": ["Cleveland", "OH"],
  };

  useEffect(() => {
    if (locationZip && /^\d{5}$/.test(locationZip)) {
      const match = ZIP_LOOKUP[locationZip];
      setLocationName(match ? match[0] : `ZIP ${locationZip}`);
      setLocationState(match ? match[1] : "");
    }
  }, [locationZip]);

  const handleZipSubmit = () => {
    const zip = zipInput.trim();
    if (zip.length === 5 && /^\d{5}$/.test(zip)) {
      const match = ZIP_LOOKUP[zip];
      setLocationName(match ? match[0] : `ZIP ${zip}`);
      setLocationState(match ? match[1] : "");
      setLocationZip(zip);
    }
    setEditingZip(false);
    setZipInput("");
  };

  const filteredFriends = friends.filter((f: GameFriend) =>
    f.name.toLowerCase().includes(friendSearch.toLowerCase()) ||
    (f.username ?? "").toLowerCase().includes(friendSearch.toLowerCase())
  );

  const switchSection = (sec: string) => {
    setActiveSection(sec);
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const canProceed = selectedCategories.length > 0 && selectedFriend && /^\d{5}$/.test(locationZip);

  return (
    <div ref={contentRef} style={{
      flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden",
      padding: "0 0 100px", scrollbarWidth: "thin",
      scrollbarColor: `${NEON}40 transparent`,
    }}>
      {/* Active games banner */}
      {activeGames.length > 0 && (
        <div style={{ margin: "12px 20px 0", display: "flex", flexDirection: "column", gap: 8 }}>
          {activeGames.map(g => {
            const isIncoming = g.role === "p2";
            return (
            <div key={g.id} style={{ position: "relative" }}>
              {/* Blinking star for incoming games */}
              {isIncoming && (
                <span style={{
                  position: "absolute", top: -6, right: -6,
                  fontSize: 18, lineHeight: 1,
                  animation: "starBlink 1.5s ease-in-out infinite",
                  zIndex: 2, pointerEvents: "none",
                }}>
                  ⭐
                </span>
              )}
              <div style={{
                width: "100%", padding: "14px 16px", borderRadius: 12,
                background: isIncoming
                  ? `linear-gradient(135deg, ${COLORS.neonGreen}12, ${COLORS.neonBlue}08)`
                  : `linear-gradient(135deg, ${COLORS.neonPurple}15, ${COLORS.neonBlue}10)`,
                border: `1.5px solid ${isIncoming ? COLORS.neonGreen : COLORS.neonPurple}40`,
                fontFamily: "'DM Sans', sans-serif",
                animation: isIncoming ? "incomingGamePulse 2s ease-in-out infinite" : "none",
                display: "flex", alignItems: "center", gap: 10,
              }}>
                {/* Main clickable area — rejoin */}
                <button
                  onClick={() => onRejoin(g.game_code)}
                  style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between",
                    background: "none", border: "none", cursor: "pointer", padding: 0,
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: isIncoming ? COLORS.neonGreen : COLORS.neonPurple }}>
                      {isIncoming ? `${g.opponentName ?? "A friend"} sent you a game!` : `Game in progress — ${g.game_code}`}
                    </span>
                    <span style={{ fontSize: 10, color: COLORS.textSecondary }}>
                      {isIncoming
                        ? "Tap to pick your 3!"
                        : g.opponentName ? `Waiting on ${g.opponentName}` : "Waiting for opponent to join"}
                      {" · "}
                      {new Date(g.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    color: isIncoming ? COLORS.neonGreen : COLORS.neonBlue,
                    padding: "6px 14px", borderRadius: 50,
                    border: `1px solid ${isIncoming ? COLORS.neonGreen : COLORS.neonBlue}40`,
                    background: isIncoming ? `${COLORS.neonGreen}18` : `${COLORS.neonBlue}10`,
                    animation: isIncoming ? "starBlink 1.5s ease-in-out infinite" : "none",
                  }}>
                    {isIncoming ? "▶ PLAY" : "REJOIN"}
                  </span>
                </button>
                {/* Cancel button */}
                <button
                  onClick={(e) => { e.stopPropagation(); onCancel(g.id); }}
                  title="Cancel game"
                  style={{
                    width: 28, height: 28, borderRadius: 50,
                    border: `1px solid ${COLORS.neonPurple}30`,
                    background: "rgba(255,49,49,0.08)",
                    color: "#ff3131", fontSize: 14, fontWeight: 700,
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, padding: 0,
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
            );
          })}
        </div>
      )}

      <div style={{
        display: "flex", gap: 0, margin: "16px 20px 0",
        borderRadius: 12, overflow: "hidden",
        border: `1px solid ${COLORS.cardBorder}`,
      }}>
        {(["history", "category", "filters", "friend"] as const).map((sec, i) => (
          <button key={sec} data-tour={`531-tab-${sec}`} onClick={() => switchSection(sec)} style={{
            flex: 1, padding: "12px 0", border: "none",
            background: activeSection === sec ? `rgba(${NEON_RGB}, 0.12)` : "transparent",
            color: activeSection === sec ? NEON : COLORS.textSecondary,
            fontSize: 11, fontWeight: 700, cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase",
            letterSpacing: "0.05em",
            borderRight: i < 3 ? `1px solid ${COLORS.cardBorder}` : "none",
            transition: "all 0.3s",
          }}>
            {sec === "history" && `📋 History`}
            {sec === "category" && `🎯 Category ${selectedCategories.length > 0 ? "✓" : ""}`}
            {sec === "filters" && "⚙ Filters"}
            {sec === "friend" && `👤 Friend ${selectedFriend ? "✓" : ""}`}
          </button>
        ))}
      </div>

      {/* HISTORY SECTION */}
      {activeSection === "history" && (
        <div style={{ padding: "20px 20px 0" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>Past Games</div>
          <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 16, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5 }}>
            Your recent 5v3v1 results.
          </div>
          {gameHistory.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {gameHistory.slice(0, 10).map(g => {
                const isExpanded = expandedHistoryId === g.id;
                const biz = historyBizDetails[g.businessId];
                return (
                  <div key={g.id}>
                    <div onClick={async () => {
                      if (isExpanded) { setExpandedHistoryId(null); return; }
                      setExpandedHistoryId(g.id);
                      if (!historyBizDetails[g.businessId] && g.businessId) {
                        const { data: row } = await supabaseBrowser.from("business").select("id, is_active, business_name, public_business_name, contact_phone, website, street_address, city, state, zip, category_main, config, blurb, payout_tiers, payout_preset, mon_open, mon_close, tue_open, tue_close, wed_open, wed_close, thu_open, thu_close, fri_open, fri_close, sat_open, sat_close, sun_open, sun_close").eq("id", g.businessId).maybeSingle();
                        if (row) {
                          const { data: media } = await supabaseBrowser.from("business_media").select("business_id, bucket, path, sort_order, caption, meta").eq("business_id", g.businessId).eq("is_active", true).eq("media_type", "photo").order("sort_order", { ascending: true }).limit(5);
                          const { data: tiers } = await supabaseBrowser.from("business_payout_tiers").select("percent_bps").eq("business_id", g.businessId).order("tier_index", { ascending: true });
                          const tableBps = (tiers ?? []).map((t: Record<string, unknown>) => (t.percent_bps as number) || 0);
                          const normalized = normalizeToDiscoveryBusiness(row as unknown as BusinessRow, (media ?? []) as unknown as MediaRow[], tableBps.length >= 7 ? tableBps : undefined);
                          setHistoryBizDetails(prev => ({ ...prev, [g.businessId]: normalized }));
                        }
                      }
                    }} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "12px 14px", borderRadius: isExpanded ? "12px 12px 0 0" : 12,
                      background: isExpanded ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${isExpanded ? COLORS.neonGreen + "30" : COLORS.cardBorder}`,
                      borderBottom: isExpanded ? "none" : undefined,
                      cursor: "pointer", transition: "all 0.2s ease",
                    }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.85)", fontFamily: "'DM Sans', sans-serif" }}>
                          {g.businessName}
                        </span>
                        <span style={{ fontSize: 10, color: COLORS.textSecondary, fontFamily: "'DM Sans', sans-serif" }}>
                          vs {g.opponentName}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 10, color: COLORS.textSecondary, fontFamily: "'DM Sans', sans-serif" }}>
                          {g.completedAt ? new Date(g.completedAt).toLocaleDateString() : ""}
                        </span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ transition: "transform 0.2s ease", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>
                          <path d="M6 9l6 6 6-6" stroke={COLORS.textSecondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    </div>
                    {isExpanded && (
                      <div style={{
                        padding: "14px", borderRadius: "0 0 12px 12px",
                        background: "rgba(255,255,255,0.03)",
                        border: `1px solid ${COLORS.neonGreen}30`, borderTop: "none",
                      }}>
                        {biz ? (
                          <div>
                            <div style={{ width: "100%", height: 180, borderRadius: 8, overflow: "hidden", marginBottom: 10 }}>
                              <CardImageCarousel images={biz.images} gradient={getBusinessGradient(biz.id)} emoji={getBusinessEmoji(biz.type)} height={180} />
                            </div>
                            <div style={{ fontSize: 11, color: COLORS.textSecondary, fontFamily: "'DM Sans', sans-serif", marginBottom: 6 }}>{biz.type}</div>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                              <span style={{ padding: "3px 8px", borderRadius: 50, background: `${COLORS.neonYellow}10`, border: `1px solid ${COLORS.neonYellow}25`, fontSize: 10, fontWeight: 700, color: COLORS.neonYellow }}>{biz.price}</span>
                              <span style={{ padding: "3px 8px", borderRadius: 50, background: `${COLORS.neonGreen}10`, border: `1px solid ${COLORS.neonGreen}25`, fontSize: 10, fontWeight: 600, color: COLORS.neonGreen }}>{biz.payout[0]}–{biz.payout[6]}%</span>
                              <span style={{ display: "flex", alignItems: "center", gap: 3, padding: "3px 8px", borderRadius: 50, background: biz.isOpen ? `${COLORS.neonGreen}10` : `${NEON}10`, border: `1px solid ${biz.isOpen ? COLORS.neonGreen : NEON}25` }}>
                                <span style={{ width: 5, height: 5, borderRadius: "50%", background: biz.isOpen ? COLORS.neonGreen : NEON }} />
                                <span style={{ fontSize: 9, fontWeight: 700, color: biz.isOpen ? COLORS.neonGreen : NEON }}>{biz.isOpen ? "Open" : "Closed"}</span>
                              </span>
                            </div>
                            {biz.address && (
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                                <span style={{ fontSize: 12 }}>📍</span>
                                <span style={{ fontSize: 11, color: COLORS.textSecondary, fontFamily: "'DM Sans', sans-serif" }}>{biz.address}</span>
                              </div>
                            )}
                            {biz.phone && (
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                                <span style={{ fontSize: 12 }}>📞</span>
                                <span style={{ fontSize: 11, color: COLORS.textSecondary, fontFamily: "'DM Sans', sans-serif" }}>{biz.phone}</span>
                              </div>
                            )}
                            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                              <NeonButton color={COLORS.neonGreen} size="small" style={{ flex: 1 }} onClick={() => {
                                if (biz.address) window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(biz.address)}`, "_blank");
                              }}>📍 Directions</NeonButton>
                              {biz.phone && (
                                <NeonButton color={COLORS.neonBlue} size="small" style={{ flex: 1 }} onClick={() => window.open(`tel:${biz.phone}`, "_self")}>📞 Call</NeonButton>
                              )}
                            </div>
                            <div style={{ marginTop: 6 }}>
                              <NeonButton color={COLORS.neonPink} size="small" style={{ width: "100%" }} onClick={() => {
                                setupRouter.push(`/swipe?spotlight=${g.businessId}`);
                              }}>🔍 View on Discovery</NeonButton>
                            </div>
                          </div>
                        ) : (
                          <div style={{ textAlign: "center", padding: "12px 0", fontSize: 11, color: COLORS.textSecondary }}>Loading details...</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <div style={{ fontSize: 13, color: COLORS.textSecondary, fontFamily: "'DM Sans', sans-serif" }}>No games yet. Start a new game below!</div>
            </div>
          )}
        </div>
      )}

      {/* CATEGORY SECTION */}
      {activeSection === "category" && (
        <div style={{ padding: "20px 20px 0" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>What are we deciding?</div>
          <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 16, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5 }}>
            Pick one or more categories to narrow down the options for your game.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {CATEGORIES.map(cat => {
              const isAnything = cat.id === "anything";
              const isActive = isAnything ? selectedCategories.includes("anything") : selectedCategories.includes(cat.id);
              return (
                <button key={cat.id} onClick={() => {
                  if (isAnything) { setSelectedCategories(["anything"]); return; }
                  setSelectedCategories(prev => {
                    const filtered = prev.filter(c => c !== "anything");
                    const next = filtered.includes(cat.id) ? filtered.filter(c => c !== cat.id) : [...filtered, cat.id];
                    return next;
                  });
                }} style={{
                  padding: "20px 12px", borderRadius: 16, border: `1px solid ${isActive ? NEON : COLORS.cardBorder}`,
                  background: isActive ? `rgba(${NEON_RGB}, 0.1)` : COLORS.cardBg,
                  cursor: "pointer", transition: "all 0.3s", textAlign: "center",
                  boxShadow: isActive ? `0 0 20px rgba(${NEON_RGB}, 0.15)` : "none",
                }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>{cat.emoji}</div>
                  <div style={{
                    fontSize: 11, fontWeight: 700, color: isActive ? NEON : COLORS.textSecondary,
                    fontFamily: "'DM Sans', sans-serif",
                  }}>{cat.label}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* FILTERS SECTION */}
      {activeSection === "filters" && (
        <div style={{ padding: "20px 20px 0" }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10, fontFamily: "'DM Sans', sans-serif" }}>Location</div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              {editingZip ? (
                <div style={{
                  display: "flex", alignItems: "center", gap: 0, flexShrink: 0,
                  borderRadius: 50, border: `1.5px solid ${NEON}60`,
                  background: `${NEON}12`, overflow: "hidden",
                  boxShadow: `0 0 16px ${NEON}20`,
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill={NEON} stroke="none" style={{ marginLeft: 14, flexShrink: 0 }}>
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
                      width: 90, padding: "12px 14px", border: "none", outline: "none",
                      background: "transparent", color: NEON,
                      fontSize: 18, fontWeight: 700, fontFamily: "'Clash Display', 'DM Sans', sans-serif",
                      letterSpacing: "0.08em",
                    }}
                  />
                </div>
              ) : (
                <button onClick={() => { setEditingZip(true); setZipInput(""); }} style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "12px 20px",
                  borderRadius: 50, border: `1.5px solid ${NEON}50`,
                  background: `${NEON}12`, color: NEON,
                  fontSize: 18, fontWeight: 700, cursor: "pointer",
                  fontFamily: "'Clash Display', 'DM Sans', sans-serif", flexShrink: 0,
                  transition: "all 0.3s", boxShadow: `0 0 16px ${NEON}20`,
                  letterSpacing: "0.08em", textShadow: `0 0 10px ${NEON}40`,
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill={NEON} stroke="none">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                  </svg>
                  {locationZip}
                </button>
              )}
              <div style={{
                display: "flex", alignItems: "center", gap: 5, padding: "10px 16px",
                borderRadius: 50, border: `1px solid ${COLORS.cardBorder}`,
                background: "rgba(255,255,255,0.03)", flexShrink: 0,
              }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#fff", fontFamily: "'DM Sans', sans-serif" }}>
                  {locationName}{locationState ? "," : ""}
                </span>
                {locationState && (
                  <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Sans', sans-serif" }}>
                    {locationState}
                  </span>
                )}
              </div>
              <button onClick={() => { setLocationName("Omaha"); setLocationState("NE"); setLocationZip("68102"); }} style={{
                display: "flex", alignItems: "center", gap: 6, padding: "10px 16px",
                borderRadius: 50, border: `1px solid ${COLORS.neonBlue}30`,
                background: `${COLORS.neonBlue}08`,
                color: COLORS.neonBlue, fontSize: 12, fontWeight: 600, cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif", transition: "all 0.3s",
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={COLORS.neonBlue} strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4m10-10h-4M6 12H2"/>
                </svg>
                Use My Location
              </button>
            </div>
          </div>

          {/* Category removed — already selected in step 1 */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10, fontFamily: "'DM Sans', sans-serif" }}>Price</div>
            <div style={{ display: "flex", gap: 8 }}>
              {PRICE_FILTERS.map(p => (
                <GlassPill key={p} active={filters.price === p} onClick={() => setFilters(prev => ({ ...prev, price: p }))} title={PRICE_TOOLTIPS[p]}>{p}</GlassPill>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 1.5, fontFamily: "'DM Sans', sans-serif" }}>Distance</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.neonBlue, fontFamily: "'DM Sans', sans-serif" }}>{filters.distance} mi</span>
            </div>
            <input type="range" min={1} max={50} value={filters.distance} onChange={e => setFilters(p => ({ ...p, distance: +e.target.value }))}
              style={{ width: "100%", accentColor: COLORS.neonBlue, height: 4 }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <button onClick={() => setFilters(p => ({ ...p, openNow: !p.openNow }))} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 50,
              border: `1px solid ${filters.openNow ? COLORS.neonGreen : COLORS.cardBorder}`,
              background: filters.openNow ? `${COLORS.neonGreen}15` : COLORS.glass,
              color: filters.openNow ? COLORS.neonGreen : COLORS.textSecondary,
              fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
              backdropFilter: "blur(12px)", transition: "all 0.3s",
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: "50%",
                background: filters.openNow ? COLORS.neonGreen : COLORS.textSecondary,
                boxShadow: filters.openNow ? `0 0 8px ${COLORS.neonGreen}` : "none",
              }} />
              Open Now Only
            </button>
          </div>
          {/* Dynamic tag filter sections from DB (excludes Business Type) */}
          {tagCats
            .filter(c => c.name !== "Business Type" && c.scope.includes("business"))
            .filter(c => !c.requires_food || showFoodCategories)
            .map(c => {
              const catTags = c.tags.map(t => t.name);
              return (
                <div key={c.id} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10, fontFamily: "'DM Sans', sans-serif" }}>{c.icon} {c.name}</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <GlassPill active={!filters.tags.some(t => catTags.includes(t))} onClick={() => setFilters(p => ({
                      ...p, tags: p.tags.filter(t => !catTags.includes(t)),
                    }))} style={{ fontSize: 12, padding: "6px 14px" }}>All</GlassPill>
                    {catTags.map(t => (
                      <GlassPill key={t} active={filters.tags.includes(t)} onClick={() => setFilters(p => ({
                        ...p, tags: p.tags.includes(t) ? p.tags.filter(x => x !== t) : [...p.tags, t],
                      }))} style={{ fontSize: 12, padding: "6px 14px" }}>{t}</GlassPill>
                    ))}
                  </div>
                </div>
              );
            })}
          {/* Fallback if DB hasn't loaded */}
          {tagCats.length === 0 && (
            <>
              {showFoodCategories && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10, fontFamily: "'DM Sans', sans-serif" }}>Cuisine</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {DEFAULT_CUISINE_FILTERS.map(t => (
                    <GlassPill key={t} active={filters.tags.includes(t)} onClick={() => setFilters(p => ({
                      ...p, tags: p.tags.includes(t) ? p.tags.filter(x => x !== t) : [...p.tags, t],
                    }))} style={{ fontSize: 12, padding: "6px 14px" }}>{t}</GlassPill>
                  ))}
                </div>
              </div>
              )}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10, fontFamily: "'DM Sans', sans-serif" }}>Vibe & Atmosphere</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {DEFAULT_VIBE_FILTERS.map(t => (
                    <GlassPill key={t} active={filters.tags.includes(t)} onClick={() => setFilters(p => ({
                      ...p, tags: p.tags.includes(t) ? p.tags.filter(x => x !== t) : [...p.tags, t],
                    }))} style={{ fontSize: 12, padding: "6px 14px" }}>{t}</GlassPill>
                  ))}
                </div>
              </div>
            </>
          )}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10, fontFamily: "'DM Sans', sans-serif" }}>Browse From</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {["All Businesses", "My Saved"].map(opt => (
                <GlassPill key={opt} active={(filters.browseFrom || "All Businesses") === opt} onClick={() => setFilters(p => ({ ...p, browseFrom: opt }))} style={{ fontSize: 12, padding: "8px 16px" }}>
                  {opt === "All Businesses" && "🌐 "}{opt === "My Saved" && "❤️ "}{opt}
                </GlassPill>
              ))}
            </div>
            {filters.browseFrom === "My Saved" && (
              <div style={{ fontSize: 11, color: COLORS.neonOrange, fontFamily: "'DM Sans', sans-serif", marginTop: 8, lineHeight: 1.5 }}>
                Save places from your profile page to use this filter. All businesses will be shown until you have saved places.
              </div>
            )}
          </div>
        </div>
      )}

      {/* FRIEND SECTION */}
      {activeSection === "friend" && (
        <div style={{ padding: "20px 20px 0" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>Choose your opponent</div>
          <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 16, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5 }}>
            Pick a friend to play 5v3v1 with. They&apos;ll narrow your picks down to 3!
          </div>

          <div style={{ position: "relative", marginBottom: 16 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" strokeLinecap="round"
              style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", zIndex: 1 }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text" placeholder="Search friends..."
              value={friendSearch} onChange={e => setFriendSearch(e.target.value)}
              style={{
                width: "100%", padding: "12px 14px 12px 40px", borderRadius: 12,
                border: `1px solid ${COLORS.cardBorder}`, background: "rgba(255,255,255,0.03)",
                color: "#fff", fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {friendsLoading ? (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <div style={{ fontSize: 13, color: COLORS.textSecondary, fontFamily: "'DM Sans', sans-serif" }}>Loading friends...</div>
            </div>
          ) : friends.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <div style={{ fontSize: 13, color: COLORS.textSecondary, fontFamily: "'DM Sans', sans-serif" }}>No friends found. Add friends from your profile to play!</div>
            </div>
          ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filteredFriends.map(friend => {
              const isSelected = selectedFriend?.id === friend.id;
              const statusColor = friend.status === "online" ? COLORS.neonGreen : friend.status === "away" ? COLORS.neonYellow : COLORS.textSecondary;
              const initials = friend.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
              return (
                <button key={friend.id} onClick={() => setSelectedFriend(friend)} style={{
                  display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
                  borderRadius: 14, border: `1px solid ${isSelected ? NEON : COLORS.cardBorder}`,
                  background: isSelected ? `rgba(${NEON_RGB}, 0.08)` : COLORS.cardBg,
                  cursor: "pointer", transition: "all 0.3s", textAlign: "left",
                  boxShadow: isSelected ? `0 0 16px rgba(${NEON_RGB}, 0.15)` : "none",
                }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center",
                    background: `linear-gradient(135deg, ${COLORS.cardBg}, ${COLORS.cardBorder})`,
                    fontSize: friend.avatarUrl ? 0 : 16, position: "relative",
                    border: `2px solid ${isSelected ? NEON : COLORS.cardBorder}`,
                    overflow: "hidden",
                    color: NEON, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
                  }}>
                    {friend.avatarUrl ? (
                      <img src={friend.avatarUrl} alt={friend.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : initials}
                    <span style={{
                      position: "absolute", bottom: -1, right: -1,
                      width: 12, height: 12, borderRadius: "50%",
                      background: statusColor, border: `2px solid ${COLORS.cardBg}`,
                      boxShadow: `0 0 6px ${statusColor}`,
                    }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", fontFamily: "'DM Sans', sans-serif" }}>{friend.name}</div>
                    <div style={{ fontSize: 12, color: COLORS.textSecondary, fontFamily: "'DM Sans', sans-serif" }}>{friend.username ?? ""}</div>
                  </div>
                  {isSelected && (
                    <div style={{
                      width: 24, height: 24, borderRadius: "50%",
                      background: NEON, display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          )}
        </div>
      )}

      {/* Bottom CTA */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        padding: "16px 20px 28px",
        background: "linear-gradient(0deg, rgba(10,10,20,0.98) 60%, transparent 100%)",
        backdropFilter: "blur(20px)", zIndex: 90,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
      }}>
        {canProceed && selectedFriend && (
          <div style={{ fontSize: 12, color: COLORS.textSecondary, fontFamily: "'DM Sans', sans-serif", marginBottom: 2 }}>
            Playing with <span style={{ color: NEON, fontWeight: 700 }}>{selectedFriend.name}</span>
          </div>
        )}
        <div style={{ display: "flex", gap: 10, width: "100%", maxWidth: 360 }}>
          {activeSection !== "history" && activeSection !== "category" && (
            <button
              onClick={() => {
                if (activeSection === "filters") switchSection("category");
                else if (activeSection === "friend") switchSection("filters");
              }}
              style={{
                padding: "14px 18px", borderRadius: 50,
                border: `1px solid ${COLORS.cardBorder}`,
                background: COLORS.glass, color: COLORS.textSecondary,
                fontSize: 12, fontWeight: 700, cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.05em",
                backdropFilter: "blur(12px)", transition: "all 0.3s",
                flexShrink: 0,
              }}
            >
              ← BACK
            </button>
          )}
          <div style={{ width: "100%", flex: 1 }}>
          <NeonButton
            onClick={() => {
              if (canProceed) { onNext(); return; }
              if (activeSection === "history") { switchSection("category"); return; }
              if (activeSection === "category" && selectedCategories.length > 0) {
                // Map step-1 category IDs to filter category names
                if (selectedCategories.includes("anything")) {
                  setFilters(p => ({ ...p, categories: ["All"] }));
                } else {
                  const catNames = selectedCategories.map(id => {
                    const cat = CATEGORIES.find(c => c.id === id);
                    return cat?.label ?? id;
                  });
                  setFilters(p => ({ ...p, categories: catNames }));
                }
                switchSection("filters"); return;
              }
              if (activeSection === "filters" && !/^\d{5}$/.test(locationZip)) { setEditingZip(true); setZipInput(""); setTimeout(() => zipRef.current?.focus(), 50); return; }
              if (activeSection === "filters") { switchSection("friend"); return; }
            }}
            disabled={activeSection === "category" && selectedCategories.length === 0}
            size="large"
            style={{ width: "100%" }}
          >
          {activeSection === "history" && "START NEW GAME →"}
          {activeSection === "category" && selectedCategories.length === 0 && "Select a category to continue"}
          {activeSection === "category" && selectedCategories.length > 0 && "NEXT: SET FILTERS →"}
          {activeSection === "filters" && !/^\d{5}$/.test(locationZip) && "Enter your zip code to continue"}
          {activeSection === "filters" && /^\d{5}$/.test(locationZip) && "NEXT: CHOOSE FRIEND →"}
          {activeSection === "friend" && !selectedFriend && "Select a friend to continue"}
          {activeSection === "friend" && selectedFriend && "FIND 5 SPOTS →"}
          </NeonButton>
          </div>
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════
// STEP 1: PICK 5 BUSINESSES
// ═══════════════════════════════════════════════════
// Category → keywords that match against business type, categoryMain, and tags
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  restaurant: ["restaurant", "food", "dining", "eatery", "bistro", "diner", "grill", "steakhouse", "sushi", "ramen", "pizza", "burger", "taco", "bbq", "seafood"],
  bar: ["bar", "lounge", "cocktail", "pub", "tavern", "sports bar", "speakeasy", "dive"],
  coffee: ["coffee", "cafe", "tea", "espresso"],
  activity: ["activity", "bowling", "arcade", "escape room", "mini golf", "laser tag", "go kart", "trampoline", "axe throwing"],
  nightclub: ["nightclub", "club", "dance"],
  entertainment: ["entertainment", "theater", "comedy", "karaoke", "movie", "cinema", "concert", "live music"],
  outdoors: ["outdoor", "park", "trail", "hiking", "adventure", "nature", "garden"],
  shopping: ["shopping", "retail", "store", "boutique", "mall", "market"],
  wellness: ["wellness", "spa", "salon", "beauty", "massage", "yoga", "gym", "fitness", "pilates", "meditation"],
  brewery: ["brewery", "winery", "distillery", "craft beer", "wine", "taproom"],
  dessert: ["dessert", "bakery", "ice cream", "sweets", "candy", "pastry", "cake", "donut", "chocolate"],
};

function matchesCategory(biz: DiscoveryBusiness, categories: string[]): boolean {
  if (!categories.length || categories.includes("All") || categories.includes("anything")) return true;
  const haystack = [biz.type, biz.categoryMain, biz.vibe, ...biz.tags].join(" ").toLowerCase();
  return categories.some(cat => {
    const key = cat.toLowerCase();
    const keywords = CATEGORY_KEYWORDS[key];
    if (keywords) return keywords.some(kw => haystack.includes(kw));
    return haystack.includes(key);
  });
}

function PickFiveStep({ selectedIds, setSelectedIds, onSend, friend, businesses, locationZip, filters }: {
  selectedIds: string[];
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  onSend: () => void;
  friend: GameFriend;
  businesses: DiscoveryBusiness[];
  locationZip: string;
  filters: FilterState;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) :
      prev.length < 5 ? [...prev, id] : prev
    );
  };

  // Apply all filters: category, price, distance, openNow, tags, then text search
  const filteredBiz = businesses.filter((biz: DiscoveryBusiness) => {
    // Category filter
    if (!matchesCategory(biz, filters.categories)) return false;

    // Price filter
    if (filters.price !== "Any" && biz.price !== filters.price) return false;

    // Open now filter
    if (filters.openNow && !biz.isOpen) return false;

    // Distance filter
    if (locationZip && biz.businessZip) {
      const dist = getDistanceBetweenZips(locationZip, biz.businessZip);
      if (dist !== null && dist > filters.distance) return false;
    }

    // Tag filters (cuisine + vibe — match if ANY selected tag appears in biz tags)
    if (filters.tags.length > 0) {
      const bizTags = biz.tags.map(t => t.toLowerCase());
      const bizHaystack = [biz.type, biz.vibe, ...biz.tags].join(" ").toLowerCase();
      const hasMatch = filters.tags.some(ft => bizTags.includes(ft.toLowerCase()) || bizHaystack.includes(ft.toLowerCase()));
      if (!hasMatch) return false;
    }

    // Text search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!biz.name.toLowerCase().includes(q) &&
          !biz.type.toLowerCase().includes(q) &&
          !biz.tags.some((t: string) => t.toLowerCase().includes(q))) return false;
    }

    return true;
  });

  return (
    <div style={{
      flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden",
      padding: "0 0 120px", scrollbarWidth: "thin",
      scrollbarColor: `${NEON}40 transparent`,
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
        padding: "20px 20px 4px",
      }}>
        <div style={{ display: "flex", gap: 6 }}>
          {[1,2,3,4,5].map(n => {
            const filled = selectedIds.length >= n;
            return (
              <div key={n} style={{
                width: 36, height: 36, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: filled ? `rgba(${NEON_RGB}, 0.2)` : `${COLORS.cardBorder}30`,
                border: `2px solid ${filled ? NEON : COLORS.cardBorder}`,
                transition: "all 0.3s ease",
                boxShadow: filled ? `0 0 10px rgba(${NEON_RGB}, 0.3)` : "none",
              }}>
                <span style={{
                  fontSize: 14, fontWeight: 800, color: filled ? NEON : COLORS.textSecondary,
                  fontFamily: "'DM Sans', sans-serif",
                }}>{filled ? "★" : n}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ textAlign: "center", fontSize: 12, color: COLORS.textSecondary, fontFamily: "'DM Sans', sans-serif", marginBottom: 12 }}>
        Select <span style={{ color: NEON, fontWeight: 700 }}>5 spots</span> to send to {friend.name}
      </div>

      <div style={{ padding: "0 16px 12px" }}>
        <button onClick={() => setSearchOpen(s => !s)} style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%",
          padding: "10px 16px", borderRadius: 12,
          border: `1px solid ${searchOpen ? NEON + "50" : COLORS.cardBorder}`,
          background: searchOpen ? `rgba(${NEON_RGB}, 0.05)` : "rgba(255,255,255,0.03)",
          cursor: "pointer", transition: "all 0.3s",
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={searchOpen ? NEON : COLORS.textSecondary} strokeWidth="2.5" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <span style={{ fontSize: 12, fontWeight: 600, color: searchOpen ? NEON : COLORS.textSecondary, fontFamily: "'DM Sans', sans-serif" }}>
            {searchOpen ? "Hide Search" : "Search for a specific spot"}
          </span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={searchOpen ? NEON : COLORS.textSecondary} strokeWidth="2.5" strokeLinecap="round"
            style={{ transition: "transform 0.3s", transform: searchOpen ? "rotate(180deg)" : "rotate(0deg)", marginLeft: "auto" }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        <div style={{
          maxHeight: searchOpen ? 60 : 0, overflow: "hidden",
          transition: "max-height 0.3s ease", marginTop: searchOpen ? 8 : 0,
        }}>
          <div style={{ position: "relative" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={NEON + "80"} strokeWidth="2.5" strokeLinecap="round"
              style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", zIndex: 1 }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text" placeholder="Search restaurants, bars, activities..."
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: "100%", padding: "12px 14px 12px 40px", borderRadius: 12,
                border: `1px solid ${NEON}30`, background: `rgba(${NEON_RGB}, 0.04)`,
                color: "#fff", fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none",
                boxSizing: "border-box",
              }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} style={{
                position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer", padding: 4,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.textSecondary} strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>
        </div>
        {searchQuery && (
          <div style={{ fontSize: 11, color: COLORS.textSecondary, fontFamily: "'DM Sans', sans-serif", marginTop: 6 }}>
            Showing {filteredBiz.length} result{filteredBiz.length !== 1 ? "s" : ""} for &ldquo;<span style={{ color: NEON }}>{searchQuery}</span>&rdquo;
          </div>
        )}
      </div>

      {filteredBiz.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 20px" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", fontFamily: "'DM Sans', sans-serif", marginBottom: 6 }}>
            No businesses match your filters
          </div>
          <div style={{ fontSize: 12, color: COLORS.textSecondary, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6 }}>
            Try adjusting your category, price, distance, or other filters to see more options.
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, padding: "0 16px" }}>
          {filteredBiz.map(biz => {
            const dist = locationZip && biz.businessZip ? getDistanceBetweenZips(locationZip, biz.businessZip) : null;
            return (
              <BusinessMiniCard
                key={biz.id}
                biz={biz}
                selected={selectedIds.includes(biz.id)}
                onSelect={toggleSelect}
                disabled={selectedIds.length >= 5 && !selectedIds.includes(biz.id)}
                number={selectedIds.includes(biz.id) ? selectedIds.indexOf(biz.id) + 1 : null}
                distanceMi={dist}
              />
            );
          })}
        </div>
      )}

      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        padding: "16px 20px 28px",
        background: "linear-gradient(0deg, rgba(10,10,20,0.98) 60%, transparent 100%)",
        backdropFilter: "blur(20px)", zIndex: 90,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
      }}>
        <div style={{ fontSize: 12, color: COLORS.textSecondary, fontFamily: "'DM Sans', sans-serif" }}>
          {selectedIds.length}/5 selected
        </div>
        <NeonButton onClick={onSend} disabled={selectedIds.length !== 5} size="large" style={{ width: "100%", maxWidth: 360 }}>
          {selectedIds.length === 5 ? `SEND TO ${friend.name.toUpperCase()} →` : `Select ${5 - selectedIds.length} more`}
        </NeonButton>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════
// MINI-GAMES (played while waiting for friend)
// ═══════════════════════════════════════════════════

const FOOD_EMOJIS = ["🍕", "🍔", "🌮", "🍣", "🍩", "🍦", "🥗", "🍗", "🍰", "🥤", "🍿", "🌯"];

// ─── Game 1: Emoji Catcher ───
type FallingEmoji = { id: number; emoji: string; x: number; y: number; speed: number };

function EmojiCatcherGame({ onBack }: { onBack: () => void }) {
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [gameOver, setGameOver] = useState(false);
  const [emojis, setEmojis] = useState<FallingEmoji[]>([]);
  const nextId = useRef(0);
  const areaRef = useRef<HTMLDivElement>(null);

  // Spawn emojis
  useEffect(() => {
    if (gameOver) return;
    const spawn = setInterval(() => {
      setEmojis(prev => [...prev, {
        id: nextId.current++,
        emoji: FOOD_EMOJIS[Math.floor(Math.random() * FOOD_EMOJIS.length)],
        x: 10 + Math.random() * 80,
        y: 0,
        speed: 1.2 + score * 0.05,
      }]);
    }, 900 - Math.min(score * 20, 500));
    return () => clearInterval(spawn);
  }, [gameOver, score]);

  // Move emojis down
  useEffect(() => {
    if (gameOver) return;
    const tick = setInterval(() => {
      setEmojis(prev => {
        const alive: FallingEmoji[] = [];
        let missed = 0;
        for (const e of prev) {
          const ny = e.y + e.speed * 3;
          if (ny >= 100) { missed++; }
          else { alive.push({ ...e, y: ny }); }
        }
        if (missed > 0) {
          setLives(l => {
            const next = l - missed;
            if (next <= 0) setGameOver(true);
            return Math.max(0, next);
          });
        }
        return alive;
      });
    }, 50);
    return () => clearInterval(tick);
  }, [gameOver]);

  const catchEmoji = (id: number) => {
    setEmojis(prev => prev.filter(e => e.id !== id));
    setScore(s => s + 1);
  };

  const restart = () => { setScore(0); setLives(3); setGameOver(false); setEmojis([]); };

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", width: "100%", maxWidth: 320, fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>
        <span style={{ color: NEON }}>Score: {score}</span>
        <span style={{ color: COLORS.neonPink }}>{"❤️".repeat(lives)}{"🖤".repeat(3 - lives)}</span>
      </div>
      <div ref={areaRef} style={{
        position: "relative", width: "100%", maxWidth: 320, height: 320,
        background: `${COLORS.cardBg}`, border: `1px solid ${COLORS.cardBorder}`,
        borderRadius: 16, overflow: "hidden", touchAction: "manipulation",
      }}>
        {gameOver ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12 }}>
            <div style={{ fontSize: 40 }}>💀</div>
            <div style={{ fontFamily: "'Dela Gothic One', sans-serif", fontSize: 18, color: "#fff" }}>Game Over!</div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: NEON }}>Score: {score}</div>
            <NeonButton onClick={restart} size="small">Play Again</NeonButton>
          </div>
        ) : (
          emojis.map(e => (
            <button key={e.id} onClick={() => catchEmoji(e.id)} style={{
              position: "absolute", left: `${e.x}%`, top: `${e.y}%`,
              fontSize: 28, background: "none", border: "none", cursor: "pointer",
              transform: "translate(-50%, -50%)", padding: 4, touchAction: "manipulation",
              filter: `drop-shadow(0 0 6px ${NEON}50)`,
            }}>{e.emoji}</button>
          ))
        )}
      </div>
      <NeonButton onClick={onBack} color={COLORS.textSecondary} size="small">← Back to Games</NeonButton>
    </div>
  );
}

// ─── Game 2: Tap Speed Challenge ───
function TapSpeedGame({ onBack }: { onBack: () => void }) {
  const [phase, setPhase] = useState<"ready" | "countdown" | "playing" | "done">("ready");
  const [countdown, setCountdown] = useState(3);
  const [taps, setTaps] = useState(0);
  const [timeLeft, setTimeLeft] = useState(10);

  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) { setPhase("playing"); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  useEffect(() => {
    if (phase !== "playing") return;
    if (timeLeft <= 0) { setPhase("done"); return; }
    const t = setTimeout(() => setTimeLeft(tl => tl - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, timeLeft]);

  const start = () => { setTaps(0); setTimeLeft(10); setCountdown(3); setPhase("countdown"); };
  const tps = (taps / 10).toFixed(1);
  const rating = Number(tps) >= 8 ? "Blazing! 🔥" : Number(tps) >= 6 ? "Fast! ⚡" : Number(tps) >= 4 ? "Nice! 👍" : "Keep trying! 💪";

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      {phase === "ready" && (
        <>
          <div style={{ fontFamily: "'Dela Gothic One', sans-serif", fontSize: 18, color: "#fff" }}>Tap Speed Challenge</div>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: COLORS.textSecondary }}>Tap as fast as you can for 10 seconds!</div>
          <NeonButton onClick={start} color={COLORS.neonGreen}>Start!</NeonButton>
        </>
      )}
      {phase === "countdown" && (
        <div style={{ fontFamily: "'Dela Gothic One', sans-serif", fontSize: 72, color: NEON, textShadow: `0 0 30px ${NEON}80` }}>{countdown}</div>
      )}
      {phase === "playing" && (
        <>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: COLORS.textSecondary }}>
            Time: <span style={{ color: timeLeft <= 3 ? COLORS.neonPink : NEON }}>{timeLeft}s</span>
          </div>
          <div style={{ fontFamily: "'Dela Gothic One', sans-serif", fontSize: 36, color: NEON }}>{taps}</div>
          <button onClick={() => setTaps(t => t + 1)} style={{
            width: 160, height: 160, borderRadius: "50%",
            background: `radial-gradient(circle, ${NEON}30, ${COLORS.cardBg})`,
            border: `3px solid ${NEON}`,
            boxShadow: `0 0 30px ${NEON}40, 0 0 60px ${NEON}20`,
            color: NEON, fontSize: 24, fontWeight: 800, cursor: "pointer",
            fontFamily: "'Dela Gothic One', sans-serif",
            touchAction: "manipulation",
          }}>TAP!</button>
        </>
      )}
      {phase === "done" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={{ fontFamily: "'Dela Gothic One', sans-serif", fontSize: 18, color: "#fff" }}>{rating}</div>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: COLORS.textSecondary }}>{taps} taps — {tps} taps/sec</div>
          <NeonButton onClick={start} size="small">Try Again</NeonButton>
        </div>
      )}
      <NeonButton onClick={onBack} color={COLORS.textSecondary} size="small">← Back to Games</NeonButton>
    </div>
  );
}

// ─── Game 3: Memory Match ───
type MemCard = { id: number; emoji: string; flipped: boolean; matched: boolean };

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function buildMemoryDeck(): MemCard[] {
  const pick = shuffleArray(FOOD_EMOJIS).slice(0, 6);
  const pairs = [...pick, ...pick];
  return shuffleArray(pairs).map((emoji, i) => ({ id: i, emoji, flipped: false, matched: false }));
}

function MemoryMatchGame({ onBack }: { onBack: () => void }) {
  const [cards, setCards] = useState<MemCard[]>(buildMemoryDeck);
  const [selected, setSelected] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [won, setWon] = useState(false);
  const lockRef = useRef(false);

  const handleFlip = (id: number) => {
    if (lockRef.current) return;
    const card = cards[id];
    if (card.flipped || card.matched) return;

    const next = cards.map((c, i) => i === id ? { ...c, flipped: true } : c);
    setCards(next);
    const sel = [...selected, id];
    setSelected(sel);

    if (sel.length === 2) {
      setMoves(m => m + 1);
      lockRef.current = true;
      const [a, b] = sel;
      if (next[a].emoji === next[b].emoji) {
        const matched = next.map((c, i) => (i === a || i === b) ? { ...c, matched: true } : c);
        setCards(matched);
        setSelected([]);
        lockRef.current = false;
        if (matched.every(c => c.matched)) setWon(true);
      } else {
        setTimeout(() => {
          setCards(prev => prev.map((c, i) => (i === a || i === b) ? { ...c, flipped: false } : c));
          setSelected([]);
          lockRef.current = false;
        }, 800);
      }
    }
  };

  const restart = () => { setCards(buildMemoryDeck()); setSelected([]); setMoves(0); setWon(false); };

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", width: "100%", maxWidth: 280, fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>
        <span style={{ color: NEON }}>Moves: {moves}</span>
        {won && <span style={{ color: COLORS.neonGreen }}>You Won!</span>}
      </div>
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8,
        width: "100%", maxWidth: 280,
      }}>
        {cards.map((card, i) => (
          <button key={card.id} onClick={() => handleFlip(i)} style={{
            width: "100%", aspectRatio: "1", borderRadius: 12,
            border: `2px solid ${card.matched ? COLORS.neonGreen + "60" : card.flipped ? NEON + "60" : COLORS.cardBorder}`,
            background: card.flipped || card.matched
              ? `${COLORS.cardBg}`
              : `linear-gradient(135deg, ${COLORS.neonPurple}20, ${COLORS.cardBg})`,
            fontSize: 24, cursor: card.matched ? "default" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.3s ease",
            boxShadow: card.matched ? `0 0 12px ${COLORS.neonGreen}30` : "none",
            opacity: card.matched ? 0.5 : 1,
            touchAction: "manipulation",
          }}>
            {card.flipped || card.matched ? card.emoji : "?"}
          </button>
        ))}
      </div>
      {won && <NeonButton onClick={restart} size="small" color={COLORS.neonGreen}>Play Again</NeonButton>}
      <NeonButton onClick={onBack} color={COLORS.textSecondary} size="small">← Back to Games</NeonButton>
    </div>
  );
}

// ─── Game 4: Food Trivia ───
const TRIVIA_QUESTIONS: { q: string; answers: string[]; correct: number }[] = [
  { q: "Which country is sushi originally from?", answers: ["China", "Japan", "Korea", "Thailand"], correct: 1 },
  { q: "What is the main ingredient in guacamole?", answers: ["Tomato", "Lime", "Avocado", "Onion"], correct: 2 },
  { q: "Which Italian city is pizza originally from?", answers: ["Rome", "Milan", "Naples", "Venice"], correct: 2 },
  { q: "What type of pasta is shaped like little ears?", answers: ["Penne", "Orecchiette", "Fusilli", "Rigatoni"], correct: 1 },
  { q: "What gives bread its rise?", answers: ["Baking soda", "Butter", "Yeast", "Salt"], correct: 2 },
  { q: "Which spice is the most expensive by weight?", answers: ["Vanilla", "Saffron", "Cinnamon", "Turmeric"], correct: 1 },
  { q: "What fruit is used to make traditional wine?", answers: ["Apples", "Grapes", "Berries", "Peaches"], correct: 1 },
  { q: "Which nut is used to make marzipan?", answers: ["Cashew", "Walnut", "Pistachio", "Almond"], correct: 3 },
  { q: "What is the hottest chili pepper in the world?", answers: ["Habanero", "Ghost Pepper", "Carolina Reaper", "Jalapeño"], correct: 2 },
  { q: "Which country invented croissants?", answers: ["France", "Austria", "Italy", "Belgium"], correct: 1 },
  { q: "What is tofu made from?", answers: ["Rice", "Wheat", "Soybeans", "Corn"], correct: 2 },
  { q: "Which meal is brunch a combination of?", answers: ["Breakfast + Lunch", "Bread + Munch", "Break + Crunch", "Brit + Lunch"], correct: 0 },
  { q: "What is the most consumed fruit worldwide?", answers: ["Apples", "Bananas", "Oranges", "Mangoes"], correct: 1 },
  { q: "Which food has the highest water content?", answers: ["Watermelon", "Cucumber", "Lettuce", "Celery"], correct: 1 },
  { q: "What does 'al dente' mean?", answers: ["Well done", "With sauce", "To the tooth", "On a plate"], correct: 2 },
];

function FoodTriviaGame({ onBack }: { onBack: () => void }) {
  const [questions] = useState(() => shuffleArray([...TRIVIA_QUESTIONS]));
  const [qi, setQi] = useState(0);
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);

  const q = questions[qi % questions.length];

  const pick = (idx: number) => {
    if (picked !== null) return;
    setPicked(idx);
    setTotal(t => t + 1);
    if (idx === q.correct) setScore(s => s + 1);
    setTimeout(() => { setPicked(null); setQi(i => i + 1); }, 1200);
  };

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, maxWidth: 320 }}>
      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: NEON }}>Score: {score}/{total}</div>
      <div style={{
        fontFamily: "'DM Sans', sans-serif", fontSize: 15, color: "#fff", textAlign: "center",
        padding: "16px 12px", background: COLORS.cardBg, border: `1px solid ${COLORS.cardBorder}`,
        borderRadius: 12, width: "100%", lineHeight: 1.5,
      }}>{q.q}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
        {q.answers.map((a, i) => {
          const isCorrect = i === q.correct;
          const isPicked = picked === i;
          let bg: string = `${COLORS.cardBg}`;
          let borderColor: string = COLORS.cardBorder;
          if (picked !== null) {
            if (isCorrect) { bg = `${COLORS.neonGreen}18`; borderColor = COLORS.neonGreen; }
            else if (isPicked) { bg = `${COLORS.neonPink}18`; borderColor = COLORS.neonPink; }
          }
          return (
            <button key={i} onClick={() => pick(i)} style={{
              padding: "12px 16px", borderRadius: 10, border: `1px solid ${borderColor}`,
              background: bg, color: "#fff", fontSize: 13, cursor: picked !== null ? "default" : "pointer",
              fontFamily: "'DM Sans', sans-serif", textAlign: "left", transition: "all 0.3s",
              touchAction: "manipulation",
            }}>{a}</button>
          );
        })}
      </div>
      <NeonButton onClick={onBack} color={COLORS.textSecondary} size="small">← Back to Games</NeonButton>
    </div>
  );
}

// ─── Game 5: Would You Rather ───
const WYR_QUESTIONS: [string, string][] = [
  ["Only eat pizza for a year", "Only eat tacos for a year"],
  ["Have unlimited sushi", "Have unlimited steak"],
  ["Never eat dessert again", "Never eat fried food again"],
  ["Cook every meal at home", "Eat out every meal"],
  ["Only eat breakfast food", "Only eat dinner food"],
  ["Give up coffee forever", "Give up chocolate forever"],
  ["Be a famous chef", "Be a famous food critic"],
  ["Only eat spicy food", "Only eat bland food"],
  ["Free food at any restaurant", "Free flights anywhere"],
  ["Never eat cheese again", "Never eat bread again"],
  ["Always have the perfect recipe", "Always have the perfect playlist"],
  ["Eat one giant meal a day", "Eat 10 tiny meals a day"],
  ["Only drink water forever", "Never eat fruit again"],
  ["Master every cuisine", "Own a Michelin-star restaurant"],
  ["Go on a food tour of Asia", "Go on a food tour of Europe"],
];

function WouldYouRatherGame({ onBack }: { onBack: () => void }) {
  const [questions] = useState(() => shuffleArray([...WYR_QUESTIONS]));
  const [qi, setQi] = useState(0);
  const [picked, setPicked] = useState<0 | 1 | null>(null);
  const [pct, setPct] = useState(50);

  const q = questions[qi % questions.length];

  const choose = (side: 0 | 1) => {
    if (picked !== null) return;
    setPicked(side);
    setPct(35 + Math.floor(Math.random() * 31)); // 35-65%
    setTimeout(() => { setPicked(null); setQi(i => i + 1); }, 2200);
  };

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, maxWidth: 320 }}>
      <div style={{ fontFamily: "'Dela Gothic One', sans-serif", fontSize: 14, color: COLORS.neonOrange }}>Would You Rather...</div>
      <div style={{ display: "flex", gap: 10, width: "100%" }}>
        {[0, 1].map(side => {
          const isThis = picked === side;
          const isOther = picked !== null && picked !== side;
          const thisPct = side === 0 ? pct : 100 - pct;
          return (
            <button key={side} onClick={() => choose(side as 0 | 1)} style={{
              flex: 1, padding: "20px 12px", borderRadius: 14,
              border: `2px solid ${isThis ? NEON : isOther ? COLORS.cardBorder : COLORS.neonOrange + "40"}`,
              background: isThis ? `${NEON}15` : COLORS.cardBg,
              color: isOther ? COLORS.textSecondary : "#fff",
              fontSize: 13, cursor: picked !== null ? "default" : "pointer",
              fontFamily: "'DM Sans', sans-serif", textAlign: "center", lineHeight: 1.5,
              transition: "all 0.3s", display: "flex", flexDirection: "column", gap: 8,
              touchAction: "manipulation",
            }}>
              <span>{q[side as 0 | 1]}</span>
              {picked !== null && <span style={{ fontSize: 20, fontWeight: 800, color: isThis ? NEON : COLORS.textSecondary }}>{thisPct}%</span>}
            </button>
          );
        })}
      </div>
      <NeonButton onClick={onBack} color={COLORS.textSecondary} size="small">← Back to Games</NeonButton>
    </div>
  );
}

// ─── Game 6: Word Scramble ───
const SCRAMBLE_WORDS = [
  "SUSHI", "TACOS", "PIZZA", "PASTA", "BRUNCH", "STEAK", "SALAD", "CURRY",
  "RAMEN", "CREPE", "DONUT", "WAFFLE", "BURGER", "FRIES", "WINGS",
  "NACHOS", "GELATO", "PANINI", "KEBAB", "FONDUE",
];

function scrambleWord(word: string): string[] {
  const letters = word.split("");
  let scrambled = shuffleArray(letters);
  // Make sure it's actually scrambled
  let attempts = 0;
  while (scrambled.join("") === word && attempts < 10) { scrambled = shuffleArray(letters); attempts++; }
  return scrambled;
}

function WordScrambleGame({ onBack }: { onBack: () => void }) {
  const [words] = useState(() => shuffleArray([...SCRAMBLE_WORDS]));
  const [wi, setWi] = useState(0);
  const [scrambled, setScrambled] = useState<string[]>(() => scrambleWord(SCRAMBLE_WORDS[0]));
  const [placed, setPlaced] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [shake, setShake] = useState(false);
  const [correct, setCorrect] = useState(false);

  const word = words[wi % words.length];

  // Reset when word changes
  useEffect(() => {
    setScrambled(scrambleWord(word));
    setPlaced([]);
    setShowHint(false);
    setCorrect(false);
  }, [word]);

  // Show hint after 10s
  useEffect(() => {
    const t = setTimeout(() => setShowHint(true), 10000);
    return () => clearTimeout(t);
  }, [wi]);

  const tapLetter = (idx: number) => {
    if (placed.includes(idx) || correct) return;
    const next = [...placed, idx];
    setPlaced(next);

    // Check if word is complete
    if (next.length === word.length) {
      const attempt = next.map(i => scrambled[i]).join("");
      if (attempt === word) {
        setCorrect(true);
        setScore(s => s + 1);
        setTimeout(() => setWi(i => i + 1), 1000);
      } else {
        setShake(true);
        setTimeout(() => { setShake(false); setPlaced([]); }, 500);
      }
    }
  };

  const removeLetter = (placedIdx: number) => {
    if (correct) return;
    setPlaced(prev => prev.filter((_, i) => i !== placedIdx));
  };

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, maxWidth: 320 }}>
      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: NEON }}>Score: {score}</div>
      {showHint && !correct && (
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: COLORS.neonBlue }}>
          Hint: starts with &quot;{word[0]}&quot;
        </div>
      )}

      {/* Placed letters */}
      <div style={{
        display: "flex", gap: 6, minHeight: 48, alignItems: "center", justifyContent: "center",
        animation: shake ? "wordShake 0.3s ease" : "none", flexWrap: "wrap",
      }}>
        <style>{`@keyframes wordShake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-8px); } 75% { transform: translateX(8px); } }`}</style>
        {Array.from({ length: word.length }).map((_, i) => {
          const letter = placed[i] !== undefined ? scrambled[placed[i]] : "";
          return (
            <button key={i} onClick={() => placed[i] !== undefined && removeLetter(i)} style={{
              width: 40, height: 44, borderRadius: 8,
              border: `2px solid ${correct ? COLORS.neonGreen : letter ? NEON + "60" : COLORS.cardBorder}`,
              background: correct ? `${COLORS.neonGreen}15` : COLORS.cardBg,
              color: correct ? COLORS.neonGreen : "#fff",
              fontSize: 18, fontWeight: 800, fontFamily: "'DM Sans', sans-serif",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: letter ? "pointer" : "default",
              touchAction: "manipulation",
            }}>{letter}</button>
          );
        })}
      </div>

      {/* Scrambled letters */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
        {scrambled.map((letter, i) => (
          <button key={i} onClick={() => tapLetter(i)} disabled={placed.includes(i)} style={{
            width: 40, height: 44, borderRadius: 8,
            border: `2px solid ${placed.includes(i) ? "transparent" : COLORS.neonPurple + "50"}`,
            background: placed.includes(i) ? "transparent" : `${COLORS.neonPurple}15`,
            color: placed.includes(i) ? "transparent" : COLORS.neonPurple,
            fontSize: 18, fontWeight: 800, fontFamily: "'DM Sans', sans-serif",
            cursor: placed.includes(i) ? "default" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.2s",
            touchAction: "manipulation",
          }}>{letter}</button>
        ))}
      </div>
      <NeonButton onClick={onBack} color={COLORS.textSecondary} size="small">← Back to Games</NeonButton>
    </div>
  );
}

// ─── Game 7: Slot Machine ───
const SLOT_EMOJIS = ["🍕", "🍔", "🌮", "🍣", "🍩", "🍦", "🥗", "🍗"];

function SlotMachineGame({ onBack }: { onBack: () => void }) {
  const [reels, setReels] = useState([0, 1, 2]);
  const [spinning, setSpinning] = useState(false);
  const [coins, setCoins] = useState(100);
  const [result, setResult] = useState<"jackpot" | "match2" | "lose" | null>(null);

  const spin = () => {
    if (spinning || coins < 10) return;
    setCoins(c => c - 10);
    setSpinning(true);
    setResult(null);

    // Animate reels with staggered stops
    let stops = 0;
    const finalReels = [
      Math.floor(Math.random() * SLOT_EMOJIS.length),
      Math.floor(Math.random() * SLOT_EMOJIS.length),
      Math.floor(Math.random() * SLOT_EMOJIS.length),
    ];

    const animateReel = (idx: number, duration: number) => {
      const interval = setInterval(() => {
        setReels(prev => {
          const next = [...prev];
          next[idx] = Math.floor(Math.random() * SLOT_EMOJIS.length);
          return next;
        });
      }, 80);
      setTimeout(() => {
        clearInterval(interval);
        setReels(prev => { const next = [...prev]; next[idx] = finalReels[idx]; return next; });
        stops++;
        if (stops === 3) {
          // Evaluate
          const [a, b, c] = finalReels;
          if (a === b && b === c) {
            setResult("jackpot");
            setCoins(co => co + 100);
          } else if (a === b || b === c || a === c) {
            setResult("match2");
            setCoins(co => co + 25);
          } else {
            setResult("lose");
          }
          setSpinning(false);
        }
      }, duration);
    };

    animateReel(0, 600);
    animateReel(1, 1000);
    animateReel(2, 1400);
  };

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, maxWidth: 320 }}>
      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: NEON }}>
        Coins: {coins} 🪙
      </div>

      <div style={{
        display: "flex", gap: 12, padding: "24px 20px",
        background: COLORS.cardBg, borderRadius: 16,
        border: `2px solid ${result === "jackpot" ? NEON : COLORS.cardBorder}`,
        boxShadow: result === "jackpot" ? `0 0 40px ${NEON}40` : "none",
        transition: "all 0.3s",
      }}>
        {reels.map((r, i) => (
          <div key={i} style={{
            width: 64, height: 72, borderRadius: 12,
            background: `${COLORS.darkBg}`,
            border: `1px solid ${COLORS.cardBorder}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 36,
            transition: spinning ? "none" : "all 0.3s",
          }}>{SLOT_EMOJIS[r]}</div>
        ))}
      </div>

      {result && !spinning && (
        <div style={{
          fontFamily: "'Dela Gothic One', sans-serif", fontSize: 16,
          color: result === "jackpot" ? NEON : result === "match2" ? COLORS.neonGreen : COLORS.textSecondary,
          textShadow: result === "jackpot" ? `0 0 20px ${NEON}60` : "none",
        }}>
          {result === "jackpot" ? "🎉 JACKPOT! +100" : result === "match2" ? "Nice! +25" : "Try again!"}
        </div>
      )}

      <NeonButton onClick={spin} disabled={spinning || coins < 10} color={COLORS.neonOrange}>
        {coins < 10 ? "No Coins!" : spinning ? "Spinning..." : "🎰 PULL (10 coins)"}
      </NeonButton>

      {coins < 10 && !spinning && (
        <NeonButton onClick={() => setCoins(100)} size="small" color={COLORS.neonGreen}>Reset Coins</NeonButton>
      )}

      <NeonButton onClick={onBack} color={COLORS.textSecondary} size="small">← Back to Games</NeonButton>
    </div>
  );
}

// ─── Mini-Game Picker ───
const MINI_GAMES: { id: string; emoji: string; name: string; color: string }[] = [
  { id: "catcher", emoji: "🍕", name: "Emoji Catch", color: COLORS.neonPink },
  { id: "tapspeed", emoji: "⚡", name: "Tap Speed", color: NEON },
  { id: "memory", emoji: "🧠", name: "Memory", color: COLORS.neonPurple },
  { id: "trivia", emoji: "❓", name: "Trivia", color: COLORS.neonBlue },
  { id: "wyr", emoji: "🤔", name: "Would You Rather", color: COLORS.neonOrange },
  { id: "scramble", emoji: "🔤", name: "Word Scramble", color: COLORS.neonGreen },
  { id: "slots", emoji: "🎰", name: "Slots", color: COLORS.neonPink },
];

function MiniGamePicker({ onSelect }: { onSelect: (id: string) => void }) {
  return (
    <div style={{ width: "100%", maxWidth: 320 }}>
      <div style={{
        fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: COLORS.textSecondary,
        textAlign: "center", marginBottom: 12,
      }}>🎮 Play while you wait</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {MINI_GAMES.map(g => (
          <button key={g.id} onClick={() => onSelect(g.id)} style={{
            padding: "14px 8px", borderRadius: 14,
            border: `1px solid ${g.color}30`,
            background: `${g.color}08`,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
            cursor: "pointer", transition: "all 0.2s",
            touchAction: "manipulation",
          }}>
            <span style={{ fontSize: 24 }}>{g.emoji}</span>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600, color: g.color }}>{g.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ActiveMiniGame({ gameId, onBack }: { gameId: string; onBack: () => void }) {
  switch (gameId) {
    case "catcher": return <EmojiCatcherGame onBack={onBack} />;
    case "tapspeed": return <TapSpeedGame onBack={onBack} />;
    case "memory": return <MemoryMatchGame onBack={onBack} />;
    case "trivia": return <FoodTriviaGame onBack={onBack} />;
    case "wyr": return <WouldYouRatherGame onBack={onBack} />;
    case "scramble": return <WordScrambleGame onBack={onBack} />;
    case "slots": return <SlotMachineGame onBack={onBack} />;
    default: return null;
  }
}


// ═══════════════════════════════════════════════════
// STEP 2: WAITING FOR FRIEND
// ═══════════════════════════════════════════════════
function WaitingStep({ friend, gameCode, p2Joined, gameSessionId, onGameAdvanced, onBackToSetup, authToken }: {
  friend: GameFriend;
  gameCode: string;
  p2Joined: boolean;
  gameSessionId: string | null;
  onGameAdvanced: (gs: GameSession) => void;
  onBackToSetup: () => void;
  authToken: string | null;
}) {
  const [dots, setDots] = useState("");
  const [copied, setCopied] = useState(false);
  const [activeGame, setActiveGame] = useState<string | null>(null);

  // Animated dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(d => d.length >= 3 ? "" : d + ".");
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Poll game status every 5 seconds as reliable fallback
  useEffect(() => {
    if (!gameSessionId) return;
    const poll = setInterval(async () => {
      if (!authToken) return;
      try {
        const res = await fetch(`/api/games/${gameSessionId}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!res.ok) return;
        const { gameSession: gs } = await res.json();
        // If game advanced past our current waiting state, notify parent
        if (gs.status === "pick1" || gs.status === "complete") {
          onGameAdvanced(gs);
        }
      } catch { /* ignore */ }
    }, 5000);
    return () => clearInterval(poll);
  }, [gameSessionId, onGameAdvanced]);

  const shareLink = typeof window !== "undefined" ? `${window.location.origin}/5v3v1?code=${gameCode}` : "";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* fallback: do nothing */ }
  };

  const initials = friend.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
      padding: activeGame ? "12px 20px 20px" : "40px 20px", textAlign: "center",
      overflowY: "auto",
    }}>
      <style>{`
        @keyframes waitPulse { 0%, 100% { transform: scale(1); opacity: 0.3; } 50% { transform: scale(1.5); opacity: 0; } }
        @keyframes waitSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* ── Compact header when playing a mini-game ── */}
      {activeGame ? (
        <div style={{
          display: "flex", alignItems: "center", gap: 10, marginBottom: 16, width: "100%",
          padding: "8px 12px", borderRadius: 12, background: `${COLORS.cardBg}`,
          border: `1px solid ${COLORS.cardBorder}`,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: `linear-gradient(135deg, ${COLORS.cardBg}, rgba(${NEON_RGB}, 0.15))`,
            border: `2px solid ${NEON}50`, fontSize: 10, fontWeight: 800, color: NEON,
            fontFamily: "'DM Sans', sans-serif",
          }}>{initials}</div>
          <div style={{ flex: 1, textAlign: "left" }}>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#fff" }}>
              Waiting for {friend.name}{dots}
            </div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: COLORS.textSecondary }}>
              {p2Joined ? "Choosing their top 3..." : `Code: ${gameCode}`}
            </div>
          </div>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: p2Joined ? COLORS.neonGreen : NEON, animation: "waitPulse 2s ease-in-out infinite" }} />
        </div>
      ) : (
        /* ── Full waiting header (no game active) ── */
        <>
          <div style={{ position: "relative", marginBottom: 24 }}>
            <div style={{ position: "absolute", inset: -20, borderRadius: "50%", border: `2px solid ${NEON}30`, animation: "waitPulse 2s ease-in-out infinite" }} />
            <div style={{ position: "absolute", inset: -35, borderRadius: "50%", border: `1px solid ${COLORS.neonBlue}20`, animation: "waitPulse 2s ease-in-out infinite 0.5s" }} />
            <div style={{
              width: 80, height: 80, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: `linear-gradient(135deg, ${COLORS.cardBg}, rgba(${NEON_RGB}, 0.1))`,
              border: `3px solid ${NEON}50`, fontSize: 22, fontWeight: 800, color: NEON, position: "relative",
              boxShadow: `0 0 30px rgba(${NEON_RGB}, 0.2)`,
              fontFamily: "'DM Sans', sans-serif",
            }}>
              {initials}
            </div>
            <div style={{
              position: "absolute", inset: -8, borderRadius: "50%",
              border: "2px solid transparent", borderTopColor: NEON,
              animation: "waitSpin 1.5s linear infinite",
            }} />
          </div>

          <div style={{ fontFamily: "'Dela Gothic One', sans-serif", fontSize: 22, color: "#fff", marginBottom: 8 }}>
            Waiting for {friend.name}{dots}
          </div>
          <div style={{ fontSize: 14, color: COLORS.textSecondary, fontFamily: "'DM Sans', sans-serif", maxWidth: 280, lineHeight: 1.6, marginBottom: 8 }}>
            {p2Joined
              ? `${friend.name} is choosing their top 3.`
              : `Share the link so ${friend.name} can join!`}
          </div>
          <div style={{ fontSize: 12, color: `${NEON}80`, fontFamily: "'DM Sans', sans-serif", marginBottom: 16 }}>
            {p2Joined ? "We\u2019ll advance automatically when they respond" : `Game code: ${gameCode}`}
          </div>

          {!p2Joined && (
            <div style={{ marginBottom: 20 }}>
              <NeonButton onClick={handleCopy} color={COLORS.neonPurple} size="small">
                {copied ? "✓ Link Copied!" : "📋 Copy Invite Link"}
              </NeonButton>
            </div>
          )}
        </>
      )}

      {/* ── Mini-games area ── */}
      {activeGame ? (
        <ActiveMiniGame gameId={activeGame} onBack={() => setActiveGame(null)} />
      ) : (
        <MiniGamePicker onSelect={setActiveGame} />
      )}

      {/* ── Back to setup ── */}
      {!activeGame && (
        <div style={{ marginTop: 20 }}>
          <NeonButton color={COLORS.textSecondary} size="small" onClick={onBackToSetup}>
            ← Back to Setup
          </NeonButton>
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════
// STEP 2B: PLAYER 2 PICKS 3
// ═══════════════════════════════════════════════════
function PickThreeStep({ fiveChoices, selectedThree, setSelectedThree, sender, onSendBack }: {
  fiveChoices: DiscoveryBusiness[];
  selectedThree: string[];
  setSelectedThree: React.Dispatch<React.SetStateAction<string[]>>;
  sender: string;
  onSendBack: () => void;
}) {
  const toggleSelect = (id: string) => {
    setSelectedThree(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) :
      prev.length < 3 ? [...prev, id] : prev
    );
  };

  return (
    <div style={{
      flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden",
      padding: "0 0 120px", scrollbarWidth: "thin",
      scrollbarColor: `${COLORS.neonPurple}40 transparent`,
    }}>
      <div style={{ padding: "20px 20px 4px", textAlign: "center" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "10px 20px", borderRadius: 50,
          background: `${COLORS.neonPurple}10`, border: `1px solid ${COLORS.neonPurple}30`,
          marginBottom: 12,
        }}>
          <span style={{ fontSize: 18 }}>🎮</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.neonPurple, fontFamily: "'DM Sans', sans-serif" }}>
            {sender} sent you 5 picks!
          </span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "8px 20px 4px" }}>
        {[1,2,3].map(n => {
          const filled = selectedThree.length >= n;
          return (
            <div key={n} style={{
              width: 36, height: 36, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: filled ? `${COLORS.neonPurple}20` : `${COLORS.cardBorder}30`,
              border: `2px solid ${filled ? COLORS.neonPurple : COLORS.cardBorder}`,
              transition: "all 0.3s",
              boxShadow: filled ? `0 0 10px ${COLORS.neonPurple}30` : "none",
            }}>
              <span style={{
                fontSize: 14, fontWeight: 800,
                color: filled ? COLORS.neonPurple : COLORS.textSecondary,
                fontFamily: "'DM Sans', sans-serif",
              }}>{filled ? "★" : n}</span>
            </div>
          );
        })}
      </div>
      <div style={{ textAlign: "center", fontSize: 12, color: COLORS.textSecondary, fontFamily: "'DM Sans', sans-serif", marginBottom: 16 }}>
        Pick your <span style={{ color: COLORS.neonPurple, fontWeight: 700 }}>top 3</span> from the options below
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "0 16px" }}>
        {fiveChoices.map(biz => (
          <button key={biz.id} onClick={() => toggleSelect(biz.id)}
            disabled={selectedThree.length >= 3 && !selectedThree.includes(biz.id)}
            style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: 0, borderRadius: 16, overflow: "hidden",
              border: `1px solid ${selectedThree.includes(biz.id) ? COLORS.neonPurple : COLORS.cardBorder}`,
              background: selectedThree.includes(biz.id) ? `${COLORS.neonPurple}08` : COLORS.cardBg,
              cursor: selectedThree.length >= 3 && !selectedThree.includes(biz.id) ? "default" : "pointer",
              transition: "all 0.3s", textAlign: "left",
              opacity: selectedThree.length >= 3 && !selectedThree.includes(biz.id) ? 0.35 : 1,
              boxShadow: selectedThree.includes(biz.id) ? `0 0 16px ${COLORS.neonPurple}20` : "none",
            }}
          >
            <div style={{ width: 90, height: 90, flexShrink: 0, position: "relative", overflow: "hidden", borderRadius: "16px 0 0 16px" }}>
              <CardImageCarousel images={biz.images} gradient={getBusinessGradient(biz.id)} emoji={getBusinessEmoji(biz.type)} height={90} />
              {selectedThree.includes(biz.id) && (
                <div style={{
                  position: "absolute", inset: 0, zIndex: 5,
                  background: `${COLORS.neonPurple}25`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: COLORS.neonPurple, display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: `0 0 12px ${COLORS.neonPurple}`,
                  }}>
                    <span style={{ color: "#fff", fontWeight: 800, fontSize: 14, fontFamily: "'DM Sans', sans-serif" }}>
                      {selectedThree.indexOf(biz.id) + 1}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <div style={{ flex: 1, padding: "12px 14px 12px 0" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", fontFamily: "'DM Sans', sans-serif", marginBottom: 3 }}>{biz.name}</div>
              <div style={{ fontSize: 12, color: COLORS.textSecondary, fontFamily: "'DM Sans', sans-serif", marginBottom: 6 }}>{biz.type}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.neonYellow }}>{biz.price}</span>
                <span style={{ fontSize: 11, color: COLORS.textSecondary }}>·</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.neonGreen }}>{biz.payout[0]}–{biz.payout[6]}%</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        padding: "16px 20px 28px",
        background: "linear-gradient(0deg, rgba(10,10,20,0.98) 60%, transparent 100%)",
        backdropFilter: "blur(20px)", zIndex: 90,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
      }}>
        <div style={{ fontSize: 12, color: COLORS.textSecondary, fontFamily: "'DM Sans', sans-serif" }}>
          {selectedThree.length}/3 selected
        </div>
        <NeonButton onClick={onSendBack} disabled={selectedThree.length !== 3} color={COLORS.neonPurple} size="large" style={{ width: "100%", maxWidth: 360 }}>
          {selectedThree.length === 3 ? "SEND BACK MY TOP 3 →" : `Select ${3 - selectedThree.length} more`}
        </NeonButton>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════
// STEP 3: PICK THE FINAL 1
// ═══════════════════════════════════════════════════
function PickOneStep({ threeChoices, selectedOne, setSelectedOne, friend, onFinalize }: {
  threeChoices: DiscoveryBusiness[];
  selectedOne: string | null;
  setSelectedOne: (id: string) => void;
  friend: GameFriend;
  onFinalize: () => void;
}) {
  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", padding: "0 0 120px" }}>
      <div style={{ padding: "20px 20px 4px", textAlign: "center" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "10px 20px", borderRadius: 50,
          background: `${COLORS.neonGreen}10`, border: `1px solid ${COLORS.neonGreen}30`,
          marginBottom: 12,
        }}>
          <span style={{ fontSize: 18 }}>🔥</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.neonGreen, fontFamily: "'DM Sans', sans-serif" }}>
            {friend.name} narrowed it to 3!
          </span>
        </div>
        <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", fontFamily: "'Dela Gothic One', sans-serif", marginBottom: 6 }}>
          Make the Final Call
        </div>
        <div style={{ fontSize: 13, color: COLORS.textSecondary, fontFamily: "'DM Sans', sans-serif" }}>
          Choose where you&apos;re going tonight
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "20px 16px" }}>
        {threeChoices.map(biz => {
          const isSelected = selectedOne === biz.id;
          return (
            <button key={biz.id} onClick={() => setSelectedOne(biz.id)} style={{
              position: "relative", borderRadius: 20, overflow: "hidden",
              border: `2px solid ${isSelected ? COLORS.neonGreen : COLORS.cardBorder}`,
              background: COLORS.cardBg, cursor: "pointer",
              transition: "all 0.35s ease", textAlign: "left", padding: 0,
              boxShadow: isSelected ? `0 0 24px ${COLORS.neonGreen}30` : "none",
              transform: isSelected ? "scale(1.02)" : "scale(1)",
            }}>
              <div style={{ width: "100%", height: 160, position: "relative", overflow: "hidden" }}>
                <CardImageCarousel images={biz.images} gradient={getBusinessGradient(biz.id)} emoji={getBusinessEmoji(biz.type)} height={160} />
                {isSelected && (
                  <div style={{
                    position: "absolute", inset: 0, zIndex: 5, background: `${COLORS.neonGreen}15`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <div style={{
                      width: 56, height: 56, borderRadius: "50%",
                      background: COLORS.neonGreen, display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: `0 0 20px ${COLORS.neonGreen}`,
                    }}>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                  </div>
                )}
              </div>
              <div style={{ padding: "16px 18px" }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", fontFamily: "'DM Sans', sans-serif", marginBottom: 4 }}>{biz.name}</div>
                <div style={{ fontSize: 13, color: COLORS.textSecondary, fontFamily: "'DM Sans', sans-serif", marginBottom: 10 }}>{biz.type}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.neonYellow }}>{biz.price}</span>
                  <span style={{ fontSize: 13, color: COLORS.textSecondary }}>·</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.neonGreen }}>{biz.payout[0]}–{biz.payout[6]}%</span>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                  {biz.tags.map((t: string) => (
                    <span key={t} style={{
                      padding: "3px 10px", borderRadius: 50, fontSize: 10, fontWeight: 600,
                      background: `${COLORS.neonBlue}10`, border: `1px solid ${COLORS.neonBlue}20`,
                      color: COLORS.neonBlue, fontFamily: "'DM Sans', sans-serif",
                    }}>{t}</span>
                  ))}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        padding: "16px 20px 28px",
        background: "linear-gradient(0deg, rgba(10,10,20,0.98) 60%, transparent 100%)",
        backdropFilter: "blur(20px)", zIndex: 90,
        display: "flex", flexDirection: "column", alignItems: "center",
      }}>
        <NeonButton onClick={onFinalize} disabled={!selectedOne} color={COLORS.neonGreen} size="large" style={{ width: "100%", maxWidth: 360 }}>
          {selectedOne ? "LETSGO! 🎉" : "Choose your spot"}
        </NeonButton>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════
// STEP 4: RESULT — Final reveal
// ═══════════════════════════════════════════════════
function ResultStep({ business, friend, onPlayAgain, visitThresholds = DEFAULT_VISIT_THRESHOLDS }: { business: DiscoveryBusiness; friend: GameFriend; onPlayAgain: () => void; visitThresholds?: VisitThreshold[] }) {
  const resultRouter = useRouter();
  const [revealed, setRevealed] = useState(false);
  const [showPayouts, setShowPayouts] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [hearted, setHearted] = useState(false);
  const [heartLoading, setHeartLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setRevealed(true), 600);
    return () => clearTimeout(timer);
  }, []);

  // Check if already saved
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      if (!session?.user?.id) return;
      const { data } = await supabaseBrowser.from("user_followed_businesses").select("id").eq("user_id", session.user.id).eq("business_id", business.id).maybeSingle();
      if (data) setHearted(true);
    })();
  }, [business.id]);

  const toggleHeart = async () => {
    const { data: { session } } = await supabaseBrowser.auth.getSession();
    if (!session?.user?.id || heartLoading) return;
    setHeartLoading(true);
    const uid = session.user.id;
    if (hearted) {
      await supabaseBrowser.from("user_followed_businesses").delete().eq("user_id", uid).eq("business_id", business.id);
      setHearted(false);
    } else {
      await supabaseBrowser.from("user_followed_businesses").insert({ user_id: uid, business_id: business.id });
      setHearted(true);
    }
    setHeartLoading(false);
  };

  return (
    <div style={{
      flex: 1, minHeight: 0, display: "flex", flexDirection: "column", alignItems: "center",
      padding: "12px 16px", paddingBottom: "env(safe-area-inset-bottom, 32px)",
      overflowY: "auto",
      WebkitOverflowScrolling: "touch",
    }}>
      <style>{`
        @keyframes confettiDrop { 0% { transform: translateY(-100vh) rotate(0deg); opacity: 1; } 100% { transform: translateY(100vh) rotate(720deg); opacity: 0; } }
        @keyframes revealScale { 0% { transform: scale(0.8) rotate(-2deg); opacity: 0; } 60% { transform: scale(1.05) rotate(1deg); opacity: 1; } 100% { transform: scale(1) rotate(0deg); opacity: 1; } }
        @keyframes glowPulse { 0%, 100% { box-shadow: 0 0 30px rgba(57,255,20,0.2), 0 0 60px rgba(57,255,20,0.1); } 50% { box-shadow: 0 0 40px rgba(57,255,20,0.35), 0 0 80px rgba(57,255,20,0.15); } }
      `}</style>

      {revealed && (
        <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 200, overflow: "hidden" }}>
          {Array.from({ length: 40 }).map((_, i) => {
            const confettiColors = [NEON, COLORS.neonBlue, COLORS.neonGreen, COLORS.neonYellow, COLORS.neonPurple, COLORS.neonOrange];
            const color = confettiColors[i % confettiColors.length];
            const left = Math.random() * 100;
            const delay = Math.random() * 2;
            const dur = 2 + Math.random() * 2;
            const size = 4 + Math.random() * 8;
            return (
              <div key={i} style={{
                position: "absolute", left: `${left}%`, top: -20,
                width: size, height: size * 1.5, borderRadius: 2,
                background: color, opacity: 0.8,
                animation: `confettiDrop ${dur}s ease-in ${delay}s forwards`,
              }} />
            );
          })}
        </div>
      )}

      <div style={{
        display: "flex", alignItems: "center", gap: 8, marginBottom: 10,
        animation: revealed ? "revealScale 0.8s ease-out 0.2s forwards" : "none", opacity: revealed ? 1 : 0,
      }}>
        <span style={{ fontSize: 28 }}>🎉</span>
        <span style={{
          fontFamily: "'Dela Gothic One', sans-serif", fontSize: 18, color: COLORS.neonGreen,
          textShadow: `0 0 20px ${COLORS.neonGreen}50`,
        }}>IT&apos;S DECIDED!</span>
        <span style={{ fontSize: 28 }}>🎉</span>
      </div>
      <div style={{
        fontSize: 12, color: COLORS.textSecondary, fontFamily: "'DM Sans', sans-serif", marginBottom: 10, textAlign: "center",
        animation: revealed ? "revealScale 0.8s ease-out 0.3s forwards" : "none", opacity: revealed ? 1 : 0,
      }}>
        You and {friend.name} are heading to...
      </div>

      <div style={{
        width: "100%", maxWidth: 380, borderRadius: 24, overflow: "hidden",
        border: `2px solid ${COLORS.neonGreen}`, background: COLORS.cardBg,
        animation: revealed ? "revealScale 0.8s ease-out 0.4s forwards, glowPulse 3s ease-in-out infinite 1.2s" : "none",
        opacity: revealed ? 1 : 0,
      }}>
        <div style={{ width: "100%", height: 200, position: "relative", overflow: "hidden" }}>
          <CardImageCarousel images={business.images} gradient={getBusinessGradient(business.id)} emoji={getBusinessEmoji(business.type)} height={200} />
        </div>

        <div style={{ padding: "10px 14px 14px" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", fontFamily: "'DM Sans', sans-serif", marginBottom: 1 }}>{business.name}</div>
          <div style={{ fontSize: 12, color: COLORS.textSecondary, fontFamily: "'DM Sans', sans-serif", marginBottom: 8 }}>{business.type}</div>

          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <div style={{ padding: "5px 10px", borderRadius: 50, background: `${COLORS.neonYellow}10`, border: `1px solid ${COLORS.neonYellow}25`, fontSize: 11, fontWeight: 700, color: COLORS.neonYellow }}>{business.price}</div>
            <div style={{ padding: "5px 10px", borderRadius: 50, background: `${COLORS.neonGreen}10`, border: `1px solid ${COLORS.neonGreen}25`, fontSize: 11, fontWeight: 600, color: COLORS.neonGreen }}>{business.payout[0]}–{business.payout[6]}%</div>
            <div style={{
              display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 50,
              background: business.isOpen ? `${COLORS.neonGreen}10` : `${NEON}10`,
              border: `1px solid ${business.isOpen ? COLORS.neonGreen : NEON}25`,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: business.isOpen ? COLORS.neonGreen : NEON, boxShadow: `0 0 4px ${business.isOpen ? COLORS.neonGreen : NEON}` }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: business.isOpen ? COLORS.neonGreen : NEON }}>{business.isOpen ? "Open Now" : "Closed"}</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 14 }}>
            {business.tags.map(t => (
              <span key={t} style={{
                padding: "4px 10px", borderRadius: 50, fontSize: 10, fontWeight: 600,
                background: `${COLORS.neonBlue}10`, border: `1px solid ${COLORS.neonBlue}20`,
                color: COLORS.neonBlue, fontFamily: "'DM Sans', sans-serif",
              }}>{t}</span>
            ))}
          </div>

          <div style={{ display: "flex", gap: 6 }}>
            <NeonButton color={COLORS.neonGreen} size="small" style={{ flex: 1 }} onClick={() => {
              if (business.address) window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.address)}`, "_blank");
            }}>📍 Directions</NeonButton>
            <NeonButton color={COLORS.neonOrange} size="small" style={{ flex: 1 }} onClick={() => setShowPayouts(true)}>💰 Payouts</NeonButton>
            {business.phone && (
              <NeonButton color={COLORS.neonBlue} size="small" style={{ flex: 1 }} onClick={() => {
                window.open(`tel:${business.phone}`, "_self");
              }}>📞 Call</NeonButton>
            )}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <NeonButton color={NEON} size="small" style={{ flex: 1 }} onClick={() => setShowProfile(true)}>🌐 Full Profile</NeonButton>
            <NeonButton color={COLORS.neonPink} size="small" style={{ flex: 1 }} onClick={() => resultRouter.push(`/swipe?spotlight=${business.id}`)}>🔍 Discovery</NeonButton>
          </div>
        </div>
      </div>

      <div style={{
        display: "flex", alignItems: "center", gap: 12, marginTop: 12, width: "100%", maxWidth: 380,
        justifyContent: "center", flexWrap: "wrap",
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "7px 14px", borderRadius: 50,
          background: `${COLORS.neonPurple}08`, border: `1px solid ${COLORS.neonPurple}20`,
        }}>
          <span style={{ fontSize: 11, color: COLORS.textSecondary, fontFamily: "'DM Sans', sans-serif" }}>
            Played with <span style={{ color: COLORS.neonPurple, fontWeight: 700 }}>{friend.name}</span>
          </span>
        </div>
        <NeonButton onClick={onPlayAgain} size="small">🔄 PLAY AGAIN</NeonButton>
      </div>

      {/* Would Go Again heart button */}
      <div style={{
        marginTop: 10, width: "100%", maxWidth: 380,
        animation: revealed ? "revealScale 0.8s ease-out 0.8s forwards" : "none", opacity: revealed ? 1 : 0,
      }}>
        <button onClick={toggleHeart} disabled={heartLoading} style={{
          width: "100%", padding: "12px 0", borderRadius: 50, cursor: "pointer",
          border: `1px solid ${hearted ? COLORS.neonPink + "40" : "rgba(255,255,255,0.1)"}`,
          background: hearted ? `${COLORS.neonPink}12` : "rgba(255,255,255,0.03)",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          transition: "all 0.3s ease",
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill={hearted ? COLORS.neonPink : "none"} stroke={hearted ? COLORS.neonPink : "rgba(255,255,255,0.3)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: hearted ? `drop-shadow(0 0 6px ${COLORS.neonPink})` : "none", transition: "all 0.3s ease" }}>
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          <span style={{
            fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const,
            fontFamily: "'DM Sans', sans-serif",
            color: hearted ? COLORS.neonPink : "rgba(255,255,255,0.4)",
          }}>
            {hearted ? "Saved — Would Go Again!" : "Would Go Again?"}
          </span>
        </button>
      </div>

      {/* ── Payout Ladder Modal ── */}
      {showPayouts && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 300,
          background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 20,
        }} onClick={() => setShowPayouts(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            width: "100%", maxWidth: 400, maxHeight: "80vh", overflowY: "auto",
            background: COLORS.cardBg, borderRadius: 20,
            border: `1px solid ${COLORS.cardBorder}`, padding: "24px 20px",
          }}>
            <div style={{
              textAlign: "center", fontSize: 10, fontWeight: 700, letterSpacing: "0.2em",
              color: COLORS.textSecondary, textTransform: "uppercase" as const,
              fontFamily: "'DM Sans', sans-serif", marginBottom: 20,
            }}>Progressive Payout Ladder</div>
            {(() => {
              const TIER_LABELS = visitThresholds.map((t) => t.label);
              const TIER_COLORS = [COLORS.textSecondary, COLORS.neonBlue, COLORS.neonGreen, COLORS.neonYellow, COLORS.neonOrange, COLORS.neonPurple, COLORS.neonPink];
              const TIER_VISITS = visitThresholds.map((t) => getVisitRangeLabel(t));
              return business.payout.map((pct, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 14px", borderRadius: 12, marginBottom: 8,
                  background: `${TIER_COLORS[i]}08`,
                  border: `1px solid ${TIER_COLORS[i]}20`,
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: `${TIER_COLORS[i]}15`, fontSize: 13, fontWeight: 800,
                    color: TIER_COLORS[i], fontFamily: "'DM Sans', sans-serif",
                  }}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", fontFamily: "'DM Sans', sans-serif" }}>
                      Level {i + 1} <span style={{ color: TIER_COLORS[i] }}>({TIER_LABELS[i]})</span>
                    </div>
                    <div style={{ fontSize: 10, color: COLORS.textSecondary, fontFamily: "'DM Sans', sans-serif" }}>{TIER_VISITS[i]}</div>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: TIER_COLORS[i], fontFamily: "'DM Sans', sans-serif" }}>{pct}%</div>
                </div>
              ));
            })()}
            <div style={{
              marginTop: 12, padding: "10px 14px", borderRadius: 10,
              background: `${COLORS.neonBlue}08`, border: `1px solid ${COLORS.neonBlue}15`,
              fontSize: 10, color: COLORS.textSecondary, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5,
            }}>
              Only verified receipts count towards visit totals &amp; progressive payouts.
              Payout is based on the receipt subtotal before tax &amp; tip.
            </div>
            <NeonButton color={COLORS.textSecondary} size="small" style={{ width: "100%", marginTop: 14 }} onClick={() => setShowPayouts(false)}>Close</NeonButton>
          </div>
        </div>
      )}

      {/* ── Full Profile Modal (discovery-style) ── */}
      {showProfile && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 300,
          background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 20,
        }} onClick={() => setShowProfile(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            width: "100%", maxWidth: 420, maxHeight: "85vh", overflowY: "auto",
            background: COLORS.cardBg, borderRadius: 20,
            border: `1px solid ${COLORS.cardBorder}`, padding: 0,
          }}>
            {/* Hero image / gradient */}
            <div style={{ position: "relative" }}>
              <CardImageCarousel images={business.images} gradient={getBusinessGradient(business.id)} emoji={getBusinessEmoji(business.type)} height={180} />
              <button onClick={() => setShowProfile(false)} style={{
                position: "absolute", top: 12, right: 12, zIndex: 10,
                width: 32, height: 32, borderRadius: 50,
                background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.2)",
                color: "#fff", fontSize: 16, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>✕</button>
            </div>
            <div style={{ padding: "16px 20px 20px" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", fontFamily: "'DM Sans', sans-serif", marginBottom: 2 }}>{business.name}</div>
              <div style={{ fontSize: 12, color: COLORS.textSecondary, fontFamily: "'DM Sans', sans-serif", marginBottom: 12 }}>{business.type}</div>

              <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                <span style={{ padding: "4px 10px", borderRadius: 50, background: `${COLORS.neonYellow}10`, border: `1px solid ${COLORS.neonYellow}25`, fontSize: 11, fontWeight: 700, color: COLORS.neonYellow }}>{business.price}</span>
                <span style={{ padding: "4px 10px", borderRadius: 50, background: `${COLORS.neonGreen}10`, border: `1px solid ${COLORS.neonGreen}25`, fontSize: 11, fontWeight: 600, color: COLORS.neonGreen }}>{business.payout[0]}–{business.payout[6]}%</span>
                <span style={{
                  display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 50,
                  background: business.isOpen ? `${COLORS.neonGreen}10` : `${NEON}10`,
                  border: `1px solid ${business.isOpen ? COLORS.neonGreen : NEON}25`,
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: business.isOpen ? COLORS.neonGreen : NEON }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: business.isOpen ? COLORS.neonGreen : NEON }}>{business.isOpen ? "Open" : "Closed"}</span>
                </span>
              </div>

              {business.slogan && (
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5, marginBottom: 14, fontStyle: "italic" }}>
                  &ldquo;{business.slogan}&rdquo;
                </div>
              )}

              {business.address && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 14 }}>📍</span>
                  <span style={{ fontSize: 12, color: COLORS.textSecondary, fontFamily: "'DM Sans', sans-serif" }}>{business.address}</span>
                </div>
              )}
              {business.phone && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 14 }}>📞</span>
                  <span style={{ fontSize: 12, color: COLORS.textSecondary, fontFamily: "'DM Sans', sans-serif" }}>{business.phone}</span>
                </div>
              )}
              {business.website && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 14 }}>🌐</span>
                  <a href={business.website.startsWith("http") ? business.website : `https://${business.website}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: COLORS.neonBlue, fontFamily: "'DM Sans', sans-serif" }}>{business.website}</a>
                </div>
              )}

              {business.tags.length > 0 && (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 12, marginBottom: 14 }}>
                  {business.tags.map(t => (
                    <span key={t} style={{
                      padding: "3px 10px", borderRadius: 50, fontSize: 10, fontWeight: 600,
                      background: `${COLORS.neonBlue}10`, border: `1px solid ${COLORS.neonBlue}20`,
                      color: COLORS.neonBlue, fontFamily: "'DM Sans', sans-serif",
                    }}>{t}</span>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
                <NeonButton color={COLORS.neonGreen} size="small" style={{ flex: 1 }} onClick={() => {
                  if (business.address) window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.address)}`, "_blank");
                }}>📍 Directions</NeonButton>
                {business.phone && (
                  <NeonButton color={COLORS.neonBlue} size="small" style={{ flex: 1 }} onClick={() => window.open(`tel:${business.phone}`, "_self")}>📞 Call</NeonButton>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════
// MAIN PAGE CONTROLLER
// ═══════════════════════════════════════════════════
export default function FiveThreeOnePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a14]" />}>
      <FiveThreeOne />
    </Suspense>
  );
}

function FiveThreeOne() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [visitThresholds, setVisitThresholds] = useState<VisitThreshold[]>(DEFAULT_VISIT_THRESHOLDS);
  const [authChecked, setAuthChecked] = useState(false);

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

  useEffect(() => {
    fetchPlatformTierConfig(supabaseBrowser).then((cfg) => setVisitThresholds(cfg.visitThresholds));
  }, []);

  const [step, setStep] = useState(0);
  const [viewMode, setViewMode] = useState<"player1" | "player2">("player1");
  const [filters, setFilters] = useState<FilterState>({
    categories: ["All"], price: "Any", openNow: false, distance: 15, tags: [],
  });
  const [selectedFriend, setSelectedFriend] = useState<GameFriend | null>(null);
  const [selectedFive, setSelectedFive] = useState<string[]>([]);
  const [selectedThree, setSelectedThree] = useState<string[]>([]);
  const [selectedOne, setSelectedOne] = useState<string | null>(null);

  // Location state (lifted from SetupStep so PickFiveStep can use it)
  const [locationZip, setLocationZip] = useState("");

  // Real data state
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [businesses, setBusinesses] = useState<DiscoveryBusiness[]>([]);
  const [bizLoading, setBizLoading] = useState(true);
  const [gameSession, setGameSession] = useState<GameSession | null>(null);
  const [activeGames, setActiveGames] = useState<{ id: string; game_code: string; opponentName: string | null; status: string; created_at: string; role: "p1" | "p2" }[]>([]);

  // ─── Toast notification state ───
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (message: string, type: "error" | "success" = "error") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  };

  // ─── Onboarding tour ───
  const fiveTourSteps: TourStep[] = useMemo(() => [
    { target: '[data-tour="531-tab-category"]', title: "Select a Category", description: "Pick what you're in the mood for — restaurants, bars, activities, or surprise me with everything.", position: "bottom" },
    { target: '[data-tour="531-tab-filters"]', title: "Set Your Filters", description: "Dial in your distance, price range, and vibe. We'll only show places that match.", position: "bottom" },
    { target: '[data-tour="531-tab-friend"]', title: "Choose a Friend", description: "Pick a friend to play with. They'll get notified and can join your game.", position: "bottom" },
    { target: '[data-tour="531-step-pick5"]', title: "Pick 5 Spots", description: "Browse nearby places and pick your top 5. These get sent to your friend to narrow down.", position: "bottom" },
    { target: '[data-tour="531-step-wait"]', title: "Play Mini Games", description: "While you wait for your friend, kill time with quick mini games — emoji catcher, trivia, memory match, and more.", position: "bottom" },
    { target: '[data-tour="531-step-wait"]', title: "Player 2 Picks 3", description: "Your friend sees your 5 picks and chooses their top 3. Then it's back to you.", position: "bottom" },
    { target: '[data-tour="531-step-pick1"]', title: "Pick the Winner", description: "Three spots left. One final choice. Tap the place you want to go.", position: "bottom" },
    { target: '[data-tour="531-step-result"]', title: "The Big Reveal", description: "It's decided! See the winner with directions, payout info, and everything you need.", position: "bottom" },
    { target: '[data-tour="531-tab-history"]', title: "Game History", description: "All your past games live here. Revisit spots, save favorites, or start a rematch.", position: "bottom" },
  ], []);
  const fiveTourIllustrations: React.ReactNode[] = useMemo(() => [
    <CategoryGridAnim key="cg" />,
    <FilterAnim key="fa" />,
    <FriendSelectAnim key="fs" />,
    <PickFiveAnim key="p5" />,
    <MiniGamesAnim key="mg" />,
    <FunnelGameAnim key="fg" />,
    <PickWinnerAnim key="pw" />,
    <CelebrationAnim key="cel" />,
    <GameHistoryAnim key="gh" />,
  ], []);
  const tour = useOnboardingTour("5v3v1", fiveTourSteps, 1000);

  // ─── API helper (defined early so useEffects can reference it) ───
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const getToken = (): string | null => sessionToken;

  // ─── Auth check ───
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      if (!session?.access_token) { setAuthLoading(false); return; }
      setSessionToken(session.access_token);
      const { data: { user: u } } = await supabaseBrowser.auth.getUser(session.access_token);
      if (u) {
        setUser({ id: u.id });
        // Fetch user's saved zip code as default location
        const { data: profile } = await supabaseBrowser
          .from("profiles")
          .select("zip_code")
          .eq("id", u.id)
          .maybeSingle();
        if (profile?.zip_code) setLocationZip(profile.zip_code);
      }
      setAuthLoading(false);
    })();
  }, []);

  // ─── Fetch businesses ───
  useEffect(() => {
    if (!user) return;
    (async () => {
      setBizLoading(true);
      const { data: rows } = await supabaseBrowser
        .from("business")
        .select("*")
        .eq("is_active", true)
        .limit(200);

      if (!rows || rows.length === 0) { setBizLoading(false); return; }

      const bizIds = rows.map((r: BusinessRow) => r.id);
      const [{ data: mediaRows }, { data: tierRows }] = await Promise.all([
        supabaseBrowser.from("business_media").select("business_id, bucket, path, sort_order, caption, meta").in("business_id", bizIds).eq("is_active", true).eq("media_type", "photo").order("sort_order", { ascending: true }),
        supabaseBrowser
          .from("business_payout_tiers")
          .select("business_id, percent_bps, tier_index")
          .in("business_id", bizIds)
          .order("tier_index", { ascending: true }),
      ]);

      // Group payout tiers by business_id
      const tierMap = new Map<string, number[]>();
      for (const t of (tierRows ?? []) as { business_id: string; percent_bps: number }[]) {
        if (!tierMap.has(t.business_id)) tierMap.set(t.business_id, []);
        tierMap.get(t.business_id)!.push(Number(t.percent_bps) || 0);
      }

      const normalized = rows.map((r: BusinessRow) => {
        const media = (mediaRows ?? []).filter((m: MediaRow) => m.business_id === r.id);
        return normalizeToDiscoveryBusiness(r, media, tierMap.get(r.id));
      });
      setBusinesses(normalized);
      setBizLoading(false);
    })();
  }, [user]);

  // ─── Fetch active (in-progress) games for rejoin/incoming banner ───
  useEffect(() => {
    if (!user) return;
    (async () => {
      const token = getToken();
      if (!token) return;
      const res = await fetch("/api/games", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const { games } = await res.json();
      type GameWithNames = GameSession & { player1Name?: string | null; player2Name?: string | null };
      const inProgress = (games ?? []).filter(
        (g: GameWithNames) => g.status !== "complete" && g.status !== "expired"
      );
      setActiveGames(inProgress.map((g: GameWithNames) => {
        const isP1 = g.player1_id === user.id;
        return {
          id: g.id,
          game_code: g.game_code,
          opponentName: isP1 ? (g.player2Name ?? null) : (g.player1Name ?? null),
          status: g.status,
          created_at: g.created_at,
          role: isP1 ? "p1" as const : "p2" as const,
        };
      }));
    })();
  }, [user, step]); // re-fetch when returning to setup

  // ─── Supabase Realtime: listen for game session updates ───
  useEffect(() => {
    if (!gameSession) return;
    const channel = supabaseBrowser
      .channel(`game-${gameSession.id}`)
      .on(
        "postgres_changes" as "system",
        { event: "UPDATE", schema: "public", table: "game_sessions", filter: `id=eq.${gameSession.id}` },
        (payload: { new: GameSession }) => {
          const updated = payload.new;
          setGameSession(updated);

          // Auto-advance steps based on status changes
          if (updated.status === "pick3" && viewMode === "player1" && step === 2) {
            // P2 joined and P1's pick5 was submitted — now waiting for P2's pick3
            // (stay on waiting step — P2 needs to pick 3)
          }
          if (updated.status === "pick1" && viewMode === "player1") {
            // P2 submitted pick3 — advance P1 to pick 1
            setSelectedThree(updated.pick3_ids ?? []);
            setStep(3);
          }
          if (updated.status === "complete") {
            // Game complete — both players see result
            setSelectedOne(updated.pick1_id);
            setStep(4);
          }
          // P2 joined
          if (updated.player2_id && !gameSession.player2_id) {
            setGameSession(updated);
          }
        }
      )
      .subscribe();

    return () => { supabaseBrowser.removeChannel(channel); };
  }, [gameSession?.id, viewMode, step]);

  // ─── Join via URL ?code= param only (explicit rejoin / P2 invite link) ───
  useEffect(() => {
    if (!user || bizLoading) return;
    const urlCode = searchParams?.get("code");
    if (!urlCode) return;

    (async () => {
      const token = getToken();
      if (!token) return;

      // Try joining as P2 via shared link first
      const joinRes = await fetch("/api/games/join", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ gameCode: urlCode }),
      });
      if (joinRes.ok) {
        const { gameSession: gs } = await joinRes.json();
        // Look up opponent (P1) name for friend display
        const opponentId = gs.player1_id;
        setSelectedFriend({
          friendshipId: "", id: opponentId,
          name: "Friend", username: null, avatarUrl: null, status: "online",
        });
        setGameSession(gs);
        setSelectedFive(gs.pick5_ids ?? []);
        setSelectedThree(gs.pick3_ids ?? []);
        setViewMode("player2");
        return;
      }

      // If join fails, try to rejoin an existing game by code
      type GameWithNames = GameSession & { player1Name?: string | null; player2Name?: string | null };
      const listRes = await fetch("/api/games", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!listRes.ok) { showToast("Failed to load games. Please try again."); return; }
      const { games } = await listRes.json();
      const gs = (games ?? [] as GameWithNames[]).find((g: GameWithNames) => g.game_code === urlCode && g.status !== "complete" && g.status !== "expired");
      if (!gs) { showToast("Game not found or has expired."); return; }

      // Check expiration
      if (gs.expires_at && new Date(gs.expires_at) < new Date()) return;

      const isP1 = gs.player1_id === user.id;
      const opponentId = isP1 ? gs.player2_id : gs.player1_id;
      const opponentName = isP1 ? gs.player2Name : gs.player1Name;
      restoreGameState(gs, opponentId ? { id: opponentId, name: opponentName ?? "Friend" } : undefined);
    })();
  }, [user, bizLoading, searchParams]);

  // Restore game state helper — used by URL rejoin and active games banner
  // opponentInfo is optional — pass it when available from the games list API
  const restoreGameState = (gs: GameSession, opponentInfo?: { id: string; name: string }) => {
    setGameSession(gs);
    const isP1 = gs.player1_id === user?.id;

    // Set the opponent as selectedFriend so WaitingStep/ResultStep can render
    if (opponentInfo) {
      setSelectedFriend({
        friendshipId: "",
        id: opponentInfo.id,
        name: opponentInfo.name,
        username: null,
        avatarUrl: null,
        status: "online",
      });
    }

    setSelectedFive(gs.pick5_ids ?? []);
    setSelectedThree(gs.pick3_ids ?? []);
    if (gs.pick1_id) setSelectedOne(gs.pick1_id);

    if (gs.status === "pending") { setStep(0); }
    else if (gs.status === "pick5") { setStep(isP1 ? 1 : 0); }
    else if (gs.status === "pick3") {
      if (isP1) { setStep(2); }
      else { setViewMode("player2"); }
    }
    else if (gs.status === "pick1") { setStep(isP1 ? 3 : 2); }
    else if (gs.status === "complete") { setStep(4); }
  };

  const fiveBusinesses = businesses.filter(b => selectedFive.includes(b.id));
  const threeBusinesses = businesses.filter(b => selectedThree.includes(b.id));
  const finalBusiness = businesses.find(b => b.id === selectedOne);


  const createGame = async (): Promise<GameSession | null> => {
    const token = getToken();
    if (!token || !selectedFriend) {
      showToast("You must be signed in to create a game.");
      return null;
    }
    try {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          gameType: "5v3v1",
          category: filters.categories.filter(c => c !== "All").join(",") || null,
          filters,
          friendId: selectedFriend.id,
        }),
      });
      if (!res.ok) {
        showToast("Failed to create game. Please try again.");
        return null;
      }
      const { gameSession: gs } = await res.json();
      setGameSession(gs);
      return gs as GameSession;
    } catch {
      showToast("Network error. Check your connection and try again.");
      return null;
    }
  };

  const submitPicks = async (action: string, picks: string[], sessionOverride?: GameSession): Promise<boolean> => {
    const token = getToken();
    const session = sessionOverride ?? gameSession;
    if (!token || !session) {
      showToast("Session expired. Please refresh and try again.");
      return false;
    }
    try {
      const res = await fetch(`/api/games/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, picks }),
      });
      if (!res.ok) {
        showToast("Failed to submit your picks. Please try again.");
        return false;
      }
      const { gameSession: gs } = await res.json();
      setGameSession(gs);
      return true;
    } catch {
      showToast("Network error. Check your connection and try again.");
      return false;
    }
  };

  const handleReset = () => {
    setStep(0);
    setViewMode("player1");
    setFilters({ categories: ["All"], price: "Any", openNow: false, distance: 15, tags: [] });
    setSelectedFriend(null);
    setSelectedFive([]);
    setSelectedThree([]);
    setSelectedOne(null);
    setGameSession(null);
    localStorage.removeItem("letsgo-game-active");
  };

  const titleByStep = [
    "✦  5 v 3 v 1",
    "✦  P I C K  5",
    "✦  S E N T",
    "✦  P I C K  1",
    "✦  R E S U L T",
  ];

  const subtitleByStep = [
    "Set up your game",
    selectedFriend ? `Sending to ${selectedFriend.name}` : "",
    selectedFriend ? `Waiting on ${selectedFriend.name}` : "",
    selectedFriend ? `${selectedFriend.name} chose 3 — your turn` : "",
    "",
  ];

  if (!authChecked) return <div style={{ minHeight: "100vh", background: COLORS.darkBg }} />;

  return (
    <div style={{
      width: "100%", height: "100dvh", background: COLORS.darkBg,
      position: "relative", overflow: "hidden",
      fontFamily: "'DM Sans', sans-serif",
      display: "flex", flexDirection: "column",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Dela+Gothic+One&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400&display=swap" rel="stylesheet" />
      <link href="https://api.fontshare.com/v2/css?f[]=clash-display@700,600,500&display=swap" rel="stylesheet" />

      <FloatingOrbs />

      {/* Toast notification */}
      {toast && (
        <div style={{
          position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
          zIndex: 999, maxWidth: 360, width: "calc(100% - 32px)",
          padding: "12px 16px", borderRadius: 12,
          background: toast.type === "error" ? "rgba(255,49,49,0.15)" : "rgba(57,255,20,0.15)",
          border: `1px solid ${toast.type === "error" ? "rgba(255,49,49,0.4)" : "rgba(57,255,20,0.4)"}`,
          backdropFilter: "blur(16px)",
          display: "flex", alignItems: "center", gap: 10,
          fontFamily: "'DM Sans', sans-serif",
          animation: "fadeSlideIn 0.3s ease-out",
        }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>{toast.type === "error" ? "⚠" : "✓"}</span>
          <span style={{
            fontSize: 13, fontWeight: 600, flex: 1,
            color: toast.type === "error" ? "#ff6b6b" : COLORS.neonGreen,
          }}>{toast.message}</span>
          <button onClick={() => setToast(null)} style={{
            background: "none", border: "none", color: "rgba(255,255,255,0.4)",
            fontSize: 16, cursor: "pointer", padding: 0, flexShrink: 0,
          }}>✕</button>
        </div>
      )}
      <style>{`@keyframes fadeSlideIn { from { opacity: 0; transform: translateX(-50%) translateY(-10px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }`}</style>

      <NeonHeader
        title={viewMode === "player2" ? "✦  P I C K  3" : titleByStep[step]}
        subtitle={viewMode === "player2" ? "Your friend needs your help!" : subtitleByStep[step]}
        onBack={() => {
          // Back button always goes home
          router.push("/");
        }}
        rightAction={
          step === 0 ? (
            <button onClick={() => {
              if (viewMode === "player1" && selectedFive.length === 5 && selectedFriend) {
                setViewMode("player2");
              }
            }} style={{
              padding: "8px 12px", borderRadius: 6,
              border: `1px solid ${COLORS.neonPurple}30`,
              background: `${COLORS.neonPurple}10`,
              color: COLORS.neonPurple, fontSize: 10, fontWeight: 700,
              cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
              letterSpacing: "0.05em", display: viewMode === "player1" && step === 0 ? "none" : "block",
            }}>P2 VIEW</button>
          ) : null
        }
      />

      <StepIndicator currentStep={viewMode === "player2" ? (selectedThree.length === 3 ? 1 : 0) : step} isPlayer2={viewMode === "player2"} />

      {viewMode === "player1" && step === 0 && (
        <SetupStep
          filters={filters} setFilters={setFilters}
          selectedFriend={selectedFriend} setSelectedFriend={setSelectedFriend}
          onNext={() => setStep(1)}
          activeGames={activeGames}
          locationZip={locationZip} setLocationZip={setLocationZip}
          onRejoin={(code) => {
            const token = getToken();
            if (!token) { showToast("Session expired. Please refresh."); return; }
            type GameWithNames = GameSession & { player1Name?: string | null; player2Name?: string | null };
            fetch("/api/games", { headers: { Authorization: `Bearer ${token}` } })
              .then(r => {
                if (!r.ok) throw new Error("fetch failed");
                return r.json();
              })
              .then(({ games }) => {
                const gs = (games ?? [] as GameWithNames[]).find((g: GameWithNames) => g.game_code === code && g.status !== "complete" && g.status !== "expired");
                if (gs) {
                  localStorage.setItem("letsgo-game-active", code);
                  const isP1 = gs.player1_id === user?.id;
                  const opponentId = isP1 ? gs.player2_id : gs.player1_id;
                  const opponentName = isP1 ? gs.player2Name : gs.player1Name;
                  restoreGameState(gs, opponentId ? { id: opponentId, name: opponentName ?? "Friend" } : undefined);
                } else {
                  showToast("Game not found or has expired.");
                }
              })
              .catch(() => { showToast("Failed to rejoin game. Please try again."); });
          }}
          onCancel={async (gameId: string) => {
            const token = getToken();
            if (!token) return;
            try {
              const res = await fetch(`/api/games/${gameId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
              });
              if (!res.ok) {
                showToast("Failed to cancel game. Please try again.");
                return;
              }
              setActiveGames(prev => prev.filter(g => g.id !== gameId));
              localStorage.removeItem("letsgo-game-active");
            } catch {
              showToast("Network error. Could not cancel game.");
            }
          }}
        />
      )}
      {viewMode === "player1" && step === 1 && selectedFriend && (
        <PickFiveStep
          selectedIds={selectedFive} setSelectedIds={setSelectedFive}
          onSend={async () => {
            // Create game session if not already created
            let session = gameSession;
            if (!session) session = await createGame();
            if (!session) return;
            // Submit pick5
            const ok = await submitPicks("pick5", selectedFive, session);
            if (!ok) return;
            // Store active game for rejoin
            localStorage.setItem("letsgo-game-active", session.game_code);
            setStep(2);
          }}
          friend={selectedFriend}
          businesses={businesses}
          locationZip={locationZip}
          filters={filters}
        />
      )}
      {viewMode === "player1" && step === 2 && selectedFriend && (
        <WaitingStep
          friend={selectedFriend}
          gameCode={gameSession?.game_code ?? ""}
          p2Joined={!!gameSession?.player2_id}
          gameSessionId={gameSession?.id ?? null}
          onGameAdvanced={(gs) => {
            setGameSession(gs);
            const isP1 = gs.player1_id === user?.id;
            if (gs.status === "pick1" && isP1) {
              setSelectedThree(gs.pick3_ids ?? []);
              setStep(3);
            } else if (gs.status === "complete") {
              setSelectedOne(gs.pick1_id);
              setStep(4);
            }
          }}
          onBackToSetup={() => {
            setStep(0);
            setSelectedFriend(null);
            setSelectedFive([]);
            setSelectedThree([]);
            setSelectedOne(null);
            setGameSession(null);
          }}
          authToken={sessionToken}
        />
      )}
      {viewMode === "player1" && step === 3 && selectedFriend && (
        <PickOneStep
          threeChoices={threeBusinesses}
          selectedOne={selectedOne} setSelectedOne={setSelectedOne}
          friend={selectedFriend}
          onFinalize={async () => {
            if (selectedOne) {
              const ok = await submitPicks("pick1", [selectedOne]);
              if (!ok) return;
            }
            setStep(4);
          }}
        />
      )}
      {viewMode === "player1" && step === 4 && finalBusiness && selectedFriend && (
        <ResultStep business={finalBusiness} friend={selectedFriend} onPlayAgain={handleReset} visitThresholds={visitThresholds} />
      )}

      {viewMode === "player2" && (
        <PickThreeStep
          fiveChoices={fiveBusinesses}
          selectedThree={selectedThree} setSelectedThree={setSelectedThree}
          sender={selectedFriend?.name ?? "Your Friend"}
          onSendBack={async () => {
            const ok = await submitPicks("pick3", selectedThree);
            if (!ok) return;
            // P2 now waits for P1 to pick 1 — Realtime will handle the update
            setViewMode("player1");
            setStep(2);
          }}
        />
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
          illustration={tour.stepIndex >= 0 ? fiveTourIllustrations[tour.stepIndex] : undefined}
        />
      )}

      <style>{`
        ::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
