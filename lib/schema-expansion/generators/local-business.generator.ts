// ---------------------------------------------------------------------------
// lib/schema-expansion/generators/local-business.generator.ts
//
// Sprint 106: Generates LocalBusiness (or Restaurant/BarOrPub) JSON-LD.
// Used for: homepage, about page.
//
// Reuses:
//   - inferSchemaOrgType() from lib/schema-generator/local-business-schema.ts
//   - generateOpeningHoursSchema() from lib/schema-generator/hours-schema.ts
// ---------------------------------------------------------------------------

import { SchemaGenerator } from './types';
import type { SchemaGeneratorInput, GeneratedSchema, PageType } from './types';
import { inferSchemaOrgType } from '@/lib/schema-generator/local-business-schema';
import { generateOpeningHoursSchema } from '@/lib/schema-generator/hours-schema';
import type { SchemaLocationInput } from '@/lib/schema-generator/types';

export class LocalBusinessGenerator extends SchemaGenerator {
  readonly supportsPageType: PageType[] = ['homepage', 'about'];

  async generate(input: SchemaGeneratorInput): Promise<GeneratedSchema> {
    const { groundTruth, page, sameAsUrls, amenities, categories, latitude, longitude } = input;
    const missingFields: string[] = [];

    const schemaType = inferSchemaOrgType(categories ?? null);

    const localBusiness: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': schemaType,
      name: groundTruth.name,
    };

    // URL
    if (groundTruth.website) {
      localBusiness.url = groundTruth.website;
    } else {
      missingFields.push('url');
    }

    // Telephone
    if (groundTruth.phone) {
      localBusiness.telephone = groundTruth.phone;
    } else {
      missingFields.push('telephone');
    }

    // Address
    if (groundTruth.address) {
      localBusiness.address = {
        '@type': 'PostalAddress',
        streetAddress: groundTruth.address,
        ...(groundTruth.city && { addressLocality: groundTruth.city }),
        ...(groundTruth.state && { addressRegion: groundTruth.state }),
        ...(groundTruth.zip && { postalCode: groundTruth.zip }),
        addressCountry: 'US',
      };
    } else {
      missingFields.push('address');
    }

    // Geo coordinates — only if explicitly available
    if (latitude != null && longitude != null) {
      localBusiness.geo = {
        '@type': 'GeoCoordinates',
        latitude,
        longitude,
      };
    }

    // Opening Hours — reuse existing generator
    if (groundTruth.hours_data) {
      const locationInput: SchemaLocationInput = {
        business_name: groundTruth.name,
        address_line1: groundTruth.address,
        city: groundTruth.city,
        state: groundTruth.state,
        zip: groundTruth.zip,
        country: 'US',
        phone: groundTruth.phone,
        website_url: groundTruth.website ?? null,
        hours_data: groundTruth.hours_data,
        amenities: (amenities ?? null) as SchemaLocationInput['amenities'],
        categories: categories ?? null,
        google_place_id: null,
      };

      const hoursSchema = generateOpeningHoursSchema(locationInput);
      if (hoursSchema?.jsonLd && 'openingHoursSpecification' in hoursSchema.jsonLd) {
        localBusiness.openingHoursSpecification = hoursSchema.jsonLd.openingHoursSpecification;
      }
    }

    // Amenities
    if (amenities) {
      if (amenities.takes_reservations) localBusiness.acceptsReservations = true;
      if (amenities.serves_alcohol) localBusiness.servesCuisine = categories?.[0] ?? 'American';
    }

    // sameAs — platform links for entity disambiguation
    if (sameAsUrls && sameAsUrls.length > 0) {
      localBusiness.sameAs = sameAsUrls;
    }

    // Build BreadcrumbList
    const websiteUrl = groundTruth.website ?? page.url;
    const breadcrumb = this.buildBreadcrumb(
      this.getOrigin(websiteUrl),
      this.getPathname(page.url),
      page.title ?? groundTruth.name,
    );

    const schemaTypes = [schemaType, 'BreadcrumbList'];

    return {
      page_type: page.page_type,
      schema_types: schemaTypes,
      json_ld: [localBusiness, breadcrumb],
      confidence: missingFields.length === 0 ? 0.95 : Math.max(0.5, 0.95 - missingFields.length * 0.1),
      missing_fields: missingFields,
      generated_at: new Date().toISOString(),
    };
  }
}
