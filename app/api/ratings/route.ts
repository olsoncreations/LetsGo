import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

// ─── Auth: extract authenticated user ───
async function authenticate(req: NextRequest): Promise<{ id: string } | null> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user }, error } = await supabaseServer.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

// ─── Helper: recalculate aggregate rating on business table ───

async function recalcBusinessRating(businessId: string) {
  const { data } = await supabaseServer
    .from("user_business_ratings")
    .select("stars")
    .eq("business_id", businessId);

  const ratings = data ?? [];
  const count = ratings.length;
  // avg_rating stored as x10 integer: 42 = 4.2 stars
  const avg =
    count > 0
      ? Math.round(
          (ratings.reduce((s, r) => s + (r.stars as number), 0) / count) * 10,
        )
      : 0;

  await supabaseServer
    .from("business")
    .update({ avg_rating: avg, rating_count: count })
    .eq("id", businessId);
}

/**
 * GET /api/ratings?userId=xxx
 * Returns all of a user's ratings with joined business info.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const authUser = await authenticate(req);
  if (!authUser) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    // Use authenticated user's ID — ignore query param
    const userId = authUser.id;

    const { data, error } = await supabaseServer
      .from("user_business_ratings")
      .select(
        "id, business_id, stars, would_go_again, private_note, created_at, updated_at, business:business(business_name, public_business_name, category_main)",
      )
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("[ratings] GET error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const ratings = (data ?? []).map((r) => {
      const biz = r.business as unknown as Record<string, unknown> | null;
      return {
        id: r.id,
        businessId: r.business_id,
        businessName:
          (biz?.public_business_name as string) ||
          (biz?.business_name as string) ||
          "Unknown",
        businessType: (biz?.category_main as string) || "Business",
        stars: r.stars,
        wouldGoAgain: r.would_go_again,
        privateNote: r.private_note,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    });

    return NextResponse.json({ ratings });
  } catch (err) {
    console.error("[ratings] GET unexpected error:", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 },
    );
  }
}

/**
 * POST /api/ratings
 * Create or update a rating.
 * Body: { userId, businessId, stars, wouldGoAgain?, privateNote? }
 */
export async function POST(req: NextRequest): Promise<Response> {
  const authUser = await authenticate(req);
  if (!authUser) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { businessId, stars, wouldGoAgain, privateNote } = body as {
      businessId: string;
      stars: number;
      wouldGoAgain?: boolean;
      privateNote?: string;
    };
    // Use authenticated user ID
    const userId = authUser.id;

    if (!businessId || !stars) {
      return NextResponse.json(
        { error: "businessId and stars are required" },
        { status: 400 },
      );
    }

    if (stars < 1 || stars > 5 || !Number.isInteger(stars)) {
      return NextResponse.json(
        { error: "stars must be an integer from 1 to 5" },
        { status: 400 },
      );
    }

    // Validate: user must have at least 1 approved receipt for this business
    const { count } = await supabaseServer
      .from("receipts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("business_id", businessId)
      .eq("status", "approved");

    if (!count || count === 0) {
      return NextResponse.json(
        {
          error:
            "You must have at least one approved visit to rate this business",
        },
        { status: 403 },
      );
    }

    // Check if rating already exists (upsert)
    const { data: existing } = await supabaseServer
      .from("user_business_ratings")
      .select("id")
      .eq("user_id", userId)
      .eq("business_id", businessId)
      .maybeSingle();

    const ratingData = {
      stars,
      would_go_again: wouldGoAgain !== undefined ? wouldGoAgain : true,
      private_note: privateNote ?? null,
    };

    let action: "created" | "updated";

    if (existing) {
      // Update existing
      const { error } = await supabaseServer
        .from("user_business_ratings")
        .update(ratingData)
        .eq("id", existing.id);

      if (error) {
        console.error("[ratings] UPDATE error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      action = "updated";
    } else {
      // Insert new
      const { error } = await supabaseServer
        .from("user_business_ratings")
        .insert({
          user_id: userId,
          business_id: businessId,
          ...ratingData,
        });

      if (error) {
        if (error.code === "23505") {
          return NextResponse.json({ ok: true, action: "already_exists" });
        }
        console.error("[ratings] INSERT error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      action = "created";
    }

    // Recalculate business aggregate
    await recalcBusinessRating(businessId);

    return NextResponse.json({ ok: true, action });
  } catch (err) {
    console.error("[ratings] POST unexpected error:", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/ratings
 * Remove a rating.
 * Body: { userId, businessId }
 */
export async function DELETE(req: NextRequest): Promise<Response> {
  const authUser = await authenticate(req);
  if (!authUser) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { businessId } = body as {
      businessId: string;
    };
    // Use authenticated user ID
    const userId = authUser.id;

    if (!businessId) {
      return NextResponse.json(
        { error: "businessId is required" },
        { status: 400 },
      );
    }

    const { error } = await supabaseServer
      .from("user_business_ratings")
      .delete()
      .eq("user_id", userId)
      .eq("business_id", businessId);

    if (error) {
      console.error("[ratings] DELETE error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Recalculate business aggregate
    await recalcBusinessRating(businessId);

    return NextResponse.json({ ok: true, action: "deleted" });
  } catch (err) {
    console.error("[ratings] DELETE unexpected error:", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 },
    );
  }
}
