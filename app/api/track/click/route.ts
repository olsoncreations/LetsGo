import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * GET /api/track/click?id=<outreach_email_id>&url=<destination>
 * Click tracking — records when a link in an outreach email is clicked,
 * then redirects to the actual destination.
 * No auth required (triggered by user clicking a link in their email).
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const url = req.nextUrl.searchParams.get("url");

  // Validate destination URL to prevent open redirect attacks
  if (!url || (!url.startsWith("https://") && !url.startsWith("http://"))) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  if (id) {
    // Update status to clicked (upgrades from sent or opened)
    await supabaseServer
      .from("outreach_emails")
      .update({ clicked_at: new Date().toISOString(), status: "clicked" })
      .eq("id", id)
      .in("status", ["sent", "opened"]);
  }

  return NextResponse.redirect(url);
}
