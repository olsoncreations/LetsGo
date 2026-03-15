"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { hasPermission } from "@/components/admin/permissions";

interface RoleConfig {
  id: string;
  name: string;
  permissions: string[];
}

// Must match the defaults in settings/page.tsx DEFAULT_SETTINGS.roles_config
const DEFAULT_ROLES: RoleConfig[] = [
  { id: "admin", name: "Administrator", permissions: ["all"] },
  { id: "operations_manager", name: "Operations Manager", permissions: [
    "view_overview", "view_executive", "view_analytics", "view_health",
    "view_receipts", "manage_receipts", "view_billing", "manage_billing",
    "view_onboarding", "manage_onboarding", "view_businesses", "manage_businesses",
    "view_events", "manage_events", "view_ugc", "manage_ugc",
    "view_users", "manage_users", "view_payouts", "manage_payouts",
    "view_referrals", "view_support", "manage_support",
    "view_fraud", "manage_fraud", "view_messaging", "manage_messaging",
    "view_automation", "view_promotions", "view_audit", "view_training",
  ] },
  { id: "finance_manager", name: "Finance Manager", permissions: [
    "view_overview", "view_executive", "view_analytics", "view_health",
    "view_receipts", "manage_receipts", "view_billing", "manage_billing",
    "view_payouts", "manage_payouts", "view_referrals",
    "view_fraud", "manage_fraud", "view_audit", "view_training",
  ] },
  { id: "sales_manager", name: "Sales Manager", permissions: [
    "view_overview", "view_executive", "view_analytics", "view_health",
    "view_businesses", "view_users", "view_referrals", "manage_referrals",
    "view_sales", "manage_sales", "view_advertising", "manage_advertising",
    "view_promotions", "manage_promotions", "view_support", "view_training",
  ] },
  { id: "sales_rep", name: "Sales Rep", permissions: [
    "view_overview", "view_analytics",
    "view_businesses", "view_referrals",
    "view_sales", "view_advertising", "view_training",
  ] },
  { id: "marketing_manager", name: "Marketing Manager", permissions: [
    "view_overview", "view_executive", "view_analytics", "view_health",
    "view_businesses", "view_events", "manage_events",
    "view_ugc", "manage_ugc", "view_advertising", "manage_advertising",
    "view_promotions", "manage_promotions", "view_messaging", "manage_messaging",
    "view_training",
  ] },
  { id: "content_moderator", name: "Content Moderator", permissions: [
    "view_overview", "view_ugc", "manage_ugc",
    "view_events", "manage_events", "view_messaging", "manage_messaging",
    "view_support", "manage_support", "view_training",
  ] },
  { id: "support_agent", name: "Support Agent", permissions: [
    "view_overview", "view_users", "view_businesses", "view_receipts",
    "view_support", "manage_support", "view_messaging", "manage_messaging",
    "view_training",
  ] },
  { id: "compliance_officer", name: "Compliance Officer", permissions: [
    "view_overview", "view_executive", "view_analytics", "view_health",
    "view_receipts", "view_users", "view_businesses",
    "view_fraud", "manage_fraud", "view_audit",
    "view_billing", "view_payouts", "view_settings", "view_training",
  ] },
  { id: "senior_staff", name: "Senior Staff", permissions: [
    "view_overview", "view_executive", "view_analytics", "view_health",
    "view_receipts", "manage_receipts", "view_users",
    "view_businesses", "view_payouts", "manage_payouts",
    "view_support", "manage_support", "view_fraud",
    "view_audit", "view_training",
  ] },
  { id: "staff", name: "Staff", permissions: [
    "view_overview", "view_receipts",
    "view_support", "manage_support", "view_training",
  ] },
  { id: "viewer", name: "Viewer", permissions: [
    "view_overview", "view_training",
  ] },
];

interface StaffContextValue {
  userId: string;
  role: string;
  roleName: string;
  permissions: string[];
  /** Shorthand: returns true if the user has the given permission (or "all"). */
  can: (perm: string) => boolean;
  loading: boolean;
}

const StaffContext = createContext<StaffContextValue>({
  userId: "",
  role: "",
  roleName: "",
  permissions: [],
  can: () => false,
  loading: true,
});

export function useStaffContext() {
  return useContext(StaffContext);
}

export function StaffProvider({ children }: { children: React.ReactNode }) {
  const [value, setValue] = useState<StaffContextValue>({
    userId: "",
    role: "",
    roleName: "",
    permissions: [],
    can: () => false,
    loading: true,
  });

  const resolve = useCallback(async () => {
    try {
      // 1. Get current user
      const { data: { user } } = await supabaseBrowser.auth.getUser();
      if (!user) return;

      // 2. Get their staff_users row (RLS allows own row)
      const { data: staffRow } = await supabaseBrowser
        .from("staff_users")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      const userRole = staffRow?.role || "";

      // 3. Get roles_config from platform_settings
      const { data: settingsRow } = await supabaseBrowser
        .from("platform_settings")
        .select("roles_config")
        .eq("id", 1)
        .maybeSingle();

      const rolesConfig: RoleConfig[] =
        (Array.isArray(settingsRow?.roles_config) && settingsRow.roles_config.length > 0)
          ? settingsRow.roles_config
          : DEFAULT_ROLES;

      // 4. Match role → config → permissions (case-insensitive)
      const roleLower = userRole.toLowerCase();
      const matched = rolesConfig.find((r) => r.id.toLowerCase() === roleLower);
      const permissions = matched?.permissions || ["view_only"];
      const roleName = matched?.name || userRole || "Unknown";

      setValue({
        userId: user.id,
        role: userRole,
        roleName,
        permissions,
        can: (perm: string) => hasPermission(permissions, perm),
        loading: false,
      });
    } catch (err) {
      console.error("StaffContext error:", err);
      // On error, set view_only as safest fallback
      setValue((prev) => ({
        ...prev,
        permissions: ["view_only"],
        can: (perm: string) => hasPermission(["view_only"], perm),
        loading: false,
      }));
    }
  }, []);

  useEffect(() => {
    resolve();
  }, [resolve]);

  return (
    <StaffContext.Provider value={value}>
      {children}
    </StaffContext.Provider>
  );
}
