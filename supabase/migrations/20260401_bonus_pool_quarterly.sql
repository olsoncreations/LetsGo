-- Convert bonus pool from monthly to quarterly model
-- 1. Add company unlock target + rep eligibility threshold + unlocked flag
-- 2. Old monthly rows (e.g. "Apr 2026") remain for history; new rows use "Q2 2026" format

ALTER TABLE sales_bonus_pool
  ADD COLUMN IF NOT EXISTS company_target_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rep_eligibility_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unlocked boolean NOT NULL DEFAULT false;

-- Seed default config values for bonus thresholds (if not already present)
-- bonus_rep_eligibility: individual commission $ per quarter to qualify (stored as cents)
-- bonus_company_multiplier: % of (active_reps × rep_eligibility) needed to unlock pool (stored as whole %, e.g. 75 = 75%)
INSERT INTO sales_config (category, key, value_cents, value_int)
VALUES
  ('bonus_pool', 'bonus_rep_eligibility', 500000, NULL),
  ('bonus_pool', 'bonus_company_multiplier', NULL, 75)
ON CONFLICT DO NOTHING;
