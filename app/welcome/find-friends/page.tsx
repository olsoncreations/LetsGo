"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

// ─── Types ───

interface MatchedUser {
  contactName: string;
  userId: string;
  userName: string;
  username: string | null;
  avatarUrl: string | null;
}

interface UnmatchedContact {
  contactName: string;
  email: string | null;
  phone: string | null;
}

// ─── Constants ───

const BG = "#0d0015";
const CARD_BG = "rgba(255,255,255,0.04)";
const CARD_BORDER = "rgba(255,255,255,0.08)";
const PINK = "#FF2D78";
const PINK_RGB = "255,45,120";
const GREEN = "#39FF14";
const GREEN_RGB = "57,255,20";
const BLUE = "#00bfff";
const TEXT = "#fff";
const TEXT_DIM = "rgba(255,255,255,0.5)";
const TEXT_MUTED = "rgba(255,255,255,0.25)";
const FONT = "'Outfit', system-ui, sans-serif";

// ─── Helpers ───

function getInitial(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

async function getToken(): Promise<string | null> {
  const { data } = await supabaseBrowser.auth.getSession();
  return data.session?.access_token ?? null;
}

async function apiFetch(url: string, token: string, opts?: RequestInit) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts?.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || res.statusText);
  }
  return res.json();
}

// ─── Mobile detection ───

function isMobile(): boolean {
  if (typeof window === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// ═══════════════════════════════════════════════════
// FIND FRIENDS PAGE — Post-signup onboarding step
// ═══════════════════════════════════════════════════

export default function FindFriendsPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Contact picker state
  const [contactPickerAvailable, setContactPickerAvailable] = useState(false);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);

  // Results state
  const [matched, setMatched] = useState<MatchedUser[]>([]);
  const [unmatched, setUnmatched] = useState<UnmatchedContact[]>([]);
  const [friendRequestsSent, setFriendRequestsSent] = useState<Set<string>>(new Set());
  const [sendingFriendReq, setSendingFriendReq] = useState<string | null>(null);

  // Invite state — selectedInvites uses a unique key per contact (email or phone)
  const [selectedInvites, setSelectedInvites] = useState<Set<string>>(new Set());
  const [sendingInvites, setSendingInvites] = useState(false);
  const [invitesSent, setInvitesSent] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ sent: number; skipped: number; texted: number } | null>(null);

  // Manual email entry (iOS fallback)
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualEmails, setManualEmails] = useState("");
  const [sendingManual, setSendingManual] = useState(false);

  // Share link
  const [linkCopied, setLinkCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Auth check
  useEffect(() => {
    (async () => {
      try {
        const t = await getToken();
        if (!t) {
          router.replace("/welcome");
          return;
        }
        setToken(t);
        setContactPickerAvailable(isMobile());
      } catch (err) {
        console.error("[find-friends] Auth check failed:", err);
        setError("Failed to verify your session. Please try signing in again.");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  // Cleanup copy timer on unmount
  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  // ─── Contact Picker ───

  const handleImportContacts = async () => {
    if (!token || importing) return;
    setImporting(true);

    setError(null);
    try {
      // Use the Contact Picker API
      const nav = navigator as Navigator & {
        contacts?: {
          select: (
            properties: string[],
            options?: { multiple?: boolean }
          ) => Promise<Array<{ name?: string[]; email?: string[]; tel?: string[] }>>;
        };
      };

      if (!nav.contacts) {
        setError("Your browser doesn't support importing contacts. Try opening this page in Chrome.");
        setImporting(false);
        return;
      }

      const contacts = await nav.contacts.select(["name", "email", "tel"], {
        multiple: true,
      });

      if (!contacts || contacts.length === 0) {
        setImporting(false);
        return;
      }

      // Format contacts for API
      const formatted = contacts.map((c) => ({
        name: c.name?.[0] || "Unknown",
        emails: c.email || [],
        phones: c.tel || [],
      }));

      // Send to import API for matching
      const result = await apiFetch("/api/contacts/import", token, {
        method: "POST",
        body: JSON.stringify({ contacts: formatted }),
      });

      setMatched(result.matched || []);
      setUnmatched(result.unmatched || []);
      setImported(true);

      // Pre-select all unmatched contacts with email or phone for invite
      const invitable = new Set<string>();
      for (const c of (result.unmatched || []) as UnmatchedContact[]) {
        const key = c.email || c.phone;
        if (key) invitable.add(key);
      }
      setSelectedInvites(invitable);
    } catch (err) {
      console.error("[find-friends] Import error:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      // Don't show error for user cancellation
      if (!message.includes("cancel") && !message.includes("abort")) {
        setError("Failed to import contacts. Please try again.");
      }
    }

    setImporting(false);
  };

  // ─── Friend Request ───

  const handleAddFriend = async (userId: string) => {
    if (!token || sendingFriendReq) return;
    setSendingFriendReq(userId);

    setError(null);
    try {
      await apiFetch("/api/friends", token, {
        method: "POST",
        body: JSON.stringify({ friendId: userId }),
      });
      setFriendRequestsSent((prev) => new Set([...prev, userId]));
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("Already friends") || message.includes("already pending")) {
        // Still mark as sent so the UI shows "Sent!" instead of error
        setFriendRequestsSent((prev) => new Set([...prev, userId]));
      } else {
        console.error("[find-friends] Friend request error:", err);
        setError("Failed to send friend request. Please try again.");
      }
    }

    setSendingFriendReq(null);
  };

  // ─── Send Invites ───

  /** Get a unique key for an unmatched contact */
  const contactKey = (c: UnmatchedContact): string => c.email || c.phone || c.contactName;

  const handleSendInvites = async () => {
    if (!token || sendingInvites || selectedInvites.size === 0) return;
    setSendingInvites(true);
    setError(null);

    const selected = unmatched.filter((c) => selectedInvites.has(contactKey(c)));

    // Split into phone contacts (SMS via Twilio) and email-only contacts
    const withPhone = selected.filter((c) => c.phone);
    const emailOnly = selected.filter((c) => !c.phone && c.email);

    let emailSent = 0;
    let emailSkipped = 0;
    let smsSent = 0;
    let smsFailed = 0;

    // Send email invites for contacts without phone numbers
    if (emailOnly.length > 0) {
      try {
        const inviteList = emailOnly.map((c) => ({ name: c.contactName, email: c.email! }));
        const result = await apiFetch("/api/contacts/invite", token, {
          method: "POST",
          body: JSON.stringify({ invites: inviteList }),
        });
        emailSent = result.sent || 0;
        emailSkipped = result.skipped || 0;
      } catch (err) {
        console.error("[find-friends] Email invite error:", err);
      }
    }

    // Send SMS invites via Twilio API (all at once, no manual tapping)
    if (withPhone.length > 0) {
      try {
        const smsInvites = withPhone.map((c) => ({ name: c.contactName, phone: c.phone! }));
        const result = await apiFetch("/api/contacts/invite-sms", token, {
          method: "POST",
          body: JSON.stringify({ invites: smsInvites }),
        });
        smsSent = result.sent || 0;
        smsFailed = result.failed || 0;
      } catch (err) {
        console.error("[find-friends] SMS invite error:", err);
        setError("Failed to send text invites. Please try again.");
      }
    }

    setInviteResult({
      sent: emailSent,
      skipped: emailSkipped + smsFailed,
      texted: smsSent,
    });
    setInvitesSent(true);
    setSendingInvites(false);
  };

  // ─── Manual Email Invite ───

  const handleManualInvite = async () => {
    if (!token || sendingManual) return;
    const emails = manualEmails
      .split(/[,\n;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e && e.includes("@"));

    if (emails.length === 0) return;
    setSendingManual(true);

    setError(null);
    try {
      const inviteList = emails.map((e) => ({ name: "", email: e }));
      const result = await apiFetch("/api/contacts/invite", token, {
        method: "POST",
        body: JSON.stringify({ invites: inviteList }),
      });

      setInviteResult(result);
      setInvitesSent(true);
      setManualEmails("");
    } catch (err) {
      console.error("[find-friends] Manual invite error:", err);
      setError("Failed to send invites. Please try again.");
    }

    setSendingManual(false);
  };

  // ─── Share Link ───

  const handleShareLink = async () => {
    const url = `${window.location.origin}/welcome`;
    const shareData = {
      title: "Join me on LetsGo!",
      text: "Discover restaurants, earn cash-back, and play games with friends. Join LetsGo!",
      url,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // User cancelled — fall through to clipboard
      }
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard?.writeText(url);
      setLinkCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Clipboard not available
    }
  };

  // ─── Toggle invite selection ───

  const toggleInvite = (key: string) => {
    setSelectedInvites((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAllInvites = () => {
    const all = new Set<string>();
    for (const c of unmatched) {
      const key = contactKey(c);
      if (key) all.add(key);
    }
    setSelectedInvites(all);
  };

  const deselectAllInvites = () => {
    setSelectedInvites(new Set());
  };

  // ─── Loading state ───

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: TEXT_DIM, fontFamily: FONT, fontSize: 14 }}>Loading...</div>
      </div>
    );
  }

  // ─── Styles ───

  const btnBase: React.CSSProperties = {
    fontFamily: FONT, fontSize: 14, fontWeight: 700, cursor: "pointer",
    borderRadius: 50, padding: "14px 32px", border: "none",
    transition: "all 0.3s ease", letterSpacing: "0.02em",
  };

  const btnPrimary: React.CSSProperties = {
    ...btnBase,
    background: PINK, color: TEXT,
    boxShadow: `0 0 20px rgba(${PINK_RGB}, 0.3)`,
  };

  const btnOutline: React.CSSProperties = {
    ...btnBase,
    background: "transparent", color: TEXT_DIM,
    border: `1px solid ${CARD_BORDER}`,
  };

  const btnGreen: React.CSSProperties = {
    ...btnBase, fontSize: 12, padding: "8px 16px",
    background: `rgba(${GREEN_RGB}, 0.15)`, color: GREEN,
    border: `1px solid rgba(${GREEN_RGB}, 0.3)`,
  };

  return (
    <div style={{
      minHeight: "100vh", background: `linear-gradient(135deg, ${BG} 0%, #1a0a2e 50%, #16082a 100%)`,
      fontFamily: FONT, color: TEXT, padding: "60px 24px 40px",
      display: "flex", flexDirection: "column", alignItems: "center",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap');
        @keyframes fadeIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { box-shadow: 0 0 20px rgba(${PINK_RGB}, 0.2); } 50% { box-shadow: 0 0 40px rgba(${PINK_RGB}, 0.4); } }
      `}</style>

      <div style={{ maxWidth: 480, width: "100%", animation: "fadeIn 0.6s ease both" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <Image src="/lg-logo.png" alt="LetsGo" width={180} height={54} style={{ margin: "0 auto 16px" }} priority />
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, letterSpacing: "-0.02em" }}>
            Find Your Friends
          </h1>
          <p style={{ fontSize: 14, color: TEXT_DIM, lineHeight: 1.6, maxWidth: 360, margin: "0 auto" }}>
            Connect with friends already on LetsGo, or invite your crew to join you.
          </p>
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div style={{
            background: "rgba(255,59,48,0.12)", border: "1px solid rgba(255,59,48,0.3)",
            borderRadius: 12, padding: "12px 16px", marginBottom: 20,
            display: "flex", alignItems: "center", gap: 10,
            animation: "fadeIn 0.3s ease both",
          }}>
            <span style={{ fontSize: 14, color: "#ff3b30", flex: 1, fontFamily: FONT, lineHeight: 1.5 }}>
              {error}
            </span>
            <button
              onClick={() => setError(null)}
              aria-label="Dismiss error"
              style={{
                background: "none", border: "none", color: "rgba(255,255,255,0.4)",
                fontSize: 18, cursor: "pointer", padding: 4, lineHeight: 1, flexShrink: 0,
              }}
            >
              &times;
            </button>
          </div>
        )}

        {/* ── Before import ── */}
        {!imported && !invitesSent && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "fadeIn 0.5s ease 0.2s both" }}>

            {/* Contact Picker button (Android/Chrome) */}
            {contactPickerAvailable && (
              <button
                onClick={handleImportContacts}
                disabled={importing}
                style={{
                  ...btnPrimary,
                  width: "100%",
                  opacity: importing ? 0.7 : 1,
                  animation: "pulse 2.5s ease-in-out infinite",
                }}
              >
                {importing ? "Importing..." : "Import Contacts"}
              </button>
            )}

            {/* Share invite link (always visible, primary on iOS) */}
            <button
              onClick={handleShareLink}
              style={{
                ...contactPickerAvailable ? btnOutline : btnPrimary,
                width: "100%",
                ...(!contactPickerAvailable ? { animation: "pulse 2.5s ease-in-out infinite" } : {}),
              }}
            >
              {linkCopied ? "Link Copied!" : "Share Invite Link"}
            </button>

            {/* Manual email entry */}
            <button
              onClick={() => setShowManualEntry(!showManualEntry)}
              style={{ ...btnOutline, width: "100%", fontSize: 13, padding: "12px 24px" }}
            >
              {showManualEntry ? "Hide Email Entry" : "Enter Emails Manually"}
            </button>

            {showManualEntry && (
              <div style={{ animation: "fadeIn 0.3s ease both" }}>
                <textarea
                  value={manualEmails}
                  onChange={(e) => setManualEmails(e.target.value)}
                  placeholder={"Enter email addresses\n(separated by commas or new lines)"}
                  rows={4}
                  style={{
                    width: "100%", fontFamily: FONT, fontSize: 13, color: TEXT,
                    background: CARD_BG, border: `1px solid ${CARD_BORDER}`,
                    borderRadius: 12, padding: "14px 16px", outline: "none",
                    resize: "vertical", lineHeight: 1.6,
                  }}
                />
                <button
                  onClick={handleManualInvite}
                  disabled={sendingManual || !manualEmails.trim()}
                  style={{
                    ...btnGreen, width: "100%", marginTop: 10,
                    opacity: sendingManual || !manualEmails.trim() ? 0.5 : 1,
                  }}
                >
                  {sendingManual ? "Sending..." : "Send Invites"}
                </button>
              </div>
            )}

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, margin: "8px 0" }}>
              <div style={{ flex: 1, height: 1, background: CARD_BORDER }} />
              <span style={{ fontSize: 11, color: TEXT_MUTED, letterSpacing: "0.1em", textTransform: "uppercase" }}>or</span>
              <div style={{ flex: 1, height: 1, background: CARD_BORDER }} />
            </div>

            {/* Skip */}
            <button
              onClick={() => router.push("/")}
              style={{
                background: "none", border: "none", color: TEXT_DIM,
                fontFamily: FONT, fontSize: 14, cursor: "pointer",
                padding: "12px", textAlign: "center",
              }}
            >
              Skip for now
            </button>
          </div>
        )}

        {/* ── After import — show matched + unmatched ── */}
        {imported && !invitesSent && (
          <div style={{ animation: "fadeIn 0.5s ease both" }}>

            {/* Matched users — already on LetsGo */}
            {matched.length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                  color: GREEN, marginBottom: 14, display: "flex", alignItems: "center", gap: 8,
                }}>
                  <span>&#x2705;</span> Already on LetsGo ({matched.length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {matched.map((user) => {
                    const sent = friendRequestsSent.has(user.userId);
                    return (
                      <div key={user.userId} style={{
                        display: "flex", alignItems: "center", gap: 12,
                        padding: "12px 16px", borderRadius: 12,
                        background: CARD_BG, border: `1px solid ${CARD_BORDER}`,
                      }}>
                        <div style={{
                          width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 14, fontWeight: 700, color: TEXT_DIM,
                          background: "rgba(255,255,255,0.06)", overflow: "hidden",
                          border: `2px solid rgba(${GREEN_RGB}, 0.3)`,
                        }}>
                          {user.avatarUrl
                            ? <img src={user.avatarUrl} alt={`${user.userName} profile photo`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : getInitial(user.userName)
                          }
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {user.userName}
                          </div>
                          {user.username && (
                            <div style={{ fontSize: 11, color: TEXT_DIM }}>@{user.username}</div>
                          )}
                          <div style={{ fontSize: 10, color: TEXT_MUTED }}>{user.contactName}</div>
                        </div>
                        <button
                          onClick={() => handleAddFriend(user.userId)}
                          disabled={sent || sendingFriendReq === user.userId}
                          aria-label={sent ? `Friend request sent to ${user.userName}` : `Add ${user.userName} as friend`}
                          style={{
                            ...btnGreen, flexShrink: 0,
                            opacity: sent ? 0.5 : 1,
                          }}
                        >
                          {sent ? "Sent!" : sendingFriendReq === user.userId ? "..." : "Add Friend"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Unmatched contacts — invite to LetsGo */}
            {unmatched.filter((c) => c.email || c.phone).length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                  color: PINK, marginBottom: 10, display: "flex", alignItems: "center", gap: 8,
                }}>
                  <span>&#x1F4E9;</span> Invite to LetsGo ({unmatched.filter((c) => c.email || c.phone).length})
                </div>
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  marginBottom: 12,
                }}>
                  <span style={{ fontSize: 12, color: TEXT_DIM }}>
                    {selectedInvites.size} selected
                  </span>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={selectAllInvites} aria-label="Select all contacts for invite" style={{
                      background: "none", border: "none", color: BLUE,
                      fontFamily: FONT, fontSize: 11, fontWeight: 600, cursor: "pointer",
                    }}>Select All</button>
                    <button onClick={deselectAllInvites} aria-label="Deselect all contacts" style={{
                      background: "none", border: "none", color: TEXT_MUTED,
                      fontFamily: FONT, fontSize: 11, fontWeight: 600, cursor: "pointer",
                    }}>Deselect All</button>
                  </div>
                </div>
                <div style={{
                  display: "flex", flexDirection: "column", gap: 6,
                  maxHeight: 300, overflowY: "auto",
                }}>
                  {unmatched.filter((c) => c.email || c.phone).map((contact, idx) => {
                    const key = contactKey(contact);
                    const isSelected = selectedInvites.has(key);
                    const viaPhone = !!contact.phone;
                    return (
                      <div
                        key={key + idx}
                        onClick={() => toggleInvite(key)}
                        style={{
                          display: "flex", alignItems: "center", gap: 12,
                          padding: "10px 14px", borderRadius: 10, cursor: "pointer",
                          background: isSelected ? `rgba(${PINK_RGB}, 0.06)` : CARD_BG,
                          border: `1px solid ${isSelected ? `rgba(${PINK_RGB}, 0.3)` : CARD_BORDER}`,
                          transition: "all 0.2s ease",
                        }}
                      >
                        <div style={{
                          width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          background: isSelected ? PINK : "transparent",
                          border: `2px solid ${isSelected ? PINK : "rgba(255,255,255,0.15)"}`,
                          transition: "all 0.2s ease",
                        }}>
                          {isSelected && (
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                              <path d="M3 8l4 4 6-7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {contact.contactName}
                          </div>
                          <div style={{ fontSize: 11, color: TEXT_DIM, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: 4 }}>
                            <span>{viaPhone ? "via text" : "via email"}</span>
                            <span style={{ color: TEXT_MUTED }}>{viaPhone ? contact.phone : contact.email}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Send invites button */}
                <button
                  onClick={handleSendInvites}
                  disabled={sendingInvites || selectedInvites.size === 0}
                  style={{
                    ...btnPrimary, width: "100%", marginTop: 16,
                    opacity: sendingInvites || selectedInvites.size === 0 ? 0.5 : 1,
                  }}
                >
                  {sendingInvites
                    ? "Sending..."
                    : `Send ${selectedInvites.size} Invite${selectedInvites.size !== 1 ? "s" : ""}`
                  }
                </button>
              </div>
            )}

            {/* No results at all */}
            {matched.length === 0 && unmatched.filter((c) => c.email || c.phone).length === 0 && (
              <div style={{ textAlign: "center", padding: "32px 0", color: TEXT_DIM, fontSize: 14 }}>
                No contacts with email or phone found. Share your invite link instead!
              </div>
            )}

            {/* Bottom actions */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
              <button onClick={handleShareLink} style={{ ...btnOutline, width: "100%" }}>
                {linkCopied ? "Link Copied!" : "Share Invite Link"}
              </button>
              <button
                onClick={() => router.push("/")}
                style={{
                  background: "none", border: "none", color: TEXT_DIM,
                  fontFamily: FONT, fontSize: 14, cursor: "pointer",
                  padding: "12px", textAlign: "center",
                }}
              >
                {matched.length > 0 || selectedInvites.size > 0 ? "Continue to LetsGo" : "Skip for now"}
              </button>
            </div>
          </div>
        )}

        {/* ── After invites sent — success screen ── */}
        {invitesSent && (
          <div style={{ textAlign: "center", animation: "fadeIn 0.5s ease both" }}>
            <div style={{ fontSize: 56, marginBottom: 20 }}>&#x1F389;</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>
              Invites Sent!
            </h2>
            {inviteResult && (
              <div style={{ fontSize: 14, color: TEXT_DIM, marginBottom: 8, lineHeight: 1.6 }}>
                {inviteResult.texted > 0 && (
                  <p style={{ margin: "0 0 4px" }}>
                    {inviteResult.texted} text invite{inviteResult.texted !== 1 ? "s" : ""} sent
                  </p>
                )}
                {inviteResult.sent > 0 && (
                  <p style={{ margin: "0 0 4px" }}>
                    {inviteResult.sent} email invite{inviteResult.sent !== 1 ? "s" : ""} sent
                  </p>
                )}
                {inviteResult.skipped > 0 && (
                  <p style={{ margin: 0, color: TEXT_MUTED }}>
                    {inviteResult.skipped} skipped
                  </p>
                )}
              </div>
            )}

            <p style={{ fontSize: 13, color: TEXT_MUTED, marginBottom: 32, lineHeight: 1.6 }}>
              {inviteResult && inviteResult.texted > 0 && inviteResult.sent > 0
                ? "Your friends will get a text or email with a link to join LetsGo."
                : inviteResult && inviteResult.texted > 0
                  ? "Your friends will get a text with a link to join LetsGo."
                  : "Your friends will get an email with a link to join LetsGo."
              }
              {matched.length > 0 && friendRequestsSent.size > 0 && (
                <><br />Friend requests sent to {friendRequestsSent.size} user{friendRequestsSent.size !== 1 ? "s" : ""} already on the app.</>
              )}
            </p>

            <button
              onClick={() => router.push("/")}
              style={{ ...btnPrimary, width: "100%" }}
            >
              LetsGo!
            </button>
          </div>
        )}
        {/* Legal footer */}
        <div style={{ textAlign: "center", marginTop: 40, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", justifyContent: "center", gap: 16, alignItems: "center" }}>
            <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: TEXT_DIM, textDecoration: "none", transition: "color 0.2s" }}>Terms of Service</a>
            <span style={{ fontSize: 10, color: TEXT_MUTED }}>{"\u00b7"}</span>
            <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: TEXT_DIM, textDecoration: "none", transition: "color 0.2s" }}>Privacy Policy</a>
          </div>
        </div>
      </div>
    </div>
  );
}
