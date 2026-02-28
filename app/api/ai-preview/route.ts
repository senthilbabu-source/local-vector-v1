// ---------------------------------------------------------------------------
// app/api/ai-preview/route.ts — Sprint F (N2): On-Demand AI Answer Preview
//
// POST endpoint that fires 3 model queries in parallel and streams results
// back as Server-Sent Events (SSE). Costs 1 credit per composite run.
//
// Auth: getSafeAuthContext() — org_id derived server-side (AI_RULES §4).
// Credits: checkCredit() before, consumeCredit() after (Sprint D pattern).
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { checkCredit, consumeCredit } from '@/lib/credits/credit-service';
import { queryOpenAI, queryPerplexity, queryGemini } from '@/lib/ai-preview/model-queries';
import * as Sentry from '@sentry/nextjs';

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  // ── Credit check (before any model call) ──────────────────────────────────
  const creditCheck = await checkCredit(ctx.orgId);
  if (!creditCheck.ok && creditCheck.reason === 'insufficient_credits') {
    return NextResponse.json(
      {
        error: 'credit_limit_reached',
        creditsUsed: creditCheck.creditsUsed,
        creditsLimit: creditCheck.creditsLimit,
      },
      { status: 402 },
    );
  }

  // ── Validate query ────────────────────────────────────────────────────────
  let body: { query?: string };
  try {
    body = await req.json();
  } catch (err) {
    Sentry.captureException(err, {
      tags: { route: 'ai-preview', action: 'parse-body', sprint: 'K' },
    });
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const query = body.query?.trim() ?? '';
  if (query.length < 3) {
    return NextResponse.json({ error: 'invalid_query', minLength: 3 }, { status: 400 });
  }
  if (query.length > 200) {
    return NextResponse.json({ error: 'query_too_long', maxLength: 200 }, { status: 400 });
  }

  // ── Fetch org context for system prompt ───────────────────────────────────
  const supabase = await createClient();
  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', ctx.orgId)
    .single();

  const businessContext = org?.name
    ? `The user's business is "${org.name}". They want to know if and how AI models mention their business.`
    : '';

  // ── Stream SSE response ───────────────────────────────────────────────────
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      try {
        // Fire all 3 model calls in parallel — results arrive as each completes
        await Promise.allSettled([
          queryOpenAI(query, businessContext).then((result) =>
            send({ model: 'chatgpt', ...result }),
          ),
          queryPerplexity(query, businessContext).then((result) =>
            send({ model: 'perplexity', ...result }),
          ),
          queryGemini(query, businessContext).then((result) =>
            send({ model: 'gemini', ...result }),
          ),
        ]);

        // Consume 1 credit after all models have responded
        if (creditCheck.ok) {
          await consumeCredit(ctx.orgId!);
        }

        send({ type: 'done' });
      } catch (err) {
        Sentry.captureException(err, {
          tags: { route: 'ai-preview', sprint: 'F' },
          extra: { orgId: ctx.orgId, queryLength: query.length },
        });
        send({ type: 'error', message: 'Preview unavailable — please try again' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
