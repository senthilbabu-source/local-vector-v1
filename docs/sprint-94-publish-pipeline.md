# Sprint 94 — Publish Pipeline Verification (WordPress + GBP Post)

> **Claude Code Prompt — Bulletproof First-Pass Edition**
> Paste this entire prompt into VS Code Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `MEMORY.md`, `prod_schema.sql`,
> `golden-tenant.ts`, `database.types.ts`, `docs/19-AUTOPILOT-ENGINE.md`

---

## ⚠️ NATURE OF THIS SPRINT — READ BEFORE ANYTHING ELSE

**Sprint 94 is a verification + fix sprint.** The WordPress and GBP Post publishers already exist as code files (`publish-wordpress.ts`, `publish-gbp.ts`) and are wired into `publishDraft()`. They have **never been tested end-to-end** — the build plan checkboxes are unchecked and there are zero tests covering them.

**Your job, in order:**

1. **Read** every relevant existing file before touching anything
2. **Diagnose** what's actually in the publisher files vs what the spec requires
3. **Write tests** (mocked WP REST API + GBP Posts API) — tests will expose any gaps
4. **Fix** whatever the tests reveal is broken or missing
5. **Verify** the full detect → draft → publish loop works UI-to-database

**Do not rewrite the publishers from scratch.** Fix what's broken. If a publisher is 95% correct and just missing token refresh or a DB update, fix that gap — don't start over.

**Gaps being closed:** Feature #54 (WordPress Publish) 70% → 100%, Feature #55 (GBP Post Publish) 70% → 100%.

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

This is a "read the codebase" sprint. Do NOT skip any of these.

```
Read docs/AI_RULES.md                                      — All engineering rules
Read CLAUDE.md                                             — Full implementation inventory
Read MEMORY.md                                             — Architectural decisions
Read docs/19-AUTOPILOT-ENGINE.md                           — Canonical publish pipeline spec
                                                             THIS IS THE SPEC. Understand it fully.

# The two publisher files — read every line:
Read lib/publishers/publish-wordpress.ts                   — WP REST API publisher
                                                             (search if path differs: grep -rn "publishToWordPress\|publish-wordpress" lib/ app/)
Read lib/publishers/publish-gbp.ts                         — GBP Local Posts publisher
                                                             (search if path differs: grep -rn "publishToGBP\|publish-gbp" lib/ app/)

# The action that calls both publishers:
Read app/actions/publish-draft.ts                          — publishDraft() action
                                                             (search: grep -rn "publishDraft" app/actions/)

# The content draft data model:
Read supabase/prod_schema.sql                              — content_drafts table: all columns
                                                             Find: status, published_at, published_url, target (wordpress/gbp_post/download), draft_content, org_id
Read lib/supabase/database.types.ts                        — content_drafts TypeScript types
Read src/__fixtures__/golden-tenant.ts                     — Find existing content_draft fixtures

# WordPress credential management (already built):
Read app/dashboard/settings/                               — WordPress credential management UI
                                                             (grep -rn "wordpress\|WordPressCredential" app/dashboard/settings/)
Read lib/data/                                             — Find WordPress credential fetcher
                                                             (grep -rn "wordpress_credentials\|wp_credentials" lib/ supabase/)

# GBP token management (Sprint 89/90):
Read app/actions/gbp-import.ts                             — triggerGBPImport pattern
Read lib/gbp/gbp-token-refresh.ts                          — isTokenExpired() + refreshGBPToken()
Read supabase/prod_schema.sql                              — gbp_connections table: access_token, refresh_token, expires_at, gbp_location_id

# Content draft UI — understand the publish flow:
Read app/dashboard/content-drafts/                         — The draft list + detail pages
                                                             Find the "Publish" button and what it currently calls

# Existing tests (if any):
Read src/__tests__/unit/                                   — grep for any existing publisher tests
                                                             grep -rn "publish-wordpress\|publish-gbp\|publishDraft" src/__tests__/
```

**After reading, document your findings on these specific questions before writing a single test:**

1. What does `publish-wordpress.ts` actually do? Does it call the WP REST API? Does it update the DB after publish? Does it handle auth failure?
2. What does `publish-gbp.ts` actually do? Does it call `isTokenExpired()` from Sprint 90? Does it truncate content to 1500 chars? Does it update the DB after publish?
3. What does `publishDraft()` return? What error codes does it define?
4. What columns does `content_drafts` have? Specifically: `status`, `published_at`, `published_url`, `publish_target`?
5. Are there existing tests for either publisher? If yes, do they pass?

Write the answers as comments at the top of each new test file so future readers understand the baseline state.

---

## 🏗️ Architecture Overview — The Publish Pipeline

Before writing tests, understand the full pipeline:

```
User clicks "Publish" on a content draft
     ↓
publishDraft(draftId, target: 'wordpress' | 'gbp_post')  [Server Action]
     ↓
Fetches: draft content + org credentials/tokens
     ↓
Routes to publisher:
  'wordpress'  → publishToWordPress(draft, wpCredentials)
  'gbp_post'   → publishToGBP(draft, gbpConnection)
     ↓
Publisher calls external API (mocked in tests)
     ↓
On success: UPDATE content_drafts SET status='published', published_at=NOW(), published_url=...
     ↓
Returns: { ok, publishedUrl, error_code? }
     ↓
UI shows: success banner with link to published post  OR  error message
```

**Two external APIs in play — they are completely different:**

### WordPress REST API
```
POST https://{site_url}/wp-json/wp/v2/posts
Authorization: Basic {base64(username + ':' + application_password)}
Content-Type: application/json

Body: {
  "title": "Draft title",
  "content": "<p>Draft HTML content</p>",
  "status": "publish",
  "categories": [],
  "tags": []
}

Success: HTTP 201 → { id: 12345, link: "https://myblog.com/post-slug", status: "publish" }
Auth failure: HTTP 401
Not found: HTTP 404
Server error: HTTP 500
```

### GBP Local Posts API
```
POST https://mybusiness.googleapis.com/v4/{parent}/localPosts
  where {parent} = "accounts/{account_id}/locations/{location_id}"
Authorization: Bearer {access_token}
Content-Type: application/json

Body: {
  "topicType": "STANDARD",
  "summary": "Post text — MAX 1500 characters",
  "callToAction": {           ← optional
    "actionType": "LEARN_MORE",
    "url": "https://..."
  }
}

Success: HTTP 200 → { name: "accounts/.../localPosts/...", topicType: "STANDARD", ... }
Auth failure: HTTP 401
Quota exceeded: HTTP 429
Invalid content: HTTP 400
```

**IMPORTANT DISTINCTION:**
- Sprint 89 used `mybusinessbusinessinformation.googleapis.com/v1/` — that's the Business Information API for reading location data
- Sprint 94 uses `mybusiness.googleapis.com/v4/` — that's the My Business API for creating posts
- **These are different APIs with different base URLs.** Do not confuse them.

---

## 🔬 Phase 1: Diagnosis — What to Look For

When reading the existing publisher files, check for these specific gaps that commonly exist in 70%-complete implementations:

### WordPress Publisher Gaps to Check

**Gap W1 — Missing DB update after publish:**
Does the function UPDATE `content_drafts` with `status = 'published'`, `published_at`, and `published_url` after a successful WP API call? This is the most common missing piece. If `publishDraft()` handles the DB update (not the publisher itself), verify that path too.

**Gap W2 — Raw body vs JSON:**
Does the WP API call use `JSON.stringify()` for the body and set `Content-Type: application/json`? WP REST API returns 400 if content type is missing.

**Gap W3 — Application Password format:**
WP Application Passwords have spaces in them (e.g., `AbCd EfGh IjKl MnOp QrSt`). The Basic auth must handle this correctly: `base64(username + ':' + password)` where `password` includes the spaces (or WP strips them — verify).

**Gap W4 — Error codes not surfaced:**
Does the publisher return a typed `error_code` (`'auth_failed'`, `'network_error'`, `'api_error'`, `'no_credentials'`) or just a raw error string? The UI needs typed codes to show the right message.

**Gap W5 — Draft content format:**
Does the publisher send the draft content as HTML, markdown, or plain text? WP REST API accepts HTML in the `content` field. Verify the draft content is not being double-escaped.

### GBP Post Publisher Gaps to Check

**Gap G1 — Token expiry check missing:**
Does `publish-gbp.ts` call `isTokenExpired()` from `lib/gbp/gbp-token-refresh.ts` (Sprint 90) before making the API call? If it uses the token directly without checking expiry, a user whose token expired since onboarding will get a silent 401.

**Gap G2 — Token refresh flow:**
If the token is expired, does it call `refreshGBPToken()` and retry? Or does it just return an error?

**Gap G3 — Content truncation:**
GBP STANDARD posts have a hard 1500-character limit on `summary`. Does the publisher truncate or return an error if the draft content exceeds this? The correct behavior: truncate with `…` at character 1497 — never silently cut mid-word if possible.

**Gap G4 — `parent` path construction:**
The GBP Posts API URL requires `accounts/{account_id}/locations/{location_id}`. The `gbp_connections` table stores `gbp_location_id` — is it stored as the full path (`accounts/.../locations/...`) or just the location ID? The publisher needs to construct the right URL.

**Gap G5 — Missing DB update after publish:**
Same as W1 — does the function update `content_drafts` after a successful post?

**Gap G6 — `callToAction` handling:**
Does the publisher include a `callToAction` if the draft has a CTA URL? Or does it always send `topicType: STANDARD` without a CTA? Both are valid — just verify it's intentional.

---

## 🔧 Phase 2: Fix the Gaps You Found

After reading the files and identifying which gaps from Phase 1 exist, fix them.

### Fix Reference: WordPress Publisher

If `publish-wordpress.ts` is missing the DB update, the correct pattern is:

```typescript
// After successful WP API call:
const supabase = createServiceRoleClient();
const { error: updateError } = await supabase
  .from('content_drafts')
  .update({
    status: 'published',
    published_at: new Date().toISOString(),
    published_url: wpPost.link,
  })
  .eq('id', draftId);

if (updateError) {
  // Log but don't fail — the post IS published, just the DB update failed
  console.error('[publish-wordpress] DB update failed:', updateError);
}
```

If Basic auth encoding is wrong:
```typescript
const credentials = Buffer.from(`${username}:${applicationPassword}`).toString('base64');
// Headers: { 'Authorization': `Basic ${credentials}` }
```

If error codes are untyped, add:
```typescript
export type WordPressPublishErrorCode =
  | 'no_credentials'      // No WP credentials stored for this org
  | 'auth_failed'         // 401 from WP — bad username/password
  | 'site_unreachable'    // Network error or non-WP URL
  | 'api_error'           // 4xx/5xx from WP other than 401
  | 'db_update_failed';   // Post published but DB update failed (non-blocking)
```

### Fix Reference: GBP Post Publisher

If token refresh is missing, wire Sprint 90's utility:
```typescript
import { isTokenExpired, refreshGBPToken } from '@/lib/gbp/gbp-token-refresh';

// Before API call:
if (isTokenExpired(connection.expires_at)) {
  const refreshed = await refreshGBPToken(supabase, orgId, connection.refresh_token);
  if (!refreshed.ok) {
    return { ok: false, error_code: 'token_expired', error: refreshed.error };
  }
  connection = { ...connection, access_token: refreshed.access_token };
}
```

If content truncation is missing:
```typescript
const MAX_GBP_SUMMARY_CHARS = 1500;
const summary = draft.content.length > MAX_GBP_SUMMARY_CHARS
  ? draft.content.slice(0, 1497) + '…'
  : draft.content;
```

If `parent` path construction is incorrect, standardize:
```typescript
// gbp_location_id in DB should be the full resource name: "accounts/123/locations/456"
// If it's stored as just "locations/456", prepend the account ID
// Read the actual value in prod_schema.sql and the callback route to determine format
const parent = connection.gbp_location_id; // e.g. "accounts/123456/locations/789012"
const url = `https://mybusiness.googleapis.com/v4/${parent}/localPosts`;
```

If error codes are untyped, add:
```typescript
export type GBPPostPublishErrorCode =
  | 'no_connection'       // No gbp_connections row for this org
  | 'token_expired'       // Token expired and refresh failed
  | 'content_too_long'    // Draft exceeds 1500 chars (only if not auto-truncating)
  | 'gbp_api_error'       // Non-200 from GBP Posts API
  | 'db_update_failed';   // Post published but DB update failed (non-blocking)
```

---

## 🧪 Testing — Write Tests FIRST (AI_RULES §4)

### Test File 1: `src/__tests__/unit/publish-wordpress.test.ts`

**Target: `lib/publishers/publish-wordpress.ts`**

```
/**
 * Baseline state (fill in after reading the file):
 * - DB update after publish: [YES/NO — found on line N]
 * - Typed error codes: [YES/NO]
 * - Content-Type header: [YES/NO]
 * - Application Password encoding: [correct/incorrect]
 * Gaps fixed in this sprint: [list]
 */

describe('publishToWordPress')
  1.  calls WP REST API POST /wp-json/wp/v2/posts
  2.  sends correct Authorization: Basic header (base64 username:password)
  3.  sends Content-Type: application/json header
  4.  sends draft title and content in request body
  5.  sends status: "publish" in request body
  6.  returns { ok: true, postUrl } on HTTP 201 success
  7.  returns { ok: false, error_code: 'auth_failed' } on HTTP 401
  8.  returns { ok: false, error_code: 'api_error' } on HTTP 500
  9.  returns { ok: false, error_code: 'site_unreachable' } on network error (fetch throws)
  10. returns { ok: false, error_code: 'no_credentials' } when wpCredentials is null/undefined
  11. updates content_drafts: status='published', published_at, published_url on success
  12. does NOT throw if DB update fails after successful publish (logs error, returns ok:true)
  13. handles Application Password with spaces correctly in Basic auth encoding
  14. postUrl in result matches the 'link' field from WP API response
```

**14 tests.**

**Mock requirements:**
```typescript
// Mock global fetch for WP API calls
global.fetch = vi.fn();

// Mock Supabase service role client for DB update
vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: vi.fn(),
}));

// Helper: create mock WP success response
function mockWPSuccess(postId = 123, link = 'https://myblog.com/my-post') {
  return {
    ok: true,
    status: 201,
    json: vi.fn().mockResolvedValue({ id: postId, link, status: 'publish' }),
  };
}

// Helper: create mock WP error response
function mockWPError(status: number) {
  return {
    ok: false,
    status,
    json: vi.fn().mockResolvedValue({ code: 'rest_error', message: 'Error' }),
  };
}
```

---

### Test File 2: `src/__tests__/unit/publish-gbp.test.ts`

**Target: `lib/publishers/publish-gbp.ts`**

```
/**
 * Baseline state (fill in after reading the file):
 * - Token expiry check (isTokenExpired): [YES/NO — found on line N]
 * - Token refresh on expiry: [YES/NO]
 * - Content truncation at 1500 chars: [YES/NO]
 * - DB update after publish: [YES/NO]
 * - Typed error codes: [YES/NO]
 * Gaps fixed in this sprint: [list]
 */

describe('publishToGBP')
  1.  calls GBP Posts API at correct URL: mybusiness.googleapis.com/v4/{parent}/localPosts
  2.  sends correct Authorization: Bearer {access_token} header
  3.  sends topicType: "STANDARD" in request body
  4.  sends draft content as summary field
  5.  returns { ok: true, postName } on HTTP 200 success
  6.  checks token expiry before API call (calls isTokenExpired)
  7.  refreshes token when expired and retries API call
  8.  returns { ok: false, error_code: 'token_expired' } when refresh fails
  9.  returns { ok: false, error_code: 'gbp_api_error' } on HTTP 401 (non-refresh path)
  10. returns { ok: false, error_code: 'gbp_api_error' } on HTTP 400
  11. returns { ok: false, error_code: 'no_connection' } when gbpConnection is null
  12. truncates summary to 1500 chars when draft content exceeds limit
  13. truncated summary ends with '…' (ellipsis character)
  14. does NOT truncate when content is exactly 1500 chars
  15. does NOT truncate when content is under 1500 chars
  16. updates content_drafts: status='published', published_at, published_url on success
  17. does NOT throw if DB update fails after successful publish
  18. includes callToAction in body when draft has a cta_url field
  19. omits callToAction when draft has no cta_url
```

**19 tests.**

**Mock requirements:**
```typescript
global.fetch = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: vi.fn(),
}));

vi.mock('@/lib/gbp/gbp-token-refresh', () => ({
  isTokenExpired: vi.fn().mockReturnValue(false),   // default: not expired
  refreshGBPToken: vi.fn(),
}));

// Helper: create mock GBP success response
function mockGBPSuccess(postName = 'accounts/123/locations/456/localPosts/789') {
  return {
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue({ name: postName, topicType: 'STANDARD' }),
  };
}
```

**Token refresh test setup (tests 7–8):**
```typescript
// Test 7: token expired, refresh succeeds, retry succeeds
it('refreshes token when expired and retries API call', async () => {
  vi.mocked(isTokenExpired).mockReturnValue(true);
  vi.mocked(refreshGBPToken).mockResolvedValue({
    ok: true,
    access_token: 'new-access-token',
    expires_at: new Date(Date.now() + 3600000).toISOString(),
  });
  // First fetch call = success with new token
  vi.mocked(global.fetch).mockResolvedValueOnce(mockGBPSuccess() as any);

  const result = await publishToGBP(mockDraft, mockGBPConnection);

  expect(result.ok).toBe(true);
  // Verify the API was called with the NEW token
  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining('mybusiness.googleapis.com'),
    expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: 'Bearer new-access-token',
      }),
    })
  );
});
```

---

### Test File 3: `src/__tests__/unit/publish-draft-action.test.ts`

**Target: `app/actions/publish-draft.ts` (or wherever `publishDraft()` lives)**

```
describe('publishDraft — WordPress target')
  1.  returns { ok: false, error_code: 'no_credentials' } when org has no WP credentials
  2.  fetches WP credentials for the correct org_id (not a different org's credentials)
  3.  calls publishToWordPress with correct draft and credentials
  4.  returns { ok: true, publishedUrl } on success
  5.  returns { ok: false, error_code } when publishToWordPress fails — passes error_code through
  6.  returns { ok: false, error_code: 'not_found' } when draftId doesn't exist
  7.  returns { ok: false, error_code: 'unauthorized' } when draft belongs to different org

describe('publishDraft — GBP Post target')
  8.  returns { ok: false, error_code: 'no_connection' } when org has no GBP connection
  9.  fetches GBP connection for the correct org_id
  10. calls publishToGBP with correct draft and connection
  11. returns { ok: true, publishedUrl } on success
  12. returns { ok: false, error_code } when publishToGBP fails — passes error_code through

describe('publishDraft — authorization')
  13. returns { ok: false } when user is not authenticated
  14. cannot publish a draft belonging to a different org (belt-and-suspenders — AI_RULES §18)
```

**14 tests.**

**Mock requirements:**
```typescript
vi.mock('@/lib/publishers/publish-wordpress', () => ({
  publishToWordPress: vi.fn(),
}));
vi.mock('@/lib/publishers/publish-gbp', () => ({
  publishToGBP: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createServiceRoleClient: vi.fn(),
}));
```

---

### Test File 4 (Playwright E2E): `src/__tests__/e2e/publish-pipeline.spec.ts`

**Target: Full detect → draft → publish loop, UI to database**

```typescript
import { test, expect } from '@playwright/test';

// Mock all external publish APIs — never call real WP or GBP in tests
async function mockWordPressSuccess(page: Page) {
  await page.route('**/wp-json/wp/v2/posts', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 12345,
        link: 'https://myblog.com/test-post',
        status: 'publish',
      }),
    });
  });
}

async function mockGBPPostSuccess(page: Page) {
  await page.route('**/mybusiness.googleapis.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        name: 'accounts/123/locations/456/localPosts/789',
        topicType: 'STANDARD',
      }),
    });
  });
}

describe('Publish Pipeline — WordPress', () => {
  test('content draft list shows Publish button for WordPress target drafts', async ({ page }) => {
    await page.goto('/dashboard/content-drafts');
    // Assert: at least one draft with wordpress target shows a Publish button
    await expect(page.getByTestId('publish-btn-wordpress')).toBeVisible();
  });

  test('clicking Publish on WordPress draft shows confirmation dialog', async ({ page }) => {
    await page.goto('/dashboard/content-drafts');
    await page.getByTestId('publish-btn-wordpress').first().click();
    // Confirmation dialog should appear (not immediate publish)
    await expect(page.getByTestId('publish-confirm-dialog')).toBeVisible();
    await expect(page.getByTestId('publish-confirm-dialog')).toContainText('WordPress');
  });

  test('confirming publish calls WP API and shows success', async ({ page }) => {
    await mockWordPressSuccess(page);
    await page.goto('/dashboard/content-drafts');
    await page.getByTestId('publish-btn-wordpress').first().click();
    await page.getByTestId('publish-confirm-btn').click();
    // Assert: success banner appears
    await expect(page.getByTestId('publish-success-banner')).toBeVisible();
    // Assert: link to published post
    await expect(page.getByTestId('publish-success-banner')).toContainText('myblog.com');
  });

  test('draft status changes to "Published" after successful WP publish', async ({ page }) => {
    await mockWordPressSuccess(page);
    await page.goto('/dashboard/content-drafts');
    await page.getByTestId('publish-btn-wordpress').first().click();
    await page.getByTestId('publish-confirm-btn').click();
    await expect(page.getByTestId('publish-success-banner')).toBeVisible();
    // Reload to verify DB was updated
    await page.reload();
    await expect(page.getByTestId('draft-status-published')).toBeVisible();
  });

  test('WP publish failure shows typed error message', async ({ page }) => {
    // Mock WP API to return 401
    await page.route('**/wp-json/wp/v2/posts', async (route) => {
      await route.fulfill({ status: 401, body: JSON.stringify({ code: 'rest_forbidden' }) });
    });
    await page.goto('/dashboard/content-drafts');
    await page.getByTestId('publish-btn-wordpress').first().click();
    await page.getByTestId('publish-confirm-btn').click();
    // Assert: auth failure message — not a generic "something went wrong"
    await expect(page.getByTestId('publish-error-banner')).toContainText('credentials');
  });
});

describe('Publish Pipeline — GBP Post', () => {
  test('confirming publish calls GBP API and shows success', async ({ page }) => {
    await mockGBPPostSuccess(page);
    await page.goto('/dashboard/content-drafts');
    await page.getByTestId('publish-btn-gbp').first().click();
    await page.getByTestId('publish-confirm-btn').click();
    await expect(page.getByTestId('publish-success-banner')).toBeVisible();
  });

  test('draft status changes to "Published" after successful GBP publish', async ({ page }) => {
    await mockGBPPostSuccess(page);
    await page.goto('/dashboard/content-drafts');
    await page.getByTestId('publish-btn-gbp').first().click();
    await page.getByTestId('publish-confirm-btn').click();
    await expect(page.getByTestId('publish-success-banner')).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('draft-status-published')).toBeVisible();
  });
});
```

**Total Playwright tests: 7**

**Critical rules:**
- `page.route()` intercepts must use `**/wp-json/**` and `**/mybusiness.googleapis.com/**` glob patterns — be careful that the GBP Posts API URL (`mybusiness.googleapis.com`) is different from the GBP Import API (`mybusinessbusinessinformation.googleapis.com`) used in Sprint 89
- Never call real external APIs in Playwright tests
- `data-testid` attributes required on publish flow elements — add them if missing (see Component 1 below)
- Use `page.waitForSelector('[data-testid="publish-success-banner"]')` — never `waitForTimeout`
- Auth: golden tenant user with `onboarding_completed_at` set, with both WP credentials and GBP connection in seed data

---

## 🔧 Component: UI Polish — Add `data-testid` to Publish Flow

The Playwright tests require `data-testid` attributes on the publish flow UI elements. Read `app/dashboard/content-drafts/` carefully. Add these if missing:

| Element | `data-testid` | Location |
|---------|--------------|----------|
| Publish button (WordPress target) | `publish-btn-wordpress` | Draft list or detail page |
| Publish button (GBP post target) | `publish-btn-gbp` | Draft list or detail page |
| Publish confirmation dialog | `publish-confirm-dialog` | Modal/dialog component |
| Confirm publish button in dialog | `publish-confirm-btn` | Modal/dialog component |
| Cancel publish button in dialog | `publish-cancel-btn` | Modal/dialog component |
| Success banner after publish | `publish-success-banner` | Draft list or detail page |
| Error banner after publish | `publish-error-banner` | Draft list or detail page |
| Published draft status indicator | `draft-status-published` | Draft list item |

**If a publish confirmation dialog doesn't exist:** The current flow may publish immediately on button click. **Add a confirmation step** — publishing is an irreversible external action that warrants a "Are you sure?" moment (AI_RULES equivalent: explicit confirmation for irreversible external writes).

The confirmation dialog should show:
- Target platform ("Publish to WordPress" / "Publish as Google Business Post")
- Draft title preview
- Confirm + Cancel buttons

---

## 🌱 Seed Data — `supabase/seed.sql`

The Playwright tests need content draft seed rows with the correct `publish_target` values. Read `supabase/seed.sql` first — if content draft seed rows already exist, verify they have `publish_target` set. If not, add:

```sql
-- ══════════════════════════════════════════════════════════════
-- Sprint 94: Content draft seed rows for publish pipeline testing
-- ══════════════════════════════════════════════════════════════
-- Only add if content_drafts seed rows don't already exist for
-- org a0eebc99 with publish_target set. Check existing seed first.

INSERT INTO public.content_drafts
  (id, org_id, title, draft_content, publish_target, status, created_at)
VALUES
  (
    'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Why Charcoal N Chill is the Best Hookah Lounge in Alpharetta',
    '<p>Looking for the best hookah experience in Alpharetta? Charcoal N Chill offers premium hookah flavors, live entertainment, and an upscale atmosphere perfect for groups.</p>',
    'wordpress',   -- ← adjust column name to match actual schema
    'draft',
    NOW() - INTERVAL '2 days'
  ),
  (
    'f1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Friday Night Live: Belly Dancing & Afrobeats',
    'Join us this Friday for live belly dancing performances and an Afrobeats DJ set. Open until 2 AM. Reservations recommended.',
    'gbp_post',    -- ← adjust column name to match actual schema
    'draft',
    NOW() - INTERVAL '1 day'
  );
```

**IMPORTANT:** Replace column names (`publish_target`, `draft_content`, `title`) with the actual column names from `prod_schema.sql`. Do not guess — read the schema.

Register UUIDs `f0eebc99` and `f1eebc99` in the seed file's UUID reference card (AI_RULES §7).

---

## 📂 Files to Create / Modify

| # | File | Action | Notes |
|---|------|--------|-------|
| 1 | `lib/publishers/publish-wordpress.ts` | **FIX** | Address gaps W1–W5 found in diagnosis |
| 2 | `lib/publishers/publish-gbp.ts` | **FIX** | Address gaps G1–G6 found in diagnosis |
| 3 | `app/actions/publish-draft.ts` | **FIX** (if needed) | Fix any gaps in action routing or error handling |
| 4 | `app/dashboard/content-drafts/` | **MODIFY** | Add `data-testid` attributes to publish flow elements; add confirmation dialog if missing |
| 5 | `supabase/seed.sql` | **MODIFY** | Add content draft seed rows with publish_target (if missing) |
| 6 | `src/__fixtures__/golden-tenant.ts` | **MODIFY** | Add `MOCK_WP_CREDENTIALS`, `MOCK_CONTENT_DRAFT_WP`, `MOCK_CONTENT_DRAFT_GBP` |
| 7 | `src/__tests__/unit/publish-wordpress.test.ts` | **CREATE** | 14 unit tests |
| 8 | `src/__tests__/unit/publish-gbp.test.ts` | **CREATE** | 19 unit tests |
| 9 | `src/__tests__/unit/publish-draft-action.test.ts` | **CREATE** | 14 unit tests |
| 10 | `src/__tests__/e2e/publish-pipeline.spec.ts` | **CREATE** | 7 Playwright tests |

---

## 🚫 What NOT to Do

1. **DO NOT rewrite the publishers from scratch** — fix the gaps you find. The existing code is 70% correct.
2. **DO NOT confuse the two GBP APIs:** Sprint 89 uses `mybusinessbusinessinformation.googleapis.com/v1/` (read location data). Sprint 94 uses `mybusiness.googleapis.com/v4/` (create posts). Different endpoints.
3. **DO NOT call real WordPress or GBP APIs in any test** — mock everything with `vi.fn()` for unit tests and `page.route()` for Playwright.
4. **DO NOT publish immediately without confirmation** — irreversible external writes need a confirmation step in the UI.
5. **DO NOT let a failed DB update (`published_at`, `published_url`) fail the whole publish** — the post IS published externally. Log the DB error, return `ok: true`, and if needed handle reconciliation separately.
6. **DO NOT silently swallow content-too-long errors for GBP** — either auto-truncate (preferred) or return a clear `content_too_long` error. Truncating is better UX.
7. **DO NOT use the same fetch mock URL pattern for GBP Import and GBP Post** — use distinct patterns so tests don't accidentally intercept the wrong API.
8. **DO NOT use `as any` on Supabase clients** (AI_RULES §38.2).
9. **DO NOT use dynamic Tailwind classes** for status badges (AI_RULES §12).
10. **DO NOT edit `middleware.ts`** (AI_RULES §6).
11. **DO NOT add `data-testid` attributes to test-only wrapper `div`s** — add them to semantic elements that are already in the DOM.

---

## ✅ Definition of Done (AI_RULES §13.5)

### Publishers Fixed
- [ ] `publish-wordpress.ts` — all 5 gaps (W1–W5) checked and fixed where present
- [ ] `publish-gbp.ts` — all 6 gaps (G1–G6) checked and fixed where present; Sprint 90's `isTokenExpired()` + `refreshGBPToken()` wired in
- [ ] `publishDraft()` action — typed error codes pass through from both publishers
- [ ] Content draft row updated (`status`, `published_at`, `published_url`) after successful publish for both targets

### UI
- [ ] Publish confirmation dialog exists with target name, draft title, Confirm + Cancel
- [ ] All `data-testid` attributes present on publish flow elements
- [ ] Success banner shows link to published post URL
- [ ] Typed error messages: auth failure says "check your credentials", not "something went wrong"
- [ ] Published drafts show "Published" status badge in draft list

### Seed Data
- [ ] `seed.sql` has at least one draft with `publish_target = 'wordpress'` and one with `publish_target = 'gbp_post'` for golden tenant
- [ ] UUIDs registered in seed reference card

### Tests
- [ ] `npx vitest run src/__tests__/unit/publish-wordpress.test.ts` — **14 tests passing**
- [ ] `npx vitest run src/__tests__/unit/publish-gbp.test.ts` — **19 tests passing**
- [ ] `npx vitest run src/__tests__/unit/publish-draft-action.test.ts` — **14 tests passing**
- [ ] `npx vitest run` — ALL tests passing, zero regressions
- [ ] `npx playwright test src/__tests__/e2e/publish-pipeline.spec.ts` — **7 tests passing**
- [ ] `npx tsc --noEmit` — 0 new type errors

---

## 📓 DEVLOG Entry Format (AI_RULES §13.2)

```markdown
## 2026-02-28 — Sprint 94: Publish Pipeline Verification (WordPress + GBP Post) (Completed)

**Goal:** Verify and fix the WordPress and GBP Post publishers end-to-end.
Both files existed at ~70% but had never been integration tested.
Close the detect → draft → publish loop.

**Diagnosis findings:**
- publish-wordpress.ts:
  - Gap W1 (DB update): [FOUND / not present — fixed by adding UPDATE after successful publish]
  - Gap W2 (Content-Type): [FOUND / already correct]
  - Gap W3 (App Password format): [FOUND / already correct]
  - Gap W4 (Error codes): [FOUND / not typed — fixed by adding WordPressPublishErrorCode]
  - Gap W5 (Content format): [FOUND / already correct — sends HTML]
- publish-gbp.ts:
  - Gap G1 (Token expiry check): [FOUND / missing — fixed by wiring isTokenExpired()]
  - Gap G2 (Token refresh flow): [FOUND / missing — fixed]
  - Gap G3 (Content truncation): [FOUND / missing — auto-truncates at 1497 chars + ellipsis]
  - Gap G4 (Parent path): [FOUND / already correct — stored as full resource name]
  - Gap G5 (DB update): [FOUND / missing — fixed]
  - Gap G6 (callToAction): [FOUND / omitted by default — intentional]

**Changes:**
- `lib/publishers/publish-wordpress.ts` — **FIXED.** [list specific changes]
- `lib/publishers/publish-gbp.ts` — **FIXED.** [list specific changes; wired isTokenExpired + refreshGBPToken from Sprint 90]
- `app/actions/publish-draft.ts` — **FIXED** (if changes needed). [list]
- `app/dashboard/content-drafts/` — **MODIFIED.** Added publish confirmation dialog + data-testid attributes.
- `supabase/seed.sql` — **MODIFIED.** Added 2 content draft rows (f0, f1 UUIDs) for golden tenant.
- `src/__fixtures__/golden-tenant.ts` — **MODIFIED.** Added MOCK_WP_CREDENTIALS, MOCK_CONTENT_DRAFT_WP, MOCK_CONTENT_DRAFT_GBP.

**Tests added:**
- `publish-wordpress.test.ts` — **N Vitest tests.** API call, auth, error codes, DB update, non-blocking DB failure.
- `publish-gbp.test.ts` — **N Vitest tests.** API call, token refresh, content truncation, DB update.
- `publish-draft-action.test.ts` — **N Vitest tests.** Routing, org scoping, error propagation.
- `publish-pipeline.spec.ts` — **N Playwright tests.** WP publish (5), GBP publish (2). All external APIs mocked.

**Run commands:**
```bash
npx vitest run src/__tests__/unit/publish-wordpress.test.ts        # N tests
npx vitest run src/__tests__/unit/publish-gbp.test.ts              # N tests
npx vitest run src/__tests__/unit/publish-draft-action.test.ts     # N tests
npx vitest run                                                       # All — no regressions
npx playwright test src/__tests__/e2e/publish-pipeline.spec.ts     # N e2e tests
npx tsc --noEmit                                                     # 0 type errors
```

**Note:** Replace N with actual counts via `grep -cE "^\s*(it|test)\("` (AI_RULES §13.3).
Fill in diagnosis findings with actual results from reading the files.
```

---

## 🔗 Sprint Dependencies

| Dependency | Sprint | What It Provides |
|-----------|--------|-----------------|
| `isTokenExpired()` + `refreshGBPToken()` | Sprint 90 | GBP token management — wired into GBP publisher |
| `gbp_connections` table with `access_token`, `expires_at` | Sprint 57B | Token source for GBP publisher |
| WordPress credential management UI + table | Sprint 61C | Credentials source for WP publisher |
| `content_drafts` table | Phase 6 | Source of drafts + target for published_at/published_url update |
| `publishDraft()` action | Phase 6 / Doc 19 | Already routes to publishers — verify and fix if needed |
| Content Draft UI (list + detail) | Phase 6 | Where publish buttons + confirmation dialog live |

---

## 🧠 Edge Cases to Handle

1. **WP Application Passwords with spaces:** WP generates them as `AbCd EfGh IjKl MnOp` with spaces. Some users copy-paste and get extra whitespace. Trim the application password before base64 encoding, but preserve the internal spaces (WP itself strips spaces during verification — trimming external whitespace only).

2. **GBP `parent` path format:** The `gbp_location_id` in `gbp_connections` might be stored as `accounts/123456789/locations/987654321` (full path) or just `locations/987654321` or just `987654321`. Read the OAuth callback route (`app/api/auth/google-business/callback/route.ts`) to see how it's stored, then construct the Posts API URL accordingly.

3. **Concurrent publish attempts:** If a user double-clicks the Confirm button, two publish requests fire. The confirmation dialog's Confirm button must be disabled immediately on first click (set `isPublishing = true` in React state). Do not rely on server-side deduplication for this.

4. **Draft content includes HTML but GBP summary is plain text:** GBP's `summary` field renders as plain text — HTML tags will appear literally. Strip HTML tags from draft content before sending to GBP. A simple regex `draft.content.replace(/<[^>]+>/g, '')` is sufficient — no need for a full HTML parser.

5. **WordPress site URL trailing slash:** Users may store `https://myblog.com` or `https://myblog.com/`. The API call to `{site_url}/wp-json/wp/v2/posts` must work either way. Normalize with `new URL('/wp-json/wp/v2/posts', site_url).href`.

6. **Draft already published:** What happens if a user clicks Publish on a draft that's already `status = 'published'`? The Publish button should not be visible for published drafts. Verify this is the case in the content draft list — if not, add a guard in `publishDraft()` that returns `{ ok: false, error_code: 'already_published' }`.

7. **GBP token refresh during publish updates the DB:** `refreshGBPToken()` from Sprint 90 already updates `gbp_connections.access_token` in the DB. The GBP publisher just needs to use the refreshed token for its API call — it doesn't need to do a second DB update.

---

## 📚 Document Sync + Git Commit

### Step 1: Update `/docs`

**`docs/roadmap.md`** — Update Feature #54 (WordPress Publish) `🟡 70%` → `✅ 100%`. Update Feature #55 (GBP Post Publish) `🟡 70%` → `✅ 100%`. Add Sprint 94 note.

**`docs/09-BUILD-PLAN.md`** — Check all Sprint 94 / Phase 8 publish pipeline checkboxes that were previously unchecked.

**`docs/19-AUTOPILOT-ENGINE.md`** — If this doc has a status section or checklist, mark WordPress and GBP Post publish as verified.

### Step 2: Update `DEVLOG.md`
Paste the DEVLOG entry above. Fill in all `[bracketed]` placeholders with real findings from your diagnosis run. Replace `N` with actual test counts.

### Step 3: Update `CLAUDE.md`
```markdown
### Sprint 94 — Publish Pipeline Verification (2026-02-28)
- publish-wordpress.ts: FIXED — [list gaps that were present and fixed]
- publish-gbp.ts: FIXED — wired Sprint 90 token refresh; content truncation; DB update
- publishDraft() action: VERIFIED (+ fixed if needed)
- Publish confirmation dialog added to content-drafts UI
- data-testid attributes added to publish flow
- Seed: 2 content draft rows (f0, f1) for golden tenant
- Tests: 47 Vitest + 7 Playwright
- Gap #54: WordPress Publish 70% → 100%
- Gap #55: GBP Post Publish 70% → 100%
```

### Step 4: Update `MEMORY.md`
```markdown
## Decision: Publish Pipeline Architecture (Sprint 94 — 2026-02-28)
- WP auth: Basic (base64 username:application_password). Trim external whitespace, preserve internal spaces.
- GBP Posts API: mybusiness.googleapis.com/v4/ — DIFFERENT from mybusinessbusinessinformation.googleapis.com/v1/ (Sprint 89)
- GBP post content: HTML stripped before sending to GBP summary field (plain text only)
- GBP content cap: auto-truncated at 1497 chars + ellipsis (never error on length)
- DB update after publish: non-blocking — failed DB update logs error but returns ok:true (post IS published)
- Token refresh: publish-gbp.ts uses isTokenExpired() + refreshGBPToken() from lib/gbp/gbp-token-refresh.ts
- Confirmation dialog required for all publish actions (irreversible external writes)
```

### Step 5: Update `AI_RULES.md`
```markdown
## 46. 📤 Publish Pipeline — External Write Confirmation + Non-Blocking DB (Sprint 94)

All actions that write to external platforms (WordPress, GBP) follow two rules:

* **Confirmation required:** Irreversible external writes (publish, post) must have an explicit UI confirmation step before firing. Disable the confirm button immediately on click.
* **Non-blocking DB update:** After a successful external publish, the DB update (published_at, published_url, status) is non-blocking. A failed DB update is logged but does NOT cause the action to return ok:false — the content IS published externally.
* **GBP Posts API:** Uses mybusiness.googleapis.com/v4/ — NOT the same as the Business Information API (mybusinessbusinessinformation.googleapis.com/v1/) used for Sprint 89 data import.
* **GBP content:** Strip HTML tags before sending to GBP summary. Auto-truncate at 1497 chars + ellipsis.
```

### Step 6: Git Commit
```bash
git add -A
git status

git commit -m "Sprint 94: Publish Pipeline Verification — WordPress + GBP Post

Diagnosis + fixes:
- publish-wordpress.ts: [list actual gaps fixed]
- publish-gbp.ts: wired Sprint-90 token refresh (isTokenExpired + refreshGBPToken),
  added HTML strip for GBP summary, auto-truncate at 1497 chars,
  added DB update (non-blocking) after successful publish
- publishDraft() action: [list actual gaps fixed]

UI:
- Publish confirmation dialog added (irreversible action guard)
- data-testid attributes on publish flow elements
- Typed error messages (auth failure ≠ generic 'something went wrong')

Seed:
- content_drafts: f0 (wordpress target) + f1 (gbp_post target) for golden tenant

Tests:
- publish-wordpress.test.ts: 14 Vitest tests
- publish-gbp.test.ts: 19 Vitest tests
- publish-draft-action.test.ts: 14 Vitest tests
- publish-pipeline.spec.ts: 7 Playwright tests
- All passing, 0 regressions, 0 type errors

Docs: roadmap #54/#55 → 100%, DEVLOG, CLAUDE.md, MEMORY.md, AI_RULES updated
Gap #54 + #55 closed. Tier 2 Sprint 2/5 complete.
Next: Sprint 95 (CSV Export + PDF Audit Report)."

git push origin main
```

---

## 🏁 Sprint Outcome

After Sprint 94 completes:
- **WordPress Publish: 70% → 100%** (Gap #54 closed)
- **GBP Post Publish: 70% → 100%** (Gap #55 closed)
- **The detect → draft → publish loop is fully closed and verified** — the entire LocalVector value chain works end-to-end
- Sprint 90's token refresh utility is now exercised in production code (publish-gbp.ts), not just in tests
- Both publishers have 47 unit tests protecting them against regression
- The publish confirmation dialog guards against accidental irreversible external writes
- **Tier 2 Sprint 2 of 5 complete.** Sprint 95 (CSV Export + PDF Audit Report) is next.
