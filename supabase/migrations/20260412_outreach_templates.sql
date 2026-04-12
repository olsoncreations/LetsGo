-- Outreach email templates: editable from admin UI

CREATE TABLE IF NOT EXISTS outreach_templates (
  id          TEXT PRIMARY KEY,  -- e.g. 'initial_outreach', 'follow_up', 'preview_share'
  label       TEXT NOT NULL,
  description TEXT,
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,     -- HTML body with placeholders: {{business_name}}, {{city}}, {{state}}, {{rating}}, {{owner_manual_link}}, {{signup_link}}, {{preview_link}}
  from_name   TEXT NOT NULL DEFAULT 'Chris Olson',
  from_email  TEXT NOT NULL DEFAULT 'chris.olson@useletsgo.com',
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE outreach_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff full access on outreach_templates" ON outreach_templates
  FOR ALL USING (
    EXISTS (SELECT 1 FROM staff_users WHERE staff_users.user_id = auth.uid())
  );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_outreach_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_outreach_templates_updated_at
  BEFORE UPDATE ON outreach_templates
  FOR EACH ROW EXECUTE FUNCTION set_outreach_templates_updated_at();

-- Seed default templates
INSERT INTO outreach_templates (id, label, description, subject, body) VALUES
('initial_outreach', 'Initial Outreach', 'First cold email introducing LetsGo to a business',
 'Bring repeat customers to {{business_name}}',
 '<div style="font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937; line-height: 1.7;">
  <p>Hi,</p>
  <p>I''m Chris, founder of <strong>LetsGo</strong> — a new app launching in {{location}} that drives repeat customers to local businesses like {{business_name}}.</p>
  <p><strong>Here''s how it works:</strong></p>
  <ul style="padding-left: 20px;">
    <li>Your customers discover {{business_name}} on our app</li>
    <li>They earn progressive cash back (5% → 20%) for repeat visits</li>
    <li>The more they come back, the more they earn — so they keep coming back</li>
    <li>You only pay when they spend money at your business</li>
  </ul>
  {{rating_line}}
  <p><strong>It''s free to sign up.</strong> No upfront costs, no monthly fees. You only pay a small platform fee when a customer submits a receipt.</p>
  <p style="margin: 28px 0;">{{cta_owners_manual}}</p>
  <p>Or if you''re ready to get started:</p>
  <p style="margin: 28px 0;">{{cta_signup}}</p>
  <p>Happy to answer any questions — just hit reply.</p>
  <p>Best,<br><strong>{{from_name}}</strong><br>Founder, LetsGo<br><a href="https://www.useletsgo.com" style="color: #ff6b35;">www.useletsgo.com</a></p>
</div>'),

('follow_up', 'Follow Up', 'Follow-up for businesses that didn''t respond to initial outreach',
 'Quick follow up — LetsGo for {{business_name}}',
 '<div style="font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937; line-height: 1.7;">
  <p>Hi,</p>
  <p>I reached out last week about <strong>LetsGo</strong> — the app that brings repeat customers to local businesses in {{location}}.</p>
  <p>I know you''re busy, so here''s the quick version:</p>
  <ul style="padding-left: 20px;">
    <li><strong>Free to join</strong> — no upfront costs</li>
    <li><strong>You only pay when it works</strong> — small fee per customer receipt</li>
    <li><strong>Customers keep coming back</strong> — progressive rewards mean they earn more each visit</li>
  </ul>
  <p>We''re signing up businesses in {{location}} right now and I''d love to have {{business_name}} on the platform.</p>
  <p style="margin: 28px 0;">{{cta_signup}}</p>
  <p>Any questions? Just reply to this email.</p>
  <p>{{from_name}}<br>Founder, LetsGo</p>
</div>'),

('preview_share', 'Preview Share', 'Share a preview page we built for the business',
 'We built something for {{business_name}}',
 '<div style="font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937; line-height: 1.7;">
  <p>Hi,</p>
  <p>I''m Chris from <strong>LetsGo</strong>. We built a preview page showing how {{business_name}} would look on our app:</p>
  <p style="margin: 28px 0;">{{cta_preview}}</p>
  <p>LetsGo is a rewards app launching in {{location}} that drives repeat customers to local businesses. Your customers earn progressive cash back (5% → 20%) every time they visit — giving them a real reason to come back.</p>
  <p><strong>It''s free to sign up</strong> and you only pay when customers spend money at your business.</p>
  <p>If you like what you see, signing up takes about 2 minutes:</p>
  <p style="margin: 28px 0;">{{cta_signup}}</p>
  <p>Reply with any questions — happy to chat.</p>
  <p>{{from_name}}<br>Founder, LetsGo</p>
</div>')
ON CONFLICT (id) DO NOTHING;
