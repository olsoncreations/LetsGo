"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import type { BusinessTabProps } from "@/components/business/v2/BusinessProfileV2";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { MapPin, Save, RotateCcw, AlertTriangle } from "lucide-react";

// ── Types ──
interface LocationData {
  latitude: number | null;
  longitude: number | null;
  street_address: string;
  city: string;
  state: string;
  zip: string;
}

// ── Styles ──
const TEAL = "#14b8a6";
const DARK_BG = "#0c1220";
const CARD_BG = "#111827";
const CARD_BORDER = "#1e293b";
const TEXT_PRIMARY = "#f1f5f9";
const TEXT_SECONDARY = "#94a3b8";
const RED = "#ef4444";

export default function Location({ businessId }: BusinessTabProps) {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [editLat, setEditLat] = useState("");
  const [editLng, setEditLng] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);

  // ── Fetch current location ──
  useEffect(() => {
    (async () => {
      const { data, error: err } = await supabaseBrowser
        .from("business")
        .select("latitude, longitude, street_address, city, state, zip")
        .eq("id", businessId)
        .maybeSingle();
      if (err || !data) {
        setError("Failed to load location data");
        setLoading(false);
        return;
      }
      setLocation(data as LocationData);
      setEditLat(data.latitude != null ? String(data.latitude) : "");
      setEditLng(data.longitude != null ? String(data.longitude) : "");
      setLoading(false);
    })();
  }, [businessId]);

  // ── Load Google Maps script ──
  useEffect(() => {
    if (loading) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).google?.maps) { setMapReady(true); return; }

    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key) return;

    // Check if script is already being loaded
    if (document.querySelector('script[src*="maps.googleapis.com"]')) {
      const check = setInterval(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((window as any).google?.maps) { setMapReady(true); clearInterval(check); }
      }, 200);
      return () => clearInterval(check);
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places`;
    script.async = true;
    script.onload = () => setMapReady(true);
    document.head.appendChild(script);
  }, [loading]);

  // ── Initialize Google Map ──
  useEffect(() => {
    if (!mapReady || !location || !mapRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const google = (window as any).google;
    if (!google?.maps) return;

    const lat = parseFloat(editLat) || location.latitude || 41.2565;
    const lng = parseFloat(editLng) || location.longitude || -95.9345;

    const map = new google.maps.Map(mapRef.current, {
      center: { lat, lng },
      zoom: 16,
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: true,
      fullscreenControl: true,
    });

    mapInstanceRef.current = map;

    // Create draggable marker
    const marker = new google.maps.Marker({
      map,
      position: { lat, lng },
      draggable: true,
      title: "Drag to your business location",
    });

    marker.addListener("dragend", () => {
      const pos = marker.getPosition();
      if (pos) {
        setEditLat(pos.lat().toFixed(6));
        setEditLng(pos.lng().toFixed(6));
        setHasChanges(true);
      }
    });

    markerRef.current = marker;

    // Also allow clicking on the map to move the pin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map.addListener("click", (e: any) => {
      if (e.latLng) {
        marker.setPosition(e.latLng);
        setEditLat(e.latLng.lat().toFixed(6));
        setEditLng(e.latLng.lng().toFixed(6));
        setHasChanges(true);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, location]);

  // ── Update marker when manual coords change ──
  const handleCoordsChange = useCallback((lat: string, lng: string) => {
    setEditLat(lat);
    setEditLng(lng);
    setHasChanges(true);

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    if (!isNaN(parsedLat) && !isNaN(parsedLng) && markerRef.current && mapInstanceRef.current) {
      const pos = { lat: parsedLat, lng: parsedLng };
      markerRef.current.setPosition(pos);
      mapInstanceRef.current.panTo(pos);
    }
  }, []);

  // ── Save ──
  const handleSave = useCallback(async () => {
    const lat = parseFloat(editLat);
    const lng = parseFloat(editLng);
    if (isNaN(lat) || isNaN(lng)) {
      setError("Please enter valid coordinates or drag the pin on the map.");
      return;
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setError("Coordinates are out of range.");
      return;
    }

    setSaving(true);
    setError("");

    const { error: updateErr } = await supabaseBrowser
      .from("business")
      .update({
        latitude: lat,
        longitude: lng,
        geocode_status: "approved_manual",
        geocode_reviewed_at: new Date().toISOString(),
      })
      .eq("id", businessId);

    if (updateErr) {
      setError(updateErr.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setSaved(true);
    setHasChanges(false);
    setTimeout(() => setSaved(false), 3000);
  }, [editLat, editLng, businessId]);

  // ── Reset to original ──
  const handleReset = useCallback(() => {
    if (!location) return;
    const lat = location.latitude != null ? String(location.latitude) : "";
    const lng = location.longitude != null ? String(location.longitude) : "";
    setEditLat(lat);
    setEditLng(lng);
    setHasChanges(false);

    if (markerRef.current && mapInstanceRef.current && location.latitude && location.longitude) {
      const pos = { lat: location.latitude, lng: location.longitude };
      markerRef.current.setPosition(pos);
      mapInstanceRef.current.panTo(pos);
    }
  }, [location]);

  if (loading) {
    return <div style={{ padding: 32, color: TEXT_SECONDARY }}>Loading location data...</div>;
  }

  const address = location
    ? [location.street_address, location.city, location.state, location.zip].filter(Boolean).join(", ")
    : "";

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <MapPin size={20} color={TEAL} />
          <h2 style={{ fontSize: 20, fontWeight: 700, color: TEXT_PRIMARY, margin: 0 }}>Business Location</h2>
        </div>
        <p style={{ fontSize: 13, color: TEXT_SECONDARY, margin: 0, lineHeight: 1.6 }}>
          Your exact location determines how you appear in distance-based filters.
          Drag the pin to your front door, or enter coordinates manually.
          This directly affects whether nearby customers find you.
        </p>
      </div>

      {/* Alert */}
      <div style={{
        background: `${TEAL}10`,
        border: `1px solid ${TEAL}30`,
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
      }}>
        <AlertTriangle size={18} color={TEAL} style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: 12, color: TEXT_SECONDARY, lineHeight: 1.6 }}>
          <strong style={{ color: TEXT_PRIMARY }}>Why this matters:</strong> Customers filter by distance (1–50 miles).
          If your pin is even a few blocks off, you might not show up in their results.
          Place it exactly where your business is located.
        </div>
      </div>

      {/* Address Display */}
      {address && (
        <div style={{
          background: CARD_BG,
          border: `1px solid ${CARD_BORDER}`,
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: TEXT_SECONDARY, letterSpacing: "0.08em", marginBottom: 6 }}>
            Address on file
          </div>
          <div style={{ fontSize: 14, color: TEXT_PRIMARY }}>{address}</div>
        </div>
      )}

      {/* Map */}
      <div style={{
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 12,
        overflow: "hidden",
        marginBottom: 16,
      }}>
        <div ref={mapRef} style={{ width: "100%", height: 400 }} />
        <div style={{ padding: "12px 16px", borderTop: `1px solid ${CARD_BORDER}`, fontSize: 11, color: TEXT_SECONDARY }}>
          Drag the pin or click anywhere on the map to set your exact location
        </div>
      </div>

      {/* Manual Coordinates */}
      <div style={{
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 12,
        padding: 20,
        marginBottom: 24,
      }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", color: TEXT_SECONDARY, letterSpacing: "0.08em", marginBottom: 12 }}>
          Coordinates
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, color: TEXT_SECONDARY, display: "block", marginBottom: 4 }}>Latitude</label>
            <input
              type="text"
              value={editLat}
              onChange={e => handleCoordsChange(e.target.value, editLng)}
              placeholder="41.209000"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: `1px solid ${CARD_BORDER}`,
                background: DARK_BG,
                color: TEXT_PRIMARY,
                fontSize: 14,
                fontFamily: "monospace",
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, color: TEXT_SECONDARY, display: "block", marginBottom: 4 }}>Longitude</label>
            <input
              type="text"
              value={editLng}
              onChange={e => handleCoordsChange(editLat, e.target.value)}
              placeholder="-96.054000"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: `1px solid ${CARD_BORDER}`,
                background: DARK_BG,
                color: TEXT_PRIMARY,
                fontSize: 14,
                fontFamily: "monospace",
              }}
            />
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ color: RED, fontSize: 13, marginBottom: 16, padding: "10px 16px", background: `${RED}15`, borderRadius: 8, border: `1px solid ${RED}30` }}>
          {error}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
        {hasChanges && (
          <button
            onClick={handleReset}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "10px 20px", borderRadius: 8,
              border: `1px solid ${CARD_BORDER}`,
              background: "transparent",
              color: TEXT_SECONDARY, fontSize: 13, cursor: "pointer",
            }}
          >
            <RotateCcw size={14} /> Reset
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "10px 24px", borderRadius: 8,
            border: "none",
            background: hasChanges ? `linear-gradient(135deg, ${TEAL}, #06b6d4)` : CARD_BORDER,
            color: hasChanges ? "#fff" : TEXT_SECONDARY,
            fontWeight: 700, fontSize: 13,
            cursor: hasChanges ? "pointer" : "not-allowed",
          }}
        >
          <Save size={14} />
          {saving ? "Saving..." : saved ? "Saved!" : "Save Location"}
        </button>
      </div>
    </div>
  );
}
