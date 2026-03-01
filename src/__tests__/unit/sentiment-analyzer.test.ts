// ---------------------------------------------------------------------------
// src/__tests__/unit/sentiment-analyzer.test.ts
//
// Sprint 107: Tests for the rule-based sentiment analyzer.
// Pure function tests — zero mocks.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  analyzeSentiment,
  extractKeywords,
  classifyTopic,
  batchAnalyzeSentiment,
} from '@/lib/review-engine/sentiment-analyzer';
import {
  MOCK_POSITIVE_REVIEW,
  MOCK_NEGATIVE_REVIEW,
  MOCK_YELP_REVIEW,
} from '@/__fixtures__/golden-tenant';
import type { Review } from '@/lib/review-engine/types';

function makeReview(overrides: Partial<Review> = {}): Review {
  return {
    id: 'test-review',
    platform: 'google',
    location_id: 'loc-1',
    org_id: 'org-1',
    reviewer_name: 'Test User',
    rating: 3,
    text: 'An average experience overall.',
    published_at: '2026-03-01T00:00:00Z',
    ...overrides,
  };
}

describe('analyzeSentiment', () => {
  it('classifies 5-star review as positive with high rating band', () => {
    const result = analyzeSentiment(makeReview({ rating: 5, text: 'Amazing place, loved it!' }));
    expect(result.label).toBe('positive');
    expect(result.rating_band).toBe('high');
  });

  it('classifies 3-star review as neutral with mid rating band', () => {
    const result = analyzeSentiment(makeReview({ rating: 3, text: 'It was okay, nothing special.' }));
    expect(result.label).toBe('neutral');
    expect(result.rating_band).toBe('mid');
  });

  it('classifies 1-star review as negative with low rating band', () => {
    const result = analyzeSentiment(makeReview({ rating: 1, text: 'Terrible experience, very rude staff.' }));
    expect(result.label).toBe('negative');
    expect(result.rating_band).toBe('low');
  });

  it('classifies 2-star review as negative with low rating band', () => {
    const result = analyzeSentiment(makeReview({ rating: 2, text: 'Bad service and overpriced food.' }));
    expect(result.label).toBe('negative');
    expect(result.rating_band).toBe('low');
  });

  it('overrides 4-star rating to neutral when text has strong negative signals', () => {
    const result = analyzeSentiment(makeReview({
      rating: 4,
      text: 'The slow service ruined the night. Rude staff and bad service. Would not come back.',
    }));
    expect(result.label).toBe('neutral');
  });

  it('keeps positive for 5-star with empty text (rating wins)', () => {
    const result = analyzeSentiment(makeReview({ rating: 5, text: '' }));
    expect(result.label).toBe('positive');
    expect(result.rating_band).toBe('high');
  });

  it('classifies MOCK_POSITIVE_REVIEW as positive', () => {
    const result = analyzeSentiment(MOCK_POSITIVE_REVIEW);
    expect(result.label).toBe('positive');
    expect(result.rating_band).toBe('high');
    expect(result.keywords.length).toBeGreaterThan(0);
  });

  it('classifies MOCK_NEGATIVE_REVIEW as negative', () => {
    const result = analyzeSentiment(MOCK_NEGATIVE_REVIEW);
    expect(result.label).toBe('negative');
    expect(result.rating_band).toBe('low');
    expect(result.score).toBeLessThan(0);
  });

  it('positive keywords in text boost sentiment score', () => {
    const plain = analyzeSentiment(makeReview({ rating: 4, text: 'Went there last night.' }));
    const boosted = analyzeSentiment(makeReview({ rating: 4, text: 'Great service and delicious food. Friendly staff too.' }));
    expect(boosted.score).toBeGreaterThanOrEqual(plain.score);
  });

  it('negative keywords in text reduce sentiment score', () => {
    const plain = analyzeSentiment(makeReview({ rating: 3, text: 'Went there last night.' }));
    const reduced = analyzeSentiment(makeReview({ rating: 3, text: 'Slow service and overpriced food. Bad taste overall.' }));
    expect(reduced.score).toBeLessThanOrEqual(plain.score);
  });

  it('rating=5 with no text modifiers yields score 1.0', () => {
    const result = analyzeSentiment(makeReview({ rating: 5, text: '' }));
    expect(result.score).toBe(1.0);
  });

  it('classifies 4-star Yelp review as positive', () => {
    const result = analyzeSentiment(MOCK_YELP_REVIEW);
    expect(result.label).toBe('positive');
    expect(result.rating_band).toBe('high');
  });

  it('extracts topics from review text', () => {
    const result = analyzeSentiment(MOCK_POSITIVE_REVIEW);
    expect(result.topics.length).toBeGreaterThan(0);
    const categories = result.topics.map((t) => t.category);
    expect(categories).toContain('hookah');
  });
});

describe('extractKeywords', () => {
  it('extracts "best hookah" from review text', () => {
    const keywords = extractKeywords('The best hookah lounge in Alpharetta!');
    expect(keywords).toContain('best hookah');
  });

  it('extracts "friendly staff" from review text containing "super friendly"', () => {
    const keywords = extractKeywords('Staff was super friendly and welcoming');
    const hasFriendly = keywords.some((k) => k.includes('friendly'));
    expect(hasFriendly).toBe(true);
  });

  it('extracts negative service keywords from negative review', () => {
    const keywords = extractKeywords('The service was really slow and we waited forever');
    // "waited forever" is a known negative keyword that appears literally
    expect(keywords).toContain('waited forever');
  });

  it('normalizes to lowercase', () => {
    const keywords = extractKeywords('GREAT SERVICE and FRIENDLY STAFF helped us');
    for (const kw of keywords) {
      expect(kw).toBe(kw.toLowerCase());
    }
  });

  it('returns empty array for very short text', () => {
    expect(extractKeywords('Good')).toEqual([]);
    expect(extractKeywords('')).toEqual([]);
  });

  it('returns max 5 keywords', () => {
    const text = 'Best hookah, great service, delicious food, amazing vibe, friendly staff, clean, excellent service, belly dancing show was incredible';
    const keywords = extractKeywords(text);
    expect(keywords.length).toBeLessThanOrEqual(5);
  });
});

describe('classifyTopic', () => {
  it('classifies "hookah" keywords into hookah category', () => {
    expect(classifyTopic('best hookah')).toBe('hookah');
    expect(classifyTopic('premium hookah')).toBe('hookah');
  });

  it('classifies "slow service" into service category', () => {
    expect(classifyTopic('slow service')).toBe('service');
  });

  it('classifies "belly dancing" into events category', () => {
    expect(classifyTopic('belly dancing')).toBe('events');
  });

  it('classifies "delicious" into food category', () => {
    expect(classifyTopic('delicious')).toBe('food');
  });

  it('returns "other" for unrecognized keywords', () => {
    expect(classifyTopic('parking lot')).toBe('other');
  });
});

describe('batchAnalyzeSentiment', () => {
  it('returns results for all reviews', () => {
    const reviews = [MOCK_POSITIVE_REVIEW, MOCK_NEGATIVE_REVIEW, MOCK_YELP_REVIEW];
    const results = batchAnalyzeSentiment(reviews);
    expect(results.size).toBe(3);
    expect(results.get(MOCK_POSITIVE_REVIEW.id)?.label).toBe('positive');
    expect(results.get(MOCK_NEGATIVE_REVIEW.id)?.label).toBe('negative');
  });

  it('handles empty array', () => {
    const results = batchAnalyzeSentiment([]);
    expect(results.size).toBe(0);
  });
});
