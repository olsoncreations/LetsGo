-- Migration: Add sender_role to messages table
-- Tracks the CONTEXT a message was sent from (staff vs participant).
-- Needed because the same user can be both a business owner and an admin.
-- Run this in the Supabase SQL Editor.

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS sender_role text
  CHECK (sender_role IN ('staff', 'participant'));

-- Backfill existing messages: staff_users senders → 'staff', others → 'participant'
UPDATE messages m
SET sender_role = CASE
  WHEN EXISTS (SELECT 1 FROM staff_users s WHERE s.user_id = m.sender_id)
    THEN 'staff'
  ELSE 'participant'
END
WHERE m.sender_role IS NULL;
