// @vitest-environment node
/**
 * publishDraft Server Action — Unit Tests (Sprint 94)
 *
 * Tests the routing, authorization, plan gating, HITL validation, and error
 * propagation for the three publish targets: download, wordpress, gbp_post.
 *
 * The existing content-drafts-actions.test.ts covers approveDraft, rejectDraft,
 * createManualDraft, archiveDraft, editDraft, and basic publishDraft auth/plan
 * checks. This file focuses on the WordPress and GBP publish paths and
 * credential/connection validation.
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

vi.mock('@/lib/autopilot/score-content', () => ({
  scoreContentHeuristic: vi.fn(() => 72),
}));

const mockPublishAsDownload = vi.fn().mockResolvedValue({
  publishedUrl: null, status: 'published', downloadPayload: 'PGh0bWw+',
});
vi.mock('@/lib/autopilot/publish-download', () => ({
  publishAsDownload: (...args: Parameters<typeof import('@/lib/autopilot/publish-download').publishAsDownload>) =>
    mockPublishAsDownload(...args),
}));

const mockPublishToGBP = vi.fn().mockResolvedValue({
  publishedUrl: 'https://gbp.google.com/post/123', status: 'published',
});
vi.mock('@/lib/autopilot/publish-gbp', () => ({
  publishToGBP: (...args: Parameters<typeof import('@/lib/autopilot/publish-gbp').publishToGBP>) =>
    mockPublishToGBP(...args),
}));

const mockPublishToWordPress = vi.fn().mockResolvedValue({
  publishedUrl: 'https://myblog.com/my-post', status: 'published',
});
vi.mock('@/lib/autopilot/publish-wordpress', () => ({
  publishToWordPress: (...args: Parameters<typeof import('@/lib/autopilot/publish-wordpress').publishToWordPress>) =>
    mockPublishToWordPress(...args),
}));

vi.mock('@/lib/autopilot/post-publish', () => ({
  schedulePostPublishRecheck: vi.fn(() => Promise.resolve()),
}));

// ---------------------------------------------------------------------------
// Chainable Supabase mock — supports multiple tables
// ---------------------------------------------------------------------------

interface MockOpts {
  planData?: { plan: string } | null;
  draftData?: Record<string, unknown> | null;
  integrationData?: Record<string, unknown> | null;
  updateError?: { message: string } | null;
}

function makeSupabaseMock(opts: MockOpts = {}) {
  const planData = opts.planData ?? { plan: 'growth' };
  const draftData = opts.draftData ?? null;
  const integrationData = opts.integrationData ?? null;
  const updateError = opts.updateError ?? null;

  // Update chain: from('content_drafts').update({}).eq().eq()
  const updateSecondEq = vi.fn().mockResolvedValue({ error: updateError });
  const updateFirstEq = vi.fn().mockReturnValue({ eq: updateSecondEq });
  const update = vi.fn().mockReturnValue({ eq: updateFirstEq });

  // Insert chain
  const insert = vi.fn().mockResolvedValue({ error: null });

  // Select chain for plan: from('organizations').select('plan').eq().single()
  const planSingle = vi.fn().mockResolvedValue({ data: planData });
  const planSelectEq = vi.fn().mockReturnValue({ single: planSingle });
  const planSelect = vi.fn().mockReturnValue({ eq: planSelectEq });

  // Select chain for draft: from('content_drafts').select('*').eq().eq().single()
  const draftSingle = vi.fn().mockResolvedValue({ data: draftData });
  const draftSecondEq = vi.fn().mockReturnValue({ single: draftSingle });
  const draftFirstEq = vi.fn().mockReturnValue({ eq: draftSecondEq });
  const draftSelect = vi.fn().mockReturnValue({ eq: draftFirstEq });

  // Select chain for location: from('locations').select(...).eq().single()
  const locationSingle = vi.fn().mockResolvedValue({
    data: {
      business_name: 'Charcoal N Chill',
      city: 'Alpharetta',
      state: 'GA',
      categories: null,
      amenities: null,
      phone: null,
      website_url: null,
      address_line1: null,
      google_location_name: 'accounts/123/locations/456',
    },
  });
  const locationSelectEq = vi.fn().mockReturnValue({ single: locationSingle });
  const locationSelect = vi.fn().mockReturnValue({ eq: locationSelectEq });

  // Select chain for integration: from('location_integrations').select(...).eq().eq().single()
  const integrationSingle = vi.fn().mockResolvedValue({ data: integrationData });
  const integrationSecondEq = vi.fn().mockReturnValue({ single: integrationSingle });
  const integrationFirstEq = vi.fn().mockReturnValue({ eq: integrationSecondEq });
  const integrationSelect = vi.fn().mockReturnValue({ eq: integrationFirstEq });

  const from = vi.fn().mockImplementation((table: string) => {
    switch (table) {
      case 'organizations':
        return { select: planSelect };
      case 'content_drafts':
        return { update, insert, select: draftSelect };
      case 'locations':
        return { select: locationSelect };
      case 'location_integrations':
        return { select: integrationSelect };
      default:
        return { select: vi.fn() };
    }
  });

  return { from, update };
}

const supabaseRef: { current: ReturnType<typeof makeSupabaseMock> } = { current: null! };

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => Promise.resolve(supabaseRef.current),
  createServiceRoleClient: () => supabaseRef.current,
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { publishDraft } from '@/app/dashboard/content-drafts/actions';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFormData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) fd.set(key, value);
  return fd;
}

const VALID_UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const AUTH_CTX = { orgId: 'org-001', email: 'test@test.com', fullName: 'Test User' };

const APPROVED_DRAFT = {
  id: VALID_UUID,
  org_id: 'org-001',
  location_id: 'loc-001',
  status: 'approved',
  human_approved: true,
  draft_content: 'Test content for publishing.',
  draft_title: 'Test Draft Title',
  target_prompt: 'test query',
  content_type: 'blog_post',
};

const WP_INTEGRATION = {
  listing_url: 'https://myblog.com',
  wp_username: 'admin',
  wp_app_password: 'AbCd EfGh IjKl',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('publishDraft — WordPress target', () => {
  beforeEach(() => {
    mockGetSafeAuthContext.mockReset();
    mockPublishToWordPress.mockClear();
    mockPublishToGBP.mockClear();
  });

  it('returns error when org has no WP credentials', async () => {
    mockGetSafeAuthContext.mockResolvedValue(AUTH_CTX);
    supabaseRef.current = makeSupabaseMock({
      draftData: APPROVED_DRAFT,
      integrationData: null, // no WP credentials
    });

    const result = await publishDraft(
      makeFormData({ draft_id: VALID_UUID, publish_target: 'wordpress' }),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('WordPress not connected');
    }
  });

  it('returns error when draft has no location_id', async () => {
    mockGetSafeAuthContext.mockResolvedValue(AUTH_CTX);
    supabaseRef.current = makeSupabaseMock({
      draftData: { ...APPROVED_DRAFT, location_id: null },
      integrationData: WP_INTEGRATION,
    });

    const result = await publishDraft(
      makeFormData({ draft_id: VALID_UUID, publish_target: 'wordpress' }),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('no associated location');
    }
  });

  it('calls publishToWordPress with correct draft and credentials', async () => {
    mockGetSafeAuthContext.mockResolvedValue(AUTH_CTX);
    supabaseRef.current = makeSupabaseMock({
      draftData: APPROVED_DRAFT,
      integrationData: WP_INTEGRATION,
    });

    await publishDraft(makeFormData({ draft_id: VALID_UUID, publish_target: 'wordpress' }));

    expect(mockPublishToWordPress).toHaveBeenCalledOnce();
    const call = mockPublishToWordPress.mock.calls[0] as unknown[];
    const draft = call[0] as Record<string, unknown>;
    const config = call[1] as Record<string, unknown>;
    expect(draft.id).toBe(VALID_UUID);
    expect(config.siteUrl).toBe('https://myblog.com');
    expect(config.username).toBe('admin');
  });

  it('returns { success: true, publishedUrl } on WordPress success', async () => {
    mockGetSafeAuthContext.mockResolvedValue(AUTH_CTX);
    supabaseRef.current = makeSupabaseMock({
      draftData: APPROVED_DRAFT,
      integrationData: WP_INTEGRATION,
    });

    const result = await publishDraft(
      makeFormData({ draft_id: VALID_UUID, publish_target: 'wordpress' }),
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.publishedUrl).toBe('https://myblog.com/my-post');
    }
  });

  it('returns { success: false, error } when publishToWordPress throws', async () => {
    mockGetSafeAuthContext.mockResolvedValue(AUTH_CTX);
    mockPublishToWordPress.mockRejectedValueOnce(
      new Error('WordPress authentication failed. Check your Application Password.'),
    );
    supabaseRef.current = makeSupabaseMock({
      draftData: APPROVED_DRAFT,
      integrationData: WP_INTEGRATION,
    });

    const result = await publishDraft(
      makeFormData({ draft_id: VALID_UUID, publish_target: 'wordpress' }),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('authentication failed');
    }
  });

  it('returns error when draftId does not exist', async () => {
    mockGetSafeAuthContext.mockResolvedValue(AUTH_CTX);
    supabaseRef.current = makeSupabaseMock({
      draftData: null, // draft not found
    });

    const result = await publishDraft(
      makeFormData({ draft_id: VALID_UUID, publish_target: 'wordpress' }),
    );

    expect(result).toEqual({ success: false, error: 'Draft not found' });
  });
});

describe('publishDraft — GBP Post target', () => {
  beforeEach(() => {
    mockGetSafeAuthContext.mockReset();
    mockPublishToWordPress.mockClear();
    mockPublishToGBP.mockClear();
  });

  it('calls publishToGBP with correct draft and orgId', async () => {
    mockGetSafeAuthContext.mockResolvedValue(AUTH_CTX);
    supabaseRef.current = makeSupabaseMock({
      draftData: { ...APPROVED_DRAFT, content_type: 'gbp_post' },
    });

    await publishDraft(makeFormData({ draft_id: VALID_UUID, publish_target: 'gbp_post' }));

    expect(mockPublishToGBP).toHaveBeenCalledOnce();
    const gbpCall = mockPublishToGBP.mock.calls[0] as unknown[];
    const gbpDraft = gbpCall[0] as Record<string, unknown>;
    expect(gbpDraft.id).toBe(VALID_UUID);
    expect(gbpCall[1]).toBe('org-001');
  });

  it('returns { success: true, publishedUrl } on GBP success', async () => {
    mockGetSafeAuthContext.mockResolvedValue(AUTH_CTX);
    supabaseRef.current = makeSupabaseMock({
      draftData: { ...APPROVED_DRAFT, content_type: 'gbp_post' },
    });

    const result = await publishDraft(
      makeFormData({ draft_id: VALID_UUID, publish_target: 'gbp_post' }),
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.publishedUrl).toBe('https://gbp.google.com/post/123');
    }
  });

  it('returns { success: false, error } when publishToGBP throws', async () => {
    mockGetSafeAuthContext.mockResolvedValue(AUTH_CTX);
    mockPublishToGBP.mockRejectedValueOnce(
      new Error('GBP not connected. Go to Settings → Integrations.'),
    );
    supabaseRef.current = makeSupabaseMock({
      draftData: { ...APPROVED_DRAFT, content_type: 'gbp_post' },
    });

    const result = await publishDraft(
      makeFormData({ draft_id: VALID_UUID, publish_target: 'gbp_post' }),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('GBP not connected');
    }
  });
});

describe('publishDraft — authorization', () => {
  beforeEach(() => {
    mockGetSafeAuthContext.mockReset();
    mockPublishToWordPress.mockClear();
    mockPublishToGBP.mockClear();
  });

  it('returns { success: false } when user is not authenticated', async () => {
    mockGetSafeAuthContext.mockResolvedValue(null);

    const result = await publishDraft(
      makeFormData({ draft_id: VALID_UUID, publish_target: 'wordpress' }),
    );

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('blocks publishing unapproved draft (HITL validation)', async () => {
    mockGetSafeAuthContext.mockResolvedValue(AUTH_CTX);
    supabaseRef.current = makeSupabaseMock({
      draftData: { ...APPROVED_DRAFT, status: 'draft', human_approved: false },
    });

    const result = await publishDraft(
      makeFormData({ draft_id: VALID_UUID, publish_target: 'gbp_post' }),
    );

    expect(result).toEqual({
      success: false,
      error: 'Draft must be approved before publishing',
    });
  });

  it('returns error for invalid publish_target', async () => {
    mockGetSafeAuthContext.mockResolvedValue(AUTH_CTX);
    supabaseRef.current = makeSupabaseMock({ draftData: APPROVED_DRAFT });

    const result = await publishDraft(
      makeFormData({ draft_id: VALID_UUID, publish_target: 'invalid_target' }),
    );

    expect(result.success).toBe(false);
  });
});
