// ---------------------------------------------------------------------------
// save-business-info.test.ts — Unit tests for Sprint 93 saveBusinessInfo
//
// Tests app/dashboard/settings/business-info/actions.ts:
//   • Auth gating, Zod validation, DB persistence, error handling
//
// Run:
//   npx vitest run src/__tests__/unit/save-business-info.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSafeAuthContext: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { saveBusinessInfo } from '@/app/dashboard/settings/business-info/actions';
import { createClient } from '@/lib/supabase/server';
import { getSafeAuthContext } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { GOLDEN_TENANT, MOCK_BUSINESS_INFO_LOCATION } from '@/src/__fixtures__/golden-tenant';

// ── Shared fixtures ─────────────────────────────────────────────────────

const MOCK_AUTH = {
  orgId:    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  userId:   'auth-uid-abc123',
  email:    'jane@example.com',
  fullName: 'Jane Doe',
  orgName:  'Charcoal N Chill',
  plan:     'growth',
  role:     'owner',
  onboarding_completed: true,
};

const VALID_AMENITIES = {
  has_outdoor_seating: true,
  serves_alcohol: true,
  has_hookah: true,
  is_kid_friendly: false,
  takes_reservations: true,
  has_live_music: true,
};

const VALID_HOURS = {
  monday: 'closed' as const,
  tuesday: { open: '17:00', close: '01:00' },
  wednesday: { open: '17:00', close: '01:00' },
  thursday: { open: '17:00', close: '01:00' },
  friday: { open: '17:00', close: '02:00' },
  saturday: { open: '17:00', close: '02:00' },
  sunday: { open: '17:00', close: '01:00' },
};

function validInput(overrides = {}) {
  return {
    location_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    business_name: 'Charcoal N Chill',
    phone: '(470) 546-4866',
    website_url: 'https://charcoalnchill.com',
    address_line1: '11950 Jones Bridge Road Ste 103',
    city: 'Alpharetta',
    state: 'GA',
    zip: '30005',
    primary_category: 'Hookah Bar',
    operational_status: 'OPERATIONAL',
    amenities: VALID_AMENITIES,
    hours_data: VALID_HOURS,
    ...overrides,
  };
}

// ── Mock factory ────────────────────────────────────────────────────────

function mockSupabase(updateResult: { error: null | { message: string } } = { error: null }) {
  const eqOrg = vi.fn().mockResolvedValue(updateResult);
  const eqId = vi.fn().mockReturnValue({ eq: eqOrg });
  const update = vi.fn().mockReturnValue({ eq: eqId });
  const mockFrom = vi.fn().mockReturnValue({ update });

  (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
    from: mockFrom,
  });

  return { mockFrom, update, eqId, eqOrg };
}

// ── Tests ───────────────────────────────────────────────────────────────

describe('saveBusinessInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns Unauthorized when not authenticated', async () => {
    (getSafeAuthContext as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const result = await saveBusinessInfo(validInput());
    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('returns Unauthorized when orgId is missing', async () => {
    (getSafeAuthContext as ReturnType<typeof vi.fn>).mockResolvedValue({ ...MOCK_AUTH, orgId: null });
    const result = await saveBusinessInfo(validInput());
    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('returns validation error when business_name is empty', async () => {
    (getSafeAuthContext as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_AUTH);
    mockSupabase();
    const result = await saveBusinessInfo(validInput({ business_name: '' }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Business name');
    }
  });

  it('returns validation error when business_name exceeds 255 chars', async () => {
    (getSafeAuthContext as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_AUTH);
    mockSupabase();
    const result = await saveBusinessInfo(validInput({ business_name: 'A'.repeat(256) }));
    expect(result.success).toBe(false);
  });

  it('returns validation error for invalid location_id (not UUID)', async () => {
    (getSafeAuthContext as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_AUTH);
    mockSupabase();
    const result = await saveBusinessInfo(validInput({ location_id: 'not-a-uuid' }));
    expect(result.success).toBe(false);
  });

  it('returns validation error for invalid hours_data format', async () => {
    (getSafeAuthContext as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_AUTH);
    mockSupabase();
    const result = await saveBusinessInfo(
      validInput({ hours_data: { monday: { open: 'invalid', close: '01:00' } } })
    );
    expect(result.success).toBe(false);
  });

  it('persists all fields to locations table on success', async () => {
    (getSafeAuthContext as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_AUTH);
    const { mockFrom, update } = mockSupabase();

    const input = validInput();
    const result = await saveBusinessInfo(input);

    expect(result).toEqual({ success: true });
    expect(mockFrom).toHaveBeenCalledWith('locations');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        business_name: 'Charcoal N Chill',
        phone: '(470) 546-4866',
        website_url: 'https://charcoalnchill.com',
        address_line1: '11950 Jones Bridge Road Ste 103',
        city: 'Alpharetta',
        state: 'GA',
        zip: '30005',
        operational_status: 'OPERATIONAL',
      })
    );
  });

  it('maps primary_category to categories array', async () => {
    (getSafeAuthContext as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_AUTH);
    const { update } = mockSupabase();

    await saveBusinessInfo(validInput({ primary_category: 'Hookah Bar' }));

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        categories: ['Hookah Bar'],
      })
    );
  });

  it('maps null primary_category to null categories', async () => {
    (getSafeAuthContext as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_AUTH);
    const { update } = mockSupabase();

    await saveBusinessInfo(validInput({ primary_category: null }));

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        categories: null,
      })
    );
  });

  it('scopes update by org_id (belt-and-suspenders)', async () => {
    (getSafeAuthContext as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_AUTH);
    const { eqId, eqOrg } = mockSupabase();

    await saveBusinessInfo(validInput());

    expect(eqId).toHaveBeenCalledWith('id', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
    expect(eqOrg).toHaveBeenCalledWith('org_id', MOCK_AUTH.orgId);
  });

  it('revalidates dashboard and business-info paths on success', async () => {
    (getSafeAuthContext as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_AUTH);
    mockSupabase();

    await saveBusinessInfo(validInput());

    expect(revalidatePath).toHaveBeenCalledWith('/dashboard');
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/settings/business-info');
  });

  it('propagates Supabase error message on DB failure', async () => {
    (getSafeAuthContext as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_AUTH);
    mockSupabase({ error: { message: 'RLS policy violation' } });

    const result = await saveBusinessInfo(validInput());

    expect(result).toEqual({ success: false, error: 'RLS policy violation' });
  });

  it('normalizes empty strings to null for nullable fields', async () => {
    (getSafeAuthContext as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_AUTH);
    const { update } = mockSupabase();

    await saveBusinessInfo(validInput({
      phone: '',
      website_url: '',
      address_line1: '',
      city: '',
      state: '',
      zip: '',
    }));

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: null,
        website_url: null,
        address_line1: null,
        city: null,
        state: null,
        zip: null,
      })
    );
  });
});
