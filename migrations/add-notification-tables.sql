-- ============================================================
-- Migration: User Notification System
-- Tables: user_notifications, user_notification_preferences, push_subscriptions
-- ============================================================

-- 1) user_notifications — stores all in-app / email / push notifications
CREATE TABLE IF NOT EXISTS user_notifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type          text NOT NULL CHECK (type IN (
    'receipt_approved', 'receipt_rejected', 'payout_processed', 'tier_level_up',
    'new_message',
    'friend_request', 'friend_accepted',
    'game_invite', 'game_advanced', 'game_complete',
    'group_round_ended', 'datenight_ready'
  )),
  title         text NOT NULL,
  body          text NOT NULL,
  metadata      jsonb NOT NULL DEFAULT '{}',
  read          boolean NOT NULL DEFAULT false,
  read_at       timestamptz,
  email_sent    boolean NOT NULL DEFAULT false,
  push_sent     boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id
  ON user_notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_unread
  ON user_notifications(user_id) WHERE read = false;

CREATE INDEX IF NOT EXISTS idx_user_notifications_created
  ON user_notifications(created_at DESC);

-- RLS
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON user_notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON user_notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Staff full access
CREATE POLICY "Staff full access to notifications"
  ON user_notifications FOR ALL
  USING (
    EXISTS (SELECT 1 FROM staff_users WHERE user_id = auth.uid())
  );

-- Enable Supabase Realtime on this table (critical for instant in-app delivery)
ALTER PUBLICATION supabase_realtime ADD TABLE user_notifications;


-- 2) user_notification_preferences — per-type per-channel toggles
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type   text NOT NULL,
  in_app              boolean NOT NULL DEFAULT true,
  email               boolean NOT NULL DEFAULT true,
  push                boolean NOT NULL DEFAULT true,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, notification_type)
);

CREATE INDEX IF NOT EXISTS idx_user_notif_prefs_user
  ON user_notification_preferences(user_id);

-- RLS
ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences"
  ON user_notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON user_notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON user_notification_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Staff full access
CREATE POLICY "Staff full access to notification preferences"
  ON user_notification_preferences FOR ALL
  USING (
    EXISTS (SELECT 1 FROM staff_users WHERE user_id = auth.uid())
  );


-- 3) push_subscriptions — Web Push subscription storage
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint      text NOT NULL,
  p256dh        text NOT NULL,
  auth_key      text NOT NULL,
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user
  ON push_subscriptions(user_id);

-- RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own push subscriptions"
  ON push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own push subscriptions"
  ON push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own push subscriptions"
  ON push_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

-- Staff full access
CREATE POLICY "Staff full access to push subscriptions"
  ON push_subscriptions FOR ALL
  USING (
    EXISTS (SELECT 1 FROM staff_users WHERE user_id = auth.uid())
  );
