// lib/payoutEngine.ts

/** Convert a dollar amount (number or string) into integer cents */
export function dollarsToCents(input: number | string): number {
  const n =
    typeof input === "string" ? parseFloat(input.trim() || "0") : input;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

/** Shape of a row in the business_payout_tiers table */
export type DbTierRow = {
  tier_index: number;
  min_visits: number;
  max_visits: number | null;
  percent_bps: number; // basis points, e.g. 500 = 5.00%
  label: string | null;
};

export type EvaluateFromDbArgs = {
  tiers: DbTierRow[];
  visitCountThisWindow: number; // how many visits INCLUDING this one
  receiptTotalCents: number;
};

export type EvaluateFromDbResult = {
  tier: DbTierRow | null;
  payoutCents: number;
  visitCountThisWindow: number;
  debug: {
    /** decimal percent, e.g. 0.05 for 5% */
    percent: number;
  };
};

/**
 * Given DB tiers + visit count + receipt total, figure out:
 * - which tier applies
 * - how many cents to pay out
 */
export function evaluateFromDbTiers(
  args: EvaluateFromDbArgs
): EvaluateFromDbResult {
  const { tiers, visitCountThisWindow, receiptTotalCents } = args;

  if (!tiers || tiers.length === 0) {
    return {
      tier: null,
      payoutCents: 0,
      visitCountThisWindow,
      debug: { percent: 0 },
    };
  }

  const sorted = [...tiers].sort(
    (a, b) => a.tier_index - b.tier_index
  );

  // Find the first tier whose min/max range contains the visit count,
  // otherwise fall back to the highest tier.
  const tier =
    sorted.find(
      (t) =>
        visitCountThisWindow >= t.min_visits &&
        (t.max_visits == null || visitCountThisWindow <= t.max_visits)
    ) ?? sorted[sorted.length - 1];

  const percent = tier.percent_bps / 10000; // 500 bps → 0.05
  const payoutCents = Math.round(receiptTotalCents * percent);

  return {
    tier,
    payoutCents,
    visitCountThisWindow,
    debug: { percent },
  };
}