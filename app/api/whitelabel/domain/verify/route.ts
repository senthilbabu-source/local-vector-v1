/**
 * POST /api/whitelabel/domain/verify — Sprint 114
 *
 * Triggers a DNS verification check for the org's custom domain.
 * Auth: session required. Owner only. Agency plan only.
 */

import { NextResponse } from 'next/server';
import { getSafeAuthContext } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { roleSatisfies } from '@/lib/auth/org-roles';
import { canManageTeamSeats } from '@/lib/plan-enforcer';
import type { PlanTier } from '@/lib/plan-enforcer';
import { getDomainConfig, updateVerificationStatus } from '@/lib/whitelabel/domain-service';
import { verifyCustomDomain } from '@/lib/whitelabel/dns-verifier';
import { invalidateDomainCache } from '@/lib/whitelabel/domain-resolver';
import * as Sentry from '@sentry/nextjs';

export const dynamic = 'force-dynamic';

export async function POST() {
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

    // Fetch current custom domain config
    const config = await getDomainConfig(supabase, ctx.orgId);
    if (!config.custom_domain) {
      return NextResponse.json({ error: 'no_custom_domain' }, { status: 404 });
    }

    // If already verified, return early
    if (config.custom_domain.verification_status === 'verified') {
      return NextResponse.json({
        verified: true,
        status: 'verified',
        checked_at: config.custom_domain.verified_at,
        error: null,
      });
    }

    // Set status to 'pending' (loading state in UI)
    await updateVerificationStatus(supabase, ctx.orgId, {
      verified: false,
      status: 'pending',
      checked_at: new Date().toISOString(),
      error: null,
    });

    // Run DNS verification check
    const result = await verifyCustomDomain(
      config.custom_domain.domain_value,
      config.custom_domain.verification_token,
    );

    // Update verification status
    await updateVerificationStatus(supabase, ctx.orgId, result);

    // Invalidate Redis cache when domain becomes verified
    if (result.verified) {
      void invalidateDomainCache(config.custom_domain.domain_value);
    }

    return NextResponse.json(result);
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'whitelabel-domain-verify', sprint: '114' } });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
