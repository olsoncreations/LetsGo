-- Backfill business subtypes from sales_leads.business_type
-- The original seeding stored "Unknown" as googleBusinessType and only mapped
-- to 3 generic subtypes (Restaurant/Activity/Spa). The sales_leads table has
-- the actual Google Places business types (Coffee, Bar, Art Gallery, etc.)

-- Step 1: Update config with correct googleBusinessType, subtype, and tags
UPDATE business b
SET config = b.config
  || jsonb_build_object('googleBusinessType', sl.business_type)
  || jsonb_build_object('subtype', CASE
    -- Bars & nightlife
    WHEN lower(sl.business_type) LIKE '%nightclub%' OR lower(sl.business_type) LIKE '%night club%' THEN 'Nightclub'
    WHEN lower(sl.business_type) LIKE '%brewery%' THEN 'Brewery'
    WHEN lower(sl.business_type) LIKE '%winery%' THEN 'Winery'
    WHEN lower(sl.business_type) LIKE '%lounge%' THEN 'Lounge'
    WHEN lower(sl.business_type) LIKE '%sports bar%' THEN 'Sports Bar'
    WHEN lower(sl.business_type) LIKE '%pub%' THEN 'Pub'
    WHEN lower(sl.business_type) LIKE '%karaoke%' THEN 'Karaoke'
    WHEN lower(sl.business_type) LIKE '%bar%' THEN 'Bar'
    -- Coffee & quick serve
    WHEN lower(sl.business_type) LIKE '%coffee%' OR lower(sl.business_type) LIKE '%cafe%' THEN 'Coffee'
    WHEN lower(sl.business_type) LIKE '%bakery%' THEN 'Bakery'
    WHEN lower(sl.business_type) LIKE '%ice cream%' THEN 'Ice Cream'
    WHEN lower(sl.business_type) LIKE '%juice%' THEN 'Juice Bar'
    WHEN lower(sl.business_type) LIKE '%deli%' THEN 'Deli'
    WHEN lower(sl.business_type) LIKE '%food truck%' THEN 'Food Truck'
    -- Restaurant
    WHEN lower(sl.business_type) LIKE '%restaurant%' OR lower(sl.business_type) LIKE '%food%' OR lower(sl.business_type) LIKE '%diner%' THEN 'Restaurant'
    -- Beauty
    WHEN lower(sl.business_type) LIKE '%spa%' THEN 'Spa'
    WHEN lower(sl.business_type) LIKE '%salon%' OR lower(sl.business_type) LIKE '%beauty%' OR lower(sl.business_type) LIKE '%barber%' OR lower(sl.business_type) LIKE '%nail%' THEN 'Spa'
    WHEN lower(sl.business_type) LIKE '%yoga%' THEN 'Yoga Studio'
    -- Fitness
    WHEN lower(sl.business_type) LIKE '%gym%' OR lower(sl.business_type) LIKE '%fitness%' THEN 'Gym'
    WHEN lower(sl.business_type) LIKE '%dance%' THEN 'Dance Studio'
    -- Entertainment
    WHEN lower(sl.business_type) LIKE '%bowling%' THEN 'Bowling'
    WHEN lower(sl.business_type) LIKE '%arcade%' THEN 'Arcade'
    WHEN lower(sl.business_type) LIKE '%escape%' THEN 'Escape Room'
    WHEN lower(sl.business_type) LIKE '%mini golf%' OR lower(sl.business_type) LIKE '%miniature golf%' THEN 'Mini Golf'
    WHEN lower(sl.business_type) LIKE '%theater%' OR lower(sl.business_type) LIKE '%theatre%' OR lower(sl.business_type) LIKE '%cinema%' OR lower(sl.business_type) LIKE '%movie%' THEN 'Theater'
    WHEN lower(sl.business_type) LIKE '%comedy%' THEN 'Comedy Club'
    WHEN lower(sl.business_type) LIKE '%museum%' THEN 'Museum'
    WHEN lower(sl.business_type) LIKE '%art gallery%' OR lower(sl.business_type) LIKE '%gallery%' THEN 'Art Gallery'
    WHEN lower(sl.business_type) LIKE '%entertainment%' OR lower(sl.business_type) LIKE '%amusement%' THEN 'Entertainment'
    ELSE 'Activity'
  END)
  || jsonb_build_object('tags', jsonb_build_array(CASE
    WHEN lower(sl.business_type) LIKE '%nightclub%' OR lower(sl.business_type) LIKE '%night club%' THEN 'Nightclub'
    WHEN lower(sl.business_type) LIKE '%brewery%' THEN 'Brewery'
    WHEN lower(sl.business_type) LIKE '%winery%' THEN 'Winery'
    WHEN lower(sl.business_type) LIKE '%lounge%' THEN 'Lounge'
    WHEN lower(sl.business_type) LIKE '%sports bar%' THEN 'Sports Bar'
    WHEN lower(sl.business_type) LIKE '%pub%' THEN 'Pub'
    WHEN lower(sl.business_type) LIKE '%karaoke%' THEN 'Karaoke'
    WHEN lower(sl.business_type) LIKE '%bar%' THEN 'Bar'
    WHEN lower(sl.business_type) LIKE '%coffee%' OR lower(sl.business_type) LIKE '%cafe%' THEN 'Coffee'
    WHEN lower(sl.business_type) LIKE '%bakery%' THEN 'Bakery'
    WHEN lower(sl.business_type) LIKE '%ice cream%' THEN 'Ice Cream'
    WHEN lower(sl.business_type) LIKE '%juice%' THEN 'Juice Bar'
    WHEN lower(sl.business_type) LIKE '%deli%' THEN 'Deli'
    WHEN lower(sl.business_type) LIKE '%food truck%' THEN 'Food Truck'
    WHEN lower(sl.business_type) LIKE '%restaurant%' OR lower(sl.business_type) LIKE '%food%' OR lower(sl.business_type) LIKE '%diner%' THEN 'Restaurant'
    WHEN lower(sl.business_type) LIKE '%spa%' THEN 'Spa'
    WHEN lower(sl.business_type) LIKE '%salon%' OR lower(sl.business_type) LIKE '%beauty%' OR lower(sl.business_type) LIKE '%barber%' OR lower(sl.business_type) LIKE '%nail%' THEN 'Spa'
    WHEN lower(sl.business_type) LIKE '%yoga%' THEN 'Yoga Studio'
    WHEN lower(sl.business_type) LIKE '%gym%' OR lower(sl.business_type) LIKE '%fitness%' THEN 'Gym'
    WHEN lower(sl.business_type) LIKE '%dance%' THEN 'Dance Studio'
    WHEN lower(sl.business_type) LIKE '%bowling%' THEN 'Bowling'
    WHEN lower(sl.business_type) LIKE '%arcade%' THEN 'Arcade'
    WHEN lower(sl.business_type) LIKE '%escape%' THEN 'Escape Room'
    WHEN lower(sl.business_type) LIKE '%mini golf%' OR lower(sl.business_type) LIKE '%miniature golf%' THEN 'Mini Golf'
    WHEN lower(sl.business_type) LIKE '%theater%' OR lower(sl.business_type) LIKE '%theatre%' OR lower(sl.business_type) LIKE '%cinema%' OR lower(sl.business_type) LIKE '%movie%' THEN 'Theater'
    WHEN lower(sl.business_type) LIKE '%comedy%' THEN 'Comedy Club'
    WHEN lower(sl.business_type) LIKE '%museum%' THEN 'Museum'
    WHEN lower(sl.business_type) LIKE '%art gallery%' OR lower(sl.business_type) LIKE '%gallery%' THEN 'Art Gallery'
    WHEN lower(sl.business_type) LIKE '%entertainment%' OR lower(sl.business_type) LIKE '%amusement%' THEN 'Entertainment'
    ELSE 'Activity'
  END))
FROM sales_leads sl
WHERE sl.preview_business_id = b.id
  AND sl.business_type IS NOT NULL
  AND sl.business_type != '';

-- Step 2: Update category_main based on the corrected business_type
UPDATE business b
SET category_main = CASE
    WHEN lower(sl.business_type) LIKE '%restaurant%' OR lower(sl.business_type) LIKE '%food%' OR lower(sl.business_type) LIKE '%diner%' THEN 'restaurant_bar'
    WHEN lower(sl.business_type) LIKE '%bar%' OR lower(sl.business_type) LIKE '%pub%' OR lower(sl.business_type) LIKE '%brewery%' OR lower(sl.business_type) LIKE '%lounge%' OR lower(sl.business_type) LIKE '%nightclub%' OR lower(sl.business_type) LIKE '%winery%' THEN 'restaurant_bar'
    WHEN lower(sl.business_type) LIKE '%coffee%' OR lower(sl.business_type) LIKE '%cafe%' OR lower(sl.business_type) LIKE '%bakery%' OR lower(sl.business_type) LIKE '%ice cream%' OR lower(sl.business_type) LIKE '%juice%' OR lower(sl.business_type) LIKE '%deli%' THEN 'restaurant_bar'
    WHEN lower(sl.business_type) LIKE '%salon%' OR lower(sl.business_type) LIKE '%beauty%' OR lower(sl.business_type) LIKE '%spa%' OR lower(sl.business_type) LIKE '%barber%' OR lower(sl.business_type) LIKE '%nail%' OR lower(sl.business_type) LIKE '%yoga%' THEN 'salon_beauty'
    WHEN lower(sl.business_type) LIKE '%gym%' OR lower(sl.business_type) LIKE '%fitness%' THEN 'activity'
    ELSE 'activity'
  END
FROM sales_leads sl
WHERE sl.preview_business_id = b.id
  AND sl.business_type IS NOT NULL
  AND sl.business_type != '';

-- Step 3: Sync standalone tags column from updated config.tags
UPDATE business
SET tags = ARRAY(
  SELECT jsonb_array_elements_text(config->'tags')
)
WHERE config->'tags' IS NOT NULL
  AND jsonb_array_length(config->'tags') > 0;
