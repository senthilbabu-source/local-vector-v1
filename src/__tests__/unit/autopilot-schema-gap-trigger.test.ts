import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { detectSchemaGapTriggers } from '@/lib/autopilot/triggers/schema-gap-trigger';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = 'org-uuid-001';
const LOCATION_ID = 'loc-uuid-001';

// ---------------------------------------------------------------------------
// Mock Supabase factory
// ---------------------------------------------------------------------------

function makeMockSupabase(
  opts: {
    location?: unknown;
    locationError?: unknown;
    schemas?: unknown[];
    schemasError?: unknown;
  } = {},
) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'locations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: opts.location ?? null,
                error: opts.locationError ?? null,
              }),
            }),
          }),
        };
      }
      if (table === 'page_schemas') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: opts.schemas ?? null,
                error: opts.schemasError ?? null,
              }),
            }),
          }),
        };
      }
      return {};
    }),
  } as unknown as SupabaseClient<Database>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLocation(overrides?: Record<string, unknown>) {
  return {
    id: LOCATION_ID,
    schema_health_score: 40,
    schema_last_run_at: '2026-02-28T12:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('detectSchemaGapTriggers', () => {
  it('returns empty when location is not found', async () => {
    const supabase = makeMockSupabase({ location: null });
    const result = await detectSchemaGapTriggers(supabase, LOCATION_ID, ORG_ID);
    expect(result).toEqual([]);
  });

  it('returns empty on location DB error', async () => {
    const supabase = makeMockSupabase({
      location: null,
      locationError: { message: 'DB connection failed', code: 'PGRST301' },
    });
    const result = await detectSchemaGapTriggers(supabase, LOCATION_ID, ORG_ID);
    expect(result).toEqual([]);
  });

  it('returns empty when schema_last_run_at is null (never scanned)', async () => {
    const supabase = makeMockSupabase({
      location: makeLocation({ schema_last_run_at: null }),
    });
    const result = await detectSchemaGapTriggers(supabase, LOCATION_ID, ORG_ID);
    expect(result).toEqual([]);
  });

  it('returns empty when schema_health_score is null', async () => {
    const supabase = makeMockSupabase({
      location: makeLocation({ schema_health_score: null }),
    });
    const result = await detectSchemaGapTriggers(supabase, LOCATION_ID, ORG_ID);
    expect(result).toEqual([]);
  });

  it('returns empty when schema_health_score >= 60 (at threshold)', async () => {
    const supabase = makeMockSupabase({
      location: makeLocation({ schema_health_score: 60 }),
      schemas: [],
    });
    const result = await detectSchemaGapTriggers(supabase, LOCATION_ID, ORG_ID);
    expect(result).toEqual([]);
  });

  it('returns a trigger when schema_health_score < 60', async () => {
    const supabase = makeMockSupabase({
      location: makeLocation({ schema_health_score: 45 }),
      schemas: [{ page_type: 'homepage' }],
    });
    const result = await detectSchemaGapTriggers(supabase, LOCATION_ID, ORG_ID);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      triggerType: 'schema_gap',
      triggerId: LOCATION_ID,
      orgId: ORG_ID,
      locationId: LOCATION_ID,
    });
    expect(result[0].context.schemaHealthScore).toBe(45);
  });

  it('identifies missing required page types', async () => {
    const supabase = makeMockSupabase({
      location: makeLocation({ schema_health_score: 30 }),
      schemas: [{ page_type: 'homepage' }],
    });
    const result = await detectSchemaGapTriggers(supabase, LOCATION_ID, ORG_ID);

    expect(result).toHaveLength(1);
    const { context } = result[0];
    expect(context.missingPageTypes).toEqual(['faq', 'about']);
    expect(context.targetQuery).toBe('structured data for faq page');
  });

  it('returns empty on page_schemas DB error', async () => {
    const supabase = makeMockSupabase({
      location: makeLocation({ schema_health_score: 40 }),
      schemasError: { message: 'relation not found', code: '42P01' },
    });
    const result = await detectSchemaGapTriggers(supabase, LOCATION_ID, ORG_ID);
    expect(result).toEqual([]);
  });

  it('sets topMissingImpact based on impact order (homepage > faq > about)', async () => {
    // Missing homepage and about — homepage should be top impact
    const supabase1 = makeMockSupabase({
      location: makeLocation({ schema_health_score: 20 }),
      schemas: [{ page_type: 'faq' }],
    });
    const result1 = await detectSchemaGapTriggers(supabase1, LOCATION_ID, ORG_ID);
    expect(result1[0].context.topMissingImpact).toBe(
      'homepage schema missing — highest AEO impact',
    );

    // Missing only about — about should be top impact
    const supabase2 = makeMockSupabase({
      location: makeLocation({ schema_health_score: 20 }),
      schemas: [{ page_type: 'homepage' }, { page_type: 'faq' }],
    });
    const result2 = await detectSchemaGapTriggers(supabase2, LOCATION_ID, ORG_ID);
    expect(result2[0].context.topMissingImpact).toBe(
      'about schema missing — highest AEO impact',
    );

    // Missing only faq — faq should be top impact
    const supabase3 = makeMockSupabase({
      location: makeLocation({ schema_health_score: 20 }),
      schemas: [{ page_type: 'homepage' }, { page_type: 'about' }],
    });
    const result3 = await detectSchemaGapTriggers(supabase3, LOCATION_ID, ORG_ID);
    expect(result3[0].context.topMissingImpact).toBe(
      'faq schema missing — highest AEO impact',
    );
  });

  it('handles all required pages present (no missing types in context)', async () => {
    const supabase = makeMockSupabase({
      location: makeLocation({ schema_health_score: 50 }),
      schemas: [
        { page_type: 'homepage' },
        { page_type: 'faq' },
        { page_type: 'about' },
      ],
    });
    const result = await detectSchemaGapTriggers(supabase, LOCATION_ID, ORG_ID);

    expect(result).toHaveLength(1);
    const { context } = result[0];
    expect(context.missingPageTypes).toBeUndefined();
    expect(context.topMissingImpact).toBeUndefined();
    expect(context.targetQuery).toBe('structured data for business page');
  });
});
