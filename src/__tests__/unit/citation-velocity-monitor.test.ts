// ---------------------------------------------------------------------------
// citation-velocity-monitor.test.ts — Sprint 108: Citation Velocity Monitor
//
// 15 tests covering saveAuthoritySnapshot (5), computeCitationVelocity (6),
// shouldAlertDecay (3), getAuthorityHistory (1).
//
// Run:
//   npx vitest run src/__tests__/unit/citation-velocity-monitor.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { EntityAuthorityProfile } from '@/lib/authority/types';

// ── Mock setup ────────────────────────────────────────────────────────────

const mockCaptureException = vi.hoisted(() => vi.fn());

vi.mock('@sentry/nextjs', () => ({
  captureException: mockCaptureException,
}));

import {
  saveAuthoritySnapshot,
  computeCitationVelocity,
  shouldAlertDecay,
  getAuthorityHistory,
} from '@/lib/authority/citation-velocity-monitor';

// ── Test data ─────────────────────────────────────────────────────────────

const LOCATION_ID = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

const MOCK_PROFILE: EntityAuthorityProfile = {
  location_id: LOCATION_ID,
  org_id: ORG_ID,
  entity_authority_score: 72,
  dimensions: {
    tier1_citation_score: 22,
    tier2_coverage_score: 18,
    platform_breadth_score: 14,
    sameas_score: 10,
    velocity_score: 8,
  },
  tier_breakdown: {
    tier1: 5,
    tier2: 12,
    tier3: 8,
    unknown: 3,
  },
  top_citations: [],
  sameas_gaps: [],
  citation_velocity: 15.5,
  velocity_label: 'growing',
  recommendations: [],
  snapshot_at: '2026-03-01T00:00:00.000Z',
};

// ── Supabase mock builder ─────────────────────────────────────────────────

function createMockSupabase(overrides: {
  upsertResult?: { error: unknown };
  selectResult?: { data: unknown; error: unknown };
  selectAllResult?: { data: unknown; error: unknown };
} = {}) {
  const mockUpsert = vi.fn().mockResolvedValue(
    overrides.upsertResult ?? { error: null },
  );

  const mockMaybeSingle = vi.fn().mockResolvedValue(
    overrides.selectResult ?? { data: null, error: null },
  );

  const mockSelectAllChain = vi.fn().mockResolvedValue(
    overrides.selectAllResult ?? { data: [], error: null },
  );

  const mockLimit = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
  const mockLimitAll = vi.fn().mockImplementation(() => mockSelectAllChain());

  const mockOrder = vi.fn().mockImplementation(() => ({
    limit: mockLimit,
  }));

  const mockOrderAll = vi.fn().mockImplementation(() => ({
    limit: mockLimitAll,
  }));

  const mockLt = vi.fn().mockReturnValue({ order: mockOrder, limit: mockLimit });

  const mockEq = vi.fn().mockImplementation(() => ({
    lt: mockLt,
    order: mockOrderAll,
    limit: mockLimitAll,
  }));

  const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

  const supabase = {
    from: vi.fn().mockReturnValue({
      upsert: mockUpsert,
      select: mockSelect,
    }),
  } as unknown as SupabaseClient<Database> & { _mockUpsert: typeof mockUpsert };

  (supabase as any)._mockUpsert = mockUpsert;

  return supabase;
}

// ── Setup ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Fix the date to 2026-03-15 for deterministic snapshot_month
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-03-15T12:00:00.000Z'));
});

// ── saveAuthoritySnapshot ─────────────────────────────────────────────────

describe('saveAuthoritySnapshot', () => {
  it('calls upsert with correct data', async () => {
    const supabase = createMockSupabase();

    await saveAuthoritySnapshot(supabase, LOCATION_ID, ORG_ID, MOCK_PROFILE);

    expect(supabase.from).toHaveBeenCalledWith('entity_authority_snapshots');
    expect((supabase as any)._mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        location_id: LOCATION_ID,
        org_id: ORG_ID,
        entity_authority_score: 72,
        tier1_count: 5,
        tier2_count: 12,
        tier3_count: 8,
        sameas_count: 10,
        snapshot_month: '2026-03',
      }),
      { onConflict: 'location_id,snapshot_month' },
    );
  });

  it('computes total_citations correctly (tier1 + tier2 + tier3 + unknown)', async () => {
    const supabase = createMockSupabase();

    await saveAuthoritySnapshot(supabase, LOCATION_ID, ORG_ID, MOCK_PROFILE);

    // 5 + 12 + 8 + 3 = 28
    expect((supabase as any)._mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ total_citations: 28 }),
      expect.any(Object),
    );
  });

  it('generates correct snapshot_month format (YYYY-MM)', async () => {
    const supabase = createMockSupabase();

    // Date is fixed to 2026-03-15
    await saveAuthoritySnapshot(supabase, LOCATION_ID, ORG_ID, MOCK_PROFILE);

    expect((supabase as any)._mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ snapshot_month: '2026-03' }),
      expect.any(Object),
    );
  });

  it('calls Sentry.captureException on error', async () => {
    const dbError = { message: 'unique violation', code: '23505' };
    const supabase = createMockSupabase({ upsertResult: { error: dbError } });

    await saveAuthoritySnapshot(supabase, LOCATION_ID, ORG_ID, MOCK_PROFILE);

    expect(mockCaptureException).toHaveBeenCalledWith(dbError, {
      tags: { file: 'citation-velocity-monitor.ts', sprint: '108' },
      extra: { locationId: LOCATION_ID, snapshotMonth: '2026-03' },
    });
  });

  it('does not throw on error (logs only)', async () => {
    const dbError = { message: 'connection refused', code: 'ECONNREFUSED' };
    const supabase = createMockSupabase({ upsertResult: { error: dbError } });

    // Should resolve without throwing
    await expect(
      saveAuthoritySnapshot(supabase, LOCATION_ID, ORG_ID, MOCK_PROFILE),
    ).resolves.toBeUndefined();
  });
});

// ── computeCitationVelocity ───────────────────────────────────────────────

describe('computeCitationVelocity', () => {
  const CURRENT_TIER_BREAKDOWN = { tier1: 8, tier2: 15, tier3: 7 }; // total = 30

  it('returns null when no previous snapshot exists', async () => {
    const supabase = createMockSupabase({
      selectResult: { data: null, error: null },
    });

    const result = await computeCitationVelocity(supabase, LOCATION_ID, CURRENT_TIER_BREAKDOWN);

    expect(result).toBeNull();
  });

  it('returns null when previous total_citations is 0', async () => {
    const supabase = createMockSupabase({
      selectResult: {
        data: { total_citations: 0, snapshot_month: '2026-02' },
        error: null,
      },
    });

    const result = await computeCitationVelocity(supabase, LOCATION_ID, CURRENT_TIER_BREAKDOWN);

    expect(result).toBeNull();
  });

  it('returns null on query error', async () => {
    const supabase = createMockSupabase({
      selectResult: { data: null, error: { message: 'timeout' } },
    });

    const result = await computeCitationVelocity(supabase, LOCATION_ID, CURRENT_TIER_BREAKDOWN);

    expect(result).toBeNull();
  });

  it('computes positive velocity correctly', async () => {
    // Previous: 20, Current: 30 → ((30-20)/20)*100 = 50%
    const supabase = createMockSupabase({
      selectResult: {
        data: { total_citations: 20, snapshot_month: '2026-02' },
        error: null,
      },
    });

    const result = await computeCitationVelocity(supabase, LOCATION_ID, CURRENT_TIER_BREAKDOWN);

    expect(result).toBe(50);
  });

  it('computes negative velocity correctly', async () => {
    // Previous: 50, Current: 30 → ((30-50)/50)*100 = -40%
    const supabase = createMockSupabase({
      selectResult: {
        data: { total_citations: 50, snapshot_month: '2026-02' },
        error: null,
      },
    });

    const result = await computeCitationVelocity(supabase, LOCATION_ID, CURRENT_TIER_BREAKDOWN);

    expect(result).toBe(-40);
  });

  it('rounds to 2 decimal places', async () => {
    // Previous: 7, Current: 30 → ((30-7)/7)*100 = 328.571428... → 328.57
    const supabase = createMockSupabase({
      selectResult: {
        data: { total_citations: 7, snapshot_month: '2026-02' },
        error: null,
      },
    });

    const result = await computeCitationVelocity(supabase, LOCATION_ID, CURRENT_TIER_BREAKDOWN);

    expect(result).toBe(328.57);
  });
});

// ── shouldAlertDecay ──────────────────────────────────────────────────────

describe('shouldAlertDecay', () => {
  it('returns false for null velocity', () => {
    expect(shouldAlertDecay(null)).toBe(false);
  });

  it('returns false for -19 (above threshold)', () => {
    expect(shouldAlertDecay(-19)).toBe(false);
  });

  it('returns true for -21 (below threshold)', () => {
    expect(shouldAlertDecay(-21)).toBe(true);
  });
});

// ── getAuthorityHistory ───────────────────────────────────────────────────

describe('getAuthorityHistory', () => {
  it('returns mapped snapshots from DB', async () => {
    const dbRows = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        location_id: LOCATION_ID,
        org_id: ORG_ID,
        entity_authority_score: 65,
        tier1_count: 4,
        tier2_count: 10,
        tier3_count: 6,
        total_citations: 20,
        sameas_count: 8,
        snapshot_month: '2026-01',
        created_at: '2026-01-31T00:00:00.000Z',
      },
      {
        id: '22222222-2222-2222-2222-222222222222',
        location_id: LOCATION_ID,
        org_id: ORG_ID,
        entity_authority_score: 70,
        tier1_count: 5,
        tier2_count: 12,
        tier3_count: 8,
        total_citations: 25,
        sameas_count: 9,
        snapshot_month: '2026-02',
        created_at: '2026-02-28T00:00:00.000Z',
      },
    ];

    const supabase = createMockSupabase({
      selectAllResult: { data: dbRows, error: null },
    });

    const result = await getAuthorityHistory(supabase, LOCATION_ID, 6);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: '11111111-1111-1111-1111-111111111111',
      location_id: LOCATION_ID,
      org_id: ORG_ID,
      entity_authority_score: 65,
      tier_breakdown: { tier1: 4, tier2: 10, tier3: 6 },
      total_citations: 20,
      sameas_count: 8,
      snapshot_month: '2026-01',
      created_at: '2026-01-31T00:00:00.000Z',
    });
    expect(result[1]).toEqual({
      id: '22222222-2222-2222-2222-222222222222',
      location_id: LOCATION_ID,
      org_id: ORG_ID,
      entity_authority_score: 70,
      tier_breakdown: { tier1: 5, tier2: 12, tier3: 8 },
      total_citations: 25,
      sameas_count: 9,
      snapshot_month: '2026-02',
      created_at: '2026-02-28T00:00:00.000Z',
    });
  });
});
