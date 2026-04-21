import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * POST /api/chains/link-request
 * Business owner submits a chain code + store number to request linking.
 *
 * Body: { businessId, chainCode, storeNumber }
 */
export async function POST(req: NextRequest) {
  try {
    // --- Auth ---
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token)
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const { data: { user }, error: authErr } = await supabaseServer.auth.getUser(token);
    if (authErr || !user)
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    // --- Parse body ---
    const body = await req.json();
    const { businessId, chainCode, storeNumber } = body as {
      businessId?: string;
      chainCode?: string;
      storeNumber?: string;
    };

    if (!businessId || !chainCode || !storeNumber) {
      return NextResponse.json(
        { error: "businessId, chainCode, and storeNumber are required" },
        { status: 400 }
      );
    }

    const trimmedCode = chainCode.trim().toUpperCase();
    const trimmedStore = storeNumber.trim();

    if (!trimmedStore || trimmedStore === "0") {
      return NextResponse.json(
        { error: "Store number cannot be empty or 0 (0 is reserved for corporate)" },
        { status: 400 }
      );
    }

    // --- Verify caller is owner of this business ---
    const { data: staff } = await supabaseServer
      .from("staff_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const isAdmin = !!staff;

    if (!isAdmin) {
      const { data: bizAccess } = await supabaseServer
        .from("business_users")
        .select("role")
        .eq("business_id", businessId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!bizAccess || bizAccess.role !== "owner") {
        return NextResponse.json(
          { error: "Only the business owner can request a chain link" },
          { status: 403 }
        );
      }
    }

    // --- Look up chain by code ---
    const { data: chain, error: chainErr } = await supabaseServer
      .from("chains")
      .select("id, brand_name, status")
      .eq("chain_code", trimmedCode)
      .maybeSingle();

    if (chainErr) throw chainErr;

    if (!chain) {
      return NextResponse.json({ error: "Chain code not found" }, { status: 404 });
    }

    if (chain.status !== "active") {
      return NextResponse.json(
        { error: "This chain is not currently accepting link requests" },
        { status: 400 }
      );
    }

    // --- Check business isn't already in a chain ---
    const { data: biz } = await supabaseServer
      .from("business")
      .select("chain_id")
      .eq("id", businessId)
      .single();

    if (biz?.chain_id) {
      return NextResponse.json(
        { error: "This business is already linked to a chain. Remove the existing link first." },
        { status: 409 }
      );
    }

    // --- Check for existing pending request ---
    const { data: existing } = await supabaseServer
      .from("chain_link_requests")
      .select("id, status")
      .eq("business_id", businessId)
      .eq("chain_id", chain.id)
      .maybeSingle();

    if (existing) {
      if (existing.status === "pending") {
        return NextResponse.json(
          { error: "A pending link request already exists for this chain" },
          { status: 409 }
        );
      }
      // If previously denied, allow re-request by updating the existing row
      const { error: updateErr } = await supabaseServer
        .from("chain_link_requests")
        .update({
          store_number: trimmedStore,
          status: "pending",
          requested_by: user.id,
          requested_at: new Date().toISOString(),
          reviewed_by: null,
          reviewed_at: null,
          denial_reason: null,
        })
        .eq("id", existing.id);

      if (updateErr) throw updateErr;

      return NextResponse.json({
        message: "Link request resubmitted",
        chainName: chain.brand_name,
        requestId: existing.id,
      });
    }

    // --- Create new link request ---
    const { data: inserted, error: insertErr } = await supabaseServer
      .from("chain_link_requests")
      .insert({
        business_id: businessId,
        chain_id: chain.id,
        store_number: trimmedStore,
        requested_by: user.id,
      })
      .select("id")
      .single();

    if (insertErr) throw insertErr;

    return NextResponse.json({
      message: "Link request submitted — awaiting corporate approval",
      chainName: chain.brand_name,
      requestId: inserted.id,
    });
  } catch (err) {
    console.error("[chains/link-request] POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
