-- Migration: Create game_sessions table for 5v3v1 (and future game modes)
-- Supports real-time multiplayer via Supabase Realtime

CREATE TABLE IF NOT EXISTS game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_code TEXT NOT NULL UNIQUE,
  game_type TEXT NOT NULL DEFAULT '5v3v1'
    CHECK (game_type IN ('5v3v1', 'group', 'datenight')),
  player1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player2_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'pick5', 'pick3', 'pick1', 'complete', 'expired')),
  category TEXT,
  filters JSONB DEFAULT '{}'::jsonb,
  pick5_ids TEXT[] DEFAULT '{}',
  pick3_ids TEXT[] DEFAULT '{}',
  pick1_id TEXT,
  winner_business_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '24 hours')
);

-- Indexes
CREATE INDEX idx_game_sessions_code ON game_sessions (game_code);
CREATE INDEX idx_game_sessions_player1 ON game_sessions (player1_id, status);
CREATE INDEX idx_game_sessions_player2 ON game_sessions (player2_id, status);
CREATE INDEX idx_game_sessions_expires ON game_sessions (expires_at)
  WHERE status NOT IN ('complete', 'expired');

-- Enable RLS
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;

-- Both players can read their own games
CREATE POLICY "Players can view own games"
  ON game_sessions FOR SELECT
  TO authenticated
  USING (
    auth.uid() = player1_id
    OR auth.uid() = player2_id
  );

-- Any authenticated user can read a pending game (for joining by code)
CREATE POLICY "Users can view pending games to join"
  ON game_sessions FOR SELECT
  TO authenticated
  USING (player2_id IS NULL AND status = 'pending');

-- Authenticated users can create games (must be player1)
CREATE POLICY "Users can create games"
  ON game_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = player1_id);

-- Both players can update their own games
CREATE POLICY "Players can update own games"
  ON game_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = player1_id OR auth.uid() = player2_id)
  WITH CHECK (auth.uid() = player1_id OR auth.uid() = player2_id);

-- Enable Realtime on this table for live game sync
-- Note: If this fails, enable via Supabase Dashboard > Database > Replication
ALTER PUBLICATION supabase_realtime ADD TABLE game_sessions;
