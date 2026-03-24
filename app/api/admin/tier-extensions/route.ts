import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supabaseServer as supabase } from "@/lib/supabaseServer";

/**
 * GET /api/admin/tier-extensions
 * Staff-only: list all tier extensions with filters.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Staff check
  const { data: staff } = await supabase.from("staff_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!staff) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const userId = url.searchParams.get("user_id");
  const businessId = url.searchParams.get("business_id");
  const limit = Math.min(Number(url.searchParams.get("limit") || 100), 500);
  const offset = Number(url.searchParams.get("offset") || 0);

  let query = supabase
    .from("tier_extensions")
    .select("*, business:business(business_name, public_business_name), profile:profiles(full_name, first_name, last_name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);
  if (userId) query = query.eq("user_id", userId);
  if (businessId) query = query.eq("business_id", businessId);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: "Failed to load extensions" }, { status: 500 });

  return NextResponse.json({
    extensions: (data ?? []).map((ext) => ({
      ...ext,
      businessName: (ext.business as { public_business_name?: string; business_name?: string })?.public_business_name
        || (ext.business as { business_name?: string })?.business_name
        || (ext.business_id ? "Unknown" : "All Businesses (Gold)"),
      userName: (ext.profile as { full_name?: string; first_name?: string; last_name?: string })?.full_name
        || `${(ext.profile as { first_name?: string })?.first_name ?? ""} ${(ext.profile as { last_name?: string })?.last_name ?? ""}`.trim()
        || "Unknown",
    })),
    total: count ?? 0,
  });
}
