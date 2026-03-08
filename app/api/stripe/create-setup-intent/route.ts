import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * POST /api/stripe/create-setup-intent
 *
 * Creates a Stripe Customer + SetupIntent for collecting a payment method
 * during partner onboarding. No charge is made at this point.
 *
 * Requires: Bearer token authentication (logged-in user).
 * Body: { businessName: string, email: string, paymentMethodType?: "card" | "us_bank_account" }
 */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    // Auth: require logged-in user
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { data: { user }, error: authErr } = await supabaseServer.auth.getUser(token);
    if (authErr || !user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

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
        user_id: user.id,
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
        user_id: user.id,
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
