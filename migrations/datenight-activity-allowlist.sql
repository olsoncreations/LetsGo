-- Migration: Date Night activity allow-list (PR 5b)
--
-- Purpose:
--   1. Add is_date_night_activity boolean to tags
--   2. Mark existing date-friendly Business Type tags as date-night activities
--      (the rest stay false — flips Date Night from a deny-list model to an
--      allow-list model so new business types default to "not a date" until
--      explicitly approved by an admin)
--   3. Add 8 new date-friendly Business Type tags: Aquarium, Zoo, Botanical
--      Garden, Axe Throwing, VR Arcade, Laser Tag, Ice Skating, Roller Skating
--      + 2 not-date-friendly venue tags: Wedding Venue, Event Venue
--
-- Idempotent: safe to run multiple times.
--
-- Rollback:
--   DELETE FROM tags WHERE slug IN ('aquarium','zoo','botanical-garden','axe-throwing',
--     'vr-arcade','laser-tag','ice-skating','roller-skating','wedding-venue','event-venue');
--   ALTER TABLE tags DROP COLUMN is_date_night_activity;

-- ── 1. Add column ────────────────────────────────────────────────────
ALTER TABLE tags ADD COLUMN IF NOT EXISTS is_date_night_activity boolean NOT NULL DEFAULT false;

-- ── 2. Mark existing Business Type tags that ARE date-friendly ───────
-- Activity (generic catchall), Gym, Yoga Studio, Dance Studio, Spa, Salon/Beauty
-- intentionally stay false. All eat/drink subtypes also stay false because
-- they're handled as Restaurants in a separate scoring path.
UPDATE tags SET is_date_night_activity = true
WHERE category_id = (SELECT id FROM tag_categories WHERE name = 'Business Type')
  AND name IN ('Arcade', 'Bowling', 'Mini Golf', 'Escape Room',
               'Theater', 'Comedy Club', 'Art Gallery', 'Museum', 'Entertainment');

-- ── 3. Add new Business Type tags ────────────────────────────────────
INSERT INTO tags (name, slug, icon, sort_order, is_food, is_active, top_type, is_date_night_activity, category_id)
SELECT t.name, t.slug, t.icon, t.sort_order, false, true, t.top_type, t.date_night, c.id
FROM (VALUES
  ('Aquarium',         'aquarium',          '🐠', 31, 'play'::text, true),
  ('Zoo',              'zoo',               '🦁', 32, 'play'::text, true),
  ('Botanical Garden', 'botanical-garden',  '🌷', 33, 'play'::text, true),
  ('Axe Throwing',     'axe-throwing',      '🪓', 34, 'play'::text, true),
  ('VR Arcade',        'vr-arcade',         '🥽', 35, 'play'::text, true),
  ('Laser Tag',        'laser-tag',         '🔫', 36, 'play'::text, true),
  ('Ice Skating',      'ice-skating',       '⛸️', 37, 'play'::text, true),
  ('Roller Skating',   'roller-skating',    '🛼', 38, 'play'::text, true),
  ('Wedding Venue',    'wedding-venue',     '💒', 39, NULL,         false),
  ('Event Venue',      'event-venue',       '🎪', 40, NULL,         false)
) AS t(name, slug, icon, sort_order, top_type, date_night)
CROSS JOIN tag_categories c
WHERE c.name = 'Business Type'
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order,
  top_type = EXCLUDED.top_type,
  is_date_night_activity = EXCLUDED.is_date_night_activity,
  category_id = EXCLUDED.category_id;

-- ── 4. Sanity check (run after migration to verify) ──────────────────
-- Should list all 40 Business Type tags with their flags:
--   SELECT name, top_type, is_date_night_activity FROM tags
--   WHERE category_id = (SELECT id FROM tag_categories WHERE name = 'Business Type')
--   ORDER BY sort_order;
