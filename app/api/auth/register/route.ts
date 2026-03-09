import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { RegisterSchema } from '@/lib/schemas/auth';
import * as Sentry from '@sentry/nextjs';
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit/rate-limiter';
import { ROUTE_RATE_LIMITS } from '@/lib/rate-limit/types';
import { verifyTurnstileToken, isTurnstileEnabled } from '@/lib/auth/turnstile';
import { validateOrigin } from '@/lib/auth/csrf';

/** §315: Maximum retries when polling for trigger-created rows. */
const TRIGGER_POLL_MAX_RETRIES = 2;

/** §315: Delay between trigger poll retries (ms). */
const TRIGGER_POLL_DELAY_MS = 250;

/**
 * POST /api/auth/register
 *
 * Creates a new user account + organisation in a single atomic sequence:
 *
 *  1. Validate request body (Zod)
 *  2. Create Supabase Auth user via service role (bypasses email confirmation)
 *     → triggers fire:
 *       - on_auth_user_created  → inserts public.users row
 *       - on_user_created       → inserts organizations + memberships rows
 *  3. Retrieve the org created by the trigger (with retry for trigger propagation)
 *  4. PATCH the org name to the supplied `business_name`
 *     (trigger uses email prefix as a placeholder — Doc 09 idempotent signup rule)
 *  5. Return 201 with user_id and org context
 *
 * §315: Rollback is hardened — deleteUser failures are caught and logged to
 * Sentry with the orphaned auth user ID for manual cleanup.
 */
export async function POST(request: Request): Promise<NextResponse> {
  // §321: CSRF Origin validation
  const csrfError = validateOrigin(request);
  if (csrfError) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // P5-FIX-22: Rate limit by IP (signup spam protection)
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rl = await checkRateLimit(ROUTE_RATE_LIMITS.auth_register, ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many registration attempts. Please try again later.' },
      { status: 429, headers: getRateLimitHeaders(rl) },
    );
  }

  // 1. Parse and validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch (err) {
    Sentry.captureException(err, { tags: { file: 'auth/register/route.ts', sprint: 'A' } });
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { email, password, full_name, business_name } = parsed.data;

  // §317: Cloudflare Turnstile verification (fail-open when not configured)
  if (isTurnstileEnabled()) {
    const turnstileToken = (body as Record<string, unknown>)?.['cf-turnstile-response'];
    const turnstileResult = await verifyTurnstileToken(
      typeof turnstileToken === 'string' ? turnstileToken : '',
      ip,
    );
    if (!turnstileResult.success) {
      return NextResponse.json(
        { error: 'CAPTCHA verification failed. Please try again.', code: 'CAPTCHA_FAILED' },
        { status: 403 },
      );
    }
  }

  const service = createServiceRoleClient();

  // 2. Create the Auth user — triggers handle public.users + org + membership
  const { data: authData, error: authError } =
    await service.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: { full_name },
    });

  if (authError || !authData.user) {
    const isDuplicate =
      authError?.message?.toLowerCase().includes('already registered') ||
      authError?.message?.toLowerCase().includes('already exists') ||
      authError?.code === '23505';

    return NextResponse.json(
      { error: isDuplicate ? 'Email already registered' : (authError?.message ?? 'Failed to create user') },
      { status: isDuplicate ? 409 : 500 }
    );
  }

  const authUserId = authData.user.id;

  const db = service;

  /**
   * §315: Hardened rollback — catches deleteUser failures and reports orphaned
   * auth user IDs to Sentry for manual cleanup. Never throws.
   */
  let rollbackAttempted = false;
  async function rollback(reason: string): Promise<NextResponse> {
    if (rollbackAttempted) {
      // Prevent double-rollback if called from multiple error paths
      return NextResponse.json(
        { error: `${reason} (rollback already attempted)` },
        { status: 500 },
      );
    }
    rollbackAttempted = true;

    try {
      await service.auth.admin.deleteUser(authUserId);
    } catch (rollbackErr) {
      // §315: Orphaned auth user — log to Sentry for manual cleanup
      Sentry.captureException(rollbackErr, {
        tags: { file: 'auth/register/route.ts', sprint: '315', issue: 'orphaned_auth_user' },
        extra: { authUserId, email, reason },
      });
      Sentry.captureMessage(
        `[§315] ORPHANED AUTH USER: ${authUserId} — rollback deleteUser failed. Manual cleanup required.`,
        { level: 'fatal', tags: { sprint: '315' } },
      );
      return NextResponse.json(
        { error: `${reason} Rollback failed — please contact support.`, code: 'ROLLBACK_FAILED' },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: `${reason} Account rolled back. Please try again.`, code: 'ROLLED_BACK' },
      { status: 500 },
    );
  }

  // 3. §315: Resolve public.users row with retry for trigger propagation
  //    PostgreSQL triggers are synchronous, but Supabase Auth → public schema
  //    may have replication lag in some deployment configurations.
  let publicUser: { id: string } | null = null;
  let publicUserError: unknown = null;

  for (let attempt = 0; attempt <= TRIGGER_POLL_MAX_RETRIES; attempt++) {
    const result = await db
      .from('users')
      .select('id')
      .eq('auth_provider_id', authUserId)
      .single() as { data: { id: string } | null; error: unknown };

    if (result.data) {
      publicUser = result.data;
      publicUserError = null;
      break;
    }

    publicUserError = result.error;

    if (attempt < TRIGGER_POLL_MAX_RETRIES) {
      await new Promise((resolve) => setTimeout(resolve, TRIGGER_POLL_DELAY_MS));
    }
  }

  if (!publicUser) {
    Sentry.captureMessage(
      `[§315] public.users row not found after ${TRIGGER_POLL_MAX_RETRIES + 1} attempts for auth user ${authUserId}`,
      { level: 'error', tags: { sprint: '315' }, extra: { publicUserError } },
    );
    return rollback('User profile not found after creation —');
  }

  // 4. §315: Resolve membership with retry for trigger propagation
  let membership: { org_id: string } | null = null;
  let membershipError: unknown = null;

  for (let attempt = 0; attempt <= TRIGGER_POLL_MAX_RETRIES; attempt++) {
    const result = await db
      .from('memberships')
      .select('org_id')
      .eq('user_id', publicUser.id)
      .single() as { data: { org_id: string } | null; error: unknown };

    if (result.data) {
      membership = result.data;
      membershipError = null;
      break;
    }

    membershipError = result.error;

    if (attempt < TRIGGER_POLL_MAX_RETRIES) {
      await new Promise((resolve) => setTimeout(resolve, TRIGGER_POLL_DELAY_MS));
    }
  }

  if (!membership) {
    Sentry.captureMessage(
      `[§315] memberships row not found after ${TRIGGER_POLL_MAX_RETRIES + 1} attempts for user ${publicUser.id}`,
      { level: 'error', tags: { sprint: '315' }, extra: { membershipError } },
    );
    return rollback('Organisation not found after creation —');
  }

  // 5. Update the org name to the user-supplied business_name
  //    (trigger placeholder is "<full_name>'s Venue" — Doc 09 idempotent signup rule)
  const { error: updateError } = await db
    .from('organizations')
    .update({ name: business_name })
    .eq('id', membership.org_id) as { data: null; error: unknown };

  if (updateError) {
    Sentry.captureException(updateError, {
      tags: { file: 'auth/register/route.ts', sprint: '315' },
      extra: { authUserId, orgId: membership.org_id },
    });
    return rollback('Failed to set business name —');
  }

  return NextResponse.json(
    {
      user_id: authUserId,
      org_id: membership.org_id,
      org_name: business_name,
      email_verification_required: true,
      message: 'Account created. Please check your email to verify your account.',
    },
    { status: 201 }
  );
}
