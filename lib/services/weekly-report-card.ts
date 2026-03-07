// ---------------------------------------------------------------------------
// lib/services/weekly-report-card.ts — S41: Weekly AI Report Card
//
// Pure function that generates a structured weekly summary from existing data.
// No AI calls — pure aggregation.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/nextjs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WeeklyReportCard {
  score: number | null;
  scoreDelta: number | null;
  topWin: string | null;
  topIssue: string | null;
  competitorHighlight: string | null;
  nextAction: string | null;
  errorsFixed: number;
  newErrors: number;
  sovPercent: number | null;
}

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

/**
 * Returns the score badge color based on value.
 */
export function getScoreColor(score: number | null): 'green' | 'amber' | 'red' | 'gray' {
  if (score === null) return 'gray';
  if (score >= 70) return 'green';
  if (score >= 40) return 'amber';
  return 'red';
}

/**
 * Returns a delta arrow string: "+5" or "-3" or "0".
 */
export function formatScoreDelta(delta: number | null): string {
  if (delta === null) return 'N/A';
  if (delta > 0) return `+${delta}`;
  return `${delta}`;
}

/**
 * Builds a plain-text summary of the report card (max 10 lines).
 */
export function buildReportCardText(card: WeeklyReportCard, businessName: string): string {
  const lines: string[] = [];
  lines.push(`Weekly AI Report — ${businessName}`);
  lines.push('');
  lines.push(`AI Health Score: ${card.score ?? 'N/A'} (${formatScoreDelta(card.scoreDelta)})`);
  if (card.sovPercent !== null) lines.push(`AI Mentions: ${Math.round(card.sovPercent)}%`);
  if (card.errorsFixed > 0) lines.push(`Errors fixed this week: ${card.errorsFixed}`);
  if (card.newErrors > 0) lines.push(`New errors detected: ${card.newErrors}`);
  if (card.topWin) lines.push(`Top win: ${card.topWin}`);
  if (card.topIssue) lines.push(`Top issue: ${card.topIssue}`);
  if (card.competitorHighlight) lines.push(`Competitor: ${card.competitorHighlight}`);
  if (card.nextAction) lines.push(`Next action: ${card.nextAction}`);
  return lines.slice(0, 10).join('\n');
}

// ---------------------------------------------------------------------------
// I/O — Generates report card from DB data
// ---------------------------------------------------------------------------

const MODEL_DISPLAY: Record<string, string> = {
  'openai-gpt4o': 'ChatGPT',
  'perplexity-sonar': 'Perplexity',
  'google-gemini': 'Gemini',
  'anthropic-claude': 'Claude',
  'microsoft-copilot': 'Copilot',
};

/**
 * Generates a weekly report card for an org. Never throws — returns null on error.
 */
export async function generateWeeklyReportCard(
  supabase: SupabaseClient,
  orgId: string,
): Promise<WeeklyReportCard | null> {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    // Parallel data fetch
    const [scoresResult, fixedResult, newResult, winsResult, sovResult, competitorResult] = await Promise.all([
      // Latest 2 visibility scores for delta
      supabase
        .from('visibility_scores')
        .select('overall_score, snapshot_date')
        .eq('org_id', orgId)
        .order('snapshot_date', { ascending: false })
        .limit(2),

      // Errors fixed this week
      supabase
        .from('ai_hallucinations')
        .select('id, category, model_provider', { count: 'exact', head: false })
        .eq('org_id', orgId)
        .in('correction_status', ['fixed', 'corrected'])
        .gte('fixed_at' as 'first_detected_at', sevenDaysAgo)
        .limit(5),

      // New errors this week
      supabase
        .from('ai_hallucinations')
        .select('id, claim_text, severity, model_provider', { count: 'exact', head: false })
        .eq('org_id', orgId)
        .eq('correction_status', 'open')
        .gte('detected_at', sevenDaysAgo)
        .order('detected_at', { ascending: false })
        .limit(5),

      // Recent wins
      supabase
        .from('wins')
        .select('title')
        .eq('org_id', orgId)
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false })
        .limit(1),

      // Latest SOV
      supabase
        .from('sov_evaluations')
        .select('rank_position')
        .eq('org_id', orgId)
        .gte('created_at', sevenDaysAgo)
        .limit(50),

      // Competitors mentioned this week
      supabase
        .from('sov_evaluations')
        .select('mentioned_competitors')
        .eq('org_id', orgId)
        .gte('created_at', sevenDaysAgo)
        .limit(50),
    ]);

    // Score + delta
    const scores = scoresResult.data ?? [];
    const currentScore = scores.length > 0 ? (scores[0].overall_score as number | null) : null;
    const previousScore = scores.length > 1 ? (scores[1].overall_score as number | null) : null;
    const scoreDelta = currentScore !== null && previousScore !== null
      ? currentScore - previousScore
      : null;

    // Errors fixed
    const fixedCount = fixedResult.count ?? (fixedResult.data?.length ?? 0);
    const fixedData = fixedResult.data ?? [];
    const topFixedCategory = fixedData.length > 0 ? fixedData[0].category : null;
    const topFixedModel = fixedData.length > 0 ? fixedData[0].model_provider : null;

    // New errors
    const newCount = newResult.count ?? (newResult.data?.length ?? 0);
    const newData = newResult.data ?? [];

    // Top win
    const topWin = (winsResult.data ?? []).length > 0
      ? (winsResult.data![0].title as string)
      : fixedCount > 0
        ? `Fixed ${topFixedCategory ?? 'error'} on ${MODEL_DISPLAY[topFixedModel ?? ''] ?? topFixedModel ?? 'AI'}`
        : null;

    // Top issue
    const topIssue = newData.length > 0
      ? `${MODEL_DISPLAY[newData[0].model_provider] ?? newData[0].model_provider}: "${(newData[0].claim_text as string).slice(0, 60)}"`
      : null;

    // SOV %
    const sovData = sovResult.data ?? [];
    const mentioned = sovData.filter(r => r.rank_position !== null).length;
    const sovPercent = sovData.length > 0 ? Math.round((mentioned / sovData.length) * 100) : null;

    // Competitor highlight
    const competitorCounts = new Map<string, number>();
    for (const row of competitorResult.data ?? []) {
      const competitors = row.mentioned_competitors as string[] | null;
      if (!Array.isArray(competitors)) continue;
      for (const c of competitors) {
        competitorCounts.set(c, (competitorCounts.get(c) ?? 0) + 1);
      }
    }
    let competitorHighlight: string | null = null;
    if (competitorCounts.size > 0) {
      const [topCompetitor, count] = [...competitorCounts.entries()]
        .sort((a, b) => b[1] - a[1])[0];
      competitorHighlight = `${topCompetitor} mentioned ${count} times`;
    }

    // Next action
    let nextAction: string | null = null;
    if (newCount > 0) {
      nextAction = 'Fix open AI errors on the dashboard';
    } else if (sovPercent !== null && sovPercent < 20) {
      nextAction = 'Run an AI scan to improve visibility';
    } else if (fixedCount === 0 && newCount === 0) {
      nextAction = 'Check your AI mentions for new opportunities';
    }

    return {
      score: currentScore,
      scoreDelta,
      topWin,
      topIssue,
      competitorHighlight,
      nextAction,
      errorsFixed: fixedCount,
      newErrors: newCount,
      sovPercent,
    };
  } catch (err) {
    Sentry.captureException(err, { tags: { service: 'weekly-report-card', sprint: 'S41' } });
    return null;
  }
}
