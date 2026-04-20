-- Business Seeding: Add columns for trial/seeded business management
-- Allows bulk-seeding businesses from sales leads with 0% payouts,
-- visible in discovery feed as "unclaimed" with a QR claim code.

-- 1. Add seeding columns to business table
ALTER TABLE business
  ADD COLUMN IF NOT EXISTS seeded_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS claim_code text;

-- Unique constraint on claim_code (only non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_business_claim_code
  ON business (claim_code) WHERE claim_code IS NOT NULL;

-- Index for trial expiration cron queries
CREATE INDEX IF NOT EXISTS idx_business_trial_expires
  ON business (trial_expires_at) WHERE billing_plan = 'trial' AND is_active = true;

-- 2. Add seeded_at to sales_leads to track which leads have been seeded
ALTER TABLE sales_leads
  ADD COLUMN IF NOT EXISTS seeded_at timestamptz;
