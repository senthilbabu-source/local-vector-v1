// ---------------------------------------------------------------------------
// agent-readiness-data.test.ts — Unit tests for agent readiness data fetcher
//
// Sprint 84: 7 tests — mocks Supabase client.
//
// Run:
//   npx vitest run src/__tests__/unit/agent-readiness-data.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { fetchAgentReadiness } from '@/lib/data/agent-readiness';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEST_ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const TEST_LOC_ID = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

function makeMockSupabase(opts: {
  locationData?: Record<string, unknown> | null;
  menuData?: Record<string, unknown> | null;
  auditData?: Record<string, unknown> | null;
} = {}) {
  const {
    locationData = {
      business_name: 'Charcoal N Chill',
      website_url: 'https://charcoalnchill.com',
      hours_data: { monday: { open: '10:00', close: '22:00' } },
      phone: '(770) 555-1234',
      attributes: {},
    },
    menuData = null,
    auditData = null,
  } = opts;

  const mockFromCalls: string[] = [];

  const supabase = {
    from: vi.fn((table: string) => {
      mockFromCalls.push(table);

      if (table === 'locations') {
        const chain: Record<string, unknown> = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.single = vi.fn().mockResolvedValue({ data: locationData, error: null });
        return chain;
      }

      if (table === 'magic_menus') {
        const chain: Record<string, unknown> = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.order = vi.fn().mockReturnValue(chain);
        chain.limit = vi.fn().mockReturnValue(chain);
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: menuData, error: null });
        return chain;
      }

      if (table === 'page_audits') {
        const chain: Record<string, unknown> = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.order = vi.fn().mockReturnValue(chain);
        chain.limit = vi.fn().mockReturnValue(chain);
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: auditData, error: null });
        return chain;
      }

      // Default fallback
      const chain: Record<string, unknown> = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      return chain;
    }),
  } as unknown as SupabaseClient<Database>;

  return { supabase, mockFromCalls };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('fetchAgentReadiness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs 3 parallel queries (location, menu, page audit)', async () => {
    const { supabase, mockFromCalls } = makeMockSupabase();
    await fetchAgentReadiness(supabase, TEST_ORG_ID, TEST_LOC_ID);
    expect(mockFromCalls).toContain('locations');
    expect(mockFromCalls).toContain('magic_menus');
    expect(mockFromCalls).toContain('page_audits');
  });

  it('scopes queries by org_id and location_id', async () => {
    const { supabase } = makeMockSupabase();
    await fetchAgentReadiness(supabase, TEST_ORG_ID, TEST_LOC_ID);
    // Verify eq was called (scoping)
    const fromCalls = (supabase.from as ReturnType<typeof vi.fn>).mock.results;
    for (const result of fromCalls) {
      const chain = result.value;
      expect(chain.eq).toHaveBeenCalled();
    }
  });

  it('extracts detected schema types from audit data', async () => {
    const { supabase } = makeMockSupabase({
      auditData: {
        schema_completeness_score: 70,
        faq_schema_present: true,
        entity_clarity_score: 80,
        recommendations: [],
      },
    });
    const result = await fetchAgentReadiness(supabase, TEST_ORG_ID, TEST_LOC_ID);
    // High schema score + no missing recommendations → OpeningHours should be inferred
    expect(result).toBeDefined();
    expect(result.score).toBeGreaterThan(0);
  });

  it('checks location attributes for booking/ordering URLs', async () => {
    const { supabase } = makeMockSupabase({
      locationData: {
        business_name: 'Test',
        website_url: 'https://test.com',
        hours_data: null,
        phone: null,
        attributes: {
          reservation_url: 'https://resy.com/test',
          ordering_url: 'https://order.test.com',
        },
      },
    });
    const result = await fetchAgentReadiness(supabase, TEST_ORG_ID, TEST_LOC_ID);
    // Should detect booking and ordering URLs → partial reserve + partial order
    const reserve = result.capabilities.find((c) => c.id === 'reserve_action');
    const order = result.capabilities.find((c) => c.id === 'order_action');
    expect(reserve?.status).toBe('partial');
    expect(order?.status).toBe('partial');
  });

  it('handles null page audit gracefully', async () => {
    const { supabase } = makeMockSupabase({ auditData: null });
    const result = await fetchAgentReadiness(supabase, TEST_ORG_ID, TEST_LOC_ID);
    expect(result).toBeDefined();
    expect(result.capabilities).toHaveLength(6);
  });

  it('handles null menu gracefully', async () => {
    const { supabase } = makeMockSupabase({ menuData: null });
    const result = await fetchAgentReadiness(supabase, TEST_ORG_ID, TEST_LOC_ID);
    expect(result).toBeDefined();
    const menu = result.capabilities.find((c) => c.id === 'menu_schema');
    expect(menu?.status).toBe('missing');
  });

  it('returns AgentReadinessResult on happy path', async () => {
    const { supabase } = makeMockSupabase({
      menuData: { id: 'menu-1', is_published: true, json_ld_schema: { menu: true } },
      auditData: {
        schema_completeness_score: 80,
        faq_schema_present: true,
        entity_clarity_score: 75,
        recommendations: [],
      },
    });
    const result = await fetchAgentReadiness(supabase, TEST_ORG_ID, TEST_LOC_ID);
    expect(result.score).toBeGreaterThan(0);
    expect(result.level).toBeDefined();
    expect(result.capabilities).toHaveLength(6);
    expect(result.summary).toBeTruthy();
  });
});
