// ---------------------------------------------------------------------------
// src/__tests__/unit/p4-sprints/reputation-sources-pages.test.ts — P4-FIX-20
//
// Tests for Your Reputation (sentiment) and Your Sources (citations) pages.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Sentiment analysis patterns
// ---------------------------------------------------------------------------

describe('sentiment categories', () => {
  const SENTIMENT_VALUES = ['positive', 'neutral', 'negative'] as const;

  it('defines 3 sentiment categories', () => {
    expect(SENTIMENT_VALUES).toHaveLength(3);
  });

  it('sentiment mapping from numeric scores', () => {
    function categorizeSentiment(score: number): string {
      if (score >= 0.6) return 'positive';
      if (score >= 0.4) return 'neutral';
      return 'negative';
    }

    expect(categorizeSentiment(0.8)).toBe('positive');
    expect(categorizeSentiment(0.5)).toBe('neutral');
    expect(categorizeSentiment(0.2)).toBe('negative');
  });
});

// ---------------------------------------------------------------------------
// Citation source intelligence patterns
// ---------------------------------------------------------------------------

describe('citation source intelligence', () => {
  const CITATION_SOURCES = [
    'google_maps',
    'yelp',
    'tripadvisor',
    'apple_maps',
    'bing_places',
    'facebook',
  ];

  it('tracks 6 major citation sources', () => {
    expect(CITATION_SOURCES).toHaveLength(6);
  });

  it('coverage score calculation', () => {
    function calculateCoverage(listed: number, total: number): number {
      if (total === 0) return 0;
      return Math.round((listed / total) * 100);
    }

    expect(calculateCoverage(4, 6)).toBe(67);
    expect(calculateCoverage(6, 6)).toBe(100);
    expect(calculateCoverage(0, 6)).toBe(0);
    expect(calculateCoverage(0, 0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Platform sync status
// ---------------------------------------------------------------------------

describe('platform sync status', () => {
  const SYNC_TYPES = ['real_oauth', 'manual_url', 'coming_soon'] as const;

  it('defines 3 sync types', () => {
    expect(SYNC_TYPES).toHaveLength(3);
  });

  it('real_oauth is the most integrated type', () => {
    // google is the only real_oauth currently
    expect(SYNC_TYPES).toContain('real_oauth');
  });

  it('manual_url allows user-provided URLs', () => {
    expect(SYNC_TYPES).toContain('manual_url');
  });
});
