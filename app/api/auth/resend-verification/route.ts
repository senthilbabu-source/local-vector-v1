import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit/rate-limiter';
import { ROUTE_RATE_LIMITS } from '@/lib/rate-limit/types';
import * as Sentry from '@sentry/nextjs';

/**
 * POST /api/auth/resend-verification
 *
 * §313: Email Verification Flow.
 * Resends the verification email for the currently authenticated (but
 * unverified) user. Rate-limited to 1 per minute per IP to prevent abuse.
 *
 * The user must have a valid session (login sets cookies even for unverified
 * users). We use `auth.resend()` which is Supabase's built-in method.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rl = await checkRateLimit(ROUTE_RATE_LIMITS.auth_resend_verification, ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Please wait before requesting another verification email.' },
      { status: 429, headers: getRateLimitHeaders(rl) },
    );
  }

  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (!user || userError) {
      return NextResponse.json(
        { error: 'You must be signed in to resend verification.' },
        { status: 401 },
      );
    }

    if (user.email_confirmed_at) {
      return NextResponse.json(
        { error: 'Email is already verified.' },
        { status: 400 },
      );
    }

    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email: user.email!,
    });

    if (resendError) {
      Sentry.captureException(resendError, {
        tags: { file: 'resend-verification/route.ts', sprint: '§313' },
      });
      return NextResponse.json(
        { error: 'Failed to send verification email. Please try again.' },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, message: 'Verification email sent.' });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { file: 'resend-verification/route.ts', sprint: '§313' },
    });
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 },
    );
  }
}
