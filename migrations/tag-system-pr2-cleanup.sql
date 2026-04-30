-- Migration: Tag system cleanup for the new filter architecture (PR 2)
--
-- Purpose:
--   1. Add is_active flag to tag_categories + tags (preserves data while archiving)
--   2. Add top_type to tags (Eat/Drink/Play/Pamper for the new Type filter)
--   3. Create "Extras" category with Pet Friendly + Patio
--   4. Archive Vibe, Amenities, Popular, Price Range categories (is_active=false)
--   5. Backfill top_type on all 30 Business Type tags
--
-- Idempotent: safe to run multiple times. Existing data preserved.
--
-- Rollback (paste each block separately if you ever need to revert):
--   UPDATE tag_categories SET is_active = true
--     WHERE name IN ('Vibe','Amenities','Popular','Price Range');
--   UPDATE tags SET category_id = (SELECT id FROM tag_categories WHERE name='Popular')
--     WHERE slug='pet-friendly';
--   UPDATE tags SET name='Patio Seating', slug='patio-seating',
--     category_id = (SELECT id FROM tag_categories WHERE name='Amenities')
--     WHERE slug='patio';
--   DELETE FROM tags WHERE category_id = (SELECT id FROM tag_categories WHERE name='Extras');
--   DELETE FROM tag_categories WHERE name='Extras';
--   ALTER TABLE tags DROP COLUMN top_type;
--   ALTER TABLE tags DROP COLUMN is_active;
--   ALTER TABLE tag_categories DROP COLUMN is_active;

-- ── 1. Add columns ──────────────────────────────────────────────────
ALTER TABLE tag_categories ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE tags ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE tags ADD COLUMN IF NOT EXISTS top_type text
  CHECK (top_type IN ('eat','drink','play','pamper') OR top_type IS NULL);

-- ── 2. Create the Extras category ───────────────────────────────────
INSERT INTO tag_categories (name, icon, scope, requires_food, is_active)
VALUES ('Extras', '✨', ARRAY['business']::text[], false, true)
ON CONFLICT (name) DO UPDATE SET
  icon = EXCLUDED.icon,
  scope = EXCLUDED.scope,
  requires_food = EXCLUDED.requires_food,
  is_active = EXCLUDED.is_active;

-- ── 3. Move Pet Friendly: Popular → Extras ──────────────────────────
UPDATE tags
SET category_id = (SELECT id FROM tag_categories WHERE name = 'Extras')
WHERE slug = 'pet-friendly';

-- ── 4. Move + rename Patio Seating → Patio (Amenities → Extras) ─────
UPDATE tags
SET
  category_id = (SELECT id FROM tag_categories WHERE name = 'Extras'),
  name = 'Patio',
  slug = 'patio'
WHERE slug = 'patio-seating';

-- ── 5. Archive cut categories ───────────────────────────────────────
UPDATE tag_categories
SET is_active = false
WHERE name IN ('Vibe', 'Amenities', 'Popular', 'Price Range');

-- ── 6. Backfill top_type on Business Type tags ──────────────────────
UPDATE tags SET top_type = 'eat'
WHERE category_id = (SELECT id FROM tag_categories WHERE name = 'Business Type')
  AND name IN ('Restaurant','Bakery','Deli','Ice Cream','Juice Bar','Food Truck');

UPDATE tags SET top_type = 'drink'
WHERE category_id = (SELECT id FROM tag_categories WHERE name = 'Business Type')
  AND name IN ('Coffee','Bar','Brewery','Winery','Lounge','Pub','Sports Bar','Karaoke','Nightclub');

UPDATE tags SET top_type = 'play'
WHERE category_id = (SELECT id FROM tag_categories WHERE name = 'Business Type')
  AND name IN ('Entertainment','Activity','Arcade','Bowling','Mini Golf','Escape Room',
               'Theater','Comedy Club','Art Gallery','Museum','Gym','Yoga Studio','Dance Studio');

UPDATE tags SET top_type = 'pamper'
WHERE category_id = (SELECT id FROM tag_categories WHERE name = 'Business Type')
  AND name IN ('Spa','Salon/Beauty');

-- ── 7. Sanity check (run after migration to verify) ─────────────────
-- Should return zero rows. Any tag listed has been seeded into Business Type
-- after this migration was written and needs a top_type value picked manually.
--
--   SELECT t.name FROM tags t
--   JOIN tag_categories c ON t.category_id = c.id
--   WHERE c.name = 'Business Type' AND t.top_type IS NULL;
--
-- Should return 1 row (the Extras category):
--
--   SELECT name FROM tag_categories WHERE name='Extras' AND is_active=true;
--
-- Should return 4 rows (the archived categories):
--
--   SELECT name FROM tag_categories
--   WHERE name IN ('Vibe','Amenities','Popular','Price Range') AND is_active=false;
--
-- Should return 2 rows: Pet Friendly + Patio:
--
--   SELECT t.name FROM tags t
--   JOIN tag_categories c ON t.category_id = c.id
--   WHERE c.name='Extras';
