// @vitest-environment jsdom
// ---------------------------------------------------------------------------
// plan-gate.test.tsx — Unit tests for planSatisfies() + PlanGate component
//
// Sprint 96: ~28 tests — pure function + RSC component tests.
//
// Run:
//   npx vitest run src/__tests__/unit/plan-gate.test.tsx
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { planSatisfies, PLAN_HIERARCHY } from '@/lib/plan-enforcer';
import { PlanGate } from '@/components/plan-gate/PlanGate';

// ---------------------------------------------------------------------------
// planSatisfies() — 12 tests
// ---------------------------------------------------------------------------

describe('planSatisfies', () => {
  it('starter satisfies starter', () => {
    expect(planSatisfies('starter', 'starter')).toBe(true);
  });

  it('growth satisfies starter', () => {
    expect(planSatisfies('growth', 'starter')).toBe(true);
  });

  it('growth satisfies growth', () => {
    expect(planSatisfies('growth', 'growth')).toBe(true);
  });

  it('agency satisfies growth', () => {
    expect(planSatisfies('agency', 'growth')).toBe(true);
  });

  it('agency satisfies starter', () => {
    expect(planSatisfies('agency', 'starter')).toBe(true);
  });

  it('agency satisfies agency (same level)', () => {
    expect(planSatisfies('agency', 'agency')).toBe(true);
  });

  it('starter does NOT satisfy growth', () => {
    expect(planSatisfies('starter', 'growth')).toBe(false);
  });

  it('starter does NOT satisfy agency', () => {
    expect(planSatisfies('starter', 'agency')).toBe(false);
  });

  it('growth does NOT satisfy agency', () => {
    expect(planSatisfies('growth', 'agency')).toBe(false);
  });

  it('trial does NOT satisfy growth', () => {
    expect(planSatisfies('trial', 'growth')).toBe(false);
  });

  it('unknown plan treated as trial (index 0)', () => {
    expect(planSatisfies('banana', 'growth')).toBe(false);
  });

  it('null plan treated as trial', () => {
    expect(planSatisfies(null, 'growth')).toBe(false);
  });

  it('undefined plan treated as trial', () => {
    expect(planSatisfies(undefined, 'growth')).toBe(false);
  });

  it('empty string treated as trial', () => {
    expect(planSatisfies('', 'growth')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PLAN_HIERARCHY — sanity checks
// ---------------------------------------------------------------------------

describe('PLAN_HIERARCHY', () => {
  it('has trial < starter < growth < agency', () => {
    expect(PLAN_HIERARCHY['trial']).toBeLessThan(PLAN_HIERARCHY['starter']);
    expect(PLAN_HIERARCHY['starter']).toBeLessThan(PLAN_HIERARCHY['growth']);
    expect(PLAN_HIERARCHY['growth']).toBeLessThan(PLAN_HIERARCHY['agency']);
  });
});

// ---------------------------------------------------------------------------
// PlanGate component — 16 tests
// ---------------------------------------------------------------------------

describe('PlanGate', () => {
  const childText = 'Premium content here';

  // Pass-through when satisfied
  it('renders children normally when growth plan meets growth requirement', () => {
    render(
      <PlanGate requiredPlan="growth" currentPlan="growth" feature="Test Feature">
        <p>{childText}</p>
      </PlanGate>,
    );
    expect(screen.getByText(childText)).toBeDefined();
  });

  it('renders children normally when agency plan meets growth requirement', () => {
    render(
      <PlanGate requiredPlan="growth" currentPlan="agency" feature="Test Feature">
        <p>{childText}</p>
      </PlanGate>,
    );
    expect(screen.getByText(childText)).toBeDefined();
  });

  it('renders children normally when agency meets agency requirement', () => {
    render(
      <PlanGate requiredPlan="agency" currentPlan="agency" feature="Test Feature">
        <p>{childText}</p>
      </PlanGate>,
    );
    expect(screen.getByText(childText)).toBeDefined();
  });

  it('does NOT render blur wrapper when plan satisfied', () => {
    render(
      <PlanGate requiredPlan="growth" currentPlan="growth" feature="Test Feature">
        <p>{childText}</p>
      </PlanGate>,
    );
    expect(screen.queryByTestId('plan-gate-blurred-content')).toBeNull();
  });

  it('does NOT render upgrade overlay when plan satisfied', () => {
    render(
      <PlanGate requiredPlan="growth" currentPlan="growth" feature="Test Feature">
        <p>{childText}</p>
      </PlanGate>,
    );
    expect(screen.queryByTestId('plan-gate-overlay')).toBeNull();
  });

  // Gated — blur teaser
  it('renders blur wrapper when starter hits growth requirement', () => {
    render(
      <PlanGate requiredPlan="growth" currentPlan="starter" feature="Test Feature">
        <p>{childText}</p>
      </PlanGate>,
    );
    expect(screen.getByTestId('plan-gate-blurred-content')).toBeDefined();
  });

  it('renders children inside blur wrapper (real data, not placeholder)', () => {
    render(
      <PlanGate requiredPlan="growth" currentPlan="starter" feature="Test Feature">
        <p>{childText}</p>
      </PlanGate>,
    );
    const blurred = screen.getByTestId('plan-gate-blurred-content');
    expect(blurred.textContent).toContain(childText);
  });

  it('renders upgrade overlay when gated', () => {
    render(
      <PlanGate requiredPlan="growth" currentPlan="starter" feature="Test Feature">
        <p>{childText}</p>
      </PlanGate>,
    );
    expect(screen.getByTestId('plan-gate-overlay')).toBeDefined();
  });

  it('upgrade CTA has correct href defaulting to /dashboard/billing', () => {
    render(
      <PlanGate requiredPlan="growth" currentPlan="starter" feature="Test Feature">
        <p>{childText}</p>
      </PlanGate>,
    );
    const cta = screen.getByTestId('plan-gate-upgrade-cta') as HTMLAnchorElement;
    expect(cta.getAttribute('href')).toBe('/dashboard/billing');
  });

  it('upgrade CTA accepts custom upgradeHref override', () => {
    render(
      <PlanGate
        requiredPlan="growth"
        currentPlan="starter"
        feature="Test Feature"
        upgradeHref="/pricing"
      >
        <p>{childText}</p>
      </PlanGate>,
    );
    const cta = screen.getByTestId('plan-gate-upgrade-cta') as HTMLAnchorElement;
    expect(cta.getAttribute('href')).toBe('/pricing');
  });

  it('displays correct feature name in overlay title', () => {
    render(
      <PlanGate requiredPlan="growth" currentPlan="starter" feature="Citation Gap Analysis">
        <p>{childText}</p>
      </PlanGate>,
    );
    expect(screen.getByTestId('plan-gate-title').textContent).toBe('Citation Gap Analysis');
  });

  it('displays correct plan name badge (capitalized)', () => {
    render(
      <PlanGate requiredPlan="growth" currentPlan="starter" feature="Test Feature">
        <p>{childText}</p>
      </PlanGate>,
    );
    expect(screen.getByTestId('plan-gate-plan-badge').textContent).toBe('Growth Plan');
  });

  it('displays Agency plan badge when agency required', () => {
    render(
      <PlanGate requiredPlan="agency" currentPlan="growth" feature="Test Feature">
        <p>{childText}</p>
      </PlanGate>,
    );
    expect(screen.getByTestId('plan-gate-plan-badge').textContent).toBe('Agency Plan');
  });

  it('blurred content has aria-hidden="true"', () => {
    render(
      <PlanGate requiredPlan="growth" currentPlan="starter" feature="Test Feature">
        <p>{childText}</p>
      </PlanGate>,
    );
    const blurred = screen.getByTestId('plan-gate-blurred-content');
    expect(blurred.getAttribute('aria-hidden')).toBe('true');
  });

  it('overlay has role="region" with aria-label', () => {
    render(
      <PlanGate requiredPlan="growth" currentPlan="starter" feature="Test Feature">
        <p>{childText}</p>
      </PlanGate>,
    );
    const overlay = screen.getByTestId('plan-gate-overlay');
    expect(overlay.getAttribute('role')).toBe('region');
    expect(overlay.getAttribute('aria-label')).toBe('Upgrade required to access Test Feature');
  });

  it('plan-gate-upgrade-cta data-testid present when gated', () => {
    render(
      <PlanGate requiredPlan="growth" currentPlan="trial" feature="Test Feature">
        <p>{childText}</p>
      </PlanGate>,
    );
    expect(screen.getByTestId('plan-gate-upgrade-cta')).toBeDefined();
  });

  it('plan-gate-blurred-content has blur-sm class', () => {
    render(
      <PlanGate requiredPlan="growth" currentPlan="starter" feature="Test Feature">
        <p>{childText}</p>
      </PlanGate>,
    );
    const blurred = screen.getByTestId('plan-gate-blurred-content');
    expect(blurred.className).toContain('blur-sm');
    expect(blurred.className).toContain('pointer-events-none');
  });
});
