// ---------------------------------------------------------------------------
// reaudit-action.test.ts — Sprint 71: Server action persistence tests
//
// Validates that reauditPage() writes all 5 dimension scores to the DB.
//
// Run:
//   npx vitest run src/__tests__/unit/reaudit-action.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

// ── Mock setup ───────────────────────────────────────────────────────────

const mockAuthContext = vi.hoisted(() =>
  vi.fn<() => Promise<{ orgId: string; userId: string } | null>>(),
);

const mockUpsert = vi.hoisted(() => vi.fn());
const mockSelectSingle = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth', () => ({
  getSafeAuthContext: mockAuthContext,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn((table: string) => {
      if (table === 'page_audits') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: mockSelectSingle,
              }),
            }),
          }),
          upsert: mockUpsert,
        };
      }
      if (table === 'locations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  business_name: 'Charcoal N Chill',
                  city: 'Alpharetta',
                  state: 'GA',
                  categories: ['Hookah Bar'],
                  amenities: { has_hookah: true },
                },
              }),
            }),
          }),
        };
      }
      return {};
    }),
  } as unknown as SupabaseClient<Database>),
}));

const mockAuditPage = vi.hoisted(() => vi.fn());

vi.mock('@/lib/page-audit/auditor', () => ({
  auditPage: mockAuditPage,
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { reauditPage } from '@/app/dashboard/page-audits/actions';

// ── Test data ────────────────────────────────────────────────────────────

const MOCK_AUDIT_RESULT = {
  overallScore: 72,
  answerFirstScore: 65,
  schemaCompletenessScore: 55,
  faqSchemaPresent: false,
  faqSchemaScore: 0,
  keywordDensityScore: 78,
  entityClarityScore: 62,
  recommendations: [
    { issue: 'No FAQ', fix: 'Add FAQ', impactPoints: 20, dimensionKey: 'faqSchema', schemaType: 'FAQPage' },
  ],
};

// ── Setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  mockAuthContext.mockResolvedValue({
    orgId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    userId: 'u0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  });

  mockSelectSingle.mockResolvedValue({
    data: {
      id: 'b2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      page_type: 'homepage',
      location_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    },
  });

  mockUpsert.mockResolvedValue({ error: null });
  mockAuditPage.mockResolvedValue(MOCK_AUDIT_RESULT);
});

// ── Tests ────────────────────────────────────────────────────────────────

describe('reauditPage — dimension persistence', () => {
  // Each test uses a unique URL to avoid the in-memory rate limiter
  it('writes faq_schema_score to DB', async () => {
    const result = await reauditPage('https://charcoalnchill.com/test-1');

    expect(result.success).toBe(true);
    expect(mockUpsert).toHaveBeenCalledTimes(1);

    const upsertArgs = mockUpsert.mock.calls[0][0];
    expect(upsertArgs.faq_schema_score).toBe(0);
  });

  it('writes entity_clarity_score to DB', async () => {
    const result = await reauditPage('https://charcoalnchill.com/test-2');

    expect(result.success).toBe(true);
    const upsertArgs = mockUpsert.mock.calls[0][0];
    expect(upsertArgs.entity_clarity_score).toBe(62);
  });

  it('writes all 5 dimension scores in single upsert', async () => {
    await reauditPage('https://charcoalnchill.com/test-3');

    const upsertArgs = mockUpsert.mock.calls[0][0];

    expect(upsertArgs.answer_first_score).toBe(65);
    expect(upsertArgs.schema_completeness_score).toBe(55);
    expect(upsertArgs.faq_schema_present).toBe(false);
    expect(upsertArgs.faq_schema_score).toBe(0);
    expect(upsertArgs.entity_clarity_score).toBe(62);
    expect(upsertArgs.aeo_readability_score).toBe(78);
    expect(upsertArgs.overall_score).toBe(72);
  });

  it('returns success=false when not authenticated', async () => {
    mockAuthContext.mockResolvedValue(null);

    const result = await reauditPage('https://charcoalnchill.com/test-4');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Not authenticated');
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('returns success=false when audit record not found', async () => {
    mockSelectSingle.mockResolvedValue({ data: null });

    const result = await reauditPage('https://charcoalnchill.com/test-5');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Audit record not found.');
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('returns success=false when audit has no location', async () => {
    mockSelectSingle.mockResolvedValue({
      data: {
        id: 'b2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        page_type: 'homepage',
        location_id: null,
      },
    });

    const result = await reauditPage('https://charcoalnchill.com/test-6');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Audit has no associated location.');
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});
