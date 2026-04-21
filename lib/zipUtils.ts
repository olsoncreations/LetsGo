// Shared zip code → coordinates lookup and distance utilities.
// Used by both client (Discovery page) and server (Spotlight API).

// Approximate lat/lon for known zip codes (Omaha-area + major US cities).
// Mutable: the Discovery page's Google Geocoder adds entries at runtime.
export const ZIP_COORDS: Record<string, [number, number]> = {
  "68102": [41.2565, -95.9345], "68131": [41.2620, -95.9610], "68124": [41.2350, -95.9890],
  "68114": [41.2670, -96.0130], "68106": [41.2380, -95.9590], "68154": [41.2700, -96.0640],
  "68022": [41.2870, -96.2350], "68046": [41.1590, -96.0420], "68116": [41.3320, -96.1560],
  "68005": [41.1370, -95.9230], "68123": [41.1330, -95.9670], "68128": [41.1760, -96.0310],
  "68007": [41.3640, -96.1570], "68127": [41.1950, -95.9680], "68104": [41.2960, -95.9470],
  "68132": [41.2630, -95.9700], "68105": [41.2340, -95.9320], "68137": [41.2030, -96.0510],
  "68144": [41.2330, -96.0520], "68164": [41.3130, -96.0750],
  "68108": [41.2410, -95.9350], "68110": [41.2880, -95.9260], "68117": [41.2080, -95.9580],
  "68118": [41.2730, -96.1820], "68130": [41.2460, -96.1700], "68133": [41.1930, -96.0850],
  "68135": [41.2030, -96.1440], "68136": [41.2200, -96.1870], "68138": [41.1730, -96.0870],
  "10001": [40.7484, -73.9967], "90001": [33.9425, -118.2551], "90210": [34.0901, -118.4065],
  "60601": [41.8819, -87.6278], "77001": [29.7604, -95.3698], "85001": [33.4484, -112.0740],
  "94102": [37.7749, -122.4194], "30301": [33.7490, -84.3880], "80201": [39.7392, -104.9903],
  "89101": [36.1699, -115.1398], "33101": [25.7617, -80.1918], "70112": [29.9511, -90.0715],
};

/** Haversine distance between two lat/lon points, in miles. */
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Distance between two zip codes in miles, or null if either is unknown. */
export function getDistanceBetweenZips(zipA: string, zipB: string): number | null {
  const from = ZIP_COORDS[zipA];
  const to = ZIP_COORDS[zipB];
  if (!from || !to) return null;
  return haversineDistance(from[0], from[1], to[0], to[1]);
}

/** Campaign type → max radius in miles. null = nationwide (no limit). */
export const CAMPAIGN_RADIUS: Record<string, number | null> = {
  ad_1day: 20,
  ad_7day: 50,
  ad_14day: 50,
  ad_100mile: 100,
  ad_tourwide: null,
};
