// ---------------------------------------------------------------------------
// lib/services/digest-preferences.ts — S54: Smart Digest Preferences
//
// Pure functions for digest frequency and section preferences.
// Validates user choices. No I/O — callers handle DB read/write.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DigestFrequency = 'weekly' | 'biweekly' | 'monthly';

export const DIGEST_FREQUENCIES: DigestFrequency[] = ['weekly', 'biweekly', 'monthly'];

export type DigestSection =
  | 'score'
  | 'errors'
  | 'competitors'
  | 'wins'
  | 'recommendations';

export const ALL_DIGEST_SECTIONS: DigestSection[] = [
  'score',
  'errors',
  'competitors',
  'wins',
  'recommendations',
];

export interface DigestPreferences {
  frequency: DigestFrequency;
  sections: DigestSection[];
}

export const DEFAULT_DIGEST_PREFERENCES: DigestPreferences = {
  frequency: 'weekly',
  sections: ['score', 'errors', 'competitors', 'wins', 'recommendations'],
};

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

/**
 * Validates a digest frequency string. Returns the validated value or default.
 */
export function validateFrequency(value: unknown): DigestFrequency {
  if (typeof value === 'string' && DIGEST_FREQUENCIES.includes(value as DigestFrequency)) {
    return value as DigestFrequency;
  }
  return 'weekly';
}

/**
 * Validates an array of section names. Filters out invalid entries.
 */
export function validateSections(value: unknown): DigestSection[] {
  if (!Array.isArray(value)) return ALL_DIGEST_SECTIONS;
  const valid = value.filter(
    (s): s is DigestSection =>
      typeof s === 'string' && ALL_DIGEST_SECTIONS.includes(s as DigestSection),
  );
  // Must have at least 'score' section
  if (valid.length === 0) return ['score'];
  return valid;
}

/**
 * Checks if a digest should be sent based on frequency and last sent date.
 */
export function shouldSendDigest(
  frequency: DigestFrequency,
  lastSentAt: string | null,
  now = new Date(),
): boolean {
  if (!lastSentAt) return true;

  const lastSent = new Date(lastSentAt);
  const diffDays = Math.floor(
    (now.getTime() - lastSent.getTime()) / (24 * 60 * 60 * 1000),
  );

  switch (frequency) {
    case 'weekly':
      return diffDays >= 7;
    case 'biweekly':
      return diffDays >= 14;
    case 'monthly':
      return diffDays >= 28;
  }
}

/**
 * Returns a human-readable label for a digest frequency.
 */
export function getFrequencyLabel(frequency: DigestFrequency): string {
  switch (frequency) {
    case 'weekly':
      return 'Every week';
    case 'biweekly':
      return 'Every 2 weeks';
    case 'monthly':
      return 'Every month';
  }
}

/**
 * Returns a human-readable label for a digest section.
 */
export function getSectionLabel(section: DigestSection): string {
  switch (section) {
    case 'score':
      return 'AI Health Score';
    case 'errors':
      return 'AI Errors & Fixes';
    case 'competitors':
      return 'Competitor Activity';
    case 'wins':
      return 'Recent Wins';
    case 'recommendations':
      return 'Recommendations';
  }
}
