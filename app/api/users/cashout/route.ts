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

// ─── Rate limit: one cashout per user per 30 seconds ───
const cashoutTimestamps = new Map<string, number>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const last = cashoutTimestamps.get(userId) || 0;
  if (now - last < 30_000) return false; // 30-second cooldown
  cashoutTimestamps.set(userId, now);
  // Clean old entries periodically
  if (cashoutTimestamps.size > 1000) {
    for (const [key, ts] of cashoutTimestamps) {
      if (now - ts > 60_000) cashoutTimestamps.delete(key);
    }
  }
  return true;
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

  // Rate limit
  if (!checkRateLimit(user.id)) {
    return NextResponse.json(
      { error: "Please wait before requesting another cashout." },
      { status: 429 },
    );
  }

  // Check for active ban
  const { data: activeBan } = await supabaseServer
    .from("user_bans")
    .select("id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (activeBan) {
    return NextResponse.json(
      { error: "Your account has been banned. Contact support for help." },
      { status: 403 },
    );
  }

  // Read platform settings
  const { data: ps } = await supabaseServer
    .from("platform_settings")
    .select("min_payout_cents")
    .eq("id", 1)
    .maybeSingle();
  const minCashoutCents = (ps?.min_payout_cents as number) || 2000;
  const monthlyCashoutCapCents = 20000; // $200/month (new accounts)
  const monthlyCashoutCapStandardCents = 50000; // $500/month (established)
  const cashoutCapMonths = 12; // 12-month probation

  // Fetch current profile (for validation + method info only — balance handled atomically)
  const { data: profile, error: profileErr } = await supabaseServer
    .from("profiles")
    .select("available_balance, payout_method, payout_identifier, payout_verified, status, stripe_connect_account_id, stripe_connect_onboarding_complete, created_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profileErr || !profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
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
  const rawAmount = body.amountCents ? Number(body.amountCents) : availableBalance;
  if (!Number.isFinite(rawAmount) || rawAmount > 10_000_000) {
    return NextResponse.json({ error: "Invalid cashout amount" }, { status: 400 });
  }
  const requestedAmount = Math.floor(rawAmount);

  // Validate net amount
  if (requestedAmount <= 0) {
    return NextResponse.json({ error: "Invalid cashout amount" }, { status: 400 });
  }

  // Calculate fee (3% for Venmo, free for bank)
  const feeCents = method === "venmo" ? Math.round(requestedAmount * 0.03) : 0;
  const netAmountCents = requestedAmount - feeCents;

  if (netAmountCents <= 0) {
    return NextResponse.json({ error: "Payout amount too small after fees" }, { status: 400 });
  }

  // Determine monthly cap based on account age
  const accountCreated = profile.created_at ? new Date(profile.created_at as string) : new Date();
  const accountAgeMs = Date.now() - accountCreated.getTime();
  const accountAgeMonths = accountAgeMs / (30.44 * 24 * 60 * 60 * 1000);
  const isNewAccount = accountAgeMonths < cashoutCapMonths;
  const activeCap = isNewAccount ? monthlyCashoutCapCents : monthlyCashoutCapStandardCents;

  // Compute itemized breakdown of balance sources
  let influencerPortionCents = 0;
  const influencerDetails: { period: string; signups: number; amountCents: number }[] = [];

  const { data: influencerRecord } = await supabaseServer
    .from("influencers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (influencerRecord) {
    const { data: creditedPayouts } = await supabaseServer
      .from("influencer_payouts")
      .select("amount_cents, signups_count, period_start, period_end")
      .eq("influencer_id", influencerRecord.id)
      .eq("credited_to_balance", true)
      .order("period_start", { ascending: true });

    const totalCredited = (creditedPayouts || []).reduce((s, p) => s + ((p.amount_cents as number) || 0), 0);

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

    influencerPortionCents = Math.max(0, totalCredited - alreadyCashedInfluencer);
    if (requestedAmount < availableBalance && influencerPortionCents > 0) {
      const ratio = requestedAmount / availableBalance;
      influencerPortionCents = Math.round(influencerPortionCents * ratio);
    }
    influencerPortionCents = Math.min(influencerPortionCents, requestedAmount);

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

  // ──── ATOMIC CASHOUT via Postgres function ────
  // This handles: balance check, monthly cap, balance deduction,
  // pending increment, and payout insert — all in one locked transaction.
  const { data: rpcResult, error: rpcError } = await supabaseServer.rpc("request_cashout", {
    p_user_id: user.id,
    p_amount_cents: requestedAmount,
    p_fee_cents: feeCents,
    p_net_cents: netAmountCents,
    p_method: method,
    p_account: account,
    p_breakdown: breakdown,
    p_monthly_cap: activeCap,
    p_min_cents: minCashoutCents,
  });

  if (rpcError) {
    // Extract user-friendly message from CASHOUT_ERROR exceptions
    const msg = rpcError.message || "Cashout failed";
    const match = msg.match(/CASHOUT_ERROR:(.*)/);
    const userMessage = match ? match[1].trim() : "Cashout failed. Please try again.";
    console.error("[cashout] RPC error:", msg);
    return NextResponse.json({ error: userMessage }, { status: 400 });
  }

  const payout = rpcResult as {
    id: string;
    amount_cents: number;
    fee_cents: number;
    net_amount_cents: number;
    method: string;
    status: string;
    requested_at: string;
  };

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
