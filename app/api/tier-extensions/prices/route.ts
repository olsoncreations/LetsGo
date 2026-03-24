import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supabaseServer as supabase } from "@/lib/supabaseServer";
import {
  getAnniversaryWindowStart,
  getNextAnniversaryDate,
  daysUntilAnniversary,
} from "@/lib/anniversaryWindow";
import {
  calculateSilverPrices,
  calculateGoldPrices,
  parseTierExtensionConfig,
} from "@/lib/tierExtensionPricing";
import type { SilverPricingInput } from "@/lib/tierExtensionPricing";

/**
 * GET /api/tier-extensions/prices
 * Returns personalized tier extension pricing for the authenticated user.
 * Calculates Silver prices per business + Gold prices across all businesses.
 */
export async function GET(req: NextRequest) {
  // 1) Auth
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 2) Get user's account creation date
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("created_at")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile?.created_at) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const windowStart = getAnniversaryWindowStart(profile.created_at);
    const nextAnniversary = getNextAnniversaryDate(profile.created_at);
    const daysLeft = daysUntilAnniversary(profile.created_at);

    // 3) Load extension config from platform_settings
    const { data: settings } = await supabase
      .from("platform_settings")
      .select("tier_extension_config")
      .eq("id", 1)
      .maybeSingle();

    const config = parseTierExtensionConfig(
      settings?.tier_extension_config as Record<string, unknown> | null
    );

    // 4) Get all businesses where user has approved receipts in the current window
    const { data: receipts, error: receiptsError } = await supabase
      .from("receipts")
      .select("business_id, receipt_total_cents, visit_date, business:business(business_name, public_business_name)")
      .eq("user_id", user.id)
      .eq("status", "approved")
      .gte("visit_date", windowStart);

    if (receiptsError) {
      return NextResponse.json({ error: "Failed to load receipts" }, { status: 500 });
    }

    if (!receipts || receipts.length === 0) {
      return NextResponse.json({
        silvers: [],
        gold: null,
        daysUntilExpiry: daysLeft,
        nextAnniversary: nextAnniversary.toISOString().slice(0, 10),
        config: { silver6FeePct: config.silver6FeePct, silver12FeePct: config.silver12FeePct, goldDiscountPct: config.goldDiscountPct, processingFeeBps: 350 },
      });
    }

    // 5) Group receipts by business
    const bizMap = new Map<string, {
      businessName: string;
      totalCents: number;
      visitCount: number;
      firstVisitDate: string;
    }>();

    for (const r of receipts) {
      const biz = bizMap.get(r.business_id) ?? {
        businessName: (r.business as { public_business_name?: string; business_name?: string })?.public_business_name
          || (r.business as { business_name?: string })?.business_name
          || "Unknown",
        totalCents: 0,
        visitCount: 0,
        firstVisitDate: r.visit_date,
      };
      biz.totalCents += r.receipt_total_cents ?? 0;
      biz.visitCount += 1;
      if (r.visit_date < biz.firstVisitDate) biz.firstVisitDate = r.visit_date;
      bizMap.set(r.business_id, biz);
    }

    // 6) For each business, load tiers and calculate pricing
    const businessIds = Array.from(bizMap.keys());

    const { data: allTiers } = await supabase
      .from("business_payout_tiers")
      .select("business_id, tier_index, min_visits, max_visits, percent_bps, label")
      .in("business_id", businessIds)
      .order("tier_index", { ascending: true });

    // Group tiers by business
    const tiersByBiz = new Map<string, typeof allTiers>();
    for (const t of allTiers ?? []) {
      const arr = tiersByBiz.get(t.business_id) ?? [];
      arr.push(t);
      tiersByBiz.set(t.business_id, arr);
    }

    // 7) Check for existing active extensions
    const { data: activeExtensions } = await supabase
      .from("tier_extensions")
      .select("business_id, effective_until")
      .eq("user_id", user.id)
      .eq("status", "active")
      .gte("effective_until", new Date().toISOString().slice(0, 10));

    const extMap = new Map<string, string>();
    for (const ext of activeExtensions ?? []) {
      if (ext.business_id) {
        extMap.set(ext.business_id, ext.effective_until);
      }
    }
    // Gold extension (business_id is null)
    const goldExt = (activeExtensions ?? []).find((e) => !e.business_id);

    // 8) Calculate Silver prices for each business
    const silverInputs: SilverPricingInput[] = [];

    for (const [bizId, bizData] of bizMap.entries()) {
      const tiers = tiersByBiz.get(bizId) ?? [];
      if (tiers.length === 0) continue;

      const tier1 = tiers.reduce((lowest, t) => (!lowest || t.tier_index < lowest.tier_index) ? t : lowest, tiers[0]);
      if (!tier1) continue;

      // Find current tier based on visit count
      let currentTier = tier1;
      for (const t of tiers) {
        const min = t.min_visits;
        const max = t.max_visits ?? Infinity;
        if (bizData.visitCount >= min && bizData.visitCount <= max) {
          if (t.tier_index > currentTier.tier_index) currentTier = t;
        }
      }

      // Calculate avg ticket and visits per month
      const avgTicketCents = Math.floor(bizData.totalCents / bizData.visitCount);
      const firstVisit = new Date(bizData.firstVisitDate);
      const now = new Date();
      const monthsActive = Math.max(1, (now.getTime() - firstVisit.getTime()) / (1000 * 60 * 60 * 24 * 30));
      const visitsPerMonth = bizData.visitCount / monthsActive;

      // Convert raw tier_index to human-friendly level (1-based position among tiers)
      const sortedTiers = [...tiers].sort((a, b) => a.tier_index - b.tier_index);
      const currentLevel = sortedTiers.findIndex((t) => t.tier_index === currentTier.tier_index) + 1;

      silverInputs.push({
        businessId: bizId,
        businessName: bizData.businessName,
        currentTierIndex: currentLevel,
        currentTierBps: currentTier.percent_bps,
        tier1Bps: tier1.percent_bps,
        avgTicketCents,
        visitsPerMonth: Math.round(visitsPerMonth * 100) / 100, // 2 decimal places
        daysUntilExpiry: daysLeft,
      });
    }

    const silvers = silverInputs.map((input) => {
      const prices = calculateSilverPrices(input, config);
      return {
        ...prices,
        hasActiveExtension: extMap.has(input.businessId) || !!goldExt,
        activeExtensionUntil: extMap.get(input.businessId) ?? goldExt?.effective_until ?? null,
        avgTicketCents: input.avgTicketCents,
        visitsPerMonth: input.visitsPerMonth,
      };
    });

    // 9) Calculate Gold prices
    const eligibleSilvers = silvers.filter((s) => !s.nothingToProtect);
    const gold = eligibleSilvers.length >= 2
      ? calculateGoldPrices(
          eligibleSilvers.map((s) => ({
            businessId: s.businessId,
            businessName: s.businessName,
            currentTierIndex: s.currentTierIndex,
            lostPerVisitCents: s.lostPerVisitCents,
            lostPerMonthCents: s.lostPerMonthCents,
            lostOver6MoCents: s.lostOver6MoCents,
            lostOver12MoCents: s.lostOver12MoCents,
            silver6PriceCents: s.silver6PriceCents,
            silver12PriceCents: s.silver12PriceCents,
            nothingToProtect: false,
          })),
          config
        )
      : null;

    return NextResponse.json({
      silvers,
      gold,
      daysUntilExpiry: daysLeft,
      nextAnniversary: nextAnniversary.toISOString().slice(0, 10),
      config: {
        silver6FeePct: config.silver6FeePct,
        silver12FeePct: config.silver12FeePct,
        goldDiscountPct: config.goldDiscountPct,
      },
    });
  } catch (err) {
    console.error("Tier extension pricing error:", err);
    return NextResponse.json(
      { error: "Failed to calculate pricing" },
      { status: 500 }
    );
  }
}
