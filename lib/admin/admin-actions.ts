'use server';

// ---------------------------------------------------------------------------
// lib/admin/admin-actions.ts — Sprint §204 (Admin Write Operations)
//
// Server actions for admin write operations. Each action:
//   1. Asserts caller is admin (ADMIN_EMAILS guard)
//   2. Performs the operation via service-role Supabase
//   3. Logs to admin_audit_log
//   4. Returns { success, error? }
//
// Actions: adminOverridePlan, adminCancelSubscription, adminForceCronRun,
//          adminStartImpersonation, adminStopImpersonation, adminGrantCredits
// ---------------------------------------------------------------------------

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import Stripe from 'stripe';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getCreditLimit } from '@/lib/credits/credit-limits';
import { assertAdmin, logAdminAction } from './admin-guard';
import { isKnownCron } from './known-crons';
import * as Sentry from '@sentry/nextjs';
import type { Database } from '@/lib/supabase/database.types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ActionResult = { success: true } | { success: false; error: string };

const VALID_PLANS: Database['public']['Enums']['plan_tier'][] = [
  'trial',
  'starter',
  'growth',
  'agency',
];

// ---------------------------------------------------------------------------
// Lazy Stripe client (reuse pattern from webhook route)
// ---------------------------------------------------------------------------

let _stripe: Stripe | null = null;
function getStripe(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}

// ---------------------------------------------------------------------------
// 1. adminOverridePlan
// ---------------------------------------------------------------------------

/**
 * Override an org's plan tier (bypasses Stripe sync).
 * Also syncs api_credits limit to match the new plan.
 */
export async function adminOverridePlan(
  orgId: string,
  newPlan: string,
  reason: string,
): Promise<ActionResult> {
  try {
    const admin = await assertAdmin();

    if (!VALID_PLANS.includes(newPlan as Database['public']['Enums']['plan_tier'])) {
      return { success: false, error: `Invalid plan: ${newPlan}. Must be one of: ${VALID_PLANS.join(', ')}` };
    }

    const supabase = createServiceRoleClient();

    // Fetch current plan for logging
    const { data: org } = await supabase
      .from('organizations')
      .select('plan')
      .eq('id', orgId)
      .single();

    if (!org) {
      return { success: false, error: 'Organization not found' };
    }

    const oldPlan = org.plan;

    // Update organization plan
    const { error: updateErr } = await supabase
      .from('organizations')
      .update({
        plan: newPlan as Database['public']['Enums']['plan_tier'],
        plan_status: 'active',
      })
      .eq('id', orgId);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    // Sync api_credits limit to new plan
    const newLimit = getCreditLimit(newPlan);
    const { data: credits } = await supabase
      .from('api_credits')
      .select('id')
      .eq('org_id', orgId)
      .maybeSingle();

    if (credits) {
      await supabase
        .from('api_credits')
        .update({ credits_limit: newLimit, plan: newPlan })
        .eq('org_id', orgId);
    }

    await logAdminAction(admin.email, 'change_plan', orgId, {
      old_plan: oldPlan,
      new_plan: newPlan,
      reason,
    });

    revalidatePath('/admin/customers');
    revalidatePath(`/admin/customers/${orgId}`);
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'Unauthorized' || msg.startsWith('Forbidden')) {
      return { success: false, error: msg };
    }
    Sentry.captureException(err, {
      tags: { service: 'admin-actions', function: 'adminOverridePlan', sprint: '203' },
    });
    return { success: false, error: msg };
  }
}

// ---------------------------------------------------------------------------
// 2. adminCancelSubscription
// ---------------------------------------------------------------------------

/**
 * Cancel an org's subscription. If they have a Stripe subscription, cancels
 * via Stripe API (webhook handles DB update). Otherwise, directly updates DB.
 */
export async function adminCancelSubscription(
  orgId: string,
  immediate: boolean,
): Promise<ActionResult> {
  try {
    const admin = await assertAdmin();
    const supabase = createServiceRoleClient();

    const { data: org } = await supabase
      .from('organizations')
      .select('stripe_subscription_id, plan, name')
      .eq('id', orgId)
      .single();

    if (!org) {
      return { success: false, error: 'Organization not found' };
    }

    if (org.stripe_subscription_id) {
      // Cancel via Stripe API — webhook will handle DB update
      const stripe = getStripe();
      if (!stripe) {
        return { success: false, error: 'Stripe is not configured (STRIPE_SECRET_KEY missing)' };
      }

      if (immediate) {
        await stripe.subscriptions.cancel(org.stripe_subscription_id);
      } else {
        await stripe.subscriptions.update(org.stripe_subscription_id, {
          cancel_at_period_end: true,
        });
      }
    } else {
      // No Stripe subscription — update DB directly
      await supabase
        .from('organizations')
        .update({
          plan: 'trial',
          plan_status: 'canceled',
          canceled_at: new Date().toISOString(),
          cancellation_reason: 'admin_override',
        })
        .eq('id', orgId);
    }

    await logAdminAction(admin.email, 'cancel_subscription', orgId, {
      immediate,
      had_stripe_sub: !!org.stripe_subscription_id,
      previous_plan: org.plan,
      org_name: org.name,
    });

    revalidatePath('/admin/customers');
    revalidatePath(`/admin/customers/${orgId}`);
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'Unauthorized' || msg.startsWith('Forbidden')) {
      return { success: false, error: msg };
    }
    Sentry.captureException(err, {
      tags: { service: 'admin-actions', function: 'adminCancelSubscription', sprint: '203' },
    });
    return { success: false, error: msg };
  }
}

// ---------------------------------------------------------------------------
// 3. adminForceCronRun
// ---------------------------------------------------------------------------

/**
 * Triggers a cron job by making an HTTP request to its endpoint.
 * Returns the cron's JSON response.
 */
export async function adminForceCronRun(
  cronName: string,
): Promise<ActionResult & { cronResponse?: Record<string, unknown> }> {
  try {
    const admin = await assertAdmin();

    if (!isKnownCron(cronName)) {
      return { success: false, error: `Unknown cron: ${cronName}` };
    }

    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return { success: false, error: 'CRON_SECRET is not configured' };
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const url = `${appUrl}/api/cron/${cronName}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${cronSecret}` },
    });

    let cronResponse: Record<string, unknown> = {};
    try {
      cronResponse = await response.json();
    } catch (parseErr) {
      Sentry.captureException(parseErr, {
        tags: { service: 'admin-actions', function: 'adminForceCronRun', sprint: '203' },
        extra: { cronName, status: response.status },
      });
      cronResponse = { status: response.status, statusText: response.statusText };
    }

    await logAdminAction(admin.email, 'force_cron', null, {
      cron_name: cronName,
      status: response.status,
      response: cronResponse,
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Cron returned ${response.status}: ${JSON.stringify(cronResponse)}`,
        cronResponse,
      };
    }

    revalidatePath('/admin/cron-health');
    return { success: true, cronResponse };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'Unauthorized' || msg.startsWith('Forbidden')) {
      return { success: false, error: msg };
    }
    Sentry.captureException(err, {
      tags: { service: 'admin-actions', function: 'adminForceCronRun', sprint: '203' },
    });
    return { success: false, error: msg };
  }
}

// ---------------------------------------------------------------------------
// 4. adminStartImpersonation
// ---------------------------------------------------------------------------

/**
 * Starts admin impersonation of a target org.
 * Creates a temporary viewer membership and sets cookies.
 */
export async function adminStartImpersonation(
  targetOrgId: string,
): Promise<ActionResult & { redirectTo?: string }> {
  try {
    const admin = await assertAdmin();
    const cookieStore = await cookies();

    // Check for active impersonation
    const existingImpersonation = cookieStore.get('lv_admin_impersonating')?.value;
    if (existingImpersonation) {
      return { success: false, error: 'Already impersonating an org. Stop the current session first.' };
    }

    const supabase = createServiceRoleClient();

    // Verify target org exists
    const { data: targetOrg } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('id', targetOrgId)
      .single();

    if (!targetOrg) {
      return { success: false, error: 'Target organization not found' };
    }

    // Check if admin already has a membership in this org
    const { data: existingMembership } = await supabase
      .from('memberships')
      .select('id')
      .eq('user_id', admin.publicUserId)
      .eq('org_id', targetOrgId)
      .maybeSingle();

    if (!existingMembership) {
      // Create temporary viewer membership
      const { error: membershipErr } = await supabase.from('memberships').insert({
        user_id: admin.publicUserId,
        org_id: targetOrgId,
        role: 'viewer',
      });

      if (membershipErr) {
        return { success: false, error: `Failed to create temporary membership: ${membershipErr.message}` };
      }
    }

    // Get admin's current org (to restore later)
    const { data: adminMembership } = await supabase
      .from('memberships')
      .select('org_id')
      .eq('user_id', admin.publicUserId)
      .neq('org_id', targetOrgId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    // Set cookies
    const cookieOpts = {
      path: '/',
      httpOnly: false, // Client-side banner needs to read this
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 60 * 60 * 4, // 4 hours max
    };

    cookieStore.set('lv_active_org', targetOrgId, cookieOpts);
    cookieStore.set('lv_admin_impersonating', targetOrgId, cookieOpts);
    if (adminMembership) {
      cookieStore.set('lv_admin_original_org', adminMembership.org_id, {
        ...cookieOpts,
        httpOnly: true,
      });
    }

    await logAdminAction(admin.email, 'impersonate', targetOrgId, {
      org_name: targetOrg.name,
      had_existing_membership: !!existingMembership,
    });

    return { success: true, redirectTo: '/dashboard' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'Unauthorized' || msg.startsWith('Forbidden')) {
      return { success: false, error: msg };
    }
    Sentry.captureException(err, {
      tags: { service: 'admin-actions', function: 'adminStartImpersonation', sprint: '203' },
    });
    return { success: false, error: msg };
  }
}

// ---------------------------------------------------------------------------
// 5. adminStopImpersonation
// ---------------------------------------------------------------------------

/**
 * Stops admin impersonation. Removes temporary membership, restores cookies.
 */
export async function adminStopImpersonation(): Promise<
  ActionResult & { redirectTo?: string }
> {
  try {
    const admin = await assertAdmin();
    const cookieStore = await cookies();

    const impersonatedOrgId = cookieStore.get('lv_admin_impersonating')?.value;
    if (!impersonatedOrgId) {
      return { success: false, error: 'No active impersonation session' };
    }

    const supabase = createServiceRoleClient();

    // Delete the temporary membership (only the one we created — viewer role)
    // Use a narrow filter to avoid deleting legitimate memberships
    await supabase
      .from('memberships')
      .delete()
      .eq('user_id', admin.publicUserId)
      .eq('org_id', impersonatedOrgId)
      .eq('role', 'viewer');

    // Restore original org cookie
    const originalOrgId = cookieStore.get('lv_admin_original_org')?.value;

    const cookieOpts = {
      path: '/',
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
    };

    // Clear impersonation cookies
    cookieStore.delete('lv_admin_impersonating');
    cookieStore.delete('lv_admin_original_org');

    // Restore active org
    if (originalOrgId) {
      cookieStore.set('lv_active_org', originalOrgId, cookieOpts);
    } else {
      cookieStore.delete('lv_active_org');
    }

    await logAdminAction(admin.email, 'stop_impersonation', impersonatedOrgId, {
      restored_org_id: originalOrgId ?? null,
    });

    revalidatePath('/dashboard');
    return { success: true, redirectTo: '/admin/customers' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'Unauthorized' || msg.startsWith('Forbidden')) {
      return { success: false, error: msg };
    }
    Sentry.captureException(err, {
      tags: { service: 'admin-actions', function: 'adminStopImpersonation', sprint: '203' },
    });
    return { success: false, error: msg };
  }
}

// ---------------------------------------------------------------------------
// 6. adminGrantCredits
// ---------------------------------------------------------------------------

/**
 * Grants additional credits to an org by increasing their credit limit.
 */
export async function adminGrantCredits(
  orgId: string,
  amount: number,
): Promise<ActionResult> {
  try {
    const admin = await assertAdmin();

    if (!Number.isInteger(amount) || amount <= 0) {
      return { success: false, error: 'Amount must be a positive integer' };
    }

    if (amount > 10000) {
      return { success: false, error: 'Amount exceeds maximum (10,000)' };
    }

    const supabase = createServiceRoleClient();

    // Check org exists
    const { data: org } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('id', orgId)
      .single();

    if (!org) {
      return { success: false, error: 'Organization not found' };
    }

    // Get current credits
    const { data: credits } = await supabase
      .from('api_credits')
      .select('credits_used, credits_limit')
      .eq('org_id', orgId)
      .maybeSingle();

    const currentLimit = credits?.credits_limit ?? 0;
    const newLimit = currentLimit + amount;

    if (credits) {
      // Update existing row
      const { error } = await supabase
        .from('api_credits')
        .update({ credits_limit: newLimit })
        .eq('org_id', orgId);

      if (error) {
        return { success: false, error: error.message };
      }
    } else {
      // Credits row doesn't exist — create it
      const { data: orgPlan } = await supabase
        .from('organizations')
        .select('plan')
        .eq('id', orgId)
        .single();

      const baseLimit = getCreditLimit(orgPlan?.plan);
      const { error } = await supabase.from('api_credits').insert({
        org_id: orgId,
        plan: orgPlan?.plan ?? 'trial',
        credits_used: 0,
        credits_limit: baseLimit + amount,
        reset_date: new Date(
          Date.UTC(
            new Date().getUTCFullYear(),
            new Date().getUTCMonth() + 1,
            1,
          ),
        ).toISOString(),
      });

      if (error) {
        return { success: false, error: error.message };
      }
    }

    // Log to credit_usage_log
    await supabase.from('credit_usage_log').insert({
      org_id: orgId,
      operation: 'admin_grant',
      credits_used: 0,
      credits_before: currentLimit,
      credits_after: newLimit,
      reference_id: `admin:${admin.email}`,
    });

    await logAdminAction(admin.email, 'grant_credits', orgId, {
      amount,
      previous_limit: currentLimit,
      new_limit: newLimit,
      org_name: org.name,
    });

    revalidatePath('/admin/customers');
    revalidatePath(`/admin/customers/${orgId}`);
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'Unauthorized' || msg.startsWith('Forbidden')) {
      return { success: false, error: msg };
    }
    Sentry.captureException(err, {
      tags: { service: 'admin-actions', function: 'adminGrantCredits', sprint: '203' },
    });
    return { success: false, error: msg };
  }
}
