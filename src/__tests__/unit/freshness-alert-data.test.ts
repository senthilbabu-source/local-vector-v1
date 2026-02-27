// ---------------------------------------------------------------------------
// freshness-alert-data.test.ts — Sprint 76: Data layer tests
//
// Tests fetchFreshnessAlerts() which queries visibility_analytics and
// delegates to detectFreshnessDecay().
//
// Run: npx vitest run src/__tests__/unit/freshness-alert-data.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { MOCK_FRESHNESS_SNAPSHOTS } from '@/__fixtures__/golden-tenant';

// ---------------------------------------------------------------------------
// Mock Supabase client
// ---------------------------------------------------------------------------

function createMockSupabase(data: unknown[] = [], error: { message: string } | null = null) {
  const mockLimit = vi.fn().mockResolvedValue({ data, error });
  const mockOrder = vi.fn(() => ({ limit: mockLimit }));
  const mockEq = vi.fn(() => ({ order: mockOrder }));
  const mockSelect = vi.fn(() => ({ eq: mockEq }));

  return {
    supabase: {
      from: vi.fn(() => ({ select: mockSelect })),
    } as unknown as SupabaseClient<Database>,
    mocks: { select: mockSelect, eq: mockEq, order: mockOrder, limit: mockLimit },
  };
}

// Import the function under test
const { fetchFreshnessAlerts } = await import('@/lib/data/freshness-alerts');

describe('fetchFreshnessAlerts', () => {
  it('queries visibility_analytics with correct org_id', async () => {
    const { supabase, mocks } = createMockSupabase();
    await fetchFreshnessAlerts(supabase, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');

    expect(supabase.from).toHaveBeenCalledWith('visibility_analytics');
    expect(mocks.select).toHaveBeenCalledWith('snapshot_date, citation_rate, share_of_voice');
    expect(mocks.eq).toHaveBeenCalledWith('org_id', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
  });

  it('orders by snapshot_date ascending and limits to 5', async () => {
    const { supabase, mocks } = createMockSupabase();
    await fetchFreshnessAlerts(supabase, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');

    expect(mocks.order).toHaveBeenCalledWith('snapshot_date', { ascending: true });
    expect(mocks.limit).toHaveBeenCalledWith(5);
  });

  it('returns insufficient_data when no rows exist', async () => {
    const { supabase } = createMockSupabase([]);
    const result = await fetchFreshnessAlerts(supabase, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');

    expect(result.trend).toBe('insufficient_data');
    expect(result.alerts).toHaveLength(0);
  });

  it('detects freshness decay from snapshot data', async () => {
    const { supabase } = createMockSupabase(MOCK_FRESHNESS_SNAPSHOTS);
    const result = await fetchFreshnessAlerts(supabase, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');

    expect(result.trend).toBe('declining');
    expect(result.alerts.length).toBeGreaterThan(0);
  });

  it('handles Supabase error gracefully', async () => {
    const { supabase } = createMockSupabase([], { message: 'DB error' });
    const result = await fetchFreshnessAlerts(supabase, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');

    expect(result.trend).toBe('insufficient_data');
  });
});
