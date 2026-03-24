import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supabaseServer as supabase } from "@/lib/supabaseServer";

/**
 * GET /api/admin/tier-extensions/metrics
 * Staff-only: aggregate extension metrics for admin dashboards.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: staff } = await supabase.from("staff_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!staff) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    // Active extensions count
    const { count: activeCount } = await supabase
      .from("tier_extensions")
      .select("id", { count: "exact", head: true })
      .eq("status", "active");

    // Total revenue (all time)
    const { data: revenueData } = await supabase
      .from("tier_extensions")
      .select("price_cents");
    const totalRevenueCents = (revenueData ?? []).reduce((sum, r) => sum + (r.price_cents ?? 0), 0);

    // This month's revenue
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const { data: monthData } = await supabase
      .from("tier_extensions")
      .select("price_cents")
      .gte("created_at", monthStart.toISOString());
    const monthRevenueCents = (monthData ?? []).reduce((sum, r) => sum + (r.price_cents ?? 0), 0);

    // By product type
    const { data: byType } = await supabase
      .from("tier_extensions")
      .select("product_type, price_cents");
    const productBreakdown: Record<string, { count: number; revenueCents: number }> = {};
    for (const ext of byType ?? []) {
      const pt = ext.product_type;
      if (!productBreakdown[pt]) productBreakdown[pt] = { count: 0, revenueCents: 0 };
      productBreakdown[pt].count += 1;
      productBreakdown[pt].revenueCents += ext.price_cents ?? 0;
    }

    // Expiring within 7 days
    const weekFromNow = new Date();
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    const { count: expiringSoonCount } = await supabase
      .from("tier_extensions")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .lte("effective_until", weekFromNow.toISOString().slice(0, 10));

    return NextResponse.json({
      activeCount: activeCount ?? 0,
      totalRevenueCents,
      monthRevenueCents,
      productBreakdown,
      expiringSoonCount: expiringSoonCount ?? 0,
    });
  } catch (err) {
    console.error("Extension metrics error:", err);
    return NextResponse.json({ error: "Failed to compute metrics" }, { status: 500 });
  }
}
