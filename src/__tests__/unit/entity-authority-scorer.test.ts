/**
 * Entity Authority Scorer unit tests.
 * Target: lib/authority/entity-authority-scorer.ts
 * Pure functions — zero mocks needed.
 */

import { describe, it, expect } from 'vitest';
import {
  computeAuthorityScore,
  getVelocityLabel,
  getAuthorityGrade,
} from '@/lib/authority/entity-authority-scorer';
import type { CitationSource, AuthorityTier } from '@/lib/authority/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeCitation(tier: AuthorityTier): CitationSource {
  return {
    url: `https://example.com/${tier}`,
    domain: 'example.com',
    tier,
    source_type: tier === 'tier1' ? 'local_news' : tier === 'tier2' ? 'yelp' : 'aggregator_blog',
    snippet: null,
    detected_at: '2026-03-01T00:00:00.000Z',
    sentiment: 'neutral',
    is_sameas_candidate: false,
  };
}

function makeCitations(tier: AuthorityTier, count: number): CitationSource[] {
  return Array.from({ length: count }, () => makeCitation(tier));
}

// ── computeAuthorityScore ────────────────────────────────────────────────────

describe('computeAuthorityScore', () => {
  it('all zeros yields score 0', () => {
    const result = computeAuthorityScore([], 0, 0, null);
    // velocity null → 5, everything else 0
    expect(result.score).toBe(5);
    expect(result.dimensions).toEqual({
      tier1_citation_score: 0,
      tier2_coverage_score: 0,
      platform_breadth_score: 0,
      sameas_score: 0,
      velocity_score: 5,
    });
  });

  // ── Tier 1 dimension ──

  it('1 tier1 citation gives 15 points for that dimension', () => {
    const result = computeAuthorityScore(makeCitations('tier1', 1), 0, 0, null);
    expect(result.dimensions.tier1_citation_score).toBe(15);
  });

  it('2 tier1 citations give 22 points', () => {
    const result = computeAuthorityScore(makeCitations('tier1', 2), 0, 0, null);
    expect(result.dimensions.tier1_citation_score).toBe(22);
  });

  it('3+ tier1 citations give 30 points', () => {
    const result = computeAuthorityScore(makeCitations('tier1', 5), 0, 0, null);
    expect(result.dimensions.tier1_citation_score).toBe(30);
  });

  // ── Tier 2 dimension ──

  it('tier2 coverage caps at 25 (5 citations * 5 = 25)', () => {
    const result = computeAuthorityScore(makeCitations('tier2', 8), 0, 0, null);
    expect(result.dimensions.tier2_coverage_score).toBe(25);
  });

  it('tier2 with 3 citations gives 15', () => {
    const result = computeAuthorityScore(makeCitations('tier2', 3), 0, 0, null);
    expect(result.dimensions.tier2_coverage_score).toBe(15);
  });

  // ── Platform Breadth dimension ──

  it('platform breadth 1 gives 5 points', () => {
    const result = computeAuthorityScore([], 1, 0, null);
    expect(result.dimensions.platform_breadth_score).toBe(5);
  });

  it('platform breadth 4 gives 12 points', () => {
    const result = computeAuthorityScore([], 4, 0, null);
    expect(result.dimensions.platform_breadth_score).toBe(12);
  });

  it('platform breadth 6 gives 20 points (capped)', () => {
    const result = computeAuthorityScore([], 6, 0, null);
    expect(result.dimensions.platform_breadth_score).toBe(20);
  });

  // ── sameAs dimension ──

  it('sameAs count 5 gives 15 (capped at 15)', () => {
    const result = computeAuthorityScore([], 0, 5, null);
    expect(result.dimensions.sameas_score).toBe(15);
  });

  it('sameAs count 2 gives 6', () => {
    const result = computeAuthorityScore([], 0, 2, null);
    expect(result.dimensions.sameas_score).toBe(6);
  });

  // ── Velocity dimension ──

  it('velocity null gives 5 (neutral)', () => {
    const result = computeAuthorityScore([], 0, 0, null);
    expect(result.dimensions.velocity_score).toBe(5);
  });

  it('velocity +15% gives 10', () => {
    const result = computeAuthorityScore([], 0, 0, 15);
    expect(result.dimensions.velocity_score).toBe(10);
  });

  it('velocity -5% gives 6 (stable range)', () => {
    const result = computeAuthorityScore([], 0, 0, -5);
    expect(result.dimensions.velocity_score).toBe(6);
  });

  it('velocity -25% gives 0', () => {
    const result = computeAuthorityScore([], 0, 0, -25);
    expect(result.dimensions.velocity_score).toBe(0);
  });

  // ── Full realistic scenario ──

  it('realistic scenario: 0 tier1, 3 tier2, 3 platforms, 3 sameAs, null velocity → score 41', () => {
    const citations = makeCitations('tier2', 3);
    const result = computeAuthorityScore(citations, 3, 3, null);

    // tier1: 0, tier2: 15, platform: 12, sameAs: 9, velocity: 5 → total 41
    expect(result.dimensions.tier1_citation_score).toBe(0);
    expect(result.dimensions.tier2_coverage_score).toBe(15);
    expect(result.dimensions.platform_breadth_score).toBe(12);
    expect(result.dimensions.sameas_score).toBe(9);
    expect(result.dimensions.velocity_score).toBe(5);
    expect(result.score).toBe(41);
  });
});

// ── getVelocityLabel ─────────────────────────────────────────────────────────

describe('getVelocityLabel', () => {
  it('null returns unknown', () => {
    expect(getVelocityLabel(null)).toBe('unknown');
  });

  it('+15 returns growing', () => {
    expect(getVelocityLabel(15)).toBe('growing');
  });

  it('+10 returns growing (boundary)', () => {
    expect(getVelocityLabel(10)).toBe('growing');
  });

  it('-5 returns stable', () => {
    expect(getVelocityLabel(-5)).toBe('stable');
  });

  it('-10 returns declining (boundary)', () => {
    expect(getVelocityLabel(-10)).toBe('declining');
  });

  it('-25 returns declining', () => {
    expect(getVelocityLabel(-25)).toBe('declining');
  });
});

// ── getAuthorityGrade ────────────────────────────────────────────────────────

describe('getAuthorityGrade', () => {
  it('85 returns A', () => {
    expect(getAuthorityGrade(85)).toBe('A');
  });

  it('65 returns B', () => {
    expect(getAuthorityGrade(65)).toBe('B');
  });

  it('45 returns C', () => {
    expect(getAuthorityGrade(45)).toBe('C');
  });

  it('15 returns F', () => {
    expect(getAuthorityGrade(15)).toBe('F');
  });
});
