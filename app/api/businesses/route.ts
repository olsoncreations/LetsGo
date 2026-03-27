// app/api/businesses/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer as supabase } from "@/lib/supabaseServer";

// ─── Rate limit: 60 requests per IP per minute ───
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;
const requestCounts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = requestCounts.get(ip);
  if (!entry || now >= entry.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

// Periodically clean up stale entries
function pruneRateLimitMap() {
  if (requestCounts.size > 5000) {
    const now = Date.now();
    for (const [key, entry] of requestCounts) {
      if (now >= entry.resetAt) requestCounts.delete(key);
    }
  }
}

export async function GET(req: NextRequest) {
  // Rate limiting
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  pruneRateLimitMap();
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }
  try {
    const { data, error } = await supabase
      .from("business")
      .select(
        `
        id,
        business_name,
        public_business_name,
        is_active,
        address_line1,
        address_line2,
        city,
        state,
        postal_code,
        website_url,
        phone_number,
        category_main,
        category_2,
        category_3,
        category_4,
        category_5,
        sun_open,
        sun_close,
        mon_open,
        mon_close,
        tue_open,
        tue_close,
        wed_open,
        wed_close,
        thu_open,
        thu_close,
        fri_open,
        fri_close,
        sat_open,
        sat_close
      `
      )
      .eq("is_active", true)
      .order("business_name", { ascending: true });

    if (error) {
      console.error("Supabase business query error:", error);
      return NextResponse.json(
        { error: "Failed to load businesses" },
        { status: 500 }
      );
    }

    return NextResponse.json({ businesses: data ?? [] });
  } catch (err: unknown) {
    console.error("Unexpected /api/businesses error:", err);
    return NextResponse.json(
      {
        error: "Unexpected server error",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}