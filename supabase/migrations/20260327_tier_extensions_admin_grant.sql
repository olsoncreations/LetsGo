-- Allow admin-granted tier extensions:
-- 1. Add 'admin' as a valid payment_method
-- 2. Allow price_cents = 0 (free grants)
-- 3. Add 'reinstated' as a valid status

ALTER TABLE tier_extensions
  DROP CONSTRAINT IF EXISTS tier_extensions_payment_method_check,
  ADD CONSTRAINT tier_extensions_payment_method_check
    CHECK (payment_method IN ('balance', 'card', 'venmo', 'admin'));

ALTER TABLE tier_extensions
  DROP CONSTRAINT IF EXISTS tier_extensions_price_cents_check,
  ADD CONSTRAINT tier_extensions_price_cents_check
    CHECK (price_cents >= 0);

ALTER TABLE tier_extensions
  DROP CONSTRAINT IF EXISTS tier_extensions_status_check,
  ADD CONSTRAINT tier_extensions_status_check
    CHECK (status IN ('active', 'expired', 'reinstated'));
