// ---------------------------------------------------------------------------
// vaio-llms-txt-generator.test.ts — llms.txt generation unit tests
//
// Sprint 109: VAIO — ~12 tests
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateLlmsTxt,
  buildStandardLlmsTxt,
  buildFullLlmsTxt,
  formatHoursForVoice,
} from '@/lib/vaio/llms-txt-generator';
import type { GroundTruthForVAIO, LlmsPageUrl } from '@/lib/vaio/types';

const MOCK_GT: GroundTruthForVAIO = {
  location_id: 'loc-001',
  org_id: 'org-001',
  name: 'Charcoal N Chill',
  address: '11950 Jones Bridge Road Ste 103',
  city: 'Alpharetta',
  state: 'GA',
  zip: '30005',
  phone: '(678) 555-0199',
  website: 'https://charcoalnchill.com',
  categories: ['hookah lounge', 'Mediterranean restaurant'],
  amenities: {
    has_outdoor_seating: true,
    serves_alcohol: true,
    has_hookah: true,
    has_live_music: true,
    is_kid_friendly: false,
  },
  hours: {
    monday: { open: '16:00', close: '00:00' },
    tuesday: { open: '16:00', close: '00:00' },
    wednesday: { open: '16:00', close: '00:00' },
    thursday: { open: '16:00', close: '00:00' },
    friday: { open: '14:00', close: '02:00' },
    saturday: { open: '14:00', close: '02:00' },
    sunday: { open: '14:00', close: '02:00' },
  },
  description: 'Premium hookah lounge and Mediterranean restaurant in Alpharetta, GA.',
};

const MOCK_PAGES: LlmsPageUrl[] = [
  { page_type: 'menu', url: 'https://charcoalnchill.com/menu', description: 'Full menu' },
  { page_type: 'events', url: 'https://charcoalnchill.com/events', description: 'Events calendar' },
  { page_type: 'faq', url: 'https://charcoalnchill.com/faq', description: 'FAQ page' },
  { page_type: 'contact', url: 'https://charcoalnchill.com/contact', description: 'Contact info' },
];

describe('generateLlmsTxt', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T06:00:00Z'));
  });

  it('returns standard, full, generated_at, and version', () => {
    const result = generateLlmsTxt(MOCK_GT, ['great atmosphere', 'excellent hookah'], MOCK_PAGES);
    expect(result.standard).toBeTruthy();
    expect(result.full).toBeTruthy();
    expect(result.generated_at).toContain('2026-03-01');
    expect(result.version).toBe(1);
  });

  it('full is longer than standard', () => {
    const result = generateLlmsTxt(MOCK_GT, ['atmosphere', 'hookah'], MOCK_PAGES);
    expect(result.full.length).toBeGreaterThan(result.standard.length);
  });

  vi.useRealTimers();
});

describe('buildStandardLlmsTxt', () => {
  it('starts with business name as heading', () => {
    const result = buildStandardLlmsTxt(MOCK_GT, MOCK_PAGES);
    expect(result.startsWith('# Charcoal N Chill')).toBe(true);
  });

  it('includes key facts section', () => {
    const result = buildStandardLlmsTxt(MOCK_GT, MOCK_PAGES);
    expect(result).toContain('## Key Facts');
    expect(result).toContain('(678) 555-0199');
    expect(result).toContain('Alpharetta, GA 30005');
  });

  it('includes hours formatted for voice', () => {
    const result = buildStandardLlmsTxt(MOCK_GT, MOCK_PAGES);
    expect(result).toContain('**Hours:**');
  });

  it('includes menu section from page URLs', () => {
    const result = buildStandardLlmsTxt(MOCK_GT, MOCK_PAGES);
    expect(result).toContain('## Menu & Services');
    expect(result).toContain('charcoalnchill.com/menu');
  });

  it('includes events section from page URLs', () => {
    const result = buildStandardLlmsTxt(MOCK_GT, MOCK_PAGES);
    expect(result).toContain('## Events & Entertainment');
  });

  it('includes FAQ section from page URLs', () => {
    const result = buildStandardLlmsTxt(MOCK_GT, MOCK_PAGES);
    expect(result).toContain('## FAQ');
  });

  it('uses contact page URL when available', () => {
    const result = buildStandardLlmsTxt(MOCK_GT, MOCK_PAGES);
    expect(result).toContain('## Location & Contact');
    expect(result).toContain('charcoalnchill.com/contact');
  });

  it('falls back to inline contact when no contact page URL', () => {
    const result = buildStandardLlmsTxt(MOCK_GT, []);
    expect(result).toContain('## Location & Contact');
    expect(result).toContain('Phone: (678) 555-0199');
  });

  it('includes amenities as Specialties', () => {
    const result = buildStandardLlmsTxt(MOCK_GT, MOCK_PAGES);
    expect(result).toContain('**Specialties:**');
    expect(result).toContain('Outdoor Seating');
  });

  it('handles missing description gracefully', () => {
    const gt = { ...MOCK_GT, description: undefined };
    const result = buildStandardLlmsTxt(gt, MOCK_PAGES);
    expect(result).toContain('# Charcoal N Chill');
  });
});

describe('buildFullLlmsTxt', () => {
  it('includes About section from description', () => {
    const result = buildFullLlmsTxt(MOCK_GT, MOCK_PAGES, []);
    expect(result).toContain('## About');
    expect(result).toContain('Premium hookah lounge');
  });

  it('includes Features & Amenities section', () => {
    const result = buildFullLlmsTxt(MOCK_GT, MOCK_PAGES, []);
    expect(result).toContain('## Features & Amenities');
    expect(result).toContain('Outdoor Seating');
    expect(result).toContain('Full Bar');
  });

  it('includes Business Categories', () => {
    const result = buildFullLlmsTxt(MOCK_GT, MOCK_PAGES, []);
    expect(result).toContain('## Business Categories');
    expect(result).toContain('hookah lounge, Mediterranean restaurant');
  });

  it('includes review keywords when provided', () => {
    const result = buildFullLlmsTxt(MOCK_GT, MOCK_PAGES, ['great atmosphere', 'friendly staff']);
    expect(result).toContain('## What Customers Say');
    expect(result).toContain('great atmosphere');
    expect(result).toContain('friendly staff');
  });

  it('includes Detailed Hours section', () => {
    const result = buildFullLlmsTxt(MOCK_GT, MOCK_PAGES, []);
    expect(result).toContain('## Detailed Hours');
    expect(result).toContain('Monday:');
    expect(result).toContain('Sunday:');
  });

  it('includes generated footer', () => {
    const result = buildFullLlmsTxt(MOCK_GT, MOCK_PAGES, []);
    expect(result).toContain('Generated by LocalVector.ai');
  });
});

describe('formatHoursForVoice', () => {
  it('groups consecutive same-hours days into ranges', () => {
    const hours = {
      monday: { open: '16:00', close: '00:00' },
      tuesday: { open: '16:00', close: '00:00' },
      wednesday: { open: '16:00', close: '00:00' },
      thursday: { open: '16:00', close: '00:00' },
      friday: { open: '14:00', close: '02:00' },
      saturday: { open: '14:00', close: '02:00' },
      sunday: { open: '14:00', close: '02:00' },
    };
    const result = formatHoursForVoice(hours);
    expect(result).toContain('Monday–Thursday');
    expect(result).toContain('Friday–Sunday');
  });

  it('formats times in 12-hour format', () => {
    const hours = {
      monday: { open: '09:00', close: '17:00' },
    };
    const result = formatHoursForVoice(hours);
    expect(result).toContain('9:00 AM');
    expect(result).toContain('5:00 PM');
  });

  it('returns "Hours not available" for empty hours', () => {
    expect(formatHoursForVoice({})).toBe('Hours not available');
  });

  it('handles single day without range', () => {
    const hours = {
      monday: { open: '10:00', close: '22:00' },
      wednesday: { open: '10:00', close: '22:00' },
    };
    const result = formatHoursForVoice(hours);
    // Monday and Wednesday are not consecutive, so no range
    expect(result).toContain('Monday');
    expect(result).toContain('Wednesday');
  });

  it('handles midnight (00:00) as 12:00 AM', () => {
    const hours = {
      monday: { open: '16:00', close: '00:00' },
    };
    const result = formatHoursForVoice(hours);
    expect(result).toContain('12:00 AM');
  });

  it('handles noon (12:00) as 12:00 PM', () => {
    const hours = {
      monday: { open: '12:00', close: '22:00' },
    };
    const result = formatHoursForVoice(hours);
    expect(result).toContain('12:00 PM');
  });
});
