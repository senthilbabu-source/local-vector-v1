// ---------------------------------------------------------------------------
// GET /api/email/unsubscribe?token={token} — One-Click Unsubscribe (Sprint 117)
//
// PUBLIC — no auth required. Uses service role client.
// Standard email unsubscribe pattern (GET, not POST).
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const HEX_64_REGEX = /^[0-9a-f]{64}$/i;

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');

  // 1. Validate token format
  if (!token || !HEX_64_REGEX.test(token)) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  // 2. Look up token
  const { data: prefs, error } = await supabase
    .from('email_preferences')
    .select('id, digest_unsubscribed')
    .eq('unsubscribe_token', token)
    .maybeSingle();

  if (error || !prefs) {
    return NextResponse.json({ error: 'token_not_found' }, { status: 404 });
  }

  // 3. Already unsubscribed
  if (prefs.digest_unsubscribed) {
    const url = new URL('/unsubscribe', request.url);
    url.searchParams.set('already', 'true');
    return NextResponse.redirect(url);
  }

  // 4. Unsubscribe
  await supabase
    .from('email_preferences')
    .update({
      digest_unsubscribed: true,
      unsubscribed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', prefs.id);

  // 5. Redirect to confirmation
  const url = new URL('/unsubscribe', request.url);
  url.searchParams.set('success', 'true');
  return NextResponse.redirect(url);
}
