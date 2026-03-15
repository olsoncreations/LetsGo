import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * DELETE /api/admin/businesses
 * Permanently deletes a business and all related data.
 * Removes media files from storage and cascades through all child tables.
 *
 * Body: { businessId: string }
 */
export async function DELETE(req: NextRequest): Promise<Response> {
  // Require staff authentication
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: { user }, error: authErr } = await supabaseServer.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: staff } = await supabaseServer.from("staff_users").select("user_id, role").eq("user_id", user.id).maybeSingle();
  if (!staff) return NextResponse.json({ error: "Staff access required" }, { status: 403 });
  if (staff.role !== "admin") return NextResponse.json({ error: "Admin role required to delete businesses" }, { status: 403 });

  try {
    const body = await req.json();
    const businessId = body.businessId as string;

    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    // Verify business exists
    const { data: biz, error: bizErr } = await supabaseServer
      .from("business")
      .select("id, business_name, public_business_name")
      .eq("id", businessId)
      .maybeSingle();

    if (bizErr || !biz) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const deleted: Record<string, number> = {};

    // 1. Delete media files from storage
    const { data: mediaRows } = await supabaseServer
      .from("business_media")
      .select("id, bucket, path")
      .eq("business_id", businessId);

    if (mediaRows && mediaRows.length > 0) {
      for (const row of mediaRows) {
        const r = row as Record<string, unknown>;
        const bucket = String(r.bucket || "business-media");
        const path = String(r.path || "");
        if (path) {
          await supabaseServer.storage.from(bucket).remove([path]);
        }
      }
    }

    // 2. Delete child table rows (order doesn't matter since we delete parent last)
    const childTables = [
      "business_media",
      "business_payout_tiers",
      "business_users",
      "business_ad_campaigns",
      "business_events",
      "business_addon_subscriptions",
      "payout_tier_changes",
      "promotion_target_businesses",
      "user_followed_businesses",
      "user_experience_media",
      "receipts",
      "invoices",
      "payment_attempts",
      "statements",
    ];

    for (const table of childTables) {
      const { count, error: delErr } = await supabaseServer
        .from(table)
        .delete({ count: "exact" })
        .eq("business_id", businessId);

      if (delErr) {
        // Some tables may not have business_id column — skip gracefully
        console.warn(`[delete-business] Skipping ${table}: ${delErr.message}`);
      } else {
        deleted[table] = count ?? 0;
      }
    }

    // 3. Delete the business itself
    const { error: bizDelErr } = await supabaseServer
      .from("business")
      .delete()
      .eq("id", businessId);

    if (bizDelErr) {
      console.error("[delete-business] Failed to delete business row:", bizDelErr);
      return NextResponse.json({ error: `Failed to delete business: ${bizDelErr.message}` }, { status: 500 });
    }

    const bizName = (biz as Record<string, unknown>).public_business_name || (biz as Record<string, unknown>).business_name || businessId;
    console.log(`[delete-business] Deleted business "${bizName}" and related data:`, deleted);

    return NextResponse.json({ success: true, businessName: bizName, deleted });
  } catch (err) {
    console.error("[delete-business] Unexpected error:", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
