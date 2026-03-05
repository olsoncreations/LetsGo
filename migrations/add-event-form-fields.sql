-- Migration: Add price_level, event_size, tags columns to business_events
-- These enable proper filtering on the events discovery page and richer event metadata.
-- Run this in the Supabase SQL Editor.

-- 1) Price level — filter-friendly tier ($, $$, $$$, $$$$)
ALTER TABLE business_events
  ADD COLUMN IF NOT EXISTS price_level text
    CHECK (price_level IN ('$', '$$', '$$$', '$$$$'));

-- 2) Event size — category label for capacity filtering
ALTER TABLE business_events
  ADD COLUMN IF NOT EXISTS event_size text
    CHECK (event_size IN ('intimate', 'small', 'medium', 'large', 'massive'));

-- 3) Tags — same tag values used on business profiles
ALTER TABLE business_events
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- Index for tag-based queries (GIN index on text array)
CREATE INDEX IF NOT EXISTS idx_business_events_tags ON business_events USING GIN (tags);
