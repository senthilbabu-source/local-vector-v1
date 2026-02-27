// ---------------------------------------------------------------------------
// content-calendar.ts — Sprint 83: Content Calendar Data Layer
//
// Fetches all 5 signal sources in parallel, assembles CalendarInput,
// and delegates to the pure generateContentCalendar() service.
//
// Run: npx vitest run src/__tests__/unit/content-calendar-data.test.ts
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import {
  generateContentCalendar,
  type CalendarInput,
  type ContentCalendarResult,
} from '@/lib/services/content-calendar.service';

/**
 * Fetch all signal data and generate the content calendar.
 * Uses RLS-scoped client (§18).
 */
export async function fetchContentCalendar(
  supabase: SupabaseClient<Database>,
  orgId: string,
  locationId: string,
): Promise<ContentCalendarResult> {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    locationResult,
    occasionsResult,
    sovEvalsResult,
    targetQueriesResult,
    pageAuditsResult,
    menuResult,
    recentCrawlerResult,
    previousCrawlerResult,
    competitorGapsResult,
    hallucinationsResult,
    existingDraftsResult,
  ] = await Promise.all([
    // Location for business name
    supabase
      .from('locations')
      .select('business_name')
      .eq('id', locationId)
      .eq('org_id', orgId)
      .single(),

    // Signal 1: Upcoming occasions within trigger window
    supabase
      .from('local_occasions')
      .select(
        'id, name, occasion_type, annual_date, trigger_days_before, peak_query_patterns',
      )
      .eq('is_active', true),

    // Signal 2: SOV evaluations (recent) for gap detection
    supabase
      .from('sov_evaluations')
      .select('query_id, engine, rank_position')
      .eq('org_id', orgId)
      .eq('location_id', locationId)
      .gte('created_at', thirtyDaysAgo.toISOString()),

    // Signal 2b: Target queries for this org
    supabase
      .from('target_queries')
      .select('id, query_text, query_category')
      .eq('org_id', orgId)
      .eq('location_id', locationId),

    // Signal 3: Page audits (freshness)
    supabase
      .from('page_audits')
      .select('page_url, page_type, last_audited_at, overall_score')
      .eq('org_id', orgId),

    // Signal 3b: Latest menu
    supabase
      .from('magic_menus')
      .select('id, updated_at')
      .eq('org_id', orgId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Signal 3c: Recent bot visits (last 14 days)
    supabase
      .from('crawler_hits')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .gte(
        'crawled_at',
        new Date(today.getTime() - 14 * 86400000).toISOString(),
      ),

    // Signal 3d: Previous period bot visits (15-28 days ago)
    supabase
      .from('crawler_hits')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .gte(
        'crawled_at',
        new Date(today.getTime() - 28 * 86400000).toISOString(),
      )
      .lt(
        'crawled_at',
        new Date(today.getTime() - 14 * 86400000).toISOString(),
      ),

    // Signal 4: Competitor gaps (pending actions)
    supabase
      .from('competitor_intercepts')
      .select(
        'id, competitor_name, query_asked, winning_factor, suggested_action, gap_magnitude',
      )
      .eq('org_id', orgId)
      .eq('action_status', 'pending')
      .order('created_at', { ascending: false })
      .limit(10),

    // Signal 5: Open hallucinations
    supabase
      .from('ai_hallucinations')
      .select('id, claim_text, severity, model_provider')
      .eq('org_id', orgId)
      .eq('correction_status', 'open')
      .order('detected_at', { ascending: false })
      .limit(10),

    // Existing drafts (to avoid duplicate recommendations)
    supabase
      .from('content_drafts')
      .select('trigger_id')
      .eq('org_id', orgId)
      .not('trigger_id', 'is', null)
      .in('status', ['draft', 'approved']),
  ]);

  // ── Assemble occasions within trigger window ──
  const occasions = (occasionsResult.data ?? [])
    .filter((o) => {
      if (!o.annual_date) return false;
      const daysUntil = computeDaysUntilDate(o.annual_date, today);
      return daysUntil >= 0 && daysUntil <= o.trigger_days_before;
    })
    .map((o) => ({
      id: o.id,
      name: o.name,
      occasionType: o.occasion_type,
      annualDate: o.annual_date,
      triggerDaysBefore: o.trigger_days_before,
      peakQueryPatterns: (o.peak_query_patterns as string[]) ?? [],
    }));

  // ── Compute SOV gaps ──
  const targetQueries = targetQueriesResult.data ?? [];
  const sovEvals = sovEvalsResult.data ?? [];

  const evalsByQuery = new Map<string, (typeof sovEvals)[number][]>();
  for (const e of sovEvals) {
    const arr = evalsByQuery.get(e.query_id) ?? [];
    arr.push(e);
    evalsByQuery.set(e.query_id, arr);
  }

  const sovGaps = targetQueries
    .map((q) => {
      const evals = evalsByQuery.get(q.id) ?? [];
      const totalEngines = new Set(evals.map((e) => e.engine)).size;
      const missingEngines = evals.filter(
        (e) => e.rank_position === null,
      ).length;
      return {
        queryId: q.id,
        queryText: q.query_text,
        queryCategory: q.query_category,
        missingEngineCount: totalEngines > 0 ? missingEngines : 0,
        totalEngineCount: totalEngines,
      };
    })
    .filter((g) => g.missingEngineCount > 0);

  // ── Stale pages ──
  const stalePages = (pageAuditsResult.data ?? []).map((p) => ({
    pageUrl: p.page_url,
    pageType: p.page_type,
    lastAuditedAt: p.last_audited_at,
    overallScore: p.overall_score,
    daysSinceAudit: Math.floor(
      (today.getTime() - new Date(p.last_audited_at).getTime()) / 86400000,
    ),
  }));

  // ── Stale menu ──
  const menu = menuResult.data;
  const staleMenu = menu
    ? {
        menuId: menu.id,
        lastUpdatedAt: menu.updated_at!,
        daysSinceUpdate: Math.floor(
          (today.getTime() - new Date(menu.updated_at!).getTime()) / 86400000,
        ),
        recentBotVisitCount: recentCrawlerResult.count ?? 0,
        previousBotVisitCount: previousCrawlerResult.count ?? 0,
      }
    : null;

  // ── Existing draft trigger IDs ──
  const existingDraftTriggerIds = new Set(
    (existingDraftsResult.data ?? [])
      .map((d) => d.trigger_id)
      .filter((id): id is string => id !== null),
  );

  const input: CalendarInput = {
    businessName: locationResult.data?.business_name ?? 'Your Business',
    locationId,
    occasions,
    sovGaps,
    stalePages,
    staleMenu,
    competitorGaps: (competitorGapsResult.data ?? []).map((g) => ({
      id: g.id,
      competitorName: g.competitor_name,
      queryAsked: g.query_asked ?? '',
      winningFactor: g.winning_factor,
      suggestedAction: g.suggested_action,
      gapMagnitude: g.gap_magnitude,
    })),
    openHallucinations: (hallucinationsResult.data ?? []).map((h) => ({
      id: h.id,
      claimText: h.claim_text,
      severity: h.severity ?? 'high',
      modelProvider: h.model_provider,
    })),
    existingDraftTriggerIds,
  };

  return generateContentCalendar(input);
}

function computeDaysUntilDate(annualDate: string, today: Date): number {
  const [month, day] = annualDate.split('-').map(Number);
  const thisYear = today.getFullYear();
  let target = new Date(thisYear, month! - 1, day);
  if (target < today) target = new Date(thisYear + 1, month! - 1, day);
  return Math.ceil(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
}
