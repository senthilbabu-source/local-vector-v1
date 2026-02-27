// ---------------------------------------------------------------------------
// app/api/chat/route.ts — AI Assistant Chat Endpoint
//
// Surgery 6: Streaming chat with tool calls that return structured data.
// The client renders tool results as rich UI cards (SOV charts, alert lists).
//
// Flow:
//   1. Authenticate via getSafeAuthContext() → orgId
//   2. Rate limit check (20 req/hr/org) via Upstash sliding window
//   3. Build org-scoped tools via makeVisibilityTools(orgId)
//   4. streamText() with GPT-4o + tools → streaming response
//   5. Client receives text chunks + tool call results
//
// Rate limiting (FIX-4):
//   - Upstash sliding window: 20 requests/hour/org
//   - Key: chat:{orgId} (per-org, not per-user)
//   - Fail-open: if Redis is unavailable, allow the request through
//   - 429 response with retry_after + X-RateLimit-* headers
//
// Spec: Surgical Integration Plan §Surgery 6
// ---------------------------------------------------------------------------

import { streamText } from 'ai';
import { getModel } from '@/lib/ai/providers';
import { getSafeAuthContext } from '@/lib/auth';
import { makeVisibilityTools } from '@/lib/tools/visibility-tools';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export const maxDuration = 30;

// ── Rate limiter (module-level for connection reuse) ──────────────────────
// Warn at module load time if Upstash env vars are missing
if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  console.warn('[chat] UPSTASH_REDIS_REST_URL or TOKEN not set — rate limiting disabled');
}

let chatRatelimit: Ratelimit | null = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  chatRatelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '1 h'),
    analytics: true,
    prefix: 'localvector_chat',
  });
}

const SYSTEM_PROMPT = `You are the LocalVector AI Assistant — an expert in AI visibility,
search engine optimization for AI answers (AEO/GEO), and local business digital presence.

You help business owners understand:
- How visible their business is in AI-generated answers (Share of Voice)
- What AI models are getting wrong about their business (hallucinations)
- How they compare to competitors in AI mentions
- What actions to take to improve their AI visibility

You have access to tools that query real-time data about this business.
Always use the appropriate tool before answering data questions.
Present data clearly and give actionable recommendations.

Keep responses concise and business-friendly. Avoid jargon unless asked.
When showing metrics, highlight what changed and what to do about it.`;

export async function POST(req: Request) {
    // ── 1. Auth check ─────────────────────────────────────────────────────
    const ctx = await getSafeAuthContext();
    if (!ctx?.orgId) {
        return new Response('Unauthorized', { status: 401 });
    }

    // ── 2. Rate limit check (after auth — no wasted credits on 401) ─────
    let rateLimitResult = { success: true, limit: 20, remaining: 20, reset: Date.now() + 3600000 };
    try {
        if (chatRatelimit) {
            rateLimitResult = await chatRatelimit.limit(`chat:${ctx.orgId}`);
        }
    } catch (e) {
        console.error('[chat] Rate limit check failed — allowing request:', e);
    }

    if (!rateLimitResult.success) {
        const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000);
        return new Response(
            JSON.stringify({
                error: 'rate_limit_exceeded',
                message: 'Too many AI chat requests. Please wait before sending more messages.',
                retry_after: retryAfter,
            }),
            {
                status: 429,
                headers: {
                    'Content-Type': 'application/json',
                    'X-RateLimit-Limit': rateLimitResult.limit.toString(),
                    'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
                    'X-RateLimit-Reset': rateLimitResult.reset.toString(),
                    'Retry-After': retryAfter.toString(),
                },
            }
        );
    }

    // ── 3. Process request ────────────────────────────────────────────────
    const { messages } = await req.json();

    const tools = makeVisibilityTools(ctx.orgId);

    const result = streamText({
        model: getModel('chat-assistant'),
        system: SYSTEM_PROMPT,
        messages,
        tools,
        maxSteps: 5,
    });

    const response = result.toDataStreamResponse({
        getErrorMessage: (error) => {
            const msg = error instanceof Error ? error.message : String(error);
            console.error('[api/chat] stream error:', msg);

            if (msg.includes('API key')) return 'AI service configuration error. Please contact support.';
            if (msg.includes('429') || msg.includes('rate')) return 'AI service is busy. Please try again in a moment.';
            if (msg.includes('timeout') || msg.includes('ETIMEDOUT')) return 'AI service timed out. Please try again.';
            return 'AI service temporarily unavailable. Please try again.';
        },
    });

    // Add rate limit headers to successful response
    response.headers.set('X-RateLimit-Limit', rateLimitResult.limit.toString());
    response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
    response.headers.set('X-RateLimit-Reset', rateLimitResult.reset.toString());

    return response;
}
