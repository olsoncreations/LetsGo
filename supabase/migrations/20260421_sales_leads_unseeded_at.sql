-- Add unseeded_at column to track when a lead was unseeded
-- This preserves the history that a lead was previously seeded and paid for
ALTER TABLE sales_leads ADD COLUMN IF NOT EXISTS unseeded_at timestamptz;
