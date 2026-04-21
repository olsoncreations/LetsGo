import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * POST /api/chains/link-request/[id]/review
 * Corporate owner/manager (or admin) approves or denies a chain link request.
 *
 * Body: { action: "approve" | "deny", denialReason?: string }
 *
 * On approve:
 *   - Sets business.chain_id + business.store_number
 *   - Updates chains.location_count
 *   - Recalculates chains.pricing_tier + premium_rate_cents
 */

const TIER_THRESHOLDS: { max: number; tier: string; rateCents: number }[] = [
  { max: 10, tier: "local", rateCents: 40000 },
  { max: 100, tier: "regional", rateCents: 35000 },
  { max: 1000, tier: "national", rateCents: 30000 },
  { max: Infinity, tier: "enterprise", rateCents: 0 }, // custom contract
];

function computePricingTier(locationCount: number): {
  tier: string;
  rateCents: number;
} {
  for (const t of TIER_THRESHOLDS) {
    if (locationCount <= t.max) return { tier: t.tier, rateCents: t.rateCents };
  }
  return { tier: "enterprise", rateCents: 0 };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: requestId } = await params;

    // --- Auth ---
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token)
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const { data: { user }, error: authErr } = await supabaseServer.auth.getUser(token);
    if (authErr || !user)
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    // --- Parse body ---
    const body = await req.json();
    const { action, denialReason } = body as {
      action?: string;
      denialReason?: string;
    };

    if (!action || !["approve", "deny"].includes(action)) {
      return NextResponse.json(
        { error: "action must be 'approve' or 'deny'" },
        { status: 400 }
      );
    }

    // --- Load the link request ---
    const { data: linkReq, error: linkErr } = await supabaseServer
      .from("chain_link_requests")
      .select("id, business_id, chain_id, store_number, status")
      .eq("id", requestId)
      .maybeSingle();

    if (linkErr) throw linkErr;
    if (!linkReq) {
      return NextResponse.json({ error: "Link request not found" }, { status: 404 });
    }
    if (linkReq.status !== "pending") {
      return NextResponse.json(
        { error: `Request already ${linkReq.status}` },
        { status: 400 }
      );
    }

    // --- Verify caller: admin or corporate owner/manager ---
    const { data: staff } = await supabaseServer
      .from("staff_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const isAdmin = !!staff;

    if (!isAdmin) {
      // Must be owner/manager of the chain's corporate entity
      const { data: corpAccess } = await supabaseServer
        .from("business_users")
        .select("role")
        .eq("business_id", linkReq.chain_id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!corpAccess || !["owner", "manager"].includes(corpAccess.role)) {
        return NextResponse.json(
          { error: "Only chain corporate owners/managers or admins can review link requests" },
          { status: 403 }
        );
      }
    }

    // --- Deny ---
    if (action === "deny") {
      const { error: denyErr } = await supabaseServer
        .from("chain_link_requests")
        .update({
          status: "denied",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          denial_reason: denialReason || null,
        })
        .eq("id", requestId);

      if (denyErr) throw denyErr;

      return NextResponse.json({ message: "Link request denied" });
    }

    // --- Approve ---

    // Check store number isn't already taken within this chain
    const { data: dupeStore } = await supabaseServer
      .from("business")
      .select("id, business_name")
      .eq("chain_id", linkReq.chain_id)
      .eq("store_number", linkReq.store_number)
      .maybeSingle();

    if (dupeStore) {
      return NextResponse.json(
        {
          error: `Store number ${linkReq.store_number} is already assigned to "${dupeStore.business_name}" in this chain`,
        },
        { status: 409 }
      );
    }

    // 1. Update the link request
    const { error: approveErr } = await supabaseServer
      .from("chain_link_requests")
      .update({
        status: "approved",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (approveErr) throw approveErr;

    // 2. Tag the business
    const { error: tagErr } = await supabaseServer
      .from("business")
      .update({
        chain_id: linkReq.chain_id,
        store_number: linkReq.store_number,
      })
      .eq("id", linkReq.business_id);

    if (tagErr) throw tagErr;

    // 3. Recount locations and update chain pricing
    const { count } = await supabaseServer
      .from("business")
      .select("id", { count: "exact", head: true })
      .eq("chain_id", linkReq.chain_id);

    const locationCount = count ?? 0;
    const { tier, rateCents } = computePricingTier(locationCount);

    const { error: chainUpdateErr } = await supabaseServer
      .from("chains")
      .update({
        location_count: locationCount,
        pricing_tier: tier,
        premium_rate_cents: rateCents,
      })
      .eq("id", linkReq.chain_id);

    if (chainUpdateErr) throw chainUpdateErr;

    return NextResponse.json({
      message: "Link request approved",
      businessId: linkReq.business_id,
      storeNumber: linkReq.store_number,
      locationCount,
      pricingTier: tier,
      premiumRateCents: rateCents,
    });
  } catch (err) {
    console.error("[chains/link-request/review] POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
