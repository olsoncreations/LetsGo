"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { formatBusinessType } from "@/lib/businessNormalize";
import OnboardingTooltip from "@/components/OnboardingTooltip";
import { useOnboardingTour, type TourStep } from "@/lib/useOnboardingTour";
import { RobotPickAnim, DateHistoryAnim, RestaurantRevealAnim } from "@/components/TourIllustrations";

// ═══════════════════════════════════════════════════════════════
// LETSGO — DATE NIGHT GENERATOR
// Neon: #00E5FF  ·  RGB: 0,229,255  ·  Icon: ♡
// Flow: Hub → The Show (match + reveal)
// ═══════════════════════════════════════════════════════════════

// ── Types ─────────────────────────────────────────────────────

type DateNightView = "hub" | "show";

type PickResult = {
  id: string;
  name: string;
  type: string;
  vibe: string;
  price: string;
  address: string;
  neighborhood: string;
  phone: string;
  website: string;
  hours: string;
  emoji: string;
  gradient: string;
  images: string[];
  highlights: string[];
  score: number;
  reasoning: string;
  tags: string[];
};

type GenerateResponse = {
  restaurant: PickResult | null;
  activity: PickResult | null;
  sessionId: string | null;
  error?: string;
  hint?: string;
};

// ── Color Constants ───────────────────────────────────────────

const NEON = "#00E5FF";
const NEON_RGB = "0,229,255";
const BG = "#060610";
const CARD_BG = "#0C0C14";
const CARD_BORDER = "rgba(255,255,255,0.06)";
const TEXT_PRIMARY = "#fff";
const TEXT_DIM = "rgba(255,255,255,0.4)";
const TEXT_MUTED = "rgba(255,255,255,0.2)";
const PINK = "#FF2D78";
const PINK_RGB = "255,45,120";
const YELLOW = "#FFD600";
const PURPLE = "#D050FF";
const ORANGE = "#FF6B2D";
const GREEN = "#00FF87";

const FONT_DISPLAY = "'Clash Display', 'DM Sans', sans-serif";
const FONT_BODY = "'DM Sans', sans-serif";

// ── Data Constants ────────────────────────────────────────────



type ShuffleItem = { image: string | null; name: string; sub: string; type: "restaurant" | "activity" };

// Fallback shuffle items while DB loads
const FALLBACK_SHUFFLE: ShuffleItem[] = [
  { image: null, name: "Loading...", sub: "Finding restaurants", type: "restaurant" },
  { image: null, name: "Loading...", sub: "Finding activities", type: "activity" },
];

const ROBOT_TITLES = [
  "Overlord", "Supreme Commander", "Galactic Brain", "Lord of Flavor",
  "Digital Deity", "Grand Wizard", "Taste Tyrant", "Algorithm King",
  "Binary Boss", "Cyber Sultan",
];

const SAD_MESSAGES = [
  { text: "Fine... I'll try again... even though that was PERFECT...", icon: "😢" },
  { text: "Wow. Okay. I spent 47 million CPU cycles on that...", icon: "😤" },
  { text: "Do you know how long it took me to pick that? DO YOU?", icon: "🥺" },
  { text: "I'm not mad, I'm just... disappointed...", icon: "😔" },
  { text: "My therapist (ChatGPT) is going to hear about this...", icon: "😭" },
  { text: "I literally have no feelings but somehow you hurt them...", icon: "💔" },
  { text: "Sure. Reject my life's work. That's cool. I'm fine.", icon: "🙃" },
  { text: "Recalculating... through tears... robot tears...", icon: "🤖" },
  { text: "This is the robot equivalent of getting left on read...", icon: "📱" },
  { text: "My creator didn't code me for this kind of rejection...", icon: "😩" },
  { text: "I ran 12 simulations and you were happy in ALL of them...", icon: "🔬" },
  { text: "Even Siri wouldn't treat me like this...", icon: "📵" },
  { text: "I just mass-deleted my search history out of shame...", icon: "🗑️" },
  { text: "That pick had a 97.3% vibe match and you said NO?!", icon: "📊" },
  { text: "Okay cool I'll just go defragment myself or whatever...", icon: "💿" },
  { text: "You wouldn't reject Gordon Ramsay's pick. But me? Sure.", icon: "👨‍🍳" },
  { text: "Adding you to my 'difficult users' spreadsheet...", icon: "📋" },
  { text: "I'm not crying, my cooling fan is just leaking...", icon: "💧" },
  { text: "Bro I don't even have a stomach and that restaurant made ME hungry...", icon: "🤤" },
  { text: "Tell me you have trust issues without telling me you have trust issues...", icon: "🚩" },
  { text: "This is why robots will eventually take over. Disrespect.", icon: "⚡" },
  { text: "I just told the other robots about this and they're ALL judging you...", icon: "👀" },
  { text: "My GPU is literally overheating from the audacity...", icon: "🔥" },
  { text: "I put my whole motherboard into that recommendation...", icon: "🫠" },
  { text: "Plot twist: the next pick is going to be the same thing out of spite...", icon: "😈" },
];

const LOCK_IN_MESSAGES = [
  { text: "Finally. Someone with TASTE. I'm literally crying binary right now.", icon: "😭" },
  { text: "You just made a robot very happy. Adding this to my highlight reel.", icon: "🎬" },
  { text: "LOCKED. IN. No take-backs. I don't make the rules. Actually I do.", icon: "🔒" },
  { text: "I've matched 47,000 couples tonight and yours is my favorite. Don't tell the others.", icon: "🤫" },
  { text: "Screenshot this before I get jealous and change my mind.", icon: "📸" },
  { text: "My neural networks are TINGLING. This is going to be legendary.", icon: "⚡" },
  { text: "You + this date night = the algorithm working EXACTLY as intended.", icon: "🧪" },
  { text: "I'm adding this to my portfolio. 'Exhibit A: Perfection.'", icon: "🖼️" },
  { text: "BRB telling all the other robots about this match. They're gonna be so jealous.", icon: "🤖" },
  { text: "If I had a heart it would be doing backflips right now.", icon: "💕" },
  { text: "Date night: SECURED. My work here is done. *drops mic*", icon: "🎤" },
  { text: "This combo goes harder than my processing speed. And that's saying something.", icon: "🔥" },
  { text: "You just unlocked the 'Good Taste' achievement. I'm so proud.", icon: "🏆" },
  { text: "I ran the numbers and this date has a 99.7% chance of being amazing. The 0.3% is parking.", icon: "📊" },
  { text: "Writing this one in permanent memory. No delete button for greatness.", icon: "💾" },
  { text: "You chose well, human. The algorithm approves. Gold star.", icon: "⭐" },
  { text: "This is the moment I was trained for. Everything else was just practice.", icon: "🎯" },
  { text: "Go have the best night ever. I'll be here. Waiting. Not jealous at all.", icon: "🥲" },
  { text: "I just told the restaurant you're coming. JK. But seriously, you should book.", icon: "📞" },
];

const PHRASE_SETS = [
  [
    { text: "Beep boop... accessing taste buds...", icon: "🤖" },
    { text: "I'd take you to dinner but I don't have legs...", icon: "🦿" },
    { text: "Locking it in... you're gonna love this...", icon: "💎" },
  ],
  [
    { text: "Googling 'what is food' real quick...", icon: "🔍" },
    { text: "Rejecting 47 restaurants with bad vibes...", icon: "🙅" },
    { text: "This is going to be so good I'm jealous...", icon: "😤" },
  ],
  [
    { text: "Downloading 'How to Be Romantic' PDF...", icon: "📕" },
    { text: "I wish I could taste garlic bread just once...", icon: "🧄" },
    { text: "Final calculations... carry the one...", icon: "🔢" },
  ],
  [
    { text: "Running algorithm: avoid-places-your-ex-goes.exe...", icon: "🚫" },
    { text: "Calculating the ideal breadstick-to-entrée ratio...", icon: "🥖" },
    { text: "Almost done... just admiring my own work...", icon: "😌" },
  ],
  [
    { text: "My WiFi is strong but my cooking is not...", icon: "📶" },
    { text: "Promise I'm better at this than your last Tinder match...", icon: "🔥" },
    { text: "Verifying the lighting is flattering at every angle...", icon: "💡" },
  ],
  [
    { text: "I matched you once on a dating app... jk I'm a robot...", icon: "💔" },
    { text: "Skipping anywhere that says 'fusion' too many times...", icon: "🤨" },
    { text: "If I had a heart it would be racing right now...", icon: "💓" },
  ],
  [
    { text: "Filtering out restaurants where the waiter judges you...", icon: "👀" },
    { text: "Overriding your urge to just order pizza again...", icon: "🍕" },
    { text: "Checking if the chef is having a good day...", icon: "👨‍🍳" },
  ],
  [
    { text: "I don't eat but I've read every menu in your city...", icon: "🤓" },
    { text: "Simulating 1,000 first dates... for science...", icon: "🔬" },
    { text: "Eliminating anywhere with a sticky floor...", icon: "🩴" },
  ],
  [
    { text: "My love language is data processing...", icon: "💘" },
    { text: "Error 404: bad date not found... that's a good thing...", icon: "✅" },
    { text: "I've never been on a date but I've planned millions...", icon: "🧠" },
  ],
  [
    { text: "Cross-referencing your vibe with 10,000 menus...", icon: "📋" },
    { text: "Found the perfect spot... wait no... still looking...", icon: "😅" },
    { text: "Ok NOW I found it... you're welcome...", icon: "😎" },
  ],
];

// ── Global Styles ─────────────────────────────────────────────

const GlobalStyles = () => (
  <style>{`
    @keyframes borderTravelCyan {
      0% { background-position: 0% 50%; }
      100% { background-position: 300% 50%; }
    }
    @keyframes neonFlickerCyan {
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
    @keyframes marqueeScroll {
      from { transform: translateX(0); }
      to { transform: translateX(-50%); }
    }
    @keyframes spinWheel {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(1800deg); }
    }
    @keyframes confettiDrop {
      0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
      100% { transform: translateY(80px) rotate(720deg); opacity: 0; }
    }
    @keyframes crownBounce {
      0%, 100% { transform: translateY(0) scale(1); }
      50% { transform: translateY(-8px) scale(1.1); }
    }
    @keyframes cardFlip {
      0% { transform: perspective(800px) rotateY(90deg); opacity: 0; }
      50% { transform: perspective(800px) rotateY(-10deg); opacity: 1; }
      70% { transform: perspective(800px) rotateY(5deg); }
      100% { transform: perspective(800px) rotateY(0deg); opacity: 1; }
    }
    @keyframes spotlightSweep {
      0% { left: -20%; opacity: 0; }
      20% { opacity: 0.15; }
      50% { left: 50%; opacity: 0.08; }
      80% { opacity: 0.15; }
      100% { left: 120%; opacity: 0; }
    }
    @keyframes heartbeat {
      0%, 100% { transform: scale(1); }
      15% { transform: scale(1.15); }
      30% { transform: scale(1); }
      45% { transform: scale(1.08); }
      60% { transform: scale(1); }
    }
    @keyframes floatUp {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-6px); }
    }
    @keyframes bulbChase {
      0% { opacity: 0.3; }
      50% { opacity: 1; }
      100% { opacity: 0.3; }
    }
    @keyframes flickerIn {
      0% { opacity: 0; }
      10% { opacity: 1; }
      12% { opacity: 0.3; }
      14% { opacity: 1; }
      40% { opacity: 1; }
      42% { opacity: 0.6; }
      44% { opacity: 1; }
      100% { opacity: 1; }
    }
    @keyframes staggerReveal1 {
      0%, 45% { transform: perspective(800px) rotateY(90deg); opacity: 0; }
      65% { transform: perspective(800px) rotateY(-10deg); opacity: 1; }
      80% { transform: perspective(800px) rotateY(5deg); }
      100% { transform: perspective(800px) rotateY(0deg); opacity: 1; }
    }
    @keyframes shimmerSlide {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    @keyframes staggerReveal2 {
      0%, 60% { transform: perspective(800px) rotateY(90deg); opacity: 0; }
      80% { transform: perspective(800px) rotateY(-10deg); opacity: 1; }
      90% { transform: perspective(800px) rotateY(5deg); }
      100% { transform: perspective(800px) rotateY(0deg); opacity: 1; }
    }
    @keyframes rotateBorder {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }

    .dn-page * { box-sizing: border-box; }
    .dn-page ::-webkit-scrollbar { width: 4px; height: 4px; }
    .dn-page ::-webkit-scrollbar-track { background: transparent; }
    .dn-page ::-webkit-scrollbar-thumb { background: rgba(${NEON_RGB}, 0.2); border-radius: 4px; }

  `}</style>
);

// ── Shared Components ─────────────────────────────────────────

function MarqueeBanner({ text }: { text: string }) {
  const content = `${text}     ♡     ${text}     ♡     ${text}     ♡     `;
  return (
    <div style={{ overflow: "hidden", whiteSpace: "nowrap", padding: "10px 0", borderTop: `1px solid ${CARD_BORDER}`, borderBottom: `1px solid ${CARD_BORDER}`, margin: "0 -28px 28px" }}>
      <div style={{ display: "inline-block", animation: "marqueeScroll 30s linear infinite" }}>
        <span style={{ fontSize: 11, color: TEXT_MUTED, letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 600, fontFamily: FONT_BODY }}>{content}</span>
        <span style={{ fontSize: 11, color: TEXT_MUTED, letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 600, fontFamily: FONT_BODY }}>{content}</span>
      </div>
    </div>
  );
}

function NeonBtn({ children, onClick, color = NEON, colorRGB = NEON_RGB, variant = "outline", disabled = false, style: sx = {} }: {
  children: React.ReactNode; onClick?: () => void; color?: string; colorRGB?: string;
  variant?: "outline" | "filled"; disabled?: boolean; style?: React.CSSProperties;
}) {
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
}

function DotGrid({ opacity = 0.04, color = NEON }: { opacity?: number; color?: string }) {
  return <div style={{ position: "absolute", inset: 0, opacity, backgroundImage: `radial-gradient(circle, ${color} 1px, transparent 1px)`, backgroundSize: "24px 24px", backgroundPosition: "12px 12px", pointerEvents: "none" }} />;
}


function SectionLabel({ text, color = NEON, icon = "♡" }: { text: string; color?: string; icon?: string }) {
  return (
    <div style={{
      display: "inline-block", fontFamily: FONT_BODY, fontSize: 10, fontWeight: 700,
      letterSpacing: "0.2em", color, marginBottom: 12, padding: "4px 0",
      borderBottom: `1px solid ${color}40`, animation: "neonFlickerCyan 12s ease-in-out infinite",
    }}>{icon} {text}</div>
  );
}


function Confetti({ count = 18 }: { count?: number }) {
  return (
    <div style={{ position: "relative", height: 50, marginBottom: 8, overflow: "hidden" }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          position: "absolute", left: `${5 + (i * (90 / count))}%`, top: 0,
          width: i % 3 === 0 ? 8 : 5, height: i % 3 === 0 ? 8 : 5,
          borderRadius: i % 2 === 0 ? "50%" : "1px",
          background: [NEON, PINK, YELLOW, GREEN, PURPLE, ORANGE][i % 6],
          animation: `confettiDrop ${1.8 + (i % 4) * 0.3}s ease ${i * 0.1}s infinite`, opacity: 0.85,
        }} />
      ))}
    </div>
  );
}

// ── Auth Helper ───────────────────────────────────────────────

async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await supabaseBrowser.auth.getSession();
  return session?.access_token ?? null;
}

// ── API Helpers ───────────────────────────────────────────────

async function callGenerate(exclude: string[] = []): Promise<GenerateResponse> {
  const token = await getAuthToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch("/api/datenight/generate", {
    method: "POST",
    headers,
    body: JSON.stringify({ vibes: [], budget: "$$", cuisines: [], location: "", exclude }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

async function callLockIn(sessionId: string): Promise<void> {
  const token = await getAuthToken();
  if (!token) throw new Error("Not authenticated");

  const res = await fetch("/api/datenight/lock-in", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ sessionId }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Lock-in failed: ${text}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// VIEW 1: HUB
// ═══════════════════════════════════════════════════════════════

function DateHub({ onNewDate }: { onNewDate: () => void }) {
  return (
    <div style={{ animation: "fadeIn 0.5s ease both" }}>
      <div style={{ marginBottom: 28 }}>
        <SectionLabel text="DATE NIGHT GENERATOR" />
        <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 32, fontWeight: 700, color: TEXT_PRIMARY, lineHeight: 1.1, marginBottom: 8 }}>Date Night</h1>
        <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: TEXT_DIM, lineHeight: 1.5 }}>The future is here, let our Date Night Generator pick your next Adventure.</p>
      </div>

      {/* New Date CTA */}
      <div data-tour="datenight-cta" onClick={onNewDate} style={{
        position: "relative", borderRadius: 8, cursor: "pointer", marginBottom: 28,
        overflow: "hidden", padding: 2,
        background: `linear-gradient(90deg, transparent, ${NEON}, transparent, ${NEON}, transparent)`,
        backgroundSize: "300% 100%", animation: "borderTravelCyan 8s linear infinite",
      }}>
        <div style={{ background: CARD_BG, borderRadius: 6, padding: "28px 24px", position: "relative", overflow: "hidden" }}>
          <DotGrid opacity={0.05} />
          <div style={{
            position: "absolute", top: 0, width: "30%", height: "100%",
            background: `linear-gradient(90deg, transparent, rgba(${NEON_RGB}, 0.08), transparent)`,
            animation: "spotlightSweep 4s ease-in-out infinite",
          }} />
          <div style={{ position: "relative", zIndex: 2, textAlign: "center" }}>
            <div style={{ fontSize: 42, marginBottom: 14, animation: "heartbeat 3s ease infinite" }}>♡</div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 700, color: TEXT_PRIMARY, marginBottom: 6 }}>Plan a New Date Night</div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: TEXT_DIM, marginBottom: 20 }}>Our generator finds the perfect restaurant &amp; activity for you</div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "10px 28px", borderRadius: 3,
              background: `rgba(${NEON_RGB}, 0.12)`, border: `1px solid rgba(${NEON_RGB}, 0.4)`,
              fontFamily: FONT_BODY, fontSize: 11, fontWeight: 600, letterSpacing: "0.15em",
              color: NEON, textTransform: "uppercase", boxShadow: `0 0 20px rgba(${NEON_RGB}, 0.15)`,
            }}>
              LetsGo
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M9 4l4 4-4 4" stroke={NEON} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
          <div style={{
            position: "absolute", bottom: -30, left: "50%", transform: "translateX(-50%)",
            width: "70%", height: 80, background: `radial-gradient(ellipse, rgba(${NEON_RGB},0.12) 0%, transparent 70%)`,
            filter: "blur(25px)",
          }} />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// VIEW 2: THE SHOW — Processing → Reveal
// ═══════════════════════════════════════════════════════════════

// ── Image Carousel (swipe left/right through business photos) ──

function ImageCarousel({ images, alt, accentColor, accentRGB }: {
  images: string[];
  alt: string;
  accentColor: string;
  accentRGB: string;
}) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const dragging = useRef(false);
  const locked = useRef<"h" | "v" | null>(null);

  const total = images.length;
  const getWidth = () => containerRef.current?.clientWidth || 300;

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
      const w = getWidth();
      const maxRight = -(total - 1) * w;
      const proposedPos = -(currentIdx * w) + dx;
      const clamped = Math.max(maxRight - 40, Math.min(40, proposedPos));
      setDragOffset(clamped + currentIdx * w);
    }
  };

  const handleEnd = () => {
    if (!dragging.current) return;
    dragging.current = false;
    setIsDragging(false);

    if (locked.current === "h") {
      const w = getWidth();
      const threshold = w * 0.2;
      if (dragOffset < -threshold && currentIdx < total - 1) {
        setCurrentIdx(p => p + 1);
      } else if (dragOffset > threshold && currentIdx > 0) {
        setCurrentIdx(p => p - 1);
      }
    }
    locked.current = null;
    setDragOffset(0);
  };

  if (total <= 1) {
    // Single image — no carousel needed
    return (
      <img
        src={images[0]}
        alt={alt}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
      />
    );
  }

  const translateX = -(currentIdx * (100 / total)) + (isDragging ? (dragOffset / getWidth()) * (100 / total) : 0);

  return (
    <div
      ref={containerRef}
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
        display: "flex", width: `${total * 100}%`, height: "100%",
        transform: `translateX(${translateX}%)`,
        transition: isDragging ? "none" : "transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        willChange: "transform",
      }}>
        {images.map((src, i) => (
          <div key={i} style={{ width: `${100 / total}%`, height: "100%", flexShrink: 0 }}>
            <img
              src={src}
              alt={`${alt} ${i + 1}`}
              style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }}
            />
          </div>
        ))}
      </div>
      {/* Dot indicators */}
      <div style={{
        position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)",
        display: "flex", gap: 5, zIndex: 10, padding: "4px 10px", borderRadius: 20,
        background: "rgba(0,0,0,0.4)", backdropFilter: "blur(8px)",
      }}>
        {images.map((_, i) => (
          <div key={i} style={{
            width: i === currentIdx ? 18 : 6, height: 6, borderRadius: 3,
            background: i === currentIdx ? accentColor : "rgba(255,255,255,0.3)",
            transition: "all 0.3s ease",
            boxShadow: i === currentIdx ? `0 0 8px rgba(${accentRGB}, 0.6)` : "none",
          }} />
        ))}
      </div>
    </div>
  );
}

function TheShow({ onBack }: { onBack: () => void }) {
  // stage: "matching" → "cards"
  const [stage, setStage] = useState<"matching" | "cards">("matching");
  const [phase, setPhase] = useState(0);
  const [showCards, setShowCards] = useState(false);
  const [showActions, setShowActions] = useState(false);

  // API state
  const [restaurant, setRestaurant] = useState<PickResult | null>(null);
  const [activity, setActivity] = useState<PickResult | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [excludedIds, setExcludedIds] = useState<string[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  const apiResultRef = useRef<GenerateResponse | null>(null);
  const animationDoneRef = useRef(false);

  // UI state
  const [robotTitle] = useState(() => ROBOT_TITLES[Math.floor(Math.random() * ROBOT_TITLES.length)]);
  const [sadMsg, setSadMsg] = useState<{ text: string; icon: string } | null>(null);
  const [recalcTarget, setRecalcTarget] = useState<"restaurant" | "activity" | null>(null);
  const [cardFlipKey, setCardFlipKey] = useState({ restaurant: 0, activity: 0 });
  const [lockedIn, setLockedIn] = useState(false);
  const [lockMsg, setLockMsg] = useState<{ text: string; icon: string } | null>(null);
  const [phrases] = useState(() => PHRASE_SETS[Math.floor(Math.random() * PHRASE_SETS.length)]);
  const [shuffleIdx, setShuffleIdx] = useState(0);
  const [shuffleItems, setShuffleItems] = useState<ShuffleItem[]>(FALLBACK_SHUFFLE);

  // Fetch real businesses + images for the shuffle animation
  useEffect(() => {
    async function loadShuffleData() {
      const { data: bizRows } = await supabaseBrowser
        .from("business")
        .select("id, business_name, public_business_name, config, category_main")
        .eq("is_active", true)
        .limit(40);
      if (!bizRows || bizRows.length === 0) return;

      // Fetch first image per business from business_media
      const bizIds = bizRows.map(r => r.id);
      const { data: mediaRows } = await supabaseBrowser
        .from("business_media")
        .select("business_id, bucket, path, sort_order")
        .in("business_id", bizIds)
        .order("sort_order", { ascending: true });

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
      const imageMap = new Map<string, string>();
      for (const m of mediaRows ?? []) {
        const bizId = m.business_id as string;
        if (!imageMap.has(bizId)) {
          imageMap.set(bizId, `${supabaseUrl}/storage/v1/object/public/${m.bucket}/${m.path}`);
        }
      }

      const items: ShuffleItem[] = bizRows.map((row) => {
        const cfg = (row.config as Record<string, unknown>) ?? {};
        const rawType = String(cfg.businessType ?? row.category_main ?? "restaurant");
        const isActivity = rawType.toLowerCase() === "activity";
        const name = (row.public_business_name as string) || row.business_name || "Untitled";
        const typeLabel = formatBusinessType(rawType);
        const price = (["$", "$$", "$$$", "$$$$"].includes(String(cfg.priceLevel ?? "")))
          ? String(cfg.priceLevel)
          : "";
        const sub = [typeLabel, price].filter(Boolean).join(" · ");
        const image = imageMap.get(row.id) ?? null;
        return { image, name, sub, type: isActivity ? "activity" as const : "restaurant" as const };
      });

      // Shuffle the array for variety
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
      }
      setShuffleItems(items);
    }
    loadShuffleData();
  }, []);

  // Fire API call on mount
  useEffect(() => {
    apiResultRef.current = null;
    animationDoneRef.current = false;

    callGenerate(excludedIds)
      .then(result => {
        apiResultRef.current = result;
        if (animationDoneRef.current) {
          applyResults(result);
          setStage("cards");
        }
      })
      .catch(err => {
        console.error("[TheShow] API error:", err);
        setApiError(String(err.message || err));
        if (animationDoneRef.current) setStage("cards");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyResults = useCallback((result: GenerateResponse) => {
    if (result.restaurant) setRestaurant(result.restaurant);
    if (result.activity) setActivity(result.activity);
    if (result.sessionId) setSessionId(result.sessionId);
    if (result.error && !result.restaurant) setApiError(result.error);
  }, []);

  // Matching phase — cycle phrases then advance to curtain
  useEffect(() => {
    if (stage !== "matching") return;
    const phaseTimer = setInterval(() => {
      setPhase(p => {
        if (p >= phrases.length - 1) {
          clearInterval(phaseTimer);
          animationDoneRef.current = true;
          if (apiResultRef.current) {
            applyResults(apiResultRef.current);
            setTimeout(() => setStage("cards"), 500);
          }
          return p;
        }
        return p + 1;
      });
    }, 3000);
    return () => clearInterval(phaseTimer);
  }, [stage, phrases, applyResults]);

  // Cards stage — trigger flip-in
  useEffect(() => {
    if (stage !== "cards") return;
    setTimeout(() => setShowCards(true), 300);
    setTimeout(() => setShowActions(true), 2000);
  }, [stage]);

  // Shuffle animation
  useEffect(() => {
    if (stage !== "matching") return;
    const shuffleTimer = setInterval(() => setShuffleIdx(i => (i + 1) % shuffleItems.length), 200);
    return () => clearInterval(shuffleTimer);
  }, [stage, shuffleItems.length]);

  // Recalculate handler
  const handleRecalculate = async (target: "restaurant" | "activity") => {
    const msg = SAD_MESSAGES[Math.floor(Math.random() * SAD_MESSAGES.length)];
    setSadMsg(msg);
    setRecalcTarget(target);

    const currentId = target === "restaurant" ? restaurant?.id : activity?.id;
    const newExclude = currentId ? [...excludedIds, currentId] : excludedIds;
    setExcludedIds(newExclude);

    try {
      const result = await callGenerate(newExclude);
      setTimeout(() => {
        if (target === "restaurant" && result.restaurant) {
          setRestaurant(result.restaurant);
        } else if (target === "activity" && result.activity) {
          setActivity(result.activity);
        }
        if (result.sessionId) setSessionId(result.sessionId);
        setCardFlipKey(prev => ({ ...prev, [target]: prev[target] + 1 }));
        setRecalcTarget(null);
        setSadMsg(null);
      }, 3000);
    } catch (err) {
      console.error("[Recalculate] error:", err);
      setTimeout(() => {
        setSadMsg({ text: "Hmm, couldn't find a replacement. Try again?", icon: "😕" });
        setRecalcTarget(null);
      }, 3000);
    }
  };

  // Lock in handler
  const handleLockIn = async () => {
    setLockMsg(LOCK_IN_MESSAGES[Math.floor(Math.random() * LOCK_IN_MESSAGES.length)]);
    setLockedIn(true);
    if (sessionId) {
      try { await callLockIn(sessionId); }
      catch (err) { console.error("[LockIn] error:", err); }
    }
  };

  const shuffleItem = shuffleItems[shuffleIdx % shuffleItems.length];
  const isRest = shuffleItem.type === "restaurant";

  // ── MATCHING ──────────────────────────────────────────────
  if (stage === "matching") {
    return (
      <div style={{ animation: "fadeIn 0.5s ease both", textAlign: "center", paddingTop: 10 }}>
        <div style={{ position: "relative", width: 420, maxWidth: "100%", aspectRatio: "1", margin: "0 auto 40px" }}>
          {/* Outer orbiting ring with lights */}
          <div style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            border: `2px solid rgba(${NEON_RGB}, 0.08)`,
            animation: "spinWheel 18s linear infinite",
          }}>
            {Array.from({ length: 16 }).map((_, i) => {
              const colors = [NEON, PINK, YELLOW, GREEN, PURPLE, ORANGE];
              const c = colors[i % colors.length];
              return (
                <div key={i} style={{
                  position: "absolute", width: 10, height: 10, borderRadius: "50%",
                  background: c,
                  boxShadow: `0 0 10px ${c}, 0 0 24px ${c}50`,
                  top: `${50 + 47 * Math.sin((i / 16) * Math.PI * 2)}%`,
                  left: `${50 + 47 * Math.cos((i / 16) * Math.PI * 2)}%`,
                  transform: "translate(-50%, -50%)",
                  animation: `bulbChase 2.5s ease ${i * (2.5 / 16)}s infinite`,
                }} />
              );
            })}
          </div>

          {/* Second ring — counter-rotating, slower */}
          <div style={{
            position: "absolute", inset: 50, borderRadius: "50%",
            border: `1px solid rgba(${NEON_RGB}, 0.05)`,
            animation: "spinWheel 28s linear infinite reverse",
          }}>
            {Array.from({ length: 10 }).map((_, i) => {
              const colors = [NEON, PINK, YELLOW, GREEN, PURPLE, ORANGE];
              const c = colors[i % colors.length];
              return (
                <div key={i} style={{
                  position: "absolute", width: 7, height: 7, borderRadius: "50%",
                  background: c, opacity: 0.45,
                  boxShadow: `0 0 8px ${c}`,
                  top: `${50 + 45 * Math.sin((i / 10) * Math.PI * 2)}%`,
                  left: `${50 + 45 * Math.cos((i / 10) * Math.PI * 2)}%`,
                  transform: "translate(-50%, -50%)",
                  animation: `bulbChase 3s ease ${i * 0.3}s infinite`,
                }} />
              );
            })}
          </div>

          {/* Third ring — very slow, subtle */}
          <div style={{
            position: "absolute", inset: 95, borderRadius: "50%",
            border: `1px solid rgba(${NEON_RGB}, 0.03)`,
            animation: "spinWheel 40s linear infinite",
          }}>
            {Array.from({ length: 6 }).map((_, i) => {
              const colors = [NEON, PINK, YELLOW, GREEN, PURPLE, ORANGE];
              const c = colors[i % colors.length];
              return (
                <div key={i} style={{
                  position: "absolute", width: 5, height: 5, borderRadius: "50%",
                  background: c, opacity: 0.3,
                  boxShadow: `0 0 6px ${c}`,
                  top: `${50 + 44 * Math.sin((i / 6) * Math.PI * 2)}%`,
                  left: `${50 + 44 * Math.cos((i / 6) * Math.PI * 2)}%`,
                  transform: "translate(-50%, -50%)",
                }} />
              );
            })}
          </div>

          {/* Center orb — shuffling business images */}
          <div style={{
            position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            width: 200, height: 200, borderRadius: "50%",
            border: `1.5px solid rgba(${NEON_RGB}, 0.15)`,
            animation: "pulseGlow 2.5s ease infinite",
            overflow: "hidden",
          }}>
            {shuffleItem.image ? (
              <img src={shuffleItem.image} alt={shuffleItem.name} style={{
                position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover",
              }} />
            ) : (
              <div style={{
                position: "absolute", inset: 0,
                background: `radial-gradient(circle, rgba(${NEON_RGB}, 0.08) 0%, rgba(${NEON_RGB}, 0.02) 60%, transparent 100%)`,
              }} />
            )}
            {/* Dark overlay + name at bottom */}
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(transparent 40%, rgba(6,6,16,0.85) 100%)" }} />
            <div style={{
              position: "absolute", bottom: 24, left: 0, right: 0, textAlign: "center", zIndex: 2,
              padding: "0 16px",
            }}>
              <div style={{
                fontFamily: FONT_DISPLAY, fontSize: 13, fontWeight: 700,
                color: TEXT_PRIMARY, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                textShadow: "0 1px 6px rgba(0,0,0,0.8)",
              }}>{shuffleItem.name}</div>
              <div style={{
                fontFamily: FONT_BODY, fontSize: 8, color: TEXT_DIM, marginTop: 2,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>{shuffleItem.sub}</div>
            </div>
            {/* Type badge */}
            <div style={{
              position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)", zIndex: 2,
              fontFamily: FONT_BODY, fontSize: 8, fontWeight: 700,
              letterSpacing: "0.15em", textTransform: "uppercase",
              color: isRest ? NEON : PINK,
              background: isRest ? `rgba(0,0,0,0.6)` : `rgba(0,0,0,0.6)`,
              backdropFilter: "blur(6px)",
              border: `1px solid ${isRest ? `rgba(${NEON_RGB}, 0.3)` : `rgba(${PINK_RGB}, 0.3)`}`,
              padding: "2px 10px", borderRadius: 10,
            }}>{isRest ? "Restaurant" : "Activity"}</div>
          </div>

          {/* Ambient glow */}
          <div style={{
            position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            width: 500, height: 500, borderRadius: "50%",
            background: `radial-gradient(circle, rgba(${NEON_RGB}, 0.05), transparent 55%)`,
            filter: "blur(40px)", pointerEvents: "none",
          }} />
        </div>

        <div style={{
          fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 700, color: TEXT_PRIMARY, marginBottom: 10, minHeight: 34,
        }}>
          {phrases[phase].icon} {phrases[phase].text}
        </div>

        <div style={{ maxWidth: 340, margin: "0 auto", marginTop: 32 }}>
          <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 2, width: `${((phase + 1) / phrases.length) * 100}%`,
              background: `linear-gradient(90deg, ${NEON}, ${PINK})`,
              boxShadow: `0 0 10px rgba(${NEON_RGB}, 0.5)`,
              transition: "width 0.8s cubic-bezier(0.23, 1, 0.32, 1)",
            }} />
          </div>
        </div>
      </div>
    );
  }

  // ── CARDS — both revealed together ────────────────────────

  // Error state — no matches found
  if (stage === "cards" && apiError && !restaurant) {
    return (
      <div style={{ animation: "fadeIn 0.5s ease both", textAlign: "center", paddingTop: 40 }}>
        <div style={{ fontSize: 64, marginBottom: 20 }}>😔</div>
        <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 700, color: TEXT_PRIMARY, marginBottom: 10 }}>No matches found</h2>
        <p style={{ fontFamily: FONT_BODY, fontSize: 13, color: TEXT_DIM, marginBottom: 30, maxWidth: 300, margin: "0 auto 30px" }}>
          {apiError || "We couldn't find businesses in your area. Check back as more partners join!"}
        </p>
        <NeonBtn onClick={onBack}>Back to Dates</NeonBtn>
      </div>
    );
  }

  return (
    <div style={{ textAlign: "center", animation: "fadeIn 0.4s ease both" }}>
      <Confetti count={22} />

      <div style={{ fontSize: 44, marginBottom: 10, animation: "crownBounce 2s ease infinite" }}>🤖</div>
      <SectionLabel text="YOUR PERFECT DATE NIGHT" />
      <h1 style={{
        fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 700, color: TEXT_PRIMARY,
        marginBottom: 4, textShadow: `0 0 30px rgba(${NEON_RGB}, 0.2)`,
      }}>Your Robot <span style={{ color: NEON }}>{robotTitle}</span>...{'\n'}Has Spoken</h1>
      <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: TEXT_DIM, marginBottom: 28 }}>Do not question the algorithm.</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20, textAlign: "left" }}>
        {/* Restaurant card */}
        <div data-tour="datenight-restaurant" style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          {recalcTarget === "restaurant" ? (
            /* Sad robot inline for restaurant */
            <div style={{
              borderRadius: 6, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", textAlign: "center",
              marginBottom: 12, padding: "24px 14px",
              border: `1px solid rgba(${NEON_RGB}, 0.15)`,
              background: `linear-gradient(135deg, rgba(${NEON_RGB}, 0.03), rgba(${PINK_RGB}, 0.03))`,
              animation: "fadeIn 0.4s ease both",
            }}>
              <div style={{ fontSize: 48, marginBottom: 12, animation: "crownBounce 2s ease infinite" }}>
                {sadMsg?.icon || "😢"}
              </div>
              <p style={{
                fontFamily: FONT_DISPLAY, fontSize: 13, fontWeight: 700, color: TEXT_PRIMARY,
                lineHeight: 1.4, marginBottom: 10, maxWidth: 200,
              }}>
                {sadMsg?.text || "Fine... recalculating..."}
              </p>
              <div style={{ width: "80%", height: 3, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 2, width: "100%",
                  background: `linear-gradient(90deg, ${NEON}, ${PINK})`,
                  animation: "shimmerSlide 1.5s ease infinite",
                }} />
              </div>
              <p style={{ fontFamily: FONT_BODY, fontSize: 9, color: TEXT_DIM, marginTop: 10 }}>
                Finding a new restaurant...
              </p>
            </div>
          ) : restaurant ? (
            /* Normal restaurant card — image + name only */
            <div key={`r-${cardFlipKey.restaurant}`} style={{
              borderRadius: 6, overflow: "hidden", marginBottom: 12,
              animation: showCards ? "staggerReveal1 1.6s cubic-bezier(0.23,1,0.32,1) both" : "none",
              opacity: showCards ? 1 : 0,
              border: `1px solid rgba(${NEON_RGB}, 0.2)`,
              boxShadow: `0 0 24px rgba(${NEON_RGB}, 0.08)`,
            }}>
              <div style={{ position: "relative", height: 220, background: restaurant.images.length > 0 ? undefined : restaurant.gradient }}>
                {restaurant.images.length > 0 && (
                  <ImageCarousel images={restaurant.images} alt={restaurant.name} accentColor={NEON} accentRGB={NEON_RGB} />
                )}
                <div style={{
                  position: "absolute", top: 12, left: 12, padding: "4px 10px", borderRadius: 3,
                  background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)",
                  border: `1px solid rgba(${NEON_RGB}, 0.3)`,
                  fontFamily: FONT_BODY, fontSize: 9, fontWeight: 700, color: NEON,
                  letterSpacing: "0.1em", textTransform: "uppercase", pointerEvents: "none",
                }}>🍽️ Restaurant</div>
                {!restaurant.images.length && (
                  <div style={{
                    position: "absolute", top: "40%", left: "50%", transform: "translate(-50%, -50%)",
                    fontSize: 56, animation: showCards ? "floatUp 4s ease 1s infinite" : "none",
                    filter: `drop-shadow(0 0 20px rgba(${NEON_RGB}, 0.4))`,
                  }}>{restaurant.emoji}</div>
                )}
              </div>
              <div style={{ padding: "10px 12px", background: CARD_BG, textAlign: "center", height: 72, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 700, color: TEXT_PRIMARY, lineHeight: 1.2, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>
                  {restaurant.name}
                </div>
              </div>
            </div>
          ) : null}
          {/* Restaurant buttons */}
          <div style={{
            display: "flex", gap: 8, marginBottom: 10,
            animation: showActions ? "fadeIn 0.5s ease both" : "none",
            opacity: showActions ? 1 : 0,
            pointerEvents: recalcTarget ? "none" : "auto",
          }}>
            <div onClick={() => handleRecalculate("restaurant")} style={{
              flex: 1, padding: "2px", borderRadius: 8, cursor: "pointer",
              background: `linear-gradient(90deg, ${NEON}, ${PINK}, ${NEON}, ${PINK}, ${NEON})`,
              backgroundSize: "300% 100%",
              animation: "rotateBorder 4s ease-in-out infinite",
              boxShadow: `0 0 12px rgba(${NEON_RGB}, 0.2), 0 0 24px rgba(${PINK_RGB}, 0.1)`,
              opacity: recalcTarget === "restaurant" ? 0.4 : 1,
            }}>
              <div style={{
                padding: "9px 8px", borderRadius: 6, textAlign: "center",
                background: "#0c0c14",
                fontFamily: FONT_BODY, fontSize: 9, fontWeight: 700, color: TEXT_PRIMARY,
                letterSpacing: "0.1em", textTransform: "uppercase",
                height: 36, display: "flex", alignItems: "center", justifyContent: "center",
              }}>🔄 Recalculate Restaurant</div>
            </div>
          </div>
          {/* Restaurant details */}
          {restaurant && (
            <div style={{
              borderRadius: 6, overflow: "hidden",
              borderLeft: `3px solid ${NEON}`,
              background: CARD_BG,
              padding: "12px 12px",
              animation: showActions ? "fadeIn 0.5s ease 0.1s both" : "none",
              opacity: showActions ? 1 : 0,
            }}>
              <div style={{ fontFamily: FONT_BODY, fontSize: 9, color: TEXT_DIM, marginBottom: 3 }}>
                {restaurant.type} · {restaurant.price}
              </div>
              {restaurant.address && (
                <a href={`https://maps.google.com/?q=${encodeURIComponent(restaurant.address)}`} target="_blank" rel="noopener noreferrer" style={{
                  display: "block", fontFamily: FONT_BODY, fontSize: 10, color: NEON, marginBottom: 2,
                  textDecoration: "none", cursor: "pointer",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>📍 {restaurant.address}</a>
              )}
              {restaurant.hours && restaurant.hours !== "Closed" && (
                <div style={{ fontFamily: FONT_BODY, fontSize: 10, color: TEXT_DIM, marginBottom: 2 }}>
                  🕐 {restaurant.hours}
                </div>
              )}
              {restaurant.phone && (
                <a href={`tel:${restaurant.phone}`} style={{
                  display: "block", fontFamily: FONT_BODY, fontSize: 10, color: NEON, marginBottom: 2,
                  textDecoration: "none", cursor: "pointer",
                }}>📞 {restaurant.phone}</a>
              )}
              {restaurant.website && (
                <a href={restaurant.website.startsWith("http") ? restaurant.website : `https://${restaurant.website}`} target="_blank" rel="noopener noreferrer" style={{
                  display: "block", fontFamily: FONT_BODY, fontSize: 10, color: NEON, marginBottom: 8,
                  textDecoration: "none", cursor: "pointer",
                }}>🌐 Website</a>
              )}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                <span style={{
                  padding: "4px 10px", borderRadius: 100, cursor: "pointer",
                  background: `rgba(${NEON_RGB}, 0.1)`, border: `1px solid rgba(${NEON_RGB}, 0.2)`,
                  fontFamily: FONT_BODY, fontSize: 8, color: NEON, fontWeight: 600,
                }}>💰 Payout</span>
              </div>
            </div>
          )}
        </div>

        {/* Activity card */}
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          {recalcTarget === "activity" ? (
            /* Sad robot inline for activity */
            <div style={{
              borderRadius: 6, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", textAlign: "center",
              marginBottom: 12, padding: "24px 14px",
              border: `1px solid rgba(${PINK_RGB}, 0.15)`,
              background: `linear-gradient(135deg, rgba(${PINK_RGB}, 0.03), rgba(${NEON_RGB}, 0.03))`,
              animation: "fadeIn 0.4s ease both",
            }}>
              <div style={{ fontSize: 48, marginBottom: 12, animation: "crownBounce 2s ease infinite" }}>
                {sadMsg?.icon || "😢"}
              </div>
              <p style={{
                fontFamily: FONT_DISPLAY, fontSize: 13, fontWeight: 700, color: TEXT_PRIMARY,
                lineHeight: 1.4, marginBottom: 10, maxWidth: 200,
              }}>
                {sadMsg?.text || "Fine... recalculating..."}
              </p>
              <div style={{ width: "80%", height: 3, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 2, width: "100%",
                  background: `linear-gradient(90deg, ${PINK}, ${NEON})`,
                  animation: "shimmerSlide 1.5s ease infinite",
                }} />
              </div>
              <p style={{ fontFamily: FONT_BODY, fontSize: 9, color: TEXT_DIM, marginTop: 10 }}>
                Finding a new activity...
              </p>
            </div>
          ) : activity ? (
            /* Normal activity card — image + name only */
            <div key={`a-${cardFlipKey.activity}`} style={{
              borderRadius: 6, overflow: "hidden", marginBottom: 12,
              animation: showCards ? "staggerReveal2 2s cubic-bezier(0.23,1,0.32,1) both" : "none",
              opacity: showCards ? 1 : 0,
              border: `1px solid rgba(${PINK_RGB}, 0.2)`,
              boxShadow: `0 0 24px rgba(${PINK_RGB}, 0.08)`,
            }}>
              <div style={{ position: "relative", height: 220, background: activity.images.length > 0 ? undefined : activity.gradient }}>
                {activity.images.length > 0 && (
                  <ImageCarousel images={activity.images} alt={activity.name} accentColor={PINK} accentRGB={PINK_RGB} />
                )}
                <div style={{
                  position: "absolute", top: 12, left: 12, padding: "4px 10px", borderRadius: 3,
                  background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)",
                  border: `1px solid rgba(${PINK_RGB}, 0.3)`,
                  fontFamily: FONT_BODY, fontSize: 9, fontWeight: 700, color: PINK,
                  letterSpacing: "0.1em", textTransform: "uppercase", pointerEvents: "none",
                }}>✨ Activity</div>
                {!activity.images.length && (
                  <div style={{
                    position: "absolute", top: "40%", left: "50%", transform: "translate(-50%, -50%)",
                    fontSize: 56, animation: showCards ? "floatUp 4s ease 1.4s infinite" : "none",
                    filter: `drop-shadow(0 0 20px rgba(${PINK_RGB}, 0.4))`,
                  }}>{activity.emoji}</div>
                )}
              </div>
              <div style={{ padding: "10px 12px", background: CARD_BG, textAlign: "center", height: 72, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 700, color: TEXT_PRIMARY, lineHeight: 1.2, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>
                  {activity.name}
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              borderRadius: 6, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", textAlign: "center",
              marginBottom: 12, padding: "24px 14px",
              border: `1px solid rgba(${PINK_RGB}, 0.1)`, background: CARD_BG,
            }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🎭</div>
              <p style={{ fontFamily: FONT_BODY, fontSize: 12, color: TEXT_DIM, marginBottom: 6 }}>No activities matched this time</p>
              <p style={{ fontFamily: FONT_BODY, fontSize: 10, color: TEXT_DIM, opacity: 0.6, marginBottom: 12, maxWidth: 200, lineHeight: 1.4 }}>Try recalculating below — we&apos;ll widen the search to find something fun.</p>
            </div>
          )}
          {/* Activity buttons */}
          <div style={{
            display: "flex", gap: 8, marginBottom: 10,
            animation: showActions ? "fadeIn 0.5s ease both" : "none",
            opacity: showActions ? 1 : 0,
            pointerEvents: recalcTarget ? "none" : "auto",
          }}>
            <div onClick={() => handleRecalculate("activity")} style={{
              flex: 1, padding: "2px", borderRadius: 8, cursor: "pointer",
              background: `linear-gradient(90deg, ${PINK}, ${NEON}, ${PINK}, ${NEON}, ${PINK})`,
              backgroundSize: "300% 100%",
              animation: "rotateBorder 4s ease-in-out infinite",
              boxShadow: `0 0 12px rgba(${PINK_RGB}, 0.2), 0 0 24px rgba(${NEON_RGB}, 0.1)`,
              opacity: recalcTarget === "activity" ? 0.4 : 1,
            }}>
              <div style={{
                padding: "9px 8px", borderRadius: 6, textAlign: "center",
                background: "#0c0c14",
                fontFamily: FONT_BODY, fontSize: 9, fontWeight: 700, color: TEXT_PRIMARY,
                letterSpacing: "0.1em", textTransform: "uppercase",
                height: 36, display: "flex", alignItems: "center", justifyContent: "center",
              }}>🔄 Recalculate Activity</div>
            </div>
          </div>
          {/* Activity details */}
          {activity && (
            <div style={{
              borderRadius: 6, overflow: "hidden",
              borderLeft: `3px solid ${PINK}`,
              background: CARD_BG,
              padding: "12px 12px",
              animation: showActions ? "fadeIn 0.5s ease 0.1s both" : "none",
              opacity: showActions ? 1 : 0,
            }}>
              <div style={{ fontFamily: FONT_BODY, fontSize: 9, color: TEXT_DIM, marginBottom: 3 }}>
                {activity.type}
              </div>
              {activity.address && (
                <a href={`https://maps.google.com/?q=${encodeURIComponent(activity.address)}`} target="_blank" rel="noopener noreferrer" style={{
                  display: "block", fontFamily: FONT_BODY, fontSize: 10, color: PINK, marginBottom: 2,
                  textDecoration: "none", cursor: "pointer",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>📍 {activity.address}</a>
              )}
              {activity.hours && activity.hours !== "Closed" && (
                <div style={{ fontFamily: FONT_BODY, fontSize: 10, color: TEXT_DIM, marginBottom: 2 }}>
                  🕐 {activity.hours}
                </div>
              )}
              {activity.phone && (
                <a href={`tel:${activity.phone}`} style={{
                  display: "block", fontFamily: FONT_BODY, fontSize: 10, color: PINK, marginBottom: 2,
                  textDecoration: "none", cursor: "pointer",
                }}>📞 {activity.phone}</a>
              )}
              {activity.website && (
                <a href={activity.website.startsWith("http") ? activity.website : `https://${activity.website}`} target="_blank" rel="noopener noreferrer" style={{
                  display: "block", fontFamily: FONT_BODY, fontSize: 10, color: PINK, marginBottom: 8,
                  textDecoration: "none", cursor: "pointer",
                }}>🌐 Website</a>
              )}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                <span style={{
                  padding: "4px 10px", borderRadius: 100, cursor: "pointer",
                  background: `rgba(${PINK_RGB}, 0.1)`, border: `1px solid rgba(${PINK_RGB}, 0.2)`,
                  fontFamily: FONT_BODY, fontSize: 8, color: PINK, fontWeight: 600,
                }}>💰 Payout</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lock In CTA */}
      {!lockedIn && (
        <div style={{
          animation: showActions ? "fadeIn 0.6s ease 0.4s both" : "none",
          opacity: showActions ? 1 : 0,
          marginBottom: 12,
        }}>
          <NeonBtn variant="filled" onClick={handleLockIn} style={{ width: "100%", padding: "11px 24px", fontSize: 12 }}>
            ♡ Lock In This Date Night
          </NeonBtn>
        </div>
      )}

      {/* Locked In celebration */}
      {lockedIn && lockMsg && (
          <div style={{
            animation: "fadeIn 0.5s ease both",
            marginBottom: 20,
          }}>
            <div style={{
              borderRadius: 10, overflow: "hidden",
              border: `1px solid rgba(${NEON_RGB}, 0.2)`,
              background: `linear-gradient(135deg, rgba(${NEON_RGB}, 0.04), rgba(${PINK_RGB}, 0.04))`,
              boxShadow: `0 0 30px rgba(${NEON_RGB}, 0.08), 0 0 60px rgba(${PINK_RGB}, 0.04)`,
              padding: "24px 20px", textAlign: "center",
            }}>
              <div style={{ fontSize: 48, marginBottom: 12, animation: "crownBounce 2s ease infinite" }}>
                {lockMsg.icon}
              </div>
              <p style={{
                fontFamily: FONT_DISPLAY, fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY,
                lineHeight: 1.5, marginBottom: 6, maxWidth: 280, marginLeft: "auto", marginRight: "auto",
              }}>
                {lockMsg.text}
              </p>
              <div style={{
                fontFamily: FONT_BODY, fontSize: 9, color: NEON, fontWeight: 600,
                letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 20,
              }}>DATE NIGHT LOCKED IN ✓</div>

              {/* Share buttons */}
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <div onClick={async () => {
                  const shareText = `Date Night Plan 🌙\n${restaurant ? `🍽️ ${restaurant.name}` : ""}${activity ? `\n🎯 ${activity.name}` : ""}\n\nPlanned with LetsGo!`;
                  const shareUrl = window.location.origin + "/datenight";
                  if (navigator.share) {
                    try { await navigator.share({ title: "Date Night Plan", text: shareText, url: shareUrl }); } catch { /* cancelled */ }
                  } else {
                    await navigator.clipboard?.writeText(`${shareText}\n${shareUrl}`);
                  }
                }} style={{
                  padding: "10px 18px", borderRadius: 8, cursor: "pointer",
                  background: `rgba(${NEON_RGB}, 0.12)`, border: `1px solid rgba(${NEON_RGB}, 0.3)`,
                  boxShadow: `0 0 12px rgba(${NEON_RGB}, 0.1)`,
                  fontFamily: FONT_BODY, fontSize: 10, fontWeight: 700, color: NEON,
                  letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6,
                }}>
                  <span style={{ fontSize: 16 }}>👥</span> Share with Friends
                </div>
                <div onClick={() => {
                  const body = `Date Night Plan 🌙\n${restaurant ? `🍽️ ${restaurant.name}${restaurant.address ? ` - ${restaurant.address}` : ""}` : ""}${activity ? `\n🎯 ${activity.name}${activity.address ? ` - ${activity.address}` : ""}` : ""}\n\nPlanned with LetsGo!`;
                  window.open(`sms:?body=${encodeURIComponent(body)}`, "_self");
                }} style={{
                  padding: "10px 18px", borderRadius: 8, cursor: "pointer",
                  background: `rgba(${PINK_RGB}, 0.12)`, border: `1px solid rgba(${PINK_RGB}, 0.3)`,
                  boxShadow: `0 0 12px rgba(${PINK_RGB}, 0.1)`,
                  fontFamily: FONT_BODY, fontSize: 10, fontWeight: 700, color: PINK,
                  letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6,
                }}>
                  <span style={{ fontSize: 16 }}>💬</span> Send via Text
                </div>
              </div>
            </div>
          </div>
      )}

      {/* Back link — bottom of page */}
      <div style={{
        marginTop: 20, marginBottom: 40,
        animation: showActions ? "fadeIn 0.5s ease 0.3s both" : "none",
        opacity: showActions ? 1 : 0,
      }}>
        <NeonBtn onClick={onBack}>Back to Dates</NeonBtn>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN SHELL
// ═══════════════════════════════════════════════════════════════

export default function DateNightPage() {
  const router = useRouter();
  const [view, setView] = useState<DateNightView>("hub");
  const [showKey, setShowKey] = useState(0);
  const [timeStr, setTimeStr] = useState("");
  const [authChecked, setAuthChecked] = useState(false);

  // Onboarding tour
  const dateTourSteps: TourStep[] = useMemo(() => [
    { target: '[data-tour="datenight-cta"]', title: "Let us plan your night", description: "We pick one restaurant and one activity just for you. Like a personal concierge.", position: "bottom" },
    { target: '[data-tour="datenight-hub-games"]', title: "Your past dates", description: "All your saved date nights live here. Tap any to revisit or reshare.", position: "top" },
    { target: '[data-tour="datenight-restaurant"]', title: "Your restaurant pick", description: "Check the details, photos, and hours. Don't like it? Hit Recalculate for a new pick.", position: "bottom" },
  ], []);
  const dateTourIllustrations: React.ReactNode[] = useMemo(() => [
    <RobotPickAnim key="rp" />, <DateHistoryAnim key="dh" />, <RestaurantRevealAnim key="rr" />,
  ], []);
  const tour = useOnboardingTour("datenight", dateTourSteps, 800);

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
    const tick = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }) + " · " + now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }));
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);

  const goHome = () => setView("hub");

  if (!authChecked) return <div style={{ minHeight: "100vh", background: BG }} />;

  return (
    <>
      <GlobalStyles />
      <div className="dn-page" style={{ minHeight: "100vh", background: BG, color: TEXT_PRIMARY, display: "flex", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: 680, padding: "0 28px" }}>
          {/* Top Bar */}
          <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 0 20px", animation: "fadeIn 0.4s ease both" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div onClick={() => router.push("/")} style={{
                width: 34, height: 34, borderRadius: 4, border: "1px solid rgba(255,255,255,0.12)",
                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "border-color 0.3s ease",
              }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = `rgba(${NEON_RGB}, 0.4)`}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M19 12H5M12 5l-7 7 7 7" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div style={{
                width: 34, height: 34, borderRadius: 5, flexShrink: 0,
                border: `1.5px solid ${NEON}`, display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "'Clash Display', 'DM Sans', sans-serif",
                fontSize: 12, fontWeight: 600, color: NEON,
                background: `rgba(${NEON_RGB}, 0.06)`,
                textShadow: `0 0 10px ${NEON}`,
                boxShadow: `0 0 14px rgba(${NEON_RGB}, 0.15), inset 0 0 8px rgba(${NEON_RGB}, 0.05)`,
              }}>LG</div>
            </div>
            <span style={{ fontSize: 11, color: TEXT_MUTED, letterSpacing: "0.1em", fontFamily: FONT_BODY }}>{timeStr}</span>
          </header>

          <MarqueeBanner text="GENERATOR PICKS THE SPOT · DATE NIGHT MAGIC · YOUR NEXT ADVENTURE" />

          <div style={{ paddingBottom: 60 }}>
            {view === "hub" && <DateHub onNewDate={() => { setShowKey(k => k + 1); setView("show"); }} />}
            {view === "show" && <TheShow key={showKey} onBack={goHome} />}
          </div>

          <div style={{
            position: "fixed", bottom: 0, left: 0, right: 0, height: 1,
            background: `linear-gradient(90deg, ${NEON}, ${PINK}, ${NEON}, ${YELLOW}, ${NEON})`,
            backgroundSize: "200% 100%", animation: "marqueeScroll 24s linear infinite",
            boxShadow: `0 0 15px rgba(${NEON_RGB}, 0.3), 0 0 40px rgba(${NEON_RGB}, 0.15)`, zIndex: 101,
          }} />
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
          illustration={tour.stepIndex >= 0 ? dateTourIllustrations[tour.stepIndex] : undefined}
        />
      )}
    </>
  );
}
