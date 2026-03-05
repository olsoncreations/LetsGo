-- ============================================================
-- Migration: Add Surge Pricing ("Hot Days") Feature
--
-- Creates surge_pricing_events table for management to assign
-- custom rate increases per holiday/event. Adds price breakdown
-- columns to business_ad_campaigns (base + surge = total).
-- Seeds 25 events at 1.0x (no surge) — management sets rates.
-- ============================================================

-- 1. Create surge_pricing_events table
CREATE TABLE IF NOT EXISTS surge_pricing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  categories TEXT[] NOT NULL DEFAULT '{}',
  multiplier_bps INT NOT NULL DEFAULT 10000,
  impact TEXT NOT NULL DEFAULT 'medium'
    CHECK (impact IN ('critical', 'high', 'medium', 'low')),
  suggested_products TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT,
  CHECK (end_date >= start_date),
  CHECK (multiplier_bps >= 10000 AND multiplier_bps <= 50000)
);

CREATE INDEX IF NOT EXISTS idx_surge_events_dates
  ON surge_pricing_events (start_date, end_date) WHERE is_active = true;

-- RLS: anyone can read (businesses need to see surge pricing), staff can manage
ALTER TABLE surge_pricing_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read surge events"
  ON surge_pricing_events FOR SELECT USING (true);

CREATE POLICY "Staff can manage surge events"
  ON surge_pricing_events FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM staff_users));

-- 2. Add price breakdown columns to business_ad_campaigns
ALTER TABLE business_ad_campaigns
  ADD COLUMN IF NOT EXISTS base_price_cents INT,
  ADD COLUMN IF NOT EXISTS surge_fee_cents INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS surge_event_id UUID REFERENCES surge_pricing_events(id),
  ADD COLUMN IF NOT EXISTS surge_multiplier_bps INT;

-- Backfill: existing campaigns had no surge, so base = total
UPDATE business_ad_campaigns
SET base_price_cents = price_cents
WHERE base_price_cents IS NULL;

-- 3. Seed 25 forecast events — all at 1.0x (10000 bps = no surge)
-- Management sets each event's rate individually via the CRUD UI
INSERT INTO surge_pricing_events (name, description, start_date, end_date, categories, multiplier_bps, impact, suggested_products) VALUES
('New Year''s Eve', 'Biggest night out of the year. Restaurants, bars, and nightlife fully booked.', '2026-12-31', '2026-12-31', '{"restaurant_bar","activity"}', 10000, 'critical', '{"ad_7day","ad_100mile"}'),
('Super Bowl Sunday', 'Top sports bar / restaurant night. High group dining traffic.', '2027-02-07', '2027-02-07', '{"restaurant_bar"}', 10000, 'critical', '{"ad_1day","ad_100mile"}'),
('Valentine''s Day', 'Peak date night. Restaurants, salons, and spas see massive demand.', '2027-02-14', '2027-02-14', '{"restaurant_bar","salon_beauty"}', 10000, 'critical', '{"ad_7day","ad_100mile"}'),
('Mardi Gras', 'Strong for bars and themed events, especially in party districts.', '2027-02-16', '2027-02-16', '{"restaurant_bar","activity"}', 10000, 'medium', '{"ad_1day"}'),
('Spring Break Season', '2-3 week window of high activity traffic.', '2027-03-10', '2027-03-28', '{"restaurant_bar","activity"}', 10000, 'high', '{"ad_14day","ad_tourwide"}'),
('St. Patrick''s Day', 'Big bar and pub night. Irish restaurants and downtown bars see huge traffic.', '2027-03-17', '2027-03-17', '{"restaurant_bar"}', 10000, 'high', '{"ad_1day","ad_7day"}'),
('March Madness', '3-week college basketball tournament. Sports bars, wing joints peak.', '2027-03-16', '2027-04-05', '{"restaurant_bar"}', 10000, 'high', '{"ad_14day","ad_tourwide"}'),
('Easter Weekend', 'Family brunch and dinner reservations spike.', '2027-03-28', '2027-03-28', '{"restaurant_bar"}', 10000, 'medium', '{"ad_7day"}'),
('Cinco de Mayo', 'Mexican restaurants, bars, and party venues see major spikes.', '2027-05-05', '2027-05-05', '{"restaurant_bar"}', 10000, 'high', '{"ad_1day","ad_100mile"}'),
('Mother''s Day', 'One of the busiest restaurant days of the year. Salons peak too.', '2027-05-09', '2027-05-09', '{"restaurant_bar","salon_beauty"}', 10000, 'critical', '{"ad_7day","ad_100mile"}'),
('Memorial Day Weekend', 'Unofficial start of summer. BBQ, outdoor dining, activities surge.', '2027-05-29', '2027-05-31', '{"restaurant_bar","activity"}', 10000, 'high', '{"ad_7day"}'),
('Father''s Day', 'Steakhouses, sports activities, and outdoor experiences peak.', '2027-06-20', '2027-06-20', '{"restaurant_bar","activity"}', 10000, 'high', '{"ad_7day"}'),
('College World Series', 'Massive local event. Every restaurant, bar, and activity venue sees visitors.', '2027-06-12', '2027-06-23', '{"restaurant_bar","activity","salon_beauty"}', 10000, 'critical', '{"ad_14day","ad_tourwide","ad_100mile"}'),
('4th of July', 'Independence Day celebrations. Outdoor events, BBQ spots, fireworks.', '2027-07-04', '2027-07-04', '{"restaurant_bar","activity"}', 10000, 'critical', '{"ad_7day","ad_100mile"}'),
('Summer Peak Season', 'Peak tourism and outdoor activity window.', '2027-06-15', '2027-08-15', '{"activity","restaurant_bar"}', 10000, 'high', '{"ad_tourwide"}'),
('Back to School', 'Salons spike with haircuts. Family restaurants see last-hurrah dinners.', '2027-08-01', '2027-08-20', '{"salon_beauty","restaurant_bar"}', 10000, 'medium', '{"ad_7day"}'),
('Labor Day Weekend', 'Last summer hurrah. Outdoor dining, concerts, and activities.', '2027-09-06', '2027-09-06', '{"restaurant_bar","activity"}', 10000, 'high', '{"ad_7day"}'),
('Halloween', 'Themed events, haunted houses, costume parties, bar crawls.', '2027-10-31', '2027-10-31', '{"restaurant_bar","activity"}', 10000, 'high', '{"ad_7day","ad_100mile"}'),
('College Football Season', 'Every Saturday is a marketing opportunity for sports bars.', '2027-09-04', '2027-12-04', '{"restaurant_bar"}', 10000, 'high', '{"ad_14day","ad_tourwide"}'),
('Thanksgiving', 'Thanksgiving Eve is one of the biggest bar nights.', '2027-11-25', '2027-11-25', '{"restaurant_bar"}', 10000, 'high', '{"ad_7day"}'),
('Black Friday Weekend', 'Shopping traffic spills into restaurants and entertainment.', '2027-11-26', '2027-11-28', '{"restaurant_bar","activity","salon_beauty"}', 10000, 'high', '{"ad_7day"}'),
('Holiday Season', 'Company holiday parties, family dinners, gift card season.', '2027-12-01', '2027-12-30', '{"restaurant_bar","salon_beauty","activity"}', 10000, 'critical', '{"ad_tourwide","ad_14day"}'),
('Prom & Formal Season', 'Hair, nails, makeup surge. Pre-prom dinners at upscale restaurants.', '2027-04-15', '2027-05-15', '{"salon_beauty","restaurant_bar"}', 10000, 'high', '{"ad_14day"}'),
('Wedding Season', 'Sustained beauty demand - bridal parties, rehearsal dinners.', '2027-05-01', '2027-10-31', '{"salon_beauty"}', 10000, 'high', '{"ad_tourwide"}');
