import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { notify } from "@/lib/notify";
import { NOTIFICATION_TYPES } from "@/lib/notificationTypes";

// ─── Helper: authenticate request ───

async function authenticate(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const {
    data: { user },
    error,
  } = await supabaseServer.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

/**
 * POST /api/users/cashout
 * Request a cashout of available balance.
 *
 * Body: { amountCents?: number }
 * - If amountCents is omitted, cashes out full available balance.
 */
export async function POST(req: NextRequest) {
  const user = await authenticate(req);
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  // Read minimum cashout from platform_settings (default $20.00)
  const { data: ps } = await supabaseServer
    .from("platform_settings")
    .select("min_payout_cents")
    .eq("id", 1)
    .maybeSingle();
  const minCashoutCents = (ps?.min_payout_cents as number) || 2000;

  // Fetch current profile
  const { data: profile, error: profileErr } = await supabaseServer
    .from("profiles")
    .select("available_balance, payout_method, payout_identifier, payout_verified, status")
    .eq("id", user.id)
    .maybeSingle();

  if (profileErr || !profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Check account status
  if (profile.status === "suspended") {
    return NextResponse.json({ error: "Your account is suspended. Contact support for help." }, { status: 403 });
  }

  // Verify payout method is configured
  if (!profile.payout_method || !profile.payout_identifier) {
    return NextResponse.json(
      { error: "Please connect a payout method (Venmo or PayPal) before cashing out." },
      { status: 400 },
    );
  }

  const availableBalance = (profile.available_balance as number) || 0;

  // Parse requested amount (default to full balance)
  const body = await req.json().catch(() => ({}));
  const requestedAmount = body.amountCents ? Math.floor(Number(body.amountCents)) : availableBalance;

  // Validate amount
  if (requestedAmount <= 0) {
    return NextResponse.json({ error: "Invalid cashout amount" }, { status: 400 });
  }

  if (requestedAmount < minCashoutCents) {
    return NextResponse.json(
      { error: `Minimum cashout is $${(minCashoutCents / 100).toFixed(2)}` },
      { status: 400 },
    );
  }

  if (requestedAmount > availableBalance) {
    return NextResponse.json(
      { error: `Insufficient balance. Available: $${(availableBalance / 100).toFixed(2)}` },
      { status: 400 },
    );
  }

  // Compute itemized breakdown of balance sources
  let influencerPortionCents = 0;
  const influencerDetails: { period: string; signups: number; amountCents: number }[] = [];

  // Check if this user is an influencer
  const { data: influencerRecord } = await supabaseServer
    .from("influencers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (influencerRecord) {
    // Total influencer earnings credited to balance
    const { data: creditedPayouts } = await supabaseServer
      .from("influencer_payouts")
      .select("amount_cents, signups_count, period_start, period_end")
      .eq("influencer_id", influencerRecord.id)
      .eq("credited_to_balance", true)
      .order("period_start", { ascending: true });

    const totalCredited = (creditedPayouts || []).reduce((s, p) => s + ((p.amount_cents as number) || 0), 0);

    // Total influencer portion already cashed out from previous cashouts
    const { data: prevCashouts } = await supabaseServer
      .from("user_payouts")
      .select("breakdown")
      .eq("user_id", user.id)
      .in("status", ["pending", "processing", "completed"]);

    let alreadyCashedInfluencer = 0;
    for (const c of prevCashouts || []) {
      const bd = c.breakdown as Record<string, unknown> | null;
      if (bd && typeof bd.influencer_earnings_cents === "number") {
        alreadyCashedInfluencer += bd.influencer_earnings_cents as number;
      }
    }

    // Influencer portion still in balance
    influencerPortionCents = Math.max(0, totalCredited - alreadyCashedInfluencer);

    // If requesting less than full balance, split proportionally
    if (requestedAmount < availableBalance && influencerPortionCents > 0) {
      const ratio = requestedAmount / availableBalance;
      influencerPortionCents = Math.round(influencerPortionCents * ratio);
    }

    // Cap at requested amount
    influencerPortionCents = Math.min(influencerPortionCents, requestedAmount);

    // Build period details
    for (const p of creditedPayouts || []) {
      const start = new Date((p.period_start as string) + "T00:00:00");
      const period = start.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      influencerDetails.push({
        period,
        signups: (p.signups_count as number) || 0,
        amountCents: (p.amount_cents as number) || 0,
      });
    }
  }

  const receiptPortionCents = requestedAmount - influencerPortionCents;

  const breakdown = {
    influencer_earnings_cents: influencerPortionCents,
    receipt_earnings_cents: receiptPortionCents,
    influencer_details: influencerDetails.length > 0 ? influencerDetails : undefined,
  };

  // Insert payout request with breakdown
  const { data: payout, error: payoutErr } = await supabaseServer
    .from("user_payouts")
    .insert({
      user_id: user.id,
      amount_cents: requestedAmount,
      method: profile.payout_method,
      account: profile.payout_identifier,
      status: "pending",
      requested_at: new Date().toISOString(),
      breakdown,
    })
    .select("id, amount_cents, method, status, requested_at")
    .single();

  if (payoutErr) {
    console.error("[cashout] Payout insert error:", payoutErr);
    return NextResponse.json({ error: "Failed to create cashout request" }, { status: 500 });
  }

  // Subtract from available balance, add to pending
  const { error: balanceErr } = await supabaseServer
    .from("profiles")
    .update({
      available_balance: availableBalance - requestedAmount,
      pending_payout: ((profile as Record<string, unknown>).pending_payout as number || 0) + requestedAmount,
    })
    .eq("id", user.id);

  if (balanceErr) {
    console.error("[cashout] Balance update error:", balanceErr);
    // Payout record exists — admin will reconcile. Don't fail the user.
  }

  // Notify user that their cashout request was submitted
  const methodLabel = String(profile.payout_method || "your account");
  const amountStr = `$${(requestedAmount / 100).toFixed(2)}`;
  notify({
    userId: user.id,
    type: NOTIFICATION_TYPES.PAYOUT_PROCESSED,
    title: "Cashout Requested!",
    body: `Your ${amountStr} cashout to ${methodLabel} has been submitted. It may take 1-3 business days to process.`,
    metadata: {
      payoutId: payout.id,
      amountCents: requestedAmount,
      method: methodLabel,
      href: "/profile",
    },
  });

  return NextResponse.json({
    ok: true,
    payoutId: payout.id,
    amountCents: payout.amount_cents,
    method: payout.method,
    status: payout.status,
  }, { status: 201 });
}
