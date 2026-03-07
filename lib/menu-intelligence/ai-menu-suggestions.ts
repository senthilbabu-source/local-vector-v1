// ---------------------------------------------------------------------------
// lib/menu-intelligence/ai-menu-suggestions.ts — S50: AI-Powered Menu Suggestions
//
// Uses generateObject to produce contextual, AI-powered menu improvement
// suggestions. Falls back to pure heuristic suggestions (menu-optimizer.ts)
// when API key is absent.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AIMenuSuggestion {
  title: string;
  description: string;
  impact: 'high' | 'medium';
  category: 'description' | 'price' | 'dietary' | 'photography' | 'naming';
}

export interface MenuContext {
  businessName: string;
  industry: string;
  itemCount: number;
  itemsWithDescription: number;
  itemsWithPrice: number;
  itemsWithDietary: number;
  topMentionedItems: string[];
}

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

/**
 * Builds a prompt for the AI suggestion generator.
 */
export function buildMenuSuggestionPrompt(context: MenuContext): string {
  const completionRate = context.itemCount > 0
    ? Math.round((context.itemsWithDescription / context.itemCount) * 100)
    : 0;
  const priceRate = context.itemCount > 0
    ? Math.round((context.itemsWithPrice / context.itemCount) * 100)
    : 0;

  return [
    `Business: ${context.businessName} (${context.industry})`,
    `Menu: ${context.itemCount} items`,
    `Descriptions: ${completionRate}% complete`,
    `Prices: ${priceRate}% listed`,
    `Dietary tags: ${context.itemsWithDietary} items tagged`,
    context.topMentionedItems.length > 0
      ? `Top AI-mentioned items: ${context.topMentionedItems.join(', ')}`
      : 'No AI mention data available',
    '',
    'Generate 3-5 specific, actionable suggestions to improve this menu for AI visibility.',
    'Focus on what would most increase the chance of AI systems citing this business.',
    'Each suggestion should have a clear title, description, impact level, and category.',
  ].join('\n');
}

/**
 * Validates an AI-generated suggestion array. Filters out malformed entries.
 */
export function validateSuggestions(raw: unknown[]): AIMenuSuggestion[] {
  const valid: AIMenuSuggestion[] = [];
  const VALID_IMPACTS = new Set(['high', 'medium']);
  const VALID_CATEGORIES = new Set(['description', 'price', 'dietary', 'photography', 'naming']);

  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const obj = item as Record<string, unknown>;
    if (typeof obj.title !== 'string' || obj.title.length === 0) continue;
    if (typeof obj.description !== 'string') continue;
    if (!VALID_IMPACTS.has(obj.impact as string)) continue;
    if (!VALID_CATEGORIES.has(obj.category as string)) continue;

    valid.push({
      title: obj.title.slice(0, 120),
      description: (obj.description as string).slice(0, 300),
      impact: obj.impact as 'high' | 'medium',
      category: obj.category as AIMenuSuggestion['category'],
    });
  }

  return valid.slice(0, 5);
}

/**
 * Generates AI-powered menu suggestions. Falls back to empty array on error.
 * Uses dynamic import to avoid bundling AI SDK when not needed.
 */
export async function generateAIMenuSuggestions(
  context: MenuContext,
): Promise<AIMenuSuggestion[]> {
  try {
    // Dynamic import to avoid bundling when API key absent
    const { getModel } = await import('@/lib/ai/providers');
    const { generateObject } = await import('ai');
    const { z } = await import('zod');

    const model = getModel('faq-generation'); // reuse existing model key

    const prompt = buildMenuSuggestionPrompt(context);

    const result = await generateObject({
      model,
      prompt,
      schema: z.object({
        suggestions: z.array(z.object({
          title: z.string(),
          description: z.string(),
          impact: z.enum(['high', 'medium']),
          category: z.enum(['description', 'price', 'dietary', 'photography', 'naming']),
        })),
      }),
    });

    return validateSuggestions((result.object as { suggestions: Array<{ title: string; description: string; impact: string; category: string }> }).suggestions);
  } catch (err) {
    Sentry.captureException(err, { tags: { service: 'ai-menu-suggestions', sprint: 'S50' } });
    return [];
  }
}
