import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

/**
 * GET /api/invitations/accept?token=[token]
 *
 * Public API route — no auth required to reach it.
 * Validates the token and redirects to the appropriate invite page state.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(new URL('/invite/invalid', request.url));
  }

  // Validate token using service role (invitee may not be a member yet)
  const serviceClient = createServiceRoleClient();
  const { data: invitation } = await serviceClient
    .from('pending_invitations')
    .select('id, status, expires_at, email')
    .eq('token', token)
    .maybeSingle();

  if (!invitation) {
    return NextResponse.redirect(new URL(`/invite/${token}?error=not_found`, request.url));
  }

  if (invitation.status !== 'pending') {
    return NextResponse.redirect(
      new URL(`/invite/${token}?error=${invitation.status}`, request.url)
    );
  }

  if (new Date(invitation.expires_at) < new Date()) {
    return NextResponse.redirect(new URL(`/invite/${token}?error=expired`, request.url));
  }

  // Check if user is logged in
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // Check if their email matches
    const sessionEmail = (user.email ?? '').toLowerCase();
    const inviteEmail = invitation.email.toLowerCase();

    if (sessionEmail === inviteEmail) {
      // Email matches — redirect to invite page for acceptance confirmation
      return NextResponse.redirect(new URL(`/invite/${token}`, request.url));
    }

    // Wrong account
    return NextResponse.redirect(
      new URL(`/invite/${token}?error=wrong_account`, request.url)
    );
  }

  // Not logged in — redirect to invite page (will show login/signup CTAs)
  return NextResponse.redirect(new URL(`/invite/${token}`, request.url));
}
