// @vitest-environment jsdom
// ---------------------------------------------------------------------------
// wave2-s19-competitor-gap.test.tsx — S19: Competitor Gap Before/After
// AI_RULES §219
// ---------------------------------------------------------------------------

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import InterceptCard from '@/app/dashboard/compete/_components/InterceptCard';

vi.mock('@/app/dashboard/compete/actions', () => ({
  markInterceptActionComplete: vi.fn().mockResolvedValue({ success: true }),
}));

const BASE_INTERCEPT = {
  id: 'ic1',
  competitor_name: 'Rival Burgers',
  query_asked: 'best burger downtown',
  winner: 'Rival Burgers',
  winner_reason: 'More mentions in AI responses',
  winning_factor: 'Review volume',
  gap_analysis: { your_mentions: 3, competitor_mentions: 8 },
  gap_magnitude: 'high',
  suggested_action: 'Ask more customers for reviews',
  action_status: 'pending',
  pre_action_gap: null,
};

describe('InterceptCard — S19 before/after panel', () => {
  it('does NOT render before-after panel when status is pending', () => {
    render(<InterceptCard intercept={BASE_INTERCEPT} myBusiness="My Burger Joint" />);
    expect(screen.queryByTestId('before-after-gap')).toBeNull();
  });

  it('does NOT render before-after panel when dismissed', () => {
    render(
      <InterceptCard
        intercept={{ ...BASE_INTERCEPT, action_status: 'dismissed' }}
        myBusiness="My Burger Joint"
      />,
    );
    expect(screen.queryByTestId('before-after-gap')).toBeNull();
  });

  it('does NOT render before-after panel when completed but pre_action_gap is null', () => {
    render(
      <InterceptCard
        intercept={{ ...BASE_INTERCEPT, action_status: 'completed', pre_action_gap: null }}
        myBusiness="My Burger Joint"
      />,
    );
    expect(screen.queryByTestId('before-after-gap')).toBeNull();
  });

  it('renders before-after panel when completed with both gaps', () => {
    render(
      <InterceptCard
        intercept={{
          ...BASE_INTERCEPT,
          action_status: 'completed',
          pre_action_gap: { your_mentions: 2, competitor_mentions: 10 },
        }}
        myBusiness="My Burger Joint"
      />,
    );
    expect(screen.getByTestId('before-after-gap')).toBeTruthy();
  });

  it('shows "Before" and "After" labels in before-after panel', () => {
    render(
      <InterceptCard
        intercept={{
          ...BASE_INTERCEPT,
          action_status: 'completed',
          pre_action_gap: { your_mentions: 2, competitor_mentions: 10 },
        }}
        myBusiness="My Burger Joint"
      />,
    );
    expect(screen.getByText('Before')).toBeTruthy();
    expect(screen.getByText('After')).toBeTruthy();
  });

  it('shows "Gap before vs. after your action" heading', () => {
    render(
      <InterceptCard
        intercept={{
          ...BASE_INTERCEPT,
          action_status: 'completed',
          pre_action_gap: { your_mentions: 5, competitor_mentions: 8 },
        }}
        myBusiness="My Burger Joint"
      />,
    );
    expect(screen.getByText(/gap before vs\. after your action/i)).toBeTruthy();
  });

  it('shows suggested action only when pending', () => {
    render(<InterceptCard intercept={BASE_INTERCEPT} myBusiness="My Burger Joint" />);
    expect(screen.getByText('Ask more customers for reviews')).toBeTruthy();
  });

  it('hides suggested action when completed', () => {
    render(
      <InterceptCard
        intercept={{
          ...BASE_INTERCEPT,
          action_status: 'completed',
          pre_action_gap: { your_mentions: 2, competitor_mentions: 10 },
        }}
        myBusiness="My Burger Joint"
      />,
    );
    expect(screen.queryByText('Ask more customers for reviews')).toBeNull();
  });

  it('renders "Completed" status text when completed', () => {
    render(
      <InterceptCard
        intercept={{
          ...BASE_INTERCEPT,
          action_status: 'completed',
          pre_action_gap: null,
        }}
        myBusiness="My Burger Joint"
      />,
    );
    expect(screen.getByText('Completed')).toBeTruthy();
  });

  it('renders "Dismissed" status text when dismissed', () => {
    render(
      <InterceptCard
        intercept={{ ...BASE_INTERCEPT, action_status: 'dismissed' }}
        myBusiness="My Burger Joint"
      />,
    );
    expect(screen.getByText('Dismissed')).toBeTruthy();
  });

  it('shows Mark Complete and Dismiss buttons when pending', () => {
    render(<InterceptCard intercept={BASE_INTERCEPT} myBusiness="My Burger Joint" />);
    expect(screen.getByText('Mark Complete')).toBeTruthy();
    expect(screen.getByText('Dismiss')).toBeTruthy();
  });
});
