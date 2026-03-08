// ---------------------------------------------------------------------------
// lib/services/perplexity-pages-detector.service.ts — Perplexity Pages Detector (Sprint 6)
//
// Post-processing pass on sov_evaluations.cited_sources.
// Finds perplexity.ai/page/ URLs and records them in perplexity_pages_detections.
// Called from the community-monitor cron (not the SOV cron — no hot path).
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

const PERPLEXITY_PAGE_PATTERN = /^https?:\/\/(www\.)?perplexity\.ai\/page\//i;

/**
 * Checks if a URL is a Perplexity Pages URL (perplexity.ai/page/...).
 */
export function isPerplexityPage(url: string): boolean {
  return PERPLEXITY_PAGE_PATTERN.test(url);
}

interface CitedSource {
  url: string;
  title?: string;
}

/**
 * Scan recent sov_evaluations for cited_sources containing perplexity.ai/page/ URLs.
 * Upserts detections into perplexity_pages_detections.
 * Looks back 30 days. Non-throwing.
 */
export async function detectPerplexityPages(
  supabase: SupabaseClient<Database>,
  orgId: string,
  locationId: string,
): Promise<{ new_detections: number; errors: string[] }> {
  const result = { new_detections: 0, errors: [] as string[] };

  try {
    // 1. Fetch recent sov_evaluations (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: evaluations, error: evalErr } = await supabase
      .from('sov_evaluations')
      .select('id, engine, query_id, cited_sources, source_mentions')
      .eq('org_id', orgId)
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false })
      .limit(100);

    if (evalErr) {
      result.errors.push(`Fetch evaluations failed: ${evalErr.message}`);
      return result;
    }

    if (!evaluations || evaluations.length === 0) return result;

    // 2. Batch fetch query texts for all unique query_ids
    const queryIds = [...new Set(evaluations.map((e) => e.query_id))];
    const queryTextMap = new Map<string, string>();

    if (queryIds.length > 0) {
      const { data: queries } = await supabase
        .from('target_queries')
        .select('id, query_text')
        .in('id', queryIds);

      for (const q of queries ?? []) {
        queryTextMap.set(q.id, q.query_text);
      }
    }

    // 3. Scan cited_sources for perplexity.ai/page/ URLs
    for (const evaluation of evaluations) {
      const citedSources = evaluation.cited_sources as CitedSource[] | null;
      if (!citedSources || !Array.isArray(citedSources)) continue;

      for (const source of citedSources) {
        if (!source?.url || !isPerplexityPage(source.url)) continue;

        try {
          const queryText = queryTextMap.get(evaluation.query_id) ?? null;

          const { error: upsertErr } = await (supabase.from as unknown as (table: string) => {
            upsert: (row: Record<string, unknown>, opts: { onConflict: string }) => Promise<{ error: { message: string } | null }>;
          })('perplexity_pages_detections').upsert(
            {
              org_id: orgId,
              location_id: locationId,
              evaluation_id: evaluation.id,
              page_url: source.url,
              page_title: source.title ?? null,
              engine: evaluation.engine,
              query_text: queryText,
              last_seen_at: new Date().toISOString(),
            },
            { onConflict: 'org_id,page_url' },
          );

          if (upsertErr) {
            result.errors.push(`Upsert failed for ${source.url}: ${upsertErr.message}`);
          } else {
            result.new_detections++;
          }
        } catch (sourceErr) {
          const msg = sourceErr instanceof Error ? sourceErr.message : String(sourceErr);
          result.errors.push(`Failed to process ${source.url}: ${msg}`);
        }
      }
    }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'perplexity-pages-detector', sprint: '6' },
    });
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
  }

  return result;
}
