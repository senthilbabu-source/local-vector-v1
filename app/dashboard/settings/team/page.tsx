import { redirect } from 'next/navigation';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { roleSatisfies, ROLE_PERMISSIONS } from '@/lib/auth/org-roles';
import { PlanGate } from '@/components/plan-gate/PlanGate';
import TeamClient from './_components/TeamClient';

/**
 * Team Management Page — Sprint 98
 *
 * Accessible at /dashboard/settings/team.
 * All members can view the member list.
 * Admin+ can see pending invitations and invite form.
 * Owner can remove members and change roles.
 */
export default async function TeamPage() {
  const ctx = await getSafeAuthContext();
  if (!ctx) redirect('/login');
  if (!ctx.orgId) redirect('/onboarding');

  const supabase = await createClient();

  // Fetch members with user info
  const { data: members } = await supabase
    .from('memberships')
    .select(`
      id,
      role,
      joined_at,
      created_at,
      users (
        id,
        email,
        full_name,
        avatar_url
      )
    `)
    .eq('org_id', ctx.orgId)
    .order('created_at', { ascending: true });

  // Fetch pending invitations (only if admin+)
  let pendingInvitations: Array<{
    id: string;
    email: string;
    role: string;
    status: string;
    expires_at: string;
    created_at: string;
    inviter_name: string | null;
  }> = [];

  const canManageInvites = roleSatisfies(ctx.role, ROLE_PERMISSIONS.inviteMembers);

  if (canManageInvites) {
    const { data: invitations } = await supabase
      .from('pending_invitations')
      .select(`
        id,
        email,
        role,
        status,
        expires_at,
        created_at,
        users!pending_invitations_invited_by_fkey (
          full_name
        )
      `)
      .eq('org_id', ctx.orgId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    pendingInvitations =
      (invitations ?? []).map((inv) => {
        const inviter = inv.users as { full_name: string | null } | null;
        return {
          id: inv.id,
          email: inv.email,
          role: inv.role ?? 'viewer',
          status: inv.status,
          expires_at: inv.expires_at,
          created_at: inv.created_at,
          inviter_name: inviter?.full_name ?? null,
        };
      });
  }

  // Map members for client component
  const memberList = (members ?? []).map((m) => {
    const user = m.users as { id: string; email: string; full_name: string | null; avatar_url: string | null } | null;
    return {
      id: m.id,
      userId: user?.id ?? '',
      email: user?.email ?? '',
      fullName: user?.full_name ?? null,
      avatarUrl: user?.avatar_url ?? null,
      role: m.role ?? 'viewer',
      joinedAt: m.joined_at ?? m.created_at ?? '',
    };
  });

  const canChangeRoles = roleSatisfies(ctx.role, ROLE_PERMISSIONS.changeRole);
  const canRemoveMembers = roleSatisfies(ctx.role, ROLE_PERMISSIONS.removeMember);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white tracking-tight">Team</h1>
        <p className="mt-0.5 text-sm text-slate-400">
          Manage team members, roles, and invitations.
        </p>
      </div>

      {/* Members table */}
      <TeamClient
        members={memberList}
        pendingInvitations={pendingInvitations}
        canManageInvites={canManageInvites}
        canChangeRoles={canChangeRoles}
        canRemoveMembers={canRemoveMembers}
        currentPlan={ctx.plan}
      />

      {/* Invite form (plan-gated for non-Agency) */}
      {canManageInvites && (
        <PlanGate
          requiredPlan="agency"
          currentPlan={ctx.plan}
          feature="Team Members"
        >
          <InviteFormPlaceholder />
        </PlanGate>
      )}
    </div>
  );
}

/** Placeholder rendered inside PlanGate — real form is in TeamClient */
function InviteFormPlaceholder() {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-6">
      <h3 className="text-sm font-medium text-white mb-4">Invite New Member</h3>
      <div className="flex gap-3">
        <div className="flex-1 h-10 rounded-lg bg-slate-700/50" />
        <div className="w-28 h-10 rounded-lg bg-slate-700/50" />
        <div className="w-32 h-10 rounded-lg bg-electric-indigo/50" />
      </div>
    </div>
  );
}
