// ---------------------------------------------------------------------------
// lib/settings/settings-service.ts — Sprint 121: Org Settings DB Operations
//
// AI_RULES §59: shouldScanOrg() gates the SOV cron. weekly=7d, bi-weekly=14d,
// monthly=28d. New orgs (no evaluations) always scan regardless of frequency.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import {
  SCAN_FREQUENCY_DAYS,
  SCAN_FREQUENCY_OPTIONS,
  type OrgSettings,
  type OrgSettingsUpdate,
  type ScanFrequency,
} from './types';

// ---------------------------------------------------------------------------
// getOrCreateOrgSettings
// ---------------------------------------------------------------------------

export async function getOrCreateOrgSettings(
  supabase: SupabaseClient<Database>,
  orgId: string,
): Promise<OrgSettings> {
  const { data } = await supabase
    .from('org_settings' as never)
    .select('*')
    .eq('org_id' as never, orgId as never)
    .maybeSingle();

  if (data) {
    return data as unknown as OrgSettings;
  }

  // Insert defaults
  const { data: inserted, error } = await supabase
    .from('org_settings' as never)
    .insert({ org_id: orgId } as never)
    .select('*')
    .single();

  if (error || !inserted) {
    throw new Error(`org_settings_create_failed: ${error?.message}`);
  }

  return inserted as unknown as OrgSettings;
}

// ---------------------------------------------------------------------------
// updateOrgSettings
// ---------------------------------------------------------------------------

export async function updateOrgSettings(
  supabase: SupabaseClient<Database>,
  orgId: string,
  updates: OrgSettingsUpdate,
): Promise<OrgSettings> {
  // Validate scan_frequency
  if (
    updates.scan_frequency !== undefined &&
    !SCAN_FREQUENCY_OPTIONS.includes(updates.scan_frequency)
  ) {
    throw new Error('invalid_scan_frequency');
  }

  // Validate threshold
  if (updates.notify_sov_drop_threshold !== undefined) {
    if (updates.notify_sov_drop_threshold < 1 || updates.notify_sov_drop_threshold > 20) {
      throw new Error('invalid_threshold');
    }
  }

  // Validate webhook URL
  if (
    updates.notify_slack_webhook_url !== undefined &&
    updates.notify_slack_webhook_url !== null &&
    !updates.notify_slack_webhook_url.startsWith('https://hooks.slack.com/')
  ) {
    throw new Error('invalid_webhook_url');
  }

  const { data, error } = await supabase
    .from('org_settings' as never)
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('org_id' as never, orgId as never)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`settings_update_failed: ${error?.message}`);
  }

  return data as unknown as OrgSettings;
}

// ---------------------------------------------------------------------------
// shouldScanOrg — gates SOV cron per org based on scan_frequency
// ---------------------------------------------------------------------------

export async function shouldScanOrg(
  supabase: SupabaseClient<Database>,
  orgId: string,
  settings: OrgSettings,
): Promise<boolean> {
  const { data: lastScan } = await supabase
    .from('sov_evaluations')
    .select('created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // New org (no evaluations) → always scan
  if (!lastScan) {
    return true;
  }

  const lastScanDate = new Date((lastScan as { created_at: string }).created_at);
  const thresholdDays = SCAN_FREQUENCY_DAYS[settings.scan_frequency as ScanFrequency] ?? 7;
  const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;

  return Date.now() - lastScanDate.getTime() >= thresholdMs;
}
