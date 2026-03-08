-- Fix: ON CONFLICT DO NOTHING in the seed script meant existing categories/tags
-- never got their requires_food / is_food values updated.
-- This migration sets the correct values.

-- ══════════════════════════════════════════════════════════════
-- 1. Fix requires_food on tag_categories
-- ══════════════════════════════════════════════════════════════

UPDATE tag_categories SET requires_food = true WHERE name = 'Cuisine';
UPDATE tag_categories SET requires_food = true WHERE name = 'Dietary';
UPDATE tag_categories SET requires_food = true WHERE name = 'Service Style';

-- ══════════════════════════════════════════════════════════════
-- 2. Fix is_food on Business Type tags
-- ══════════════════════════════════════════════════════════════

UPDATE tags SET is_food = true
WHERE slug IN (
  'restaurant', 'bar', 'coffee', 'bakery', 'deli',
  'ice-cream', 'juice-bar', 'food-truck', 'brewery',
  'winery', 'lounge', 'pub', 'sports-bar'
)
AND category_id = (SELECT id FROM tag_categories WHERE name = 'Business Type');

-- Ensure non-food types are explicitly false
UPDATE tags SET is_food = false
WHERE slug IN (
  'entertainment', 'activity', 'nightclub', 'karaoke',
  'arcade', 'bowling', 'mini-golf', 'escape-room',
  'theater', 'comedy-club', 'art-gallery', 'museum',
  'spa', 'gym', 'yoga-studio', 'dance-studio', 'salon-beauty'
)
AND category_id = (SELECT id FROM tag_categories WHERE name = 'Business Type');

-- ══════════════════════════════════════════════════════════════
-- 3. Fix scope on tag_categories (ensure correct values)
-- ══════════════════════════════════════════════════════════════

UPDATE tag_categories SET scope = ARRAY['business','game'] WHERE name = 'Business Type';
UPDATE tag_categories SET scope = ARRAY['business'] WHERE name = 'Cuisine';
UPDATE tag_categories SET scope = ARRAY['business','event'] WHERE name = 'Vibe';
UPDATE tag_categories SET scope = ARRAY['business'] WHERE name = 'Amenities';
UPDATE tag_categories SET scope = ARRAY['business'] WHERE name = 'Dietary';
UPDATE tag_categories SET scope = ARRAY['business'] WHERE name = 'Popular';
UPDATE tag_categories SET scope = ARRAY['event'] WHERE name = 'Event Type';
UPDATE tag_categories SET scope = ARRAY['event'] WHERE name = 'Event Vibe';
UPDATE tag_categories SET scope = ARRAY['business'] WHERE name = 'Service Style';

-- ══════════════════════════════════════════════════════════════
-- 4. Fix icon + sort_order on Business Type tags
-- ══════════════════════════════════════════════════════════════

UPDATE tags SET icon = '🍽️', sort_order = 1  WHERE slug = 'restaurant';
UPDATE tags SET icon = '🍸', sort_order = 2  WHERE slug = 'bar';
UPDATE tags SET icon = '☕', sort_order = 3  WHERE slug = 'coffee';
UPDATE tags SET icon = '🧁', sort_order = 4  WHERE slug = 'bakery';
UPDATE tags SET icon = '🥪', sort_order = 5  WHERE slug = 'deli';
UPDATE tags SET icon = '🍦', sort_order = 6  WHERE slug = 'ice-cream';
UPDATE tags SET icon = '🧃', sort_order = 7  WHERE slug = 'juice-bar';
UPDATE tags SET icon = '🚚', sort_order = 8  WHERE slug = 'food-truck';
UPDATE tags SET icon = '🍺', sort_order = 9  WHERE slug = 'brewery';
UPDATE tags SET icon = '🍷', sort_order = 10 WHERE slug = 'winery';
UPDATE tags SET icon = '🛋️', sort_order = 11 WHERE slug = 'lounge';
UPDATE tags SET icon = '🍻', sort_order = 12 WHERE slug = 'pub';
UPDATE tags SET icon = '📺', sort_order = 13 WHERE slug = 'sports-bar';
UPDATE tags SET icon = '🎬', sort_order = 14 WHERE slug = 'entertainment';
UPDATE tags SET icon = '🎯', sort_order = 15 WHERE slug = 'activity';
UPDATE tags SET icon = '🪩', sort_order = 16 WHERE slug = 'nightclub';
UPDATE tags SET icon = '🎤', sort_order = 17 WHERE slug = 'karaoke';
UPDATE tags SET icon = '🕹️', sort_order = 18 WHERE slug = 'arcade';
UPDATE tags SET icon = '🎳', sort_order = 19 WHERE slug = 'bowling';
UPDATE tags SET icon = '⛳', sort_order = 20 WHERE slug = 'mini-golf';
UPDATE tags SET icon = '🔐', sort_order = 21 WHERE slug = 'escape-room';
UPDATE tags SET icon = '🎭', sort_order = 22 WHERE slug = 'theater';
UPDATE tags SET icon = '😂', sort_order = 23 WHERE slug = 'comedy-club';
UPDATE tags SET icon = '🖼️', sort_order = 24 WHERE slug = 'art-gallery';
UPDATE tags SET icon = '🏛️', sort_order = 25 WHERE slug = 'museum';
UPDATE tags SET icon = '🧖', sort_order = 26 WHERE slug = 'spa';
UPDATE tags SET icon = '💪', sort_order = 27 WHERE slug = 'gym';
UPDATE tags SET icon = '🧘', sort_order = 28 WHERE slug = 'yoga-studio';
UPDATE tags SET icon = '💃', sort_order = 29 WHERE slug = 'dance-studio';
UPDATE tags SET icon = '💇', sort_order = 30 WHERE slug = 'salon-beauty';
