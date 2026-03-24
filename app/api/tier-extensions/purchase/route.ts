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
      .select("created_at, available_balance, status")
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

    // 8) Execute purchase
    if (paymentMethod === "balance") {
      // Use atomic PL/pgSQL function
      const { data: result, error: purchaseError } = await supabase.rpc(
        "purchase_tier_extension",
        {
          p_user_id: user.id,
          p_business_id: isSilver ? businessId! : null,
          p_product_type: productType,
          p_extension_months: extensionMonths,
          p_protected_tier_index: protectedTierIndex,
          p_price_cents: priceCents,
          p_effective_from: effectiveFrom.toISOString().slice(0, 10),
          p_effective_until: effectiveUntil.toISOString().slice(0, 10),
          p_pricing_snapshot: pricingSnapshot,
        }
      );

      if (purchaseError) {
        const msg = purchaseError.message?.includes("EXTENSION_ERROR:")
          ? purchaseError.message.split("EXTENSION_ERROR:")[1]
          : "Purchase failed";
        return NextResponse.json({ error: msg }, { status: 400 });
      }

      const extensionId = (result as { id?: string })?.id;

      // 9) Create business credits + billing adjustments
      const { businessCreditCents } = calculateRevenueSplit(priceCents, config.letsgoSplitPct);

      if (isSilver && businessCreditCents > 0) {
        // Single business credit
        const { data: adj } = await supabase
          .from("billing_adjustments")
          .insert({
            business_id: businessId!,
            amount_cents: -businessCreditCents, // negative = credit
            type: "credit",
            description: `Premium Tier Extension Purchase`,
            status: "pending",
            created_by: user.id,
          })
          .select("id")
          .single();

        if (adj) {
          await supabase.from("tier_extension_business_credits").insert({
            tier_extension_id: extensionId,
            business_id: businessId!,
            credit_cents: businessCreditCents,
            billing_adjustment_id: adj.id,
          });
        }
      } else if (!isSilver && businessCreditCents > 0) {
        // Gold: split proportionally across businesses
        const goldPrices = calculateGoldPrices(silverResults, config);
        const credits = splitGoldCredits(businessCreditCents, goldPrices.businessShares);

        for (const credit of credits) {
          const { data: adj } = await supabase
            .from("billing_adjustments")
            .insert({
              business_id: credit.businessId,
              amount_cents: -credit.creditCents,
              type: "credit",
              description: `Premium Tier Extension Purchase`,
              status: "pending",
              created_by: user.id,
            })
            .select("id")
            .single();

          if (adj) {
            await supabase.from("tier_extension_business_credits").insert({
              tier_extension_id: extensionId,
              business_id: credit.businessId,
              credit_cents: credit.creditCents,
              billing_adjustment_id: adj.id,
            });
          }
        }
      }

      // 10) Audit log
      try {
        logAudit({
          action: "tier_extension_purchased",
          tab: "Tier Extensions",
          targetType: "tier_extension",
          targetId: extensionId,
          staffId: user.id,
          staffName: user.email ?? "User",
          details: `Purchased ${productType} for $${(priceCents / 100).toFixed(2)} via balance`,
        });
      } catch {
        // Non-blocking
      }

      return NextResponse.json({
        success: true,
        extension: result,
        priceCents,
        effectiveFrom: effectiveFrom.toISOString().slice(0, 10),
        effectiveUntil: effectiveUntil.toISOString().slice(0, 10),
      });
    }

    // Card/Bank/Venmo payment via Stripe
    // Load user's saved payment method
    const { data: pmProfile } = await supabase
      .from("profiles")
      .select("stripe_customer_id, stripe_payment_method_id, payment_method_type")
      .eq("id", user.id)
      .maybeSingle();

    if (!pmProfile?.stripe_customer_id || !pmProfile?.stripe_payment_method_id) {
      return NextResponse.json(
        { error: "No payment method on file. Please add a card or bank account in your profile settings." },
        { status: 400 }
      );
    }

    // Calculate processing fee (3.5%)
    const PROCESSING_FEE_BPS = 350;
    const processingFeeCents = Math.ceil(priceCents * PROCESSING_FEE_BPS / 10000);
    const totalChargeCents = priceCents + processingFeeCents;

    if (totalChargeCents < 50) {
      return NextResponse.json({ error: "Amount too small for card payment (minimum $0.50)" }, { status: 400 });
    }

    // Create audit record
    const { data: attempt, error: attemptErr } = await supabase
      .from("user_payment_attempts")
      .insert({
        user_id: user.id,
        entity_type: "tier_extension",
        amount_cents: priceCents,
        processing_fee_cents: processingFeeCents,
        total_cents: totalChargeCents,
        payment_method: paymentMethod,
        processor: "stripe",
        status: "pending",
      })
      .select("id")
      .single();

    if (attemptErr || !attempt) {
      return NextResponse.json({ error: "Failed to initiate payment" }, { status: 500 });
    }

    // Charge via Stripe off-session PaymentIntent
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: totalChargeCents,
        currency: "usd",
        customer: pmProfile.stripe_customer_id,
        payment_method: pmProfile.stripe_payment_method_id,
        off_session: true,
        confirm: true,
        description: `LetsGo Tier Extension - ${productType}`,
        metadata: {
          source: "tier_extension_purchase",
          user_id: user.id,
          product_type: productType,
          business_id: isSilver ? businessId! : "gold",
          extension_price_cents: String(priceCents),
          processing_fee_cents: String(processingFeeCents),
          user_payment_attempt_id: attempt.id,
        },
      });

      if (paymentIntent.status === "succeeded") {
        // Payment succeeded — create the extension
        await supabase
          .from("user_payment_attempts")
          .update({
            status: "succeeded",
            stripe_payment_intent_id: paymentIntent.id,
            processor_response: { transaction_id: paymentIntent.id, processor: "stripe" },
            completed_at: new Date().toISOString(),
          })
          .eq("id", attempt.id);

        // Insert tier extension directly (no balance deduction needed)
        const { data: extRow } = await supabase
          .from("tier_extensions")
          .insert({
            user_id: user.id,
            business_id: isSilver ? businessId! : null,
            product_type: productType,
            extension_months: extensionMonths,
            protected_tier_index: protectedTierIndex,
            price_cents: priceCents,
            payment_method: paymentMethod,
            effective_from: effectiveFrom.toISOString().slice(0, 10),
            effective_until: effectiveUntil.toISOString().slice(0, 10),
            status: "active",
            pricing_snapshot: { ...pricingSnapshot, processingFeeCents, totalChargeCents, stripePaymentIntentId: paymentIntent.id },
          })
          .select("id")
          .single();

        const extensionId = extRow?.id;

        // Update attempt with entity_id
        if (extensionId) {
          await supabase
            .from("user_payment_attempts")
            .update({ entity_id: extensionId })
            .eq("id", attempt.id);
        }

        // Create business credits (same logic as balance payment)
        const { businessCreditCents } = calculateRevenueSplit(priceCents, config.letsgoSplitPct);

        if (isSilver && businessCreditCents > 0) {
          const { data: adj } = await supabase
            .from("billing_adjustments")
            .insert({
              business_id: businessId!,
              amount_cents: -businessCreditCents,
              type: "credit",
              description: `Premium Tier Extension Purchase`,
              status: "pending",
              created_by: user.id,
            })
            .select("id")
            .single();

          if (adj && extensionId) {
            await supabase.from("tier_extension_business_credits").insert({
              tier_extension_id: extensionId,
              business_id: businessId!,
              credit_cents: businessCreditCents,
              billing_adjustment_id: adj.id,
            });
          }
        } else if (!isSilver && businessCreditCents > 0) {
          const goldPricesForCredits = calculateGoldPrices(silverResults, config);
          const credits = splitGoldCredits(businessCreditCents, goldPricesForCredits.businessShares);

          for (const credit of credits) {
            const { data: adj } = await supabase
              .from("billing_adjustments")
              .insert({
                business_id: credit.businessId,
                amount_cents: -credit.creditCents,
                type: "credit",
                description: `Premium Tier Extension Purchase`,
                status: "pending",
                created_by: user.id,
              })
              .select("id")
              .single();

            if (adj && extensionId) {
              await supabase.from("tier_extension_business_credits").insert({
                tier_extension_id: extensionId,
                business_id: credit.businessId,
                credit_cents: credit.creditCents,
                billing_adjustment_id: adj.id,
              });
            }
          }
        }

        // Audit log
        try {
          logAudit({
            action: "tier_extension_purchased",
            tab: "Tier Extensions",
            targetType: "tier_extension",
            targetId: extensionId,
            staffId: user.id,
            staffName: user.email ?? "User",
            details: `Purchased ${productType} for $${(priceCents / 100).toFixed(2)} via ${paymentMethod} (fee: $${(processingFeeCents / 100).toFixed(2)})`,
          });
        } catch {
          // Non-blocking
        }

        return NextResponse.json({
          success: true,
          extension: { id: extensionId },
          priceCents,
          processingFeeCents,
          totalChargeCents,
          effectiveFrom: effectiveFrom.toISOString().slice(0, 10),
          effectiveUntil: effectiveUntil.toISOString().slice(0, 10),
        });
      } else if (paymentIntent.status === "requires_action") {
        // 3D Secure or bank verification needed
        await supabase
          .from("user_payment_attempts")
          .update({
            stripe_payment_intent_id: paymentIntent.id,
            processor_response: { transaction_id: paymentIntent.id, status: "requires_action" },
          })
          .eq("id", attempt.id);

        return NextResponse.json({
          pending: true,
          clientSecret: paymentIntent.client_secret,
          attemptId: attempt.id,
          priceCents,
          processingFeeCents,
          totalChargeCents,
        });
      } else {
        // Payment failed
        await supabase
          .from("user_payment_attempts")
          .update({
            status: "failed",
            stripe_payment_intent_id: paymentIntent.id,
            error_message: `Payment status: ${paymentIntent.status}`,
            completed_at: new Date().toISOString(),
          })
          .eq("id", attempt.id);

        return NextResponse.json({ error: "Payment failed. Please try again or use a different payment method." }, { status: 400 });
      }
    } catch (stripeErr) {
      // Stripe API error (card declined, etc.)
      const errMsg = stripeErr instanceof Error ? stripeErr.message : "Payment failed";
      await supabase
        .from("user_payment_attempts")
        .update({
          status: "failed",
          error_message: errMsg,
          completed_at: new Date().toISOString(),
        })
        .eq("id", attempt.id);

      return NextResponse.json({ error: errMsg }, { status: 400 });
    }
  } catch (err) {
    console.error("Tier extension purchase error:", err);
    return NextResponse.json({ error: "Purchase failed" }, { status: 500 });
  }
}
