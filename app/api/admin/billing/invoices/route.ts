import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * PATCH /api/admin/billing/invoices
 *
 * Update invoice status: mark_paid, mark_sent, void
 * Body: { invoiceId: string, action: "mark_paid" | "mark_sent" | "void", reason?: string }
 */
export async function PATCH(req: NextRequest): Promise<Response> {
  // Require staff authentication
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: { user }, error: authErr } = await supabaseServer.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: staff } = await supabaseServer.from("staff_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!staff) return NextResponse.json({ error: "Staff access required" }, { status: 403 });

  try {
    const body = await req.json();
    const { invoiceId, action, reason } = body as {
      invoiceId: string;
      action: string;
      reason?: string;
    };

    if (!invoiceId || !action) {
      return NextResponse.json({ error: "invoiceId and action required" }, { status: 400 });
    }

    const validActions = ["mark_paid", "mark_sent", "void"];
    if (!validActions.includes(action)) {
      return NextResponse.json({
        error: `Invalid action. Must be one of: ${validActions.join(", ")}`,
      }, { status: 400 });
    }

    // Fetch current invoice to validate state transition
    const { data: invoice, error: fetchErr } = await supabaseServer
      .from("invoices")
      .select("id, status")
      .eq("id", invoiceId)
      .maybeSingle();

    if (fetchErr || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // State transition validation
    if (action === "mark_paid" && invoice.status === "void") {
      return NextResponse.json({ error: "Cannot mark a voided invoice as paid" }, { status: 400 });
    }
    if (action === "void" && invoice.status === "paid") {
      return NextResponse.json({ error: "Cannot void an already-paid invoice" }, { status: 400 });
    }

    // Build update payload
    let updatePayload: Record<string, unknown> = {};

    switch (action) {
      case "mark_paid":
        updatePayload = {
          status: "paid",
          paid_at: new Date().toISOString(),
          paid_via: "manual",
        };
        break;
      case "mark_sent":
        updatePayload = {
          status: "sent",
          sent_at: new Date().toISOString(),
        };
        break;
      case "void":
        updatePayload = {
          status: "void",
          voided_at: new Date().toISOString(),
          voided_reason: reason || null,
        };
        break;
    }

    const { data: updated, error: updateErr } = await supabaseServer
      .from("invoices")
      .update(updatePayload)
      .eq("id", invoiceId)
      .select("id, status, paid_at, paid_via, sent_at, voided_at")
      .maybeSingle();

    if (updateErr) {
      console.error("[billing-invoices] PATCH error:", updateErr);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, invoice: updated });
  } catch (err) {
    console.error("[billing-invoices] Unexpected error:", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
