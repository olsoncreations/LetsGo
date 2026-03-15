import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * POST /api/fraud/detect
 * Runs fraud detection checks against a specific receipt.
 * Designed to be called after receipt insertion (server-side).
 *
 * Body: { receipt_id }
 *
 * Checks:
 * 1. Duplicate receipt — same user + business, similar amount within 24h
 * 2. Velocity — user submitted >5 receipts in 24h
 * 3. Suspicious amount — receipt > 3x the business average
 */
export async function POST(req: NextRequest): Promise<Response> {
  // Require staff authentication (internal endpoint)
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: { user }, error: authErr } = await supabaseServer.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: staff } = await supabaseServer.from("staff_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!staff) return NextResponse.json({ error: "Staff access required" }, { status: 403 });

  try {
    const body = await req.json();
    const receiptId = String(body.receipt_id || "").trim();

    if (!receiptId) {
      return NextResponse.json({ error: "receipt_id is required" }, { status: 400 });
    }

    // Fetch the receipt
    const { data: receipt, error: receiptErr } = await supabaseServer
      .from("receipts")
      .select("id, user_id, business_id, receipt_total_cents, visit_date, created_at")
      .eq("id", receiptId)
      .maybeSingle();

    if (receiptErr || !receipt) {
      return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
    }

    const alerts: Array<{
      alert_type: string;
      severity: string;
      details: Record<string, unknown>;
    }> = [];

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // ========================================
    // CHECK 1: Duplicate receipt
    // Same user + business, amount within 10%, within 24 hours
    // ========================================
    const { data: recentSameBiz } = await supabaseServer
      .from("receipts")
      .select("id, receipt_total_cents, visit_date")
      .eq("user_id", receipt.user_id)
      .eq("business_id", receipt.business_id)
      .neq("id", receipt.id)
      .gte("created_at", twentyFourHoursAgo);

    if (recentSameBiz && recentSameBiz.length > 0) {
      const amountThreshold = receipt.receipt_total_cents * 0.1; // 10% tolerance
      const duplicates = recentSameBiz.filter(
        r => Math.abs(r.receipt_total_cents - receipt.receipt_total_cents) <= amountThreshold
      );

      if (duplicates.length > 0) {
        alerts.push({
          alert_type: "duplicate_receipt",
          severity: "high",
          details: {
            description: `Possible duplicate: ${duplicates.length} receipt(s) from same business with similar amount in last 24h`,
            receipt_total_cents: receipt.receipt_total_cents,
            matching_receipt_ids: duplicates.map(d => d.id),
            amount_difference_cents: duplicates.map(d => Math.abs(d.receipt_total_cents - receipt.receipt_total_cents)),
          },
        });
      }
    }

    // ========================================
    // CHECK 2: Velocity — too many receipts in 24h
    // >5 from same user across any businesses
    // ========================================
    const { count: recentCount } = await supabaseServer
      .from("receipts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", receipt.user_id)
      .gte("created_at", twentyFourHoursAgo);

    if ((recentCount || 0) > 5) {
      alerts.push({
        alert_type: "velocity",
        severity: (recentCount || 0) > 10 ? "critical" : "high",
        details: {
          description: `High submission rate: ${recentCount} receipts from this user in last 24 hours`,
          receipt_count_24h: recentCount,
          receipt_total_cents: receipt.receipt_total_cents,
        },
      });
    }

    // ========================================
    // CHECK 3: Suspicious amount
    // Receipt > 3x the average for this business
    // ========================================
    const { data: avgData } = await supabaseServer
      .from("receipts")
      .select("receipt_total_cents")
      .eq("business_id", receipt.business_id)
      .neq("id", receipt.id)
      .limit(100);

    if (avgData && avgData.length >= 5) {
      const total = avgData.reduce((sum, r) => sum + (r.receipt_total_cents || 0), 0);
      const avg = total / avgData.length;

      if (receipt.receipt_total_cents > avg * 3) {
        alerts.push({
          alert_type: "suspicious_amount",
          severity: receipt.receipt_total_cents > avg * 5 ? "critical" : "medium",
          details: {
            description: `Receipt amount ($${(receipt.receipt_total_cents / 100).toFixed(2)}) is ${(receipt.receipt_total_cents / avg).toFixed(1)}x the business average ($${(avg / 100).toFixed(2)})`,
            receipt_total_cents: receipt.receipt_total_cents,
            business_average_cents: Math.round(avg),
            multiplier: parseFloat((receipt.receipt_total_cents / avg).toFixed(1)),
          },
        });
      }
    }

    // ========================================
    // Insert any alerts found
    // ========================================
    if (alerts.length > 0) {
      const inserts = alerts.map(a => ({
        user_id: receipt.user_id,
        business_id: receipt.business_id,
        receipt_id: receipt.id,
        alert_type: a.alert_type,
        severity: a.severity,
        status: "open",
        details: a.details,
      }));

      const { error: insertErr } = await supabaseServer
        .from("fraud_alerts")
        .insert(inserts);

      if (insertErr) {
        console.error("[fraud/detect] Insert error:", insertErr);
        return NextResponse.json({ error: "Failed to create fraud alerts" }, { status: 500 });
      }
    }

    return NextResponse.json({
      ok: true,
      receipt_id: receiptId,
      alerts_created: alerts.length,
      alerts: alerts.map(a => ({ type: a.alert_type, severity: a.severity })),
    }, { status: 200 });
  } catch (err) {
    console.error("[fraud/detect] Unexpected error:", err);
    return NextResponse.json(
      { error: "Unexpected error", details: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
