// ---------------------------------------------------------------------------
// lib/content-brief/brief-quality-gate.ts — Pure Brief Quality Assessment
//
// P8-FIX-34: Wraps scoreContentHeuristic() with quality grade thresholds
// and actionable improvement suggestions. Used by both manual brief
// pipeline (brief-actions.ts) and autopilot (create-draft.ts).
//
// Pure functions — no I/O, no DB, no API calls.
// ---------------------------------------------------------------------------

import { scoreContentHeuristic, type ScoreContext } from '@/lib/autopilot/score-content';

// ── Types ─────────────────────────────────────────────

export type QualityGrade = 'publish_ready' | 'needs_review' | 'low_quality';

export interface QualityVerdict {
  score: number;
  grade: QualityGrade;
  suggestions: string[];
}

// ── Thresholds ────────────────────────────────────────

export const PUBLISH_READY_THRESHOLD = 75;
export const NEEDS_REVIEW_THRESHOLD = 50;

// ── Grade Assignment ──────────────────────────────────

/**
 * Map a numeric score to a quality grade.
 */
export function gradeFromScore(score: number): QualityGrade {
  if (score >= PUBLISH_READY_THRESHOLD) return 'publish_ready';
  if (score >= NEEDS_REVIEW_THRESHOLD) return 'needs_review';
  return 'low_quality';
}

// ── Suggestions Engine ────────────────────────────────

const CTA_PATTERNS = [
  /\breserv(e|ation)/i,
  /\bcall\b/i,
  /\bbook\b/i,
  /\bvisit\b/i,
  /\bdirection/i,
  /\border\b/i,
  /\bcontact\b/i,
  /\bschedule\b/i,
];

/**
 * Generate actionable suggestions to improve brief quality.
 * Returns up to 3 suggestions, ordered by impact.
 */
export function generateSuggestions(
  score: number,
  content: string,
  title: string,
  ctx: ScoreContext,
): string[] {
  if (score >= PUBLISH_READY_THRESHOLD) return [];

  const suggestions: string[] = [];
  const lower = content.toLowerCase();
  const firstSentence = (content.split(/[.!?]/)[0] ?? '').toLowerCase();
  const name = ctx.businessName.toLowerCase();
  const city = (ctx.city ?? '').toLowerCase();
  const wordCount = content.trim().split(/\s+/).length;

  // Check: business name in first sentence
  if (name && !firstSentence.includes(name)) {
    suggestions.push(
      'Add the business name to the opening sentence for better AI citation.',
    );
  }

  // Check: city reference anywhere
  if (city && !lower.includes(city)) {
    suggestions.push(
      'Include the city name in the content to improve local search relevance.',
    );
  }

  // Check: content length
  if (wordCount < 200) {
    suggestions.push(
      'Expand the content to at least 200 words for better coverage depth.',
    );
  }

  // Check: CTA presence
  const hasCTA = CTA_PATTERNS.some((p) => p.test(content));
  if (!hasCTA) {
    suggestions.push(
      'Add a call-to-action (e.g., "call", "visit", "reserve") to drive engagement.',
    );
  }

  // Check: title length
  if (title.length > 60) {
    suggestions.push(
      'Shorten the title to 60 characters or less for SEO best practices.',
    );
  }

  // Cap at 3 suggestions
  return suggestions.slice(0, 3);
}

// ── Main Assessment ───────────────────────────────────

/**
 * Assess content brief quality using the AEO scoring heuristic.
 * Returns a verdict with score, grade, and improvement suggestions.
 */
export function assessBriefQuality(
  content: string,
  title: string,
  ctx: ScoreContext,
): QualityVerdict {
  const score = scoreContentHeuristic(content, title, ctx);
  const grade = gradeFromScore(score);
  const suggestions = generateSuggestions(score, content, title, ctx);

  return { score, grade, suggestions };
}
