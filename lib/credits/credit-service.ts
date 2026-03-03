// ---------------------------------------------------------------------------
// lib/credits/credit-service.ts — Sprint D (N1) + P3-FIX-14
//
// Server-only module. All credit operations go through this service.
// No direct DB calls from action files.
//
// Design decisions:
// - Fail-open: DB errors allow the operation (don't block users)
// - Credits consumed AFTER successful LLM call (not before)
// - Auto-initialize on first checkCredit() if no row exists
// - Auto-reset when reset_date has passed
// - P3-FIX-14: All consumption logged to credit_usage_log (audit trail)
// ---------------------------------------------------------------------------

import { createServiceRoleClient } from '@/lib/supabase/server';
import { getCreditLimit, getNextResetDate } from './credit-limits';
import * as Sentry from '@sentry/nextjs';

// ---------------------------------------------------------------------------
// Credit operation types for audit log
// ---------------------------------------------------------------------------

export type CreditOperation =
  | 'sov_evaluation'
  | 'content_brief'
  | 'competitor_intercept'
  | 'magic_menu'
  | 'ai_preview'
  | 'manual_scan'
  | 'generic';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CreditCheckResult =
  | { ok: true; creditsRemaining: number }
  | { ok: false; reason: 'insufficient_credits'; creditsUsed: number; creditsLimit: number }
  | { ok: false; reason: 'credits_row_missing' }
  | { ok: false; reason: 'db_error' };

// ---------------------------------------------------------------------------
// Check credit
// ---------------------------------------------------------------------------

/**
 * Checks if an org has sufficient credits for one operation.
 * Does NOT consume the credit — call consumeCredit() after the operation succeeds.
 */
export async function checkCredit(orgId: string): Promise<CreditCheckResult> {
  try {
    const supabase = createServiceRoleClient();

    const { data, error } = await supabase
      .from('api_credits')
      .select('credits_used, credits_limit, reset_date, plan')
      .eq('org_id', orgId)
      .single();

    if (error || !data) {
      // Credits row doesn't exist — create it on first check
      const initialized = await initializeCredits(orgId);
      if (!initialized) return { ok: false, reason: 'credits_row_missing' };
      return { ok: true, creditsRemaining: initialized.credits_limit };
    }

    // Check if reset is needed (past reset_date):
    if (new Date(data.reset_date) <= new Date()) {
      await resetCredits(orgId, data.plan);
      return { ok: true, creditsRemaining: getCreditLimit(data.plan) };
    }

    if (data.credits_used >= data.credits_limit) {
      return {
        ok: false,
        reason: 'insufficient_credits',
        creditsUsed: data.credits_used,
        creditsLimit: data.credits_limit,
      };
    }

    return { ok: true, creditsRemaining: data.credits_limit - data.credits_used };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { service: 'credit-service', function: 'checkCredit', sprint: 'D' },
      extra: { orgId },
    });
    return { ok: false, reason: 'db_error' };
  }
}

// ---------------------------------------------------------------------------
// Consume credit
// ---------------------------------------------------------------------------

/**
 * Increments credits_used by 1 for an org.
 * Call AFTER the expensive operation completes successfully.
 * If the operation fails, do not consume the credit.
 */
export async function consumeCredit(orgId: string): Promise<void> {
  try {
    const supabase = createServiceRoleClient();
    await supabase.rpc('increment_credits_used', { p_org_id: orgId });
  } catch (err) {
    // Credit consumption failure is non-fatal — log but do not throw
    Sentry.captureException(err, {
      tags: { service: 'credit-service', function: 'consumeCredit', sprint: 'D' },
      extra: { orgId },
    });
  }
}

// ---------------------------------------------------------------------------
// P3-FIX-14: Consume credit with audit log
// ---------------------------------------------------------------------------

/**
 * Increments credits_used by 1 and logs the event to credit_usage_log.
 * Preferred over consumeCredit() for new call sites that want audit trails.
 */
export async function consumeCreditWithLog(
  orgId: string,
  operation: CreditOperation,
  referenceId?: string,
): Promise<void> {
  try {
    const supabase = createServiceRoleClient();

    // Fetch current state before incrementing
    const { data: before } = await supabase
      .from('api_credits')
      .select('credits_used, credits_limit')
      .eq('org_id', orgId)
      .single();

    // Increment credits
    await supabase.rpc('increment_credits_used', { p_org_id: orgId });

    // Log to audit trail (fire-and-forget, non-blocking)
    if (before) {
      await supabase.from('credit_usage_log').insert({
        org_id: orgId,
        operation,
        credits_used: 1,
        credits_before: before.credits_used,
        credits_after: before.credits_used + 1,
        reference_id: referenceId ?? null,
      });
    }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { service: 'credit-service', function: 'consumeCreditWithLog', sprint: 'P3-FIX-14' },
      extra: { orgId, operation },
    });
  }
}

// ---------------------------------------------------------------------------
// P3-FIX-14: Credit usage history
// ---------------------------------------------------------------------------

export interface CreditHistoryEntry {
  operation: string;
  creditsUsed: number;
  creditsBefore: number;
  creditsAfter: number;
  referenceId: string | null;
  createdAt: string;
}

/**
 * Returns the credit usage history for an org, most recent first.
 */
export async function getCreditHistory(
  orgId: string,
  limit: number = 20,
): Promise<CreditHistoryEntry[]> {
  try {
    const supabase = createServiceRoleClient();
    const { data } = await supabase
      .from('credit_usage_log')
      .select('operation, credits_used, credits_before, credits_after, reference_id, created_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(limit);

    return (data ?? []).map((row) => ({
      operation: row.operation,
      creditsUsed: row.credits_used,
      creditsBefore: row.credits_before,
      creditsAfter: row.credits_after,
      referenceId: row.reference_id,
      createdAt: row.created_at,
    }));
  } catch (err) {
    Sentry.captureException(err, {
      tags: { service: 'credit-service', function: 'getCreditHistory', sprint: 'P3-FIX-14' },
      extra: { orgId },
    });
    return [];
  }
}

// ---------------------------------------------------------------------------
// P3-FIX-14: Credit balance (public, for API routes)
// ---------------------------------------------------------------------------

export interface CreditBalance {
  used: number;
  limit: number;
  remaining: number;
  resetDate: string;
}

/**
 * Returns the current credit balance for an org.
 */
export async function getCreditBalance(orgId: string): Promise<CreditBalance | null> {
  try {
    const supabase = createServiceRoleClient();
    const { data } = await supabase
      .from('api_credits')
      .select('credits_used, credits_limit, reset_date')
      .eq('org_id', orgId)
      .single();

    if (!data) return null;

    return {
      used: data.credits_used,
      limit: data.credits_limit,
      remaining: data.credits_limit - data.credits_used,
      resetDate: data.reset_date,
    };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { service: 'credit-service', function: 'getCreditBalance', sprint: 'P3-FIX-14' },
      extra: { orgId },
    });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Initialize credits (internal)
// ---------------------------------------------------------------------------

/**
 * Creates a new credits row for an org based on their current plan.
 * Called on first checkCredit() if row doesn't exist.
 */
async function initializeCredits(
  orgId: string,
): Promise<{ credits_limit: number } | null> {
  try {
    const supabase = createServiceRoleClient();

    // Fetch the org's plan
    const { data: org } = await supabase
      .from('organizations')
      .select('plan')
      .eq('id', orgId)
      .single();

    if (!org) return null;

    const limit = getCreditLimit(org.plan);
    const resetDate = getNextResetDate();

    const { error } = await supabase.from('api_credits').insert({
      org_id: orgId,
      plan: org.plan ?? 'trial',
      credits_used: 0,
      credits_limit: limit,
      reset_date: resetDate.toISOString(),
    });

    if (error) return null;
    return { credits_limit: limit };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { service: 'credit-service', function: 'initializeCredits', sprint: 'D' },
      extra: { orgId },
    });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Reset credits (internal)
// ---------------------------------------------------------------------------

/**
 * Resets credits_used to 0 and advances reset_date to next month.
 * Called when reset_date has passed.
 */
async function resetCredits(orgId: string, plan: string): Promise<void> {
  try {
    const supabase = createServiceRoleClient();
    await supabase
      .from('api_credits')
      .update({
        credits_used: 0,
        credits_limit: getCreditLimit(plan),
        reset_date: getNextResetDate().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('org_id', orgId);
  } catch (err) {
    Sentry.captureException(err, {
      tags: { service: 'credit-service', function: 'resetCredits', sprint: 'D' },
      extra: { orgId },
    });
  }
}
