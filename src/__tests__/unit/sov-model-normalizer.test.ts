/**
 * Sprint 123 — sov-model-normalizer unit tests
 * Tests the pure detectCitation() function used by multi-model SOV.
 * AI_RULES §154.
 */

import { describe, it, expect } from 'vitest';
import { detectCitation } from '@/lib/services/sov-model-normalizer';

describe('detectCitation — pure function', () => {
  const ORG_NAME = 'Charcoal N Chill';

  it('cited=true when orgName appears verbatim (case-insensitive)', () => {
    const result = detectCitation(
      'charcoal n chill is a great hookah lounge in Alpharetta.',
      ORG_NAME,
    );
    expect(result.cited).toBe(true);
    expect(result.confidence).toBe('high');
  });

  it('cited=false when orgName absent from response', () => {
    const result = detectCitation(
      'There are many great restaurants in Alpharetta including Dreamland BBQ.',
      ORG_NAME,
    );
    expect(result.cited).toBe(false);
    expect(result.citation_count).toBe(0);
  });

  it('citation_count correctly counts occurrences', () => {
    const result = detectCitation(
      'Charcoal N Chill is popular. Many people love Charcoal N Chill for hookah. Visit Charcoal N Chill today.',
      ORG_NAME,
    );
    expect(result.cited).toBe(true);
    expect(result.citation_count).toBe(3);
  });

  it("confidence='high' for exact match", () => {
    const result = detectCitation(
      'I recommend Charcoal N Chill in Alpharetta.',
      ORG_NAME,
    );
    expect(result.confidence).toBe('high');
  });

  it("confidence='medium' for near-match (punctuation variation)", () => {
    const result = detectCitation(
      'Charcoal and Chill is a great place to visit.',
      ORG_NAME,
    );
    // "Charcoal N Chill" normalizes to "charcoal and chill" matching "charcoal and chill"
    expect(result.cited).toBe(true);
    expect(result.confidence).toBe('medium');
  });

  it("confidence='low' when no match found", () => {
    const result = detectCitation(
      'Visit Cloud 9 Lounge for a premium experience.',
      ORG_NAME,
    );
    expect(result.confidence).toBe('low');
    expect(result.cited).toBe(false);
  });

  it('ai_response_excerpt truncated to 1000 chars', () => {
    const longResponse = 'A'.repeat(2000);
    const result = detectCitation(longResponse, ORG_NAME);
    expect(result.ai_response_excerpt.length).toBe(1000);
  });

  it('handles empty response gracefully', () => {
    const result = detectCitation('', ORG_NAME);
    expect(result.cited).toBe(false);
    expect(result.citation_count).toBe(0);
  });

  it('handles null response', () => {
    const result = detectCitation(null, ORG_NAME);
    expect(result.cited).toBe(false);
    expect(result.citation_count).toBe(0);
    expect(result.confidence).toBe('low');
  });

  it('strips punctuation from orgName for matching ("N" vs "&")', () => {
    // "Charcoal & Chill" should match "Charcoal N Chill"
    const result = detectCitation(
      'Charcoal & Chill has amazing hookah.',
      ORG_NAME,
    );
    expect(result.cited).toBe(true);
  });

  it('does not false-positive on partial name overlap', () => {
    // "Charcoal Grill" should NOT match "Charcoal N Chill"
    const result = detectCitation(
      'Charcoal Grill is a popular BBQ spot.',
      ORG_NAME,
    );
    expect(result.cited).toBe(false);
  });

  it('multiple occurrences in one sentence counted correctly', () => {
    const result = detectCitation(
      'Charcoal N Chill and Charcoal N Chill are great.',
      ORG_NAME,
    );
    expect(result.citation_count).toBe(2);
  });

  it('case variations all count', () => {
    const result = detectCitation(
      'CHARCOAL N CHILL is popular. charcoal n chill is great. Charcoal N Chill is top.',
      ORG_NAME,
    );
    expect(result.cited).toBe(true);
    expect(result.citation_count).toBe(3);
  });

  it('cited=false when only similar (not same) business name appears', () => {
    const result = detectCitation(
      'Charcoal House is a BBQ joint. Chill Vibes Lounge is another option.',
      ORG_NAME,
    );
    expect(result.cited).toBe(false);
  });
});
