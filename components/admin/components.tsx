"use client";

import React, { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

// Google Maps types - simplified to avoid conflicts
interface PlacePrediction {
  place_id: string;
  description: string;
}

interface AddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

interface PlaceResult {
  address_components?: AddressComponent[];
  formatted_address?: string;
}

// ==================== COLORS ====================
export const COLORS = {
  neonPink: "#ff2d92",
  neonBlue: "#00d4ff",
  neonGreen: "#39ff14",
  neonYellow: "#ffff00",
  neonOrange: "#ff6b35",
  neonPurple: "#bf5fff",
  neonRed: "#ff3131",
  darkBg: "#0f0f1a",
  cardBg: "#1a1a2e",
  cardBorder: "#2d2d44",
  textPrimary: "#ffffff",
  textSecondary: "#a0a0b0",
  gradient1: "linear-gradient(135deg, #ff2d92, #ff6b35)",
  gradient2: "linear-gradient(135deg, #00d4ff, #39ff14)",
  gradient3: "linear-gradient(135deg, #bf5fff, #ff2d92)",
  gradient4: "linear-gradient(135deg, #ffff00, #ff6b35)",
};

export const CHART_COLORS = ["#ff2d92", "#00d4ff", "#39ff14", "#ffff00", "#bf5fff", "#ff6b35", "#ff3131"];

// ==================== UTILITY FUNCTIONS ====================
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  // Date-only strings like "2026-02-22" are parsed as UTC by JS, causing off-by-one
  // in negative UTC offsets. Append T00:00:00 to force local-time parsing.
  const safe = iso.length === 10 ? `${iso}T00:00:00` : iso;
  return new Date(safe).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function formatMoney(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "$0.00";
  return "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 });
}

export function bpsToPct(bps: number): string {
  return (bps / 100).toFixed(2) + "%";
}

export function getHoursSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.round((Date.now() - new Date(iso).getTime()) / 3600000);
}

// ==================== BADGE COMPONENT ====================
interface BadgeProps {
  status: string;
}

export function Badge({ status }: BadgeProps) {
  const styles: Record<string, { bg: string; color: string }> = {
    submitted: { bg: "linear-gradient(135deg, #00d4ff, #0099ff)", color: "#fff" },
    pending: { bg: "linear-gradient(135deg, #ffff00, #ff6b35)", color: "#000" },
    pending_review: { bg: "linear-gradient(135deg, #00d4ff, #0099ff)", color: "#fff" },
    pending_final: { bg: "linear-gradient(135deg, #bf5fff, #ff2d92)", color: "#fff" },
    pending_business: { bg: "linear-gradient(135deg, #ffff00, #ff6b35)", color: "#000" },
    approved: { bg: "linear-gradient(135deg, #39ff14, #00d4ff)", color: "#000" },
    active: { bg: "linear-gradient(135deg, #39ff14, #00d4ff)", color: "#000" },
    paused: { bg: "linear-gradient(135deg, #ffff00, #ff6b35)", color: "#000" },
    suspended: { bg: "linear-gradient(135deg, #ff3131, #ff2d92)", color: "#fff" },
    banned: { bg: "linear-gradient(135deg, #990000, #ff3131)", color: "#fff" },
    rejected: { bg: "linear-gradient(135deg, #ff3131, #990000)", color: "#fff" },
    denied: { bg: "linear-gradient(135deg, #ff3131, #990000)", color: "#fff" },
    cancelled: { bg: "linear-gradient(135deg, #ff3131, #990000)", color: "#fff" },
    needs_changes: { bg: "linear-gradient(135deg, #ffff00, #ff6b35)", color: "#000" },
    paid: { bg: "linear-gradient(135deg, #39ff14, #00d4ff)", color: "#000" },
    sent: { bg: "linear-gradient(135deg, #00d4ff, #0099ff)", color: "#fff" },
    viewed: { bg: "linear-gradient(135deg, #39ff14, #00d4ff)", color: "#000" },
    completed: { bg: "linear-gradient(135deg, #39ff14, #00d4ff)", color: "#000" },
    premium: { bg: "linear-gradient(135deg, #bf5fff, #ff2d92)", color: "#fff" },
    basic: { bg: "#3d3d5c", color: "#fff" },
    receipt: { bg: "linear-gradient(135deg, #00d4ff, #0099ff)", color: "#fff" },
    payout: { bg: "linear-gradient(135deg, #39ff14, #00d4ff)", color: "#000" },
    not_contacted: { bg: "#3d3d5c", color: "#fff" },
    contacted: { bg: "linear-gradient(135deg, #00d4ff, #0099ff)", color: "#fff" },
    pitched: { bg: "linear-gradient(135deg, #bf5fff, #ff2d92)", color: "#fff" },
    follow_up: { bg: "linear-gradient(135deg, #ffff00, #ff6b35)", color: "#000" },
    signed_up: { bg: "linear-gradient(135deg, #39ff14, #00d4ff)", color: "#000" },
    not_interested: { bg: "linear-gradient(135deg, #ff3131, #990000)", color: "#fff" },
    expired: { bg: "#3d3d5c", color: "#a0a0b0" },
    reinstated: { bg: "linear-gradient(135deg, #00d4ff, #39ff14)", color: "#000" },
  };
  const s = styles[status] || styles.submitted;
  return (
    <span
      style={{
        padding: "4px 12px",
        borderRadius: 100,
        fontSize: 10,
        fontWeight: 700,
        textTransform: "uppercase",
        background: s.bg,
        color: s.color,
        whiteSpace: "nowrap",
      }}
    >
      {status?.replace(/_/g, " ")}
    </span>
  );
}

// ==================== CARD COMPONENT ====================
interface CardProps {
  title?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
  actions?: React.ReactNode;
}

export function Card({ title, children, style = {}, actions }: CardProps) {
  return (
    <div
      style={{
        background: COLORS.cardBg,
        border: "1px solid " + COLORS.cardBorder,
        borderRadius: 16,
        padding: 24,
        ...style,
      }}
    >
      {(title || actions) && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          {title && (
            <div
              style={{
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: COLORS.textSecondary,
                fontWeight: 600,
              }}
            >
              {title}
            </div>
          )}
          {actions && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {actions}
            </div>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

// ==================== STAT CARD COMPONENT ====================
interface StatCardProps {
  value: string | number;
  label: string;
  gradient?: string;
  trend?: "up" | "down";
  trendValue?: string;
  icon?: string;
}

export function StatCard({ value, label, gradient, trend, trendValue, icon }: StatCardProps) {
  return (
    <div
      style={{
        background: COLORS.cardBg,
        border: "1px solid " + COLORS.cardBorder,
        borderRadius: 16,
        padding: 20,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: gradient || COLORS.gradient1,
        }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          {icon && <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>}
          <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
          <div style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 4 }}>{label}</div>
        </div>
        {trend && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "6px 10px",
              borderRadius: 8,
              background: trend === "up" ? "rgba(57,255,20,0.2)" : "rgba(255,49,49,0.2)",
            }}
          >
            <span>{trend === "up" ? "↑" : "↓"}</span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: trend === "up" ? COLORS.neonGreen : COLORS.neonRed,
              }}
            >
              {trendValue}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== SECTION TITLE COMPONENT ====================
interface SectionTitleProps {
  children: React.ReactNode;
  icon?: string;
}

export function SectionTitle({ children, icon }: SectionTitleProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, marginTop: 32 }}>
      {icon && <span style={{ fontSize: 24 }}>{icon}</span>}
      <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>{children}</h2>
      <div
        style={{
          flex: 1,
          height: 1,
          background: "linear-gradient(90deg, " + COLORS.cardBorder + ", transparent)",
        }}
      />
    </div>
  );
}

// ==================== EDIT FIELD COMPONENT ====================
interface EditFieldOption {
  value: string;
  label: string;
}

interface EditFieldProps {
  label: string;
  value: string | number | null | undefined;
  type?: string;
  options?: EditFieldOption[];
  textarea?: boolean;
  editable?: boolean;
  onChange?: (value: string) => void;
}

export function EditField({
  label,
  value,
  type = "text",
  options,
  textarea,
  editable = true,
  onChange,
}: EditFieldProps) {
  const style: React.CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    border: "1px solid " + COLORS.cardBorder,
    borderRadius: 8,
    fontSize: 13,
    background: COLORS.darkBg,
    color: COLORS.textPrimary,
  };

  if (!editable) {
    return (
      <div style={{ marginBottom: 16 }}>
        <label
          style={{
            display: "block",
            fontSize: 11,
            color: COLORS.textSecondary,
            marginBottom: 6,
            fontWeight: 600,
            textTransform: "uppercase",
          }}
        >
          {label}
        </label>
        <div style={{ ...style, background: "transparent", border: "1px solid transparent", padding: "12px 0" }}>
          {value || "—"}
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <label
        style={{
          display: "block",
          fontSize: 11,
          color: COLORS.textSecondary,
          marginBottom: 6,
          fontWeight: 600,
          textTransform: "uppercase",
        }}
      >
        {label}
      </label>
      {textarea ? (
        <textarea
          defaultValue={value?.toString() || ""}
          onChange={(e) => onChange?.(e.target.value)}
          style={{ ...style, minHeight: 100, resize: "vertical" }}
        />
      ) : options ? (
        <select
          defaultValue={value?.toString() || ""}
          onChange={(e) => onChange?.(e.target.value)}
          style={style}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          defaultValue={value?.toString() || ""}
          onChange={(e) => onChange?.(e.target.value)}
          style={style}
        />
      )}
    </div>
  );
}

// ==================== PHONE FIELD COMPONENT ====================
interface PhoneFieldProps {
  label: string;
  value: string | null | undefined;
  editable?: boolean;
  onChange?: (value: string) => void;
}

export function PhoneField({ label, value, editable = true, onChange }: PhoneFieldProps) {
  const [displayValue, setDisplayValue] = useState(value || "");

  useEffect(() => {
    setDisplayValue(formatPhoneDisplay(value || ""));
  }, [value]);

  // Format phone number as (###) ###-####
  function formatPhoneDisplay(input: string): string {
    const digits = input.replace(/\D/g, "").slice(0, 10);
    if (digits.length === 0) return "";
    if (digits.length <= 3) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    const digits = input.replace(/\D/g, "").slice(0, 10);
    const formatted = formatPhoneDisplay(digits);
    setDisplayValue(formatted);
    onChange?.(formatted);
  };

  const style: React.CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    border: "1px solid " + COLORS.cardBorder,
    borderRadius: 8,
    fontSize: 13,
    background: COLORS.darkBg,
    color: COLORS.textPrimary,
  };

  if (!editable) {
    return (
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, fontWeight: 600, textTransform: "uppercase" }}>
          {label}
        </label>
        <div style={{ ...style, background: "transparent", border: "1px solid transparent", padding: "12px 0" }}>
          {displayValue || "—"}
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, fontWeight: 600, textTransform: "uppercase" }}>
        {label}
      </label>
      <input
        type="tel"
        value={displayValue}
        onChange={handleChange}
        placeholder="(402) 555-1234"
        maxLength={14}
        style={style}
      />
    </div>
  );
}

// ==================== ADDRESS FIELD WITH AUTOCOMPLETE ====================
interface AddressFieldProps {
  label: string;
  value: string | null | undefined;
  editable?: boolean;
  onChange?: (value: string) => void;
  onAddressSelect?: (address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    full: string;
  }) => void;
}

export function AddressField({ label, value, editable = true, onChange, onAddressSelect }: AddressFieldProps) {
  const [inputValue, setInputValue] = useState(value || "");
  const [suggestions, setSuggestions] = useState<PlacePrediction[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [googleLoaded, setGoogleLoaded] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const autocompleteService = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const placesService = useRef<any>(null);

  useEffect(() => {
    setInputValue(value || "");
  }, [value]);

  // Check for Google Maps and retry until loaded
  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 20; // Try for 10 seconds (20 * 500ms)

    const checkGoogleMaps = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      if (w.google?.maps?.places) {
        try {
          autocompleteService.current = new w.google.maps.places.AutocompleteService();
          const dummyDiv = document.createElement("div");
          placesService.current = new w.google.maps.places.PlacesService(dummyDiv);
          setGoogleLoaded(true);
          // Google Maps Places loaded
        } catch (err) {
          console.error("[AddressField] Error initializing Google Maps:", err);
        }
      } else {
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkGoogleMaps, 500);
        } else {
          // Google Maps not available after 10s - address autocomplete disabled
        }
      }
    };

    checkGoogleMaps();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    onChange?.(val);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (val.length > 2 && autocompleteService.current && googleLoaded) {
      autocompleteService.current.getPlacePredictions(
        { input: val, types: ["address"], componentRestrictions: { country: "us" } },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (predictions: any[] | null, status: string) => {
          if (status === w.google?.maps?.places?.PlacesServiceStatus?.OK && predictions) {
            setSuggestions(predictions.map((p: { place_id: string; description: string }) => ({ 
              place_id: p.place_id, 
              description: p.description 
            })));
            setShowSuggestions(true);
          } else {
            setSuggestions([]);
          }
        }
      );
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = (placeId: string, description: string) => {
    if (!placesService.current) {
      setInputValue(description);
      onChange?.(description);
      setShowSuggestions(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    placesService.current.getDetails(
      { placeId, fields: ["address_components", "formatted_address"] },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (place: PlaceResult | null, status: string) => {
        if (status === w.google?.maps?.places?.PlacesServiceStatus?.OK && place) {
          let street = "";
          let city = "";
          let state = "";
          let zip = "";

          place.address_components?.forEach((component: AddressComponent) => {
            const types = component.types;
            if (types.includes("street_number")) {
              street = component.long_name + " ";
            }
            if (types.includes("route")) {
              street += component.long_name;
            }
            if (types.includes("locality")) {
              city = component.long_name;
            }
            if (types.includes("administrative_area_level_1")) {
              state = component.short_name;
            }
            if (types.includes("postal_code")) {
              zip = component.long_name;
            }
          });

          const fullAddress = place.formatted_address || description;
          setInputValue(street.trim() || fullAddress);
          onChange?.(street.trim() || fullAddress);
          onAddressSelect?.({ street: street.trim(), city, state, zip, full: fullAddress });
        }
        setShowSuggestions(false);
      }
    );
  };

  const style: React.CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    border: "1px solid " + COLORS.cardBorder,
    borderRadius: 8,
    fontSize: 13,
    background: COLORS.darkBg,
    color: COLORS.textPrimary,
  };

  if (!editable) {
    return (
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, fontWeight: 600, textTransform: "uppercase" }}>
          {label}
        </label>
        <div style={{ ...style, background: "transparent", border: "1px solid transparent", padding: "12px 0" }}>
          {value || "—"}
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 16, position: "relative" }}>
      <label style={{ display: "block", fontSize: 11, color: COLORS.textSecondary, marginBottom: 6, fontWeight: 600, textTransform: "uppercase" }}>
        {label}
        {googleLoaded && (
          <span style={{ marginLeft: 8, color: COLORS.neonGreen, fontSize: 10, fontWeight: 400 }}>
            ✓ Autocomplete enabled
          </span>
        )}
      </label>
      <div style={{ position: "relative" }}>
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder={googleLoaded ? "Start typing an address..." : "Enter address..."}
          style={{
            ...style,
            paddingRight: googleLoaded ? 36 : 14,
          }}
        />
        {googleLoaded && (
          <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, opacity: 0.5 }}>
            📍
          </span>
        )}
      </div>
      {showSuggestions && suggestions.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            background: COLORS.cardBg,
            border: "1px solid " + COLORS.cardBorder,
            borderRadius: 8,
            marginTop: 4,
            maxHeight: 200,
            overflowY: "auto",
            zIndex: 100,
            boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
          }}
        >
          {suggestions.map((s) => (
            <div
              key={s.place_id}
              onClick={() => handleSelectSuggestion(s.place_id, s.description)}
              style={{
                padding: "10px 14px",
                cursor: "pointer",
                borderBottom: "1px solid " + COLORS.cardBorder,
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.darkBg)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ color: COLORS.neonPink }}>📍</span>
              <span>{s.description}</span>
            </div>
          ))}
          <div style={{ padding: "6px 14px", fontSize: 10, color: COLORS.textSecondary, textAlign: "right" }}>
            powered by Google
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== PAYOUT TIER PRESETS ====================
interface PayoutTierPresetsProps {
  preset: string | null | undefined;
  tiers: number[] | null | undefined;
  editable?: boolean;
  onPresetChange?: (preset: string) => void;
  onTiersChange?: (tiers: number[]) => void;
}

const PRESET_TIERS: Record<string, number[]> = {
  conservative: [300, 400, 500, 600, 700, 850, 1000],
  standard: [800, 900, 1000, 1100, 1200, 1350, 1500],
  aggressive: [1300, 1450, 1550, 1650, 1750, 1850, 2000],
};

const VISIT_RANGES = [
  "1-10 visits",
  "11-20 visits",
  "21-30 visits",
  "31-40 visits",
  "41-50 visits",
  "51-60 visits",
  "61+ visits",
];

export function PayoutTierPresets({ preset, tiers, editable = true, onPresetChange, onTiersChange }: PayoutTierPresetsProps) {
  const [selectedPreset, setSelectedPreset] = useState(preset || "standard");
  const [customTiers, setCustomTiers] = useState<number[]>(tiers || PRESET_TIERS.standard);

  useEffect(() => {
    if (preset && PRESET_TIERS[preset]) {
      setSelectedPreset(preset);
      if (preset !== "custom") {
        setCustomTiers(PRESET_TIERS[preset]);
      }
    }
  }, [preset]);

  useEffect(() => {
    if (tiers && tiers.length === 7) {
      setCustomTiers(tiers);
    }
  }, [tiers]);

  const handlePresetSelect = (p: string) => {
    setSelectedPreset(p);
    onPresetChange?.(p);
    if (p !== "custom" && PRESET_TIERS[p]) {
      setCustomTiers(PRESET_TIERS[p]);
      onTiersChange?.(PRESET_TIERS[p]);
    }
  };

  const handleTierChange = (index: number, value: number) => {
    const newTiers = [...customTiers];
    newTiers[index] = value;
    setCustomTiers(newTiers);
    setSelectedPreset("custom");
    onPresetChange?.("custom");
    onTiersChange?.(newTiers);
  };

  const bpsToPct = (bps: number) => (bps / 100).toFixed(2) + "%";

  const presets = [
    { key: "conservative", label: "Conservative", desc: "Lower payouts, safer for new businesses" },
    { key: "standard", label: "Standard", desc: "Balanced payouts, recommended" },
    { key: "aggressive", label: "Aggressive", desc: "Higher payouts to drive repeat visits" },
    { key: "custom", label: "Custom", desc: "Set your own payout levels manually" },
  ];

  return (
    <div>
      {/* Preset Selection */}
      {editable && (
        <>
          <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.neonGreen, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <span>⚡</span> Quick Setup (Choose a Preset)
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
            {presets.map((p) => (
              <div
                key={p.key}
                onClick={() => handlePresetSelect(p.key)}
                style={{
                  padding: "16px",
                  borderRadius: 12,
                  border: selectedPreset === p.key ? "2px solid " + COLORS.neonGreen : "1px solid " + COLORS.cardBorder,
                  background: selectedPreset === p.key ? "rgba(57,255,20,0.1)" : COLORS.darkBg,
                  cursor: "pointer",
                  position: "relative",
                }}
              >
                {selectedPreset === p.key && (
                  <div style={{ position: "absolute", top: 12, right: 12, width: 20, height: 20, borderRadius: "50%", background: COLORS.neonGreen, display: "flex", alignItems: "center", justifyContent: "center", color: "#000", fontSize: 12 }}>✓</div>
                )}
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{p.label}</div>
                <div style={{ fontSize: 11, color: COLORS.textSecondary }}>{p.desc}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Tier Table */}
      <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.neonBlue, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
        <span>📊</span> Your Progressive Payout Tiers
      </div>
      <div style={{ background: COLORS.darkBg, borderRadius: 12, overflow: "hidden", border: "1px solid " + COLORS.cardBorder }}>
        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 120px 1fr", padding: "12px 16px", background: COLORS.cardBorder, fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: COLORS.textSecondary }}>
          <div>Tier</div>
          <div>Visit Range</div>
          <div>You Pay (BPS)</div>
          <div>Customer Sees</div>
        </div>
        {/* Rows */}
        {customTiers.map((bps, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "80px 1fr 120px 1fr", padding: "12px 16px", borderBottom: i < 6 ? "1px solid " + COLORS.cardBorder : "none", alignItems: "center" }}>
            <div style={{ fontWeight: 600 }}>Level {i + 1}</div>
            <div style={{ fontSize: 12, color: COLORS.neonPink }}>{VISIT_RANGES[i]}</div>
            <div>
              {editable ? (
                <input
                  type="number"
                  value={bps}
                  onChange={(e) => handleTierChange(i, parseInt(e.target.value) || 0)}
                  style={{
                    width: 80,
                    padding: "8px 10px",
                    background: COLORS.cardBg,
                    border: "1px solid " + COLORS.cardBorder,
                    borderRadius: 6,
                    color: COLORS.textPrimary,
                    fontSize: 13,
                    textAlign: "center",
                  }}
                />
              ) : (
                <span style={{ fontWeight: 600 }}>{bps}</span>
              )}
            </div>
            <div style={{ color: i === 6 ? COLORS.neonGreen : COLORS.textPrimary, fontWeight: i === 6 ? 700 : 400 }}>
              {bpsToPct(bps)} of subtotal
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, fontSize: 11, color: COLORS.textSecondary, display: "flex", alignItems: "center", gap: 6 }}>
        <span>💡</span> BPS = Basis Points (100 BPS = 1%). Applies to the receipt subtotal before tax/tip.
      </div>
    </div>
  );
}

// ==================== PREMIUM ADD-ONS COMPONENT ====================
// Matches the add-ons from business profile AdvertisingAddons.tsx
// Stored in business.config.selectedAddOns (array) and business.config.tpmsEnabled (boolean)

type AddOnId = "videos_5_day" | "live_15" | "live_30";

interface AddOnOption {
  id: AddOnId;
  label: string;
  priceMonthly: number;
  priceLabel: string;
}

interface BusinessConfig {
  selectedAddOns?: AddOnId[];
  tpmsEnabled?: boolean;
}

interface PkgPricingInput {
  addon_video_5_monthly_cents: number;
  addon_live_15_monthly_cents: number;
  addon_live_30_monthly_cents: number;
  tpms_monthly_cents: number;
}

interface PremiumAddonsProps {
  businessId: string;
  config?: BusinessConfig;
  editable?: boolean;
  onChange?: (config: BusinessConfig) => void;
  pkgPricing?: PkgPricingInput;
}

const DEFAULT_ADD_ON_OPTIONS: AddOnOption[] = [
  { id: "videos_5_day", label: "Add 5 videos/day", priceMonthly: 50, priceLabel: "+$50/month" },
  { id: "live_15", label: "Increase live video capacity to 15", priceMonthly: 50, priceLabel: "+$50/month" },
  { id: "live_30", label: "Increase live video capacity to 30", priceMonthly: 100, priceLabel: "+$100/month" },
];

export function PremiumAddons({ businessId, config, editable = true, onChange, pkgPricing }: PremiumAddonsProps) {
  const [selectedAddOnIds, setSelectedAddOnIds] = useState<AddOnId[]>(config?.selectedAddOns || []);
  const [tpmsEnabled, setTpmsEnabled] = useState(config?.tpmsEnabled || false);

  // Build pricing-aware add-on options
  const ADD_ON_OPTIONS: AddOnOption[] = pkgPricing
    ? [
        { id: "videos_5_day", label: "Add 5 videos/day", priceMonthly: pkgPricing.addon_video_5_monthly_cents / 100, priceLabel: `+$${(pkgPricing.addon_video_5_monthly_cents / 100).toLocaleString()}/month` },
        { id: "live_15", label: "Increase live video capacity to 15", priceMonthly: pkgPricing.addon_live_15_monthly_cents / 100, priceLabel: `+$${(pkgPricing.addon_live_15_monthly_cents / 100).toLocaleString()}/month` },
        { id: "live_30", label: "Increase live video capacity to 30", priceMonthly: pkgPricing.addon_live_30_monthly_cents / 100, priceLabel: `+$${(pkgPricing.addon_live_30_monthly_cents / 100).toLocaleString()}/month` },
      ]
    : DEFAULT_ADD_ON_OPTIONS;

  const tpmsMonthly = pkgPricing ? pkgPricing.tpms_monthly_cents / 100 : 200;

  useEffect(() => {
    if (config) {
      setSelectedAddOnIds(config.selectedAddOns || []);
      setTpmsEnabled(config.tpmsEnabled || false);
    }
  }, [config]);

  // Mutual exclusivity: live_15 and live_30 cannot both be selected
  const toggleAddOn = (id: AddOnId) => {
    let newIds: AddOnId[];
    const isChecked = selectedAddOnIds.includes(id);

    if (isChecked) {
      newIds = selectedAddOnIds.filter((x) => x !== id);
    } else {
      if (id === "live_15") {
        newIds = [...selectedAddOnIds.filter((x) => x !== "live_30"), "live_15"];
      } else if (id === "live_30") {
        newIds = [...selectedAddOnIds.filter((x) => x !== "live_15"), "live_30"];
      } else {
        newIds = [...selectedAddOnIds, id];
      }
    }

    setSelectedAddOnIds(newIds);
    onChange?.({ selectedAddOns: newIds, tpmsEnabled });
  };

  const toggleTpms = () => {
    const newValue = !tpmsEnabled;
    setTpmsEnabled(newValue);
    onChange?.({ selectedAddOns: selectedAddOnIds, tpmsEnabled: newValue });
  };

  // Calculate totals
  const addOnsSubtotal = ADD_ON_OPTIONS
    .filter((a) => selectedAddOnIds.includes(a.id))
    .reduce((sum, a) => sum + a.priceMonthly, 0);
  const totalMonthly = addOnsSubtotal + (tpmsEnabled ? tpmsMonthly : 0);

  return (
    <div>
      {/* Premium Add-ons */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.neonPurple, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <span>💎</span> Premium Add-ons
        </div>
        <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 16 }}>
          Enhance your Premium subscription with additional features
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {ADD_ON_OPTIONS.map((addon) => {
            const isChecked = selectedAddOnIds.includes(addon.id);
            const priceColor = addon.priceMonthly === 100 ? COLORS.neonOrange : COLORS.neonGreen;

            return (
              <div
                key={addon.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "14px 16px",
                  background: isChecked ? "rgba(57,255,20,0.1)" : COLORS.darkBg,
                  borderRadius: 10,
                  border: isChecked ? "1px solid " + COLORS.neonGreen : "1px solid " + COLORS.cardBorder,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {editable ? (
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleAddOn(addon.id)}
                      style={{ width: 18, height: 18, cursor: "pointer", accentColor: COLORS.neonGreen }}
                    />
                  ) : (
                    <span style={{ fontSize: 16 }}>{isChecked ? "✅" : "⬜"}</span>
                  )}
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{addon.label}</span>
                </div>
                <span style={{ fontFamily: "monospace", fontWeight: 700, color: priceColor }}>
                  {addon.priceLabel}
                </span>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 8, fontSize: 11, color: COLORS.textSecondary }}>
          Note: Only one live video capacity add-on can be selected at a time (15 <em>or</em> 30).
        </div>
      </div>

      {/* TPMS Service */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.neonBlue, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <span>🛡️</span> Optional Services
        </div>

        <div
          style={{
            padding: "16px",
            background: tpmsEnabled ? "rgba(57,255,20,0.1)" : COLORS.darkBg,
            borderRadius: 12,
            border: tpmsEnabled ? "1px solid " + COLORS.neonGreen : "1px solid " + COLORS.cardBorder,
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            {editable ? (
              <input
                type="checkbox"
                checked={tpmsEnabled}
                onChange={toggleTpms}
                style={{ width: 18, height: 18, cursor: "pointer", marginTop: 2, accentColor: COLORS.neonGreen }}
              />
            ) : (
              <span style={{ fontSize: 16, marginTop: 2 }}>{tpmsEnabled ? "✅" : "⬜"}</span>
            )}
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>Total Profile Management Services (TPMS)</span>
                {tpmsEnabled && (
                  <span style={{ padding: "2px 8px", background: COLORS.neonGreen, color: "#000", borderRadius: 4, fontSize: 10, fontWeight: 700 }}>
                    ACTIVE
                  </span>
                )}
              </div>
              <div style={{ fontFamily: "monospace", fontWeight: 700, color: COLORS.neonOrange, marginBottom: 8 }}>
                ${tpmsMonthly.toLocaleString()}/month
              </div>
              <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.5 }}>
                We'll handle receipt reviews and approvals for you, keep your profile updated with fresh uploads, and manage your payout ladder settings for optimal performance.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Total Summary */}
      <div
        style={{
          padding: "16px",
          background: "linear-gradient(135deg, rgba(138,43,226,0.15) 0%, rgba(57,255,20,0.15) 100%)",
          borderRadius: 12,
          border: "1px solid " + COLORS.neonPurple,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 4 }}>MONTHLY ADD-ON TOTAL</div>
            <div style={{ fontSize: 10, color: COLORS.textSecondary }}>
              {selectedAddOnIds.length} add-on{selectedAddOnIds.length !== 1 ? "s" : ""} + {tpmsEnabled ? "TPMS" : "no TPMS"}
            </div>
          </div>
          <div style={{ fontFamily: "monospace", fontSize: 24, fontWeight: 800, color: COLORS.neonGreen }}>
            ${totalMonthly.toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== MEDIA GRID WITH MANAGEMENT ====================
interface MediaItemWithStatus {
  id?: string;
  name?: string;
  url?: string;
  status?: "active" | "paused" | "removed";
  uploaded_at?: string;
}

interface MediaGridManagedProps {
  items: (MediaItemWithStatus | null | undefined)[] | null | undefined;
  type: "photo" | "video";
  editable?: boolean;
  onPreview?: (preview: { url: string; type: string }) => void;
  onStatusChange?: (index: number, status: "active" | "paused" | "removed") => void;
  onDelete?: (indices: number[]) => void;
}

export function MediaGridManaged({ items, type, editable = true, onPreview, onStatusChange, onDelete }: MediaGridManagedProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Clear selection when items change
  useEffect(() => { setSelected(new Set()); }, [items?.length]);

  if (!items || items.length === 0) {
    return (
      <div style={{ color: COLORS.textSecondary, padding: 40, textAlign: "center", background: COLORS.darkBg, borderRadius: 12 }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>{type === "video" ? "🎬" : "📷"}</div>
        <div>No {type === "video" ? "videos" : "photos"} uploaded yet</div>
      </div>
    );
  }

  const validItems = items.map((item, i) => item ? { item, index: i } : null).filter(Boolean) as { item: MediaItemWithStatus; index: number }[];
  const allSelected = validItems.length > 0 && validItems.every(v => selected.has(v.index));
  const hasSelection = selected.size > 0;

  const toggleSelect = (i: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(validItems.map(v => v.index)));
    }
  };

  return (
    <div>
      {/* Bulk Action Bar */}
      {editable && (
        <div style={{
          display: "flex", alignItems: "center", gap: 12, marginBottom: 12,
          padding: "8px 12px", background: COLORS.darkBg, borderRadius: 10,
          minHeight: 40,
        }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: COLORS.textSecondary }}>
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              style={{ accentColor: COLORS.neonBlue, width: 16, height: 16, cursor: "pointer" }}
            />
            {allSelected ? "Deselect All" : "Select All"}
          </label>

          {hasSelection && (
            <>
              <span style={{ fontSize: 12, color: COLORS.neonBlue, fontWeight: 600 }}>
                {selected.size} selected
              </span>
              <div style={{ flex: 1 }} />
              {onStatusChange && (
                <button
                  onClick={() => {
                    if (confirm(`Ban ${selected.size} ${type}(s)? They will be hidden from the business profile.`)) {
                      Array.from(selected).forEach(i => onStatusChange(i, "removed"));
                      setSelected(new Set());
                    }
                  }}
                  style={{
                    padding: "6px 14px", borderRadius: 6, border: "none",
                    background: COLORS.neonRed, color: "#fff", cursor: "pointer",
                    fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 4,
                  }}
                >
                  Ban Selected
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => {
                    if (confirm(`Permanently delete ${selected.size} ${type}(s)? This cannot be undone.`)) {
                      onDelete(Array.from(selected));
                      setSelected(new Set());
                    }
                  }}
                  style={{
                    padding: "6px 14px", borderRadius: 6, border: "none",
                    background: "#8b0000", color: "#fff", cursor: "pointer",
                    fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 4,
                  }}
                >
                  Delete Selected
                </button>
              )}
            </>
          )}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
        {items.map((item, i) => {
          if (!item) return null;
          const isVideo = type === "video" || item.url?.includes(".mp4") || item.name?.includes(".mp4");
          const isInvestigating = item.status === "paused";
          const isBanned = item.status === "removed";
          const isActive = !item.status || item.status === "active";
          const isSelected = selected.has(i);

          return (
            <div
              key={item.id || i}
              style={{
                borderRadius: 12,
                overflow: "hidden",
                border: isSelected
                  ? "3px solid " + COLORS.neonBlue
                  : isInvestigating
                  ? "3px solid " + COLORS.neonOrange
                  : isBanned
                  ? "3px solid " + COLORS.neonRed
                  : "2px solid " + COLORS.cardBorder,
                background: COLORS.cardBg,
                opacity: isBanned ? 0.6 : 1,
              }}
            >
              {/* Media Preview */}
              <div
                onClick={() => !isBanned && onPreview?.({ url: item.url || "", type: isVideo ? "video" : "image" })}
                style={{
                  width: "100%",
                  aspectRatio: "1",
                  cursor: isBanned ? "default" : "pointer",
                  position: "relative",
                }}
              >
                {isVideo ? (
                  <>
                    <video src={item.url} muted preload="metadata" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.25)", pointerEvents: "none" }}>
                      <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <div style={{ width: 0, height: 0, borderTop: "10px solid transparent", borderBottom: "10px solid transparent", borderLeft: "16px solid white", marginLeft: 3 }} />
                      </div>
                    </div>
                  </>
                ) : (
                  <img src={item.url} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                )}

                {/* Status Badge - Always visible */}
                <div
                  style={{
                    position: "absolute",
                    top: 8,
                    left: 8,
                    padding: "4px 10px",
                    borderRadius: 6,
                    background: isInvestigating
                      ? COLORS.neonOrange
                      : isBanned
                      ? COLORS.neonRed
                      : "rgba(57,255,20,0.9)",
                    color: isActive ? "#000" : "#fff",
                    fontSize: 10,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  {isInvestigating && <span>🔍</span>}
                  {isBanned && <span>🚫</span>}
                  {isActive && <span>✓</span>}
                  {isInvestigating ? "INVESTIGATING" : isBanned ? "BANNED" : "ACTIVE"}
                </div>

                {/* Selection Checkbox */}
                {editable && (
                  <div
                    onClick={(e) => { e.stopPropagation(); toggleSelect(i); }}
                    style={{
                      position: "absolute", top: 8, right: 8,
                      width: 24, height: 24, borderRadius: 6,
                      background: isSelected ? COLORS.neonBlue : "rgba(0,0,0,0.5)",
                      border: isSelected ? "none" : "2px solid rgba(255,255,255,0.5)",
                      cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#fff", fontSize: 14, fontWeight: 700,
                    }}
                  >
                    {isSelected && "✓"}
                  </div>
                )}
              </div>

              {/* Info Section */}
              <div style={{ padding: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {item.name || "Untitled"}
                </div>
                {item.uploaded_at && (
                  <div style={{ fontSize: 10, color: COLORS.textSecondary }}>
                    Uploaded: {new Date(item.uploaded_at).toLocaleDateString()}
                  </div>
                )}

                {/* Staff Action Buttons */}
                {editable && (
                  <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                    {!isBanned && (
                      <>
                        <button
                          onClick={() => onStatusChange?.(i, isInvestigating ? "active" : "paused")}
                          title={isInvestigating ? "Clear Investigation" : "Flag for Investigation"}
                          style={{
                            flex: 1,
                            padding: "6px 8px",
                            borderRadius: 6,
                            border: "none",
                            background: isInvestigating ? COLORS.neonGreen : COLORS.neonOrange,
                            color: "#000",
                            cursor: "pointer",
                            fontSize: 10,
                            fontWeight: 700,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 4,
                          }}
                        >
                          {isInvestigating ? "✓ Clear" : "🔍 Investigate"}
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Are you sure you want to ban this ${type}? It will be hidden from the business profile.`)) {
                              onStatusChange?.(i, "removed");
                            }
                          }}
                          title="Ban Media"
                          style={{
                            flex: 1,
                            padding: "6px 8px",
                            borderRadius: 6,
                            border: "none",
                            background: COLORS.neonRed,
                            color: "#fff",
                            cursor: "pointer",
                            fontSize: 10,
                            fontWeight: 700,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 4,
                          }}
                        >
                          🚫 Ban
                        </button>
                      </>
                    )}
                    {isBanned && (
                      <button
                        onClick={() => {
                          if (confirm(`Restore this ${type}? It will become visible again on the business profile.`)) {
                            onStatusChange?.(i, "active");
                          }
                        }}
                        title="Restore Media"
                        style={{
                          flex: 1,
                          padding: "8px",
                          borderRadius: 6,
                          border: "none",
                          background: COLORS.neonGreen,
                          color: "#000",
                          cursor: "pointer",
                          fontSize: 11,
                          fontWeight: 700,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 4,
                        }}
                      >
                        ↩️ Restore
                      </button>
                    )}
                    {/* Delete button - always available */}
                    {onDelete && (
                      <button
                        onClick={() => {
                          if (confirm(`Permanently delete this ${type}? This cannot be undone.`)) {
                            onDelete([i]);
                          }
                        }}
                        title="Delete permanently"
                        style={{
                          padding: "6px 8px",
                          borderRadius: 6,
                          border: "none",
                          background: "#8b0000",
                          color: "#fff",
                          cursor: "pointer",
                          fontSize: 10,
                          fontWeight: 700,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 4,
                        }}
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==================== HOURS GRID COMPONENT ====================
interface HoursData {
  enabled?: boolean;
  open?: string;
  close?: string;
}

interface HoursGridProps {
  hours: Record<string, HoursData> | null | undefined;
  editable?: boolean;
  onChange?: (hours: Record<string, HoursData>) => void;
}

export function HoursGrid({ hours, editable, onChange }: HoursGridProps) {
  const [localHours, setLocalHours] = useState<Record<string, HoursData>>(hours || {});
  
  const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const labels: Record<string, string> = {
    mon: "Monday",
    tue: "Tuesday",
    wed: "Wednesday",
    thu: "Thursday",
    fri: "Friday",
    sat: "Saturday",
    sun: "Sunday",
  };
  const shortLabels: Record<string, string> = {
    mon: "Mon",
    tue: "Tue",
    wed: "Wed",
    thu: "Thu",
    fri: "Fri",
    sat: "Sat",
    sun: "Sun",
  };

  // Sync with parent hours prop (compare by value, not reference)
  const hoursJson = JSON.stringify(hours);
  useEffect(() => {
    if (hours) {
      setLocalHours(hours);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoursJson]);

  const updateDay = (day: string, field: keyof HoursData, value: boolean | string) => {
    const current = localHours[day] || {};
    const updated = { ...current, [field]: value };

    // When enabling a day, fill in default times if missing
    if (field === "enabled" && value === true) {
      if (!updated.open) updated.open = "09:00";
      if (!updated.close) updated.close = "17:00";
    }

    const newHours = { ...localHours, [day]: updated };
    setLocalHours(newHours);
    onChange?.(newHours);
  };

  if (editable) {
    return (
      <div style={{ display: "grid", gap: 10 }}>
        {days.map((day) => {
          const h = localHours[day] || {};
          return (
            <div
              key={day}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "8px 0",
                borderBottom: "1px solid " + COLORS.cardBorder,
              }}
            >
              <label style={{ width: 80, fontSize: 12, fontWeight: 600, color: COLORS.textSecondary }}>
                {labels[day]}
              </label>
              <input
                type="checkbox"
                checked={h.enabled || false}
                onChange={(e) => updateDay(day, "enabled", e.target.checked)}
                style={{ accentColor: COLORS.neonPink, width: 18, height: 18 }}
              />
              <input
                type="time"
                value={h.open || "09:00"}
                onChange={(e) => updateDay(day, "open", e.target.value)}
                style={{
                  padding: "8px 10px",
                  border: "1px solid " + COLORS.cardBorder,
                  borderRadius: 6,
                  fontSize: 12,
                  background: COLORS.darkBg,
                  color: COLORS.textPrimary,
                }}
              />
              <span style={{ color: COLORS.textSecondary }}>to</span>
              <input
                type="time"
                value={h.close || "17:00"}
                onChange={(e) => updateDay(day, "close", e.target.value)}
                style={{
                  padding: "8px 10px",
                  border: "1px solid " + COLORS.cardBorder,
                  borderRadius: 6,
                  fontSize: 12,
                  background: COLORS.darkBg,
                  color: COLORS.textPrimary,
                }}
              />
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
      {days.map((day) => {
        const h = hours?.[day];
        const isOpen = h?.enabled;
        return (
          <div
            key={day}
            style={{
              textAlign: "center",
              padding: "14px 8px",
              background: COLORS.darkBg,
              borderRadius: 10,
              border: "1px solid " + COLORS.cardBorder,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: isOpen ? COLORS.neonPink : COLORS.textSecondary,
                marginBottom: 8,
              }}
            >
              {shortLabels[day]}
            </div>
            {isOpen ? (
              <>
                <div style={{ fontSize: 12, fontFamily: "monospace", color: COLORS.textPrimary }}>
                  {h?.open || "—"}
                </div>
                <div style={{ fontSize: 10, color: COLORS.textSecondary, margin: "2px 0" }}>to</div>
                <div style={{ fontSize: 12, fontFamily: "monospace", color: COLORS.textPrimary }}>
                  {h?.close || "—"}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12, color: COLORS.textSecondary }}>Closed</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ==================== TIERS DISPLAY COMPONENT ====================
interface TiersDisplayProps {
  tiers: number[] | null | undefined;
  editable?: boolean;
}

export function TiersDisplay({ tiers, editable }: TiersDisplayProps) {
  if (!tiers || tiers.length === 0) {
    return <div style={{ color: COLORS.textSecondary }}>No tiers configured</div>;
  }

  if (editable) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
        {tiers.map((bps, i) => (
          <div key={i}>
            <div
              style={{
                fontSize: 10,
                color: COLORS.textSecondary,
                marginBottom: 4,
                textAlign: "center",
                fontWeight: 600,
              }}
            >
              Level {i + 1}
            </div>
            <input
              type="number"
              defaultValue={bps}
              style={{
                width: "100%",
                padding: "10px 4px",
                border: "1px solid " + COLORS.cardBorder,
                borderRadius: 6,
                fontSize: 12,
                textAlign: "center",
                background: COLORS.darkBg,
                color: COLORS.textPrimary,
              }}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 8 }}>
      {tiers.map((bps, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            padding: "14px 8px",
            background: COLORS.darkBg,
            borderRadius: 10,
            textAlign: "center",
            border: "1px solid " + COLORS.cardBorder,
          }}
        >
          <div style={{ fontSize: 10, color: COLORS.textSecondary, marginBottom: 6 }}>L{i + 1}</div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              background: COLORS.gradient1,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {bpsToPct(bps)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ==================== CHECKLIST COMPONENT ====================
interface ChecklistItem {
  label: string;
  checked: boolean;
}

interface ChecklistProps {
  items: ChecklistItem[] | null | undefined;
  editable?: boolean;
  onChange?: (items: ChecklistItem[]) => void;
}

export function Checklist({ items, editable, onChange }: ChecklistProps) {
  if (!items || items.length === 0) return null;

  const handleToggle = (index: number) => {
    if (!items) return;
    const newItems = items.map((item, i) => 
      i === index ? { ...item, checked: !item.checked } : item
    );
    onChange?.(newItems);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
      {items.map((item, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 14px",
            background: COLORS.darkBg,
            borderRadius: 8,
            fontSize: 13,
            border: "1px solid " + COLORS.cardBorder,
          }}
        >
          {editable ? (
            <input
              type="checkbox"
              checked={item.checked}
              onChange={() => handleToggle(i)}
              style={{ accentColor: COLORS.neonPink, width: 18, height: 18 }}
            />
          ) : (
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: item.checked ? COLORS.gradient2 : COLORS.cardBorder,
                color: item.checked ? "#000" : COLORS.textSecondary,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {item.checked ? "✓" : "—"}
            </span>
          )}
          <span style={{ color: item.checked ? COLORS.textPrimary : COLORS.textSecondary }}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ==================== TAGS COMPONENT ====================
interface TagsProps {
  tags: string[] | null | undefined;
  editable?: boolean;
  businessId?: string;
  onChange?: (tags: string[]) => void;
}

interface TagData {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  category_name: string;
  category_icon: string;
}

export function Tags({ tags, editable, businessId, onChange }: TagsProps) {
  const [allTags, setAllTags] = useState<TagData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>(tags || []);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch all available tags from Supabase
  useEffect(() => {
    async function fetchTags() {
      setLoading(true);
      try {
        const { data, error } = await supabaseBrowser
          .from("tags")
          .select(`
            id,
            name,
            slug,
            color,
            tag_categories (
              name,
              icon
            )
          `)
          .order("name");

        if (!error && data) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const formattedTags: TagData[] = (data as any[]).map((t) => ({
            id: t.id,
            name: t.name,
            slug: t.slug,
            color: t.color,
            category_name: t.tag_categories?.name || "Other",
            category_icon: t.tag_categories?.icon || "🏷️",
          }));
          setAllTags(formattedTags);
        }
      } catch (err) {
        console.error("Error fetching tags:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchTags();
  }, []);

  // Update selectedTags when tags prop changes
  useEffect(() => {
    setSelectedTags(tags || []);
  }, [tags]);

  const filteredTags = allTags.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !selectedTags.includes(t.name)
  );

  // Group filtered tags by category
  const groupedTags = filteredTags.reduce((acc, tag) => {
    if (!acc[tag.category_name]) {
      acc[tag.category_name] = { icon: tag.category_icon, tags: [] };
    }
    acc[tag.category_name].tags.push(tag);
    return acc;
  }, {} as Record<string, { icon: string; tags: TagData[] }>);

  const addTag = (tagName: string) => {
    const newTags = [...selectedTags, tagName];
    setSelectedTags(newTags);
    onChange?.(newTags);
    setSearchQuery("");
  };

  const removeTag = (tagName: string) => {
    const newTags = selectedTags.filter((t) => t !== tagName);
    setSelectedTags(newTags);
    onChange?.(newTags);
  };

  const getTagColor = (tagName: string) => {
    const tag = allTags.find((t) => t.name === tagName);
    return tag?.color || COLORS.neonGreen;
  };

  if (!editable) {
    if (!tags || tags.length === 0) {
      return <div style={{ color: COLORS.textSecondary }}>No tags</div>;
    }
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {tags.map((tag, i) => (
          <span
            key={i}
            style={{
              padding: "6px 14px",
              background: `${getTagColor(tag)}20`,
              borderRadius: 100,
              fontSize: 12,
              border: `1px solid ${getTagColor(tag)}40`,
              color: getTagColor(tag),
            }}
          >
            {tag}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Selected Tags */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        {selectedTags.map((tag, i) => (
          <span
            key={i}
            style={{
              padding: "6px 12px",
              background: `${getTagColor(tag)}20`,
              borderRadius: 100,
              fontSize: 12,
              border: `1px solid ${getTagColor(tag)}40`,
              color: getTagColor(tag),
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {tag}
            <button
              onClick={() => removeTag(tag)}
              style={{
                background: "none",
                border: "none",
                color: getTagColor(tag),
                cursor: "pointer",
                padding: 0,
                fontSize: 14,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </span>
        ))}
      </div>

      {/* Search Input */}
      <div style={{ position: "relative" }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          placeholder="Search tags..."
          style={{
            width: "100%",
            padding: "12px 14px",
            border: "1px solid " + COLORS.cardBorder,
            borderRadius: 8,
            fontSize: 13,
            background: COLORS.darkBg,
            color: COLORS.textPrimary,
          }}
        />
        <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: COLORS.neonBlue }}>🔍</span>

        {/* Dropdown */}
        {showDropdown && (searchQuery || filteredTags.length > 0) && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              marginTop: 8,
              background: COLORS.cardBg,
              border: "1px solid " + COLORS.cardBorder,
              borderRadius: 12,
              maxHeight: 300,
              overflowY: "auto",
              zIndex: 100,
              boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
            }}
          >
            {loading ? (
              <div style={{ padding: 20, textAlign: "center", color: COLORS.textSecondary }}>Loading tags...</div>
            ) : Object.keys(groupedTags).length > 0 ? (
              Object.entries(groupedTags).map(([category, { icon, tags: categoryTags }]) => (
                <div key={category}>
                  <div
                    style={{
                      padding: "8px 14px",
                      background: COLORS.darkBg,
                      fontSize: 10,
                      fontWeight: 700,
                      color: COLORS.textSecondary,
                      textTransform: "uppercase",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span>{icon}</span> {category}
                  </div>
                  {categoryTags.map((tag) => (
                    <div
                      key={tag.id}
                      onClick={() => addTag(tag.name)}
                      style={{
                        padding: "10px 14px",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        borderBottom: "1px solid " + COLORS.cardBorder,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.darkBg)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <span style={{ color: tag.color || COLORS.textPrimary }}>{tag.name}</span>
                      <span style={{ fontSize: 11, color: COLORS.neonGreen }}>+ Add</span>
                    </div>
                  ))}
                </div>
              ))
            ) : searchQuery ? (
              <div style={{ padding: 20, textAlign: "center", color: COLORS.textSecondary }}>
                No tags found matching "{searchQuery}"
              </div>
            ) : (
              <div style={{ padding: 20, textAlign: "center", color: COLORS.textSecondary }}>
                Start typing to search tags
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ marginTop: 12, fontSize: 11, color: COLORS.textSecondary, textAlign: "right" }}>
        Tags are managed in Supabase • {allTags.length} available
      </div>

      {/* Click outside to close */}
      {showDropdown && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 99 }}
          onClick={() => setShowDropdown(false)}
        />
      )}
    </div>
  );
}

// ==================== MEDIA GRID COMPONENT ====================
interface MediaItem {
  name?: string;
  url?: string;
}

interface MediaGridProps {
  items: (MediaItem | null | undefined)[] | null | undefined;
  onPreview?: (preview: { url: string; type: string }) => void;
}

export function MediaGrid({ items, onPreview }: MediaGridProps) {
  const validItems = items?.filter((item): item is MediaItem => !!item && !!item.url) || [];

  if (validItems.length === 0) {
    return (
      <div style={{ color: COLORS.textSecondary, padding: 20, textAlign: "center" }}>
        No media uploaded
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
      {validItems.map((item, i) => {
        const isVideo = item.url?.includes(".mp4") || item.name?.includes(".mp4");
        return (
          <div
            key={i}
            onClick={() => onPreview?.({ url: item.url!, type: isVideo ? "video" : "image" })}
            style={{
              cursor: "pointer",
              borderRadius: 12,
              overflow: "hidden",
              border: "2px solid " + COLORS.cardBorder,
              aspectRatio: "1",
              position: "relative",
              transition: "transform 0.2s, border-color 0.2s",
            }}
          >
            {isVideo ? (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  background: COLORS.darkBg,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ fontSize: 40, color: COLORS.neonPink }}>▶</span>
                <span style={{ fontSize: 10, color: COLORS.textSecondary, marginTop: 8 }}>Video</span>
              </div>
            ) : (
              <img
                src={item.url}
                alt={item.name || ""}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            )}
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                background: "linear-gradient(transparent, rgba(0,0,0,0.8))",
                padding: "20px 8px 8px",
                fontSize: 10,
                color: "#fff",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {item.name}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ==================== PREVIEW MODAL COMPONENT ====================
interface PreviewModalProps {
  preview: { url: string; type?: string } | null;
  onClose: () => void;
}

export function PreviewModal({ preview, onClose }: PreviewModalProps) {
  if (!preview) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.95)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div style={{ maxWidth: "90vw", maxHeight: "90vh", position: "relative" }} onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: -50,
            right: 0,
            background: COLORS.gradient1,
            border: "none",
            borderRadius: "50%",
            width: 44,
            height: 44,
            cursor: "pointer",
            fontSize: 22,
            color: "#fff",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ×
        </button>
        {preview.type === "video" ? (
          <video
            src={preview.url}
            controls
            autoPlay
            style={{ maxWidth: "90vw", maxHeight: "85vh", borderRadius: 16 }}
          />
        ) : (
          <img src={preview.url} alt="" style={{ maxWidth: "90vw", maxHeight: "85vh", borderRadius: 16 }} />
        )}
      </div>
    </div>
  );
}

// ==================== DATA TABLE COMPONENT ====================
interface DataTableColumn {
  key: string;
  label: string;
  align?: "left" | "center" | "right";
  render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode;
}

interface DataTableProps {
  columns: DataTableColumn[];
  data: unknown[];
  onRowClick?: (row: Record<string, unknown>) => void;
}

export function DataTable({ columns, data, onRowClick }: DataTableProps) {
  const tableData = data as Record<string, unknown>[];
  if (!tableData || tableData.length === 0) {
    return <div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary }}>No data available</div>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid " + COLORS.cardBorder }}>
            {columns.map((col, i) => (
              <th
                key={i}
                style={{
                  textAlign: col.align || "left",
                  padding: "14px 12px",
                  fontSize: 11,
                  color: COLORS.textSecondary,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tableData.map((row, i) => (
            <tr
              key={i}
              onClick={() => onRowClick?.(row)}
              style={{
                borderBottom: "1px solid " + COLORS.cardBorder,
                cursor: onRowClick ? "pointer" : "default",
                transition: "background 0.2s",
              }}
            >
              {columns.map((col, j) => (
                <td key={j} style={{ textAlign: col.align || "left", padding: "14px 12px", fontSize: 13 }}>
                  {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ==================== CONFIRM MODAL COMPONENT ====================
interface ConfirmModalProps {
  title: string;
  message: string;
  type?: "info" | "warning" | "danger";
  confirmText?: string;
  /** When set, user must type this exact text to enable the Confirm button */
  requireText?: string;
  onClose: () => void;
  onConfirm: () => void;
}

export function ConfirmModal({ title, message, type = "info", confirmText = "Confirm", requireText, onClose, onConfirm }: ConfirmModalProps) {
  const [typedText, setTypedText] = useState("");
  const colors = {
    info: { bg: COLORS.gradient1, color: "#fff" },
    warning: { bg: "linear-gradient(135deg, #ffff00, #ff6b35)", color: "#000" },
    danger: { bg: "linear-gradient(135deg, #ff3131, #990000)", color: "#fff" },
  };
  const c = colors[type];
  const confirmEnabled = !requireText || typedText === requireText;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: COLORS.cardBg,
          borderRadius: 20,
          padding: 32,
          maxWidth: 450,
          width: "90%",
          border: "1px solid " + COLORS.cardBorder,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>{title}</h2>
        <p style={{ color: COLORS.textSecondary, marginBottom: 24, lineHeight: 1.6 }}>{message}</p>
        {requireText && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 12, color: COLORS.textSecondary, marginBottom: 8 }}>
              Type <strong style={{ color: COLORS.neonRed }}>{requireText}</strong> to confirm:
            </label>
            <input
              type="text"
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
              placeholder={requireText}
              autoFocus
              style={{
                width: "100%",
                padding: "10px 14px",
                background: COLORS.darkBg,
                border: typedText === requireText ? "2px solid " + COLORS.neonGreen : "1px solid " + COLORS.cardBorder,
                borderRadius: 8,
                color: COLORS.textPrimary,
                fontSize: 14,
                outline: "none",
              }}
            />
          </div>
        )}
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              padding: "12px 24px",
              background: COLORS.darkBg,
              border: "1px solid " + COLORS.cardBorder,
              borderRadius: 10,
              color: COLORS.textPrimary,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Cancel
          </button>
          <button
            disabled={!confirmEnabled}
            onClick={() => {
              if (!confirmEnabled) return;
              onConfirm();
              onClose();
            }}
            style={{
              padding: "12px 24px",
              background: confirmEnabled ? c.bg : COLORS.darkBg,
              border: confirmEnabled ? "none" : "1px solid " + COLORS.cardBorder,
              borderRadius: 10,
              color: confirmEnabled ? c.color : COLORS.textSecondary,
              cursor: confirmEnabled ? "pointer" : "not-allowed",
              fontWeight: 700,
              opacity: confirmEnabled ? 1 : 0.5,
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== TIME PERIOD SELECTOR ====================
interface TimePeriodSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export function TimePeriodSelector({ value, onChange }: TimePeriodSelectorProps) {
  return (
    <div style={{ display: "flex", gap: 4, background: COLORS.darkBg, padding: 4, borderRadius: 10 }}>
      {["day", "week", "month", "year"].map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          style={{
            padding: "6px 12px",
            borderRadius: 6,
            border: "none",
            cursor: "pointer",
            fontSize: 11,
            fontWeight: 600,
            textTransform: "uppercase",
            background: value === p ? COLORS.gradient1 : "transparent",
            color: value === p ? "#fff" : COLORS.textSecondary,
          }}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

// ==================== DETAIL ROW COMPONENT ====================
interface DetailRowProps {
  label: string;
  value: unknown;
}

export function DetailRow({ label, value }: DetailRowProps) {
  const displayValue = value === null || value === undefined || value === "" ? "—" : String(value);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "10px 0",
        borderBottom: "1px solid " + COLORS.cardBorder,
      }}
    >
      <span style={{ fontSize: 12, color: COLORS.textSecondary }}>{label}</span>
      <span style={{ fontSize: 13, color: COLORS.textPrimary, textAlign: "right" }}>{displayValue}</span>
    </div>
  );
}

// ==================== COLLAPSIBLE SECTION ====================
interface CollapsibleSectionProps {
  title: string;
  icon?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function CollapsibleSection({ title, icon, defaultOpen = true, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{ marginBottom: 24 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          width: "100%",
          padding: "16px 0",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          borderBottom: "1px solid " + COLORS.cardBorder,
        }}
      >
        {icon && <span style={{ fontSize: 20 }}>{icon}</span>}
        <span style={{ fontSize: 16, fontWeight: 600, color: COLORS.textPrimary }}>{title}</span>
        <span
          style={{
            marginLeft: "auto",
            color: COLORS.textSecondary,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
          }}
        >
          ▼
        </span>
      </button>
      {open && <div style={{ paddingTop: 16 }}>{children}</div>}
    </div>
  );
}

// ==================== DOWNLOAD FUNCTIONS ====================
export function downloadCSV(data: Record<string, unknown>[], filename: string) {
  if (!data || data.length === 0) return;
  const headers = Object.keys(data[0]).join(",");
  const rows = data
    .map((row) =>
      Object.values(row)
        .map((v) => (typeof v === "object" ? JSON.stringify(v).replace(/,/g, ";") : v))
        .join(",")
    )
    .join("\n");
  const blob = new Blob([headers + "\n" + rows], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename + ".csv";
  a.click();
}

export function downloadXLSX(data: Record<string, unknown>[], filename: string) {
  if (!data || data.length === 0) return;
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, filename + ".xlsx");
}

// ==================== EXPORT BUTTONS ====================
interface ExportButtonsProps {
  data: unknown[];
  filename: string;
}

export function ExportButtons({ data, filename }: ExportButtonsProps) {
  const exportData = data as Record<string, unknown>[];
  return (
    <div style={{ display: "flex", gap: 4 }}>
      <button
        onClick={() => downloadCSV(exportData, filename)}
        style={{
          padding: "6px 10px",
          background: COLORS.darkBg,
          border: "1px solid " + COLORS.cardBorder,
          borderRadius: 6,
          color: COLORS.textSecondary,
          fontSize: 10,
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        CSV
      </button>
      <button
        onClick={() => downloadXLSX(exportData, filename)}
        style={{
          padding: "6px 10px",
          background: COLORS.darkBg,
          border: "1px solid " + COLORS.cardBorder,
          borderRadius: 6,
          color: COLORS.textSecondary,
          fontSize: 10,
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        XLSX
      </button>
    </div>
  );
}

// ==================== FILTER PANEL ====================
interface FilterOption {
  value: string;
  label: string;
}

interface FilterConfig {
  key: string;
  label: string;
  type: "text" | "select" | "date" | "number";
  value: string;
  placeholder?: string;
  options?: FilterOption[];
}

interface FilterPanelProps {
  filters: FilterConfig[];
  onFilterChange: (key: string, value: string) => void;
  expanded: boolean;
  onToggle: () => void;
}

export function FilterPanel({ filters, onFilterChange, expanded, onToggle }: FilterPanelProps) {
  return (
    <div style={{ background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 12, marginBottom: 20 }}>
      <button
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          width: "100%",
          padding: 16,
          background: "transparent",
          border: "none",
          cursor: "pointer",
        }}
      >
        <span style={{ fontSize: 18 }}>🔍</span>
        <span style={{ fontWeight: 600, color: COLORS.textPrimary }}>Advanced Filters</span>
        <span style={{ marginLeft: "auto", color: COLORS.textSecondary, fontSize: 12 }}>
          {expanded ? "▲ Hide" : "▼ Show"}
        </span>
      </button>
      {expanded && (
        <div
          style={{
            padding: "0 16px 16px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          {filters.map((f, i) => (
            <div key={i}>
              <label
                style={{
                  display: "block",
                  fontSize: 10,
                  color: COLORS.textSecondary,
                  marginBottom: 4,
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}
              >
                {f.label}
              </label>
              {f.type === "select" ? (
                <select
                  value={f.value}
                  onChange={(e) => onFilterChange(f.key, e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid " + COLORS.cardBorder,
                    borderRadius: 8,
                    fontSize: 12,
                    background: COLORS.darkBg,
                    color: COLORS.textPrimary,
                  }}
                >
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={f.type || "text"}
                  value={f.value}
                  onChange={(e) => onFilterChange(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid " + COLORS.cardBorder,
                    borderRadius: 8,
                    fontSize: 12,
                    background: COLORS.darkBg,
                    color: COLORS.textPrimary,
                  }}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}