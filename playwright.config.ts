// Playwright E2E Configuration — Phase 19 Test Hardening
//
// Run all tests:   npx playwright test
// Run one file:    npx playwright test tests/e2e/viral-wedge.spec.ts
// Show UI:         npx playwright test --ui
//
// Prerequisites (local dev):
//   1. npx supabase db reset   — seeds incomplete@localvector.ai test user
//   2. npx playwright test     — Playwright starts the dev server automatically

import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',

  // 30s accommodates the 2-second setTimeout in runFreeScan (Phase 16)
  // plus React rendering + potential cold-start dev server latency.
  timeout: 30_000,

  // Captures a trace on first retry to aid debugging flaky tests.
  retries: process.env.CI ? 2 : 0,

  // Authentication state for Test 2 (Onboarding Guard) is set up in
  // global-setup.ts by logging in as incomplete@localvector.ai.
  globalSetup: './tests/global-setup.ts',

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },

  webServer: {
    // NEXT_PUBLIC_API_MOCKING=enabled activates MSW via instrumentation.ts so
    // all fetch calls to Perplexity and OpenAI are intercepted by src/mocks/handlers.ts
    // during the test run — no real API keys required, no flaky external calls.
    // STRIPE_SECRET_KEY is explicitly cleared so billing tests always hit the
    // demo branch (createCheckoutSession returns { url: null, demo: true })
    // regardless of what is set in .env.local on the developer's machine.
    command: 'NEXT_PUBLIC_API_MOCKING=enabled STRIPE_SECRET_KEY= npm run dev',
    port: 3000,
    // Reuse an already-running dev server in local dev; always start fresh in CI.
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
