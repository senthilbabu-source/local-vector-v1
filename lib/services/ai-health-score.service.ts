// ---------------------------------------------------------------------------
// lib/services/ai-health-score.service.ts — AI Health Score Composite
//
// Sprint 72: Pure scoring service that combines data from 4 existing engines
// (SOV, Page Audit, Hallucinations, Schema Completeness) into a single 0–100
// composite metric with a prioritized Top Recommendation.
//
// PURE FUNCTION — no I/O, no Supabase, no side effects (AI_RULES §39).
// ---------------------------------------------------------------------------

import type { PageAuditRecommendation } from '@/lib/page-audit/auditor';

// ── Input types ──────────────────────────────────────────────

export interface HealthScoreInput {
  /** Latest SOV share_of_voice (0.0–1.0 float from visibility_analytics). null = no scan yet. */
  sovScore: number | null;

  /** Latest page_audits row for primary location. null = never audited. */
  pageAudit: {
    overall_score: number | null;
    answer_first_score: number | null;
    schema_completeness_score: number | null;
    faq_schema_score: number | null;
    entity_clarity_score: number | null;
    aeo_readability_score: number | null;
    faq_schema_present: boolean | null;
    recommendations: PageAuditRecommendation[] | null;
  } | null;

  /** Count of OPEN hallucinations (correction_status = 'open'). */
  openHallucinationCount: number;

  /** Total hallucinations ever detected (for accuracy denominator). */
  totalAuditCount: number;

  /** Whether FAQ schema is present on homepage (from page_audits or schema generator). */
  hasFaqSchema: boolean;

  /** Whether LocalBusiness schema is present on homepage. */
  hasLocalBusinessSchema: boolean;
}

// ── Output types ─────────────────────────────────────────────

export interface HealthScoreResult {
  /** Composite 0–100 score, or null if insufficient data. */
  score: number | null;

  /** Letter grade: A (80+), B (60-79), C (40-59), D (20-39), F (<20). null if score is null. */
  grade: 'A' | 'B' | 'C' | 'D' | 'F' | null;

  /** Per-component breakdown (each 0–100, null if no data for that component). */
  components: {
    visibility: { score: number | null; weight: number; label: string };
    accuracy: { score: number | null; weight: number; label: string };
    structure: { score: number | null; weight: number; label: string };
    freshness: { score: number | null; weight: number; label: string };
  };

  /** The single highest-impact recommendation. null if no recommendations available. */
  topRecommendation: TopRecommendation | null;

  /** All ranked recommendations (max 5), highest impact first. */
  recommendations: TopRecommendation[];
}

export interface TopRecommendation {
  /** Human-readable title, e.g. "Add FAQ Schema" */
  title: string;
  /** Human-readable description with specific context */
  description: string;
  /** Estimated point improvement to the health score */
  estimatedImpact: number;
  /** Which component this improves */
  component: 'visibility' | 'accuracy' | 'structure' | 'freshness';
  /** Dashboard page to navigate to for the fix */
  actionHref: string;
  /** CTA button text */
  actionLabel: string;
  /** Dimension key from page audit, if applicable */
  dimensionKey?: string;
}

// ── Grade mapping ────────────────────────────────────────────

/**
 * Maps a numeric 0–100 score to a letter grade.
 */
export function scoreToGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  if (score >= 20) return 'D';
  return 'F';
}

// ── Grade descriptions ───────────────────────────────────────

const GRADE_DESCRIPTIONS: Record<string, string> = {
  A: 'Excellent — AI sees you clearly',
  B: 'Good — some gaps to close',
  C: 'Fair — significant opportunities',
  D: 'Poor — major gaps hurting visibility',
  F: 'Critical — AI barely knows you exist',
};

export function gradeDescription(grade: 'A' | 'B' | 'C' | 'D' | 'F'): string {
  return GRADE_DESCRIPTIONS[grade];
}

// ── Component scoring ────────────────────────────────────────

function computeVisibility(sovScore: number | null): number | null {
  if (sovScore === null) return null;
  return Math.round(sovScore * 100);
}

function computeAccuracy(
  openHallucinationCount: number,
  totalAuditCount: number,
): number | null {
  if (totalAuditCount === 0) return null;
  const raw = 100 - (openHallucinationCount / totalAuditCount) * 100;
  return Math.round(Math.max(0, Math.min(100, raw)));
}

function computeStructure(
  pageAudit: HealthScoreInput['pageAudit'],
): number | null {
  if (!pageAudit || pageAudit.overall_score === null) return null;
  return pageAudit.overall_score;
}

function computeFreshness(
  pageAudit: HealthScoreInput['pageAudit'],
  hasFaqSchema: boolean,
  hasLocalBusinessSchema: boolean,
): number | null {
  // Schema presence component (50% of freshness)
  const schemaPresenceScore =
    (hasFaqSchema ? 25 : 0) + (hasLocalBusinessSchema ? 25 : 0);

  // Page audit sub-scores component (50% of freshness)
  const hasFaqScore = pageAudit?.faq_schema_score !== null && pageAudit?.faq_schema_score !== undefined;
  const hasEntityScore = pageAudit?.entity_clarity_score !== null && pageAudit?.entity_clarity_score !== undefined;

  if (!hasFaqScore && !hasEntityScore && !hasFaqSchema && !hasLocalBusinessSchema) {
    return null;
  }

  let auditAvg: number | null = null;
  if (hasFaqScore && hasEntityScore) {
    auditAvg = ((pageAudit!.faq_schema_score as number) + (pageAudit!.entity_clarity_score as number)) / 2;
  } else if (hasFaqScore) {
    auditAvg = pageAudit!.faq_schema_score as number;
  } else if (hasEntityScore) {
    auditAvg = pageAudit!.entity_clarity_score as number;
  }

  if (auditAvg !== null) {
    return Math.round(schemaPresenceScore * 0.5 + auditAvg * 0.5);
  }

  // Only schema presence data available
  return schemaPresenceScore;
}

// ── Recommendation ranking ───────────────────────────────────

function buildRecommendations(input: HealthScoreInput): TopRecommendation[] {
  const recs: TopRecommendation[] = [];

  // 1. Page audit recommendations
  if (input.pageAudit?.recommendations) {
    for (const rec of input.pageAudit.recommendations) {
      recs.push({
        title: rec.issue.length > 60 ? rec.issue.slice(0, 57) + '...' : rec.issue,
        description: rec.fix,
        estimatedImpact: rec.impactPoints,
        component: mapDimensionToComponent(rec.dimensionKey),
        actionHref: '/dashboard/page-audits',
        actionLabel: 'Fix in Page Audits',
        dimensionKey: rec.dimensionKey,
      });
    }
  }

  // 2. Missing FAQ schema
  if (!input.hasFaqSchema) {
    recs.push({
      title: 'Add FAQ Schema',
      description:
        'Add FAQPage JSON-LD schema to your homepage. FAQ schema is the #1 driver of AI citations.',
      estimatedImpact: 15,
      component: 'freshness',
      actionHref: '/dashboard/page-audits',
      actionLabel: 'Generate Schema',
    });
  }

  // 3. Missing LocalBusiness schema
  if (!input.hasLocalBusinessSchema) {
    recs.push({
      title: 'Add LocalBusiness Schema',
      description:
        'Add LocalBusiness JSON-LD schema to your homepage so AI models can extract your NAP+H data.',
      estimatedImpact: 10,
      component: 'structure',
      actionHref: '/dashboard/page-audits',
      actionLabel: 'Generate Schema',
    });
  }

  // 4. High hallucination count
  if (input.openHallucinationCount >= 3) {
    recs.push({
      title: 'Resolve open hallucinations',
      description: `You have ${input.openHallucinationCount} open AI hallucinations. Correcting these improves your accuracy score.`,
      estimatedImpact: 8,
      component: 'accuracy',
      actionHref: '/dashboard',
      actionLabel: 'View Alerts',
    });
  }

  // 5. Low SOV
  if (input.sovScore !== null && input.sovScore < 0.2) {
    recs.push({
      title: 'Improve AI visibility',
      description:
        'Your AI visibility is below 20%. Track more queries and optimize your content to appear in AI answers.',
      estimatedImpact: 5,
      component: 'visibility',
      actionHref: '/dashboard/share-of-voice',
      actionLabel: 'View SOV',
    });
  }

  // Sort by estimated impact descending, take top 5
  recs.sort((a, b) => b.estimatedImpact - a.estimatedImpact);
  return recs.slice(0, 5);
}

function mapDimensionToComponent(
  dimensionKey?: string,
): 'visibility' | 'accuracy' | 'structure' | 'freshness' {
  switch (dimensionKey) {
    case 'answerFirst':
    case 'keywordDensity':
      return 'structure';
    case 'schemaCompleteness':
      return 'structure';
    case 'faqSchema':
      return 'freshness';
    case 'entityClarity':
      return 'freshness';
    default:
      return 'structure';
  }
}

// ── Main scoring function ────────────────────────────────────

const WEIGHTS = {
  visibility: 0.3,
  accuracy: 0.25,
  structure: 0.25,
  freshness: 0.2,
} as const;

/**
 * Pure function — computes AI Health Score from pre-fetched data.
 * No I/O, no Supabase, no side effects.
 */
export function computeHealthScore(input: HealthScoreInput): HealthScoreResult {
  const visibility = computeVisibility(input.sovScore);
  const accuracy = computeAccuracy(
    input.openHallucinationCount,
    input.totalAuditCount,
  );
  const structure = computeStructure(input.pageAudit);
  const freshness = computeFreshness(
    input.pageAudit,
    input.hasFaqSchema,
    input.hasLocalBusinessSchema,
  );

  const components = {
    visibility: { score: visibility, weight: WEIGHTS.visibility, label: 'Visibility' },
    accuracy: { score: accuracy, weight: WEIGHTS.accuracy, label: 'Accuracy' },
    structure: { score: structure, weight: WEIGHTS.structure, label: 'Structure' },
    freshness: { score: freshness, weight: WEIGHTS.freshness, label: 'Freshness' },
  };

  // Weighted average with proportional re-weighting for null components
  const entries = Object.entries(components) as [
    string,
    { score: number | null; weight: number; label: string },
  ][];
  const nonNull = entries.filter(([, c]) => c.score !== null);

  if (nonNull.length === 0) {
    return {
      score: null,
      grade: null,
      components,
      topRecommendation: null,
      recommendations: [],
    };
  }

  const totalWeight = nonNull.reduce((sum, [, c]) => sum + c.weight, 0);
  const weightedSum = nonNull.reduce(
    (sum, [, c]) => sum + (c.score as number) * (c.weight / totalWeight),
    0,
  );
  const score = Math.round(weightedSum);
  const grade = scoreToGrade(score);

  const recommendations = buildRecommendations(input);

  return {
    score,
    grade,
    components,
    topRecommendation: recommendations[0] ?? null,
    recommendations,
  };
}
