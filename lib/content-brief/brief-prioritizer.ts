// ---------------------------------------------------------------------------
// lib/content-brief/brief-prioritizer.ts — Pure Brief Candidate Prioritizer
//
// P8-FIX-34: Normalizes gaps from multiple sources (prompt intelligence,
// autopilot triggers, voice gaps) into a common BriefCandidate type,
// scores them, and returns a prioritized list.
//
// Pure functions — no I/O, no DB, no API calls.
// ---------------------------------------------------------------------------

import type { QueryGap, GapImpact } from '@/lib/types/prompt-intelligence';
import type { DraftTrigger } from '@/lib/types/autopilot';

// ── Types ─────────────────────────────────────────────

export type BriefCandidateSource = 'prompt_intelligence' | 'autopilot' | 'voice_gap';

export interface BriefCandidate {
  source: BriefCandidateSource;
  gapType: string;
  queryText: string;
  category: string;
  impact: GapImpact;
  score: number;
  originalGap: unknown;
}

// ── Scoring Weights ───────────────────────────────────

/** Gap type weight (40 pts max). Higher = more urgent to brief. */
const GAP_TYPE_WEIGHT: Record<string, number> = {
  competitor_discovered: 40,
  competitor_gap: 40,
  zero_citation_cluster: 30,
  prompt_missing: 25,
  review_gap: 20,
  schema_gap: 15,
  voice_gap: 15,
  untracked: 10,
};

/** Impact weight (35 pts max). */
const IMPACT_WEIGHT: Record<GapImpact, number> = {
  high: 35,
  medium: 20,
  low: 10,
};

/** Category bonus (25 pts max). Discovery queries are highest-value. */
const CATEGORY_BONUS: Record<string, number> = {
  discovery: 25,
  near_me: 20,
  occasion: 15,
  comparison: 10,
  custom: 5,
};

// ── Normalizers ───────────────────────────────────────

/**
 * Normalize a QueryGap (from prompt-intelligence) into a BriefCandidate.
 */
export function normalizeQueryGap(gap: QueryGap): BriefCandidate {
  return {
    source: 'prompt_intelligence',
    gapType: gap.gapType,
    queryText: gap.queryText,
    category: gap.queryCategory,
    impact: gap.estimatedImpact,
    score: 0, // computed by scoreBriefCandidate
    originalGap: gap,
  };
}

/**
 * Normalize a DraftTrigger (from autopilot) into a BriefCandidate.
 */
export function normalizeDraftTrigger(trigger: DraftTrigger): BriefCandidate {
  const queryText =
    trigger.context.targetQuery ??
    trigger.context.zeroCitationQueries?.[0] ??
    trigger.context.occasionName ??
    '';

  // Map trigger types to impact levels
  const impactMap: Record<string, GapImpact> = {
    competitor_gap: 'high',
    prompt_missing: 'medium',
    first_mover: 'high',
    review_gap: 'medium',
    schema_gap: 'low',
    occasion: 'medium',
    voice_gap: 'medium',
    manual: 'medium',
  };

  return {
    source: 'autopilot',
    gapType: trigger.triggerType,
    queryText,
    category: 'custom', // autopilot triggers don't carry category
    impact: impactMap[trigger.triggerType] ?? 'medium',
    score: 0,
    originalGap: trigger,
  };
}

// ── Scoring ───────────────────────────────────────────

/**
 * Compute priority score for a BriefCandidate.
 * Returns 0–100.
 */
export function scoreBriefCandidate(candidate: BriefCandidate): number {
  const gapWeight = GAP_TYPE_WEIGHT[candidate.gapType] ?? 10;
  const impactWeight = IMPACT_WEIGHT[candidate.impact] ?? 10;
  const categoryBonus = CATEGORY_BONUS[candidate.category] ?? 5;

  return Math.min(100, gapWeight + impactWeight + categoryBonus);
}

// ── Prioritizer ───────────────────────────────────────

/**
 * Score and sort BriefCandidates by priority (highest first).
 * Optionally limit to top N.
 */
export function prioritizeBriefCandidates(
  candidates: BriefCandidate[],
  limit?: number,
): BriefCandidate[] {
  if (candidates.length === 0) return [];

  // Score all candidates
  const scored = candidates.map((c) => ({
    ...c,
    score: scoreBriefCandidate(c),
  }));

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  // Apply limit
  if (limit != null && limit > 0) {
    return scored.slice(0, limit);
  }

  return scored;
}
