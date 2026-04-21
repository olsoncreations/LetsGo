import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { haversineDistance } from "@/lib/zipUtils";

export const maxDuration = 60;

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "LetsGo-Admin/1.0 (olsoncreationsllc@gmail.com)";
const DELAY_MS = 1050; // Nominatim requires max 1 req/sec

async function requireStaff(req: NextRequest): Promise<{ userId: string; userName: string } | Response> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: { user }, error } = await supabaseServer.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: staff } = await supabaseServer
    .from("staff_users").select("user_id, name").eq("user_id", user.id).maybeSingle();
  if (!staff) return NextResponse.json({ error: "Staff access required" }, { status: 403 });
  return { userId: user.id, userName: staff.name || "" };
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

async function geocodeNominatim(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `${NOMINATIM_URL}?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=us`;
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) return null;
    const data = await res.json() as NominatimResult[];
    if (data.length === 0) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

/**
 * POST /api/admin/geocode/batch
 * Process a batch of businesses through Nominatim geocoding.
 * Body: { batchSize?: number, threshold?: number }
 */
export async function POST(req: NextRequest) {
  const staffResult = await requireStaff(req);
  if (staffResult instanceof Response) return staffResult;
  const { userId: staffId, userName: staffName } = staffResult;

  try {
    const body = await req.json();
    const batchSize = Math.min(50, Math.max(1, body.batchSize || 50));
    const threshold = body.threshold || 0.3;

    // Fetch pending businesses with address data
    const { data: businesses, error: fetchErr } = await supabaseServer
      .from("business")
      .select("id, business_name, street_address, city, state, zip, latitude, longitude")
      .eq("geocode_status", "pending")
      .eq("is_active", true)
      .not("street_address", "is", null)
      .not("city", "is", null)
      .order("created_at", { ascending: true })
      .limit(batchSize);

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    if (!businesses || businesses.length === 0) {
      // Count remaining (might have businesses with no address)
      const { count } = await supabaseServer
        .from("business")
        .select("id", { count: "exact", head: true })
        .eq("geocode_status", "pending")
        .eq("is_active", true);
      return NextResponse.json({ processed: 0, remaining: count || 0, matched: 0, mismatched: 0, noResult: 0, errors: 0 });
    }

    let matched = 0;
    let mismatched = 0;
    let noResult = 0;
    let errors = 0;

    for (let i = 0; i < businesses.length; i++) {
      const biz = businesses[i];
      const address = [biz.street_address, biz.city, biz.state, biz.zip].filter(Boolean).join(", ");

      try {
        // Rate limit: wait before each request (skip first)
        if (i > 0) await new Promise(r => setTimeout(r, DELAY_MS));

        const result = await geocodeNominatim(address);

        if (!result) {
          // Try with just city, state, zip as fallback
          const fallbackAddress = [biz.city, biz.state, biz.zip].filter(Boolean).join(", ");
          const fallbackResult = await geocodeNominatim(fallbackAddress);
          await new Promise(r => setTimeout(r, DELAY_MS));

          if (!fallbackResult) {
            await supabaseServer.from("business").update({
              geocode_status: "no_result",
              geocode_checked_at: new Date().toISOString(),
            }).eq("id", biz.id);
            noResult++;
            continue;
          }

          // Use fallback result but with lower confidence
          await processResult(biz, fallbackResult, threshold + 0.5);
          continue;
        }

        await processResult(biz, result, threshold);
      } catch {
        errors++;
        await supabaseServer.from("business").update({
          geocode_status: "no_result",
          geocode_checked_at: new Date().toISOString(),
        }).eq("id", biz.id);
      }
    }

    async function processResult(
      biz: { id: string; latitude: number | null; longitude: number | null },
      result: { lat: number; lng: number },
      thresh: number
    ) {
      let distMiles: number | null = null;
      let status = "matched";

      if (biz.latitude != null && biz.longitude != null) {
        distMiles = haversineDistance(biz.latitude, biz.longitude, result.lat, result.lng);
        status = distMiles <= thresh ? "matched" : "mismatch";
      } else {
        // No Google coords — Nominatim is the only source, auto-approve
        status = "matched";
      }

      const update: Record<string, unknown> = {
        nominatim_lat: result.lat,
        nominatim_lng: result.lng,
        geocode_status: status,
        geocode_distance_miles: distMiles,
        geocode_checked_at: new Date().toISOString(),
      };

      // If matched, also update the primary coordinates to Nominatim values
      // (they're more accurate since they come from the address, not a Place ID)
      if (status === "matched") {
        update.latitude = result.lat;
        update.longitude = result.lng;
        matched++;
      } else {
        mismatched++;
      }

      await supabaseServer.from("business").update(update).eq("id", biz.id);
    }

    // Count remaining
    const { count: remaining } = await supabaseServer
      .from("business")
      .select("id", { count: "exact", head: true })
      .eq("geocode_status", "pending")
      .eq("is_active", true);

    // Audit log
    await supabaseServer.from("audit_log").insert({
      action: "geocode_batch_run",
      tab: "Businesses",
      target_type: "business",
      details: `Batch geocoded ${businesses.length} businesses: ${matched} matched, ${mismatched} flagged, ${noResult} no result, ${errors} errors. Threshold: ${threshold}mi`,
      staff_id: staffId,
      staff_name: staffName,
    }).then(() => {}, () => {});

    return NextResponse.json({
      processed: businesses.length,
      remaining: remaining || 0,
      matched,
      mismatched,
      noResult,
      errors,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
