"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import Image from "next/image";

interface ClaimBusiness {
  id: string;
  business_name: string;
  public_business_name: string | null;
  street_address: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  category_main: string | null;
  config: Record<string, unknown> | null;
  billing_plan: string | null;
  seeded_at: string | null;
  claim_code: string | null;
}

export default function ClaimCodePage() {
  const params = useParams();
  const router = useRouter();
  const claimCode = params.claimCode as string;

  const [business, setBusiness] = useState<ClaimBusiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!claimCode) return;

    (async () => {
      setLoading(true);
      const { data, error: err } = await supabaseBrowser
        .from("business")
        .select(`
          id, business_name, public_business_name,
          street_address, address_line1, city, state, zip,
          category_main, config, billing_plan, seeded_at, claim_code
        `)
        .eq("claim_code", claimCode)
        .maybeSingle();

      if (err) {
        setError("Something went wrong. Please try again.");
      } else if (!data) {
        setError("This claim code is not valid or has already been used.");
      } else if (data.billing_plan !== "trial" || !data.seeded_at) {
        setError("This business has already been claimed.");
      } else {
        setBusiness(data as ClaimBusiness);
      }
      setLoading(false);
    })();
  }, [claimCode]);

  const name = business?.public_business_name || business?.business_name || "";
  const address = [
    business?.street_address || business?.address_line1,
    business?.city,
    business?.state,
    business?.zip,
  ].filter(Boolean).join(", ");
  const cfg = business?.config ?? {};
  const images = Array.isArray((cfg as Record<string, unknown>).images) ? (cfg as Record<string, unknown>).images as string[] : [];
  const photo = images.length > 0 ? images[0] : null;

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg, #0a0a14 0%, #0f0f1a 50%, #0a0a14 100%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
    }}>
      <div style={{ marginBottom: 32 }}>
        <Image src="/lg-logo.png" alt="LetsGo" width={180} height={54} />
      </div>

      {loading && (
        <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 16 }}>Loading...</div>
      )}

      {error && (
        <div style={{
          maxWidth: 480,
          padding: 32,
          borderRadius: 20,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>😕</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 12 }}>
            Oops
          </div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", lineHeight: 1.6, marginBottom: 24 }}>
            {error}
          </div>
          <button
            onClick={() => router.push("/welcome")}
            style={{
              padding: "12px 32px",
              borderRadius: 50,
              background: "linear-gradient(135deg, #00bfff, #8a2be2)",
              color: "#fff",
              fontWeight: 700,
              border: "none",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Go to LetsGo
          </button>
        </div>
      )}

      {business && (
        <div style={{
          maxWidth: 480,
          width: "100%",
          borderRadius: 20,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          overflow: "hidden",
        }}>
          {photo && (
            <div style={{ width: "100%", height: 200, position: "relative" }}>
              <img
                src={photo}
                alt={name}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0, height: "50%",
                background: "linear-gradient(transparent, rgba(10,10,20,0.95))",
              }} />
            </div>
          )}

          <div style={{ padding: "24px 28px 32px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#ffb400", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>
              Claim Your Business
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", margin: "0 0 8px" }}>
              {name}
            </h1>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", marginBottom: 24 }}>
              {address}
            </div>

            <div style={{
              padding: 16,
              borderRadius: 12,
              background: "rgba(57,255,20,0.05)",
              border: "1px solid rgba(57,255,20,0.15)",
              marginBottom: 24,
              fontSize: 13,
              color: "rgba(255,255,255,0.7)",
              lineHeight: 1.6,
            }}>
              Your customers are looking for you on LetsGo! Complete the onboarding to take ownership of your profile, set your reward tiers, and start attracting loyal customers.
            </div>

            <button
              onClick={() => router.push(`/partner-onboarding?claim=${business.id}`)}
              style={{
                width: "100%",
                padding: "14px 24px",
                borderRadius: 50,
                background: "linear-gradient(135deg, #39ff14, #00c896)",
                color: "#000",
                fontWeight: 800,
                border: "none",
                cursor: "pointer",
                fontSize: 16,
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              Claim This Business
            </button>

            <div style={{ textAlign: "center", marginTop: 16 }}>
              <button
                onClick={() => router.push("/welcome")}
                style={{
                  background: "none",
                  border: "none",
                  color: "rgba(255,255,255,0.4)",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                Not your business? Go back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
