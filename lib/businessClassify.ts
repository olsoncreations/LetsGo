// Classification helpers for translating Google Places types into LetsGo's
// internal business taxonomy. Used by:
//   - app/api/admin/sales/prospect/bulk-seed/route.ts (initial seed)
//   - app/api/admin/sales/prospect/preview/route.ts (preview before seeding)
//   - app/api/admin/businesses/backfill-google/route.ts (re-classify existing seeds)
//
// Both functions take a single string (Google's `primaryType`, a value from
// `types[]`, or any free-form business type label) and run case-insensitive
// substring checks. Order matters: more-specific subtypes appear ABOVE generic
// fallbacks so e.g. `vr_arcade` matches VR Arcade before `arcade` catches it.

/**
 * Broad LetsGo business category. Maps to the `category_main` /
 * `business.business_type` columns. Drives high-level filtering and
 * Eat/Drink/Play/Pamper bucketing.
 */
export function mapBusinessTypeToCategory(googleType: string): string {
  const t = googleType.toLowerCase();
  if (t.includes("restaurant") || t.includes("food") || t.includes("diner")) return "restaurant_bar";
  if (t.includes("bar") || t.includes("pub") || t.includes("brewery") || t.includes("lounge") || t.includes("nightclub") || t.includes("winery")) return "restaurant_bar";
  if (t.includes("coffee") || t.includes("cafe") || t.includes("bakery") || t.includes("ice cream") || t.includes("juice") || t.includes("deli")) return "restaurant_bar";
  if (t.includes("salon") || t.includes("beauty") || t.includes("spa") || t.includes("barber") || t.includes("nail") || t.includes("yoga")) return "salon_beauty";
  if (t.includes("gym") || t.includes("fitness")) return "activity";
  return "activity";
}

/**
 * Granular LetsGo subtype matching one of the Business Type tags seeded in
 * `tag_categories.Business Type`. The returned string is what gets written
 * into the business's `tags` array as `tags[0]` and surfaces on the discovery
 * feed Category filter.
 *
 * Falls back to "Activity" when no match — that's the catchall and is NOT
 * date-friendly by default (admin can flip via Tag Management).
 */
export function mapBusinessSubtype(googleType: string): string {
  const t = googleType.toLowerCase();
  // Bars & nightlife
  if (t.includes("nightclub") || t.includes("night_club")) return "Nightclub";
  if (t.includes("brewery")) return "Brewery";
  if (t.includes("winery")) return "Winery";
  if (t.includes("lounge")) return "Lounge";
  if (t.includes("sports bar")) return "Sports Bar";
  if (t.includes("pub")) return "Pub";
  if (t.includes("karaoke")) return "Karaoke";
  if (t.includes("bar")) return "Bar";
  // Coffee & quick serve
  if (t.includes("coffee") || t.includes("cafe")) return "Coffee";
  if (t.includes("bakery")) return "Bakery";
  if (t.includes("ice cream")) return "Ice Cream";
  if (t.includes("juice")) return "Juice Bar";
  if (t.includes("deli")) return "Deli";
  if (t.includes("food truck")) return "Food Truck";
  // Restaurant
  if (t.includes("restaurant") || t.includes("food") || t.includes("diner")) return "Restaurant";
  // Beauty
  if (t.includes("spa")) return "Spa";
  if (t.includes("salon") || t.includes("beauty") || t.includes("barber") || t.includes("nail")) return "Spa";
  if (t.includes("yoga")) return "Yoga Studio";
  // Fitness
  if (t.includes("gym") || t.includes("fitness")) return "Gym";
  if (t.includes("dance")) return "Dance Studio";
  // Entertainment / activities — specific BEFORE generic
  if (t.includes("aquarium")) return "Aquarium";
  if (t.includes("zoo")) return "Zoo";
  if (t.includes("botanical")) return "Botanical Garden";
  if (t.includes("axe") && t.includes("throw")) return "Axe Throwing";
  if ((t.includes("vr") || t.includes("virtual reality")) && t.includes("arcade")) return "VR Arcade";
  if (t.includes("laser tag") || t.includes("laser_tag")) return "Laser Tag";
  if (t.includes("ice skating") || t.includes("ice_skating") || t.includes("ice rink")) return "Ice Skating";
  if (t.includes("roller skating") || t.includes("roller_skating") || t.includes("roller rink")) return "Roller Skating";
  if (t.includes("wedding")) return "Wedding Venue";
  if (t.includes("event venue") || t.includes("event_venue") || t.includes("banquet")) return "Event Venue";
  if (t.includes("bowling")) return "Bowling";
  if (t.includes("arcade")) return "Arcade";
  if (t.includes("escape")) return "Escape Room";
  if (t.includes("mini golf") || t.includes("miniature golf")) return "Mini Golf";
  if (t.includes("theater") || t.includes("theatre") || t.includes("cinema") || t.includes("movie")) return "Theater";
  if (t.includes("comedy")) return "Comedy Club";
  if (t.includes("museum")) return "Museum";
  if (t.includes("art gallery") || t.includes("gallery")) return "Art Gallery";
  // Generic
  if (t.includes("entertainment") || t.includes("amusement")) return "Entertainment";
  return "Activity";
}

/**
 * Pick the best Google type string to feed into the classifiers from a place
 * details response. Prefers `primaryType` (most specific Google classification)
 * and falls back to the first entry in `types[]`.
 */
export function pickGoogleClassificationInput(
  primaryType: string | null | undefined,
  types: string[] | null | undefined
): string {
  if (primaryType) return primaryType;
  if (Array.isArray(types) && types.length > 0) return String(types[0]);
  return "";
}
