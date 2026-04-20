import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * GET /api/claim/search?q=business+name
 * Search for unclaimed trial businesses by name.
 * Public endpoint — no auth required (businesses need to find themselves).
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const { data, error } = await supabaseServer
    .from("business")
    .select(`
      id, business_name, public_business_name,
      street_address, address_line1, city, state, zip,
      claim_code, category_main, config
    `)
    .eq("billing_plan", "trial")
    .not("seeded_at", "is", null)
    .ilike("business_name", `%${q}%`)
    .order("business_name")
    .limit(20);

  if (error) {
    console.error("[claim/search] Error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }

  const results = (data || []).map((b) => {
    const cfg = (b.config || {}) as Record<string, unknown>;
    const images = Array.isArray(cfg.images) ? cfg.images : [];
    return {
      id: b.id,
      name: b.public_business_name || b.business_name,
      address: [
        b.street_address || b.address_line1,
        b.city,
        b.state,
        b.zip,
      ].filter(Boolean).join(", "),
      category: b.category_main,
      photo: images.length > 0 ? String(images[0]) : null,
      claimCode: b.claim_code,
    };
  });

  return NextResponse.json({ results });
}
