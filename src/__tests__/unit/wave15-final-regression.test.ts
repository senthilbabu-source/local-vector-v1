/**
 * Wave 15 — Final Regression Suite (§282–§284)
 *
 * Validates the entire dashboard restructure is complete and stable:
 * - Build passes (TypeScript fixes verified)
 * - Sidebar structure matches plan (28 items, 5 groups)
 * - All page merges have proper redirects
 * - All services from Waves 5–14 are importable
 * - No orphaned features
 */

import { describe, it, expect } from 'vitest';
import { NAV_ITEMS, NAV_GROUPS } from '@/components/layout/Sidebar';
import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// S78: Build Verification (TypeScript fixes)
// ---------------------------------------------------------------------------

describe('S78: Build TypeScript Fixes', () => {
  it('competitor-vulnerability cron uses `as never` cast for untyped table', () => {
    const content = fs.readFileSync(
      path.join(process.cwd(), 'app/api/cron/competitor-vulnerability/route.ts'),
      'utf-8',
    );
    expect(content).toContain('as never)');
    expect(content).not.toContain('as unknown as Record<string, unknown>)');
  });

  it('degradation-check cron uses `as never` cast for untyped table', () => {
    const content = fs.readFileSync(
      path.join(process.cwd(), 'app/api/cron/degradation-check/route.ts'),
      'utf-8',
    );
    expect(content).toContain('as never)');
  });

  it('compete page uses `as unknown as InterceptRow[]` for pre_action_gap column', () => {
    const content = fs.readFileSync(
      path.join(process.cwd(), 'app/dashboard/compete/page.tsx'),
      'utf-8',
    );
    expect(content).toContain('as unknown as InterceptRow[]');
  });

  it('content-drafts detail page uses `as unknown as DraftDetail` for rank columns', () => {
    const content = fs.readFileSync(
      path.join(process.cwd(), 'app/dashboard/content-drafts/[id]/page.tsx'),
      'utf-8',
    );
    expect(content).toContain('as unknown as DraftDetail');
  });

  it('magic-menus page return type includes menuSuggestions and menuContext', () => {
    const content = fs.readFileSync(
      path.join(process.cwd(), 'app/dashboard/magic-menus/page.tsx'),
      'utf-8',
    );
    expect(content).toContain('menuSuggestions: MenuSuggestion[]');
    expect(content).toContain('menuContext: MenuContext | null');
  });

  it('shopper-runner uses "complete" status (not "success")', () => {
    const content = fs.readFileSync(
      path.join(process.cwd(), 'lib/ai-shopper/shopper-runner.ts'),
      'utf-8',
    );
    expect(content).toContain("=== 'complete'");
    expect(content).not.toContain("=== 'success'");
  });
});

// ---------------------------------------------------------------------------
// S79: Sidebar Structure Verification
// ---------------------------------------------------------------------------

describe('S79: Sidebar Final Structure', () => {
  it('total NAV_ITEMS count is 29', () => {
    expect(NAV_ITEMS.length).toBe(29);
  });

  it('total NAV_GROUPS count is 5', () => {
    expect(NAV_GROUPS.length).toBe(5);
  });

  it('Today group has exactly 4 items', () => {
    const today = NAV_GROUPS.find((g) => g.label === 'Today');
    expect(today).toBeDefined();
    expect(today!.items.length).toBe(4);
  });

  it('This Week group has exactly 5 items', () => {
    const week = NAV_GROUPS.find((g) => g.label === 'This Week');
    expect(week).toBeDefined();
    expect(week!.items.length).toBe(5);
  });

  it('This Month group has exactly 5 items', () => {
    const month = NAV_GROUPS.find((g) => g.label === 'This Month');
    expect(month).toBeDefined();
    expect(month!.items.length).toBe(5);
  });

  it('Advanced group has exactly 9 items', () => {
    const advanced = NAV_GROUPS.find((g) => g.label === 'Advanced');
    expect(advanced).toBeDefined();
    expect(advanced!.items.length).toBe(9);
  });

  it('Account group has exactly 6 items', () => {
    const account = NAV_GROUPS.find((g) => g.label === 'Account');
    expect(account).toBeDefined();
    expect(account!.items.length).toBe(6);
  });

  it('sum of all group items equals NAV_ITEMS count', () => {
    const sum = NAV_GROUPS.reduce((acc, g) => acc + g.items.length, 0);
    expect(sum).toBe(NAV_ITEMS.length);
  });

  it('no item appears in multiple groups', () => {
    const seen = new Set<string>();
    for (const group of NAV_GROUPS) {
      for (const item of group.items) {
        expect(seen.has(item.href)).toBe(false);
        seen.add(item.href);
      }
    }
  });

  it('every NAV_ITEMS entry appears in exactly one NAV_GROUP', () => {
    const groupedHrefs = new Set(
      NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href)),
    );
    for (const item of NAV_ITEMS) {
      expect(groupedHrefs.has(item.href)).toBe(true);
    }
  });

  it('group labels are correct', () => {
    const labels = NAV_GROUPS.map((g) => g.label);
    expect(labels).toEqual(['Today', 'This Week', 'This Month', 'Advanced', 'Account']);
  });

  it('merged pages are NOT in NAV_ITEMS', () => {
    const hrefs = NAV_ITEMS.map((i) => i.href);
    expect(hrefs).not.toContain('/dashboard/content-calendar');
    expect(hrefs).not.toContain('/dashboard/source-intelligence');
    expect(hrefs).not.toContain('/dashboard/citations');
    expect(hrefs).not.toContain('/dashboard/crawler-analytics');
    expect(hrefs).not.toContain('/dashboard/system-health');
  });

  it('all testId values are unique', () => {
    const testIds = NAV_ITEMS.map((i) => i.testId);
    expect(new Set(testIds).size).toBe(testIds.length);
  });

  it('all href values are unique', () => {
    const hrefs = NAV_ITEMS.map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});

// ---------------------------------------------------------------------------
// S79: Page Merge Redirects
// ---------------------------------------------------------------------------

describe('S79: Page Merge Redirects', () => {
  const redirectPages = [
    { path: 'app/dashboard/content-calendar/page.tsx', target: '/dashboard/content-drafts' },
    { path: 'app/dashboard/source-intelligence/page.tsx', target: '/dashboard/entity-health' },
    { path: 'app/dashboard/citations/page.tsx', target: '/dashboard/entity-health' },
    { path: 'app/dashboard/crawler-analytics/page.tsx', target: '/dashboard/page-audits' },
    { path: 'app/dashboard/system-health/page.tsx', target: '/dashboard' },
  ];

  for (const { path: filePath, target } of redirectPages) {
    it(`${filePath} redirects to ${target}`, () => {
      const content = fs.readFileSync(
        path.join(process.cwd(), filePath),
        'utf-8',
      );
      expect(content).toContain('redirect(');
      expect(content).toContain(target);
    });
  }
});

// ---------------------------------------------------------------------------
// S79: Wave 7–14 Service Importability
// ---------------------------------------------------------------------------

describe('S79: Wave 7-14 Services Importable', () => {
  it('demand-summary service exists', async () => {
    const mod = await import('@/lib/menu-intelligence/demand-summary');
    expect(mod.getTopDemandItems).toBeDefined();
  });

  it('competitor-teaser service exists', async () => {
    const mod = await import('@/lib/services/competitor-teaser');
    expect(mod.getTopCompetitorMentions).toBeDefined();
  });

  it('agent-readiness-summary service exists', async () => {
    const mod = await import('@/lib/services/agent-readiness-summary');
    expect(mod.getAgentReadinessSummary).toBeDefined();
  });

  it('quick-win service exists', async () => {
    const mod = await import('@/lib/services/quick-win');
    expect(mod.pickQuickWin).toBeDefined();
  });

  it('weekly-report-card service exists', async () => {
    const mod = await import('@/lib/services/weekly-report-card');
    expect(mod.generateWeeklyReportCard).toBeDefined();
  });

  it('before-after service exists', async () => {
    const mod = await import('@/lib/services/before-after');
    expect(mod.buildBeforeAfterStory).toBeDefined();
  });

  it('menu-optimizer service exists', async () => {
    const mod = await import('@/lib/menu-intelligence/menu-optimizer');
    expect(mod.analyzeMenuCompleteness).toBeDefined();
    expect(mod.generateMenuSuggestions).toBeDefined();
  });

  it('snapshot-builder service exists', async () => {
    const mod = await import('@/lib/services/snapshot-builder');
    expect(mod.buildSnapshotText).toBeDefined();
  });

  it('competitor-watch service exists', async () => {
    const mod = await import('@/lib/services/competitor-watch');
    expect(mod.detectCompetitorChanges).toBeDefined();
  });

  it('notification-feed service exists', async () => {
    const mod = await import('@/lib/services/notification-feed');
    expect(mod).toBeDefined();
  });

  it('report-exporter service exists', async () => {
    const mod = await import('@/lib/services/report-exporter');
    expect(mod.buildExportableReport).toBeDefined();
  });

  it('digest-preferences service exists', async () => {
    const mod = await import('@/lib/services/digest-preferences');
    expect(mod.validateFrequency).toBeDefined();
    expect(mod.shouldSendDigest).toBeDefined();
  });
});
