CREATE TABLE postcard_mailings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  campaign text NOT NULL,
  quantity integer NOT NULL,
  cost_cents integer NOT NULL,
  mailed_date date NOT NULL,
  notes text
);

ALTER TABLE postcard_mailings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage postcard_mailings"
  ON postcard_mailings FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM staff_users))
  WITH CHECK (auth.uid() IN (SELECT user_id FROM staff_users));
