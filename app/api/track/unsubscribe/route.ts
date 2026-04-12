import type { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * GET /api/track/unsubscribe?id=<outreach_email_id>&email=<email>
 * Unsubscribe — marks the lead as unsubscribed so no further outreach is sent.
 * No auth required (triggered by user clicking unsubscribe link in email).
 * Returns a simple HTML confirmation page.
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const email = req.nextUrl.searchParams.get("email");

  if (id) {
    // Mark the outreach email as unsubscribed
    await supabaseServer
      .from("outreach_emails")
      .update({ status: "unsubscribed" })
      .eq("id", id);
  }

  if (email) {
    // Mark the lead as unsubscribed so we never email them again
    await supabaseServer
      .from("sales_leads")
      .update({ unsubscribed_at: new Date().toISOString() })
      .eq("email", decodeURIComponent(email));
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Unsubscribed — LetsGo</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex; align-items: center; justify-content: center;
          min-height: 100vh; margin: 0; background: #0f0f1a; color: #fff;
        }
        .container {
          text-align: center; max-width: 440px; padding: 40px 24px;
        }
        h1 { font-size: 24px; margin-bottom: 12px; }
        p { color: #9ca3af; line-height: 1.6; font-size: 15px; }
        a { color: #ff6b35; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>You've been unsubscribed</h1>
        <p>You won't receive any more outreach emails from LetsGo. If this was a mistake, please contact us at <a href="mailto:chris.olson@useletsgo.com">chris.olson@useletsgo.com</a>.</p>
        <p style="margin-top: 24px;"><a href="https://www.useletsgo.com">Visit LetsGo</a></p>
      </div>
    </body>
    </html>
  `;

  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
