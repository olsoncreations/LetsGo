-- Migration: Create experience_comments table
-- Stores user comments on experience posts.
-- Run this in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS experience_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experience_id uuid NOT NULL REFERENCES user_experience_media(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(trim(body)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Comments per post (feed display, ordered by time)
CREATE INDEX IF NOT EXISTS idx_experience_comments_experience_id
  ON experience_comments(experience_id, created_at ASC);

-- Comments by user (future profile page use)
CREATE INDEX IF NOT EXISTS idx_experience_comments_user_id
  ON experience_comments(user_id);

-- RLS
ALTER TABLE experience_comments ENABLE ROW LEVEL SECURITY;

-- Anyone can read comments (public)
CREATE POLICY "Anyone can read experience comments" ON experience_comments
  FOR SELECT USING (true);

-- Authenticated users can insert their own comments
CREATE POLICY "Users can insert own comments" ON experience_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own comments
CREATE POLICY "Users can delete own comments" ON experience_comments
  FOR DELETE USING (auth.uid() = user_id);
