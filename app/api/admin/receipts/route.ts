import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { notify } from "@/lib/notify";
import { NOTIFICATION_TYPES } from "@/lib/notificationTypes";

// Verify caller is authenticated staff
async function requireStaff(req: NextRequest): Promise<Response | null> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: { user }, error } = await supabaseServer.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: staff } = await supabaseServer.from("staff_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!staff) return NextResponse.json({ error: "Staff access required" }, { status: 403 });
  return null; // authorized
}

/**
 * GET /api/admin/receipts
 * Returns all receipts with business names. Uses supabaseServer to bypass RLS.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireStaff(req);
  if (denied) return denied;

  try {
    // Fetch all receipts
    const { data: receipts, error: receiptsError } = await supabaseServer
      .from("receipts")
      .select(
        "id, user_id, business_id, receipt_total_cents, payout_cents, payout_tier_index, payout_tier_label, photo_url, status, visit_date, created_at"
      )
      .order("created_at", { ascending: false });

    if (receiptsError) {
      console.error("[admin-receipts] Error:", receiptsError);
      return NextResponse.json({ error: receiptsError.message }, { status: 500 });
    }

    // Fetch businesses for name mapping
    const { data: businesses } = await supabaseServer
      .from("business")
      .select("id, business_name, public_business_name");

    const bizMap = new Map<string, string>();
    (businesses ?? []).forEach((b: { id: string; business_name: string | null; public_business_name: string | null }) => {
      bizMap.set(b.id, b.public_business_name || b.business_name || "Unknown Business");
    });

    // Generate signed URLs for receipt photos
    const receiptsWithBiz = await Promise.all(
      (receipts ?? []).map(async (r: Record<string, unknown>) => {
        let photoUrl = r.photo_url;
        if (photoUrl && typeof photoUrl === "string") {
          const { data: signedData } = await supabaseServer.storage
            .from("receipts")
            .createSignedUrl(photoUrl, 3600);
          if (signedData?.signedUrl) photoUrl = signedData.signedUrl;
        }
        return {
          ...r,
          photo_url: photoUrl,
          business_name: bizMap.get(r.business_id as string) || r.business_id,
        };
      })
    );

    return NextResponse.json({
      receipts: receiptsWithBiz,
      businesses: (businesses ?? []).map((b: { id: string; business_name: string | null; public_business_name: string | null }) => ({
        id: b.id,
        name: b.business_name,
        public_business_name: b.public_business_name,
      })),
    });
  } catch (err) {
    console.error("[admin-receipts] Unexpected error:", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/receipts
 * Updates receipt statuses. Admin final approval sets "approved", or can reject/restore.
 *
 * Body: { ids: string[], status: "approved" | "rejected" | "pending" | "business_approved" }
 */
export async function PATCH(req: NextRequest): Promise<Response> {
  const denied = await requireStaff(req);
  if (denied) return denied;

  try {
    const body = await req.json();
    const ids: string[] = body.ids;
    const status: string = body.status;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids array required" }, { status: 400 });
    }

    const validStatuses = ["approved", "rejected", "pending", "business_approved"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` }, { status: 400 });
    }

    // Fetch receipt details BEFORE updating status (need original status for balance logic)
    let receiptsToCredit: { id: string; user_id: string; business_id: string; payout_cents: number }[] = [];
    let receiptsToDebit: { id: string; user_id: string; business_id: string; payout_cents: number }[] = [];

    if (status === "approved" || status === "rejected") {
      const { data: receiptRows } = await supabaseServer
        .from("receipts")
        .select("id, user_id, business_id, payout_cents, status")
        .in("id", ids);

      // Block approval for suspended businesses
      if (status === "approved" && receiptRows && receiptRows.length > 0) {
        const bizIds = [...new Set(receiptRows.map((r: Record<string, unknown>) => r.business_id as string))];
        const { data: businesses } = await supabaseServer
          .from("business")
          .select("id, business_name, is_active")
          .in("id", bizIds);
        const suspended = (businesses ?? []).filter((b: Record<string, unknown>) => !b.is_active);
        if (suspended.length > 0) {
          const names = suspended.map((b: Record<string, unknown>) => b.business_name || b.id).join(", ");
          return NextResponse.json(
            { error: `Cannot approve receipts for suspended business(es): ${names}. Reactivate them first.` },
            { status: 403 },
          );
        }
      }

      if (status === "approved") {
        // Only credit receipts that aren't already approved (prevent double-credit)
        receiptsToCredit = (receiptRows ?? [])
          .filter((r: Record<string, unknown>) => r.status !== "approved")
          .map((r: Record<string, unknown>) => ({
            id: r.id as string,
            user_id: r.user_id as string,
            business_id: r.business_id as string,
            payout_cents: (r.payout_cents as number) || 0,
          }));
      }

      if (status === "rejected") {
        // Debit receipts that WERE approved (reverse the balance credit)
        receiptsToDebit = (receiptRows ?? [])
          .filter((r: Record<string, unknown>) => r.status === "approved")
          .map((r: Record<string, unknown>) => ({
            id: r.id as string,
            user_id: r.user_id as string,
            business_id: r.business_id as string,
            payout_cents: (r.payout_cents as number) || 0,
          }));
        // All rejected receipts go into receiptsToCredit for notification purposes
        (receiptRows ?? []).forEach((r: Record<string, unknown>) => {
          receiptsToCredit.push({
            id: r.id as string,
            user_id: r.user_id as string,
            business_id: r.business_id as string,
            payout_cents: 0,
          });
        });
      }
    }

    const { data, error } = await supabaseServer
      .from("receipts")
      .update({ status })
      .in("id", ids)
      .select("id, status");

    if (error) {
      console.error("[admin-receipts] PATCH error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Reverse balance for previously-approved receipts that are now rejected
    // Uses atomic RPC to prevent race conditions
    if (status === "rejected" && receiptsToDebit.length > 0) {
      const userDebits = new Map<string, number>();
      for (const r of receiptsToDebit) {
        userDebits.set(r.user_id, (userDebits.get(r.user_id) || 0) + r.payout_cents);
      }
      for (const [userId, debitCents] of userDebits) {
        const { error: debitErr } = await supabaseServer.rpc("debit_user_balance", {
          p_user_id: userId,
          p_amount_cents: debitCents,
          p_receipt_count: receiptsToDebit.filter(r => r.user_id === userId).length,
        });
        if (debitErr) console.error("[admin/receipts] Debit error for user", userId, debitErr);
      }
    }

    // Look up business names for notifications
    const bizIds = new Set<string>();
    if (status === "approved") {
      for (const r of receiptsToCredit) bizIds.add(r.business_id);
    }
    if (status === "rejected") {
      for (const r of receiptsToCredit) bizIds.add(r.business_id);
      for (const r of receiptsToDebit) bizIds.add(r.business_id);
    }

    const bizNameMap = new Map<string, string>();
    if (bizIds.size > 0) {
      const { data: bizRows } = await supabaseServer
        .from("business")
        .select("id, public_business_name, business_name")
        .in("id", Array.from(bizIds));
      for (const b of bizRows ?? []) {
        bizNameMap.set(
          String(b.id),
          String((b as Record<string, unknown>).public_business_name || b.business_name || "a business")
        );
      }
    }

    // Credit user balances for newly approved receipts
    // Uses atomic RPC to prevent race conditions
    if (status === "approved" && receiptsToCredit.length > 0) {
      // Group by user_id to batch updates
      const userCredits = new Map<string, { payout: number; count: number }>();
      for (const r of receiptsToCredit) {
        const existing = userCredits.get(r.user_id) || { payout: 0, count: 0 };
        existing.payout += r.payout_cents;
        existing.count += 1;
        userCredits.set(r.user_id, existing);
      }

      // Atomically update each user's profile balance
      for (const [userId, credit] of userCredits) {
        const { error: creditErr } = await supabaseServer.rpc("credit_user_balance", {
          p_user_id: userId,
          p_amount_cents: credit.payout,
          p_receipt_count: credit.count,
        });
        if (creditErr) console.error("[admin/receipts] Credit error for user", userId, creditErr);
      }

      // Notify each user about approved receipts + detect tier level-ups
      // Fetch payout_tier_index for each approved receipt to detect tier ups
      const receiptTierMap = new Map<string, number>();
      {
        const { data: tierRows } = await supabaseServer
          .from("receipts")
          .select("id, payout_tier_index")
          .in("id", receiptsToCredit.map(r => r.id));
        for (const t of tierRows ?? []) {
          receiptTierMap.set(String(t.id), (t.payout_tier_index as number) || 1);
        }
      }

      for (const r of receiptsToCredit) {
        const bizName = bizNameMap.get(r.business_id) || "a business";
        const payoutStr = `$${(r.payout_cents / 100).toFixed(2)}`;
        notify({
          userId: r.user_id,
          type: NOTIFICATION_TYPES.RECEIPT_APPROVED,
          title: "Receipt Approved!",
          body: `Your receipt at ${bizName} was approved. You earned ${payoutStr} cashback.`,
          metadata: { receiptId: r.id, businessName: bizName, payoutCents: r.payout_cents, href: "/profile" },
        });

        // Check for tier level-up: compare this receipt's tier to user's previous highest
        const thisTier = receiptTierMap.get(r.id) || 1;
        if (thisTier > 1) {
          // Look up the user's previous max tier at this business (excluding this receipt)
          const { data: prevReceipts } = await supabaseServer
            .from("receipts")
            .select("payout_tier_index")
            .eq("user_id", r.user_id)
            .eq("business_id", r.business_id)
            .eq("status", "approved")
            .neq("id", r.id)
            .order("payout_tier_index", { ascending: false })
            .limit(1);

          const prevMaxTier = (prevReceipts?.[0]?.payout_tier_index as number) || 0;

          if (thisTier > prevMaxTier) {
            // Fetch the tier label and rate for the notification
            const { data: tierInfo } = await supabaseServer
              .from("business_payout_tiers")
              .select("percent_bps, label")
              .eq("business_id", r.business_id)
              .eq("tier_index", thisTier)
              .maybeSingle();

            const newRate = tierInfo
              ? `${((tierInfo.percent_bps as number) / 100).toFixed(1)}%`
              : `Tier ${thisTier}`;

            notify({
              userId: r.user_id,
              type: NOTIFICATION_TYPES.TIER_LEVEL_UP,
              title: "Tier Level Up!",
              body: `You reached ${tierInfo?.label || `Tier ${thisTier}`} at ${bizName}! You now earn ${newRate} cashback.`,
              metadata: {
                businessId: r.business_id,
                businessName: bizName,
                newTier: thisTier,
                newRate,
                tierLabel: tierInfo?.label || null,
                href: "/profile",
              },
            });
          }
        }
      }
    }

    // Notify users about rejected receipts
    if (status === "rejected") {
      for (const r of receiptsToCredit) {
        const bizName = bizNameMap.get(r.business_id) || "a business";
        notify({
          userId: r.user_id,
          type: NOTIFICATION_TYPES.RECEIPT_REJECTED,
          title: "Receipt Not Approved",
          body: `Your receipt at ${bizName} could not be verified. Please check your submission.`,
          metadata: { receiptId: r.id, businessName: bizName, href: "/profile" },
        });
      }
    }

    return NextResponse.json({ updated: data ?? [] });
  } catch (err) {
    console.error("[admin-receipts] PATCH unexpected error:", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
