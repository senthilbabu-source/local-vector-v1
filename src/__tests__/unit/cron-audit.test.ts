// ---------------------------------------------------------------------------
// cron-audit.test.ts — Unit tests for GET /api/cron/audit
//
// Strategy:
//   • The AI service (auditLocation) is mocked completely — no real OpenAI
//     calls, no MSW needed. This is a pure unit test of the route's
//     auth guard and orchestration logic.
//   • The Supabase service-role client is mocked to return an empty org list
//     by default. Because the for...of loop never executes, location and
//     insert queries are never called, so only the organizations chain needs
//     to be modelled.
//   • To test the resilience path (one org audited, hallucinations inserted),
//     a dedicated test overrides the Supabase mock to return one org + location
//     and configures auditLocation to return one hallucination.
//
// Run:
//   npx vitest run src/__tests__/unit/cron-audit.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mock the AI service before any imports ────────────────────────────────
// auditLocation is mocked to return [] by default (no hallucinations found).
// Individual tests override this with vi.mocked(auditLocation).mockResolvedValueOnce().
vi.mock('@/lib/services/ai-audit.service', () => ({
  auditLocation: vi.fn().mockResolvedValue([]),
}));

// ── Mock the Supabase service-role client ─────────────────────────────────
// vi.mock is hoisted before imports, so the factory runs first.
vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: vi.fn(),
}));

// ── Import handler and mocks after vi.mock declarations ──────────────────
import { GET } from '@/app/api/cron/audit/route';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { auditLocation } from '@/lib/services/ai-audit.service';

// ── Helpers ───────────────────────────────────────────────────────────────

const CRON_SECRET = 'test-cron-secret-abc';

function makeRequest(authHeader?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (authHeader) headers['authorization'] = authHeader;
  return new NextRequest('http://localhost/api/cron/audit', { headers });
}

// Wires the Supabase mock to return an empty org list.
// Chain modelled: from().select().in().eq() → { data: [], error: null }
// mockReturnThis() makes select() and in() chainable (returns the same object);
// the terminal eq() resolves to the final value.
function mockSupabaseNoOrgs() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(createServiceRoleClient as any).mockReturnValue({
    from: vi.fn(() => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
      // select/in must return the same chain object for chaining to work
      chain.select.mockReturnValue(chain);
      chain.in.mockReturnValue(chain);
      return chain;
    }),
  });
}

// Wires the Supabase mock to return one org and one location.
// Used by the resilience / full-pipeline test.
function mockSupabaseWithOrgAndLocation(
  org = { id: 'cron-test-org-uuid-001', name: 'Cron Test Restaurant' },
  location = {
    id: 'cron-test-loc-uuid-001',
    org_id: 'cron-test-org-uuid-001',
    business_name: 'Cron Test Restaurant',
    city: 'Atlanta',
    state: 'GA',
    address_line1: '123 Test St',
    hours_data: null,
    amenities: null,
  }
) {
  const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockMaybeSingle = vi
    .fn()
    .mockResolvedValue({ data: location, error: null });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(createServiceRoleClient as any).mockReturnValue({
    from: vi.fn((table: string) => {
      if (table === 'organizations') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [org], error: null }),
            }),
          }),
        };
      }
      if (table === 'locations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle }),
            }),
          }),
        };
      }
      if (table === 'ai_hallucinations') {
        return { insert: mockInsert };
      }
      return {};
    }),
  });

  return { mockInsert, mockMaybeSingle };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('GET /api/cron/audit', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = CRON_SECRET;
    mockSupabaseNoOrgs(); // safe default: no DB writes
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
    vi.clearAllMocks();
  });

  // ── Auth guard ────────────────────────────────────────────────────────

  it('returns 401 when Authorization header is absent', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 401 when Bearer token is incorrect', async () => {
    const res = await GET(makeRequest('Bearer totally-wrong-secret'));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 401 when CRON_SECRET env var is not configured', async () => {
    delete process.env.CRON_SECRET;
    // Even a matching header is rejected when the env var is missing
    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
    expect(res.status).toBe(401);
  });

  // ── Success — no paying orgs ──────────────────────────────────────────

  it('returns 200 with zero-count summary when no paying orgs exist', async () => {
    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.orgs_found).toBe(0);
    expect(body.processed).toBe(0);
    expect(body.hallucinations_inserted).toBe(0);
    expect(body.failed).toBe(0);
  });

  it('does not call auditLocation when no orgs are returned', async () => {
    await GET(makeRequest(`Bearer ${CRON_SECRET}`));
    expect(vi.mocked(auditLocation)).not.toHaveBeenCalled();
  });

  // ── Success — one org audited, hallucinations inserted ────────────────

  it('calls auditLocation and inserts hallucinations for a paying org', async () => {
    const fakeHallucination = {
      model_provider: 'openai-gpt4o' as const,
      severity: 'high' as const,
      category: 'status' as const,
      claim_text: 'This restaurant is permanently closed.',
      expected_truth: 'Restaurant is open Tuesday–Sunday 11 AM–10 PM.',
    };
    vi.mocked(auditLocation).mockResolvedValueOnce([fakeHallucination]);
    const { mockInsert } = mockSupabaseWithOrgAndLocation();

    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.orgs_found).toBe(1);
    expect(body.processed).toBe(1);
    expect(body.hallucinations_inserted).toBe(1);
    expect(body.failed).toBe(0);

    // Verify the insert was called with correct shape
    expect(mockInsert).toHaveBeenCalledOnce();
    const insertedRows = mockInsert.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0]).toMatchObject({
      org_id: 'cron-test-org-uuid-001',
      location_id: 'cron-test-loc-uuid-001',
      model_provider: 'openai-gpt4o',
      severity: 'high',
      category: 'status',
      correction_status: 'open',
    });
  });

  // ── Resilience — one org fails, run continues ─────────────────────────

  it('increments failed and continues when auditLocation throws', async () => {
    vi.mocked(auditLocation).mockRejectedValueOnce(
      new Error('OpenAI API error: 429 Too Many Requests')
    );
    mockSupabaseWithOrgAndLocation();

    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.processed).toBe(0); // org was not successfully processed
    expect(body.failed).toBe(1);    // counted as failed
    expect(body.hallucinations_inserted).toBe(0);
  });
});
