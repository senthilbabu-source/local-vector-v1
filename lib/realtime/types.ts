import type { MemberRole } from '@/lib/membership/types';

/**
 * A user currently present in the org's Realtime channel.
 * Tracked via Supabase Presence.
 */
export interface PresenceUser {
  user_id: string;
  email: string;
  full_name: string | null;
  role: MemberRole;
  /** Page the user is currently viewing (optional — for future routing awareness) */
  current_page: string;
  /** ISO timestamp of when they joined the channel */
  online_at: string;
}

/**
 * A soft draft lock entry.
 * Written to draft_locks table on draft open, removed on close.
 */
export interface DraftLock {
  id: string;
  draft_id: string;
  org_id: string;
  user_id: string;
  user_email: string;
  user_name: string | null;
  locked_at: string;
  expires_at: string;
}

/**
 * A realtime notification broadcast to all org members.
 */
export type NotificationEventType =
  | 'cron_sov_complete'
  | 'cron_audit_complete'
  | 'cron_content_audit_complete'
  | 'member_joined'
  | 'member_removed'
  | 'draft_published'
  | 'hallucination_detected';

export interface NotificationPayload {
  event: NotificationEventType;
  message: string;
  refresh_keys?: string[];
  action_url?: string;
  action_label?: string;
  sent_at: string;
}

export interface RealtimeNotification extends NotificationPayload {
  id: string;
  received_at: string;
}

/**
 * Channel names follow a consistent pattern.
 * All org-scoped channels: 'org:{org_id}'
 */
export function buildOrgChannelName(orgId: string): string {
  return `org:${orgId}`;
}

export const DRAFT_LOCK_TTL_SECONDS = 90;
export const DRAFT_LOCK_HEARTBEAT_INTERVAL_MS = 30_000;
export const PRESENCE_CLEANUP_DELAY_MS = 5_000;
export const MAX_VISIBLE_PRESENCE_AVATARS = 5;
export const MAX_NOTIFICATIONS_QUEUE = 10;
