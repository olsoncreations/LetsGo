// Dynamic tag list — fetches from the `tags` + `tag_categories` Supabase tables.
// Admin manages tags via Settings → Tag Management.
// All filter UIs (swipe, 5v3v1, group, events, onboarding, business profile)
// pull from this shared utility.

import { supabaseBrowser } from "@/lib/supabaseBrowser";

// ── Types ──────────────────────────────────────────────────────

export type TagItem = {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  icon: string | null;
  sort_order: number;
  is_food: boolean;
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
  tags: TagItem[];
};

// ── Cache ──────────────────────────────────────────────────────

let cachedTags: string[] | null = null;
let cachedCategories: TagCategory[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function isCacheValid(): boolean {
  return cacheTime > 0 && Date.now() - cacheTime < CACHE_TTL;
}

// ── Fetch: flat tag names (backward compat) ────────────────────

/**
 * Fetch all tag names from the DB. Cached for 5 minutes.
 */
export async function fetchAvailableTags(): Promise<string[]> {
  if (cachedTags && isCacheValid()) return cachedTags;

  const { data } = await supabaseBrowser
    .from("tags")
    .select("name")
    .order("name");

  cachedTags = (data ?? []).map((t: { name: string }) => t.name);
  cacheTime = Date.now();
  return cachedTags;
}

// ── Fetch: tags grouped by category ────────────────────────────

/**
 * Fetch all tags grouped by category. Optionally filter by scope.
 * Returns categories with their tags sorted by sort_order then name.
 */
export async function fetchTagsByCategory(
  scope?: "business" | "event" | "game"
): Promise<TagCategory[]> {
  if (cachedCategories && isCacheValid()) {
    return scope
      ? cachedCategories.filter((c) => c.scope.includes(scope))
      : cachedCategories;
  }

  const { data: catRows } = await supabaseBrowser
    .from("tag_categories")
    .select("id, name, icon, scope, requires_food")
    .order("name");

  const { data: tagRows } = await supabaseBrowser
    .from("tags")
    .select("id, name, slug, color, icon, sort_order, is_food, category_id")
    .order("sort_order")
    .order("name");

  const categories: TagCategory[] = (catRows ?? []).map(
    (c: { id: string; name: string; icon: string; scope: string[] | null; requires_food: boolean | null }) => ({
      id: c.id,
      name: c.name,
      icon: c.icon ?? "🏷️",
      scope: c.scope ?? ["business"],
      requires_food: c.requires_food ?? false,
      tags: (tagRows ?? [])
        .filter((t: { category_id: string }) => t.category_id === c.id)
        .map((t: { id: string; name: string; slug: string; color: string | null; icon: string | null; sort_order: number | null; is_food: boolean | null }) => ({
          id: t.id,
          name: t.name,
          slug: t.slug,
          color: t.color,
          icon: t.icon,
          sort_order: t.sort_order ?? 0,
          is_food: t.is_food ?? false,
          category_id: c.id,
          category_name: c.name,
          category_icon: c.icon ?? "🏷️",
        })),
    })
  );

  cachedCategories = categories;
  // Also update the flat cache for backward compat
  cachedTags = (tagRows ?? []).map((t: { name: string }) => t.name);
  cacheTime = Date.now();

  return scope
    ? categories.filter((c) => c.scope.includes(scope))
    : categories;
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

// ── Cache invalidation ─────────────────────────────────────────

/** Invalidate the cache (e.g. after admin adds/removes tags). */
export function invalidateTagCache(): void {
  cachedTags = null;
  cachedCategories = null;
  cacheTime = 0;
}
