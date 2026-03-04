// ---------------------------------------------------------------------------
// lib/reviews/banned-phrases.ts — Generic review-response banned phrases
// Extracted from actions.ts to avoid 'use server' async requirement (Next.js 16)
// ---------------------------------------------------------------------------

export const BANNED_PHRASES = [
  'as a valued customer',
  "we're so sorry for any inconvenience",
  'we value your feedback',
  'we apologize for any inconvenience',
  'thank you for bringing this to our attention',
  'we strive to provide',
  'your satisfaction is our priority',
];

export function hasBannedPhrases(text: string): { found: boolean; phrase: string | null } {
  const lower = text.toLowerCase();
  for (const phrase of BANNED_PHRASES) {
    if (lower.includes(phrase.toLowerCase())) {
      return { found: true, phrase };
    }
  }
  return { found: false, phrase: null };
}
