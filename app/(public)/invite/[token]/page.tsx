import { createServiceRoleClient } from '@/lib/supabase/server';
import { createClient } from '@/lib/supabase/server';
import InviteAcceptClient from './InviteAcceptClient';

interface InvitePageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}

/**
 * /invite/[token] — Public invitation acceptance page
 *
 * Server Component fetches invitation data, renders client component
 * for interactive acceptance flow.
 */
export default async function InvitePage({ params, searchParams }: InvitePageProps) {
  const { token } = await params;
  const { error: urlError } = await searchParams;

  // Look up invitation using service role (invitee may not be a member)
  const serviceClient = createServiceRoleClient();
  const { data: invitation } = await serviceClient
    .from('pending_invitations')
    .select(`
      id,
      email,
      role,
      status,
      expires_at,
      invited_by,
      organizations!inner (
        name
      ),
      users!pending_invitations_invited_by_fkey (
        full_name,
        email
      )
    `)
    .eq('token', token)
    .maybeSingle();

  // Determine initial state
  let initialState: 'invalid' | 'pending_login' | 'pending_accept' | 'wrong_account' = 'invalid';
  let invalidReason = urlError ?? 'not_found';

  if (invitation) {
    if (invitation.status !== 'pending') {
      initialState = 'invalid';
      invalidReason = invitation.status === 'accepted'
        ? 'This invitation has already been accepted.'
        : invitation.status === 'revoked'
          ? 'This invitation has been revoked. Contact the team owner for a new invite.'
          : 'This invitation is no longer valid.';
    } else if (new Date(invitation.expires_at) < new Date()) {
      initialState = 'invalid';
      invalidReason = 'This invitation has expired. Please ask for a new invite.';
    } else {
      // Valid invitation — check session
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (urlError === 'wrong_account') {
        initialState = 'wrong_account';
      } else if (!user) {
        initialState = 'pending_login';
      } else {
        const sessionEmail = (user.email ?? '').toLowerCase();
        const inviteEmail = invitation.email.toLowerCase();
        if (sessionEmail === inviteEmail) {
          initialState = 'pending_accept';
        } else {
          initialState = 'wrong_account';
        }
      }
    }
  }

  const org = invitation?.organizations as { name: string } | null;
  const inviter = invitation?.users as { full_name: string | null; email: string } | null;
  const roleLabel = invitation?.role
    ? invitation.role.charAt(0).toUpperCase() + invitation.role.slice(1)
    : '';

  return (
    <div className="min-h-screen bg-[#050A15] flex items-center justify-center p-4">
      <InviteAcceptClient
        token={token}
        initialState={initialState}
        invalidReason={initialState === 'invalid' ? invalidReason : undefined}
        orgName={org?.name}
        inviterName={inviter?.full_name ?? inviter?.email?.split('@')[0]}
        role={roleLabel}
        inviteEmail={invitation?.email}
      />
    </div>
  );
}
