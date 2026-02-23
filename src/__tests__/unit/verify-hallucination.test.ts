// ---------------------------------------------------------------------------
// verify-hallucination.test.ts — Unit tests for verifyHallucinationFix()
//
// Tests app/dashboard/hallucinations/actions.ts: verifyHallucinationFix()
//
// Strategy:
//   • Supabase client, auth context, and next/cache are mocked via vi.mock().
//   • auditLocation (AI service) is mocked to return deterministic results.
//   • No real OpenAI calls, no MSW needed — pure unit test.
//
// Run:
//   npx vitest run src/__tests__/unit/verify-hallucination.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Hoist vi.mock declarations before any imports ─────────────────────────

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSafeAuthContext: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/services/ai-audit.service', () => ({
  auditLocation: vi.fn().mockResolvedValue([]),
}));

// ── Import subjects and mocks after declarations ──────────────────────────

import { verifyHallucinationFix } from '@/app/dashboard/hallucinations/actions';
import { createClient } from '@/lib/supabase/server';
import { getSafeAuthContext } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { auditLocation } from '@/lib/services/ai-audit.service';

// ── Fixtures ──────────────────────────────────────────────────────────────

const ORG_ID           = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11';
const LOCATION_ID      = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const HALLUCINATION_ID = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11';

const MOCK_AUTH = { orgId: ORG_ID, userId: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380d11' };

const OPEN_HALLUCINATION = {
  id: HALLUCINATION_ID,
  location_id: LOCATION_ID,
  claim_text: 'This restaurant is permanently closed.',
  correction_status: 'open',
};

const VERIFYING_HALLUCINATION = {
  ...OPEN_HALLUCINATION,
  correction_status: 'verifying',
};

const MOCK_LOCATION = {
  id: LOCATION_ID,
  org_id: ORG_ID,
  business_name: 'Charcoal N Chill',
  city: 'Alpharetta',
  state: 'GA',
  address_line1: '123 Main St',
  hours_data: null,
  amenities: null,
};

// ── Supabase mock factory ─────────────────────────────────────────────────

function mockSupabase({
  hallucination = OPEN_HALLUCINATION as typeof OPEN_HALLUCINATION | null,
  hallucinationError = null,
  location = MOCK_LOCATION as typeof MOCK_LOCATION | null,
  locationError = null,
  updateError = null,
}: {
  hallucination?: typeof OPEN_HALLUCINATION | null;
  hallucinationError?: unknown;
  location?: typeof MOCK_LOCATION | null;
  locationError?: unknown;
  updateError?: unknown;
} = {}) {
  const mockUpdate = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ data: null, error: updateError }),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(createClient as any).mockResolvedValue({
    from: vi.fn((table: string) => {
      if (table === 'ai_hallucinations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: hallucination,
                error: hallucinationError,
              }),
            }),
          }),
          update: mockUpdate,
        };
      }
      if (table === 'locations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: location,
                error: locationError,
              }),
            }),
          }),
        };
      }
      return {};
    }),
  });

  return { mockUpdate };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('verifyHallucinationFix', () => {
  beforeEach(() => {
    vi.mocked(getSafeAuthContext).mockResolvedValue(MOCK_AUTH as never);
    vi.mocked(auditLocation).mockResolvedValue([]);
    mockSupabase();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns Unauthorized when getSafeAuthContext() returns null', async () => {
    vi.mocked(getSafeAuthContext).mockResolvedValueOnce(null);

    const result = await verifyHallucinationFix({ hallucination_id: HALLUCINATION_ID });

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('returns validation error for an invalid UUID input', async () => {
    const result = await verifyHallucinationFix({
      hallucination_id: 'not-a-valid-uuid',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('valid hallucination ID');
    }
  });

  it('returns cooldown error when correction_status is already verifying', async () => {
    mockSupabase({ hallucination: VERIFYING_HALLUCINATION });

    const result = await verifyHallucinationFix({ hallucination_id: HALLUCINATION_ID });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('cooldown');
      expect(result.retryAfterSeconds).toBe(86400);
    }
  });

  it('calls auditLocation with the hallucination\'s linked location data', async () => {
    mockSupabase();

    await verifyHallucinationFix({ hallucination_id: HALLUCINATION_ID });

    expect(vi.mocked(auditLocation)).toHaveBeenCalledOnce();
    const locationArg = vi.mocked(auditLocation).mock.calls[0][0];
    expect(locationArg.id).toBe(LOCATION_ID);
    expect(locationArg.business_name).toBe('Charcoal N Chill');
  });

  it('updates correction_status to fixed and sets resolved_at when audit finds no match', async () => {
    // auditLocation returns a hallucination with different claim text — no match
    vi.mocked(auditLocation).mockResolvedValueOnce([
      {
        model_provider: 'openai-gpt4o',
        severity: 'low',
        category: 'amenity',
        claim_text: 'No outdoor seating available.',  // different from original
        expected_truth: 'Has outdoor seating.',
      },
    ]);
    const { mockUpdate } = mockSupabase();

    const result = await verifyHallucinationFix({ hallucination_id: HALLUCINATION_ID });

    expect(result).toEqual({ success: true, newStatus: 'fixed' });
    // Last update call should include resolved_at
    const lastUpdateCall = mockUpdate.mock.calls[mockUpdate.mock.calls.length - 1];
    expect(lastUpdateCall[0]).toMatchObject({
      correction_status: 'fixed',
    });
    expect(lastUpdateCall[0].resolved_at).toBeDefined();
  });

  it('keeps correction_status as open when audit finds a matching claim', async () => {
    // auditLocation returns a hallucination whose claim includes the original text
    vi.mocked(auditLocation).mockResolvedValueOnce([
      {
        model_provider: 'openai-gpt4o',
        severity: 'critical',
        category: 'status',
        claim_text: 'This restaurant is permanently closed.',  // matches original
        expected_truth: 'Restaurant is open.',
      },
    ]);
    const { mockUpdate } = mockSupabase();

    const result = await verifyHallucinationFix({ hallucination_id: HALLUCINATION_ID });

    expect(result).toEqual({ success: true, newStatus: 'open' });
    const lastUpdateCall = mockUpdate.mock.calls[mockUpdate.mock.calls.length - 1];
    expect(lastUpdateCall[0]).toMatchObject({ correction_status: 'open' });
    expect(lastUpdateCall[0].resolved_at).toBeUndefined();
  });

  it('calls revalidatePath("/dashboard") on success', async () => {
    await verifyHallucinationFix({ hallucination_id: HALLUCINATION_ID });

    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/dashboard');
  });

  it('returns error when hallucination is not found in DB', async () => {
    mockSupabase({ hallucination: null, hallucinationError: { message: 'Not found' } });

    const result = await verifyHallucinationFix({ hallucination_id: HALLUCINATION_ID });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('not found');
    }
  });
});
