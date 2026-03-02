// ---------------------------------------------------------------------------
// Sprint 122: benchmark-components.test.tsx — 10 tests
// @vitest-environment jsdom
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import BenchmarkCard from '@/app/dashboard/_components/BenchmarkCard';
import BenchmarkTrendChart from '@/app/dashboard/_components/BenchmarkTrendChart';
import {
  MOCK_ORG_BENCHMARK_RESULT,
  MOCK_BENCHMARK_HISTORY,
  MOCK_BENCHMARK_INSUFFICIENT,
} from '@/src/__fixtures__/golden-tenant';

// ---------------------------------------------------------------------------
// Mock recharts (jsdom doesn't support SVG rendering)
// ---------------------------------------------------------------------------

vi.mock('recharts', () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-line-chart">{children}</div>
  ),
  Line: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Tooltip: () => null,
}));

const ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

// ---------------------------------------------------------------------------
// BenchmarkCard tests — 7 tests
// ---------------------------------------------------------------------------

describe('BenchmarkCard', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    cleanup();
  });

  it('renders skeleton while loading', () => {
    // Never resolve the fetch
    fetchMock.mockReturnValue(new Promise(() => {}));
    render(<BenchmarkCard orgId={ORG_ID} orgName="Test" />);
    const card = screen.getByTestId('benchmark-card');
    expect(card.classList.contains('animate-pulse')).toBe(true);
  });

  it('shows benchmark-insufficient-data when insufficient_data:true', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_BENCHMARK_INSUFFICIENT),
    });

    await act(async () => {
      render(<BenchmarkCard orgId={ORG_ID} orgName="Test" />);
    });
    // Allow microtask queue to flush
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(screen.getByTestId('benchmark-insufficient-data')).toBeDefined();
  });

  it('percentile_rank=77 renders exact string "top 23%"', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          current: MOCK_ORG_BENCHMARK_RESULT,
          history: MOCK_BENCHMARK_HISTORY,
          insufficient_data: false,
        }),
    });

    await act(async () => {
      render(<BenchmarkCard orgId={ORG_ID} orgName="Test" />);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    const text = screen.getByTestId('benchmark-percentile-text');
    expect(text.textContent).toContain('top 23%');
  });

  it('percentile_rank=100 renders exact string "top 1%" (never "top 0%")', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          current: { ...MOCK_ORG_BENCHMARK_RESULT, percentile_rank: 100 },
          history: [],
          insufficient_data: false,
        }),
    });

    await act(async () => {
      render(<BenchmarkCard orgId={ORG_ID} orgName="Test" />);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    const text = screen.getByTestId('benchmark-percentile-text');
    expect(text.textContent).toContain('top 1%');
    expect(text.textContent).not.toContain('top 0%');
  });

  it('percentile_rank=0 renders exact string "bottom tier" (never "top 100%")', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          current: { ...MOCK_ORG_BENCHMARK_RESULT, percentile_rank: 0 },
          history: [],
          insufficient_data: false,
        }),
    });

    await act(async () => {
      render(<BenchmarkCard orgId={ORG_ID} orgName="Test" />);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    const text = screen.getByTestId('benchmark-percentile-text');
    expect(text.textContent).toContain('bottom tier');
    expect(text.textContent).not.toContain('top 100%');
  });

  it('shows org_sov_score and industry_median', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          current: MOCK_ORG_BENCHMARK_RESULT,
          history: MOCK_BENCHMARK_HISTORY,
          insufficient_data: false,
        }),
    });

    await act(async () => {
      render(<BenchmarkCard orgId={ORG_ID} orgName="Test" />);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(screen.getByTestId('benchmark-your-score').textContent).toContain('67');
    expect(screen.getByTestId('benchmark-industry-median').textContent).toContain('52');
  });

  it('shows sample_count with data-testid="benchmark-sample-count"', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          current: MOCK_ORG_BENCHMARK_RESULT,
          history: MOCK_BENCHMARK_HISTORY,
          insufficient_data: false,
        }),
    });

    await act(async () => {
      render(<BenchmarkCard orgId={ORG_ID} orgName="Test" />);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    const el = screen.getByTestId('benchmark-sample-count');
    expect(el.textContent).toContain('8');
  });
});

// ---------------------------------------------------------------------------
// BenchmarkTrendChart tests — 3 tests
// ---------------------------------------------------------------------------

describe('BenchmarkTrendChart', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders when history.length >= 2', () => {
    render(<BenchmarkTrendChart history={MOCK_BENCHMARK_HISTORY} />);
    expect(screen.getByTestId('benchmark-trend-chart')).toBeDefined();
    expect(screen.queryByText('Not enough history yet.')).toBeNull();
  });

  it('shows "Not enough history yet." when history.length < 2', () => {
    render(<BenchmarkTrendChart history={[MOCK_ORG_BENCHMARK_RESULT]} />);
    expect(screen.getByText('Not enough history yet.')).toBeDefined();
  });

  it('shows benchmark-trend-improving when last > first', () => {
    // MOCK_BENCHMARK_HISTORY: first=55, last=77 → improving
    render(<BenchmarkTrendChart history={MOCK_BENCHMARK_HISTORY} />);
    expect(screen.getByTestId('benchmark-trend-improving')).toBeDefined();
  });
});
