import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * GET /api/businesses/adjustments?business_id=xxx
 * Returns pending billing adjustments for a business.
 * Accessible by staff OR business users (owner/manager/staff) of that business.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const { data: { user }, error: authErr } = await supabaseServer.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const businessId = searchParams.get("business_id");
  if (!businessId) return NextResponse.json({ error: "business_id required" }, { status: 400 });

  // Check access: staff OR business user for this business
  const { data: staff } = await supabaseServer
    .from("staff_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!staff) {
    const { data: bizUser } = await supabaseServer
      .from("business_users")
      .select("user_id")
      .eq("user_id", user.id)
      .eq("business_id", businessId)
      .maybeSingle();

    if (!bizUser) return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const { data, error } = await supabaseServer
    .from("billing_adjustments")
    .select("id, amount_cents, type, description, created_at")
    .eq("business_id", businessId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[businesses/adjustments] GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ adjustments: data || [] });
}
