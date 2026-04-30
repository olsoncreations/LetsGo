"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import {
  COLORS,
  Badge,
  Card,
  SectionTitle,
  EditField,
  HoursGrid,
  TiersDisplay,
  Checklist,
  MediaGrid,
  PreviewModal,
  ConfirmModal,
  formatDateTime,
  getHoursSince,
  formatMoney,
} from "@/components/admin/components";
import { logAudit, AUDIT_TABS } from "@/lib/auditLog";
import { fetchTagsByCategory, type TagCategory } from "@/lib/availableTags";

/* ==================== TYPES ==================== */

interface Submission {
  id: string;
  created_at: string;
  status: string;
  business_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  user_id: string | null;
  payload: Record<string, unknown>;
  review_message: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_history: ReviewHistoryEntry[] | null;
  staff_notes: OnboardingStaffNote[] | null;
}

interface ReviewHistoryEntry {
  action: string;
  message: string;
  by: string;
  at: string;
}

interface OnboardingStaffNote {
  id: string;
  author_name: string;
  note: string;
  pinned: boolean;
  created_at: string;
}

type StatusFilter = "all" | "pending_review" | "submitted" | "approved" | "rejected" | "needs_changes";

/* ==================== ADS CATALOG ==================== */

const ADS_CATALOG = [
  { id: "ad_1day", title: "1-Day Spotlight", price: 9900, description: "Featured placement for 24 hours" },
  { id: "ad_7day", title: "7-Day Spotlight", price: 59900, description: "Featured placement for 1 week" },
  { id: "ad_14day", title: "14-Day Spotlight", price: 99900, description: "Featured placement for 2 weeks" },
  { id: "ad_100mile", title: "100 Mile Wide Push", price: 259900, description: "Push notification to all users within 100 miles" },
  { id: "ad_tour", title: "Tour Wide Push", price: 459900, description: "Push notification to all users on platform" },
];

/* ==================== ADVANCED FILTERS ==================== */

interface AdvancedFilters {
  business: string;
  zipCode: string;
  phone: string;
  dateFrom: string;
  dateTo: string;
}

const EMPTY_FILTERS: AdvancedFilters = { business: "", zipCode: "", phone: "", dateFrom: "", dateTo: "" };

/* ==================== GEOCODING ==================== */

interface GeocodedAddress {
  streetAddress: string;
  city: string;
  state: string;
  zip: string;
  formatted: string;
  lat: number;
  lng: number;
}

async function geocodeAddress(street: string, city: string, state: string, zip: string): Promise<GeocodedAddress[]> {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) return [];

  const inputAddress = `${street}, ${city}, ${state} ${zip}`.replace(/\s+/g, " ").trim();
  if (!inputAddress || inputAddress === ", ,") return [];

  // Layer 1: Address Validation API (handles typos, corrections, standardization)
  try {
    const validationUrl = `https://addressvalidation.googleapis.com/v1:validateAddress?key=${key}`;
    const validationRes = await fetch(validationUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address: {
          addressLines: [street],
          locality: city,
          administrativeArea: state,
          postalCode: zip,
          regionCode: "US",
        },
      }),
    });
    const validationData = await validationRes.json();
    if (validationData.result) {
      const result = validationData.result;
      const postalAddr = result.address?.postalAddress;
      const location = result.geocode?.location;
      const verdict = result.verdict;

      if (postalAddr && location) {
        const lines = postalAddr.addressLines || [];
        const suggestion: GeocodedAddress = {
          streetAddress: lines[0] || street,
          city: postalAddr.locality || city,
          state: postalAddr.administrativeArea || state,
          zip: (postalAddr.postalCode || zip).split("-")[0],
          formatted: result.address?.formattedAddress || `${lines[0]}, ${postalAddr.locality}, ${postalAddr.administrativeArea} ${postalAddr.postalCode}`,
          lat: location.latitude,
          lng: location.longitude,
        };

        const confidence = verdict?.validationGranularity || "UNKNOWN";
        const hasInferred = verdict?.hasInferredComponents || false;
        const hasReplaced = verdict?.hasReplacedComponents || false;
        return [suggestion];
      }
    }
  } catch (err) {
    // Address Validation API not available, fall back to Geocoding
  }

  // Layer 2: Standard Geocoding API fallback (progressive queries)
  const queries = [
    inputAddress,
    `${street}, ${city}, ${state}`,
    `${street.replace(/^\d+\s*/, "")}, ${city}, ${state} ${zip}`,
    `${city}, ${state}`,
  ].filter((q, i, arr) => q && q !== ", " && q !== ", ," && arr.indexOf(q) === i);

  for (const query of queries) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${key}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === "OK" && data.results?.length) {
        return data.results.slice(0, 3).map((result: { address_components: { long_name: string; short_name: string; types: string[] }[]; formatted_address: string; geometry: { location: { lat: number; lng: number } } }) => {
          const components = result.address_components;
          const get = (type: string) => components.find((c) => c.types.includes(type));
          const streetNumber = get("street_number")?.long_name || "";
          const route = get("route")?.long_name || "";
          return {
            streetAddress: (streetNumber + " " + route).trim() || street,
            city: get("locality")?.long_name || get("sublocality")?.long_name || city,
            state: get("administrative_area_level_1")?.short_name || state,
            zip: get("postal_code")?.long_name || zip,
            formatted: result.formatted_address,
            lat: result.geometry.location.lat,
            lng: result.geometry.location.lng,
          };
        });
      }
    } catch (err) {
      console.error("Geocode error:", err);
    }
  }

  return [];
}

/* ==================== BULK IMPORT REVIEW MODAL ==================== */

interface BulkImportRow {
  name: string;
  email: string;
  payload: Record<string, unknown>;
  original: { street: string; city: string; state: string; zip: string };
  suggestions: GeocodedAddress[];
  selectedIdx: number; // -1 = use original, 0+ = use suggestion at index
}

function BulkImportReviewModal({
  rows,
  onClose,
  onConfirm,
}: {
  rows: BulkImportRow[];
  onClose: () => void;
  onConfirm: (rows: BulkImportRow[]) => void;
}) {
  const [reviewRows, setReviewRows] = useState<BulkImportRow[]>(rows);

  function selectOption(rowIdx: number, selectedIdx: number) {
    setReviewRows((prev) =>
      prev.map((r, i) => (i === rowIdx ? { ...r, selectedIdx } : r))
    );
  }

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
          maxWidth: 950,
          width: "95%",
          maxHeight: "85vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          border: "1px solid " + COLORS.cardBorder,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, background: COLORS.gradient1, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          📍 Address Verification Review
        </h2>
        <p style={{ color: COLORS.textSecondary, marginBottom: 20, fontSize: 13 }}>
          Select the correct address for each business. Click a suggestion to use it, or keep the original.
        </p>

        <div style={{ flex: 1, overflowY: "auto", marginBottom: 20 }}>
          {reviewRows.map((row, rowIdx) => {
            const hasSuggestions = row.suggestions.length > 0;

            return (
              <div
                key={rowIdx}
                style={{
                  padding: 16,
                  marginBottom: 12,
                  background: COLORS.darkBg,
                  borderRadius: 12,
                  border: !hasSuggestions
                    ? "1px solid " + COLORS.neonRed
                    : row.selectedIdx >= 0
                    ? "1px solid " + COLORS.neonGreen
                    : "1px solid " + COLORS.cardBorder,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{row.name}</span>
                  {!hasSuggestions && (
                    <span style={{ fontSize: 11, color: COLORS.neonRed, fontWeight: 600 }}>⚠️ Could not verify — will use original</span>
                  )}
                  {hasSuggestions && row.selectedIdx === -1 && (
                    <span style={{ fontSize: 11, color: COLORS.neonYellow, fontWeight: 600 }}>Using original address</span>
                  )}
                  {hasSuggestions && row.selectedIdx >= 0 && (
                    <span style={{ fontSize: 11, color: COLORS.neonGreen, fontWeight: 600 }}>✓ Verified address selected</span>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {/* Original address option */}
                  <div
                    onClick={() => selectOption(rowIdx, -1)}
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      background: row.selectedIdx === -1 ? "rgba(255,255,0,0.08)" : "transparent",
                      border: row.selectedIdx === -1 ? "2px solid " + COLORS.neonYellow : "1px solid " + COLORS.cardBorder,
                    }}
                  >
                    <div style={{
                      width: 18, height: 18, borderRadius: 9,
                      border: row.selectedIdx === -1 ? "2px solid " + COLORS.neonYellow : "2px solid " + COLORS.textSecondary,
                      background: row.selectedIdx === -1 ? COLORS.neonYellow : "transparent",
                      flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {row.selectedIdx === -1 && <div style={{ width: 8, height: 8, borderRadius: 4, background: "#000" }} />}
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: COLORS.textSecondary, textTransform: "uppercase", marginBottom: 2, fontWeight: 600 }}>Original (as entered)</div>
                      <div style={{ fontSize: 13, color: row.selectedIdx === -1 ? COLORS.textPrimary : COLORS.textSecondary }}>
                        {row.original.street}, {row.original.city}, {row.original.state} {row.original.zip}
                      </div>
                    </div>
                  </div>

                  {/* Google suggestions */}
                  {row.suggestions.map((sug, sugIdx) => (
                    <div
                      key={sugIdx}
                      onClick={() => selectOption(rowIdx, sugIdx)}
                      style={{
                        padding: 12,
                        borderRadius: 8,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        background: row.selectedIdx === sugIdx ? "rgba(57,255,20,0.08)" : "transparent",
                        border: row.selectedIdx === sugIdx ? "2px solid " + COLORS.neonGreen : "1px solid " + COLORS.cardBorder,
                      }}
                    >
                      <div style={{
                        width: 18, height: 18, borderRadius: 9,
                        border: row.selectedIdx === sugIdx ? "2px solid " + COLORS.neonGreen : "2px solid " + COLORS.textSecondary,
                        background: row.selectedIdx === sugIdx ? COLORS.neonGreen : "transparent",
                        flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {row.selectedIdx === sugIdx && <div style={{ width: 8, height: 8, borderRadius: 4, background: "#000" }} />}
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: COLORS.neonGreen, textTransform: "uppercase", marginBottom: 2, fontWeight: 600 }}>
                          📍 Google Suggestion {row.suggestions.length > 1 ? sugIdx + 1 : ""}
                        </div>
                        <div style={{ fontSize: 13, color: row.selectedIdx === sugIdx ? COLORS.neonGreen : COLORS.textSecondary }}>
                          {sug.formatted}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

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
            Cancel Import
          </button>
          <button
            onClick={() => onConfirm(reviewRows)}
            style={{
              padding: "12px 24px",
              background: COLORS.gradient2,
              border: "none",
              borderRadius: 10,
              color: "#000",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            ✓ Import {reviewRows.length} Business{reviewRows.length !== 1 ? "es" : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ==================== ADDRESS VERIFY MODAL (single) ==================== */

function AddressVerifyModal({
  original,
  suggestions,
  onClose,
  onAccept,
  onRevert,
}: {
  original: { street: string; city: string; state: string; zip: string };
  suggestions: GeocodedAddress[];
  onClose: () => void;
  onAccept: (addr: GeocodedAddress) => void;
  onRevert: () => void;
}) {
  const [selectedIdx, setSelectedIdx] = useState<number>(suggestions.length > 0 ? 0 : -1);
  const [manualQuery, setManualQuery] = useState("");
  const [manualResults, setManualResults] = useState<GeocodedAddress[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedManualIdx, setSelectedManualIdx] = useState<number | null>(null);
  const noSuggestions = suggestions.length === 0;

  async function handleManualSearch() {
    if (!manualQuery.trim()) return;
    setSearching(true);
    setSelectedManualIdx(null);
    try {
      const results = await geocodeAddress(
        manualQuery.trim(),
        "", "", ""
      );
      // If that returns nothing, try treating it as a full address string
      if (results.length === 0) {
        const parts = manualQuery.split(",").map((s) => s.trim());
        if (parts.length >= 2) {
          const r2 = await geocodeAddress(parts[0], parts[1], parts[2] || "", parts[3] || "");
          setManualResults(r2);
        } else {
          setManualResults([]);
        }
      } else {
        setManualResults(results);
      }
    } catch {
      setManualResults([]);
    } finally {
      setSearching(false);
    }
  }

  function handleSelectManual(idx: number) {
    setSelectedManualIdx(idx);
    setSelectedIdx(-2); // -2 = using manual result
  }

  function handleSelectOriginal() {
    setSelectedIdx(-1);
    setSelectedManualIdx(null);
  }

  function handleSelectSuggestion(idx: number) {
    setSelectedIdx(idx);
    setSelectedManualIdx(null);
  }

  const activeAddr = selectedManualIdx !== null && manualResults[selectedManualIdx]
    ? manualResults[selectedManualIdx]
    : selectedIdx >= 0 && suggestions[selectedIdx]
    ? suggestions[selectedIdx]
    : null;

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
          maxWidth: 650,
          width: "90%",
          maxHeight: "85vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          border: "1px solid " + COLORS.cardBorder,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, color: noSuggestions ? COLORS.neonRed : COLORS.neonBlue }}>
          {noSuggestions ? "📍 Could Not Verify Address" : "📍 Address Verification"}
        </h2>

        <div style={{ flex: 1, overflowY: "auto", marginBottom: 20 }}>
          {noSuggestions && (
            <div style={{ padding: 14, background: "rgba(255,49,49,0.1)", borderRadius: 10, marginBottom: 16, textAlign: "center" }}>
              <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 13 }}>⚠️ Google Maps couldn&apos;t verify the entered address</div>
              <div style={{ fontSize: 12, color: COLORS.textSecondary }}>Use the search below to find the correct address, or keep the original.</div>
            </div>
          )}

          {!noSuggestions && (
            <p style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 14 }}>
              Google Maps found {suggestions.length} result{suggestions.length > 1 ? "s" : ""}. Select the correct address or search for a different one:
            </p>
          )}

          {/* Original address option */}
          <div
            onClick={handleSelectOriginal}
            style={{
              padding: 14,
              borderRadius: 10,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 8,
              background: selectedIdx === -1 ? "rgba(255,255,0,0.08)" : "transparent",
              border: selectedIdx === -1 ? "2px solid " + COLORS.neonYellow : "1px solid " + COLORS.cardBorder,
            }}
          >
            <div style={{
              width: 20, height: 20, borderRadius: 10,
              border: selectedIdx === -1 ? "2px solid " + COLORS.neonYellow : "2px solid " + COLORS.textSecondary,
              background: selectedIdx === -1 ? COLORS.neonYellow : "transparent",
              flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {selectedIdx === -1 && <div style={{ width: 8, height: 8, borderRadius: 4, background: "#000" }} />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: COLORS.neonYellow, textTransform: "uppercase", marginBottom: 3, fontWeight: 700 }}>Original (keep as-is)</div>
              <div style={{ fontSize: 14, color: selectedIdx === -1 ? COLORS.textPrimary : COLORS.textSecondary }}>
                {original.street}
              </div>
              <div style={{ fontSize: 13, color: selectedIdx === -1 ? COLORS.textPrimary : COLORS.textSecondary }}>
                {original.city}, {original.state} {original.zip}
              </div>
            </div>
          </div>

          {/* Google suggestions */}
          {suggestions.map((sug, sugIdx) => {
            const isExact =
              sug.streetAddress === original.street &&
              sug.city === original.city &&
              sug.state === original.state &&
              sug.zip === original.zip;

            return (
              <div
                key={sugIdx}
                onClick={() => handleSelectSuggestion(sugIdx)}
                style={{
                  padding: 14,
                  borderRadius: 10,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 8,
                  background: selectedIdx === sugIdx ? "rgba(57,255,20,0.08)" : "transparent",
                  border: selectedIdx === sugIdx ? "2px solid " + COLORS.neonGreen : "1px solid " + COLORS.cardBorder,
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: 10,
                  border: selectedIdx === sugIdx ? "2px solid " + COLORS.neonGreen : "2px solid " + COLORS.textSecondary,
                  background: selectedIdx === sugIdx ? COLORS.neonGreen : "transparent",
                  flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {selectedIdx === sugIdx && <div style={{ width: 8, height: 8, borderRadius: 4, background: "#000" }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: COLORS.neonGreen, textTransform: "uppercase", marginBottom: 3, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                    📍 Google Suggestion {suggestions.length > 1 ? sugIdx + 1 : ""}
                    {isExact && <span style={{ fontSize: 9, background: "rgba(57,255,20,0.2)", padding: "1px 6px", borderRadius: 4 }}>✓ Exact Match</span>}
                  </div>
                  <div style={{ fontSize: 14, color: selectedIdx === sugIdx ? COLORS.neonGreen : COLORS.textSecondary }}>
                    {sug.streetAddress}
                  </div>
                  <div style={{ fontSize: 13, color: selectedIdx === sugIdx ? COLORS.neonGreen : COLORS.textSecondary }}>
                    {sug.city}, {sug.state} {sug.zip}
                  </div>
                  <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 2, fontStyle: "italic" }}>
                    {sug.formatted}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Manual search */}
          <div style={{ marginTop: 16, padding: 16, background: COLORS.darkBg, borderRadius: 12, border: "1px solid " + COLORS.cardBorder }}>
            <div style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>
              🔍 Search for a different address
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                placeholder="Type an address..."
                value={manualQuery}
                onChange={(e) => setManualQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleManualSearch(); }}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  background: COLORS.cardBg,
                  border: "1px solid " + COLORS.cardBorder,
                  borderRadius: 8,
                  color: COLORS.textPrimary,
                  fontSize: 13,
                  outline: "none",
                }}
              />
              <button
                onClick={handleManualSearch}
                disabled={searching || !manualQuery.trim()}
                style={{
                  padding: "10px 16px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: searching ? "wait" : "pointer",
                  background: COLORS.neonBlue,
                  border: "none",
                  color: "#000",
                  opacity: searching || !manualQuery.trim() ? 0.5 : 1,
                }}
              >
                {searching ? "..." : "Search"}
              </button>
            </div>

            {/* Manual search results */}
            {manualResults.length > 0 && (
              <div style={{ marginTop: 10 }}>
                {manualResults.map((res, resIdx) => (
                  <div
                    key={resIdx}
                    onClick={() => handleSelectManual(resIdx)}
                    style={{
                      padding: 10,
                      borderRadius: 8,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginBottom: 4,
                      background: selectedManualIdx === resIdx ? "rgba(0,212,255,0.08)" : "transparent",
                      border: selectedManualIdx === resIdx ? "2px solid " + COLORS.neonBlue : "1px solid " + COLORS.cardBorder,
                    }}
                  >
                    <div style={{
                      width: 18, height: 18, borderRadius: 9,
                      border: selectedManualIdx === resIdx ? "2px solid " + COLORS.neonBlue : "2px solid " + COLORS.textSecondary,
                      background: selectedManualIdx === resIdx ? COLORS.neonBlue : "transparent",
                      flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {selectedManualIdx === resIdx && <div style={{ width: 8, height: 8, borderRadius: 4, background: "#000" }} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: selectedManualIdx === resIdx ? COLORS.neonBlue : COLORS.textSecondary }}>
                        📍 {res.formatted}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {manualResults.length === 0 && manualQuery && !searching && (
              <div style={{ marginTop: 8, fontSize: 11, color: COLORS.textSecondary }}>No results. Try a different search.</div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{ padding: "10px 20px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, cursor: "pointer", fontWeight: 600 }}
          >
            Cancel
          </button>
          {selectedIdx === -1 && (
            <button
              onClick={() => { onRevert(); onClose(); }}
              style={{ padding: "10px 20px", background: "rgba(255,255,0,0.2)", border: "none", borderRadius: 10, color: COLORS.neonYellow, cursor: "pointer", fontWeight: 700 }}
            >
              Keep Original
            </button>
          )}
          {activeAddr && (
            <button
              onClick={() => { onAccept(activeAddr); onClose(); }}
              style={{ padding: "10px 20px", background: COLORS.gradient2, border: "none", borderRadius: 10, color: "#000", cursor: "pointer", fontWeight: 700 }}
            >
              ✓ Use This Address
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ==================== EMPTY STATE ==================== */

function EmptyState({ message }: { message: string }) {
  return <div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary }}>{message}</div>;
}

/* ==================== ACTION MODAL ==================== */

function OnboardingActionModal({
  type,
  submission,
  onClose,
  onConfirm,
}: {
  type: "reject" | "changes" | null;
  submission: Submission | null;
  onClose: () => void;
  onConfirm: (id: string, message: string) => void;
}) {
  const [message, setMessage] = useState("");

  if (!submission || !type) return null;

  const isReject = type === "reject";
  const p = submission.payload as Record<string, unknown>;

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
          maxWidth: 600,
          width: "90%",
          border: "1px solid " + COLORS.cardBorder,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          style={{
            fontSize: 24,
            fontWeight: 700,
            marginBottom: 8,
            color: isReject ? COLORS.neonRed : COLORS.neonYellow,
          }}
        >
          {isReject ? "❌ Reject Application" : "✏️ Request Changes"}
        </h2>
        <p style={{ color: COLORS.textSecondary, marginBottom: 24 }}>
          {isReject
            ? "This will permanently reject this business application. The business will be notified."
            : "Send feedback to the business about what needs to be changed before approval."}
        </p>
        <div
          style={{
            background: COLORS.darkBg,
            borderRadius: 12,
            padding: 16,
            marginBottom: 24,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ color: COLORS.textSecondary }}>Business:</span>
            <span style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
              {submission.business_name || (p.publicBusinessName as string)}
              {!!(p.claim_business_id) && (
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                  background: "rgba(57,255,20,0.15)", color: "#39ff14",
                  border: "1px solid rgba(57,255,20,0.3)",
                }}>
                  CLAIM
                </span>
              )}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ color: COLORS.textSecondary }}>Contact:</span>
            <span style={{ fontWeight: 600 }}>{submission.contact_email || (p.email as string)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: COLORS.textSecondary }}>Plan:</span>
            <Badge status={(p.plan as string) || "basic"} />
          </div>
        </div>
        <label
          style={{
            display: "block",
            fontSize: 12,
            color: COLORS.textSecondary,
            marginBottom: 8,
            fontWeight: 600,
            textTransform: "uppercase",
          }}
        >
          {isReject ? "Rejection Reason" : "Requested Changes"}{" "}
          <span style={{ color: COLORS.neonRed }}>*</span>
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={
            isReject
              ? "Explain why this application is being rejected..."
              : "List the specific changes needed before this application can be approved..."
          }
          style={{
            width: "100%",
            padding: 16,
            border: "1px solid " + COLORS.cardBorder,
            borderRadius: 12,
            fontSize: 14,
            background: COLORS.darkBg,
            color: COLORS.textPrimary,
            minHeight: 140,
            marginBottom: 24,
            resize: "vertical",
          }}
        />
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
            onClick={() => {
              if (message.trim()) {
                onConfirm(submission.id, message);
                onClose();
              } else {
                alert("Please enter the required details");
              }
            }}
            style={{
              padding: "12px 24px",
              background: isReject ? "linear-gradient(135deg, #ff3131, #990000)" : "linear-gradient(135deg, #ffff00, #ff6b35)",
              border: "none",
              borderRadius: 10,
              color: isReject ? "#fff" : "#000",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            {isReject ? "Reject Application" : "Send Change Request"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ==================== MAIN PAGE ==================== */

export default function OnboardingPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      if (!session?.user) { router.replace("/admin/login"); return; }
      const { data: staff } = await supabaseBrowser.from("staff_users").select("user_id").eq("user_id", session.user.id).maybeSingle();
      if (!staff) { router.replace("/admin/login"); return; }
      setAuthChecked(true);
    })();
  }, [router]);

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [onboardingSort, setOnboardingSort] = useState("desc"); // desc = newest first
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>(EMPTY_FILTERS);
  const [actionLoading, setActionLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editPayload, setEditPayload] = useState<Record<string, unknown>>({});
  const [newNote, setNewNote] = useState("");
  const [noteAuthor, setNoteAuthor] = useState("Staff");
  const [preview, setPreview] = useState<{ url: string; type: string } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    type: "info" | "warning" | "danger";
    confirmText: string;
    onConfirm: () => void;
  } | null>(null);
  const [onboardingAction, setOnboardingAction] = useState<{
    type: "reject" | "changes";
    submission: Submission;
  } | null>(null);
  const [bulkReviewRows, setBulkReviewRows] = useState<BulkImportRow[] | null>(null);
  const [geocodingProgress, setGeocodingProgress] = useState<string | null>(null);
  const [addressVerify, setAddressVerify] = useState<{
    original: { street: string; city: string; state: string; zip: string };
    suggestions: GeocodedAddress[];
  } | null>(null);
  const [verifyingAddress, setVerifyingAddress] = useState(false);

  // ─── Link to Existing Business (admin-side claim) ───
  const [linkSearch, setLinkSearch] = useState("");
  const [linkResults, setLinkResults] = useState<{ id: string; business_name: string; city: string; state: string; seeded_at: string | null; claim_code: string | null }[]>([]);
  const [linkSearching, setLinkSearching] = useState(false);
  const [linkedBusiness, setLinkedBusiness] = useState<{ id: string; business_name: string; city: string; state: string } | null>(null);

  const selected = submissions.find((s) => s.id === selectedId) || null;
  const p = (selected?.payload || {}) as Record<string, unknown>;

  // When selection changes, load linked business if claim_business_id exists in payload
  useEffect(() => {
    setLinkSearch("");
    setLinkResults([]);
    if (!selected) { setLinkedBusiness(null); return; }
    const claimId = (selected.payload as Record<string, unknown>).claim_business_id as string | undefined;
    if (!claimId) { setLinkedBusiness(null); return; }
    (async () => {
      const { data } = await supabaseBrowser
        .from("business")
        .select("id, business_name, city, state")
        .eq("id", claimId)
        .maybeSingle();
      if (data) setLinkedBusiness(data);
      else setLinkedBusiness(null);
    })();
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Search for existing businesses to link
  async function handleLinkSearch() {
    if (!linkSearch.trim()) return;
    setLinkSearching(true);
    try {
      const { data } = await supabaseBrowser
        .from("business")
        .select("id, business_name, city, state, seeded_at, claim_code")
        .ilike("business_name", `%${linkSearch.trim()}%`)
        .order("business_name")
        .limit(10);
      setLinkResults(data || []);
    } catch {
      setLinkResults([]);
    } finally {
      setLinkSearching(false);
    }
  }

  // Link a business to this submission (saves to payload immediately)
  async function handleLinkBusiness(biz: { id: string; business_name: string; city: string; state: string }) {
    if (!selected) return;
    setActionLoading(true);
    try {
      const updatedPayload = { ...selected.payload, claim_business_id: biz.id };
      const { error } = await supabaseBrowser
        .from("partner_onboarding_submissions")
        .update({ payload: updatedPayload })
        .eq("id", selected.id);
      if (error) { alert("Error linking business: " + error.message); return; }
      logAudit({
        action: "link_seed_business",
        tab: AUDIT_TABS.ONBOARDING,
        subTab: "Claim Link",
        targetType: "onboarding_submission",
        targetId: selected.id,
        entityName: selected.business_name || "",
        fieldName: "claim_business_id",
        oldValue: "",
        newValue: biz.id,
        details: `Linked onboarding submission to existing business "${biz.business_name}" (${biz.id})`,
      });
      setLinkedBusiness(biz);
      setLinkSearch("");
      setLinkResults([]);
      await fetchSubmissions();
    } catch (err) {
      console.error("Link error:", err);
    } finally {
      setActionLoading(false);
    }
  }

  // Unlink a business from this submission
  async function handleUnlinkBusiness() {
    if (!selected) return;
    setActionLoading(true);
    try {
      const payload = { ...selected.payload } as Record<string, unknown>;
      delete payload.claim_business_id;
      const { error } = await supabaseBrowser
        .from("partner_onboarding_submissions")
        .update({ payload })
        .eq("id", selected.id);
      if (error) { alert("Error unlinking: " + error.message); return; }
      logAudit({
        action: "unlink_seed_business",
        tab: AUDIT_TABS.ONBOARDING,
        subTab: "Claim Link",
        targetType: "onboarding_submission",
        targetId: selected.id,
        entityName: selected.business_name || "",
        fieldName: "claim_business_id",
        oldValue: linkedBusiness?.id || "",
        newValue: "",
        details: `Unlinked onboarding submission from business "${linkedBusiness?.business_name}"`,
      });
      setLinkedBusiness(null);
      await fetchSubmissions();
    } catch (err) {
      console.error("Unlink error:", err);
    } finally {
      setActionLoading(false);
    }
  }

  // DB-driven business type options
  const [tagCats, setTagCats] = useState<TagCategory[]>([]);
  useEffect(() => { fetchTagsByCategory("business").then(setTagCats).catch((err) => console.error("Failed to load tag categories:", err)); }, []);
  const businessTypeOptions = React.useMemo(() => {
    const bt = tagCats.find(c => c.name === "Business Type");
    if (!bt || bt.tags.length === 0) {
      return [
        { value: "restaurant_bar", label: "Restaurant/Bar" },
        { value: "salon_beauty", label: "Salon/Beauty" },
        { value: "retail", label: "Retail" },
        { value: "activity", label: "Activity" },
        { value: "event_venue", label: "Event Venue" },
        { value: "other", label: "Other" },
      ];
    }
    return bt.tags.map(t => ({ value: t.name, label: `${t.icon || ""} ${t.name}`.trim() }));
  }, [tagCats]);

  /* ==================== FILTERING & SORTING ==================== */

  const filtered = submissions.filter((s) => {
    // Status filter
    if (statusFilter !== "all") {
      if (statusFilter === "pending_review" || statusFilter === "submitted") {
        if (s.status !== "pending_review" && s.status !== "submitted") return false;
      } else if (s.status !== statusFilter) {
        return false;
      }
    }

    const sp = s.payload as Record<string, unknown>;

    // Search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const name = ((sp.publicBusinessName as string) || s.business_name || "").toLowerCase();
      const email = (s.contact_email || (sp.email as string) || "").toLowerCase();
      if (!name.includes(q) && !email.includes(q)) return false;
    }

    // Advanced filters
    if (advancedFilters.business) {
      const name = ((sp.publicBusinessName as string) || s.business_name || "").toLowerCase();
      if (!name.includes(advancedFilters.business.toLowerCase())) return false;
    }
    if (advancedFilters.zipCode) {
      const zip = ((sp.zip as string) || "").toLowerCase();
      if (!zip.includes(advancedFilters.zipCode.toLowerCase())) return false;
    }
    if (advancedFilters.phone) {
      const phone = (s.contact_phone || (sp.phone as string) || "").toLowerCase();
      if (!phone.includes(advancedFilters.phone.toLowerCase())) return false;
    }
    if (advancedFilters.dateFrom) {
      if (s.created_at < advancedFilters.dateFrom) return false;
    }
    if (advancedFilters.dateTo) {
      if (s.created_at > advancedFilters.dateTo + "T23:59:59Z") return false;
    }

    return true;
  });

  // Sort: desc = oldest first (longest waiting), asc = newest first
  const sorted = [...filtered].sort((a, b) => {
    const da = new Date(a.created_at).getTime();
    const db = new Date(b.created_at).getTime();
    return onboardingSort === "desc" ? da - db : db - da;
  });

  /* ==================== DATA FETCHING ==================== */

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      // Try with staff notes join first
      const { data, error } = await supabaseBrowser
        .from("partner_onboarding_submissions")
        .select("*, onboarding_staff_notes(*)")
        .order("created_at", { ascending: false });

      if (error) {
        // Fallback without join if table doesn't exist yet
        const { data: basicData, error: basicError } = await supabaseBrowser
          .from("partner_onboarding_submissions")
          .select("*")
          .order("created_at", { ascending: false });
        if (basicError) throw basicError;
        setSubmissions((basicData || []).map((s: Record<string, unknown>) => ({
          ...s,
          staff_notes: null,
        })) as Submission[]);
        if (!selectedId && basicData && basicData.length > 0) {
          setSelectedId((basicData[0] as Submission).id);
        }
      } else {
        const mapped = (data || []).map((s: Record<string, unknown>) => {
          const notes = (s.onboarding_staff_notes as OnboardingStaffNote[]) || [];
          notes.sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          });
          const { onboarding_staff_notes: _osn, ...rest } = s;
          return { ...rest, staff_notes: notes } as Submission;
        });
        setSubmissions(mapped);
        if (!selectedId && mapped.length > 0) {
          setSelectedId(mapped[0].id);
        }
      }
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "message" in err
        ? (err as { message: string }).message : "";
      if (!msg.includes("does not exist") && !msg.includes("relation")) {
        console.error("Error fetching submissions:", err);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  /* ==================== ACTIONS ==================== */

  async function handleApprove() {
    if (!selected) return;
    setActionLoading(true);
    try {
      const payload = selected.payload as Record<string, unknown>;
      const claimBusinessId = payload.claim_business_id as string | undefined;

      let businessId: string;

      if (claimBusinessId) {
        // ─── CLAIM MODE: Onboarding data is PRIMARY, seed extras (photos, geocode) are preserved ───
        const selectedPlan = (payload.plan as string) || "basic";
        const payoutPreset = (payload.payoutPreset as string) || "standard";
        const payoutBps = (payload.payoutBps as number[]) || [500, 750, 1000, 1250, 1500, 1750, 2000];

        // Fetch existing seed to preserve its photos, geocode, and other seed-only data
        const { data: existingBiz, error: fetchErr } = await supabaseBrowser
          .from("business")
          .select("*")
          .eq("id", claimBusinessId)
          .maybeSingle();

        if (fetchErr || !existingBiz) {
          alert("Error: Could not find linked business " + claimBusinessId);
          return;
        }

        // Merge config: onboarding values overwrite, but KEEP seed's images (photos from Google)
        const seedConfig = (existingBiz.config || {}) as Record<string, unknown>;
        const mergedConfig: Record<string, unknown> = {
          // Preserve seed-only data
          images: seedConfig.images || [],
          // Onboarding data takes priority for everything else
          businessType: (payload.businessTypeTag as string) || (payload.businessType as string) || seedConfig.businessType,
          priceLevel: (payload.priceLevel as string) || seedConfig.priceLevel,
          payoutPreset,
          tags: (() => {
            const selected = (payload.selectedTags as string[]) || (seedConfig.tags as string[]) || [];
            const typeTag = (payload.businessTypeTag as string) || "";
            if (typeTag && !selected.includes(typeTag)) return [...selected, typeTag];
            return selected;
          })(),
        };

        // Build hours from onboarding payload
        const hoursPayload = payload.hours as Record<string, { enabled: boolean; open: string; close: string }> | undefined;
        const hoursUpdate: Record<string, string | null> = {};
        if (hoursPayload) {
          const dayKeys = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
          for (const day of dayKeys) {
            const h = hoursPayload[day];
            if (h?.enabled && h.open && h.close) {
              hoursUpdate[`${day}_open`] = h.open.length === 5 ? `${h.open}:00` : h.open;
              hoursUpdate[`${day}_close`] = h.close.length === 5 ? `${h.close}:00` : h.close;
            } else {
              hoursUpdate[`${day}_open`] = null;
              hoursUpdate[`${day}_close`] = null;
            }
          }
        }

        // Onboarding data is the primary source — overwrite seed fields
        const applicantEmail = (payload.email as string) || selected.contact_email;
        const applicantPhone = (payload.phone as string);
        const businessPhone = (payload.businessPhone as string);

        const bizUpdate: Record<string, unknown> = {
          // Status: convert from trial to active
          billing_plan: selectedPlan,
          seeded_at: null,
          claim_code: null,
          trial_expires_at: null,
          is_active: true,

          // Business details from onboarding (primary source)
          business_name: (payload.businessName as string) || existingBiz.business_name,
          public_business_name: (payload.publicBusinessName as string) || (payload.businessName as string) || existingBiz.public_business_name,
          // Populate BOTH column sets so admin Businesses page + discovery page both work
          category_main: (payload.businessType as string) || existingBiz.category_main,
          business_type: (payload.businessTypeTag as string) || (payload.businessType as string) || existingBiz.business_type,
          price_level: (payload.priceLevel as string) || existingBiz.price_level,
          age_restriction: (payload.ageRestriction as string) || existingBiz.age_restriction,
          tags: (() => {
            const selected = (payload.selectedTags as string[]) || existingBiz.tags || [];
            const typeTag = (payload.businessTypeTag as string) || "";
            // Ensure the business type tag (e.g. "Entertainment") is in the tags array for category filtering
            if (typeTag && !selected.includes(typeTag)) return [...selected, typeTag];
            return selected;
          })(),
          config: mergedConfig,
          payout_preset: payoutPreset,
          payout_tiers: payoutBps,

          // Contact info from applicant
          contact_email: applicantEmail || existingBiz.contact_email,
          contact_phone: businessPhone || existingBiz.contact_phone,
          customer_email: (payload.customerEmail as string) || existingBiz.customer_email,
          login_email: applicantEmail || existingBiz.login_email,
          rep_name: (payload.fullName as string) || existingBiz.rep_name,
          rep_email: applicantEmail || existingBiz.rep_email,
          rep_phone: applicantPhone || existingBiz.rep_phone,
          rep_title: (payload.role as string) || existingBiz.rep_title,
          verifier_name: (payload.verifierName as string) || existingBiz.verifier_name,
          verifier_email: (payload.verifierEmail as string) || existingBiz.verifier_email,
          verifier_phone: (payload.verifierPhone as string) || existingBiz.verifier_phone,

          // Website from onboarding
          website: (payload.website as string) || existingBiz.website,

          // Address from onboarding (or keep seed's)
          street_address: (payload.streetAddress as string) || existingBiz.street_address,
          city: (payload.city as string) || existingBiz.city,
          state: (payload.state as string) || existingBiz.state,
          zip: (payload.zip as string) || existingBiz.zip,

          // Marketing & auto-approval from onboarding
          marketing_permissions: payload.marketingPermissions || existingBiz.marketing_permissions,
          addons: payload.premiumAddons || existingBiz.addons,
          auto_approval_enabled: payload.autoApprovalEnabled ?? existingBiz.auto_approval_enabled,
          auto_approval_max: payload.autoApprovalMax ?? existingBiz.auto_approval_max,

          // Logo from onboarding (if uploaded)
          ...((payload.businessLogoFile as Record<string, unknown>)?.url
            ? { logo_url: (payload.businessLogoFile as Record<string, unknown>).url }
            : {}),

          // Billing address from onboarding
          ...(payload.billingSameAsBusiness
            ? {
                billing_address: [(payload.streetAddress as string) || existingBiz.street_address, [(payload.city as string) || existingBiz.city, (payload.state as string) || existingBiz.state, (payload.zip as string) || existingBiz.zip].filter(Boolean).join(", ")].filter(Boolean).join(", "),
                billing_email: applicantEmail || existingBiz.billing_email,
              }
            : {
                ...(payload.billingStreet ? { billing_address: [(payload.billingStreet as string), [(payload.billingCity as string), (payload.billingState as string), (payload.billingZip as string)].filter(Boolean).join(", ")].filter(Boolean).join(", ") } : {}),
                billing_email: applicantEmail || existingBiz.billing_email,
              }
          ),

          // Payment method & Stripe from onboarding
          ...(payload.paymentMethod ? { payment_method: payload.paymentMethod } : {}),
          ...(payload.stripeCustomerId ? { stripe_customer_id: payload.stripeCustomerId } : {}),
          ...(payload.stripePaymentMethodId ? { stripe_payment_method_id: payload.stripePaymentMethodId } : {}),

          // Hours from onboarding
          ...hoursUpdate,
        };

        const { error: bizErr } = await supabaseBrowser
          .from("business")
          .update(bizUpdate)
          .eq("id", claimBusinessId);

        if (bizErr) {
          alert("Error updating claimed business: " + bizErr.message);
          return;
        }

        // Update payout tiers — replace trial 0% tiers with real tiers from onboarding
        await supabaseBrowser
          .from("business_payout_tiers")
          .delete()
          .eq("business_id", claimBusinessId);

        const tierLabels = ["Starter", "Regular", "Favorite", "VIP", "Elite", "Legend", "Ultimate"];
        const tierRows = payoutBps.slice(0, 7).map((bps: number, idx: number) => ({
          business_id: claimBusinessId,
          tier_index: idx + 1,
          percent_bps: bps,
          min_visits: idx === 0 ? 1 : idx * 10 + 1,
          max_visits: idx === 6 ? null : (idx + 1) * 10,
          label: tierLabels[idx],
        }));

        await supabaseBrowser
          .from("business_payout_tiers")
          .insert(tierRows);

        // Create business_users entry (owner)
        if (selected.user_id) {
          await supabaseBrowser
            .from("business_users")
            .upsert({
              business_id: claimBusinessId,
              user_id: selected.user_id,
              role: "owner",
            }, { onConflict: "business_id,user_id" });
        }

        // Update submission status
        await supabaseBrowser
          .from("partner_onboarding_submissions")
          .update({ status: "approved" })
          .eq("id", selected.id);

        // Fetch bank/card display info from Stripe (non-blocking — don't fail the whole approve)
        if (payload.stripePaymentMethodId) {
          try {
            const { data: { session } } = await supabaseBrowser.auth.getSession();
            if (session?.access_token) {
              await fetch("/api/stripe/business-payment-info", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                  businessId: claimBusinessId,
                  paymentMethodId: payload.stripePaymentMethodId,
                }),
              });
            }
          } catch {
            // Non-critical — admin can manually fetch later
          }
        }

        businessId = claimBusinessId;
      } else {
        // ─── NORMAL MODE: Create new business via RPC ───
        const { data, error } = await supabaseBrowser.rpc("approve_partner_onboarding_submission", {
          p_submission_id: selected.id,
        });

        if (error) {
          alert("Error approving: " + error.message);
          return;
        }

        businessId = data as string;

        // The RPC creates the business but doesn't pull selectedTags out of the
        // submission payload, so freshly-onboarded businesses ended up with empty
        // tags arrays — which broke every discovery filter that reads tags.
        // Merge the wizard's Step-1 picks into the tags column here so the
        // discovery feed can find the business by Cuisine/Dietary/Extras.
        const selectedTagsArr = Array.isArray(payload.selectedTags) ? (payload.selectedTags as string[]) : [];
        const typeTag = (payload.businessTypeTag as string | undefined) ?? "";
        const mergedTags = typeTag && !selectedTagsArr.includes(typeTag)
          ? [...selectedTagsArr, typeTag]
          : selectedTagsArr;
        if (businessId && mergedTags.length > 0) {
          await supabaseBrowser
            .from("business")
            .update({ tags: mergedTags })
            .eq("id", businessId);
        }
      }

      // Copy Stripe payment IDs from submission payload to the business record
      if (businessId && (payload.stripeCustomerId || payload.stripePaymentMethodId)) {
        await supabaseBrowser
          .from("business")
          .update({
            stripe_customer_id: (payload.stripeCustomerId as string) || null,
            stripe_payment_method_id: (payload.stripePaymentMethodId as string) || null,
          })
          .eq("id", businessId);
      }

      logAudit({
        action: claimBusinessId ? "approve_claim" : "approve_onboarding",
        tab: AUDIT_TABS.ONBOARDING,
        subTab: "Review Actions",
        targetType: "onboarding_submission",
        targetId: selected.id,
        entityName: selected.business_name || (payload.publicBusinessName as string) || "",
        fieldName: "status",
        oldValue: selected.status,
        newValue: "approved",
        details: claimBusinessId
          ? `Approved business claim. Existing business ${businessId} updated from trial to active.`
          : `Approved onboarding submission. Business ID: ${businessId}`,
      });
      alert(`✅ ${claimBusinessId ? "Claim approved" : "Approved"}! Business ID: ${businessId}`);
      await fetchSubmissions();
      setSelectedId(null);
    } catch (err) {
      console.error("Approve error:", err);
      alert("Error approving submission");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleActionConfirm(id: string, message: string) {
    if (!onboardingAction) return;
    const newStatus = onboardingAction.type === "reject" ? "rejected" : "needs_changes";
    const submission = onboardingAction.submission;

    setActionLoading(true);
    try {
      // Build review history entry
      const existingHistory = (submission.review_history || []) as ReviewHistoryEntry[];
      const historyEntry: ReviewHistoryEntry = {
        action: newStatus,
        message,
        by: noteAuthor || "Staff",
        at: new Date().toISOString(),
      };

      const { error } = await supabaseBrowser
        .from("partner_onboarding_submissions")
        .update({
          status: newStatus,
          review_message: message,
          reviewed_at: new Date().toISOString(),
          reviewed_by: noteAuthor || "Staff",
          review_history: [...existingHistory, historyEntry],
        })
        .eq("id", id);

      if (error) {
        alert("Error: " + error.message);
        return;
      }

      logAudit({
        action: newStatus === "rejected" ? "reject_onboarding" : "request_changes_onboarding",
        tab: AUDIT_TABS.ONBOARDING,
        subTab: "Review Actions",
        targetType: "onboarding_submission",
        targetId: id,
        entityName: submission.business_name || (submission.payload as Record<string, unknown>).publicBusinessName as string || "",
        fieldName: "status",
        oldValue: submission.status,
        newValue: newStatus,
        details: `Status changed to "${newStatus}". Message: ${message}`,
      });
      alert(`✅ Status updated to "${newStatus}"\n\nMessage has been saved and will be visible to the business owner.`);
      setOnboardingAction(null);
      await fetchSubmissions();
    } catch (err) {
      console.error("Status update error:", err);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleBulkImportConfirm(rows: BulkImportRow[]) {
    setBulkReviewRows(null);
    let inserted = 0;
    let failed = 0;
    for (const row of rows) {
      // Apply selected suggestion address if chosen
      if (row.selectedIdx >= 0 && row.suggestions[row.selectedIdx]) {
        const addr = row.suggestions[row.selectedIdx];
        row.payload.streetAddress = addr.streetAddress;
        row.payload.city = addr.city;
        row.payload.state = addr.state;
        row.payload.zip = addr.zip;
        row.payload._addressVerified = true;
      } else {
        // Kept original — flag as unverified
        row.payload._addressVerified = false;
      }
      const { error } = await supabaseBrowser
        .from("partner_onboarding_submissions")
        .insert({
          status: "submitted",
          business_name: row.name,
          contact_email: row.email,
          contact_phone: (row.payload.phone as string) || null,
          payload: row.payload,
        });
      if (error) { failed++; console.error("Bulk import insert error:", error.message, error.code, error.details); }
      else { inserted++; }
    }
    logAudit({
      action: "bulk_import_onboarding",
      tab: AUDIT_TABS.ONBOARDING,
      subTab: "Bulk Import",
      targetType: "onboarding_submission",
      targetId: "",
      entityName: "",
      details: `Bulk imported ${inserted} submission(s) successfully${failed > 0 ? `, ${failed} failed` : ""}`,
    });
    alert(`✅ Import complete!\n\n${inserted} submission(s) created successfully.${failed > 0 ? `\n⚠️ ${failed} failed to insert.` : ""}`);
    await fetchSubmissions();
  }

  async function handleVerifyAddress() {
    if (!selected) return;
    const street = (p.streetAddress as string) || "";
    const city = (p.city as string) || "";
    const state = (p.state as string) || "";
    const zip = (p.zip as string) || "";
    if (!street && !city) { alert("No address to verify."); return; }

    // Use saved original if available (so re-verify always shows the as-entered address)
    const orig = p._originalAddress as { streetAddress: string; city: string; state: string; zip: string } | undefined;
    const originalForModal = orig
      ? { street: orig.streetAddress || "", city: orig.city || "", state: orig.state || "", zip: orig.zip || "" }
      : { street, city, state, zip };

    setVerifyingAddress(true);
    try {
      const suggestions = await geocodeAddress(street, city, state, zip);
      setAddressVerify({ original: originalForModal, suggestions });
    } catch (err) {
      console.error("Verify address error:", err);
      alert("Error verifying address.");
    } finally {
      setVerifyingAddress(false);
    }
  }

  async function handleAcceptVerifiedAddress(addr: GeocodedAddress) {
    if (!selected) return;
    const currentPayload = selected.payload as Record<string, unknown>;
    // Preserve the original address the first time we override it
    if (!currentPayload._originalAddress) {
      currentPayload._originalAddress = {
        streetAddress: currentPayload.streetAddress,
        city: currentPayload.city,
        state: currentPayload.state,
        zip: currentPayload.zip,
      };
    }
    const updatedPayload = { ...currentPayload, streetAddress: addr.streetAddress, city: addr.city, state: addr.state, zip: addr.zip, _addressVerified: true };
    const { error } = await supabaseBrowser
      .from("partner_onboarding_submissions")
      .update({ payload: updatedPayload })
      .eq("id", selected.id);
    if (error) {
      alert("Error updating address: " + error.message);
      return;
    }
    logAudit({
      action: "accept_verified_address",
      tab: AUDIT_TABS.ONBOARDING,
      subTab: "Address Verification",
      targetType: "onboarding_submission",
      targetId: selected.id,
      entityName: selected.business_name || (selected.payload as Record<string, unknown>).publicBusinessName as string || "",
      fieldName: "address",
      oldValue: `${(selected.payload as Record<string, unknown>).streetAddress || ""}, ${(selected.payload as Record<string, unknown>).city || ""}, ${(selected.payload as Record<string, unknown>).state || ""} ${(selected.payload as Record<string, unknown>).zip || ""}`,
      newValue: `${addr.streetAddress}, ${addr.city}, ${addr.state} ${addr.zip}`,
      details: `Accepted verified address: ${addr.streetAddress}, ${addr.city}, ${addr.state} ${addr.zip}`,
    });
    await fetchSubmissions();
  }

  async function handleRevertAddress() {
    if (!selected) return;
    const currentPayload = selected.payload as Record<string, unknown>;
    const orig = currentPayload._originalAddress as { streetAddress: string; city: string; state: string; zip: string } | undefined;
    if (!orig) return; // Nothing to revert to
    const updatedPayload = {
      ...currentPayload,
      streetAddress: orig.streetAddress,
      city: orig.city,
      state: orig.state,
      zip: orig.zip,
      _addressVerified: false,
      _originalAddress: undefined, // Clear the saved original since we're back to it
    };
    // Remove the undefined key
    delete updatedPayload._originalAddress;
    const { error } = await supabaseBrowser
      .from("partner_onboarding_submissions")
      .update({ payload: updatedPayload })
      .eq("id", selected.id);
    if (error) {
      alert("Error reverting address: " + error.message);
      return;
    }
    logAudit({
      action: "revert_address",
      tab: AUDIT_TABS.ONBOARDING,
      subTab: "Address Verification",
      targetType: "onboarding_submission",
      targetId: selected.id,
      entityName: selected.business_name || (selected.payload as Record<string, unknown>).publicBusinessName as string || "",
      fieldName: "address",
      oldValue: `${(selected.payload as Record<string, unknown>).streetAddress || ""}, ${(selected.payload as Record<string, unknown>).city || ""}, ${(selected.payload as Record<string, unknown>).state || ""} ${(selected.payload as Record<string, unknown>).zip || ""}`,
      newValue: `${orig.streetAddress}, ${orig.city}, ${orig.state} ${orig.zip}`,
      details: `Reverted address to original: ${orig.streetAddress}, ${orig.city}, ${orig.state} ${orig.zip}`,
    });
    await fetchSubmissions();
  }

  async function handleReopen() {
    if (!selected) return;
    const { error } = await supabaseBrowser
      .from("partner_onboarding_submissions")
      .update({ status: "submitted" })
      .eq("id", selected.id);
    if (error) {
      alert("Error reopening submission: " + error.message);
      return;
    }
    logAudit({
      action: "reopen_onboarding",
      tab: AUDIT_TABS.ONBOARDING,
      subTab: "Review Actions",
      targetType: "onboarding_submission",
      targetId: selected.id,
      entityName: selected.business_name || (selected.payload as Record<string, unknown>).publicBusinessName as string || "",
      fieldName: "status",
      oldValue: selected.status,
      newValue: "submitted",
      details: `Reopened submission and moved back to queue (previous status: ${selected.status})`,
    });
    alert("✅ Submission reopened and moved back to queue for review.");
    await fetchSubmissions();
  }

  async function handleDelete() {
    if (!selected) return;
    if (!confirm(`⚠️ Permanently delete the submission for "${selected.business_name}"?\n\nThis cannot be undone.`)) return;
    const deletedId = selected.id;
    const deletedName = selected.business_name || (selected.payload as Record<string, unknown>).publicBusinessName as string || "";
    const { error } = await supabaseBrowser
      .from("partner_onboarding_submissions")
      .delete()
      .eq("id", selected.id);
    if (error) {
      alert("Error deleting submission: " + error.message);
      return;
    }
    logAudit({
      action: "delete_onboarding",
      tab: AUDIT_TABS.ONBOARDING,
      subTab: "Review Actions",
      targetType: "onboarding_submission",
      targetId: deletedId,
      entityName: deletedName,
      details: `Permanently deleted onboarding submission`,
    });
    setSelectedId(null);
    await fetchSubmissions();
  }

  // Save edited payload fields
  async function handleSavePayload() {
    if (!selected) return;
    if (Object.keys(editPayload).length === 0) {
      setIsEditing(false);
      return;
    }
    setActionLoading(true);
    try {
      const updatedPayload = { ...selected.payload, ...editPayload };
      // Also update top-level columns if relevant
      const topLevelUpdates: Record<string, unknown> = { payload: updatedPayload };
      if (editPayload.businessName !== undefined) topLevelUpdates.business_name = editPayload.businessName;
      if (editPayload.email !== undefined) topLevelUpdates.contact_email = editPayload.email;
      if (editPayload.phone !== undefined) topLevelUpdates.contact_phone = editPayload.phone;

      const { error } = await supabaseBrowser
        .from("partner_onboarding_submissions")
        .update(topLevelUpdates)
        .eq("id", selected.id);
      if (error) {
        alert("Error saving changes: " + error.message);
        return;
      }
      const changedKeys = Object.keys(editPayload);
      const oldPayload = selected.payload as Record<string, unknown>;
      logAudit({
        action: "edit_onboarding_payload",
        tab: AUDIT_TABS.ONBOARDING,
        subTab: "Submission Details",
        targetType: "onboarding_submission",
        targetId: selected.id,
        entityName: selected.business_name || oldPayload.publicBusinessName as string || "",
        fieldName: changedKeys.join(", "),
        oldValue: changedKeys.map((k) => `${k}: ${oldPayload[k] ?? ""}`).join(", "),
        newValue: changedKeys.map((k) => `${k}: ${editPayload[k] ?? ""}`).join(", "),
        details: `Edited submission fields: ${changedKeys.join(", ")}`,
      });
      setIsEditing(false);
      setEditPayload({});
      await fetchSubmissions();
      alert("✅ Changes saved successfully!");
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setActionLoading(false);
    }
  }

  // Helper to update editPayload
  function setPayloadField(key: string, value: unknown) {
    setEditPayload((prev) => ({ ...prev, [key]: value }));
  }

  // Get effective value (edited or original)
  function pVal(key: string): unknown {
    return editPayload[key] !== undefined ? editPayload[key] : p[key];
  }

  // Staff Notes CRUD for onboarding
  async function handleAddOnboardingNote() {
    if (!selected || !newNote.trim()) return;
    try {
      const { error } = await supabaseBrowser
        .from("onboarding_staff_notes")
        .insert({
          submission_id: selected.id,
          author_name: noteAuthor || "Staff",
          note: newNote.trim(),
          pinned: false,
        });
      if (error) {
        alert("Error adding note: " + error.message);
        return;
      }
      logAudit({
        action: "add_onboarding_note",
        tab: AUDIT_TABS.ONBOARDING,
        subTab: "Staff Notes",
        targetType: "onboarding_submission",
        targetId: selected.id,
        entityName: selected.business_name || (selected.payload as Record<string, unknown>).publicBusinessName as string || "",
        details: `Added staff note by ${noteAuthor || "Staff"}`,
      });
      setNewNote("");
      await fetchSubmissions();
    } catch (err) {
      console.error("Add note error:", err);
    }
  }

  async function handleDeleteOnboardingNote(noteId: string) {
    try {
      const { error } = await supabaseBrowser
        .from("onboarding_staff_notes")
        .delete()
        .eq("id", noteId);
      if (error) {
        alert("Error deleting note: " + error.message);
        return;
      }
      logAudit({
        action: "delete_onboarding_note",
        tab: AUDIT_TABS.ONBOARDING,
        subTab: "Staff Notes",
        targetType: "onboarding_submission",
        targetId: selected?.id || "",
        entityName: selected?.business_name || "",
        details: `Deleted staff note (note ID: ${noteId})`,
      });
      await fetchSubmissions();
    } catch (err) {
      console.error("Delete note error:", err);
    }
  }

  async function handleTogglePinOnboardingNote(noteId: string, currentPinned: boolean) {
    try {
      const { error } = await supabaseBrowser
        .from("onboarding_staff_notes")
        .update({ pinned: !currentPinned })
        .eq("id", noteId);
      if (error) {
        alert("Error updating note: " + error.message);
        return;
      }
      logAudit({
        action: "toggle_pin_onboarding_note",
        tab: AUDIT_TABS.ONBOARDING,
        subTab: "Staff Notes",
        targetType: "onboarding_submission",
        targetId: selected?.id || "",
        entityName: selected?.business_name || "",
        fieldName: "pinned",
        oldValue: String(currentPinned),
        newValue: String(!currentPinned),
        details: `${currentPinned ? "Unpinned" : "Pinned"} staff note (note ID: ${noteId})`,
      });
      await fetchSubmissions();
    } catch (err) {
      console.error("Pin note error:", err);
    }
  }

  /* ==================== HELPERS ==================== */

  function getHoursColor(hours: number) {
    if (hours > 48) return { bg: "rgba(255,49,49,0.2)", color: COLORS.neonRed };
    if (hours > 24) return { bg: "rgba(255,255,0,0.2)", color: COLORS.neonYellow };
    return { bg: "rgba(57,255,20,0.2)", color: COLORS.neonGreen };
  }

  function handleBulkTemplate() {
    const headers = [
      // Business Identity
      "business_name","public_business_name","business_type","age_restriction","referred_by",
      // Primary Contact
      "full_name","role","email","phone",
      // Location
      "street_address","city","state","zip","business_phone","customer_email","website",
      // Operating Hours (enabled|open|close per day)
      "hours_mon","hours_tue","hours_wed","hours_thu","hours_fri","hours_sat","hours_sun",
      // Plan & Payout
      "plan","payment_method","payout_preset",
      "payout_bps_level1","payout_bps_level2","payout_bps_level3","payout_bps_level4","payout_bps_level5","payout_bps_level6","payout_bps_level7",
      // Premium Add-ons
      "addon_video","addon_live_15","addon_live_30",
      // Advertising
      "wants_custom_ads_call","ad_1day","ad_7day","ad_14day","ad_100mile","ad_tour","ad_start_date","ad_notes",
      // Receipt Verification
      "verifier_name","verifier_email","verifier_phone","auto_approval_enabled","auto_approval_max",
      // Marketing Permissions
      "allow_user_uploads","feature_in_discovery","ab_testing",
      // Legal
      "authorize_charges","terms_of_service","billing_policy","content_policy","fraud_prevention","signature_binding","signature_name",
    ];
    const example = [
      // Business Identity
      "Donalds","Donalds Restaurant","restaurant_bar","all","Google Ads",
      // Primary Contact
      "John Smith","GM","john@example.com","(402) 555-1234",
      // Location
      "123 Main St","Omaha","NE","68102","(402) 555-1235","contact@donalds.com","www.donalds.com",
      // Hours: format is "open-close" or "closed"
      "09:00-17:00","09:00-17:00","09:00-17:00","09:00-17:00","09:00-21:00","10:00-21:00","closed",
      // Plan & Payout
      "premium","bank","aggressive",
      "1300","1450","1550","1650","1750","1850","2000",
      // Premium Add-ons (true/false)
      "true","false","true",
      // Advertising (true/false for each package)
      "true","false","true","false","false","false","2026-02-01","Grand opening campaign",
      // Receipt Verification
      "John Smith","john@donalds.com","(402) 555-1236","true","50",
      // Marketing Permissions (true/false)
      "true","true","true",
      // Legal (true/false)
      "true","true","true","true","true","true","John Smith",
    ];
    const csv = headers.join(",") + "\n" + example.map((v) => v.includes(",") ? `"${v}"` : v).join(",");
    const link = document.createElement("a");
    link.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    link.download = "bulk_import_template.csv";
    link.click();
  }

  /* ==================== RENDER ==================== */

  if (!authChecked) return null;

  return (
    <div style={{ display: "flex", height: "calc(100vh - 60px)" }}>
      {/* Modals */}
      <PreviewModal preview={preview} onClose={() => setPreview(null)} />
      {!!confirmModal && (
        <ConfirmModal
          title={confirmModal.title}
          message={confirmModal.message}
          type={confirmModal.type}
          confirmText={confirmModal.confirmText}
          onClose={() => setConfirmModal(null)}
          onConfirm={confirmModal.onConfirm}
        />
      )}
      <OnboardingActionModal
        type={onboardingAction?.type || null}
        submission={onboardingAction?.submission || null}
        onClose={() => setOnboardingAction(null)}
        onConfirm={handleActionConfirm}
      />
      {!!bulkReviewRows && (
        <BulkImportReviewModal
          rows={bulkReviewRows}
          onClose={() => setBulkReviewRows(null)}
          onConfirm={handleBulkImportConfirm}
        />
      )}
      {!!addressVerify && (
        <AddressVerifyModal
          original={addressVerify.original}
          suggestions={addressVerify.suggestions}
          onClose={() => setAddressVerify(null)}
          onAccept={handleAcceptVerifiedAddress}
          onRevert={handleRevertAddress}
        />
      )}
      {!!geocodingProgress && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: COLORS.cardBg, borderRadius: 20, padding: 40, textAlign: "center", border: "1px solid " + COLORS.cardBorder }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📍</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{geocodingProgress}</div>
            <div style={{ fontSize: 12, color: COLORS.textSecondary }}>Verifying with Google Maps...</div>
          </div>
        </div>
      )}

      {/* ==================== LEFT SIDEBAR ==================== */}
      <aside
        style={{
          width: 360,
          background: COLORS.cardBg,
          borderRight: "1px solid " + COLORS.cardBorder,
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
        }}
      >
        {/* Header */}
        <div style={{ padding: 20, borderBottom: "1px solid " + COLORS.cardBorder }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2
              style={{
                fontSize: 22,
                fontWeight: 700,
                background: COLORS.gradient1,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              📥 Onboarding Queue
            </h2>
            <button
              onClick={() => alert("Bulk Import: Upload a CSV file to onboard multiple businesses at once.\n\nUse the 📥 Template button to download the CSV format.")}
              style={{
                padding: "8px 12px",
                background: COLORS.gradient1,
                border: "none",
                borderRadius: 8,
                color: "#fff",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              📤 Bulk Import
            </button>
          </div>

          {/* Bulk Import Panel */}
          <div
            style={{
              padding: 12,
              background: COLORS.darkBg,
              borderRadius: 10,
              marginBottom: 12,
              border: "1px dashed " + COLORS.cardBorder,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 20 }}>📤</span>
              <span style={{ fontWeight: 600, fontSize: 12 }}>Bulk Import Businesses</span>
            </div>
            <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 12 }}>
              Upload a CSV file to onboard multiple businesses at once.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <label
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  background: COLORS.cardBg,
                  border: "1px solid " + COLORS.cardBorder,
                  borderRadius: 8,
                  cursor: "pointer",
                  textAlign: "center",
                  fontSize: 11,
                  color: COLORS.textPrimary,
                }}
              >
                <input
                  type="file"
                  accept=".csv"
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const text = await file.text();
                    const lines = text.trim().split("\n");
                    if (lines.length < 2) { alert("CSV file is empty or has no data rows."); return; }
                    const headers = lines[0].split(",").map((h) => h.trim());
                    const rows = lines.slice(1);

                    // Parse each row into payload objects
                    const parsed: { name: string; email: string; payload: Record<string, unknown> }[] = [];
                    const invalid: number[] = [];

                    for (let i = 0; i < rows.length; i++) {
                      // Handle quoted CSV values
                      const cols: string[] = [];
                      let current = "";
                      let inQuotes = false;
                      for (const ch of rows[i]) {
                        if (ch === '"') { inQuotes = !inQuotes; }
                        else if (ch === "," && !inQuotes) { cols.push(current.trim()); current = ""; }
                        else { current += ch; }
                      }
                      cols.push(current.trim());

                      const get = (key: string) => cols[headers.indexOf(key)] || "";
                      const getBool = (key: string) => get(key).toLowerCase() === "true";

                      const name = get("business_name") || get("public_business_name");
                      const email = get("email");
                      if (!name || !email) { invalid.push(i + 2); continue; }

                      // Parse hours
                      const parseHours = (day: string) => {
                        const val = get("hours_" + day);
                        if (!val || val.toLowerCase() === "closed") return { enabled: false };
                        const parts = val.split("-");
                        if (parts.length === 2) return { enabled: true, open: parts[0].trim(), close: parts[1].trim() };
                        return { enabled: false };
                      };
                      const hours: Record<string, unknown> = {};
                      for (const d of ["mon","tue","wed","thu","fri","sat","sun"]) { hours[d] = parseHours(d); }
                      const hasHours = Object.values(hours).some((h) => (h as Record<string,unknown>).enabled);

                      // Parse payout BPS
                      const bps: number[] = [];
                      for (let l = 1; l <= 7; l++) {
                        const v = get("payout_bps_level" + l);
                        if (v) bps.push(Number(v));
                      }

                      // Parse selected ads
                      const selectedAds: Record<string, boolean> = {};
                      if (getBool("ad_1day")) selectedAds.ad_1day = true;
                      if (getBool("ad_7day")) selectedAds.ad_7day = true;
                      if (getBool("ad_14day")) selectedAds.ad_14day = true;
                      if (getBool("ad_100mile")) selectedAds.ad_100mile = true;
                      if (getBool("ad_tour")) selectedAds.ad_tour = true;
                      const hasAds = Object.keys(selectedAds).length > 0;

                      const payload: Record<string, unknown> = {
                        businessName: get("business_name"),
                        publicBusinessName: get("public_business_name") || get("business_name"),
                        businessType: get("business_type") || "restaurant_bar",
                        ageRestriction: get("age_restriction") || "all",
                        referredBy: get("referred_by"),
                        fullName: get("full_name"),
                        role: get("role"),
                        email,
                        phone: get("phone"),
                        streetAddress: get("street_address"),
                        city: get("city"),
                        state: get("state"),
                        zip: get("zip"),
                        businessPhone: get("business_phone"),
                        customerEmail: get("customer_email"),
                        website: get("website"),
                        plan: get("plan") || "basic",
                        paymentMethod: get("payment_method") || "bank",
                        payoutPreset: get("payout_preset") || "standard",
                        verifierName: get("verifier_name"),
                        verifierEmail: get("verifier_email"),
                        verifierPhone: get("verifier_phone"),
                        autoApprovalEnabled: getBool("auto_approval_enabled"),
                        autoApprovalMax: Number(get("auto_approval_max")) || 0,
                        wantsCustomAdsCall: getBool("wants_custom_ads_call"),
                        adStartDate: get("ad_start_date"),
                        adNotes: get("ad_notes"),
                        authorizeCharges: getBool("authorize_charges"),
                        signatureBinding: getBool("signature_binding"),
                        signatureName: get("signature_name"),
                        submittedAt: new Date().toISOString(),
                        marketingPermissions: {
                          userUploads: getBool("allow_user_uploads"),
                          featureInDiscovery: getBool("feature_in_discovery"),
                          abTesting: getBool("ab_testing"),
                        },
                        legal: {
                          terms: getBool("terms_of_service"),
                          billingPolicy: getBool("billing_policy"),
                          contentPolicy: getBool("content_policy"),
                          fraud: getBool("fraud_prevention"),
                        },
                      };
                      if (hasHours) payload.hours = hours;
                      if (bps.length > 0) payload.payoutBps = bps;
                      if (hasAds) payload.selectedAds = selectedAds;
                      if (getBool("addon_video") || getBool("addon_live_15") || getBool("addon_live_30")) {
                        payload.premiumAddons = {
                          videoAddon: getBool("addon_video"),
                          liveAddon15: getBool("addon_live_15"),
                          liveAddon30: getBool("addon_live_30"),
                        };
                      }

                      parsed.push({ name, email, payload });
                    }

                    const msg = `File: ${file.name}\n\nValidating ${rows.length} businesses...\n✓ ${parsed.length} valid${invalid.length > 0 ? `\n⚠️ ${invalid.length} skipped (missing name or email) — rows: ${invalid.join(", ")}` : ""}\n\nThis will verify addresses via Google Maps and then show a review.`;
                    if (parsed.length === 0) { alert(msg + "\n\nNo valid rows to import."); return; }
                    if (!confirm(msg + "\n\nProceed?")) return;

                    // Geocode all addresses
                    setGeocodingProgress(`Verifying addresses: 0/${parsed.length}...`);
                    const reviewRows: BulkImportRow[] = [];
                    for (let i = 0; i < parsed.length; i++) {
                      const row = parsed[i];
                      const pl = row.payload;
                      const original = {
                        street: (pl.streetAddress as string) || "",
                        city: (pl.city as string) || "",
                        state: (pl.state as string) || "",
                        zip: (pl.zip as string) || "",
                      };
                      setGeocodingProgress(`Verifying addresses: ${i + 1}/${parsed.length}...`);
                      const suggestions = await geocodeAddress(original.street, original.city, original.state, original.zip);
                      reviewRows.push({
                        name: row.name,
                        email: row.email,
                        payload: row.payload,
                        original,
                        suggestions,
                        selectedIdx: suggestions.length > 0 ? 0 : -1,
                      });
                    }
                    setGeocodingProgress(null);
                    setBulkReviewRows(reviewRows);
                    // Reset file input
                    e.target.value = "";
                  }}
                />
                📁 Choose CSV
              </label>
              <button
                onClick={handleBulkTemplate}
                style={{
                  padding: "10px 12px",
                  background: COLORS.darkBg,
                  border: "1px solid " + COLORS.cardBorder,
                  borderRadius: 8,
                  color: COLORS.textSecondary,
                  cursor: "pointer",
                  fontSize: 11,
                }}
              >
                📥 Template
              </button>
            </div>
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "12px 14px",
              border: "1px solid " + COLORS.cardBorder,
              borderRadius: 10,
              fontSize: 13,
              marginBottom: 12,
              background: COLORS.darkBg,
              color: COLORS.textPrimary,
            }}
          />

          {/* Filters Row */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              style={{
                flex: 1,
                padding: "10px 12px",
                border: "1px solid " + COLORS.cardBorder,
                borderRadius: 8,
                fontSize: 12,
                background: COLORS.darkBg,
                color: COLORS.textPrimary,
              }}
            >
              <option value="all">All Status</option>
              <option value="submitted">Submitted / Pending</option>
              <option value="approved">Approved</option>
              <option value="needs_changes">Needs Changes</option>
              <option value="rejected">Rejected</option>
            </select>
            <select
              value={onboardingSort}
              onChange={(e) => setOnboardingSort(e.target.value)}
              style={{
                padding: "10px 12px",
                border: "1px solid " + COLORS.cardBorder,
                borderRadius: 8,
                fontSize: 12,
                background: COLORS.darkBg,
                color: COLORS.textPrimary,
              }}
            >
              <option value="desc">Oldest First ⬆</option>
              <option value="asc">Newest First ⬇</option>
            </select>
          </div>

          {/* Advanced Filters Toggle */}
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            style={{
              width: "100%",
              padding: 10,
              background: COLORS.darkBg,
              border: "1px solid " + COLORS.cardBorder,
              borderRadius: 8,
              color: COLORS.textSecondary,
              fontSize: 12,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            🔍 Advanced Filters {showAdvancedFilters ? "▲" : "▼"}
          </button>

          {/* Advanced Filters Panel */}
          {showAdvancedFilters && (
            <div style={{ marginTop: 12, padding: 12, background: COLORS.darkBg, borderRadius: 10, display: "grid", gap: 10 }}>
              <div>
                <label style={{ display: "block", fontSize: 10, color: COLORS.textSecondary, marginBottom: 4, textTransform: "uppercase" }}>
                  Business Name
                </label>
                <input
                  type="text"
                  placeholder="Filter by business..."
                  value={advancedFilters.business}
                  onChange={(e) => setAdvancedFilters({ ...advancedFilters, business: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    border: "1px solid " + COLORS.cardBorder,
                    borderRadius: 6,
                    fontSize: 11,
                    background: COLORS.cardBg,
                    color: COLORS.textPrimary,
                  }}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: COLORS.textSecondary, marginBottom: 4, textTransform: "uppercase" }}>
                    ZIP Code
                  </label>
                  <input
                    type="text"
                    placeholder="ZIP..."
                    value={advancedFilters.zipCode}
                    onChange={(e) => setAdvancedFilters({ ...advancedFilters, zipCode: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      border: "1px solid " + COLORS.cardBorder,
                      borderRadius: 6,
                      fontSize: 11,
                      background: COLORS.cardBg,
                      color: COLORS.textPrimary,
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: COLORS.textSecondary, marginBottom: 4, textTransform: "uppercase" }}>
                    Phone
                  </label>
                  <input
                    type="text"
                    placeholder="Phone..."
                    value={advancedFilters.phone}
                    onChange={(e) => setAdvancedFilters({ ...advancedFilters, phone: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      border: "1px solid " + COLORS.cardBorder,
                      borderRadius: 6,
                      fontSize: 11,
                      background: COLORS.cardBg,
                      color: COLORS.textPrimary,
                    }}
                  />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: COLORS.textSecondary, marginBottom: 4, textTransform: "uppercase" }}>
                    Date From
                  </label>
                  <input
                    type="date"
                    value={advancedFilters.dateFrom}
                    onChange={(e) => setAdvancedFilters({ ...advancedFilters, dateFrom: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 6px",
                      border: "1px solid " + COLORS.cardBorder,
                      borderRadius: 6,
                      fontSize: 10,
                      background: COLORS.cardBg,
                      color: COLORS.textPrimary,
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: COLORS.textSecondary, marginBottom: 4, textTransform: "uppercase" }}>
                    Date To
                  </label>
                  <input
                    type="date"
                    value={advancedFilters.dateTo}
                    onChange={(e) => setAdvancedFilters({ ...advancedFilters, dateTo: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 6px",
                      border: "1px solid " + COLORS.cardBorder,
                      borderRadius: 6,
                      fontSize: 10,
                      background: COLORS.cardBg,
                      color: COLORS.textPrimary,
                    }}
                  />
                </div>
              </div>
              <button
                onClick={() => setAdvancedFilters(EMPTY_FILTERS)}
                style={{
                  padding: 8,
                  background: "transparent",
                  border: "1px solid " + COLORS.cardBorder,
                  borderRadius: 6,
                  color: COLORS.textSecondary,
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                Clear All Filters
              </button>
            </div>
          )}
        </div>

        {/* Summary */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            padding: 16,
            borderBottom: "1px solid " + COLORS.cardBorder,
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: COLORS.neonBlue }}>
              {submissions.filter((s) => s.status === "submitted" || s.status === "pending_review").length}
            </div>
            <div style={{ fontSize: 10, color: COLORS.textSecondary }}>Pending Review</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: COLORS.neonGreen }}>
              {submissions.filter((s) => s.status === "approved").length}
            </div>
            <div style={{ fontSize: 10, color: COLORS.textSecondary }}>Approved</div>
          </div>
        </div>

        {/* List Items */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading ? (
            <div style={{ padding: 20, color: COLORS.textSecondary, textAlign: "center" }}>Loading...</div>
          ) : sorted.length === 0 ? (
            <EmptyState message="No submissions found" />
          ) : (
            sorted.map((submission) => {
              const isSelected = submission.id === selectedId;
              const hours = getHoursSince(submission.created_at);
              const hoursStyle = getHoursColor(hours);
              const sp = submission.payload as Record<string, unknown>;
              const city = (sp.city as string) || "";
              const state = (sp.state as string) || "";
              const plan = (sp.plan as string) || "";
              const email = submission.contact_email || (sp.email as string) || "";

              return (
                <button
                  key={submission.id}
                  onClick={() => { setSelectedId(submission.id); setIsEditing(false); setEditPayload({}); setNewNote(""); }}
                  style={{
                    width: "100%",
                    padding: "16px 20px",
                    border: "none",
                    background: isSelected ? COLORS.darkBg : "transparent",
                    borderLeft: isSelected ? "4px solid " + COLORS.neonPink : "4px solid transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    borderBottom: "1px solid " + COLORS.cardBorder,
                    transition: "all 0.2s",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, color: COLORS.textPrimary, flex: 1, marginRight: 8 }}>
                      {(sp.publicBusinessName as string) || submission.business_name || "Unnamed Business"}
                    </span>
                    <span
                      style={{
                        padding: "4px 10px",
                        background: hoursStyle.bg,
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        color: hoursStyle.color,
                        marginRight: 8,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {hours}h
                    </span>
                    <Badge status={submission.status} />
                  </div>
                  {!!email && (
                    <div style={{ fontSize: 12, color: COLORS.textSecondary }}>{email}</div>
                  )}
                  {!!(city || state || plan) && (
                    <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 4 }}>
                      {city}{city && state ? ", " : ""}{state}
                      {!!plan && (
                        <span
                          style={{
                            marginLeft: 8,
                            padding: "2px 6px",
                            background: plan === "premium" ? "rgba(255,45,146,0.2)" : COLORS.cardBg,
                            borderRadius: 4,
                            color: plan === "premium" ? COLORS.neonPink : COLORS.textSecondary,
                          }}
                        >
                          {plan}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* ==================== RIGHT SIDE - DETAIL VIEW ==================== */}
      <div key={selectedId || "none"} style={{ flex: 1, display: "flex", flexDirection: "column", background: COLORS.darkBg, overflow: "hidden" }}>
        {!selected ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: COLORS.textSecondary,
            }}
          >
            Select a submission to review
          </div>
        ) : (
          <>
            {/* Header */}
            <header
              style={{
                padding: "24px 32px",
                background: COLORS.cardBg,
                borderBottom: "1px solid " + COLORS.cardBorder,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
                  <h1 style={{ fontSize: 26, fontWeight: 700 }}>
                    {(pVal("publicBusinessName") as string) || selected.business_name || "Unnamed Business"}
                  </h1>
                  <button
                    onClick={() => {
                      if (isEditing) {
                        handleSavePayload();
                      } else {
                        setEditPayload({});
                        setIsEditing(true);
                      }
                    }}
                    style={{
                      padding: "6px 16px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      background: isEditing ? COLORS.gradient2 : "transparent",
                      border: isEditing ? "none" : "1px solid " + COLORS.cardBorder,
                      color: isEditing ? "#000" : COLORS.textSecondary,
                    }}
                  >
                    {isEditing ? "💾 Save Changes" : "✏️ Edit"}
                  </button>
                  {isEditing && (
                    <button
                      onClick={() => { setIsEditing(false); setEditPayload({}); }}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        background: "transparent",
                        border: "1px solid " + COLORS.cardBorder,
                        color: COLORS.textSecondary,
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <Badge status={selected.status} />
                  <Badge status={(p.plan as string) || "basic"} />
                  {(() => {
                    const hours = getHoursSince(selected.created_at);
                    const style = getHoursColor(hours);
                    return (
                      <span
                        style={{
                          padding: "4px 10px",
                          background: style.bg,
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          color: style.color,
                        }}
                      >
                        ⏱️ {hours} hours in queue
                      </span>
                    );
                  })()}
                </div>
              </div>
              {(selected.status === "submitted" || selected.status === "pending_review") && (
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={handleDelete}
                    disabled={actionLoading}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      background: "rgba(255,49,49,0.1)",
                      border: "1px solid rgba(255,49,49,0.3)",
                      color: COLORS.neonRed,
                    }}
                  >
                    🗑️
                  </button>
                  <button
                    onClick={() => setOnboardingAction({ type: "changes", submission: selected })}
                    disabled={actionLoading}
                    style={{
                      padding: "10px 18px",
                      borderRadius: 10,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      background: "rgba(255,255,0,0.2)",
                      border: "none",
                      color: COLORS.neonYellow,
                    }}
                  >
                    ✏️ Request Changes
                  </button>
                  <button
                    onClick={() => setOnboardingAction({ type: "reject", submission: selected })}
                    disabled={actionLoading}
                    style={{
                      padding: "10px 18px",
                      borderRadius: 10,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      background: "rgba(255,49,49,0.2)",
                      border: "none",
                      color: COLORS.neonRed,
                    }}
                  >
                    ❌ Reject
                  </button>
                  <button
                    onClick={() => {
                      const isLinked = !!(linkedBusiness || (p.claim_business_id));
                      setConfirmModal({
                        title: isLinked ? "Approve & Link to Existing Business?" : "Approve & Publish?",
                        message: isLinked
                          ? `This will link the applicant as owner of "${linkedBusiness?.business_name || "the linked business"}" (${linkedBusiness?.id || p.claim_business_id}). Contact info and payout tiers will be updated. The existing business record will NOT be overwritten.`
                          : `This will approve the business application and make "${selected.business_name || (p.publicBusinessName as string) || "this business"}" live on the platform.`,
                        type: isLinked ? "warning" : "info",
                        confirmText: isLinked ? "Approve & Link" : "Approve & Publish",
                        onConfirm: handleApprove,
                      });
                    }}
                    disabled={actionLoading}
                    style={{
                      padding: "10px 18px",
                      borderRadius: 10,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      background: COLORS.gradient2,
                      border: "none",
                      color: "#000",
                    }}
                  >
                    ✓ Approve & Publish
                  </button>
                </div>
              )}
              {(selected.status === "rejected" || selected.status === "needs_changes") && (
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={handleDelete}
                    disabled={actionLoading}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      background: "rgba(255,49,49,0.1)",
                      border: "1px solid rgba(255,49,49,0.3)",
                      color: COLORS.neonRed,
                    }}
                  >
                    🗑️ Delete
                  </button>
                  <button
                    onClick={() => setConfirmModal({
                      title: "Reopen Submission?",
                      message: `This will move "${selected.business_name}" back to "Submitted" status for review.`,
                      type: "info",
                      confirmText: "Reopen",
                      onConfirm: handleReopen,
                    })}
                    disabled={actionLoading}
                    style={{
                      padding: "10px 18px",
                      borderRadius: 10,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      background: COLORS.gradient2,
                      border: "none",
                      color: "#000",
                    }}
                  >
                    🔄 Reopen for Review
                  </button>
                </div>
              )}
              {selected.status === "approved" && (
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={handleDelete}
                    disabled={actionLoading}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      background: "rgba(255,49,49,0.1)",
                      border: "1px solid rgba(255,49,49,0.3)",
                      color: COLORS.neonRed,
                    }}
                  >
                    🗑️ Delete
                  </button>
                </div>
              )}
            </header>

            {/* Content */}
            <div style={{ flex: 1, overflowY: "auto", padding: 32 }}>
              <div style={{ maxWidth: 1100 }}>
                {/* ─── Link to Existing Business ─── */}
                {selected.status !== "approved" && (
                  <div style={{ marginBottom: 28 }}>
                    <SectionTitle icon="🔗">Link to Existing Business</SectionTitle>
                    <Card title={linkedBusiness ? "Linked Business" : "Search & Link"}>
                      {linkedBusiness ? (
                        <div>
                          <div style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "12px 16px", borderRadius: 8,
                            background: "rgba(57,255,20,0.08)", border: "1px solid rgba(57,255,20,0.25)",
                          }}>
                            <div>
                              <span style={{ fontWeight: 700, color: COLORS.neonGreen, fontSize: 14 }}>
                                {linkedBusiness.business_name}
                              </span>
                              <span style={{ color: COLORS.textSecondary, fontSize: 12, marginLeft: 10 }}>
                                {linkedBusiness.city}, {linkedBusiness.state}
                              </span>
                              <div style={{ fontSize: 10, color: COLORS.textSecondary, marginTop: 4, fontFamily: "monospace" }}>
                                {linkedBusiness.id}
                              </div>
                            </div>
                            <button
                              onClick={handleUnlinkBusiness}
                              disabled={actionLoading}
                              style={{
                                padding: "6px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                                background: "rgba(255,49,49,0.15)", border: "1px solid rgba(255,49,49,0.3)",
                                color: COLORS.neonRed, cursor: "pointer",
                              }}
                            >
                              Unlink
                            </button>
                          </div>
                          <div style={{ fontSize: 11, color: COLORS.neonGreen, marginTop: 8 }}>
                            When approved, this submission will update the linked business instead of creating a new one.
                            The owner will be linked, contact info added, and payout tiers updated.
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 10 }}>
                            If this business already exists in the system (e.g. seeded), search and link it here.
                            Approving a linked submission updates the existing record instead of creating a duplicate.
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <input
                              type="text"
                              value={linkSearch}
                              onChange={(e) => setLinkSearch(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") handleLinkSearch(); }}
                              placeholder="Search by business name..."
                              style={{
                                flex: 1, padding: "8px 12px", borderRadius: 8, fontSize: 13,
                                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                                color: "#fff", outline: "none",
                              }}
                            />
                            <button
                              onClick={handleLinkSearch}
                              disabled={linkSearching || !linkSearch.trim()}
                              style={{
                                padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                                background: "rgba(0,212,255,0.15)", border: "1px solid rgba(0,212,255,0.3)",
                                color: COLORS.neonBlue, cursor: "pointer",
                                opacity: linkSearching || !linkSearch.trim() ? 0.5 : 1,
                              }}
                            >
                              {linkSearching ? "..." : "Search"}
                            </button>
                          </div>
                          {linkResults.length > 0 && (
                            <div style={{ marginTop: 10, maxHeight: 200, overflowY: "auto" }}>
                              {linkResults.map((biz) => (
                                <div
                                  key={biz.id}
                                  style={{
                                    display: "flex", alignItems: "center", justifyContent: "space-between",
                                    padding: "8px 12px", borderRadius: 6, marginBottom: 4,
                                    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                                  }}
                                >
                                  <div>
                                    <span style={{ fontWeight: 600, fontSize: 13, color: "#fff" }}>{biz.business_name}</span>
                                    <span style={{ color: COLORS.textSecondary, fontSize: 11, marginLeft: 8 }}>
                                      {biz.city}, {biz.state}
                                    </span>
                                    {biz.seeded_at && (
                                      <span style={{
                                        fontSize: 9, fontWeight: 700, marginLeft: 8, padding: "2px 6px", borderRadius: 4,
                                        background: "rgba(255,255,0,0.12)", color: COLORS.neonYellow,
                                        border: "1px solid rgba(255,255,0,0.25)",
                                      }}>
                                        SEEDED
                                      </span>
                                    )}
                                    <div style={{ fontSize: 10, color: COLORS.textSecondary, marginTop: 2, fontFamily: "monospace" }}>
                                      {biz.id}
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => handleLinkBusiness(biz)}
                                    disabled={actionLoading}
                                    style={{
                                      padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                                      background: "rgba(57,255,20,0.12)", border: "1px solid rgba(57,255,20,0.3)",
                                      color: COLORS.neonGreen, cursor: "pointer", whiteSpace: "nowrap",
                                    }}
                                  >
                                    Link
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </Card>
                  </div>
                )}

                {/* Business Identity */}
                <SectionTitle icon="🏢">Business Identity</SectionTitle>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
                  <Card title="Basic Information">
                    <EditField label="Legal Business Name" value={pVal("businessName") as string} editable={isEditing} onChange={(v) => setPayloadField("businessName", v)} />
                    <EditField label="Public Display Name" value={pVal("publicBusinessName") as string} editable={isEditing} onChange={(v) => setPayloadField("publicBusinessName", v)} />
                    <EditField
                      label="Business Type"
                      value={(pVal("businessTypeTag") as string) || (pVal("businessType") as string)}
                      editable={isEditing}
                      onChange={(v) => { setPayloadField("businessTypeTag", v); setPayloadField("businessType", v); }}
                      options={businessTypeOptions}
                    />
                    <EditField
                      label="Age Restriction"
                      value={pVal("ageRestriction") as string}
                      editable={isEditing}
                      onChange={(v) => setPayloadField("ageRestriction", v)}
                      options={[
                        { value: "all", label: "All Ages" },
                        { value: "21", label: "21+" },
                        { value: "18", label: "18+" },
                      ]}
                    />
                    <EditField
                      label="Price Range"
                      value={pVal("priceLevel") as string}
                      editable={isEditing}
                      onChange={(v) => setPayloadField("priceLevel", v)}
                      options={[
                        { value: "$", label: "$ (Under $15/person)" },
                        { value: "$$", label: "$$ ($15–$30/person)" },
                        { value: "$$$", label: "$$$ ($30–$60/person)" },
                        { value: "$$$$", label: "$$$$ ($60+/person)" },
                      ]}
                    />
                    {/* Selected Tags */}
                    {Array.isArray(pVal("selectedTags")) && (pVal("selectedTags") as string[]).length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "#a0a0b0", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Tags</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {(pVal("selectedTags") as string[]).map(tag => (
                            <span key={tag} style={{ padding: "4px 10px", borderRadius: 12, fontSize: "0.75rem", fontWeight: 500, background: "rgba(255,107,53,0.12)", color: "#ff6b35", border: "1px solid rgba(255,107,53,0.25)" }}>{tag}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    <EditField label="Referred By" value={pVal("referredBy") as string} editable={isEditing} onChange={(v) => setPayloadField("referredBy", v)} />
                  </Card>
                  <Card title="Primary Contact">
                    <EditField label="Full Name" value={pVal("fullName") as string} editable={isEditing} onChange={(v) => setPayloadField("fullName", v)} />
                    <EditField label="Role/Title" value={pVal("role") as string} editable={isEditing} onChange={(v) => setPayloadField("role", v)} />
                    <EditField label="Email" value={pVal("email") as string} type="email" editable={isEditing} onChange={(v) => setPayloadField("email", v)} />
                    <EditField label="Phone" value={pVal("phone") as string} type="tel" editable={isEditing} onChange={(v) => setPayloadField("phone", v)} />
                  </Card>
                </div>

                {/* Location */}
                {(() => {
                  const isVerified = p._addressVerified === true;
                  const isUnverified = p._addressVerified === false;
                  // Not yet checked = no flag at all (null/undefined)
                  return (
                    <>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <SectionTitle icon="📍">Location</SectionTitle>
                          {isVerified && (
                            <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.neonGreen, background: "rgba(57,255,20,0.1)", padding: "3px 10px", borderRadius: 6 }}>
                              ✓ Verified
                            </span>
                          )}
                          {isUnverified && (
                            <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.neonRed, background: "rgba(255,49,49,0.1)", padding: "3px 10px", borderRadius: 6, animation: "pulse 2s infinite" }}>
                              ⚠️ Unverified Address
                            </span>
                          )}
                        </div>
                        <button
                          onClick={handleVerifyAddress}
                          disabled={verifyingAddress}
                          style={{
                            padding: "8px 16px",
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: verifyingAddress ? "wait" : "pointer",
                            background: isUnverified ? "rgba(255,49,49,0.15)" : isVerified ? "rgba(57,255,20,0.15)" : "rgba(0,212,255,0.15)",
                            border: "1px solid " + (isUnverified ? COLORS.neonRed : isVerified ? COLORS.neonGreen : COLORS.neonBlue),
                            color: isUnverified ? COLORS.neonRed : isVerified ? COLORS.neonGreen : COLORS.neonBlue,
                            opacity: verifyingAddress ? 0.6 : 1,
                          }}
                        >
                          {verifyingAddress ? "⏳ Verifying..." : isVerified ? "✓ Re-verify" : "📍 Verify Address"}
                        </button>
                      </div>
                      <Card style={{
                        marginBottom: 24,
                        border: isUnverified ? "2px solid " + COLORS.neonRed : isVerified ? "2px solid " + COLORS.neonGreen : undefined,
                        background: isUnverified ? "rgba(255,49,49,0.03)" : undefined,
                      }}>
                        {isUnverified && (
                          <div style={{ marginBottom: 12, padding: "8px 12px", background: "rgba(255,49,49,0.1)", borderRadius: 8, fontSize: 12, color: COLORS.neonRed, fontWeight: 600 }}>
                            ⚠️ This address was not verified by Google Maps. Please verify before approving.
                          </div>
                        )}
                        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 16 }}>
                          <EditField label="Street Address" value={pVal("streetAddress") as string} editable={isEditing} onChange={(v) => setPayloadField("streetAddress", v)} />
                          <EditField label="City" value={pVal("city") as string} editable={isEditing} onChange={(v) => setPayloadField("city", v)} />
                          <EditField label="State" value={pVal("state") as string} editable={isEditing} onChange={(v) => setPayloadField("state", v)} />
                          <EditField label="ZIP Code" value={pVal("zip") as string} editable={isEditing} onChange={(v) => setPayloadField("zip", v)} />
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                          <EditField label="Business Phone" value={pVal("businessPhone") as string} editable={isEditing} onChange={(v) => setPayloadField("businessPhone", v)} />
                          <EditField label="Customer Email" value={pVal("customerEmail") as string} editable={isEditing} onChange={(v) => setPayloadField("customerEmail", v)} />
                          <EditField label="Website" value={pVal("website") as string} editable={isEditing} onChange={(v) => setPayloadField("website", v)} />
                        </div>
                      </Card>
                    </>
                  );
                })()}

                {/* Hours */}
                {p.hours ? (
                  <>
                    <SectionTitle icon="🕐">Operating Hours</SectionTitle>
                    <Card style={{ marginBottom: 24 }}>
                      <HoursGrid hours={p.hours as Record<string, { enabled?: boolean; open?: string; close?: string }>} editable />
                    </Card>
                  </>
                ) : null}

                {/* Plan & Payout */}
                <SectionTitle icon="💰">Plan & Payout Configuration</SectionTitle>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
                  <Card title="Subscription">
                    <EditField
                      label="Plan"
                      value={pVal("plan") as string}
                      editable={isEditing}
                      onChange={(v) => setPayloadField("plan", v)}
                      options={[
                        { value: "basic", label: "Basic" },
                        { value: "premium", label: "Premium" },
                      ]}
                    />
                    <EditField
                      label="Payment Method"
                      value={pVal("paymentMethod") as string}
                      editable={isEditing}
                      onChange={(v) => setPayloadField("paymentMethod", v)}
                      options={[
                        { value: "bank", label: "Bank Account (ACH)" },
                        { value: "card", label: "Credit Card" },
                      ]}
                    />
                    <EditField
                      label="Payout Preset"
                      value={pVal("payoutPreset") as string}
                      editable={isEditing}
                      onChange={(v) => setPayloadField("payoutPreset", v)}
                      options={[
                        { value: "conservative", label: "Conservative" },
                        { value: "standard", label: "Standard" },
                        { value: "aggressive", label: "Aggressive" },
                      ]}
                    />
                  </Card>
                  {p.payoutBps ? (
                    <Card title="Payout Tiers (BPS)">
                      <TiersDisplay tiers={p.payoutBps as number[]} editable />
                      <div style={{ marginTop: 16, fontSize: 11, color: COLORS.textSecondary }}>
                        These rates determine the cashback percentage users receive at each loyalty level.
                      </div>
                    </Card>
                  ) : null}
                </div>

                {/* Premium Add-ons */}
                {p.premiumAddons ? (
                  <>
                    <SectionTitle icon="⭐">Premium Add-ons</SectionTitle>
                    <Card style={{ marginBottom: 24 }}>
                      <Checklist
                        editable
                        items={[
                          { label: "Video Add-on ($50/mo)", checked: !!(p.premiumAddons as Record<string, boolean>).videoAddon },
                          { label: "Live Capacity 15 ($25/mo)", checked: !!(p.premiumAddons as Record<string, boolean>).liveAddon15 },
                          { label: "Live Capacity 30 ($40/mo)", checked: !!(p.premiumAddons as Record<string, boolean>).liveAddon30 },
                        ]}
                      />
                    </Card>
                  </>
                ) : null}

                {/* Advertising - Full ADS_CATALOG grid matching original */}
                {(p.wantsCustomAdsCall || p.selectedAds) ? (
                  <>
                    <SectionTitle icon="📢">Advertising</SectionTitle>
                    <Card style={{ marginBottom: 24 }}>
                      <Checklist items={[{ label: "Wants Custom Ads Consultation Call", checked: !!p.wantsCustomAdsCall }]} />
                      {!!p.selectedAds && (
                        <div style={{ marginTop: 20 }}>
                          <div
                            style={{
                              fontSize: 12,
                              color: COLORS.textSecondary,
                              marginBottom: 12,
                              textTransform: "uppercase",
                              fontWeight: 600,
                            }}
                          >
                            Selected Ad Packages
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            {ADS_CATALOG.map((ad) => {
                              const selectedAds = p.selectedAds as Record<string, boolean>;
                              const isChecked = !!selectedAds[ad.id];
                              return (
                                <div
                                  key={ad.id}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 12,
                                    padding: 14,
                                    background: COLORS.darkBg,
                                    borderRadius: 10,
                                    border: isChecked ? "2px solid " + COLORS.neonPink : "1px solid " + COLORS.cardBorder,
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    readOnly
                                    style={{ accentColor: COLORS.neonPink, width: 18, height: 18 }}
                                  />
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, fontSize: 13 }}>{ad.title}</div>
                                    <div style={{ fontSize: 11, color: COLORS.textSecondary }}>{ad.description}</div>
                                  </div>
                                  <div style={{ fontWeight: 700, color: COLORS.neonGreen }}>{formatMoney(ad.price)}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {p.adStartDate ? <EditField label="Requested Start Date" value={p.adStartDate as string} type="date" /> : null}
                      {p.adNotes ? <EditField label="Ad Campaign Notes" value={p.adNotes as string} textarea /> : null}
                    </Card>
                  </>
                ) : null}

                {/* Verification */}
                {p.verifierName ? (
                  <>
                    <SectionTitle icon="📋">Receipt Verification</SectionTitle>
                    <Card style={{ marginBottom: 24 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                        <EditField label="Verifier Name" value={pVal("verifierName") as string} editable={isEditing} onChange={(v) => setPayloadField("verifierName", v)} />
                        <EditField label="Verifier Email" value={pVal("verifierEmail") as string} editable={isEditing} onChange={(v) => setPayloadField("verifierEmail", v)} />
                        <EditField label="Verifier Phone" value={pVal("verifierPhone") as string} editable={isEditing} onChange={(v) => setPayloadField("verifierPhone", v)} />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
                        <EditField
                          label="Auto-Approval"
                          value={p.autoApprovalEnabled ? "Enabled" : "Disabled"}
                          options={[
                            { value: "true", label: "Enabled" },
                            { value: "false", label: "Disabled" },
                          ]}
                        />
                        <EditField label="Auto-Approve Max Amount ($)" value={p.autoApprovalMax as number} type="number" />
                      </div>
                    </Card>
                  </>
                ) : null}

                {/* Marketing Permissions */}
                {p.marketingPermissions ? (
                  <>
                    <SectionTitle icon="📣">Marketing Permissions</SectionTitle>
                    <Card style={{ marginBottom: 24 }}>
                      <Checklist
                        items={[
                          { label: "Allow User Photo/Video Uploads", checked: !!(p.marketingPermissions as Record<string, boolean>).userUploads },
                          { label: "Feature in Discovery Feed", checked: !!(p.marketingPermissions as Record<string, boolean>).featureInDiscovery },
                          { label: "Participate in A/B Testing", checked: !!(p.marketingPermissions as Record<string, boolean>).abTesting },
                        ]}
                      />
                    </Card>
                  </>
                ) : null}

                {/* Files */}
                {(p.verificationDocFile || p.businessLogoFile || p.promoVideoFile) ? (
                  <>
                    <SectionTitle icon="📁">Uploaded Files</SectionTitle>
                    <Card style={{ marginBottom: 24 }}>
                      <MediaGrid
                        items={[
                          p.verificationDocFile as { name?: string; url?: string } | null,
                          p.businessLogoFile as { name?: string; url?: string } | null,
                          p.promoVideoFile as { name?: string; url?: string } | null,
                        ].filter(Boolean)}
                        onPreview={setPreview}
                      />
                    </Card>
                  </>
                ) : null}

                {/* Legal Agreements */}
                {p.legal ? (
                  <>
                    <SectionTitle icon="✍️">Legal Agreements</SectionTitle>
                    <Card>
                      <Checklist
                        items={[
                          { label: "Authorize Recurring Charges", checked: !!p.authorizeCharges },
                          { label: "Terms of Service", checked: !!(p.legal as Record<string, boolean>).terms },
                          { label: "Billing Policy", checked: !!(p.legal as Record<string, boolean>).billingPolicy },
                          { label: "Content Policy", checked: !!(p.legal as Record<string, boolean>).contentPolicy },
                          { label: "Fraud Prevention Agreement", checked: !!(p.legal as Record<string, boolean>).fraud },
                          { label: "Electronic Signature Binding", checked: !!p.signatureBinding },
                        ]}
                      />
                      <div style={{ marginTop: 20, padding: 16, background: COLORS.darkBg, borderRadius: 10 }}>
                        <div style={{ fontSize: 12, color: COLORS.textSecondary }}>Signed by</div>
                        <div style={{ fontWeight: 600, fontSize: 16 }}>{String(p.signatureName || "—")}</div>
                        <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 4 }}>
                          on {formatDateTime(p.submittedAt as string)}
                        </div>
                      </div>
                    </Card>
                  </>
                ) : null}

                {/* User ID info */}
                {!!selected.user_id && (
                  <div
                    style={{
                      marginTop: 24,
                      padding: 16,
                      background: COLORS.cardBg,
                      borderRadius: 12,
                      border: "1px solid " + COLORS.cardBorder,
                    }}
                  >
                    <span style={{ fontSize: 12, color: COLORS.textSecondary }}>Linked User ID: </span>
                    <span style={{ fontSize: 12, color: COLORS.neonBlue, fontFamily: "monospace" }}>{selected.user_id}</span>
                  </div>
                )}

                {/* Review History */}
                {(selected.review_message || (selected.review_history && selected.review_history.length > 0)) && (
                  <>
                    <SectionTitle icon="📋">Review History</SectionTitle>
                    <Card style={{ marginBottom: 24 }}>
                      {/* Current review message */}
                      {selected.review_message && (
                        <div style={{
                          padding: 16,
                          background: selected.status === "rejected" ? "rgba(255,49,49,0.06)" : "rgba(255,255,0,0.04)",
                          borderRadius: 10,
                          border: selected.status === "rejected" ? "1px solid rgba(255,49,49,0.2)" : "1px solid rgba(255,255,0,0.15)",
                          marginBottom: 14,
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                            <div style={{ fontWeight: 700, fontSize: 12, color: selected.status === "rejected" ? COLORS.neonRed : COLORS.neonYellow }}>
                              {selected.status === "rejected" ? "❌ Rejection Reason" : "✏️ Changes Requested"}
                            </div>
                            {selected.reviewed_at && (
                              <span style={{ fontSize: 11, color: COLORS.textSecondary }}>
                                by {selected.reviewed_by || "Staff"} • {new Date(selected.reviewed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 13, color: COLORS.textPrimary, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                            {selected.review_message}
                          </div>
                        </div>
                      )}
                      {/* Full history timeline */}
                      {selected.review_history && selected.review_history.length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, color: COLORS.textSecondary, fontWeight: 600, textTransform: "uppercase", marginBottom: 10 }}>Timeline</div>
                          {selected.review_history.map((entry, i) => (
                            <div key={i} style={{
                              padding: 12,
                              borderLeft: "3px solid " + (entry.action === "rejected" ? COLORS.neonRed : entry.action === "needs_changes" ? COLORS.neonYellow : COLORS.neonGreen),
                              marginBottom: 8,
                              background: COLORS.darkBg,
                              borderRadius: "0 8px 8px 0",
                            }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: entry.action === "rejected" ? COLORS.neonRed : COLORS.neonYellow }}>
                                  {entry.action === "rejected" ? "❌ Rejected" : "✏️ Changes Requested"}
                                </span>
                                <span style={{ fontSize: 10, color: COLORS.textSecondary }}>
                                  {entry.by} • {new Date(entry.at).toLocaleDateString("en-US", { month: "short", day: "numeric" })} {new Date(entry.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                                </span>
                              </div>
                              <div style={{ fontSize: 12, color: COLORS.textPrimary, lineHeight: 1.4 }}>{entry.message}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  </>
                )}

                {/* Staff Notes */}
                <SectionTitle icon="📝">Staff Notes</SectionTitle>
                <Card style={{ marginBottom: 24 }}>
                  {/* Add Note Form */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                      <input
                        type="text"
                        placeholder="Your name..."
                        value={noteAuthor}
                        onChange={(e) => setNoteAuthor(e.target.value)}
                        style={{
                          width: 140,
                          padding: "10px 12px",
                          borderRadius: 8,
                          border: "1px solid " + COLORS.cardBorder,
                          background: COLORS.darkBg,
                          color: COLORS.textPrimary,
                          fontSize: 12,
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <textarea
                          placeholder="Add a note about this submission... (e.g. 'Called owner, waiting on updated license')"
                          value={newNote}
                          onChange={(e) => setNewNote(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleAddOnboardingNote();
                            }
                          }}
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            borderRadius: 8,
                            border: "1px solid " + COLORS.cardBorder,
                            background: COLORS.darkBg,
                            color: COLORS.textPrimary,
                            fontSize: 12,
                            minHeight: 42,
                            maxHeight: 120,
                            resize: "vertical",
                          }}
                        />
                      </div>
                      <button
                        onClick={handleAddOnboardingNote}
                        disabled={!newNote.trim()}
                        style={{
                          padding: "10px 18px",
                          borderRadius: 8,
                          background: newNote.trim() ? COLORS.gradient2 : COLORS.darkBg,
                          border: newNote.trim() ? "none" : "1px solid " + COLORS.cardBorder,
                          color: newNote.trim() ? "#000" : COLORS.textSecondary,
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: newNote.trim() ? "pointer" : "not-allowed",
                          whiteSpace: "nowrap",
                          alignSelf: "flex-start",
                        }}
                      >
                        + Add Note
                      </button>
                    </div>
                  </div>
                  {/* Notes List */}
                  {!selected.staff_notes || selected.staff_notes.length === 0 ? (
                    <div style={{ padding: 30, textAlign: "center", color: COLORS.textSecondary }}>
                      <div style={{ fontSize: 24, marginBottom: 6 }}>📝</div>
                      No staff notes yet — add the first note above
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {selected.staff_notes.map((note) => (
                        <div
                          key={note.id}
                          style={{
                            padding: 14,
                            borderRadius: 10,
                            background: note.pinned ? "rgba(255,255,0,0.04)" : COLORS.darkBg,
                            border: note.pinned ? "1px solid rgba(255,255,0,0.2)" : "1px solid " + COLORS.cardBorder,
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              {note.pinned && <span style={{ fontSize: 11 }}>📌</span>}
                              <span style={{ fontWeight: 700, fontSize: 12, color: COLORS.neonBlue }}>{note.author_name}</span>
                              <span style={{ fontSize: 11, color: COLORS.textSecondary }}>
                                {new Date(note.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                {" "}
                                {new Date(note.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                              </span>
                            </div>
                            <div style={{ display: "flex", gap: 4 }}>
                              <button
                                onClick={() => handleTogglePinOnboardingNote(note.id, note.pinned)}
                                title={note.pinned ? "Unpin" : "Pin"}
                                style={{
                                  padding: "3px 8px",
                                  borderRadius: 6,
                                  background: "transparent",
                                  border: "1px solid " + COLORS.cardBorder,
                                  color: note.pinned ? COLORS.neonYellow : COLORS.textSecondary,
                                  cursor: "pointer",
                                  fontSize: 11,
                                }}
                              >
                                📌
                              </button>
                              <button
                                onClick={() =>
                                  setConfirmModal({
                                    title: "Delete Note?",
                                    message: `Delete this note from ${note.author_name}? This cannot be undone.`,
                                    type: "danger",
                                    confirmText: "Delete",
                                    onConfirm: () => { handleDeleteOnboardingNote(note.id); setConfirmModal(null); },
                                  })
                                }
                                title="Delete"
                                style={{
                                  padding: "3px 8px",
                                  borderRadius: 6,
                                  background: "transparent",
                                  border: "1px solid " + COLORS.cardBorder,
                                  color: COLORS.textSecondary,
                                  cursor: "pointer",
                                  fontSize: 11,
                                }}
                              >
                                🗑
                              </button>
                            </div>
                          </div>
                          <div style={{ fontSize: 13, color: COLORS.textPrimary, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                            {note.note}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {selected.staff_notes && selected.staff_notes.length > 0 && (
                    <div style={{ marginTop: 10, fontSize: 11, color: COLORS.textSecondary, textAlign: "right" }}>
                      {selected.staff_notes.length} note{selected.staff_notes.length !== 1 ? "s" : ""} • {selected.staff_notes.filter((n) => n.pinned).length} pinned
                    </div>
                  )}
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}