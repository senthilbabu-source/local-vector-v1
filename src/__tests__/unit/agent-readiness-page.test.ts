// ---------------------------------------------------------------------------
// agent-readiness-page.test.ts — Dashboard page + sidebar tests
//
// Sprint 84: 7 tests — page rendering, sidebar nav item.
//
// Run:
//   npx vitest run src/__tests__/unit/agent-readiness-page.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { NAV_ITEMS } from '@/components/layout/Sidebar';
import {
  computeAgentReadiness,
  type AgentReadinessInput,
} from '@/lib/services/agent-readiness.service';
import { MOCK_AGENT_READINESS_INPUT } from '@/src/__fixtures__/golden-tenant';

// ---------------------------------------------------------------------------
// Page rendering tests — test the pure analysis output that feeds the page
// ---------------------------------------------------------------------------

function buildMockResult() {
  return computeAgentReadiness(MOCK_AGENT_READINESS_INPUT);
}

describe('Agent Readiness page', () => {
  it('1. renders score ring with readiness level', () => {
    const result = buildMockResult();
    expect(result.score).toBe(40);
    expect(result.level).toBe('partially_ready');
    expect(result.levelLabel).toBe('Partially Ready');
  });

  it('2. renders top priority card', () => {
    const result = buildMockResult();
    expect(result.topPriority).not.toBeNull();
    expect(result.topPriority!.name).toBe('ReserveAction Schema');
    expect(result.topPriority!.maxPoints).toBe(25);
  });

  it('3. renders 6 capability items', () => {
    const result = buildMockResult();
    expect(result.capabilities).toHaveLength(6);
  });

  it('4. renders status icons correctly (active, partial, missing)', () => {
    const result = buildMockResult();
    const statuses = result.capabilities.map((c) => c.status);
    // hours=active, menu=active, reserve=missing, order=missing, CTAs=partial, captcha=partial
    expect(statuses.filter((s) => s === 'active')).toHaveLength(2);
    expect(statuses.filter((s) => s === 'missing')).toHaveLength(2);
    expect(statuses.filter((s) => s === 'partial')).toHaveLength(2);
  });

  it('5. renders fix guide for non-active capabilities', () => {
    const result = buildMockResult();
    const nonActive = result.capabilities.filter((c) => c.status !== 'active');
    for (const cap of nonActive) {
      expect(cap.fixGuide).toBeTruthy();
    }
  });

  it('6. renders Generate Schema button when schemaAction present', () => {
    const result = buildMockResult();
    const withAction = result.capabilities.filter((c) => c.schemaAction);
    // reserve_action and order_action should have schemaAction
    expect(withAction.length).toBeGreaterThanOrEqual(2);
    expect(withAction.map((c) => c.schemaAction)).toContain('reserve_action');
    expect(withAction.map((c) => c.schemaAction)).toContain('order_action');
  });
});

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

describe('Sidebar', () => {
  it('7. shows Agent Readiness link with test-id nav-agent-readiness', () => {
    const navItem = NAV_ITEMS.find(
      (item) => item.href === '/dashboard/agent-readiness',
    );
    expect(navItem).toBeDefined();
    expect(navItem!.label).toBe('Agent Readiness');
    expect(navItem!.active).toBe(true);
    // data-testid is generated from label: nav-agent-readiness
    const expectedTestId = `nav-${navItem!.label.toLowerCase().replace(/\s+/g, '-')}`;
    expect(expectedTestId).toBe('nav-agent-readiness');
  });
});
