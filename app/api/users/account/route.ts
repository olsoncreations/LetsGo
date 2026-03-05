import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

// ─── Helper: authenticate request ───

async function authenticate(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const {
    data: { user },
    error,
  } = await supabaseServer.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

const VALID_ACTIONS = new Set(["hold", "delete_request", "reinstate"]);

/**
 * POST /api/users/account
 * Account management actions: hold, delete_request, reinstate.
 *
 * Body: { action: "hold" | "delete_request" | "reinstate", reason?: string }
 */
export async function POST(req: NextRequest) {
  const user = await authenticate(req);
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = await req.json();
  const action = String(body.action || "").trim();
  const reason = String(body.reason || "").trim();

  if (!VALID_ACTIONS.has(action)) {
    return NextResponse.json(
      { error: "Invalid action. Must be: hold, delete_request, or reinstate" },
      { status: 400 },
    );
  }

  // Fetch current profile status
  const { data: profile, error: profileErr } = await supabaseServer
    .from("profiles")
    .select("status, suspension_reason, suspended_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profileErr || !profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  let updates: Record<string, unknown> = {};

  switch (action) {
    case "hold": {
      // User-initiated account hold
      if (profile.status === "suspended") {
        return NextResponse.json(
          { error: "Your account is suspended by an administrator. Contact support for help." },
          { status: 403 },
        );
      }
      updates = {
        status: "on_hold",
        suspension_reason: reason || "User-requested account hold",
        suspended_at: now,
      };
      break;
    }
    case "delete_request": {
      // User requests account deletion
      if (profile.status === "suspended") {
        return NextResponse.json(
          { error: "Your account is suspended. Contact support to discuss account deletion." },
          { status: 403 },
        );
      }
      updates = {
        status: "deletion_requested",
        suspension_reason: reason || "User requested account deletion",
        suspended_at: now,
      };
      break;
    }
    case "reinstate": {
      // User reinstates a held or deletion-requested account
      // Cannot reinstate an admin-suspended account
      if (profile.status === "suspended") {
        return NextResponse.json(
          { error: "Your account is suspended by an administrator. Contact support for help." },
          { status: 403 },
        );
      }
      if (profile.status === "active") {
        return NextResponse.json({ error: "Your account is already active" }, { status: 400 });
      }
      updates = {
        status: "active",
        suspension_reason: null,
        suspended_at: null,
      };
      break;
    }
  }

  const { error: updateErr } = await supabaseServer
    .from("profiles")
    .update(updates)
    .eq("id", user.id);

  if (updateErr) {
    console.error("[account] Update error:", updateErr);
    return NextResponse.json({ error: "Failed to update account" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    action,
    status: updates.status as string,
  });
}
