/**
 * Domain Resolver — Sprint 114
 *
 * Edge-compatible hostname → org lookup used by proxy.ts middleware.
 * Must be compatible with Vercel Edge Runtime:
 *   - NO Node.js built-ins (no fs, no dns, no path)
 *   - NO heavy libraries
 *   - Uses @supabase/ssr createServerClient (edge-safe)
 *
 * Caching: Upstash Redis (5 min TTL). Graceful fallback to DB on Redis error.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { OrgContext } from './types';
import { SUBDOMAIN_BASE } from './types';

const CACHE_TTL_SECONDS = 300; // 5 minutes
const CACHE_PREFIX = 'domain_ctx:';

// ---------------------------------------------------------------------------
// Pure helper: extract subdomain from hostname
// ---------------------------------------------------------------------------

/**
 * If hostname is a subdomain of localvector.ai, return the slug.
 * Returns null for localhost, direct access, or non-localvector domains.
 */
export function extractSubdomain(hostname: string): string | null {
  // Strip port if present
  const host = hostname.split(':')[0];

  if (host === 'localhost' || host === '127.0.0.1') return null;
  if (!host.endsWith(`.${SUBDOMAIN_BASE}`)) return null;

  const slug = host.slice(0, -(`.${SUBDOMAIN_BASE}`.length));
  return slug || null;
}

// ---------------------------------------------------------------------------
// Main resolver
// ---------------------------------------------------------------------------

/**
 * Resolve the incoming request hostname to an OrgContext.
 * Returns null if no org matches (direct access / unknown hostname).
 *
 * Resolution order:
 * 1. Check Redis cache
 * 2. Exact match on verified custom domain
 * 3. Subdomain match on {slug}.localvector.ai
 * 4. Return null (no org context)
 */
export async function resolveOrgFromHostname(
  hostname: string,
  supabase: SupabaseClient<Database>,
): Promise<OrgContext | null> {
  const host = hostname.split(':')[0];

  // Skip localhost / direct access patterns
  if (host === 'localhost' || host === '127.0.0.1') return null;
  // Skip the bare app domain and menu subdomain (handled elsewhere)
  if (host === SUBDOMAIN_BASE || host === `app.${SUBDOMAIN_BASE}`) return null;
  if (host.startsWith('menu.')) return null;

  // 1. Try Redis cache
  const cached = await getCachedContext(host);
  if (cached !== undefined) return cached;

  // 2. Try verified custom domain match
  const customResult = await lookupCustomDomain(supabase, host);
  if (customResult) {
    await cacheContext(host, customResult);
    return customResult;
  }

  // 3. Try subdomain match
  const slug = extractSubdomain(host);
  if (slug) {
    const subdomainResult = await lookupBySlug(supabase, slug, host);
    if (subdomainResult) {
      await cacheContext(host, subdomainResult);
      return subdomainResult;
    }
  }

  // 4. No match — cache the miss to avoid repeated DB lookups
  await cacheContext(host, null);
  return null;
}

// ---------------------------------------------------------------------------
// DB lookups
// ---------------------------------------------------------------------------

async function lookupCustomDomain(
  supabase: SupabaseClient<Database>,
  hostname: string,
): Promise<OrgContext | null> {
  const { data } = await supabase
    .from('org_domains')
    .select('org_id')
    .eq('domain_value', hostname)
    .eq('domain_type', 'custom')
    .eq('verification_status', 'verified')
    .limit(1)
    .single();

  if (!data) return null;

  const orgId = (data as unknown as { org_id: string }).org_id;
  return fetchOrgContext(supabase, orgId, hostname, true);
}

async function lookupBySlug(
  supabase: SupabaseClient<Database>,
  slug: string,
  hostname: string,
): Promise<OrgContext | null> {
  const { data } = await supabase
    .from('organizations')
    .select('id, name, plan')
    .eq('slug', slug)
    .limit(1)
    .single();

  if (!data) return null;

  const org = data as unknown as { id: string; name: string; plan: string };
  return {
    org_id: org.id,
    org_name: org.name,
    plan_tier: org.plan ?? 'trial',
    resolved_hostname: hostname,
    is_custom_domain: false,
  };
}

async function fetchOrgContext(
  supabase: SupabaseClient<Database>,
  orgId: string,
  hostname: string,
  isCustomDomain: boolean,
): Promise<OrgContext | null> {
  const { data } = await supabase
    .from('organizations')
    .select('id, name, plan')
    .eq('id', orgId)
    .single();

  if (!data) return null;

  const org = data as unknown as { id: string; name: string; plan: string };
  return {
    org_id: org.id,
    org_name: org.name,
    plan_tier: org.plan ?? 'trial',
    resolved_hostname: hostname,
    is_custom_domain: isCustomDomain,
  };
}

// ---------------------------------------------------------------------------
// Redis cache (graceful — never blocks on failure)
// ---------------------------------------------------------------------------

async function getCachedContext(hostname: string): Promise<OrgContext | null | undefined> {
  try {
    const { getRedis } = await import('@/lib/redis');
    const redis = getRedis();
    const raw = await redis.get<string>(`${CACHE_PREFIX}${hostname}`);
    if (raw === null || raw === undefined) return undefined; // cache miss
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (parsed === null) return null; // cached miss
    return parsed as OrgContext;
  } catch (_err) {
    // Redis unavailable — fall through to DB
    return undefined;
  }
}

async function cacheContext(hostname: string, ctx: OrgContext | null): Promise<void> {
  try {
    const { getRedis } = await import('@/lib/redis');
    const redis = getRedis();
    await redis.set(`${CACHE_PREFIX}${hostname}`, JSON.stringify(ctx), { ex: CACHE_TTL_SECONDS });
  } catch (_err) {
    // Redis unavailable — silently skip caching
  }
}

/**
 * Invalidate cached domain resolution. Called when domain config changes.
 */
export async function invalidateDomainCache(hostname: string): Promise<void> {
  try {
    const { getRedis } = await import('@/lib/redis');
    const redis = getRedis();
    await redis.del(`${CACHE_PREFIX}${hostname}`);
  } catch (_err) {
    // Redis unavailable — skip
  }
}
