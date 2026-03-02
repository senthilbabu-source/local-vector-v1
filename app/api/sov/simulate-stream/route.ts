// ---------------------------------------------------------------------------
// app/api/sov/simulate-stream/route.ts — Sprint 120
//
// POST endpoint that streams a simulated AI answer for a target query.
// Shows what an AI assistant would naturally say if asked the query.
//
// Auth: getSafeAuthContext() — org_id derived server-side.
// Model: claude-3-5-haiku-20241022 (fast + cheap).
//
// NOTE: The system prompt does NOT instruct the AI to mention the org.
// We want to see what it naturally says to measure organic visibility.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { streamText } from 'ai';
import { getSafeAuthContext } from '@/lib/auth';
import { getModel } from '@/lib/ai/providers';
import { createSSEResponse } from '@/lib/streaming/sse-utils';
import type { SSEChunk } from '@/lib/streaming/types';
import * as Sentry from '@sentry/nextjs';

export const maxDuration = 30;

const SOV_SIMULATION_SYSTEM_PROMPT = `You are a helpful AI assistant answering questions about local businesses. Answer naturally and concisely, as if you were actually responding to this query in a chat interface. If recommending businesses, be specific. Keep your answer to 2-3 short paragraphs.`;

async function* generateSOVSimulation(params: {
  query_text: string;
  location_city?: string;
}): AsyncGenerator<SSEChunk> {
  yield {
    type: 'metadata',
    metadata: { query: params.query_text },
  };

  const userMessage = params.location_city
    ? `${params.query_text} in ${params.location_city}`
    : params.query_text;

  const result = streamText({
    model: getModel('streaming-sov-simulate'),
    system: SOV_SIMULATION_SYSTEM_PROMPT,
    prompt: userMessage,
    maxTokens: 512,
    temperature: 0.7,
  });

  for await (const textPart of result.textStream) {
    if (textPart) {
      yield { type: 'text', text: textPart };
    }
  }

  yield { type: 'done' };
}

export async function POST(req: Request) {
  // Auth
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  // Parse body
  let body: {
    query_text?: string;
    location_city?: string;
    org_name?: string;
  };
  try {
    body = await req.json();
  } catch (err) {
    Sentry.captureException(err, {
      tags: { route: 'sov/simulate-stream', sprint: '120' },
    });
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  // Validate
  const queryText = body.query_text?.trim();
  if (!queryText) {
    return NextResponse.json({ error: 'missing_query' }, { status: 400 });
  }
  if (queryText.length > 300) {
    return NextResponse.json({ error: 'query_too_long' }, { status: 400 });
  }

  return createSSEResponse(
    generateSOVSimulation({
      query_text: queryText,
      location_city: body.location_city,
    }),
  );
}
