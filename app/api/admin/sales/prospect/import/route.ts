import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

// Verify caller is authenticated staff, return user info
async function requireStaff(req: NextRequest): Promise<{ error: Response } | { userId: string; name: string }> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return { error: NextResponse.json({ error: "Authentication required" }, { status: 401 }) };
  const { data: { user }, error } = await supabaseServer.auth.getUser(token);
  if (error || !user) return { error: NextResponse.json({ error: "Authentication required" }, { status: 401 }) };
  const { data: staff } = await supabaseServer
    .from("staff_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!staff) return { error: NextResponse.json({ error: "Staff access required" }, { status: 403 }) };

  // Get staff name
  const { data: profile } = await supabaseServer
    .from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  const name = (profile?.full_name as string) || user.email || "Unknown";

  return { userId: user.id, name };
}

interface LeadRow {
  google_place_id: string;
  business_name: string;
  business_type: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  website: string | null;
  latitude: number | null;
  longitude: number | null;
  google_rating: number | null;
  google_price_level: number | null;
  google_total_ratings: number | null;
  search_query: string | null;
  search_location: string | null;
}

/**
 * POST /api/admin/sales/prospect/import
 * Imports leads into sales_leads table (server-side, bypasses RLS).
 * Body: { leads: LeadRow[] }
 * Returns: { imported: number, skipped: number }
 */
export async function POST(req: NextRequest) {
  const auth = await requireStaff(req);
  if ("error" in auth) return auth.error;

  try {
    const body = await req.json();
    const leads: LeadRow[] = body.leads;

    if (!Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json({ error: "No leads provided" }, { status: 400 });
    }

    // Add imported_by to each row
    const rows = leads.map((lead) => ({
      ...lead,
      imported_by: auth.name,
    }));

    // Upsert with ignoreDuplicates to skip already-imported leads
    const { data, error } = await supabaseServer
      .from("sales_leads")
      .upsert(rows, { onConflict: "google_place_id", ignoreDuplicates: true })
      .select("google_place_id");

    if (error) {
      console.error("Import error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const imported = (data || []).length;
    const skipped = leads.length - imported;

    return NextResponse.json({ imported, skipped });
  } catch (err) {
    console.error("Import API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
