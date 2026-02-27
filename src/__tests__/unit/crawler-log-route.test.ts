/**
 * Unit Tests — Internal Crawler Log Route Handler
 *
 * Strategy: the Supabase service-role client is fully mocked. Each test
 * controls what the DB queries return to test every code path.
 *
 * Run:
 *   npx vitest run src/__tests__/unit/crawler-log-route.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

const mockMaybeSingle = vi.fn();
const mockInsert = vi.fn();

const mockServiceClient = {
  from: vi.fn((table: string) => {
    if (table === 'magic_menus') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: mockMaybeSingle,
            })),
          })),
        })),
      };
    }
    if (table === 'crawler_hits') {
      return { insert: mockInsert };
    }
    return {};
  }),
} as unknown as SupabaseClient<Database>;

vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: vi.fn(() => mockServiceClient),
}));

// ---------------------------------------------------------------------------
// Import under test (after mocks)
// ---------------------------------------------------------------------------

import { POST } from '@/app/api/internal/crawler-log/route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const TEST_MENU_ID = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const TEST_LOCATION_ID = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

function makeRequest(
  body: Record<string, unknown>,
  secret: string | null = 'test-secret'
): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (secret !== null) {
    headers['x-internal-secret'] = secret;
  }
  return new Request('http://localhost/api/internal/crawler-log', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/internal/crawler-log', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-secret';
  });

  it('returns 401 when x-internal-secret is missing', async () => {
    const res = await POST(makeRequest({ botType: 'gptbot', slug: 'test' }, null));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 401 when x-internal-secret is wrong', async () => {
    const res = await POST(makeRequest({ botType: 'gptbot', slug: 'test' }, 'wrong-secret'));
    expect(res.status).toBe(401);
  });

  it('returns 400 when botType is missing', async () => {
    const res = await POST(makeRequest({ slug: 'test' }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Missing required fields');
  });

  it('returns 400 when slug is missing', async () => {
    const res = await POST(makeRequest({ botType: 'gptbot' }));
    expect(res.status).toBe(400);
  });

  it('returns { ok: true, logged: false } when no published menu matches slug', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const res = await POST(makeRequest({ botType: 'gptbot', slug: 'nonexistent' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ ok: true, logged: false });
  });

  it('returns { ok: true, logged: true } on successful insert', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { id: TEST_MENU_ID, org_id: TEST_ORG_ID, location_id: TEST_LOCATION_ID },
      error: null,
    });
    mockInsert.mockResolvedValue({ error: null });

    const res = await POST(
      makeRequest({
        botType: 'gptbot',
        userAgent: 'GPTBot/1.0',
        slug: 'charcoal-n-chill',
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ ok: true, logged: true });
  });

  it('inserts correct org_id, menu_id, location_id, bot_type, user_agent', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { id: TEST_MENU_ID, org_id: TEST_ORG_ID, location_id: TEST_LOCATION_ID },
      error: null,
    });
    mockInsert.mockResolvedValue({ error: null });

    await POST(
      makeRequest({
        botType: 'claudebot',
        userAgent: 'ClaudeBot/1.0',
        slug: 'charcoal-n-chill',
      })
    );

    expect(mockInsert).toHaveBeenCalledWith({
      org_id: TEST_ORG_ID,
      menu_id: TEST_MENU_ID,
      location_id: TEST_LOCATION_ID,
      bot_type: 'claudebot',
      user_agent: 'ClaudeBot/1.0',
    });
  });

  it('returns 500 when Supabase INSERT fails', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { id: TEST_MENU_ID, org_id: TEST_ORG_ID, location_id: TEST_LOCATION_ID },
      error: null,
    });
    mockInsert.mockResolvedValue({ error: { message: 'DB error' } });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await POST(
      makeRequest({ botType: 'gptbot', userAgent: 'GPTBot/1.0', slug: 'test' })
    );
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.ok).toBe(false);
    consoleSpy.mockRestore();
  });
});
