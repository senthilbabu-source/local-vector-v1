// ---------------------------------------------------------------------------
// lib/services/embedding-service.ts — Core embedding pipeline (Sprint 119)
//
// Uses Vercel AI SDK embed()/embedMany() with text-embedding-3-small (1536d).
// Provides: prepareTextForTable, generateEmbedding, generateEmbeddingsBatch,
//           backfillTable, saveEmbeddingForRow, generateAndSaveEmbedding.
// ---------------------------------------------------------------------------

import { embed, embedMany } from 'ai';
import { embeddingModel } from '@/lib/ai/providers';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

// ── Types ────────────────────────────────────────────────────────────────────

export type EmbeddableTable =
  | 'menu_items'
  | 'ai_hallucinations'
  | 'target_queries'
  | 'content_drafts'
  | 'locations';

export type BackfillResult = { processed: number; errors: number };

// ── Text preparation (pure function) ─────────────────────────────────────────

/**
 * Builds the text to embed for a given table row.
 * Pure function — no API calls.
 */
export function prepareTextForTable(
  table: EmbeddableTable,
  row: Record<string, unknown>,
): string {
  let text = '';

  switch (table) {
    case 'menu_items':
      text = `${row.name ?? ''} ${row.description ?? ''}`.trim();
      break;
    case 'ai_hallucinations':
      text = String(row.claim_text ?? '').trim();
      break;
    case 'target_queries':
      text = String(row.query_text ?? '').trim();
      break;
    case 'content_drafts':
      text = `${row.draft_title ?? ''} ${row.target_prompt ?? ''}`.trim();
      break;
    case 'locations': {
      const cats = row.categories;
      const catStr = Array.isArray(cats) ? cats.join(', ') : typeof cats === 'string' ? cats : '';
      text = `${row.business_name ?? ''} ${catStr} ${row.city ?? ''}`.trim();
      break;
    }
  }

  // Never return empty string — fallback to table name
  return text || table;
}

// ── Single embedding ─────────────────────────────────────────────────────────

/**
 * Calls OpenAI embedding API for a single text string.
 * Returns number[] of length 1536.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const result = await embed({
      model: embeddingModel,
      value: text,
    });
    return result.embedding;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`embedding_failed: ${msg}`);
  }
}

// ── Batch embedding ──────────────────────────────────────────────────────────

/**
 * Calls OpenAI embedding API for an array of texts in one request.
 * Max batch size: 20 (enforced internally).
 * Returns number[][] in same order as input.
 */
export async function generateEmbeddingsBatch(
  texts: string[],
): Promise<number[][]> {
  if (texts.length > 20) {
    throw new Error('Batch size exceeds maximum of 20');
  }
  if (texts.length === 0) return [];

  const result = await embedMany({
    model: embeddingModel,
    values: texts,
  });
  return result.embeddings;
}

// ── DB operations ────────────────────────────────────────────────────────────

/** Column sets to SELECT for each table (id + text fields needed for embedding). */
const TABLE_SELECT_COLUMNS: Record<EmbeddableTable, string> = {
  menu_items: 'id, name, description',
  ai_hallucinations: 'id, claim_text',
  target_queries: 'id, query_text',
  content_drafts: 'id, draft_title, target_prompt',
  locations: 'id, business_name, categories, city',
};

/**
 * Saves a single embedding to the DB.
 */
export async function saveEmbeddingForRow(
  supabase: SupabaseClient<Database>,
  table: EmbeddableTable,
  id: string,
  embedding: number[],
): Promise<{ ok: boolean }> {
  // pgvector columns accept string-serialized vectors via Supabase
  const { error } = await supabase
    .from(table)
    .update({ embedding: JSON.stringify(embedding) } as never)
    .eq('id', id);

  return { ok: !error };
}

/**
 * Backfills embedding IS NULL rows for a table.
 * Returns { processed, errors }.
 */
export async function backfillTable(
  supabase: SupabaseClient<Database>,
  table: EmbeddableTable,
  batchSize = 20,
): Promise<BackfillResult> {
  const result: BackfillResult = { processed: 0, errors: 0 };

  // Fetch rows missing embeddings
  const { data: rows, error: fetchError } = await supabase
    .from(table)
    .select(TABLE_SELECT_COLUMNS[table])
    .is('embedding', null)
    .limit(batchSize);

  if (fetchError || !rows || rows.length === 0) {
    return result;
  }

  // Prepare texts
  const texts = rows.map((row: Record<string, unknown>) =>
    prepareTextForTable(table, row),
  );

  // Generate embeddings in batch
  let embeddings: number[][];
  try {
    embeddings = await generateEmbeddingsBatch(texts);
  } catch (err) {
    console.warn('[embedding-service] backfillTable batch failed:', err instanceof Error ? err.message : err);
    result.errors = rows.length;
    return result;
  }

  // Save each embedding individually
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as Record<string, unknown>;
    const embedding = embeddings[i];
    if (!embedding) {
      result.errors++;
      continue;
    }

    const { ok } = await saveEmbeddingForRow(
      supabase,
      table,
      row.id as string,
      embedding,
    );

    if (ok) {
      result.processed++;
    } else {
      result.errors++;
    }
  }

  return result;
}

/**
 * Convenience: prepareText → generateEmbedding → saveEmbedding.
 * Never throws — on error: returns { ok: false }.
 * Used inline after DB inserts. Fire-and-forget safe.
 */
export async function generateAndSaveEmbedding(
  supabase: SupabaseClient<Database>,
  table: EmbeddableTable,
  row: Record<string, unknown>,
): Promise<{ ok: boolean }> {
  try {
    const text = prepareTextForTable(table, row);
    const embedding = await generateEmbedding(text);
    return await saveEmbeddingForRow(supabase, table, row.id as string, embedding);
  } catch (err) {
    console.warn(
      `[embedding-service] generateAndSaveEmbedding failed for ${table}:`,
      err instanceof Error ? err.message : err,
    );
    return { ok: false };
  }
}
