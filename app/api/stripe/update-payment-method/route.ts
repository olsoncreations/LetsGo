import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * POST /api/stripe/update-payment-method
 *
 * Creates a new SetupIntent for an existing business to update their payment method.
 * Uses existing Stripe customer or creates one if missing.
 *
 * Requires: Bearer token auth + business_users ownership/manager check.
 * Body: { businessId: string, paymentMethodType?: "card" | "us_bank_account" }
 */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    // Auth check
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const { data: { user }, error: authErr } = await supabaseServer.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const body = await req.json();
    const { businessId, paymentMethodType } = body as {
      businessId?: string;
      paymentMethodType?: "card" | "us_bank_account";
    };

    if (!businessId) {
      return NextResponse.json({ error: "businessId is required" }, { status: 400 });
    }

    // Verify user has access to this business (owner or manager)
    const { data: access } = await supabaseServer
      .from("business_users")
      .select("role")
      .eq("business_id", businessId)
      .eq("user_id", user.id)
      .maybeSingle();

    // Also check staff
    const { data: staff } = await supabaseServer
      .from("staff_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!access && !staff) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Get business info
    const { data: biz, error: bizErr } = await supabaseServer
      .from("business")
      .select("id, business_name, stripe_customer_id, config")
      .eq("id", businessId)
      .single();

    if (bizErr || !biz) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const cfg = (biz.config || {}) as Record<string, string>;
    let customerId = biz.stripe_customer_id;

    // Verify existing customer is valid, or create a new one
    if (customerId) {
      try {
        await stripe.customers.retrieve(customerId);
      } catch {
        // Customer doesn't exist in this Stripe mode (e.g. test→live switch)
        customerId = null;
      }
    }

    if (!customerId) {
      const customer = await stripe.customers.create({
        name: biz.business_name || undefined,
        email: cfg.contactEmail || cfg.email || undefined,
        metadata: { source: "payment_update", business_id: businessId },
      });
      customerId = customer.id;

      await supabaseServer
        .from("business")
        .update({ stripe_customer_id: customerId })
        .eq("id", businessId);
    }

    // Create SetupIntent
    const pmTypes: ("card" | "us_bank_account")[] =
      paymentMethodType === "us_bank_account"
        ? ["us_bank_account"]
        : paymentMethodType === "card"
          ? ["card"]
          : ["card", "us_bank_account"];

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: pmTypes,
      metadata: {
        source: "payment_update",
        business_id: businessId,
      },
    });

    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
      customerId,
      setupIntentId: setupIntent.id,
    });
  } catch (err) {
    console.error("[update-payment-method] Error:", err);
    const message = err instanceof Error ? err.message : "Failed to create setup intent";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/stripe/update-payment-method
 *
 * Saves payment method info to business config. Supports two modes:
 * 1. Stripe card: { businessId, paymentMethodId } — retrieves card details from Stripe
 * 2. Manual bank: { businessId, manualBank: { bankName, accountType } } — saves bank info directly
 */
export async function PATCH(req: NextRequest): Promise<Response> {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const { data: { user }, error: authErr } = await supabaseServer.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const body = await req.json();
    const { businessId, paymentMethodId, paymentType, manualBank, setPreferred } = body as {
      businessId?: string;
      paymentMethodId?: string;
      paymentType?: "card" | "bank";
      manualBank?: {
        bankName: string;
        accountType: "checking" | "savings";
        routingLast4?: string;
        accountLast4?: string;
      };
      setPreferred?: "card" | "bank";
    };

    if (!businessId) {
      return NextResponse.json({ error: "businessId is required" }, { status: 400 });
    }

    if (!paymentMethodId && !manualBank && !setPreferred) {
      return NextResponse.json({ error: "paymentMethodId, manualBank, or setPreferred required" }, { status: 400 });
    }

    // Verify access
    const { data: access } = await supabaseServer
      .from("business_users")
      .select("role")
      .eq("business_id", businessId)
      .eq("user_id", user.id)
      .maybeSingle();
    const { data: staff } = await supabaseServer
      .from("staff_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!access && !staff) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const configUpdates: Record<string, unknown> = {};
    let stripePaymentMethodId: string | undefined;

    // Set preferred only — just toggle config.paymentMethod without changing details
    if (setPreferred && !paymentMethodId && !manualBank) {
      const { data: currentBiz } = await supabaseServer
        .from("business")
        .select("config")
        .eq("id", businessId)
        .single();

      const currentConfig = (currentBiz?.config || {}) as Record<string, unknown>;
      const newConfig = { ...currentConfig, paymentMethod: setPreferred };

      const { error: updateErr } = await supabaseServer
        .from("business")
        .update({ config: newConfig })
        .eq("id", businessId);

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true, paymentType: setPreferred });
    }

    if (manualBank) {
      // Manual bank entry — save directly to config
      if (!manualBank.bankName?.trim()) {
        return NextResponse.json({ error: "Bank name is required" }, { status: 400 });
      }
      configUpdates.paymentMethod = "bank";
      configUpdates.bankName = manualBank.bankName.trim();
      configUpdates.accountType = manualBank.accountType || "checking";
      if (manualBank.routingLast4) configUpdates.routingLast4 = manualBank.routingLast4;
      if (manualBank.accountLast4) configUpdates.accountLast4 = manualBank.accountLast4;
    } else if (paymentMethodId) {
      // Stripe-based — retrieve payment method details
      stripePaymentMethodId = paymentMethodId;
      const pm = await stripe.paymentMethods.retrieve(paymentMethodId);

      configUpdates.paymentMethod = paymentType || (pm.type === "us_bank_account" ? "bank" : "card");

      if (pm.type === "card" && pm.card) {
        configUpdates.cardBrand = pm.card.brand || "Card";
        configUpdates.cardLast4 = pm.card.last4 || "";
        configUpdates.cardExpMonth = pm.card.exp_month;
        configUpdates.cardExpYear = pm.card.exp_year;
      } else if (pm.type === "us_bank_account" && pm.us_bank_account) {
        configUpdates.bankName = pm.us_bank_account.bank_name || "Bank Account";
        configUpdates.accountType = pm.us_bank_account.account_type || "checking";
      }
    }

    // Get current config and merge
    const { data: currentBiz } = await supabaseServer
      .from("business")
      .select("config")
      .eq("id", businessId)
      .single();

    const currentConfig = (currentBiz?.config || {}) as Record<string, unknown>;
    const newConfig = { ...currentConfig, ...configUpdates };

    // Update business table
    const updateData: Record<string, unknown> = { config: newConfig };
    if (stripePaymentMethodId) {
      updateData.stripe_payment_method_id = stripePaymentMethodId;
    }

    const { error: updateErr } = await supabaseServer
      .from("business")
      .update(updateData)
      .eq("id", businessId);

    if (updateErr) {
      console.error("[update-payment-method] Update error:", updateErr);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, paymentType: configUpdates.paymentMethod });
  } catch (err) {
    console.error("[update-payment-method] PATCH Error:", err);
    const message = err instanceof Error ? err.message : "Failed to update payment method";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
