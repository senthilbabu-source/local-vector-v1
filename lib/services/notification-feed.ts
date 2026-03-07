// ---------------------------------------------------------------------------
// lib/services/notification-feed.ts — S48: In-App Notification Center
//
// Aggregates recent events into a unified notification feed.
// Pure functions + I/O entry point.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/nextjs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NotificationType =
  | 'error_detected'
  | 'error_fixed'
  | 'competitor_change'
  | 'score_change'
  | 'win';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  href: string;
  timestamp: string;
  read: boolean;
}

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

/**
 * Formats a timestamp as a relative time string (e.g., "2h ago", "3d ago").
 */
export function formatTimeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

/**
 * Returns the icon name for a notification type.
 */
export function getNotificationIcon(type: NotificationType): string {
  switch (type) {
    case 'error_detected': return 'AlertTriangle';
    case 'error_fixed': return 'CheckCircle2';
    case 'competitor_change': return 'TrendingUp';
    case 'score_change': return 'BarChart3';
    case 'win': return 'Star';
  }
}

/**
 * Returns the accent color for a notification type.
 */
export function getNotificationColor(type: NotificationType): string {
  switch (type) {
    case 'error_detected': return 'text-red-400';
    case 'error_fixed': return 'text-emerald-400';
    case 'competitor_change': return 'text-amber-400';
    case 'score_change': return 'text-violet-400';
    case 'win': return 'text-emerald-400';
  }
}

/**
 * Counts unread notifications.
 */
export function countUnread(notifications: Notification[]): number {
  return notifications.filter(n => !n.read).length;
}

// ---------------------------------------------------------------------------
// I/O — Fetch recent notifications from DB
// ---------------------------------------------------------------------------

/**
 * Fetches the recent notification feed for an org. Never throws.
 */
export async function getNotificationFeed(
  supabase: SupabaseClient,
  orgId: string,
  limit = 20,
): Promise<Notification[]> {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const notifications: Notification[] = [];

    // Parallel fetch: recent errors, fixed errors, wins, score changes
    const [errorsResult, fixedResult, winsResult, scoresResult] = await Promise.all([
      supabase
        .from('ai_hallucinations')
        .select('id, claim_text, severity, model_provider, detected_at')
        .eq('org_id', orgId)
        .eq('correction_status', 'open')
        .gte('detected_at', sevenDaysAgo)
        .order('detected_at', { ascending: false })
        .limit(5),

      supabase
        .from('ai_hallucinations')
        .select('id, category, model_provider, fixed_at')
        .eq('org_id', orgId)
        .in('correction_status', ['fixed', 'corrected'])
        .gte('fixed_at' as 'first_detected_at', sevenDaysAgo)
        .order('fixed_at' as 'first_detected_at', { ascending: false })
        .limit(5),

      supabase
        .from('wins')
        .select('id, title, created_at')
        .eq('org_id', orgId)
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false })
        .limit(5),

      supabase
        .from('visibility_scores')
        .select('id, overall_score, snapshot_date')
        .eq('org_id', orgId)
        .order('snapshot_date', { ascending: false })
        .limit(2),
    ]);

    // New errors
    for (const row of errorsResult.data ?? []) {
      notifications.push({
        id: `err-${row.id}`,
        type: 'error_detected',
        title: 'New AI error detected',
        description: ((row.claim_text as string) ?? 'Unknown error').slice(0, 80),
        href: '/dashboard/hallucinations',
        timestamp: row.detected_at as string,
        read: false,
      });
    }

    // Fixed errors
    for (const row of fixedResult.data ?? []) {
      notifications.push({
        id: `fix-${row.id}`,
        type: 'error_fixed',
        title: `${row.category ?? 'Error'} fixed on ${row.model_provider ?? 'AI'}`,
        description: 'Correction verified successfully',
        href: '/dashboard/hallucinations',
        timestamp: (row as Record<string, unknown>).fixed_at as string ?? new Date().toISOString(),
        read: false,
      });
    }

    // Wins
    for (const row of winsResult.data ?? []) {
      notifications.push({
        id: `win-${row.id}`,
        type: 'win',
        title: (row.title as string) ?? 'New win!',
        description: 'Great progress on your AI visibility',
        href: '/dashboard/wins',
        timestamp: row.created_at as string,
        read: false,
      });
    }

    // Score changes
    const scores = scoresResult.data ?? [];
    if (scores.length >= 2) {
      const current = scores[0].overall_score as number | null;
      const previous = scores[1].overall_score as number | null;
      if (current !== null && previous !== null && current !== previous) {
        const delta = current - previous;
        notifications.push({
          id: `score-${scores[0].id}`,
          type: 'score_change',
          title: `AI Health Score ${delta > 0 ? 'improved' : 'dropped'}`,
          description: `${previous} → ${current} (${delta > 0 ? '+' : ''}${delta} points)`,
          href: '/dashboard',
          timestamp: scores[0].snapshot_date as string,
          read: false,
        });
      }
    }

    // Sort by timestamp descending, limit
    return notifications
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  } catch (err) {
    Sentry.captureException(err, { tags: { service: 'notification-feed', sprint: 'S48' } });
    return [];
  }
}
