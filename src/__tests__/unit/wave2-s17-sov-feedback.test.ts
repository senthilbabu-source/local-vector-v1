// ---------------------------------------------------------------------------
// wave2-s17-sov-feedback.test.ts — S17: Content → SOV Feedback Loop
// AI_RULES §217
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  rankToPercent,
  buildImpactLabel,
  capturePrePublishRank,
  backfillPostPublishRanks,
} from '@/lib/services/publish-rank.service';

// ---------------------------------------------------------------------------
// Pure: rankToPercent
// ---------------------------------------------------------------------------

describe('rankToPercent', () => {
  it('returns null for null', () => {
    expect(rankToPercent(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(rankToPercent(undefined as unknown as null)).toBeNull();
  });

  it('converts 0.0 → 0', () => {
    expect(rankToPercent(0)).toBe(0);
  });

  it('converts 0.5 → 50', () => {
    expect(rankToPercent(0.5)).toBe(50);
  });

  it('converts 1.0 → 100', () => {
    expect(rankToPercent(1.0)).toBe(100);
  });

  it('rounds fractional values', () => {
    expect(rankToPercent(0.333)).toBe(33);
    expect(rankToPercent(0.667)).toBe(67);
  });
});

// ---------------------------------------------------------------------------
// Pure: buildImpactLabel
// ---------------------------------------------------------------------------

describe('buildImpactLabel', () => {
  it('returns null when pre is null', () => {
    expect(buildImpactLabel(null, 50)).toBeNull();
  });

  it('returns null when post is null', () => {
    expect(buildImpactLabel(40, null)).toBeNull();
  });

  it('returns null when both are null', () => {
    expect(buildImpactLabel(null, null)).toBeNull();
  });

  it('marks improvement when post > pre', () => {
    const result = buildImpactLabel(30, 55);
    expect(result).not.toBeNull();
    expect(result!.improved).toBe(true);
    expect(result!.label).toContain('30%');
    expect(result!.label).toContain('55%');
    expect(result!.label).toContain('+25');
  });

  it('marks degradation when post < pre', () => {
    const result = buildImpactLabel(60, 40);
    expect(result).not.toBeNull();
    expect(result!.improved).toBe(false);
    expect(result!.label).toContain('-20');
  });

  it('marks unchanged when equal', () => {
    const result = buildImpactLabel(50, 50);
    expect(result).not.toBeNull();
    expect(result!.improved).toBe(false);
    expect(result!.label).toContain('unchanged');
  });
});

// ---------------------------------------------------------------------------
// I/O: capturePrePublishRank
// ---------------------------------------------------------------------------

function makeSupabase(overrides: {
  draftData?: object | null;
  draftError?: object | null;
  rankData?: object[] | null;
} = {}) {
  const updateMock = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
  });

  const rankLimit = vi.fn().mockResolvedValue({ data: overrides.rankData ?? null });
  const rankOrder = vi.fn().mockReturnValue({ limit: rankLimit });
  const rankEqLoc = vi.fn().mockReturnValue({ order: rankOrder });
  const rankEqQuery = vi.fn().mockReturnValue({ order: rankOrder, eq: rankEqLoc });
  const rankEqOrg = vi.fn().mockReturnValue({ eq: rankEqQuery });
  const rankSelect = vi.fn().mockReturnValue({ eq: rankEqOrg });

  const draftEqOrg = vi.fn().mockReturnValue({
    maybeSingle: vi.fn().mockResolvedValue({
      data: overrides.draftData ?? null,
      error: overrides.draftError ?? null,
    }),
  });
  const draftEqId = vi.fn().mockReturnValue({ eq: draftEqOrg });
  const draftSelect = vi.fn().mockReturnValue({ eq: draftEqId });

  return {
    from: vi.fn((table: string) => {
      if (table === 'content_drafts') return { select: draftSelect, update: updateMock };
      if (table === 'sov_evaluations') return { select: rankSelect };
      return {};
    }),
    _updateMock: updateMock,
  };
}

describe('capturePrePublishRank', () => {
  it('returns early for non-prompt_missing trigger_type', async () => {
    const supabase = makeSupabase({
      draftData: { id: 'd1', trigger_id: 't1', location_id: null, trigger_type: 'manual' },
    });
    await capturePrePublishRank(supabase as never, 'd1', 'org1');
    expect(supabase._updateMock).not.toHaveBeenCalled();
  });

  it('returns early when trigger_id is null', async () => {
    const supabase = makeSupabase({
      draftData: { id: 'd1', trigger_id: null, location_id: null, trigger_type: 'prompt_missing' },
    });
    await capturePrePublishRank(supabase as never, 'd1', 'org1');
    expect(supabase._updateMock).not.toHaveBeenCalled();
  });

  it('returns early on draft fetch error', async () => {
    const supabase = makeSupabase({ draftData: null, draftError: { message: 'DB error' } });
    await capturePrePublishRank(supabase as never, 'd1', 'org1');
    expect(supabase._updateMock).not.toHaveBeenCalled();
  });

  it('calls update with rank_position when SOV data exists', async () => {
    const supabase = makeSupabase({
      draftData: { id: 'd1', trigger_id: 'tq1', location_id: null, trigger_type: 'prompt_missing' },
      rankData: [{ rank_position: 0.65 }],
    });
    await capturePrePublishRank(supabase as never, 'd1', 'org1');
    expect(supabase._updateMock).toHaveBeenCalled();
  });

  it('calls update with null rank when no SOV data', async () => {
    const supabase = makeSupabase({
      draftData: { id: 'd1', trigger_id: 'tq1', location_id: null, trigger_type: 'prompt_missing' },
      rankData: [],
    });
    await capturePrePublishRank(supabase as never, 'd1', 'org1');
    expect(supabase._updateMock).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// I/O: backfillPostPublishRanks
// ---------------------------------------------------------------------------

describe('backfillPostPublishRanks', () => {
  it('returns 0 when no eligible drafts', async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    };
    const count = await backfillPostPublishRanks(supabase as never, 'org1');
    expect(count).toBe(0);
  });

  it('returns 0 on DB error', async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: null, error: { message: 'err' } }),
      })),
    };
    const count = await backfillPostPublishRanks(supabase as never, 'org1');
    expect(count).toBe(0);
  });
});
