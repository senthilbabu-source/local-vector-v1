import { NextResponse } from 'next/server';
import { getSafeAuthContext } from '@/lib/auth';

/**
 * GET /api/v1/auth/context
 *
 * Lightweight session-bootstrap endpoint used by the app shell on every mount
 * and by the Onboarding Guard (Doc 06 §3) to poll until the org is ready.
 *
 * Response shape is defined in Doc 05 §1.1.
 *
 * - Returns 200 with org fields populated once the handle_new_user trigger
 *   has created the organization and membership rows.
 * - Returns 200 with org fields null while the trigger is still pending.
 * - Returns 401 if the user is not authenticated.
 */
export async function GET(): Promise<NextResponse> {
  const ctx = await getSafeAuthContext();

  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Org exists — return full context (Doc 05 §1.1 "org exists" shape)
  if (ctx.orgId !== null) {
    return NextResponse.json({
      user_id: ctx.userId,
      email: ctx.email,
      org_id: ctx.orgId,
      org_name: ctx.orgName,
      role: ctx.role,
      plan: ctx.plan,
      onboarding_completed: ctx.onboarding_completed,
    });
  }

  // Org not yet created — trigger still pending (Doc 05 §1.1 "trigger pending" shape)
  return NextResponse.json({
    user_id: ctx.userId,
    email: ctx.email,
    org_id: null,
    org_name: null,
    role: null,
    plan: null,
    onboarding_completed: false,
  });
}
