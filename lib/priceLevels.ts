/**
 * Standardized price level definitions used across the entire app.
 * Single source of truth for $, $$, $$$, $$$$ labels and thresholds.
 */

export interface PriceLevelDef {
  value: string;       // "$", "$$", "$$$", "$$$$"
  label: string;       // "Under $15/person"
  shortLabel: string;  // "Budget", "Moderate", etc.
}

export const PRICE_LEVELS: PriceLevelDef[] = [
  { value: "$",    label: "Under $15/person",  shortLabel: "Budget" },
  { value: "$$",   label: "$15–$30/person",    shortLabel: "Moderate" },
  { value: "$$$",  label: "$30–$60/person",    shortLabel: "Upscale" },
  { value: "$$$$", label: "$60+/person",       shortLabel: "Fine Dining" },
];

/** For dropdowns: "$ (Under $15/person)" */
export function priceLevelOption(def: PriceLevelDef): string {
  return `${def.value} (${def.label})`;
}

/** Get a price level definition by value, or undefined */
export function getPriceLevelDef(value: string): PriceLevelDef | undefined {
  return PRICE_LEVELS.find((p) => p.value === value);
}

/** Validate a price level string, returning "$$" as default */
export function normalizePriceLevel(value: string | null | undefined): string {
  const v = String(value ?? "");
  return PRICE_LEVELS.some((p) => p.value === v) ? v : "$$";
}
