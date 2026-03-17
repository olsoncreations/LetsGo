-- ============================================================
-- Atomic financial functions to prevent race conditions
-- Covers: cashout requests, balance crediting, balance debiting,
--         payout completion, payout failure refunds
-- ============================================================

-- 1) ATOMIC CASHOUT REQUEST
-- Checks balance, checks monthly cap, decrements balance,
-- increments pending_payout, inserts payout record — all in one transaction.
-- Returns the new payout row as JSON, or raises an exception on failure.

CREATE OR REPLACE FUNCTION request_cashout(
  p_user_id        UUID,
  p_amount_cents   INTEGER,
  p_fee_cents      INTEGER,
  p_net_cents      INTEGER,
  p_method         TEXT,
  p_account        TEXT,
  p_breakdown      JSONB DEFAULT '{}'::JSONB,
  p_monthly_cap    INTEGER DEFAULT 20000,
  p_min_cents      INTEGER DEFAULT 2000
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_profile        RECORD;
  v_cashed_month   INTEGER;
  v_remaining_cap  INTEGER;
  v_payout_id      UUID;
  v_now            TIMESTAMPTZ := NOW();
  v_month_start    TIMESTAMPTZ;
BEGIN
  -- Lock the profile row to prevent concurrent cashouts
  SELECT available_balance, pending_payout, status
    INTO v_profile
    FROM profiles
   WHERE id = p_user_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CASHOUT_ERROR:Profile not found';
  END IF;

  IF v_profile.status = 'suspended' THEN
    RAISE EXCEPTION 'CASHOUT_ERROR:Your account is suspended. Contact support for help.';
  END IF;

  IF v_profile.status = 'banned' THEN
    RAISE EXCEPTION 'CASHOUT_ERROR:Your account has been banned. Contact support for help.';
  END IF;

  -- Validate amount
  IF p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'CASHOUT_ERROR:Invalid cashout amount';
  END IF;

  IF p_amount_cents < p_min_cents THEN
    RAISE EXCEPTION 'CASHOUT_ERROR:Minimum cashout is $%', TO_CHAR(p_min_cents / 100.0, 'FM999990.00');
  END IF;

  IF p_amount_cents > COALESCE(v_profile.available_balance, 0) THEN
    RAISE EXCEPTION 'CASHOUT_ERROR:Insufficient balance. Available: $%',
      TO_CHAR(COALESCE(v_profile.available_balance, 0) / 100.0, 'FM999990.00');
  END IF;

  -- Hard cap per request: $500 max
  IF p_amount_cents > 50000 THEN
    RAISE EXCEPTION 'CASHOUT_ERROR:Maximum cashout per request is $500.00';
  END IF;

  -- Monthly cap check (atomic — inside the locked transaction)
  v_month_start := DATE_TRUNC('month', v_now);

  SELECT COALESCE(SUM(amount_cents), 0)
    INTO v_cashed_month
    FROM user_payouts
   WHERE user_id = p_user_id
     AND status IN ('pending', 'processing', 'completed')
     AND requested_at >= v_month_start;

  v_remaining_cap := p_monthly_cap - v_cashed_month;

  IF v_remaining_cap <= 0 THEN
    RAISE EXCEPTION 'CASHOUT_ERROR:Monthly cashout limit reached. Resets next month.';
  END IF;

  IF p_amount_cents > v_remaining_cap THEN
    RAISE EXCEPTION 'CASHOUT_ERROR:Monthly cashout limit: $% remaining this month.',
      TO_CHAR(v_remaining_cap / 100.0, 'FM999990.00');
  END IF;

  -- Insert payout record
  INSERT INTO user_payouts (
    user_id, amount_cents, fee_cents, net_amount_cents,
    method, account, status, requested_at, breakdown
  ) VALUES (
    p_user_id, p_amount_cents, p_fee_cents, p_net_cents,
    p_method, p_account, 'pending', v_now, p_breakdown
  )
  RETURNING id INTO v_payout_id;

  -- Atomically update balance
  UPDATE profiles
     SET available_balance = available_balance - p_amount_cents,
         pending_payout = COALESCE(pending_payout, 0) + p_amount_cents
   WHERE id = p_user_id;

  -- Return the payout details
  RETURN jsonb_build_object(
    'id', v_payout_id,
    'amount_cents', p_amount_cents,
    'fee_cents', p_fee_cents,
    'net_amount_cents', p_net_cents,
    'method', p_method,
    'status', 'pending',
    'requested_at', v_now
  );
END;
$$;


-- 2) ATOMIC BALANCE CREDIT (for receipt approvals)
-- Atomically adds to available_balance and lifetime_payout.
-- No read-then-write race condition.

CREATE OR REPLACE FUNCTION credit_user_balance(
  p_user_id      UUID,
  p_amount_cents INTEGER,
  p_receipt_count INTEGER DEFAULT 1
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE profiles
     SET available_balance = COALESCE(available_balance, 0) + p_amount_cents,
         lifetime_payout = COALESCE(lifetime_payout, 0) + p_amount_cents,
         total_receipts = COALESCE(total_receipts, 0) + p_receipt_count
   WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found: %', p_user_id;
  END IF;
END;
$$;


-- 3) ATOMIC BALANCE DEBIT (for receipt rejection reversals)
-- Atomically subtracts from available_balance and lifetime_payout.
-- Floors at 0 to prevent negative balances.

CREATE OR REPLACE FUNCTION debit_user_balance(
  p_user_id      UUID,
  p_amount_cents INTEGER,
  p_receipt_count INTEGER DEFAULT 1
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE profiles
     SET available_balance = GREATEST(0, COALESCE(available_balance, 0) - p_amount_cents),
         lifetime_payout = GREATEST(0, COALESCE(lifetime_payout, 0) - p_amount_cents),
         total_receipts = GREATEST(0, COALESCE(total_receipts, 0) - p_receipt_count)
   WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found: %', p_user_id;
  END IF;
END;
$$;


-- 4) ATOMIC PAYOUT COMPLETION (subtract from pending_payout)

CREATE OR REPLACE FUNCTION complete_payout_balance(
  p_user_id      UUID,
  p_amount_cents INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE profiles
     SET pending_payout = GREATEST(0, COALESCE(pending_payout, 0) - p_amount_cents)
   WHERE id = p_user_id;
END;
$$;


-- 5) ATOMIC PAYOUT FAILURE REFUND (restore balance from pending)

CREATE OR REPLACE FUNCTION refund_failed_payout(
  p_user_id      UUID,
  p_amount_cents INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE profiles
     SET available_balance = COALESCE(available_balance, 0) + p_amount_cents,
         pending_payout = GREATEST(0, COALESCE(pending_payout, 0) - p_amount_cents)
   WHERE id = p_user_id;
END;
$$;


-- 6) ATOMIC PROMOTION INCREMENT (with max_uses guard)

CREATE OR REPLACE FUNCTION increment_promotion_uses(
  p_promotion_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE promotions
     SET uses_count = uses_count + 1
   WHERE id = p_promotion_id
     AND (max_uses IS NULL OR uses_count < max_uses);

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;
