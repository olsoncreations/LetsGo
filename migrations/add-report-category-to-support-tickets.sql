-- Add "report" to the support_tickets.category CHECK constraint so the
-- Discovery feed's "Report this business" flow can write tickets into the
-- existing support queue. Reports are surfaced in /admin/support filterable
-- by category alongside payout / receipt / account / billing / general.
--
-- Idempotent: safe to run multiple times.

ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_category_check;

ALTER TABLE support_tickets
  ADD CONSTRAINT support_tickets_category_check
  CHECK (category IN ('payout', 'receipt', 'account', 'billing', 'general', 'report'));
