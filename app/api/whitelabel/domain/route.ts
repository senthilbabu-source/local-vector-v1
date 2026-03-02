/**
 * GET/POST/DELETE /api/whitelabel/domain — Sprint 114
 *
 * GET:    Returns current DomainConfig for the authenticated user's org.
 * POST:   Saves/updates the custom domain (owner only, Agency plan).
 * DELETE:  Removes the custom domain (owner only, Agency plan).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSafeAuthContext } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { roleSatisfies } from '@/lib/auth/org-roles';
import { canManageTeamSeats } from '@/lib/plan-enforcer';
import type { PlanTier } from '@/lib/plan-enforcer';
import {
  getDomainConfig,
  upsertCustomDomain,
  removeCustomDomain,
  DomainError,
} from '@/lib/whitelabel/domain-service';
import { invalidateDomainCache } from '@/lib/whitelabel/domain-resolver';
import type { DnsInstructions } from '@/lib/whitelabel/types';
import { SUBDOMAIN_BASE } from '@/lib/whitelabel/types';
import * as Sentry from '@sentry/nextjs';

export const dynamic = 'force-dynamic';

// ── GET: fetch domain config ────────────────────────────────────────────────

export async function GET() {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const planTier = (ctx.plan ?? 'trial') as PlanTier;
  if (!canManageTeamSeats(planTier)) {
    return NextResponse.json({ domain_config: null, upgrade_required: true });
  }

  try {
    const supabase = createServiceRoleClient();
    const config = await getDomainConfig(supabase, ctx.orgId);
    return NextResponse.json({ domain_config: config, upgrade_required: false });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'whitelabel-domain-get', sprint: '114' } });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

// ── POST: save/update custom domain ─────────────────────────────────────────

export async function POST(request: NextRequest) {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  if (!roleSatisfies(ctx.role, 'owner')) {
    return NextResponse.json({ error: 'not_owner' }, { status: 403 });
  }

  const planTier = (ctx.plan ?? 'trial') as PlanTier;
  if (!canManageTeamSeats(planTier)) {
    return NextResponse.json({ error: 'plan_upgrade_required' }, { status: 403 });
  }

  let body: { custom_domain?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const customDomain = body.custom_domain?.trim();
  if (!customDomain) {
    return NextResponse.json({ error: 'missing_custom_domain' }, { status: 400 });
  }

  // Block LocalVector subdomains
  if (customDomain.endsWith(`.${SUBDOMAIN_BASE}`)) {
    return NextResponse.json({ error: 'localvector_domain_not_allowed' }, { status: 400 });
  }

  try {
    const supabase = createServiceRoleClient();
    const domain = await upsertCustomDomain(supabase, ctx.orgId, customDomain);

    // Build DNS instructions
    const dnsInstructions: DnsInstructions = {
      cname_record: {
        type: 'CNAME',
        name: customDomain,
        value: `proxy.${SUBDOMAIN_BASE}`,
      },
      txt_record: {
        type: 'TXT',
        name: customDomain,
        value: domain.verification_token,
      },
      instructions: [
        'Log in to your DNS provider (e.g. Cloudflare, GoDaddy, Namecheap).',
        `Add a CNAME record pointing ${customDomain} to proxy.${SUBDOMAIN_BASE}.`,
        `Add a TXT record for ${customDomain} with value: ${domain.verification_token}`,
        'Wait for DNS propagation (usually 5-30 minutes, up to 48 hours).',
        'Click "Verify Now" to check your DNS configuration.',
      ],
    };

    return NextResponse.json({ ok: true, domain, dns_instructions: dnsInstructions });
  } catch (err) {
    if (err instanceof DomainError) {
      const status = err.code === 'domain_taken' ? 409 : 400;
      return NextResponse.json({ error: err.code }, { status });
    }
    Sentry.captureException(err, { tags: { route: 'whitelabel-domain-post', sprint: '114' } });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

// ── DELETE: remove custom domain ────────────────────────────────────────────

export async function DELETE() {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  if (!roleSatisfies(ctx.role, 'owner')) {
    return NextResponse.json({ error: 'not_owner' }, { status: 403 });
  }

  const planTier = (ctx.plan ?? 'trial') as PlanTier;
  if (!canManageTeamSeats(planTier)) {
    return NextResponse.json({ error: 'plan_upgrade_required' }, { status: 403 });
  }

  try {
    const supabase = createServiceRoleClient();

    // Get old domain before removing (for cache invalidation)
    const config = await getDomainConfig(supabase, ctx.orgId);
    const oldDomainValue = config.custom_domain?.domain_value;

    await removeCustomDomain(supabase, ctx.orgId);

    // Invalidate cache for old domain
    if (oldDomainValue) {
      void invalidateDomainCache(oldDomainValue);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'whitelabel-domain-delete', sprint: '114' } });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
