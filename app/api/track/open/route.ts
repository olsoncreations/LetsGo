import type { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

// 1x1 transparent GIF
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

/**
 * GET /api/track/open?id=<outreach_email_id>
 * Tracking pixel — records when an email is opened.
 * No auth required (triggered by email clients).
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");

  if (id) {
    // Only update if status is 'sent' (don't downgrade from clicked)
    await supabaseServer
      .from("outreach_emails")
      .update({ opened_at: new Date().toISOString(), status: "opened" })
      .eq("id", id)
      .eq("status", "sent");
  }

  return new Response(PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });
}
