/**
 * Onboarding Visible Steps Tests — P0-FIX-03
 *
 * 8 tests verifying getVisibleSteps() correctly filters onboarding
 * steps by plan tier. Trial/starter/growth see 3 steps; agency sees 5.
 */

import { describe, it, expect } from 'vitest';
import { getVisibleSteps, ONBOARDING_STEPS } from '@/lib/onboarding/types';
import type { OnboardingStepId } from '@/lib/onboarding/types';

describe('getVisibleSteps', () => {
  it('returns 3 steps for trial plan', () => {
    const steps = getVisibleSteps('trial');
    expect(steps).toHaveLength(3);
  });

  it('returns 3 steps for starter plan', () => {
    const steps = getVisibleSteps('starter');
    expect(steps).toHaveLength(3);
  });

  it('returns 3 steps for growth plan', () => {
    const steps = getVisibleSteps('growth');
    expect(steps).toHaveLength(3);
  });

  it('returns 5 steps for agency plan', () => {
    const steps = getVisibleSteps('agency');
    expect(steps).toHaveLength(5);
  });

  it('trial plan does not include invite_teammate', () => {
    const ids = getVisibleSteps('trial').map((s) => s.id);
    expect(ids).not.toContain('invite_teammate');
  });

  it('trial plan does not include connect_domain', () => {
    const ids = getVisibleSteps('trial').map((s) => s.id);
    expect(ids).not.toContain('connect_domain');
  });

  it('all plans include business_profile, first_scan, first_draft', () => {
    const coreSteps: OnboardingStepId[] = ['business_profile', 'first_scan', 'first_draft'];
    for (const plan of ['trial', 'starter', 'growth', 'agency'] as const) {
      const ids = getVisibleSteps(plan).map((s) => s.id);
      for (const stepId of coreSteps) {
        expect(ids).toContain(stepId);
      }
    }
  });

  it('agency plan includes invite_teammate and connect_domain', () => {
    const ids = getVisibleSteps('agency').map((s) => s.id);
    expect(ids).toContain('invite_teammate');
    expect(ids).toContain('connect_domain');
  });
});

describe('ONBOARDING_STEPS — plan gating metadata', () => {
  it('invite_teammate requires agency plan', () => {
    const step = ONBOARDING_STEPS.find((s) => s.id === 'invite_teammate');
    expect(step?.requiredPlan).toBe('agency');
  });

  it('connect_domain requires agency plan', () => {
    const step = ONBOARDING_STEPS.find((s) => s.id === 'connect_domain');
    expect(step?.requiredPlan).toBe('agency');
  });

  it('core steps have no requiredPlan', () => {
    const coreSteps = ONBOARDING_STEPS.filter((s) =>
      ['business_profile', 'first_scan', 'first_draft'].includes(s.id),
    );
    for (const step of coreSteps) {
      expect(step.requiredPlan).toBeUndefined();
    }
  });

  it('business_profile action_url points to /dashboard/settings/business-info (P0-FIX-02)', () => {
    const step = ONBOARDING_STEPS.find((s) => s.id === 'business_profile');
    expect(step?.action_url).toBe('/dashboard/settings/business-info');
  });
});
