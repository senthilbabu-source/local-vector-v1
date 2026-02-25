// ---------------------------------------------------------------------------
// lib/autopilot/score-content.ts — Lightweight AEO Scoring Heuristic
//
// Pure function (no API calls) for instant AEO scoring at draft creation
// and edit time. Derived from the scoring dimensions in
// lib/page-audit/auditor.ts (Doc 17 §2).
//
// Dimensions:
//   Answer-First Structure   35 pts — First sentence mentions business + city
//   Content Depth            25 pts — Word count in the 200–400 sweet spot
//   Keyword Coverage         20 pts — Business name, city, category present
//   CTA Signals              10 pts — Contains actionable phrases
//   Title Quality            10 pts — Under 60 chars, contains keywords
//
// Spec: docs/19-AUTOPILOT-ENGINE.md §3.1 step 6
// ---------------------------------------------------------------------------

export interface ScoreContext {
  businessName: string;
  city: string | null;
  categories: string[] | null;
}

/**
 * Lightweight AEO scoring heuristic for draft content.
 * Returns integer 0–100.
 */
export function scoreContentHeuristic(
  content: string,
  title: string,
  ctx: ScoreContext,
): number {
  if (!content || content.trim().length === 0) return 0;

  const lower = content.toLowerCase();
  const name = ctx.businessName.toLowerCase();
  const city = (ctx.city ?? '').toLowerCase();
  const category = (ctx.categories?.[0] ?? '').toLowerCase();

  // ── Answer-First (35 pts) ────────────────────────────────────────────────
  let answerFirst = 0;
  const firstSentence = content.split(/[.!?]/)[0] ?? '';
  const firstLower = firstSentence.toLowerCase();

  // Business name in first sentence
  if (name && firstLower.includes(name)) answerFirst += 15;
  // City in first sentence
  if (city && firstLower.includes(city)) answerFirst += 10;
  // Substantive opener (not generic)
  if (firstSentence.length > 50) answerFirst += 5;
  // Penalty for generic openers
  if (/welcome to|check out|home page|click here/i.test(firstSentence)) {
    answerFirst = Math.max(0, answerFirst - 10);
  }
  // Bonus for direct answer patterns
  if (/\bis\b|\boffers?\b|\bserves?\b|\bprovides?\b|\bspecializ/i.test(firstLower)) {
    answerFirst += 5;
  }

  // ── Content Depth (25 pts) ───────────────────────────────────────────────
  let depth = 0;
  const wordCount = content.trim().split(/\s+/).length;

  if (wordCount >= 200 && wordCount <= 400) {
    depth = 25; // Sweet spot
  } else if (wordCount >= 100 && wordCount < 200) {
    depth = Math.round((wordCount / 200) * 25);
  } else if (wordCount > 400 && wordCount <= 600) {
    depth = 20; // Slight penalty for verbosity
  } else if (wordCount > 600) {
    depth = 15; // Larger penalty
  } else {
    // Under 100 words
    depth = Math.round((wordCount / 100) * 10);
  }

  // ── Keyword Coverage (20 pts) ────────────────────────────────────────────
  let keywords = 0;
  if (name && lower.includes(name)) keywords += 8;
  if (city && lower.includes(city)) keywords += 6;
  if (category && lower.includes(category)) keywords += 6;

  // ── CTA Signals (10 pts) ─────────────────────────────────────────────────
  let cta = 0;
  const ctaPatterns = [
    /\breserv(e|ation)/i,
    /\bcall\b/i,
    /\bbook\b/i,
    /\bvisit\b/i,
    /\bdirection/i,
    /\border\b/i,
    /\bcontact\b/i,
    /\bschedule\b/i,
  ];
  for (const pattern of ctaPatterns) {
    if (pattern.test(content)) {
      cta += 5;
      if (cta >= 10) break;
    }
  }

  // ── Title Quality (10 pts) ───────────────────────────────────────────────
  let titleScore = 0;
  if (title && title.length > 0) {
    const titleLower = title.toLowerCase();
    // Under 60 chars is good for SEO
    if (title.length <= 60) titleScore += 4;
    else if (title.length <= 80) titleScore += 2;
    // Contains city or business name
    if (city && titleLower.includes(city)) titleScore += 3;
    if (name && titleLower.includes(name)) titleScore += 3;
  }

  const total = answerFirst + depth + keywords + cta + titleScore;
  return Math.min(100, Math.max(0, Math.round(total)));
}
