import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock setup ──────────────────────────────────────────────────────────────

const { mockGetSafeAuthContext, mockCreateClient, mockCreateServiceRoleClient, mockRunAuthorityMapping } =
  vi.hoisted(() => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { plan: 'growth' }, error: null }),
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: 'loc-123', authority_score: 58, authority_last_run_at: '2026-03-01T00:00:00Z' },
                  error: null,
                }),
              }),
            }),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    };

    return {
      mockGetSafeAuthContext: vi.fn().mockResolvedValue({
        orgId: 'org-123',
        userId: 'user-123',
        email: 'test@example.com',
        fullName: 'Test User',
      }),
      mockCreateClient: vi.fn().mockResolvedValue(mockSupabase),
      mockCreateServiceRoleClient: vi.fn().mockReturnValue(mockSupabase),
      mockRunAuthorityMapping: vi.fn().mockResolvedValue({
        location_id: 'loc-123',
        org_id: 'org-123',
        entity_authority_score: 58,
        citations_detected: 5,
        sameas_gaps_found: 2,
        velocity: null,
        autopilot_drafts_triggered: 0,
        errors: [],
        run_at: '2026-03-01T05:00:00.000Z',
      }),
    };
  });

vi.mock('@/lib/auth', () => ({
  getSafeAuthContext: mockGetSafeAuthContext,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
  createServiceRoleClient: mockCreateServiceRoleClient,
}));

vi.mock('@/lib/authority/authority-service', () => ({
  runAuthorityMapping: mockRunAuthorityMapping,
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Authority API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/authority/run', () => {
    it('returns 401 when not authenticated', async () => {
      mockGetSafeAuthContext.mockResolvedValueOnce(null);

      const { POST } = await import('@/app/api/authority/run/route');
      const response = await POST();
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error).toBe('unauthorized');
    });

    it('returns 403 when plan is trial', async () => {
      // Override the default plan gate mock
      const trialSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { plan: 'trial' }, error: null }),
            }),
          }),
        }),
      };
      mockCreateClient.mockResolvedValueOnce(trialSupabase);

      const { POST } = await import('@/app/api/authority/run/route');
      const response = await POST();
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.error).toBe('plan_upgrade_required');
    });

    it('returns 404 when no location found', async () => {
      const noLocSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { plan: 'growth' }, error: null }),
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          }),
        }),
      };
      mockCreateClient.mockResolvedValueOnce(noLocSupabase);

      const { POST } = await import('@/app/api/authority/run/route');
      const response = await POST();
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error).toBe('no_location');
    });

    it('returns 200 with result on successful run', async () => {
      const successSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { plan: 'growth' }, error: null }),
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'loc-123' }, error: null }),
                }),
              }),
            }),
          }),
        }),
      };
      mockCreateClient.mockResolvedValueOnce(successSupabase);

      const { POST } = await import('@/app/api/authority/run/route');
      const response = await POST();
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.result.entity_authority_score).toBe(58);
    });
  });

  describe('GET /api/cron/authority-mapping', () => {
    it('returns 401 without CRON_SECRET', async () => {
      const { GET } = await import('@/app/api/cron/authority-mapping/route');
      const request = new Request('http://localhost/api/cron/authority-mapping', {
        headers: { authorization: 'Bearer wrong-secret' },
      });

      // Temporarily set CRON_SECRET
      const originalSecret = process.env.CRON_SECRET;
      process.env.CRON_SECRET = 'test-secret';

      const response = await GET(request as any);
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error).toBe('Unauthorized');

      process.env.CRON_SECRET = originalSecret;
    });

    it('respects kill switch', async () => {
      const { GET } = await import('@/app/api/cron/authority-mapping/route');

      const originalSecret = process.env.CRON_SECRET;
      const originalKill = process.env.STOP_AUTHORITY_CRON;
      process.env.CRON_SECRET = 'test-secret';
      process.env.STOP_AUTHORITY_CRON = 'true';

      const request = new Request('http://localhost/api/cron/authority-mapping', {
        headers: { authorization: 'Bearer test-secret' },
      });

      const response = await GET(request as any);
      const body = await response.json();

      expect(body.ok).toBe(true);
      expect(body.halted).toBe(true);

      process.env.CRON_SECRET = originalSecret;
      process.env.STOP_AUTHORITY_CRON = originalKill;
    });
  });
});
