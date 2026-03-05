-- ============================================================
-- BILLING INFRASTRUCTURE: invoices, line items, statements, payment attempts
-- ============================================================

-- ──────────────────────────────────────────────
-- 1. INVOICES TABLE
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     text NOT NULL,
  -- Period this invoice covers
  period_start    date NOT NULL,
  period_end      date NOT NULL,
  billing_period  text NOT NULL,               -- e.g. "February 2026"
  -- Dates
  invoice_date    date NOT NULL DEFAULT CURRENT_DATE,
  due_date        date NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
  -- Amounts (all in cents)
  subtotal_cents  integer NOT NULL DEFAULT 0,
  cc_fee_cents    integer NOT NULL DEFAULT 0,
  total_cents     integer NOT NULL DEFAULT 0,
  receipt_count   integer NOT NULL DEFAULT 0,
  -- Status flow: draft -> pending -> sent -> paid | overdue | void
  status          text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','pending','sent','paid','overdue','void')),
  -- Payment tracking
  paid_at         timestamptz,
  paid_via        text,                        -- 'auto_charge', 'manual', 'stripe'
  sent_at         timestamptz,
  locked_at       timestamptz,                 -- when finalized (no more edits)
  voided_at       timestamptz,
  voided_reason   text,
  notes           text,
  -- Metadata snapshot at time of invoice generation
  business_name   text,
  business_email  text,
  payment_method  text,                        -- 'bank' or 'card'
  is_premium      boolean NOT NULL DEFAULT false,
  -- Timestamps
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  -- Prevent duplicate invoices for same business + period
  UNIQUE (business_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_invoices_business_id ON invoices(business_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_period ON invoices(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);

-- ──────────────────────────────────────────────
-- 2. INVOICE LINE ITEMS TABLE
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_line_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  -- Line types matching Billing.tsx:
  --   premium_subscription, premium_proration, addon, tpms,
  --   ad_campaign, platform_fee_basic, progressive_payout_fee,
  --   credit_card_fee, adjustment
  line_type       text NOT NULL,
  description     text,
  amount_cents    integer NOT NULL DEFAULT 0,
  quantity        integer NOT NULL DEFAULT 1,
  -- Optional reference to source record
  reference_id    text,
  reference_type  text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice_id ON invoice_line_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_type ON invoice_line_items(line_type);

-- ──────────────────────────────────────────────
-- 3. STATEMENTS TABLE
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS statements (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       text NOT NULL,
  -- Period
  statement_period  text NOT NULL,             -- e.g. "February 2026"
  period_start      date NOT NULL,
  period_end        date NOT NULL,
  -- Summary totals (cents)
  total_receipts    integer NOT NULL DEFAULT 0,
  total_payouts     integer NOT NULL DEFAULT 0,
  total_fees        integer NOT NULL DEFAULT 0,
  total_due         integer NOT NULL DEFAULT 0,
  -- Linked invoice
  invoice_id        uuid REFERENCES invoices(id),
  -- Status: pending -> sent -> viewed
  status            text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','sent','viewed')),
  -- Tracking
  generated_at      timestamptz NOT NULL DEFAULT now(),
  sent_at           timestamptz,
  viewed_at         timestamptz,
  -- Metadata snapshot
  business_name     text,
  business_email    text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  -- Prevent duplicate statements for same business + period
  UNIQUE (business_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_statements_business_id ON statements(business_id);
CREATE INDEX IF NOT EXISTS idx_statements_status ON statements(status);

-- ──────────────────────────────────────────────
-- 4. PAYMENT ATTEMPTS TABLE
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_attempts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id          uuid NOT NULL REFERENCES invoices(id),
  business_id         text NOT NULL,
  -- Amount attempted (cents)
  amount_cents        integer NOT NULL,
  -- Method: 'card' or 'bank'
  payment_method      text NOT NULL,
  -- Processor: 'stub' now, 'stripe' later
  processor           text NOT NULL DEFAULT 'stub',
  -- Result
  status              text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','succeeded','failed','refunded')),
  -- Processor response (full Stripe response, etc.)
  processor_response  jsonb,
  error_message       text,
  -- Tracking
  attempted_at        timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz,
  attempted_by        text,                    -- admin user ID who triggered it
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_attempts_invoice ON payment_attempts(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_business ON payment_attempts(business_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_status ON payment_attempts(status);

-- ──────────────────────────────────────────────
-- 5. RLS POLICIES
-- ──────────────────────────────────────────────
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_attempts ENABLE ROW LEVEL SECURITY;

-- invoices: staff full access
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'invoices' AND policyname = 'Staff full access to invoices') THEN
    CREATE POLICY "Staff full access to invoices" ON invoices
      FOR ALL USING (auth.uid()::text IN (SELECT user_id::text FROM staff_users));
  END IF;
END $$;

-- invoices: businesses read their own
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'invoices' AND policyname = 'Business users can read own invoices') THEN
    CREATE POLICY "Business users can read own invoices" ON invoices
      FOR SELECT USING (
        business_id IN (
          SELECT bu.business_id FROM business_users bu WHERE bu.user_id::text = auth.uid()::text
        )
      );
  END IF;
END $$;

-- invoice_line_items: staff full access
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'invoice_line_items' AND policyname = 'Staff full access to invoice_line_items') THEN
    CREATE POLICY "Staff full access to invoice_line_items" ON invoice_line_items
      FOR ALL USING (auth.uid()::text IN (SELECT user_id::text FROM staff_users));
  END IF;
END $$;

-- invoice_line_items: businesses read their own via invoice join
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'invoice_line_items' AND policyname = 'Business users can read own line items') THEN
    CREATE POLICY "Business users can read own line items" ON invoice_line_items
      FOR SELECT USING (
        invoice_id IN (
          SELECT i.id FROM invoices i
          JOIN business_users bu ON bu.business_id = i.business_id
          WHERE bu.user_id::text = auth.uid()::text
        )
      );
  END IF;
END $$;

-- statements: staff full access
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'statements' AND policyname = 'Staff full access to statements') THEN
    CREATE POLICY "Staff full access to statements" ON statements
      FOR ALL USING (auth.uid()::text IN (SELECT user_id::text FROM staff_users));
  END IF;
END $$;

-- statements: businesses read their own
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'statements' AND policyname = 'Business users can read own statements') THEN
    CREATE POLICY "Business users can read own statements" ON statements
      FOR SELECT USING (
        business_id IN (
          SELECT bu.business_id FROM business_users bu WHERE bu.user_id::text = auth.uid()::text
        )
      );
  END IF;
END $$;

-- payment_attempts: staff only
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payment_attempts' AND policyname = 'Staff full access to payment_attempts') THEN
    CREATE POLICY "Staff full access to payment_attempts" ON payment_attempts
      FOR ALL USING (auth.uid()::text IN (SELECT user_id::text FROM staff_users));
  END IF;
END $$;

-- ──────────────────────────────────────────────
-- 6. VIEW: v_invoices_read (for business Billing tab)
-- ──────────────────────────────────────────────
CREATE OR REPLACE VIEW v_invoices_read AS
SELECT
  i.id,
  i.business_id,
  i.period_start,
  i.period_end,
  i.billing_period,
  i.invoice_date,
  i.due_date,
  i.subtotal_cents,
  i.cc_fee_cents,
  i.total_cents,
  i.receipt_count,
  i.status,
  i.paid_at,
  i.paid_via,
  i.sent_at,
  i.locked_at,
  i.business_name,
  i.payment_method,
  i.is_premium,
  i.created_at,
  i.updated_at
FROM invoices i;

-- ──────────────────────────────────────────────
-- 7. RPC: get_invoice_with_lines (for business Billing tab)
-- ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_invoice_with_lines(p_invoice_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invoice jsonb;
  v_lines jsonb;
BEGIN
  -- Get invoice header
  SELECT to_jsonb(i.*) INTO v_invoice
  FROM invoices i
  WHERE i.id = p_invoice_id;

  IF v_invoice IS NULL THEN
    RETURN jsonb_build_object('invoice', null, 'lines', '[]'::jsonb);
  END IF;

  -- Get line items
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', li.id,
      'line_type', li.line_type,
      'description', li.description,
      'amount_cents', li.amount_cents,
      'quantity', li.quantity,
      'reference_id', li.reference_id,
      'reference_type', li.reference_type
    ) ORDER BY li.created_at
  ), '[]'::jsonb)
  INTO v_lines
  FROM invoice_line_items li
  WHERE li.invoice_id = p_invoice_id;

  RETURN jsonb_build_object('invoice', v_invoice, 'lines', v_lines);
END;
$$;
