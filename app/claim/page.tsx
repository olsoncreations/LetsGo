"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface ClaimResult {
  id: string;
  name: string;
  address: string;
  category: string | null;
  photo: string | null;
  claimCode: string | null;
}

export default function ClaimSearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClaimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  function handleSearch(q: string) {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (q.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/claim/search?q=${encodeURIComponent(q.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || []);
        }
      } catch {
        // silent
      }
      setSearching(false);
      setSearched(true);
    }, 400);
  }

  const categoryLabels: Record<string, string> = {
    restaurant_bar: "Restaurant & Bar",
    activity: "Activity",
    salon_beauty: "Salon & Beauty",
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg, #0a0a14 0%, #0f0f1a 50%, #0a0a14 100%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "48px 24px",
    }}>
      <div style={{ marginBottom: 32 }}>
        <Image src="/lg-logo.png" alt="LetsGo" width={180} height={54} />
      </div>

      <div style={{ maxWidth: 520, width: "100%", textAlign: "center", marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#fff", margin: "0 0 12px" }}>
          Claim Your Business
        </h1>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 1.6, margin: 0 }}>
          Search for your business below. If it&apos;s already on LetsGo, you can claim it and start earning loyal customers.
        </p>
      </div>

      <div style={{ maxWidth: 520, width: "100%", marginBottom: 24 }}>
        <input
          type="text"
          placeholder="Search by business name..."
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          autoFocus
          style={{
            width: "100%",
            padding: "14px 20px",
            borderRadius: 50,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.04)",
            color: "#fff",
            fontSize: 16,
            outline: "none",
          }}
        />
      </div>

      {searching && (
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Searching...</div>
      )}

      {searched && !searching && results.length === 0 && query.length >= 2 && (
        <div style={{
          maxWidth: 520, width: "100%", padding: 32,
          borderRadius: 16,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: 8 }}>
            No unclaimed businesses found
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 20 }}>
            Your business may not be on LetsGo yet, or it may already be claimed.
          </div>
          <button
            onClick={() => router.push("/partner-onboarding")}
            style={{
              padding: "12px 28px",
              borderRadius: 50,
              background: "linear-gradient(135deg, #00bfff, #8a2be2)",
              color: "#fff",
              fontWeight: 700,
              border: "none",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Register as a New Business
          </button>
        </div>
      )}

      {results.length > 0 && (
        <div style={{ maxWidth: 520, width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
          {results.map((r) => (
            <div
              key={r.id}
              onClick={() => router.push(`/partner-onboarding?claim=${r.id}`)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: 16,
                borderRadius: 16,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                cursor: "pointer",
                transition: "border-color 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(57,255,20,0.3)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
            >
              {r.photo ? (
                <img
                  src={r.photo}
                  alt={r.name}
                  style={{ width: 56, height: 56, borderRadius: 12, objectFit: "cover", flexShrink: 0 }}
                />
              ) : (
                <div style={{
                  width: 56, height: 56, borderRadius: 12, flexShrink: 0,
                  background: "rgba(255,255,255,0.05)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 24,
                }}>
                  🏢
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 4 }}>
                  {r.name}
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.address}
                </div>
                {r.category && (
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
                    {categoryLabels[r.category] || r.category}
                  </div>
                )}
              </div>
              <div style={{
                padding: "6px 14px",
                borderRadius: 50,
                background: "rgba(57,255,20,0.1)",
                border: "1px solid rgba(57,255,20,0.25)",
                color: "#39ff14",
                fontSize: 12,
                fontWeight: 700,
                flexShrink: 0,
              }}>
                Claim
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 32, textAlign: "center" }}>
        <button
          onClick={() => router.push("/welcome")}
          style={{
            background: "none",
            border: "none",
            color: "rgba(255,255,255,0.35)",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          ← Back to Welcome
        </button>
      </div>
    </div>
  );
}
