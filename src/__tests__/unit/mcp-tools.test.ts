// ---------------------------------------------------------------------------
// mcp-tools.test.ts — Unit tests for lib/mcp/tools.ts
//
// Strategy:
//   • McpServer is mocked — we capture tool registrations and invoke handlers.
//   • Supabase is mocked at the module level — no real DB calls.
//   • Tests verify tool names, descriptions, and response shapes.
//
// Run:
//   npx vitest run src/__tests__/unit/mcp-tools.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock Supabase ──────────────────────────────────────────────────────

const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
const mockLimit = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
const mockIlike = vi.fn().mockReturnValue({ limit: mockLimit });
const mockOrder = vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle }) });
const mockEq = vi.fn().mockImplementation(() => ({
    eq: mockEq,
    order: mockOrder,
    limit: mockLimit,
    ilike: mockIlike,
    maybeSingle: mockMaybeSingle,
}));
const mockSelect = vi.fn().mockImplementation(() => ({
    eq: mockEq,
    ilike: mockIlike,
    order: mockOrder,
    limit: mockLimit,
    gte: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue({ data: [], error: null }) }),
}));
const mockFrom = vi.fn().mockReturnValue({
    select: mockSelect,
});

vi.mock('@/lib/supabase/server', () => ({
    createServiceRoleClient: vi.fn(() => ({
        from: mockFrom,
    })),
}));

import { registerLocalVectorTools } from '@/lib/mcp/tools';

// ── Capture tool registrations ──────────────────────────────────────────

interface RegisteredTool {
    name: string;
    description: string;
    schema: Record<string, unknown>;
    handler: (args: Record<string, unknown>) => Promise<{ content: { type: string; text: string }[] }>;
}

function createMockServer() {
    const tools: RegisteredTool[] = [];

    return {
        tool: vi.fn((name: string, description: string, schema: Record<string, unknown>, handler: any) => {
            tools.push({ name, description, schema, handler });
        }),
        _tools: tools,
    };
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('MCP Tools Registration', () => {
    let mockServer: ReturnType<typeof createMockServer>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockServer = createMockServer();
        registerLocalVectorTools(mockServer as any);
    });

    it('registers exactly 4 tools', () => {
        expect(mockServer._tools).toHaveLength(4);
    });

    it('registers get_visibility_score tool', () => {
        const tool = mockServer._tools.find((t) => t.name === 'get_visibility_score');
        expect(tool).toBeDefined();
        expect(tool!.description).toContain('visibility score');
    });

    it('registers get_sov_report tool', () => {
        const tool = mockServer._tools.find((t) => t.name === 'get_sov_report');
        expect(tool).toBeDefined();
        expect(tool!.description).toContain('Share of Voice');
    });

    it('registers get_hallucinations tool', () => {
        const tool = mockServer._tools.find((t) => t.name === 'get_hallucinations');
        expect(tool).toBeDefined();
        expect(tool!.description).toContain('hallucinations');
    });

    it('registers get_competitor_analysis tool', () => {
        const tool = mockServer._tools.find((t) => t.name === 'get_competitor_analysis');
        expect(tool).toBeDefined();
        expect(tool!.description).toContain('competitor');
    });
});

describe('get_visibility_score', () => {
    let mockServer: ReturnType<typeof createMockServer>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockServer = createMockServer();
        registerLocalVectorTools(mockServer as any);
    });

    it('returns "No business found" when org not resolved', async () => {
        mockMaybeSingle.mockResolvedValue({ data: null, error: null });

        const tool = mockServer._tools.find((t) => t.name === 'get_visibility_score')!;
        const result = await tool.handler({ business_name: 'Nonexistent Restaurant' });

        expect(result.content[0].text).toContain('No business found');
    });
});

describe('get_hallucinations', () => {
    let mockServer: ReturnType<typeof createMockServer>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockServer = createMockServer();
        registerLocalVectorTools(mockServer as any);
    });

    it('returns "No business found" for unknown business', async () => {
        mockMaybeSingle.mockResolvedValue({ data: null, error: null });

        const tool = mockServer._tools.find((t) => t.name === 'get_hallucinations')!;
        const result = await tool.handler({ business_name: 'Unknown', status: 'open' });

        expect(result.content[0].text).toContain('No business found');
    });
});

describe('get_competitor_analysis', () => {
    let mockServer: ReturnType<typeof createMockServer>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockServer = createMockServer();
        registerLocalVectorTools(mockServer as any);
    });

    it('returns "No business found" for unknown business', async () => {
        mockMaybeSingle.mockResolvedValue({ data: null, error: null });

        const tool = mockServer._tools.find((t) => t.name === 'get_competitor_analysis')!;
        const result = await tool.handler({ business_name: 'Unknown' });

        expect(result.content[0].text).toContain('No business found');
    });
});
