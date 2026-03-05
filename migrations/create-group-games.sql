-- ═══════════════════════════════════════════════════════════════
-- GROUP VOTE — Database Tables
-- Creates 4 tables for the group voting game feature:
--   1. group_games        — main game record
--   2. group_game_players  — players per game
--   3. group_game_selections — businesses selected in round 1
--   4. group_game_votes    — votes per round per player
--
-- NOTE: All tables are created first, then indexes + RLS + policies,
-- because policies reference tables that must already exist.
-- ═══════════════════════════════════════════════════════════════


-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  STEP 1: CREATE ALL TABLES                                    ║
-- ╚═══════════════════════════════════════════════════════════════╝

-- ── 1. group_games ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS group_games (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_code                   text NOT NULL UNIQUE,
  name                        text NOT NULL DEFAULT '',
  location                    text NOT NULL DEFAULT '',
  created_by                  uuid NOT NULL REFERENCES auth.users(id),
  status                      text NOT NULL DEFAULT 'selection'
                              CHECK (status IN ('selection', 'voting', 'complete', 'cancelled')),
  current_round               integer NOT NULL DEFAULT 1,
  total_rounds                integer NOT NULL DEFAULT 3
                              CHECK (total_rounds BETWEEN 2 AND 5),
  advance_per_round           integer[] NOT NULL DEFAULT '{7,3,1}',
  time_between_rounds_minutes integer NOT NULL DEFAULT 120,
  votes_hidden                boolean NOT NULL DEFAULT false,
  allow_invites               boolean NOT NULL DEFAULT true,
  round_end_time              timestamptz,
  start_date                  date,
  end_date                    date,
  winner_business_ids         text[] DEFAULT '{}',
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  completed_at                timestamptz
);

-- ── 2. group_game_players ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS group_game_players (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id     uuid NOT NULL REFERENCES group_games(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id),
  role        text NOT NULL DEFAULT 'player'
              CHECK (role IN ('game_master', 'player')),
  joined_at   timestamptz NOT NULL DEFAULT now(),
  removed_at  timestamptz,
  UNIQUE(game_id, user_id)
);

-- ── 3. group_game_selections ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS group_game_selections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id     uuid NOT NULL REFERENCES group_games(id) ON DELETE CASCADE,
  business_id text NOT NULL,
  selected_by uuid NOT NULL REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(game_id, business_id, selected_by)
);

-- ── 4. group_game_votes ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS group_game_votes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id     uuid NOT NULL REFERENCES group_games(id) ON DELETE CASCADE,
  round       integer NOT NULL CHECK (round >= 2),
  business_id text NOT NULL,
  voter_id    uuid NOT NULL REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(game_id, round, business_id, voter_id)
);


-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  STEP 2: CREATE INDEXES                                       ║
-- ╚═══════════════════════════════════════════════════════════════╝

-- group_games indexes
CREATE INDEX IF NOT EXISTS idx_group_games_code ON group_games(game_code);
CREATE INDEX IF NOT EXISTS idx_group_games_created_by ON group_games(created_by);
CREATE INDEX IF NOT EXISTS idx_group_games_status ON group_games(status) WHERE status NOT IN ('complete', 'cancelled');

-- group_game_players indexes
CREATE INDEX IF NOT EXISTS idx_ggp_game_id ON group_game_players(game_id);
CREATE INDEX IF NOT EXISTS idx_ggp_user_id ON group_game_players(user_id);

-- group_game_selections indexes
CREATE INDEX IF NOT EXISTS idx_ggs_game_id ON group_game_selections(game_id);
CREATE INDEX IF NOT EXISTS idx_ggs_business_id ON group_game_selections(business_id);

-- group_game_votes indexes
CREATE INDEX IF NOT EXISTS idx_ggv_game_round ON group_game_votes(game_id, round);
CREATE INDEX IF NOT EXISTS idx_ggv_voter ON group_game_votes(voter_id);


-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  STEP 3: ENABLE RLS ON ALL TABLES                             ║
-- ╚═══════════════════════════════════════════════════════════════╝

ALTER TABLE group_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_game_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_game_votes ENABLE ROW LEVEL SECURITY;


-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  STEP 4: RLS POLICIES                                         ║
-- ╚═══════════════════════════════════════════════════════════════╝

-- ── group_games policies ────────────────────────────────────────

-- Players can view games they participate in
CREATE POLICY "group_games_select_players"
  ON group_games FOR SELECT
  USING (
    id IN (SELECT game_id FROM group_game_players WHERE user_id = auth.uid() AND removed_at IS NULL)
  );

-- Creator can update their own games
CREATE POLICY "group_games_update_creator"
  ON group_games FOR UPDATE
  USING (created_by = auth.uid());

-- Authenticated users can create games
CREATE POLICY "group_games_insert_auth"
  ON group_games FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- ── group_game_players policies ─────────────────────────────────

-- Players can see co-players in their games
CREATE POLICY "ggp_select_players"
  ON group_game_players FOR SELECT
  USING (
    game_id IN (SELECT game_id FROM group_game_players WHERE user_id = auth.uid())
  );

-- Authenticated users can insert themselves (for joining)
CREATE POLICY "ggp_insert_self"
  ON group_game_players FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Game master can update (soft-remove players)
CREATE POLICY "ggp_update_gm"
  ON group_game_players FOR UPDATE
  USING (
    game_id IN (
      SELECT game_id FROM group_game_players
      WHERE user_id = auth.uid() AND role = 'game_master'
    )
  );

-- ── group_game_selections policies ──────────────────────────────

-- Players can view selections in their games
CREATE POLICY "ggs_select_players"
  ON group_game_selections FOR SELECT
  USING (
    game_id IN (SELECT game_id FROM group_game_players WHERE user_id = auth.uid())
  );

-- Players can add their own selections
CREATE POLICY "ggs_insert_player"
  ON group_game_selections FOR INSERT
  WITH CHECK (
    auth.uid() = selected_by
    AND game_id IN (SELECT game_id FROM group_game_players WHERE user_id = auth.uid() AND removed_at IS NULL)
  );

-- Players can remove their own selections
CREATE POLICY "ggs_delete_own"
  ON group_game_selections FOR DELETE
  USING (selected_by = auth.uid());

-- ── group_game_votes policies ───────────────────────────────────

-- Players can view votes in their games
CREATE POLICY "ggv_select_players"
  ON group_game_votes FOR SELECT
  USING (
    game_id IN (SELECT game_id FROM group_game_players WHERE user_id = auth.uid())
  );

-- Players can insert their own votes
CREATE POLICY "ggv_insert_player"
  ON group_game_votes FOR INSERT
  WITH CHECK (
    auth.uid() = voter_id
    AND game_id IN (SELECT game_id FROM group_game_players WHERE user_id = auth.uid() AND removed_at IS NULL)
  );

-- Players can delete their own votes (for re-voting)
CREATE POLICY "ggv_delete_own"
  ON group_game_votes FOR DELETE
  USING (voter_id = auth.uid());
