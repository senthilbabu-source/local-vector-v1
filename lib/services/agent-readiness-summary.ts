// ---------------------------------------------------------------------------
// lib/services/agent-readiness-summary.ts — S38: Agent Readiness Summary
//
// Derives 4 simple yes/no indicators from existing data.
// No new DB tables or API calls — pure derivation.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/nextjs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentReadinessSummary {
  canBook: boolean;
  canOrder: boolean;
  canFindHours: boolean;
  canSeeMenu: boolean;
}

export const EMPTY_SUMMARY: AgentReadinessSummary = {
  canBook: false,
  canOrder: false,
  canFindHours: false,
  canSeeMenu: false,
};

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

/**
 * Counts how many capabilities are true (0-4).
 */
export function countReadyCapabilities(summary: AgentReadinessSummary): number {
  return [summary.canBook, summary.canOrder, summary.canFindHours, summary.canSeeMenu]
    .filter(Boolean).length;
}

// ---------------------------------------------------------------------------
// I/O — Derives summary from existing DB data
// ---------------------------------------------------------------------------

/**
 * Returns agent readiness summary for a location.
 * Never throws — returns EMPTY_SUMMARY on error.
 *
 * - canBook: location has a booking_url
 * - canOrder: location has an ordering_url
 * - canFindHours: location has hours_data (not null)
 * - canSeeMenu: location has a published magic_menu
 */
export async function getAgentReadinessSummary(
  supabase: SupabaseClient,
  orgId: string,
  locationId: string,
): Promise<AgentReadinessSummary> {
  try {
    // Fetch location data
    const { data: location } = await supabase
      .from('locations')
      .select('booking_url, ordering_url, hours_data')
      .eq('id', locationId)
      .eq('org_id', orgId)
      .maybeSingle();

    if (!location) return EMPTY_SUMMARY;

    // Check for published menu
    const { data: menus } = await supabase
      .from('magic_menus')
      .select('id')
      .eq('location_id', locationId)
      .eq('is_published', true)
      .limit(1);

    const hasPublishedMenu = (menus ?? []).length > 0;

    return {
      canBook: !!location.booking_url,
      canOrder: !!location.ordering_url,
      canFindHours: location.hours_data !== null,
      canSeeMenu: hasPublishedMenu,
    };
  } catch (err) {
    Sentry.captureException(err, { tags: { service: 'agent-readiness-summary', sprint: 'S38' } });
    return EMPTY_SUMMARY;
  }
}
