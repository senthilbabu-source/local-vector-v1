// ---------------------------------------------------------------------------
// sov-query-toggle.test.ts — Unit tests for toggleQueryActive Server Action
//
// Sprint 88: Tests the new toggleQueryActive() action that flips is_active
// on target_queries for soft-disable/enable of SOV queries.
//
// Run:
//   npx vitest run src/__tests__/unit/sov-query-toggle.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Hoist vi.mock declarations before any imports ─────────────────────────

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSafeAuthContext: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

// ── Import subjects and mocks after declarations ──────────────────────────

import { toggleQueryActive } from '@/app/dashboard/share-of-voice/actions';
import { createClient } from '@/lib/supabase/server';
import { getSafeAuthContext } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

// ── Shared fixtures ───────────────────────────────────────────────────────

const ORG_ID = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11';
const QUERY_ID = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11';
const MOCK_AUTH = { orgId: ORG_ID, userId: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380d11' };

// ── Supabase mock factory ─────────────────────────────────────────────────

function mockSupabaseUpdate(error: unknown = null) {
  const mockEq2 = vi.fn().mockResolvedValue({ data: null, error });
  const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
  const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq1 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(createClient as any).mockResolvedValue({
    from: vi.fn(() => ({ update: mockUpdate })),
  });
  return { mockUpdate, mockEq1, mockEq2 };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('toggleQueryActive', () => {
  beforeEach(() => {
    vi.mocked(getSafeAuthContext).mockResolvedValue(MOCK_AUTH as never);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should flip is_active from true to false', async () => {
    const { mockUpdate } = mockSupabaseUpdate();

    const result = await toggleQueryActive({ query_id: QUERY_ID, is_active: false });

    expect(result).toEqual({ success: true });
    expect(mockUpdate).toHaveBeenCalledWith({ is_active: false });
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/dashboard/share-of-voice');
  });

  it('should flip is_active from false to true', async () => {
    const { mockUpdate } = mockSupabaseUpdate();

    const result = await toggleQueryActive({ query_id: QUERY_ID, is_active: true });

    expect(result).toEqual({ success: true });
    expect(mockUpdate).toHaveBeenCalledWith({ is_active: true });
  });

  it('should reject unauthorized requests', async () => {
    vi.mocked(getSafeAuthContext).mockResolvedValueOnce(null);

    const result = await toggleQueryActive({ query_id: QUERY_ID, is_active: false });

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('should reject when orgId is missing from context', async () => {
    vi.mocked(getSafeAuthContext).mockResolvedValueOnce({ orgId: null } as never);

    const result = await toggleQueryActive({ query_id: QUERY_ID, is_active: false });

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('should enforce RLS with org_id check in update query', async () => {
    const { mockEq1, mockEq2 } = mockSupabaseUpdate();

    await toggleQueryActive({ query_id: QUERY_ID, is_active: false });

    // First .eq() is for query_id
    expect(mockEq1).toHaveBeenCalledWith('id', QUERY_ID);
    // Second .eq() is belt-and-suspenders org_id
    expect(mockEq2).toHaveBeenCalledWith('org_id', ORG_ID);
  });

  it('should return validation error for invalid query_id', async () => {
    const result = await toggleQueryActive({ query_id: 'not-a-uuid', is_active: false });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeTruthy();
    }
  });

  it('should return DB error on update failure', async () => {
    mockSupabaseUpdate({ message: 'DB error' });

    const result = await toggleQueryActive({ query_id: QUERY_ID, is_active: false });

    expect(result).toEqual({ success: false, error: 'DB error' });
  });
});
