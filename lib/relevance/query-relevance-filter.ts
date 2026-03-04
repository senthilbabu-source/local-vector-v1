// ---------------------------------------------------------------------------
// lib/relevance/query-relevance-filter.ts — Ground Truth Relevance Filter
//
// Pure function: query + business ground truth → relevance verdict.
// No I/O, no DB calls, no side effects. Fully deterministic.
//
// Used by: SOV seeding, gap display, revenue calculator, digest emails,
// First Mover cards, autopilot triggers, and any surface that recommends.
// ---------------------------------------------------------------------------

import type { HoursData, DayHours } from '@/lib/types/ground-truth';
import type {
  QueryInput,
  BusinessGroundTruth,
  QueryRelevanceResult,
  RelevanceVerdict,
  SuggestedAction,
} from './types';
import { TIME_PATTERNS, AMENITY_PATTERNS, SERVICE_KEYWORDS } from './keyword-patterns';

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Parse "HH:MM" → minutes since midnight.
 * Returns null for malformed input.
 */
function parseTime(t: string): number | null {
  const parts = t.split(':');
  if (parts.length !== 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/**
 * Check if the business is open before a given time on ANY day.
 * "Open before 12:00" means the opening time is before 12:00.
 */
function hasAnyDayOpenBefore(hours: HoursData, beforeTime: string): boolean {
  const threshold = parseTime(beforeTime);
  if (threshold === null) return false;

  for (const day of Object.values(hours)) {
    if (day === 'closed' || day === undefined) continue;
    const openMin = parseTime((day as DayHours).open);
    if (openMin !== null && openMin < threshold) return true;
  }
  return false;
}

/**
 * Check if the business is open after a given time on ANY day.
 * "Open after 23:00" means either:
 *   - close time is after 23:00 on the same day, OR
 *   - close time wraps past midnight (close < open, e.g., 02:00)
 */
function hasAnyDayOpenAfter(hours: HoursData, afterTime: string): boolean {
  const threshold = parseTime(afterTime);
  if (threshold === null) return false;

  for (const day of Object.values(hours)) {
    if (day === 'closed' || day === undefined) continue;
    const dh = day as DayHours;
    const openMin = parseTime(dh.open);
    const closeMin = parseTime(dh.close);
    if (openMin === null || closeMin === null) continue;

    // Wraps past midnight (e.g., open 17:00, close 02:00)
    if (closeMin < openMin) return true;

    // Closes after the threshold on the same day
    if (closeMin > threshold) return true;
  }
  return false;
}

/**
 * Case-insensitive check: does queryText contain any keyword from the list?
 * Returns the first matched keyword or null.
 */
function matchesAnyKeyword(queryLower: string, keywords: string[]): string | null {
  for (const kw of keywords) {
    if (queryLower.includes(kw.toLowerCase())) return kw;
  }
  return null;
}

/**
 * Check if any business category contains a hint string (case-insensitive).
 */
function categoryMatchesAny(categories: string[], hints: string[]): boolean {
  const catsLower = categories.map((c) => c.toLowerCase());
  return hints.some((hint) =>
    catsLower.some((cat) => cat.includes(hint.toLowerCase()))
  );
}

// ── Suggested Action Builders ───────────────────────────────────────────────

function suggestContentDraft(queryText: string, reason: string): SuggestedAction {
  return {
    type: 'content_draft',
    label: `Create content about: ${reason}`,
    prefillData: { target_prompt: queryText, trigger_reason: reason },
  };
}

function suggestFaqGeneration(queryText: string): SuggestedAction {
  return {
    type: 'faq_generation',
    label: 'Add this to your FAQ page',
    prefillData: { target_prompt: queryText },
  };
}

// ── Main Filter ─────────────────────────────────────────────────────────────

/**
 * Score the relevance of a query against business ground truth.
 *
 * Rules applied in order (first match wins):
 * 1. Comparison & custom queries → always relevant (user explicitly chose)
 * 2. Business temporarily closed → not applicable for all queries
 * 3. Time-of-day check → reject if business can't serve that time
 * 4. Amenity check → reject if business lacks the amenity
 * 5. Service check → aspirational if not in categories
 * 6. Default → relevant with low confidence (don't filter what we can't understand)
 */
export function scoreQueryRelevance(
  query: QueryInput,
  groundTruth: BusinessGroundTruth,
): QueryRelevanceResult {
  const queryLower = query.queryText.toLowerCase();

  // ── Rule 1: Comparison & custom → always relevant ──────────────────────
  if (query.queryCategory === 'comparison' || query.queryCategory === 'custom') {
    return {
      verdict: 'relevant',
      relevant: true,
      reason: query.queryCategory === 'comparison'
        ? 'Comparison queries are always tracked'
        : 'Custom queries are always tracked',
      confidence: 'high',
      groundTruthFields: [],
      suggestedAction: suggestContentDraft(query.queryText, 'competitive positioning'),
    };
  }

  // ── Rule 2: Temporarily closed → not applicable ────────────────────────
  if (
    groundTruth.operationalStatus &&
    ['temporarily_closed', 'closed_temporarily', 'permanently_closed', 'closed_permanently']
      .includes(groundTruth.operationalStatus.toLowerCase().replace(/\s+/g, '_'))
  ) {
    return {
      verdict: 'not_applicable',
      relevant: false,
      reason: `Business is ${groundTruth.operationalStatus.toLowerCase().replace(/_/g, ' ')}`,
      confidence: 'high',
      groundTruthFields: ['operationalStatus'],
    };
  }

  // ── Rule 3: Time-of-day check ──────────────────────────────────────────
  if (groundTruth.hoursData) {
    for (const pattern of TIME_PATTERNS) {
      const matched = matchesAnyKeyword(queryLower, pattern.keywords);
      if (!matched) continue;

      if (pattern.requiresOpenBefore) {
        if (!hasAnyDayOpenBefore(groundTruth.hoursData, pattern.requiresOpenBefore)) {
          return {
            verdict: 'not_applicable',
            relevant: false,
            reason: `"${matched}" requires opening before ${pattern.requiresOpenBefore} — your earliest opening is later`,
            confidence: 'high',
            groundTruthFields: ['hoursData'],
          };
        }
      }

      if (pattern.requiresOpenAfter) {
        if (!hasAnyDayOpenAfter(groundTruth.hoursData, pattern.requiresOpenAfter)) {
          return {
            verdict: 'not_applicable',
            relevant: false,
            reason: `"${matched}" requires being open past ${pattern.requiresOpenAfter} — you close earlier`,
            confidence: 'high',
            groundTruthFields: ['hoursData'],
          };
        }
      }
    }
  }

  // ── Rule 4: Amenity check ──────────────────────────────────────────────
  if (groundTruth.amenities) {
    for (const pattern of AMENITY_PATTERNS) {
      const matched = matchesAnyKeyword(queryLower, pattern.keywords);
      if (!matched) continue;

      const amenityValue = groundTruth.amenities[pattern.amenityKey];

      if (amenityValue === true) {
        // Business HAS this amenity — relevant, suggest content
        return {
          verdict: 'relevant',
          relevant: true,
          reason: `You have ${matched} — AI just doesn't know yet`,
          confidence: 'high',
          groundTruthFields: ['amenities'],
          suggestedAction: suggestContentDraft(query.queryText, matched),
        };
      }

      if (amenityValue === false) {
        // Business explicitly does NOT have this amenity
        return {
          verdict: 'not_applicable',
          relevant: false,
          reason: `You don't have ${matched}`,
          confidence: 'high',
          groundTruthFields: ['amenities'],
        };
      }

      // amenityValue is undefined — amenity not set in ground truth.
      // Can't determine relevance. Fall through to default.
    }
  }

  // ── Rule 5: Service check ──────────────────────────────────────────────
  for (const svc of SERVICE_KEYWORDS) {
    if (!queryLower.includes(svc.keyword.toLowerCase())) continue;

    if (groundTruth.categories && categoryMatchesAny(groundTruth.categories, svc.categoryHints)) {
      return {
        verdict: 'relevant',
        relevant: true,
        reason: `${svc.keyword} matches your business categories`,
        confidence: 'medium',
        groundTruthFields: ['categories'],
        suggestedAction: suggestContentDraft(query.queryText, svc.keyword),
      };
    }

    // Category doesn't include the service — aspirational
    return {
      verdict: 'aspirational',
      relevant: false,
      reason: `You don't currently offer ${svc.keyword} — you could add it`,
      confidence: 'medium',
      groundTruthFields: ['categories'],
    };
  }

  // ── Rule 6: Default → relevant ─────────────────────────────────────────
  // If no pattern matched, we can't determine irrelevance.
  // Default to relevant with low confidence — don't hide what we can't assess.
  return {
    verdict: 'relevant',
    relevant: true,
    reason: 'No conflicting ground truth found',
    confidence: 'low',
    groundTruthFields: [],
    suggestedAction: suggestContentDraft(query.queryText, query.queryText),
  };
}

// ── Batch Helper ────────────────────────────────────────────────────────────

/**
 * Score multiple queries at once against the same ground truth.
 * Convenience wrapper — same semantics as calling scoreQueryRelevance per query.
 */
export function scoreQueriesBatch(
  queries: QueryInput[],
  groundTruth: BusinessGroundTruth,
): Map<string, QueryRelevanceResult> {
  const results = new Map<string, QueryRelevanceResult>();
  for (const q of queries) {
    results.set(q.queryText, scoreQueryRelevance(q, groundTruth));
  }
  return results;
}

/**
 * Filter a list of queries to only those that are relevant to the business.
 * Removes not_applicable queries. Keeps relevant and aspirational.
 */
export function filterRelevantQueries(
  queries: QueryInput[],
  groundTruth: BusinessGroundTruth,
): QueryInput[] {
  return queries.filter((q) => {
    const result = scoreQueryRelevance(q, groundTruth);
    return result.verdict !== 'not_applicable';
  });
}
