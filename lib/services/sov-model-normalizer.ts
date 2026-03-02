// ---------------------------------------------------------------------------
// lib/services/sov-model-normalizer.ts — Citation Detection for Multi-Model SOV
//
// Sprint 123: Normalizes AI model responses into a common citation result format.
// Uses the SAME fuzzy matching logic as the existing SOV engine
// (sov-engine.service.ts) — case-insensitive substring check.
//
// detectCitation() is a PURE FUNCTION — no API calls, no side effects.
// ---------------------------------------------------------------------------

export interface NormalizedCitationResult {
  cited: boolean;
  citation_count: number;
  /** First 1000 chars of raw response */
  ai_response_excerpt: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Normalize a string for comparison: lowercase, strip common punctuation
 * variations ("&" → "and", "n'" → "and", remove leading "The ").
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/\bthe\s+/g, '')        // strip leading "The "
    .replace(/\s*&\s*/g, ' and ')    // "Charcoal & Chill" → "Charcoal and Chill"
    .replace(/\s*'n'\s*/g, ' and ')  // informal "'n'"
    .replace(/\bn\b/g, 'and')        // standalone "N" → "and" (e.g. "Charcoal N Chill")
    .replace(/[''`]/g, '')           // remove apostrophes
    .replace(/[^\w\s]/g, '')         // remove remaining punctuation
    .replace(/\s+/g, ' ')           // collapse whitespace
    .trim();
}

/**
 * Count non-overlapping occurrences of `needle` in `haystack` (case-insensitive).
 */
function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  let count = 0;
  let pos = 0;
  while ((pos = h.indexOf(n, pos)) !== -1) {
    count++;
    pos += n.length;
  }
  return count;
}

/**
 * Detect whether an AI model response cites/mentions a given business.
 *
 * Uses the SAME approach as the existing SOV engine:
 * - Case-insensitive substring matching
 * - Bidirectional: checks if orgName is in response AND if response contains orgName
 *
 * Confidence levels:
 * - 'high': orgName appears verbatim (exact case-insensitive match)
 * - 'medium': normalized form matches (e.g. "Charcoal & Chill" vs "Charcoal and Chill")
 * - 'low': no match found
 *
 * @param responseText — the AI model's raw response text
 * @param orgName — the organization/business name to detect
 */
export function detectCitation(
  responseText: string | null | undefined,
  orgName: string,
): NormalizedCitationResult {
  const excerpt = (responseText ?? '').slice(0, 1000);

  if (!responseText || !orgName) {
    return {
      cited: false,
      citation_count: 0,
      ai_response_excerpt: excerpt,
      confidence: 'low',
    };
  }

  const responseLower = responseText.toLowerCase();
  const orgNameLower = orgName.toLowerCase();

  // Check 1: Verbatim match (same as sov-engine.service.ts fuzzy match)
  const exactMatch =
    responseLower.includes(orgNameLower) || orgNameLower.includes(responseLower);

  if (exactMatch) {
    const count = countOccurrences(responseText, orgName);
    return {
      cited: true,
      citation_count: Math.max(count, 1),
      ai_response_excerpt: excerpt,
      confidence: 'high',
    };
  }

  // Check 2: Normalized match (handles "N" vs "&", stripped punctuation)
  const normalizedResponse = normalize(responseText);
  const normalizedOrg = normalize(orgName);

  const normalizedMatch =
    normalizedResponse.includes(normalizedOrg) ||
    normalizedOrg.includes(normalizedResponse);

  if (normalizedMatch && normalizedOrg.length >= 3) {
    // Count normalized occurrences
    const count = countOccurrences(normalizedResponse, normalizedOrg);
    return {
      cited: true,
      citation_count: Math.max(count, 1),
      ai_response_excerpt: excerpt,
      confidence: 'medium',
    };
  }

  return {
    cited: false,
    citation_count: 0,
    ai_response_excerpt: excerpt,
    confidence: 'low',
  };
}
