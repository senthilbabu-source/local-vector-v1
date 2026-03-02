import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockAnalyzeIngestion,
  mockSimulateQueries,
  mockSelectQueries,
  mockBuildGapAnalysis,
  mockComputeHallucinationRisk,
  mockComputeSimulationScore,
  mockCaptureException,
} = vi.hoisted(() => ({
  mockAnalyzeIngestion: vi.fn(),
  mockSimulateQueries: vi.fn(),
  mockSelectQueries: vi.fn(),
  mockBuildGapAnalysis: vi.fn(),
  mockComputeHallucinationRisk: vi.fn(),
  mockComputeSimulationScore: vi.fn(),
  mockCaptureException: vi.fn(),
}));

vi.mock('@sentry/nextjs', () => ({ captureException: mockCaptureException }));
vi.mock('@/lib/sandbox/content-ingestion-analyzer', () => ({
  analyzeContentIngestion: mockAnalyzeIngestion,
}));
vi.mock('@/lib/sandbox/query-simulation-engine', () => ({
  simulateQueriesAgainstContent: mockSimulateQueries,
  selectQueriesForSimulation: mockSelectQueries,
}));
vi.mock('@/lib/sandbox/hallucination-gap-scorer', () => ({
  buildGapAnalysis: mockBuildGapAnalysis,
  computeHallucinationRisk: mockComputeHallucinationRisk,
  computeSimulationScore: mockComputeSimulationScore,
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  runSimulation,
  getSimulationHistory,
  getLatestSimulationRun,
  checkDailyRateLimit,
} from '@/lib/sandbox/simulation-orchestrator';
import type { SimulationInput } from '@/lib/sandbox/types';
import {
  MOCK_SANDBOX_GROUND_TRUTH,
  MOCK_INGESTION_RESULT,
  MOCK_QUERY_SIMULATION_RESULTS,
  MOCK_GAP_ANALYSIS,
} from '@/__fixtures__/golden-tenant';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInput(overrides: Partial<SimulationInput> = {}): SimulationInput {
  return {
    location_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    content_text: Array(50).fill('test word').join(' '),
    content_source: 'freeform',
    modes: ['ingestion', 'query', 'gap_analysis'],
    ...overrides,
  };
}

// Mock chain builder
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockSelectHistory = vi.fn();
const mockSelectLatest = vi.fn();
const mockSelectRateLimit = vi.fn();
const mockSelectGT = vi.fn();

function buildMockSupabase() {
  // A flexible mock that returns different chains based on table name
  const supabase = {
    from: vi.fn((table: string) => {
      if (table === 'locations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: mockSelectGT,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'simulation_runs') {
        return {
          select: vi.fn((_cols: string, opts?: { count?: string; head?: boolean }) => {
            if (opts?.head) {
              // Rate limit count query
              return {
                eq: vi.fn().mockReturnValue({
                  gte: mockSelectRateLimit,
                }),
              };
            }
            // History or latest query
            return {
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: mockSelectLatest,
                  }),
                }),
              }),
            };
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: mockInsert,
            }),
          }),
        };
      }
      return {};
    }),
  } as unknown as SupabaseClient<Database>;
  return supabase;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();

  // Default: rate limit allows
  mockSelectRateLimit.mockResolvedValue({ count: 0, error: null });

  // Default: GT found
  mockSelectGT.mockResolvedValue({
    data: {
      id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      business_name: 'Charcoal N Chill',
      address_line1: '11950 Jones Bridge Road Ste 103',
      city: 'Alpharetta',
      state: 'GA',
      zip: '30005',
      phone: '(470) 546-4866',
      website_url: 'https://charcoalnchill.com',
      hours_data: { tuesday: { open: '17:00', close: '01:00' } },
      amenities: { has_outdoor_seating: true, has_hookah: true },
      categories: ['Hookah Bar'],
    },
    error: null,
  });

  // Default: insert succeeds
  mockInsert.mockResolvedValue({
    data: { id: 'sim-new', run_at: '2026-03-01T12:00:00Z' },
    error: null,
  });

  // Default: analyzer + query sim results
  mockAnalyzeIngestion.mockResolvedValue({
    result: MOCK_INGESTION_RESULT,
    tokensUsed: { input: 200, output: 100 },
  });
  mockSelectQueries.mockResolvedValue([
    { id: 'q-1', query_text: 'Best hookah?', query_category: 'discovery' },
  ]);
  mockSimulateQueries.mockResolvedValue({
    results: MOCK_QUERY_SIMULATION_RESULTS,
    tokensUsed: { input: 300, output: 150 },
  });
  mockBuildGapAnalysis.mockReturnValue(MOCK_GAP_ANALYSIS);
  mockComputeHallucinationRisk.mockReturnValue('medium');
  mockComputeSimulationScore.mockReturnValue(68);
});

// ---------------------------------------------------------------------------
// checkDailyRateLimit
// ---------------------------------------------------------------------------

describe('checkDailyRateLimit', () => {
  it('allows when under limit', async () => {
    mockSelectRateLimit.mockResolvedValue({ count: 5, error: null });
    const supabase = buildMockSupabase();
    const result = await checkDailyRateLimit(supabase, 'org-1');
    expect(result.allowed).toBe(true);
    expect(result.runs_today).toBe(5);
    expect(result.remaining).toBe(15);
  });

  it('blocks when at limit', async () => {
    mockSelectRateLimit.mockResolvedValue({ count: 20, error: null });
    const supabase = buildMockSupabase();
    const result = await checkDailyRateLimit(supabase, 'org-1');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('fails open on DB error (allows)', async () => {
    mockSelectRateLimit.mockResolvedValue({ count: null, error: { message: 'db fail' } });
    const supabase = buildMockSupabase();
    const result = await checkDailyRateLimit(supabase, 'org-1');
    expect(result.allowed).toBe(true);
    expect(result.runs_today).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// runSimulation
// ---------------------------------------------------------------------------

describe('runSimulation', () => {
  it('returns completed run with scores on success', async () => {
    const supabase = buildMockSupabase();
    const run = await runSimulation(supabase, makeInput());
    expect(run.status).toBe('completed');
    expect(run.simulation_score).toBe(68);
    expect(run.ingestion_result).toEqual(MOCK_INGESTION_RESULT);
    expect(run.query_results).toEqual(MOCK_QUERY_SIMULATION_RESULTS);
  });

  it('returns failed run when rate limited', async () => {
    mockSelectRateLimit.mockResolvedValue({ count: 25, error: null });
    const supabase = buildMockSupabase();
    const run = await runSimulation(supabase, makeInput());
    expect(run.status).toBe('failed');
    expect(run.errors).toContain('rate_limit_exceeded');
  });

  it('returns failed run when location not found', async () => {
    mockSelectGT.mockResolvedValue({ data: null, error: null });
    const supabase = buildMockSupabase();
    const run = await runSimulation(supabase, makeInput());
    expect(run.status).toBe('failed');
    expect(run.errors).toContain('location_not_found');
  });

  it('runs only ingestion when modes=[ingestion]', async () => {
    const supabase = buildMockSupabase();
    await runSimulation(supabase, makeInput({ modes: ['ingestion'] }));
    expect(mockAnalyzeIngestion).toHaveBeenCalled();
    expect(mockSelectQueries).not.toHaveBeenCalled();
    expect(mockSimulateQueries).not.toHaveBeenCalled();
  });

  it('runs query simulation when modes=[query]', async () => {
    const supabase = buildMockSupabase();
    await runSimulation(supabase, makeInput({ modes: ['query'] }));
    expect(mockSelectQueries).toHaveBeenCalled();
  });

  it('builds gap analysis when modes include gap_analysis', async () => {
    const supabase = buildMockSupabase();
    const run = await runSimulation(supabase, makeInput({ modes: ['query', 'gap_analysis'] }));
    expect(mockBuildGapAnalysis).toHaveBeenCalled();
    expect(run.gap_analysis).toEqual(MOCK_GAP_ANALYSIS);
  });

  it('handles ingestion error gracefully (partial status)', async () => {
    mockAnalyzeIngestion.mockRejectedValue(new Error('API fail'));
    const supabase = buildMockSupabase();
    const run = await runSimulation(supabase, makeInput());
    expect(run.status).toBe('partial');
    expect(run.errors.some((e: string) => e.includes('ingestion_error'))).toBe(true);
    expect(mockCaptureException).toHaveBeenCalled();
  });

  it('handles query simulation error gracefully', async () => {
    mockSimulateQueries.mockRejectedValue(new Error('timeout'));
    const supabase = buildMockSupabase();
    const run = await runSimulation(supabase, makeInput());
    expect(run.errors.some((e: string) => e.includes('query_error'))).toBe(true);
  });

  it('truncates content to MAX_CONTENT_CHARS_STORED', async () => {
    const longContent = 'x'.repeat(10000);
    const supabase = buildMockSupabase();
    const run = await runSimulation(supabase, makeInput({ content_text: longContent }));
    expect(run.content_text.length).toBeLessThanOrEqual(5000);
  });

  it('defaults to all 3 modes when modes array is empty', async () => {
    const supabase = buildMockSupabase();
    const run = await runSimulation(supabase, makeInput({ modes: [] }));
    expect(run.modes_run).toEqual(['ingestion', 'query', 'gap_analysis']);
  });

  it('handles top-level exception (never throws)', async () => {
    // Force an error in rate limit check path
    const supabase = {
      from: vi.fn(() => { throw new Error('complete meltdown'); }),
    } as unknown as SupabaseClient<Database>;
    const run = await runSimulation(supabase, makeInput());
    expect(run.status).toBe('failed');
    expect(run.errors[0]).toContain('complete meltdown');
    expect(mockCaptureException).toHaveBeenCalled();
  });

  it('updates locations columns after save', async () => {
    const supabase = buildMockSupabase();
    await runSimulation(supabase, makeInput());
    // The mock 'from' was called with 'locations' for the update
    expect(supabase.from).toHaveBeenCalledWith('locations');
  });

  it('skips query sim when no active queries exist', async () => {
    mockSelectQueries.mockResolvedValue([]);
    const supabase = buildMockSupabase();
    const run = await runSimulation(supabase, makeInput({ modes: ['query'] }));
    expect(mockSimulateQueries).not.toHaveBeenCalled();
    expect(run.query_results).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getSimulationHistory
// ---------------------------------------------------------------------------

describe('getSimulationHistory', () => {
  it('returns mapped history entries', async () => {
    const rows = [
      {
        id: 'sim-1',
        content_source: 'freeform',
        draft_id: null,
        simulation_score: 75,
        hallucination_risk: 'low',
        query_coverage_rate: '0.800',
        run_at: '2026-03-01T10:00:00Z',
      },
    ];
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: rows, error: null }),
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient<Database>;

    const history = await getSimulationHistory(supabase, 'loc-1');
    expect(history).toHaveLength(1);
    expect(history[0].simulation_score).toBe(75);
    expect(history[0].query_coverage_rate).toBe(0.8);
  });

  it('returns empty on error', async () => {
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: null, error: { message: 'fail' } }),
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient<Database>;

    const history = await getSimulationHistory(supabase, 'loc-1');
    expect(history).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getLatestSimulationRun
// ---------------------------------------------------------------------------

describe('getLatestSimulationRun', () => {
  it('returns mapped run on success', async () => {
    const row = {
      id: 'sim-1',
      location_id: 'loc-1',
      org_id: 'org-1',
      content_source: 'freeform',
      draft_id: null,
      content_text: 'Test',
      content_word_count: 1,
      modes_run: ['ingestion'],
      ingestion_result: null,
      query_results: [],
      gap_analysis: null,
      simulation_score: 60,
      ingestion_accuracy: 60,
      query_coverage_rate: '0.500',
      hallucination_risk: 'medium',
      run_at: '2026-03-01T10:00:00Z',
      claude_model: 'claude-sonnet-4-20250514',
      input_tokens_used: 100,
      output_tokens_used: 50,
      status: 'completed',
      errors: [],
    };
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
                }),
              }),
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient<Database>;

    const run = await getLatestSimulationRun(supabase, 'loc-1');
    expect(run).not.toBeNull();
    expect(run!.simulation_score).toBe(60);
    expect(run!.query_coverage_rate).toBe(0.5);
  });

  it('returns null on error', async () => {
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: 'fail' } }),
                }),
              }),
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient<Database>;

    const run = await getLatestSimulationRun(supabase, 'loc-1');
    expect(run).toBeNull();
  });
});
