"use client";

import React, { useEffect, useState, useCallback } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import {
  COLORS,
  Card,
  StatCard,
  SectionTitle,
  Badge,
  DataTable,
  formatMoney,
} from "@/components/admin/components";
import { logAudit, AUDIT_TABS } from "@/lib/auditLog";
import { calculateBracketPayout, formatRateCents, type InfluencerRateTier } from "@/lib/influencerPayoutEngine";

/* ==================== TYPES ==================== */

interface Referral {
  id: string;
  referrer_id: string | null;
  referrer_business_id: string | null;
  referred_business_id: string | null;
  referred_user_id: string | null;
  source: string;
  referral_code: string | null;
  status: string;
  converted_at: string | null;
  reward_cents: number;
  reward_paid: boolean;
  paid_at: string | null;
  created_at: string;
  // Enriched
  referrer_name: string | null;
  referrer_type: string | null;
  referred_name: string | null;
}

interface ReferralCode {
  id: string;
  code: string;
  type: string;
  owner_name: string | null;
  owner_id: string | null;
  bonus_cents: number;
  uses: number;
  max_uses: number | null;
  active: boolean;
  expires_at: string | null;
  created_at: string;
}

interface BonusConfig {
  id: string;
  type: string;
  amount_cents: number;
  label: string;
  description: string;
}

interface TopReferrer {
  id: string;
  name: string;
  type: string;
  referrals: number;
  converted: number;
  conversionRate: number;
  bonusEarned: number;
  active: boolean;
}

interface Influencer {
  id: string;
  name: string;
  code: string;
  email: string | null;
  phone: string | null;
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  address_country: string | null;
  instagram_handle: string | null;
  tiktok_handle: string | null;
  youtube_handle: string | null;
  twitter_handle: string | null;
  payment_method: string | null;
  payment_details: string | null;
  tax_id: string | null;
  rate_per_thousand_cents: number;
  total_signups: number;
  total_paid_cents: number;
  total_clicks: number;
  tier: string;
  user_id: string | null;
  ftc_agreed: boolean;
  ftc_agreed_at: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface InfluencerPayout {
  id: string;
  influencer_id: string;
  signups_count: number;
  amount_cents: number;
  rate_per_thousand_cents: number;
  period_start: string;
  period_end: string;
  paid: boolean;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
}

interface InfluencerBonus {
  id: string;
  influencer_id: string;
  label: string;
  amount_cents: number;
  bonus_type: string;
  milestone_signups: number | null;
  paid: boolean;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
}

interface InfluencerSignup {
  id: string;
  influencer_id: string;
  user_id: string;
  created_at: string;
  // Joined from profiles
  user_name: string | null;
  user_email: string | null;
}

interface InfluencerContract {
  id: string;
  influencer_id: string;
  label: string;
  storage_path: string | null;
  file_name: string | null;
  contract_start: string | null;
  contract_end: string | null;
  status: string;
  signed_by_influencer: boolean;
  signed_at: string | null;
  notes: string | null;
  created_at: string;
}

const TIER_CONFIG = {
  seed:     { label: "Seed",     min: 0,       color: "#6b7280", gradient: "linear-gradient(135deg,#6b7280,#374151)", icon: "🌱" },
  sprout:   { label: "Sprout",   min: 250,     color: "#4ade80", gradient: "linear-gradient(135deg,#4ade80,#16a34a)", icon: "🌿" },
  bronze:   { label: "Bronze",   min: 1000,    color: "#cd7f32", gradient: "linear-gradient(135deg,#cd7f32,#8b4513)", icon: "🥉" },
  silver:   { label: "Silver",   min: 2500,    color: "#c0c0c0", gradient: "linear-gradient(135deg,#c0c0c0,#808080)", icon: "🥈" },
  gold:     { label: "Gold",     min: 5000,    color: "#ffd700", gradient: "linear-gradient(135deg,#ffd700,#ff9500)", icon: "🥇" },
  platinum: { label: "Platinum", min: 10000,   color: "#00d4ff", gradient: "linear-gradient(135deg,#00d4ff,#bf5fff)", icon: "💎" },
  sapphire: { label: "Sapphire", min: 20000,   color: "#0099ff", gradient: "linear-gradient(135deg,#0099ff,#00d4ff)", icon: "💙" },
  emerald:  { label: "Emerald",  min: 35000,   color: "#39ff14", gradient: "linear-gradient(135deg,#39ff14,#00c896)", icon: "💚" },
  ruby:     { label: "Ruby",     min: 50000,   color: "#ff3131", gradient: "linear-gradient(135deg,#ff3131,#ff6b35)", icon: "❤️‍🔥" },
  amethyst: { label: "Amethyst", min: 75000,   color: "#bf5fff", gradient: "linear-gradient(135deg,#bf5fff,#ff2d92)", icon: "💜" },
  diamond:  { label: "Diamond",  min: 100000,  color: "#b0e8ff", gradient: "linear-gradient(135deg,#b0e8ff,#00d4ff)", icon: "💠" },
  obsidian: { label: "Obsidian", min: 150000,  color: "#9966cc", gradient: "linear-gradient(135deg,#9966cc,#4b0082)", icon: "🔮" },
  elite:    { label: "Elite",    min: 250000,  color: "#ff2d92", gradient: "linear-gradient(135deg,#ff2d92,#bf5fff)", icon: "🏆" },
  legend:   { label: "Legend",   min: 350000,  color: "#ff6b35", gradient: "linear-gradient(135deg,#ff6b35,#ffff00)", icon: "👑" },
  icon:     { label: "Icon",     min: 500000,  color: "#ffffff", gradient: "linear-gradient(135deg,#ffffff,#00d4ff)", icon: "⚡" },
} as const;

type TierKey = keyof typeof TIER_CONFIG;

function getInfluencerTier(signups: number): TierKey {
  if (signups >= 500000) return "icon";
  if (signups >= 350000) return "legend";
  if (signups >= 250000) return "elite";
  if (signups >= 150000) return "obsidian";
  if (signups >= 100000) return "diamond";
  if (signups >= 75000)  return "amethyst";
  if (signups >= 50000)  return "ruby";
  if (signups >= 35000)  return "emerald";
  if (signups >= 20000)  return "sapphire";
  if (signups >= 10000)  return "platinum";
  if (signups >= 5000)   return "gold";
  if (signups >= 2500)   return "silver";
  if (signups >= 1000)   return "bronze";
  if (signups >= 250)    return "sprout";
  return "seed";
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/* ==================== HELPERS ==================== */

function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`).join(",")),
  ].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const PIE_COLORS = [COLORS.neonGreen, COLORS.neonPink, COLORS.neonBlue, COLORS.neonYellow, COLORS.neonPurple, COLORS.neonOrange];

/* ==================== SUB COMPONENTS ==================== */

function Avatar({ name, color }: { name: string; color?: string }) {
  const initials = (name || "??")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const bg = color || PIE_COLORS[name.length % PIE_COLORS.length];
  return (
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: "50%",
        background: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: 13,
        color: "#000",
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

function HorizontalBar({ label, value, max, color }: { label: string; value: number; max: number; color?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
      <div style={{ width: 80, fontSize: 11, color: COLORS.textSecondary, textAlign: "right", flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, height: 20, background: COLORS.darkBg, borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color || COLORS.neonPink, borderRadius: 4, transition: "width 0.5s" }} />
      </div>
      <div style={{ width: 30, fontSize: 11, fontWeight: 600, textAlign: "right" }}>{value}</div>
    </div>
  );
}

function PieChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary }}>No data</div>;

  let cumulative = 0;
  const segments = data.map((d) => {
    const start = cumulative;
    const pct = (d.value / total) * 100;
    cumulative += pct;
    return { ...d, start, pct };
  });

  // Build conic gradient
  const gradientStops = segments
    .map((s) => `${s.color} ${s.start}% ${s.start + s.pct}%`)
    .join(", ");

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
      <div
        style={{
          width: 160,
          height: 160,
          borderRadius: "50%",
          background: `conic-gradient(${gradientStops})`,
          flexShrink: 0,
        }}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {segments.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <span style={{ color: s.color, fontWeight: 600 }}>{s.label} {Math.round(s.pct)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarLineChart({ data }: { data: { month: string; referrals: number; converted: number; bonusPaid: number }[] }) {
  const maxBar = Math.max(...data.map((d) => Math.max(d.referrals, d.converted)), 1);
  const maxLine = Math.max(...data.map((d) => d.bonusPaid), 1);
  const chartH = 200;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: chartH, padding: "0 10px" }}>
        {data.map((d, i) => {
          const refH = (d.referrals / maxBar) * (chartH - 30);
          const convH = (d.converted / maxBar) * (chartH - 30);
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: chartH - 30, width: "100%" }}>
                <div style={{ flex: 1, height: refH, background: COLORS.neonBlue, borderRadius: "4px 4px 0 0", opacity: 0.7 }} />
                <div style={{ flex: 1, height: convH, background: COLORS.neonGreen, borderRadius: "4px 4px 0 0" }} />
              </div>
              <div style={{ fontSize: 10, color: COLORS.textSecondary, marginTop: 4 }}>{d.month}</div>
            </div>
          );
        })}
      </div>
      {/* Line overlay for bonus paid */}
      <div style={{ position: "relative", height: 4, marginTop: -chartH - 10, marginBottom: chartH + 10 }}>
        <svg width="100%" height={chartH} style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}>
          <polyline
            fill="none"
            stroke={COLORS.neonPink}
            strokeWidth="2"
            points={data
              .map((d, i) => {
                const x = ((i + 0.5) / data.length) * 100;
                const y = 100 - (d.bonusPaid / maxLine) * 85;
                return `${x}%,${y}%`;
              })
              .join(" ")}
          />
          {data.map((d, i) => {
            const x = ((i + 0.5) / data.length) * 100;
            const y = 100 - (d.bonusPaid / maxLine) * 85;
            return <circle key={i} cx={`${x}%`} cy={`${y}%`} r="4" fill={COLORS.neonPink} />;
          })}
        </svg>
      </div>
      {/* Legend */}
      <div style={{ display: "flex", gap: 20, justifyContent: "center", marginTop: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
          <div style={{ width: 14, height: 10, background: COLORS.neonBlue, borderRadius: 2, opacity: 0.7 }} /> Referrals
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
          <div style={{ width: 14, height: 10, background: COLORS.neonGreen, borderRadius: 2 }} /> Converted
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
          <div style={{ width: 14, height: 14, borderRadius: "50%", background: COLORS.neonPink }} /> Bonus Paid ($)
        </div>
      </div>
    </div>
  );
}

/* ==================== MAIN PAGE ==================== */

export default function ReferralsPage() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [referralCodes, setReferralCodes] = useState<ReferralCode[]>([]);
  const [bonusConfig, setBonusConfig] = useState<BonusConfig[]>([
    { id: "user", type: "user", amount_cents: 5000, label: "User Referral", description: "When a referred user makes their first visit" },
    { id: "business", type: "business", amount_cents: 20000, label: "Business Referral", description: "When a referred business signs up & activates" },
  ]);
  const [loading, setLoading] = useState(true);
  const [editingBonuses, setEditingBonuses] = useState(false);
  const [editBonusValues, setEditBonusValues] = useState<Record<string, number>>({});
  const [showCreateCode, setShowCreateCode] = useState(false);
  const [newCode, setNewCode] = useState({ code: "", type: "business", owner_name: "", bonus_cents: 20000, max_uses: 0 });
  const [showCreateBonus, setShowCreateBonus] = useState(false);
  const [newBonus, setNewBonus] = useState({ label: "", type: "user", amount_cents: 10000, description: "", expires_at: "" });

  // Tab state
  const [activeTab, setActiveTab] = useState<"influencers" | "referrals">("influencers");

  // Referrals date range filter
  const [referralDateRange, setReferralDateRange] = useState("30");

  // Influencers date range filter
  const [influencerDateRange, setInfluencerDateRange] = useState("30");

  // Influencer state
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [influencerPayouts, setInfluencerPayouts] = useState<InfluencerPayout[]>([]);
  const [showCreateInfluencer, setShowCreateInfluencer] = useState(false);
  const [showEditTiers, setShowEditTiers] = useState(false);
  const [showEditInfluencer, setShowEditInfluencer] = useState(false);
  const [selectedInfluencer, setSelectedInfluencer] = useState<Influencer | null>(null);
  const [originalInfluencer, setOriginalInfluencer] = useState<Influencer | null>(null);
  const [newInfluencer, setNewInfluencer] = useState({
    name: "", code: "", email: "", phone: "",
    address_street: "", address_city: "", address_state: "", address_zip: "", address_country: "USA",
    instagram_handle: "", tiktok_handle: "", youtube_handle: "", twitter_handle: "",
    payment_method: "bank_transfer", payment_details: "", tax_id: "",
    rate_per_thousand_cents: 5000, ftc_agreed: false
  });
  // Tier editing state
  const [editTiers, setEditTiers] = useState<InfluencerRateTier[]>([]);
  const [editTiersReason, setEditTiersReason] = useState("");
  // Cache of all influencer tiers (keyed by influencer_id)
  const [influencerTiersMap, setInfluencerTiersMap] = useState<Record<string, InfluencerRateTier[]>>({});
  // Default tiers from platform_settings
  const [defaultInfluencerTiers, setDefaultInfluencerTiers] = useState<InfluencerRateTier[]>([]);

  // Analytics drawer
  const [analyticsInfluencer, setAnalyticsInfluencer] = useState<Influencer | null>(null);
  const [analyticsSignups, setAnalyticsSignups] = useState<InfluencerSignup[]>([]);
  const [analyticsSignupsLoading, setAnalyticsSignupsLoading] = useState(false);

  // Bulk actions
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [showBulkTierResetModal, setShowBulkTierResetModal] = useState(false);
  const [bulkTierResetReason, setBulkTierResetReason] = useState("");

  // Advanced filtering
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterTier, setFilterTier] = useState("all");
  const [filterPayment, setFilterPayment] = useState("all");
  const [filterPlatform, setFilterPlatform] = useState("all");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterOutstanding, setFilterOutstanding] = useState("all");
  const [filterBonus, setFilterBonus] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  // Manual signup attribution modal
  const [showAttributionModal, setShowAttributionModal] = useState(false);
  const [attributionInfluencerId, setAttributionInfluencerId] = useState<string>("");
  const [attributionSearch, setAttributionSearch] = useState("");
  const [attributionResults, setAttributionResults] = useState<{ id: string; name: string; email: string }[]>([]);
  const [attributionSearching, setAttributionSearching] = useState(false);

  // Bonuses
  const [influencerBonuses, setInfluencerBonuses] = useState<InfluencerBonus[]>([]);
  const [showCreateInfluencerBonus, setShowCreateInfluencerBonus] = useState(false);
  const [bonusTargetId, setBonusTargetId] = useState<string>("");
  const [newInfluencerBonus, setNewInfluencerBonus] = useState({ label: "", amount_cents: 10000, bonus_type: "milestone", milestone_signups: 0, notes: "" });

  // Contracts
  const [influencerContracts, setInfluencerContracts] = useState<InfluencerContract[]>([]);
  const [showCreateContract, setShowCreateContract] = useState(false);
  const [contractTargetId, setContractTargetId] = useState<string>("");
  const [newContract, setNewContract] = useState({ label: "", contract_start: "", contract_end: "", notes: "" });
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [contractUploading, setContractUploading] = useState(false);

  /* ==================== DATA FETCHING ==================== */

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch referrals
      const { data: refData } = await supabaseBrowser
        .from("referrals")
        .select("*")
        .order("created_at", { ascending: false });

      // Fetch businesses for names and referral sources
      const { data: bizData } = await supabaseBrowser
        .from("business")
        .select("id, business_name, public_business_name, referral_source, contact_email");
      const bizMap = new Map<string, { name: string; source: string | null }>();
      (bizData || []).forEach((b: Record<string, unknown>) => {
        bizMap.set(b.id as string, {
          name: (b.public_business_name || b.business_name || "Unknown") as string,
          source: b.referral_source as string | null,
        });
      });

      // Fetch profiles for referrer names
      const { data: profileData } = await supabaseBrowser
        .from("profiles")
        .select("id, full_name, first_name, last_name, email");
      const profileMap = new Map<string, string>();
      (profileData || []).forEach((p: Record<string, unknown>) => {
        const name = (p.full_name as string) || [p.first_name, p.last_name].filter(Boolean).join(" ") || (p.email as string) || "Unknown";
        profileMap.set(p.id as string, name);
      });

      // Enrich referrals
      const enriched: Referral[] = (refData || []).map((r: Record<string, unknown>) => {
        const referrerBiz = r.referrer_business_id ? bizMap.get(r.referrer_business_id as string) : null;
        const referrerProfile = r.referrer_id ? profileMap.get(r.referrer_id as string) : null;
        const referredBiz = r.referred_business_id ? bizMap.get(r.referred_business_id as string) : null;
        const referredProfile = r.referred_user_id ? profileMap.get(r.referred_user_id as string) : null;

        let referrerType = "user";
        let referrerName = referrerProfile || null;
        if (referrerBiz) {
          referrerType = "business";
          referrerName = referrerBiz.name;
        }

        return {
          ...r,
          referrer_name: referrerName || (r.referrer_type as string) || null,
          referrer_type: (r.referrer_type as string) || referrerType,
          referred_name: referredBiz?.name || referredProfile || null,
        } as Referral;
      });

      setReferrals(enriched);

      // Fetch referral codes
      const { data: codeData } = await supabaseBrowser
        .from("referral_codes")
        .select("*")
        .order("created_at", { ascending: false });
      if (codeData) setReferralCodes(codeData as ReferralCode[]);

      // Fetch bonus config
      const { data: configData } = await supabaseBrowser
        .from("referral_bonus_config")
        .select("*")
        .order("type");
      if (configData && configData.length > 0) setBonusConfig((configData as BonusConfig[]).filter((c) => c.type !== "sales_rep"));

      // Fetch influencers
      const { data: influencerData } = await supabaseBrowser
        .from("influencers")
        .select("*")
        .order("total_signups", { ascending: false });
      if (influencerData) setInfluencers(influencerData as Influencer[]);

      // Fetch influencer payouts
      const { data: payoutData } = await supabaseBrowser
        .from("influencer_payouts")
        .select("*")
        .order("created_at", { ascending: false });
      if (payoutData) setInfluencerPayouts(payoutData as InfluencerPayout[]);

      // Fetch influencer bonuses
      const { data: bonusData } = await supabaseBrowser
        .from("influencer_bonuses")
        .select("*")
        .order("created_at", { ascending: false });
      if (bonusData) setInfluencerBonuses(bonusData as InfluencerBonus[]);

      // Fetch influencer contracts
      const { data: contractData } = await supabaseBrowser
        .from("influencer_contracts")
        .select("*")
        .order("created_at", { ascending: false });
      if (contractData) setInfluencerContracts(contractData as InfluencerContract[]);

      // Fetch all influencer rate tiers
      const { data: tierData } = await supabaseBrowser
        .from("influencer_rate_tiers")
        .select("influencer_id, tier_index, min_signups, max_signups, rate_cents, label")
        .order("tier_index", { ascending: true });
      if (tierData) {
        const tiersMap: Record<string, InfluencerRateTier[]> = {};
        for (const t of tierData) {
          const infId = t.influencer_id as string;
          if (!tiersMap[infId]) tiersMap[infId] = [];
          tiersMap[infId].push(t as InfluencerRateTier);
        }
        setInfluencerTiersMap(tiersMap);
      }

      // Fetch default influencer tiers from platform_settings
      const { data: settingsData } = await supabaseBrowser
        .from("platform_settings")
        .select("default_influencer_tiers")
        .eq("id", 1)
        .maybeSingle();
      if (settingsData?.default_influencer_tiers) {
        setDefaultInfluencerTiers(settingsData.default_influencer_tiers as InfluencerRateTier[]);
      }
    } catch (err) {
      console.error("Error fetching referral data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ==================== STATS ==================== */

  // Date-range filtered referrals — drives all stats, charts, and tables in the Referrals tab
  const dateFilteredReferrals = referrals.filter((r) => {
    if (referralDateRange === "all") return true;
    const cutoff = new Date(Date.now() - parseInt(referralDateRange) * 24 * 60 * 60 * 1000);
    return new Date(r.created_at) >= cutoff;
  });

  const totalReferrals = dateFilteredReferrals.length;
  const converted = dateFilteredReferrals.filter((r) => r.status === "converted").length;
  const conversionRate = totalReferrals > 0 ? Math.round((converted / totalReferrals) * 100) : 0;
  const bonusesPaid = dateFilteredReferrals.filter((r) => r.reward_paid).reduce((s, r) => s + (r.reward_cents || 0), 0);
  const businessesReferred = new Set(dateFilteredReferrals.filter((r) => r.referred_business_id).map((r) => r.referred_business_id)).size;

  /* ==================== COMPUTED: REFERRAL SOURCES ==================== */

  const sourceCategories = ["Word of Mouth", "Google Ads", "Social Media", "Partner Referral", "Trade Shows", "Direct/Organic"];
  const sourceMap: Record<string, string> = {
    direct: "Direct/Organic", link: "Social Media", code: "Partner Referral",
    partner: "Partner Referral", other: "Word of Mouth",
    word_of_mouth: "Word of Mouth", google_ads: "Google Ads", social_media: "Social Media",
    trade_shows: "Trade Shows",
  };

  const sourceCounts: Record<string, number> = {};
  sourceCategories.forEach((s) => (sourceCounts[s] = 0));
  dateFilteredReferrals.forEach((r) => {
    const cat = sourceMap[r.source] || "Direct/Organic";
    sourceCounts[cat] = (sourceCounts[cat] || 0) + 1;
  });
  const maxSourceCount = Math.max(...Object.values(sourceCounts), 1);

  // Revenue by source (based on reward_cents for converted referrals)
  const sourceRevenue: Record<string, number> = {};
  sourceCategories.forEach((s) => (sourceRevenue[s] = 0));
  dateFilteredReferrals
    .filter((r) => r.status === "converted")
    .forEach((r) => {
      const cat = sourceMap[r.source] || "Direct/Organic";
      sourceRevenue[cat] = (sourceRevenue[cat] || 0) + (r.reward_cents || 0);
    });

  /* ==================== COMPUTED: TOP REFERRERS ==================== */

  const referrerMap = new Map<string, TopReferrer>();
  dateFilteredReferrals.forEach((r) => {
    const key = r.referrer_id || r.referrer_business_id || "unknown";
    const existing = referrerMap.get(key);
    if (existing) {
      existing.referrals++;
      if (r.status === "converted") existing.converted++;
      if (r.reward_paid) existing.bonusEarned += r.reward_cents || 0;
    } else {
      referrerMap.set(key, {
        id: key,
        name: r.referrer_name || key.slice(0, 8) + "...",
        type: r.referrer_type || "user",
        referrals: 1,
        converted: r.status === "converted" ? 1 : 0,
        bonusEarned: r.reward_paid ? (r.reward_cents || 0) : 0,
        conversionRate: 0,
        active: true,
      });
    }
  });
  const topReferrers = Array.from(referrerMap.values())
    .map((r) => ({ ...r, conversionRate: r.referrals > 0 ? Math.round((r.converted / r.referrals) * 100) : 0 }))
    .sort((a, b) => b.referrals - a.referrals)
    .slice(0, 20);

  /* ==================== COMPUTED: MONTHLY TREND ==================== */

  // Number of months to show in the trend chart — expand when viewing longer ranges
  const trendMonths = referralDateRange === "all" || parseInt(referralDateRange) >= 365 ? 12
    : parseInt(referralDateRange) >= 180 ? 6 : 3;

  const monthlyData: { month: string; referrals: number; converted: number; bonusPaid: number }[] = [];
  const now = new Date();
  for (let i = trendMonths - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("en-US", { month: "short" });
    const monthRefs = dateFilteredReferrals.filter((r) => r.created_at.startsWith(key));
    monthlyData.push({
      month: label,
      referrals: monthRefs.length,
      converted: monthRefs.filter((r) => r.status === "converted").length,
      bonusPaid: monthRefs.filter((r) => r.reward_paid).reduce((s, r) => s + (r.reward_cents || 0), 0),
    });
  }

  /* ==================== COMPUTED: INFLUENCER STATS ==================== */

  // Date-range filtered influencer data
  const infCutoff = influencerDateRange === "all"
    ? null
    : new Date(Date.now() - parseInt(influencerDateRange) * 24 * 60 * 60 * 1000);

  const newInfluencers = infCutoff
    ? influencers.filter((i) => new Date(i.created_at) >= infCutoff)
    : influencers;

  const dateFilteredInfluencerPayouts = infCutoff
    ? influencerPayouts.filter((p) => new Date(p.created_at) >= infCutoff)
    : influencerPayouts;

  const dateFilteredInfluencerBonuses = infCutoff
    ? influencerBonuses.filter((b) => new Date(b.created_at) >= infCutoff)
    : influencerBonuses;

  const totalInfluencers = influencers.length;
  const activeInfluencers = influencers.filter((i) => i.status === "active").length;
  const totalInfluencerSignups = influencers.reduce((sum, i) => sum + i.total_signups, 0);
  // Paid out within the selected period (payouts marked paid in the range)
  const periodPaidAmount = dateFilteredInfluencerPayouts
    .filter((p) => p.paid)
    .reduce((sum, p) => sum + p.amount_cents, 0)
    + dateFilteredInfluencerBonuses
    .filter((b) => b.paid)
    .reduce((sum, b) => sum + b.amount_cents, 0);
  // Pending is always all-outstanding regardless of date
  const pendingPayouts = influencerPayouts.filter((p) => !p.paid);
  const pendingPayoutAmount = pendingPayouts.reduce((sum, p) => sum + p.amount_cents, 0);

  // Top 10 influencers by signups
  const topInfluencers = [...influencers]
    .sort((a, b) => b.total_signups - a.total_signups)
    .slice(0, 10);
  const maxInfluencerSignups = Math.max(...topInfluencers.map((i) => i.total_signups), 1);

  // Filtered influencers
  const filteredInfluencers = influencers.filter((inf) => {
    if (filterStatus !== "all" && inf.status !== filterStatus) return false;
    if (filterTier !== "all" && getInfluencerTier(inf.total_signups) !== filterTier) return false;
    if (filterPayment !== "all" && inf.payment_method !== filterPayment) return false;
    if (filterPlatform === "instagram" && !inf.instagram_handle) return false;
    if (filterPlatform === "tiktok" && !inf.tiktok_handle) return false;
    if (filterPlatform === "youtube" && !inf.youtube_handle) return false;
    if (filterPlatform === "twitter" && !inf.twitter_handle) return false;
    if (filterSearch) {
      const q = filterSearch.toLowerCase();
      if (!inf.name.toLowerCase().includes(q) && !inf.code.toLowerCase().includes(q) && !(inf.email || "").toLowerCase().includes(q)) return false;
    }
    if (filterOutstanding !== "all") {
      const unpaidPayoutValue = calcUnpaidPayoutValue(inf);
      const unpaidBonusTotal = influencerBonuses.filter(b => b.influencer_id === inf.id && !b.paid).reduce((s, b) => s + b.amount_cents, 0);
      const totalOwed = unpaidPayoutValue + unpaidBonusTotal;
      if (filterOutstanding === "has_outstanding" && totalOwed === 0) return false;
      if (filterOutstanding === "paid_up" && totalOwed > 0) return false;
    }
    if (filterBonus !== "all") {
      const bonuses = influencerBonuses.filter(b => b.influencer_id === inf.id);
      if (filterBonus === "has_unpaid" && !bonuses.some(b => !b.paid)) return false;
      if (filterBonus === "no_unpaid" && bonuses.some(b => !b.paid)) return false;
    }
    return true;
  });
  const activeFiltersCount = [
    filterStatus !== "all", filterTier !== "all", filterPayment !== "all",
    filterPlatform !== "all", !!filterSearch, filterOutstanding !== "all", filterBonus !== "all",
  ].filter(Boolean).length;

  // Tier breakdown counts
  const tierCounts = { seed: 0, sprout: 0, bronze: 0, silver: 0, gold: 0, platinum: 0, sapphire: 0, emerald: 0, ruby: 0, amethyst: 0, diamond: 0, obsidian: 0, elite: 0, legend: 0, icon: 0 };
  influencers.forEach((i) => { tierCounts[getInfluencerTier(i.total_signups)]++; });

  // Conversion rate (clicks → signups) per influencer
  function getClickConversionRate(inf: Influencer): string {
    if (!inf.total_clicks || inf.total_clicks === 0) return "—";
    return ((inf.total_signups / inf.total_clicks) * 100).toFixed(1) + "%";
  }

  // Calculate unpaid payout value using bracket tiers
  function calcUnpaidPayoutValue(inf: Influencer): number {
    const paidSignups = influencerPayouts.filter(p => p.influencer_id === inf.id && p.paid).reduce((s, p) => s + p.signups_count, 0);
    const unpaidSignups = inf.total_signups - paidSignups;
    if (unpaidSignups <= 0) return 0;
    const tiers = influencerTiersMap[inf.id];
    if (tiers && tiers.length > 0) {
      const { totalCents } = calculateBracketPayout(tiers, paidSignups, unpaidSignups);
      return totalCents;
    }
    // Legacy fallback
    return Math.floor(unpaidSignups * inf.rate_per_thousand_cents / 1000);
  }

  // Get tier rate range for display (e.g., "$15.00 – $30.00")
  function getTierRangeDisplay(infId: string): { minRate: number; maxRate: number; count: number } | null {
    const tiers = influencerTiersMap[infId];
    if (!tiers || tiers.length === 0) return null;
    const rates = tiers.map(t => t.rate_cents);
    return { minRate: Math.min(...rates), maxRate: Math.max(...rates), count: tiers.length };
  }

  /* ==================== ACTIONS ==================== */

  async function handlePayBonus(referrerId: string) {
    const unpaid = referrals.filter((r) => {
      const key = r.referrer_id || r.referrer_business_id;
      return key === referrerId && r.status === "converted" && !r.reward_paid;
    });
    if (unpaid.length === 0) { alert("No unpaid bonuses for this referrer."); return; }
    for (const r of unpaid) {
      await supabaseBrowser.from("referrals").update({ reward_paid: true, paid_at: new Date().toISOString() }).eq("id", r.id);
    }
    const total = unpaid.reduce((s, r) => s + (r.reward_cents || 0), 0);
    logAudit({
      action: "pay_referral_bonus",
      tab: AUDIT_TABS.REFERRALS,
      subTab: "Referral Codes",
      targetType: "referral",
      targetId: referrerId,
      fieldName: "reward_paid",
      oldValue: "false",
      newValue: "true",
      details: `Paid ${formatMoney(total)} bonus across ${unpaid.length} referral(s)`,
    });
    alert(`✅ Paid ${formatMoney(total)} bonus to ${unpaid.length} referral(s).`);
    await fetchData();
  }

  async function handleSaveBonusConfig() {
    for (const bc of bonusConfig) {
      const newAmount = editBonusValues[bc.id] !== undefined ? editBonusValues[bc.id] : bc.amount_cents;
      await supabaseBrowser.from("referral_bonus_config").upsert({ id: bc.id, type: bc.type, amount_cents: newAmount, label: bc.label, description: bc.description });
    }
    const originalSummary = bonusConfig
      .map((bc) => `${bc.label}: ${formatMoney(bc.amount_cents)}`)
      .join(", ");
    const changedSummary = bonusConfig
      .map((bc) => {
        const newAmount = editBonusValues[bc.id] !== undefined ? editBonusValues[bc.id] : bc.amount_cents;
        return `${bc.label}: ${formatMoney(newAmount)}`;
      })
      .join(", ");
    logAudit({
      action: "update_referral_bonus_config",
      tab: AUDIT_TABS.REFERRALS,
      subTab: "Referral Codes",
      targetType: "referral",
      fieldName: "amount_cents",
      oldValue: originalSummary,
      newValue: changedSummary,
      details: `Updated bonus config: ${changedSummary}`,
    });
    setEditingBonuses(false);
    setEditBonusValues({});
    await fetchData();
    alert("✅ Bonus amounts saved!");
  }

  async function handleCreateCode() {
    if (!newCode.code.trim()) { alert("Please enter a referral code."); return; }
    const { error } = await supabaseBrowser.from("referral_codes").insert({
      code: newCode.code.toUpperCase().replace(/\s/g, ""),
      type: newCode.type,
      owner_name: newCode.owner_name || null,
      bonus_cents: newCode.bonus_cents,
      max_uses: newCode.max_uses > 0 ? newCode.max_uses : null,
      uses: 0,
      active: true,
    });
    if (error) { alert("Error creating code: " + error.message); return; }
    logAudit({
      action: "create_referral_code",
      tab: AUDIT_TABS.REFERRALS,
      subTab: "Referral Codes",
      targetType: "referral",
      entityName: newCode.code.toUpperCase(),
      details: `Created referral code "${newCode.code.toUpperCase()}" (type: ${newCode.type}, bonus: ${formatMoney(newCode.bonus_cents)}, owner: ${newCode.owner_name || "none"})`,
    });
    alert(`✅ Referral code "${newCode.code.toUpperCase()}" created!`);
    setShowCreateCode(false);
    setNewCode({ code: "", type: "business", owner_name: "", bonus_cents: 20000, max_uses: 0 });
    await fetchData();
  }

  async function handleToggleCode(id: string, currentActive: boolean) {
    await supabaseBrowser.from("referral_codes").update({ active: !currentActive }).eq("id", id);
    const code = referralCodes.find((c) => c.id === id);
    logAudit({
      action: "toggle_referral_code",
      tab: AUDIT_TABS.REFERRALS,
      subTab: "Referral Codes",
      targetType: "referral",
      targetId: id,
      entityName: code?.code || id,
      fieldName: "active",
      oldValue: String(currentActive),
      newValue: String(!currentActive),
      details: `Referral code ${currentActive ? "deactivated" : "activated"}`,
    });
    await fetchData();
  }

  async function handleCreateLimitedBonus() {
    if (!newBonus.label.trim()) { alert("Please enter a bonus name."); return; }
    const id = "promo_" + Date.now();
    const { error } = await supabaseBrowser.from("referral_bonus_config").insert({
      id,
      type: newBonus.type,
      amount_cents: newBonus.amount_cents,
      label: newBonus.label,
      description: newBonus.description + (newBonus.expires_at ? ` (Expires ${newBonus.expires_at})` : " (Limited Time)"),
    });
    if (error) { alert("Error creating bonus: " + error.message); return; }
    logAudit({
      action: "create_limited_bonus",
      tab: AUDIT_TABS.REFERRALS,
      subTab: "Referral Codes",
      targetType: "referral",
      targetId: id,
      entityName: newBonus.label,
      details: `Created limited-time bonus "${newBonus.label}" (type: ${newBonus.type}, amount: ${formatMoney(newBonus.amount_cents)}${newBonus.expires_at ? `, expires: ${newBonus.expires_at}` : ""})`,
    });
    alert(`✅ Limited-time bonus "${newBonus.label}" created!`);
    setShowCreateBonus(false);
    setNewBonus({ label: "", type: "user", amount_cents: 10000, description: "", expires_at: "" });
    await fetchData();
  }

  /* ==================== INFLUENCER ACTIONS ==================== */

  async function handleCreateInfluencer() {
    if (!newInfluencer.name.trim()) { alert("Please enter influencer name."); return; }
    if (!newInfluencer.code.trim()) { alert("Please enter influencer code."); return; }
    const { error } = await supabaseBrowser.from("influencers").insert({
      name: newInfluencer.name,
      code: newInfluencer.code.toUpperCase().replace(/\s/g, ""),
      email: newInfluencer.email || null,
      phone: newInfluencer.phone || null,
      address_street: newInfluencer.address_street || null,
      address_city: newInfluencer.address_city || null,
      address_state: newInfluencer.address_state || null,
      address_zip: newInfluencer.address_zip || null,
      address_country: newInfluencer.address_country || "USA",
      instagram_handle: newInfluencer.instagram_handle || null,
      tiktok_handle: newInfluencer.tiktok_handle || null,
      youtube_handle: newInfluencer.youtube_handle || null,
      twitter_handle: newInfluencer.twitter_handle || null,
      payment_method: newInfluencer.payment_method || null,
      payment_details: newInfluencer.payment_details || null,
      tax_id: newInfluencer.tax_id || null,
      rate_per_thousand_cents: newInfluencer.rate_per_thousand_cents,
      ftc_agreed: newInfluencer.ftc_agreed,
      ftc_agreed_at: newInfluencer.ftc_agreed ? new Date().toISOString() : null,
      status: "active",
      notes: `Created on ${new Date().toLocaleDateString()} with rate $${(newInfluencer.rate_per_thousand_cents / 100).toFixed(2)} per 1,000 signups`,
    });
    if (error) { alert("Error creating influencer: " + error.message); return; }

    // Insert default rate tiers for the new influencer
    if (defaultInfluencerTiers.length > 0) {
      // Look up the newly created influencer to get its ID
      const { data: newInfData } = await supabaseBrowser.from("influencers").select("id").eq("code", newInfluencer.code.toUpperCase().replace(/\s/g, "")).maybeSingle();
      if (newInfData) {
        const tierRows = defaultInfluencerTiers.map((t, i) => ({
          influencer_id: newInfData.id,
          tier_index: i + 1,
          min_signups: t.min_signups,
          max_signups: t.max_signups,
          rate_cents: t.rate_cents,
          label: t.label || `Tier ${i + 1}`,
        }));
        await supabaseBrowser.from("influencer_rate_tiers").insert(tierRows);
      }
    }

    logAudit({
      action: "create_influencer",
      tab: AUDIT_TABS.REFERRALS,
      subTab: "Influencers",
      targetType: "influencer",
      entityName: newInfluencer.name,
      details: `Created influencer "${newInfluencer.name}" with code ${newInfluencer.code.toUpperCase()}, default tiers applied`,
    });
    alert(`✅ Influencer "${newInfluencer.name}" created with code ${newInfluencer.code.toUpperCase()}!`);
    setShowCreateInfluencer(false);
    setNewInfluencer({
      name: "", code: "", email: "", phone: "",
      address_street: "", address_city: "", address_state: "", address_zip: "", address_country: "USA",
      instagram_handle: "", tiktok_handle: "", youtube_handle: "", twitter_handle: "",
      payment_method: "bank_transfer", payment_details: "", tax_id: "",
      rate_per_thousand_cents: 5000, ftc_agreed: false
    });
    await fetchData();
  }

  async function handleEditInfluencer() {
    if (!selectedInfluencer) return;
    const { error } = await supabaseBrowser
      .from("influencers")
      .update({
        name: selectedInfluencer.name,
        email: selectedInfluencer.email || null,
        phone: selectedInfluencer.phone || null,
        address_street: selectedInfluencer.address_street || null,
        address_city: selectedInfluencer.address_city || null,
        address_state: selectedInfluencer.address_state || null,
        address_zip: selectedInfluencer.address_zip || null,
        address_country: selectedInfluencer.address_country || "USA",
        instagram_handle: selectedInfluencer.instagram_handle || null,
        tiktok_handle: selectedInfluencer.tiktok_handle || null,
        youtube_handle: selectedInfluencer.youtube_handle || null,
        twitter_handle: selectedInfluencer.twitter_handle || null,
        payment_method: selectedInfluencer.payment_method || null,
        payment_details: selectedInfluencer.payment_details || null,
        tax_id: selectedInfluencer.tax_id || null,
        user_id: selectedInfluencer.user_id || null,
        ftc_agreed: selectedInfluencer.ftc_agreed,
        ftc_agreed_at: selectedInfluencer.ftc_agreed
          ? (selectedInfluencer.ftc_agreed_at || new Date().toISOString())
          : null,
      })
      .eq("id", selectedInfluencer.id);

    if (error) { alert("Error updating influencer: " + error.message); return; }
    // Build old/new value summaries from changed fields
    const editableFields: (keyof Influencer)[] = [
      "name", "email", "phone", "address_street", "address_city", "address_state",
      "address_zip", "address_country", "instagram_handle", "tiktok_handle",
      "youtube_handle", "twitter_handle", "payment_method", "payment_details",
      "tax_id", "user_id", "ftc_agreed",
    ];
    const changedFields: string[] = [];
    const oldValues: string[] = [];
    const newValues: string[] = [];
    for (const field of editableFields) {
      const oldVal = String(originalInfluencer?.[field] ?? "");
      const newVal = String(selectedInfluencer[field] ?? "");
      if (oldVal !== newVal) {
        changedFields.push(field);
        oldValues.push(`${field}: ${oldVal || "(empty)"}`);
        newValues.push(`${field}: ${newVal || "(empty)"}`);
      }
    }
    logAudit({
      action: "update_influencer",
      tab: AUDIT_TABS.REFERRALS,
      subTab: "Influencers",
      targetType: "influencer",
      targetId: selectedInfluencer.id,
      entityName: selectedInfluencer.name,
      fieldName: changedFields.join(", ") || "details",
      oldValue: oldValues.join("; ") || "(no changes)",
      newValue: newValues.join("; ") || "(no changes)",
      details: `Updated influencer details for "${selectedInfluencer.name}"${changedFields.length ? `: ${changedFields.join(", ")}` : ""}`,
    });
    alert(`✅ Influencer details updated!`);
    setShowEditInfluencer(false);
    setSelectedInfluencer(null);
    setOriginalInfluencer(null);
    await fetchData();
  }

  async function handleSaveTiers() {
    if (!selectedInfluencer) return;
    if (!editTiersReason.trim()) { alert("Please enter a reason for the tier change."); return; }
    if (editTiers.length === 0) { alert("At least one tier is required."); return; }

    // Validate tiers
    for (let i = 0; i < editTiers.length; i++) {
      if (editTiers[i].rate_cents < 0) { alert(`Tier ${i + 1} rate must be non-negative.`); return; }
      if (editTiers[i].min_signups < 1) { alert(`Tier ${i + 1} min signups must be at least 1.`); return; }
      if (i < editTiers.length - 1 && editTiers[i].max_signups === null) { alert(`Only the last tier can have unlimited max signups.`); return; }
    }

    // Delete existing tiers
    const { error: delErr } = await supabaseBrowser
      .from("influencer_rate_tiers")
      .delete()
      .eq("influencer_id", selectedInfluencer.id);
    if (delErr) { alert("Error clearing old tiers: " + delErr.message); return; }

    // Insert new tiers
    const rows = editTiers.map((t, i) => ({
      influencer_id: selectedInfluencer.id,
      tier_index: i + 1,
      min_signups: t.min_signups,
      max_signups: t.max_signups,
      rate_cents: t.rate_cents,
      label: t.label || `Tier ${i + 1}`,
    }));
    const { error: insErr } = await supabaseBrowser.from("influencer_rate_tiers").insert(rows);
    if (insErr) { alert("Error saving tiers: " + insErr.message); return; }

    // Log note on influencer
    const tierSummary = editTiers.map(t => `${t.min_signups}-${t.max_signups ?? "∞"}: ${formatRateCents(t.rate_cents)}/signup`).join(", ");
    const noteEntry = `\n[${new Date().toLocaleDateString()}] Tiers updated: [${tierSummary}] — Reason: ${editTiersReason}`;
    await supabaseBrowser.from("influencers").update({ notes: (selectedInfluencer.notes || "") + noteEntry }).eq("id", selectedInfluencer.id);

    logAudit({
      action: "update_influencer_tiers",
      tab: AUDIT_TABS.REFERRALS,
      subTab: "Influencers",
      targetType: "influencer",
      targetId: selectedInfluencer.id,
      entityName: selectedInfluencer.name,
      fieldName: "rate_tiers",
      newValue: tierSummary,
      details: `Tiers updated for "${selectedInfluencer.name}": [${tierSummary}] — Reason: ${editTiersReason}`,
    });
    alert(`Tiers updated for ${selectedInfluencer.name}!`);
    setShowEditTiers(false);
    setSelectedInfluencer(null);
    setEditTiers([]);
    setEditTiersReason("");
    await fetchData();
  }

  async function handleToggleInfluencerStatus(id: string, currentStatus: string) {
    const newStatus = currentStatus === "active" ? "paused" : "active";
    await supabaseBrowser.from("influencers").update({ status: newStatus }).eq("id", id);
    const inf = influencers.find((i) => i.id === id);
    logAudit({
      action: "toggle_influencer_status",
      tab: AUDIT_TABS.REFERRALS,
      subTab: "Influencers",
      targetType: "influencer",
      targetId: id,
      entityName: inf?.name || id,
      fieldName: "status",
      oldValue: currentStatus,
      newValue: newStatus,
      details: `Influencer status changed from "${currentStatus}" to "${newStatus}"`,
    });
    await fetchData();
  }

  async function handleGeneratePayout(influencerId: string) {
    const influencer = influencers.find((i) => i.id === influencerId);
    if (!influencer) return;

    // Calculate unpaid signups
    const existingPayouts = influencerPayouts.filter((p) => p.influencer_id === influencerId && p.paid);
    const paidSignups = existingPayouts.reduce((sum, p) => sum + p.signups_count, 0);
    const unpaidSignups = influencer.total_signups - paidSignups;

    if (unpaidSignups < 1) {
      alert(`No unpaid signups for ${influencer.name}.`);
      return;
    }

    const signupsCount = unpaidSignups;
    const tiers = influencerTiersMap[influencerId];
    let amountCents: number;
    let tiersSnapshot: InfluencerRateTier[] | null = null;
    let notesText: string;

    if (tiers && tiers.length > 0) {
      const { totalCents, breakdown } = calculateBracketPayout(tiers, paidSignups, unpaidSignups);
      amountCents = totalCents;
      tiersSnapshot = tiers;
      const breakdownStr = breakdown.map(b => `${b.signupsInTier}×${formatRateCents(b.tier.rate_cents)}`).join(" + ");
      notesText = `Generated payout for ${signupsCount} signups (bracket: ${breakdownStr})`;
    } else {
      // Legacy fallback
      amountCents = Math.floor(unpaidSignups * influencer.rate_per_thousand_cents / 1000);
      notesText = `Generated payout for ${signupsCount} signups at $${(influencer.rate_per_thousand_cents / 100).toFixed(2)} per 1K`;
    }

    const { error } = await supabaseBrowser.from("influencer_payouts").insert({
      influencer_id: influencerId,
      signups_count: signupsCount,
      amount_cents: amountCents,
      rate_per_thousand_cents: influencer.rate_per_thousand_cents,
      rate_tiers_snapshot: tiersSnapshot,
      period_start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      period_end: new Date().toISOString(),
      paid: false,
      notes: notesText,
    });

    if (error) { alert("Error generating payout: " + error.message); return; }
    logAudit({
      action: "generate_influencer_payout",
      tab: AUDIT_TABS.REFERRALS,
      subTab: "Influencer Payouts",
      targetType: "influencer",
      targetId: influencerId,
      entityName: influencer.name,
      details: `Generated payout of ${formatMoney(amountCents)} for ${signupsCount} signups`,
    });
    alert(`Payout of ${formatMoney(amountCents)} generated for ${influencer.name} (${signupsCount} signups)!`);
    await fetchData();
  }

  async function handleMarkPayoutPaid(payoutId: string) {
    const { error } = await supabaseBrowser
      .from("influencer_payouts")
      .update({ paid: true, paid_at: new Date().toISOString() })
      .eq("id", payoutId);

    if (error) { alert("Error marking payout as paid: " + error.message); return; }
    const payout = influencerPayouts.find((p) => p.id === payoutId);
    const inf = payout ? influencers.find((i) => i.id === payout.influencer_id) : null;
    logAudit({
      action: "mark_influencer_payout_paid",
      tab: AUDIT_TABS.REFERRALS,
      subTab: "Influencer Payouts",
      targetType: "influencer",
      targetId: payoutId,
      entityName: inf?.name || payout?.influencer_id || payoutId,
      fieldName: "paid",
      oldValue: "false",
      newValue: "true",
      details: `Marked payout as paid${payout ? ` (${formatMoney(payout.amount_cents)} for ${payout.signups_count} signups)` : ""}`,
    });
    alert("✅ Payout marked as paid!");
    await fetchData();
  }

  /* ==================== BULK ACTIONS ==================== */

  function toggleBulkSelect(id: string) {
    setBulkSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (bulkSelected.size === filteredInfluencers.length) {
      setBulkSelected(new Set());
    } else {
      setBulkSelected(new Set(filteredInfluencers.map((i) => i.id)));
    }
  }

  async function handleBulkStatusToggle(newStatus: "active" | "paused") {
    const previousStatuses = Array.from(bulkSelected).map((id) => {
      const inf = influencers.find((i) => i.id === id);
      return `${inf?.name || id}: ${inf?.status || "unknown"}`;
    });
    for (const id of bulkSelected) {
      await supabaseBrowser.from("influencers").update({ status: newStatus }).eq("id", id);
    }
    const names = Array.from(bulkSelected).map((id) => influencers.find((i) => i.id === id)?.name || id);
    logAudit({
      action: "bulk_toggle_influencer_status",
      tab: AUDIT_TABS.REFERRALS,
      subTab: "Influencers",
      targetType: "influencer",
      fieldName: "status",
      oldValue: previousStatuses.join("; "),
      newValue: newStatus,
      details: `Bulk status change to "${newStatus}" for ${bulkSelected.size} influencer(s): ${names.join(", ")}`,
    });
    alert(`✅ ${bulkSelected.size} influencer(s) set to "${newStatus}"`);
    setBulkSelected(new Set());
    await fetchData();
  }

  async function handleBulkTierReset() {
    if (!bulkTierResetReason.trim()) { alert("Please enter a reason for the tier reset."); return; }
    if (defaultInfluencerTiers.length === 0) { alert("No default tiers configured. Set them in Admin Settings → Influencer Tiers."); return; }

    for (const id of bulkSelected) {
      const inf = influencers.find((i) => i.id === id);
      // Delete existing tiers
      await supabaseBrowser.from("influencer_rate_tiers").delete().eq("influencer_id", id);
      // Insert default tiers
      const rows = defaultInfluencerTiers.map((t, i) => ({
        influencer_id: id,
        tier_index: i + 1,
        min_signups: t.min_signups,
        max_signups: t.max_signups,
        rate_cents: t.rate_cents,
        label: t.label || `Tier ${i + 1}`,
      }));
      await supabaseBrowser.from("influencer_rate_tiers").insert(rows);
      // Append note
      const noteEntry = `\n[${new Date().toLocaleDateString()}] BULK tiers reset to defaults — ${bulkTierResetReason}`;
      await supabaseBrowser.from("influencers").update({ notes: (inf?.notes || "") + noteEntry }).eq("id", id);
    }
    const names = Array.from(bulkSelected).map((id) => influencers.find((i) => i.id === id)?.name || id);
    logAudit({
      action: "bulk_reset_influencer_tiers",
      tab: AUDIT_TABS.REFERRALS,
      subTab: "Influencers",
      targetType: "influencer",
      fieldName: "rate_tiers",
      newValue: "default tiers",
      details: `Bulk tier reset to defaults for ${bulkSelected.size} influencer(s): ${names.join(", ")} — Reason: ${bulkTierResetReason}`,
    });
    alert(`Tiers reset to defaults for ${bulkSelected.size} influencer(s)`);
    setShowBulkTierResetModal(false);
    setBulkSelected(new Set());
    setBulkTierResetReason("");
    await fetchData();
  }

  function handleBulkCSVExport() {
    const selected = influencers.filter((i) => bulkSelected.has(i.id));
    const rows = selected.map((i) => [
      i.name, i.code, i.email || "", i.phone || "",
      `${i.address_city || ""} ${i.address_state || ""}`.trim(),
      getInfluencerTier(i.total_signups), i.total_signups.toString(),
      (() => { const r = getTierRangeDisplay(i.id); return r ? `${formatRateCents(r.minRate)}-${formatRateCents(r.maxRate)} (${r.count} tiers)` : `$${(i.rate_per_thousand_cents / 100).toFixed(2)}/1K`; })(), formatMoney(i.total_paid_cents),
      i.payment_method || "", i.status,
      i.instagram_handle || "", i.tiktok_handle || "", i.youtube_handle || "", i.twitter_handle || "",
    ]);
    const csv = [
      ["Name", "Code", "Email", "Phone", "City/State", "Tier", "Signups", "Rate/1K", "Total Paid", "Payment Method", "Status", "Instagram", "TikTok", "YouTube", "Twitter"].join(","),
      ...rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `influencers_export_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(a.href);
  }

  function handleFullCSVExport() {
    setBulkSelected(new Set(influencers.map((i) => i.id)));
    setTimeout(() => handleBulkCSVExport(), 50);
  }

  /* ==================== ANALYTICS DRAWER ==================== */

  async function openAnalyticsDrawer(inf: Influencer) {
    setAnalyticsInfluencer(inf);
    setAnalyticsSignups([]);
    setAnalyticsSignupsLoading(true);
    try {
      // Fetch signups for this influencer, joined with profiles for user info
      const { data } = await supabaseBrowser
        .from("influencer_signups")
        .select("id, influencer_id, user_id, created_at, profiles(full_name, first_name, last_name)")
        .eq("influencer_id", inf.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (data) {
        const mapped: InfluencerSignup[] = data.map((row: Record<string, unknown>) => {
          const profile = row.profiles as { full_name?: string; first_name?: string; last_name?: string } | null;
          const name = profile?.full_name
            || [profile?.first_name, profile?.last_name].filter(Boolean).join(" ")
            || null;
          return {
            id: row.id as string,
            influencer_id: row.influencer_id as string,
            user_id: row.user_id as string,
            created_at: row.created_at as string,
            user_name: name || null,
            user_email: null, // profiles table doesn't store email (use auth.users for that)
          };
        });
        setAnalyticsSignups(mapped);
      }
    } catch (err) {
      console.error("Error fetching influencer signups:", err);
    } finally {
      setAnalyticsSignupsLoading(false);
    }
  }

  /* ==================== LINK TRACKING ==================== */

  function getInfluencerLink(code: string): string {
    return `https://letsgo.app/signup?ref=${code}`;
  }

  function handleCopyLink(code: string) {
    navigator.clipboard.writeText(getInfluencerLink(code));
    alert(`✅ Copied: ${getInfluencerLink(code)}`);
  }

  /* ==================== BONUSES ==================== */

  async function handleCreateInfluencerBonus() {
    if (!newInfluencerBonus.label.trim()) { alert("Please enter a bonus label."); return; }
    const { error } = await supabaseBrowser.from("influencer_bonuses").insert({
      influencer_id: bonusTargetId,
      label: newInfluencerBonus.label,
      amount_cents: newInfluencerBonus.amount_cents,
      bonus_type: newInfluencerBonus.bonus_type,
      milestone_signups: newInfluencerBonus.bonus_type === "milestone" && newInfluencerBonus.milestone_signups > 0 ? newInfluencerBonus.milestone_signups : null,
      notes: newInfluencerBonus.notes || null,
      paid: false,
    });
    if (error) { alert("Error creating bonus: " + error.message); return; }
    const bonusInf = influencers.find((i) => i.id === bonusTargetId);
    logAudit({
      action: "create_influencer_bonus",
      tab: AUDIT_TABS.REFERRALS,
      subTab: "Influencer Bonuses",
      targetType: "influencer",
      targetId: bonusTargetId,
      entityName: bonusInf?.name || bonusTargetId,
      details: `Created ${newInfluencerBonus.bonus_type} bonus "${newInfluencerBonus.label}" of ${formatMoney(newInfluencerBonus.amount_cents)}${newInfluencerBonus.bonus_type === "milestone" && newInfluencerBonus.milestone_signups > 0 ? ` at ${newInfluencerBonus.milestone_signups} signups` : ""}`,
    });
    alert("✅ Bonus created!");
    setShowCreateInfluencerBonus(false);
    setNewInfluencerBonus({ label: "", amount_cents: 10000, bonus_type: "milestone", milestone_signups: 0, notes: "" });
    await fetchData();
  }

  async function handleMarkBonusPaid(bonusId: string) {
    await supabaseBrowser.from("influencer_bonuses").update({ paid: true, paid_at: new Date().toISOString() }).eq("id", bonusId);
    logAudit({
      action: "mark_influencer_bonus_paid",
      tab: AUDIT_TABS.REFERRALS,
      subTab: "Influencer Bonuses",
      targetType: "influencer",
      targetId: bonusId,
      fieldName: "paid",
      oldValue: "false",
      newValue: "true",
      details: `Marked influencer bonus as paid`,
    });
    alert("✅ Bonus marked as paid!");
    await fetchData();
  }

  async function handleUndoBonusPay(bonusId: string) {
    if (!confirm("↩️ Undo this bonus payment? This will mark it as unpaid again.")) return;
    const { error } = await supabaseBrowser
      .from("influencer_bonuses")
      .update({ paid: false, paid_at: null })
      .eq("id", bonusId);
    if (error) { alert("Error undoing bonus: " + error.message); return; }
    logAudit({
      action: "undo_influencer_bonus_payment",
      tab: AUDIT_TABS.REFERRALS,
      subTab: "Influencer Bonuses",
      targetType: "influencer",
      targetId: bonusId,
      fieldName: "paid",
      oldValue: "true",
      newValue: "false",
      details: `Reversed influencer bonus payment — marked as unpaid`,
    });
    alert("↩️ Bonus payment reversed — marked as unpaid.");
    await fetchData();
  }

  async function handleDeleteBonus(bonusId: string) {
    if (!confirm("🗑️ Delete this bonus permanently? This cannot be undone.")) return;
    const { error } = await supabaseBrowser.from("influencer_bonuses").delete().eq("id", bonusId);
    if (error) { alert("Error deleting bonus: " + error.message); return; }
    logAudit({
      action: "delete_influencer_bonus",
      tab: AUDIT_TABS.REFERRALS,
      subTab: "Influencer Bonuses",
      targetType: "influencer",
      targetId: bonusId,
      details: `Permanently deleted influencer bonus`,
    });
    alert("🗑️ Bonus deleted.");
    await fetchData();
  }

  async function handleUndoPayoutPay(payoutId: string, amountCents: number, influencerId: string) {
    if (!confirm(`↩️ Undo this payout payment of ${formatMoney(amountCents)}? This will mark it as unpaid and reverse the paid total.`)) return;
    const { error: payoutError } = await supabaseBrowser
      .from("influencer_payouts")
      .update({ paid: false, paid_at: null })
      .eq("id", payoutId);
    if (payoutError) { alert("Error undoing payout: " + payoutError.message); return; }

    // Decrement total_paid_cents on the influencer record
    const inf = influencers.find(i => i.id === influencerId);
    if (inf) {
      const newTotal = Math.max(0, inf.total_paid_cents - amountCents);
      await supabaseBrowser.from("influencers").update({ total_paid_cents: newTotal }).eq("id", influencerId);
    }
    logAudit({
      action: "undo_influencer_payout",
      tab: AUDIT_TABS.REFERRALS,
      subTab: "Influencer Payouts",
      targetType: "influencer",
      targetId: payoutId,
      entityName: inf?.name || influencerId,
      fieldName: "paid",
      oldValue: "true",
      newValue: "false",
      details: `Reversed payout of ${formatMoney(amountCents)} — marked as unpaid`,
    });
    alert("↩️ Payout reversed — marked as unpaid.");
    await fetchData();
  }

  async function handleDeletePayout(payoutId: string, paid: boolean) {
    if (paid) {
      alert("⚠️ Cannot delete a payout that has already been marked paid. Use ↩️ Undo first, then delete.");
      return;
    }
    if (!confirm("🗑️ Delete this unpaid payout record permanently? This cannot be undone.")) return;
    const { error } = await supabaseBrowser.from("influencer_payouts").delete().eq("id", payoutId);
    if (error) { alert("Error deleting payout: " + error.message); return; }
    logAudit({
      action: "delete_influencer_payout",
      tab: AUDIT_TABS.REFERRALS,
      subTab: "Influencer Payouts",
      targetType: "influencer",
      targetId: payoutId,
      details: `Permanently deleted unpaid payout record`,
    });
    alert("🗑️ Payout record deleted.");
    await fetchData();
  }

  /* ==================== MANUAL SIGNUP ATTRIBUTION ==================== */

  function handleManualAttribution(influencerId: string) {
    setAttributionInfluencerId(influencerId);
    setAttributionSearch("");
    setAttributionResults([]);
    setShowAttributionModal(true);
  }

  async function handleAttributionSearch(query: string) {
    setAttributionSearch(query);
    if (query.trim().length < 2) { setAttributionResults([]); return; }
    setAttributionSearching(true);
    try {
      // Search by email or name
      const { data } = await supabaseBrowser
        .from("profiles")
        .select("id, full_name, first_name, last_name, email")
        .or(`email.ilike.%${query.trim()}%,full_name.ilike.%${query.trim()}%,first_name.ilike.%${query.trim()}%,last_name.ilike.%${query.trim()}%`)
        .limit(10);

      if (data) {
        setAttributionResults(data.map((p: Record<string, unknown>) => ({
          id: p.id as string,
          name: (p.full_name as string) || [p.first_name, p.last_name].filter(Boolean).join(" ") as string || "Unknown",
          email: (p.email as string) || "",
        })));
      }
    } catch { setAttributionResults([]); }
    finally { setAttributionSearching(false); }
  }

  async function handleAttributeUser(userId: string, userName: string, userEmail: string) {
    const inf = influencers.find(i => i.id === attributionInfluencerId);
    if (!inf) return;

    const { error: signupErr } = await supabaseBrowser
      .from("influencer_signups")
      .insert({ influencer_id: attributionInfluencerId, user_id: userId });

    if (signupErr) {
      if (signupErr.code === "23505") {
        alert(`${userName} is already attributed to ${inf.name}.`);
      } else {
        alert("Error attributing signup: " + signupErr.message);
      }
      return;
    }

    // Increment total_signups
    await supabaseBrowser
      .from("influencers")
      .update({ total_signups: inf.total_signups + 1 })
      .eq("id", attributionInfluencerId);

    logAudit({
      action: "manual_influencer_attribution",
      tab: AUDIT_TABS.REFERRALS,
      subTab: "Influencers",
      targetType: "influencer",
      targetId: attributionInfluencerId,
      entityName: inf.name,
      newValue: `${userName} (${userId})`,
      details: `Manually attributed signup of ${userName} (${userEmail}) to influencer ${inf.name} (${inf.code})`,
    });

    setShowAttributionModal(false);
    alert(`${userName} attributed as a signup for ${inf.name}!`);
    await fetchData();
    if (analyticsInfluencer?.id === attributionInfluencerId) {
      openAnalyticsDrawer({ ...inf, total_signups: inf.total_signups + 1 });
    }
  }

  /* ==================== CONTRACTS ==================== */

  async function handleCreateContract() {
    if (!newContract.label.trim()) { alert("Please enter a contract label."); return; }
    setContractUploading(true);
    try {
      let storagePath: string | null = null;
      let fileName: string | null = null;

      // Upload PDF to Supabase Storage if a file was selected
      if (contractFile) {
        const ext = contractFile.name.split(".").pop()?.toLowerCase() || "pdf";
        const safeName = contractFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        storagePath = `${contractTargetId}/${Date.now()}-${safeName}`;
        fileName = contractFile.name;

        const { error: uploadError } = await supabaseBrowser.storage
          .from("influencer-contracts")
          .upload(storagePath, contractFile, {
            cacheControl: "3600",
            upsert: false,
            contentType: ext === "pdf" ? "application/pdf" : contractFile.type,
          });

        if (uploadError) {
          alert("Error uploading file: " + uploadError.message + "\n\nMake sure the 'influencer-contracts' bucket exists in Supabase Storage.");
          setContractUploading(false);
          return;
        }
      }

      const { error } = await supabaseBrowser.from("influencer_contracts").insert({
        influencer_id: contractTargetId,
        label: newContract.label,
        storage_path: storagePath,
        file_name: fileName,
        contract_start: newContract.contract_start || null,
        contract_end: newContract.contract_end || null,
        status: "active",
        signed_by_influencer: false,
        notes: newContract.notes || null,
      });

      if (error) { alert("Error creating contract: " + error.message); return; }
      const contractInf = influencers.find((i) => i.id === contractTargetId);
      logAudit({
        action: "create_influencer_contract",
        tab: AUDIT_TABS.REFERRALS,
        subTab: "Contracts",
        targetType: "influencer",
        targetId: contractTargetId,
        entityName: contractInf?.name || contractTargetId,
        details: `Created contract "${newContract.label}"${contractFile ? ` with file "${contractFile.name}"` : " (no file attached)"}${newContract.contract_start ? `, start: ${newContract.contract_start}` : ""}${newContract.contract_end ? `, end: ${newContract.contract_end}` : ""}`,
      });
      alert(contractFile ? "✅ Contract uploaded and saved!" : "✅ Contract record created (no file attached).");
      setShowCreateContract(false);
      setNewContract({ label: "", contract_start: "", contract_end: "", notes: "" });
      setContractFile(null);
      await fetchData();
    } finally {
      setContractUploading(false);
    }
  }

  async function handleMarkContractSigned(contractId: string) {
    await supabaseBrowser.from("influencer_contracts").update({ signed_by_influencer: true, signed_at: new Date().toISOString() }).eq("id", contractId);
    logAudit({
      action: "mark_contract_signed",
      tab: AUDIT_TABS.REFERRALS,
      subTab: "Contracts",
      targetType: "influencer",
      targetId: contractId,
      fieldName: "signed_by_influencer",
      oldValue: "false",
      newValue: "true",
      details: `Marked influencer contract as signed`,
    });
    await fetchData();
  }

  /* ==================== CSV/XLSX DOWNLOADS ==================== */

  function handleDownloadCSV() {
    const rangeLabel = referralDateRange === "all" ? "all-time" : `last-${referralDateRange}d`;
    downloadCSV(
      `referrals_${rangeLabel}_${new Date().toISOString().slice(0, 10)}.csv`,
      ["ID", "Referrer", "Type", "Referred", "Source", "Status", "Reward ($)", "Paid", "Created"],
      dateFilteredReferrals.map((r) => [
        r.id, r.referrer_name || "", r.referrer_type || "", r.referred_name || "",
        r.source, r.status, ((r.reward_cents || 0) / 100).toFixed(2),
        r.reward_paid ? "Yes" : "No", r.created_at,
      ])
    );
  }

  /* ==================== RENDER ==================== */

  const bonusIcons: Record<string, string> = { user: "👤", business: "🏢" };
  const bonusColors: Record<string, string> = { user: COLORS.neonPurple, business: COLORS.neonBlue };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 32, background: COLORS.darkBg, minHeight: "calc(100vh - 60px)" }}>
      {/* Create Code Modal */}
      {showCreateCode && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setShowCreateCode(false)}>
          <div style={{ background: COLORS.cardBg, borderRadius: 20, padding: 32, maxWidth: 480, width: "90%", border: "1px solid " + COLORS.cardBorder }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>+ Create Referral Code</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Code</label>
                <input value={newCode.code} onChange={(e) => setNewCode({ ...newCode, code: e.target.value })}
                  placeholder="e.g. MARCUS2026" style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 14, fontWeight: 700, textTransform: "uppercase" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Type</label>
                  <select value={newCode.type} onChange={(e) => setNewCode({ ...newCode, type: e.target.value })}
                    style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 13 }}>
                    <option value="business">Business</option>
                    <option value="user">User</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Owner Name</label>
                  <input value={newCode.owner_name} onChange={(e) => setNewCode({ ...newCode, owner_name: e.target.value })}
                    placeholder="Marcus Johnson" style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 13 }} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Bonus ($)</label>
                  <input type="number" value={newCode.bonus_cents / 100} onChange={(e) => setNewCode({ ...newCode, bonus_cents: Math.round(parseFloat(e.target.value) * 100) || 0 })}
                    style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.neonGreen, fontSize: 16, fontWeight: 700 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Max Uses (0 = unlimited)</label>
                  <input type="number" value={newCode.max_uses} onChange={(e) => setNewCode({ ...newCode, max_uses: parseInt(e.target.value) || 0 })}
                    style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 14 }} />
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => setShowCreateCode(false)}
                style={{ padding: "12px 24px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, cursor: "pointer", fontWeight: 600 }}>Cancel</button>
              <button onClick={handleCreateCode}
                style={{ padding: "12px 24px", background: COLORS.neonRed, border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontWeight: 700 }}>Create Code</button>
            </div>
          </div>
        </div>
      )}

      {/* ====== ANALYTICS DRAWER ====== */}
      {analyticsInfluencer && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", justifyContent: "flex-end" }} onClick={() => setAnalyticsInfluencer(null)}>
          <div style={{ width: "min(680px,95vw)", background: COLORS.cardBg, height: "100%", overflowY: "auto", borderLeft: "2px solid " + COLORS.neonGreen, padding: 32 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 700, background: COLORS.gradient2, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{analyticsInfluencer.name}</h2>
                <div style={{ fontSize: 13, color: COLORS.neonPink, fontFamily: "monospace", fontWeight: 700 }}>{analyticsInfluencer.code}</div>
              </div>
              <button onClick={() => setAnalyticsInfluencer(null)} style={{ background: "none", border: "none", color: COLORS.textSecondary, fontSize: 28, cursor: "pointer" }}>×</button>
            </div>

            {/* Tier Badge */}
            {(() => { const t = TIER_CONFIG[getInfluencerTier(analyticsInfluencer.total_signups)]; return (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "12px 20px", borderRadius: 12, background: "rgba(0,0,0,0.4)", border: `2px solid ${t.color}`, marginBottom: 24 }}>
                <span style={{ fontSize: 28 }}>{t.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: t.color }}>{t.label} Tier</div>
                  <div style={{ fontSize: 11, color: COLORS.textSecondary }}>{analyticsInfluencer.total_signups.toLocaleString()} signups</div>
                </div>
                {getInfluencerTier(analyticsInfluencer.total_signups) !== "platinum" && (() => {
                  const tiers: TierKey[] = ["bronze","silver","gold","platinum"];
                  const nextKey = tiers[tiers.indexOf(getInfluencerTier(analyticsInfluencer.total_signups)) + 1];
                  const nextT = TIER_CONFIG[nextKey];
                  const needed = nextT.min - analyticsInfluencer.total_signups;
                  return <div style={{ fontSize: 11, color: COLORS.textSecondary, marginLeft: 12 }}>{needed.toLocaleString()} more for {nextT.icon} {nextT.label}</div>;
                })()}
              </div>
            ); })()}

            {/* Key Stats Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
              {[
                { label: "Total Signups", value: analyticsInfluencer.total_signups.toLocaleString(), color: COLORS.neonGreen },
                { label: "Link Clicks", value: (analyticsInfluencer.total_clicks || 0).toLocaleString(), color: COLORS.neonBlue },
                { label: "Click → Signup Rate", value: getClickConversionRate(analyticsInfluencer), color: COLORS.neonYellow },
                { label: "Rate Tiers", value: (() => { const r = getTierRangeDisplay(analyticsInfluencer.id); return r ? `${formatRateCents(r.minRate)}–${formatRateCents(r.maxRate)}` : formatMoney(analyticsInfluencer.rate_per_thousand_cents) + "/1K"; })(), color: COLORS.neonYellow },
                { label: "Total Paid", value: formatMoney(analyticsInfluencer.total_paid_cents), color: COLORS.neonGreen },
                { label: "Unpaid Balance", value: formatMoney(Math.max(0, calcUnpaidPayoutValue(analyticsInfluencer))), color: COLORS.neonOrange },
              ].map((s, i) => (
                <div key={i} style={{ background: COLORS.darkBg, borderRadius: 10, padding: 16, border: "1px solid " + COLORS.cardBorder }}>
                  <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Referral Link */}
            <div style={{ background: COLORS.darkBg, borderRadius: 12, padding: 16, marginBottom: 24, border: "1px solid " + COLORS.cardBorder }}>
              <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase", fontWeight: 600 }}>🔗 Tracking Link</div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <code style={{ flex: 1, fontSize: 12, color: COLORS.neonGreen, background: "rgba(57,255,20,0.08)", padding: "8px 12px", borderRadius: 8, wordBreak: "break-all" }}>
                  {getInfluencerLink(analyticsInfluencer.code)}
                </code>
                <button onClick={() => handleCopyLink(analyticsInfluencer.code)} style={{ padding: "8px 16px", background: COLORS.neonGreen, border: "none", borderRadius: 8, color: "#000", fontWeight: 700, cursor: "pointer", fontSize: 12, flexShrink: 0 }}>
                  Copy
                </button>
              </div>
            </div>

            {/* Payout History */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.neonBlue, marginBottom: 12, textTransform: "uppercase" }}>💸 Payout History</div>
              {influencerPayouts.filter(p => p.influencer_id === analyticsInfluencer.id).length === 0
                ? <div style={{ color: COLORS.textSecondary, fontSize: 13, padding: "16px 0" }}>No payouts yet</div>
                : influencerPayouts.filter(p => p.influencer_id === analyticsInfluencer.id).map(p => (
                  <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "10px 0", borderBottom: "1px solid " + COLORS.cardBorder, gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{p.signups_count.toLocaleString()} signups @ {formatMoney(p.rate_per_thousand_cents)}/1K</div>
                      <div style={{ fontSize: 11, color: COLORS.textSecondary }}>{formatDate(p.created_at)}</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontWeight: 700, color: COLORS.neonGreen, marginBottom: 4 }}>{formatMoney(p.amount_cents)}</div>
                      <div style={{ fontSize: 11, marginBottom: 6 }}>{p.paid ? <span style={{ color: COLORS.neonGreen }}>✓ Paid {formatDate(p.paid_at)}</span> : <span style={{ color: COLORS.neonYellow }}>Pending</span>}</div>
                      <div style={{ display: "flex", gap: 5, justifyContent: "flex-end" }}>
                        {!p.paid && (
                          <button
                            onClick={() => handleMarkPayoutPaid(p.id)}
                            style={{ padding: "3px 8px", background: COLORS.gradient2, border: "none", borderRadius: 5, color: "#000", cursor: "pointer", fontSize: 10, fontWeight: 700 }}
                          >
                            💰 Pay
                          </button>
                        )}
                        {p.paid && (
                          <button
                            onClick={() => handleUndoPayoutPay(p.id, p.amount_cents, p.influencer_id)}
                            style={{ padding: "3px 8px", background: "rgba(255,255,0,0.15)", border: "1px solid " + COLORS.neonYellow, borderRadius: 5, color: COLORS.neonYellow, cursor: "pointer", fontSize: 10, fontWeight: 700 }}
                          >
                            ↩️ Undo
                          </button>
                        )}
                        {!p.paid && (
                          <button
                            onClick={() => handleDeletePayout(p.id, p.paid)}
                            style={{ padding: "3px 8px", background: "rgba(255,49,49,0.15)", border: "1px solid " + COLORS.neonRed, borderRadius: 5, color: COLORS.neonRed, cursor: "pointer", fontSize: 10, fontWeight: 700 }}
                          >
                            🗑️ Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              }
            </div>

            {/* Bonuses */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.neonPurple, textTransform: "uppercase" }}>🎁 Bonuses</div>
                <button onClick={() => { setBonusTargetId(analyticsInfluencer.id); setShowCreateInfluencerBonus(true); }} style={{ padding: "5px 12px", background: "rgba(191,95,255,0.2)", border: "1px solid " + COLORS.neonPurple, borderRadius: 6, color: COLORS.neonPurple, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>+ Add Bonus</button>
              </div>
              {influencerBonuses.filter(b => b.influencer_id === analyticsInfluencer.id).length === 0
                ? <div style={{ color: COLORS.textSecondary, fontSize: 13 }}>No bonuses assigned</div>
                : influencerBonuses.filter(b => b.influencer_id === analyticsInfluencer.id).map(b => (
                  <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "10px 0", borderBottom: "1px solid " + COLORS.cardBorder, gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{b.label}</div>
                      <div style={{ fontSize: 11, color: COLORS.textSecondary }}>{b.bonus_type}{b.milestone_signups ? ` · at ${b.milestone_signups.toLocaleString()} signups` : ""}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0 }}>
                      <span style={{ fontWeight: 700, color: COLORS.neonGreen }}>{formatMoney(b.amount_cents)}</span>
                      <div style={{ display: "flex", gap: 5 }}>
                        {!b.paid && (
                          <button onClick={() => handleMarkBonusPaid(b.id)} style={{ padding: "3px 8px", background: COLORS.gradient2, border: "none", borderRadius: 5, color: "#000", cursor: "pointer", fontSize: 10, fontWeight: 700 }}>
                            💰 Pay
                          </button>
                        )}
                        {b.paid && (
                          <>
                            <span style={{ fontSize: 11, color: COLORS.neonGreen, alignSelf: "center" }}>✓ Paid</span>
                            <button onClick={() => handleUndoBonusPay(b.id)} style={{ padding: "3px 8px", background: "rgba(255,255,0,0.15)", border: "1px solid " + COLORS.neonYellow, borderRadius: 5, color: COLORS.neonYellow, cursor: "pointer", fontSize: 10, fontWeight: 700 }}>
                              ↩️ Undo
                            </button>
                          </>
                        )}
                        <button onClick={() => handleDeleteBonus(b.id)} style={{ padding: "3px 8px", background: "rgba(255,49,49,0.15)", border: "1px solid " + COLORS.neonRed, borderRadius: 5, color: COLORS.neonRed, cursor: "pointer", fontSize: 10, fontWeight: 700 }}>
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              }
            </div>

            {/* Contracts */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.neonOrange, textTransform: "uppercase" }}>📄 Contracts</div>
                <button onClick={() => { setContractTargetId(analyticsInfluencer.id); setShowCreateContract(true); }} style={{ padding: "5px 12px", background: "rgba(255,107,53,0.2)", border: "1px solid " + COLORS.neonOrange, borderRadius: 6, color: COLORS.neonOrange, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>+ Add Contract</button>
              </div>
              {influencerContracts.filter(c => c.influencer_id === analyticsInfluencer.id).length === 0
                ? <div style={{ color: COLORS.textSecondary, fontSize: 13 }}>No contracts on file</div>
                : influencerContracts.filter(c => c.influencer_id === analyticsInfluencer.id).map(con => (
                  <div key={con.id} style={{ padding: "10px 0", borderBottom: "1px solid " + COLORS.cardBorder }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>📄 {con.label}</div>
                        <div style={{ fontSize: 11, color: COLORS.textSecondary }}>{formatDate(con.contract_start)} – {con.contract_end ? formatDate(con.contract_end) : "Ongoing"}</div>
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span style={{ padding: "3px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, background: con.signed_by_influencer ? "rgba(57,255,20,0.2)" : "rgba(255,255,0,0.2)", color: con.signed_by_influencer ? COLORS.neonGreen : COLORS.neonYellow }}>
                          {con.signed_by_influencer ? "✓ Signed" : "Awaiting Signature"}
                        </span>
                        {!con.signed_by_influencer && <button onClick={() => handleMarkContractSigned(con.id)} style={{ padding: "3px 8px", background: COLORS.neonGreen, border: "none", borderRadius: 4, color: "#000", cursor: "pointer", fontSize: 10, fontWeight: 700 }}>Mark Signed</button>}
                        {con.storage_path ? (
                          <button
                            onClick={async () => {
                              const { data } = await supabaseBrowser.storage.from("influencer-contracts").createSignedUrl(con.storage_path!, 300);
                              if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                              else alert("Could not generate download link.");
                            }}
                            style={{ padding: "3px 8px", background: "rgba(0,212,255,0.15)", border: "1px solid " + COLORS.neonBlue, borderRadius: 4, color: COLORS.neonBlue, cursor: "pointer", fontSize: 10, fontWeight: 700 }}
                          >
                            📥 View PDF
                          </button>
                        ) : (
                          <span style={{ fontSize: 10, color: COLORS.textSecondary }}>No file</span>
                        )}
                      </div>
                    </div>
                    {con.file_name && <div style={{ fontSize: 10, color: COLORS.textSecondary, marginTop: 3 }}>📎 {con.file_name}</div>}
                  </div>
                ))
              }
            </div>

            {/* Signup History */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.neonGreen, textTransform: "uppercase" }}>
                  👤 Signup History
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ fontSize: 11, color: COLORS.textSecondary }}>
                    {analyticsSignupsLoading ? "Loading..." : `${analyticsSignups.length} shown (last 100)`}
                  </div>
                  <button
                    onClick={() => analyticsInfluencer && handleManualAttribution(analyticsInfluencer.id)}
                    style={{ padding: "4px 10px", background: "rgba(57,255,20,0.15)", border: "1px solid " + COLORS.neonGreen, borderRadius: 6, color: COLORS.neonGreen, cursor: "pointer", fontSize: 10, fontWeight: 700 }}
                  >
                    + Add Signup
                  </button>
                </div>
              </div>

              {analyticsSignupsLoading ? (
                <div style={{ padding: "20px 0", textAlign: "center", color: COLORS.textSecondary, fontSize: 13 }}>
                  Loading signups...
                </div>
              ) : analyticsSignups.length === 0 ? (
                <div style={{ color: COLORS.textSecondary, fontSize: 13, padding: "16px 0" }}>
                  No signups attributed to this influencer yet.
                </div>
              ) : (
                <>
                  {/* Summary row */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
                    {[
                      { label: "This Month", value: analyticsSignups.filter(s => new Date(s.created_at) >= new Date(new Date().getFullYear(), new Date().getMonth(), 1)).length },
                      { label: "Last 30 Days", value: analyticsSignups.filter(s => new Date(s.created_at) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).length },
                      { label: "Last 7 Days",  value: analyticsSignups.filter(s => new Date(s.created_at) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length },
                    ].map(stat => (
                      <div key={stat.label} style={{ background: "rgba(57,255,20,0.06)", border: "1px solid rgba(57,255,20,0.2)", borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
                        <div style={{ fontWeight: 700, fontSize: 20, color: COLORS.neonGreen }}>{stat.value}</div>
                        <div style={{ fontSize: 10, color: COLORS.textSecondary, marginTop: 2 }}>{stat.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Signup rows */}
                  <div style={{ maxHeight: 320, overflowY: "auto", borderRadius: 8, border: "1px solid " + COLORS.cardBorder }}>
                    {/* Header */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 120px", padding: "8px 14px", background: "rgba(0,0,0,0.3)", fontSize: 10, color: COLORS.textSecondary, textTransform: "uppercase", fontWeight: 700, position: "sticky", top: 0 }}>
                      <div>User</div>
                      <div>User ID</div>
                      <div style={{ textAlign: "right" }}>Signed Up</div>
                    </div>
                    {analyticsSignups.map((signup, idx) => (
                      <div key={signup.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 120px", padding: "9px 14px", borderTop: idx > 0 ? "1px solid " + COLORS.cardBorder : "none", alignItems: "center" }}>
                        <div style={{ fontSize: 13, fontWeight: signup.user_name ? 500 : 400, color: signup.user_name ? COLORS.textPrimary : COLORS.textSecondary }}>
                          {signup.user_name || "Anonymous User"}
                        </div>
                        <div style={{ fontSize: 10, color: COLORS.textSecondary, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {signup.user_id.slice(0, 16)}…
                        </div>
                        <div style={{ fontSize: 11, color: COLORS.textSecondary, textAlign: "right" }}>
                          {formatDate(signup.created_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ====== BULK RATE UPDATE MODAL ====== */}
      {showBulkTierResetModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setShowBulkTierResetModal(false)}>
          <div style={{ background: COLORS.cardBg, borderRadius: 20, padding: 32, maxWidth: 480, width: "90%", border: "1px solid " + COLORS.cardBorder }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>📊 Reset Tiers to Defaults</h2>
            <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 20 }}>Resetting {bulkSelected.size} influencer(s) to default tier structure</div>
            {defaultInfluencerTiers.length > 0 && (
              <div style={{ marginBottom: 16, padding: 12, background: COLORS.darkBg, borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, textTransform: "uppercase", fontWeight: 600 }}>Default Tiers</div>
                {defaultInfluencerTiers.map((t, i) => (
                  <div key={i} style={{ fontSize: 12, color: COLORS.textPrimary, marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
                    <span>{t.label}: {t.min_signups}–{t.max_signups ?? "∞"} signups</span>
                    <span style={{ color: COLORS.neonYellow, fontWeight: 600 }}>{formatRateCents(t.rate_cents)}/signup</span>
                  </div>
                ))}
              </div>
            )}
            <div>
              <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Reason *</label>
              <textarea value={bulkTierResetReason} onChange={(e) => setBulkTierResetReason(e.target.value)} placeholder="e.g. Q1 2026 tier adjustment..."
                style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 13, minHeight: 70, resize: "vertical" }} />
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => setShowBulkTierResetModal(false)} style={{ padding: "12px 24px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, cursor: "pointer", fontWeight: 600 }}>Cancel</button>
              <button onClick={handleBulkTierReset} style={{ padding: "12px 24px", background: COLORS.neonOrange, border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontWeight: 700 }}>Reset All Selected</button>
            </div>
          </div>
        </div>
      )}

      {/* ====== CREATE INFLUENCER BONUS MODAL ====== */}
      {showCreateInfluencerBonus && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }} onClick={() => setShowCreateInfluencerBonus(false)}>
          <div style={{ background: COLORS.cardBg, borderRadius: 20, padding: 32, maxWidth: 480, width: "90%", border: "1px solid " + COLORS.cardBorder }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>🎁 Add Bonus</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Label</label>
                <input value={newInfluencerBonus.label} onChange={(e) => setNewInfluencerBonus({ ...newInfluencerBonus, label: e.target.value })}
                  placeholder="e.g. January Contest Winner" style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 14 }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Amount ($)</label>
                  <input type="number" value={newInfluencerBonus.amount_cents / 100} onChange={(e) => setNewInfluencerBonus({ ...newInfluencerBonus, amount_cents: Math.round(parseFloat(e.target.value) * 100) || 0 })}
                    style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.neonGreen, fontSize: 18, fontWeight: 700 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Bonus Type</label>
                  <select value={newInfluencerBonus.bonus_type} onChange={(e) => setNewInfluencerBonus({ ...newInfluencerBonus, bonus_type: e.target.value })}
                    style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 13 }}>
                    <option value="milestone">Milestone</option>
                    <option value="contest">Contest Winner</option>
                    <option value="performance">Performance</option>
                    <option value="one_time">One-Time</option>
                  </select>
                </div>
              </div>
              {newInfluencerBonus.bonus_type === "milestone" && (
                <div>
                  <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Trigger at Signups</label>
                  <input type="number" value={newInfluencerBonus.milestone_signups} onChange={(e) => setNewInfluencerBonus({ ...newInfluencerBonus, milestone_signups: parseInt(e.target.value) || 0 })}
                    placeholder="e.g. 5000" style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 14 }} />
                </div>
              )}
              <div>
                <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Notes (optional)</label>
                <textarea value={newInfluencerBonus.notes} onChange={(e) => setNewInfluencerBonus({ ...newInfluencerBonus, notes: e.target.value })}
                  style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 13, minHeight: 60, resize: "vertical" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => setShowCreateInfluencerBonus(false)} style={{ padding: "12px 24px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, cursor: "pointer", fontWeight: 600 }}>Cancel</button>
              <button onClick={handleCreateInfluencerBonus} style={{ padding: "12px 24px", background: COLORS.neonPurple, border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontWeight: 700 }}>Create Bonus</button>
            </div>
          </div>
        </div>
      )}

      {/* ====== CREATE CONTRACT MODAL ====== */}
      {showCreateContract && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }} onClick={() => { if (!contractUploading) setShowCreateContract(false); }}>
          <div style={{ background: COLORS.cardBg, borderRadius: 20, padding: 32, maxWidth: 520, width: "90%", border: "1px solid " + COLORS.cardBorder }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>📄 Add Contract</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Contract Label */}
              <div>
                <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Contract Label *</label>
                <input value={newContract.label} onChange={(e) => setNewContract({ ...newContract, label: e.target.value })}
                  placeholder="e.g. 2026 Partnership Agreement" style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 14 }} />
              </div>

              {/* PDF Upload */}
              <div>
                <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Contract PDF</label>
                <label
                  htmlFor="contract-file-input"
                  style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
                    border: `2px dashed ${contractFile ? COLORS.neonGreen : COLORS.cardBorder}`,
                    borderRadius: 10, cursor: "pointer",
                    background: contractFile ? "rgba(57,255,20,0.05)" : COLORS.darkBg,
                    transition: "all 0.2s",
                  }}
                >
                  <span style={{ fontSize: 24 }}>{contractFile ? "📄" : "📁"}</span>
                  <div style={{ flex: 1 }}>
                    {contractFile ? (
                      <>
                        <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.neonGreen }}>{contractFile.name}</div>
                        <div style={{ fontSize: 11, color: COLORS.textSecondary }}>{(contractFile.size / 1024).toFixed(0)} KB</div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 13, color: COLORS.textPrimary }}>Click to upload PDF</div>
                        <div style={{ fontSize: 11, color: COLORS.textSecondary }}>PDF files only, max 10MB</div>
                      </>
                    )}
                  </div>
                  {contractFile && (
                    <button
                      onClick={(e) => { e.preventDefault(); setContractFile(null); }}
                      style={{ background: "none", border: "none", color: COLORS.textSecondary, cursor: "pointer", fontSize: 18, padding: 4 }}
                    >×</button>
                  )}
                </label>
                <input
                  id="contract-file-input"
                  type="file"
                  accept="application/pdf,.pdf"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    if (file && file.size > 10 * 1024 * 1024) { alert("File too large. Max 10MB."); return; }
                    setContractFile(file);
                  }}
                />
              </div>

              {/* Dates */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Start Date</label>
                  <input type="date" value={newContract.contract_start} onChange={(e) => setNewContract({ ...newContract, contract_start: e.target.value })}
                    style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 13 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>End Date (blank = ongoing)</label>
                  <input type="date" value={newContract.contract_end} onChange={(e) => setNewContract({ ...newContract, contract_end: e.target.value })}
                    style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 13 }} />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Notes (optional)</label>
                <textarea value={newContract.notes} onChange={(e) => setNewContract({ ...newContract, notes: e.target.value })}
                  style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 13, minHeight: 60, resize: "vertical" }} />
              </div>

            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => { setShowCreateContract(false); setContractFile(null); }} disabled={contractUploading}
                style={{ padding: "12px 24px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, cursor: "pointer", fontWeight: 600, opacity: contractUploading ? 0.5 : 1 }}>
                Cancel
              </button>
              <button onClick={handleCreateContract} disabled={contractUploading}
                style={{ padding: "12px 24px", background: contractUploading ? COLORS.cardBorder : COLORS.neonOrange, border: "none", borderRadius: 10, color: "#fff", cursor: contractUploading ? "not-allowed" : "pointer", fontWeight: 700 }}>
                {contractUploading ? "Uploading..." : contractFile ? "Upload & Save" : "Save Contract"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Influencer Modal */}
      {showCreateInfluencer && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, overflowY: "auto", padding: "40px 0" }} onClick={() => setShowCreateInfluencer(false)}>
          <div style={{ background: COLORS.cardBg, borderRadius: 20, padding: 32, maxWidth: 800, width: "90%", border: "1px solid " + COLORS.cardBorder, margin: "auto" }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, background: COLORS.gradient2, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>🌟 Add New Influencer</h2>

            <div style={{ maxHeight: "70vh", overflowY: "auto", paddingRight: 10 }}>
              {/* Basic Info */}
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: COLORS.neonGreen, marginBottom: 12, textTransform: "uppercase" }}>📋 Basic Information</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Full Name *</label>
                    <input value={newInfluencer.name} onChange={(e) => setNewInfluencer({ ...newInfluencer, name: e.target.value })}
                      placeholder="Sarah Johnson" style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 14 }} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Influencer Code *</label>
                      <input value={newInfluencer.code} onChange={(e) => setNewInfluencer({ ...newInfluencer, code: e.target.value })}
                        placeholder="SARAH2026" style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 14, fontWeight: 700, textTransform: "uppercase" }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Rate Tiers</label>
                      <div style={{ padding: 12, background: COLORS.darkBg, borderRadius: 10, border: "1px solid " + COLORS.cardBorder }}>
                        {defaultInfluencerTiers.length > 0 ? (
                          <>
                            <div style={{ fontSize: 12, color: COLORS.neonGreen, fontWeight: 600, marginBottom: 6 }}>Default tiers will be applied:</div>
                            {defaultInfluencerTiers.map((t, i) => (
                              <div key={i} style={{ fontSize: 11, color: COLORS.textSecondary, display: "flex", justifyContent: "space-between" }}>
                                <span>{t.label}: {t.min_signups}–{t.max_signups ?? "∞"}</span>
                                <span style={{ color: COLORS.neonYellow }}>{formatRateCents(t.rate_cents)}/signup</span>
                              </div>
                            ))}
                            <div style={{ fontSize: 10, color: COLORS.textSecondary, marginTop: 6 }}>You can customize tiers after creation</div>
                          </>
                        ) : (
                          <div style={{ fontSize: 12, color: COLORS.textSecondary }}>No default tiers configured. Set them in Settings → Influencer Tiers</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact Info */}
              <div style={{ marginBottom: 24, paddingTop: 20, borderTop: "1px solid " + COLORS.cardBorder }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: COLORS.neonBlue, marginBottom: 12, textTransform: "uppercase" }}>📞 Contact Information</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Email</label>
                      <input type="email" value={newInfluencer.email} onChange={(e) => setNewInfluencer({ ...newInfluencer, email: e.target.value })}
                        placeholder="sarah@example.com" style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 13 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Phone</label>
                      <input type="tel" value={newInfluencer.phone} onChange={(e) => setNewInfluencer({ ...newInfluencer, phone: e.target.value })}
                        placeholder="(402) 555-1234" style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 13 }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Street Address</label>
                    <input value={newInfluencer.address_street} onChange={(e) => setNewInfluencer({ ...newInfluencer, address_street: e.target.value })}
                      placeholder="123 Main Street" style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 13 }} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>City</label>
                      <input value={newInfluencer.address_city} onChange={(e) => setNewInfluencer({ ...newInfluencer, address_city: e.target.value })}
                        placeholder="Omaha" style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 13 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>State</label>
                      <input value={newInfluencer.address_state} onChange={(e) => setNewInfluencer({ ...newInfluencer, address_state: e.target.value })}
                        placeholder="NE" maxLength={2} style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 13, textTransform: "uppercase" }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>ZIP Code</label>
                      <input value={newInfluencer.address_zip} onChange={(e) => setNewInfluencer({ ...newInfluencer, address_zip: e.target.value })}
                        placeholder="68101" style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 13 }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Social Media */}
              <div style={{ marginBottom: 24, paddingTop: 20, borderTop: "1px solid " + COLORS.cardBorder }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: COLORS.neonPink, marginBottom: 12, textTransform: "uppercase" }}>📱 Social Media Handles</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Instagram</label>
                    <input value={newInfluencer.instagram_handle} onChange={(e) => setNewInfluencer({ ...newInfluencer, instagram_handle: e.target.value })}
                      placeholder="@sarahjohnson" style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 13 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>TikTok</label>
                    <input value={newInfluencer.tiktok_handle} onChange={(e) => setNewInfluencer({ ...newInfluencer, tiktok_handle: e.target.value })}
                      placeholder="@sarahjohnson" style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 13 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>YouTube</label>
                    <input value={newInfluencer.youtube_handle} onChange={(e) => setNewInfluencer({ ...newInfluencer, youtube_handle: e.target.value })}
                      placeholder="@sarahjohnson" style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 13 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Twitter/X</label>
                    <input value={newInfluencer.twitter_handle} onChange={(e) => setNewInfluencer({ ...newInfluencer, twitter_handle: e.target.value })}
                      placeholder="@sarahjohnson" style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 13 }} />
                  </div>
                </div>
              </div>

              {/* Payment Info */}
              <div style={{ marginBottom: 24, paddingTop: 20, borderTop: "1px solid " + COLORS.cardBorder }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: COLORS.neonYellow, marginBottom: 12, textTransform: "uppercase" }}>💳 Payment Information</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Payment Method</label>
                      <select value={newInfluencer.payment_method} onChange={(e) => setNewInfluencer({ ...newInfluencer, payment_method: e.target.value })}
                        style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 13 }}>
                        <option value="bank_transfer">Bank Transfer (ACH)</option>
                        <option value="paypal">PayPal</option>
                        <option value="venmo">Venmo</option>
                        <option value="zelle">Zelle</option>
                        <option value="check">Check</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Tax ID (SSN/EIN)</label>
                      <input value={newInfluencer.tax_id} onChange={(e) => setNewInfluencer({ ...newInfluencer, tax_id: e.target.value })}
                        placeholder="XXX-XX-XXXX" style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 13 }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Payment Details</label>
                    <textarea value={newInfluencer.payment_details} onChange={(e) => setNewInfluencer({ ...newInfluencer, payment_details: e.target.value })}
                      placeholder="Account number, routing number, PayPal email, etc."
                      style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 13, minHeight: 80, resize: "vertical" }} />
                    <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 6 }}>⚠️ Store payment info securely - consider encrypting in production</div>
                  </div>
                </div>
              </div>

              {/* FTC Compliance */}
              <div style={{ marginBottom: 8, paddingTop: 20, borderTop: "1px solid " + COLORS.cardBorder }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: COLORS.neonOrange, marginBottom: 12, textTransform: "uppercase" }}>⚖️ FTC Compliance</h3>
                <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={newInfluencer.ftc_agreed}
                    onChange={(e) => setNewInfluencer({ ...newInfluencer, ftc_agreed: e.target.checked })}
                    style={{ marginTop: 2, width: 18, height: 18, accentColor: COLORS.neonOrange, flexShrink: 0 }}
                  />
                  <span style={{ fontSize: 13, color: COLORS.textPrimary, lineHeight: 1.5 }}>
                    Influencer has agreed to FTC disclosure requirements — they must clearly disclose their paid partnership with LetsGo in all promotional content (e.g., #ad, #sponsored, #LetsGoPartner).
                  </span>
                </label>
                {newInfluencer.ftc_agreed && (
                  <div style={{ marginTop: 8, fontSize: 11, color: COLORS.neonOrange }}>✅ FTC agreement will be timestamped at creation</div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 20, paddingTop: 20, borderTop: "1px solid " + COLORS.cardBorder }}>
              <button onClick={() => setShowCreateInfluencer(false)}
                style={{ padding: "12px 24px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, cursor: "pointer", fontWeight: 600 }}>Cancel</button>
              <button onClick={handleCreateInfluencer}
                style={{ padding: "12px 24px", background: COLORS.gradient2, border: "none", borderRadius: 10, color: "#000", cursor: "pointer", fontWeight: 700 }}>Create Influencer</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Influencer Details Modal */}
      {showEditInfluencer && selectedInfluencer && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, overflowY: "auto", padding: "40px 0" }} onClick={() => setShowEditInfluencer(false)}>
          <div style={{ background: COLORS.cardBg, borderRadius: 20, padding: 32, maxWidth: 800, width: "90%", border: "1px solid " + COLORS.cardBorder, margin: "auto" }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, background: COLORS.gradient2, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>✏️ Edit Influencer: {selectedInfluencer.name}</h2>

            <div style={{ maxHeight: "70vh", overflowY: "auto", paddingRight: 10 }}>
              {/* Basic Info */}
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: COLORS.neonGreen, marginBottom: 12, textTransform: "uppercase" }}>📋 Basic Information</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Full Name</label>
                    <input value={selectedInfluencer.name} onChange={(e) => setSelectedInfluencer({ ...selectedInfluencer, name: e.target.value })}
                      style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 14 }} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Code (Read-only)</label>
                      <input value={selectedInfluencer.code} disabled
                        style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textSecondary, fontSize: 14, fontWeight: 700, opacity: 0.6 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Total Signups (Read-only)</label>
                      <input value={selectedInfluencer.total_signups} disabled
                        style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.neonGreen, fontSize: 16, fontWeight: 700, opacity: 0.6 }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact Info */}
              <div style={{ marginBottom: 24, paddingTop: 20, borderTop: "1px solid " + COLORS.cardBorder }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: COLORS.neonBlue, marginBottom: 12, textTransform: "uppercase" }}>📞 Contact Information</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Email</label>
                      <input type="email" value={selectedInfluencer.email || ""} onChange={(e) => setSelectedInfluencer({ ...selectedInfluencer, email: e.target.value })}
                        style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 13 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Phone</label>
                      <input type="tel" value={selectedInfluencer.phone || ""} onChange={(e) => setSelectedInfluencer({ ...selectedInfluencer, phone: e.target.value })}
                        style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 13 }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Street Address</label>
                    <input value={selectedInfluencer.address_street || ""} onChange={(e) => setSelectedInfluencer({ ...selectedInfluencer, address_street: e.target.value })}
                      style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 13 }} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>City</label>
                      <input value={selectedInfluencer.address_city || ""} onChange={(e) => setSelectedInfluencer({ ...selectedInfluencer, address_city: e.target.value })}
                        style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 13 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>State</label>
                      <input value={selectedInfluencer.address_state || ""} onChange={(e) => setSelectedInfluencer({ ...selectedInfluencer, address_state: e.target.value })}
                        maxLength={2} style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 13, textTransform: "uppercase" }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>ZIP Code</label>
                      <input value={selectedInfluencer.address_zip || ""} onChange={(e) => setSelectedInfluencer({ ...selectedInfluencer, address_zip: e.target.value })}
                        style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 13 }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Social Media */}
              <div style={{ marginBottom: 24, paddingTop: 20, borderTop: "1px solid " + COLORS.cardBorder }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: COLORS.neonPink, marginBottom: 12, textTransform: "uppercase" }}>📱 Social Media Handles</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Instagram</label>
                    <input value={selectedInfluencer.instagram_handle || ""} onChange={(e) => setSelectedInfluencer({ ...selectedInfluencer, instagram_handle: e.target.value })}
                      style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 13 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>TikTok</label>
                    <input value={selectedInfluencer.tiktok_handle || ""} onChange={(e) => setSelectedInfluencer({ ...selectedInfluencer, tiktok_handle: e.target.value })}
                      style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 13 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>YouTube</label>
                    <input value={selectedInfluencer.youtube_handle || ""} onChange={(e) => setSelectedInfluencer({ ...selectedInfluencer, youtube_handle: e.target.value })}
                      style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 13 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Twitter/X</label>
                    <input value={selectedInfluencer.twitter_handle || ""} onChange={(e) => setSelectedInfluencer({ ...selectedInfluencer, twitter_handle: e.target.value })}
                      style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 13 }} />
                  </div>
                </div>
              </div>

              {/* Payment Info */}
              <div style={{ marginBottom: 24, paddingTop: 20, borderTop: "1px solid " + COLORS.cardBorder }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: COLORS.neonYellow, marginBottom: 12, textTransform: "uppercase" }}>💳 Payment Information</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Payment Method</label>
                      <select value={selectedInfluencer.payment_method || "bank_transfer"} onChange={(e) => setSelectedInfluencer({ ...selectedInfluencer, payment_method: e.target.value })}
                        style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 13 }}>
                        <option value="bank_transfer">Bank Transfer (ACH)</option>
                        <option value="paypal">PayPal</option>
                        <option value="venmo">Venmo</option>
                        <option value="zelle">Zelle</option>
                        <option value="check">Check</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Tax ID (SSN/EIN)</label>
                      <input value={selectedInfluencer.tax_id || ""} onChange={(e) => setSelectedInfluencer({ ...selectedInfluencer, tax_id: e.target.value })}
                        style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 13 }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Payment Details</label>
                    <textarea value={selectedInfluencer.payment_details || ""} onChange={(e) => setSelectedInfluencer({ ...selectedInfluencer, payment_details: e.target.value })}
                      style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 13, minHeight: 80, resize: "vertical" }} />
                  </div>
                </div>
              </div>

              {/* Linked User Account */}
              <div style={{ marginBottom: 24, paddingTop: 20, borderTop: "1px solid " + COLORS.cardBorder }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: COLORS.neonBlue, marginBottom: 12, textTransform: "uppercase" }}>🔗 Linked User Account</h3>
                <p style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 12 }}>
                  Link this influencer to a LetsGo user account so they can see their dashboard on the profile page.
                </p>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>User ID</label>
                    <input
                      value={selectedInfluencer.user_id || ""}
                      onChange={(e) => setSelectedInfluencer({ ...selectedInfluencer, user_id: e.target.value || null })}
                      placeholder="UUID — use lookup button to find by email"
                      style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 13, fontFamily: "monospace" }}
                    />
                  </div>
                  <button
                    onClick={async () => {
                      const email = prompt("Enter the user's email address to look up their account:");
                      if (!email) return;
                      const { data, error } = await supabaseBrowser
                        .from("profiles")
                        .select("id, full_name, first_name, last_name")
                        .ilike("email", email.trim())
                        .maybeSingle();
                      if (error || !data) {
                        // Fallback: try auth metadata via a broader profile search
                        const { data: byName } = await supabaseBrowser
                          .from("profiles")
                          .select("id, full_name, first_name, last_name, email")
                          .ilike("email", `%${email.trim()}%`)
                          .limit(5);
                        if (byName && byName.length > 0) {
                          const names = byName.map((p: Record<string, unknown>) => `${p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unknown"} (${p.email})`).join("\n");
                          const idx = prompt(`Found ${byName.length} possible match(es):\n${names}\n\nEnter the number (1-${byName.length}) to select:`);
                          if (idx) {
                            const selected = byName[parseInt(idx) - 1];
                            if (selected) {
                              setSelectedInfluencer({ ...selectedInfluencer, user_id: selected.id as string });
                              alert(`✅ Linked to ${selected.full_name || selected.first_name || "user"} (${selected.id})`);
                            }
                          }
                        } else {
                          alert("No user found with that email address.");
                        }
                        return;
                      }
                      const name = data.full_name || [data.first_name, data.last_name].filter(Boolean).join(" ") || "Unknown";
                      if (confirm(`Found user: ${name} (${data.id})\n\nLink this account?`)) {
                        setSelectedInfluencer({ ...selectedInfluencer, user_id: data.id });
                        alert(`✅ Linked to ${name}`);
                      }
                    }}
                    style={{ padding: "12px 16px", borderRadius: 10, border: "1px solid " + COLORS.neonBlue, background: "rgba(0,212,255,0.1)", color: COLORS.neonBlue, cursor: "pointer", fontWeight: 700, fontSize: 12, whiteSpace: "nowrap", flexShrink: 0 }}
                  >
                    🔍 Lookup by Email
                  </button>
                  {selectedInfluencer.user_id && (
                    <button
                      onClick={() => setSelectedInfluencer({ ...selectedInfluencer, user_id: null })}
                      style={{ padding: "12px 16px", borderRadius: 10, border: "1px solid " + COLORS.neonRed, background: "rgba(255,49,49,0.1)", color: COLORS.neonRed, cursor: "pointer", fontWeight: 700, fontSize: 12, whiteSpace: "nowrap", flexShrink: 0 }}
                    >
                      ✕ Unlink
                    </button>
                  )}
                </div>
                {selectedInfluencer.user_id && (
                  <div style={{ marginTop: 8, fontSize: 11, color: COLORS.neonGreen }}>✅ Linked to user: {selectedInfluencer.user_id}</div>
                )}
              </div>

              {/* FTC Compliance */}
              <div style={{ paddingTop: 20, borderTop: "1px solid " + COLORS.cardBorder }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: COLORS.neonOrange, marginBottom: 12, textTransform: "uppercase" }}>⚖️ FTC Compliance</h3>
                <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={selectedInfluencer.ftc_agreed || false}
                    onChange={(e) => setSelectedInfluencer({ ...selectedInfluencer, ftc_agreed: e.target.checked, ftc_agreed_at: e.target.checked ? (selectedInfluencer.ftc_agreed_at || new Date().toISOString()) : null })}
                    style={{ marginTop: 2, width: 18, height: 18, accentColor: COLORS.neonOrange, flexShrink: 0 }}
                  />
                  <span style={{ fontSize: 13, color: COLORS.textPrimary, lineHeight: 1.5 }}>
                    Influencer has agreed to FTC disclosure requirements (must disclose paid partnerships in all content).
                  </span>
                </label>
                {selectedInfluencer.ftc_agreed && selectedInfluencer.ftc_agreed_at && (
                  <div style={{ marginTop: 8, fontSize: 11, color: COLORS.neonOrange }}>✅ Agreed on {formatDate(selectedInfluencer.ftc_agreed_at)}</div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 20, paddingTop: 20, borderTop: "1px solid " + COLORS.cardBorder }}>
              <button onClick={() => setShowEditInfluencer(false)}
                style={{ padding: "12px 24px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, cursor: "pointer", fontWeight: 600 }}>Cancel</button>
              <button onClick={handleEditInfluencer}
                style={{ padding: "12px 24px", background: COLORS.gradient2, border: "none", borderRadius: 10, color: "#000", cursor: "pointer", fontWeight: 700 }}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Tiers Modal */}
      {showEditTiers && selectedInfluencer && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, overflow: "auto" }} onClick={() => setShowEditTiers(false)}>
          <div style={{ background: COLORS.cardBg, borderRadius: 20, padding: 32, maxWidth: 700, width: "95%", border: "1px solid " + COLORS.cardBorder, margin: "20px auto" }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>📊 Edit Rate Tiers: {selectedInfluencer.name}</h2>
            <div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 20 }}>
              Each signup earns the rate of the tier it falls into (tax-bracket style)
            </div>

            {/* Tier rows header */}
            <div style={{ display: "grid", gridTemplateColumns: "36px 1fr 1fr 1fr 1fr 36px", gap: 8, marginBottom: 8, padding: "0 4px" }}>
              <div style={{ fontSize: 10, color: COLORS.textSecondary, fontWeight: 600 }}>#</div>
              <div style={{ fontSize: 10, color: COLORS.textSecondary, fontWeight: 600 }}>FROM</div>
              <div style={{ fontSize: 10, color: COLORS.textSecondary, fontWeight: 600 }}>TO</div>
              <div style={{ fontSize: 10, color: COLORS.textSecondary, fontWeight: 600 }}>$/SIGNUP</div>
              <div style={{ fontSize: 10, color: COLORS.textSecondary, fontWeight: 600 }}>LABEL</div>
              <div />
            </div>

            {/* Tier rows */}
            {editTiers.map((tier, idx) => (
              <div key={idx} style={{ display: "grid", gridTemplateColumns: "36px 1fr 1fr 1fr 1fr 36px", gap: 8, alignItems: "center", marginBottom: 8, padding: "8px 4px", background: COLORS.darkBg, borderRadius: 8 }}>
                <div style={{ fontWeight: 700, color: COLORS.neonBlue, fontSize: 14, textAlign: "center" }}>{idx + 1}</div>
                <input type="number" min={1} value={tier.min_signups}
                  onChange={e => {
                    const updated = [...editTiers];
                    updated[idx] = { ...updated[idx], min_signups: Math.max(1, parseInt(e.target.value) || 1) };
                    setEditTiers(updated);
                  }}
                  style={{ padding: 8, background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 6, color: COLORS.textPrimary, fontSize: 13, width: "100%" }}
                />
                {tier.max_signups === null ? (
                  <div style={{ padding: 8, background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 6, color: COLORS.neonGreen, fontSize: 12, fontWeight: 600 }}>Unlimited</div>
                ) : (
                  <input type="number" min={tier.min_signups} value={tier.max_signups}
                    onChange={e => {
                      const updated = [...editTiers];
                      updated[idx] = { ...updated[idx], max_signups: parseInt(e.target.value) || tier.min_signups };
                      setEditTiers(updated);
                    }}
                    style={{ padding: 8, background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 6, color: COLORS.textPrimary, fontSize: 13, width: "100%" }}
                  />
                )}
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: COLORS.neonYellow, fontWeight: 700, fontSize: 13 }}>$</span>
                  <input type="number" min={0} step={0.01} value={(tier.rate_cents / 100).toFixed(2)}
                    onChange={e => {
                      const updated = [...editTiers];
                      updated[idx] = { ...updated[idx], rate_cents: Math.round(parseFloat(e.target.value || "0") * 100) };
                      setEditTiers(updated);
                    }}
                    style={{ padding: 8, paddingLeft: 22, background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 6, color: COLORS.neonYellow, fontSize: 13, fontWeight: 600, width: "100%" }}
                  />
                </div>
                <input type="text" value={tier.label || ""} placeholder="Label"
                  onChange={e => {
                    const updated = [...editTiers];
                    updated[idx] = { ...updated[idx], label: e.target.value };
                    setEditTiers(updated);
                  }}
                  style={{ padding: 8, background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 6, color: COLORS.textPrimary, fontSize: 13, width: "100%" }}
                />
                {editTiers.length > 1 && (
                  <button onClick={() => {
                    const updated = editTiers.filter((_, i) => i !== idx);
                    if (idx === editTiers.length - 1 && updated.length > 0) {
                      updated[updated.length - 1] = { ...updated[updated.length - 1], max_signups: null };
                    }
                    setEditTiers(updated.map((t, i) => ({ ...t, tier_index: i + 1 })));
                  }}
                    style={{ padding: 4, background: "rgba(255,49,49,0.15)", border: "1px solid rgba(255,49,49,0.3)", borderRadius: 6, color: COLORS.neonRed, cursor: "pointer", fontSize: 14 }}
                    title="Remove tier">×</button>
                )}
              </div>
            ))}

            {/* Add Tier + Reset to Defaults */}
            <div style={{ display: "flex", gap: 12, marginTop: 8, marginBottom: 16 }}>
              <button onClick={() => {
                const last = editTiers[editTiers.length - 1];
                const newMin = last ? (last.max_signups ?? last.min_signups) + 1 : 1;
                const updatedTiers = editTiers.map((t, i) => {
                  if (i === editTiers.length - 1 && t.max_signups === null) return { ...t, max_signups: newMin - 1 };
                  return t;
                });
                setEditTiers([...updatedTiers, {
                  tier_index: editTiers.length + 1, min_signups: newMin, max_signups: null,
                  rate_cents: last ? Math.max(last.rate_cents - 500, 100) : 3000, label: `Tier ${editTiers.length + 1}`,
                }]);
              }}
                style={{ padding: "8px 16px", background: "rgba(0,212,255,0.12)", border: "1px dashed " + COLORS.neonBlue, borderRadius: 8, color: COLORS.neonBlue, cursor: "pointer", fontWeight: 600, fontSize: 12 }}>
                + Add Tier
              </button>
              {defaultInfluencerTiers.length > 0 && (
                <button onClick={() => setEditTiers([...defaultInfluencerTiers])}
                  style={{ padding: "8px 16px", background: "rgba(191,95,255,0.12)", border: "1px dashed " + COLORS.neonPurple, borderRadius: 8, color: COLORS.neonPurple, cursor: "pointer", fontWeight: 600, fontSize: 12 }}>
                  Reset to Defaults
                </button>
              )}
            </div>

            {/* Reason */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Reason for Tier Change *</label>
              <textarea value={editTiersReason} onChange={e => setEditTiersReason(e.target.value)}
                placeholder="e.g., Performance review, contract renegotiation..."
                style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 13, minHeight: 70, resize: "vertical" }} />
              <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 6 }}>This change will be logged in the influencer&apos;s notes for audit purposes</div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button onClick={() => setShowEditTiers(false)}
                style={{ padding: "12px 24px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, cursor: "pointer", fontWeight: 600 }}>Cancel</button>
              <button onClick={handleSaveTiers}
                style={{ padding: "12px 24px", background: COLORS.neonOrange, border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontWeight: 700 }}>Save Tier Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Limited-Time Bonus Modal */}
      {showCreateBonus && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setShowCreateBonus(false)}>
          <div style={{ background: COLORS.cardBg, borderRadius: 20, padding: 32, maxWidth: 480, width: "90%", border: "1px solid " + COLORS.cardBorder }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>🎁 Create Limited-Time Bonus</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Bonus Name</label>
                <input value={newBonus.label} onChange={(e) => setNewBonus({ ...newBonus, label: e.target.value })}
                  placeholder="e.g. Holiday Double Bonus" style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 14 }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Type</label>
                  <select value={newBonus.type} onChange={(e) => setNewBonus({ ...newBonus, type: e.target.value })}
                    style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 13 }}>
                    <option value="user">User Referral</option>
                    <option value="business">Business Referral</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Bonus Amount ($)</label>
                  <input type="number" value={newBonus.amount_cents / 100} onChange={(e) => setNewBonus({ ...newBonus, amount_cents: Math.round(parseFloat(e.target.value) * 100) || 0 })}
                    style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.neonGreen, fontSize: 16, fontWeight: 700 }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Description</label>
                <input value={newBonus.description} onChange={(e) => setNewBonus({ ...newBonus, description: e.target.value })}
                  placeholder="e.g. Double bonus for all referrals this month" style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 13 }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Expires (optional)</label>
                <input type="date" value={newBonus.expires_at} onChange={(e) => setNewBonus({ ...newBonus, expires_at: e.target.value })}
                  style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 13 }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => setShowCreateBonus(false)}
                style={{ padding: "12px 24px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, cursor: "pointer", fontWeight: 600 }}>Cancel</button>
              <button onClick={handleCreateLimitedBonus}
                style={{ padding: "12px 24px", background: COLORS.neonRed, border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontWeight: 700 }}>Create Bonus</button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Attribution Modal */}
      {showAttributionModal && (() => {
        const inf = influencers.find(i => i.id === attributionInfluencerId);
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setShowAttributionModal(false)}>
            <div style={{ background: COLORS.cardBg, borderRadius: 20, padding: 32, maxWidth: 500, width: "90%", border: "1px solid " + COLORS.cardBorder }} onClick={(e) => e.stopPropagation()}>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, background: COLORS.gradient2, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>+ Add Signup</h2>
              <p style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 20 }}>
                Attribute a user to <span style={{ color: COLORS.neonOrange, fontWeight: 700 }}>{inf?.name}</span> ({inf?.code})
              </p>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Search by name or email</label>
                <input
                  autoFocus
                  type="text"
                  value={attributionSearch}
                  onChange={(e) => handleAttributionSearch(e.target.value)}
                  placeholder="Start typing a name or email..."
                  style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid " + COLORS.neonOrange, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 14 }}
                />
              </div>
              <div style={{ maxHeight: 300, overflowY: "auto" }}>
                {attributionSearching && (
                  <div style={{ padding: "12px 0", textAlign: "center", color: COLORS.textSecondary, fontSize: 13 }}>Searching...</div>
                )}
                {!attributionSearching && attributionSearch.trim().length >= 2 && attributionResults.length === 0 && (
                  <div style={{ padding: "12px 0", textAlign: "center", color: COLORS.textSecondary, fontSize: 13 }}>No users found</div>
                )}
                {attributionResults.map(user => (
                  <div
                    key={user.id}
                    onClick={() => handleAttributeUser(user.id, user.name, user.email)}
                    style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "12px 14px", borderRadius: 10, marginBottom: 6, cursor: "pointer",
                      border: "1px solid " + COLORS.cardBorder, background: "rgba(255,255,255,0.02)",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = COLORS.neonOrange; e.currentTarget.style.background = "rgba(255,107,53,0.08)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = COLORS.cardBorder; e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
                  >
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.textPrimary }}>{user.name}</div>
                      <div style={{ fontSize: 11, color: COLORS.textSecondary }}>{user.email}</div>
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.neonOrange, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      + Attribute
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                <button onClick={() => setShowAttributionModal(false)}
                  style={{ padding: "10px 20px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, cursor: "pointer", fontWeight: 600 }}>Cancel</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, background: COLORS.gradient1, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 20 }}>
          🤝 Referrals & Influencers
        </h1>

        {/* Tab Toggle */}
        <div style={{ display: "flex", gap: 8, padding: 4, background: COLORS.darkBg, borderRadius: 12, width: "fit-content" }}>
          <button
            onClick={() => setActiveTab("influencers")}
            style={{
              padding: "12px 32px",
              borderRadius: 10,
              border: "none",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 700,
              background: activeTab === "influencers" ? COLORS.gradient2 : "transparent",
              color: activeTab === "influencers" ? "#000" : COLORS.textSecondary,
              transition: "all 0.3s",
            }}
          >
            🌟 Influencers
          </button>
          <button
            onClick={() => setActiveTab("referrals")}
            style={{
              padding: "12px 32px",
              borderRadius: 10,
              border: "none",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 700,
              background: activeTab === "referrals" ? COLORS.gradient1 : "transparent",
              color: activeTab === "referrals" ? "#fff" : COLORS.textSecondary,
              transition: "all 0.3s",
            }}
          >
            🤝 Referrals
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: COLORS.textSecondary }}>Loading data...</div>
      ) : (
        <>
          {/* ==================== INFLUENCER TAB ==================== */}
          {activeTab === "influencers" && (
            <>
              {/* Date Range Selector */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: COLORS.textSecondary, fontWeight: 600, marginRight: 4 }}>Showing:</span>
                {[
                  { label: "Last 7 Days",  value: "7" },
                  { label: "Last 30 Days", value: "30" },
                  { label: "Last 90 Days", value: "90" },
                  { label: "Last 6 Mo",    value: "180" },
                  { label: "Last Year",    value: "365" },
                  { label: "All Time",     value: "all" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setInfluencerDateRange(opt.value)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 8,
                      border: "1px solid " + (influencerDateRange === opt.value ? COLORS.neonGreen : COLORS.cardBorder),
                      background: influencerDateRange === opt.value ? "rgba(57,255,20,0.12)" : "transparent",
                      color: influencerDateRange === opt.value ? COLORS.neonGreen : COLORS.textSecondary,
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: influencerDateRange === opt.value ? 700 : 400,
                      transition: "all 0.2s",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Influencer Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, marginBottom: 32 }}>
                <StatCard icon="🌟" value={newInfluencers.length.toString()} label={influencerDateRange === "all" ? "Total Influencers" : "New Influencers"} gradient={COLORS.gradient2} />
                <StatCard icon="✅" value={activeInfluencers.toString()} label="Active (All Time)" gradient={COLORS.gradient1} />
                <StatCard icon="👥" value={totalInfluencerSignups.toLocaleString()} label="Total Signups (All Time)" gradient={COLORS.gradient3} />
                <StatCard icon="💰" value={formatMoney(periodPaidAmount)} label={influencerDateRange === "all" ? "Total Paid Out" : "Paid Out (Period)"} gradient={COLORS.gradient4} />
                <StatCard icon="⏳" value={formatMoney(pendingPayoutAmount)} label="Pending (All Time)" gradient={COLORS.gradient1} />
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: 12, marginBottom: 32 }}>
                <button onClick={() => setShowCreateInfluencer(true)}
                  style={{ padding: "12px 24px", background: COLORS.gradient2, border: "none", borderRadius: 10, color: "#000", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                  + Add Influencer
                </button>
              </div>
            </>
          )}

          {/* ==================== REFERRALS TAB ==================== */}
          {activeTab === "referrals" && (
            <>
              {/* Action Buttons */}
              <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
                <button onClick={() => setShowCreateCode(true)}
                  style={{ padding: "12px 24px", background: COLORS.neonRed, border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                  + Create Referral Code
                </button>
                <button onClick={handleDownloadCSV}
                  style={{ padding: "12px 16px", background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, cursor: "pointer", fontWeight: 600, fontSize: 12 }}>
                  📥 CSV
                </button>
              </div>

              {/* Date Range Filter */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: COLORS.textSecondary, fontWeight: 600, marginRight: 4 }}>Showing:</span>
                {[
                  { label: "Last 7 Days",  value: "7" },
                  { label: "Last 30 Days", value: "30" },
                  { label: "Last 90 Days", value: "90" },
                  { label: "Last 6 Mo",    value: "180" },
                  { label: "Last Year",    value: "365" },
                  { label: "All Time",     value: "all" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setReferralDateRange(opt.value)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 8,
                      border: "1px solid " + (referralDateRange === opt.value ? COLORS.neonBlue : COLORS.cardBorder),
                      background: referralDateRange === opt.value ? "rgba(0,212,255,0.15)" : "transparent",
                      color: referralDateRange === opt.value ? COLORS.neonBlue : COLORS.textSecondary,
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: referralDateRange === opt.value ? 700 : 400,
                      transition: "all 0.2s",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
                {referralDateRange !== "all" && (
                  <span style={{ fontSize: 11, color: COLORS.textSecondary, marginLeft: 4 }}>
                    — {totalReferrals} of {referrals.length} referrals
                  </span>
                )}
              </div>

              {/* Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, marginBottom: 32 }}>
            <StatCard icon="🤝" value={totalReferrals.toString()} label="Total Referrals" gradient={COLORS.gradient1} />
            <StatCard icon="✅" value={converted.toString()} label="Converted" gradient={COLORS.gradient2} />
            <StatCard icon="📊" value={conversionRate + "%"} label="Conversion Rate" gradient={COLORS.gradient3} />
            <StatCard icon="💰" value={formatMoney(bonusesPaid)} label="Bonuses Paid" gradient={COLORS.gradient4} />
            <StatCard icon="🏢" value={businessesReferred.toString()} label="Businesses Referred" gradient={COLORS.gradient1} />
          </div>

          {/* Referral Bonus Structure */}
          <SectionTitle icon="💵">Referral Bonus Structure</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20, marginBottom: 16 }}>
            {bonusConfig.map((bc) => (
              <div
                key={bc.id}
                style={{
                  padding: 28,
                  borderRadius: 16,
                  border: "2px solid " + (bonusColors[bc.type] || COLORS.neonBlue),
                  background: COLORS.cardBg,
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 40, marginBottom: 8 }}>{bonusIcons[bc.type] || "🎁"}</div>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>{bc.label}</div>
                {editingBonuses ? (
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 18, fontWeight: 700, color: bonusColors[bc.type] }}>$</span>
                    <input
                      type="number"
                      value={(editBonusValues[bc.id] !== undefined ? editBonusValues[bc.id] : bc.amount_cents) / 100}
                      onChange={(e) => setEditBonusValues({ ...editBonusValues, [bc.id]: Math.round(parseFloat(e.target.value) * 100) || 0 })}
                      style={{
                        width: 80,
                        padding: 6,
                        borderRadius: 6,
                        border: "1px solid " + COLORS.cardBorder,
                        background: COLORS.darkBg,
                        color: bonusColors[bc.type],
                        fontSize: 28,
                        fontWeight: 800,
                        textAlign: "center",
                      }}
                    />
                  </div>
                ) : (
                  <div style={{ fontSize: 36, fontWeight: 800, color: bonusColors[bc.type], marginBottom: 8 }}>
                    {formatMoney(bc.amount_cents)}
                  </div>
                )}
                <div style={{ fontSize: 12, color: COLORS.textSecondary }}>{bc.description}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 12, marginBottom: 32 }}>
            {editingBonuses ? (
              <>
                <button onClick={handleSaveBonusConfig}
                  style={{ padding: "12px 24px", background: COLORS.gradient2, border: "none", borderRadius: 10, color: "#000", cursor: "pointer", fontWeight: 700 }}>
                  💾 Save Bonus Amounts
                </button>
                <button onClick={() => { setEditingBonuses(false); setEditBonusValues({}); }}
                  style={{ padding: "12px 24px", background: COLORS.darkBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, cursor: "pointer", fontWeight: 600 }}>
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setEditingBonuses(true)}
                  style={{ padding: "12px 24px", background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 10, color: COLORS.textPrimary, cursor: "pointer", fontWeight: 600 }}>
                  Edit Bonus Amounts
                </button>
                <button onClick={() => setShowCreateBonus(!showCreateBonus)}
                  style={{ padding: "12px 24px", background: COLORS.neonRed, border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontWeight: 700 }}>
                  + Create Limited-Time Bonus
                </button>
              </>
            )}
          </div>

          {/* Referral Sources */}
          <SectionTitle icon="📊">Referral Sources</SectionTitle>
          <Card style={{ marginBottom: 32 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
              {/* Bar Chart */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: COLORS.textSecondary, marginBottom: 16 }}>Businesses by Referral Source</div>
                {sourceCategories.map((cat) => (
                  <HorizontalBar key={cat} label={cat} value={sourceCounts[cat] || 0} max={maxSourceCount} />
                ))}
              </div>
              {/* Pie Chart */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: COLORS.textSecondary, marginBottom: 16 }}>Revenue by Source</div>
                <PieChart
                  data={sourceCategories.map((cat, i) => ({
                    label: cat,
                    value: sourceRevenue[cat] || 0,
                    color: PIE_COLORS[i % PIE_COLORS.length],
                  }))}
                />
              </div>
            </div>
          </Card>

          {/* Top Referrers */}
          <SectionTitle icon="🏆">Top Referrers</SectionTitle>
          <Card style={{ marginBottom: 32 }}>
            {topReferrers.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🏆</div>
                No referrers yet
              </div>
            ) : (
              <DataTable
                columns={[
                  {
                    key: "name",
                    label: "Referrer",
                    render: (v, row) => {
                      const r = row as unknown as TopReferrer;
                      return (
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <Avatar name={r.name} />
                          <div>
                            <div style={{ fontWeight: 600 }}>{r.name}</div>
                            <div style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "capitalize" }}>{r.type.replace("_", " ")}</div>
                          </div>
                        </div>
                      );
                    },
                  },
                  {
                    key: "type",
                    label: "Type",
                    render: (v) => {
                      const colors: Record<string, string> = { business: COLORS.neonBlue, user: COLORS.neonPurple };
                      return (
                        <span style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: colors[String(v)] || COLORS.neonPurple, color: "#fff" }}>
                          {String(v).replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                        </span>
                      );
                    },
                  },
                  {
                    key: "referrals",
                    label: "Referrals",
                    align: "center",
                    render: (v) => <span style={{ fontWeight: 700, fontSize: 16 }}>{Number(v)}</span>,
                  },
                  {
                    key: "converted",
                    label: "Converted",
                    align: "center",
                    render: (v, row) => {
                      const r = row as unknown as TopReferrer;
                      return (
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontWeight: 700, color: COLORS.neonGreen }}>{Number(v)}</div>
                          <div style={{ fontSize: 10, color: COLORS.textSecondary }}>{r.conversionRate}%</div>
                        </div>
                      );
                    },
                  },
                  {
                    key: "bonusEarned",
                    label: "Bonus Earned",
                    align: "right",
                    render: (v) => <span style={{ fontWeight: 700, color: COLORS.neonGreen }}>{formatMoney(Number(v))}</span>,
                  },
                  {
                    key: "active",
                    label: "Status",
                    render: (v) => <Badge status={v ? "active" : "inactive"} />,
                  },
                  {
                    key: "id",
                    label: "",
                    align: "right",
                    render: (v) => (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button style={{ padding: "5px 10px", background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 6, color: COLORS.textPrimary, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                          View
                        </button>
                        <button
                          onClick={() => handlePayBonus(String(v))}
                          style={{ padding: "5px 10px", background: COLORS.neonRed, border: "none", borderRadius: 6, color: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 700 }}
                        >
                          Pay Bonus
                        </button>
                      </div>
                    ),
                  },
                ]}
                data={topReferrers as unknown as Record<string, unknown>[]}
              />
            )}
          </Card>

          {/* Monthly Referral Trend */}
          <SectionTitle icon="📈">Monthly Referral Trend</SectionTitle>
          <Card style={{ marginBottom: 32 }}>
            {monthlyData.every((d) => d.referrals === 0) ? (
              <div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>📈</div>
                No monthly data yet — referrals will appear here as they come in
              </div>
            ) : (
              <BarLineChart data={monthlyData} />
            )}
          </Card>

          {/* Active Referral Codes */}
          {referralCodes.length > 0 && (
            <>
              <SectionTitle icon="🔗">Active Referral Codes</SectionTitle>
              <Card style={{ marginBottom: 32 }}>
                <DataTable
                  columns={[
                    {
                      key: "code",
                      label: "Code",
                      render: (v) => <span style={{ fontFamily: "monospace", fontWeight: 700, color: COLORS.neonPink, fontSize: 14 }}>{String(v)}</span>,
                    },
                    {
                      key: "type",
                      label: "Type",
                      render: (v) => <Badge status={String(v).replace("_", " ")} />,
                    },
                    {
                      key: "owner_name",
                      label: "Owner",
                      render: (v) => <span>{String(v || "—")}</span>,
                    },
                    {
                      key: "bonus_cents",
                      label: "Bonus",
                      render: (v) => <span style={{ fontWeight: 700, color: COLORS.neonGreen }}>{formatMoney(Number(v))}</span>,
                    },
                    {
                      key: "uses",
                      label: "Uses",
                      align: "center",
                      render: (v, row) => {
                        const code = row as unknown as ReferralCode;
                        return <span>{Number(v)}{code.max_uses ? ` / ${code.max_uses}` : ""}</span>;
                      },
                    },
                    {
                      key: "active",
                      label: "Status",
                      render: (v) => <Badge status={v ? "active" : "inactive"} />,
                    },
                    {
                      key: "id",
                      label: "",
                      align: "right",
                      render: (v, row) => {
                        const code = row as unknown as ReferralCode;
                        return (
                          <button
                            onClick={() => handleToggleCode(code.id, code.active)}
                            style={{
                              padding: "5px 12px",
                              background: code.active ? "rgba(255,49,49,0.2)" : "rgba(57,255,20,0.2)",
                              border: "1px solid " + (code.active ? COLORS.neonRed : COLORS.neonGreen),
                              borderRadius: 6,
                              color: code.active ? COLORS.neonRed : COLORS.neonGreen,
                              cursor: "pointer", fontSize: 11, fontWeight: 600,
                            }}
                          >
                            {code.active ? "Deactivate" : "Activate"}
                          </button>
                        );
                      },
                    },
                  ]}
                  data={referralCodes as unknown as Record<string, unknown>[]}
                />
              </Card>
            </>
          )}
            </>
          )}

          {/* ==================== INFLUENCER TAB CONTENT ==================== */}
          {activeTab === "influencers" && (
            <>
            {/* Top Performers Chart */}
            {topInfluencers.length > 0 && (
              <>
                <SectionTitle icon="🏆">Top Performers (by Signups)</SectionTitle>
                <Card style={{ marginBottom: 32 }}>
                  <div style={{ padding: "20px 0" }}>
                    {topInfluencers.map((inf, idx) => (
                      <div key={inf.id} style={{ marginBottom: 16 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                          <div style={{ width: 32, height: 32, borderRadius: "50%", background: COLORS.gradient2, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, color: "#000" }}>
                            #{idx + 1}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>{inf.name}</div>
                            <div style={{ fontSize: 11, color: COLORS.textSecondary, fontFamily: "monospace" }}>{inf.code}</div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontWeight: 700, fontSize: 18, color: COLORS.neonGreen }}>{inf.total_signups}</div>
                            <div style={{ fontSize: 10, color: COLORS.textSecondary }}>signups</div>
                          </div>
                        </div>
                        <div style={{ height: 8, background: COLORS.darkBg, borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ width: `${(inf.total_signups / maxInfluencerSignups) * 100}%`, height: "100%", background: COLORS.gradient2, borderRadius: 4, transition: "width 0.5s" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </>
            )}

            {/* Influencer Table */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <SectionTitle icon="👥">All Influencers</SectionTitle>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  style={{ padding: "7px 14px", background: activeFiltersCount > 0 ? "rgba(0,212,255,0.2)" : "rgba(255,255,255,0.05)", border: "1px solid " + (activeFiltersCount > 0 ? COLORS.neonBlue : COLORS.cardBorder), borderRadius: 8, color: activeFiltersCount > 0 ? COLORS.neonBlue : COLORS.textSecondary, cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                >
                  🔍 Filters {activeFiltersCount > 0 && <span style={{ background: COLORS.neonBlue, color: "#000", borderRadius: "50%", padding: "0 5px", marginLeft: 4, fontSize: 10 }}>{activeFiltersCount}</span>}
                </button>
                <button
                  onClick={handleFullCSVExport}
                  style={{ padding: "7px 14px", background: "rgba(57,255,20,0.1)", border: "1px solid " + COLORS.neonGreen, borderRadius: 8, color: COLORS.neonGreen, cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                >
                  📥 Export All CSV
                </button>
              </div>
            </div>

            {/* Filter Panel */}
            {showFilters && (
              <Card style={{ marginBottom: 16, padding: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 2fr", gap: 10, alignItems: "end", marginBottom: 10 }}>
                  <div>
                    <label style={{ fontSize: 10, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Status</label>
                    <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 12 }}>
                      <option value="all">All Statuses</option>
                      <option value="active">Active</option>
                      <option value="paused">Paused</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Tier</label>
                    <select value={filterTier} onChange={(e) => setFilterTier(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 12 }}>
                      <option value="all">All Tiers</option>
                      <option value="seed">🌱 Seed (0+)</option>
                      <option value="sprout">🌿 Sprout (250+)</option>
                      <option value="bronze">🥉 Bronze (1K+)</option>
                      <option value="silver">🥈 Silver (2.5K+)</option>
                      <option value="gold">🥇 Gold (5K+)</option>
                      <option value="platinum">💎 Platinum (10K+)</option>
                      <option value="sapphire">💙 Sapphire (20K+)</option>
                      <option value="emerald">💚 Emerald (35K+)</option>
                      <option value="ruby">❤️‍🔥 Ruby (50K+)</option>
                      <option value="amethyst">💜 Amethyst (75K+)</option>
                      <option value="diamond">💠 Diamond (100K+)</option>
                      <option value="obsidian">🔮 Obsidian (150K+)</option>
                      <option value="elite">🏆 Elite (250K+)</option>
                      <option value="legend">👑 Legend (350K+)</option>
                      <option value="icon">⚡ Icon (500K+)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Platform</label>
                    <select value={filterPlatform} onChange={(e) => setFilterPlatform(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 12 }}>
                      <option value="all">All Platforms</option>
                      <option value="instagram">Instagram</option>
                      <option value="tiktok">TikTok</option>
                      <option value="youtube">YouTube</option>
                      <option value="twitter">Twitter/X</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Payment</label>
                    <select value={filterPayment} onChange={(e) => setFilterPayment(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 12 }}>
                      <option value="all">All Methods</option>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="paypal">PayPal</option>
                      <option value="venmo">Venmo</option>
                      <option value="zelle">Zelle</option>
                      <option value="check">Check</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Search</label>
                    <input
                      value={filterSearch}
                      onChange={(e) => setFilterSearch(e.target.value)}
                      placeholder="Name, code, or email..."
                      style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid " + COLORS.cardBorder, background: COLORS.darkBg, color: COLORS.textPrimary, fontSize: 12 }}
                    />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 3fr", gap: 10, alignItems: "end" }}>
                  <div>
                    <label style={{ fontSize: 10, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Outstanding Balance</label>
                    <select value={filterOutstanding} onChange={(e) => setFilterOutstanding(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid " + (filterOutstanding !== "all" ? COLORS.neonOrange : COLORS.cardBorder), background: COLORS.darkBg, color: filterOutstanding !== "all" ? COLORS.neonOrange : COLORS.textPrimary, fontSize: 12, fontWeight: filterOutstanding !== "all" ? 700 : 400 }}>
                      <option value="all">All</option>
                      <option value="has_outstanding">Has Outstanding Balance</option>
                      <option value="paid_up">Fully Paid Up</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: COLORS.textSecondary, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Bonus Status</label>
                    <select value={filterBonus} onChange={(e) => setFilterBonus(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid " + (filterBonus !== "all" ? COLORS.neonPurple : COLORS.cardBorder), background: COLORS.darkBg, color: filterBonus !== "all" ? COLORS.neonPurple : COLORS.textPrimary, fontSize: 12, fontWeight: filterBonus !== "all" ? 700 : 400 }}>
                      <option value="all">All</option>
                      <option value="has_unpaid">Has Unpaid Bonuses</option>
                      <option value="no_unpaid">No Unpaid Bonuses</option>
                    </select>
                  </div>
                  <div />
                </div>
                {activeFiltersCount > 0 && (
                  <button
                    onClick={() => { setFilterStatus("all"); setFilterTier("all"); setFilterPayment("all"); setFilterPlatform("all"); setFilterSearch(""); setFilterOutstanding("all"); setFilterBonus("all"); }}
                    style={{ marginTop: 10, padding: "5px 12px", background: "none", border: "1px solid " + COLORS.cardBorder, borderRadius: 6, color: COLORS.textSecondary, cursor: "pointer", fontSize: 11 }}
                  >
                    × Clear Filters
                  </button>
                )}
              </Card>
            )}

            {/* Bulk Action Bar */}
            {bulkSelected.size > 0 && (
              <div style={{ marginBottom: 12, padding: "12px 16px", background: "rgba(0,212,255,0.08)", border: "1px solid " + COLORS.neonBlue, borderRadius: 10, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, color: COLORS.neonBlue, fontWeight: 700 }}>{bulkSelected.size} selected</span>
                <button onClick={() => setShowBulkTierResetModal(true)} style={{ padding: "5px 12px", background: "rgba(255,255,0,0.15)", border: "1px solid " + COLORS.neonYellow, borderRadius: 6, color: COLORS.neonYellow, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>📊 Reset Tiers to Defaults</button>
                <button onClick={() => handleBulkStatusToggle("active")} style={{ padding: "5px 12px", background: "rgba(57,255,20,0.15)", border: "1px solid " + COLORS.neonGreen, borderRadius: 6, color: COLORS.neonGreen, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>▶️ Activate All</button>
                <button onClick={() => handleBulkStatusToggle("paused")} style={{ padding: "5px 12px", background: "rgba(255,255,0,0.15)", border: "1px solid " + COLORS.neonYellow, borderRadius: 6, color: COLORS.neonYellow, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>⏸️ Pause All</button>
                <button onClick={handleBulkCSVExport} style={{ padding: "5px 12px", background: "rgba(57,255,20,0.15)", border: "1px solid " + COLORS.neonGreen, borderRadius: 6, color: COLORS.neonGreen, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>📥 Export Selected</button>
                <button onClick={() => setBulkSelected(new Set())} style={{ padding: "5px 12px", background: "none", border: "1px solid " + COLORS.cardBorder, borderRadius: 6, color: COLORS.textSecondary, cursor: "pointer", fontSize: 11 }}>× Clear</button>
              </div>
            )}

            <Card style={{ marginBottom: 32 }}>
              {influencers.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🌟</div>
                  <div style={{ fontSize: 16, marginBottom: 8 }}>No influencers yet</div>
                  <div style={{ fontSize: 13 }}>Click "Add Influencer" to create your first influencer partnership</div>
                </div>
              ) : filteredInfluencers.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center", color: COLORS.textSecondary }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
                  <div style={{ fontSize: 15 }}>No influencers match your filters</div>
                </div>
              ) : (
                <>
                  {/* Select All row */}
                  <div style={{ padding: "10px 16px", borderBottom: "1px solid " + COLORS.cardBorder, display: "flex", alignItems: "center", gap: 10 }}>
                    <input
                      type="checkbox"
                      checked={bulkSelected.size === filteredInfluencers.length && filteredInfluencers.length > 0}
                      onChange={toggleSelectAll}
                      style={{ width: 16, height: 16, accentColor: COLORS.neonBlue, cursor: "pointer" }}
                    />
                    <span style={{ fontSize: 11, color: COLORS.textSecondary }}>
                      {bulkSelected.size === filteredInfluencers.length && filteredInfluencers.length > 0 ? "Deselect All" : "Select All"} ({filteredInfluencers.length} shown)
                    </span>
                  </div>
                  <DataTable
                    columns={[
                      {
                        key: "id",
                        label: "",
                        render: (v) => (
                          <input
                            type="checkbox"
                            checked={bulkSelected.has(String(v))}
                            onChange={() => toggleBulkSelect(String(v))}
                            style={{ width: 16, height: 16, accentColor: COLORS.neonBlue, cursor: "pointer" }}
                          />
                        ),
                      },
                      {
                        key: "name",
                        label: "Influencer",
                        render: (v, row) => {
                          const inf = row as unknown as Influencer;
                          const tier = TIER_CONFIG[getInfluencerTier(inf.total_signups)];
                          const socialHandles = [inf.instagram_handle, inf.tiktok_handle, inf.youtube_handle, inf.twitter_handle].filter(Boolean);
                          return (
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                                <div style={{ fontWeight: 600, fontSize: 14 }}>{inf.name}</div>
                                <span style={{ fontSize: 11, padding: "1px 7px", borderRadius: 10, background: `${tier.color}22`, border: `1px solid ${tier.color}`, color: tier.color, fontWeight: 700, whiteSpace: "nowrap" }}>
                                  {tier.icon} {tier.label}
                                </span>
                                {inf.ftc_agreed && <span style={{ fontSize: 10, color: COLORS.neonOrange }} title="FTC Compliant">⚖️</span>}
                              </div>
                              <div style={{ fontSize: 11, color: COLORS.neonPink, fontFamily: "monospace", fontWeight: 700 }}>{inf.code}</div>
                              {inf.email && <div style={{ fontSize: 10, color: COLORS.textSecondary }}>📧 {inf.email}</div>}
                              {inf.address_city && inf.address_state && <div style={{ fontSize: 10, color: COLORS.textSecondary }}>📍 {inf.address_city}, {inf.address_state}</div>}
                              {socialHandles.length > 0 && <div style={{ fontSize: 10, color: COLORS.neonBlue, marginTop: 2 }}>📱 {socialHandles.length} platform{socialHandles.length !== 1 ? "s" : ""}</div>}
                            </div>
                          );
                        },
                      },
                      {
                        key: "total_signups",
                        label: "Signups",
                        align: "center",
                        render: (v, row) => {
                          const inf = row as unknown as Influencer;
                          const tier = TIER_CONFIG[getInfluencerTier(inf.total_signups)];
                          const nextTierKey = (["bronze","silver","gold","platinum"] as TierKey[]).find(k => TIER_CONFIG[k].min > inf.total_signups);
                          const progress = nextTierKey ? ((inf.total_signups - (TIER_CONFIG[getInfluencerTier(inf.total_signups)].min)) / (TIER_CONFIG[nextTierKey].min - TIER_CONFIG[getInfluencerTier(inf.total_signups)].min)) * 100 : 100;
                          return (
                            <div style={{ textAlign: "center" }}>
                              <div style={{ fontWeight: 700, fontSize: 16, color: COLORS.neonGreen }}>{Number(v).toLocaleString()}</div>
                              <div style={{ width: 60, height: 4, background: COLORS.darkBg, borderRadius: 2, margin: "4px auto 0", overflow: "hidden" }}>
                                <div style={{ width: `${progress}%`, height: "100%", background: tier.color, borderRadius: 2 }} />
                              </div>
                            </div>
                          );
                        },
                      },
                      {
                        key: "total_clicks",
                        label: "Link Clicks",
                        align: "center",
                        render: (v, row) => {
                          const inf = row as unknown as Influencer;
                          return (
                            <div style={{ textAlign: "center" }}>
                              <div style={{ fontWeight: 700, color: COLORS.neonBlue }}>{Number(v || 0).toLocaleString()}</div>
                              <div style={{ fontSize: 10, color: COLORS.textSecondary }}>{getClickConversionRate(inf)} conv.</div>
                              <button
                                onClick={() => handleCopyLink(inf.code)}
                                style={{ marginTop: 3, padding: "2px 7px", background: "rgba(0,212,255,0.1)", border: "1px solid " + COLORS.neonBlue, borderRadius: 4, color: COLORS.neonBlue, cursor: "pointer", fontSize: 9, fontWeight: 600 }}
                              >
                                📋 Copy Link
                              </button>
                            </div>
                          );
                        },
                      },
                      {
                        key: "rate_per_thousand_cents",
                        label: "Rate / Signup",
                        align: "center",
                        render: (_v, row) => {
                          const inf = row as unknown as Influencer;
                          const range = getTierRangeDisplay(inf.id);
                          return (
                            <div style={{ textAlign: "center" }}>
                              {range ? (
                                <>
                                  <div style={{ fontWeight: 700, color: COLORS.neonYellow, fontSize: 13 }}>
                                    {range.minRate === range.maxRate
                                      ? formatRateCents(range.maxRate)
                                      : `${formatRateCents(range.minRate)} – ${formatRateCents(range.maxRate)}`}
                                  </div>
                                  <div style={{ fontSize: 10, color: COLORS.textSecondary }}>{range.count} tier{range.count > 1 ? "s" : ""}</div>
                                </>
                              ) : (
                                <div style={{ fontWeight: 700, color: COLORS.neonYellow }}>{formatMoney(inf.rate_per_thousand_cents)}/1K</div>
                              )}
                              <button
                                onClick={() => {
                                  setSelectedInfluencer(inf);
                                  const tiers = influencerTiersMap[inf.id];
                                  setEditTiers(tiers && tiers.length > 0 ? [...tiers] : defaultInfluencerTiers.length > 0 ? [...defaultInfluencerTiers] : [{ tier_index: 1, min_signups: 1, max_signups: null, rate_cents: 3000, label: "Standard" }]);
                                  setEditTiersReason("");
                                  setShowEditTiers(true);
                                }}
                                style={{ marginTop: 4, padding: "3px 8px", background: "rgba(255,255,0,0.2)", border: "1px solid " + COLORS.neonYellow, borderRadius: 4, color: COLORS.neonYellow, cursor: "pointer", fontSize: 9, fontWeight: 600 }}
                              >
                                Edit Tiers
                              </button>
                            </div>
                          );
                        },
                      },
                      {
                        key: "total_paid_cents",
                        label: "Total Paid Out",
                        align: "right",
                        render: (v, row) => {
                          const inf = row as unknown as Influencer;
                          const paidBonuses = influencerBonuses.filter(b => b.influencer_id === inf.id && b.paid).reduce((s, b) => s + b.amount_cents, 0);
                          const totalOut = Number(v) + paidBonuses;
                          return (
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontWeight: 700, color: COLORS.neonGreen, fontSize: 14 }}>{formatMoney(totalOut)}</div>
                              {paidBonuses > 0 && (
                                <div style={{ fontSize: 10, color: COLORS.textSecondary }}>
                                  {formatMoney(Number(v))} payouts + {formatMoney(paidBonuses)} bonuses
                                </div>
                              )}
                            </div>
                          );
                        },
                      },
                      {
                        key: "id",
                        label: "Outstanding",
                        align: "right",
                        render: (_v, row) => {
                          const inf = row as unknown as Influencer;
                          // Unpaid payout balance (bracket math)
                          const unpaidPayoutValue = calcUnpaidPayoutValue(inf);
                          // Unpaid bonuses
                          const unpaidBonuses = influencerBonuses.filter(b => b.influencer_id === inf.id && !b.paid);
                          const unpaidBonusTotal = unpaidBonuses.reduce((s, b) => s + b.amount_cents, 0);
                          const totalOwed = unpaidPayoutValue + unpaidBonusTotal;

                          if (totalOwed === 0) {
                            return <span style={{ color: COLORS.neonGreen, fontSize: 12, fontWeight: 600 }}>✓ Paid up</span>;
                          }
                          return (
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontWeight: 700, fontSize: 15, color: COLORS.neonOrange }}>{formatMoney(totalOwed)}</div>
                              <div style={{ fontSize: 10, color: COLORS.textSecondary }}>
                                {unpaidPayoutValue > 0 && <div>{formatMoney(unpaidPayoutValue)} signups</div>}
                                {unpaidBonusTotal > 0 && <div style={{ color: COLORS.neonPurple }}>{formatMoney(unpaidBonusTotal)} bonuses ({unpaidBonuses.length})</div>}
                              </div>
                            </div>
                          );
                        },
                      },
                      {
                        key: "status",
                        label: "Status",
                        render: (v) => {
                          const statusColors: Record<string, string> = {
                            active: "active",
                            paused: "paused",
                            suspended: "suspended",
                          };
                          return <Badge status={statusColors[String(v)] || "pending"} />;
                        },
                      },
                      {
                        key: "id",
                        label: "Actions",
                        align: "right",
                        render: (v, row) => {
                          const inf = row as unknown as Influencer;
                          const unpaidSignups = inf.total_signups - influencerPayouts.filter((p) => p.influencer_id === inf.id && p.paid).reduce((s, p) => s + p.signups_count, 0);
                          const canGeneratePayout = unpaidSignups >= 1000;

                          return (
                            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                              <button
                                onClick={() => handleManualAttribution(inf.id)}
                                style={{ padding: "5px 10px", background: "rgba(255,107,53,0.15)", border: "1px solid " + COLORS.neonOrange, borderRadius: 6, color: COLORS.neonOrange, cursor: "pointer", fontSize: 11, fontWeight: 600 }}
                              >
                                + Signup
                              </button>
                              <button
                                onClick={() => openAnalyticsDrawer(inf)}
                                style={{ padding: "5px 10px", background: "rgba(57,255,20,0.15)", border: "1px solid " + COLORS.neonGreen, borderRadius: 6, color: COLORS.neonGreen, cursor: "pointer", fontSize: 11, fontWeight: 600 }}
                              >
                                📊 Analytics
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedInfluencer({ ...inf });
                                  setOriginalInfluencer({ ...inf });
                                  setShowEditInfluencer(true);
                                }}
                                style={{ padding: "5px 10px", background: "rgba(0,212,255,0.2)", border: "1px solid " + COLORS.neonBlue, borderRadius: 6, color: COLORS.neonBlue, cursor: "pointer", fontSize: 11, fontWeight: 600 }}
                              >
                                ✏️ Edit
                              </button>
                              <button
                                onClick={() => handleToggleInfluencerStatus(inf.id, inf.status)}
                                style={{ padding: "5px 10px", background: inf.status === "active" ? "rgba(255,255,0,0.2)" : "rgba(57,255,20,0.2)", border: "1px solid " + (inf.status === "active" ? COLORS.neonYellow : COLORS.neonGreen), borderRadius: 6, color: inf.status === "active" ? COLORS.neonYellow : COLORS.neonGreen, cursor: "pointer", fontSize: 11, fontWeight: 600 }}
                              >
                                {inf.status === "active" ? "⏸️ Pause" : "▶️ Activate"}
                              </button>
                              {canGeneratePayout && (
                                <button
                                  onClick={() => handleGeneratePayout(inf.id)}
                                  style={{ padding: "5px 10px", background: COLORS.neonGreen, border: "none", borderRadius: 6, color: "#000", cursor: "pointer", fontSize: 11, fontWeight: 700 }}
                                >
                                  💰 Payout
                                </button>
                              )}
                            </div>
                          );
                        },
                      },
                    ]}
                    data={filteredInfluencers as unknown as Record<string, unknown>[]}
                  />
                </>
              )}
            </Card>

            {/* Pending Payouts */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <SectionTitle icon="💸">Pending Payouts</SectionTitle>
              {influencerDateRange !== "all" && pendingPayouts.length > 0 && (
                <span style={{ fontSize: 12, color: COLORS.textSecondary }}>
                  {dateFilteredInfluencerPayouts.filter(p => !p.paid).length} of {pendingPayouts.length} in period
                </span>
              )}
            </div>
            <Card style={{ marginBottom: 32 }}>
              {pendingPayouts.length === 0 ? (
                <div style={{ padding: "24px 0", textAlign: "center", color: COLORS.textSecondary, fontSize: 13 }}>
                  No pending payouts — payouts are auto-generated when you run &quot;Generate Invoices&quot; on the Billing page
                </div>
              ) : (
                <DataTable
                  columns={[
                    {
                      key: "influencer_id",
                      label: "Influencer",
                      render: (v) => {
                        const inf = influencers.find((i) => i.id === String(v));
                        return inf ? (
                          <div>
                            <div style={{ fontWeight: 600 }}>{inf.name}</div>
                            <div style={{ fontSize: 11, color: COLORS.neonPink, fontFamily: "monospace" }}>{inf.code}</div>
                          </div>
                        ) : "—";
                      },
                    },
                    {
                      key: "signups_count",
                      label: "Signups",
                      align: "center",
                      render: (v) => <span style={{ fontWeight: 700 }}>{Number(v).toLocaleString()}</span>,
                    },
                    {
                      key: "rate_per_thousand_cents",
                      label: "Rate / 1K",
                      align: "center",
                      render: (v) => <span style={{ color: COLORS.neonYellow, fontWeight: 600 }}>{formatMoney(Number(v))}</span>,
                    },
                    {
                      key: "amount_cents",
                      label: "Amount",
                      align: "right",
                      render: (v) => <span style={{ fontSize: 16, fontWeight: 700, color: COLORS.neonGreen }}>{formatMoney(Number(v))}</span>,
                    },
                    {
                      key: "created_at",
                      label: "Generated",
                      render: (v) => formatDate(String(v)),
                    },
                    {
                      key: "id",
                      label: "",
                      align: "right",
                      render: (v) => (
                        <button
                          onClick={() => handleMarkPayoutPaid(String(v))}
                          style={{ padding: "6px 14px", background: COLORS.gradient2, border: "none", borderRadius: 6, color: "#000", cursor: "pointer", fontSize: 11, fontWeight: 700 }}
                        >
                          ✓ Mark Paid
                        </button>
                      ),
                    },
                  ]}
                  data={dateFilteredInfluencerPayouts.filter(p => !p.paid) as unknown as Record<string, unknown>[]}
                />
              )}
            </Card>

            {/* Recent Payouts */}
            {dateFilteredInfluencerPayouts.filter((p) => p.paid).length > 0 && (
              <>
                <SectionTitle icon="📜">Recent Payouts (Paid)</SectionTitle>
                <Card>
                  <DataTable
                    columns={[
                      {
                        key: "influencer_id",
                        label: "Influencer",
                        render: (v) => {
                          const inf = influencers.find((i) => i.id === String(v));
                          return inf ? (
                            <div>
                              <div style={{ fontWeight: 600 }}>{inf.name}</div>
                              <div style={{ fontSize: 11, color: COLORS.textSecondary }}>{inf.code}</div>
                            </div>
                          ) : "—";
                        },
                      },
                      {
                        key: "signups_count",
                        label: "Signups",
                        align: "center",
                        render: (v) => Number(v).toLocaleString(),
                      },
                      {
                        key: "amount_cents",
                        label: "Amount",
                        align: "right",
                        render: (v) => <span style={{ fontWeight: 700, color: COLORS.neonGreen }}>{formatMoney(Number(v))}</span>,
                      },
                      {
                        key: "paid_at",
                        label: "Paid On",
                        render: (v) => formatDate(String(v)),
                      },
                    ]}
                    data={dateFilteredInfluencerPayouts.filter((p) => p.paid).slice(0, 10) as unknown as Record<string, unknown>[]}
                  />
                </Card>
              </>
            )}
            </>
          )}
        </>
      )}
    </div>
  );
}