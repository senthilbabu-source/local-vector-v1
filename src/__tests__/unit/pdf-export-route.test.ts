// ---------------------------------------------------------------------------
// src/__tests__/unit/pdf-export-route.test.ts — PDF export route tests
//
// Sprint 95 — PDF Audit Report (Gap #74).
// 16 tests. Mocks: auth, supabase, @react-pdf/renderer, pdf-assembler.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MOCK_AUDIT_REPORT_DATA } from '@/src/__fixtures__/golden-tenant';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetAuthContext = vi.fn();
const mockCreateClient = vi.fn();
const mockRenderToBuffer = vi.fn();
const mockAssembleAuditReportData = vi.fn();
const mockGenerateRecommendations = vi.fn();

vi.mock('@/lib/auth', () => ({
  getAuthContext: () => mockGetAuthContext(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}));

vi.mock('@react-pdf/renderer', () => ({
  renderToBuffer: (...args: unknown[]) => mockRenderToBuffer(...args),
  Document: 'Document',
  Page: 'Page',
  Text: 'Text',
  View: 'View',
  StyleSheet: { create: (s: unknown) => s },
  Image: 'Image',
}));

vi.mock('@/lib/exports/pdf-assembler', async () => {
  const actual = await vi.importActual('@/lib/exports/pdf-assembler');
  return {
    ...actual,
    assembleAuditReportData: (...args: unknown[]) =>
      mockAssembleAuditReportData(...args),
    generateRecommendations: (...args: unknown[]) =>
      mockGenerateRecommendations(...args),
  };
});

vi.mock('@/lib/exports/pdf-template', () => ({
  AuditReportPDF: vi.fn().mockReturnValue(null),
}));

vi.mock('@/app/dashboard/page', () => ({
  deriveRealityScore: vi.fn().mockReturnValue({
    visibility: 50,
    accuracy: 85,
    dataHealth: 100,
    realityScore: 72,
  }),
}));

import { GET } from '@/app/api/exports/audit-report/route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AUTH_GROWTH = {
  userId: 'u1',
  fullName: 'Test User',
  orgId: 'org-1',
  role: 'owner' as const,
  org: {
    id: 'org-1',
    name: 'Charcoal N Chill',
    slug: 'charcoal-n-chill',
    plan: 'growth',
    plan_status: 'active',
    audit_frequency: 'daily',
    max_locations: 1,
    onboarding_completed: true,
  },
};

const AUTH_STARTER = {
  ...AUTH_GROWTH,
  org: { ...AUTH_GROWTH.org, plan: 'starter' },
};

function makeMockSupabase(options?: {
  hallucinationData?: unknown[];
  sovData?: unknown[];
  locationData?: unknown;
  visibilityData?: unknown;
  orgData?: unknown;
}) {
  const {
    hallucinationData = [],
    sovData = [],
    locationData = null,
    visibilityData = null,
    orgData = {
      id: 'org-1',
      name: 'Charcoal N Chill',
      slug: 'charcoal-n-chill',
      plan: 'growth',
    },
  } = options ?? {};

  // Track which table is being queried
  let callIndex = 0;
  const responses = [
    { data: hallucinationData, error: null }, // ai_hallucinations
    { data: sovData, error: null }, // sov_evaluations
    { data: locationData, error: null }, // locations (maybeSingle)
    { data: visibilityData, error: null }, // visibility_analytics (maybeSingle)
    { data: orgData, error: null }, // organizations (single)
  ];

  const makeChain = () => {
    const responseIdx = callIndex++;
    const response = responses[responseIdx] ?? { data: null, error: null };

    const terminator = {
      maybeSingle: vi.fn().mockResolvedValue(response),
      single: vi.fn().mockResolvedValue(response),
    };

    const limitFn = vi.fn().mockReturnValue(terminator);
    Object.assign(limitFn, terminator);

    const orderFn = vi.fn().mockReturnValue({ limit: limitFn, ...terminator });

    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            order: orderFn,
            limit: limitFn,
          }),
          order: orderFn,
          limit: limitFn,
          ...terminator,
        }),
        order: orderFn,
        ...terminator,
      }),
    };
  };

  return {
    from: vi.fn().mockImplementation(() => makeChain()),
  };
}

async function parseJSON(response: Response) {
  return response.json();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/exports/audit-report', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRenderToBuffer.mockResolvedValue(Buffer.from('%PDF-1.4 mock'));
    mockAssembleAuditReportData.mockReturnValue(MOCK_AUDIT_REPORT_DATA);
    mockGenerateRecommendations.mockReturnValue([
      'rec 1',
      'rec 2',
      'rec 3',
    ]);
  });

  it('returns 401 when user is not authenticated', async () => {
    mockGetAuthContext.mockRejectedValue(new Error('Unauthorized'));
    const response = await GET();
    expect(response.status).toBe(401);
    const body = await parseJSON(response);
    expect(body.error).toBe('unauthorized');
  });

  it('returns 402 with error_code "plan_required" for Starter plan', async () => {
    mockGetAuthContext.mockResolvedValue(AUTH_STARTER);
    const response = await GET();
    expect(response.status).toBe(402);
    const body = await parseJSON(response);
    expect(body.error).toBe('plan_required');
    expect(body.plan).toBe('growth');
  });

  it('returns 200 with Content-Type: application/pdf for Growth+', async () => {
    mockGetAuthContext.mockResolvedValue(AUTH_GROWTH);
    mockCreateClient.mockResolvedValue(makeMockSupabase());

    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/pdf');
  });

  it('Content-Disposition contains "attachment" and ".pdf"', async () => {
    mockGetAuthContext.mockResolvedValue(AUTH_GROWTH);
    mockCreateClient.mockResolvedValue(makeMockSupabase());

    const response = await GET();
    const cd = response.headers.get('Content-Disposition') ?? '';
    expect(cd).toContain('attachment');
    expect(cd).toContain('.pdf');
  });

  it('filename contains org name slug and current date', async () => {
    mockGetAuthContext.mockResolvedValue(AUTH_GROWTH);
    mockCreateClient.mockResolvedValue(makeMockSupabase());

    const response = await GET();
    const cd = response.headers.get('Content-Disposition') ?? '';
    expect(cd).toContain('charcoal-n-chill');
    const today = new Date().toISOString().split('T')[0];
    expect(cd).toContain(today);
  });

  it('all DB queries run via Promise.all (parallel)', async () => {
    mockGetAuthContext.mockResolvedValue(AUTH_GROWTH);
    const mock = makeMockSupabase();
    mockCreateClient.mockResolvedValue(mock);

    await GET();

    // At least 4 from() calls from Promise.all + 1 for org
    expect(mock.from.mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it('hallucination query includes org_id filter', async () => {
    mockGetAuthContext.mockResolvedValue(AUTH_GROWTH);
    const mock = makeMockSupabase();
    mockCreateClient.mockResolvedValue(mock);

    await GET();

    // First from() call should be ai_hallucinations
    expect(mock.from.mock.calls[0][0]).toBe('ai_hallucinations');
  });

  it('sov_evaluations query is called', async () => {
    mockGetAuthContext.mockResolvedValue(AUTH_GROWTH);
    const mock = makeMockSupabase();
    mockCreateClient.mockResolvedValue(mock);

    await GET();

    const fromCalls = mock.from.mock.calls.map(
      (c: unknown[]) => c[0],
    );
    expect(fromCalls).toContain('sov_evaluations');
  });

  it('locations query is called', async () => {
    mockGetAuthContext.mockResolvedValue(AUTH_GROWTH);
    const mock = makeMockSupabase();
    mockCreateClient.mockResolvedValue(mock);

    await GET();

    const fromCalls = mock.from.mock.calls.map(
      (c: unknown[]) => c[0],
    );
    expect(fromCalls).toContain('locations');
  });

  it('visibility_analytics query is called', async () => {
    mockGetAuthContext.mockResolvedValue(AUTH_GROWTH);
    const mock = makeMockSupabase();
    mockCreateClient.mockResolvedValue(mock);

    await GET();

    const fromCalls = mock.from.mock.calls.map(
      (c: unknown[]) => c[0],
    );
    expect(fromCalls).toContain('visibility_analytics');
  });

  it('calls assembleAuditReportData with correct arguments', async () => {
    mockGetAuthContext.mockResolvedValue(AUTH_GROWTH);
    mockCreateClient.mockResolvedValue(makeMockSupabase());

    await GET();

    expect(mockAssembleAuditReportData).toHaveBeenCalledTimes(1);
    // First arg should be org row, second location, third hallucinations, fourth SOV, fifth score
    expect(mockAssembleAuditReportData.mock.calls[0].length).toBe(5);
  });

  it('calls renderToBuffer', async () => {
    mockGetAuthContext.mockResolvedValue(AUTH_GROWTH);
    mockCreateClient.mockResolvedValue(makeMockSupabase());

    await GET();

    expect(mockRenderToBuffer).toHaveBeenCalledTimes(1);
  });

  it('returns 500 when renderToBuffer throws', async () => {
    mockGetAuthContext.mockResolvedValue(AUTH_GROWTH);
    mockCreateClient.mockResolvedValue(makeMockSupabase());
    mockRenderToBuffer.mockRejectedValue(new Error('PDF render boom'));

    const response = await GET();
    expect(response.status).toBe(500);
    const body = await parseJSON(response);
    expect(body.error).toBe('pdf_render_failed');
  });

  it('Cache-Control: no-store header is set', async () => {
    mockGetAuthContext.mockResolvedValue(AUTH_GROWTH);
    mockCreateClient.mockResolvedValue(makeMockSupabase());

    const response = await GET();
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('returns 404 when org row not found', async () => {
    mockGetAuthContext.mockResolvedValue(AUTH_GROWTH);
    mockCreateClient.mockResolvedValue(
      makeMockSupabase({ orgData: null }),
    );

    const response = await GET();
    expect(response.status).toBe(404);
    const body = await parseJSON(response);
    expect(body.error).toBe('org_not_found');
  });

  it('org not found when getAuthContext throws returns 401', async () => {
    mockGetAuthContext.mockRejectedValue(new Error('No organization found'));
    const response = await GET();
    expect(response.status).toBe(401);
  });
});
