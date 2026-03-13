import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

async function requireStaff(req: NextRequest): Promise<Response | null> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: { user }, error } = await supabaseServer.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: staff } = await supabaseServer.from("staff_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!staff) return NextResponse.json({ error: "Staff access required" }, { status: 403 });
  return null;
}

// GET — Fetch all sales_counties (staff-only, server-side to bypass RLS row limits)
export async function GET(req: NextRequest) {
  const denied = await requireStaff(req);
  if (denied) return denied;

  const { data, error } = await supabaseServer
    .from("sales_counties")
    .select("id,fips,name,state,zone_id,quota,created_at")
    .order("state")
    .order("name")
    .limit(5000);

  if (error) {
    console.error("[admin/counties] Fetch error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ counties: data });
}
