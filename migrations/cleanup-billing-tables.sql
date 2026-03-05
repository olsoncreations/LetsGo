-- ============================================================
-- CLEANUP: Drop partially-created billing tables so we can re-run
-- the full migration cleanly.
-- ============================================================

-- Drop the view and function first (they depend on the tables)
DROP VIEW IF EXISTS v_invoices_read CASCADE;
DROP FUNCTION IF EXISTS get_invoice_with_lines(uuid) CASCADE;

-- Drop tables in correct order (respect foreign key dependencies)
DROP TABLE IF EXISTS payment_attempts CASCADE;
DROP TABLE IF EXISTS invoice_line_items CASCADE;
DROP TABLE IF EXISTS statements CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
