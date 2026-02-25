// @vitest-environment node
/**
 * Content Drafts Server Actions — Unit Tests (Sprint 42 §2f)
 *
 * Covers:
 *   - approveDraft: updates status, human_approved, approved_at
 *   - rejectDraft: updates status to rejected
 *   - createManualDraft: inserts with correct fields + Zod validation
 *   - Auth failure returns error
 *   - Plan gating blocks trial/starter on createManualDraft
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

const mockGetSafeAuthContext = vi.fn();
vi.mock('@/lib/auth', () => ({
  getSafeAuthContext: () => mockGetSafeAuthContext(),
}));

// Chainable Supabase mock — uses a mutable ref that tests can swap
const supabaseRef: { current: ReturnType<typeof makeSupabaseMock> } = {
  current: null!,
};

function makeSupabaseMock(opts: {
  updateError?: { message: string } | null;
  insertError?: { message: string } | null;
  planData?: { plan: string } | null;
} = {}) {
  const updateError = opts.updateError ?? null;
  const insertError = opts.insertError ?? null;
  const planData = opts.planData ?? null;

  // Update chain: from('content_drafts').update({}).eq('id', x).eq('org_id', y)
  const updateSecondEq = vi.fn().mockResolvedValue({ error: updateError });
  const updateFirstEq = vi.fn().mockReturnValue({ eq: updateSecondEq });
  const update = vi.fn().mockReturnValue({ eq: updateFirstEq });

  // Insert chain: from('content_drafts').insert({})
  const insert = vi.fn().mockResolvedValue({ error: insertError });

  // Select chain for plan fetch: from('organizations').select('plan').eq('id', x).single()
  const single = vi.fn().mockResolvedValue({ data: planData });
  const selectEq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq: selectEq });

  const from = vi.fn().mockImplementation((table: string) => {
    if (table === 'organizations') {
      return { select };
    }
    return { update, insert };
  });

  return { from, update, insert, updateFirstEq, updateSecondEq, select, selectEq, single };
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => Promise.resolve(supabaseRef.current),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { approveDraft, rejectDraft, createManualDraft } from '@/app/dashboard/content-drafts/actions';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFormData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    fd.set(key, value);
  }
  return fd;
}

const VALID_UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const AUTH_CTX = { orgId: 'org-001', email: 'test@test.com', fullName: 'Test User' };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('approveDraft', () => {
  beforeEach(() => {
    mockGetSafeAuthContext.mockReset();
    supabaseRef.current = makeSupabaseMock();
  });

  it('returns error when not authenticated', async () => {
    mockGetSafeAuthContext.mockResolvedValue(null);
    const result = await approveDraft(makeFormData({ draft_id: VALID_UUID }));
    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('returns error for invalid draft_id', async () => {
    mockGetSafeAuthContext.mockResolvedValue(AUTH_CTX);
    const result = await approveDraft(makeFormData({ draft_id: 'not-a-uuid' }));
    expect(result).toEqual({ success: false, error: 'Invalid draft ID' });
  });

  it('updates draft to approved status', async () => {
    mockGetSafeAuthContext.mockResolvedValue(AUTH_CTX);
    const mock = makeSupabaseMock();
    supabaseRef.current = mock;

    const result = await approveDraft(makeFormData({ draft_id: VALID_UUID }));
    expect(result).toEqual({ success: true });

    expect(mock.from).toHaveBeenCalledWith('content_drafts');
    expect(mock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'approved',
        human_approved: true,
      }),
    );
  });

  it('returns error on DB failure', async () => {
    mockGetSafeAuthContext.mockResolvedValue(AUTH_CTX);
    supabaseRef.current = makeSupabaseMock({ updateError: { message: 'DB error' } });

    const result = await approveDraft(makeFormData({ draft_id: VALID_UUID }));
    expect(result).toEqual({ success: false, error: 'DB error' });
  });
});

describe('rejectDraft', () => {
  beforeEach(() => {
    mockGetSafeAuthContext.mockReset();
    supabaseRef.current = makeSupabaseMock();
  });

  it('returns error when not authenticated', async () => {
    mockGetSafeAuthContext.mockResolvedValue(null);
    const result = await rejectDraft(makeFormData({ draft_id: VALID_UUID }));
    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('updates draft to rejected status', async () => {
    mockGetSafeAuthContext.mockResolvedValue(AUTH_CTX);
    const mock = makeSupabaseMock();
    supabaseRef.current = mock;

    const result = await rejectDraft(makeFormData({ draft_id: VALID_UUID }));
    expect(result).toEqual({ success: true });

    expect(mock.update).toHaveBeenCalledWith({ status: 'rejected' });
  });
});

describe('createManualDraft', () => {
  beforeEach(() => {
    mockGetSafeAuthContext.mockReset();
    supabaseRef.current = makeSupabaseMock({ planData: { plan: 'growth' } });
  });

  it('returns error when not authenticated', async () => {
    mockGetSafeAuthContext.mockResolvedValue(null);
    const result = await createManualDraft(
      makeFormData({
        draft_title: 'Test Title',
        draft_content: 'Test content that is long enough',
        content_type: 'blog_post',
      }),
    );
    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('blocks trial plan from creating drafts', async () => {
    mockGetSafeAuthContext.mockResolvedValue(AUTH_CTX);
    supabaseRef.current = makeSupabaseMock({ planData: { plan: 'trial' } });

    const result = await createManualDraft(
      makeFormData({
        draft_title: 'Test Title',
        draft_content: 'Test content that is long enough',
        content_type: 'blog_post',
      }),
    );
    expect(result).toEqual({
      success: false,
      error: 'Upgrade to Growth to create content drafts',
    });
  });

  it('blocks starter plan from creating drafts', async () => {
    mockGetSafeAuthContext.mockResolvedValue(AUTH_CTX);
    supabaseRef.current = makeSupabaseMock({ planData: { plan: 'starter' } });

    const result = await createManualDraft(
      makeFormData({
        draft_title: 'Test Title',
        draft_content: 'Test content that is long enough',
        content_type: 'blog_post',
      }),
    );
    expect(result).toEqual({
      success: false,
      error: 'Upgrade to Growth to create content drafts',
    });
  });

  it('allows growth plan to create drafts', async () => {
    mockGetSafeAuthContext.mockResolvedValue(AUTH_CTX);
    const mock = makeSupabaseMock({ planData: { plan: 'growth' } });
    supabaseRef.current = mock;

    const result = await createManualDraft(
      makeFormData({
        draft_title: 'Test Title',
        draft_content: 'Test content that is long enough',
        content_type: 'blog_post',
      }),
    );
    expect(result).toEqual({ success: true });

    expect(mock.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: 'org-001',
        trigger_type: 'manual',
        draft_title: 'Test Title',
        content_type: 'blog_post',
        status: 'draft',
      }),
    );
  });

  it('validates title minimum length', async () => {
    mockGetSafeAuthContext.mockResolvedValue(AUTH_CTX);
    supabaseRef.current = makeSupabaseMock({ planData: { plan: 'growth' } });

    const result = await createManualDraft(
      makeFormData({
        draft_title: 'AB',
        draft_content: 'Test content that is long enough',
        content_type: 'blog_post',
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('at least 3 characters');
    }
  });

  it('validates content minimum length', async () => {
    mockGetSafeAuthContext.mockResolvedValue(AUTH_CTX);
    supabaseRef.current = makeSupabaseMock({ planData: { plan: 'growth' } });

    const result = await createManualDraft(
      makeFormData({
        draft_title: 'Valid Title',
        draft_content: 'Short',
        content_type: 'blog_post',
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('at least 10 characters');
    }
  });

  it('validates content_type enum', async () => {
    mockGetSafeAuthContext.mockResolvedValue(AUTH_CTX);
    supabaseRef.current = makeSupabaseMock({ planData: { plan: 'growth' } });

    const result = await createManualDraft(
      makeFormData({
        draft_title: 'Valid Title',
        draft_content: 'Test content that is long enough',
        content_type: 'invalid_type',
      }),
    );
    expect(result.success).toBe(false);
  });
});
