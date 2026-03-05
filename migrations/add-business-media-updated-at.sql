-- Migration: Add updated_at column to business_media
-- Required by existing trigger that sets updated_at on UPDATE.
-- Without this column, ALL updates to business_media fail with:
--   "record \"new\" has no field \"updated_at\""
--
-- Run this in the Supabase SQL Editor.

ALTER TABLE business_media
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
