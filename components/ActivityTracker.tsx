"use client";

import { useEffect, useRef } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

const HEARTBEAT_INTERVAL = 5 * 60 * 1000; // 5 minutes

/**
 * Invisible client component that heartbeats user activity to the
 * user_activity table every 5 minutes. Renders nothing.
 */
export default function ActivityTracker() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    const upsertActivity = async (uid: string) => {
      // Skip when tab is hidden to avoid unnecessary writes
      if (typeof document !== "undefined" && document.hidden) return;

      await supabaseBrowser
        .from("user_activity")
        .upsert({ user_id: uid, last_seen_at: new Date().toISOString() }, { onConflict: "user_id" });
    };

    const startHeartbeat = (uid: string) => {
      userIdRef.current = uid;
      // Immediate upsert on start
      upsertActivity(uid);
      // Then every 5 minutes
      intervalRef.current = setInterval(() => upsertActivity(uid), HEARTBEAT_INTERVAL);
    };

    const stopHeartbeat = () => {
      userIdRef.current = null;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    // Check if already signed in
    supabaseBrowser.auth.getUser().then(({ data: { user } }) => {
      if (user) startHeartbeat(user.id);
    });

    // React to sign-in / sign-out
    const { data: { subscription } } = supabaseBrowser.auth.onAuthStateChange(
      (_event, session) => {
        stopHeartbeat();
        if (session?.user) startHeartbeat(session.user.id);
      }
    );

    return () => {
      stopHeartbeat();
      subscription.unsubscribe();
    };
  }, []);

  return null;
}
