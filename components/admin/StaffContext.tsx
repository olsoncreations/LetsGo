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
  { id: "senior_staff", name: "Senior Staff", permissions: ["view_receipts", "approve_receipts", "view_users", "view_businesses", "approve_payouts", "manage_support", "view_analytics"] },
  { id: "staff", name: "Staff", permissions: ["view_receipts", "manage_support"] },
  { id: "viewer", name: "Viewer", permissions: ["view_only"] },
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
