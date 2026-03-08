/**
 * paymentIntegration.ts
 *
 * Payment integration for user cashout payouts via PayPal Payouts API.
 * Supports PayPal and Venmo recipients through a single API.
 *
 * Required env vars:
 *   PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_MODE (sandbox|live)
 */

// ============================================================
// TYPES
// ============================================================

export interface PayoutRequest {
  user_id: string;
  payout_id: string;
  amount_cents: number;
  payment_method: PaymentMethod;
  payment_details: string | null; // Venmo handle or PayPal email
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

export type PaymentMethod = "paypal" | "venmo";

// ============================================================
// MAIN DISPATCHER
// ============================================================

/**
 * sendPayout
 * Routes a payout to PayPal Payouts API (handles both PayPal and Venmo).
 */
export async function sendPayout(
  request: PayoutRequest
): Promise<PayoutResult> {
  if (request.payment_method !== "paypal" && request.payment_method !== "venmo") {
    return {
      success: false,
      provider: "unknown",
      error: `Unsupported payment method: ${request.payment_method}. Only PayPal and Venmo are supported.`,
      timestamp: new Date().toISOString(),
    };
  }

  return sendViaPayPal(request);
}

// Keep legacy name for influencer payouts that may reference it
export const sendInfluencerPayout = sendPayout;

// ============================================================
// PAYPAL PAYOUTS API
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
 * Send payout via PayPal Payouts API.
 * Handles both PayPal (email) and Venmo (handle) recipients.
 */
async function sendViaPayPal(request: PayoutRequest): Promise<PayoutResult> {
  const timestamp = new Date().toISOString();

  try {
    const accessToken = await getPayPalAccessToken();
    const isVenmo = request.payment_method === "venmo";
    const amountStr = (request.amount_cents / 100).toFixed(2);

    // Build the payout item
    const payoutItem: Record<string, unknown> = {
      recipient_type: "EMAIL",
      amount: { value: amountStr, currency: "USD" },
      receiver: request.payment_details,
      note: request.memo || `LetsGo cashout - ${request.recipient_name}`,
      sender_item_id: request.payout_id,
    };

    // For Venmo recipients, add the wallet designation
    if (isVenmo) {
      payoutItem.recipient_wallet = "VENMO";
    }

    const body = {
      sender_batch_header: {
        sender_batch_id: `LETSGO-${request.payout_id}-${Date.now()}`,
        email_subject: "You've received a LetsGo cashout!",
        email_message: `Hi ${request.recipient_name}, your LetsGo cashout of $${amountStr} has been sent!`,
      },
      items: [payoutItem],
    };

    console.log("[PayPal] Sending payout:", {
      amount: amountStr,
      method: request.payment_method,
      isVenmo,
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
      return { success: false, provider: "paypal", error: errorMsg, timestamp };
    }

    // PayPal returns a batch with a payout_batch_id
    const batchId = responseData?.batch_header?.payout_batch_id || "";
    console.log("[PayPal] Payout batch created:", batchId);

    return {
      success: true,
      transaction_id: batchId,
      provider: isVenmo ? "venmo_via_paypal" : "paypal",
      timestamp,
    };
  } catch (err) {
    console.error("[PayPal] Payout exception:", err);
    return {
      success: false,
      provider: "paypal",
      error: err instanceof Error ? err.message : "PayPal payout failed",
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

  if (request.payment_method === "paypal" && !request.payment_details?.includes("@")) {
    return "PayPal requires a valid email address";
  }
  if (request.payment_method === "venmo" && !request.payment_details?.trim()) {
    return "Venmo requires a username or phone number";
  }

  return null;
}
