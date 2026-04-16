import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { mapBusinessType } from "@/lib/googleBusinessType";

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
          if (!comp.types) continue;
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
