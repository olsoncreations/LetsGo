-- Migration: Add columns to tags + tag_categories for unified DB-driven tag system
-- Safe to run multiple times (IF NOT EXISTS / IF NOT EXISTS checks)

-- 1. Add icon column to tags (per-tag emoji, e.g. Restaurant = icon)
ALTER TABLE tags ADD COLUMN IF NOT EXISTS icon text;

-- 2. Add sort_order column to tags (display ordering within a category)
ALTER TABLE tags ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;

-- 3. Add is_food flag to tags (controls whether Cuisine/Dietary categories show)
ALTER TABLE tags ADD COLUMN IF NOT EXISTS is_food boolean DEFAULT false;

-- 4. Add scope column to tag_categories (which contexts use this category)
ALTER TABLE tag_categories ADD COLUMN IF NOT EXISTS scope text[] DEFAULT ARRAY['business']::text[];

-- 5. Add requires_food flag to tag_categories (only show when a food-type business is selected)
ALTER TABLE tag_categories ADD COLUMN IF NOT EXISTS requires_food boolean DEFAULT false;

-- 6. Ensure unique constraints exist (needed for ON CONFLICT in seed script)
CREATE UNIQUE INDEX IF NOT EXISTS tags_slug_unique ON tags (slug);
CREATE UNIQUE INDEX IF NOT EXISTS tag_categories_name_unique ON tag_categories (name);
