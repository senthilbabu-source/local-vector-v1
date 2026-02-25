// ---------------------------------------------------------------------------
// lib/types/prompt-intelligence.ts — Prompt Intelligence TypeScript Interfaces
//
// Types for the Prompt Intelligence gap detection engine.
// Spec: docs/15-LOCAL-PROMPT-INTELLIGENCE.md §9
// ---------------------------------------------------------------------------

export type GapType = 'untracked' | 'competitor_discovered' | 'zero_citation_cluster';
export type GapImpact = 'high' | 'medium' | 'low';
export type QueryCategory = 'discovery' | 'comparison' | 'occasion' | 'near_me' | 'custom';

export interface QueryGap {
  gapType: GapType;
  queryText: string;
  queryCategory: QueryCategory;
  estimatedImpact: GapImpact;
  suggestedAction: string;
}

export interface ReferenceQuery {
  queryText: string;
  queryCategory: QueryCategory;
  priority: number;
}

export interface CategoryBreakdown {
  citedCount: number;
  totalCount: number;
  citationRate: number;
}

export interface PromptGapReport {
  locationId: string;
  orgId: string;
  totalActiveQueries: number;
  totalReferenceQueries: number;
  coveragePercent: number;
  gaps: QueryGap[];
  categoryBreakdown: Record<QueryCategory, CategoryBreakdown>;
  generatedAt: string;
}
