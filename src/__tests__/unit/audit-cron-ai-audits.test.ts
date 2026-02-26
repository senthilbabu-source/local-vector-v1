// ---------------------------------------------------------------------------
// audit-cron-ai-audits.test.ts — Sprint 68: Validate ai_audits INSERT
//
// Tests that processOrgAudit() correctly writes to ai_audits on every scan
// (with or without hallucinations) and links hallucination rows via audit_id FK.
//
// Run: npx vitest run src/__tests__/unit/audit-cron-ai-audits.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, afterEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { MOCK_AI_AUDIT } from '@/__fixtures__/golden-tenant';

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
import { processOrgAudit } from '@/lib/inngest/functions/audit-cron';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { auditLocation } from '@/lib/services/ai-audit.service';

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
};

const FAKE_AUDIT_ID = MOCK_AI_AUDIT.id;

const FAKE_HALLUCINATION = {
  model_provider: 'openai-gpt4o' as const,
  severity: 'high' as const,
  category: 'status' as const,
  claim_text: 'Restaurant is permanently closed.',
  expected_truth: 'Restaurant is open.',
};

function createMockSupabase(options: {
  auditInsertData?: { id: string } | null;
  auditInsertError?: { message: string } | null;
  hallucinationInsertError?: { message: string } | null;
  location?: typeof TEST_LOCATION | null;
  ownerEmail?: string | null;
} = {}) {
  const location = options.location !== undefined ? options.location : TEST_LOCATION;
  const auditInsertData = options.auditInsertData !== undefined ? options.auditInsertData : { id: FAKE_AUDIT_ID };
  const auditInsertError = options.auditInsertError ?? null;
  const hallucinationInsertError = options.hallucinationInsertError ?? null;
  const ownerEmail = options.ownerEmail !== undefined ? options.ownerEmail : 'owner@test.com';

  const mockHallucinationInsert = vi.fn().mockResolvedValue({
    data: null,
    error: hallucinationInsertError,
  });

  const mockAuditInsertSingle = vi.fn().mockResolvedValue({
    data: auditInsertData,
    error: auditInsertError,
  });

  const mockAuditInsertSelect = vi.fn().mockReturnValue({
    single: mockAuditInsertSingle,
  });

  const mockAuditInsert = vi.fn().mockReturnValue({
    select: mockAuditInsertSelect,
  });

  const mockClient = {
    from: vi.fn((table: string) => {
      if (table === 'locations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: location,
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'ai_audits') {
        return { insert: mockAuditInsert };
      }
      if (table === 'ai_hallucinations') {
        return { insert: mockHallucinationInsert };
      }
      if (table === 'memberships') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: ownerEmail ? { users: { email: ownerEmail } } : null,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }
      return {};
    }),
  } as unknown as SupabaseClient<Database>;

  vi.mocked(createServiceRoleClient as () => SupabaseClient<Database>).mockReturnValue(mockClient);

  return {
    mockClient,
    mockAuditInsert,
    mockAuditInsertSingle,
    mockHallucinationInsert,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('processOrgAudit — ai_audits integration', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('creates ai_audits row when hallucinations ARE found', async () => {
    vi.mocked(auditLocation).mockResolvedValueOnce([FAKE_HALLUCINATION]);
    const { mockAuditInsert } = createMockSupabase();

    await processOrgAudit(TEST_ORG);

    expect(mockAuditInsert).toHaveBeenCalledOnce();
    expect(mockAuditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: 'org-001',
        location_id: 'loc-001',
        is_hallucination_detected: true,
      }),
    );
  });

  it('creates ai_audits row when hallucinations are NOT found (clean scan)', async () => {
    vi.mocked(auditLocation).mockResolvedValueOnce([]);
    const { mockAuditInsert } = createMockSupabase();

    await processOrgAudit(TEST_ORG);

    expect(mockAuditInsert).toHaveBeenCalledOnce();
    expect(mockAuditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        is_hallucination_detected: false,
      }),
    );
  });

  it('sets is_hallucination_detected=true when hallucinations found', async () => {
    vi.mocked(auditLocation).mockResolvedValueOnce([FAKE_HALLUCINATION]);
    const { mockAuditInsert } = createMockSupabase();

    await processOrgAudit(TEST_ORG);

    const insertArg = mockAuditInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.is_hallucination_detected).toBe(true);
  });

  it('sets is_hallucination_detected=false when no hallucinations', async () => {
    vi.mocked(auditLocation).mockResolvedValueOnce([]);
    const { mockAuditInsert } = createMockSupabase();

    await processOrgAudit(TEST_ORG);

    const insertArg = mockAuditInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.is_hallucination_detected).toBe(false);
  });

  it('links hallucination rows to audit via audit_id FK', async () => {
    vi.mocked(auditLocation).mockResolvedValueOnce([FAKE_HALLUCINATION]);
    const { mockHallucinationInsert } = createMockSupabase();

    await processOrgAudit(TEST_ORG);

    expect(mockHallucinationInsert).toHaveBeenCalledOnce();
    const hallRows = mockHallucinationInsert.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(hallRows[0].audit_id).toBe(FAKE_AUDIT_ID);
  });

  it('sets model_provider to openai-gpt4o (valid enum)', async () => {
    vi.mocked(auditLocation).mockResolvedValueOnce([]);
    const { mockAuditInsert } = createMockSupabase();

    await processOrgAudit(TEST_ORG);

    const insertArg = mockAuditInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.model_provider).toBe('openai-gpt4o');
  });

  it('sets prompt_type to status_check (valid enum)', async () => {
    vi.mocked(auditLocation).mockResolvedValueOnce([]);
    const { mockAuditInsert } = createMockSupabase();

    await processOrgAudit(TEST_ORG);

    const insertArg = mockAuditInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.prompt_type).toBe('status_check');
  });

  it('still inserts hallucinations even if ai_audits INSERT fails', async () => {
    vi.mocked(auditLocation).mockResolvedValueOnce([FAKE_HALLUCINATION]);
    const { mockHallucinationInsert } = createMockSupabase({
      auditInsertData: null,
      auditInsertError: { message: 'DB constraint' },
    });

    const result = await processOrgAudit(TEST_ORG);

    expect(result.success).toBe(true);
    expect(result.hallucinationsInserted).toBe(1);
    expect(mockHallucinationInsert).toHaveBeenCalledOnce();
  });

  it('returns auditId in result when successful', async () => {
    vi.mocked(auditLocation).mockResolvedValueOnce([]);
    createMockSupabase();

    const result = await processOrgAudit(TEST_ORG);

    expect(result.auditId).toBe(FAKE_AUDIT_ID);
  });

  it('returns auditId=null in result when ai_audits INSERT fails', async () => {
    vi.mocked(auditLocation).mockResolvedValueOnce([]);
    createMockSupabase({
      auditInsertData: null,
      auditInsertError: { message: 'DB constraint' },
    });

    const result = await processOrgAudit(TEST_ORG);

    expect(result.auditId).toBeNull();
  });

  it('sets audit_id=null on hallucination rows when ai_audits INSERT fails', async () => {
    vi.mocked(auditLocation).mockResolvedValueOnce([FAKE_HALLUCINATION]);
    const { mockHallucinationInsert } = createMockSupabase({
      auditInsertData: null,
      auditInsertError: { message: 'DB constraint' },
    });

    await processOrgAudit(TEST_ORG);

    const hallRows = mockHallucinationInsert.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(hallRows[0].audit_id).toBeNull();
  });
});
