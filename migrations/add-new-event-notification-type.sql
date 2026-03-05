-- Add 'new_event' to the user_notifications type CHECK constraint
-- This allows the new notification type for "business you follow posted an event"

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
    'new_event'
  ));
