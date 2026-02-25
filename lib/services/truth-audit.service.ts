// ---------------------------------------------------------------------------
// lib/services/truth-audit.service.ts — Multi-Engine Truth Audit Service
//
// Pure functions with zero side effects (AI_RULES §6: business logic in
// lib/services/ never creates its own Supabase client).
//
// The Truth Score is a 0–100 weighted composite of per-engine accuracy scores:
//   truth_score = Σ(engine_weight × accuracy_score)
//                 + consensus_bonus (+5 if all engines ≥ 80)
//                 − closed_hallucination_penalty (−15 if any closed hallucinations)
//   Clamped to [0, 100].
// ---------------------------------------------------------------------------

import type { EvaluationEngine } from '@/lib/schemas/evaluations';

// ── Constants ────────────────────────────────────────────────────────────────

export const ENGINE_WEIGHTS: Record<EvaluationEngine, number> = {
  openai: 0.3,
  perplexity: 0.3,
  gemini: 0.2,
  anthropic: 0.2,
};

const CONSENSUS_THRESHOLD = 80;
const CONSENSUS_BONUS = 5;
const CLOSED_HALLUCINATION_PENALTY = 15;

// ── Types ────────────────────────────────────────────────────────────────────

export interface EngineScore {
  engine: EvaluationEngine;
  accuracy_score: number;
}

export interface TruthAuditResult {
  truth_score: number;
  consensus: boolean;
  engine_scores: Record<EvaluationEngine, number | null>;
  engines_reporting: number;
}

// ── Pure Functions ───────────────────────────────────────────────────────────

const round2 = (x: number): number => Math.round(x * 100) / 100;

/**
 * Calculates the weighted average of engine accuracy scores.
 * Only engines present in the input contribute. Weights are re-normalized
 * to sum to 1.0 so partial data (e.g., only 2 engines) still produces a
 * valid 0–100 score.
 */
export function calculateWeightedScore(scores: EngineScore[]): number {
  if (scores.length === 0) return 0;

  let weightSum = 0;
  let weighted = 0;

  for (const s of scores) {
    const w = ENGINE_WEIGHTS[s.engine] ?? 0;
    weighted += w * s.accuracy_score;
    weightSum += w;
  }

  if (weightSum === 0) return 0;
  return round2(weighted / weightSum);
}

/**
 * Returns true when ALL provided engines score ≥ CONSENSUS_THRESHOLD (80).
 * Requires at least 2 engines to form a meaningful consensus.
 */
export function hasConsensus(scores: EngineScore[]): boolean {
  if (scores.length < 2) return false;
  return scores.every((s) => s.accuracy_score >= CONSENSUS_THRESHOLD);
}

/**
 * Calculates the final Truth Score (0–100).
 *
 * Formula:
 *   base      = weighted average of engine accuracy scores
 *   bonus     = +5 if consensus (all engines ≥ 80)
 *   penalty   = −15 if any hallucinations have been closed (confirmed real)
 *   result    = clamp(base + bonus − penalty, 0, 100)
 */
export function calculateTruthScore(
  scores: EngineScore[],
  hasClosedHallucinations = false,
): number {
  const base = calculateWeightedScore(scores);
  const bonus = hasConsensus(scores) ? CONSENSUS_BONUS : 0;
  const penalty = hasClosedHallucinations ? CLOSED_HALLUCINATION_PENALTY : 0;
  return Math.min(100, Math.max(0, Math.round(base + bonus - penalty)));
}

/**
 * Builds the complete TruthAuditResult from a set of evaluation rows.
 * Each evaluation row only needs `engine` and `accuracy_score`.
 */
export function buildTruthAuditResult(
  evaluations: EngineScore[],
  hasClosedHallucinations = false,
): TruthAuditResult {
  // Build engine_scores map — null for engines with no data
  const engineScores: Record<EvaluationEngine, number | null> = {
    openai: null,
    perplexity: null,
    anthropic: null,
    gemini: null,
  };

  for (const e of evaluations) {
    engineScores[e.engine] = e.accuracy_score;
  }

  const validScores = evaluations.filter(
    (e) => e.accuracy_score != null && ENGINE_WEIGHTS[e.engine] != null,
  );

  return {
    truth_score: calculateTruthScore(validScores, hasClosedHallucinations),
    consensus: hasConsensus(validScores),
    engine_scores: engineScores,
    engines_reporting: validScores.length,
  };
}
