-- Date Night Generator sessions table
-- Stores each generated date night: user preferences, scored picks, and lock-in status.

CREATE TABLE IF NOT EXISTS date_night_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_vibes       JSONB NOT NULL DEFAULT '[]'::jsonb,
  session_budget      TEXT NOT NULL DEFAULT '$$',
  session_cuisines    JSONB NOT NULL DEFAULT '[]'::jsonb,
  session_location    TEXT NOT NULL DEFAULT '',
  session_time_slot   TEXT NOT NULL DEFAULT 'evening'
                      CHECK (session_time_slot IN ('afternoon', 'evening', 'latenight')),
  restaurant_id       TEXT REFERENCES business(id) ON DELETE SET NULL,
  activity_id         TEXT REFERENCES business(id) ON DELETE SET NULL,
  restaurant_score    INTEGER NOT NULL DEFAULT 0,
  activity_score      INTEGER NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'generated'
                      CHECK (status IN ('generated', 'locked_in', 're-rolled')),
  user_rating         INTEGER CHECK (user_rating IS NULL OR (user_rating >= 1 AND user_rating <= 5)),
  reasoning           JSONB DEFAULT '{}'::jsonb,
  excluded_ids        TEXT[] DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_date_night_sessions_user_created
  ON date_night_sessions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_date_night_sessions_user_status
  ON date_night_sessions (user_id, status);

-- RLS
ALTER TABLE date_night_sessions ENABLE ROW LEVEL SECURITY;

-- Users can read their own sessions
CREATE POLICY "Users can read own date night sessions"
  ON date_night_sessions FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own sessions
CREATE POLICY "Users can create date night sessions"
  ON date_night_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own sessions (lock-in, rating)
CREATE POLICY "Users can update own date night sessions"
  ON date_night_sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role can do everything (for server-side API)
CREATE POLICY "Service role full access to date night sessions"
  ON date_night_sessions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
