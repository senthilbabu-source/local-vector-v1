// ---------------------------------------------------------------------------
// gbp-import-action.test.ts — Unit tests for importGBPLocation Server Action
//
// Sprint 89: Tests the server action that reads from pending_gbp_imports,
// maps the GBP location, and writes to the locations table.
//
// Mock strategy: vi.mock all server dependencies (supabase, auth, cache,
// cookies, sov-seed). Factory creates chainable Supabase mock per table.
//
// Run:
//   npx vitest run src/__tests__/unit/gbp-import-action.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Hoist vi.mock declarations ────────────────────────────────────────────

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createServiceRoleClient: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({ getSafeAuthContext: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue({ value: 'import-uuid-001' }),
    delete: vi.fn(),
  }),
}));
vi.mock('@/lib/services/sov-seed', () => ({
  seedSOVQueries: vi.fn().mockResolvedValue({ seeded: 10 }),
}));

// ── Import subjects ───────────────────────────────────────────────────────

import { importGBPLocation } from '@/app/onboarding/connect/actions';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getSafeAuthContext } from '@/lib/auth';
import { seedSOVQueries } from '@/lib/services/sov-seed';
import { revalidatePath } from 'next/cache';
import { MOCK_GBP_LOCATION } from '@/__fixtures__/golden-tenant';

// ── Shared fixtures ───────────────────────────────────────────────────────

const ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const LOCATION_ID = 'loc-new-001';
const IMPORT_ROW_ID = 'import-uuid-001';
const MOCK_AUTH = { orgId: ORG_ID, userId: 'user-001' };

const VALID_PENDING_IMPORT = {
  id: IMPORT_ROW_ID,
  org_id: ORG_ID,
  locations_data: [MOCK_GBP_LOCATION],
  account_name: 'accounts/123456789',
  expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
};

// ── Supabase mock factory ─────────────────────────────────────────────────

function createMockServiceRole({
  pendingResult = { data: VALID_PENDING_IMPORT, error: null } as { data: unknown; error: unknown },
  primaryCount = 0,
  insertResult = { data: { id: LOCATION_ID }, error: null } as { data: unknown; error: unknown },
  upsertResult = { data: null, error: null },
  deleteResult = { data: null, error: null },
} = {}) {
  // pending_gbp_imports.select().eq().eq().single()
  const pendingSingle = vi.fn().mockResolvedValue(pendingResult);
  const pendingEq2 = vi.fn().mockReturnValue({ single: pendingSingle });
  const pendingEq1 = vi.fn().mockReturnValue({ eq: pendingEq2 });
  const pendingSelect = vi.fn().mockReturnValue({ eq: pendingEq1 });
  const deleteEq = vi.fn().mockResolvedValue(deleteResult);
  const pendingDelete = vi.fn().mockReturnValue({ eq: deleteEq });

  // locations.select for is_primary count
  // The last .eq() in the chain must resolve directly (it's awaited, not called)
  const countEq2 = vi.fn().mockResolvedValue({ count: primaryCount, error: null });
  const countEq1 = vi.fn().mockReturnValue({ eq: countEq2 });
  const locCountSelect = vi.fn().mockReturnValue({ eq: countEq1 });

  // locations.insert().select().single()
  const insertSingle = vi.fn().mockResolvedValue(insertResult);
  const insertSelect = vi.fn().mockReturnValue({ single: insertSingle });
  const locInsert = vi.fn().mockReturnValue({ select: insertSelect });

  // location_integrations.upsert()
  const intUpsert = vi.fn().mockResolvedValue(upsertResult);

  const from = vi.fn().mockImplementation((table: string) => {
    if (table === 'pending_gbp_imports') return { select: pendingSelect, delete: pendingDelete };
    if (table === 'locations') return { select: locCountSelect, insert: locInsert };
    if (table === 'location_integrations') return { upsert: intUpsert };
    return {};
  });

  vi.mocked(createServiceRoleClient).mockReturnValue({ from } as never);
  return { from, locInsert, intUpsert, pendingDelete, deleteEq };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('importGBPLocation', () => {
  beforeEach(() => {
    vi.mocked(getSafeAuthContext).mockResolvedValue(MOCK_AUTH as never);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should insert location with mapped hours_data from GBP', async () => {
    const { locInsert } = createMockServiceRole();
    const result = await importGBPLocation({ locationIndex: 0 });
    expect(result.success).toBe(true);
    expect(locInsert).toHaveBeenCalledOnce();
    const arg = locInsert.mock.calls[0][0];
    expect(arg.business_name).toBe('Charcoal N Chill');
    expect(arg.hours_data).not.toBeNull();
    expect(arg.hours_data.monday).toBe('closed');
    expect(arg.hours_data.tuesday).toEqual({ open: '17:00', close: '01:00' });
    expect(arg.org_id).toBe(ORG_ID);
  });

  it('should create location_integrations row with platform="google"', async () => {
    const { intUpsert } = createMockServiceRole();
    await importGBPLocation({ locationIndex: 0 });
    expect(intUpsert).toHaveBeenCalledOnce();
    const arg = intUpsert.mock.calls[0][0];
    expect(arg.platform).toBe('google');
    expect(arg.status).toBe('connected');
    expect(arg.external_id).toBe('accounts/123456789/locations/987654321');
  });

  it('should set is_primary=true when no existing primary location', async () => {
    const { locInsert } = createMockServiceRole({ primaryCount: 0 });
    await importGBPLocation({ locationIndex: 0 });
    expect(locInsert.mock.calls[0][0].is_primary).toBe(true);
  });

  it('should set is_primary=false when primary location already exists', async () => {
    const { locInsert } = createMockServiceRole({ primaryCount: 1 });
    await importGBPLocation({ locationIndex: 0 });
    expect(locInsert.mock.calls[0][0].is_primary).toBe(false);
  });

  it('should call seedSOVQueries with the new location', async () => {
    createMockServiceRole();
    await importGBPLocation({ locationIndex: 0 });
    expect(seedSOVQueries).toHaveBeenCalledOnce();
    const seedArgs = vi.mocked(seedSOVQueries).mock.calls[0];
    expect(seedArgs[0].id).toBe(LOCATION_ID);
    expect(seedArgs[0].org_id).toBe(ORG_ID);
    expect(seedArgs[0].business_name).toBe('Charcoal N Chill');
    expect(seedArgs[0].city).toBe('Alpharetta');
  });

  it('should reject unauthorized requests (null context)', async () => {
    vi.mocked(getSafeAuthContext).mockResolvedValueOnce(null);
    const result = await importGBPLocation({ locationIndex: 0 });
    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('should reject expired pending_gbp_imports', async () => {
    createMockServiceRole({
      pendingResult: {
        data: { ...VALID_PENDING_IMPORT, expires_at: new Date(Date.now() - 60000).toISOString() },
        error: null,
      },
    });
    const result = await importGBPLocation({ locationIndex: 0 });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/expired/i);
  });

  it('should reject when org_id does not match authenticated user', async () => {
    createMockServiceRole({
      pendingResult: { data: { ...VALID_PENDING_IMPORT, org_id: 'different-org' }, error: null },
    });
    const result = await importGBPLocation({ locationIndex: 0 });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/unauthorized/i);
  });

  it('should delete pending_gbp_imports row after successful import', async () => {
    const { pendingDelete, deleteEq } = createMockServiceRole();
    await importGBPLocation({ locationIndex: 0 });
    expect(pendingDelete).toHaveBeenCalled();
    expect(deleteEq).toHaveBeenCalledWith('id', IMPORT_ROW_ID);
  });

  it('should set amenities to null (GBP intentional gap)', async () => {
    const { locInsert } = createMockServiceRole();
    await importGBPLocation({ locationIndex: 0 });
    expect(locInsert.mock.calls[0][0].amenities).toBeNull();
  });

  it('should revalidate dashboard path', async () => {
    createMockServiceRole();
    await importGBPLocation({ locationIndex: 0 });
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/dashboard');
  });

  it('should return error when location insert fails', async () => {
    createMockServiceRole({ insertResult: { data: null, error: { message: 'Duplicate slug' } } });
    const result = await importGBPLocation({ locationIndex: 0 });
    expect(result.success).toBe(false);
  });

  it('should reject invalid locationIndex (out of bounds)', async () => {
    createMockServiceRole();
    const result = await importGBPLocation({ locationIndex: 99 });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/index/i);
  });
});
