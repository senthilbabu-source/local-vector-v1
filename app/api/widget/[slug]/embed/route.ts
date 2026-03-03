// ---------------------------------------------------------------------------
// app/api/widget/[slug]/embed/route.ts — Widget Embed Script (Sprint 133)
//
// GET /api/widget/[slug]/embed
// Returns JavaScript that injects a chat widget iframe into the host page.
// Validates: slug must exist + widget_enabled = true, else returns empty script.
//
// Cache-Control: max-age=3600 (1 hour)
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const headers = {
    'Content-Type': 'application/javascript; charset=utf-8',
    'Cache-Control': 'public, max-age=3600',
    'Access-Control-Allow-Origin': '*',
  };

  // ── Validate slug + widget enabled ──────────────────────────────────
  const supabase = createServiceRoleClient();

  const { data: menu } = await supabase
    .from('magic_menus')
    .select('location_id')
    .eq('public_slug', slug)
    .eq('is_published', true)
    .single();

  if (!menu?.location_id) {
    return new NextResponse(
      '/* LocalVector widget: menu not found */',
      { headers },
    );
  }

  const { data: location } = await (supabase
    .from('locations') as any)
    .select('widget_enabled, widget_settings')
    .eq('id', menu.location_id)
    .single() as { data: { widget_enabled: boolean; widget_settings: Record<string, unknown> | null } | null };

  if (!location?.widget_enabled) {
    return new NextResponse(
      '/* LocalVector widget: not enabled */',
      { headers },
    );
  }

  // ── Build embed script ────────────────────────────────────────────
  const settings = (location.widget_settings ?? {}) as {
    color?: string;
    position?: string;
    greeting?: string;
  };
  const color = settings.color ?? '#6366f1';
  const position = settings.position ?? 'bottom-right';
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://localvector.ai';
  const iframeSrc = `${appUrl}/widget/${encodeURIComponent(slug)}`;

  const positionStyles =
    position === 'bottom-left'
      ? 'left:20px;right:auto;'
      : 'right:20px;left:auto;';

  const script = `(function(){
  if(document.getElementById('lv-widget-frame'))return;

  var btn=document.createElement('div');
  btn.id='lv-widget-btn';
  btn.style.cssText='position:fixed;bottom:20px;${positionStyles}z-index:999999;width:56px;height:56px;border-radius:50%;background:${color};cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.15);transition:transform 0.2s;';
  btn.innerHTML='<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
  btn.onmouseenter=function(){btn.style.transform='scale(1.1)';};
  btn.onmouseleave=function(){btn.style.transform='scale(1)';};
  document.body.appendChild(btn);

  var frame=document.createElement('iframe');
  frame.id='lv-widget-frame';
  frame.src='${iframeSrc}';
  frame.style.cssText='position:fixed;bottom:90px;${positionStyles}z-index:999998;width:380px;height:520px;border:none;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.2);display:none;';
  frame.setAttribute('allow','clipboard-write');
  document.body.appendChild(frame);

  var open=false;
  btn.onclick=function(){
    open=!open;
    frame.style.display=open?'block':'none';
    btn.innerHTML=open?'<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>':'<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
  };
})();`;

  return new NextResponse(script, { headers });
}
