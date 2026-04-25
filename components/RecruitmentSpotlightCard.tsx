"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { recruiterChallenge } from "@/lib/recruiterChallenge";

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
          key={`rb-${b.i}`}
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

export default function RecruitmentSpotlightCard() {
  const [modalOpen, setModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const cfg = recruiterChallenge;

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModalOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [modalOpen]);

  useEffect(() => {
    if (!modalOpen && triggerRef.current) triggerRef.current.focus();
  }, [modalOpen]);

  async function copyPitch() {
    try {
      await navigator.clipboard.writeText(cfg.elevatorPitch);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <>
      <style>{`
        @keyframes recPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.3); }
        }
        @keyframes recFadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .rec-card-inner { display: grid; grid-template-columns: 300px 1fr; gap: 56px; align-items: center; }
        .rec-headline { font-size: 28px; }
        .rec-subhead { font-size: 18px; }
        .rec-body { font-size: 15px; }
        .rec-prize { max-width: 100%; }
        @media (max-width: 900px) {
          .rec-card-inner { grid-template-columns: 1fr; gap: 32px; }
          .rec-prize { max-width: 320px; margin: 0 auto; }
        }
        @media (max-width: 560px) {
          .rec-frame { padding: 28px 22px !important; border-radius: 16px !important; }
          .rec-card-inner { gap: 24px; }
          .rec-prize { max-width: 280px; }
          .rec-headline { font-size: 20px; }
          .rec-subhead { font-size: 16px; }
          .rec-body { font-size: 14px; }
          .rec-cta { width: 100%; justify-content: center; }
          .rec-footer { flex-direction: column; align-items: stretch !important; gap: 14px !important; }
        }
        @media (max-width: 560px) {
          .rec-modal { padding: 28px 22px 36px !important; max-height: 90vh !important; }
          .rec-modal-title { font-size: 22px !important; }
          .rec-action-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div style={{ marginBottom: 36, padding: "0 12px", animation: "recFadeIn 0.5s ease 0.15s both" }}>
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
            LetsGo Announcements
          </span>
        </div>

        {/* Frame */}
        <div
          className="rec-frame"
          style={{
            position: "relative",
            background: "#0A0A18",
            borderRadius: 20,
            padding: "56px 52px",
            overflow: "visible",
          }}
        >
          <PerimeterBulbs />

          <div className="rec-card-inner" style={{ position: "relative", zIndex: 2 }}>
            {/* Prize image */}
            <div
              className="rec-prize"
              style={{
                position: "relative",
                borderRadius: 14,
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "0 0 40px rgba(255,138,0,0.15), 0 0 0 1px rgba(255,138,0,0.08)",
                lineHeight: 0,
                width: "100%",
              }}
            >
              <Image
                src={cfg.imageUrl}
                alt="Progressive Payout Ladder — Locked"
                width={1071}
                height={1468}
                sizes="(max-width: 900px) 320px, 300px"
                style={{ width: "100%", height: "auto", display: "block" }}
                priority
              />
            </div>

            {/* Copy */}
            <div>
              <div
                style={{
                  display: "inline-block",
                  padding: "5px 10px",
                  background: "rgba(232,38,78,0.12)",
                  border: "1px solid rgba(232,38,78,0.35)",
                  borderRadius: 6,
                  color: "#E8264E",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.16em",
                  marginBottom: 18,
                  textTransform: "uppercase",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Unlock Challenge
              </div>

              <h2
                className="rec-headline"
                style={{
                  fontFamily: "'Clash Display', 'DM Sans', sans-serif",
                  fontWeight: 800,
                  lineHeight: 1.2,
                  letterSpacing: "-0.015em",
                  marginBottom: 10,
                  color: "#fff",
                }}
              >
                Want your favorite businesses to pay{" "}
                <span
                  style={{
                    background: "linear-gradient(180deg, #FFE55C 0%, #FFC107 100%)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  YOU
                </span>{" "}
                when you go eat out?
              </h2>

              <p
                className="rec-subhead"
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 700,
                  lineHeight: 1.2,
                  background: "linear-gradient(180deg, #FFE55C 0%, #FFC107 100%)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  filter: "drop-shadow(0 0 10px rgba(255,214,0,0.25))",
                  marginBottom: 14,
                  letterSpacing: "-0.01em",
                }}
              >
                Get Paid to Live Your Best Life!
              </p>

              <p
                className="rec-body"
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  lineHeight: 1.55,
                  color: "rgba(255,255,255,0.72)",
                  marginBottom: 20,
                  maxWidth: 460,
                }}
              >
                Recruit a restaurant or activity to sign up with LetsGo and get paid up to{" "}
                <strong style={{ color: "#fff", fontWeight: 700 }}>${cfg.bountyPremium}</strong>, with a chance to win up to an additional{" "}
                <strong style={{ color: "#fff", fontWeight: 700 }}>${cfg.bonusPrize.toLocaleString()}</strong>!
              </p>

              <div
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 13,
                  fontWeight: 600,
                  lineHeight: 1.4,
                  color: "rgba(255,255,255,0.42)",
                  marginBottom: 16,
                  fontStyle: "italic",
                }}
              >
                Click below to see more details.
              </div>

              <div
                className="rec-footer"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: "0.5px",
                    color: "#FFD600",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "#FFD600",
                      boxShadow: "0 0 10px #FFD600",
                      animation: "recPulse 1.6s ease-in-out infinite",
                      display: "inline-block",
                    }}
                  />
                  {cfg.deadlineLabel}
                </div>

                <button
                  ref={triggerRef}
                  onClick={() => setModalOpen(true)}
                  className="rec-cta"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "13px 22px",
                    background: "linear-gradient(135deg, #FFE55C 0%, #FFD600 50%, #FFA500 100%)",
                    border: "none",
                    borderRadius: 10,
                    color: "#1a0f00",
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 14,
                    fontWeight: 700,
                    letterSpacing: "0.5px",
                    cursor: "pointer",
                    boxShadow:
                      "0 0 0 1px rgba(255,214,0,0.5), 0 6px 20px rgba(255,214,0,0.3), inset 0 1px 0 rgba(255,255,255,0.4)",
                    transition: "transform 0.2s, box-shadow 0.2s",
                  }}
                >
                  Start Recruiting
                  <span style={{ display: "inline-block" }}>→</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {modalOpen && (
        <RecruitmentModal
          onClose={() => setModalOpen(false)}
          onCopy={copyPitch}
          copied={copied}
          cfg={cfg}
        />
      )}
    </>
  );
}

function RecruitmentModal({
  onClose,
  onCopy,
  copied,
  cfg,
}: {
  onClose: () => void;
  onCopy: () => void;
  copied: boolean;
  cfg: typeof recruiterChallenge;
}) {
  const steps = [
    {
      title: "Pick a business you love",
      desc: "A restaurant, bar, coffee shop, salon, studio — anywhere you're a regular. The pitch is easiest when you already know the owner or a manager.",
    },
    {
      title: "Pitch them in 30 seconds",
      desc: (
        <>
          Use the elevator pitch below. The key hook:{" "}
          <strong style={{ color: "#FFD600", fontWeight: 700 }}>
            Basic plan is $0 until a real customer walks in.
          </strong>{" "}
          Zero risk.
        </>
      ),
    },
    {
      title: "Send them the brochure",
      desc: "If they want the full breakdown — pricing, features, how it beats Yelp/Google Ads — share the business brochure link below.",
    },
    {
      title: "Get them to sign up",
      desc: (
        <>
          Send them to the sign-up page. When they fill out the partner form, they{" "}
          <strong style={{ color: "#FFD600", fontWeight: 700 }}>must enter your email</strong> in the{" "}
          <span
            style={{
              display: "inline-block",
              padding: "1px 7px",
              background: "rgba(0,220,200,0.1)",
              border: "1px solid rgba(0,220,200,0.3)",
              borderRadius: 4,
              color: "#00DCC8",
              fontSize: 11,
              fontWeight: 700,
              margin: "0 2px",
            }}
          >
            Recommended By
          </span>{" "}
          field. That&apos;s how you get credit.
        </>
      ),
    },
    {
      title: "Collect your bounty",
      desc: (
        <>
          Once they complete their first payment to LetsGo, your bonus clears:{" "}
          <strong style={{ color: "#FFD600", fontWeight: 700 }}>
            ${cfg.bountyBasic} Basic · ${cfg.bountyPremium} Premium.
          </strong>{" "}
          Then go sign the next one.
        </>
      ),
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rec-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.8)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        animation: "recFadeIn 0.25s ease both",
      }}
    >
      <div
        className="rec-modal"
        style={{
          position: "relative",
          background: "#0A0A18",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 20,
          maxWidth: 640,
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          padding: "36px 40px 32px",
          boxShadow:
            "0 0 0 1px rgba(232,38,78,0.15), 0 30px 80px rgba(0,0,0,0.6), 0 0 60px rgba(232,38,78,0.15)",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            width: 34,
            height: 34,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "50%",
            color: "rgba(255,255,255,0.7)",
            fontSize: 18,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2,
          }}
        >
          ×
        </button>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              display: "inline-block",
              padding: "4px 10px",
              background: "rgba(232,38,78,0.12)",
              border: "1px solid rgba(232,38,78,0.35)",
              borderRadius: 6,
              color: "#E8264E",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.2em",
              marginBottom: 12,
              textTransform: "uppercase",
            }}
          >
            How To Recruit
          </div>
          <h3
            id="rec-modal-title"
            className="rec-modal-title"
            style={{
              fontFamily: "'Clash Display', 'DM Sans', sans-serif",
              fontSize: 28,
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              marginBottom: 8,
              color: "#fff",
            }}
          >
            5 Steps to Your First Payout
          </h3>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.72)", lineHeight: 1.5 }}>
            Takes about 10 minutes. The easiest first sign-up is usually a spot you already go to.
          </p>
        </div>

        {/* Steps */}
        <div style={{ marginBottom: 24 }}>
          {steps.map((s, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 16,
                padding: "14px 0",
                borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.06)",
                paddingTop: i === 0 ? 4 : 14,
              }}
            >
              <div
                style={{
                  flexShrink: 0,
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, rgba(232,38,78,0.2), rgba(232,38,78,0.08))",
                  border: "1px solid rgba(232,38,78,0.4)",
                  color: "#E8264E",
                  fontSize: 13,
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {i + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 4 }}>
                  {s.title}
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.5, color: "rgba(255,255,255,0.72)" }}>
                  {s.desc}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Pitch block */}
        <div
          style={{
            background: "rgba(0,220,200,0.04)",
            border: "1px solid rgba(0,220,200,0.2)",
            borderRadius: 12,
            padding: "16px 18px",
            marginBottom: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.2em",
                color: "#00DCC8",
                textTransform: "uppercase",
              }}
            >
              ★ Elevator Pitch
            </span>
            <button
              onClick={onCopy}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 10px",
                background: copied ? "rgba(74,222,128,0.15)" : "rgba(0,220,200,0.1)",
                border: copied ? "1px solid rgba(74,222,128,0.4)" : "1px solid rgba(0,220,200,0.3)",
                borderRadius: 6,
                color: copied ? "#4ADE80" : "#00DCC8",
                fontFamily: "inherit",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <span>{copied ? "✓" : "⧉"}</span>
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>
          <p
            style={{
              fontSize: 13,
              lineHeight: 1.55,
              color: "rgba(255,255,255,0.85)",
              fontStyle: "italic",
            }}
          >
            &ldquo;{cfg.elevatorPitch}&rdquo;
          </p>
        </div>

        {/* Action links */}
        <div className="rec-action-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
          <a
            href={cfg.signupUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 14px",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 10,
              color: "#fff",
              textDecoration: "none",
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                flexShrink: 0,
                borderRadius: 8,
                background: "rgba(232,38,78,0.12)",
                border: "1px solid rgba(232,38,78,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
              }}
            >
              →
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2, marginBottom: 2 }}>
                Sign-Up Page
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.42)",
                  lineHeight: 1.2,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                useletsgo.com/welcome
              </div>
            </div>
          </a>
          <a
            href={cfg.brochureUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 14px",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 10,
              color: "#fff",
              textDecoration: "none",
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                flexShrink: 0,
                borderRadius: 8,
                background: "rgba(0,220,200,0.1)",
                border: "1px solid rgba(0,220,200,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
              }}
            >
              📄
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2, marginBottom: 2 }}>
                Business Brochure
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.42)",
                  lineHeight: 1.2,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                Full pricing &amp; features
              </div>
            </div>
          </a>
        </div>

        {/* Reminder */}
        <div
          style={{
            display: "flex",
            gap: 10,
            padding: "12px 14px",
            background: "rgba(255,214,0,0.06)",
            border: "1px solid rgba(255,214,0,0.25)",
            borderRadius: 10,
            fontSize: 12,
            lineHeight: 1.5,
            color: "rgba(255,255,255,0.85)",
          }}
        >
          <span style={{ flexShrink: 0, color: "#FFD600", fontSize: 16, lineHeight: 1 }}>⚠</span>
          <div>
            <strong style={{ color: "#FFD600", fontWeight: 700 }}>Don&apos;t forget:</strong> They have to type <em>your</em> email in the &ldquo;Recommended By&rdquo; field on the partner sign-up form. No email = no credit. Referrals can&apos;t be added after the fact unless approved by a LetsGo team member.
          </div>
        </div>

        {/* Fine print */}
        <details style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <summary
            style={{
              listStyle: "none",
              cursor: "pointer",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.2em",
              color: "rgba(255,255,255,0.5)",
              textTransform: "uppercase",
              padding: "4px 0",
            }}
          >
            › The Fine Print
          </summary>
          <p
            style={{
              marginTop: 10,
              fontSize: 10.5,
              lineHeight: 1.55,
              color: "rgba(255,255,255,0.42)",
            }}
          >
            Must be 18+ to participate. Referrals are credited only after the referred business completes
            their first successful payment to LetsGo. The business must enter the recruiter&apos;s LetsGo
            account email in the &ldquo;Recommended By&rdquo; field of the partner onboarding form —
            referrals cannot be added retroactively except at the sole discretion of a LetsGo employee
            when both the recruiter and the referred business confirm the referral in writing. Referral
            bonus: ${cfg.bountyBasic} Basic, ${cfg.bountyPremium} Premium, per qualifying signup, no cap.
            Any cumulative bonus total exceeding $600 in a calendar year is reportable income and subject
            to 1099 tax reporting. Self-referrals and referrals to businesses you own, operate, manage,
            or are employed by do not qualify. A &ldquo;new&rdquo; business is one that is not currently
            on a paying Basic or Premium plan with LetsGo at the time of referral. Bonus prize drawing
            (up to ${cfg.bonusPrize.toLocaleString()}): rules, eligibility, and selection details will be
            published prior to any drawing. LetsGo reserves the right to verify referrals and deny any
            determined to be fraudulent, duplicate, or in violation of these terms. Void where prohibited.
          </p>
        </details>
      </div>
    </div>
  );
}
