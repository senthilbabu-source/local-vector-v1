/**
 * GET /api/team/invitations — Sprint 112
 * Returns pending invitations for the authenticated user's org.
 *
 * POST /api/team/invitations — Sprint 112
 * Sends a new invitation. Agency-plan-gated, owner/admin only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSafeAuthContext } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { roleSatisfies } from '@/lib/auth/org-roles';
import { canManageTeamSeats } from '@/lib/plan-enforcer';
import {
  sendInvitation,
  getOrgInvitations,
} from '@/lib/invitations/invitation-service';
import {
  buildInvitationEmailProps,
  buildInvitationSubject,
} from '@/lib/invitations/invitation-email';
import { sendInvitationEmail } from '@/lib/email';
import { MembershipError } from '@/lib/membership/membership-service';
import type { MemberRole } from '@/lib/membership/types';
import type { PlanTier } from '@/lib/plan-enforcer';
import { getOrgTheme } from '@/lib/whitelabel/theme-service';
import * as Sentry from '@sentry/nextjs';

export const dynamic = 'force-dynamic';

const VALID_INVITE_ROLES = new Set(['admin', 'analyst', 'viewer']);
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------------------------------------------------------------------------
// GET — list pending invitations
// ---------------------------------------------------------------------------

export async function GET() {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const planTier = (ctx.plan ?? 'trial') as PlanTier;
  if (!canManageTeamSeats(planTier)) {
    return NextResponse.json({ error: 'plan_upgrade_required' }, { status: 403 });
  }

  if (!roleSatisfies(ctx.role, 'admin')) {
    return NextResponse.json({ error: 'insufficient_role' }, { status: 403 });
  }

  try {
    const supabase = createServiceRoleClient();
    const invitations = await getOrgInvitations(supabase, ctx.orgId);
    return NextResponse.json({ invitations });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'team-invitations-get', sprint: '112' } });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST — send invitation
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const planTier = (ctx.plan ?? 'trial') as PlanTier;
  if (!canManageTeamSeats(planTier)) {
    return NextResponse.json({ error: 'plan_upgrade_required' }, { status: 403 });
  }

  if (!roleSatisfies(ctx.role, 'admin')) {
    return NextResponse.json({ error: 'insufficient_role' }, { status: 403 });
  }

  let body: { email?: string; role?: string };
  try {
    body = await req.json();
  } catch (_parseError) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const email = body.email?.toLowerCase().trim() ?? '';
  const role = body.role ?? '';

  // Validate email
  if (!email || !EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  }

  // Validate role
  if (!VALID_INVITE_ROLES.has(role)) {
    return NextResponse.json({ error: 'invalid_role' }, { status: 400 });
  }

  try {
    const supabase = createServiceRoleClient();

    // Get the public user ID for the caller (invited_by references public.users.id)
    const { data: callerUser } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('auth_provider_id', ctx.userId)
      .single();

    if (!callerUser) {
      return NextResponse.json({ error: 'user_not_found' }, { status: 500 });
    }

    const { invitation, token } = await sendInvitation(
      supabase,
      ctx.orgId,
      callerUser.id,
      { email, role: role as Exclude<MemberRole, 'owner'> }
    );

    // Get org name for email
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', ctx.orgId)
      .single();

    // Build and send invitation email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.localvector.ai';
    const acceptUrl = `${appUrl}/invitations/accept/${token}`;

    const emailProps = buildInvitationEmailProps({
      inviterName: callerUser.full_name ?? ctx.email ?? 'A team member',
      orgName: org?.name ?? 'your organization',
      role: role as Exclude<MemberRole, 'owner'>,
      acceptUrl,
      expiresAt: invitation.expires_at,
    });

    const subject = buildInvitationSubject(
      callerUser.full_name ?? ctx.email ?? 'A team member',
      org?.name ?? 'your organization'
    );

    // Sprint 115: Fetch org theme for branded email
    const orgTheme = await getOrgTheme(supabase, ctx.orgId);
    const emailTheme = orgTheme ? {
      primary_color: orgTheme.primary_color,
      text_on_primary: orgTheme.text_on_primary,
      logo_url: orgTheme.logo_url,
      show_powered_by: orgTheme.show_powered_by,
    } : undefined;

    let emailWarning: string | undefined;
    try {
      await sendInvitationEmail({ ...emailProps, to: email, subject, theme: emailTheme });
    } catch (emailErr) {
      Sentry.captureException(emailErr, { tags: { sprint: '112', action: 'sendInviteEmail' } });
      emailWarning = 'Invitation created but email failed to send.';
    }

    return NextResponse.json({
      ok: true,
      invitation,
      ...(emailWarning ? { warning: 'send_failed', message: emailWarning } : {}),
    });
  } catch (err) {
    if (err instanceof MembershipError) {
      const statusMap: Record<string, number> = {
        seat_limit_reached: 429,
        already_member: 409,
        invitation_already_pending: 409,
      };
      return NextResponse.json(
        { error: err.code },
        { status: statusMap[err.code] ?? 500 }
      );
    }
    Sentry.captureException(err, { tags: { route: 'team-invitations-post', sprint: '112' } });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
