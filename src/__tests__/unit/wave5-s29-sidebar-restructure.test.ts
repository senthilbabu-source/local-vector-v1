// ---------------------------------------------------------------------------
// wave5-s29-sidebar-restructure.test.ts — S29 (§232)
//
// Validates sidebar restructure: group composition, label renames,
// item ordering within groups, and metadata title alignment.
//
// Run: npx vitest run src/__tests__/unit/wave5-s29-sidebar-restructure.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { NAV_ITEMS, NAV_GROUPS } from '@/components/layout/Sidebar';

// ---------------------------------------------------------------------------
// Helper: lookup by testId (stable, never renamed)
// ---------------------------------------------------------------------------
function findByTestId(testId: string) {
  return NAV_ITEMS.find((i) => i.testId === testId);
}

function groupByLabel(label: string) {
  return NAV_GROUPS.find((g) => g.label === label);
}

// ---------------------------------------------------------------------------
// 1. Group structure — 5 groups in correct order
// ---------------------------------------------------------------------------

describe('S29 — NAV_GROUPS structure', () => {
  it('has exactly 5 groups', () => {
    expect(NAV_GROUPS).toHaveLength(5);
  });

  it('groups are ordered: Today, This Week, This Month, Advanced, Account', () => {
    const labels = NAV_GROUPS.map((g) => g.label);
    expect(labels).toEqual(['Today', 'This Week', 'This Month', 'Advanced', 'Account']);
  });
});

// ---------------------------------------------------------------------------
// 2. Today group — daily check items
// ---------------------------------------------------------------------------

describe('S29 — Today group', () => {
  const group = groupByLabel('Today');

  it('exists', () => {
    expect(group).toBeDefined();
  });

  it('contains exactly 4 items', () => {
    expect(group!.items).toHaveLength(4);
  });

  it('contains Dashboard, What AI Says About You, AI Mistakes, Lost Sales', () => {
    const testIds = group!.items.map((i) => i.testId);
    expect(testIds).toContain('dashboard');
    expect(testIds).toContain('ai-says');
    expect(testIds).toContain('alerts');
    expect(testIds).toContain('revenue-impact');
  });

  it('Dashboard is the first item', () => {
    expect(group!.items[0].testId).toBe('dashboard');
  });
});

// ---------------------------------------------------------------------------
// 3. This Week group — weekly cadence items
// ---------------------------------------------------------------------------

describe('S29 — This Week group', () => {
  const group = groupByLabel('This Week');

  it('exists', () => {
    expect(group).toBeDefined();
  });

  it('contains exactly 5 items', () => {
    expect(group!.items).toHaveLength(5);
  });

  it('contains AI Mentions, Menu, Competitors, How AI Feels About You, Can Customers Act?', () => {
    const testIds = group!.items.map((i) => i.testId);
    expect(testIds).toContain('share-of-voice');
    expect(testIds).toContain('menu');
    expect(testIds).toContain('compete');
    expect(testIds).toContain('ai-sentiment');
    expect(testIds).toContain('agent-readiness');
  });
});

// ---------------------------------------------------------------------------
// 4. This Month group — monthly cadence items
// ---------------------------------------------------------------------------

describe('S29 — This Month group', () => {
  const group = groupByLabel('This Month');

  it('exists', () => {
    expect(group).toBeDefined();
  });

  it('contains exactly 5 items', () => {
    expect(group!.items).toHaveLength(5);
  });

  it('contains AI-Ready Posts, Where AI Knows You, Listings, Local Comparison, Improvement Plans', () => {
    const testIds = group!.items.map((i) => i.testId);
    expect(testIds).toContain('content');
    expect(testIds).toContain('entity-health');
    expect(testIds).toContain('listings');
    expect(testIds).toContain('benchmarks');
    expect(testIds).toContain('playbooks');
  });
});

// ---------------------------------------------------------------------------
// 5. Advanced group — power-user pages
// ---------------------------------------------------------------------------

describe('S29 — Advanced group', () => {
  const group = groupByLabel('Advanced');

  it('exists', () => {
    expect(group).toBeDefined();
  });

  it('contains exactly 9 items (5 removed in Wave 6: S32-S35, 1 added: reviews)', () => {
    expect(group!.items).toHaveLength(9);
  });

  it('contains page-audits, ai-assistant, cluster-map, wins, voice-readiness', () => {
    const testIds = group!.items.map((i) => i.testId);
    expect(testIds).toContain('page-audits');
    expect(testIds).toContain('ai-assistant');
    expect(testIds).toContain('cluster-map');
    expect(testIds).toContain('wins');
    expect(testIds).toContain('voice-readiness');
  });
});

// ---------------------------------------------------------------------------
// 6. Account group
// ---------------------------------------------------------------------------

describe('S29 — Account group', () => {
  const group = groupByLabel('Account');

  it('exists', () => {
    expect(group).toBeDefined();
  });

  it('contains exactly 6 items', () => {
    expect(group!.items).toHaveLength(6);
  });

  it('contains Settings, Team, Domain, Billing, Locations, Website Chat', () => {
    const testIds = group!.items.map((i) => i.testId);
    expect(testIds).toContain('settings');
    expect(testIds).toContain('team');
    expect(testIds).toContain('domain');
    expect(testIds).toContain('billing');
    expect(testIds).toContain('locations');
    expect(testIds).toContain('chat-widget');
  });
});

// ---------------------------------------------------------------------------
// 7. Label renames — verify the 6 renamed sidebar labels
// ---------------------------------------------------------------------------

describe('S29 — label renames', () => {
  it('"ai-says" testId has label "What AI Says About You"', () => {
    expect(findByTestId('ai-says')?.label).toBe('What AI Says About You');
  });

  it('"entity-health" testId has label "Where AI Knows You"', () => {
    expect(findByTestId('entity-health')?.label).toBe('Where AI Knows You');
  });

  it('"agent-readiness" testId has label "Can Customers Act?"', () => {
    expect(findByTestId('agent-readiness')?.label).toBe('Can Customers Act?');
  });

  it('"ai-sentiment" testId has label "How AI Feels About You"', () => {
    expect(findByTestId('ai-sentiment')?.label).toBe('How AI Feels About You');
  });

  it('"content" testId has label "AI-Ready Posts"', () => {
    expect(findByTestId('content')?.label).toBe('AI-Ready Posts');
  });

  it('"voice-readiness" testId has label "How AI Answers"', () => {
    expect(findByTestId('voice-readiness')?.label).toBe('How AI Answers');
  });
});

// ---------------------------------------------------------------------------
// 8. Structural integrity — no items lost, no duplicates
// ---------------------------------------------------------------------------

describe('S29 — structural integrity', () => {
  it('total grouped items equals NAV_ITEMS count', () => {
    const totalGrouped = NAV_GROUPS.reduce((sum, g) => sum + g.items.length, 0);
    expect(totalGrouped).toBe(NAV_ITEMS.length);
  });

  it('no item appears in multiple groups', () => {
    const allHrefs = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href));
    const unique = new Set(allHrefs);
    expect(unique.size).toBe(allHrefs.length);
  });

  it('every NAV_ITEM is in exactly one group', () => {
    const groupedHrefs = new Set(NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href)));
    for (const item of NAV_ITEMS) {
      expect(groupedHrefs.has(item.href)).toBe(true);
    }
  });

  it('Reviews item exists with testId "reviews"', () => {
    const reviews = findByTestId('reviews');
    expect(reviews).toBeDefined();
    expect(reviews?.href).toBe('/dashboard/reviews');
  });

  it('all testIds are unique', () => {
    const testIds = NAV_ITEMS.map((i) => i.testId);
    expect(new Set(testIds).size).toBe(testIds.length);
  });
});
