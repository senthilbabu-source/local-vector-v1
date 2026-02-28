// ---------------------------------------------------------------------------
// lib/ai-preview/model-queries.ts — Sprint F (N2): AI Answer Preview
//
// Three functions that each query one AI model with a local search query.
// Uses Vercel AI SDK via lib/ai/providers.ts — matches existing codebase pattern.
//
// Each returns { status: 'complete' | 'error', content: string }.
// The API route streams results to the client as each Promise resolves.
// ---------------------------------------------------------------------------

import { generateText } from 'ai';
import { getModel, hasApiKey } from '@/lib/ai/providers';
import * as Sentry from '@sentry/nextjs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ModelResult {
  status: 'complete' | 'error';
  content: string;
}

// ---------------------------------------------------------------------------
// System prompt builder
// ---------------------------------------------------------------------------

function buildSystemPrompt(businessContext: string): string {
  return `You are answering a local search query. Answer naturally and concisely as you would for a real user searching for a local business.
${businessContext}
Limit your answer to 150 words maximum. Be factual and specific.`.trim();
}

// ---------------------------------------------------------------------------
// Model query functions
// ---------------------------------------------------------------------------

export async function queryOpenAI(
  query: string,
  businessContext: string,
): Promise<ModelResult> {
  if (!hasApiKey('openai')) {
    return { status: 'error', content: 'ChatGPT is not configured in this environment' };
  }
  try {
    const { text } = await generateText({
      model: getModel('preview-chatgpt'),
      system: buildSystemPrompt(businessContext),
      prompt: query,
      maxTokens: 300,
      temperature: 0.7,
    });
    return { status: 'complete', content: text || '(No response)' };
  } catch (err) {
    Sentry.captureException(err, { tags: { model: 'chatgpt', sprint: 'F' } });
    return { status: 'error', content: 'ChatGPT is temporarily unavailable' };
  }
}

export async function queryPerplexity(
  query: string,
  businessContext: string,
): Promise<ModelResult> {
  if (!hasApiKey('perplexity')) {
    return { status: 'error', content: 'Perplexity is not configured in this environment' };
  }
  try {
    const { text } = await generateText({
      model: getModel('preview-perplexity'),
      system: buildSystemPrompt(businessContext),
      prompt: query,
      maxTokens: 300,
      temperature: 0.7,
    });
    return { status: 'complete', content: text || '(No response)' };
  } catch (err) {
    Sentry.captureException(err, { tags: { model: 'perplexity', sprint: 'F' } });
    return { status: 'error', content: 'Perplexity is temporarily unavailable' };
  }
}

export async function queryGemini(
  query: string,
  businessContext: string,
): Promise<ModelResult> {
  if (!hasApiKey('google')) {
    return { status: 'error', content: 'Gemini is not configured in this environment' };
  }
  try {
    const { text } = await generateText({
      model: getModel('preview-gemini'),
      system: buildSystemPrompt(businessContext),
      prompt: query,
      maxTokens: 300,
      temperature: 0.7,
    });
    return { status: 'complete', content: text || '(No response)' };
  } catch (err) {
    Sentry.captureException(err, { tags: { model: 'gemini', sprint: 'F' } });
    return { status: 'error', content: 'Gemini is temporarily unavailable' };
  }
}
