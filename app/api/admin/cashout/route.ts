import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * POST /api/admin/cashout
 * Admin-initiated cashout for a user. Creates a payout record via the
 * atomic request_cashout RPC, bypassing the user-side method/cap checks.
 *
 * Body: { userId: string, amountCents: number }
 */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    // Auth: require staff
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const { data: { user }, error: authErr } = await supabaseServer.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const { data: staff } = await supabaseServer
      .from("staff_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!staff) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

    const body = await req.json();
    const { userId, amountCents } = body as { userId?: string; amountCents?: number };

    if (!userId || typeof amountCents !== "number" || amountCents <= 0) {
      return NextResponse.json({ error: "userId and positive amountCents required" }, { status: 400 });
    }

    // Fetch user profile for payout method
    const { data: profile } = await supabaseServer
      .from("profiles")
      .select("payout_method, payout_identifier, stripe_connect_account_id, stripe_connect_onboarding_complete")
      .eq("id", userId)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    const method = (profile.payout_method as string) || "bank";
    const feeCents = method === "venmo" ? Math.round(amountCents * 0.03) : 0;
    const netCents = amountCents - feeCents;

    let account = "admin-initiated";
    if (method === "venmo" && profile.payout_identifier) {
      account = profile.payout_identifier as string;
    } else if (method === "bank" && profile.stripe_connect_account_id) {
      account = `bank:${(profile.stripe_connect_account_id as string).slice(0, 12)}...`;
    }

    // Use the atomic RPC with a high cap to avoid blocking admin cashouts
    const { data: rpcResult, error: rpcError } = await supabaseServer.rpc("request_cashout", {
      p_user_id: userId,
      p_amount_cents: amountCents,
      p_fee_cents: feeCents,
      p_net_cents: netCents,
      p_method: method,
      p_account: account,
      p_breakdown: { admin_initiated: true, initiated_by: user.id },
      p_monthly_cap: 99999999,
      p_min_cents: 1,
    });

    if (rpcError) {
      const msg = rpcError.message || "Cashout failed";
      const match = msg.match(/CASHOUT_ERROR:(.*)/);
      const userMessage = match ? match[1].trim() : "Cashout failed";
      return NextResponse.json({ error: userMessage }, { status: 400 });
    }

    const payout = rpcResult as { id: string; status: string };

    return NextResponse.json({ ok: true, payoutId: payout.id, status: payout.status }, { status: 201 });
  } catch (err) {
    console.error("[admin/cashout] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
