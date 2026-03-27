"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Script from "next/script";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import AdminNav from "@/components/admin/AdminNav";
import AdminHeader from "@/components/admin/AdminHeader";
import { COLORS } from "@/components/admin/constants";
import { StaffProvider, useStaffContext } from "@/components/admin/StaffContext";
import { canAccessRoute, NAV_PERMISSIONS } from "@/components/admin/permissions";

/** Inner component that can use StaffContext (must be inside StaffProvider). */
function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { permissions, loading } = useStaffContext();

  if (loading) return <>{children}</>;

  if (!canAccessRoute(permissions, pathname)) {
    // Figure out what permission they're missing
    const match = pathname.match(/^\/admin\/([^/]+)/);
    const key = match?.[1] || "";
    const required = NAV_PERMISSIONS[key] || "access";

    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 12,
          padding: 40,
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 4 }}>🔒</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Access Denied</div>
        <div style={{ fontSize: 13, color: COLORS.textSecondary, textAlign: "center", maxWidth: 400 }}>
          Your role does not have the <strong style={{ color: COLORS.neonPink }}>{required}</strong> permission
          required to view this page. Contact your administrator to update your role.
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [loading, setLoading] = useState(true);
  const [isStaff, setIsStaff] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Skip auth check on login page
  const isLoginPage = pathname === "/admin/login";

  useEffect(() => {
    if (isLoginPage) {
      setLoading(false);
      return;
    }

    async function checkAuth() {
      try {
        const { data: sessionData } = await supabaseBrowser.auth.getSession();
        const session = sessionData?.session;

        if (!session) {
          router.replace("/admin/login");
          return;
        }

        setUserEmail(session.user?.email || null);

        // Check if user is staff
        const { data: staffData, error: staffErr } = await supabaseBrowser.rpc(
          "is_staff"
        );

        if (staffErr || !staffData) {
          router.replace("/admin/login");
          return;
        }

        setIsStaff(true);
      } catch (err) {
        console.error("Auth check error:", err);
        router.replace("/admin/login");
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, [router, isLoginPage]);

  // Login page renders without layout
  if (isLoginPage) {
    return <>{children}</>;
  }

  // Loading state
  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: COLORS.darkBg,
          color: COLORS.textPrimary,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 14, marginBottom: 8 }}>Loading...</div>
          <div style={{ fontSize: 12, color: COLORS.textSecondary }}>
            Checking authentication
          </div>
        </div>
      </div>
    );
  }

  // Not authorized
  if (!isStaff) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: COLORS.darkBg,
          color: COLORS.textPrimary,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 14, marginBottom: 8 }}>Access Denied</div>
          <div style={{ fontSize: 12, color: COLORS.textSecondary }}>
            You are not authorized to view this page.
          </div>
        </div>
      </div>
    );
  }

  // Authorized — render full layout with RBAC context
  return (
    <StaffProvider>
      {/* Google Maps API for address autocomplete */}
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`}
        strategy="afterInteractive"
        onLoad={() => {}}
        onError={(e) => {
          console.error("[AdminLayout] Google Maps API failed to load:", e);
        }}
      />

      <div
        style={{
          minHeight: "100vh",
          background: COLORS.darkBg,
          color: COLORS.textPrimary,
          display: "flex",
        }}
      >
        <AdminNav />
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <AdminHeader userEmail={userEmail} />
          <main style={{ flex: 1, overflowY: "auto" }}>
            <RouteGuard>{children}</RouteGuard>
          </main>
        </div>
      </div>
    </StaffProvider>
  );
}
