"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Building2, Users, DollarSign, Shield, CreditCard, FileText, CheckCircle, ArrowLeft, ArrowRight } from "lucide-react";

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

// ── Types ──
type ChainApplicationData = {
  // Step 1: Brand info
  brandName: string;
  locationCount: string;
  markets: string;
  franchiseModel: "franchise" | "corporate" | "mixed" | "";
  headquartersCity: string;
  headquartersState: string;

  // Step 2: Contact
  contactName: string;
  contactTitle: string;
  contactEmail: string;
  contactPhone: string;

  // Step 3: Pricing (display only — no input needed)

  // Step 4: Corporate controls (display only — informational)

  // Step 5: Financial
  paymentMethod: "bank" | "card" | "";
  billingEmail: string;
  billingAddress: string;
  advertisingInterest: string[];

  // Stripe
  stripeCustomerId: string;
  stripePaymentMethodId: string;
  stripeSetupComplete: boolean;

  // Step 6: Terms
  agreeTerms: boolean;
  agreeChainTerms: boolean;

  // Step 7: Review — no new fields
};

const DEFAULT_DATA: ChainApplicationData = {
  brandName: "",
  locationCount: "",
  markets: "",
  franchiseModel: "",
  headquartersCity: "",
  headquartersState: "",
  contactName: "",
  contactTitle: "",
  contactEmail: "",
  contactPhone: "",
  paymentMethod: "",
  billingEmail: "",
  billingAddress: "",
  advertisingInterest: [],
  stripeCustomerId: "",
  stripePaymentMethodId: "",
  stripeSetupComplete: false,
  agreeTerms: false,
  agreeChainTerms: false,
};

const TIER_TABLE = [
  { label: "Local", range: "1–10", rate: "$400/mo" },
  { label: "Regional", range: "11–100", rate: "$350/mo" },
  { label: "National", range: "101–1,000", rate: "$300/mo" },
  { label: "Enterprise", range: "1,000+", rate: "Custom" },
];

const STEPS = [
  { label: "Brand Info", icon: <Building2 size={16} /> },
  { label: "Contact", icon: <Users size={16} /> },
  { label: "Pricing", icon: <DollarSign size={16} /> },
  { label: "What You Get", icon: <Shield size={16} /> },
  { label: "Financial", icon: <CreditCard size={16} /> },
  { label: "Terms", icon: <FileText size={16} /> },
  { label: "Review", icon: <CheckCircle size={16} /> },
];

// ── Helpers ──
function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

// ── Main Component ──
export default function ChainApplicationPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<ChainApplicationData>(DEFAULT_DATA);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      if (!session?.user) {
        router.replace("/welcome");
        return;
      }
      setUserId(session.user.id);
      if (!data.contactEmail) {
        setData((d) => ({ ...d, contactEmail: session.user.email || "" }));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function canAdvance(): boolean {
    switch (step) {
      case 1: return !!data.brandName && !!data.locationCount && !!data.franchiseModel;
      case 2: return !!data.contactName && !!data.contactEmail;
      case 3: return true;
      case 4: return true;
      case 5: return !!data.billingEmail && data.stripeSetupComplete;
      case 6: return data.agreeTerms && data.agreeChainTerms;
      case 7: return true;
      default: return true;
    }
  }

  async function handleSubmit() {
    if (!userId) return;
    setSubmitting(true);
    setError("");

    try {
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      if (!session?.access_token) {
        setError("Session expired. Please refresh and try again.");
        return;
      }

      const res = await fetch("/api/chains/apply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          brandName: data.brandName,
          locationCount: data.locationCount,
          markets: data.markets,
          franchiseModel: data.franchiseModel,
          headquartersCity: data.headquartersCity,
          headquartersState: data.headquartersState,
          contactName: data.contactName,
          contactTitle: data.contactTitle,
          contactEmail: data.contactEmail,
          contactPhone: data.contactPhone,
          paymentMethod: data.paymentMethod,
          billingEmail: data.billingEmail,
          billingAddress: data.billingAddress,
          advertisingInterest: data.advertisingInterest,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || "Something went wrong. Please try again.");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const pct = Math.round((step / 7) * 100);

  if (submitted) {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0a0a0a, #1a1a2e)", display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <div style={{ maxWidth: 500, textAlign: "center" }}>
          <div style={{ fontSize: 64, marginBottom: 24 }}>🎉</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 16, color: "#fff" }}>Application Submitted!</h1>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 16, lineHeight: 1.6, marginBottom: 32 }}>
            Thank you, {data.contactName}. Your chain application for <strong style={{ color: "#a855f7" }}>{data.brandName}</strong> is now under review.
            Our team will reach out to <strong>{data.contactEmail}</strong> within 2 business days.
          </p>
          <button
            onClick={() => router.push("/welcome")}
            style={{ padding: "14px 32px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #a855f7, #6366f1)", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0a0a0a, #1a1a2e)", color: "#fff" }}>
      {/* Header */}
      <header style={{ padding: "20px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Image src="/lg-logo.png" alt="LetsGo" width={120} height={36} />
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", fontWeight: 600 }}>Chain Application</span>
        </div>
        <button onClick={() => router.push("/welcome")} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 13 }}>
          ← Back
        </button>
      </header>

      {/* Progress bar */}
      <div style={{ padding: "0 32px", marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          {STEPS.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: i + 1 <= step ? "#a855f7" : "rgba(255,255,255,0.2)", fontWeight: i + 1 === step ? 700 : 400 }}>
              {s.icon} <span style={{ display: i + 1 === step || !true ? "inline" : "none" }}>{s.label}</span>
            </div>
          ))}
        </div>
        <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
          <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, #a855f7, #6366f1)", borderRadius: 2, transition: "width 0.3s" }} />
        </div>
      </div>

      {/* Step content */}
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 24px 120px" }}>
        {/* Step 1: Brand Info */}
        {step === 1 && (
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Tell us about your brand</h2>
            <p style={{ color: "rgba(255,255,255,0.4)", marginBottom: 32 }}>Basic information about your multi-location business.</p>

            <Field label="Brand / Chain Name *" value={data.brandName} onChange={(v) => setData((d) => ({ ...d, brandName: v }))} placeholder="e.g. Scooter's Coffee" />
            <Field label="Number of Locations *" value={data.locationCount} onChange={(v) => setData((d) => ({ ...d, locationCount: v }))} placeholder="e.g. 63" type="number" />
            <Field label="Markets / Regions" value={data.markets} onChange={(v) => setData((d) => ({ ...d, markets: v }))} placeholder="e.g. Omaha, Lincoln, Kansas City" />

            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Structure *</label>
              <div style={{ display: "flex", gap: 12 }}>
                {(["corporate", "franchise", "mixed"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setData((d) => ({ ...d, franchiseModel: m }))}
                    style={{
                      flex: 1,
                      padding: "14px 16px",
                      borderRadius: 10,
                      border: `1px solid ${data.franchiseModel === m ? "#a855f7" : "rgba(255,255,255,0.1)"}`,
                      background: data.franchiseModel === m ? "rgba(168,85,247,0.15)" : "rgba(255,255,255,0.03)",
                      color: data.franchiseModel === m ? "#a855f7" : "rgba(255,255,255,0.6)",
                      cursor: "pointer",
                      fontSize: 14,
                      fontWeight: 600,
                      textTransform: "capitalize",
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <Field label="HQ City" value={data.headquartersCity} onChange={(v) => setData((d) => ({ ...d, headquartersCity: v }))} placeholder="Omaha" />
              <Field label="HQ State" value={data.headquartersState} onChange={(v) => setData((d) => ({ ...d, headquartersState: v }))} placeholder="NE" />
            </div>
          </div>
        )}

        {/* Step 2: Contact */}
        {step === 2 && (
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Primary Contact</h2>
            <p style={{ color: "rgba(255,255,255,0.4)", marginBottom: 32 }}>Who should we reach out to?</p>

            <Field label="Full Name *" value={data.contactName} onChange={(v) => setData((d) => ({ ...d, contactName: v }))} placeholder="Jane Smith" />
            <Field label="Title" value={data.contactTitle} onChange={(v) => setData((d) => ({ ...d, contactTitle: v }))} placeholder="VP of Marketing" />
            <Field label="Email *" value={data.contactEmail} onChange={(v) => setData((d) => ({ ...d, contactEmail: v }))} placeholder="jane@brand.com" type="email" />
            <Field label="Phone" value={data.contactPhone} onChange={(v) => setData((d) => ({ ...d, contactPhone: formatPhone(v) }))} placeholder="(555) 123-4567" />
          </div>
        )}

        {/* Step 3: Pricing */}
        {step === 3 && (
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Volume Pricing</h2>
            <p style={{ color: "rgba(255,255,255,0.4)", marginBottom: 32 }}>Premium plan pricing scales with your location count. More locations = lower per-location rate.</p>

            <div style={{ display: "grid", gap: 16 }}>
              {TIER_TABLE.map((t) => {
                const count = parseInt(data.locationCount || "0");
                const isMatch =
                  (t.label === "Local" && count >= 1 && count <= 10) ||
                  (t.label === "Regional" && count >= 11 && count <= 100) ||
                  (t.label === "National" && count >= 101 && count <= 1000) ||
                  (t.label === "Enterprise" && count > 1000);

                return (
                  <div
                    key={t.label}
                    style={{
                      padding: 20,
                      borderRadius: 12,
                      border: `1px solid ${isMatch ? "#a855f7" : "rgba(255,255,255,0.08)"}`,
                      background: isMatch ? "rgba(168,85,247,0.1)" : "rgba(255,255,255,0.02)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: isMatch ? "#a855f7" : "#fff" }}>{t.label}</div>
                      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>{t.range} locations</div>
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: isMatch ? "#a855f7" : "#fff" }}>
                      {t.rate}
                      {isMatch && <div style={{ fontSize: 10, color: "#a855f7", fontWeight: 600, textAlign: "right" }}>YOUR TIER</div>}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 24, padding: 16, borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
              <strong style={{ color: "#fff" }}>How it works:</strong> Each location is billed individually at your tier rate. When you add or remove locations, all locations automatically adjust to the new tier on the next billing cycle.
            </div>
          </div>
        )}

        {/* Step 4: What Corporate Controls */}
        {step === 4 && (
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>What Corporate Controls</h2>
            <p style={{ color: "rgba(255,255,255,0.4)", marginBottom: 32 }}>Here's what you get with the corporate dashboard.</p>

            {[
              { icon: "📊", title: "Cross-Location Analytics", desc: "View performance metrics for any location or all at once. Compare locations side-by-side." },
              { icon: "📋", title: "Receipt Processing", desc: "Process customer receipts for any store — helpful when locations are short-staffed." },
              { icon: "📸", title: "Media & UGC Moderation", desc: "Approve user-generated content across all locations. Dual moderation with local managers." },
              { icon: "📅", title: "Event Management", desc: "Push events to all locations or selected ones. Local managers can also create their own." },
              { icon: "👥", title: "Team Management", desc: "Add/remove team members at any location. Reset access, manage roles chain-wide." },
              { icon: "🔗", title: "Feed Deduplication", desc: "One card per chain in the user discovery feed — shows nearest location, not 63 separate entries." },
              { icon: "⭐", title: "Chain-Wide Visit Counting", desc: "Customer visits count across all your locations. Visit Scooter's #147 and #203 — both count toward their tier." },
              { icon: "💰", title: "Protect the Tier Revenue", desc: "100% of Protect the Tier payments flow to corporate. Users are protecting brand loyalty, not a specific building." },
            ].map((item) => (
              <div
                key={item.title}
                style={{ display: "flex", gap: 16, padding: "16px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}
              >
                <div style={{ fontSize: 24, flexShrink: 0 }}>{item.icon}</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{item.title}</div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Step 5: Financial */}
        {step === 5 && (
          <ChainPaymentStep data={data} setData={setData} />
        )}

        {/* Step 6: Terms */}
        {step === 6 && (
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Terms & Agreements</h2>
            <p style={{ color: "rgba(255,255,255,0.4)", marginBottom: 32 }}>Please review and accept the following agreements.</p>

            <label style={{ display: "flex", gap: 12, padding: 16, borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 16, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={data.agreeTerms}
                onChange={() => setData((d) => ({ ...d, agreeTerms: !d.agreeTerms }))}
                style={{ accentColor: "#a855f7", marginTop: 2, flexShrink: 0 }}
              />
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>LetsGo Terms of Service</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>
                  I have read and agree to the <a href="/terms" target="_blank" style={{ color: "#a855f7" }}>Terms of Service</a> and <a href="/privacy" target="_blank" style={{ color: "#a855f7" }}>Privacy Policy</a>.
                </div>
              </div>
            </label>

            <label style={{ display: "flex", gap: 12, padding: 16, borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={data.agreeChainTerms}
                onChange={() => setData((d) => ({ ...d, agreeChainTerms: !d.agreeChainTerms }))}
                style={{ accentColor: "#a855f7", marginTop: 2, flexShrink: 0 }}
              />
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Chain Partner Agreement</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>
                  I understand that: (1) each location is billed individually at the volume-tier rate; (2) corporate has visibility and control over all linked locations;
                  (3) location managers retain local autonomy but corporate has full oversight; (4) Protect the Tier revenue is directed to the corporate account;
                  (5) LetsGo does not mediate internal franchise disputes.
                </div>
              </div>
            </label>
          </div>
        )}

        {/* Step 7: Review */}
        {step === 7 && (
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Review & Submit</h2>
            <p style={{ color: "rgba(255,255,255,0.4)", marginBottom: 32 }}>Please verify your information before submitting.</p>

            {[
              { label: "Brand Name", value: data.brandName },
              { label: "Locations", value: data.locationCount },
              { label: "Structure", value: data.franchiseModel },
              { label: "Markets", value: data.markets || "—" },
              { label: "HQ", value: [data.headquartersCity, data.headquartersState].filter(Boolean).join(", ") || "—" },
              { label: "Contact", value: `${data.contactName}${data.contactTitle ? ` (${data.contactTitle})` : ""}` },
              { label: "Email", value: data.contactEmail },
              { label: "Phone", value: data.contactPhone || "—" },
              { label: "Billing Email", value: data.billingEmail },
              { label: "Payment", value: data.paymentMethod === "bank" ? "Bank Account" : data.paymentMethod === "card" ? "Credit Card" : "Not specified" },
              { label: "Ad Interest", value: data.advertisingInterest.length > 0 ? data.advertisingInterest.join(", ") : "None" },
            ].map((row) => (
              <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>{row.label}</span>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{row.value}</span>
              </div>
            ))}

            {error && (
              <div style={{ marginTop: 16, padding: "12px 16px", borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", fontSize: 13 }}>
                {error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer navigation */}
      <div style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        padding: "16px 32px",
        background: "rgba(10,10,10,0.95)",
        backdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <button
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          disabled={step === 1}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "12px 24px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "transparent",
            color: step === 1 ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.6)",
            cursor: step === 1 ? "not-allowed" : "pointer",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          <ArrowLeft size={14} /> Back
        </button>

        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.2)" }}>Step {step} of 7</span>

        {step < 7 ? (
          <button
            onClick={() => setStep((s) => Math.min(7, s + 1))}
            disabled={!canAdvance()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "12px 24px",
              borderRadius: 10,
              border: "none",
              background: canAdvance() ? "linear-gradient(135deg, #a855f7, #6366f1)" : "rgba(255,255,255,0.05)",
              color: canAdvance() ? "#fff" : "rgba(255,255,255,0.2)",
              cursor: canAdvance() ? "pointer" : "not-allowed",
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            Continue <ArrowRight size={14} />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              padding: "12px 32px",
              borderRadius: 10,
              border: "none",
              background: "linear-gradient(135deg, #a855f7, #6366f1)",
              color: "#fff",
              fontSize: 14,
              fontWeight: 700,
              cursor: submitting ? "not-allowed" : "pointer",
              opacity: submitting ? 0.5 : 1,
            }}
          >
            {submitting ? "Submitting..." : "Submit Application"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Chain Payment Step (Step 5) ──
function ChainPaymentStep({ data, setData }: { data: ChainApplicationData; setData: React.Dispatch<React.SetStateAction<ChainApplicationData>> }) {
  const bankActive = data.paymentMethod === "bank";
  const cardActive = data.paymentMethod === "card";
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeError, setStripeError] = useState("");
  const billingAddressRef = React.useRef<HTMLInputElement>(null);

  // Google address autocomplete for billing address
  useEffect(() => {
    if (!billingAddressRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (window as any).google;
    if (!g?.maps?.places?.Autocomplete) return;

    const autocomplete = new g.maps.places.Autocomplete(billingAddressRef.current, { types: ["address"], fields: ["formatted_address"] });
    const listener = autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (place?.formatted_address) {
        setData((p) => ({ ...p, billingAddress: place.formatted_address as string }));
      }
    });
    return () => { if (listener?.remove) listener.remove(); };
  }, [setData]);

  const fetchSetupIntent = useCallback(async () => {
    if (!data.contactEmail && !data.brandName) return;
    if (!data.paymentMethod) return;
    setStripeLoading(true);
    setStripeError("");
    try {
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      const token = session?.access_token;
      if (!token) { setStripeError("Session expired. Please refresh."); return; }
      const res = await fetch("/api/stripe/create-setup-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          businessName: data.brandName,
          email: data.contactEmail,
          paymentMethodType: bankActive ? "us_bank_account" : "card",
        }),
      });
      if (!res.ok) { const err = await res.json(); setStripeError(err.error || "Failed to initialize payment setup."); return; }
      const { clientSecret: cs, customerId } = await res.json();
      setClientSecret(cs);
      setData((p) => ({ ...p, stripeCustomerId: customerId, stripeSetupComplete: false, stripePaymentMethodId: "" }));
    } catch { setStripeError("Failed to connect to payment provider."); }
    finally { setStripeLoading(false); }
  }, [data.contactEmail, data.brandName, data.paymentMethod, bankActive, setData]);

  useEffect(() => { fetchSetupIntent(); }, [fetchSetupIntent]);

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Financial Details</h2>
      <p style={{ color: "rgba(255,255,255,0.4)", marginBottom: 32 }}>Set up corporate billing and payment method.</p>

      {/* Security badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 10, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", marginBottom: 24, fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
        <span style={{ fontSize: 18 }}>🔒</span>
        Your payment information is securely handled by Stripe. We never see or store your card details.
      </div>

      <Field label="Billing Email *" value={data.billingEmail} onChange={(v) => setData((d) => ({ ...d, billingEmail: v }))} placeholder="billing@brand.com" type="email" />

      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>Billing Address</label>
        <input
          ref={billingAddressRef}
          value={data.billingAddress}
          onChange={(e) => setData((d) => ({ ...d, billingAddress: e.target.value }))}
          placeholder="123 Corporate Way, Suite 100"
          style={inputStyle}
        />
      </div>

      {/* Payment method selector */}
      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>Payment Method *</label>
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={() => setData((d) => ({ ...d, paymentMethod: "bank", stripeSetupComplete: false, stripePaymentMethodId: "" }))}
            style={{
              flex: 1, padding: "16px", borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 600, textAlign: "center",
              border: `1px solid ${bankActive ? "#a855f7" : "rgba(255,255,255,0.1)"}`,
              background: bankActive ? "rgba(168,85,247,0.15)" : "rgba(255,255,255,0.03)",
              color: bankActive ? "#a855f7" : "rgba(255,255,255,0.6)",
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 4 }}>🏦</div>
            Bank Account
            <div style={{ fontSize: 11, color: bankActive ? "rgba(168,85,247,0.7)" : "rgba(255,255,255,0.3)", marginTop: 4 }}>No processing fees</div>
          </button>
          <button
            onClick={() => setData((d) => ({ ...d, paymentMethod: "card", stripeSetupComplete: false, stripePaymentMethodId: "" }))}
            style={{
              flex: 1, padding: "16px", borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 600, textAlign: "center",
              border: `1px solid ${cardActive ? "#a855f7" : "rgba(255,255,255,0.1)"}`,
              background: cardActive ? "rgba(168,85,247,0.15)" : "rgba(255,255,255,0.03)",
              color: cardActive ? "#a855f7" : "rgba(255,255,255,0.6)",
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 4 }}>💳</div>
            Credit/Debit Card
            <div style={{ fontSize: 11, color: cardActive ? "rgba(168,85,247,0.7)" : "rgba(255,255,255,0.3)", marginTop: 4 }}>3.5% processing fee</div>
          </button>
        </div>
      </div>

      {/* Stripe form */}
      {data.paymentMethod && (
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>{bankActive ? "Bank Account Setup" : "Card Setup"}</label>
          {stripeError && (
            <div style={{ padding: 12, borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontSize: 13, marginBottom: 12 }}>
              {stripeError}
            </div>
          )}
          {stripeLoading && <div style={{ textAlign: "center", padding: 24, color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Loading payment form...</div>}
          {clientSecret && stripePromise && !stripeLoading && (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: "night",
                  variables: { colorPrimary: "#a855f7", colorBackground: "#1a1a2e", colorText: "#ffffff", colorDanger: "#ef4444", borderRadius: "10px", fontFamily: "Inter, system-ui, sans-serif" },
                },
              }}
            >
              <ChainStripeForm data={data} setData={setData} bankActive={bankActive} />
            </Elements>
          )}
          {!stripePromise && <div style={{ textAlign: "center", padding: 24, color: "rgba(255,255,255,0.3)" }}>Payment setup is not configured. Please contact support.</div>}
        </div>
      )}

      {data.stripeSetupComplete && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 10, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", marginBottom: 24 }}>
          <CheckCircle size={18} style={{ color: "#10b981" }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: "#10b981" }}>Payment method saved</span>
        </div>
      )}

      {/* Advertising interest */}
      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>Advertising Interest (optional)</label>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginBottom: 12 }}>Select any advertising options you'd like to discuss.</p>
        {["Spotlight Campaigns", "Push Notifications", "Video Add-on", "Live Streaming"].map((opt) => (
          <label key={opt} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={data.advertisingInterest.includes(opt)}
              onChange={() => setData((d) => ({ ...d, advertisingInterest: d.advertisingInterest.includes(opt) ? d.advertisingInterest.filter((i) => i !== opt) : [...d.advertisingInterest, opt] }))}
              style={{ accentColor: "#a855f7" }}
            />
            <span style={{ fontSize: 14, color: "rgba(255,255,255,0.7)" }}>{opt}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// ── Stripe confirm form (inside Elements provider) ──
function ChainStripeForm({ data, setData, bankActive }: { data: ChainApplicationData; setData: React.Dispatch<React.SetStateAction<ChainApplicationData>>; bankActive: boolean }) {
  const stripe = useStripe();
  const elements = useElements();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  const handleConfirm = async () => {
    if (!stripe || !elements) return;
    setConfirming(true);
    setError("");
    try {
      const { error: confirmError, setupIntent } = await stripe.confirmSetup({
        elements,
        redirect: "if_required",
        confirmParams: { return_url: window.location.href },
      });
      if (confirmError) {
        setError(confirmError.message || "Payment setup failed.");
      } else if (setupIntent?.status === "succeeded") {
        const pmId = typeof setupIntent.payment_method === "string" ? setupIntent.payment_method : setupIntent.payment_method?.id || "";
        setData((p) => ({ ...p, stripePaymentMethodId: pmId, stripeSetupComplete: true, paymentMethod: bankActive ? "bank" : "card" }));
      } else if (setupIntent?.status === "requires_action") {
        setError("Additional verification required. Please follow the prompts.");
      }
    } catch { setError("An unexpected error occurred."); }
    finally { setConfirming(false); }
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}><PaymentElement options={{ layout: "tabs" }} /></div>
      {error && <div style={{ padding: 10, borderRadius: 8, background: "rgba(239,68,68,0.1)", color: "#ef4444", fontSize: 13, marginBottom: 12 }}>{error}</div>}
      {!data.stripeSetupComplete && (
        <button
          onClick={handleConfirm}
          disabled={confirming || !stripe}
          style={{
            width: "100%", padding: "14px", borderRadius: 10, border: "none", fontSize: 14, fontWeight: 700, cursor: confirming ? "not-allowed" : "pointer",
            background: "linear-gradient(135deg, #a855f7, #6366f1)", color: "#fff", opacity: confirming ? 0.5 : 1,
          }}
        >
          {confirming ? "Verifying..." : bankActive ? "Verify Bank Account" : "Save Card"}
        </button>
      )}
    </div>
  );
}

// ── Reusable Field ──
const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  marginBottom: 6,
  color: "rgba(255,255,255,0.6)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10,
  color: "#fff",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};

function Field({
  label,
  value,
  onChange,
  placeholder,
  type,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={labelStyle}>{label}</label>
      <input
        type={type || "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={inputStyle}
      />
    </div>
  );
}
