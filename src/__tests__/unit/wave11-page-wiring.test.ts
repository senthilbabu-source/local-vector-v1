// ---------------------------------------------------------------------------
// Wave 11: Page Wiring — S59–S63
// Verifies components are importable and data transformation logic is correct.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';

// S56: Error category breakdown (wired into hallucinations page)
import {
  buildCategoryBreakdown,
  getCategoryLabel,
  getCategoryColor,
  getTopCategories,
} from '@/lib/services/error-category-breakdown';

// S57: Platform coverage (wired into SOV page)
import {
  buildCoverageMatrix,
  getCoverageCell,
  getPlatformCoverage,
  getCoverageColor,
  PLATFORM_LABELS,
  PLATFORM_ORDER,
} from '@/lib/services/platform-coverage';

// S55: Goal tracker (wired into dashboard)
import {
  computeGoalProgress,
  validateTargetScore,
  validateDeadline,
  formatGoalSummary,
  type ScoreGoal,
} from '@/lib/services/goal-tracker';

// ---------------------------------------------------------------------------
// S59: ErrorCategoryChart wiring — data transform validation
// ---------------------------------------------------------------------------

describe('S59: Error category data for hallucinations page', () => {
  it('transforms hallucination rows to category breakdown', () => {
    const rows = [
      { category: 'hours' },
      { category: 'hours' },
      { category: 'address' },
      { category: null },
    ];
    const result = buildCategoryBreakdown(rows);
    expect(result.total).toBe(4);
    expect(result.categories[0].category).toBe('hours');
    expect(result.categories[0].count).toBe(2);
  });

  it('returns empty breakdown for no rows', () => {
    const result = buildCategoryBreakdown([]);
    expect(result.total).toBe(0);
    expect(result.categories).toEqual([]);
  });

  it('labels map correctly for page display', () => {
    expect(getCategoryLabel('hours')).toBe('Wrong Hours');
    expect(getCategoryLabel('address')).toBe('Wrong Address');
    expect(getCategoryLabel('uncategorized')).toBe('Other');
  });

  it('color map returns valid hex for known categories', () => {
    expect(getCategoryColor('hours')).toMatch(/^#[0-9a-f]{6}$/);
    expect(getCategoryColor('unknown_cat')).toBe('#64748b');
  });

  it('getTopCategories groups overflow into Other', () => {
    const rows = Array.from({ length: 8 }, (_, i) => ({ category: `cat${i}` }));
    const breakdown = buildCategoryBreakdown(rows);
    const top = getTopCategories(breakdown, 5);
    expect(top).toHaveLength(6); // 5 + "other"
    expect(top[5].category).toBe('other');
  });
});

// ---------------------------------------------------------------------------
// S60: PlatformCoverageGrid wiring — engine-to-model mapping validation
// ---------------------------------------------------------------------------

describe('S60: Platform coverage data for SOV page', () => {
  const ENGINE_TO_MODEL: Record<string, string> = {
    openai: 'openai-gpt4o',
    perplexity: 'perplexity-sonar',
    gemini: 'google-gemini',
    anthropic: 'anthropic-claude',
    copilot: 'microsoft-copilot',
  };

  it('engine-to-model mapping covers all PLATFORM_ORDER entries', () => {
    const mappedValues = Object.values(ENGINE_TO_MODEL);
    for (const platform of PLATFORM_ORDER) {
      expect(mappedValues).toContain(platform);
    }
  });

  it('builds coverage matrix from transformed SOV evaluations', () => {
    const evals = [
      { query_text: 'best pizza', model_provider: 'openai-gpt4o', is_cited: true },
      { query_text: 'best pizza', model_provider: 'perplexity-sonar', is_cited: false },
      { query_text: 'lunch spots', model_provider: 'openai-gpt4o', is_cited: true },
      { query_text: 'lunch spots', model_provider: 'perplexity-sonar', is_cited: true },
    ];
    const matrix = buildCoverageMatrix(evals);
    expect(matrix.queries).toHaveLength(2);
    expect(matrix.platforms).toHaveLength(2);
    expect(matrix.coveragePercent).toBe(75); // 3 of 4 cited
  });

  it('getCoverageCell returns correct status', () => {
    const evals = [
      { query_text: 'test query', model_provider: 'openai-gpt4o', is_cited: true },
    ];
    const matrix = buildCoverageMatrix(evals);
    expect(getCoverageCell(matrix, 'test query', 'openai-gpt4o')).toBe('cited');
    expect(getCoverageCell(matrix, 'test query', 'perplexity-sonar')).toBe('no_data');
  });

  it('getPlatformCoverage computes per-platform rate', () => {
    const evals = [
      { query_text: 'q1', model_provider: 'openai-gpt4o', is_cited: true },
      { query_text: 'q2', model_provider: 'openai-gpt4o', is_cited: false },
    ];
    const matrix = buildCoverageMatrix(evals);
    expect(getPlatformCoverage(matrix, 'openai-gpt4o')).toBe(50);
  });

  it('PLATFORM_LABELS has human-readable names', () => {
    expect(PLATFORM_LABELS['openai-gpt4o']).toBe('ChatGPT');
    expect(PLATFORM_LABELS['perplexity-sonar']).toBe('Perplexity');
  });

  it('getCoverageColor returns correct colors', () => {
    expect(getCoverageColor('cited')).toBe('#10b981');
    expect(getCoverageColor('not_cited')).toBe('#ef4444');
    expect(getCoverageColor('no_data')).toBe('#1e293b');
  });

  it('rank_position mapping: null = not cited, non-null = cited', () => {
    // Simulates the SOV page transform logic
    const sovEvals = [
      { query_id: 'q1', engine: 'openai', rank_position: 3 },
      { query_id: 'q2', engine: 'openai', rank_position: null },
    ];
    const queryMap = new Map([['q1', 'best pizza'], ['q2', 'late night food']]);

    const transformed = sovEvals
      .filter((e) => queryMap.has(e.query_id))
      .map((e) => ({
        query_text: queryMap.get(e.query_id)!,
        model_provider: ENGINE_TO_MODEL[e.engine] ?? e.engine,
        is_cited: e.rank_position !== null,
      }));

    expect(transformed[0].is_cited).toBe(true);
    expect(transformed[1].is_cited).toBe(false);
    expect(transformed[0].model_provider).toBe('openai-gpt4o');
  });
});

// ---------------------------------------------------------------------------
// S62: GoalTrackerCard wiring — goal progress with null score
// ---------------------------------------------------------------------------

describe('S62: GoalTracker wired into dashboard', () => {
  it('computeGoalProgress handles null currentScore (displays as 0)', () => {
    const goal: ScoreGoal = { targetScore: 80, deadline: '2027-01-01' };
    const progress = computeGoalProgress(null, goal);
    expect(progress.currentScore).toBe(0);
    expect(progress.percentComplete).toBe(0);
    expect(progress.isAchieved).toBe(false);
  });

  it('computeGoalProgress detects achieved goal', () => {
    const goal: ScoreGoal = { targetScore: 70, deadline: '2027-01-01' };
    const progress = computeGoalProgress(85, goal);
    expect(progress.isAchieved).toBe(true);
    expect(progress.percentComplete).toBe(100);
  });

  it('computeGoalProgress detects overdue goal', () => {
    const goal: ScoreGoal = { targetScore: 90, deadline: '2020-01-01' };
    const progress = computeGoalProgress(50, goal);
    expect(progress.isOverdue).toBe(true);
    expect(progress.daysRemaining).toBe(0);
  });

  it('formatGoalSummary produces correct messages', () => {
    const achieved: ScoreGoal = { targetScore: 70, deadline: '2027-01-01' };
    expect(formatGoalSummary(computeGoalProgress(75, achieved))).toContain('reached your goal');

    const inProgress: ScoreGoal = { targetScore: 80, deadline: '2027-06-01' };
    expect(formatGoalSummary(computeGoalProgress(60, inProgress))).toContain('20 points to go');
  });

  it('validateTargetScore rejects out-of-range values', () => {
    expect(validateTargetScore(0)).toBeNull();
    expect(validateTargetScore(101)).toBeNull();
    expect(validateTargetScore('hello')).toBeNull();
    expect(validateTargetScore(75)).toBe(75);
  });

  it('validateDeadline rejects past dates', () => {
    expect(validateDeadline('2020-01-01')).toBeNull();
    expect(validateDeadline('invalid')).toBeNull();
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    expect(validateDeadline(future)).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// S63: DashboardSectionSkeleton — import verification
// ---------------------------------------------------------------------------

describe('S63: DashboardSectionSkeleton is importable', () => {
  it('module exports default function', async () => {
    const mod = await import('@/app/dashboard/_components/DashboardSectionSkeleton');
    expect(typeof mod.default).toBe('function');
  });
});
