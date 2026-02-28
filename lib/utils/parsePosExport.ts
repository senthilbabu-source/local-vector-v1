// ---------------------------------------------------------------------------
// parsePosExport.ts — Path 2: POS Export → MenuExtractedData via GPT-4o
//
// SOURCE OF TRUTH: Doc 04b §5
//
// Sends a raw Toast / Square / Clover CSV export to OpenAI gpt-4o with a
// structured extraction prompt. GPT-4o acts as a universal column mapper,
// identifying menu items regardless of POS vendor column naming conventions.
//
// Architecture mirrors extractMenuWithOpenAI() in actions.ts (Phase 18):
//   • Same API URL — intercepted by MSW openAiHandler during Playwright tests
//   • Same response_format: { type: 'json_object' }
//   • Same Zod validation gate (MenuExtractedDataSchema imported from actions)
//   • Same graceful degradation: returns null on any failure; no 500 errors
//
// MSW contract (AI_RULES §4):
//   The existing openAiHandler in src/mocks/handlers.ts intercepts ALL calls
//   to https://api.openai.com/v1/chat/completions. No new handler needed.
// ---------------------------------------------------------------------------

import { z } from 'zod';
import * as Sentry from '@sentry/nextjs';
import type { MenuExtractedData } from '@/lib/types/menu';

// ---------------------------------------------------------------------------
// Zod schema — mirrors MenuExtractedItemSchema in actions.ts exactly.
// Must be kept in sync whenever MenuExtractedItem changes.
// ---------------------------------------------------------------------------

const PosMenuExtractedItemSchema = z.object({
  id:          z.string(),
  name:        z.string(),
  description: z.string().optional().nullable().transform((v) => v ?? undefined),
  price:       z.string().optional().nullable().transform((v) => v ?? undefined),
  category:    z.string(),
  confidence:  z.number().min(0).max(1),
  image_url:   z.string().url().optional().nullable().transform((v) => v ?? undefined),
});

const PosMenuExtractedDataSchema = z.object({
  items:                z.array(PosMenuExtractedItemSchema).min(1),
  extracted_at:         z.string(),
  // GPT-4o includes a detected POS system field — store as source_url prefix
  pos_system_detected:  z.string().optional(),
  source_url:           z.string().optional(),
});

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const POS_MAPPER_SYSTEM_PROMPT = `
You are a menu data extraction specialist for local restaurants.

Read this raw POS (Point of Sale) CSV export and extract all true menu items.
Ignore system artifacts: modifier groups, combo IDs, tax codes, variant rows,
add-ons, and any rows that are not standalone purchasable items.

Detect which POS system the CSV came from based on the column headers.

Output ONLY a valid JSON object — no markdown, no explanation:
{
  "items": [
    {
      "id": "pos-1",
      "name": "string",
      "description": "string or null",
      "price": "$X.XX or null",
      "category": "string",
      "confidence": 0.0-1.0,
      "image_url": "https://... or null"
    }
  ],
  "extracted_at": "ISO-8601 timestamp",
  "pos_system_detected": "toast | square | clover | unknown"
}

Confidence scoring rules:
  0.90-1.00: name + price + category all clearly identified
  0.75-0.89: name + price found; category inferred from context
  0.60-0.74: name found; price ambiguous or missing
  0.40-0.59: row is a modifier / add-on / variant (include but flag at low confidence)
  < 0.40: discard — clearly not a menu item (tax rows, headers, totals)

Price format: always "$X.XX" (e.g., "$12.50"). Use null if no price is detectable.
`.trim();

// ---------------------------------------------------------------------------
// parsePosExportWithGPT4o
// ---------------------------------------------------------------------------

/**
 * Sends a raw POS CSV string to OpenAI gpt-4o and returns structured
 * `MenuExtractedData`, or `null` if the API call fails for any reason.
 *
 * Callers MUST handle the null return with a graceful error message.
 *
 * @param csvText - Raw POS CSV string from `await file.text()`.
 */
export async function parsePosExportWithGPT4o(
  csvText: string,
): Promise<MenuExtractedData | null> {
  const apiKey = process.env.OPENAI_API_KEY;

  // Missing key → instant null (dev / CI without credentials)
  if (!apiKey) return null;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:           'gpt-4o',
        // JSON mode guarantees a parseable JSON object — no markdown fences.
        response_format: { type: 'json_object' },
        messages: [
          {
            role:    'system',
            content: POS_MAPPER_SYSTEM_PROMPT,
          },
          {
            role:    'user',
            content: `POS Export CSV:\n\n${csvText}`,
          },
        ],
      }),
    });

    if (!response.ok) return null;

    const raw = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = (raw.choices?.[0]?.message?.content ?? '').trim();
    if (!content) return null;

    // Strip markdown fences defensively even with json_object mode.
    const cleaned = content
      .replace(/^```json\s*/i, '')
      .replace(/```\s*$/,      '')
      .trim();

    const parsed = PosMenuExtractedDataSchema.safeParse(JSON.parse(cleaned));
    if (!parsed.success) return null;

    const { pos_system_detected, ...rest } = parsed.data;

    return {
      items:        rest.items,
      extracted_at: rest.extracted_at,
      // Encode the detected POS system into source_url for analytics tracking.
      source_url:   pos_system_detected
        ? `pos://${pos_system_detected}`
        : undefined,
    };
  } catch (err) {
    Sentry.captureException(err, { tags: { file: 'parsePosExport.ts', sprint: 'A' } });
    // Network error, JSON parse error, Zod failure — all degrade to null.
    return null;
  }
}
