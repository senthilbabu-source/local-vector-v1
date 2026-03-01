// ---------------------------------------------------------------------------
// src/__tests__/unit/autopilot-deduplicator.test.ts
//
// Unit tests for lib/autopilot/draft-deduplicator.ts
// Validates semantic deduplication logic: exact trigger_id match,
// cooldown-based target query matching, and per-type location cooldowns.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { DraftTrigger } from '@/lib/types/autopilot';
import { deduplicateTriggers } from '@/lib/autopilot/draft-deduplicator';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = 'org-uuid-001';
const LOCATION_ID = 'loc-uuid-001';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTrigger(overrides?: Partial<DraftTrigger>): DraftTrigger {
  return {
    triggerType: 'competitor_gap',
    triggerId: 'trigger-001',
    orgId: ORG_ID,
    locationId: LOCATION_ID,
    context: { targetQuery: 'best hookah bar alpharetta' },
    ...overrides,
  };
}

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function makeMockSupabase(opts: { data?: unknown[]; error?: unknown } = {}) {
  const mockChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({
      data: opts.data ?? [],
      error: opts.error ?? null,
    }),
  };
  return {
    from: vi.fn(() => mockChain),
  } as unknown as SupabaseClient<Database>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('deduplicateTriggers', () => {
  // 1. Empty input
  it('returns empty array for empty triggers input', async () => {
    const supabase = makeMockSupabase();
    const result = await deduplicateTriggers([], supabase, ORG_ID);

    expect(result).toEqual([]);
    // Should not even query DB when input is empty
    expect(supabase.from).not.toHaveBeenCalled();
  });

  // 2. Fail-open on DB error
  it('returns all triggers on DB error (fail-open)', async () => {
    const supabase = makeMockSupabase({
      error: { message: 'connection refused' },
    });
    const triggers = [makeTrigger(), makeTrigger({ triggerId: 'trigger-002' })];

    const result = await deduplicateTriggers(triggers, supabase, ORG_ID);

    expect(result).toEqual(triggers);
    expect(result).toHaveLength(2);
  });

  // 3. No existing drafts — all triggers pass through
  it('returns all triggers when no existing drafts found', async () => {
    const supabase = makeMockSupabase({ data: [] });
    const triggers = [
      makeTrigger(),
      makeTrigger({ triggerId: 'trigger-002', context: { targetQuery: 'shisha lounge decatur' } }),
    ];

    const result = await deduplicateTriggers(triggers, supabase, ORG_ID);

    expect(result).toEqual(triggers);
    expect(result).toHaveLength(2);
  });

  // 4. Exact trigger_id match — filters out duplicate
  it('filters trigger with exact trigger_id match', async () => {
    const supabase = makeMockSupabase({
      data: [
        {
          trigger_type: 'competitor_gap',
          trigger_id: 'trigger-001',
          target_prompt: 'some other query',
          location_id: LOCATION_ID,
          created_at: daysAgo(5),
        },
      ],
    });
    const triggers = [makeTrigger({ triggerId: 'trigger-001' })];

    const result = await deduplicateTriggers(triggers, supabase, ORG_ID);

    expect(result).toHaveLength(0);
  });

  // 5. trigger_id mismatch — trigger passes through
  it('allows trigger when trigger_id does not match any existing draft', async () => {
    const supabase = makeMockSupabase({
      data: [
        {
          trigger_type: 'competitor_gap',
          trigger_id: 'trigger-999',
          target_prompt: 'unrelated query',
          location_id: LOCATION_ID,
          created_at: daysAgo(5),
        },
      ],
    });
    const triggers = [makeTrigger({ triggerId: 'trigger-001' })];

    const result = await deduplicateTriggers(triggers, supabase, ORG_ID);

    expect(result).toHaveLength(1);
    expect(result[0].triggerId).toBe('trigger-001');
  });

  // 6. Same target query within cooldown — filtered
  it('filters trigger when same target query exists within cooldown', async () => {
    // competitor_gap cooldown = 14 days; draft created 10 days ago = within cooldown
    const supabase = makeMockSupabase({
      data: [
        {
          trigger_type: 'competitor_gap',
          trigger_id: 'different-trigger-id',
          target_prompt: 'best hookah bar alpharetta',
          location_id: LOCATION_ID,
          created_at: daysAgo(10),
        },
      ],
    });
    // Use a different triggerId so exact-match rule does not fire
    const triggers = [makeTrigger({ triggerId: null })];

    const result = await deduplicateTriggers(triggers, supabase, ORG_ID);

    expect(result).toHaveLength(0);
  });

  // 7. Same target query outside cooldown — allowed
  it('allows trigger when same target query exists outside cooldown', async () => {
    // competitor_gap cooldown = 14 days; draft created 20 days ago = outside cooldown
    const supabase = makeMockSupabase({
      data: [
        {
          trigger_type: 'competitor_gap',
          trigger_id: 'different-trigger-id',
          target_prompt: 'best hookah bar alpharetta',
          location_id: LOCATION_ID,
          created_at: daysAgo(20),
        },
      ],
    });
    const triggers = [makeTrigger({ triggerId: null })];

    const result = await deduplicateTriggers(triggers, supabase, ORG_ID);

    expect(result).toHaveLength(1);
  });

  // 8. Case-insensitive target query matching
  it('matches target query case-insensitively', async () => {
    const supabase = makeMockSupabase({
      data: [
        {
          trigger_type: 'competitor_gap',
          trigger_id: 'other-id',
          target_prompt: '  BEST Hookah Bar ALPHARETTA  ',
          location_id: LOCATION_ID,
          created_at: daysAgo(5),
        },
      ],
    });
    const triggers = [
      makeTrigger({
        triggerId: null,
        context: { targetQuery: 'best hookah bar alpharetta' },
      }),
    ];

    const result = await deduplicateTriggers(triggers, supabase, ORG_ID);

    expect(result).toHaveLength(0);
  });

  // 9. review_gap: at most 1 per location per 60-day cooldown
  it('review_gap: filters when same location has draft within 60-day cooldown', async () => {
    // review_gap cooldown = 60 days; draft created 30 days ago = within cooldown
    const supabase = makeMockSupabase({
      data: [
        {
          trigger_type: 'review_gap',
          trigger_id: 'old-review-trigger',
          target_prompt: null,
          location_id: LOCATION_ID,
          created_at: daysAgo(30),
        },
      ],
    });
    const triggers = [
      makeTrigger({
        triggerType: 'review_gap',
        triggerId: null,
        context: {
          topNegativeKeywords: ['slow service'],
          negativeReviewCount: 5,
        },
      }),
    ];

    const result = await deduplicateTriggers(triggers, supabase, ORG_ID);

    expect(result).toHaveLength(0);
  });

  // 10. schema_gap: at most 1 per location per 30-day cooldown
  it('schema_gap: filters when same location has draft within 30-day cooldown', async () => {
    // schema_gap cooldown = 30 days; draft created 15 days ago = within cooldown
    const supabase = makeMockSupabase({
      data: [
        {
          trigger_type: 'schema_gap',
          trigger_id: 'old-schema-trigger',
          target_prompt: null,
          location_id: LOCATION_ID,
          created_at: daysAgo(15),
        },
      ],
    });
    const triggers = [
      makeTrigger({
        triggerType: 'schema_gap',
        triggerId: null,
        context: {
          schemaHealthScore: 42,
          missingPageTypes: ['menu', 'faq'],
        },
      }),
    ];

    const result = await deduplicateTriggers(triggers, supabase, ORG_ID);

    expect(result).toHaveLength(0);
  });

  // 11. competitor_gap uses 14-day cooldown for query matching
  it('competitor_gap uses 14-day cooldown for query matching', async () => {
    // Draft created 13 days ago = within 14-day cooldown -> filtered
    const supabaseWithin = makeMockSupabase({
      data: [
        {
          trigger_type: 'competitor_gap',
          trigger_id: 'other-id',
          target_prompt: 'best hookah bar alpharetta',
          location_id: LOCATION_ID,
          created_at: daysAgo(13),
        },
      ],
    });
    const trigger = makeTrigger({ triggerId: null });

    const resultWithin = await deduplicateTriggers([trigger], supabaseWithin, ORG_ID);
    expect(resultWithin).toHaveLength(0);

    // Draft created 15 days ago = outside 14-day cooldown -> allowed
    const supabaseOutside = makeMockSupabase({
      data: [
        {
          trigger_type: 'competitor_gap',
          trigger_id: 'other-id',
          target_prompt: 'best hookah bar alpharetta',
          location_id: LOCATION_ID,
          created_at: daysAgo(15),
        },
      ],
    });

    const resultOutside = await deduplicateTriggers([trigger], supabaseOutside, ORG_ID);
    expect(resultOutside).toHaveLength(1);
  });

  // 12. Null triggerId — no exact match possible, only query/type checks
  it('allows trigger when triggerId is null and no query match exists', async () => {
    const supabase = makeMockSupabase({
      data: [
        {
          trigger_type: 'competitor_gap',
          trigger_id: 'some-other-trigger',
          target_prompt: 'completely different query',
          location_id: LOCATION_ID,
          created_at: daysAgo(3),
        },
      ],
    });
    const triggers = [
      makeTrigger({
        triggerId: null,
        context: { targetQuery: 'best hookah bar alpharetta' },
      }),
    ];

    const result = await deduplicateTriggers(triggers, supabase, ORG_ID);

    expect(result).toHaveLength(1);
    expect(result[0].triggerId).toBeNull();
  });
});
