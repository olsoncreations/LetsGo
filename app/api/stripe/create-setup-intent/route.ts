import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

/**
 * POST /api/stripe/create-setup-intent
 *
 * Creates a Stripe Customer + SetupIntent for collecting a payment method
 * during partner onboarding. No charge is made at this point.
 *
 * Body: { businessName: string, email: string, paymentMethodType?: "card" | "us_bank_account" }
 */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const body = await req.json();
    const { businessName, email, paymentMethodType } = body as {
      businessName?: string;
      email?: string;
      paymentMethodType?: "card" | "us_bank_account";
    };

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Create a Stripe Customer
    const customer = await stripe.customers.create({
      name: businessName || undefined,
      email,
      metadata: {
        source: "partner_onboarding",
      },
    });

    // Create a SetupIntent to collect payment method
    const paymentMethodTypes: ("card" | "us_bank_account")[] =
      paymentMethodType === "us_bank_account"
        ? ["us_bank_account"]
        : paymentMethodType === "card"
          ? ["card"]
          : ["card", "us_bank_account"];

    const setupIntent = await stripe.setupIntents.create({
      customer: customer.id,
      payment_method_types: paymentMethodTypes,
      metadata: {
        source: "partner_onboarding",
        business_name: businessName || "",
      },
    });

    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
      customerId: customer.id,
      setupIntentId: setupIntent.id,
    });
  } catch (err) {
    console.error("[create-setup-intent] Error:", err);
    const message = err instanceof Error ? err.message : "Failed to create setup intent";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
