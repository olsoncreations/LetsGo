"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import NotificationBell from "@/components/NotificationBell";
import OnboardingTooltip from "@/components/OnboardingTooltip";
import { useOnboardingTour, type TourStep } from "@/lib/useOnboardingTour";
import { ModeDiscoveryAnim, ModeDateNightAnim, Mode531Anim, ModeGroupVoteAnim, ModeEventsAnim, ModeExperiencesAnim, SpotlightAnim, BellAnim, ProfileAnim } from "@/components/TourIllustrations";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import OpportunityCTA from "@/components/OpportunityCTA";
import RecruitmentSpotlightCard from "@/components/RecruitmentSpotlightCard";
import { isChallengeLive } from "@/lib/recruiterChallenge";

// ============================================================================
// Mode definitions
// ============================================================================
type ModeSize = "hero" | "standard";

type Mode = {
  id: string;
  category: string;
  title: string;
  subtitle: string;
  bestFor: string;
  neon: string;
  neonRGB: string;
  icon: string;
  size: ModeSize;
  href: string;
};

const MODES: Mode[] = [
  {
    id: "discovery",
    category: "DISCOVERY",
    title: "Explore New Adventures",
    subtitle: "Get out and Discover what your City has to offer! Have fun. LetsGo!",
    bestFor: "Solo",
    neon: "#FF2D78",
    neonRGB: "255,45,120",
    icon: "✦",
    size: "hero",
    href: "/swipe",
  },
  {
    id: "datenight",
    category: "DATE NIGHT",
    title: "Date Night Generator",
    subtitle: "Skip the 'where should we go?' debate. Relationship saved.",
    bestFor: "Couples",
    neon: "#00E5FF",
    neonRGB: "0,229,255",
    icon: "♡",
    size: "hero",
    href: "/datenight",
  },
  {
    id: "1on1",
    category: "1 ON 1",
    title: "5 → 3 → 1 Pick",
    subtitle: "Narrow it down together.",
    bestFor: "2 people",
    neon: "#FFD600",
    neonRGB: "255,214,0",
    icon: "◎",
    size: "standard",
    href: "/5v3v1",
  },
  {
    id: "friends",
    category: "FRIENDS",
    title: "Group Vote",
    subtitle: "Everyone votes, one place wins.",
    bestFor: "Friend groups",
    neon: "#00FF87",
    neonRGB: "0,255,135",
    icon: "⬡",
    size: "standard",
    href: "/group",
  },
  {
    id: "events",
    category: "EVENTS",
    title: "What's Happening",
    subtitle: "Concerts, trivia & more.",
    bestFor: "Planning ahead",
    neon: "#D050FF",
    neonRGB: "208,80,255",
    icon: "◈",
    size: "standard",
    href: "/events",
  },
  {
    id: "experiences",
    category: "LETSGO EXPERIENCES",
    title: "Make Every Experience Count",
    subtitle: "Real photos & videos from user experiences.",
    bestFor: "Explore",
    neon: "#FF6B2D",
    neonRGB: "255,107,45",
    icon: "❛",
    size: "standard",
    href: "/experiences",
  },
];

// ============================================================================
// NeonCard
// ============================================================================
function NeonCard({ mode, index, isHero, notification, notificationColor, notificationIcon }: { mode: Mode; index: number; isHero: boolean; notification?: number; notificationColor?: "yellow" | "green"; notificationIcon?: string }) {
  const [hovered, setHovered] = useState(false);

  return (
    <>
      <style>{`
        @keyframes borderTravel-${mode.id} {
          0% { background-position: 0% 50%; }
          100% { background-position: 300% 50%; }
        }
        @keyframes neonFlicker-${mode.id} {
          0%, 100% { text-shadow: 0 0 8px ${mode.neon}90, 0 0 20px ${mode.neon}50; }
          5% { text-shadow: 0 0 4px ${mode.neon}40, 0 0 10px ${mode.neon}20; }
          6% { text-shadow: 0 0 8px ${mode.neon}90, 0 0 20px ${mode.neon}50; }
          45% { text-shadow: 0 0 8px ${mode.neon}90, 0 0 20px ${mode.neon}50; }
          46% { text-shadow: 0 0 2px ${mode.neon}30, 0 0 6px ${mode.neon}15; }
          48% { text-shadow: 0 0 8px ${mode.neon}90, 0 0 20px ${mode.neon}50; }
        }
      `}</style>
      <Link
        href={mode.href}
        className="lg-neon-card"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: "relative",
          borderRadius: 4,
          cursor: "pointer",
          display: "block",
          textDecoration: "none",
          transition: "all 0.4s cubic-bezier(0.23, 1, 0.32, 1)",
          transform: hovered ? "translateY(-4px)" : "translateY(0)",
          animation: `cardSlideUp 0.7s cubic-bezier(0.23, 1, 0.32, 1) ${0.2 + index * 0.1}s both`,
        }}
      >
        {/* Notification badge */}
        {notification && notification > 0 && (
          <div style={{
            position: "absolute", top: -14, right: -14, zIndex: 20,
            display: "flex", alignItems: "center", gap: 4,
            animation: `${notificationColor === "green" ? "notifStarBlinkGreen" : "notifStarBlink"} 1.5s ease-in-out infinite`,
          }}>
            <span style={{ fontSize: 32, lineHeight: 1 }}>{notificationIcon || "⭐"}</span>
            {notification > 1 && (
              <span style={{
                fontSize: 10, fontWeight: 700, color: "#0C0C14",
                background: notificationColor === "green" ? "#00FF87" : "#39ff14", borderRadius: 50,
                minWidth: 16, height: 16, display: "flex",
                alignItems: "center", justifyContent: "center",
                padding: "0 4px",
                boxShadow: notificationColor === "green" ? "0 0 8px rgba(0,255,135,0.6)" : "0 0 8px rgba(57,255,20,0.6)",
              }}>
                {notification}
              </span>
            )}
          </div>
        )}

        {/* Animated neon border */}
        <div
          style={{
            position: "absolute",
            inset: -4,
            borderRadius: 8,
            background: `linear-gradient(90deg, transparent, ${mode.neon}, transparent, ${mode.neon}, transparent)`,
            backgroundSize: "300% 100%",
            animation: `borderTravel-${mode.id} 10s linear infinite`,
            opacity: notification && notification > 0 ? 0.9 : (hovered ? 0.9 : 0.4),
            transition: "opacity 0.4s ease",
          }}
        />

        {/* Inner card */}
        <div
          style={{
            position: "absolute",
            inset: 4,
            borderRadius: 3,
            background: "#0C0C14",
            overflow: "hidden",
          }}
        >
          {/* Dot grid pattern */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: hovered ? 0.12 : 0.05,
              transition: "opacity 0.5s ease",
              backgroundImage: `radial-gradient(circle, ${mode.neon} 1px, transparent 1px)`,
              backgroundSize: "20px 20px",
              backgroundPosition: "10px 10px",
            }}
          />

          {/* Neon glow wash */}
          <div
            style={{
              position: "absolute",
              bottom: -40,
              left: "50%",
              transform: "translateX(-50%)",
              width: "80%",
              height: 120,
              background: `radial-gradient(ellipse, rgba(${mode.neonRGB},${hovered ? 0.15 : 0.06}) 0%, transparent 70%)`,
              transition: "all 0.5s ease",
              filter: "blur(20px)",
            }}
          />

          {/* Content */}
          <div
            style={{
              position: "relative",
              zIndex: 2,
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: isHero ? "22px 26px" : "18px 20px",
            }}
          >
            <div>
              {/* Category label */}
              <div
                style={{
                  display: "inline-block",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.2em",
                  color: mode.neon,
                  animation: `neonFlicker-${mode.id} 12s ease-in-out infinite`,
                  animationDelay: `${index * 0.5}s`,
                  marginBottom: isHero ? 14 : 10,
                  padding: "4px 0",
                  borderBottom: `1px solid rgba(${mode.neonRGB}, 0.25)`,
                }}
              >
                {mode.icon} {mode.category}
              </div>

              {/* Title */}
              <h2
                style={{
                  fontFamily: "'Clash Display', 'DM Sans', sans-serif",
                  fontSize: isHero ? 28 : 18,
                  fontWeight: 700,
                  color: "#fff",
                  margin: 0,
                  lineHeight: 1.15,
                  letterSpacing: "-0.01em",
                  transition: "text-shadow 0.4s ease",
                  textShadow: hovered ? `0 0 30px rgba(${mode.neonRGB}, 0.3)` : "none",
                }}
              >
                {mode.title}
              </h2>

              {/* Subtitle */}
              <p
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: isHero ? 12 : 10.5,
                  color: "rgba(255,255,255,0.4)",
                  margin: isHero ? "10px 0 0" : "8px 0 0",
                  lineHeight: 1.5,
                  maxWidth: 320,
                  letterSpacing: "0.02em",
                }}
              >
                {mode.subtitle}
              </p>
            </div>

            {/* Bottom */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 10,
                  color: "rgba(255,255,255,0.25)",
                  fontWeight: 500,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {mode.bestFor}
              </span>

              {/* Enter button */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 14px",
                  borderRadius: 2,
                  border: `1px solid rgba(${mode.neonRGB}, ${hovered ? 0.7 : 0.2})`,
                  background: hovered ? `rgba(${mode.neonRGB}, 0.1)` : "transparent",
                  transition: "all 0.3s ease",
                }}
              >
                <span
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: "0.15em",
                    color: hovered ? mode.neon : "rgba(255,255,255,0.4)",
                    transition: "color 0.3s ease",
                    textTransform: "uppercase",
                  }}
                >
                  Enter
                </span>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 16 16"
                  fill="none"
                  style={{
                    transition: "transform 0.3s ease",
                    transform: hovered ? "translateX(3px)" : "translateX(0)",
                  }}
                >
                  <path
                    d="M3 8h10M9 4l4 4-4 4"
                    stroke={hovered ? mode.neon : "rgba(255,255,255,0.4)"}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </>
  );
}

// ============================================================================
// MarqueeText
// ============================================================================
function MarqueeText({ text, speed = 30 }: { text: string; speed?: number }) {
  const content = `${text}     ·     ${text}     ·     ${text}     ·     `;
  return (
    <div style={{ overflow: "hidden", whiteSpace: "nowrap" }}>
      <div
        style={{
          display: "inline-block",
          animation: `marqueeScroll ${speed}s linear infinite`,
        }}
      >
        <span>{content}</span>
        <span>{content}</span>
      </div>
    </div>
  );
}

// ============================================================================
// PerimeterBulbs
// ============================================================================
function PerimeterBulbs() {
  const ref = useRef<HTMLDivElement>(null);
  const [bulbs, setBulbs] = useState<Array<{ x: number; y: number; i: number }>>([]);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    const el = container.parentElement;
    if (!el) return;

    function calcBulbs() {
      if (!el) return;
      const W = el.offsetWidth;
      const H = el.offsetHeight;
      if (W === 0 || H === 0) return;
      const pad = 15;
      const spacing = 17;
      const pts: Array<{ x: number; y: number; i: number }> = [];
      let idx = 0;

      for (let x = pad; x <= W - pad; x += spacing) pts.push({ x, y: pad, i: idx++ });
      for (let y = pad + spacing; y <= H - pad; y += spacing) pts.push({ x: W - pad, y, i: idx++ });
      for (let x = W - pad - spacing; x >= pad; x -= spacing) pts.push({ x, y: H - pad, i: idx++ });
      for (let y = H - pad - spacing; y >= pad + spacing; y -= spacing) pts.push({ x: pad, y, i: idx++ });

      setBulbs(pts);
    }

    calcBulbs();

    const ro = new ResizeObserver(calcBulbs);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const total = bulbs.length || 1;

  return (
    <div ref={ref} style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 3 }}>
      {bulbs.map((b) => (
        <div
          key={`pb-${b.i}`}
          style={{
            position: "absolute",
            left: b.x,
            top: b.y,
            width: 7,
            height: 7,
            borderRadius: "50%",
            transform: "translate(-50%, -50%)",
            background: `hsl(${(b.i * 360) / total}, 100%, 70%)`,
            boxShadow: `0 0 4px hsl(${(b.i * 360) / total}, 100%, 60%), 0 0 9px hsl(${(b.i * 360) / total}, 100%, 50%)`,
            animation: "bulbChase 2.5s ease-in-out infinite",
            animationDelay: `${b.i * 0.04}s`,
          }}
        />
      ))}
    </div>
  );
}

// ============================================================================
// FeaturedCarousel
// ============================================================================
const GRADIENT_FALLBACKS = [
  "linear-gradient(135deg, #1a0a2e 0%, #3d1a6e 30%, #c94b4b 60%, #f0a500 100%)",
  "linear-gradient(135deg, #0f2027 0%, #203a43 30%, #2c5364 60%, #00b4d8 100%)",
  "linear-gradient(135deg, #1b0000 0%, #6b1010 30%, #c94b4b 60%, #ff9a76 100%)",
  "linear-gradient(135deg, #0a1628 0%, #1a3a5c 30%, #4a90d9 60%, #89CFF0 100%)",
];

function FeaturedCarousel({ images }: { images?: string[] }) {
  const hasImages = images && images.length > 0;
  const slideCount = hasImages ? images.length : GRADIENT_FALLBACKS.length;
  const [current, setCurrent] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    if (slideCount <= 1) return;
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setCurrent((prev) => (prev + 1) % slideCount);
        setFade(true);
      }, 400);
    }, 5000);
    return () => clearInterval(interval);
  }, [slideCount]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        background: "#080810",
      }}
    >
      {hasImages
        ? images.map((src, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                inset: 0,
                opacity: i === current ? (fade ? 1 : 0) : 0,
                transition: "opacity 1.5s ease-in-out",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt="Featured business photo"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
          ))
        : GRADIENT_FALLBACKS.map((bg, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                inset: 0,
                background: bg,
                opacity: i === current ? (fade ? 1 : 0) : 0,
                transition: "opacity 1.5s ease-in-out",
              }}
            />
          ))}

      {/* Dot indicators */}
      {slideCount > 1 && (
        <div
          style={{
            position: "absolute",
            bottom: 12,
            left: 14,
            display: "flex",
            gap: 6,
            zIndex: 6,
          }}
        >
          {Array.from({ length: slideCount }).map((_, i) => (
            <div
              key={i}
              onClick={() => {
                setFade(false);
                setTimeout(() => {
                  setCurrent(i);
                  setFade(true);
                }, 300);
              }}
              style={{
                width: i === current ? 20 : 6,
                height: 6,
                borderRadius: 3,
                background: i === current ? "#FFD600" : "rgba(255,255,255,0.3)",
                boxShadow: i === current ? "0 0 6px #FFD600" : "none",
                transition: "all 0.4s ease",
                cursor: "pointer",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Types
// ============================================================================
type SpotlightAd = {
  campaignId: string;
  campaignType: string;
  businessId: string;
  businessName: string;
  businessType: string;
  category: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  description: string;
  website: string;
  images: string[];
};

// ============================================================================
// Main Page
// ============================================================================
export default function HomePage() {
  const router = useRouter();
  const [time, setTime] = useState<Date | null>(null);
  const [spotlightAds, setSpotlightAds] = useState<SpotlightAd[]>([]);
  const [spotlightIdx, setSpotlightIdx] = useState(0);
  const spotlightAd = spotlightAds.length > 0 ? spotlightAds[spotlightIdx % spotlightAds.length] : null;
  const [userZipLoaded, setUserZipLoaded] = useState(false);
  const [userZip, setUserZip] = useState<string | null>(null);
  const [incomingGameCount, setIncomingGameCount] = useState(0);
  const [activeGroupGameCount, setActiveGroupGameCount] = useState(0);
  const [authChecked, setAuthChecked] = useState(false);

  // Onboarding tour
  const homeTourSteps: TourStep[] = useMemo(() => [
    { target: '[data-tour="mode-discovery"]', title: "Discover Places Near You", description: "Swipe through restaurants, bars, and activities. Filter by cuisine, price, distance, and vibe to find your perfect spot.", position: "bottom" },
    { target: '[data-tour="mode-datenight"]', title: "Date Night Generator", description: "Can't decide where to go? We pick one restaurant and one activity for the perfect date night. No planning needed.", position: "bottom" },
    { target: '[data-tour="mode-1on1"]', title: "5 → 3 → 1 Pick", description: "Can't agree with a friend? You pick 5 places, they narrow it to 3, then you choose the final 1. No more \"I don't know, you pick.\"", position: "bottom" },
    { target: '[data-tour="mode-friends"]', title: "Group Vote", description: "Going out with the crew? Everyone adds options and votes together. The group decides, no arguments.", position: "bottom" },
    { target: '[data-tour="mode-events"]', title: "Events Near You", description: "Find what's happening tonight — trivia, live music, tastings, comedy shows, and more. All in one place.", position: "bottom" },
    { target: '[data-tour="mode-experiences"]', title: "User Experiences", description: "See real photos and videos from people visiting local spots. Share your own experiences too!", position: "bottom" },
    { target: '[data-tour="spotlight-section"]', title: "LetsGo Spotlight", description: "Businesses that want to stand out show up here. Check them out for special offers and new openings.", position: "bottom" },
    { target: '[data-tour="notification-bell"]', title: "Stay in the Loop", description: "Get notified when receipts are approved, when you earn cashback, or when friends invite you to games.", position: "left" },
    { target: '[data-tour="profile-btn"]', title: "Your Profile & Earnings", description: "Check your cashback balance, upload receipts, see your level progress, and manage your account.", position: "left" },
  ], []);
  const homeTourIllustrations: React.ReactNode[] = useMemo(() => [
    <ModeDiscoveryAnim key="disc" />,
    <ModeDateNightAnim key="dn" />,
    <Mode531Anim key="531" />,
    <ModeGroupVoteAnim key="gv" />,
    <ModeEventsAnim key="ev" />,
    <ModeExperiencesAnim key="exp" />,
    <SpotlightAnim key="sp" />,
    <BellAnim key="b" />,
    <ProfileAnim key="p" />,
  ], []);
  const tour = useOnboardingTour("home", homeTourSteps, 800);

  // Redirect unauthenticated users to Welcome page
  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabaseBrowser.auth.getSession();
        if (!session) {
          router.replace("/welcome");
          return;
        }
        setAuthChecked(true);
      } catch {
        router.replace("/welcome");
      }
    })();
  }, [router]);

  useEffect(() => {
    setTime(new Date());
    const t = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  // Check for incoming 5v3v1 games where user is Player 2
  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabaseBrowser.auth.getSession();
        if (!session?.access_token) return;
        const res = await fetch("/api/games", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) return;
        const { games } = await res.json();
        // Count games where user is P2 and it's their turn (pick3 state)
        const userId = session.user.id;
        const incoming = (games ?? []).filter(
          (g: { player2_id: string | null; player1_id: string; status: string }) =>
            g.player2_id === userId && g.status !== "complete" && g.status !== "expired"
        );
        setIncomingGameCount(incoming.length);
      } catch { /* not logged in or no games */ }
    })();
  }, []);

  // Check for active group vote games
  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabaseBrowser.auth.getSession();
        if (!session?.access_token) return;
        const res = await fetch("/api/group-games?status=active", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) return;
        const { games } = await res.json();
        setActiveGroupGameCount((games ?? []).length);
      } catch { /* not logged in or no games */ }
    })();
  }, []);

  // Load user's saved home zip for spotlight filtering
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabaseBrowser.auth.getUser();
        if (user) {
          const { data } = await supabaseBrowser
            .from("profiles")
            .select("zip_code")
            .eq("id", user.id)
            .maybeSingle();
          if (data?.zip_code) setUserZip(data.zip_code);
        }
      } catch { /* not logged in */ }
      setUserZipLoaded(true);
    })();
  }, []);

  // Fetch active spotlight campaigns (waits for zip to load)
  useEffect(() => {
    if (!userZipLoaded) return;
    const url = userZip ? `/api/spotlight?zip=${encodeURIComponent(userZip)}` : "/api/spotlight";
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (data.ads && data.ads.length > 0) {
          setSpotlightAds(data.ads);
        } else if (data.ad) {
          setSpotlightAds([data.ad]);
        }
      })
      .catch(() => {});
  }, [userZipLoaded, userZip]);

  // Rotate spotlight ads every 30 seconds when multiple ads exist
  useEffect(() => {
    if (spotlightAds.length <= 1) return;
    const interval = setInterval(() => {
      setSpotlightIdx((prev) => (prev + 1) % spotlightAds.length);
    }, 30000);
    return () => clearInterval(interval);
  }, [spotlightAds.length]);

  const timeStr = time ? time.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";

  const heroCards = MODES.filter((m) => m.size === "hero");
  const stdCards = MODES.filter((m) => m.size === "standard");

  const handleSignOut = async () => {
    await supabaseBrowser.auth.signOut();
    router.push("/welcome");
  };

  if (!authChecked) {
    return <div style={{ minHeight: "100vh", background: "#000" }} />;
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&display=swap');
        @import url('https://api.fontshare.com/v2/css?f[]=clash-display@700,600,500&display=swap');

        @keyframes cardSlideUp {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes marqueeScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes logoGlow {
          0%, 100% { filter: drop-shadow(0 0 10px #FF2D78) drop-shadow(0 0 25px #FF2D7850); }
          17% { filter: drop-shadow(0 0 10px #00E5FF) drop-shadow(0 0 25px #00E5FF50); }
          33% { filter: drop-shadow(0 0 10px #FFD600) drop-shadow(0 0 25px #FFD60050); }
          50% { filter: drop-shadow(0 0 10px #00FF87) drop-shadow(0 0 25px #00FF8750); }
          67% { filter: drop-shadow(0 0 10px #D050FF) drop-shadow(0 0 25px #D050FF50); }
          83% { filter: drop-shadow(0 0 10px #FF6B2D) drop-shadow(0 0 25px #FF6B2D50); }
        }
        @keyframes logoBorderCycle {
          0%, 100% { border-color: #FF2D78; }
          17% { border-color: #00E5FF; }
          33% { border-color: #FFD600; }
          50% { border-color: #00FF87; }
          67% { border-color: #D050FF; }
          83% { border-color: #FF6B2D; }
        }
        @keyframes notifStarBlink {
          0%, 100% { opacity: 1; transform: scale(1) rotate(0deg); filter: drop-shadow(0 0 6px #FFD600) drop-shadow(0 0 12px #FFD60080); }
          25% { opacity: 0.5; transform: scale(0.75) rotate(15deg); filter: drop-shadow(0 0 2px #FFD60040); }
          50% { opacity: 1; transform: scale(1.15) rotate(0deg); filter: drop-shadow(0 0 10px #FFD600) drop-shadow(0 0 20px #FFD60080); }
          75% { opacity: 0.7; transform: scale(0.9) rotate(-10deg); filter: drop-shadow(0 0 4px #FFD60060); }
        }
        @keyframes notifStarBlinkGreen {
          0%, 100% { opacity: 1; transform: scale(1) rotate(0deg); filter: drop-shadow(0 0 6px #00FF87) drop-shadow(0 0 12px #00FF8780); }
          25% { opacity: 0.5; transform: scale(0.75) rotate(15deg); filter: drop-shadow(0 0 2px #00FF8740); }
          50% { opacity: 1; transform: scale(1.15) rotate(0deg); filter: drop-shadow(0 0 10px #00FF87) drop-shadow(0 0 20px #00FF8780); }
          75% { opacity: 0.7; transform: scale(0.9) rotate(-10deg); filter: drop-shadow(0 0 4px #00FF8760); }
        }
        @keyframes bulbChase {
          0% { opacity: 0.25; transform: translate(-50%, -50%) scale(0.8); }
          25% { opacity: 1; transform: translate(-50%, -50%) scale(1.15); filter: brightness(1.5); }
          50% { opacity: 0.5; transform: translate(-50%, -50%) scale(0.95); filter: brightness(1); }
          75% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); filter: brightness(1.4); }
          100% { opacity: 0.25; transform: translate(-50%, -50%) scale(0.8); }
        }

        /* Responsive grids */
        .lg-hero-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
        .lg-std-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 48px; }
        .lg-content { max-width: 920px; margin: 0 auto; padding: 0 28px; position: relative; z-index: 2; }
        .lg-header { padding: 32px 0; }
        .lg-header-gap { gap: 16px; }
        .lg-marquee-wrap { margin: 0 -28px 36px; }
        .lg-spotlight-inner { display: flex; }
        .lg-spotlight-carousel { width: 45%; position: relative; overflow: hidden; background: #080810; min-height: 220px; }
        .lg-spotlight-spacer { width: 40px; flex-shrink: 0; }
        .lg-spotlight-pad-y { height: 40px; }
        .lg-spotlight-text { flex: 1; padding: 24px 28px; display: flex; flex-direction: column; justify-content: space-between; }
        .lg-spotlight-title { font-size: 26px; }
        .lg-spotlight-desc { font-size: 13px; }
        .lg-time { display: inline; }
        .lg-neon-card { height: 260px; }

        @media (max-width: 768px) {
          .lg-neon-card { height: 220px; }
          .lg-hero-grid { grid-template-columns: 1fr; gap: 16px; }
          .lg-std-grid { grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 32px; }
          .lg-content { padding: 0 16px; }
          .lg-header { padding: 20px 0; }
          .lg-header-gap { gap: 10px; }
          .lg-marquee-wrap { margin: 0 -16px 24px; }
          .lg-spotlight-inner { flex-direction: column; }
          .lg-spotlight-carousel { width: 100%; min-height: 200px; }
          .lg-spotlight-spacer { width: 30px; }
          .lg-spotlight-pad-y { height: 30px; }
          .lg-spotlight-text { padding: 18px 16px; }
          .lg-spotlight-title { font-size: 20px; }
          .lg-spotlight-desc { font-size: 12px; }
          .lg-time { display: none; }
        }

        @media (max-width: 480px) {
          .lg-std-grid { grid-template-columns: 1fr; }
          .lg-spotlight-spacer { width: 26px; }
          .lg-spotlight-pad-y { height: 26px; }
        }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          background: "#08080E",
          position: "relative",
          overflow: "hidden",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        {/* Scanline overlay */}
        <div
          style={{
            position: "fixed",
            inset: 0,
            background:
              "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.008) 2px, rgba(255,255,255,0.008) 4px)",
            pointerEvents: "none",
            zIndex: 10,
          }}
        />

        {/* Top rainbow bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background:
              "linear-gradient(90deg, #FF2D78, #00E5FF, #FFD600, #00FF87, #D050FF, #FF6B2D, #FF2D78)",
            backgroundSize: "200% 100%",
            animation: "marqueeScroll 20s linear infinite",
            boxShadow: "0 0 20px rgba(255,45,120,0.4), 0 0 60px rgba(0,229,255,0.2)",
          }}
        />

        {/* Content */}
        <div className="lg-content">
          {/* Header */}
          <header
            className="lg-header"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              animation: "fadeIn 0.5s ease both",
            }}
          >
            <div className="lg-header-gap" style={{ display: "flex", alignItems: "center" }}>
              {/* Logo */}
              <div style={{ animation: "logoGlow 12s ease-in-out infinite" }}>
                <Image
                  src="/lg-logo.png"
                  alt="LetsGo"
                  width={42}
                  height={42}
                  style={{
                    borderRadius: 6,
                    border: "2px solid var(--logo-border-color, #FF2D78)",
                    background: "rgba(255,255,255,0.03)",
                    animation: "logoBorderCycle 12s linear infinite",
                  }}
                />
              </div>
              <div>
                <div
                  style={{
                    fontFamily: "'Clash Display', 'DM Sans', sans-serif",
                    fontSize: 17,
                    color: "#fff",
                    letterSpacing: "0.08em",
                  }}
                >
                  LetsGo
                </div>
              </div>
            </div>

            <div className="lg-header-gap" style={{ display: "flex", alignItems: "center" }}>
              <span
                className="lg-time"
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.25)",
                  letterSpacing: "0.1em",
                }}
              >
                {timeStr}
              </span>

              <span data-tour="notification-bell">
                <NotificationBell />
              </span>

              {/* Profile button */}
              <Link
                href="/profile"
                data-tour="profile-btn"
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 4,
                  border: "1px solid rgba(255,255,255,0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  transition: "border-color 0.3s ease",
                  textDecoration: "none",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="8" r="4" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" />
                  <path
                    d="M4 20c0-4 3.6-7 8-7s8 3 8 7"
                    stroke="rgba(255,255,255,0.45)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </Link>

              {/* Sign out button */}
              <button
                onClick={handleSignOut}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 4,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  transition: "border-color 0.3s ease, background 0.3s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgba(239,68,68,0.5)";
                  e.currentTarget.style.background = "rgba(239,68,68,0.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
                  e.currentTarget.style.background = "transparent";
                }}
                title="Sign Out"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"
                    stroke="rgba(255,255,255,0.45)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </header>

          {/* Marquee banner */}
          <div
            className="lg-marquee-wrap"
            style={{
              padding: "10px 0",
              borderTop: "1px solid rgba(255,255,255,0.06)",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              fontSize: 11,
              color: "rgba(255,255,255,0.2)",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              fontWeight: 600,
              animation: "fadeIn 0.5s ease 0.1s both",
            }}
          >
            <MarqueeText text="GO. PLAY. EAT. GET PAID TO LIVE YOUR BEST LIFE." speed={25} />
          </div>

          {/* ========== RECRUITMENT CHALLENGE SECTION ========== */}
          {isChallengeLive() && <RecruitmentSpotlightCard />}

          {/* ========== PRIORITY ADS / SPOTLIGHT SECTION ========== */}
          <div
            data-tour="spotlight-section"
            style={{
              marginBottom: 36,
              padding: "0 12px",
              animation: "fadeIn 0.5s ease 0.2s both",
            }}
          >
            {/* Section header */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#FFD600",
                  boxShadow: "0 0 6px #FFD600, 0 0 12px #FFD60050",
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#FFD600",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  textShadow: "0 0 10px rgba(255,214,0,0.3)",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                LetsGo Spotlight
              </span>
            </div>

            {/* Ad Card with perimeter lights */}
            <div
              style={{
                cursor: "pointer",
                transition: "all 0.4s cubic-bezier(0.23, 1, 0.32, 1)",
                borderRadius: 8,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-4px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <div
                style={{
                  borderRadius: 8,
                  background: "#0a0a12",
                  position: "relative",
                  overflow: "visible",
                }}
              >
                <PerimeterBulbs />

                <div className="lg-spotlight-pad-y" />
                <div style={{ display: "flex" }}>
                  <div className="lg-spotlight-spacer" />

                  {/* Content card */}
                  <div
                    className="lg-spotlight-inner"
                    style={{
                      flex: 1,
                      borderRadius: 4,
                      background: "#0C0C14",
                      overflow: "hidden",
                      minHeight: 260,
                    }}
                  >
                    <div className="lg-spotlight-carousel">
                      <FeaturedCarousel key={spotlightAd?.campaignId || "default"} images={spotlightAd?.images} />
                    </div>
                    <div className="lg-spotlight-text">
                      <div>
                        <div
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            letterSpacing: "0.12em",
                            color: "#FFD600",
                            marginBottom: 12,
                            fontFamily: "'DM Sans', sans-serif",
                            textTransform: "uppercase",
                          }}
                        >
                          {spotlightAd
                            ? [spotlightAd.category, spotlightAd.businessType]
                                .filter(Boolean)
                                .join(" · ") || "Featured Business"
                            : "Your Ad Here"}
                        </div>
                        <h3
                          className="lg-spotlight-title"
                          style={{
                            fontFamily: "'Clash Display', 'DM Sans', sans-serif",
                            fontWeight: 700,
                            color: "#fff",
                            margin: 0,
                            lineHeight: 1.15,
                            letterSpacing: "-0.01em",
                            marginBottom: 10,
                          }}
                        >
                          {spotlightAd ? spotlightAd.businessName : "LetsGo Spotlight"}
                        </h3>
                        <p
                          className="lg-spotlight-desc"
                          style={{
                            fontFamily: "'DM Sans', sans-serif",
                            color: "rgba(255,255,255,0.45)",
                            lineHeight: 1.5,
                            marginBottom: 14,
                            maxWidth: 320,
                          }}
                        >
                          {spotlightAd
                            ? spotlightAd.description
                            : "Get your business featured here. Priority advertising puts you front and center for every LetsGo user."}
                        </p>
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 16,
                            fontSize: 11,
                            color: "rgba(255,255,255,0.35)",
                            fontFamily: "'DM Sans', sans-serif",
                          }}
                        >
                          {spotlightAd ? (
                            <>
                              {spotlightAd.address && (
                                <span>
                                  📍 {spotlightAd.address}
                                  {spotlightAd.city ? `, ${spotlightAd.city}` : ""}
                                </span>
                              )}
                              {spotlightAd.phone && <span>📞 {spotlightAd.phone}</span>}
                              {spotlightAd.website && <span>🌐 {spotlightAd.website}</span>}
                            </>
                          ) : (
                            <span>Spotlight campaigns start at $99</span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}>
                        <span
                          style={{
                            fontSize: 11,
                            color: "rgba(255,255,255,0.25)",
                            fontFamily: "'DM Sans', sans-serif",
                          }}
                        >
                          {spotlightAd
                            ? [spotlightAd.city, spotlightAd.state].filter(Boolean).join(", ")
                            : ""}
                        </span>
                        {spotlightAd && (
                          <Link
                            href={`/swipe?spotlight=${spotlightAd.businessId}`}
                            style={{
                              marginLeft: "auto",
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              padding: "6px 14px",
                              borderRadius: 2,
                              border: "1px solid rgba(255,214,0,0.3)",
                              background: "rgba(255,214,0,0.05)",
                              cursor: "pointer",
                              textDecoration: "none",
                            }}
                          >
                            <span
                              style={{
                                fontFamily: "'DM Sans', sans-serif",
                                fontSize: 10,
                                fontWeight: 600,
                                letterSpacing: "0.15em",
                                color: "#FFD600",
                                textTransform: "uppercase",
                              }}
                            >
                              View
                            </span>
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                              <path
                                d="M3 8h10M9 4l4 4-4 4"
                                stroke="#FFD600"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </Link>
                        )}
                      </div>
                      {/* Rotation dots — only shown when multiple spotlight ads */}
                      {spotlightAds.length > 1 && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12 }}>
                          {spotlightAds.map((_, i) => (
                            <button
                              key={i}
                              onClick={() => setSpotlightIdx(i)}
                              aria-label={`Show spotlight ad ${i + 1}`}
                              style={{
                                width: spotlightIdx % spotlightAds.length === i ? 18 : 6,
                                height: 6,
                                borderRadius: 3,
                                border: "none",
                                cursor: "pointer",
                                background: spotlightIdx % spotlightAds.length === i ? "#FFD600" : "rgba(255,255,255,0.2)",
                                transition: "all 0.3s ease",
                                padding: 0,
                              }}
                            />
                          ))}
                          <span style={{ marginLeft: 8, fontSize: 9, color: "rgba(255,255,255,0.2)", fontFamily: "'DM Sans', sans-serif" }}>
                            {(spotlightIdx % spotlightAds.length) + 1}/{spotlightAds.length}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="lg-spotlight-spacer" />
                </div>
                <div className="lg-spotlight-pad-y" />
              </div>
            </div>
          </div>

          {/* Hero Cards */}
          <div className="lg-hero-grid">
            {heroCards.map((mode, i) => (
              <div key={mode.id} data-tour={`mode-${mode.id}`}>
                <NeonCard mode={mode} index={i} isHero />
              </div>
            ))}
          </div>

          {/* Standard Cards */}
          <div className="lg-std-grid">
            {stdCards.map((mode, i) => (
              <div key={mode.id} data-tour={`mode-${mode.id}`}>
                <NeonCard
                  mode={mode}
                  index={i + 2}
                  isHero={false}
                  notification={mode.id === "1on1" ? incomingGameCount : mode.id === "friends" ? activeGroupGameCount : undefined}
                  notificationColor={mode.id === "friends" ? "green" : "yellow"}
                  notificationIcon="⭐"
                />
              </div>
            ))}
          </div>

          {/* Opportunity CTAs */}
          <OpportunityCTA />

          {/* Footer */}
          <div
            style={{
              textAlign: "center",
              padding: "24px 0 40px",
              borderTop: "1px solid rgba(255,255,255,0.04)",
              animation: "fadeIn 0.6s ease 1.2s both",
            }}
          >
            <p
              style={{
                fontSize: 10,
                color: "rgba(255,255,255,0.15)",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
              }}
            >
              See profile for progressive payouts · Keep your receipts
            </p>
            <p
              style={{
                marginTop: 10,
                fontSize: 10,
                color: "rgba(255,255,255,0.18)",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              <Link href="/privacy" style={{ color: "inherit", textDecoration: "none" }}>Privacy</Link>
              <span style={{ margin: "0 8px", opacity: 0.5 }}>·</span>
              <Link href="/terms" style={{ color: "inherit", textDecoration: "none" }}>Terms</Link>
              <span style={{ margin: "0 8px", opacity: 0.5 }}>·</span>
              <span>© {new Date().getFullYear()} Olson Creations LLC</span>
            </p>
          </div>
        </div>

        {/* Bottom rainbow bar */}
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            height: 1,
            background:
              "linear-gradient(90deg, #FF6B2D, #D050FF, #00FF87, #FFD600, #00E5FF, #FF2D78, #FF6B2D)",
            backgroundSize: "200% 100%",
            animation: "marqueeScroll 24s linear infinite",
            boxShadow: "0 0 15px rgba(208,80,255,0.3), 0 0 40px rgba(0,255,135,0.15)",
          }}
        />
      </div>

      {tour.isTouring && tour.currentStep && (
        <OnboardingTooltip
          step={tour.currentStep}
          stepIndex={tour.stepIndex}
          totalSteps={tour.totalSteps}
          onNext={tour.next}
          onBack={tour.back}
          onSkip={tour.skip}
          illustration={tour.stepIndex >= 0 ? homeTourIllustrations[tour.stepIndex] : undefined}
        />
      )}
    </>
  );
}
