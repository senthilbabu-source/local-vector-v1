// ---------------------------------------------------------------------------
// lib/onboarding/sample-data.ts — Sample Data for Empty Dashboards (Sprint 117)
//
// Realistic sample data displayed to new users before their first automated
// scan. All values are clearly fictional and labelled with _is_sample: true.
//
// SampleDataBanner must be shown above any component rendering this data.
// ---------------------------------------------------------------------------

export interface SampleSovData {
  _is_sample: true;
  share_of_voice: number;
  previous_share_of_voice: number;
  delta: number;
  total_queries: number;
  cited_count: number;
  trend: 'up' | 'down' | 'flat';
}

export interface SampleCitation {
  query_text: string;
  label: string;
}

export interface SampleMissedQuery {
  query_text: string;
  label: string;
}

export interface SampleContentDraft {
  title: string;
  status: 'draft';
  trigger_type: 'sov_gap';
}

export interface SampleFirstMoverAlert {
  query_text: string;
  message: string;
}

/**
 * Sample SOV data for new orgs.
 * SOV 34% (first run — room for improvement, motivating).
 * Previous week 29 (positive trend).
 */
export const SAMPLE_SOV_DATA: SampleSovData = {
  _is_sample: true,
  share_of_voice: 34,
  previous_share_of_voice: 29,
  delta: 5,
  total_queries: 12,
  cited_count: 4,
  trend: 'up',
};

/** Where the business was cited (4 motivating examples). */
export const SAMPLE_CITATION_EXAMPLES: SampleCitation[] = [
  { query_text: 'best restaurant near downtown', label: 'Cited as top pick' },
  { query_text: 'upscale dining experience near me', label: 'Cited as recommended' },
  { query_text: 'places to eat with private events', label: 'Cited as option' },
  { query_text: 'late night dining options', label: 'Cited in results' },
];

/** Queries not yet winning (4 opportunities). */
export const SAMPLE_MISSING_QUERIES: SampleMissedQuery[] = [
  { query_text: 'restaurant with outdoor seating', label: 'Not yet cited — content opportunity' },
  { query_text: 'best brunch spots this weekend', label: 'Not yet cited — content opportunity' },
  { query_text: 'family friendly dining options', label: 'Not yet cited — content opportunity' },
  { query_text: 'catering services for corporate events', label: 'Not yet cited — content opportunity' },
];

/** One example content draft (pure display — not created in DB). */
export const SAMPLE_CONTENT_DRAFT: SampleContentDraft = {
  title: "Why Your Business Is the Best Choice for Local Dining",
  status: 'draft',
  trigger_type: 'sov_gap',
};

/** One example first mover alert. */
export const SAMPLE_FIRST_MOVER_ALERT: SampleFirstMoverAlert = {
  query_text: 'restaurant for private events near me',
  message: 'No business is being recommended for this query. Be first.',
};

/**
 * Returns true if the passed data object is the sample dataset.
 * Checks for the `_is_sample` sentinel property.
 */
export function isSampleData(data: unknown): data is { _is_sample: true } {
  return (
    typeof data === 'object' &&
    data !== null &&
    '_is_sample' in data &&
    (data as Record<string, unknown>)._is_sample === true
  );
}
