// ---------------------------------------------------------------------------
// inngest-content-audit-cron.test.ts — Unit tests for Content Audit Inngest function
//
// Tests the processLocationAudit helper which audits each page of a location's
// website and upserts results to page_audits.
//
// Run: npx vitest run src/__tests__/unit/inngest-content-audit-cron.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, afterEach } from 'vitest';

// ── Mock services before imports ──────────────────────────────────────────
vi.mock('@/lib/page-audit/auditor', () => ({
  auditPage: vi.fn().mockResolvedValue({
    overallScore: 65,
    answerFirstScore: 70,
    schemaCompletenessScore: 50,
    faqSchemaPresent: false,
    faqSchemaScore: 0,
    keywordDensityScore: 60,
    entityClarityScore: 80,
    recommendations: [],
  }),
}));

vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: vi.fn(),
}));

// Mock sleep to be instant (prevents 1s delay per page in tests)
vi.mock('@/lib/services/sov-engine.service', () => ({
  sleep: vi.fn().mockResolvedValue(undefined),
}));

// ── Import after mocks ──────────────────────────────────────────────────
import {
  processLocationAudit,
  type LocationAuditInput,
} from '@/lib/inngest/functions/content-audit-cron';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { auditPage } from '@/lib/page-audit/auditor';

// ── Helpers ──────────────────────────────────────────────────────────────

function makeLocation(overrides?: Partial<LocationAuditInput>): LocationAuditInput {
  return {
    id: 'loc-001',
    org_id: 'org-001',
    business_name: 'Test Restaurant',
    city: 'Atlanta',
    state: 'GA',
    categories: ['restaurant'],
    amenities: null,
    website_url: 'https://testrestaurant.com',
    plan: 'growth',
    ...overrides,
  };
}

function mockSupabase() {
  const mockUpsert = vi.fn().mockResolvedValue({ data: null, error: null });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(createServiceRoleClient as any).mockReturnValue({
    from: vi.fn(() => ({
      upsert: mockUpsert,
    })),
  });
  return { mockUpsert };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('processLocationAudit', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('audits pages based on plan cap (growth = 10)', async () => {
    const { mockUpsert } = mockSupabase();

    const result = await processLocationAudit(makeLocation({ plan: 'growth' }));

    // growth plan = 10 pages cap, but only 9 common paths + homepage = 9
    expect(result.pagesAudited).toBe(9);
    expect(result.pagesFailed).toBe(0);
    expect(mockUpsert).toHaveBeenCalledTimes(9);
    expect(vi.mocked(auditPage)).toHaveBeenCalledTimes(9);
  });

  it('audits only homepage for starter plan (cap = 1)', async () => {
    mockSupabase();

    const result = await processLocationAudit(makeLocation({ plan: 'starter' }));

    expect(result.pagesAudited).toBe(1);
    expect(vi.mocked(auditPage)).toHaveBeenCalledOnce();
    // Verify homepage URL was audited
    const callArgs = vi.mocked(auditPage).mock.calls[0];
    expect(callArgs[0]).toBe('https://testrestaurant.com');
    expect(callArgs[1]).toBe('homepage');
  });

  it('collects scores for averaging', async () => {
    mockSupabase();
    vi.mocked(auditPage)
      .mockResolvedValueOnce({
        overallScore: 80,
        answerFirstScore: 80,
        schemaCompletenessScore: 80,
        faqSchemaPresent: false,
        faqSchemaScore: 0,
        keywordDensityScore: 80,
        entityClarityScore: 80,
        recommendations: [],
      })
      .mockResolvedValueOnce({
        overallScore: 60,
        answerFirstScore: 60,
        schemaCompletenessScore: 60,
        faqSchemaPresent: false,
        faqSchemaScore: 0,
        keywordDensityScore: 60,
        entityClarityScore: 60,
        recommendations: [],
      });

    const result = await processLocationAudit(makeLocation({ plan: 'growth' }));

    // First two pages have scores 80 and 60, the rest use default mock (65)
    expect(result.scores).toContain(80);
    expect(result.scores).toContain(60);
    expect(result.scores.length).toBe(9);
  });

  it('handles page fetch failures gracefully', async () => {
    mockSupabase();
    vi.mocked(auditPage).mockRejectedValueOnce(new Error('Page fetch failed: 404'));

    const result = await processLocationAudit(makeLocation({ plan: 'starter' }));

    expect(result.pagesAudited).toBe(0);
    expect(result.pagesFailed).toBe(1);
    expect(result.scores).toHaveLength(0);
  });

  it('continues auditing after one page fails', async () => {
    mockSupabase();
    vi.mocked(auditPage)
      .mockRejectedValueOnce(new Error('Page fetch failed: 404'))
      .mockResolvedValueOnce({
        overallScore: 70,
        answerFirstScore: 70,
        schemaCompletenessScore: 70,
        faqSchemaPresent: true,
        faqSchemaScore: 100,
        keywordDensityScore: 70,
        entityClarityScore: 70,
        recommendations: [],
      });

    // Use growth plan (9 pages): first fails, second custom, rest use default mock
    const result = await processLocationAudit(makeLocation({ plan: 'growth' }));

    expect(result.pagesFailed).toBe(1);
    expect(result.pagesAudited).toBe(8); // 9 pages total minus 1 failed
    expect(result.scores).toContain(70);
  });

  it('upserts page_audits with correct shape', async () => {
    const { mockUpsert } = mockSupabase();

    await processLocationAudit(makeLocation({ plan: 'starter' }));

    expect(mockUpsert).toHaveBeenCalledOnce();
    const upsertArgs = mockUpsert.mock.calls[0];
    const row = upsertArgs[0];
    expect(row).toMatchObject({
      org_id: 'org-001',
      location_id: 'loc-001',
      page_url: 'https://testrestaurant.com',
      page_type: 'homepage',
      overall_score: 65,
    });
    expect(upsertArgs[1]).toEqual({ onConflict: 'org_id,page_url' });
  });
});
