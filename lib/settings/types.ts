// ---------------------------------------------------------------------------
// lib/settings/types.ts — Sprint 121: Settings Expansion Types
// ---------------------------------------------------------------------------

export type ScanFrequency = 'weekly' | 'bi-weekly' | 'monthly';

export const SCAN_FREQUENCY_DAYS: Record<ScanFrequency, number> = {
  'weekly': 7,
  'bi-weekly': 14,
  'monthly': 28,
};

export const SCAN_FREQUENCY_OPTIONS: ScanFrequency[] = ['weekly', 'bi-weekly', 'monthly'];

export interface OrgSettings {
  id: string;
  org_id: string;
  notify_email_digest: boolean;
  notify_slack_webhook_url: string | null;
  notify_in_app: boolean;
  notify_sov_drop_threshold: number;
  scan_frequency: ScanFrequency;
  created_at: string;
  updated_at: string;
}

export type OrgSettingsUpdate = Partial<
  Omit<OrgSettings, 'id' | 'org_id' | 'created_at' | 'updated_at'>
>;

export interface OrgApiKey {
  id: string;
  org_id: string;
  name: string;
  key_prefix: string;
  created_by: string;
  last_used_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  // key_hash NEVER in this type
}

export interface CreateApiKeyResult {
  api_key: OrgApiKey;
  raw_key: string; // returned ONCE only
}
