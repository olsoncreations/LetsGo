import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * GET /api/admin/geocode/stats
 * Returns aggregate geocode status counts.
 */
export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: { user }, error } = await supabaseServer.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: staff } = await supabaseServer
    .from("staff_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!staff) return NextResponse.json({ error: "Staff access required" }, { status: 403 });

  const { data, error: queryErr } = await supabaseServer
    .rpc("exec_sql", { query: `
      SELECT geocode_status, COUNT(*)::int as cnt
      FROM business
      WHERE is_active = true
      GROUP BY geocode_status
    ` });

  // Fallback: if RPC not available, query each status individually
  if (queryErr) {
    const statuses = ["pending", "matched", "mismatch", "no_result", "approved_google", "approved_nominatim", "approved_manual", "skipped"];
    const counts: Record<string, number> = {};
    let total = 0;

    for (const status of statuses) {
      const { count } = await supabaseServer
        .from("business")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("geocode_status", status);
      counts[status] = count || 0;
      total += count || 0;
    }

    // Also count null status (businesses without geocode_status set)
    const { count: nullCount } = await supabaseServer
      .from("business")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .is("geocode_status", null);
    counts.pending = (counts.pending || 0) + (nullCount || 0);
    total += nullCount || 0;

    return NextResponse.json({
      total,
      pending: counts.pending || 0,
      matched: counts.matched || 0,
      mismatch: counts.mismatch || 0,
      noResult: counts.no_result || 0,
      approvedGoogle: counts.approved_google || 0,
      approvedNominatim: counts.approved_nominatim || 0,
      approvedManual: counts.approved_manual || 0,
      skipped: counts.skipped || 0,
    });
  }

  // Parse RPC results
  const counts: Record<string, number> = {};
  let total = 0;
  for (const row of data || []) {
    const status = row.geocode_status || "pending";
    counts[status] = row.cnt;
    total += row.cnt;
  }

  return NextResponse.json({
    total,
    pending: (counts.pending || 0) + (counts.null || 0),
    matched: counts.matched || 0,
    mismatch: counts.mismatch || 0,
    noResult: counts.no_result || 0,
    approvedGoogle: counts.approved_google || 0,
    approvedNominatim: counts.approved_nominatim || 0,
    approvedManual: counts.approved_manual || 0,
    skipped: counts.skipped || 0,
  });
}
