import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { sendPayout } from "@/lib/paymentIntegration";
import { notify } from "@/lib/notify";
import { NOTIFICATION_TYPES } from "@/lib/notificationTypes";

/**
 * POST /api/admin/payouts/send
 *
 * Admin triggers payout for a user cashout.
 * Routes to Venmo (PayPal Payouts API) or Bank (Stripe Connect Transfer).
 * The payout must already be in "processing" status (admin approved it first).
 *
 * Body: { payoutId: string }
 */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    // Auth: require staff
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const { data: { user }, error: authErr } = await supabaseServer.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const { data: staff } = await supabaseServer
      .from("staff_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!staff) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

    const body = await req.json();
    const { payoutId } = body as { payoutId?: string };
    if (!payoutId) return NextResponse.json({ error: "payoutId is required" }, { status: 400 });

    // Fetch the payout record (including fee fields)
    const { data: payout, error: payoutErr } = await supabaseServer
      .from("user_payouts")
      .select("id, user_id, amount_cents, fee_cents, net_amount_cents, method, account, status, stripe_transfer_id")
      .eq("id", payoutId)
      .maybeSingle();

    if (payoutErr || !payout) {
      return NextResponse.json({ error: "Payout not found" }, { status: 404 });
    }

    if (payout.status !== "processing") {
      return NextResponse.json(
        { error: `Payout must be in "processing" status to send. Current: "${payout.status}"` },
        { status: 400 }
      );
    }

    // Fetch user profile for name/email and Stripe Connect ID
    const { data: profile } = await supabaseServer
      .from("profiles")
      .select("full_name, first_name, last_name, stripe_connect_account_id")
      .eq("id", payout.user_id)
      .maybeSingle();

    const { data: authUser } = await supabaseServer.auth.admin.getUserById(payout.user_id);
    const recipientName = profile?.full_name
      || [profile?.first_name, profile?.last_name].filter(Boolean).join(" ")
      || "LetsGo User";
    const recipientEmail = authUser?.user?.email || null;

    // Compute net amount (for older records that may not have it)
    const feeCents = (payout.fee_cents as number) || 0;
    const netAmountCents = (payout.net_amount_cents as number) || (payout.amount_cents - feeCents);

    // Re-verify fee calculation matches expected values
    const expectedFee = payout.method === "venmo" ? Math.round(payout.amount_cents * 0.03) : 0;
    if (feeCents !== expectedFee) {
      console.warn("[admin/payouts/send] Fee mismatch — stored:", feeCents, "expected:", expectedFee, "for payout:", payoutId);
    }

    // Send payout via appropriate provider
    const result = await sendPayout({
      user_id: payout.user_id,
      payout_id: payout.id,
      amount_cents: payout.amount_cents,
      fee_cents: feeCents,
      net_amount_cents: netAmountCents,
      payment_method: payout.method,
      payment_details: payout.method === "venmo" ? payout.account : null,
      stripe_connect_account_id: payout.method === "bank"
        ? (profile?.stripe_connect_account_id as string | null)
        : null,
      recipient_name: recipientName,
      recipient_email: recipientEmail,
      memo: `LetsGo cashout #${payout.id.slice(0, 8)}`,
    });

    if (result.success) {
      // Mark payout as completed
      const updateData: Record<string, unknown> = {
        status: "completed",
        processed_at: new Date().toISOString(),
        processed_by: user.id,
        notes: `Sent via ${result.provider}. Transaction: ${result.transaction_id || "N/A"}`,
      };

      if (payout.method === "bank" && result.transaction_id) {
        updateData.stripe_transfer_id = result.transaction_id;
      }

      const { error: statusErr } = await supabaseServer
        .from("user_payouts")
        .update(updateData)
        .eq("id", payoutId);

      if (statusErr) {
        console.error("[admin/payouts/send] CRITICAL: Payout sent but status update failed:", statusErr);
      }

      // Atomic balance update: subtract from pending_payout
      const { error: balErr } = await supabaseServer.rpc("complete_payout_balance", {
        p_user_id: payout.user_id,
        p_amount_cents: payout.amount_cents,
      });

      if (balErr) {
        console.error("[admin/payouts/send] CRITICAL: Payout sent but pending_payout update failed:", balErr);
      }

      // Notify user of success
      const amountStr = `$${(payout.amount_cents / 100).toFixed(2)}`;
      const methodLabel = payout.method === "venmo" ? "Venmo" : "bank account";
      const timeNote = payout.method === "venmo"
        ? "It may take a few minutes to arrive."
        : "It will arrive in 2-3 business days.";
      notify({
        userId: payout.user_id,
        type: NOTIFICATION_TYPES.PAYOUT_PROCESSED,
        title: "Cashout Sent!",
        body: `Your ${amountStr} cashout has been sent to your ${methodLabel}. ${timeNote}`,
        metadata: {
          payoutId: payout.id,
          amountCents: payout.amount_cents,
          method: payout.method,
          transactionId: result.transaction_id,
          href: "/profile",
        },
      });

      // Audit log
      await supabaseServer.from("audit_logs").insert({
        action: "payout_sent",
        entity_type: "user_payout",
        entity_id: payoutId,
        performed_by: user.id,
        details: {
          amount_cents: payout.amount_cents,
          fee_cents: feeCents,
          net_amount_cents: netAmountCents,
          method: payout.method,
          provider: result.provider,
          transaction_id: result.transaction_id,
          recipient: payout.account,
        },
      });

      return NextResponse.json({
        ok: true,
        transaction_id: result.transaction_id,
        provider: result.provider,
      });
    } else {
      // Payment failed — mark as failed
      await supabaseServer
        .from("user_payouts")
        .update({
          status: "failed",
          deny_reason: result.error || "Payment provider error",
          processed_at: new Date().toISOString(),
          processed_by: user.id,
        })
        .eq("id", payoutId);

      // Atomic balance refund: restore available_balance from pending_payout
      const { error: refundErr } = await supabaseServer.rpc("refund_failed_payout", {
        p_user_id: payout.user_id,
        p_amount_cents: payout.amount_cents,
      });

      if (refundErr) {
        console.error("[admin/payouts/send] CRITICAL: Payout failed but refund failed:", refundErr);
      }

      // Notify user that their cashout failed with explanation
      const amountStr = `$${(payout.amount_cents / 100).toFixed(2)}`;
      const methodLabel = payout.method === "venmo" ? "Venmo" : "bank account";
      const reason = result.error || "Payment provider error";

      // Build a user-friendly explanation
      let userExplanation: string;
      if (reason.includes("Receiver is invalid") || reason.includes("does not match")) {
        userExplanation = `Your ${amountStr} cashout to ${methodLabel} could not be completed because the account information couldn't be verified. Please update your ${methodLabel} details in Settings and try again.`;
      } else if (reason.includes("Insufficient funds") || reason.includes("nsufficient")) {
        userExplanation = `Your ${amountStr} cashout to ${methodLabel} is temporarily delayed. Our team has been notified and will process it shortly.`;
      } else if (reason.includes("account") && reason.includes("connect")) {
        userExplanation = `Your ${amountStr} cashout to ${methodLabel} could not be completed. Please reconnect your bank account in Settings and try again.`;
      } else {
        userExplanation = `Your ${amountStr} cashout to ${methodLabel} could not be completed. Your balance has been restored. Please try again or contact support if this continues.`;
      }

      notify({
        userId: payout.user_id,
        type: NOTIFICATION_TYPES.PAYOUT_PROCESSED,
        title: "Cashout Could Not Be Completed",
        body: userExplanation,
        metadata: {
          payoutId: payout.id,
          amountCents: payout.amount_cents,
          method: payout.method,
          failed: true,
          href: "/profile",
        },
      });

      // Audit log
      await supabaseServer.from("audit_logs").insert({
        action: "payout_failed",
        entity_type: "user_payout",
        entity_id: payoutId,
        performed_by: user.id,
        details: {
          amount_cents: payout.amount_cents,
          method: payout.method,
          error: result.error,
        },
      });

      return NextResponse.json(
        { error: result.error || "Payment failed", provider: result.provider },
        { status: 502 }
      );
    }
  } catch (err) {
    console.error("[admin/payouts/send] Error:", err);
    const message = err instanceof Error ? err.message : "Failed to send payout";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
