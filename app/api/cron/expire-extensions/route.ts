import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supabaseServer as supabase } from "@/lib/supabaseServer";

/**
 * GET /api/cron/expire-extensions
 * Daily cron job to mark expired tier extensions.
 * Should be called by Vercel Cron or external scheduler.
 *
 * Protected by CRON_SECRET header to prevent unauthorized access.
 */
export async function GET(req: NextRequest) {
  // Verify cron secret (required)
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const authHeader = req.headers.get("authorization") ?? "";
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const today = new Date().toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from("tier_extensions")
      .update({ status: "expired" })
      .eq("status", "active")
      .lt("effective_until", today)
      .select("id");

    if (error) {
      console.error("Expire extensions cron error:", error);
      return NextResponse.json({ error: "Failed to expire extensions" }, { status: 500 });
    }

    const expiredCount = data?.length ?? 0;
    return NextResponse.json({ success: true, expiredCount });
  } catch (err) {
    console.error("Expire extensions cron error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
