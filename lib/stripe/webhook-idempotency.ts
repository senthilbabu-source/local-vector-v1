// ---------------------------------------------------------------------------
// Stripe Webhook Idempotency — §203
//
// Uses the existing `stripe_webhook_events` table (UNIQUE on stripe_event_id)
// to prevent double-processing of Stripe webhook events.
//
// Two functions:
//   isEventAlreadyProcessed() — SELECT check before dispatch
//   recordWebhookEvent()      — INSERT after dispatch (fire-and-forget)
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import * as Sentry from '@sentry/nextjs';

/**
 * Returns true if this Stripe event has already been processed.
 * Uses maybeSingle() so it returns null (not throw) on not-found.
 * Fail-open: returns false on DB errors so events are never silently dropped.
 */
export async function isEventAlreadyProcessed(
  supabase: SupabaseClient<Database>,
  stripeEventId: string,
): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('stripe_webhook_events')
      .select('id')
      .eq('stripe_event_id', stripeEventId)
      .maybeSingle();
    return data !== null;
  } catch (err) {
    // Fail-open: if we can't check, process the event anyway
    Sentry.captureException(err, { tags: { component: 'webhook-idempotency' } });
    return false;
  }
}

/**
 * Records a processed webhook event for idempotency + audit trail.
 * Non-critical — failure is logged but does not block the 200 response.
 */
export async function recordWebhookEvent(
  supabase: SupabaseClient<Database>,
  params: {
    stripeEventId: string;
    eventType: string;
    orgId: string | null;
    error: string | null;
  },
): Promise<void> {
  const { error } = await supabase.from('stripe_webhook_events').insert({
    stripe_event_id: params.stripeEventId,
    event_type: params.eventType,
    org_id: params.orgId,
    error: params.error,
  });

  if (error) {
    // Unique constraint violation = duplicate (race condition) — acceptable.
    // Other errors are logged but not thrown.
    Sentry.captureException(
      new Error(`[webhook-idempotency] insert failed: ${error.message}`),
      { tags: { stripe_event_id: params.stripeEventId } },
    );
  }
}
