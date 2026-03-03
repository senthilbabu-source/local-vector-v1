// ---------------------------------------------------------------------------
// lib/playbooks/playbook-engine.ts — Playbook Generation Engine (Sprint 134)
//
// Generates per-engine playbooks comparing client vs. top competitor citation rates.
// AI_RULES §167: Estimates are heuristics. Label as "evidence suggests" not "guaranteed".
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/supabase/database.types';
import {
  ENGINE_SIGNAL_LIBRARIES,
  ENGINE_DISPLAY_NAMES,
} from './engine-signal-library';
import type {
  Playbook,
  PlaybookAction,
  LocationSignalInput,
} from './playbook-types';
import * as Sentry from '@sentry/nextjs';

const MIN_QUERIES_FOR_PLAYBOOK = 20;

/**
 * Generate a playbook for one engine.
 * Reads sov_model_results to compute citation rates.
 * Reads location signals to evaluate engine signal library.
 */
export async function generatePlaybook(
  orgId: string,
  locationId: string,
  engine: string,
  supabase: SupabaseClient<Database>,
): Promise<Playbook> {
  const now = new Date().toISOString();
  const displayName = ENGINE_DISPLAY_NAMES[engine] ?? engine;
  const signals = ENGINE_SIGNAL_LIBRARIES[engine] ?? [];

  // ── Count total and cited results for this engine ────────────────────
  const { count: totalCount } = await supabase
    .from('sov_model_results')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('model_provider', engine);

  const total = totalCount ?? 0;

  if (total < MIN_QUERIES_FOR_PLAYBOOK) {
    return {
      engine,
      engineDisplayName: displayName,
      clientCitationRate: 0,
      topCompetitorRate: 0,
      gapPercent: 0,
      actions: [],
      insufficientData: true,
      generatedAt: now,
    };
  }

  const { count: citedCount } = await supabase
    .from('sov_model_results')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('model_provider', engine)
    .eq('cited', true);

  const cited = citedCount ?? 0;
  const clientCitationRate = total > 0 ? cited / total : 0;

  // ── Estimate top competitor rate from sov_evaluations ─────────────────
  const { data: evaluations } = await supabase
    .from('sov_evaluations')
    .select('mentioned_competitors')
    .eq('org_id', orgId)
    .not('mentioned_competitors', 'is', null)
    .limit(200);

  let topCompetitorRate = 0;
  if (evaluations && evaluations.length > 0) {
    const competitorCounts: Record<string, number> = {};
    for (const ev of evaluations) {
      const competitors = ev.mentioned_competitors as string[] | null;
      if (Array.isArray(competitors)) {
        for (const c of competitors) {
          competitorCounts[c] = (competitorCounts[c] ?? 0) + 1;
        }
      }
    }
    const maxCount = Math.max(0, ...Object.values(competitorCounts));
    topCompetitorRate = evaluations.length > 0 ? maxCount / evaluations.length : 0;
  }

  const gapPercent = Math.round(
    (topCompetitorRate - clientCitationRate) * 100,
  );

  // ── Build signal input from location data ─────────────────────────────
  const signalInput = await buildLocationSignalInput(
    locationId,
    supabase,
  );

  // ── Evaluate signals and build actions ────────────────────────────────
  const actions: PlaybookAction[] = signals.map((signal) => {
    const status = signal.checkFn(signalInput);
    return {
      signalId: signal.id,
      label: signal.label,
      priority: signal.estimatedImpact,
      status,
      description: signal.description,
      fixGuide: signal.fixGuide,
      estimatedImpact: signal.estimatedImpact,
      linkedLocalVectorFeature: signal.linkedLocalVectorFeature,
    };
  });

  // Sort: missing high-impact first
  const impactOrder = { high: 0, medium: 1, low: 2 };
  const statusOrder = { missing: 0, partial: 1, present: 2 };
  actions.sort((a, b) => {
    const statusDiff = statusOrder[a.status] - statusOrder[b.status];
    if (statusDiff !== 0) return statusDiff;
    return impactOrder[a.estimatedImpact] - impactOrder[b.estimatedImpact];
  });

  return {
    engine,
    engineDisplayName: displayName,
    clientCitationRate,
    topCompetitorRate,
    gapPercent: Math.max(0, gapPercent),
    actions,
    insufficientData: false,
    generatedAt: now,
  };
}

/**
 * Generate all engine playbooks and cache on locations.
 */
export async function generateAllPlaybooks(
  orgId: string,
  locationId: string,
  supabase: SupabaseClient<Database>,
): Promise<Record<string, Playbook>> {
  const engines = Object.keys(ENGINE_SIGNAL_LIBRARIES);
  const result: Record<string, Playbook> = {};

  for (const engine of engines) {
    try {
      result[engine] = await generatePlaybook(
        orgId,
        locationId,
        engine,
        supabase,
      );
    } catch (err) {
      Sentry.captureException(err, {
        tags: { service: 'playbook-engine', sprint: '134', engine },
      });
    }
  }

  // Cache on locations table
  try {
    const cachePayload = {
      ...result,
      generated_at: new Date().toISOString(),
    };

    await (supabase
      .from('locations') as any)
      .update({
        playbook_cache: cachePayload as unknown as Json,
        playbook_generated_at: new Date().toISOString(),
      })
      .eq('id', locationId);
  } catch (err) {
    Sentry.captureException(err, {
      tags: { service: 'playbook-engine', sprint: '134', phase: 'cache-write' },
    });
  }

  return result;
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function buildLocationSignalInput(
  locationId: string,
  supabase: SupabaseClient<Database>,
): Promise<LocationSignalInput> {
  const [locResult, menuCountResult] = await Promise.all([
    supabase
      .from('locations')
      .select(
        'website_url, google_place_id, data_health_score',
      )
      .eq('id', locationId)
      .single(),
    supabase
      .from('menu_items')
      .select(
        'id, menu_categories!inner(menu_id, magic_menus!inner(location_id, is_published))',
      )
      .eq('menu_categories.magic_menus.location_id', locationId)
      .eq('menu_categories.magic_menus.is_published', true),
  ]);

  const loc = locResult.data;

  return {
    hasRestaurantSchema: false, // Would require page crawl; default false
    hasMenuSchema: (menuCountResult.data?.length ?? 0) > 0,
    hasReserveActionSchema: false, // Requires schema crawl
    gbpVerified: !!loc?.google_place_id,
    gbpCompleteness: (loc?.data_health_score as number) ?? 0,
    reviewCount: 0, // Would need reviews table query
    avgRating: null,
    lastReviewDate: null,
    websiteUrl: loc?.website_url ?? null,
    hasWikidataEntry: false,
    hasBingPlacesEntry: false, // Would check bing_places_connections
    canonicalUrlConsistent: !!loc?.website_url && !!loc?.google_place_id,
    menuItemCount: menuCountResult.data?.length ?? 0,
  };
}
