/**
 * Billing Types — Sprint 113
 *
 * Types for seat-based billing and the membership audit log.
 */

import type { MemberRole } from '@/lib/membership/types';

// ---------------------------------------------------------------------------
// Activity event types
// ---------------------------------------------------------------------------

export type ActivityEventType =
  | 'member_invited'
  | 'member_joined'
  | 'member_removed'
  | 'invitation_revoked'
  | 'role_changed'
  | 'seat_sync'
  | 'member_left';

// ---------------------------------------------------------------------------
// Activity log entry
// ---------------------------------------------------------------------------

export interface ActivityLogEntry {
  id: string;
  org_id: string;
  event_type: ActivityEventType;
  actor_user_id: string | null;
  actor_email: string | null;
  target_user_id: string | null;
  target_email: string;
  target_role: MemberRole | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Seat state
// ---------------------------------------------------------------------------

export interface SeatState {
  org_id: string;
  plan_tier: string;
  current_seat_count: number;
  max_seats: number | null;
  usage_percent: number;
  stripe_subscription_id: string | null;
  stripe_quantity: number | null;
  in_sync: boolean;
  monthly_seat_cost_cents: number;
  per_seat_price_cents: number;
}

// ---------------------------------------------------------------------------
// Seat pricing
// ---------------------------------------------------------------------------

export const SEAT_PRICE_CENTS: Record<string, number> = {
  trial: 0,
  starter: 0,
  growth: 0,
  agency: 1500,
};

// ---------------------------------------------------------------------------
// Activity log pagination
// ---------------------------------------------------------------------------

export interface ActivityLogParams {
  page: number;
  per_page: number;
}

export interface ActivityLogPage {
  entries: ActivityLogEntry[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}
