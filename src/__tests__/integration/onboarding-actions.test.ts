/**
 * saveGroundTruth Server Action — Integration Tests (mocked dependencies)
 *
 * Tests the logic of the Server Action without touching a live database.
 * All Supabase I/O and Next.js APIs are mocked at the module level.
 *
 * Project rules honoured:
 *   RLS SHADOWBAN  — org_id is ALWAYS derived from getSafeAuthContext(),
 *                    never from the client input payload (rule 3)
 *   JSONB STRICTNESS — "closed" string literal imported from canonical types,
 *                      never a missing key (rule 4)
 *   UUID CONSTRAINTS — all mock UUIDs use valid hex chars only (rule 2)
 *   ZERO LIVE APIS  — createClient and getSafeAuthContext are fully mocked (rule 1)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { HoursData, Amenities } from '@/lib/types/ground-truth';

// ---------------------------------------------------------------------------
// Module mocks (hoisted automatically by Vitest before any imports below)
// ---------------------------------------------------------------------------

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/auth',            () => ({ getSafeAuthContext: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/services/sov-seed', () => ({ seedSOVQueries: vi.fn().mockResolvedValue({ seeded: 12 }) }));

// Import mocked modules so we can call vi.mocked() on them in tests
import { getSafeAuthContext } from '@/lib/auth';
import { createClient }       from '@/lib/supabase/server';
import { revalidatePath }     from 'next/cache';
import { seedSOVQueries }    from '@/lib/services/sov-seed';

// Import the action AFTER mocks are wired up.
// 'use server' is a string expression that Vitest ignores; the exports are callable.
import { saveGroundTruth } from '@/app/onboarding/actions';

// ---------------------------------------------------------------------------
// Fixtures — all UUIDs use hex chars 0-9 / a-f (UUID constraint, rule 2)
// ---------------------------------------------------------------------------

const ORG_ID      = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const LOCATION_ID = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11';

const MOCK_AUTH_CTX = {
  orgId:    ORG_ID,
  email:    'test-owner@charcoalnchill.com',
  fullName: 'Test Owner',
  orgName:  'Charcoal N Chill',
  plan:     'growth',
};

// Doc 03 §15.1 — closed days use the string literal 'closed', NOT a missing key.
// Doc 03 §15.2 — all 6 core amenity keys required.
const VALID_HOURS: HoursData = {
  monday:    { open: '17:00', close: '23:00' },
  tuesday:   { open: '17:00', close: '23:00' },
  wednesday: { open: '17:00', close: '23:00' },
  thursday:  { open: '17:00', close: '00:00' },
  friday:    { open: '17:00', close: '01:00' },
  saturday:  { open: '17:00', close: '01:00' },
  sunday:    'closed',       // ← explicit closed string (§15.1)
};

const VALID_AMENITIES: Amenities = {
  has_outdoor_seating: true,
  serves_alcohol:      true,
  has_hookah:          true,
  is_kid_friendly:     false,
  takes_reservations:  true,
  has_live_music:      true,
};

const MOCK_FULL_LOCATION = {
  id:            LOCATION_ID,
  business_name: 'Charcoal N Chill',
  city:          'Alpharetta',
  state:         'GA',
  categories:    ['Hookah Bar', 'Indian Restaurant'],
};

// ---------------------------------------------------------------------------
// Supabase mock factory
//
// Simulates the fluent chain:
//   supabase.from('locations').update({...}).eq('id', ...).eq('org_id', ...)
//
// The inner .eq().eq() chain terminates in a Promise.
// ---------------------------------------------------------------------------

function makeSupabaseMock(opts: {
  updateError?: { message: string } | null;
  selectData?: Record<string, unknown> | null;
} = {}) {
  const updateError = opts.updateError ?? null;
  const selectData  = opts.selectData ?? null;

  // Update chain:
  //   from('locations').update({}).eq('id', ...).eq('org_id', ...) → { error }
  const secondEq = vi.fn().mockResolvedValue({ error: updateError });
  const firstEq  = vi.fn().mockReturnValue({ eq: secondEq });
  const update   = vi.fn().mockReturnValue({ eq: firstEq });

  // Select chain (for SOV seed fetch):
  //   from('locations').select('...').eq('id', ...).eq('org_id', ...).single() → { data }
  const single         = vi.fn().mockResolvedValue({ data: selectData });
  const selectSecondEq = vi.fn().mockReturnValue({ single });
  const selectFirstEq  = vi.fn().mockReturnValue({ eq: selectSecondEq });
  const select         = vi.fn().mockReturnValue({ eq: selectFirstEq });

  const from = vi.fn().mockReturnValue({ update, select });

  return { from, update, firstEq, secondEq, select, selectFirstEq, selectSecondEq, single };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('saveGroundTruth — authentication & authorisation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns { success: false, error: "Unauthorized" } when getSafeAuthContext() is null', async () => {
    vi.mocked(getSafeAuthContext).mockResolvedValue(null);

    const result = await saveGroundTruth({
      location_id:   LOCATION_ID,
      business_name: 'Charcoal N Chill',
      amenities:     VALID_AMENITIES,
      hours_data:    VALID_HOURS,
    });

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
    // Must NOT attempt any DB call when unauthenticated
    expect(createClient).not.toHaveBeenCalled();
  });

  it('returns Unauthorized when orgId is null (org trigger not yet fired)', async () => {
    vi.mocked(getSafeAuthContext).mockResolvedValue(
      { ...MOCK_AUTH_CTX, orgId: null } as never,
    );

    const result = await saveGroundTruth({
      location_id:   LOCATION_ID,
      business_name: 'Charcoal N Chill',
      amenities:     VALID_AMENITIES,
      hours_data:    VALID_HOURS,
    });

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });
});

describe('saveGroundTruth — input validation (Zod)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSafeAuthContext).mockResolvedValue(MOCK_AUTH_CTX as never);
    const { from } = makeSupabaseMock();
    vi.mocked(createClient).mockResolvedValue({ from } as never);
  });

  it('returns validation error for empty business_name', async () => {
    const result = await saveGroundTruth({
      location_id:   LOCATION_ID,
      business_name: '',          // fails min(1) — "Business name is required"
      amenities:     VALID_AMENITIES,
      hours_data:    VALID_HOURS,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Business name is required');
    }
  });

  it('returns "Invalid location ID" for a non-UUID location_id', async () => {
    const result = await saveGroundTruth({
      location_id:   'not-a-valid-uuid',
      business_name: 'Charcoal N Chill',
      amenities:     VALID_AMENITIES,
      hours_data:    VALID_HOURS,
    });

    expect(result).toEqual({ success: false, error: 'Invalid location ID' });
  });

  it('does NOT reach the DB layer when validation fails', async () => {
    await saveGroundTruth({
      location_id:   'not-a-uuid',
      business_name: 'Charcoal N Chill',
      amenities:     VALID_AMENITIES,
      hours_data:    VALID_HOURS,
    });

    expect(createClient).not.toHaveBeenCalled();
  });
});

describe('saveGroundTruth — successful DB update', () => {
  let update: ReturnType<typeof makeSupabaseMock>['update'];
  let firstEq: ReturnType<typeof makeSupabaseMock>['firstEq'];
  let secondEq: ReturnType<typeof makeSupabaseMock>['secondEq'];
  let from: ReturnType<typeof makeSupabaseMock>['from'];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSafeAuthContext).mockResolvedValue(MOCK_AUTH_CTX as never);

    const mock = makeSupabaseMock();
    from     = mock.from;
    update   = mock.update;
    firstEq  = mock.firstEq;
    secondEq = mock.secondEq;
    vi.mocked(createClient).mockResolvedValue({ from } as never);
  });

  it('returns { success: true } on valid input', async () => {
    const result = await saveGroundTruth({
      location_id:   LOCATION_ID,
      business_name: 'Charcoal N Chill',
      amenities:     VALID_AMENITIES,
      hours_data:    VALID_HOURS,
    });

    expect(result).toEqual({ success: true });
  });

  it('targets the locations table', async () => {
    await saveGroundTruth({
      location_id:   LOCATION_ID,
      business_name: 'Charcoal N Chill',
      amenities:     VALID_AMENITIES,
      hours_data:    VALID_HOURS,
    });

    expect(from).toHaveBeenCalledWith('locations');
  });

  it('sends business_name, hours_data, and amenities in the UPDATE payload', async () => {
    await saveGroundTruth({
      location_id:   LOCATION_ID,
      business_name: 'Charcoal N Chill',
      amenities:     VALID_AMENITIES,
      hours_data:    VALID_HOURS,
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        business_name: 'Charcoal N Chill',
        hours_data:    VALID_HOURS,
        amenities:     VALID_AMENITIES,
      }),
    );
  });

  it('dual-filter: first .eq("id", location_id) then .eq("org_id", ctx.orgId)', async () => {
    await saveGroundTruth({
      location_id:   LOCATION_ID,
      business_name: 'Charcoal N Chill',
      amenities:     VALID_AMENITIES,
      hours_data:    VALID_HOURS,
    });

    // Belt-and-suspenders alongside RLS (rule 3)
    expect(firstEq).toHaveBeenCalledWith('id', LOCATION_ID);
    expect(secondEq).toHaveBeenCalledWith('org_id', ORG_ID);
  });

  it('org_id in the filter comes from getSafeAuthContext(), NOT the client payload', async () => {
    await saveGroundTruth({
      location_id:   LOCATION_ID,
      business_name: 'Charcoal N Chill',
      amenities:     VALID_AMENITIES,
      hours_data:    VALID_HOURS,
    });

    // Server-derived org_id (ORG_ID from auth context)
    expect(secondEq).toHaveBeenCalledWith('org_id', ORG_ID);

    // The UPDATE payload must NOT contain org_id (never accept from client)
    expect(update).not.toHaveBeenCalledWith(
      expect.objectContaining({ org_id: expect.anything() }),
    );
  });

  it('calls revalidatePath("/dashboard") after a successful write', async () => {
    await saveGroundTruth({
      location_id:   LOCATION_ID,
      business_name: 'Charcoal N Chill',
      amenities:     VALID_AMENITIES,
      hours_data:    VALID_HOURS,
    });

    expect(revalidatePath).toHaveBeenCalledWith('/dashboard');
  });
});

describe('saveGroundTruth — JSONB closed-day encoding (Doc 03 §15.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSafeAuthContext).mockResolvedValue(MOCK_AUTH_CTX as never);
    const { from, update } = makeSupabaseMock();
    vi.mocked(createClient).mockResolvedValue({ from } as never);
    // Store update ref for assertions
    (globalThis as Record<string, unknown>)._capturedUpdate = update;
  });

  it('encodes a closed day as the literal string "closed", not a missing key', async () => {
    const { from, update } = makeSupabaseMock();
    vi.mocked(createClient).mockResolvedValue({ from } as never);

    await saveGroundTruth({
      location_id:   LOCATION_ID,
      business_name: 'Charcoal N Chill',
      amenities:     VALID_AMENITIES,
      hours_data:    {
        ...VALID_HOURS,
        sunday: 'closed' as const,   // ← must be string literal, NOT omitted
      },
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        hours_data: expect.objectContaining({ sunday: 'closed' }),
      }),
    );
  });

  it('encodes open days as { open, close } objects', async () => {
    const { from, update } = makeSupabaseMock();
    vi.mocked(createClient).mockResolvedValue({ from } as never);

    await saveGroundTruth({
      location_id:   LOCATION_ID,
      business_name: 'Charcoal N Chill',
      amenities:     VALID_AMENITIES,
      hours_data:    VALID_HOURS,
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        hours_data: expect.objectContaining({
          monday: { open: '17:00', close: '23:00' },
        }),
      }),
    );
  });
});

describe('saveGroundTruth — Supabase error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSafeAuthContext).mockResolvedValue(MOCK_AUTH_CTX as never);
  });

  it('returns { success: false, error } when Supabase returns an error', async () => {
    const { from } = makeSupabaseMock({ updateError: { message: 'DB write failed' } });
    vi.mocked(createClient).mockResolvedValue({ from } as never);

    const result = await saveGroundTruth({
      location_id:   LOCATION_ID,
      business_name: 'Charcoal N Chill',
      amenities:     VALID_AMENITIES,
      hours_data:    VALID_HOURS,
    });

    expect(result).toEqual({ success: false, error: 'DB write failed' });
  });

  it('does NOT call revalidatePath when the DB update fails', async () => {
    const { from } = makeSupabaseMock({ updateError: { message: 'connection refused' } });
    vi.mocked(createClient).mockResolvedValue({ from } as never);

    await saveGroundTruth({
      location_id:   LOCATION_ID,
      business_name: 'Charcoal N Chill',
      amenities:     VALID_AMENITIES,
      hours_data:    VALID_HOURS,
    });

    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// SOV Query Seeding — Sprint 41 (Doc 04c §3)
// ---------------------------------------------------------------------------

describe('saveGroundTruth — SOV query seeding after successful save', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSafeAuthContext).mockResolvedValue(MOCK_AUTH_CTX as never);
  });

  it('calls seedSOVQueries with full location data after successful ground truth save', async () => {
    const { from } = makeSupabaseMock({ selectData: MOCK_FULL_LOCATION });
    vi.mocked(createClient).mockResolvedValue({ from } as never);

    const result = await saveGroundTruth({
      location_id:   LOCATION_ID,
      business_name: 'Charcoal N Chill',
      amenities:     VALID_AMENITIES,
      hours_data:    VALID_HOURS,
    });

    expect(result).toEqual({ success: true });
    expect(seedSOVQueries).toHaveBeenCalledWith(
      { ...MOCK_FULL_LOCATION, org_id: ORG_ID },
      [],            // No competitors on day 1
      expect.anything(),  // Supabase client
    );
  });

  it('does NOT call seedSOVQueries when location fetch returns null', async () => {
    const { from } = makeSupabaseMock({ selectData: null });
    vi.mocked(createClient).mockResolvedValue({ from } as never);

    const result = await saveGroundTruth({
      location_id:   LOCATION_ID,
      business_name: 'Charcoal N Chill',
      amenities:     VALID_AMENITIES,
      hours_data:    VALID_HOURS,
    });

    expect(result).toEqual({ success: true });
    expect(seedSOVQueries).not.toHaveBeenCalled();
  });

  it('still returns success when seedSOVQueries throws (best-effort)', async () => {
    const { from } = makeSupabaseMock({ selectData: MOCK_FULL_LOCATION });
    vi.mocked(createClient).mockResolvedValue({ from } as never);
    vi.mocked(seedSOVQueries).mockRejectedValueOnce(new Error('seed boom'));

    const result = await saveGroundTruth({
      location_id:   LOCATION_ID,
      business_name: 'Charcoal N Chill',
      amenities:     VALID_AMENITIES,
      hours_data:    VALID_HOURS,
    });

    // Seeding failure is non-critical — onboarding still succeeds
    expect(result).toEqual({ success: true });
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard');
  });

  it('does NOT attempt seeding when the DB update fails', async () => {
    const { from } = makeSupabaseMock({ updateError: { message: 'DB error' } });
    vi.mocked(createClient).mockResolvedValue({ from } as never);

    await saveGroundTruth({
      location_id:   LOCATION_ID,
      business_name: 'Charcoal N Chill',
      amenities:     VALID_AMENITIES,
      hours_data:    VALID_HOURS,
    });

    expect(seedSOVQueries).not.toHaveBeenCalled();
  });
});
