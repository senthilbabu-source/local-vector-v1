// ---------------------------------------------------------------------------
// lib/sample-data/use-sample-mode.ts — Sprint B (C4)
//
// Pure function that determines whether sample mode is active for the current org.
// Can be called on the server (no 'use client') — it's a simple boolean check.
// ---------------------------------------------------------------------------

/**
 * Returns true if the org has no real scan data yet and should display sample data.
 *
 * Criteria:
 *   - realityScore is null (no SOV snapshot yet)
 *   - org was created less than 14 days ago
 *
 * After 14 days, stop showing sample data even if no scan has run.
 * This prevents stale sample data from persisting indefinitely.
 */
export function isSampleMode(
  realityScore: number | null,
  orgCreatedAt: string | null,
): boolean {
  if (realityScore !== null) return false;
  if (!orgCreatedAt) return false;
  const created = new Date(orgCreatedAt);
  if (isNaN(created.getTime())) return false;
  const ageMs = Date.now() - created.getTime();
  const fourteenDays = 14 * 24 * 60 * 60 * 1000;
  return ageMs < fourteenDays;
}
