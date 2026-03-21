"use client";

import { useMemo } from "react";
import {
  getCurrentPhase,
  LAUNCH_DATES,
  countdownLabel,
  daysUntil,
  type LaunchPhase,
} from "@/lib/launchDates";

// ═══════════════════════════════════════════════════
// LAUNCH BANNER
// Phase-aware banners for the launch timeline
// ═══════════════════════════════════════════════════

type BannerVariant = "user" | "business" | "admin";

interface LaunchBannerProps {
  /** Which context the banner is in — determines styling */
  variant?: BannerVariant;
  /** Override which banner to show. Defaults to auto-detect from current date. */
  forcePhase?: LaunchPhase;
}

interface BannerConfig {
  emoji: string;
  title: string;
  subtitle: string;
  gradient: string;
  glowColor: string;
  accentColor: string;
}

function getBannerConfig(phase: LaunchPhase): BannerConfig | null {
  switch (phase) {
    case "pre_launch":
      return {
        emoji: "\u{1F6A7}",
        title: "Coming Soon!",
        subtitle: "LetsGo launches May 1st! Get ready to explore and discover.",
        gradient: "linear-gradient(135deg, #ff6b35 0%, #ff2d92 100%)",
        glowColor: "rgba(255,107,53,0.3)",
        accentColor: "#ff6b35",
      };
    case "live":
      return {
        emoji: "\u{1F389}",
        title: "We're LIVE!",
        subtitle: "Visit, upload receipts, and start earning cash-back rewards!",
        gradient: "linear-gradient(135deg, #39ff14 0%, #00d4ff 100%)",
        glowColor: "rgba(57,255,20,0.3)",
        accentColor: "#39ff14",
      };
    case "fully_live":
      return null; // No banner needed — everything is running normally
  }
}

function getBusinessBillingBanner(): BannerConfig | null {
  const phase = getCurrentPhase();
  const d = daysUntil(LAUNCH_DATES.BILLS_DUE);

  if (phase === "live" && d > 0) {
    return {
      emoji: "\u{1F4B3}",
      title: "First Billing Cycle",
      subtitle: `First bills are due in ${countdownLabel(LAUNCH_DATES.BILLS_DUE)}. Make sure your payment method is set up!`,
      gradient: "linear-gradient(135deg, #ffff00 0%, #ff6b35 100%)",
      glowColor: "rgba(255,255,0,0.2)",
      accentColor: "#ffff00",
    };
  }
  if (phase === "live" && d <= 0) {
    return {
      emoji: "\u{1F4B0}",
      title: "Bills Are Due!",
      subtitle: "Your first LetsGo bill is here. Review and pay below.",
      gradient: "linear-gradient(135deg, #ff2d92 0%, #ff6b35 100%)",
      glowColor: "rgba(255,45,146,0.2)",
      accentColor: "#ff2d92",
    };
  }
  return null;
}

function getCashoutBanner(): BannerConfig | null {
  const phase = getCurrentPhase();
  const d = daysUntil(LAUNCH_DATES.CASHOUTS_OPEN);

  if (phase === "fully_live") return null; // Cashouts are open — no banner

  if (d <= 0) return null;

  return {
    emoji: "\u{1F4B8}",
    title: "Cashouts Opening Soon!",
    subtitle: d === 1
      ? "Cashouts open tomorrow! Make sure your payout method is set up."
      : `Cash out your earnings starting ${countdownLabel(LAUNCH_DATES.CASHOUTS_OPEN) === "now" ? "now" : `in ${countdownLabel(LAUNCH_DATES.CASHOUTS_OPEN)}`}. Keep visiting and earning!`,
    gradient: "linear-gradient(135deg, #FFD600 0%, #00FF87 100%)",
    glowColor: "rgba(255,214,0,0.25)",
    accentColor: "#FFD600",
  };
}

// ─── USER-FACING BANNER (dark modern) ───
function UserBanner({ config }: { config: BannerConfig }) {
  return (
    <div
      style={{
        position: "relative",
        margin: "0 16px 0",
        padding: "14px 20px",
        borderRadius: 14,
        background: "rgba(255,255,255,0.04)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.08)",
        overflow: "hidden",
        zIndex: 20,
      }}
    >
      {/* Gradient accent bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: config.gradient,
        }}
      />
      {/* Glow */}
      <div
        style={{
          position: "absolute",
          top: -20,
          right: -20,
          width: 100,
          height: 100,
          borderRadius: "50%",
          background: config.glowColor,
          filter: "blur(40px)",
          pointerEvents: "none",
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 12, position: "relative" }}>
        <span style={{ fontSize: 24, flexShrink: 0 }}>{config.emoji}</span>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: config.accentColor,
              letterSpacing: "0.03em",
              fontFamily: "'Clash Display', 'DM Sans', sans-serif",
            }}
          >
            {config.title}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.55)",
              marginTop: 2,
              lineHeight: 1.4,
            }}
          >
            {config.subtitle}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── BUSINESS DASHBOARD BANNER (slate/teal theme) ───
function BusinessBanner({ config }: { config: BannerConfig }) {
  return (
    <div
      style={{
        position: "relative",
        padding: "16px 24px",
        borderRadius: 12,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        overflow: "hidden",
        marginBottom: 24,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: config.gradient,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: -30,
          right: -10,
          width: 120,
          height: 120,
          borderRadius: "50%",
          background: config.glowColor,
          filter: "blur(50px)",
          pointerEvents: "none",
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 14, position: "relative" }}>
        <span style={{ fontSize: 28, flexShrink: 0 }}>{config.emoji}</span>
        <div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "#ffffff",
              fontFamily: '"Poppins", sans-serif',
            }}
          >
            {config.title}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.55)",
              marginTop: 3,
              lineHeight: 1.5,
            }}
          >
            {config.subtitle}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ADMIN BANNER (dark neon theme) ───
function AdminBanner({ config }: { config: BannerConfig }) {
  return (
    <div
      style={{
        position: "relative",
        padding: "16px 24px",
        borderRadius: 12,
        background: "#1a1a2e",
        border: "1px solid #2d2d44",
        overflow: "hidden",
        marginBottom: 24,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: config.gradient,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: -20,
          right: 0,
          width: 100,
          height: 100,
          borderRadius: "50%",
          background: config.glowColor,
          filter: "blur(40px)",
          pointerEvents: "none",
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 14, position: "relative" }}>
        <span style={{ fontSize: 26, flexShrink: 0 }}>{config.emoji}</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#ffffff" }}>
            {config.title}
          </div>
          <div style={{ fontSize: 12, color: "#a0a0b0", marginTop: 2, lineHeight: 1.4 }}>
            {config.subtitle}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN EXPORTS ───

/** Auto-detecting launch phase banner for discovery/swipe/general pages */
export function LaunchBanner({ variant = "user", forcePhase }: LaunchBannerProps) {
  const config = useMemo(() => {
    const phase = forcePhase ?? getCurrentPhase();
    return getBannerConfig(phase);
  }, [forcePhase]);

  if (!config) return null;

  switch (variant) {
    case "business":
      return <BusinessBanner config={config} />;
    case "admin":
      return <AdminBanner config={config} />;
    default:
      return <UserBanner config={config} />;
  }
}

/** Cashout countdown banner for user profile */
export function CashoutBanner() {
  const config = useMemo(() => getCashoutBanner(), []);
  if (!config) return null;
  return <UserBanner config={config} />;
}

/** Billing countdown banner for business dashboard */
export function BillingBanner() {
  const config = useMemo(() => getBusinessBillingBanner(), []);
  if (!config) return null;
  return <BusinessBanner config={config} />;
}

// ─── ADMIN TIMELINE WIDGET ───

interface TimelinePhase {
  label: string;
  date: string;
  emoji: string;
  color: string;
}

const TIMELINE_PHASES: TimelinePhase[] = [
  { label: "Launch", date: LAUNCH_DATES.LAUNCH, emoji: "\u{1F389}", color: "#39ff14" },
  { label: "Bills Due", date: LAUNCH_DATES.BILLS_DUE, emoji: "\u{1F4B3}", color: "#ffff00" },
  { label: "Cashouts Open", date: LAUNCH_DATES.CASHOUTS_OPEN, emoji: "\u{1F4B8}", color: "#00d4ff" },
];

export function AdminLaunchTimeline() {
  const phase = getCurrentPhase();
  const today = new Date().toISOString().slice(0, 10);

  // Map phase to index for "current" highlighting
  const phaseIndex = (() => {
    switch (phase) {
      case "pre_launch": return -1;
      case "live": return 0;
      case "fully_live": return 3;
      default: return -1;
    }
  })();

  return (
    <div
      style={{
        background: "#1a1a2e",
        border: "1px solid #2d2d44",
        borderRadius: 12,
        padding: 24,
        marginBottom: 24,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.15em",
          color: "#a0a0b0",
          marginBottom: 20,
        }}
      >
        Launch Timeline
      </div>

      <div style={{ display: "flex", gap: 0, position: "relative" }}>
        {/* Connecting line */}
        <div
          style={{
            position: "absolute",
            top: 20,
            left: 40,
            right: 40,
            height: 3,
            background: "#2d2d44",
            borderRadius: 2,
          }}
        />
        {/* Progress fill */}
        <div
          style={{
            position: "absolute",
            top: 20,
            left: 40,
            width: phaseIndex >= 3 ? "calc(100% - 80px)" : `${Math.max(0, ((phaseIndex + 1) / 3) * 100)}%`,
            maxWidth: "calc(100% - 80px)",
            height: 3,
            background: "linear-gradient(90deg, #39ff14, #ffff00, #00d4ff)",
            borderRadius: 2,
            transition: "width 0.5s ease",
          }}
        />

        {TIMELINE_PHASES.map((p, i) => {
          const isPast = today >= p.date;
          const isCurrent = i === phaseIndex;
          const d = daysUntil(p.date);

          return (
            <div
              key={p.label}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                position: "relative",
                zIndex: 1,
              }}
            >
              {/* Node */}
              <div
                style={{
                  width: isCurrent ? 42 : 36,
                  height: isCurrent ? 42 : 36,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: isCurrent ? 20 : 16,
                  background: isPast || isCurrent ? `${p.color}20` : "#0f0f1a",
                  border: `2px solid ${isPast || isCurrent ? p.color : "#2d2d44"}`,
                  boxShadow: isCurrent ? `0 0 20px ${p.color}40` : "none",
                  transition: "all 0.3s ease",
                }}
              >
                {isPast && !isCurrent ? "\u2713" : p.emoji}
              </div>

              {/* Label */}
              <div
                style={{
                  marginTop: 10,
                  fontSize: 12,
                  fontWeight: isCurrent ? 700 : 500,
                  color: isPast || isCurrent ? "#ffffff" : "#a0a0b0",
                  textAlign: "center",
                }}
              >
                {p.label}
              </div>

              {/* Date */}
              <div
                style={{
                  fontSize: 10,
                  color: isCurrent ? p.color : "#666",
                  marginTop: 3,
                  textAlign: "center",
                }}
              >
                {new Date(p.date + "T00:00:00").toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>

              {/* Countdown */}
              {!isPast && (
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    color: p.color,
                    marginTop: 4,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  {d === 0 ? "TODAY" : d === 1 ? "TOMORROW" : `${d} days`}
                </div>
              )}
              {isPast && (
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    color: "#39ff14",
                    marginTop: 4,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  COMPLETE
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
