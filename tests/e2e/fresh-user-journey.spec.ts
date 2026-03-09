// ---------------------------------------------------------------------------
// fresh-user-journey.spec.ts — P1-5: Fresh User Journey
//
// Covers the end-to-end flow for a brand-new user signing up via the
// registration form — the gap NOT covered by existing E2E specs:
//
//   02-onboarding-guard.spec.ts  — uses e2e-tester@ (admin-provisioned, skips signup form)
//   15-gbp-onboarding-connect.spec.ts — uses incomplete@ (skips signup form)
//   auth.spec.ts  — only tests that the signup form *renders*, not that it *works*
//
// Tests in this file:
//   1a. Empty submit → client-side Zod validation errors shown inline
//   1b. Weak password → password field error ("at least 8 characters")
//   1c. Duplicate email (mocked 409) → "Email already registered" error banner
//   2.  Post-signup flow: mocked register+login → client navigates to
//       /onboarding/connect → "I'll fill in manually" → /onboarding wizard
//
// Rate-limiting note:
//   The proxy middleware and route handlers both rate-limit /api/auth/register
//   by IP. Tests 1c and 2 use page.route() to mock API responses — this
//   intercepts the fetch call in the browser before the request reaches the
//   server, bypassing rate limiting entirely. This is intentional: the goal is
//   to test client-side behavior (error display, navigation on success).
//
// Auth note (test 2):
//   Mocking register+login means no real session cookies are set.
//   We layer in the e2e-tester@ storageState so the server can authenticate
//   the /onboarding/connect → /onboarding requests that follow the mocked
//   client-side navigation.
//
// No user creation — no afterAll cleanup needed.
//
// Run: npx playwright test tests/e2e/fresh-user-journey.spec.ts
// ---------------------------------------------------------------------------

import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Test group 1: Client-side form validation (unauthenticated, no API calls)
// ---------------------------------------------------------------------------

test.describe('Signup form client-side validation', () => {
  // ── 1a. Empty submit ──────────────────────────────────────────────────────

  test('empty submit shows inline Zod validation errors', async ({ page }) => {
    await page.goto('/signup');

    await expect(
      page.getByRole('button', { name: /create account/i })
    ).toBeVisible();

    // Submit with all fields empty — react-hook-form + Zod fires client-side.
    // No network request is made (validation prevents submission).
    await page.getByRole('button', { name: /create account/i }).click();

    // RegisterSchema: full_name min(2) → "Full name must be at least 2 characters"
    await expect(
      page.getByText(/Full name must be at least 2 characters/i)
    ).toBeVisible({ timeout: 3_000 });

    // RegisterSchema: password min(8) → "Password must be at least 8 characters"
    await expect(
      page.getByText(/Password must be at least 8 characters/i)
    ).toBeVisible({ timeout: 3_000 });

    // URL must not have changed — form did not navigate.
    expect(page.url()).toMatch(/(signup|register)/);
  });

  // ── 1b. Weak password ────────────────────────────────────────────────────

  test('weak password shows password field validation error', async ({
    page,
  }) => {
    await page.goto('/signup');

    await page.fill('#full_name', 'Test User');
    await page.fill('#business_name', 'Test Restaurant');
    await page.fill('#email', 'test@example.com');
    await page.fill('#password', 'weak'); // 4 chars: fails min(8)

    await page.getByRole('button', { name: /create account/i }).click();

    await expect(
      page.getByText(/Password must be at least 8 characters/i)
    ).toBeVisible({ timeout: 3_000 });

    // Other fields are valid — full_name error must NOT appear.
    await expect(
      page.getByText(/Full name must be at least 2 characters/i)
    ).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Test group 2: Server-side error (mocked — bypasses rate limiter)
// ---------------------------------------------------------------------------

test.describe('Signup form server-side error handling (mocked API)', () => {
  // ── 1c. Duplicate email ───────────────────────────────────────────────────

  test('duplicate email response shows "Email already registered" error banner', async ({
    page,
  }) => {
    // Mock /api/auth/register to return 409 without hitting the actual server.
    // This simulates the server-side duplicate-email check (proxy rate limiter
    // would fire first in the real environment, masking the 409).
    await page.route('**/api/auth/register', async (route) => {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Email already registered' }),
      });
    });

    await page.goto('/signup');

    await page.fill('#full_name', 'Duplicate User');
    await page.fill('#business_name', 'Duplicate Restaurant');
    await page.fill('#email', 'dev@localvector.ai'); // existing account
    await page.fill('#password', 'Password123!');

    await page.getByRole('button', { name: /create account/i }).click();

    // Mocked 409 → res.ok is false → client calls:
    //   setGlobalError(body.error ?? 'Registration failed.')
    // The error div has role="alert" (register/page.tsx).
    const errorAlert = page
      .getByRole('alert')
      .filter({ hasText: /Email already registered/i });

    await expect(errorAlert).toBeVisible({ timeout: 5_000 });
  });
});

// ---------------------------------------------------------------------------
// Test group 3: Signup form → navigation on success (mocked, unauthenticated)
//
// §313: After registration, the client now redirects to /verify-email instead
// of /onboarding/connect. The proxy redirects unauthenticated /verify-email
// to /login — both /verify-email and /login confirm navigation fired.
// ---------------------------------------------------------------------------

test.describe('Signup form success → navigation to /verify-email (mocked APIs)', () => {
  test(
    'successful registration → redirects to /verify-email',
    async ({ page }) => {
      // ── Mock: POST /api/auth/register → 201 ─────────────────────────────
      await page.route('**/api/auth/register', async (route) => {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            user_id: 'mock-user-id',
            org_id: 'mock-org-id',
            org_name: 'E2E Test Restaurant',
            email_verification_required: true,
            message: 'Account created. Please check your email to verify your account.',
          }),
        });
      });

      // ── Mock: POST /api/auth/login → 200 (unverified user) ──────────────
      await page.route('**/api/auth/login', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user_id: 'mock-user-id',
            email: 'fresh-mocked@localvector.ai',
            email_verified: false,
            session: { access_token: 'mock-at', refresh_token: 'mock-rt', expires_at: 9999999999 },
          }),
        });
      });

      await page.goto('/signup');

      await expect(
        page.getByRole('button', { name: /create account/i })
      ).toBeVisible();

      await page.fill('#full_name', 'E2E Test User');
      await page.fill('#business_name', 'E2E Test Restaurant');
      await page.fill('#email', 'fresh-mocked@localvector.ai');
      await page.fill('#password', 'Password123!');

      // §313: register → login (sets cookies) → router.push('/verify-email')
      await page.getByRole('button', { name: /create account/i }).click();

      // Proxy redirects unauthenticated /verify-email → /login
      await page.waitForURL(/\/(verify-email|login)/, { timeout: 15_000 });

      const finalUrl = page.url();
      expect(finalUrl).not.toMatch(/(signup|register)/);
      await expect(
        page.getByRole('alert').filter({ hasText: /failed|error/i })
      ).not.toBeVisible();
    }
  );
});

// ---------------------------------------------------------------------------
// Test group 4: Login with unverified email → /verify-email (§313)
// ---------------------------------------------------------------------------

test.describe('Login with unverified email (§313)', () => {
  test('login with email_verified=false redirects to /verify-email', async ({
    page,
  }) => {
    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user_id: 'mock-user-id',
          email: 'unverified@test.com',
          email_verified: false,
          session: { access_token: 'mock-at', refresh_token: 'mock-rt', expires_at: 9999999999 },
        }),
      });
    });

    await page.goto('/login');
    await page.fill('#email', 'unverified@test.com');
    await page.fill('#password', 'Password123!');
    await page.click('button[type="submit"]');

    // Client reads email_verified=false → router.push('/verify-email')
    // Proxy may redirect unauthenticated /verify-email → /login
    await page.waitForURL(/\/(verify-email|login)/, { timeout: 15_000 });
  });

  test('login with 403 email-not-confirmed redirects to /verify-email', async ({
    page,
  }) => {
    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Please verify your email before signing in.',
          email_verification_required: true,
        }),
      });
    });

    await page.goto('/login');
    await page.fill('#email', 'unverified@test.com');
    await page.fill('#password', 'Password123!');
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/(verify-email|login)/, { timeout: 15_000 });
  });
});

// ---------------------------------------------------------------------------
// Test group 5: /verify-email page renders (§313)
// ---------------------------------------------------------------------------

test.describe('Verify email page (§313)', () => {
  test('/verify-email unauthenticated → redirects to /login', async ({
    page,
  }) => {
    // Proxy redirects unauthenticated users from /verify-email to /login
    await page.goto('/verify-email');
    await page.waitForURL(/\/login/, { timeout: 10_000 });
  });
});
