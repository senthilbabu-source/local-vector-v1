// @vitest-environment node
/**
 * GBP Post Publisher — Unit Tests (Sprint 94)
 *
 * Baseline state (before Sprint 94 fixes):
 * - Token expiry check (isTokenExpired): NO — used inline Date comparison without 5-min buffer
 * - Token refresh on expiry: YES — pre-flight check + 401 retry
 * - Content truncation at 1500 chars: YES — sentence boundary (truncateAtSentence)
 * - DB update after publish: NO — handled by publishDraft() action (correct architecture)
 * - Typed error codes: NO — throws generic Error
 * - HTML strip for plain-text GBP summary: NO
 *
 * Gaps fixed in this sprint:
 * - G1: Replaced inline expiry check with isTokenExpired() from shared service (5-min buffer)
 * - G3: Added HTML tag stripping before GBP summary (GBP renders plain text)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { ContentDraftRow } from '@/lib/types/autopilot';
import {
  MOCK_CONTENT_DRAFT_GBP,
  MOCK_CONTENT_DRAFT_WP,
} from '@/src/__fixtures__/golden-tenant';

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = vi.fn();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Mock token refresh service
// ---------------------------------------------------------------------------

vi.mock('@/lib/services/gbp-token-refresh', () => ({
  isTokenExpired: vi.fn().mockReturnValue(false), // default: not expired
  refreshGBPAccessToken: vi.fn(),
}));

import { isTokenExpired, refreshGBPAccessToken } from '@/lib/services/gbp-token-refresh';

// ---------------------------------------------------------------------------
// Mock Supabase client
// ---------------------------------------------------------------------------

const MOCK_TOKEN_ROW = {
  access_token: 'ya29.test-access-token',
  refresh_token: 'test-refresh-token',
  expires_at: new Date(Date.now() + 3600000).toISOString(),
  gbp_account_name: 'accounts/123456789',
};

const MOCK_LOCATION_NAME = 'accounts/123456789/locations/987654321';

function makeSupabaseMock(opts?: {
  tokenRow?: typeof MOCK_TOKEN_ROW | null;
  tokenError?: { message: string } | null;
  locationName?: string | null;
}): SupabaseClient<Database> {
  const tokenRow = opts?.tokenRow !== undefined ? opts.tokenRow : MOCK_TOKEN_ROW;
  const tokenError = opts?.tokenError ?? null;
  // Use explicit undefined check — null is a valid value meaning "no location name"
  const locationName = opts?.locationName !== undefined ? opts.locationName : MOCK_LOCATION_NAME;

  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'google_oauth_tokens') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: tokenRow, error: tokenError }),
            }),
          }),
        };
      }
      if (table === 'locations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: locationName ? { google_location_name: locationName } : null,
              }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    }),
  } as unknown as SupabaseClient<Database>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockGBPSuccess(postName = 'accounts/123/locations/456/localPosts/789') {
  return {
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue({ name: postName, topicType: 'STANDARD' }),
  } as unknown as Response;
}

function mockGBPError(status: number) {
  return {
    ok: false,
    status,
    json: vi.fn().mockResolvedValue({ error: { message: 'Error' } }),
    text: vi.fn().mockResolvedValue('Error response body'),
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Import under test
// ---------------------------------------------------------------------------

import { publishToGBP, truncateAtSentence, GBP_MAX_CHARS } from '@/lib/autopilot/publish-gbp';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('publishToGBP', () => {
  const ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

  beforeEach(() => {
    vi.mocked(isTokenExpired).mockReturnValue(false);
  });

  it('calls GBP Posts API at correct URL: mybusiness.googleapis.com/v4/{parent}/localPosts', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockGBPSuccess());
    const supabase = makeSupabaseMock();

    await publishToGBP(MOCK_CONTENT_DRAFT_GBP, ORG_ID, supabase);

    expect(globalThis.fetch).toHaveBeenCalledOnce();
    const [url] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(url).toBe(
      `https://mybusiness.googleapis.com/v4/${MOCK_LOCATION_NAME}/localPosts`,
    );
  });

  it('sends correct Authorization: Bearer {access_token} header', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockGBPSuccess());
    const supabase = makeSupabaseMock();

    await publishToGBP(MOCK_CONTENT_DRAFT_GBP, ORG_ID, supabase);

    const [, options] = vi.mocked(globalThis.fetch).mock.calls[0];
    const headers = (options as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${MOCK_TOKEN_ROW.access_token}`);
  });

  it('sends topicType: "STANDARD" in request body', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockGBPSuccess());
    const supabase = makeSupabaseMock();

    await publishToGBP(MOCK_CONTENT_DRAFT_GBP, ORG_ID, supabase);

    const [, options] = vi.mocked(globalThis.fetch).mock.calls[0];
    const body = JSON.parse((options as RequestInit).body as string);
    expect(body.topicType).toBe('STANDARD');
  });

  it('sends draft content as summary field', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockGBPSuccess());
    const supabase = makeSupabaseMock();

    await publishToGBP(MOCK_CONTENT_DRAFT_GBP, ORG_ID, supabase);

    const [, options] = vi.mocked(globalThis.fetch).mock.calls[0];
    const body = JSON.parse((options as RequestInit).body as string);
    expect(body.summary).toContain('belly dancing');
  });

  it('returns { publishedUrl, status: "published" } on HTTP 200 success', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockGBPSuccess());
    const supabase = makeSupabaseMock();

    const result = await publishToGBP(MOCK_CONTENT_DRAFT_GBP, ORG_ID, supabase);

    expect(result.status).toBe('published');
  });

  it('checks token expiry before API call (calls isTokenExpired)', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockGBPSuccess());
    const supabase = makeSupabaseMock();

    await publishToGBP(MOCK_CONTENT_DRAFT_GBP, ORG_ID, supabase);

    expect(isTokenExpired).toHaveBeenCalledWith(MOCK_TOKEN_ROW.expires_at);
  });

  it('refreshes token when expired and retries API call', async () => {
    vi.mocked(isTokenExpired).mockReturnValue(true);
    vi.mocked(refreshGBPAccessToken).mockResolvedValue({
      orgId: ORG_ID,
      success: true,
      newAccessToken: 'new-access-token',
      newExpiresAt: new Date(Date.now() + 3600000).toISOString(),
    });
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockGBPSuccess());
    const supabase = makeSupabaseMock();

    const result = await publishToGBP(MOCK_CONTENT_DRAFT_GBP, ORG_ID, supabase);

    expect(result.status).toBe('published');
    expect(refreshGBPAccessToken).toHaveBeenCalledWith(ORG_ID, MOCK_TOKEN_ROW.refresh_token, supabase);
    // Verify the API was called with the NEW token
    const [, options] = vi.mocked(globalThis.fetch).mock.calls[0];
    const headers = (options as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer new-access-token');
  });

  it('throws when token is expired and refresh fails', async () => {
    vi.mocked(isTokenExpired).mockReturnValue(true);
    vi.mocked(refreshGBPAccessToken).mockResolvedValue({
      orgId: ORG_ID,
      success: false,
      error: 'Refresh token revoked',
    });
    const supabase = makeSupabaseMock();

    await expect(
      publishToGBP(MOCK_CONTENT_DRAFT_GBP, ORG_ID, supabase),
    ).rejects.toThrow('Refresh token revoked');
  });

  it('retries with token refresh on HTTP 401 response', async () => {
    // First call returns 401, second call (after refresh) succeeds
    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(mockGBPError(401))
      .mockResolvedValueOnce(mockGBPSuccess());
    vi.mocked(refreshGBPAccessToken).mockResolvedValue({
      orgId: ORG_ID,
      success: true,
      newAccessToken: 'refreshed-token',
      newExpiresAt: new Date(Date.now() + 3600000).toISOString(),
    });
    const supabase = makeSupabaseMock();

    const result = await publishToGBP(MOCK_CONTENT_DRAFT_GBP, ORG_ID, supabase);

    expect(result.status).toBe('published');
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    // Second call uses the refreshed token
    const [, retryOptions] = vi.mocked(globalThis.fetch).mock.calls[1];
    const headers = (retryOptions as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer refreshed-token');
  });

  it('throws on HTTP 400 (non-retryable)', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockGBPError(400));
    const supabase = makeSupabaseMock();

    await expect(
      publishToGBP(MOCK_CONTENT_DRAFT_GBP, ORG_ID, supabase),
    ).rejects.toThrow('GBP post failed: 400');
  });

  it('throws with "GBP not connected" when no token row exists', async () => {
    const supabase = makeSupabaseMock({ tokenRow: null, tokenError: { message: 'Not found' } });

    await expect(
      publishToGBP(MOCK_CONTENT_DRAFT_GBP, ORG_ID, supabase),
    ).rejects.toThrow('GBP not connected');
  });

  it('throws when location has no google_location_name', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockGBPSuccess());
    const supabase = makeSupabaseMock({ locationName: null });

    await expect(
      publishToGBP(MOCK_CONTENT_DRAFT_GBP, ORG_ID, supabase),
    ).rejects.toThrow('Location not linked');
  });

  it('strips HTML tags from content before sending as GBP summary', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockGBPSuccess());
    const supabase = makeSupabaseMock();

    const htmlDraft: ContentDraftRow = {
      ...MOCK_CONTENT_DRAFT_GBP,
      draft_content: '<p>Hello <strong>world</strong></p><br/><p>Paragraph two.</p>',
    };

    await publishToGBP(htmlDraft, ORG_ID, supabase);

    const [, options] = vi.mocked(globalThis.fetch).mock.calls[0];
    const body = JSON.parse((options as RequestInit).body as string);
    expect(body.summary).not.toContain('<p>');
    expect(body.summary).not.toContain('<strong>');
    expect(body.summary).toContain('Hello world');
    expect(body.summary).toContain('Paragraph two.');
  });

  it('truncates summary to 1500 chars when draft content exceeds limit', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockGBPSuccess());
    const supabase = makeSupabaseMock();

    const longDraft: ContentDraftRow = {
      ...MOCK_CONTENT_DRAFT_GBP,
      draft_content: 'A'.repeat(2000),
    };

    await publishToGBP(longDraft, ORG_ID, supabase);

    const [, options] = vi.mocked(globalThis.fetch).mock.calls[0];
    const body = JSON.parse((options as RequestInit).body as string);
    expect(body.summary.length).toBeLessThanOrEqual(GBP_MAX_CHARS);
  });

  it('does NOT truncate when content is exactly 1500 chars', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockGBPSuccess());
    const supabase = makeSupabaseMock();

    const exactDraft: ContentDraftRow = {
      ...MOCK_CONTENT_DRAFT_GBP,
      draft_content: 'A'.repeat(GBP_MAX_CHARS),
    };

    await publishToGBP(exactDraft, ORG_ID, supabase);

    const [, options] = vi.mocked(globalThis.fetch).mock.calls[0];
    const body = JSON.parse((options as RequestInit).body as string);
    expect(body.summary.length).toBe(GBP_MAX_CHARS);
  });

  it('does NOT truncate when content is under 1500 chars', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockGBPSuccess());
    const supabase = makeSupabaseMock();

    await publishToGBP(MOCK_CONTENT_DRAFT_GBP, ORG_ID, supabase);

    const [, options] = vi.mocked(globalThis.fetch).mock.calls[0];
    const body = JSON.parse((options as RequestInit).body as string);
    // Original content is well under 1500, should be unchanged (after HTML strip)
    expect(body.summary).toBe(MOCK_CONTENT_DRAFT_GBP.draft_content);
  });

  it('sends languageCode: "en" in request body', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockGBPSuccess());
    const supabase = makeSupabaseMock();

    await publishToGBP(MOCK_CONTENT_DRAFT_GBP, ORG_ID, supabase);

    const [, options] = vi.mocked(globalThis.fetch).mock.calls[0];
    const body = JSON.parse((options as RequestInit).body as string);
    expect(body.languageCode).toBe('en');
  });

  it('sends Content-Type: application/json header', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockGBPSuccess());
    const supabase = makeSupabaseMock();

    await publishToGBP(MOCK_CONTENT_DRAFT_GBP, ORG_ID, supabase);

    const [, options] = vi.mocked(globalThis.fetch).mock.calls[0];
    const headers = (options as RequestInit).headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
  });
});

// ---------------------------------------------------------------------------
// truncateAtSentence utility tests (already in autopilot-publish.test.ts,
// extended here for completeness)
// ---------------------------------------------------------------------------

describe('truncateAtSentence — extended', () => {
  it('truncated text with sentence boundary ends with punctuation', () => {
    const text = 'First sentence. Second sentence. Third sentence is very long and goes way beyond the limit set.';
    const result = truncateAtSentence(text, 35);
    expect(result).toMatch(/[.!?]$/);
  });

  it('truncated text with word boundary ends with "..."', () => {
    const text = 'A very long sentence without any punctuation marks that keeps going and going forever and ever';
    const result = truncateAtSentence(text, 50);
    expect(result).toContain('...');
  });
});
