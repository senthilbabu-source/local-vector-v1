// ---------------------------------------------------------------------------
// lib/types/occasions.ts — Occasion Engine Types
//
// TypeScript interfaces for the Occasion Engine scheduler and draft pipeline.
// Spec: docs/16-OCCASION-ENGINE.md §8
// ---------------------------------------------------------------------------

export interface OccasionQueryPattern {
  query: string;
  category: string;
}

export interface LocalOccasionRow {
  id: string;
  name: string;
  occasion_type: string; // 'holiday' | 'celebration' | 'recurring' | 'seasonal'
  trigger_days_before: number;
  annual_date: string | null; // MM-DD format or null (evergreen)
  peak_query_patterns: OccasionQueryPattern[];
  relevant_categories: string[];
  is_active: boolean;
}

export interface OccasionAlert {
  occasionId: string;
  occasionName: string;
  occasionType: string;
  daysUntilPeak: number;
  peakQueryPatterns: OccasionQueryPattern[];
  citedForAnyQuery: boolean;
  autoDraftTriggered: boolean;
  autoDraftId: string | null;
}

export interface OccasionSchedulerResult {
  orgId: string;
  locationId: string;
  alerts: OccasionAlert[];
  alertsFired: number;
  alertsSkipped: number; // deduped by Redis
  draftsCreated: number;
}
