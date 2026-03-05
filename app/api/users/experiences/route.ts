import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

// ─── Helper: authenticate request ───

async function authenticate(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const {
    data: { user },
    error,
  } = await supabaseServer.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

/**
 * GET /api/users/experiences
 * Returns the authenticated user's experience media with server-generated signed URLs.
 */
export async function GET(req: NextRequest) {
  const user = await authenticate(req);
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { data: rows, error: queryErr } = await supabaseServer
    .from("user_experience_media")
    .select(
      "id, business_id, storage_path, media_type, caption, status, created_at, business:business(business_name, public_business_name)"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);

  if (queryErr) {
    return NextResponse.json({ error: queryErr.message }, { status: 500 });
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({ experiences: [] });
  }

  // Generate signed URLs server-side (service role can always sign)
  const experiences = await Promise.all(
    rows.map(async (row) => {
      const rec = row as Record<string, unknown>;
      const biz = rec.business as Record<string, unknown> | null;
      const storagePath = rec.storage_path as string;

      const { data: signedData } = await supabaseServer.storage
        .from("user-experiences")
        .createSignedUrl(storagePath, 3600); // 1 hour

      return {
        id: rec.id as string,
        businessId: rec.business_id as string,
        businessName:
          (biz?.public_business_name as string) ||
          (biz?.business_name as string) ||
          "Unknown",
        mediaUrl: signedData?.signedUrl || "",
        mediaType: (rec.media_type as string) || "image",
        caption: (rec.caption as string) || "",
        status: (rec.status as string) || "pending",
        storagePath,
        createdAt: rec.created_at as string,
      };
    })
  );

  return NextResponse.json({ experiences });
}
