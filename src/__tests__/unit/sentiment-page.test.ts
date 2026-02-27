// ---------------------------------------------------------------------------
// sentiment-page.test.ts — Unit tests for dashboard page + sidebar
//
// Sprint 81: 5 tests — page rendering + sidebar nav.
//
// Run:
//   npx vitest run src/__tests__/unit/sentiment-page.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { MOCK_SENTIMENT_SUMMARY } from '@/src/__fixtures__/golden-tenant';
import { NAV_ITEMS } from '@/components/layout/Sidebar';
import { aggregateSentiment } from '@/lib/services/sentiment.service';

// ---------------------------------------------------------------------------
// Sentiment page (testing data shapes and sidebar presence)
// ---------------------------------------------------------------------------

describe('Sentiment page', () => {
  it('1. MOCK_SENTIMENT_SUMMARY has required score field', () => {
    expect(MOCK_SENTIMENT_SUMMARY.averageScore).toBeDefined();
    expect(typeof MOCK_SENTIMENT_SUMMARY.averageScore).toBe('number');
  });

  it('2. MOCK_SENTIMENT_SUMMARY has descriptor arrays', () => {
    expect(Array.isArray(MOCK_SENTIMENT_SUMMARY.topPositive)).toBe(true);
    expect(Array.isArray(MOCK_SENTIMENT_SUMMARY.topNegative)).toBe(true);
    expect(MOCK_SENTIMENT_SUMMARY.topPositive.length).toBeGreaterThan(0);
  });

  it('3. MOCK_SENTIMENT_SUMMARY has per-engine breakdown', () => {
    expect(MOCK_SENTIMENT_SUMMARY.byEngine).toBeDefined();
    const engines = Object.keys(MOCK_SENTIMENT_SUMMARY.byEngine);
    expect(engines.length).toBeGreaterThan(0);

    for (const engine of engines) {
      const data = MOCK_SENTIMENT_SUMMARY.byEngine[engine];
      expect(data.averageScore).toBeDefined();
      expect(data.label).toBeDefined();
      expect(data.tone).toBeDefined();
      expect(data.descriptors.positive).toBeDefined();
      expect(data.descriptors.negative).toBeDefined();
    }
  });

  it('4. aggregateSentiment returns correct empty state shape', () => {
    const empty = aggregateSentiment([]);
    expect(empty.evaluationCount).toBe(0);
    expect(empty.averageScore).toBe(0);
    expect(empty.dominantLabel).toBe('neutral');
    expect(empty.topPositive).toEqual([]);
    expect(empty.topNegative).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

describe('Sidebar', () => {
  it('5. shows AI Sentiment link with expected path and label', () => {
    const sentimentItem = NAV_ITEMS.find(item => item.label === 'AI Sentiment');
    expect(sentimentItem).toBeDefined();
    expect(sentimentItem!.href).toBe('/dashboard/sentiment');
    expect(sentimentItem!.active).toBe(true);
    // test-id is auto-generated as `nav-${label.toLowerCase().replace(/\s+/g, '-')}`
    // For 'AI Sentiment' → 'nav-ai-sentiment'
  });
});
