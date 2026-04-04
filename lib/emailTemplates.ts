import "server-only";
import type { NotificationType } from "./notificationTypes";

interface EmailContent {
  subject: string;
  html: string;
  text?: string;
}

// ── Branded email wrapper ──────────────────────────────
// accentColor: hex color for the accent border + highlights (e.g. "#39FF14", "#FF2D78")
// Uses table layout + hex colors for maximum email client compatibility
function wrapInTemplate(
  title: string,
  bodyHtml: string,
  accentColor: string,
  ctaUrl?: string,
  ctaText?: string,
): string {
  const ctaBlock = ctaUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:28px 0"><tr><td align="center">
        <a href="${process.env.NEXT_PUBLIC_SITE_URL || "https://www.useletsgo.com"}${ctaUrl}" style="display:inline-block;padding:14px 36px;background-color:#FF2D78;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:50px;letter-spacing:0.05em">${ctaText || "Open LetsGo"}</a>
      </td></tr></table>`
    : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#06060C;font-family:'Helvetica Neue',Arial,sans-serif;color:#ffffff">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#06060C">
    <tr><td align="center" style="padding:40px 20px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px">

        <!-- Logo -->
        <tr><td align="center" style="padding-bottom:32px">
          <img src="${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/business-logos/lg-logo.png" alt="LetsGo" width="120" style="display:block;margin:0 auto;border:0;outline:none;height:auto" />
          <div style="width:60px;height:2px;background-color:${accentColor};margin:8px auto 0"></div>
        </td></tr>

        <!-- Card with accent border -->
        <tr><td>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:2px solid ${accentColor};border-radius:16px;overflow:hidden">
            <tr><td style="background-color:#0D0D18;padding:32px 28px">

              <!-- Title -->
              <h1 style="color:#ffffff;font-size:24px;font-weight:800;margin:0 0 6px;letter-spacing:-0.02em">${title}</h1>
              <div style="width:40px;height:3px;background-color:${accentColor};margin-bottom:20px"></div>

              <!-- Body -->
              <div style="color:#bfbfcf;font-size:15px;line-height:1.8">
                ${bodyHtml}
              </div>

              ${ctaBlock}
            </td></tr>
          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="text-align:center;padding-top:32px;color:#555570;font-size:11px;line-height:1.6">
          <p style="margin:0;letter-spacing:0.08em">Go. Play. Eat. Get paid to live your best life.</p>
          <p style="margin:10px 0 0">
            <a href="${process.env.NEXT_PUBLIC_SITE_URL || "https://www.useletsgo.com"}/profile" style="color:#7a7a90;text-decoration:underline">Notification Settings</a>
            &nbsp;&middot;&nbsp;
            <a href="${process.env.NEXT_PUBLIC_SITE_URL || "https://www.useletsgo.com"}/privacy" style="color:#7a7a90;text-decoration:underline">Privacy</a>
          </p>
          <p style="margin:10px 0 0;color:#333345">&copy; ${new Date().getFullYear()} LetsGo</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Per-type email templates ───────────────────────────

function receiptApprovedEmail(meta: Record<string, unknown>): EmailContent {
  const businessName = String(meta.businessName || "a business");
  const payoutCents = Number(meta.payoutCents || 0);
  const payoutStr = `$${(payoutCents / 100).toFixed(2)}`;

  return {
    subject: `Ka-ching! You earned ${payoutStr} at ${businessName}`,
    html: wrapInTemplate(
      "You just got paid!",
      `<p>Your receipt at <strong style="color:#fff">${businessName}</strong> has been verified and your cashback is ready.</p>
       <div style="background-color:#0e1f0c;border:1px solid #1a3a15;border-radius:12px;padding:20px;margin:20px 0;text-align:center">
         <div style="color:#8888a0;font-size:11px;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:6px">Cashback Earned</div>
         <div style="color:#39FF14;font-size:36px;font-weight:800">${payoutStr}</div>
         <div style="color:#6a6a80;font-size:12px;margin-top:4px">at ${businessName}</div>
       </div>
       <p>Keep going back to level up your rewards even higher!</p>`,
      "#39FF14",
      "/profile",
      "See Your Balance"
    ),
  };
}

function receiptRejectedEmail(meta: Record<string, unknown>): EmailContent {
  const businessName = String(meta.businessName || "a business");
  const reason = meta.reason ? String(meta.reason) : null;

  return {
    subject: "Quick heads up about your receipt",
    html: wrapInTemplate(
      "Let's try that again",
      `<p>Your receipt at <strong style="color:#fff">${businessName}</strong> couldn't be verified this time.</p>
       ${reason ? `<div style="background:#171720;border-left:3px solid #3a3a4a;padding:12px 16px;margin:16px 0;border-radius:0 8px 8px 0"><p style="color:#9090a5;font-style:italic;margin:0;font-size:13px">${reason}</p></div>` : ""}
       <p>No worries! Just make sure the photo is clear and shows the date, business name, and total. Then resubmit and you're good to go.</p>`,
      "#FF6B35",
      "/profile",
      "Resubmit Receipt"
    ),
  };
}

function payoutProcessedEmail(meta: Record<string, unknown>): EmailContent {
  const amountCents = Number(meta.amountCents || 0);
  const amountStr = `$${(amountCents / 100).toFixed(2)}`;
  const method = String(meta.method || "your account");

  return {
    subject: `${amountStr} is on its way to your ${method}!`,
    html: wrapInTemplate(
      "Money's on the way!",
      `<div style="background-color:#0e1f0c;border:1px solid #1a3a15;border-radius:12px;padding:20px;margin:16px 0;text-align:center">
         <div style="color:#8888a0;font-size:11px;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:6px">Cashout Sent</div>
         <div style="color:#39FF14;font-size:36px;font-weight:800">${amountStr}</div>
         <div style="color:#6a6a80;font-size:12px;margin-top:6px">via ${method}</div>
       </div>
       <p>Expect it in 1-3 business days. Getting paid to live your best life feels good, doesn't it?</p>`,
      "#39FF14",
      "/profile",
      "View Profile"
    ),
  };
}

function tierLevelUpEmail(meta: Record<string, unknown>): EmailContent {
  const businessName = String(meta.businessName || "a business");
  const newTier = Number(meta.newTier || 0);
  const newRate = String(meta.newRate || "");

  return {
    subject: `You leveled up at ${businessName}!`,
    html: wrapInTemplate(
      "Level up! You're earning more now",
      `<p>Your loyalty at <strong style="color:#fff">${businessName}</strong> just paid off big time.</p>
       <div style="background-color:#170e20;border:1px solid #2e1a40;border-radius:12px;padding:20px;margin:20px 0;text-align:center">
         <div style="color:#8888a0;font-size:11px;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:6px">New Reward Rate</div>
         <div style="color:#BF5FFF;font-size:36px;font-weight:800">${newRate}</div>
         <div style="color:#6a6a80;font-size:12px;margin-top:6px">Tier ${newTier} cashback</div>
       </div>
       <p>Every visit earns you more. Keep the streak alive!</p>`,
      "#BF5FFF",
      "/profile",
      "See Your Progress"
    ),
  };
}

function newMessageEmail(meta: Record<string, unknown>): EmailContent {
  const preview = String(meta.preview || "You have a new message");

  return {
    subject: "You've got a message from LetsGo",
    html: wrapInTemplate(
      "New message for you",
      `<p>The LetsGo team sent you a message:</p>
       <div style="background-color:#0c1820;border:1px solid #0d2a35;border-radius:12px;padding:18px;margin:16px 0">
         <p style="color:#d0d0dd;font-style:italic;margin:0;font-size:14px;line-height:1.6">"${preview}"</p>
       </div>
       <p>Tap below to reply and keep the conversation going.</p>`,
      "#00D4FF",
      "/profile",
      "Reply Now"
    ),
  };
}

function friendRequestEmail(meta: Record<string, unknown>): EmailContent {
  const fromName = String(meta.fromName || "Someone");

  return {
    subject: `${fromName} wants to be friends on LetsGo!`,
    html: wrapInTemplate(
      "You've got a friend request!",
      `<div style="text-align:center;margin:16px 0">
         <div style="display:inline-block;width:64px;height:64px;border-radius:50%;background-color:#FF2D78;line-height:64px;text-align:center;font-size:28px;font-weight:800;color:#fff">${String(meta.fromName || "?")[0].toUpperCase()}</div>
       </div>
       <p style="text-align:center"><strong style="color:#fff;font-size:16px">${fromName}</strong><br><span style="color:#7a7a90;font-size:13px">wants to connect with you</span></p>
       <p>Accept and you'll be able to play games together, discover new spots, and see each other's adventures!</p>`,
      "#FF2D78",
      "/profile",
      "Accept Request"
    ),
  };
}

function friendAcceptedEmail(meta: Record<string, unknown>): EmailContent {
  const friendName = String(meta.friendName || "Your friend");

  return {
    subject: `You and ${friendName} are now friends!`,
    html: wrapInTemplate(
      "It's official!",
      `<div style="text-align:center;margin:16px 0">
         <div style="display:inline-block;width:64px;height:64px;border-radius:50%;background-color:#39FF14;line-height:64px;text-align:center;font-size:28px;font-weight:800;color:#0D0D18">${String(meta.friendName || "?")[0].toUpperCase()}</div>
       </div>
       <p style="text-align:center"><strong style="color:#fff;font-size:16px">${friendName}</strong><br><span style="color:#7a7a90;font-size:13px">accepted your friend request</span></p>
       <p>Now you can challenge each other to 5-3-1 games, join group votes, and discover spots together. Time to go do something fun!</p>`,
      "#39FF14",
      "/profile",
      "Start a Game"
    ),
  };
}

function gameInviteEmail(meta: Record<string, unknown>): EmailContent {
  const fromName = String(meta.fromName || "A friend");
  const gameCode = String(meta.gameCode || "");

  return {
    subject: `${fromName} challenged you to 5-3-1! Let's go!`,
    html: wrapInTemplate(
      "You've been challenged!",
      `<p><strong style="color:#fff">${fromName}</strong> wants to settle where to go tonight. 5 picks, 3 narrows, 1 winner.</p>
       <p>Don't keep them waiting! Jump in and pick your top spots.</p>`,
      "#FFD600",
      gameCode ? `/5v3v1?code=${gameCode}` : "/5v3v1",
      "Accept Challenge"
    ),
  };
}

function gameAdvancedEmail(meta: Record<string, unknown>): EmailContent {
  const gameCode = String(meta.gameCode || "");
  const stage = String(meta.stage || "next round");

  return {
    subject: "It's your turn! Don't leave them hanging",
    html: wrapInTemplate(
      "Your turn to pick!",
      `<p>The game just moved to the <strong style="color:#FFD600">${stage}</strong> round and it's waiting on you.</p>
       <p>The clock is ticking! Get in there and make your picks before your friend does it for you.</p>`,
      "#FFD600",
      gameCode ? `/5v3v1?code=${gameCode}` : "/5v3v1",
      "Make Your Pick"
    ),
  };
}

function gameCompleteEmail(meta: Record<string, unknown>): EmailContent {
  const winnerName = String(meta.businessName || meta.winnerName || "the winner");

  return {
    subject: "The results are in! Where are you going?",
    html: wrapInTemplate(
      "And the winner is...",
      `<div style="background-color:#0e1f0c;border:1px solid #1a3a15;border-radius:12px;padding:20px;margin:16px 0;text-align:center">
         <div style="color:#8888a0;font-size:11px;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:6px">Tonight's Pick</div>
         <div style="color:#39FF14;font-size:24px;font-weight:800">${winnerName}</div>
       </div>
       <p>The votes are in and the people have spoken. Time to get out there and enjoy it!</p>`,
      "#FFD600",
      "/5v3v1",
      "See Full Results"
    ),
  };
}

function groupRoundEndedEmail(meta: Record<string, unknown>): EmailContent {
  const round = meta.round ? String(meta.round) : "the current round";

  return {
    subject: "Votes are in! See what made the cut",
    html: wrapInTemplate(
      "Round complete!",
      `<p>Voting for <strong style="color:#00FF87">${round}</strong> just wrapped up and the results are ready.</p>
       <p>See which spots survived and which got voted off. The competition is heating up!</p>`,
      "#00FF87",
      "/group",
      "See Who Advanced"
    ),
  };
}

function newEventEmail(meta: Record<string, unknown>): EmailContent {
  const businessName = String(meta.businessName || "a place you follow");
  const eventTitle = String(meta.eventTitle || "a new event");
  const eventDate = meta.eventDate ? String(meta.eventDate) : null;

  return {
    subject: `${businessName} is throwing an event! Don't miss it`,
    html: wrapInTemplate(
      "Something's happening!",
      `<p>One of your favorite spots just dropped something exciting:</p>
       <div style="background-color:#1a0e20;border:1px solid #301a40;border-radius:12px;padding:20px;margin:20px 0;text-align:center">
         <div style="color:#8888a0;font-size:11px;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:6px">${businessName}</div>
         <div style="color:#D050FF;font-size:22px;font-weight:800">${eventTitle}</div>
         ${eventDate ? `<div style="color:#8888a0;font-size:13px;margin-top:8px">${eventDate}</div>` : ""}
       </div>
       <p>Check it out before it's too late. You don't want to miss this!</p>`,
      "#D050FF",
      "/events",
      "See Event"
    ),
  };
}

function datenightReadyEmail(): EmailContent {
  return {
    subject: "Your perfect date night is ready!",
    html: wrapInTemplate(
      "Date night, sorted!",
      `<p>We handpicked the perfect combo just for you \u2014 a restaurant and an activity that go together like... well, a perfect date night.</p>
       <div style="text-align:center;margin:20px 0">
         <div style="display:inline-block;font-size:40px;line-height:1">&#x1F37D;&#xFE0F; + &#x1F3AE;</div>
       </div>
       <p>Open up and see what we matched you with. All you have to do is show up and have a great time!</p>`,
      "#FF2D78",
      "/datenight",
      "See Your Match"
    ),
  };
}

function mediaApprovedEmail(meta: Record<string, unknown>): EmailContent {
  const businessName = String(meta.businessName || "a business");

  return {
    subject: `Your photo at ${businessName} is now live!`,
    html: wrapInTemplate(
      "You're on the feed!",
      `<p>Your photo/video at <strong style="color:#fff">${businessName}</strong> just went live on the Experiences feed.</p>
       <div style="background-color:#1f1210;border:1px solid #3a1a10;border-radius:12px;padding:18px;margin:20px 0;text-align:center">
         <div style="color:#FF6B2D;font-size:18px;font-weight:700">Now visible to everyone</div>
         <div style="color:#7a7a90;font-size:13px;margin-top:4px">at ${businessName}</div>
       </div>
       <p>Go check it out and see what other people are sharing too!</p>`,
      "#FF6B2D",
      "/experiences",
      "View Your Post"
    ),
  };
}

function mediaRejectedEmail(meta: Record<string, unknown>): EmailContent {
  const businessName = String(meta.businessName || "a business");

  return {
    subject: "Quick note about your photo submission",
    html: wrapInTemplate(
      "Let's try a different shot",
      `<p>Your photo/video at <strong style="color:#fff">${businessName}</strong> didn't quite make it through review this time.</p>
       <p>This usually happens when the image is blurry, too dark, or doesn't show the experience clearly. No big deal \u2014 just snap a new one next time you're there!</p>`,
      "#FF6B2D",
      "/experiences",
      "Submit New Photo"
    ),
  };
}

function receiptSubmittedEmail(meta: Record<string, unknown>): EmailContent {
  const userName = String(meta.userName || "A customer");
  const amountStr = meta.amountCents ? `$${(Number(meta.amountCents) / 100).toFixed(2)}` : "";

  return {
    subject: `New receipt from ${userName}${amountStr ? ` \u2014 ${amountStr}` : ""}`,
    html: wrapInTemplate(
      "New receipt to review",
      `<div style="background-color:#0e1f0c;border:1px solid #1a3a15;border-radius:12px;padding:20px;margin:16px 0;text-align:center">
         <div style="color:#8888a0;font-size:11px;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:6px">Receipt From</div>
         <div style="color:#fff;font-size:20px;font-weight:700">${userName}</div>
         ${amountStr ? `<div style="color:#39FF14;font-size:28px;font-weight:800;margin-top:6px">${amountStr}</div>` : ""}
       </div>
       <p>A customer just submitted a receipt. Head to your dashboard to approve or reject it.</p>`,
      "#14b8a6",
      "/businessprofile-v2",
      "Review Now"
    ),
  };
}

function friendInviteEmail(meta: Record<string, unknown>): EmailContent {
  const inviterName = String(meta.inviterName || "").trim();
  const hasName = inviterName && inviterName !== "A friend";
  const displayName = hasName ? inviterName : "Your friend";
  const contactName = String(meta.contactName || "there");
  const ref = meta.referralCode ? `?ref=${String(meta.referralCode)}` : "";

  return {
    subject: hasName
      ? `${displayName} invited you to join LetsGo`
      : "You've been invited to join LetsGo",
    html: wrapInTemplate(
      `Hey ${contactName}!`,
      `<p><strong style="color:#fff">${displayName}</strong> thinks you'd love <strong style="color:#FF2D78">LetsGo</strong> \u2014 the app where you discover restaurants and activities, earn rewards for repeat visits, and play games with friends to decide where to go.</p>
       <div style="background-color:#170e20;border:1px solid #2e1a40;border-radius:12px;padding:20px;margin:20px 0;text-align:center">
         <div style="color:#8888a0;font-size:11px;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:10px">What you get</div>
         <div style="color:#fff;font-size:14px;line-height:2">
           Rewards on every visit (5% \u2192 20%)<br>
           Fun voting games with friends<br>
           Share your best moments<br>
           Discover new spots near you
         </div>
       </div>
       <p>Join ${hasName ? displayName : "the crew"} and start exploring!</p>`,
      "#FF2D78",
      `/welcome${ref}`,
      "Join LetsGo"
    ),
    text: `Hey ${contactName}!\n\n${displayName} thinks you'd love LetsGo — the app where you discover restaurants and activities, earn rewards for repeat visits, and play games with friends to decide where to go.\n\nWhat you get:\n- Rewards on every visit (5% to 20%)\n- Fun voting games with friends\n- Share your best moments\n- Discover new spots near you\n\nJoin ${hasName ? displayName : "the crew"} and start exploring!\n\nSign up: ${process.env.NEXT_PUBLIC_SITE_URL || "https://www.useletsgo.com"}/welcome${ref}`,
  };
}

// ── Dispatcher ─────────────────────────────────────────

export function getEmailContent(type: NotificationType, metadata: Record<string, unknown>): EmailContent {
  switch (type) {
    case "receipt_approved":
      return receiptApprovedEmail(metadata);
    case "receipt_rejected":
      return receiptRejectedEmail(metadata);
    case "payout_processed":
      return payoutProcessedEmail(metadata);
    case "tier_level_up":
      return tierLevelUpEmail(metadata);
    case "new_message":
      return newMessageEmail(metadata);
    case "friend_request":
      return friendRequestEmail(metadata);
    case "friend_accepted":
      return friendAcceptedEmail(metadata);
    case "game_invite":
      return gameInviteEmail(metadata);
    case "game_advanced":
      return gameAdvancedEmail(metadata);
    case "game_complete":
      return gameCompleteEmail(metadata);
    case "group_round_ended":
      return groupRoundEndedEmail(metadata);
    case "datenight_ready":
      return datenightReadyEmail();
    case "new_event":
      return newEventEmail(metadata);
    case "media_approved":
      return mediaApprovedEmail(metadata);
    case "media_rejected":
      return mediaRejectedEmail(metadata);
    case "receipt_submitted":
      return receiptSubmittedEmail(metadata);
    case "friend_invite":
      return friendInviteEmail(metadata);
    default:
      return {
        subject: "LetsGo Notification",
        html: wrapInTemplate("Notification", `<p>${metadata.body || "You have a new notification."}</p>`, "#FF2D78", "/profile", "Open LetsGo"),
      };
  }
}
