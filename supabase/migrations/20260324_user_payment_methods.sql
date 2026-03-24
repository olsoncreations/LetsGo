-- ============================================================
-- User Payment Methods for Tier Extension Purchases
-- Adds payment method storage to profiles table and creates
-- a user_payment_attempts table for audit trail.
-- ============================================================

-- 1) ADD PAYMENT METHOD COLUMNS TO PROFILES
-- These store a user's saved card/bank for inbound charges.
-- Separate from stripe_connect_account_id (which is for outbound payouts).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'stripe_customer_id') THEN
    ALTER TABLE profiles ADD COLUMN stripe_customer_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'stripe_payment_method_id') THEN
    ALTER TABLE profiles ADD COLUMN stripe_payment_method_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'payment_method_type') THEN
    ALTER TABLE profiles ADD COLUMN payment_method_type TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'payment_card_brand') THEN
    ALTER TABLE profiles ADD COLUMN payment_card_brand TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'payment_card_last4') THEN
    ALTER TABLE profiles ADD COLUMN payment_card_last4 TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'payment_card_exp_month') THEN
    ALTER TABLE profiles ADD COLUMN payment_card_exp_month INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'payment_card_exp_year') THEN
    ALTER TABLE profiles ADD COLUMN payment_card_exp_year INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'payment_bank_name') THEN
    ALTER TABLE profiles ADD COLUMN payment_bank_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'payment_bank_last4') THEN
    ALTER TABLE profiles ADD COLUMN payment_bank_last4 TEXT;
  END IF;
END $$;


-- 2) ADD 'bank' TO tier_extensions.payment_method CHECK CONSTRAINT
-- Existing values: 'balance', 'card', 'venmo'. Adding 'bank'.

ALTER TABLE tier_extensions DROP CONSTRAINT IF EXISTS tier_extensions_payment_method_check;
ALTER TABLE tier_extensions ADD CONSTRAINT tier_extensions_payment_method_check
  CHECK (payment_method IN ('balance', 'card', 'venmo', 'bank'));


-- 3) USER PAYMENT ATTEMPTS TABLE
-- Audit trail for user charges (separate from business payment_attempts).

CREATE TABLE IF NOT EXISTS user_payment_attempts (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID NOT NULL REFERENCES auth.users(id),
  entity_type               TEXT NOT NULL DEFAULT 'tier_extension',
  entity_id                 UUID,
  amount_cents              INTEGER NOT NULL CHECK (amount_cents > 0),
  processing_fee_cents      INTEGER NOT NULL DEFAULT 0,
  total_cents               INTEGER NOT NULL CHECK (total_cents > 0),
  payment_method            TEXT NOT NULL CHECK (payment_method IN ('card', 'bank', 'venmo')),
  processor                 TEXT NOT NULL DEFAULT 'stripe',
  status                    TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  stripe_payment_intent_id  TEXT,
  processor_response        JSONB,
  error_message             TEXT,
  attempted_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at              TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_upa_user ON user_payment_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_upa_status ON user_payment_attempts(status);
CREATE INDEX IF NOT EXISTS idx_upa_entity ON user_payment_attempts(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_upa_stripe_pi ON user_payment_attempts(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

-- RLS
ALTER TABLE user_payment_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own payment attempts"
  ON user_payment_attempts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Staff full access to user payment attempts"
  ON user_payment_attempts FOR ALL
  USING (
    EXISTS (SELECT 1 FROM staff_users WHERE user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM staff_users WHERE user_id = auth.uid())
  );
