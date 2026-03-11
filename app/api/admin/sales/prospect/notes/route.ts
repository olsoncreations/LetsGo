import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

// Verify caller is authenticated staff
async function requireStaff(req: NextRequest): Promise<{ error: Response } | { userId: string; name: string }> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return { error: NextResponse.json({ error: "Authentication required" }, { status: 401 }) };
  const { data: { user }, error } = await supabaseServer.auth.getUser(token);
  if (error || !user) return { error: NextResponse.json({ error: "Authentication required" }, { status: 401 }) };
  const { data: staff } = await supabaseServer
    .from("staff_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!staff) return { error: NextResponse.json({ error: "Staff access required" }, { status: 403 }) };

  const { data: profile } = await supabaseServer
    .from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  const name = (profile?.full_name as string) || user.email || "Unknown";

  return { userId: user.id, name };
}

/**
 * GET /api/admin/sales/prospect/notes?leadId=xxx
 * Fetches notes for a specific lead.
 */
export async function GET(req: NextRequest) {
  const auth = await requireStaff(req);
  if ("error" in auth) return auth.error;

  const leadId = req.nextUrl.searchParams.get("leadId");
  if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });

  try {
    const { data, error } = await supabaseServer
      .from("sales_lead_notes")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ notes: data || [] });
  } catch (err) {
    console.error("Fetch notes error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/sales/prospect/notes
 * Adds a note to a lead. Body: { leadId: string, note: string }
 */
export async function POST(req: NextRequest) {
  const auth = await requireStaff(req);
  if ("error" in auth) return auth.error;

  try {
    const body = await req.json();
    const { leadId, note } = body;

    if (!leadId || !note?.trim()) {
      return NextResponse.json({ error: "leadId and note required" }, { status: 400 });
    }

    const { error } = await supabaseServer.from("sales_lead_notes").insert({
      lead_id: leadId,
      note: note.trim(),
      created_by: auth.name,
    });

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Add note error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
