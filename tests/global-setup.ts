// Playwright Global Setup — Pre-authenticate Test Users
//
// Runs once before the full test suite starts. Logs in as each Playwright test
// user via the real login form and saves authenticated browser storage state to
// disk. Tests can load these state files to skip the login page entirely.
//
// Users saved:
//   • incomplete@localvector.ai → .playwright/incomplete-user.json
//     Phase 19 user: primary location exists but hours_data + amenities = NULL.
//     Dashboard layout onboarding guard fires → redirected to /onboarding.
//     Used by onboarding.spec.ts.
//
//   • upload@localvector.ai → .playwright/upload-user.json
//     Phase 14.5 user: complete location (no guard), no magic menu record.
//     Shows the 3-tab UploadState on /dashboard/magic-menus.
//     Also used by billing.spec.ts (billing is accessible to any authenticated,
//     non-redirected user).
//
// Prerequisites (must run before `npx playwright test`):
//   npx supabase db reset    — seeds both test users
//   npm run dev              — or let Playwright start it via webServer config
//
// (Add .playwright/ to .gitignore — contains session tokens.)

import { chromium, type FullConfig } from '@playwright/test';
import path from 'path';

const INCOMPLETE_USER_STATE = path.join(
  __dirname,
  '../.playwright/incomplete-user.json'
);

const UPLOAD_USER_STATE = path.join(
  __dirname,
  '../.playwright/upload-user.json'
);

async function loginAndSave(
  email: string,
  password: string,
  statePath: string,
  acceptedUrlPattern: RegExp
) {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('http://localhost:3000/login');

  await page.fill('#email', email);
  await page.fill('#password', password);

  await Promise.all([
    page.waitForURL(acceptedUrlPattern, { timeout: 15_000 }),
    page.click('button[type="submit"]'),
  ]);

  // Wait for the page to fully settle (all redirects complete, network idle)
  // before saving the storage state. Without this, the URL could still be
  // mid-redirect (e.g. /dashboard → /onboarding) when the state is captured.
  await page.waitForLoadState('networkidle');

  await context.storageState({ path: statePath });
  await browser.close();

  console.log('[global-setup] Saved session for', email, '→', statePath);
}

export default async function globalSetup(_config: FullConfig) {
  // 1. Incomplete user — used by onboarding.spec.ts
  //    After login, guard redirects to /onboarding (not /dashboard), so we
  //    accept either destination — the session cookie is what matters.
  await loginAndSave(
    'incomplete@localvector.ai',
    'Password123!',
    INCOMPLETE_USER_STATE,
    /\/(dashboard|onboarding)/
  );

  // 2. Upload user — used by hybrid-upload.spec.ts and billing.spec.ts
  //    Has a complete location (no onboarding guard) so lands on /dashboard.
  await loginAndSave(
    'upload@localvector.ai',
    'Password123!',
    UPLOAD_USER_STATE,
    /\/dashboard/
  );
}
