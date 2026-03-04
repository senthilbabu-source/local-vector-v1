// ---------------------------------------------------------------------------
// lib/digest/digest-service.ts — Weekly Digest Data Assembly (Sprint 117)
//
// Assembles the complete WeeklyDigestPayload for one recipient.
// Uses service role client for cross-table queries.
//
// Pattern: injected SupabaseClient, parallel queries where possible.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type {
  WeeklyDigestPayload,
  DigestSovTrend,
  DigestCitation,
  DigestMissedQuery,
  DigestFirstMoverAlert,
} from './types';
import { fetchPrimaryGroundTruth } from '@/lib/relevance/get-ground-truth';
import { scoreQueryRelevance } from '@/lib/relevance/query-relevance-filter';
import type { QueryInput } from '@/lib/relevance/types';

/**
 * Computes the Monday of the current week (ISO week start).
 */
function getWeekOfMonday(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1; // Monday = 0 offset
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  return monday.toISOString().split('T')[0];
}

/**
 * Assembles the complete WeeklyDigestPayload for one recipient.
 * Requires service role client for cross-table queries.
 */
export async function buildWeeklyDigestPayload(
  supabase: SupabaseClient<Database>,
  orgId: string,
  recipientUserId: string,
): Promise<WeeklyDigestPayload> {
  // 1. Org info
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', orgId)
    .single();

  if (orgError || !org) {
    throw new Error(`Organization not found: ${orgId}`);
  }

  // 2. Recipient info (from public.users via membership)
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('email, full_name')
    .eq('id', recipientUserId)
    .single();

  if (userError || !user) {
    throw new Error(`Recipient user not found: ${recipientUserId}`);
  }

  // 3. Unsubscribe token (lazy create)
  let { data: prefs } = await supabase
    .from('email_preferences')
    .select('unsubscribe_token')
    .eq('user_id', recipientUserId)
    .eq('org_id', orgId)
    .maybeSingle();

  if (!prefs) {
    // Lazy creation — need to use auth user ID for the FK.
    // recipientUserId is public.users.id, but email_preferences.user_id
    // references auth.users(id). Look up auth_provider_id.
    const { data: authUser } = await supabase
      .from('users')
      .select('auth_provider_id')
      .eq('id', recipientUserId)
      .single();

    if (authUser?.auth_provider_id) {
      const { data: inserted } = await supabase
        .from('email_preferences')
        .insert({
          user_id: authUser.auth_provider_id,
          org_id: orgId,
        })
        .select('unsubscribe_token')
        .single();
      prefs = inserted;
    }
  }

  const unsubscribeToken = prefs?.unsubscribe_token ?? '';

  // 4-7. Parallel data fetches
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const weekCutoff = oneWeekAgo.toISOString();

  const [
    currentSnapshot,
    previousSnapshot,
    recentCited,
    recentMissed,
    firstMoverDraft,
    orgTheme,
    primaryGT,
  ] = await Promise.all([
    // 4a. Current SOV snapshot
    supabase
      .from('visibility_analytics')
      .select('share_of_voice')
      .eq('org_id', orgId)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // 4b. Previous SOV snapshot
    supabase
      .from('visibility_analytics')
      .select('share_of_voice')
      .eq('org_id', orgId)
      .order('snapshot_date', { ascending: false })
      .range(1, 1)
      .maybeSingle(),

    // 5. Citations (where cited this week) — rank_position IS NOT NULL
    supabase
      .from('sov_evaluations')
      .select('query_id, created_at')
      .eq('org_id', orgId)
      .not('rank_position', 'is', null)
      .gte('created_at', weekCutoff)
      .order('created_at', { ascending: false })
      .limit(5),

    // 6. Missed queries (rank_position IS NULL with competitors)
    supabase
      .from('sov_evaluations')
      .select('query_id, mentioned_competitors')
      .eq('org_id', orgId)
      .is('rank_position', null)
      .gte('created_at', weekCutoff)
      .order('created_at', { ascending: false })
      .limit(10),

    // 7. First mover alert (most recent unactioned draft)
    supabase
      .from('content_drafts')
      .select('draft_title, target_prompt, created_at')
      .eq('org_id', orgId)
      .eq('trigger_type', 'first_mover')
      .eq('status', 'draft')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // 8. Org theme (Sprint 115)
    supabase
      .from('org_themes')
      .select('logo_url, primary_color, text_on_primary')
      .eq('org_id', orgId)
      .maybeSingle(),

    // 9. Ground truth for relevance filtering
    fetchPrimaryGroundTruth(supabase, orgId),
  ]);

  // Resolve SOV trend
  const currentSov = currentSnapshot.data?.share_of_voice ?? 0;
  const previousSov = previousSnapshot.data?.share_of_voice ?? 0;
  const currentSovPct = Math.round(currentSov * 100);
  const previousSovPct = Math.round(previousSov * 100);
  const sovDelta = currentSovPct - previousSovPct;

  // Resolve citations with query text
  const citedQueryIds = (recentCited.data ?? []).map((r) => r.query_id);
  let citations: DigestCitation[] = [];
  if (citedQueryIds.length > 0) {
    const { data: queries } = await supabase
      .from('target_queries')
      .select('id, query_text')
      .in('id', citedQueryIds);

    const queryMap = new Map((queries ?? []).map((q) => [q.id, q.query_text]));
    citations = (recentCited.data ?? []).map((r) => ({
      query_text: queryMap.get(r.query_id) ?? 'Unknown query',
      cited_at: r.created_at,
    }));
  }

  // Resolve missed queries (deduplicate by query_id, pick ones with competitors first)
  const missedRaw = recentMissed.data ?? [];
  const seenQueryIds = new Set<string>();
  const missedDeduped = missedRaw.filter((r) => {
    if (seenQueryIds.has(r.query_id)) return false;
    seenQueryIds.add(r.query_id);
    return true;
  });
  // Prioritize queries where a competitor was cited
  missedDeduped.sort((a, b) => {
    const aHas = Array.isArray(a.mentioned_competitors) && (a.mentioned_competitors as string[]).length > 0 ? 1 : 0;
    const bHas = Array.isArray(b.mentioned_competitors) && (b.mentioned_competitors as string[]).length > 0 ? 1 : 0;
    return bHas - aHas;
  });

  // Resolve query text first so we can filter by relevance
  const allMissedQueryIds = missedDeduped.map((r) => r.query_id);
  let missedQueries: DigestMissedQuery[] = [];
  if (allMissedQueryIds.length > 0) {
    const { data: queries } = await supabase
      .from('target_queries')
      .select('id, query_text, query_category')
      .in('id', allMissedQueryIds);

    const queryMap = new Map((queries ?? []).map((q) => [q.id, q]));
    const groundTruth = primaryGT?.groundTruth ?? null;

    // Build full list, then filter by relevance, then take top 3
    const allMissed = missedDeduped
      .map((r) => {
        const q = queryMap.get(r.query_id);
        const competitors = (r.mentioned_competitors as string[] | null) ?? [];
        return {
          query_text: q?.query_text ?? 'Unknown query',
          query_category: q?.query_category ?? 'discovery',
          competitor_cited: competitors[0] ?? null,
        };
      })
      .filter((m) => {
        // Filter out queries not applicable to this business
        if (!groundTruth) return true;
        const queryInput: QueryInput = {
          queryText: m.query_text,
          queryCategory: m.query_category as QueryInput['queryCategory'],
        };
        const result = scoreQueryRelevance(queryInput, groundTruth);
        return result.verdict !== 'not_applicable';
      });

    missedQueries = allMissed.slice(0, 3).map(({ query_text, competitor_cited }) => ({
      query_text,
      competitor_cited,
    }));
  }

  // Resolve first mover alert
  let firstMoverAlert: DigestFirstMoverAlert | null = null;
  if (firstMoverDraft.data) {
    const queryText = firstMoverDraft.data.target_prompt ?? firstMoverDraft.data.draft_title;
    firstMoverAlert = {
      query_text: queryText,
      detected_at: firstMoverDraft.data.created_at,
      action_url: `/dashboard/content/new?query=${encodeURIComponent(queryText)}`,
    };
  }

  // Compute total queries and cited count
  const { count: totalQueries } = await supabase
    .from('sov_evaluations')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .gte('created_at', weekCutoff);

  const { count: citedCount } = await supabase
    .from('sov_evaluations')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .not('rank_position', 'is', null)
    .gte('created_at', weekCutoff);

  const sovTrend: DigestSovTrend = {
    current_sov: currentSovPct,
    previous_sov: previousSovPct,
    delta: sovDelta,
    trend: sovDelta >= 2 ? 'up' : sovDelta <= -2 ? 'down' : 'flat',
    total_queries: totalQueries ?? 0,
    cited_count: citedCount ?? 0,
  };

  return {
    org_id: orgId,
    org_name: org.name,
    recipient_email: user.email,
    recipient_name: user.full_name,
    unsubscribe_token: unsubscribeToken,
    week_of: getWeekOfMonday(),
    sov_trend: sovTrend,
    citations,
    missed_queries: missedQueries,
    first_mover_alert: firstMoverAlert,
    org_logo_url: orgTheme.data?.logo_url ?? null,
    org_primary_color: orgTheme.data?.primary_color ?? '#6366f1',
    org_text_on_primary: orgTheme.data?.text_on_primary ?? '#ffffff',
  };
}

/**
 * Returns all org members who have NOT unsubscribed from the digest.
 * Requires service role client.
 */
export async function getDigestRecipients(
  supabase: SupabaseClient<Database>,
  orgId: string,
): Promise<Array<{ user_id: string; email: string; full_name: string | null }>> {
  // Get all memberships for the org
  const { data: members } = await supabase
    .from('memberships')
    .select('user_id')
    .eq('org_id', orgId);

  if (!members || members.length === 0) return [];

  const userIds = members.map((m) => m.user_id);

  // Get user details
  const { data: users } = await supabase
    .from('users')
    .select('id, email, full_name, auth_provider_id')
    .in('id', userIds);

  if (!users || users.length === 0) return [];

  // Get unsubscribed auth user IDs
  const authIds = users
    .map((u) => u.auth_provider_id)
    .filter((id): id is string => id != null);

  const { data: unsubs } = await supabase
    .from('email_preferences')
    .select('user_id')
    .eq('org_id', orgId)
    .eq('digest_unsubscribed', true)
    .in('user_id', authIds);

  const unsubAuthIds = new Set((unsubs ?? []).map((u) => u.user_id));

  return users
    .filter((u) => u.auth_provider_id && !unsubAuthIds.has(u.auth_provider_id))
    .map((u) => ({
      user_id: u.id,
      email: u.email,
      full_name: u.full_name,
    }));
}
