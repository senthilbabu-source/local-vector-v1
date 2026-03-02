// ---------------------------------------------------------------------------
// POST /api/vaio/preview — Spoken answer preview
//
// No plan gate — available to all plans (client-side analysis tool).
//
// Sprint 109: VAIO
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { getSafeAuthContext } from '@/lib/auth';
import { generateSpokenPreview } from '@/lib/vaio/spoken-answer-previewer';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const ctx = await getSafeAuthContext();
  if (!ctx || !ctx.orgId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { content, content_type } = body;

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    const validTypes = ['faq_page', 'gbp_post', 'faq_answer', 'llms_txt'] as const;
    const type = validTypes.includes(content_type) ? content_type : 'gbp_post';

    // Fetch business context for scoring
    const supabase = await createClient();
    const { data: loc } = await supabase
      .from('locations')
      .select('business_name, city')
      .eq('org_id', ctx.orgId)
      .eq('is_archived', false)
      .limit(1)
      .single();

    const businessName = loc?.business_name ?? 'Business';
    const city = loc?.city ?? '';

    const preview = generateSpokenPreview(content, businessName, city, type);

    return NextResponse.json(preview);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'preview_failed', message: msg }, { status: 500 });
  }
}
