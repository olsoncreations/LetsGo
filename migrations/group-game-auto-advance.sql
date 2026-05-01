-- Migration: auto-advance + auto-cancel + reinstate for group_games
--
-- Adds three columns the cron tick + reinstate flow need:
--   - selection_reminders_sent: how many reminder cycles have fired during
--     the current selection phase. Caps at 3 to keep nudges from spamming.
--     Reset to 0 on reinstate or when status moves out of 'selection'.
--   - cancelled_at: timestamp the game was cancelled (manual or auto).
--     Used to enforce the 14-day reinstate window.
--   - auto_cancelled: flag distinguishing cron auto-cancels from manual
--     GM cancels. Only auto_cancelled games are eligible for Reinstate.
--
-- Idempotent: safe to run multiple times.

ALTER TABLE group_games
  ADD COLUMN IF NOT EXISTS selection_reminders_sent integer NOT NULL DEFAULT 0;

ALTER TABLE group_games
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

ALTER TABLE group_games
  ADD COLUMN IF NOT EXISTS auto_cancelled boolean NOT NULL DEFAULT false;

-- Backfill cancelled_at for existing cancelled games so the 14-day window
-- has a sensible starting point (uses updated_at as best-available proxy).
UPDATE group_games
   SET cancelled_at = COALESCE(cancelled_at, updated_at)
 WHERE status = 'cancelled' AND cancelled_at IS NULL;

-- Index on round_end_time so the cron's overdue scan stays fast.
CREATE INDEX IF NOT EXISTS idx_group_games_round_end_status
  ON group_games (round_end_time, status)
  WHERE status IN ('selection', 'voting');
