// @vitest-environment jsdom
// ---------------------------------------------------------------------------
// reality-score-trend-chart.test.tsx — P8-FIX-33
//
// Tests the RealityScoreTrendChart component (recharts AreaChart).
//
// Run:
//   npx vitest run src/__tests__/unit/reality-score-trend-chart.test.tsx
// ---------------------------------------------------------------------------

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock recharts — ResponsiveContainer requires DOM measurement
vi.mock('recharts', () => ({
  AreaChart: ({ children }: { children: React.ReactNode }) => <div data-testid="recharts-area-chart">{children}</div>,
  Area: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/components/ui/InfoTooltip', () => ({
  InfoTooltip: () => <span data-testid="info-tooltip" />,
}));

vi.mock('@/lib/tooltip-content', () => ({
  TOOLTIP_CONTENT: { realityScore: 'Reality Score tooltip' },
}));

import RealityScoreTrendChart from '@/app/dashboard/_components/RealityScoreTrendChart';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const MOCK_TREND_DATA = [
  { date: '2026-02-09', score: 65 },
  { date: '2026-02-16', score: 70 },
  { date: '2026-02-23', score: 78 },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RealityScoreTrendChart', () => {
  it('renders empty state when data is empty', () => {
    render(<RealityScoreTrendChart data={[]} />);

    expect(screen.getByText(/No score history yet/)).toBeDefined();
    expect(screen.getByTestId('reality-score-trend-chart')).toBeDefined();
  });

  it('renders chart container with data-testid', () => {
    render(<RealityScoreTrendChart data={MOCK_TREND_DATA} />);

    expect(screen.getByTestId('reality-score-trend-chart')).toBeDefined();
    expect(screen.getByTestId('recharts-area-chart')).toBeDefined();
  });

  it('renders sr-only table with correct row count', () => {
    render(<RealityScoreTrendChart data={MOCK_TREND_DATA} />);

    const caption = screen.getByText('AI Health Score Trend Data');
    expect(caption).toBeDefined();

    // Table should have 3 rows (one per data point)
    const table = caption.closest('table');
    expect(table).toBeDefined();
    const rows = table!.querySelectorAll('tbody tr');
    expect(rows.length).toBe(3);
  });

  it('renders View details link to entity-health', () => {
    render(<RealityScoreTrendChart data={MOCK_TREND_DATA} />);

    const link = screen.getByText('View details');
    expect(link.closest('a')?.getAttribute('href')).toBe('/dashboard/entity-health');
  });

  it('renders title "AI Health Score Trend"', () => {
    render(<RealityScoreTrendChart data={MOCK_TREND_DATA} />);

    expect(screen.getByText('AI Health Score Trend')).toBeDefined();
  });
});
