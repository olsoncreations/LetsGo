import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseServer } from "@/lib/supabaseServer";
import type Stripe from "stripe";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * POST /api/webhooks/stripe
 *
 * Handles Stripe webhook events for payment confirmations and failures.
 * Verifies the webhook signature, then updates payment_attempts and invoices.
 */
export async function POST(req: Request): Promise<Response> {
  if (!webhookSecret) {
    console.error("[stripe-webhook] Missing STRIPE_WEBHOOK_SECRET");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid signature";
    console.error("[stripe-webhook] Signature verification failed:", msg);
    return NextResponse.json({ error: `Webhook signature verification failed: ${msg}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await handlePaymentSuccess(pi);
        break;
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await handlePaymentFailure(pi);
        break;
      }

      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        await handleAccountUpdated(account);
        break;
      }

      default:
        // Ignore other event types
        break;
    }
  } catch (err) {
    console.error(`[stripe-webhook] Error handling ${event.type}:`, err);
    // Return 500 so Stripe retries — handlers are idempotent so retries are safe
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handlePaymentSuccess(pi: Stripe.PaymentIntent) {
  const invoiceId = pi.metadata?.invoice_id;
  const paymentAttemptId = pi.metadata?.payment_attempt_id;

  if (!invoiceId) {
    console.warn("[stripe-webhook] payment_intent.succeeded missing invoice_id metadata:", pi.id);
    return;
  }

  // Update payment attempt
  if (paymentAttemptId) {
    await supabaseServer
      .from("payment_attempts")
      .update({
        status: "succeeded",
        processor_response: {
          transaction_id: pi.id,
          processor: "stripe",
          amount_received: pi.amount_received,
          payment_method: pi.payment_method,
        },
        completed_at: new Date().toISOString(),
      })
      .eq("id", paymentAttemptId);
  }

  // Mark invoice as paid (idempotent — won't hurt if already paid from sync response)
  await supabaseServer
    .from("invoices")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      paid_via: "stripe",
    })
    .eq("id", invoiceId)
    .in("status", ["pending", "sent"]); // Only update if not already paid
}

async function handlePaymentFailure(pi: Stripe.PaymentIntent) {
  const invoiceId = pi.metadata?.invoice_id;
  const paymentAttemptId = pi.metadata?.payment_attempt_id;

  if (!invoiceId) {
    console.warn("[stripe-webhook] payment_intent.payment_failed missing invoice_id metadata:", pi.id);
    return;
  }

  const lastError = pi.last_payment_error;
  const errorMsg = lastError?.message || "Payment failed";

  // Update payment attempt
  if (paymentAttemptId) {
    await supabaseServer
      .from("payment_attempts")
      .update({
        status: "failed",
        processor_response: {
          transaction_id: pi.id,
          processor: "stripe",
          error_code: lastError?.code,
          decline_code: lastError?.decline_code,
        },
        error_message: errorMsg,
        completed_at: new Date().toISOString(),
      })
      .eq("id", paymentAttemptId);
  }

  // Mark invoice as overdue if it was pending/sent
  await supabaseServer
    .from("invoices")
    .update({ status: "overdue" })
    .eq("id", invoiceId)
    .in("status", ["pending", "sent"]);
}

/**
 * Handle Stripe Connect account updates.
 * When a user completes Express onboarding, update their profile.
 */
async function handleAccountUpdated(account: Stripe.Account) {
  const userId = account.metadata?.user_id;
  if (!userId) return;

  if (account.payouts_enabled) {
    await supabaseServer
      .from("profiles")
      .update({ stripe_connect_onboarding_complete: true })
      .eq("id", userId)
      .eq("stripe_connect_account_id", account.id);
  }
}
