/**
 * Admin RBAC — permission-to-page mapping and helpers.
 *
 * Permission strings match ALL_PERMISSIONS in settings/page.tsx.
 * "all" grants access to everything (Administrator role).
 * null means the page is accessible to every staff member.
 */

// Maps each admin nav key to the permission required to see/access it.
// null = accessible to everyone (including view_only roles).
export const NAV_PERMISSIONS: Record<string, string | null> = {
  overview: null,
  training: null,
  executive: "view_analytics",
  analytics: "view_analytics",
  health: "view_analytics",
  receipts: "view_receipts",
  billing: "manage_settings",
  onboarding: "view_businesses",
  businesses: "view_businesses",
  events: "view_businesses",
  ugc: "view_businesses",
  users: "view_users",
  payouts: "approve_payouts",
  referrals: "view_analytics",
  sales: "manage_advertising",
  advertising: "manage_advertising",
  support: "manage_support",
  fraud: "view_analytics",
  messaging: "manage_support",
  automation: "manage_settings",
  promotions: "manage_advertising",
  audit: "manage_settings",
  settings: "manage_settings",
};

/** Returns true if the user's permissions include the required one. */
export function hasPermission(userPerms: string[], required: string): boolean {
  if (userPerms.includes("all")) return true;
  return userPerms.includes(required);
}

/** Returns the permission required for a nav key, or null if open to all. */
export function getNavPermission(navKey: string): string | null {
  return NAV_PERMISSIONS[navKey] ?? null;
}

/** Checks whether a user can access a given /admin/* pathname. */
export function canAccessRoute(userPerms: string[], pathname: string): boolean {
  // Extract the admin sub-path, e.g. "/admin/settings" → "settings"
  const match = pathname.match(/^\/admin\/([^/]+)/);
  if (!match) return true; // non-admin route or /admin root
  const key = match[1];

  const required = NAV_PERMISSIONS[key];
  if (required === null || required === undefined) return true; // open to all
  return hasPermission(userPerms, required);
}
