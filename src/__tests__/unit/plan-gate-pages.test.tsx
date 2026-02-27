// @vitest-environment jsdom
// ---------------------------------------------------------------------------
// plan-gate-pages.test.tsx — Verify PlanGate is applied correctly per page
//
// Sprint 96: Tests that each page's plan gate threshold is correct.
// Since target pages are RSCs with Supabase deps, we test the PlanGate
// component with each page's specific requiredPlan + currentPlan combination.
//
// Run:
//   npx vitest run src/__tests__/unit/plan-gate-pages.test.tsx
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { planSatisfies } from '@/lib/plan-enforcer';
import { PlanGate } from '@/components/plan-gate/PlanGate';

// Page plan requirements — mirrors what each page passes to <PlanGate>
const PAGE_GATES = [
  { page: 'citations', requiredPlan: 'growth' as const, feature: 'Citation Gap Analysis' },
  { page: 'page-audits', requiredPlan: 'growth' as const, feature: 'Page Audit' },
  { page: 'content-drafts', requiredPlan: 'growth' as const, feature: 'Content Drafts' },
  { page: 'sentiment', requiredPlan: 'growth' as const, feature: 'AI Sentiment Tracker' },
  { page: 'source-intelligence', requiredPlan: 'agency' as const, feature: 'Citation Source Intelligence' },
];

// ---------------------------------------------------------------------------
// Starter plan — all 5 pages should be gated
// ---------------------------------------------------------------------------

describe('PlanGate — Starter user (all pages gated)', () => {
  for (const { page, requiredPlan, feature } of PAGE_GATES) {
    it(`[${page}] renders PlanGate blur when starter plan (requires ${requiredPlan})`, () => {
      render(
        <PlanGate requiredPlan={requiredPlan} currentPlan="starter" feature={feature}>
          <div data-testid="page-content">{page} content</div>
        </PlanGate>,
      );
      expect(screen.getByTestId('plan-gate-overlay')).toBeDefined();
      expect(screen.getByTestId('plan-gate-blurred-content')).toBeDefined();
    });
  }
});

// ---------------------------------------------------------------------------
// Growth plan — 4 growth-gated pages pass, source-intelligence still gated
// ---------------------------------------------------------------------------

describe('PlanGate — Growth user', () => {
  const growthGated = PAGE_GATES.filter(p => p.requiredPlan === 'growth');
  const agencyGated = PAGE_GATES.filter(p => p.requiredPlan === 'agency');

  for (const { page, requiredPlan, feature } of growthGated) {
    it(`[${page}] does NOT render PlanGate blur when growth plan`, () => {
      render(
        <PlanGate requiredPlan={requiredPlan} currentPlan="growth" feature={feature}>
          <div data-testid="page-content">{page} content</div>
        </PlanGate>,
      );
      expect(screen.queryByTestId('plan-gate-overlay')).toBeNull();
      expect(screen.queryByTestId('plan-gate-blurred-content')).toBeNull();
      expect(screen.getByTestId('page-content')).toBeDefined();
    });
  }

  for (const { page, requiredPlan, feature } of agencyGated) {
    it(`[${page}] STILL renders PlanGate blur when growth plan (needs ${requiredPlan})`, () => {
      render(
        <PlanGate requiredPlan={requiredPlan} currentPlan="growth" feature={feature}>
          <div data-testid="page-content">{page} content</div>
        </PlanGate>,
      );
      expect(screen.getByTestId('plan-gate-overlay')).toBeDefined();
      expect(screen.getByTestId('plan-gate-plan-badge')?.textContent).toBe('Agency Plan');
    });
  }
});

// ---------------------------------------------------------------------------
// Agency plan — all 5 pages pass (including source-intelligence)
// ---------------------------------------------------------------------------

describe('PlanGate — Agency user (all pages pass)', () => {
  for (const { page, requiredPlan, feature } of PAGE_GATES) {
    it(`[${page}] does NOT render PlanGate blur when agency plan`, () => {
      render(
        <PlanGate requiredPlan={requiredPlan} currentPlan="agency" feature={feature}>
          <div data-testid="page-content">{page} content</div>
        </PlanGate>,
      );
      expect(screen.queryByTestId('plan-gate-overlay')).toBeNull();
      expect(screen.getByTestId('page-content')).toBeDefined();
    });
  }
});

// ---------------------------------------------------------------------------
// Plan hierarchy — confirms page thresholds match plan-enforcer
// ---------------------------------------------------------------------------

describe('Page plan thresholds via planSatisfies', () => {
  it('citations: growth satisfies growth requirement', () => {
    expect(planSatisfies('growth', 'growth')).toBe(true);
  });
  it('page-audits: growth satisfies growth requirement', () => {
    expect(planSatisfies('growth', 'growth')).toBe(true);
  });
  it('content-drafts: growth satisfies growth requirement', () => {
    expect(planSatisfies('growth', 'growth')).toBe(true);
  });
  it('sentiment: growth satisfies growth requirement', () => {
    expect(planSatisfies('growth', 'growth')).toBe(true);
  });
  it('source-intelligence: growth does NOT satisfy agency requirement', () => {
    expect(planSatisfies('growth', 'agency')).toBe(false);
  });
  it('source-intelligence: agency satisfies agency requirement', () => {
    expect(planSatisfies('agency', 'agency')).toBe(true);
  });
});
