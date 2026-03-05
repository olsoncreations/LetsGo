import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { notify } from "@/lib/notify";
import { NOTIFICATION_TYPES } from "@/lib/notificationTypes";

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
  created_at: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

function getDisplayName(p: ProfileRow): string {
  if (p.full_name) return p.full_name;
  const parts = [p.first_name, p.last_name].filter(Boolean);
  if (parts.length) return parts.join(" ");
  return p.username || "User";
}

/**
 * Extract user ID from Authorization Bearer token.
 */
async function extractUserId(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const { data } = await supabaseServer.auth.getUser(token);
  return data.user?.id ?? null;
}

/**
 * Verify the caller is an owner/manager of the business.
 */
async function verifyBusinessAccess(
  userId: string,
  businessId: string
): Promise<boolean> {
  const { data } = await supabaseServer
    .from("business_users")
    .select("role")
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .in("role", ["owner", "manager"])
    .maybeSingle();
  return !!data;
}

// ═══════════════════════════════════════════════════
// GET /api/businesses/[businessId]/ugc?status=pending
// List UGC submissions for this business.
// Requires business owner/manager auth.
// ═══════════════════════════════════════════════════

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
): Promise<Response> {
  try {
    const { businessId } = await params;
    const userId = await extractUserId(req);

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const hasAccess = await verifyBusinessAccess(userId, businessId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Not authorized for this business" },
        { status: 403 }
      );
    }

    const status = req.nextUrl.searchParams.get("status") || "pending";

    const { data: rawRows, error } = await supabaseServer
      .from("user_experience_media")
      .select(
        "id, business_id, user_id, storage_path, media_type, caption, tags, status, created_at"
      )
      .eq("business_id", businessId)
      .eq("status", status)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[ugc] GET error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (rawRows ?? []) as UgcRow[];

    if (rows.length === 0) {
      return NextResponse.json({ submissions: [] });
    }

    // Enrich with profiles
    const userIds = [...new Set(rows.map((r) => r.user_id))];
    const { data: profiles } = await supabaseServer
      .from("profiles")
      .select("id, full_name, first_name, last_name, username, avatar_url")
      .in("id", userIds);

    const profileMap = new Map<string, ProfileRow>();
    for (const p of (profiles ?? []) as ProfileRow[]) {
      profileMap.set(p.id, p);
    }

    // Generate signed URLs
    const submissions = await Promise.all(
      rows.map(async (r) => {
        const profile = profileMap.get(r.user_id);
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
          createdAt: r.created_at,
          user: {
            id: r.user_id,
            name: profile ? getDisplayName(profile) : "User",
            username: profile?.username ?? null,
            avatarUrl: profile?.avatar_url ?? null,
          },
        };
      })
    );

    return NextResponse.json({ submissions });
  } catch (err) {
    console.error("[ugc] GET unexpected error:", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════
// PATCH /api/businesses/[businessId]/ugc
// Approve or reject a UGC submission.
// Body: { submissionId: string, action: "approve" | "reject" }
// Requires business owner/manager auth.
// ═══════════════════════════════════════════════════

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
): Promise<Response> {
  try {
    const { businessId } = await params;
    const userId = await extractUserId(req);

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const hasAccess = await verifyBusinessAccess(userId, businessId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Not authorized for this business" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { submissionId, action } = body as {
      submissionId: string;
      action: string;
    };

    if (!submissionId || !["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { error: "submissionId and action (approve|reject) are required" },
        { status: 400 }
      );
    }

    const newStatus = action === "approve" ? "approved" : "rejected";

    // Verify the submission belongs to this business
    const { data: existing } = await supabaseServer
      .from("user_experience_media")
      .select("id, status, user_id")
      .eq("id", submissionId)
      .eq("business_id", businessId)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 }
      );
    }

    const { error: updateError } = await supabaseServer
      .from("user_experience_media")
      .update({
        status: newStatus,
        reviewed_by: userId,
      })
      .eq("id", submissionId);

    if (updateError) {
      console.error("[ugc] PATCH error:", updateError);
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    // Notify the content creator about the approval/rejection
    const submitterUserId = existing.user_id as string;
    if (submitterUserId) {
      // Look up business name for the notification
      const { data: biz } = await supabaseServer
        .from("business")
        .select("public_business_name, business_name")
        .eq("id", businessId)
        .maybeSingle();
      const bizName = String(
        (biz?.public_business_name || biz?.business_name) as string || "a business"
      );

      if (newStatus === "approved") {
        notify({
          userId: submitterUserId,
          type: NOTIFICATION_TYPES.MEDIA_APPROVED,
          title: "Content Approved!",
          body: `Your photo/video at ${bizName} is now live on the Experiences feed!`,
          metadata: { submissionId, businessId, businessName: bizName, href: "/experiences" },
        });
      } else {
        notify({
          userId: submitterUserId,
          type: NOTIFICATION_TYPES.MEDIA_REJECTED,
          title: "Content Not Approved",
          body: `Your photo/video at ${bizName} could not be approved. You can submit a new one anytime.`,
          metadata: { submissionId, businessId, businessName: bizName, href: "/experiences" },
        });
      }
    }

    return NextResponse.json({
      submissionId,
      status: newStatus,
    });
  } catch (err) {
    console.error("[ugc] PATCH unexpected error:", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
