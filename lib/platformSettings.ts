/**
 * Shared platform settings utility.
 * Reads visit thresholds and BPS presets from `platform_settings` table (row id=1).
 * Usable from both client components (pass supabaseBrowser) and server routes (pass supabaseServer).
 */

// ─── Types ──────────────────────────────────────────────────

export interface VisitThreshold {
  level: number;
  min: number;
  max: number | null;
  label: string;
}

export interface PlatformTierConfig {
  visitThresholds: VisitThreshold[];
  presetBps: Record<string, number[]>;
  defaultCashbackBps: number[];
}

export interface TierConfigRow {
  level: number;
  label: string;
  minVisits: number;
  maxVisits: number | null;
}

// ─── Defaults (fallback when DB is unreachable) ─────────────

export const DEFAULT_VISIT_THRESHOLDS: VisitThreshold[] = [
  { level: 1, min: 1, max: 10, label: "Starter" },
  { level: 2, min: 11, max: 20, label: "Regular" },
  { level: 3, min: 21, max: 30, label: "Favorite" },
  { level: 4, min: 31, max: 40, label: "VIP" },
  { level: 5, min: 41, max: 50, label: "Elite" },
  { level: 6, min: 51, max: 60, label: "Legend" },
  { level: 7, min: 61, max: null, label: "Ultimate" },
];

export const DEFAULT_PRESET_BPS: Record<string, number[]> = {
  standard: [500, 750, 1000, 1250, 1500, 1750, 2000],
  conservative: [300, 400, 500, 600, 700, 800, 1000],
  aggressive: [800, 1000, 1200, 1400, 1600, 1800, 2000],
  trial: [0, 0, 0, 0, 0, 0, 0],
};

export const DEFAULT_CASHBACK_BPS = [500, 750, 1000, 1250, 1500, 1750, 2000];

// ─── Fetch from DB ──────────────────────────────────────────

/**
 * Fetches visit thresholds and BPS presets from platform_settings (id=1).
 * Pass supabaseBrowser for client or supabaseServer for API routes.
 */
export async function fetchPlatformTierConfig(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: { from: (table: string) => any },
): Promise<PlatformTierConfig> {
  try {
    const { data, error } = await supabase
      .from("platform_settings")
      .select("visit_thresholds, preset_conservative_bps, preset_standard_bps, preset_aggressive_bps, default_cashback_bps")
      .eq("id", 1)
      .maybeSingle();

    if (error || !data) {
      return {
        visitThresholds: DEFAULT_VISIT_THRESHOLDS,
        presetBps: { ...DEFAULT_PRESET_BPS },
        defaultCashbackBps: DEFAULT_CASHBACK_BPS,
      };
    }

    const vt = Array.isArray(data.visit_thresholds) && data.visit_thresholds.length === 7
      ? (data.visit_thresholds as VisitThreshold[])
      : DEFAULT_VISIT_THRESHOLDS;

    const presetBps: Record<string, number[]> = {
      conservative: Array.isArray(data.preset_conservative_bps) && data.preset_conservative_bps.length === 7
        ? (data.preset_conservative_bps as number[])
        : DEFAULT_PRESET_BPS.conservative,
      standard: Array.isArray(data.preset_standard_bps) && data.preset_standard_bps.length === 7
        ? (data.preset_standard_bps as number[])
        : DEFAULT_PRESET_BPS.standard,
      aggressive: Array.isArray(data.preset_aggressive_bps) && data.preset_aggressive_bps.length === 7
        ? (data.preset_aggressive_bps as number[])
        : DEFAULT_PRESET_BPS.aggressive,
    };

    const defaultCashbackBps = Array.isArray(data.default_cashback_bps) && data.default_cashback_bps.length === 7
      ? (data.default_cashback_bps as number[])
      : DEFAULT_CASHBACK_BPS;

    return { visitThresholds: vt, presetBps, defaultCashbackBps };
  } catch {
    return {
      visitThresholds: DEFAULT_VISIT_THRESHOLDS,
      presetBps: { ...DEFAULT_PRESET_BPS },
      defaultCashbackBps: DEFAULT_CASHBACK_BPS,
    };
  }
}

// ─── Helpers ────────────────────────────────────────────────

/** Returns "1–10 visits" or "61+ visits" */
export function getVisitRangeLabel(t: VisitThreshold): string {
  if (t.max == null) return `${t.min}+ visits`;
  return `${t.min}–${t.max} visits`;
}

/** Returns short range like "1–10" or "61+" (no "visits" suffix) */
export function getVisitRangeShort(t: VisitThreshold): string {
  if (t.max == null) return `${t.min}+`;
  return `${t.min}–${t.max}`;
}

/** Converts thresholds to the { level, label, minVisits, maxVisits } format used by save handlers */
export function thresholdsToTierConfig(thresholds: VisitThreshold[]): TierConfigRow[] {
  return thresholds.map((t) => ({
    level: t.level,
    label: `Level ${t.level}`,
    minVisits: t.min,
    maxVisits: t.max,
  }));
}

/** Get tier labels array from thresholds (e.g. ["Starter", "Regular", ...]) */
export function getTierLabels(thresholds: VisitThreshold[]): string[] {
  return thresholds.map((t) => t.label);
}

/** Get preset BPS by name with fallback to standard */
export function getPresetBps(presetName: string, presets: Record<string, number[]>): number[] {
  const key = (presetName || "standard").toLowerCase();
  return presets[key] || presets.standard || DEFAULT_PRESET_BPS.standard;
}
