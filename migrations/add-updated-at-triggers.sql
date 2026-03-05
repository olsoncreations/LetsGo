-- Migration: Auto-update updated_at timestamp on row changes
-- Shared trigger function for user_friends and game_sessions

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_friends_updated_at
  BEFORE UPDATE ON user_friends
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_game_sessions_updated_at
  BEFORE UPDATE ON game_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
