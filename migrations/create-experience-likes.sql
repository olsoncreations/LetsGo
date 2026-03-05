-- Migration: Create experience_likes table
-- Tracks which users have "fire-liked" which experience posts.
-- Run this in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS experience_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experience_id uuid NOT NULL REFERENCES user_experience_media(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One like per user per experience
CREATE UNIQUE INDEX IF NOT EXISTS idx_experience_likes_unique
  ON experience_likes(experience_id, user_id);

-- Count likes per experience (for feed aggregation)
CREATE INDEX IF NOT EXISTS idx_experience_likes_experience_id
  ON experience_likes(experience_id);

-- User's liked posts (for "has current user liked" check)
CREATE INDEX IF NOT EXISTS idx_experience_likes_user_id
  ON experience_likes(user_id);

-- RLS
ALTER TABLE experience_likes ENABLE ROW LEVEL SECURITY;

-- Anyone can read likes (public counts)
CREATE POLICY "Anyone can read experience likes" ON experience_likes
  FOR SELECT USING (true);

-- Users can insert their own likes
CREATE POLICY "Users can insert own likes" ON experience_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own likes (un-like)
CREATE POLICY "Users can delete own likes" ON experience_likes
  FOR DELETE USING (auth.uid() = user_id);
