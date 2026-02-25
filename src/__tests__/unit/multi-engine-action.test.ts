// ---------------------------------------------------------------------------
// multi-engine-action.test.ts — Unit tests for runMultiEngineEvaluation
//
// Tests app/dashboard/hallucinations/actions.ts:
//   • runMultiEngineEvaluation — auth gate, Zod validation, parallel engine
//     calls, DB persistence, revalidation
//
// Strategy:
//   • Supabase client, auth context, next/cache, and AI SDK mocked via vi.mock().
//   • No live DB or API calls — pure unit tests.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSafeAuthContext: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('ai', () => ({
  generateText: vi.fn().mockResolvedValue({
    text: JSON.stringify({
      accuracy_score: 85,
      hallucinations_detected: [],
      response_text: 'Mock AI response',
    }),
  }),
}));
vi.mock('@/lib/ai/providers', () => ({
  getModel: vi.fn().mockReturnValue('mock-model'),
  hasApiKey: vi.fn().mockReturnValue(true),
}));

import { runMultiEngineEvaluation } from '@/app/dashboard/hallucinations/actions';
import { createClient } from '@/lib/supabase/server';
import { getSafeAuthContext } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

const MOCK_AUTH = {
  orgId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  userId: 'auth-uid-abc123',
  email: 'dev@localvector.ai',
  fullName: 'Dev User',
  orgName: 'Charcoal N Chill',
  plan: 'growth',
  role: 'owner',
  onboarding_completed: true,
};

const MOCK_LOCATION = {
  id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  business_name: 'Charcoal N Chill',
  address_line1: '11950 Jones Bridge Road',
  city: 'Alpharetta',
  state: 'GA',
  zip: '30005',
  phone: '(470) 546-4866',
  website_url: 'https://charcoalnchill.com',
};

function mockSupabase(opts: {
  locationResult?: { data: unknown; error: unknown };
  insertError?: unknown;
} = {}) {
  const locationResult = opts.locationResult ?? { data: MOCK_LOCATION, error: null };
  const insertError = opts.insertError ?? null;

  const mockFrom = vi.fn().mockImplementation((table: string) => {
    if (table === 'locations') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue(locationResult),
          }),
        }),
      };
    }
    if (table === 'ai_evaluations') {
      return {
        insert: vi.fn().mockResolvedValue({ error: insertError }),
      };
    }
    return {};
  });

  (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
    from: mockFrom,
  });

  return { mockFrom };
}

describe('runMultiEngineEvaluation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns Unauthorized when not authenticated', async () => {
    (getSafeAuthContext as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const result = await runMultiEngineEvaluation({
      location_id: MOCK_LOCATION.id,
    });
    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('returns validation error for invalid location_id', async () => {
    (getSafeAuthContext as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_AUTH);
    mockSupabase();
    const result = await runMultiEngineEvaluation({
      location_id: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toMatch(/location/i);
  });

  it('returns error when location not found', async () => {
    (getSafeAuthContext as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_AUTH);
    mockSupabase({ locationResult: { data: null, error: { message: 'not found' } } });
    const result = await runMultiEngineEvaluation({
      location_id: MOCK_LOCATION.id,
    });
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toMatch(/Location not found/);
  });

  it('succeeds and inserts all 4 engine evaluations', async () => {
    (getSafeAuthContext as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_AUTH);
    const { mockFrom } = mockSupabase();
    const result = await runMultiEngineEvaluation({
      location_id: MOCK_LOCATION.id,
    });
    expect(result).toEqual({ success: true });
    // ai_evaluations.insert should be called 4 times (once per engine)
    const evalCalls = mockFrom.mock.calls.filter(
      ([table]: [string]) => table === 'ai_evaluations',
    );
    expect(evalCalls.length).toBe(4);
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/hallucinations');
  });

  it('returns failure when all engine inserts fail', async () => {
    (getSafeAuthContext as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_AUTH);
    mockSupabase({ insertError: { message: 'RLS violation' } });
    const result = await runMultiEngineEvaluation({
      location_id: MOCK_LOCATION.id,
    });
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toMatch(/failed/i);
  });

  it('succeeds if at least one engine insert succeeds', async () => {
    (getSafeAuthContext as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_AUTH);
    let callCount = 0;
    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'locations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: MOCK_LOCATION, error: null }),
            }),
          }),
        };
      }
      if (table === 'ai_evaluations') {
        callCount++;
        // Only the first insert succeeds, rest fail
        const error = callCount === 1 ? null : { message: 'RLS violation' };
        return {
          insert: vi.fn().mockResolvedValue({ error }),
        };
      }
      return {};
    });
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({ from: mockFrom });

    const result = await runMultiEngineEvaluation({
      location_id: MOCK_LOCATION.id,
    });
    expect(result).toEqual({ success: true });
  });
});
