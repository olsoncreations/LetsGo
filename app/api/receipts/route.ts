// app/api/receipts/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  dollarsToCents,
  evaluateFromDbTiers,
  type DbTierRow,
} from "@/lib/payoutEngine";
import { supabase } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { businessId, total, createdAt } = body;

    if (!businessId || !total || !createdAt) {
      return NextResponse.json(
        { error: "businessId, total, and createdAt are required" },
        { status: 400 }
      );
    }

    // TODO: replace with real auth later
    const userId = "demo-user-123";

    // Convert dollars → cents & slice a YYYY-MM-DD visit date
    const receiptTotalCents = dollarsToCents(total);
    const visitDate = createdAt.slice(0, 10);

    // 1) Load payout tiers for this business
    const { data: tiers, error: tiersError } = await supabase
      .from<DbTierRow>("business_payout_tiers")
      .select("tier_index, min_visits, max_visits, percent_bps, label")
      .eq("business_id", businessId)
      .order("tier_index", { ascending: true });

    if (tiersError) {
      console.error("Error loading tiers:", tiersError);
      return NextResponse.json(
        { error: "Failed to load payout tiers", details: tiersError.message },
        { status: 500 }
      );
    }

    // 2) Count visits this calendar year for this user+business
    const dateObj = new Date(visitDate);
    const yearStart = new Date(dateObj.getFullYear(), 0, 1); // Jan 1 same year
    const isoYearStart = yearStart.toISOString().slice(0, 10);

    const { data: priorReceipts, error: countError } = await supabase
      .from("receipts")
      .select("id")
      .eq("business_id", businessId)
      .eq("user_id", userId)
      .gte("visit_date", isoYearStart);

    if (countError) {
      console.error("Error counting receipts:", countError);
      return NextResponse.json(
        { error: "Failed to count receipts", details: countError.message },
        { status: 500 }
      );
    }

    const visitCountThisWindow = (priorReceipts?.length ?? 0) + 1;

    // 3) Run through payout engine
    const engineResult = evaluateFromDbTiers({
      tiers: tiers ?? [],
      receiptTotalCents,
      visitCountThisWindow,
    });

    const payoutCents = engineResult.payoutCents;
    const tier = engineResult.tier;

    // 4) Save to receipts table
    const { data: inserted, error: insertError } = await supabase
      .from("receipts")
      .insert({
        business_id: businessId,
        user_id: userId,
        receipt_total_cents: receiptTotalCents,
        visit_date: visitDate,
        photo_url: null,
        status: "Pending",
        payout_cents: payoutCents,
        payout_tier_index: tier?.tier_index ?? null,
        payout_percent_bps: tier?.percent_bps ?? null,
        payout_tier_label: tier?.label ?? null,
      })
      .select("*")
      .single();

    if (insertError) {
      console.error("Supabase insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to save receipt", details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        dbRow: inserted,
        engineResult,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Unexpected /api/receipts error:", err);
    return NextResponse.json(
      {
        error: "Unexpected server error",
        details: err?.message ?? String(err),
      },
      { status: 500 }
    );
  }
}