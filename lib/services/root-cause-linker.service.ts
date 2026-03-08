// lib/services/root-cause-linker.service.ts — Hallucination Root-Cause Linker (Sprint 5)
//
// Identifies which cited sources are likely responsible for a given hallucination.
// PURE analysis — reads ai_hallucinations + sov_evaluations, writes back to
// ai_hallucinations.root_cause_sources.
//
// Logic: match hallucination category → known authoritative sources for that
// category → find those sources in the evaluation's cited_sources / source_mentions.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { extractDomainName } from '@/lib/services/source-intelligence.service';
import * as Sentry from '@sentry/nextjs';

// ── Types ─────────────────────────────────────────────

export interface RootCauseSource {
  url: string | null;
  title: string;
  category: string;   // SourceCategory value
  platform: string;   // e.g. 'Yelp', 'TripAdvisor', 'Google'
  confidence: 'high' | 'medium' | 'low';
}

// ── Category → authoritative source mapping ────────────────────────────

// Which source categories are authoritative for each hallucination category?
// 'high' confidence: this source type directly controls the data field.
// 'medium': this source type often carries the field but may be secondary.
export const CATEGORY_SOURCE_MAP: Record<string, Array<{ platform: string; confidence: 'high' | 'medium' }>> = {
  hours:    [{ platform: 'yelp.com', confidence: 'high' }, { platform: 'tripadvisor.com', confidence: 'high' }, { platform: 'google.com', confidence: 'high' }],
  phone:    [{ platform: 'yelp.com', confidence: 'high' }, { platform: 'yellowpages.com', confidence: 'high' }, { platform: 'bingplaces.com', confidence: 'medium' }],
  address:  [{ platform: 'google.com', confidence: 'high' }, { platform: 'yelp.com', confidence: 'medium' }, { platform: 'bbb.org', confidence: 'medium' }],
  menu:     [{ platform: 'yelp.com', confidence: 'high' }, { platform: 'tripadvisor.com', confidence: 'medium' }, { platform: 'opentable.com', confidence: 'medium' }],
  closed:   [{ platform: 'yelp.com', confidence: 'high' }, { platform: 'google.com', confidence: 'high' }],
  name:     [{ platform: 'yelp.com', confidence: 'medium' }, { platform: 'google.com', confidence: 'high' }],
  website:  [{ platform: 'yelp.com', confidence: 'medium' }, { platform: 'bingplaces.com', confidence: 'medium' }],
  services: [{ platform: 'yelp.com', confidence: 'medium' }, { platform: 'tripadvisor.com', confidence: 'medium' }],
};

// ── Core pure function ─────────────────────────────────────────────

/**
 * Find which sources in a set of SOV evaluations are likely responsible
 * for a given hallucination based on its category.
 *
 * Pure function — no I/O.
 */
export function identifyRootCauseSources(
  hallucinationCategory: string | null,
  citedSources: Array<{ url: string; title: string }>,
  sourceMentions: Array<{ name: string; inferredUrl?: string | null; type?: string }>,
): RootCauseSource[] {
  if (!hallucinationCategory) return [];

  const platformList = CATEGORY_SOURCE_MAP[hallucinationCategory.toLowerCase()];
  if (!platformList || platformList.length === 0) return [];

  const results: RootCauseSource[] = [];
  const seenUrls = new Set<string>();

  // Check cited sources (structured — Google/Perplexity)
  for (const source of citedSources) {
    if (!source.url) continue;
    const hostname = extractHostname(source.url);
    if (!hostname) continue;

    const match = platformList.find(p => hostname.includes(p.platform));
    if (match && !seenUrls.has(source.url)) {
      seenUrls.add(source.url);
      results.push({
        url: source.url,
        title: source.title || extractDomainName(source.url),
        category: 'review_site',
        platform: extractDomainName(source.url),
        confidence: match.confidence,
      });
    }
  }

  // Check source mentions (AI-extracted — OpenAI/Copilot)
  for (const mention of sourceMentions) {
    const url = mention.inferredUrl;
    if (!url) continue;
    const hostname = extractHostname(url);
    if (!hostname) continue;

    const match = platformList.find(p => hostname.includes(p.platform));
    if (match && !seenUrls.has(url)) {
      seenUrls.add(url);
      results.push({
        url,
        title: mention.name || extractDomainName(url),
        category: mention.type ?? 'other',
        platform: extractDomainName(url),
        confidence: match.confidence,
      });
    }
  }

  // Sort by confidence (high first), then limit to 5
  const confidenceOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  results.sort((a, b) => (confidenceOrder[a.confidence] ?? 2) - (confidenceOrder[b.confidence] ?? 2));

  return results.slice(0, 5);
}

// ── DB write function ──────────────────────────────────────────────

/**
 * Enrich a hallucination record with root-cause source analysis.
 * Reads sov_evaluations for the same org to find cited sources.
 * Writes result to ai_hallucinations.root_cause_sources.
 *
 * Non-throwing — logs errors to Sentry, returns null on failure.
 */
export async function enrichHallucinationWithRootCause(
  supabase: SupabaseClient<Database>,
  hallucinationId: string,
  orgId: string,
): Promise<RootCauseSource[] | null> {
  try {
    // 1. Fetch the hallucination
    const { data: hallucination, error: hError } = await supabase
      .from('ai_hallucinations')
      .select('category, model_provider, location_id')
      .eq('id', hallucinationId)
      .single();

    if (hError || !hallucination) return null;

    // 2. Fetch recent sov_evaluations for same org, last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const { data: evaluations, error: eError } = await supabase
      .from('sov_evaluations')
      .select('cited_sources, source_mentions')
      .eq('org_id', orgId)
      .gte('created_at', thirtyDaysAgo)
      .limit(10);

    if (eError || !evaluations || evaluations.length === 0) return null;

    // 3. Flatten all cited_sources and source_mentions
    const allCitedSources: Array<{ url: string; title: string }> = [];
    const allMentions: Array<{ name: string; inferredUrl?: string | null; type?: string }> = [];

    for (const ev of evaluations) {
      if (Array.isArray(ev.cited_sources)) {
        for (const cs of ev.cited_sources as Array<{ url: string; title: string }>) {
          if (cs?.url) allCitedSources.push(cs);
        }
      }
      if (ev.source_mentions && typeof ev.source_mentions === 'object') {
        const mentions = ev.source_mentions as { sources?: Array<{ name: string; inferredUrl?: string | null; type?: string }> };
        if (Array.isArray(mentions.sources)) {
          for (const m of mentions.sources) {
            if (m?.name) allMentions.push(m);
          }
        }
      }
    }

    // 4. Run pure analysis
    const result = identifyRootCauseSources(hallucination.category, allCitedSources, allMentions);

    // 5. Write back if non-empty
    if (result.length > 0) {
      await supabase
        .from('ai_hallucinations')
        .update({ root_cause_sources: result as unknown as Database['public']['Tables']['ai_hallucinations']['Update']['root_cause_sources'] })
        .eq('id', hallucinationId);
    }

    return result.length > 0 ? result : null;
  } catch (err) {
    Sentry.captureException(err, {
      tags: { phase: 'root-cause-enrich', sprint: '5' },
    });
    return null;
  }
}

// ── Helpers ────────────────────────────────────────────────────────

function extractHostname(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}
