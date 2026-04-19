-- Migration: Fix infinite recursion in business_users RLS policy
--
-- The "Business members can read team" policy on business_users does
-- SELECT FROM business_users inside its own USING clause, causing
-- infinite recursion (Postgres error 42P17). This cascades to every
-- table whose RLS references business_users (business_media,
-- business_ad_campaigns, etc.), breaking images on the discovery page.
--
-- Fix: Create a SECURITY DEFINER function that checks membership
-- without triggering RLS, then use it in the policy.
--
-- RUN AS A SINGLE BATCH in Supabase SQL Editor.

-- 1. Create helper function (bypasses RLS on business_users)
CREATE OR REPLACE FUNCTION public.is_business_member(
  _business_id text,
  _user_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM business_users
    WHERE business_id = _business_id
      AND user_id = _user_id
  );
$$;

-- 2. Drop the recursive policy
DROP POLICY IF EXISTS "Business members can read team" ON business_users;

-- 3. Recreate with the non-recursive function
CREATE POLICY "Business members can read team"
  ON business_users FOR SELECT TO authenticated
  USING (
    public.is_business_member(business_id, auth.uid())
  );
