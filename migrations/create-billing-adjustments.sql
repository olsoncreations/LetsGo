-- ============================================================
-- BILLING ADJUSTMENTS: Standalone credits/charges for businesses
-- Applied to any business at any time, consumed into invoices
-- during invoice generation.
-- ============================================================

-- ──────────────────────────────────────────────
-- 1. BILLING ADJUSTMENTS TABLE
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS billing_adjustments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id           text NOT NULL,
  -- Amount in cents. Negative = credit (reduces balance), positive = charge (adds to balance)
  amount_cents          integer NOT NULL,
  -- Type label for easy filtering
  type                  text NOT NULL CHECK (type IN ('credit', 'charge')),
  -- Required reason/description
  description           text NOT NULL,
  -- Status flow: pending -> applied | voided
  status                text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'applied', 'voided')),
  -- When consumed into an invoice
  applied_to_invoice_id uuid REFERENCES invoices(id),
  applied_at            timestamptz,
  -- When voided
  voided_at             timestamptz,
  voided_by             uuid,
  voided_reason         text,
  -- Who created it
  created_by            uuid NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_adj_business ON billing_adjustments(business_id);
CREATE INDEX IF NOT EXISTS idx_billing_adj_status ON billing_adjustments(status);
CREATE INDEX IF NOT EXISTS idx_billing_adj_created ON billing_adjustments(created_at DESC);

-- ──────────────────────────────────────────────
-- 2. RLS POLICIES
-- ──────────────────────────────────────────────
ALTER TABLE billing_adjustments ENABLE ROW LEVEL SECURITY;

-- Staff: full access
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'billing_adjustments' AND policyname = 'Staff full access to billing_adjustments') THEN
    CREATE POLICY "Staff full access to billing_adjustments" ON billing_adjustments
      FOR ALL USING (auth.uid()::text IN (SELECT user_id::text FROM staff_users))
      WITH CHECK (auth.uid()::text IN (SELECT user_id::text FROM staff_users));
  END IF;
END $$;

-- Businesses: read their own adjustments
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'billing_adjustments' AND policyname = 'Business users can read own adjustments') THEN
    CREATE POLICY "Business users can read own adjustments" ON billing_adjustments
      FOR SELECT USING (
        business_id IN (
          SELECT bu.business_id FROM business_users bu WHERE bu.user_id::text = auth.uid()::text
        )
      );
  END IF;
END $$;
