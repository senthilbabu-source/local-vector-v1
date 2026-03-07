// ---------------------------------------------------------------------------
// Wave 10: Dashboard Intelligence & Engagement — S53–S58
// Tests pure functions from all 5 service sprints.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';

// S53: KPI Sparklines
import {
  buildSparklineData,
  computeSparklineTrend,
  normalizeSparkline,
  type SparklinePoint,
} from '@/lib/services/kpi-sparkline';

// S54: Digest Preferences
import {
  validateFrequency,
  validateSections,
  shouldSendDigest,
  getFrequencyLabel,
  getSectionLabel,
  DEFAULT_DIGEST_PREFERENCES,
  ALL_DIGEST_SECTIONS,
} from '@/lib/services/digest-preferences';

// S55: Goal Tracker
import {
  computeGoalProgress,
  validateTargetScore,
  validateDeadline,
  formatGoalSummary,
} from '@/lib/services/goal-tracker';

// S56: Error Category Breakdown
import {
  buildCategoryBreakdown,
  getCategoryLabel,
  getCategoryColor,
  getTopCategories,
} from '@/lib/services/error-category-breakdown';

// S57: Platform Coverage
import {
  buildCoverageMatrix,
  getCoverageCell,
  getPlatformCoverage,
  getCoverageColor,
  PLATFORM_LABELS,
} from '@/lib/services/platform-coverage';

// ═══════════════════════════════════════════════════════════════════════════
// S53: KPI Sparklines
// ═══════════════════════════════════════════════════════════════════════════

describe('S53: buildSparklineData', () => {
  const snapshots = [
    { snapshot_date: '2026-03-01', accuracy_score: 70, visibility_score: 40 },
    { snapshot_date: '2026-03-02', accuracy_score: 75, visibility_score: 45 },
    { snapshot_date: '2026-03-03', accuracy_score: 80, visibility_score: 50 },
  ];

  it('returns accuracy and visibility arrays from snapshots', () => {
    const data = buildSparklineData(snapshots);
    expect(data.accuracy).toHaveLength(3);
    expect(data.visibility).toHaveLength(3);
    expect(data.accuracy[0].value).toBe(70);
    expect(data.visibility[2].value).toBe(50);
  });

  it('limits to last N days', () => {
    const data = buildSparklineData(snapshots, 2);
    expect(data.accuracy).toHaveLength(2);
    expect(data.accuracy[0].value).toBe(75);
  });

  it('sorts by date ascending', () => {
    const unsorted = [
      { snapshot_date: '2026-03-03', accuracy_score: 80, visibility_score: 50 },
      { snapshot_date: '2026-03-01', accuracy_score: 70, visibility_score: 40 },
    ];
    const data = buildSparklineData(unsorted);
    expect(data.accuracy[0].value).toBe(70);
    expect(data.accuracy[1].value).toBe(80);
  });

  it('filters out null values', () => {
    const withNulls = [
      { snapshot_date: '2026-03-01', accuracy_score: null, visibility_score: 40 },
      { snapshot_date: '2026-03-02', accuracy_score: 75, visibility_score: null },
    ];
    const data = buildSparklineData(withNulls);
    expect(data.accuracy).toHaveLength(1);
    expect(data.visibility).toHaveLength(1);
  });

  it('returns empty arrays for empty input', () => {
    const data = buildSparklineData([]);
    expect(data.accuracy).toHaveLength(0);
    expect(data.visibility).toHaveLength(0);
  });
});

describe('S53: computeSparklineTrend', () => {
  it('returns up when last > first', () => {
    const points: SparklinePoint[] = [
      { date: '2026-03-01', value: 50 },
      { date: '2026-03-02', value: 70 },
    ];
    expect(computeSparklineTrend(points)).toBe('up');
  });

  it('returns down when last < first', () => {
    const points: SparklinePoint[] = [
      { date: '2026-03-01', value: 70 },
      { date: '2026-03-02', value: 50 },
    ];
    expect(computeSparklineTrend(points)).toBe('down');
  });

  it('returns flat when equal', () => {
    const points: SparklinePoint[] = [
      { date: '2026-03-01', value: 50 },
      { date: '2026-03-02', value: 50 },
    ];
    expect(computeSparklineTrend(points)).toBe('flat');
  });

  it('returns flat for < 2 points', () => {
    expect(computeSparklineTrend([])).toBe('flat');
    expect(computeSparklineTrend([{ date: '2026-03-01', value: 50 }])).toBe('flat');
  });
});

describe('S53: normalizeSparkline', () => {
  it('normalizes values to 0-1 range', () => {
    const points: SparklinePoint[] = [
      { date: '1', value: 0 },
      { date: '2', value: 50 },
      { date: '3', value: 100 },
    ];
    const result = normalizeSparkline(points);
    expect(result).toEqual([0, 0.5, 1]);
  });

  it('returns 0.5 for all equal values', () => {
    const points: SparklinePoint[] = [
      { date: '1', value: 42 },
      { date: '2', value: 42 },
    ];
    expect(normalizeSparkline(points)).toEqual([0.5, 0.5]);
  });

  it('returns empty array for empty input', () => {
    expect(normalizeSparkline([])).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// S54: Digest Preferences
// ═══════════════════════════════════════════════════════════════════════════

describe('S54: validateFrequency', () => {
  it('accepts valid frequencies', () => {
    expect(validateFrequency('weekly')).toBe('weekly');
    expect(validateFrequency('biweekly')).toBe('biweekly');
    expect(validateFrequency('monthly')).toBe('monthly');
  });

  it('returns weekly for invalid input', () => {
    expect(validateFrequency('daily')).toBe('weekly');
    expect(validateFrequency(42)).toBe('weekly');
    expect(validateFrequency(null)).toBe('weekly');
  });
});

describe('S54: validateSections', () => {
  it('accepts valid section arrays', () => {
    const result = validateSections(['score', 'errors']);
    expect(result).toEqual(['score', 'errors']);
  });

  it('filters out invalid sections', () => {
    const result = validateSections(['score', 'invalid', 'wins']);
    expect(result).toEqual(['score', 'wins']);
  });

  it('returns all sections for non-array input', () => {
    expect(validateSections('score')).toEqual(ALL_DIGEST_SECTIONS);
    expect(validateSections(null)).toEqual(ALL_DIGEST_SECTIONS);
  });

  it('returns score only when all are invalid', () => {
    expect(validateSections(['bad', 'wrong'])).toEqual(['score']);
  });
});

describe('S54: shouldSendDigest', () => {
  const now = new Date('2026-03-07T12:00:00Z');

  it('returns true when never sent', () => {
    expect(shouldSendDigest('weekly', null, now)).toBe(true);
  });

  it('returns true when weekly and 7+ days passed', () => {
    expect(shouldSendDigest('weekly', '2026-02-28T12:00:00Z', now)).toBe(true);
  });

  it('returns false when weekly and < 7 days passed', () => {
    expect(shouldSendDigest('weekly', '2026-03-05T12:00:00Z', now)).toBe(false);
  });

  it('returns true when biweekly and 14+ days passed', () => {
    expect(shouldSendDigest('biweekly', '2026-02-21T12:00:00Z', now)).toBe(true);
  });

  it('returns false when biweekly and < 14 days passed', () => {
    expect(shouldSendDigest('biweekly', '2026-02-28T12:00:00Z', now)).toBe(false);
  });

  it('returns true when monthly and 28+ days passed', () => {
    expect(shouldSendDigest('monthly', '2026-02-07T12:00:00Z', now)).toBe(true);
  });
});

describe('S54: getFrequencyLabel', () => {
  it('returns human-readable labels', () => {
    expect(getFrequencyLabel('weekly')).toBe('Every week');
    expect(getFrequencyLabel('biweekly')).toBe('Every 2 weeks');
    expect(getFrequencyLabel('monthly')).toBe('Every month');
  });
});

describe('S54: getSectionLabel', () => {
  it('returns labels for all sections', () => {
    expect(getSectionLabel('score')).toBe('AI Health Score');
    expect(getSectionLabel('errors')).toBe('AI Errors & Fixes');
    expect(getSectionLabel('competitors')).toBe('Competitor Activity');
    expect(getSectionLabel('wins')).toBe('Recent Wins');
    expect(getSectionLabel('recommendations')).toBe('Recommendations');
  });
});

describe('S54: DEFAULT_DIGEST_PREFERENCES', () => {
  it('has weekly frequency and all sections', () => {
    expect(DEFAULT_DIGEST_PREFERENCES.frequency).toBe('weekly');
    expect(DEFAULT_DIGEST_PREFERENCES.sections).toHaveLength(5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// S55: Goal Tracker
// ═══════════════════════════════════════════════════════════════════════════

describe('S55: computeGoalProgress', () => {
  const now = new Date('2026-03-07T12:00:00Z');
  const goal = { targetScore: 80, deadline: '2026-04-01' };

  it('computes progress percentage', () => {
    const result = computeGoalProgress(60, goal, 40, now);
    expect(result.percentComplete).toBe(50); // (60-40)/(80-40) = 50%
    expect(result.currentScore).toBe(60);
    expect(result.targetScore).toBe(80);
  });

  it('marks as achieved when score >= target', () => {
    const result = computeGoalProgress(85, goal, 40, now);
    expect(result.isAchieved).toBe(true);
    expect(result.percentComplete).toBe(100);
  });

  it('marks as overdue when deadline passed and not achieved', () => {
    const pastGoal = { targetScore: 80, deadline: '2026-03-01' };
    const result = computeGoalProgress(50, pastGoal, 0, now);
    expect(result.isOverdue).toBe(true);
    expect(result.daysRemaining).toBe(0);
  });

  it('handles null current score as 0', () => {
    const result = computeGoalProgress(null, goal, 0, now);
    expect(result.currentScore).toBe(0);
    expect(result.percentComplete).toBe(0);
  });

  it('computes days remaining correctly', () => {
    const result = computeGoalProgress(50, goal, 0, now);
    expect(result.daysRemaining).toBe(25); // Mar 7 → Apr 1
  });

  it('clamps percentage to 0-100', () => {
    const result = computeGoalProgress(-10, goal, 0, now);
    expect(result.percentComplete).toBe(0);
  });
});

describe('S55: validateTargetScore', () => {
  it('accepts valid scores 1-100', () => {
    expect(validateTargetScore(50)).toBe(50);
    expect(validateTargetScore(1)).toBe(1);
    expect(validateTargetScore(100)).toBe(100);
  });

  it('rounds to nearest integer', () => {
    expect(validateTargetScore(50.7)).toBe(51);
  });

  it('returns null for out of range', () => {
    expect(validateTargetScore(0)).toBeNull();
    expect(validateTargetScore(101)).toBeNull();
    expect(validateTargetScore(-5)).toBeNull();
  });

  it('returns null for non-number', () => {
    expect(validateTargetScore('50')).toBeNull();
    expect(validateTargetScore(null)).toBeNull();
    expect(validateTargetScore(NaN)).toBeNull();
  });
});

describe('S55: validateDeadline', () => {
  const now = new Date('2026-03-07T12:00:00Z');

  it('accepts future dates', () => {
    expect(validateDeadline('2026-04-01', now)).toBe('2026-04-01');
  });

  it('returns null for past dates', () => {
    expect(validateDeadline('2026-03-01', now)).toBeNull();
  });

  it('returns null for invalid strings', () => {
    expect(validateDeadline('not-a-date', now)).toBeNull();
  });

  it('returns null for non-string', () => {
    expect(validateDeadline(42, now)).toBeNull();
    expect(validateDeadline(null, now)).toBeNull();
  });
});

describe('S55: formatGoalSummary', () => {
  it('shows achievement message when achieved', () => {
    const progress = computeGoalProgress(85, { targetScore: 80, deadline: '2026-04-01' });
    expect(formatGoalSummary(progress)).toContain('reached your goal');
  });

  it('shows points remaining when not achieved', () => {
    const progress = computeGoalProgress(60, { targetScore: 80, deadline: '2026-04-01' });
    const summary = formatGoalSummary(progress);
    expect(summary).toContain('20 points to go');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// S56: Error Category Breakdown
// ═══════════════════════════════════════════════════════════════════════════

describe('S56: buildCategoryBreakdown', () => {
  it('groups errors by category and sorts by count', () => {
    const rows = [
      { category: 'hours' },
      { category: 'hours' },
      { category: 'address' },
      { category: 'hours' },
      { category: 'phone' },
    ];
    const result = buildCategoryBreakdown(rows);
    expect(result.total).toBe(5);
    expect(result.categories[0].category).toBe('hours');
    expect(result.categories[0].count).toBe(3);
    expect(result.categories[0].percentage).toBe(60);
  });

  it('handles null category as uncategorized', () => {
    const rows = [{ category: null }, { category: null }];
    const result = buildCategoryBreakdown(rows);
    expect(result.categories[0].category).toBe('uncategorized');
    expect(result.categories[0].count).toBe(2);
  });

  it('returns empty for no errors', () => {
    const result = buildCategoryBreakdown([]);
    expect(result.total).toBe(0);
    expect(result.categories).toHaveLength(0);
  });
});

describe('S56: getCategoryLabel', () => {
  it('maps known categories to labels', () => {
    expect(getCategoryLabel('hours')).toBe('Wrong Hours');
    expect(getCategoryLabel('address')).toBe('Wrong Address');
    expect(getCategoryLabel('menu')).toBe('Menu Errors');
    expect(getCategoryLabel('uncategorized')).toBe('Other');
  });

  it('capitalizes unknown categories', () => {
    expect(getCategoryLabel('custom')).toBe('Custom');
  });
});

describe('S56: getCategoryColor', () => {
  it('returns colors for known categories', () => {
    expect(getCategoryColor('hours')).toBe('#ef4444');
    expect(getCategoryColor('menu')).toBe('#8b5cf6');
  });

  it('returns slate for unknown categories', () => {
    expect(getCategoryColor('unknown')).toBe('#64748b');
  });
});

describe('S56: getTopCategories', () => {
  it('returns all categories when <= topN', () => {
    const breakdown = buildCategoryBreakdown([
      { category: 'hours' },
      { category: 'address' },
    ]);
    expect(getTopCategories(breakdown, 5)).toHaveLength(2);
  });

  it('groups excess into other', () => {
    const rows = Array.from({ length: 7 }, (_, i) => ({
      category: `cat${i}`,
    }));
    const breakdown = buildCategoryBreakdown(rows);
    const top = getTopCategories(breakdown, 3);
    expect(top).toHaveLength(4); // 3 + "other"
    expect(top[3].category).toBe('other');
    expect(top[3].count).toBe(4);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// S57: Platform Coverage
// ═══════════════════════════════════════════════════════════════════════════

describe('S57: buildCoverageMatrix', () => {
  const evaluations = [
    { query_text: 'best bbq', model_provider: 'openai-gpt4o', is_cited: true },
    { query_text: 'best bbq', model_provider: 'perplexity-sonar', is_cited: false },
    { query_text: 'bbq near me', model_provider: 'openai-gpt4o', is_cited: true },
    { query_text: 'bbq near me', model_provider: 'perplexity-sonar', is_cited: true },
  ];

  it('builds matrix with correct queries and platforms', () => {
    const matrix = buildCoverageMatrix(evaluations);
    expect(matrix.queries).toHaveLength(2);
    expect(matrix.platforms).toHaveLength(2);
  });

  it('computes coverage percentage', () => {
    const matrix = buildCoverageMatrix(evaluations);
    expect(matrix.coveragePercent).toBe(75); // 3/4
  });

  it('orders platforms by PLATFORM_ORDER', () => {
    const matrix = buildCoverageMatrix(evaluations);
    expect(matrix.platforms[0]).toBe('openai-gpt4o');
    expect(matrix.platforms[1]).toBe('perplexity-sonar');
  });

  it('handles empty evaluations', () => {
    const matrix = buildCoverageMatrix([]);
    expect(matrix.queries).toHaveLength(0);
    expect(matrix.coveragePercent).toBe(0);
  });
});

describe('S57: getCoverageCell', () => {
  it('returns correct status for existing cell', () => {
    const matrix = buildCoverageMatrix([
      { query_text: 'test', model_provider: 'openai-gpt4o', is_cited: true },
    ]);
    expect(getCoverageCell(matrix, 'test', 'openai-gpt4o')).toBe('cited');
  });

  it('returns no_data for missing cell', () => {
    const matrix = buildCoverageMatrix([]);
    expect(getCoverageCell(matrix, 'test', 'openai-gpt4o')).toBe('no_data');
  });
});

describe('S57: getPlatformCoverage', () => {
  it('computes per-platform percentage', () => {
    const matrix = buildCoverageMatrix([
      { query_text: 'q1', model_provider: 'openai-gpt4o', is_cited: true },
      { query_text: 'q2', model_provider: 'openai-gpt4o', is_cited: false },
    ]);
    expect(getPlatformCoverage(matrix, 'openai-gpt4o')).toBe(50);
  });

  it('returns 0 for unknown platform', () => {
    const matrix = buildCoverageMatrix([]);
    expect(getPlatformCoverage(matrix, 'unknown')).toBe(0);
  });
});

describe('S57: getCoverageColor', () => {
  it('returns green for cited', () => {
    expect(getCoverageColor('cited')).toBe('#10b981');
  });

  it('returns red for not_cited', () => {
    expect(getCoverageColor('not_cited')).toBe('#ef4444');
  });

  it('returns dark for no_data', () => {
    expect(getCoverageColor('no_data')).toBe('#1e293b');
  });
});

describe('S57: PLATFORM_LABELS', () => {
  it('has labels for all 5 platforms', () => {
    expect(PLATFORM_LABELS['openai-gpt4o']).toBe('ChatGPT');
    expect(PLATFORM_LABELS['perplexity-sonar']).toBe('Perplexity');
    expect(PLATFORM_LABELS['google-gemini']).toBe('Gemini');
    expect(PLATFORM_LABELS['anthropic-claude']).toBe('Claude');
    expect(PLATFORM_LABELS['microsoft-copilot']).toBe('Copilot');
  });
});
