-- =====================================================
-- CLEANUP SCRIPT: Remove all fake sales data
-- =====================================================
-- Run this in Supabase SQL Editor
-- IMPORTANT: Review the verification queries first!
-- =====================================================

-- =====================================================
-- STEP 1: Check what tables exist and how many records
-- =====================================================
-- Run these first to see what you have:

SELECT 'sales_divisions' as table_name, COUNT(*) as count FROM sales_divisions
UNION ALL
SELECT 'sales_zones', COUNT(*) FROM sales_zones
UNION ALL
SELECT 'sales_reps', COUNT(*) FROM sales_reps
UNION ALL
SELECT 'sales_signups', COUNT(*) FROM sales_signups
UNION ALL
SELECT 'inbound_signups', COUNT(*) FROM inbound_signups
UNION ALL
SELECT 'sales_payout_history', COUNT(*) FROM sales_payout_history
UNION ALL
SELECT 'sales_bonus_pool', COUNT(*) FROM sales_bonus_pool
UNION ALL
SELECT 'sales_repeat_customers', COUNT(*) FROM sales_repeat_customers
UNION ALL
SELECT 'sales_quota_overrides', COUNT(*) FROM sales_quota_overrides
UNION ALL
SELECT 'sales_config', COUNT(*) FROM sales_config;

-- =====================================================
-- STEP 2: Review the actual data (optional)
-- =====================================================
-- Uncomment these to see what data exists:

-- SELECT * FROM sales_divisions LIMIT 10;
-- SELECT * FROM sales_zones LIMIT 10;
-- SELECT * FROM sales_reps LIMIT 10;
-- SELECT * FROM sales_signups LIMIT 10;
-- SELECT * FROM inbound_signups LIMIT 10;

-- =====================================================
-- STEP 3: Delete fake data (run after reviewing above)
-- =====================================================
-- Delete in reverse order of dependencies

-- Delete quota overrides
DELETE FROM sales_quota_overrides;

-- Delete payout history
DELETE FROM sales_payout_history;

-- Delete bonus pools
DELETE FROM sales_bonus_pool;

-- Delete repeat customers
DELETE FROM sales_repeat_customers;

-- Delete inbound signups
DELETE FROM inbound_signups;

-- Delete sales signups (outbound)
DELETE FROM sales_signups;

-- Delete sales reps
DELETE FROM sales_reps;

-- Delete zones
DELETE FROM sales_zones;

-- Delete divisions
DELETE FROM sales_divisions;

-- Note: sales_config table is kept as it contains system configuration
-- If you want to reset config values too, uncomment the line below:
-- DELETE FROM sales_config;

-- sales_audit_log table may not exist yet - it's created automatically
-- when audit logging is first used

-- =====================================================
-- STEP 4: Verify cleanup (run after deletions)
-- =====================================================

SELECT 'sales_divisions' as table_name, COUNT(*) as remaining FROM sales_divisions
UNION ALL
SELECT 'sales_zones', COUNT(*) FROM sales_zones
UNION ALL
SELECT 'sales_reps', COUNT(*) FROM sales_reps
UNION ALL
SELECT 'sales_signups', COUNT(*) FROM sales_signups
UNION ALL
SELECT 'inbound_signups', COUNT(*) FROM inbound_signups
UNION ALL
SELECT 'sales_payout_history', COUNT(*) FROM sales_payout_history
UNION ALL
SELECT 'sales_bonus_pool', COUNT(*) FROM sales_bonus_pool
UNION ALL
SELECT 'sales_repeat_customers', COUNT(*) FROM sales_repeat_customers
UNION ALL
SELECT 'sales_quota_overrides', COUNT(*) FROM sales_quota_overrides;
