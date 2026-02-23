// ---------------------------------------------------------------------------
// scan-health-utils.ts — Pure date/time utilities for the AI Scan Health card
//
// Exported as a standalone module (no React imports) so unit tests can import
// them without a jsdom environment (AI_RULES §4).
// ---------------------------------------------------------------------------

/**
 * Formats an ISO 8601 date string as a human-readable relative time string.
 *
 * Examples:
 *   < 1 hour ago  → "just now"
 *   3 hours ago   → "3h ago"
 *   1 day ago     → "yesterday"
 *   4 days ago    → "4 days ago"
 *   10+ days ago  → "Jan 15"
 */
export function formatRelativeTime(isoDate: string): string {
  const diffMs   = Date.now() - new Date(isoDate).getTime();
  const diffHrs  = Math.floor(diffMs / 3_600_000);

  if (diffHrs < 1)  return 'just now';
  if (diffHrs < 24) return `${diffHrs}h ago`;

  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7)  return `${diffDays} days ago`;

  return new Date(isoDate).toLocaleDateString('en-US', {
    month: 'short',
    day:   'numeric',
  });
}

/**
 * Returns a short label for the next Sunday (e.g. "Mar 2", "Feb 28").
 * Always returns a future Sunday — never today, never a past date.
 *
 * Used in the "no scans yet" pending state:
 *   "First scan runs Sunday, Mar 2"
 */
export function nextSundayLabel(): string {
  const today = new Date();
  const day   = today.getDay();           // 0 = Sunday
  const skip  = day === 0 ? 7 : 7 - day; // days until next Sunday (never 0)
  const next  = new Date(today);
  next.setDate(today.getDate() + skip);
  return next.toLocaleDateString('en-US', {
    month: 'short',
    day:   'numeric',
  });
}
