// ---------------------------------------------------------------------------
// DELETE /api/settings/api-keys/[keyId] — Sprint 121: Revoke API Key
// Auth: owner + agency plan.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSafeAuthContext } from '@/lib/auth';
import { roleSatisfies } from '@/lib/auth/org-roles';
import { revokeApiKey } from '@/lib/settings';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ keyId: string }> },
) {
  const ctx = await getSafeAuthContext();
  if (!ctx || !ctx.orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!roleSatisfies(ctx.role, 'owner')) {
    return NextResponse.json({ error: 'owner_required' }, { status: 403 });
  }

  const { keyId } = await params;

  try {
    const supabase = await createClient();
    await revokeApiKey(supabase, ctx.orgId, keyId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'api_key_not_found') {
      return NextResponse.json({ error: 'api_key_not_found' }, { status: 404 });
    }
    Sentry.captureException(err, { tags: { sprint: '121', route: 'api-key-revoke' } });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
