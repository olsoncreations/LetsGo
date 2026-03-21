"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function AdminPage() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      if (!session?.user) {
        router.replace("/admin/login");
        return;
      }
      // Verify staff role
      const { data: staff } = await supabaseBrowser
        .from("staff_users")
        .select("user_id")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (!staff) {
        router.replace("/admin/login");
        return;
      }
      setChecked(true);
    })();
  }, [router]);

  useEffect(() => {
    if (checked) router.replace("/admin/overview");
  }, [checked, router]);

  return null;
}
