// ---------------------------------------------------------------------------
// vaio-spoken-answer-previewer.test.ts — Spoken answer preview unit tests
//
// Sprint 109: VAIO — ~10 tests
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  generateSpokenPreview,
  cleanForVoice,
  estimateSpokenSeconds,
  VOICE_IDEAL_MIN_WORDS,
  VOICE_IDEAL_MAX_WORDS,
  VOICE_ACCEPTABLE_MAX_WORDS,
  VOICE_TTS_WPM,
} from '@/lib/vaio/spoken-answer-previewer';

const BIZ = 'Charcoal N Chill';
const CITY = 'Alpharetta';

describe('cleanForVoice', () => {
  it('strips HTML tags', () => {
    const result = cleanForVoice('<p>Hello <strong>world</strong></p>');
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
    expect(result).toContain('Hello');
  });

  it('strips markdown bold markers', () => {
    const result = cleanForVoice('**Bold text** and *italic*');
    expect(result).not.toContain('**');
    expect(result).not.toContain('*');
    expect(result).toContain('Bold text');
    expect(result).toContain('italic');
  });

  it('strips heading markers', () => {
    const result = cleanForVoice('## Heading\nSome text');
    expect(result).not.toContain('##');
    expect(result).toContain('Heading');
  });

  it('replaces raw URLs with [link]', () => {
    const result = cleanForVoice('Visit https://charcoalnchill.com for more.');
    expect(result).not.toContain('https://');
    expect(result).toContain('[link]');
  });

  it('replaces email addresses with [email]', () => {
    const result = cleanForVoice('Contact info@charcoalnchill.com for bookings.');
    expect(result).not.toContain('@');
    expect(result).toContain('[email]');
  });

  it('normalizes whitespace and newlines', () => {
    const result = cleanForVoice('Line one.\n\n\nLine   two.\n');
    expect(result).not.toContain('\n');
    expect(result).not.toMatch(/\s{2,}/);
  });

  it('truncates at 250 words with ellipsis', () => {
    const longText = Array.from({ length: 300 }, (_, i) => `word${i}`).join(' ');
    const result = cleanForVoice(longText);
    const wordCount = result.split(/\s+/).filter(Boolean).length;
    // Truncated text has 250 words + trailing "..."
    expect(wordCount).toBeLessThanOrEqual(251);
    expect(result.endsWith('...')).toBe(true);
  });

  it('converts bullet lists to prose with commas and "and"', () => {
    const input = 'Features:\n- Outdoor seating\n- Live music\n- Private rooms';
    const result = cleanForVoice(input);
    expect(result).toContain('and');
    // Should not contain bullet markers
    expect(result).not.toContain('- ');
  });
});

describe('estimateSpokenSeconds', () => {
  it('estimates 60 seconds for 150 words (TTS_WPM)', () => {
    expect(estimateSpokenSeconds(150)).toBe(60);
  });

  it('estimates 30 seconds for 75 words', () => {
    expect(estimateSpokenSeconds(75)).toBe(30);
  });

  it('returns 0 for 0 words', () => {
    expect(estimateSpokenSeconds(0)).toBe(0);
  });
});

describe('generateSpokenPreview', () => {
  it('returns voice-ready true for ideal-length clean content', () => {
    // Build content with 100 words, natural sentences
    const sentences = [
      `${BIZ} is a premium hookah lounge and Mediterranean restaurant in ${CITY}.`,
      'We offer over thirty specialty hookah flavors and a curated menu of small plates.',
      'Our location features outdoor seating, live music on weekends, and private event rooms.',
      'Visit us at Jones Bridge Road for a relaxing evening with friends and family.',
      'Book a reservation by calling us or using our online booking system.',
      'Our craft cocktail menu pairs perfectly with our signature hookah blends.',
      'Experience the best nightlife in the area with our weekend entertainment.',
      'Join us for dinner and hookah any night of the week.',
    ];
    const content = sentences.join(' ');
    const preview = generateSpokenPreview(content, BIZ, CITY, 'faq_page');

    expect(preview.word_count).toBeGreaterThan(0);
    expect(preview.estimated_spoken_seconds).toBeGreaterThan(0);
    expect(preview.cleaned_content).not.toContain('<');
    expect(preview.reading_grade_level).toBeGreaterThanOrEqual(0);
  });

  it('flags content below minimum word count', () => {
    const content = `${BIZ} in ${CITY}. Open daily.`;
    const preview = generateSpokenPreview(content, BIZ, CITY, 'faq_page');
    expect(preview.word_count).toBeLessThan(VOICE_IDEAL_MIN_WORDS);
    // Should have an issue about being too short
    expect(preview.issues.some((i) => i.description.includes('brief'))).toBe(true);
  });
});

describe('constants', () => {
  it('has expected values', () => {
    expect(VOICE_IDEAL_MIN_WORDS).toBe(75);
    expect(VOICE_IDEAL_MAX_WORDS).toBe(150);
    expect(VOICE_ACCEPTABLE_MAX_WORDS).toBe(250);
    expect(VOICE_TTS_WPM).toBe(150);
  });
});
