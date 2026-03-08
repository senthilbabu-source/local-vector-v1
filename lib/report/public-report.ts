// ---------------------------------------------------------------------------
// Public Report Data — Sprint A: server-side fetchers for /report/[token]
// and /report/scan/[id] pages.
//
// Uses service role client to bypass RLS since these are public routes
// accessed via unguessable UUID tokens — the token IS the auth.
//
// AI_RULES §24: real data shown; never fabricate scores.
// AI_RULES §4: org_id never exposed to client.
// ---------------------------------------------------------------------------

import { createServiceRoleClient } from '@/lib/supabase/server';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PublicLocationReport {
  businessName: string;
  city: string | null;
  state: string | null;
  visibilityScore: number | null;
  accuracyScore: number | null;
  realityScore: number | null;
  scoreDelta: number | null;
  snapshotDate: string | null;
  activeHallucinations: number;
  sovEnginesMonitored: number;
  lastScanDate: string | null;
}

export interface PublicScanReport {
  businessName: string;
  scanStatus: 'fail' | 'pass' | 'not_found';
  createdAt: string;
}

// ---------------------------------------------------------------------------
// getPublicLocationReport — fetch by public_share_token UUID
// ---------------------------------------------------------------------------

export async function getPublicLocationReport(
  token: string,
): Promise<PublicLocationReport | null> {
  // Validate UUID format to avoid unnecessary DB calls
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    return null;
  }

  const supabase = createServiceRoleClient();

  // Fetch location by public_share_token — added by PLG mechanics migration
  const { data: location, error: locError } = await supabase
    .from('locations')
    .select('id, org_id, business_name, city, state')
    .eq('public_share_token' as string, token)
    .single();

  if (locError || !location) return null;

  // Fetch latest visibility score snapshot
  const { data: score } = await supabase
    .from('visibility_scores')
    .select('visibility_score, accuracy_score, reality_score, score_delta, snapshot_date')
    .eq('org_id', location.org_id)
    .eq('location_id', location.id)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .single();

  // Count active (unfixed) hallucinations
  const { count: hallucinationCount } = await supabase
    .from('ai_hallucinations')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', location.org_id)
    .is('fixed_at', null);

  // Count distinct SOV engines monitored
  const { count: sovCount } = await supabase
    .from('sov_evaluations')
    .select('engine', { count: 'exact', head: true })
    .eq('org_id', location.org_id);

  // Latest SOV scan date
  const { data: latestSov } = await supabase
    .from('sov_evaluations')
    .select('created_at')
    .eq('org_id', location.org_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return {
    businessName: location.business_name,
    city: location.city,
    state: location.state,
    visibilityScore: score?.visibility_score ?? null,
    accuracyScore: score?.accuracy_score ?? null,
    realityScore: score?.reality_score ?? null,
    scoreDelta: score?.score_delta ?? null,
    snapshotDate: score?.snapshot_date ?? null,
    activeHallucinations: hallucinationCount ?? 0,
    sovEnginesMonitored: sovCount ?? 0,
    lastScanDate: latestSov?.created_at ?? null,
  };
}

// ---------------------------------------------------------------------------
// getPublicScanReport — fetch by scan_leads.id UUID
// ---------------------------------------------------------------------------

export async function getPublicScanReport(
  id: string,
): Promise<PublicScanReport | null> {
  // Validate UUID format
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return null;
  }

  const supabase = createServiceRoleClient();

  const { data, error } = await (
    supabase.from as unknown as (t: string) => ReturnType<typeof supabase.from>
  )('scan_leads')
    .select('business_name, scan_status, created_at')
    .eq('id', id)
    .single();

  if (error || !data) return null;

  const row = data as { business_name: string; scan_status: string; created_at: string };

  return {
    businessName: row.business_name,
    scanStatus: row.scan_status as 'fail' | 'pass' | 'not_found',
    createdAt: row.created_at,
  };
}
