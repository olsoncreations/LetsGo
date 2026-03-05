-- Migration: Add user_activity table for real-time active user tracking
-- Each authenticated user gets one row, upserted on heartbeat (every 5 min)

CREATE TABLE IF NOT EXISTS user_activity (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast "users online in last N minutes" counts
CREATE INDEX idx_user_activity_last_seen ON user_activity (last_seen_at DESC);

-- Enable RLS
ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all rows (needed for admin count queries via anon key)
CREATE POLICY "Authenticated users can read user_activity"
  ON user_activity FOR SELECT
  TO authenticated
  USING (true);

-- Users can only insert/update their own row
CREATE POLICY "Users can upsert their own activity"
  ON user_activity FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own activity"
  ON user_activity FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Staff/service role can manage all rows (implicit via service role bypassing RLS)
