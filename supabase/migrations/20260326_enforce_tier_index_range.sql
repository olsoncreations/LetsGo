-- Fix 0-based tier_index values to 1-based, then enforce the constraint.
-- Some businesses may have tiers written as 0-6 instead of 1-7.
-- This migration normalizes all existing data before adding the CHECK.

-- Step 1: Shift any 0-based tier_index values to 1-based
-- Only affects rows where the minimum tier_index for that business is 0
UPDATE business_payout_tiers
SET tier_index = tier_index + 1
WHERE business_id IN (
  SELECT DISTINCT business_id
  FROM business_payout_tiers
  WHERE tier_index = 0
);

-- Step 2: Also update any receipts that stored 0-based payout_tier_index
UPDATE receipts
SET payout_tier_index = payout_tier_index + 1
WHERE payout_tier_index = 0;

-- Step 3: Enforce the constraint going forward
ALTER TABLE business_payout_tiers
  DROP CONSTRAINT IF EXISTS business_payout_tiers_tier_index_range,
  ADD CONSTRAINT business_payout_tiers_tier_index_range
    CHECK (tier_index BETWEEN 1 AND 7);
