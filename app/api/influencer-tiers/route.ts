import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * Public endpoint — returns the default influencer rate tiers
 * so the application form can display current payout rates.
 */
export async function GET() {
  const { data, error } = await supabaseServer
    .from("platform_settings")
    .select("default_influencer_tiers")
    .limit(1)
    .maybeSingle();

  if (error || !data?.default_influencer_tiers) {
    return NextResponse.json({ tiers: [] });
  }

  return NextResponse.json({ tiers: data.default_influencer_tiers });
}
