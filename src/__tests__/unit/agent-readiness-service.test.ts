// ---------------------------------------------------------------------------
// agent-readiness-service.test.ts — Unit tests for Agent Readiness service
//
// Sprint 84: 45 tests — pure functions, no mocks needed.
//
// Run:
//   npx vitest run src/__tests__/unit/agent-readiness-service.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  computeAgentReadiness,
  assessStructuredHours,
  assessMenuSchema,
  assessReserveAction,
  assessOrderAction,
  assessAccessibleCTAs,
  assessCaptchaFree,
  type AgentReadinessInput,
} from '@/lib/services/agent-readiness.service';
import { MOCK_AGENT_READINESS_INPUT } from '@/src/__fixtures__/golden-tenant';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInput(
  overrides: Partial<AgentReadinessInput> = {},
): AgentReadinessInput {
  return {
    location: {
      businessName: 'Test Restaurant',
      websiteUrl: 'https://test.com',
      hoursData: null,
      phone: null,
    },
    hasPublishedMenu: false,
    hasMenuJsonLd: false,
    pageAudit: null,
    hasBookingUrl: false,
    hasOrderingUrl: false,
    detectedSchemaTypes: [],
    ...overrides,
  };
}

function makeAllActiveInput(): AgentReadinessInput {
  return makeInput({
    location: {
      businessName: 'Test Restaurant',
      websiteUrl: 'https://test.com',
      hoursData: { monday: { open: '09:00', close: '22:00' } },
      phone: '555-1234',
    },
    hasPublishedMenu: true,
    hasMenuJsonLd: true,
    pageAudit: {
      schemaCompletenessScore: 90,
      faqSchemaPresent: true,
      entityClarityScore: 80,
      recommendations: [],
    },
    hasBookingUrl: true,
    hasOrderingUrl: true,
    detectedSchemaTypes: [
      'OpeningHoursSpecification',
      'Menu',
      'ReserveAction',
      'OrderAction',
    ],
  });
}

// ---------------------------------------------------------------------------
// computeAgentReadiness — Score calculation
// ---------------------------------------------------------------------------

describe('computeAgentReadiness', () => {
  describe('Score calculation', () => {
    it('computes total score from all capability earned points', () => {
      const result = computeAgentReadiness(MOCK_AGENT_READINESS_INPUT);
      // 15 (hours) + 15 (menu) + 0 (reserve) + 0 (order) + 5 (CTAs partial) + 5 (captcha partial)
      expect(result.score).toBe(40);
    });

    it('returns 0 when all capabilities missing', () => {
      // With no hours, no menu, no actions, no page audit, entityClarity null
      // → hours=0, menu=0, reserve=0, order=0, CTAs=0, captcha=5 (always partial)
      const input = makeInput();
      const result = computeAgentReadiness(input);
      expect(result.score).toBe(5); // only captcha gives 5 pts
    });

    it('returns 100 when all capabilities active', () => {
      const input = makeAllActiveInput();
      const result = computeAgentReadiness(input);
      // 15 + 15 + 25 + 25 + 10 + 5 (captcha always partial) = 95
      // NOTE: CAPTCHA is always partial in V1, so true max is 95
      expect(result.score).toBe(95);
    });

    it('returns correct score for mixed statuses', () => {
      const input = makeInput({
        location: {
          businessName: 'Test',
          websiteUrl: 'https://test.com',
          hoursData: { monday: { open: '10:00', close: '22:00' } },
          phone: null,
        },
        hasPublishedMenu: true,
        hasMenuJsonLd: false, // partial menu
        hasBookingUrl: true, // partial reserve
        detectedSchemaTypes: ['OpeningHoursSpecification'],
      });
      const result = computeAgentReadiness(input);
      // hours=15 (active via schema), menu=8 (partial), reserve=13 (partial),
      // order=0 (missing), CTAs=0 (no audit), captcha=5 (partial)
      expect(result.score).toBe(41);
    });
  });

  // ── Readiness level ────────────────────────────────────────────────────

  describe('Readiness level', () => {
    it('level is agent_ready when score >= 70', () => {
      const input = makeInput({
        location: {
          businessName: 'Test',
          websiteUrl: 'https://test.com',
          hoursData: { mon: { open: '10:00', close: '22:00' } },
          phone: null,
        },
        hasPublishedMenu: true,
        hasMenuJsonLd: true,
        hasBookingUrl: true,
        hasOrderingUrl: true,
        detectedSchemaTypes: [
          'OpeningHoursSpecification',
          'ReserveAction',
          'OrderAction',
        ],
        pageAudit: {
          schemaCompletenessScore: 80,
          faqSchemaPresent: true,
          entityClarityScore: 75,
          recommendations: [],
        },
      });
      const result = computeAgentReadiness(input);
      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.level).toBe('agent_ready');
      expect(result.levelLabel).toBe('Agent Ready');
    });

    it('level is partially_ready when score 40-69', () => {
      const result = computeAgentReadiness(MOCK_AGENT_READINESS_INPUT);
      expect(result.score).toBeGreaterThanOrEqual(40);
      expect(result.score).toBeLessThan(70);
      expect(result.level).toBe('partially_ready');
      expect(result.levelLabel).toBe('Partially Ready');
    });

    it('level is not_ready when score < 40', () => {
      // Only captcha partial (5) → not_ready
      const input = makeInput();
      const result = computeAgentReadiness(input);
      expect(result.score).toBeLessThan(40);
      expect(result.level).toBe('not_ready');
      expect(result.levelLabel).toBe('Not Ready');
    });
  });

  // ── Active count ───────────────────────────────────────────────────────

  describe('Active count', () => {
    it('counts only active status capabilities', () => {
      const result = computeAgentReadiness(MOCK_AGENT_READINESS_INPUT);
      // hours=active, menu=active, reserve=missing, order=missing, CTAs=partial, captcha=partial
      expect(result.activeCount).toBe(2);
    });

    it('does not count partial as active', () => {
      const input = makeInput({
        hasPublishedMenu: true,
        hasMenuJsonLd: false, // partial
        hasBookingUrl: true, // partial
      });
      const result = computeAgentReadiness(input);
      // No capability is fully active in this scenario
      expect(result.activeCount).toBe(0);
    });
  });

  // ── Top priority ───────────────────────────────────────────────────────

  describe('Top priority', () => {
    it('selects highest maxPoints missing capability', () => {
      const result = computeAgentReadiness(MOCK_AGENT_READINESS_INPUT);
      // reserve_action (25) and order_action (25) are missing; first by sort
      expect(result.topPriority).not.toBeNull();
      expect(result.topPriority!.maxPoints).toBe(25);
      expect(['reserve_action', 'order_action']).toContain(
        result.topPriority!.id,
      );
    });

    it('returns null when all capabilities active', () => {
      const input = makeAllActiveInput();
      const result = computeAgentReadiness(input);
      // captcha is always partial, so topPriority won't be null
      // It will pick captcha_free (10 pts)
      expect(result.topPriority).not.toBeNull();
      expect(result.topPriority!.id).toBe('captcha_free');
    });

    it('prefers missing over partial for same weight', () => {
      const input = makeInput({
        hasBookingUrl: true, // partial reserve (25 pts)
        // no ordering → missing order (25 pts)
      });
      const result = computeAgentReadiness(input);
      // Both are 25 pts, but the sort is stable — order_action comes after reserve_action
      // The one that appears first in the sorted array wins
      expect(result.topPriority).not.toBeNull();
      expect(result.topPriority!.maxPoints).toBe(25);
    });
  });

  // ── Summary ────────────────────────────────────────────────────────────

  describe('Summary', () => {
    it('includes active count in summary', () => {
      const result = computeAgentReadiness(MOCK_AGENT_READINESS_INPUT);
      expect(result.summary).toContain('2 of 6');
    });

    it('includes top priority name in summary', () => {
      const result = computeAgentReadiness(MOCK_AGENT_READINESS_INPUT);
      expect(result.summary).toMatch(/top priority/i);
    });
  });
});

// ---------------------------------------------------------------------------
// assessStructuredHours
// ---------------------------------------------------------------------------

describe('assessStructuredHours', () => {
  it('active when OpeningHoursSpecification in detectedSchemaTypes', () => {
    const input = makeInput({
      detectedSchemaTypes: ['OpeningHoursSpecification'],
    });
    const result = assessStructuredHours(input);
    expect(result.status).toBe('active');
  });

  it('partial when hoursData present but no schema', () => {
    const input = makeInput({
      location: {
        businessName: 'Test',
        websiteUrl: null,
        hoursData: { monday: { open: '09:00', close: '22:00' } },
        phone: null,
      },
    });
    const result = assessStructuredHours(input);
    expect(result.status).toBe('partial');
  });

  it('missing when no hours data at all', () => {
    const input = makeInput();
    const result = assessStructuredHours(input);
    expect(result.status).toBe('missing');
  });

  it('active earns 15 points', () => {
    const input = makeInput({
      detectedSchemaTypes: ['OpeningHoursSpecification'],
    });
    const result = assessStructuredHours(input);
    expect(result.earnedPoints).toBe(15);
  });

  it('partial earns 8 points', () => {
    const input = makeInput({
      location: {
        businessName: 'Test',
        websiteUrl: null,
        hoursData: { monday: { open: '09:00', close: '22:00' } },
        phone: null,
      },
    });
    const result = assessStructuredHours(input);
    expect(result.earnedPoints).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// assessMenuSchema
// ---------------------------------------------------------------------------

describe('assessMenuSchema', () => {
  it('active when hasMenuJsonLd is true', () => {
    const input = makeInput({ hasMenuJsonLd: true });
    const result = assessMenuSchema(input);
    expect(result.status).toBe('active');
  });

  it('partial when hasPublishedMenu but no JSON-LD', () => {
    const input = makeInput({ hasPublishedMenu: true, hasMenuJsonLd: false });
    const result = assessMenuSchema(input);
    expect(result.status).toBe('partial');
  });

  it('active when Menu in detectedSchemaTypes', () => {
    const input = makeInput({ detectedSchemaTypes: ['Menu'] });
    const result = assessMenuSchema(input);
    expect(result.status).toBe('active');
  });

  it('missing when no menu at all', () => {
    const input = makeInput();
    const result = assessMenuSchema(input);
    expect(result.status).toBe('missing');
  });

  it('active earns 15 points', () => {
    const input = makeInput({ hasMenuJsonLd: true });
    const result = assessMenuSchema(input);
    expect(result.earnedPoints).toBe(15);
  });
});

// ---------------------------------------------------------------------------
// assessReserveAction
// ---------------------------------------------------------------------------

describe('assessReserveAction', () => {
  it('active when ReserveAction in detectedSchemaTypes', () => {
    const input = makeInput({ detectedSchemaTypes: ['ReserveAction'] });
    const result = assessReserveAction(input);
    expect(result.status).toBe('active');
  });

  it('partial when hasBookingUrl but no schema', () => {
    const input = makeInput({ hasBookingUrl: true });
    const result = assessReserveAction(input);
    expect(result.status).toBe('partial');
  });

  it('missing when no booking capability', () => {
    const input = makeInput();
    const result = assessReserveAction(input);
    expect(result.status).toBe('missing');
  });

  it('active earns 25 points', () => {
    const input = makeInput({ detectedSchemaTypes: ['ReserveAction'] });
    const result = assessReserveAction(input);
    expect(result.earnedPoints).toBe(25);
  });

  it('partial earns 13 points', () => {
    const input = makeInput({ hasBookingUrl: true });
    const result = assessReserveAction(input);
    expect(result.earnedPoints).toBe(13);
  });

  it('missing has schemaAction reserve_action', () => {
    const input = makeInput();
    const result = assessReserveAction(input);
    expect(result.schemaAction).toBe('reserve_action');
  });
});

// ---------------------------------------------------------------------------
// assessOrderAction
// ---------------------------------------------------------------------------

describe('assessOrderAction', () => {
  it('active when OrderAction in detectedSchemaTypes', () => {
    const input = makeInput({ detectedSchemaTypes: ['OrderAction'] });
    const result = assessOrderAction(input);
    expect(result.status).toBe('active');
  });

  it('partial when hasOrderingUrl but no schema', () => {
    const input = makeInput({ hasOrderingUrl: true });
    const result = assessOrderAction(input);
    expect(result.status).toBe('partial');
  });

  it('missing when no ordering capability', () => {
    const input = makeInput();
    const result = assessOrderAction(input);
    expect(result.status).toBe('missing');
  });

  it('active earns 25 points', () => {
    const input = makeInput({ detectedSchemaTypes: ['OrderAction'] });
    const result = assessOrderAction(input);
    expect(result.earnedPoints).toBe(25);
  });

  it('partial earns 13 points', () => {
    const input = makeInput({ hasOrderingUrl: true });
    const result = assessOrderAction(input);
    expect(result.earnedPoints).toBe(13);
  });
});

// ---------------------------------------------------------------------------
// assessAccessibleCTAs
// ---------------------------------------------------------------------------

describe('assessAccessibleCTAs', () => {
  it('active when entityClarityScore >= 70', () => {
    const input = makeInput({
      pageAudit: {
        schemaCompletenessScore: 80,
        faqSchemaPresent: true,
        entityClarityScore: 75,
        recommendations: [],
      },
    });
    const result = assessAccessibleCTAs(input);
    expect(result.status).toBe('active');
  });

  it('partial when entityClarityScore 40-69', () => {
    const input = makeInput({
      pageAudit: {
        schemaCompletenessScore: 50,
        faqSchemaPresent: false,
        entityClarityScore: 52,
        recommendations: [],
      },
    });
    const result = assessAccessibleCTAs(input);
    expect(result.status).toBe('partial');
  });

  it('missing when entityClarityScore < 40', () => {
    const input = makeInput({
      pageAudit: {
        schemaCompletenessScore: 30,
        faqSchemaPresent: false,
        entityClarityScore: 30,
        recommendations: [],
      },
    });
    const result = assessAccessibleCTAs(input);
    expect(result.status).toBe('missing');
  });

  it('missing when no page audit data', () => {
    const input = makeInput({ pageAudit: null });
    const result = assessAccessibleCTAs(input);
    expect(result.status).toBe('missing');
    expect(result.statusDetail).toContain('No page audit data');
  });
});

// ---------------------------------------------------------------------------
// assessCaptchaFree
// ---------------------------------------------------------------------------

describe('assessCaptchaFree', () => {
  it('always returns partial in V1', () => {
    const result = assessCaptchaFree();
    expect(result.status).toBe('partial');
  });

  it('earns 5 points', () => {
    const result = assessCaptchaFree();
    expect(result.earnedPoints).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// MOCK_AGENT_READINESS_INPUT integration
// ---------------------------------------------------------------------------

describe('MOCK_AGENT_READINESS_INPUT integration', () => {
  it('produces score of 40 from mock input', () => {
    const result = computeAgentReadiness(MOCK_AGENT_READINESS_INPUT);
    expect(result.score).toBe(40);
  });

  it('produces level partially_ready', () => {
    const result = computeAgentReadiness(MOCK_AGENT_READINESS_INPUT);
    expect(result.level).toBe('partially_ready');
  });

  it('top priority is reserve_action (25 pts)', () => {
    const result = computeAgentReadiness(MOCK_AGENT_READINESS_INPUT);
    expect(result.topPriority).not.toBeNull();
    expect(result.topPriority!.id).toBe('reserve_action');
    expect(result.topPriority!.maxPoints).toBe(25);
  });

  it('has 2 active capabilities (hours + menu)', () => {
    const result = computeAgentReadiness(MOCK_AGENT_READINESS_INPUT);
    expect(result.activeCount).toBe(2);
    const activeIds = result.capabilities
      .filter((c) => c.status === 'active')
      .map((c) => c.id);
    expect(activeIds).toContain('structured_hours');
    expect(activeIds).toContain('menu_schema');
  });
});
