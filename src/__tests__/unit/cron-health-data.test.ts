// ---------------------------------------------------------------------------
// cron-health-data.test.ts — Sprint 76: Data layer tests
//
// Tests fetchCronHealth() which queries cron_run_log via service-role client
// and delegates to buildCronHealthSummary().
//
// Run: npx vitest run src/__tests__/unit/cron-health-data.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MOCK_CRON_RUN_SUCCESS, MOCK_CRON_RUN_FAILED } from '@/__fixtures__/golden-tenant';

// ---------------------------------------------------------------------------
// Mock Supabase service-role client
// ---------------------------------------------------------------------------

const mockSelect = vi.fn().mockReturnThis();
const mockOrder = vi.fn().mockReturnThis();
const mockLimit = vi.fn().mockResolvedValue({ data: [], error: null });

const mockSupabase = {
  from: vi.fn(() => ({
    select: mockSelect,
    order: mockOrder,
    limit: mockLimit,
  })),
};

vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: vi.fn(() => mockSupabase),
}));

// Import after mock setup
const { fetchCronHealth } = await import('@/lib/data/cron-health');

describe('fetchCronHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLimit.mockResolvedValue({ data: [], error: null });
  });

  it('queries cron_run_log table', async () => {
    await fetchCronHealth();
    expect(mockSupabase.from).toHaveBeenCalledWith('cron_run_log');
  });

  it('orders by started_at descending and limits to 100', async () => {
    await fetchCronHealth();
    expect(mockOrder).toHaveBeenCalledWith('started_at', { ascending: false });
    expect(mockLimit).toHaveBeenCalledWith(100);
  });

  it('returns healthy summary when no rows exist', async () => {
    const result = await fetchCronHealth();
    expect(result.overallStatus).toBe('healthy');
    expect(result.jobs).toHaveLength(7);
    expect(result.recentRuns).toHaveLength(0);
  });

  it('passes rows to buildCronHealthSummary', async () => {
    mockLimit.mockResolvedValue({
      data: [MOCK_CRON_RUN_SUCCESS, MOCK_CRON_RUN_FAILED],
      error: null,
    });

    const result = await fetchCronHealth();
    expect(result.recentRuns).toHaveLength(2);
    expect(result.jobs.find((j) => j.cronName === 'audit')!.lastStatus).toBe('success');
  });

  it('handles Supabase error gracefully', async () => {
    mockLimit.mockResolvedValue({ data: null, error: { message: 'DB error' } });

    const result = await fetchCronHealth();
    expect(result.overallStatus).toBe('healthy');
    expect(result.recentRuns).toHaveLength(0);
  });
});
