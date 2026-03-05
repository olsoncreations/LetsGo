"use client";

import { useState, useEffect, useCallback } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_LABELS,
  type NotificationType,
  type UserNotificationPreference,
} from "@/lib/notificationTypes";

const NEON_PINK = "#FF2D78";
const NEON_GREEN = "#39FF14";

// Only optional (user-toggleable) types — derived from categories
const OPTIONAL_TYPES: NotificationType[] = Object.values(NOTIFICATION_CATEGORIES).flat();

// Default preference: all channels on
function defaultPref(type: NotificationType): UserNotificationPreference {
  return { notification_type: type, in_app: true, email: true, push: true };
}

export default function NotificationPreferences() {
  const [prefs, setPrefs] = useState<Map<string, UserNotificationPreference>>(new Map());
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch preferences
  const fetchPrefs = useCallback(async () => {
    const {
      data: { session },
    } = await supabaseBrowser.auth.getSession();
    if (!session?.access_token) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/notifications/preferences", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const json = await res.json();
        const map = new Map<string, UserNotificationPreference>();
        for (const p of json.preferences ?? []) {
          map.set(p.notification_type, p);
        }
        // Fill defaults for any missing optional types
        for (const type of OPTIONAL_TYPES) {
          if (!map.has(type)) map.set(type, defaultPref(type));
        }
        setPrefs(map);
      }
    } catch {
      // Use defaults
      const map = new Map<string, UserNotificationPreference>();
      for (const type of OPTIONAL_TYPES) map.set(type, defaultPref(type));
      setPrefs(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPrefs();
  }, [fetchPrefs]);

  // Toggle a preference
  const toggle = (type: NotificationType, channel: "in_app" | "email" | "push") => {
    setPrefs((prev) => {
      const next = new Map(prev);
      const current = next.get(type) || defaultPref(type);
      next.set(type, { ...current, [channel]: !current[channel] });
      return next;
    });
    setSaveMsg(null);
  };

  // Save
  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);

    const {
      data: { session },
    } = await supabaseBrowser.auth.getSession();
    if (!session?.access_token) {
      setSaving(false);
      setSaveMsg("Not signed in");
      return;
    }

    const preferences = Array.from(prefs.values()).map((p) => ({
      notification_type: p.notification_type,
      in_app: p.in_app,
      email: p.email,
      push: p.push,
    }));

    try {
      const res = await fetch("/api/notifications/preferences", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ preferences }),
      });

      if (res.ok) {
        setSaveMsg("Saved!");
      } else {
        const json = await res.json().catch(() => ({}));
        setSaveMsg(json.error || "Save failed");
      }
    } catch {
      setSaveMsg("Network error");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: "center", color: "rgba(255,255,255,0.15)", fontSize: 11 }}>
        Loading preferences...
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Channel headers */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 50px 50px 50px",
          gap: 4,
          padding: "0 0 8px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div />
        {(["in_app", "email", "push"] as const).map((ch) => (
          <div
            key={ch}
            style={{
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.2)",
              textAlign: "center",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {ch === "in_app" ? "In-App" : ch === "email" ? "Email" : "Push"}
          </div>
        ))}
      </div>

      {/* Categories */}
      {Object.entries(NOTIFICATION_CATEGORIES).map(([category, types]) => (
        <div key={category}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.35)",
              marginBottom: 10,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {category}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {types.map((type) => {
              const pref = prefs.get(type) || defaultPref(type);
              return (
                <div
                  key={type}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 50px 50px 50px",
                    gap: 4,
                    alignItems: "center",
                    padding: "8px 0",
                    borderBottom: "1px solid rgba(255,255,255,0.03)",
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      color: "rgba(255,255,255,0.5)",
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    {NOTIFICATION_LABELS[type]}
                  </span>
                  {(["in_app", "email", "push"] as const).map((channel) => (
                    <div key={channel} style={{ display: "flex", justifyContent: "center" }}>
                      <div
                        onClick={() => toggle(type, channel)}
                        style={{
                          width: 32,
                          height: 18,
                          borderRadius: 9,
                          background: pref[channel]
                            ? `rgba(57,255,20,0.2)`
                            : "rgba(255,255,255,0.06)",
                          position: "relative",
                          cursor: "pointer",
                          transition: "background 0.2s",
                        }}
                      >
                        <div
                          style={{
                            position: "absolute",
                            top: 2,
                            transition: "all 0.2s ease",
                            ...(pref[channel] ? { right: 2 } : { left: 2 }),
                            width: 14,
                            height: 14,
                            borderRadius: "50%",
                            background: pref[channel] ? NEON_GREEN : "rgba(255,255,255,0.25)",
                            boxShadow: pref[channel] ? `0 0 6px ${NEON_GREEN}60` : "none",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Save */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12 }}>
        {saveMsg && (
          <span
            style={{
              fontSize: 11,
              color: saveMsg === "Saved!" ? NEON_GREEN : NEON_PINK,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {saveMsg}
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: "8px 20px",
            borderRadius: 3,
            border: `1px solid rgba(255,45,120,0.4)`,
            background: `rgba(255,45,120,0.1)`,
            color: NEON_PINK,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif",
            opacity: saving ? 0.5 : 1,
          }}
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
