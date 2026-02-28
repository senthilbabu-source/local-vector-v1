// ---------------------------------------------------------------------------
// Sprint F (N4): BenchmarkComparisonCard — unit tests
// @vitest-environment jsdom
// ---------------------------------------------------------------------------

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import BenchmarkComparisonCard from '@/app/dashboard/_components/BenchmarkComparisonCard';

// Mock InfoTooltip
vi.mock('@/components/ui/InfoTooltip', () => ({
  InfoTooltip: ({ content }: { content: React.ReactNode }) => (
    <span data-testid="info-tooltip">{typeof content === 'string' ? content : 'tooltip'}</span>
  ),
}));

describe('BenchmarkComparisonCard', () => {
  it('renders nothing when orgCity is null', () => {
    const { container } = render(
      <BenchmarkComparisonCard
        orgScore={62}
        orgCity={null}
        orgIndustry="Restaurant"
        benchmark={null}
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders collecting state when benchmark is null', () => {
    render(
      <BenchmarkComparisonCard
        orgScore={62}
        orgCity="Alpharetta"
        orgIndustry="Restaurant"
        benchmark={null}
      />,
    );
    expect(screen.getByTestId('benchmark-collecting-state')).toBeDefined();
    expect(screen.getByText('62')).toBeDefined();
    expect(screen.getByText(/0 of 10/)).toBeDefined();
  });

  it('renders collecting state when org_count < 10', () => {
    render(
      <BenchmarkComparisonCard
        orgScore={62}
        orgCity="Alpharetta"
        orgIndustry="Restaurant"
        benchmark={{
          city: 'Alpharetta',
          industry: 'Restaurant',
          org_count: 4,
          avg_score: 55,
          min_score: 30,
          max_score: 80,
        }}
      />,
    );
    expect(screen.getByTestId('benchmark-collecting-state')).toBeDefined();
    expect(screen.getByText(/4 of 10/)).toBeDefined();
  });

  it('renders ready state when org_count >= 10', () => {
    render(
      <BenchmarkComparisonCard
        orgScore={62}
        orgCity="Alpharetta"
        orgIndustry="Restaurant"
        benchmark={{
          city: 'Alpharetta',
          industry: 'Restaurant',
          org_count: 15,
          avg_score: 51,
          min_score: 28,
          max_score: 88,
        }}
      />,
    );
    expect(screen.getByTestId('benchmark-ready-state')).toBeDefined();
    expect(screen.getByText('62')).toBeDefined();
    expect(screen.getByText('51')).toBeDefined();
    expect(screen.getByText('15 businesses')).toBeDefined();
  });

  it('shows "above average" when org score > avg', () => {
    render(
      <BenchmarkComparisonCard
        orgScore={72}
        orgCity="Alpharetta"
        orgIndustry="Restaurant"
        benchmark={{
          city: 'Alpharetta',
          industry: 'Restaurant',
          org_count: 12,
          avg_score: 51,
          min_score: 28,
          max_score: 88,
        }}
      />,
    );
    expect(screen.getByText(/above average/)).toBeDefined();
  });

  it('shows "below average" when org score < avg', () => {
    render(
      <BenchmarkComparisonCard
        orgScore={40}
        orgCity="Alpharetta"
        orgIndustry="Restaurant"
        benchmark={{
          city: 'Alpharetta',
          industry: 'Restaurant',
          org_count: 12,
          avg_score: 55,
          min_score: 28,
          max_score: 88,
        }}
      />,
    );
    expect(screen.getByText(/below average/)).toBeDefined();
  });

  it('shows no-score state when org has no score yet but benchmark is ready', () => {
    render(
      <BenchmarkComparisonCard
        orgScore={null}
        orgCity="Alpharetta"
        orgIndustry="Restaurant"
        benchmark={{
          city: 'Alpharetta',
          industry: 'Restaurant',
          org_count: 12,
          avg_score: 55,
          min_score: 28,
          max_score: 88,
        }}
      />,
    );
    expect(screen.getByTestId('benchmark-no-score-state')).toBeDefined();
    expect(screen.getByText(/Your Reality Score will appear/)).toBeDefined();
  });

  it('shows city name in card title', () => {
    render(
      <BenchmarkComparisonCard
        orgScore={62}
        orgCity="Marietta"
        orgIndustry="Restaurant"
        benchmark={null}
      />,
    );
    expect(screen.getByText('Marietta Benchmark')).toBeDefined();
  });

  it('renders the progress bar at correct width', () => {
    render(
      <BenchmarkComparisonCard
        orgScore={50}
        orgCity="Alpharetta"
        orgIndustry="Restaurant"
        benchmark={{
          city: 'Alpharetta',
          industry: 'Restaurant',
          org_count: 5,
          avg_score: 50,
          min_score: 30,
          max_score: 70,
        }}
      />,
    );
    // 5 of 10 = 50%
    const progressBar = screen
      .getByTestId('benchmark-collecting-state')
      .querySelector('[style*="width"]');
    expect(progressBar).toBeDefined();
  });

  it('has correct data-testid for card', () => {
    render(
      <BenchmarkComparisonCard
        orgScore={62}
        orgCity="Alpharetta"
        orgIndustry="Restaurant"
        benchmark={null}
      />,
    );
    expect(screen.getByTestId('benchmark-comparison-card')).toBeDefined();
  });
});
