-- Migration: Add admin_status column to business_media
-- Tracks admin moderation state: active, investigating, banned
-- Separate from is_active (soft-delete) so banned media can still appear with overlay
--
-- Run this in the Supabase SQL Editor.

-- Step 1: Add admin_status column with default 'active'
ALTER TABLE business_media
  ADD COLUMN IF NOT EXISTS admin_status text NOT NULL DEFAULT 'active';

-- Step 2: Add CHECK constraint for allowed values
ALTER TABLE business_media
  ADD CONSTRAINT business_media_admin_status_check
  CHECK (admin_status IN ('active', 'investigating', 'banned'));

-- Step 3: Create index for filtering by admin_status
CREATE INDEX IF NOT EXISTS idx_business_media_admin_status
  ON business_media(admin_status);

-- Verify
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'business_media' AND column_name = 'admin_status';
