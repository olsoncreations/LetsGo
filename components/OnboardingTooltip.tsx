"use client";

import React, { useEffect, useState, useRef, useLayoutEffect } from "react";
import type { TourStep } from "@/lib/useOnboardingTour";

interface OnboardingTooltipProps {
  step: TourStep;
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  /** Animated illustration shown above the text content */
  illustration?: React.ReactNode;
}

/**
 * Compute a quadratic bezier SVG path from the tooltip edge to the target center.
 * Returns "" if tooltip hasn't been measured yet.
 */
function computeConnectorPath(
  tooltipRect: DOMRect | null,
  targetRect: DOMRect,
): string {
  if (!tooltipRect) return "";

  const tx = targetRect.left + targetRect.width / 2;
  const ty = targetRect.top + targetRect.height / 2;

  // Find the closest point on the tooltip edge
  const tt = tooltipRect.top;
  const tb = tooltipRect.bottom;
  const tl = tooltipRect.left;
  const tr = tooltipRect.right;
  const tcx = tl + tooltipRect.width / 2;
  const tcy = tt + tooltipRect.height / 2;

  // Determine which edge is closest to target center
  let sx: number, sy: number;
  const dx = tx - tcx;
  const dy = ty - tcy;

  if (Math.abs(dx) / tooltipRect.width > Math.abs(dy) / tooltipRect.height) {
    // Exit from left or right edge
    sx = dx > 0 ? tr : tl;
    sy = Math.max(tt + 12, Math.min(tb - 12, ty));
  } else {
    // Exit from top or bottom edge
    sx = Math.max(tl + 12, Math.min(tr - 12, tx));
    sy = dy > 0 ? tb : tt;
  }

  // Control point — pull toward the midpoint for a nice curve
  const cx = (sx + tx) / 2 + (ty - sy) * 0.15;
  const cy = (sy + ty) / 2 - (tx - sx) * 0.15;

  return `M${sx},${sy} Q${cx},${cy} ${tx},${ty}`;
}

/**
 * OnboardingTooltip
 *
 * Glassmorphic tooltip centered on screen with a spotlight
 * overlay that highlights the target element.
 * Draws a glowing connector line + pulse ring around the target.
 */
export default function OnboardingTooltip({
  step,
  stepIndex,
  totalSteps,
  onNext,
  onBack,
  onSkip,
  illustration,
}: OnboardingTooltipProps) {
  const [ready, setReady] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [tooltipRect, setTooltipRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout>;
    let scrollTimer: ReturnType<typeof setTimeout>;
    let attempts = 0;
    const maxAttempts = 10;

    function tryFindTarget() {
      if (cancelled) return;
      const el = document.querySelector(step.target);
      if (!el) {
        attempts++;
        if (attempts >= maxAttempts) {
          onNext();
          return;
        }
        retryTimer = setTimeout(tryFindTarget, 300);
        return;
      }

      const rect = el.getBoundingClientRect();
      setTargetRect(rect);

      el.scrollIntoView({ behavior: "smooth", block: "center" });

      scrollTimer = setTimeout(() => {
        if (cancelled) return;
        const updatedRect = el.getBoundingClientRect();
        setTargetRect(updatedRect);
        setReady(true);
      }, 350);
    }

    setReady(false);
    setTooltipRect(null);
    tryFindTarget();

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      clearTimeout(scrollTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.target]);

  // Measure tooltip after it renders so we can draw the connector
  useLayoutEffect(() => {
    if (ready && tooltipRef.current) {
      setTooltipRect(tooltipRef.current.getBoundingClientRect());
    }
  }, [ready, stepIndex]);

  if (!ready || !targetRect) return null;

  const isLastStep = stepIndex === totalSteps - 1;
  const connectorPath = computeConnectorPath(tooltipRect, targetRect);

  // Target center for the pulse ring
  const ringX = targetRect.left + targetRect.width / 2;
  const ringY = targetRect.top + targetRect.height / 2;
  const ringRadius = Math.max(targetRect.width, targetRect.height) / 2 + 16;

  return (
    <>
      {/* Spotlight overlay */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9998,
          pointerEvents: "auto",
        }}
        onClick={onSkip}
      >
        <svg
          width="100%"
          height="100%"
          style={{ position: "absolute", inset: 0 }}
        >
          <defs>
            <mask id="tour-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect
                x={targetRect.left - 8}
                y={targetRect.top - 8}
                width={targetRect.width + 16}
                height={targetRect.height + 16}
                rx={12}
                fill="black"
              />
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="rgba(0,0,0,0.7)"
            mask="url(#tour-mask)"
          />

          {/* Pulsing glow ring around target */}
          <circle
            cx={ringX}
            cy={ringY}
            r={ringRadius}
            fill="none"
            stroke="rgba(0,212,255,0.5)"
            strokeWidth="2"
            style={{ animation: "tourRingPulse 2s ease-in-out infinite" }}
          />
          <circle
            cx={ringX}
            cy={ringY}
            r={ringRadius + 8}
            fill="none"
            stroke="rgba(0,212,255,0.2)"
            strokeWidth="1"
            style={{ animation: "tourRingPulse 2s ease-in-out infinite 0.3s" }}
          />
        </svg>
      </div>

      {/* Connector line from tooltip to target */}
      {connectorPath && (
        <svg
          width="100%"
          height="100%"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            pointerEvents: "none",
          }}
        >
          <defs>
            <filter id="tour-glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Glow line */}
          <path
            d={connectorPath}
            fill="none"
            stroke="rgba(0,212,255,0.3)"
            strokeWidth="3"
            strokeLinecap="round"
            filter="url(#tour-glow)"
          />
          {/* Crisp dashed line */}
          <path
            d={connectorPath}
            fill="none"
            stroke="rgba(0,212,255,0.6)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray="6 4"
            style={{ animation: "tourDashFlow 1.5s linear infinite" }}
          />

          {/* Arrowhead dot at target end */}
          <circle
            cx={targetRect.left + targetRect.width / 2}
            cy={targetRect.top + targetRect.height / 2}
            r="4"
            fill="rgba(0,212,255,0.8)"
            style={{ animation: "tourDotPing 2s ease-in-out infinite" }}
          />
        </svg>
      )}

      {/* Centered tooltip */}
      <div
        ref={tooltipRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 420,
          maxWidth: "calc(100vw - 40px)",
          zIndex: 10000,
          background: "rgba(12, 12, 24, 0.95)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(0, 212, 255, 0.35)",
          borderRadius: 18,
          padding: "28px 32px",
          boxShadow:
            "0 12px 48px rgba(0,0,0,0.6), 0 0 30px rgba(0,212,255,0.12), inset 0 1px 0 rgba(255,255,255,0.05)",
          animation: "tourFadeIn 0.35s ease-out",
        }}
      >
        {/* Step counter */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "rgba(0, 212, 255, 0.85)",
              textTransform: "uppercase",
              letterSpacing: 1.5,
            }}
          >
            Step {stepIndex + 1} of {totalSteps}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSkip();
            }}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.4)",
              cursor: "pointer",
              fontSize: 20,
              padding: "0 2px",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Progress bar */}
        <div
          style={{
            width: "100%",
            height: 3,
            background: "rgba(255,255,255,0.08)",
            borderRadius: 2,
            marginBottom: 20,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${((stepIndex + 1) / totalSteps) * 100}%`,
              height: "100%",
              background: "linear-gradient(90deg, #00d4ff, #0099ff)",
              borderRadius: 2,
              transition: "width 0.3s ease",
            }}
          />
        </div>

        {/* Illustration */}
        {illustration && (
          <div style={{ marginBottom: 16 }}>{illustration}</div>
        )}

        {/* Title */}
        <h3
          style={{
            margin: "0 0 10px 0",
            fontSize: 22,
            fontWeight: 700,
            color: "#fff",
            letterSpacing: -0.3,
          }}
        >
          {step.title}
        </h3>

        {/* Description */}
        <p
          style={{
            margin: "0 0 24px 0",
            fontSize: 15,
            color: "rgba(255,255,255,0.65)",
            lineHeight: 1.6,
          }}
        >
          {step.description}
        </p>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, justifyContent: "space-between", alignItems: "center" }}>
          {/* Left side — Back (only after step 1) */}
          {stepIndex > 0 ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onBack();
              }}
              style={{
                padding: "10px 18px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.04)",
                color: "rgba(255,255,255,0.5)",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Back
            </button>
          ) : (
            <div />
          )}

          {/* Right side — Skip + Next */}
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSkip();
              }}
              style={{
                padding: "10px 20px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.04)",
                color: "rgba(255,255,255,0.5)",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Skip tour
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onNext();
              }}
              style={{
                padding: "10px 28px",
                borderRadius: 10,
                border: "none",
                background: "linear-gradient(135deg, #00d4ff, #0077ff)",
                color: "#fff",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 700,
                boxShadow: "0 4px 16px rgba(0,212,255,0.35)",
              }}
            >
              {isLastStep ? "Got it!" : "Next"}
            </button>
          </div>
        </div>
      </div>

      {/* Animation keyframes */}
      <style>{`
        @keyframes tourFadeIn {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes tourRingPulse {
          0%, 100% { transform-origin: center; r: ${ringRadius}; opacity: 0.5; }
          50% { r: ${ringRadius + 6}; opacity: 0.9; }
        }
        @keyframes tourDashFlow {
          from { stroke-dashoffset: 0; }
          to { stroke-dashoffset: -20; }
        }
        @keyframes tourDotPing {
          0%, 100% { r: 4; opacity: 0.8; }
          50% { r: 6; opacity: 1; }
        }
      `}</style>
    </>
  );
}
