import { describe, it, expect } from 'vitest';
import {
  computeHallucinationRisk,
  buildGapClusters,
  generateContentAdditions,
  computeSimulationScore,
  findHighestRiskQueries,
  buildGapAnalysis,
  mapQueryToContentSuggestion,
} from '@/lib/sandbox/hallucination-gap-scorer';
import type { QuerySimulationResult, HallucinationRisk } from '@/lib/sandbox/types';
import { MOCK_SANDBOX_GROUND_TRUTH, MOCK_QUERY_SIMULATION_RESULTS } from '@/__fixtures__/golden-tenant';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryResult(overrides: Partial<QuerySimulationResult> = {}): QuerySimulationResult {
  return {
    query_id: 'q-test',
    query_text: 'Test query?',
    query_category: 'discovery',
    simulated_answer: 'Test answer',
    answer_quality: 'complete',
    cites_business: true,
    facts_present: ['name'],
    facts_hallucinated: [],
    word_count: 5,
    ground_truth_alignment: 80,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// computeHallucinationRisk
// ---------------------------------------------------------------------------

describe('computeHallucinationRisk', () => {
  it('returns "low" when no_answer rate < 20%', () => {
    const results = [
      makeQueryResult({ answer_quality: 'complete' }),
      makeQueryResult({ answer_quality: 'complete' }),
      makeQueryResult({ answer_quality: 'complete' }),
      makeQueryResult({ answer_quality: 'complete' }),
      makeQueryResult({ answer_quality: 'complete' }),
    ];
    expect(computeHallucinationRisk(results)).toBe('low');
  });

  it('returns "medium" at 20-39% no_answer rate', () => {
    const results = [
      makeQueryResult({ answer_quality: 'complete' }),
      makeQueryResult({ answer_quality: 'complete' }),
      makeQueryResult({ answer_quality: 'complete' }),
      makeQueryResult({ answer_quality: 'no_answer' }),
    ];
    // 1/4 = 25%
    expect(computeHallucinationRisk(results)).toBe('medium');
  });

  it('returns "high" at 40-59% no_answer rate', () => {
    const results = [
      makeQueryResult({ answer_quality: 'complete' }),
      makeQueryResult({ answer_quality: 'no_answer' }),
      makeQueryResult({ answer_quality: 'no_answer' }),
      makeQueryResult({ answer_quality: 'complete' }),
      makeQueryResult({ answer_quality: 'no_answer' }),
    ];
    // 3/5 = 60% — that's critical actually, let's do 2/5 = 40%
    const results40 = [
      makeQueryResult({ answer_quality: 'complete' }),
      makeQueryResult({ answer_quality: 'complete' }),
      makeQueryResult({ answer_quality: 'complete' }),
      makeQueryResult({ answer_quality: 'no_answer' }),
      makeQueryResult({ answer_quality: 'no_answer' }),
    ];
    expect(computeHallucinationRisk(results40)).toBe('high');
  });

  it('returns "critical" at >=60% no_answer rate', () => {
    const results = [
      makeQueryResult({ answer_quality: 'no_answer' }),
      makeQueryResult({ answer_quality: 'no_answer' }),
      makeQueryResult({ answer_quality: 'no_answer' }),
      makeQueryResult({ answer_quality: 'complete' }),
    ];
    // 3/4 = 75%
    expect(computeHallucinationRisk(results)).toBe('critical');
  });

  it('returns "high" for empty results array', () => {
    expect(computeHallucinationRisk([])).toBe('high');
  });
});

// ---------------------------------------------------------------------------
// buildGapClusters
// ---------------------------------------------------------------------------

describe('buildGapClusters', () => {
  it('groups results by query_category', () => {
    const results = [
      makeQueryResult({ query_category: 'discovery', answer_quality: 'complete' }),
      makeQueryResult({ query_category: 'action', answer_quality: 'no_answer' }),
      makeQueryResult({ query_category: 'discovery', answer_quality: 'partial' }),
    ];
    const clusters = buildGapClusters(results);
    expect(clusters.length).toBe(2);
    const discovery = clusters.find(c => c.category === 'discovery');
    expect(discovery?.total_queries).toBe(2);
    expect(discovery?.answered_queries).toBe(2);
  });

  it('assigns critical severity when >75% unanswered', () => {
    const results = [
      makeQueryResult({ query_category: 'action', answer_quality: 'no_answer' }),
      makeQueryResult({ query_category: 'action', answer_quality: 'no_answer' }),
      makeQueryResult({ query_category: 'action', answer_quality: 'no_answer' }),
      makeQueryResult({ query_category: 'action', answer_quality: 'no_answer' }),
      makeQueryResult({ query_category: 'action', answer_quality: 'complete' }),
    ];
    // 4/5 = 80% > 75%
    const clusters = buildGapClusters(results);
    expect(clusters[0].gap_severity).toBe('critical');
  });

  it('sorts clusters by severity (critical first)', () => {
    const results = [
      makeQueryResult({ query_category: 'good', answer_quality: 'complete' }),
      makeQueryResult({ query_category: 'bad', answer_quality: 'no_answer' }),
      makeQueryResult({ query_category: 'bad', answer_quality: 'no_answer' }),
    ];
    const clusters = buildGapClusters(results);
    // "bad" cluster has 100% unanswered (critical), "good" has 0% (low)
    expect(clusters[0].category).toBe('bad');
  });

  it('uses "uncategorized" for missing category', () => {
    const results = [makeQueryResult({ query_category: '' })];
    const clusters = buildGapClusters(results);
    expect(clusters[0].category).toBe('uncategorized');
  });
});

// ---------------------------------------------------------------------------
// generateContentAdditions
// ---------------------------------------------------------------------------

describe('generateContentAdditions', () => {
  it('returns empty array when all queries answered', () => {
    const results = [makeQueryResult({ answer_quality: 'complete' })];
    expect(generateContentAdditions(results, MOCK_SANDBOX_GROUND_TRUTH)).toEqual([]);
  });

  it('generates suggestions for unanswered queries', () => {
    const results = [
      makeQueryResult({ query_text: 'What are the hours?', answer_quality: 'no_answer' }),
    ];
    const additions = generateContentAdditions(results, MOCK_SANDBOX_GROUND_TRUTH);
    expect(additions.length).toBe(1);
    expect(additions[0].field).toBe('hours');
  });

  it('merges multiple queries for same field', () => {
    const results = [
      makeQueryResult({ query_id: 'q1', query_text: 'What time do you open?', answer_quality: 'no_answer' }),
      makeQueryResult({ query_id: 'q2', query_text: 'What are your hours?', answer_quality: 'no_answer' }),
    ];
    const additions = generateContentAdditions(results, MOCK_SANDBOX_GROUND_TRUTH);
    const hoursAddition = additions.find(a => a.field === 'hours');
    expect(hoursAddition?.closes_queries.length).toBe(2);
  });

  it('sorts by priority ascending', () => {
    const results = [
      makeQueryResult({ query_text: 'What music do you play?', answer_quality: 'no_answer' }),
      makeQueryResult({ query_text: 'What is your phone number?', answer_quality: 'no_answer' }),
    ];
    const additions = generateContentAdditions(results, MOCK_SANDBOX_GROUND_TRUTH);
    expect(additions[0].priority).toBeLessThanOrEqual(additions[additions.length - 1].priority);
  });
});

// ---------------------------------------------------------------------------
// computeSimulationScore
// ---------------------------------------------------------------------------

describe('computeSimulationScore', () => {
  it('returns 100 for perfect ingestion + coverage + low risk', () => {
    expect(computeSimulationScore(100, 1.0, 'low')).toBe(100);
  });

  it('returns 0 for zero ingestion + zero coverage + critical risk', () => {
    expect(computeSimulationScore(0, 0, 'critical')).toBe(0);
  });

  it('weights ingestion at 40%', () => {
    const score = computeSimulationScore(50, 0, 'critical'); // 50×0.4 + 0 + 0 = 20
    expect(score).toBe(20);
  });

  it('weights query coverage at 40%', () => {
    const score = computeSimulationScore(0, 0.5, 'critical'); // 0 + 0.5×40 + 0 = 20
    expect(score).toBe(20);
  });

  it('applies risk penalty: low=20, medium=12, high=6, critical=0', () => {
    expect(computeSimulationScore(0, 0, 'low')).toBe(20);
    expect(computeSimulationScore(0, 0, 'medium')).toBe(12);
    expect(computeSimulationScore(0, 0, 'high')).toBe(6);
    expect(computeSimulationScore(0, 0, 'critical')).toBe(0);
  });

  it('clamps between 0 and 100', () => {
    expect(computeSimulationScore(100, 1.0, 'low')).toBeLessThanOrEqual(100);
    expect(computeSimulationScore(0, 0, 'critical')).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// findHighestRiskQueries
// ---------------------------------------------------------------------------

describe('findHighestRiskQueries', () => {
  it('prioritizes wrong answers over no_answer', () => {
    const results = [
      makeQueryResult({ query_text: 'Q1', answer_quality: 'no_answer' }),
      makeQueryResult({ query_text: 'Q2', answer_quality: 'wrong' }),
      makeQueryResult({ query_text: 'Q3', answer_quality: 'complete' }),
    ];
    const risk = findHighestRiskQueries(results);
    expect(risk[0]).toBe('Q2');
    expect(risk[1]).toBe('Q1');
    expect(risk).not.toContain('Q3');
  });

  it('returns at most 5 queries', () => {
    const results = Array.from({ length: 10 }, (_, i) =>
      makeQueryResult({ query_text: `Q${i}`, answer_quality: 'wrong' }),
    );
    expect(findHighestRiskQueries(results).length).toBe(5);
  });

  it('returns empty for all-complete results', () => {
    const results = [makeQueryResult({ answer_quality: 'complete' })];
    expect(findHighestRiskQueries(results)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// mapQueryToContentSuggestion
// ---------------------------------------------------------------------------

describe('mapQueryToContentSuggestion', () => {
  it('maps hours query to hours field', () => {
    const q = makeQueryResult({ query_text: 'What are your hours?', answer_quality: 'no_answer' });
    const suggestion = mapQueryToContentSuggestion(q, MOCK_SANDBOX_GROUND_TRUTH);
    expect(suggestion?.field).toBe('hours');
    expect(suggestion?.priority).toBe(1);
  });

  it('maps phone query to phone field', () => {
    const q = makeQueryResult({ query_text: 'How do I contact you?', answer_quality: 'no_answer' });
    const suggestion = mapQueryToContentSuggestion(q, MOCK_SANDBOX_GROUND_TRUTH);
    expect(suggestion?.field).toBe('phone');
  });

  it('maps location query to address field', () => {
    const q = makeQueryResult({ query_text: 'Where is the restaurant?', answer_quality: 'no_answer' });
    const suggestion = mapQueryToContentSuggestion(q, MOCK_SANDBOX_GROUND_TRUTH);
    expect(suggestion?.field).toBe('address');
  });

  it('maps booking query to general with priority 2', () => {
    const q = makeQueryResult({ query_text: 'Can I book a party?', answer_quality: 'no_answer' });
    const suggestion = mapQueryToContentSuggestion(q, MOCK_SANDBOX_GROUND_TRUTH);
    expect(suggestion?.field).toBe('general');
    expect(suggestion?.priority).toBe(2);
  });

  it('maps menu query to category field', () => {
    const q = makeQueryResult({ query_text: 'What food do you serve?', answer_quality: 'no_answer' });
    const suggestion = mapQueryToContentSuggestion(q, MOCK_SANDBOX_GROUND_TRUTH);
    expect(suggestion?.field).toBe('category');
  });

  it('maps amenity query to amenities field', () => {
    const q = makeQueryResult({ query_text: 'Do you have parking and wifi?', answer_quality: 'no_answer' });
    const suggestion = mapQueryToContentSuggestion(q, MOCK_SANDBOX_GROUND_TRUTH);
    expect(suggestion?.field).toBe('amenities');
  });

  it('falls back to generic suggestion for unknown query', () => {
    const q = makeQueryResult({ query_text: 'Do you have a loyalty program?', answer_quality: 'no_answer' });
    const suggestion = mapQueryToContentSuggestion(q, MOCK_SANDBOX_GROUND_TRUTH);
    expect(suggestion?.field).toBe('general');
    expect(suggestion?.priority).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// buildGapAnalysis (integration of sub-functions)
// ---------------------------------------------------------------------------

describe('buildGapAnalysis', () => {
  it('builds complete analysis from golden-tenant fixtures', () => {
    const analysis = buildGapAnalysis(MOCK_QUERY_SIMULATION_RESULTS, MOCK_SANDBOX_GROUND_TRUTH);
    expect(analysis.total_queries_tested).toBe(2);
    expect(analysis.queries_with_complete_answer).toBe(1);
    expect(analysis.queries_with_no_answer).toBe(1);
    expect(analysis.gap_clusters.length).toBeGreaterThan(0);
    expect(analysis.highest_risk_queries.length).toBe(1);
  });

  it('returns zero counts for empty query results', () => {
    const analysis = buildGapAnalysis([], MOCK_SANDBOX_GROUND_TRUTH);
    expect(analysis.total_queries_tested).toBe(0);
    expect(analysis.gap_clusters).toEqual([]);
    expect(analysis.highest_risk_queries).toEqual([]);
    expect(analysis.recommended_additions).toEqual([]);
  });
});
