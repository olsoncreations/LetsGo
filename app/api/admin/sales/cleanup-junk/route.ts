import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

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

// Keyword list targeting businesses that will never be LetsGo partners.
// Matched against business_name via case-insensitive substring.
// Kept conservative — only obvious non-targets. Edge cases (e.g. "Church's Chicken")
// will be caught and correctly classified by the reclassify step via google_types.
const JUNK_KEYWORDS = [
  // Government / public services
  "fire department", "fire station", "post office", "usps",
  "police department", "sheriff", "city hall", "county courthouse",
  "courthouse", "dmv", "municipal", "state building",
  // Religious
  "church", "baptist", "methodist", "lutheran", "catholic",
  "presbyterian", "synagogue", "mosque", "cathedral", "chapel",
  "parish", "ministries",
  // Education (public)
  "elementary school", "middle school", "high school",
  "public school", "school district",
  // Civic
  "public library", "cemetery", "funeral home", "mortuary",
  // Medical (not a discovery/rewards target)
  "dental", "dentist", "orthodontic", "hospital", "urgent care",
  "medical clinic", "medical center", "chiropractic", "chiropractor",
  "veterinary", "animal hospital",
  // Financial
  "credit union", "bank of", "wells fargo", "u.s. bank", "first national bank",
  // Auto
  "auto body", "auto repair", "auto parts", "transmission shop",
  "car dealer", "car wash", "tire shop",
  // Professional services
  "law firm", "law office", "attorney at law",
  "real estate", "realty", "insurance agency",
  // Home services
  "self storage", "mini storage",
  "roofing", "plumbing", "hvac", "electrical contractor",
  "pest control", "lawn care",
];

function buildOrFilter(): string {
  return JUNK_KEYWORDS
    .map(kw => `business_name.ilike.%${kw}%`)
    .join(",");
}

/**
 * POST /api/admin/sales/cleanup-junk
 * Body: { dryRun: boolean }
 *
 * When dryRun=true: returns { matchCount, sampleNames } — preview only, no writes.
 * When dryRun=false: flags matches as business_type='Excluded' so they drop out of
 * outreach filters. Never deletes rows.
 */
export async function POST(req: NextRequest) {
  const denied = await requireStaff(req);
  if (denied) return denied;

  try {
    const body = await req.json().catch(() => ({}));
    const dryRun = body.dryRun !== false; // default true for safety

    const orFilter = buildOrFilter();

    if (dryRun) {
      // Preview: count matches + return a sample of names so the admin can sanity-check
      const { count, error: countErr } = await supabaseServer
        .from("sales_leads")
        .select("id", { count: "exact", head: true })
        .neq("business_type", "Excluded")
        .or(orFilter);

      if (countErr) {
        console.error("Cleanup preview count error:", countErr);
        return NextResponse.json({ error: countErr.message }, { status: 500 });
      }

      const { data: sample, error: sampleErr } = await supabaseServer
        .from("sales_leads")
        .select("business_name, business_type, city, state")
        .neq("business_type", "Excluded")
        .or(orFilter)
        .limit(25);

      if (sampleErr) {
        console.error("Cleanup preview sample error:", sampleErr);
        return NextResponse.json({ error: sampleErr.message }, { status: 500 });
      }

      return NextResponse.json({
        dryRun: true,
        matchCount: count ?? 0,
        sampleNames: sample || [],
        keywordCount: JUNK_KEYWORDS.length,
      });
    }

    // Execute: flag matches as Excluded
    const { error, count } = await supabaseServer
      .from("sales_leads")
      .update({ business_type: "Excluded" }, { count: "exact" })
      .neq("business_type", "Excluded")
      .or(orFilter);

    if (error) {
      console.error("Cleanup execute error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      dryRun: false,
      updated: count ?? 0,
    });
  } catch (err) {
    console.error("Cleanup API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
