-- Seed: Unified tag categories + tags for DB-driven filter system
-- Idempotent — uses ON CONFLICT DO NOTHING so safe to run multiple times.
-- Run AFTER add-tag-system-columns.sql

-- ══════════════════════════════════════════════════════════════
-- 1. TAG CATEGORIES
-- ══════════════════════════════════════════════════════════════

INSERT INTO tag_categories (name, icon, scope, requires_food) VALUES
  ('Business Type', '🏢', ARRAY['business','game'], false),
  ('Cuisine',       '🍽️', ARRAY['business'],        true),
  ('Vibe',          '✨', ARRAY['business','event'], false),
  ('Amenities',     '🏷️', ARRAY['business'],        false),
  ('Dietary',       '🥗', ARRAY['business'],        true),
  ('Popular',       '🔥', ARRAY['business'],        false),
  ('Event Type',    '📅', ARRAY['event'],            false),
  ('Event Vibe',    '🎉', ARRAY['event'],            false)
ON CONFLICT (name) DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- 2. BUSINESS TYPE TAGS (with icons + is_food flag)
-- ══════════════════════════════════════════════════════════════

INSERT INTO tags (name, slug, icon, is_food, sort_order, category_id)
SELECT t.name, t.slug, t.icon, t.is_food, t.sort_order, c.id
FROM (VALUES
  ('Restaurant',    'restaurant',     '🍽️', true,  1),
  ('Bar',           'bar',            '🍸', true,  2),
  ('Coffee',        'coffee',         '☕', true,  3),
  ('Bakery',        'bakery',         '🧁', true,  4),
  ('Deli',          'deli',           '🥪', true,  5),
  ('Ice Cream',     'ice-cream',      '🍦', true,  6),
  ('Juice Bar',     'juice-bar',      '🧃', true,  7),
  ('Food Truck',    'food-truck',     '🚚', true,  8),
  ('Brewery',       'brewery',        '🍺', true,  9),
  ('Winery',        'winery',         '🍷', true,  10),
  ('Lounge',        'lounge',         '🛋️', true,  11),
  ('Pub',           'pub',            '🍻', true,  12),
  ('Sports Bar',    'sports-bar',     '📺', true,  13),
  ('Entertainment', 'entertainment',  '🎬', false, 14),
  ('Activity',      'activity',       '🎯', false, 15),
  ('Nightclub',     'nightclub',      '🪩', false, 16),
  ('Karaoke',       'karaoke',        '🎤', false, 17),
  ('Arcade',        'arcade',         '🕹️', false, 18),
  ('Bowling',       'bowling',        '🎳', false, 19),
  ('Mini Golf',     'mini-golf',      '⛳', false, 20),
  ('Escape Room',   'escape-room',    '🔐', false, 21),
  ('Theater',       'theater',        '🎭', false, 22),
  ('Comedy Club',   'comedy-club',    '😂', false, 23),
  ('Art Gallery',   'art-gallery',    '🖼️', false, 24),
  ('Museum',        'museum',         '🏛️', false, 25),
  ('Spa',           'spa',            '🧖', false, 26),
  ('Gym',           'gym',            '💪', false, 27),
  ('Yoga Studio',   'yoga-studio',    '🧘', false, 28),
  ('Dance Studio',  'dance-studio',   '💃', false, 29),
  ('Salon/Beauty',  'salon-beauty',   '💇', false, 30)
) AS t(name, slug, icon, is_food, sort_order)
CROSS JOIN tag_categories c
WHERE c.name = 'Business Type'
ON CONFLICT (slug) DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- 3. CUISINE TAGS
-- ══════════════════════════════════════════════════════════════

INSERT INTO tags (name, slug, sort_order, category_id)
SELECT t.name, t.slug, t.sort_order, c.id
FROM (VALUES
  ('American',       'american',        1),
  ('Italian',        'italian',         2),
  ('Mexican',        'mexican',         3),
  ('Chinese',        'chinese',         4),
  ('Japanese',       'japanese',        5),
  ('Thai',           'thai',            6),
  ('Indian',         'indian',          7),
  ('Korean',         'korean',          8),
  ('Vietnamese',     'vietnamese',      9),
  ('Mediterranean',  'mediterranean',   10),
  ('Greek',          'greek',           11),
  ('French',         'french',          12),
  ('Spanish',        'spanish',         13),
  ('Caribbean',      'caribbean',       14),
  ('Ethiopian',      'ethiopian',       15),
  ('Peruvian',       'peruvian',        16),
  ('Brazilian',      'brazilian',       17),
  ('Middle Eastern', 'middle-eastern',  18),
  ('Moroccan',       'moroccan',        19),
  ('Southern',       'southern',        20),
  ('Cajun',          'cajun',           21),
  ('BBQ',            'bbq',             22),
  ('Seafood',        'seafood',         23),
  ('Steakhouse',     'steakhouse',      24),
  ('Sushi',          'sushi',           25),
  ('Ramen',          'ramen',           26),
  ('Pizza',          'pizza',           27),
  ('Burgers',        'burgers',         28),
  ('Tacos',          'tacos',           29),
  ('Poke',           'poke',            30),
  ('Farm-to-Table',  'farm-to-table',   31),
  ('Fusion',         'fusion',          32)
) AS t(name, slug, sort_order)
CROSS JOIN tag_categories c
WHERE c.name = 'Cuisine'
ON CONFLICT (slug) DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- 4. VIBE TAGS (scope: business + event)
-- ══════════════════════════════════════════════════════════════

INSERT INTO tags (name, slug, sort_order, category_id)
SELECT t.name, t.slug, t.sort_order, c.id
FROM (VALUES
  ('Romantic',       'romantic',        1),
  ('Chill',          'chill',           2),
  ('Lively',         'lively',          3),
  ('Upscale',        'upscale',         4),
  ('Casual',         'casual',          5),
  ('Trendy',         'trendy',          6),
  ('Cozy',           'cozy',            7),
  ('Retro',          'retro',           8),
  ('Modern',         'modern',          9),
  ('Rustic',         'rustic',          10),
  ('Industrial',     'industrial',      11),
  ('Bohemian',       'bohemian',        12),
  ('Rooftop',        'rooftop',         13),
  ('Waterfront',     'waterfront',      14),
  ('Hidden Gem',     'hidden-gem',      15),
  ('Instagrammable', 'instagrammable',  16),
  ('Speakeasy',      'speakeasy',       17),
  ('Dive Bar',       'dive-bar',        18),
  ('Sports Vibe',    'sports-vibe',     19),
  ('Artsy',          'artsy',           20)
) AS t(name, slug, sort_order)
CROSS JOIN tag_categories c
WHERE c.name = 'Vibe'
ON CONFLICT (slug) DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- 5. AMENITY TAGS
-- ══════════════════════════════════════════════════════════════

INSERT INTO tags (name, slug, sort_order, category_id)
SELECT t.name, t.slug, t.sort_order, c.id
FROM (VALUES
  ('Free WiFi',              'free-wifi',              1),
  ('Parking',                'parking',                2),
  ('Wheelchair Accessible',  'wheelchair-accessible',  3),
  ('Reservations',           'reservations',           4),
  ('Takeout',                'takeout',                5),
  ('Delivery',               'delivery',               6),
  ('Dine-in',                'dine-in',                7),
  ('Patio Seating',          'patio-seating',          8),
  ('Private Rooms',          'private-rooms',          9),
  ('Full Bar',               'full-bar',               10),
  ('Beer Garden',            'beer-garden',            11),
  ('Fireplace',              'fireplace',              12),
  ('Pool Table',             'pool-table',             13),
  ('Dart Board',             'dart-board',             14),
  ('TV Screens',             'tv-screens',             15),
  ('Projector',              'projector',              16),
  ('Stage',                  'stage',                  17),
  ('Dance Floor',            'dance-floor',            18),
  ('Valet',                  'valet',                  19),
  ('EV Charging',            'ev-charging',            20)
) AS t(name, slug, sort_order)
CROSS JOIN tag_categories c
WHERE c.name = 'Amenities'
ON CONFLICT (slug) DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- 6. DIETARY TAGS
-- ══════════════════════════════════════════════════════════════

INSERT INTO tags (name, slug, sort_order, category_id)
SELECT t.name, t.slug, t.sort_order, c.id
FROM (VALUES
  ('Vegetarian',     'vegetarian',      1),
  ('Vegan',          'vegan',           2),
  ('Gluten-Free',    'gluten-free',     3),
  ('Halal',          'halal',           4),
  ('Kosher',         'kosher',          5),
  ('Keto-Friendly',  'keto-friendly',   6),
  ('Dairy-Free',     'dairy-free',      7),
  ('Nut-Free',       'nut-free',        8),
  ('Organic',        'organic',         9),
  ('Locally Sourced','locally-sourced', 10)
) AS t(name, slug, sort_order)
CROSS JOIN tag_categories c
WHERE c.name = 'Dietary'
ON CONFLICT (slug) DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- 7. POPULAR TAGS
-- ══════════════════════════════════════════════════════════════

INSERT INTO tags (name, slug, sort_order, category_id)
SELECT t.name, t.slug, t.sort_order, c.id
FROM (VALUES
  ('Date Night',          'date-night',          1),
  ('Happy Hour',          'happy-hour',          2),
  ('Family',              'family',              3),
  ('Live Music',          'live-music',          4),
  ('Outdoor',             'outdoor',             5),
  ('Late Night',          'late-night',          6),
  ('Brunch',              'brunch',              7),
  ('Pet Friendly',        'pet-friendly',        8),
  ('Kid Friendly',        'kid-friendly',        9),
  ('Group Friendly',      'group-friendly',      10),
  ('Solo Dining',         'solo-dining',         11),
  ('First Date',          'first-date',          12),
  ('Anniversary',         'anniversary',         13),
  ('Birthday',            'birthday',            14),
  ('Business Lunch',      'business-lunch',      15),
  ('Girls Night',         'girls-night',         16),
  ('Guys Night',          'guys-night',          17),
  ('Game Day',            'game-day',            18),
  ('Watch Party',         'watch-party',         19),
  ('Trivia Night',        'trivia-night',        20),
  ('Open Mic',            'open-mic',            21),
  ('DJ Night',            'dj-night',            22),
  ('Craft Cocktails',     'craft-cocktails',     23),
  ('Wine List',           'wine-list',           24),
  ('Beer Flight',         'beer-flight',         25),
  ('Tasting Menu',        'tasting-menu',        26),
  ('All You Can Eat',     'all-you-can-eat',     27),
  ('Bottomless Mimosas',  'bottomless-mimosas',  28),
  ('Weekend Special',     'weekend-special',     29),
  ('After Hours',         'after-hours',         30)
) AS t(name, slug, sort_order)
CROSS JOIN tag_categories c
WHERE c.name = 'Popular'
ON CONFLICT (slug) DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- 8. EVENT TYPE TAGS (with per-tag icons)
-- ══════════════════════════════════════════════════════════════

INSERT INTO tags (name, slug, icon, sort_order, category_id)
SELECT t.name, t.slug, t.icon, t.sort_order, c.id
FROM (VALUES
  ('Music',          'event-music',          '🎵', 1),
  ('Games',          'event-games',          '🎯', 2),
  ('Food & Drink',   'event-food-drink',     '🍽️', 3),
  ('Workshop',       'event-workshop',       '🛠️', 4),
  ('Special Event',  'event-special',        '✨', 5),
  ('Sports',         'event-sports',         '⚽', 6),
  ('Arts & Crafts',  'event-arts-crafts',    '🎨', 7),
  ('Other',          'event-other',          '📌', 8)
) AS t(name, slug, icon, sort_order)
CROSS JOIN tag_categories c
WHERE c.name = 'Event Type'
ON CONFLICT (slug) DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- 9. EVENT VIBE TAGS (event-specific vibes not in base Vibe list)
-- ══════════════════════════════════════════════════════════════

INSERT INTO tags (name, slug, sort_order, category_id)
SELECT t.name, t.slug, t.sort_order, c.id
FROM (VALUES
  ('Family Friendly',     'event-family-friendly',     1),
  ('21+',                 'event-21-plus',             2),
  ('Intimate',            'event-intimate',            3),
  ('High Energy',         'event-high-energy',         4),
  ('Day Event',           'event-day-event',           5),
  ('Beginner Friendly',   'event-beginner-friendly',   6),
  ('VIP Available',       'event-vip-available',       7),
  ('Food Included',       'event-food-included',       8),
  ('Drink Specials',      'event-drink-specials',      9),
  ('Live Entertainment',  'event-live-entertainment',  10),
  ('Interactive',         'event-interactive',          11),
  ('Competition',         'event-competition',          12),
  ('Networking',          'event-networking',            13),
  ('Educational',         'event-educational',           14)
) AS t(name, slug, sort_order)
CROSS JOIN tag_categories c
WHERE c.name = 'Event Vibe'
ON CONFLICT (slug) DO NOTHING;
