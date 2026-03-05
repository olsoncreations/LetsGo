// components/business/v2/tabs/Analytics.tsx
// Wired to Supabase - reads from receipts table
'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import type { BusinessTabProps } from '@/components/business/v2/BusinessProfileV2';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import {
  BarChart3,
  CheckCircle,
  Clock,
  DollarSign,
  Download,
  FileText,
  TrendingUp,
  Users,
  Award,
  AlertCircle,
  RefreshCw,
  Star,
  Lock,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type RevenueView = '30days' | 'monthly' | 'yearly';
type CompetitorFilter = 'type' | 'category';

type CompetitorData = {
  businessType: string;
  categoryMain: string;
  filter: string;
  totalBusinesses: number;
  competitorCount: number;
  marketSharePercent: number;
  customerSharePercent: number;
  repeatCustomerSharePercent: number;
  thisBusinessStats: {
    revenueCents: number;
    uniqueCustomers: number;
    repeatCustomers: number;
    totalReceipts: number;
  };
  filterLabel: string;
};

const colors = {
  primary: '#14b8a6',
  secondary: '#f97316',
  accent: '#06b6d4',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  purple: '#a855f7',
};

function formatTypeName(raw: string): string {
  const map: Record<string, string> = {
    restaurant_bar: 'Restaurant & Bar',
    activity: 'Activity',
    salon_beauty: 'Salon & Beauty',
    retail: 'Retail',
    event_venue: 'Event Venue',
    other: 'Other',
  };
  return map[raw] || raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function safeNumber(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatCurrency(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatCurrency0(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

function monthShort(i: number) {
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i] ?? '';
}

function toMonthKey(d: Date) {
  const y = d.getFullYear();
  const m = d.getMonth();
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}

function monthLabelFromKey(key: string) {
  const [yy, mm] = key.split('-');
  const m = Number(mm) - 1;
  return `${monthShort(m)} ${yy}`;
}

// ============================================================================
// Main Component
// ============================================================================
export default function Analytics({ businessId, isPremium }: BusinessTabProps) {
  const [revenueView, setRevenueView] = useState<RevenueView>('monthly');
  const [competitorFilter, setCompetitorFilter] = useState<CompetitorFilter>('type');
  const [competitorData, setCompetitorData] = useState<CompetitorData | null>(null);
  const [competitorLoading, setCompetitorLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ============================================================================
  // Analytics State (loaded from Supabase)
  // ============================================================================
  const [stats, setStats] = useState({
    approvalRate: 0,
    repeatCustomerRate: 0,
    receiptsPending: 0,
    totalReceipts: 0,
    totalRevenueCents: 0,
    uniqueCustomers: 0,
    repeatCustomers: 0,
  });

  const [receiptsByMonth, setReceiptsByMonth] = useState<Array<{ month: string; receipts: number; revenue: number }>>([]);
  const [avgSubtotalByMonth, setAvgSubtotalByMonth] = useState<Array<{ month: string; avgSubtotal: number }>>([]);
  const [tierDistribution, setTierDistribution] = useState<Array<{ tier: string; customers: number; revenue: number; color: string }>>([]);

  // Game wins state
  const [gameWins, setGameWins] = useState({ fiveThreeOne: 0, groupVote: 0, total: 0 });
  const [gameWinsByMonth, setGameWinsByMonth] = useState<Array<{ month: string; fiveThreeOne: number; groupVote: number }>>([]);
  const [avgGroupSize, setAvgGroupSize] = useState(0);
  const [avgRating, setAvgRating] = useState(0);     // x10 format: 42 = 4.2 stars
  const [ratingCount, setRatingCount] = useState(0);

  // ============================================================================
  // Load Data
  // ============================================================================
  const loadAnalytics = useCallback(async () => {
    if (!businessId) return;

    setLoading(true);
    setLoadError(null);

    try {
      // Fetch all receipts for this business
      const { data: receipts, error } = await supabaseBrowser
        .from('receipts')
        .select('id, user_id, receipt_total_cents, status, created_at, payout_tier_index, payout_tier_label')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch aggregate rating from business table
      const { data: bizRow } = await supabaseBrowser
        .from('business')
        .select('avg_rating, rating_count')
        .eq('id', businessId)
        .maybeSingle();
      if (bizRow) {
        setAvgRating(bizRow.avg_rating ?? 0);
        setRatingCount(bizRow.rating_count ?? 0);
      }

      const allReceipts = receipts || [];

      // Calculate stats
      const pending = allReceipts.filter((r) => (r.status || '').toLowerCase() === 'pending');
      const approved = allReceipts.filter((r) => (r.status || '').toLowerCase() === 'approved');
      const rejected = allReceipts.filter((r) => (r.status || '').toLowerCase() === 'rejected');

      const totalProcessed = approved.length + rejected.length;
      const approvalRate = totalProcessed > 0 ? (approved.length / totalProcessed) * 100 : 0;

      // Unique customers and repeat customers
      const userVisits = new Map<string, number>();
      for (const r of allReceipts) {
        if (r.user_id) {
          userVisits.set(r.user_id, (userVisits.get(r.user_id) || 0) + 1);
        }
      }
      const uniqueCustomers = userVisits.size;
      const repeatCustomers = Array.from(userVisits.values()).filter((count) => count > 1).length;
      const repeatRate = uniqueCustomers > 0 ? (repeatCustomers / uniqueCustomers) * 100 : 0;

      // Total revenue (from approved receipts)
      const totalRevenueCents = approved.reduce((sum, r) => sum + safeNumber(r.receipt_total_cents), 0);

      setStats({
        approvalRate: Math.round(approvalRate * 10) / 10,
        repeatCustomerRate: Math.round(repeatRate * 10) / 10,
        receiptsPending: pending.length,
        totalReceipts: allReceipts.length,
        totalRevenueCents,
        uniqueCustomers,
        repeatCustomers,
      });

      // Receipts by month
      const monthAgg = new Map<string, { receipts: number; totalCents: number }>();
      for (const r of allReceipts) {
        if (!r.created_at) continue;
        const d = new Date(r.created_at);
        if (isNaN(d.getTime())) continue;
        const key = toMonthKey(d);
        const existing = monthAgg.get(key) || { receipts: 0, totalCents: 0 };
        existing.receipts += 1;
        existing.totalCents += safeNumber(r.receipt_total_cents);
        monthAgg.set(key, existing);
      }

      const sortedMonths = Array.from(monthAgg.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-12); // Last 12 months

      setReceiptsByMonth(
        sortedMonths.map(([key, data]) => ({
          month: monthLabelFromKey(key),
          receipts: data.receipts,
          revenue: data.totalCents / 100,
        }))
      );

      setAvgSubtotalByMonth(
        sortedMonths.map(([key, data]) => ({
          month: monthLabelFromKey(key),
          avgSubtotal: data.receipts > 0 ? data.totalCents / 100 / data.receipts : 0,
        }))
      );

      // Tier distribution
      const tierColors = ['#94a3b8', '#64748b', colors.accent, colors.primary, colors.secondary, colors.warning, colors.success];
      const tierAgg = new Map<number, { count: number; totalCents: number }>();
      for (const r of approved) {
        const tierIdx = r.payout_tier_index ?? 0;
        const existing = tierAgg.get(tierIdx) || { count: 0, totalCents: 0 };
        existing.count += 1;
        existing.totalCents += safeNumber(r.receipt_total_cents);
        tierAgg.set(tierIdx, existing);
      }

      const tierData = [];
      for (let i = 1; i <= 7; i++) {
        const data = tierAgg.get(i) || { count: 0, totalCents: 0 };
        tierData.push({
          tier: `Level ${i}`,
          customers: data.count,
          revenue: data.totalCents / 100,
          color: tierColors[i - 1] || colors.primary,
        });
      }
      setTierDistribution(tierData);
    } catch (e: any) {
      console.error('[Analytics] Load error:', e);
      setLoadError(e.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  // ============================================================================
  // Game Wins Data (via server API to bypass RLS)
  // ============================================================================
  const loadGameWins = useCallback(async () => {
    if (!businessId) return;
    try {
      const res = await fetch(`/api/businesses/${businessId}/game-wins`);
      if (!res.ok) return;
      const data = await res.json();

      setGameWins({ fiveThreeOne: data.fiveThreeOne || 0, groupVote: data.groupVote || 0, total: data.total || 0 });
      setAvgGroupSize(data.avgGroupSize || 0);

      // Aggregate dates by month
      const monthAgg = new Map<string, { fiveThreeOne: number; groupVote: number }>();
      for (const dt of data.fiveThreeOneDates || []) {
        if (!dt) continue;
        const d = new Date(dt);
        if (isNaN(d.getTime())) continue;
        const key = toMonthKey(d);
        const existing = monthAgg.get(key) || { fiveThreeOne: 0, groupVote: 0 };
        existing.fiveThreeOne += 1;
        monthAgg.set(key, existing);
      }
      for (const dt of data.groupVoteDates || []) {
        if (!dt) continue;
        const d = new Date(dt);
        if (isNaN(d.getTime())) continue;
        const key = toMonthKey(d);
        const existing = monthAgg.get(key) || { fiveThreeOne: 0, groupVote: 0 };
        existing.groupVote += 1;
        monthAgg.set(key, existing);
      }

      const sorted = Array.from(monthAgg.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-12);
      setGameWinsByMonth(sorted.map(([key, d]) => ({
        month: monthLabelFromKey(key),
        fiveThreeOne: d.fiveThreeOne,
        groupVote: d.groupVote,
      })));
    } catch (e) {
      console.error('[Analytics] Game wins load error:', e);
    }
  }, [businessId]);

  useEffect(() => {
    loadGameWins();
  }, [loadGameWins]);

  // ============================================================================
  // Competitor data (real - queries similar businesses by type/category)
  // ============================================================================
  const loadCompetitors = useCallback(async () => {
    if (!businessId) return;
    setCompetitorLoading(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/competitors?filter=${competitorFilter}`);
      if (!res.ok) throw new Error('Failed to load competitor data');
      const data: CompetitorData = await res.json();
      setCompetitorData(data);
    } catch (e: unknown) {
      console.error('[Analytics] Competitor load error:', e);
    } finally {
      setCompetitorLoading(false);
    }
  }, [businessId, competitorFilter]);

  useEffect(() => {
    loadCompetitors();
  }, [loadCompetitors]);

  const onDownload = (format: 'CSV' | 'XLSX') => {
    console.log(`Download requested: ${format}`);
    alert(`(Placeholder) ${format} export`);
  };

  // ============================================================================
  // Render
  // ============================================================================
  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-xl">
        <div className="text-white/60">Loading analytics...</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
        <div className="mb-4 font-semibold text-white">Error loading analytics</div>
        <div className="mb-4 text-sm text-white/70">{loadError}</div>
        <button
          onClick={loadAnalytics}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold"
          style={{ background: colors.primary, color: 'white' }}
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    );
  }

  const hasData = stats.totalReceipts > 0;

  return (
    <div className="grid gap-6">
      {/* Stats Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          {
            label: 'Approval Rate',
            value: hasData ? `${stats.approvalRate}%` : '—',
            icon: <CheckCircle className="h-5 w-5" />,
            color: colors.success,
          },
          {
            label: 'Repeat Customer Rate',
            value: hasData ? `${stats.repeatCustomerRate}%` : '—',
            icon: <Users className="h-5 w-5" />,
            color: colors.primary,
          },
          {
            label: 'Pending Receipts',
            value: stats.receiptsPending,
            icon: <Clock className="h-5 w-5" />,
            color: colors.warning,
          },
          {
            label: 'Total Revenue',
            value: hasData ? formatCurrency0(stats.totalRevenueCents / 100) : '—',
            icon: <DollarSign className="h-5 w-5" />,
            color: colors.secondary,
          },
          {
            label: 'Unique Customers',
            value: hasData ? stats.uniqueCustomers : '—',
            icon: <TrendingUp className="h-5 w-5" />,
            color: colors.accent,
          },
        ].map((item, idx) => (
          <div key={idx} className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
            <div className="mb-3 flex items-center gap-2" style={{ color: item.color }}>
              {item.icon}
              <span className="text-sm font-medium text-white/60">{item.label}</span>
            </div>
            <div className="font-mono text-2xl font-bold text-white">{item.value}</div>
          </div>
        ))}

        {/* Customer Rating Card — Premium Only */}
        {isPremium ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
            <div className="mb-3 flex items-center gap-2" style={{ color: colors.warning }}>
              <Star className="h-5 w-5" />
              <span className="text-sm font-medium text-white/60">Customer Rating</span>
            </div>
            {ratingCount > 0 ? (
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-2xl font-bold text-white">{(avgRating / 10).toFixed(1)}</span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => {
                      const filled = avgRating / 10 >= s;
                      const half = !filled && avgRating / 10 >= s - 0.5;
                      return (
                        <Star
                          key={s}
                          className="h-4 w-4"
                          fill={filled ? colors.warning : half ? `${colors.warning}80` : 'transparent'}
                          stroke={filled || half ? colors.warning : 'rgba(255,255,255,0.15)'}
                          strokeWidth={1.5}
                          style={{ filter: filled ? `drop-shadow(0 0 4px ${colors.warning})` : 'none' }}
                        />
                      );
                    })}
                  </div>
                </div>
                <div className="mt-1 text-xs text-white/40">{ratingCount} rating{ratingCount !== 1 ? 's' : ''}</div>
              </div>
            ) : (
              <div className="font-mono text-2xl font-bold text-white">—</div>
            )}
          </div>
        ) : (
          <div className="relative rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl overflow-hidden">
            {/* Blurred placeholder content */}
            <div style={{ filter: 'blur(6px)', opacity: 0.3, pointerEvents: 'none' }}>
              <div className="mb-3 flex items-center gap-2" style={{ color: colors.warning }}>
                <Star className="h-5 w-5" />
                <span className="text-sm font-medium text-white/60">Customer Rating</span>
              </div>
              <div className="font-mono text-2xl font-bold text-white">4.5</div>
            </div>
            {/* Lock overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40 rounded-xl">
              <Lock className="h-5 w-5" style={{ color: colors.secondary }} />
              <span className="text-xs font-bold" style={{ color: colors.secondary }}>Premium</span>
            </div>
          </div>
        )}
      </div>

      {/* Receipts by Month Chart */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" style={{ color: colors.accent }} />
            <div className="text-lg font-bold text-white">Receipts & Revenue by Month</div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadAnalytics}
              className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-[11px] font-semibold transition"
              style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.7)' }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
            <button
              onClick={() => onDownload('CSV')}
              className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-[11px] font-semibold transition"
              style={{ background: `${colors.success}20`, borderColor: colors.success, color: colors.success }}
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>
          </div>
        </div>

        {receiptsByMonth.length === 0 ? (
          <div className="py-12 text-center text-white/50">No receipt data yet. Data will appear as customers submit receipts.</div>
        ) : (
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={receiptsByMonth}>
                <defs>
                  <linearGradient id="colorReceipts" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors.accent} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={colors.accent} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors.success} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={colors.success} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.10)" />
                <XAxis dataKey="month" stroke="rgba(255,255,255,0.5)" />
                <YAxis yAxisId="left" stroke="rgba(255,255,255,0.5)" />
                <YAxis yAxisId="right" orientation="right" stroke="rgba(255,255,255,0.5)" />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(15, 23, 42, 0.95)',
                    border: '1px solid rgba(255,255,255,0.10)',
                    borderRadius: '8px',
                    color: 'white',
                  }}
                  formatter={(value, name) => {
                    if (name === 'Revenue') return [formatCurrency(safeNumber(value)), name];
                    return [safeNumber(value), name || ''];
                  }}
                />
                <Legend />
                <Area yAxisId="left" type="monotone" dataKey="receipts" stroke={colors.accent} fillOpacity={1} fill="url(#colorReceipts)" name="Receipts" />
                <Area yAxisId="right" type="monotone" dataKey="revenue" stroke={colors.success} fillOpacity={1} fill="url(#colorRevenue)" name="Revenue" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Avg Subtotal & Tier Distribution Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Avg Subtotal Per Receipt */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <div className="mb-6 flex items-center gap-2">
            <DollarSign className="h-5 w-5" style={{ color: colors.success }} />
            <div className="text-lg font-bold text-white">Avg Subtotal Per Receipt</div>
          </div>

          {avgSubtotalByMonth.length === 0 ? (
            <div className="py-12 text-center text-white/50">No data yet</div>
          ) : (
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={avgSubtotalByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.10)" />
                  <XAxis dataKey="month" stroke="rgba(255,255,255,0.5)" />
                  <YAxis stroke="rgba(255,255,255,0.5)" />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(15, 23, 42, 0.95)',
                      border: '1px solid rgba(255,255,255,0.10)',
                      borderRadius: '8px',
                      color: 'white',
                    }}
                    formatter={(value) => [formatCurrency(safeNumber(value)), 'Avg Subtotal']}
                  />
                  <Line type="monotone" dataKey="avgSubtotal" stroke={colors.success} strokeWidth={3} dot={{ fill: colors.success, strokeWidth: 2, r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Customer Tier Distribution */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <div className="mb-6 flex items-center gap-2">
            <Award className="h-5 w-5" style={{ color: colors.purple }} />
            <div className="text-lg font-bold text-white">Receipts by Customer Tier</div>
          </div>

          {tierDistribution.every((t) => t.customers === 0) ? (
            <div className="py-12 text-center text-white/50">No tier data yet</div>
          ) : (
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tierDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.10)" />
                  <XAxis dataKey="tier" stroke="rgba(255,255,255,0.5)" />
                  <YAxis stroke="rgba(255,255,255,0.5)" />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(15, 23, 42, 0.95)',
                      border: '1px solid rgba(255,255,255,0.10)',
                      borderRadius: '8px',
                      color: 'white',
                    }}
                    formatter={(value, name) => {
                      if (name === 'Revenue') return [formatCurrency(safeNumber(value)), name];
                      return [safeNumber(value), name || ''];
                    }}
                  />
                  <Legend />
                  <Bar dataKey="customers" name="Receipts" radius={[4, 4, 0, 0]}>
                    {tierDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Group Vote & 5v3v1 Wins */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
        <div className="mb-6 flex items-center gap-2">
          <BarChart3 className="h-5 w-5" style={{ color: colors.purple }} />
          <div className="text-lg font-bold text-white">Group Vote & 5v3v1 Wins</div>
        </div>

        {gameWins.total === 0 ? (
          <div className="py-12 text-center text-white/50">
            No game win data yet. This business hasn&apos;t been selected as a winner in any games.
          </div>
        ) : (
          <>
            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: 'Total Wins', value: gameWins.total, color: colors.purple },
                { label: 'Group Vote Wins', value: gameWins.groupVote, color: '#bf5fff' },
                { label: '5v3v1 Wins', value: gameWins.fiveThreeOne, color: '#ff2d92' },
                { label: 'Avg Group Size', value: avgGroupSize > 0 ? avgGroupSize.toFixed(1) : '—', color: colors.primary },
              ].map((item, idx) => (
                <div key={idx} className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
                  <div className="mb-1 text-xs text-white/50">{item.label}</div>
                  <div className="font-mono text-2xl font-bold" style={{ color: item.color }}>{item.value}</div>
                </div>
              ))}
            </div>

            {gameWinsByMonth.length > 0 && (
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={gameWinsByMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.10)" />
                    <XAxis dataKey="month" stroke="rgba(255,255,255,0.5)" />
                    <YAxis stroke="rgba(255,255,255,0.5)" allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        background: 'rgba(15, 23, 42, 0.95)',
                        border: '1px solid rgba(255,255,255,0.10)',
                        borderRadius: '8px',
                        color: 'white',
                      }}
                    />
                    <Legend />
                    <Bar dataKey="groupVote" name="Group Vote" stackId="wins" fill="#bf5fff" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="fiveThreeOne" name="5v3v1" stackId="wins" fill="#ff2d92" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </div>

      {/* Competitor Analysis */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" style={{ color: colors.secondary }} />
            <div className="text-lg font-bold text-white">Competitor Analysis</div>
          </div>
          {competitorLoading && (
            <div className="text-xs text-white/40">Loading...</div>
          )}
        </div>

        {/* Filter toggle + context label */}
        <div className="mb-6 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="mr-2 text-sm text-white/60">Compare by:</span>
            {([
              { key: 'type' as const, label: 'Business Type' },
              { key: 'category' as const, label: 'Category' },
            ]).map((opt) => {
              const active = competitorFilter === opt.key;
              const disabled = opt.key === 'category' && !competitorData?.categoryMain;
              return (
                <button
                  key={opt.key}
                  onClick={() => !disabled && setCompetitorFilter(opt.key)}
                  disabled={disabled}
                  className="min-w-[120px] rounded-lg px-4 py-2 text-sm font-semibold text-white transition"
                  style={{
                    background: active ? colors.secondary : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${active ? colors.secondary : 'rgba(255,255,255,0.20)'}`,
                    opacity: disabled ? 0.4 : 1,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Context description */}
          {competitorData && (
            <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-center">
              <div className="text-sm text-white/70">
                {competitorData.filterLabel}
              </div>
              {competitorData.businessType && (
                <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
                  <span
                    className="inline-block rounded-full px-3 py-0.5 text-xs font-semibold"
                    style={{ background: `${colors.secondary}30`, color: colors.secondary, border: `1px solid ${colors.secondary}50` }}
                  >
                    {formatTypeName(competitorData.businessType)}
                  </span>
                  {competitorFilter === 'category' && competitorData.categoryMain && (
                    <span
                      className="inline-block rounded-full px-3 py-0.5 text-xs font-semibold"
                      style={{ background: `${colors.purple}30`, color: colors.purple, border: `1px solid ${colors.purple}50` }}
                    >
                      {competitorData.categoryMain}
                    </span>
                  )}
                  <span className="text-xs text-white/40">
                    Last 365 days
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          <KpiRing
            title="Total # of Businesses"
            value={competitorData?.totalBusinesses || '—'}
            valueColor={colors.purple}
            ringColor={colors.purple}
            ringFill={competitorData && competitorData.totalBusinesses > 0 ? Math.min(100, (1 / competitorData.totalBusinesses) * 100) : 0}
            subtitle={`${competitorData?.competitorCount ?? 0} competitor${(competitorData?.competitorCount ?? 0) !== 1 ? 's' : ''} + you`}
          />
          <KpiRing
            title="Market Share by Revenue"
            value={competitorData?.marketSharePercent ? `${competitorData.marketSharePercent}%` : '—'}
            valueColor={colors.success}
            ringColor={colors.success}
            ringFill={competitorData?.marketSharePercent ?? 0}
            subtitle={competitorData?.thisBusinessStats ? `${formatCurrency0(competitorData.thisBusinessStats.revenueCents / 100)} your revenue` : 'of total revenue across similar venues'}
          />
          <KpiRing
            title="% of Total Customers"
            value={competitorData?.customerSharePercent ? `${competitorData.customerSharePercent}%` : '—'}
            valueColor={colors.primary}
            ringColor={colors.primary}
            ringFill={competitorData?.customerSharePercent ?? 0}
            subtitle={competitorData?.thisBusinessStats ? `${competitorData.thisBusinessStats.uniqueCustomers} of your customers` : 'of total customers across similar venues'}
          />
          <KpiRing
            title="% of Repeat Customers"
            value={competitorData?.repeatCustomerSharePercent ? `${competitorData.repeatCustomerSharePercent}%` : '—'}
            valueColor={colors.warning}
            ringColor={colors.warning}
            ringFill={competitorData?.repeatCustomerSharePercent ?? 0}
            subtitle={competitorData?.thisBusinessStats ? `${competitorData.thisBusinessStats.repeatCustomers} repeat customer${competitorData.thisBusinessStats.repeatCustomers !== 1 ? 's' : ''}` : 'of repeat customers across similar venues'}
          />
        </div>

        {competitorData && competitorData.competitorCount === 0 && (
          <div className="mt-6 rounded-lg border border-white/10 bg-white/5 p-4 text-center text-xs text-white/50">
            No other {formatTypeName(competitorData.businessType)} venues found on the platform yet.
            {competitorFilter === 'category' && ' Try switching to "Business Type" for a broader comparison.'}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-white/40">
        Business ID: <span className="font-mono">{businessId}</span> • Data source: receipts table
      </div>
    </div>
  );
}

// ============================================================================
// KPI Ring Component
// ============================================================================
function KpiRing(props: { title: string; value: string | number; subtitle: string; ringFill: number; ringColor: string; valueColor: string }) {
  const circumference = 314;
  const dash = Math.max(0, Math.min(100, props.ringFill));
  const dashArray = `${(dash / 100) * circumference} ${circumference}`;

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center">
      <div className="mb-4 text-sm text-white/60">{props.title}</div>

      <div className="relative mx-auto mb-4 h-[120px] w-[120px]">
        <svg width="120" height="120" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="10" />
          <circle
            cx="60"
            cy="60"
            r="50"
            fill="none"
            stroke={props.ringColor}
            strokeWidth="10"
            strokeDasharray={dashArray}
            strokeLinecap="round"
            transform="rotate(-90 60 60)"
            style={{ transition: 'stroke-dasharray 0.5s ease' }}
          />
        </svg>
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-2xl font-extrabold" style={{ color: props.valueColor }}>
          {props.value}
        </div>
      </div>

      <div className="text-xs text-white/50">{props.subtitle}</div>
    </div>
  );
}