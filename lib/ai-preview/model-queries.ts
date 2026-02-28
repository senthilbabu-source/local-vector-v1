// ---------------------------------------------------------------------------
// lib/ai-preview/model-queries.ts — Sprint F (N2) + Sprint N enhancements
//
// Three batch query functions (queryOpenAI/Perplexity/Gemini) that return
// complete responses. Used by the correction verifier and elsewhere.
//
// Three streaming functions (streamOpenAI/Perplexity/Gemini) that yield
// text chunks via async generators. Used by the AI Preview SSE route
// for real-time token-by-token streaming to the client.
// ---------------------------------------------------------------------------

import { generateText, streamText } from 'ai';
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

// ---------------------------------------------------------------------------
// Sprint N: Streaming model query functions — token-by-token via async gen
// ---------------------------------------------------------------------------

export interface StreamChunk {
  chunk: string;
  done: boolean;
  error?: string;
}

async function* streamModel(
  modelKey: 'preview-chatgpt' | 'preview-perplexity' | 'preview-gemini',
  provider: 'openai' | 'perplexity' | 'google',
  label: string,
  query: string,
  businessContext: string,
): AsyncGenerator<StreamChunk> {
  if (!hasApiKey(provider)) {
    yield { chunk: '', done: true, error: `${label} is not configured in this environment` };
    return;
  }
  try {
    const result = streamText({
      model: getModel(modelKey),
      system: buildSystemPrompt(businessContext),
      prompt: query,
      maxTokens: 300,
      temperature: 0.7,
    });
    for await (const textPart of result.textStream) {
      if (textPart) {
        yield { chunk: textPart, done: false };
      }
    }
    yield { chunk: '', done: true };
  } catch (err) {
    Sentry.captureException(err, { tags: { model: label.toLowerCase(), sprint: 'N' } });
    yield { chunk: '', done: true, error: `${label} is temporarily unavailable` };
  }
}

export function streamOpenAI(query: string, businessContext: string): AsyncGenerator<StreamChunk> {
  return streamModel('preview-chatgpt', 'openai', 'ChatGPT', query, businessContext);
}

export function streamPerplexity(query: string, businessContext: string): AsyncGenerator<StreamChunk> {
  return streamModel('preview-perplexity', 'perplexity', 'Perplexity', query, businessContext);
}

export function streamGemini(query: string, businessContext: string): AsyncGenerator<StreamChunk> {
  return streamModel('preview-gemini', 'google', 'Gemini', query, businessContext);
}
