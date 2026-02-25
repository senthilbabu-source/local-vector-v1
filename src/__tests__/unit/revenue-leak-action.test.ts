// ---------------------------------------------------------------------------
// revenue-leak-action.test.ts — Unit tests for Revenue Config Server Action
//
// Tests app/dashboard/settings/revenue/actions.ts:
//   • saveRevenueConfig — auth gate, Zod validation, location lookup, upsert
//
// Strategy:
//   • Supabase client, auth context, and next/cache mocked via vi.mock().
//   • No live DB or Supabase calls — pure unit tests.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSafeAuthContext: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { saveRevenueConfig } from '@/app/dashboard/settings/revenue/actions';
import { createClient } from '@/lib/supabase/server';
import { getSafeAuthContext } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

const MOCK_AUTH = {
  orgId:    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  userId:   'auth-uid-abc123',
  email:    'dev@localvector.ai',
  fullName: 'Dev User',
  orgName:  'Charcoal N Chill',
  plan:     'growth',
  role:     'owner',
  onboarding_completed: true,
};

const MOCK_LOCATION = { id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' };

// Build a mock Supabase client that supports the call chain used by
// saveRevenueConfig: from('locations').select().eq().limit().single()
// and from('revenue_config').upsert()
function mockSupabase(opts: {
  locationResult?: { data: unknown; error: unknown };
  upsertResult?: { error: unknown };
} = {}) {
  const locationResult = opts.locationResult ?? { data: MOCK_LOCATION, error: null };
  const upsertResult = opts.upsertResult ?? { error: null };

  const mockFrom = vi.fn().mockImplementation((table: string) => {
    if (table === 'locations') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue(locationResult),
            }),
          }),
        }),
      };
    }
    if (table === 'revenue_config') {
      return {
        upsert: vi.fn().mockResolvedValue(upsertResult),
      };
    }
    return {};
  });

  (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
    from: mockFrom,
  });

  return { mockFrom };
}

function buildForm(overrides: Record<string, string> = {}) {
  const defaults: Record<string, string> = {
    avg_ticket: '47.50',
    monthly_searches: '2400',
    local_conversion_rate: '3.2',
    walk_away_rate: '65',
  };
  const form = new FormData();
  for (const [k, v] of Object.entries({ ...defaults, ...overrides })) {
    form.set(k, v);
  }
  return form;
}

describe('saveRevenueConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns Unauthorized when not authenticated', async () => {
    (getSafeAuthContext as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const result = await saveRevenueConfig(buildForm());
    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('returns validation error when avg_ticket is 0', async () => {
    (getSafeAuthContext as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_AUTH);
    mockSupabase();
    const result = await saveRevenueConfig(buildForm({ avg_ticket: '0' }));
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toMatch(/\$1/);
  });

  it('returns validation error when conversion rate exceeds 100%', async () => {
    (getSafeAuthContext as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_AUTH);
    mockSupabase();
    const result = await saveRevenueConfig(buildForm({ local_conversion_rate: '150' }));
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toMatch(/100%/);
  });

  it('returns error when no location found', async () => {
    (getSafeAuthContext as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_AUTH);
    mockSupabase({ locationResult: { data: null, error: { message: 'not found' } } });
    const result = await saveRevenueConfig(buildForm());
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toMatch(/No location/);
  });

  it('returns success and calls revalidatePath on valid upsert', async () => {
    (getSafeAuthContext as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_AUTH);
    mockSupabase();
    const result = await saveRevenueConfig(buildForm());
    expect(result).toEqual({ success: true });
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard');
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/settings/revenue');
  });

  it('propagates DB error on upsert failure', async () => {
    (getSafeAuthContext as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_AUTH);
    mockSupabase({ upsertResult: { error: { message: 'unique violation' } } });
    const result = await saveRevenueConfig(buildForm());
    expect(result).toEqual({ success: false, error: 'unique violation' });
  });
});
