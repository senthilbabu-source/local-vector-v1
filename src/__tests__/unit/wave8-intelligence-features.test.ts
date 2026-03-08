// ---------------------------------------------------------------------------
// Wave 8: New Intelligence Features — S41–S46
// Tests pure functions from all 6 sprints.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';

// S41: Weekly Report Card
import {
  getScoreColor,
  formatScoreDelta,
  buildReportCardText,
  type WeeklyReportCard,
} from '@/lib/services/weekly-report-card';

// S42: Before & After Timeline
import {
  buildBeforeAfterStory,
  formatDaysToFix,
  type ResolvedHallucination,
} from '@/lib/services/before-after';

// S43: Menu Optimizer
import {
  analyzeMenuCompleteness,
  generateMenuSuggestions,
  type MenuItemData,
} from '@/lib/menu-intelligence/menu-optimizer';

// S44: Snapshot Builder
import {
  buildSnapshotText,
  isSnapshotMeaningful,
  type SnapshotData,
} from '@/lib/services/snapshot-builder';

// S46: Competitor Watch
import {
  detectCompetitorChanges,
  isSignificantChange,
  formatCompetitorAlert,
  type CompetitorChange,
} from '@/lib/services/competitor-watch';

// ═══════════════════════════════════════════════════════════════════════════
// S41: Weekly AI Report Card
// ═══════════════════════════════════════════════════════════════════════════

describe('S41: getScoreColor', () => {
  it('returns green for score >= 70', () => {
    expect(getScoreColor(85)).toBe('green');
    expect(getScoreColor(70)).toBe('green');
  });

  it('returns amber for score >= 40 and < 70', () => {
    expect(getScoreColor(50)).toBe('amber');
    expect(getScoreColor(40)).toBe('amber');
  });

  it('returns red for score < 40', () => {
    expect(getScoreColor(20)).toBe('red');
    expect(getScoreColor(0)).toBe('red');
  });

  it('returns gray for null score', () => {
    expect(getScoreColor(null)).toBe('gray');
  });
});

describe('S41: formatScoreDelta', () => {
  it('returns +N for positive delta', () => {
    expect(formatScoreDelta(5)).toBe('+5');
  });

  it('returns -N for negative delta', () => {
    expect(formatScoreDelta(-3)).toBe('-3');
  });

  it('returns 0 for zero delta', () => {
    expect(formatScoreDelta(0)).toBe('0');
  });

  it('returns N/A for null', () => {
    expect(formatScoreDelta(null)).toBe('N/A');
  });
});

describe('S41: buildReportCardText', () => {
  const card: WeeklyReportCard = {
    score: 72,
    scoreDelta: 5,
    topWin: 'Fixed hours on ChatGPT',
    topIssue: 'ChatGPT: "Wrong phone number"',
    competitorHighlight: "Joe's BBQ mentioned 12 times",
    nextAction: 'Fix open AI errors on the dashboard',
    errorsFixed: 3,
    newErrors: 1,
    sovPercent: 45,
  };

  it('includes business name', () => {
    const text = buildReportCardText(card, 'Charcoal & Chill');
    expect(text).toContain('Charcoal & Chill');
  });

  it('includes score and delta', () => {
    const text = buildReportCardText(card, 'Test');
    expect(text).toContain('72');
    expect(text).toContain('+5');
  });

  it('includes SOV percent', () => {
    const text = buildReportCardText(card, 'Test');
    expect(text).toContain('45%');
  });

  it('is max 10 lines', () => {
    const text = buildReportCardText(card, 'Test');
    expect(text.split('\n').length).toBeLessThanOrEqual(10);
  });

  it('handles null score', () => {
    const nullCard: WeeklyReportCard = { ...card, score: null, scoreDelta: null };
    const text = buildReportCardText(nullCard, 'Test');
    expect(text).toContain('N/A');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// S42: Before & After Timeline
// ═══════════════════════════════════════════════════════════════════════════

describe('S42: buildBeforeAfterStory', () => {
  const hallucination: ResolvedHallucination = {
    id: 'h1',
    claim_text: 'They close at 9pm',
    expected_truth: 'We close at 11pm',
    category: 'hours',
    model_provider: 'openai-gpt4o',
    severity: 'critical',
    detected_at: '2026-02-15T00:00:00Z',
    fixed_at: '2026-02-18T00:00:00Z',
    revenue_recovered_monthly: 340,
  };

  it('builds 3-step story (detection, action, resolution)', () => {
    const story = buildBeforeAfterStory(hallucination);
    expect(story.steps).toHaveLength(3);
    expect(story.steps.map(s => s.type)).toContain('detection');
    expect(story.steps.map(s => s.type)).toContain('action');
    expect(story.steps.map(s => s.type)).toContain('resolution');
  });

  it('computes daysToFix correctly', () => {
    const story = buildBeforeAfterStory(hallucination);
    expect(story.daysToFix).toBe(3);
  });

  it('includes revenue recovered', () => {
    const story = buildBeforeAfterStory(hallucination);
    expect(story.totalRecovered).toBe(340);
  });

  it('uses model display name in detail', () => {
    const story = buildBeforeAfterStory(hallucination);
    expect(story.steps[0].detail).toContain('ChatGPT');
  });

  it('handles null expected_truth', () => {
    const h = { ...hallucination, expected_truth: null };
    const story = buildBeforeAfterStory(h);
    expect(story.steps.find(s => s.type === 'action')?.detail).toBe('You submitted a correction');
  });

  it('handles same-day detection and fix', () => {
    const h = { ...hallucination, fixed_at: '2026-02-15T00:00:00Z' };
    const story = buildBeforeAfterStory(h);
    expect(story.daysToFix).toBe(0);
  });

  it('sorts steps chronologically', () => {
    const story = buildBeforeAfterStory(hallucination);
    for (let i = 1; i < story.steps.length; i++) {
      expect(new Date(story.steps[i].date).getTime()).toBeGreaterThanOrEqual(
        new Date(story.steps[i - 1].date).getTime(),
      );
    }
  });
});

describe('S42: formatDaysToFix', () => {
  it('returns "Same day" for 0', () => {
    expect(formatDaysToFix(0)).toBe('Same day');
  });

  it('returns "1 day" for 1', () => {
    expect(formatDaysToFix(1)).toBe('1 day');
  });

  it('returns "N days" for N > 1', () => {
    expect(formatDaysToFix(5)).toBe('5 days');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// S43: Menu Optimizer
// ═══════════════════════════════════════════════════════════════════════════

describe('S43: analyzeMenuCompleteness', () => {
  it('counts items correctly', () => {
    const items: MenuItemData[] = [
      { name: 'Brisket', description: 'Slow smoked', price: '$18', dietary_tags: ['gluten-free'] },
      { name: 'Ribs', description: null, price: '$22', dietary_tags: [] },
      { name: 'Coleslaw', description: '', price: null },
    ];
    const result = analyzeMenuCompleteness(items);
    expect(result.totalItems).toBe(3);
    expect(result.itemsWithDescription).toBe(1);
    expect(result.itemsWithPrice).toBe(2);
    expect(result.itemsWithDietary).toBe(1);
  });

  it('returns zeros for empty array', () => {
    const result = analyzeMenuCompleteness([]);
    expect(result.totalItems).toBe(0);
    expect(result.descriptionPercent).toBe(0);
  });

  it('computes percentages correctly', () => {
    const items: MenuItemData[] = [
      { name: 'A', description: 'Yes', price: '$10' },
      { name: 'B', description: 'Yes', price: null },
    ];
    const result = analyzeMenuCompleteness(items);
    expect(result.descriptionPercent).toBe(100);
    expect(result.pricePercent).toBe(50);
  });
});

describe('S43: generateMenuSuggestions', () => {
  it('returns upload suggestion for empty menu', () => {
    const completeness = analyzeMenuCompleteness([]);
    const suggestions = generateMenuSuggestions(completeness);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].title).toContain('Upload');
  });

  it('suggests descriptions for high-demand items missing them', () => {
    const items: MenuItemData[] = [
      { name: 'Brisket', description: null, price: '$18' },
    ];
    const completeness = analyzeMenuCompleteness(items);
    const demand = [{ item_name: 'Brisket', mention_count: 47 }];
    const suggestions = generateMenuSuggestions(completeness, demand, items);
    expect(suggestions.some(s => s.title.includes('Brisket'))).toBe(true);
  });

  it('returns max 5 suggestions', () => {
    const items: MenuItemData[] = Array.from({ length: 20 }, (_, i) => ({
      name: `Item ${i}`,
      description: null,
      price: null,
    }));
    const completeness = analyzeMenuCompleteness(items);
    const suggestions = generateMenuSuggestions(completeness);
    expect(suggestions.length).toBeLessThanOrEqual(5);
  });

  it('suggests dietary tags when none exist', () => {
    const items: MenuItemData[] = [
      { name: 'A', description: 'Y', price: '$10', dietary_tags: [] },
    ];
    const completeness = analyzeMenuCompleteness(items);
    const suggestions = generateMenuSuggestions(completeness);
    expect(suggestions.some(s => s.category === 'dietary')).toBe(true);
  });

  it('returns empty suggestions when all items are complete', () => {
    const items: MenuItemData[] = [
      { name: 'A', description: 'Full', price: '$10', dietary_tags: ['vegan'] },
      { name: 'B', description: 'Full', price: '$12', dietary_tags: ['gf'] },
    ];
    const completeness = analyzeMenuCompleteness(items);
    const suggestions = generateMenuSuggestions(completeness);
    expect(suggestions).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// S44: Snapshot Builder
// ═══════════════════════════════════════════════════════════════════════════

describe('S44: buildSnapshotText', () => {
  const snapshot: SnapshotData = {
    businessName: 'Charcoal & Chill',
    score: 72,
    sovPercent: 45,
    errorsFixed: 3,
    revenueRecovered: 1200,
    generatedAt: '2026-03-07T00:00:00Z',
  };

  it('includes business name', () => {
    const text = buildSnapshotText(snapshot);
    expect(text).toContain('Charcoal & Chill');
  });

  it('includes score', () => {
    const text = buildSnapshotText(snapshot);
    expect(text).toContain('72');
  });

  it('includes date', () => {
    const text = buildSnapshotText(snapshot);
    expect(text).toContain('2026');
  });

  it('includes powered by footer', () => {
    const text = buildSnapshotText(snapshot);
    expect(text).toContain('Powered by LocalVector.ai');
  });

  it('handles null score', () => {
    const s = { ...snapshot, score: null };
    const text = buildSnapshotText(s);
    expect(text).toContain('N/A');
  });

  it('is max 10 lines', () => {
    const text = buildSnapshotText(snapshot);
    expect(text.split('\n').length).toBeLessThanOrEqual(10);
  });
});

describe('S44: isSnapshotMeaningful', () => {
  it('returns true when score is present', () => {
    expect(isSnapshotMeaningful({
      businessName: 'Test', score: 72, sovPercent: null, errorsFixed: 0, revenueRecovered: 0, generatedAt: '',
    })).toBe(true);
  });

  it('returns true when errors fixed > 0', () => {
    expect(isSnapshotMeaningful({
      businessName: 'Test', score: null, sovPercent: null, errorsFixed: 5, revenueRecovered: 0, generatedAt: '',
    })).toBe(true);
  });

  it('returns false when all metrics are zero/null', () => {
    expect(isSnapshotMeaningful({
      businessName: 'Test', score: null, sovPercent: null, errorsFixed: 0, revenueRecovered: 0, generatedAt: '',
    })).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// S46: Competitor Watch
// ═══════════════════════════════════════════════════════════════════════════

describe('S46: detectCompetitorChanges', () => {
  it('detects > 10% increase', () => {
    const current = new Map([['Joe BBQ', 20]]);
    const previous = new Map([['Joe BBQ', 10]]);
    const changes = detectCompetitorChanges(current, previous);
    expect(changes).toHaveLength(1);
    expect(changes[0].direction).toBe('up');
    expect(changes[0].deltaPct).toBe(100);
  });

  it('detects > 10% decrease', () => {
    const current = new Map([['Joe BBQ', 5]]);
    const previous = new Map([['Joe BBQ', 10]]);
    const changes = detectCompetitorChanges(current, previous);
    expect(changes).toHaveLength(1);
    expect(changes[0].direction).toBe('down');
    expect(changes[0].deltaPct).toBe(50);
  });

  it('ignores no change', () => {
    const current = new Map([['Joe BBQ', 10]]);
    const previous = new Map([['Joe BBQ', 10]]);
    const changes = detectCompetitorChanges(current, previous);
    expect(changes).toHaveLength(0);
  });

  it('handles new competitor (no previous data)', () => {
    const current = new Map([['New Place', 5]]);
    const previous = new Map<string, number>();
    const changes = detectCompetitorChanges(current, previous);
    expect(changes).toHaveLength(1);
    expect(changes[0].direction).toBe('up');
    expect(changes[0].deltaPct).toBe(100);
  });

  it('handles disappeared competitor', () => {
    const current = new Map<string, number>();
    const previous = new Map([['Old Place', 8]]);
    const changes = detectCompetitorChanges(current, previous);
    expect(changes).toHaveLength(1);
    expect(changes[0].direction).toBe('down');
    expect(changes[0].currentMentions).toBe(0);
  });

  it('sorts by delta magnitude descending', () => {
    const current = new Map([['A', 20], ['B', 15]]);
    const previous = new Map([['A', 10], ['B', 12]]);
    const changes = detectCompetitorChanges(current, previous);
    expect(changes.length).toBeGreaterThan(1);
    expect(changes[0].deltaPct).toBeGreaterThanOrEqual(changes[1].deltaPct);
  });
});

describe('S46: isSignificantChange', () => {
  it('returns true for change >= threshold', () => {
    const change: CompetitorChange = { name: 'A', currentMentions: 20, previousMentions: 10, deltaPct: 100, direction: 'up' };
    expect(isSignificantChange(change, 10)).toBe(true);
  });

  it('returns false for change < threshold', () => {
    const change: CompetitorChange = { name: 'A', currentMentions: 11, previousMentions: 10, deltaPct: 5, direction: 'up' };
    expect(isSignificantChange(change, 10)).toBe(false);
  });

  it('uses default threshold of 10', () => {
    const change: CompetitorChange = { name: 'A', currentMentions: 12, previousMentions: 10, deltaPct: 20, direction: 'up' };
    expect(isSignificantChange(change)).toBe(true);
  });
});

describe('S46: formatCompetitorAlert', () => {
  it('formats up direction', () => {
    const change: CompetitorChange = { name: 'Joe BBQ', currentMentions: 20, previousMentions: 10, deltaPct: 100, direction: 'up' };
    const alert = formatCompetitorAlert(change);
    expect(alert).toContain('Joe BBQ');
    expect(alert).toContain('jumped');
    expect(alert).toContain('100%');
  });

  it('formats down direction', () => {
    const change: CompetitorChange = { name: 'Joe BBQ', currentMentions: 5, previousMentions: 10, deltaPct: 50, direction: 'down' };
    const alert = formatCompetitorAlert(change);
    expect(alert).toContain('dropped');
    expect(alert).toContain('50%');
  });
});
