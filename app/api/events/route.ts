import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { DEFAULT_PRESET_BPS } from "@/lib/platformSettings";
import { resolveHoursFromColumns } from "@/lib/businessNormalize";

/**
 * GET /api/events
 * Public event feed — returns upcoming, published, non-cancelled events
 * with enriched business data, payout tiers, view counts, and RSVP breakdowns.
 */
export async function GET(): Promise<Response> {
  try {
    const now = new Date().toISOString();

    const [eventsRes, bizRes, tiersRes, viewsRes, rsvpsRes] = await Promise.all([
      supabaseServer
        .from("business_events")
        .select("*")
        .eq("is_published", true)
        .eq("is_cancelled", false)
        .gte("start_at", now)
        .order("start_at", { ascending: true }),

      supabaseServer
        .from("business")
        .select(
          "id, business_name, public_business_name, street_address, address_line1, city, state, zip, contact_phone, phone_number, website, website_url, blurb, category_main, price_level, config, payout_preset, " +
          "mon_open, mon_close, tue_open, tue_close, wed_open, wed_close, thu_open, thu_close, fri_open, fri_close, sat_open, sat_close, sun_open, sun_close"
        )
        .eq("is_active", true),

      supabaseServer
        .from("business_payout_tiers")
        .select("business_id, tier_index, percent_bps")
        .order("tier_index", { ascending: true }),

      supabaseServer.from("event_views").select("event_id"),

      supabaseServer.from("event_rsvps").select("event_id, response"),
    ]);

    if (eventsRes.error) {
      console.error("[events] GET error:", eventsRes.error);
      return NextResponse.json({ error: eventsRes.error.message }, { status: 500 });
    }

    // Business lookup
    type BizRow = Record<string, unknown>;
    const bizMap = new Map<string, BizRow>();
    for (const b of (bizRes.data ?? []) as unknown as BizRow[]) {
      bizMap.set(String(b.id), b);
    }

    // Payout tiers per business: business_id → sorted BPS values
    const tierMap = new Map<string, number[]>();
    for (const t of tiersRes.data ?? []) {
      const bid = String(t.business_id);
      if (!tierMap.has(bid)) tierMap.set(bid, []);
      tierMap.get(bid)!.push(Number(t.percent_bps) || 0);
    }

    // View counts
    const viewCounts = new Map<string, number>();
    for (const v of viewsRes.data ?? []) {
      const eid = String(v.event_id);
      viewCounts.set(eid, (viewCounts.get(eid) || 0) + 1);
    }

    // RSVP counts
    const rsvpCounts = new Map<string, { yes: number; maybe: number; no: number }>();
    for (const r of rsvpsRes.data ?? []) {
      const eid = String(r.event_id);
      if (!rsvpCounts.has(eid)) rsvpCounts.set(eid, { yes: 0, maybe: 0, no: 0 });
      const c = rsvpCounts.get(eid)!;
      if (r.response === "yes") c.yes++;
      else if (r.response === "maybe") c.maybe++;
      else if (r.response === "no") c.no++;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";

    // Format time from ISO string
    function fmtTime(iso: string): string {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return "";
      return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    }

    // Format date as YYYY-MM-DD
    function fmtDate(iso: string): string {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return "";
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }

    // Parse hours from individual day columns (single source of truth)
    function parseHours(biz: BizRow): Array<{ day: string; time: string }> {
      const hoursMap = resolveHoursFromColumns(biz as Record<string, unknown>);
      return Object.entries(hoursMap).map(([day, time]) => ({ day, time }));
    }

    // Compute payout range string from BPS values
    function payoutRangeStr(bpsValues: number[]): string {
      const valid = bpsValues.filter((v) => v > 0);
      if (valid.length === 0) return "";
      const minPct = (Math.min(...valid) / 100).toFixed(0);
      const maxPct = (Math.max(...valid) / 100).toFixed(0);
      return minPct === maxPct ? `${minPct}%` : `${minPct}% – ${maxPct}%`;
    }

    const events = ((eventsRes.data ?? []) as Record<string, unknown>[]).map((e) => {
      const eid = String(e.id);
      const bid = String(e.business_id);
      const biz = bizMap.get(bid);

      // Skip events whose business is inactive/missing
      if (!biz) return null;

      const bizCfg = (biz.config || {}) as Record<string, unknown>;

      // Image URL
      let imageUrl: string | null = null;
      if (e.image_bucket && e.image_path) {
        imageUrl = `${supabaseUrl}/storage/v1/object/public/${e.image_bucket}/${e.image_path}`;
      }

      // Business type
      const bizType = String(
        bizCfg.businessType || biz.category_main || "Other"
      );

      // Payout tiers — ONLY from business_payout_tiers table, fallback to preset
      const bpsValues = tierMap.get(bid) || [];
      // Fallback: use business's payout_preset, then Standard
      if (bpsValues.length === 0) {
        const bizPreset = String(biz.payout_preset || "standard");
        bpsValues.push(...(DEFAULT_PRESET_BPS[bizPreset] || DEFAULT_PRESET_BPS.standard));
      }

      const rsvps = rsvpCounts.get(eid) || { yes: 0, maybe: 0, no: 0 };

      return {
        id: eid,
        businessId: bid,
        title: String(e.title || ""),
        description: String(e.description || ""),
        category: String(e.category || "Other"),
        date: fmtDate(String(e.start_at)),
        startAt: String(e.start_at || ""),
        time: fmtTime(String(e.start_at)),
        endTime: fmtTime(String(e.end_at || e.start_at)),
        business: {
          name: String(biz.public_business_name || biz.business_name || "Unknown"),
          type: bizType,
          address: String(biz.street_address || biz.address_line1 || ""),
          city: String(biz.city || ""),
          state: String(biz.state || ""),
          zip: String(biz.zip || ""),
          phone: String(biz.contact_phone || biz.phone_number || ""),
          website: String(biz.website || biz.website_url || ""),
          hours: parseHours(biz),
        },
        price: String(e.price_text || e.price || ""),
        priceLevel: String(e.price_level || "$$"),
        tags: Array.isArray(e.tags) ? (e.tags as string[]) : [],
        imageUrl,
        attendees: rsvps,
        capacity: e.capacity ? Number(e.capacity) : null,
        bookingUrl: e.external_booking_url ? String(e.external_booking_url) : null,
        payoutRange: payoutRangeStr(bpsValues),
        payoutTiers: bpsValues.map(v => v / 100),
        viewCount: viewCounts.get(eid) || 0,
      };
    }).filter(Boolean);

    return NextResponse.json({ events });
  } catch (err) {
    console.error("[events] GET unexpected error:", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
