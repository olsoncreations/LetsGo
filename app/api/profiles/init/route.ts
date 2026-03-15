import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

// POST /api/profiles/init — save profile data after signup
// Uses service role to bypass RLS, since the user may not have a session yet
// (e.g., email confirmation required)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { user_id, first_name, last_name, full_name, zip_code, phone, user_type } = body;

    if (!user_id) {
      return NextResponse.json({ error: "user_id is required" }, { status: 400 });
    }

    // Verify this user actually exists in auth
    const { data: authUser, error: authError } = await supabaseServer.auth.admin.getUserById(user_id);
    if (authError || !authUser?.user) {
      return NextResponse.json({ error: "Invalid user" }, { status: 400 });
    }

    // Build profile data
    const profileData: Record<string, unknown> = {
      id: user_id,
      tos_accepted_at: new Date().toISOString(),
    };

    if (user_type === "user") {
      if (first_name) profileData.first_name = first_name.trim();
      if (last_name) profileData.last_name = last_name.trim();
      if (full_name) profileData.full_name = full_name.trim();
      if (zip_code) profileData.zip_code = zip_code.trim();
      if (phone) profileData.phone = phone.trim();
    } else {
      if (full_name) profileData.full_name = full_name.trim();
    }

    const { error: upsertError } = await supabaseServer
      .from("profiles")
      .upsert(profileData, { onConflict: "id" });

    if (upsertError) {
      console.error("Profile init upsert error:", upsertError);
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("Profile init error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
