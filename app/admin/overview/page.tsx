"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import {
  COLORS,
  Card,
  StatCard,
  SectionTitle,
  DataTable,
  formatMoney,
  formatDateTime,
} from "@/components/admin/components";

// ==================== TYPES ====================
interface Notification {
  id: string;
  priority: "urgent" | "high" | "medium" | "low";
  type: string;
  title: string;
  message: string;
  created_at: string;
  read: boolean;
  link: string;
}

interface RealtimeActivity {
  id: string;
  type: "receipt_submitted" | "user_signup" | "receipt_approved" | "payout_completed" | "business_login";
  message: string;
  user?: string;
  business?: string;
  amount?: number;
  timestamp: string;
}

interface StaffUser {
  user_id: string;
  email?: string;
  name?: string;
}

// ==================== OVERVIEW PAGE ====================
export default function OverviewPage() {
  const router = useRouter();
  
  // Data states
  const [currentStaff, setCurrentStaff] = useState<StaffUser | null>(null);
  const [pendingReceiptsCount, setPendingReceiptsCount] = useState(0);
  const [pendingOnboardingCount, setPendingOnboardingCount] = useState(0);
  const [pendingInvoicesCount, setPendingInvoicesCount] = useState(0);
  const [pendingPayoutsTotal, setPendingPayoutsTotal] = useState(0);
  const [todayReceipts, setTodayReceipts] = useState(0);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [todayNewUsers, setTodayNewUsers] = useState(0);
  const [usersOnlineNow, setUsersOnlineNow] = useState(0);
  const [businessesOnlineCount, setBusinessesOnlineCount] = useState(0);
  const [receiptsThisHour, setReceiptsThisHour] = useState(0);

  // Platform metrics
  const [activeInfluencers, setActiveInfluencers] = useState(0);
  const [activeSurgeEvents, setActiveSurgeEvents] = useState(0);
  const [activeAdCampaigns, setActiveAdCampaigns] = useState(0);
  const [customTierBusinesses, setCustomTierBusinesses] = useState(0);
  
  // Live activity
  const [liveStatsEnabled, setLiveStatsEnabled] = useState(true);
  const [realtimeActivity, setRealtimeActivity] = useState<RealtimeActivity[]>([]);
  
  // Notifications
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  // Comparison stats
  const [yesterdayReceipts, setYesterdayReceipts] = useState(0);
  const [yesterdayNewUsers, setYesterdayNewUsers] = useState(0);
  const [yesterdayRevenue, setYesterdayRevenue] = useState(0);
  
  const [loading, setLoading] = useState(true);

  // Navigate to other admin pages
  const goTo = (page: string) => {
    router.push(`/admin/${page}`);
  };

  // Fetch current staff user
  const fetchCurrentStaff = useCallback(async () => {
    try {
      const { data: { user } } = await supabaseBrowser.auth.getUser();
      if (user) {
        // Try to get name from profiles table
        const { data: profileData } = await supabaseBrowser
          .from("profiles")
          .select("full_name, first_name, last_name")
          .eq("id", user.id)
          .single();
        
        // Try to get name from staff_users table
        const { data: staffData } = await supabaseBrowser
          .from("staff_users")
          .select("name, full_name, role")
          .eq("user_id", user.id)
          .single();
        
        // Helper: check if a value is actually a name (not an email)
        const isRealName = (val: string | null | undefined): val is string => {
          return !!val && !val.includes("@") && val.trim().length > 0;
        };
        
        // Build name from profiles first_name + last_name if available
        const profileFullName = profileData?.full_name;
        const profileCombined = [profileData?.first_name, profileData?.last_name].filter(Boolean).join(" ");
        
        const displayName = 
          (isRealName(staffData?.full_name) ? staffData.full_name : null) ||
          (isRealName(staffData?.name) ? staffData.name : null) ||
          (isRealName(profileFullName) ? profileFullName : null) ||
          (isRealName(profileCombined) ? profileCombined : null) ||
          (isRealName(user.user_metadata?.full_name) ? user.user_metadata.full_name : null) ||
          user.email?.split("@")[0] || 
          "Staff";
        
        setCurrentStaff({
          user_id: user.id,
          email: user.email,
          name: displayName,
        });
      }
    } catch (err) {
      console.error("Error fetching staff:", err);
    }
  }, []);

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    try {
      // Pending receipts (awaiting admin final approval)
      const { count: pendingReceipts } = await supabaseBrowser
        .from("receipts")
        .select("*", { count: "exact", head: true })
        .eq("status", "business_approved");
      setPendingReceiptsCount(pendingReceipts || 0);

      // Pending onboarding
      const { count: pendingOnboarding } = await supabaseBrowser
        .from("partner_onboarding_submissions")
        .select("*", { count: "exact", head: true })
        .in("status", ["pending_review", "submitted"]);
      setPendingOnboardingCount(pendingOnboarding || 0);

      // Pending invoices
      const { count: pendingInvoices } = await supabaseBrowser
        .from("invoices")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      setPendingInvoicesCount(pendingInvoices || 0);

      // Pending payouts total
      const { data: pendingPayouts } = await supabaseBrowser
        .from("payouts")
        .select("amount_cents")
        .eq("status", "pending");
      const payoutsTotal = pendingPayouts?.reduce((sum, p) => sum + (p.amount_cents || 0), 0) || 0;
      setPendingPayoutsTotal(payoutsTotal);

      // Today's date range
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();
      
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayISO = yesterday.toISOString();

      // Today's receipts
      const { count: todayReceiptsCount } = await supabaseBrowser
        .from("receipts")
        .select("*", { count: "exact", head: true })
        .gte("created_at", todayISO);
      setTodayReceipts(todayReceiptsCount || 0);

      // Yesterday's receipts
      const { count: yesterdayReceiptsCount } = await supabaseBrowser
        .from("receipts")
        .select("*", { count: "exact", head: true })
        .gte("created_at", yesterdayISO)
        .lt("created_at", todayISO);
      setYesterdayReceipts(yesterdayReceiptsCount || 0);

      // Today's revenue (from approved receipts only)
      const { data: todayRevenueData } = await supabaseBrowser
        .from("receipts")
        .select("receipt_total_cents")
        .eq("status", "approved")
        .gte("created_at", todayISO);
      const todayRev = todayRevenueData?.reduce((sum, r) => sum + (r.receipt_total_cents || 0), 0) || 0;
      setTodayRevenue(todayRev);

      // Yesterday's revenue (approved only)
      const { data: yesterdayRevenueData } = await supabaseBrowser
        .from("receipts")
        .select("receipt_total_cents")
        .eq("status", "approved")
        .gte("created_at", yesterdayISO)
        .lt("created_at", todayISO);
      const yesterdayRev = yesterdayRevenueData?.reduce((sum, r) => sum + (r.receipt_total_cents || 0), 0) || 0;
      setYesterdayRevenue(yesterdayRev);

      // Receipts this hour
      const hourAgo = new Date();
      hourAgo.setHours(hourAgo.getHours() - 1);
      const { count: hourReceipts } = await supabaseBrowser
        .from("receipts")
        .select("*", { count: "exact", head: true })
        .gte("created_at", hourAgo.toISOString());
      setReceiptsThisHour(hourReceipts || 0);

      // Businesses online (active businesses)
      const { count: activeBiz } = await supabaseBrowser
        .from("business")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);
      setBusinessesOnlineCount(activeBiz || 0);

      // Users online now (heartbeat within last 5 minutes)
      try {
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const { count: onlineCount } = await supabaseBrowser
          .from("user_activity")
          .select("*", { count: "exact", head: true })
          .gte("last_seen_at", fiveMinAgo);
        setUsersOnlineNow(onlineCount || 0);
      } catch { setUsersOnlineNow(0); }

      // New users today (profiles created today)
      try {
        const { count: newToday } = await supabaseBrowser
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .gte("created_at", todayISO);
        setTodayNewUsers(newToday || 0);
      } catch { setTodayNewUsers(0); }

      // New users yesterday
      try {
        const { count: newYesterday } = await supabaseBrowser
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .gte("created_at", yesterdayISO)
          .lt("created_at", todayISO);
        setYesterdayNewUsers(newYesterday || 0);
      } catch { setYesterdayNewUsers(0); }

      // Platform metrics — wrapped in try/catch for graceful fallback
      try {
        const { count: influencerCount } = await supabaseBrowser
          .from("influencers")
          .select("*", { count: "exact", head: true })
          .eq("status", "active");
        setActiveInfluencers(influencerCount || 0);
      } catch { setActiveInfluencers(0); }

      try {
        const now = new Date().toISOString();
        const { count: surgeCount } = await supabaseBrowser
          .from("surge_pricing_events")
          .select("*", { count: "exact", head: true })
          .eq("is_active", true)
          .lte("start_date", now)
          .gte("end_date", now);
        setActiveSurgeEvents(surgeCount || 0);
      } catch { setActiveSurgeEvents(0); }

      try {
        const { count: adCount } = await supabaseBrowser
          .from("business_ad_campaigns")
          .select("*", { count: "exact", head: true })
          .eq("status", "active");
        setActiveAdCampaigns(adCount || 0);
      } catch { setActiveAdCampaigns(0); }

      try {
        const { count: customTierCount } = await supabaseBrowser
          .from("business")
          .select("*", { count: "exact", head: true })
          .eq("has_custom_tiers", true);
        setCustomTierBusinesses(customTierCount || 0);
      } catch { setCustomTierBusinesses(0); }

      // Generate notifications based on real data
      const notifs: Notification[] = [];
      
      if ((pendingReceipts || 0) > 10) {
        notifs.push({
          id: "notif_receipts",
          priority: "high",
          type: "receipt_waiting",
          title: `${pendingReceipts} receipts awaiting approval`,
          message: "Receipt queue is building up. Review needed.",
          created_at: new Date().toISOString(),
          read: false,
          link: "receipts",
        });
      }
      
      if ((pendingOnboarding || 0) > 0) {
        notifs.push({
          id: "notif_onboarding",
          priority: "medium",
          type: "new_submission",
          title: `${pendingOnboarding} new business applications`,
          message: "New partner applications awaiting review.",
          created_at: new Date().toISOString(),
          read: false,
          link: "onboarding",
        });
      }

      // Check for fraud alerts
      const { count: fraudCount } = await supabaseBrowser
        .from("fraud_alerts")
        .select("*", { count: "exact", head: true })
        .eq("status", "open");
      
      if ((fraudCount || 0) > 0) {
        notifs.push({
          id: "notif_fraud",
          priority: "urgent",
          type: "flagged_account",
          title: `${fraudCount} fraud alerts need attention`,
          message: "Critical: Review flagged accounts immediately.",
          created_at: new Date().toISOString(),
          read: false,
          link: "fraud",
        });
      }

      // Surge pricing notification
      try {
        const now = new Date().toISOString();
        const { count: activeSurge } = await supabaseBrowser
          .from("surge_pricing_events")
          .select("*", { count: "exact", head: true })
          .eq("is_active", true)
          .lte("start_date", now)
          .gte("end_date", now);
        if ((activeSurge || 0) > 0) {
          notifs.push({
            id: "notif_surge",
            priority: "medium",
            type: "surge_active",
            title: `${activeSurge} surge pricing event${activeSurge === 1 ? "" : "s"} active`,
            message: "Surge pricing is currently affecting ad campaign fees.",
            created_at: new Date().toISOString(),
            read: false,
            link: "advertising",
          });
        }
      } catch { /* surge table may not exist yet */ }

      setNotifications(notifs);

    } catch (err) {
      console.error("Error fetching dashboard data:", err);
    }
  }, []);

  // Fetch recent activity
  const fetchRecentActivity = useCallback(async () => {
    try {
      // Recent receipts as activity
      const { data: recentReceipts } = await supabaseBrowser
        .from("receipts")
        .select("id, user_id, business_id, receipt_total_cents, status, created_at")
        .order("created_at", { ascending: false })
        .limit(10);

      const activities: RealtimeActivity[] = [];

      recentReceipts?.forEach((receipt) => {
        activities.push({
          id: `receipt_${receipt.id}`,
          type: receipt.status === "Approved" ? "receipt_approved" : "receipt_submitted",
          message: receipt.status === "Approved" ? "Receipt approved" : "New receipt submitted",
          user: `User ${receipt.user_id?.slice(0, 8)}...`,
          business: receipt.business_id || "Unknown Business",
          amount: receipt.receipt_total_cents,
          timestamp: receipt.created_at,
        });
      });

      // Recent payouts
      const { data: recentPayouts } = await supabaseBrowser
        .from("payouts")
        .select("id, business_id, amount_cents, status, created_at")
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(5);

      recentPayouts?.forEach((payout) => {
        activities.push({
          id: `payout_${payout.id}`,
          type: "payout_completed",
          message: "Payout completed",
          business: payout.business_id || "Unknown Business",
          amount: payout.amount_cents,
          timestamp: payout.created_at,
        });
      });

      // Sort by timestamp
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setRealtimeActivity(activities.slice(0, 15));

    } catch (err) {
      console.error("Error fetching activity:", err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchCurrentStaff(),
        fetchDashboardData(),
        fetchRecentActivity(),
      ]);
      setLoading(false);
    };
    loadData();
  }, [fetchCurrentStaff, fetchDashboardData, fetchRecentActivity]);

  // Auto-refresh when live stats enabled
  useEffect(() => {
    if (!liveStatsEnabled) return;
    
    const interval = setInterval(() => {
      fetchDashboardData();
      fetchRecentActivity();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [liveStatsEnabled, fetchDashboardData, fetchRecentActivity]);

  // Mark notification as read
  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  // Mark all as read
  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  // Calculate change percentage
  const calcChange = (today: number, yesterday: number): { value: string; isUp: boolean } => {
    if (yesterday === 0) return { value: "N/A", isUp: true };
    const change = ((today - yesterday) / yesterday * 100).toFixed(1);
    return { value: Math.abs(parseFloat(change)) + "%", isUp: today >= yesterday };
  };

  if (loading) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.textSecondary }}>
        Loading dashboard...
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 32 }}>
      {/* Welcome Header */}
      <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 32 }}>
        Welcome back,{" "}
        <span style={{ background: COLORS.gradient1, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          {currentStaff?.name?.split(" ")[0] || "Staff"}
        </span>
        !
      </h1>

      {/* Overview Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 32 }}>
        <StatCard icon="🧾" value={pendingReceiptsCount} label="Receipts Awaiting Approval" gradient={COLORS.gradient3} />
        <StatCard icon="📥" value={pendingOnboardingCount} label="Pending Onboarding" gradient={COLORS.gradient4} />
        <StatCard icon="💳" value={pendingInvoicesCount} label="Pending Invoices" gradient={COLORS.gradient1} />
        <StatCard icon="💰" value={formatMoney(pendingPayoutsTotal)} label="Pending in User Accounts" gradient={COLORS.gradient2} />
      </div>

      {/* Platform Metrics */}
      <SectionTitle icon="🚀">Platform Metrics</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 32 }}>
        <StatCard icon="📣" value={activeInfluencers} label="Active Influencers" gradient={COLORS.gradient1} />
        <StatCard icon="⚡" value={activeSurgeEvents} label="Active Surge Events" gradient={COLORS.gradient3} />
        <StatCard icon="📺" value={activeAdCampaigns} label="Active Ad Campaigns" gradient={COLORS.gradient2} />
        <StatCard icon="🎯" value={customTierBusinesses} label="Custom Tier Businesses" gradient={COLORS.gradient4} />
      </div>

      {/* Quick Actions */}
      <Card title="Quick Actions">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {[
            { page: "receipts", icon: "🧾", label: "Review Receipts", desc: pendingReceiptsCount + " pending", g: COLORS.gradient3 },
            { page: "billing", icon: "💳", label: "Process Billing", desc: pendingInvoicesCount + " invoices", g: COLORS.gradient2 },
            { page: "onboarding", icon: "📥", label: "Review Onboarding", desc: pendingOnboardingCount + " applications", g: COLORS.gradient4 },
            { page: "executive", icon: "📊", label: "Executive Dashboard", desc: "View analytics", g: COLORS.gradient1 },
          ].map((a) => (
            <button
              key={a.page}
              onClick={() => goTo(a.page)}
              style={{
                padding: 24,
                background: a.g,
                border: "none",
                borderRadius: 16,
                cursor: "pointer",
                textAlign: "left",
                transition: "transform 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.02)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
            >
              <div style={{ fontSize: 36, marginBottom: 12 }}>{a.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#fff", marginBottom: 4 }}>{a.label}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)" }}>{a.desc}</div>
            </button>
          ))}
        </div>
      </Card>

      {/* Live Activity Feed */}
      <SectionTitle icon="⚡">Live Activity Feed</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24, marginBottom: 32 }}>
        {/* Activity Feed */}
        <Card
          title={
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: liveStatsEnabled ? COLORS.neonGreen : COLORS.cardBorder,
                  animation: liveStatsEnabled ? "pulse 2s infinite" : "none",
                }}
              />
              <span>Live Activity Stream</span>
            </div>
          }
          actions={
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <span style={{ fontSize: 11, color: COLORS.textSecondary }}>Auto-refresh</span>
              <input
                type="checkbox"
                checked={liveStatsEnabled}
                onChange={(e) => setLiveStatsEnabled(e.target.checked)}
                style={{ accentColor: COLORS.neonGreen }}
              />
            </label>
          }
        >
          <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
          <div style={{ maxHeight: 350, overflowY: "auto" }}>
            {realtimeActivity.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: COLORS.textSecondary }}>
                No recent activity
              </div>
            ) : (
              realtimeActivity.map((activity, i) => {
                const timeAgo = Math.round((Date.now() - new Date(activity.timestamp).getTime()) / 60000);
                const icons: Record<string, string> = {
                  receipt_submitted: "🧾",
                  user_signup: "👤",
                  receipt_approved: "✅",
                  payout_completed: "💰",
                  business_login: "🏢",
                };
                const colors: Record<string, string> = {
                  receipt_submitted: COLORS.neonBlue,
                  user_signup: COLORS.neonPink,
                  receipt_approved: COLORS.neonGreen,
                  payout_completed: COLORS.neonGreen,
                  business_login: COLORS.neonPurple,
                };
                return (
                  <div
                    key={activity.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: 12,
                      borderBottom: "1px solid " + COLORS.cardBorder,
                      animation: i === 0 && liveStatsEnabled ? "slideIn 0.3s ease" : "none",
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: (colors[activity.type] || COLORS.neonBlue) + "33",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 18,
                      }}
                    >
                      {icons[activity.type] || "🔔"}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{activity.message}</div>
                      <div style={{ fontSize: 11, color: COLORS.textSecondary }}>
                        {activity.user && <span>{activity.user}</span>}
                        {activity.user && activity.business && <span> at </span>}
                        {activity.business && <span style={{ color: COLORS.neonPink }}>{activity.business}</span>}
                        {activity.amount && (
                          <span>
                            {" "}
                            • <span style={{ color: COLORS.neonGreen }}>{formatMoney(activity.amount)}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: COLORS.textSecondary }}>
                      {timeAgo < 1 ? "Just now" : timeAgo + "m ago"}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <style>{`@keyframes slideIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        </Card>

        {/* Live Stats */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card title="🔴 Right Now">
            <div style={{ display: "grid", gap: 16 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: 16,
                  background: COLORS.darkBg,
                  borderRadius: 10,
                  border: usersOnlineNow > 0 ? `1px solid ${COLORS.neonGreen}44` : "none",
                }}
              >
                <div>
                  <div style={{ fontSize: 11, color: COLORS.textSecondary }}>Users Online Now</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: COLORS.neonGreen }}>{usersOnlineNow.toLocaleString()}</div>
                </div>
                <div style={{ fontSize: 32 }}>🟢</div>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: 16,
                  background: COLORS.darkBg,
                  borderRadius: 10,
                }}
              >
                <div>
                  <div style={{ fontSize: 11, color: COLORS.textSecondary }}>Active Businesses</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: COLORS.neonPink }}>{businessesOnlineCount}</div>
                </div>
                <div style={{ fontSize: 32 }}>🏢</div>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: 16,
                  background: COLORS.darkBg,
                  borderRadius: 10,
                }}
              >
                <div>
                  <div style={{ fontSize: 11, color: COLORS.textSecondary }}>Receipts This Hour</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: COLORS.neonBlue }}>{receiptsThisHour}</div>
                </div>
                <div style={{ fontSize: 32 }}>🧾</div>
              </div>
            </div>
          </Card>

          <Card title="📊 Today vs Yesterday">
            <div style={{ display: "grid", gap: 12 }}>
              {[
                { label: "Receipts", today: todayReceipts, yesterday: yesterdayReceipts, icon: "🧾" },
                { label: "New Users", today: todayNewUsers, yesterday: yesterdayNewUsers, icon: "👤" },
                { label: "Revenue", today: todayRevenue, yesterday: yesterdayRevenue, icon: "💰", isMoney: true },
              ].map((stat, i) => {
                const change = calcChange(stat.today, stat.yesterday);
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: 10,
                      background: COLORS.darkBg,
                      borderRadius: 8,
                    }}
                  >
                    <span style={{ fontSize: 11, color: COLORS.textSecondary }}>
                      {stat.icon} {stat.label}
                    </span>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontWeight: 600 }}>{stat.isMoney ? formatMoney(stat.today) : stat.today}</span>
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: 11,
                          color: change.isUp ? COLORS.neonGreen : COLORS.neonRed,
                        }}
                      >
                        {change.isUp ? "↑" : "↓"} {change.value}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      {/* Today's Snapshot */}
      <SectionTitle icon="📈">Today&apos;s Snapshot</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, marginBottom: 32 }}>
        <Card title="Receipts Today">
          <div style={{ fontSize: 36, fontWeight: 700, color: COLORS.neonBlue }}>{todayReceipts}</div>
          <div style={{ fontSize: 12, color: COLORS.textSecondary }}>receipts processed</div>
        </Card>
        <Card title="Revenue Today">
          <div style={{ fontSize: 36, fontWeight: 700, color: COLORS.neonGreen }}>{formatMoney(todayRevenue)}</div>
          <div style={{ fontSize: 12, color: COLORS.textSecondary }}>total revenue</div>
        </Card>
        <Card title="New Users Today">
          <div style={{ fontSize: 36, fontWeight: 700, color: COLORS.neonPink }}>{todayNewUsers}</div>
          <div style={{ fontSize: 12, color: COLORS.textSecondary }}>new signups</div>
        </Card>
      </div>

      {/* Notification Center */}
      <SectionTitle icon="🔔">Notification Center</SectionTitle>

      {/* Urgency Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <div
          style={{
            background: "linear-gradient(135deg, #ff3131, #990000)",
            borderRadius: 16,
            padding: 20,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ position: "absolute", top: 12, right: 12, fontSize: 32, opacity: 0.3 }}>🚨</div>
          <div style={{ fontSize: 36, fontWeight: 800, color: "#fff" }}>
            {notifications.filter((n) => n.priority === "urgent").length}
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", fontWeight: 600 }}>URGENT</div>
        </div>
        <div
          style={{
            background: "linear-gradient(135deg, #ff6b35, #cc4400)",
            borderRadius: 16,
            padding: 20,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ position: "absolute", top: 12, right: 12, fontSize: 32, opacity: 0.3 }}>⚠️</div>
          <div style={{ fontSize: 36, fontWeight: 800, color: "#fff" }}>
            {notifications.filter((n) => n.priority === "high").length}
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", fontWeight: 600 }}>HIGH</div>
        </div>
        <div
          style={{
            background: "linear-gradient(135deg, #ffff00, #cc9900)",
            borderRadius: 16,
            padding: 20,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ position: "absolute", top: 12, right: 12, fontSize: 32, opacity: 0.3 }}>📌</div>
          <div style={{ fontSize: 36, fontWeight: 800, color: "#000" }}>
            {notifications.filter((n) => n.priority === "medium").length}
          </div>
          <div style={{ fontSize: 12, color: "rgba(0,0,0,0.7)", fontWeight: 600 }}>MEDIUM</div>
        </div>
        <div
          style={{
            background: COLORS.cardBg,
            border: "1px solid " + COLORS.cardBorder,
            borderRadius: 16,
            padding: 20,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ position: "absolute", top: 12, right: 12, fontSize: 32, opacity: 0.3 }}>✓</div>
          <div style={{ fontSize: 36, fontWeight: 800, color: COLORS.textPrimary }}>
            {notifications.filter((n) => n.read).length}
          </div>
          <div style={{ fontSize: 12, color: COLORS.textSecondary, fontWeight: 600 }}>READ</div>
        </div>
      </div>

      {/* Notification History Table */}
      <Card
        title="NOTIFICATION HISTORY"
        actions={
          <button
            onClick={markAllRead}
            style={{
              padding: "8px 16px",
              background: COLORS.darkBg,
              border: "1px solid " + COLORS.cardBorder,
              borderRadius: 8,
              color: COLORS.neonPink,
              fontSize: 11,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Mark All Read
          </button>
        }
      >
        {notifications.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary }}>
            No notifications - everything looks good! 🎉
          </div>
        ) : (
          <DataTable
            columns={[
              {
                key: "priority",
                label: "Urgency",
                render: (v: unknown) => {
                  const priority = v as string;
                  const urgencyStyles: Record<string, { bg: string; color: string; icon: string }> = {
                    urgent: { bg: "linear-gradient(135deg, #ff3131, #990000)", color: "#fff", icon: "🚨" },
                    high: { bg: "linear-gradient(135deg, #ff6b35, #cc4400)", color: "#fff", icon: "⚠️" },
                    medium: { bg: "linear-gradient(135deg, #ffff00, #cc9900)", color: "#000", icon: "📌" },
                    low: { bg: COLORS.cardBg, color: COLORS.textSecondary, icon: "📢" },
                  };
                  const s = urgencyStyles[priority] || urgencyStyles.low;
                  return (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          padding: "6px 12px",
                          borderRadius: 8,
                          background: s.bg,
                          color: s.color,
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <span>{s.icon}</span> {priority}
                      </span>
                    </div>
                  );
                },
              },
              {
                key: "type",
                label: "Type",
                render: (v: unknown) => {
                  const type = v as string;
                  const typeIcons: Record<string, string> = {
                    new_submission: "📥",
                    receipt_waiting: "🧾",
                    failed_payment: "💳",
                    flagged_account: "🚩",
                    payout_failed: "💸",
                    surge_active: "⚡",
                  };
                  return (
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 16 }}>{typeIcons[type] || "🔔"}</span>
                      <span style={{ textTransform: "capitalize" }}>{type?.replace(/_/g, " ")}</span>
                    </span>
                  );
                },
              },
              {
                key: "title",
                label: "Title",
                render: (v: unknown, row: unknown) => {
                  const notif = row as Notification;
                  return (
                    <div>
                      <div style={{ fontWeight: 600, color: notif.read ? COLORS.textSecondary : COLORS.textPrimary }}>
                        {notif.title}
                      </div>
                      <div style={{ fontSize: 11, color: COLORS.textSecondary }}>{notif.message}</div>
                    </div>
                  );
                },
              },
              {
                key: "created_at",
                label: "Time",
                render: (v: unknown) => <span style={{ fontSize: 12 }}>{formatDateTime(v as string)}</span>,
              },
              {
                key: "read",
                label: "Status",
                render: (v: unknown) =>
                  v ? (
                    <span style={{ color: COLORS.neonGreen, fontSize: 11, fontWeight: 600 }}>✓ Read</span>
                  ) : (
                    <span
                      style={{
                        padding: "4px 10px",
                        borderRadius: 6,
                        background: "rgba(255,45,146,0.2)",
                        color: COLORS.neonPink,
                        fontSize: 10,
                        fontWeight: 700,
                      }}
                    >
                      UNREAD
                    </span>
                  ),
              },
              {
                key: "actions",
                label: "",
                align: "right" as const,
                render: (_v: unknown, row: unknown) => {
                  const notif = row as Notification;
                  return (
                    <div style={{ display: "flex", gap: 8 }}>
                      {!notif.read && (
                        <button
                          onClick={() => markAsRead(notif.id)}
                          style={{
                            padding: "6px 12px",
                            background: COLORS.darkBg,
                            border: "1px solid " + COLORS.cardBorder,
                            borderRadius: 6,
                            color: COLORS.textSecondary,
                            cursor: "pointer",
                            fontSize: 10,
                            fontWeight: 600,
                          }}
                        >
                          Mark Read
                        </button>
                      )}
                      <button
                        onClick={() => goTo(notif.link)}
                        style={{
                          padding: "6px 12px",
                          background: COLORS.gradient1,
                          border: "none",
                          borderRadius: 6,
                          color: "#fff",
                          cursor: "pointer",
                          fontSize: 10,
                          fontWeight: 600,
                        }}
                      >
                        Go →
                      </button>
                    </div>
                  );
                },
              },
            ]}
            data={[...notifications].sort((a, b) => {
              const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
              if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                return priorityOrder[a.priority] - priorityOrder[b.priority];
              }
              return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            })}
          />
        )}
      </Card>
    </div>
  );
}