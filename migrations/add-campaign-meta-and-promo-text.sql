-- ============================================================
-- Migration: Add meta (JSONB) and promo_text columns to
-- business_ad_campaigns.
--
-- meta: flexible JSONB for image_url, push_message, priority_days, etc.
-- promo_text: optional promotional text the business can display
--             in their sponsored discovery placement.
-- ============================================================

ALTER TABLE business_ad_campaigns
  ADD COLUMN IF NOT EXISTS meta JSONB,
  ADD COLUMN IF NOT EXISTS promo_text TEXT;
