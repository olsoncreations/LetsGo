import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * GET /api/influencers/me
 * Auth required. Returns the influencer record + dashboard data for the logged-in user.
 * Matches by user_id column first, then falls back to email matching.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ isInfluencer: false }, { status: 401 });
  }

  const { data: { user }, error: authError } = await supabaseServer.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ isInfluencer: false }, { status: 401 });
  }

  // Try matching by user_id first, then by email
  let influencer: Record<string, unknown> | null = null;

  const { data: byUserId } = await supabaseServer
    .from("influencers")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (byUserId) {
    influencer = byUserId;
  } else if (user.email) {
    const { data: byEmail } = await supabaseServer
      .from("influencers")
      .select("*")
      .ilike("email", user.email)
      .maybeSingle();

    if (byEmail) {
      influencer = byEmail;
      // Auto-link user_id for future lookups
      await supabaseServer
        .from("influencers")
        .update({ user_id: user.id })
        .eq("id", byEmail.id as string);
    }
  }

  if (!influencer) {
    return NextResponse.json({ isInfluencer: false });
  }

  const influencerId = influencer.id as string;

  // Fetch recent signups (last 10)
  const { data: signupRows } = await supabaseServer
    .from("influencer_signups")
    .select("user_id, created_at")
    .eq("influencer_id", influencerId)
    .order("created_at", { ascending: false })
    .limit(10);

  // Enrich signups with user names
  const recentSignups: { userName: string; createdAt: string }[] = [];
  if (signupRows && signupRows.length > 0) {
    const userIds = signupRows.map(s => s.user_id);
    const { data: profiles } = await supabaseServer
      .from("profiles")
      .select("id, full_name, first_name, last_name")
      .in("id", userIds);

    const profileMap = new Map(
      (profiles || []).map(p => [p.id, p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || "User"])
    );

    for (const s of signupRows) {
      recentSignups.push({
        userName: profileMap.get(s.user_id) || "User",
        createdAt: s.created_at,
      });
    }
  }

  // Fetch payouts
  const { data: payoutRows } = await supabaseServer
    .from("influencer_payouts")
    .select("id, amount_cents, signups_count, rate_per_thousand_cents, period_start, period_end, paid, paid_at, created_at")
    .eq("influencer_id", influencerId)
    .order("created_at", { ascending: false })
    .limit(20);

  // Fetch rate tiers
  const { data: rateTierRows } = await supabaseServer
    .from("influencer_rate_tiers")
    .select("tier_index, min_signups, max_signups, rate_cents, label")
    .eq("influencer_id", influencerId)
    .order("tier_index", { ascending: true });

  return NextResponse.json({
    isInfluencer: true,
    influencer: {
      id: influencer.id,
      name: influencer.name,
      code: influencer.code,
      tier: influencer.tier,
      status: influencer.status,
      totalSignups: influencer.total_signups,
      totalClicks: influencer.total_clicks,
      totalPaidCents: influencer.total_paid_cents,
      ratePerThousandCents: influencer.rate_per_thousand_cents,
      instagramHandle: influencer.instagram_handle,
      tiktokHandle: influencer.tiktok_handle,
      youtubeHandle: influencer.youtube_handle,
      twitterHandle: influencer.twitter_handle,
    },
    rateTiers: (rateTierRows || []).map(t => ({
      tierIndex: t.tier_index,
      minSignups: t.min_signups,
      maxSignups: t.max_signups,
      rateCents: t.rate_cents,
      label: t.label,
    })),
    recentSignups,
    payouts: (payoutRows || []).map(p => ({
      id: p.id,
      amountCents: p.amount_cents,
      signupsCount: p.signups_count,
      periodStart: p.period_start,
      periodEnd: p.period_end,
      paid: p.paid,
      paidAt: p.paid_at,
      createdAt: p.created_at,
    })),
  });
}
