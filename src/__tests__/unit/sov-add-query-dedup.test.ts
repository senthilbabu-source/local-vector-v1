// ---------------------------------------------------------------------------
// sov-add-query-dedup.test.ts — Duplicate detection for addTargetQuery
//
// Sprint 88: With UNIQUE(location_id, query_text) constraint, addTargetQuery()
// should detect PostgreSQL error code 23505 and return a user-friendly message
// instead of the raw constraint violation error.
//
// Run:
//   npx vitest run src/__tests__/unit/sov-add-query-dedup.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Hoist vi.mock declarations before any imports ─────────────────────────

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSafeAuthContext: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

// ── Import subjects and mocks after declarations ──────────────────────────

import { addTargetQuery } from '@/app/dashboard/share-of-voice/actions';
import { createClient } from '@/lib/supabase/server';
import { getSafeAuthContext } from '@/lib/auth';

// ── Shared fixtures ───────────────────────────────────────────────────────

const LOCATION_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const ORG_ID = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11';
const MOCK_AUTH = { orgId: ORG_ID, userId: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380d11' };

// ── Tests ──────────────────────────────────────────────────────────────────

describe('addTargetQuery — duplicate detection', () => {
  beforeEach(() => {
    vi.mocked(getSafeAuthContext).mockResolvedValue(MOCK_AUTH as never);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return friendly error when query already exists (23505)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(createClient as any).mockResolvedValue({
      from: vi.fn(() => ({
        insert: vi.fn().mockResolvedValue({
          data: null,
          error: {
            code: '23505',
            message: 'duplicate key value violates unique constraint "uq_target_queries_location_text"',
          },
        }),
      })),
    });

    const result = await addTargetQuery({
      location_id: LOCATION_ID,
      query_text: 'best hookah bar Alpharetta',
    });

    expect(result).toEqual({
      success: false,
      error: 'This query already exists for this location.',
    });
  });

  it('should pass through other errors unchanged', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(createClient as any).mockResolvedValue({
      from: vi.fn(() => ({
        insert: vi.fn().mockResolvedValue({
          data: null,
          error: {
            code: '42P01',
            message: 'relation "target_queries" does not exist',
          },
        }),
      })),
    });

    const result = await addTargetQuery({
      location_id: LOCATION_ID,
      query_text: 'best hookah bar Alpharetta',
    });

    expect(result).toEqual({
      success: false,
      error: 'relation "target_queries" does not exist',
    });
  });

  it('should succeed when no constraint violation', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(createClient as any).mockResolvedValue({
      from: vi.fn(() => ({
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
    });

    const result = await addTargetQuery({
      location_id: LOCATION_ID,
      query_text: 'best hookah bar Alpharetta',
    });

    expect(result).toEqual({ success: true });
  });
});
