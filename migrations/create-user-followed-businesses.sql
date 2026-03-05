-- Migration: Add user_followed_businesses table
-- Stores which businesses a user follows for updates.
-- Run this in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS user_followed_businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id text NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One follow per user per business
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_followed_businesses_unique
  ON user_followed_businesses(user_id, business_id);

-- Fast lookup: all follows for a user
CREATE INDEX IF NOT EXISTS idx_user_followed_businesses_user_id
  ON user_followed_businesses(user_id);

-- Fast lookup: all followers for a business
CREATE INDEX IF NOT EXISTS idx_user_followed_businesses_business_id
  ON user_followed_businesses(business_id);

-- RLS
ALTER TABLE user_followed_businesses ENABLE ROW LEVEL SECURITY;

-- Users can manage their own follows
CREATE POLICY "Users can insert own follows" ON user_followed_businesses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own follows" ON user_followed_businesses
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can read own follows" ON user_followed_businesses
  FOR SELECT USING (auth.uid() = user_id);

-- Service role (server API) can read all
CREATE POLICY "Service role reads all follows" ON user_followed_businesses
  FOR SELECT USING (true);
