import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

/**
 * POST /api/internal/crawler-log
 * Internal endpoint — called by proxy.ts middleware when an AI bot is detected.
 * NOT public-facing — secured by x-internal-secret matching CRON_SECRET.
 *
 * Sprint 73 — AI Crawler Analytics.
 */
export async function POST(request: Request) {
  const internalSecret = request.headers.get('x-internal-secret');
  if (internalSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { botType, userAgent, slug } = body;

  if (!botType || !slug) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  // Look up the magic_menu by public_slug
  const { data: menu } = await supabase
    .from('magic_menus')
    .select('id, org_id, location_id')
    .eq('public_slug', slug)
    .eq('is_published', true)
    .maybeSingle();

  if (!menu) {
    return NextResponse.json({ ok: true, logged: false });
  }

  // INSERT into crawler_hits
  const { error } = await supabase.from('crawler_hits').insert({
    org_id: menu.org_id,
    menu_id: menu.id,
    location_id: menu.location_id,
    bot_type: botType,
    user_agent: userAgent ?? null,
  });

  if (error) {
    console.error('[crawler-log] INSERT failed:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, logged: true });
}
