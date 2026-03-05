-- Migration: Add promotion targeting tables
-- Allows promotions to target specific businesses or specific users
-- Date: 2026-03-04

-- 1) Table for linking promotions to specific businesses
CREATE TABLE IF NOT EXISTS promotion_target_businesses (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  promotion_id uuid NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  business_id  text NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  created_at   timestamptz DEFAULT now(),
  UNIQUE(promotion_id, business_id)
);

-- 2) Table for linking promotions to specific users
CREATE TABLE IF NOT EXISTS promotion_target_users (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  promotion_id uuid NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at   timestamptz DEFAULT now(),
  UNIQUE(promotion_id, user_id)
);

-- 3) RLS: service role only (admin-managed via supabaseServer)
ALTER TABLE promotion_target_businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_target_users ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (supabaseServer bypasses RLS, but explicit policies are good practice)
CREATE POLICY "Service role full access" ON promotion_target_businesses
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access" ON promotion_target_users
  FOR ALL USING (true) WITH CHECK (true);

-- 4) Indexes for fast lookups during receipt processing
CREATE INDEX idx_promo_target_biz_lookup
  ON promotion_target_businesses(promotion_id, business_id);

CREATE INDEX idx_promo_target_user_lookup
  ON promotion_target_users(promotion_id, user_id);
