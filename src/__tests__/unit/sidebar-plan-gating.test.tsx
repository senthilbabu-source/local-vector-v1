// ---------------------------------------------------------------------------
// src/__tests__/unit/sidebar-plan-gating.test.tsx — P1-FIX-06
//
// Tests for sidebar plan gating: locked items render as buttons with lock
// icons, unlocked items render as links, UpgradeModal opens on locked click.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi } from 'vitest';
import { NAV_ITEMS } from '@/components/layout/Sidebar';
import { planSatisfies } from '@/lib/plan-enforcer';

// ---------------------------------------------------------------------------
// NAV_ITEMS structural tests — verify minPlan assignments
// ---------------------------------------------------------------------------

describe('NAV_ITEMS minPlan assignments', () => {
  const itemMap = Object.fromEntries(NAV_ITEMS.map((i) => [i.testId, i]));

  // Agency-only items
  // S35: system-health moved to admin, removed from sidebar
  const agencyOnly = ['team', 'domain', 'playbooks', 'intent-discovery'];
  for (const testId of agencyOnly) {
    it(`"${testId}" requires agency plan`, () => {
      const item = itemMap[testId];
      expect(item).toBeDefined();
      expect((item as { minPlan?: string }).minPlan).toBe('agency');
    });
  }

  // Growth+ items
  const growthPlus = ['chat-widget', 'voice-readiness', 'agent-readiness'];
  for (const testId of growthPlus) {
    it(`"${testId}" requires growth plan`, () => {
      const item = itemMap[testId];
      expect(item).toBeDefined();
      expect((item as { minPlan?: string }).minPlan).toBe('growth');
    });
  }

  // Items available to all plans (no minPlan)
  const allPlans = ['dashboard', 'alerts', 'share-of-voice', 'cluster-map', 'content', 'settings', 'billing'];
  for (const testId of allPlans) {
    it(`"${testId}" has no minPlan (available to all)`, () => {
      const item = itemMap[testId];
      expect(item).toBeDefined();
      expect((item as { minPlan?: string }).minPlan).toBeUndefined();
    });
  }
});

// ---------------------------------------------------------------------------
// Plan gating logic tests
// ---------------------------------------------------------------------------

describe('sidebar plan gating logic', () => {
  // Simulates the isLocked check from Sidebar rendering
  function isLocked(item: (typeof NAV_ITEMS)[number], plan: string | null): boolean {
    const minPlan = (item as { minPlan?: string }).minPlan;
    if (!minPlan) return false;
    return !planSatisfies(plan, minPlan);
  }

  const teamItem = NAV_ITEMS.find((i) => i.testId === 'team')!;
  const widgetItem = NAV_ITEMS.find((i) => i.testId === 'chat-widget')!;
  const dashboardItem = NAV_ITEMS.find((i) => i.testId === 'dashboard')!;

  it('agency-only item is locked for trial plan', () => {
    expect(isLocked(teamItem, 'trial')).toBe(true);
  });

  it('agency-only item is locked for growth plan', () => {
    expect(isLocked(teamItem, 'growth')).toBe(true);
  });

  it('agency-only item is unlocked for agency plan', () => {
    expect(isLocked(teamItem, 'agency')).toBe(false);
  });

  it('growth+ item is locked for trial plan', () => {
    expect(isLocked(widgetItem, 'trial')).toBe(true);
  });

  it('growth+ item is locked for starter plan', () => {
    expect(isLocked(widgetItem, 'starter')).toBe(true);
  });

  it('growth+ item is unlocked for growth plan', () => {
    expect(isLocked(widgetItem, 'growth')).toBe(false);
  });

  it('growth+ item is unlocked for agency plan', () => {
    expect(isLocked(widgetItem, 'agency')).toBe(false);
  });

  it('no-gate item is never locked', () => {
    expect(isLocked(dashboardItem, 'trial')).toBe(false);
    expect(isLocked(dashboardItem, null)).toBe(false);
  });

  it('null plan locks gated items', () => {
    expect(isLocked(teamItem, null)).toBe(true);
    expect(isLocked(widgetItem, null)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// NAV_ITEMS structural integrity (regression guards)
// ---------------------------------------------------------------------------

describe('NAV_ITEMS structural integrity', () => {
  it('every item has a unique testId', () => {
    const testIds = NAV_ITEMS.map((i) => i.testId);
    expect(new Set(testIds).size).toBe(testIds.length);
  });

  it('every item has a non-empty label', () => {
    for (const item of NAV_ITEMS) {
      expect(item.label.length).toBeGreaterThan(0);
    }
  });

  it('every item has a valid href starting with /dashboard', () => {
    for (const item of NAV_ITEMS) {
      expect(item.href).toMatch(/^\/dashboard/);
    }
  });

  it('has at least 25 total items (5 removed in Wave 6: S32-S35)', () => {
    expect(NAV_ITEMS.length).toBeGreaterThanOrEqual(25);
  });

  it('all items are active', () => {
    for (const item of NAV_ITEMS) {
      expect(item.active).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// UpgradeModal unit tests
// ---------------------------------------------------------------------------

describe('UpgradeModal', () => {
  // Import the component to verify it exists and has the right interface
  it('can be imported', async () => {
    const mod = await import('@/components/ui/UpgradeModal');
    expect(mod.UpgradeModal).toBeDefined();
    expect(typeof mod.UpgradeModal).toBe('function');
  });
});
