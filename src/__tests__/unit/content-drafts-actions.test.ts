// @vitest-environment node
/**
 * Content Drafts Server Actions — Unit Tests (Sprint 42 §2f + Autopilot Engine)
 *
 * Covers:
 *   - approveDraft: updates status, human_approved, approved_at
 *   - rejectDraft: returns draft to editable state (Doc 19 §4.2)
 *   - createManualDraft: inserts with correct fields + Zod validation
 *   - archiveDraft: sets status to archived
 *   - editDraft: updates content, blocks approved/published, recalculates AEO
 *   - publishDraft: HITL validation, plan gating, download target
 *   - Auth failure returns error
 *   - Plan gating blocks trial/starter
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

// Mock autopilot modules to avoid import chain issues
vi.mock('@/lib/autopilot/score-content', () => ({
  scoreContentHeuristic: vi.fn(() => 72),
}));

vi.mock('@/lib/autopilot/publish-download', () => ({
  publishAsDownload: vi.fn(() =>
    Promise.resolve({ publishedUrl: null, status: 'published', downloadPayload: 'PGh0bWw+' }),
  ),
}));

vi.mock('@/lib/autopilot/publish-gbp', () => ({
  publishToGBP: vi.fn(() =>
    Promise.resolve({ publishedUrl: 'https://gbp.google.com/post/123', status: 'published' }),
  ),
}));

vi.mock('@/lib/autopilot/publish-wordpress', () => ({
  publishToWordPress: vi.fn(() =>
    Promise.resolve({ publishedUrl: 'https://example.com/?p=42', status: 'published' }),
  ),
}));

vi.mock('@/lib/autopilot/post-publish', () => ({
  schedulePostPublishRecheck: vi.fn(() => Promise.resolve()),
}));

// Chainable Supabase mock — uses a mutable ref that tests can swap
const supabaseRef: { current: ReturnType<typeof makeSupabaseMock> } = {
  current: null!,
};

function makeSupabaseMock(opts: {
  updateError?: { message: string } | null;
  insertError?: { message: string } | null;
  planData?: { plan: string } | null;
  draftData?: Record<string, unknown> | null;
} = {}) {
  const updateError = opts.updateError ?? null;
  const insertError = opts.insertError ?? null;
  const planData = opts.planData ?? null;
  const draftData = opts.draftData ?? null;

  // Update chain: from('content_drafts').update({}).eq('id', x).eq('org_id', y)
  const updateSecondEq = vi.fn().mockResolvedValue({ error: updateError });
  const updateFirstEq = vi.fn().mockReturnValue({ eq: updateSecondEq });
  const update = vi.fn().mockReturnValue({ eq: updateFirstEq });

  // Insert chain: from('content_drafts').insert({})
  const insert = vi.fn().mockResolvedValue({ error: insertError });

  // Select chain for plan fetch: from('organizations').select('plan').eq('id', x).single()
  const planSingle = vi.fn().mockResolvedValue({ data: planData });
  const planSelectEq = vi.fn().mockReturnValue({ single: planSingle });
  const planSelect = vi.fn().mockReturnValue({ eq: planSelectEq });

  // Select chain for draft fetch: from('content_drafts').select('*').eq('id', x).eq('org_id', y).single()
  const draftSingle = vi.fn().mockResolvedValue({ data: draftData });
  const draftSecondEq = vi.fn().mockReturnValue({ single: draftSingle });
  const draftFirstEq = vi.fn().mockReturnValue({ eq: draftSecondEq });
  const draftSelect = vi.fn().mockReturnValue({ eq: draftFirstEq });

  const from = vi.fn().mockImplementation((table: string) => {
    if (table === 'organizations') {
      return { select: planSelect };
    }
    // Return both update, insert, and select for content_drafts
    return { update, insert, select: draftSelect };
  });

  return {
    from,
    update,
    insert,
    updateFirstEq,
    updateSecondEq,
    select: planSelect,
    selectEq: planSelectEq,
    single: planSingle,
    draftSelect,
  };
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => Promise.resolve(supabaseRef.current),
  createServiceRoleClient: () => supabaseRef.current,
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  approveDraft,
  rejectDraft,
  createManualDraft,
  archiveDraft,
  editDraft,
  publishDraft,
} from '@/app/dashboard/content-drafts/actions';

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

  it('returns draft to editable state (Doc 19 §4.2)', async () => {
    mockGetSafeAuthContext.mockResolvedValue(AUTH_CTX);
    const mock = makeSupabaseMock();
    supabaseRef.current = mock;

    const result = await rejectDraft(makeFormData({ draft_id: VALID_UUID }));
    expect(result).toEqual({ success: true });

    expect(mock.update).toHaveBeenCalledWith({ status: 'draft', human_approved: false });
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

// ---------------------------------------------------------------------------
// archiveDraft
// ---------------------------------------------------------------------------

describe('archiveDraft', () => {
  beforeEach(() => {
    mockGetSafeAuthContext.mockReset();
    supabaseRef.current = makeSupabaseMock();
  });

  it('returns error when not authenticated', async () => {
    mockGetSafeAuthContext.mockResolvedValue(null);
    const result = await archiveDraft(makeFormData({ draft_id: VALID_UUID }));
    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('sets status to archived', async () => {
    mockGetSafeAuthContext.mockResolvedValue(AUTH_CTX);
    const mock = makeSupabaseMock();
    supabaseRef.current = mock;

    const result = await archiveDraft(makeFormData({ draft_id: VALID_UUID }));
    expect(result).toEqual({ success: true });
    expect(mock.update).toHaveBeenCalledWith({ status: 'archived' });
  });

  it('returns error on DB failure', async () => {
    mockGetSafeAuthContext.mockResolvedValue(AUTH_CTX);
    supabaseRef.current = makeSupabaseMock({ updateError: { message: 'DB error' } });

    const result = await archiveDraft(makeFormData({ draft_id: VALID_UUID }));
    expect(result).toEqual({ success: false, error: 'DB error' });
  });
});

// ---------------------------------------------------------------------------
// editDraft
// ---------------------------------------------------------------------------

describe('editDraft', () => {
  beforeEach(() => {
    mockGetSafeAuthContext.mockReset();
  });

  it('returns error when not authenticated', async () => {
    mockGetSafeAuthContext.mockResolvedValue(null);
    const result = await editDraft(
      makeFormData({ draft_id: VALID_UUID, draft_title: 'New Title' }),
    );
    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('blocks edit of approved drafts', async () => {
    mockGetSafeAuthContext.mockResolvedValue(AUTH_CTX);
    supabaseRef.current = makeSupabaseMock({
      draftData: { id: VALID_UUID, status: 'approved', draft_content: 'old', location_id: null },
    });

    const result = await editDraft(
      makeFormData({ draft_id: VALID_UUID, draft_title: 'New Title' }),
    );
    expect(result).toEqual({ success: false, error: 'Reject the draft before editing' });
  });

  it('blocks edit of published drafts', async () => {
    mockGetSafeAuthContext.mockResolvedValue(AUTH_CTX);
    supabaseRef.current = makeSupabaseMock({
      draftData: { id: VALID_UUID, status: 'published', draft_content: 'old', location_id: null },
    });

    const result = await editDraft(
      makeFormData({ draft_id: VALID_UUID, draft_title: 'New Title' }),
    );
    expect(result).toEqual({ success: false, error: 'Published drafts cannot be edited' });
  });
});

// ---------------------------------------------------------------------------
// publishDraft
// ---------------------------------------------------------------------------

describe('publishDraft', () => {
  beforeEach(() => {
    mockGetSafeAuthContext.mockReset();
  });

  it('returns error when not authenticated', async () => {
    mockGetSafeAuthContext.mockResolvedValue(null);
    const result = await publishDraft(
      makeFormData({ draft_id: VALID_UUID, publish_target: 'download' }),
    );
    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('blocks trial plan from publishing', async () => {
    mockGetSafeAuthContext.mockResolvedValue(AUTH_CTX);
    supabaseRef.current = makeSupabaseMock({ planData: { plan: 'trial' } });

    const result = await publishDraft(
      makeFormData({ draft_id: VALID_UUID, publish_target: 'download' }),
    );
    expect(result).toEqual({
      success: false,
      error: 'Upgrade to Growth to publish content drafts',
    });
  });

  it('blocks publishing unapproved draft', async () => {
    mockGetSafeAuthContext.mockResolvedValue(AUTH_CTX);
    supabaseRef.current = makeSupabaseMock({
      planData: { plan: 'growth' },
      draftData: {
        id: VALID_UUID,
        status: 'draft',
        human_approved: false,
        draft_content: 'content',
        draft_title: 'title',
        location_id: null,
        target_prompt: null,
      },
    });

    const result = await publishDraft(
      makeFormData({ draft_id: VALID_UUID, publish_target: 'download' }),
    );
    expect(result).toEqual({
      success: false,
      error: 'Draft must be approved before publishing',
    });
  });

  it('blocks publishing when human_approved is false', async () => {
    mockGetSafeAuthContext.mockResolvedValue(AUTH_CTX);
    supabaseRef.current = makeSupabaseMock({
      planData: { plan: 'growth' },
      draftData: {
        id: VALID_UUID,
        status: 'approved',
        human_approved: false,
        draft_content: 'content',
        draft_title: 'title',
        location_id: null,
        target_prompt: null,
      },
    });

    const result = await publishDraft(
      makeFormData({ draft_id: VALID_UUID, publish_target: 'download' }),
    );
    expect(result).toEqual({
      success: false,
      error: 'Draft must be approved before publishing',
    });
  });
});
