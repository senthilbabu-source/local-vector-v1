/**
 * DashboardLayout — Onboarding Guard Tests
 *
 * Tests the server-component routing logic (no DOM rendering needed):
 *   Auth Guard     — null context → redirect('/login')
 *   Guard skip     — null orgId (org DB trigger not yet fired) → skip location query, no redirect
 *   Guard trigger  — primaryLocation with null hours_data AND null amenities → redirect('/onboarding')
 *   Guard bypass   — hours_data set, amenities set, or location=null → no redirect
 *   Render props   — displayName, orgName, plan, children forwarded to DashboardShell
 *
 * Project rules honoured:
 *   ZERO LIVE APIS  — getSafeAuthContext + createClient fully mocked (rule 1)
 *   UUID CONSTRAINT — all UUIDs use hex chars only (rule 2)
 *   RLS SHADOWBAN   — org_id comes from getSafeAuthContext() server-side (rule 3)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';

// ---------------------------------------------------------------------------
// Hoisted mocks — evaluated at the same time as vi.mock() (before imports)
// ---------------------------------------------------------------------------

// redirect() in Next.js throws a NEXT_REDIRECT error — replicate that here
// so tests can use rejects.toThrow() for clean assertions.
const mockRedirect = vi.hoisted(() =>
  vi.fn().mockImplementation((path: string) => {
    throw Object.assign(new Error(`NEXT_REDIRECT:${path}`), {
      digest: `NEXT_REDIRECT;replace;${path};303;`,
    });
  }),
);

const mockGetSafeAuthContext = vi.hoisted(() => vi.fn());
const mockCreateClient       = vi.hoisted(() => vi.fn());

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('next/navigation',          () => ({ redirect: mockRedirect }));
vi.mock('@/lib/auth',               () => ({ getSafeAuthContext: mockGetSafeAuthContext }));
vi.mock('@/lib/supabase/server',    () => ({ createClient: mockCreateClient }));
vi.mock('next/headers',             () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(undefined),
  }),
}));

// DashboardShell is a client component; mock it so the server component can
// render in Node without jsdom and so we can inspect the props it receives.
vi.mock('@/components/layout/DashboardShell', () => ({
  default: ({
    children,
    displayName,
    orgName,
    plan,
  }: {
    children: React.ReactNode;
    displayName: string;
    orgName: string;
    plan: string | null;
  }) =>
    React.createElement(
      'div',
      { 'data-testid': 'dashboard-shell', 'data-display-name': displayName },
      children,
    ),
}));

// ---------------------------------------------------------------------------
// Import component AFTER mocks
// ---------------------------------------------------------------------------

import DashboardLayout from '@/app/dashboard/layout';
import type { SafeAuthContext } from '@/lib/auth';

/** Props that DashboardShell receives — used to type-assert returned elements. */
interface ShellProps {
  displayName: string;
  orgName: string;
  plan: string | null;
  children: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Fixtures — UUIDs use hex chars only (rule 2)
// ---------------------------------------------------------------------------

const ORG_ID  = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const USER_ID = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11';

const BASE_CTX: SafeAuthContext = {
  userId:               USER_ID,
  email:                'owner@charcoal.test',
  fullName:             'Jane Doe',
  orgId:                ORG_ID,
  orgName:              'Charcoal N Chill',
  role:                 'owner',
  plan:                 'growth',
  onboarding_completed: false,
};

// ---------------------------------------------------------------------------
// Supabase mock factory
// Mocks the chain: .from().select().eq().eq().maybeSingle()
// ---------------------------------------------------------------------------

function setupLocationMock(
  location: { hours_data: unknown; amenities: unknown } | null,
) {
  // Onboarding guard chain: .select('hours_data, amenities').eq().eq().maybeSingle()
  const maybeSingle = vi.fn().mockResolvedValue({ data: location });
  const eq2         = vi.fn().mockReturnValue({ maybeSingle });
  const eq1Guard    = vi.fn().mockReturnValue({ eq: eq2 });

  // Locations fetch chain: .select('id, ...').eq().order()
  const order       = vi.fn().mockResolvedValue({ data: [] });
  const eq1Loc      = vi.fn().mockReturnValue({ order });

  // select() returns different chains on first vs second call
  const select = vi.fn()
    .mockReturnValueOnce({ eq: eq1Guard })   // 1st: onboarding guard
    .mockReturnValueOnce({ eq: eq1Loc });    // 2nd: locations fetch

  const from = vi.fn().mockReturnValue({ select });

  // Both createClient calls share the same mock client
  mockCreateClient.mockResolvedValue({ from });
  return { from, maybeSingle };
}

// ---------------------------------------------------------------------------
// Auth Guard
// ---------------------------------------------------------------------------

describe('DashboardLayout — Auth Guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to /login when getSafeAuthContext returns null (unauthenticated)', async () => {
    mockGetSafeAuthContext.mockResolvedValue(null);
    await expect(DashboardLayout({ children: null })).rejects.toThrow('NEXT_REDIRECT:/login');
    expect(mockRedirect).toHaveBeenCalledWith('/login');
    expect(mockRedirect).toHaveBeenCalledTimes(1);
  });

  it('does NOT call redirect to /login when a valid context is present', async () => {
    mockGetSafeAuthContext.mockResolvedValue(BASE_CTX);
    setupLocationMock({ hours_data: { monday: { open: '09:00', close: '21:00' } }, amenities: null });
    await DashboardLayout({ children: null });
    expect(mockRedirect).not.toHaveBeenCalledWith('/login');
  });
});

// ---------------------------------------------------------------------------
// Onboarding Guard
// ---------------------------------------------------------------------------

describe('DashboardLayout — Onboarding Guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to /onboarding when primary location has null hours_data AND null amenities', async () => {
    mockGetSafeAuthContext.mockResolvedValue(BASE_CTX);
    setupLocationMock({ hours_data: null, amenities: null });
    await expect(DashboardLayout({ children: null })).rejects.toThrow('NEXT_REDIRECT:/onboarding');
    expect(mockRedirect).toHaveBeenCalledWith('/onboarding');
  });

  it('does NOT redirect when primary location is null (no locations created yet)', async () => {
    mockGetSafeAuthContext.mockResolvedValue(BASE_CTX);
    setupLocationMock(null);
    await DashboardLayout({ children: null });
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('does NOT redirect when primary location has hours_data configured (amenities still null)', async () => {
    mockGetSafeAuthContext.mockResolvedValue(BASE_CTX);
    setupLocationMock({ hours_data: { monday: { open: '09:00', close: '21:00' } }, amenities: null });
    await DashboardLayout({ children: null });
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('does NOT redirect when primary location has amenities configured (hours_data still null)', async () => {
    mockGetSafeAuthContext.mockResolvedValue(BASE_CTX);
    setupLocationMock({ hours_data: null, amenities: { serves_alcohol: true } });
    await DashboardLayout({ children: null });
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('does NOT redirect when primary location has both columns fully configured', async () => {
    mockGetSafeAuthContext.mockResolvedValue(BASE_CTX);
    setupLocationMock({
      hours_data: { monday: { open: '09:00', close: '21:00' } },
      amenities:  { serves_alcohol: false },
    });
    await DashboardLayout({ children: null });
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('skips location query entirely when ctx.orgId is null (org DB trigger not yet fired)', async () => {
    const ctxNoOrg: SafeAuthContext = {
      ...BASE_CTX,
      orgId:   null,
      orgName: null,
      role:    null,
      plan:    null,
    };
    mockGetSafeAuthContext.mockResolvedValue(ctxNoOrg);
    await DashboardLayout({ children: null });
    // createClient must NOT be called — guard is gated on ctx.orgId being truthy
    expect(mockCreateClient).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('queries the locations table using org_id from server context (not client payload — rule 3)', async () => {
    mockGetSafeAuthContext.mockResolvedValue(BASE_CTX);
    const { from } = setupLocationMock({ hours_data: { monday: '09:00' }, amenities: null });
    await DashboardLayout({ children: null });
    // Confirms .from('locations') was the target table
    expect(from).toHaveBeenCalledWith('locations');
  });
});

// ---------------------------------------------------------------------------
// Render Props — DashboardShell receives correct props
// ---------------------------------------------------------------------------

describe('DashboardLayout — Render Props', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // All render tests use a configured location so the guard doesn't fire
    setupLocationMock({ hours_data: { monday: { open: '09:00', close: '21:00' } }, amenities: null });
  });

  it('passes ctx.fullName as displayName to DashboardShell', async () => {
    mockGetSafeAuthContext.mockResolvedValue(BASE_CTX);
    const el = (await DashboardLayout({ children: null })) as React.ReactElement<ShellProps>;
    expect(el.props.displayName).toBe('Jane Doe');
  });

  it('falls back to email prefix when fullName is null (splits on "@")', async () => {
    mockGetSafeAuthContext.mockResolvedValue({
      ...BASE_CTX,
      fullName: null,
      email:    'jane@example.com',
    });
    const el = (await DashboardLayout({ children: null })) as React.ReactElement<ShellProps>;
    expect(el.props.displayName).toBe('jane');
  });

  it('passes ctx.orgName as orgName to DashboardShell', async () => {
    mockGetSafeAuthContext.mockResolvedValue(BASE_CTX);
    const el = (await DashboardLayout({ children: null })) as React.ReactElement<ShellProps>;
    expect(el.props.orgName).toBe('Charcoal N Chill');
  });

  it('falls back to "Your Organization" when ctx.orgName is null', async () => {
    mockGetSafeAuthContext.mockResolvedValue({ ...BASE_CTX, orgName: null });
    const el = (await DashboardLayout({ children: null })) as React.ReactElement<ShellProps>;
    expect(el.props.orgName).toBe('Your Organization');
  });

  it('passes ctx.plan to DashboardShell', async () => {
    mockGetSafeAuthContext.mockResolvedValue(BASE_CTX);
    const el = (await DashboardLayout({ children: null })) as React.ReactElement<ShellProps>;
    expect(el.props.plan).toBe('growth');
  });

  it('passes null for plan when ctx.plan is null', async () => {
    mockGetSafeAuthContext.mockResolvedValue({ ...BASE_CTX, plan: null });
    const el = (await DashboardLayout({ children: null })) as React.ReactElement<ShellProps>;
    expect(el.props.plan).toBeNull();
  });

  it('passes children through to DashboardShell', async () => {
    mockGetSafeAuthContext.mockResolvedValue(BASE_CTX);
    const child = React.createElement('p', { 'data-testid': 'page-content' }, 'Dashboard');
    const el = (await DashboardLayout({ children: child })) as React.ReactElement<ShellProps>;
    expect(el.props.children).toBe(child);
  });
});
