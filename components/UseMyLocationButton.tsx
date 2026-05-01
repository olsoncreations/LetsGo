"use client";

import { useState } from "react";
import { ZIP_COORDS } from "@/lib/zipUtils";

/**
 * Real "Use My Location" button. Calls navigator.geolocation, then reverse-
 * geocodes via Google Maps to recover the city/state/zip for the label and
 * for zip-based filtering on pages that key off `userZip`.
 *
 * Requires the Google Maps JS script to be loaded on the host page (already
 * loaded on Discovery / 5v3v1 / group / events). Falls back gracefully if
 * the geocoder isn't available — coords still propagate via onLocate.
 *
 * onLocate fires once per click with whatever fields we could resolve. zip /
 * city / state may be empty strings if the geocode returned no match.
 */
export function UseMyLocationButton({
  onLocate,
  color = "#00d4ff",
  rgb = "0, 212, 255",
  compact = false,
}: {
  onLocate: (data: { lat: number; lng: number; zip: string; city: string; state: string }) => void;
  color?: string;
  rgb?: string;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleClick = () => {
    if (busy) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setErr("Geolocation not supported");
      return;
    }
    setErr(null);
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        reverseGeocode(lat, lng)
          .then((info) => {
            if (info.zip) ZIP_COORDS[info.zip] = [lat, lng];
            onLocate({ lat, lng, zip: info.zip, city: info.city, state: info.state });
          })
          .finally(() => setBusy(false));
      },
      (e) => {
        setBusy(false);
        setErr(e.code === e.PERMISSION_DENIED ? "Location permission denied" : "Could not get location");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  };

  const padding = compact ? "8px 14px" : "10px 16px";
  const fontSize = compact ? 11 : 12;

  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <button
        onClick={handleClick}
        disabled={busy}
        style={{
          display: "flex", alignItems: "center", gap: 6, padding, borderRadius: 50,
          border: `1px solid rgba(${rgb}, ${busy ? 0.18 : 0.3})`,
          background: `rgba(${rgb}, ${busy ? 0.04 : 0.08})`,
          color, fontSize, fontWeight: 600, cursor: busy ? "wait" : "pointer",
          fontFamily: "'DM Sans', sans-serif", transition: "all 0.3s",
          opacity: busy ? 0.7 : 1,
        }}
        title="Use my current location"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v4m0 12v4m10-10h-4M6 12H2" />
        </svg>
        {busy ? "Locating..." : "Use My Location"}
      </button>
      {err && (
        <div style={{
          position: "absolute", top: "100%", left: 0, marginTop: 6,
          padding: "6px 10px", borderRadius: 6, background: "rgba(255,49,49,0.15)",
          border: "1px solid rgba(255,49,49,0.4)", color: "#ff3131",
          fontSize: 11, fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap",
          zIndex: 10,
        }}>
          {err}
        </div>
      )}
    </div>
  );
}

type AddressComp = { long_name: string; short_name: string; types: string[] };
type GeocoderResult = { address_components?: AddressComp[] };
type GeocoderClass = new () => {
  geocode: (req: Record<string, unknown>, cb: (results: GeocoderResult[] | null, status: string) => void) => void;
};

async function reverseGeocode(lat: number, lng: number): Promise<{ zip: string; city: string; state: string }> {
  const empty = { zip: "", city: "", state: "" };
  if (typeof window === "undefined") return empty;
  const g = (window as unknown as { google?: { maps?: { Geocoder?: GeocoderClass } } }).google;
  if (!g?.maps?.Geocoder) return empty;
  return new Promise((resolve) => {
    const geocoder = new g.maps!.Geocoder!();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status !== "OK" || !results || !results[0]) return resolve(empty);
      let zip = "";
      let city = "";
      let state = "";
      // Walk every component across every result so we have the best chance of
      // pulling all three fields — Google sometimes splits postal_code into a
      // separate result on the response array.
      for (const r of results) {
        for (const c of r.address_components ?? []) {
          if (!zip && c.types.includes("postal_code")) zip = c.long_name;
          if (!city && c.types.includes("locality")) city = c.long_name;
          if (!city && c.types.includes("sublocality")) city = c.long_name;
          if (!city && c.types.includes("postal_town")) city = c.long_name;
          if (!state && c.types.includes("administrative_area_level_1")) state = c.short_name;
        }
        if (zip && city && state) break;
      }
      resolve({ zip, city, state });
    });
  });
}
