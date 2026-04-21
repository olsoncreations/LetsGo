"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { COLORS } from "@/components/admin/constants";
import { Card, StatCard, Badge } from "@/components/admin/components";

// ── Types ──

interface GeoStats {
  total: number;
  pending: number;
  matched: number;
  mismatch: number;
  noResult: number;
  approvedGoogle: number;
  approvedNominatim: number;
  approvedManual: number;
  skipped: number;
}

interface GeoBusiness {
  id: string;
  business_name: string;
  street_address: string;
  city: string;
  state: string;
  zip: string;
  latitude: number | null;
  longitude: number | null;
  nominatim_lat: number | null;
  nominatim_lng: number | null;
  geocode_status: string;
  geocode_distance_miles: number | null;
  geocode_checked_at: string | null;
  geocode_reviewed_by: string | null;
  geocode_reviewed_at: string | null;
}

// ── Helpers ──

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabaseBrowser.auth.getSession();
  const token = session?.access_token;
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : {};
}

function distColor(d: number | null): string {
  if (d === null) return COLORS.textSecondary;
  if (d <= 0.3) return COLORS.neonGreen;
  if (d <= 1.0) return COLORS.neonYellow;
  return COLORS.neonRed;
}

function statusLabel(s: string): string {
  return s.replace(/_/g, " ");
}

function badgeStatus(s: string): string {
  if (s === "matched") return "approved";
  if (s === "mismatch") return "pending";
  if (s === "no_result") return "expired";
  if (s === "approved_google" || s === "approved_nominatim" || s === "approved_manual") return "approved";
  if (s === "skipped") return "expired";
  return "submitted";
}

// ── Main Page ──

export default function GeocodeQAPage() {
  const [stats, setStats] = useState<GeoStats | null>(null);
  const [businesses, setBusinesses] = useState<GeoBusiness[]>([]);
  const [totalReview, setTotalReview] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reviewFilter, setReviewFilter] = useState("mismatch");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Batch state
  const [isRunning, setIsRunning] = useState(false);
  const [batchProcessed, setBatchProcessed] = useState(0);
  const [batchTotal, setBatchTotal] = useState(0);
  const [threshold, setThreshold] = useState(0.3);
  const stopRef = useRef(false);

  // Manual coords modal
  const [manualModal, setManualModal] = useState<{ id: string; name: string } | null>(null);
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [bulkApproving, setBulkApproving] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/geocode/stats", { headers });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch { /* silent */ }
  }, []);

  const fetchReview = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/admin/geocode/review?status=${reviewFilter}&limit=50`, { headers });
      if (res.ok) {
        const data = await res.json();
        setBusinesses(data.businesses || []);
        setTotalReview(data.total || 0);
      }
    } catch { /* silent */ }
  }, [reviewFilter]);

  useEffect(() => {
    Promise.all([fetchStats(), fetchReview()]).then(() => setLoading(false));
  }, [fetchStats, fetchReview]);

  // ── Batch Processing ──

  const runBatch = useCallback(async () => {
    setIsRunning(true);
    stopRef.current = false;
    setBatchProcessed(0);
    const startPending = stats?.pending || 0;
    setBatchTotal(startPending);

    let totalProcessed = 0;

    while (!stopRef.current) {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch("/api/admin/geocode/batch", {
          method: "POST",
          headers,
          body: JSON.stringify({ batchSize: 50, threshold }),
        });

        if (!res.ok) break;
        const data = await res.json();

        totalProcessed += data.processed;
        setBatchProcessed(totalProcessed);
        setBatchTotal(totalProcessed + data.remaining);

        await fetchStats();

        if (data.remaining === 0 || data.processed === 0) break;

        // Small pause between batches
        await new Promise(r => setTimeout(r, 500));
      } catch {
        break;
      }
    }

    setIsRunning(false);
    await fetchStats();
    await fetchReview();
  }, [stats, threshold, fetchStats, fetchReview]);

  const stopBatch = useCallback(() => {
    stopRef.current = true;
  }, []);

  // ── Bulk Approve ──

  const handleBulkApproveGoogle = useCallback(async () => {
    if (!confirm(`Approve Google coordinates for all ${stats?.mismatch || 0} mismatched businesses?`)) return;
    setBulkApproving(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/geocode/review", {
        method: "PUT",
        headers,
        body: JSON.stringify({ action: "bulk_approve_google" }),
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Approved ${data.updated} businesses with Google coordinates.`);
        await fetchStats();
        await fetchReview();
      }
    } catch { /* silent */ }
    setBulkApproving(false);
  }, [stats, fetchStats, fetchReview]);

  // ── Review Actions ──

  const handleAction = useCallback(async (businessId: string, action: string, mLat?: number, mLng?: number) => {
    try {
      const headers = await getAuthHeaders();
      const body: Record<string, unknown> = { businessId, action };
      if (action === "approve_manual" && mLat != null && mLng != null) {
        body.manualLat = mLat;
        body.manualLng = mLng;
      }
      const res = await fetch("/api/admin/geocode/review", {
        method: "PATCH",
        headers,
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setBusinesses(prev => prev.filter(b => b.id !== businessId));
        setTotalReview(prev => prev - 1);
        await fetchStats();
      }
    } catch { /* silent */ }
  }, [fetchStats]);

  const handleManualSubmit = useCallback(() => {
    if (!manualModal) return;
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (isNaN(lat) || isNaN(lng)) return;
    handleAction(manualModal.id, "approve_manual", lat, lng);
    setManualModal(null);
    setManualLat("");
    setManualLng("");
  }, [manualModal, manualLat, manualLng, handleAction]);

  if (loading) {
    return (
      <div style={{ padding: 32, color: COLORS.textPrimary }}>
        <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>📍 Geocode QA</div>
        <div style={{ color: COLORS.textSecondary }}>Loading...</div>
      </div>
    );
  }

  const approvedTotal = (stats?.approvedGoogle || 0) + (stats?.approvedNominatim || 0) + (stats?.approvedManual || 0);
  const progressPct = batchTotal > 0 ? Math.round((batchProcessed / batchTotal) * 100) : 0;
  const etaMinutes = batchTotal > 0 ? Math.ceil((batchTotal - batchProcessed) * 1.1 / 60) : 0;

  return (
    <div style={{ padding: 32, color: COLORS.textPrimary, maxWidth: 1400 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>📍 Geocode QA</div>
          <div style={{ color: COLORS.textSecondary, fontSize: 13, marginTop: 4 }}>
            Cross-reference GPS coordinates with OpenStreetMap to find and fix inaccurate locations
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, marginBottom: 24 }}>
        <StatCard value={stats?.pending || 0} label="Pending" gradient={COLORS.gradient1} icon="⏳" />
        <StatCard value={stats?.matched || 0} label="Matched" gradient={COLORS.gradient2} icon="✅" />
        <StatCard value={stats?.mismatch || 0} label="Mismatches" gradient="linear-gradient(135deg, #ffff00, #ff6b35)" icon="⚠️" />
        <StatCard value={stats?.noResult || 0} label="No Result" gradient="linear-gradient(135deg, #3d3d5c, #2d2d44)" icon="❓" />
        <StatCard value={approvedTotal} label="Reviewed" gradient={COLORS.gradient3} icon="👤" />
        <StatCard value={stats?.skipped || 0} label="Skipped" gradient="linear-gradient(135deg, #3d3d5c, #2d2d44)" icon="⏭️" />
      </div>

      {/* Batch Controls */}
      <Card title="BATCH PROCESSING" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          {/* Threshold slider */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: COLORS.textSecondary }}>Auto-approve threshold:</span>
            <input
              type="range" min={0.1} max={1.0} step={0.1} value={threshold}
              onChange={e => setThreshold(parseFloat(e.target.value))}
              style={{ width: 120, accentColor: COLORS.neonBlue }}
              disabled={isRunning}
            />
            <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.neonBlue, minWidth: 50 }}>{threshold.toFixed(1)} mi</span>
          </div>

          {/* Run/Stop button */}
          {!isRunning ? (
            <button
              onClick={runBatch}
              disabled={(stats?.pending || 0) === 0}
              style={{
                padding: "10px 24px",
                borderRadius: 8,
                border: "none",
                background: (stats?.pending || 0) > 0 ? COLORS.gradient2 : COLORS.cardBorder,
                color: (stats?.pending || 0) > 0 ? "#000" : COLORS.textSecondary,
                fontWeight: 700,
                fontSize: 13,
                cursor: (stats?.pending || 0) > 0 ? "pointer" : "not-allowed",
              }}
            >
              ▶ Run Batch ({stats?.pending || 0} pending)
            </button>
          ) : (
            <button
              onClick={stopBatch}
              style={{
                padding: "10px 24px",
                borderRadius: 8,
                border: "none",
                background: COLORS.gradient1,
                color: "#fff",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              ⏹ Stop
            </button>
          )}
        </div>

        {/* Progress bar */}
        {isRunning && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: COLORS.textSecondary }}>
                {batchProcessed} / {batchTotal} processed
              </span>
              <span style={{ fontSize: 12, color: COLORS.textSecondary }}>
                ~{etaMinutes} min remaining
              </span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: COLORS.cardBorder, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${progressPct}%`,
                background: COLORS.gradient2,
                borderRadius: 4,
                transition: "width 0.3s ease",
              }} />
            </div>
          </div>
        )}
      </Card>

      {/* Bulk Actions */}
      {(stats?.mismatch || 0) > 0 && (
        <Card style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Bulk Resolve Mismatches</div>
              <div style={{ fontSize: 12, color: COLORS.textSecondary }}>
                Keep Google coordinates for all {stats?.mismatch || 0} mismatched businesses. Business owners can correct their pin later.
              </div>
            </div>
            <button
              onClick={handleBulkApproveGoogle}
              disabled={bulkApproving}
              style={{
                padding: "10px 24px",
                borderRadius: 8,
                border: "none",
                background: bulkApproving ? COLORS.cardBorder : COLORS.gradient2,
                color: "#000",
                fontWeight: 700,
                fontSize: 13,
                cursor: bulkApproving ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {bulkApproving ? "Processing..." : `✓ Approve All Google (${stats?.mismatch || 0})`}
            </button>
          </div>
        </Card>
      )}

      {/* Review Table */}
      <Card
        title="REVIEW QUEUE"
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            {["mismatch", "no_result", "matched", "approved_google,approved_nominatim,approved_manual", "skipped"].map(f => {
              const label = f === "approved_google,approved_nominatim,approved_manual" ? "reviewed" : f.replace(/_/g, " ");
              return (
                <button
                  key={f}
                  onClick={() => setReviewFilter(f)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 6,
                    border: `1px solid ${reviewFilter === f ? COLORS.neonBlue : COLORS.cardBorder}`,
                    background: reviewFilter === f ? `${COLORS.neonBlue}20` : "transparent",
                    color: reviewFilter === f ? COLORS.neonBlue : COLORS.textSecondary,
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    cursor: "pointer",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        }
      >
        {businesses.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: COLORS.textSecondary }}>
            No businesses with status &quot;{reviewFilter.replace(/_/g, " ")}&quot;
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 12 }}>
              {totalReview} total · Showing {businesses.length}
            </div>

            {/* Table header */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "2fr 2fr 80px 100px 1fr",
              gap: 12,
              padding: "8px 12px",
              borderBottom: `1px solid ${COLORS.cardBorder}`,
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              color: COLORS.textSecondary,
              letterSpacing: "0.08em",
            }}>
              <div>Business</div>
              <div>Address</div>
              <div>Distance</div>
              <div>Status</div>
              <div style={{ textAlign: "right" }}>Actions</div>
            </div>

            {/* Table rows */}
            {businesses.map(biz => {
              const isExpanded = expandedId === biz.id;
              return (
                <div key={biz.id}>
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : biz.id)}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "2fr 2fr 80px 100px 1fr",
                      gap: 12,
                      padding: "12px",
                      borderBottom: `1px solid ${COLORS.cardBorder}`,
                      cursor: "pointer",
                      background: isExpanded ? `${COLORS.neonBlue}08` : "transparent",
                      transition: "background 0.15s",
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {biz.business_name}
                    </div>
                    <div style={{ fontSize: 12, color: COLORS.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {[biz.street_address, biz.city, biz.state, biz.zip].filter(Boolean).join(", ")}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: distColor(biz.geocode_distance_miles) }}>
                      {biz.geocode_distance_miles != null ? `${biz.geocode_distance_miles.toFixed(2)} mi` : "—"}
                    </div>
                    <div><Badge status={badgeStatus(biz.geocode_status)} /></div>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                      {(biz.geocode_status === "mismatch" || biz.geocode_status === "no_result") && (
                        <>
                          <ActionBtn label="Google" color={COLORS.neonGreen} onClick={e => { e.stopPropagation(); handleAction(biz.id, "approve_google"); }} />
                          {biz.nominatim_lat != null && (
                            <ActionBtn label="OSM" color={COLORS.neonBlue} onClick={e => { e.stopPropagation(); handleAction(biz.id, "approve_nominatim"); }} />
                          )}
                          <ActionBtn label="Manual" color={COLORS.neonPurple} onClick={e => { e.stopPropagation(); setManualModal({ id: biz.id, name: biz.business_name }); }} />
                          <ActionBtn label="Skip" color={COLORS.textSecondary} onClick={e => { e.stopPropagation(); handleAction(biz.id, "skip"); }} />
                        </>
                      )}
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div style={{ padding: "16px 12px", borderBottom: `1px solid ${COLORS.cardBorder}`, background: `${COLORS.neonBlue}05` }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.neonGreen, textTransform: "uppercase", marginBottom: 8 }}>
                            Google Places
                          </div>
                          <div style={{ fontSize: 13 }}>
                            {biz.latitude != null ? `${biz.latitude.toFixed(6)}, ${biz.longitude?.toFixed(6)}` : "No coordinates"}
                          </div>
                          {biz.latitude != null && (
                            <a
                              href={`https://www.google.com/maps?q=${biz.latitude},${biz.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontSize: 11, color: COLORS.neonBlue, textDecoration: "none", marginTop: 4, display: "inline-block" }}
                            >
                              Open in Google Maps ↗
                            </a>
                          )}
                        </div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.neonBlue, textTransform: "uppercase", marginBottom: 8 }}>
                            OpenStreetMap (Nominatim)
                          </div>
                          <div style={{ fontSize: 13 }}>
                            {biz.nominatim_lat != null ? `${biz.nominatim_lat.toFixed(6)}, ${biz.nominatim_lng?.toFixed(6)}` : "No result"}
                          </div>
                          {biz.nominatim_lat != null && (
                            <a
                              href={`https://www.google.com/maps?q=${biz.nominatim_lat},${biz.nominatim_lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontSize: 11, color: COLORS.neonBlue, textDecoration: "none", marginTop: 4, display: "inline-block" }}
                            >
                              Open in Google Maps ↗
                            </a>
                          )}
                        </div>
                      </div>
                      {biz.geocode_checked_at && (
                        <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 12 }}>
                          Checked: {new Date(biz.geocode_checked_at).toLocaleString()}
                          {biz.geocode_reviewed_at && ` · Reviewed: ${new Date(biz.geocode_reviewed_at).toLocaleString()}`}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Manual Coords Modal */}
      {manualModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999,
        }} onClick={() => setManualModal(null)}>
          <div style={{
            background: COLORS.cardBg, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 16, padding: 32, width: 400, maxWidth: "90vw",
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Manual Coordinates</div>
            <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 20 }}>{manualModal.name}</div>
            <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: COLORS.textSecondary, display: "block", marginBottom: 4 }}>Latitude</label>
                <input
                  type="text" value={manualLat} onChange={e => setManualLat(e.target.value)} placeholder="41.209..."
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${COLORS.cardBorder}`, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 14 }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: COLORS.textSecondary, display: "block", marginBottom: 4 }}>Longitude</label>
                <input
                  type="text" value={manualLng} onChange={e => setManualLng(e.target.value)} placeholder="-96.054..."
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${COLORS.cardBorder}`, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 14 }}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button onClick={() => setManualModal(null)} style={{
                padding: "10px 20px", borderRadius: 8, border: `1px solid ${COLORS.cardBorder}`, background: "transparent", color: COLORS.textSecondary, fontSize: 13, cursor: "pointer",
              }}>Cancel</button>
              <button onClick={handleManualSubmit} style={{
                padding: "10px 20px", borderRadius: 8, border: "none", background: COLORS.gradient3, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer",
              }}>Save Coordinates</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Small Action Button ──

function ActionBtn({ label, color, onClick }: { label: string; color: string; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "4px 10px",
        borderRadius: 6,
        border: `1px solid ${color}`,
        background: "transparent",
        color,
        fontSize: 10,
        fontWeight: 700,
        textTransform: "uppercase",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}
