import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * POST /api/stripe/business-payment-info
 *
 * Fetches payment method details from Stripe and updates the business record
 * with bank/card display info. Admin-only (staff_users check).
 *
 * Body: { businessId: string, paymentMethodId: string }
 */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { data: { user }, error: authErr } = await supabaseServer.auth.getUser(token);
    if (authErr || !user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Staff-only
    const { data: staff } = await supabaseServer
      .from("staff_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!staff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { businessId, paymentMethodId } = body as { businessId?: string; paymentMethodId?: string };

    if (!businessId || !paymentMethodId) {
      return NextResponse.json({ error: "businessId and paymentMethodId are required" }, { status: 400 });
    }

    // Retrieve payment method from Stripe
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId);

    const updates: Record<string, string | null> = {};

    if (pm.type === "us_bank_account" && pm.us_bank_account) {
      updates.bank_name = pm.us_bank_account.bank_name ?? null;
      updates.account_type = pm.us_bank_account.account_type ?? null;
      updates.account_last4 = pm.us_bank_account.last4 ?? null;
      updates.routing_last4 = pm.us_bank_account.routing_number
        ? pm.us_bank_account.routing_number.slice(-4)
        : null;
    } else if (pm.type === "card" && pm.card) {
      updates.card_brand = pm.card.brand ?? null;
      updates.card_last4 = pm.card.last4 ?? null;
    }

    if (Object.keys(updates).length > 0) {
      const { error: updateErr } = await supabaseServer
        .from("business")
        .update(updates)
        .eq("id", businessId);

      if (updateErr) {
        return NextResponse.json({ error: "Failed to update business: " + updateErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, type: pm.type, updates });
  } catch (err) {
    console.error("Stripe business payment info error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
