-- Migration: Add caption and tags columns to user_experience_media
-- Allows users to add text captions and hashtags when posting experiences.
-- Run this in the Supabase SQL Editor BEFORE the other experience migrations.

ALTER TABLE user_experience_media
  ADD COLUMN IF NOT EXISTS caption text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- Index on tags for future tag-based feed filtering
CREATE INDEX IF NOT EXISTS idx_uem_tags
  ON user_experience_media USING GIN (tags);

-- Partial index for feed queries: approved + active posts, newest first
CREATE INDEX IF NOT EXISTS idx_uem_feed
  ON user_experience_media (created_at DESC)
  WHERE status = 'approved' AND is_active = true;
