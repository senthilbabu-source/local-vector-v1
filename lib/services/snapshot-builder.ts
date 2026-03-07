// ---------------------------------------------------------------------------
// lib/services/snapshot-builder.ts — S44: Shareable AI Snapshot
//
// Pure functions that build a shareable summary of AI health metrics.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/nextjs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SnapshotData {
  businessName: string;
  score: number | null;
  sovPercent: number | null;
  errorsFixed: number;
  revenueRecovered: number;
  generatedAt: string; // ISO
}

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

/**
 * Builds a plain-text summary (max 10 lines) for clipboard copy.
 */
export function buildSnapshotText(data: SnapshotData): string {
  const lines: string[] = [];
  const date = new Date(data.generatedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  lines.push(`AI Health Snapshot — ${data.businessName}`);
  lines.push(`Generated: ${date}`);
  lines.push('');
  lines.push(`AI Health Score: ${data.score !== null ? data.score : 'N/A'}`);
  if (data.sovPercent !== null) {
    lines.push(`AI Mentions: ${Math.round(data.sovPercent)}%`);
  }
  if (data.errorsFixed > 0) {
    lines.push(`Errors Fixed: ${data.errorsFixed}`);
  }
  if (data.revenueRecovered > 0) {
    lines.push(`Revenue Recovered: $${Math.round(data.revenueRecovered).toLocaleString()}/mo`);
  }
  lines.push('');
  lines.push('Powered by LocalVector.ai');

  return lines.slice(0, 10).join('\n');
}

/**
 * Checks if snapshot has meaningful data to share.
 */
export function isSnapshotMeaningful(data: SnapshotData): boolean {
  return data.score !== null || data.errorsFixed > 0 || data.revenueRecovered > 0;
}

// ---------------------------------------------------------------------------
// I/O — Fetches snapshot data from DB
// ---------------------------------------------------------------------------

/**
 * Builds snapshot data for an org. Never throws — returns null on error.
 */
export async function buildSnapshotData(
  supabase: SupabaseClient,
  orgId: string,
): Promise<SnapshotData | null> {
  try {
    const [orgResult, scoreResult, fixedResult] = await Promise.all([
      supabase
        .from('locations')
        .select('business_name')
        .eq('org_id', orgId)
        .limit(1)
        .maybeSingle(),

      supabase
        .from('visibility_scores')
        .select('overall_score, share_of_voice')
        .eq('org_id', orgId)
        .order('snapshot_date', { ascending: false })
        .limit(1),

      supabase
        .from('ai_hallucinations')
        .select('id, revenue_recovered_monthly' as 'id', { count: 'exact', head: false })
        .eq('org_id', orgId)
        .in('correction_status', ['fixed', 'corrected']),
    ]);

    const businessName = orgResult.data?.business_name ?? 'My Business';
    const latestScore = (scoreResult.data ?? [])[0];
    const fixedData = fixedResult.data ?? [];
    const totalRevenue = fixedData.reduce(
      (sum, r) => sum + ((r as unknown as { revenue_recovered_monthly: number | null }).revenue_recovered_monthly ?? 0),
      0,
    );

    return {
      businessName,
      score: latestScore?.overall_score as number | null ?? null,
      sovPercent: latestScore?.share_of_voice as number | null ?? null,
      errorsFixed: fixedResult.count ?? fixedData.length,
      revenueRecovered: totalRevenue,
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    Sentry.captureException(err, { tags: { service: 'snapshot-builder', sprint: 'S44' } });
    return null;
  }
}
