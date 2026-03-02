// ---------------------------------------------------------------------------
// GET + POST /api/settings/api-keys — Sprint 121: Agency API Key Management
// GET: owner + agency plan. POST: owner + agency plan.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSafeAuthContext } from '@/lib/auth';
import { roleSatisfies } from '@/lib/auth/org-roles';
import { generateApiKey, listApiKeys } from '@/lib/settings';

export async function GET() {
  const ctx = await getSafeAuthContext();
  if (!ctx || !ctx.orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!roleSatisfies(ctx.role, 'owner')) {
    return NextResponse.json({ error: 'owner_required' }, { status: 403 });
  }

  try {
    const supabase = await createClient();
    const keys = await listApiKeys(supabase, ctx.orgId);
    return NextResponse.json({ keys });
  } catch (err) {
    Sentry.captureException(err, { tags: { sprint: '121', route: 'api-keys-get' } });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getSafeAuthContext();
  if (!ctx || !ctx.orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!roleSatisfies(ctx.role, 'owner')) {
    return NextResponse.json({ error: 'owner_required' }, { status: 403 });
  }

  let body: { name?: string };
  try {
    body = await request.json();
  } catch (_err) {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!body.name || body.name.trim().length === 0) {
    return NextResponse.json({ error: 'missing_name' }, { status: 400 });
  }

  if (body.name.length > 100) {
    return NextResponse.json({ error: 'name_too_long' }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const result = await generateApiKey(
      supabase,
      ctx.orgId,
      ctx.userId,
      body.name.trim(),
      ctx.plan ?? 'trial',
    );

    return NextResponse.json({
      ...result,
      warning: 'Copy this key now. It will not be shown again.',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'agency_required') {
      return NextResponse.json({ error: 'agency_required' }, { status: 403 });
    }
    Sentry.captureException(err, { tags: { sprint: '121', route: 'api-keys-post' } });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
