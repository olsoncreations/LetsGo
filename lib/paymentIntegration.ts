/**
 * paymentIntegration.ts
 *
 * Foundation for influencer payout integrations.
 * Currently a structured placeholder — wire up your chosen payment provider
 * by implementing the provider-specific functions below.
 *
 * Supported provider stubs:
 *  - Stripe (Connect / Express payouts)
 *  - PayPal Payouts API
 *  - Venmo / Zelle (manual — no API)
 *  - ACH / Bank Transfer (via Stripe or Dwolla)
 *  - Check (manual generation)
 *
 * Usage (when wired up):
 *   const result = await sendInfluencerPayout(payout, influencer);
 *   if (result.success) markPayoutPaid(payout.id);
 */

// ============================================================
// TYPES
// ============================================================

export interface PayoutRequest {
  influencer_id: string;
  payout_id: string;
  amount_cents: number;           // Amount to pay in cents
  payment_method: PaymentMethod;
  payment_details: string | null; // Account info, PayPal email, etc.
  recipient_name: string;
  recipient_email: string | null;
  memo?: string;                  // Reference note on payout
}

export interface PayoutResult {
  success: boolean;
  transaction_id?: string;        // Provider-returned transaction/transfer ID
  provider: string;
  error?: string;
  timestamp: string;
}

export type PaymentMethod =
  | "bank_transfer"
  | "paypal"
  | "venmo"
  | "zelle"
  | "check"
  | "other";

// ============================================================
// MAIN DISPATCHER
// ============================================================

/**
 * sendInfluencerPayout
 * Routes a payout to the correct provider based on payment_method.
 * Returns a PayoutResult indicating success/failure.
 */
export async function sendInfluencerPayout(
  request: PayoutRequest
): Promise<PayoutResult> {
  switch (request.payment_method) {
    case "bank_transfer":
      return sendViaStripeACH(request);
    case "paypal":
      return sendViaPayPal(request);
    case "venmo":
      return logManualPayout(request, "venmo");
    case "zelle":
      return logManualPayout(request, "zelle");
    case "check":
      return logManualPayout(request, "check");
    default:
      return logManualPayout(request, "other");
  }
}

// ============================================================
// PROVIDER STUBS
// ============================================================

/**
 * Stripe ACH / Express Payout
 *
 * To wire up:
 * 1. Set up Stripe Connect for your platform account
 * 2. Each influencer needs a Stripe Connect account ID stored in payment_details
 * 3. Install stripe: npm install stripe
 * 4. Add STRIPE_SECRET_KEY to your .env
 *
 * Example implementation:
 *   const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2023-10-16" });
 *   const transfer = await stripe.transfers.create({
 *     amount: request.amount_cents,
 *     currency: "usd",
 *     destination: request.payment_details, // Stripe Connect account ID
 *     description: request.memo || "LetsGo influencer payout",
 *   });
 *   return { success: true, transaction_id: transfer.id, provider: "stripe", timestamp: new Date().toISOString() };
 */
async function sendViaStripeACH(request: PayoutRequest): Promise<PayoutResult> {
  console.log("[PaymentIntegration] Stripe ACH payout stub called", {
    amount: request.amount_cents,
    recipient: request.recipient_name,
  });

  // TODO: Implement Stripe Connect payout
  // See: https://stripe.com/docs/connect/account-transfers
  return {
    success: false,
    provider: "stripe",
    error: "Stripe Connect not yet configured. See lib/paymentIntegration.ts for setup instructions.",
    timestamp: new Date().toISOString(),
  };
}

/**
 * PayPal Payouts API
 *
 * To wire up:
 * 1. Create a PayPal Business account with Payouts API access
 * 2. Add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to .env
 * 3. Use PayPal's REST API to send mass payouts
 *
 * Example implementation:
 *   const accessToken = await getPayPalAccessToken();
 *   const response = await fetch("https://api.paypal.com/v1/payments/payouts", {
 *     method: "POST",
 *     headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
 *     body: JSON.stringify({
 *       sender_batch_header: { email_subject: "LetsGo Influencer Payout" },
 *       items: [{
 *         recipient_type: "EMAIL",
 *         amount: { value: (request.amount_cents / 100).toFixed(2), currency: "USD" },
 *         receiver: request.payment_details, // PayPal email
 *         note: request.memo || "LetsGo influencer payout",
 *       }]
 *     })
 *   });
 */
async function sendViaPayPal(request: PayoutRequest): Promise<PayoutResult> {
  console.log("[PaymentIntegration] PayPal payout stub called", {
    amount: request.amount_cents,
    recipient: request.payment_details,
  });

  // TODO: Implement PayPal Payouts API
  // See: https://developer.paypal.com/docs/payouts/
  return {
    success: false,
    provider: "paypal",
    error: "PayPal Payouts API not yet configured. See lib/paymentIntegration.ts for setup instructions.",
    timestamp: new Date().toISOString(),
  };
}

/**
 * Manual Payout Logger
 * For Venmo, Zelle, Check, and Other — these have no public API.
 * Logs the payout intent and returns a result for the admin to manually process.
 */
function logManualPayout(request: PayoutRequest, method: string): PayoutResult {
  const manualRef = `MANUAL-${method.toUpperCase()}-${Date.now()}`;

  console.log("[PaymentIntegration] Manual payout logged", {
    ref: manualRef,
    method,
    amount: `$${(request.amount_cents / 100).toFixed(2)}`,
    recipient: request.recipient_name,
    details: request.payment_details,
    memo: request.memo,
  });

  // For manual methods, we return success = true so admin can proceed
  // The actual payment is made outside the system
  return {
    success: true,
    transaction_id: manualRef,
    provider: method,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================
// HELPERS
// ============================================================

/**
 * formatPayoutAmount
 * Converts cents to a human-readable dollar string.
 */
export function formatPayoutAmount(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * validatePayoutRequest
 * Returns an error string if the request is invalid, or null if valid.
 */
export function validatePayoutRequest(request: PayoutRequest): string | null {
  if (!request.influencer_id) return "Missing influencer ID";
  if (!request.payout_id) return "Missing payout ID";
  if (request.amount_cents <= 0) return "Payout amount must be greater than $0";
  if (!request.payment_method) return "Missing payment method";
  if (!request.recipient_name) return "Missing recipient name";

  if (request.payment_method === "paypal" && !request.payment_details?.includes("@")) {
    return "PayPal payment requires a valid email address in payment details";
  }
  if (request.payment_method === "bank_transfer" && !request.payment_details) {
    return "Bank transfer requires account/routing info or Stripe Connect ID in payment details";
  }

  return null;
}

// ============================================================
// FUTURE: AUTOMATED PAYOUT SCHEDULING
// ============================================================
// When you're ready to automate payouts, create an API route:
//   POST /api/admin/influencer-payouts/process
// That route would:
// 1. Fetch all unpaid influencer_payouts where signups_count >= 1000
// 2. For each: build a PayoutRequest and call sendInfluencerPayout()
// 3. On success: update influencer_payouts.paid = true, paid_at = now()
// 4. Log results to an audit table
//
// Cron job (Vercel Cron or similar):
//   schedule: "0 9 1 * *" (9am on 1st of each month)
//   endpoint: /api/admin/influencer-payouts/process
