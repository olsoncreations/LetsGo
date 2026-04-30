// Dynamic tag list — fetches from the `tags` + `tag_categories` Supabase tables.
// Admin manages tags via Settings → Tag Management.
// All filter UIs (swipe, 5v3v1, group, events, onboarding, business profile)
// pull from this shared utility.

import { supabaseBrowser } from "@/lib/supabaseBrowser";

// ── Types ──────────────────────────────────────────────────────

export type TopType = "eat" | "drink" | "play" | "pamper";

export type TagItem = {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  icon: string | null;
  sort_order: number;
  is_food: boolean;
  is_active: boolean;
  is_date_night_activity: boolean;
  top_type: TopType | null;
  category_id: string;
  category_name: string;
  category_icon: string;
};

export type TagCategory = {
  id: string;
  name: string;
  icon: string;
  scope: string[];
  requires_food: boolean;
  is_active: boolean;
  tags: TagItem[];
};

export type FetchTagsOptions = {
  /** Include archived (is_active=false) categories + tags. Default false. Admin-only. */
  includeArchived?: boolean;
};

// ── Cache ──────────────────────────────────────────────────────
// The cache stores ALL categories + tags (active + archived). Consumers filter
// at read time via the `includeArchived` flag — keeps the cache canonical.

let cachedCategories: TagCategory[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function isCacheValid(): boolean {
  return cacheTime > 0 && Date.now() - cacheTime < CACHE_TTL;
}

async function ensureCache(): Promise<TagCategory[]> {
  if (cachedCategories && isCacheValid()) return cachedCategories;

  const { data: catRows } = await supabaseBrowser
    .from("tag_categories")
    .select("id, name, icon, scope, requires_food, is_active")
    .order("name");

  const { data: tagRows } = await supabaseBrowser
    .from("tags")
    .select("id, name, slug, color, icon, sort_order, is_food, is_active, top_type, is_date_night_activity, category_id")
    .order("sort_order")
    .order("name");

  const categories: TagCategory[] = (catRows ?? []).map(
    (c: { id: string; name: string; icon: string; scope: string[] | null; requires_food: boolean | null; is_active: boolean | null }) => ({
      id: c.id,
      name: c.name,
      icon: c.icon ?? "🏷️",
      scope: c.scope ?? ["business"],
      requires_food: c.requires_food ?? false,
      is_active: c.is_active ?? true,
      tags: (tagRows ?? [])
        .filter((t: { category_id: string }) => t.category_id === c.id)
        .map((t: { id: string; name: string; slug: string; color: string | null; icon: string | null; sort_order: number | null; is_food: boolean | null; is_active: boolean | null; top_type: string | null; is_date_night_activity: boolean | null }) => ({
          id: t.id,
          name: t.name,
          slug: t.slug,
          color: t.color,
          icon: t.icon,
          sort_order: t.sort_order ?? 0,
          is_food: t.is_food ?? false,
          is_active: t.is_active ?? true,
          is_date_night_activity: t.is_date_night_activity ?? false,
          top_type: (t.top_type as TopType | null) ?? null,
          category_id: c.id,
          category_name: c.name,
          category_icon: c.icon ?? "🏷️",
        })),
    })
  );

  cachedCategories = categories;
  cacheTime = Date.now();
  return categories;
}

// ── Fetch: flat tag names (backward compat) ────────────────────

/**
 * Fetch all active tag names from the DB. Cached for 5 minutes.
 * Archived tags are excluded.
 */
export async function fetchAvailableTags(): Promise<string[]> {
  const categories = await ensureCache();
  const names: string[] = [];
  for (const c of categories) {
    if (!c.is_active) continue;
    for (const t of c.tags) {
      if (t.is_active) names.push(t.name);
    }
  }
  return names;
}

// ── Fetch: tags grouped by category ────────────────────────────

/**
 * Fetch tags grouped by category. Optionally filter by scope.
 * By default, archived (is_active=false) categories and tags are excluded.
 * Pass `{ includeArchived: true }` for admin-side tools that need to see/restore them.
 */
export async function fetchTagsByCategory(
  scope?: "business" | "event" | "game",
  options?: FetchTagsOptions
): Promise<TagCategory[]> {
  const all = await ensureCache();
  const includeArchived = options?.includeArchived === true;

  let categories = all;
  if (!includeArchived) {
    categories = categories
      .filter((c) => c.is_active)
      .map((c) => ({ ...c, tags: c.tags.filter((t) => t.is_active) }));
  }

  return scope ? categories.filter((c) => c.scope.includes(scope)) : categories;
}

// ── Helper: smart category visibility ──────────────────────────

/**
 * Filter categories based on selected Business Type tags.
 * If any selected business type has is_food=true, includes requires_food categories (Cuisine, Dietary).
 * If none are food types (or none selected), hides requires_food categories.
 * Always excludes the "Business Type" category itself from results.
 */
export function getVisibleCategories(
  allCategories: TagCategory[],
  selectedBusinessTypeTags: string[]
): TagCategory[] {
  // Find the Business Type category to check is_food on selected tags
  const businessTypeCat = allCategories.find((c) => c.name === "Business Type");
  const hasFood = businessTypeCat
    ? businessTypeCat.tags.some(
        (t) => t.is_food && selectedBusinessTypeTags.includes(t.name)
      )
    : false;

  return allCategories
    .filter((c) => c.name !== "Business Type")
    .filter((c) => !c.requires_food || hasFood);
}

// ── Helper: lookup tags by Top Type (Eat / Drink / Play / Pamper) ──

/**
 * Get all active Business Type tags whose `top_type` matches the given value.
 * Used by the discovery feed's new "Type" filter (Eat/Drink/Play/Pamper).
 *
 * Returns an empty array if Business Type category isn't found or no tags match.
 */
export async function getTagsByTopType(topType: TopType): Promise<TagItem[]> {
  const all = await fetchTagsByCategory();
  const businessType = all.find((c) => c.name === "Business Type");
  if (!businessType) return [];
  return businessType.tags.filter((t) => t.top_type === topType);
}

// ── Cache invalidation ─────────────────────────────────────────

/** Invalidate the cache (e.g. after admin adds/removes/archives tags). */
export function invalidateTagCache(): void {
  cachedCategories = null;
  cacheTime = 0;
}
