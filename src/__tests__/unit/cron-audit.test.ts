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

// ── Mock the AI audit service before any imports ──────────────────────────
// auditLocation is mocked to return [] by default (no hallucinations found).
// Individual tests override this with vi.mocked(auditLocation).mockResolvedValueOnce().
vi.mock('@/lib/services/ai-audit.service', () => ({
  auditLocation: vi.fn().mockResolvedValue([]),
}));

// ── Mock the competitor intercept service ─────────────────────────────────
// runInterceptForCompetitor is mocked so tests never make real LLM calls.
vi.mock('@/lib/services/competitor-intercept.service', () => ({
  runInterceptForCompetitor: vi.fn().mockResolvedValue(undefined),
}));

// ── Mock the Supabase service-role client ─────────────────────────────────
// vi.mock is hoisted before imports, so the factory runs first.
vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: vi.fn(),
}));

// ── Mock the email helper ─────────────────────────────────────────────────
// sendHallucinationAlert is mocked so tests never hit Resend's API.
vi.mock('@/lib/email', () => ({
  sendHallucinationAlert: vi.fn().mockResolvedValue(undefined),
}));

// ── Mock the Inngest client ──────────────────────────────────────────────
// Default: throw so inline fallback runs (existing tests exercise fallback path).
const mockInngestSend = vi.fn().mockRejectedValue(new Error('Inngest unavailable'));
vi.mock('@/lib/inngest/client', () => ({
  inngest: { send: (...args: unknown[]) => mockInngestSend(...args) },
}));

// ── Import handler and mocks after vi.mock declarations ──────────────────
import { GET } from '@/app/api/cron/audit/route';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { auditLocation } from '@/lib/services/ai-audit.service';
import { runInterceptForCompetitor } from '@/lib/services/competitor-intercept.service';
import { sendHallucinationAlert } from '@/lib/email';

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
// The competitors table is also handled here (returns [] — safe default).
function mockSupabaseNoOrgs() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(createServiceRoleClient as any).mockReturnValue({
    from: vi.fn((table: string) => {
      if (table === 'competitors') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }
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
// Also mocks the memberships query for the email alert step.
// Used by the resilience / full-pipeline tests.
//
// competitors: pass an array to simulate competitors for the intercept loop.
// Defaults to [] — existing tests are unaffected.
function mockSupabaseWithOrgAndLocation(
  org = { id: 'cron-test-org-uuid-001', name: 'Cron Test Restaurant' },
  location: {
    id: string; org_id: string; business_name: string; city: string;
    state: string; address_line1: string; hours_data: null; amenities: null;
    categories?: string[];
  } | undefined = {
    id: 'cron-test-loc-uuid-001',
    org_id: 'cron-test-org-uuid-001',
    business_name: 'Cron Test Restaurant',
    city: 'Atlanta',
    state: 'GA',
    address_line1: '123 Test St',
    hours_data: null,
    amenities: null,
  },
  ownerEmail = 'owner@crontest.com',
  competitors: Array<{ id: string; competitor_name: string }> = [],
) {
  const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockLocationMaybeSingle = vi
    .fn()
    .mockResolvedValue({ data: location, error: null });
  const mockMembershipMaybeSingle = vi.fn().mockResolvedValue({
    data: ownerEmail ? { users: { email: ownerEmail } } : null,
    error: null,
  });

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
              eq: vi.fn().mockReturnValue({ maybeSingle: mockLocationMaybeSingle }),
            }),
          }),
        };
      }
      if (table === 'ai_hallucinations') {
        return { insert: mockInsert };
      }
      if (table === 'memberships') {
        // Chain: .select().eq().eq().limit().maybeSingle()
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: mockMembershipMaybeSingle,
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'competitors') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: competitors, error: null }),
          }),
        };
      }
      return {};
    }),
  });

  return { mockInsert, mockMaybeSingle: mockLocationMaybeSingle, mockMembershipMaybeSingle };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('GET /api/cron/audit', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = CRON_SECRET;
    delete process.env.STOP_AUDIT_CRON;
    mockSupabaseNoOrgs(); // safe default: no DB writes
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
    delete process.env.STOP_AUDIT_CRON;
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

  // ── Kill switch ────────────────────────────────────────────────────────

  it('returns 200 with halted flag when STOP_AUDIT_CRON is set', async () => {
    process.env.STOP_AUDIT_CRON = 'true';
    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.halted).toBe(true);
  });

  // ── Inngest dispatch ──────────────────────────────────────────────────

  it('dispatches to Inngest and returns early when Inngest is available', async () => {
    mockInngestSend.mockResolvedValueOnce(undefined);
    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dispatched).toBe(true);
    expect(mockInngestSend).toHaveBeenCalledWith({ name: 'cron/audit.daily', data: {} });
    // Inline fallback should NOT have run
    expect(vi.mocked(createServiceRoleClient)).not.toHaveBeenCalled();
  });

  it('falls back to inline when Inngest dispatch throws', async () => {
    // Default mock already throws — inline fallback should run
    mockSupabaseNoOrgs();

    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    // Inline fallback ran — no dispatched flag
    expect(body.dispatched).toBeUndefined();
    expect(body.ok).toBe(true);
    expect(body.orgs_found).toBe(0);
  });

  // ── Success — no paying orgs (inline fallback) ────────────────────────

  it('returns 200 with zero-count summary when no paying orgs exist', async () => {
    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.orgs_found).toBe(0);
    expect(body.processed).toBe(0);
    expect(body.hallucinations_inserted).toBe(0);
    expect(body.failed).toBe(0);
    expect(body.intercepts_inserted).toBe(0);
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

  // ── Email alerts ───────────────────────────────────────────────────────

  it('sends email alert with correct payload when hallucinations are inserted', async () => {
    const fakeHallucination = {
      model_provider: 'openai-gpt4o' as const,
      severity: 'high' as const,
      category: 'status' as const,
      claim_text: 'This restaurant is permanently closed.',
      expected_truth: 'Restaurant is open Tuesday–Sunday 11 AM–10 PM.',
    };
    vi.mocked(auditLocation).mockResolvedValueOnce([fakeHallucination]);
    mockSupabaseWithOrgAndLocation(
      { id: 'cron-test-org-uuid-001', name: 'Cron Test Restaurant' },
      undefined,
      'owner@crontest.com'
    );

    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
    expect(res.status).toBe(200);

    expect(vi.mocked(sendHallucinationAlert)).toHaveBeenCalledOnce();
    const alertPayload = vi.mocked(sendHallucinationAlert).mock
      .calls[0][0] as Parameters<typeof sendHallucinationAlert>[0];
    expect(alertPayload.to).toBe('owner@crontest.com');
    expect(alertPayload.hallucinationCount).toBe(1);
    expect(alertPayload.businessName).toBe('Cron Test Restaurant');
  });

  // ── Competitor intercept loop ─────────────────────────────────────────

  it('calls runInterceptForCompetitor once per competitor in the org', async () => {
    const competitors = [
      { id: 'comp-uuid-001', competitor_name: 'Cloud 9 Lounge' },
      { id: 'comp-uuid-002', competitor_name: 'Sky Lounge' },
    ];
    mockSupabaseWithOrgAndLocation(undefined, undefined, undefined, competitors);

    await GET(makeRequest(`Bearer ${CRON_SECRET}`));

    expect(vi.mocked(runInterceptForCompetitor)).toHaveBeenCalledTimes(2);
    const firstCall = vi.mocked(runInterceptForCompetitor).mock.calls[0][0];
    expect(firstCall.orgId).toBe('cron-test-org-uuid-001');
    expect(firstCall.competitor.competitor_name).toBe('Cloud 9 Lounge');
  });

  it('increments intercepts_inserted in summary for each successful intercept', async () => {
    const competitors = [
      { id: 'comp-uuid-001', competitor_name: 'Cloud 9 Lounge' },
    ];
    mockSupabaseWithOrgAndLocation(undefined, undefined, undefined, competitors);

    const res  = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
    const body = await res.json();
    expect(body.intercepts_inserted).toBe(1);
  });

  it('absorbs a competitor intercept error without incrementing failed', async () => {
    const competitors = [
      { id: 'comp-uuid-001', competitor_name: 'Cloud 9 Lounge' },
    ];
    mockSupabaseWithOrgAndLocation(undefined, undefined, undefined, competitors);
    vi.mocked(runInterceptForCompetitor).mockRejectedValueOnce(
      new Error('OpenAI rate limit')
    );

    const res  = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
    const body = await res.json();
    // Hallucination audit was unaffected
    expect(body.failed).toBe(0);
    // Intercept error is absorbed — count stays 0
    expect(body.intercepts_inserted).toBe(0);
    // Overall run still reports OK
    expect(body.ok).toBe(true);
  });

  it('continues cron run when email send fails (does not increment failed)', async () => {
    const fakeHallucination = {
      model_provider: 'openai-gpt4o' as const,
      severity: 'medium' as const,
      category: 'amenity' as const,
      claim_text: 'No outdoor seating.',
      expected_truth: 'Has outdoor seating.',
    };
    vi.mocked(auditLocation).mockResolvedValueOnce([fakeHallucination]);
    // Email send throws — cron must absorb this via .catch()
    vi.mocked(sendHallucinationAlert).mockRejectedValueOnce(
      new Error('Resend API unavailable')
    );
    mockSupabaseWithOrgAndLocation(
      undefined,
      undefined,
      'owner@crontest.com'
    );

    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
    expect(res.status).toBe(200);

    const body = await res.json();
    // Email failure is absorbed by .catch() — run still counts as processed
    expect(body.processed).toBe(1);
    expect(body.failed).toBe(0);
    expect(body.hallucinations_inserted).toBe(1);
  });
});
