// ---------------------------------------------------------------------------
// gbp-import-action.test.ts — Unit tests for importGBPLocation server action
//
// Sprint 89: 9 tests — mocks auth, cookies, Supabase, SOV seeder.
//
// Run:
//   npx vitest run src/__tests__/unit/gbp-import-action.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetSafeAuthContext = vi.fn();
vi.mock('@/lib/auth', () => ({
  getSafeAuthContext: () => mockGetSafeAuthContext(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

const mockCookieGet = vi.fn();
const mockCookieDelete = vi.fn();
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: (name: string) => mockCookieGet(name),
    delete: (name: string) => mockCookieDelete(name),
  }),
}));

const mockSeedSOVQueries = vi.fn().mockResolvedValue({ seeded: 5 });
vi.mock('@/lib/services/sov-seed', () => ({
  seedSOVQueries: (...args: unknown[]) => mockSeedSOVQueries(...args),
}));

// Supabase mock
const mockSingle = vi.fn();
const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
const mockUpsert = vi.fn().mockResolvedValue({ error: null });
const mockDeleteEq = vi.fn().mockResolvedValue({ error: null });
const mockDelete = vi.fn().mockReturnValue({ eq: mockDeleteEq });
const mockCountEq2 = vi.fn().mockResolvedValue({ count: 0 });
const mockCountEq1 = vi.fn().mockReturnValue({ eq: mockCountEq2 });
const mockCountSelect = vi.fn().mockReturnValue({ eq: mockCountEq1 });

const mockFrom = vi.fn().mockImplementation((table: string) => {
  if (table === 'pending_gbp_imports') {
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: mockSingle,
        }),
      }),
      delete: mockDelete,
    };
  }
  if (table === 'locations') {
    return {
      select: mockCountSelect,
      insert: mockInsert,
    };
  }
  if (table === 'location_integrations') {
    return { upsert: mockUpsert };
  }
  return { select: vi.fn(), insert: vi.fn() };
});

vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: vi.fn(() => ({ from: mockFrom })),
}));

// ---------------------------------------------------------------------------
// Import under test (after mocks)
// ---------------------------------------------------------------------------

const { importGBPLocation } = await import(
  '@/app/onboarding/connect/actions'
);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TEST_ORG_ID = 'org-1234';
const TEST_IMPORT_ID = 'import-uuid-5678';
const MOCK_PENDING = {
  id: TEST_IMPORT_ID,
  org_id: TEST_ORG_ID,
  locations_data: [
    {
      name: 'accounts/123/locations/456',
      title: 'Test Restaurant',
      storefrontAddress: {
        addressLines: ['100 Test St'],
        locality: 'Atlanta',
        administrativeArea: 'GA',
        postalCode: '30301',
        regionCode: 'US',
      },
      regularHours: {
        periods: [
          { openDay: 'MONDAY', openTime: { hours: 9 }, closeDay: 'MONDAY', closeTime: { hours: 17 } },
        ],
      },
      primaryPhone: '(555) 123-4567',
    },
    {
      name: 'accounts/123/locations/789',
      title: 'Test Restaurant 2',
    },
  ],
  account_name: 'accounts/123',
  has_more: false,
  expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  created_at: new Date().toISOString(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('importGBPLocation', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: authenticated user with org
    mockGetSafeAuthContext.mockResolvedValue({
      userId: 'user-1',
      orgId: TEST_ORG_ID,
    });

    // Default: cookie has import ID
    mockCookieGet.mockImplementation((name: string) => {
      if (name === 'gbp_import_id') return { value: TEST_IMPORT_ID };
      return undefined;
    });

    // Default: pending import found
    mockSingle.mockResolvedValue({ data: MOCK_PENDING, error: null });

    // Default: insert returns location with ID
    const mockLocationSingle = vi.fn().mockResolvedValue({
      data: { id: 'loc-new-1' },
      error: null,
    });
    mockSelect.mockReturnValue({ single: mockLocationSingle });

    // Default: no existing primary location
    mockCountEq2.mockResolvedValue({ count: 0 });
  });

  it('inserts location with mapped hours_data from GBP', async () => {
    const result = await importGBPLocation(0);
    expect(result.success).toBe(true);
    expect(mockInsert).toHaveBeenCalled();
    const insertedRow = mockInsert.mock.calls[0][0];
    expect(insertedRow.hours_data).not.toBeNull();
    expect(insertedRow.hours_data.monday).toEqual({ open: '09:00', close: '17:00' });
  });

  it('creates location_integrations row with platform=google', async () => {
    await importGBPLocation(0);
    expect(mockUpsert).toHaveBeenCalled();
    const upsertedRow = mockUpsert.mock.calls[0][0];
    expect(upsertedRow.platform).toBe('google');
    expect(upsertedRow.status).toBe('connected');
  });

  it('sets is_primary=true when no existing primary location', async () => {
    mockCountEq2.mockResolvedValue({ count: 0 });
    await importGBPLocation(0);
    const insertedRow = mockInsert.mock.calls[0][0];
    expect(insertedRow.is_primary).toBe(true);
  });

  it('sets is_primary=false when primary location already exists', async () => {
    mockCountEq2.mockResolvedValue({ count: 1 });
    await importGBPLocation(0);
    const insertedRow = mockInsert.mock.calls[0][0];
    expect(insertedRow.is_primary).toBe(false);
  });

  it('calls seedSOVQueries with the new location', async () => {
    await importGBPLocation(0);
    expect(mockSeedSOVQueries).toHaveBeenCalledTimes(1);
    const seedArg = mockSeedSOVQueries.mock.calls[0][0];
    expect(seedArg.id).toBe('loc-new-1');
    expect(seedArg.business_name).toBe('Test Restaurant');
  });

  it('rejects unauthorized requests', async () => {
    mockGetSafeAuthContext.mockResolvedValue(null);
    const result = await importGBPLocation(0);
    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('rejects expired pending_gbp_imports', async () => {
    mockSingle.mockResolvedValue({
      data: {
        ...MOCK_PENDING,
        expires_at: new Date(Date.now() - 60 * 1000).toISOString(),
      },
      error: null,
    });
    const result = await importGBPLocation(0);
    expect(result).toEqual({
      success: false,
      error: 'Import session expired. Please reconnect.',
    });
  });

  it('rejects when org_id does not match authenticated user', async () => {
    mockSingle.mockResolvedValue({
      data: { ...MOCK_PENDING, org_id: 'other-org' },
      error: null,
    });
    const result = await importGBPLocation(0);
    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('deletes pending_gbp_imports row after successful import', async () => {
    await importGBPLocation(0);
    expect(mockDelete).toHaveBeenCalled();
    expect(mockDeleteEq).toHaveBeenCalledWith('id', TEST_IMPORT_ID);
  });
});
