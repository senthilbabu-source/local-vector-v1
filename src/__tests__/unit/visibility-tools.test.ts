// ---------------------------------------------------------------------------
// visibility-tools.test.ts — Unit tests for lib/tools/visibility-tools.ts
//
// Strategy:
//   • Supabase is mocked at the module level — no real DB calls.
//   • Tests verify tool definitions and return shapes.
//
// Run:
//   npx vitest run src/__tests__/unit/visibility-tools.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock Supabase ──────────────────────────────────────────────────────

const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
const mockLimit = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
const mockEq = vi.fn().mockImplementation(() => ({
    eq: mockEq,
    order: mockOrder,
    limit: mockLimit,
    maybeSingle: mockMaybeSingle,
}));
const mockSelect = vi.fn().mockImplementation(() => ({
    eq: mockEq,
    order: mockOrder,
    limit: mockLimit,
}));
const mockFrom = vi.fn().mockReturnValue({
    select: mockSelect,
});

vi.mock('@/lib/supabase/server', () => ({
    createServiceRoleClient: vi.fn(() => ({
        from: mockFrom,
    })),
}));

// Mock ai module's tool function to pass through
vi.mock('ai', () => ({
    tool: vi.fn(({ description, parameters, execute }) => ({
        description,
        parameters,
        execute,
    })),
    jsonSchema: vi.fn((schema) => ({ jsonSchema: schema })),
}));

import { makeVisibilityTools } from '@/lib/tools/visibility-tools';

// ── Tests ──────────────────────────────────────────────────────────────

describe('makeVisibilityTools', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns 4 tool definitions', () => {
        const tools = makeVisibilityTools('org-123');
        expect(Object.keys(tools)).toHaveLength(4);
        expect(tools).toHaveProperty('getVisibilityScore');
        expect(tools).toHaveProperty('getSOVTrend');
        expect(tools).toHaveProperty('getHallucinations');
        expect(tools).toHaveProperty('getCompetitorComparison');
    });

    it('getVisibilityScore returns visibility_score type', async () => {
        mockMaybeSingle.mockResolvedValue({
            data: { share_of_voice: 0.45, citation_rate: 0.8, snapshot_date: '2026-02-24' },
            error: null,
        });
        mockEq.mockImplementation(() => ({
            eq: vi.fn().mockResolvedValue({ count: 2, error: null }),
            order: mockOrder,
            limit: mockLimit,
            maybeSingle: mockMaybeSingle,
        }));

        const tools = makeVisibilityTools('org-123');
        const result = await tools.getVisibilityScore.execute({}, { toolCallId: 'test', messages: [], abortSignal: undefined as any });

        expect(result.type).toBe('visibility_score');
    });

    it('getSOVTrend returns sov_trend type', async () => {
        mockLimit.mockResolvedValue({ data: [], error: null });

        const tools = makeVisibilityTools('org-123');
        const result = await tools.getSOVTrend.execute({ limit: 12 }, { toolCallId: 'test', messages: [], abortSignal: undefined as any });

        expect(result.type).toBe('sov_trend');
        expect(Array.isArray(result.data)).toBe(true);
    });

    it('getHallucinations returns hallucinations type', async () => {
        const mockChain = {
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
        };
        mockSelect.mockReturnValue(mockChain);

        const tools = makeVisibilityTools('org-123');
        const result = await tools.getHallucinations.execute({ status: 'open' }, { toolCallId: 'test', messages: [], abortSignal: undefined as any });

        expect(result.type).toBe('hallucinations');
        expect(result.filter).toBe('open');
    });

    it('getCompetitorComparison returns competitor_comparison type', async () => {
        mockOrder.mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        });

        const tools = makeVisibilityTools('org-123');
        const result = await tools.getCompetitorComparison.execute({}, { toolCallId: 'test', messages: [], abortSignal: undefined as any });

        expect(result.type).toBe('competitor_comparison');
        expect(Array.isArray(result.competitors)).toBe(true);
    });
});
