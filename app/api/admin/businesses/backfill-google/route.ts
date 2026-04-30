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

interface BackfillResult {
  businessId: string;
  businessName: string;
  status: "updated" | "skipped" | "no_match" | "no_place_id" | "google_error" | "no_changes";
  tagsBefore?: string[];
  tagsAfter?: string[];
  subtypeBefore?: string;
  subtypeAfter?: string;
  reason?: string;
}

/**
 * POST /api/admin/businesses/backfill-google
 *
 * Re-enriches seeded (trial) businesses by re-fetching Google Places details
 * with the expanded fieldMask. Two fixes happen in one pass:
 *   1. RECLASSIFY SUBTYPE — runs the current mapBusinessSubtype against the
 *      fresh Google primaryType / types[]. Replaces tags[0] when it changed
 *      (e.g. "Entertainment" → "Wedding Venue", "Activity" → "Zoo"). Also
 *      updates category_main and business_type so they match.
 *   2. ENRICH TAGS — adds cuisine/dietary/Extras tags from the new Google
 *      fields (servesVegetarianFood, outdoorSeating, etc.) via mergeTags.
 *
 * Owner-curated tags are preserved: businesses with >1 tag in their array are
 * assumed to have been touched by an owner (or already enriched) and skipped.
 * To force a re-run on a specific business, clear its tags array first.
 *
 * Body (all optional):
 *   { businessIds?: string[]   // Limit to specific businesses
 *     limit?: number           // Cap rows processed (default 100, max 500)
 *     force?: boolean }        // Skip the >1-tag guard
 *
 * Returns: { processed, updated, skipped, results: BackfillResult[] }
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
    const businessIds: string[] | undefined = Array.isArray(body.businessIds) ? body.businessIds : undefined;
    const limit: number = Math.min(500, Math.max(1, Number(body.limit) || 100));
    const force: boolean = body.force === true;

    // Fetch candidate seeded businesses. Restrict to trial (seeded) — claimed
    // businesses' tags are owner-curated territory.
    let q = supabaseServer
      .from("business")
      .select("id, business_name, public_business_name, zip, blurb, tags, billing_plan, seeded_at")
      .eq("billing_plan", "trial")
      .not("seeded_at", "is", null)
      .limit(limit);
    if (businessIds && businessIds.length > 0) {
      q = q.in("id", businessIds);
    }
    const { data: businesses, error: bizErr } = await q;
    if (bizErr) {
      return NextResponse.json({ error: bizErr.message }, { status: 500 });
    }

    const results: BackfillResult[] = [];
    let updated = 0;
    let skipped = 0;

    for (const biz of businesses ?? []) {
      const existingTags = Array.isArray(biz.tags) ? (biz.tags as string[]) : [];
      const businessName = (biz.public_business_name || biz.business_name || "") as string;

      // Skip owner-curated: tags array has >1 entry means an owner edited or
      // a prior backfill already enriched this business. The first slot is the
      // subtype (e.g. "Restaurant") that bulk-seed always writes.
      if (!force && existingTags.length > 1) {
        results.push({
          businessId: biz.id,
          businessName,
          status: "skipped",
          tagsBefore: existingTags,
          reason: "tags already populated (>1 entry) — likely owner-curated",
        });
        skipped++;
        continue;
      }

      // Find the originating sales lead to recover the Google Place ID.
      // Match on name + zip — both seeded business and lead share these from
      // the same Google search response, so this is reliable for our scale.
      let placeId: string | null = null;
      const { data: leads } = await supabaseServer
        .from("sales_leads")
        .select("google_place_id, business_name, zip")
        .eq("business_name", biz.business_name)
        .eq("zip", biz.zip)
        .not("google_place_id", "is", null)
        .limit(1);
      if (leads && leads.length > 0) {
        placeId = leads[0].google_place_id as string;
      }

      if (!placeId) {
        results.push({
          businessId: biz.id,
          businessName,
          status: "no_place_id",
          tagsBefore: existingTags,
          reason: "no matching sales_lead with google_place_id (try matching by name only or seed via prospecting)",
        });
        skipped++;
        continue;
      }

      // Fetch Google Places details with the tag-extraction fields
      const detailsFieldMask = [...TAG_EXTRACTION_FIELD_MASK, "types"].join(",");
      let detailsData: Record<string, unknown> | null = null;
      try {
        const detailsRes = await fetch(
          `https://places.googleapis.com/v1/places/${placeId}`,
          { headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": detailsFieldMask } }
        );
        if (detailsRes.ok) {
          detailsData = await detailsRes.json();
        }
      } catch {
        // fall through to error path below
      }

      if (!detailsData) {
        results.push({
          businessId: biz.id,
          businessName,
          status: "google_error",
          tagsBefore: existingTags,
          reason: "Google Places API call failed",
        });
        skipped++;
        continue;
      }

      const placeForTags: GooglePlaceForTags = {
        primaryType: (detailsData.primaryType as string | null) ?? null,
        types: Array.isArray(detailsData.types) ? (detailsData.types as string[]) : null,
        servesVegetarianFood: (detailsData.servesVegetarianFood as boolean | null) ?? null,
        servesVeganFood: (detailsData.servesVeganFood as boolean | null) ?? null,
        outdoorSeating: (detailsData.outdoorSeating as boolean | null) ?? null,
        allowsDogs: (detailsData.allowsDogs as boolean | null) ?? null,
        editorialSummary: (detailsData.editorialSummary as { text?: string | null } | null) ?? null,
      };

      // ── 1. Reclassify subtype from fresh Google primaryType/types ──────
      // The subtype lives at tags[0] by convention (bulk-seed always writes
      // it there). Re-running the current mapper against fresh Google data
      // catches misclassifications from older seeds that pre-date newer
      // mappings (e.g. "wedding venue" / "zoo" / "axe throwing").
      const googleClassInput = pickGoogleClassificationInput(placeForTags.primaryType, placeForTags.types);
      const newSubtype = googleClassInput ? mapBusinessSubtype(googleClassInput) : (existingTags[0] || "Activity");
      const oldSubtype = existingTags[0] || "";
      const subtypeChanged = newSubtype !== oldSubtype;

      // Build the working tag array: replace tags[0] with the new subtype,
      // preserve everything else (Google enrichment from prior runs etc.).
      const tagsAfterReclassify = existingTags.length > 0
        ? [newSubtype, ...existingTags.slice(1).filter(t => t.toLowerCase() !== newSubtype.toLowerCase())]
        : [newSubtype];

      // ── 2. Enrich tags from Google's serves*/outdoorSeating/etc fields ─
      const extracted = extractTagsFromPlace(placeForTags);
      const mergedTags = mergeTags(tagsAfterReclassify, extracted.allTags);

      // ── 3. Decide whether anything changed ─────────────────────────────
      const tagsChanged =
        mergedTags.length !== existingTags.length ||
        mergedTags.some((t, i) => existingTags[i]?.toLowerCase() !== t.toLowerCase());

      // Compute new category_main / business_type alongside subtype
      const newCategory = googleClassInput ? mapBusinessTypeToCategory(googleClassInput) : null;
      // Skip category update if Google didn't help — don't overwrite with junk
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
        results.push({
          businessId: biz.id,
          businessName,
          status: "no_changes",
          tagsBefore: existingTags,
          tagsAfter: mergedTags,
          subtypeBefore: oldSubtype,
          subtypeAfter: newSubtype,
        });
        skipped++;
        continue;
      }

      const { error: updErr } = await supabaseServer
        .from("business")
        .update(updates)
        .eq("id", biz.id);

      if (updErr) {
        results.push({
          businessId: biz.id,
          businessName,
          status: "google_error",
          tagsBefore: existingTags,
          reason: `update failed: ${updErr.message}`,
        });
        skipped++;
        continue;
      }

      results.push({
        businessId: biz.id,
        businessName,
        status: "updated",
        tagsBefore: existingTags,
        tagsAfter: mergedTags,
        subtypeBefore: oldSubtype,
        subtypeAfter: newSubtype,
      });
      updated++;
    }

    return NextResponse.json({
      processed: results.length,
      updated,
      skipped,
      results,
    });
  } catch (err) {
    console.error("[backfill-google] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
