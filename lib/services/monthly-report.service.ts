import type { SupabaseClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/nextjs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MonthlyReport {
  orgId: string;
  month: string; // YYYY-MM
  // Wins
  winsCount: number;
  fixedHallucinationsCount: number;
  revenueRecoveredMonthly: number;
  // Score deltas
  realityScoreStart: number | null;
  realityScoreEnd: number | null;
  realityScoreDelta: number | null;
  sovStart: number | null;
  sovEnd: number | null;
  sovDelta: number | null;
  // Outstanding
  openAlertCount: number;
  openAlertDollarImpact: number;
  // Year-to-date
  ytdRecoveryTotal: number;
  ytdErrorsCaught: number;
  ytdAvgDetectionDays: number | null;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Generates a monthly report by querying wins, hallucinations, and visibility scores.
 * Pure aggregation — no AI calls. Never throws.
 */
export async function generateMonthlyReport(
  supabase: SupabaseClient,
  orgId: string,
  locationId: string,
  month: Date,
): Promise<MonthlyReport> {
  const year = month.getFullYear();
  const monthNum = month.getMonth(); // 0-indexed
  const monthStart = new Date(year, monthNum, 1).toISOString();
  const monthEnd = new Date(year, monthNum + 1, 0, 23, 59, 59).toISOString();
  const yearStart = new Date(year, 0, 1).toISOString();
  const monthLabel = `${year}-${String(monthNum + 1).padStart(2, '0')}`;

  try {
    // Parallel queries
    const [winsResult, fixedResult, openResult, scoresResult, ytdFixedResult] = await Promise.all([
      // Wins this month
      supabase
        .from('wins' as 'cron_run_log')
        .select('id' as 'id')
        .eq('org_id', orgId)
        .gte('created_at', monthStart)
        .lte('created_at', monthEnd),

      // Fixed hallucinations this month
      supabase
        .from('ai_hallucinations')
        .select('id, revenue_recovered_monthly' as 'id')
        .eq('org_id', orgId)
        .not('fixed_at' as 'id', 'is', null)
        .gte('fixed_at' as 'created_at', monthStart)
        .lte('fixed_at' as 'created_at', monthEnd),

      // Open (unfixed) hallucinations
      supabase
        .from('ai_hallucinations')
        .select('id, revenue_recovered_monthly' as 'id')
        .eq('org_id', orgId)
        .is('fixed_at' as 'id', null),

      // Visibility scores for the month
      supabase
        .from('visibility_scores')
        .select('score, share_of_voice, snapshot_date' as 'score, share_of_voice, snapshot_date')
        .eq('location_id', locationId)
        .gte('snapshot_date', monthStart.split('T')[0])
        .lte('snapshot_date', monthEnd.split('T')[0])
        .order('snapshot_date', { ascending: true }),

      // YTD fixed hallucinations
      supabase
        .from('ai_hallucinations')
        .select('id, revenue_recovered_monthly, created_at, fixed_at' as 'id')
        .eq('org_id', orgId)
        .not('fixed_at' as 'id', 'is', null)
        .gte('fixed_at' as 'created_at', yearStart),
    ]);

    const wins = winsResult.data ?? [];
    const fixed = fixedResult.data ?? [];
    const open = openResult.data ?? [];
    const scores = scoresResult.data ?? [];
    const ytdFixed = ytdFixedResult.data ?? [];

    // Revenue recovered this month
    const revenueRecoveredMonthly = (fixed as unknown as { revenue_recovered_monthly: number | null }[])
      .reduce((sum, h) => sum + (h.revenue_recovered_monthly ?? 0), 0);

    // Score deltas
    const firstScore = scores[0] as unknown as { score: number; share_of_voice: number } | undefined;
    const lastScore = scores[scores.length - 1] as unknown as { score: number; share_of_voice: number } | undefined;

    const realityScoreStart = firstScore?.score ?? null;
    const realityScoreEnd = lastScore?.score ?? null;
    const realityScoreDelta = realityScoreStart !== null && realityScoreEnd !== null
      ? realityScoreEnd - realityScoreStart
      : null;

    const sovStart = firstScore?.share_of_voice ?? null;
    const sovEnd = lastScore?.share_of_voice ?? null;
    const sovDelta = sovStart !== null && sovEnd !== null
      ? sovEnd - sovStart
      : null;

    // Open alerts dollar impact
    const openAlertDollarImpact = (open as unknown as { revenue_recovered_monthly: number | null }[])
      .reduce((sum, h) => sum + (h.revenue_recovered_monthly ?? 0), 0);

    // YTD calculations
    const ytdRecoveryTotal = (ytdFixed as unknown as { revenue_recovered_monthly: number | null }[])
      .reduce((sum, h) => sum + (h.revenue_recovered_monthly ?? 0), 0);

    // Avg detection days (created_at → fixed_at)
    const detectionDays: number[] = [];
    for (const h of ytdFixed as unknown as { created_at: string; fixed_at: string }[]) {
      if (h.created_at && h.fixed_at) {
        const days = (new Date(h.fixed_at).getTime() - new Date(h.created_at).getTime()) / (1000 * 60 * 60 * 24);
        if (days >= 0) detectionDays.push(days);
      }
    }
    const ytdAvgDetectionDays = detectionDays.length > 0
      ? Math.round(detectionDays.reduce((a, b) => a + b, 0) / detectionDays.length)
      : null;

    return {
      orgId,
      month: monthLabel,
      winsCount: wins.length,
      fixedHallucinationsCount: fixed.length,
      revenueRecoveredMonthly,
      realityScoreStart,
      realityScoreEnd,
      realityScoreDelta,
      sovStart,
      sovEnd,
      sovDelta,
      openAlertCount: open.length,
      openAlertDollarImpact,
      ytdRecoveryTotal,
      ytdErrorsCaught: ytdFixed.length,
      ytdAvgDetectionDays,
    };
  } catch (err) {
    Sentry.captureException(err);
    return {
      orgId,
      month: monthLabel,
      winsCount: 0,
      fixedHallucinationsCount: 0,
      revenueRecoveredMonthly: 0,
      realityScoreStart: null,
      realityScoreEnd: null,
      realityScoreDelta: null,
      sovStart: null,
      sovEnd: null,
      sovDelta: null,
      openAlertCount: 0,
      openAlertDollarImpact: 0,
      ytdRecoveryTotal: 0,
      ytdErrorsCaught: 0,
      ytdAvgDetectionDays: null,
    };
  }
}
