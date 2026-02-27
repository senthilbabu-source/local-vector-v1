// ---------------------------------------------------------------------------
// audit-status-route.test.ts — Unit tests for GET /api/onboarding/audit-status
//
// Sprint 91: 6 tests — mocks auth + supabase.
//
// Run:
//   npx vitest run src/__tests__/unit/audit-status-route.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetSafeAuthContext = vi.fn();
const mockCreateClient = vi.fn();

vi.mock('@/lib/auth', () => ({
  getSafeAuthContext: () => mockGetSafeAuthContext(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}));

import { GET } from '@/app/api/onboarding/audit-status/route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AUTH_CTX = {
  userId: 'u1',
  email: 'test@test.com',
  fullName: null,
  orgId: 'org-1',
  orgName: 'Test Org',
  role: 'owner' as const,
  plan: 'trial',
  onboarding_completed: false,
};

function makeMockSupabase(auditRow: { id: string } | null = null) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: auditRow,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    }),
  };
}

async function parseJSON(response: Response) {
  return response.json();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/onboarding/audit-status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when user is not authenticated', async () => {
    mockGetSafeAuthContext.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
    const body = await parseJSON(response);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 401 when orgId is null', async () => {
    mockGetSafeAuthContext.mockResolvedValue({ ...AUTH_CTX, orgId: null });
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it('returns { status: "running" } when no recent audit exists', async () => {
    mockGetSafeAuthContext.mockResolvedValue(AUTH_CTX);
    mockCreateClient.mockResolvedValue(makeMockSupabase(null));

    const response = await GET();
    const body = await parseJSON(response);
    expect(body.status).toBe('running');
  });

  it('returns { status: "complete", auditId } when audit completed', async () => {
    mockGetSafeAuthContext.mockResolvedValue(AUTH_CTX);
    mockCreateClient.mockResolvedValue(makeMockSupabase({ id: 'audit-abc' }));

    const response = await GET();
    const body = await parseJSON(response);
    expect(body.status).toBe('complete');
    expect(body.auditId).toBe('audit-abc');
  });

  it('scopes query to authenticated user\'s org_id', async () => {
    mockGetSafeAuthContext.mockResolvedValue(AUTH_CTX);
    const mock = makeMockSupabase(null);
    mockCreateClient.mockResolvedValue(mock);

    await GET();

    // Verify from('ai_audits') was called
    expect(mock.from).toHaveBeenCalledWith('ai_audits');
  });

  it('returns { status: "not_found" } when query errors', async () => {
    mockGetSafeAuthContext.mockResolvedValue(AUTH_CTX);
    const errorMock = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: null,
                    error: { message: 'connection lost' },
                  }),
                }),
              }),
            }),
          }),
        }),
      }),
    };
    mockCreateClient.mockResolvedValue(errorMock);

    const response = await GET();
    const body = await parseJSON(response);
    expect(body.status).toBe('not_found');
  });
});
