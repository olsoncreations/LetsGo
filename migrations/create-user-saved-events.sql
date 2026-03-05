-- Migration: Add user_saved_events table
-- Stores bookmarked/saved events per user.
-- Run this in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS user_saved_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES business_events(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One save per user per event
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_saved_events_unique
  ON user_saved_events(user_id, event_id);

-- Fast lookup: all saves for a user
CREATE INDEX IF NOT EXISTS idx_user_saved_events_user_id
  ON user_saved_events(user_id);

-- Fast lookup: all saves for an event
CREATE INDEX IF NOT EXISTS idx_user_saved_events_event_id
  ON user_saved_events(event_id);

-- RLS
ALTER TABLE user_saved_events ENABLE ROW LEVEL SECURITY;

-- Users can manage their own saved events
CREATE POLICY "Users can insert own saves" ON user_saved_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own saves" ON user_saved_events
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can read own saves" ON user_saved_events
  FOR SELECT USING (auth.uid() = user_id);

-- Service role (server API) can read all
CREATE POLICY "Service role reads all saves" ON user_saved_events
  FOR SELECT USING (true);
