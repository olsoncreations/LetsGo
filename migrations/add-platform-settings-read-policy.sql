-- Migration: Allow authenticated users to read platform_settings
-- This table contains public config data (pricing, fee rates, payout presets)
-- that the partner onboarding page needs to display correct values.
-- Without this policy, RLS blocks non-admin users from reading the table,
-- causing the onboarding to fall back to hardcoded defaults.

-- Ensure RLS is enabled (idempotent)
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read platform settings
CREATE POLICY "Authenticated users can read platform settings"
  ON platform_settings
  FOR SELECT
  TO authenticated
  USING (true);
