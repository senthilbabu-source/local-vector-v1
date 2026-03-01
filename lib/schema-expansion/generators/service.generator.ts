// ---------------------------------------------------------------------------
// lib/schema-expansion/generators/service.generator.ts
//
// Sprint 106: Generates Service schema for service-specific pages
// (e.g. /hookah-service, /private-events, /vip-packages, /catering).
// ---------------------------------------------------------------------------

import { SchemaGenerator } from './types';
import type { SchemaGeneratorInput, GeneratedSchema, PageType } from './types';

export class ServiceGenerator extends SchemaGenerator {
  readonly supportsPageType: PageType[] = ['service'];

  async generate(input: SchemaGeneratorInput): Promise<GeneratedSchema> {
    const { groundTruth, page } = input;
    const missingFields: string[] = [];

    const serviceName = page.h1 || page.title || 'Service';

    const serviceSchema: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: serviceName,
      url: page.url,
      provider: {
        '@type': 'Organization',
        name: groundTruth.name,
        ...(groundTruth.website && { url: groundTruth.website }),
        address: {
          '@type': 'PostalAddress',
          streetAddress: groundTruth.address,
          addressLocality: groundTruth.city,
          addressRegion: groundTruth.state,
          postalCode: groundTruth.zip,
          addressCountry: 'US',
        },
      },
      areaServed: {
        '@type': 'City',
        name: `${groundTruth.city}, ${groundTruth.state}`,
      },
    };

    // Extract service type from heading
    if (page.h1) {
      serviceSchema.serviceType = page.h1;
    } else {
      missingFields.push('serviceType');
    }

    // Description
    if (page.meta_description) {
      serviceSchema.description = page.meta_description;
    } else if (page.body_excerpt) {
      serviceSchema.description = page.body_excerpt.slice(0, 300);
    } else {
      missingFields.push('description');
    }

    const websiteUrl = groundTruth.website ?? page.url;
    const breadcrumb = this.buildBreadcrumb(
      this.getOrigin(websiteUrl),
      this.getPathname(page.url),
      page.title ?? serviceName,
    );

    return {
      page_type: 'service',
      schema_types: ['Service', 'BreadcrumbList'],
      json_ld: [serviceSchema, breadcrumb],
      confidence: missingFields.length === 0 ? 0.85 : Math.max(0.5, 0.85 - missingFields.length * 0.1),
      missing_fields: missingFields,
      generated_at: new Date().toISOString(),
    };
  }
}
