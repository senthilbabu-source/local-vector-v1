// @vitest-environment jsdom
// ---------------------------------------------------------------------------
// wave2-s18-nap-chip.test.tsx — S18: Business Info Accuracy 5th KPI chip
// AI_RULES §218
// ---------------------------------------------------------------------------

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import WeeklyKPIChips from '@/app/dashboard/_components/WeeklyKPIChips';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// ---------------------------------------------------------------------------
// NAP chip derivation via rendered component
// ---------------------------------------------------------------------------

describe('WeeklyKPIChips — 5th chip (Business Info Accuracy)', () => {
  // Use non-null visibilityScore so only the NAP chip shows "Pending"
  const defaultProps = {
    openAlertCount: 0,
    visibilityScore: 75,
    crawlerSummary: null,
    revenueRecoveredMonthly: 0,
  };

  it('renders 5 chips total', () => {
    render(<WeeklyKPIChips {...defaultProps} napScore={80} />);
    const chips = screen.getAllByRole('listitem');
    expect(chips).toHaveLength(5);
  });

  it('shows "Pending" when napScore is null', () => {
    render(<WeeklyKPIChips {...defaultProps} napScore={null} />);
    expect(screen.getByText('Pending')).toBeTruthy();
  });

  it('shows score/100 and "Listings consistent" when napScore >= 80', () => {
    render(<WeeklyKPIChips {...defaultProps} napScore={85} />);
    expect(screen.getByText('85/100')).toBeTruthy();
    expect(screen.getByText('Listings consistent')).toBeTruthy();
  });

  it('shows "Some mismatches" when 50 <= napScore < 80', () => {
    render(<WeeklyKPIChips {...defaultProps} napScore={65} />);
    expect(screen.getByText('65/100')).toBeTruthy();
    expect(screen.getByText('Some mismatches')).toBeTruthy();
  });

  it('shows "Fix listing errors" when napScore < 50', () => {
    render(<WeeklyKPIChips {...defaultProps} napScore={30} />);
    expect(screen.getByText('30/100')).toBeTruthy();
    expect(screen.getByText('Fix listing errors')).toBeTruthy();
  });

  it('NAP chip links to /dashboard/integrations', () => {
    render(<WeeklyKPIChips {...defaultProps} napScore={90} />);
    const links = screen.getAllByRole('listitem');
    const napLink = links.find((el) => el.textContent?.includes('Business Info Accuracy'));
    expect(napLink).toBeTruthy();
    // The link ancestor should point to integrations
    const anchor = napLink?.closest('a');
    expect(anchor?.getAttribute('href')).toBe('/dashboard/integrations');
  });

  it('renders 4 chips when napScore is omitted (defaults to null)', () => {
    // napScore defaults to null, 5th chip shows "Pending"
    render(<WeeklyKPIChips {...defaultProps} />);
    const chips = screen.getAllByRole('listitem');
    expect(chips).toHaveLength(5);
    expect(screen.getByText('Pending')).toBeTruthy();
  });

  it('shows "Business Info Accuracy" label', () => {
    render(<WeeklyKPIChips {...defaultProps} napScore={75} />);
    expect(screen.getByText('Business Info Accuracy')).toBeTruthy();
  });

  it('boundary: napScore=80 is good', () => {
    render(<WeeklyKPIChips {...defaultProps} napScore={80} />);
    expect(screen.getByText('Listings consistent')).toBeTruthy();
  });

  it('boundary: napScore=50 is warn', () => {
    render(<WeeklyKPIChips {...defaultProps} napScore={50} />);
    expect(screen.getByText('Some mismatches')).toBeTruthy();
  });

  it('boundary: napScore=49 is bad', () => {
    render(<WeeklyKPIChips {...defaultProps} napScore={49} />);
    expect(screen.getByText('Fix listing errors')).toBeTruthy();
  });
});
