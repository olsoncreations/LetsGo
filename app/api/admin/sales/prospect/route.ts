import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

// Verify caller is authenticated staff
async function requireStaff(req: NextRequest): Promise<Response | null> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: { user }, error } = await supabaseServer.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: staff } = await supabaseServer
    .from("staff_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!staff) return NextResponse.json({ error: "Staff access required" }, { status: 403 });
  return null;
}

interface AddressComponent {
  longText: string;
  shortText: string;
  types: string[];
}

interface PlaceLocation {
  latitude: number;
  longitude: number;
}

interface PlaceDisplayName {
  text: string;
}

interface PlaceResult {
  id?: string;
  displayName?: PlaceDisplayName;
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  types?: string[];
  location?: PlaceLocation;
  addressComponents?: AddressComponent[];
}

const PRICE_LEVEL_MAP: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

// Maps Google Places types to display categories
function mapBusinessType(googleTypes: string[]): string {
  for (const t of googleTypes) {
    // Restaurants (any type ending in _restaurant or specific food types)
    if (t.endsWith("_restaurant") || t === "restaurant" || t === "food" || t === "diner"
      || t === "steak_house" || t === "food_court") return "Restaurant";
    // Cafes & Coffee
    if (t === "cafe" || t === "coffee_shop" || t === "coffee_stand" || t === "tea_house"
      || t === "coffee_roastery") return "Coffee";
    // Bakeries & Desserts
    if (t === "bakery" || t === "pastry_shop" || t === "donut_shop" || t === "dessert_shop"
      || t === "cake_shop" || t === "candy_store" || t === "confectionery"
      || t === "chocolate_shop") return "Bakery";
    if (t === "ice_cream_shop") return "Ice Cream";
    if (t === "juice_shop") return "Juice Bar";
    // Bars & Nightlife
    if (t === "bar" || t === "bar_and_grill" || t === "cocktail_bar" || t === "sports_bar"
      || t === "beer_garden" || t === "hookah_bar" || t === "gastropub") return "Bar";
    if (t === "brewery" || t === "brewpub") return "Brewery";
    if (t === "pub" || t === "irish_pub") return "Pub";
    if (t === "lounge_bar") return "Lounge";
    if (t === "night_club") return "Nightclub";
    if (t === "wine_bar" || t === "winery") return "Winery";
    // Delis
    if (t === "deli" || t === "sandwich_shop" || t === "snack_bar") return "Deli";
    if (t === "meal_delivery" || t === "meal_takeaway") return "Food Truck";
    // Entertainment
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
    // Arts
    if (t === "art_gallery") return "Art Gallery";
    if (t === "museum") return "Museum";
    // Beauty & Wellness
    if (t === "beauty_salon" || t === "hair_salon" || t === "barber_shop"
      || t === "nail_salon" || t === "tanning_studio") return "Salon/Beauty";
    if (t === "spa" || t === "massage_spa" || t === "massage") return "Spa";
    if (t === "yoga_studio") return "Yoga Studio";
    // Fitness
    if (t === "gym" || t === "fitness_center") return "Gym";
    // Activities
    if (t === "tourist_attraction" || t === "aquarium" || t === "zoo"
      || t === "swimming_pool" || t === "sports_club" || t === "stadium"
      || t === "park") return "Activity";
  }
  return "Activity";
}

/**
 * Geocode a location string to lat/lng using Google Geocoding API.
 * Returns null if geocoding fails.
 */
async function geocodeLocation(
  location: string,
  apiKey: string
): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status === "OK" && data.results?.length > 0) {
      const loc = data.results[0].geometry.location;
      return { lat: loc.lat, lng: loc.lng };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * POST /api/admin/sales/prospect
 * Proxies Google Places Text Search (New) API.
 * Body: { query: string, pageToken?: string, radiusMiles?: number }
 * Returns: { places: [...], nextPageToken?: string }
 */
export async function POST(req: NextRequest) {
  const denied = await requireStaff(req);
  if (denied) return denied;

  try {
    const body = await req.json();
    const query = body.query?.trim();
    const pageToken = body.pageToken;
    const radiusMiles = typeof body.radiusMiles === "number" ? body.radiusMiles : null;

    if (!query) {
      return NextResponse.json({ error: "Search query is required" }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Google Maps API key not configured" }, { status: 500 });
    }

    // Build request for Places API (New) Text Search
    const requestBody: Record<string, unknown> = {
      textQuery: query,
      languageCode: "en",
    };
    if (pageToken) {
      requestBody.pageToken = pageToken;
    }

    // If radius specified and no pageToken, geocode the location and add locationBias
    if (radiusMiles && !pageToken) {
      const coords = await geocodeLocation(query, apiKey);
      if (coords) {
        requestBody.locationBias = {
          circle: {
            center: { latitude: coords.lat, longitude: coords.lng },
            radius: radiusMiles * 1609.34, // miles to meters
          },
        };
      }
    }

    const fieldMask = [
      "places.id",
      "places.displayName",
      "places.formattedAddress",
      "places.nationalPhoneNumber",
      "places.websiteUri",
      "places.rating",
      "places.userRatingCount",
      "places.priceLevel",
      "places.types",
      "places.location",
      "places.addressComponents",
      "nextPageToken",
    ].join(",");

    const response = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": fieldMask,
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Places API error:", response.status, errorText);
      return NextResponse.json(
        { error: `Google Places API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Transform to our schema shape
    const places = (data.places || []).map((place: PlaceResult) => {
      let city = "";
      let state = "";
      let zip = "";

      if (place.addressComponents) {
        for (const comp of place.addressComponents) {
          if (comp.types.includes("locality")) city = comp.longText;
          if (comp.types.includes("administrative_area_level_1")) state = comp.shortText;
          if (comp.types.includes("postal_code")) zip = comp.longText;
        }
      }

      const googleTypes = place.types || [];

      return {
        google_place_id: place.id || "",
        business_name: place.displayName?.text || "",
        business_type: mapBusinessType(googleTypes),
        phone: place.nationalPhoneNumber || "",
        address: place.formattedAddress || "",
        city,
        state,
        zip,
        website: place.websiteUri || "",
        latitude: place.location?.latitude ?? null,
        longitude: place.location?.longitude ?? null,
        google_rating: place.rating ?? null,
        google_total_ratings: place.userRatingCount ?? null,
        google_price_level: PRICE_LEVEL_MAP[place.priceLevel as string] ?? null,
        google_types: googleTypes,
      };
    });

    return NextResponse.json({
      places,
      nextPageToken: data.nextPageToken || null,
      totalResults: places.length,
    });
  } catch (err) {
    console.error("Prospect API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
