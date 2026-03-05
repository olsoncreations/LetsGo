-- Migration: Add 'business_approved' to receipts.status allowed values
-- This supports the two-step approval flow:
--   pending → business_approved (business approves) → approved (admin final approval)
--
-- Run this in the Supabase SQL Editor.

-- Step 1: Drop existing CHECK constraint on receipts.status (if it exists)
-- Find and drop any constraint that restricts the status column
DO $$
DECLARE
  constraint_name text;
BEGIN
  -- Find CHECK constraints on the receipts table that reference the status column
  SELECT c.conname INTO constraint_name
  FROM pg_constraint c
  JOIN pg_class r ON c.conrelid = r.oid
  WHERE r.relname = 'receipts'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%status%'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE receipts DROP CONSTRAINT %I', constraint_name);
    RAISE NOTICE 'Dropped constraint: %', constraint_name;
  ELSE
    RAISE NOTICE 'No CHECK constraint found on receipts.status';
  END IF;
END $$;

-- Step 2: Normalize existing status values to lowercase
-- Old code may have written PascalCase values ("Approved", "Pending", "Rejected")
UPDATE receipts SET status = lower(status) WHERE status IS DISTINCT FROM lower(status);

-- Step 3: Add new CHECK constraint with business_approved included
ALTER TABLE receipts
  ADD CONSTRAINT receipts_status_check
  CHECK (status IN ('pending', 'business_approved', 'approved', 'rejected', 'disputed'));

-- Verify
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'receipts'::regclass
  AND contype = 'c'
  AND pg_get_constraintdef(oid) ILIKE '%status%';
