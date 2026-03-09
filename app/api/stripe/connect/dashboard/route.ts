import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { stripe } from "@/lib/stripe";

/**
 * POST /api/stripe/connect/dashboard
 *
 * Creates a login link for the user's Stripe Express Dashboard
 * where they can view transfers and update bank details.
 */
export async function POST(req: NextRequest): Promise<Response> {
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
      return NextResponse.json({ error: "No bank account connected" }, { status: 400 });
    }

    if (!profile.stripe_connect_onboarding_complete) {
      return NextResponse.json({ error: "Bank account setup not complete" }, { status: 400 });
    }

    const loginLink = await stripe.accounts.createLoginLink(
      profile.stripe_connect_account_id as string
    );

    return NextResponse.json({ ok: true, url: loginLink.url });
  } catch (err) {
    console.error("[stripe-connect-dashboard] Error:", err);
    return NextResponse.json({ error: "Failed to create dashboard link" }, { status: 500 });
  }
}
