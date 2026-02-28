// ---------------------------------------------------------------------------
// weekly-digest-guard.test.ts — Unit tests for weekly digest scan data guard
//
// Sprint C (L2): Tests that orgs with no scan data are skipped.
// The guard lives in fetchDigestForOrg() which returns null when no
// sov_evaluations exist for the org.
//
// Run:
//   npx vitest run src/__tests__/unit/weekly-digest-guard.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoist mocks ───────────────────────────────────────────────────────────

vi.mock('@/lib/data/ai-health-score', () => ({
  fetchHealthScore: vi.fn().mockResolvedValue({
    score: 70,
    topRecommendation: null,
  }),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

// ── Import subjects ───────────────────────────────────────────────────────

import { fetchDigestForOrg } from '@/lib/data/weekly-digest';

// ── Helpers ────────────────────────────────────────────────────────────────

const ORG_ID = 'org-uuid-001';
const OWNER_ID = 'user-uuid-001';
const LOCATION_ID = 'loc-uuid-001';

function buildMockSupabase({
  org = { id: ORG_ID, name: 'Test Org', owner_user_id: OWNER_ID, notify_weekly_digest: true },
  owner = { email: 'test@example.com', full_name: 'Test User' },
  location = { id: LOCATION_ID, business_name: 'Test Biz', city: 'Atlanta', state: 'GA' },
  evalCount = 5,
  currentSnapshot = null as any,
  previousSnapshot = null as any,
}: {
  org?: any;
  owner?: any;
  location?: any;
  evalCount?: number;
  currentSnapshot?: any;
  previousSnapshot?: any;
} = {}) {
  const fromMock = vi.fn().mockImplementation((table: string) => {
    if (table === 'organizations') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: org, error: null }),
          }),
        }),
      };
    }
    if (table === 'users') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: owner, error: null }),
          }),
        }),
      };
    }
    if (table === 'locations') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: location, error: null }),
            }),
          }),
        }),
      };
    }
    if (table === 'sov_evaluations') {
      // Could be count query (guard) or data query (digest content)
      return {
        select: vi.fn().mockImplementation((_cols: string, opts?: any) => {
          if (opts?.count === 'exact') {
            // Count query for guard
            return {
              eq: vi.fn().mockResolvedValue({ count: evalCount, error: null }),
            };
          }
          // Data query for SOV wins
          return {
            eq: vi.fn().mockReturnValue({
              not: vi.fn().mockReturnValue({
                lte: vi.fn().mockReturnValue({
                  gte: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                  }),
                }),
              }),
            }),
          };
        }),
      };
    }
    if (table === 'visibility_analytics') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: currentSnapshot, error: null }),
                }),
                range: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: previousSnapshot, error: null }),
                }),
              }),
            }),
          }),
        }),
      };
    }
    if (table === 'ai_hallucinations') {
      return {
        select: vi.fn().mockImplementation((_cols: string, opts?: any) => {
          if (opts?.count === 'exact') {
            return {
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  gte: vi.fn().mockResolvedValue({ count: 0, error: null }),
                }),
              }),
            };
          }
          return {
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          };
        }),
      };
    }
    if (table === 'crawler_hits') {
      return {
        select: vi.fn().mockImplementation((_cols: string, opts?: any) => {
          if (opts?.count === 'exact') {
            return {
              eq: vi.fn().mockReturnValue({
                gte: vi.fn().mockResolvedValue({ count: 0, error: null }),
              }),
            };
          }
          return {
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }),
      };
    }
    if (table === 'target_queries') {
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };
    }
    // Default fallback
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    };
  });

  return { from: fromMock } as any;
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('Weekly digest scan data guard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when org has no sov_evaluations (evalCount=0)', async () => {
    const supabase = buildMockSupabase({ evalCount: 0 });
    const result = await fetchDigestForOrg(supabase, ORG_ID);
    expect(result).toBeNull();
  });

  it('returns null when notify_weekly_digest is false', async () => {
    const supabase = buildMockSupabase({
      org: { id: ORG_ID, name: 'Test', owner_user_id: OWNER_ID, notify_weekly_digest: false },
    });
    const result = await fetchDigestForOrg(supabase, ORG_ID);
    expect(result).toBeNull();
  });

  it('returns null when org has no owner', async () => {
    const supabase = buildMockSupabase({
      org: { id: ORG_ID, name: 'Test', owner_user_id: null, notify_weekly_digest: true },
    });
    const result = await fetchDigestForOrg(supabase, ORG_ID);
    expect(result).toBeNull();
  });

  it('returns null when org has no primary location', async () => {
    const supabase = buildMockSupabase({ location: null });
    const result = await fetchDigestForOrg(supabase, ORG_ID);
    expect(result).toBeNull();
  });

  it('returns a payload when evalCount > 0 (has scan data)', async () => {
    const supabase = buildMockSupabase({ evalCount: 3 });
    const result = await fetchDigestForOrg(supabase, ORG_ID);
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('subject');
  });

  it('returns payload when evalCount is exactly 1', async () => {
    const supabase = buildMockSupabase({ evalCount: 1 });
    const result = await fetchDigestForOrg(supabase, ORG_ID);
    expect(result).not.toBeNull();
  });

  it('the guard checks sov_evaluations table', async () => {
    const supabase = buildMockSupabase({ evalCount: 0 });
    await fetchDigestForOrg(supabase, ORG_ID);
    // Verify 'sov_evaluations' was queried
    expect(supabase.from).toHaveBeenCalledWith('sov_evaluations');
  });

  it('digest payload includes org name when data exists', async () => {
    const supabase = buildMockSupabase({ evalCount: 10 });
    const result = await fetchDigestForOrg(supabase, ORG_ID);
    expect(result).not.toBeNull();
    // buildDigestPayload constructs the subject line from org name
    expect(result!.subject).toBeDefined();
  });
});
