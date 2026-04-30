import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  TAG_EXTRACTION_FIELD_MASK,
  extractTagsFromPlace,
  mergeTags,
  type GooglePlaceForTags,
} from "@/lib/googlePlacesMapper";
import {
  mapBusinessSubtype,
  mapBusinessTypeToCategory,
  pickGoogleClassificationInput,
} from "@/lib/businessClassify";

// Verify caller is authenticated staff
async function requireStaff(req: NextRequest): Promise<Response | null> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: { user }, error } = await supabaseServer.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: staff } = await supabaseServer
    .from("staff_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!staff) return NextResponse.json({ error: "Staff access required" }, { status: 403 });
  return null;
}

interface MaintenanceResult {
  placeId: string;
  leadId?: string;
  businessId?: string;
  leadStatus?: "verified" | "skipped" | "error";
  businessStatus?: "updated" | "no_changes" | "error";
  subtypeBefore?: string;
  subtypeAfter?: string;
  reason?: string;
}

/**
 * POST /api/admin/sales/maintenance-run
 *
 * Combined maintenance pass that fixes Google-derived classification problems
 * across BOTH unverified leads AND already-seeded businesses in a single pass,
 * with one Google API call per unique google_place_id (vs. one call per lead +
 * one call per business when run separately).
 *
 * Order of operations:
 *   1. Fetch unverified leads (type_verified_at IS NULL, has place_id)
 *   2. Fetch un-curated seeded businesses (≤1 tag) and link each to its lead
 *      via name+zip match — recovers the place_id
 *   3. Build the union of place_ids to query
 *   4. For each unique place_id: ONE Google Places Details fetch covering both
 *      lead-needed fields (primaryType, types) and business-needed atmosphere
 *      fields (servesVegetarianFood, outdoorSeating, allowsDogs, editorialSummary)
 *   5. Apply results to lead (type + verified) and to business (subtype +
 *      enrichment tags + category) wherever each is applicable
 *
 * Body (all optional):
 *   { limit?: number   // Cap unique place_ids per call (default 200, max 500)
 *     force?: boolean }// Skip the >1-tag owner-curated guard on businesses
 *
 * Returns: { processed, leadsUpdated, businessesUpdated, savedApiCalls,
 *            results: MaintenanceResult[] }
 */
export async function POST(req: NextRequest) {
  const denied = await requireStaff(req);
  if (denied) return denied;

  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Google Maps API key not configured" }, { status: 500 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const limit: number = Math.min(500, Math.max(1, Number(body.limit) || 200));
    const force: boolean = body.force === true;

    // ── 1. Fetch unverified leads with a place_id ────────────────────────
    const { data: leadRows } = await supabaseServer
      .from("sales_leads")
      .select("id, google_place_id, business_name, zip, business_type")
      .is("type_verified_at", null)
      .neq("business_type", "Excluded")
      .not("google_place_id", "is", null)
      .limit(limit);

    // place_id → lead row (last write wins on duplicates, fine for our purposes)
    const leadByPlace = new Map<string, { id: string; business_type: string | null }>();
    for (const lead of leadRows ?? []) {
      const placeId = lead.google_place_id as string;
      if (placeId) {
        leadByPlace.set(placeId, { id: lead.id as string, business_type: lead.business_type as string | null });
      }
    }

    // ── 2. Fetch un-curated seeded businesses and link to their lead ─────
    // Owner-curated heuristic (skip if >1 tag) is applied client-side after
    // fetch — Postgres array_length filtering on JSON tags is awkward and we
    // need to look at the array contents anyway.
    const { data: bizRows } = await supabaseServer
      .from("business")
      .select("id, business_name, public_business_name, zip, blurb, tags")
      .eq("billing_plan", "trial")
      .not("seeded_at", "is", null)
      .limit(limit * 2); // fetch extra; we'll trim by tag length
    const eligibleBusinesses = (bizRows ?? []).filter(b => {
      const tags = Array.isArray(b.tags) ? (b.tags as string[]) : [];
      return force || tags.length <= 1;
    });

    // For each business, look up its lead by (business_name, zip) to get place_id.
    // Batch this lookup to avoid N+1 — single IN query.
    const bizKeys = eligibleBusinesses.map(b => ({ name: b.business_name as string, zip: b.zip as string }));
    const placeIdByBizKey = new Map<string, string>(); // "name||zip" → place_id
    if (bizKeys.length > 0) {
      const uniqueNames = Array.from(new Set(bizKeys.map(k => k.name).filter(Boolean)));
      const uniqueZips = Array.from(new Set(bizKeys.map(k => k.zip).filter(Boolean)));
      const { data: matchingLeads } = await supabaseServer
        .from("sales_leads")
        .select("google_place_id, business_name, zip")
        .in("business_name", uniqueNames)
        .in("zip", uniqueZips)
        .not("google_place_id", "is", null);
      for (const ml of matchingLeads ?? []) {
        const key = `${ml.business_name}||${ml.zip}`;
        placeIdByBizKey.set(key, ml.google_place_id as string);
      }
    }

    // place_id → business row (with existing tags + blurb)
    const businessByPlace = new Map<string, { id: string; existingTags: string[]; blurb: string | null }>();
    for (const biz of eligibleBusinesses) {
      const key = `${biz.business_name}||${biz.zip}`;
      const placeId = placeIdByBizKey.get(key);
      if (placeId) {
        businessByPlace.set(placeId, {
          id: biz.id as string,
          existingTags: Array.isArray(biz.tags) ? (biz.tags as string[]) : [],
          blurb: (biz.blurb as string | null) ?? null,
        });
      }
    }

    // ── 3. Union of place_ids — capped at limit ──────────────────────────
    const allPlaceIds = Array.from(new Set([
      ...leadByPlace.keys(),
      ...businessByPlace.keys(),
    ])).slice(0, limit);

    const naiveCallCount = leadByPlace.size + businessByPlace.size;
    const dedupedCallCount = allPlaceIds.length;
    const savedApiCalls = Math.max(0, naiveCallCount - dedupedCallCount);

    // ── 4 + 5. One Google call per unique place; apply to both sides ─────
    // FieldMask covers both lead needs (types/primaryType) and business needs
    // (atmosphere fields) in one shot.
    const detailsFieldMask = ["primaryType", "types", ...TAG_EXTRACTION_FIELD_MASK]
      // de-dupe in case primaryType is in both lists
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .join(",");

    const results: MaintenanceResult[] = [];
    let leadsUpdated = 0;
    let businessesUpdated = 0;
    let deadIds = 0;       // 404 from Google — place_id retired
    let rateLimited = 0;   // 429 — back off and stop the batch
    let otherErrors = 0;
    let rateLimitedHit = false;

    for (const placeId of allPlaceIds) {
      // Bail out cleanly if Google rate-limited us — running 400 more requests
      // will just hit the same wall and waste API budget. Operator re-clicks
      // after the per-minute window resets.
      if (rateLimitedHit) {
        rateLimited++;
        results.push({ placeId, reason: "skipped — earlier rate limit" });
        continue;
      }

      let detailsData: Record<string, unknown> | null = null;
      let httpStatus = 0;
      try {
        const detailsRes = await fetch(
          `https://places.googleapis.com/v1/places/${placeId}`,
          { headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": detailsFieldMask } }
        );
        httpStatus = detailsRes.status;
        if (detailsRes.ok) detailsData = await detailsRes.json();
      } catch {
        httpStatus = 0;
      }

      if (!detailsData) {
        // Categorize the error so operator can see what's failing.
        const lead = leadByPlace.get(placeId);
        const biz = businessByPlace.get(placeId);
        let reason = `Google Places API ${httpStatus || "error"}`;

        if (httpStatus === 404) {
          // Dead place_id — Google retired it. For leads, mark them verified
          // (with their existing type) so this row stops being a forever-retry
          // candidate. For businesses, nothing to do — their tags stay as-is.
          deadIds++;
          reason = "404 — Google place_id is dead";
          if (lead) {
            await supabaseServer
              .from("sales_leads")
              .update({
                business_type: lead.business_type ?? "Activity",
                type_verified_at: new Date().toISOString(),
              })
              .eq("id", lead.id);
          }
        } else if (httpStatus === 429) {
          rateLimited++;
          rateLimitedHit = true;
          reason = "429 — Google API rate limit; aborting batch";
        } else {
          otherErrors++;
        }

        results.push({
          placeId,
          leadId: lead?.id,
          businessId: biz?.id,
          leadStatus: lead ? "error" : undefined,
          businessStatus: biz ? "error" : undefined,
          reason,
        });
        continue;
      }

      const primaryType = (detailsData.primaryType as string | null) ?? null;
      const types = Array.isArray(detailsData.types) ? (detailsData.types as string[]) : null;
      const googleClassInput = pickGoogleClassificationInput(primaryType, types);

      const result: MaintenanceResult = { placeId };

      // 5a. Lead update
      const lead = leadByPlace.get(placeId);
      if (lead) {
        result.leadId = lead.id;
        const newType = googleClassInput || lead.business_type || "Activity";
        const { error: leadErr } = await supabaseServer
          .from("sales_leads")
          .update({ business_type: newType, type_verified_at: new Date().toISOString() })
          .eq("id", lead.id);
        if (leadErr) {
          result.leadStatus = "error";
          result.reason = `lead update failed: ${leadErr.message}`;
        } else {
          result.leadStatus = "verified";
          leadsUpdated++;
        }
      }

      // 5b. Business update (subtype reclassify + tag enrichment)
      const biz = businessByPlace.get(placeId);
      if (biz) {
        result.businessId = biz.id;
        const placeForTags: GooglePlaceForTags = {
          primaryType,
          types,
          servesVegetarianFood: (detailsData.servesVegetarianFood as boolean | null) ?? null,
          servesVeganFood: (detailsData.servesVeganFood as boolean | null) ?? null,
          outdoorSeating: (detailsData.outdoorSeating as boolean | null) ?? null,
          allowsDogs: (detailsData.allowsDogs as boolean | null) ?? null,
          editorialSummary: (detailsData.editorialSummary as { text?: string | null } | null) ?? null,
        };

        const newSubtype = googleClassInput
          ? mapBusinessSubtype(googleClassInput)
          : (biz.existingTags[0] || "Activity");
        const oldSubtype = biz.existingTags[0] || "";
        result.subtypeBefore = oldSubtype;
        result.subtypeAfter = newSubtype;

        const tagsAfterReclassify = biz.existingTags.length > 0
          ? [newSubtype, ...biz.existingTags.slice(1).filter(t => t.toLowerCase() !== newSubtype.toLowerCase())]
          : [newSubtype];

        const extracted = extractTagsFromPlace(placeForTags);
        const mergedTags = mergeTags(tagsAfterReclassify, extracted.allTags);

        const tagsChanged =
          mergedTags.length !== biz.existingTags.length ||
          mergedTags.some((t, i) => biz.existingTags[i]?.toLowerCase() !== t.toLowerCase());

        const newCategory = googleClassInput ? mapBusinessTypeToCategory(googleClassInput) : null;
        const subtypeChanged = newSubtype !== oldSubtype;

        const updates: Record<string, unknown> = {};
        if (tagsChanged) updates.tags = mergedTags;
        if (newCategory && subtypeChanged) {
          updates.category_main = newCategory;
          updates.business_type = newCategory;
        }
        const summaryText = (detailsData.editorialSummary as { text?: string } | null)?.text;
        if (!biz.blurb && typeof summaryText === "string" && summaryText.trim()) {
          updates.blurb = summaryText.trim();
        }

        if (Object.keys(updates).length === 0) {
          result.businessStatus = "no_changes";
        } else {
          const { error: bizErr } = await supabaseServer
            .from("business")
            .update(updates)
            .eq("id", biz.id);
          if (bizErr) {
            result.businessStatus = "error";
            result.reason = (result.reason ? result.reason + "; " : "") + `business update failed: ${bizErr.message}`;
          } else {
            result.businessStatus = "updated";
            businessesUpdated++;
          }
        }
      }

      results.push(result);
    }

    return NextResponse.json({
      processed: results.length,
      leadsUpdated,
      businessesUpdated,
      savedApiCalls,
      naiveCallCount,
      dedupedCallCount,
      deadIds,
      rateLimited,
      otherErrors,
      results,
    });
  } catch (err) {
    console.error("[maintenance-run] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
