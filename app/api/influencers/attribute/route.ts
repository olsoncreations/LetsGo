import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * POST /api/influencers/attribute
 * Auth required. Associates a new user signup with an influencer.
 * Called right after signup on the welcome page.
 * Body: { code: string }
 */
export async function POST(req: NextRequest) {
  // Verify auth
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ attributed: false, reason: "Not authenticated" }, { status: 401 });
  }

  const { data: { user }, error: authError } = await supabaseServer.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ attributed: false, reason: "Invalid token" }, { status: 401 });
  }

  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ attributed: false, reason: "Invalid body" }, { status: 400 });
  }

  const code = body.code?.trim()?.toUpperCase();
  if (!code) {
    return NextResponse.json({ attributed: false, reason: "No code provided" }, { status: 400 });
  }

  // Look up influencer
  const { data: influencer, error: lookupErr } = await supabaseServer
    .from("influencers")
    .select("id")
    .eq("code", code)
    .eq("status", "active")
    .maybeSingle();

  if (lookupErr || !influencer) {
    return NextResponse.json({ attributed: false, reason: "Invalid or inactive code" });
  }

  // Insert signup attribution (skip if duplicate)
  const { error: signupErr } = await supabaseServer
    .from("influencer_signups")
    .insert({
      influencer_id: influencer.id,
      user_id: user.id,
    });

  if (signupErr) {
    // Duplicate constraint = user already attributed, not an error
    if (signupErr.code === "23505") {
      return NextResponse.json({ attributed: false, reason: "Already attributed" });
    }
    console.error("influencer attribution error:", signupErr.message);
    return NextResponse.json({ attributed: false, reason: "Database error" }, { status: 500 });
  }

  // Log a converted click
  // Log a converted click (fire-and-forget, ignore errors)
  try {
    await supabaseServer
      .from("influencer_clicks")
      .insert({
        influencer_id: influencer.id,
        converted: true,
        ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
        user_agent: req.headers.get("user-agent") || null,
        referrer: req.headers.get("referer") || null,
      });
  } catch { /* ignore click tracking errors */ }

  return NextResponse.json({ attributed: true });
}
