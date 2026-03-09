/**
 * Unit Tests — §318 GBP Cleanup + §319 OAuth Loading State
 *
 * Tests:
 *   - disconnectGBP() cleans up tokens + location_integrations + pending_gbp_imports
 *   - Sentry logging on cleanup failures
 *   - GBPConnectButton loading state (jsdom)
 *   - ConnectGBPButton loading state (jsdom)
 *
 * Run:
 *   npx vitest run src/__tests__/unit/gbp-cleanup-s318.test.tsx
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

const mockGetSafeAuthContext = vi.fn();

vi.mock('@/lib/auth', () => ({
  getSafeAuthContext: () => mockGetSafeAuthContext(),
}));

const mockServiceFrom = vi.fn();
const mockAuthFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: mockServiceFrom,
  })),
  createClient: vi.fn(async () => ({
    from: mockAuthFrom,
  })),
}));

const mockCaptureException = vi.fn();
const mockCaptureMessage = vi.fn();

vi.mock('@sentry/nextjs', () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
  captureMessage: (...args: unknown[]) => mockCaptureMessage(...args),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** For service-role tables: .delete().eq('org_id', ...) — single .eq() */
function makeServiceDeleteChain(result: { error: unknown }) {
  return {
    delete: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue(result),
    }),
  };
}

/** For auth-client tables: .delete().eq('platform', 'google') — single .eq() */
function makeAuthDeleteChain(result: { error: unknown }) {
  return {
    delete: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue(result),
    }),
  };
}

// ---------------------------------------------------------------------------
// Tests — §318 disconnectGBP cleanup
// ---------------------------------------------------------------------------

describe('§318: disconnectGBP cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSafeAuthContext.mockResolvedValue({ orgId: 'org-123', userId: 'user-1' });
  });

  it('returns Unauthorized when not authenticated', async () => {
    mockGetSafeAuthContext.mockResolvedValue(null);
    const { disconnectGBP } = await import('@/app/dashboard/integrations/actions');
    const result = await disconnectGBP();
    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('deletes tokens, location_integrations (google), and pending_gbp_imports', async () => {
    const tokenChain = makeServiceDeleteChain({ error: null });
    const pendingChain = makeServiceDeleteChain({ error: null });
    const intChain = makeAuthDeleteChain({ error: null });

    mockServiceFrom.mockImplementation((table: string) => {
      if (table === 'google_oauth_tokens') return tokenChain;
      if (table === 'pending_gbp_imports') return pendingChain;
      return { delete: vi.fn() };
    });
    mockAuthFrom.mockImplementation((table: string) => {
      if (table === 'location_integrations') return intChain;
      return { delete: vi.fn() };
    });

    const { disconnectGBP } = await import('@/app/dashboard/integrations/actions');
    const result = await disconnectGBP();

    expect(result).toEqual({ success: true });
    expect(mockServiceFrom).toHaveBeenCalledWith('google_oauth_tokens');
    expect(mockServiceFrom).toHaveBeenCalledWith('pending_gbp_imports');
    expect(mockAuthFrom).toHaveBeenCalledWith('location_integrations');
  });

  it('returns error when token delete fails', async () => {
    const tokenChain = makeServiceDeleteChain({ error: { message: 'Token DB error' } });
    mockServiceFrom.mockReturnValue(tokenChain);

    const { disconnectGBP } = await import('@/app/dashboard/integrations/actions');
    const result = await disconnectGBP();

    expect(result).toEqual({ success: false, error: 'Token DB error' });
    expect(mockCaptureException).toHaveBeenCalled();
  });

  it('succeeds even if location_integrations cleanup fails (non-fatal)', async () => {
    const tokenChain = makeServiceDeleteChain({ error: null });
    const pendingChain = makeServiceDeleteChain({ error: null });
    const intError = { message: 'integration error' };
    const intChain = makeAuthDeleteChain({ error: intError });

    mockServiceFrom.mockImplementation((table: string) => {
      if (table === 'google_oauth_tokens') return tokenChain;
      if (table === 'pending_gbp_imports') return pendingChain;
      return { delete: vi.fn() };
    });
    mockAuthFrom.mockImplementation((table: string) => {
      if (table === 'location_integrations') return intChain;
      return { delete: vi.fn() };
    });

    const { disconnectGBP } = await import('@/app/dashboard/integrations/actions');
    const result = await disconnectGBP();

    expect(result).toEqual({ success: true });
    expect(mockCaptureException).toHaveBeenCalled();
    const sentryCall = mockCaptureException.mock.calls[0];
    expect(sentryCall[0]).toEqual(intError);
    expect(sentryCall[1].tags.sprint).toBe('318');
    expect(sentryCall[1].extra.step).toBe('delete_location_integrations');
  });

  it('succeeds even if pending_gbp_imports cleanup fails (non-fatal)', async () => {
    const tokenChain = makeServiceDeleteChain({ error: null });
    const pendingError = { message: 'pending error' };
    const pendingChain = makeServiceDeleteChain({ error: pendingError });
    const intChain = makeAuthDeleteChain({ error: null });

    mockServiceFrom.mockImplementation((table: string) => {
      if (table === 'google_oauth_tokens') return tokenChain;
      if (table === 'pending_gbp_imports') return pendingChain;
      return { delete: vi.fn() };
    });
    mockAuthFrom.mockImplementation((table: string) => {
      if (table === 'location_integrations') return intChain;
      return { delete: vi.fn() };
    });

    const { disconnectGBP } = await import('@/app/dashboard/integrations/actions');
    const result = await disconnectGBP();

    expect(result).toEqual({ success: true });
    expect(mockCaptureException).toHaveBeenCalled();
    const sentryCall = mockCaptureException.mock.calls[0];
    expect(sentryCall[0]).toEqual(pendingError);
    expect(sentryCall[1].tags.sprint).toBe('318');
    expect(sentryCall[1].extra.step).toBe('delete_pending_imports');
  });
});

// ---------------------------------------------------------------------------
// Tests — §319 GBPConnectButton loading state
// ---------------------------------------------------------------------------

describe('§319: GBPConnectButton loading state', () => {
  beforeEach(() => {
    cleanup();
  });

  it('renders "Connect Google Business Profile" when not connected', async () => {
    const { render, screen } = await import('@testing-library/react');
    const { default: GBPConnectButton } = await import(
      '@/app/dashboard/integrations/_components/GBPConnectButton'
    );

    render(
      <GBPConnectButton
        configured={true}
        planAllowed={true}
        connected={false}
        googleEmail={null}
        gbpAccountName={null}
      />,
    );

    const link = screen.getByText('Connect Google Business Profile');
    expect(link).toBeDefined();
    expect(link.closest('a')).toBeDefined();
    expect(link.closest('a')?.getAttribute('href')).toBe('/api/auth/google');
  });

  it('shows "Redirecting to Google…" after click', async () => {
    const { render, screen, fireEvent } = await import('@testing-library/react');
    const { default: GBPConnectButton } = await import(
      '@/app/dashboard/integrations/_components/GBPConnectButton'
    );

    render(
      <GBPConnectButton
        configured={true}
        planAllowed={true}
        connected={false}
        googleEmail={null}
        gbpAccountName={null}
      />,
    );

    const link = screen.getByText('Connect Google Business Profile');
    fireEvent.click(link);

    expect(screen.getByText('Redirecting to Google…')).toBeDefined();
  });

  it('renders connected state with disconnect button', async () => {
    const { render, screen } = await import('@testing-library/react');
    const { default: GBPConnectButton } = await import(
      '@/app/dashboard/integrations/_components/GBPConnectButton'
    );

    render(
      <GBPConnectButton
        configured={true}
        planAllowed={true}
        connected={true}
        googleEmail="test@gmail.com"
        gbpAccountName="accounts/123"
      />,
    );

    expect(screen.getByText('Connected')).toBeDefined();
    expect(screen.getByText('test@gmail.com')).toBeDefined();
    expect(screen.getByText('Disconnect')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Tests — §319 ConnectGBPButton (onboarding) loading state
// ---------------------------------------------------------------------------

describe('§319: ConnectGBPButton (onboarding) loading state', () => {
  beforeEach(() => {
    cleanup();
  });

  it('renders "Sign in with Google" initially', async () => {
    const { render, screen } = await import('@testing-library/react');
    const { default: ConnectGBPButton } = await import(
      '@/app/onboarding/connect/_components/ConnectGBPButton'
    );

    render(<ConnectGBPButton />);

    const link = screen.getByText('Sign in with Google');
    expect(link).toBeDefined();
    expect(link.closest('a')?.getAttribute('href')).toBe('/api/auth/google?source=onboarding');
  });

  it('shows "Redirecting to Google…" after click', async () => {
    const { render, screen, fireEvent } = await import('@testing-library/react');
    const { default: ConnectGBPButton } = await import(
      '@/app/onboarding/connect/_components/ConnectGBPButton'
    );

    render(<ConnectGBPButton />);

    const link = screen.getByText('Sign in with Google');
    fireEvent.click(link);

    expect(screen.getByText('Redirecting to Google…')).toBeDefined();
  });
});
