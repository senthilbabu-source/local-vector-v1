// ---------------------------------------------------------------------------
// lib/digest/send-gate.ts — Digest Send Gate (Sprint 117)
//
// Pure predicate — determines whether a weekly digest should be sent.
// Zero DB calls in shouldSendDigest(). isFirstDigest() requires a client.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

export interface SendGateInput {
  sov_delta: number;
  has_first_mover_alert: boolean;
  is_first_digest: boolean;
}

export interface SendGateResult {
  should_send: boolean;
  reason: string;
}

/**
 * Pure predicate — determines whether a weekly digest email should be sent.
 *
 * Send conditions (OR logic — any one is sufficient):
 * 1. is_first_digest = true → always send (welcome digest)
 * 2. |sov_delta| >= 2 → significant change worth reporting
 * 3. has_first_mover_alert = true → actionable opportunity available
 */
export function shouldSendDigest(params: SendGateInput): SendGateResult {
  if (params.is_first_digest) {
    return { should_send: true, reason: 'first_digest' };
  }

  if (Math.abs(params.sov_delta) >= 2) {
    return { should_send: true, reason: 'significant_sov_change' };
  }

  if (params.has_first_mover_alert) {
    return { should_send: true, reason: 'first_mover_alert' };
  }

  return { should_send: false, reason: 'send_gate_not_met' };
}

/**
 * Checks whether this org has ever had a digest sent.
 * Returns true if digest_last_sent_at IS NULL on the organizations table.
 */
export async function isFirstDigest(
  supabase: SupabaseClient<Database>,
  orgId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('organizations')
    .select('digest_last_sent_at')
    .eq('id', orgId)
    .single();

  return !data?.digest_last_sent_at;
}
