"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import {
  COLORS,
  Badge,
  Card,
  SectionTitle,
  StatCard,
  EditField,
  ConfirmModal,
  formatDate,
  formatMoney,
} from "@/components/admin/components";
import { logAudit } from "@/lib/auditLog";

// -- Types ------------------------------------------------------------------

interface Chain {
  id: string;
  brand_name: string;
  chain_code: string;
  status: string;
  franchise_model: string;
  location_count: number;
  pricing_tier: string;
  premium_rate_cents: number;
  contact_name: string | null;
  contact_title: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  billing_email: string | null;
  billing_address: string | null;
  payment_method: string | null;
  bank_name: string | null;
  routing_last4: string | null;
  account_last4: string | null;
  card_brand: string | null;
  card_last4: string | null;
  advertising_interests: unknown[];
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
  seeded_at: string | null;
}

interface ChainLocation {
  id: string;
  business_name: string | null;
  public_business_name: string | null;
  store_number: string | null;
  is_active: boolean;
  city: string | null;
  state: string | null;
  zip: string | null;
  street_address: string | null;
  billing_plan: string | null;
  created_at: string;
}

interface LinkRequest {
  id: string;
  business_id: string;
  chain_id: string;
  store_number: string;
  status: string;
  requested_at: string;
  requested_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  denial_reason: string | null;
  // enriched
  business_name?: string;
  business_city?: string;
  business_state?: string;
}

// -- Pricing tiers ----------------------------------------------------------

const TIER_THRESHOLDS: { max: number; tier: string; label: string; rateCents: number }[] = [
  { max: 10, tier: "local", label: "Local (1-10)", rateCents: 40000 },
  { max: 100, tier: "regional", label: "Regional (11-100)", rateCents: 35000 },
  { max: 1000, tier: "national", label: "National (101-1,000)", rateCents: 30000 },
  { max: Infinity, tier: "enterprise", label: "Enterprise (1,000+)", rateCents: 0 },
];

function tierLabel(tier: string): string {
  return TIER_THRESHOLDS.find((t) => t.tier === tier)?.label ?? tier;
}

// -- Wrapper ----------------------------------------------------------------

export default function ChainsPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0f0f1a]" />}>
      <ChainsPage />
    </Suspense>
  );
}

// -- Main page --------------------------------------------------------------

function ChainsPage() {
  const searchParams = useSearchParams();
  const [chains, setChains] = useState<Chain[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("selected"));
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Detail view state
  const [locations, setLocations] = useState<ChainLocation[]>([]);
  const [pendingRequests, setPendingRequests] = useState<LinkRequest[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editedChain, setEditedChain] = useState<Partial<Chain>>({});

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [newChain, setNewChain] = useState({
    brandName: "",
    chainCode: "",
    franchiseModel: "corporate",
    contactName: "",
    contactTitle: "",
    contactEmail: "",
    contactPhone: "",
  });
  const [createError, setCreateError] = useState("");

  // Confirm modal
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    type: "info" | "warning" | "danger";
    confirmText: string;
    requireText?: string;
    onConfirm: () => void;
  } | null>(null);

  // -- Session / user id ---
  const [userId, setUserId] = useState<string | null>(null);

  // -- Load chains ---
  async function loadChains() {
    const { data } = await supabaseBrowser
      .from("chains")
      .select("*")
      .order("created_at", { ascending: false });
    setChains(data || []);
  }

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      if (!session?.user) return;
      setUserId(session.user.id);
      await loadChains();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -- Load chain detail ---
  async function loadChainDetail(chainId: string) {
    const [locRes, reqRes] = await Promise.all([
      supabaseBrowser
        .from("business")
        .select("id, business_name, public_business_name, store_number, is_active, city, state, zip, street_address, billing_plan, created_at")
        .eq("chain_id", chainId)
        .order("store_number", { ascending: true }),
      supabaseBrowser
        .from("chain_link_requests")
        .select("*")
        .eq("chain_id", chainId)
        .eq("status", "pending")
        .order("requested_at", { ascending: false }),
    ]);

    setLocations(locRes.data || []);

    // Enrich pending requests with business info
    const requests = reqRes.data || [];
    const enriched: LinkRequest[] = [];
    for (const r of requests) {
      const { data: biz } = await supabaseBrowser
        .from("business")
        .select("business_name, city, state")
        .eq("id", r.business_id)
        .maybeSingle();
      enriched.push({
        ...r,
        business_name: biz?.business_name || "Unknown",
        business_city: biz?.city || "",
        business_state: biz?.state || "",
      });
    }
    setPendingRequests(enriched);
  }

  useEffect(() => {
    if (selectedId) {
      loadChainDetail(selectedId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // -- Filtered chains ---
  const filtered = chains.filter((c) => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        c.brand_name.toLowerCase().includes(q) ||
        c.chain_code.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // -- Stats ---
  const totalChains = chains.length;
  const activeChains = chains.filter((c) => c.status === "active").length;
  const pendingChains = chains.filter((c) => c.status === "pending_review").length;
  const totalLocations = chains.reduce((sum, c) => sum + c.location_count, 0);

  // -- Selected chain ---
  const selectedChain = chains.find((c) => c.id === selectedId) || null;

  // -- Create chain ---
  async function handleCreate() {
    setCreateError("");
    const code = newChain.chainCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!newChain.brandName.trim() || !code) {
      setCreateError("Brand name and chain code are required");
      return;
    }
    const chainId = `CHN-${code}-0`;

    const { error } = await supabaseBrowser.from("chains").insert({
      id: chainId,
      brand_name: newChain.brandName.trim(),
      chain_code: code,
      status: "active",
      franchise_model: newChain.franchiseModel,
      contact_name: newChain.contactName.trim() || null,
      contact_title: newChain.contactTitle.trim() || null,
      contact_email: newChain.contactEmail.trim() || null,
      contact_phone: newChain.contactPhone.trim() || null,
    });

    if (error) {
      if (error.code === "23505") {
        setCreateError("A chain with this code already exists");
      } else {
        setCreateError(error.message);
      }
      return;
    }

    if (userId) {
      logAudit({ action: "create_chain", tab: "Chains", targetType: "chain", targetId: chainId, entityName: newChain.brandName, details: `Created chain ${code}` });
    }

    setShowCreate(false);
    setNewChain({ brandName: "", chainCode: "", franchiseModel: "corporate", contactName: "", contactTitle: "", contactEmail: "", contactPhone: "" });
    await loadChains();
    setSelectedId(chainId);
  }

  // -- Update chain status ---
  async function updateChainStatus(chainId: string, newStatus: string) {
    const { error } = await supabaseBrowser
      .from("chains")
      .update({ status: newStatus })
      .eq("id", chainId);
    if (error) return;
    if (userId) {
      logAudit({ action: "update_chain_status", tab: "Chains", targetType: "chain", targetId: chainId, fieldName: "status", newValue: newStatus });
    }
    await loadChains();
  }

  // -- Save chain edits ---
  async function saveChainEdits() {
    if (!selectedId) return;
    const { error } = await supabaseBrowser
      .from("chains")
      .update(editedChain)
      .eq("id", selectedId);
    if (error) return;
    if (userId) {
      logAudit({ action: "edit_chain", tab: "Chains", targetType: "chain", targetId: selectedId, details: `Edited fields: ${Object.keys(editedChain).join(", ")}` });
    }
    setIsEditing(false);
    setEditedChain({});
    await loadChains();
  }

  // -- Review link request ---
  async function reviewLinkRequest(requestId: string, action: "approve" | "deny", denialReason?: string) {
    const { data: { session } } = await supabaseBrowser.auth.getSession();
    if (!session) return;

    const res = await fetch(`/api/chains/link-request/${requestId}/review`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ action, denialReason }),
    });

    if (res.ok && selectedId) {
      await Promise.all([loadChains(), loadChainDetail(selectedId)]);
    }
  }

  // -- Unlink a business from the chain ---
  async function unlinkBusiness(businessId: string, businessName: string) {
    if (!selectedId) return;

    const { error } = await supabaseBrowser
      .from("business")
      .update({ chain_id: null, store_number: null })
      .eq("id", businessId);
    if (error) return;

    // Recount
    const { count } = await supabaseBrowser
      .from("business")
      .select("id", { count: "exact", head: true })
      .eq("chain_id", selectedId);

    const locationCount = count ?? 0;
    let pricingTier = "local";
    let premiumRateCents = 40000;
    for (const t of TIER_THRESHOLDS) {
      if (locationCount <= t.max) {
        pricingTier = t.tier;
        premiumRateCents = t.rateCents;
        break;
      }
    }

    await supabaseBrowser
      .from("chains")
      .update({ location_count: locationCount, pricing_tier: pricingTier, premium_rate_cents: premiumRateCents })
      .eq("id", selectedId);

    // Clean up link request
    await supabaseBrowser
      .from("chain_link_requests")
      .delete()
      .eq("business_id", businessId)
      .eq("chain_id", selectedId);

    if (userId) {
      logAudit({ action: "unlink_business", tab: "Chains", targetType: "chain", targetId: selectedId, entityName: businessName, details: `Unlinked business ${businessId}` });
    }

    await Promise.all([loadChains(), loadChainDetail(selectedId)]);
  }

  // -- Loading ---
  if (loading) {
    return <div style={{ padding: 32, color: COLORS.textSecondary }}>Loading...</div>;
  }

  // ============ DETAIL VIEW ============
  if (selectedChain) {
    const c = selectedChain;
    const val = (key: keyof Chain) => (isEditing && key in editedChain ? (editedChain as Record<string, unknown>)[key] : c[key]) as string | null;

    return (
      <div style={{ flex: 1, overflowY: "auto", padding: 32 }}>
        {/* Back button */}
        <button
          onClick={() => { setSelectedId(null); setIsEditing(false); setEditedChain({}); }}
          style={{ background: "none", border: "none", color: COLORS.neonBlue, cursor: "pointer", fontSize: 14, marginBottom: 16, padding: 0 }}
        >
          &larr; Back to all chains
        </button>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
          <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0 }}>
            {c.brand_name}
          </h1>
          <Badge status={c.status} />
          {c.seeded_at && (
            <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: "rgba(255,180,0,0.15)", color: "#ffb400", border: "1px solid rgba(255,180,0,0.3)" }}>Seeded</span>
          )}
          <span style={{ color: COLORS.textSecondary, fontSize: 14 }}>{c.id}</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            {!isEditing ? (
              <button
                onClick={() => { setIsEditing(true); setEditedChain({}); }}
                style={{ padding: "8px 16px", background: COLORS.gradient1, border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", fontWeight: 600 }}
              >
                Edit
              </button>
            ) : (
              <>
                <button
                  onClick={saveChainEdits}
                  style={{ padding: "8px 16px", background: COLORS.neonGreen, border: "none", borderRadius: 8, color: "#000", cursor: "pointer", fontWeight: 600 }}
                >
                  Save
                </button>
                <button
                  onClick={() => { setIsEditing(false); setEditedChain({}); }}
                  style={{ padding: "8px 16px", background: COLORS.cardBg, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 8, color: COLORS.textPrimary, cursor: "pointer" }}
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 32 }}>
          <StatCard icon="📍" value={c.location_count} label="Locations" gradient={COLORS.gradient1} />
          <StatCard icon="💰" value={tierLabel(c.pricing_tier)} label="Pricing Tier" gradient={COLORS.gradient2} />
          <StatCard icon="💵" value={c.premium_rate_cents > 0 ? formatMoney(c.premium_rate_cents) : "Custom"} label="Per Location / Mo" gradient={COLORS.gradient3} />
          <StatCard icon="🏗️" value={c.franchise_model.charAt(0).toUpperCase() + c.franchise_model.slice(1)} label="Model" gradient={COLORS.gradient4} />
        </div>

        {/* Status actions */}
        {c.status !== "active" && (
          <div style={{ marginBottom: 24 }}>
            <Card title="Status Actions">
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {c.status === "pending_review" && (
                  <>
                    <button
                      onClick={() => updateChainStatus(c.id, "active")}
                      style={{ padding: "8px 20px", background: COLORS.neonGreen, border: "none", borderRadius: 8, color: "#000", cursor: "pointer", fontWeight: 600 }}
                    >
                      Approve & Activate
                    </button>
                    <button
                      onClick={() => updateChainStatus(c.id, "suspended")}
                      style={{ padding: "8px 20px", background: COLORS.neonRed, border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", fontWeight: 600 }}
                    >
                      Reject
                    </button>
                  </>
                )}
                {c.status === "verified" && (
                  <button
                    onClick={() => updateChainStatus(c.id, "active")}
                    style={{ padding: "8px 20px", background: COLORS.neonGreen, border: "none", borderRadius: 8, color: "#000", cursor: "pointer", fontWeight: 600 }}
                  >
                    Activate
                  </button>
                )}
                {c.status === "suspended" && (
                  <button
                    onClick={() => updateChainStatus(c.id, "active")}
                    style={{ padding: "8px 20px", background: COLORS.neonGreen, border: "none", borderRadius: 8, color: "#000", cursor: "pointer", fontWeight: 600 }}
                  >
                    Reactivate
                  </button>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* Pending link requests */}
        {pendingRequests.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <SectionTitle icon="⏳">Pending Link Requests ({pendingRequests.length})</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {pendingRequests.map((r) => (
                <div
                  key={r.id}
                  style={{ background: COLORS.cardBg, border: `1px solid ${COLORS.neonYellow}40`, borderRadius: 12, padding: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 16, color: COLORS.textPrimary }}>
                      {r.business_name}
                    </div>
                    <div style={{ fontSize: 13, color: COLORS.textSecondary, marginTop: 4 }}>
                      Store #{r.store_number} &bull; {r.business_city}, {r.business_state} &bull; Requested {formatDate(r.requested_at)}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => reviewLinkRequest(r.id, "approve")}
                      style={{ padding: "6px 16px", background: COLORS.neonGreen, border: "none", borderRadius: 8, color: "#000", cursor: "pointer", fontWeight: 600, fontSize: 13 }}
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => {
                        setConfirmModal({
                          title: "Deny Link Request",
                          message: `Deny ${r.business_name} (Store #${r.store_number}) from joining this chain?`,
                          type: "warning",
                          confirmText: "Deny",
                          onConfirm: () => { reviewLinkRequest(r.id, "deny"); setConfirmModal(null); },
                        });
                      }}
                      style={{ padding: "6px 16px", background: COLORS.neonRed, border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 13 }}
                    >
                      Deny
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chain details */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
          <Card title="Chain Details">
            <EditField label="Brand Name" value={val("brand_name") || ""} editable={isEditing} onChange={(v: string) => setEditedChain((p) => ({ ...p, brand_name: v }))} />
            <EditField label="Chain Code" value={val("chain_code") || ""} editable={isEditing} onChange={(v: string) => setEditedChain((p) => ({ ...p, chain_code: v.toUpperCase().replace(/[^A-Z0-9]/g, "") }))} />
            <EditField label="Franchise Model" value={val("franchise_model") || ""} editable={isEditing} type="select" options={[{ value: "corporate", label: "Corporate" }, { value: "franchise", label: "Franchise" }, { value: "mixed", label: "Mixed" }]} onChange={(v: string) => setEditedChain((p) => ({ ...p, franchise_model: v }))} />
            <EditField
              label="Custom Rate ($/mo per location)"
              value={isEditing ? String((editedChain.premium_rate_cents ?? c.premium_rate_cents) / 100) : c.premium_rate_cents > 0 ? `$${(c.premium_rate_cents / 100).toFixed(2)}` : "Custom contract"}
              editable={isEditing}
              onChange={(v: string) => {
                const dollars = parseFloat(v.replace(/[^0-9.]/g, ""));
                if (!isNaN(dollars)) setEditedChain((p) => ({ ...p, premium_rate_cents: Math.round(dollars * 100) }));
              }}
            />
            {isEditing && (
              <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: -8, marginBottom: 12 }}>
                Tier default: ${(({ local: 400, regional: 350, national: 300, enterprise: 0 } as Record<string, number>)[c.pricing_tier] || 0)}/mo — override above for negotiated rates
              </div>
            )}
            <EditField label="Internal Notes" value={val("internal_notes") || ""} editable={isEditing} textarea onChange={(v: string) => setEditedChain((p) => ({ ...p, internal_notes: v }))} />
            <div style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 12 }}>
              Created {formatDate(c.created_at)} &bull; Updated {formatDate(c.updated_at)}
            </div>
          </Card>

          <Card title="Corporate Contact">
            <EditField label="Name" value={val("contact_name") || ""} editable={isEditing} onChange={(v: string) => setEditedChain((p) => ({ ...p, contact_name: v }))} />
            <EditField label="Title" value={val("contact_title") || ""} editable={isEditing} onChange={(v: string) => setEditedChain((p) => ({ ...p, contact_title: v }))} />
            <EditField label="Email" value={val("contact_email") || ""} editable={isEditing} onChange={(v: string) => setEditedChain((p) => ({ ...p, contact_email: v }))} />
            <EditField label="Phone" value={val("contact_phone") || ""} editable={isEditing} onChange={(v: string) => setEditedChain((p) => ({ ...p, contact_phone: v }))} />
          </Card>
        </div>

        {/* Billing */}
        <div style={{ marginBottom: 32 }}>
          <Card title="Corporate Billing">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              <div>
                <EditField label="Billing Email" value={val("billing_email") || ""} editable={isEditing} onChange={(v: string) => setEditedChain((p) => ({ ...p, billing_email: v }))} />
                <EditField label="Billing Address" value={val("billing_address") || ""} editable={isEditing} onChange={(v: string) => setEditedChain((p) => ({ ...p, billing_address: v }))} />
              </div>
              <div>
                <EditField label="Payment Method" value={c.payment_method || "Not set"} editable={false} />
                {c.payment_method === "bank" && (
                  <>
                    <EditField label="Bank" value={c.bank_name || ""} editable={false} />
                    <EditField label="Account" value={c.routing_last4 ? `****${c.routing_last4} / ****${c.account_last4}` : "Not set"} editable={false} />
                  </>
                )}
                {c.payment_method === "card" && (
                  <EditField label="Card" value={c.card_brand ? `${c.card_brand} ****${c.card_last4}` : "Not set"} editable={false} />
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Locations */}
        <SectionTitle icon="📍">Locations ({locations.length})</SectionTitle>
        <Card>
          {locations.length === 0 ? (
            <div style={{ color: COLORS.textSecondary, textAlign: "center", padding: 32 }}>
              No locations linked to this chain yet
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${COLORS.cardBorder}` }}>
                    {["Store #", "Address", "City / Zip", "Plan", "Status", "Joined", ""].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontSize: 12, color: COLORS.textSecondary, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {locations.map((loc) => (
                    <tr
                      key={loc.id}
                      onClick={() => window.open(`/admin/businesses?selected=${loc.id}`, "_blank")}
                      style={{ borderBottom: `1px solid ${COLORS.cardBorder}20`, cursor: "pointer", transition: "background 0.15s" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = `${COLORS.cardBorder}30`)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "10px 12px", fontWeight: 600, color: COLORS.neonBlue }}>
                        #{loc.store_number}
                      </td>
                      <td style={{ padding: "10px 12px", color: COLORS.textPrimary, fontSize: 13 }}>
                        {loc.street_address || loc.public_business_name || loc.business_name}
                      </td>
                      <td style={{ padding: "10px 12px", color: COLORS.textSecondary, fontSize: 13 }}>
                        {[loc.city, loc.state, loc.zip].filter(Boolean).join(", ")}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <Badge status={loc.billing_plan || "basic"} />
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <Badge status={loc.is_active ? "active" : "inactive"} />
                      </td>
                      <td style={{ padding: "10px 12px", color: COLORS.textSecondary, fontSize: 13 }}>
                        {formatDate(loc.created_at)}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <button
                          onClick={() => {
                            setConfirmModal({
                              title: "Unlink Business",
                              message: `Remove "${loc.public_business_name || loc.business_name}" (Store #${loc.store_number}) from this chain? The business will become independent.`,
                              type: "danger",
                              confirmText: "Unlink",
                              onConfirm: () => { unlinkBusiness(loc.id, loc.business_name || ""); setConfirmModal(null); },
                            });
                          }}
                          style={{ padding: "4px 12px", background: "transparent", border: `1px solid ${COLORS.neonRed}60`, borderRadius: 6, color: COLORS.neonRed, cursor: "pointer", fontSize: 12 }}
                        >
                          Unlink
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Pricing tier breakdown */}
        <div style={{ marginTop: 32 }}>
          <SectionTitle icon="💰">Pricing Tier Reference</SectionTitle>
          <Card>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
              {TIER_THRESHOLDS.map((t) => (
                <div
                  key={t.tier}
                  style={{
                    padding: 16,
                    borderRadius: 12,
                    border: `1px solid ${c.pricing_tier === t.tier ? COLORS.neonGreen : COLORS.cardBorder}`,
                    background: c.pricing_tier === t.tier ? `${COLORS.neonGreen}10` : "transparent",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 18, color: c.pricing_tier === t.tier ? COLORS.neonGreen : COLORS.textPrimary }}>
                    {t.rateCents > 0 ? formatMoney(t.rateCents) : "Custom"}
                  </div>
                  <div style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 4 }}>{t.label}</div>
                  {c.pricing_tier === t.tier && (
                    <div style={{ fontSize: 11, color: COLORS.neonGreen, marginTop: 8, fontWeight: 600 }}>CURRENT TIER</div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>

        {confirmModal && (
          <ConfirmModal
            title={confirmModal.title}
            message={confirmModal.message}
            type={confirmModal.type}
            confirmText={confirmModal.confirmText}
            requireText={confirmModal.requireText}
            onClose={() => setConfirmModal(null)}
            onConfirm={confirmModal.onConfirm}
          />
        )}
      </div>
    );
  }

  // ============ LIST VIEW ============
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 32 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0 }}>
          🔗 Chains
        </h1>
        <button
          onClick={() => setShowCreate(true)}
          style={{ padding: "10px 24px", background: COLORS.gradient1, border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 15 }}
        >
          + New Chain
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 32 }}>
        <StatCard icon="🔗" value={totalChains} label="Total Chains" gradient={COLORS.gradient1} />
        <StatCard icon="✅" value={activeChains} label="Active" gradient={COLORS.gradient2} />
        <StatCard icon="⏳" value={pendingChains} label="Pending Review" gradient={COLORS.gradient4} />
        <StatCard icon="📍" value={totalLocations} label="Total Locations" gradient={COLORS.gradient3} />
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <input
          type="text"
          placeholder="Search chains..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ flex: 1, padding: "10px 16px", background: COLORS.cardBg, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 10, color: COLORS.textPrimary, fontSize: 14, outline: "none" }}
        />
        {["all", "active", "pending_review", "verified", "suspended"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              padding: "8px 16px",
              background: statusFilter === s ? COLORS.neonPink : COLORS.cardBg,
              border: `1px solid ${statusFilter === s ? COLORS.neonPink : COLORS.cardBorder}`,
              borderRadius: 8,
              color: statusFilter === s ? "#fff" : COLORS.textSecondary,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: statusFilter === s ? 600 : 400,
              whiteSpace: "nowrap",
            }}
          >
            {s === "all" ? "All" : s === "pending_review" ? "Pending" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Chain list */}
      <Card title={`Chains (${filtered.length})`}>
        {filtered.length === 0 ? (
          <div style={{ color: COLORS.textSecondary, textAlign: "center", padding: 32 }}>
            {chains.length === 0 ? "No chains yet — create one to get started" : "No chains match your filters"}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${COLORS.cardBorder}` }}>
                  {["Brand", "Chain Code", "Status", "Model", "Locations", "Tier", "Rate/mo", "Created"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontSize: 12, color: COLORS.textSecondary, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    style={{ borderBottom: `1px solid ${COLORS.cardBorder}20`, cursor: "pointer", transition: "background 0.15s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = `${COLORS.cardBorder}30`)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "12px 12px", fontWeight: 600, color: COLORS.textPrimary }}>
                      {c.brand_name}
                    </td>
                    <td style={{ padding: "12px 12px", fontFamily: "monospace", color: COLORS.neonBlue, fontSize: 13 }}>
                      {c.chain_code}
                    </td>
                    <td style={{ padding: "12px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Badge status={c.status} />
                        {c.seeded_at && (
                          <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, background: "rgba(255,180,0,0.15)", color: "#ffb400", border: "1px solid rgba(255,180,0,0.3)" }}>Seeded</span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: "12px 12px", color: COLORS.textSecondary, fontSize: 13 }}>
                      {c.franchise_model}
                    </td>
                    <td style={{ padding: "12px 12px", color: COLORS.textPrimary, fontWeight: 600 }}>
                      {c.location_count}
                    </td>
                    <td style={{ padding: "12px 12px", fontSize: 13 }}>
                      <Badge status={c.pricing_tier} />
                    </td>
                    <td style={{ padding: "12px 12px", color: COLORS.textPrimary }}>
                      {c.premium_rate_cents > 0 ? formatMoney(c.premium_rate_cents) : "Custom"}
                    </td>
                    <td style={{ padding: "12px 12px", color: COLORS.textSecondary, fontSize: 13 }}>
                      {formatDate(c.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create modal */}
      {showCreate && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowCreate(false); }}
        >
          <div style={{ background: COLORS.cardBg, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 16, padding: 32, width: 520, maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, color: COLORS.textPrimary }}>
              Create New Chain
            </h2>

            <EditField
              label="Brand Name"
              value={newChain.brandName}
              editable
              onChange={(v: string) => setNewChain((p) => ({ ...p, brandName: v }))}
            />
            <EditField
              label="Chain Code"
              value={newChain.chainCode}
              editable
              onChange={(v: string) => setNewChain((p) => ({ ...p, chainCode: v.toUpperCase().replace(/[^A-Z0-9]/g, "") }))}
            />
            <div style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: -8, marginBottom: 12 }}>
              Will create ID: CHN-{newChain.chainCode || "___"}-0
            </div>
            <EditField
              label="Franchise Model"
              value={newChain.franchiseModel}
              editable
              type="select"
              options={[{ value: "corporate", label: "Corporate" }, { value: "franchise", label: "Franchise" }, { value: "mixed", label: "Mixed" }]}
              onChange={(v: string) => setNewChain((p) => ({ ...p, franchiseModel: v }))}
            />

            <div style={{ borderTop: `1px solid ${COLORS.cardBorder}`, marginTop: 16, paddingTop: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.textSecondary, marginBottom: 12 }}>
                Corporate Contact (optional)
              </div>
              <EditField label="Name" value={newChain.contactName} editable onChange={(v: string) => setNewChain((p) => ({ ...p, contactName: v }))} />
              <EditField label="Title" value={newChain.contactTitle} editable onChange={(v: string) => setNewChain((p) => ({ ...p, contactTitle: v }))} />
              <EditField label="Email" value={newChain.contactEmail} editable onChange={(v: string) => setNewChain((p) => ({ ...p, contactEmail: v }))} />
              <EditField label="Phone" value={newChain.contactPhone} editable onChange={(v: string) => setNewChain((p) => ({ ...p, contactPhone: v }))} />
            </div>

            {createError && (
              <div style={{ color: COLORS.neonRed, fontSize: 13, marginTop: 12 }}>{createError}</div>
            )}

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 24 }}>
              <button
                onClick={() => setShowCreate(false)}
                style={{ padding: "10px 24px", background: COLORS.cardBg, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 10, color: COLORS.textPrimary, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                style={{ padding: "10px 24px", background: COLORS.gradient1, border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontWeight: 700 }}
              >
                Create Chain
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmModal && (
        <ConfirmModal
          title={confirmModal.title}
          message={confirmModal.message}
          type={confirmModal.type}
          confirmText={confirmModal.confirmText}
          requireText={confirmModal.requireText}
          onClose={() => setConfirmModal(null)}
          onConfirm={confirmModal.onConfirm}
        />
      )}
    </div>
  );
}
