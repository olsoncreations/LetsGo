import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * GET /api/admin/billing/adjustments
 * Fetch all billing adjustments (optionally filtered by business_id or status)
 */
export async function GET(req: NextRequest): Promise<Response> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: { user }, error: authErr } = await supabaseServer.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: staff } = await supabaseServer.from("staff_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!staff) return NextResponse.json({ error: "Staff access required" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const businessId = searchParams.get("business_id");
  const status = searchParams.get("status");

  let query = supabaseServer
    .from("billing_adjustments")
    .select("*")
    .order("created_at", { ascending: false });

  if (businessId) query = query.eq("business_id", businessId);
  if (status && status !== "all") query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    console.error("[billing-adjustments] GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Enrich with business names
  const bizIds = [...new Set((data || []).map(a => a.business_id))];
  let bizNames: Record<string, string> = {};
  if (bizIds.length > 0) {
    const { data: businesses } = await supabaseServer
      .from("business")
      .select("id, business_name")
      .in("id", bizIds);
    if (businesses) {
      bizNames = Object.fromEntries(businesses.map(b => [b.id, b.business_name]));
    }
  }

  // Enrich with creator names
  const creatorIds = [...new Set((data || []).map(a => a.created_by).filter(Boolean))];
  let creatorNames: Record<string, string> = {};
  if (creatorIds.length > 0) {
    const { data: profiles } = await supabaseServer
      .from("profiles")
      .select("id, full_name")
      .in("id", creatorIds);
    if (profiles) {
      creatorNames = Object.fromEntries(profiles.map(p => [p.id, p.full_name || "Staff"]));
    }
  }

  const enriched = (data || []).map(a => ({
    ...a,
    business_name: bizNames[a.business_id] || "Unknown",
    created_by_name: creatorNames[a.created_by] || "Staff",
  }));

  return NextResponse.json({ adjustments: enriched });
}

/**
 * POST /api/admin/billing/adjustments
 * Create a new billing adjustment (credit or charge)
 * Body: { business_id, amount_cents, type: "credit"|"charge", description }
 */
export async function POST(req: NextRequest): Promise<Response> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: { user }, error: authErr } = await supabaseServer.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: staff } = await supabaseServer.from("staff_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!staff) return NextResponse.json({ error: "Staff access required" }, { status: 403 });

  try {
    const body = await req.json();
    const { business_id, amount_cents, type, description } = body as {
      business_id: string;
      amount_cents: number;
      type: string;
      description: string;
    };

    // Validation
    if (!business_id) return NextResponse.json({ error: "business_id is required" }, { status: 400 });
    if (!amount_cents || amount_cents === 0) return NextResponse.json({ error: "amount_cents must be non-zero" }, { status: 400 });
    if (!type || !["credit", "charge"].includes(type)) return NextResponse.json({ error: "type must be 'credit' or 'charge'" }, { status: 400 });
    if (!description || description.trim().length === 0) return NextResponse.json({ error: "description is required" }, { status: 400 });

    // Verify business exists
    const { data: biz } = await supabaseServer.from("business").select("id, business_name").eq("id", business_id).maybeSingle();
    if (!biz) return NextResponse.json({ error: "Business not found" }, { status: 404 });

    // Store amount: credits are negative, charges are positive
    const storedAmount = type === "credit" ? -Math.abs(amount_cents) : Math.abs(amount_cents);

    const { data: adjustment, error: insertErr } = await supabaseServer
      .from("billing_adjustments")
      .insert({
        business_id,
        amount_cents: storedAmount,
        type,
        description: description.trim(),
        created_by: user.id,
        status: "pending",
      })
      .select()
      .single();

    if (insertErr) {
      console.error("[billing-adjustments] POST insert error:", insertErr);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      adjustment,
      business_name: biz.business_name,
    });
  } catch (err) {
    console.error("[billing-adjustments] POST error:", err);
    return NextResponse.json({ error: String(err instanceof Error ? err.message : err) }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/billing/adjustments
 * Void an existing adjustment
 * Body: { adjustmentId, reason? }
 */
export async function PATCH(req: NextRequest): Promise<Response> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: { user }, error: authErr } = await supabaseServer.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: staff } = await supabaseServer.from("staff_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!staff) return NextResponse.json({ error: "Staff access required" }, { status: 403 });

  try {
    const body = await req.json();
    const { adjustmentId, reason } = body as { adjustmentId: string; reason?: string };

    if (!adjustmentId) return NextResponse.json({ error: "adjustmentId is required" }, { status: 400 });

    // Verify adjustment exists and is pending
    const { data: existing } = await supabaseServer
      .from("billing_adjustments")
      .select("id, status")
      .eq("id", adjustmentId)
      .maybeSingle();

    if (!existing) return NextResponse.json({ error: "Adjustment not found" }, { status: 404 });
    if (existing.status !== "pending") {
      return NextResponse.json({ error: `Cannot void an adjustment with status '${existing.status}'` }, { status: 400 });
    }

    const { data: updated, error: updateErr } = await supabaseServer
      .from("billing_adjustments")
      .update({
        status: "voided",
        voided_at: new Date().toISOString(),
        voided_by: user.id,
        voided_reason: reason || null,
      })
      .eq("id", adjustmentId)
      .select()
      .single();

    if (updateErr) {
      console.error("[billing-adjustments] PATCH error:", updateErr);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, adjustment: updated });
  } catch (err) {
    console.error("[billing-adjustments] PATCH error:", err);
    return NextResponse.json({ error: String(err instanceof Error ? err.message : err) }, { status: 500 });
  }
}
