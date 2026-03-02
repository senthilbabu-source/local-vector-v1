// ---------------------------------------------------------------------------
// app/api/content/preview-stream/route.ts — Sprint 120
//
// POST endpoint that streams a content preview for a given prompt using
// Claude Haiku via the Vercel AI SDK. Returns SSE text/event-stream.
//
// Auth: getSafeAuthContext() — org_id derived server-side.
// Model: claude-3-5-haiku-20241022 (fast + cheap for previews).
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { streamText } from 'ai';
import { getSafeAuthContext } from '@/lib/auth';
import { getModel } from '@/lib/ai/providers';
import { createSSEResponse } from '@/lib/streaming/sse-utils';
import type { SSEChunk } from '@/lib/streaming/types';
import * as Sentry from '@sentry/nextjs';

export const maxDuration = 30;

const CONTENT_SYSTEM_PROMPT = `You are an expert content writer for local businesses. Write engaging, SEO-friendly content that is factual and specific. Structure your content with a clear answer-first approach — lead with the most important information. Include natural mentions of the business name and location. Use a warm, professional tone.`;

async function* generateContentPreview(params: {
  target_prompt: string;
  content_type: string;
  max_words: number;
}): AsyncGenerator<SSEChunk> {
  yield {
    type: 'metadata',
    metadata: {
      model: 'claude-3-5-haiku-20241022',
      max_words: params.max_words,
    },
  };

  const result = streamText({
    model: getModel('streaming-preview'),
    system: CONTENT_SYSTEM_PROMPT,
    prompt: `Write approximately ${params.max_words} words of ${params.content_type} content about: ${params.target_prompt}`,
    maxTokens: 1024,
    temperature: 0.7,
  });

  let total_tokens = 0;
  for await (const textPart of result.textStream) {
    if (textPart) {
      yield { type: 'text', text: textPart };
    }
  }

  // Get final usage from the result
  try {
    const usage = await result.usage;
    total_tokens = usage?.completionTokens ?? 0;
  } catch (err) {
    Sentry.captureException(err, {
      tags: { route: 'content/preview-stream', action: 'usage', sprint: '120' },
      level: 'info',
    });
  }

  yield { type: 'done', total_tokens };
}

export async function POST(req: Request) {
  // Auth
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  // Parse body
  let body: {
    target_prompt?: string;
    draft_title?: string;
    content_type?: string;
    max_words?: number;
  };
  try {
    body = await req.json();
  } catch (err) {
    Sentry.captureException(err, {
      tags: { route: 'content/preview-stream', sprint: '120' },
    });
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  // Validate
  const targetPrompt = body.target_prompt?.trim();
  if (!targetPrompt) {
    return NextResponse.json({ error: 'missing_prompt' }, { status: 400 });
  }
  if (targetPrompt.length > 500) {
    return NextResponse.json({ error: 'prompt_too_long' }, { status: 400 });
  }

  const contentType = body.content_type || 'blog_post';
  const maxWords = Math.min(body.max_words ?? 300, 500);

  // Build prompt with optional title context
  let fullPrompt = targetPrompt;
  if (body.draft_title) {
    fullPrompt = `Title: "${body.draft_title}"\nTopic: ${targetPrompt}`;
  }

  return createSSEResponse(
    generateContentPreview({
      target_prompt: fullPrompt,
      content_type: contentType,
      max_words: maxWords,
    }),
  );
}
