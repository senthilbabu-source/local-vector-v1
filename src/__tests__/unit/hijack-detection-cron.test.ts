// ---------------------------------------------------------------------------
// src/__tests__/unit/hijack-detection-cron.test.ts — P8-FIX-37
//
// Unit tests for the hijack-detection cron route.
// Mocks Supabase, Sentry, and email service.
// AI_RULES §193.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFrom = vi.fn();
const mockSupabase = { from: mockFrom };

vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: () => mockSupabase,
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

const mockSendHijackingAlert = vi.fn();
vi.mock('@/lib/email', () => ({
  sendHijackingAlert: (...args: unknown[]) => mockSendHijackingAlert(...args),
}));

vi.mock('@/lib/hijack/hijacking-detector', () => ({
  detectHijacking: vi.fn().mockReturnValue([]),
}));

// Import after mocks
const { GET } = await import('@/app/api/cron/hijack-detection/route');
const { detectHijacking } = await import('@/lib/hijack/hijacking-detector');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(secret?: string): NextRequest {
  const headers = new Headers();
  if (secret) headers.set('authorization', `Bearer ${secret}`);
  return new NextRequest('http://localhost:3000/api/cron/hijack-detection', { headers });
}

function mockChain(data: unknown = [], error: unknown = null) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockResolvedValue({ data, error }),
          }),
          gte: vi.fn().mockResolvedValue({ data, error }),
        }),
        gte: vi.fn().mockResolvedValue({ data, error }),
      }),
      order: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ data, error }),
      }),
    }),
    insert: vi.fn().mockResolvedValue({ error: null }),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/cron/hijack-detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('CRON_SECRET', 'test-secret');
    vi.unstubAllEnvs();
    vi.stubEnv('CRON_SECRET', 'test-secret');
  });

  it('returns 401 without CRON_SECRET', async () => {
    vi.stubEnv('CRON_SECRET', '');
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 401 with wrong bearer token', async () => {
    const res = await GET(makeRequest('wrong-secret'));
    expect(res.status).toBe(401);
  });

  it('returns 200 with halted=true when kill switch is on', async () => {
    vi.stubEnv('STOP_HIJACK_DETECTION_CRON', 'true');
    const res = await GET(makeRequest('test-secret'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.halted).toBe(true);
  });

  it('returns 200 with processed=0 when no agency orgs exist', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });

    const res = await GET(makeRequest('test-secret'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.processed).toBe(0);
  });

  it('processes agency orgs and returns summary', async () => {
    const orgs = [{ id: 'org-1', name: 'Test Org', plan: 'agency', owner_email: 'owner@test.com' }];
    const locations = [{ id: 'loc-1', business_name: 'Test Biz', address_line1: '123 Main St', city: 'Atlanta', state: 'GA' }];

    // First call: orgs query
    // Second call: locations query
    // Third call: sov_model_results query
    // Fourth call: sov_evaluations query
    // Fifth call: insert
    let callCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'organizations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: orgs, error: null }),
          }),
        };
      }
      if (table === 'locations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: locations, error: null }),
            }),
          }),
        };
      }
      if (table === 'sov_model_results') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  gte: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'hijacking_alerts') {
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      }
      return mockChain();
    });

    const res = await GET(makeRequest('test-secret'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it('sends email for critical severity hijacking events', async () => {
    const criticalEvent = {
      id: 'ev-1',
      orgId: 'org-1',
      locationId: 'loc-1',
      engine: 'perplexity_sonar',
      queryText: 'hookah lounge',
      hijackType: 'address_mix' as const,
      ourBusiness: 'Test Biz',
      competitorName: 'Bad Actor',
      evidenceText: 'Wrong address shown',
      severity: 'critical' as const,
      detectedAt: new Date().toISOString(),
      status: 'new' as const,
    };

    (detectHijacking as ReturnType<typeof vi.fn>).mockReturnValue([criticalEvent]);

    const orgs = [{ id: 'org-1', name: 'Test Org', plan: 'agency', owner_email: 'owner@test.com' }];
    const locations = [{ id: 'loc-1', business_name: 'Test Biz', address_line1: '123 Main St', city: 'Atlanta', state: 'GA' }];
    const sovResults = [{ model_provider: 'perplexity_sonar', query_text: 'hookah', ai_response: 'response', cited: false }];

    mockFrom.mockImplementation((table: string) => {
      if (table === 'organizations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: orgs, error: null }),
          }),
        };
      }
      if (table === 'locations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: locations, error: null }),
            }),
          }),
        };
      }
      if (table === 'sov_model_results') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  gte: vi.fn().mockResolvedValue({ data: sovResults, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'sov_evaluations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                gte: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'hijacking_alerts') {
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      }
      return mockChain();
    });

    const res = await GET(makeRequest('test-secret'));
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(mockSendHijackingAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'owner@test.com',
        businessName: 'Test Biz',
        competitorName: 'Bad Actor',
        hijackType: 'address_mix',
      }),
    );
  });

  it('handles empty SOV data gracefully', async () => {
    const orgs = [{ id: 'org-1', name: 'Test', plan: 'agency', owner_email: null }];
    const locations = [{ id: 'loc-1', business_name: 'Test', address_line1: null, city: null, state: null }];

    mockFrom.mockImplementation((table: string) => {
      if (table === 'organizations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: orgs, error: null }),
          }),
        };
      }
      if (table === 'locations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: locations, error: null }),
            }),
          }),
        };
      }
      if (table === 'sov_model_results') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  gte: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          }),
        };
      }
      return mockChain();
    });

    const res = await GET(makeRequest('test-secret'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
  });
});
