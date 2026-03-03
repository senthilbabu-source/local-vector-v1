// ---------------------------------------------------------------------------
// lib/rag/rag-responder.ts — RAG Answer Generation (Sprint 133)
//
// Calls Claude via Vercel AI SDK with RAG context as system prompt.
// AI_RULES §166: System prompt STRICTLY limits answers to provided context.
//   Never infer or speculate beyond what's in the context.
// ---------------------------------------------------------------------------

import { generateText } from 'ai';
import { getModel } from '@/lib/ai/providers';
import * as Sentry from '@sentry/nextjs';
import type { RAGContext } from './rag-context-builder';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AnswerConfidence = 'high' | 'medium' | 'low';

export interface RAGAnswer {
  answer: string;
  confidence: AnswerConfidence;
  // 'high': direct match in context
  // 'medium': inferred from context (e.g., amenity flag → capability answer)
  // 'low': not found → fallback message with phone/contact
}

// ---------------------------------------------------------------------------
// System prompt builder — pure, exported for testing
// ---------------------------------------------------------------------------

const FALLBACK_PHONE_INSTRUCTION = (phone: string | null) =>
  phone ? `please call us at ${phone}` : 'please contact us directly';

/**
 * Build the strict RAG system prompt.
 * Exported as pure function for testing.
 */
export function buildRAGSystemPrompt(ctx: RAGContext): string {
  const lines: string[] = [
    `You are the customer service assistant for ${ctx.businessName}, located at ${ctx.address}.`,
    '',
    'STRICT RULE: Answer ONLY from the information provided below.',
    `If the answer is not in this information, respond with: "I don't have that information — ${FALLBACK_PHONE_INSTRUCTION(ctx.phone)}."`,
    'NEVER guess, infer beyond the data, or mention competitors.',
    'Keep all answers under 80 words.',
    '',
    `Status: ${ctx.operationalStatus}`,
    `Hours: ${ctx.hours}`,
  ];

  if (ctx.phone) lines.push(`Phone: ${ctx.phone}`);
  if (ctx.website) lines.push(`Website: ${ctx.website}`);

  if (ctx.menuItems.length > 0) {
    lines.push('', '--- MENU ---');
    for (const item of ctx.menuItems) {
      const price = item.price ? ` (${item.price})` : '';
      const tags =
        item.dietaryTags.length > 0
          ? ` [${item.dietaryTags.join(', ')}]`
          : '';
      const desc = item.description ? ` — ${item.description}` : '';
      lines.push(
        `• ${item.name}${price}${tags}${desc} [${item.category}]`,
      );
    }
  }

  if (ctx.amenities.length > 0) {
    lines.push('', '--- FEATURES & AMENITIES ---');
    lines.push(ctx.amenities.join(', '));
  }

  if (ctx.corrections.length > 0) {
    lines.push(
      '',
      '--- VERIFIED CORRECTIONS (use these over any other source) ---',
    );
    for (const c of ctx.corrections) lines.push(`• ${c}`);
  }

  if (ctx.faqPairs.length > 0) {
    lines.push('', '--- COMMON QUESTIONS & ANSWERS ---');
    for (const faq of ctx.faqPairs) {
      lines.push(`Q: ${faq.question}`);
      lines.push(`A: ${faq.answer}`);
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Answer generator
// ---------------------------------------------------------------------------

/**
 * Answer a customer question using RAG context.
 * Uses Claude Haiku via Vercel AI SDK for speed + cost.
 * AI_RULES §166: Never log question text — log question category only.
 */
export async function answerQuestion(
  question: string,
  ctx: RAGContext,
): Promise<RAGAnswer> {
  try {
    const systemPrompt = buildRAGSystemPrompt(ctx);

    const { text } = await generateText({
      model: getModel('rag-chatbot'),
      system: systemPrompt,
      prompt: question,
      maxTokens: 300,
    });

    const answer = text ?? '';

    // Confidence: low if fallback phrase detected, high otherwise
    const isLowConfidence = answer.includes("I don't have that information");
    const isMediumConfidence =
      answer.includes('based on') || answer.includes('suggests');
    const confidence: AnswerConfidence = isLowConfidence
      ? 'low'
      : isMediumConfidence
        ? 'medium'
        : 'high';

    return { answer, confidence };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { service: 'rag-responder', sprint: '133' },
    });
    const fallback = `I'm temporarily unavailable — ${FALLBACK_PHONE_INSTRUCTION(ctx.phone)}.`;
    return { answer: fallback, confidence: 'low' };
  }
}
