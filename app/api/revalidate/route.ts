// ---------------------------------------------------------------------------
// POST /api/revalidate — On-demand cache revalidation (Sprint 118)
//
// Server-to-server. Protected by REVALIDATE_SECRET (not user session).
// Revalidates the ISR cache for /m/[slug] menu pages by tag.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { createServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface RevalidateBody {
  slug?: string;
  org_id?: string;
  secret: string;
}

export async function POST(request: NextRequest) {
  let body: RevalidateBody;
  try {
    body = await request.json();
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  // Auth: REVALIDATE_SECRET
  if (!body.secret || body.secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Must provide slug or org_id
  if (!body.slug && !body.org_id) {
    return NextResponse.json(
      { error: 'bad_request', message: 'Provide slug or org_id' },
      { status: 400 },
    );
  }

  let slug = body.slug;

  // Resolve slug from org_id if needed
  if (!slug && body.org_id) {
    const supabase = createServiceRoleClient();
    const { data: org } = await supabase
      .from('organizations')
      .select('slug')
      .eq('id', body.org_id)
      .single();

    if (!org?.slug) {
      return NextResponse.json(
        { error: 'not_found', message: 'No org found for org_id' },
        { status: 404 },
      );
    }
    slug = org.slug;
  }

  revalidateTag(`menu-${slug}`, { expire: 0 });

  return NextResponse.json({
    ok: true,
    revalidated: slug,
    timestamp: new Date().toISOString(),
  });
}
