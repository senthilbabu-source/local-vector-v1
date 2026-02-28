// ---------------------------------------------------------------------------
// lib/occasions/occasion-feed.ts — Occasion alert feed data layer
//
// Pure data layer for dashboard occasion alerts. No UI logic.
// Single source of truth for occasion alert queries (AI_RULES §54).
//
// Algorithm:
//   1. Load active local_occasions within 14-day lookahead
//   2. Filter out snoozed occasions (snoozed_until > now)
//   3. Filter out occasions with existing content_draft
//   4. Limit to 3, sort by urgency (fewest days first)
//
// Returns [] on any error — dashboard always loads.
//
// Sprint 101
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import * as Sentry from '@sentry/nextjs';
import { getDaysUntilPeak } from '@/lib/services/occasion-engine.service';
import type { LocalOccasionRow } from '@/lib/types/occasions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DashboardOccasionAlert {
  id: string;
  name: string;
  date: string; // ISO date of next occurrence
  daysUntil: number;
  category: string | null; // occasion_type
  description: string | null;
  isUrgent: boolean; // daysUntil <= 3
}

// ---------------------------------------------------------------------------
// getOccasionAlerts
// ---------------------------------------------------------------------------

/**
 * Returns up to 3 occasion alerts for the dashboard home.
 *
 * @param orgId      — from session
 * @param userId     — from session (for snooze lookup)
 * @param locationId — active location (unused for V1 — occasions are global)
 */
export async function getOccasionAlerts(
  supabase: SupabaseClient<Database>,
  orgId: string,
  userId: string,
  locationId: string | null,
): Promise<DashboardOccasionAlert[]> {
  try {
    const today = new Date();

    // 1. Fetch all active occasions
    const { data: occasions, error: occError } = await supabase
      .from('local_occasions')
      .select('*')
      .eq('is_active', true);

    if (occError || !occasions?.length) return [];

    // 2. Compute daysUntilPeak and filter to 14-day window
    const inWindow = (occasions as unknown as LocalOccasionRow[])
      .map((occ) => ({
        ...occ,
        daysUntilPeak: getDaysUntilPeak(occ, today),
      }))
      .filter((o) => o.daysUntilPeak >= 0 && o.daysUntilPeak <= 14);

    if (inWindow.length === 0) return [];

    // 3. Fetch snoozed occasion IDs for this user
    const { data: snoozes } = await supabase
      .from('occasion_snoozes')
      .select('occasion_id, snoozed_until')
      .eq('org_id', orgId)
      .eq('user_id', userId);

    const snoozedIds = new Set<string>();
    const now = new Date();
    for (const s of snoozes ?? []) {
      if (new Date(s.snoozed_until) > now) {
        snoozedIds.add(s.occasion_id);
      }
    }

    // 4. Fetch occasions that already have a content_draft
    const occasionIds = inWindow.map((o) => o.id);
    const { data: existingDrafts } = await supabase
      .from('content_drafts')
      .select('trigger_id')
      .eq('org_id', orgId)
      .eq('trigger_type', 'occasion')
      .in('status', ['draft', 'approved', 'published'])
      .in('trigger_id', occasionIds);

    const draftedIds = new Set<string>();
    for (const d of existingDrafts ?? []) {
      if (d.trigger_id) draftedIds.add(d.trigger_id);
    }

    // 5. Filter, sort, limit
    const alerts = inWindow
      .filter((o) => !snoozedIds.has(o.id) && !draftedIds.has(o.id))
      .sort((a, b) => a.daysUntilPeak - b.daysUntilPeak)
      .slice(0, 3)
      .map((o): DashboardOccasionAlert => {
        // Compute the actual next occurrence date for display
        const nextDate = computeNextOccurrenceDate(o, today);
        return {
          id: o.id,
          name: o.name,
          date: nextDate,
          daysUntil: o.daysUntilPeak,
          category: o.occasion_type,
          description: null,
          isUrgent: o.daysUntilPeak <= 3,
        };
      });

    return alerts;
  } catch (err) {
    console.error('[occasion-feed] getOccasionAlerts error:', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// getOccasionAlertCount
// ---------------------------------------------------------------------------

/**
 * Returns the count of active (non-snoozed, non-actioned) occasion alerts
 * in the next 14 days. Used for future sidebar badge.
 */
export async function getOccasionAlertCount(
  supabase: SupabaseClient<Database>,
  orgId: string,
  userId: string,
): Promise<number> {
  try {
    const alerts = await getOccasionAlerts(supabase, orgId, userId, null);
    return alerts.length;
  } catch (err) {
    Sentry.captureException(err, { tags: { file: 'occasion-feed.ts', sprint: 'A' } });
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Computes the next occurrence date as an ISO string.
 * Fixed dates (MM-DD): uses current or next year.
 * Evergreen (null annual_date): returns today + trigger_days_before.
 */
function computeNextOccurrenceDate(
  occasion: LocalOccasionRow,
  today: Date,
): string {
  if (!occasion.annual_date) {
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + occasion.trigger_days_before);
    return futureDate.toISOString().split('T')[0]!;
  }

  const [month, day] = occasion.annual_date.split('-').map(Number);
  const thisYear = new Date(today.getFullYear(), month! - 1, day);
  const nextYear = new Date(today.getFullYear() + 1, month! - 1, day);

  if (thisYear >= today) {
    return thisYear.toISOString().split('T')[0]!;
  }
  return nextYear.toISOString().split('T')[0]!;
}
