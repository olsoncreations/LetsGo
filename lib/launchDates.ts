// ═══════════════════════════════════════════════════
// LETSGO LAUNCH TIMELINE
// Central config for all launch phase dates
// ═══════════════════════════════════════════════════

export const LAUNCH_DATES = {
  LAUNCH: "2026-05-01",
  BILLS_DUE: "2026-06-01",
  CASHOUTS_OPEN: "2026-07-01",
} as const;

export type LaunchPhase =
  | "pre_launch"     // now → May 1
  | "live"           // May 1 → July 1 (rewards active, no cashouts yet)
  | "fully_live";    // July 1+ (cashouts open, bills already collecting)

export function getCurrentPhase(): LaunchPhase {
  const today = new Date().toISOString().slice(0, 10);
  if (today < LAUNCH_DATES.LAUNCH) return "pre_launch";
  if (today < LAUNCH_DATES.CASHOUTS_OPEN) return "live";
  return "fully_live";
}

export function isCashoutOpen(): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return today >= LAUNCH_DATES.CASHOUTS_OPEN;
}

/** Returns days until a target date. Negative if date has passed. */
export function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/** Human-friendly countdown: "12 days", "tomorrow", "today" */
export function countdownLabel(dateStr: string): string {
  const d = daysUntil(dateStr);
  if (d <= 0) return "now";
  if (d === 1) return "tomorrow";
  return `${d} days`;
}
