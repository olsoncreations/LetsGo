-- Sales appointments — scheduled meetings between sales reps and prospects
-- Lives alongside sales_leads; one lead can have many appointments over time

CREATE TABLE sales_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES sales_leads(id) ON DELETE CASCADE,
  assigned_rep_id uuid REFERENCES sales_reps(id) ON DELETE SET NULL,
  scheduled_at timestamptz NOT NULL,
  duration_min int NOT NULL DEFAULT 30
    CHECK (duration_min IN (15, 30, 45, 60, 90, 120)),
  location text,
  notes text,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  reminder_24h_sent_at timestamptz,
  reminder_1h_sent_at timestamptz
);

CREATE INDEX idx_sales_appts_rep_time
  ON sales_appointments(assigned_rep_id, scheduled_at);
CREATE INDEX idx_sales_appts_lead
  ON sales_appointments(lead_id);
CREATE INDEX idx_sales_appts_upcoming
  ON sales_appointments(scheduled_at)
  WHERE status = 'scheduled';

ALTER TABLE sales_appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_read_sales_appointments" ON sales_appointments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM staff_users WHERE user_id = auth.uid())
  );

CREATE POLICY "staff_write_sales_appointments" ON sales_appointments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM staff_users WHERE user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM staff_users WHERE user_id = auth.uid())
  );

CREATE OR REPLACE FUNCTION set_sales_appointments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

CREATE TRIGGER trg_sales_appointments_updated_at
  BEFORE UPDATE ON sales_appointments
  FOR EACH ROW
  EXECUTE FUNCTION set_sales_appointments_updated_at();
