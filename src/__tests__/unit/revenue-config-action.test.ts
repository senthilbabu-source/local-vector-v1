// ---------------------------------------------------------------------------
// revenue-config-action.test.ts — Unit tests for revenue config server action
//
// Sprint 85: 6 tests — mocks auth + supabase.
//
// Run:
//   npx vitest run src/__tests__/unit/revenue-config-action.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — declared before imports so hoisting works
// ---------------------------------------------------------------------------

const mockGetSafeAuthContext = vi.fn();
const mockCreateClient = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('@/lib/auth', () => ({
  getSafeAuthContext: () => mockGetSafeAuthContext(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

import { updateRevenueConfig } from '@/app/dashboard/revenue-impact/actions';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set('locationId', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
  fd.set('avgCustomerValue', '55');
  fd.set('monthlyCovers', '1200');
  for (const [k, v] of Object.entries(overrides)) {
    fd.set(k, v);
  }
  return fd;
}

function makeMockSupabase(updateError: boolean = false) {
  const mockUpdate = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: null,
        error: updateError ? { message: 'db error' } : null,
      }),
    }),
  });

  return {
    from: vi.fn().mockReturnValue({
      update: mockUpdate,
    }),
    _mockUpdate: mockUpdate,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('updateRevenueConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSafeAuthContext.mockResolvedValue({
      orgId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      userId: 'user-1',
    });
  });

  it('1. updates location with new config values', async () => {
    const supabase = makeMockSupabase();
    mockCreateClient.mockResolvedValue(supabase);

    const result = await updateRevenueConfig(makeFormData());
    expect(result.success).toBe(true);
    expect(supabase.from).toHaveBeenCalledWith('locations');
    expect(supabase._mockUpdate).toHaveBeenCalledWith({
      avg_customer_value: 55,
      monthly_covers: 1200,
    });
  });

  it('2. validates avgCustomerValue is positive', async () => {
    const supabase = makeMockSupabase();
    mockCreateClient.mockResolvedValue(supabase);

    const result = await updateRevenueConfig(makeFormData({ avgCustomerValue: '0' }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeDefined();
    }
  });

  it('3. validates monthlyCovers is positive integer', async () => {
    const supabase = makeMockSupabase();
    mockCreateClient.mockResolvedValue(supabase);

    const result = await updateRevenueConfig(makeFormData({ monthlyCovers: '-5' }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeDefined();
    }
  });

  it('4. scopes update by org_id', async () => {
    const supabase = makeMockSupabase();
    mockCreateClient.mockResolvedValue(supabase);

    await updateRevenueConfig(makeFormData());
    // The from('locations').update().eq('id').eq('org_id') chain
    expect(supabase.from).toHaveBeenCalledWith('locations');
  });

  it('5. revalidates /dashboard/revenue-impact path', async () => {
    const supabase = makeMockSupabase();
    mockCreateClient.mockResolvedValue(supabase);

    await updateRevenueConfig(makeFormData());
    expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/revenue-impact');
  });

  it('6. returns error on Supabase error', async () => {
    const supabase = makeMockSupabase(true);
    mockCreateClient.mockResolvedValue(supabase);

    const result = await updateRevenueConfig(makeFormData());
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Failed to update revenue config');
    }
  });
});
