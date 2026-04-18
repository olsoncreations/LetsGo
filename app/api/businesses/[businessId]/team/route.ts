import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

// ---------- Auth helpers ----------

type AuthResult = {
  userId: string;
  callerRole: "owner" | "manager" | "staff" | "admin";
};

async function authenticate(
  req: NextRequest,
  businessId: string
): Promise<AuthResult | Response> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token)
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );

  const {
    data: { user },
    error,
  } = await supabaseServer.auth.getUser(token);
  if (error || !user)
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );

  // Check admin staff FIRST (admin trumps business role)
  const { data: staff } = await supabaseServer
    .from("staff_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (staff) {
    return { userId: user.id, callerRole: "admin" };
  }

  // Check business membership
  const { data: bizAccess } = await supabaseServer
    .from("business_users")
    .select("role")
    .eq("business_id", businessId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (bizAccess) {
    return {
      userId: user.id,
      callerRole: bizAccess.role as "owner" | "manager" | "staff",
    };
  }

  return NextResponse.json(
    { error: "Business access required" },
    { status: 403 }
  );
}

// ---------- Helpers ----------

async function lookupUserByEmail(
  email: string
): Promise<{ id: string; email: string; full_name: string | null } | null> {
  const normalizedEmail = email.toLowerCase().trim();

  // Try profiles table first (has email from auth)
  const { data: profile } = await supabaseServer
    .from("profiles")
    .select("id, email, full_name, first_name, last_name")
    .ilike("email", normalizedEmail)
    .maybeSingle();

  if (profile) {
    const name = profile.full_name ||
      [profile.first_name, profile.last_name].filter(Boolean).join(" ") || null;
    return { id: profile.id, email: profile.email ?? normalizedEmail, full_name: name };
  }

  // Fallback: search auth users (handles case where profile doesn't have email)
  const { data: authList, error: listError } = await supabaseServer.auth.admin.listUsers({
    perPage: 1000,
  });

  if (!listError && authList?.users) {
    const match = authList.users.find(
      (u) => u.email?.toLowerCase() === normalizedEmail
    );
    if (match) {
      return {
        id: match.id,
        email: match.email ?? normalizedEmail,
        full_name: (match.user_metadata?.full_name as string) || null,
      };
    }
  }

  return null;
}

// ---------- GET ----------

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const { businessId } = await params;
  const auth = await authenticate(req, businessId);
  if (auth instanceof Response) return auth;

  const { data: members, error } = await supabaseServer
    .from("business_users")
    .select("user_id, role, created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Failed to load team members" },
      { status: 500 }
    );
  }

  // Enrich with profile data
  const userIds = (members ?? []).map((m) => m.user_id);
  const { data: profiles } = await supabaseServer
    .from("profiles")
    .select("id, email, full_name")
    .in("id", userIds);

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id, p])
  );

  // For any user without a profile, try auth admin
  const enriched = await Promise.all(
    (members ?? []).map(async (m) => {
      const prof = profileMap.get(m.user_id);
      if (prof) {
        return {
          user_id: m.user_id,
          role: m.role,
          created_at: m.created_at,
          email: prof.email ?? "",
          full_name: prof.full_name,
        };
      }
      // Fallback to auth admin
      const { data: authUser } =
        await supabaseServer.auth.admin.getUserById(m.user_id);
      return {
        user_id: m.user_id,
        role: m.role,
        created_at: m.created_at,
        email: authUser?.user?.email ?? "",
        full_name: null,
      };
    })
  );

  return NextResponse.json({
    members: enriched,
    caller_role: auth.callerRole,
  });
}

// ---------- POST (Add member) ----------

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const { businessId } = await params;
  const auth = await authenticate(req, businessId);
  if (auth instanceof Response) return auth;

  // Only owners and admins can add members
  if (auth.callerRole !== "owner" && auth.callerRole !== "admin") {
    return NextResponse.json(
      { error: "Only the business owner can manage team members." },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { email, role } = body as { email?: string; role?: string };

  if (!email || !role) {
    return NextResponse.json(
      { error: "Email and role are required." },
      { status: 400 }
    );
  }

  if (!["manager", "staff"].includes(role)) {
    return NextResponse.json(
      { error: "Role must be 'manager' or 'staff'. Use ownership transfer for owner changes." },
      { status: 400 }
    );
  }

  // Look up user
  const user = await lookupUserByEmail(email);
  if (!user) {
    return NextResponse.json(
      { error: "No LetsGo account found with that email. They need to sign up first." },
      { status: 404 }
    );
  }

  // Check if already a member
  const { data: existing } = await supabaseServer
    .from("business_users")
    .select("user_id")
    .eq("business_id", businessId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "This user is already a team member." },
      { status: 409 }
    );
  }

  // Insert
  const { error: insertError } = await supabaseServer
    .from("business_users")
    .insert({
      business_id: businessId,
      user_id: user.id,
      role,
    });

  if (insertError) {
    return NextResponse.json(
      { error: "Failed to add team member." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    member: {
      user_id: user.id,
      role,
      email: user.email,
      full_name: user.full_name,
    },
  });
}

// ---------- PATCH (Change role) ----------

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const { businessId } = await params;
  const auth = await authenticate(req, businessId);
  if (auth instanceof Response) return auth;

  if (auth.callerRole !== "owner" && auth.callerRole !== "admin") {
    return NextResponse.json(
      { error: "Only the business owner can manage team members." },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { user_id, role } = body as { user_id?: string; role?: string };

  if (!user_id || !role) {
    return NextResponse.json(
      { error: "user_id and role are required." },
      { status: 400 }
    );
  }

  if (!["owner", "manager", "staff"].includes(role)) {
    return NextResponse.json(
      { error: "Role must be 'owner', 'manager', or 'staff'." },
      { status: 400 }
    );
  }

  // Get the target member's current role
  const { data: target } = await supabaseServer
    .from("business_users")
    .select("role")
    .eq("business_id", businessId)
    .eq("user_id", user_id)
    .maybeSingle();

  if (!target) {
    return NextResponse.json(
      { error: "User is not a member of this business." },
      { status: 404 }
    );
  }

  // Ownership transfer
  if (role === "owner") {
    // Only admins can transfer ownership
    if (auth.callerRole !== "admin") {
      return NextResponse.json(
        { error: "Ownership transfers can only be done by LetsGo administrators." },
        { status: 403 }
      );
    }

    // Find current owner
    const { data: currentOwner } = await supabaseServer
      .from("business_users")
      .select("user_id")
      .eq("business_id", businessId)
      .eq("role", "owner")
      .maybeSingle();

    if (currentOwner && currentOwner.user_id !== user_id) {
      // Downgrade current owner to manager
      await supabaseServer
        .from("business_users")
        .update({ role: "manager" })
        .eq("business_id", businessId)
        .eq("user_id", currentOwner.user_id);
    }

    // Promote target to owner
    const { error: updateError } = await supabaseServer
      .from("business_users")
      .update({ role: "owner" })
      .eq("business_id", businessId)
      .eq("user_id", user_id);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to transfer ownership." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Ownership transferred successfully.",
      previous_owner_id: currentOwner?.user_id,
    });
  }

  // Regular role change on the owner — only admins can demote
  if (target.role === "owner") {
    if (auth.callerRole !== "admin") {
      return NextResponse.json(
        { error: "Cannot change the owner's role. Contact LetsGo support." },
        { status: 400 }
      );
    }
    // Ensure there will still be an owner after demotion
    const { count } = await supabaseServer
      .from("business_users")
      .select("user_id", { count: "exact", head: true })
      .eq("business_id", businessId);

    if (!count || count < 2) {
      return NextResponse.json(
        { error: "Cannot demote the only team member. Add another member first, then transfer ownership." },
        { status: 400 }
      );
    }
    // Admin is demoting the owner without assigning a new one — warn but allow
    // The business will have no owner until one is assigned
  }

  const { error: updateError } = await supabaseServer
    .from("business_users")
    .update({ role })
    .eq("business_id", businessId)
    .eq("user_id", user_id);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to update role." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, role });
}

// ---------- DELETE (Remove member) ----------

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const { businessId } = await params;
  const auth = await authenticate(req, businessId);
  if (auth instanceof Response) return auth;

  if (auth.callerRole !== "owner" && auth.callerRole !== "admin") {
    return NextResponse.json(
      { error: "Only the business owner can manage team members." },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { user_id } = body as { user_id?: string };

  if (!user_id) {
    return NextResponse.json(
      { error: "user_id is required." },
      { status: 400 }
    );
  }

  // Can't remove the owner
  const { data: target } = await supabaseServer
    .from("business_users")
    .select("role")
    .eq("business_id", businessId)
    .eq("user_id", user_id)
    .maybeSingle();

  if (!target) {
    return NextResponse.json(
      { error: "User is not a member of this business." },
      { status: 404 }
    );
  }

  if (target.role === "owner") {
    return NextResponse.json(
      { error: "Cannot remove the business owner. Transfer ownership first." },
      { status: 400 }
    );
  }

  const { error: deleteError } = await supabaseServer
    .from("business_users")
    .delete()
    .eq("business_id", businessId)
    .eq("user_id", user_id);

  if (deleteError) {
    return NextResponse.json(
      { error: "Failed to remove team member." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
