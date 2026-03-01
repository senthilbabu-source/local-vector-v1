// ---------------------------------------------------------------------------
// lib/authority/citation-velocity-monitor.ts — Citation Velocity Monitor
//
// Sprint 108: Stores monthly authority snapshots and computes velocity
// (growing/decaying) per source tier; alerts on severe decay.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { EntityAuthorityProfile, AuthoritySnapshot } from './types';

// ── Snapshot Persistence ─────────────────────────────────────────────────────

/**
 * Stores a monthly authority snapshot for a location.
 * Uses UPSERT on (location_id, snapshot_month) unique constraint.
 */
export async function saveAuthoritySnapshot(
  supabase: SupabaseClient<Database>,
  locationId: string,
  orgId: string,
  profile: EntityAuthorityProfile,
): Promise<void> {
  const now = new Date();
  const snapshotMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const totalCitations =
    profile.tier_breakdown.tier1 +
    profile.tier_breakdown.tier2 +
    profile.tier_breakdown.tier3 +
    profile.tier_breakdown.unknown;

  const { error } = await supabase
    .from('entity_authority_snapshots')
    .upsert(
      {
        location_id: locationId,
        org_id: orgId,
        entity_authority_score: profile.entity_authority_score,
        tier1_count: profile.tier_breakdown.tier1,
        tier2_count: profile.tier_breakdown.tier2,
        tier3_count: profile.tier_breakdown.tier3,
        total_citations: totalCitations,
        sameas_count: profile.dimensions.sameas_score,
        snapshot_month: snapshotMonth,
      },
      { onConflict: 'location_id,snapshot_month' },
    );

  if (error) {
    Sentry.captureException(error, {
      tags: { file: 'citation-velocity-monitor.ts', sprint: '108' },
      extra: { locationId, snapshotMonth },
    });
  }
}

// ── Velocity Computation ─────────────────────────────────────────────────────

/**
 * Computes velocity: the % change in total citations vs. the previous month.
 * formula: (current_total - previous_total) / previous_total × 100
 *
 * Returns null if no previous snapshot exists (first run).
 */
export async function computeCitationVelocity(
  supabase: SupabaseClient<Database>,
  locationId: string,
  currentTierBreakdown: { tier1: number; tier2: number; tier3: number },
): Promise<number | null> {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Fetch the most recent snapshot BEFORE the current month
  const { data: previousSnapshot, error } = await supabase
    .from('entity_authority_snapshots')
    .select('total_citations, snapshot_month')
    .eq('location_id', locationId)
    .lt('snapshot_month', currentMonth)
    .order('snapshot_month', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !previousSnapshot) return null;

  const previousTotal = previousSnapshot.total_citations;
  if (previousTotal === 0) return null;

  const currentTotal = currentTierBreakdown.tier1 + currentTierBreakdown.tier2 + currentTierBreakdown.tier3;
  const velocity = ((currentTotal - previousTotal) / previousTotal) * 100;

  return Math.round(velocity * 100) / 100;
}

/**
 * Checks if this location should trigger a "Citation Decay Alert".
 * Condition: velocity < -20% (severe month-over-month decline)
 */
export function shouldAlertDecay(velocity: number | null): boolean {
  if (velocity === null) return false;
  return velocity < -20;
}

// ── History Retrieval ────────────────────────────────────────────────────────

/**
 * Returns the last N months of authority snapshots for a location.
 * Used to render the velocity trend chart in the dashboard.
 */
export async function getAuthorityHistory(
  supabase: SupabaseClient<Database>,
  locationId: string,
  months: number = 6,
): Promise<AuthoritySnapshot[]> {
  const { data, error } = await supabase
    .from('entity_authority_snapshots')
    .select('*')
    .eq('location_id', locationId)
    .order('snapshot_month', { ascending: true })
    .limit(months);

  if (error || !data) return [];

  return data.map(row => ({
    id: row.id,
    location_id: row.location_id,
    org_id: row.org_id,
    entity_authority_score: row.entity_authority_score,
    tier_breakdown: {
      tier1: row.tier1_count,
      tier2: row.tier2_count,
      tier3: row.tier3_count,
    },
    total_citations: row.total_citations,
    sameas_count: row.sameas_count,
    snapshot_month: row.snapshot_month,
    created_at: row.created_at,
  }));
}
