"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

const REPORT_REASONS: { value: string; label: string; priority: "high" | "medium" }[] = [
  { value: "closed",     label: "Permanently closed",            priority: "medium" },
  { value: "wrong_info", label: "Wrong info (name, address...)",  priority: "medium" },
  { value: "duplicate",  label: "Duplicate listing",              priority: "medium" },
  { value: "offensive",  label: "Inappropriate / offensive",       priority: "high"   },
  { value: "spam",       label: "Not a real business / spam",      priority: "high"   },
  { value: "other",      label: "Other",                           priority: "medium" },
];

const REASON_LABEL: Record<string, string> = REPORT_REASONS.reduce((acc, r) => {
  acc[r.value] = r.label;
  return acc;
}, {} as Record<string, string>);

/**
 * Bottom-sheet modal that lets a user flag a business from the discovery
 * feed. Submits a row into the existing `support_tickets` table with
 * category="report" so admins triage reports in /admin/support alongside
 * the rest of the support queue.
 */
export function BusinessReportModal({
  open,
  onClose,
  businessId,
  businessName,
}: {
  open: boolean;
  onClose: () => void;
  businessId: string;
  businessName: string;
}) {
  const [reason, setReason] = useState<string>("");
  const [details, setDetails] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const reset = () => {
    setReason("");
    setDetails("");
    setSubmitting(false);
    setDoneMsg(null);
    setErr(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!reason || submitting) return;
    setSubmitting(true);
    setErr(null);
    try {
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setErr("Please sign in to submit a report");
        setSubmitting(false);
        return;
      }
      const meta = REPORT_REASONS.find(r => r.value === reason);
      const reasonLabel = REASON_LABEL[reason] || reason;
      const res = await fetch("/api/support-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          subject: `Report: ${businessName} — ${reasonLabel}`,
          body: details.trim() || `User flagged "${businessName}" as: ${reasonLabel}`,
          category: "report",
          // High priority for offensive/spam reports so they jump the queue;
          // medium otherwise (matches the support_tickets CHECK constraint).
          priority: meta?.priority || "medium",
          business_id: businessId,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErr(data.error || "Couldn't submit. Try again.");
        setSubmitting(false);
        return;
      }
      setDoneMsg("Thanks — our team will review.");
      setSubmitting(false);
      setTimeout(() => { handleClose(); }, 1500);
    } catch {
      setErr("Couldn't submit. Try again.");
      setSubmitting(false);
    }
  };

  // Discovery's swipe carousel renders its slides inside a translateX
  // transform, which pins position:fixed children to the carousel rather
  // than the viewport. Portal to <body> so the modal anchors to the actual
  // viewport regardless of where it's rendered in the tree.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!open || !mounted) return null;

  const overlay = (
    <div
      onClick={handleClose}
      style={{
        position: "fixed", inset: 0, zIndex: 10000,
        background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        animation: "fadeIn 0.2s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        // React synthetic events bubble through the React tree even when
        // portaled, so the swipe carousel's onMouseDown={preventDefault}
        // would otherwise block the textarea from getting focus. Stop
        // pointer/touch events here so they never reach the carousel.
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 520,
          background: "#0f0f1a", border: "1px solid #2d2d44",
          borderRadius: "16px 16px 0 0",
          display: "flex", flexDirection: "column",
          boxShadow: "0 -10px 40px rgba(255,49,49,0.12)",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "18px 20px 14px",
          borderBottom: "1px solid #2d2d44",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#fff", fontFamily: "'DM Sans', sans-serif" }}>
              Report this business
            </div>
            <div style={{ fontSize: 12, color: "#a0a0b0", marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>
              {businessName}
            </div>
          </div>
          <button onClick={handleClose} aria-label="Close" style={{
            width: 32, height: 32, borderRadius: 8, border: "1px solid #2d2d44",
            background: "transparent", color: "#a0a0b0", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
        </div>

        {/* Reasons */}
        <div style={{ padding: "16px 20px 0", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#a0a0b0", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 4, fontFamily: "'DM Sans', sans-serif" }}>
            What&apos;s wrong?
          </div>
          {REPORT_REASONS.map((r) => {
            const active = reason === r.value;
            return (
              <button
                key={r.value}
                onClick={() => setReason(r.value)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 14px", borderRadius: 10,
                  border: `1px solid ${active ? "#ff2d92" : "#2d2d44"}`,
                  background: active ? "rgba(255,45,146,0.08)" : "transparent",
                  cursor: "pointer", textAlign: "left",
                  transition: "all 0.15s",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                <div style={{
                  width: 18, height: 18, borderRadius: "50%",
                  border: `2px solid ${active ? "#ff2d92" : "#2d2d44"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  {active && (
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ff2d92" }} />
                  )}
                </div>
                <span style={{ fontSize: 14, color: "#fff", fontWeight: active ? 600 : 500 }}>
                  {r.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Optional details */}
        <div style={{ padding: "16px 20px 0" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#a0a0b0", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>
            Add details (optional)
          </div>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value.slice(0, 500))}
            placeholder="Anything that would help us look into this..."
            rows={3}
            style={{
              width: "100%", padding: "10px 12px", borderRadius: 8,
              border: "1px solid #2d2d44", background: "rgba(255,255,255,0.03)",
              color: "#fff", fontSize: 13, fontFamily: "'DM Sans', sans-serif",
              outline: "none", resize: "vertical", boxSizing: "border-box",
            }}
          />
          <div style={{ fontSize: 10, color: "#a0a0b0", marginTop: 4, textAlign: "right", fontFamily: "'DM Sans', sans-serif" }}>
            {details.length}/500
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "12px 20px 20px",
          borderTop: "1px solid #2d2d44",
          marginTop: 8,
        }}>
          {err && (
            <div style={{ color: "#ff3131", fontSize: 12, marginBottom: 10, textAlign: "center", fontFamily: "'DM Sans', sans-serif" }}>
              {err}
            </div>
          )}
          {doneMsg ? (
            <div style={{
              padding: "12px 16px", borderRadius: 10, textAlign: "center",
              background: "rgba(57,255,20,0.08)", color: "#39ff14", fontWeight: 600, fontSize: 14,
              fontFamily: "'DM Sans', sans-serif",
            }}>
              {doneMsg}
            </div>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!reason || submitting}
              style={{
                width: "100%", padding: "14px 20px", borderRadius: 10, border: "none",
                background: !reason ? "#2d2d44" : "linear-gradient(135deg, #ff2d92, #ff3131)",
                color: "#fff", fontSize: 14, fontWeight: 700,
                cursor: !reason || submitting ? "not-allowed" : "pointer",
                opacity: submitting ? 0.7 : 1,
                fontFamily: "'DM Sans', sans-serif",
                transition: "all 0.2s",
              }}
            >
              {submitting ? "Submitting..." : !reason ? "Pick a reason" : "Submit Report"}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
