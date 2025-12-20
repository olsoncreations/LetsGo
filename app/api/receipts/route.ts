import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseServer";

type TierRow = {
  tier_index: number;
  min_visits: number;
  max_visits: number | null;
  percent_bps: number; // basis points (e.g. 250 = 2.5%)
  label: string | null;
};

function pickTier(tiers: TierRow[], visitCount: number): TierRow | null {
  // pick the highest tier that matches the visitCount
  let current: TierRow | null = null;

  for (const tier of tiers) {
    const min = tier.min_visits;
    const max = tier.max_visits ?? Infinity;
    if (visitCount >= min && visitCount <= max) {
      if (!current || tier.tier_index > current.tier_index) current = tier;
    }
  }

  // if nothing matched, default to the lowest tier (if exists)
  if (!current && tiers.length > 0) current = tiers[0];
  return current;
}

/**
 * Demo endpoint: calculates payout for a receipt and stores it.
 * NOTE: This is "demo-safe" and can be refined later; the goal is to compile cleanly on Vercel.
 */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const body = await req.json();

    const businessId = String(body.businessId || "");
    const userId = String(body.userId || "demo-user-123");
    const receiptTotalCents = Number(body.receiptTotalCents ?? 0);
    const visitDate = String(body.visitDate || new Date().toISOString().slice(0, 10)); // YYYY-MM-DD

    if (!businessId) {
      return NextResponse.json({ error: "Missing businessId" }, { status: 400 });
    }
    if (!Number.isFinite(receiptTotalCents) || receiptTotalCents <= 0) {
      return NextResponse.json(
        { error: "receiptTotalCents must be a positive number" },
        { status: 400 }
      );
    }

    // 1) Count visits in last 30 days (including this one as "next visit")
    const windowDays = 30;
    const now = new Date();
    const fromDate = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const { count: visitCount, error: visitError } = await supabase
      .from("receipts")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("user_id", userId)
      .gte("visit_date", fromDate);

    if (visitError) {
      return NextResponse.json(
        { error: "Failed to count visits", details: visitError.message },
        { status: 500 }
      );
    }

    const visitsThisWindow = (visitCount ?? 0) + 1; // include this new receipt

    // 2) Load payout tiers for this business
    // IMPORTANT: Do not use `.from<DbTierRow>()` generics — they cause build typing issues in your setup.
    const { data: tiersRaw, error: tiersError } = await supabase
      .from("business_payout_tiers")
      .select("tier_index, min_visits, max_visits, percent_bps, label")
      .eq("business_id", businessId)
      .order("tier_index", { ascending: true });

    if (tiersError) {
      return NextResponse.json(
        { error: "Failed to load payout tiers", details: tiersError.message },
        { status: 500 }
      );
    }

    const tiers = (tiersRaw ?? []) as TierRow[];
    const currentTier = pickTier(tiers, visitsThisWindow);

    if (!currentTier) {
      return NextResponse.json(
        { error: "No payout tiers configured for this business" },
        { status: 400 }
      );
    }

    // 3) Compute payout
    // percent_bps is basis points (100 = 1.00%)
    const percent = currentTier.percent_bps / 10_000;
    const payoutCentsRaw = Math.round(receiptTotalCents * percent);

    // Cap payout at $5.00 (500 cents) — consistent with your business model
    const payoutCents = Math.min(payoutCentsRaw, 500);

    // 4) Insert receipt record (demo)
    const { data: inserted, error: insertError } = await supabase
      .from("receipts")
      .insert([
        {
          business_id: businessId,
          user_id: userId,
          visit_date: visitDate,
          receipt_total_cents: receiptTotalCents,
          payout_cents: payoutCents,
          payout_tier_index: currentTier.tier_index,
        },
      ])
      .select("id")
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: "Failed to save receipt", details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        receiptId: inserted?.id ?? null,
        windowDays,
        visitsThisWindow,
        tier: currentTier,
        receiptTotalCents,
        payoutCents,
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: "Unexpected error", details: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
