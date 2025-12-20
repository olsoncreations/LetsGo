import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseServer";

/**
 * Next.js 16 (as deployed on Vercel) types route handler context.params as a Promise.
 * So we accept `params` as a Promise and await it.
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ businessId: string }> }
): Promise<Response> {
  const { businessId } = await context.params;

  const { data: tiers, error } = await supabase
    .from("business_payout_tiers")
    .select("tier_index, min_visits, max_visits, percent_bps, label")
    .eq("business_id", businessId)
    .order("tier_index", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Failed to load payout tiers", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { tiers: tiers ?? [] },
    { status: 200 }
  );
}
