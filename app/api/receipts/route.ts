import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer as supabase } from "@/lib/supabaseServer";
import { notify } from "@/lib/notify";
import { NOTIFICATION_TYPES } from "@/lib/notificationTypes";
import { getAnniversaryWindowStart } from "@/lib/anniversaryWindow";

type TierRow = {
  tier_index: number;
  min_visits: number;
  max_visits: number | null;
  percent_bps: number; // basis points (e.g. 250 = 2.5%)
  label: string | null;
};

// Receipt amount ceiling: $10,000 (1,000,000 cents)
const MAX_RECEIPT_CENTS = 1_000_000;

// Max receipt submissions per user per hour
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
// Max age for visit dates (90 days)
const MAX_VISIT_AGE_DAYS = 90;
// Duplicate detection window (21 days / 3 weeks)
const DUPLICATE_WINDOW_DAYS = 21;

function pickTier(tiers: TierRow[], visitCount: number): TierRow | null {
  // pick the highest tier that matches the visitCount
  let current: TierRow | null = null;

  for (const tier of tiers) {
    const min = tier.min_visits;
    const max = tier.max_visits ?? Infinity;
    if (visitCount >= min && visitCount <= max) {
      if (!current || tier.tier_index > current.tier_index) current = tier;
    }
  }

  // if nothing matched, default to the lowest tier (if exists)
  if (!current && tiers.length > 0) current = tiers[0];
  return current;
}

// getAnniversaryWindowStart imported from @/lib/anniversaryWindow

/**
 * Runs fraud detection checks inline after receipt insertion.
 * Creates fraud_alerts rows for any issues detected.
 */
async function runFraudChecks(receiptId: string, userId: string, businessId: string, receiptTotalCents: number): Promise<void> {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const alerts: Array<{
      alert_type: string;
      severity: string;
      details: Record<string, unknown>;
    }> = [];

    // CHECK 1: Duplicate receipt — same user + business, amount within 10%, within 3 weeks
    const threeWeeksAgo = new Date(Date.now() - DUPLICATE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentSameBiz } = await supabase
      .from("receipts")
      .select("id, receipt_total_cents")
      .eq("user_id", userId)
      .eq("business_id", businessId)
      .neq("id", receiptId)
      .gte("created_at", threeWeeksAgo);

    if (recentSameBiz && recentSameBiz.length > 0) {
      const amountThreshold = receiptTotalCents * 0.1;
      const duplicates = recentSameBiz.filter(
        r => Math.abs(r.receipt_total_cents - receiptTotalCents) <= amountThreshold
      );
      if (duplicates.length > 0) {
        alerts.push({
          alert_type: "duplicate_receipt",
          severity: "high",
          details: {
            description: `Possible duplicate: ${duplicates.length} receipt(s) from same business with similar amount in last 3 weeks`,
            receipt_total_cents: receiptTotalCents,
            matching_receipt_ids: duplicates.map(d => d.id),
          },
        });
      }
    }

    // CHECK 2: Velocity — too many receipts in 24h
    const { count: recentCount } = await supabase
      .from("receipts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", twentyFourHoursAgo);

    if ((recentCount || 0) > 5) {
      alerts.push({
        alert_type: "velocity",
        severity: (recentCount || 0) > 10 ? "critical" : "high",
        details: {
          description: `High submission rate: ${recentCount} receipts from this user in last 24 hours`,
          receipt_count_24h: recentCount,
        },
      });
    }

    // CHECK 3: Suspicious amount — receipt > 3x the average for this business
    const { data: avgData } = await supabase
      .from("receipts")
      .select("receipt_total_cents")
      .eq("business_id", businessId)
      .neq("id", receiptId)
      .limit(100);

    if (avgData && avgData.length >= 5) {
      const total = avgData.reduce((sum, r) => sum + (r.receipt_total_cents || 0), 0);
      const avg = total / avgData.length;
      if (receiptTotalCents > avg * 3) {
        alerts.push({
          alert_type: "suspicious_amount",
          severity: receiptTotalCents > avg * 5 ? "critical" : "medium",
          details: {
            description: `Receipt amount ($${(receiptTotalCents / 100).toFixed(2)}) is ${(receiptTotalCents / avg).toFixed(1)}x the business average ($${(avg / 100).toFixed(2)})`,
            receipt_total_cents: receiptTotalCents,
            business_average_cents: Math.round(avg),
            multiplier: parseFloat((receiptTotalCents / avg).toFixed(1)),
          },
        });
      }
    }

    // Insert any alerts found
    if (alerts.length > 0) {
      await supabase.from("fraud_alerts").insert(
        alerts.map(a => ({
          user_id: userId,
          business_id: businessId,
          receipt_id: receiptId,
          alert_type: a.alert_type,
          severity: a.severity,
          status: "open",
          details: a.details,
        }))
      );
    }
  } catch (err) {
    // Fraud checks should never block receipt submission — log and continue
    console.error("[receipts] fraud check error (non-blocking):", err);
  }
}

/**
 * Calculates payout for a receipt and stores it.
 * - Visit count uses anniversary-based window (resets yearly from user's signup date)
 * - Progressive payout has NO per-receipt cap (business sets tier rates)
 * - LetsGo platform fee is calculated at billing time, not stored per receipt
 */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    // Authenticate the caller
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !authUser) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await req.json();

    const businessId = String(body.businessId || "");
    // Use authenticated user ID — ignore any userId from body
    const userId = authUser.id;
    const receiptTotalCents = Number(body.receiptTotalCents ?? 0);
    const visitDate = String(body.visitDate || new Date().toISOString().slice(0, 10)); // YYYY-MM-DD
    const photoUrl: string | null = body.photoUrl ? String(body.photoUrl) : null;

    if (!businessId) {
      return NextResponse.json({ error: "Missing businessId" }, { status: 400 });
    }
    if (!Number.isFinite(receiptTotalCents) || receiptTotalCents <= 0) {
      return NextResponse.json(
        { error: "receiptTotalCents must be a positive number" },
        { status: 400 }
      );
    }

    // Validate receipt amount ceiling
    if (receiptTotalCents > MAX_RECEIPT_CENTS) {
      return NextResponse.json(
        { error: `Receipt amount cannot exceed $${(MAX_RECEIPT_CENTS / 100).toLocaleString()}` },
        { status: 400 }
      );
    }

    // Validate visit date format and range
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(visitDate)) {
      return NextResponse.json({ error: "visitDate must be in YYYY-MM-DD format" }, { status: 400 });
    }
    const parsedDate = new Date(visitDate + "T00:00:00");
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: "Invalid visit date" }, { status: 400 });
    }
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    if (visitDate > todayStr) {
      return NextResponse.json({ error: "Visit date cannot be in the future" }, { status: 400 });
    }
    const maxAgeCutoff = new Date(now.getTime() - MAX_VISIT_AGE_DAYS * 24 * 60 * 60 * 1000);
    if (parsedDate < maxAgeCutoff) {
      return NextResponse.json(
        { error: `Visit date cannot be more than ${MAX_VISIT_AGE_DAYS} days ago` },
        { status: 400 }
      );
    }

    // Rate limit: max submissions per user per hour
    const oneHourAgo = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS).toISOString();
    const { count: recentSubmissions } = await supabase
      .from("receipts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", oneHourAgo);

    if ((recentSubmissions || 0) >= RATE_LIMIT_MAX) {
      return NextResponse.json(
        { error: "Too many receipt submissions. Please try again later." },
        { status: 429 }
      );
    }

    // Self-dealing prevention: block business owners/managers/staff from submitting receipts to their own business
    const { data: selfDealCheck } = await supabase
      .from("business_users")
      .select("role")
      .eq("business_id", businessId)
      .eq("user_id", userId)
      .maybeSingle();

    if (selfDealCheck) {
      return NextResponse.json(
        { error: "Business owners, managers, and staff cannot submit receipts to their own business" },
        { status: 403 }
      );
    }

    // Duplicate receipt detection — check for similar receipts within 3 weeks
    const confirmDuplicate = body.confirmDuplicate === true;
    const dupCutoff = new Date(now.getTime() - DUPLICATE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentReceipts } = await supabase
      .from("receipts")
      .select("id, receipt_total_cents, visit_date, created_at, status")
      .eq("user_id", userId)
      .eq("business_id", businessId)
      .gte("created_at", dupCutoff)
      .order("created_at", { ascending: false });

    if (recentReceipts && recentReceipts.length > 0 && !confirmDuplicate) {
      const amountThreshold = receiptTotalCents * 0.1;
      const duplicates = recentReceipts.filter(
        (r) => Math.abs(r.receipt_total_cents - receiptTotalCents) <= amountThreshold
      );
      if (duplicates.length > 0) {
        return NextResponse.json(
          {
            duplicate: true,
            message: "This looks like a receipt you already submitted. Please confirm if this is a new receipt.",
            matchingReceipts: duplicates.map((d) => ({
              id: d.id,
              amount: d.receipt_total_cents,
              date: d.visit_date,
              submittedAt: d.created_at,
              status: d.status,
            })),
          },
          { status: 409 }
        );
      }
    }

    // Track whether user confirmed a duplicate warning
    const isDuplicateConfirmed = confirmDuplicate && recentReceipts && recentReceipts.length > 0 &&
      recentReceipts.some((r) => Math.abs(r.receipt_total_cents - receiptTotalCents) <= receiptTotalCents * 0.1);

    // 1) Look up user's account creation date for anniversary window
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("created_at")
      .eq("id", userId)
      .maybeSingle();

    if (profileError || !profile?.created_at) {
      return NextResponse.json(
        { error: "Failed to look up user profile" },
        { status: profileError ? 500 : 404 }
      );
    }

    // 2) Count approved visits in the current anniversary window for this business
    let windowStart = getAnniversaryWindowStart(profile.created_at);

    // Check if user has an active tier extension for this business (or Gold for all)
    const { data: activeExtension } = await supabase
      .from("tier_extensions")
      .select("protected_tier_index, effective_until")
      .eq("user_id", userId)
      .eq("status", "active")
      .or(`business_id.eq.${businessId},business_id.is.null`)
      .gte("effective_until", todayStr)
      .order("effective_until", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeExtension) {
      // Extension active: push window back to include previous year's visits
      // This preserves the user's visit count so their tier level stays high
      const ws = new Date(windowStart);
      windowStart = new Date(ws.getFullYear() - 1, ws.getMonth(), ws.getDate())
        .toISOString().slice(0, 10);
    }

    const { count: visitCount, error: visitError } = await supabase
      .from("receipts")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("user_id", userId)
      .eq("status", "approved")
      .gte("visit_date", windowStart);

    if (visitError) {
      return NextResponse.json(
        { error: "Failed to count visits" },
        { status: 500 }
      );
    }

    const visitsThisWindow = (visitCount ?? 0) + 1; // include this new receipt

    // 3) Load payout tiers for this business
    const { data: tiersRaw, error: tiersError } = await supabase
      .from("business_payout_tiers")
      .select("tier_index, min_visits, max_visits, percent_bps, label")
      .eq("business_id", businessId)
      .order("tier_index", { ascending: true });

    if (tiersError) {
      return NextResponse.json(
        { error: "Failed to load payout tiers" },
        { status: 500 }
      );
    }

    const tiers = (tiersRaw ?? []) as TierRow[];
    const currentTier = pickTier(tiers, visitsThisWindow);

    if (!currentTier) {
      return NextResponse.json(
        { error: "No payout tiers configured for this business" },
        { status: 400 }
      );
    }

    // 4) Compute payout — NO cap on progressive payout (business sets tier rates)
    const percent = currentTier.percent_bps / 10_000;
    let payoutCents = Math.round(receiptTotalCents * percent);

    // 4.5) Apply active promotions
    const today = now.toISOString().slice(0, 10);
    const appliedPromoIds: string[] = [];

    const { data: activePromos } = await supabase
      .from("promotions")
      .select("id, promo_type, discount_type, discount_amount, applies_to, max_uses, uses_count, min_purchase_cents")
      .eq("is_active", true)
      .or(`start_date.is.null,start_date.lte.${today}`)
      .or(`end_date.is.null,end_date.gte.${today}`);

    if (activePromos && activePromos.length > 0) {
      for (const promo of activePromos) {
        // Skip if max uses reached
        if (promo.max_uses && promo.uses_count >= promo.max_uses) continue;

        // Skip if receipt below minimum purchase amount
        if (promo.min_purchase_cents && receiptTotalCents < promo.min_purchase_cents) continue;

        // Check applies_to eligibility
        if (promo.applies_to === "new_users" && visitsThisWindow > 1) continue;

        // Check applies_to: "businesses" — only receipts from targeted businesses
        if (promo.applies_to === "businesses") {
          const { count: bizTargetCount } = await supabase
            .from("promotion_target_businesses")
            .select("id", { count: "exact", head: true })
            .eq("promotion_id", promo.id)
            .eq("business_id", businessId);
          if (!bizTargetCount || bizTargetCount === 0) continue;
        }

        // Check applies_to: "specific" — only targeted users
        if (promo.applies_to === "specific") {
          const { count: userTargetCount } = await supabase
            .from("promotion_target_users")
            .select("id", { count: "exact", head: true })
            .eq("promotion_id", promo.id)
            .eq("user_id", userId);
          if (!userTargetCount || userTargetCount === 0) continue;
        }

        // Per-user redemption limit: skip if user already redeemed this promotion
        const { count: userRedemptionCount } = await supabase
          .from("promotion_redemptions")
          .select("id", { count: "exact", head: true })
          .eq("promotion_id", promo.id)
          .eq("user_id", userId);
        if ((userRedemptionCount || 0) > 0) continue;

        let bonusCents = 0;

        switch (promo.promo_type) {
          case "payout_multiplier":
            // discount_amount is the multiplier (e.g., 2 for 2x)
            bonusCents = Math.round(payoutCents * promo.discount_amount) - payoutCents;
            payoutCents = Math.round(payoutCents * promo.discount_amount);
            break;

          case "first_visit_bonus":
            // Only applies on first visit within window
            if (visitsThisWindow === 1) {
              bonusCents = Math.round(promo.discount_amount);
              payoutCents += bonusCents;
            }
            break;

          case "signup_bonus": {
            // Apply bonus on user's first-ever receipt (across all businesses)
            const { count: totalApproved } = await supabase
              .from("receipts")
              .select("id", { count: "exact", head: true })
              .eq("user_id", userId)
              .eq("status", "approved");
            // If no approved receipts exist yet, this is the user's first receipt
            if (!totalApproved || totalApproved === 0) {
              bonusCents = Math.round(promo.discount_amount);
              payoutCents += bonusCents;
            }
            break;
          }

          case "flat_bonus":
            // Add flat amount (in cents) to every receipt payout
            bonusCents = Math.round(promo.discount_amount);
            payoutCents += bonusCents;
            break;

          default:
            continue;
        }

        if (bonusCents > 0) {
          appliedPromoIds.push(promo.id);

          // Atomic increment of uses_count with guard against exceeding max_uses
          const { data: incrementOk, error: rpcErr } = await supabase.rpc("increment_promotion_uses", {
            p_promotion_id: promo.id,
          });

          if (rpcErr) {
            console.error("[receipts] increment_promotion_uses RPC error:", rpcErr.message);
            // If the RPC returns false, max_uses was already reached — skip this promo
          } else if (incrementOk === false) {
            // max_uses reached between our check and the atomic increment — undo bonus
            payoutCents -= bonusCents;
            bonusCents = 0;
            appliedPromoIds.pop();
          }
        }
      }
    }

    // 5) Insert receipt record
    const { data: inserted, error: insertError } = await supabase
      .from("receipts")
      .insert([
        {
          business_id: businessId,
          user_id: userId,
          visit_date: visitDate,
          receipt_total_cents: receiptTotalCents,
          payout_cents: payoutCents,
          payout_tier_index: currentTier.tier_index,
          status: "pending",
          ...(photoUrl ? { photo_url: photoUrl } : {}),
        },
      ])
      .select("id")
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: "Failed to save receipt" },
        { status: 500 }
      );
    }

    // 5.5) Record promotion redemptions
    if (appliedPromoIds.length > 0 && inserted?.id) {
      const redemptions = appliedPromoIds.map(promoId => ({
        promotion_id: promoId,
        user_id: userId,
        business_id: businessId,
        discount_applied_cents: payoutCents - Math.round(receiptTotalCents * percent),
      }));

      await supabase.from("promotion_redemptions").insert(redemptions);
    }

    // 6) Run fraud detection checks (non-blocking — errors are logged, never block the response)
    if (inserted?.id) {
      runFraudChecks(inserted.id, userId, businessId, receiptTotalCents);
    }

    // Notify business owners/managers about the new receipt submission
    const { data: bizOwners } = await supabase
      .from("business_users")
      .select("user_id")
      .eq("business_id", businessId)
      .in("role", ["owner", "manager"]);

    if (bizOwners && bizOwners.length > 0) {
      // Get user name for the notification
      const { data: submitterProfile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", userId)
        .maybeSingle();

      const userName = submitterProfile?.first_name
        ? `${submitterProfile.first_name} ${((submitterProfile.last_name as string) || "")[0] || ""}`.trim()
        : "A customer";

      // Get business name
      const { data: bizInfo } = await supabase
        .from("business")
        .select("public_business_name, business_name")
        .eq("id", businessId)
        .maybeSingle();

      const bizName = String(
        (bizInfo?.public_business_name || bizInfo?.business_name) as string || "your business"
      );

      const amountStr = `$${(receiptTotalCents / 100).toFixed(2)}`;
      const dupWarning = isDuplicateConfirmed
        ? " ⚠️ This may be a duplicate — a similar receipt was submitted recently."
        : "";

      for (const owner of bizOwners) {
        notify({
          userId: owner.user_id as string,
          type: NOTIFICATION_TYPES.RECEIPT_SUBMITTED,
          title: isDuplicateConfirmed ? "New Receipt — Possible Duplicate" : "New Receipt",
          body: `${userName} submitted a ${amountStr} receipt at ${bizName}. Review it in your dashboard.${dupWarning}`,
          metadata: {
            receiptId: inserted?.id,
            businessId,
            businessName: bizName,
            userName,
            amountCents: receiptTotalCents,
            isDuplicate: isDuplicateConfirmed || false,
            href: "/businessprofile-v2",
          },
        });
      }
    }

    return NextResponse.json(
      {
        ok: true,
        receiptId: inserted?.id ?? null,
        windowStart,
        visitsThisWindow,
        tier: currentTier,
        receiptTotalCents,
        payoutCents,
        promotionsApplied: appliedPromoIds.length,
        isDuplicate: isDuplicateConfirmed || false,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[receipts] Unexpected error:", message);
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/receipts
 * Cancel a pending receipt. Only the submitting user can cancel, and only if status is "pending".
 * Body: { receiptId: string }
 */
export async function PATCH(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = await req.json();
  const receiptId = String(body.receiptId || "").trim();
  if (!receiptId) {
    return NextResponse.json({ error: "receiptId is required" }, { status: 400 });
  }

  // Fetch the receipt to verify ownership and status
  const { data: receipt, error: fetchErr } = await supabase
    .from("receipts")
    .select("id, user_id, status")
    .eq("id", receiptId)
    .maybeSingle();

  if (fetchErr || !receipt) {
    return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  }

  if (receipt.user_id !== user.id) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  if (receipt.status !== "pending") {
    return NextResponse.json({ error: "Only pending receipts can be cancelled" }, { status: 400 });
  }

  const { error: updateErr } = await supabase
    .from("receipts")
    .update({ status: "cancelled", payout_cents: 0 })
    .eq("id", receiptId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, receiptId });
}
