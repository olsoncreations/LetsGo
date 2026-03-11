import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * GET /api/admin/sales/prospect/role
 * Returns the current user's staff role.
 */
export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const { data: { user }, error } = await supabaseServer.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const { data: staff } = await supabaseServer
    .from("staff_users")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!staff) return NextResponse.json({ error: "Staff access required" }, { status: 403 });

  return NextResponse.json({ role: staff.role });
}
