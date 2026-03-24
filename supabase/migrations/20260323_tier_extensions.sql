-- ============================================================
-- Premium Tier Extensions
-- Allows users to purchase extensions that prevent their
-- progressive payout tiers from resetting when the 365-day
-- anniversary window expires.
-- Products: Silver 6, Silver 12 (per business), Gold 6, Gold 12 (all businesses)
-- ============================================================

-- 1) TIER EXTENSIONS TABLE
-- Stores purchased extensions

CREATE TABLE IF NOT EXISTS tier_extensions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id),
  business_id           TEXT REFERENCES business(id),  -- NULL for Gold (applies to all)
  product_type          TEXT NOT NULL CHECK (product_type IN ('silver_6', 'silver_12', 'gold_6', 'gold_12')),
  extension_months      INTEGER NOT NULL CHECK (extension_months IN (6, 12)),
  protected_tier_index  INTEGER NOT NULL CHECK (protected_tier_index BETWEEN 1 AND 7),
  price_cents           INTEGER NOT NULL CHECK (price_cents > 0),
  payment_method        TEXT NOT NULL CHECK (payment_method IN ('balance', 'card', 'venmo')),
  effective_from        DATE NOT NULL,
  effective_until        DATE NOT NULL,
  status                TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired')),
  pricing_snapshot      JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tier_ext_user ON tier_extensions(user_id);
CREATE INDEX IF NOT EXISTS idx_tier_ext_user_biz ON tier_extensions(user_id, business_id);
CREATE INDEX IF NOT EXISTS idx_tier_ext_status ON tier_extensions(status);
CREATE INDEX IF NOT EXISTS idx_tier_ext_until ON tier_extensions(effective_until);
CREATE INDEX IF NOT EXISTS idx_tier_ext_user_status ON tier_extensions(user_id, status)
  WHERE status = 'active';

-- RLS
ALTER TABLE tier_extensions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own extensions"
  ON tier_extensions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Staff full access to extensions"
  ON tier_extensions FOR ALL
  USING (
    EXISTS (SELECT 1 FROM staff_users WHERE user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM staff_users WHERE user_id = auth.uid())
  );

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION set_tier_extensions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_tier_extensions_updated_at
  BEFORE UPDATE ON tier_extensions
  FOR EACH ROW EXECUTE FUNCTION set_tier_extensions_updated_at();


-- 2) TIER EXTENSION BUSINESS CREDITS TABLE
-- Tracks the 10% credit owed to each business from extension purchases

CREATE TABLE IF NOT EXISTS tier_extension_business_credits (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_extension_id       UUID NOT NULL REFERENCES tier_extensions(id) ON DELETE CASCADE,
  business_id             TEXT NOT NULL REFERENCES business(id),
  credit_cents            INTEGER NOT NULL CHECK (credit_cents > 0),
  billing_adjustment_id   UUID REFERENCES billing_adjustments(id),
  status                  TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied')),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tebc_extension ON tier_extension_business_credits(tier_extension_id);
CREATE INDEX IF NOT EXISTS idx_tebc_business ON tier_extension_business_credits(business_id);
CREATE INDEX IF NOT EXISTS idx_tebc_status ON tier_extension_business_credits(status)
  WHERE status = 'pending';

-- RLS
ALTER TABLE tier_extension_business_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business users can read own credits"
  ON tier_extension_business_credits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM business_users bu
      WHERE bu.business_id = tier_extension_business_credits.business_id
        AND bu.user_id = auth.uid()
    )
  );

CREATE POLICY "Staff full access to extension credits"
  ON tier_extension_business_credits FOR ALL
  USING (
    EXISTS (SELECT 1 FROM staff_users WHERE user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM staff_users WHERE user_id = auth.uid())
  );


-- 3) ADD tier_extension_config TO platform_settings
-- Stores configurable defaults for the extension system

DO $$
BEGIN
  -- Add column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'platform_settings'
      AND column_name = 'tier_extension_config'
  ) THEN
    ALTER TABLE platform_settings
      ADD COLUMN tier_extension_config JSONB NOT NULL DEFAULT '{
        "silver_6_fee_pct": 60,
        "silver_12_fee_pct": 50,
        "gold_discount_pct": 15,
        "letsgo_split_pct": 90,
        "churn_window_days": 60
      }'::JSONB;
  END IF;
END $$;

-- Ensure the row has the default config
UPDATE platform_settings
SET tier_extension_config = '{
  "silver_6_fee_pct": 60,
  "silver_12_fee_pct": 50,
  "gold_discount_pct": 15,
  "letsgo_split_pct": 90,
  "churn_window_days": 60
}'::JSONB
WHERE id = 1
  AND (tier_extension_config IS NULL OR tier_extension_config = '{}'::JSONB);


-- 4) ATOMIC PURCHASE FUNCTION (balance payment)
-- Locks user profile, checks balance, deducts, inserts extension — all in one transaction.
-- Returns the new extension row as JSON, or raises an exception on failure.

CREATE OR REPLACE FUNCTION purchase_tier_extension(
  p_user_id               UUID,
  p_business_id           TEXT,         -- NULL for Gold
  p_product_type          TEXT,
  p_extension_months      INTEGER,
  p_protected_tier_index  INTEGER,
  p_price_cents           INTEGER,
  p_effective_from        DATE,
  p_effective_until       DATE,
  p_pricing_snapshot      JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_profile       RECORD;
  v_extension_id  UUID;
  v_now           TIMESTAMPTZ := NOW();
BEGIN
  -- Lock the profile row to prevent concurrent purchases
  SELECT available_balance, status
    INTO v_profile
    FROM profiles
   WHERE id = p_user_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EXTENSION_ERROR:Profile not found';
  END IF;

  IF v_profile.status = 'suspended' THEN
    RAISE EXCEPTION 'EXTENSION_ERROR:Your account is suspended. Contact support for help.';
  END IF;

  IF v_profile.status = 'banned' THEN
    RAISE EXCEPTION 'EXTENSION_ERROR:Your account has been banned. Contact support for help.';
  END IF;

  -- Validate price
  IF p_price_cents <= 0 THEN
    RAISE EXCEPTION 'EXTENSION_ERROR:Invalid purchase amount';
  END IF;

  -- Check balance
  IF p_price_cents > COALESCE(v_profile.available_balance, 0) THEN
    RAISE EXCEPTION 'EXTENSION_ERROR:Insufficient balance. Available: $%',
      TO_CHAR(COALESCE(v_profile.available_balance, 0) / 100.0, 'FM999990.00');
  END IF;

  -- Insert the extension
  INSERT INTO tier_extensions (
    user_id, business_id, product_type, extension_months,
    protected_tier_index, price_cents, payment_method,
    effective_from, effective_until, status, pricing_snapshot
  ) VALUES (
    p_user_id, p_business_id, p_product_type, p_extension_months,
    p_protected_tier_index, p_price_cents, 'balance',
    p_effective_from, p_effective_until, 'active', p_pricing_snapshot
  )
  RETURNING id INTO v_extension_id;

  -- Atomically deduct balance
  UPDATE profiles
     SET available_balance = available_balance - p_price_cents
   WHERE id = p_user_id;

  -- Return the extension details
  RETURN jsonb_build_object(
    'id', v_extension_id,
    'user_id', p_user_id,
    'business_id', p_business_id,
    'product_type', p_product_type,
    'extension_months', p_extension_months,
    'protected_tier_index', p_protected_tier_index,
    'price_cents', p_price_cents,
    'payment_method', 'balance',
    'effective_from', p_effective_from,
    'effective_until', p_effective_until,
    'status', 'active',
    'created_at', v_now
  );
END;
$$;
