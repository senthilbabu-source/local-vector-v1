// ---------------------------------------------------------------------------
// vaio-service.test.ts — VAIO orchestrator unit tests
//
// Sprint 109: VAIO — ~13 tests
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeVoiceReadinessScore } from '@/lib/vaio/vaio-service';
import { VOICE_SCORE_WEIGHTS } from '@/lib/vaio/types';

// Mock external modules to isolate computeVoiceReadinessScore (pure function)
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

describe('computeVoiceReadinessScore', () => {
  it('returns max 100 for perfect state', () => {
    const score = computeVoiceReadinessScore('generated', 'healthy', 1.0, 100);
    expect(score).toBe(100);
  });

  it('returns 0 for worst state', () => {
    const score = computeVoiceReadinessScore('not_generated', 'blocked', 0, 0);
    expect(score).toBe(0);
  });

  it('gives full llms_txt weight (25) when generated', () => {
    const withGenerated = computeVoiceReadinessScore('generated', 'blocked', 0, 0);
    const withNotGenerated = computeVoiceReadinessScore('not_generated', 'blocked', 0, 0);
    expect(withGenerated - withNotGenerated).toBe(VOICE_SCORE_WEIGHTS.llms_txt);
  });

  it('gives partial llms_txt weight when stale', () => {
    const withStale = computeVoiceReadinessScore('stale', 'blocked', 0, 0);
    const withNotGenerated = computeVoiceReadinessScore('not_generated', 'blocked', 0, 0);
    expect(withStale).toBeGreaterThan(withNotGenerated);
    expect(withStale).toBeLessThan(VOICE_SCORE_WEIGHTS.llms_txt);
  });

  it('gives full crawler_access weight (25) when healthy', () => {
    const withHealthy = computeVoiceReadinessScore('not_generated', 'healthy', 0, 0);
    const withBlocked = computeVoiceReadinessScore('not_generated', 'blocked', 0, 0);
    expect(withHealthy - withBlocked).toBe(VOICE_SCORE_WEIGHTS.crawler_access);
  });

  it('gives partial crawler_access weight when partial', () => {
    const withPartial = computeVoiceReadinessScore('not_generated', 'partial', 0, 0);
    const withBlocked = computeVoiceReadinessScore('not_generated', 'blocked', 0, 0);
    expect(withPartial).toBeGreaterThan(withBlocked);
    expect(withPartial).toBeLessThan(VOICE_SCORE_WEIGHTS.crawler_access);
  });

  it('gives some crawler_access weight when unknown', () => {
    const withUnknown = computeVoiceReadinessScore('not_generated', 'unknown', 0, 0);
    const withBlocked = computeVoiceReadinessScore('not_generated', 'blocked', 0, 0);
    expect(withUnknown).toBeGreaterThan(withBlocked);
  });

  it('scales voice_citation score linearly with rate', () => {
    const at50 = computeVoiceReadinessScore('not_generated', 'blocked', 0.5, 0);
    const at100 = computeVoiceReadinessScore('not_generated', 'blocked', 1.0, 0);
    expect(at100).toBe(VOICE_SCORE_WEIGHTS.voice_citation);
    expect(at50).toBe(Math.round(0.5 * VOICE_SCORE_WEIGHTS.voice_citation));
  });

  it('scales content_quality score proportionally', () => {
    const at50 = computeVoiceReadinessScore('not_generated', 'blocked', 0, 50);
    const at100 = computeVoiceReadinessScore('not_generated', 'blocked', 0, 100);
    expect(at100).toBe(VOICE_SCORE_WEIGHTS.content_quality);
    expect(at50).toBe(Math.round(0.5 * VOICE_SCORE_WEIGHTS.content_quality));
  });

  it('caps at 100 even with hypothetical over-scoring', () => {
    // Max possible is exactly 100, but test that min(100, ...) works
    const score = computeVoiceReadinessScore('generated', 'healthy', 1.0, 100);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('computes realistic mid-range score', () => {
    // generated (25) + partial (12) + 0.4 citation (12) + 60/100 content (12) = 61
    const score = computeVoiceReadinessScore('generated', 'partial', 0.4, 60);
    expect(score).toBeGreaterThan(40);
    expect(score).toBeLessThan(80);
  });
});

describe('VOICE_SCORE_WEIGHTS', () => {
  it('sums to 100', () => {
    const total =
      VOICE_SCORE_WEIGHTS.llms_txt +
      VOICE_SCORE_WEIGHTS.crawler_access +
      VOICE_SCORE_WEIGHTS.voice_citation +
      VOICE_SCORE_WEIGHTS.content_quality;
    expect(total).toBe(100);
  });

  it('has expected individual values', () => {
    expect(VOICE_SCORE_WEIGHTS.llms_txt).toBe(25);
    expect(VOICE_SCORE_WEIGHTS.crawler_access).toBe(25);
    expect(VOICE_SCORE_WEIGHTS.voice_citation).toBe(30);
    expect(VOICE_SCORE_WEIGHTS.content_quality).toBe(20);
  });
});
