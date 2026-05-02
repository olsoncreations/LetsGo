"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

interface Friend {
  id: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  status: "online" | "away" | "offline";
}

/**
 * Modal that lists the current user's accepted friends with checkboxes, lets
 * them pick recipients, and POSTs to /api/businesses/share which fans out
 * push + email + in-app notifications. Falls back to native share / copy-link
 * via the optional onFallbackShare callback at the bottom.
 *
 * Designed to be reusable for any place that wants to share a business with a
 * friend (Discovery, preview, business profile, etc).
 */
export function FriendSharePicker({
  open,
  onClose,
  businessId,
  businessName,
  onFallbackShare,
}: {
  open: boolean;
  onClose: () => void;
  businessId: string;
  businessName: string;
  onFallbackShare?: () => void | Promise<void>;
}) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Fetch friends when opened
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setErr(null);
    setDoneMsg(null);
    setSelected(new Set());
    setSearch("");
    (async () => {
      try {
        const { data: { session } } = await supabaseBrowser.auth.getSession();
        const token = session?.access_token;
        if (!token) {
          setErr("Please sign in to share with friends");
          setLoading(false);
          return;
        }
        const res = await fetch("/api/friends", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          setErr("Couldn't load friends");
          setLoading(false);
          return;
        }
        const data = await res.json();
        setFriends(Array.isArray(data.friends) ? data.friends : []);
      } catch {
        setErr("Couldn't load friends");
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter(
      (f) => f.name.toLowerCase().includes(q) || (f.username || "").toLowerCase().includes(q)
    );
  }, [friends, search]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSend = async () => {
    if (sending || selected.size === 0) return;
    setSending(true);
    setErr(null);
    try {
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setErr("Session expired — please refresh");
        setSending(false);
        return;
      }
      const res = await fetch("/api/businesses/share", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ businessId, friendIds: Array.from(selected) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error || "Couldn't send. Try again.");
        setSending(false);
        return;
      }
      const sent = Number(data.sent ?? selected.size);
      setDoneMsg(sent === 1 ? "Sent to 1 friend" : `Sent to ${sent} friends`);
      setSending(false);
      setTimeout(() => onClose(), 1200);
    } catch {
      setErr("Couldn't send. Try again.");
      setSending(false);
    }
  };

  // Discovery's swipe carousel renders its slides inside a translateX
  // transform, which pins position:fixed children to the carousel rather
  // than the viewport. Portal to <body> so the modal anchors to the actual
  // viewport regardless of where it's rendered in the tree. The
  // typeof-document guard handles SSR — `open` is false on both server
  // and client at first render, so there's no hydration mismatch.
  if (!open || typeof document === "undefined") return null;

  const overlay = (
    <div
      onClick={onClose}
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
        // would otherwise block the search input from getting focus. Stop
        // pointer/touch events here so they never reach the carousel.
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 520, maxHeight: "85vh",
          background: "#0f0f1a", border: "1px solid #2d2d44",
          borderRadius: "16px 16px 0 0",
          display: "flex", flexDirection: "column",
          boxShadow: "0 -10px 40px rgba(255,45,146,0.15)",
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
              Share with friends
            </div>
            <div style={{ fontSize: 12, color: "#a0a0b0", marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>
              {businessName}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{
            width: 32, height: 32, borderRadius: 8, border: "1px solid #2d2d44",
            background: "transparent", color: "#a0a0b0", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
        </div>

        {/* Search */}
        {!loading && friends.length > 0 && (
          <div style={{ padding: "12px 20px 0" }}>
            <input
              type="text"
              placeholder="Search friends..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%", padding: "10px 14px", borderRadius: 8,
                border: "1px solid #2d2d44", background: "rgba(255,255,255,0.03)",
                color: "#fff", fontSize: 13, outline: "none", fontFamily: "'DM Sans', sans-serif",
              }}
            />
          </div>
        )}

        {/* List */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 8px" }}>
          {loading && (
            <div style={{ padding: 40, textAlign: "center", color: "#a0a0b0", fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>
              Loading friends...
            </div>
          )}
          {!loading && err && (
            <div style={{ padding: 20, color: "#ff3131", fontSize: 13, textAlign: "center", fontFamily: "'DM Sans', sans-serif" }}>
              {err}
            </div>
          )}
          {!loading && !err && friends.length === 0 && (
            <div style={{ padding: "32px 20px", textAlign: "center", color: "#a0a0b0", fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>
              No friends yet. Invite some from <span style={{ color: "#00d4ff" }}>Find Friends</span>, or share another way below.
            </div>
          )}
          {!loading && !err && filtered.length === 0 && friends.length > 0 && (
            <div style={{ padding: 20, color: "#a0a0b0", fontSize: 13, textAlign: "center", fontFamily: "'DM Sans', sans-serif" }}>
              No matches for &ldquo;{search}&rdquo;
            </div>
          )}
          {!loading && filtered.map((f) => {
            const isSelected = selected.has(f.id);
            return (
              <button
                key={f.id}
                onClick={() => toggle(f.id)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 12px", borderRadius: 10, marginBottom: 2,
                  border: `1px solid ${isSelected ? "#ff2d92" : "transparent"}`,
                  background: isSelected ? "rgba(255,45,146,0.08)" : "transparent",
                  cursor: "pointer", transition: "all 0.15s",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: f.avatarUrl ? `url(${f.avatarUrl}) center/cover` : "linear-gradient(135deg, #ff2d92, #00d4ff)",
                  flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontWeight: 700, fontSize: 14,
                }}>
                  {!f.avatarUrl && f.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {f.name}
                  </div>
                  {f.username && (
                    <div style={{ fontSize: 11, color: "#a0a0b0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      @{f.username}
                    </div>
                  )}
                </div>
                <div style={{
                  width: 22, height: 22, borderRadius: 6,
                  border: `2px solid ${isSelected ? "#ff2d92" : "#2d2d44"}`,
                  background: isSelected ? "#ff2d92" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  {isSelected && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{
          padding: "14px 20px 18px",
          borderTop: "1px solid #2d2d44",
          background: "#0a0a14",
        }}>
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
              onClick={handleSend}
              disabled={sending || selected.size === 0}
              style={{
                width: "100%", padding: "14px 20px", borderRadius: 10, border: "none",
                background: selected.size === 0 ? "#2d2d44" : "linear-gradient(135deg, #ff2d92, #ff6b35)",
                color: "#fff", fontSize: 14, fontWeight: 700,
                cursor: selected.size === 0 || sending ? "not-allowed" : "pointer",
                opacity: sending ? 0.7 : 1,
                fontFamily: "'DM Sans', sans-serif",
                transition: "all 0.2s",
              }}
            >
              {sending
                ? "Sending..."
                : selected.size === 0
                  ? "Pick at least one friend"
                  : `Send to ${selected.size} ${selected.size === 1 ? "friend" : "friends"}`}
            </button>
          )}
          {onFallbackShare && (
            <button
              onClick={async () => {
                await onFallbackShare();
                onClose();
              }}
              style={{
                width: "100%", padding: "10px 0", borderRadius: 10, marginTop: 8,
                background: "transparent", border: "1px solid #2d2d44",
                color: "#a0a0b0", fontSize: 13, fontWeight: 600, cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Or share another way
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
