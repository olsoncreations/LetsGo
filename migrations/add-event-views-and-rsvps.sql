-- Migration: Add event_views and event_rsvps tables
-- Tracks how many users saw each event + their Yes/Maybe/No responses.
-- Run this in the Supabase SQL Editor.

-- 1) Event Views — one row per user per event (deduplicated impressions)
CREATE TABLE IF NOT EXISTS event_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES business_events(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  viewed_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast counts per event
CREATE INDEX IF NOT EXISTS idx_event_views_event_id ON event_views(event_id);
-- Index for dedup check (one view per user per event)
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_views_unique_user ON event_views(event_id, user_id) WHERE user_id IS NOT NULL;

-- 2) Event RSVPs — Yes / Maybe / No per user per event
CREATE TABLE IF NOT EXISTS event_rsvps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES business_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  response text NOT NULL CHECK (response IN ('yes', 'maybe', 'no')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One RSVP per user per event (upsert-friendly)
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_rsvps_unique ON event_rsvps(event_id, user_id);
-- Fast counts per event
CREATE INDEX IF NOT EXISTS idx_event_rsvps_event_id ON event_rsvps(event_id);

-- 3) RLS policies
ALTER TABLE event_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;

-- Views: any authenticated user can insert their own view
CREATE POLICY "Users can insert own views" ON event_views
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Views: service role (admin API) can read all
CREATE POLICY "Service role reads all views" ON event_views
  FOR SELECT USING (true);

-- RSVPs: users can manage their own
CREATE POLICY "Users can insert own rsvp" ON event_rsvps
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rsvp" ON event_rsvps
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own rsvp" ON event_rsvps
  FOR SELECT USING (auth.uid() = user_id);

-- Service role (admin API) can read all RSVPs
CREATE POLICY "Service role reads all rsvps" ON event_rsvps
  FOR SELECT USING (true);
