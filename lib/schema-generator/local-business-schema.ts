// ---------------------------------------------------------------------------
// lib/schema-generator/local-business-schema.ts — LocalBusiness JSON-LD
//
// Sprint 70: Generates LocalBusiness structured data with sameAs links
// to directory listings for entity disambiguation.
//
// PURE FUNCTION — no DB, no fetch, no side effects.
// ---------------------------------------------------------------------------

import type { SchemaLocationInput, SchemaIntegrationInput, GeneratedSchema } from './types';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generates LocalBusiness JSON-LD with sameAs links to directory listings.
 *
 * sameAs links (Yelp, TripAdvisor, Instagram, etc.) are critical for
 * entity disambiguation — they tell AI models "this is the same business
 * as the one on Yelp with this URL."
 */
export function generateLocalBusinessSchema(
  location: SchemaLocationInput,
  integrations: SchemaIntegrationInput[],
): GeneratedSchema {
  const sameAsLinks = integrations
    .filter((i) => i.listing_url)
    .map((i) => i.listing_url!);

  if (location.website_url && !sameAsLinks.includes(location.website_url)) {
    sameAsLinks.unshift(location.website_url);
  }

  const schemaType = inferSchemaOrgType(location.categories);

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': schemaType,
    name: location.business_name,
  };

  if (location.address_line1) {
    jsonLd.address = {
      '@type': 'PostalAddress',
      streetAddress: location.address_line1,
      ...(location.city && { addressLocality: location.city }),
      ...(location.state && { addressRegion: location.state }),
      ...(location.zip && { postalCode: location.zip }),
      addressCountry: location.country,
    };
  }

  if (location.google_place_id) {
    jsonLd.hasMap = `https://www.google.com/maps/place/?q=place_id:${location.google_place_id}`;
  }

  if (location.phone) jsonLd.telephone = location.phone;
  if (location.website_url) jsonLd.url = location.website_url;
  if (sameAsLinks.length > 0) jsonLd.sameAs = sameAsLinks;

  if (location.amenities) {
    if (location.amenities.takes_reservations) {
      jsonLd.acceptsReservations = true;
    }
    if (location.amenities.serves_alcohol) {
      jsonLd.servesCuisine = location.categories?.[0] ?? 'American';
    }
  }

  return {
    schemaType: 'LocalBusiness',
    jsonLd,
    jsonLdString: JSON.stringify(jsonLd, null, 2),
    description: `${schemaType} entity with ${sameAsLinks.length} sameAs links for AI entity disambiguation`,
    estimatedImpact:
      'Est. +10% — sameAs links help AI models verify your identity across platforms',
    missingReason: 'No complete LocalBusiness structured data with sameAs links found',
  };
}

// ---------------------------------------------------------------------------
// inferSchemaOrgType — maps categories to Schema.org types
// ---------------------------------------------------------------------------

export function inferSchemaOrgType(categories: string[] | null): string {
  if (!categories || categories.length === 0) return 'LocalBusiness';

  const lower = categories.map((c) => c.toLowerCase());

  // Medical/Dental — Sprint E
  if (lower.some((c) => c.includes('dentist') || c.includes('dental'))) {
    return 'Dentist';
  }
  if (lower.some((c) => c.includes('physician') || c.includes('doctor') || c.includes('medical') || c.includes('clinic'))) {
    return 'Physician';
  }

  // Hospitality (existing)
  if (lower.some((c) => c.includes('hookah') || c.includes('lounge') || c.includes('bar'))) {
    return 'BarOrPub';
  }
  if (lower.some((c) => c.includes('restaurant') || c.includes('fusion') || c.includes('indian'))) {
    return 'Restaurant';
  }
  if (lower.some((c) => c.includes('nightlife') || c.includes('club'))) {
    return 'NightClub';
  }
  return 'LocalBusiness';
}
