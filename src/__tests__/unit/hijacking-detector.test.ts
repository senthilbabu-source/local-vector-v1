// ---------------------------------------------------------------------------
// src/__tests__/unit/hijacking-detector.test.ts — P8-FIX-37
//
// Pure function tests for the hijacking detection algorithm.
// No mocks needed — all functions are pure.
// AI_RULES §193.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  detectHijacking,
  detectCompetitorCitation,
  detectAddressMix,
  detectAttributeConfusion,
  classifySeverity,
  extractCompetitorName,
  type DetectionInput,
  type SOVResultInput,
} from '@/lib/hijack/hijacking-detector';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_INPUT: Omit<DetectionInput, 'sovResults'> = {
  orgId: 'org-1',
  locationId: 'loc-1',
  businessName: 'Charcoal N Chill',
  businessAddress: '11950 Jones Bridge Rd',
  city: 'Alpharetta',
  state: 'GA',
};

function makeSovResult(overrides: Partial<SOVResultInput> = {}): SOVResultInput {
  return {
    engine: 'perplexity_sonar',
    queryText: 'hookah lounge Alpharetta',
    aiResponse: 'Charcoal N Chill is a hookah lounge in Alpharetta.',
    cited: true,
    mentionedCompetitors: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// classifySeverity
// ---------------------------------------------------------------------------

describe('classifySeverity', () => {
  it('address_mix → critical', () => {
    expect(classifySeverity('address_mix')).toBe('critical');
  });

  it('competitor_citation → high', () => {
    expect(classifySeverity('competitor_citation')).toBe('high');
  });

  it('attribute_confusion → medium', () => {
    expect(classifySeverity('attribute_confusion')).toBe('medium');
  });
});

// ---------------------------------------------------------------------------
// detectCompetitorCitation
// ---------------------------------------------------------------------------

describe('detectCompetitorCitation', () => {
  it('returns null when business IS cited', () => {
    expect(detectCompetitorCitation(['Atlanta Smoke House'], true)).toBeNull();
  });

  it('returns null when no competitors listed', () => {
    expect(detectCompetitorCitation([], false)).toBeNull();
  });

  it('returns first competitor name when not cited and competitors present', () => {
    expect(detectCompetitorCitation(['Atlanta Smoke House', 'Cloud 9'], false)).toBe('Atlanta Smoke House');
  });
});

// ---------------------------------------------------------------------------
// detectAddressMix
// ---------------------------------------------------------------------------

describe('detectAddressMix', () => {
  it('returns false when correct address is in response', () => {
    const response = 'Located at 11950 Jones Bridge Rd in Alpharetta.';
    expect(detectAddressMix(response, '11950 Jones Bridge Rd')).toBe(false);
  });

  it('returns true when a different address appears in response', () => {
    const response = 'Located at 555 Roswell St in the heart of downtown.';
    expect(detectAddressMix(response, '11950 Jones Bridge Rd')).toBe(true);
  });

  it('returns false when no address in response', () => {
    const response = 'Charcoal N Chill is a great hookah lounge.';
    expect(detectAddressMix(response, '11950 Jones Bridge Rd')).toBe(false);
  });

  it('returns false when businessAddress is empty', () => {
    expect(detectAddressMix('Located at 123 Main St.', '')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// detectAttributeConfusion
// ---------------------------------------------------------------------------

describe('detectAttributeConfusion', () => {
  it('returns null when no competitors mentioned', () => {
    expect(detectAttributeConfusion(
      'Charcoal N Chill has great hookah.',
      'Charcoal N Chill',
      [],
    )).toBeNull();
  });

  it('returns null when business name not in response', () => {
    expect(detectAttributeConfusion(
      'Atlanta Smoke House serves food.',
      'Charcoal N Chill',
      ['Atlanta Smoke House'],
    )).toBeNull();
  });

  it('detects confusion when both business and competitor appear in response', () => {
    const response = 'Charcoal N Chill, similar to Atlanta Smoke House, offers premium hookah in a lounge setting.';
    const result = detectAttributeConfusion(response, 'Charcoal N Chill', ['Atlanta Smoke House']);
    expect(result).not.toBeNull();
    expect(result!.competitor).toBe('Atlanta Smoke House');
    expect(result!.evidence).toContain('Atlanta Smoke House');
  });

  it('skips competitors with very short names (< 3 chars)', () => {
    const result = detectAttributeConfusion(
      'Charcoal N Chill is great. Go there!',
      'Charcoal N Chill',
      ['Go'],
    );
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// extractCompetitorName
// ---------------------------------------------------------------------------

describe('extractCompetitorName', () => {
  it('returns matching competitor from text', () => {
    expect(extractCompetitorName(
      'Atlanta Smoke House has great reviews',
      ['Cloud 9', 'Atlanta Smoke House'],
    )).toBe('Atlanta Smoke House');
  });

  it('falls back to first competitor when no match in text', () => {
    expect(extractCompetitorName(
      'No competitor names here',
      ['Cloud 9', 'Atlanta Smoke House'],
    )).toBe('Cloud 9');
  });

  it('returns fallback string for empty competitors', () => {
    expect(extractCompetitorName('some text', [])).toBe('Unknown competitor');
  });
});

// ---------------------------------------------------------------------------
// detectHijacking (orchestrator)
// ---------------------------------------------------------------------------

describe('detectHijacking', () => {
  it('returns empty array when no SOV results', () => {
    const events = detectHijacking({ ...BASE_INPUT, sovResults: [] });
    expect(events).toEqual([]);
  });

  it('returns empty array when business is cited and no issues', () => {
    const events = detectHijacking({
      ...BASE_INPUT,
      sovResults: [makeSovResult({ cited: true, mentionedCompetitors: [] })],
    });
    expect(events).toEqual([]);
  });

  it('detects competitor_citation when not cited and competitors present', () => {
    const events = detectHijacking({
      ...BASE_INPUT,
      sovResults: [makeSovResult({
        cited: false,
        mentionedCompetitors: ['Atlanta Smoke House'],
        aiResponse: 'Atlanta Smoke House is the best hookah lounge in Alpharetta.',
      })],
    });
    expect(events).toHaveLength(1);
    expect(events[0].hijackType).toBe('competitor_citation');
    expect(events[0].competitorName).toBe('Atlanta Smoke House');
    expect(events[0].severity).toBe('high');
    expect(events[0].status).toBe('new');
  });

  it('detects address_mix when wrong address in response (cited, no competitors)', () => {
    const events = detectHijacking({
      ...BASE_INPUT,
      sovResults: [makeSovResult({
        cited: true,
        mentionedCompetitors: [],
        aiResponse: 'Charcoal N Chill is located at 555 Roswell St in Alpharetta.',
      })],
    });
    expect(events).toHaveLength(1);
    expect(events[0].hijackType).toBe('address_mix');
    expect(events[0].severity).toBe('critical');
  });

  it('detects attribute_confusion when competitor features attributed to business', () => {
    const events = detectHijacking({
      ...BASE_INPUT,
      sovResults: [makeSovResult({
        cited: true,
        mentionedCompetitors: ['Cloud Nine Lounge'],
        aiResponse: 'Charcoal N Chill, also known as Cloud Nine Lounge, serves premium hookah.',
      })],
    });
    expect(events).toHaveLength(1);
    expect(events[0].hijackType).toBe('attribute_confusion');
    expect(events[0].severity).toBe('medium');
    expect(events[0].competitorName).toBe('Cloud Nine Lounge');
  });

  it('returns multiple events for multiple SOV results with different issues', () => {
    const events = detectHijacking({
      ...BASE_INPUT,
      sovResults: [
        makeSovResult({
          cited: false,
          mentionedCompetitors: ['Atlanta Smoke House'],
          aiResponse: 'Try Atlanta Smoke House for hookah.',
        }),
        makeSovResult({
          engine: 'openai_gpt4o_mini',
          cited: true,
          mentionedCompetitors: [],
          aiResponse: 'Charcoal N Chill is at 999 Peachtree Blvd downtown.',
        }),
      ],
    });
    expect(events).toHaveLength(2);
    expect(events[0].hijackType).toBe('competitor_citation');
    expect(events[1].hijackType).toBe('address_mix');
  });

  it('each event has required fields populated', () => {
    const events = detectHijacking({
      ...BASE_INPUT,
      sovResults: [makeSovResult({
        cited: false,
        mentionedCompetitors: ['Atlanta Smoke House'],
        aiResponse: 'Try Atlanta Smoke House.',
      })],
    });
    expect(events).toHaveLength(1);
    const ev = events[0];
    expect(ev.id).toBeTruthy();
    expect(ev.orgId).toBe('org-1');
    expect(ev.locationId).toBe('loc-1');
    expect(ev.engine).toBe('perplexity_sonar');
    expect(ev.queryText).toBe('hookah lounge Alpharetta');
    expect(ev.ourBusiness).toBe('Charcoal N Chill');
    expect(ev.detectedAt).toBeTruthy();
  });
});
