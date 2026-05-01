// ── Notification Types & Constants ──────────────────────
// Shared between server and client code

export const NOTIFICATION_TYPES = {
  RECEIPT_APPROVED: "receipt_approved",
  RECEIPT_REJECTED: "receipt_rejected",
  PAYOUT_PROCESSED: "payout_processed",
  TIER_LEVEL_UP: "tier_level_up",
  NEW_MESSAGE: "new_message",
  FRIEND_REQUEST: "friend_request",
  FRIEND_ACCEPTED: "friend_accepted",
  GAME_INVITE: "game_invite",
  GAME_ADVANCED: "game_advanced",
  GAME_COMPLETE: "game_complete",
  GROUP_ROUND_ENDED: "group_round_ended",
  DATENIGHT_READY: "datenight_ready",
  NEW_EVENT: "new_event",
  MEDIA_APPROVED: "media_approved",
  MEDIA_REJECTED: "media_rejected",
  RECEIPT_SUBMITTED: "receipt_submitted",
  FRIEND_INVITE: "friend_invite",
  APPLICATION_APPROVED: "application_approved",
  APPLICATION_REJECTED: "application_rejected",
  BUSINESS_SHARED: "business_shared",
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

export type NotificationChannel = "in_app" | "email" | "push";

// Transactional notification types — always sent, users cannot disable these
export const REQUIRED_NOTIFICATION_TYPES: Set<NotificationType> = new Set([
  NOTIFICATION_TYPES.RECEIPT_APPROVED,
  NOTIFICATION_TYPES.RECEIPT_REJECTED,
  NOTIFICATION_TYPES.PAYOUT_PROCESSED,
  NOTIFICATION_TYPES.TIER_LEVEL_UP,
  NOTIFICATION_TYPES.MEDIA_APPROVED,
  NOTIFICATION_TYPES.MEDIA_REJECTED,
  NOTIFICATION_TYPES.RECEIPT_SUBMITTED,
  NOTIFICATION_TYPES.APPLICATION_APPROVED,
  NOTIFICATION_TYPES.APPLICATION_REJECTED,
]);

// Category groupings for the preferences UI (optional types only)
export const NOTIFICATION_CATEGORIES: Record<string, NotificationType[]> = {
  Messages: [NOTIFICATION_TYPES.NEW_MESSAGE],
  Games: [
    NOTIFICATION_TYPES.GAME_INVITE,
    NOTIFICATION_TYPES.GAME_ADVANCED,
    NOTIFICATION_TYPES.GAME_COMPLETE,
    NOTIFICATION_TYPES.GROUP_ROUND_ENDED,
    NOTIFICATION_TYPES.DATENIGHT_READY,
  ],
  Social: [NOTIFICATION_TYPES.FRIEND_REQUEST, NOTIFICATION_TYPES.FRIEND_ACCEPTED, NOTIFICATION_TYPES.FRIEND_INVITE, NOTIFICATION_TYPES.BUSINESS_SHARED],
  Discover: [NOTIFICATION_TYPES.NEW_EVENT],
};

// Human-readable labels for each type
export const NOTIFICATION_LABELS: Record<NotificationType, string> = {
  receipt_approved: "Receipt approved",
  receipt_rejected: "Receipt rejected",
  payout_processed: "Payout processed",
  tier_level_up: "Tier level up",
  new_message: "New message from staff",
  friend_request: "Friend request received",
  friend_accepted: "Friend request accepted",
  game_invite: "Game invitation",
  game_advanced: "Game round advanced",
  game_complete: "Game completed",
  group_round_ended: "Group voting round ended",
  datenight_ready: "Date night match ready",
  new_event: "New event from followed business",
  media_approved: "Your photo/video was approved",
  media_rejected: "Your photo/video was not approved",
  receipt_submitted: "New receipt submitted",
  friend_invite: "Friend invite sent",
  application_approved: "Application approved",
  application_rejected: "Application not approved",
  business_shared: "A friend shared a business with you",
};

// Deep-link routes for each notification type
export const NOTIFICATION_HREFS: Record<NotificationType, string> = {
  receipt_approved: "/profile",
  receipt_rejected: "/profile",
  payout_processed: "/profile",
  tier_level_up: "/profile",
  new_message: "/profile",
  friend_request: "/profile",
  friend_accepted: "/profile",
  game_invite: "/5v3v1",
  game_advanced: "/5v3v1",
  game_complete: "/5v3v1",
  group_round_ended: "/group",
  datenight_ready: "/datenight",
  new_event: "/events",
  media_approved: "/experiences",
  media_rejected: "/experiences",
  receipt_submitted: "/businessprofile-v2",
  friend_invite: "/welcome/find-friends",
  application_approved: "/profile",
  application_rejected: "/profile",
  // Default href; the share endpoint sets metadata.href = "/preview/{bizId}"
  // which the NotificationPanel honors over this fallback.
  business_shared: "/swipe",
};

// Client-side notification row type
export interface UserNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
  read: boolean;
  read_at: string | null;
  created_at: string;
}

// Preference row type
export interface UserNotificationPreference {
  notification_type: NotificationType;
  in_app: boolean;
  email: boolean;
  push: boolean;
}
