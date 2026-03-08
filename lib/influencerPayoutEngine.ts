/**
 * Influencer Payout Engine — Tax-bracket style tier calculation
 *
 * Each signup earns the rate of the tier it falls into based on
 * cumulative lifetime signups (like tax brackets).
 */

export interface InfluencerRateTier {
  tier_index: number;
  min_signups: number;
  max_signups: number | null; // null = unlimited
  rate_cents: number; // dollars per signup in cents (3000 = $30.00)
  label: string | null;
}

export interface TierBreakdownItem {
  tier: InfluencerRateTier;
  signupsInTier: number;
  amountCents: number;
}

export interface BracketPayoutResult {
  totalCents: number;
  breakdown: TierBreakdownItem[];
}

/**
 * Calculate payout using tax-bracket style tiers.
 *
 * @param tiers - The influencer's rate tiers (will be sorted by tier_index)
 * @param previousLifetimeSignups - Total signups BEFORE the current period
 * @param periodSignups - Number of new signups in the current period
 * @returns Total payout in cents and per-tier breakdown
 *
 * @example
 * // Tiers: 1-50 → $30, 51-200 → $25, 201+ → $20
 * // Influencer had 40 signups, got 25 new ones this period
 * // Signups 41-50 (10) at $30 = $300
 * // Signups 51-65 (15) at $25 = $375
 * // Total: $675.00
 * calculateBracketPayout(tiers, 40, 25)
 * // => { totalCents: 67500, breakdown: [...] }
 */
export function calculateBracketPayout(
  tiers: InfluencerRateTier[],
  previousLifetimeSignups: number,
  periodSignups: number
): BracketPayoutResult {
  if (periodSignups <= 0 || tiers.length === 0) {
    return { totalCents: 0, breakdown: [] };
  }

  const sorted = [...tiers].sort((a, b) => a.tier_index - b.tier_index);
  const breakdown: TierBreakdownItem[] = [];
  let totalCents = 0;
  let signupsRemaining = periodSignups;
  let currentPosition = previousLifetimeSignups + 1; // 1-indexed position of next signup

  for (const tier of sorted) {
    if (signupsRemaining <= 0) break;

    const tierMin = tier.min_signups;
    const tierMax = tier.max_signups ?? Infinity;

    // Skip tiers entirely below our current position
    if (tierMax < currentPosition) continue;

    // Calculate how many of this period's signups fall in this tier
    const effectiveStart = Math.max(tierMin, currentPosition);
    const effectiveEnd = Math.min(tierMax, previousLifetimeSignups + periodSignups);

    if (effectiveStart > effectiveEnd) continue;

    const signupsInTier = Math.min(effectiveEnd - effectiveStart + 1, signupsRemaining);
    const amountCents = signupsInTier * tier.rate_cents;

    breakdown.push({ tier, signupsInTier, amountCents });
    totalCents += amountCents;
    signupsRemaining -= signupsInTier;
    currentPosition = effectiveStart + signupsInTier;
  }

  return { totalCents, breakdown };
}

/**
 * Find which tier a specific signup count falls into.
 * Used to show "Current position: Tier X" on influencer profile.
 */
export function getCurrentTier(
  tiers: InfluencerRateTier[],
  totalSignups: number
): InfluencerRateTier | null {
  const sorted = [...tiers].sort((a, b) => a.tier_index - b.tier_index);

  for (const tier of sorted) {
    const tierMax = tier.max_signups ?? Infinity;
    if (totalSignups >= tier.min_signups && totalSignups <= tierMax) {
      return tier;
    }
  }

  // If totalSignups is 0, return first tier
  if (totalSignups === 0 && sorted.length > 0) {
    return sorted[0];
  }

  return null;
}

/**
 * Format rate_cents as a dollar string: 3000 → "$30.00"
 */
export function formatRateCents(rateCents: number): string {
  return `$${(rateCents / 100).toFixed(2)}`;
}
