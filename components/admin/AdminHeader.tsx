"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { COLORS } from "./constants";

interface AdminHeaderProps {
  userEmail?: string | null;
}

export default function AdminHeader({ userEmail }: AdminHeaderProps) {
  const router = useRouter();

  async function handleSignOut() {
    if (confirm("Are you sure you want to sign out?")) {
      await supabaseBrowser.auth.signOut();
      router.push("/admin/login");
    }
  }

  return (
    <header
      style={{
        height: 56,
        background: COLORS.cardBg,
        borderBottom: "1px solid " + COLORS.cardBorder,
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        padding: "0 24px",
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {userEmail && (
          <span style={{ fontSize: 12, color: COLORS.textSecondary }}>
            {userEmail}
          </span>
        )}
        <button
          onClick={handleSignOut}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "none",
            background: "rgba(255,49,49,0.15)",
            color: COLORS.neonRed,
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = "rgba(255,49,49,0.25)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = "rgba(255,49,49,0.15)";
          }}
        >
          Sign Out
        </button>
      </div>
    </header>
  );
}