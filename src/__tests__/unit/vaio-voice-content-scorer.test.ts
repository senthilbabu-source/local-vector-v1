// ---------------------------------------------------------------------------
// vaio-voice-content-scorer.test.ts — Voice content scoring unit tests
//
// Sprint 109: VAIO — ~15 tests
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  scoreVoiceContent,
  countActionVerbs,
  avgSentenceWords,
  fleschKincaidGrade,
  containsMarkdown,
  containsRawUrls,
  ACTION_VERBS,
} from '@/lib/vaio/voice-content-scorer';

const BIZ = 'Charcoal N Chill';
const CITY = 'Alpharetta';

describe('scoreVoiceContent', () => {
  it('returns 0 score with critical issue for empty content', () => {
    const result = scoreVoiceContent('', BIZ, CITY, 'faq_page');
    expect(result.overall_score).toBe(0);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].type).toBe('no_direct_answer');
    expect(result.issues[0].severity).toBe('critical');
  });

  it('scores high for ideal voice content with business name and city early', () => {
    const content =
      'Charcoal N Chill is a hookah lounge in Alpharetta offering premium hookah. ' +
      'Visit us to enjoy Mediterranean small plates and craft cocktails. ' +
      'Book a reservation or call us to discover our private event space. ' +
      'Experience live music every Friday and Saturday night.';
    const result = scoreVoiceContent(content, BIZ, CITY, 'faq_page');
    expect(result.direct_answer_score).toBe(30);
    expect(result.local_specificity_score).toBe(25);
    expect(result.action_language_score).toBe(25); // book, enjoy, discover, visit, experience, call
    expect(result.overall_score).toBeGreaterThanOrEqual(80);
  });

  it('penalizes filler opening ("Welcome to...")', () => {
    const content = 'Welcome to our restaurant. We serve great food in Alpharetta.';
    const result = scoreVoiceContent(content, BIZ, CITY, 'faq_page');
    expect(result.direct_answer_score).toBe(0);
    expect(result.issues.some((i) => i.type === 'no_direct_answer')).toBe(true);
  });

  it('gives partial score for "We" opening without business name in first sentence', () => {
    const content = 'We serve the best hookah in town. Located in Alpharetta near Jones Bridge.';
    const result = scoreVoiceContent(content, BIZ, CITY, 'faq_page');
    expect(result.direct_answer_score).toBe(15);
  });

  it('detects missing business name with critical issue', () => {
    const content = 'A great hookah lounge in Alpharetta with live music and private events.';
    const result = scoreVoiceContent(content, BIZ, CITY, 'faq_page');
    expect(result.issues.some((i) => i.type === 'no_business_name')).toBe(true);
  });

  it('detects missing city mention with warning issue', () => {
    const content = 'Charcoal N Chill offers premium hookah and Mediterranean cuisine.';
    const result = scoreVoiceContent(content, BIZ, CITY, 'faq_page');
    expect(result.issues.some((i) => i.type === 'no_local_mention')).toBe(true);
  });

  it('gives full spoken_length_score for 50–200 word content', () => {
    const words = Array.from({ length: 100 }, () => 'word').join(' ');
    const content = `Charcoal N Chill in Alpharetta. ${words}`;
    const result = scoreVoiceContent(content, BIZ, CITY, 'faq_page');
    expect(result.spoken_length_score).toBe(20);
  });

  it('gives partial spoken_length_score for 201–300 word content', () => {
    const words = Array.from({ length: 250 }, () => 'word').join(' ');
    const content = `Charcoal N Chill in Alpharetta. ${words}`;
    const result = scoreVoiceContent(content, BIZ, CITY, 'faq_page');
    expect(result.spoken_length_score).toBe(10);
  });

  it('detects too-long content (>300 words)', () => {
    const words = Array.from({ length: 350 }, () => 'word').join(' ');
    const content = `Charcoal N Chill in Alpharetta. ${words}`;
    const result = scoreVoiceContent(content, BIZ, CITY, 'faq_page');
    expect(result.spoken_length_score).toBe(0);
    expect(result.issues.some((i) => i.type === 'too_long')).toBe(true);
  });

  it('detects markdown in content', () => {
    const content = '**Charcoal N Chill** in Alpharetta offers hookah.';
    const result = scoreVoiceContent(content, BIZ, CITY, 'faq_page');
    expect(result.issues.some((i) => i.type === 'contains_markdown')).toBe(true);
  });

  it('detects raw URLs in content', () => {
    const content =
      'Charcoal N Chill in Alpharetta. Visit https://charcoalnchill.com for details.';
    const result = scoreVoiceContent(content, BIZ, CITY, 'faq_page');
    expect(result.issues.some((i) => i.type === 'contains_urls')).toBe(true);
  });
});

describe('countActionVerbs', () => {
  it('counts distinct action verbs', () => {
    expect(countActionVerbs('Book a table and enjoy the experience.')).toBe(3); // book, enjoy, experience
  });

  it('returns 0 for text without action verbs', () => {
    expect(countActionVerbs('The weather is nice today.')).toBe(0);
  });

  it('is case-insensitive', () => {
    expect(countActionVerbs('VISIT us and DISCOVER great food.')).toBe(2);
  });
});

describe('avgSentenceWords', () => {
  it('calculates average words per sentence', () => {
    const text = 'This is short. This is also a sentence.';
    const avg = avgSentenceWords(text);
    expect(avg).toBeCloseTo(4, 0);
  });

  it('handles abbreviations correctly', () => {
    const text = 'Dr. Smith visited us. Mr. Jones came too.';
    const avg = avgSentenceWords(text);
    // Should treat "Dr." and "Mr." as abbreviations, not sentence endings
    expect(avg).toBeGreaterThan(2);
  });

  it('returns 0 for empty text', () => {
    expect(avgSentenceWords('')).toBe(0);
  });
});

describe('fleschKincaidGrade', () => {
  it('returns 0 for empty text', () => {
    expect(fleschKincaidGrade('')).toBe(0);
  });

  it('returns low grade for simple text', () => {
    const simple = 'The cat sat on the mat. The dog ran in the park. The sun is hot.';
    expect(fleschKincaidGrade(simple)).toBeLessThan(6);
  });

  it('returns higher grade for complex text', () => {
    const complex =
      'The extraordinary juxtaposition of Mediterranean culinary traditions ' +
      'with contemporary hospitality paradigms exemplifies sophisticated gastronomy.';
    expect(fleschKincaidGrade(complex)).toBeGreaterThan(10);
  });
});

describe('containsMarkdown', () => {
  it('detects bold markers', () => {
    expect(containsMarkdown('**bold text** here')).toBe(true);
  });

  it('detects heading markers', () => {
    expect(containsMarkdown('## Heading\nSome text')).toBe(true);
  });

  it('detects bullet lists', () => {
    expect(containsMarkdown('- item one\n- item two')).toBe(true);
  });

  it('returns false for plain text', () => {
    expect(containsMarkdown('Just a simple sentence.')).toBe(false);
  });
});

describe('containsRawUrls', () => {
  it('detects http URLs', () => {
    expect(containsRawUrls('Visit http://example.com')).toBe(true);
  });

  it('detects https URLs', () => {
    expect(containsRawUrls('Visit https://example.com/page')).toBe(true);
  });

  it('returns false for text without URLs', () => {
    expect(containsRawUrls('Visit our website for details.')).toBe(false);
  });
});

describe('ACTION_VERBS', () => {
  it('contains expected verbs', () => {
    expect(ACTION_VERBS).toContain('book');
    expect(ACTION_VERBS).toContain('visit');
    expect(ACTION_VERBS).toContain('discover');
    expect(ACTION_VERBS).toContain('reserve');
  });

  it('has at least 15 verbs', () => {
    expect(ACTION_VERBS.length).toBeGreaterThanOrEqual(15);
  });
});
