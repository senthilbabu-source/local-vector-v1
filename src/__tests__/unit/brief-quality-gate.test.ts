// ---------------------------------------------------------------------------
// brief-quality-gate.test.ts — Unit tests for content brief quality gate
//
// P8-FIX-34: 12 tests — thresholds, grade assignment, suggestions, edge cases.
//
// Run:
//   npx vitest run src/__tests__/unit/brief-quality-gate.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  assessBriefQuality,
  generateSuggestions,
  gradeFromScore,
  PUBLISH_READY_THRESHOLD,
  NEEDS_REVIEW_THRESHOLD,
} from '@/lib/content-brief/brief-quality-gate';
import type { ScoreContext } from '@/lib/autopilot/score-content';

// ---------------------------------------------------------------------------
// Test context
// ---------------------------------------------------------------------------

const CTX: ScoreContext = {
  businessName: 'Charcoal N Chill',
  city: 'Alpharetta',
  categories: ['Hookah Bar', 'Indian Restaurant'],
};

// High-quality content: mentions business name + city in first sentence,
// 200+ words, CTA, proper title
const HIGH_QUALITY_CONTENT = `Charcoal N Chill in Alpharetta, GA is the premier private event venue offering premium hookah service, Indo-American fusion dining, and luxurious Versace lounge seating for groups of up to 80 guests. Whether you're planning a birthday celebration, corporate gathering, or a special night out, our experienced team provides end-to-end event coordination.

Our unique combination of hookah culture and fusion cuisine sets us apart from any other venue in Alpharetta. The atmosphere is designed to create memorable experiences with custom lighting, premium sound systems, and comfortable seating arrangements that encourage conversation and connection.

Private event packages include full venue rental, customizable hookah and dining menus, AV equipment, and dedicated event staff. We accommodate groups ranging from intimate parties of 20 to larger celebrations of 80 guests.

Frequently Asked Questions:

Q: How many guests can you accommodate?
A: We host events for 20 to 80 guests in our main lounge area.

Q: Do you offer hookah at private events?
A: Yes, premium hookah service is included in all event packages.

Q: What cuisine do you serve?
A: We specialize in Indo-American fusion cuisine with customizable menus.

Reserve your private event at Charcoal N Chill today. Call us at (470) 546-4866 or visit our website to schedule a consultation.`;

const HIGH_QUALITY_TITLE = 'Private Events in Alpharetta | Charcoal N Chill';

// Medium-quality content: shorter, missing CTA
const MEDIUM_QUALITY_CONTENT = `Charcoal N Chill in Alpharetta offers private event hosting with hookah service and fusion dining. The venue features Versace lounge seating and can accommodate groups.

Our event packages include venue rental and customizable menus. The atmosphere creates memorable experiences for guests seeking unique dining and entertainment.

We serve Indo-American fusion cuisine that sets us apart from other restaurants in the area.`;

const MEDIUM_QUALITY_TITLE = 'Charcoal N Chill Events';

// Low-quality content: no business name in first sentence, very short
const LOW_QUALITY_CONTENT = `Welcome to our venue! Check out our amazing offerings. We have great food and drinks.`;

const LOW_QUALITY_TITLE = 'This Is An Extremely Long Title That Goes Way Beyond The Sixty Character Limit For SEO Purposes';

// ---------------------------------------------------------------------------
// assessBriefQuality
// ---------------------------------------------------------------------------

describe('assessBriefQuality', () => {
  it('returns publish_ready for high-quality content (score >= 75)', () => {
    const verdict = assessBriefQuality(HIGH_QUALITY_CONTENT, HIGH_QUALITY_TITLE, CTX);
    expect(verdict.grade).toBe('publish_ready');
    expect(verdict.score).toBeGreaterThanOrEqual(PUBLISH_READY_THRESHOLD);
  });

  it('returns needs_review for medium-quality content (50-74)', () => {
    const verdict = assessBriefQuality(MEDIUM_QUALITY_CONTENT, MEDIUM_QUALITY_TITLE, CTX);
    expect(verdict.grade).toBe('needs_review');
    expect(verdict.score).toBeGreaterThanOrEqual(NEEDS_REVIEW_THRESHOLD);
    expect(verdict.score).toBeLessThan(PUBLISH_READY_THRESHOLD);
  });

  it('returns low_quality for poor content (< 50)', () => {
    const verdict = assessBriefQuality(LOW_QUALITY_CONTENT, LOW_QUALITY_TITLE, CTX);
    expect(verdict.grade).toBe('low_quality');
    expect(verdict.score).toBeLessThan(NEEDS_REVIEW_THRESHOLD);
  });

  it('returns score 0 for empty content', () => {
    const verdict = assessBriefQuality('', 'Test Title', CTX);
    expect(verdict.score).toBe(0);
    expect(verdict.grade).toBe('low_quality');
  });

  it('includes suggestions for non-publish-ready content', () => {
    const verdict = assessBriefQuality(LOW_QUALITY_CONTENT, LOW_QUALITY_TITLE, CTX);
    expect(verdict.suggestions.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// gradeFromScore
// ---------------------------------------------------------------------------

describe('gradeFromScore', () => {
  it('returns publish_ready for score at threshold', () => {
    expect(gradeFromScore(75)).toBe('publish_ready');
  });

  it('returns needs_review for score between thresholds', () => {
    expect(gradeFromScore(60)).toBe('needs_review');
  });

  it('returns low_quality for score below lower threshold', () => {
    expect(gradeFromScore(30)).toBe('low_quality');
  });
});

// ---------------------------------------------------------------------------
// generateSuggestions
// ---------------------------------------------------------------------------

describe('generateSuggestions', () => {
  it('suggests adding business name when missing from first sentence', () => {
    const suggestions = generateSuggestions(40, LOW_QUALITY_CONTENT, 'Test Title', CTX);
    expect(suggestions.some((s) => s.includes('business name'))).toBe(true);
  });

  it('suggests lengthening when word count < 200', () => {
    const suggestions = generateSuggestions(40, LOW_QUALITY_CONTENT, 'Test Title', CTX);
    expect(suggestions.some((s) => s.includes('200 words'))).toBe(true);
  });

  it('suggests adding CTA when no action verbs found', () => {
    const noCTA = 'Charcoal N Chill in Alpharetta is a hookah lounge. It has food and drinks.';
    const suggestions = generateSuggestions(40, noCTA, 'Test Title', CTX);
    expect(suggestions.some((s) => s.includes('call-to-action'))).toBe(true);
  });

  it('suggests shortening title when > 60 chars', () => {
    const suggestions = generateSuggestions(40, MEDIUM_QUALITY_CONTENT, LOW_QUALITY_TITLE, CTX);
    expect(suggestions.some((s) => s.includes('60 characters'))).toBe(true);
  });

  it('suggests adding city reference when city absent', () => {
    const noCity = 'Our restaurant serves great food with excellent hookah service. We offer premium dining.';
    const suggestions = generateSuggestions(40, noCity, 'Test Title', CTX);
    expect(suggestions.some((s) => s.includes('city name'))).toBe(true);
  });

  it('returns empty suggestions for high-quality content', () => {
    const suggestions = generateSuggestions(80, HIGH_QUALITY_CONTENT, HIGH_QUALITY_TITLE, CTX);
    expect(suggestions).toEqual([]);
  });

  it('caps suggestions at 3', () => {
    const suggestions = generateSuggestions(10, LOW_QUALITY_CONTENT, LOW_QUALITY_TITLE, CTX);
    expect(suggestions.length).toBeLessThanOrEqual(3);
  });
});
