/**
 * White-Label Domain Types — Sprint 114
 *
 * Types for per-org custom domain + subdomain configuration,
 * DNS verification, and lightweight org context resolved per-request.
 */

// ---------------------------------------------------------------------------
// Domain type + verification status
// ---------------------------------------------------------------------------

export type DomainType = 'subdomain' | 'custom';

export type VerificationStatus =
  | 'unverified'
  | 'pending'
  | 'verified'
  | 'failed';

// ---------------------------------------------------------------------------
// Org domain row
// ---------------------------------------------------------------------------

export interface OrgDomain {
  id: string;
  org_id: string;
  domain_type: DomainType;
  domain_value: string;
  verification_token: string;
  verification_status: VerificationStatus;
  verified_at: string | null;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Domain config (composite view for a single org)
// ---------------------------------------------------------------------------

export interface DomainConfig {
  effective_domain: string;
  subdomain: string;
  custom_domain: OrgDomain | null;
  subdomain_domain: OrgDomain | null;
}

// ---------------------------------------------------------------------------
// Org context (resolved per-request in middleware)
// ---------------------------------------------------------------------------

export interface OrgContext {
  org_id: string;
  org_name: string;
  plan_tier: string;
  resolved_hostname: string;
  is_custom_domain: boolean;
}

// ---------------------------------------------------------------------------
// DNS verification result
// ---------------------------------------------------------------------------

export interface DomainVerificationResult {
  verified: boolean;
  status: VerificationStatus;
  checked_at: string;
  error: string | null;
}

// ---------------------------------------------------------------------------
// DNS instructions (returned by POST /api/whitelabel/domain)
// ---------------------------------------------------------------------------

export interface DnsInstructions {
  cname_record: { type: 'CNAME'; name: string; value: string };
  txt_record: { type: 'TXT'; name: string; value: string };
  instructions: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** TXT record prefix for domain verification */
export const VERIFICATION_TXT_PREFIX = 'localvector-verify=';

/** Base domain for subdomains: {slug}.localvector.ai */
export const SUBDOMAIN_BASE = 'localvector.ai';

/** DNS label limit */
export const MAX_SUBDOMAIN_LENGTH = 63;

/** Valid hostname regex — no protocol, no path, no port */
export const HOSTNAME_REGEX = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
