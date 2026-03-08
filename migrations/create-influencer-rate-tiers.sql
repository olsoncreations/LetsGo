-- Migration: Influencer Tiered Rate System
-- Replaces flat rate_per_thousand_cents with per-influencer tiered rates (tax-bracket style)

-- 1. Create influencer_rate_tiers table
CREATE TABLE IF NOT EXISTS influencer_rate_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  tier_index INTEGER NOT NULL,               -- 1, 2, 3... (ordering)
  min_signups INTEGER NOT NULL,              -- inclusive lower bound
  max_signups INTEGER,                       -- inclusive upper bound, NULL = unlimited
  rate_cents INTEGER NOT NULL,               -- dollars per signup in cents (3000 = $30.00)
  label TEXT,                                -- optional: "Starter", "Growth", etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(influencer_id, tier_index)
);

CREATE INDEX IF NOT EXISTS idx_influencer_rate_tiers_influencer
  ON influencer_rate_tiers(influencer_id);

-- 2. Enable RLS
ALTER TABLE influencer_rate_tiers ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admin full access to influencer_rate_tiers"
  ON influencer_rate_tiers FOR ALL
  USING (EXISTS (SELECT 1 FROM staff_users WHERE staff_users.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM staff_users WHERE staff_users.user_id = auth.uid()));

-- Influencers can read their own tiers
CREATE POLICY "Influencers read own rate tiers"
  ON influencer_rate_tiers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM influencers
      WHERE influencers.id = influencer_rate_tiers.influencer_id
      AND influencers.user_id = auth.uid()
    )
  );

-- 3. Add rate_tiers_snapshot to influencer_payouts for historical accuracy
ALTER TABLE influencer_payouts
  ADD COLUMN IF NOT EXISTS rate_tiers_snapshot JSONB;

-- 4. Add default_influencer_tiers to platform_settings
ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS default_influencer_tiers JSONB;

-- 5. Seed default influencer tiers in platform_settings
UPDATE platform_settings
SET default_influencer_tiers = '[
  { "tier_index": 1, "min_signups": 1, "max_signups": 50, "rate_cents": 3000, "label": "Starter" },
  { "tier_index": 2, "min_signups": 51, "max_signups": 200, "rate_cents": 2500, "label": "Growth" },
  { "tier_index": 3, "min_signups": 201, "max_signups": 500, "rate_cents": 2000, "label": "Scale" },
  { "tier_index": 4, "min_signups": 501, "max_signups": null, "rate_cents": 1500, "label": "Volume" }
]'::jsonb
WHERE id = 1;

-- 6. Migrate existing influencers to default tiers
INSERT INTO influencer_rate_tiers (influencer_id, tier_index, min_signups, max_signups, rate_cents, label)
SELECT id, 1, 1, 50, 3000, 'Starter' FROM influencers WHERE status IN ('active', 'paused')
ON CONFLICT (influencer_id, tier_index) DO NOTHING;

INSERT INTO influencer_rate_tiers (influencer_id, tier_index, min_signups, max_signups, rate_cents, label)
SELECT id, 2, 51, 200, 2500, 'Growth' FROM influencers WHERE status IN ('active', 'paused')
ON CONFLICT (influencer_id, tier_index) DO NOTHING;

INSERT INTO influencer_rate_tiers (influencer_id, tier_index, min_signups, max_signups, rate_cents, label)
SELECT id, 3, 201, 500, 2000, 'Scale' FROM influencers WHERE status IN ('active', 'paused')
ON CONFLICT (influencer_id, tier_index) DO NOTHING;

INSERT INTO influencer_rate_tiers (influencer_id, tier_index, min_signups, max_signups, rate_cents, label)
SELECT id, 4, 501, NULL, 1500, 'Volume' FROM influencers WHERE status IN ('active', 'paused')
ON CONFLICT (influencer_id, tier_index) DO NOTHING;
