// ---------------------------------------------------------------------------
// lib/services/cron-logger.ts — Cron Health Logging Service (Sprint 62A)
//
// Three functions: logCronStart, logCronComplete, logCronFailed
// Used by all 4 cron route inline fallbacks.
// Uses createServiceRoleClient() to bypass RLS (cron_run_log has no user policies).
//
// Fail-safe: all errors are caught and logged — never crashes the cron.
// ---------------------------------------------------------------------------

import { createServiceRoleClient } from '@/lib/supabase/server';
import type { Json } from '@/lib/supabase/database.types';

export interface CronLogHandle {
  logId: string | null;
  startedAt: number; // Date.now() timestamp for duration_ms calc
}

/**
 * Insert a "running" row into cron_run_log. Returns a handle for later
 * completion or failure. If the insert fails, returns a null logId —
 * the cron still runs normally.
 */
export async function logCronStart(cronName: string): Promise<CronLogHandle> {
  const startedAt = Date.now();
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from('cron_run_log')
      .insert({ cron_name: cronName, status: 'running' })
      .select('id')
      .single();

    if (error) {
      console.error(`[cron-logger] Failed to log start for ${cronName}:`, error.message);
      return { logId: null, startedAt };
    }
    return { logId: data?.id ?? null, startedAt };
  } catch (err) {
    console.error(`[cron-logger] Unexpected error logging start for ${cronName}:`, err);
    return { logId: null, startedAt };
  }
}

/**
 * Mark a cron run as successful. Computes duration_ms from the handle's
 * startedAt timestamp. No-op if logId is null.
 */
export async function logCronComplete(
  handle: CronLogHandle,
  summary: Record<string, unknown>,
): Promise<void> {
  if (!handle.logId) return;
  try {
    const supabase = createServiceRoleClient();
    const durationMs = Date.now() - handle.startedAt;
    await supabase
      .from('cron_run_log')
      .update({
        status: 'success',
        completed_at: new Date().toISOString(),
        duration_ms: durationMs,
        summary: summary as unknown as Json,
      })
      .eq('id', handle.logId);
  } catch (err) {
    console.error(`[cron-logger] Failed to log completion for run ${handle.logId}:`, err);
  }
}

/**
 * Mark a cron run as failed. Stores the error message and computes duration_ms.
 * No-op if logId is null.
 */
export async function logCronFailed(
  handle: CronLogHandle,
  errorMessage: string,
): Promise<void> {
  if (!handle.logId) return;
  try {
    const supabase = createServiceRoleClient();
    const durationMs = Date.now() - handle.startedAt;
    await supabase
      .from('cron_run_log')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        duration_ms: durationMs,
        error_message: errorMessage,
      })
      .eq('id', handle.logId);
  } catch (err) {
    console.error(`[cron-logger] Failed to log failure for run ${handle.logId}:`, err);
  }
}
