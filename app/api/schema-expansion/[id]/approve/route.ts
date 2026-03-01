// ---------------------------------------------------------------------------
// POST /api/schema-expansion/:id/approve — Approve a pending_review schema
//
// Sprint 106: Human-in-the-loop approval for AI-generated schemas.
// After approval, publishes the schema and pings IndexNow.
//
// Auth: User session (getSafeAuthContext)
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { generateEmbedSnippet } from '@/lib/schema-expansion/schema-host';
import { pingIndexNow } from '@/lib/indexnow';
import type { PageType } from '@/lib/schema-expansion/types';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // 1. Auth guard
  const ctx = await getSafeAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const supabase = await createClient();

    // 2. Fetch the schema record — verify org ownership via RLS
    const { data: schema, error: fetchError } = await supabase
      .from('page_schemas')
      .select('id, status, json_ld, page_type, page_url, location_id')
      .eq('id', id)
      .single();

    if (fetchError || !schema) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    if (schema.status === 'published') {
      return NextResponse.json({ error: 'already_published' }, { status: 409 });
    }

    // 3. Fetch location slug for public URL
    const { data: location } = await supabase
      .from('locations')
      .select('website_slug')
      .eq('id', schema.location_id)
      .single();

    const slug = location?.website_slug ?? 'unknown';
    const pageType = schema.page_type as PageType;
    const jsonLd = schema.json_ld as unknown as Record<string, unknown>[];
    const embedSnippet = generateEmbedSnippet(jsonLd, pageType);
    const publicUrl = `https://schema.localvector.ai/${slug}/${pageType}/embed.html`;

    // 4. Update to published
    const { error: updateError } = await supabase
      .from('page_schemas')
      .update({
        status: 'published',
        human_approved: true,
        published_at: new Date().toISOString(),
        embed_snippet: embedSnippet,
        public_url: publicUrl,
      })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: 'publish_failed', message: updateError.message }, { status: 500 });
    }

    // 5. Ping IndexNow
    pingIndexNow([schema.page_url]).catch((err) => {
      Sentry.captureException(err, { tags: { component: 'indexnow', sprint: '106' } });
    });

    return NextResponse.json({ ok: true, public_url: publicUrl });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { route: 'schema-expansion-approve', sprint: '106' },
    });
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'publish_failed', message: msg }, { status: 500 });
  }
}
