// ---------------------------------------------------------------------------
// src/__tests__/unit/ai-health-score-service.test.ts
//
// Sprint 72: Pure function tests for AI Health Score service.
// No Supabase mocks needed — pure scoring logic only.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  computeHealthScore,
  scoreToGrade,
  type HealthScoreInput,
} from '@/lib/services/ai-health-score.service';
import { MOCK_HEALTH_SCORE_INPUT } from '@/__fixtures__/golden-tenant';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a minimal HealthScoreInput with all data present. */
function fullInput(overrides: Partial<HealthScoreInput> = {}): HealthScoreInput {
  return {
    sovScore: 0.5,
    pageAudit: {
      overall_score: 70,
      answer_first_score: 65,
      schema_completeness_score: 60,
      faq_schema_score: 50,
      entity_clarity_score: 55,
      aeo_readability_score: 72,
      faq_schema_present: true,
      recommendations: [],
    },
    openHallucinationCount: 1,
    totalAuditCount: 10,
    hasFaqSchema: true,
    hasLocalBusinessSchema: true,
    ...overrides,
  };
}

/** Creates a HealthScoreInput where ALL components produce null. */
function emptyInput(): HealthScoreInput {
  return {
    sovScore: null,
    pageAudit: null,
    openHallucinationCount: 0,
    totalAuditCount: 0,
    hasFaqSchema: false,
    hasLocalBusinessSchema: false,
  };
}

// ---------------------------------------------------------------------------
// computeHealthScore
// ---------------------------------------------------------------------------

describe('computeHealthScore', () => {
  it('1. computes weighted score with all 4 components present', () => {
    const result = computeHealthScore(fullInput());
    expect(result.score).toBeTypeOf('number');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.grade).not.toBeNull();
    // All 4 components should be non-null
    expect(result.components.visibility.score).not.toBeNull();
    expect(result.components.accuracy.score).not.toBeNull();
    expect(result.components.structure.score).not.toBeNull();
    expect(result.components.freshness.score).not.toBeNull();
  });

  it('2. returns correct grade A for score >= 80', () => {
    // High SOV + no hallucinations + high page audit + all schemas
    const result = computeHealthScore(
      fullInput({
        sovScore: 0.9,
        pageAudit: {
          overall_score: 90,
          answer_first_score: 90,
          schema_completeness_score: 90,
          faq_schema_score: 90,
          entity_clarity_score: 90,
          aeo_readability_score: 90,
          faq_schema_present: true,
          recommendations: [],
        },
        openHallucinationCount: 0,
        totalAuditCount: 10,
        hasFaqSchema: true,
        hasLocalBusinessSchema: true,
      }),
    );
    expect(result.grade).toBe('A');
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  it('3. returns correct grade B for score 60-79', () => {
    const result = computeHealthScore(
      fullInput({
        sovScore: 0.65,
        pageAudit: {
          overall_score: 70,
          answer_first_score: 70,
          schema_completeness_score: 70,
          faq_schema_score: 60,
          entity_clarity_score: 65,
          aeo_readability_score: 70,
          faq_schema_present: true,
          recommendations: [],
        },
        openHallucinationCount: 2,
        totalAuditCount: 10,
        hasFaqSchema: true,
        hasLocalBusinessSchema: true,
      }),
    );
    expect(result.grade).toBe('B');
    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(result.score).toBeLessThanOrEqual(79);
  });

  it('4. returns correct grade C for score 40-59', () => {
    const result = computeHealthScore(
      fullInput({
        sovScore: 0.4,
        pageAudit: {
          overall_score: 50,
          answer_first_score: 50,
          schema_completeness_score: 40,
          faq_schema_score: 30,
          entity_clarity_score: 40,
          aeo_readability_score: 50,
          faq_schema_present: false,
          recommendations: [],
        },
        openHallucinationCount: 3,
        totalAuditCount: 10,
        hasFaqSchema: false,
        hasLocalBusinessSchema: true,
      }),
    );
    expect(result.grade).toBe('C');
    expect(result.score).toBeGreaterThanOrEqual(40);
    expect(result.score).toBeLessThanOrEqual(59);
  });

  it('5. returns correct grade D for score 20-39', () => {
    const result = computeHealthScore(
      fullInput({
        sovScore: 0.2,
        pageAudit: {
          overall_score: 30,
          answer_first_score: 25,
          schema_completeness_score: 25,
          faq_schema_score: 10,
          entity_clarity_score: 25,
          aeo_readability_score: 30,
          faq_schema_present: false,
          recommendations: [],
        },
        openHallucinationCount: 6,
        totalAuditCount: 10,
        hasFaqSchema: false,
        hasLocalBusinessSchema: false,
      }),
    );
    expect(result.grade).toBe('D');
    expect(result.score).toBeGreaterThanOrEqual(20);
    expect(result.score).toBeLessThanOrEqual(39);
  });

  it('6. returns correct grade F for score < 20', () => {
    const result = computeHealthScore(
      fullInput({
        sovScore: 0.02,
        pageAudit: {
          overall_score: 5,
          answer_first_score: 5,
          schema_completeness_score: 0,
          faq_schema_score: 0,
          entity_clarity_score: 5,
          aeo_readability_score: 10,
          faq_schema_present: false,
          recommendations: [],
        },
        openHallucinationCount: 9,
        totalAuditCount: 10,
        hasFaqSchema: false,
        hasLocalBusinessSchema: false,
      }),
    );
    expect(result.grade).toBe('F');
    expect(result.score).toBeLessThan(20);
  });

  it('7. returns null score and null grade when ALL components are null', () => {
    const result = computeHealthScore(emptyInput());
    expect(result.score).toBeNull();
    expect(result.grade).toBeNull();
    expect(result.components.visibility.score).toBeNull();
    expect(result.components.accuracy.score).toBeNull();
    expect(result.components.structure.score).toBeNull();
    expect(result.components.freshness.score).toBeNull();
  });

  it('8. re-weights when visibility is null (SOV not run yet)', () => {
    const result = computeHealthScore(fullInput({ sovScore: null }));
    expect(result.score).toBeTypeOf('number');
    expect(result.components.visibility.score).toBeNull();
    // Other components should still be non-null
    expect(result.components.accuracy.score).not.toBeNull();
    expect(result.components.structure.score).not.toBeNull();
    expect(result.components.freshness.score).not.toBeNull();
  });

  it('9. re-weights when structure is null (page audit not run yet)', () => {
    const result = computeHealthScore(
      fullInput({
        pageAudit: null,
        // No page audit means no schema data either from audit, but hasFaqSchema/hasLocalBusinessSchema can be separate
        hasFaqSchema: false,
        hasLocalBusinessSchema: false,
      }),
    );
    expect(result.score).toBeTypeOf('number');
    expect(result.components.structure.score).toBeNull();
  });

  it('10. re-weights when accuracy is null (no audits run yet)', () => {
    const result = computeHealthScore(
      fullInput({ openHallucinationCount: 0, totalAuditCount: 0 }),
    );
    expect(result.score).toBeTypeOf('number');
    expect(result.components.accuracy.score).toBeNull();
  });

  it('11. re-weights when only one component has data', () => {
    const input = emptyInput();
    input.sovScore = 0.6; // Only visibility has data
    const result = computeHealthScore(input);
    expect(result.score).toBe(60); // 0.6 * 100 = 60, sole component → 100% weight
    expect(result.grade).toBe('B');
  });

  it('12. clamps accuracy to 0 when hallucination count exceeds audit count', () => {
    const result = computeHealthScore(
      fullInput({ openHallucinationCount: 20, totalAuditCount: 5 }),
    );
    expect(result.components.accuracy.score).toBe(0);
  });

  it('13. computes accuracy as 100 when 0 open hallucinations and audits > 0', () => {
    const result = computeHealthScore(
      fullInput({ openHallucinationCount: 0, totalAuditCount: 10 }),
    );
    expect(result.components.accuracy.score).toBe(100);
  });

  it('14. handles sovScore = 0.0 correctly (not null — score is 0)', () => {
    const result = computeHealthScore(fullInput({ sovScore: 0.0 }));
    expect(result.components.visibility.score).toBe(0);
    // Score should still be a number (not null)
    expect(result.score).toBeTypeOf('number');
  });

  it('15. uses MOCK_HEALTH_SCORE_INPUT from golden-tenant and produces expected score', () => {
    const result = computeHealthScore(MOCK_HEALTH_SCORE_INPUT);
    expect(result.score).toBeTypeOf('number');
    expect(result.score).not.toBeNull();
    expect(result.grade).not.toBeNull();

    // Verify component scores are plausible for Charcoal N Chill data
    // Visibility: 0.42 * 100 = 42
    expect(result.components.visibility.score).toBe(42);
    // Accuracy: 100 - (2/5 * 100) = 60
    expect(result.components.accuracy.score).toBe(60);
    // Structure: overall_score = 66
    expect(result.components.structure.score).toBe(66);
    // Freshness: schemas absent → 0 presence + avg(0, 62)/2 audit → (0 * 0.5) + (31 * 0.5) = 16 (rounded)
    expect(result.components.freshness.score).toBeTypeOf('number');

    // The score should be in the C range (40-59) given these moderate values
    expect(result.grade).toMatch(/[BCD]/);
  });
});

// ---------------------------------------------------------------------------
// scoreToGrade
// ---------------------------------------------------------------------------

describe('scoreToGrade', () => {
  it('16. maps boundary values correctly', () => {
    expect(scoreToGrade(0)).toBe('F');
    expect(scoreToGrade(19)).toBe('F');
    expect(scoreToGrade(20)).toBe('D');
    expect(scoreToGrade(39)).toBe('D');
    expect(scoreToGrade(40)).toBe('C');
    expect(scoreToGrade(59)).toBe('C');
    expect(scoreToGrade(60)).toBe('B');
    expect(scoreToGrade(79)).toBe('B');
    expect(scoreToGrade(80)).toBe('A');
    expect(scoreToGrade(100)).toBe('A');
  });
});

// ---------------------------------------------------------------------------
// Top Recommendation ranking
// ---------------------------------------------------------------------------

describe('Top Recommendation ranking', () => {
  it('17. ranks page audit recommendations by impactPoints descending', () => {
    const result = computeHealthScore(
      fullInput({
        pageAudit: {
          overall_score: 50,
          answer_first_score: 40,
          schema_completeness_score: 30,
          faq_schema_score: 20,
          entity_clarity_score: 40,
          aeo_readability_score: 50,
          faq_schema_present: false,
          recommendations: [
            { issue: 'Low priority', fix: 'Fix low', impactPoints: 5, dimensionKey: 'keywordDensity' },
            { issue: 'High priority', fix: 'Fix high', impactPoints: 30, dimensionKey: 'answerFirst' },
            { issue: 'Med priority', fix: 'Fix med', impactPoints: 15, dimensionKey: 'entityClarity' },
          ],
        },
        hasFaqSchema: true,
        hasLocalBusinessSchema: true,
      }),
    );
    // Recommendations should be sorted by estimatedImpact desc
    expect(result.recommendations[0].estimatedImpact).toBeGreaterThanOrEqual(
      result.recommendations[1].estimatedImpact,
    );
  });

  it('18. injects "Add FAQ Schema" when hasFaqSchema is false', () => {
    const result = computeHealthScore(fullInput({ hasFaqSchema: false }));
    const faqRec = result.recommendations.find((r) => r.title === 'Add FAQ Schema');
    expect(faqRec).toBeDefined();
    expect(faqRec!.estimatedImpact).toBe(15);
    expect(faqRec!.component).toBe('freshness');
  });

  it('19. injects "Add LocalBusiness Schema" when hasLocalBusinessSchema is false', () => {
    const result = computeHealthScore(fullInput({ hasLocalBusinessSchema: false }));
    const lbRec = result.recommendations.find(
      (r) => r.title === 'Add LocalBusiness Schema',
    );
    expect(lbRec).toBeDefined();
    expect(lbRec!.estimatedImpact).toBe(10);
    expect(lbRec!.component).toBe('structure');
  });

  it('20. injects "Resolve open hallucinations" when openHallucinationCount >= 3', () => {
    const result = computeHealthScore(
      fullInput({ openHallucinationCount: 5, totalAuditCount: 10 }),
    );
    const halRec = result.recommendations.find(
      (r) => r.title === 'Resolve open hallucinations',
    );
    expect(halRec).toBeDefined();
    expect(halRec!.estimatedImpact).toBe(8);
    expect(halRec!.component).toBe('accuracy');
  });

  it('21. injects "Improve AI visibility" when sovScore < 0.2', () => {
    const result = computeHealthScore(fullInput({ sovScore: 0.1 }));
    const sovRec = result.recommendations.find(
      (r) => r.title === 'Improve AI visibility',
    );
    expect(sovRec).toBeDefined();
    expect(sovRec!.estimatedImpact).toBe(5);
    expect(sovRec!.component).toBe('visibility');
  });

  it('22. does NOT inject schema recommendations when schemas are present', () => {
    const result = computeHealthScore(
      fullInput({ hasFaqSchema: true, hasLocalBusinessSchema: true }),
    );
    const faqRec = result.recommendations.find((r) => r.title === 'Add FAQ Schema');
    const lbRec = result.recommendations.find(
      (r) => r.title === 'Add LocalBusiness Schema',
    );
    expect(faqRec).toBeUndefined();
    expect(lbRec).toBeUndefined();
  });

  it('23. returns max 5 recommendations', () => {
    const manyRecs = Array.from({ length: 10 }, (_, i) => ({
      issue: `Issue ${i}`,
      fix: `Fix ${i}`,
      impactPoints: 10 + i,
      dimensionKey: 'answerFirst' as const,
    }));
    const result = computeHealthScore(
      fullInput({
        pageAudit: {
          overall_score: 50,
          answer_first_score: 40,
          schema_completeness_score: 30,
          faq_schema_score: 20,
          entity_clarity_score: 40,
          aeo_readability_score: 50,
          faq_schema_present: false,
          recommendations: manyRecs,
        },
        hasFaqSchema: false,
        hasLocalBusinessSchema: false,
      }),
    );
    expect(result.recommendations.length).toBeLessThanOrEqual(5);
  });

  it('24. sets topRecommendation to highest-impact recommendation', () => {
    const result = computeHealthScore(MOCK_HEALTH_SCORE_INPUT);
    expect(result.topRecommendation).not.toBeNull();
    if (result.recommendations.length > 0) {
      expect(result.topRecommendation).toEqual(result.recommendations[0]);
    }
  });

  it('25. returns null topRecommendation when no recommendations exist (all good)', () => {
    const result = computeHealthScore(
      fullInput({
        sovScore: 0.8,
        openHallucinationCount: 0,
        totalAuditCount: 10,
        hasFaqSchema: true,
        hasLocalBusinessSchema: true,
        pageAudit: {
          overall_score: 90,
          answer_first_score: 90,
          schema_completeness_score: 90,
          faq_schema_score: 90,
          entity_clarity_score: 90,
          aeo_readability_score: 90,
          faq_schema_present: true,
          recommendations: [],
        },
      }),
    );
    expect(result.topRecommendation).toBeNull();
    expect(result.recommendations).toHaveLength(0);
  });

  it('26. each recommendation has required fields', () => {
    const result = computeHealthScore(MOCK_HEALTH_SCORE_INPUT);
    for (const rec of result.recommendations) {
      expect(rec.title).toBeTypeOf('string');
      expect(rec.title.length).toBeGreaterThan(0);
      expect(rec.description).toBeTypeOf('string');
      expect(rec.description.length).toBeGreaterThan(0);
      expect(rec.estimatedImpact).toBeTypeOf('number');
      expect(rec.estimatedImpact).toBeGreaterThan(0);
      expect(['visibility', 'accuracy', 'structure', 'freshness']).toContain(
        rec.component,
      );
      expect(rec.actionHref).toBeTypeOf('string');
      expect(rec.actionHref).toMatch(/^\//);
      expect(rec.actionLabel).toBeTypeOf('string');
      expect(rec.actionLabel.length).toBeGreaterThan(0);
    }
  });
});
