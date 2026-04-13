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

// Common false-positive email domains to filter out
const JUNK_DOMAINS = new Set([
  "example.com", "sentry.io", "wixpress.com", "wix.com", "squarespace.com",
  "wordpress.com", "godaddy.com", "googleapis.com", "google.com", "facebook.com",
  "twitter.com", "instagram.com", "cloudflare.com", "schema.org", "w3.org",
  "apache.org", "jquery.com", "microsoft.com", "apple.com", "amazon.com",
]);

// File extensions that aren't real email addresses
const JUNK_EXTENSIONS = /\.(png|jpg|jpeg|gif|svg|webp|css|js|ico|woff|ttf|eot)$/i;

// Preferred email prefixes (higher priority)
const PREFERRED_PREFIXES = ["info@", "contact@", "hello@", "general@", "owner@", "manager@", "admin@", "mail@"];

function extractEmails(html: string): string[] {
  // Match email patterns in the HTML
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const raw = html.match(emailRegex) || [];

  // Deduplicate and filter
  const seen = new Set<string>();
  const emails: string[] = [];

  for (const email of raw) {
    const lower = email.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);

    // Filter junk
    const domain = lower.split("@")[1];
    if (JUNK_DOMAINS.has(domain)) continue;
    if (JUNK_EXTENSIONS.test(lower)) continue;
    if (lower.includes("noreply") || lower.includes("no-reply")) continue;
    if (lower.includes("unsubscribe")) continue;
    if (lower.length > 80) continue;

    emails.push(lower);
  }

  return emails;
}

function pickBestEmail(emails: string[], businessDomain: string | null): string | null {
  if (emails.length === 0) return null;
  if (emails.length === 1) return emails[0];

  // Prefer emails matching the business domain
  if (businessDomain) {
    const domainEmails = emails.filter((e) => e.endsWith(`@${businessDomain}`));
    if (domainEmails.length > 0) {
      // Within domain matches, prefer common contact prefixes
      for (const prefix of PREFERRED_PREFIXES) {
        const match = domainEmails.find((e) => e.startsWith(prefix));
        if (match) return match;
      }
      return domainEmails[0];
    }
  }

  // Fall back to preferred prefixes across all emails
  for (const prefix of PREFERRED_PREFIXES) {
    const match = emails.find((e) => e.startsWith(prefix));
    if (match) return match;
  }

  return emails[0];
}

function extractDomain(websiteUrl: string): string | null {
  try {
    const url = new URL(websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

async function scrapeEmailFromUrl(websiteUrl: string): Promise<{ emails: string[]; bestEmail: string | null }> {
  const url = websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`;
  const domain = extractDomain(websiteUrl);

  const allEmails: string[] = [];

  // Try the main page first
  const pagesToTry = [url];

  // Also try common contact pages
  try {
    const baseUrl = new URL(url);
    pagesToTry.push(`${baseUrl.origin}/contact`);
    pagesToTry.push(`${baseUrl.origin}/about`);
    pagesToTry.push(`${baseUrl.origin}/contact-us`);
  } catch { /* ignore invalid URLs */ }

  for (const pageUrl of pagesToTry) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(pageUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml",
        },
        redirect: "follow",
      });
      clearTimeout(timeout);

      if (!res.ok) continue;

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("text/html") && !contentType.includes("text/plain")) continue;

      const html = await res.text();
      const found = extractEmails(html);
      allEmails.push(...found);

      // If we found emails on the main page, don't need to check subpages
      if (found.length > 0 && pageUrl === url) break;
    } catch {
      // Timeout or network error — skip this page
      continue;
    }
  }

  // Deduplicate
  const unique = [...new Set(allEmails)];
  const bestEmail = pickBestEmail(unique, domain);

  return { emails: unique, bestEmail };
}

/**
 * POST /api/admin/sales/prospect/scrape-email
 * Scrape email from a lead's website.
 *
 * Body: { leadId: string } — single lead
 *    or { leadIds: string[] } — batch (max 50)
 */
export async function POST(req: NextRequest) {
  const denied = await requireStaff(req);
  if (denied) return denied;

  const body = await req.json();

  // ── Single lead scrape ──
  if (body.leadId) {
    const { data: lead, error } = await supabaseServer
      .from("sales_leads")
      .select("id, website, email, scrape_attempts")
      .eq("id", body.leadId)
      .maybeSingle();

    if (error || !lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (!lead.website) {
      return NextResponse.json({ error: "Lead has no website" }, { status: 400 });
    }

    const { emails, bestEmail } = await scrapeEmailFromUrl(lead.website);

    // Update lead: increment attempts, set email if found
    const updates: Record<string, unknown> = {
      scrape_attempts: (lead.scrape_attempts || 0) + 1,
    };
    if (bestEmail) {
      updates.email = bestEmail;
      updates.email_source = "scraped";
    }
    await supabaseServer
      .from("sales_leads")
      .update(updates)
      .eq("id", lead.id);

    return NextResponse.json({ leadId: lead.id, emails, bestEmail });
  }

  // ── Batch scrape ──
  if (body.leadIds && Array.isArray(body.leadIds)) {
    const leadIds = body.leadIds.slice(0, 50); // Cap at 50

    const { data: leads, error } = await supabaseServer
      .from("sales_leads")
      .select("id, website, email, scrape_attempts")
      .in("id", leadIds);

    if (error) {
      return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 });
    }

    const results: { leadId: string; email: string | null; error?: string }[] = [];

    for (const lead of (leads || [])) {
      if (!lead.website) {
        results.push({ leadId: lead.id, email: null, error: "No website" });
        continue;
      }
      if (lead.email) {
        results.push({ leadId: lead.id, email: lead.email, error: "Already has email" });
        continue;
      }
      if ((lead.scrape_attempts || 0) >= 5) {
        results.push({ leadId: lead.id, email: null, error: "Max attempts reached" });
        continue;
      }

      try {
        const { bestEmail } = await scrapeEmailFromUrl(lead.website);

        const updates: Record<string, unknown> = {
          scrape_attempts: (lead.scrape_attempts || 0) + 1,
        };
        if (bestEmail) {
          updates.email = bestEmail;
          updates.email_source = "scraped";
        }
        await supabaseServer
          .from("sales_leads")
          .update(updates)
          .eq("id", lead.id);

        results.push({ leadId: lead.id, email: bestEmail });
      } catch {
        // Still increment attempts on failure
        await supabaseServer
          .from("sales_leads")
          .update({ scrape_attempts: (lead.scrape_attempts || 0) + 1 })
          .eq("id", lead.id);
        results.push({ leadId: lead.id, email: null, error: "Scrape failed" });
      }

      // Small delay between requests to be polite
      await new Promise((r) => setTimeout(r, 200));
    }

    const found = results.filter((r) => r.email).length;
    return NextResponse.json({ results, found, total: results.length });
  }

  return NextResponse.json({ error: "Provide leadId or leadIds" }, { status: 400 });
}
