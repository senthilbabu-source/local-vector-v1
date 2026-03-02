// ---------------------------------------------------------------------------
// lib/settings/api-key-service.ts — Sprint 121: Agency API Key Management
//
// AI_RULES §59: SHA-256 hash only stored. raw_key returned ONCE, never in type.
// listApiKeys() explicit column SELECT — key_hash never in OrgApiKey type.
// ---------------------------------------------------------------------------

import { randomBytes, createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { OrgApiKey, CreateApiKeyResult } from './types';

// ---------------------------------------------------------------------------
// generateApiKey
// ---------------------------------------------------------------------------

export async function generateApiKey(
  supabase: SupabaseClient<Database>,
  orgId: string,
  userId: string,
  name: string,
  planTier: string,
): Promise<CreateApiKeyResult> {
  if (planTier !== 'agency') {
    throw new Error('agency_required');
  }

  const rawKey = 'lv_live_' + randomBytes(32).toString('hex');
  const keyHash = createHash('sha256').update(rawKey).digest('hex');
  const keyPrefix = rawKey.slice(0, 12);

  const { data, error } = await supabase
    .from('org_api_keys' as never)
    .insert({
      org_id: orgId,
      name,
      key_prefix: keyPrefix,
      key_hash: keyHash,
      created_by: userId,
    } as never)
    .select('id, org_id, name, key_prefix, created_by, last_used_at, expires_at, is_active, created_at')
    .single();

  if (error || !data) {
    throw new Error(`api_key_create_failed: ${error?.message}`);
  }

  return {
    api_key: data as unknown as OrgApiKey,
    raw_key: rawKey,
  };
}

// ---------------------------------------------------------------------------
// listApiKeys — key_hash NEVER selected
// ---------------------------------------------------------------------------

export async function listApiKeys(
  supabase: SupabaseClient<Database>,
  orgId: string,
): Promise<OrgApiKey[]> {
  const { data, error } = await supabase
    .from('org_api_keys' as never)
    .select('id, org_id, name, key_prefix, created_by, last_used_at, expires_at, is_active, created_at')
    .eq('org_id' as never, orgId as never)
    .eq('is_active' as never, true as never);

  if (error) {
    throw new Error(`api_keys_fetch_failed: ${error.message}`);
  }

  return (data ?? []) as unknown as OrgApiKey[];
}

// ---------------------------------------------------------------------------
// revokeApiKey — soft delete (is_active=false)
// ---------------------------------------------------------------------------

export async function revokeApiKey(
  supabase: SupabaseClient<Database>,
  orgId: string,
  keyId: string,
): Promise<{ ok: true }> {
  const { data, error } = await supabase
    .from('org_api_keys' as never)
    .update({ is_active: false } as never)
    .eq('id' as never, keyId as never)
    .eq('org_id' as never, orgId as never)
    .select('id')
    .single();

  if (error || !data) {
    throw new Error('api_key_not_found');
  }

  return { ok: true };
}
