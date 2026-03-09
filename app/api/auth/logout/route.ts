import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateOrigin } from '@/lib/auth/csrf';

/**
 * POST /api/auth/logout
 *
 * Terminates the current session. The Supabase SSR client clears the
 * session cookies automatically on signOut.
 *
 * This endpoint is intentionally idempotent — calling it when no session
 * exists still returns 200. The client should redirect to /login after calling.
 *
 * §321: CSRF Origin validation.
 *
 * Response (200): { message: 'Logged out successfully' }
 */
export async function POST(request: Request): Promise<NextResponse> {
  // §321: CSRF Origin validation
  const csrfError = validateOrigin(request);
  if (csrfError) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = await createClient();
  await supabase.auth.signOut();

  return NextResponse.json({ message: 'Logged out successfully' });
}
