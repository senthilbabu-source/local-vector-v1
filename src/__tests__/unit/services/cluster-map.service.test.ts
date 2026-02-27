// ---------------------------------------------------------------------------
// src/__tests__/unit/services/cluster-map.service.test.ts
//
// Sprint 87: Unit tests for the Cluster Map pure service.
// Pure functions — no mocking needed except fixture data.
//
// Run:
//   npx vitest run src/__tests__/unit/services/cluster-map.service.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  buildClusterMap,
  calculateBrandAuthority,
  extractCompetitorPoints,
  buildHallucinationZones,
  filterByEngine,
  detectAvailableEngines,
  type ClusterMapPoint,
} from '@/lib/services/cluster-map.service';
import {
  MOCK_CLUSTER_INPUT,
  MOCK_EVALUATIONS,
  MOCK_HALLUCINATIONS,
  EXPECTED_ALL_ENGINES,
  EXPECTED_PERPLEXITY_ONLY,
  EXPECTED_OPENAI_ONLY,
} from '@/__fixtures__/cluster-map-fixtures';

// ---------------------------------------------------------------------------
// Shared self point for hallucination zone tests
// ---------------------------------------------------------------------------

const SELF_POINT: ClusterMapPoint = {
  id: 'self',
  name: 'Charcoal N Chill',
  brandAuthority: 80,
  factAccuracy: 72,
  sov: 0.45,
  type: 'self',
  citationCount: 8,
  totalQueries: 10,
};

// ---------------------------------------------------------------------------
// calculateBrandAuthority
// ---------------------------------------------------------------------------

describe('calculateBrandAuthority', () => {
  it('TC-01: Returns 80 for Charcoal N Chill across all evaluations', () => {
    const result = calculateBrandAuthority('Charcoal N Chill', MOCK_EVALUATIONS);
    expect(result.authority).toBe(80);
    expect(result.citedCount).toBe(8);
    expect(result.totalQueries).toBe(10);
  });

  it('TC-02: Returns 100 when business is cited in every evaluation', () => {
    const allCited = MOCK_EVALUATIONS.map((e) => ({
      ...e,
      rankPosition: 1,
    }));
    const result = calculateBrandAuthority('Charcoal N Chill', allCited);
    expect(result.authority).toBe(100);
  });

  it('TC-03: Returns 0 when business is never cited', () => {
    const neverCited = MOCK_EVALUATIONS.map((e) => ({
      ...e,
      rankPosition: null,
    }));
    const result = calculateBrandAuthority('Charcoal N Chill', neverCited);
    expect(result.authority).toBe(0);
    expect(result.citedCount).toBe(0);
  });

  it('TC-04: Returns 0 for empty evaluations array', () => {
    const result = calculateBrandAuthority('Charcoal N Chill', []);
    expect(result.authority).toBe(0);
    expect(result.totalQueries).toBe(0);
  });

  it('TC-05: Is case-insensitive for business name matching', () => {
    // Business name doesn't affect calculation — authority is based on rankPosition
    const result = calculateBrandAuthority('charcoal n chill', MOCK_EVALUATIONS);
    expect(result.authority).toBe(80);
  });

  it('TC-06: Only counts evaluations where rankPosition is non-null', () => {
    const twoOfFour = [
      { engine: 'perplexity', queryId: 'q1', queryCategory: 'discovery', rankPosition: 1, mentionedCompetitors: [] },
      { engine: 'openai', queryId: 'q1', queryCategory: 'discovery', rankPosition: null, mentionedCompetitors: [] },
      { engine: 'perplexity', queryId: 'q2', queryCategory: 'discovery', rankPosition: 2, mentionedCompetitors: [] },
      { engine: 'openai', queryId: 'q2', queryCategory: 'discovery', rankPosition: null, mentionedCompetitors: [] },
    ];
    const result = calculateBrandAuthority('Test', twoOfFour);
    expect(result.authority).toBe(50);
    expect(result.citedCount).toBe(2);
    expect(result.totalQueries).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// extractCompetitorPoints
// ---------------------------------------------------------------------------

describe('extractCompetitorPoints', () => {
  it('TC-07: Extracts 9 unique competitors from all evaluations', () => {
    const points = extractCompetitorPoints(MOCK_EVALUATIONS, 'all');
    expect(points).toHaveLength(9);
  });

  it('TC-08: Cloud 9 Lounge has highest authority (appears in 6/10 = 60)', () => {
    const points = extractCompetitorPoints(MOCK_EVALUATIONS, 'all');
    const cloud9 = points.find((p) => p.name === 'Cloud 9 Lounge');
    expect(cloud9).toBeDefined();
    expect(cloud9!.brandAuthority).toBe(60);
  });

  it('TC-09: Single-appearance competitor has authority 10 (1/10 x 100)', () => {
    const points = extractCompetitorPoints(MOCK_EVALUATIONS, 'all');
    const curryCorner = points.find((p) => p.name === 'Curry Corner');
    expect(curryCorner).toBeDefined();
    expect(curryCorner!.brandAuthority).toBe(10);
  });

  it('TC-10: Filters by engine — perplexity only returns perplexity competitors', () => {
    const perplexityEvals = filterByEngine(MOCK_EVALUATIONS, 'perplexity');
    const points = extractCompetitorPoints(perplexityEvals, 'perplexity');
    // Perplexity evaluations mention: Cloud 9, Sahara, Bollywood, Tabla, The Capital Grille, Waffle House, IHOP, The Hookah Spot
    const names = points.map((p) => p.name);
    expect(names).not.toContain('Curry Corner'); // only in openai Q2
  });

  it('TC-11: Returns empty array for empty evaluations', () => {
    const points = extractCompetitorPoints([], 'all');
    expect(points).toHaveLength(0);
  });

  it('TC-12: Deduplicates competitor names (exact match)', () => {
    const points = extractCompetitorPoints(MOCK_EVALUATIONS, 'all');
    const names = points.map((p) => p.name);
    const uniqueNames = new Set(names);
    expect(names.length).toBe(uniqueNames.size);
  });

  it('TC-13: All competitor points have type=competitor', () => {
    const points = extractCompetitorPoints(MOCK_EVALUATIONS, 'all');
    expect(points.every((p) => p.type === 'competitor')).toBe(true);
  });

  it('TC-14: Competitor factAccuracy defaults to 80', () => {
    const points = extractCompetitorPoints(MOCK_EVALUATIONS, 'all');
    expect(points.every((p) => p.factAccuracy === 80)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildHallucinationZones
// ---------------------------------------------------------------------------

describe('buildHallucinationZones', () => {
  it('TC-15: Returns 3 zones for all engines', () => {
    const zones = buildHallucinationZones(MOCK_HALLUCINATIONS, SELF_POINT, 'all');
    expect(zones).toHaveLength(3);
  });

  it('TC-16: Critical zone has radius=40 and cy=selfAccuracy-25', () => {
    const zones = buildHallucinationZones(MOCK_HALLUCINATIONS, SELF_POINT, 'all');
    const critical = zones.find((z) => z.severity === 'critical');
    expect(critical).toBeDefined();
    expect(critical!.radius).toBe(40);
    expect(critical!.cy).toBe(47); // 72 - 25
  });

  it('TC-17: High zone has radius=30 and cy=selfAccuracy-15', () => {
    const zones = buildHallucinationZones(MOCK_HALLUCINATIONS, SELF_POINT, 'all');
    const high = zones.find((z) => z.severity === 'high');
    expect(high).toBeDefined();
    expect(high!.radius).toBe(30);
    expect(high!.cy).toBe(57); // 72 - 15
  });

  it('TC-18: Medium zone has radius=20 and cy=selfAccuracy-8', () => {
    const zones = buildHallucinationZones(MOCK_HALLUCINATIONS, SELF_POINT, 'all');
    const medium = zones.find((z) => z.severity === 'medium');
    expect(medium).toBeDefined();
    expect(medium!.radius).toBe(20);
    expect(medium!.cy).toBe(64); // 72 - 8
  });

  it('TC-19: Low zone has radius=12 and cy=selfAccuracy-3', () => {
    const lowHallucinations = [
      {
        id: 'low-1',
        claimText: 'Minor claim',
        severity: 'low' as const,
        modelProvider: 'openai-gpt4o',
        category: null,
      },
    ];
    const zones = buildHallucinationZones(lowHallucinations, SELF_POINT, 'all');
    expect(zones).toHaveLength(1);
    expect(zones[0].radius).toBe(12);
    expect(zones[0].cy).toBe(69); // 72 - 3
  });

  it('TC-20: Filters zones by engine — openai returns only openai hallucinations', () => {
    const zones = buildHallucinationZones(MOCK_HALLUCINATIONS, SELF_POINT, 'openai');
    expect(zones).toHaveLength(1);
    expect(zones[0].engine).toBe('openai');
    expect(zones[0].severity).toBe('critical');
  });

  it('TC-21: Filters zones by engine — google returns only google hallucinations', () => {
    const zones = buildHallucinationZones(MOCK_HALLUCINATIONS, SELF_POINT, 'google');
    expect(zones).toHaveLength(1);
    expect(zones[0].engine).toBe('google');
    expect(zones[0].severity).toBe('high');
  });

  it('TC-22: cx always matches selfPoint.brandAuthority', () => {
    const zones = buildHallucinationZones(MOCK_HALLUCINATIONS, SELF_POINT, 'all');
    for (const z of zones) {
      expect(z.cx).toBe(SELF_POINT.brandAuthority);
    }
  });

  it('TC-23: Returns empty array when no hallucinations', () => {
    const zones = buildHallucinationZones([], SELF_POINT, 'all');
    expect(zones).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// filterByEngine
// ---------------------------------------------------------------------------

describe('filterByEngine', () => {
  it('TC-24: all returns all items unchanged', () => {
    const result = filterByEngine(MOCK_EVALUATIONS, 'all');
    expect(result).toHaveLength(MOCK_EVALUATIONS.length);
  });

  it('TC-25: perplexity returns only perplexity evaluations (5 of 10)', () => {
    const result = filterByEngine(MOCK_EVALUATIONS, 'perplexity');
    expect(result).toHaveLength(5);
    expect(result.every((e) => e.engine === 'perplexity')).toBe(true);
  });

  it('TC-26: openai returns only openai evaluations (5 of 10)', () => {
    const result = filterByEngine(MOCK_EVALUATIONS, 'openai');
    expect(result).toHaveLength(5);
    expect(result.every((e) => e.engine === 'openai')).toBe(true);
  });

  it('TC-27: google returns empty when no google data exists', () => {
    const result = filterByEngine(MOCK_EVALUATIONS, 'google');
    expect(result).toHaveLength(0);
  });

  it('TC-28: Maps model_provider enum values correctly (openai-gpt4o -> openai)', () => {
    const items = [
      { engine: 'openai-gpt4o', value: 1 },
      { engine: 'perplexity-sonar', value: 2 },
      { engine: 'google-gemini', value: 3 },
    ];
    const openaiResult = filterByEngine(items, 'openai');
    expect(openaiResult).toHaveLength(1);
    expect(openaiResult[0].value).toBe(1);

    const perplexityResult = filterByEngine(items, 'perplexity');
    expect(perplexityResult).toHaveLength(1);
    expect(perplexityResult[0].value).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// detectAvailableEngines
// ---------------------------------------------------------------------------

describe('detectAvailableEngines', () => {
  it('TC-29: Detects [all, perplexity, openai] from fixture data', () => {
    const engines = detectAvailableEngines(MOCK_EVALUATIONS);
    expect(engines).toContain('all');
    expect(engines).toContain('perplexity');
    expect(engines).toContain('openai');
    expect(engines).not.toContain('google');
    expect(engines).not.toContain('copilot');
  });

  it('TC-30: Always includes all even with single engine', () => {
    const singleEngine = [
      { engine: 'perplexity', queryId: 'q1', queryCategory: 'discovery', rankPosition: 1, mentionedCompetitors: [] },
    ];
    const engines = detectAvailableEngines(singleEngine);
    expect(engines).toContain('all');
    expect(engines).toContain('perplexity');
    expect(engines).toHaveLength(2);
  });

  it('TC-31: Returns [all] for empty evaluations', () => {
    const engines = detectAvailableEngines([]);
    expect(engines).toEqual(['all']);
  });
});

// ---------------------------------------------------------------------------
// buildClusterMap — all engines
// ---------------------------------------------------------------------------

describe('buildClusterMap — all engines', () => {
  it('TC-32: selfPoint has brandAuthority=80, factAccuracy=72, sov=0.45', () => {
    const result = buildClusterMap(MOCK_CLUSTER_INPUT);
    expect(result.selfPoint).not.toBeNull();
    expect(result.selfPoint!.brandAuthority).toBe(EXPECTED_ALL_ENGINES.selfBrandAuthority);
    expect(result.selfPoint!.factAccuracy).toBe(EXPECTED_ALL_ENGINES.selfFactAccuracy);
    expect(result.selfPoint!.sov).toBe(EXPECTED_ALL_ENGINES.selfSov);
  });

  it('TC-33: selfPoint has type=self', () => {
    const result = buildClusterMap(MOCK_CLUSTER_INPUT);
    expect(result.selfPoint!.type).toBe('self');
  });

  it('TC-34: points array contains self + 9 competitors = 10 total', () => {
    const result = buildClusterMap(MOCK_CLUSTER_INPUT);
    expect(result.points).toHaveLength(10);
    expect(result.points.filter((p) => p.type === 'self')).toHaveLength(1);
    expect(result.points.filter((p) => p.type === 'competitor')).toHaveLength(9);
  });

  it('TC-35: hallucinationZones has 3 entries', () => {
    const result = buildClusterMap(MOCK_CLUSTER_INPUT);
    expect(result.hallucinationZones).toHaveLength(3);
  });

  it('TC-36: stats.totalCompetitors = 9', () => {
    const result = buildClusterMap(MOCK_CLUSTER_INPUT);
    expect(result.stats.totalCompetitors).toBe(EXPECTED_ALL_ENGINES.totalCompetitors);
  });

  it('TC-37: stats.hallucinationCount = 3', () => {
    const result = buildClusterMap(MOCK_CLUSTER_INPUT);
    expect(result.stats.hallucinationCount).toBe(EXPECTED_ALL_ENGINES.hallucinationCount);
  });
});

// ---------------------------------------------------------------------------
// buildClusterMap — perplexity filter
// ---------------------------------------------------------------------------

describe('buildClusterMap — perplexity filter', () => {
  it('TC-38: Only includes perplexity evaluations', () => {
    const result = buildClusterMap({ ...MOCK_CLUSTER_INPUT, engineFilter: 'perplexity' });
    expect(result.stats.totalQueries).toBe(EXPECTED_PERPLEXITY_ONLY.totalQueries);
  });

  it('TC-39: Only includes perplexity hallucination zones (1 zone)', () => {
    const result = buildClusterMap({ ...MOCK_CLUSTER_INPUT, engineFilter: 'perplexity' });
    expect(result.hallucinationZones).toHaveLength(EXPECTED_PERPLEXITY_ONLY.hallucinationCount);
    expect(result.hallucinationZones[0].engine).toBe('perplexity');
  });

  it('TC-40: stats.totalQueries = 5', () => {
    const result = buildClusterMap({ ...MOCK_CLUSTER_INPUT, engineFilter: 'perplexity' });
    expect(result.stats.totalQueries).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// buildClusterMap — edge cases
// ---------------------------------------------------------------------------

describe('buildClusterMap — edge cases', () => {
  it('TC-41: Handles null truthScore — defaults factAccuracy to 50', () => {
    const result = buildClusterMap({ ...MOCK_CLUSTER_INPUT, truthScore: null });
    expect(result.selfPoint!.factAccuracy).toBe(50);
  });

  it('TC-42: Handles null sovScore — defaults sov to 0', () => {
    const result = buildClusterMap({ ...MOCK_CLUSTER_INPUT, sovScore: null });
    expect(result.selfPoint!.sov).toBe(0);
  });

  it('TC-43: Handles empty evaluations gracefully', () => {
    const result = buildClusterMap({
      ...MOCK_CLUSTER_INPUT,
      evaluations: [],
    });
    expect(result.selfPoint!.brandAuthority).toBe(0);
    expect(result.points).toHaveLength(1); // self only
    expect(result.stats.totalCompetitors).toBe(0);
  });

  it('TC-44: Handles empty hallucinations gracefully', () => {
    const result = buildClusterMap({
      ...MOCK_CLUSTER_INPUT,
      hallucinations: [],
    });
    expect(result.hallucinationZones).toHaveLength(0);
    expect(result.stats.hallucinationCount).toBe(0);
  });

  it('TC-45: All values clamped to 0-100 range', () => {
    const result = buildClusterMap({
      ...MOCK_CLUSTER_INPUT,
      truthScore: 150,
      sovScore: 2,
    });
    expect(result.selfPoint!.factAccuracy).toBeLessThanOrEqual(100);
    expect(result.selfPoint!.sov).toBeLessThanOrEqual(1);
  });
});
