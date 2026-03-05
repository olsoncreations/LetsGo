import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { computeBillingBreakdowns } from "@/lib/billingCalc";

/**
 * GET /api/admin/billing/expected?period=month&date=2026-02-21
 *
 * period: day | week | month | year | mtd | ytd  (default: month)
 * date:   ISO date string for the reference point (default: today)
 *
 * Fixed monthly costs (plan, add-ons, TPMS) are prorated to the selected period.
 * Variable costs (receipts, campaigns) are filtered to the date range.
 * MTD/YTD are "actuals" — anchored to today, no proration tricks.
 */
export async function GET(req: NextRequest): Promise<Response> {
  // Require staff authentication
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: { user }, error: authErr } = await supabaseServer.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: staff } = await supabaseServer.from("staff_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!staff) return NextResponse.json({ error: "Staff access required" }, { status: 403 });

  try {
    const period = req.nextUrl.searchParams.get("period") || "month";
    const dateParam = req.nextUrl.searchParams.get("date");
    const refDate = dateParam ? new Date(dateParam) : new Date();

    // ---- Compute date range & proration factor ----
    let rangeStart: string;
    let rangeEnd: string;
    let fixedMultiplier: number;
    let periodLabel: string;

    const fmtDate = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    switch (period) {
      case "day": {
        rangeStart = fmtDate(refDate);
        rangeEnd = fmtDate(refDate);
        fixedMultiplier = 1 / 30;
        periodLabel = refDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
        break;
      }
      case "week": {
        const dayOfWeek = refDate.getDay();
        const weekStart = new Date(refDate);
        weekStart.setDate(refDate.getDate() - dayOfWeek);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        rangeStart = fmtDate(weekStart);
        rangeEnd = fmtDate(weekEnd);
        fixedMultiplier = 7 / 30;
        const wsLabel = weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        const weLabel = weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        periodLabel = `${wsLabel} – ${weLabel}`;
        break;
      }
      case "year": {
        rangeStart = `${refDate.getFullYear()}-01-01`;
        rangeEnd = `${refDate.getFullYear()}-12-31`;
        fixedMultiplier = 12;
        periodLabel = String(refDate.getFullYear());
        break;
      }
      case "mtd": {
        const today = new Date();
        const y = today.getFullYear();
        const m = today.getMonth();
        rangeStart = `${y}-${String(m + 1).padStart(2, "0")}-01`;
        rangeEnd = fmtDate(today);
        fixedMultiplier = 1;
        const monthName = today.toLocaleDateString("en-US", { month: "long" });
        periodLabel = `${monthName} 1 – ${today.getDate()}, ${y} (MTD)`;
        break;
      }
      case "ytd": {
        const today = new Date();
        const y = today.getFullYear();
        rangeStart = `${y}-01-01`;
        rangeEnd = fmtDate(today);
        fixedMultiplier = today.getMonth() + 1;
        periodLabel = `Jan 1 – ${today.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${y} (YTD)`;
        break;
      }
      default: {
        const y = refDate.getFullYear();
        const m = refDate.getMonth();
        rangeStart = `${y}-${String(m + 1).padStart(2, "0")}-01`;
        const lastDay = new Date(y, m + 1, 0);
        rangeEnd = fmtDate(lastDay);
        fixedMultiplier = 1;
        periodLabel = refDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
        break;
      }
    }

    // Delegate to shared billing calculation helper
    const { breakdowns, platformTotal } = await computeBillingBreakdowns(
      supabaseServer,
      rangeStart,
      rangeEnd,
      fixedMultiplier
    );

    return NextResponse.json({
      platformTotal,
      businesses: breakdowns,
      period,
      periodLabel,
      rangeStart,
      rangeEnd,
    });
  } catch (err) {
    console.error("[admin-billing-expected] error:", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
