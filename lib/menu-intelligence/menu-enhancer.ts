// ---------------------------------------------------------------------------
// lib/menu-intelligence/menu-enhancer.ts — AI Menu Enhancement Engine
//
// Pre-publish AI enrichment: generates descriptions, fixes typos, and
// suggests improvements for extracted menu items before distribution.
// Uses GPT-4o-mini for cost efficiency (structured output via Zod).
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import type { MenuExtractedItem } from '@/lib/types/menu';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MenuEnhancement {
  /** Item ID from the original MenuExtractedItem */
  item_id: string;
  /** AI-generated description (1-2 sentences, appetizing, factual) */
  ai_description: string;
  /** Corrected name if typo detected, or null if name is fine */
  ai_name_correction: string | null;
}

export interface EnhanceMenuResult {
  enhancements: MenuEnhancement[];
  enhanced_count: number;
  typo_count: number;
}

// ---------------------------------------------------------------------------
// Pure functions (testable)
// ---------------------------------------------------------------------------

/**
 * Builds the system prompt for the menu enhancement LLM call.
 */
export function buildEnhanceSystemPrompt(): string {
  return [
    'You are a restaurant menu copywriter and proofreader.',
    'For each menu item provided, you must:',
    '',
    '1. DESCRIPTION: Write a concise, appetizing 1-2 sentence description.',
    '   - If the item already has a description, improve it to be more compelling.',
    '   - If no description exists, create one based on the item name, category, and price.',
    '   - Keep it factual — do NOT invent ingredients or attributes not implied by the name.',
    '   - Use sensory language (crispy, tender, smoky, fresh, etc.) where appropriate.',
    '   - Keep under 120 characters for optimal AI readability.',
    '',
    '2. NAME CORRECTION: Check the item name for typos, misspellings, or formatting issues.',
    '   - If the name has a typo, provide the corrected version.',
    '   - If the name is correct, set ai_name_correction to null.',
    '   - Preserve intentional stylistic choices (e.g., "Chicken 65" is correct, not a typo).',
    '   - Fix obvious misspellings like "Chiken" → "Chicken", "Ceasar" → "Caesar".',
    '',
    'Return enhancements for EVERY item provided. Do not skip any.',
  ].join('\n');
}

/**
 * Builds the user prompt with the list of items to enhance.
 */
export function buildEnhanceUserPrompt(items: MenuExtractedItem[]): string {
  const itemLines = items.map((item) => {
    const parts = [`- ID: ${item.id}`, `  Name: ${item.name}`, `  Category: ${item.category}`];
    if (item.price) parts.push(`  Price: ${item.price}`);
    if (item.description) parts.push(`  Current description: ${item.description}`);
    else parts.push('  Current description: (none)');
    if (item.price_note) parts.push(`  Price note: ${item.price_note}`);
    return parts.join('\n');
  });

  return [
    `Enhance these ${items.length} menu items:`,
    '',
    ...itemLines,
  ].join('\n');
}

/**
 * Validates and cleans raw enhancement results from the LLM.
 * Filters out malformed entries, ensures item_id matches, truncates descriptions.
 */
export function validateEnhancements(
  raw: unknown[],
  validItemIds: Set<string>,
): MenuEnhancement[] {
  const valid: MenuEnhancement[] = [];

  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue;
    const obj = entry as Record<string, unknown>;

    // Must have a valid item_id that matches our items
    if (typeof obj.item_id !== 'string' || !validItemIds.has(obj.item_id)) continue;

    // Must have a description
    if (typeof obj.ai_description !== 'string' || obj.ai_description.length === 0) continue;

    // Name correction is optional (null means no typo)
    const nameCorrection =
      typeof obj.ai_name_correction === 'string' && obj.ai_name_correction.length > 0
        ? obj.ai_name_correction.slice(0, 200)
        : null;

    valid.push({
      item_id: obj.item_id,
      ai_description: obj.ai_description.slice(0, 200),
      ai_name_correction: nameCorrection,
    });
  }

  return valid;
}

/**
 * Applies enhancements to menu items (pure — does not mutate originals).
 * Returns a new array with ai_description and ai_name_correction populated.
 */
export function applyEnhancementsToItems(
  items: MenuExtractedItem[],
  enhancements: MenuEnhancement[],
): MenuExtractedItem[] {
  const enhMap = new Map(enhancements.map((e) => [e.item_id, e]));

  return items.map((item) => {
    const enh = enhMap.get(item.id);
    if (!enh) return item;
    return {
      ...item,
      ai_description: enh.ai_description,
      ai_name_correction: enh.ai_name_correction ?? undefined,
    };
  });
}

/**
 * Accepts AI enhancements for specific items (pure — does not mutate originals).
 * Replaces name/description with AI suggestions and marks as enhanced.
 */
export function acceptEnhancements(
  items: MenuExtractedItem[],
  acceptedItemIds: Set<string>,
): MenuExtractedItem[] {
  return items.map((item) => {
    if (!acceptedItemIds.has(item.id)) return item;
    const updated = { ...item, ai_enhanced: true };
    if (item.ai_description) {
      updated.description = item.ai_description;
    }
    if (item.ai_name_correction) {
      updated.name = item.ai_name_correction;
    }
    return updated;
  });
}

/**
 * Dismisses AI enhancements for specific items (pure — does not mutate originals).
 * Removes ai_description and ai_name_correction fields.
 */
export function dismissEnhancements(
  items: MenuExtractedItem[],
  dismissedItemIds: Set<string>,
): MenuExtractedItem[] {
  return items.map((item) => {
    if (!dismissedItemIds.has(item.id)) return item;
    const { ai_description: _d, ai_name_correction: _n, ...rest } = item;
    return rest;
  });
}

// ---------------------------------------------------------------------------
// LLM call (I/O)
// ---------------------------------------------------------------------------

/**
 * Enhances menu items with AI-generated descriptions and typo corrections.
 * Uses GPT-4o-mini via Vercel AI SDK generateObject for structured output.
 *
 * Returns null on any failure (missing API key, network error, parse failure).
 * Fail-open: callers should proceed without enhancements on null.
 */
export async function enhanceMenuItems(
  items: MenuExtractedItem[],
): Promise<EnhanceMenuResult | null> {
  if (items.length === 0) return null;

  try {
    const { getModel, hasApiKey } = await import('@/lib/ai/providers');
    if (!hasApiKey('openai')) return null;

    const { generateObject } = await import('ai');
    const { z } = await import('zod');

    const model = getModel('menu-enhance');

    const { object } = await generateObject({
      model,
      system: buildEnhanceSystemPrompt(),
      prompt: buildEnhanceUserPrompt(items),
      schema: z.object({
        enhancements: z.array(z.object({
          item_id: z.string(),
          ai_description: z.string(),
          ai_name_correction: z.string().nullable(),
        })),
      }),
    });

    const validIds = new Set(items.map((i) => i.id));
    const enhancements = validateEnhancements(
      (object as { enhancements: unknown[] }).enhancements,
      validIds,
    );

    return {
      enhancements,
      enhanced_count: enhancements.length,
      typo_count: enhancements.filter((e) => e.ai_name_correction !== null).length,
    };
  } catch (err) {
    Sentry.captureException(err, { tags: { service: 'menu-enhancer', sprint: 'menu-enhance' } });
    return null;
  }
}
