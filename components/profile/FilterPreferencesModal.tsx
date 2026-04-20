"use client";

import { useState, useEffect } from "react";
import { fetchTagsByCategory, type TagCategory } from "@/lib/availableTags";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

const COLORS = {
  darkBg: "#0a0a14",
  cardBg: "#12121f",
  cardBorder: "#1e1e33",
  glass: "rgba(18,18,31,0.85)",
  textPrimary: "#ffffff",
  textSecondary: "#8888aa",
  neonYellow: "#FFD600",
  neonYellowRGB: "255,214,0",
  neonGreen: "#00FF87",
  neonBlue: "#00E5FF",
  neonPink: "#FF2D78",
};

const DEFAULT_CATEGORIES = ["All", "Restaurant", "Bar", "Coffee", "Entertainment", "Activity", "Nightclub", "Brewery", "Winery", "Food Truck", "Bakery", "Deli", "Ice Cream", "Juice Bar", "Lounge", "Pub", "Sports Bar", "Karaoke", "Arcade", "Bowling", "Mini Golf", "Escape Room", "Theater", "Comedy Club", "Art Gallery", "Museum", "Spa", "Gym", "Yoga Studio", "Dance Studio"];
const PRICE_OPTIONS = ["Any", "$", "$$", "$$$", "$$$$"];

interface FilterPrefs {
  categories: string[];
  price: string;
  distance: number;
  openNow: boolean;
  tags: string[];
}

export default function FilterPreferencesModal({ open, onClose, token }: {
  open: boolean;
  onClose: () => void;
  token: string | null;
}) {
  const [prefs, setPrefs] = useState<FilterPrefs>({
    categories: [], price: "Any", distance: 15, openNow: false, tags: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tagCats, setTagCats] = useState<TagCategory[]>([]);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [userZip, setUserZip] = useState<string | null>(null);

  // Load tag categories
  useEffect(() => {
    fetchTagsByCategory("business").then(setTagCats).catch(() => {});
  }, []);

  // Load saved preferences + user zip
  useEffect(() => {
    if (!open || !token) return;
    setLoading(true);
    setSaved(false);

    Promise.all([
      fetch("/api/users/filter-preferences", {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json()),
      supabaseBrowser.auth.getUser().then(({ data: { user } }) => {
        if (!user) return null;
        return supabaseBrowser.from("profiles").select("zip_code").eq("id", user.id).maybeSingle();
      }),
    ])
      .then(([prefsData, profileRes]) => {
        if (prefsData?.preferences) {
          setPrefs({
            categories: prefsData.preferences.categories || [],
            price: prefsData.preferences.price || "Any",
            distance: prefsData.preferences.distance || 15,
            openNow: prefsData.preferences.openNow || false,
            tags: prefsData.preferences.tags || [],
          });
        }
        if (profileRes?.data?.zip_code) {
          setUserZip(profileRes.data.zip_code);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, token]);

  async function handleSave() {
    if (!token) return;
    setSaving(true);
    try {
      const res = await fetch("/api/users/filter-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ preferences: prefs }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => onClose(), 800);
      }
    } catch { /* silent */ }
    finally { setSaving(false); }
  }

  function toggleSection(name: string) {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function toggleCategory(cat: string) {
    if (cat === "All") {
      setPrefs(p => ({ ...p, categories: [] }));
    } else {
      setPrefs(p => {
        const cats = p.categories.filter(c => c !== "All");
        return { ...p, categories: cats.includes(cat) ? cats.filter(c => c !== cat) : [...cats, cat] };
      });
    }
  }

  function toggleTag(tag: string) {
    setPrefs(p => ({
      ...p,
      tags: p.tags.includes(tag) ? p.tags.filter(t => t !== tag) : [...p.tags, tag],
    }));
  }

  const selectedCatIsFood = prefs.categories.length === 0 || prefs.categories.some(c =>
    ["Restaurant", "Bar", "Coffee", "Bakery", "Deli", "Ice Cream", "Juice Bar", "Food Truck", "Brewery", "Winery", "Pub", "Sports Bar", "Lounge", "Nightclub", "Karaoke"].includes(c)
  );

  if (!open) return null;

  const pillStyle = (active: boolean) => ({
    padding: "7px 16px", borderRadius: 50, border: `1px solid ${active ? COLORS.neonYellow : COLORS.cardBorder}`,
    background: active ? `${COLORS.neonYellow}22` : COLORS.glass,
    color: active ? COLORS.neonYellow : COLORS.textSecondary,
    fontSize: 12, fontWeight: 600 as const, cursor: "pointer" as const, transition: "all 0.25s ease",
    whiteSpace: "nowrap" as const, fontFamily: "'DM Sans', sans-serif",
  });

  const sectionHeader = (label: string, count: number) => (
    <button
      onClick={() => toggleSection(label)}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
        fontSize: 11, fontWeight: 700, color: COLORS.textSecondary, textTransform: "uppercase" as const,
        letterSpacing: 1.5, fontFamily: "'DM Sans', sans-serif", background: "none", border: "none",
        cursor: "pointer", padding: "8px 0", marginBottom: collapsedSections.has(label) ? 0 : 10,
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {label}
        {count > 0 && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 50, background: `${COLORS.neonYellow}25`, color: COLORS.neonYellow, minWidth: 18, textAlign: "center" as const }}>{count}</span>
        )}
      </span>
      <span style={{ fontSize: 14, color: COLORS.textSecondary, transition: "transform 0.2s", transform: collapsedSections.has(label) ? "rotate(0deg)" : "rotate(180deg)" }}>▼</span>
    </button>
  );

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        width: "100%", maxWidth: 520, maxHeight: "85vh", overflowY: "auto",
        background: COLORS.darkBg, borderRadius: 16, border: `1px solid ${COLORS.cardBorder}`,
        padding: "28px 24px", margin: "0 16px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: COLORS.neonYellow, margin: 0, fontFamily: "'DM Sans', sans-serif" }}>
            Filter Preferences
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: COLORS.textSecondary, fontSize: 22, cursor: "pointer", padding: 4 }}>×</button>
        </div>
        <p style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 20, lineHeight: 1.5, fontFamily: "'DM Sans', sans-serif" }}>
          Set your default filters for the discovery feed, 5v3v1, and group vote. These will be pre-applied every time you open those pages.
        </p>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary }}>Loading...</div>
        ) : (
          <>
            {/* Price — always visible */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10, fontFamily: "'DM Sans', sans-serif" }}>Price</div>
              <div style={{ display: "flex", gap: 8 }}>
                {PRICE_OPTIONS.map(p => (
                  <button key={p} onClick={() => setPrefs(prev => ({ ...prev, price: p }))} style={pillStyle(prefs.price === p)}>{p}</button>
                ))}
              </div>
            </div>

            {/* Distance — always visible */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 1.5, fontFamily: "'DM Sans', sans-serif" }}>Distance</span>
                  {userZip && (
                    <span style={{
                      fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Sans', sans-serif",
                      padding: "2px 8px", borderRadius: 4, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                    }}>from {userZip}</span>
                  )}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.neonBlue, fontFamily: "'DM Sans', sans-serif" }}>{prefs.distance} mi</span>
              </div>
              <input type="range" min={1} max={50} value={prefs.distance} onChange={e => setPrefs(p => ({ ...p, distance: +e.target.value }))}
                style={{ width: "100%", accentColor: COLORS.neonBlue, height: 4 }} />
            </div>

            {/* Open Now — always visible */}
            <div style={{ marginBottom: 16 }}>
              <button onClick={() => setPrefs(p => ({ ...p, openNow: !p.openNow }))} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 50,
                border: `1px solid ${prefs.openNow ? COLORS.neonGreen : COLORS.cardBorder}`,
                background: prefs.openNow ? `${COLORS.neonGreen}15` : COLORS.glass,
                color: prefs.openNow ? COLORS.neonGreen : COLORS.textSecondary,
                fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
              }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: prefs.openNow ? COLORS.neonGreen : COLORS.textSecondary, boxShadow: prefs.openNow ? `0 0 8px ${COLORS.neonGreen}` : "none" }} />
                Open Now
              </button>
            </div>

            {/* Category — collapsible */}
            <div style={{ marginTop: 8 }}>
              {sectionHeader("Category", prefs.categories.length)}
              {!collapsedSections.has("Category") && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {DEFAULT_CATEGORIES.map(cat => (
                    <button key={cat} onClick={() => toggleCategory(cat)} style={pillStyle(
                      cat === "All" ? prefs.categories.length === 0 : prefs.categories.includes(cat)
                    )}>{cat}</button>
                  ))}
                </div>
              )}
            </div>

            {/* Dynamic tag sections — collapsible */}
            {tagCats
              .filter(c => c.name !== "Business Type" && c.scope.includes("business"))
              .filter(c => !c.requires_food || selectedCatIsFood)
              .map(c => {
                const catTags = c.tags.map(t => t.name);
                const activeCount = catTags.filter(t => prefs.tags.includes(t)).length;
                const label = `${c.icon} ${c.name}`;
                return (
                  <div key={c.id} style={{ marginTop: 8 }}>
                    {sectionHeader(label, activeCount)}
                    {!collapsedSections.has(label) && (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {catTags.map(t => (
                          <button key={t} onClick={() => toggleTag(t)} style={pillStyle(prefs.tags.includes(t))}>{t}</button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

            {/* Save / Clear */}
            <div style={{ display: "flex", gap: 12, marginTop: 24, paddingTop: 16, borderTop: `1px solid ${COLORS.cardBorder}` }}>
              <button onClick={() => setPrefs({ categories: [], price: "Any", distance: 15, openNow: false, tags: [] })} style={{
                flex: 1, padding: "12px 0", borderRadius: 8, fontSize: 13, fontWeight: 700,
                border: `1px solid ${COLORS.cardBorder}`, background: "transparent",
                color: COLORS.textSecondary, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
              }}>Clear All</button>
              <button onClick={handleSave} disabled={saving} style={{
                flex: 2, padding: "12px 0", borderRadius: 8, fontSize: 13, fontWeight: 700,
                border: "none", background: saved ? COLORS.neonGreen : COLORS.neonYellow,
                color: "#000", cursor: saving ? "wait" : "pointer", fontFamily: "'DM Sans', sans-serif",
                opacity: saving ? 0.6 : 1,
              }}>{saved ? "Saved!" : saving ? "Saving..." : "Save Preferences"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
