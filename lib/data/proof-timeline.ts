// ---------------------------------------------------------------------------
// lib/data/proof-timeline.ts — Proof Timeline data fetching layer
//
// Sprint 77: Fetches data for the Before/After Proof Timeline from 5 tables
// in parallel, assembles TimelineInput, delegates to buildProofTimeline().
//
// Same service-injection pattern as lib/data/dashboard.ts (Sprint 64).
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import {
  buildProofTimeline,
  type ProofTimeline,
  type TimelineInput,
} from '@/lib/services/proof-timeline.service';

/**
 * Fetches data for the proof timeline from 5 tables in parallel.
 * Scoped to org_id + location_id (AI_RULES §18).
 * Default window: last 90 days.
 */
export async function fetchProofTimeline(
  supabase: SupabaseClient<Database>,
  orgId: string,
  locationId: string,
  windowDays: number = 90,
): Promise<ProofTimeline> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - windowDays);
  const cutoffISO = cutoff.toISOString();
  const cutoffDate = cutoffISO.split('T')[0];

  const [snapshots, audits, publishedContent, crawlerHits, hallucinations] =
    await Promise.all([
      // 1. visibility_analytics — weekly snapshots
      supabase
        .from('visibility_analytics')
        .select('snapshot_date, share_of_voice')
        .eq('org_id', orgId)
        .eq('location_id', locationId)
        .gte('snapshot_date', cutoffDate!)
        .order('snapshot_date', { ascending: true }),

      // 2. page_audits — audit history
      supabase
        .from('page_audits')
        .select(
          'last_audited_at, overall_score, faq_schema_present, schema_completeness_score',
        )
        .eq('org_id', orgId)
        .gte('last_audited_at', cutoffISO)
        .order('last_audited_at', { ascending: true }),

      // 3. content_drafts — published only
      supabase
        .from('content_drafts')
        .select('id, published_at, draft_title, content_type, trigger_type')
        .eq('org_id', orgId)
        .eq('status', 'published')
        .not('published_at', 'is', null)
        .gte('published_at', cutoffISO)
        .order('published_at', { ascending: true }),

      // 4. crawler_hits — all hits in window (aggregate first visit per bot in TS)
      supabase
        .from('crawler_hits')
        .select('bot_type, crawled_at')
        .eq('org_id', orgId)
        .gte('crawled_at', cutoffISO)
        .order('crawled_at', { ascending: true }),

      // 5. ai_hallucinations — lifecycle events
      supabase
        .from('ai_hallucinations')
        .select(
          'id, claim_text, severity, detected_at, resolved_at, correction_status',
        )
        .eq('org_id', orgId)
        .or(`detected_at.gte.${cutoffISO},resolved_at.gte.${cutoffISO}`)
        .order('detected_at', { ascending: true }),
    ]);

  // Aggregate first bot visits: earliest crawled_at per bot_type
  const botFirstVisitMap = new Map<string, string>();
  for (const hit of crawlerHits.data ?? []) {
    if (hit.crawled_at && !botFirstVisitMap.has(hit.bot_type)) {
      botFirstVisitMap.set(hit.bot_type, hit.crawled_at);
    }
  }
  const firstBotVisitList = Array.from(botFirstVisitMap.entries()).map(
    ([bot_type, first_crawled_at]) => ({ bot_type, first_crawled_at }),
  );

  const input: TimelineInput = {
    snapshots: snapshots.data ?? [],
    audits: (audits.data ?? []).map((a) => ({
      last_audited_at: a.last_audited_at,
      overall_score: a.overall_score ?? null,
      faq_schema_present: a.faq_schema_present ?? null,
      schema_completeness_score: a.schema_completeness_score ?? null,
    })),
    publishedContent: (publishedContent.data ?? []).map((d) => ({
      id: d.id,
      published_at: d.published_at!,
      draft_title: d.draft_title,
      content_type: d.content_type,
      trigger_type: d.trigger_type,
    })),
    firstBotVisits: firstBotVisitList,
    hallucinations: (hallucinations.data ?? []).map((h) => ({
      id: h.id,
      claim_text: h.claim_text,
      severity: h.severity ?? 'high',
      detected_at: h.detected_at ?? null,
      resolved_at: h.resolved_at ?? null,
      correction_status: h.correction_status ?? 'open',
    })),
  };

  return buildProofTimeline(input);
}
