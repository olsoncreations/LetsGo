"use client";

import { useState, useCallback } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "");

const NEON = {
  primary: "#00E5FF",
  green: "#00FF87",
  yellow: "#FFD600",
  orange: "#FF6B2D",
  pink: "#FF2D78",
};

interface PaymentMethodInfo {
  type: string | null;
  cardBrand: string | null;
  cardLast4: string | null;
  cardExpMonth: number | null;
  cardExpYear: number | null;
  bankName: string | null;
  bankLast4: string | null;
}

interface UserPaymentMethodProps {
  token: string;
  paymentMethod: PaymentMethodInfo | null;
  onUpdated: () => void;
}

/** Inner form component — must be inside <Elements> */
function SetupForm({ token, onSuccess, onCancel }: { token: string; onSuccess: () => void; onCancel: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSaving(true);
    setError(null);

    const result = await stripe.confirmSetup({
      elements,
      redirect: "if_required",
    });

    if (result.error) {
      setError(result.error.message || "Setup failed");
      setSaving(false);
      return;
    }

    // SetupIntent succeeded — save the payment method to our DB
    const setupIntent = result.setupIntent;
    if (setupIntent?.payment_method) {
      const pmId = typeof setupIntent.payment_method === "string"
        ? setupIntent.payment_method
        : setupIntent.payment_method.id;

      const res = await fetch("/api/stripe/user/payment-method", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ paymentMethodId: pmId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to save payment method");
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement options={{ layout: "tabs" }} />
      {error && (
        <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: 4, background: "rgba(255,45,120,0.1)", border: "1px solid rgba(255,45,120,0.3)", color: NEON.pink, fontSize: 11 }}>{error}</div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button type="submit" disabled={!stripe || saving} style={{
          flex: 1, padding: "10px 0", borderRadius: 4, border: "none",
          background: "linear-gradient(135deg, #00E5FF, #00FF87)", color: "#000",
          fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
          cursor: saving ? "wait" : "pointer", fontFamily: "'DM Sans', sans-serif",
          opacity: saving ? 0.6 : 1,
        }}>
          {saving ? "Saving..." : "Save Payment Method"}
        </button>
        <button type="button" onClick={onCancel} style={{
          padding: "10px 20px", borderRadius: 4,
          border: "1px solid rgba(255,255,255,0.1)", background: "transparent",
          color: "rgba(255,255,255,0.3)", fontSize: 11, cursor: "pointer",
          fontFamily: "'DM Sans', sans-serif",
        }}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function UserPaymentMethod({ token, paymentMethod, onUpdated }: UserPaymentMethodProps) {
  const [showSetup, setShowSetup] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState(false);

  const hasPM = paymentMethod?.type && (paymentMethod.cardLast4 || paymentMethod.bankLast4);

  const startSetup = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/user/setup-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to start payment setup");
        setLoading(false);
        return;
      }
      setClientSecret(data.clientSecret);
      setShowSetup(true);
    } catch {
      alert("Failed to start payment setup");
    }
    setLoading(false);
  }, [token]);

  const handleRemove = useCallback(async () => {
    if (!confirm("Remove your saved payment method?")) return;
    setRemoving(true);
    try {
      await fetch("/api/stripe/user/payment-method", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      onUpdated();
    } catch {
      alert("Failed to remove payment method");
    }
    setRemoving(false);
  }, [token, onUpdated]);

  return (
    <div style={{ marginTop: 16 }}>
      {/* Current saved PM display */}
      {hasPM && !showSetup && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderRadius: 4, background: "rgba(0,229,255,0.04)", border: "1px solid rgba(0,229,255,0.15)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 16 }}>{paymentMethod?.type === "card" ? "\uD83D\uDCB3" : "\uD83C\uDFE6"}</span>
            <div>
              {paymentMethod?.type === "card" ? (
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                  {paymentMethod.cardBrand?.toUpperCase()} ending in {paymentMethod.cardLast4}
                  <span style={{ color: "rgba(255,255,255,0.25)", marginLeft: 8 }}>
                    {paymentMethod.cardExpMonth}/{paymentMethod.cardExpYear}
                  </span>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                  {paymentMethod?.bankName} ending in {paymentMethod?.bankLast4}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={startSetup} disabled={loading} style={{ padding: "4px 12px", borderRadius: 3, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.3)", fontSize: 9, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
              Change
            </button>
            <button onClick={handleRemove} disabled={removing} style={{ padding: "4px 12px", borderRadius: 3, border: "1px solid rgba(255,45,120,0.2)", background: "transparent", color: "rgba(255,45,120,0.4)", fontSize: 9, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
              {removing ? "..." : "Remove"}
            </button>
          </div>
        </div>
      )}

      {/* No PM saved */}
      {!hasPM && !showSetup && (
        <button onClick={startSetup} disabled={loading} style={{
          width: "100%", padding: "10px 0", borderRadius: 4,
          border: "1px dashed rgba(0,229,255,0.3)", background: "rgba(0,229,255,0.04)",
          color: NEON.primary, fontSize: 11, fontWeight: 600,
          letterSpacing: "0.08em", textTransform: "uppercase",
          cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
        }}>
          {loading ? "Loading..." : "+ Add Payment Method (Card or Bank)"}
        </button>
      )}

      {/* Stripe Elements form */}
      {showSetup && clientSecret && (
        <div style={{ marginTop: 12, padding: 16, borderRadius: 6, background: "#1a1a2e", border: "1px solid rgba(0,229,255,0.15)" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: NEON.primary, marginBottom: 12, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {hasPM ? "Update Payment Method" : "Add Payment Method"}
          </div>
          <Elements stripe={stripePromise} options={{
            clientSecret,
            appearance: {
              theme: "night",
              variables: {
                colorPrimary: "#00E5FF",
                colorBackground: "#0f0f1a",
                colorText: "#ffffff",
                colorDanger: "#FF2D78",
                borderRadius: "4px",
                fontFamily: "'DM Sans', sans-serif",
              },
            },
          }}>
            <SetupForm
              token={token}
              onSuccess={() => { setShowSetup(false); setClientSecret(null); onUpdated(); }}
              onCancel={() => { setShowSetup(false); setClientSecret(null); }}
            />
          </Elements>
        </div>
      )}
    </div>
  );
}
