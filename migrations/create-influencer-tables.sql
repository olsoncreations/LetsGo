-- =====================================================
-- INFLUENCER MANAGEMENT SYSTEM
-- =====================================================
-- Creates tables for tracking influencers, their signups, and payouts
-- Run this in Supabase SQL Editor
-- =====================================================

-- =====================================================
-- TABLE 1: influencers
-- =====================================================
CREATE TABLE IF NOT EXISTS influencers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  email TEXT,
  phone TEXT,

  -- Address information
  address_street TEXT,
  address_city TEXT,
  address_state TEXT,
  address_zip TEXT,
  address_country TEXT DEFAULT 'USA',

  -- Social media handles
  instagram_handle TEXT,
  tiktok_handle TEXT,
  youtube_handle TEXT,
  twitter_handle TEXT,

  -- Payment information
  payment_method TEXT, -- bank_transfer, paypal, venmo, zelle, check
  payment_details TEXT, -- Account info, PayPal email, etc. (encrypted in production)
  tax_id TEXT, -- SSN/EIN for tax purposes (encrypted in production)

  -- Rate and performance
  rate_per_thousand_cents INTEGER NOT NULL DEFAULT 5000, -- $50 per 1,000 signups default
  total_signups INTEGER NOT NULL DEFAULT 0,
  total_paid_cents INTEGER NOT NULL DEFAULT 0,

  -- Performance tier (auto-assigned: bronze/silver/gold/platinum)
  tier TEXT NOT NULL DEFAULT 'bronze',

  -- FTC Compliance
  ftc_agreed BOOLEAN NOT NULL DEFAULT FALSE,
  ftc_agreed_at TIMESTAMP WITH TIME ZONE,

  -- Link click tracking
  total_clicks INTEGER NOT NULL DEFAULT 0,

  -- Status and metadata
  status TEXT NOT NULL DEFAULT 'active', -- active, paused, suspended
  notes TEXT, -- Admin notes about rate changes, performance, etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast code lookups during signup
CREATE INDEX IF NOT EXISTS idx_influencers_code ON influencers(code);
CREATE INDEX IF NOT EXISTS idx_influencers_status ON influencers(status);

-- =====================================================
-- TABLE 2: influencer_signups
-- =====================================================
CREATE TABLE IF NOT EXISTS influencer_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_influencer_signups_influencer ON influencer_signups(influencer_id);
CREATE INDEX IF NOT EXISTS idx_influencer_signups_user ON influencer_signups(user_id);
CREATE INDEX IF NOT EXISTS idx_influencer_signups_created ON influencer_signups(created_at);

-- Prevent duplicate signups from same user to same influencer
CREATE UNIQUE INDEX IF NOT EXISTS idx_influencer_signups_unique ON influencer_signups(influencer_id, user_id);

-- =====================================================
-- TABLE 3: influencer_payouts
-- =====================================================
CREATE TABLE IF NOT EXISTS influencer_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  signups_count INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  rate_per_thousand_cents INTEGER NOT NULL, -- Store rate at time of payout
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  paid BOOLEAN NOT NULL DEFAULT FALSE,
  paid_at TIMESTAMP WITH TIME ZONE,
  notes TEXT, -- Notes about this specific payout
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_influencer_payouts_influencer ON influencer_payouts(influencer_id);
CREATE INDEX IF NOT EXISTS idx_influencer_payouts_paid ON influencer_payouts(paid);
CREATE INDEX IF NOT EXISTS idx_influencer_payouts_created ON influencer_payouts(created_at);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE influencers ENABLE ROW LEVEL SECURITY;
ALTER TABLE influencer_signups ENABLE ROW LEVEL SECURITY;
ALTER TABLE influencer_payouts ENABLE ROW LEVEL SECURITY;

-- Admin-only access (staff_users table)
-- For influencers table
DROP POLICY IF EXISTS "Admin full access to influencers" ON influencers;
CREATE POLICY "Admin full access to influencers"
  ON influencers
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM staff_users
      WHERE staff_users.user_id = auth.uid()
    )
  );

-- For influencer_signups table
DROP POLICY IF EXISTS "Admin full access to influencer_signups" ON influencer_signups;
CREATE POLICY "Admin full access to influencer_signups"
  ON influencer_signups
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM staff_users
      WHERE staff_users.user_id = auth.uid()
    )
  );

-- For influencer_payouts table
DROP POLICY IF EXISTS "Admin full access to influencer_payouts" ON influencer_payouts;
CREATE POLICY "Admin full access to influencer_payouts"
  ON influencer_payouts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM staff_users
      WHERE staff_users.user_id = auth.uid()
    )
  );

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to update influencer signup count
CREATE OR REPLACE FUNCTION update_influencer_signup_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Increment total_signups for the influencer
  UPDATE influencers
  SET total_signups = total_signups + 1,
      updated_at = NOW()
  WHERE id = NEW.influencer_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically update signup count
DROP TRIGGER IF EXISTS trigger_update_influencer_signup_count ON influencer_signups;
CREATE TRIGGER trigger_update_influencer_signup_count
  AFTER INSERT ON influencer_signups
  FOR EACH ROW
  EXECUTE FUNCTION update_influencer_signup_count();

-- Function to update influencer total_paid when payout is marked as paid
CREATE OR REPLACE FUNCTION update_influencer_total_paid()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if payout was just marked as paid
  IF NEW.paid = TRUE AND (OLD.paid IS NULL OR OLD.paid = FALSE) THEN
    UPDATE influencers
    SET total_paid_cents = total_paid_cents + NEW.amount_cents,
        updated_at = NOW()
    WHERE id = NEW.influencer_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically update total_paid
DROP TRIGGER IF EXISTS trigger_update_influencer_total_paid ON influencer_payouts;
CREATE TRIGGER trigger_update_influencer_total_paid
  AFTER UPDATE ON influencer_payouts
  FOR EACH ROW
  EXECUTE FUNCTION update_influencer_total_paid();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for influencers table
DROP TRIGGER IF EXISTS trigger_influencers_updated_at ON influencers;
CREATE TRIGGER trigger_influencers_updated_at
  BEFORE UPDATE ON influencers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TABLE 4: influencer_clicks (link tracking)
-- =====================================================
CREATE TABLE IF NOT EXISTS influencer_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  ip_address TEXT, -- Store hashed in production
  user_agent TEXT,
  referrer TEXT,
  converted BOOLEAN NOT NULL DEFAULT FALSE, -- Did this click result in a signup?
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_influencer_clicks_influencer ON influencer_clicks(influencer_id);
CREATE INDEX IF NOT EXISTS idx_influencer_clicks_created ON influencer_clicks(created_at);

ALTER TABLE influencer_clicks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access to influencer_clicks" ON influencer_clicks;
CREATE POLICY "Admin full access to influencer_clicks"
  ON influencer_clicks FOR ALL
  USING (EXISTS (SELECT 1 FROM staff_users WHERE staff_users.user_id = auth.uid()));

-- Auto-increment total_clicks on influencers
CREATE OR REPLACE FUNCTION update_influencer_click_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE influencers SET total_clicks = total_clicks + 1, updated_at = NOW() WHERE id = NEW.influencer_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_influencer_click_count ON influencer_clicks;
CREATE TRIGGER trigger_influencer_click_count
  AFTER INSERT ON influencer_clicks FOR EACH ROW
  EXECUTE FUNCTION update_influencer_click_count();

-- =====================================================
-- TABLE 5: influencer_bonuses
-- =====================================================
CREATE TABLE IF NOT EXISTS influencer_bonuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  label TEXT NOT NULL,              -- e.g. "January Contest Winner"
  amount_cents INTEGER NOT NULL,
  bonus_type TEXT NOT NULL DEFAULT 'milestone', -- milestone, contest, one_time, performance
  milestone_signups INTEGER,        -- If milestone type: trigger at this count
  paid BOOLEAN NOT NULL DEFAULT FALSE,
  paid_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_influencer_bonuses_influencer ON influencer_bonuses(influencer_id);
CREATE INDEX IF NOT EXISTS idx_influencer_bonuses_paid ON influencer_bonuses(paid);

ALTER TABLE influencer_bonuses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access to influencer_bonuses" ON influencer_bonuses;
CREATE POLICY "Admin full access to influencer_bonuses"
  ON influencer_bonuses FOR ALL
  USING (EXISTS (SELECT 1 FROM staff_users WHERE staff_users.user_id = auth.uid()));

-- =====================================================
-- TABLE 6: influencer_contracts
-- =====================================================
CREATE TABLE IF NOT EXISTS influencer_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  label TEXT NOT NULL,              -- e.g. "2026 Partnership Agreement"
  storage_path TEXT,                -- Supabase Storage path to PDF
  file_name TEXT,
  contract_start DATE,
  contract_end DATE,                -- NULL = no expiry
  status TEXT NOT NULL DEFAULT 'active', -- active, expired, terminated
  signed_by_influencer BOOLEAN NOT NULL DEFAULT FALSE,
  signed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_influencer_contracts_influencer ON influencer_contracts(influencer_id);
CREATE INDEX IF NOT EXISTS idx_influencer_contracts_status ON influencer_contracts(status);

ALTER TABLE influencer_contracts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access to influencer_contracts" ON influencer_contracts;
CREATE POLICY "Admin full access to influencer_contracts"
  ON influencer_contracts FOR ALL
  USING (EXISTS (SELECT 1 FROM staff_users WHERE staff_users.user_id = auth.uid()));

-- =====================================================
-- FUNCTION: Auto-assign tier based on total_signups
-- Call this after updating total_signups
-- =====================================================
CREATE OR REPLACE FUNCTION assign_influencer_tier()
RETURNS TRIGGER AS $$
BEGIN
  NEW.tier := CASE
    WHEN NEW.total_signups >= 500000 THEN 'icon'
    WHEN NEW.total_signups >= 350000 THEN 'legend'
    WHEN NEW.total_signups >= 250000 THEN 'elite'
    WHEN NEW.total_signups >= 150000 THEN 'obsidian'
    WHEN NEW.total_signups >= 100000 THEN 'diamond'
    WHEN NEW.total_signups >= 75000  THEN 'amethyst'
    WHEN NEW.total_signups >= 50000  THEN 'ruby'
    WHEN NEW.total_signups >= 35000  THEN 'emerald'
    WHEN NEW.total_signups >= 20000  THEN 'sapphire'
    WHEN NEW.total_signups >= 10000  THEN 'platinum'
    WHEN NEW.total_signups >= 5000   THEN 'gold'
    WHEN NEW.total_signups >= 2500   THEN 'silver'
    WHEN NEW.total_signups >= 1000   THEN 'bronze'
    WHEN NEW.total_signups >= 250    THEN 'sprout'
    ELSE 'seed'
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_assign_influencer_tier ON influencers;
CREATE TRIGGER trigger_assign_influencer_tier
  BEFORE UPDATE ON influencers FOR EACH ROW
  EXECUTE FUNCTION assign_influencer_tier();

-- =====================================================
-- SAMPLE DATA (Optional - for testing)
-- =====================================================

-- Uncomment to insert sample influencers
/*
INSERT INTO influencers (name, code, email, rate_per_thousand_cents, status, notes)
VALUES
  ('Sarah Johnson', 'SARAH2026', 'sarah@example.com', 7500, 'active', 'Top performer - increased rate from $50 to $75 on 2026-01-15'),
  ('Marcus Williams', 'MARCUS10', 'marcus@example.com', 5000, 'active', 'Standard rate'),
  ('Emily Chen', 'EMILYC', 'emily@example.com', 10000, 'active', 'Premium influencer - special rate of $100/1K'),
  ('David Rodriguez', 'DAVIDR', 'david@example.com', 5000, 'paused', 'Paused temporarily - on vacation'),
  ('Jessica Taylor', 'JESS2026', 'jessica@example.com', 6000, 'active', 'Rate increased to $60 on 2026-02-01 for consistent performance');
*/

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check tables were created
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('influencers', 'influencer_signups', 'influencer_payouts');

-- Check RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('influencers', 'influencer_signups', 'influencer_payouts');

-- View all policies
SELECT tablename, policyname FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('influencers', 'influencer_signups', 'influencer_payouts');
