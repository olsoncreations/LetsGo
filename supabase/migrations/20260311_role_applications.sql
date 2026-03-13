-- Migration: Create role_applications table
-- For Sales Rep and Influencer application flows

CREATE TABLE IF NOT EXISTS role_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  application_type TEXT NOT NULL CHECK (application_type IN ('sales_rep', 'influencer')),
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'approved', 'rejected')),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  city TEXT,
  state TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  review_message TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One pending application per user per type (allows reapply after rejection)
CREATE UNIQUE INDEX IF NOT EXISTS uq_role_applications_pending
  ON role_applications (user_id, application_type) WHERE status = 'submitted';

-- RLS
ALTER TABLE role_applications ENABLE ROW LEVEL SECURITY;

-- Users can read their own applications
CREATE POLICY "Users can read own applications" ON role_applications
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own applications
CREATE POLICY "Users can insert own applications" ON role_applications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Staff can do everything
CREATE POLICY "Staff full access" ON role_applications
  FOR ALL USING (
    EXISTS (SELECT 1 FROM staff_users WHERE staff_users.user_id = auth.uid())
  );

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION set_role_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_role_applications_updated_at
  BEFORE UPDATE ON role_applications
  FOR EACH ROW EXECUTE FUNCTION set_role_applications_updated_at();
