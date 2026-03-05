-- Migration: Add experience_comment_likes table
-- Allows users to like individual comments on experience posts.
-- Run this in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS experience_comment_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES experience_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One like per user per comment
CREATE UNIQUE INDEX IF NOT EXISTS idx_experience_comment_likes_unique
  ON experience_comment_likes(comment_id, user_id);

-- Fast lookup: all likes for a comment
CREATE INDEX IF NOT EXISTS idx_experience_comment_likes_comment_id
  ON experience_comment_likes(comment_id);

-- Fast lookup: all comment likes by a user
CREATE INDEX IF NOT EXISTS idx_experience_comment_likes_user_id
  ON experience_comment_likes(user_id);

-- RLS
ALTER TABLE experience_comment_likes ENABLE ROW LEVEL SECURITY;

-- Anyone can read comment likes (public counts)
CREATE POLICY "Anyone can read comment likes" ON experience_comment_likes
  FOR SELECT USING (true);

-- Users can insert their own likes
CREATE POLICY "Users can insert own comment likes" ON experience_comment_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own likes
CREATE POLICY "Users can delete own comment likes" ON experience_comment_likes
  FOR DELETE USING (auth.uid() = user_id);
