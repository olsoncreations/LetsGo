import "server-only";
import { supabaseServer } from "./supabaseServer";

interface LeadData {
  business_name: string;
  city: string | null;
  state: string | null;
  business_type: string | null;
  google_rating: number | null;
}

interface DbTemplate {
  id: string;
  label: string;
  description: string | null;
  subject: string;
  body: string;
  from_name: string;
  from_email: string;
  is_active: boolean;
}

const FOOTER_ADDRESS = "11221 Roxbury Drive, Omaha, NE 68137";
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.useletsgo.com";

function footer(outreachId: string, email: string, fromName: string): string {
  const unsubUrl = `${BASE_URL}/api/track/unsubscribe?id=${outreachId}&email=${encodeURIComponent(email)}`;
  return `
    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; line-height: 1.6;">
      <p>OlsonCreations, LLC DBA "LETS GO OUT"<br>${FOOTER_ADDRESS}</p>
      <p>You're receiving this because we think LetsGo could help your business attract repeat customers.
      <a href="${unsubUrl}" style="color: #6b7280; text-decoration: underline;">Unsubscribe</a></p>
    </div>
  `;
}

function trackingPixel(outreachId: string): string {
  return `<img src="${BASE_URL}/api/track/open?id=${outreachId}" width="1" height="1" style="display:none;" alt="" />`;
}

function trackLink(outreachId: string, url: string, text: string): string {
  const tracked = `${BASE_URL}/api/track/click?id=${outreachId}&url=${encodeURIComponent(url)}`;
  return `<a href="${tracked}" style="display: inline-block; padding: 12px 28px; background: #ff6b35; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">${text}</a>`;
}

function locationText(lead: LeadData): string {
  if (lead.city && lead.state) return `${lead.city}, ${lead.state}`;
  return lead.city || lead.state || "your area";
}

/** Replace template placeholders with actual values */
function renderTemplate(
  template: string,
  lead: LeadData,
  outreachId: string,
  fromName: string,
  previewId?: string
): string {
  const location = locationText(lead);
  const ratingLine = lead.google_rating && lead.google_rating >= 4.0
    ? `<p>With a ${lead.google_rating}-star rating, your customers clearly love what you do. LetsGo helps you reward them for coming back.</p>`
    : "";

  const previewUrl = previewId ? `${BASE_URL}/preview/${previewId}` : `${BASE_URL}/partner-onboarding`;

  return template
    .replace(/\{\{business_name\}\}/g, lead.business_name)
    .replace(/\{\{location\}\}/g, location)
    .replace(/\{\{city\}\}/g, lead.city || "")
    .replace(/\{\{state\}\}/g, lead.state || "")
    .replace(/\{\{rating\}\}/g, lead.google_rating?.toString() || "")
    .replace(/\{\{rating_line\}\}/g, ratingLine)
    .replace(/\{\{from_name\}\}/g, fromName)
    .replace(/\{\{cta_owners_manual\}\}/g, trackLink(outreachId, `${BASE_URL}/owners-manual.html`, "See How It Works"))
    .replace(/\{\{cta_brochure\}\}/g, trackLink(outreachId, `${BASE_URL}/brochure-business.html`, "View Our Business Brochure"))
    .replace(/\{\{cta_signup\}\}/g, trackLink(outreachId, `${BASE_URL}/welcome`, "Sign Up Now"))
    .replace(/\{\{cta_preview\}\}/g, trackLink(outreachId, previewUrl, "See Your Preview Page"))
    .replace(/\{\{owner_manual_link\}\}/g, `${BASE_URL}/owners-manual.html`)
    .replace(/\{\{brochure_link\}\}/g, `${BASE_URL}/brochure-business.html`)
    .replace(/\{\{signup_link\}\}/g, `${BASE_URL}/welcome`)
    .replace(/\{\{preview_link\}\}/g, previewUrl);
}

/** Load a template from the DB, falling back to hardcoded defaults */
export async function loadTemplate(templateId: string): Promise<DbTemplate | null> {
  const { data } = await supabaseServer
    .from("outreach_templates")
    .select("*")
    .eq("id", templateId)
    .eq("is_active", true)
    .maybeSingle();

  if (data) return data as DbTemplate;

  // Fallback defaults if DB templates don't exist yet
  const defaults: Record<string, DbTemplate> = {
    initial_outreach: {
      id: "initial_outreach",
      label: "Initial Outreach",
      description: "First cold email introducing LetsGo",
      subject: "Bring repeat customers to {{business_name}}",
      body: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937; line-height: 1.7;">
  <p>Hi,</p>
  <p>I'm Chris, founder of <strong>LetsGo</strong> — a new app launching in {{location}} that drives repeat customers to local businesses like {{business_name}}.</p>
  <p><strong>Here's how it works:</strong></p>
  <ul style="padding-left: 20px;">
    <li>Your customers discover {{business_name}} on our app</li>
    <li>They earn progressive cash back (5% → 20%) for repeat visits</li>
    <li>The more they come back, the more they earn — so they keep coming back</li>
    <li>You only pay when they spend money at your business</li>
  </ul>
  {{rating_line}}
  <p><strong>It's free to sign up.</strong> No upfront costs, no monthly fees. You only pay a small platform fee when a customer submits a receipt.</p>
  <p style="margin: 28px 0;">{{cta_owners_manual}}</p>
  <p>Or if you're ready to get started:</p>
  <p style="margin: 28px 0;">{{cta_signup}}</p>
  <p>Happy to answer any questions — just hit reply.</p>
  <p>Best,<br><strong>{{from_name}}</strong><br>Founder, LetsGo<br><a href="https://www.useletsgo.com" style="color: #ff6b35;">www.useletsgo.com</a></p>
</div>`,
      from_name: "Chris Olson",
      from_email: "chris.olson@useletsgo.com",
      is_active: true,
    },
    follow_up: {
      id: "follow_up",
      label: "Follow Up",
      description: "Follow-up for non-responders",
      subject: "Quick follow up — LetsGo for {{business_name}}",
      body: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937; line-height: 1.7;">
  <p>Hi,</p>
  <p>I reached out last week about <strong>LetsGo</strong> — the app that brings repeat customers to local businesses in {{location}}.</p>
  <p>I know you're busy, so here's the quick version:</p>
  <ul style="padding-left: 20px;">
    <li><strong>Free to join</strong> — no upfront costs</li>
    <li><strong>You only pay when it works</strong> — small fee per customer receipt</li>
    <li><strong>Customers keep coming back</strong> — progressive rewards mean they earn more each visit</li>
  </ul>
  <p>We're signing up businesses in {{location}} right now and I'd love to have {{business_name}} on the platform.</p>
  <p style="margin: 28px 0;">{{cta_signup}}</p>
  <p>Any questions? Just reply to this email.</p>
  <p>{{from_name}}<br>Founder, LetsGo</p>
</div>`,
      from_name: "Chris Olson",
      from_email: "chris.olson@useletsgo.com",
      is_active: true,
    },
    preview_share: {
      id: "preview_share",
      label: "Preview Share",
      description: "Share a preview page",
      subject: "We built something for {{business_name}}",
      body: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937; line-height: 1.7;">
  <p>Hi,</p>
  <p>I'm Chris from <strong>LetsGo</strong>. We built a preview page showing how {{business_name}} would look on our app:</p>
  <p style="margin: 28px 0;">{{cta_preview}}</p>
  <p>LetsGo is a rewards app launching in {{location}} that drives repeat customers to local businesses. Your customers earn progressive cash back (5% → 20%) every time they visit — giving them a real reason to come back.</p>
  <p><strong>It's free to sign up</strong> and you only pay when customers spend money at your business.</p>
  <p>If you like what you see, signing up takes about 2 minutes:</p>
  <p style="margin: 28px 0;">{{cta_signup}}</p>
  <p>Reply with any questions — happy to chat.</p>
  <p>{{from_name}}<br>Founder, LetsGo</p>
</div>`,
      from_name: "Chris Olson",
      from_email: "chris.olson@useletsgo.com",
      is_active: true,
    },
  };

  return defaults[templateId] || null;
}

/** Generate a fully rendered email from a template + lead data */
export async function generateEmail(
  templateId: string,
  lead: LeadData,
  outreachId: string,
  emailTo: string,
  previewId?: string
): Promise<{ subject: string; html: string; fromName: string; fromEmail: string } | null> {
  const template = await loadTemplate(templateId);
  if (!template) return null;

  const subject = renderTemplate(template.subject, lead, outreachId, template.from_name, previewId);
  const bodyHtml = renderTemplate(template.body, lead, outreachId, template.from_name, previewId);

  const html = bodyHtml + footer(outreachId, emailTo, template.from_name) + trackingPixel(outreachId);

  return {
    subject,
    html,
    fromName: template.from_name,
    fromEmail: template.from_email,
  };
}

export type TemplateKey = string;

export function getTemplateKeys(): { key: string; label: string; description: string }[] {
  return [
    { key: "initial_outreach", label: "Initial Outreach", description: "First cold email introducing LetsGo" },
    { key: "follow_up", label: "Follow Up", description: "Follow-up for non-responders" },
    { key: "preview_share", label: "Preview Share", description: "Share a preview page" },
  ];
}
