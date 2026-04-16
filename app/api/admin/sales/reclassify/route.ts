import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { mapBusinessType } from "@/lib/googleBusinessType";

async function requireStaff(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: { user }, error } = await supabaseServer.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: staff } = await supabaseServer
    .from("staff_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!staff) return NextResponse.json({ error: "Staff access required" }, { status: 403 });
  return null;
}

// Google Places API default quota is 600 GetPlaceRequest per minute (10 QPS avg).
// Concurrency 2 stays comfortably under the cap (~6-7 QPS sustained, ~400 QPM) so the
// per-minute sliding window never trips the 429. Bump to 10 once the quota is raised.
const CONCURRENCY = 2;
const DEFAULT_BATCH_SIZE = 100;
const MAX_BATCH_SIZE = 200;

interface PlaceDetailsResult {
  types?: string[];
}

async function fetchPlaceTypes(
  placeId: string,
  apiKey: string
): Promise<{ ok: true; types: string[] } | { ok: false; status: number; body: string }> {
  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
      {
        method: "GET",
        headers: {
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "types",
        },
      }
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, status: res.status, body: body.slice(0, 500) };
    }

    const data: PlaceDetailsResult = await res.json();
    return { ok: true, types: data.types || [] };
  } catch (err) {
    return { ok: false, status: 0, body: err instanceof Error ? err.message : "fetch failed" };
  }
}

// Process items with bounded concurrency (no external deps)
async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      results[idx] = await worker(items[idx]);
    }
  });
  await Promise.all(runners);
  return results;
}

/**
 * POST /api/admin/sales/reclassify
 * Body: { batchSize?: number }
 *
 * Pulls up to `batchSize` leads with type_verified_at IS NULL (and not already Excluded),
 * calls Google Place Details API for each (Essentials SKU, types field only),
 * and updates business_type + google_types + type_verified_at.
 *
 * Designed to be called repeatedly from the client until `remaining` reaches 0.
 * Cost: ~$5 per 1000 leads at Places Essentials pricing.
 */
export async function POST(req: NextRequest) {
  const denied = await requireStaff(req);
  if (denied) return denied;

  try {
    const body = await req.json().catch(() => ({}));
    const batchSize = Math.min(
      Math.max(1, Number(body.batchSize) || DEFAULT_BATCH_SIZE),
      MAX_BATCH_SIZE
    );

    const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Google Maps API key not configured" }, { status: 500 });
    }

    // Total remaining (for progress UI)
    const { count: remainingBefore } = await supabaseServer
      .from("sales_leads")
      .select("id", { count: "exact", head: true })
      .is("type_verified_at", null)
      .neq("business_type", "Excluded");

    // Pull the next batch
    const { data: leads, error: fetchErr } = await supabaseServer
      .from("sales_leads")
      .select("id, google_place_id, business_type")
      .is("type_verified_at", null)
      .neq("business_type", "Excluded")
      .not("google_place_id", "is", null)
      .limit(batchSize);

    if (fetchErr) {
      console.error("Reclassify fetch error:", fetchErr);
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    if (!leads || leads.length === 0) {
      return NextResponse.json({
        processed: 0,
        updated: 0,
        errors: 0,
        remaining: remainingBefore ?? 0,
        done: true,
      });
    }

    // Fetch Place Details in parallel (bounded)
    const now = new Date().toISOString();
    let updated = 0;
    let errors = 0;
    let unchanged = 0;
    // Capture a handful of unique errors so the client can surface them if things go wrong.
    const sampleErrors: Array<{ placeId: string; status: number; body: string }> = [];
    const seenStatuses = new Set<number>();

    let deadIds = 0;

    await runWithConcurrency(leads, CONCURRENCY, async (lead) => {
      const result = await fetchPlaceTypes(lead.google_place_id as string, apiKey);

      if (!result.ok) {
        errors++;
        // Keep one sample per unique status code, up to 5 total
        if (!seenStatuses.has(result.status) && sampleErrors.length < 5) {
          seenStatuses.add(result.status);
          sampleErrors.push({
            placeId: String(lead.google_place_id).slice(0, 40),
            status: result.status,
            body: result.body,
          });
          console.error("Reclassify Google error:", result.status, result.body);
        }
        // Terminal failures (404 NOT_FOUND = place ID deleted from Google) get marked
        // as verified with empty google_types so they don't get retried forever.
        // Transient failures (429/5xx) stay unverified and get retried next batch.
        if (result.status === 404) {
          deadIds++;
          await supabaseServer
            .from("sales_leads")
            .update({
              google_types: [],
              type_verified_at: now,
            })
            .eq("id", lead.id);
        }
        return;
      }

      const newType = mapBusinessType(result.types);
      const changed = newType !== lead.business_type;

      const { error: updateErr } = await supabaseServer
        .from("sales_leads")
        .update({
          business_type: newType,
          google_types: result.types,
          type_verified_at: now,
        })
        .eq("id", lead.id);

      if (updateErr) {
        console.error("Reclassify update error for", lead.id, updateErr);
        errors++;
        return;
      }

      if (changed) updated++;
      else unchanged++;
    });

    const processed = leads.length;
    const remaining = Math.max(0, (remainingBefore ?? 0) - processed + errors);

    return NextResponse.json({
      processed,
      updated,
      unchanged,
      errors,
      deadIds,
      remaining,
      done: remaining === 0,
      sampleErrors: sampleErrors.length > 0 ? sampleErrors : undefined,
    });
  } catch (err) {
    console.error("Reclassify API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
