import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supabaseServer as supabase } from "@/lib/supabaseServer";

/**
 * GET /api/tier-extensions
 * Returns the authenticated user's tier extensions with business names.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("tier_extensions")
    .select("*, business:business(business_name, public_business_name)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: "Failed to load extensions" }, { status: 500 });

  return NextResponse.json({
    extensions: (data ?? []).map((ext) => ({
      ...ext,
      businessName: (ext.business as { public_business_name?: string; business_name?: string })?.public_business_name
        || (ext.business as { business_name?: string })?.business_name
        || (ext.business_id ? "Unknown" : "All Businesses (Gold)"),
    })),
  });
}
