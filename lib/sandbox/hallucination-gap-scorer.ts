// ---------------------------------------------------------------------------
// lib/sandbox/hallucination-gap-scorer.ts — Pure gap analysis scoring
//
// Sprint 110: Analyzes query simulation results to score hallucination risk
// and identify content gaps. Pure functions — no API calls, no DB calls.
// ---------------------------------------------------------------------------

import type {
  QuerySimulationResult,
  HallucinationRisk,
  GapCluster,
  ContentAddition,
  GroundTruthField,
  GapAnalysisResult,
  SandboxGroundTruth,
} from './types';

/**
 * Computes overall hallucination risk from query results.
 */
export function computeHallucinationRisk(
  queryResults: QuerySimulationResult[],
): HallucinationRisk {
  if (queryResults.length === 0) return 'high';

  const noAnswerCount = queryResults.filter(r => r.answer_quality === 'no_answer').length;
  const noAnswerRate = noAnswerCount / queryResults.length;

  if (noAnswerRate >= 0.60) return 'critical';
  if (noAnswerRate >= 0.40) return 'high';
  if (noAnswerRate >= 0.20) return 'medium';
  return 'low';
}

/**
 * Groups query results by category and scores each cluster.
 */
export function buildGapClusters(
  queryResults: QuerySimulationResult[],
): GapCluster[] {
  const byCategory = new Map<string, QuerySimulationResult[]>();

  for (const result of queryResults) {
    const cat = result.query_category || 'uncategorized';
    const existing = byCategory.get(cat) || [];
    existing.push(result);
    byCategory.set(cat, existing);
  }

  const clusters: GapCluster[] = [];

  for (const [category, results] of byCategory.entries()) {
    const answered = results.filter(
      r => r.answer_quality === 'complete' || r.answer_quality === 'partial',
    ).length;
    const unanswered = results.length - answered;
    const unansweredRate = results.length > 0 ? unanswered / results.length : 0;

    let severity: GapCluster['gap_severity'];
    if (unansweredRate > 0.75) severity = 'critical';
    else if (unansweredRate > 0.50) severity = 'high';
    else if (unansweredRate > 0.25) severity = 'medium';
    else severity = 'low';

    const exampleUnanswered = results.find(r => r.answer_quality === 'no_answer' || r.answer_quality === 'wrong');

    clusters.push({
      category,
      total_queries: results.length,
      answered_queries: answered,
      unanswered_queries: unanswered,
      gap_severity: severity,
      example_unanswered: exampleUnanswered?.query_text ?? '',
    });
  }

  return clusters.sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    return order[a.gap_severity] - order[b.gap_severity];
  });
}

/**
 * Generates content addition suggestions based on unanswered queries.
 */
export function generateContentAdditions(
  queryResults: QuerySimulationResult[],
  groundTruth: SandboxGroundTruth,
): ContentAddition[] {
  const unanswered = queryResults.filter(
    r => r.answer_quality === 'no_answer' || r.answer_quality === 'wrong',
  );

  if (unanswered.length === 0) return [];

  const additions = new Map<GroundTruthField | 'general', ContentAddition>();

  for (const query of unanswered) {
    const suggestion = mapQueryToContentSuggestion(query, groundTruth);
    if (!suggestion) continue;

    const existing = additions.get(suggestion.field);
    if (existing) {
      existing.closes_queries.push(query.query_text);
    } else {
      additions.set(suggestion.field, suggestion);
    }
  }

  return Array.from(additions.values()).sort((a, b) => a.priority - b.priority);
}

/**
 * Computes the composite simulation score (0–100).
 *
 * - Ingestion accuracy: 40% weight
 * - Query coverage: 40% weight
 * - Hallucination risk penalty: 20% weight
 */
export function computeSimulationScore(
  ingestionAccuracy: number,
  queryCoverageRate: number,
  hallucinationRisk: HallucinationRisk,
): number {
  const ingestionPts = (ingestionAccuracy / 100) * 40;
  const coveragePts = queryCoverageRate * 40;

  const riskPoints: Record<HallucinationRisk, number> = {
    low: 20,
    medium: 12,
    high: 6,
    critical: 0,
  };
  const riskPts = riskPoints[hallucinationRisk];

  return Math.round(Math.min(100, Math.max(0, ingestionPts + coveragePts + riskPts)));
}

/**
 * Finds the highest-risk queries (up to 5).
 * Priority: 'wrong' first, then 'no_answer'.
 */
export function findHighestRiskQueries(
  queryResults: QuerySimulationResult[],
): string[] {
  const wrong = queryResults
    .filter(r => r.answer_quality === 'wrong')
    .map(r => r.query_text);

  const noAnswer = queryResults
    .filter(r => r.answer_quality === 'no_answer')
    .map(r => r.query_text);

  return [...wrong, ...noAnswer].slice(0, 5);
}

/**
 * Builds a complete GapAnalysisResult from query results and ground truth.
 */
export function buildGapAnalysis(
  queryResults: QuerySimulationResult[],
  groundTruth: SandboxGroundTruth,
): GapAnalysisResult {
  return {
    total_queries_tested: queryResults.length,
    queries_with_no_answer: queryResults.filter(r => r.answer_quality === 'no_answer').length,
    queries_with_partial_answer: queryResults.filter(r => r.answer_quality === 'partial').length,
    queries_with_complete_answer: queryResults.filter(r => r.answer_quality === 'complete').length,
    gap_clusters: buildGapClusters(queryResults),
    highest_risk_queries: findHighestRiskQueries(queryResults),
    recommended_additions: generateContentAdditions(queryResults, groundTruth),
  };
}

/**
 * Maps a query to a content addition suggestion.
 */
export function mapQueryToContentSuggestion(
  query: QuerySimulationResult,
  groundTruth: SandboxGroundTruth,
): ContentAddition | null {
  const text = query.query_text.toLowerCase();

  // Hours queries
  if (text.includes('hour') || text.includes('open') || text.includes('close') || text.includes('time')) {
    return {
      priority: 1,
      field: 'hours',
      suggestion: groundTruth.hours
        ? `State your exact operating hours: ${groundTruth.hours}`
        : 'Add your operating hours for each day of the week.',
      closes_queries: [query.query_text],
    };
  }

  // Phone / contact queries
  if (text.includes('phone') || text.includes('call') || text.includes('contact') || text.includes('number')) {
    return {
      priority: 1,
      field: 'phone',
      suggestion: groundTruth.phone
        ? `Include your phone number: ${groundTruth.phone}`
        : 'Add a contact phone number.',
      closes_queries: [query.query_text],
    };
  }

  // Location / address queries
  if (text.includes('where') || text.includes('address') || text.includes('location') || text.includes('directions')) {
    return {
      priority: 1,
      field: 'address',
      suggestion: groundTruth.address
        ? `Include your full address: ${groundTruth.address}, ${groundTruth.city}, ${groundTruth.state}`
        : 'Add your full street address.',
      closes_queries: [query.query_text],
    };
  }

  // Booking / reservation queries
  if (text.includes('book') || text.includes('reserv') || text.includes('event') || text.includes('party')) {
    return {
      priority: 2,
      field: 'general',
      suggestion: 'Add booking or reservation instructions (phone number, online form, or walk-in policy).',
      closes_queries: [query.query_text],
    };
  }

  // Menu / food queries
  if (text.includes('menu') || text.includes('food') || text.includes('eat') || text.includes('serve')) {
    return {
      priority: 2,
      field: 'category',
      suggestion: groundTruth.category
        ? `Describe your cuisine type and signature offerings (${groundTruth.category}).`
        : 'Describe your menu highlights and cuisine type.',
      closes_queries: [query.query_text],
    };
  }

  // Amenity / feature queries
  if (text.includes('parking') || text.includes('outdoor') || text.includes('wifi') || text.includes('hookah') || text.includes('music')) {
    return {
      priority: 2,
      field: 'amenities',
      suggestion: 'List your key amenities and features (parking, outdoor seating, live music, etc.).',
      closes_queries: [query.query_text],
    };
  }

  // Generic fallback
  return {
    priority: 3,
    field: 'general',
    suggestion: `Add content that addresses: "${query.query_text}"`,
    closes_queries: [query.query_text],
  };
}
