import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * GET /api/influencers/validate?code=SARAH2026
 * Public endpoint — validates an influencer code and returns the influencer's name.
 * Used on the welcome/signup page to show the "Invited by" banner.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")?.trim();

  if (!code) {
    return NextResponse.json({ valid: false });
  }

  const { data, error } = await supabaseServer
    .from("influencers")
    .select("name, code")
    .eq("code", code.toUpperCase())
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    console.error("influencer validate error:", error.message);
    return NextResponse.json({ valid: false });
  }

  if (!data) {
    return NextResponse.json({ valid: false });
  }

  return NextResponse.json({ valid: true, name: data.name, code: data.code });
}
