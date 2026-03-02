/**
 * OrgContext Header Reader — Sprint 114
 *
 * Server-side helper for reading OrgContext from request headers
 * set by proxy.ts domain resolver.
 *
 * Usage in any server component:
 *   const orgContext = await getOrgContextFromHeaders();
 *   // If null: request came via direct access — use session-based org
 *   // If present: request came via subdomain or custom domain
 */

import { headers } from 'next/headers';
import type { OrgContext } from './types';

export async function getOrgContextFromHeaders(): Promise<OrgContext | null> {
  const h = await headers();
  const orgId = h.get('x-org-id');
  if (!orgId) return null;

  return {
    org_id: orgId,
    org_name: h.get('x-org-name') ?? '',
    plan_tier: h.get('x-org-plan') ?? '',
    resolved_hostname: h.get('x-resolved-hostname') ?? '',
    is_custom_domain: h.get('x-is-custom-domain') === 'true',
  };
}
