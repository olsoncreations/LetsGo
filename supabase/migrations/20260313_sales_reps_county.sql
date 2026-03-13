-- Migration: Add county_id and state to sales_reps for quota rollup
-- Rep quota rolls up: rep → county → state → division

-- 1. Add county_id (FK to sales_counties) and state columns
ALTER TABLE sales_reps ADD COLUMN IF NOT EXISTS county_id UUID REFERENCES sales_counties(id) ON DELETE SET NULL;
ALTER TABLE sales_reps ADD COLUMN IF NOT EXISTS state TEXT;

-- 2. Create index for rollup queries
CREATE INDEX IF NOT EXISTS idx_sales_reps_county_id ON sales_reps(county_id);
CREATE INDEX IF NOT EXISTS idx_sales_reps_state ON sales_reps(state);
