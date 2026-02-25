// ---------------------------------------------------------------------------
// inngest-audit-cron.test.ts — Unit tests for Audit daily Inngest function
//
// Tests processOrgAudit and processOrgIntercepts helpers which contain the
// per-org orchestration logic.
//
// Run: npx vitest run src/__tests__/unit/inngest-audit-cron.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock services before imports ──────────────────────────────────────────
vi.mock('@/lib/services/ai-audit.service', () => ({
  auditLocation: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/services/competitor-intercept.service', () => ({
  runInterceptForCompetitor: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: vi.fn(),
}));

vi.mock('@/lib/email', () => ({
  sendHallucinationAlert: vi.fn().mockResolvedValue(undefined),
}));

// ── Import after mocks ──────────────────────────────────────────────────
import { processOrgAudit, processOrgIntercepts } from '@/lib/inngest/functions/audit-cron';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { auditLocation } from '@/lib/services/ai-audit.service';
import { runInterceptForCompetitor } from '@/lib/services/competitor-intercept.service';
import { sendHallucinationAlert } from '@/lib/email';

// ── Helpers ──────────────────────────────────────────────────────────────

const TEST_ORG = { id: 'org-001', name: 'Test Restaurant' };
const TEST_LOCATION = {
  id: 'loc-001',
  org_id: 'org-001',
  business_name: 'Test Restaurant',
  city: 'Atlanta',
  state: 'GA',
  address_line1: '123 Test St',
  hours_data: null,
  amenities: null,
  categories: ['restaurant'],
};

function mockSupabaseForAudit(opts: {
  location?: typeof TEST_LOCATION | null;
  competitors?: Array<{ id: string; competitor_name: string }>;
  ownerEmail?: string | null;
} = {}) {
  const location = opts.location !== undefined ? opts.location : TEST_LOCATION;
  const competitors = opts.competitors ?? [];
  const ownerEmail = opts.ownerEmail !== undefined ? opts.ownerEmail : 'owner@test.com';

  const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockLocationMaybeSingle = vi.fn().mockResolvedValue({
    data: location,
    error: null,
  });
  const mockMembershipMaybeSingle = vi.fn().mockResolvedValue({
    data: ownerEmail ? { users: { email: ownerEmail } } : null,
    error: null,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(createServiceRoleClient as any).mockReturnValue({
    from: vi.fn((table: string) => {
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

  return { mockInsert };
}

// ── processOrgAudit Tests ────────────────────────────────────────────────

describe('processOrgAudit', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns zero hallucinations when auditLocation finds none', async () => {
    mockSupabaseForAudit();
    vi.mocked(auditLocation).mockResolvedValueOnce([]);

    const result = await processOrgAudit(TEST_ORG);
    expect(result.success).toBe(true);
    expect(result.hallucinationsInserted).toBe(0);
  });

  it('inserts hallucinations and sends email alert', async () => {
    const fakeHallucination = {
      model_provider: 'openai-gpt4o' as const,
      severity: 'high' as const,
      category: 'status' as const,
      claim_text: 'Restaurant is permanently closed.',
      expected_truth: 'Restaurant is open.',
    };
    vi.mocked(auditLocation).mockResolvedValueOnce([fakeHallucination]);
    const { mockInsert } = mockSupabaseForAudit();

    const result = await processOrgAudit(TEST_ORG);

    expect(result.success).toBe(true);
    expect(result.hallucinationsInserted).toBe(1);
    expect(mockInsert).toHaveBeenCalledOnce();

    // Email sent
    expect(vi.mocked(sendHallucinationAlert)).toHaveBeenCalledOnce();
    const emailPayload = vi.mocked(sendHallucinationAlert).mock.calls[0][0];
    expect(emailPayload.to).toBe('owner@test.com');
    expect(emailPayload.hallucinationCount).toBe(1);
  });

  it('skips when no primary location exists', async () => {
    mockSupabaseForAudit({ location: null });

    const result = await processOrgAudit(TEST_ORG);
    expect(result.success).toBe(true);
    expect(result.hallucinationsInserted).toBe(0);
    expect(vi.mocked(auditLocation)).not.toHaveBeenCalled();
  });

  it('does not fail when email send throws', async () => {
    const fakeHallucination = {
      model_provider: 'openai-gpt4o' as const,
      severity: 'medium' as const,
      category: 'amenity' as const,
      claim_text: 'No outdoor seating.',
      expected_truth: 'Has outdoor seating.',
    };
    vi.mocked(auditLocation).mockResolvedValueOnce([fakeHallucination]);
    vi.mocked(sendHallucinationAlert).mockRejectedValueOnce(new Error('Resend error'));
    mockSupabaseForAudit();

    const result = await processOrgAudit(TEST_ORG);
    expect(result.success).toBe(true);
    expect(result.hallucinationsInserted).toBe(1);
  });

  it('throws when auditLocation throws (step-level retry)', async () => {
    vi.mocked(auditLocation).mockRejectedValueOnce(new Error('OpenAI 429'));
    mockSupabaseForAudit();

    await expect(processOrgAudit(TEST_ORG)).rejects.toThrow('OpenAI 429');
  });
});

// ── processOrgIntercepts Tests ──────────────────────────────────────────

describe('processOrgIntercepts', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns zero when no competitors exist', async () => {
    mockSupabaseForAudit({ competitors: [] });

    const result = await processOrgIntercepts(TEST_ORG);
    expect(result.interceptsInserted).toBe(0);
    expect(vi.mocked(runInterceptForCompetitor)).not.toHaveBeenCalled();
  });

  it('calls runInterceptForCompetitor once per competitor', async () => {
    const competitors = [
      { id: 'comp-001', competitor_name: 'Cloud 9 Lounge' },
      { id: 'comp-002', competitor_name: 'Sky Lounge' },
    ];
    mockSupabaseForAudit({ competitors });

    const result = await processOrgIntercepts(TEST_ORG);
    expect(result.interceptsInserted).toBe(2);
    expect(vi.mocked(runInterceptForCompetitor)).toHaveBeenCalledTimes(2);
  });

  it('absorbs intercept errors without failing', async () => {
    const competitors = [
      { id: 'comp-001', competitor_name: 'Cloud 9 Lounge' },
    ];
    mockSupabaseForAudit({ competitors });
    vi.mocked(runInterceptForCompetitor).mockRejectedValueOnce(new Error('API error'));

    const result = await processOrgIntercepts(TEST_ORG);
    expect(result.interceptsInserted).toBe(0);
  });

  it('returns zero when no primary location exists', async () => {
    mockSupabaseForAudit({ location: null });

    const result = await processOrgIntercepts(TEST_ORG);
    expect(result.interceptsInserted).toBe(0);
  });
});
