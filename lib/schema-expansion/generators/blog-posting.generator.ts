// ---------------------------------------------------------------------------
// lib/schema-expansion/generators/blog-posting.generator.ts
//
// Sprint 106: Generates BlogPosting (or Article) schema.
// IMPORTANT: Never fabricates datePublished if not found — omits the field.
// ---------------------------------------------------------------------------

import { SchemaGenerator } from './types';
import type { SchemaGeneratorInput, GeneratedSchema, PageType } from './types';

// Common date patterns to extract from page content
const ISO_DATE_PATTERN = /\d{4}-\d{2}-\d{2}/;
const US_DATE_PATTERN = /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s*\d{4}/i;
const TIME_DATETIME_PATTERN = /<time[^>]+datetime=["']([^"']+)["']/i;

export class BlogPostingGenerator extends SchemaGenerator {
  readonly supportsPageType: PageType[] = ['blog_post'];

  async generate(input: SchemaGeneratorInput): Promise<GeneratedSchema> {
    const { groundTruth, page } = input;
    const missingFields: string[] = [];

    const blogPosting: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: page.h1 || page.title || groundTruth.name,
      url: page.url,
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': page.url,
      },
      author: {
        '@type': 'Organization',
        name: groundTruth.name,
        ...(groundTruth.website && { url: groundTruth.website }),
      },
      publisher: {
        '@type': 'Organization',
        name: groundTruth.name,
        ...(groundTruth.website && { url: groundTruth.website }),
      },
    };

    // Description
    if (page.meta_description) {
      blogPosting.description = page.meta_description;
    } else {
      missingFields.push('description');
    }

    // Date extraction — never fabricate
    const datePublished = this.extractDate(page.body_excerpt);
    if (datePublished) {
      blogPosting.datePublished = datePublished;
      blogPosting.dateModified = datePublished;
    } else {
      missingFields.push('datePublished');
    }

    const websiteUrl = groundTruth.website ?? page.url;
    const breadcrumb = this.buildBreadcrumb(
      this.getOrigin(websiteUrl),
      this.getPathname(page.url),
      page.title ?? 'Blog',
    );

    return {
      page_type: 'blog_post',
      schema_types: ['BlogPosting', 'BreadcrumbList'],
      json_ld: [blogPosting, breadcrumb],
      confidence: missingFields.length === 0 ? 0.85 : Math.max(0.5, 0.85 - missingFields.length * 0.1),
      missing_fields: missingFields,
      generated_at: new Date().toISOString(),
    };
  }

  private extractDate(bodyExcerpt: string): string | null {
    // Try <time datetime="..."> first
    const timeMatch = TIME_DATETIME_PATTERN.exec(bodyExcerpt);
    if (timeMatch?.[1]) return timeMatch[1];

    // Try ISO date
    const isoMatch = ISO_DATE_PATTERN.exec(bodyExcerpt);
    if (isoMatch?.[0]) return isoMatch[0];

    // Try US date
    const usMatch = US_DATE_PATTERN.exec(bodyExcerpt);
    if (usMatch?.[0]) {
      try {
        const date = new Date(usMatch[0]);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
      } catch {
        // Invalid date — skip
      }
    }

    return null;
  }
}
