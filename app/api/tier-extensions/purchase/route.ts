import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supabaseServer as supabase } from "@/lib/supabaseServer";
import { stripe } from "@/lib/stripe";
import {
  getAnniversaryWindowStart,
  getNextAnniversaryDate,
} from "@/lib/anniversaryWindow";
import {
  calculateSilverPrices,
  calculateGoldPrices,
  calculateRevenueSplit,
  splitGoldCredits,
  calculateEffectiveDates,
  parseTierExtensionConfig,
} from "@/lib/tierExtensionPricing";
import type { SilverPrices } from "@/lib/tierExtensionPricing";
import { logAudit } from "@/lib/auditLog";

type ProductType = "silver_6" | "silver_12" | "gold_6" | "gold_12";

/** Helper: create business credits + billing adjustments for an extension purchase */
async function createBusinessCredits(
  db: typeof supabase, extensionId: string | undefined, businessCreditCents: number,
  isSilver: boolean, businessId: string | undefined,
  silverResults: { bizId: string; silver6PriceCents: number; silver12PriceCents: number; currentTierIndex: number; lostPerMonthCents: number; nothingToProtect: boolean }[],
  config: { letsgoSplitPct: number; goldDiscountPct: number; silver6FeePct: number; silver12FeePct: number; churnWindowDays: number },
  userId: string
) {
  if (businessCreditCents <= 0) return;
  if (isSilver && businessId) {
    const { data: adj } = await db.from("billing_adjustments").insert({
      business_id: businessId, amount_cents: -businessCreditCents, type: "credit",
      description: "Premium Tier Extension Purchase", status: "pending", created_by: userId,
    }).select("id").single();
    if (adj && extensionId) {
      await db.from("tier_extension_business_credits").insert({
        tier_extension_id: extensionId, business_id: businessId,
        credit_cents: businessCreditCents, billing_adjustment_id: adj.id,
      });
    }
  } else if (!isSilver) {
    const goldPricesForCredits = calculateGoldPrices(
      silverResults.map((s) => ({ businessId: s.bizId, businessName: "", currentTierIndex: s.currentTierIndex, lostPerVisitCents: 0, lostPerMonthCents: s.lostPerMonthCents, lostOver6MoCents: 0, lostOver12MoCents: 0, silver6PriceCents: s.silver6PriceCents, silver12PriceCents: s.silver12PriceCents, nothingToProtect: s.nothingToProtect })),
      config
    );
    const credits = splitGoldCredits(businessCreditCents, goldPricesForCredits.businessShares);
    for (const credit of credits) {
      const { data: adj } = await db.from("billing_adjustments").insert({
        business_id: credit.businessId, amount_cents: -credit.creditCents, type: "credit",
        description: "Premium Tier Extension Purchase", status: "pending", created_by: userId,
      }).select("id").single();
      if (adj && extensionId) {
        await db.from("tier_extension_business_credits").insert({
          tier_extension_id: extensionId, business_id: credit.businessId,
          credit_cents: credit.creditCents, billing_adjustment_id: adj.id,
        });
      }
    }
  }
}

/**
 * POST /api/tier-extensions/purchase
 * Purchase a tier extension (Silver or Gold).
 */
export async function POST(req: NextRequest) {
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
    const body = await req.json();
    const productType = body.product_type as ProductType;
    const businessId = body.business_id as string | undefined;
    const paymentMethod = body.payment_method as string;

    // 2) Validate inputs
    if (!["silver_6", "silver_12", "gold_6", "gold_12"].includes(productType)) {
      return NextResponse.json({ error: "Invalid product_type" }, { status: 400 });
    }
    if (!["balance", "card", "venmo"].includes(paymentMethod)) {
      return NextResponse.json({ error: "Invalid payment_method" }, { status: 400 });
    }
    const isSilver = productType === "silver_6" || productType === "silver_12";
    if (isSilver && !businessId) {
      return NextResponse.json({ error: "business_id required for Silver" }, { status: 400 });
    }
    const extensionMonths: 6 | 12 = productType.endsWith("_6") ? 6 : 12;

    // 3) Get user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("created_at, available_balance, status, stripe_customer_id, stripe_payment_method_id, payment_method_type")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }
    if (profile.status === "suspended" || profile.status === "banned") {
      return NextResponse.json({ error: "Account is not active" }, { status: 403 });
    }

    // 4) Load extension config
    const { data: settings } = await supabase
      .from("platform_settings")
      .select("tier_extension_config")
      .eq("id", 1)
      .maybeSingle();
    const config = parseTierExtensionConfig(
      settings?.tier_extension_config as Record<string, unknown> | null
    );

    // 5) Recalculate price server-side (NEVER trust client price)
    const windowStart = getAnniversaryWindowStart(profile.created_at);
    const nextAnniversary = getNextAnniversaryDate(profile.created_at);

    // Get all user's approved receipts in current window
    const { data: receipts } = await supabase
      .from("receipts")
      .select("business_id, receipt_total_cents, visit_date")
      .eq("user_id", user.id)
      .eq("status", "approved")
      .gte("visit_date", windowStart);

    if (!receipts || receipts.length === 0) {
      return NextResponse.json({ error: "No receipt history to base pricing on" }, { status: 400 });
    }

    // Group by business
    const bizMap = new Map<string, { totalCents: number; visitCount: number; firstVisitDate: string }>();
    for (const r of receipts) {
      const biz = bizMap.get(r.business_id) ?? { totalCents: 0, visitCount: 0, firstVisitDate: r.visit_date };
      biz.totalCents += r.receipt_total_cents ?? 0;
      biz.visitCount += 1;
      if (r.visit_date < biz.firstVisitDate) biz.firstVisitDate = r.visit_date;
      bizMap.set(r.business_id, biz);
    }

    // Load tiers for relevant businesses
    const relevantBizIds = isSilver ? [businessId!] : Array.from(bizMap.keys());
    const { data: allTiers } = await supabase
      .from("business_payout_tiers")
      .select("business_id, tier_index, min_visits, max_visits, percent_bps, label")
      .in("business_id", relevantBizIds)
      .order("tier_index", { ascending: true });

    const tiersByBiz = new Map<string, typeof allTiers>();
    for (const t of allTiers ?? []) {
      const arr = tiersByBiz.get(t.business_id) ?? [];
      arr.push(t);
      tiersByBiz.set(t.business_id, arr);
    }

    // Calculate pricing for each relevant business
    const silverResults: (SilverPrices & { bizId: string })[] = [];

    for (const bizId of relevantBizIds) {
      const bizData = bizMap.get(bizId);
      if (!bizData) continue;
      const tiers = tiersByBiz.get(bizId) ?? [];
      if (tiers.length === 0) continue;

      const tier1 = tiers.reduce((lowest, t) => (!lowest || t.tier_index < lowest.tier_index) ? t : lowest, tiers[0]);
      if (!tier1) continue;

      let currentTier = tier1;
      for (const t of tiers) {
        const min = t.min_visits;
        const max = t.max_visits ?? Infinity;
        if (bizData.visitCount >= min && bizData.visitCount <= max) {
          if (t.tier_index > currentTier.tier_index) currentTier = t;
        }
      }

      if (currentTier.percent_bps <= tier1.percent_bps) continue; // nothing to protect (at lowest tier)

      const avgTicketCents = Math.floor(bizData.totalCents / bizData.visitCount);
      const firstVisit = new Date(bizData.firstVisitDate);
      const now = new Date();
      const monthsActive = Math.max(1, (now.getTime() - firstVisit.getTime()) / (1000 * 60 * 60 * 24 * 30));
      const visitsPerMonth = bizData.visitCount / monthsActive;

      const prices = calculateSilverPrices(
        {
          businessId: bizId,
          businessName: "",
          currentTierIndex: currentTier.tier_index,
          currentTierBps: currentTier.percent_bps,
          tier1Bps: tier1.percent_bps,
          avgTicketCents,
          visitsPerMonth,
          daysUntilExpiry: 0,
        },
        config
      );

      silverResults.push({ ...prices, bizId: bizId });
    }

    // 6) Determine final price
    let priceCents: number;
    let protectedTierIndex: number;

    if (isSilver) {
      const silver = silverResults.find((s) => s.bizId === businessId);
      if (!silver || silver.nothingToProtect) {
        return NextResponse.json({ error: "Nothing to protect at this business" }, { status: 400 });
      }
      priceCents = extensionMonths === 6 ? silver.silver6PriceCents : silver.silver12PriceCents;
      protectedTierIndex = silver.currentTierIndex;
    } else {
      // Gold
      if (silverResults.length === 0) {
        return NextResponse.json({ error: "No businesses with tiers to protect" }, { status: 400 });
      }
      const goldPrices = calculateGoldPrices(silverResults, config);
      priceCents = extensionMonths === 6 ? goldPrices.gold6PriceCents : goldPrices.gold12PriceCents;
      protectedTierIndex = Math.max(...silverResults.map((s) => s.currentTierIndex));
    }

    if (priceCents <= 0) {
      return NextResponse.json({ error: "Calculated price is invalid" }, { status: 400 });
    }

    // 7) Check for existing extension to stack on
    const existingExtQuery = supabase
      .from("tier_extensions")
      .select("effective_until")
      .eq("user_id", user.id)
      .eq("status", "active")
      .gte("effective_until", new Date().toISOString().slice(0, 10))
      .order("effective_until", { ascending: false })
      .limit(1);

    if (isSilver) {
      existingExtQuery.eq("business_id", businessId!);
    } else {
      existingExtQuery.is("business_id", null);
    }

    const { data: existingExt } = await existingExtQuery.maybeSingle();

    const existingUntil = existingExt?.effective_until
      ? new Date(existingExt.effective_until)
      : null;

    const { effectiveFrom, effectiveUntil } = calculateEffectiveDates(
      extensionMonths,
      nextAnniversary,
      existingUntil
    );

    const pricingSnapshot = {
      silverResults: silverResults.map((s) => ({
        businessId: s.bizId,
        currentTierIndex: s.currentTierIndex,
        silver6: s.silver6PriceCents,
        silver12: s.silver12PriceCents,
        lostPerMonth: s.lostPerMonthCents,
      })),
      config,
      calculatedAt: new Date().toISOString(),
    };

    // 8) Execute purchase — supports split payment (balance + card for remainder)
    const availableBalance = profile.available_balance ?? 0;
    const balanceToUse = Math.min(availableBalance, priceCents);
    const remainderCents = priceCents - balanceToUse;

    // Calculate processing fee on card portion only (3.5%)
    const PROCESSING_FEE_BPS = 350;
    const processingFeeCents = remainderCents > 0 ? Math.ceil(remainderCents * PROCESSING_FEE_BPS / 10000) : 0;
    const cardChargeCents = remainderCents + processingFeeCents;

    // If there's a card portion, verify payment method exists
    if (remainderCents > 0) {
      if (!profile.stripe_customer_id || !profile.stripe_payment_method_id) {
        return NextResponse.json(
          { error: "Insufficient balance and no payment method on file. Please add a card or bank account in your profile settings." },
          { status: 400 }
        );
      }
      if (cardChargeCents < 50) {
        return NextResponse.json({ error: "Card charge amount too small (minimum $0.50). Please use balance only." }, { status: 400 });
      }
    }

    // Step A: Deduct balance portion (if any) atomically
    if (balanceToUse > 0) {
      const { error: balError } = await supabase.rpc("purchase_tier_extension", {
        p_user_id: user.id,
        p_business_id: isSilver ? businessId! : null,
        p_product_type: productType,
        p_extension_months: extensionMonths,
        p_protected_tier_index: protectedTierIndex,
        p_price_cents: balanceToUse, // only deduct balance portion
        p_effective_from: effectiveFrom.toISOString().slice(0, 10),
        p_effective_until: effectiveUntil.toISOString().slice(0, 10),
        p_pricing_snapshot: { ...pricingSnapshot, balanceUsedCents: balanceToUse, cardChargedCents: cardChargeCents, processingFeeCents },
      });

      if (balError) {
        const msg = balError.message?.includes("EXTENSION_ERROR:")
          ? balError.message.split("EXTENSION_ERROR:")[1]
          : "Balance deduction failed";
        return NextResponse.json({ error: msg }, { status: 400 });
      }

      // If fully paid by balance, we're done — the RPC already created the extension
      if (remainderCents === 0) {
        // Get the extension that was just created
        const { data: newExt } = await supabase
          .from("tier_extensions")
          .select("id")
          .eq("user_id", user.id)
          .eq("product_type", productType)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const extensionId = newExt?.id;

        // Create business credits
        const { businessCreditCents } = calculateRevenueSplit(priceCents, config.letsgoSplitPct);
        await createBusinessCredits(supabase, extensionId, businessCreditCents, isSilver, businessId, silverResults, config, user.id);

        try {
          logAudit({ action: "tier_extension_purchased", tab: "Tier Extensions", targetType: "tier_extension", targetId: extensionId, staffId: user.id, staffName: user.email ?? "User", details: `Purchased ${productType} for $${(priceCents / 100).toFixed(2)} via balance` });
        } catch { /* non-blocking */ }

        return NextResponse.json({
          success: true,
          extension: { id: extensionId },
          priceCents,
          balanceUsedCents: balanceToUse,
          cardChargedCents: 0,
          processingFeeCents: 0,
          effectiveFrom: effectiveFrom.toISOString().slice(0, 10),
          effectiveUntil: effectiveUntil.toISOString().slice(0, 10),
        });
      }
    }

    // Step B: Charge remainder to card via Stripe
    // Create audit record for card portion
    const { data: attempt, error: attemptErr } = await supabase
      .from("user_payment_attempts")
      .insert({
        user_id: user.id,
        entity_type: "tier_extension",
        amount_cents: remainderCents,
        processing_fee_cents: processingFeeCents,
        total_cents: cardChargeCents,
        payment_method: profile.payment_method_type || "card",
        processor: "stripe",
        status: "pending",
      })
      .select("id")
      .single();

    if (attemptErr || !attempt) {
      // Refund balance if card setup fails (balance was already deducted)
      if (balanceToUse > 0) {
        await supabase.from("profiles").update({ available_balance: availableBalance }).eq("id", user.id);
      }
      return NextResponse.json({ error: "Failed to initiate payment" }, { status: 500 });
    }

    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: cardChargeCents,
        currency: "usd",
        customer: profile.stripe_customer_id!,
        payment_method: profile.stripe_payment_method_id!,
        off_session: true,
        confirm: true,
        description: `LetsGo Tier Extension - ${productType}`,
        metadata: {
          source: "tier_extension_purchase",
          user_id: user.id,
          product_type: productType,
          business_id: isSilver ? businessId! : "gold",
          extension_price_cents: String(priceCents),
          balance_used_cents: String(balanceToUse),
          card_charged_cents: String(cardChargeCents),
          processing_fee_cents: String(processingFeeCents),
          user_payment_attempt_id: attempt.id,
        },
      });

      if (paymentIntent.status === "succeeded") {
        await supabase.from("user_payment_attempts").update({
          status: "succeeded", stripe_payment_intent_id: paymentIntent.id,
          processor_response: { transaction_id: paymentIntent.id, processor: "stripe" },
          completed_at: new Date().toISOString(),
        }).eq("id", attempt.id);

        // If balance was used, extension already created by RPC. If not, create it now.
        let extensionId: string | undefined;
        if (balanceToUse > 0) {
          const { data: existingExt } = await supabase.from("tier_extensions").select("id")
            .eq("user_id", user.id).eq("product_type", productType)
            .order("created_at", { ascending: false }).limit(1).maybeSingle();
          extensionId = existingExt?.id;
        } else {
          const { data: extRow } = await supabase.from("tier_extensions").insert({
            user_id: user.id, business_id: isSilver ? businessId! : null,
            product_type: productType, extension_months: extensionMonths,
            protected_tier_index: protectedTierIndex, price_cents: priceCents,
            payment_method: profile.payment_method_type || "card",
            effective_from: effectiveFrom.toISOString().slice(0, 10),
            effective_until: effectiveUntil.toISOString().slice(0, 10),
            status: "active",
            pricing_snapshot: { ...pricingSnapshot, balanceUsedCents: balanceToUse, cardChargedCents: cardChargeCents, processingFeeCents, stripePaymentIntentId: paymentIntent.id },
          }).select("id").single();
          extensionId = extRow?.id;
        }

        if (extensionId) {
          await supabase.from("user_payment_attempts").update({ entity_id: extensionId }).eq("id", attempt.id);
        }

        // Create business credits on total price (not just card portion)
        const { businessCreditCents } = calculateRevenueSplit(priceCents, config.letsgoSplitPct);
        await createBusinessCredits(supabase, extensionId, businessCreditCents, isSilver, businessId, silverResults, config, user.id);

        try {
          logAudit({ action: "tier_extension_purchased", tab: "Tier Extensions", targetType: "tier_extension", targetId: extensionId, staffId: user.id, staffName: user.email ?? "User", details: `Purchased ${productType} for $${(priceCents / 100).toFixed(2)} (balance: $${(balanceToUse / 100).toFixed(2)}, card: $${(cardChargeCents / 100).toFixed(2)} incl $${(processingFeeCents / 100).toFixed(2)} fee)` });
        } catch { /* non-blocking */ }

        return NextResponse.json({
          success: true, extension: { id: extensionId }, priceCents,
          balanceUsedCents: balanceToUse, cardChargedCents: cardChargeCents, processingFeeCents,
          effectiveFrom: effectiveFrom.toISOString().slice(0, 10),
          effectiveUntil: effectiveUntil.toISOString().slice(0, 10),
        });
      } else if (paymentIntent.status === "requires_action") {
        await supabase.from("user_payment_attempts").update({
          stripe_payment_intent_id: paymentIntent.id,
          processor_response: { transaction_id: paymentIntent.id, status: "requires_action" },
        }).eq("id", attempt.id);

        return NextResponse.json({ pending: true, clientSecret: paymentIntent.client_secret, attemptId: attempt.id, priceCents, balanceUsedCents: balanceToUse, cardChargedCents: cardChargeCents, processingFeeCents });
      } else {
        // Card failed — refund balance portion
        if (balanceToUse > 0) {
          await supabase.from("profiles").update({ available_balance: availableBalance }).eq("id", user.id);
          // Delete the extension created by balance RPC
          await supabase.from("tier_extensions").delete().eq("user_id", user.id).eq("product_type", productType).order("created_at", { ascending: false }).limit(1);
        }
        await supabase.from("user_payment_attempts").update({ status: "failed", stripe_payment_intent_id: paymentIntent.id, error_message: `Payment status: ${paymentIntent.status}`, completed_at: new Date().toISOString() }).eq("id", attempt.id);
        return NextResponse.json({ error: "Payment failed. Please try again or use a different payment method." }, { status: 400 });
      }
    } catch (stripeErr) {
      const errMsg = stripeErr instanceof Error ? stripeErr.message : "Payment failed";
      // Refund balance portion on Stripe error
      if (balanceToUse > 0) {
        await supabase.from("profiles").update({ available_balance: availableBalance }).eq("id", user.id);
        await supabase.from("tier_extensions").delete().eq("user_id", user.id).eq("product_type", productType).order("created_at", { ascending: false }).limit(1);
      }
      await supabase.from("user_payment_attempts").update({ status: "failed", error_message: errMsg, completed_at: new Date().toISOString() }).eq("id", attempt.id);
      return NextResponse.json({ error: errMsg }, { status: 400 });
    }
  } catch (err) {
    console.error("Tier extension purchase error:", err);
    return NextResponse.json({ error: "Purchase failed" }, { status: 500 });
  }
}
