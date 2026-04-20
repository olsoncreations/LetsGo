/**
 * Load user's saved filter preferences from the API.
 * Returns null if not authenticated or no preferences saved.
 */
export async function loadFilterPreferences(token: string | null): Promise<{
  categories: string[];
  price: string;
  distance: number;
  openNow: boolean;
  tags: string[];
} | null> {
  if (!token) return null;
  try {
    const res = await fetch("/api/users/filter-preferences", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.preferences) return null;
    return {
      categories: data.preferences.categories || [],
      price: data.preferences.price || "Any",
      distance: data.preferences.distance || 15,
      openNow: data.preferences.openNow || false,
      tags: data.preferences.tags || [],
    };
  } catch {
    return null;
  }
}
