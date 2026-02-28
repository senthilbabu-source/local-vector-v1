import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { LoginSchema } from '@/lib/schemas/auth';
import * as Sentry from '@sentry/nextjs';

/**
 * POST /api/auth/login
 *
 * Authenticates a user with email + password.
 * On success, the Supabase SSR client writes the session into HTTP-only cookies
 * automatically — the caller does not need to handle tokens directly.
 *
 * Response (200):
 * {
 *   user_id: string
 *   email: string
 *   session: { access_token, refresh_token, expires_at }
 * }
 */
export async function POST(request: Request): Promise<NextResponse> {
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

  // 2. Sign in — session is written to cookies by the SSR client
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    const isInvalidCredentials =
      error?.message?.toLowerCase().includes('invalid login') ||
      error?.message?.toLowerCase().includes('invalid credentials') ||
      error?.message?.toLowerCase().includes('email not confirmed');

    return NextResponse.json(
      { error: isInvalidCredentials ? 'Invalid email or password' : (error?.message ?? 'Authentication failed') },
      { status: isInvalidCredentials ? 401 : 500 }
    );
  }

  return NextResponse.json({
    user_id: data.user.id,
    email: data.user.email,
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
    },
  });
}
