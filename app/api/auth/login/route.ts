import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { LoginSchema } from '@/lib/schemas/auth';
import * as Sentry from '@sentry/nextjs';
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit/rate-limiter';
import { ROUTE_RATE_LIMITS } from '@/lib/rate-limit/types';
import { checkAccountLockout, recordFailedLogin, clearFailedLogins } from '@/lib/auth/account-lockout';

/**
 * POST /api/auth/login
 *
 * Authenticates a user with email + password.
 * On success, the Supabase SSR client writes the session into HTTP-only cookies
 * automatically — the caller does not need to handle tokens directly.
 *
 * §314: Account lockout after 5 failed attempts within 15 min.
 *
 * Response (200):
 * {
 *   user_id: string
 *   email: string
 *   session: { access_token, refresh_token, expires_at }
 * }
 */
export async function POST(request: Request): Promise<NextResponse> {
  // P5-FIX-22: Rate limit by IP (brute force protection)
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rl = await checkRateLimit(ROUTE_RATE_LIMITS.auth_login, ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many login attempts. Please try again later.' },
      { status: 429, headers: getRateLimitHeaders(rl) },
    );
  }

  // 1. Parse and validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch (err) {
    Sentry.captureException(err, { tags: { file: 'auth/login/route.ts', sprint: 'A' } });
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { email, password } = parsed.data;

  // §314: Check account lockout before attempting authentication
  const lockout = await checkAccountLockout(email);
  if (lockout.locked) {
    return NextResponse.json(
      {
        error: 'Account temporarily locked due to too many failed login attempts. Please try again later.',
        locked: true,
        retry_after_seconds: lockout.retryAfterSeconds,
      },
      { status: 423 },
    );
  }

  // 2. Sign in — session is written to cookies by the SSR client
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    // §313: If Supabase blocks login because email is unconfirmed, return 403
    // with a redirect hint so the client sends user to /verify-email
    const isEmailNotConfirmed =
      error?.message?.toLowerCase().includes('email not confirmed');

    if (isEmailNotConfirmed) {
      return NextResponse.json(
        { error: 'Please verify your email before signing in.', email_verification_required: true },
        { status: 403 },
      );
    }

    const isInvalidCredentials =
      error?.message?.toLowerCase().includes('invalid login') ||
      error?.message?.toLowerCase().includes('invalid credentials');

    // §314: Record failed login attempt for lockout tracking
    if (isInvalidCredentials) {
      await recordFailedLogin(email);
    }

    return NextResponse.json(
      { error: isInvalidCredentials ? 'Invalid email or password' : (error?.message ?? 'Authentication failed') },
      { status: isInvalidCredentials ? 401 : 500 }
    );
  }

  // §314: Clear failed login attempts on successful authentication
  await clearFailedLogins(email);

  return NextResponse.json({
    user_id: data.user.id,
    email: data.user.email,
    email_verified: !!data.user.email_confirmed_at,
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
    },
  });
}
