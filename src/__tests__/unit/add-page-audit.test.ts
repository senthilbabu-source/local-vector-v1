// ---------------------------------------------------------------------------
// add-page-audit.test.ts — Sprint 104: addPageAudit() server action tests
//
// Covers auth, plan gate, URL validation/normalization, rate limit,
// page type inference, and DB persistence.
//
// Run:
//   npx vitest run src/__tests__/unit/add-page-audit.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

// ── Mock setup ───────────────────────────────────────────────────────────

const mockAuthContext = vi.hoisted(() =>
  vi.fn<() => Promise<{ orgId: string; userId: string } | null>>(),
);

const mockUpsert = vi.hoisted(() => vi.fn());
const mockCanRunPageAudit = vi.hoisted(() => vi.fn());
const mockAuditPage = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth', () => ({
  getSafeAuthContext: mockAuthContext,
}));

const mockOrgSelect = vi.hoisted(() => vi.fn());
const mockLocationSelect = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn((table: string) => {
      if (table === 'organizations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: mockOrgSelect,
            }),
          }),
        };
      }
      if (table === 'locations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: mockLocationSelect,
              }),
            }),
          }),
        };
      }
      if (table === 'page_audits') {
        return {
          upsert: mockUpsert,
        };
      }
      return {};
    }),
  } as unknown as SupabaseClient<Database>),
}));

vi.mock('@/lib/page-audit/auditor', () => ({
  auditPage: mockAuditPage,
}));

vi.mock('@/lib/plan-enforcer', () => ({
  canRunPageAudit: mockCanRunPageAudit,
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

import { addPageAudit } from '@/app/dashboard/page-audits/actions';

// ── Test data ────────────────────────────────────────────────────────────

const MOCK_AUDIT_RESULT = {
  overallScore: 72,
  answerFirstScore: 65,
  schemaCompletenessScore: 55,
  faqSchemaPresent: false,
  faqSchemaScore: 0,
  keywordDensityScore: 78,
  entityClarityScore: 62,
  recommendations: [],
};

// ── Setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  mockAuthContext.mockResolvedValue({
    orgId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    userId: 'u0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  });

  mockOrgSelect.mockResolvedValue({
    data: { plan: 'growth' },
  });

  mockCanRunPageAudit.mockReturnValue(true);

  mockLocationSelect.mockResolvedValue({
    data: {
      id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      business_name: 'Charcoal N Chill',
      city: 'Alpharetta',
      state: 'GA',
      categories: ['Hookah Bar'],
      amenities: { has_hookah: true },
    },
  });

  mockUpsert.mockResolvedValue({ error: null });
  mockAuditPage.mockResolvedValue(MOCK_AUDIT_RESULT);
});

// ── Tests ────────────────────────────────────────────────────────────────

describe('addPageAudit', () => {
  describe('auth and plan checks', () => {
    it('returns error when not authenticated (null auth context)', async () => {
      mockAuthContext.mockResolvedValue(null);

      const result = await addPageAudit('https://example.com');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not authenticated');
    });

    it('returns error when orgId is null', async () => {
      mockAuthContext.mockResolvedValue({ orgId: '', userId: 'u1' } as { orgId: string; userId: string });

      const result = await addPageAudit('https://example.com');

      expect(result.success).toBe(false);
    });

    it('returns error when plan is starter (canRunPageAudit = false)', async () => {
      mockOrgSelect.mockResolvedValue({ data: { plan: 'starter' } });
      mockCanRunPageAudit.mockReturnValue(false);

      const result = await addPageAudit('https://example.com/starter-test');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Page audits require Growth or Agency plan.');
    });

    it('proceeds when plan is growth', async () => {
      const result = await addPageAudit('https://example.com/growth-test');

      expect(result.success).toBe(true);
      expect(mockAuditPage).toHaveBeenCalled();
    });
  });

  describe('URL validation and normalization', () => {
    it('normalizes URL missing https:// prefix', async () => {
      await addPageAudit('example.com/normalize-test');

      expect(mockAuditPage).toHaveBeenCalledWith(
        'https://example.com/normalize-test',
        expect.any(String),
        expect.any(Object),
      );
    });

    it('accepts valid https:// URL without modification', async () => {
      await addPageAudit('https://example.com/valid-test');

      expect(mockAuditPage).toHaveBeenCalledWith(
        'https://example.com/valid-test',
        expect.any(String),
        expect.any(Object),
      );
    });

    it('returns error for clearly invalid URL (empty string)', async () => {
      const result = await addPageAudit('');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Please enter a URL.');
    });
  });

  describe('rate limiting', () => {
    it('returns error when same org+URL audited within 5 minutes', async () => {
      // First call should succeed
      const first = await addPageAudit('https://example.com/rate-limit-test');
      expect(first.success).toBe(true);

      // Second call with same URL should be rate limited
      const second = await addPageAudit('https://example.com/rate-limit-test');
      expect(second.success).toBe(false);
      expect(second.error).toContain('wait 5 minutes');
    });
  });

  describe('page type inference', () => {
    it('infers homepage for root URL', async () => {
      await addPageAudit('https://example.com/');

      expect(mockAuditPage).toHaveBeenCalledWith(
        'https://example.com',
        'homepage',
        expect.any(Object),
      );
    });

    it('infers about for /about URL', async () => {
      await addPageAudit('https://example.com/about-inference');

      expect(mockAuditPage).toHaveBeenCalledWith(
        'https://example.com/about-inference',
        'about',
        expect.any(Object),
      );
    });

    it('infers faq for /faq URL', async () => {
      await addPageAudit('https://example.com/faq-inference');

      expect(mockAuditPage).toHaveBeenCalledWith(
        'https://example.com/faq-inference',
        'faq',
        expect.any(Object),
      );
    });
  });

  describe('persistence', () => {
    it('calls auditPage() and upserts result to page_audits with correct fields', async () => {
      await addPageAudit('https://example.com/persist-test');

      expect(mockAuditPage).toHaveBeenCalledTimes(1);
      expect(mockUpsert).toHaveBeenCalledTimes(1);

      const upsertArgs = mockUpsert.mock.calls[0][0];
      expect(upsertArgs.org_id).toBe('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
      expect(upsertArgs.page_url).toBe('https://example.com/persist-test');
      expect(upsertArgs.overall_score).toBe(72);
      expect(upsertArgs.answer_first_score).toBe(65);
      expect(upsertArgs.faq_schema_present).toBe(false);
      expect(upsertArgs.entity_clarity_score).toBe(62);
    });

    it('returns success: true on successful audit and save', async () => {
      const result = await addPageAudit('https://example.com/success-test');

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });
});
