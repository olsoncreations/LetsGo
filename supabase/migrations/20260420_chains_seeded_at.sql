-- Add seeded_at to chains table to distinguish seeded chains from real signups
ALTER TABLE chains ADD COLUMN seeded_at timestamptz;

-- Tag Scooter's as seeded
UPDATE chains SET seeded_at = now() WHERE id = 'CHN-SCOOTERS-0';
