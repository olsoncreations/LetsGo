// Classification helpers for translating Google Places types into LetsGo's
// internal business taxonomy. Used by:
//   - app/api/admin/sales/prospect/bulk-seed/route.ts (initial seed)
//   - app/api/admin/sales/prospect/preview/route.ts (preview before seeding)
//   - app/api/admin/businesses/backfill-google/route.ts (re-classify existing seeds)
//
// Both functions take Google's `primaryType` / `types[]` value and an optional
// business name. Substring checks on the type run first; if the type is generic
// or missing (Google returns "store" / nothing for many small businesses), we
// fall back to keyword matching against the business name. This mirrors the
// cuisine name fallback in lib/googlePlacesMapper.ts.
//
// Order matters: more-specific subtypes appear ABOVE generic fallbacks so e.g.
// `vr_arcade` matches VR Arcade before `arcade` catches it.

/**
 * High-confidence keyword patterns used to classify a business by name when
 * Google's `primaryType` is unhelpful (typically "store" / "point_of_interest"
 * for small or chain locations like SalonCentric, where Google didn't return a
 * specific business category).
 *
 * Each entry maps a regex to a (subtype, category) pair. The first match wins
 * — ordered from most-specific to most-generic. Patterns avoid ambiguous
 * tokens that frequently appear in unrelated names.
 */
const NAME_SUBTYPE_PATTERNS: { pattern: RegExp; subtype: string; category: string }[] = [
  // Pamper / beauty — caused the SalonCentric-as-Activity bug
  { pattern: /\bsalon\b|\bbeauty\b|\bbarber\b|\bnail\s*(bar|spa|salon|studio)?\b|\blash\b|\bbrows?\b|\bwax(ing)?\b/i, subtype: "Spa", category: "salon_beauty" },
  { pattern: /\bspa\b|\bmassage\b/i, subtype: "Spa", category: "salon_beauty" },
  { pattern: /\bhair\s+(salon|studio|stylists?|cuts?)\b/i, subtype: "Spa", category: "salon_beauty" },
  // Fitness — gyms aren't restaurants, shouldn't fall through to "Activity"
  { pattern: /\byoga\b/i, subtype: "Yoga Studio", category: "salon_beauty" },
  { pattern: /\bcrossfit\b|\bgym\b|\bfitness\b|\bpilates\b|\bcycle\s*bar\b|\borange\s*theory\b/i, subtype: "Gym", category: "activity" },
  { pattern: /\bdance\s+(studio|academy)\b|\bballet\b/i, subtype: "Dance Studio", category: "activity" },
  // Activities (specific before generic)
  { pattern: /\baquarium\b/i, subtype: "Aquarium", category: "activity" },
  { pattern: /\bzoo\b/i, subtype: "Zoo", category: "activity" },
  { pattern: /\bbotanical\s+garden\b/i, subtype: "Botanical Garden", category: "activity" },
  { pattern: /\baxe\s+(throwing|throwers?)\b/i, subtype: "Axe Throwing", category: "activity" },
  { pattern: /\b(vr|virtual\s+reality)\s+(arcade|lounge)\b/i, subtype: "VR Arcade", category: "activity" },
  { pattern: /\blaser\s+tag\b/i, subtype: "Laser Tag", category: "activity" },
  { pattern: /\bice\s+(skating|rink)\b/i, subtype: "Ice Skating", category: "activity" },
  { pattern: /\broller\s+(skating|rink)\b/i, subtype: "Roller Skating", category: "activity" },
  { pattern: /\bbowling\b|\blanes\b/i, subtype: "Bowling", category: "activity" },
  { pattern: /\bescape\s+rooms?\b/i, subtype: "Escape Room", category: "activity" },
  { pattern: /\bmini(ature)?\s+golf\b|\bputt\s*-?\s*putt\b/i, subtype: "Mini Golf", category: "activity" },
  { pattern: /\barcade\b/i, subtype: "Arcade", category: "activity" },
  { pattern: /\bcomedy\s+(club|stop)\b/i, subtype: "Comedy Club", category: "activity" },
  { pattern: /\b(theatre|theater|cinema|cinemas|movies?)\b/i, subtype: "Theater", category: "activity" },
  { pattern: /\bmuseum\b/i, subtype: "Museum", category: "activity" },
  { pattern: /\bart\s+gallery\b|\bgalleries\b/i, subtype: "Art Gallery", category: "activity" },
  { pattern: /\bwedding\s+(venue|chapel)\b/i, subtype: "Wedding Venue", category: "activity" },
  { pattern: /\bbanquet\s+(hall|center)\b|\bevent\s+venue\b|\bevent\s+center\b/i, subtype: "Event Venue", category: "activity" },
  // Drink — the type-based mapper already catches "bar" / "pub", but a lot of
  // chains seed with a generic type. Name fallback picks them up.
  { pattern: /\bbrewery\b|\bbrewing\s+co\b/i, subtype: "Brewery", category: "restaurant_bar" },
  { pattern: /\bwinery\b|\bvineyards?\b/i, subtype: "Winery", category: "restaurant_bar" },
  { pattern: /\bnightclub\b|\bnight\s+club\b/i, subtype: "Nightclub", category: "restaurant_bar" },
  { pattern: /\bsports\s+bar\b/i, subtype: "Sports Bar", category: "restaurant_bar" },
  { pattern: /\bkaraoke\b/i, subtype: "Karaoke", category: "restaurant_bar" },
  { pattern: /\blounge\b/i, subtype: "Lounge", category: "restaurant_bar" },
  { pattern: /\bpub\b|\btavern\b/i, subtype: "Pub", category: "restaurant_bar" },
  // Eat-side fallbacks (cuisine fallback already runs separately, but a name
  // like "Joe's Coffee" should still resolve to Coffee subtype, not Activity)
  { pattern: /\bcoffee\b|\bespresso\b|\bcaf[eé]\b/i, subtype: "Coffee", category: "restaurant_bar" },
  { pattern: /\bbakery\b|\bbakers?\b|\bbread\b/i, subtype: "Bakery", category: "restaurant_bar" },
  { pattern: /\bice\s+cream\b|\bgelato\b|\bfrozen\s+yogurt\b|\bfroyo\b/i, subtype: "Ice Cream", category: "restaurant_bar" },
  { pattern: /\bjuice\s+(bar|co)\b|\bsmoothie\b/i, subtype: "Juice Bar", category: "restaurant_bar" },
  { pattern: /\bdeli\b|\bdelicatessen\b/i, subtype: "Deli", category: "restaurant_bar" },
  { pattern: /\bfood\s+truck\b/i, subtype: "Food Truck", category: "restaurant_bar" },
];

/** Run the name-based pattern list and return the first match (or null). */
function classifyByName(businessName: string | null | undefined): { subtype: string; category: string } | null {
  if (!businessName) return null;
  for (const { pattern, subtype, category } of NAME_SUBTYPE_PATTERNS) {
    if (pattern.test(businessName)) return { subtype, category };
  }
  return null;
}

/**
 * Broad LetsGo business category. Maps to the `category_main` /
 * `business.business_type` columns. Drives high-level filtering and
 * Eat/Drink/Play/Pamper bucketing.
 *
 * `businessName` is an optional fallback signal: when Google's primaryType is
 * generic (e.g. "store", "point_of_interest") and would otherwise fall through
 * to "activity", we scan the business name for keywords. SalonCentric is the
 * canonical case — Google returned no salon type but the name says it all.
 */
export function mapBusinessTypeToCategory(googleType: string, businessName?: string | null): string {
  const t = googleType.toLowerCase();
  if (t.includes("restaurant") || t.includes("food") || t.includes("diner")) return "restaurant_bar";
  if (t.includes("bar") || t.includes("pub") || t.includes("brewery") || t.includes("lounge") || t.includes("nightclub") || t.includes("winery")) return "restaurant_bar";
  if (t.includes("coffee") || t.includes("cafe") || t.includes("bakery") || t.includes("ice cream") || t.includes("juice") || t.includes("deli")) return "restaurant_bar";
  if (t.includes("salon") || t.includes("beauty") || t.includes("spa") || t.includes("barber") || t.includes("nail") || t.includes("yoga")) return "salon_beauty";
  if (t.includes("gym") || t.includes("fitness")) return "activity";
  // Type didn't classify — try the business name before defaulting to "activity"
  const byName = classifyByName(businessName);
  if (byName) return byName.category;
  return "activity";
}

/**
 * Granular LetsGo subtype matching one of the Business Type tags seeded in
 * `tag_categories.Business Type`. The returned string is what gets written
 * into the business's `tags` array as `tags[0]` and surfaces on the discovery
 * feed Category filter.
 *
 * Falls back to "Activity" only when neither the Google type nor the business
 * name yields a match. Keep "Activity" reserved for genuinely generic places
 * — anything is_date_night_activity-flagged on the Activity tag will surface
 * here, so misclassifying a salon as Activity leaks it into Date Night.
 */
export function mapBusinessSubtype(googleType: string, businessName?: string | null): string {
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
  // Type didn't classify — try the business name before defaulting to "Activity"
  const byName = classifyByName(businessName);
  if (byName) return byName.subtype;
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
