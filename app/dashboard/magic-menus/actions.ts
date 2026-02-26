'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getSafeAuthContext } from '@/lib/auth';
import { toUniqueSlug } from '@/lib/utils/slug';
import {
  CreateMagicMenuSchema,
  type CreateMagicMenuInput,
} from '@/lib/schemas/magic-menus';
import type {
  MenuExtractedData,
  MenuWorkspaceData,
  PropagationEvent,
} from '@/lib/types/menu';
import { parseLocalVectorCsv } from '@/lib/utils/parseCsvMenu';
import { parsePosExportWithGPT4o } from '@/lib/utils/parsePosExport';
import { generateObject } from 'ai';
import { getModel, hasApiKey } from '@/lib/ai/providers';
import { MenuOCRSchema, type MenuOCROutput } from '@/lib/ai/schemas';
import type { Json } from '@/lib/supabase/database.types';

// ---------------------------------------------------------------------------
// Phase 18 — OpenAI menu extraction helper
// ---------------------------------------------------------------------------

// Zod schemas mirror MenuExtractedData/MenuExtractedItem in lib/types/menu.ts
// (Doc 03 §15.5). Used to validate the GPT-4o response before storing to DB.
const MenuExtractedItemSchema = z.object({
  id:          z.string(),
  name:        z.string(),
  description: z.string().optional(),
  price:       z.string().optional(),
  category:    z.string(),
  confidence:  z.number().min(0).max(1),
  // Doc 04b §2: image_url added to MenuExtractedItem (lib/types/menu.ts).
  // Optional — populated by the LocalVector CSV Image_URL column or GPT-4o POS mapper.
  image_url:   z.string().url().optional(),
});

const MenuExtractedDataSchema = z.object({
  items:        z.array(MenuExtractedItemSchema).min(1),
  extracted_at: z.string(),
  source_url:   z.string().optional(),
});

// Sample Charcoal N Chill menu text — sent as the user message so GPT-4o
// extracts real items rather than inventing them.
const SAMPLE_MENU_TEXT = `
CHARCOAL N CHILL — MENU

BBQ Plates
- Brisket Plate · $18 · 12 oz smoked brisket with choice of two sides
- Pulled Pork Sandwich · $12 · house-smoked pork shoulder on toasted brioche, pickles, slaw
- St. Louis Ribs Half Rack · $22 · slow-smoked pork ribs, house dry rub, sauce on the side

Starters
- Smoked Wings · $14 · 8-piece smoked chicken wings: plain, dry rub, or sauced

Sides
- Loaded Mac & Cheese · $8 · four-cheese blend, baked to order

Drinks
- Sweet Tea · $3
`.trim();

/**
 * Calls the OpenAI API (gpt-4o) to extract menu items from SAMPLE_MENU_TEXT.
 * Returns a validated MenuExtractedData, or null on any failure (network error,
 * non-OK status, JSON parse failure, Zod validation failure).
 *
 * URL must exactly match the MSW handler in src/mocks/handlers.ts so Playwright
 * tests intercept the call without consuming real API credits.
 */
async function extractMenuWithOpenAI(): Promise<MenuExtractedData | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:           'gpt-4o',
        // JSON mode: guarantees a valid JSON object is returned.
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: [
              'You are a restaurant menu digitizer.',
              'Extract ALL menu items from the provided text into strict JSON.',
              'Output schema: { "items": [{ "id": string, "name": string, "description"?: string, "price"?: string, "category": string, "confidence": number }], "extracted_at": ISO-8601 string, "source_url"?: string }',
              'Confidence: 0.90–1.00=clear; 0.70–0.89=minor ambiguity; 0.50–0.69=significant ambiguity; <0.50=unclear.',
              'Output ONLY the JSON object. No markdown. No explanation.',
            ].join('\n'),
          },
          {
            role:    'user',
            content: `Extract all menu items from this restaurant menu:\n\n${SAMPLE_MENU_TEXT}`,
          },
        ],
      }),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = (data.choices?.[0]?.message?.content ?? '').trim();

    // Strip optional markdown fences as a defensive fallback.
    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/```\s*$/,      '')
      .trim();

    const result = MenuExtractedDataSchema.safeParse(JSON.parse(cleaned));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Shared result type
// ---------------------------------------------------------------------------

export type ActionResult = { success: true } | { success: false; error: string };

// ---------------------------------------------------------------------------
// createMagicMenu
// ---------------------------------------------------------------------------

/**
 * Server Action: insert a new Magic Menu record for the authenticated user's org.
 *
 * SECURITY: `org_id` is NEVER accepted from the client. It is derived
 * exclusively from the server-side session via `getSafeAuthContext()`.
 * The Supabase RLS `org_isolation_insert` policy on `magic_menus` provides
 * a second enforcement layer.
 *
 * ⚠️  PREREQUISITE: The `magic_menus` table currently has no INSERT RLS policy
 * for authenticated users. Apply the following before testing:
 *
 *   CREATE POLICY "org_isolation_insert" ON public.magic_menus
 *     FOR INSERT WITH CHECK (org_id = public.current_user_org_id());
 *
 * Without it, the INSERT will be silently rejected (0 rows, no error).
 *
 * NOTE: `magic_menus` has no `name` column. The user-supplied name is
 * converted to a unique slug stored in `public_slug`.
 */
export async function createMagicMenu(
  input: CreateMagicMenuInput
): Promise<ActionResult> {
  // Step 1 — authenticate and derive org_id server-side (the RLS Rule)
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return { success: false, error: 'Unauthorized' };
  }

  // Step 2 — validate client-supplied fields
  const parsed = CreateMagicMenuSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input',
    };
  }

  const { name, location_id } = parsed.data;

  // Step 3 — derive a URL-safe unique slug from the menu name
  const publicSlug = toUniqueSlug(name);

  // Step 4 — insert with org_id derived from server-side session
  const supabase = await createClient();

  const { error } = await supabase.from('magic_menus').insert({
    org_id: ctx.orgId,        // ALWAYS server-derived — never from client
    location_id,
    public_slug: publicSlug,
    processing_status: 'uploading',
    is_published: false,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard/magic-menus');
  return { success: true };
}

// ---------------------------------------------------------------------------
// toggleMenuStatus
// ---------------------------------------------------------------------------

/**
 * Server Action: flip the `is_published` state of a Magic Menu.
 *
 * When publishing: sets `is_published = true` and `processing_status = 'published'`.
 * When unpublishing: sets `is_published = false` and `processing_status = 'review_ready'`.
 *
 * SECURITY: RLS `org_isolation_update` on `magic_menus` ensures only rows
 * belonging to the authenticated user's org can be updated. `getSafeAuthContext()`
 * rejects unauthenticated callers before any DB interaction.
 *
 * The current `is_published` state is read from the DB (not trusted from the client)
 * so the toggle is always accurate regardless of stale client state.
 */
export async function toggleMenuStatus(menuId: string): Promise<ActionResult> {
  // Reject unauthenticated callers before any DB interaction
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return { success: false, error: 'Unauthorized' };
  }

  const supabase = await createClient();

  // Read the authoritative current state from the DB.
  // Also fetch public_slug so we can revalidate the public Honeypot page.
  // RLS org_isolation_select ensures we can only read our own menus.
  const { data: menu, error: fetchError } = await supabase
    .from('magic_menus')
    .select('is_published, public_slug')
    .eq('id', menuId)
    .single() as {
      data: { is_published: boolean; public_slug: string | null } | null;
      error: unknown;
    };

  if (fetchError || !menu) {
    return { success: false, error: 'Menu not found' };
  }

  const newIsPublished = !menu.is_published;

  const { error: updateError } = await supabase
    .from('magic_menus')
    .update({
      is_published: newIsPublished,
      // Keep processing_status in sync with the published boolean
      processing_status: newIsPublished ? 'published' : 'review_ready',
    })
    .eq('id', menuId);
  // RLS org_isolation_update ensures only the user's own menu rows are touched

  if (updateError) {
    return { success: false, error: (updateError as { message: string }).message };
  }

  revalidatePath('/dashboard/magic-menus');

  // Revalidate the public Honeypot page in both directions:
  //   Publishing   → populate/refresh the page so crawlers see it immediately.
  //   Unpublishing → purge the page so stale content is no longer served.
  if (menu.public_slug) {
    revalidatePath(`/m/${menu.public_slug}`, 'page');
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// simulateAIParsing
// ---------------------------------------------------------------------------

/**
 * Mock Server Action: simulates the AI extraction pipeline.
 *
 * Creates a `magic_menus` row for the given location if one doesn't exist,
 * then populates `extracted_data` with realistic mock items (Charcoal N Chill)
 * and advances `processing_status` to `review_ready`.
 *
 * Returns the updated `MenuWorkspaceData` so the client can transition to the
 * Review state without a full page reload.
 *
 * SECURITY: `org_id` is always derived from `getSafeAuthContext()`.
 */
export async function simulateAIParsing(
  locationId: string
): Promise<{ success: true; menu: MenuWorkspaceData } | { success: false; error: string }> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) return { success: false, error: 'Unauthorized' };

  const supabase = await createClient();

  // ── Look for an existing menu for this location ────────────────────────────
  const { data: existing } = (await supabase
    .from('magic_menus')
    .select('id')
    .eq('location_id', locationId)
    .eq('org_id', ctx.orgId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: { id: string } | null };

  let menuId: string;

  if (!existing) {
    // ── Create a new menu record ─────────────────────────────────────────────
    const { data: inserted, error: insertError } = (await supabase
      .from('magic_menus')
      .insert({
        org_id: ctx.orgId,
        location_id: locationId,
        public_slug: toUniqueSlug('menu'),
        processing_status: 'uploading',
        is_published: false,
      })
      .select('id')
      .single()) as { data: { id: string } | null; error: { message: string } | null };

    if (insertError || !inserted) {
      return { success: false, error: insertError?.message ?? 'Failed to create menu record' };
    }
    menuId = inserted.id;
  } else {
    menuId = existing.id;
  }

  // ── AI extraction (Phase 18) ──────────────────────────────────────────────
  // Attempt real OpenAI extraction; fall back to deterministic Charcoal N Chill
  // mock on any failure (missing key, network error, parse/Zod failure).
  const aiData = await extractMenuWithOpenAI();
  const mockData: MenuExtractedData = aiData ?? {
    extracted_at: new Date().toISOString(),
    items: [
      { id: '1', name: 'Brisket Plate',           price: '$18', category: 'BBQ Plates', confidence: 0.94, description: '12oz smoked brisket with choice of two sides' },
      { id: '2', name: 'Pulled Pork Sandwich',    price: '$12', category: 'Sandwiches', confidence: 0.91, description: 'House-smoked pork shoulder on toasted brioche with pickles and slaw' },
      { id: '3', name: 'St. Louis Ribs Half Rack', price: '$22', category: 'BBQ Plates', confidence: 0.88, description: 'Slow-smoked pork ribs, house dry rub, sauce on the side' },
      { id: '4', name: 'Smoked Wings',             price: '$14', category: 'Starters',   confidence: 0.76, description: '8 piece smoked chicken wings — plain, dry rub, or sauced' },
      { id: '5', name: 'Loaded Mac & Cheese',      price: '$8',  category: 'Sides',      confidence: 0.68 },
      { id: '6', name: 'Sweet Tea',                price: '$3',  category: 'Drinks',     confidence: 0.83 },
    ],
  };

  // Derive confidence from item averages (works for both real and fallback data).
  const extractionConfidence =
    mockData.items.length > 0
      ? Math.round(
          (mockData.items.reduce((sum, item) => sum + item.confidence, 0) /
            mockData.items.length) *
            100
        ) / 100
      : 0.83;

  // ── Persist to DB ─────────────────────────────────────────────────────────
  const { data: updated, error: updateError } = (await supabase
    .from('magic_menus')
    .update({
      processing_status:    'review_ready',
      extracted_data:       mockData as unknown as Json,
      extraction_confidence: extractionConfidence,
    })
    .eq('id', menuId)
    .select(
      'id, location_id, processing_status, extracted_data, extraction_confidence, is_published, public_slug, human_verified, propagation_events'
    )
    .single()) as { data: MenuWorkspaceData | null; error: { message: string } | null };

  if (updateError || !updated) {
    return { success: false, error: updateError?.message ?? 'Failed to process menu' };
  }

  revalidatePath('/dashboard/magic-menus');
  return { success: true, menu: updated };
}

// ---------------------------------------------------------------------------
// approveAndPublish
// ---------------------------------------------------------------------------

/**
 * Server Action: human-verifies the extracted menu and publishes it.
 *
 * Sets `human_verified = true`, `is_published = true`,
 * `processing_status = 'published'`, and appends a `published` propagation
 * event. Also revalidates the public LLM Honeypot page (/m/[slug]).
 *
 * SECURITY: RLS `org_isolation_update` on `magic_menus` ensures only the
 * authenticated user's own menu can be updated.
 */
export async function approveAndPublish(
  menuId: string
): Promise<{ success: true; publicSlug: string } | { success: false; error: string }> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) return { success: false, error: 'Unauthorized' };

  const supabase = await createClient();

  // Read current state to get public_slug and existing propagation_events
  const { data: current, error: fetchError } = (await supabase
    .from('magic_menus')
    .select('public_slug, propagation_events')
    .eq('id', menuId)
    .single()) as {
    data: { public_slug: string | null; propagation_events: PropagationEvent[] } | null;
    error: unknown;
  };

  if (fetchError || !current) {
    return { success: false, error: 'Menu not found' };
  }

  const events: PropagationEvent[] = [
    ...(current.propagation_events ?? []),
    { event: 'published', date: new Date().toISOString() },
  ];

  const { error: updateError } = await supabase
    .from('magic_menus')
    .update({
      is_published: true,
      processing_status: 'published',
      human_verified: true,
      propagation_events: events as unknown as Json,
    })
    .eq('id', menuId);

  if (updateError) {
    return { success: false, error: (updateError as { message: string }).message };
  }

  revalidatePath('/dashboard/magic-menus');
  if (current.public_slug) {
    revalidatePath(`/m/${current.public_slug}`, 'page');
  }

  return { success: true, publicSlug: current.public_slug ?? '' };
}

// ---------------------------------------------------------------------------
// Internal: upsert + populate a magic_menus row with extracted data
// ---------------------------------------------------------------------------

/**
 * Shared helper used by uploadLocalVectorCsv and uploadPosExport.
 * Finds or creates a magic_menus row for the location, then updates it
 * with the provided MenuExtractedData. Returns the full MenuWorkspaceData
 * on success or an error string on failure.
 */
async function saveExtractedMenu(
  orgId:      string,
  locationId: string,
  sourceType: 'csv-localvector' | 'csv-pos',
  menuData:   MenuExtractedData,
): Promise<{ success: true; menu: MenuWorkspaceData } | { success: false; error: string }> {
  const supabase = await createClient();

  // ── Find or create the magic_menus row ──────────────────────────────────
  const { data: existing } = (await supabase
    .from('magic_menus')
    .select('id')
    .eq('location_id', locationId)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: { id: string } | null };

  let menuId: string;

  if (!existing) {
    const { data: inserted, error: insertError } = (await supabase
      .from('magic_menus')
      .insert({
        org_id:            orgId,
        location_id:       locationId,
        public_slug:       toUniqueSlug('menu'),
        source_type:       sourceType,
        processing_status: 'review_ready',   // CSV skips 'processing' state
        is_published:      false,
      })
      .select('id')
      .single()) as { data: { id: string } | null; error: { message: string } | null };

    if (insertError || !inserted) {
      return { success: false, error: insertError?.message ?? 'Failed to create menu record' };
    }
    menuId = inserted.id;
  } else {
    menuId = existing.id;
  }

  // ── Calculate average confidence ────────────────────────────────────────
  const extractionConfidence =
    menuData.items.length > 0
      ? Math.round(
          (menuData.items.reduce((sum, item) => sum + item.confidence, 0) /
            menuData.items.length) *
            100,
        ) / 100
      : 1.0;

  // ── Persist to DB ────────────────────────────────────────────────────────
  const { data: updated, error: updateError } = (await supabase
    .from('magic_menus')
    .update({
      source_type:           sourceType,
      processing_status:     'review_ready',
      extracted_data:        menuData as unknown as Json,
      extraction_confidence: extractionConfidence,
    })
    .eq('id', menuId)
    .select(
      'id, location_id, processing_status, extracted_data, extraction_confidence, is_published, public_slug, human_verified, propagation_events',
    )
    .single()) as { data: MenuWorkspaceData | null; error: { message: string } | null };

  if (updateError || !updated) {
    return { success: false, error: updateError?.message ?? 'Failed to save menu data' };
  }

  revalidatePath('/dashboard/magic-menus');
  return { success: true, menu: updated };
}

// ---------------------------------------------------------------------------
// uploadLocalVectorCsv — Path 1: LocalVector Gold Standard CSV
// ---------------------------------------------------------------------------

/**
 * Server Action: parse a LocalVector AEO-Ready CSV upload and store the
 * resulting MenuExtractedData for Confidence Triage review.
 *
 * Expects FormData with a single "file" key containing a .csv File.
 * All items are assigned confidence = 1.0 (owner-supplied ground truth).
 *
 * SECURITY: org_id is always derived from getSafeAuthContext() — never from client.
 */
export async function uploadLocalVectorCsv(
  formData: FormData,
): Promise<{ success: true; menu: MenuWorkspaceData } | { success: false; error: string }> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) return { success: false, error: 'Unauthorized' };

  const file       = formData.get('file') as File | null;
  const locationId = formData.get('locationId') as string | null;

  if (!file)       return { success: false, error: 'No file provided.' };
  if (!locationId) return { success: false, error: 'No location specified.' };

  // Server-side file reading — never trust the client for content.
  const csvText = await file.text();

  const result = parseLocalVectorCsv(csvText);
  if ('error' in result) {
    return { success: false, error: result.error };
  }

  return saveExtractedMenu(ctx.orgId, locationId, 'csv-localvector', result.data);
}

// ---------------------------------------------------------------------------
// uploadPosExport — Path 2: Raw POS Export (GPT-4o mapper)
// ---------------------------------------------------------------------------

/**
 * Server Action: send a raw POS export CSV to GPT-4o for magic column mapping,
 * then store the resulting MenuExtractedData for Confidence Triage review.
 *
 * Expects FormData with a "file" key (.csv) and "locationId".
 * When OPENAI_API_KEY is absent or the API call fails, returns a clear error.
 *
 * SECURITY: org_id is always derived from getSafeAuthContext() — never from client.
 */
export async function uploadPosExport(
  formData: FormData,
): Promise<{ success: true; menu: MenuWorkspaceData } | { success: false; error: string }> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) return { success: false, error: 'Unauthorized' };

  const file       = formData.get('file') as File | null;
  const locationId = formData.get('locationId') as string | null;

  if (!file)       return { success: false, error: 'No file provided.' };
  if (!locationId) return { success: false, error: 'No location specified.' };

  // Server-side file reading (AI_RULES §5 — no raw file content to client).
  const csvText = await file.text();

  if (!process.env.OPENAI_API_KEY) {
    return {
      success: false,
      error: 'AI column mapping is not configured. Please use the Gold Standard CSV template instead.',
    };
  }

  const menuData = await parsePosExportWithGPT4o(csvText);

  if (!menuData) {
    return {
      success: false,
      error:
        'AI could not extract menu items from this file. The file may be too large, in an unsupported format, or the AI service timed out. Try the Gold Standard CSV template instead.',
    };
  }

  return saveExtractedMenu(ctx.orgId, locationId, 'csv-pos', menuData);
}

// ---------------------------------------------------------------------------
// uploadMenuFile — Path 3: PDF/Image Menu Upload via GPT-4o Vision
// ---------------------------------------------------------------------------

const ALLOWED_MENU_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const MAX_MENU_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

/**
 * Server Action: extract menu items from a PDF or image file using GPT-4o
 * Vision, then store the resulting MenuExtractedData for Confidence Triage review.
 *
 * Expects FormData with a "file" key (PDF/JPG/PNG/WebP) and "locationId".
 * Uses Vercel AI SDK generateObject() with the MenuOCRSchema.
 *
 * SECURITY: org_id is always derived from getSafeAuthContext() — never from client.
 */
export async function uploadMenuFile(
  formData: FormData,
): Promise<{ success: true; menu: MenuWorkspaceData } | { success: false; error: string }> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) return { success: false, error: 'Unauthorized' };

  const file       = formData.get('file') as File | null;
  const locationId = formData.get('locationId') as string | null;

  if (!file)       return { success: false, error: 'No file provided.' };
  if (!locationId) return { success: false, error: 'No location specified.' };

  // Validate file type
  if (!ALLOWED_MENU_MIME_TYPES.has(file.type)) {
    return { success: false, error: 'Unsupported file type. Please upload a PDF, JPG, PNG, or WebP file.' };
  }

  // Validate file size
  if (file.size > MAX_MENU_FILE_SIZE) {
    return { success: false, error: 'File is too large. Maximum size is 10 MB.' };
  }

  if (!hasApiKey('openai')) {
    return {
      success: false,
      error: 'AI menu extraction is not configured. Please use the Gold Standard CSV template instead.',
    };
  }

  try {
    // Read file to base64 for GPT-4o Vision
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    const { object } = await generateObject({
      model: getModel('menu-ocr'),
      schema: MenuOCRSchema,
      messages: [
        {
          role: 'system',
          content: [
            'You are a restaurant menu digitizer.',
            'Extract ALL menu items from the provided document into structured JSON.',
            'For each item provide: name, description (if visible), price (as a string like "$12"), and category (infer from section headers or context).',
            'If a section header is visible (e.g. "Appetizers", "Mains"), use it as the category.',
            'Do NOT invent items that are not in the document.',
          ].join('\n'),
        },
        {
          role: 'user',
          content: [
            {
              type: 'text' as const,
              text: 'Extract all menu items from this restaurant menu:',
            },
            {
              type: 'file' as const,
              data: base64,
              mimeType: file.type as 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp',
            },
          ],
        },
      ],
    });

    // Map OCR items → MenuExtractedItem[] (add id, confidence, image_url)
    const ocrResult = object as MenuOCROutput;
    const menuData: MenuExtractedData = {
      extracted_at: new Date().toISOString(),
      items: ocrResult.items.map((item) => ({
        id: crypto.randomUUID(),
        name: item.name,
        description: item.description,
        price: item.price,
        category: item.category,
        confidence: 0.70, // OCR-derived items start at 70% confidence
      })),
    };

    return saveExtractedMenu(ctx.orgId, locationId, 'csv-pos', menuData);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[uploadMenuFile] GPT-4o Vision extraction failed:', msg);
    return {
      success: false,
      error: 'AI could not extract menu items from this file. The file may be unreadable, too large, or in an unsupported format. Try the Gold Standard CSV template instead.',
    };
  }
}

// ---------------------------------------------------------------------------
// trackLinkInjection
// ---------------------------------------------------------------------------

/**
 * Server Action: records that the user has distributed the menu URL.
 *
 * Appends `{ event: 'link_injected', date }` to `propagation_events`.
 * Gated by the existing `tenant_link_injection_update` RLS policy
 * (prod_schema.sql) which allows PATCH on propagation_events only.
 *
 * SECURITY: auth check + RLS double-enforcement.
 */
export async function trackLinkInjection(menuId: string): Promise<ActionResult> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) return { success: false, error: 'Unauthorized' };

  const supabase = await createClient();

  const { data: current, error: fetchError } = (await supabase
    .from('magic_menus')
    .select('propagation_events')
    .eq('id', menuId)
    .single()) as { data: { propagation_events: PropagationEvent[] } | null; error: unknown };

  if (fetchError || !current) {
    return { success: false, error: 'Menu not found' };
  }

  const events: PropagationEvent[] = [
    ...(current.propagation_events ?? []),
    { event: 'link_injected', date: new Date().toISOString() },
  ];

  const { error: updateError } = await supabase
    .from('magic_menus')
    .update({ propagation_events: events as unknown as Json })
    .eq('id', menuId);

  if (updateError) {
    return { success: false, error: (updateError as { message: string }).message };
  }

  revalidatePath('/dashboard/magic-menus');
  return { success: true };
}
