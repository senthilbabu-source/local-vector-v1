// ---------------------------------------------------------------------------
// E2E Global Setup — Phase 19 Test Hardening Sprint
//
// Runs once before the full test suite (Playwright starts the webServer first,
// then invokes this file, then runs tests).
//
// Responsibilities:
//   1. Provision e2e-tester@localvector.ai via Supabase admin API.
//      Creates a fresh user with a primary location that has hours_data=NULL
//      and amenities=NULL so the Dashboard Onboarding Guard always fires.
//      Uses delete+recreate for full idempotency — no `supabase db reset` needed.
//
//   2. Reset incomplete@localvector.ai location to NULL hours/amenities.
//      Belt-and-suspenders: guards against state left over from onboarding.spec.ts.
//
//   3. Save authenticated sessions for all 4 test users:
//        .playwright/dev-user.json          — dev@localvector.ai (golden tenant + open alerts)
//        .playwright/e2e-tester.json        — e2e-tester@localvector.ai (onboarding guard)
//        .playwright/incomplete-user.json   — incomplete@localvector.ai (legacy onboarding spec)
//        .playwright/upload-user.json       — upload@localvector.ai (magic menu pipeline)
//
// Local Supabase service role key: the well-known local-dev key embedded in
// every `supabase start` instance. Falls back to SUPABASE_SERVICE_ROLE_KEY
// env var for flexibility.
// ---------------------------------------------------------------------------

import { chromium, type FullConfig } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';

// Load .env.local so NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
// are available to the Playwright process (which doesn't auto-load it).
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

// ---------------------------------------------------------------------------
// Supabase admin client (Service Role Key — bypasses RLS)
// ---------------------------------------------------------------------------

// Standard Supabase local-dev service role key (same for every `supabase start`).
// SUPABASE_SERVICE_ROLE_KEY env var overrides this when set.
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';

const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const E2E_EMAIL    = 'e2e-tester@localvector.ai';
const E2E_PASSWORD = 'Password123!';

// Org ID for incomplete@localvector.ai (from seed.sql §11c)
const INCOMPLETE_ORG_ID = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11';

const STATE_DIR = path.join(__dirname, '../../.playwright');

const STATES = {
  dev:        path.join(STATE_DIR, 'dev-user.json'),
  e2eTester:  path.join(STATE_DIR, 'e2e-tester.json'),
  incomplete: path.join(STATE_DIR, 'incomplete-user.json'),
  upload:     path.join(STATE_DIR, 'upload-user.json'),
};

// ---------------------------------------------------------------------------
// loginAndSave — UI login + save storage state
// ---------------------------------------------------------------------------

async function loginAndSave(
  email: string,
  password: string,
  statePath: string,
  acceptedUrlPattern: RegExp,
): Promise<void> {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page    = await context.newPage();

  await page.goto('http://localhost:3000/login');
  await page.fill('#email', email);
  await page.fill('#password', password);

  await Promise.all([
    page.waitForURL(acceptedUrlPattern, { timeout: 20_000 }),
    page.click('button[type="submit"]'),
  ]);

  // Wait for all redirects to settle before capturing state.
  await page.waitForLoadState('networkidle');
  await context.storageState({ path: statePath });
  await browser.close();

  console.log('[global.setup] Saved session for', email, '→', statePath);
}

// ---------------------------------------------------------------------------
// provisionE2ETester
// ---------------------------------------------------------------------------

/**
 * Provisions a fresh e2e-tester@ user via the Supabase admin API.
 *
 * Strategy: delete any existing user (clean slate), create a new auth user,
 * wait for the on_user_created DB trigger to fire and create the org +
 * membership, then insert a primary location with NULL hours_data + amenities
 * so the Dashboard Onboarding Guard always redirects to /onboarding.
 */
async function provisionE2ETester(): Promise<void> {
  // 1. Delete any existing e2e-tester auth user (ensures clean slate).
  const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existing = users.find((u) => u.email === E2E_EMAIL);

  if (existing) {
    // Clean up public-schema tables before deleting the auth user.
    const { data: pub } = await admin
      .from('users')
      .select('id')
      .eq('auth_provider_id', existing.id)
      .maybeSingle();

    if (pub) {
      const { data: mem } = await admin
        .from('memberships')
        .select('org_id')
        .eq('user_id', pub.id)
        .maybeSingle();

      if (mem) {
        await admin.from('locations').delete().eq('org_id', mem.org_id);
        await admin.from('memberships').delete().eq('user_id', pub.id);
        await admin.from('organizations').delete().eq('id', mem.org_id);
      }
      await admin.from('users').delete().eq('id', pub.id);
    }

    await admin.auth.admin.deleteUser(existing.id);
    console.log('[global.setup] Deleted existing e2e-tester user');
  }

  // 2. Create fresh auth user.
  //    The on_auth_user_created trigger fires and creates a public.users row.
  //    The on_user_created trigger then creates an org + membership.
  const { data, error } = await admin.auth.admin.createUser({
    email:          E2E_EMAIL,
    password:       E2E_PASSWORD,
    email_confirm:  true,
    user_metadata:  { full_name: 'E2E Tester' },
  });

  if (error || !data.user) {
    throw new Error(`Failed to create e2e-tester: ${error?.message ?? 'unknown error'}`);
  }

  const authUid = data.user.id;

  // 3. Poll until the DB triggers have created the org + membership (up to 10s).
  let orgId: string | null = null;

  for (let attempt = 0; attempt < 20; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 500));

    const { data: pub } = await admin
      .from('users')
      .select('id')
      .eq('auth_provider_id', authUid)
      .maybeSingle();

    if (pub) {
      const { data: mem } = await admin
        .from('memberships')
        .select('org_id')
        .eq('user_id', pub.id)
        .maybeSingle();

      if (mem) {
        orgId = mem.org_id;
        break;
      }
    }
  }

  if (!orgId) {
    throw new Error(
      '[global.setup] DB trigger did not create org for e2e-tester within 10s. ' +
      'Ensure on_user_created trigger is active on the local Supabase instance.'
    );
  }

  // 4. Insert a primary location with NULL hours_data + amenities.
  //    This satisfies the Onboarding Guard condition:
  //      if (primaryLocation && !primaryLocation.hours_data && !primaryLocation.amenities)
  //        redirect('/onboarding')
  const { error: locError } = await admin.from('locations').insert({
    org_id:        orgId,
    name:          'E2E Test Restaurant - Main',
    slug:          'e2e-test-main',
    business_name: 'E2E Test Restaurant',
    is_primary:    true,
    hours_data:    null,
    amenities:     null,
  });

  if (locError) {
    throw new Error(`Failed to create e2e-tester location: ${locError.message}`);
  }

  console.log('[global.setup] Provisioned e2e-tester (authUid:', authUid, ', orgId:', orgId, ')');
}

// ---------------------------------------------------------------------------
// resetIncompleteLocation
// ---------------------------------------------------------------------------

/**
 * Resets incomplete@localvector.ai's full onboarding state.
 * Prevents state leakage from previous onboarding.spec.ts or wizard E2E runs.
 *
 * Resets:
 *   - Primary location: hours_data=NULL, amenities=NULL (dashboard guard fires)
 *   - Organization: onboarding_completed=false (wizard doesn't auto-skip)
 *   - Competitors: deleted (Step 3 starts empty)
 *   - Target queries: deleted (Step 4 starts fresh)
 */
async function resetIncompleteLocation(): Promise<void> {
  await admin
    .from('locations')
    .update({ hours_data: null, amenities: null })
    .eq('org_id', INCOMPLETE_ORG_ID)
    .eq('is_primary', true);

  await admin
    .from('organizations')
    .update({ onboarding_completed: false })
    .eq('id', INCOMPLETE_ORG_ID);

  await admin
    .from('competitors')
    .delete()
    .eq('org_id', INCOMPLETE_ORG_ID);

  await admin
    .from('target_queries')
    .delete()
    .eq('org_id', INCOMPLETE_ORG_ID);

  console.log('[global.setup] Reset incomplete@ onboarding state (location, org, competitors, queries)');
}

// ---------------------------------------------------------------------------
// resetUploadUserMagicMenu
// ---------------------------------------------------------------------------

// Org ID for upload@localvector.ai (from seed.sql §12)
const UPLOAD_ORG_ID = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c22';

/**
 * Deletes the upload@ user's magic_menus record (and associated categories +
 * items) so the magic-menus page always starts at UploadState.
 *
 * 04-magic-menu-pipeline.spec.ts is NOT idempotent by nature — it writes a
 * magic_menus row. This reset makes consecutive test runs safe without needing
 * `npx supabase db reset`.
 */
async function resetUploadUserMagicMenu(): Promise<void> {
  // Fetch the magic menu for upload@ org (if any).
  const { data: menu } = await admin
    .from('magic_menus')
    .select('id')
    .eq('org_id', UPLOAD_ORG_ID)
    .maybeSingle();

  if (!menu) {
    console.log('[global.setup] upload@ has no magic menu — nothing to reset');
    return;
  }

  // Delete in dependency order: items → categories → magic_menus.
  await admin.from('menu_items').delete().eq('menu_id', menu.id);
  await admin.from('menu_categories').delete().eq('menu_id', menu.id);
  await admin.from('magic_menus').delete().eq('id', menu.id);

  console.log('[global.setup] Deleted upload@ magic menu → UploadState will render on next visit');
}

// ---------------------------------------------------------------------------
// Global setup entry point
// ---------------------------------------------------------------------------

export default async function globalSetup(_config: FullConfig): Promise<void> {
  // Ensure .playwright/ directory exists.
  fs.mkdirSync(STATE_DIR, { recursive: true });

  // ── DB provisioning (via admin API — no browser needed) ───────────────────
  await provisionE2ETester();
  await resetIncompleteLocation();
  await resetUploadUserMagicMenu();

  // ── Session provisioning (UI login via Chromium) ──────────────────────────

  // dev@ lands on /dashboard (golden tenant: 2 open alerts, published menu).
  await loginAndSave(
    'dev@localvector.ai',
    'Password123!',
    STATES.dev,
    /\/dashboard/,
  );

  // e2e-tester@ gets redirected to /onboarding (primary location has NULL hours/amenities).
  await loginAndSave(
    E2E_EMAIL,
    E2E_PASSWORD,
    STATES.e2eTester,
    /\/(dashboard|onboarding)/,
  );

  // incomplete@ also redirects to /onboarding (legacy onboarding.spec.ts compatibility).
  await loginAndSave(
    'incomplete@localvector.ai',
    'Password123!',
    STATES.incomplete,
    /\/(dashboard|onboarding)/,
  );

  // upload@ lands on /dashboard (complete location, no magic menu → UploadState).
  await loginAndSave(
    'upload@localvector.ai',
    'Password123!',
    STATES.upload,
    /\/dashboard/,
  );
}
