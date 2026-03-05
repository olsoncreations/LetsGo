"use client";

import React from "react";

// ─── Shared wrapper ───

function IllustrationBox({ children, gradient }: { children: React.ReactNode; gradient: string }) {
  return (
    <div
      style={{
        width: "100%",
        height: 140,
        borderRadius: 12,
        background: gradient,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

// ─── 1. Swipe Up/Down to Browse ───

export function SwipeVerticalAnim() {
  return (
    <IllustrationBox gradient="linear-gradient(135deg, #0a0a2e 0%, #1a0a3e 100%)">
      {/* Stacked cards */}
      <div style={{ position: "relative", width: 80, height: 100 }}>
        {/* Back card */}
        <div
          style={{
            position: "absolute",
            top: 10,
            left: 6,
            width: 68,
            height: 88,
            borderRadius: 10,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        />
        {/* Front card — bounces */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 68,
            height: 88,
            borderRadius: 10,
            background: "linear-gradient(135deg, #1a1a3e, #2a1a4e)",
            border: "1px solid rgba(0,212,255,0.25)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
            animation: "tourCardBounce 2s ease-in-out infinite",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(0,212,255,0.3)", marginBottom: 6 }} />
        </div>
      </div>

      {/* Hand with arrow */}
      <div
        style={{
          position: "absolute",
          right: 60,
          bottom: 20,
          animation: "tourHandVertical 2s ease-in-out infinite",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
        }}
      >
        <svg width="20" height="24" viewBox="0 0 20 24" fill="none">
          <path d="M10 0L5 6h10L10 0z" fill="rgba(0,212,255,0.6)" />
          <rect x="8" y="6" width="4" height="12" rx="2" fill="rgba(0,212,255,0.4)" />
          <path d="M10 24L5 18h10L10 24z" fill="rgba(0,212,255,0.6)" />
        </svg>
        <span style={{ fontSize: 28, filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.3))" }}>
          {"\u261D\uFE0F"}
        </span>
      </div>

      <style>{`
        @keyframes tourCardBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-16px); }
        }
        @keyframes tourHandVertical {
          0%, 100% { transform: translateY(8px); }
          50% { transform: translateY(-12px); }
        }
      `}</style>
    </IllustrationBox>
  );
}

// ─── 2. Swipe Left for Details ───

export function SwipeLeftAnim() {
  return (
    <IllustrationBox gradient="linear-gradient(135deg, #0a0a2e 0%, #0a1a3e 100%)">
      <div style={{ position: "relative", width: 160, height: 90 }}>
        {/* Details panel (behind) */}
        <div
          style={{
            position: "absolute",
            top: 5,
            right: 0,
            width: 70,
            height: 80,
            borderRadius: 8,
            background: "rgba(0,212,255,0.08)",
            border: "1px solid rgba(0,212,255,0.15)",
            padding: "10px 8px",
            display: "flex",
            flexDirection: "column",
            gap: 5,
          }}
        >
          <div style={{ width: "80%", height: 3, borderRadius: 2, background: "rgba(0,212,255,0.3)" }} />
          <div style={{ width: "60%", height: 3, borderRadius: 2, background: "rgba(0,212,255,0.2)" }} />
          <div style={{ width: "70%", height: 3, borderRadius: 2, background: "rgba(0,212,255,0.15)" }} />
          <div style={{ width: "50%", height: 3, borderRadius: 2, background: "rgba(0,212,255,0.1)" }} />
        </div>

        {/* Main card — slides left */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 80,
            height: 90,
            borderRadius: 10,
            background: "linear-gradient(135deg, #1a1a3e, #2a1a4e)",
            border: "1px solid rgba(191,95,255,0.25)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
            animation: "tourSlideLeft 2.5s ease-in-out infinite",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <div style={{ width: 30, height: 30, borderRadius: 6, background: "rgba(191,95,255,0.15)", border: "1px solid rgba(191,95,255,0.2)" }} />
          <div style={{ width: 44, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.15)" }} />
        </div>
      </div>

      {/* Arrow indicator */}
      <div
        style={{
          position: "absolute",
          bottom: 16,
          left: "50%",
          transform: "translateX(-50%)",
          animation: "tourArrowLeft 2.5s ease-in-out infinite",
          opacity: 0.6,
        }}
      >
        <svg width="40" height="16" viewBox="0 0 40 16" fill="none">
          <path d="M8 8L16 2v4h16v4H16v4L8 8z" fill="rgba(191,95,255,0.5)" />
        </svg>
      </div>

      <style>{`
        @keyframes tourSlideLeft {
          0%, 15% { transform: translateX(0); }
          40%, 60% { transform: translateX(-40px); }
          85%, 100% { transform: translateX(0); }
        }
        @keyframes tourArrowLeft {
          0%, 15% { transform: translateX(-50%) translateX(0); opacity: 0.6; }
          40%, 60% { transform: translateX(-50%) translateX(-12px); opacity: 0.3; }
          85%, 100% { transform: translateX(-50%) translateX(0); opacity: 0.6; }
        }
      `}</style>
    </IllustrationBox>
  );
}

// ─── 3. Filter / Search ───

export function FilterAnim() {
  return (
    <IllustrationBox gradient="linear-gradient(135deg, #0a1a2e 0%, #0a2a2e 100%)">
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        {/* Funnel icon */}
        <div style={{ position: "relative", animation: "tourFilterPulse 2s ease-in-out infinite" }}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <path
              d="M6 10h36l-12 14v10l-8 4V24L6 10z"
              fill="rgba(0,212,255,0.15)"
              stroke="rgba(0,212,255,0.5)"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Animated filter lines */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { width: 80, color: "rgba(0,212,255,0.4)", delay: "0s" },
            { width: 60, color: "rgba(57,255,20,0.3)", delay: "0.15s" },
            { width: 70, color: "rgba(191,95,255,0.3)", delay: "0.3s" },
            { width: 50, color: "rgba(255,45,146,0.3)", delay: "0.45s" },
          ].map((line, i) => (
            <div
              key={i}
              style={{
                width: line.width,
                height: 6,
                borderRadius: 3,
                background: line.color,
                animation: `tourFilterLine 2s ease-in-out infinite`,
                animationDelay: line.delay,
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes tourFilterPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        @keyframes tourFilterLine {
          0%, 100% { transform: scaleX(1); opacity: 1; }
          30% { transform: scaleX(0.4); opacity: 0.4; }
          60% { transform: scaleX(1); opacity: 1; }
        }
      `}</style>
    </IllustrationBox>
  );
}

// ─── 4. Save / Heart ───

export function HeartAnim() {
  return (
    <IllustrationBox gradient="linear-gradient(135deg, #1a0a1e 0%, #2e0a1e 100%)">
      <div style={{ position: "relative" }}>
        {/* Glow ring */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: "rgba(255,45,146,0.08)",
            animation: "tourHeartGlow 1.5s ease-in-out infinite",
          }}
        />

        {/* Heart SVG */}
        <svg
          width="56"
          height="56"
          viewBox="0 0 56 56"
          style={{ position: "relative", zIndex: 1, animation: "tourHeartBeat 1.5s ease-in-out infinite" }}
        >
          <path
            d="M28 48s-18-10.5-18-24.5C10 15.5 15.5 10 22 10c3.5 0 6 2 6 2s2.5-2 6-2c6.5 0 12 5.5 12 13.5C46 37.5 28 48 28 48z"
            fill="rgba(255,45,146,0.2)"
            stroke="#ff2d92"
            strokeWidth="2.5"
            style={{ animation: "tourHeartFill 1.5s ease-in-out infinite" }}
          />
        </svg>

        {/* Sparkles */}
        {[
          { top: -4, left: -8, delay: "0s" },
          { top: -8, left: 50, delay: "0.3s" },
          { top: 40, left: -12, delay: "0.6s" },
          { top: 36, left: 54, delay: "0.2s" },
        ].map((spark, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              top: spark.top,
              left: spark.left,
              width: 4,
              height: 4,
              borderRadius: "50%",
              background: "#ff2d92",
              animation: "tourSparkle 1.5s ease-in-out infinite",
              animationDelay: spark.delay,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes tourHeartBeat {
          0%, 100% { transform: scale(1); }
          15% { transform: scale(1.25); }
          30% { transform: scale(1); }
          45% { transform: scale(1.15); }
          60% { transform: scale(1); }
        }
        @keyframes tourHeartFill {
          0%, 100% { fill: rgba(255,45,146,0.2); }
          15% { fill: rgba(255,45,146,0.8); }
          45% { fill: rgba(255,45,146,0.6); }
          60% { fill: rgba(255,45,146,0.2); }
        }
        @keyframes tourHeartGlow {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.5; }
          15% { transform: translate(-50%, -50%) scale(1.4); opacity: 0.8; }
          60% { transform: translate(-50%, -50%) scale(1); opacity: 0.5; }
        }
        @keyframes tourSparkle {
          0%, 100% { transform: scale(0); opacity: 0; }
          15% { transform: scale(1.5); opacity: 1; }
          40% { transform: scale(0); opacity: 0; }
        }
      `}</style>
    </IllustrationBox>
  );
}

// ─── 5. Scroll Position / Feed ───

export function ScrollIndicatorAnim() {
  return (
    <IllustrationBox gradient="linear-gradient(135deg, #0a0a2e 0%, #1a0a2e 100%)">
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        {/* Mini phone frame */}
        <div
          style={{
            width: 52,
            height: 90,
            borderRadius: 10,
            border: "2px solid rgba(255,255,255,0.15)",
            background: "rgba(0,0,0,0.3)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Scrolling content inside phone */}
          <div style={{ animation: "tourPhoneScroll 3s ease-in-out infinite" }}>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  width: "100%",
                  height: 86,
                  background: i === 1 ? "rgba(0,212,255,0.1)" : "rgba(255,255,255,0.03)",
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div style={{ width: 24, height: 2, borderRadius: 1, background: `rgba(255,255,255,${i === 1 ? 0.2 : 0.06})` }} />
              </div>
            ))}
          </div>
        </div>

        {/* Vertical dot indicator */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                width: 6,
                borderRadius: 3,
                background: "rgba(255,45,146,0.3)",
                animation: "tourDotActive 3s ease-in-out infinite",
                animationDelay: `${i * 0.75}s`,
              }}
            />
          ))}
        </div>

        {/* Label */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>YOUR</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>POSITION</div>
        </div>
      </div>

      <style>{`
        @keyframes tourPhoneScroll {
          0%, 20% { transform: translateY(0); }
          30%, 50% { transform: translateY(-86px); }
          60%, 80% { transform: translateY(-172px); }
          90%, 100% { transform: translateY(0); }
        }
        @keyframes tourDotActive {
          0%, 10% { height: 16px; background: rgba(255,45,146,0.8); box-shadow: 0 0 8px rgba(255,45,146,0.4); }
          25% { height: 6px; background: rgba(255,45,146,0.3); box-shadow: none; }
          100% { height: 6px; background: rgba(255,45,146,0.3); box-shadow: none; }
        }
      `}</style>
    </IllustrationBox>
  );
}

// ─── Business Dashboard Illustrations ───

// 1. Dashboard Overview
export function DashboardOverviewAnim() {
  return (
    <IllustrationBox gradient="linear-gradient(135deg, #0a0a2e 0%, #0a1a3e 100%)">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, width: 180 }}>
        {[
          { color: "rgba(0,212,255,0.2)", border: "rgba(0,212,255,0.3)", delay: "0s" },
          { color: "rgba(57,255,20,0.15)", border: "rgba(57,255,20,0.25)", delay: "0.15s" },
          { color: "rgba(255,45,146,0.15)", border: "rgba(255,45,146,0.25)", delay: "0.3s" },
          { color: "rgba(191,95,255,0.15)", border: "rgba(191,95,255,0.25)", delay: "0.45s" },
        ].map((card, i) => (
          <div
            key={i}
            style={{
              height: 50,
              borderRadius: 8,
              background: card.color,
              border: `1px solid ${card.border}`,
              animation: "tourCardPop 2s ease-out infinite",
              animationDelay: card.delay,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: "60%",
                height: 4,
                borderRadius: 2,
                background: card.border,
              }}
            />
          </div>
        ))}
      </div>

      <style>{`
        @keyframes tourCardPop {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.05); opacity: 1; }
        }
      `}</style>
    </IllustrationBox>
  );
}

// 2. Analytics / Charts
export function AnalyticsAnim() {
  return (
    <IllustrationBox gradient="linear-gradient(135deg, #0a1a2e 0%, #0a2a2e 100%)">
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 80 }}>
        {[
          { height: 30, color: "rgba(0,212,255,0.4)", delay: "0s" },
          { height: 50, color: "rgba(0,212,255,0.5)", delay: "0.1s" },
          { height: 35, color: "rgba(0,212,255,0.4)", delay: "0.2s" },
          { height: 65, color: "rgba(0,212,255,0.6)", delay: "0.3s" },
          { height: 45, color: "rgba(0,212,255,0.45)", delay: "0.4s" },
          { height: 75, color: "rgba(57,255,20,0.5)", delay: "0.5s" },
          { height: 55, color: "rgba(0,212,255,0.5)", delay: "0.6s" },
        ].map((bar, i) => (
          <div
            key={i}
            style={{
              width: 16,
              borderRadius: "4px 4px 0 0",
              background: bar.color,
              animation: "tourBarGrow 2s ease-out infinite",
              animationDelay: bar.delay,
            }}
          >
            <div style={{ height: bar.height }} />
          </div>
        ))}
      </div>

      {/* Trend line */}
      <svg
        width="160"
        height="80"
        viewBox="0 0 160 80"
        style={{ position: "absolute", top: 30, pointerEvents: "none" }}
      >
        <polyline
          points="10,60 35,45 60,52 85,25 110,35 135,15 155,20"
          fill="none"
          stroke="rgba(57,255,20,0.4)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ animation: "tourLineDraw 2s ease-out infinite" }}
        />
      </svg>

      <style>{`
        @keyframes tourBarGrow {
          0% { transform: scaleY(0); transform-origin: bottom; }
          30%, 100% { transform: scaleY(1); transform-origin: bottom; }
        }
        @keyframes tourLineDraw {
          0% { stroke-dasharray: 200; stroke-dashoffset: 200; opacity: 0; }
          30% { opacity: 1; }
          60%, 100% { stroke-dasharray: 200; stroke-dashoffset: 0; opacity: 1; }
        }
      `}</style>
    </IllustrationBox>
  );
}

// 3. Receipt Management
export function ReceiptAnim() {
  return (
    <IllustrationBox gradient="linear-gradient(135deg, #0a0a2e 0%, #1a1a2e 100%)">
      <div style={{ position: "relative" }}>
        {/* Receipt paper */}
        <div
          style={{
            width: 72,
            padding: "10px 8px",
            borderRadius: "8px 8px 0 0",
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.12)",
            display: "flex",
            flexDirection: "column",
            gap: 5,
            animation: "tourReceiptSlide 2.5s ease-in-out infinite",
          }}
        >
          <div style={{ width: "70%", height: 3, borderRadius: 2, background: "rgba(255,255,255,0.2)" }} />
          <div style={{ width: "90%", height: 2, borderRadius: 1, background: "rgba(255,255,255,0.1)" }} />
          <div style={{ width: "60%", height: 2, borderRadius: 1, background: "rgba(255,255,255,0.1)" }} />
          <div style={{ width: "80%", height: 2, borderRadius: 1, background: "rgba(255,255,255,0.1)" }} />
          <div style={{ borderTop: "1px dashed rgba(255,255,255,0.1)", marginTop: 4, paddingTop: 4 }}>
            <div style={{ width: "50%", height: 3, borderRadius: 2, background: "rgba(57,255,20,0.3)" }} />
          </div>
        </div>

        {/* Checkmark */}
        <div
          style={{
            position: "absolute",
            top: -8,
            right: -12,
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "rgba(57,255,20,0.15)",
            border: "2px solid rgba(57,255,20,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: "tourCheckPop 2.5s ease-in-out infinite",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 7l3 3 5-6" stroke="#39ff14" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      <style>{`
        @keyframes tourReceiptSlide {
          0%, 20% { transform: translateY(20px); opacity: 0; }
          40%, 70% { transform: translateY(0); opacity: 1; }
          90%, 100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes tourCheckPop {
          0%, 45% { transform: scale(0); opacity: 0; }
          55% { transform: scale(1.2); opacity: 1; }
          65%, 100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </IllustrationBox>
  );
}

// 4. Media / Photos
export function MediaAnim() {
  return (
    <IllustrationBox gradient="linear-gradient(135deg, #1a0a2e 0%, #2a0a1e 100%)">
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {[
          { bg: "rgba(255,45,146,0.12)", border: "rgba(255,45,146,0.25)", delay: "0s" },
          { bg: "rgba(0,212,255,0.12)", border: "rgba(0,212,255,0.25)", delay: "0.2s" },
          { bg: "rgba(191,95,255,0.12)", border: "rgba(191,95,255,0.25)", delay: "0.4s" },
        ].map((photo, i) => (
          <div
            key={i}
            style={{
              width: 60,
              height: 60,
              borderRadius: 10,
              background: photo.bg,
              border: `1px solid ${photo.border}`,
              animation: "tourPhotoFloat 2.5s ease-in-out infinite",
              animationDelay: photo.delay,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="18" height="18" rx="3" stroke={photo.border.replace("0.25", "0.6")} strokeWidth="1.5" />
              <circle cx="8.5" cy="8.5" r="2" fill={photo.border.replace("0.25", "0.4")} />
              <path d="M3 16l5-5 4 4 3-3 6 6v1a3 3 0 01-3 3H6a3 3 0 01-3-3v-3z" fill={photo.border.replace("0.25", "0.15")} />
            </svg>
          </div>
        ))}
      </div>

      {/* Camera icon overlay */}
      <div
        style={{
          position: "absolute",
          bottom: 14,
          right: 40,
          animation: "tourCameraFlash 2.5s ease-in-out infinite",
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2v11z" stroke="rgba(191,95,255,0.5)" strokeWidth="1.5" />
          <circle cx="12" cy="13" r="4" stroke="rgba(191,95,255,0.5)" strokeWidth="1.5" />
        </svg>
      </div>

      <style>{`
        @keyframes tourPhotoFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes tourCameraFlash {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
          52% { opacity: 0.3; }
          54% { opacity: 1; }
        }
      `}</style>
    </IllustrationBox>
  );
}

// ═══════════════════════════════════════════════════
// HOME PAGE ILLUSTRATIONS
// ═══════════════════════════════════════════════════

export function ModeGridAnim() {
  const cards = [
    { color: "rgba(0,212,255,0.25)", border: "rgba(0,212,255,0.4)", delay: "0s", icon: "\uD83D\uDD0D" },
    { color: "rgba(255,45,146,0.2)", border: "rgba(255,45,146,0.35)", delay: "0.15s", icon: "\uD83C\uDF19" },
    { color: "rgba(191,95,255,0.2)", border: "rgba(191,95,255,0.35)", delay: "0.3s", icon: "\uD83C\uDFAF" },
    { color: "rgba(57,255,20,0.15)", border: "rgba(57,255,20,0.3)", delay: "0.45s", icon: "\uD83D\uDC65" },
    { color: "rgba(255,107,53,0.2)", border: "rgba(255,107,53,0.35)", delay: "0.6s", icon: "\uD83C\uDF89" },
    { color: "rgba(255,255,0,0.15)", border: "rgba(255,255,0,0.3)", delay: "0.75s", icon: "\uD83D\uDCF8" },
  ];
  return (
    <IllustrationBox gradient="linear-gradient(135deg, #0a0a2e 0%, #1a0a2e 100%)">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, width: 200 }}>
        {cards.map((c, i) => (
          <div key={i} style={{
            height: 48, borderRadius: 8, background: c.color, border: `1px solid ${c.border}`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
            animation: "tourModePop 2.5s ease-out infinite", animationDelay: c.delay,
          }}>{c.icon}</div>
        ))}
      </div>
      <style>{`
        @keyframes tourModePop {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.08); opacity: 1; }
        }
      `}</style>
    </IllustrationBox>
  );
}

export function SpotlightAnim() {
  return (
    <IllustrationBox gradient="linear-gradient(135deg, #0a0a2e 0%, #1a1a2e 100%)">
      <div style={{ position: "relative", width: 120, height: 80 }}>
        <div style={{
          width: 120, height: 80, borderRadius: 10,
          background: "rgba(255,107,53,0.1)", border: "1px solid rgba(255,107,53,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{ fontSize: 28 }}>{"\u2B50"}</div>
        </div>
        <div style={{
          position: "absolute", top: -10, left: 0, width: 30, height: 100,
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)",
          animation: "tourSpotlightSweep 2.5s ease-in-out infinite",
          transform: "skewX(-15deg)",
        }} />
      </div>
      <style>{`
        @keyframes tourSpotlightSweep {
          0% { left: -30px; }
          100% { left: 130px; }
        }
      `}</style>
    </IllustrationBox>
  );
}

export function BellAnim() {
  return (
    <IllustrationBox gradient="linear-gradient(135deg, #0a0a2e 0%, #0a1a3e 100%)">
      <div style={{ position: "relative" }}>
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none"
          style={{ animation: "tourBellSwing 2s ease-in-out infinite", transformOrigin: "top center" }}>
          <path d="M24 6c-8 0-14 6-14 14v8l-4 4h36l-4-4v-8c0-8-6-14-14-14z"
            fill="rgba(0,212,255,0.15)" stroke="rgba(0,212,255,0.5)" strokeWidth="2" />
          <circle cx="24" cy="42" r="3" fill="rgba(0,212,255,0.4)" />
        </svg>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{
            position: "absolute", top: "50%", left: "50%",
            width: 60 + i * 16, height: 60 + i * 16, borderRadius: "50%",
            border: "1px solid rgba(0,212,255,0.15)",
            transform: "translate(-50%, -50%)",
            animation: "tourBellRipple 2s ease-out infinite",
            animationDelay: `${i * 0.3}s`,
          }} />
        ))}
        <div style={{
          position: "absolute", top: -4, right: -4, width: 18, height: 18, borderRadius: "50%",
          background: "#ff2d92", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, fontWeight: 700, color: "#fff",
          animation: "tourBadgePop 2s ease-in-out infinite",
        }}>3</div>
      </div>
      <style>{`
        @keyframes tourBellSwing {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(8deg); }
          75% { transform: rotate(-8deg); }
        }
        @keyframes tourBellRipple {
          0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0.5; }
          100% { transform: translate(-50%, -50%) scale(1.3); opacity: 0; }
        }
        @keyframes tourBadgePop {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.2); }
        }
      `}</style>
    </IllustrationBox>
  );
}

export function ProfileAnim() {
  return (
    <IllustrationBox gradient="linear-gradient(135deg, #0a1a2e 0%, #0a2a1e 100%)">
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{
          width: 56, height: 56, borderRadius: "50%",
          background: "rgba(0,212,255,0.1)", border: "2px solid rgba(0,212,255,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24,
          animation: "tourAvatarGlow 2s ease-in-out infinite",
        }}>{"\uD83D\uDE0E"}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>EARNED</div>
          <div style={{
            fontSize: 22, fontWeight: 700, color: "#39ff14",
            animation: "tourCountUp 2s ease-out infinite",
            fontFamily: "monospace",
          }}>$42.50</div>
        </div>
      </div>
      <style>{`
        @keyframes tourAvatarGlow {
          0%, 100% { box-shadow: 0 0 0 rgba(0,212,255,0); }
          50% { box-shadow: 0 0 20px rgba(0,212,255,0.3); }
        }
        @keyframes tourCountUp {
          0% { opacity: 0.5; transform: translateY(4px); }
          50% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0.5; transform: translateY(4px); }
        }
      `}</style>
    </IllustrationBox>
  );
}

// ═══════════════════════════════════════════════════
// PROFILE PAGE ILLUSTRATIONS
// ═══════════════════════════════════════════════════

export function EarningsBannerAnim() {
  return (
    <IllustrationBox gradient="linear-gradient(135deg, #0a1a2e 0%, #0a2a1e 100%)">
      <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
        {[
          { label: "TOTAL", value: "$127", color: "#39ff14", delay: "0s" },
          { label: "AVAILABLE", value: "$42", color: "#00d4ff", delay: "0.3s" },
          { label: "PENDING", value: "$18", color: "#ffff00", delay: "0.6s" },
        ].map((stat, i) => (
          <div key={i} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            animation: "tourStatFade 2.5s ease-out infinite", animationDelay: stat.delay,
          }}>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontWeight: 700, letterSpacing: 1 }}>{stat.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: stat.color, fontFamily: "monospace" }}>{stat.value}</div>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes tourStatFade {
          0%, 10% { opacity: 0; transform: translateY(8px); }
          30%, 80% { opacity: 1; transform: translateY(0); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </IllustrationBox>
  );
}

export function CashOutAnim() {
  return (
    <IllustrationBox gradient="linear-gradient(135deg, #0a2a1e 0%, #0a1a2e 100%)">
      <div style={{ position: "relative" }}>
        <div style={{
          width: 56, height: 44, borderRadius: 8,
          background: "rgba(57,255,20,0.1)", border: "1px solid rgba(57,255,20,0.25)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="6" width="20" height="12" rx="2" stroke="rgba(57,255,20,0.5)" strokeWidth="1.5" />
            <circle cx="12" cy="12" r="3" stroke="rgba(57,255,20,0.5)" strokeWidth="1.5" />
          </svg>
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{
            position: "absolute", top: -8, left: 10 + i * 14,
            width: 12, height: 12, borderRadius: "50%",
            background: "rgba(57,255,20,0.3)", border: "1px solid rgba(57,255,20,0.5)",
            animation: "tourCoinFly 2s ease-out infinite",
            animationDelay: `${i * 0.2}s`,
          }} />
        ))}
      </div>
      <style>{`
        @keyframes tourCoinFly {
          0%, 20% { transform: translateY(0) scale(1); opacity: 1; }
          60% { transform: translateY(-30px) scale(0.8); opacity: 0.6; }
          100% { transform: translateY(-40px) scale(0.5); opacity: 0; }
        }
      `}</style>
    </IllustrationBox>
  );
}

export function LevelUpAnim() {
  const levels = [
    { pct: 0.3, color: "rgba(0,212,255,0.5)", label: "5%" },
    { pct: 0.4, color: "rgba(0,212,255,0.55)", label: "7.5%" },
    { pct: 0.5, color: "rgba(57,255,20,0.5)", label: "10%" },
    { pct: 0.6, color: "rgba(57,255,20,0.55)", label: "12.5%" },
    { pct: 0.7, color: "rgba(255,255,0,0.5)", label: "15%" },
    { pct: 0.85, color: "rgba(255,107,53,0.5)", label: "17.5%" },
    { pct: 1.0, color: "rgba(255,45,146,0.5)", label: "20%" },
  ];
  return (
    <IllustrationBox gradient="linear-gradient(135deg, #0a0a2e 0%, #1a0a2e 100%)">
      <div style={{ display: "flex", flexDirection: "column", gap: 4, width: 200 }}>
        {levels.map((l, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{
              flex: 1, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden",
            }}>
              <div style={{
                width: `${l.pct * 100}%`, height: "100%", borderRadius: 3, background: l.color,
                animation: "tourLevelFill 3s ease-out infinite",
                animationDelay: `${i * 0.2}s`,
              }} />
            </div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", fontWeight: 600, width: 30, textAlign: "right" }}>{l.label}</div>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes tourLevelFill {
          0%, 10% { transform: scaleX(0); transform-origin: left; }
          40%, 100% { transform: scaleX(1); transform-origin: left; }
        }
      `}</style>
    </IllustrationBox>
  );
}

// ═══════════════════════════════════════════════════
// EXPERIENCES PAGE ILLUSTRATIONS
// ═══════════════════════════════════════════════════

export function TabSwitchAnim() {
  return (
    <IllustrationBox gradient="linear-gradient(135deg, #0a0a2e 0%, #1a0a3e 100%)">
      <div style={{ display: "flex", gap: 8, position: "relative" }}>
        {["For You", "Following", "Trending"].map((tab, i) => (
          <div key={i} style={{
            padding: "8px 16px", borderRadius: 8,
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            fontSize: 12, color: "rgba(255,255,255,0.4)", fontWeight: 600,
          }}>{tab}</div>
        ))}
        <div style={{
          position: "absolute", bottom: -2, height: 2, width: 70, borderRadius: 1,
          background: "linear-gradient(90deg, #00d4ff, #0099ff)",
          animation: "tourTabSlide 3s ease-in-out infinite",
        }} />
      </div>
      <style>{`
        @keyframes tourTabSlide {
          0%, 20% { left: 4px; }
          35%, 55% { left: 82px; }
          70%, 90% { left: 160px; }
          100% { left: 4px; }
        }
      `}</style>
    </IllustrationBox>
  );
}

// ═══════════════════════════════════════════════════
// EVENTS PAGE ILLUSTRATIONS
// ═══════════════════════════════════════════════════

export function EventCalendarAnim() {
  return (
    <IllustrationBox gradient="linear-gradient(135deg, #0a0a2e 0%, #0a1a3e 100%)">
      <div style={{ position: "relative" }}>
        <div style={{
          width: 140, padding: "8px", borderRadius: 10,
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
            {Array.from({ length: 21 }, (_, i) => (
              <div key={i} style={{
                width: 14, height: 14, borderRadius: 3,
                background: [3, 8, 12, 17].includes(i) ? "rgba(255,107,53,0.3)" : "rgba(255,255,255,0.03)",
                border: [3, 8, 12, 17].includes(i) ? "1px solid rgba(255,107,53,0.4)" : "none",
                animation: [3, 8, 12, 17].includes(i) ? "tourEventDot 2.5s ease-in-out infinite" : "none",
                animationDelay: [3, 8, 12, 17].includes(i) ? `${[3, 8, 12, 17].indexOf(i) * 0.3}s` : "0s",
              }} />
            ))}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes tourEventDot {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.3); opacity: 1; }
        }
      `}</style>
    </IllustrationBox>
  );
}

export function EventCardAnim() {
  return (
    <IllustrationBox gradient="linear-gradient(135deg, #0a0a2e 0%, #1a1a2e 100%)">
      <div style={{
        width: 140, padding: "10px 12px", borderRadius: 10,
        background: "rgba(255,107,53,0.08)", border: "1px solid rgba(255,107,53,0.2)",
        animation: "tourEventCardGlow 2s ease-in-out infinite",
      }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 20 }}>{"\uD83C\uDFB5"}</div>
          <div>
            <div style={{ width: 70, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.2)", marginBottom: 4 }} />
            <div style={{ width: 50, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.1)" }} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <div style={{ width: 40, height: 3, borderRadius: 2, background: "rgba(255,107,53,0.3)" }} />
          <div style={{ width: 30, height: 3, borderRadius: 2, background: "rgba(0,212,255,0.2)" }} />
        </div>
      </div>
      <style>{`
        @keyframes tourEventCardGlow {
          0%, 100% { box-shadow: 0 0 0 rgba(255,107,53,0); }
          50% { box-shadow: 0 0 20px rgba(255,107,53,0.15); }
        }
      `}</style>
    </IllustrationBox>
  );
}

// ═══════════════════════════════════════════════════
// GROUP VOTE ILLUSTRATIONS
// ═══════════════════════════════════════════════════

export function GroupCreateAnim() {
  return (
    <IllustrationBox gradient="linear-gradient(135deg, #0a0a2e 0%, #0a1a3e 100%)">
      <div style={{ position: "relative", width: 120, height: 80 }}>
        <div style={{
          position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          width: 36, height: 36, borderRadius: "50%",
          background: "rgba(0,212,255,0.15)", border: "2px solid rgba(0,212,255,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20, color: "rgba(0,212,255,0.6)",
          animation: "tourPlusPulse 2.5s ease-in-out infinite",
        }}>+</div>
        {[
          { top: 0, left: 10, delay: "0.2s", emoji: "\uD83D\uDE00" },
          { top: 0, left: 80, delay: "0.4s", emoji: "\uD83D\uDE0E" },
          { top: 55, left: 10, delay: "0.6s", emoji: "\uD83E\uDD29" },
          { top: 55, left: 80, delay: "0.8s", emoji: "\uD83D\uDE04" },
        ].map((a, i) => (
          <div key={i} style={{
            position: "absolute", top: a.top, left: a.left,
            width: 28, height: 28, borderRadius: "50%",
            background: "rgba(191,95,255,0.1)", border: "1px solid rgba(191,95,255,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
            animation: "tourAvatarFlyIn 2.5s ease-out infinite", animationDelay: a.delay,
          }}>{a.emoji}</div>
        ))}
      </div>
      <style>{`
        @keyframes tourPlusPulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.15); }
        }
        @keyframes tourAvatarFlyIn {
          0%, 15% { transform: scale(0); opacity: 0; }
          35%, 100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </IllustrationBox>
  );
}

export function JoinCodeAnim() {
  return (
    <IllustrationBox gradient="linear-gradient(135deg, #0a0a2e 0%, #0a2a2e 100%)">
      <div style={{
        display: "flex", gap: 6, padding: "10px 16px", borderRadius: 10,
        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
      }}>
        {["A", "B", "7", "X"].map((ch, i) => (
          <div key={i} style={{
            width: 32, height: 40, borderRadius: 6,
            background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, fontWeight: 700, color: "rgba(0,212,255,0.7)", fontFamily: "monospace",
            animation: "tourCodeType 2.5s ease-out infinite", animationDelay: `${i * 0.3}s`,
          }}>{ch}</div>
        ))}
      </div>
      <style>{`
        @keyframes tourCodeType {
          0%, 20% { opacity: 0; transform: translateY(6px); }
          35%, 100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </IllustrationBox>
  );
}

export function GameListAnim() {
  return (
    <IllustrationBox gradient="linear-gradient(135deg, #0a0a2e 0%, #1a0a2e 100%)">
      <div style={{ display: "flex", flexDirection: "column", gap: 6, width: 170 }}>
        {[
          { color: "rgba(57,255,20,0.15)", border: "rgba(57,255,20,0.25)", dot: "#39ff14", label: "Active", delay: "0s" },
          { color: "rgba(0,212,255,0.1)", border: "rgba(0,212,255,0.2)", dot: "#00d4ff", label: "Waiting", delay: "0.2s" },
          { color: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.08)", dot: "rgba(255,255,255,0.3)", label: "Done", delay: "0.4s" },
        ].map((g, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 8, padding: "6px 10px",
            borderRadius: 8, background: g.color, border: `1px solid ${g.border}`,
            animation: "tourGameSlide 2.5s ease-out infinite", animationDelay: g.delay,
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%", background: g.dot,
              animation: i === 0 ? "tourActiveDot 1.5s ease-in-out infinite" : "none",
            }} />
            <div style={{ width: 60, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.15)" }} />
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginLeft: "auto" }}>{g.label}</div>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes tourGameSlide {
          0%, 15% { transform: translateX(-12px); opacity: 0; }
          35%, 100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes tourActiveDot {
          0%, 100% { box-shadow: 0 0 0 rgba(57,255,20,0); }
          50% { box-shadow: 0 0 8px rgba(57,255,20,0.6); }
        }
      `}</style>
    </IllustrationBox>
  );
}

// ═══════════════════════════════════════════════════
// 5v3v1 ILLUSTRATIONS
// ═══════════════════════════════════════════════════

export function CategoryGridAnim() {
  const cats = [
    { emoji: "\uD83C\uDF54", delay: "0s" }, { emoji: "\uD83C\uDF55", delay: "0.1s" },
    { emoji: "\uD83C\uDF7B", delay: "0.2s" }, { emoji: "\uD83C\uDFB3", delay: "0.3s" },
    { emoji: "\uD83C\uDFAC", delay: "0.4s" }, { emoji: "\uD83C\uDFB5", delay: "0.5s" },
  ];
  return (
    <IllustrationBox gradient="linear-gradient(135deg, #0a0a2e 0%, #1a1a2e 100%)">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {cats.map((c, i) => (
          <div key={i} style={{
            width: 48, height: 48, borderRadius: 10,
            background: [0, 2, 5].includes(i) ? "rgba(0,212,255,0.12)" : "rgba(255,255,255,0.04)",
            border: [0, 2, 5].includes(i) ? "1px solid rgba(0,212,255,0.35)" : "1px solid rgba(255,255,255,0.06)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
            animation: [0, 2, 5].includes(i) ? "tourCatSelect 2.5s ease-in-out infinite" : "none",
            animationDelay: c.delay,
          }}>{c.emoji}</div>
        ))}
      </div>
      <style>{`
        @keyframes tourCatSelect {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 rgba(0,212,255,0); }
          50% { transform: scale(1.08); box-shadow: 0 0 12px rgba(0,212,255,0.2); }
        }
      `}</style>
    </IllustrationBox>
  );
}

export function FriendSelectAnim() {
  return (
    <IllustrationBox gradient="linear-gradient(135deg, #0a0a2e 0%, #1a0a3e 100%)">
      <div style={{ display: "flex", alignItems: "center", gap: 32, position: "relative" }}>
        <div style={{
          width: 48, height: 48, borderRadius: "50%",
          background: "rgba(0,212,255,0.1)", border: "2px solid rgba(0,212,255,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
        }}>{"\uD83D\uDE00"}</div>
        <div style={{
          width: 48, height: 48, borderRadius: "50%",
          background: "rgba(191,95,255,0.1)", border: "2px solid rgba(191,95,255,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
          animation: "tourFriendPop 2.5s ease-out infinite",
        }}>{"\uD83D\uDE0E"}</div>
        <svg width="40" height="4" style={{ position: "absolute", left: 48, top: "50%", transform: "translateY(-50%)" }}>
          <line x1="0" y1="2" x2="40" y2="2" stroke="rgba(0,212,255,0.4)" strokeWidth="2"
            strokeDasharray="4 3" style={{ animation: "tourConnectDraw 2.5s ease-out infinite" }} />
        </svg>
      </div>
      <style>{`
        @keyframes tourFriendPop {
          0%, 30% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.1); opacity: 1; }
          60%, 100% { transform: scale(1); opacity: 1; }
        }
        @keyframes tourConnectDraw {
          0%, 40% { stroke-dashoffset: 40; }
          60%, 100% { stroke-dashoffset: 0; }
        }
      `}</style>
    </IllustrationBox>
  );
}

export function FunnelGameAnim() {
  return (
    <IllustrationBox gradient="linear-gradient(135deg, #0a0a2e 0%, #0a1a2e 100%)">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* 5 cards */}
        <div style={{ display: "flex", gap: 3, animation: "tourFunnel5 3s ease-in-out infinite" }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} style={{
              width: 16, height: 24, borderRadius: 3,
              background: "rgba(0,212,255,0.2)", border: "1px solid rgba(0,212,255,0.3)",
            }} />
          ))}
        </div>
        <svg width="16" height="16" viewBox="0 0 16 16"><path d="M4 8h8M9 5l3 3-3 3" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" fill="none" /></svg>
        {/* 3 cards */}
        <div style={{ display: "flex", gap: 3, animation: "tourFunnel3 3s ease-in-out infinite" }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{
              width: 18, height: 26, borderRadius: 3,
              background: "rgba(191,95,255,0.2)", border: "1px solid rgba(191,95,255,0.3)",
            }} />
          ))}
        </div>
        <svg width="16" height="16" viewBox="0 0 16 16"><path d="M4 8h8M9 5l3 3-3 3" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" fill="none" /></svg>
        {/* 1 card */}
        <div style={{
          width: 22, height: 30, borderRadius: 4,
          background: "rgba(255,45,146,0.2)", border: "1px solid rgba(255,45,146,0.4)",
          animation: "tourFunnel1 3s ease-in-out infinite",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{ fontSize: 12 }}>{"\u2B50"}</div>
        </div>
      </div>
      <style>{`
        @keyframes tourFunnel5 {
          0%, 20% { opacity: 1; }
          40%, 100% { opacity: 0.3; }
        }
        @keyframes tourFunnel3 {
          0%, 20% { opacity: 0.3; }
          40%, 60% { opacity: 1; }
          80%, 100% { opacity: 0.3; }
        }
        @keyframes tourFunnel1 {
          0%, 60% { opacity: 0.3; transform: scale(1); }
          80%, 100% { opacity: 1; transform: scale(1.1); box-shadow: 0 0 12px rgba(255,45,146,0.3); }
        }
      `}</style>
    </IllustrationBox>
  );
}

// ═══════════════════════════════════════════════════
// DATE NIGHT ILLUSTRATIONS
// ═══════════════════════════════════════════════════

export function RobotPickAnim() {
  return (
    <IllustrationBox gradient="linear-gradient(135deg, #1a0a2e 0%, #0a1a2e 100%)">
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 16 }}>
        {/* Restaurant card */}
        <div style={{
          width: 50, height: 36, borderRadius: 6,
          background: "rgba(255,107,53,0.12)", border: "1px solid rgba(255,107,53,0.25)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
          animation: "tourPickLeft 2.5s ease-out infinite",
        }}>{"\uD83C\uDF7D\uFE0F"}</div>
        {/* Robot */}
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: "rgba(0,212,255,0.1)", border: "2px solid rgba(0,212,255,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26,
          animation: "tourRobotBounce 2.5s ease-in-out infinite",
        }}>{"\uD83E\uDD16"}</div>
        {/* Activity card */}
        <div style={{
          width: 50, height: 36, borderRadius: 6,
          background: "rgba(191,95,255,0.12)", border: "1px solid rgba(191,95,255,0.25)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
          animation: "tourPickRight 2.5s ease-out infinite",
        }}>{"\uD83C\uDFB3"}</div>
      </div>
      <style>{`
        @keyframes tourRobotBounce {
          0%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
          60% { transform: translateY(0); }
        }
        @keyframes tourPickLeft {
          0%, 25% { transform: translateX(30px) scale(0); opacity: 0; }
          50%, 100% { transform: translateX(0) scale(1); opacity: 1; }
        }
        @keyframes tourPickRight {
          0%, 35% { transform: translateX(-30px) scale(0); opacity: 0; }
          60%, 100% { transform: translateX(0) scale(1); opacity: 1; }
        }
      `}</style>
    </IllustrationBox>
  );
}

export function DateHistoryAnim() {
  return (
    <IllustrationBox gradient="linear-gradient(135deg, #1a0a2e 0%, #2a0a1e 100%)">
      <div style={{ position: "relative", width: 100, height: 80 }}>
        {[2, 1, 0].map((i) => (
          <div key={i} style={{
            position: "absolute", top: i * 8, left: i * 8,
            width: 80, height: 56, borderRadius: 8,
            background: `rgba(255,45,146,${0.06 + i * 0.04})`,
            border: `1px solid rgba(255,45,146,${0.12 + i * 0.06})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            animation: "tourDateStack 2.5s ease-in-out infinite",
            animationDelay: `${i * 0.15}s`,
          }}>
            {i === 0 && <div style={{ fontSize: 20 }}>{"\u2764\uFE0F"}</div>}
          </div>
        ))}
      </div>
      <style>{`
        @keyframes tourDateStack {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}</style>
    </IllustrationBox>
  );
}

export function RestaurantRevealAnim() {
  return (
    <IllustrationBox gradient="linear-gradient(135deg, #0a0a2e 0%, #1a1a2e 100%)">
      <div style={{
        width: 100, height: 70, borderRadius: 10, perspective: "200px",
        position: "relative",
      }}>
        <div style={{
          width: "100%", height: "100%", borderRadius: 10,
          background: "rgba(255,107,53,0.1)", border: "1px solid rgba(255,107,53,0.25)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
          animation: "tourRevealFlip 3s ease-in-out infinite",
        }}>
          <div style={{ fontSize: 24 }}>{"\uD83C\uDF7D\uFE0F"}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "center" }}>
            <div style={{ width: 50, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.15)" }} />
            <div style={{ width: 35, height: 2, borderRadius: 1, background: "rgba(255,255,255,0.08)" }} />
          </div>
        </div>
      </div>
      <style>{`
        @keyframes tourRevealFlip {
          0%, 30% { transform: rotateY(90deg); opacity: 0.5; }
          50%, 80% { transform: rotateY(0deg); opacity: 1; }
          100% { transform: rotateY(0deg); opacity: 1; }
        }
      `}</style>
    </IllustrationBox>
  );
}

// ═══════════════════════════════════════════════════
// BUSINESS DASHBOARD ILLUSTRATIONS (existing)
// ═══════════════════════════════════════════════════

// 5. Support / Help
export function SupportAnim() {
  return (
    <IllustrationBox gradient="linear-gradient(135deg, #0a0a2e 0%, #0a1a2e 100%)">
      <div style={{ position: "relative" }}>
        {/* Chat bubbles */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, width: 160 }}>
          {/* User message */}
          <div
            style={{
              alignSelf: "flex-end",
              padding: "8px 12px",
              borderRadius: "12px 12px 4px 12px",
              background: "rgba(0,212,255,0.15)",
              border: "1px solid rgba(0,212,255,0.2)",
              animation: "tourMsgIn 3s ease-out infinite",
            }}
          >
            <div style={{ width: 60, height: 3, borderRadius: 2, background: "rgba(0,212,255,0.3)" }} />
          </div>

          {/* Support reply */}
          <div
            style={{
              alignSelf: "flex-start",
              padding: "8px 12px",
              borderRadius: "12px 12px 12px 4px",
              background: "rgba(57,255,20,0.1)",
              border: "1px solid rgba(57,255,20,0.15)",
              animation: "tourMsgReply 3s ease-out infinite",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <div style={{ width: 70, height: 3, borderRadius: 2, background: "rgba(57,255,20,0.25)" }} />
            <div style={{ width: 50, height: 3, borderRadius: 2, background: "rgba(57,255,20,0.15)" }} />
          </div>

          {/* Typing indicator */}
          <div
            style={{
              alignSelf: "flex-start",
              display: "flex",
              gap: 4,
              padding: "8px 12px",
              animation: "tourTyping 3s ease-in-out infinite",
            }}
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.3)",
                  animation: "tourDotBounce 1s ease-in-out infinite",
                  animationDelay: `${i * 0.15}s`,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes tourMsgIn {
          0%, 10% { transform: translateX(20px); opacity: 0; }
          25%, 100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes tourMsgReply {
          0%, 35% { transform: translateX(-20px); opacity: 0; }
          50%, 100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes tourTyping {
          0%, 55% { opacity: 0; }
          70%, 90% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes tourDotBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}</style>
    </IllustrationBox>
  );
}

// ─── Home Mode Cards: Individual Illustrations ───

/** Discovery / Explore — compass + swiping cards */
export function ModeDiscoveryAnim() {
  return (
    <IllustrationBox gradient="linear-gradient(135deg, #1a0520 0%, #2a0a30 100%)">
      {/* Compass circle */}
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          border: "2px solid rgba(255,45,120,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          animation: "tourCompassSpin 4s linear infinite",
        }}
      >
        {/* Needle */}
        <div
          style={{
            width: 2,
            height: 28,
            background: "linear-gradient(to bottom, #FF2D78 50%, rgba(255,255,255,0.2) 50%)",
            borderRadius: 2,
          }}
        />
      </div>

      {/* Floating cards beside compass */}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            right: 50 + i * 30,
            top: 20 + i * 18,
            width: 44,
            height: 56,
            borderRadius: 8,
            background: `rgba(255,45,120,${0.15 + i * 0.08})`,
            border: "1px solid rgba(255,45,120,0.3)",
            animation: `tourCardFloat 2.5s ease-in-out infinite ${i * 0.4}s`,
          }}
        />
      ))}

      <style>{`
        @keyframes tourCompassSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes tourCardFloat {
          0%, 100% { transform: translateY(0); opacity: 0.7; }
          50% { transform: translateY(-8px); opacity: 1; }
        }
      `}</style>
    </IllustrationBox>
  );
}

/** Date Night — moon + two glasses clinking */
export function ModeDateNightAnim() {
  return (
    <IllustrationBox gradient="linear-gradient(135deg, #0a1628 0%, #0a2038 100%)">
      {/* Moon */}
      <div
        style={{
          position: "absolute",
          top: 12,
          right: 30,
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "rgba(0,229,255,0.15)",
          boxShadow: "0 0 20px rgba(0,229,255,0.2)",
          animation: "tourMoonGlow 3s ease-in-out infinite",
        }}
      />

      {/* Two glasses clinking */}
      <div style={{ display: "flex", gap: 4, alignItems: "flex-end" }}>
        {/* Left glass */}
        <div
          style={{
            width: 18,
            height: 40,
            borderRadius: "4px 4px 8px 8px",
            background: "linear-gradient(to top, rgba(0,229,255,0.3), rgba(0,229,255,0.1))",
            border: "1px solid rgba(0,229,255,0.4)",
            animation: "tourGlassL 2s ease-in-out infinite",
            transformOrigin: "bottom right",
          }}
        />
        {/* Right glass */}
        <div
          style={{
            width: 18,
            height: 40,
            borderRadius: "4px 4px 8px 8px",
            background: "linear-gradient(to top, rgba(0,229,255,0.3), rgba(0,229,255,0.1))",
            border: "1px solid rgba(0,229,255,0.4)",
            animation: "tourGlassR 2s ease-in-out infinite",
            transformOrigin: "bottom left",
          }}
        />
      </div>

      {/* Heart above glasses */}
      <div
        style={{
          position: "absolute",
          top: 24,
          fontSize: 20,
          animation: "tourHeartFloatDN 2s ease-in-out infinite",
          opacity: 0,
        }}
      >
        ♡
      </div>

      <style>{`
        @keyframes tourMoonGlow {
          0%, 100% { box-shadow: 0 0 20px rgba(0,229,255,0.2); }
          50% { box-shadow: 0 0 30px rgba(0,229,255,0.35); }
        }
        @keyframes tourGlassL {
          0%, 100% { transform: rotate(0deg); }
          40%, 60% { transform: rotate(8deg); }
        }
        @keyframes tourGlassR {
          0%, 100% { transform: rotate(0deg); }
          40%, 60% { transform: rotate(-8deg); }
        }
        @keyframes tourHeartFloatDN {
          0%, 30% { opacity: 0; transform: translateY(10px) scale(0.5); }
          50% { opacity: 1; transform: translateY(0) scale(1); }
          70%, 100% { opacity: 0; transform: translateY(-10px) scale(0.5); }
        }
      `}</style>
    </IllustrationBox>
  );
}

/** 5v3v1 — funnel narrowing 5 → 3 → 1 */
export function Mode531Anim() {
  return (
    <IllustrationBox gradient="linear-gradient(135deg, #1a1800 0%, #2a2200 100%)">
      {/* The three stages */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 20 }}>
        {/* 5 dots */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
          <span style={{ fontSize: 10, color: "rgba(255,214,0,0.6)", fontWeight: 700 }}>5</span>
          <div style={{ display: "flex", gap: 3, flexWrap: "wrap", width: 40, justifyContent: "center" }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "rgba(255,214,0,0.5)",
                  animation: `tourDotFade531 3s ease-in-out infinite ${i * 0.15}s`,
                }}
              />
            ))}
          </div>
        </div>

        {/* Arrow */}
        <span style={{ color: "rgba(255,214,0,0.4)", fontSize: 16 }}>→</span>

        {/* 3 dots */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
          <span style={{ fontSize: 10, color: "rgba(255,214,0,0.6)", fontWeight: 700 }}>3</span>
          <div style={{ display: "flex", gap: 3, justifyContent: "center" }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: "rgba(255,214,0,0.6)",
                  animation: `tourDotFade531 3s ease-in-out infinite ${0.8 + i * 0.15}s`,
                }}
              />
            ))}
          </div>
        </div>

        {/* Arrow */}
        <span style={{ color: "rgba(255,214,0,0.4)", fontSize: 16 }}>→</span>

        {/* 1 dot (winner) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
          <span style={{ fontSize: 10, color: "rgba(255,214,0,0.8)", fontWeight: 700 }}>1</span>
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: "rgba(255,214,0,0.8)",
              boxShadow: "0 0 12px rgba(255,214,0,0.5)",
              animation: "tourWinnerPulse531 2s ease-in-out infinite",
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes tourDotFade531 {
          0%, 100% { opacity: 0.4; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1); }
        }
        @keyframes tourWinnerPulse531 {
          0%, 100% { box-shadow: 0 0 12px rgba(255,214,0,0.5); transform: scale(1); }
          50% { box-shadow: 0 0 24px rgba(255,214,0,0.8); transform: scale(1.15); }
        }
      `}</style>
    </IllustrationBox>
  );
}

/** Group Vote — multiple avatars + voting checkmark */
export function ModeGroupVoteAnim() {
  return (
    <IllustrationBox gradient="linear-gradient(135deg, #001a0d 0%, #002a15 100%)">
      {/* Circle of avatars */}
      <div style={{ position: "relative", width: 100, height: 80 }}>
        {[0, 1, 2, 3].map((i) => {
          const angle = (i / 4) * Math.PI * 2 - Math.PI / 2;
          const cx = 42 + Math.cos(angle) * 32;
          const cy = 36 + Math.sin(angle) * 24;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: cx,
                top: cy,
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: `rgba(0,255,135,${0.2 + i * 0.1})`,
                border: "1px solid rgba(0,255,135,0.4)",
                animation: `tourAvatarPop 2.5s ease-in-out infinite ${i * 0.3}s`,
              }}
            />
          );
        })}

        {/* Center vote icon */}
        <div
          style={{
            position: "absolute",
            left: 38,
            top: 28,
            fontSize: 18,
            animation: "tourVoteCheck 2.5s ease-in-out infinite",
          }}
        >
          ✓
        </div>
      </div>

      <style>{`
        @keyframes tourAvatarPop {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.2); opacity: 1; }
        }
        @keyframes tourVoteCheck {
          0%, 30% { opacity: 0; transform: scale(0.5); }
          50%, 70% { opacity: 1; transform: scale(1); }
          85%, 100% { opacity: 0; transform: scale(0.5); }
        }
      `}</style>
    </IllustrationBox>
  );
}

/** Events — calendar with pulsing event dots */
export function ModeEventsAnim() {
  return (
    <IllustrationBox gradient="linear-gradient(135deg, #150828 0%, #200a3a 100%)">
      {/* Calendar outline */}
      <div
        style={{
          width: 72,
          height: 60,
          borderRadius: 8,
          border: "1px solid rgba(208,80,255,0.35)",
          background: "rgba(208,80,255,0.06)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Calendar header bar */}
        <div
          style={{
            height: 14,
            background: "rgba(208,80,255,0.2)",
            borderBottom: "1px solid rgba(208,80,255,0.2)",
          }}
        />

        {/* Date grid dots */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: 3,
            padding: "6px 6px",
          }}
        >
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
            <div
              key={i}
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: i === 3 || i === 7 ? "rgba(208,80,255,0.8)" : "rgba(255,255,255,0.12)",
                boxShadow: i === 3 || i === 7 ? "0 0 6px rgba(208,80,255,0.5)" : "none",
                animation: i === 3 || i === 7 ? `tourEvtDotPulse 2s ease-in-out infinite ${i * 0.2}s` : "none",
              }}
            />
          ))}
        </div>
      </div>

      {/* Music note + ticket floating */}
      <div style={{ position: "absolute", right: 28, top: 20, fontSize: 16, animation: "tourEvtIcon 3s ease-in-out infinite" }}>♪</div>
      <div style={{ position: "absolute", right: 50, bottom: 20, fontSize: 14, animation: "tourEvtIcon 3s ease-in-out infinite 0.5s" }}>🎫</div>

      <style>{`
        @keyframes tourEvtDotPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.5); box-shadow: 0 0 10px rgba(208,80,255,0.7); }
        }
        @keyframes tourEvtIcon {
          0%, 100% { transform: translateY(0); opacity: 0.5; }
          50% { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </IllustrationBox>
  );
}

/** Experiences — camera + photo feed */
export function ModeExperiencesAnim() {
  return (
    <IllustrationBox gradient="linear-gradient(135deg, #1a0800 0%, #2a1200 100%)">
      {/* Camera icon */}
      <div
        style={{
          width: 40,
          height: 30,
          borderRadius: 6,
          border: "2px solid rgba(255,107,45,0.5)",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          animation: "tourCamFlash 3s ease-in-out infinite",
        }}
      >
        {/* Lens */}
        <div
          style={{
            width: 14,
            height: 14,
            borderRadius: "50%",
            border: "2px solid rgba(255,107,45,0.6)",
            background: "rgba(255,107,45,0.1)",
          }}
        />
        {/* Flash bump */}
        <div
          style={{
            position: "absolute",
            top: -6,
            right: 8,
            width: 10,
            height: 6,
            borderRadius: "3px 3px 0 0",
            background: "rgba(255,107,45,0.3)",
          }}
        />
      </div>

      {/* Flying media thumbnails */}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: 30 + i * 50,
            bottom: 14,
            width: 28,
            height: 28,
            borderRadius: 6,
            background: `rgba(255,107,45,${0.12 + i * 0.08})`,
            border: "1px solid rgba(255,107,45,0.25)",
            animation: `tourMediaFloat 2.5s ease-in-out infinite ${i * 0.4}s`,
          }}
        />
      ))}

      <style>{`
        @keyframes tourCamFlash {
          0%, 85%, 100% { opacity: 1; }
          90% { opacity: 0.3; }
          92% { opacity: 1; }
        }
        @keyframes tourMediaFloat {
          0%, 100% { transform: translateY(0) scale(0.9); opacity: 0.5; }
          50% { transform: translateY(-6px) scale(1); opacity: 1; }
        }
      `}</style>
    </IllustrationBox>
  );
}

// ─── 5v3v1 Tour: Pick 5 Spots ───

export function PickFiveAnim() {
  const pins = [
    { left: 20, delay: "0s" },
    { left: 55, delay: "0.15s" },
    { left: 90, delay: "0.3s" },
    { left: 125, delay: "0.45s" },
    { left: 160, delay: "0.6s" },
  ];
  return (
    <IllustrationBox gradient="linear-gradient(135deg, #0a0a2e 0%, #1a1a0e 100%)">
      {pins.map((p, i) => (
        <div key={i} style={{
          position: "absolute", left: p.left, bottom: 30,
          display: "flex", flexDirection: "column", alignItems: "center",
          animation: "tourPinDrop 2.8s ease-out infinite",
          animationDelay: p.delay,
        }}>
          <div style={{
            width: 30, height: 38, borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%",
            background: "rgba(255,214,0,0.15)", border: "2px solid rgba(255,214,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 800, color: "#FFD600",
            fontFamily: "'DM Sans', sans-serif",
          }}>{i + 1}</div>
          <div style={{
            width: 6, height: 6, borderRadius: "50%",
            background: "rgba(255,214,0,0.25)", marginTop: 3,
          }} />
        </div>
      ))}
      <style>{`
        @keyframes tourPinDrop {
          0%, 20% { transform: translateY(-20px); opacity: 0; }
          35% { transform: translateY(2px); opacity: 1; }
          45% { transform: translateY(-4px); }
          55%, 100% { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </IllustrationBox>
  );
}

// ─── 5v3v1 Tour: Mini Games Waiting Room ───

export function MiniGamesAnim() {
  const games = [
    { emoji: "\uD83C\uDF55", delay: "0s" },
    { emoji: "\u26A1", delay: "0.12s" },
    { emoji: "\uD83E\uDDE0", delay: "0.24s" },
    { emoji: "\u2753", delay: "0.36s" },
    { emoji: "\uD83E\uDD14", delay: "0.48s" },
    { emoji: "\uD83D\uDD24", delay: "0.6s" },
    { emoji: "\uD83C\uDFB0", delay: "0.72s" },
  ];
  return (
    <IllustrationBox gradient="linear-gradient(135deg, #0a0a2e 0%, #0a1a3e 100%)">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", padding: "0 20px" }}>
        {games.map((g, i) => (
          <div key={i} style={{
            width: 40, height: 40, borderRadius: 10,
            background: "rgba(0,212,255,0.08)",
            border: "1px solid rgba(0,212,255,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18,
            animation: "tourGameBounce 3s ease-in-out infinite",
            animationDelay: g.delay,
          }}>{g.emoji}</div>
        ))}
      </div>
      <style>{`
        @keyframes tourGameBounce {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 rgba(0,212,255,0); }
          50% { transform: scale(1.12); box-shadow: 0 0 10px rgba(0,212,255,0.15); }
        }
      `}</style>
    </IllustrationBox>
  );
}

// ─── 5v3v1 Tour: Pick the Winner (3 → 1) ───

export function PickWinnerAnim() {
  return (
    <IllustrationBox gradient="linear-gradient(135deg, #0a0a2e 0%, #0a2e0a 100%)">
      <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative" }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 44, height: 56, borderRadius: 8,
            background: i === 1 ? "rgba(57,255,20,0.12)" : "rgba(255,255,255,0.04)",
            border: i === 1 ? "2px solid rgba(57,255,20,0.5)" : "1px solid rgba(255,255,255,0.08)",
            display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
            animation: i === 1 ? "tourWinnerGlow 2.5s ease-in-out infinite" : "tourLoserFade 2.5s ease-in-out infinite",
            gap: 4,
          }}>
            <span style={{ fontSize: 18 }}>{["\uD83C\uDF54", "\uD83C\uDF7D\uFE0F", "\uD83C\uDF55"][i]}</span>
            {i === 1 && <span style={{
              fontSize: 10, color: "#39ff14", fontWeight: 800,
              fontFamily: "'DM Sans', sans-serif",
            }}>{"\u2714"}</span>}
          </div>
        ))}
      </div>
      <style>{`
        @keyframes tourWinnerGlow {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 rgba(57,255,20,0); }
          50% { transform: scale(1.08); box-shadow: 0 0 16px rgba(57,255,20,0.25); }
        }
        @keyframes tourLoserFade {
          0%, 30% { opacity: 1; }
          50%, 80% { opacity: 0.35; }
          100% { opacity: 1; }
        }
      `}</style>
    </IllustrationBox>
  );
}

// ─── 5v3v1 Tour: Winner Celebration ───

export function CelebrationAnim() {
  const confetti = Array.from({ length: 12 }, (_, i) => ({
    left: 15 + (i % 6) * 30,
    color: ["#ff2d92", "#00d4ff", "#39ff14", "#FFD600", "#bf5fff", "#ff6b35"][i % 6],
    delay: `${i * 0.15}s`,
    size: 6 + (i % 3) * 2,
  }));
  return (
    <IllustrationBox gradient="linear-gradient(135deg, #0a0a2e 0%, #1e0a2e 100%)">
      {/* Trophy */}
      <div style={{
        fontSize: 36, animation: "tourTrophyPop 3s ease-out infinite",
        zIndex: 2,
      }}>{"\uD83C\uDFC6"}</div>
      {/* Confetti */}
      {confetti.map((c, i) => (
        <div key={i} style={{
          position: "absolute", left: c.left, top: -4,
          width: c.size, height: c.size, borderRadius: i % 2 === 0 ? "50%" : 2,
          background: c.color, opacity: 0.7,
          animation: "tourConfettiFall 3s ease-in infinite",
          animationDelay: c.delay,
        }} />
      ))}
      <style>{`
        @keyframes tourTrophyPop {
          0%, 20% { transform: scale(0); opacity: 0; }
          35% { transform: scale(1.2); opacity: 1; }
          45% { transform: scale(0.95); }
          55%, 100% { transform: scale(1); opacity: 1; }
        }
        @keyframes tourConfettiFall {
          0% { transform: translateY(0) rotate(0deg); opacity: 0; }
          15% { opacity: 0.8; }
          100% { transform: translateY(130px) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </IllustrationBox>
  );
}

// ─── 5v3v1 Tour: Game History ───

export function GameHistoryAnim() {
  const games = [
    { emoji: "\uD83C\uDF54", label: "vs Alex", color: "rgba(57,255,20,0.3)", delay: "0s" },
    { emoji: "\uD83C\uDFB3", label: "vs Sam", color: "rgba(0,212,255,0.3)", delay: "0.15s" },
    { emoji: "\uD83C\uDF55", label: "vs Jordan", color: "rgba(191,95,255,0.3)", delay: "0.3s" },
  ];
  return (
    <IllustrationBox gradient="linear-gradient(135deg, #0a0a2e 0%, #1a1a2e 100%)">
      <div style={{ display: "flex", flexDirection: "column", gap: 6, width: 160 }}>
        {games.map((g, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "6px 10px", borderRadius: 8,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.06)",
            animation: "tourHistSlide 2.8s ease-out infinite",
            animationDelay: g.delay,
          }}>
            <span style={{ fontSize: 16 }}>{g.emoji}</span>
            <span style={{
              fontSize: 11, color: "rgba(255,255,255,0.6)",
              fontFamily: "'DM Sans', sans-serif", flex: 1,
            }}>{g.label}</span>
            <div style={{
              width: 16, height: 16, borderRadius: "50%",
              background: g.color, display: "flex",
              alignItems: "center", justifyContent: "center",
              fontSize: 9, color: "#fff",
            }}>{"\u2714"}</div>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes tourHistSlide {
          0%, 15% { transform: translateX(20px); opacity: 0; }
          30%, 100% { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </IllustrationBox>
  );
}

// ─── Business Dashboard: Payout Tiers Config ───

export function PayoutTiersAnim() {
  const tiers = [
    { label: "Starter", pct: "5%", width: 30, color: "rgba(0,212,255,0.5)", delay: "0s" },
    { label: "Regular", pct: "10%", width: 50, color: "rgba(57,255,20,0.5)", delay: "0.15s" },
    { label: "VIP", pct: "15%", width: 70, color: "rgba(255,214,0,0.5)", delay: "0.3s" },
    { label: "Legend", pct: "20%", width: 90, color: "rgba(255,45,146,0.5)", delay: "0.45s" },
  ];
  return (
    <IllustrationBox gradient="linear-gradient(135deg, #0a0a2e 0%, #0a1a2e 100%)">
      <div style={{ display: "flex", flexDirection: "column", gap: 6, width: 180 }}>
        {tiers.map((t, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 8,
            animation: "tourTierSlide 2.8s ease-out infinite",
            animationDelay: t.delay,
          }}>
            <span style={{
              fontSize: 9, color: "rgba(255,255,255,0.5)", fontWeight: 600,
              fontFamily: "'DM Sans', sans-serif", width: 42, textAlign: "right",
            }}>{t.label}</span>
            <div style={{
              flex: 1, height: 8, borderRadius: 4,
              background: "rgba(255,255,255,0.06)", overflow: "hidden",
            }}>
              <div style={{
                width: `${t.width}%`, height: "100%", borderRadius: 4,
                background: t.color,
                animation: "tourTierFill 2.8s ease-out infinite",
                animationDelay: t.delay,
              }} />
            </div>
            <span style={{
              fontSize: 10, color: t.color.replace("0.5", "0.9"), fontWeight: 800,
              fontFamily: "'DM Sans', sans-serif", width: 28,
            }}>{t.pct}</span>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes tourTierSlide {
          0%, 10% { transform: translateX(-10px); opacity: 0; }
          25%, 100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes tourTierFill {
          0%, 15% { transform: scaleX(0); transform-origin: left; }
          35%, 100% { transform: scaleX(1); transform-origin: left; }
        }
      `}</style>
    </IllustrationBox>
  );
}

// ── Comment Bubble Animation ──
export function CommentBubbleAnim() {
  const bubbles = [
    { text: "Amazing!", x: 20, y: 55, delay: "0s", color: "rgba(0,229,255,0.6)" },
    { text: "Love it", x: 90, y: 25, delay: "0.3s", color: "rgba(208,80,255,0.6)" },
    { text: "So fun!", x: 55, y: 80, delay: "0.6s", color: "rgba(255,107,45,0.6)" },
  ];
  return (
    <IllustrationBox gradient="linear-gradient(135deg, #0a0a2e 0%, #1a0a2e 100%)">
      <svg width="180" height="100" viewBox="0 0 180 100" fill="none">
        {bubbles.map((b, i) => (
          <g key={i} style={{ animation: "tourBubblePop 2.5s ease-out infinite", animationDelay: b.delay }}>
            <rect x={b.x} y={b.y} width="60" height="24" rx="12" fill={b.color} />
            <polygon points={`${b.x + 15},${b.y + 24} ${b.x + 10},${b.y + 32} ${b.x + 22},${b.y + 24}`} fill={b.color} />
            <text x={b.x + 30} y={b.y + 16} textAnchor="middle" fill="#fff" fontSize="9" fontWeight="700" fontFamily="DM Sans, sans-serif">{b.text}</text>
          </g>
        ))}
      </svg>
      <style>{`
        @keyframes tourBubblePop {
          0%, 5% { transform: scale(0); opacity: 0; }
          20% { transform: scale(1.15); opacity: 1; }
          30%, 85% { transform: scale(1); opacity: 1; }
          100% { transform: scale(0.9); opacity: 0; }
        }
      `}</style>
    </IllustrationBox>
  );
}

// ── Share / Send Animation ──
export function ShareSendAnim() {
  return (
    <IllustrationBox gradient="linear-gradient(135deg, #0a1a0e 0%, #0a0a2e 100%)">
      <svg width="160" height="100" viewBox="0 0 160 100" fill="none">
        {/* Paper plane */}
        <g style={{ animation: "tourPlaneFly 3s ease-in-out infinite" }}>
          <path d="M30 55L80 35L60 55L70 75Z" fill="rgba(0,255,135,0.5)" stroke="rgba(0,255,135,0.8)" strokeWidth="1" />
          <path d="M80 35L60 55L30 55Z" fill="rgba(0,255,135,0.3)" />
        </g>
        {/* Trailing particles */}
        {[0, 1, 2, 3].map((i) => (
          <circle key={i} cx={25 - i * 8} cy={58 + i * 3} r={2 - i * 0.3}
            fill="rgba(0,255,135,0.4)"
            style={{ animation: "tourTrailFade 3s ease-in-out infinite", animationDelay: `${i * 0.15}s` }}
          />
        ))}
        {/* Target circle */}
        <circle cx="125" cy="45" r="18" stroke="rgba(0,255,135,0.3)" strokeWidth="1.5" fill="none"
          style={{ animation: "tourTargetPulse 3s ease-in-out infinite" }} />
        <circle cx="125" cy="45" r="6" fill="rgba(0,255,135,0.4)"
          style={{ animation: "tourTargetPulse 3s ease-in-out infinite" }} />
      </svg>
      <style>{`
        @keyframes tourPlaneFly {
          0% { transform: translate(0, 0) rotate(0deg); }
          50% { transform: translate(60px, -12px) rotate(-5deg); }
          100% { transform: translate(0, 0) rotate(0deg); }
        }
        @keyframes tourTrailFade {
          0%, 100% { opacity: 0.5; } 50% { opacity: 0; }
        }
        @keyframes tourTargetPulse {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.2); opacity: 1; }
        }
      `}</style>
    </IllustrationBox>
  );
}

// ── Mute / Volume Animation ──
export function MuteVolumeAnim() {
  return (
    <IllustrationBox gradient="linear-gradient(135deg, #0a0a1e 0%, #1a0a1e 100%)">
      <svg width="160" height="100" viewBox="0 0 160 100" fill="none">
        {/* Speaker icon */}
        <polygon points="55,38 65,38 75,28 75,72 65,62 55,62" fill="rgba(255,255,255,0.25)" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
        {/* Sound waves (appear/disappear) */}
        <path d="M82 38 Q92 50 82 62" stroke="rgba(0,229,255,0.6)" strokeWidth="2" fill="none" strokeLinecap="round"
          style={{ animation: "tourWave1 2.5s ease-in-out infinite" }} />
        <path d="M90 30 Q105 50 90 70" stroke="rgba(0,229,255,0.4)" strokeWidth="2" fill="none" strokeLinecap="round"
          style={{ animation: "tourWave2 2.5s ease-in-out infinite" }} />
        <path d="M98 24 Q118 50 98 76" stroke="rgba(0,229,255,0.25)" strokeWidth="2" fill="none" strokeLinecap="round"
          style={{ animation: "tourWave3 2.5s ease-in-out infinite" }} />
        {/* Mute slash (fades in when waves fade out) */}
        <line x1="52" y1="28" x2="100" y2="72" stroke="rgba(255,45,78,0.7)" strokeWidth="3" strokeLinecap="round"
          style={{ animation: "tourMuteSlash 2.5s ease-in-out infinite" }} />
      </svg>
      <style>{`
        @keyframes tourWave1 {
          0%, 45% { opacity: 1; } 55%, 90% { opacity: 0; } 100% { opacity: 1; }
        }
        @keyframes tourWave2 {
          0%, 40% { opacity: 1; } 50%, 90% { opacity: 0; } 100% { opacity: 1; }
        }
        @keyframes tourWave3 {
          0%, 35% { opacity: 1; } 45%, 90% { opacity: 0; } 100% { opacity: 1; }
        }
        @keyframes tourMuteSlash {
          0%, 45% { opacity: 0; } 55%, 85% { opacity: 1; } 95%, 100% { opacity: 0; }
        }
      `}</style>
    </IllustrationBox>
  );
}

// ── See More / Explore Animation ──
export function SeeMoreAnim() {
  return (
    <IllustrationBox gradient="linear-gradient(135deg, #0a0a2e 0%, #0a1a2e 100%)">
      <svg width="160" height="100" viewBox="0 0 160 100" fill="none">
        {/* Grid of small cards expanding */}
        {[
          { x: 30, y: 20, delay: "0s" },
          { x: 70, y: 20, delay: "0.1s" },
          { x: 110, y: 20, delay: "0.2s" },
          { x: 30, y: 55, delay: "0.15s" },
          { x: 70, y: 55, delay: "0.25s" },
          { x: 110, y: 55, delay: "0.35s" },
        ].map((c, i) => (
          <rect key={i} x={c.x} y={c.y} width="28" height="22" rx="4"
            fill={`rgba(0,229,255,${0.15 + i * 0.05})`}
            stroke="rgba(0,229,255,0.3)" strokeWidth="1"
            style={{ animation: "tourCardReveal 2.8s ease-out infinite", animationDelay: c.delay }}
          />
        ))}
        {/* Magnifying glass overlay */}
        <g style={{ animation: "tourMagGlide 2.8s ease-in-out infinite" }}>
          <circle cx="95" cy="50" r="16" stroke="rgba(255,255,255,0.5)" strokeWidth="2" fill="rgba(255,255,255,0.05)" />
          <line x1="106" y1="61" x2="118" y2="73" stroke="rgba(255,255,255,0.5)" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      </svg>
      <style>{`
        @keyframes tourCardReveal {
          0%, 10% { transform: scale(0.7); opacity: 0.3; }
          30% { transform: scale(1.05); opacity: 1; }
          40%, 100% { transform: scale(1); opacity: 1; }
        }
        @keyframes tourMagGlide {
          0% { transform: translate(-15px, 5px); }
          50% { transform: translate(15px, -5px); }
          100% { transform: translate(-15px, 5px); }
        }
      `}</style>
    </IllustrationBox>
  );
}
