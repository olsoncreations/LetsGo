import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

// Verify caller is authenticated staff
async function requireStaff(req: NextRequest): Promise<Response | null> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: { user }, error } = await supabaseServer.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: staff } = await supabaseServer.from("staff_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!staff) return NextResponse.json({ error: "Staff access required" }, { status: 403 });
  return null; // authorized
}

/**
 * GET /api/admin/staff
 * Returns all staff members with profile names.
 * Uses service role to bypass RLS on staff_users.
 */
export async function GET(req: NextRequest) {
  const denied = await requireStaff(req);
  if (denied) return denied;

  try {
    const { data: staffData, error } = await supabaseServer
      .from("staff_users")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Enrich with profile names
    const staffIds = (staffData || []).map((s: Record<string, unknown>) => s.user_id as string);
    let nameMap = new Map<string, string>();
    if (staffIds.length > 0) {
      const { data: profiles } = await supabaseServer
        .from("profiles")
        .select("id, full_name, first_name, last_name")
        .in("id", staffIds);
      nameMap = new Map(
        (profiles || []).map((p: Record<string, unknown>) => [
          p.id as string,
          (p.full_name as string) ||
            [p.first_name, p.last_name].filter(Boolean).join(" ") ||
            "",
        ])
      );
    }

    const enriched = (staffData || []).map((s: Record<string, unknown>) => ({
      ...s,
      name: (s.name as string) || nameMap.get(s.user_id as string) || "Unknown",
    }));

    return NextResponse.json({ staff: enriched });
  } catch (err) {
    console.error("Staff GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/staff
 * Adds a new staff member by email lookup + insert.
 * Uses service role to access auth.users and bypass RLS on staff_users.
 */
export async function POST(req: NextRequest) {
  const denied = await requireStaff(req);
  if (denied) return denied;

  try {
    const { email, name, role } = await req.json();

    if (!email || !role) {
      return NextResponse.json({ error: "Email and role are required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Step 1: Find user by email — look up in profiles table first (much more efficient than listing all auth users)
    let userId: string | null = null;
    let fullName: string | null = null;

    // Try profiles table (has email from auth)
    const { data: profileByEmail } = await supabaseServer
      .from("profiles")
      .select("id, full_name, first_name, last_name")
      .ilike("email", normalizedEmail)
      .maybeSingle();

    if (profileByEmail) {
      userId = profileByEmail.id;
      fullName = profileByEmail.full_name || [profileByEmail.first_name, profileByEmail.last_name].filter(Boolean).join(" ") || null;
    } else {
      // Fallback: search auth users (handles case where profile doesn't have email column)
      const { data: listData, error: listError } = await supabaseServer.auth.admin.listUsers({
        perPage: 1000,
      });

      if (!listError && listData?.users) {
        const matchedUser = listData.users.find(
          (u) => u.email?.toLowerCase() === normalizedEmail
        );
        if (matchedUser) {
          userId = matchedUser.id;
          fullName = (matchedUser.user_metadata?.full_name as string) || null;
        }
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: "No user found with that email. They must create an account first." },
        { status: 404 }
      );
    }

    // Step 2: Get display name from profiles if available
    const { data: profile } = await supabaseServer
      .from("profiles")
      .select("full_name, first_name, last_name")
      .eq("id", userId)
      .maybeSingle();

    const displayName =
      name ||
      profile?.full_name ||
      [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
      fullName ||
      "";

    // Step 3: Check if already a staff member
    const { data: existing } = await supabaseServer
      .from("staff_users")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "This user is already a staff member." },
        { status: 409 }
      );
    }

    // Step 4: Insert into staff_users (service role bypasses RLS)
    const { error: insertError } = await supabaseServer.from("staff_users").insert({
      user_id: userId,
      name: displayName,
      role,
    });

    if (insertError) {
      console.error("staff_users insert error:", insertError);
      return NextResponse.json(
        { error: insertError.message || "Failed to insert staff member" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, userId, name: displayName });
  } catch (err) {
    console.error("Staff API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/staff
 * Removes a staff member by user_id.
 */
export async function DELETE(req: NextRequest) {
  const denied = await requireStaff(req);
  if (denied) return denied;

  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const { error } = await supabaseServer
      .from("staff_users")
      .delete()
      .eq("user_id", userId);

    if (error) {
      console.error("staff_users delete error:", error);
      return NextResponse.json(
        { error: error.message || "Failed to remove staff member" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Staff DELETE error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
