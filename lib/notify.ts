import "server-only";
import { supabaseServer } from "./supabaseServer";
import { resend, FROM_EMAIL, isResendConfigured } from "./resend";
import { getEmailContent } from "./emailTemplates";
import { REQUIRED_NOTIFICATION_TYPES, type NotificationType } from "./notificationTypes";
import webpush from "web-push";

// Configure VAPID keys for Web Push
const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivate = process.env.VAPID_PRIVATE_KEY;

if (vapidPublic && vapidPrivate) {
  webpush.setVapidDetails("mailto:support@useletsgo.com", vapidPublic, vapidPrivate);
} else {
  console.warn("[notify] VAPID keys not configured — push notifications disabled. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.");
}

// ── Types ──────────────────────────────────────────────

interface NotifyParams {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}

// ── Core notify function ───────────────────────────────

/**
 * Send a notification to a user across all enabled channels.
 * Fire-and-forget safe — errors are caught and logged, never thrown.
 *
 * Flow:
 * 1. Insert into user_notifications (triggers Supabase Realtime for in-app)
 * 2. Check user_notification_preferences for this type
 * 3. If email enabled: send via Resend
 * 4. If push enabled: send via Web Push to all registered devices
 */
export async function notify(params: NotifyParams): Promise<void> {
  const { userId, type, title, body, metadata = {} } = params;

  try {
    // 1. Insert notification row (Supabase Realtime picks this up for in-app)
    const { data: inserted, error: insertErr } = await supabaseServer
      .from("user_notifications")
      .insert({
        user_id: userId,
        type,
        title,
        body,
        metadata,
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error("[notify] Insert failed:", insertErr.message);
      return;
    }

    const notificationId = inserted?.id;

    // 2. Load user preferences for this notification type
    // Transactional types are always sent — skip preference check
    const isRequired = REQUIRED_NOTIFICATION_TYPES.has(type);
    let emailEnabled = true;
    let pushEnabled = true;

    if (!isRequired) {
      const { data: pref } = await supabaseServer
        .from("user_notification_preferences")
        .select("in_app, email, push")
        .eq("user_id", userId)
        .eq("notification_type", type)
        .maybeSingle();

      emailEnabled = pref?.email ?? true;
      pushEnabled = pref?.push ?? true;
    }

    // 3. Load user profile for email address
    const { data: profile } = await supabaseServer
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .maybeSingle();

    // 4. Send email if enabled and Resend is configured
    if (emailEnabled && profile?.email && isResendConfigured) {
      try {
        const emailContent = getEmailContent(type, metadata);
        await resend.emails.send({
          from: FROM_EMAIL,
          to: String(profile.email),
          subject: emailContent.subject,
          html: emailContent.html,
        });

        if (notificationId) {
          await supabaseServer
            .from("user_notifications")
            .update({ email_sent: true })
            .eq("id", notificationId);
        }
      } catch (emailErr) {
        console.error("[notify] Email send failed:", emailErr);
      }
    }

    // 5. Send push if enabled and VAPID is configured
    if (pushEnabled && vapidPublic && vapidPrivate) {
      try {
        const { data: subs } = await supabaseServer
          .from("push_subscriptions")
          .select("endpoint, p256dh, auth_key")
          .eq("user_id", userId);

        if (subs && subs.length > 0) {
          const payload = JSON.stringify({ title, body, type, metadata });

          await Promise.allSettled(
            subs.map((sub) =>
              webpush
                .sendNotification(
                  {
                    endpoint: sub.endpoint,
                    keys: { p256dh: sub.p256dh, auth: sub.auth_key },
                  },
                  payload
                )
                .catch((err: { statusCode?: number }) => {
                  // If subscription expired (410 Gone), remove it
                  if (err.statusCode === 410) {
                    supabaseServer
                      .from("push_subscriptions")
                      .delete()
                      .eq("endpoint", sub.endpoint)
                      .then(({ error }) => {
                        if (error) console.error("[notify] Failed to remove expired push subscription:", error.message);
                      });
                  }
                })
            )
          );

          if (notificationId) {
            await supabaseServer
              .from("user_notifications")
              .update({ push_sent: true })
              .eq("id", notificationId);
          }
        }
      } catch (pushErr) {
        console.error("[notify] Push send failed:", pushErr);
      }
    }
  } catch (err) {
    console.error("[notify] Unexpected error:", err);
  }
}
