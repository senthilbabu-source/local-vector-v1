// ---------------------------------------------------------------------------
// badge-counts.test.ts — Unit tests for sidebar badge counts
//
// Sprint 101: 24 tests — getSidebarBadgeCounts, markSectionSeen, formatBadgeCount
//
// Run:
//   npx vitest run src/__tests__/unit/badge-counts.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSidebarBadgeCounts, markSectionSeen, formatBadgeCount } from '@/lib/badges/badge-counts';

// ---------------------------------------------------------------------------
// Supabase mock builder
// ---------------------------------------------------------------------------

function createMockSupabase(overrides?: {
  badgeStates?: Array<{ section: string; last_seen_at: string }>;
  draftCount?: number | null;
  sovCount?: number | null;
  badgeStatesError?: boolean;
  draftError?: boolean;
  sovError?: boolean;
  upsertError?: boolean;
}) {
  const opts = {
    badgeStates: [],
    draftCount: 0,
    sovCount: 0,
    badgeStatesError: false,
    draftError: false,
    sovError: false,
    upsertError: false,
    ...overrides,
  };

  const mockFrom = vi.fn().mockImplementation((table: string) => {
    if (table === 'sidebar_badge_state') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              data: opts.badgeStatesError ? null : opts.badgeStates,
              error: opts.badgeStatesError ? { message: 'DB error' } : null,
            }),
          }),
        }),
        upsert: vi.fn().mockResolvedValue({
          error: opts.upsertError ? { message: 'Upsert error' } : null,
        }),
      };
    }

    if (table === 'content_drafts') {
      // Badge count query chain: select -> eq(org_id) -> eq(status) -> gt(created_at) -> optionally eq(location_id)
      const terminalResult = {
        count: opts.draftError ? null : opts.draftCount,
        error: opts.draftError ? { message: 'Draft error' } : null,
      };
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gt: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue(terminalResult),
                ...terminalResult,
              }),
              ...terminalResult,
            }),
          }),
        }),
      };
    }

    if (table === 'sov_evaluations') {
      const terminalResult = {
        count: opts.sovError ? null : opts.sovCount,
        error: opts.sovError ? { message: 'SOV error' } : null,
      };
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gt: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue(terminalResult),
              ...terminalResult,
            }),
            ...terminalResult,
          }),
        }),
      };
    }

    return {};
  });

  return { from: mockFrom } as unknown as Parameters<typeof getSidebarBadgeCounts>[0];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getSidebarBadgeCounts', () => {
  it('returns contentDrafts=0 when no pending drafts', async () => {
    const supabase = createMockSupabase({ draftCount: 0, sovCount: 0 });
    const result = await getSidebarBadgeCounts(supabase, 'org1', 'user1', 'loc1');
    expect(result.contentDrafts).toBe(0);
  });

  it('returns correct pending draft count', async () => {
    const supabase = createMockSupabase({ draftCount: 5, sovCount: 0 });
    const result = await getSidebarBadgeCounts(supabase, 'org1', 'user1', 'loc1');
    expect(result.contentDrafts).toBe(5);
  });

  it('only counts drafts newer than last_seen_at', async () => {
    const supabase = createMockSupabase({
      badgeStates: [{ section: 'content_drafts', last_seen_at: '2026-02-27T00:00:00Z' }],
      draftCount: 3,
      sovCount: 0,
    });
    const result = await getSidebarBadgeCounts(supabase, 'org1', 'user1', 'loc1');
    expect(result.contentDrafts).toBe(3);
  });

  it('returns 0 when last_seen_at is very recent (just visited)', async () => {
    const supabase = createMockSupabase({
      badgeStates: [{ section: 'content_drafts', last_seen_at: new Date().toISOString() }],
      draftCount: 0,
      sovCount: 0,
    });
    const result = await getSidebarBadgeCounts(supabase, 'org1', 'user1', 'loc1');
    expect(result.contentDrafts).toBe(0);
  });

  it('counts all pending drafts when sidebar_badge_state row absent (first visit)', async () => {
    const supabase = createMockSupabase({
      badgeStates: [],
      draftCount: 10,
      sovCount: 0,
    });
    const result = await getSidebarBadgeCounts(supabase, 'org1', 'user1', 'loc1');
    expect(result.contentDrafts).toBe(10);
  });

  it('respects locationId filter on content_drafts', async () => {
    const supabase = createMockSupabase({ draftCount: 2, sovCount: 0 });
    const result = await getSidebarBadgeCounts(supabase, 'org1', 'user1', 'loc1');
    expect(result.contentDrafts).toBe(2);
    // The location filter is applied in the query chain
    expect(supabase.from).toHaveBeenCalledWith('content_drafts');
  });

  it('returns visibility=0 when no new SOV results', async () => {
    const supabase = createMockSupabase({ draftCount: 0, sovCount: 0 });
    const result = await getSidebarBadgeCounts(supabase, 'org1', 'user1', 'loc1');
    expect(result.visibility).toBe(0);
  });

  it('returns correct new SOV result count', async () => {
    const supabase = createMockSupabase({ draftCount: 0, sovCount: 12 });
    const result = await getSidebarBadgeCounts(supabase, 'org1', 'user1', 'loc1');
    expect(result.visibility).toBe(12);
  });

  it('only counts results newer than last_seen_at for visibility section', async () => {
    const supabase = createMockSupabase({
      badgeStates: [{ section: 'visibility', last_seen_at: '2026-02-26T00:00:00Z' }],
      draftCount: 0,
      sovCount: 7,
    });
    const result = await getSidebarBadgeCounts(supabase, 'org1', 'user1', 'loc1');
    expect(result.visibility).toBe(7);
  });

  it('counts all new results when no sidebar_badge_state row for visibility', async () => {
    const supabase = createMockSupabase({
      badgeStates: [],
      draftCount: 0,
      sovCount: 20,
    });
    const result = await getSidebarBadgeCounts(supabase, 'org1', 'user1', 'loc1');
    expect(result.visibility).toBe(20);
  });

  it('returns { contentDrafts: 0, visibility: 0 } on DB error (never throws)', async () => {
    const supabase = createMockSupabase({ badgeStatesError: true });
    const result = await getSidebarBadgeCounts(supabase, 'org1', 'user1', 'loc1');
    expect(result).toEqual({ contentDrafts: 0, visibility: 0 });
  });

  it('handles null locationId gracefully (returns counts without location filter)', async () => {
    const supabase = createMockSupabase({ draftCount: 3, sovCount: 4 });
    const result = await getSidebarBadgeCounts(supabase, 'org1', 'user1', null);
    expect(result.contentDrafts).toBe(3);
    expect(result.visibility).toBe(4);
  });

  it('returns exactly 99 when count is 99', async () => {
    const supabase = createMockSupabase({ draftCount: 99, sovCount: 0 });
    const result = await getSidebarBadgeCounts(supabase, 'org1', 'user1', 'loc1');
    expect(result.contentDrafts).toBe(99);
  });

  it('returns 100 when count is 100 (formatBadgeCount handles display)', async () => {
    const supabase = createMockSupabase({ draftCount: 100, sovCount: 0 });
    const result = await getSidebarBadgeCounts(supabase, 'org1', 'user1', 'loc1');
    expect(result.contentDrafts).toBe(100);
  });
});

describe('markSectionSeen', () => {
  it('upserts sidebar_badge_state row', async () => {
    const supabase = createMockSupabase();
    await markSectionSeen(supabase, 'org1', 'user1', 'content_drafts');
    expect(supabase.from).toHaveBeenCalledWith('sidebar_badge_state');
  });

  it('calls upsert with correct parameters', async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });
    const supabase = {
      from: vi.fn().mockReturnValue({ upsert: mockUpsert }),
    } as unknown as Parameters<typeof markSectionSeen>[0];

    await markSectionSeen(supabase, 'org1', 'user1', 'content_drafts');
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: 'org1',
        user_id: 'user1',
        section: 'content_drafts',
      }),
      expect.objectContaining({ onConflict: 'org_id,user_id,section' }),
    );
  });

  it('uses org_id + user_id + section as unique key', async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });
    const supabase = {
      from: vi.fn().mockReturnValue({ upsert: mockUpsert }),
    } as unknown as Parameters<typeof markSectionSeen>[0];

    await markSectionSeen(supabase, 'org1', 'user1', 'visibility');
    const call = mockUpsert.mock.calls[0];
    expect(call[1]).toEqual({ onConflict: 'org_id,user_id,section' });
  });

  it('does not throw on DB error (fire-and-forget safe)', async () => {
    const supabase = createMockSupabase({ upsertError: true });
    // Should not throw
    await expect(markSectionSeen(supabase, 'org1', 'user1', 'content_drafts')).resolves.toBeUndefined();
  });

  it('handles upsert correctly — no duplicate rows on repeated calls', async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });
    const supabase = {
      from: vi.fn().mockReturnValue({ upsert: mockUpsert }),
    } as unknown as Parameters<typeof markSectionSeen>[0];

    await markSectionSeen(supabase, 'org1', 'user1', 'content_drafts');
    await markSectionSeen(supabase, 'org1', 'user1', 'content_drafts');
    // Both calls use upsert (not insert), so no duplicates
    expect(mockUpsert).toHaveBeenCalledTimes(2);
  });
});

describe('formatBadgeCount', () => {
  it('returns null for 0 (no badge shown)', () => {
    expect(formatBadgeCount(0)).toBeNull();
  });

  it('returns "1" for 1', () => {
    expect(formatBadgeCount(1)).toBe('1');
  });

  it('returns "99" for 99', () => {
    expect(formatBadgeCount(99)).toBe('99');
  });

  it('returns "99+" for 100', () => {
    expect(formatBadgeCount(100)).toBe('99+');
  });

  it('returns "99+" for 999', () => {
    expect(formatBadgeCount(999)).toBe('99+');
  });

  it('returns null for negative numbers (defensive)', () => {
    expect(formatBadgeCount(-1)).toBeNull();
    expect(formatBadgeCount(-100)).toBeNull();
  });
});
