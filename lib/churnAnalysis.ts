// lib/churnAnalysis.ts
// Calculates real churn rates per business per tier from actual platform data.
// Used by business dashboard analytics and admin reports.

import type { SupabaseClient } from "@supabase/supabase-js";

export interface TierChurnStat {
  tierIndex: number;
  /** Users whose window expired at this tier in the last 12 months */
  expiredCount: number;
  /** Of those, who came back within the churn window */
  returnedCount: number;
  /** Of those, who never came back */
  churnedCount: number;
  /** churnedCount / expiredCount (0-1) */
  churnRate: number;
}

export interface BusinessChurnStats {
  businessId: string;
  tierBreakdown: TierChurnStat[];
  totalExpired: number;
  totalChurned: number;
  overallChurnRate: number;
}

/**
 * Calculate churn stats for a specific business.
 *
 * Logic: For each user who had approved receipts at this business,
 * check if their anniversary window rolled over in the last 12 months.
 * If so, determine what tier they were at before the rollover,
 * and whether they submitted any receipt within `churnWindowDays` after.
 *
 * This is a heavyweight query — intended for analytics dashboards, not hot paths.
 */
export async function getBusinessChurnStats(
  supabase: SupabaseClient,
  businessId: string,
  churnWindowDays: number = 60
): Promise<BusinessChurnStats> {
  // Get all users with approved receipts at this business
  const { data: userReceipts } = await supabase
    .from("receipts")
    .select("user_id, visit_date, payout_tier_index")
    .eq("business_id", businessId)
    .eq("status", "approved")
    .order("visit_date", { ascending: true });

  if (!userReceipts || userReceipts.length === 0) {
    return { businessId, tierBreakdown: [], totalExpired: 0, totalChurned: 0, overallChurnRate: 0 };
  }

  // Get user profiles for anniversary dates
  const uniqueUserIds = [...new Set(userReceipts.map((r) => r.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, created_at")
    .in("id", uniqueUserIds);

  const profileMap = new Map<string, string>();
  for (const p of profiles ?? []) {
    profileMap.set(p.id, p.created_at);
  }

  const now = new Date();
  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  // For each user, determine if their anniversary happened in the last 12 months
  // and what their tier was just before the reset
  const tierResults: Map<number, { expired: number; returned: number }> = new Map();

  for (const userId of uniqueUserIds) {
    const createdAt = profileMap.get(userId);
    if (!createdAt) continue;

    const created = new Date(createdAt);
    // Find their most recent anniversary that's in the past
    const anniversaryThisYear = new Date(now.getFullYear(), created.getMonth(), created.getDate());
    const lastAnniversary = anniversaryThisYear <= now
      ? anniversaryThisYear
      : new Date(now.getFullYear() - 1, created.getMonth(), created.getDate());

    // Only count if this anniversary happened in the last 12 months
    if (lastAnniversary < oneYearAgo) continue;

    // Get user's receipts at this business BEFORE the anniversary
    const prevWindowStart = new Date(lastAnniversary);
    prevWindowStart.setFullYear(prevWindowStart.getFullYear() - 1);

    const preAnniversaryReceipts = userReceipts.filter(
      (r) => r.user_id === userId
        && r.visit_date >= prevWindowStart.toISOString().slice(0, 10)
        && r.visit_date < lastAnniversary.toISOString().slice(0, 10)
    );

    if (preAnniversaryReceipts.length === 0) continue;

    // Their tier was the max payout_tier_index from those receipts
    const maxTier = Math.max(...preAnniversaryReceipts.map((r) => r.payout_tier_index ?? 1));
    if (maxTier <= 1) continue; // Tier 1 users don't need protection

    // Check if they came back within churnWindowDays after anniversary
    const churnDeadline = new Date(lastAnniversary);
    churnDeadline.setDate(churnDeadline.getDate() + churnWindowDays);

    const postAnniversaryReceipts = userReceipts.filter(
      (r) => r.user_id === userId
        && r.visit_date >= lastAnniversary.toISOString().slice(0, 10)
        && r.visit_date <= churnDeadline.toISOString().slice(0, 10)
    );

    const returned = postAnniversaryReceipts.length > 0;

    const bucket = tierResults.get(maxTier) ?? { expired: 0, returned: 0 };
    bucket.expired += 1;
    if (returned) bucket.returned += 1;
    tierResults.set(maxTier, bucket);
  }

  // Build output
  const tierBreakdown: TierChurnStat[] = [];
  let totalExpired = 0;
  let totalChurned = 0;

  for (let tier = 2; tier <= 7; tier++) {
    const bucket = tierResults.get(tier);
    if (!bucket || bucket.expired === 0) {
      tierBreakdown.push({ tierIndex: tier, expiredCount: 0, returnedCount: 0, churnedCount: 0, churnRate: 0 });
      continue;
    }
    const churned = bucket.expired - bucket.returned;
    tierBreakdown.push({
      tierIndex: tier,
      expiredCount: bucket.expired,
      returnedCount: bucket.returned,
      churnedCount: churned,
      churnRate: churned / bucket.expired,
    });
    totalExpired += bucket.expired;
    totalChurned += churned;
  }

  return {
    businessId,
    tierBreakdown,
    totalExpired,
    totalChurned,
    overallChurnRate: totalExpired > 0 ? totalChurned / totalExpired : 0,
  };
}
