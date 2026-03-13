-- Migration: Change individual_quota from integer to numeric(6,2) for daily decimal quotas
-- e.g. 2.50 = 2.5 businesses per day
ALTER TABLE sales_reps ALTER COLUMN individual_quota TYPE NUMERIC(6,2);
