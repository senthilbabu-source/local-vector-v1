// ---------------------------------------------------------------------------
// lib/intent/intent-discoverer.ts — Intent Discovery Orchestrator (Sprint 135)
//
// Runs prompt expansion, queries Perplexity, scores gaps, and writes results.
// AI_RULES §168: Prompts are AI-generated (not from real user data).
// ---------------------------------------------------------------------------

import { generateText } from 'ai';
import { getModel } from '@/lib/ai/providers';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { detectCitation } from '@/lib/services/sov-model-normalizer';
import { expandPrompts } from './prompt-expander';
import type { IntentTheme, IntentGap, IntentDiscovery } from './intent-types';
import * as Sentry from '@sentry/nextjs';

const QUERY_DELAY_MS = 2000;

// ---------------------------------------------------------------------------
// Pure functions — exported for testing
// ---------------------------------------------------------------------------

/**
 * Classify a prompt into an intent theme based on keywords.
 */
export function classifyPromptTheme(prompt: string): IntentTheme {
  const lower = prompt.toLowerCase();
  if (/\b(hours?|open|close|when)\b/.test(lower)) return 'hours';
  if (/\b(event|party|birthday|bachelorette|celebration|wedding)\b/.test(lower))
    return 'events';
  if (/\b(menu|food|dish|serve|offer|price|cost)\b/.test(lower))
    return 'offerings';
  if (/\b(best|top|vs|versus|compare|better|alternative)\b/.test(lower))
    return 'comparison';
  if (/\b(date\s*night|anniversary|valentines|occasion|holiday)\b/.test(lower))
    return 'occasion';
  if (/\b(near|close\s*to|location|direction|address|where)\b/.test(lower))
    return 'location';
  return 'other';
}

/**
 * Score an opportunity gap. Higher = more important to fix.
 *
 * Scoring:
 *   50 base if client NOT cited
 *   +30 if 2+ competitors cited
 *   +20 if occasion or comparison theme
 */
export function scoreOpportunity(
  clientCited: boolean,
  competitorCount: number,
  theme: IntentTheme,
): number {
  if (clientCited) return 0;
  let score = 50;
  if (competitorCount >= 2) score += 30;
  if (theme === 'occasion' || theme === 'comparison') score += 20;
  return Math.min(100, score);
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

/**
 * Discover intent gaps for a location.
 * 1. Generates prompts via Claude
 * 2. Tests each prompt against Perplexity
 * 3. Detects client citation using sov-model-normalizer
 * 4. Scores and persists gaps
 */
export async function discoverIntents(
  locationId: string,
  orgId: string,
  orgName: string,
  supabase: SupabaseClient<Database>,
): Promise<IntentDiscovery> {
  const runId = crypto.randomUUID();

  // ── Fetch location context ────────────────────────────────────────────
  const { data: loc } = await supabase
    .from('locations')
    .select('business_name, city, state, categories, amenities')
    .eq('id', locationId)
    .single();

  if (!loc) {
    return {
      runId,
      totalPromptsRun: 0,
      gaps: [],
      covered: [],
      diminishingReturns: true,
      costEstimate: '0 Perplexity API calls',
    };
  }

  // ── Get top competitors from sov_evaluations ──────────────────────────
  const { data: evaluations } = await supabase
    .from('sov_evaluations')
    .select('mentioned_competitors')
    .eq('org_id', orgId)
    .not('mentioned_competitors', 'is', null)
    .limit(100);

  const competitorCounts: Record<string, number> = {};
  for (const ev of evaluations ?? []) {
    const competitors = ev.mentioned_competitors as string[] | null;
    if (Array.isArray(competitors)) {
      for (const c of competitors) {
        competitorCounts[c] = (competitorCounts[c] ?? 0) + 1;
      }
    }
  }
  const topCompetitors = Object.entries(competitorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);

  // ── Expand prompts via Claude ─────────────────────────────────────────
  const categories = Array.isArray(loc.categories)
    ? (loc.categories as string[])
    : [];
  const amenities = loc.amenities as Record<string, boolean | null> | null;
  const keyAmenities = amenities
    ? Object.entries(amenities)
        .filter(([, v]) => v === true)
        .map(([k]) => k.replace(/_/g, ' '))
    : [];

  const prompts = await expandPrompts({
    businessName: loc.business_name ?? orgName,
    city: loc.city ?? '',
    state: loc.state ?? '',
    categories,
    keyAmenities,
    competitors: topCompetitors,
  });

  // ── Test each prompt against Perplexity ───────────────────────────────
  const gaps: IntentGap[] = [];
  const covered: IntentGap[] = [];

  for (let i = 0; i < prompts.length; i++) {
    const prompt = prompts[i];

    try {
      // Rate limit delay between Perplexity calls
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, QUERY_DELAY_MS));
      }

      const { text: response } = await generateText({
        model: getModel('sov-query'),
        prompt,
        maxTokens: 500,
      });

      // Detect if client is cited
      const citation = detectCitation(response, orgName);
      const clientCited = citation.cited;

      // Extract competitor names from response
      const competitorsCited = topCompetitors.filter((c) =>
        response.toLowerCase().includes(c.toLowerCase()),
      );

      const theme = classifyPromptTheme(prompt);
      const opportunityScore = scoreOpportunity(
        clientCited,
        competitorsCited.length,
        theme,
      );

      const gap: IntentGap = {
        prompt,
        theme,
        clientCited,
        competitorsCited,
        opportunityScore,
      };

      if (clientCited) {
        covered.push(gap);
      } else {
        gaps.push(gap);
      }
    } catch (err) {
      Sentry.captureException(err, {
        tags: { service: 'intent-discoverer', sprint: '135', promptIndex: i },
      });
      // Continue with next prompt on error
    }
  }

  // ── Sort gaps by opportunity score desc ────────────────────────────────
  gaps.sort((a, b) => b.opportunityScore - a.opportunityScore);

  // ── Persist to intent_discoveries table ────────────────────────────────
  const rows = [...gaps, ...covered].map((g) => ({
    org_id: orgId,
    location_id: locationId,
    prompt: g.prompt,
    theme: g.theme,
    client_cited: g.clientCited,
    competitors_cited: g.competitorsCited,
    opportunity_score: g.opportunityScore,
    run_id: runId,
    discovered_at: new Date().toISOString(),
  }));

  if (rows.length > 0) {
    const { error } = await (supabase
      .from('intent_discoveries' as any) as any)
      .insert(rows);

    if (error) {
      Sentry.captureException(error, {
        tags: { service: 'intent-discoverer', sprint: '135', phase: 'persist' },
      });
    }
  }

  return {
    runId,
    totalPromptsRun: prompts.length,
    gaps,
    covered,
    diminishingReturns: gaps.length < 5,
    costEstimate: `${prompts.length} Perplexity API calls`,
  };
}
