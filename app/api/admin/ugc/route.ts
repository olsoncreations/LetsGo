import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

// ─── Types ───

type UgcRow = {
  id: string;
  business_id: string;
  user_id: string;
  storage_path: string;
  media_type: "image" | "video";
  caption: string | null;
  tags: string[] | null;
  status: string;
  is_active: boolean;
  reviewed_by: string | null;
  created_at: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
};

type BusinessRow = {
  id: string;
  business_name: string | null;
  public_business_name: string | null;
};

function getDisplayName(p: ProfileRow): string {
  if (p.full_name) return p.full_name;
  const parts = [p.first_name, p.last_name].filter(Boolean);
  if (parts.length) return parts.join(" ");
  return p.username || "User";
}

// ═══════════════════════════════════════════════════
// GET /api/admin/ugc?status=all&page=1&limit=20&search=
// List all UGC submissions across all businesses.
// Uses supabaseServer (service role) — admin only.
// ═══════════════════════════════════════════════════

export async function GET(req: NextRequest): Promise<Response> {
  // Require staff authentication
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: { user: authUser }, error: authErr } = await supabaseServer.auth.getUser(token);
  if (authErr || !authUser) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: staffCheck } = await supabaseServer.from("staff_users").select("user_id").eq("user_id", authUser.id).maybeSingle();
  if (!staffCheck) return NextResponse.json({ error: "Staff access required" }, { status: 403 });

  try {
    const sp = req.nextUrl.searchParams;
    const statusFilter = sp.get("status") || "all";
    const page = Math.max(1, parseInt(sp.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(sp.get("limit") || "20", 10)));
    const search = (sp.get("search") || "").trim().toLowerCase();
    const offset = (page - 1) * limit;

    // ── Stats: count by status ──
    const { count: totalCount } = await supabaseServer
      .from("user_experience_media")
      .select("id", { count: "exact", head: true });

    const { count: pendingCount } = await supabaseServer
      .from("user_experience_media")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    const { count: approvedCount } = await supabaseServer
      .from("user_experience_media")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved");

    const { count: rejectedCount } = await supabaseServer
      .from("user_experience_media")
      .select("id", { count: "exact", head: true })
      .eq("status", "rejected");

    // ── Build main query ──
    let query = supabaseServer
      .from("user_experience_media")
      .select(
        "id, business_id, user_id, storage_path, media_type, caption, tags, status, is_active, reviewed_by, created_at",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    const { data: rawRows, error, count: filteredCount } = await query;

    if (error) {
      console.error("[admin/ugc] GET error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (rawRows ?? []) as UgcRow[];

    // ── Enrich with profiles + business names ──
    const userIds = [...new Set(rows.map((r) => r.user_id))];
    const bizIds = [...new Set(rows.map((r) => r.business_id))];

    const [profilesRes, businessesRes] = await Promise.all([
      userIds.length > 0
        ? supabaseServer
            .from("profiles")
            .select("id, full_name, first_name, last_name, username")
            .in("id", userIds)
        : { data: [] },
      bizIds.length > 0
        ? supabaseServer
            .from("business")
            .select("id, business_name, public_business_name")
            .in("id", bizIds)
        : { data: [] },
    ]);

    const profileMap = new Map<string, ProfileRow>();
    for (const p of (profilesRes.data ?? []) as ProfileRow[]) {
      profileMap.set(p.id, p);
    }

    const bizMap = new Map<string, BusinessRow>();
    for (const b of (businessesRes.data ?? []) as BusinessRow[]) {
      bizMap.set(b.id, b);
    }

    // ── Generate signed URLs + assemble response ──
    const submissions = await Promise.all(
      rows.map(async (r) => {
        const profile = profileMap.get(r.user_id);
        const biz = bizMap.get(r.business_id);
        const bizName =
          biz?.public_business_name || biz?.business_name || "Unknown Business";

        const { data: signedData } = await supabaseServer.storage
          .from("user-experiences")
          .createSignedUrl(r.storage_path, 60 * 30);

        return {
          id: r.id,
          mediaType: r.media_type,
          mediaUrl: signedData?.signedUrl ?? "",
          caption: r.caption,
          tags: r.tags ?? [],
          status: r.status,
          isActive: r.is_active,
          reviewedBy: r.reviewed_by,
          createdAt: r.created_at,
          businessId: r.business_id,
          businessName: bizName,
          user: {
            id: r.user_id,
            name: profile ? getDisplayName(profile) : "User",
            username: profile?.username ?? null,
          },
        };
      })
    );

    // ── Client-side search filter (by business name) ──
    const filtered = search
      ? submissions.filter((s) => s.businessName.toLowerCase().includes(search))
      : submissions;

    return NextResponse.json({
      submissions: filtered,
      stats: {
        total: totalCount ?? 0,
        pending: pendingCount ?? 0,
        approved: approvedCount ?? 0,
        rejected: rejectedCount ?? 0,
      },
      pagination: {
        page,
        limit,
        totalRows: filteredCount ?? 0,
        totalPages: Math.ceil((filteredCount ?? 0) / limit),
      },
    });
  } catch (err) {
    console.error("[admin/ugc] GET unexpected error:", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════
// PATCH /api/admin/ugc
// Admin moderation actions: approve, reject, or delete UGC.
// Body: { submissionId, action: "approve" | "reject" | "delete", adminUserId? }
// ═══════════════════════════════════════════════════

export async function PATCH(req: NextRequest): Promise<Response> {
  // Require staff authentication
  const patchToken = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!patchToken) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: { user: patchAuthUser }, error: patchAuthErr } = await supabaseServer.auth.getUser(patchToken);
  if (patchAuthErr || !patchAuthUser) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: patchStaffCheck } = await supabaseServer.from("staff_users").select("user_id").eq("user_id", patchAuthUser.id).maybeSingle();
  if (!patchStaffCheck) return NextResponse.json({ error: "Staff access required" }, { status: 403 });

  try {
    const body = await req.json();
    const { submissionId, action, adminUserId } = body as {
      submissionId: string;
      action: string;
      adminUserId?: string;
    };

    if (!submissionId || !["approve", "reject", "delete"].includes(action)) {
      return NextResponse.json(
        { error: "submissionId and action (approve|reject|delete) are required" },
        { status: 400 }
      );
    }

    // Verify the submission exists
    const { data: existing } = await supabaseServer
      .from("user_experience_media")
      .select("id, status, is_active")
      .eq("id", submissionId)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 }
      );
    }

    if (action === "delete") {
      // Soft delete — set is_active = false (hides from feed completely)
      const { error } = await supabaseServer
        .from("user_experience_media")
        .update({ is_active: false })
        .eq("id", submissionId);

      if (error) {
        console.error("[admin/ugc] DELETE error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ submissionId, action: "deleted" });
    }

    // Approve or reject
    const newStatus = action === "approve" ? "approved" : "rejected";
    const updateData: Record<string, unknown> = { status: newStatus };
    if (adminUserId) {
      updateData.reviewed_by = adminUserId;
    }

    const { error } = await supabaseServer
      .from("user_experience_media")
      .update(updateData)
      .eq("id", submissionId);

    if (error) {
      console.error("[admin/ugc] PATCH error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ submissionId, status: newStatus });
  } catch (err) {
    console.error("[admin/ugc] PATCH unexpected error:", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
