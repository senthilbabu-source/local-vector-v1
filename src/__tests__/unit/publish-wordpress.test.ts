// @vitest-environment node
/**
 * WordPress Publisher — Unit Tests (Sprint 94)
 *
 * Baseline state (before Sprint 94 fixes):
 * - DB update after publish: NO — handled by publishDraft() action, not the publisher (correct architecture)
 * - Typed error codes: NO — throws generic Error with descriptive messages
 * - Content-Type header: YES (line 80)
 * - Application Password encoding: YES (lines 70-72), but no external whitespace trimming
 * - URL normalization: Basic string replacement, no URL constructor
 *
 * Gaps fixed in this sprint:
 * - W1: Added URL normalization with new URL() constructor
 * - W3: Added Application Password external whitespace trimming
 * - W4: Added network error handling (fetch throws → specific error message)
 * - W5: Improved error message for missing credentials
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ContentDraftRow } from '@/lib/types/autopilot';
import {
  MOCK_WP_CREDENTIALS,
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
// Helpers
// ---------------------------------------------------------------------------

function mockWPSuccess(postId = 123, link = 'https://charcoalnchill.com/best-hookah-lounge') {
  return {
    ok: true,
    status: 201,
    json: vi.fn().mockResolvedValue({ id: postId, link, status: 'publish' }),
  } as unknown as Response;
}

function mockWPError(status: number) {
  return {
    ok: false,
    status,
    json: vi.fn().mockResolvedValue({ code: 'rest_error', message: 'Error' }),
    text: vi.fn().mockResolvedValue('Error response body'),
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Import under test (after fetch mock setup)
// ---------------------------------------------------------------------------

import {
  publishToWordPress,
  contentToWPBlocks,
  type WordPressConfig,
} from '@/lib/autopilot/publish-wordpress';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('publishToWordPress', () => {
  it('calls WP REST API POST /wp-json/wp/v2/pages', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockWPSuccess());

    await publishToWordPress(MOCK_CONTENT_DRAFT_WP, MOCK_WP_CREDENTIALS);

    expect(globalThis.fetch).toHaveBeenCalledOnce();
    const [url, options] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(url).toBe('https://charcoalnchill.com/wp-json/wp/v2/pages');
    expect((options as RequestInit).method).toBe('POST');
  });

  it('sends correct Authorization: Basic header (base64 username:password)', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockWPSuccess());

    await publishToWordPress(MOCK_CONTENT_DRAFT_WP, MOCK_WP_CREDENTIALS);

    const [, options] = vi.mocked(globalThis.fetch).mock.calls[0];
    const headers = (options as RequestInit).headers as Record<string, string>;
    const expected = Buffer.from('admin:AbCd EfGh IjKl MnOp QrSt').toString('base64');
    expect(headers.Authorization).toBe(`Basic ${expected}`);
  });

  it('sends Content-Type: application/json header', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockWPSuccess());

    await publishToWordPress(MOCK_CONTENT_DRAFT_WP, MOCK_WP_CREDENTIALS);

    const [, options] = vi.mocked(globalThis.fetch).mock.calls[0];
    const headers = (options as RequestInit).headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('sends draft title and content in request body', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockWPSuccess());

    await publishToWordPress(MOCK_CONTENT_DRAFT_WP, MOCK_WP_CREDENTIALS);

    const [, options] = vi.mocked(globalThis.fetch).mock.calls[0];
    const body = JSON.parse((options as RequestInit).body as string);
    expect(body.title).toBe(MOCK_CONTENT_DRAFT_WP.draft_title);
    expect(body.content).toContain('<!-- wp:paragraph -->');
    expect(body.content).toContain('best hookah experience');
  });

  it('sends status: "draft" in request body (second WP approval layer)', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockWPSuccess());

    await publishToWordPress(MOCK_CONTENT_DRAFT_WP, MOCK_WP_CREDENTIALS);

    const [, options] = vi.mocked(globalThis.fetch).mock.calls[0];
    const body = JSON.parse((options as RequestInit).body as string);
    expect(body.status).toBe('draft');
  });

  it('returns { publishedUrl, status: "published" } on HTTP 201 success', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockWPSuccess(42, 'https://charcoalnchill.com/my-post'));

    const result = await publishToWordPress(MOCK_CONTENT_DRAFT_WP, MOCK_WP_CREDENTIALS);

    expect(result.status).toBe('published');
    expect(result.publishedUrl).toBe('https://charcoalnchill.com/my-post');
  });

  it('throws with auth failure message on HTTP 401', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockWPError(401));

    await expect(
      publishToWordPress(MOCK_CONTENT_DRAFT_WP, MOCK_WP_CREDENTIALS),
    ).rejects.toThrow('authentication failed');
  });

  it('throws with status code on HTTP 500', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockWPError(500));

    await expect(
      publishToWordPress(MOCK_CONTENT_DRAFT_WP, MOCK_WP_CREDENTIALS),
    ).rejects.toThrow('WordPress publish failed (500)');
  });

  it('throws with "site unreachable" on network error (fetch throws)', async () => {
    vi.mocked(globalThis.fetch).mockRejectedValueOnce(new TypeError('fetch failed'));

    await expect(
      publishToWordPress(MOCK_CONTENT_DRAFT_WP, MOCK_WP_CREDENTIALS),
    ).rejects.toThrow('site unreachable');
  });

  it('throws with credentials message when config is empty', async () => {
    const emptyConfig: WordPressConfig = { siteUrl: '', username: '', appPassword: '' };

    await expect(
      publishToWordPress(MOCK_CONTENT_DRAFT_WP, emptyConfig),
    ).rejects.toThrow('credentials not configured');
  });

  it('handles Application Password with spaces correctly in Basic auth encoding', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockWPSuccess());

    const spacedConfig: WordPressConfig = {
      siteUrl: 'https://myblog.com',
      username: 'admin',
      appPassword: '  AbCd EfGh IjKl  ', // external whitespace
    };

    await publishToWordPress(MOCK_CONTENT_DRAFT_WP, spacedConfig);

    const [, options] = vi.mocked(globalThis.fetch).mock.calls[0];
    const headers = (options as RequestInit).headers as Record<string, string>;
    // Trim preserves internal spaces but removes external whitespace
    const expected = Buffer.from('admin:AbCd EfGh IjKl').toString('base64');
    expect(headers.Authorization).toBe(`Basic ${expected}`);
  });

  it('publishedUrl in result matches the "link" field from WP API response', async () => {
    const expectedLink = 'https://charcoalnchill.com/custom-slug-here';
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      mockWPSuccess(99, expectedLink),
    );

    const result = await publishToWordPress(MOCK_CONTENT_DRAFT_WP, MOCK_WP_CREDENTIALS);
    expect(result.publishedUrl).toBe(expectedLink);
  });

  it('returns publishedUrl as null when WP response lacks "link" field', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: vi.fn().mockResolvedValue({ id: 1, status: 'publish' }), // no link
    } as unknown as Response);

    const result = await publishToWordPress(MOCK_CONTENT_DRAFT_WP, MOCK_WP_CREDENTIALS);
    expect(result.publishedUrl).toBeNull();
  });

  it('normalizes site URL with trailing slash', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockWPSuccess());

    const trailingSlashConfig: WordPressConfig = {
      siteUrl: 'https://myblog.com/',
      username: 'admin',
      appPassword: 'test-pass',
    };

    await publishToWordPress(MOCK_CONTENT_DRAFT_WP, trailingSlashConfig);

    const [url] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(url).toBe('https://myblog.com/wp-json/wp/v2/pages');
  });
});
