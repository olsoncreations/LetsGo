// Shared mapper for converting Google Places (New) place data into LetsGo tag
// names that match what's seeded in `tag_categories` / `tags`. Used by:
//   - app/api/admin/sales/prospect/bulk-seed/route.ts (initial seed)
//   - app/api/admin/sales/prospect/preview/route.ts (preview before seeding)
//   - app/api/admin/businesses/backfill-google/route.ts (re-enrich existing seeds)
//
// The Google fields we read here must be requested via X-Goog-FieldMask on the
// caller's side (e.g. "primaryType,servesVegetarianFood,outdoorSeating,allowsDogs,
// servesVeganFood,editorialSummary").

/** Subset of the Google Places (New) place response we care about for tag extraction. */
export interface GooglePlaceForTags {
  primaryType?: string | null;
  types?: string[] | null;
  servesVegetarianFood?: boolean | null;
  servesVeganFood?: boolean | null;
  outdoorSeating?: boolean | null;
  allowsDogs?: boolean | null;
  editorialSummary?: { text?: string | null } | null;
}

/**
 * Map Google primaryType (and types[] fallbacks) to a LetsGo cuisine tag name
 * that exists in our Cuisine tag category. Only returns a value when we're
 * confident — falls back to null when the type doesn't suggest a cuisine.
 *
 * Google's restaurant primaryType vocabulary is fairly stable; if Google adds
 * new ones, they'll just fall through and return null until added here.
 */
const PRIMARY_TYPE_TO_CUISINE: Record<string, string> = {
  italian_restaurant: "Italian",
  mexican_restaurant: "Mexican",
  chinese_restaurant: "Chinese",
  japanese_restaurant: "Japanese",
  thai_restaurant: "Thai",
  indian_restaurant: "Indian",
  korean_restaurant: "Korean",
  vietnamese_restaurant: "Vietnamese",
  mediterranean_restaurant: "Mediterranean",
  french_restaurant: "French",
  greek_restaurant: "Greek",
  spanish_restaurant: "Spanish",
  middle_eastern_restaurant: "Middle Eastern",
  pizza_restaurant: "Pizza",
  seafood_restaurant: "Seafood",
  sushi_restaurant: "Sushi",
  ramen_restaurant: "Ramen",
  steak_house: "Steakhouse",
  barbecue_restaurant: "BBQ",
  hamburger_restaurant: "Burgers",
  american_restaurant: "American",
};

/** Dietary primary types — Google occasionally classifies vegan/vegetarian-only places. */
const PRIMARY_TYPE_TO_DIETARY: Record<string, string> = {
  vegan_restaurant: "Vegan",
  vegetarian_restaurant: "Vegetarian",
};

/**
 * Look up a cuisine tag name from a Google place's types. Checks primaryType
 * first (most specific Google classification), falls back to types[] which may
 * contain a more specific entry alongside generic ones like "restaurant".
 */
export function cuisineFromPlace(place: GooglePlaceForTags): string | null {
  if (place.primaryType && PRIMARY_TYPE_TO_CUISINE[place.primaryType]) {
    return PRIMARY_TYPE_TO_CUISINE[place.primaryType];
  }
  for (const t of place.types ?? []) {
    if (PRIMARY_TYPE_TO_CUISINE[t]) return PRIMARY_TYPE_TO_CUISINE[t];
  }
  return null;
}

/**
 * Extract dietary tags. Sources:
 *   - servesVegetarianFood / servesVeganFood booleans on the place
 *   - vegan_restaurant / vegetarian_restaurant primaryType (counts as serves)
 */
export function dietaryTagsFromPlace(place: GooglePlaceForTags): string[] {
  const out = new Set<string>();
  if (place.servesVegetarianFood === true) out.add("Vegetarian");
  if (place.servesVeganFood === true) out.add("Vegan");
  if (place.primaryType && PRIMARY_TYPE_TO_DIETARY[place.primaryType]) {
    out.add(PRIMARY_TYPE_TO_DIETARY[place.primaryType]);
  }
  for (const t of place.types ?? []) {
    if (PRIMARY_TYPE_TO_DIETARY[t]) out.add(PRIMARY_TYPE_TO_DIETARY[t]);
  }
  return Array.from(out);
}

/**
 * Extract Extras tags. The "Extras" tag category currently has just two tags
 * (Pet Friendly, Patio); they each have a clean Google source field.
 */
export function extrasTagsFromPlace(place: GooglePlaceForTags): string[] {
  const out: string[] = [];
  if (place.outdoorSeating === true) out.push("Patio");
  if (place.allowsDogs === true) out.push("Pet Friendly");
  return out;
}

/**
 * Combined extraction. Returns the cuisine (or null), dietary tags, and extras
 * tags as separate arrays plus a merged `allTags` for direct insert. Caller
 * should merge `allTags` with their own subtype/businessTypeTag and de-dupe.
 */
export function extractTagsFromPlace(place: GooglePlaceForTags): {
  cuisine: string | null;
  dietary: string[];
  extras: string[];
  allTags: string[];
} {
  const cuisine = cuisineFromPlace(place);
  const dietary = dietaryTagsFromPlace(place);
  const extras = extrasTagsFromPlace(place);
  const allTags = [
    ...(cuisine ? [cuisine] : []),
    ...dietary,
    ...extras,
  ];
  return { cuisine, dietary, extras, allTags };
}

/**
 * Extra Google fields beyond the basic search response that we want for tag
 * extraction. Append to the X-Goog-FieldMask on Place Details / Text Search calls.
 *
 * Used both by initial seeding and by the backfill job to keep one source of truth.
 */
export const TAG_EXTRACTION_FIELD_MASK = [
  "primaryType",
  "servesVegetarianFood",
  "servesVeganFood",
  "outdoorSeating",
  "allowsDogs",
  "editorialSummary",
] as const;

/** Same list scoped under `places.` for the text-search response shape. */
export const TAG_EXTRACTION_PLACES_FIELD_MASK = TAG_EXTRACTION_FIELD_MASK.map(f => `places.${f}`);

/** Merge new tags into an existing tags array, deduped case-insensitively, preserving original case from `existing`. */
export function mergeTags(existing: string[], incoming: string[]): string[] {
  const lowerSeen = new Set(existing.map(t => t.toLowerCase()));
  const merged = [...existing];
  for (const tag of incoming) {
    const trimmed = tag.trim();
    if (!trimmed || lowerSeen.has(trimmed.toLowerCase())) continue;
    lowerSeen.add(trimmed.toLowerCase());
    merged.push(trimmed);
  }
  return merged;
}
