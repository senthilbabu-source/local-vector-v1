// ---------------------------------------------------------------------------
// lib/schema-expansion/generators/types.ts — Generator base types
//
// Sprint 106: Abstract base class for all schema generators.
// ---------------------------------------------------------------------------

import type { CrawledPage, PageType, GeneratedSchema, SchemaGeneratorInput } from '../types';

export type { SchemaGeneratorInput, GeneratedSchema, CrawledPage, PageType };

/**
 * Abstract base for all page schema generators.
 * Each generator handles one or more page types.
 */
export abstract class SchemaGenerator {
  abstract readonly supportsPageType: PageType[];

  abstract generate(input: SchemaGeneratorInput): Promise<GeneratedSchema>;

  /** Build BreadcrumbList for any page. */
  protected buildBreadcrumb(
    websiteUrl: string,
    pagePath: string,
    pageTitle: string,
  ): Record<string, unknown> {
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: websiteUrl },
        { '@type': 'ListItem', position: 2, name: pageTitle || 'Page', item: `${websiteUrl}${pagePath}` },
      ],
    };
  }

  /** Extract pathname from URL, defaulting to '/'. */
  protected getPathname(url: string): string {
    try {
      return new URL(url).pathname;
    } catch (_e) {
      return '/';
    }
  }

  /** Get the base URL (origin) from a full URL. */
  protected getOrigin(url: string): string {
    try {
      return new URL(url).origin;
    } catch (_e) {
      return url;
    }
  }
}
