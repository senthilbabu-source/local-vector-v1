// ---------------------------------------------------------------------------
// __tests__/components/ScanCompleteBanner.test.tsx — P3-FIX-13
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// jsdom setup
// @vitest-environment jsdom
// ---------------------------------------------------------------------------

import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScanCompleteBanner } from '@/components/dashboard/ScanCompleteBanner';

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

beforeEach(() => {
  localStorageMock.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ScanCompleteBanner', () => {
  it('renders banner when isFirstScanRecent=true', () => {
    render(<ScanCompleteBanner isFirstScanRecent />);
    expect(screen.getByTestId('scan-complete-banner')).toBeDefined();
    expect(screen.getByText(/first AI visibility scan is complete/i)).toBeDefined();
  });

  it('renders null when isFirstScanRecent=false', () => {
    const { container } = render(<ScanCompleteBanner isFirstScanRecent={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('saves to localStorage so it only shows once', () => {
    render(<ScanCompleteBanner isFirstScanRecent />);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'lv_scan_complete_banner_shown',
      'true',
    );
  });

  it('does not render if already shown (localStorage flag)', () => {
    localStorageMock.setItem('lv_scan_complete_banner_shown', 'true');
    const { container } = render(<ScanCompleteBanner isFirstScanRecent />);
    expect(container.querySelector('[data-testid="scan-complete-banner"]')).toBeNull();
  });

  it('auto-dismisses after 8 seconds', () => {
    render(<ScanCompleteBanner isFirstScanRecent />);
    expect(screen.getByTestId('scan-complete-banner')).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(8000);
    });

    expect(screen.queryByTestId('scan-complete-banner')).toBeNull();
  });

  it('dismiss button hides the banner immediately', async () => {
    vi.useRealTimers(); // need real timers for userEvent
    render(<ScanCompleteBanner isFirstScanRecent />);
    expect(screen.getByTestId('scan-complete-banner')).toBeDefined();

    const dismissBtn = screen.getByTestId('scan-complete-banner-dismiss');
    await userEvent.click(dismissBtn);

    expect(screen.queryByTestId('scan-complete-banner')).toBeNull();
  });

  it('shows real data messaging in the banner text', () => {
    render(<ScanCompleteBanner isFirstScanRecent />);
    expect(screen.getByText(/Real data is now showing/i)).toBeDefined();
    expect(screen.getByText(/Scans run automatically every week/i)).toBeDefined();
  });
});
