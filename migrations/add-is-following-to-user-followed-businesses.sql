-- Migration: Add is_following flag to user_followed_businesses
-- Separates "Save" (bookmark) from "Follow" (event notifications).
-- Every row = saved. is_following = true means also subscribed to updates.
-- Run this in the Supabase SQL Editor.

-- Add the column
ALTER TABLE user_followed_businesses
  ADD COLUMN IF NOT EXISTS is_following boolean NOT NULL DEFAULT false;

-- Backfill: all existing rows were created via "Follow" button, so mark as following
UPDATE user_followed_businesses SET is_following = true WHERE is_following = false;

-- Partial index for notification queries (find followers of a specific business)
CREATE INDEX IF NOT EXISTS idx_ufb_following_business
  ON user_followed_businesses(business_id) WHERE is_following = true;

-- Users need UPDATE permission to toggle the is_following flag
CREATE POLICY "Users can update own follows" ON user_followed_businesses
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
