/**
 * Admin RBAC — permission-to-page mapping and helpers.
 *
 * Permission strings match ALL_PERMISSIONS in settings/page.tsx.
 * "all" grants access to everything (Administrator role).
 * null means the page is accessible to every staff member.
 *
 * Two-tier system:
 *   view_<area>   → read-only page access
 *   manage_<area> → edit/approve/create/delete actions within the page
 *   manage_* implicitly grants view_* for the same area.
 */

// Maps each admin nav key to the view permission required to see/access it.
// `null` means the page is accessible to every staff member.
// Overview is intentionally open: it's the universal landing page after
// /admin redirects, so no staff member should get hard-walled there.
export const NAV_PERMISSIONS: Record<string, string | null> = {
  overview: null,
  executive: "view_executive",
  analytics: "view_analytics",
  health: "view_health",
  receipts: "view_receipts",
  billing: "view_billing",
  onboarding: "view_onboarding",
  businesses: "view_businesses",
  events: "view_events",
  ugc: "view_ugc",
  users: "view_users",
  payouts: "view_payouts",
  referrals: "view_referrals",
  sales: "view_sales",
  advertising: "view_advertising",
  support: "view_support",
  fraud: "view_fraud",
  messaging: "view_messaging",
  automation: "view_automation",
  promotions: "view_promotions",
  audit: "view_audit",
  settings: "view_settings",
  training: "view_training",
  "custom-reports": "view_executive",
};

/**
 * Legacy permission expansion map.
 * Old permission IDs (pre-granular) automatically grant the new
 * page-level permissions they previously covered, so existing
 * role configs stored in the DB keep working.
 */
const LEGACY_EXPANSIONS: Record<string, string[]> = {
  view_analytics: ["view_executive", "view_analytics", "view_health", "view_referrals", "view_fraud"],
  manage_settings: ["view_billing", "view_automation", "view_audit", "view_settings", "manage_billing", "manage_automation", "manage_settings"],
  view_businesses: ["view_businesses", "view_onboarding", "view_events", "view_ugc"],
  edit_businesses: ["manage_businesses", "manage_onboarding", "manage_events", "manage_ugc"],
  manage_advertising: ["view_sales", "view_advertising", "view_promotions", "manage_sales", "manage_advertising", "manage_promotions"],
  manage_support: ["view_support", "view_messaging", "manage_support", "manage_messaging"],
  approve_receipts: ["manage_receipts"],
  edit_users: ["manage_users"],
  approve_payouts: ["view_payouts", "manage_payouts"],
  view_receipts: ["view_receipts"],
  view_users: ["view_users"],
};

/** Expand legacy permissions into granular ones. */
export function expandPermissions(rawPerms: string[]): string[] {
  const expanded = new Set(rawPerms);
  for (const p of rawPerms) {
    const legacy = LEGACY_EXPANSIONS[p];
    if (legacy) {
      for (const lp of legacy) expanded.add(lp);
    }
  }
  // manage_* always implies view_*
  for (const p of Array.from(expanded)) {
    if (p.startsWith("manage_")) {
      expanded.add("view_" + p.slice(7));
    }
  }
  return Array.from(expanded);
}

/** Returns true if the user's permissions include the required one. */
export function hasPermission(userPerms: string[], required: string): boolean {
  if (userPerms.includes("all")) return true;
  const expanded = expandPermissions(userPerms);
  return expanded.includes(required);
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
