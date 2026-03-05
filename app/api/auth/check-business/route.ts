import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

// Two modes:
// 1) No params → uses auth token to find the caller's most recent business_id
// 2) ?businessId=... → returns the business name for a given business (public lookup)
export async function GET(req: NextRequest) {
  const businessId = req.nextUrl.searchParams.get("businessId");

  // Mode 2: look up business name by businessId (public — just returns a name)
  if (businessId) {
    const { data, error } = await supabaseServer
      .from("business")
      .select("public_business_name, business_name")
      .eq("id", businessId)
      .maybeSingle();

    if (error) {
      console.error("check-business name error:", error.message);
      return NextResponse.json({ businessName: null });
    }

    const businessName = data?.public_business_name || data?.business_name || null;
    return NextResponse.json({ businessId, businessName });
  }

  // Mode 1: look up business_id for the authenticated user
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { data: { user }, error: authErr } = await supabaseServer.auth.getUser(token);
  if (authErr || !user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { data, error } = await supabaseServer
    .from("business_users")
    .select("business_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("check-business error:", error.message);
    return NextResponse.json({ businessId: null });
  }

  const foundId = data && data.length > 0 ? data[0].business_id : null;
  return NextResponse.json({ businessId: foundId });
}
