import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * POST /api/admin/billing/generate-influencer-payouts
 *
 * Generates monthly payout records for all active influencers.
 * Called as part of the month-end billing flow alongside invoice generation.
 * Body: { periodStart: "2026-02-01", periodEnd: "2026-02-28" }
 */
export async function POST(req: NextRequest): Promise<Response> {
  // Require staff authentication
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: { user }, error: authErr } = await supabaseServer.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: staff } = await supabaseServer.from("staff_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!staff) return NextResponse.json({ error: "Staff access required" }, { status: 403 });

  try {
    const body = await req.json();
    const periodStart: string = body.periodStart;
    const periodEnd: string = body.periodEnd;

    if (!periodStart || !periodEnd) {
      return NextResponse.json({ error: "periodStart and periodEnd required" }, { status: 400 });
    }

    const startDate = new Date(periodStart + "T00:00:00");
    const billingPeriod = startDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

    // Check for existing influencer payouts in this period
    const { data: existing } = await supabaseServer
      .from("influencer_payouts")
      .select("id")
      .eq("period_start", periodStart)
      .eq("period_end", periodEnd)
      .limit(1);

    if (existing && existing.length > 0) {
      const { count } = await supabaseServer
        .from("influencer_payouts")
        .select("id", { count: "exact", head: true })
        .eq("period_start", periodStart)
        .eq("period_end", periodEnd);

      return NextResponse.json({
        error: "already_generated",
        message: `Influencer payouts for ${billingPeriod} already exist (${count} payouts). Delete existing payouts first to regenerate.`,
        existingCount: count,
      }, { status: 409 });
    }

    // Fetch all active influencers
    const { data: influencers, error: infError } = await supabaseServer
      .from("influencers")
      .select("id, name, rate_per_thousand_cents, total_signups")
      .eq("status", "active");

    if (infError) {
      console.error("[generate-influencer-payouts] Error fetching influencers:", infError);
      return NextResponse.json({ error: "Failed to fetch influencers" }, { status: 500 });
    }

    if (!influencers || influencers.length === 0) {
      return NextResponse.json({
        ok: true,
        billingPeriod,
        generated: 0,
        skipped: 0,
        totalCents: 0,
        payouts: [],
      });
    }

    const MINIMUM_SIGNUPS = 1;
    let generated = 0;
    let skipped = 0;
    let totalCents = 0;
    const payoutSummaries: { id: string; influencerName: string; signupsCount: number; amountCents: number }[] = [];

    // Use period end + 1 day for the range query (created_at < periodEnd midnight next day)
    const periodEndNext = new Date(periodEnd + "T00:00:00");
    periodEndNext.setDate(periodEndNext.getDate() + 1);
    const periodEndNextStr = periodEndNext.toISOString();

    for (const influencer of influencers) {
      // Count signups attributed to this influencer during the billing period
      const { count: periodSignups, error: countErr } = await supabaseServer
        .from("influencer_signups")
        .select("id", { count: "exact", head: true })
        .eq("influencer_id", influencer.id)
        .gte("created_at", periodStart + "T00:00:00")
        .lt("created_at", periodEndNextStr);

      if (countErr) {
        console.error(`[generate-influencer-payouts] Error counting signups for ${influencer.name}:`, countErr);
        skipped++;
        continue;
      }

      const signups = periodSignups || 0;

      if (signups < MINIMUM_SIGNUPS) {
        skipped++;
        continue;
      }

      // Proportional payout: signups × rate / 1000
      const amountCents = Math.floor(signups * influencer.rate_per_thousand_cents / 1000);

      if (amountCents <= 0) {
        skipped++;
        continue;
      }

      const { data: payout, error: insertErr } = await supabaseServer
        .from("influencer_payouts")
        .insert({
          influencer_id: influencer.id,
          signups_count: signups,
          amount_cents: amountCents,
          rate_per_thousand_cents: influencer.rate_per_thousand_cents,
          period_start: periodStart,
          period_end: periodEnd,
          paid: false,
          notes: `Auto-generated for ${billingPeriod}: ${signups} signups at $${(influencer.rate_per_thousand_cents / 100).toFixed(2)} per 1K`,
        })
        .select("id")
        .single();

      if (insertErr) {
        console.error(`[generate-influencer-payouts] Error inserting payout for ${influencer.name}:`, insertErr);
        skipped++;
        continue;
      }

      generated++;
      totalCents += amountCents;
      payoutSummaries.push({
        id: payout.id,
        influencerName: influencer.name,
        signupsCount: signups,
        amountCents,
      });
    }

    return NextResponse.json({
      ok: true,
      billingPeriod,
      generated,
      skipped,
      totalCents,
      payouts: payoutSummaries,
    });
  } catch (err) {
    console.error("[generate-influencer-payouts] Unexpected error:", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
