-- Add columns for Nominatim cross-reference geocoding system.
-- Stores Nominatim coordinates alongside Google Places coordinates,
-- with status tracking for admin review of mismatches.

ALTER TABLE business ADD COLUMN IF NOT EXISTS nominatim_lat double precision;
ALTER TABLE business ADD COLUMN IF NOT EXISTS nominatim_lng double precision;
ALTER TABLE business ADD COLUMN IF NOT EXISTS geocode_status text DEFAULT 'pending';
ALTER TABLE business ADD COLUMN IF NOT EXISTS geocode_distance_miles double precision;
ALTER TABLE business ADD COLUMN IF NOT EXISTS geocode_checked_at timestamptz;
ALTER TABLE business ADD COLUMN IF NOT EXISTS geocode_reviewed_by text;
ALTER TABLE business ADD COLUMN IF NOT EXISTS geocode_reviewed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_business_geocode_status
  ON business (geocode_status)
  WHERE geocode_status IS NOT NULL;
