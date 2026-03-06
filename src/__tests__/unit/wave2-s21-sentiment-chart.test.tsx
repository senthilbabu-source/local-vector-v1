// @vitest-environment jsdom
// ---------------------------------------------------------------------------
// wave2-s21-sentiment-chart.test.tsx — S21: Sentiment Trend Chart
// AI_RULES §221
// ---------------------------------------------------------------------------

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { annotateTrendWithErrors } from '@/lib/data/sentiment';
import SentimentTrendChart from '@/app/dashboard/sentiment/_components/SentimentTrendChart';

// ---------------------------------------------------------------------------
// Pure: annotateTrendWithErrors
// ---------------------------------------------------------------------------

// Week starts on Sunday (getWeekStart uses d.getDay() which is 0 for Sunday)
// 2026: Jan 4 = Sunday, Feb 1 = Sunday, Feb 8 = Sunday, Feb 15 = Sunday, Feb 22 = Sunday
const TREND = [
  { weekStart: '2026-02-08', averageScore: 0.4, evaluationCount: 3 },
  { weekStart: '2026-02-15', averageScore: 0.2, evaluationCount: 4 },
  { weekStart: '2026-02-22', averageScore: -0.1, evaluationCount: 2 },
];

describe('annotateTrendWithErrors', () => {
  it('returns same length as input', () => {
    const result = annotateTrendWithErrors(TREND, []);
    expect(result).toHaveLength(3);
  });

  it('sets hasNewError=false for all points when no error dates', () => {
    const result = annotateTrendWithErrors(TREND, []);
    expect(result.every((p) => !p.hasNewError)).toBe(true);
  });

  it('marks week with error correctly', () => {
    // Error on 2026-02-17 (Tuesday) → falls in the 2026-02-15 Sunday week
    const result = annotateTrendWithErrors(TREND, ['2026-02-17T10:00:00Z']);
    const week = result.find((p) => p.weekStart === '2026-02-15');
    expect(week?.hasNewError).toBe(true);
  });

  it('does not mark other weeks', () => {
    const result = annotateTrendWithErrors(TREND, ['2026-02-17T10:00:00Z']);
    const unmarked = result.filter((p) => p.weekStart !== '2026-02-15');
    expect(unmarked.every((p) => !p.hasNewError)).toBe(true);
  });

  it('marks multiple weeks when errors span different weeks', () => {
    const result = annotateTrendWithErrors(TREND, [
      '2026-02-09T00:00:00Z',  // Monday → week of 2026-02-08
      '2026-02-23T00:00:00Z',  // Monday → week of 2026-02-22
    ]);
    const marked = result.filter((p) => p.hasNewError);
    expect(marked).toHaveLength(2);
  });

  it('preserves original score and count fields', () => {
    const result = annotateTrendWithErrors(TREND, []);
    expect(result[0].averageScore).toBe(0.4);
    expect(result[0].evaluationCount).toBe(3);
    expect(result[0].weekStart).toBe('2026-02-08');
  });

  it('handles empty trend array', () => {
    const result = annotateTrendWithErrors([], ['2026-02-17T00:00:00Z']);
    expect(result).toEqual([]);
  });

  it('handles multiple errors in the same week — marks it once', () => {
    // Both Mon+Tue fall in the 2026-02-08 Sunday week
    const result = annotateTrendWithErrors(TREND, [
      '2026-02-09T00:00:00Z',  // Monday → 2026-02-08 week
      '2026-02-10T00:00:00Z',  // Tuesday → 2026-02-08 week
    ]);
    const week = result.find((p) => p.weekStart === '2026-02-08');
    expect(week?.hasNewError).toBe(true);
    // Only one week should be marked
    expect(result.filter((p) => p.hasNewError)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Component: SentimentTrendChart
// ---------------------------------------------------------------------------

// Recharts uses SVG — mock ResizeObserver and matchMedia (jsdom doesn't have them)
vi.stubGlobal('ResizeObserver', class {
  observe() {}
  unobserve() {}
  disconnect() {}
});

vi.stubGlobal('matchMedia', (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
}));

const CHART_DATA = [
  { weekStart: '2026-02-08', averageScore: 0.4, evaluationCount: 3, hasNewError: false },
  { weekStart: '2026-02-15', averageScore: 0.1, evaluationCount: 4, hasNewError: true },
  { weekStart: '2026-02-22', averageScore: -0.1, evaluationCount: 2, hasNewError: false },
];

describe('SentimentTrendChart', () => {
  it('shows "not enough data" when data has fewer than 2 points', () => {
    render(<SentimentTrendChart data={[CHART_DATA[0]]} />);
    expect(screen.getByText(/not enough data/i)).toBeTruthy();
  });

  it('renders chart container when data has 2+ points', () => {
    render(<SentimentTrendChart data={CHART_DATA} />);
    expect(screen.getByTestId('sentiment-trend-chart')).toBeTruthy();
  });

  it('shows legend labels: Positive, Neutral, Negative', () => {
    render(<SentimentTrendChart data={CHART_DATA} />);
    expect(screen.getByText('Positive')).toBeTruthy();
    expect(screen.getByText('Neutral')).toBeTruthy();
    expect(screen.getByText('Negative')).toBeTruthy();
  });

  it('shows "New AI error" in legend', () => {
    render(<SentimentTrendChart data={CHART_DATA} />);
    expect(screen.getByText('New AI error')).toBeTruthy();
  });

  it('shows the correct weeks count in heading', () => {
    render(<SentimentTrendChart data={CHART_DATA} />);
    expect(screen.getByText(/last 3 weeks/i)).toBeTruthy();
  });
});
