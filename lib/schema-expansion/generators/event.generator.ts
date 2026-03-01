// ---------------------------------------------------------------------------
// lib/schema-expansion/generators/event.generator.ts
//
// Sprint 106: Generates Event schema from extracted event data.
// ---------------------------------------------------------------------------

import { SchemaGenerator } from './types';
import type { SchemaGeneratorInput, GeneratedSchema, PageType } from './types';

export class EventGenerator extends SchemaGenerator {
  readonly supportsPageType: PageType[] = ['event'];

  async generate(input: SchemaGeneratorInput): Promise<GeneratedSchema> {
    const { groundTruth, page } = input;
    const missingFields: string[] = [];
    const detectedEvents = page.detected_events;

    if (detectedEvents.length === 0) {
      missingFields.push('no_events_detected');
    }

    const eventSchemas: Record<string, unknown>[] = detectedEvents.slice(0, 5).map((event) => {
      const eventSchema: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'Event',
        name: event.name,
        eventStatus: 'https://schema.org/EventScheduled',
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        location: {
          '@type': 'Place',
          name: groundTruth.name,
          address: {
            '@type': 'PostalAddress',
            streetAddress: groundTruth.address,
            addressLocality: groundTruth.city,
            addressRegion: groundTruth.state,
            postalCode: groundTruth.zip,
            addressCountry: 'US',
          },
        },
        organizer: {
          '@type': 'Organization',
          name: groundTruth.name,
          ...(groundTruth.website && { url: groundTruth.website }),
        },
      };

      if (event.startDate) {
        eventSchema.startDate = event.startDate;
      } else {
        // Recurring event — use EventSchedule
        eventSchema.eventSchedule = {
          '@type': 'Schedule',
          repeatFrequency: 'P1W',
        };
      }

      if (event.endDate) {
        eventSchema.endDate = event.endDate;
      }

      if (event.description) {
        eventSchema.description = event.description;
      }

      return eventSchema;
    });

    const websiteUrl = groundTruth.website ?? page.url;
    const breadcrumb = this.buildBreadcrumb(
      this.getOrigin(websiteUrl),
      this.getPathname(page.url),
      page.title ?? 'Events',
    );

    const allSchemas = eventSchemas.length > 0 ? [...eventSchemas, breadcrumb] : [breadcrumb];
    const schemaTypes = eventSchemas.length > 0 ? ['Event', 'BreadcrumbList'] : ['BreadcrumbList'];

    return {
      page_type: 'event',
      schema_types: schemaTypes,
      json_ld: allSchemas,
      confidence: detectedEvents.length > 0 ? 0.8 : 0.3,
      missing_fields: missingFields,
      generated_at: new Date().toISOString(),
    };
  }
}
