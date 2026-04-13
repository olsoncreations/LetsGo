import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

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

/**
 * GET /api/admin/sales/prospect/leads
 * Fetches all sales leads (server-side, bypasses RLS).
 */
export async function GET(req: NextRequest) {
  const denied = await requireStaff(req);
  if (denied) return denied;

  try {
    // Supabase caps at 1000 rows per request — paginate to get all
    const PAGE_SIZE = 1000;
    let allLeads: Record<string, unknown>[] = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabaseServer
        .from("sales_leads")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        console.error("Fetch leads error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const rows = data || [];
      allLeads = allLeads.concat(rows);
      from += PAGE_SIZE;
      hasMore = rows.length === PAGE_SIZE;
    }

    // Fetch outreach summary per lead (latest status per lead)
    const { data: outreachData } = await supabaseServer
      .from("outreach_emails")
      .select("lead_id, status, sent_at, opened_at, clicked_at")
      .order("created_at", { ascending: false });

    // Build lookup: lead_id -> best outreach status
    const outreachMap = new Map<string, { outreach_status: string; outreach_sent_at: string | null; outreach_opened_at: string | null; outreach_clicked_at: string | null; outreach_count: number }>();
    if (outreachData) {
      for (const oe of outreachData) {
        const existing = outreachMap.get(oe.lead_id);
        if (!existing) {
          outreachMap.set(oe.lead_id, {
            outreach_status: oe.status,
            outreach_sent_at: oe.sent_at,
            outreach_opened_at: oe.opened_at,
            outreach_clicked_at: oe.clicked_at,
            outreach_count: 1,
          });
        } else {
          existing.outreach_count++;
          // Keep the highest status: clicked > opened > sent
          const rank: Record<string, number> = { pending: 0, sent: 1, opened: 2, clicked: 3, bounced: -1, replied: 4, unsubscribed: -2 };
          if ((rank[oe.status] || 0) > (rank[existing.outreach_status] || 0)) {
            existing.outreach_status = oe.status;
            existing.outreach_opened_at = oe.opened_at || existing.outreach_opened_at;
            existing.outreach_clicked_at = oe.clicked_at || existing.outreach_clicked_at;
          }
        }
      }
    }

    // Attach outreach data to leads
    const enrichedLeads = allLeads.map((lead) => {
      const outreach = outreachMap.get(lead.id as string);
      return {
        ...lead,
        outreach_status: outreach?.outreach_status || null,
        outreach_sent_at: outreach?.outreach_sent_at || null,
        outreach_opened_at: outreach?.outreach_opened_at || null,
        outreach_clicked_at: outreach?.outreach_clicked_at || null,
        outreach_count: outreach?.outreach_count || 0,
      };
    });

    return NextResponse.json({ leads: enrichedLeads, totalCount: enrichedLeads.length });
  } catch (err) {
    console.error("Leads API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/sales/prospect/leads
 * Updates a sales lead. Body: { id: string, updates: Record<string, unknown> }
 */
export async function PATCH(req: NextRequest) {
  const denied = await requireStaff(req);
  if (denied) return denied;

  try {
    const body = await req.json();
    const { id, updates } = body;

    if (!id || !updates) {
      return NextResponse.json({ error: "id and updates required" }, { status: 400 });
    }

    const { error } = await supabaseServer
      .from("sales_leads")
      .update(updates)
      .eq("id", id);

    if (error) {
      console.error("Update lead error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Update lead API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/sales/prospect/leads
 * Deletes a sales lead. Body: { id: string }
 */
export async function DELETE(req: NextRequest) {
  const denied = await requireStaff(req);
  if (denied) return denied;

  try {
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const { error } = await supabaseServer
      .from("sales_leads")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Delete lead error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete lead API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
