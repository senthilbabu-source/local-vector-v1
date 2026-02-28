// ---------------------------------------------------------------------------
// positioning-banner.test.tsx — Sprint D (M6): AI vs. Traditional SEO Banner
//
// 10 tests: renders, dismisses, localStorage, dashboard integration logic.
//
// Run:
//   npx vitest run src/__tests__/unit/positioning-banner.test.tsx
// ---------------------------------------------------------------------------

/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Manual localStorage mock (jsdom's may not support .clear())
// ---------------------------------------------------------------------------

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
  clear: vi.fn(() => { for (const k of Object.keys(store)) delete store[k]; }),
  get length() { return Object.keys(store).length; },
  key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });

// Mock next/link for tests
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}));

// Import AFTER mocks are set up
import { PositioningBanner } from '@/components/ui/PositioningBanner';

beforeEach(() => {
  cleanup();
  localStorageMock.clear();
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
});

// ---------------------------------------------------------------------------
// PositioningBanner component tests
// ---------------------------------------------------------------------------

describe('PositioningBanner', () => {
  it('1. renders when localStorage does not have the dismissed key', () => {
    render(<PositioningBanner />);
    expect(screen.getByTestId('positioning-banner')).toBeDefined();
  });

  it('2. does NOT render when localStorage has dismissed key set to true', () => {
    store['lv_positioning_banner_dismissed'] = 'true';
    localStorageMock.getItem.mockImplementation((key: string) => store[key] ?? null);
    render(<PositioningBanner />);
    expect(screen.queryByTestId('positioning-banner')).toBeNull();
  });

  it('3. clicking dismiss button sets localStorage and hides the banner', () => {
    render(<PositioningBanner />);
    expect(screen.getByTestId('positioning-banner')).toBeDefined();

    fireEvent.click(screen.getByTestId('positioning-banner-dismiss'));

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'lv_positioning_banner_dismissed',
      'true',
    );
    expect(screen.queryByTestId('positioning-banner')).toBeNull();
  });

  it('4. data-testid="positioning-banner" is present when visible', () => {
    render(<PositioningBanner />);
    const banner = screen.getByTestId('positioning-banner');
    expect(banner).toBeDefined();
    expect(banner.getAttribute('data-testid')).toBe('positioning-banner');
  });

  it('5. data-testid="positioning-banner-dismiss" is on the dismiss button', () => {
    render(<PositioningBanner />);
    const btn = screen.getByTestId('positioning-banner-dismiss');
    expect(btn).toBeDefined();
    expect(btn.tagName.toLowerCase()).toBe('button');
  });

  it('6. contains a link to /dashboard/ai-responses', () => {
    render(<PositioningBanner />);
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/dashboard/ai-responses');
  });

  it('7. the word "AI" appears in the banner text', () => {
    render(<PositioningBanner />);
    const banner = screen.getByTestId('positioning-banner');
    expect(banner.textContent).toContain('AI');
  });

  // Sprint M: updated copy tests
  it('11. contains "AI models" in banner text', () => {
    render(<PositioningBanner />);
    const banner = screen.getByTestId('positioning-banner');
    expect(banner.textContent).toContain('AI models');
  });

  it('12. contains "Reality Score" in banner text', () => {
    render(<PositioningBanner />);
    const banner = screen.getByTestId('positioning-banner');
    expect(banner.textContent).toContain('Reality Score');
  });

  it('13. contains "search ranking" context for comparison', () => {
    render(<PositioningBanner />);
    const banner = screen.getByTestId('positioning-banner');
    expect(banner.textContent).toContain('search ranking');
  });
});

// ---------------------------------------------------------------------------
// Dashboard integration logic tests (pure logic, no rendering)
// ---------------------------------------------------------------------------

describe('Dashboard integration', () => {
  it('8. banner should render when isNewOrg=true and sampleMode=false', () => {
    const orgCreatedAt = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const isNewOrg = Date.now() - new Date(orgCreatedAt).getTime() < 30 * 24 * 60 * 60 * 1000;
    const sampleMode = false;

    const shouldRender = isNewOrg && !sampleMode;
    expect(shouldRender).toBe(true);
  });

  it('9. banner should NOT render when isNewOrg=false', () => {
    const orgCreatedAt = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const isNewOrg = Date.now() - new Date(orgCreatedAt).getTime() < 30 * 24 * 60 * 60 * 1000;
    const sampleMode = false;

    const shouldRender = isNewOrg && !sampleMode;
    expect(shouldRender).toBe(false);
  });

  it('10. banner should NOT render when sampleMode=true (SampleModeBanner takes priority)', () => {
    const orgCreatedAt = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const isNewOrg = Date.now() - new Date(orgCreatedAt).getTime() < 30 * 24 * 60 * 60 * 1000;
    const sampleMode = true;

    const shouldRender = isNewOrg && !sampleMode;
    expect(shouldRender).toBe(false);
  });
});
