// ---------------------------------------------------------------------------
// src/__tests__/unit/response-generator.test.ts
//
// Sprint 107: Tests for the response generator pure functions.
// LLM calls are NOT tested here — only prompt building and validation.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  buildResponseSystemPrompt,
  buildResponseUserMessage,
  validateResponseDraft,
  RESPONSE_GENERATION_LIMITS,
} from '@/lib/review-engine/response-generator';
import {
  MOCK_BRAND_VOICE,
  MOCK_POSITIVE_REVIEW,
  MOCK_NEGATIVE_REVIEW,
  MOCK_POSITIVE_SENTIMENT,
  MOCK_NEGATIVE_SENTIMENT,
  MOCK_GROUND_TRUTH,
} from '@/__fixtures__/golden-tenant';

describe('buildResponseSystemPrompt', () => {
  it('includes business name in the prompt', () => {
    const prompt = buildResponseSystemPrompt(MOCK_GROUND_TRUTH, MOCK_BRAND_VOICE, MOCK_POSITIVE_SENTIMENT);
    expect(prompt).toContain('Charcoal N Chill');
  });

  it('includes brand voice tone', () => {
    const prompt = buildResponseSystemPrompt(MOCK_GROUND_TRUTH, MOCK_BRAND_VOICE, MOCK_POSITIVE_SENTIMENT);
    expect(prompt).toContain('warm');
  });

  it('includes emoji instructions when use_emojis is true', () => {
    const prompt = buildResponseSystemPrompt(MOCK_GROUND_TRUTH, MOCK_BRAND_VOICE, MOCK_POSITIVE_SENTIMENT);
    expect(prompt).toContain('emoji');
  });

  it('includes sign-off in the prompt', () => {
    const prompt = buildResponseSystemPrompt(MOCK_GROUND_TRUTH, MOCK_BRAND_VOICE, MOCK_POSITIVE_SENTIMENT);
    expect(prompt).toContain(MOCK_BRAND_VOICE.sign_off);
  });

  it('includes highlight keywords as SEO instruction', () => {
    const prompt = buildResponseSystemPrompt(MOCK_GROUND_TRUTH, MOCK_BRAND_VOICE, MOCK_POSITIVE_SENTIMENT);
    expect(prompt).toContain('premium hookah');
    expect(prompt).toContain('Indo-American fusion');
  });

  it('includes avoid phrases', () => {
    const prompt = buildResponseSystemPrompt(MOCK_GROUND_TRUTH, MOCK_BRAND_VOICE, MOCK_POSITIVE_SENTIMENT);
    expect(prompt).toContain('unfortunately');
  });

  it('includes negative review instructions for low sentiment', () => {
    const prompt = buildResponseSystemPrompt(MOCK_GROUND_TRUTH, MOCK_BRAND_VOICE, MOCK_NEGATIVE_SENTIMENT);
    expect(prompt).toContain('negative review');
    expect(prompt).toContain('acknowledge');
  });

  it('includes owner name sign-off for negative reviews', () => {
    const prompt = buildResponseSystemPrompt(MOCK_GROUND_TRUTH, MOCK_BRAND_VOICE, MOCK_NEGATIVE_SENTIMENT);
    expect(prompt).toContain('Aruna');
  });

  it('includes 50-150 word length constraint', () => {
    const prompt = buildResponseSystemPrompt(MOCK_GROUND_TRUTH, MOCK_BRAND_VOICE, MOCK_POSITIVE_SENTIMENT);
    expect(prompt).toContain('50-150 words');
  });
});

describe('buildResponseUserMessage', () => {
  it('includes reviewer name', () => {
    const message = buildResponseUserMessage(MOCK_POSITIVE_REVIEW, MOCK_POSITIVE_SENTIMENT);
    expect(message).toContain('Marcus J.');
  });

  it('includes rating', () => {
    const message = buildResponseUserMessage(MOCK_POSITIVE_REVIEW, MOCK_POSITIVE_SENTIMENT);
    expect(message).toContain('5/5');
  });

  it('includes sentiment label', () => {
    const message = buildResponseUserMessage(MOCK_NEGATIVE_REVIEW, MOCK_NEGATIVE_SENTIMENT);
    expect(message).toContain('negative');
  });

  it('includes review text', () => {
    const message = buildResponseUserMessage(MOCK_POSITIVE_REVIEW, MOCK_POSITIVE_SENTIMENT);
    expect(message).toContain('Best hookah lounge');
  });

  it('includes keywords from sentiment', () => {
    const message = buildResponseUserMessage(MOCK_POSITIVE_REVIEW, MOCK_POSITIVE_SENTIMENT);
    expect(message).toContain('best hookah');
  });
});

describe('validateResponseDraft', () => {
  const validDraft = 'Thank you so much for your wonderful review, Marcus! We are thrilled that you enjoyed the hookah and the belly dancing show. Our team always strives to provide the best experience for our guests. We look forward to welcoming you back soon!';

  it('marks a valid response as valid', () => {
    const result = validateResponseDraft(validDraft, MOCK_BRAND_VOICE);
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('flags too short responses', () => {
    const result = validateResponseDraft('Thanks!', MOCK_BRAND_VOICE);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('too short'))).toBe(true);
  });

  it('flags too long responses', () => {
    const longText = Array(250).fill('word').join(' ');
    const result = validateResponseDraft(longText, MOCK_BRAND_VOICE);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('too long'))).toBe(true);
  });

  it('flags forbidden phrases', () => {
    const draftWithForbidden = 'Unfortunately, we had issues that night. We apologize for any inconvenience caused to you and your group.';
    const result = validateResponseDraft(draftWithForbidden, MOCK_BRAND_VOICE);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('forbidden phrase'))).toBe(true);
  });
});

describe('RESPONSE_GENERATION_LIMITS', () => {
  it('has limits for all plan tiers', () => {
    expect(RESPONSE_GENERATION_LIMITS.trial).toBe(5);
    expect(RESPONSE_GENERATION_LIMITS.starter).toBe(25);
    expect(RESPONSE_GENERATION_LIMITS.growth).toBe(100);
    expect(RESPONSE_GENERATION_LIMITS.agency).toBe(500);
  });

  it('agency limit is highest', () => {
    expect(RESPONSE_GENERATION_LIMITS.agency).toBeGreaterThan(RESPONSE_GENERATION_LIMITS.growth);
    expect(RESPONSE_GENERATION_LIMITS.growth).toBeGreaterThan(RESPONSE_GENERATION_LIMITS.starter);
    expect(RESPONSE_GENERATION_LIMITS.starter).toBeGreaterThan(RESPONSE_GENERATION_LIMITS.trial);
  });
});
