// components/business/v2/tabs/Overview.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { BusinessTabProps } from "@/components/business/v2/BusinessProfileV2";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { useIsMobile } from "@/lib/useIsMobile";
import { LaunchBanner } from "@/components/LaunchBanner";
import {
  BarChart3,
  TrendingUp,
  Users,
  DollarSign,
  Clock,
  Calendar,
  FileText,
  Camera,
  AlertCircle,
} from "lucide-react";

type OverviewProps = BusinessTabProps & {
  setActiveTab: (tabId: string) => void;
};

function normalizeErr(e: unknown): string {
  if (!e) return "Unknown error.";
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message || "Unknown error.";
  try {
    const anyE = e as any;
    const parts = [
      anyE?.message ? `message=${anyE.message}` : null,
      anyE?.details ? `details=${anyE.details}` : null,
      anyE?.hint ? `hint=${anyE.hint}` : null,
      anyE?.code ? `code=${anyE.code}` : null,
    ].filter(Boolean);
    return parts.length ? parts.join(" | ") : JSON.stringify(e);
  } catch {
    return "Unknown error (non-serializable).";
  }
}

function money0(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default function Overview({ businessId, isPremium, setActiveTab }: OverviewProps) {
  const isMobile = useIsMobile();
  const colors = useMemo(
    () => ({
      primary: "#14b8a6",
      secondary: "#f97316",
      accent: "#06b6d4",
      success: "#10b981",
      warning: "#f59e0b",
      danger: "#ef4444",
    }),
    []
  );

  // --- Real, read-first wiring (best-effort) ---
  const [loading, setLoading] = useState(true);
  const [loadNote, setLoadNote] = useState<string | null>(null);

  const [upcomingEventsCount, setUpcomingEventsCount] = useState<number>(0);
  const [activeCampaignCount, setActiveCampaignCount] = useState<number>(0);
  const [mediaCount, setMediaCount] = useState<number>(0);
  const [latestInvoiceTotal, setLatestInvoiceTotal] = useState<number>(0);
  const [pendingReceiptsCount, setPendingReceiptsCount] = useState<number>(0); // real data
  const [pendingReceiptsDollars, setPendingReceiptsDollars] = useState<number>(0); // real data

  // Analytics (customersSent and monthlyGrowth still need real receipt/user aggregation)
  const analytics = useMemo(
    () => ({
      customersSent: 0,
      monthlyGrowth: 0,
    }),
    []
  );

  useEffect(() => {
    let mounted = true;

    async function loadOverview() {
      if (!businessId) return;

      setLoading(true);
      setLoadNote(null);

      try {
        // 1) Upcoming events count
        // We use start_at >= now AND is_cancelled = false
        const nowIso = new Date().toISOString();
        const ev = await supabaseBrowser
          .from("business_events")
          .select("id", { count: "exact", head: true })
          .eq("business_id", businessId)
          .eq("is_cancelled", false)
          .gte("start_at", nowIso);

        if (!ev.error && typeof ev.count === "number") setUpcomingEventsCount(ev.count);

        // 2) Active/Scheduled ad campaigns count (read-first)
        const ads = await supabaseBrowser
          .from("business_ad_campaigns")
          .select("id,status", { count: "exact", head: true })
          .eq("business_id", businessId);

        if (!ads.error && typeof ads.count === "number") {
          // If we can’t filter by status via head query, keep total count
          setActiveCampaignCount(ads.count);
        }

        // 3) Media count (active photos/videos)
        // Your business_media schema: bucket, path, media_type, is_active
        const media = await supabaseBrowser
          .from("business_media")
          .select("id", { count: "exact", head: true })
          .eq("business_id", businessId)
          .eq("bucket", "business-media")
          .eq("is_active", true);

        if (!media.error && typeof media.count === "number") setMediaCount(media.count);

        // 4) Latest invoice total (invoices are your best “revenue-ish” signal right now)
        // Prefer v_invoices_read, fallback to invoices
        let latestTotal = null as number | null;

        const invView = await supabaseBrowser
          .from("v_invoices_read")
          .select("total_cents,period_end,created_at")
          .eq("business_id", businessId)
          .order("period_end", { ascending: false })
          .limit(1);

        if (!invView.error && invView.data && invView.data.length > 0) {
          const row: any = invView.data[0];
          const cents = Number(row.total_cents ?? 0);
          if (Number.isFinite(cents)) latestTotal = cents / 100;
        } else {
          const invBase = await supabaseBrowser
            .from("invoices")
            .select("total_cents,period_end,created_at")
            .eq("business_id", businessId)
            .order("period_end", { ascending: false })
            .limit(1);

          if (!invBase.error && invBase.data && invBase.data.length > 0) {
            const row: any = invBase.data[0];
            const cents = Number(row.total_cents ?? 0);
            if (Number.isFinite(cents)) latestTotal = cents / 100;
          }
        }

        if (latestTotal !== null) setLatestInvoiceTotal(latestTotal);

        // 5) Pending receipts count and dollar amount
        // status = 'pending' means awaiting business approval
        const receipts = await supabaseBrowser
          .from("receipts")
          .select("id,receipt_total_cents")
          .eq("business_id", businessId)
          .eq("status", "pending");

        if (!receipts.error && receipts.data) {
          setPendingReceiptsCount(receipts.data.length);
          const totalCents = receipts.data.reduce((sum, r) => sum + (Number(r.receipt_total_cents) || 0), 0);
          setPendingReceiptsDollars(totalCents / 100);
        }
      } catch (e) {
        // Non-blocking: Overview should still render with fallbacks
        setLoadNote(normalizeErr(e));
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }

    loadOverview();
    return () => {
      mounted = false;
    };
  }, [businessId]);

  // Premium-only areas to “gray” but keep visible
  const premiumOnlyActions = new Set(["events", "advertising"]);

  const quickActions = useMemo(
    () => [
      {
        title: "Receipt Redemption",
        description: "Review and approve customer receipts",
        icon: <FileText size={20} />,
        color: colors.primary,
        action: "receipts",
        badge: `${pendingReceiptsCount} pending`,
      },
      {
        title: "Events",
        description: "Manage upcoming and past events",
        icon: <Calendar size={20} />,
        color: colors.accent,
        action: "events",
        badge: `${upcomingEventsCount} upcoming`,
      },
      {
        title: "Media Gallery",
        description: "Upload photos and videos",
        icon: <Camera size={20} />,
        color: colors.secondary,
        action: "media",
        badge: mediaCount > 0 ? `${mediaCount} files` : "Add content",
      },
      {
        title: "Advertising",
        description: "Boost visibility with campaigns",
        icon: <TrendingUp size={20} />,
        color: colors.warning,
        action: "advertising",
        badge: activeCampaignCount > 0 ? `${activeCampaignCount} campaigns` : "5 options",
      },
    ],
    [
      colors.primary,
      colors.accent,
      colors.secondary,
      colors.warning,
      pendingReceiptsCount,
      upcomingEventsCount,
      mediaCount,
      activeCampaignCount,
    ]
  );

  return (
    <div>
      {/* Launch phase banner */}
      <LaunchBanner variant="business" />

      {/* Load note banner */}
      {loadNote && (
        <div
          style={{
            marginBottom: "1.25rem",
            padding: "0.9rem 1rem",
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid rgba(255, 255, 255, 0.10)",
            borderRadius: "12px",
            color: "rgba(255,255,255,0.85)",
            fontSize: "0.875rem",
            fontWeight: 800,
            lineHeight: 1.5,
          }}
        >
          <AlertCircle size={16} style={{ marginRight: "0.5rem", verticalAlign: "text-bottom", opacity: 0.9 }} />
          {loadNote}
        </div>
      )}

      {/* Welcome Header */}
      <div
        style={{
          background: `linear-gradient(135deg, ${colors.primary}20 0%, ${colors.accent}20 100%)`,
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "16px",
          padding: "2rem",
          marginBottom: "2rem",
        }}
      >
        <div style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.5rem" }}>
          Welcome to Your LetsGo Business Dashboard
        </div>
        <div style={{ fontSize: "0.9375rem", color: "rgba(255, 255, 255, 0.7)", lineHeight: 1.6 }}>
          Your complete business management platform with receipt redemption, event management, analytics,
          advertising, and comprehensive support tools.
        </div>

        <div style={{ marginTop: "0.75rem", fontSize: "0.75rem", color: "rgba(255,255,255,0.35)" }}>
          Business ID: <span style={{ fontFamily: '"Space Mono", monospace' }}>{businessId}</span>
          {" • "}
          Plan: <span style={{ fontFamily: '"Space Mono", monospace' }}>{isPremium ? "premium" : "basic"}</span>
          {loading ? <span>{" • "}loading…</span> : null}
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "1.5rem",
          marginBottom: "2rem",
        }}
      >
        {[
          {
            icon: <Users size={24} />,
            label: "Total Customers",
            value: analytics.customersSent > 0 ? analytics.customersSent.toLocaleString() : "—",
            change: analytics.customersSent > 0 ? `+${analytics.monthlyGrowth}% this month` : "View Analytics tab",
            color: colors.primary,
          },
          {
            icon: <DollarSign size={24} />,
            label: "Latest Invoice Total",
            value: money0(latestInvoiceTotal),
            change: "Pulled from most recent invoice",
            color: colors.success,
          },
          {
            icon: <Calendar size={24} />,
            label: "Upcoming Events",
            value: `${upcomingEventsCount}`,
            change: isPremium ? "Open Events tab to manage" : "Premium feature",
            color: colors.accent,
          },
          {
            icon: <Clock size={24} />,
            label: "Pending Receipts",
            value: `${pendingReceiptsCount}`,
            change: pendingReceiptsDollars > 0 ? `$${pendingReceiptsDollars.toLocaleString()} pending` : "None pending",
            color: colors.warning,
          },
        ].map((stat, idx) => (
          <div
            key={idx}
            style={{
              background: "rgba(255, 255, 255, 0.03)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "16px",
              padding: "1.5rem",
              position: "relative",
              overflow: "hidden",
              transition: "all 0.3s ease",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "-50%",
                right: "-20%",
                width: "150px",
                height: "150px",
                background: `radial-gradient(circle, ${stat.color}40 0%, transparent 70%)`,
                borderRadius: "50%",
              }}
            />
            <div
              style={{
                width: "48px",
                height: "48px",
                background: `${stat.color}20`,
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "1rem",
                color: stat.color,
              }}
            >
              {stat.icon}
            </div>
            <div style={{ fontSize: "0.875rem", color: "rgba(255, 255, 255, 0.6)", marginBottom: "0.5rem" }}>
              {stat.label}
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "0.5rem", fontFamily: '"Space Mono", monospace' }}>
              {stat.value}
            </div>
            <div style={{ fontSize: "0.875rem", color: "rgba(255, 255, 255, 0.7)", fontWeight: 600 }}>
              {stat.change}
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(250px, 1fr))",
          gap: "1.5rem",
          marginBottom: "1rem",
        }}
      >
        {quickActions.map((action, idx) => {
          const isLocked = premiumOnlyActions.has(action.action) && !isPremium;

          return (
            <div
              key={idx}
              onClick={() => {
                if (isLocked) return;
                setActiveTab(action.action);
              }}
              style={{
                background: "rgba(255, 255, 255, 0.03)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "12px",
                padding: "1.5rem",
                cursor: isLocked ? "not-allowed" : "pointer",
                transition: "all 0.3s ease",
                position: "relative",
                opacity: isLocked ? 0.45 : 1,
                filter: isLocked ? "grayscale(1)" : "none",
              }}
              title={isLocked ? "Upgrade to Premium to unlock this feature." : undefined}
            >
              <div
                style={{
                  position: "absolute",
                  top: "1rem",
                  right: "1rem",
                  background: `${action.color}20`,
                  color: action.color,
                  padding: "0.25rem 0.75rem",
                  borderRadius: "6px",
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                {action.badge}
                {isLocked && (
                  <span
                    style={{
                      padding: "0.12rem 0.5rem",
                      borderRadius: "999px",
                      background: "rgba(249,115,22,0.25)",
                      border: "1px solid rgba(249,115,22,0.5)",
                      color: "rgba(255,255,255,0.9)",
                      fontSize: "0.65rem",
                      fontWeight: 900,
                      letterSpacing: "0.05em",
                    }}
                  >
                    PREMIUM
                  </span>
                )}
              </div>

              <div
                style={{
                  width: "40px",
                  height: "40px",
                  background: `${action.color}20`,
                  borderRadius: "10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "1rem",
                  color: action.color,
                }}
              >
                {action.icon}
              </div>

              <div style={{ fontSize: "1.125rem", fontWeight: 800, marginBottom: "0.5rem" }}>{action.title}</div>
              <div style={{ fontSize: "0.875rem", color: "rgba(255, 255, 255, 0.6)", lineHeight: 1.5 }}>
                {action.description}
              </div>
            </div>
          );
        })}
      </div>

      {!isPremium && (
        <div
          style={{
            marginTop: "1rem",
            padding: "0.75rem 1rem",
            background: "rgba(249, 115, 22, 0.12)",
            border: "1px solid rgba(249, 115, 22, 0.35)",
            borderRadius: "10px",
            color: "rgba(255, 255, 255, 0.9)",
            fontSize: "0.875rem",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <AlertCircle size={18} style={{ color: colors.secondary }} />
          Upgrade to <span style={{ color: colors.secondary }}>Premium</span> to unlock{" "}
          <span style={{ color: colors.secondary }}>Events</span> and{" "}
          <span style={{ color: colors.secondary }}>Advertising</span>.
        </div>
      )}

      {/* Suite Summary */}
      <div
        style={{
          marginTop: "2rem",
          background: "rgba(255, 255, 255, 0.03)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "16px",
          padding: "2rem",
        }}
      >
        <div style={{ fontSize: "1.25rem", fontWeight: 800, marginBottom: "1.5rem" }}>
          Your Complete Business Management Suite
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.5rem" }}>
          {[
            { icon: <BarChart3 size={18} />, title: "Analytics", description: "Revenue tracking & insights" },
            { icon: <Calendar size={18} />, title: "Event Management", description: "Create & track events" },
            { icon: <TrendingUp size={18} />, title: "Advertising", description: "Boost your visibility" },
            { icon: <FileText size={18} />, title: "Receipts", description: "Receipt redemption workflow" },
          ].map((feature, idx) => (
            <div
              key={idx}
              style={{
                padding: "1rem",
                background: "rgba(255, 255, 255, 0.02)",
                borderRadius: "8px",
                border: "1px solid rgba(255, 255, 255, 0.05)",
              }}
            >
              <div style={{ color: colors.primary, marginBottom: "0.75rem" }}>{feature.icon}</div>
              <div style={{ fontSize: "0.875rem", fontWeight: 700, marginBottom: "0.25rem" }}>{feature.title}</div>
              <div style={{ fontSize: "0.75rem", color: "rgba(255, 255, 255, 0.5)" }}>{feature.description}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}