import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { RegisterSchema } from '@/lib/schemas/auth';

/**
 * POST /api/auth/register
 *
 * Creates a new user account + organisation in a single atomic sequence:
 *
 *  1. Validate request body (Zod)
 *  2. Create Supabase Auth user via service role (bypasses email confirmation)
 *     → triggers fire:
 *       - on_auth_user_created  → inserts public.users row
 *       - on_user_created       → inserts organizations + memberships rows
 *  3. Retrieve the org created by the trigger
 *  4. PATCH the org name to the supplied `business_name`
 *     (trigger uses email prefix as a placeholder — Doc 09 idempotent signup rule)
 *  5. Return 201 with user_id and org context
 *
 * The caller should immediately POST /api/auth/login to obtain a session cookie.
 */
export async function POST(request: Request): Promise<NextResponse> {
  // 1. Parse and validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { email, password, full_name, business_name } = parsed.data;
  const service = createServiceRoleClient();

  // 2. Create the Auth user — triggers handle public.users + org + membership
  const { data: authData, error: authError } =
    await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

  if (authError || !authData.user) {
    const isDuplicate =
      authError?.message?.toLowerCase().includes('already registered') ||
      authError?.message?.toLowerCase().includes('already exists') ||
      authError?.code === '23505';

    return NextResponse.json(
      { error: isDuplicate ? 'Email already registered' : (authError?.message ?? 'Failed to create user') },
      { status: isDuplicate ? 409 : 500 }
    );
  }

  const authUserId = authData.user.id;

  const db = service;

  /**
   * Atomicity guard: if any step after Auth user creation fails, delete the
   * auth user to prevent an orphaned account that can't be re-registered.
   * The caller receives a 500 and can safely retry the full registration.
   */
  async function rollback(message: string): Promise<NextResponse> {
    await service.auth.admin.deleteUser(authUserId);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // 3. Resolve the public.users row (created by on_auth_user_created trigger)
  const { data: publicUser, error: publicUserError } = await db
    .from('users')
    .select('id')
    .eq('auth_provider_id', authUserId)
    .single() as { data: { id: string } | null; error: unknown };

  if (!publicUser || publicUserError) {
    return rollback('User profile not found after creation — account rolled back. Please try again.');
  }

  // 4. Resolve the org created by on_user_created trigger
  const { data: membership, error: membershipError } = await db
    .from('memberships')
    .select('org_id')
    .eq('user_id', publicUser.id)
    .single() as { data: { org_id: string } | null; error: unknown };

  if (!membership || membershipError) {
    return rollback('Organisation not found after creation — account rolled back. Please try again.');
  }

  // 5. Update the org name to the user-supplied business_name
  //    (trigger placeholder is "<full_name>'s Venue" — Doc 09 idempotent signup rule)
  const { error: updateError } = await db
    .from('organizations')
    .update({ name: business_name })
    .eq('id', membership.org_id) as { data: null; error: unknown };

  if (updateError) {
    return rollback('Failed to set business name — account rolled back. Please try again.');
  }

  return NextResponse.json(
    {
      user_id: authUserId,
      org_id: membership.org_id,
      org_name: business_name,
      message: 'Account created. Please sign in to start your session.',
    },
    { status: 201 }
  );
}
