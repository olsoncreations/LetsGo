import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { stripe } from "@/lib/stripe";

/**
 * GET /api/stripe/connect/status
 *
 * Check whether the user's Stripe Connect account is fully onboarded
 * and ready for transfers.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const { data: { user }, error: authErr } = await supabaseServer.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  try {
    const { data: profile } = await supabaseServer
      .from("profiles")
      .select("stripe_connect_account_id, stripe_connect_onboarding_complete")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.stripe_connect_account_id) {
      return NextResponse.json({ connected: false, payoutsEnabled: false, detailsSubmitted: false });
    }

    const account = await stripe.accounts.retrieve(profile.stripe_connect_account_id as string);

    const payoutsEnabled = account.payouts_enabled ?? false;
    const detailsSubmitted = account.details_submitted ?? false;

    // Update onboarding status if newly complete
    if (payoutsEnabled && !profile.stripe_connect_onboarding_complete) {
      await supabaseServer
        .from("profiles")
        .update({ stripe_connect_onboarding_complete: true })
        .eq("id", user.id);
    }

    return NextResponse.json({
      connected: true,
      payoutsEnabled,
      detailsSubmitted,
      onboardingComplete: payoutsEnabled,
    });
  } catch (err) {
    console.error("[stripe-connect-status] Error:", err);
    return NextResponse.json({ error: "Failed to check account status" }, { status: 500 });
  }
}
