// ---------------------------------------------------------------------------
// reality-score-snapshot.test.ts — P8-FIX-33
//
// Tests writeRealityScoreSnapshot() which persists computed reality scores
// to the visibility_scores table after each SOV scan.
//
// Pure mock-based — no real DB calls.
//
// Run:
//   npx vitest run src/__tests__/unit/reality-score-snapshot.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { writeRealityScoreSnapshot } from '@/lib/services/reality-score.service';

// Mock Sentry
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

import * as Sentry from '@sentry/nextjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockSupabase(options: {
  previousScore?: number | null;
  upsertError?: boolean;
}) {
  const upsertMock = vi.fn().mockResolvedValue(
    options.upsertError
      ? { error: { message: 'upsert failed' } }
      : { error: null },
  );

  const fromMock = vi.fn().mockImplementation((table: string) => {
    if (table === 'visibility_scores') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: options.previousScore !== undefined && options.previousScore !== null
            ? { reality_score: options.previousScore }
            : null,
        }),
        upsert: upsertMock,
      };
    }
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    };
  });

  return { from: fromMock, _upsertMock: upsertMock };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('writeRealityScoreSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('upserts correct shape with all component scores', async () => {
    const mock = createMockSupabase({ previousScore: null });
    // shareOfVoice=0.6 → visibilityScore=60, 0 alerts → accuracy=100, dataHealth=80
    // realityScore = Math.round(60*0.4 + 100*0.4 + 80*0.2) = Math.round(24+40+16) = 80
    await writeRealityScoreSnapshot(
      mock as any, 'org-1', 'loc-1', 0.6, 0, 80, null,
    );

    expect(mock._upsertMock).toHaveBeenCalledOnce();
    const upsertArg = mock._upsertMock.mock.calls[0][0];
    expect(upsertArg).toMatchObject({
      org_id: 'org-1',
      location_id: 'loc-1',
      visibility_score: 60,
      accuracy_score: 100,
      data_health_score: 80,
      reality_score: 80,
      score_delta: null, // no previous row
    });
    expect(upsertArg.snapshot_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('computes score_delta from previous row', async () => {
    const mock = createMockSupabase({ previousScore: 70 });
    // Same input as above → realityScore=80, delta=80-70=10
    await writeRealityScoreSnapshot(
      mock as any, 'org-1', 'loc-1', 0.6, 0, 80, null,
    );

    const upsertArg = mock._upsertMock.mock.calls[0][0];
    expect(upsertArg.score_delta).toBe(10);
    expect(upsertArg.reality_score).toBe(80);
  });

  it('score_delta is null when no previous row exists', async () => {
    const mock = createMockSupabase({ previousScore: null });
    await writeRealityScoreSnapshot(
      mock as any, 'org-1', 'loc-1', 0.6, 0, 80, null,
    );

    const upsertArg = mock._upsertMock.mock.calls[0][0];
    expect(upsertArg.score_delta).toBeNull();
  });

  it('uses simulation score fallback when dataHealthScore is null', async () => {
    const mock = createMockSupabase({ previousScore: null });
    // dataHealth fallback: Math.round(100*0.5 + 50*0.5) = 75
    // realityScore = Math.round(60*0.4 + 100*0.4 + 75*0.2) = Math.round(24+40+15) = 79
    await writeRealityScoreSnapshot(
      mock as any, 'org-1', 'loc-1', 0.6, 0, null, 50,
    );

    const upsertArg = mock._upsertMock.mock.calls[0][0];
    expect(upsertArg.data_health_score).toBe(75);
    expect(upsertArg.reality_score).toBe(79);
  });

  it('uses correct onConflict key', async () => {
    const mock = createMockSupabase({ previousScore: null });
    await writeRealityScoreSnapshot(
      mock as any, 'org-1', 'loc-1', 0.6, 0, 80, null,
    );

    const onConflictArg = mock._upsertMock.mock.calls[0][1];
    expect(onConflictArg).toEqual({ onConflict: 'org_id,location_id,snapshot_date' });
  });

  it('computes accuracy correctly with open alerts', async () => {
    const mock = createMockSupabase({ previousScore: null });
    // 2 alerts → accuracy = max(40, 100-30) = 70
    // realityScore = Math.round(60*0.4 + 70*0.4 + 100*0.2) = Math.round(24+28+20) = 72
    await writeRealityScoreSnapshot(
      mock as any, 'org-1', 'loc-1', 0.6, 2, null, null,
    );

    const upsertArg = mock._upsertMock.mock.calls[0][0];
    expect(upsertArg.accuracy_score).toBe(70);
    expect(upsertArg.reality_score).toBe(72);
  });

  it('swallows errors and reports to Sentry', async () => {
    const fromMock = vi.fn().mockImplementation(() => {
      throw new Error('DB connection failed');
    });
    const mock = { from: fromMock };

    // Should not throw
    await writeRealityScoreSnapshot(
      mock as any, 'org-1', 'loc-1', 0.6, 0, 80, null,
    );

    expect(Sentry.captureException).toHaveBeenCalledOnce();
    const capturedErr = (Sentry.captureException as any).mock.calls[0][0];
    expect(capturedErr.message).toBe('DB connection failed');
  });

  it('handles negative score_delta correctly', async () => {
    const mock = createMockSupabase({ previousScore: 90 });
    // realityScore=80, delta=80-90=-10
    await writeRealityScoreSnapshot(
      mock as any, 'org-1', 'loc-1', 0.6, 0, 80, null,
    );

    const upsertArg = mock._upsertMock.mock.calls[0][0];
    expect(upsertArg.score_delta).toBe(-10);
  });
});
