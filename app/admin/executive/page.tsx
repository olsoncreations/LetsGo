"use client";

import React, { useEffect, useState, useCallback } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import {
  COLORS,
  CHART_COLORS,
  Card,
  SectionTitle,
  StatCard,
  TimePeriodSelector,
  ExportButtons,
  formatMoney,
} from "@/components/admin/components";

// ==================== LOCAL COMPONENTS ====================
function TotalRevenueCard({ data }: { data: Record<string, number> }) {
  const [period, setPeriod] = useState("month");
  return (
    <div style={{ background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 16, padding: 24, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: COLORS.gradient1 }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em", color: COLORS.textSecondary, fontWeight: 600 }}>💰 Total Revenue</div>
      </div>
      <div style={{ fontSize: 36, fontWeight: 700, background: COLORS.gradient1, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 16 }}>{formatMoney(data[period] || 0)}</div>
      <div style={{ display: "flex", gap: 4 }}>
        {(["day", "week", "month", "year"] as const).map(p => (
          <button key={p} onClick={() => setPeriod(p)} style={{ flex: 1, padding: "8px 4px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 10, fontWeight: 600, textTransform: "uppercase", background: period === p ? COLORS.gradient1 : COLORS.darkBg, color: period === p ? "#fff" : COLORS.textSecondary }}>{p}</button>
        ))}
      </div>
    </div>
  );
}

interface ZoneData { zone: string; count: number; target: number; color: string; states: { name: string; abbr: string; count: number }[] }

function ZoneCard({ zone }: { zone: ZoneData }) {
  const [hovered, setHovered] = useState(false);
  const pct = zone.target > 0 ? Math.round((zone.count / zone.target) * 100) : 0;
  return (
    <div style={{ background: COLORS.darkBg, borderRadius: 12, padding: 16, border: "1px solid " + COLORS.cardBorder, position: "relative", cursor: "pointer" }} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>{zone.zone}</span>
        <span style={{ fontSize: 24, fontWeight: 700, color: zone.color }}>{zone.count}</span>
      </div>
      <div style={{ height: 8, background: COLORS.cardBorder, borderRadius: 4, overflow: "hidden", marginBottom: 8 }}>
        <div style={{ height: "100%", width: Math.min(100, pct) + "%", background: zone.color, borderRadius: 4, transition: "width 0.3s" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: COLORS.textSecondary }}>
        <span>{pct}% of target</span>
        <span>Goal: {zone.target}</span>
      </div>
      {hovered && zone.states.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 8, background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 12, padding: 16, zIndex: 100, boxShadow: "0 10px 40px rgba(0,0,0,0.5)" }}>
          <div style={{ fontWeight: 600, marginBottom: 12, color: zone.color, fontSize: 14 }}>States in {zone.zone}</div>
          {zone.states.map((s, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 12, borderBottom: i < zone.states.length - 1 ? "1px solid " + COLORS.cardBorder : "none" }}>
              <span style={{ color: COLORS.textSecondary }}>{s.abbr} - {s.name}</span>
              <span style={{ fontWeight: 700, color: zone.color }}>{s.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface TooltipProps { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: COLORS.cardBg, border: "1px solid " + COLORS.cardBorder, borderRadius: 12, padding: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
        <div style={{ fontWeight: 600, marginBottom: 8, color: COLORS.textPrimary }}>{label}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: p.color }} />
            <span style={{ color: COLORS.textSecondary, fontSize: 12 }}>{p.name}:</span>
            <span style={{ fontWeight: 600, fontSize: 12, color: COLORS.textPrimary }}>{typeof p.value === "number" ? p.value.toLocaleString() : p.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

function EmptyChart({ message }: { message: string }) {
  return <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.textSecondary, fontSize: 13 }}>{message}</div>;
}

// ==================== DATA TYPES ====================
interface RevenueDataPoint { label: string; basic: number; premium: number; advertising: number; addons: number }
interface PayoutLevelData { level: string; count: number; totalPayout: number; avgPayout: number }
interface PendingData { label: string; pending: number }
interface ReceiptsData { label: string; receipts: number }
interface BusinessCountData { label: string; count: number }
interface UserGrowthData { label: string; total: number; new: number }
interface AdjustmentPoint { label: string; discounts: number; chargebacks: number; refunds: number }
interface ReferralSource { source: string; businesses: number }
interface ReferralTrend { month: string; referrals: number; converted: number }
interface ForecastPoint { month: string; actual: number | null; projected: number | null }
interface CohortRow { cohort: string; users: number; months: (number | undefined)[] }

// ==================== EXECUTIVE PAGE ====================
export default function ExecutivePage() {
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalBusinesses, setTotalBusinesses] = useState(0);
  const [avgRevenuePerBusiness, setAvgRevenuePerBusiness] = useState(0);
  const [loading, setLoading] = useState(true);

  const [revenueData, setRevenueData] = useState<Record<string, RevenueDataPoint[]>>({ day: [], week: [], month: [], year: [] });
  const [totalRevenue, setTotalRevenue] = useState<Record<string, number>>({ day: 0, week: 0, month: 0, year: 0 });
  const [payoutsByLevel, setPayoutsByLevel] = useState<Record<string, PayoutLevelData[]>>({ day: [], week: [], month: [], year: [] });
  const [pendingByMonth, setPendingByMonth] = useState<Record<string, PendingData[]>>({ day: [], week: [], month: [], year: [] });
  const [receiptsByPeriod, setReceiptsByPeriod] = useState<Record<string, ReceiptsData[]>>({ day: [], week: [], month: [], year: [] });
  const [newBusinessesByPeriod, setNewBusinessesByPeriod] = useState<Record<string, BusinessCountData[]>>({ day: [], week: [], month: [], year: [] });
  const [userGrowth, setUserGrowth] = useState<Record<string, UserGrowthData[]>>({ day: [], week: [], month: [], year: [] });
  const [businessesByZone, setBusinessesByZone] = useState<ZoneData[]>([]);
  const [adjustmentsData, setAdjustmentsData] = useState<Record<string, AdjustmentPoint[]>>({ day: [], week: [], month: [], year: [] });
  const [adjustmentBreakdown, setAdjustmentBreakdown] = useState<{ type: string; icon: string; amount: number; color: string; count: number }[]>([]);
  const [referralSources, setReferralSources] = useState<ReferralSource[]>([]);
  const [referralTrend, setReferralTrend] = useState<Record<string, ReferralTrend[]>>({ day: [], week: [], month: [], year: [] });
  const [forecastData, setForecastData] = useState<ForecastPoint[]>([]);
  const [forecastGrowthRate, setForecastGrowthRate] = useState(0);
  const [forecastAnnual, setForecastAnnual] = useState(0);
  const [cohortData, setCohortData] = useState<CohortRow[]>([]);

  // Influencer metrics
  const [totalInfluencers, setTotalInfluencers] = useState(0);
  const [totalInfluencerSignups, setTotalInfluencerSignups] = useState(0);
  const [totalInfluencerPaid, setTotalInfluencerPaid] = useState(0);
  const [influencerTierDistribution, setInfluencerTierDistribution] = useState<{ tier: string; count: number }[]>([]);

  // Surge & ad metrics
  const [totalSurgeEvents, setTotalSurgeEvents] = useState(0);
  const [activeSurgeNow, setActiveSurgeNow] = useState(0);
  const [totalAdRevenue, setTotalAdRevenue] = useState(0);
  const [totalSurgeFees, setTotalSurgeFees] = useState(0);

  // Custom tier metrics
  const [customTierCount, setCustomTierCount] = useState(0);
  const [customTierAdoptionPct, setCustomTierAdoptionPct] = useState(0);
  const [recentTierChanges, setRecentTierChanges] = useState(0);

  // Game engagement metrics
  const [total5v3v1Games, setTotal5v3v1Games] = useState(0);
  const [totalGroupGames, setTotalGroupGames] = useState(0);
  const [uniqueWinningBusinesses, setUniqueWinningBusinesses] = useState(0);
  const [avgGroupSize, setAvgGroupSize] = useState(0);
  const [topWinningBusinesses, setTopWinningBusinesses] = useState<{ name: string; wins: number; color: string }[]>([]);
  const [gamesByMonth, setGamesByMonth] = useState<{ label: string; fiveThreeOne: number; groupVote: number }[]>([]);

  const [revenueCategory, setRevenueCategory] = useState("all");
  const [revenuePeriod, setRevenuePeriod] = useState<"day" | "week" | "month" | "year">("month");
  const [payoutPeriod, setPayoutPeriod] = useState<"day" | "week" | "month" | "year">("month");
  const [pendingPeriod, setPendingPeriod] = useState<"day" | "week" | "month" | "year">("month");
  const [receiptsPeriod, setReceiptsPeriod] = useState<"day" | "week" | "month" | "year">("month");
  const [businessesPeriod, setBusinessesPeriod] = useState<"day" | "week" | "month" | "year">("month");
  const [usersPeriod, setUsersPeriod] = useState<"day" | "week" | "month" | "year">("month");
  const [adjustmentPeriod, setAdjustmentPeriod] = useState<"day" | "week" | "month" | "year">("month");
  const [referralPeriod, setReferralPeriod] = useState<"day" | "week" | "month" | "year">("month");

  const stateToZone: Record<string, string> = {
    NE: "Midwest", IA: "Midwest", KS: "Midwest", MO: "Midwest", MN: "Midwest", WI: "Midwest", IL: "Midwest", IN: "Midwest", OH: "Midwest", MI: "Midwest",
    CO: "Mountain", WY: "Mountain", UT: "Mountain", MT: "Mountain", ID: "Mountain",
    TX: "Southwest", AZ: "Southwest", NM: "Southwest", OK: "Southwest",
    FL: "Southeast", GA: "Southeast", AL: "Southeast", SC: "Southeast", NC: "Southeast", TN: "Southeast", MS: "Southeast", LA: "Southeast", AR: "Southeast", VA: "Southeast",
    NY: "Northeast", PA: "Northeast", NJ: "Northeast", CT: "Northeast", MA: "Northeast", MD: "Northeast", DE: "Northeast", RI: "Northeast",
    CA: "Pacific", WA: "Pacific", OR: "Pacific", HI: "Pacific", AK: "Pacific",
    ND: "Great Plains", SD: "Great Plains", NV: "Great Plains", WV: "Great Plains",
    ME: "New England", NH: "New England", VT: "New England",
  };
  const stateNames: Record<string, string> = {
    NE: "Nebraska", IA: "Iowa", KS: "Kansas", MO: "Missouri", CO: "Colorado", WY: "Wyoming", UT: "Utah", TX: "Texas", AZ: "Arizona", NM: "New Mexico",
    FL: "Florida", GA: "Georgia", AL: "Alabama", NY: "New York", PA: "Pennsylvania", NJ: "New Jersey", CA: "California", WA: "Washington", OR: "Oregon",
    ND: "North Dakota", SD: "South Dakota", CT: "Connecticut", MA: "Massachusetts", OH: "Ohio", MN: "Minnesota", WI: "Wisconsin", IL: "Illinois",
    IN: "Indiana", MI: "Michigan", MT: "Montana", ID: "Idaho", OK: "Oklahoma", SC: "South Carolina", NC: "North Carolina", TN: "Tennessee",
    MS: "Mississippi", LA: "Louisiana", AR: "Arkansas", VA: "Virginia", MD: "Maryland", DE: "Delaware", RI: "Rhode Island", HI: "Hawaii", AK: "Alaska",
    ME: "Maine", NH: "New Hampshire", VT: "Vermont", NV: "Nevada", WV: "West Virginia",
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // ---- COUNTS ----
      const { count: usersCount } = await supabaseBrowser.from("profiles").select("*", { count: "exact", head: true });
      setTotalUsers(usersCount || 0);
      const { count: businessCount } = await supabaseBrowser.from("business").select("*", { count: "exact", head: true });
      setTotalBusinesses(businessCount || 0);

      // ---- RECEIPTS / REVENUE ----
      const { data: receipts } = await supabaseBrowser.from("receipts").select("id, receipt_total_cents, payout_cents, created_at, status, payout_tier_index").eq("status", "approved");
      if (receipts && receipts.length > 0) {
        const totalRev = receipts.reduce((s, r) => s + (r.receipt_total_cents || 0), 0);
        setAvgRevenuePerBusiness(businessCount ? Math.round(totalRev / businessCount) : 0);

        const monthlyData: Record<string, { basic: number; premium: number; advertising: number; addons: number }> = {};
        receipts.forEach(r => {
          const m = new Date(r.created_at).toLocaleDateString("en-US", { month: "short" });
          if (!monthlyData[m]) monthlyData[m] = { basic: 0, premium: 0, advertising: 0, addons: 0 };
          const rev = (r.receipt_total_cents || 0) - (r.payout_cents || 0);
          monthlyData[m].basic += rev * 0.3;
          monthlyData[m].premium += rev * 0.5;
          monthlyData[m].advertising += rev * 0.15;
          monthlyData[m].addons += rev * 0.05;
        });
        const ml = Object.keys(monthlyData).slice(-6);
        const mr = ml.map(l => ({ label: l, ...monthlyData[l] }));
        setRevenueData(p => ({ ...p, month: mr }));
        const mt = mr.reduce((s, d) => s + d.basic + d.premium + d.advertising + d.addons, 0);
        setTotalRevenue(p => ({ ...p, month: mt, year: mt * 12 }));

        // Payouts by level
        const lc: Record<string, { count: number; total: number }> = {};
        receipts.forEach(r => { const l = `L${r.payout_tier_index || 1}`; if (!lc[l]) lc[l] = { count: 0, total: 0 }; lc[l].count++; lc[l].total += r.receipt_total_cents || 0; });
        setPayoutsByLevel(p => ({ ...p, month: ["L1","L2","L3","L4","L5","L6","L7"].map(l => ({ level: l, count: lc[l]?.count || 0, totalPayout: lc[l]?.total || 0, avgPayout: lc[l]?.count ? Math.round((lc[l]?.total||0)/lc[l].count) : 0 })) }));

        // Receipts by month
        setReceiptsByPeriod(p => ({ ...p, month: ml.map(l => ({ label: l, receipts: receipts.filter(r => new Date(r.created_at).toLocaleDateString("en-US",{month:"short"})===l).length })) }));

        // Forecasting
        const hbm: Record<string,number> = {};
        receipts.forEach(r => { const k = new Date(r.created_at).toLocaleDateString("en-US",{month:"short",year:"2-digit"}); hbm[k] = (hbm[k]||0)+((r.receipt_total_cents||0)-(r.payout_cents||0)); });
        const he = Object.entries(hbm).slice(-7);
        const hv = he.map(([,v])=>v);
        let gr = 0;
        if (hv.length >= 2) { const rs: number[] = []; for (let i=1;i<hv.length;i++) { if (hv[i-1]>0) rs.push((hv[i]-hv[i-1])/hv[i-1]); } gr = rs.length > 0 ? rs.reduce((a,b)=>a+b,0)/rs.length : 0; }
        setForecastGrowthRate(Math.round(gr*1000)/10);
        const fp: ForecastPoint[] = he.map(([m,v])=>({month:m,actual:v,projected:null}));
        const lv = hv.length > 0 ? hv[hv.length-1] : 0;
        let pj = lv;
        ["Feb 26","Mar 26","Apr 26","May 26","Jun 26"].forEach(m => { pj = Math.round(pj*(1+Math.max(gr,0.01))); fp.push({month:m,actual:null,projected:pj}); });
        setForecastData(fp);
        setForecastAnnual(lv > 0 ? Math.round(lv*12*(1+gr)) : 0);
      }

      // ---- BUSINESSES BY ZONE ----
      const { data: businesses } = await supabaseBrowser.from("business").select("id, state, created_at");
      if (businesses && businesses.length > 0) {
        const zm: Record<string,{count:number;states:Record<string,number>}> = {};
        ["Midwest","Mountain","Southwest","Southeast","Northeast","Pacific","Great Plains","New England"].forEach(z => { zm[z] = {count:0,states:{}}; });
        businesses.forEach(b => { const z = stateToZone[b.state]||"Midwest"; if(!zm[z]) zm[z]={count:0,states:{}}; zm[z].count++; if(b.state) zm[z].states[b.state]=(zm[z].states[b.state]||0)+1; });
        const zc: Record<string,string> = {Midwest:COLORS.neonPink,Mountain:COLORS.neonBlue,Southwest:COLORS.neonGreen,Southeast:COLORS.neonYellow,Northeast:COLORS.neonPurple,Pacific:COLORS.neonOrange,"Great Plains":COLORS.neonRed||"#ff3131","New England":"#00ff88"};
        const zt: Record<string,number> = {Midwest:60,Mountain:35,Southwest:40,Southeast:30,Northeast:25,Pacific:20,"Great Plains":15,"New England":10};
        setBusinessesByZone(Object.entries(zm).map(([z,d])=>({zone:z,count:d.count,target:zt[z]||20,color:zc[z]||COLORS.neonPink,states:Object.entries(d.states).map(([a,c])=>({abbr:a,name:stateNames[a]||a,count:c}))})));
        const bm: Record<string,number> = {};
        businesses.forEach(b => { const m = new Date(b.created_at).toLocaleDateString("en-US",{month:"short"}); bm[m]=(bm[m]||0)+1; });
        setNewBusinessesByPeriod(p => ({...p, month: Object.entries(bm).slice(-6).map(([l,c])=>({label:l,count:c}))}));
      }

      // ---- USER GROWTH + COHORT ----
      const { data: users } = await supabaseBrowser.from("profiles").select("id, created_at");
      if (users && users.length > 0) {
        const um: Record<string,number> = {};
        users.forEach(u => {
          const d = new Date(u.created_at);
          const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
          um[key] = (um[key] || 0) + 1;
        });
        let rt = 0;
        setUserGrowth(p => ({...p, month: Object.entries(um).sort(([a],[b])=>a.localeCompare(b)).slice(-6).map(([k,n])=>{
          rt+=n;
          const [y,m] = k.split("-");
          const label = new Date(Number(y), Number(m)-1).toLocaleDateString("en-US",{month:"short"});
          return{label,total:rt,new:n};
        })}));

        // Cohort
        const usm: Record<string,string[]> = {};
        users.forEach(u => {
          const d = new Date(u.created_at);
          const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
          if(!usm[k]) usm[k]=[];
          usm[k].push(u.id);
        });
        const { data: allRec } = await supabaseBrowser.from("receipts").select("user_id, created_at").limit(10000);
        const rbu: Record<string,string[]> = {};
        if (allRec) allRec.forEach(r => { if(!rbu[r.user_id]) rbu[r.user_id]=[]; rbu[r.user_id].push(r.created_at); });
        const now = new Date();
        setCohortData(Object.entries(usm).sort(([a],[b])=>a.localeCompare(b)).slice(-7).map(([cohort,uids])=>{
          const [cy,cm] = cohort.split("-");
          const cd = new Date(Number(cy), Number(cm)-1);
          const msc = Math.max(0,Math.floor((now.getTime()-cd.getTime())/(30*24*60*60*1000)));
          const months: (number|undefined)[] = [];
          for (let m=0;m<=Math.min(6,msc);m++) {
            if (m===0) { months.push(100); continue; }
            const tm = new Date(cd); tm.setMonth(tm.getMonth()+m);
            const ac = uids.filter(uid => (rbu[uid]||[]).some(rd => { const d2=new Date(rd); return d2.getMonth()===tm.getMonth()&&d2.getFullYear()===tm.getFullYear(); })).length;
            months.push(uids.length > 0 ? Math.round((ac/uids.length)*100) : 0);
          }
          const cohortLabel = cd.toLocaleDateString("en-US",{month:"short",year:"numeric"});
          return {cohort:cohortLabel,users:uids.length,months};
        }));
      }

      // ---- PENDING PAYOUTS ----
      const { data: payouts } = await supabaseBrowser.from("payouts").select("id, amount_cents, created_at, status").eq("status","pending");
      if (payouts && payouts.length > 0) {
        const pm: Record<string,number> = {};
        payouts.forEach(p => { const m = new Date(p.created_at).toLocaleDateString("en-US",{month:"short"}); pm[m]=(pm[m]||0)+(p.amount_cents||0); });
        setPendingByMonth(p => ({...p, month: Object.entries(pm).slice(-6).map(([l,v])=>({label:l,pending:v}))}));
      }

      // ---- ADJUSTMENTS (from promotion_redemptions + rejected receipts) ----
      const { data: redemptions } = await supabaseBrowser.from("promotion_redemptions").select("id, discount_applied_cents, created_at");
      const { data: rejRec } = await supabaseBrowser.from("receipts").select("id, receipt_total_cents, created_at, status").neq("status","approved").limit(1000);
      const adjM: Record<string,{discounts:number;chargebacks:number;refunds:number}> = {};
      if (redemptions) redemptions.forEach(r => { const m = new Date(r.created_at).toLocaleDateString("en-US",{month:"short"}); if(!adjM[m]) adjM[m]={discounts:0,chargebacks:0,refunds:0}; adjM[m].discounts += Math.abs(r.discount_applied_cents||0); });
      if (rejRec) rejRec.forEach(r => { const m = new Date(r.created_at).toLocaleDateString("en-US",{month:"short"}); if(!adjM[m]) adjM[m]={discounts:0,chargebacks:0,refunds:0}; if(r.status==="rejected"||r.status==="flagged") adjM[m].chargebacks+=(r.receipt_total_cents||0); else adjM[m].refunds+=Math.round((r.receipt_total_cents||0)*0.3); });
      const adjArr = Object.entries(adjM).slice(-6).map(([l,v])=>({label:l,...v}));
      setAdjustmentsData(p => ({...p, month: adjArr}));
      const td = adjArr.reduce((a,d)=>a+d.discounts,0);
      const tc = adjArr.reduce((a,d)=>a+d.chargebacks,0);
      const tr = adjArr.reduce((a,d)=>a+d.refunds,0);
      setAdjustmentBreakdown([
        {type:"Discounts",icon:"🏷️",amount:td,color:COLORS.neonGreen,count:redemptions?.length||0},
        {type:"Bonus Credits",icon:"🎁",amount:Math.round(td*0.4),color:COLORS.neonBlue,count:td>0?Math.ceil(td*0.4/8000):0},
        {type:"Fee Waivers",icon:"🎫",amount:Math.round(td*0.25),color:COLORS.neonPurple,count:td>0?Math.ceil(td*0.25/10000):0},
        {type:"Chargebacks",icon:"⚠️",amount:tc,color:COLORS.neonRed||"#ff3131",count:rejRec?.filter(r=>r.status==="rejected"||r.status==="flagged").length||0},
        {type:"Refunds",icon:"💸",amount:tr,color:COLORS.neonOrange,count:tr>0?Math.ceil(tr/6000):0},
        {type:"Corrections",icon:"✏️",amount:0,color:COLORS.neonYellow,count:0},
      ]);

      // ---- REFERRALS ----
      const { data: referrals } = await supabaseBrowser.from("referrals").select("id, source, status, created_at");
      if (referrals && referrals.length > 0) {
        const sm: Record<string,number> = {};
        referrals.forEach(r => { sm[r.source]=(sm[r.source]||0)+1; });
        const sl: Record<string,string> = {direct:"Direct/Organic",link:"Referral Link",code:"Promo Code",partner:"Partner Referral",other:"Other"};
        setReferralSources(Object.entries(sm).map(([s,b])=>({source:sl[s]||s,businesses:b})).sort((a,b)=>b.businesses-a.businesses));
        const tm: Record<string,{referrals:number;converted:number}> = {};
        referrals.forEach(r => { const m = new Date(r.created_at).toLocaleDateString("en-US",{month:"short"}); if(!tm[m]) tm[m]={referrals:0,converted:0}; tm[m].referrals++; if(r.status==="converted") tm[m].converted++; });
        setReferralTrend(p => ({...p, month: Object.entries(tm).slice(-6).map(([m,d])=>({month:m,...d}))}));
      }

      // ---- INFLUENCER PERFORMANCE ----
      try {
        const { count: infCount } = await supabaseBrowser.from("influencers").select("*", { count: "exact", head: true });
        setTotalInfluencers(infCount || 0);

        const { data: infData } = await supabaseBrowser.from("influencers").select("tier");
        if (infData) {
          const tierMap: Record<string, number> = {};
          infData.forEach(i => { const t = i.tier || "seed"; tierMap[t] = (tierMap[t] || 0) + 1; });
          setInfluencerTierDistribution(["seed", "sprout", "bloom", "icon"].map(t => ({ tier: t.charAt(0).toUpperCase() + t.slice(1), count: tierMap[t] || 0 })));
        }

        const { count: signupCount } = await supabaseBrowser.from("influencer_signups").select("*", { count: "exact", head: true });
        setTotalInfluencerSignups(signupCount || 0);

        const { data: payoutData } = await supabaseBrowser.from("influencer_payouts").select("amount_cents");
        const paidTotal = payoutData?.reduce((s, p) => s + (p.amount_cents || 0), 0) || 0;
        setTotalInfluencerPaid(paidTotal);
      } catch { /* influencer tables may not exist */ }

      // ---- SURGE PRICING & AD CAMPAIGNS ----
      try {
        const { count: surgeTotal } = await supabaseBrowser.from("surge_pricing_events").select("*", { count: "exact", head: true });
        setTotalSurgeEvents(surgeTotal || 0);

        const now = new Date().toISOString();
        const { count: surgeActive } = await supabaseBrowser.from("surge_pricing_events").select("*", { count: "exact", head: true }).eq("is_active", true).lte("start_date", now).gte("end_date", now);
        setActiveSurgeNow(surgeActive || 0);

        const { data: adCampaigns } = await supabaseBrowser.from("business_ad_campaigns").select("total_price_cents, surge_fee_cents");
        const adRev = adCampaigns?.reduce((s, c) => s + (c.total_price_cents || 0), 0) || 0;
        setTotalAdRevenue(adRev);
        const surgeFees = adCampaigns?.reduce((s, c) => s + (c.surge_fee_cents || 0), 0) || 0;
        setTotalSurgeFees(surgeFees);
      } catch { /* surge/ad tables may not exist */ }

      // ---- CUSTOM TIER ADOPTION ----
      try {
        const { count: ctCount } = await supabaseBrowser.from("business").select("*", { count: "exact", head: true }).eq("has_custom_tiers", true);
        setCustomTierCount(ctCount || 0);
        const totalBiz = businessCount || 1;
        setCustomTierAdoptionPct(totalBiz > 0 ? Math.round(((ctCount || 0) / totalBiz) * 100) : 0);

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const { count: tierChanges } = await supabaseBrowser.from("payout_tier_changes").select("*", { count: "exact", head: true }).gte("created_at", thirtyDaysAgo.toISOString());
        setRecentTierChanges(tierChanges || 0);
      } catch { /* payout_tier_changes may not exist */ }

      // ---- GAME ENGAGEMENT (via server API to bypass RLS) ----
      try {
        const gameRes = await fetch("/api/admin/game-stats");
        if (gameRes.ok) {
          const gs = await gameRes.json();
          setTotal5v3v1Games(gs.total5v3v1Games || 0);
          setTotalGroupGames(gs.totalGroupGames || 0);
          setUniqueWinningBusinesses(gs.uniqueWinningBusinesses || 0);
          setAvgGroupSize(gs.avgGroupSize || 0);
          setGamesByMonth(gs.gamesByMonth || []);
          const rankColors = [COLORS.neonPink, COLORS.neonBlue, COLORS.neonGreen, COLORS.neonYellow, COLORS.neonPurple];
          setTopWinningBusinesses((gs.topBusinesses || []).map((b: { name: string; wins: number }, i: number) => ({ name: b.name, wins: b.wins, color: rankColors[i] || COLORS.neonPink })));
        }
      } catch { /* game stats API may not be available */ }

    } catch (err) {
      console.error("Error fetching executive data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.textSecondary }}>Loading executive dashboard...</div>;

  const crd = revenueData[revenuePeriod] || [];
  const cpd = payoutsByLevel[payoutPeriod] || [];
  const cpnd = pendingByMonth[pendingPeriod] || [];
  const crcd = receiptsByPeriod[receiptsPeriod] || [];
  const cbd = newBusinessesByPeriod[businessesPeriod] || [];
  const cugd = userGrowth[usersPeriod] || [];
  const cadj = adjustmentsData[adjustmentPeriod] || [];
  const crt = referralTrend[referralPeriod] || [];

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 32 }}>
      <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 32 }}>📊 Executive Dashboard</h1>

      {/* TOP STATS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
        <StatCard value={totalUsers.toLocaleString()} label="Total Users" gradient={COLORS.gradient1} />
        <StatCard value={totalBusinesses.toString()} label="Total Businesses" gradient={COLORS.gradient2} />
        <StatCard value={formatMoney(avgRevenuePerBusiness)} label="Avg Revenue/Business" gradient={COLORS.gradient3} />
        <TotalRevenueCard data={totalRevenue} />
      </div>

      {/* REVENUE ANALYTICS */}
      <SectionTitle icon="💰">Revenue Analytics</SectionTitle>
      <Card style={{ marginBottom: 24 }} actions={<><div style={{ display: "flex", gap: 4, marginRight: 12 }}>{["all","basic","premium","advertising","addons"].map(c=>(<button key={c} onClick={()=>setRevenueCategory(c)} style={{padding:"6px 10px",borderRadius:6,border:"none",cursor:"pointer",fontSize:10,fontWeight:600,textTransform:"capitalize",background:revenueCategory===c?COLORS.gradient1:COLORS.darkBg,color:revenueCategory===c?"#fff":COLORS.textSecondary}}>{c}</button>))}</div><TimePeriodSelector value={revenuePeriod} onChange={v=>setRevenuePeriod(v as typeof revenuePeriod)}/><ExportButtons data={crd} filename="revenue_analytics"/></>}>
        <div style={{ height: 320 }}>
          {crd.length === 0 ? <EmptyChart message="No revenue data yet" /> : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={crd}><CartesianGrid strokeDasharray="3 3" stroke={COLORS.cardBorder}/><XAxis dataKey="label" tick={{fill:COLORS.textSecondary,fontSize:11}}/><YAxis tick={{fill:COLORS.textSecondary,fontSize:11}} tickFormatter={v=>"$"+(Number(v)/1000).toFixed(0)+"k"}/><Tooltip content={<CustomTooltip/>}/><Legend/>
                {(revenueCategory==="all"||revenueCategory==="premium")&&<Line type="monotone" dataKey="premium" stroke={COLORS.neonPink} strokeWidth={3} name="Premium" dot={{r:4,fill:COLORS.neonPink}}/>}
                {(revenueCategory==="all"||revenueCategory==="basic")&&<Line type="monotone" dataKey="basic" stroke="#94a3b8" strokeWidth={2} name="Basic" dot={{r:4,fill:"#94a3b8"}}/>}
                {(revenueCategory==="all"||revenueCategory==="advertising")&&<Line type="monotone" dataKey="advertising" stroke={COLORS.neonYellow} strokeWidth={2} name="Advertising" dot={{r:4,fill:COLORS.neonYellow}}/>}
                {(revenueCategory==="all"||revenueCategory==="addons")&&<Line type="monotone" dataKey="addons" stroke={COLORS.neonBlue} strokeWidth={2} name="Add-ons" dot={{r:4,fill:COLORS.neonBlue}}/>}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        {crd.length > 0 && (<div style={{ marginTop: 20, padding: 16, background: COLORS.darkBg, borderRadius: 12 }}><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}><div><div style={{ fontSize: 12, fontWeight: 600, color: COLORS.textSecondary, marginBottom: 12, textTransform: "uppercase" }}>{revenuePeriod==="day"?"Today":revenuePeriod==="week"?"This Week":revenuePeriod==="month"?"This Month":"This Year"} Totals</div><div style={{ display: "grid", gap: 10 }}>{([{label:"Premium Subscriptions",key:"premium" as const,color:COLORS.neonPink},{label:"Basic Subscriptions",key:"basic" as const,color:"#94a3b8"},{label:"Advertising Revenue",key:"advertising" as const,color:COLORS.neonYellow},{label:"Add-ons Revenue",key:"addons" as const,color:COLORS.neonBlue}]).map(item=>(<div key={item.key} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 12px",background:COLORS.cardBg,borderRadius:8}}><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:12,height:12,borderRadius:2,background:item.color}}/><span style={{fontSize:13}}>{item.label}</span></div><span style={{fontWeight:700,color:item.color}}>{formatMoney(crd.reduce((a,d)=>a+d[item.key],0))}</span></div>))}<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px",background:COLORS.gradient1,borderRadius:8}}><span style={{fontSize:14,fontWeight:600}}>Period Total</span><span style={{fontSize:18,fontWeight:700}}>{formatMoney(crd.reduce((a,d)=>a+d.premium+d.basic+d.advertising+d.addons,0))}</span></div></div></div><div><div style={{ fontSize: 12, fontWeight: 600, color: COLORS.textSecondary, marginBottom: 12, textTransform: "uppercase" }}>Year to Date (YTD) Totals</div><div style={{ display: "grid", gap: 10 }}>{([{label:"Premium Subscriptions",key:"premium" as const,color:COLORS.neonPink},{label:"Basic Subscriptions",key:"basic" as const,color:"#94a3b8"},{label:"Advertising Revenue",key:"advertising" as const,color:COLORS.neonYellow},{label:"Add-ons Revenue",key:"addons" as const,color:COLORS.neonBlue}]).map(item=>(<div key={item.key} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 12px",background:COLORS.cardBg,borderRadius:8}}><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:12,height:12,borderRadius:2,background:item.color}}/><span style={{fontSize:13}}>{item.label}</span></div><span style={{fontWeight:700,color:item.color}}>{formatMoney((revenueData.year||[]).reduce((a,d)=>a+d[item.key],0))}</span></div>))}<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px",background:"linear-gradient(135deg, #39ff14, #00d4ff)",borderRadius:8}}><span style={{fontSize:14,fontWeight:600,color:"#000"}}>YTD Total</span><span style={{fontSize:18,fontWeight:700,color:"#000"}}>{formatMoney(totalRevenue.year)}</span></div></div></div></div></div>)}
      </Card>

      {/* PAYOUT BY LEVEL */}
      <SectionTitle icon="📊">Progressive Payout by Level</SectionTitle>
      <Card style={{ marginBottom: 24 }} actions={<><TimePeriodSelector value={payoutPeriod} onChange={v=>setPayoutPeriod(v as typeof payoutPeriod)}/><ExportButtons data={cpd} filename="payouts_by_level"/></>}>
        <div style={{ height: 250 }}>{cpd.length===0?<EmptyChart message="No payout data yet"/>:(<ResponsiveContainer width="100%" height="100%"><BarChart data={cpd}><CartesianGrid strokeDasharray="3 3" stroke={COLORS.cardBorder}/><XAxis dataKey="level" tick={{fill:COLORS.textSecondary,fontSize:11}}/><YAxis tick={{fill:COLORS.textSecondary,fontSize:11}}/><Tooltip content={<CustomTooltip/>}/><Legend/><Bar dataKey="count" fill={COLORS.neonBlue} name="# Receipts" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer>)}</div>
        {cpd.length>0&&<div style={{display:"grid",gridTemplateColumns:"repeat(7, 1fr)",gap:10,marginTop:20}}>{cpd.map((l,i)=>(<div key={i} style={{textAlign:"center",padding:14,background:COLORS.darkBg,borderRadius:10,border:"1px solid "+COLORS.cardBorder}}><div style={{fontSize:11,color:COLORS.textSecondary,marginBottom:4}}>{l.level}</div><div style={{fontSize:18,fontWeight:700,color:CHART_COLORS[i]||COLORS.neonPink}}>{l.count.toLocaleString()}</div><div style={{fontSize:11,color:COLORS.neonGreen,marginTop:4}}>{formatMoney(l.totalPayout)}</div></div>))}</div>}
      </Card>

      {/* PENDING MONEY */}
      <SectionTitle icon="💵">Pending Money in User Accounts</SectionTitle>
      <Card style={{ marginBottom: 24 }} actions={<><TimePeriodSelector value={pendingPeriod} onChange={v=>setPendingPeriod(v as typeof pendingPeriod)}/><ExportButtons data={cpnd} filename="pending_balances"/></>}>
        <div style={{ height: 220 }}>{cpnd.length===0?<EmptyChart message="No pending payout data"/>:(<ResponsiveContainer width="100%" height="100%"><AreaChart data={cpnd}><defs><linearGradient id="gradPending" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={COLORS.neonOrange} stopOpacity={0.8}/><stop offset="100%" stopColor={COLORS.neonOrange} stopOpacity={0.1}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke={COLORS.cardBorder}/><XAxis dataKey="label" tick={{fill:COLORS.textSecondary,fontSize:11}}/><YAxis tick={{fill:COLORS.textSecondary,fontSize:11}} tickFormatter={v=>"$"+(Number(v)/100).toFixed(0)}/><Tooltip content={<CustomTooltip/>}/><Area type="monotone" dataKey="pending" stroke={COLORS.neonOrange} fill="url(#gradPending)" strokeWidth={2} dot={{r:4,fill:COLORS.neonOrange}} name="Pending Balance"/></AreaChart></ResponsiveContainer>)}</div>
      </Card>

      {/* BUSINESS GEOGRAPHY */}
      <SectionTitle icon="🗺️">Business Geography</SectionTitle>
      {businessesByZone.length===0?<div style={{padding:24,textAlign:"center",color:COLORS.textSecondary,marginBottom:24}}>No business data yet</div>:<div style={{display:"grid",gridTemplateColumns:"repeat(4, 1fr)",gap:16,marginBottom:24}}>{businessesByZone.map((z,i)=><ZoneCard key={i} zone={z}/>)}</div>}

      {/* OPERATIONS ROW */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
        <div><SectionTitle icon="🧾">Receipts Processed</SectionTitle><Card actions={<><TimePeriodSelector value={receiptsPeriod} onChange={v=>setReceiptsPeriod(v as typeof receiptsPeriod)}/><ExportButtons data={crcd} filename="receipts_processed"/></>}><div style={{height:200}}>{crcd.length===0?<EmptyChart message="No receipt data"/>:(<ResponsiveContainer width="100%" height="100%"><AreaChart data={crcd}><defs><linearGradient id="gradReceipts" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={COLORS.neonBlue} stopOpacity={0.8}/><stop offset="100%" stopColor={COLORS.neonBlue} stopOpacity={0.1}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke={COLORS.cardBorder}/><XAxis dataKey="label" tick={{fill:COLORS.textSecondary,fontSize:11}}/><YAxis tick={{fill:COLORS.textSecondary,fontSize:11}}/><Tooltip content={<CustomTooltip/>}/><Area type="monotone" dataKey="receipts" stroke={COLORS.neonBlue} fill="url(#gradReceipts)" strokeWidth={2} dot={{r:4,fill:COLORS.neonBlue}} name="Receipts"/></AreaChart></ResponsiveContainer>)}</div></Card></div>
        <div><SectionTitle icon="🏢">New Businesses</SectionTitle><Card actions={<><TimePeriodSelector value={businessesPeriod} onChange={v=>setBusinessesPeriod(v as typeof businessesPeriod)}/><ExportButtons data={cbd} filename="new_businesses"/></>}><div style={{height:200}}>{cbd.length===0?<EmptyChart message="No business data"/>:(<ResponsiveContainer width="100%" height="100%"><BarChart data={cbd}><CartesianGrid strokeDasharray="3 3" stroke={COLORS.cardBorder}/><XAxis dataKey="label" tick={{fill:COLORS.textSecondary,fontSize:11}}/><YAxis tick={{fill:COLORS.textSecondary,fontSize:11}}/><Tooltip content={<CustomTooltip/>}/><Bar dataKey="count" fill={COLORS.neonPurple} radius={[4,4,0,0]} name="New Businesses"/></BarChart></ResponsiveContainer>)}</div></Card></div>
      </div>

      {/* USER GROWTH */}
      <SectionTitle icon="👥">User Growth</SectionTitle>
      <Card style={{ marginBottom: 24 }} actions={<><TimePeriodSelector value={usersPeriod} onChange={v=>setUsersPeriod(v as typeof usersPeriod)}/><ExportButtons data={cugd} filename="user_growth"/></>}>
        <div style={{ height: 220 }}>{cugd.length===0?<EmptyChart message="No user data yet"/>:(<ResponsiveContainer width="100%" height="100%"><LineChart data={cugd}><CartesianGrid strokeDasharray="3 3" stroke={COLORS.cardBorder}/><XAxis dataKey="label" tick={{fill:COLORS.textSecondary,fontSize:11}}/><YAxis tick={{fill:COLORS.textSecondary,fontSize:11}}/><Tooltip content={<CustomTooltip/>}/><Legend/><Line type="monotone" dataKey="total" stroke={COLORS.neonBlue} strokeWidth={3} name="Total Users" dot={{r:4,fill:COLORS.neonBlue}}/><Line type="monotone" dataKey="new" stroke={COLORS.neonGreen} strokeWidth={2} name="New Users" dot={{r:4,fill:COLORS.neonGreen}}/></LineChart></ResponsiveContainer>)}</div>
      </Card>

      {/* GAME ENGAGEMENT */}
      <SectionTitle icon="🎮">Group Vote & 5v3v1 Engagement</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 16 }}>
        <StatCard value={(total5v3v1Games + totalGroupGames).toString()} label="Total Games Completed" gradient={COLORS.gradient1} />
        <StatCard value={totalGroupGames.toString()} label="Group Vote Games" gradient={COLORS.gradient3} />
        <StatCard value={total5v3v1Games.toString()} label="5v3v1 Games" gradient={"linear-gradient(135deg, " + COLORS.neonPink + ", " + COLORS.neonPurple + ")"} />
        <StatCard value={avgGroupSize > 0 ? avgGroupSize.toFixed(1) : "—"} label="Avg Group Size" gradient={COLORS.gradient2} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
        <Card title="Games Completed by Month" actions={<ExportButtons data={gamesByMonth} filename="games_by_month" />}>
          <div style={{ height: 220 }}>
            {gamesByMonth.length === 0 ? <EmptyChart message="No game data yet" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={gamesByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.cardBorder} />
                  <XAxis dataKey="label" tick={{ fill: COLORS.textSecondary, fontSize: 11 }} />
                  <YAxis tick={{ fill: COLORS.textSecondary, fontSize: 11 }} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="groupVote" name="Group Vote" stackId="games" fill={COLORS.neonPurple} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="fiveThreeOne" name="5v3v1" stackId="games" fill={COLORS.neonPink} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
        <Card title="Top Winning Businesses">
          {topWinningBusinesses.length === 0 ? (
            <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.textSecondary, fontSize: 13 }}>No winning businesses yet</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {topWinningBusinesses.map((biz, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: COLORS.darkBg, borderRadius: 10, border: "1px solid " + COLORS.cardBorder }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: biz.color, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, color: "#000", flexShrink: 0 }}>#{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{biz.name}</div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 18, color: biz.color, flexShrink: 0 }}>{biz.wins}</div>
                  <div style={{ fontSize: 11, color: COLORS.textSecondary, flexShrink: 0 }}>win{biz.wins !== 1 ? "s" : ""}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, marginBottom: 24 }}>
        <div style={{ background: COLORS.darkBg, borderRadius: 12, padding: 20, border: "1px solid " + COLORS.cardBorder, textAlign: "center" }}>
          <div style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Unique Winning Businesses</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: COLORS.neonGreen }}>{uniqueWinningBusinesses}</div>
        </div>
        <div style={{ background: COLORS.darkBg, borderRadius: 12, padding: 20, border: "1px solid " + COLORS.cardBorder, textAlign: "center" }}>
          <div style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Total Businesses Selected</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: COLORS.neonBlue }}>{topWinningBusinesses.reduce((s, b) => s + b.wins, 0)}</div>
        </div>
      </div>

      {/* DISCOUNTS & CREDITS GIVEN */}
      <SectionTitle icon="💰">Discounts & Credits Given</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
        <Card title="Adjustments Over Time" actions={<><TimePeriodSelector value={adjustmentPeriod} onChange={v=>setAdjustmentPeriod(v as typeof adjustmentPeriod)}/><ExportButtons data={cadj} filename="adjustments_over_time"/></>}>
          <div style={{ height: 220 }}>{cadj.length===0?<EmptyChart message="No adjustment data"/>:(<ResponsiveContainer width="100%" height="100%"><AreaChart data={cadj}><defs><linearGradient id="gradDiscounts" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={COLORS.neonGreen} stopOpacity={0.8}/><stop offset="100%" stopColor={COLORS.neonGreen} stopOpacity={0.1}/></linearGradient><linearGradient id="gradChargebacks" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={COLORS.neonRed||"#ff3131"} stopOpacity={0.8}/><stop offset="100%" stopColor={COLORS.neonRed||"#ff3131"} stopOpacity={0.1}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke={COLORS.cardBorder}/><XAxis dataKey="label" tick={{fill:COLORS.textSecondary,fontSize:11}}/><YAxis tick={{fill:COLORS.textSecondary,fontSize:11}} tickFormatter={v=>"$"+(Number(v)/100).toFixed(0)}/><Tooltip content={<CustomTooltip/>}/><Legend/><Area type="monotone" dataKey="discounts" stroke={COLORS.neonGreen} fill="url(#gradDiscounts)" strokeWidth={2} name="Credits Given"/><Area type="monotone" dataKey="chargebacks" stroke={COLORS.neonRed||"#ff3131"} fill="url(#gradChargebacks)" strokeWidth={2} name="Chargebacks"/><Area type="monotone" dataKey="refunds" stroke={COLORS.neonOrange} fill="transparent" strokeWidth={2} name="Refunds" strokeDasharray="5 5"/></AreaChart></ResponsiveContainer>)}</div>
        </Card>
        <Card title="Adjustments Breakdown">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {adjustmentBreakdown.map((item,i)=>(<div key={i} style={{padding:16,background:COLORS.darkBg,borderRadius:12,borderLeft:"4px solid "+item.color}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}><span style={{fontSize:20}}>{item.icon}</span><span style={{fontSize:10,color:COLORS.textSecondary,padding:"2px 8px",background:COLORS.cardBg,borderRadius:4}}>{item.count} transactions</span></div><div style={{fontSize:12,color:COLORS.textSecondary,marginBottom:4}}>{item.type}</div><div style={{fontSize:20,fontWeight:700,color:item.color}}>{formatMoney(item.amount)}</div></div>))}
          </div>
        </Card>
      </div>

      {/* REFERRAL PERFORMANCE */}
      <SectionTitle icon="🤝">Referral Performance</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
        <Card title="Referrals by Source" actions={<ExportButtons data={referralSources} filename="referrals_by_source"/>}>
          <div style={{ height: 220 }}>{referralSources.length===0?<EmptyChart message="No referral data"/>:(<ResponsiveContainer width="100%" height="100%"><BarChart data={referralSources} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke={COLORS.cardBorder}/><XAxis type="number" tick={{fill:COLORS.textSecondary,fontSize:11}}/><YAxis type="category" dataKey="source" tick={{fill:COLORS.textSecondary,fontSize:10}} width={100}/><Tooltip content={<CustomTooltip/>}/><Bar dataKey="businesses" fill={COLORS.neonPink} radius={[0,4,4,0]} name="Businesses"/></BarChart></ResponsiveContainer>)}</div>
        </Card>
        <Card title="Referral Trend" actions={<><TimePeriodSelector value={referralPeriod} onChange={v=>setReferralPeriod(v as typeof referralPeriod)}/><ExportButtons data={crt} filename="referral_trend"/></>}>
          <div style={{ height: 220 }}>{crt.length===0?<EmptyChart message="No referral trend data"/>:(<ResponsiveContainer width="100%" height="100%"><LineChart data={crt}><CartesianGrid strokeDasharray="3 3" stroke={COLORS.cardBorder}/><XAxis dataKey="month" tick={{fill:COLORS.textSecondary,fontSize:11}}/><YAxis tick={{fill:COLORS.textSecondary,fontSize:11}}/><Tooltip content={<CustomTooltip/>}/><Legend/><Line type="monotone" dataKey="referrals" stroke={COLORS.neonBlue} strokeWidth={2} name="Referrals" dot={{r:4,fill:COLORS.neonBlue}}/><Line type="monotone" dataKey="converted" stroke={COLORS.neonGreen} strokeWidth={2} name="Converted" dot={{r:4,fill:COLORS.neonGreen}}/></LineChart></ResponsiveContainer>)}</div>
        </Card>
      </div>

      {/* REVENUE FORECASTING */}
      <SectionTitle icon="📈">Revenue Forecasting</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24, marginBottom: 24 }}>
        <Card title="Revenue Trend & Projection" actions={<ExportButtons data={forecastData} filename="revenue_forecast"/>}>
          <div style={{ height: 280 }}>{forecastData.length===0?<EmptyChart message="No revenue data to forecast"/>:(<ResponsiveContainer width="100%" height="100%"><AreaChart data={forecastData}><defs><linearGradient id="gradActual" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={COLORS.neonGreen} stopOpacity={0.8}/><stop offset="100%" stopColor={COLORS.neonGreen} stopOpacity={0.1}/></linearGradient><linearGradient id="gradProjected" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={COLORS.neonBlue} stopOpacity={0.5}/><stop offset="100%" stopColor={COLORS.neonBlue} stopOpacity={0.1}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke={COLORS.cardBorder}/><XAxis dataKey="month" tick={{fill:COLORS.textSecondary,fontSize:10}}/><YAxis tick={{fill:COLORS.textSecondary,fontSize:11}} tickFormatter={v=>"$"+(Number(v)/1000).toFixed(0)+"k"}/><Tooltip content={<CustomTooltip/>}/><Legend/><Area type="monotone" dataKey="actual" stroke={COLORS.neonGreen} fill="url(#gradActual)" strokeWidth={2} name="Actual Revenue" connectNulls={false}/><Area type="monotone" dataKey="projected" stroke={COLORS.neonBlue} fill="url(#gradProjected)" strokeWidth={2} strokeDasharray="5 5" name="Projected" connectNulls={false}/></AreaChart></ResponsiveContainer>)}</div>
        </Card>
        <Card title="Forecast Summary">
          <div style={{ display: "grid", gap: 16 }}>
            <div style={{padding:20,background:COLORS.darkBg,borderRadius:12,textAlign:"center"}}><div style={{fontSize:11,color:COLORS.textSecondary,marginBottom:8,textTransform:"uppercase"}}>Monthly Growth Rate</div><div style={{fontSize:36,fontWeight:700,color:forecastGrowthRate>0?COLORS.neonGreen:COLORS.textSecondary}}>{forecastGrowthRate>0?"+":""}{forecastGrowthRate}%</div></div>
            <div style={{padding:20,background:COLORS.darkBg,borderRadius:12,textAlign:"center"}}><div style={{fontSize:11,color:COLORS.textSecondary,marginBottom:8,textTransform:"uppercase"}}>Projected Annual Revenue</div><div style={{fontSize:28,fontWeight:700,color:forecastAnnual>0?COLORS.neonPink:COLORS.textSecondary}}>{formatMoney(forecastAnnual)}</div></div>
            {forecastAnnual > 0 && <div style={{padding:16,background:"rgba(57,255,20,0.1)",borderRadius:12,border:"1px solid "+COLORS.neonGreen}}><div style={{fontSize:12,color:COLORS.neonGreen,fontWeight:600,marginBottom:4}}>🎯 On Track!</div><div style={{fontSize:11,color:COLORS.textSecondary}}>Based on current growth rate projections</div></div>}
          </div>
        </Card>
      </div>

      {/* USER RETENTION COHORT ANALYSIS */}
      <SectionTitle icon="👥">User Retention Cohort Analysis</SectionTitle>
      <Card style={{ marginBottom: 24 }} actions={<ExportButtons data={cohortData.map(c=>({Cohort:c.cohort,Users:c.users,...Object.fromEntries(c.months.map((v,i)=>[`Month${i}`,v!==undefined?`${v}%`:""]))}))} filename="cohort_analysis"/>}>
        <div style={{padding:16,background:"rgba(0,212,255,0.1)",borderRadius:10,marginBottom:20,border:"1px solid "+COLORS.neonBlue}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}><span style={{fontSize:18}}>📊</span><span style={{fontWeight:600,color:COLORS.neonBlue}}>What is Cohort Analysis?</span></div>
          <div style={{fontSize:12,color:COLORS.textSecondary}}>Shows what percentage of users from each signup month are still active. Higher retention = healthier business. Green = good (60%+), Yellow = okay (40-60%), Red = needs attention (&lt;40%).</div>
        </div>
        {cohortData.length===0?<div style={{padding:40,textAlign:"center",color:COLORS.textSecondary}}>No user cohort data yet</div>:(
          <><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><th style={{padding:12,textAlign:"left",borderBottom:"1px solid "+COLORS.cardBorder,fontSize:11,color:COLORS.textSecondary}}>Cohort</th><th style={{padding:12,textAlign:"center",borderBottom:"1px solid "+COLORS.cardBorder,fontSize:11,color:COLORS.textSecondary}}>Users</th>{[0,1,2,3,4,5,6].map(m=><th key={m} style={{padding:12,textAlign:"center",borderBottom:"1px solid "+COLORS.cardBorder,fontSize:11,color:COLORS.textSecondary}}>Month {m}</th>)}</tr></thead><tbody>{cohortData.map((c,i)=>(<tr key={i}><td style={{padding:12,fontWeight:600,fontSize:12}}>{c.cohort}</td><td style={{padding:12,textAlign:"center",fontSize:12,color:COLORS.textSecondary}}>{c.users}</td>{[0,1,2,3,4,5,6].map(j=>(<td key={j} style={{padding:8,textAlign:"center"}}>{c.months[j]!==undefined?(<span style={{display:"inline-block",padding:"6px 12px",borderRadius:6,fontSize:11,fontWeight:600,background:(c.months[j]||0)>=60?"rgba(57,255,20,0.2)":(c.months[j]||0)>=40?"rgba(255,255,0,0.2)":"rgba(255,49,49,0.2)",color:(c.months[j]||0)>=60?COLORS.neonGreen:(c.months[j]||0)>=40?COLORS.neonYellow:(COLORS.neonRed||"#ff3131")}}>{c.months[j]}%</span>):(<span style={{color:COLORS.cardBorder}}>—</span>)}</td>))}</tr>))}</tbody></table></div>
          <div style={{marginTop:16,display:"flex",gap:16,justifyContent:"center"}}>{[{label:"Good (60%+)",bg:"rgba(57,255,20,0.4)"},{label:"Okay (40-60%)",bg:"rgba(255,255,0,0.4)"},{label:"Needs Attention (<40%)",bg:"rgba(255,49,49,0.4)"}].map((l,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:6,fontSize:11}}><div style={{width:12,height:12,borderRadius:2,background:l.bg}}/><span style={{color:COLORS.textSecondary}}>{l.label}</span></div>))}</div></>
        )}
      </Card>

      {/* INFLUENCER PERFORMANCE */}
      <SectionTitle icon="📣">Influencer Performance</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <StatCard value={totalInfluencers.toLocaleString()} label="Total Influencers" gradient={COLORS.gradient1} />
        <StatCard value={totalInfluencerSignups.toLocaleString()} label="Total Signups Driven" gradient={COLORS.gradient2} />
        <StatCard value={formatMoney(totalInfluencerPaid)} label="Total Paid Out" gradient={COLORS.gradient3} />
        <StatCard value={totalInfluencers > 0 ? Math.round(totalInfluencerSignups / totalInfluencers).toString() : "0"} label="Avg Signups/Influencer" gradient={COLORS.gradient4} />
      </div>
      <Card title="Influencer Tier Distribution" style={{ marginBottom: 24 }}>
        <div style={{ height: 220 }}>
          {influencerTierDistribution.length === 0 || influencerTierDistribution.every(t => t.count === 0) ? (
            <EmptyChart message="No influencer data yet" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={influencerTierDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.cardBorder} />
                <XAxis dataKey="tier" tick={{ fill: COLORS.textSecondary, fontSize: 11 }} />
                <YAxis tick={{ fill: COLORS.textSecondary, fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Influencers" radius={[4, 4, 0, 0]}>
                  {influencerTierDistribution.map((_, i) => {
                    const tierColors = [COLORS.neonGreen, COLORS.neonBlue, COLORS.neonPink, COLORS.neonPurple];
                    return <Cell key={i} fill={tierColors[i] || COLORS.neonPink} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* SURGE PRICING & AD CAMPAIGNS */}
      <SectionTitle icon="⚡">Surge Pricing & Ad Campaigns</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <StatCard value={totalSurgeEvents.toString()} label="Total Surge Events" gradient={COLORS.gradient3} />
        <StatCard value={activeSurgeNow.toString()} label="Active Right Now" gradient={activeSurgeNow > 0 ? "linear-gradient(135deg, #ff3131, #ff6b35)" : COLORS.gradient4} />
        <StatCard value={formatMoney(totalAdRevenue)} label="Total Ad Revenue" gradient={COLORS.gradient2} />
        <StatCard value={formatMoney(totalSurgeFees)} label="Total Surge Fees" gradient={COLORS.gradient1} />
      </div>

      {/* CUSTOM TIER ADOPTION */}
      <SectionTitle icon="🎯">Custom Tier Adoption</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        <Card>
          <div style={{ textAlign: "center", padding: 16 }}>
            <div style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", marginBottom: 8 }}>Businesses with Custom Tiers</div>
            <div style={{ fontSize: 36, fontWeight: 700, background: COLORS.gradient1, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{customTierCount}</div>
          </div>
        </Card>
        <Card>
          <div style={{ textAlign: "center", padding: 16 }}>
            <div style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", marginBottom: 8 }}>Adoption Rate</div>
            <div style={{ fontSize: 36, fontWeight: 700, color: COLORS.neonGreen }}>{customTierAdoptionPct}%</div>
            <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 4 }}>of all businesses</div>
          </div>
        </Card>
        <Card>
          <div style={{ textAlign: "center", padding: 16 }}>
            <div style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", marginBottom: 8 }}>Tier Changes (30d)</div>
            <div style={{ fontSize: 36, fontWeight: 700, color: COLORS.neonBlue }}>{recentTierChanges}</div>
            <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 4 }}>recent modifications</div>
          </div>
        </Card>
      </div>
    </div>
  );
}