// ---------------------------------------------------------------------------
// lib/intent/prompt-expander.ts — Intent Prompt Generation (Sprint 135)
//
// Uses Claude via Vercel AI SDK to generate realistic conversational prompts
// customers might ask AI models about businesses in the location's category.
//
// AI_RULES §168:
//   - Generated prompts are AI-produced, not sourced from real user data.
//   - Deduplicate similar prompts before returning.
//   - sampleSize cap: 50. Never exceed.
// ---------------------------------------------------------------------------

import { generateText } from 'ai';
import { getModel } from '@/lib/ai/providers';
import * as Sentry from '@sentry/nextjs';

const MAX_SAMPLE_SIZE = 50;

export interface PromptExpanderInput {
  businessName: string;
  city: string;
  state: string;
  categories: string[];
  keyAmenities: string[];
  competitors: string[];
}

/**
 * Generate realistic conversational prompts via Claude.
 * Returns deduplicated array of prompt strings.
 */
export async function expandPrompts(
  location: PromptExpanderInput,
  sampleSize = 50,
): Promise<string[]> {
  const actualSize = Math.min(sampleSize, MAX_SAMPLE_SIZE);

  const systemPrompt = `You are generating realistic conversational search prompts that customers might type into AI models (ChatGPT, Perplexity) when looking for local businesses.

Generate exactly ${actualSize} diverse prompts. Each prompt should be something a real person would naturally type — not keyword-stuffed.

Rules:
- Include the city or "near me" in most prompts
- Vary the intent: hours questions, occasion queries (bachelorette, birthday, date night), comparison queries, specific offering queries
- Include the business category prominently
- Vary length: some short (5 words), some conversational (15 words)
- Do NOT include the business name "${location.businessName}" — we're finding prompts they should appear in

Return ONLY a JSON array of strings. No other text.`;

  const userMessage = `Business category: ${location.categories.join(', ')}
City: ${location.city}, ${location.state}
Key features: ${location.keyAmenities.join(', ')}
Known competitors: ${location.competitors.slice(0, 3).join(', ')}

Generate ${actualSize} prompts.`;

  try {
    const { text } = await generateText({
      model: getModel('intent-expand'),
      system: systemPrompt,
      prompt: userMessage,
      maxTokens: 4000,
    });

    // Parse JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const prompts = JSON.parse(jsonMatch[0]) as string[];
    if (!Array.isArray(prompts)) return [];

    return deduplicatePrompts(
      prompts.filter((p) => typeof p === 'string' && p.length > 0),
    );
  } catch (err) {
    Sentry.captureException(err, {
      tags: { service: 'prompt-expander', sprint: '135' },
    });
    return [];
  }
}

/**
 * Deduplicate prompts by first 6 words. Keeps one per cluster.
 * Exported for testing.
 */
export function deduplicatePrompts(prompts: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const prompt of prompts) {
    const key = prompt.toLowerCase().split(/\s+/).slice(0, 6).join(' ');
    if (!seen.has(key)) {
      seen.add(key);
      result.push(prompt);
    }
  }

  return result;
}
