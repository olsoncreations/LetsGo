import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.ip || null;
  const userAgent = req.headers.get("user-agent") || null;
  const referer = req.headers.get("referer") || null;

  await supabaseServer.from("qr_scans").insert({
    campaign: "user",
    ip_address: ip,
    user_agent: userAgent,
    referer: referer,
  });

  return NextResponse.redirect(new URL("/welcome", req.url));
}
