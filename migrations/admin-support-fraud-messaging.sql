-- Migration: Add missing columns to conversations and support_tickets
-- Required for admin Support, Fraud Center, and Messaging pages
-- Run this in Supabase SQL Editor

-- ============================================================
-- 1. CONVERSATIONS — add state tracking + performance columns
-- ============================================================
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS participant_id uuid REFERENCES auth.users(id);
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS business_id text;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS closed_at timestamptz;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS closed_by uuid REFERENCES auth.users(id);
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message text;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message_at timestamptz;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS unread_count integer NOT NULL DEFAULT 0;

-- Index for listing conversations sorted by recent activity
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_participant ON conversations(participant_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);

-- ============================================================
-- 2. SUPPORT_TICKETS — add resolution notes
-- ============================================================
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS resolution_notes text;

-- ============================================================
-- 3. RLS POLICIES (tables already have RLS enabled)
-- ============================================================

-- Conversations: staff can read/write all, participants can read their own
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conversations' AND policyname = 'Staff full access to conversations') THEN
    CREATE POLICY "Staff full access to conversations" ON conversations
      FOR ALL USING (
        auth.uid() IN (SELECT user_id FROM staff_users)
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conversations' AND policyname = 'Participants can view own conversations') THEN
    CREATE POLICY "Participants can view own conversations" ON conversations
      FOR SELECT USING (
        auth.uid() = participant_id OR auth.uid() = created_by
      );
  END IF;
END $$;

-- Messages: staff can read/write all, conversation participants can read their own
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'Staff full access to messages') THEN
    CREATE POLICY "Staff full access to messages" ON messages
      FOR ALL USING (
        auth.uid() IN (SELECT user_id FROM staff_users)
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'Participants can view own messages') THEN
    CREATE POLICY "Participants can view own messages" ON messages
      FOR SELECT USING (
        conversation_id IN (
          SELECT id FROM conversations
          WHERE participant_id = auth.uid() OR created_by = auth.uid()
        )
      );
  END IF;
END $$;

-- Support tickets: staff can read/write all, users can view their own
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'support_tickets' AND policyname = 'Staff full access to support tickets') THEN
    CREATE POLICY "Staff full access to support tickets" ON support_tickets
      FOR ALL USING (
        auth.uid() IN (SELECT user_id FROM staff_users)
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'support_tickets' AND policyname = 'Users can view own tickets') THEN
    CREATE POLICY "Users can view own tickets" ON support_tickets
      FOR SELECT USING (
        auth.uid() = user_id
      );
  END IF;
END $$;

-- Fraud alerts: staff only
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'fraud_alerts' AND policyname = 'Staff full access to fraud alerts') THEN
    CREATE POLICY "Staff full access to fraud alerts" ON fraud_alerts
      FOR ALL USING (
        auth.uid() IN (SELECT user_id FROM staff_users)
      );
  END IF;
END $$;
