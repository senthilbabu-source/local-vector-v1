/**
 * GET /api/invitations/accept/[token] — Sprint 112
 * Validates an invitation token. PUBLIC — no auth required.
 *
 * POST /api/invitations/accept/[token] — Sprint 112
 * Accepts an invitation. PUBLIC — no auth required for new users.
 * Token IS the authentication mechanism.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { validateToken, acceptInvitation } from '@/lib/invitations/invitation-service';
import { MembershipError } from '@/lib/membership/membership-service';
import * as Sentry from '@sentry/nextjs';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — validate token
// ---------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    const supabase = createServiceRoleClient();
    const validation = await validateToken(supabase, token);

    // Always 200 — errors encoded in the response body
    return NextResponse.json(validation);
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'accept-invite-validate', sprint: '112' } });
    return NextResponse.json(
      { valid: false, invitation: null, error: 'not_found', existing_user: false },
      { status: 200 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST — accept invitation
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  let body: { full_name?: string; password?: string } = {};
  try {
    body = await req.json();
  } catch (_parseError) {
    // Empty body is valid for existing users
  }

  try {
    const supabase = createServiceRoleClient();
    const result = await acceptInvitation(supabase, token, {
      full_name: body.full_name,
      password: body.password,
    });

    return NextResponse.json({
      ok: true,
      org_name: result.org_name,
      role: result.role,
    });
  } catch (err) {
    if (err instanceof MembershipError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: 400 });
    }
    Sentry.captureException(err, { tags: { route: 'accept-invite-post', sprint: '112' } });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
