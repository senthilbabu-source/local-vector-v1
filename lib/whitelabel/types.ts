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

// ---------------------------------------------------------------------------
// Sprint 115 — White-Label Theming + Emails
// ---------------------------------------------------------------------------

export type FontFamily =
  | 'Inter'
  | 'Roboto'
  | 'Open Sans'
  | 'Lato'
  | 'Poppins'
  | 'Montserrat'
  | 'Raleway'
  | 'Nunito'
  | 'DM Sans'
  | 'Plus Jakarta Sans';

export const GOOGLE_FONT_FAMILIES: FontFamily[] = [
  'Inter', 'Roboto', 'Open Sans', 'Lato', 'Poppins',
  'Montserrat', 'Raleway', 'Nunito', 'DM Sans', 'Plus Jakarta Sans',
];

/**
 * Returns the Google Fonts CSS URL for the given font family.
 * Returns null for 'Inter' (already loaded by the app).
 */
export function buildGoogleFontUrl(font: FontFamily): string | null {
  if (font === 'Inter') return null;
  const encoded = encodeURIComponent(font);
  return `https://fonts.googleapis.com/css2?family=${encoded}:wght@400;500;600;700&display=swap`;
}

export interface OrgTheme {
  id: string;
  org_id: string;
  primary_color: string;
  accent_color: string;
  text_on_primary: string;
  font_family: FontFamily;
  logo_url: string | null;
  logo_storage_path: string | null;
  show_powered_by: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrgThemeSave {
  primary_color?: string;
  accent_color?: string;
  font_family?: FontFamily;
  show_powered_by?: boolean;
}

export interface ThemeCssProps {
  '--brand-primary': string;
  '--brand-accent': string;
  '--brand-text-on-primary': string;
  '--brand-font-family': string;
}

export const DEFAULT_THEME: Omit<OrgTheme, 'id' | 'org_id' | 'logo_url' |
  'logo_storage_path' | 'created_at' | 'updated_at'> = {
  primary_color: '#6366f1',
  accent_color: '#8b5cf6',
  text_on_primary: '#ffffff',
  font_family: 'Inter',
  show_powered_by: true,
};
