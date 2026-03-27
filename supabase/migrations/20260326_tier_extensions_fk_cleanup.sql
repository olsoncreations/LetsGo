-- Add ON DELETE actions to tier_extensions foreign keys
-- tier_extensions.business_id: SET NULL on delete (Gold extensions have NULL business_id, so this is safe)
ALTER TABLE tier_extensions
  DROP CONSTRAINT IF EXISTS tier_extensions_business_id_fkey,
  ADD CONSTRAINT tier_extensions_business_id_fkey
    FOREIGN KEY (business_id) REFERENCES business(id) ON DELETE SET NULL;

-- tier_extension_business_credits.business_id: CASCADE on delete
ALTER TABLE tier_extension_business_credits
  DROP CONSTRAINT IF EXISTS tier_extension_business_credits_business_id_fkey,
  ADD CONSTRAINT tier_extension_business_credits_business_id_fkey
    FOREIGN KEY (business_id) REFERENCES business(id) ON DELETE CASCADE;

-- tier_extension_business_credits.billing_adjustment_id: SET NULL on delete
ALTER TABLE tier_extension_business_credits
  DROP CONSTRAINT IF EXISTS tier_extension_business_credits_billing_adjustment_id_fkey,
  ADD CONSTRAINT tier_extension_business_credits_billing_adjustment_id_fkey
    FOREIGN KEY (billing_adjustment_id) REFERENCES billing_adjustments(id) ON DELETE SET NULL;
