import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

// Verify caller is an owner or manager of this business
async function requireBusinessAccess(req: NextRequest, businessId: string): Promise<Response | null> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: { user }, error } = await supabaseServer.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  // Check business_users for owner/manager role, OR staff_users for admin access
  const { data: bizAccess } = await supabaseServer
    .from("business_users")
    .select("role")
    .eq("business_id", businessId)
    .eq("user_id", user.id)
    .in("role", ["owner", "manager"])
    .maybeSingle();

  if (bizAccess) return null; // authorized as business user

  const { data: staff } = await supabaseServer
    .from("staff_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (staff) return null; // authorized as admin staff

  return NextResponse.json({ error: "Business access required" }, { status: 403 });
}

/**
 * GET /api/businesses/[businessId]/receipts
 * Returns all receipts for a given business. Uses supabaseServer to bypass RLS.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ businessId: string }> }
): Promise<Response> {
  const { businessId } = await context.params;

  if (!businessId) {
    return NextResponse.json({ error: "businessId required" }, { status: 400 });
  }

  const denied = await requireBusinessAccess(req, businessId);
  if (denied) return denied;

  try {
    const { data, error } = await supabaseServer
      .from("receipts")
      .select(
        "id, user_id, business_id, receipt_total_cents, payout_cents, payout_tier_index, payout_tier_label, payout_percent_bps, photo_url, status, visit_date, created_at, business_approved_at"
      )
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) {
      console.error("[business-receipts] Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Generate signed URLs for receipt photos
    const receiptsWithSignedUrls = await Promise.all(
      (data ?? []).map(async (r: Record<string, unknown>) => {
        if (r.photo_url && typeof r.photo_url === "string") {
          const { data: signedData } = await supabaseServer.storage
            .from("receipts")
            .createSignedUrl(r.photo_url, 3600);
          return { ...r, photo_url: signedData?.signedUrl || r.photo_url };
        }
        return r;
      })
    );

    return NextResponse.json({ receipts: receiptsWithSignedUrls });
  } catch (err) {
    console.error("[business-receipts] Unexpected error:", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/businesses/[businessId]/receipts
 * Updates receipt statuses. Used by business profile for approval flow.
 *
 * Body: { ids: string[], status: "business_approved" | "rejected" | "pending" }
 */
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ businessId: string }> }
): Promise<Response> {
  const { businessId } = await context.params;

  if (!businessId) {
    return NextResponse.json({ error: "businessId required" }, { status: 400 });
  }

  const denied = await requireBusinessAccess(req, businessId);
  if (denied) return denied;

  try {
    const body = await req.json();
    const ids: string[] = body.ids;
    const status: string = body.status;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids array required" }, { status: 400 });
    }

    const validStatuses = ["business_approved", "rejected", "pending"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` }, { status: 400 });
    }

    // When business approves, verify the business is active and has a valid payment method
    if (status === "business_approved") {
      const { data: biz } = await supabaseServer
        .from("business")
        .select("is_active, stripe_customer_id, stripe_payment_method_id")
        .eq("id", businessId)
        .maybeSingle();

      if (!biz?.is_active) {
        return NextResponse.json(
          { error: "This business is currently suspended. Receipts cannot be approved until the business is reactivated." },
          { status: 403 },
        );
      }

      if (!biz?.stripe_customer_id || !biz?.stripe_payment_method_id) {
        return NextResponse.json(
          { error: "A valid payment method must be on file before you can approve receipts. Please update your billing information in the Billing tab." },
          { status: 400 },
        );
      }
    }

    // When business approves, record the timestamp for 30-day dispute window
    const updatePayload: Record<string, string> = { status };
    if (status === "business_approved") {
      updatePayload.business_approved_at = new Date().toISOString();
    }

    // If rejecting, enforce 30-day dispute window from business_approved_at
    if (status === "rejected") {
      // Fetch receipts to check dispute window
      const { data: targets, error: fetchErr } = await supabaseServer
        .from("receipts")
        .select("id, business_approved_at")
        .eq("business_id", businessId)
        .in("id", ids);

      if (fetchErr) {
        console.error("[business-receipts] Dispute window check error:", fetchErr);
        return NextResponse.json({ error: fetchErr.message }, { status: 500 });
      }

      const now = new Date();
      const expired = (targets ?? []).filter((r) => {
        if (!r.business_approved_at) return false; // never approved — can still reject
        const approvedAt = new Date(r.business_approved_at);
        const daysSince = (now.getTime() - approvedAt.getTime()) / (1000 * 60 * 60 * 24);
        return daysSince > 30;
      });

      if (expired.length > 0) {
        return NextResponse.json(
          {
            error: "Dispute window closed",
            message: `${expired.length} receipt(s) cannot be disputed — the 30-day window has passed.`,
            expiredIds: expired.map((r) => r.id),
          },
          { status: 403 }
        );
      }
    }

    const { data, error } = await supabaseServer
      .from("receipts")
      .update(updatePayload)
      .eq("business_id", businessId)
      .in("id", ids)
      .select("id, status");

    if (error) {
      console.error("[business-receipts] PATCH error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ updated: data ?? [] });
  } catch (err) {
    console.error("[business-receipts] PATCH unexpected error:", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
