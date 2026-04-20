import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { twilioClient, twilioPhoneNumber, isTwilioConfigured } from "@/lib/twilio";

// ─── Types ───

interface SmsInvite {
  name: string;
  phone: string;
}

/**
 * Extract user ID from Authorization Bearer token.
 */
async function extractUserId(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const { data } = await supabaseServer.auth.getUser(token);
  return data.user?.id ?? null;
}

// ═══════════════════════════════════════════════════
// POST /api/contacts/invite-sms
//
// Send invite texts to non-users via Twilio.
// Rate limited: max 50 per request, 200 per user per day.
//
// Body: { invites: SmsInvite[] }
// Returns: { sent: number, failed: number }
// ═══════════════════════════════════════════════════

export async function POST(req: NextRequest): Promise<Response> {
  try {
    if (!isTwilioConfigured || !twilioClient) {
      return NextResponse.json(
        { error: "SMS service not configured" },
        { status: 503 }
      );
    }

    const userId = await extractUserId(req);
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const invites = (body.invites ?? []) as SmsInvite[];

    if (!Array.isArray(invites) || invites.length === 0) {
      return NextResponse.json(
        { error: "invites array is required" },
        { status: 400 }
      );
    }

    // Cap at 50 per request
    const capped = invites.slice(0, 50);

    // Check daily rate limit (100 per user per calendar day UTC)
    const todayUTC = new Date();
    todayUTC.setUTCHours(0, 0, 0, 0);
    const { count: todayCount } = await supabaseServer
      .from("contact_invites")
      .select("id", { count: "exact", head: true })
      .eq("inviter_id", userId)
      .gte("created_at", todayUTC.toISOString());

    const remaining = 200 - (todayCount ?? 0);
    if (remaining <= 0) {
      return NextResponse.json(
        { error: "Daily invite limit reached (200/day). Try again tomorrow." },
        { status: 429 }
      );
    }

    const toSend = capped.slice(0, remaining);

    // Look up inviter profile for personalization
    const { data: inviterProfile } = await supabaseServer
      .from("profiles")
      .select("full_name, first_name, last_name")
      .eq("id", userId)
      .maybeSingle();

    let inviterName = inviterProfile?.full_name
      || [inviterProfile?.first_name, inviterProfile?.last_name].filter(Boolean).join(" ")
      || "";

    // Fallback to auth user metadata if profile name is empty
    if (!inviterName) {
      try {
        const { data: { user: authUser } } = await supabaseServer.auth.admin.getUserById(userId);
        const meta = authUser?.user_metadata;
        if (meta) {
          inviterName = meta.full_name || meta.name
            || [meta.first_name, meta.last_name].filter(Boolean).join(" ")
            || "";
        }
      } catch { /* ignore auth lookup failure */ }
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.useletsgo.com";
    const displayName = inviterName || "Your friend";

    let sent = 0;
    let failed = 0;

    for (const invite of toSend) {
      // Normalize phone number — strip non-digits, ensure +1 prefix
      let phone = invite.phone.replace(/\D/g, "");
      if (phone.length === 10) phone = "1" + phone;
      if (!phone.startsWith("+")) phone = "+" + phone;

      if (phone.length < 11) {
        failed++;
        continue;
      }

      // Record invite in contact_invites table
      const { error: upsertError } = await supabaseServer
        .from("contact_invites")
        .upsert(
          {
            inviter_id: userId,
            contact_name: invite.name || null,
            contact_email: null,
            contact_phone: phone,
            status: "pending",
          },
          { onConflict: "inviter_id,contact_email", ignoreDuplicates: true }
        );

      if (upsertError) {
        console.error("[contacts/invite-sms] Upsert error:", upsertError.message);
      }

      // Send SMS via Twilio
      try {
        const messageBody = inviterName
          ? `${displayName} invited you to join LetsGo — discover restaurants, earn rewards, and play games with friends! Sign up here: ${siteUrl}/welcome`
          : `You've been invited to join LetsGo — discover restaurants, earn rewards, and play games with friends! Sign up here: ${siteUrl}/welcome`;

        await twilioClient.messages.create({
          body: messageBody,
          from: twilioPhoneNumber,
          to: phone,
        });

        sent++;
      } catch (smsErr) {
        console.error("[contacts/invite-sms] Twilio send failed for", phone, smsErr);
        failed++;
      }
    }

    return NextResponse.json({ sent, failed });
  } catch (err) {
    console.error("[contacts/invite-sms] POST unexpected error:", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
