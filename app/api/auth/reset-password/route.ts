import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import * as Sentry from '@sentry/nextjs';
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit/rate-limiter';
import { ROUTE_RATE_LIMITS } from '@/lib/rate-limit/types';
import { validateOrigin } from '@/lib/auth/csrf';
import { isCommonPassword, computePasswordStrength, MAX_PASSWORD_LENGTH } from '@/lib/auth/password-policy';

/**
 * POST /api/auth/reset-password
 *
 * Updates the authenticated user's password via the Supabase SSR client
 * (session comes from httpOnly cookies). After success, signs out all
 * sessions globally so the user must re-authenticate with the new password.
 *
 * §321: CSRF Origin validation + rate limiting + session invalidation.
 *
 * Request body: { password: string }
 * Response (200): { message: 'Password updated' }
 */
export async function POST(request: Request): Promise<NextResponse> {
  // §321: CSRF Origin validation
  const csrfError = validateOrigin(request);
  if (csrfError) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Rate limit by IP
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rl = await checkRateLimit(ROUTE_RATE_LIMITS.auth_reset_password, ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many password reset attempts. Please try again later.' },
      { status: 429, headers: getRateLimitHeaders(rl) },
    );
  }

  // Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch (err) {
    Sentry.captureException(err, { tags: { file: 'auth/reset-password/route.ts', sprint: '321' } });
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const password = typeof (body as Record<string, unknown>)?.password === 'string'
    ? (body as Record<string, unknown>).password as string
    : '';

  // Server-side password policy enforcement
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
  }

  if (new TextEncoder().encode(password).length > MAX_PASSWORD_LENGTH) {
    return NextResponse.json({ error: 'Password must not exceed 72 bytes (bcrypt limit).' }, { status: 400 });
  }

  if (isCommonPassword(password)) {
    return NextResponse.json({ error: 'This password is too common. Please choose a stronger password.' }, { status: 400 });
  }

  if (computePasswordStrength(password) < 2) {
    return NextResponse.json({ error: 'Password is too weak. Use a mix of uppercase, lowercase, numbers, and symbols.' }, { status: 400 });
  }

  // Update password — SSR client reads session from cookies
  const supabase = await createClient();
  const { error: updateError } = await supabase.auth.updateUser({ password });

  if (updateError) {
    Sentry.captureException(updateError, {
      tags: { file: 'auth/reset-password/route.ts', sprint: '321' },
    });
    return NextResponse.json({ error: 'Password update failed. Please try again.' }, { status: 400 });
  }

  // §321-M2: Invalidate ALL sessions globally — user must re-login with new password
  try {
    await supabase.auth.signOut({ scope: 'global' });
  } catch (signOutErr) {
    // Non-fatal — password is already updated. Log but don't fail.
    Sentry.captureException(signOutErr, {
      tags: { file: 'auth/reset-password/route.ts', sprint: '321', step: 'global-signout' },
    });
  }

  return NextResponse.json({ message: 'Password updated' });
}
