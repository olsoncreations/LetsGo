"use client";

import { forwardRef, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useNotifications } from "./NotificationProvider";
import { NOTIFICATION_HREFS, type UserNotification } from "@/lib/notificationTypes";

// ── Relative time helper ─────────────────────────────

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Type icon colors ─────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  receipt_approved: "#16a34a",
  receipt_rejected: "#dc2626",
  payout_processed: "#16a34a",
  tier_level_up: "#d946ef",
  new_message: "#0ea5e9",
  friend_request: "#a855f7",
  friend_accepted: "#a855f7",
  game_invite: "#eab308",
  game_advanced: "#eab308",
  game_complete: "#16a34a",
  group_round_ended: "#f97316",
  datenight_ready: "#ec4899",
  new_event: "#c026d3",
  media_approved: "#f97316",
  media_rejected: "#f97316",
  receipt_submitted: "#14b8a6",
};

const TYPE_ICONS: Record<string, string> = {
  receipt_approved: "\u2713",    // checkmark
  receipt_rejected: "\u2717",    // x mark
  payout_processed: "$",
  tier_level_up: "\u2191",       // up arrow
  new_message: "\u2709",         // envelope
  friend_request: "\u263A",      // smiley
  friend_accepted: "\u2764",     // heart
  game_invite: "\u265F",         // chess pawn
  game_advanced: "\u25B6",       // play
  game_complete: "\u2605",       // star
  group_round_ended: "\u25CF",   // circle
  datenight_ready: "\u2665",     // heart suit
  new_event: "\u2606",           // star outline
  media_approved: "\u2713",      // checkmark
  media_rejected: "\u2717",      // x mark
  receipt_submitted: "\u2709",   // envelope
};

// ── Swipe threshold (px) ─────────────────────────────

const SWIPE_THRESHOLD = 80;
const DELETE_FULL_SWIPE = 160;

// ── Swipeable notification item ──────────────────────

interface SwipeableNotifProps {
  notif: UserNotification;
  onDelete: (id: string) => void;
  onClick: (notif: UserNotification) => void;
}

function SwipeableNotifItem({ notif, onDelete, onClick }: SwipeableNotifProps) {
  const [translateX, setTranslateX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isHorizontalSwipe = useRef<boolean | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isHorizontalSwipe.current = null;
    setSwiping(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swiping) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;

    // Determine direction on first significant move
    if (isHorizontalSwipe.current === null) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        isHorizontalSwipe.current = Math.abs(dx) > Math.abs(dy);
      }
      return;
    }

    if (!isHorizontalSwipe.current) return;

    // Only allow left swipe (negative dx)
    const clampedDx = Math.min(0, dx);
    setTranslateX(clampedDx);
  }, [swiping]);

  const handleTouchEnd = useCallback(() => {
    setSwiping(false);
    isHorizontalSwipe.current = null;

    if (translateX < -DELETE_FULL_SWIPE) {
      // Full swipe — animate out and delete
      setDismissed(true);
      setTimeout(() => onDelete(notif.id), 300);
    } else if (translateX < -SWIPE_THRESHOLD) {
      // Partial swipe — snap to reveal delete button
      setTranslateX(-SWIPE_THRESHOLD);
    } else {
      // Snap back
      setTranslateX(0);
    }
  }, [translateX, notif.id, onDelete]);

  const handleDeleteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissed(true);
    setTimeout(() => onDelete(notif.id), 300);
  }, [notif.id, onDelete]);

  const color = TYPE_COLORS[notif.type] || "#6b7280";
  const icon = TYPE_ICONS[notif.type] || "\u2022";

  return (
    <div
      ref={rowRef}
      style={{
        position: "relative",
        overflow: "hidden",
        maxHeight: dismissed ? 0 : 200,
        opacity: dismissed ? 0 : 1,
        transition: dismissed
          ? "max-height 0.3s ease, opacity 0.3s ease"
          : undefined,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Delete backdrop (revealed on swipe) */}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 1,
          width: SWIPE_THRESHOLD,
          background: "#dc2626",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.05em",
          fontFamily: "'DM Sans', sans-serif",
          cursor: "pointer",
          userSelect: "none",
        }}
        onClick={handleDeleteClick}
      >
        DELETE
      </div>

      {/* Foreground notification row */}
      <button
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => {
          // Only navigate if not swiped open
          if (Math.abs(translateX) < 10) {
            onClick(notif);
          } else {
            setTranslateX(0);
          }
        }}
        style={{
          position: "relative",
          width: "100%",
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          padding: "13px 18px",
          border: "none",
          borderBottom: "1px solid #f5f5f5",
          background: notif.read ? "#ffffff" : "#fdf2f8",
          cursor: "pointer",
          textAlign: "left",
          transition: swiping ? "none" : "transform 0.25s ease",
          transform: `translateX(${translateX}px)`,
          borderLeft: notif.read ? "3px solid transparent" : `3px solid ${color}`,
          zIndex: 1,
        }}
      >
        {/* Type icon */}
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            flexShrink: 0,
            background: `${color}15`,
            border: `1px solid ${color}30`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            color: color,
            fontWeight: 700,
          }}
        >
          {icon}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: notif.read ? 500 : 700,
              color: notif.read ? "#6b7280" : "#1a1a2e",
              fontFamily: "'DM Sans', sans-serif",
              lineHeight: 1.35,
              marginBottom: 2,
            }}
          >
            {notif.title}
          </div>
          <div
            style={{
              fontSize: 12,
              color: notif.read ? "#9ca3af" : "#6b7280",
              fontFamily: "'DM Sans', sans-serif",
              lineHeight: 1.4,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap" as const,
            }}
          >
            {notif.body}
          </div>
          <div
            style={{
              fontSize: 10,
              color: "#b0b0b0",
              fontFamily: "'DM Sans', sans-serif",
              marginTop: 4,
            }}
          >
            {timeAgo(notif.created_at)}
          </div>
        </div>

        {/* Unread dot / Desktop X button */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, marginTop: 4 }}>
          {!notif.read && (
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                background: "#FF2D78",
                boxShadow: "0 0 8px rgba(255,45,120,0.4)",
              }}
            />
          )}
          {/* Desktop hover X button */}
          <div
            onClick={handleDeleteClick}
            role="button"
            tabIndex={-1}
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              color: "#b0b0b0",
              background: hovered ? "#f3f4f6" : "transparent",
              cursor: "pointer",
              opacity: hovered ? 1 : 0,
              transition: "opacity 0.15s, background 0.15s",
              lineHeight: 1,
            }}
            title="Delete notification"
          >
            ×
          </div>
        </div>
      </button>
    </div>
  );
}

// ── Panel ────────────────────────────────────────────

interface NotificationPanelProps {
  onClose: () => void;
  position?: { top: number; right: number };
}

const NotificationPanel = forwardRef<HTMLDivElement, NotificationPanelProps>(function NotificationPanel({ onClose, position }, ref) {
  const router = useRouter();
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, clearAllNotifications } = useNotifications();

  const handleClick = async (notif: UserNotification) => {
    if (!notif.read) await markAsRead([notif.id]);
    let href = (notif.metadata?.href as string) || NOTIFICATION_HREFS[notif.type] || "/";
    const gameCode = notif.metadata?.gameCode as string | undefined;
    if (notif.type === "game_complete" && gameCode) {
      href = `/5v3v1?code=${gameCode}`;
    }
    router.push(href);
    onClose();
  };

  const isMobile = typeof window !== "undefined" && window.innerWidth <= 640;

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        top: position?.top ?? 50,
        ...(isMobile
          ? { left: 12, right: 12, width: "auto" }
          : { right: position?.right ?? 16, width: 360 }),
        maxWidth: "calc(100vw - 24px)",
        maxHeight: 460,
        background: "#ffffff",
        borderRadius: 14,
        boxShadow: "0 25px 60px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.06), 0 0 30px rgba(255,45,120,0.08)",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Neon top accent bar */}
      <div style={{
        height: 3,
        background: "linear-gradient(90deg, #FF2D78, #FF6B35, #FFD600, #39FF14, #00D4FF, #BF5FFF, #FF2D78)",
        flexShrink: 0,
      }} />

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 18px 12px",
          borderBottom: "1px solid #f0f0f0",
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase" as const,
            color: "#1a1a2e",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          Notifications
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllAsRead()}
              style={{
                padding: "5px 12px",
                borderRadius: 20,
                border: "1px solid rgba(255,45,120,0.25)",
                background: "rgba(255,45,120,0.06)",
                color: "#FF2D78",
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase" as const,
                cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Mark all read
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={() => clearAllNotifications()}
              style={{
                padding: "5px 12px",
                borderRadius: 20,
                border: "1px solid rgba(220,38,38,0.25)",
                background: "rgba(220,38,38,0.06)",
                color: "#dc2626",
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase" as const,
                cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Swipe hint (mobile only, shown briefly) */}
      {isMobile && notifications.length > 0 && (
        <div
          style={{
            padding: "6px 18px",
            fontSize: 10,
            color: "#b0b0b0",
            fontFamily: "'DM Sans', sans-serif",
            textAlign: "center",
            borderBottom: "1px solid #f5f5f5",
          }}
        >
          Swipe left to delete
        </div>
      )}

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        {notifications.length === 0 ? (
          <div
            style={{
              padding: "44px 20px",
              textAlign: "center",
              color: "#b0b0b0",
              fontSize: 13,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            No notifications yet
          </div>
        ) : (
          notifications.map((notif) => (
            <SwipeableNotifItem
              key={notif.id}
              notif={notif}
              onDelete={deleteNotification}
              onClick={handleClick}
            />
          ))
        )}
      </div>
    </div>
  );
});

export default NotificationPanel;
