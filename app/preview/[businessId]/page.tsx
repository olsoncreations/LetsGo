"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import {
  type BusinessRow, type MediaRow, type DiscoveryImage, type DiscoveryBusiness,
  getBusinessGradient, getBusinessEmoji,
  normalizeToDiscoveryBusiness,
} from "@/lib/businessNormalize";
import { fetchPlatformTierConfig, getVisitRangeLabel, DEFAULT_VISIT_THRESHOLDS, type VisitThreshold } from "@/lib/platformSettings";

// ═══════════════════════════════════════════════════
// PREVIEW PAGE — mirrors Discovery swipe card for a single business
// Used by sales reps to pitch businesses during prospecting
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

function buildPayoutLevels(thresholds: VisitThreshold[]) {
  return thresholds.map((t) => ({
    level: t.level,
    name: t.label,
    visits: getVisitRangeLabel(t),
  }));
}
const DEFAULT_PAYOUT_LEVELS = buildPayoutLevels(DEFAULT_VISIT_THRESHOLDS);

// ─── PlaceholderPhoto ───

function PlaceholderPhoto({ gradient, emoji, label, sublabel, style }: {
  gradient: string; emoji: string; label?: string; sublabel?: string; style?: React.CSSProperties;
}) {
  return (
    <div style={{
      width: "100%", height: "100%", background: gradient,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      position: "relative", overflow: "hidden", ...style,
    }}>
      <div style={{ position: "absolute", top: "-20%", right: "-15%", width: "60%", height: "60%", borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
      <div style={{ position: "absolute", bottom: "-25%", left: "-10%", width: "50%", height: "50%", borderRadius: "50%", background: "rgba(255,255,255,0.03)" }} />
      <span style={{ fontSize: 80, marginBottom: 12, filter: "drop-shadow(0 4px 20px rgba(0,0,0,0.3))", zIndex: 1 }}>{emoji}</span>
      {label && <span style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.9)", fontFamily: "'DM Sans', sans-serif", zIndex: 1 }}>{label}</span>}
      {sublabel && <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: "'DM Sans', sans-serif", marginTop: 4, zIndex: 1 }}>{sublabel}</span>}
    </div>
  );
}

// ─── Share Button ───

function ShareButton({ name }: { name: string }) {
  const [toast, setToast] = useState<string | null>(null);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: name, text: `Check out ${name} on LetsGo!`, url }); } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(url);
      setToast("Link copied!"); setTimeout(() => setToast(null), 3000);
    }
  };

  return (
    <>
      <button onClick={handleClick} style={{
        background: "none", border: "none", cursor: "pointer", padding: 4,
        flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
          stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

// ─── Business Detail Page (slide 2) ───

function BusinessDetailPage({ biz, payoutLevels }: { biz: DiscoveryBusiness; payoutLevels?: { level: number; name: string; visits: string }[] }) {
  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

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
          {biz.slogan && (
            <p style={{ fontSize: 15, color: COLORS.textSecondary, marginTop: 10, lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif", fontStyle: "italic" }}>&ldquo;{biz.slogan}&rdquo;</p>
          )}
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
              return (
                <div key={day} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 12px", borderRadius: 8,
                  background: "transparent",
                  border: "1px solid transparent",
                }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: COLORS.textSecondary, fontFamily: "'DM Sans', sans-serif" }}>
                    {day}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: COLORS.textSecondary, fontFamily: "'DM Sans', sans-serif" }}>{biz.hours[day] || "Closed"}</span>
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

function PhotoPage({ image, label }: { image: DiscoveryImage; label: string }) {
  return (
    <div style={{ width: "100%", height: "100%", flexShrink: 0, position: "relative", background: COLORS.darkBg }}>
      <img src={image.url} alt={label} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `${image.focalX}% ${image.focalY}%` }} draggable={false} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "35%", background: "linear-gradient(transparent, rgba(0,0,0,0.7))", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: 36, left: 24, right: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#fff", fontFamily: "'DM Sans', sans-serif", textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}>{label}</div>
          <ShareButton name={label} />
        </div>
      </div>
    </div>
  );
}

// ─── Main Photo Page (hero - slide 1) ───

function MainPhotoPage({ biz }: { biz: DiscoveryBusiness }) {
  const heroImage = biz.images[0] ?? null;

  return (
    <div style={{ width: "100%", height: "100%", flexShrink: 0, position: "relative", background: COLORS.darkBg, overflow: "hidden" }}>
      {heroImage ? (
        <img src={heroImage.url} alt={biz.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `${heroImage.focalX}% ${heroImage.focalY}%`, opacity: 0.85 }} draggable={false} />
      ) : (
        <PlaceholderPhoto gradient={getBusinessGradient(biz.id)} emoji={getBusinessEmoji(biz.type)} label={biz.name} sublabel={biz.type} style={{ opacity: 0.85 }} />
      )}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "20%", background: "linear-gradient(rgba(0,0,0,0.5), transparent)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "55%", background: "linear-gradient(transparent, rgba(0,0,0,0.85))", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0 24px 36px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <h2 style={{ fontSize: "clamp(24px, 7vw, 36px)", fontWeight: 900, color: "#fff", margin: 0, lineHeight: 1.05, fontFamily: "'Dela Gothic One', sans-serif", textShadow: "0 2px 20px rgba(0,0,0,0.6)", letterSpacing: -0.5 }}>{biz.name}</h2>
          <ShareButton name={biz.name} />
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
          <span style={{
            padding: "4px 12px", borderRadius: 50, fontSize: 10, fontWeight: 700,
            background: `${COLORS.neonPink}25`, color: COLORS.neonPink, border: `1px solid ${COLORS.neonPink}40`,
            fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: 1, backdropFilter: "blur(8px)",
          }}>{biz.type}</span>
        </div>
        {biz.payout.length > 0 && (() => {
          const minP = Math.min(...biz.payout);
          const maxP = Math.max(...biz.payout);
          const rangeStr = minP === maxP ? `${minP}%` : `${minP}% \u2013 ${maxP}%`;
          return (
            <div style={{
              display: "flex", alignItems: "center", gap: 10, marginTop: 16,
              padding: "8px 14px", borderRadius: 50,
              background: "rgba(57,255,20,0.08)", border: "1px solid rgba(57,255,20,0.18)",
              backdropFilter: "blur(8px)", width: "fit-content",
            }}>
              <span style={{ fontSize: 14 }}>{"\uD83D\uDCB0"}</span>
              <span style={{
                fontSize: 12, fontWeight: 700, color: COLORS.neonGreen,
                fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.02em",
              }}>
                Earn {rangeStr} back
              </span>
            </div>
          );
        })()}
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
    <div style={{
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

// ─── Business Card (horizontal swipeable) ───

function BusinessCard({ biz, payoutLevels }: { biz: DiscoveryBusiness; payoutLevels?: { level: number; name: string; visits: string }[] }) {
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
      if (dragOffset < -threshold && currentPage < totalPages - 1) setCurrentPage(p => p + 1);
      else if (dragOffset > threshold && currentPage > 0) setCurrentPage(p => p - 1);
    }
    locked.current = null;
    setDragOffset(0);
  };

  const translateX = -(currentPage * 100 / totalPages) + (isDragging ? (dragOffset / getWidth()) * (100 / totalPages) : 0);

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
        display: "flex", width: `${totalPages * 100}%`, height: "100%",
        transform: `translateX(${translateX}%)`,
        transition: isDragging ? "none" : "transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        willChange: "transform",
      }}>
        <div style={{ width: `${100 / totalPages}%`, height: "100%", flexShrink: 0, overflow: "hidden" }}>
          <MainPhotoPage biz={biz} />
        </div>
        <div style={{ width: `${100 / totalPages}%`, height: "100%", flexShrink: 0, overflow: "hidden" }}>
          <BusinessDetailPage biz={biz} payoutLevels={payoutLevels} />
        </div>
        {extraPhotos.map((img, i) => (
          <div key={i} style={{ width: `${100 / totalPages}%`, height: "100%", flexShrink: 0, overflow: "hidden" }}>
            <PhotoPage image={img} label={biz.name} />
          </div>
        ))}
      </div>
      <PageDots total={totalPages} current={currentPage} />
    </div>
  );
}

// ─── Header Banner (mirrors Discovery page) ───

function PreviewHeader({ businessName }: { businessName: string }) {
  const NEON = "#FF2D78";
  const NEON_RGB = "255,45,120";

  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 100 }}>
      <style>{`
        @keyframes borderTravel-prev {
          0% { background-position: 0% 50%; }
          100% { background-position: 300% 50%; }
        }
        @keyframes neonFlicker-prev {
          0%, 100% { text-shadow: 0 0 8px ${NEON}90, 0 0 20px ${NEON}50; }
          5% { text-shadow: 0 0 4px ${NEON}40, 0 0 10px ${NEON}20; }
          6% { text-shadow: 0 0 8px ${NEON}90, 0 0 20px ${NEON}50; }
          45% { text-shadow: 0 0 8px ${NEON}90, 0 0 20px ${NEON}50; }
          46% { text-shadow: 0 0 2px ${NEON}30, 0 0 6px ${NEON}15; }
          48% { text-shadow: 0 0 8px ${NEON}90, 0 0 20px ${NEON}50; }
        }
        @keyframes pulseGlow { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
      <div style={{ position: "relative" }}>
        <div style={{
          position: "absolute", inset: -2, borderRadius: 0,
          background: `linear-gradient(90deg, transparent 5%, ${NEON}90, ${NEON}, ${NEON}90, transparent 95%)`,
          backgroundSize: "300% 100%",
          animation: "borderTravel-prev 8s linear infinite",
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
                }}>LG</div>
              </div>
              <div style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                minWidth: 0, overflow: "hidden",
              }}>
                <div style={{
                  fontFamily: "'Clash Display', 'DM Sans', sans-serif",
                  fontSize: "clamp(9px, 2.8vw, 15px)", fontWeight: 600, letterSpacing: "0.2em", color: NEON,
                  animation: "neonFlicker-prev 12s ease-in-out infinite",
                  textShadow: `0 0 20px rgba(${NEON_RGB}, 0.5), 0 0 40px rgba(${NEON_RGB}, 0.2)`,
                  whiteSpace: "nowrap", textAlign: "center",
                }}>
                  {"\u2726"} D I S C O V E R Y
                </div>
              </div>
              <div style={{ width: 32, height: 32, flexShrink: 0 }} /> {/* spacer to balance layout */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Start Onboarding Button (floating at bottom) ───

function StartOnboardingButton({ businessId }: { businessId: string }) {
  return (
    <div style={{
      position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
      zIndex: 200, display: "flex", gap: 12,
    }}>
      <a
        href={`/partner-onboarding?prefill=${businessId}`}
        style={{
          padding: "14px 28px", borderRadius: 50,
          background: `linear-gradient(135deg, ${COLORS.neonPink}, ${COLORS.neonOrange})`,
          color: "#fff", fontSize: 15, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
          textDecoration: "none", display: "inline-block",
          boxShadow: `0 4px 24px rgba(255,45,146,0.4), 0 0 40px rgba(255,45,146,0.15)`,
          letterSpacing: "0.02em",
        }}
      >
        Start Onboarding
      </a>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// MAIN PREVIEW PAGE
// ═══════════════════════════════════════════════════

export default function PreviewPage() {
  const params = useParams();
  const businessId = params.businessId as string;

  const [biz, setBiz] = useState<DiscoveryBusiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payoutLevels, setPayoutLevels] = useState(DEFAULT_PAYOUT_LEVELS);

  // Load platform tier config
  useEffect(() => {
    fetchPlatformTierConfig(supabaseBrowser).then((cfg) => {
      if (cfg) setPayoutLevels(buildPayoutLevels(cfg.visitThresholds));
    }).catch(() => {});
  }, []);

  // Load business data
  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setError("");

      try {
        // Query business (include inactive — this IS the preview for inactive businesses)
        const { data: bizRow, error: bizErr } = await supabaseBrowser
          .from("business")
          .select(`
            id, business_name, public_business_name,
            contact_phone, website, street_address, city, state, zip,
            phone_number, website_url, address_line1,
            category_main, config, blurb,
            payout_tiers, payout_preset,
            mon_open, mon_close, tue_open, tue_close, wed_open, wed_close,
            thu_open, thu_close, fri_open, fri_close, sat_open, sat_close,
            sun_open, sun_close
          `)
          .eq("id", businessId)
          .maybeSingle();

        if (bizErr) throw bizErr;
        if (!alive) return;

        if (!bizRow) {
          setError("Business not found");
          return;
        }

        const row = bizRow as BusinessRow;

        // Fetch media
        const { data: mediaRows } = await supabaseBrowser
          .from("business_media")
          .select("business_id, bucket, path, sort_order, caption, meta")
          .eq("business_id", businessId)
          .eq("is_active", true)
          .eq("media_type", "photo")
          .order("sort_order", { ascending: true });

        // Fetch payout tiers
        const { data: tierRows } = await supabaseBrowser
          .from("business_payout_tiers")
          .select("business_id, percent_bps, tier_index")
          .eq("business_id", businessId)
          .order("tier_index", { ascending: true });

        if (!alive) return;

        const media = (mediaRows ?? []) as MediaRow[];
        const bps = (tierRows ?? []).map((t: { percent_bps: number }) => Number(t.percent_bps) || 0);

        const normalized = normalizeToDiscoveryBusiness(row, media, bps.length >= 7 ? bps : undefined);
        setBiz(normalized);
      } catch (err) {
        console.error("Preview load error:", err);
        setError("Failed to load business preview");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [businessId]);

  if (loading) {
    return (
      <div style={{
        width: "100%", height: "100dvh", background: COLORS.darkBg,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{ color: COLORS.textSecondary, fontSize: 14, fontFamily: "'DM Sans', sans-serif" }}>
          Loading preview...
        </div>
      </div>
    );
  }

  if (error || !biz) {
    return (
      <div style={{
        width: "100%", height: "100dvh", background: COLORS.darkBg,
        display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16,
      }}>
        <div style={{ color: COLORS.neonPink, fontSize: 18, fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}>
          {error || "Business not found"}
        </div>
        <button
          onClick={() => window.history.back()}
          style={{
            padding: "10px 24px", borderRadius: 50,
            background: COLORS.cardBg, border: `1px solid ${COLORS.cardBorder}`,
            color: COLORS.textPrimary, fontSize: 14, cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100dvh", position: "relative", overflow: "hidden", background: COLORS.darkBg }}>
      <link href="https://fonts.googleapis.com/css2?family=Dela+Gothic+One&family=DM+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      <PreviewHeader businessName={biz.name} />
      <BusinessCard biz={biz} payoutLevels={payoutLevels} />
      <StartOnboardingButton businessId={businessId} />
    </div>
  );
}
