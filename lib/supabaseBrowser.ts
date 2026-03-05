// lib/supabaseBrowser.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";





// Prevent multiple GoTrueClient instances in Next.js dev (Fast Refresh)
// by caching the client on globalThis.
declare global {
  // eslint-disable-next-line no-var
  var __letsgo_supabaseBrowser: SupabaseClient | undefined;
}

function createBrowserClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }







  return createClient(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "letsgo-auth",
    },
  });
}

export const supabaseBrowser: SupabaseClient =
  globalThis.__letsgo_supabaseBrowser ?? createBrowserClient();

if (!globalThis.__letsgo_supabaseBrowser) {
  globalThis.__letsgo_supabaseBrowser = supabaseBrowser;
}

// DEV ONLY: expose client for console debugging
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  // @ts-ignore
  window.supabaseBrowser = supabaseBrowser;
}