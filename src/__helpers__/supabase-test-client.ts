import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Environment — populated by dotenv in setup.ts before this module loads
// ---------------------------------------------------------------------------

const LOCAL_URL =
  process.env.SUPABASE_LOCAL_URL ?? 'http://localhost:54321';
const ANON_KEY = process.env.SUPABASE_LOCAL_ANON_KEY ?? '';
const SERVICE_KEY = process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY ?? '';

// ---------------------------------------------------------------------------
// Client factories
// ---------------------------------------------------------------------------

/**
 * Returns an anonymous (public) Supabase client bound to the local test instance.
 * Fully subject to RLS — use this client in test assertions to verify isolation.
 *
 * Pass `'service'` to get the service-role client (bypasses RLS), which is
 * equivalent to calling `createServiceClient()` directly.
 */
export function createTestClient(role: 'anon' | 'service' = 'anon'): SupabaseClient {
  if (role === 'service') return createServiceClient();
  return createClient(LOCAL_URL, ANON_KEY);
}

/**
 * Returns a service-role Supabase client that bypasses all RLS policies.
 *
 * Use ONLY for:
 *   - Seeding test data in beforeAll/beforeEach
 *   - Cleaning up test data in afterAll/afterEach
 *   - Verifying DB state from a trusted perspective in integration tests
 *
 * Never use this client in the actual test assertion — that would defeat the
 * purpose of RLS testing.
 */
export function createServiceClient(): SupabaseClient {
  return createClient(LOCAL_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

// ---------------------------------------------------------------------------
// TenantContext
// ---------------------------------------------------------------------------

export interface TenantContext {
  /**
   * User-authenticated Supabase client.
   * All queries through this client are filtered by RLS policies.
   * Use this for SELECT, UPDATE, DELETE assertions in tests.
   *
   * ⚠️  RLS INSERT note: `ai_hallucinations` and `magic_menus` have no
   * INSERT policy for regular users (only service role can insert).
   * Seed those rows via `createServiceClient()` in beforeAll/beforeEach.
   */
  client: SupabaseClient;
  orgId: string;
  locationId: string;
  userId: string;
}

// ---------------------------------------------------------------------------
// seedTenant — creates a full test tenant: auth user + org + membership + location
// ---------------------------------------------------------------------------

/**
 * Seeds a complete test tenant and returns an authenticated client scoped to
 * that tenant's session.
 *
 * Steps:
 *  1. Creates a Supabase Auth user (email-confirmed, bypassing email flow)
 *  2. Ensures a `public.users` row exists (mirrors what handle_auth_user_created
 *     trigger does; upserted so tests are idempotent if the trigger already ran)
 *  3. Creates an `organizations` + `memberships` row if the handle_new_user
 *     trigger hasn't fired yet (resilient to trigger timing in CI)
 *  4. Creates a primary `locations` row for the org
 *  5. Signs in as the user to obtain a valid JWT session
 *  6. Returns the authenticated client + IDs
 *
 * @param orgName  Display name for the organization (also used as location name)
 * @param email    Test user's email — must be unique across the test run
 * @param password Defaults to the standard test password from .env.test
 */
export async function seedTenant(
  orgName: string,
  email: string,
  password = process.env.TEST_USER_PASSWORD ?? 'TestPassword123!'
): Promise<TenantContext> {
  const service = createServiceClient();

  // 1. Create auth user (email_confirm: true skips the confirmation email)
  const { data: authData, error: authError } =
    await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (!authData?.user || authError) {
    throw new Error(
      `seedTenant: failed to create auth user "${email}": ${authError?.message ?? 'unknown error'}`
    );
  }

  const authUserId = authData.user.id;

  // 2. Ensure public.users row exists (upsert for idempotency)
  await service.from('users').upsert(
    {
      auth_provider_id: authUserId,
      email,
      full_name: `${orgName} Test Owner`,
    },
    { onConflict: 'auth_provider_id' }
  );

  const { data: publicUser, error: publicUserError } = await service
    .from('users')
    .select('id')
    .eq('auth_provider_id', authUserId)
    .single();

  if (!publicUser || publicUserError) {
    throw new Error(
      `seedTenant: public.users row not found for auth user ${authUserId}`
    );
  }

  // 3. Check if handle_new_user trigger already created org + membership
  const { data: existingMembership } = await service
    .from('memberships')
    .select('org_id')
    .eq('user_id', publicUser.id)
    .maybeSingle();

  let orgId: string;

  if (existingMembership) {
    orgId = existingMembership.org_id;
  } else {
    // Trigger hasn't fired yet (or isn't configured in this test env) — create manually
    const slug =
      orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-') +
      '-' +
      Date.now();

    const { data: org, error: orgError } = await service
      .from('organizations')
      .insert({ name: orgName, slug, owner_user_id: publicUser.id })
      .select('id')
      .single();

    if (!org || orgError) {
      throw new Error(
        `seedTenant: failed to create organization for "${orgName}": ${orgError?.message}`
      );
    }

    orgId = org.id;

    await service
      .from('memberships')
      .insert({ user_id: publicUser.id, org_id: orgId, role: 'owner' });
  }

  // 4. Create a primary location for the org
  const { data: location, error: locationError } = await service
    .from('locations')
    .insert({
      org_id: orgId,
      name: orgName,
      slug: 'primary',
      business_name: orgName,
      is_primary: true,
    })
    .select('id')
    .single();

  if (!location || locationError) {
    throw new Error(
      `seedTenant: failed to create location for org ${orgId}: ${locationError?.message}`
    );
  }

  // 5. Sign in as the user to get an RLS-scoped session
  const userClient = createClient(LOCAL_URL, ANON_KEY);
  const { error: signInError } = await userClient.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    throw new Error(
      `seedTenant: sign-in failed for "${email}": ${signInError.message}`
    );
  }

  return {
    client: userClient,
    orgId,
    locationId: location.id,
    userId: authUserId,
  };
}

// ---------------------------------------------------------------------------
// cleanupTenants — removes all test data by org ID
// ---------------------------------------------------------------------------

/**
 * Deletes all test tenant data for the given org IDs.
 * Relies on ON DELETE CASCADE to clean up locations, memberships, hallucinations, etc.
 * Also deletes the Supabase Auth user records to keep the auth.users table clean.
 *
 * Call in afterAll to keep the local database tidy between test runs.
 */
export async function cleanupTenants(orgIds: string[]): Promise<void> {
  const service = createServiceClient();

  for (const orgId of orgIds) {
    // Collect auth provider IDs before cascading deletes remove memberships
    const { data: memberships } = await service
      .from('memberships')
      .select('users ( auth_provider_id )')
      .eq('org_id', orgId);

    // Delete the org (cascades to all child tables via FK constraints)
    await service.from('organizations').delete().eq('id', orgId);

    // Remove Supabase Auth users
    if (memberships) {
      for (const m of memberships) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const authProviderId = (m as any).users?.auth_provider_id as
          | string
          | undefined;
        if (authProviderId) {
          await service.auth.admin.deleteUser(authProviderId);
        }
      }
    }
  }
}
