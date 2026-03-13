import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

// ── GET — Public commission rates for the sales rep application page ──
// No auth required — only exposes commission rate values, nothing sensitive
export async function GET() {
  const KEYS = ["basic_signup", "premium_signup", "advertising_per_100"];
  const DEFAULTS: Record<string, number> = {
    basic_signup: 2500,
    premium_signup: 10000,
    advertising_per_100: 1000,
  };

  const { data, error } = await supabaseServer
    .from("sales_config")
    .select("key, value_cents")
    .in("key", KEYS);

  if (error) {
    console.error("[sales-config] Fetch error:", error.message);
    return NextResponse.json({ error: "Failed to load commission rates" }, { status: 500 });
  }

  const rates: Record<string, number> = {};
  for (const key of KEYS) {
    const row = data?.find((r) => r.key === key);
    rates[key] = row?.value_cents ?? DEFAULTS[key];
  }

  return NextResponse.json({ rates });
}
