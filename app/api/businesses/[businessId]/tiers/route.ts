import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseServer";

export async function GET(
  _req: NextRequest,
  { params }: { params: { businessId: string } }
) {
  const businessId = params.businessId;

  const { data, error } = await supabase
    .from("business_payout_tiers")
    .select("tier_index, min_visits, max_visits, percent_bps, label")
    .eq("business_id", businessId)
    .order("tier_index", { ascending: true });

  if (error) {
    console.error("tiers API error:", error);
    return NextResponse.json(
      { error: "Failed to load payout tiers", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ tiers: data ?? [] }, { status: 200 });
}