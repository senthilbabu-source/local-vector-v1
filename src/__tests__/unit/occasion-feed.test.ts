// ---------------------------------------------------------------------------
// occasion-feed.test.ts — Unit tests for occasion alert feed data layer
//
// Sprint 101: 20 tests — getOccasionAlerts + getOccasionAlertCount
//
// Run:
//   npx vitest run src/__tests__/unit/occasion-feed.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock getDaysUntilPeak (from occasion-engine.service)
// ---------------------------------------------------------------------------

const mockGetDaysUntilPeak = vi.fn();
vi.mock('@/lib/services/occasion-engine.service', () => ({
  getDaysUntilPeak: (...args: unknown[]) => mockGetDaysUntilPeak(...args),
}));

// ---------------------------------------------------------------------------
// Supabase mock
// ---------------------------------------------------------------------------

function createOccasion(id: string, name: string, daysUntil: number, annualDate: string | null = '07-04') {
  mockGetDaysUntilPeak.mockImplementation((occ: { id: string }) => {
    if (occ.id === id) return daysUntil;
    return 999; // default: out of window
  });
  return {
    id,
    name,
    occasion_type: 'holiday',
    trigger_days_before: 28,
    annual_date: annualDate,
    peak_query_patterns: [],
    relevant_categories: [],
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
  };
}

function createMockSupabase(overrides?: {
  occasions?: Array<ReturnType<typeof createOccasion>>;
  snoozes?: Array<{ occasion_id: string; snoozed_until: string }>;
  existingDrafts?: Array<{ trigger_id: string | null }>;
  occasionError?: boolean;
  snoozeError?: boolean;
  draftError?: boolean;
}) {
  const opts = {
    occasions: [],
    snoozes: [],
    existingDrafts: [],
    occasionError: false,
    snoozeError: false,
    draftError: false,
    ...overrides,
  };

  // Configure getDaysUntilPeak for each occasion
  const daysMap = new Map<string, number>();
  for (const occ of opts.occasions) {
    // Store the daysUntil from the occasion fixture for getDaysUntilPeak mock
  }

  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'local_occasions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              data: opts.occasionError ? null : opts.occasions,
              error: opts.occasionError ? { message: 'DB error' } : null,
            }),
          }),
        };
      }
      if (table === 'occasion_snoozes') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                data: opts.snoozeError ? null : opts.snoozes,
                error: opts.snoozeError ? { message: 'DB error' } : null,
              }),
            }),
          }),
        };
      }
      if (table === 'content_drafts') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  in: vi.fn().mockReturnValue({
                    data: opts.draftError ? null : opts.existingDrafts,
                    error: opts.draftError ? { message: 'DB error' } : null,
                  }),
                  data: opts.draftError ? null : opts.existingDrafts,
                  error: opts.draftError ? { message: 'DB error' } : null,
                }),
              }),
            }),
          }),
        };
      }
      return {};
    }),
  } as unknown as Parameters<typeof getOccasionAlerts>[0];
}

// ---------------------------------------------------------------------------
// Import under test (after mocks)
// ---------------------------------------------------------------------------

import { getOccasionAlerts, getOccasionAlertCount } from '@/lib/occasions/occasion-feed';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getOccasionAlerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns occasions within the next 14 days', async () => {
    const occ = createOccasion('occ1', 'Independence Day', 5);
    mockGetDaysUntilPeak.mockReturnValue(5);

    const supabase = createMockSupabase({ occasions: [occ] });
    const result = await getOccasionAlerts(supabase, 'org1', 'user1', null);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Independence Day');
    expect(result[0].daysUntil).toBe(5);
  });

  it('does NOT return occasions more than 14 days away', async () => {
    const occ = createOccasion('occ1', 'Christmas', 45);
    mockGetDaysUntilPeak.mockReturnValue(45);

    const supabase = createMockSupabase({ occasions: [occ] });
    const result = await getOccasionAlerts(supabase, 'org1', 'user1', null);
    expect(result).toHaveLength(0);
  });

  it('does NOT return occasions in the past', async () => {
    const occ = createOccasion('occ1', 'Past Event', -3);
    mockGetDaysUntilPeak.mockReturnValue(-3);

    const supabase = createMockSupabase({ occasions: [occ] });
    const result = await getOccasionAlerts(supabase, 'org1', 'user1', null);
    expect(result).toHaveLength(0);
  });

  it('returns occasion for today (daysUntil=0)', async () => {
    const occ = createOccasion('occ1', 'Today Event', 0);
    mockGetDaysUntilPeak.mockReturnValue(0);

    const supabase = createMockSupabase({ occasions: [occ] });
    const result = await getOccasionAlerts(supabase, 'org1', 'user1', null);
    expect(result).toHaveLength(1);
    expect(result[0].daysUntil).toBe(0);
  });

  it('filters out occasions with active snooze (snoozed_until > now)', async () => {
    const occ = createOccasion('occ1', 'Snoozed Event', 5);
    mockGetDaysUntilPeak.mockReturnValue(5);

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 2);

    const supabase = createMockSupabase({
      occasions: [occ],
      snoozes: [{ occasion_id: 'occ1', snoozed_until: futureDate.toISOString() }],
    });
    const result = await getOccasionAlerts(supabase, 'org1', 'user1', null);
    expect(result).toHaveLength(0);
  });

  it('includes occasions whose snooze has expired (snoozed_until < now)', async () => {
    const occ = createOccasion('occ1', 'Expired Snooze', 5);
    mockGetDaysUntilPeak.mockReturnValue(5);

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);

    const supabase = createMockSupabase({
      occasions: [occ],
      snoozes: [{ occasion_id: 'occ1', snoozed_until: pastDate.toISOString() }],
    });
    const result = await getOccasionAlerts(supabase, 'org1', 'user1', null);
    expect(result).toHaveLength(1);
  });

  it('filters out occasions where content_draft exists for this org', async () => {
    const occ = createOccasion('occ1', 'Drafted Event', 5);
    mockGetDaysUntilPeak.mockReturnValue(5);

    const supabase = createMockSupabase({
      occasions: [occ],
      existingDrafts: [{ trigger_id: 'occ1' }],
    });
    const result = await getOccasionAlerts(supabase, 'org1', 'user1', null);
    expect(result).toHaveLength(0);
  });

  it('returns at most 3 occasions even when more qualify', async () => {
    const occasions = Array.from({ length: 5 }, (_, i) => {
      return createOccasion(`occ${i}`, `Event ${i}`, i + 1);
    });
    // Configure getDaysUntilPeak for each
    mockGetDaysUntilPeak.mockImplementation((occ: { id: string }) => {
      const idx = parseInt(occ.id.replace('occ', ''));
      return idx + 1;
    });

    const supabase = createMockSupabase({ occasions });
    const result = await getOccasionAlerts(supabase, 'org1', 'user1', null);
    expect(result).toHaveLength(3);
  });

  it('sorts by date ASC (most urgent first)', async () => {
    const occ1 = createOccasion('occ1', 'Far Event', 10);
    const occ2 = createOccasion('occ2', 'Near Event', 2);
    mockGetDaysUntilPeak.mockImplementation((occ: { id: string }) => {
      return occ.id === 'occ1' ? 10 : 2;
    });

    const supabase = createMockSupabase({ occasions: [occ1, occ2] });
    const result = await getOccasionAlerts(supabase, 'org1', 'user1', null);
    expect(result[0].name).toBe('Near Event');
    expect(result[1].name).toBe('Far Event');
  });

  it('sets isUrgent=true when daysUntil <= 3', async () => {
    const occ = createOccasion('occ1', 'Urgent Event', 2);
    mockGetDaysUntilPeak.mockReturnValue(2);

    const supabase = createMockSupabase({ occasions: [occ] });
    const result = await getOccasionAlerts(supabase, 'org1', 'user1', null);
    expect(result[0].isUrgent).toBe(true);
  });

  it('sets isUrgent=false when daysUntil >= 4', async () => {
    const occ = createOccasion('occ1', 'Normal Event', 7);
    mockGetDaysUntilPeak.mockReturnValue(7);

    const supabase = createMockSupabase({ occasions: [occ] });
    const result = await getOccasionAlerts(supabase, 'org1', 'user1', null);
    expect(result[0].isUrgent).toBe(false);
  });

  it('returns [] when local_occasions table is empty', async () => {
    const supabase = createMockSupabase({ occasions: [] });
    const result = await getOccasionAlerts(supabase, 'org1', 'user1', null);
    expect(result).toEqual([]);
  });

  it('returns [] on DB error (never throws)', async () => {
    const supabase = createMockSupabase({ occasionError: true });
    const result = await getOccasionAlerts(supabase, 'org1', 'user1', null);
    expect(result).toEqual([]);
  });

  it('handles null locationId gracefully', async () => {
    const occ = createOccasion('occ1', 'Test', 5);
    mockGetDaysUntilPeak.mockReturnValue(5);

    const supabase = createMockSupabase({ occasions: [occ] });
    const result = await getOccasionAlerts(supabase, 'org1', 'user1', null);
    expect(result).toHaveLength(1);
  });
});

describe('getOccasionAlertCount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns count of active occasions in next 14 days', async () => {
    const occ1 = createOccasion('occ1', 'Event 1', 5);
    const occ2 = createOccasion('occ2', 'Event 2', 10);
    mockGetDaysUntilPeak.mockImplementation((occ: { id: string }) => {
      return occ.id === 'occ1' ? 5 : 10;
    });

    const supabase = createMockSupabase({ occasions: [occ1, occ2] });
    const count = await getOccasionAlertCount(supabase, 'org1', 'user1');
    expect(count).toBe(2);
  });

  it('returns 0 when all occasions snoozed', async () => {
    const occ = createOccasion('occ1', 'Snoozed', 5);
    mockGetDaysUntilPeak.mockReturnValue(5);

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);

    const supabase = createMockSupabase({
      occasions: [occ],
      snoozes: [{ occasion_id: 'occ1', snoozed_until: futureDate.toISOString() }],
    });
    const count = await getOccasionAlertCount(supabase, 'org1', 'user1');
    expect(count).toBe(0);
  });

  it('returns 0 on DB error (never throws)', async () => {
    const supabase = createMockSupabase({ occasionError: true });
    const count = await getOccasionAlertCount(supabase, 'org1', 'user1');
    expect(count).toBe(0);
  });
});
