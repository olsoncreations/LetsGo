// Dynamic tag list — fetches from the `tags` Supabase table.
// Replaces the old hardcoded 178-tag array. Admin manages tags
// via Settings → Tag Management.

import { supabaseBrowser } from "@/lib/supabaseBrowser";

let cachedTags: string[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch all tag names from the DB. Cached for 5 minutes.
 */
export async function fetchAvailableTags(): Promise<string[]> {
  if (cachedTags && Date.now() - cacheTime < CACHE_TTL) return cachedTags;

  const { data } = await supabaseBrowser
    .from("tags")
    .select("name")
    .order("name");

  cachedTags = (data ?? []).map((t: { name: string }) => t.name);
  cacheTime = Date.now();
  return cachedTags;
}

/** Invalidate the cache (e.g. after admin adds/removes tags). */
export function invalidateTagCache(): void {
  cachedTags = null;
  cacheTime = 0;
}
