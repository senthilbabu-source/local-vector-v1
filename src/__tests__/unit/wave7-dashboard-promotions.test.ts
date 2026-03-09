// ---------------------------------------------------------------------------
// wave7-dashboard-promotions.test.ts — Wave 7: S36-S40
//
// Validates demand summary, competitor teaser, agent readiness summary,
// quick win logic, and sidebar structural integrity.
//
// Run: npx vitest run src/__tests__/unit/wave7-dashboard-promotions.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { NAV_ITEMS, NAV_GROUPS } from '@/components/layout/Sidebar';
import {
  filterTopDemandItems,
  formatDemandInsight,
} from '@/lib/menu-intelligence/demand-summary';
import {
  formatCompetitorInsight,
  isCompetitorDataAvailable,
  type CompetitorMentionData,
} from '@/lib/services/competitor-teaser';
import {
  countReadyCapabilities,
  EMPTY_SUMMARY,
  type AgentReadinessSummary,
} from '@/lib/services/agent-readiness-summary';
import {
  pickQuickWin,
  type QuickWinAlert,
  type QuickWinConfig,
} from '@/lib/services/quick-win';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function groupByLabel(label: string) {
  return NAV_GROUPS.find((g) => g.label === label);
}

// ---------------------------------------------------------------------------
// 1. S36 — Demand Summary pure functions
// ---------------------------------------------------------------------------

describe('S36 — filterTopDemandItems', () => {
  const items = [
    { item_id: '1', item_name: 'Brisket', mention_count: 47 },
    { item_id: '2', item_name: 'Pulled Pork', mention_count: 23 },
    { item_id: '3', item_name: 'Mac & Cheese', mention_count: 12 },
    { item_id: '4', item_name: 'Coleslaw', mention_count: 5 },
    { item_id: '5', item_name: 'Ribs', mention_count: 0 },
  ];

  it('returns top 3 items sorted by mention count', () => {
    const result = filterTopDemandItems(items, 3);
    expect(result).toHaveLength(3);
    expect(result[0].item_name).toBe('Brisket');
    expect(result[1].item_name).toBe('Pulled Pork');
    expect(result[2].item_name).toBe('Mac & Cheese');
  });

  it('returns empty array when no data', () => {
    expect(filterTopDemandItems([], 3)).toEqual([]);
  });

  it('skips items with 0 mentions', () => {
    const result = filterTopDemandItems(items, 10);
    expect(result).toHaveLength(4);
    expect(result.every((i) => i.mention_count > 0)).toBe(true);
  });

  it('respects custom limit', () => {
    const result = filterTopDemandItems(items, 2);
    expect(result).toHaveLength(2);
  });
});

describe('S36 — formatDemandInsight', () => {
  it('formats single item', () => {
    const result = formatDemandInsight([
      { item_id: '1', item_name: 'Brisket', mention_count: 47 },
    ]);
    expect(result).toBe('Your Brisket was mentioned 47 times by AI this month');
  });

  it('formats single item with count 1', () => {
    const result = formatDemandInsight([
      { item_id: '1', item_name: 'Brisket', mention_count: 1 },
    ]);
    expect(result).toBe('Your Brisket was mentioned 1 time by AI this month');
  });

  it('formats two items', () => {
    const result = formatDemandInsight([
      { item_id: '1', item_name: 'Brisket', mention_count: 47 },
      { item_id: '2', item_name: 'Pulled Pork', mention_count: 23 },
    ]);
    expect(result).toBe('Your Brisket (47x) and Pulled Pork (23x) are trending in AI');
  });

  it('formats multiple items with Oxford comma', () => {
    const result = formatDemandInsight([
      { item_id: '1', item_name: 'Brisket', mention_count: 47 },
      { item_id: '2', item_name: 'Pulled Pork', mention_count: 23 },
      { item_id: '3', item_name: 'Mac & Cheese', mention_count: 12 },
    ]);
    expect(result).toBe(
      'Your Brisket (47x), Pulled Pork (23x), and Mac & Cheese (12x) are trending in AI',
    );
  });

  it('returns empty string for empty array', () => {
    expect(formatDemandInsight([])).toBe('');
  });

  it('returns empty string when all items have 0 mentions', () => {
    expect(
      formatDemandInsight([
        { item_id: '1', item_name: 'Brisket', mention_count: 0 },
      ]),
    ).toBe('');
  });
});

// ---------------------------------------------------------------------------
// 2. S37 — Competitor Teaser pure functions
// ---------------------------------------------------------------------------

describe('S37 — formatCompetitorInsight', () => {
  it('formats competitor mentioned more', () => {
    const data: CompetitorMentionData = {
      competitorName: "Joe's BBQ",
      theirMentions: 15,
      yourMentions: 5,
      ratio: 3,
    };
    expect(formatCompetitorInsight(data)).toBe(
      "Joe's BBQ was mentioned 3x more than you this week",
    );
  });

  it('formats equal mentions', () => {
    const data: CompetitorMentionData = {
      competitorName: "Joe's BBQ",
      theirMentions: 5,
      yourMentions: 5,
      ratio: 1,
    };
    expect(formatCompetitorInsight(data)).toBe(
      "Joe's BBQ was mentioned as often as you this week",
    );
  });

  it('formats when no own mentions (ratio null)', () => {
    const data: CompetitorMentionData = {
      competitorName: "Joe's BBQ",
      theirMentions: 10,
      yourMentions: 0,
      ratio: null,
    };
    expect(formatCompetitorInsight(data)).toBe(
      "Joe's BBQ was mentioned 10 times by AI this week",
    );
  });

  it('formats singular mention', () => {
    const data: CompetitorMentionData = {
      competitorName: "Joe's BBQ",
      theirMentions: 1,
      yourMentions: 0,
      ratio: null,
    };
    expect(formatCompetitorInsight(data)).toBe(
      "Joe's BBQ was mentioned 1 time by AI this week",
    );
  });
});

describe('S37 — isCompetitorDataAvailable', () => {
  it('returns true when data has mentions', () => {
    expect(
      isCompetitorDataAvailable({
        competitorName: 'X',
        theirMentions: 5,
        yourMentions: 3,
        ratio: 1.67,
      }),
    ).toBe(true);
  });

  it('returns false when null', () => {
    expect(isCompetitorDataAvailable(null)).toBe(false);
  });

  it('returns false when zero mentions', () => {
    expect(
      isCompetitorDataAvailable({
        competitorName: 'X',
        theirMentions: 0,
        yourMentions: 0,
        ratio: null,
      }),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. S38 — Agent Readiness Summary pure functions
// ---------------------------------------------------------------------------

describe('S38 — countReadyCapabilities', () => {
  it('returns 0 for empty summary', () => {
    expect(countReadyCapabilities(EMPTY_SUMMARY)).toBe(0);
  });

  it('returns 4 when all true', () => {
    const summary: AgentReadinessSummary = {
      canBook: true,
      canOrder: true,
      canFindHours: true,
      canSeeMenu: true,
    };
    expect(countReadyCapabilities(summary)).toBe(4);
  });

  it('returns 2 when two true', () => {
    const summary: AgentReadinessSummary = {
      canBook: false,
      canOrder: false,
      canFindHours: true,
      canSeeMenu: true,
    };
    expect(countReadyCapabilities(summary)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 4. S39 — Quick Win pure functions
// ---------------------------------------------------------------------------

describe('S39 — pickQuickWin', () => {
  const baseConfig: QuickWinConfig = {
    menuPublished: true,
    napScore: 90,
    sovPercent: 50,
  };

  it('picks critical hallucination over medium', () => {
    const alerts: QuickWinAlert[] = [
      { severity: 'medium', category: 'menu', model_provider: 'openai-gpt4o', claim_text: 'x', revenue_recovered_monthly: 50 },
      { severity: 'critical', category: 'hours', model_provider: 'perplexity-sonar', claim_text: 'y', revenue_recovered_monthly: 200 },
    ];
    const result = pickQuickWin(alerts, baseConfig);
    expect(result).not.toBeNull();
    expect(result!.action).toContain('hours');
    expect(result!.action).toContain('Perplexity');
    expect(result!.severity).toBe('critical');
  });

  it('picks highest revenue among critical/high alerts', () => {
    const alerts: QuickWinAlert[] = [
      { severity: 'critical', category: 'hours', model_provider: 'openai-gpt4o', claim_text: 'x', revenue_recovered_monthly: 100 },
      { severity: 'high', category: 'address', model_provider: 'google-gemini', claim_text: 'y', revenue_recovered_monthly: 500 },
    ];
    const result = pickQuickWin(alerts, baseConfig);
    expect(result).not.toBeNull();
    expect(result!.estimatedRecovery).toBe(500);
  });

  it('falls back to hours mismatch when no critical/high alerts', () => {
    const alerts: QuickWinAlert[] = [
      { severity: 'medium', category: 'menu', model_provider: 'openai-gpt4o', claim_text: 'x', revenue_recovered_monthly: 50 },
    ];
    const config: QuickWinConfig = { ...baseConfig, napScore: 60 };
    const result = pickQuickWin(alerts, config);
    expect(result).not.toBeNull();
    expect(result!.action).toContain('hours');
    expect(result!.href).toBe('/dashboard/entity-health');
  });

  it('falls back to missing menu when no NAP issues', () => {
    const config: QuickWinConfig = { ...baseConfig, menuPublished: false };
    const result = pickQuickWin([], config);
    expect(result).not.toBeNull();
    expect(result!.action).toContain('menu');
    expect(result!.href).toBe('/dashboard/magic-menus');
    expect(result!.severity).toBe('medium');
  });

  it('falls back to low SOV when nothing else', () => {
    const config: QuickWinConfig = { ...baseConfig, sovPercent: 10 };
    const result = pickQuickWin([], config);
    expect(result).not.toBeNull();
    expect(result!.action).toContain('visibility');
    expect(result!.href).toBe('/dashboard/share-of-voice');
    expect(result!.severity).toBe('low');
  });

  it('returns null when no actionable items', () => {
    const result = pickQuickWin([], baseConfig);
    expect(result).toBeNull();
  });

  it('returns null when all inputs are null/empty', () => {
    const config: QuickWinConfig = { menuPublished: true, napScore: null, sovPercent: null };
    const result = pickQuickWin([], config);
    expect(result).toBeNull();
  });

  it('correct timeEstimate per action type', () => {
    // Hallucination
    const alerts: QuickWinAlert[] = [
      { severity: 'critical', category: 'hours', model_provider: 'openai-gpt4o', claim_text: 'x', revenue_recovered_monthly: 100 },
    ];
    expect(pickQuickWin(alerts, baseConfig)!.timeEstimate).toBe('~2 min');

    // NAP
    expect(pickQuickWin([], { ...baseConfig, napScore: 50 })!.timeEstimate).toBe('~5 min');

    // Menu
    expect(pickQuickWin([], { ...baseConfig, menuPublished: false })!.timeEstimate).toBe('~10 min');

    // SOV
    expect(pickQuickWin([], { ...baseConfig, sovPercent: 10 })!.timeEstimate).toBe('~1 min');
  });

  it('correct ctaText per action type', () => {
    const alerts: QuickWinAlert[] = [
      { severity: 'critical', category: 'hours', model_provider: 'openai-gpt4o', claim_text: 'x', revenue_recovered_monthly: 100 },
    ];
    expect(pickQuickWin(alerts, baseConfig)!.ctaText).toBe('Fix now');
    expect(pickQuickWin([], { ...baseConfig, napScore: 50 })!.ctaText).toBe('Fix hours');
    expect(pickQuickWin([], { ...baseConfig, menuPublished: false })!.ctaText).toBe('Upload menu');
    expect(pickQuickWin([], { ...baseConfig, sovPercent: 10 })!.ctaText).toBe('Run scan');
  });
});

// ---------------------------------------------------------------------------
// 5. S40 — Sidebar structural integrity (unchanged from Wave 6)
// ---------------------------------------------------------------------------

describe('S40 — sidebar structural integrity', () => {
  it('total NAV_ITEMS count is 29', () => {
    expect(NAV_ITEMS).toHaveLength(29);
  });

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

  it('5 groups: Today, This Week, This Month, Advanced, Account', () => {
    const labels = NAV_GROUPS.map((g) => g.label);
    expect(labels).toEqual(['Today', 'This Week', 'This Month', 'Advanced', 'Account']);
  });

  it('Today group has 4 items', () => {
    expect(groupByLabel('Today')!.items).toHaveLength(4);
  });

  it('This Week group has 5 items', () => {
    expect(groupByLabel('This Week')!.items).toHaveLength(5);
  });

  it('This Month group has 5 items', () => {
    expect(groupByLabel('This Month')!.items).toHaveLength(5);
  });

  it('Advanced group has 9 items', () => {
    expect(groupByLabel('Advanced')!.items).toHaveLength(9);
  });

  it('Account group has 6 items', () => {
    expect(groupByLabel('Account')!.items).toHaveLength(6);
  });

  it('removed pages not in NAV_ITEMS', () => {
    const removedHrefs = [
      '/dashboard/content-calendar',
      '/dashboard/source-intelligence',
      '/dashboard/citations',
      '/dashboard/crawler-analytics',
      '/dashboard/system-health',
    ];
    const allHrefs = NAV_ITEMS.map((i) => i.href);
    for (const href of removedHrefs) {
      expect(allHrefs).not.toContain(href);
    }
  });

  it('removed pages not in any NAV_GROUP', () => {
    const removedHrefs = [
      '/dashboard/content-calendar',
      '/dashboard/source-intelligence',
      '/dashboard/citations',
      '/dashboard/crawler-analytics',
      '/dashboard/system-health',
    ];
    const allGroupHrefs = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href));
    for (const href of removedHrefs) {
      expect(allGroupHrefs).not.toContain(href);
    }
  });

  it('key pages still present', () => {
    const requiredHrefs = [
      '/dashboard',
      '/dashboard/hallucinations',
      '/dashboard/share-of-voice',
      '/dashboard/entity-health',
      '/dashboard/page-audits',
      '/dashboard/content-drafts',
      '/dashboard/agent-readiness',
      '/dashboard/revenue-impact',
      '/dashboard/compete',
      '/dashboard/magic-menus',
      '/dashboard/sentiment',
    ];
    const allHrefs = NAV_ITEMS.map((i) => i.href);
    for (const href of requiredHrefs) {
      expect(allHrefs).toContain(href);
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Redirect pages still exist
// ---------------------------------------------------------------------------

describe('S40 — redirect pages exist', () => {
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
