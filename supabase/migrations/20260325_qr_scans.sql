CREATE TABLE qr_scans (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign text NOT NULL,
  scanned_at timestamptz DEFAULT now(),
  ip_address text,
  user_agent text,
  referer text
);

ALTER TABLE qr_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read qr_scans"
  ON qr_scans FOR SELECT
  USING (auth.uid() IN (SELECT user_id FROM staff_users));

CREATE POLICY "Allow inserts from API"
  ON qr_scans FOR INSERT
  WITH CHECK (true);
