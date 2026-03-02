/**
 * White-Label barrel export — Sprint 114
 */

export type {
  DomainType,
  VerificationStatus,
  OrgDomain,
  DomainConfig,
  OrgContext,
  DomainVerificationResult,
  DnsInstructions,
} from './types';

export {
  VERIFICATION_TXT_PREFIX,
  SUBDOMAIN_BASE,
  MAX_SUBDOMAIN_LENGTH,
  HOSTNAME_REGEX,
} from './types';

export {
  generateOrgSlug,
  getDomainConfig,
  upsertCustomDomain,
  removeCustomDomain,
  updateVerificationStatus,
  DomainError,
} from './domain-service';

export {
  extractSubdomain,
  resolveOrgFromHostname,
  invalidateDomainCache,
} from './domain-resolver';

export {
  verifyCustomDomain,
  buildVerificationToken,
} from './dns-verifier';

export { getOrgContextFromHeaders } from './get-org-context-from-headers';
