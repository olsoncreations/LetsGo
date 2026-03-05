import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * GET /api/businesses/[businessId]/competitors?filter=type|category
 *
 * Returns competitor analysis data:
 * - How many similar businesses exist on the platform
 * - This business's market share by revenue
 * - This business's share of total customers
 * - This business's share of repeat customers
 *
 * filter=type   → match by business_type only (default)
 * filter=category → match by business_type + category_main
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
): Promise<Response> {
  try {
    const { businessId } = await params;
    const filter = req.nextUrl.searchParams.get("filter") || "type";

    // 1) Get the current business
    const { data: biz, error: bizErr } = await supabaseServer
      .from("business")
      .select("id, business_name, public_business_name, business_type, category_main, config")
      .eq("id", businessId)
      .maybeSingle();

    if (bizErr) throw bizErr;
    if (!biz) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Use config.businessType (user-provided, most accurate) → category_main fallback
    const cfg = (biz.config ?? {}) as Record<string, unknown>;
    const bizType = String(cfg.businessType ?? "").toLowerCase() || (biz.category_main ?? "").toLowerCase();
    const bizCategory = biz.category_main || "";

    if (!bizType) {
      return NextResponse.json({
        businessType: "",
        categoryMain: "",
        filter,
        totalBusinesses: 0,
        marketSharePercent: 0,
        customerSharePercent: 0,
        repeatCustomerSharePercent: 0,
        thisBusinessStats: { revenueCents: 0, uniqueCustomers: 0, repeatCustomers: 0, totalReceipts: 0 },
        competitorCount: 0,
        filterLabel: "No business type set",
      });
    }

    // 2) Find all businesses with matching type (and optionally category)
    // Since business type lives in config JSONB, fetch all active businesses
    // and filter client-side by resolved type
    let peerQuery = supabaseServer
      .from("business")
      .select("id, business_name, public_business_name, category_main, config")
      .eq("is_active", true);

    if (filter === "category" && bizCategory) {
      peerQuery = peerQuery.eq("category_main", bizCategory);
    }

    const { data: allBiz, error: peersErr } = await peerQuery;
    if (peersErr) throw peersErr;

    // Filter peers by resolved business type (config.businessType → category_main)
    const peers = (allBiz || []).filter((p: Record<string, unknown>) => {
      const pCfg = (p.config ?? {}) as Record<string, unknown>;
      const pType = String(pCfg.businessType ?? "").toLowerCase() || ((p.category_main as string) ?? "").toLowerCase();
      return pType === bizType;
    });

    const peerIds = peers.map((p: Record<string, unknown>) => String(p.id));
    const totalBusinesses = peerIds.length;
    const competitorCount = Math.max(0, totalBusinesses - 1);

    if (totalBusinesses === 0) {
      return NextResponse.json({
        businessType: bizType,
        categoryMain: bizCategory,
        filter,
        totalBusinesses: 0,
        marketSharePercent: 0,
        customerSharePercent: 0,
        repeatCustomerSharePercent: 0,
        thisBusinessStats: { revenueCents: 0, uniqueCustomers: 0, repeatCustomers: 0, totalReceipts: 0 },
        competitorCount: 0,
        filterLabel: buildFilterLabel(bizType, bizCategory, filter, 0),
      });
    }

    // 3) Get receipt stats for all peers (approved receipts in last 365 days)
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 365);
    const cutoffStr = cutoff.toISOString().split("T")[0];

    const { data: receipts, error: recErr } = await supabaseServer
      .from("receipts")
      .select("business_id, user_id, receipt_total_cents")
      .in("business_id", peerIds)
      .eq("status", "approved")
      .gte("visit_date", cutoffStr);

    if (recErr) throw recErr;

    // 4) Aggregate per business
    type BizStats = {
      revenueCents: number;
      users: Set<string>;
      userVisits: Map<string, number>;
    };

    const statsMap = new Map<string, BizStats>();
    for (const id of peerIds) {
      statsMap.set(id, { revenueCents: 0, users: new Set(), userVisits: new Map() });
    }

    for (const r of receipts || []) {
      const bid = String(r.business_id);
      const s = statsMap.get(bid);
      if (!s) continue;
      s.revenueCents += r.receipt_total_cents ?? 0;
      if (r.user_id) {
        s.users.add(r.user_id);
        s.userVisits.set(r.user_id, (s.userVisits.get(r.user_id) || 0) + 1);
      }
    }

    // 5) Compute totals across all peers
    let totalRevenue = 0;
    let totalUniqueCustomers = new Set<string>();
    let totalRepeatCustomers = new Set<string>();

    for (const [, s] of statsMap) {
      totalRevenue += s.revenueCents;
      for (const uid of s.users) totalUniqueCustomers.add(uid);
      for (const [uid, visits] of s.userVisits) {
        if (visits > 1) totalRepeatCustomers.add(uid);
      }
    }

    // 6) This business's stats
    const thisBiz = statsMap.get(businessId);
    const thisRevenue = thisBiz?.revenueCents ?? 0;
    const thisUnique = thisBiz?.users.size ?? 0;
    const thisRepeat = thisBiz
      ? Array.from(thisBiz.userVisits.values()).filter((v) => v > 1).length
      : 0;
    const thisReceipts = (receipts || []).filter((r) => String(r.business_id) === businessId).length;

    // 7) Market share percentages
    const marketSharePercent = totalRevenue > 0
      ? Math.round((thisRevenue / totalRevenue) * 1000) / 10
      : 0;
    const customerSharePercent = totalUniqueCustomers.size > 0
      ? Math.round((thisUnique / totalUniqueCustomers.size) * 1000) / 10
      : 0;
    const repeatCustomerSharePercent = totalRepeatCustomers.size > 0
      ? Math.round((thisRepeat / totalRepeatCustomers.size) * 1000) / 10
      : 0;

    return NextResponse.json({
      businessType: bizType,
      categoryMain: bizCategory,
      filter,
      totalBusinesses,
      competitorCount,
      marketSharePercent,
      customerSharePercent,
      repeatCustomerSharePercent,
      thisBusinessStats: {
        revenueCents: thisRevenue,
        uniqueCustomers: thisUnique,
        repeatCustomers: thisRepeat,
        totalReceipts: thisReceipts,
      },
      filterLabel: buildFilterLabel(bizType, bizCategory, filter, competitorCount),
    });
  } catch (err) {
    console.error("[competitors] error:", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}

function formatTypeName(raw: string): string {
  const map: Record<string, string> = {
    restaurant_bar: "Restaurant & Bar",
    activity: "Activity",
    salon_beauty: "Salon & Beauty",
    retail: "Retail",
    event_venue: "Event Venue",
    other: "Other",
  };
  return map[raw] || raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildFilterLabel(
  bizType: string,
  category: string,
  filter: string,
  competitorCount: number
): string {
  const typeName = formatTypeName(bizType);
  if (filter === "category" && category) {
    return `Comparing against ${competitorCount} other "${category}" ${typeName} venue${competitorCount !== 1 ? "s" : ""} on LetsGo`;
  }
  return `Comparing against ${competitorCount} other ${typeName} venue${competitorCount !== 1 ? "s" : ""} on LetsGo`;
}
