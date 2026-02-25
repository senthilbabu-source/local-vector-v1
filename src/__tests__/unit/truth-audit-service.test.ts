import { describe, it, expect } from 'vitest';
import {
  ENGINE_WEIGHTS,
  calculateWeightedScore,
  hasConsensus,
  calculateTruthScore,
  buildTruthAuditResult,
  type EngineScore,
} from '@/lib/services/truth-audit.service';

// Golden tenant evaluation scores (Charcoal N Chill)
const GOLDEN_SCORES: EngineScore[] = [
  { engine: 'openai', accuracy_score: 95 },
  { engine: 'perplexity', accuracy_score: 65 },
  { engine: 'gemini', accuracy_score: 88 },
  { engine: 'anthropic', accuracy_score: 90 },
];

// All-high scores (consensus scenario)
const CONSENSUS_SCORES: EngineScore[] = [
  { engine: 'openai', accuracy_score: 95 },
  { engine: 'perplexity', accuracy_score: 85 },
  { engine: 'gemini', accuracy_score: 88 },
  { engine: 'anthropic', accuracy_score: 90 },
];

describe('truth-audit.service', () => {
  // ─── ENGINE_WEIGHTS ───────────────────────────────────────────────────

  describe('ENGINE_WEIGHTS', () => {
    it('weights sum to 1.0', () => {
      const sum = Object.values(ENGINE_WEIGHTS).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 10);
    });
  });

  // ─── calculateWeightedScore ───────────────────────────────────────────

  describe('calculateWeightedScore', () => {
    it('returns 0 for empty scores array', () => {
      expect(calculateWeightedScore([])).toBe(0);
    });

    it('computes golden-tenant weighted average (83.6)', () => {
      // openai: 95×0.30=28.5, perplexity: 65×0.30=19.5,
      // gemini: 88×0.20=17.6, anthropic: 90×0.20=18.0
      // total = 83.6, weightSum = 1.0 → 83.6
      const result = calculateWeightedScore(GOLDEN_SCORES);
      expect(result).toBe(83.6);
    });

    it('re-normalizes with only 2 engines', () => {
      const twoEngines: EngineScore[] = [
        { engine: 'openai', accuracy_score: 95 },
        { engine: 'perplexity', accuracy_score: 85 },
      ];
      // weighted = (95×0.3 + 85×0.3) / (0.3+0.3) = 54 / 0.6 = 90
      expect(calculateWeightedScore(twoEngines)).toBe(90);
    });

    it('handles single engine (re-normalized to its own score)', () => {
      const single: EngineScore[] = [
        { engine: 'anthropic', accuracy_score: 72 },
      ];
      // weighted = 72×0.2 / 0.2 = 72
      expect(calculateWeightedScore(single)).toBe(72);
    });

    it('computes consensus-scenario weighted average (89.6)', () => {
      // 95×0.3 + 85×0.3 + 88×0.2 + 90×0.2 = 28.5+25.5+17.6+18 = 89.6
      const result = calculateWeightedScore(CONSENSUS_SCORES);
      expect(result).toBe(89.6);
    });
  });

  // ─── hasConsensus ─────────────────────────────────────────────────────

  describe('hasConsensus', () => {
    it('returns false for empty scores', () => {
      expect(hasConsensus([])).toBe(false);
    });

    it('returns false for single engine (needs ≥ 2)', () => {
      expect(hasConsensus([{ engine: 'openai', accuracy_score: 95 }])).toBe(false);
    });

    it('returns false when any engine < 80 (golden tenant)', () => {
      // perplexity=65 < 80
      expect(hasConsensus(GOLDEN_SCORES)).toBe(false);
    });

    it('returns true when all engines ≥ 80', () => {
      expect(hasConsensus(CONSENSUS_SCORES)).toBe(true);
    });

    it('returns false when exactly at boundary (one engine = 79)', () => {
      const boundary: EngineScore[] = [
        { engine: 'openai', accuracy_score: 80 },
        { engine: 'perplexity', accuracy_score: 79 },
      ];
      expect(hasConsensus(boundary)).toBe(false);
    });

    it('returns true when exactly at boundary (all engines = 80)', () => {
      const boundary: EngineScore[] = [
        { engine: 'openai', accuracy_score: 80 },
        { engine: 'perplexity', accuracy_score: 80 },
      ];
      expect(hasConsensus(boundary)).toBe(true);
    });
  });

  // ─── calculateTruthScore ──────────────────────────────────────────────

  describe('calculateTruthScore', () => {
    it('golden tenant → 84 (no consensus, no penalty)', () => {
      // weighted = 83.6, no consensus (perplexity=65), no penalty
      // round(83.6) = 84
      expect(calculateTruthScore(GOLDEN_SCORES)).toBe(84);
    });

    it('consensus scenario → 95 (weighted 89.6 + bonus 5)', () => {
      // 89.6 + 5 = 94.6 → round = 95
      expect(calculateTruthScore(CONSENSUS_SCORES)).toBe(95);
    });

    it('golden tenant with closed hallucinations → 69', () => {
      // 83.6 - 15 = 68.6 → round = 69
      expect(calculateTruthScore(GOLDEN_SCORES, true)).toBe(69);
    });

    it('consensus + closed penalty → 80', () => {
      // 89.6 + 5 - 15 = 79.6 → round = 80
      expect(calculateTruthScore(CONSENSUS_SCORES, true)).toBe(80);
    });

    it('clamps to 0 when result would be negative', () => {
      const low: EngineScore[] = [
        { engine: 'openai', accuracy_score: 5 },
        { engine: 'perplexity', accuracy_score: 5 },
      ];
      // weighted = 5, no consensus (5<80), penalty = 15
      // 5 - 15 = -10 → clamped to 0
      expect(calculateTruthScore(low, true)).toBe(0);
    });

    it('clamps to 100 when result would exceed it', () => {
      const high: EngineScore[] = [
        { engine: 'openai', accuracy_score: 98 },
        { engine: 'perplexity', accuracy_score: 98 },
        { engine: 'gemini', accuracy_score: 98 },
        { engine: 'anthropic', accuracy_score: 98 },
      ];
      // weighted = 98, consensus → +5, total = 103 → clamped to 100
      expect(calculateTruthScore(high)).toBe(100);
    });

    it('returns 0 for empty scores', () => {
      expect(calculateTruthScore([])).toBe(0);
    });
  });

  // ─── buildTruthAuditResult ────────────────────────────────────────────

  describe('buildTruthAuditResult', () => {
    it('builds golden-tenant result correctly', () => {
      const result = buildTruthAuditResult(GOLDEN_SCORES);

      expect(result.truth_score).toBe(84);
      expect(result.consensus).toBe(false);
      expect(result.engines_reporting).toBe(4);
      expect(result.engine_scores).toEqual({
        openai: 95,
        perplexity: 65,
        gemini: 88,
        anthropic: 90,
      });
    });

    it('fills null for missing engines', () => {
      const partial: EngineScore[] = [
        { engine: 'openai', accuracy_score: 90 },
      ];
      const result = buildTruthAuditResult(partial);

      expect(result.engine_scores.openai).toBe(90);
      expect(result.engine_scores.perplexity).toBeNull();
      expect(result.engine_scores.gemini).toBeNull();
      expect(result.engine_scores.anthropic).toBeNull();
      expect(result.engines_reporting).toBe(1);
    });

    it('applies closed-hallucination penalty when flag is true', () => {
      const result = buildTruthAuditResult(GOLDEN_SCORES, true);
      expect(result.truth_score).toBe(69);
    });

    it('returns zero-state result for empty evaluations', () => {
      const result = buildTruthAuditResult([]);

      expect(result.truth_score).toBe(0);
      expect(result.consensus).toBe(false);
      expect(result.engines_reporting).toBe(0);
      expect(result.engine_scores).toEqual({
        openai: null,
        perplexity: null,
        gemini: null,
        anthropic: null,
      });
    });
  });
});
