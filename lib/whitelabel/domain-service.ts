/**
 * Domain Config Service — Sprint 114
 *
 * Pure DB operations for per-org custom domain + subdomain configuration.
 * Caller passes Supabase client. No side effects beyond DB writes.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type {
  OrgDomain,
  DomainConfig,
  DomainVerificationResult,
} from './types';
import { SUBDOMAIN_BASE, MAX_SUBDOMAIN_LENGTH, HOSTNAME_REGEX } from './types';

// ---------------------------------------------------------------------------
// Slug generation (pure)
// ---------------------------------------------------------------------------

/**
 * Generate a URL-safe slug from an org name.
 * Used during org creation to populate organizations.slug.
 * Steps: lowercase → strip non-alphanum → collapse hyphens → trim → truncate.
 */
export function generateOrgSlug(orgName: string): string {
  return orgName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')    // strip special chars
    .replace(/\s+/g, '-')            // spaces → hyphens
    .replace(/-+/g, '-')             // collapse consecutive hyphens
    .replace(/^-+|-+$/g, '')         // trim leading/trailing hyphens
    .slice(0, MAX_SUBDOMAIN_LENGTH); // DNS label limit
}

// ---------------------------------------------------------------------------
// Get domain config
// ---------------------------------------------------------------------------

/**
 * Fetch the complete domain config for an org.
 * Returns both the subdomain row and custom domain row (if any),
 * plus the computed effective_domain.
 */
export async function getDomainConfig(
  supabase: SupabaseClient<Database>,
  orgId: string,
): Promise<DomainConfig> {
  // Fetch org slug
  const { data: org } = await supabase
    .from('organizations')
    .select('slug')
    .eq('id', orgId)
    .single();

  const slug = (org as Record<string, unknown> | null)?.slug as string ?? '';

  // Fetch both domain rows
  const { data: rows } = await supabase
    .from('org_domains')
    .select('*')
    .eq('org_id', orgId);

  const domainRows = (rows ?? []) as unknown as OrgDomain[];
  const subdomainDomain = domainRows.find((r) => r.domain_type === 'subdomain') ?? null;
  const customDomain = domainRows.find((r) => r.domain_type === 'custom') ?? null;

  // Compute effective domain
  const isCustomVerified = customDomain?.verification_status === 'verified';
  const effectiveDomain = isCustomVerified
    ? customDomain!.domain_value
    : `${slug}.${SUBDOMAIN_BASE}`;

  return {
    effective_domain: effectiveDomain,
    subdomain: slug,
    custom_domain: customDomain,
    subdomain_domain: subdomainDomain,
  };
}

// ---------------------------------------------------------------------------
// Upsert custom domain
// ---------------------------------------------------------------------------

/**
 * Save or update the custom domain for an org.
 * Validates format, checks for conflicts, resets verification on change.
 */
export async function upsertCustomDomain(
  supabase: SupabaseClient<Database>,
  orgId: string,
  customDomainValue: string,
): Promise<OrgDomain> {
  // Validate format
  if (!HOSTNAME_REGEX.test(customDomainValue)) {
    throw new DomainError('invalid_domain_format');
  }

  // Block LocalVector subdomains
  if (customDomainValue.endsWith(`.${SUBDOMAIN_BASE}`)) {
    throw new DomainError('localvector_domain_not_allowed');
  }

  // Check if another org already has this domain verified
  const { data: existingRows } = await supabase
    .from('org_domains')
    .select('org_id, verification_status')
    .eq('domain_value', customDomainValue)
    .eq('verification_status', 'verified');

  const existing = (existingRows ?? []) as unknown as { org_id: string; verification_status: string }[];
  if (existing.some((r) => r.org_id !== orgId)) {
    throw new DomainError('domain_taken');
  }

  // Upsert — reset verification when domain changes
  const { data, error } = await supabase
    .from('org_domains')
    .upsert(
      {
        org_id: orgId,
        domain_type: 'custom',
        domain_value: customDomainValue,
        verification_status: 'unverified',
        verified_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'org_id,domain_type' },
    )
    .select()
    .single();

  if (error) throw error;
  return data as unknown as OrgDomain;
}

// ---------------------------------------------------------------------------
// Remove custom domain
// ---------------------------------------------------------------------------

/**
 * Delete the custom domain configuration. Idempotent — no error if no custom domain.
 */
export async function removeCustomDomain(
  supabase: SupabaseClient<Database>,
  orgId: string,
): Promise<{ success: true }> {
  await supabase
    .from('org_domains')
    .delete()
    .eq('org_id', orgId)
    .eq('domain_type', 'custom');

  return { success: true };
}

// ---------------------------------------------------------------------------
// Update verification status
// ---------------------------------------------------------------------------

/**
 * Update the verification status after a DNS check.
 */
export async function updateVerificationStatus(
  supabase: SupabaseClient<Database>,
  orgId: string,
  result: DomainVerificationResult,
): Promise<OrgDomain | null> {
  const { data, error } = await supabase
    .from('org_domains')
    .update({
      verification_status: result.status,
      verified_at: result.verified ? new Date().toISOString() : null,
      last_checked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('org_id', orgId)
    .eq('domain_type', 'custom')
    .select()
    .single();

  if (error) return null;
  return data as unknown as OrgDomain;
}

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class DomainError extends Error {
  constructor(
    public readonly code:
      | 'invalid_domain_format'
      | 'localvector_domain_not_allowed'
      | 'domain_taken',
  ) {
    super(code);
    this.name = 'DomainError';
  }
}
