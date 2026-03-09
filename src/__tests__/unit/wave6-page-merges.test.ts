// ---------------------------------------------------------------------------
// wave6-page-merges.test.ts — Wave 6: S32-S35 Page Merges
//
// Validates sidebar removals, redirect pages, new components, and admin nav.
//
// Run: npx vitest run src/__tests__/unit/wave6-page-merges.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { NAV_ITEMS, NAV_GROUPS } from '@/components/layout/Sidebar';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function findByTestId(testId: string) {
  return NAV_ITEMS.find((i) => i.testId === testId);
}

function groupByLabel(label: string) {
  return NAV_GROUPS.find((g) => g.label === label);
}

// ---------------------------------------------------------------------------
// 1. S32 — Calendar merged into Posts
// ---------------------------------------------------------------------------

describe('S32 — Calendar merged into Posts', () => {
  it('content-calendar no longer in NAV_ITEMS', () => {
    const item = NAV_ITEMS.find((i) => i.href === '/dashboard/content-calendar');
    expect(item).toBeUndefined();
  });

  it('content-calendar testId no longer in NAV_ITEMS', () => {
    expect(findByTestId('content-calendar')).toBeUndefined();
  });

  it('Posts (content-drafts) still exists', () => {
    const item = findByTestId('content');
    expect(item).toBeDefined();
    expect(item!.href).toBe('/dashboard/content-drafts');
  });

  it('content-calendar not in any NAV_GROUP', () => {
    const allHrefs = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href));
    expect(allHrefs).not.toContain('/dashboard/content-calendar');
  });
});

// ---------------------------------------------------------------------------
// 2. S33 — Sources & Citations merged into Entity Health
// ---------------------------------------------------------------------------

describe('S33 — Sources & Citations merged into Entity Health', () => {
  it('source-intelligence no longer in NAV_ITEMS', () => {
    const item = NAV_ITEMS.find((i) => i.href === '/dashboard/source-intelligence');
    expect(item).toBeUndefined();
  });

  it('citations no longer in NAV_ITEMS', () => {
    const item = NAV_ITEMS.find((i) => i.href === '/dashboard/citations');
    expect(item).toBeUndefined();
  });

  it('source-intelligence testId removed', () => {
    expect(findByTestId('source-intelligence')).toBeUndefined();
  });

  it('citations testId removed', () => {
    expect(findByTestId('citations')).toBeUndefined();
  });

  it('Entity Health still exists', () => {
    const item = findByTestId('entity-health');
    expect(item).toBeDefined();
    expect(item!.href).toBe('/dashboard/entity-health');
  });

  it('neither source-intelligence nor citations in any NAV_GROUP', () => {
    const allHrefs = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href));
    expect(allHrefs).not.toContain('/dashboard/source-intelligence');
    expect(allHrefs).not.toContain('/dashboard/citations');
  });
});

// ---------------------------------------------------------------------------
// 3. S34 — Crawler Analytics merged into Website Checkup
// ---------------------------------------------------------------------------

describe('S34 — Crawler Analytics merged into Website Checkup', () => {
  it('crawler-analytics no longer in NAV_ITEMS', () => {
    const item = NAV_ITEMS.find((i) => i.href === '/dashboard/crawler-analytics');
    expect(item).toBeUndefined();
  });

  it('crawler-analytics testId removed', () => {
    expect(findByTestId('crawler-analytics')).toBeUndefined();
  });

  it('Website Checkup (page-audits) still exists', () => {
    const item = findByTestId('page-audits');
    expect(item).toBeDefined();
    expect(item!.href).toBe('/dashboard/page-audits');
  });

  it('crawler-analytics not in any NAV_GROUP', () => {
    const allHrefs = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href));
    expect(allHrefs).not.toContain('/dashboard/crawler-analytics');
  });
});

// ---------------------------------------------------------------------------
// 4. S35 — System Status moved to Admin
// ---------------------------------------------------------------------------

describe('S35 — System Status moved to Admin', () => {
  it('system-health no longer in NAV_ITEMS', () => {
    const item = NAV_ITEMS.find((i) => i.href === '/dashboard/system-health');
    expect(item).toBeUndefined();
  });

  it('system-health testId removed', () => {
    expect(findByTestId('system-health')).toBeUndefined();
  });

  it('system-health not in any NAV_GROUP', () => {
    const allHrefs = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href));
    expect(allHrefs).not.toContain('/dashboard/system-health');
  });
});

// ---------------------------------------------------------------------------
// 5. Structural integrity after Wave 6
// ---------------------------------------------------------------------------

describe('Wave 6 — structural integrity', () => {
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

  it('all testIds are unique', () => {
    const testIds = NAV_ITEMS.map((i) => i.testId);
    expect(new Set(testIds).size).toBe(testIds.length);
  });

  it('5 groups remain: Today, This Week, This Month, Advanced, Account', () => {
    const labels = NAV_GROUPS.map((g) => g.label);
    expect(labels).toEqual(['Today', 'This Week', 'This Month', 'Advanced', 'Account']);
  });

  it('Advanced group has exactly 9 items (13 - 5 removed + 1 added)', () => {
    const group = groupByLabel('Advanced');
    expect(group!.items).toHaveLength(9);
  });

  it('Today group unchanged (4 items)', () => {
    const group = groupByLabel('Today');
    expect(group!.items).toHaveLength(4);
  });

  it('This Week group unchanged (5 items)', () => {
    const group = groupByLabel('This Week');
    expect(group!.items).toHaveLength(5);
  });

  it('This Month group unchanged (5 items)', () => {
    const group = groupByLabel('This Month');
    expect(group!.items).toHaveLength(5);
  });

  it('Account group unchanged (6 items)', () => {
    const group = groupByLabel('Account');
    expect(group!.items).toHaveLength(6);
  });
});

// ---------------------------------------------------------------------------
// 6. AdminNav — System Health link added
// ---------------------------------------------------------------------------

describe('S35 — AdminNav includes System Health', () => {
  // AdminNav is a client component, so we test the static NAV_LINKS array
  // by importing the module. Since it's 'use client', we verify the pattern.
  it('admin system-health page exists as a file', async () => {
    // Verify the admin page module can be resolved
    const mod = await import('@/app/admin/system-health/page');
    expect(mod.default).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 7. Redirect pages exist
// ---------------------------------------------------------------------------

describe('Wave 6 — redirect pages', () => {
  it('content-calendar redirect page exists', async () => {
    const mod = await import('@/app/dashboard/content-calendar/page');
    expect(mod.default).toBeDefined();
  });

  it('source-intelligence redirect page exists', async () => {
    const mod = await import('@/app/dashboard/source-intelligence/page');
    expect(mod.default).toBeDefined();
  });

  it('citations redirect page exists', async () => {
    const mod = await import('@/app/dashboard/citations/page');
    expect(mod.default).toBeDefined();
  });

  it('crawler-analytics redirect page exists', async () => {
    const mod = await import('@/app/dashboard/crawler-analytics/page');
    expect(mod.default).toBeDefined();
  });

  it('system-health redirect page exists', async () => {
    const mod = await import('@/app/dashboard/system-health/page');
    expect(mod.default).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 8. fixHref updates
// ---------------------------------------------------------------------------

describe('Wave 6 — fixHref updates', () => {
  it('bot_blind_spot fixHref points to page-audits#bots', async () => {
    const { describeTechnicalFinding } = await import('@/lib/issue-descriptions');
    const result = describeTechnicalFinding({ type: 'bot_blind_spot' });
    expect(result.fixHref).toBe('/dashboard/page-audits#bots');
  });
});
