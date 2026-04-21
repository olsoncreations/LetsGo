import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * GET /api/chains/[chainId]
 * Returns chain details + all linked locations + pending link requests.
 *
 * Access: admin, or corporate owner/manager of this chain.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ chainId: string }> }
) {
  try {
    const { chainId } = await params;

    // --- Auth ---
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token)
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const { data: { user }, error: authErr } = await supabaseServer.auth.getUser(token);
    if (authErr || !user)
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    // --- Verify access: admin or corporate owner/manager ---
    const { data: staff } = await supabaseServer
      .from("staff_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const isAdmin = !!staff;

    if (!isAdmin) {
      const { data: corpAccess } = await supabaseServer
        .from("business_users")
        .select("role")
        .eq("business_id", chainId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!corpAccess || !["owner", "manager"].includes(corpAccess.role)) {
        return NextResponse.json(
          { error: "Chain access required" },
          { status: 403 }
        );
      }
    }

    // --- Fetch chain ---
    const { data: chain, error: chainErr } = await supabaseServer
      .from("chains")
      .select("*")
      .eq("id", chainId)
      .maybeSingle();

    if (chainErr) throw chainErr;
    if (!chain) {
      return NextResponse.json({ error: "Chain not found" }, { status: 404 });
    }

    // --- Fetch linked locations ---
    const { data: locations, error: locErr } = await supabaseServer
      .from("business")
      .select(
        "id, business_name, public_business_name, store_number, is_active, city, state, zip, street_address, billing_plan, created_at"
      )
      .eq("chain_id", chainId)
      .order("store_number", { ascending: true });

    if (locErr) throw locErr;

    // --- Fetch pending link requests ---
    const { data: pendingRequests, error: reqErr } = await supabaseServer
      .from("chain_link_requests")
      .select(
        "id, business_id, store_number, status, requested_at, requested_by, denial_reason"
      )
      .eq("chain_id", chainId)
      .eq("status", "pending")
      .order("requested_at", { ascending: false });

    if (reqErr) throw reqErr;

    // Enrich pending requests with business names
    const enrichedRequests = [];
    for (const r of pendingRequests || []) {
      const { data: biz } = await supabaseServer
        .from("business")
        .select("business_name, city, state")
        .eq("id", r.business_id)
        .maybeSingle();

      enrichedRequests.push({
        ...r,
        business_name: biz?.business_name || "Unknown",
        business_city: biz?.city || "",
        business_state: biz?.state || "",
      });
    }

    return NextResponse.json({
      chain,
      locations: locations || [],
      pendingRequests: enrichedRequests,
    });
  } catch (err) {
    console.error("[chains/[chainId]] GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
