// ---------------------------------------------------------------------------
// app/api/chat/route.ts — AI Assistant Chat Endpoint
//
// Surgery 6: Streaming chat with tool calls that return structured data.
// The client renders tool results as rich UI cards (SOV charts, alert lists).
//
// Flow:
//   1. Authenticate via getSafeAuthContext() → orgId
//   2. Build org-scoped tools via makeVisibilityTools(orgId)
//   3. streamText() with GPT-4o + tools → streaming response
//   4. Client receives text chunks + tool call results
//
// Spec: Surgical Integration Plan §Surgery 6
// ---------------------------------------------------------------------------

import { streamText } from 'ai';
import { getModel } from '@/lib/ai/providers';
import { getSafeAuthContext } from '@/lib/auth';
import { makeVisibilityTools } from '@/lib/tools/visibility-tools';

export const maxDuration = 30;

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
    const ctx = await getSafeAuthContext();
    if (!ctx?.orgId) {
        return new Response('Unauthorized', { status: 401 });
    }

    const { messages } = await req.json();

    const tools = makeVisibilityTools(ctx.orgId);

    const result = streamText({
        model: getModel('chat-assistant'),
        system: SYSTEM_PROMPT,
        messages,
        tools,
        maxSteps: 5,
    });

    return result.toDataStreamResponse({
        getErrorMessage: (error) => {
            const msg = error instanceof Error ? error.message : String(error);
            console.error('[api/chat] stream error:', msg);

            if (msg.includes('API key')) return 'AI service configuration error. Please contact support.';
            if (msg.includes('429') || msg.includes('rate')) return 'AI service is busy. Please try again in a moment.';
            if (msg.includes('timeout') || msg.includes('ETIMEDOUT')) return 'AI service timed out. Please try again.';
            return 'AI service temporarily unavailable. Please try again.';
        },
    });
}
