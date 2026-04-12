-- Outreach email system: scrape emails from lead websites, send & track outreach

-- 1. Add email fields to sales_leads
ALTER TABLE sales_leads
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS email_source TEXT;

-- Index for finding leads with/without emails
CREATE INDEX IF NOT EXISTS idx_sales_leads_email ON sales_leads (email) WHERE email IS NOT NULL;

-- 2. Create outreach_emails table for tracking all outreach
CREATE TABLE IF NOT EXISTS outreach_emails (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID NOT NULL REFERENCES sales_leads(id) ON DELETE CASCADE,
  email_to        TEXT NOT NULL,
  template        TEXT NOT NULL,
  subject         TEXT NOT NULL,
  body            TEXT NOT NULL,
  sent_at         TIMESTAMPTZ,
  opened_at       TIMESTAMPTZ,
  clicked_at      TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'sent', 'opened', 'clicked', 'bounced', 'replied', 'unsubscribed')),
  resend_id       TEXT,
  sent_by         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_outreach_emails_lead_id ON outreach_emails (lead_id);
CREATE INDEX IF NOT EXISTS idx_outreach_emails_status ON outreach_emails (status);
CREATE INDEX IF NOT EXISTS idx_outreach_emails_resend_id ON outreach_emails (resend_id) WHERE resend_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_outreach_emails_email_to ON outreach_emails (email_to);

-- Prevent sending same template to same lead within 30 days
CREATE UNIQUE INDEX IF NOT EXISTS uq_outreach_emails_dedup
  ON outreach_emails (lead_id, template)
  WHERE status NOT IN ('bounced', 'unsubscribed') AND sent_at > now() - interval '30 days';

-- RLS (admin-only via supabaseServer, but enable for safety)
ALTER TABLE outreach_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff full access on outreach_emails" ON outreach_emails
  FOR ALL USING (
    EXISTS (SELECT 1 FROM staff_users WHERE staff_users.user_id = auth.uid())
  );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_outreach_emails_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_outreach_emails_updated_at
  BEFORE UPDATE ON outreach_emails
  FOR EACH ROW EXECUTE FUNCTION set_outreach_emails_updated_at();

-- 3. Unsubscribe tracking on sales_leads
ALTER TABLE sales_leads
  ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ;
