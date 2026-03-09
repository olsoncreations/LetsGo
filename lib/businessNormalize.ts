// ═══════════════════════════════════════════════════
// Shared business normalization utilities
// Used by: Discovery/Swipe page, 5v3v1 game, etc.
// ═══════════════════════════════════════════════════

import { DEFAULT_PRESET_BPS } from "@/lib/platformSettings";

// ─── Types ───

export type BusinessRow = {
  id: string;
  is_active: boolean | null;
  business_name: string | null;
  public_business_name: string | null;
  contact_phone: string | null;
  website: string | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  name: string | null;
  phone_number: string | null;
  website_url: string | null;
  address_line1: string | null;
  category_main: string | null;
  config: Record<string, unknown> | null;
  blurb: string | null;
  payout_tiers: number[] | null;
  payout_preset: string | null;
  // Standalone columns (may not be selected in all queries)
  business_type?: string | null;
  description?: string | null;
  hours?: Record<string, { enabled?: boolean; open?: string; close?: string }> | null;
  tags?: string[] | null;
  // Individual day columns (source of truth for hours)
  mon_open?: string | null;
  mon_close?: string | null;
  tue_open?: string | null;
  tue_close?: string | null;
  wed_open?: string | null;
  wed_close?: string | null;
  thu_open?: string | null;
  thu_close?: string | null;
  fri_open?: string | null;
  fri_close?: string | null;
  sat_open?: string | null;
  sat_close?: string | null;
  sun_open?: string | null;
  sun_close?: string | null;
};

export type MediaRow = {
  business_id: string;
  bucket: string;
  path: string;
  sort_order: number | null;
  caption: string | null;
  meta: Record<string, unknown> | null;
};

export type DiscoveryImage = {
  url: string;
  focalX: number;
  focalY: number;
};

export type DiscoveryBusiness = {
  id: string;
  name: string;
  type: string;
  slogan: string;
  address: string;
  phone: string;
  website: string;
  price: string;
  isOpen: boolean;
  closesAt: string | null;
  hours: Record<string, string>;
  payout: number[];
  tags: string[];
  images: DiscoveryImage[];
  categoryMain: string;
  vibe: string;
  businessZip: string;
  isSponsored: boolean;
};

// ─── Constants ───

const DAY_MAP: Record<string, string> = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday",
  thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday",
};

const FALLBACK_GRADIENTS = [
  "linear-gradient(135deg, #1a0a2e 0%, #2d1b4e 30%, #ff6b35 70%, #ffb347 100%)",
  "linear-gradient(135deg, #2d1b00 0%, #5c3a1e 30%, #ff6b6b 70%, #ffb3b3 100%)",
  "linear-gradient(135deg, #0a0a2e 0%, #1a1a4e 30%, #8a2be2 70%, #bf5fff 100%)",
  "linear-gradient(135deg, #0a1a14 0%, #1a3a2e 30%, #00bfff 70%, #87CEEB 100%)",
  "linear-gradient(135deg, #1a0a0a 0%, #3d1a1a 30%, #ff4444 70%, #ff8888 100%)",
];

// ─── Helper functions ───

export function buildMediaUrl(bucket: string, path: string): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
}

export function getBusinessGradient(id: string): string {
  const hash = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return FALLBACK_GRADIENTS[hash % FALLBACK_GRADIENTS.length];
}

export function getBusinessEmoji(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("coffee")) return "\u2615";
  if (t.includes("bar") || t.includes("cocktail") || t.includes("lounge")) return "\uD83C\uDF78";
  if (t.includes("bowling")) return "\uD83C\uDFB3";
  if (t.includes("ramen") || t.includes("japanese")) return "\uD83C\uDF5C";
  if (t.includes("pizza")) return "\uD83C\uDF55";
  if (t.includes("burger")) return "\uD83C\uDF54";
  if (t.includes("arcade") || t.includes("entertainment")) return "\uD83C\uDFAE";
  return "\uD83C\uDF7D\uFE0F";
}

export function formatBusinessType(raw: string): string {
  return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function to12Hour(time: string): string {
  // Convert "09:00" or "17:30" or "09:00:00" to "9:00 AM" or "5:30 PM"
  const stripped = time.replace(/:\d{2}$/, ""); // strip seconds if present
  const parts = stripped.split(":");
  if (parts.length < 2) return time;
  let h = parseInt(parts[0], 10);
  const m = parts[1];
  if (isNaN(h)) return time;
  const ampm = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${ampm}`;
}

export function normalizeHoursForDisplay(config: Record<string, unknown> | null): Record<string, string> {
  const hours: Record<string, string> = {};
  const h = (config?.hours ?? {}) as Record<string, { enabled?: boolean; open?: string; close?: string }>;

  for (const [abbr, fullName] of Object.entries(DAY_MAP)) {
    const day = h[abbr];
    if (!day || day.enabled === false || !day.open || !day.close) {
      hours[fullName] = "Closed";
    } else {
      hours[fullName] = `${to12Hour(day.open)} \u2013 ${to12Hour(day.close)}`;
    }
  }
  return hours;
}

export function computeOpenStatus(hours: Record<string, string>): { isOpen: boolean; closesAt: string | null } {
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const { dayOfWeek } = getCentralTime();
  const today = dayNames[dayOfWeek];
  const todayHours = hours[today];

  if (!todayHours || todayHours === "Closed") {
    return { isOpen: false, closesAt: null };
  }

  const parts = todayHours.split(" \u2013 ");
  return { isOpen: true, closesAt: parts[1] || null };
}

// ─── Hours: Single Source of Truth (individual day columns) ───

const DAY_COLUMN_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

/** Build display hours from individual day columns (the single source of truth). */
export function resolveHoursFromColumns(row: Record<string, unknown>): Record<string, string> {
  const hours: Record<string, string> = {};
  for (const [abbr, fullName] of Object.entries(DAY_MAP)) {
    const open = row[`${abbr}_open`] as string | null | undefined;
    const close = row[`${abbr}_close`] as string | null | undefined;
    if (open && close) {
      hours[fullName] = `${to12Hour(open)} \u2013 ${to12Hour(close)}`;
    } else {
      hours[fullName] = "Closed";
    }
  }
  return hours;
}

/** Build structured hours from individual day columns (for HoursGrid / admin). */
export function resolveStructuredHoursFromColumns(
  row: Record<string, unknown>
): Record<string, { enabled: boolean; open: string; close: string }> {
  const result: Record<string, { enabled: boolean; open: string; close: string }> = {};
  for (const abbr of DAY_COLUMN_KEYS) {
    const open = row[`${abbr}_open`] as string | null | undefined;
    const close = row[`${abbr}_close`] as string | null | undefined;
    if (open && close) {
      // Strip seconds (e.g., "09:00:00" → "09:00")
      result[abbr] = {
        enabled: true,
        open: open.replace(/^(\d{2}:\d{2}):\d{2}$/, "$1"),
        close: close.replace(/^(\d{2}:\d{2}):\d{2}$/, "$1"),
      };
    } else {
      result[abbr] = { enabled: false, open: "", close: "" };
    }
  }
  return result;
}

/** Check if a business is open today using day columns. Before 4 AM = previous business day. */
/**
 * Get current time in US Central timezone.
 * Vercel servers run in UTC; all our businesses are Central time.
 */
export function getCentralTime(): { hour: number; minute: number; dayOfWeek: number } {
  const now = new Date();
  const central = new Date(now.toLocaleString("en-US", { timeZone: "America/Chicago" }));
  return {
    hour: central.getHours(),
    minute: central.getMinutes(),
    dayOfWeek: central.getDay(),
  };
}

/**
 * Check if a business is open RIGHT NOW based on day columns.
 * Uses 4 AM business day cutoff and compares current time to open/close.
 * Handles overnight hours (e.g., 21:00 – 05:00).
 */
export function isBusinessOpenNow(row: Record<string, unknown>): boolean {
  const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const { hour: currentHour, minute: currentMinute, dayOfWeek } = getCentralTime();
  const currentTime = currentHour * 60 + currentMinute;

  // Business day: before 4 AM = still previous day
  const idx = currentHour < 4 ? (dayOfWeek + 6) % 7 : dayOfWeek;
  const day = dayNames[idx];

  const openStr = row[`${day}_open`] as string | null | undefined;
  const closeStr = row[`${day}_close`] as string | null | undefined;
  if (!openStr || !closeStr) return false;

  const openMatch = openStr.match(/^(\d{1,2}):(\d{2})/);
  const closeMatch = closeStr.match(/^(\d{1,2}):(\d{2})/);
  if (!openMatch || !closeMatch) return false;

  const openTime = parseInt(openMatch[1]) * 60 + parseInt(openMatch[2]);
  const closeTime = parseInt(closeMatch[1]) * 60 + parseInt(closeMatch[2]);

  // Overnight hours (e.g., 21:00 – 05:00)
  if (openTime > closeTime) {
    return currentTime >= openTime || currentTime < closeTime;
  }

  // Normal hours (e.g., 09:00 – 17:00)
  return currentTime >= openTime && currentTime < closeTime;
}

/** The 14 day column names to include in Supabase SELECT queries. */
export const DAY_COLUMNS_SELECT =
  "mon_open, mon_close, tue_open, tue_close, wed_open, wed_close, " +
  "thu_open, thu_close, fri_open, fri_close, sat_open, sat_close, sun_open, sun_close";

/**
 * Convert BPS array from business_payout_tiers table to percentages.
 * @param tableBps - BPS values from the table (e.g. [300, 400, 500, …])
 *                   This is the ONLY source of truth. Pass [] if not fetched yet.
 * Returns percentages [3, 4, 5, …]. Falls back to Standard plan if empty.
 */
// Re-export from centralized source — all BPS presets live in platformSettings.ts
export const PRESET_BPS = DEFAULT_PRESET_BPS;

function bpsToPercents(bpsArr: number[]): number[] {
  return bpsArr.map((v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n / 100 : 5;
  });
}

export function normalizePayoutFromBps(
  config: Record<string, unknown> | null,
  row?: Record<string, unknown> | null,
  tableBps?: number[],
): number[] {
  // 1. ONLY trust business_payout_tiers table data if provided
  if (tableBps && tableBps.length >= 7) {
    return bpsToPercents(tableBps.slice(0, 7));
  }

  // 2. Fallback: payout_preset → preset defaults → Standard
  const preset = String(row?.payout_preset || config?.payoutPreset || "standard");
  const presetBps = PRESET_BPS[preset] || PRESET_BPS.standard;
  return bpsToPercents(presetBps);
}

export function normalizeToDiscoveryBusiness(
  row: BusinessRow,
  mediaRows: MediaRow[],
  tableBps?: number[],
): DiscoveryBusiness {
  const cfg = row.config ?? {};

  const name = row.public_business_name || row.business_name || row.name || "Untitled";
  const rawType = String(cfg.businessType ?? row.category_main ?? "restaurant");
  const type = formatBusinessType(rawType);
  const slogan = row.blurb || String(cfg.blurb ?? cfg.description ?? cfg.vibe ?? "");

  const street = row.street_address || row.address_line1 || "";
  const cityStateZip = [row.city, row.state, row.zip].filter(Boolean).join(", ");
  const address = [street, cityStateZip].filter(Boolean).join(", ");

  const phone = row.contact_phone || row.phone_number || "";
  const website = row.website || row.website_url || "";
  const price = (["$", "$$", "$$$", "$$$$"].includes(String(cfg.priceLevel ?? ""))
    ? String(cfg.priceLevel)
    : "$$");

  const hours = resolveHoursFromColumns(row as unknown as Record<string, unknown>);
  const { isOpen, closesAt } = computeOpenStatus(hours);
  const payout = normalizePayoutFromBps(cfg, row as unknown as Record<string, unknown>, tableBps);
  const tags: string[] = Array.isArray(cfg.tags) ? (cfg.tags as string[]).map(String) : [];
  const vibe = String(cfg.vibe ?? cfg.businessType ?? row.category_main ?? "");
  const categoryMain = row.category_main || "";

  // Build image objects from business_media rows
  const images: DiscoveryImage[] = [];
  const seenUrls = new Set<string>();

  // Check config.images first (some businesses store URLs directly — no focal data)
  const cfgImages = cfg.images;
  if (Array.isArray(cfgImages) && cfgImages.length > 0) {
    for (const img of cfgImages) {
      const url = String(img);
      if (url && !seenUrls.has(url)) {
        seenUrls.add(url);
        images.push({ url, focalX: 50, focalY: 30 });
      }
    }
  }

  // Add business_media photos (with focal point from meta)
  for (const m of mediaRows) {
    const url = buildMediaUrl(String(m.bucket || "business-media"), String(m.path || ""));
    if (url && !seenUrls.has(url)) {
      seenUrls.add(url);
      const meta = (m.meta ?? {}) as Record<string, unknown>;
      const focalX = Number(meta.focal_x ?? 50);
      const focalY = Number(meta.focal_y ?? 30);
      images.push({ url, focalX, focalY });
    }
  }

  const businessZip = row.zip || "";

  return {
    id: row.id, name, type, slogan, address, phone, website, price,
    isOpen, closesAt, hours, payout, tags, images, categoryMain, vibe, businessZip,
    isSponsored: false,
  };
}

export function shuffleArray<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
