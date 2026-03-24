// lib/tierExtensionPricing.ts
// Pure pricing calculations for Premium Tier Extensions.
// No database calls — all inputs are pre-fetched and passed in.

import type { DbTierRow } from "./payoutEngine";

// ==================== TYPES ====================

export interface SilverPricingInput {
  businessId: string;
  businessName: string;
  /** User's current tier index (1-7) */
  currentTierIndex: number;
  /** Current tier's payout in basis points (e.g. 1000 = 10%) */
  currentTierBps: number;
  /** Tier 1's payout in basis points (e.g. 500 = 5%) */
  tier1Bps: number;
  /** Average receipt amount in cents from user's history at this business */
  avgTicketCents: number;
  /** User's actual visits per month at this business */
  visitsPerMonth: number;
  /** Days until the user's anniversary window expires */
  daysUntilExpiry: number;
}

export interface SilverPrices {
  businessId: string;
  businessName: string;
  currentTierIndex: number;
  /** Reward cents lost per visit if tier resets */
  lostPerVisitCents: number;
  /** Reward cents lost per month if tier resets */
  lostPerMonthCents: number;
  /** Lost over 6 months */
  lostOver6MoCents: number;
  /** Lost over 12 months */
  lostOver12MoCents: number;
  /** Silver 6-month extension price in cents */
  silver6PriceCents: number;
  /** Silver 12-month extension price in cents */
  silver12PriceCents: number;
  /** True if user is at tier 1 — nothing to protect */
  nothingToProtect: boolean;
}

export interface GoldPrices {
  /** Sum of all Silver 6 prices before discount */
  silver6TotalCents: number;
  /** Sum of all Silver 12 prices before discount */
  silver12TotalCents: number;
  /** Gold 6-month price (after bundle discount) */
  gold6PriceCents: number;
  /** Gold 12-month price (after bundle discount) */
  gold12PriceCents: number;
  /** How much the user saves with Gold 6 vs buying all Silvers */
  gold6SavingsCents: number;
  /** How much the user saves with Gold 12 vs buying all Silvers */
  gold12SavingsCents: number;
  /** Per-business breakdown for proportional credit splitting */
  businessShares: { businessId: string; proportion: number }[];
}

export interface TierExtensionConfig {
  silver6FeePct: number;   // default 60
  silver12FeePct: number;  // default 50
  goldDiscountPct: number; // default 15
  letsgoSplitPct: number;  // default 90
  churnWindowDays: number; // default 60
}

export const DEFAULT_EXTENSION_CONFIG: TierExtensionConfig = {
  silver6FeePct: 60,
  silver12FeePct: 50,
  goldDiscountPct: 15,
  letsgoSplitPct: 90,
  churnWindowDays: 60,
};

// ==================== FUNCTIONS ====================

/**
 * Calculate Silver 6 and Silver 12 prices for a single business.
 * Based on the rewards the user would lose if their tier resets to Tier 1.
 */
export function calculateSilverPrices(
  input: SilverPricingInput,
  config: TierExtensionConfig
): SilverPrices {
  const {
    businessId,
    businessName,
    currentTierIndex,
    currentTierBps,
    tier1Bps,
    avgTicketCents,
    visitsPerMonth,
  } = input;

  // If at the lowest tier, nothing to protect
  if (currentTierBps <= tier1Bps) {
    return {
      businessId,
      businessName,
      currentTierIndex,
      lostPerVisitCents: 0,
      lostPerMonthCents: 0,
      lostOver6MoCents: 0,
      lostOver12MoCents: 0,
      silver6PriceCents: 0,
      silver12PriceCents: 0,
      nothingToProtect: true,
    };
  }

  const diffBps = currentTierBps - tier1Bps;
  const lostPerVisitCents = Math.floor(avgTicketCents * diffBps / 10000);
  const lostPerMonthCents = Math.floor(lostPerVisitCents * visitsPerMonth);
  const lostOver6MoCents = lostPerMonthCents * 6;
  const lostOver12MoCents = lostPerMonthCents * 12;

  // Price = lost value × fee percentage
  const silver6PriceCents = Math.max(
    Math.floor(lostOver6MoCents * config.silver6FeePct / 100),
    99 // minimum $0.99
  );
  const silver12PriceCents = Math.max(
    Math.floor(lostOver12MoCents * config.silver12FeePct / 100),
    99 // minimum $0.99
  );

  return {
    businessId,
    businessName,
    currentTierIndex,
    lostPerVisitCents,
    lostPerMonthCents,
    lostOver6MoCents,
    lostOver12MoCents,
    silver6PriceCents,
    silver12PriceCents,
    nothingToProtect: false,
  };
}

/**
 * Calculate Gold prices (all businesses bundled with discount).
 * Also computes per-business proportion for credit splitting.
 */
export function calculateGoldPrices(
  silvers: SilverPrices[],
  config: TierExtensionConfig
): GoldPrices {
  // Filter out businesses with nothing to protect
  const eligible = silvers.filter((s) => !s.nothingToProtect);

  const silver6TotalCents = eligible.reduce((sum, s) => sum + s.silver6PriceCents, 0);
  const silver12TotalCents = eligible.reduce((sum, s) => sum + s.silver12PriceCents, 0);

  const discountMultiplier = (100 - config.goldDiscountPct) / 100;
  const gold6PriceCents = Math.floor(silver6TotalCents * discountMultiplier);
  const gold12PriceCents = Math.floor(silver12TotalCents * discountMultiplier);

  // Per-business proportion for splitting the 10% business credit
  const businessShares = eligible.map((s) => ({
    businessId: s.businessId,
    proportion: silver12TotalCents > 0
      ? s.silver12PriceCents / silver12TotalCents
      : 0,
  }));

  return {
    silver6TotalCents,
    silver12TotalCents,
    gold6PriceCents,
    gold12PriceCents,
    gold6SavingsCents: silver6TotalCents - gold6PriceCents,
    gold12SavingsCents: silver12TotalCents - gold12PriceCents,
    businessShares,
  };
}

/**
 * Calculate the revenue split for a given extension price.
 * Returns how much LetsGo keeps and how much goes to business credit(s).
 */
export function calculateRevenueSplit(
  priceCents: number,
  letsgoSplitPct: number
): { letsgoRevenueCents: number; businessCreditCents: number } {
  const letsgoRevenueCents = Math.floor(priceCents * letsgoSplitPct / 100);
  const businessCreditCents = priceCents - letsgoRevenueCents;
  return { letsgoRevenueCents, businessCreditCents };
}

/**
 * Split a Gold business credit proportionally across multiple businesses.
 * Ensures the total credits sum to exactly totalCreditCents (no rounding drift).
 */
export function splitGoldCredits(
  totalCreditCents: number,
  businessShares: { businessId: string; proportion: number }[]
): { businessId: string; creditCents: number }[] {
  if (businessShares.length === 0) return [];

  const credits = businessShares.map((s) => ({
    businessId: s.businessId,
    creditCents: Math.floor(totalCreditCents * s.proportion),
  }));

  // Distribute remainder (from rounding) to the largest-share business
  const allocated = credits.reduce((sum, c) => sum + c.creditCents, 0);
  const remainder = totalCreditCents - allocated;
  if (remainder > 0 && credits.length > 0) {
    // Sort by proportion descending, give remainder to top
    const sorted = [...credits].sort(
      (a, b) => {
        const aShare = businessShares.find((s) => s.businessId === a.businessId)?.proportion ?? 0;
        const bShare = businessShares.find((s) => s.businessId === b.businessId)?.proportion ?? 0;
        return bShare - aShare;
      }
    );
    sorted[0].creditCents += remainder;
  }

  return credits.filter((c) => c.creditCents > 0);
}

/**
 * Parse tier_extension_config from platform_settings JSONB.
 * Falls back to defaults for any missing fields.
 */
export function parseTierExtensionConfig(
  raw: Record<string, unknown> | null | undefined
): TierExtensionConfig {
  if (!raw) return { ...DEFAULT_EXTENSION_CONFIG };
  return {
    silver6FeePct: typeof raw.silver_6_fee_pct === "number" ? raw.silver_6_fee_pct : DEFAULT_EXTENSION_CONFIG.silver6FeePct,
    silver12FeePct: typeof raw.silver_12_fee_pct === "number" ? raw.silver_12_fee_pct : DEFAULT_EXTENSION_CONFIG.silver12FeePct,
    goldDiscountPct: typeof raw.gold_discount_pct === "number" ? raw.gold_discount_pct : DEFAULT_EXTENSION_CONFIG.goldDiscountPct,
    letsgoSplitPct: typeof raw.letsgo_split_pct === "number" ? raw.letsgo_split_pct : DEFAULT_EXTENSION_CONFIG.letsgoSplitPct,
    churnWindowDays: typeof raw.churn_window_days === "number" ? raw.churn_window_days : DEFAULT_EXTENSION_CONFIG.churnWindowDays,
  };
}

/**
 * Determine the effective_from date for a new extension.
 * If the user has an existing active extension for this business,
 * stack on top of its effective_until date.
 * Otherwise, use the user's next anniversary date.
 */
export function calculateEffectiveDates(
  extensionMonths: 6 | 12,
  nextAnniversaryDate: Date,
  existingExtensionUntil: Date | null
): { effectiveFrom: Date; effectiveUntil: Date } {
  const effectiveFrom = existingExtensionUntil
    ? new Date(existingExtensionUntil)
    : new Date(nextAnniversaryDate);

  const effectiveUntil = new Date(effectiveFrom);
  effectiveUntil.setMonth(effectiveUntil.getMonth() + extensionMonths);

  return { effectiveFrom, effectiveUntil };
}
