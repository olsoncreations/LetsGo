import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

// ── POST — Submit a role application (authenticated user) ──
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const { data: { user }, error: authError } = await supabaseServer.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const body = await req.json();
  const { application_type, full_name, email, phone, city, state, payload } = body;

  if (!["sales_rep", "influencer"].includes(application_type)) {
    return NextResponse.json({ error: "Invalid application type" }, { status: 400 });
  }
  if (!full_name || typeof full_name !== "string" || full_name.trim().length < 2) {
    return NextResponse.json({ error: "Full name is required" }, { status: 400 });
  }

  // Check for existing pending application
  const { data: existing } = await supabaseServer
    .from("role_applications")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("application_type", application_type)
    .eq("status", "submitted")
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "You already have a pending application" }, { status: 409 });
  }

  const { data, error } = await supabaseServer
    .from("role_applications")
    .insert({
      user_id: user.id,
      application_type,
      full_name: full_name.trim(),
      email: (email || user.email || "").trim(),
      phone: phone?.trim() || null,
      city: city?.trim() || null,
      state: state?.trim() || null,
      payload: payload || {},
    })
    .select("id")
    .single();

  if (error) {
    console.error("[applications] Insert error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id, status: "submitted" });
}

// ── GET — Check user's own application status ──
export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const { data: { user }, error: authError } = await supabaseServer.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const type = req.nextUrl.searchParams.get("type");

  let query = supabaseServer
    .from("role_applications")
    .select("id, application_type, status, review_message, created_at")
    .eq("user_id", user.id);

  if (type) query = query.eq("application_type", type);

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ applications: data || [] });
}
