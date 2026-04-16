// Maps Google Places API `types[]` array to our display category.
// Used by the prospect scraper and the reclassify backfill so both produce identical labels.
// Returns "Activity" as the catch-all when no specific type matches.
export function mapBusinessType(googleTypes: string[]): string {
  for (const t of googleTypes) {
    if (t.endsWith("_restaurant") || t === "restaurant" || t === "food" || t === "diner"
      || t === "steak_house" || t === "food_court") return "Restaurant";
    if (t === "cafe" || t === "coffee_shop" || t === "coffee_stand" || t === "tea_house"
      || t === "coffee_roastery") return "Coffee";
    if (t === "bakery" || t === "pastry_shop" || t === "donut_shop" || t === "dessert_shop"
      || t === "cake_shop" || t === "candy_store" || t === "confectionery"
      || t === "chocolate_shop") return "Bakery";
    if (t === "ice_cream_shop") return "Ice Cream";
    if (t === "juice_shop") return "Juice Bar";
    if (t === "bar" || t === "bar_and_grill" || t === "cocktail_bar" || t === "sports_bar"
      || t === "beer_garden" || t === "hookah_bar" || t === "gastropub") return "Bar";
    if (t === "brewery" || t === "brewpub") return "Brewery";
    if (t === "pub" || t === "irish_pub") return "Pub";
    if (t === "lounge_bar") return "Lounge";
    if (t === "night_club") return "Nightclub";
    if (t === "wine_bar" || t === "winery") return "Winery";
    if (t === "deli" || t === "sandwich_shop" || t === "snack_bar") return "Deli";
    if (t === "meal_delivery" || t === "meal_takeaway") return "Food Truck";
    if (t === "bowling_alley") return "Bowling";
    if (t === "movie_theater") return "Theater";
    if (t === "comedy_club") return "Comedy Club";
    if (t === "karaoke") return "Karaoke";
    if (t === "miniature_golf_course") return "Mini Golf";
    if (t === "escape_room") return "Escape Room";
    if (t === "video_arcade") return "Arcade";
    if (t === "amusement_center" || t === "amusement_park" || t === "casino"
      || t === "go_karting_venue" || t === "paintball_center" || t === "concert_hall"
      || t === "live_music_venue" || t === "banquet_hall" || t === "event_venue"
      || t === "wedding_venue") return "Entertainment";
    if (t === "art_gallery") return "Art Gallery";
    if (t === "museum") return "Museum";
    if (t === "beauty_salon" || t === "hair_salon" || t === "barber_shop"
      || t === "nail_salon" || t === "tanning_studio") return "Salon/Beauty";
    if (t === "spa" || t === "massage_spa" || t === "massage") return "Spa";
    if (t === "yoga_studio") return "Yoga Studio";
    if (t === "gym" || t === "fitness_center") return "Gym";
    if (t === "tourist_attraction" || t === "aquarium" || t === "zoo"
      || t === "swimming_pool" || t === "sports_club" || t === "stadium"
      || t === "park") return "Activity";
  }
  return "Activity";
}
