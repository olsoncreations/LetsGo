import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * POST /api/chains/apply
 * Submit a chain application. Creates a chains row with status "pending_review".
 * Authenticated users only — no admin required.
 */
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token)
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const { data: { user }, error: authErr } = await supabaseServer.auth.getUser(token);
    if (authErr || !user)
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const body = await req.json();
    const {
      brandName, locationCount, markets, franchiseModel,
      headquartersCity, headquartersState,
      contactName, contactTitle, contactEmail, contactPhone,
      paymentMethod, billingEmail, billingAddress,
      advertisingInterest,
    } = body as Record<string, string | string[]>;

    if (!brandName || !contactEmail) {
      return NextResponse.json({ error: "Brand name and contact email are required" }, { status: 400 });
    }

    const code = String(brandName).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
    const chainId = `CHN-${code}-0`;

    const { error: insertErr } = await supabaseServer
      .from("chains")
      .insert({
        id: chainId,
        brand_name: String(brandName).trim(),
        chain_code: code,
        status: "pending_review",
        franchise_model: franchiseModel || "corporate",
        contact_name: contactName || null,
        contact_title: contactTitle || null,
        contact_email: contactEmail || null,
        contact_phone: contactPhone || null,
        billing_email: billingEmail || null,
        billing_address: billingAddress || null,
        payment_method: paymentMethod || null,
        advertising_interests: Array.isArray(advertisingInterest) ? advertisingInterest : [],
        internal_notes: `Application: ${locationCount || "?"} locations, markets: ${markets || "—"}, HQ: ${headquartersCity || "?"}, ${headquartersState || "?"}`,
      });

    if (insertErr) {
      if (insertErr.code === "23505") {
        return NextResponse.json(
          { error: "A chain application with this brand name already exists. Contact support if this is your brand." },
          { status: 409 }
        );
      }
      console.error("[chains/apply] insert error:", insertErr);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ message: "Application submitted", chainId });
  } catch (err) {
    console.error("[chains/apply] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
