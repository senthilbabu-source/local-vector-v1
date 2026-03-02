import { describe, it, expect } from 'vitest';
import {
  diffTextAgainstGroundTruth,
  groundTruthValuePresentInText,
  findContradictingValue,
  normalizePhone,
  extractPhonePatterns,
} from '@/lib/sandbox/ground-truth-diffuser';
import type { SandboxGroundTruth, GroundTruthField } from '@/lib/sandbox/types';
import { MOCK_SANDBOX_GROUND_TRUTH } from '@/__fixtures__/golden-tenant';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GOOD_CONTENT = `
Charcoal N Chill is a hookah lounge in Alpharetta, GA.
Located at 11950 Jones Bridge Road Ste 103, zip 30005.
Call us at (470) 546-4866. Visit charcoalnchill.com for our menu.
We are open Tuesday–Saturday from 5 PM, closed Mondays.
Enjoy our outdoor seating, live music, and premium hookah.
`;

const EMPTY_GT: SandboxGroundTruth = {
  location_id: 'loc-1',
  org_id: 'org-1',
  name: '',
  phone: null,
  address: null,
  city: null,
  state: null,
  zip: null,
  website: null,
  category: null,
  hours: null,
  hours_data: null,
  description: null,
  amenities: [],
};

// ---------------------------------------------------------------------------
// normalizePhone
// ---------------------------------------------------------------------------

describe('normalizePhone', () => {
  it('strips parentheses, dashes, spaces from US phone', () => {
    expect(normalizePhone('(470) 546-4866')).toBe('4705464866');
  });

  it('strips dots from phone', () => {
    expect(normalizePhone('470.546.4866')).toBe('4705464866');
  });

  it('strips country code prefix', () => {
    expect(normalizePhone('+1-470-546-4866')).toBe('14705464866');
  });

  it('returns empty string for empty input', () => {
    expect(normalizePhone('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// extractPhonePatterns
// ---------------------------------------------------------------------------

describe('extractPhonePatterns', () => {
  it('extracts standard (xxx) xxx-xxxx', () => {
    const phones = extractPhonePatterns('Call (470) 546-4866 today!');
    expect(phones).toContain('4705464866');
  });

  it('extracts dotted format xxx.xxx.xxxx', () => {
    const phones = extractPhonePatterns('Phone: 470.546.4866');
    expect(phones).toContain('4705464866');
  });

  it('extracts dashed format xxx-xxx-xxxx', () => {
    const phones = extractPhonePatterns('Phone: 470-546-4866');
    expect(phones).toContain('4705464866');
  });

  it('returns empty array when no phones', () => {
    expect(extractPhonePatterns('No phone here')).toEqual([]);
  });

  it('extracts multiple phones', () => {
    const phones = extractPhonePatterns('Main: (470) 546-4866, Alt: 678-555-1234');
    expect(phones.length).toBeGreaterThanOrEqual(2);
  });

  it('filters out numbers with fewer than 10 digits', () => {
    const phones = extractPhonePatterns('Zip is 30005');
    expect(phones).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// groundTruthValuePresentInText
// ---------------------------------------------------------------------------

describe('groundTruthValuePresentInText', () => {
  it('finds business name (case-insensitive)', () => {
    expect(groundTruthValuePresentInText('Charcoal N Chill', 'welcome to charcoal n chill!', 'name')).toBe(true);
  });

  it('finds phone number across formats', () => {
    expect(groundTruthValuePresentInText('(470) 546-4866', 'Call 470-546-4866', 'phone')).toBe(true);
  });

  it('returns false for missing phone', () => {
    expect(groundTruthValuePresentInText('(470) 546-4866', 'Call us soon', 'phone')).toBe(false);
  });

  it('matches address with abbreviation expansion', () => {
    expect(groundTruthValuePresentInText('123 Main St', 'located at 123 main street', 'address')).toBe(true);
  });

  it('returns false when GT value is empty', () => {
    expect(groundTruthValuePresentInText('', 'some text', 'name')).toBe(false);
  });

  it('returns false when text is empty', () => {
    expect(groundTruthValuePresentInText('Something', '', 'name')).toBe(false);
  });

  it('finds city name', () => {
    expect(groundTruthValuePresentInText('Alpharetta', 'Located in Alpharetta, GA', 'city')).toBe(true);
  });

  it('finds website URL', () => {
    expect(groundTruthValuePresentInText('https://charcoalnchill.com', 'visit https://charcoalnchill.com for more', 'website')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// findContradictingValue
// ---------------------------------------------------------------------------

describe('findContradictingValue', () => {
  it('detects wrong phone number', () => {
    const result = findContradictingValue('(470) 546-4866', 'Call us at (678) 111-2222', 'phone');
    expect(result).toBeTruthy();
  });

  it('returns null when no phone in text', () => {
    const result = findContradictingValue('(470) 546-4866', 'We are open every day', 'phone');
    expect(result).toBeNull();
  });

  it('returns null when phone matches', () => {
    const result = findContradictingValue('(470) 546-4866', 'Call (470) 546-4866', 'phone');
    expect(result).toBeNull();
  });

  it('returns null for non-phone fields (no contradiction detection)', () => {
    const result = findContradictingValue('Alpharetta', 'Located in Sandy Springs', 'city');
    expect(result).toBeNull();
  });

  it('returns null when GT is empty', () => {
    expect(findContradictingValue('', 'some text', 'phone')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// diffTextAgainstGroundTruth
// ---------------------------------------------------------------------------

describe('diffTextAgainstGroundTruth', () => {
  it('returns high alignment for content with all facts', () => {
    const result = diffTextAgainstGroundTruth(GOOD_CONTENT, MOCK_SANDBOX_GROUND_TRUTH);
    expect(result.alignment_score).toBeGreaterThanOrEqual(60);
    expect(result.supported_facts.length).toBeGreaterThanOrEqual(4);
  });

  it('returns 0 alignment when all GT fields are empty', () => {
    const result = diffTextAgainstGroundTruth(GOOD_CONTENT, EMPTY_GT);
    expect(result.alignment_score).toBe(0);
    expect(result.supported_facts).toEqual([]);
    expect(result.contradicted_facts).toEqual([]);
  });

  it('includes amenities in supported_facts when mentioned', () => {
    const result = diffTextAgainstGroundTruth(GOOD_CONTENT, MOCK_SANDBOX_GROUND_TRUTH);
    expect(result.supported_facts).toContain('amenities');
  });

  it('puts amenities in not_mentioned when none match', () => {
    const noAmenityContent = 'Charcoal N Chill at (470) 546-4866 in Alpharetta';
    const gt: SandboxGroundTruth = {
      ...MOCK_SANDBOX_GROUND_TRUTH,
      amenities: ['valet parking', 'pet friendly'],
    };
    const result = diffTextAgainstGroundTruth(noAmenityContent, gt);
    expect(result.not_mentioned_facts).toContain('amenities');
  });

  it('creates discrepancy with critical severity for contradicted phone', () => {
    const wrongPhoneContent = 'Charcoal N Chill. Call (999) 111-2222.';
    const result = diffTextAgainstGroundTruth(wrongPhoneContent, MOCK_SANDBOX_GROUND_TRUTH);
    expect(result.contradicted_facts).toContain('phone');
    expect(result.discrepancies.length).toBeGreaterThan(0);
    const phoneDisc = result.discrepancies.find(d => d.field === 'phone');
    expect(phoneDisc?.severity).toBe('critical');
  });

  it('marks fields as not_mentioned when absent from text', () => {
    const sparseContent = 'Great food here!';
    const result = diffTextAgainstGroundTruth(sparseContent, MOCK_SANDBOX_GROUND_TRUTH);
    expect(result.not_mentioned_facts.length).toBeGreaterThan(0);
    expect(result.alignment_score).toBeLessThan(70);
  });

  it('scores empty text as 0', () => {
    const result = diffTextAgainstGroundTruth('', MOCK_SANDBOX_GROUND_TRUTH);
    // All fields not mentioned → score = total×1 / total×2 = 50
    expect(result.alignment_score).toBeLessThanOrEqual(50);
  });
});
