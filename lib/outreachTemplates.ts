import "server-only";

interface LeadData {
  business_name: string;
  city: string | null;
  state: string | null;
  business_type: string | null;
  google_rating: number | null;
}

const FOOTER_ADDRESS = "11221 Roxbury Drive, Omaha, NE 68137";
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.useletsgo.com";

function footer(outreachId: string, email: string): string {
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

export const OUTREACH_TEMPLATES = {
  initial_outreach: {
    label: "Initial Outreach",
    description: "First cold email introducing LetsGo to a business",
    generate: (lead: LeadData, outreachId: string, email: string) => {
      const location = locationText(lead);
      const ratingLine = lead.google_rating && lead.google_rating >= 4.0
        ? `<p>With a ${lead.google_rating}-star rating, your customers clearly love what you do. LetsGo helps you reward them for coming back.</p>`
        : "";

      return {
        subject: `Bring repeat customers to ${lead.business_name}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937; line-height: 1.7;">
            <p>Hi,</p>
            <p>I'm Chris, founder of <strong>LetsGo</strong> — a new app launching in ${location} that drives repeat customers to local businesses like ${lead.business_name}.</p>
            <p><strong>Here's how it works:</strong></p>
            <ul style="padding-left: 20px;">
              <li>Your customers discover ${lead.business_name} on our app</li>
              <li>They earn progressive cash back (5% → 20%) for repeat visits</li>
              <li>The more they come back, the more they earn — so they keep coming back</li>
              <li>You only pay when they spend money at your business</li>
            </ul>
            ${ratingLine}
            <p><strong>It's free to sign up.</strong> No upfront costs, no monthly fees. You only pay a small platform fee when a customer submits a receipt.</p>
            <p style="margin: 28px 0;">
              ${trackLink(outreachId, `${BASE_URL}/owners-manual.html`, "See How It Works")}
            </p>
            <p>Or if you're ready to get started:</p>
            <p style="margin: 28px 0;">
              ${trackLink(outreachId, `${BASE_URL}/partner-onboarding`, "Sign Up Now")}
            </p>
            <p>Happy to answer any questions — just hit reply.</p>
            <p>Best,<br><strong>Chris Olson</strong><br>Founder, LetsGo<br><a href="${BASE_URL}" style="color: #ff6b35;">www.useletsgo.com</a></p>
            ${footer(outreachId, email)}
            ${trackingPixel(outreachId)}
          </div>
        `,
      };
    },
  },

  follow_up: {
    label: "Follow Up",
    description: "Follow-up for businesses that didn't respond to initial outreach",
    generate: (lead: LeadData, outreachId: string, email: string) => {
      const location = locationText(lead);
      return {
        subject: `Quick follow up — LetsGo for ${lead.business_name}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937; line-height: 1.7;">
            <p>Hi,</p>
            <p>I reached out last week about <strong>LetsGo</strong> — the app that brings repeat customers to local businesses in ${location}.</p>
            <p>I know you're busy, so here's the quick version:</p>
            <ul style="padding-left: 20px;">
              <li><strong>Free to join</strong> — no upfront costs</li>
              <li><strong>You only pay when it works</strong> — small fee per customer receipt</li>
              <li><strong>Customers keep coming back</strong> — progressive rewards mean they earn more each visit</li>
            </ul>
            <p>We're signing up businesses in ${location} right now and I'd love to have ${lead.business_name} on the platform.</p>
            <p style="margin: 28px 0;">
              ${trackLink(outreachId, `${BASE_URL}/partner-onboarding`, "Sign Up (2 Minutes)")}
            </p>
            <p>Any questions? Just reply to this email.</p>
            <p>Chris Olson<br>Founder, LetsGo</p>
            ${footer(outreachId, email)}
            ${trackingPixel(outreachId)}
          </div>
        `,
      };
    },
  },

  preview_share: {
    label: "Preview Share",
    description: "Share a preview page we built for the business",
    generate: (lead: LeadData, outreachId: string, email: string, previewId?: string) => {
      const previewUrl = previewId ? `${BASE_URL}/preview/${previewId}` : `${BASE_URL}/partner-onboarding`;
      return {
        subject: `We built something for ${lead.business_name}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937; line-height: 1.7;">
            <p>Hi,</p>
            <p>I'm Chris from <strong>LetsGo</strong>. We built a preview page showing how ${lead.business_name} would look on our app:</p>
            <p style="margin: 28px 0;">
              ${trackLink(outreachId, previewUrl, "See Your Preview Page")}
            </p>
            <p>LetsGo is a rewards app launching in ${locationText(lead)} that drives repeat customers to local businesses. Your customers earn progressive cash back (5% → 20%) every time they visit — giving them a real reason to come back.</p>
            <p><strong>It's free to sign up</strong> and you only pay when customers spend money at your business.</p>
            <p>If you like what you see, signing up takes about 2 minutes:</p>
            <p style="margin: 28px 0;">
              ${trackLink(outreachId, `${BASE_URL}/partner-onboarding`, "Get Started")}
            </p>
            <p>Reply with any questions — happy to chat.</p>
            <p>Chris Olson<br>Founder, LetsGo</p>
            ${footer(outreachId, email)}
            ${trackingPixel(outreachId)}
          </div>
        `,
      };
    },
  },
} as const;

export type TemplateKey = keyof typeof OUTREACH_TEMPLATES;

export function getTemplateKeys(): { key: TemplateKey; label: string; description: string }[] {
  return Object.entries(OUTREACH_TEMPLATES).map(([key, val]) => ({
    key: key as TemplateKey,
    label: val.label,
    description: val.description,
  }));
}
