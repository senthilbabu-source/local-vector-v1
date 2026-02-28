// ---------------------------------------------------------------------------
// lib/data/weekly-digest.ts — Weekly Digest Data Fetcher (Sprint 78)
//
// Fetches all data needed for one org's weekly digest email. Uses
// createServiceRoleClient() context (no user session — runs in cron/Inngest).
//
// Pattern: same as lib/data/ai-health-score.ts (Sprint 72) — injected
// SupabaseClient, parallel queries, org-scoped (AI_RULES §18, §38.3).
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import * as Sentry from '@sentry/nextjs';
import { fetchHealthScore } from '@/lib/data/ai-health-score';
import {
  buildDigestPayload,
  type DigestDataInput,
  type DigestPayload,
} from '@/lib/services/weekly-digest.service';

/**
 * Fetches all data for one org's weekly digest and builds the payload.
 * Runs in Inngest/cron context — uses service-role client.
 *
 * Returns null when:
 * - org has notify_weekly_digest=false
 * - owner_user_id has no user record
 * - no primary location exists
 */
export async function fetchDigestForOrg(
  supabase: SupabaseClient<Database>,
  orgId: string,
): Promise<DigestPayload | null> {
  // ── 1. Org details + notify_weekly_digest check ──
  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, owner_user_id, notify_weekly_digest')
    .eq('id', orgId)
    .single();

  if (!org || org.notify_weekly_digest === false) return null;

  // ── 2. Owner email ──
  if (!org.owner_user_id) return null;

  const { data: owner } = await supabase
    .from('users')
    .select('email, full_name')
    .eq('id', org.owner_user_id)
    .single();

  if (!owner) return null;

  // ── 3. Primary location ──
  const { data: location } = await supabase
    .from('locations')
    .select('id, business_name, city, state')
    .eq('org_id', orgId)
    .eq('is_primary', true)
    .maybeSingle();

  if (!location) return null;

  // ── 4. Parallel queries for digest content ──
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const weekCutoff = oneWeekAgo.toISOString();

  const [
    currentSnapshot,
    previousSnapshot,
    newHallucinations,
    resolvedCount,
    newSovWins,
    botVisitCount,
    blindSpotData,
  ] = await Promise.all([
    // Current week's latest visibility snapshot
    supabase
      .from('visibility_analytics')
      .select('share_of_voice, snapshot_date')
      .eq('org_id', orgId)
      .eq('location_id', location.id)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Previous week's snapshot (2nd most recent)
    supabase
      .from('visibility_analytics')
      .select('share_of_voice, snapshot_date')
      .eq('org_id', orgId)
      .eq('location_id', location.id)
      .order('snapshot_date', { ascending: false })
      .range(1, 1)
      .maybeSingle(),

    // New hallucinations this week
    supabase
      .from('ai_hallucinations')
      .select('claim_text, severity, model_provider')
      .eq('org_id', orgId)
      .gte('detected_at', weekCutoff)
      .order('detected_at', { ascending: false })
      .limit(5),

    // Resolved hallucinations this week (count)
    supabase
      .from('ai_hallucinations')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('correction_status', 'fixed')
      .gte('resolved_at', weekCutoff),

    // New SOV wins — evaluations with rank_position <= 5 created this week
    supabase
      .from('sov_evaluations')
      .select('query_id, engine')
      .eq('org_id', orgId)
      .not('rank_position', 'is', null)
      .lte('rank_position', 5)
      .gte('created_at', weekCutoff)
      .limit(5),

    // Bot visits this week (count)
    supabase
      .from('crawler_hits')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .gte('crawled_at', weekCutoff),

    // All crawler_hits for blind spot computation
    supabase
      .from('crawler_hits')
      .select('bot_type')
      .eq('org_id', orgId),
  ]);

  // ── Resolve SOV wins with query text ──
  const sovWinQueryIds = (newSovWins.data ?? []).map((e) => e.query_id);
  let sovWins: DigestDataInput['sovWins'] = [];
  if (sovWinQueryIds.length > 0) {
    const { data: queries } = await supabase
      .from('target_queries')
      .select('id, query_text')
      .in('id', sovWinQueryIds);

    sovWins = (newSovWins.data ?? []).map((e) => {
      const q = (queries ?? []).find((qr) => qr.id === e.query_id);
      return {
        query_text: q?.query_text ?? 'Unknown query',
        engine: e.engine,
      };
    });
  }

  // ── SOV values ──
  const currentSov = currentSnapshot.data?.share_of_voice ?? null;
  const previousSov = previousSnapshot.data?.share_of_voice ?? null;

  // ── Blind spots: 10 tracked bots minus distinct bot_types seen ──
  const TOTAL_TRACKED_BOTS = 10;
  const seenBotTypes = new Set(
    (blindSpotData.data ?? []).map((h) => h.bot_type),
  );
  const newBlindSpots = TOTAL_TRACKED_BOTS - seenBotTypes.size;

  // ── Fetch Top Recommendation + Health Score from Sprint 72 ──
  let topRecommendation: DigestDataInput['topRecommendation'] = null;
  let currentHealthScore: number | null = null;
  try {
    const healthResult = await fetchHealthScore(supabase, orgId, location.id);
    currentHealthScore = healthResult.score;
    if (healthResult.topRecommendation) {
      topRecommendation = {
        title: healthResult.topRecommendation.title,
        description: healthResult.topRecommendation.description,
        href: healthResult.topRecommendation.actionHref ?? '/dashboard',
        estimatedImpact: healthResult.topRecommendation.estimatedImpact ?? 5,
      };
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { file: 'weekly-digest.ts', sprint: 'A' } });
    // Health score fetch is non-critical
  }

  const input: DigestDataInput = {
    org: { id: org.id, name: org.name },
    owner: { email: owner.email, full_name: owner.full_name },
    location: {
      business_name: location.business_name,
      city: location.city ?? '',
      state: location.state ?? '',
    },
    currentHealthScore,
    previousHealthScore: null, // No historical Health Score yet — future sprint
    currentSov,
    previousSov,
    newHallucinations: (newHallucinations.data ?? []).map((h) => ({
      claim_text: h.claim_text,
      severity: h.severity ?? 'high',
      model_provider: h.model_provider,
    })),
    resolvedHallucinations: resolvedCount.count ?? 0,
    sovWins,
    topRecommendation,
    botVisitsThisWeek: botVisitCount.count ?? 0,
    newBlindSpots: Math.max(0, newBlindSpots),
  };

  return buildDigestPayload(input);
}
