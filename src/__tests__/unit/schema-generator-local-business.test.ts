// ---------------------------------------------------------------------------
// schema-generator-local-business.test.ts — Sprint 70: LocalBusiness tests
//
// Run: npx vitest run src/__tests__/unit/schema-generator-local-business.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  generateLocalBusinessSchema,
  inferSchemaOrgType,
} from '@/lib/schema-generator/local-business-schema';
import {
  MOCK_SCHEMA_LOCATION,
  MOCK_SCHEMA_INTEGRATIONS,
} from '@/__fixtures__/golden-tenant';
import type { SchemaLocationInput, SchemaIntegrationInput } from '@/lib/schema-generator/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const location: SchemaLocationInput = { ...MOCK_SCHEMA_LOCATION };
const integrations: SchemaIntegrationInput[] = [...MOCK_SCHEMA_INTEGRATIONS];

// ---------------------------------------------------------------------------
// generateLocalBusinessSchema
// ---------------------------------------------------------------------------

describe('generateLocalBusinessSchema', () => {
  it('returns LocalBusiness JSON-LD with @context and @type', () => {
    const result = generateLocalBusinessSchema(location, integrations);

    expect(result.jsonLd).toHaveProperty('@context', 'https://schema.org');
    expect(result.jsonLd).toHaveProperty('@type');
    expect(result.schemaType).toBe('LocalBusiness');
  });

  it('includes full PostalAddress when address data present', () => {
    const result = generateLocalBusinessSchema(location, integrations);
    const jsonLd = result.jsonLd as Record<string, unknown>;
    const address = jsonLd.address as Record<string, string>;

    expect(address['@type']).toBe('PostalAddress');
    expect(address.streetAddress).toBe('11950 Jones Bridge Road Ste 103');
    expect(address.addressLocality).toBe('Alpharetta');
    expect(address.addressRegion).toBe('GA');
    expect(address.postalCode).toBe('30005');
    expect(address.addressCountry).toBe('US');
  });

  it('includes sameAs links from integrations with listing_url', () => {
    const result = generateLocalBusinessSchema(location, integrations);
    const jsonLd = result.jsonLd as Record<string, unknown>;
    const sameAs = jsonLd.sameAs as string[];

    expect(sameAs).toContain('https://g.page/charcoal-n-chill-alpharetta');
    expect(sameAs).toContain('https://www.yelp.com/biz/charcoal-n-chill-alpharetta');
  });

  it('filters integrations without listing_url from sameAs', () => {
    const mixedIntegrations: SchemaIntegrationInput[] = [
      { platform: 'yelp', listing_url: 'https://yelp.com/biz/test' },
      { platform: 'tripadvisor', listing_url: null },
    ];

    const result = generateLocalBusinessSchema(location, mixedIntegrations);
    const jsonLd = result.jsonLd as Record<string, unknown>;
    const sameAs = jsonLd.sameAs as string[];

    expect(sameAs).toContain('https://yelp.com/biz/test');
    expect(sameAs).not.toContain(null);
    expect(sameAs.every((url) => url !== null)).toBe(true);
  });

  it('includes website_url in sameAs array', () => {
    const result = generateLocalBusinessSchema(location, integrations);
    const jsonLd = result.jsonLd as Record<string, unknown>;
    const sameAs = jsonLd.sameAs as string[];

    expect(sameAs).toContain('https://charcoalnchill.com');
  });

  it('sets acceptsReservations from amenities.takes_reservations', () => {
    const result = generateLocalBusinessSchema(location, integrations);
    const jsonLd = result.jsonLd as Record<string, unknown>;

    expect(jsonLd.acceptsReservations).toBe(true);
  });

  it('does not set acceptsReservations when takes_reservations is false', () => {
    const noReservations: SchemaLocationInput = {
      ...location,
      amenities: { ...location.amenities!, takes_reservations: false },
    };

    const result = generateLocalBusinessSchema(noReservations, []);
    const jsonLd = result.jsonLd as Record<string, unknown>;

    expect(jsonLd.acceptsReservations).toBeUndefined();
  });

  it('infers BarOrPub type from hookah/lounge categories', () => {
    const result = generateLocalBusinessSchema(location, integrations);
    const jsonLd = result.jsonLd as Record<string, unknown>;

    expect(jsonLd['@type']).toBe('BarOrPub');
  });

  it('infers Restaurant type from restaurant categories', () => {
    const restaurantLoc: SchemaLocationInput = {
      ...location,
      categories: ['Italian Restaurant', 'Fine Dining'],
    };

    const result = generateLocalBusinessSchema(restaurantLoc, []);
    const jsonLd = result.jsonLd as Record<string, unknown>;

    expect(jsonLd['@type']).toBe('Restaurant');
  });

  it('defaults to LocalBusiness when no categories match', () => {
    const genericLoc: SchemaLocationInput = {
      ...location,
      categories: ['Dry Cleaner'],
    };

    const result = generateLocalBusinessSchema(genericLoc, []);
    const jsonLd = result.jsonLd as Record<string, unknown>;

    expect(jsonLd['@type']).toBe('LocalBusiness');
  });

  it('includes Google Maps link from google_place_id', () => {
    const result = generateLocalBusinessSchema(location, integrations);
    const jsonLd = result.jsonLd as Record<string, unknown>;

    expect(jsonLd.hasMap).toBe(
      'https://www.google.com/maps/place/?q=place_id:ChIJi8-1ywdO9YgR9s5j-y0_1lI',
    );
  });

  it('omits hasMap when google_place_id is null', () => {
    const noPlaceId: SchemaLocationInput = {
      ...location,
      google_place_id: null,
    };

    const result = generateLocalBusinessSchema(noPlaceId, []);
    const jsonLd = result.jsonLd as Record<string, unknown>;

    expect(jsonLd.hasMap).toBeUndefined();
  });

  it('includes telephone and url when present', () => {
    const result = generateLocalBusinessSchema(location, integrations);
    const jsonLd = result.jsonLd as Record<string, unknown>;

    expect(jsonLd.telephone).toBe('(470) 546-4866');
    expect(jsonLd.url).toBe('https://charcoalnchill.com');
  });

  it('returns valid jsonLdString matching jsonLd object', () => {
    const result = generateLocalBusinessSchema(location, integrations);

    expect(() => JSON.parse(result.jsonLdString)).not.toThrow();
    expect(JSON.parse(result.jsonLdString)).toEqual(result.jsonLd);
  });

  it('returns description with sameAs count', () => {
    const result = generateLocalBusinessSchema(location, integrations);
    // website_url + 7 integrations = 8 sameAs links
    expect(result.description).toContain('8 sameAs');
  });

  it('handles empty integrations and no website_url', () => {
    const minimalLoc: SchemaLocationInput = {
      ...location,
      website_url: null,
    };

    const result = generateLocalBusinessSchema(minimalLoc, []);
    const jsonLd = result.jsonLd as Record<string, unknown>;

    expect(jsonLd.sameAs).toBeUndefined();
    expect(jsonLd.url).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// inferSchemaOrgType
// ---------------------------------------------------------------------------

describe('inferSchemaOrgType', () => {
  it('returns "BarOrPub" for hookah-related categories', () => {
    expect(inferSchemaOrgType(['Hookah Bar', 'Lounge'])).toBe('BarOrPub');
  });

  it('returns "BarOrPub" for bar categories', () => {
    expect(inferSchemaOrgType(['Sports Bar'])).toBe('BarOrPub');
  });

  it('returns "Restaurant" for restaurant categories', () => {
    expect(inferSchemaOrgType(['Italian Restaurant'])).toBe('Restaurant');
  });

  it('returns "Restaurant" for fusion/indian categories', () => {
    expect(inferSchemaOrgType(['Indian Cuisine'])).toBe('Restaurant');
  });

  it('returns "NightClub" for nightlife categories', () => {
    expect(inferSchemaOrgType(['Nightlife', 'Dance Club'])).toBe('NightClub');
  });

  it('returns "LocalBusiness" for null categories', () => {
    expect(inferSchemaOrgType(null)).toBe('LocalBusiness');
  });

  it('returns "LocalBusiness" for empty categories', () => {
    expect(inferSchemaOrgType([])).toBe('LocalBusiness');
  });

  it('returns "LocalBusiness" for unrecognized categories', () => {
    expect(inferSchemaOrgType(['Bookstore', 'Gift Shop'])).toBe('LocalBusiness');
  });
});
