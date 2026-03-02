import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Users } from 'lucide-react';
import { getSafeAuthContext } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getOrgMembers } from '@/lib/membership/membership-service';
import { getMaxSeats, canAddMember, canManageTeamSeats } from '@/lib/plan-enforcer';
import { roleSatisfies } from '@/lib/auth/org-roles';
import { getPlanDisplayName } from '@/lib/plan-display-names';
import TeamMembersTable from './_components/TeamMembersTable';
import type { PlanTier } from '@/lib/plan-enforcer';

/**
 * Team Members Page — Sprint 111
 *
 * Server Component.
 * Agency plan: full table + seat progress bar + disabled invite button.
 * Non-Agency: upgrade prompt.
 */
export default async function TeamPage() {
  const ctx = await getSafeAuthContext();
  if (!ctx) redirect('/login');
  if (!ctx.orgId) redirect('/onboarding');

  const planTier = (ctx.plan ?? 'trial') as PlanTier;

  // Non-Agency plans see upgrade prompt
  if (!canManageTeamSeats(planTier)) {
    return (
      <div data-testid="team-page" className="max-w-3xl space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">Team Members</h1>
          <p className="mt-0.5 text-sm text-slate-400">
            Manage team members and roles.
          </p>
        </div>

        <div
          data-testid="upgrade-prompt"
          className="rounded-xl border border-white/5 bg-surface-dark p-8 text-center space-y-4"
        >
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-electric-indigo/10">
            <Users className="h-6 w-6 text-electric-indigo" />
          </div>
          <h2 className="text-lg font-semibold text-white">
            Team collaboration is available on the Agency plan
          </h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Invite teammates to collaborate on content, review AI answers, and manage
            locations. Upgrade to {getPlanDisplayName('agency')} to add up to 10 team members.
          </p>
          <Link
            href="/dashboard/billing"
            className="inline-flex items-center gap-2 rounded-lg bg-electric-indigo px-4 py-2 text-sm font-medium text-white hover:bg-electric-indigo/90 transition-colors"
          >
            Upgrade to {getPlanDisplayName('agency')}
          </Link>
        </div>
      </div>
    );
  }

  // Agency plan — fetch full member data
  const supabase = createServiceRoleClient();
  const members = await getOrgMembers(supabase, ctx.orgId);

  const { data: org } = await supabase
    .from('organizations')
    .select('seat_count')
    .eq('id', ctx.orgId)
    .single();

  const seatCount = org?.seat_count ?? members.length;
  const maxSeats = getMaxSeats(planTier) ?? 10;
  const canAdd = canAddMember(planTier, seatCount);
  const canRemove = roleSatisfies(ctx.role, 'admin');

  // Seat progress color
  const seatPercent = maxSeats > 0 ? (seatCount / maxSeats) * 100 : 0;
  const barColor =
    seatPercent >= 100
      ? 'bg-red-500'
      : seatPercent >= 80
        ? 'bg-amber-500'
        : 'bg-signal-green';

  const isEmpty = members.length <= 1;

  return (
    <div data-testid="team-page" className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">Team Members</h1>
          <p className="mt-0.5 text-sm text-slate-400">
            Manage team members and roles.
          </p>
        </div>
        <button
          data-testid="invite-member-btn"
          aria-disabled="true"
          disabled
          title="Invite flow coming soon"
          className="inline-flex items-center gap-2 rounded-lg bg-electric-indigo px-4 py-2 text-sm font-medium text-white opacity-50 cursor-not-allowed"
        >
          Invite Member
        </button>
      </div>

      {/* Seat progress bar */}
      <div data-testid="seat-progress-bar" className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Seats</span>
          <span>
            {seatCount} / {maxSeats}
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-slate-700">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${Math.min(seatPercent, 100)}%` }}
          />
        </div>
      </div>

      {/* Empty state or member table */}
      {isEmpty ? (
        <div className="rounded-xl border border-white/5 bg-surface-dark p-8 text-center space-y-3">
          <p className="text-sm text-slate-300">
            Your team is just you right now.
          </p>
          <p className="text-sm text-slate-400">
            Invite teammates to collaborate on content, review AI answers, and manage locations.
          </p>
        </div>
      ) : (
        <TeamMembersTable
          members={members}
          canRemove={canRemove}
          currentUserId={ctx.userId}
        />
      )}
    </div>
  );
}
