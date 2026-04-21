-- Add latitude/longitude columns to business table for accurate distance filtering.
-- Replaces the hardcoded ZIP_COORDS lookup (~30 entries) with per-business GPS coordinates.

ALTER TABLE business ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE business ADD COLUMN IF NOT EXISTS longitude double precision;

-- Index for geographic queries
CREATE INDEX IF NOT EXISTS idx_business_lat_lng
  ON business (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Backfill coordinates from sales_leads (Google Places)
UPDATE business b
SET latitude = sl.latitude,
    longitude = sl.longitude
FROM sales_leads sl
WHERE sl.preview_business_id = b.id
  AND sl.latitude IS NOT NULL
  AND sl.longitude IS NOT NULL
  AND b.latitude IS NULL;

-- Backfill standalone tags column from config.tags for seeded businesses
-- so the in-house tag system matches properly
UPDATE business
SET tags = ARRAY(
  SELECT jsonb_array_elements_text(config->'tags')
)
WHERE config->'tags' IS NOT NULL
  AND jsonb_array_length(config->'tags') > 0
  AND (tags IS NULL OR array_length(tags, 1) IS NULL);
