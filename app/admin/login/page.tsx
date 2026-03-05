"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { COLORS } from "@/components/admin/constants";

export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function checkExistingSession() {
      try {
        const { data } = await supabaseBrowser.auth.getSession();
        if (data.session) {
          // Already logged in, check if staff
          const { data: staffData } = await supabaseBrowser.rpc("is_staff");
          if (staffData) {
            router.replace("/admin/overview");
            return;
          }
        }
      } catch (err) {
        console.error("Session check error:", err);
      } finally {
        setChecking(false);
      }
    }

    checkExistingSession();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const { data, error } = await supabaseBrowser.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      if (!data.session) {
        setMessage("Sign-in succeeded but no session returned.");
        return;
      }

      // Check if user is staff
      const { data: staffData, error: staffErr } = await supabaseBrowser.rpc(
        "is_staff"
      );

      if (staffErr || !staffData) {
        setMessage("Access denied. You are not authorized as staff.");
        await supabaseBrowser.auth.signOut();
        return;
      }

      router.replace("/admin/overview");
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Sign-in failed.";
      setMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: COLORS.darkBg,
          color: COLORS.textPrimary,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ fontSize: 14 }}>Loading...</div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: COLORS.darkBg,
        color: COLORS.textPrimary,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          background: COLORS.cardBg,
          border: "1px solid " + COLORS.cardBorder,
          borderRadius: 16,
          padding: 32,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 24,
          }}
        >
          <img
            src="/lg-logo.png"
            alt="LetsGo"
            style={{ width: 40, height: 40, borderRadius: 10 }}
          />
          <div>
            <div
              style={{
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.2em",
                color: COLORS.textSecondary,
              }}
            >
              LetsGo Admin
            </div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Sign In</div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: "block",
                fontSize: 12,
                color: COLORS.textSecondary,
                marginBottom: 6,
              }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid " + COLORS.cardBorder,
                background: COLORS.darkBg,
                color: COLORS.textPrimary,
                fontSize: 14,
                outline: "none",
              }}
              placeholder="you@example.com"
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                display: "block",
                fontSize: 12,
                color: COLORS.textSecondary,
                marginBottom: 6,
              }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid " + COLORS.cardBorder,
                background: COLORS.darkBg,
                color: COLORS.textPrimary,
                fontSize: 14,
                outline: "none",
              }}
              placeholder="••••••••"
            />
          </div>

          {message && (
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                background: "rgba(255, 49, 49, 0.1)",
                border: "1px solid rgba(255, 49, 49, 0.3)",
                color: COLORS.neonRed,
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: 10,
              border: "none",
              background: COLORS.gradient1,
              color: "#fff",
              fontSize: 14,
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}