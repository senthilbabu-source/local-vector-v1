// ---------------------------------------------------------------------------
// lib/data/cron-health.ts — Cron Health Data Layer (Sprint 76)
//
// Fetches cron_run_log rows via service-role client (table has NO user RLS
// policies — service-role only). Delegates transformation to the pure
// cron-health.service.ts module.
//
// Pattern differs slightly from other data layers: creates its own client
// internally (same pattern as lib/services/cron-logger.ts) because the
// table requires service-role access.
// ---------------------------------------------------------------------------

import { createServiceRoleClient } from '@/lib/supabase/server';
import { buildCronHealthSummary, type CronHealthSummary } from '@/lib/services/cron-health.service';

export type { CronHealthSummary } from '@/lib/services/cron-health.service';

/**
 * Fetch the latest cron_run_log rows and build a health summary.
 * Uses service-role client — cron_run_log has RLS enabled with no user policies.
 */
export async function fetchCronHealth(): Promise<CronHealthSummary> {
  const supabase = createServiceRoleClient();

  const { data: rows, error } = await supabase
    .from('cron_run_log')
    .select('id, cron_name, started_at, completed_at, duration_ms, status, summary, error_message, created_at')
    .order('started_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('[cron-health] Failed to fetch cron_run_log:', error.message);
    return buildCronHealthSummary([]);
  }

  return buildCronHealthSummary((rows ?? []) as import('@/lib/services/cron-health.service').CronRunRow[]);
}
