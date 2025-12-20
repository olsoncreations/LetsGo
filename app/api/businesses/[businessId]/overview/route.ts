import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseServer";

type TierRow = {
  tier_index: number;
  min_visits: number;
  max_visits: number | null;
  percent_bps: number;
  label: string | null;
};

function computeCurrentAndNextTier(tiers: TierRow[], visitCount: number) {
  let currentTier: TierRow | null = null;
  let nextTier: TierRow | null = null;

  for (const tier of tiers) {
    const min = tier.min_visits;
    const max = tier.max_visits ?? Infinity;

    if (visitCount >= min && visitCount <= max) {
      if (!currentTier || tier.tier_index > currentTier.tier_index) {
        currentTier = tier;
      }
    }

    if (visitCount < min) {
      if (!nextTier || tier.tier_index < nextTier.tier_index) {
        nextTier = tier;
      }
    }
  }

  if (!currentTier && !nextTier && tiers.length > 0) {
    nextTier = tiers[0];
  }

  let progressToNextPercent = 0;

  if (nextTier) {
    if (currentTier) {
      const span = nextTier.min_visits - currentTier.min_visits;
      const done = visitCount - currentTier.min_visits;
      progressToNextPercent =
        span > 0 ? Math.min(100, Math.max(0, (done / span) * 100)) : 0;
    } else {
      progressToNextPercent = Math.min(
        100,
        Math.max(0, (visitCount / nextTier.min_visits) * 100)
      );
    }
  } else if (currentTier) {
    progressToNextPercent = 100;
  }

  return { currentTier, nextTier, progressToNextPercent };
}

/**
 * Next.js 16 (as deployed on Vercel) types route handler context.params as a Promise.
 * So we accept `params` as a Promise and await it.
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ businessId: string }> }
): Promise<Response> {
  const { businessId } = await context.params;

  // 1) Load the business basic info
  const { data: business, error: businessError } = await supabase
    .from("business")
    .select(
      "id, name, city, state, category_main, address_line1, address_line2, postal_code"
    )
    .eq("id", businessId)
    .single();

  if (businessError || !business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  // 2) Count user visits in the window (demo user for now)
  const userId = "demo-user-123";
  const windowDays = 30;
  const now = new Date();
  const fromDate = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10); // YYYY-MM-DD

  const { count: visitCount, error: visitError } = await supabase
    .from("receipts")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .gte("visit_date", fromDate);

  if (visitError) {
    return NextResponse.json({ error: "Failed to load visits" }, { status: 500 });
  }

  const visits = visitCount ?? 0;

  // 3) Load all payout tiers for this business
  const { data: tiers, error: tiersError } = await supabase
    .from("business_payout_tiers")
    .select("tier_index, min_visits, max_visits, percent_bps, label")
    .eq("business_id", businessId)
    .order("tier_index", { ascending: true });

  if (tiersError) {
    return NextResponse.json(
      { error: "Failed to load payout tiers" },
      { status: 500 }
    );
  }

  const tiersSafe: TierRow[] = tiers ?? [];
  const { currentTier, nextTier, progressToNextPercent } =
    computeCurrentAndNextTier(tiersSafe, visits);

  return NextResponse.json(
    {
      business,
      windowDays,
      visitCountThisWindow: visits,
      currentTier,
      nextTier,
      tiers: tiersSafe,
      progressToNextPercent,
    },
    { status: 200 }
  );
}
