// ---------------------------------------------------------------------------
// lib/badges/badge-counts.ts — Sidebar badge count queries
//
// Single source of truth for all sidebar badge counts. Designed to be called
// once per page load from dashboard layout.tsx (Server Component).
//
// Performance contract:
//   - Returns 0 on any DB error (never throws, never crashes sidebar)
//   - Counts capped at 99 for display (shows "99+" if > 99)
//
// Sprint 101 — AI_RULES §54
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SidebarBadgeCounts {
  contentDrafts: number;
  visibility: number;
}

export type BadgeSection = 'content_drafts' | 'visibility';

// ---------------------------------------------------------------------------
// getSidebarBadgeCounts
// ---------------------------------------------------------------------------

/**
 * Fetches all badge counts for the current user + org.
 *
 * Content Drafts badge: pending drafts (status = 'draft') created after last_seen_at.
 * Visibility badge: SOV evaluations created after last_seen_at.
 *
 * Returns { 0, 0 } on any error — sidebar always renders.
 */
export async function getSidebarBadgeCounts(
  supabase: SupabaseClient<Database>,
  orgId: string,
  userId: string,
  locationId: string | null,
): Promise<SidebarBadgeCounts> {
  try {
    // Fetch both last_seen timestamps in one query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not yet in generated types
    const { data: badgeStates } = await (supabase as any)
      .from('sidebar_badge_state')
      .select('section, last_seen_at')
      .eq('org_id', orgId)
      .eq('user_id', userId);

    const lastSeenMap: Record<string, string> = {};
    for (const row of badgeStates ?? []) {
      lastSeenMap[row.section] = row.last_seen_at;
    }

    const contentDraftsLastSeen = lastSeenMap['content_drafts'] ?? '1970-01-01T00:00:00Z';
    const visibilityLastSeen = lastSeenMap['visibility'] ?? '1970-01-01T00:00:00Z';

    // Content Drafts badge: pending drafts created after last seen
    let draftQuery = supabase
      .from('content_drafts')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('status', 'draft')
      .gt('created_at', contentDraftsLastSeen);

    if (locationId) {
      draftQuery = draftQuery.eq('location_id', locationId);
    }

    const { count: draftCount } = await draftQuery;

    // Visibility badge: SOV evaluations created after last seen
    let sovQuery = supabase
      .from('sov_evaluations')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .gt('created_at', visibilityLastSeen);

    if (locationId) {
      sovQuery = sovQuery.eq('location_id', locationId);
    }

    const { count: sovCount } = await sovQuery;

    return {
      contentDrafts: draftCount ?? 0,
      visibility: sovCount ?? 0,
    };
  } catch (err) {
    console.error('[badge-counts] getSidebarBadgeCounts error:', err);
    return { contentDrafts: 0, visibility: 0 };
  }
}

// ---------------------------------------------------------------------------
// markSectionSeen
// ---------------------------------------------------------------------------

/**
 * Marks a sidebar section as "seen" — resets the badge count to 0.
 * Called at the top of each badged section's Server Component page.
 * Upserts sidebar_badge_state.last_seen_at = now().
 *
 * Fire-and-forget safe — does not throw on DB error.
 */
export async function markSectionSeen(
  supabase: SupabaseClient<Database>,
  orgId: string,
  userId: string,
  section: BadgeSection,
): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not yet in generated types
    await (supabase as any)
      .from('sidebar_badge_state')
      .upsert(
        {
          org_id: orgId,
          user_id: userId,
          section,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'org_id,user_id,section' },
      );
  } catch (err) {
    console.error('[badge-counts] markSectionSeen error:', err);
  }
}

// ---------------------------------------------------------------------------
// formatBadgeCount
// ---------------------------------------------------------------------------

/**
 * Returns the display string for a badge count.
 *   0       → null (no badge shown)
 *   1–99    → "7"
 *   100+    → "99+"
 *   negative → null (defensive)
 */
export function formatBadgeCount(count: number): string | null {
  if (count <= 0) return null;
  if (count > 99) return '99+';
  return String(count);
}
