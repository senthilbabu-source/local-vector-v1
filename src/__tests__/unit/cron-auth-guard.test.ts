// ---------------------------------------------------------------------------
// cron-auth-guard.test.ts — CRON_SECRET authorization guard tests
//
// Sprint FIX-3: Verifies that all 4 newly-registered cron routes correctly
// reject unauthenticated requests with 401. Each route uses the same pattern:
//   if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) → 401
//
// Run:
//   npx vitest run src/__tests__/unit/cron-auth-guard.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mock ALL dependencies so imports resolve without side effects ─────────

// Supabase
vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
  })),
}));

// Inngest — reject so inline fallback would run (but auth guard returns first)
vi.mock('@/lib/inngest/client', () => ({
  inngest: { send: vi.fn().mockRejectedValue(new Error('mocked')) },
}));

// Audit service
vi.mock('@/lib/services/ai-audit.service', () => ({
  auditLocation: vi.fn().mockResolvedValue([]),
}));

// Competitor intercept
vi.mock('@/lib/services/competitor-intercept.service', () => ({
  runInterceptForCompetitor: vi.fn().mockResolvedValue(undefined),
}));

// Email
vi.mock('@/lib/email', () => ({
  sendHallucinationAlert: vi.fn(),
  sendWeeklyDigest: vi.fn(),
  sendFreshnessAlert: vi.fn(),
}));

// Revenue leak
vi.mock('@/lib/services/revenue-leak.service', () => ({
  snapshotRevenueLeak: vi.fn().mockResolvedValue(undefined),
}));

// SOV engine
vi.mock('@/lib/services/sov-engine.service', () => ({
  runSOVQuery: vi.fn(),
  runMultiModelSOVQuery: vi.fn(),
  writeSOVResults: vi.fn().mockResolvedValue({ evaluationIds: [] }),
  extractSOVSentiment: vi.fn(),
  writeSentimentData: vi.fn(),
  extractSOVSourceMentions: vi.fn(),
  writeSourceMentions: vi.fn(),
  sleep: vi.fn(),
}));

// Freshness alerts
vi.mock('@/lib/data/freshness-alerts', () => ({
  fetchFreshnessAlerts: vi.fn().mockResolvedValue([]),
}));

// Occasion engine
vi.mock('@/lib/services/occasion-engine.service', () => ({
  runOccasionScheduler: vi.fn().mockResolvedValue(undefined),
}));

// Prompt intelligence
vi.mock('@/lib/services/prompt-intelligence.service', () => ({
  detectQueryGaps: vi.fn().mockResolvedValue([]),
}));

// Plan enforcer — keep real exports but mock canRunAutopilot/canRunMultiModelSOV
vi.mock('@/lib/plan-enforcer', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/plan-enforcer')>();
  return {
    ...real,
    canRunAutopilot: vi.fn().mockReturnValue(false),
    canRunMultiModelSOV: vi.fn().mockReturnValue(false),
  };
});

// Autopilot create-draft
vi.mock('@/lib/autopilot/create-draft', () => ({
  createDraft: vi.fn(),
  archiveExpiredOccasionDrafts: vi.fn(),
}));

// Autopilot post-publish
vi.mock('@/lib/autopilot/post-publish', () => ({
  getPendingRechecks: vi.fn().mockResolvedValue([]),
  completeRecheck: vi.fn(),
}));

// Citation engine
vi.mock('@/lib/services/citation-engine.service', () => ({
  runCitationSample: vi.fn().mockResolvedValue([]),
  writeCitationResults: vi.fn().mockResolvedValue(undefined),
}));

// Citation query builder
vi.mock('@/lib/citation/citation-query-builder', () => ({
  normalizeCategoryLabel: vi.fn((s: string) => s),
}));

// Page audit auditor
vi.mock('@/lib/page-audit/auditor', () => ({
  auditPage: vi.fn().mockResolvedValue({}),
}));

// Cron logger
vi.mock('@/lib/services/cron-logger', () => ({
  logCronStart: vi.fn().mockResolvedValue('run-id'),
  logCronComplete: vi.fn().mockResolvedValue(undefined),
  logCronFailed: vi.fn().mockResolvedValue(undefined),
}));

// ── Import route handlers after vi.mock ──────────────────────────────────

import { GET as auditGET } from '@/app/api/cron/audit/route';
import { GET as sovGET } from '@/app/api/cron/sov/route';
import { GET as citationGET } from '@/app/api/cron/citation/route';
import { GET as contentAuditGET } from '@/app/api/cron/content-audit/route';

// ── Helpers ──────────────────────────────────────────────────────────────

const CRON_SECRET = 'test-secret-fix3';

function makeRequest(path: string, authHeader?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (authHeader) headers['authorization'] = authHeader;
  return new NextRequest(`http://localhost${path}`, { headers });
}

// ── Setup ────────────────────────────────────────────────────────────────

beforeAll(() => {
  vi.stubEnv('CRON_SECRET', CRON_SECRET);
});

afterAll(() => {
  vi.unstubAllEnvs();
});

// ── Tests ────────────────────────────────────────────────────────────────

describe('cron route CRON_SECRET authorization guard', () => {
  describe('/api/cron/audit', () => {
    it('returns 401 when Authorization header is absent', async () => {
      const res = await auditGET(makeRequest('/api/cron/audit'));
      expect(res.status).toBe(401);
    });

    it('returns 401 when Authorization header has wrong secret', async () => {
      const res = await auditGET(makeRequest('/api/cron/audit', 'Bearer wrong-secret'));
      expect(res.status).toBe(401);
    });
  });

  describe('/api/cron/sov', () => {
    it('returns 401 when Authorization header is absent', async () => {
      const res = await sovGET(makeRequest('/api/cron/sov'));
      expect(res.status).toBe(401);
    });

    it('returns 401 when Authorization header has wrong secret', async () => {
      const res = await sovGET(makeRequest('/api/cron/sov', 'Bearer wrong-secret'));
      expect(res.status).toBe(401);
    });

    it('proceeds past auth guard when correct secret provided', async () => {
      // With correct auth + kill switch ON, it returns { ok: true, halted: true }
      vi.stubEnv('STOP_SOV_CRON', 'true');
      const res = await sovGET(makeRequest('/api/cron/sov', `Bearer ${CRON_SECRET}`));
      expect(res.status).not.toBe(401);
      vi.stubEnv('STOP_SOV_CRON', '');
    });
  });

  describe('/api/cron/citation', () => {
    it('returns 401 when Authorization header is absent', async () => {
      const res = await citationGET(makeRequest('/api/cron/citation'));
      expect(res.status).toBe(401);
    });

    it('returns 401 when wrong secret provided', async () => {
      const res = await citationGET(makeRequest('/api/cron/citation', 'Bearer bad'));
      expect(res.status).toBe(401);
    });
  });

  describe('/api/cron/content-audit', () => {
    it('returns 401 when Authorization header is absent', async () => {
      const res = await contentAuditGET(makeRequest('/api/cron/content-audit'));
      expect(res.status).toBe(401);
    });

    it('returns 401 when wrong secret provided', async () => {
      const res = await contentAuditGET(makeRequest('/api/cron/content-audit', 'Bearer nope'));
      expect(res.status).toBe(401);
    });

    it('proceeds past auth guard when correct secret provided', async () => {
      vi.stubEnv('STOP_CONTENT_AUDIT_CRON', 'true');
      const res = await contentAuditGET(
        makeRequest('/api/cron/content-audit', `Bearer ${CRON_SECRET}`),
      );
      expect(res.status).not.toBe(401);
      vi.stubEnv('STOP_CONTENT_AUDIT_CRON', '');
    });
  });
});

// ── Kill switch tests (FIX-4) ────────────────────────────────────────────

describe('cron kill switch behavior', () => {
  it('/api/cron/audit returns halted response when STOP_AUDIT_CRON=true', async () => {
    vi.stubEnv('STOP_AUDIT_CRON', 'true');
    const res = await auditGET(makeRequest('/api/cron/audit', `Bearer ${CRON_SECRET}`));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.halted).toBe(true);
    vi.stubEnv('STOP_AUDIT_CRON', '');
  });

  it('/api/cron/sov returns halted response when STOP_SOV_CRON=true', async () => {
    vi.stubEnv('STOP_SOV_CRON', 'true');
    const res = await sovGET(makeRequest('/api/cron/sov', `Bearer ${CRON_SECRET}`));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.halted).toBe(true);
    vi.stubEnv('STOP_SOV_CRON', '');
  });

  it('/api/cron/audit runs normally when STOP_AUDIT_CRON is unset', async () => {
    vi.stubEnv('STOP_AUDIT_CRON', '');
    const res = await auditGET(makeRequest('/api/cron/audit', `Bearer ${CRON_SECRET}`));
    const body = await res.json();
    // Should not be halted — proceeds to Inngest dispatch or inline execution
    expect(body.halted).toBeUndefined();
    expect(res.status).not.toBe(401);
  });
});
