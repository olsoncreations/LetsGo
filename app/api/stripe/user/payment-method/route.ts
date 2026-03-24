import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * PATCH /api/stripe/user/payment-method
 *
 * Saves a payment method to the user's profile after a SetupIntent completes.
 * Retrieves PM details from Stripe, verifies ownership, saves card/bank info.
 *
 * Body: { paymentMethodId: string }
 */
export async function PATCH(req: NextRequest): Promise<Response> {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { data: { user }, error: authErr } = await supabaseServer.auth.getUser(token);
    if (authErr || !user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await req.json();
    const { paymentMethodId } = body as { paymentMethodId?: string };

    if (!paymentMethodId) {
      return NextResponse.json({ error: "paymentMethodId is required" }, { status: 400 });
    }

    // Get user's Stripe customer ID
    const { data: profile } = await supabaseServer
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.stripe_customer_id) {
      return NextResponse.json({ error: "No Stripe customer found. Please set up payment first." }, { status: 400 });
    }

    // Retrieve payment method from Stripe
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId);

    // Verify ownership — PM must belong to this user's customer
    if (pm.customer !== profile.stripe_customer_id) {
      return NextResponse.json({ error: "Payment method does not belong to this account" }, { status: 403 });
    }

    // Extract details based on type
    const updates: Record<string, string | number | null> = {
      stripe_payment_method_id: paymentMethodId,
    };

    if (pm.type === "card" && pm.card) {
      updates.payment_method_type = "card";
      updates.payment_card_brand = pm.card.brand ?? null;
      updates.payment_card_last4 = pm.card.last4 ?? null;
      updates.payment_card_exp_month = pm.card.exp_month ?? null;
      updates.payment_card_exp_year = pm.card.exp_year ?? null;
      updates.payment_bank_name = null;
      updates.payment_bank_last4 = null;
    } else if (pm.type === "us_bank_account" && pm.us_bank_account) {
      updates.payment_method_type = "bank";
      updates.payment_card_brand = null;
      updates.payment_card_last4 = null;
      updates.payment_card_exp_month = null;
      updates.payment_card_exp_year = null;
      updates.payment_bank_name = pm.us_bank_account.bank_name ?? null;
      updates.payment_bank_last4 = pm.us_bank_account.last4 ?? null;
    } else {
      updates.payment_method_type = pm.type;
    }

    // Save to profiles
    const { error: updateErr } = await supabaseServer
      .from("profiles")
      .update(updates)
      .eq("id", user.id);

    if (updateErr) {
      console.error("[stripe/user/payment-method] Update error:", updateErr);
      return NextResponse.json({ error: "Failed to save payment method" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      paymentMethod: {
        type: updates.payment_method_type,
        cardBrand: updates.payment_card_brand,
        cardLast4: updates.payment_card_last4,
        cardExpMonth: updates.payment_card_exp_month,
        cardExpYear: updates.payment_card_exp_year,
        bankName: updates.payment_bank_name,
        bankLast4: updates.payment_bank_last4,
      },
    });
  } catch (err) {
    console.error("[stripe/user/payment-method] Error:", err);
    return NextResponse.json(
      { error: "Failed to save payment method" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/stripe/user/payment-method
 *
 * Removes the user's saved payment method.
 * Detaches from Stripe and clears profile columns.
 */
export async function DELETE(req: NextRequest): Promise<Response> {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { data: { user }, error: authErr } = await supabaseServer.auth.getUser(token);
    if (authErr || !user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { data: profile } = await supabaseServer
      .from("profiles")
      .select("stripe_payment_method_id")
      .eq("id", user.id)
      .maybeSingle();

    // Detach from Stripe if exists
    if (profile?.stripe_payment_method_id) {
      try {
        await stripe.paymentMethods.detach(profile.stripe_payment_method_id);
      } catch {
        // PM may already be detached — continue
      }
    }

    // Clear columns
    await supabaseServer
      .from("profiles")
      .update({
        stripe_payment_method_id: null,
        payment_method_type: null,
        payment_card_brand: null,
        payment_card_last4: null,
        payment_card_exp_month: null,
        payment_card_exp_year: null,
        payment_bank_name: null,
        payment_bank_last4: null,
      })
      .eq("id", user.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[stripe/user/payment-method] Delete error:", err);
    return NextResponse.json(
      { error: "Failed to remove payment method" },
      { status: 500 }
    );
  }
}
