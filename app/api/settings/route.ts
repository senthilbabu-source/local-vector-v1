// ---------------------------------------------------------------------------
// GET + PUT /api/settings — Sprint 121: Org Settings
// GET: any org member. PUT: owner | admin.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSafeAuthContext } from '@/lib/auth';
import { roleSatisfies } from '@/lib/auth/org-roles';
import { getOrCreateOrgSettings, updateOrgSettings } from '@/lib/settings';
import type { OrgSettingsUpdate } from '@/lib/settings/types';

export async function GET() {
  const ctx = await getSafeAuthContext();
  if (!ctx || !ctx.orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = await createClient();
    const settings = await getOrCreateOrgSettings(supabase, ctx.orgId);
    return NextResponse.json(settings);
  } catch (err) {
    Sentry.captureException(err, { tags: { sprint: '121', route: 'settings-get' } });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const ctx = await getSafeAuthContext();
  if (!ctx || !ctx.orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!roleSatisfies(ctx.role, 'admin')) {
    return NextResponse.json({ error: 'insufficient_role' }, { status: 403 });
  }

  let body: OrgSettingsUpdate;
  try {
    body = await request.json();
  } catch (_err) {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const updated = await updateOrgSettings(supabase, ctx.orgId, body);
    return NextResponse.json(updated);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith('invalid_')) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    Sentry.captureException(err, { tags: { sprint: '121', route: 'settings-put' } });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
