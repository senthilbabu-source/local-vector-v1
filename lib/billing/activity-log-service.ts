/**
 * Activity Log Service — Sprint 113
 *
 * Append-only audit log. All writes use service role client.
 * logActivity() NEVER throws — audit logging must not block primary operations.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/supabase/database.types';
import type { MemberRole } from '@/lib/membership/types';
import type { ActivityLogEntry, ActivityLogPage, ActivityLogParams } from './types';

// ---------------------------------------------------------------------------
// logActivity — core write
// ---------------------------------------------------------------------------

export async function logActivity(
  supabase: SupabaseClient<Database>,
  entry: {
    org_id: string;
    event_type: string;
    actor_user_id: string | null;
    actor_email: string | null;
    target_user_id: string | null;
    target_email: string;
    target_role: MemberRole | null;
    metadata: Record<string, unknown>;
  }
): Promise<ActivityLogEntry | null> {
  try {
    const { data, error } = await supabase
      .from('activity_log')
      .insert({
        org_id: entry.org_id,
        event_type: entry.event_type,
        actor_user_id: entry.actor_user_id,
        actor_email: entry.actor_email,
        target_user_id: entry.target_user_id,
        target_email: entry.target_email,
        target_role: entry.target_role,
        metadata: entry.metadata as unknown as Json,
      })
      .select()
      .single();

    if (error) {
      console.error('[activity-log] INSERT failed:', error.message);
      return null;
    }

    return {
      id: data.id,
      org_id: data.org_id,
      event_type: data.event_type as ActivityLogEntry['event_type'],
      actor_user_id: data.actor_user_id,
      actor_email: data.actor_email,
      target_user_id: data.target_user_id,
      target_email: data.target_email,
      target_role: data.target_role as MemberRole | null,
      metadata: (data.metadata ?? {}) as Record<string, unknown>,
      created_at: data.created_at,
    };
  } catch (err) {
    console.error('[activity-log] logActivity threw:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

// ---------------------------------------------------------------------------
// getActivityLog — paginated read
// ---------------------------------------------------------------------------

export async function getActivityLog(
  supabase: SupabaseClient<Database>,
  orgId: string,
  params: ActivityLogParams
): Promise<ActivityLogPage> {
  const page = Math.max(1, params.page);
  const perPage = Math.min(50, Math.max(1, params.per_page));
  const offset = (page - 1) * perPage;

  const { data, error, count } = await supabase
    .from('activity_log')
    .select('*', { count: 'exact' })
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .range(offset, offset + perPage - 1);

  if (error || !data) {
    return { entries: [], total: 0, page, per_page: perPage, has_more: false };
  }

  const entries: ActivityLogEntry[] = data.map((row) => ({
    id: row.id,
    org_id: row.org_id,
    event_type: row.event_type as ActivityLogEntry['event_type'],
    actor_user_id: row.actor_user_id,
    actor_email: row.actor_email,
    target_user_id: row.target_user_id,
    target_email: row.target_email,
    target_role: row.target_role as MemberRole | null,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    created_at: row.created_at,
  }));

  const total = count ?? 0;

  return {
    entries,
    total,
    page,
    per_page: perPage,
    has_more: total > page * perPage,
  };
}

// ---------------------------------------------------------------------------
// Convenience wrappers
// ---------------------------------------------------------------------------

export async function logInviteSent(
  supabase: SupabaseClient<Database>,
  params: {
    orgId: string;
    actorUserId: string;
    actorEmail: string;
    targetEmail: string;
    targetRole: MemberRole;
    invitationId: string;
  }
): Promise<ActivityLogEntry | null> {
  return logActivity(supabase, {
    org_id: params.orgId,
    event_type: 'member_invited',
    actor_user_id: params.actorUserId,
    actor_email: params.actorEmail,
    target_user_id: null,
    target_email: params.targetEmail,
    target_role: params.targetRole,
    metadata: { invitation_id: params.invitationId },
  });
}

export async function logInviteAccepted(
  supabase: SupabaseClient<Database>,
  params: {
    orgId: string;
    targetUserId: string;
    targetEmail: string;
    targetRole: MemberRole;
    invitationId: string;
  }
): Promise<ActivityLogEntry | null> {
  return logActivity(supabase, {
    org_id: params.orgId,
    event_type: 'member_joined',
    actor_user_id: null,
    actor_email: null,
    target_user_id: params.targetUserId,
    target_email: params.targetEmail,
    target_role: params.targetRole,
    metadata: { invitation_id: params.invitationId },
  });
}

export async function logInviteRevoked(
  supabase: SupabaseClient<Database>,
  params: {
    orgId: string;
    actorUserId: string;
    actorEmail: string;
    targetEmail: string;
    invitationId: string;
  }
): Promise<ActivityLogEntry | null> {
  return logActivity(supabase, {
    org_id: params.orgId,
    event_type: 'invitation_revoked',
    actor_user_id: params.actorUserId,
    actor_email: params.actorEmail,
    target_user_id: null,
    target_email: params.targetEmail,
    target_role: null,
    metadata: { invitation_id: params.invitationId },
  });
}

export async function logMemberRemoved(
  supabase: SupabaseClient<Database>,
  params: {
    orgId: string;
    actorUserId: string;
    actorEmail: string;
    targetUserId: string;
    targetEmail: string;
    targetRole: MemberRole;
  }
): Promise<ActivityLogEntry | null> {
  return logActivity(supabase, {
    org_id: params.orgId,
    event_type: 'member_removed',
    actor_user_id: params.actorUserId,
    actor_email: params.actorEmail,
    target_user_id: params.targetUserId,
    target_email: params.targetEmail,
    target_role: params.targetRole,
    metadata: {},
  });
}

export async function logSeatSync(
  supabase: SupabaseClient<Database>,
  params: {
    orgId: string;
    previousCount: number | null;
    newCount: number;
    success: boolean;
    source: string;
    error?: string;
  }
): Promise<ActivityLogEntry | null> {
  return logActivity(supabase, {
    org_id: params.orgId,
    event_type: 'seat_sync',
    actor_user_id: null,
    actor_email: null,
    target_user_id: null,
    target_email: 'system',
    target_role: null,
    metadata: {
      previous_count: params.previousCount,
      new_count: params.newCount,
      success: params.success,
      source: params.source,
      ...(params.error && { error: params.error }),
    },
  });
}
