// ---------------------------------------------------------------------------
// brief-prioritizer.test.ts — Unit tests for content brief prioritizer
//
// P8-FIX-34: 14 tests — normalization, scoring, sorting, edge cases.
//
// Run:
//   npx vitest run src/__tests__/unit/brief-prioritizer.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  normalizeQueryGap,
  normalizeDraftTrigger,
  scoreBriefCandidate,
  prioritizeBriefCandidates,
  type BriefCandidate,
} from '@/lib/content-brief/brief-prioritizer';
import { MOCK_QUERY_GAPS, MOCK_DRAFT_TRIGGERS } from '@/src/__fixtures__/golden-tenant';

// ---------------------------------------------------------------------------
// normalizeQueryGap
// ---------------------------------------------------------------------------

describe('normalizeQueryGap', () => {
  it('normalizes untracked gap to BriefCandidate', () => {
    const gap = MOCK_QUERY_GAPS[2]; // untracked, discovery, medium
    const result = normalizeQueryGap(gap);
    expect(result.source).toBe('prompt_intelligence');
    expect(result.gapType).toBe('untracked');
    expect(result.queryText).toBe('hookah bar with food Alpharetta');
    expect(result.category).toBe('discovery');
    expect(result.impact).toBe('medium');
  });

  it('normalizes competitor_discovered gap to BriefCandidate', () => {
    const gap = MOCK_QUERY_GAPS[0]; // competitor_discovered, discovery, high
    const result = normalizeQueryGap(gap);
    expect(result.source).toBe('prompt_intelligence');
    expect(result.gapType).toBe('competitor_discovered');
    expect(result.impact).toBe('high');
  });

  it('normalizes zero_citation_cluster gap to BriefCandidate', () => {
    const gap = MOCK_QUERY_GAPS[1]; // zero_citation_cluster, near_me, high
    const result = normalizeQueryGap(gap);
    expect(result.gapType).toBe('zero_citation_cluster');
    expect(result.category).toBe('near_me');
  });

  it('preserves original gap reference', () => {
    const gap = MOCK_QUERY_GAPS[0];
    const result = normalizeQueryGap(gap);
    expect(result.originalGap).toBe(gap);
  });
});

// ---------------------------------------------------------------------------
// normalizeDraftTrigger
// ---------------------------------------------------------------------------

describe('normalizeDraftTrigger', () => {
  it('normalizes competitor_gap trigger', () => {
    const trigger = MOCK_DRAFT_TRIGGERS[0]; // competitor_gap
    const result = normalizeDraftTrigger(trigger);
    expect(result.source).toBe('autopilot');
    expect(result.gapType).toBe('competitor_gap');
    expect(result.impact).toBe('high');
  });

  it('normalizes prompt_missing trigger', () => {
    const trigger = MOCK_DRAFT_TRIGGERS[1]; // prompt_missing
    const result = normalizeDraftTrigger(trigger);
    expect(result.gapType).toBe('prompt_missing');
    expect(result.impact).toBe('medium');
  });

  it('extracts query text from context.targetQuery', () => {
    const trigger = MOCK_DRAFT_TRIGGERS[0]; // has targetQuery
    const result = normalizeDraftTrigger(trigger);
    expect(result.queryText).toBe('best Indian food Alpharetta');
  });
});

// ---------------------------------------------------------------------------
// scoreBriefCandidate
// ---------------------------------------------------------------------------

describe('scoreBriefCandidate', () => {
  it('scores competitor_discovered + high impact highest', () => {
    const candidate: BriefCandidate = {
      source: 'prompt_intelligence',
      gapType: 'competitor_discovered',
      queryText: 'test',
      category: 'discovery',
      impact: 'high',
      score: 0,
      originalGap: null,
    };
    const score = scoreBriefCandidate(candidate);
    // gap: 40 + impact: 35 + category: 25 = 100
    expect(score).toBe(100);
  });

  it('scores untracked + low impact lowest', () => {
    const candidate: BriefCandidate = {
      source: 'prompt_intelligence',
      gapType: 'untracked',
      queryText: 'test',
      category: 'custom',
      impact: 'low',
      score: 0,
      originalGap: null,
    };
    const score = scoreBriefCandidate(candidate);
    // gap: 10 + impact: 10 + category: 5 = 25
    expect(score).toBe(25);
  });

  it('adds category bonus for discovery queries', () => {
    const discovery: BriefCandidate = {
      source: 'prompt_intelligence',
      gapType: 'untracked',
      queryText: 'test',
      category: 'discovery',
      impact: 'low',
      score: 0,
      originalGap: null,
    };
    const custom: BriefCandidate = {
      ...discovery,
      category: 'custom',
    };
    const discoveryScore = scoreBriefCandidate(discovery);
    const customScore = scoreBriefCandidate(custom);
    // discovery bonus: 25, custom bonus: 5 → difference: 20
    expect(discoveryScore - customScore).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// prioritizeBriefCandidates
// ---------------------------------------------------------------------------

describe('prioritizeBriefCandidates', () => {
  it('returns candidates sorted by score descending', () => {
    const candidates = MOCK_QUERY_GAPS.map(normalizeQueryGap);
    const result = prioritizeBriefCandidates(candidates);
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score);
    }
  });

  it('respects limit parameter', () => {
    const candidates = MOCK_QUERY_GAPS.map(normalizeQueryGap);
    const result = prioritizeBriefCandidates(candidates, 2);
    expect(result).toHaveLength(2);
  });

  it('returns empty array for empty input', () => {
    const result = prioritizeBriefCandidates([]);
    expect(result).toEqual([]);
  });

  it('handles mixed sources (QueryGap + DraftTrigger)', () => {
    const fromGaps = MOCK_QUERY_GAPS.map(normalizeQueryGap);
    const fromTriggers = MOCK_DRAFT_TRIGGERS.map(normalizeDraftTrigger);
    const result = prioritizeBriefCandidates([...fromGaps, ...fromTriggers]);
    expect(result.length).toBe(MOCK_QUERY_GAPS.length + MOCK_DRAFT_TRIGGERS.length);
    // First result should be highest-scoring
    expect(result[0].score).toBeGreaterThanOrEqual(result[result.length - 1].score);
    // Should contain both sources
    const sources = new Set(result.map((c) => c.source));
    expect(sources.has('prompt_intelligence')).toBe(true);
    expect(sources.has('autopilot')).toBe(true);
  });
});
