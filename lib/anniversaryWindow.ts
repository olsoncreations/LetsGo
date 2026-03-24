// lib/anniversaryWindow.ts
// Shared utility for computing anniversary-based rolling windows.
// Used by: receipts API, tier extension pricing API, profile page.

/**
 * Given a user's account creation date, returns the start of their
 * current 365-day anniversary window as a YYYY-MM-DD string.
 *
 * The window runs from their most recent anniversary to the next one.
 * Example: created Jan 15 2025, today is Mar 23 2026 →
 *   anniversary this year = Jan 15 2026 (already passed)
 *   window start = Jan 15 2026
 */
export function getAnniversaryWindowStart(accountCreatedAt: string): string {
  const created = new Date(accountCreatedAt);
  const now = new Date();

  // Build this year's anniversary date
  const anniversaryThisYear = new Date(
    now.getFullYear(),
    created.getMonth(),
    created.getDate()
  );

  // If the anniversary hasn't happened yet this year, the window started last year's anniversary
  const windowStart = anniversaryThisYear <= now
    ? anniversaryThisYear
    : new Date(now.getFullYear() - 1, created.getMonth(), created.getDate());

  return windowStart.toISOString().slice(0, 10);
}

/**
 * Returns the user's NEXT anniversary date (when their current window expires).
 * This is the date when their tiers would reset without an extension.
 */
export function getNextAnniversaryDate(accountCreatedAt: string): Date {
  const created = new Date(accountCreatedAt);
  const now = new Date();

  const anniversaryThisYear = new Date(
    now.getFullYear(),
    created.getMonth(),
    created.getDate()
  );

  if (anniversaryThisYear > now) {
    return anniversaryThisYear;
  }

  // Next anniversary is next year
  return new Date(
    now.getFullYear() + 1,
    created.getMonth(),
    created.getDate()
  );
}

/**
 * Returns the number of days until the user's next anniversary (tier reset).
 */
export function daysUntilAnniversary(accountCreatedAt: string): number {
  const next = getNextAnniversaryDate(accountCreatedAt);
  const now = new Date();
  const diffMs = next.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}
