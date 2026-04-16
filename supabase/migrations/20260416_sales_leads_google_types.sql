-- Add google_types array for accurate per-lead type tracking.
-- Previously discarded because the client-side scraper overrode business_type
-- with the search category, classifying fire departments as "Restaurant" etc.
ALTER TABLE sales_leads
  ADD COLUMN IF NOT EXISTS google_types text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS type_verified_at timestamptz;

-- Index to quickly find leads needing reclassification (Part 4 backfill)
CREATE INDEX IF NOT EXISTS idx_sales_leads_type_verified_at
  ON sales_leads (type_verified_at)
  WHERE type_verified_at IS NULL;
