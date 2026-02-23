// ---------------------------------------------------------------------------
// listings-actions.test.ts — Unit tests for savePlatformUrl() Server Action
//
// Tests app/dashboard/integrations/actions.ts → savePlatformUrl():
//   1. auth gate (no ctx → Unauthorized)
//   2. Zod URL validation rejects a non-URL string
//   3. Zod URL accepts a valid URL (schema success path)
//   4. DB upsert success path returns { success: true }
//   5. DB error propagation returns { success: false, error: message }
//   6. revalidatePath is called on success
//
// Mocks: supabase/server, lib/auth, next/cache — hoisted (AI_RULES §4).
//
// Run:
//   npx vitest run src/__tests__/unit/listings-actions.test.ts
// ---------------------------------------------------------------------------

// ── Hoist vi.mock declarations BEFORE any imports (AI_RULES §4) ───────────

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSafeAuthContext: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

// ── Imports after mock declarations ──────────────────────────────────────

import { savePlatformUrl } from '@/app/dashboard/integrations/actions';
import { createClient } from '@/lib/supabase/server';
import { getSafeAuthContext } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

// ── Shared fixtures ───────────────────────────────────────────────────────

const ORG_ID     = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const LOCATION_ID = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11';
const VALID_URL  = 'https://g.page/charcoal-n-chill';
const MOCK_AUTH  = { orgId: ORG_ID, userId: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11' };

// ── Mock factory ──────────────────────────────────────────────────────────

/**
 * Builds a minimal Supabase mock supporting the upsert chain:
 *   supabase.from('location_integrations').upsert(data, opts)
 */
function mockSupabase(upsertResult: { error: { message: string } | null } = { error: null }) {
  const upsert  = vi.fn().mockResolvedValue(upsertResult);
  const mockFrom = vi.fn().mockReturnValue({ upsert });
  (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({ from: mockFrom });
  return { mockFrom, upsert };
}

// ── Setup ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  (getSafeAuthContext as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_AUTH);
  mockSupabase();
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe('savePlatformUrl', () => {

  it('returns Unauthorized when auth context is null', async () => {
    (getSafeAuthContext as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const result = await savePlatformUrl('google', VALID_URL, LOCATION_ID);
    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('returns validation error when url is not a valid URL', async () => {
    const result = await savePlatformUrl('google', 'not-a-url', LOCATION_ID);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/valid URL/i);
    }
  });

  it('returns success when url is a valid URL', async () => {
    const result = await savePlatformUrl('google', VALID_URL, LOCATION_ID);
    expect(result).toEqual({ success: true });
  });

  it('calls supabase.upsert with org_id, location_id, platform, and listing_url on success', async () => {
    const { mockFrom, upsert } = mockSupabase({ error: null });
    await savePlatformUrl('yelp', 'https://www.yelp.com/biz/charcoal-n-chill', LOCATION_ID);

    expect(mockFrom).toHaveBeenCalledWith('location_integrations');
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id:      ORG_ID,
        location_id: LOCATION_ID,
        platform:    'yelp',
        listing_url: 'https://www.yelp.com/biz/charcoal-n-chill',
      }),
      { onConflict: 'location_id,platform' },
    );
  });

  it('propagates DB error as { success: false, error: message }', async () => {
    mockSupabase({ error: { message: 'duplicate key value' } });
    const result = await savePlatformUrl('google', VALID_URL, LOCATION_ID);
    expect(result).toEqual({ success: false, error: 'duplicate key value' });
  });

  it('calls revalidatePath("/dashboard/integrations") on success', async () => {
    await savePlatformUrl('apple', 'https://maps.apple.com/?q=charcoal-n-chill', LOCATION_ID);
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/integrations');
  });

});
