import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { stripe } from "@/lib/stripe";

/**
 * POST /api/admin/billing/charge
 *
 * Attempt to charge one or more invoices via Stripe.
 * Body: { invoiceIds: string[] } OR { chargeAll: true }
 *
 * Looks up each business's stripe_customer_id and stripe_payment_method_id,
 * then creates an off-session PaymentIntent to charge them.
 */
export async function POST(req: NextRequest): Promise<Response> {
  // Require staff authentication
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: { user }, error: authErr } = await supabaseServer.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: staff } = await supabaseServer.from("staff_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!staff) return NextResponse.json({ error: "Staff access required" }, { status: 403 });

  try {
    const body = await req.json();
    const { invoiceIds, chargeAll } = body as {
      invoiceIds?: string[];
      chargeAll?: boolean;
    };

    // Determine which invoices to charge
    let invoicesToCharge: Record<string, unknown>[] = [];

    if (chargeAll) {
      const { data, error } = await supabaseServer
        .from("invoices")
        .select("id, business_id, total_cents, payment_method, business_name")
        .in("status", ["pending", "sent"]);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      invoicesToCharge = data ?? [];
    } else if (invoiceIds && Array.isArray(invoiceIds) && invoiceIds.length > 0) {
      const { data, error } = await supabaseServer
        .from("invoices")
        .select("id, business_id, total_cents, payment_method, business_name, status")
        .in("id", invoiceIds);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      // Only charge invoices that are pending or sent
      invoicesToCharge = (data ?? []).filter(
        (inv: Record<string, unknown>) => inv.status === "pending" || inv.status === "sent"
      );
    } else {
      return NextResponse.json({ error: "invoiceIds array or chargeAll required" }, { status: 400 });
    }

    if (invoicesToCharge.length === 0) {
      return NextResponse.json({ ok: true, charged: 0, failed: 0, results: [], message: "No chargeable invoices found" });
    }

    // Pre-fetch Stripe IDs for all businesses in this batch
    const businessIds = [...new Set(invoicesToCharge.map((inv) => inv.business_id as string))];
    const { data: businesses } = await supabaseServer
      .from("business")
      .select("id, stripe_customer_id, stripe_payment_method_id")
      .in("id", businessIds);

    const bizMap = new Map<string, { stripe_customer_id: string | null; stripe_payment_method_id: string | null }>();
    for (const b of businesses ?? []) {
      bizMap.set(b.id, { stripe_customer_id: b.stripe_customer_id, stripe_payment_method_id: b.stripe_payment_method_id });
    }

    let charged = 0;
    let failed = 0;
    const results: { invoiceId: string; businessName: string; amountCents: number; status: string; error?: string }[] = [];

    for (const inv of invoicesToCharge) {
      const invoiceId = inv.id as string;
      const businessId = inv.business_id as string;
      const amountCents = inv.total_cents as number;
      const paymentMethod = (inv.payment_method as string) || "card";
      const businessName = (inv.business_name as string) || "Unknown";

      // Validate amount before charging
      if (!amountCents || amountCents < 50) {
        failed++;
        results.push({
          invoiceId,
          businessName,
          amountCents,
          status: "failed",
          error: amountCents <= 0 ? "Invoice amount must be positive" : "Invoice amount must be at least $0.50",
        });
        continue;
      }

      // Look up Stripe IDs for this business
      const bizStripe = bizMap.get(businessId);
      if (!bizStripe?.stripe_customer_id || !bizStripe?.stripe_payment_method_id) {
        failed++;
        results.push({
          invoiceId,
          businessName,
          amountCents,
          status: "failed",
          error: "Business has no Stripe payment method on file. Please update their payment info.",
        });
        continue;
      }

      // Create payment attempt record
      const { data: attempt, error: attemptErr } = await supabaseServer
        .from("payment_attempts")
        .insert({
          invoice_id: invoiceId,
          business_id: businessId,
          amount_cents: amountCents,
          payment_method: paymentMethod,
          processor: "stripe",
          status: "pending",
        })
        .select("id")
        .single();

      if (attemptErr) {
        console.error("[billing-charge] payment_attempts insert error:", attemptErr);
        failed++;
        results.push({ invoiceId, businessName, amountCents, status: "failed", error: attemptErr.message });
        continue;
      }

      // Charge via Stripe
      let chargeResult: { success: boolean; transactionId?: string; error?: string };

      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amountCents,
          currency: "usd",
          customer: bizStripe.stripe_customer_id,
          payment_method: bizStripe.stripe_payment_method_id,
          off_session: true,
          confirm: true,
          description: `LetsGo Invoice - ${businessName}`,
          metadata: {
            invoice_id: invoiceId,
            business_id: businessId,
            payment_attempt_id: attempt.id,
          },
        });

        if (paymentIntent.status === "succeeded") {
          chargeResult = { success: true, transactionId: paymentIntent.id };
        } else {
          // Payment requires additional action or is processing
          chargeResult = {
            success: false,
            transactionId: paymentIntent.id,
            error: `Payment status: ${paymentIntent.status}. May require customer action.`,
          };
        }
      } catch (stripeErr: unknown) {
        const errMsg = stripeErr instanceof Error ? stripeErr.message : "Stripe charge failed";
        chargeResult = { success: false, error: errMsg };
      }

      if (chargeResult.success) {
        // Update payment attempt as succeeded
        await supabaseServer
          .from("payment_attempts")
          .update({
            status: "succeeded",
            processor_response: {
              transaction_id: chargeResult.transactionId,
              processor: "stripe",
            },
            completed_at: new Date().toISOString(),
          })
          .eq("id", attempt.id);

        // Mark invoice as paid
        await supabaseServer
          .from("invoices")
          .update({
            status: "paid",
            paid_at: new Date().toISOString(),
            paid_via: "stripe",
          })
          .eq("id", invoiceId);

        charged++;
        results.push({ invoiceId, businessName, amountCents, status: "succeeded" });
      } else {
        // Update payment attempt as failed
        await supabaseServer
          .from("payment_attempts")
          .update({
            status: "failed",
            processor_response: chargeResult.transactionId
              ? { transaction_id: chargeResult.transactionId, processor: "stripe" }
              : { processor: "stripe" },
            error_message: chargeResult.error || "Charge failed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", attempt.id);

        failed++;
        results.push({ invoiceId, businessName, amountCents, status: "failed", error: chargeResult.error });
      }
    }

    return NextResponse.json({ ok: true, charged, failed, results });
  } catch (err) {
    console.error("[billing-charge] Unexpected error:", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
