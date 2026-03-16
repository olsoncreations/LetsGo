import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * GET /api/admin/billing/balances
 *
 * Returns per-business balance summary:
 *  - total billed (sum of invoice total_cents)
 *  - amount paid (sum of paid invoices)
 *  - pending adjustments (credits/charges not yet on an invoice)
 *  - remaining balance (billed - paid + pending adjustments)
 *  - itemized invoices per business (for expandable view)
 */
export async function GET(req: NextRequest): Promise<Response> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: { user }, error: authErr } = await supabaseServer.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: staff } = await supabaseServer.from("staff_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!staff) return NextResponse.json({ error: "Staff access required" }, { status: 403 });

  try {
    // Optional month filter: ?month=2026-03 (YYYY-MM format)
    const monthParam = req.nextUrl.searchParams.get("month"); // "2026-03" or "all"

    // 1. Fetch non-voided invoices (optionally filtered by month)
    let invoiceQuery = supabaseServer
      .from("invoices")
      .select("id, business_id, billing_period, period_start, period_end, total_cents, subtotal_cents, cc_fee_cents, status, paid_at, paid_via, due_date, invoice_date, business_name, business_email, payment_method, is_premium")
      .neq("status", "void")
      .order("period_start", { ascending: false });

    if (monthParam && monthParam !== "all") {
      // Filter invoices whose period_start falls within the given month
      const [y, m] = monthParam.split("-").map(Number);
      const monthStart = `${y}-${String(m).padStart(2, "0")}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const monthEnd = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      invoiceQuery = invoiceQuery.gte("period_start", monthStart).lte("period_start", monthEnd);
    }

    const { data: invoices, error: invErr } = await invoiceQuery;

    if (invErr) throw invErr;

    // 2. Fetch line items for all invoices
    const invoiceIds = (invoices || []).map((i: Record<string, unknown>) => String(i.id));
    let lineItemsByInvoice: Record<string, { line_type: string; description: string | null; amount_cents: number; quantity: number | null }[]> = {};

    if (invoiceIds.length > 0) {
      // Batch in groups of 50 to avoid URL length limits
      for (let i = 0; i < invoiceIds.length; i += 50) {
        const batch = invoiceIds.slice(i, i + 50);
        const { data: lines } = await supabaseServer
          .from("invoice_line_items")
          .select("invoice_id, line_type, description, amount_cents, quantity")
          .in("invoice_id", batch);

        for (const line of lines || []) {
          const iid = String(line.invoice_id);
          if (!lineItemsByInvoice[iid]) lineItemsByInvoice[iid] = [];
          lineItemsByInvoice[iid].push({
            line_type: line.line_type,
            description: line.description,
            amount_cents: line.amount_cents,
            quantity: line.quantity,
          });
        }
      }
    }

    // 3. Fetch pending billing adjustments
    const { data: pendingAdj } = await supabaseServer
      .from("billing_adjustments")
      .select("id, business_id, amount_cents, type, description, created_at")
      .eq("status", "pending");

    // Group pending adjustments by business
    const adjByBusiness: Record<string, { id: string; amount_cents: number; type: string; description: string; created_at: string }[]> = {};
    for (const adj of pendingAdj || []) {
      const bid = String(adj.business_id);
      if (!adjByBusiness[bid]) adjByBusiness[bid] = [];
      adjByBusiness[bid].push(adj);
    }

    // 4. Build per-business balances
    const businessMap: Record<string, {
      businessId: string;
      businessName: string;
      businessEmail: string;
      paymentMethod: string;
      isPremium: boolean;
      totalBilledCents: number;
      totalPaidCents: number;
      pendingAdjCents: number;
      remainingCents: number;
      invoices: {
        id: string;
        billingPeriod: string;
        totalCents: number;
        status: string;
        paidAt: string | null;
        paidVia: string | null;
        dueDate: string;
        invoiceDate: string;
        lineItems: { line_type: string; description: string | null; amount_cents: number; quantity: number | null }[];
      }[];
      pendingAdjustments: { id: string; amount_cents: number; type: string; description: string; created_at: string }[];
    }> = {};

    for (const inv of invoices || []) {
      const bid = String(inv.business_id);
      if (!businessMap[bid]) {
        businessMap[bid] = {
          businessId: bid,
          businessName: String(inv.business_name || "Unknown"),
          businessEmail: String(inv.business_email || ""),
          paymentMethod: String(inv.payment_method || ""),
          isPremium: Boolean(inv.is_premium),
          totalBilledCents: 0,
          totalPaidCents: 0,
          pendingAdjCents: 0,
          remainingCents: 0,
          invoices: [],
          pendingAdjustments: [],
        };
      }

      const totalCents = Number(inv.total_cents || 0);
      const status = String(inv.status || "pending");

      businessMap[bid].totalBilledCents += totalCents;
      if (status === "paid") {
        businessMap[bid].totalPaidCents += totalCents;
      }

      businessMap[bid].invoices.push({
        id: String(inv.id),
        billingPeriod: String(inv.billing_period || ""),
        totalCents,
        status,
        paidAt: inv.paid_at ? String(inv.paid_at) : null,
        paidVia: inv.paid_via ? String(inv.paid_via) : null,
        dueDate: String(inv.due_date || ""),
        invoiceDate: String(inv.invoice_date || ""),
        lineItems: lineItemsByInvoice[String(inv.id)] || [],
      });
    }

    // Add pending adjustments to each business
    for (const [bid, adjs] of Object.entries(adjByBusiness)) {
      if (!businessMap[bid]) {
        // Business has adjustments but no invoices yet — need business name
        const { data: biz } = await supabaseServer
          .from("business")
          .select("id, business_name")
          .eq("id", bid)
          .maybeSingle();

        businessMap[bid] = {
          businessId: bid,
          businessName: biz?.business_name || "Unknown",
          businessEmail: "",
          paymentMethod: "",
          isPremium: false,
          totalBilledCents: 0,
          totalPaidCents: 0,
          pendingAdjCents: 0,
          remainingCents: 0,
          invoices: [],
          pendingAdjustments: [],
        };
      }

      businessMap[bid].pendingAdjustments = adjs;
      businessMap[bid].pendingAdjCents = adjs.reduce((s, a) => s + a.amount_cents, 0);
    }

    // Calculate remaining balance for each business
    for (const biz of Object.values(businessMap)) {
      // remaining = billed - paid + adjustments (credits are negative, charges are positive)
      biz.remainingCents = biz.totalBilledCents - biz.totalPaidCents + biz.pendingAdjCents;
    }

    // Sort by remaining balance descending (most owed first)
    const balances = Object.values(businessMap).sort((a, b) => b.remainingCents - a.remainingCents);

    // Platform totals
    const totals = {
      totalBilledCents: balances.reduce((s, b) => s + b.totalBilledCents, 0),
      totalPaidCents: balances.reduce((s, b) => s + b.totalPaidCents, 0),
      totalPendingAdjCents: balances.reduce((s, b) => s + b.pendingAdjCents, 0),
      totalRemainingCents: balances.reduce((s, b) => s + b.remainingCents, 0),
      businessCount: balances.length,
      paidInFullCount: balances.filter(b => b.remainingCents <= 0).length,
      outstandingCount: balances.filter(b => b.remainingCents > 0).length,
    };

    // Available months (from all invoices, for the month picker)
    const { data: allPeriods } = await supabaseServer
      .from("invoices")
      .select("period_start, billing_period")
      .neq("status", "void")
      .order("period_start", { ascending: false });

    const monthOptions: { value: string; label: string }[] = [];
    const seen = new Set<string>();
    for (const p of allPeriods || []) {
      const ps = String(p.period_start || "");
      const key = ps.slice(0, 7); // "2026-03"
      if (key && !seen.has(key)) {
        seen.add(key);
        monthOptions.push({ value: key, label: String(p.billing_period || key) });
      }
    }

    return NextResponse.json({ balances, totals, monthOptions });
  } catch (err) {
    console.error("[admin-billing-balances] error:", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
