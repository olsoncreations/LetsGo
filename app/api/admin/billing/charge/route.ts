import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * POST /api/admin/billing/charge
 *
 * Attempt to charge one or more invoices.
 * Body: { invoiceIds: string[] } OR { chargeAll: true }
 *
 * Currently uses a STUB processor. When Stripe is integrated,
 * replace the stub block with real Stripe charge calls.
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

    let charged = 0;
    let failed = 0;
    const results: { invoiceId: string; businessName: string; amountCents: number; status: string; error?: string }[] = [];

    for (const inv of invoicesToCharge) {
      const invoiceId = inv.id as string;
      const businessId = inv.business_id as string;
      const amountCents = inv.total_cents as number;
      const paymentMethod = (inv.payment_method as string) || "bank";
      const businessName = (inv.business_name as string) || "Unknown";

      // Create payment attempt record
      const { data: attempt, error: attemptErr } = await supabaseServer
        .from("payment_attempts")
        .insert({
          invoice_id: invoiceId,
          business_id: businessId,
          amount_cents: amountCents,
          payment_method: paymentMethod,
          processor: "stub",
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

      // ─────────────────────────────────────────────────
      // STUB: Replace this block with Stripe when ready
      // ─────────────────────────────────────────────────
      // Example Stripe integration:
      //
      // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
      // try {
      //   const paymentIntent = await stripe.paymentIntents.create({
      //     amount: amountCents,
      //     currency: 'usd',
      //     customer: businessStripeCustomerId,
      //     payment_method: businessStripePaymentMethodId,
      //     off_session: true,
      //     confirm: true,
      //     description: `LetsGo Invoice - ${businessName}`,
      //     metadata: { invoice_id: invoiceId, business_id: businessId },
      //   });
      //   chargeResult = { success: true, transactionId: paymentIntent.id };
      // } catch (stripeErr) {
      //   chargeResult = { success: false, error: stripeErr.message };
      // }
      //
      const chargeResult = {
        success: true,
        transactionId: `stub_${Date.now()}_${invoiceId.slice(0, 8)}`,
      };
      // ─────────────────────────────────────────────────

      if (chargeResult.success) {
        // Update payment attempt as succeeded
        await supabaseServer
          .from("payment_attempts")
          .update({
            status: "succeeded",
            processor_response: { transaction_id: chargeResult.transactionId, processor: "stub" },
            completed_at: new Date().toISOString(),
          })
          .eq("id", attempt.id);

        // Mark invoice as paid
        await supabaseServer
          .from("invoices")
          .update({
            status: "paid",
            paid_at: new Date().toISOString(),
            paid_via: "auto_charge",
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
            error_message: "Charge failed (stub)",
            completed_at: new Date().toISOString(),
          })
          .eq("id", attempt.id);

        failed++;
        results.push({ invoiceId, businessName, amountCents, status: "failed", error: "Charge failed" });
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
