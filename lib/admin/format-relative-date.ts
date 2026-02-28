// ---------------------------------------------------------------------------
// lib/admin/format-relative-date.ts — Sprint D (L1): Date formatting utility
//
// Uses Intl.RelativeTimeFormat — no date library dependency.
// ---------------------------------------------------------------------------

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 60 * 60 * 1000],
  ['month', 30 * 24 * 60 * 60 * 1000],
  ['week', 7 * 24 * 60 * 60 * 1000],
  ['day', 24 * 60 * 60 * 1000],
  ['hour', 60 * 60 * 1000],
  ['minute', 60 * 1000],
];

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/**
 * Formats an ISO timestamp to a human-readable relative time string.
 * Examples: "3 days ago", "just now", "2 weeks ago", "last month"
 */
export function formatRelativeDate(isoDate: string | null | undefined): string {
  if (!isoDate) return '—';

  const date = new Date(isoDate);
  if (isNaN(date.getTime())) return '—';

  const diffMs = date.getTime() - Date.now();
  const absDiff = Math.abs(diffMs);

  // Less than 1 minute → "just now"
  if (absDiff < 60 * 1000) return 'just now';

  for (const [unit, ms] of UNITS) {
    if (absDiff >= ms) {
      const value = Math.round(diffMs / ms);
      return rtf.format(value, unit);
    }
  }

  return 'just now';
}
