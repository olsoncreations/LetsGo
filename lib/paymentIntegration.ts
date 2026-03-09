/**
 * paymentIntegration.ts
 *
 * Payment integration for user cashout payouts.
 * Supports two payout rails:
 *   1. Venmo (instant, 3% fee) — via PayPal Payouts API
 *   2. Bank Account (free, 2-3 days) — via Stripe Connect Transfers
 *
 * Required env vars:
 *   PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_MODE (sandbox|live)
 *   STRIPE_SECRET_KEY (shared with business billing)
 */

import { stripe } from "@/lib/stripe";

// ============================================================
// TYPES
// ============================================================

export interface PayoutRequest {
  user_id: string;
  payout_id: string;
  amount_cents: number;
  fee_cents: number;
  net_amount_cents: number;
  payment_method: PaymentMethod;
  payment_details: string | null; // Venmo handle (for venmo) or null (for bank)
  stripe_connect_account_id?: string | null; // Required for bank payouts
  recipient_name: string;
  recipient_email: string | null;
  memo?: string;
}

export interface PayoutResult {
  success: boolean;
  transaction_id?: string;
  provider: string;
  error?: string;
  timestamp: string;
}

export type PaymentMethod = "venmo" | "bank";

// ============================================================
// MAIN DISPATCHER
// ============================================================

/**
 * sendPayout
 * Routes a payout to the appropriate provider:
 *   - "venmo" → PayPal Payouts API (sends net_amount_cents after 3% fee)
 *   - "bank"  → Stripe Connect Transfer (sends net_amount_cents, fee is $0)
 */
export async function sendPayout(
  request: PayoutRequest
): Promise<PayoutResult> {
  if (request.payment_method === "venmo") {
    return sendViaPayPal(request);
  }

  if (request.payment_method === "bank") {
    return sendViaStripeConnect(request);
  }

  return {
    success: false,
    provider: "unknown",
    error: `Unsupported payment method: ${request.payment_method}. Only Venmo and Bank are supported.`,
    timestamp: new Date().toISOString(),
  };
}

// Keep legacy name for influencer payouts that may reference it
export const sendInfluencerPayout = sendPayout;

// ============================================================
// STRIPE CONNECT TRANSFERS
// ============================================================

/**
 * Send payout via Stripe Connect Transfer to user's Express account.
 * Transfers net_amount_cents (after any fees) to the connected account.
 */
async function sendViaStripeConnect(request: PayoutRequest): Promise<PayoutResult> {
  const timestamp = new Date().toISOString();

  if (!request.stripe_connect_account_id) {
    return {
      success: false,
      provider: "stripe_connect",
      error: "No Stripe bank account connected. Please connect a bank account first.",
      timestamp,
    };
  }

  try {
    const amountToTransfer = request.net_amount_cents;

    if (amountToTransfer <= 0) {
      return {
        success: false,
        provider: "stripe_connect",
        error: "Transfer amount must be greater than $0",
        timestamp,
      };
    }

    console.log("[Stripe Connect] Sending transfer:", {
      amount: amountToTransfer,
      destination: request.stripe_connect_account_id,
      payoutId: request.payout_id,
    });

    const transfer = await stripe.transfers.create({
      amount: amountToTransfer,
      currency: "usd",
      destination: request.stripe_connect_account_id,
      description: `LetsGo cashout - ${request.recipient_name}`,
      metadata: {
        payout_id: request.payout_id,
        user_id: request.user_id,
        platform: "letsgo",
      },
    });

    console.log("[Stripe Connect] Transfer created:", transfer.id);

    return {
      success: true,
      transaction_id: transfer.id,
      provider: "stripe_connect",
      timestamp,
    };
  } catch (err) {
    console.error("[Stripe Connect] Transfer error:", err);
    return {
      success: false,
      provider: "stripe_connect",
      error: err instanceof Error ? err.message : "Stripe transfer failed",
      timestamp,
    };
  }
}

// ============================================================
// PAYPAL PAYOUTS API (Venmo)
// ============================================================

const PAYPAL_BASE_URL =
  process.env.PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

/**
 * Get PayPal OAuth2 access token via client credentials grant.
 */
async function getPayPalAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("PayPal credentials not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.");
  }

  const res = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    console.error("[PayPal] OAuth token error, status:", res.status);
    throw new Error(`PayPal authentication failed (${res.status})`);
  }

  const data = await res.json();
  return data.access_token;
}

/**
 * Send payout via PayPal Payouts API with Venmo wallet.
 * Sends net_amount_cents (after 3% fee has been deducted).
 */
async function sendViaPayPal(request: PayoutRequest): Promise<PayoutResult> {
  const timestamp = new Date().toISOString();

  try {
    const accessToken = await getPayPalAccessToken();
    const amountStr = (request.net_amount_cents / 100).toFixed(2);

    const payoutItem: Record<string, unknown> = {
      recipient_type: "EMAIL",
      amount: { value: amountStr, currency: "USD" },
      receiver: request.payment_details,
      note: request.memo || `LetsGo cashout - ${request.recipient_name}`,
      sender_item_id: request.payout_id,
      recipient_wallet: "VENMO",
    };

    const body = {
      sender_batch_header: {
        sender_batch_id: `LETSGO-${request.payout_id}-${Date.now()}`,
        email_subject: "You've received a LetsGo cashout!",
        email_message: `Hi ${request.recipient_name}, your LetsGo cashout of $${amountStr} has been sent!`,
      },
      items: [payoutItem],
    };

    console.log("[PayPal] Sending Venmo payout:", {
      amount: amountStr,
      payoutId: request.payout_id,
    });

    const res = await fetch(`${PAYPAL_BASE_URL}/v1/payments/payouts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const responseData = await res.json();

    if (!res.ok) {
      console.error("[PayPal] Payout error:", responseData?.message || res.status);
      const errorMsg =
        responseData?.details?.[0]?.issue ||
        responseData?.message ||
        `PayPal API error (${res.status})`;
      return { success: false, provider: "venmo_via_paypal", error: errorMsg, timestamp };
    }

    const batchId = responseData?.batch_header?.payout_batch_id || "";
    console.log("[PayPal] Venmo payout batch created:", batchId);

    return {
      success: true,
      transaction_id: batchId,
      provider: "venmo_via_paypal",
      timestamp,
    };
  } catch (err) {
    console.error("[PayPal] Payout exception:", err);
    return {
      success: false,
      provider: "venmo_via_paypal",
      error: err instanceof Error ? err.message : "Venmo payout failed",
      timestamp,
    };
  }
}

// ============================================================
// HELPERS
// ============================================================

export function formatPayoutAmount(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function validatePayoutRequest(request: PayoutRequest): string | null {
  if (!request.user_id) return "Missing user ID";
  if (!request.payout_id) return "Missing payout ID";
  if (request.amount_cents <= 0) return "Payout amount must be greater than $0";
  if (!request.payment_method) return "Missing payment method";
  if (!request.recipient_name) return "Missing recipient name";

  if (request.payment_method === "venmo" && !request.payment_details?.trim()) {
    return "Venmo requires a username or phone number";
  }
  if (request.payment_method === "bank" && !request.stripe_connect_account_id) {
    return "Bank payout requires a connected Stripe account";
  }

  return null;
}
