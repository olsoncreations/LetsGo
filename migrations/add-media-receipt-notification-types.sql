-- Add 'media_approved', 'media_rejected', 'receipt_submitted' to the
-- user_notifications type CHECK constraint.
-- These enable notifications for:
--   media_approved     — user's UGC photo/video approved by business
--   media_rejected     — user's UGC photo/video rejected by business
--   receipt_submitted  — business owner notified when user submits a receipt

ALTER TABLE user_notifications
  DROP CONSTRAINT IF EXISTS user_notifications_type_check;

ALTER TABLE user_notifications
  ADD CONSTRAINT user_notifications_type_check
  CHECK (type IN (
    'receipt_approved',
    'receipt_rejected',
    'payout_processed',
    'tier_level_up',
    'new_message',
    'friend_request',
    'friend_accepted',
    'game_invite',
    'game_advanced',
    'game_complete',
    'group_round_ended',
    'datenight_ready',
    'new_event',
    'media_approved',
    'media_rejected',
    'receipt_submitted'
  ));
