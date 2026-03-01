// ---------------------------------------------------------------------------
// lib/schema-expansion/types.ts — Schema Expansion Engine shared types
//
// Sprint 106: Crawl → Classify → Generate JSON-LD → Host → Monitor.
// All components in the schema-expansion module import from here.
// ---------------------------------------------------------------------------

import type { GroundTruth } from '@/lib/nap-sync/types';

// Re-export for convenience — consumers shouldn't need to import from nap-sync
export type { GroundTruth };

// ---------------------------------------------------------------------------
// Page Types
// ---------------------------------------------------------------------------

export type PageType =
  | 'homepage'
  | 'about'
  | 'faq'
  | 'event'
  | 'blog_post'
  | 'service'
  | 'menu'      // Magic Engine — skip schema generation
  | 'other';

// ---------------------------------------------------------------------------
// Crawler Types
// ---------------------------------------------------------------------------

export interface FAQ {
  question: string;
  answer: string;
}

export interface EventData {
  name: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  location?: string;
}

export interface CrawledPage {
  url: string;
  page_type: PageType;
  title: string | null;
  meta_description: string | null;
  h1: string | null;
  body_excerpt: string;
  detected_faqs: FAQ[];
  detected_events: EventData[];
  crawled_at: string;
  http_status: number;
  error?: string;
}

export interface CrawlResult {
  pages: CrawledPage[];
  sitemap_found: boolean;
  robots_respected: boolean;
}

export const MAX_PAGES_PER_PLAN: Record<string, number> = {
  trial: 5,
  starter: 10,
  growth: 30,
  agency: 50,
};

// ---------------------------------------------------------------------------
// Generator Types
// ---------------------------------------------------------------------------

export interface SchemaGeneratorInput {
  groundTruth: GroundTruth;
  page: CrawledPage;
  orgId: string;
  locationId: string;
  /** Optional: platform listing URLs for sameAs links */
  sameAsUrls?: string[];
  /** Optional: location amenities */
  amenities?: Record<string, boolean> | null;
  /** Optional: location categories */
  categories?: string[] | null;
  /** Optional: latitude/longitude for geo */
  latitude?: number | null;
  longitude?: number | null;
}

export interface GeneratedSchema {
  page_type: PageType;
  schema_types: string[];
  json_ld: Record<string, unknown>[];
  confidence: number;
  missing_fields: string[];
  generated_at: string;
}

// ---------------------------------------------------------------------------
// Service Types
// ---------------------------------------------------------------------------

export interface PageSchemaResult {
  url: string;
  page_type: PageType;
  status: 'published' | 'pending_review' | 'failed' | 'skipped';
  schema_types: string[];
  public_url?: string;
  error?: string;
}

export interface SchemaExpansionResult {
  location_id: string;
  org_id: string;
  pages_crawled: number;
  schemas_generated: number;
  schemas_published: number;
  schemas_pending_review: number;
  schema_health_score: number;
  page_results: PageSchemaResult[];
  run_at: string;
}

// ---------------------------------------------------------------------------
// API Response Types
// ---------------------------------------------------------------------------

export interface SchemaStatusResponse {
  schema_health_score: number | null;
  pages: Array<{
    id: string;
    page_url: string;
    page_type: PageType;
    schema_types: string[];
    status: string;
    embed_snippet: string | null;
    public_url: string | null;
    human_approved: boolean;
    confidence: number | null;
    missing_fields: string[];
    published_at: string | null;
    last_crawled_at: string;
  }>;
  last_run_at: string | null;
}
