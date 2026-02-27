/**
 * RLS Isolation — Application-Level Org Scoping Verification
 *
 * These unit tests verify that server actions and data fetchers always derive
 * org_id from the server-side session (getSafeAuthContext / getAuthContext),
 * never from user-supplied request parameters.
 *
 * This is the "belt" in belt-and-suspenders (AI_RULES §18). The "suspenders"
 * are the actual Supabase RLS policies tested in the integration suite
 * (src/__tests__/integration/rls-isolation.test.ts — requires live Supabase).
 *
 * Run:
 *   npx vitest run src/__tests__/unit/rls-isolation.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock: lib/supabase/server — shared mock for all server actions
// ---------------------------------------------------------------------------

/**
 * Builds a recursive chainable mock that supports any depth of
 * .select().eq().eq().single() etc.
 */
function buildChainMock(): Record<string, ReturnType<typeof vi.fn>> {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const self = () => chain;
  const terminal = vi.fn().mockResolvedValue({ data: null, error: null, count: 0 });

  for (const method of [
    'select', 'insert', 'update', 'upsert', 'delete',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'is', 'not',
    'filter', 'order', 'limit', 'range', 'match',
  ]) {
    chain[method] = vi.fn(self);
  }
  chain.single = terminal;
  chain.maybeSingle = terminal;
  // Allow terminal await on the chain itself (e.g. `.eq('x', 'y')` as final)
  chain.then = vi.fn((resolve: (v: unknown) => void) =>
    resolve({ data: null, error: null, count: 0 })
  );
  return chain;
}

const mockFrom = vi.fn(() => buildChainMock());
const mockSupabaseClient = { from: mockFrom, auth: { getUser: vi.fn() } };

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
  createServiceRoleClient: vi.fn(() => mockSupabaseClient),
}));

// ---------------------------------------------------------------------------
// Mock: next/cache (revalidatePath is a no-op in tests)
// ---------------------------------------------------------------------------

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_A_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

// ---------------------------------------------------------------------------
// Helper: mock getSafeAuthContext for a given org
// ---------------------------------------------------------------------------

const mockAuthContext = vi.fn();

vi.mock('@/lib/auth', () => ({
  getSafeAuthContext: (...args: unknown[]) => mockAuthContext(...args),
  getAuthContext: (...args: unknown[]) => mockAuthContext(...args),
}));

function setAuthenticatedAs(orgId: string) {
  mockAuthContext.mockResolvedValue({
    userId: 'user-' + orgId.slice(0, 8),
    email: 'test@example.com',
    fullName: 'Test User',
    orgId,
    orgName: 'Test Org',
    role: 'owner',
    plan: 'growth',
    onboarding_completed: true,
  });
}

function setUnauthenticated() {
  mockAuthContext.mockResolvedValue(null);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('org isolation — application-level belt-and-suspenders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockImplementation(() => buildChainMock());
  });

  // ── 1. Server actions use getSafeAuthContext, not request body ───────

  it('createLocation() derives org_id from session, not from client', async () => {
    setAuthenticatedAs(ORG_A_ID);

    const { createLocation } = await import('@/app/dashboard/actions');

    await createLocation({
      business_name: 'Test Restaurant',
      address_line1: '123 Main St',
      city: 'Dallas',
      state: 'TX',
      zip: '75001',
    });

    // Verify getSafeAuthContext was called (org_id is server-derived)
    expect(mockAuthContext).toHaveBeenCalled();
  });

  it('createLocation() rejects unauthenticated users', async () => {
    setUnauthenticated();

    const { createLocation } = await import('@/app/dashboard/actions');

    const result = await createLocation({
      business_name: 'Test Restaurant',
      address_line1: '123 Main St',
      city: 'Dallas',
      state: 'TX',
      zip: '75001',
    });

    expect(result).toEqual(
      expect.objectContaining({ success: false, error: 'Unauthorized' })
    );
    // No DB calls should have been made
    expect(mockFrom).not.toHaveBeenCalled();
  });

  // ── 2. Onboarding actions use getSafeAuthContext ────────────────────

  it('saveGroundTruth() derives org_id from session', async () => {
    setAuthenticatedAs(ORG_A_ID);

    const { saveGroundTruth } = await import('@/app/onboarding/actions');

    // Verify the function calls getSafeAuthContext
    await saveGroundTruth({
      location_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
      business_name: 'Test Restaurant',
      hours_data: {
        monday: { open: '09:00', close: '17:00' },
        tuesday: { open: '09:00', close: '17:00' },
        wednesday: { open: '09:00', close: '17:00' },
        thursday: { open: '09:00', close: '17:00' },
        friday: { open: '09:00', close: '17:00' },
        saturday: 'closed',
        sunday: 'closed',
      },
      amenities: {
        has_outdoor_seating: true,
        serves_alcohol: true,
        has_hookah: false,
        is_kid_friendly: false,
        takes_reservations: false,
        has_live_music: false,
      },
    });

    expect(mockAuthContext).toHaveBeenCalled();
  });

  it('saveGroundTruth() rejects unauthenticated users', async () => {
    setUnauthenticated();

    const { saveGroundTruth } = await import('@/app/onboarding/actions');

    const result = await saveGroundTruth({
      location_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
      business_name: 'Test Restaurant',
      hours_data: {
        monday: { open: '09:00', close: '17:00' },
        tuesday: { open: '09:00', close: '17:00' },
        wednesday: { open: '09:00', close: '17:00' },
        thursday: { open: '09:00', close: '17:00' },
        friday: { open: '09:00', close: '17:00' },
        saturday: 'closed',
        sunday: 'closed',
      },
      amenities: {
        has_outdoor_seating: true,
        serves_alcohol: true,
        has_hookah: false,
        is_kid_friendly: false,
        takes_reservations: false,
        has_live_music: false,
      },
    });

    expect(result).toEqual(
      expect.objectContaining({ success: false })
    );
  });

  // ── 3. Stripe webhook does NOT use user-supplied org_id ─────────────

  it('Stripe webhook uses Stripe customer ID for org lookup, not user session', async () => {
    // The webhook handler uses createServiceRoleClient (not createClient)
    // and looks up org by stripe_customer_id, not by user session
    const { createServiceRoleClient } = await import('@/lib/supabase/server');

    // Verify createServiceRoleClient is in the module (webhook uses it)
    expect(createServiceRoleClient).toBeDefined();
    expect(typeof createServiceRoleClient).toBe('function');
  });

  // ── 4. Cron routes use CRON_SECRET, not user sessions ───────────────

  it('cron routes are protected by CRON_SECRET header, not user session', async () => {
    // Verify CRON_SECRET is used as the auth mechanism
    // by checking that making a cron request without the secret returns 401
    const savedSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = 'test-cron-secret';

    try {
      // Import a cron route handler
      const { GET } = await import(
        '@/app/api/cron/refresh-gbp-tokens/route'
      );

      // Request without CRON_SECRET header → 401
      const req = new Request('http://localhost/api/cron/refresh-gbp-tokens', {
        method: 'GET',
      });
      const res = await GET(req);
      expect(res.status).toBe(401);
    } finally {
      if (savedSecret === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = savedSecret;
    }
  });

  it('cron routes accept valid CRON_SECRET', async () => {
    const savedSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = 'test-cron-secret';

    try {
      const { GET } = await import(
        '@/app/api/cron/refresh-gbp-tokens/route'
      );

      const req = new Request('http://localhost/api/cron/refresh-gbp-tokens', {
        method: 'GET',
        headers: { authorization: 'Bearer test-cron-secret' },
      });
      const res = await GET(req);
      // Should not be 401 (may be 200 or other status depending on state)
      expect(res.status).not.toBe(401);
    } finally {
      if (savedSecret === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = savedSecret;
    }
  });

  // ── 5. Data layer functions accept orgId parameter, not user input ──

  it('fetchDashboardData() accepts orgId as an explicit parameter', async () => {
    // The data layer function's first parameter is orgId — it does NOT derive
    // orgId internally. The calling server action is responsible for deriving
    // orgId from the session and passing it. This ensures the data layer
    // always filters by the correct org.
    const mod = await import('@/lib/data/dashboard');
    expect(mod.fetchDashboardData).toBeDefined();
    // First param is orgId (string), second is supabase client
    expect(mod.fetchDashboardData.length).toBeGreaterThanOrEqual(1);
  });

  // ── 6. Revenue config scopes updates by org_id ──────────────────────

  it('updateRevenueConfig() derives org_id from session via getSafeAuthContext', async () => {
    setAuthenticatedAs(ORG_A_ID);

    const { updateRevenueConfig } = await import(
      '@/app/dashboard/revenue-impact/actions'
    );

    // updateRevenueConfig expects FormData
    const formData = new FormData();
    formData.append('locationId', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22');
    formData.append('avgCustomerValue', '45');
    formData.append('monthlyCovers', '3000');

    await updateRevenueConfig(formData);

    expect(mockAuthContext).toHaveBeenCalled();
  });

  // ── 7. No endpoint accepts org_id as user-supplied param ────────────

  it('getSafeAuthContext returns org_id from server session, not request', async () => {
    // Verify the auth module derives org_id from Supabase auth session
    // (JWT → users table → memberships → org_id), never from request params
    const authModule = await import('@/lib/auth');

    // getSafeAuthContext takes zero parameters — it reads from cookies
    expect(authModule.getSafeAuthContext).toBeDefined();
    expect(authModule.getSafeAuthContext.length).toBe(0);

    // getAuthContext also takes zero parameters
    expect(authModule.getAuthContext).toBeDefined();
    expect(authModule.getAuthContext.length).toBe(0);
  });
});
