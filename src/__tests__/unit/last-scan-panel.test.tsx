// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

import LastScanPanel from '@/app/dashboard/_components/panels/LastScanPanel';

describe('LastScanPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-28T12:00:00Z'));
  });

  it('when lastScanAt is null: shows "No scans yet" and next Sunday text', () => {
    render(<LastScanPanel lastScanAt={null} />);
    expect(screen.getByTestId('last-scan-time').textContent).toContain('No scans yet');
    expect(screen.getByTestId('next-scan-time').textContent).toContain('First scan runs Sunday');
  });

  it('when lastScanAt is 2 days ago: shows relative text', () => {
    const twoDaysAgo = new Date('2026-02-26T12:00:00Z').toISOString();
    render(<LastScanPanel lastScanAt={twoDaysAgo} />);
    expect(screen.getByTestId('last-scan-time').textContent).toContain('2 days ago');
  });

  it('when lastScanAt is 10 days ago: shows formatted date', () => {
    const tenDaysAgo = new Date('2026-02-18T06:14:00Z').toISOString();
    render(<LastScanPanel lastScanAt={tenDaysAgo} />);
    // formatRelativeTime returns "Feb 18" for > 7 days
    expect(screen.getByTestId('last-scan-time').textContent).toContain('Feb 18');
  });

  it('when lastScanAt is > 14 days ago: shows warning badge', () => {
    const old = new Date('2026-02-10T06:14:00Z').toISOString();
    render(<LastScanPanel lastScanAt={old} />);
    expect(screen.getByTestId('last-scan-warning')).toBeDefined();
  });

  it('"Next scan in X days" computed from lastScanAt + 7 days', () => {
    const fiveDaysAgo = new Date('2026-02-23T12:00:00Z').toISOString();
    render(<LastScanPanel lastScanAt={fiveDaysAgo} />);
    // 7 - 5 = 2 days until next scan
    expect(screen.getByTestId('next-scan-time').textContent).toContain('Next scan in 2 days');
  });

  it('does not show warning badge for recent scans', () => {
    const recent = new Date('2026-02-27T12:00:00Z').toISOString();
    render(<LastScanPanel lastScanAt={recent} />);
    expect(screen.queryByTestId('last-scan-warning')).toBeNull();
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});
