"use client";

import { forwardRef } from "react";
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

// ── Panel ────────────────────────────────────────────

interface NotificationPanelProps {
  onClose: () => void;
  position?: { top: number; right: number };
}

const NotificationPanel = forwardRef<HTMLDivElement, NotificationPanelProps>(function NotificationPanel({ onClose, position }, ref) {
  const router = useRouter();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  const handleClick = async (notif: UserNotification) => {
    if (!notif.read) await markAsRead([notif.id]);
    const href = (notif.metadata?.href as string) || NOTIFICATION_HREFS[notif.type] || "/";
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
      </div>

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
          notifications.map((notif) => {
            const color = TYPE_COLORS[notif.type] || "#6b7280";
            const icon = TYPE_ICONS[notif.type] || "\u2022";

            return (
              <button
                key={notif.id}
                onClick={() => handleClick(notif)}
                style={{
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
                  transition: "background 0.15s",
                  borderLeft: notif.read ? "3px solid transparent" : `3px solid ${color}`,
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

                {/* Unread dot */}
                {!notif.read && (
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      background: "#FF2D78",
                      boxShadow: "0 0 8px rgba(255,45,120,0.4)",
                      flexShrink: 0,
                      marginTop: 6,
                    }}
                  />
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
});

export default NotificationPanel;
