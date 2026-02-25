// ---------------------------------------------------------------------------
// mcp-auth.test.ts — Unit tests for MCP endpoint authentication
//
// Strategy:
//   • Partially mock 'mcp-handler': replace createMcpHandler with a dummy
//     handler while keeping the real withMcpAuth so auth logic runs for real.
//   • Control MCP_API_KEY via process.env manipulation.
//   • Verify bearer token enforcement at the route level.
//
// Run:
//   npx vitest run src/__tests__/unit/mcp-auth.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Partial mock: real withMcpAuth, dummy createMcpHandler ───────────────

vi.mock('mcp-handler', async () => {
  const actual = await vi.importActual<typeof import('mcp-handler')>('mcp-handler');
  return {
    ...actual,
    createMcpHandler: vi.fn(
      () => (_req: Request) => new Response(JSON.stringify({ ok: true }), { status: 200 })
    ),
  };
});

vi.mock('@/lib/mcp/tools', () => ({
  registerLocalVectorTools: vi.fn(),
}));

// ── Import route AFTER mocks are declared ────────────────────────────────

import { POST } from '@/app/api/mcp/[transport]/route';

// ── Tests ────────────────────────────────────────────────────────────────

const TEST_API_KEY = 'test-mcp-key-abc123';

describe('MCP endpoint authentication', () => {
  let originalKey: string | undefined;

  beforeEach(() => {
    originalKey = process.env.MCP_API_KEY;
    process.env.MCP_API_KEY = TEST_API_KEY;
  });

  afterEach(() => {
    if (originalKey !== undefined) {
      process.env.MCP_API_KEY = originalKey;
    } else {
      delete process.env.MCP_API_KEY;
    }
  });

  it('returns 401 when no Authorization header is provided', async () => {
    const req = new Request('http://localhost:3000/api/mcp/sse', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it('returns 401 when bearer token is wrong', async () => {
    const req = new Request('http://localhost:3000/api/mcp/sse', {
      method: 'POST',
      headers: { Authorization: 'Bearer wrong-key' },
      body: JSON.stringify({}),
    });

    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it('returns 401 when MCP_API_KEY env var is not configured (fail closed)', async () => {
    delete process.env.MCP_API_KEY;

    const req = new Request('http://localhost:3000/api/mcp/sse', {
      method: 'POST',
      headers: { Authorization: `Bearer ${TEST_API_KEY}` },
      body: JSON.stringify({}),
    });

    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it('passes through to handler when correct bearer token is provided', async () => {
    const req = new Request('http://localhost:3000/api/mcp/sse', {
      method: 'POST',
      headers: { Authorization: `Bearer ${TEST_API_KEY}` },
      body: JSON.stringify({}),
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
  });
});
