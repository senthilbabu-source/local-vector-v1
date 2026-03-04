// ---------------------------------------------------------------------------
// lib/services/reality-score.service.ts — Reality Score v2 (P8-FIX-33)
//
// Pure scoring formula + persistence layer for weekly reality score snapshots.
//
// deriveRealityScore() — pure function, no I/O. Computes composite score from
//   visibility, accuracy (alert-based), and data health components.
//
// writeRealityScoreSnapshot() — persists the computed score to visibility_scores
//   table after each SOV scan. Called from processOrgSOV() in the SOV cron.
//
// Formula (Doc 03 §9):
//   reality_score = (Visibility × 0.4) + (Accuracy × 0.4) + (DataHealth × 0.2)
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RealityScoreResult {
  visibility: number | null;
  accuracy: number;
  dataHealth: number;
  realityScore: number | null;
}

// ---------------------------------------------------------------------------
// deriveRealityScore — pure function (no I/O)
// ---------------------------------------------------------------------------

/**
 * Compute the Reality Score from its 3 components.
 *
 * @param openAlertCount  Number of open hallucination alerts
 * @param visibilityScore 0–100 integer from visibility_analytics, or null
 * @param dataHealthScore Cached 0–100 from locations.data_health_score (Sprint 124)
 * @param simulationScore Cached simulation score from locations.last_simulation_score
 */
export function deriveRealityScore(
  openAlertCount: number,
  visibilityScore: number | null,
  dataHealthScore?: number | null,
  simulationScore?: number | null,
): RealityScoreResult {
  const accuracy = openAlertCount === 0 ? 100 : Math.max(40, 100 - openAlertCount * 15);
  // Sprint 124: prefer real DataHealth score, fallback to simulation blend, fallback to 100
  const dataHealth = dataHealthScore != null
    ? dataHealthScore
    : simulationScore != null
      ? Math.round(100 * 0.5 + simulationScore * 0.5)
      : 100;
  if (visibilityScore === null) {
    return { visibility: null, accuracy, dataHealth, realityScore: null };
  }
  const realityScore = Math.round(
    visibilityScore * 0.4 + accuracy * 0.4 + dataHealth * 0.2
  );
  return { visibility: visibilityScore, accuracy, dataHealth, realityScore };
}

// ---------------------------------------------------------------------------
// writeRealityScoreSnapshot — persist to visibility_scores (P8-FIX-33)
// ---------------------------------------------------------------------------

/**
 * Compute and persist a reality score snapshot after an SOV scan.
 * Non-critical — errors are captured via Sentry but never thrown.
 *
 * @param supabase      Service-role client (cron context)
 * @param orgId         Organization ID
 * @param locationId    Location ID (from SOV batch)
 * @param shareOfVoice  0–1 float from writeSOVResults
 * @param openAlertCount Number of open hallucination alerts for this org
 * @param dataHealthScore Cached data health score from locations table (nullable)
 * @param simulationScore Cached simulation score from locations table (nullable)
 */
export async function writeRealityScoreSnapshot(
  supabase: SupabaseClient<Database>,
  orgId: string,
  locationId: string,
  shareOfVoice: number,
  openAlertCount: number,
  dataHealthScore: number | null,
  simulationScore: number | null,
): Promise<void> {
  try {
    const visibilityScore = Math.round(shareOfVoice * 100);
    const scores = deriveRealityScore(openAlertCount, visibilityScore, dataHealthScore, simulationScore);

    // Skip persisting if we can't compute a score (visibility is null → no SOV data)
    if (scores.realityScore === null) return;

    const today = new Date().toISOString().split('T')[0];

    // Fetch previous snapshot for delta calculation
    const { data: prevRow } = await supabase
      .from('visibility_scores')
      .select('reality_score')
      .eq('org_id', orgId)
      .eq('location_id', locationId)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    const previousScore = prevRow?.reality_score ?? null;
    const scoreDelta = previousScore !== null
      ? scores.realityScore - previousScore
      : null;

    await supabase.from('visibility_scores').upsert(
      {
        org_id: orgId,
        location_id: locationId,
        visibility_score: scores.visibility,
        accuracy_score: scores.accuracy,
        data_health_score: scores.dataHealth,
        reality_score: scores.realityScore,
        score_delta: scoreDelta,
        snapshot_date: today,
      },
      { onConflict: 'org_id,location_id,snapshot_date' },
    );
  } catch (err) {
    Sentry.captureException(err, {
      tags: { sprint: 'P8-FIX-33', component: 'reality-score-snapshot' },
      extra: { orgId, locationId },
    });
    // Non-critical — dashboard still computes score on-the-fly
  }
}
