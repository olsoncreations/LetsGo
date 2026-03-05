/**
 * Shared audit logging utility for admin dashboard.
 * Fire-and-forget — never blocks the UI or breaks the calling action.
 */
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export interface AuditParams {
  /** The action performed, e.g. "approve_receipt" */
  action: string;
  /** Which admin tab: "Receipts", "Settings", etc. */
  tab: string;
  /** The type of entity affected: "receipt", "user", "business", etc. */
  targetType: string;
  /** Sub-tab within the tab, e.g. "Surge Pricing", "Staff Management" */
  subTab?: string;
  /** ID of the target entity */
  targetId?: string;
  /** Human-readable name: business name, user name, influencer name */
  entityName?: string;
  /** Specific field that was changed, e.g. "status", "email" */
  fieldName?: string;
  /** Value before the change */
  oldValue?: string;
  /** Value after the change */
  newValue?: string;
  /** Whether this is a report/data download */
  isDownload?: boolean;
  /** Additional context */
  details?: string;
  /** Override staff info (rare) */
  staffId?: string;
  staffName?: string;
}

/** Tab name constants to prevent typos across call sites. */
export const AUDIT_TABS = {
  RECEIPTS: "Receipts",
  USERS: "Users",
  BUSINESSES: "Businesses",
  PAYOUTS: "Payouts",
  SETTINGS: "Settings",
  ONBOARDING: "Onboarding",
  ADVERTISING: "Advertising",
  AUTOMATION: "Automation",
  FRAUD: "Fraud",
  MESSAGING: "Messaging",
  PROMOTIONS: "Promotions",
  SUPPORT: "Support",
  SALES: "Sales",
  REFERRALS: "Referrals",
  HEALTH: "Health",
  EVENTS: "Events",
  BILLING: "Billing",
  UGC: "UGC",
  TRAINING: "Training",
} as const;

// Cache the current user so we don't re-fetch on every call
let _cachedUser: { id: string; name: string; role: string } | null = null;

async function resolveUser(): Promise<{ id: string; name: string; role: string }> {
  if (_cachedUser) return _cachedUser;
  try {
    const { data: { user } } = await supabaseBrowser.auth.getUser();
    if (!user) return { id: "", name: "", role: "" };

    const { data: staff } = await supabaseBrowser
      .from("staff_users")
      .select("name, role")
      .eq("user_id", user.id)
      .maybeSingle();

    _cachedUser = { id: user.id, name: staff?.name || "", role: staff?.role || "" };
    return _cachedUser;
  } catch {
    return { id: "", name: "", role: "" };
  }
}

/**
 * Log an admin action to the audit_logs table.
 * Fire-and-forget: errors are silently caught so the calling action is never affected.
 */
export function logAudit(params: AuditParams): void {
  // Intentionally not awaited — fire and forget
  (async () => {
    try {
      const user = params.staffId
        ? { id: params.staffId, name: params.staffName || "", role: "" }
        : await resolveUser();

      await supabaseBrowser.from("audit_logs").insert({
        action: params.action,
        tab: params.tab || "",
        sub_tab: params.subTab || "",
        target_type: params.targetType,
        target_id: params.targetId || "",
        target_name: params.entityName || "",
        entity_name: params.entityName || "",
        entity_type: params.targetType,
        field_name: params.fieldName || "",
        old_value: params.oldValue || "",
        new_value: params.newValue || "",
        is_download: params.isDownload || false,
        staff_id: user.id || null,
        staff_name: user.name || params.staffName || "",
        staff_role: user.role || "",
        details: params.details || "",
        timestamp: new Date().toISOString(),
      });
    } catch {
      // Silent — audit logging must never break admin actions
    }
  })();
}
