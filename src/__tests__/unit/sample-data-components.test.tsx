// @vitest-environment jsdom
// ---------------------------------------------------------------------------
// src/__tests__/unit/sample-data-components.test.tsx — Sprint L
//
// Component smoke tests for SampleDataBadge and SampleModeBanner.
// Separated from sample-data-mode.test.ts (pure-function tests) because
// these require jsdom for DOM rendering via @testing-library/react.
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SampleDataBadge } from '@/components/ui/SampleDataBadge';
import { SampleModeBanner } from '@/components/ui/SampleModeBanner';

// ---------------------------------------------------------------------------
// SampleDataBadge
// ---------------------------------------------------------------------------

describe('SampleDataBadge', () => {
  it('renders data-testid="sample-data-badge"', () => {
    render(<SampleDataBadge />);
    expect(screen.getByTestId('sample-data-badge')).toBeDefined();
  });

  it('text contains "Sample Data"', () => {
    render(<SampleDataBadge />);
    expect(screen.getByText(/sample data/i)).toBeDefined();
  });

  it('has pointer-events-none class', () => {
    render(<SampleDataBadge />);
    const badge = screen.getByTestId('sample-data-badge');
    expect(badge.className).toContain('pointer-events-none');
  });
});

// ---------------------------------------------------------------------------
// SampleModeBanner
// ---------------------------------------------------------------------------

describe('SampleModeBanner', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('renders data-testid="sample-mode-banner" with role="status"', () => {
    render(<SampleModeBanner nextScanDate="March 15, 2026" />);
    const banner = screen.getByTestId('sample-mode-banner');
    expect(banner).toBeDefined();
    expect(banner.getAttribute('role')).toBe('status');
  });

  it('dismiss button stores in sessionStorage', () => {
    render(<SampleModeBanner nextScanDate="March 15, 2026" />);
    const dismissBtn = screen.getByTestId('sample-banner-dismiss');
    fireEvent.click(dismissBtn);
    expect(sessionStorage.getItem('lv_sample_banner_dismissed')).toBe('true');
  });

  it('renders nextScanDate prop text', () => {
    render(<SampleModeBanner nextScanDate="March 15, 2026" />);
    expect(screen.getByText('March 15, 2026')).toBeDefined();
  });
});
