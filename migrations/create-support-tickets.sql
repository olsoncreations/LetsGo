-- Migration: Create support_tickets table + add photos/videos columns to business
-- Run this in Supabase SQL Editor.

-- ============================================================
-- PART 1: Add photos and videos JSONB columns to business table
-- These are used by the Admin Businesses tab to display media.
-- ============================================================
ALTER TABLE business ADD COLUMN IF NOT EXISTS photos jsonb DEFAULT '[]'::jsonb;
ALTER TABLE business ADD COLUMN IF NOT EXISTS videos jsonb DEFAULT '[]'::jsonb;

-- ============================================================
-- PART 2: Create support_tickets table
-- ============================================================

CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  business_id text REFERENCES business(id),
  subject text NOT NULL,
  body text NOT NULL,
  category text NOT NULL DEFAULT 'general'
    CHECK (category IN ('payout', 'receipt', 'account', 'billing', 'general')),
  priority text NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('urgent', 'high', 'medium', 'low')),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'escalated', 'resolved', 'waiting')),
  assigned_to uuid REFERENCES auth.users(id),
  resolved_by uuid REFERENCES auth.users(id),
  resolved_at timestamptz,
  resolution_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- RLS: Service role bypasses RLS, so API route inserts will work.
-- Staff can read/update all tickets.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'support_tickets' AND policyname = 'Staff full access to support tickets') THEN
    CREATE POLICY "Staff full access to support tickets" ON support_tickets
      FOR ALL
      USING (auth.uid() IN (SELECT user_id FROM staff_users))
      WITH CHECK (auth.uid() IN (SELECT user_id FROM staff_users));
  END IF;
END $$;

-- Users can view their own tickets
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'support_tickets' AND policyname = 'Users can view own tickets') THEN
    CREATE POLICY "Users can view own tickets" ON support_tickets
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Users can create their own tickets
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'support_tickets' AND policyname = 'Users can create own tickets') THEN
    CREATE POLICY "Users can create own tickets" ON support_tickets
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
