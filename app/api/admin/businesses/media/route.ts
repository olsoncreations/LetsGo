import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * GET /api/admin/businesses/media?businessId=xxx
 * Returns photos and videos from business_media table for a given business.
 * Uses supabaseServer to bypass RLS. Generates public URLs from storage.
 * Includes admin_status for moderation state (active/investigating/banned).
 */
export async function GET(req: NextRequest): Promise<Response> {
  // Require staff authentication
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: { user }, error: authErr } = await supabaseServer.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: staff } = await supabaseServer.from("staff_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!staff) return NextResponse.json({ error: "Staff access required" }, { status: 403 });

  const businessId = req.nextUrl.searchParams.get("businessId");

  if (!businessId) {
    return NextResponse.json({ error: "businessId query param required" }, { status: 400 });
  }

  try {
    // Use select("*") to avoid PostgREST schema cache issues with new columns
    const { data, error } = await supabaseServer
      .from("business_media")
      .select("*")
      .eq("business_id", businessId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("[admin-business-media] GET error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const photos: { id: string; name: string; url: string; status: "active" | "paused" | "removed"; uploaded_at: string }[] = [];
    const videos: { id: string; name: string; url: string; status: "active" | "paused" | "removed"; uploaded_at: string }[] = [];

    for (const row of data ?? []) {
      const r = row as Record<string, unknown>;
      const bucket = String(r.bucket || "business-media");
      const path = String(r.path || "");

      // Generate public URL from Supabase Storage
      const { data: urlData } = supabaseServer.storage.from(bucket).getPublicUrl(path);
      const url = urlData?.publicUrl || "";

      // Map admin_status to the UI status values used by MediaGridManaged
      // Check both dedicated column and meta JSONB fallback (schema cache may be stale)
      const metaObj = (r.meta || {}) as Record<string, unknown>;
      const adminStatus = String(r.admin_status || metaObj.admin_status || "active");
      let uiStatus: "active" | "paused" | "removed" = "active";
      if (adminStatus === "investigating") uiStatus = "paused";
      else if (adminStatus === "banned") uiStatus = "removed";

      const entry = {
        id: String(r.id),
        name: String(r.caption || ""),
        url,
        status: uiStatus,
        uploaded_at: String(r.created_at || new Date().toISOString()),
      };

      const mediaType = String(r.media_type || "").toLowerCase();
      if (mediaType === "video") {
        videos.push(entry);
      } else {
        photos.push(entry);
      }
    }

    return NextResponse.json({ photos, videos });
  } catch (err) {
    console.error("[admin-business-media] GET unexpected error:", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/businesses/media
 * Updates admin moderation status in business_media table.
 * Maps UI statuses (active/paused/removed) to DB values (active/investigating/banned).
 *
 * Body: { id: string, status: "active" | "paused" | "removed" }
 */
export async function PATCH(req: NextRequest): Promise<Response> {
  // Require staff authentication
  const patchToken = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!patchToken) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: { user: patchUser }, error: patchAuthErr } = await supabaseServer.auth.getUser(patchToken);
  if (patchAuthErr || !patchUser) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: patchStaff } = await supabaseServer.from("staff_users").select("user_id").eq("user_id", patchUser.id).maybeSingle();
  if (!patchStaff) return NextResponse.json({ error: "Staff access required" }, { status: 403 });

  try {
    const body = await req.json();
    const id = body.id as string;
    const status = body.status as "active" | "paused" | "removed";

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    // Map UI status to DB admin_status
    let adminStatus: "active" | "investigating" | "banned" = "active";
    if (status === "paused") adminStatus = "investigating";
    else if (status === "removed") adminStatus = "banned";

    // Read current meta, merge admin_status into it, then update.
    // Uses meta JSONB (always in schema cache) to avoid PostgREST stale-cache issues.
    const { data: currentRow, error: readError } = await supabaseServer
      .from("business_media")
      .select("meta")
      .eq("id", id)
      .maybeSingle();

    if (readError) {
      console.error("[admin-business-media] PATCH read error:", readError);
      return NextResponse.json({ error: readError.message }, { status: 500 });
    }

    if (!currentRow) {
      return NextResponse.json({ error: "Media row not found" }, { status: 404 });
    }

    const currentMeta = ((currentRow as Record<string, unknown>).meta || {}) as Record<string, unknown>;
    const newMeta = { ...currentMeta, admin_status: adminStatus };

    const { error: updateError } = await supabaseServer
      .from("business_media")
      .update({ meta: newMeta })
      .eq("id", id);

    if (updateError) {
      console.error("[admin-business-media] PATCH update error:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Also try to set the dedicated column (non-blocking, may fail if schema cache is stale)
    void supabaseServer
      .from("business_media")
      .update({ admin_status: adminStatus } as Record<string, unknown>)
      .eq("id", id);

    return NextResponse.json({ success: true, admin_status: adminStatus });
  } catch (err) {
    console.error("[admin-business-media] PATCH unexpected error:", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/businesses/media
 * Permanently deletes media from storage + database.
 * Supports bulk delete via array of IDs.
 *
 * Body: { ids: string[] }
 */
export async function DELETE(req: NextRequest): Promise<Response> {
  // Require staff authentication
  const delToken = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!delToken) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: { user: delUser }, error: delAuthErr } = await supabaseServer.auth.getUser(delToken);
  if (delAuthErr || !delUser) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: delStaff } = await supabaseServer.from("staff_users").select("user_id").eq("user_id", delUser.id).maybeSingle();
  if (!delStaff) return NextResponse.json({ error: "Staff access required" }, { status: 403 });

  try {
    const body = await req.json();
    const ids = body.ids as string[];

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids array required" }, { status: 400 });
    }

    // Look up rows to get storage paths
    const { data: rows, error: fetchErr } = await supabaseServer
      .from("business_media")
      .select("id, bucket, path")
      .in("id", ids);

    if (fetchErr) {
      console.error("[admin-business-media] DELETE fetch error:", fetchErr);
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    // Delete from storage
    const storageErrors: string[] = [];
    for (const row of rows ?? []) {
      const r = row as Record<string, unknown>;
      const bucket = String(r.bucket || "business-media");
      const path = String(r.path || "");
      if (path) {
        const { error: stErr } = await supabaseServer.storage.from(bucket).remove([path]);
        if (stErr) storageErrors.push(`${path}: ${stErr.message}`);
      }
    }

    // Delete from database
    const { error: dbErr } = await supabaseServer
      .from("business_media")
      .delete()
      .in("id", ids);

    if (dbErr) {
      console.error("[admin-business-media] DELETE db error:", dbErr);
      return NextResponse.json({ error: dbErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      deleted: ids.length,
      storageErrors: storageErrors.length > 0 ? storageErrors : undefined,
    });
  } catch (err) {
    console.error("[admin-business-media] DELETE unexpected error:", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
