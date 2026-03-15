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
 * Body: { amountCents?: number, method?: "venmo" | "bank" }
 * - If amountCents is omitted, cashes out full available balance.
 * - If method is omitted, uses profile's payout_method.
 * - Venmo: 3% fee deducted from payout. Bank: free.
 */
export async function POST(req: NextRequest) {
  const user = await authenticate(req);
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  // Read platform settings
  const { data: ps } = await supabaseServer
    .from("platform_settings")
    .select("min_payout_cents, monthly_cashout_cap_cents, monthly_cashout_cap_standard_cents, cashout_cap_months")
    .eq("id", 1)
    .maybeSingle();
  const minCashoutCents = (ps?.min_payout_cents as number) || 2000;
  const monthlyCashoutCapCents = (ps?.monthly_cashout_cap_cents as number) || 20000; // $200 default (new accounts)
  const monthlyCashoutCapStandardCents = (ps?.monthly_cashout_cap_standard_cents as number) || 50000; // $500 default (after probation)
  const cashoutCapMonths = (ps?.cashout_cap_months as number) || 12; // 12-month probation default

  // Fetch current profile
  const { data: profile, error: profileErr } = await supabaseServer
    .from("profiles")
    .select("available_balance, payout_method, payout_identifier, payout_verified, status, stripe_connect_account_id, stripe_connect_onboarding_complete, created_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profileErr || !profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Check account status
  if (profile.status === "suspended") {
    return NextResponse.json({ error: "Your account is suspended. Contact support for help." }, { status: 403 });
  }

  // Parse request body
  const body = await req.json().catch(() => ({}));
  const method = (body.method as string) || profile.payout_method || "";

  // Validate payout method
  if (method === "venmo") {
    if (!profile.payout_identifier) {
      return NextResponse.json(
        { error: "Please connect your Venmo account before cashing out." },
        { status: 400 },
      );
    }
  } else if (method === "bank") {
    if (!profile.stripe_connect_account_id || !profile.stripe_connect_onboarding_complete) {
      return NextResponse.json(
        { error: "Please connect your bank account before cashing out." },
        { status: 400 },
      );
    }
  } else {
    return NextResponse.json(
      { error: "Please select a payout method (Venmo or Bank Account)." },
      { status: 400 },
    );
  }

  const availableBalance = (profile.available_balance as number) || 0;

  // Parse requested amount (default to full balance)
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

  // Monthly cashout cap (fraud prevention)
  // New accounts (<12 months): $200/month | Established accounts: $500/month
  const accountCreated = profile.created_at ? new Date(profile.created_at as string) : new Date();
  const accountAgeMs = Date.now() - accountCreated.getTime();
  const accountAgeMonths = accountAgeMs / (30.44 * 24 * 60 * 60 * 1000); // avg days/month
  const isNewAccount = accountAgeMonths < cashoutCapMonths;
  const activeCap = isNewAccount ? monthlyCashoutCapCents : monthlyCashoutCapStandardCents;
  const capLabel = isNewAccount
    ? `$${(monthlyCashoutCapCents / 100).toFixed(2)}/month for the first ${cashoutCapMonths} months`
    : `$${(monthlyCashoutCapStandardCents / 100).toFixed(2)}/month`;

  {
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01T00:00:00`;

    const { data: monthCashouts } = await supabaseServer
      .from("user_payouts")
      .select("amount_cents")
      .eq("user_id", user.id)
      .in("status", ["pending", "processing", "completed"])
      .gte("requested_at", monthStart);

    const cashedThisMonth = (monthCashouts || []).reduce(
      (sum, c) => sum + ((c.amount_cents as number) || 0), 0
    );

    const remainingCap = activeCap - cashedThisMonth;

    if (remainingCap <= 0) {
      return NextResponse.json(
        { error: `Monthly cashout limit reached (${capLabel}). Resets next month.` },
        { status: 400 },
      );
    }

    if (requestedAmount > remainingCap) {
      return NextResponse.json(
        { error: `Monthly cashout limit: $${(remainingCap / 100).toFixed(2)} remaining this month (${capLabel}).` },
        { status: 400 },
      );
    }
  }

  // Calculate fee (3% for Venmo, free for bank)
  const feeCents = method === "venmo" ? Math.round(requestedAmount * 0.03) : 0;
  const netAmountCents = requestedAmount - feeCents;

  if (netAmountCents <= 0) {
    return NextResponse.json({ error: "Payout amount too small after fees" }, { status: 400 });
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

  // Determine account identifier for the payout record
  const account = method === "venmo"
    ? profile.payout_identifier
    : `bank:${(profile.stripe_connect_account_id as string).slice(0, 12)}...`;

  // Insert payout request with fee tracking
  const { data: payout, error: payoutErr } = await supabaseServer
    .from("user_payouts")
    .insert({
      user_id: user.id,
      amount_cents: requestedAmount,
      fee_cents: feeCents,
      net_amount_cents: netAmountCents,
      method,
      account,
      status: "pending",
      requested_at: new Date().toISOString(),
      breakdown,
    })
    .select("id, amount_cents, fee_cents, net_amount_cents, method, status, requested_at")
    .single();

  if (payoutErr) {
    console.error("[cashout] Payout insert error:", payoutErr);
    return NextResponse.json({ error: "Failed to create cashout request" }, { status: 500 });
  }

  // Re-read balance to mitigate race conditions between validation and update
  const { data: freshProfile } = await supabaseServer
    .from("profiles")
    .select("available_balance, pending_payout")
    .eq("id", user.id)
    .maybeSingle();

  const freshBalance = (freshProfile?.available_balance as number) || 0;
  const freshPending = (freshProfile?.pending_payout as number) || 0;

  if (freshBalance < requestedAmount) {
    // Balance changed between validation and update — roll back the payout record
    await supabaseServer.from("user_payouts").delete().eq("id", payout.id);
    return NextResponse.json(
      { error: "Balance changed. Please try again." },
      { status: 409 },
    );
  }

  // Subtract from available balance, add to pending
  const { error: balanceErr } = await supabaseServer
    .from("profiles")
    .update({
      available_balance: freshBalance - requestedAmount,
      pending_payout: freshPending + requestedAmount,
    })
    .eq("id", user.id);

  if (balanceErr) {
    console.error("[cashout] Balance update error:", balanceErr);
  }

  // Build notification message
  const amountStr = `$${(requestedAmount / 100).toFixed(2)}`;
  let notifBody: string;
  if (method === "venmo") {
    const feeStr = `$${(feeCents / 100).toFixed(2)}`;
    const netStr = `$${(netAmountCents / 100).toFixed(2)}`;
    notifBody = `Your ${amountStr} cashout to Venmo has been submitted (${feeStr} fee, you'll receive ${netStr}). Arrives in minutes after approval.`;
  } else {
    notifBody = `Your ${amountStr} cashout to your bank account has been submitted (no fee). Arrives in 2-3 business days.`;
  }

  notify({
    userId: user.id,
    type: NOTIFICATION_TYPES.PAYOUT_PROCESSED,
    title: "Cashout Requested!",
    body: notifBody,
    metadata: {
      payoutId: payout.id,
      amountCents: requestedAmount,
      feeCents,
      netAmountCents,
      method,
      href: "/profile",
    },
  });

  return NextResponse.json({
    ok: true,
    payoutId: payout.id,
    amountCents: payout.amount_cents,
    feeCents: payout.fee_cents,
    netAmountCents: payout.net_amount_cents,
    method: payout.method,
    status: payout.status,
  }, { status: 201 });
}
