/**
 * White-Label barrel export — Sprint 114 + Sprint 115
 */

export type {
  DomainType,
  VerificationStatus,
  OrgDomain,
  DomainConfig,
  OrgContext,
  DomainVerificationResult,
  DnsInstructions,
  FontFamily,
  OrgTheme,
  OrgThemeSave,
  ThemeCssProps,
} from './types';

export {
  VERIFICATION_TXT_PREFIX,
  SUBDOMAIN_BASE,
  MAX_SUBDOMAIN_LENGTH,
  HOSTNAME_REGEX,
  GOOGLE_FONT_FAMILIES,
  DEFAULT_THEME,
  buildGoogleFontUrl,
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

// Sprint 115 — Theme
export {
  getOrgTheme,
  getOrgThemeOrDefault,
  upsertOrgTheme,
  updateLogoUrl,
  removeLogo,
  ThemeError,
} from './theme-service';

export {
  validateHexColor,
  sanitizeHexColor,
  computeTextOnPrimary,
  buildThemeCssProps,
  cssPropsToStyleString,
  cssPropsToObject,
  lightenColor,
  buildLogoStoragePath,
  isValidFontFamily,
} from './theme-utils';

export {
  buildThemedEmailWrapper,
  buildThemedEmailSubject,
} from './email-theme-wrapper';
