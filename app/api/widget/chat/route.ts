// ---------------------------------------------------------------------------
// app/api/widget/chat/route.ts — RAG Widget Chat Endpoint (Sprint 133)
//
// POST /api/widget/chat
// Public endpoint — called by widget iframe. No auth required.
//
// Security rules (AI_RULES §166):
//   - Log question category ONLY (not text)
//   - Reject questions > 500 chars
//   - widget_enabled must be true; 403 otherwise
//   - Validate slug exists before building context
//
// Rate limiting:
//   - Per-IP: 20 req/hr
//   - Per-location-day: 100 (Growth) / 500 (Agency) via widget_settings.daily_limit
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit/rate-limiter';
import { buildRAGContext } from '@/lib/rag/rag-context-builder';
import { answerQuestion } from '@/lib/rag/rag-responder';
import * as Sentry from '@sentry/nextjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_QUESTION_LENGTH = 500;

export async function POST(request: Request) {
  try {
    // ── Parse body ──────────────────────────────────────────────────────
    let body: { slug?: string; question?: string };
    try {
      body = await request.json();
    } catch (err) {
      Sentry.captureException(err, { tags: { route: 'widget-chat', phase: 'parse-body' } });
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { slug, question } = body;
    if (!slug || typeof slug !== 'string') {
      return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
    }
    if (!question || typeof question !== 'string') {
      return NextResponse.json(
        { error: 'Missing question' },
        { status: 400 },
      );
    }
    if (question.length > MAX_QUESTION_LENGTH) {
      return NextResponse.json(
        { error: `Question exceeds ${MAX_QUESTION_LENGTH} characters` },
        { status: 400 },
      );
    }

    // ── Rate limit: per-IP ──────────────────────────────────────────────
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      'unknown';

    const ipLimit = await checkRateLimit(
      { max_requests: 20, window_seconds: 3600, key_prefix: 'widget-ip' },
      ip,
    );
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429, headers: getRateLimitHeaders(ipLimit) },
      );
    }

    // ── Resolve slug to location ────────────────────────────────────────
    const supabase = createServiceRoleClient();

    const { data: menu } = await supabase
      .from('magic_menus')
      .select('id, location_id, org_id')
      .eq('public_slug', slug)
      .eq('is_published', true)
      .single();

    if (!menu?.location_id) {
      return NextResponse.json(
        { error: 'Widget not found' },
        { status: 404 },
      );
    }

    // ── Check widget_enabled ────────────────────────────────────────────
    const { data: location } = await (supabase
      .from('locations') as any)
      .select('widget_enabled, widget_settings')
      .eq('id', menu.location_id)
      .single() as { data: { widget_enabled: boolean; widget_settings: Record<string, unknown> | null } | null };

    if (!location?.widget_enabled) {
      return NextResponse.json(
        { error: 'Widget not enabled' },
        { status: 403 },
      );
    }

    // ── Rate limit: per-location daily ──────────────────────────────────
    const dailyLimit =
      (location.widget_settings as { daily_limit?: number } | null)
        ?.daily_limit ?? 100;
    const locLimit = await checkRateLimit(
      {
        max_requests: dailyLimit,
        window_seconds: 86400,
        key_prefix: 'widget-loc',
      },
      menu.location_id,
    );
    if (!locLimit.allowed) {
      return NextResponse.json(
        { error: 'Daily question limit reached' },
        { status: 429, headers: getRateLimitHeaders(locLimit) },
      );
    }

    // ── Build RAG context & answer ──────────────────────────────────────
    const ragContext = await buildRAGContext(menu.location_id, supabase);
    if (!ragContext) {
      return NextResponse.json(
        { error: 'Unable to build context' },
        { status: 500 },
      );
    }

    const result = await answerQuestion(question, ragContext);

    return NextResponse.json(
      { answer: result.answer, confidence: result.confidence },
      {
        headers: {
          ...getRateLimitHeaders(ipLimit),
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      },
    );
  } catch (err) {
    Sentry.captureException(err, {
      tags: { route: 'widget-chat', sprint: '133' },
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

/**
 * CORS preflight support for cross-origin widget embedding.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}
