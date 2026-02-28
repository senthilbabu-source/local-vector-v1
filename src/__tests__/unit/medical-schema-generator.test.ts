// ---------------------------------------------------------------------------
// medical-schema-generator.test.ts — Unit tests for medical/dental schema gen
//
// Sprint E (M5): Tests generateMedicalSchema() and buildHoursSpecification().
// Pure function — no DB, no fetch, no side effects.
//
// Run:
//   npx vitest run src/__tests__/unit/medical-schema-generator.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  generateMedicalSchema,
  buildHoursSpecification,
  type MedicalSchemaInput,
} from '@/lib/schema-generator/medical-types';
import { ALPHARETTA_FAMILY_DENTAL } from '@/__fixtures__/golden-tenant';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/** Minimal valid input derived from the golden dental tenant fixture. */
const DENTAL_INPUT: MedicalSchemaInput = {
  name: ALPHARETTA_FAMILY_DENTAL.location.name,
  specialty: ALPHARETTA_FAMILY_DENTAL.location.specialty,
  phone: ALPHARETTA_FAMILY_DENTAL.location.phone,
  website: ALPHARETTA_FAMILY_DENTAL.location.website,
  address: { ...ALPHARETTA_FAMILY_DENTAL.location.address },
  lat: ALPHARETTA_FAMILY_DENTAL.location.lat,
  lng: ALPHARETTA_FAMILY_DENTAL.location.lng,
  hours: { ...ALPHARETTA_FAMILY_DENTAL.location.hours } as MedicalSchemaInput['hours'],
  services: [...ALPHARETTA_FAMILY_DENTAL.location.services],
  rating: { ...ALPHARETTA_FAMILY_DENTAL.location.rating },
};

/** Minimal physician input — specialty does not contain 'dent'. */
const PHYSICIAN_INPUT: MedicalSchemaInput = {
  name: 'Alpharetta Primary Care',
  specialty: 'Family Medicine',
  phone: '+16785550100',
  website: 'https://alpharettaprimarycare.example.com',
  address: {
    street: '555 North Point Pkwy',
    city: 'Alpharetta',
    state: 'GA',
    zip: '30022',
  },
};

// ---------------------------------------------------------------------------
// @type discrimination
// ---------------------------------------------------------------------------

describe('generateMedicalSchema — @type selection', () => {
  it('returns "@type": "Dentist" when specialty contains "dent"', () => {
    const schema = generateMedicalSchema(DENTAL_INPUT);
    expect(schema['@type']).toBe('Dentist');
  });

  it('returns "@type": "Physician" when specialty does not contain "dent"', () => {
    const schema = generateMedicalSchema(PHYSICIAN_INPUT);
    expect(schema['@type']).toBe('Physician');
  });
});

// ---------------------------------------------------------------------------
// Core fields
// ---------------------------------------------------------------------------

describe('generateMedicalSchema — core fields', () => {
  it('includes the name from the org input', () => {
    const schema = generateMedicalSchema(DENTAL_INPUT);
    expect(schema.name).toBe('Alpharetta Family Dental');
  });

  it('includes telephone when phone is provided', () => {
    const schema = generateMedicalSchema(DENTAL_INPUT);
    expect(schema.telephone).toBe('+16785550199');
  });

  it('omits telephone when phone is null', () => {
    const schema = generateMedicalSchema({ ...PHYSICIAN_INPUT, phone: null });
    expect(schema.telephone).toBeUndefined();
  });

  it('includes address with all required PostalAddress fields', () => {
    const schema = generateMedicalSchema(DENTAL_INPUT);
    expect(schema.address['@type']).toBe('PostalAddress');
    expect(schema.address.streetAddress).toBe('1234 Windward Pkwy');
    expect(schema.address.addressLocality).toBe('Alpharetta');
    expect(schema.address.addressRegion).toBe('GA');
    expect(schema.address.postalCode).toBe('30005');
    expect(schema.address.addressCountry).toBe('US');
  });
});

// ---------------------------------------------------------------------------
// Geo coordinates
// ---------------------------------------------------------------------------

describe('generateMedicalSchema — geo coordinates', () => {
  it('includes geo when lat and lng are provided', () => {
    const schema = generateMedicalSchema(DENTAL_INPUT);
    expect(schema.geo).toBeDefined();
    expect(schema.geo!['@type']).toBe('GeoCoordinates');
    expect(schema.geo!.latitude).toBe(34.0754);
    expect(schema.geo!.longitude).toBe(-84.2941);
  });

  it('omits geo when lat or lng is null', () => {
    const schema = generateMedicalSchema({ ...PHYSICIAN_INPUT, lat: null, lng: null });
    expect(schema.geo).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Medical specialty
// ---------------------------------------------------------------------------

describe('generateMedicalSchema — medicalSpecialty', () => {
  it('includes medicalSpecialty array when specialty is provided', () => {
    const schema = generateMedicalSchema(DENTAL_INPUT);
    expect(Array.isArray(schema.medicalSpecialty)).toBe(true);
    expect(schema.medicalSpecialty).toContain('General and Cosmetic Dentistry');
  });
});

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

describe('generateMedicalSchema — availableService', () => {
  it('maps services array to availableService with "@type": "MedicalProcedure"', () => {
    const schema = generateMedicalSchema(DENTAL_INPUT);
    expect(Array.isArray(schema.availableService)).toBe(true);
    expect(schema.availableService!.length).toBe(ALPHARETTA_FAMILY_DENTAL.location.services.length);
    for (const svc of schema.availableService!) {
      expect(svc['@type']).toBe('MedicalProcedure');
      expect(typeof svc.name).toBe('string');
      expect(svc.name.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Hours
// ---------------------------------------------------------------------------

describe('generateMedicalSchema — openingHoursSpecification', () => {
  it('includes openingHoursSpecification from hours object', () => {
    const schema = generateMedicalSchema(DENTAL_INPUT);
    expect(Array.isArray(schema.openingHoursSpecification)).toBe(true);
    expect(schema.openingHoursSpecification!.length).toBeGreaterThan(0);
  });

  it('omits Sunday when Sunday hours are null', () => {
    // DENTAL_INPUT has sunday: { open: null, close: null }
    const schema = generateMedicalSchema(DENTAL_INPUT);
    const days = schema.openingHoursSpecification!.map((s) => s.dayOfWeek);
    expect(days).not.toContain('Sunday');
  });
});

// ---------------------------------------------------------------------------
// Aggregate rating
// ---------------------------------------------------------------------------

describe('generateMedicalSchema — aggregateRating', () => {
  it('includes aggregateRating when rating is provided', () => {
    const schema = generateMedicalSchema(DENTAL_INPUT);
    expect(schema.aggregateRating).toBeDefined();
    expect(schema.aggregateRating!['@type']).toBe('AggregateRating');
    expect(schema.aggregateRating!.ratingValue).toBe(4.8);
    expect(schema.aggregateRating!.reviewCount).toBe(214);
  });

  it('omits aggregateRating when rating is null', () => {
    const schema = generateMedicalSchema({ ...DENTAL_INPUT, rating: null });
    expect(schema.aggregateRating).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// @context
// ---------------------------------------------------------------------------

describe('generateMedicalSchema — @context', () => {
  it('output has @context = "https://schema.org"', () => {
    const schema = generateMedicalSchema(DENTAL_INPUT);
    expect(schema['@context']).toBe('https://schema.org');
  });
});

// ---------------------------------------------------------------------------
// buildHoursSpecification
// ---------------------------------------------------------------------------

describe('buildHoursSpecification', () => {
  it('maps lowercase day names to title-case (monday → "Monday")', () => {
    const specs = buildHoursSpecification({
      monday: { open: '09:00', close: '17:00' },
    });
    expect(specs).toHaveLength(1);
    expect(specs[0].dayOfWeek).toBe('Monday');
    expect(specs[0].opens).toBe('09:00');
    expect(specs[0].closes).toBe('17:00');
  });

  it('omits entries where open or close is null', () => {
    const specs = buildHoursSpecification({
      monday: { open: '09:00', close: '17:00' },
      sunday: { open: null, close: null },
    });
    expect(specs).toHaveLength(1);
    expect(specs[0].dayOfWeek).toBe('Monday');
  });
});
