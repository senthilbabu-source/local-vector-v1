// ---------------------------------------------------------------------------
// lib/data/scan-data-resolver.ts — P3-FIX-13: Unified data mode resolver
//
// Single entry point for determining whether to show sample or real data.
// Consolidates isSampleMode() + onboarding has_real_data checks.
//
// Used by dashboard page and sub-pages to decide rendering path.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { isSampleMode } from '@/lib/sample-data/use-sample-mode';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DataMode = 'sample' | 'real' | 'empty';

export interface DataResolverResult {
  /** Current data display mode */
  mode: DataMode;
  /** Organization ID */
  orgId: string;
  /** Whether the org has ever had a successful scan */
  hasRealData: boolean;
  /** Whether sample mode overlay is active (< 14 days, no real data) */
  isSampleOverlay: boolean;
  /** When the first SOV scan completed for this org (null if never) */
  firstScanCompletedAt: string | null;
  /** When the most recent SOV scan completed (null if never) */
  lastScanCompletedAt: string | null;
  /** Next scheduled scan date (next Sunday midnight UTC) */
  nextScheduledScanAt: string;
  /** Whether the first scan just completed (within last 24 hours) */
  isFirstScanRecent: boolean;
  /** Org creation date */
  orgCreatedAt: string | null;
}

// ---------------------------------------------------------------------------
// Next Sunday calculator
// ---------------------------------------------------------------------------

export function getNextSundayUTC(from: Date = new Date()): Date {
  const d = new Date(from);
  const dayOfWeek = d.getUTCDay(); // 0 = Sunday
  const daysUntilSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;
  d.setUTCDate(d.getUTCDate() + daysUntilSunday);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

/**
 * Resolves the data mode for an org. Queries the DB to determine whether
 * the org has real scan data, and returns metadata for banner rendering.
 *
 * Three modes:
 *   - 'sample': no real data + org < 14 days old → show sample overlays
 *   - 'empty':  no real data + org > 14 days old → show empty state
 *   - 'real':   real scan data exists → show real dashboard
 */
export async function resolveDataMode(params: {
  supabase: SupabaseClient<Database>;
  orgId: string;
}): Promise<DataResolverResult> {
  const { supabase, orgId } = params;

  // Parallel: fetch org info + first/last SOV evaluations
  const [orgResult, firstEvalResult, lastEvalResult] = await Promise.all([
    supabase
      .from('organizations')
      .select('created_at')
      .eq('id', orgId)
      .single(),
    supabase
      .from('sov_evaluations')
      .select('created_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('sov_evaluations')
      .select('created_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const orgCreatedAt = orgResult.data?.created_at ?? null;
  const firstScanCompletedAt = firstEvalResult.data?.created_at ?? null;
  const lastScanCompletedAt = lastEvalResult.data?.created_at ?? null;
  const hasRealData = firstScanCompletedAt !== null;

  // Determine if sample overlay is active (uses existing isSampleMode logic)
  // realityScore being null is approximated by !hasRealData (no visibility_analytics row)
  const sampleOverlay = isSampleMode(
    hasRealData ? 1 : null, // non-null score when real data exists
    orgCreatedAt,
  );

  // Determine mode
  let mode: DataMode;
  if (hasRealData) {
    mode = 'real';
  } else if (sampleOverlay) {
    mode = 'sample';
  } else {
    mode = 'empty'; // past 14 days, no data
  }

  // Check if first scan completed within last 24 hours
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  const isFirstScanRecent =
    hasRealData &&
    lastScanCompletedAt !== null &&
    firstScanCompletedAt === lastScanCompletedAt && // only one scan has run
    Date.now() - new Date(firstScanCompletedAt).getTime() < TWENTY_FOUR_HOURS_MS;

  return {
    mode,
    orgId,
    hasRealData,
    isSampleOverlay: sampleOverlay,
    firstScanCompletedAt,
    lastScanCompletedAt,
    nextScheduledScanAt: getNextSundayUTC().toISOString(),
    isFirstScanRecent,
    orgCreatedAt,
  };
}
