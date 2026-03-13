-- Migration: Create sales_counties table with all US counties
-- Source: US Census Bureau FIPS codes (via kjhealy/fips-codes)
-- Total: 3146 counties across 51 states/territories

-- 1. Create the sales_counties table
CREATE TABLE IF NOT EXISTS sales_counties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fips TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  state TEXT NOT NULL,
  zone_id UUID REFERENCES sales_zones(id) ON DELETE SET NULL,
  quota INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create indexes
CREATE INDEX IF NOT EXISTS idx_sales_counties_state ON sales_counties(state);
CREATE INDEX IF NOT EXISTS idx_sales_counties_zone_id ON sales_counties(zone_id);
CREATE INDEX IF NOT EXISTS idx_sales_counties_fips ON sales_counties(fips);

-- 3. Enable RLS (staff-only)
ALTER TABLE sales_counties ENABLE ROW LEVEL SECURITY;

CREATE POLICY sales_counties_staff_read ON sales_counties
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM staff_users WHERE user_id = auth.uid())
  );

CREATE POLICY sales_counties_staff_write ON sales_counties
  FOR ALL USING (
    EXISTS (SELECT 1 FROM staff_users WHERE user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM staff_users WHERE user_id = auth.uid())
  );

-- 4. Add county column to sales_signups
ALTER TABLE sales_signups ADD COLUMN IF NOT EXISTS county TEXT;

-- 5. Insert all US counties (zone_id looked up by division name via sales_zones)

