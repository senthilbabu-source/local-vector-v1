// ---------------------------------------------------------------------------
// schema-generator-hours.test.ts — Sprint 70: OpeningHoursSpecification tests
//
// Run: npx vitest run src/__tests__/unit/schema-generator-hours.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { generateOpeningHoursSchema } from '@/lib/schema-generator/hours-schema';
import { MOCK_SCHEMA_LOCATION } from '@/__fixtures__/golden-tenant';
import type { SchemaLocationInput } from '@/lib/schema-generator/types';
import type { HoursData } from '@/lib/types/ground-truth';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const location: SchemaLocationInput = { ...MOCK_SCHEMA_LOCATION };

function makeLocation(hoursOverride: HoursData | null): SchemaLocationInput {
  return { ...location, hours_data: hoursOverride };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateOpeningHoursSchema', () => {
  it('returns OpeningHoursSpecification for each open day', () => {
    const result = generateOpeningHoursSchema(location);

    expect(result).not.toBeNull();
    const jsonLd = result!.jsonLd as { openingHoursSpecification: { '@type': string }[] };
    expect(jsonLd.openingHoursSpecification).toHaveLength(7); // All 7 days open
    for (const spec of jsonLd.openingHoursSpecification) {
      expect(spec['@type']).toBe('OpeningHoursSpecification');
    }
  });

  it('uses Schema.org day URLs', () => {
    const result = generateOpeningHoursSchema(location);
    const jsonLd = result!.jsonLd as {
      openingHoursSpecification: { dayOfWeek: string }[];
    };

    const days = jsonLd.openingHoursSpecification.map((s) => s.dayOfWeek);
    expect(days).toContain('https://schema.org/Monday');
    expect(days).toContain('https://schema.org/Friday');
    expect(days).toContain('https://schema.org/Sunday');
  });

  it('preserves open/close times from hours_data', () => {
    const result = generateOpeningHoursSchema(location);
    const jsonLd = result!.jsonLd as {
      openingHoursSpecification: { dayOfWeek: string; opens: string; closes: string }[];
    };

    const monday = jsonLd.openingHoursSpecification.find(
      (s) => s.dayOfWeek === 'https://schema.org/Monday',
    );
    expect(monday).toBeDefined();
    expect(monday!.opens).toBe('17:00');
    expect(monday!.closes).toBe('23:00');
  });

  it('omits days marked as "closed" (string literal)', () => {
    const hoursWithClosed: HoursData = {
      monday: { open: '17:00', close: '23:00' },
      tuesday: 'closed',
      wednesday: { open: '17:00', close: '23:00' },
    };

    const result = generateOpeningHoursSchema(makeLocation(hoursWithClosed));
    const jsonLd = result!.jsonLd as {
      openingHoursSpecification: { dayOfWeek: string }[];
    };

    expect(jsonLd.openingHoursSpecification).toHaveLength(2);
    const dayUrls = jsonLd.openingHoursSpecification.map((s) => s.dayOfWeek);
    expect(dayUrls).not.toContain('https://schema.org/Tuesday');
  });

  it('omits days missing from hours_data (unknown ≠ closed)', () => {
    const partialHours: HoursData = {
      friday: { open: '17:00', close: '01:00' },
      saturday: { open: '17:00', close: '01:00' },
    };

    const result = generateOpeningHoursSchema(makeLocation(partialHours));
    const jsonLd = result!.jsonLd as {
      openingHoursSpecification: { dayOfWeek: string }[];
    };

    expect(jsonLd.openingHoursSpecification).toHaveLength(2);
  });

  it('returns null when hours_data is null', () => {
    const result = generateOpeningHoursSchema(makeLocation(null));
    expect(result).toBeNull();
  });

  it('returns null when hours_data is empty object', () => {
    const result = generateOpeningHoursSchema(makeLocation({}));
    expect(result).toBeNull();
  });

  it('handles cross-midnight close times correctly', () => {
    const crossMidnight: HoursData = {
      friday: { open: '17:00', close: '01:00' },
    };

    const result = generateOpeningHoursSchema(makeLocation(crossMidnight));
    const jsonLd = result!.jsonLd as {
      openingHoursSpecification: { opens: string; closes: string }[];
    };

    expect(jsonLd.openingHoursSpecification[0].opens).toBe('17:00');
    expect(jsonLd.openingHoursSpecification[0].closes).toBe('01:00');
  });

  it('wraps specs in Restaurant type with business name', () => {
    const result = generateOpeningHoursSchema(location);
    const jsonLd = result!.jsonLd as { '@context': string; '@type': string; name: string };

    expect(jsonLd['@context']).toBe('https://schema.org');
    expect(jsonLd['@type']).toBe('Restaurant');
    expect(jsonLd.name).toBe('Charcoal N Chill');
  });

  it('returns schemaType OpeningHoursSpecification and valid jsonLdString', () => {
    const result = generateOpeningHoursSchema(location);

    expect(result!.schemaType).toBe('OpeningHoursSpecification');
    expect(() => JSON.parse(result!.jsonLdString)).not.toThrow();
    expect(JSON.parse(result!.jsonLdString)).toEqual(result!.jsonLd);
  });

  it('returns description with day count', () => {
    const result = generateOpeningHoursSchema(location);
    expect(result!.description).toContain('7 days');
  });

  it('returns null when all days are "closed"', () => {
    const allClosed: HoursData = {
      monday: 'closed',
      tuesday: 'closed',
    };

    const result = generateOpeningHoursSchema(makeLocation(allClosed));
    expect(result).toBeNull();
  });
});
