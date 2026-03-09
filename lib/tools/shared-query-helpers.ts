// ---------------------------------------------------------------------------
// lib/tools/shared-query-helpers.ts — Shared logic for AI chat + MCP tools
//
// Extracted from visibility-tools.ts and mcp/tools.ts (P2 Audit #11/#13).
// Eliminates ~25 LOC duplication and replaces `: any` with proper types.
// ---------------------------------------------------------------------------

import type { Json } from '@/lib/supabase/database.types';

// ---------------------------------------------------------------------------
// Types for query results
// ---------------------------------------------------------------------------

export interface VisibilitySnapshot {
  share_of_voice: number | null;
  citation_rate: number | null;
  snapshot_date: string;
}

export interface HallucinationRecord {
  model_provider: string;
  severity: string;
  category: string;
  claim_text: string;
  expected_truth: string;
  correction_status: string;
  occurrence_count: number;
  first_detected_at?: string;
  last_seen_at?: string;
}

export interface CompetitorIntercept {
  competitor_name: string;
  gap_analysis: Json;
  suggested_action: string | null;
  created_at?: string;
}

export interface CompetitorSummary {
  count: number;
  latestGap: Json;
  recommendation: string;
}

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

/**
 * Compute the Reality Score from SOV and hallucination data.
 * Formula: 40% SOV + 40% accuracy + 20% baseline.
 */
export function computeRealityScore(
  shareOfVoice: number | null,
  openHallucinationCount: number
): { sov: number | null; accuracy: number; realityScore: number | null } {
  const sov = shareOfVoice != null ? Math.round(shareOfVoice * 100) : null;
  const accuracy = openHallucinationCount === 0
    ? 100
    : Math.max(40, 100 - openHallucinationCount * 15);
  const realityScore = sov != null
    ? Math.round(sov * 0.4 + accuracy * 0.4 + 100 * 0.2)
    : null;

  return { sov, accuracy, realityScore };
}

/**
 * Aggregate competitor intercepts into a by-competitor map.
 */
export function aggregateCompetitors(
  intercepts: CompetitorIntercept[]
): Record<string, CompetitorSummary> {
  const byCompetitor: Record<string, CompetitorSummary> = {};
  for (const i of intercepts) {
    if (!byCompetitor[i.competitor_name]) {
      byCompetitor[i.competitor_name] = {
        count: 0,
        latestGap: i.gap_analysis,
        recommendation: i.suggested_action ?? '',
      };
    }
    byCompetitor[i.competitor_name].count += 1;
  }
  return byCompetitor;
}

/**
 * Map a visibility snapshot row to a trend data point.
 */
export function mapSnapshotToTrend(s: VisibilitySnapshot) {
  return {
    date: s.snapshot_date,
    sov: Math.round((s.share_of_voice ?? 0) * 100),
    citationRate: Math.round((s.citation_rate ?? 0) * 100),
  };
}

/**
 * Map a hallucination row to a normalized object.
 */
export function mapHallucination(h: HallucinationRecord) {
  return {
    model: h.model_provider,
    severity: h.severity,
    category: h.category,
    claim: h.claim_text,
    truth: h.expected_truth,
    status: h.correction_status,
    occurrences: h.occurrence_count,
    ...(h.first_detected_at != null && { first_seen: h.first_detected_at }),
    ...(h.last_seen_at != null && { last_seen: h.last_seen_at }),
  };
}
