// ---------------------------------------------------------------------------
// src/__tests__/unit/brand-voice-profiler.test.ts
//
// Sprint 107: Tests for the brand voice profiler.
// Tests pure functions (getDefaultBrandVoice, inferHighlightKeywords).
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  getDefaultBrandVoice,
  inferHighlightKeywords,
} from '@/lib/review-engine/brand-voice-profiler';
import { GOLDEN_TENANT } from '@/__fixtures__/golden-tenant';

describe('getDefaultBrandVoice', () => {
  it('returns warm tone as default', () => {
    const voice = getDefaultBrandVoice('Charcoal N Chill');
    expect(voice.tone).toBe('warm');
  });

  it('returns semi-formal formality as default', () => {
    const voice = getDefaultBrandVoice('Charcoal N Chill');
    expect(voice.formality).toBe('semi-formal');
  });

  it('disables emojis by default', () => {
    const voice = getDefaultBrandVoice('Charcoal N Chill');
    expect(voice.use_emojis).toBe(false);
  });

  it('includes business name in sign-off', () => {
    const voice = getDefaultBrandVoice('Charcoal N Chill');
    expect(voice.sign_off).toContain('Charcoal N Chill');
  });

  it('sets derived_from to website_copy', () => {
    const voice = getDefaultBrandVoice('Test Biz');
    expect(voice.derived_from).toBe('website_copy');
  });

  it('includes standard avoid phrases', () => {
    const voice = getDefaultBrandVoice('Test Biz');
    expect(voice.avoid_phrases).toContain('unfortunately');
    expect(voice.avoid_phrases).toContain('sadly');
  });
});

describe('inferHighlightKeywords', () => {
  it('infers hookah keyword for Hookah Bar category', () => {
    const keywords = inferHighlightKeywords('Hookah Bar', null, 'Test');
    expect(keywords).toContain('premium hookah');
  });

  it('infers fusion cuisine for Fusion Restaurant category', () => {
    const keywords = inferHighlightKeywords('Fusion Restaurant', null, 'Test');
    expect(keywords).toContain('fusion cuisine');
  });

  it('infers lounge experience for Lounge category', () => {
    const keywords = inferHighlightKeywords('Lounge', null, 'Test');
    expect(keywords).toContain('lounge experience');
  });

  it('infers keywords from amenities', () => {
    const amenities = GOLDEN_TENANT.location.amenities as unknown as Record<string, boolean>;
    const keywords = inferHighlightKeywords(null, amenities, 'Charcoal N Chill');
    expect(keywords.some((k) => k.includes('hookah') || k.includes('entertainment'))).toBe(true);
  });

  it('deduplicates keywords', () => {
    const keywords = inferHighlightKeywords('Hookah Bar', { has_hookah: true }, 'Test');
    const unique = new Set(keywords);
    expect(unique.size).toBe(keywords.length);
  });

  it('returns max 8 keywords', () => {
    const amenities = {
      has_hookah: true,
      has_live_music: true,
      has_dj: true,
      serves_alcohol: true,
      has_outdoor_seating: true,
      has_private_rooms: true,
    };
    const keywords = inferHighlightKeywords('Hookah Bar Indian Restaurant Lounge', amenities, 'Test');
    expect(keywords.length).toBeLessThanOrEqual(8);
  });

  it('returns empty array for null category and null amenities', () => {
    const keywords = inferHighlightKeywords(null, null, 'Test');
    expect(keywords).toEqual([]);
  });
});
