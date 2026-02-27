// ---------------------------------------------------------------------------
// correction-action.test.ts — Unit tests for correction server actions
//
// Sprint 75: 9 tests — mocks auth, Supabase, and data fetcher.
//
// Run:
//   npx vitest run src/__tests__/unit/correction-action.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetSafeAuthContext = vi.fn();
vi.mock('@/lib/auth', () => ({
  getSafeAuthContext: () => mockGetSafeAuthContext(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

const mockFetchCorrectionPackage = vi.fn();
vi.mock('@/lib/data/correction-generator', () => ({
  fetchCorrectionPackage: (...args: unknown[]) => mockFetchCorrectionPackage(...args),
}));

vi.mock('@/lib/plan-enforcer', () => ({
  canRunAutopilot: vi.fn((plan: string) => plan === 'growth' || plan === 'agency'),
}));

// Supabase mock for createCorrectionDraft
const mockSingle = vi.fn();
const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
const mockMaybeSingle = vi.fn();
const mockEqChain = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
const mockEqFirst = vi.fn().mockReturnValue({ eq: mockEqChain });
const mockSelectFrom = vi.fn().mockReturnValue({ eq: mockEqFirst });
const mockFrom = vi.fn().mockReturnValue({
  select: mockSelectFrom,
  insert: mockInsert,
});

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({ from: mockFrom }),
}));

// ---------------------------------------------------------------------------
// Import under test (after mocks)
// ---------------------------------------------------------------------------

const { generateCorrection, createCorrectionDraft } = await import(
  '@/app/dashboard/actions/correction'
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFormData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) {
    fd.set(k, v);
  }
  return fd;
}

const TEST_HALL_ID = 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

// ---------------------------------------------------------------------------
// Tests — generateCorrection
// ---------------------------------------------------------------------------

describe('generateCorrection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. returns Unauthorized when no session', async () => {
    mockGetSafeAuthContext.mockResolvedValue(null);
    const fd = makeFormData({ hallucinationId: TEST_HALL_ID });
    const result = await generateCorrection(fd);
    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('2. returns validation error for invalid UUID', async () => {
    mockGetSafeAuthContext.mockResolvedValue({ userId: 'u1', orgId: 'org-1' });
    const fd = makeFormData({ hallucinationId: 'not-a-uuid' });
    const result = await generateCorrection(fd);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeTruthy();
    }
  });

  it('3. returns success with CorrectionPackage on happy path', async () => {
    mockGetSafeAuthContext.mockResolvedValue({ userId: 'u1', orgId: 'org-1' });
    const mockPkg = {
      diagnosis: 'AI is wrong',
      actions: [{ title: 'Fix GBP', description: 'Post update', impact: 'high', platform: 'gbp' }],
      content: {
        gbpPost: 'We are open!',
        websiteSnippet: 'Open now.',
        llmsTxtEntry: 'CORRECTION: Open.',
        socialPost: 'Visit us!',
      },
    };
    mockFetchCorrectionPackage.mockResolvedValue(mockPkg);

    const fd = makeFormData({ hallucinationId: TEST_HALL_ID });
    const result = await generateCorrection(fd);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.diagnosis).toBe('AI is wrong');
      expect(result.data.content.gbpPost).toBe('We are open!');
    }
  });

  it('4. passes hallucinationId and orgId to fetchCorrectionPackage', async () => {
    mockGetSafeAuthContext.mockResolvedValue({ userId: 'u1', orgId: 'org-42' });
    mockFetchCorrectionPackage.mockResolvedValue(null);

    const fd = makeFormData({ hallucinationId: TEST_HALL_ID });
    await generateCorrection(fd);

    expect(mockFetchCorrectionPackage).toHaveBeenCalledWith(
      expect.anything(), // supabase client
      TEST_HALL_ID,
      'org-42',
    );
  });
});

// ---------------------------------------------------------------------------
// Tests — createCorrectionDraft
// ---------------------------------------------------------------------------

describe('createCorrectionDraft', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: Growth plan org
    mockMaybeSingle.mockResolvedValue({ data: { id: 'loc-1' }, error: null });
    mockEqChain.mockReturnValue({ maybeSingle: mockMaybeSingle });
  });

  it('5. returns Unauthorized when no session', async () => {
    mockGetSafeAuthContext.mockResolvedValue(null);
    const fd = makeFormData({
      hallucinationId: TEST_HALL_ID,
      contentType: 'gbp_post',
      title: 'Test Title',
      content: 'Test content for the draft.',
    });
    const result = await createCorrectionDraft(fd);
    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('6. returns error when required fields missing', async () => {
    mockGetSafeAuthContext.mockResolvedValue({ userId: 'u1', orgId: 'org-1' });
    const fd = makeFormData({ hallucinationId: TEST_HALL_ID });
    const result = await createCorrectionDraft(fd);
    expect(result.success).toBe(false);
  });

  it('7. inserts content_draft with trigger_type=hallucination_correction', async () => {
    mockGetSafeAuthContext.mockResolvedValue({ userId: 'u1', orgId: 'org-1' });
    // Mock org plan check: from('organizations').select().eq().single()
    mockFrom.mockImplementation((table: string) => {
      if (table === 'organizations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { plan: 'growth' }, error: null }),
            }),
          }),
        };
      }
      if (table === 'locations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'loc-1' }, error: null }),
              }),
            }),
          }),
        };
      }
      // content_drafts
      return {
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: 'draft-1' }, error: null }),
          }),
        }),
      };
    });

    const fd = makeFormData({
      hallucinationId: TEST_HALL_ID,
      contentType: 'gbp_post',
      title: 'Correction Post',
      content: 'We are open and serving customers!',
    });
    const result = await createCorrectionDraft(fd);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.draftId).toBe('draft-1');
    }
  });

  it('8. sets trigger_id to the hallucination ID', async () => {
    mockGetSafeAuthContext.mockResolvedValue({ userId: 'u1', orgId: 'org-1' });
    const capturedInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'draft-2' }, error: null }),
      }),
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'organizations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { plan: 'growth' }, error: null }),
            }),
          }),
        };
      }
      if (table === 'locations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'loc-1' }, error: null }),
              }),
            }),
          }),
        };
      }
      return { insert: capturedInsert };
    });

    const fd = makeFormData({
      hallucinationId: TEST_HALL_ID,
      contentType: 'gbp_post',
      title: 'Correction Post',
      content: 'We are open and serving customers!',
    });
    await createCorrectionDraft(fd);

    expect(capturedInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger_type: 'hallucination_correction',
        trigger_id: TEST_HALL_ID,
      }),
    );
  });

  it('9. returns draftId on success', async () => {
    mockGetSafeAuthContext.mockResolvedValue({ userId: 'u1', orgId: 'org-1' });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'organizations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { plan: 'growth' }, error: null }),
            }),
          }),
        };
      }
      if (table === 'locations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'loc-1' }, error: null }),
              }),
            }),
          }),
        };
      }
      return {
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: 'draft-99' }, error: null }),
          }),
        }),
      };
    });

    const fd = makeFormData({
      hallucinationId: TEST_HALL_ID,
      contentType: 'gbp_post',
      title: 'Fix it post',
      content: 'We are OPEN at Charcoal N Chill!',
    });
    const result = await createCorrectionDraft(fd);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.draftId).toBe('draft-99');
    }
  });
});
