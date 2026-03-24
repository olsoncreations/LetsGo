import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * POST /api/stripe/user/setup-intent
 *
 * Creates a Stripe Customer (if needed) + SetupIntent for collecting
 * a user's payment method (card or bank). No charge is made at this point.
 *
 * Mirrors the business pattern in /api/stripe/create-setup-intent.
 */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { data: { user }, error: authErr } = await supabaseServer.auth.getUser(token);
    if (authErr || !user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Check if user already has a Stripe Customer for inbound charges
    const { data: profile } = await supabaseServer
      .from("profiles")
      .select("stripe_customer_id, full_name, first_name, last_name")
      .eq("id", user.id)
      .maybeSingle();

    let customerId = profile?.stripe_customer_id;

    if (customerId) {
      // Verify customer still exists in Stripe (handles test/live mismatch)
      try {
        await stripe.customers.retrieve(customerId);
      } catch {
        // Customer doesn't exist — clear and recreate
        customerId = null;
      }
    }

    if (!customerId) {
      const displayName = profile?.full_name
        || `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim()
        || undefined;

      const customer = await stripe.customers.create({
        name: displayName,
        email: user.email,
        metadata: {
          source: "user_payment_setup",
          user_id: user.id,
          platform: "letsgo",
        },
      });

      customerId = customer.id;

      // Save to profiles
      await supabaseServer
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
    }

    // Create SetupIntent for collecting payment method
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card", "us_bank_account"],
      metadata: {
        source: "user_payment_setup",
        user_id: user.id,
      },
    });

    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
      customerId,
      setupIntentId: setupIntent.id,
    });
  } catch (err) {
    console.error("[stripe/user/setup-intent] Error:", err);
    return NextResponse.json(
      { error: "Failed to create setup intent" },
      { status: 500 }
    );
  }
}
