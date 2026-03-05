"use client";

import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import NotificationBell from "@/components/NotificationBell";
import OnboardingTooltip from "@/components/OnboardingTooltip";
import { useOnboardingTour, type TourStep } from "@/lib/useOnboardingTour";
import { SwipeVerticalAnim, TabSwitchAnim, MediaAnim, HeartAnim, CommentBubbleAnim, ShareSendAnim, MuteVolumeAnim, PayoutTiersAnim } from "@/components/TourIllustrations";
import { DEFAULT_VISIT_THRESHOLDS, DEFAULT_CASHBACK_BPS, getVisitRangeLabel } from "@/lib/platformSettings";

// ═══════════════════════════════════════════════════
// LETSGO EXPERIENCES — V3 TikTok-Style Vertical Feed
// ═══════════════════════════════════════════════════

const NEON = "#FF6B2D";
const NEON_RGB = "255,107,45";

const COLORS = {
  neonOrange: "#FF6B2D",
  neonPink: "#FF2D78",
  neonBlue: "#00E5FF",
  neonGreen: "#00FF87",
  neonYellow: "#FFD600",
  neonPurple: "#D050FF",
  darkBg: "#08080E",
  cardBg: "#0C0C14",
  cardBorder: "#1a1a2a",
  glass: "rgba(12,12,20,0.85)",
  textPrimary: "#ffffff",
  textSecondary: "#7a7a99",
  textMuted: "rgba(255,255,255,0.35)",
} as const;

// ─── Types ───

type FeedPost = {
  id: string;
  createdAt: string;
  mediaType: "image" | "video";
  mediaUrl: string;
  caption: string | null;
  tags: string[];
  user: {
    id: string;
    name: string;
    username: string | null;
    avatarUrl: string | null;
  };
  business: {
    id: string;
    name: string;
    type: string;
    priceLevel: string;
    isOpen: boolean;
    closesAt: string | null;
    lifetimeLikes: number;
  };
  likeCount: number;
  commentCount: number;
  hasLiked: boolean;
};

type FeedComment = {
  id: string;
  body: string;
  createdAt: string;
  likeCount: number;
  hasLiked: boolean;
  user: {
    id: string;
    name: string;
    username: string | null;
    avatarUrl: string | null;
  };
};

type FeedTab = "foryou" | "following" | "trending";

type TagData = {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  category_name: string;
  category_icon: string;
};

type ActiveBusiness = {
  id: string;
  public_business_name: string | null;
  business_name: string | null;
  city: string | null;
  state: string | null;
};

// ─── Helpers ───

function formatNum(n: number): string {
  if (n >= 10000) return (n / 1000).toFixed(0) + "K";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toString();
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function isVideoFile(file: File): boolean {
  return file.type.startsWith("video/");
}

function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

async function getAuthToken(): Promise<string | null> {
  const { data } = await supabaseBrowser.auth.getSession();
  return data.session?.access_token ?? null;
}

async function getUserId(): Promise<string | null> {
  const { data } = await supabaseBrowser.auth.getSession();
  return data.session?.user?.id ?? null;
}

// ═══════════════════════════════════════════════════
// FLOATING ORBS (animated background)
// ═══════════════════════════════════════════════════

function FloatingOrbs() {
  const orbs = [
    { size: 280, x: "8%", y: "20%", color: COLORS.neonOrange, delay: 0, dur: 20 },
    { size: 220, x: "78%", y: "55%", color: COLORS.neonPink, delay: 3, dur: 24 },
    { size: 180, x: "45%", y: "70%", color: COLORS.neonPurple, delay: 6, dur: 18 },
    { size: 240, x: "88%", y: "15%", color: COLORS.neonBlue, delay: 9, dur: 22 },
    { size: 160, x: "25%", y: "85%", color: COLORS.neonGreen, delay: 4, dur: 26 },
  ];
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 0, overflow: "hidden", pointerEvents: "none" }}>
      {orbs.map((o, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: o.x,
            top: o.y,
            width: o.size,
            height: o.size,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${o.color}15 0%, transparent 70%)`,
            filter: "blur(70px)",
            animation: `orbFloat${i} ${o.dur}s ease-in-out infinite`,
            animationDelay: `${o.delay}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes orbFloat0 { 0%,100% { transform: translate(0,0) scale(1); } 33% { transform: translate(35px,-45px) scale(1.1); } 66% { transform: translate(-25px,35px) scale(0.9); } }
        @keyframes orbFloat1 { 0%,100% { transform: translate(0,0) scale(1); } 33% { transform: translate(-45px,25px) scale(0.95); } 66% { transform: translate(30px,-40px) scale(1.05); } }
        @keyframes orbFloat2 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(40px,30px) scale(1.08); } }
        @keyframes orbFloat3 { 0%,100% { transform: translate(0,0) scale(1); } 33% { transform: translate(-30px,-25px) scale(1.05); } 66% { transform: translate(20px,45px) scale(0.95); } }
        @keyframes orbFloat4 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-35px,-30px) scale(1.1); } }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// FIRE LIKE BUTTON
// ═══════════════════════════════════════════════════

function FireLikeButton({
  liked,
  count,
  onToggle,
  dataTour,
}: {
  liked: boolean;
  count: number;
  onToggle: () => void;
  dataTour?: string;
}) {
  const [pop, setPop] = useState(false);

  const handleClick = () => {
    onToggle();
    if (!liked) {
      setPop(true);
      setTimeout(() => setPop(false), 500);
    }
  };

  return (
    <button
      onClick={handleClick}
      aria-label={liked ? "Unlike" : "Like"}
      {...(dataTour ? { "data-tour": dataTour } : {})}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: 0,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          position: "relative",
          overflow: "hidden",
          background: liked
            ? `linear-gradient(135deg, rgba(${NEON_RGB},0.25), rgba(255,60,20,0.15))`
            : "rgba(255,255,255,0.06)",
          border: `1.5px solid ${liked ? `rgba(${NEON_RGB},0.5)` : "rgba(255,255,255,0.1)"}`,
          backdropFilter: "blur(12px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.3s ease",
          transform: pop ? "scale(1.25) rotate(-8deg)" : "scale(1) rotate(0)",
          boxShadow: liked
            ? `0 0 20px rgba(${NEON_RGB},0.3), inset 0 -8px 16px rgba(${NEON_RGB},0.1)`
            : "none",
        }}
      >
        {liked && (
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "100%",
              background: `linear-gradient(0deg, rgba(${NEON_RGB},0.2) 0%, transparent 60%)`,
              animation: "flameFill 0.5s ease-out",
            }}
          />
        )}
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          style={{
            position: "relative",
            zIndex: 1,
            filter: liked ? `drop-shadow(0 0 6px ${NEON})` : "none",
            transition: "all 0.3s",
          }}
        >
          <path
            d="M12 23c-4.97 0-9-3.58-9-8 0-3.07 2.31-6.33 4-8 .63-.63 1.68-.18 1.68.72 0 1.54.8 2.78 2.32 2.78.82 0 1.21-.37 1.52-.96.44-.83.48-2.04.48-2.96 0-3.31 2.04-5.27 3.58-6.58.5-.42 1.26-.05 1.2.6C17.5 3.6 20 6.5 20 10.5c0 .85-.1 1.5-.3 2.2-.12.4.21.8.63.8.72 0 1.17-.55 1.17-1 0-.37.03-.6.12-.76.15-.25.52-.12.6.16.22.7.28 1.44.28 2.1 0 5.12-4.93 9-10.5 9z"
            fill={liked ? NEON : "none"}
            stroke={liked ? NEON : "rgba(255,255,255,0.6)"}
            strokeWidth={liked ? "0" : "1.5"}
          />
        </svg>
      </div>
      <style>{`@keyframes flameFill { from { height: 0%; opacity: 0; } to { height: 100%; opacity: 1; } }`}</style>
    </button>
  );
}

// ═══════════════════════════════════════════════════
// BUBBLE COMMENT BUTTON
// ═══════════════════════════════════════════════════

function BubbleCommentButton({
  count,
  onClick,
  dataTour,
}: {
  count: number;
  onClick: () => void;
  dataTour?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label="Comments"
      {...(dataTour ? { "data-tour": dataTour } : {})}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: 0,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          position: "relative",
          background: "rgba(255,255,255,0.06)",
          border: "1.5px solid rgba(255,255,255,0.1)",
          backdropFilter: "blur(12px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.2s ease",
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ position: "relative", zIndex: 1 }}>
          <path
            d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"
            stroke="rgba(255,255,255,0.65)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="9" cy="12" r="1" fill={COLORS.neonBlue} />
          <circle cx="12" cy="12" r="1" fill={COLORS.neonPurple} />
          <circle cx="15" cy="12" r="1" fill={NEON} />
        </svg>
        {count > 0 && (
          <div
            style={{
              position: "absolute",
              top: -2,
              right: -2,
              minWidth: 14,
              height: 14,
              borderRadius: 7,
              background: COLORS.neonBlue,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 5px",
              fontSize: 9,
              fontWeight: 800,
              color: "#000",
              fontFamily: "'DM Sans'",
              boxShadow: `0 0 8px ${COLORS.neonBlue}80`,
            }}
          >
            {count > 99 ? "99+" : count}
          </div>
        )}
      </div>
    </button>
  );
}

// ═══════════════════════════════════════════════════
// BOLT SHARE BUTTON
// ═══════════════════════════════════════════════════

function BoltShareButton({ postId, dataTour }: { postId: string; dataTour?: string }) {
  const [sent, setSent] = useState(false);

  const handleClick = async () => {
    const shareUrl = `${window.location.origin}/experiences?post=${postId}`;
    let shared = false;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Check this out on Let's Go!", url: shareUrl });
        shared = true;
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        shared = true;
      }
    } catch {
      // User cancelled native share dialog — not an error
    }
    // Textarea fallback for insecure contexts (HTTP) where clipboard API is unavailable
    if (!shared) {
      try {
        const ta = document.createElement("textarea");
        ta.value = shareUrl;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        shared = true;
      } catch {
        // Last resort failed
      }
    }
    if (shared) {
      setSent(true);
      setTimeout(() => setSent(false), 1200);
    }
  };

  return (
    <button
      onClick={handleClick}
      aria-label="Share"
      {...(dataTour ? { "data-tour": dataTour } : {})}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: 0,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          position: "relative",
          overflow: "hidden",
          background: sent ? "rgba(0,255,135,0.12)" : "rgba(255,255,255,0.06)",
          border: `1.5px solid ${sent ? `${COLORS.neonGreen}50` : "rgba(255,255,255,0.1)"}`,
          backdropFilter: "blur(12px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.3s ease",
          transform: sent ? "scale(1.1)" : "scale(1)",
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          style={{
            position: "relative",
            zIndex: 1,
            transition: "all 0.3s",
            transform: sent ? "translateX(2px) translateY(-2px) rotate(15deg)" : "none",
          }}
        >
          <path
            d="M22 2L11 13"
            stroke={sent ? COLORS.neonGreen : "rgba(255,255,255,0.65)"}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M22 2L15 22L11 13L2 9L22 2Z"
            stroke={sent ? COLORS.neonGreen : "rgba(255,255,255,0.65)"}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill={sent ? `${COLORS.neonGreen}30` : "none"}
          />
        </svg>
        {sent && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `radial-gradient(circle, ${COLORS.neonGreen}20, transparent)`,
              animation: "sharePulse 0.6s ease-out",
            }}
          />
        )}
      </div>
      <style>{`@keyframes sharePulse { from { transform: scale(0.5); opacity: 1; } to { transform: scale(2); opacity: 0; } }`}</style>
    </button>
  );
}

// ═══════════════════════════════════════════════════
// COMMENT SECTION MODAL
// ═══════════════════════════════════════════════════

/** Sort comments: top 2 by likes first, then rest by newest */
function sortComments(comments: FeedComment[]): FeedComment[] {
  if (comments.length <= 2) return comments;

  // Find top 2 most-liked (must have at least 1 like to qualify)
  const withLikes = comments
    .filter((c) => c.likeCount > 0)
    .sort((a, b) => b.likeCount - a.likeCount)
    .slice(0, 2);

  const topIds = new Set(withLikes.map((c) => c.id));
  const rest = comments
    .filter((c) => !topIds.has(c.id))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return [...withLikes, ...rest];
}

function CommentSection({
  postId,
  onClose,
}: {
  postId: string;
  onClose: () => void;
}) {
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const token = await getAuthToken();
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(`/api/experiences/${postId}/comments?limit=50`, { headers });
        if (res.ok) {
          const data = await res.json();
          if (alive) setComments(data.comments ?? []);
        }
      } catch {
        // silently fail
      }
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [postId]);

  const handlePost = async () => {
    if (!newComment.trim() || posting) return;
    const token = await getAuthToken();
    if (!token) {
      alert("Please sign in to comment.");
      return;
    }

    setPosting(true);
    try {
      const res = await fetch(`/api/experiences/${postId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ body: newComment.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setComments((prev) => [data.comment, ...prev]);
        setNewComment("");
      }
    } catch {
      // silently fail
    }
    setPosting(false);
  };

  const handleCommentLike = async (commentId: string) => {
    const token = await getAuthToken();
    if (!token) {
      alert("Please sign in to like comments.");
      return;
    }

    // Optimistic update
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? { ...c, hasLiked: !c.hasLiked, likeCount: c.likeCount + (c.hasLiked ? -1 : 1) }
          : c
      )
    );

    try {
      const res = await fetch(`/api/experiences/${postId}/comments/${commentId}/like`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        // Revert
        setComments((prev) =>
          prev.map((c) =>
            c.id === commentId
              ? { ...c, hasLiked: !c.hasLiked, likeCount: c.likeCount + (c.hasLiked ? -1 : 1) }
              : c
          )
        );
      }
    } catch {
      // Revert
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? { ...c, hasLiked: !c.hasLiked, likeCount: c.likeCount + (c.hasLiked ? -1 : 1) }
            : c
        )
      );
    }
  };

  const sorted = sortComments(comments);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(4px)",
        }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          maxHeight: "65vh",
          background: COLORS.cardBg,
          borderRadius: "20px 20px 0 0",
          border: `1px solid ${COLORS.cardBorder}`,
          borderBottom: "none",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: `0 -10px 40px rgba(0,0,0,0.5), 0 0 30px rgba(${NEON_RGB},0.05)`,
        }}
      >
        {/* Handle + Header */}
        <div
          style={{
            padding: "12px 20px 14px",
            borderBottom: `1px solid ${COLORS.cardBorder}`,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 64,
              height: 5,
              borderRadius: 3,
              background: "rgba(255,255,255,0.25)",
              margin: "0 auto 12px",
              cursor: "grab",
            }}
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#fff",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Comments
              </span>
              <span style={{ fontSize: 12, color: COLORS.textSecondary, marginLeft: 8, fontFamily: "'DM Sans'" }}>
                {comments.length}
              </span>
            </div>
            <button
              onClick={onClose}
              aria-label="Close comments"
              style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="rgba(255,255,255,0.4)"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Comments list */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "12px 20px",
            scrollbarWidth: "thin",
            scrollbarColor: `${NEON}30 transparent`,
          }}
        >
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: COLORS.textSecondary, fontSize: 13, fontFamily: "'DM Sans'" }}>
              Loading comments...
            </div>
          ) : comments.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: COLORS.textSecondary, fontSize: 13, fontFamily: "'DM Sans'" }}>
              No comments yet. Be the first!
            </div>
          ) : (
            sorted.map((c, idx) => (
              <div key={c.id} style={{ display: "flex", gap: 12, marginBottom: 18 }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    flexShrink: 0,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                    color: "rgba(255,255,255,0.6)",
                    overflow: "hidden",
                  }}
                >
                  {c.user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.user.avatarUrl}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    c.user.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", fontFamily: "'DM Sans'" }}>
                      {c.user.name}
                    </span>
                    <span style={{ fontSize: 10, color: COLORS.textSecondary, fontFamily: "'DM Sans'" }}>
                      {timeAgo(c.createdAt)}
                    </span>
                    {/* Top comment badge for first 2 if they have likes */}
                    {idx < 2 && c.likeCount > 0 && (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          color: NEON,
                          fontFamily: "'DM Sans'",
                          padding: "1px 6px",
                          borderRadius: 50,
                          background: `rgba(${NEON_RGB}, 0.12)`,
                          border: `1px solid rgba(${NEON_RGB}, 0.25)`,
                          letterSpacing: "0.03em",
                        }}
                      >
                        TOP
                      </span>
                    )}
                  </div>
                  <p
                    style={{
                      fontSize: 13,
                      color: "rgba(255,255,255,0.8)",
                      fontFamily: "'DM Sans'",
                      lineHeight: 1.45,
                      margin: 0,
                      wordBreak: "break-word",
                    }}
                  >
                    {c.body}
                  </p>
                </div>
                {/* Like button — right side */}
                <button
                  onClick={() => handleCommentLike(c.id)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 2,
                    flexShrink: 0,
                    padding: "4px 0",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    alignSelf: "center",
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill={c.hasLiked ? NEON : "none"}
                    stroke={c.hasLiked ? NEON : "rgba(255,255,255,0.25)"}
                    strokeWidth={c.hasLiked ? "0" : "1.5"}
                    style={{
                      filter: c.hasLiked ? `drop-shadow(0 0 4px ${NEON})` : "none",
                      transition: "all 0.2s",
                    }}
                  >
                    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                  </svg>
                  {c.likeCount > 0 && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: c.hasLiked ? NEON : "rgba(255,255,255,0.3)",
                        fontFamily: "'DM Sans'",
                        transition: "color 0.2s",
                      }}
                    >
                      {c.likeCount}
                    </span>
                  )}
                </button>
              </div>
            ))
          )}
        </div>

        {/* Input bar */}
        <div
          style={{
            padding: "12px 16px",
            borderTop: `1px solid ${COLORS.cardBorder}`,
            flexShrink: 0,
            display: "flex",
            gap: 10,
            alignItems: "center",
            background: "rgba(8,8,14,0.5)",
          }}
        >
          <input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) handlePost();
            }}
            placeholder="Add a comment..."
            maxLength={1000}
            style={{
              flex: 1,
              padding: "10px 14px",
              borderRadius: 50,
              border: `1px solid ${COLORS.cardBorder}`,
              background: "rgba(255,255,255,0.04)",
              color: "#fff",
              fontSize: 13,
              fontFamily: "'DM Sans'",
              outline: "none",
            }}
          />
          <button
            onClick={handlePost}
            disabled={!newComment.trim() || posting}
            aria-label="Post comment"
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              border: "none",
              cursor: newComment.trim() && !posting ? "pointer" : "default",
              background: newComment.trim() ? NEON : "rgba(255,255,255,0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              transition: "all 0.3s",
              boxShadow: newComment.trim() ? `0 0 12px rgba(${NEON_RGB},0.4)` : "none",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke={newComment.trim() ? "#fff" : "rgba(255,255,255,0.3)"}
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <path d="M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// POST EXPERIENCE MODAL
// ═══════════════════════════════════════════════════

function PostExperienceModal({ onClose }: { onClose: () => void }) {
  const [businesses, setBusinesses] = useState<ActiveBusiness[]>([]);
  const [bizSearch, setBizSearch] = useState("");
  const [selectedBiz, setSelectedBiz] = useState<ActiveBusiness | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<TagData[]>([]);
  const [tagSearch, setTagSearch] = useState("");
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabaseBrowser
        .from("business")
        .select("id, public_business_name, business_name, city, state")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      setBusinesses((data ?? []) as ActiveBusiness[]);
    })();

    // Fetch curated tags from tags table
    (async () => {
      setTagsLoading(true);
      try {
        const { data, error } = await supabaseBrowser
          .from("tags")
          .select(`id, name, slug, color, tag_categories ( name, icon )`)
          .order("name");
        if (!error && data) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setAllTags((data as any[]).map((t) => ({
            id: t.id,
            name: t.name,
            slug: t.slug,
            color: t.color,
            category_name: t.tag_categories?.name || "Other",
            category_icon: t.tag_categories?.icon || "",
          })));
        }
      } catch (err) {
        console.error("Failed to load tags:", err);
      } finally {
        setTagsLoading(false);
      }
    })();
  }, []);

  const filtered = bizSearch.trim()
    ? businesses.filter(
        (b) =>
          (b.public_business_name || b.business_name || "")
            .toLowerCase()
            .includes(bizSearch.toLowerCase())
      )
    : businesses;

  // Tag picker helpers
  const filteredAvailableTags = allTags.filter(
    (t) =>
      t.name.toLowerCase().includes(tagSearch.toLowerCase()) &&
      !tags.includes(t.name)
  );

  const groupedFilteredTags = filteredAvailableTags.reduce(
    (acc, tag) => {
      if (!acc[tag.category_name]) {
        acc[tag.category_name] = { icon: tag.category_icon, tags: [] };
      }
      acc[tag.category_name].tags.push(tag);
      return acc;
    },
    {} as Record<string, { icon: string; tags: TagData[] }>
  );

  const addTag = (tagName: string) => {
    if (tags.length >= 10 || tags.includes(tagName)) return;
    setTags((prev) => [...prev, tagName]);
    setTagSearch("");
  };

  const removeTag = (tagName: string) => {
    setTags((prev) => prev.filter((t) => t !== tagName));
  };

  const handleSubmit = async () => {
    if (!selectedBiz || !caption.trim() || uploading) return;
    const uid = await getUserId();
    const token = await getAuthToken();
    if (!uid || !token) {
      alert("Please sign in to post.");
      return;
    }

    setUploading(true);
    setErrMsg("");

    try {
      let storagePath = "";
      let mediaType: "image" | "video" = "image";

      if (uploadFile) {
        if (!isVideoFile(uploadFile) && !isImageFile(uploadFile)) {
          throw new Error("Please upload an image or video.");
        }
        mediaType = isVideoFile(uploadFile) ? "video" : "image";
        const safeName = uploadFile.name.replace(/[^\w.\-]+/g, "_");
        const uniqueId = (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
          ? crypto.randomUUID()
          : Array.from(crypto.getRandomValues(new Uint8Array(16)))
              .map((b) => b.toString(16).padStart(2, "0"))
              .join("")
              .replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, "$1-$2-$3-$4-$5");
        storagePath = `${uid}/${uniqueId}-${safeName}`;

        const { error: upErr } = await supabaseBrowser.storage
          .from("user-experiences")
          .upload(storagePath, uploadFile, { upsert: false });
        if (upErr) throw upErr;
      } else {
        throw new Error("Please select an image or video to upload.");
      }

      const res = await fetch("/api/experiences", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          businessId: selectedBiz.id,
          storagePath,
          mediaType,
          caption: caption.trim(),
          tags: tags.map((t) => `#${t}`),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit");
      }

      setSubmitted(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      setErrMsg(msg);
    } finally {
      setUploading(false);
    }
  };

  if (submitted) {
    return (
      <div
        style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}
        onClick={onClose}
      >
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }} />
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "relative",
            width: "90%",
            maxWidth: 400,
            padding: "40px 30px",
            borderRadius: 20,
            background: COLORS.cardBg,
            border: `1px solid rgba(${NEON_RGB},0.3)`,
            textAlign: "center",
            boxShadow: `0 0 60px rgba(${NEON_RGB},0.1)`,
          }}
        >
          <div style={{ fontSize: 56, marginBottom: 16 }}>🎬</div>
          <h3
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 22,
              fontWeight: 700,
              color: "#fff",
              margin: "0 0 8px",
            }}
          >
            Submitted for Review!
          </h3>
          <p
            style={{
              fontSize: 13,
              color: COLORS.textSecondary,
              fontFamily: "'DM Sans'",
              lineHeight: 1.5,
              marginBottom: 20,
            }}
          >
            <span style={{ color: NEON, fontWeight: 700 }}>
              {selectedBiz?.public_business_name || selectedBiz?.business_name || "The business"}
            </span>{" "}
            — your experience has been submitted! Our team will review it shortly and you&apos;ll be notified once it&apos;s live.
          </p>
          <button
            onClick={onClose}
            style={{
              padding: "12px 32px",
              borderRadius: 50,
              border: `1px solid rgba(${NEON_RGB},0.4)`,
              background: `rgba(${NEON_RGB},0.12)`,
              color: NEON,
              fontSize: 13,
              fontWeight: 700,
              fontFamily: "'DM Sans'",
              cursor: "pointer",
              letterSpacing: "0.05em",
            }}
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}
      onClick={onClose}
    >
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          maxHeight: "85vh",
          background: COLORS.cardBg,
          borderRadius: "20px 20px 0 0",
          border: `1px solid ${COLORS.cardBorder}`,
          borderBottom: "none",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: `0 -10px 40px rgba(0,0,0,0.5), 0 0 30px rgba(${NEON_RGB},0.05)`,
        }}
      >
        {/* Handle + Header */}
        <div style={{ padding: "12px 20px 14px", borderBottom: `1px solid ${COLORS.cardBorder}`, flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)", margin: "0 auto 12px" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#fff", fontFamily: "'DM Sans', sans-serif" }}>
              Post Your Experience
            </span>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20, scrollbarWidth: "thin", scrollbarColor: `${NEON}30 transparent` }}>
          {/* Business search */}
          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: COLORS.textSecondary,
                textTransform: "uppercase",
                letterSpacing: 1.5,
                fontFamily: "'DM Sans'",
                display: "flex",
                alignItems: "center",
                gap: 4,
                marginBottom: 8,
              }}
            >
              Business <span style={{ color: NEON, fontSize: 14 }}>*</span>
            </label>
            {selectedBiz ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  borderRadius: 12,
                  background: `rgba(${NEON_RGB},0.08)`,
                  border: `1px solid rgba(${NEON_RGB},0.25)`,
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", fontFamily: "'DM Sans'" }}>
                    {selectedBiz.public_business_name || selectedBiz.business_name}
                  </div>
                  <div style={{ fontSize: 11, color: COLORS.textSecondary, fontFamily: "'DM Sans'", marginTop: 2 }}>
                    {[selectedBiz.city, selectedBiz.state].filter(Boolean).join(", ")}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedBiz(null);
                    setBizSearch("");
                  }}
                  style={{
                    background: "none",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 50,
                    padding: "4px 12px",
                    color: "rgba(255,255,255,0.5)",
                    fontSize: 11,
                    fontFamily: "'DM Sans'",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Change
                </button>
              </div>
            ) : (
              <div style={{ position: "relative" }}>
                <input
                  value={bizSearch}
                  onChange={(e) => {
                    setBizSearch(e.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  placeholder="Search for a business..."
                  style={{
                    width: "100%",
                    padding: "12px 14px 12px 40px",
                    borderRadius: 12,
                    border: `1px solid ${COLORS.cardBorder}`,
                    background: "rgba(255,255,255,0.04)",
                    color: "#fff",
                    fontSize: 13,
                    fontFamily: "'DM Sans'",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="rgba(255,255,255,0.3)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", zIndex: 1 }}
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                {searchOpen && (
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 4px)",
                      left: 0,
                      right: 0,
                      zIndex: 10,
                      background: COLORS.cardBg,
                      border: `1px solid ${COLORS.cardBorder}`,
                      borderRadius: 12,
                      maxHeight: 200,
                      overflowY: "auto",
                      boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
                    }}
                  >
                    {filtered.length === 0 ? (
                      <div style={{ padding: 16, fontSize: 12, color: COLORS.textSecondary, textAlign: "center", fontFamily: "'DM Sans'" }}>
                        No businesses found
                      </div>
                    ) : (
                      filtered.slice(0, 20).map((b) => (
                        <button
                          key={b.id}
                          onClick={() => {
                            setSelectedBiz(b);
                            setSearchOpen(false);
                            setBizSearch("");
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            width: "100%",
                            padding: "12px 16px",
                            background: "none",
                            border: "none",
                            borderBottom: `1px solid ${COLORS.cardBorder}`,
                            cursor: "pointer",
                            textAlign: "left",
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", fontFamily: "'DM Sans'" }}>
                              {b.public_business_name || b.business_name}
                            </div>
                            <div style={{ fontSize: 10, color: COLORS.textSecondary, fontFamily: "'DM Sans'", marginTop: 2 }}>
                              {[b.city, b.state].filter(Boolean).join(", ")}
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 6, lineHeight: 1.5, fontFamily: "'DM Sans'" }}>
              Can&apos;t find a business? They may not be on the app yet or may not have a LetsGo Premium account.
            </div>
          </div>

          {/* File upload */}
          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: COLORS.textSecondary,
                textTransform: "uppercase",
                letterSpacing: 1.5,
                fontFamily: "'DM Sans'",
                marginBottom: 8,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              Photo / Video <span style={{ color: NEON, fontSize: 14 }}>*</span>
            </label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              style={{ display: "none" }}
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
            />
            <button
              onClick={() => fileRef.current?.click()}
              style={{
                width: "100%",
                padding: 20,
                borderRadius: 12,
                cursor: "pointer",
                border: `1.5px dashed ${uploadFile ? `rgba(${NEON_RGB},0.4)` : COLORS.cardBorder}`,
                background: uploadFile ? `rgba(${NEON_RGB},0.05)` : "rgba(255,255,255,0.02)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                transition: "all 0.3s",
              }}
            >
              {uploadFile ? (
                <>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: `rgba(${NEON_RGB},0.15)`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill={NEON} stroke="none">
                      <path d="M5 3l14 9-14 9V3z" />
                    </svg>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: NEON, fontFamily: "'DM Sans'" }}>
                    {uploadFile.name}
                  </span>
                  <span style={{ fontSize: 10, color: COLORS.textSecondary, fontFamily: "'DM Sans'" }}>
                    Tap to change
                  </span>
                </>
              ) : (
                <>
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="rgba(255,255,255,0.25)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  >
                    <rect x="2" y="3" width="20" height="14" rx="2" />
                    <polygon points="23,7 16,12 23,17" />
                    <line x1="12" y1="8" x2="12" y2="14" />
                    <line x1="9" y1="11" x2="15" y2="11" />
                  </svg>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", fontFamily: "'DM Sans'", fontWeight: 500 }}>
                    Tap to upload photo or video
                  </span>
                </>
              )}
            </button>
          </div>

          {/* Caption */}
          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: COLORS.textSecondary,
                textTransform: "uppercase",
                letterSpacing: 1.5,
                fontFamily: "'DM Sans'",
                display: "flex",
                alignItems: "center",
                gap: 4,
                marginBottom: 8,
              }}
            >
              Your Experience <span style={{ color: NEON, fontSize: 14 }}>*</span>
            </label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Tell everyone about your experience..."
              rows={4}
              maxLength={500}
              style={{
                width: "100%",
                padding: 14,
                borderRadius: 12,
                resize: "vertical",
                border: `1px solid ${COLORS.cardBorder}`,
                background: "rgba(255,255,255,0.04)",
                color: "#fff",
                fontSize: 13,
                fontFamily: "'DM Sans'",
                outline: "none",
                lineHeight: 1.5,
                boxSizing: "border-box",
                minHeight: 100,
              }}
            />
            <div
              style={{
                textAlign: "right",
                marginTop: 4,
                fontSize: 10,
                color: caption.length > 450 ? COLORS.neonPink : COLORS.textSecondary,
                fontFamily: "'DM Sans'",
              }}
            >
              {caption.length}/500
            </div>
          </div>

          {/* Tags */}
          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: COLORS.textSecondary,
                textTransform: "uppercase",
                letterSpacing: 1.5,
                fontFamily: "'DM Sans'",
                marginBottom: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span>Tags</span>
              <span style={{ fontSize: 10, fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>
                {tags.length}/10
              </span>
            </label>

            {/* Selected tags */}
            {tags.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                {tags.map((t) => {
                  const tagData = allTags.find((at) => at.name === t);
                  const tagColor = tagData?.color || NEON;
                  return (
                    <span
                      key={t}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        padding: "5px 11px",
                        borderRadius: 50,
                        fontSize: 11,
                        fontWeight: 600,
                        background: `${tagColor}18`,
                        border: `1px solid ${tagColor}40`,
                        color: tagColor,
                        fontFamily: "'DM Sans'",
                      }}
                    >
                      #{t}
                      <button
                        onClick={() => removeTag(t)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "rgba(255,255,255,0.4)",
                          cursor: "pointer",
                          fontSize: 13,
                          padding: 0,
                          lineHeight: 1,
                        }}
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Tag search */}
            {tags.length < 10 && (
              <div style={{ position: "relative" }}>
                <input
                  value={tagSearch}
                  onChange={(e) => {
                    setTagSearch(e.target.value);
                    setTagDropdownOpen(true);
                  }}
                  onFocus={() => setTagDropdownOpen(true)}
                  placeholder="Search tags..."
                  style={{
                    width: "100%",
                    padding: "10px 14px 10px 36px",
                    borderRadius: 12,
                    border: `1px solid ${COLORS.cardBorder}`,
                    background: "rgba(255,255,255,0.04)",
                    color: "#fff",
                    fontSize: 13,
                    fontFamily: "'DM Sans'",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="rgba(255,255,255,0.3)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)" }}
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>

                {/* Tag dropdown */}
                {tagDropdownOpen && (
                  <>
                    {/* Click-outside overlay */}
                    <div
                      style={{ position: "fixed", inset: 0, zIndex: 9 }}
                      onClick={() => setTagDropdownOpen(false)}
                    />
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 4px)",
                        left: 0,
                        right: 0,
                        zIndex: 10,
                        background: COLORS.cardBg,
                        border: `1px solid ${COLORS.cardBorder}`,
                        borderRadius: 12,
                        maxHeight: 220,
                        overflowY: "auto",
                        boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
                        scrollbarWidth: "thin",
                        scrollbarColor: `${NEON}30 transparent`,
                      }}
                    >
                      {tagsLoading ? (
                        <div style={{ padding: 16, fontSize: 12, color: COLORS.textSecondary, textAlign: "center", fontFamily: "'DM Sans'" }}>
                          Loading tags...
                        </div>
                      ) : Object.keys(groupedFilteredTags).length > 0 ? (
                        Object.entries(groupedFilteredTags).map(([category, { icon, tags: catTags }]) => (
                          <div key={category}>
                            <div
                              style={{
                                padding: "7px 14px",
                                background: "rgba(255,255,255,0.02)",
                                fontSize: 9,
                                fontWeight: 700,
                                color: COLORS.textSecondary,
                                textTransform: "uppercase",
                                letterSpacing: 1.2,
                                display: "flex",
                                alignItems: "center",
                                gap: 5,
                                fontFamily: "'DM Sans'",
                                borderBottom: `1px solid ${COLORS.cardBorder}`,
                              }}
                            >
                              {icon && <span style={{ fontSize: 11 }}>{icon}</span>}
                              {category}
                            </div>
                            {catTags.map((tag) => (
                              <button
                                key={tag.id}
                                onClick={() => {
                                  addTag(tag.name);
                                  setTagDropdownOpen(false);
                                }}
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  width: "100%",
                                  padding: "9px 14px",
                                  background: "none",
                                  border: "none",
                                  borderBottom: `1px solid ${COLORS.cardBorder}`,
                                  cursor: "pointer",
                                  textAlign: "left",
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 500,
                                    color: tag.color || "#fff",
                                    fontFamily: "'DM Sans'",
                                  }}
                                >
                                  {tag.name}
                                </span>
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    color: NEON,
                                    fontFamily: "'DM Sans'",
                                  }}
                                >
                                  + Add
                                </span>
                              </button>
                            ))}
                          </div>
                        ))
                      ) : tagSearch ? (
                        <div style={{ padding: 16, fontSize: 12, color: COLORS.textSecondary, textAlign: "center", fontFamily: "'DM Sans'" }}>
                          No tags matching &ldquo;{tagSearch}&rdquo;
                        </div>
                      ) : (
                        <div style={{ padding: 16, fontSize: 12, color: COLORS.textSecondary, textAlign: "center", fontFamily: "'DM Sans'" }}>
                          Type to search tags
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Approval notice */}
          <div
            style={{
              padding: "14px 16px",
              borderRadius: 12,
              background: "rgba(255,255,255,0.02)",
              border: `1px solid ${COLORS.cardBorder}`,
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
              marginBottom: 8,
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke={COLORS.neonYellow}
              strokeWidth="2"
              strokeLinecap="round"
              style={{ flexShrink: 0, marginTop: 1 }}
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p
              style={{
                fontSize: 11,
                color: COLORS.textSecondary,
                fontFamily: "'DM Sans'",
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              Your post will be sent to{" "}
              <span style={{ color: "#fff", fontWeight: 600 }}>
                {selectedBiz?.public_business_name || selectedBiz?.business_name || "the business"}
              </span>{" "}
              for review before it goes live on the feed.
            </p>
          </div>

          {errMsg && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                background: "rgba(255,45,120,0.1)",
                border: "1px solid rgba(255,45,120,0.3)",
                color: COLORS.neonPink,
                fontSize: 12,
                fontFamily: "'DM Sans'",
                marginTop: 8,
              }}
            >
              {errMsg}
            </div>
          )}
        </div>

        {/* Submit */}
        <div style={{ padding: "14px 20px 20px", borderTop: `1px solid ${COLORS.cardBorder}`, flexShrink: 0 }}>
          <button
            onClick={handleSubmit}
            disabled={!selectedBiz || !caption.trim() || !uploadFile || uploading}
            style={{
              width: "100%",
              padding: 14,
              borderRadius: 50,
              border: "none",
              cursor:
                selectedBiz && caption.trim() && uploadFile && !uploading ? "pointer" : "default",
              background:
                selectedBiz && caption.trim() && uploadFile
                  ? `linear-gradient(135deg, ${NEON}, #ff4500)`
                  : "rgba(255,255,255,0.06)",
              color:
                selectedBiz && caption.trim() && uploadFile
                  ? "#fff"
                  : "rgba(255,255,255,0.3)",
              fontSize: 14,
              fontWeight: 700,
              fontFamily: "'DM Sans', sans-serif",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              boxShadow:
                selectedBiz && caption.trim() && uploadFile
                  ? `0 0 30px rgba(${NEON_RGB},0.3)`
                  : "none",
              transition: "all 0.3s",
            }}
          >
            {uploading ? "Uploading..." : "Submit for Review"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// EXPANDING CAPTION
// ═══════════════════════════════════════════════════

function Caption({ text, tags, userName, userHandle, postedAt }: { text: string; tags: string[]; userName?: string; userHandle?: string; postedAt?: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 100;
  const displayText = expanded || !isLong ? text : text.slice(0, 100) + "...";

  return (
    <div
      style={{
        marginTop: 8,
      }}
    >
      <p
        style={{
          fontSize: 14,
          color: "#fff",
          fontFamily: "'DM Sans', sans-serif",
          lineHeight: 1.55,
          margin: 0,
        }}
      >
        {userName && (
          <span style={{ fontWeight: 800, color: "#fff", marginRight: 6 }}>{userName}</span>
        )}
        {(userHandle || postedAt) && (
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginRight: 6 }}>
            {userHandle ? `@${userHandle}` : ""}{userHandle && postedAt ? " · " : ""}{postedAt || ""}
          </span>
        )}
        {displayText}
        {isLong && !expanded && (
          <button
            onClick={() => setExpanded(true)}
            style={{
              background: "none",
              border: "none",
              color: NEON,
              cursor: "pointer",
              fontWeight: 700,
              fontFamily: "'DM Sans'",
              fontSize: 13,
              padding: "0 0 0 4px",
            }}
          >
            more
          </button>
        )}
      </p>
      {(expanded || !isLong) && tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
          {tags.map((t) => (
            <span
              key={t}
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: NEON,
                fontFamily: "'DM Sans'",
              }}
            >
              {t.startsWith("#") ? t : `#${t}`}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// POST CARD (full-screen)
// ═══════════════════════════════════════════════════

function PostCard({
  post,
  isMuted,
  onToggleMute,
  onOpenComments,
  onLikeToggle,
  onShowPayout,
  isFollowing,
  onToggleFollow,
  onOpenPostModal,
  tourTargets,
}: {
  post: FeedPost;
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenComments: () => void;
  onLikeToggle: () => void;
  onShowPayout: (bizId: string, bizName: string) => void;
  isFollowing: boolean;
  onToggleFollow: (bizId: string) => void;
  onOpenPostModal: () => void;
  tourTargets?: {
    like?: string;
    comment?: string;
    share?: string;
    mute?: string;
    seeMore?: string;
  };
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const [reported, setReported] = useState(false);
  const [mediaError, setMediaError] = useState(false);

  // Auto-play/pause via IntersectionObserver
  useEffect(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container || post.mediaType !== "video") return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        }
      },
      { threshold: 0.6 }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, [post.mediaType]);

  // Sync mute state
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // Video progress
  useEffect(() => {
    const video = videoRef.current;
    if (!video || post.mediaType !== "video") return;

    const handleTimeUpdate = () => {
      if (video.duration) {
        setProgress((video.currentTime / video.duration) * 100);
      }
    };
    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
  }, [post.mediaType]);

  const biz = post.business;

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        background: COLORS.darkBg,
      }}
    >
      {/* Media */}
      {!mediaError && post.mediaUrl ? (
        post.mediaType === "video" ? (
          <video
            ref={videoRef}
            src={post.mediaUrl}
            muted={isMuted}
            loop
            playsInline
            onError={() => setMediaError(true)}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "contain",
              background: "#000",
            }}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.mediaUrl}
            alt={post.caption || "Experience"}
            onError={() => setMediaError(true)}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "contain",
              background: "#000",
            }}
          />
        )
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(135deg, #1a0a2e 0%, #2d1b4e 30%, ${NEON} 70%, #ffb347 100%)`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ fontSize: 72, filter: "drop-shadow(0 4px 24px rgba(0,0,0,0.4))" }}>📸</span>
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "rgba(255,255,255,0.8)",
              fontFamily: "'DM Sans', sans-serif",
              textShadow: "0 2px 10px rgba(0,0,0,0.5)",
              marginTop: 10,
            }}
          >
            {biz.name}
          </span>
        </div>
      )}

      {/* Gradient overlays */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "25%",
          background: "linear-gradient(180deg, rgba(0,0,0,0.5) 0%, transparent 100%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "60%",
          background: "linear-gradient(0deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.4) 45%, transparent 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Video progress bar */}
      {post.mediaType === "video" && (
        <div
          style={{
            position: "absolute",
            bottom: 290,
            left: 0,
            right: 0,
            height: 2,
            background: "rgba(255,255,255,0.08)",
            zIndex: 15,
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progress}%`,
              background: `linear-gradient(90deg, rgba(${NEON_RGB},0.6), ${NEON})`,
              borderRadius: 1,
              transition: "width 0.1s linear",
              boxShadow: `0 0 4px rgba(${NEON_RGB},0.3)`,
            }}
          />
        </div>
      )}

      {/* Top right: mute + report */}
      <div
        style={{
          position: "absolute",
          top: 120,
          right: 16,
          display: "flex",
          alignItems: "center",
          gap: 8,
          zIndex: 10,
        }}
      >
        {post.mediaType === "video" && (
          <button
            onClick={onToggleMute}
            aria-label={isMuted ? "Unmute" : "Mute"}
            {...(tourTargets?.mute ? { "data-tour": tourTargets.mute } : {})}
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "rgba(0,0,0,0.4)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            {isMuted ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11,5 6,9 2,9 2,15 6,15 11,19" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11,5 6,9 2,9 2,15 6,15 11,19" />
                <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
              </svg>
            )}
          </button>
        )}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setReportOpen((r) => !r)}
            aria-label="More options"
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "rgba(0,0,0,0.4)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(255,255,255,0.6)" stroke="none">
              <circle cx="12" cy="5" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="19" r="2" />
            </svg>
          </button>
          {reportOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                right: 0,
                width: 180,
                background: COLORS.cardBg,
                border: `1px solid ${COLORS.cardBorder}`,
                borderRadius: 12,
                boxShadow: "0 8px 30px rgba(0,0,0,0.6)",
                overflow: "hidden",
                zIndex: 60,
              }}
            >
              {reported ? (
                <div style={{ padding: 16, textAlign: "center" }}>
                  <span style={{ fontSize: 11, color: COLORS.neonGreen, fontWeight: 700, fontFamily: "'DM Sans'" }}>
                    Report submitted
                  </span>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setReported(true);
                    setTimeout(() => setReportOpen(false), 1200);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    padding: "14px 16px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={COLORS.neonPink}
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                    <line x1="4" y1="22" x2="4" y2="15" />
                  </svg>
                  <span
                    style={{
                      fontSize: 13,
                      color: "rgba(255,255,255,0.8)",
                      fontFamily: "'DM Sans'",
                      fontWeight: 600,
                    }}
                  >
                    Report
                  </span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom section: content + action bar */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 10,
        }}
      >
        {/* Content area: business info + caption */}
        <div style={{ padding: "0 16px 10px" }}>
          {/* Business info card */}
        <div
          style={{
            marginBottom: 6,
          }}
        >
          {/* Row 1: Name + Follow + Open/Close + Lifetime likes + See More */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5, flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: "#fff",
                fontFamily: "'Clash Display','DM Sans',sans-serif",
              }}
            >
              {biz.name}
            </span>
            {/* Follow button */}
            <button
              onClick={() => onToggleFollow(biz.id)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
                padding: "2px 10px",
                borderRadius: 50,
                fontSize: 10,
                fontWeight: 700,
                background: isFollowing ? `rgba(${NEON_RGB},0.15)` : "transparent",
                border: `1px solid ${isFollowing ? NEON : "rgba(255,255,255,0.25)"}`,
                color: isFollowing ? NEON : "rgba(255,255,255,0.7)",
                cursor: "pointer",
                fontFamily: "'DM Sans'",
                transition: "all 0.25s ease",
                whiteSpace: "nowrap",
                boxShadow: isFollowing ? `0 0 8px rgba(${NEON_RGB},0.2)` : "none",
              }}
            >
              {isFollowing ? "✓ Following" : "+ Follow"}
            </button>
            {/* Open/Closed badge */}
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 3,
                padding: "2px 8px",
                borderRadius: 50,
                fontSize: 10,
                fontWeight: 700,
                background: biz.isOpen ? `${COLORS.neonGreen}15` : `${COLORS.neonPink}15`,
                color: biz.isOpen ? COLORS.neonGreen : COLORS.neonPink,
                border: `1px solid ${biz.isOpen ? COLORS.neonGreen : COLORS.neonPink}30`,
              }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: biz.isOpen ? COLORS.neonGreen : COLORS.neonPink,
                }}
              />
              {biz.isOpen ? "Open" : "Closed"}
            </span>
            {/* Lifetime likes */}
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 3,
                padding: "2px 8px",
                borderRadius: 50,
                fontSize: 10,
                fontWeight: 700,
                background: `rgba(${NEON_RGB},0.1)`,
                border: `1px solid rgba(${NEON_RGB},0.25)`,
                color: NEON,
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill={NEON} stroke="none">
                <path d="M12 23c-4.97 0-9-3.58-9-8 0-3.07 2.31-6.33 4-8 .63-.63 1.68-.18 1.68.72 0 1.54.8 2.78 2.32 2.78.82 0 1.21-.37 1.52-.96.44-.83.48-2.04.48-2.96 0-3.31 2.04-5.27 3.58-6.58.5-.42 1.26-.05 1.2.6C17.5 3.6 20 6.5 20 10.5c0 .85-.1 1.5-.3 2.2-.12.4.21.8.63.8.72 0 1.17-.55 1.17-1 0-.37.03-.6.12-.76.15-.25.52-.12.6.16.22.7.28 1.44.28 2.1 0 5.12-4.93 9-10.5 9z" />
              </svg>
              {formatNum(biz.lifetimeLikes)}
            </span>
            {/* See More — opens payout breakdown modal */}
            <button
              onClick={() => onShowPayout(biz.id, biz.name)}
              {...(tourTargets?.seeMore ? { "data-tour": tourTargets.seeMore } : {})}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "2px 8px",
                borderRadius: 50,
                fontSize: 10,
                fontWeight: 700,
                background: `${COLORS.neonBlue}10`,
                border: `1px solid ${COLORS.neonBlue}30`,
                color: COLORS.neonBlue,
                cursor: "pointer",
                fontFamily: "'DM Sans'",
                transition: "all 0.2s ease",
                whiteSpace: "nowrap",
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={COLORS.neonBlue} strokeWidth="2.5" strokeLinecap="round">
                <polygon points="23,7 16,12 23,17" />
                <rect x="1" y="5" width="15" height="14" rx="2" />
              </svg>
              See More
            </button>
          </div>
          {/* Row 2: Type · Price */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: "'DM Sans'" }}>{biz.type}</span>
            <span style={{ fontSize: 11, color: COLORS.textMuted }}>·</span>
            <span style={{ fontSize: 11, color: COLORS.neonYellow, fontWeight: 700, fontFamily: "'DM Sans'" }}>
              {biz.priceLevel}
            </span>
          </div>
        </div>

        {/* Caption */}
        {post.caption && <Caption text={post.caption} tags={post.tags} userName={post.user.name} userHandle={post.user.username || undefined} postedAt={timeAgo(post.createdAt)} />}
        </div>

        {/* Bottom action bar — matching header banner */}
        <div style={{ position: "relative" }}>
          {/* Animated neon border (top edge) */}
          <div
            style={{
              position: "absolute",
              top: -2,
              left: 0,
              right: 0,
              height: 4,
              background: `linear-gradient(90deg, transparent 5%, ${NEON}90, ${NEON}, ${NEON}90, transparent 95%)`,
              backgroundSize: "300% 100%",
              animation: "borderTravel-exp 8s linear infinite",
              opacity: 0.6,
            }}
          />
          <div
            style={{
              position: "relative",
              background: "rgba(8,8,14,0.92)",
              backdropFilter: "blur(30px)",
              padding: "12px 24px 110px",
              borderTop: `1px solid rgba(${NEON_RGB}, 0.08)`,
            }}
          >
            {/* Dot pattern */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage: `radial-gradient(circle, ${NEON} 0.5px, transparent 0.5px)`,
                backgroundSize: "20px 20px",
                backgroundPosition: "10px 10px",
                opacity: 0.04,
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                position: "relative",
                zIndex: 2,
                display: "flex",
                justifyContent: "space-around",
                alignItems: "flex-start",
              }}
            >
              {/* Camera / Post button */}
              <button
                data-tour="exp-post-btn"
                onClick={onOpenPostModal}
                aria-label="Post experience"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 3,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: `linear-gradient(135deg, rgba(${NEON_RGB},0.25), rgba(${NEON_RGB},0.1))`,
                    border: `1.5px solid rgba(${NEON_RGB},0.4)`,
                    backdropFilter: "blur(12px)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: `0 0 12px rgba(${NEON_RGB},0.2)`,
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={NEON} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </div>
              </button>

              <FireLikeButton liked={post.hasLiked} count={post.likeCount} onToggle={onLikeToggle} dataTour={tourTargets?.like} />
              <BubbleCommentButton count={post.commentCount} onClick={onOpenComments} dataTour={tourTargets?.comment} />
              <BoltShareButton postId={post.id} dataTour={tourTargets?.share} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// FEED TABS
// ═══════════════════════════════════════════════════

function FeedTabs({
  activeTab,
  setActiveTab,
}: {
  activeTab: FeedTab;
  setActiveTab: (t: FeedTab) => void;
}) {
  const tabs: { id: FeedTab; label: string }[] = [
    { id: "foryou", label: "For You" },
    { id: "following", label: "Following" },
    { id: "trending", label: "Trending" },
  ];

  return (
    <div data-tour="exp-tabs" style={{ display: "flex", gap: 0, justifyContent: "center", alignItems: "center" }}>
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => setActiveTab(t.id)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "6px 14px",
            position: "relative",
            fontFamily: "'DM Sans'",
            fontSize: 13,
            fontWeight: activeTab === t.id ? 700 : 500,
            color: activeTab === t.id ? "#fff" : "rgba(255,255,255,0.45)",
            transition: "all 0.3s ease",
            textShadow: activeTab === t.id ? `0 0 12px rgba(${NEON_RGB}, 0.4)` : "none",
          }}
        >
          {t.label}
          {activeTab === t.id && (
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: "50%",
                transform: "translateX(-50%)",
                width: 20,
                height: 2,
                borderRadius: 1,
                background: NEON,
                boxShadow: `0 0 8px ${NEON}`,
              }}
            />
          )}
        </button>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════

export default function ExperiencesPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [activeTab, setActiveTab] = useState<FeedTab>("foryou");
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [commentPostId, setCommentPostId] = useState<string | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [filterBizId, setFilterBizId] = useState<string | null>(null);
  const [filterBizName, setFilterBizName] = useState<string | null>(null);
  const [followedBizIds, setFollowedBizIds] = useState<Set<string>>(new Set());
  const [feedHint, setFeedHint] = useState<string | null>(null);

  // Payout breakdown modal
  const [payoutModalBiz, setPayoutModalBiz] = useState<{ id: string; name: string } | null>(null);
  const [payoutRates, setPayoutRates] = useState<number[]>([]);
  const [payoutLoading, setPayoutLoading] = useState(false);

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
    if (!payoutModalBiz) return;
    let cancelled = false;
    setPayoutLoading(true);
    fetch(`/api/businesses/${payoutModalBiz.id}/tiers`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const tiers = data.tiers as { percent_bps: number; tier_index: number }[] | undefined;
        if (tiers && tiers.length >= 7) {
          setPayoutRates(tiers.slice(0, 7).map((t) => Number(t.percent_bps) / 100));
        } else {
          // Fall back to platform defaults
          setPayoutRates(DEFAULT_CASHBACK_BPS.map((bps) => bps / 100));
        }
        setPayoutLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setPayoutRates(DEFAULT_CASHBACK_BPS.map((bps) => bps / 100));
        setPayoutLoading(false);
      });
    return () => { cancelled = true; };
  }, [payoutModalBiz]);

  // Onboarding tour
  const expTourSteps: TourStep[] = useMemo(() => [
    { target: '[data-tour="exp-feed"]', title: "Swipe through experiences", description: "Scroll to see real photos and videos from people visiting local spots. Discover what's happening around you.", position: "bottom" },
    { target: '[data-tour="exp-tabs"]', title: "Find your vibe", description: "For You shows our best picks. Following shows posts from businesses you follow. Trending shows what's hot right now.", position: "bottom" },
    { target: '[data-tour="exp-post-btn"]', title: "Share your experience", description: "Had an amazing time? Snap a photo or record a video and share it with the community. Businesses might even feature your post!", position: "left" },
    { target: '[data-tour="exp-like-btn"]', title: "Show some love", description: "Tap the flame icon to like posts you enjoy. Follow businesses to see their content in your Following tab.", position: "left" },
    { target: '[data-tour="exp-comment-btn"]', title: "Join the conversation", description: "Tap the comment bubble to read what others are saying or leave your own thoughts on a post.", position: "left" },
    { target: '[data-tour="exp-share-btn"]', title: "Share with friends", description: "Tap the share button to send a post link to your friends via text, social media, or copy it to your clipboard.", position: "left" },
    { target: '[data-tour="exp-mute-btn"]', title: "Control the sound", description: "Video posts play muted by default. Tap the speaker icon in the top right to toggle sound on or off.", position: "left" },
    { target: '[data-tour="exp-see-more"]', title: "Progressive Payout Breakdown", description: "Tap 'See More' to view this business's Progressive Payout breakdown — see exactly how much cashback you can earn at each visit tier.", position: "top" },
  ], []);
  const expTourIllustrations: React.ReactNode[] = useMemo(() => [
    <SwipeVerticalAnim key="sv" />, <TabSwitchAnim key="ts" />, <MediaAnim key="m" />, <HeartAnim key="h" />,
    <CommentBubbleAnim key="cb" />, <ShareSendAnim key="ss" />, <MuteVolumeAnim key="mv" />, <PayoutTiersAnim key="pt" />,
  ], []);
  const tour = useOnboardingTour("experiences", expTourSteps, 1000, !loading);

  const verticalRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const fetchingRef = useRef(false);

  // ── Fetch followed businesses on mount ──
  useEffect(() => {
    (async () => {
      const uid = await getUserId();
      if (!uid) return;
      try {
        const res = await fetch(`/api/businesses/follow?userId=${uid}`);
        if (res.ok) {
          const data = await res.json();
          setFollowedBizIds(new Set<string>(data.followedBusinessIds ?? []));
        }
      } catch {
        // silently fail — follows just won't show as active
      }
    })();
  }, []);

  // ── Toggle follow/unfollow ──
  const handleToggleFollow = useCallback(async (bizId: string) => {
    const uid = await getUserId();
    if (!uid) {
      alert("Please sign in to follow businesses.");
      return;
    }

    // Optimistic update
    setFollowedBizIds((prev) => {
      const next = new Set(prev);
      if (next.has(bizId)) {
        next.delete(bizId);
      } else {
        next.add(bizId);
      }
      return next;
    });

    try {
      const res = await fetch("/api/businesses/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: bizId, userId: uid }),
      });
      if (!res.ok) {
        // Revert on failure
        setFollowedBizIds((prev) => {
          const next = new Set(prev);
          if (next.has(bizId)) {
            next.delete(bizId);
          } else {
            next.add(bizId);
          }
          return next;
        });
      }
    } catch {
      // Revert on error
      setFollowedBizIds((prev) => {
        const next = new Set(prev);
        if (next.has(bizId)) {
          next.delete(bizId);
        } else {
          next.add(bizId);
        }
        return next;
      });
    }
  }, []);

  // ── Fetch feed ──
  const fetchFeed = useCallback(
    async (resetCursor = false) => {
      if (fetchingRef.current) return;
      fetchingRef.current = true;

      if (resetCursor) {
        setLoading(true);
        setPosts([]);
        setCursor(null);
        setHasMore(true);
      }

      try {
        const token = await getAuthToken();
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const params = new URLSearchParams();
        if (!resetCursor && cursor) params.set("cursor", cursor);
        params.set("limit", "10");
        params.set("tab", activeTab);
        if (filterBizId) params.set("bizId", filterBizId);

        const res = await fetch(`/api/experiences?${params}`, { headers });
        if (!res.ok) throw new Error("Failed to fetch feed");

        const data = await res.json();
        const newPosts = (data.posts ?? []) as FeedPost[];
        setFeedHint(data.hint ?? null);

        if (resetCursor) {
          setPosts(newPosts);
        } else {
          setPosts((prev) => {
            const existingIds = new Set(prev.map((p) => p.id));
            const unique = newPosts.filter((p) => !existingIds.has(p.id));
            return [...prev, ...unique];
          });
        }

        setCursor(data.nextCursor ?? null);
        setHasMore(!!data.nextCursor);
      } catch (err) {
        console.error("[experiences] fetch error:", err);
      } finally {
        setLoading(false);
        fetchingRef.current = false;
      }
    },
    [activeTab, cursor, filterBizId]
  );

  // Initial load + tab/filter changes
  useEffect(() => {
    fetchFeed(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, filterBizId]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !fetchingRef.current) {
          fetchFeed(false);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, cursor]);

  // Track current scroll index
  const handleVerticalScroll = useCallback(() => {
    if (!verticalRef.current) return;
    const { scrollTop, clientHeight } = verticalRef.current;
    setCurrentIdx(Math.round(scrollTop / clientHeight));
  }, []);

  // ── Like toggle (optimistic) ──
  const handleFilterBusiness = useCallback((bizId: string, bizName?: string) => {
    setFilterBizId(bizId);
    setFilterBizName(bizName || null);
    setPosts([]);
    setCursor(null);
    setHasMore(true);
    // The fetchFeed will pick up filterBizId on next render
  }, []);

  const clearBusinessFilter = useCallback(() => {
    setFilterBizId(null);
    setFilterBizName(null);
    setPosts([]);
    setCursor(null);
    setHasMore(true);
  }, []);

  const handleLikeToggle = useCallback(async (postId: string) => {
    const token = await getAuthToken();
    if (!token) {
      alert("Please sign in to like posts.");
      return;
    }

    // Optimistic update — also update business lifetimeLikes for all posts of this business
    setPosts((prev) => {
      const target = prev.find((p) => p.id === postId);
      if (!target) return prev;
      const delta = target.hasLiked ? -1 : 1;
      const bizId = target.business.id;
      return prev.map((p) => {
        if (p.id === postId) {
          return {
            ...p,
            hasLiked: !p.hasLiked,
            likeCount: p.likeCount + delta,
            business: { ...p.business, lifetimeLikes: p.business.lifetimeLikes + delta },
          };
        }
        if (p.business.id === bizId) {
          return {
            ...p,
            business: { ...p.business, lifetimeLikes: p.business.lifetimeLikes + delta },
          };
        }
        return p;
      });
    });

    try {
      const res = await fetch(`/api/experiences/${postId}/like`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        // Revert on failure
        setPosts((prev) => {
          const target = prev.find((p) => p.id === postId);
          if (!target) return prev;
          const delta = target.hasLiked ? 1 : -1;
          const bizId = target.business.id;
          return prev.map((p) => {
            if (p.id === postId) {
              return {
                ...p,
                hasLiked: !p.hasLiked,
                likeCount: p.likeCount + delta,
                business: { ...p.business, lifetimeLikes: p.business.lifetimeLikes + delta },
              };
            }
            if (p.business.id === bizId) {
              return {
                ...p,
                business: { ...p.business, lifetimeLikes: p.business.lifetimeLikes + delta },
              };
            }
            return p;
          });
        });
      }
    } catch {
      // Revert on error
      setPosts((prev) => {
        const target = prev.find((p) => p.id === postId);
        if (!target) return prev;
        const delta = target.hasLiked ? 1 : -1;
        const bizId = target.business.id;
        return prev.map((p) => {
          if (p.id === postId) {
            return {
              ...p,
              hasLiked: !p.hasLiked,
              likeCount: p.likeCount + delta,
              business: { ...p.business, lifetimeLikes: p.business.lifetimeLikes + delta },
            };
          }
          if (p.business.id === bizId) {
            return {
              ...p,
              business: { ...p.business, lifetimeLikes: p.business.lifetimeLikes + delta },
            };
          }
          return p;
        });
      });
    }
  }, []);

  // ── Handle tab change ──
  const handleTabChange = useCallback((tab: FeedTab) => {
    setActiveTab(tab);
    if (verticalRef.current) {
      verticalRef.current.scrollTo({ top: 0 });
    }
  }, []);

  // ── Loading state ──
  if (loading && posts.length === 0) {
    return (
      <div
        style={{
          width: "100%",
          height: "100vh",
          background: COLORS.darkBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <FloatingOrbs />
        <div style={{ position: "relative", zIndex: 10, textAlign: "center" }}>
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: 16,
              border: `2px solid ${NEON}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              fontSize: 24,
              color: NEON,
              fontWeight: 600,
              fontFamily: "'Clash Display','DM Sans',sans-serif",
              background: `rgba(${NEON_RGB}, 0.06)`,
              boxShadow: `0 0 20px rgba(${NEON_RGB}, 0.15)`,
            }}
          >
            LG
          </div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", letterSpacing: "0.1em" }}>
            Loading experiences...
          </div>
        </div>
      </div>
    );
  }

  // ── Empty state ──
  if (!loading && posts.length === 0) {
    // Determine empty state messaging based on tab + hint
    let emptyIcon = "🎥";
    let emptyTitle = "No experiences yet";
    let emptyDesc = "Be the first to share your experience!";
    let showPostCta = true;

    if (activeTab === "following") {
      if (feedHint === "login_required") {
        emptyIcon = "🔒";
        emptyTitle = "Sign in to see your feed";
        emptyDesc = "Log in to see posts from businesses you follow.";
        showPostCta = false;
      } else if (feedHint === "no_follows") {
        emptyIcon = "👀";
        emptyTitle = "No businesses followed yet";
        emptyDesc = "Follow businesses on the For You tab to see their posts here!";
        showPostCta = false;
      } else {
        emptyIcon = "📭";
        emptyTitle = "Nothing here yet";
        emptyDesc = "Businesses you follow haven't posted experiences yet.";
        showPostCta = true;
      }
    } else if (activeTab === "trending") {
      emptyIcon = "📈";
      emptyTitle = "No trending posts";
      emptyDesc = "Check back soon — trending posts update as people engage!";
      showPostCta = true;
    }

    return (
      <div
        style={{
          width: "100%",
          height: "100vh",
          background: COLORS.darkBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <FloatingOrbs />
        <div style={{ position: "relative", zIndex: 10, textAlign: "center", padding: 24 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>{emptyIcon}</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#fff", margin: "0 0 8px" }}>
            {emptyTitle}
          </h2>
          <p style={{ fontSize: 14, color: COLORS.textSecondary, marginBottom: 24, lineHeight: 1.5 }}>
            {emptyDesc}
          </p>
          {showPostCta && (
            <button
              onClick={() => setPostModalOpen(true)}
              style={{
                padding: "14px 32px",
                borderRadius: 50,
                border: "none",
                background: `linear-gradient(135deg, ${NEON}, #ff4500)`,
                color: "#fff",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                boxShadow: `0 0 30px rgba(${NEON_RGB},0.3)`,
              }}
            >
              Post Your Experience
            </button>
          )}
          {activeTab === "following" && feedHint === "no_follows" && (
            <button
              onClick={() => handleTabChange("foryou")}
              style={{
                padding: "14px 32px",
                borderRadius: 50,
                border: `1px solid rgba(${NEON_RGB}, 0.35)`,
                background: `rgba(${NEON_RGB}, 0.1)`,
                color: NEON,
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Browse For You
            </button>
          )}
        </div>
        {postModalOpen && <PostExperienceModal onClose={() => setPostModalOpen(false)} />}
      </div>
    );
  }

  if (!authChecked) return <div style={{ minHeight: "100vh", background: COLORS.darkBg }} />;

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        background: COLORS.darkBg,
        position: "relative",
        overflow: "hidden",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        href="https://fonts.googleapis.com/css2?family=Dela+Gothic+One&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400&display=swap"
        rel="stylesheet"
      />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        href="https://api.fontshare.com/v2/css?f[]=clash-display@700,600,500&display=swap"
        rel="stylesheet"
      />

      <FloatingOrbs />

      {/* ─── Header ─── */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 100, pointerEvents: "auto" }}>
        <style>{`
          @keyframes borderTravel-exp { 0% { background-position: 0% 50%; } 100% { background-position: 300% 50%; } }
          @keyframes neonFlicker-exp {
            0%, 100% { text-shadow: 0 0 8px ${NEON}90, 0 0 20px ${NEON}50; }
            5% { text-shadow: 0 0 4px ${NEON}40, 0 0 10px ${NEON}20; }
            6% { text-shadow: 0 0 8px ${NEON}90, 0 0 20px ${NEON}50; }
            45% { text-shadow: 0 0 8px ${NEON}90, 0 0 20px ${NEON}50; }
            46% { text-shadow: 0 0 2px ${NEON}30, 0 0 6px ${NEON}15; }
            48% { text-shadow: 0 0 8px ${NEON}90, 0 0 20px ${NEON}50; }
          }
          @keyframes logoGlow {
            0%, 100% { filter: drop-shadow(0 0 8px ${NEON}) drop-shadow(0 0 20px ${NEON}50); }
            50% { filter: drop-shadow(0 0 12px ${NEON}) drop-shadow(0 0 35px ${NEON}70); }
          }
        `}</style>
        <div style={{ position: "relative" }}>
          <div
            style={{
              position: "absolute",
              inset: -2,
              borderRadius: 0,
              background: `linear-gradient(90deg, transparent 5%, ${NEON}90, ${NEON}, ${NEON}90, transparent 95%)`,
              backgroundSize: "300% 100%",
              animation: "borderTravel-exp 8s linear infinite",
              opacity: 0.6,
            }}
          />
          <div
            style={{
              position: "relative",
              background: "rgba(8,8,14,0.92)",
              backdropFilter: "blur(30px)",
              padding: "12px 16px 0",
              borderBottom: `1px solid rgba(${NEON_RGB}, 0.08)`,
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage: `radial-gradient(circle, ${NEON} 0.5px, transparent 0.5px)`,
                backgroundSize: "20px 20px",
                backgroundPosition: "10px 10px",
                opacity: 0.04,
                pointerEvents: "none",
              }}
            />
            <div style={{ position: "relative", zIndex: 2 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <a
                    href="/"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 36,
                      height: 36,
                      borderRadius: 4,
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "rgba(255,255,255,0.03)",
                      cursor: "pointer",
                      backdropFilter: "blur(8px)",
                      textDecoration: "none",
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 18l-6-6 6-6" />
                    </svg>
                  </a>
                  <div style={{ animation: "logoGlow 5s ease-in-out infinite" }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 6,
                        border: `2px solid ${NEON}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: "'Clash Display','DM Sans',sans-serif",
                        fontSize: 13,
                        fontWeight: 600,
                        color: NEON,
                        background: `rgba(${NEON_RGB}, 0.06)`,
                        textShadow: `0 0 12px ${NEON}`,
                        boxShadow: `0 0 20px rgba(${NEON_RGB}, 0.15), inset 0 0 12px rgba(${NEON_RGB}, 0.05)`,
                      }}
                    >
                      LG
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    flex: 1,
                    textAlign: "center",
                    fontFamily: "'Clash Display','DM Sans',sans-serif",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.2em",
                    color: NEON,
                    animation: "neonFlicker-exp 12s ease-in-out infinite",
                    textShadow: `0 0 20px rgba(${NEON_RGB}, 0.5), 0 0 40px rgba(${NEON_RGB}, 0.2)`,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    padding: "0 6px",
                  }}
                >
                  ❋ E X P E R I E N C E S
                </div>
                <NotificationBell />
              </div>
              <FeedTabs activeTab={activeTab} setActiveTab={(t) => { clearBusinessFilter(); handleTabChange(t); }} />
            </div>
          </div>
        </div>
      </div>

      {/* Business filter indicator */}
      {filterBizId && filterBizName && (
        <div
          style={{
            position: "absolute",
            top: 105,
            left: 0,
            right: 0,
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "6px 16px",
            background: "rgba(8,8,14,0.9)",
            backdropFilter: "blur(16px)",
            borderBottom: `1px solid rgba(${NEON_RGB}, 0.15)`,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "5px 14px",
              borderRadius: 50,
              background: `rgba(${NEON_RGB}, 0.1)`,
              border: `1px solid rgba(${NEON_RGB}, 0.3)`,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: NEON, boxShadow: `0 0 6px ${NEON}` }} />
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: NEON,
                fontFamily: "'DM Sans'",
              }}
            >
              {filterBizName}
            </span>
            <button
              onClick={clearBusinessFilter}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "rgba(255,255,255,0.5)",
                fontSize: 14,
                padding: "0 0 0 4px",
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* ─── Vertical Feed ─── */}
      <div
        data-tour="exp-feed"
        ref={verticalRef}
        onScroll={handleVerticalScroll}
        style={{
          width: "100%",
          height: "100%",
          overflowY: "auto",
          overflowX: "hidden",
          scrollSnapType: "y mandatory",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          position: "relative",
          zIndex: 1,
        }}
      >
        {posts.map((post, idx) => (
          <div
            key={post.id}
            style={{
              width: "100%",
              height: "100vh",
              scrollSnapAlign: "start",
              position: "relative",
            }}
          >
            <PostCard
              post={post}
              isMuted={isMuted}
              onToggleMute={() => setIsMuted((m) => !m)}
              onOpenComments={() => setCommentPostId(post.id)}
              onLikeToggle={() => handleLikeToggle(post.id)}
              onShowPayout={(bizId, bizName) => setPayoutModalBiz({ id: bizId, name: bizName })}
              isFollowing={followedBizIds.has(post.business.id)}
              onToggleFollow={handleToggleFollow}
              {...(idx === 0 ? { tourTargets: { like: "exp-like-btn", comment: "exp-comment-btn", share: "exp-share-btn", mute: "exp-mute-btn", seeMore: "exp-see-more" } } : {})}
              onOpenPostModal={() => setPostModalOpen(true)}
            />
          </div>
        ))}
        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} style={{ height: 1 }} />
      </div>

      {/* Right progress dots */}
      {posts.length > 1 && (
        <div
          style={{
            position: "fixed",
            right: 8,
            top: "50%",
            transform: "translateY(-50%)",
            display: "flex",
            flexDirection: "column",
            gap: 5,
            zIndex: 50,
          }}
        >
          {posts.slice(0, 20).map((_, i) => (
            <div
              key={i}
              style={{
                width: 3,
                height: i === currentIdx ? 18 : 7,
                borderRadius: 2,
                background: i === currentIdx ? NEON : "rgba(255,255,255,0.15)",
                transition: "all 0.3s ease",
                boxShadow: i === currentIdx ? `0 0 6px ${NEON}` : "none",
              }}
            />
          ))}
        </div>
      )}


      {/* Post modal */}
      {postModalOpen && <PostExperienceModal onClose={() => setPostModalOpen(false)} />}

      {/* Comments modal */}
      {commentPostId && (
        <CommentSection postId={commentPostId} onClose={() => setCommentPostId(null)} />
      )}

      {/* Payout breakdown modal */}
      {payoutModalBiz && (
        <div
          onClick={() => setPayoutModalBiz(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(12px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 420,
              maxHeight: "85vh",
              overflowY: "auto",
              background: COLORS.cardBg,
              border: `1px solid ${COLORS.cardBorder}`,
              borderRadius: 20,
              boxShadow: `0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(${NEON_RGB},0.08)`,
              position: "relative",
            }}
          >
            {/* Close button */}
            <button
              onClick={() => setPayoutModalBiz(null)}
              style={{
                position: "absolute",
                top: 14,
                right: 14,
                width: 30,
                height: 30,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.5)",
                fontSize: 16,
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
            <div style={{ padding: "24px 20px 0", textAlign: "center" }}>
              <div style={{
                fontSize: 10,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: 2.5,
                color: COLORS.textSecondary,
                marginBottom: 6,
                fontFamily: "'DM Sans', sans-serif",
              }}>
                Progressive Payout Ladder
              </div>
              <div style={{
                fontSize: 18,
                fontWeight: 800,
                color: "#fff",
                fontFamily: "'Clash Display','DM Sans',sans-serif",
                marginBottom: 4,
              }}>
                {payoutModalBiz.name}
              </div>
              <div style={{
                fontSize: 11,
                color: COLORS.textSecondary,
                fontFamily: "'DM Sans', sans-serif",
                marginBottom: 20,
              }}>
                Earn more cashback with every visit
              </div>
            </div>

            {/* Tier ladder */}
            <div style={{ padding: "0 16px 16px" }}>
              {payoutLoading ? (
                <div style={{ textAlign: "center", padding: 30, color: COLORS.textSecondary, fontSize: 12 }}>
                  Loading tiers...
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {DEFAULT_VISIT_THRESHOLDS.map((t, i) => {
                    const pct = payoutRates[i] ?? 0;
                    const levelColors = [COLORS.textSecondary, COLORS.neonBlue, COLORS.neonGreen, COLORS.neonYellow, COLORS.neonOrange, COLORS.neonPink, COLORS.neonPurple];
                    const color = levelColors[i];
                    return (
                      <div key={i} style={{
                        display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                        borderRadius: 10, background: `${color}08`, border: `1px solid ${color}20`,
                      }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                          background: `${color}18`, color, fontSize: 14, fontWeight: 800, fontFamily: "'DM Sans', sans-serif",
                        }}>
                          {t.level}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", fontFamily: "'DM Sans', sans-serif" }}>
                            Level {t.level} <span style={{ color, fontWeight: 600 }}>({t.label})</span>
                          </div>
                          <div style={{ fontSize: 11, color: COLORS.textSecondary, fontFamily: "'DM Sans', sans-serif" }}>
                            {getVisitRangeLabel(t)}
                          </div>
                        </div>
                        <div style={{
                          fontSize: 20, fontWeight: 800, color, fontFamily: "'DM Sans', sans-serif",
                          textShadow: `0 0 20px ${color}40`,
                        }}>
                          {pct}%
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Footer note */}
              <div style={{
                marginTop: 14, padding: "10px 14px", borderRadius: 8,
                background: `${COLORS.neonBlue}08`, border: `1px solid ${COLORS.neonBlue}15`,
                fontSize: 10, lineHeight: 1.6, color: COLORS.textSecondary, fontFamily: "'DM Sans', sans-serif",
              }}>
                Only verified receipts count towards visit totals &amp; progressive payouts. Payout is agreed upon and unique to each business as well as each user. Payout is based on the receipt subtotal before tax &amp; tip.
              </div>
            </div>
          </div>
        </div>
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
          illustration={tour.stepIndex >= 0 ? expTourIllustrations[tour.stepIndex] : undefined}
        />
      )}

      <style>{`
        ::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
