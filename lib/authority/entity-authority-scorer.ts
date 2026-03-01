// ---------------------------------------------------------------------------
// lib/authority/entity-authority-scorer.ts — Entity Authority Scorer
//
// Sprint 108: Computes entity_authority_score (0–100) from five dimensions.
// Pure functions — no I/O (except platform/sameAs counting helpers).
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { CitationSource, AuthorityDimensions, EntityAuthorityProfile } from './types';

// ── Scoring Functions ────────────────────────────────────────────────────────

/**
 * Computes the entity_authority_score (0–100) from five dimensions.
 *
 * Dimension breakdown:
 * 1. Tier 1 Citation Score (max 30 pts)
 *    0→0, 1→15, 2→22, 3+→30
 *
 * 2. Tier 2 Coverage Score (max 25 pts)
 *    formula: min(25, tier2_count × 5)
 *
 * 3. Platform Breadth Score (max 20 pts)
 *    1–2→5, 3–4→12, 5+→20
 *
 * 4. sameAs Score (max 15 pts)
 *    formula: min(15, sameas_count × 3)
 *
 * 5. Velocity Score (max 10 pts)
 *    ≥+10%→10, -10% to +10%→6, -20% to -10%→3, <-20%→0, null→5
 */
export function computeAuthorityScore(
  citations: CitationSource[],
  platformCount: number,
  sameAsCount: number,
  velocity: number | null,
): { score: number; dimensions: AuthorityDimensions } {
  const tier1Count = citations.filter(c => c.tier === 'tier1').length;
  const tier2Count = citations.filter(c => c.tier === 'tier2').length;

  // Dimension 1: Tier 1 Citation Score (0–30)
  let tier1_citation_score: number;
  if (tier1Count >= 3) tier1_citation_score = 30;
  else if (tier1Count === 2) tier1_citation_score = 22;
  else if (tier1Count === 1) tier1_citation_score = 15;
  else tier1_citation_score = 0;

  // Dimension 2: Tier 2 Coverage Score (0–25)
  const tier2_coverage_score = Math.min(25, tier2Count * 5);

  // Dimension 3: Platform Breadth Score (0–20)
  let platform_breadth_score: number;
  if (platformCount >= 5) platform_breadth_score = 20;
  else if (platformCount >= 3) platform_breadth_score = 12;
  else if (platformCount >= 1) platform_breadth_score = 5;
  else platform_breadth_score = 0;

  // Dimension 4: sameAs Score (0–15)
  const sameas_score = Math.min(15, sameAsCount * 3);

  // Dimension 5: Velocity Score (0–10)
  let velocity_score: number;
  if (velocity === null) {
    velocity_score = 5; // First run — neutral
  } else if (velocity >= 10) {
    velocity_score = 10;
  } else if (velocity >= -10) {
    velocity_score = 6;
  } else if (velocity >= -20) {
    velocity_score = 3;
  } else {
    velocity_score = 0;
  }

  const dimensions: AuthorityDimensions = {
    tier1_citation_score,
    tier2_coverage_score,
    platform_breadth_score,
    sameas_score,
    velocity_score,
  };

  const score = Math.min(100, Math.max(0,
    tier1_citation_score +
    tier2_coverage_score +
    platform_breadth_score +
    sameas_score +
    velocity_score
  ));

  return { score, dimensions };
}

/**
 * Computes the velocity label from a velocity number.
 */
export function getVelocityLabel(
  velocity: number | null,
): EntityAuthorityProfile['velocity_label'] {
  if (velocity === null) return 'unknown';
  if (velocity >= 10) return 'growing';
  if (velocity <= -10) return 'declining';
  return 'stable';
}

/**
 * Returns a letter grade from an authority score.
 */
export function getAuthorityGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  if (score >= 20) return 'D';
  return 'F';
}

// ── DB Query Helpers ─────────────────────────────────────────────────────────

/**
 * Counts the unique platforms in listing_platform_ids for a location.
 */
export async function countActivePlatforms(
  supabase: SupabaseClient<Database>,
  locationId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from('listing_platform_ids')
    .select('platform')
    .eq('location_id', locationId);

  if (error || !data) return 0;

  const uniquePlatforms = new Set(data.map(r => r.platform));
  return uniquePlatforms.size;
}

/**
 * Counts the sameAs URLs in the homepage schema for a location.
 * Reads from page_schemas table: page_type = 'homepage', status = 'published'.
 */
export async function countSameAsUrls(
  supabase: SupabaseClient<Database>,
  locationId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from('page_schemas')
    .select('json_ld')
    .eq('location_id', locationId)
    .eq('page_type', 'homepage')
    .eq('status', 'published')
    .limit(1)
    .maybeSingle();

  if (error || !data?.json_ld) return 0;

  // json_ld is an array of JSON-LD objects; look for sameAs in any
  const jsonLd = data.json_ld as unknown as Array<Record<string, unknown>>;
  if (!Array.isArray(jsonLd)) return 0;

  for (const schema of jsonLd) {
    if (schema.sameAs && Array.isArray(schema.sameAs)) {
      return schema.sameAs.length;
    }
  }

  return 0;
}
