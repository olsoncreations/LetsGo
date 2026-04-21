import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * GET /api/chains/[chainId]/locations
 * Public endpoint — returns all active locations for a chain.
 * Used by the discovery feed to show "X more locations" expandable list.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ chainId: string }> }
) {
  try {
    const { chainId } = await params;

    const { data, error } = await supabaseServer
      .from("business")
      .select("id, public_business_name, business_name, store_number, street_address, city, state, zip, is_active")
      .eq("chain_id", chainId)
      .eq("is_active", true)
      .order("store_number", { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      locations: (data || []).map((b) => ({
        id: b.id,
        name: b.public_business_name || b.business_name || "Unknown",
        storeNumber: b.store_number,
        address: [b.street_address, b.city, b.state, b.zip].filter(Boolean).join(", "),
        zip: b.zip,
      })),
    });
  } catch (err) {
    console.error("[chains/locations] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
