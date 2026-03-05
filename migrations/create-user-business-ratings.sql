-- Migration: Add user_business_ratings table
-- Stores star ratings + private notes per user/business pair.
-- Also adds aggregate columns to business table for anonymous rating display.
-- Run this in the Supabase SQL Editor.

-- ═══════════════════════════════════════════════════
-- 1. Ratings table
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_business_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id text NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  stars smallint NOT NULL CHECK (stars >= 1 AND stars <= 5),
  would_go_again boolean NOT NULL DEFAULT true,
  private_note text DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One rating per user per business (upsert pattern)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ubr_unique
  ON user_business_ratings(user_id, business_id);

-- Fast lookup: all ratings for a user (profile page)
CREATE INDEX IF NOT EXISTS idx_ubr_user
  ON user_business_ratings(user_id);

-- Fast lookup: all ratings for a business (aggregate computation)
CREATE INDEX IF NOT EXISTS idx_ubr_business
  ON user_business_ratings(business_id);

-- ═══════════════════════════════════════════════════
-- 2. RLS policies
-- ═══════════════════════════════════════════════════

ALTER TABLE user_business_ratings ENABLE ROW LEVEL SECURITY;

-- Users can only see their own ratings (protects anonymity)
CREATE POLICY "Users read own ratings" ON user_business_ratings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own ratings" ON user_business_ratings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own ratings" ON user_business_ratings
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own ratings" ON user_business_ratings
  FOR DELETE USING (auth.uid() = user_id);

-- Service role (server API routes) can read all for aggregate computation
CREATE POLICY "Service role reads all ratings" ON user_business_ratings
  FOR SELECT USING (true);

-- ═══════════════════════════════════════════════════
-- 3. Auto-update updated_at trigger
-- ═══════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_ubr_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ubr_updated_at
  BEFORE UPDATE ON user_business_ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_ubr_updated_at();

-- ═══════════════════════════════════════════════════
-- 4. Aggregate columns on business table
-- avg_rating: stored as x10 integer (42 = 4.2 stars) to avoid floats
-- rating_count: total number of ratings
-- ═══════════════════════════════════════════════════

ALTER TABLE business ADD COLUMN IF NOT EXISTS avg_rating smallint DEFAULT 0;
ALTER TABLE business ADD COLUMN IF NOT EXISTS rating_count integer DEFAULT 0;
