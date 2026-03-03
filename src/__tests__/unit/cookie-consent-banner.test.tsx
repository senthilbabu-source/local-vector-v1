/**
 * Unit Tests — Cookie Consent Banner (P6-FIX-26)
 *
 * @vitest-environment jsdom
 *
 * Run:
 *   npx vitest run src/__tests__/unit/cookie-consent-banner.test.tsx
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

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

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// Import AFTER mocks are set up
import CookieConsentBanner from '@/components/ui/CookieConsentBanner';

describe('CookieConsentBanner (P6-FIX-26)', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('renders when localStorage key not set', () => {
    render(<CookieConsentBanner />);
    expect(screen.getByTestId('cookie-consent-banner')).toBeDefined();
  });

  it('does not render when localStorage key is already set', () => {
    store['lv_cookie_consent'] = 'accepted';
    localStorageMock.getItem.mockImplementation((key: string) => store[key] ?? null);
    render(<CookieConsentBanner />);
    expect(screen.queryByTestId('cookie-consent-banner')).toBeNull();
  });

  it('sets localStorage key and hides when dismissed', () => {
    render(<CookieConsentBanner />);
    fireEvent.click(screen.getByTestId('cookie-consent-dismiss'));
    expect(localStorageMock.setItem).toHaveBeenCalledWith('lv_cookie_consent', 'accepted');
    expect(screen.queryByTestId('cookie-consent-banner')).toBeNull();
  });

  it('has role=dialog for accessibility', () => {
    render(<CookieConsentBanner />);
    const banner = screen.getByTestId('cookie-consent-banner');
    expect(banner.getAttribute('role')).toBe('dialog');
  });

  it('has aria-label for accessibility', () => {
    render(<CookieConsentBanner />);
    const banner = screen.getByTestId('cookie-consent-banner');
    expect(banner.getAttribute('aria-label')).toBe('Cookie consent');
  });

  it('links to /privacy page', () => {
    render(<CookieConsentBanner />);
    const link = screen.getByText('Privacy Policy');
    expect(link.getAttribute('href')).toBe('/privacy');
  });

  it('mentions essential cookies in the text', () => {
    render(<CookieConsentBanner />);
    expect(screen.getByText(/essential cookies/i)).toBeDefined();
  });

  it('has a "Got it" dismiss button', () => {
    render(<CookieConsentBanner />);
    expect(screen.getByText('Got it')).toBeDefined();
  });
});
