import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { stripe } from "@/lib/stripe";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.useletsgo.com";

/**
 * POST /api/stripe/connect/onboard
 *
 * Creates a Stripe Connect Express account for the user (if none exists)
 * and returns an Account Link URL for Stripe-hosted onboarding.
 */
export async function POST(req: NextRequest): Promise<Response> {
  // Auth
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const { data: { user }, error: authErr } = await supabaseServer.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  try {
    // Check if user already has a Connect account
    const { data: profile } = await supabaseServer
      .from("profiles")
      .select("stripe_connect_account_id, stripe_connect_onboarding_complete, email, first_name, last_name")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    let accountId = profile.stripe_connect_account_id as string | null;

    // If account exists and onboarding is complete, return status
    if (accountId && profile.stripe_connect_onboarding_complete) {
      return NextResponse.json({
        ok: true,
        status: "complete",
        message: "Bank account already connected",
      });
    }

    // If account exists but onboarding incomplete, verify it's still valid
    if (accountId) {
      try {
        const existing = await stripe.accounts.retrieve(accountId);
        if (existing.payouts_enabled) {
          // Actually complete — update DB
          await supabaseServer
            .from("profiles")
            .update({ stripe_connect_onboarding_complete: true })
            .eq("id", user.id);
          return NextResponse.json({ ok: true, status: "complete", message: "Bank account already connected" });
        }
      } catch {
        // Account doesn't exist in Stripe — create a new one
        accountId = null;
      }
    }

    // Create new Express account if needed
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "US",
        email: profile.email || user.email || undefined,
        capabilities: {
          transfers: { requested: true },
        },
        business_type: "individual",
        metadata: {
          user_id: user.id,
          platform: "letsgo",
        },
      });

      accountId = account.id;

      // Save to profiles
      await supabaseServer
        .from("profiles")
        .update({
          stripe_connect_account_id: accountId,
          stripe_connect_onboarding_complete: false,
        })
        .eq("id", user.id);
    }

    // Create Account Link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${APP_URL}/profile?stripe_refresh=true`,
      return_url: `${APP_URL}/profile?stripe_connected=true`,
      type: "account_onboarding",
    });

    return NextResponse.json({
      ok: true,
      status: "onboarding",
      url: accountLink.url,
    });
  } catch (err) {
    console.error("[stripe-connect-onboard] Error:", err);
    const message = err instanceof Error ? err.message : "Failed to create onboarding link";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
