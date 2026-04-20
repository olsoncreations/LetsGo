-- Migration: Security Advisor Fixes
-- Fixes 3 errors + 60 warnings from Supabase Security Advisor
--
-- RUN IN 4 BATCHES in Supabase SQL Editor:
--   Batch 1: Lines 10-35   (3 errors — RLS + views)
--   Batch 2: Lines 39-238  (RLS policy tightening)
--   Batch 3: Lines 242-269 (function search_path — triggers + auth)
--   Batch 4: Lines 273-316 (function search_path — business/financial/etc)


-- ============================================================
-- BATCH 1: Fix 3 Errors (RLS on role_applications + Security Definer views)
-- ============================================================

ALTER TABLE role_applications ENABLE ROW LEVEL SECURITY;

-- Add anon INSERT policy for unauthenticated career applications
-- (user_id was made nullable in 20260403 migration)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'role_applications'
      AND policyname = 'Anon can submit applications'
  ) THEN
    CREATE POLICY "Anon can submit applications" ON role_applications
      FOR INSERT TO anon
      WITH CHECK (true);
  END IF;
END $$;

-- Make views use the calling user's permissions (security_invoker)
-- instead of the view creator's permissions (security_definer)
ALTER VIEW v_invoices_read SET (security_invoker = on);
ALTER VIEW v_business_plan_status SET (security_invoker = on);


-- ============================================================
-- BATCH 2: Tighten overly permissive RLS policies
-- ============================================================

-- ---- business_addon_subscriptions ----
DROP POLICY IF EXISTS "Authenticated users can insert business_addon_subscriptions" ON business_addon_subscriptions;
DROP POLICY IF EXISTS "Authenticated users can update business_addon_subscriptions" ON business_addon_subscriptions;

CREATE POLICY "Business owners can insert own addon subscriptions" ON business_addon_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM business_users bu
      WHERE bu.business_id = business_addon_subscriptions.business_id
        AND bu.user_id = auth.uid()
        AND bu.role IN ('owner', 'manager')
    )
    OR EXISTS (SELECT 1 FROM staff_users WHERE staff_users.user_id = auth.uid())
  );

CREATE POLICY "Business owners can update own addon subscriptions" ON business_addon_subscriptions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM business_users bu
      WHERE bu.business_id = business_addon_subscriptions.business_id
        AND bu.user_id = auth.uid()
        AND bu.role IN ('owner', 'manager')
    )
    OR EXISTS (SELECT 1 FROM staff_users WHERE staff_users.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM business_users bu
      WHERE bu.business_id = business_addon_subscriptions.business_id
        AND bu.user_id = auth.uid()
        AND bu.role IN ('owner', 'manager')
    )
    OR EXISTS (SELECT 1 FROM staff_users WHERE staff_users.user_id = auth.uid())
  );

-- ---- push_campaigns ----
DROP POLICY IF EXISTS "Authenticated users can insert push_campaigns" ON push_campaigns;
DROP POLICY IF EXISTS "Authenticated users can update push_campaigns" ON push_campaigns;

CREATE POLICY "Staff can insert push_campaigns" ON push_campaigns
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM staff_users WHERE staff_users.user_id = auth.uid())
  );

CREATE POLICY "Staff can update push_campaigns" ON push_campaigns
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM staff_users WHERE staff_users.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM staff_users WHERE staff_users.user_id = auth.uid())
  );

-- ---- qr_scans ----
DROP POLICY IF EXISTS "Allow inserts from API" ON qr_scans;

-- ---- inbound_signups ----
DROP POLICY IF EXISTS "Allow all for inbound_signups" ON inbound_signups;

CREATE POLICY "Anon can insert inbound_signups" ON inbound_signups
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Staff can manage inbound_signups" ON inbound_signups
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM staff_users WHERE staff_users.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM staff_users WHERE staff_users.user_id = auth.uid())
  );

-- ---- sales_reps ----
DROP POLICY IF EXISTS "Allow all for sales_reps" ON sales_reps;

CREATE POLICY "Staff full access to sales_reps" ON sales_reps
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM staff_users WHERE staff_users.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM staff_users WHERE staff_users.user_id = auth.uid())
  );

-- ---- sales_config ----
DROP POLICY IF EXISTS "Allow all for sales_config" ON sales_config;

CREATE POLICY "Staff full access to sales_config" ON sales_config
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM staff_users WHERE staff_users.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM staff_users WHERE staff_users.user_id = auth.uid())
  );

-- ---- sales_divisions ----
DROP POLICY IF EXISTS "Allow all for sales_divisions" ON sales_divisions;

CREATE POLICY "Staff full access to sales_divisions" ON sales_divisions
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM staff_users WHERE staff_users.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM staff_users WHERE staff_users.user_id = auth.uid())
  );

-- ---- sales_signups ----
DROP POLICY IF EXISTS "Allow all for sales_signups" ON sales_signups;

CREATE POLICY "Staff full access to sales_signups" ON sales_signups
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM staff_users WHERE staff_users.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM staff_users WHERE staff_users.user_id = auth.uid())
  );

-- ---- sales_payout_history ----
DROP POLICY IF EXISTS "Allow all for sales_payout_history" ON sales_payout_history;

CREATE POLICY "Staff full access to sales_payout_history" ON sales_payout_history
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM staff_users WHERE staff_users.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM staff_users WHERE staff_users.user_id = auth.uid())
  );

-- ---- sales_quota_overrides ----
DROP POLICY IF EXISTS "Allow all for sales_quota_overrides" ON sales_quota_overrides;

CREATE POLICY "Staff full access to sales_quota_overrides" ON sales_quota_overrides
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM staff_users WHERE staff_users.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM staff_users WHERE staff_users.user_id = auth.uid())
  );

-- ---- sales_repeat_customers ----
DROP POLICY IF EXISTS "Allow all for sales_repeat_customers" ON sales_repeat_customers;

CREATE POLICY "Staff full access to sales_repeat_customers" ON sales_repeat_customers
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM staff_users WHERE staff_users.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM staff_users WHERE staff_users.user_id = auth.uid())
  );

-- ---- sales_bonus_pool ----
DROP POLICY IF EXISTS "Allow all for sales_bonus_pool" ON sales_bonus_pool;

CREATE POLICY "Staff full access to sales_bonus_pool" ON sales_bonus_pool
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM staff_users WHERE staff_users.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM staff_users WHERE staff_users.user_id = auth.uid())
  );

-- ---- promotion_target_businesses ----
DROP POLICY IF EXISTS "Service role full access" ON promotion_target_businesses;

CREATE POLICY "Staff full access to promotion_target_businesses" ON promotion_target_businesses
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM staff_users WHERE staff_users.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM staff_users WHERE staff_users.user_id = auth.uid())
  );

-- ---- promotion_target_users ----
DROP POLICY IF EXISTS "Service role full access" ON promotion_target_users;

CREATE POLICY "Staff full access to promotion_target_users" ON promotion_target_users
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM staff_users WHERE staff_users.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM staff_users WHERE staff_users.user_id = auth.uid())
  );


-- ---- sales_zones ----
DROP POLICY IF EXISTS "Allow all for sales_zones" ON sales_zones;

CREATE POLICY "Staff full access to sales_zones" ON sales_zones
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM staff_users WHERE staff_users.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM staff_users WHERE staff_users.user_id = auth.uid())
  );

-- ---- scheduled_reports ----
DROP POLICY IF EXISTS "Staff can manage scheduled reports" ON scheduled_reports;

CREATE POLICY "Staff can manage scheduled reports" ON scheduled_reports
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM staff_users WHERE staff_users.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM staff_users WHERE staff_users.user_id = auth.uid())
  );


-- ============================================================
-- BATCH 3: Function search_path fixes — triggers + auth helpers
-- ============================================================

-- Trigger functions (updated_at helpers)
ALTER FUNCTION set_updated_at() SET search_path = '';
ALTER FUNCTION set_role_applications_updated_at() SET search_path = '';
ALTER FUNCTION set_outreach_emails_updated_at() SET search_path = '';
ALTER FUNCTION set_outreach_templates_updated_at() SET search_path = '';
ALTER FUNCTION update_sales_leads_updated_at() SET search_path = '';
ALTER FUNCTION set_tier_extensions_updated_at() SET search_path = '';
ALTER FUNCTION update_updated_at_column() SET search_path = '';

-- Auth / role helper functions
ALTER FUNCTION is_staff() SET search_path = '';
ALTER FUNCTION is_business_user(text) SET search_path = '';
ALTER FUNCTION is_business_member(text) SET search_path = '';
ALTER FUNCTION handle_new_user() SET search_path = '';


-- ============================================================
-- BATCH 4: Function search_path fixes — financial, billing, business, etc.
-- ============================================================

-- Financial functions (signatures verified from pg_proc)
ALTER FUNCTION request_cashout(uuid, integer, integer, integer, text, text, jsonb, integer, integer) SET search_path = '';
ALTER FUNCTION credit_user_balance(uuid, integer, integer) SET search_path = '';
ALTER FUNCTION debit_user_balance(uuid, integer, integer) SET search_path = '';
ALTER FUNCTION complete_payout_balance(uuid, integer) SET search_path = '';
ALTER FUNCTION refund_failed_payout(uuid, integer) SET search_path = '';
ALTER FUNCTION increment_promotion_uses(uuid) SET search_path = '';

-- Tier extension function
ALTER FUNCTION purchase_tier_extension(uuid, text, text, integer, integer, integer, date, date, jsonb) SET search_path = '';

-- Billing functions
ALTER FUNCTION recalc_invoice_totals(uuid) SET search_path = '';
ALTER FUNCTION trg_recalc_invoice_totals() SET search_path = '';
ALTER FUNCTION get_invoice_with_lines(uuid) SET search_path = '';
ALTER FUNCTION close_billing_period(date, date) SET search_path = '';
ALTER FUNCTION prevent_locked_invoice_line_edits() SET search_path = '';

-- Business functions
ALTER FUNCTION save_business_draft(text, jsonb) SET search_path = '';
ALTER FUNCTION publish_business_draft(text) SET search_path = '';
ALTER FUNCTION get_business_plan_status(text) SET search_path = '';
ALTER FUNCTION effective_plan_now(text) SET search_path = '';
ALTER FUNCTION approve_partner_onboarding_submission(uuid) SET search_path = '';
ALTER FUNCTION strip_sensitive_onboarding_payload() SET search_path = '';

-- User stats / experience functions
ALTER FUNCTION recalculate_user_stats(uuid) SET search_path = '';
ALTER FUNCTION get_user_business_stats(uuid) SET search_path = '';
ALTER FUNCTION can_view_user_experience_object(text, text) SET search_path = '';

-- Promotion / advertising functions
ALTER FUNCTION require_premium_for_ad_campaign() SET search_path = '';
ALTER FUNCTION require_premium_for_events() SET search_path = '';

-- Influencer functions
ALTER FUNCTION update_influencer_signup_count() SET search_path = '';
ALTER FUNCTION update_influencer_total_paid() SET search_path = '';
ALTER FUNCTION update_influencer_click_count() SET search_path = '';
ALTER FUNCTION assign_influencer_tier() SET search_path = '';
