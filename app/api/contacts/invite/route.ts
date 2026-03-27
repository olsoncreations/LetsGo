import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { resend, FROM_EMAIL } from "@/lib/resend";
import { getEmailContent } from "@/lib/emailTemplates";
import { notify } from "@/lib/notify";
import { NOTIFICATION_TYPES } from "@/lib/notificationTypes";

// ─── Types ───

interface InviteInput {
  name: string;
  email: string;
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
// POST /api/contacts/invite
//
// Send invite emails to non-users via Resend.
// Inserts rows into contact_invites table.
// Rate limited: max 50 per request, 100 per user per day.
//
// Body: { invites: InviteInput[] }
// Returns: { sent: number, skipped: number }
// ═══════════════════════════════════════════════════

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const userId = await extractUserId(req);
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const invites = (body.invites ?? []) as InviteInput[];

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
    const dayAgo = todayUTC.toISOString();
    const { count: todayCount } = await supabaseServer
      .from("contact_invites")
      .select("id", { count: "exact", head: true })
      .eq("inviter_id", userId)
      .gte("created_at", dayAgo);

    const remaining = 100 - (todayCount ?? 0);
    if (remaining <= 0) {
      return NextResponse.json(
        { error: "Daily invite limit reached (100/day). Try again tomorrow." },
        { status: 429 }
      );
    }

    const toSend = capped.slice(0, remaining);

    // Look up inviter profile for personalization
    const { data: inviterProfile } = await supabaseServer
      .from("profiles")
      .select("full_name, first_name, last_name, referral_code")
      .eq("id", userId)
      .maybeSingle();

    const inviterName = inviterProfile?.full_name
      || [inviterProfile?.first_name, inviterProfile?.last_name].filter(Boolean).join(" ")
      || "A friend";
    const referralCode = inviterProfile?.referral_code || "";

    let sent = 0;
    let skipped = 0;

    for (const invite of toSend) {
      const email = invite.email?.toLowerCase().trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        skipped++;
        continue;
      }

      // Upsert into contact_invites (skip if already exists)
      const { error: upsertError } = await supabaseServer
        .from("contact_invites")
        .upsert(
          {
            inviter_id: userId,
            contact_name: invite.name || null,
            contact_email: email,
            status: "pending",
          },
          { onConflict: "inviter_id,contact_email", ignoreDuplicates: true }
        );

      if (upsertError) {
        console.error("[contacts/invite] Upsert error:", upsertError.message);
        skipped++;
        continue;
      }

      // Send invite email via Resend
      try {
        const emailContent = getEmailContent("friend_invite", {
          inviterName,
          contactName: invite.name || "there",
          referralCode,
        });

        await resend.emails.send({
          from: FROM_EMAIL,
          to: email,
          subject: emailContent.subject,
          html: emailContent.html,
        });

        sent++;

        // Notify sender that invite was sent
        notify({
          userId,
          type: NOTIFICATION_TYPES.FRIEND_INVITE,
          title: "Invite Sent",
          body: `Your invite to ${invite.name || email} was sent successfully.`,
          metadata: { contactEmail: email, contactName: invite.name || null, href: "/welcome/find-friends" },
        });
      } catch (emailErr) {
        console.error("[contacts/invite] Email send failed for", email, emailErr);
        skipped++;
      }
    }

    return NextResponse.json({
      sent,
      skipped,
      remaining: remaining - sent,
    });
  } catch (err) {
    console.error("[contacts/invite] POST unexpected error:", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
