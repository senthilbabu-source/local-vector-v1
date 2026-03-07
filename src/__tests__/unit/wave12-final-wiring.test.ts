// ---------------------------------------------------------------------------
// Wave 12: Final Wiring Tests (S65–S69)
//
// Tests cover:
//   S65: Digest preferences pure functions + settings wiring (6)
//   S66: AI menu suggestions pure functions + validation (6)
//   S67: KPI sparkline data building + normalization + trend (7)
//   S68: Integration verifications (3)
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';

// ── S65: Digest Preferences ───────────────────────────────────────────────

import {
  validateFrequency,
  validateSections,
  shouldSendDigest,
  getFrequencyLabel,
  getSectionLabel,
  DEFAULT_DIGEST_PREFERENCES,
  type DigestFrequency,
} from '@/lib/services/digest-preferences';

describe('S65: Digest Preferences Wiring', () => {
  it('validateFrequency returns valid frequency unchanged', () => {
    expect(validateFrequency('weekly')).toBe('weekly');
    expect(validateFrequency('biweekly')).toBe('biweekly');
    expect(validateFrequency('monthly')).toBe('monthly');
  });

  it('validateFrequency returns weekly for invalid input', () => {
    expect(validateFrequency('daily')).toBe('weekly');
    expect(validateFrequency(null)).toBe('weekly');
    expect(validateFrequency(42)).toBe('weekly');
  });

  it('validateSections filters out invalid sections', () => {
    const result = validateSections(['score', 'invalid', 'wins']);
    expect(result).toEqual(['score', 'wins']);
  });

  it('validateSections returns score-only for empty valid set', () => {
    expect(validateSections(['bogus'])).toEqual(['score']);
  });

  it('shouldSendDigest respects frequency intervals', () => {
    const now = new Date('2026-03-07T12:00:00Z');
    // Weekly: 8 days ago = should send
    expect(shouldSendDigest('weekly', '2026-02-27T12:00:00Z', now)).toBe(true);
    // Weekly: 3 days ago = should NOT send
    expect(shouldSendDigest('weekly', '2026-03-04T12:00:00Z', now)).toBe(false);
    // Null lastSent = always send
    expect(shouldSendDigest('monthly', null, now)).toBe(true);
  });

  it('getFrequencyLabel and getSectionLabel return human labels', () => {
    expect(getFrequencyLabel('biweekly')).toBe('Every 2 weeks');
    expect(getSectionLabel('errors')).toBe('AI Errors & Fixes');
    expect(getSectionLabel('competitors')).toBe('Competitor Activity');
  });
});

// ── S66: AI Menu Suggestions ──────────────────────────────────────────────

import {
  buildMenuSuggestionPrompt,
  validateSuggestions,
  type MenuContext,
} from '@/lib/menu-intelligence/ai-menu-suggestions';

describe('S66: AI Menu Suggestions Wiring', () => {
  const context: MenuContext = {
    businessName: 'Charcoal N Chill',
    industry: 'restaurant',
    itemCount: 20,
    itemsWithDescription: 10,
    itemsWithPrice: 15,
    itemsWithDietary: 3,
    topMentionedItems: ['Brisket', 'Mac & Cheese'],
  };

  it('buildMenuSuggestionPrompt includes business name and stats', () => {
    const prompt = buildMenuSuggestionPrompt(context);
    expect(prompt).toContain('Charcoal N Chill');
    expect(prompt).toContain('20 items');
    expect(prompt).toContain('50% complete'); // 10/20
    expect(prompt).toContain('Brisket');
  });

  it('buildMenuSuggestionPrompt handles zero items', () => {
    const empty = { ...context, itemCount: 0, itemsWithDescription: 0, itemsWithPrice: 0 };
    const prompt = buildMenuSuggestionPrompt(empty);
    expect(prompt).toContain('0 items');
    expect(prompt).toContain('0% complete');
  });

  it('validateSuggestions filters out malformed entries', () => {
    const raw = [
      { title: 'Add descriptions', description: 'Good', impact: 'high', category: 'description' },
      { title: '', description: 'Bad empty title', impact: 'high', category: 'description' },
      { title: 'Ok', description: 'Fine', impact: 'extreme', category: 'price' }, // invalid impact
      { title: 'Pricing', description: 'Add prices', impact: 'medium', category: 'price' },
    ];
    const result = validateSuggestions(raw);
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('Add descriptions');
    expect(result[1].title).toBe('Pricing');
  });

  it('validateSuggestions caps at 5 suggestions', () => {
    const raw = Array.from({ length: 10 }, (_, i) => ({
      title: `Suggestion ${i}`,
      description: 'Desc',
      impact: 'high',
      category: 'description',
    }));
    expect(validateSuggestions(raw)).toHaveLength(5);
  });

  it('validateSuggestions truncates long title and description', () => {
    const raw = [{
      title: 'A'.repeat(200),
      description: 'B'.repeat(500),
      impact: 'medium',
      category: 'naming',
    }];
    const result = validateSuggestions(raw);
    expect(result[0].title.length).toBeLessThanOrEqual(120);
    expect(result[0].description.length).toBeLessThanOrEqual(300);
  });

  it('validateSuggestions returns empty for non-object items', () => {
    expect(validateSuggestions([null, undefined, 42, 'string'])).toEqual([]);
  });
});

// ── S67: KPI Sparkline ────────────────────────────────────────────────────

import {
  buildSparklineData,
  computeSparklineTrend,
  normalizeSparkline,
} from '@/lib/services/kpi-sparkline';

describe('S67: KPI Sparkline Wiring', () => {
  const snapshots = [
    { snapshot_date: '2026-03-01', accuracy_score: 70, visibility_score: 40 },
    { snapshot_date: '2026-03-02', accuracy_score: 72, visibility_score: 42 },
    { snapshot_date: '2026-03-03', accuracy_score: 75, visibility_score: 45 },
    { snapshot_date: '2026-03-04', accuracy_score: null, visibility_score: 48 },
    { snapshot_date: '2026-03-05', accuracy_score: 80, visibility_score: null },
  ];

  it('buildSparklineData filters null accuracy values', () => {
    const data = buildSparklineData(snapshots);
    expect(data.accuracy).toHaveLength(4); // one null filtered
    expect(data.accuracy.every(p => p.value !== null)).toBe(true);
  });

  it('buildSparklineData filters null visibility values', () => {
    const data = buildSparklineData(snapshots);
    expect(data.visibility).toHaveLength(4); // one null filtered
  });

  it('buildSparklineData respects days limit', () => {
    const data = buildSparklineData(snapshots, 3);
    // Last 3 snapshots: 03, 04, 05
    expect(data.accuracy).toHaveLength(2); // 04 is null
  });

  it('computeSparklineTrend detects up/down/flat', () => {
    expect(computeSparklineTrend([
      { date: '2026-03-01', value: 50 },
      { date: '2026-03-02', value: 70 },
    ])).toBe('up');
    expect(computeSparklineTrend([
      { date: '2026-03-01', value: 70 },
      { date: '2026-03-02', value: 50 },
    ])).toBe('down');
    expect(computeSparklineTrend([
      { date: '2026-03-01', value: 50 },
      { date: '2026-03-02', value: 50 },
    ])).toBe('flat');
  });

  it('computeSparklineTrend returns flat for < 2 points', () => {
    expect(computeSparklineTrend([])).toBe('flat');
    expect(computeSparklineTrend([{ date: '2026-03-01', value: 50 }])).toBe('flat');
  });

  it('normalizeSparkline maps to 0-1 range', () => {
    const points = [
      { date: '2026-03-01', value: 20 },
      { date: '2026-03-02', value: 60 },
      { date: '2026-03-03', value: 100 },
    ];
    const result = normalizeSparkline(points);
    expect(result).toEqual([0, 0.5, 1]);
  });

  it('normalizeSparkline handles all-equal values', () => {
    const points = [
      { date: '2026-03-01', value: 50 },
      { date: '2026-03-02', value: 50 },
    ];
    expect(normalizeSparkline(points)).toEqual([0.5, 0.5]);
  });
});

// ── S68: Integration Verifications ────────────────────────────────────────

describe('S68: Integration Verifications', () => {
  it('DigestPreferencesForm component is importable', async () => {
    const mod = await import('@/app/dashboard/settings/_components/DigestPreferencesForm');
    expect(mod.default).toBeDefined();
  });

  it('AISuggestionsButton component is importable', async () => {
    const mod = await import('@/app/dashboard/magic-menus/_components/AISuggestionsButton');
    expect(mod.default).toBeDefined();
  });

  it('DEFAULT_DIGEST_PREFERENCES has all 5 sections', () => {
    expect(DEFAULT_DIGEST_PREFERENCES.sections).toHaveLength(5);
    expect(DEFAULT_DIGEST_PREFERENCES.frequency).toBe('weekly');
  });
});
