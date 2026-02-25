// ---------------------------------------------------------------------------
// lib/types/citations.ts — Citation Intelligence TypeScript Interfaces
//
// Types for the citation intelligence cron and gap scoring system.
// Spec: docs/18-CITATION-INTELLIGENCE.md §9
// ---------------------------------------------------------------------------

/** Row shape from the citation_source_intelligence table. */
export interface CitationSourceIntelligence {
  id: string;
  business_category: string;
  city: string;
  state: string;
  platform: string;
  citation_frequency: number; // 0.0–1.0
  sample_query: string | null;
  sample_size: number;
  model_provider: string;
  measured_at: string;
}

/** Platform citation count accumulated during a single category+metro sample run. */
export interface PlatformCitationCounts {
  [platform: string]: number;
}

/** Result of a single Perplexity citation query. */
export interface CitationQueryResult {
  queryText: string;
  citedUrls: string[];
  success: boolean;
}

/** Output of calculateCitationGapScore(). */
export interface CitationGapSummary {
  gapScore: number; // 0–100
  platformsCovered: number;
  platformsThatMatter: number;
  topGap: {
    platform: string;
    citationFrequency: number;
    action: string;
  } | null;
}

/** A tenant listing row (subset of the listings table joined with directories). */
export interface TenantListing {
  directory: string; // directories.name (e.g. 'yelp', 'google')
  sync_status: string;
}

/** Summary returned by the citation cron route. */
export interface CitationCronSummary {
  ok: boolean;
  halted?: boolean;
  categories_processed: number;
  metros_processed: number;
  platforms_found: number;
  queries_run: number;
  errors: number;
}
